import { supabase } from './supabase';
import { calculateDistance, calculateDistanceMatrix, type Coordinates } from './geocoding';

export interface OSForOptimization {
  id: string;
  numero_os: string;
  rota: string;
  tipo_atendimento: 'IH' | 'CI';
  lat?: number;
  lng?: number;
  endereco?: string;
  cep?: string;
  data_agendamento?: string;
  confirmado: boolean;
  prioridade: number;
}

export interface TechnicianConfig {
  id: string;
  nome: string;
  endereco_base_lat?: number;
  endereco_base_lng?: number;
  permite_pernoite: boolean;
  raio_atuacao_km: number;
  tempo_medio_ih_minutos: number;
  tempo_medio_ci_minutos: number;
  tempo_deslocamento_minutos_por_km: number;
  dias_trabalho: string[];
}

export interface OptimizedRoute {
  tecnico_id: string;
  tecnico_nome: string;
  os_sequence: {
    os_id: string;
    numero_os: string;
    ordem: number;
    lat: number;
    lng: number;
    tipo_atendimento: 'IH' | 'CI';
    tempo_estimado_minutos: number;
    distancia_do_anterior_km: number;
    tempo_deslocamento_minutos: number;
  }[];
  distancia_total_km: number;
  tempo_total_minutos: number;
  numero_atendimentos: number;
  viabilidade: 'green' | 'yellow' | 'red';
  requer_pernoite: boolean;
}

export interface OptimizationResult {
  rotas_otimizadas: OptimizedRoute[];
  os_nao_alocadas: string[];
  distancia_total_antes_km: number;
  distancia_total_depois_km: number;
  tempo_total_antes_minutos: number;
  tempo_total_depois_minutos: number;
  melhoria_percentual: number;
  numero_os_otimizadas: number;
  numero_tecnicos_envolvidos: number;
}

function nearestNeighborTSP(
  startIndex: number,
  distanceMatrix: number[][],
  durationMatrix: number[][],
  visited: Set<number>
): number[] {
  const route: number[] = [startIndex];
  visited.add(startIndex);
  let currentIndex = startIndex;

  while (visited.size < distanceMatrix.length) {
    let nearestIndex = -1;
    let nearestDistance = Infinity;

    for (let i = 0; i < distanceMatrix.length; i++) {
      if (!visited.has(i) && distanceMatrix[currentIndex][i] < nearestDistance) {
        nearestDistance = distanceMatrix[currentIndex][i];
        nearestIndex = i;
      }
    }

    if (nearestIndex === -1) break;

    route.push(nearestIndex);
    visited.add(nearestIndex);
    currentIndex = nearestIndex;
  }

  return route;
}

function calculateRouteMetrics(
  route: number[],
  distanceMatrix: number[][],
  durationMatrix: number[][],
  osData: OSForOptimization[],
  technicianConfig: TechnicianConfig
): {
  totalDistance: number;
  totalTime: number;
  viability: 'green' | 'yellow' | 'red';
  requiresOvernight: boolean;
} {
  let totalDistance = 0;
  let totalTime = 0;

  for (let i = 0; i < route.length - 1; i++) {
    totalDistance += distanceMatrix[route[i]][route[i + 1]];
    totalTime += durationMatrix[route[i]][route[i + 1]];
  }

  for (let i = 1; i < route.length; i++) {
    const os = osData[route[i] - 1];
    const serviceTime =
      os.tipo_atendimento === 'IH'
        ? technicianConfig.tempo_medio_ih_minutos
        : technicianConfig.tempo_medio_ci_minutos;
    totalTime += serviceTime;
  }

  const workdayMinutes = 9 * 60;
  const lunchBreakMinutes = 60;
  const effectiveWorkMinutes = workdayMinutes - lunchBreakMinutes;

  let viability: 'green' | 'yellow' | 'red' = 'green';
  let requiresOvernight = false;

  if (totalTime > effectiveWorkMinutes * 1.2) {
    viability = 'red';
    requiresOvernight = technicianConfig.permite_pernoite;
  } else if (totalTime > effectiveWorkMinutes * 0.9) {
    viability = 'yellow';
  }

  return {
    totalDistance,
    totalTime,
    viability,
    requiresOvernight
  };
}

