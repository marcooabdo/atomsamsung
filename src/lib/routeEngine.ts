import { haversineDistance, estimateDriveTime, type LatLng } from './googleMapsHelper';

export interface OSParaRoteirizar {
  id: string;
  numero_os: string;
  lat: number;
  lng: number;
  cliente_nome: string;
  cliente_cidade: string;
  cliente_endereco: string;
  tipo_atendimento: string;
  linha_produto?: string;
  dias_aberta: number;
  tempo_estimado_minutos: number;
  periodo_agendamento?: 'manha' | 'tarde' | null;
  agendamento_existente?: { data: string; periodo: string; confirmado: boolean } | null;
  prioridade?: string;
  rota_nome?: string;
  rota_cor?: string;
}

export interface ParadaRota {
  os: OSParaRoteirizar;
  ordem: number;
  distancia_km: number;
  tempo_deslocamento_min: number;
  horario_chegada: Date;
  horario_saida: Date;
  dia: number;
  is_existente: boolean;
}

export interface ResultadoOtimizacao {
  paradas: ParadaRota[];
  excluidas: Array<{ os: OSParaRoteirizar; motivo: string }>;
  metricas: {
    distancia_total_km: number;
    tempo_total_min: number;
    dias_necessarios: number;
    os_incluidas: number;
    os_excluidas: number;
    horario_inicio: string;
    horario_fim_previsto: string;
  };
  cidadesSemRota: string[];
}

export interface ConfigRota {
  base: LatLng;
  horario_inicio: string;
  horario_fim: string;
  almoco_inicio: string;
  duracao_almoco_min: number;
  tempo_medio_atendimento_min: number;
  permite_pernoite: boolean;
  max_dias: number;
  velocidade_media_kmh: number;
}

const DEFAULT_CONFIG: ConfigRota = {
  base: { lat: 0, lng: 0 },
  horario_inicio: '08:00',
  horario_fim: '18:00',
  almoco_inicio: '12:00',
  duracao_almoco_min: 60,
  tempo_medio_atendimento_min: 90,
  permite_pernoite: false,
  max_dias: 5,
  velocidade_media_kmh: 40,
};

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function minutesToDate(baseDate: Date, minutes: number, dayOffset: number): Date {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(minutes);
  return d;
}

function scorePontuacao(os: OSParaRoteirizar, distKm: number, maxDist: number): number {
  const distScore = 1 - (distKm / (maxDist || 1));
  const idadeScore = Math.min(os.dias_aberta / 30, 1);
  const prioridadeScore = os.prioridade === 'urgente' ? 1 : os.prioridade === 'alta' ? 0.7 : os.prioridade === 'normal' ? 0.4 : 0.2;
  return distScore * 0.5 + idadeScore * 0.3 + prioridadeScore * 0.2;
}

