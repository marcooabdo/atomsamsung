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

async function calcularDistanciaETempo(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): Promise<{ distancia_km: number; tempo_minutos: number }> {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const distanciaLinhaReta = R * c;

  const fatorCorrecaoEstradas = 1.4;
  const distancia_km = distanciaLinhaReta * fatorCorrecaoEstradas;

  const velocidade_media = 35;
  const tempo_minutos = Math.ceil((distancia_km / velocidade_media) * 60);

  return { distancia_km, tempo_minutos };
}

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
    endereco: unidade.endereco || 'Unidade'
  };

  const { data: tecnico } = await supabase
    .from('usuarios')
    .select(`
      *,
      tecnicos_linhas_produto(linha_produto_id)
    `)
    .eq('id', tecnicoId)
    .single();

  if (!tecnico) {
    throw new Error('Técnico não encontrado');
  }

  const linhasDoTecnico = tecnico.tecnicos_linhas_produto?.map((t: any) => t.linha_produto_id) || [];

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
      prioridade,
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

    let osLat = os.lat;
    let osLng = os.lng;

    if (!osLat || !osLng) {
      osLat = agendamento?.lat;
      osLng = agendamento?.lng;
    }

    if (!osLat || !osLng) {
      osExcluidas.push({
        os_id: os.id,
        numero_os: os.numero_os_samsung || os.numero_os_interna,
        motivo: 'OS sem coordenadas de localização'
      });
      continue;
    }

    if (os.linha_produto_id && !linhasDoTecnico.includes(os.linha_produto_id)) {
      const { data: tecnicosCompativeis } = await supabase.rpc('buscar_tecnicos_compativeis', {
        p_os_id: os.id,
        p_unidade_id: unidadeId
      });

      osExcluidas.push({
        os_id: os.id,
        numero_os: os.numero_os_samsung || os.numero_os_interna,
        motivo: `O técnico não atende a linha de produto: ${os.linhas_produto?.nome || 'N/A'}`,
        tecnicos_sugeridos: tecnicosCompativeis?.map((t: any) => t.tecnico_nome) || []
      });
      continue;
    }

    osValidas.push({
      id: os.id,
      numero_os: os.numero_os_samsung || os.numero_os_interna,
      tipo_os: os.tipo_os,
      linha_produto_id: os.linha_produto_id,
      linha_produto_nome: os.linhas_produto?.nome || null,
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
      prioridade: os.prioridade || 'media',
      tipo_atendimento: os.tipo_atendimento || 'IH'
    });
  }

  osValidas.sort((a, b) => {
    if (a.tipo_os === 'LP' && b.tipo_os !== 'LP') return -1;
    if (a.tipo_os !== 'LP' && b.tipo_os === 'LP') return 1;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  const rotaOtimizada = await algoritmoNearestNeighbor(
    pontoBase,
    osValidas,
    tecnico
  );

  const { data: otimizacaoLog, error: logError } = await supabase
    .from('otimizacao_logs')
    .insert({
      unidade_id: unidadeId,
      tecnico_id: tecnicoId,
      usuario_otimizador_id: usuarioOtimizadorId,
      rotas_selecionadas: rotasSelecionadas,
      total_os_incluidas: rotaOtimizada.os_incluidas.length,
      total_os_excluidas: osExcluidas.length,
      distancia_total_km: rotaOtimizada.metricas.distancia_total_km,
      tempo_total_minutos: rotaOtimizada.metricas.tempo_total_minutos,
      quilometragem_total_km: rotaOtimizada.metricas.quilometragem_total_km,
      horario_inicio_previsto: rotaOtimizada.metricas.horario_inicio,
      horario_fim_previsto: rotaOtimizada.metricas.horario_fim,
      dias_necessarios: rotaOtimizada.metricas.dias_necessarios,
      resultado_json: { ...rotaOtimizada, os_excluidas: osExcluidas }
    })
    .select()
    .single();

  if (logError || !otimizacaoLog) {
    throw new Error('Erro ao salvar log de otimização');
  }

  for (const osIncluida of rotaOtimizada.os_incluidas) {
    await supabase.from('otimizacao_os').insert({
      otimizacao_id: otimizacaoLog.id,
      os_id: osIncluida.os_id,
      incluida: true,
      ordem_visita: osIncluida.ordem_visita,
      horario_chegada_previsto: osIncluida.horario_chegada,
      horario_conclusao_previsto: osIncluida.horario_conclusao,
      distancia_anterior_km: osIncluida.distancia_anterior_km,
      tempo_deslocamento_minutos: osIncluida.tempo_deslocamento_minutos
    });
  }

  for (const osExcluida of osExcluidas) {
    await supabase.from('otimizacao_os').insert({
      otimizacao_id: otimizacaoLog.id,
      os_id: osExcluida.os_id,
      incluida: false,
      motivo_exclusao: osExcluida.motivo
    });
  }

  const polyline = await gerarPolylineGoogleMaps(pontoBase, rotaOtimizada.os_incluidas);

  return {
    otimizacao_id: otimizacaoLog.id,
    os_incluidas: rotaOtimizada.os_incluidas,
    os_excluidas: osExcluidas,
    metricas: rotaOtimizada.metricas,
    avisos: rotaOtimizada.avisos,
    pontoBase,
    polyline
  };
}

async function algoritmoNearestNeighbor(
  pontoBase: { lat: number; lng: number; endereco: string },
  osLista: OSParaOtimizar[],
  tecnico: any
): Promise<Omit<ResultadoOtimizacao, 'otimizacao_id' | 'os_excluidas'>> {
  const osIncluidas: OSIncluida[] = [];
  const osRestantes = [...osLista];
  const avisos: string[] = [];

  const minutosDisponiveis =
    (parseInt(tecnico.horario_fim.split(':')[0]) * 60 + parseInt(tecnico.horario_fim.split(':')[1])) -
    (parseInt(tecnico.horario_inicio.split(':')[0]) * 60 + parseInt(tecnico.horario_inicio.split(':')[1])) -
    (tecnico.tempo_almoco_minutos || 60);

  let posicaoAtual = pontoBase;
  let tempoAcumulado = 0;
  let distanciaTotal = 0;
  let ordem = 1;

  const horarioInicio = new Date();
  horarioInicio.setHours(parseInt(tecnico.horario_inicio.split(':')[0]));
  horarioInicio.setMinutes(parseInt(tecnico.horario_inicio.split(':')[1]));

  let horarioAtual = new Date(horarioInicio);

  while (osRestantes.length > 0) {
    let maisProxima: OSParaOtimizar | null = null;
    let menorDistancia = Infinity;
    let indiceMaisProxima = -1;

    for (let i = 0; i < osRestantes.length; i++) {
      const os = osRestantes[i];
      const { distancia_km } = await calcularDistanciaETempo(
        posicaoAtual.lat,
        posicaoAtual.lng,
        os.lat,
        os.lng
      );

      if (distancia_km < menorDistancia) {
        menorDistancia = distancia_km;
        maisProxima = os;
        indiceMaisProxima = i;
      }
    }

    if (!maisProxima) break;

    const { distancia_km, tempo_minutos } = await calcularDistanciaETempo(
      posicaoAtual.lat,
      posicaoAtual.lng,
      maisProxima.lat,
      maisProxima.lng
    );

    const tempoTotal = tempo_minutos + maisProxima.tempo_medio_reparo;

    horarioAtual = new Date(horarioAtual.getTime() + tempo_minutos * 60000);
    const horarioChegada = new Date(horarioAtual);
    horarioAtual = new Date(horarioAtual.getTime() + maisProxima.tempo_medio_reparo * 60000);
    const horarioConclusao = new Date(horarioAtual);

    osIncluidas.push({
      os_id: maisProxima.id,
      numero_os: maisProxima.numero_os,
      ordem_visita: ordem++,
      horario_chegada: horarioChegada.toISOString(),
      horario_conclusao: horarioConclusao.toISOString(),
      distancia_anterior_km: distancia_km,
      tempo_deslocamento_minutos: tempo_minutos,
      lat: maisProxima.lat,
      lng: maisProxima.lng,
      endereco: maisProxima.endereco,
      coordenadas: { lat: maisProxima.lat, lng: maisProxima.lng },
      cliente_nome: maisProxima.cliente_nome,
      cliente_logradouro: maisProxima.cliente_logradouro,
      cliente_numero: maisProxima.cliente_numero,
      cliente_bairro: maisProxima.cliente_bairro,
      cliente_cidade: maisProxima.cliente_cidade,
      cliente_cep: maisProxima.cliente_cep,
      prioridade: maisProxima.prioridade,
      tipo_atendimento: maisProxima.tipo_atendimento,
      tipo_os: maisProxima.tipo_os,
      linha_produto_nome: maisProxima.linha_produto_nome
    });

    tempoAcumulado += tempoTotal;
    distanciaTotal += distancia_km;
    posicaoAtual = { lat: maisProxima.lat, lng: maisProxima.lng, endereco: maisProxima.endereco };
    osRestantes.splice(indiceMaisProxima, 1);
  }

  const { distancia_km: distanciaRetorno, tempo_minutos: tempoRetorno } = await calcularDistanciaETempo(
    posicaoAtual.lat,
    posicaoAtual.lng,
    pontoBase.lat,
    pontoBase.lng
  );

  distanciaTotal += distanciaRetorno;

  const diasNecessarios = Math.ceil(tempoAcumulado / minutosDisponiveis);
  const requerPernoite = diasNecessarios > 1;

  if (requerPernoite) {
    avisos.push(`⚠️ Esta rota requer ${diasNecessarios} dias de trabalho. O técnico precisará pernoitar.`);
  }

  if (diasNecessarios > 1 && diasNecessarios <= 3) {
    avisos.push(`✓ Rota viável em ${diasNecessarios} dias com pernoite.`);
  } else if (diasNecessarios > 3) {
    avisos.push(`⚠️ Atenção: Rota longa de ${diasNecessarios} dias. Considere dividir em múltiplas rotas.`);
  }

  const horarioFim = new Date(horarioInicio.getTime() + tempoAcumulado * 60000);
  const horarioRetornoBase = new Date(horarioFim.getTime() + tempoRetorno * 60000);

  return {
    os_incluidas: osIncluidas,
    metricas: {
      distancia_total_km: parseFloat(distanciaTotal.toFixed(2)),
      tempo_total_minutos: tempoAcumulado,
      quilometragem_total_km: parseFloat(distanciaTotal.toFixed(2)),
      dias_necessarios: diasNecessarios,
      horario_inicio: horarioInicio.toTimeString().slice(0, 5),
      horario_fim: horarioRetornoBase.toTimeString().slice(0, 5),
      requer_pernoite: requerPernoite,
      distancia_retorno_km: parseFloat(distanciaRetorno.toFixed(2))
    },
    avisos
  };
}

export async function recalcularRotaComNovaOrdem(
  osIncluidas: OSIncluida[],
  pontoBase: { lat: number; lng: number; endereco: string },
  tecnico: any
): Promise<{ os_incluidas: OSIncluida[]; metricas: any; avisos: string[]; polyline?: string }> {
  const avisos: string[] = [];

  const minutosDisponiveis =
    (parseInt(tecnico.horario_fim.split(':')[0]) * 60 + parseInt(tecnico.horario_fim.split(':')[1])) -
    (parseInt(tecnico.horario_inicio.split(':')[0]) * 60 + parseInt(tecnico.horario_inicio.split(':')[1])) -
    (tecnico.tempo_almoco_minutos || 60);

  const horarioInicio = new Date();
  horarioInicio.setHours(parseInt(tecnico.horario_inicio.split(':')[0]));
  horarioInicio.setMinutes(parseInt(tecnico.horario_inicio.split(':')[1]));

  let horarioAtual = new Date(horarioInicio);
  let posicaoAtual = pontoBase;
  let distanciaTotal = 0;
  let tempoAcumulado = 0;

  const osRecalculadas: OSIncluida[] = [];

  for (let i = 0; i < osIncluidas.length; i++) {
    const os = osIncluidas[i];
    const coords = os.coordenadas || { lat: os.lat!, lng: os.lng! };

    const { distancia_km, tempo_minutos } = await calcularDistanciaETempo(
      posicaoAtual.lat,
      posicaoAtual.lng,
      coords.lat,
      coords.lng
    );

    horarioAtual = new Date(horarioAtual.getTime() + tempo_minutos * 60000);
    const horarioChegada = new Date(horarioAtual);

    const tempoReparo = 60;
    horarioAtual = new Date(horarioAtual.getTime() + tempoReparo * 60000);
    const horarioConclusao = new Date(horarioAtual);

    osRecalculadas.push({
      ...os,
      ordem_visita: i + 1,
      horario_chegada: horarioChegada.toISOString(),
      horario_conclusao: horarioConclusao.toISOString(),
      distancia_anterior_km: distancia_km,
      tempo_deslocamento_minutos: tempo_minutos
    });

    tempoAcumulado += tempo_minutos + tempoReparo;
    distanciaTotal += distancia_km;
    posicaoAtual = { lat: coords.lat, lng: coords.lng, endereco: os.endereco || '' };
  }

  const { distancia_km: distanciaRetorno, tempo_minutos: tempoRetorno } = await calcularDistanciaETempo(
    posicaoAtual.lat,
    posicaoAtual.lng,
    pontoBase.lat,
    pontoBase.lng
  );

  distanciaTotal += distanciaRetorno;

  const diasNecessarios = Math.ceil(tempoAcumulado / minutosDisponiveis);
  const requerPernoite = diasNecessarios > 1;

  if (requerPernoite) {
    avisos.push(`⚠️ Esta rota requer ${diasNecessarios} dias de trabalho. O técnico precisará pernoitar.`);
  }

  const horarioFim = new Date(horarioInicio.getTime() + tempoAcumulado * 60000);
  const horarioRetornoBase = new Date(horarioFim.getTime() + tempoRetorno * 60000);

  const polyline = await gerarPolylineGoogleMaps(pontoBase, osRecalculadas);

  return {
    os_incluidas: osRecalculadas,
    metricas: {
      distancia_total_km: parseFloat(distanciaTotal.toFixed(2)),
      tempo_total_minutos: tempoAcumulado,
      quilometragem_total_km: parseFloat(distanciaTotal.toFixed(2)),
      dias_necessarios: diasNecessarios,
      horario_inicio: horarioInicio.toTimeString().slice(0, 5),
      horario_fim: horarioRetornoBase.toTimeString().slice(0, 5),
      requer_pernoite: requerPernoite,
      distancia_retorno_km: parseFloat(distanciaRetorno.toFixed(2))
    },
    avisos,
    polyline
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
        .update({
          ordem_rota: osIncluida.ordem_visita,
          updated_at: new Date().toISOString()
        })
        .eq('id', osIncluida.os_id);
    }

    await supabase
      .from('otimizacao_logs')
      .update({
        aplicada: true,
        data_hora_aplicacao: new Date().toISOString()
      })
      .eq('id', otimizacaoId);

    return true;
  } catch (error) {
    return false;
  }
}