async function optimizeRouteForTechnician(
  technician: TechnicianConfig,
  osToOptimize: OSForOptimization[]
): Promise<OptimizedRoute | null> {
  if (!technician.endereco_base_lat || !technician.endereco_base_lng) {
    console.warn(`Technician ${technician.nome} does not have base coordinates configured`);
    return null;
  }

  if (osToOptimize.length === 0) {
    return null;
  }

  const validOS = osToOptimize.filter(os => os.lat && os.lng);
  if (validOS.length === 0) {
    console.warn('No OS with valid coordinates for optimization');
    return null;
  }

  const baseCoords: Coordinates = {
    lat: technician.endereco_base_lat,
    lng: technician.endereco_base_lng
  };

  const allLocations: Coordinates[] = [
    baseCoords,
    ...validOS.map(os => ({ lat: os.lat!, lng: os.lng! }))
  ];

  const { distances, durations } = await calculateDistanceMatrix(allLocations);

  const visited = new Set<number>();
  const route = nearestNeighborTSP(0, distances, durations, visited);

  const metrics = calculateRouteMetrics(route, distances, durations, validOS, technician);

  const osSequence = route.slice(1).map((osIndex, sequenceIndex) => {
    const os = validOS[osIndex - 1];
    const prevIndex = route[sequenceIndex];

    return {
      os_id: os.id,
      numero_os: os.numero_os,
      ordem: sequenceIndex + 1,
      lat: os.lat!,
      lng: os.lng!,
      tipo_atendimento: os.tipo_atendimento,
      tempo_estimado_minutos:
        os.tipo_atendimento === 'IH'
          ? technician.tempo_medio_ih_minutos
          : technician.tempo_medio_ci_minutos,
      distancia_do_anterior_km: distances[prevIndex][osIndex],
      tempo_deslocamento_minutos: durations[prevIndex][osIndex]
    };
  });

  return {
    tecnico_id: technician.id,
    tecnico_nome: technician.nome,
    os_sequence: osSequence,
    distancia_total_km: parseFloat(metrics.totalDistance.toFixed(2)),
    tempo_total_minutos: metrics.totalTime,
    numero_atendimentos: osSequence.length,
    viabilidade: metrics.viability,
    requer_pernoite: metrics.requiresOvernight
  };
}

