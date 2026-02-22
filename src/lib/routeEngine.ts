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
  direcao_tsp?: 'farthest_first' | 'nearest_first';
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

// ---------------------------------------------------------------------------
// TSP direction heuristic
// ---------------------------------------------------------------------------
function resolverDirecaoTSP(
  osList: OSParaRoteirizar[],
  base: LatLng
): 'farthest_first' | 'nearest_first' {
  if (osList.length < 2) return 'nearest_first';

  const withDist = osList.map(os => ({
    dist: haversineDistance(base, { lat: os.lat, lng: os.lng }),
    age: os.dias_aberta,
  }));

  withDist.sort((a, b) => b.dist - a.dist);
  const half = Math.ceil(withDist.length / 2);
  const farHalf = withDist.slice(0, half);
  const nearHalf = withDist.slice(half);

  const avgAgeFar = farHalf.reduce((s, x) => s + x.age, 0) / farHalf.length;
  const avgAgeNear = nearHalf.reduce((s, x) => s + x.age, 0) / nearHalf.length;

  return avgAgeFar > avgAgeNear ? 'farthest_first' : 'nearest_first';
}

// ---------------------------------------------------------------------------
// Nearest-neighbor TSP ordering
// ---------------------------------------------------------------------------
function ordenarTSP(
  osList: OSParaRoteirizar[],
  base: LatLng,
  direcao: 'farthest_first' | 'nearest_first'
): OSParaRoteirizar[] {
  if (osList.length === 0) return [];

  const ordered: OSParaRoteirizar[] = [];

  if (direcao === 'farthest_first') {
    // Sort all by distance from base descending, then do nearest-neighbor from that farthest point
    const withDist = [...osList].map(os => ({
      os,
      dist: haversineDistance(base, { lat: os.lat, lng: os.lng }),
    }));
    withDist.sort((a, b) => b.dist - a.dist);

    let remaining = withDist.map(d => d.os);
    let pos = base;

    while (remaining.length > 0) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = haversineDistance(pos, { lat: remaining[i].lat, lng: remaining[i].lng });
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      ordered.push(remaining[bestIdx]);
      pos = { lat: remaining[bestIdx].lat, lng: remaining[bestIdx].lng };
      remaining.splice(bestIdx, 1);
    }
  } else {
    let remaining = [...osList];
    let pos = base;

    while (remaining.length > 0) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = haversineDistance(pos, { lat: remaining[i].lat, lng: remaining[i].lng });
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      ordered.push(remaining[bestIdx]);
      pos = { lat: remaining[bestIdx].lat, lng: remaining[bestIdx].lng };
      remaining.splice(bestIdx, 1);
    }
  }

  return ordered;
}

