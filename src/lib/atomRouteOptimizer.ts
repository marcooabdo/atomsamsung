import { supabase } from './supabase';

async function gerarPolylineGoogleMaps(
  pontoBase: { lat: number; lng: number },
  osIncluidas: OSIncluida[]
): Promise<string | undefined> {
  return undefined;
}

export interface OSParaOtimizar {
  id: string;
  numero_os: string;
  tipo_os: 'LP' | 'OW';
  linha_produto_id: string | null;
  linha_produto_nome: string | null;
  tempo_medio_reparo: number;
  lat: number;
  lng: number;
  endereco: string;
  created_at: string;
  rota: string;
  cliente_nome: string;
  cliente_logradouro: string;
  cliente_numero: string;
  cliente_bairro: string;
  cliente_cidade: string;
  cliente_cep: string;
  prioridade: string;
  tipo_atendimento: string;
}

export interface TecnicoConfig {
  id: string;
  nome: string;
  horario_inicio: string;
  horario_fim: string;
  tempo_almoco_minutos: number;
  dias_permitidos_fora: number;
  linhas_produto: string[];
}

export interface ResultadoOtimizacao {
  otimizacao_id: string;
  os_incluidas: OSIncluida[];
  os_excluidas: OSExcluida[];
  metricas: {
    distancia_total_km: number;
    tempo_total_minutos: number;
    quilometragem_total_km: number;
    dias_necessarios: number;
    horario_inicio: string;
    horario_fim: string;
    requer_pernoite: boolean;
    distancia_retorno_km: number;
  };
  avisos: string[];
  pontoBase: { lat: number; lng: number; endereco: string };
  polyline?: string;
}

export interface OSIncluida {
  os_id: string;
  numero_os: string;
  ordem_visita: number;
  dia: number;
  horario_chegada: string;
  horario_conclusao: string;
  distancia_anterior_km: number;
  tempo_deslocamento_minutos: number;
  lat?: number;
  lng?: number;
  endereco?: string;
  coordenadas?: { lat: number; lng: number };
  cliente_nome?: string;
  cliente_logradouro?: string;
  cliente_numero?: string;
  cliente_bairro?: string;
  cliente_cidade?: string;
  cliente_cep?: string;
  prioridade?: string;
  tipo_atendimento?: string;
  tipo_os?: 'LP' | 'OW';
  linha_produto_nome?: string;
}

export interface OSExcluida {
  os_id: string;
  numero_os: string;
  motivo: string;
  tecnicos_sugeridos?: string[];
}

// ---------------------------------------------------------------------------
// Haversine distance (km, straight line)
// ---------------------------------------------------------------------------
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calcularDistanciaETempo(
  lat1: number, lng1: number,
  lat2: number, lng2: number
): { distancia_km: number; tempo_minutos: number } {
  const distanciaLinhaReta = haversine(lat1, lng1, lat2, lng2);
  const fatorCorrecaoEstradas = 1.4;
  const distancia_km = distanciaLinhaReta * fatorCorrecaoEstradas;
  const velocidade_media = 35;
  const tempo_minutos = Math.ceil((distancia_km / velocidade_media) * 60);
  return { distancia_km, tempo_minutos };
}

function timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function minToTimeStr(min: number): string {
  const h = Math.floor(min / 60) % 24;
  const m = min % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function minToISO(baseDate: Date, min: number, dayOffset: number): string {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + dayOffset);
  d.setHours(0, 0, 0, 0);
  d.setMinutes(min);
  return d.toISOString();
}