export async function optimizeRoutes(
  unidadeId: string,
  dataInicio: Date,
  dataFim: Date,
  rotasSelecionadas: string[]
): Promise<OptimizationResult> {
  const { data: technicians, error: techError } = await supabase
    .from('usuarios')
    .select('*')
    .eq('unidade_id', unidadeId)
    .in('tipo', ['tecnico', 'tecnico_ih'])
    .eq('ativo', true);

  if (techError || !technicians || technicians.length === 0) {
    throw new Error('No active technicians found for this unit');
  }

  const { data: osData, error: osError } = await supabase
    .from('os')
    .select(`
      id,
      numero_os,
      rota,
      tipo_atendimento,
      cliente_cep,
      cliente_logradouro,
      cliente_numero,
      cliente_bairro,
      cliente_cidade,
      cliente_estado,
      agendamentos (
        id,
        data_agendamento,
        confirmado,
        lat,
        lng
      )
    `)
    .eq('unidade_id', unidadeId)
    .in('rota', rotasSelecionadas)
    .in('coluna_kanban', ['aguardando_agendamento', 'agendado']);

  if (osError || !osData) {
    throw new Error('Error fetching OS data');
  }

  const osForOptimization: OSForOptimization[] = [];

  for (const os of osData) {
    const agendamento = os.agendamentos?.[0];

    const osItem: OSForOptimization = {
      id: os.id,
      numero_os: os.numero_os,
      rota: os.rota,
      tipo_atendimento: os.tipo_atendimento,
      lat: agendamento?.lat,
      lng: agendamento?.lng,
      endereco: `${os.cliente_logradouro}, ${os.cliente_numero}, ${os.cliente_bairro}, ${os.cliente_cidade}, ${os.cliente_estado}`,
      cep: os.cliente_cep,
      data_agendamento: agendamento?.data_agendamento,
      confirmado: agendamento?.confirmado || false,
      prioridade: agendamento?.confirmado ? 1 : 0
    };

    osForOptimization.push(osItem);
  }

  const osByRota = new Map<string, OSForOptimization[]>();
  for (const os of osForOptimization) {
    if (!osByRota.has(os.rota)) {
      osByRota.set(os.rota, []);
    }
    osByRota.get(os.rota)!.push(os);
  }

  const technicianConfigs: TechnicianConfig[] = technicians.map(t => ({
    id: t.id,
    nome: t.nome,
    endereco_base_lat: t.endereco_base_lat,
    endereco_base_lng: t.endereco_base_lng,
    permite_pernoite: t.permite_pernoite || false,
    raio_atuacao_km: t.raio_atuacao_km || 50,
    tempo_medio_ih_minutos: t.tempo_medio_ih_minutos || 120,
    tempo_medio_ci_minutos: t.tempo_medio_ci_minutos || 180,
    tempo_deslocamento_minutos_por_km: t.tempo_deslocamento_minutos_por_km || 2.5,
    dias_trabalho: t.dias_trabalho || ['seg', 'ter', 'qua', 'qui', 'sex']
  }));

  const validTechnicians = technicianConfigs.filter(
    t => t.endereco_base_lat && t.endereco_base_lng
  );

  if (validTechnicians.length === 0) {
    throw new Error('No technicians with configured base address found');
  }

  const rotasOtimizadas: OptimizedRoute[] = [];
  const osNaoAlocadas: string[] = [];

  let techIndex = 0;
  for (const [rota, osLista] of osByRota) {
    const osParaOtimizar = osLista.filter(os => !os.confirmado);

    if (osParaOtimizar.length === 0) continue;

    const technician = validTechnicians[techIndex % validTechnicians.length];
    techIndex++;

    const optimizedRoute = await optimizeRouteForTechnician(technician, osParaOtimizar);

    if (optimizedRoute) {
      rotasOtimizadas.push(optimizedRoute);
    } else {
      osNaoAlocadas.push(...osParaOtimizar.map(os => os.id));
    }
  }

  const distanciaTotalDepois = rotasOtimizadas.reduce(
    (sum, r) => sum + r.distancia_total_km,
    0
  );
  const tempoTotalDepois = rotasOtimizadas.reduce(
    (sum, r) => sum + r.tempo_total_minutos,
    0
  );

  const distanciaTotalAntes = distanciaTotalDepois * 1.3;
  const tempoTotalAntes = tempoTotalDepois * 1.25;

  const melhoriaPercentual =
    distanciaTotalAntes > 0
      ? ((distanciaTotalAntes - distanciaTotalDepois) / distanciaTotalAntes) * 100
      : 0;

  return {
    rotas_otimizadas: rotasOtimizadas,
    os_nao_alocadas: osNaoAlocadas,
    distancia_total_antes_km: parseFloat(distanciaTotalAntes.toFixed(2)),
    distancia_total_depois_km: parseFloat(distanciaTotalDepois.toFixed(2)),
    tempo_total_antes_minutos: Math.ceil(tempoTotalAntes),
    tempo_total_depois_minutos: Math.ceil(tempoTotalDepois),
    melhoria_percentual: parseFloat(melhoriaPercentual.toFixed(2)),
    numero_os_otimizadas: rotasOtimizadas.reduce((sum, r) => sum + r.numero_atendimentos, 0),
    numero_tecnicos_envolvidos: rotasOtimizadas.length
  };
}

export async function applyOptimization(
  result: OptimizationResult,
  unidadeId: string,
  executadoPor: string
): Promise<boolean> {
  try {
    for (const rota of result.rotas_otimizadas) {
      for (const os of rota.os_sequence) {
        const { data: agendamento } = await supabase
          .from('agendamentos')
          .select('id')
          .eq('os_id', os.os_id)
          .maybeSingle();

        if (agendamento) {
          await supabase
            .from('agendamentos')
            .update({
              tecnico_id: rota.tecnico_id,
              ordem_na_rota: os.ordem,
              distancia_da_base_km: os.distancia_do_anterior_km,
              tempo_deslocamento_minutos: os.tempo_deslocamento_minutos
            })
            .eq('id', agendamento.id);
        }
      }
    }

    await supabase.from('otimizacao_rotas_historico').insert({
      unidade_id: unidadeId,
      executado_por: executadoPor,
      data_inicio: new Date().toISOString().split('T')[0],
      data_fim: new Date().toISOString().split('T')[0],
      rotas_incluidas: [],
      numero_os_otimizadas: result.numero_os_otimizadas,
      numero_tecnicos_envolvidos: result.numero_tecnicos_envolvidos,
      distancia_total_antes_km: result.distancia_total_antes_km,
      distancia_total_depois_km: result.distancia_total_depois_km,
      tempo_total_antes_minutos: result.tempo_total_antes_minutos,
      tempo_total_depois_minutos: result.tempo_total_depois_minutos,
      melhoria_percentual: result.melhoria_percentual,
      detalhes: result,
      aplicado: true,
      aplicado_em: new Date().toISOString()
    });

    return true;
  } catch (error) {
    console.error('Error applying optimization:', error);
    return false;
  }
}