// ---------------------------------------------------------------------------
// Main optimization — strict bin-packing per day
// ---------------------------------------------------------------------------
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
      metricas: {
        distancia_total_km: 0,
        tempo_total_min: 0,
        dias_necessarios: 0,
        os_incluidas: 0,
        os_excluidas: excluidas.length,
        horario_inicio: cfg.horario_inicio,
        horario_fim_previsto: cfg.horario_fim,
      },
      cidadesSemRota,
    };
  }

  if (comCoord.length === 0) {
    return {
      paradas: [],
      excluidas,
      metricas: {
        distancia_total_km: 0,
        tempo_total_min: 0,
        dias_necessarios: 0,
        os_incluidas: 0,
        os_excluidas: excluidas.length,
        horario_inicio: cfg.horario_inicio,
        horario_fim_previsto: cfg.horario_fim,
      },
      cidadesSemRota: [],
    };
  }

  const inicioMin = timeToMinutes(cfg.horario_inicio);
  const fimMin = timeToMinutes(cfg.horario_fim);
  const almocoMin = timeToMinutes(cfg.almoco_inicio);
  const limiteMinDia = fimMin - inicioMin - cfg.duracao_almoco_min;

  // FIX: Day 1 start guard — if current time is already past expediente, day 1 = tomorrow
  const agora = new Date();
  const agoraMin = agora.getHours() * 60 + agora.getMinutes();
  const baseDate = new Date(agora);
  baseDate.setHours(0, 0, 0, 0);
  if (agoraMin >= fimMin) {
    baseDate.setDate(baseDate.getDate() + 1);
  }

  // TSP direction heuristic
  const direcao = resolverDirecaoTSP(comCoord, cfg.base);
  const osOrdenadas = ordenarTSP(comCoord, cfg.base, direcao);

  // Respect period preferences within the TSP order
  const manhaPeriodo = new Set(comCoord.filter(os => os.periodo_agendamento === 'manha').map(os => os.id));
  const tardePeriodo = new Set(comCoord.filter(os => os.periodo_agendamento === 'tarde').map(os => os.id));

  // Re-sort TSP result to prefer morning OS first, afternoon OS later (stable partition)
  const manha = osOrdenadas.filter(os => manhaPeriodo.has(os.id));
  const tarde = osOrdenadas.filter(os => tardePeriodo.has(os.id));
  const semPeriodo = osOrdenadas.filter(os => !manhaPeriodo.has(os.id) && !tardePeriodo.has(os.id));
  const osFinais = [...manha, ...semPeriodo, ...tarde];

  // Bin-packing: distribute OS into days with strict hourly limit
  let dia = 1;
  let tempoAcumuladoDia = 0;
  let currentMin = inicioMin;
  let almocoFeitoDia = false;
  let posAtual: LatLng = { ...cfg.base };

  for (const os of osFinais) {
    let placed = false;

    let tentativaDia = dia;
    let tentativaMin = currentMin;
    let tentativaAcumulado = tempoAcumuladoDia;
    let tentativaAlmoco = almocoFeitoDia;
    let tentativaPos = posAtual;

    while (tentativaDia <= cfg.max_dias) {
      const dist = haversineDistance(tentativaPos, { lat: os.lat, lng: os.lng }) * 1.35;
      const travelMin = estimateDriveTime(dist, cfg.velocidade_media_kmh);

      let chegadaMin = tentativaMin + travelMin;

      if (!tentativaAlmoco && tentativaMin < almocoMin && chegadaMin >= almocoMin) {
        chegadaMin += cfg.duracao_almoco_min;
        tentativaAlmoco = true;
      } else if (!tentativaAlmoco && tentativaMin >= almocoMin) {
        tentativaAlmoco = true;
      }

      const atendMin = os.tempo_estimado_minutos || cfg.tempo_medio_atendimento_min;
      const saidaMin = chegadaMin + atendMin;
      const custoTotal = travelMin + atendMin;

      // FIX: strict validation — departure MUST be within work hours AND daily budget
      if (saidaMin <= fimMin && tentativaAcumulado + custoTotal <= limiteMinDia) {
        paradas.push({
          os,
          ordem: paradas.length + 1,
          distancia_km: Math.round(dist * 10) / 10,
          tempo_deslocamento_min: travelMin,
          horario_chegada: minutesToDate(baseDate, chegadaMin, tentativaDia - 1),
          horario_saida: minutesToDate(baseDate, saidaMin, tentativaDia - 1),
          dia: tentativaDia,
          is_existente: !!os.agendamento_existente,
        });

        // Commit state
        dia = tentativaDia;
        currentMin = saidaMin;
        tempoAcumuladoDia = tentativaAcumulado + custoTotal;
        almocoFeitoDia = tentativaAlmoco;
        posAtual = { lat: os.lat, lng: os.lng };
        placed = true;
        break;
      } else {
        // Day is full — open next day
        if (tentativaDia >= cfg.max_dias) break;
        tentativaDia++;
        tentativaMin = inicioMin;
        tentativaAcumulado = 0;
        tentativaAlmoco = false;
        tentativaPos = { ...cfg.base };
      }
    }

    if (!placed) {
      excluidas.push({ os, motivo: `Não cabe no horizonte de ${cfg.max_dias} dias` });
    }
  }

  const distTotal = paradas.reduce((s, p) => s + p.distancia_km, 0);
  const lastParada = paradas[paradas.length - 1];
  const retornoKm = lastParada
    ? haversineDistance({ lat: lastParada.os.lat, lng: lastParada.os.lng }, cfg.base) * 1.35
    : 0;

  const tempoTotalMin = paradas.reduce(
    (s, p) => s + p.tempo_deslocamento_min + (p.os.tempo_estimado_minutos || cfg.tempo_medio_atendimento_min),
    0
  ) + estimateDriveTime(retornoKm, cfg.velocidade_media_kmh);

  const diasNecessarios = paradas.length > 0 ? Math.max(...paradas.map(p => p.dia)) : 0;

  const horarioFimPrevisto = lastParada
    ? `${lastParada.horario_saida.getHours().toString().padStart(2, '0')}:${lastParada.horario_saida.getMinutes().toString().padStart(2, '0')}`
    : cfg.horario_fim;

  return {
    paradas,
    excluidas,
    metricas: {
      distancia_total_km: Math.round((distTotal + retornoKm) * 10) / 10,
      tempo_total_min: tempoTotalMin,
      dias_necessarios: diasNecessarios,
      os_incluidas: paradas.length,
      os_excluidas: excluidas.length,
      horario_inicio: cfg.horario_inicio,
      horario_fim_previsto: horarioFimPrevisto,
    },
    cidadesSemRota: [],
    direcao_tsp: direcao,
  };
}