// ---------------------------------------------------------------------------
// TSP direction heuristic: check if far OS are older (go far-first) or near
// ---------------------------------------------------------------------------
function resolverDirecaoTSP(
  osList: OSParaOtimizar[],
  base: { lat: number; lng: number }
): 'farthest_first' | 'nearest_first' {
  if (osList.length < 2) return 'nearest_first';

  const withDist = osList.map(os => ({
    os,
    dist: haversine(base.lat, base.lng, os.lat, os.lng),
    age: (Date.now() - new Date(os.created_at).getTime()) / 86400000,
  }));

  const sorted = [...withDist].sort((a, b) => b.dist - a.dist);
  const farHalf = sorted.slice(0, Math.ceil(sorted.length / 2));
  const nearHalf = sorted.slice(Math.ceil(sorted.length / 2));

  const avgAgeFar = farHalf.reduce((s, x) => s + x.age, 0) / farHalf.length;
  const avgAgeNear = nearHalf.reduce((s, x) => s + x.age, 0) / nearHalf.length;

  return avgAgeFar > avgAgeNear ? 'farthest_first' : 'nearest_first';
}

// ---------------------------------------------------------------------------
// Bin-packing TSP: distribui OSs em dias respeitando limite de horas
// ---------------------------------------------------------------------------
function binPackingTSP(
  osOrdenadas: OSParaOtimizar[],
  base: { lat: number; lng: number; endereco: string },
  inicioMin: number,
  fimMin: number,
  almocoMin: number,
  duracaoAlmocoMin: number,
  maxDias: number,
  dataBase: Date
): { incluidas: OSIncluida[]; excluidas: OSExcluida[]; avisos: string[] } {
  const limiteMinDia = fimMin - inicioMin - duracaoAlmocoMin;
  const incluidas: OSIncluida[] = [];
  const excluidas: OSExcluida[] = [];
  const avisos: string[] = [];

  let dia = 1;
  let tempoAcumuladoDia = 0;
  let currentMin = inicioMin;
  let almocoFeitoDia = false;
  let posAtual = { lat: base.lat, lng: base.lng };
  let ordem = 1;

  for (const os of osOrdenadas) {
    let placed = false;

    while (dia <= maxDias) {
      const { distancia_km, tempo_minutos: travelMin } = calcularDistanciaETempo(
        posAtual.lat, posAtual.lng, os.lat, os.lng
      );

      let chegadaMin = currentMin + travelMin;

      if (!almocoFeitoDia && currentMin < almocoMin && chegadaMin >= almocoMin) {
        chegadaMin += duracaoAlmocoMin;
        almocoFeitoDia = true;
      } else if (!almocoFeitoDia && currentMin >= almocoMin) {
        almocoFeitoDia = true;
      }

      const saidaMin = chegadaMin + os.tempo_medio_reparo;
      const custoTotal = travelMin + os.tempo_medio_reparo;

      if (saidaMin <= fimMin && tempoAcumuladoDia + custoTotal <= limiteMinDia) {
        incluidas.push({
          os_id: os.id,
          numero_os: os.numero_os,
          ordem_visita: ordem++,
          dia,
          horario_chegada: minToISO(dataBase, chegadaMin, dia - 1),
          horario_conclusao: minToISO(dataBase, saidaMin, dia - 1),
          distancia_anterior_km: parseFloat(distancia_km.toFixed(2)),
          tempo_deslocamento_minutos: travelMin,
          lat: os.lat,
          lng: os.lng,
          endereco: os.endereco,
          coordenadas: { lat: os.lat, lng: os.lng },
          cliente_nome: os.cliente_nome,
          cliente_logradouro: os.cliente_logradouro,
          cliente_numero: os.cliente_numero,
          cliente_bairro: os.cliente_bairro,
          cliente_cidade: os.cliente_cidade,
          cliente_cep: os.cliente_cep,
          prioridade: os.prioridade,
          tipo_atendimento: os.tipo_atendimento,
          tipo_os: os.tipo_os,
          linha_produto_nome: os.linha_produto_nome,
        });

        posAtual = { lat: os.lat, lng: os.lng };
        currentMin = saidaMin;
        tempoAcumuladoDia += custoTotal;
        placed = true;
        break;
      } else {
        if (dia >= maxDias) break;
        dia++;
        currentMin = inicioMin;
        tempoAcumuladoDia = 0;
        almocoFeitoDia = false;
        posAtual = { lat: base.lat, lng: base.lng };
      }
    }

    if (!placed) {
      excluidas.push({
        os_id: os.id,
        numero_os: os.numero_os,
        motivo: `Não cabe no horizonte de ${maxDias} dias úteis`,
      });
    }
  }

  const diasNecessarios = incluidas.length > 0 ? Math.max(...incluidas.map(o => o.dia)) : 0;
  if (diasNecessarios > 1) {
    avisos.push(`Esta rota requer ${diasNecessarios} dias de trabalho.`);
  }

  return { incluidas, excluidas, avisos };
}