export function otimizarRota(
  osList: OSParaRoteirizar[],
  config: Partial<ConfigRota>,
  rotasCidades: Map<string, { nome: string; cor: string }>
): ResultadoOtimizacao {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const paradas: ParadaRota[] = [];
  const excluidas: Array<{ os: OSParaRoteirizar; motivo: string }> = [];
  const cidadesSemRota: string[] = [];

  const semCoord = osList.filter(os => !os.lat || !os.lng);
  semCoord.forEach(os => excluidas.push({ os, motivo: 'Sem coordenadas de geolocalização' }));

  const comCoord = osList.filter(os => os.lat && os.lng);

  comCoord.forEach(os => {
    const cidade = (os.cliente_cidade || '').trim().toLowerCase();
    if (cidade && !rotasCidades.has(cidade) && !cidadesSemRota.includes(cidade)) {
      cidadesSemRota.push(cidade);
    }
  });

  if (cidadesSemRota.length > 0) {
    return {
      paradas: [],
      excluidas,
      metricas: { distancia_total_km: 0, tempo_total_min: 0, dias_necessarios: 0, os_incluidas: 0, os_excluidas: excluidas.length, horario_inicio: cfg.horario_inicio, horario_fim_previsto: cfg.horario_fim },
      cidadesSemRota,
    };
  }

  const inicioMin = timeToMinutes(cfg.horario_inicio);
  const fimMin = timeToMinutes(cfg.horario_fim);
  const almocoMin = timeToMinutes(cfg.almoco_inicio);

  let currentPos: LatLng = { ...cfg.base };
  let currentMin = inicioMin;
  let dia = 1;
  const disponivel = new Set(comCoord.map(os => os.id));
  const baseDate = new Date();
  baseDate.setHours(0, 0, 0, 0);

  const manhaPeriodo = comCoord.filter(os => os.periodo_agendamento === 'manha').map(os => os.id);
  const tardePeriodo = comCoord.filter(os => os.periodo_agendamento === 'tarde').map(os => os.id);

  while (disponivel.size > 0) {
    if (dia > cfg.max_dias) {
      disponivel.forEach(id => {
        const os = comCoord.find(o => o.id === id);
        if (os) excluidas.push({ os, motivo: `Excede ${cfg.max_dias} dias de rota` });
      });
      break;
    }

    const restante = comCoord.filter(os => disponivel.has(os.id));
    if (restante.length === 0) break;

    let preferidas: OSParaRoteirizar[];
    if (currentMin < almocoMin) {
      preferidas = restante.filter(os => manhaPeriodo.includes(os.id));
      if (preferidas.length === 0) preferidas = restante.filter(os => !tardePeriodo.includes(os.id));
      if (preferidas.length === 0) preferidas = restante;
    } else {
      preferidas = restante.filter(os => tardePeriodo.includes(os.id));
      if (preferidas.length === 0) preferidas = restante.filter(os => !manhaPeriodo.includes(os.id));
      if (preferidas.length === 0) preferidas = restante;
    }

    const distances = preferidas.map(os => ({
      os,
      dist: haversineDistance(currentPos, { lat: os.lat, lng: os.lng }) * 1.35,
    }));

    const maxDist = Math.max(...distances.map(d => d.dist), 1);
    distances.sort((a, b) => scorePontuacao(b.os, b.dist, maxDist) - scorePontuacao(a.os, a.dist, maxDist));

    const best = distances[0];
    if (!best) break;

    const travelMin = estimateDriveTime(best.dist, cfg.velocidade_media_kmh);
    let arrivalMin = currentMin + travelMin;

    if (currentMin < almocoMin && arrivalMin >= almocoMin) {
      arrivalMin += cfg.duracao_almoco_min;
    }

    const departureMin = arrivalMin + (best.os.tempo_estimado_minutos || cfg.tempo_medio_atendimento_min);

    if (departureMin > fimMin) {
      if (cfg.permite_pernoite && dia < cfg.max_dias) {
        dia++;
        currentMin = inicioMin;
        continue;
      } else if (paradas.length === 0 || arrivalMin <= fimMin) {
        // still allow if arrival is within work hours
      } else {
        excluidas.push({ os: best.os, motivo: `Não cabe no horário (dia ${dia})` });
        disponivel.delete(best.os.id);
        continue;
      }
    }

    paradas.push({
      os: best.os,
      ordem: paradas.length + 1,
      distancia_km: Math.round(best.dist * 10) / 10,
      tempo_deslocamento_min: travelMin,
      horario_chegada: minutesToDate(baseDate, arrivalMin, dia - 1),
      horario_saida: minutesToDate(baseDate, departureMin, dia - 1),
      dia,
      is_existente: !!best.os.agendamento_existente,
    });

    currentPos = { lat: best.os.lat, lng: best.os.lng };
    currentMin = departureMin;
    disponivel.delete(best.os.id);
  }

  const distTotal = paradas.reduce((s, p) => s + p.distancia_km, 0);
  const lastParada = paradas[paradas.length - 1];
  const retornoKm = lastParada ? haversineDistance({ lat: lastParada.os.lat, lng: lastParada.os.lng }, cfg.base) * 1.35 : 0;

  return {
    paradas,
    excluidas,
    metricas: {
      distancia_total_km: Math.round((distTotal + retornoKm) * 10) / 10,
      tempo_total_min: paradas.reduce((s, p) => s + p.tempo_deslocamento_min + (p.os.tempo_estimado_minutos || cfg.tempo_medio_atendimento_min), 0) + estimateDriveTime(retornoKm, cfg.velocidade_media_kmh),
      dias_necessarios: paradas.length > 0 ? paradas[paradas.length - 1].dia : 0,
      os_incluidas: paradas.length,
      os_excluidas: excluidas.length,
      horario_inicio: cfg.horario_inicio,
      horario_fim_previsto: lastParada ? `${lastParada.horario_saida.getHours().toString().padStart(2, '0')}:${lastParada.horario_saida.getMinutes().toString().padStart(2, '0')}` : cfg.horario_fim,
    },
    cidadesSemRota: [],
  };
}

export function recalcularComNovaOrdem(
  paradas: ParadaRota[],
  config: Partial<ConfigRota>
): ParadaRota[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const inicioMin = timeToMinutes(cfg.horario_inicio);
  const fimMin = timeToMinutes(cfg.horario_fim);
  const almocoMin = timeToMinutes(cfg.almoco_inicio);
  const baseDate = new Date();
  baseDate.setHours(0, 0, 0, 0);

  let currentPos: LatLng = { ...cfg.base };
  let currentMin = inicioMin;
  let dia = 1;

  return paradas.map((p, idx) => {
    const dist = haversineDistance(currentPos, { lat: p.os.lat, lng: p.os.lng }) * 1.35;
    const travelMin = estimateDriveTime(dist, cfg.velocidade_media_kmh);
    let arrivalMin = currentMin + travelMin;

    if (currentMin < almocoMin && arrivalMin >= almocoMin) {
      arrivalMin += cfg.duracao_almoco_min;
    }

    const departureMin = arrivalMin + (p.os.tempo_estimado_minutos || cfg.tempo_medio_atendimento_min);

    if (departureMin > fimMin && cfg.permite_pernoite) {
      dia++;
      currentMin = inicioMin;
      const newTravel = estimateDriveTime(dist, cfg.velocidade_media_kmh);
      arrivalMin = currentMin + newTravel;
      const newDep = arrivalMin + (p.os.tempo_estimado_minutos || cfg.tempo_medio_atendimento_min);
      currentPos = { lat: p.os.lat, lng: p.os.lng };
      currentMin = newDep;

      return {
        ...p,
        ordem: idx + 1,
        distancia_km: Math.round(dist * 10) / 10,
        tempo_deslocamento_min: newTravel,
        horario_chegada: minutesToDate(baseDate, arrivalMin, dia - 1),
        horario_saida: minutesToDate(baseDate, newDep, dia - 1),
        dia,
      };
    }

    currentPos = { lat: p.os.lat, lng: p.os.lng };
    currentMin = departureMin;

    return {
      ...p,
      ordem: idx + 1,
      distancia_km: Math.round(dist * 10) / 10,
      tempo_deslocamento_min: travelMin,
      horario_chegada: minutesToDate(baseDate, arrivalMin, dia - 1),
      horario_saida: minutesToDate(baseDate, departureMin, dia - 1),
      dia,
    };
  });
}