// ---------------------------------------------------------------------------
// Recalculate with new order — same strict bin-packing
// ---------------------------------------------------------------------------
export function recalcularComNovaOrdem(
  paradas: ParadaRota[],
  config: Partial<ConfigRota>
): ParadaRota[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const inicioMin = timeToMinutes(cfg.horario_inicio);
  const fimMin = timeToMinutes(cfg.horario_fim);
  const almocoMin = timeToMinutes(cfg.almoco_inicio);
  const limiteMinDia = fimMin - inicioMin - cfg.duracao_almoco_min;

  const agora = new Date();
  const agoraMin = agora.getHours() * 60 + agora.getMinutes();
  const baseDate = new Date(agora);
  baseDate.setHours(0, 0, 0, 0);
  if (agoraMin >= fimMin) baseDate.setDate(baseDate.getDate() + 1);

  let currentPos: LatLng = { ...cfg.base };
  let currentMin = inicioMin;
  let dia = 1;
  let tempoAcumuladoDia = 0;
  let almocoFeitoDia = false;

  return paradas.map((p, idx) => {
    const dist = haversineDistance(currentPos, { lat: p.os.lat, lng: p.os.lng }) * 1.35;
    const travelMin = estimateDriveTime(dist, cfg.velocidade_media_kmh);
    let chegadaMin = currentMin + travelMin;

    if (!almocoFeitoDia && currentMin < almocoMin && chegadaMin >= almocoMin) {
      chegadaMin += cfg.duracao_almoco_min;
      almocoFeitoDia = true;
    } else if (!almocoFeitoDia && currentMin >= almocoMin) {
      almocoFeitoDia = true;
    }

    const atendMin = p.os.tempo_estimado_minutos || cfg.tempo_medio_atendimento_min;
    const saidaMin = chegadaMin + atendMin;
    const custoTotal = travelMin + atendMin;

    // Advance to next day if this OS doesn't fit
    if ((saidaMin > fimMin || tempoAcumuladoDia + custoTotal > limiteMinDia) && cfg.permite_pernoite && dia < cfg.max_dias) {
      dia++;
      currentMin = inicioMin;
      tempoAcumuladoDia = 0;
      almocoFeitoDia = false;
      currentPos = { ...cfg.base };

      const dist2 = haversineDistance(currentPos, { lat: p.os.lat, lng: p.os.lng }) * 1.35;
      const travel2 = estimateDriveTime(dist2, cfg.velocidade_media_kmh);
      const chegada2 = currentMin + travel2;
      const saida2 = chegada2 + atendMin;

      currentPos = { lat: p.os.lat, lng: p.os.lng };
      currentMin = saida2;
      tempoAcumuladoDia = travel2 + atendMin;

      return {
        ...p,
        ordem: idx + 1,
        distancia_km: Math.round(dist2 * 10) / 10,
        tempo_deslocamento_min: travel2,
        horario_chegada: minutesToDate(baseDate, chegada2, dia - 1),
        horario_saida: minutesToDate(baseDate, saida2, dia - 1),
        dia,
      };
    }

    currentPos = { lat: p.os.lat, lng: p.os.lng };
    currentMin = saidaMin;
    tempoAcumuladoDia += custoTotal;

    return {
      ...p,
      ordem: idx + 1,
      distancia_km: Math.round(dist * 10) / 10,
      tempo_deslocamento_min: travelMin,
      horario_chegada: minutesToDate(baseDate, chegadaMin, dia - 1),
      horario_saida: minutesToDate(baseDate, saidaMin, dia - 1),
      dia,
    };
  });
}