// ---------------------------------------------------------------------------
// Nearest-neighbor TSP ordering (respects direction heuristic)
// ---------------------------------------------------------------------------
function ordenarTSP(
  osList: OSParaOtimizar[],
  base: { lat: number; lng: number },
  direcao: 'farthest_first' | 'nearest_first'
): OSParaOtimizar[] {
  if (osList.length === 0) return [];

  const restantes = [...osList];
  const ordered: OSParaOtimizar[] = [];

  if (direcao === 'farthest_first') {
    let pos = { lat: base.lat, lng: base.lng };

    const allWithDist = restantes.map(os => ({
      os,
      dist: haversine(base.lat, base.lng, os.lat, os.lng),
    }));
    allWithDist.sort((a, b) => b.dist - a.dist);

    const farthestFirst = allWithDist.map(d => d.os);
    let remaining = [...farthestFirst];

    while (remaining.length > 0) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = haversine(pos.lat, pos.lng, remaining[i].lat, remaining[i].lng);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      ordered.push(remaining[bestIdx]);
      pos = { lat: remaining[bestIdx].lat, lng: remaining[bestIdx].lng };
      remaining.splice(bestIdx, 1);
    }
  } else {
    let pos = { lat: base.lat, lng: base.lng };
    let remaining = [...restantes];

    while (remaining.length > 0) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = haversine(pos.lat, pos.lng, remaining[i].lat, remaining[i].lng);
        if (d < bestDist) {
          bestDist = d;
          bestIdx = i;
        }
      }
      ordered.push(remaining[bestIdx]);
      pos = { lat: remaining[bestIdx].lat, lng: remaining[bestIdx].lng };
      remaining.splice(bestIdx, 1);
    }
  }

  return ordered;
}

// ---------------------------------------------------------------------------
// Main optimization function
// ---------------------------------------------------------------------------
export async function otimizarRotaInteligente(
  unidadeId: string,
  tecnicoId: string,
  rotasSelecionadas: string[],
  usuarioOtimizadorId: string
): Promise<ResultadoOtimizacao> {
  const { data: unidade } = await supabase
    .from('unidades')
    .select('latitude, longitude, endereco')
    .eq('id', unidadeId)
    .single();

  if (!unidade || !unidade.latitude || !unidade.longitude) {
    throw new Error('Unidade sem coordenadas cadastradas');
  }

  const pontoBase = {
    lat: unidade.latitude,
    lng: unidade.longitude,
    endereco: unidade.endereco || 'Unidade',
  };

  const { data: tecnico } = await supabase
    .from('usuarios')
    .select('*, tecnicos_linhas_produto(linha_produto_id)')
    .eq('id', tecnicoId)
    .single();

  if (!tecnico) throw new Error('Técnico não encontrado');

  const linhasDoTecnico = (tecnico.tecnicos_linhas_produto?.map((t: any) => t.linha_produto_id) || []) as string[];

  const { data: osLista } = await supabase
    .from('os')
    .select(`
      id,
      numero_os_samsung,
      numero_os_interna,
      tipo_os,
      linha_produto_id,
      created_at,
      coluna_kanban,
      lat,
      lng,
      tipo_atendimento,
      aparelho_linha,
      cliente_nome,
      cliente_logradouro,
      cliente_numero,
      cliente_bairro,
      cliente_cidade,
      cliente_cep,
      agendamentos(lat, lng),
      linhas_produto(nome, tempo_medio_reparo_minutos)
    `)
    .eq('unidade_id', unidadeId)
    .in('coluna_kanban', rotasSelecionadas)
    .eq('tipo_atendimento', 'IH');

  if (!osLista || osLista.length === 0) {
    throw new Error('Nenhuma OS IH encontrada nas rotas selecionadas');
  }

  const osValidas: OSParaOtimizar[] = [];
  const osExcluidas: OSExcluida[] = [];

  for (const os of osLista) {
    const agendamento = os.agendamentos?.[0];
    let osLat = os.lat ?? agendamento?.lat;
    let osLng = os.lng ?? agendamento?.lng;

    if (!osLat || !osLng) {
      osExcluidas.push({
        os_id: os.id,
        numero_os: os.numero_os_samsung || os.numero_os_interna || '',
        motivo: 'OS sem coordenadas de localização',
      });
      continue;
    }

    // FIX: skill filter with trim + toUpperCase on both sides
    if (os.linha_produto_id && linhasDoTecnico.length > 0 && !linhasDoTecnico.includes(os.linha_produto_id)) {
      const aparelhoNorm = (os.aparelho_linha ?? '').trim().toUpperCase();
      const habilidades: string[] = tecnico.habilidades ?? [];
      const hasSkillByName = habilidades.some(
        h => h.trim().toUpperCase() === aparelhoNorm
      );

      if (!hasSkillByName) {
        const { data: tecnicosCompativeis } = await supabase.rpc('buscar_tecnicos_compativeis', {
          p_os_id: os.id,
          p_unidade_id: unidadeId,
        });

        osExcluidas.push({
          os_id: os.id,
          numero_os: os.numero_os_samsung || os.numero_os_interna || '',
          motivo: `O técnico não atende a linha de produto: ${os.linhas_produto?.nome || os.aparelho_linha || 'N/A'}`,
          tecnicos_sugeridos: tecnicosCompativeis?.map((t: any) => t.tecnico_nome) || [],
        });
        continue;
      }
    }

    osValidas.push({
      id: os.id,
      numero_os: os.numero_os_samsung || os.numero_os_interna || '',
      tipo_os: os.tipo_os,
      linha_produto_id: os.linha_produto_id,
      linha_produto_nome: os.linhas_produto?.nome ?? null,
      tempo_medio_reparo: os.linhas_produto?.tempo_medio_reparo_minutos || 60,
      lat: parseFloat(osLat as any),
      lng: parseFloat(osLng as any),
      endereco: `${os.cliente_logradouro || ''}, ${os.cliente_numero || ''} - ${os.cliente_bairro || ''}, ${os.cliente_cidade || ''}`.trim(),
      created_at: os.created_at,
      rota: os.coluna_kanban,
      cliente_nome: os.cliente_nome || '',
      cliente_logradouro: os.cliente_logradouro || '',
      cliente_numero: os.cliente_numero || '',
      cliente_bairro: os.cliente_bairro || '',
      cliente_cidade: os.cliente_cidade || '',
      cliente_cep: os.cliente_cep || '',
      prioridade: 'media',
      tipo_atendimento: os.tipo_atendimento || 'IH',
    });
  }

  if (osValidas.length === 0) {
    throw new Error('Nenhuma OS válida após filtro de habilidades');
  }

  // Work hours
  const horarioInicio: string = tecnico.horario_inicio_expediente ?? '08:00';
  const horarioFim: string = tecnico.horario_fim_expediente ?? '18:00';
  const horarioAlmoco: string = tecnico.horario_almoco_inicio ?? '12:00';
  const duracaoAlmoco: number = tecnico.duracao_almoco_minutos ?? 60;
  const maxDias: number = tecnico.dias_permitidos_fora ?? 5;

  const inicioMin = timeToMin(horarioInicio);
  const fimMin = timeToMin(horarioFim);
  const almocoMin = timeToMin(horarioAlmoco);

  // FIX: Day 1 start date — if current time is past expediente, start tomorrow
  const agora = new Date();
  const agoraMin = agora.getHours() * 60 + agora.getMinutes();
  const dataBase = new Date(agora);
  dataBase.setHours(0, 0, 0, 0);
  if (agoraMin >= fimMin) {
    dataBase.setDate(dataBase.getDate() + 1);
  }

  // TSP direction heuristic
  const direcao = resolverDirecaoTSP(osValidas, pontoBase);
  const osOrdenadas = ordenarTSP(osValidas, pontoBase, direcao);

  if (direcao === 'farthest_first') {
    const avisoDir = 'Estratégia: OS mais distantes são as mais antigas — técnico parte para o final da rota e volta atendendo no caminho.';
    console.info(avisoDir);
  }

  // Bin-packing with strict day limits
  const { incluidas, excluidas: excluidasBinPack, avisos } = binPackingTSP(
    osOrdenadas,
    pontoBase,
    inicioMin,
    fimMin,
    almocoMin,
    duracaoAlmoco,
    maxDias,
    dataBase
  );

  const todasExcluidas = [...osExcluidas, ...excluidasBinPack];

  // Retorno base
  const ultimaOS = incluidas[incluidas.length - 1];
  const { distancia_km: distanciaRetorno, tempo_minutos: tempoRetorno } = ultimaOS
    ? calcularDistanciaETempo(ultimaOS.lat!, ultimaOS.lng!, pontoBase.lat, pontoBase.lng)
    : { distancia_km: 0, tempo_minutos: 0 };

  const distanciaTotal = incluidas.reduce((s, o) => s + o.distancia_anterior_km, 0) + distanciaRetorno;
  const tempoTotal = incluidas.reduce((s, o) => s + o.tempo_deslocamento_minutos + 0, 0);
  const diasNecessarios = incluidas.length > 0 ? Math.max(...incluidas.map(o => o.dia)) : 0;

  // Save log
  const { data: otimizacaoLog, error: logError } = await supabase
    .from('otimizacao_logs')
    .insert({
      unidade_id: unidadeId,
      tecnico_id: tecnicoId,
      usuario_otimizador_id: usuarioOtimizadorId,
      rotas_selecionadas: rotasSelecionadas,
      total_os_incluidas: incluidas.length,
      total_os_excluidas: todasExcluidas.length,
      distancia_total_km: parseFloat(distanciaTotal.toFixed(2)),
      tempo_total_minutos: tempoTotal,
      quilometragem_total_km: parseFloat(distanciaTotal.toFixed(2)),
      horario_inicio_previsto: horarioInicio,
      horario_fim_previsto: horarioFim,
      dias_necessarios: diasNecessarios,
      resultado_json: { os_incluidas: incluidas, os_excluidas: todasExcluidas, avisos },
    })
    .select()
    .single();

  if (logError || !otimizacaoLog) {
    throw new Error('Erro ao salvar log de otimização');
  }

  for (const osIncluida of incluidas) {
    await supabase.from('otimizacao_os').insert({
      otimizacao_id: otimizacaoLog.id,
      os_id: osIncluida.os_id,
      incluida: true,
      ordem_visita: osIncluida.ordem_visita,
      horario_chegada_previsto: osIncluida.horario_chegada,
      horario_conclusao_previsto: osIncluida.horario_conclusao,
      distancia_anterior_km: osIncluida.distancia_anterior_km,
      tempo_deslocamento_minutos: osIncluida.tempo_deslocamento_minutos,
    });
  }

  for (const osExcluida of todasExcluidas) {
    await supabase.from('otimizacao_os').insert({
      otimizacao_id: otimizacaoLog.id,
      os_id: osExcluida.os_id,
      incluida: false,
      motivo_exclusao: osExcluida.motivo,
    });
  }

  const polyline = await gerarPolylineGoogleMaps(pontoBase, incluidas);

  return {
    otimizacao_id: otimizacaoLog.id,
    os_incluidas: incluidas,
    os_excluidas: todasExcluidas,
    metricas: {
      distancia_total_km: parseFloat(distanciaTotal.toFixed(2)),
      tempo_total_minutos: tempoTotal,
      quilometragem_total_km: parseFloat(distanciaTotal.toFixed(2)),
      dias_necessarios: diasNecessarios,
      horario_inicio: horarioInicio,
      horario_fim: horarioFim,
      requer_pernoite: diasNecessarios > 1,
      distancia_retorno_km: parseFloat(distanciaRetorno.toFixed(2)),
    },
    avisos,
    pontoBase,
    polyline,
  };
}

export async function recalcularRotaComNovaOrdem(
  osIncluidas: OSIncluida[],
  pontoBase: { lat: number; lng: number; endereco: string },
  tecnico: any
): Promise<{ os_incluidas: OSIncluida[]; metricas: any; avisos: string[]; polyline?: string }> {
  const avisos: string[] = [];

  const horarioInicio: string = tecnico.horario_inicio_expediente ?? tecnico.horario_inicio ?? '08:00';
  const horarioFim: string = tecnico.horario_fim_expediente ?? tecnico.horario_fim ?? '18:00';
  const horarioAlmoco: string = tecnico.horario_almoco_inicio ?? '12:00';
  const duracaoAlmoco: number = tecnico.duracao_almoco_minutos ?? 60;
  const maxDias: number = tecnico.dias_permitidos_fora ?? 5;

  const inicioMin = timeToMin(horarioInicio);
  const fimMin = timeToMin(horarioFim);
  const almocoMin = timeToMin(horarioAlmoco);
  const limiteMinDia = fimMin - inicioMin - duracaoAlmoco;

  const agora = new Date();
  const agoraMin = agora.getHours() * 60 + agora.getMinutes();
  const dataBase = new Date(agora);
  dataBase.setHours(0, 0, 0, 0);
  if (agoraMin >= fimMin) dataBase.setDate(dataBase.getDate() + 1);

  let dia = 1;
  let tempoAcumuladoDia = 0;
  let currentMin = inicioMin;
  let almocoFeitoDia = false;
  let posAtual = { lat: pontoBase.lat, lng: pontoBase.lng };
  let distanciaTotal = 0;
  let tempoTotal = 0;

  const osRecalculadas: OSIncluida[] = [];

  for (let i = 0; i < osIncluidas.length; i++) {
    const os = osIncluidas[i];
    const coords = os.coordenadas || { lat: os.lat!, lng: os.lng! };

    const { distancia_km, tempo_minutos: travelMin } = calcularDistanciaETempo(
      posAtual.lat, posAtual.lng, coords.lat, coords.lng
    );

    const tempoReparo = 60;
    let chegadaMin = currentMin + travelMin;
    const custoTotal = travelMin + tempoReparo;

    if (!almocoFeitoDia && currentMin < almocoMin && chegadaMin >= almocoMin) {
      chegadaMin += duracaoAlmoco;
      almocoFeitoDia = true;
    } else if (!almocoFeitoDia && currentMin >= almocoMin) {
      almocoFeitoDia = true;
    }

    const saidaMin = chegadaMin + tempoReparo;

    if (saidaMin > fimMin || tempoAcumuladoDia + custoTotal > limiteMinDia) {
      if (dia < maxDias) {
        dia++;
        currentMin = inicioMin;
        tempoAcumuladoDia = 0;
        almocoFeitoDia = false;
        posAtual = { lat: pontoBase.lat, lng: pontoBase.lng };

        const { distancia_km: d2, tempo_minutos: t2 } = calcularDistanciaETempo(
          posAtual.lat, posAtual.lng, coords.lat, coords.lng
        );
        let c2 = inicioMin + t2;
        const s2 = c2 + tempoReparo;

        osRecalculadas.push({
          ...os,
          ordem_visita: i + 1,
          dia,
          horario_chegada: minToISO(dataBase, c2, dia - 1),
          horario_conclusao: minToISO(dataBase, s2, dia - 1),
          distancia_anterior_km: parseFloat(d2.toFixed(2)),
          tempo_deslocamento_minutos: t2,
        });

        tempoAcumuladoDia += t2 + tempoReparo;
        distanciaTotal += d2;
        tempoTotal += t2 + tempoReparo;
        posAtual = { lat: coords.lat, lng: coords.lng };
        currentMin = s2;
        continue;
      }
    }

    osRecalculadas.push({
      ...os,
      ordem_visita: i + 1,
      dia,
      horario_chegada: minToISO(dataBase, chegadaMin, dia - 1),
      horario_conclusao: minToISO(dataBase, saidaMin, dia - 1),
      distancia_anterior_km: parseFloat(distancia_km.toFixed(2)),
      tempo_deslocamento_minutos: travelMin,
    });

    tempoAcumuladoDia += custoTotal;
    distanciaTotal += distancia_km;
    tempoTotal += custoTotal;
    posAtual = { lat: coords.lat, lng: coords.lng };
    currentMin = saidaMin;
  }

  const { distancia_km: distanciaRetorno, tempo_minutos: tempoRetorno } = calcularDistanciaETempo(
    posAtual.lat, posAtual.lng, pontoBase.lat, pontoBase.lng
  );
  distanciaTotal += distanciaRetorno;

  const diasNecessarios = osRecalculadas.length > 0 ? Math.max(...osRecalculadas.map(o => o.dia)) : 0;
  if (diasNecessarios > 1) {
    avisos.push(`Esta rota requer ${diasNecessarios} dias de trabalho.`);
  }

  const horarioFimPrevisto = minToTimeStr(
    (osRecalculadas[osRecalculadas.length - 1]
      ? timeToMin(
          new Date(osRecalculadas[osRecalculadas.length - 1].horario_conclusao)
            .toTimeString()
            .slice(0, 5)
        ) + tempoRetorno
      : timeToMin(horarioFim))
  );

  const polyline = await gerarPolylineGoogleMaps(pontoBase, osRecalculadas);

  return {
    os_incluidas: osRecalculadas,
    metricas: {
      distancia_total_km: parseFloat(distanciaTotal.toFixed(2)),
      tempo_total_minutos: tempoTotal,
      quilometragem_total_km: parseFloat(distanciaTotal.toFixed(2)),
      dias_necessarios: diasNecessarios,
      horario_inicio: horarioInicio,
      horario_fim: horarioFimPrevisto,
      requer_pernoite: diasNecessarios > 1,
      distancia_retorno_km: parseFloat(distanciaRetorno.toFixed(2)),
    },
    avisos,
    polyline,
  };
}

export async function aplicarOtimizacao(otimizacaoId: string): Promise<boolean> {
  try {
    const { data: osIncluidas } = await supabase
      .from('otimizacao_os')
      .select('*')
      .eq('otimizacao_id', otimizacaoId)
      .eq('incluida', true)
      .order('ordem_visita');

    if (!osIncluidas) return false;

    for (const osIncluida of osIncluidas) {
      await supabase
        .from('os')
        .update({ ordem_rota: osIncluida.ordem_visita, updated_at: new Date().toISOString() })
        .eq('id', osIncluida.os_id);
    }

    await supabase
      .from('otimizacao_logs')
      .update({ aplicada: true, data_hora_aplicacao: new Date().toISOString() })
      .eq('id', otimizacaoId);

    return true;
  } catch {
    return false;
  }
}
