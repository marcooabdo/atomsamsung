import { supabase } from './supabase';

export interface GIARotaCommand {
  unidade_nome: string;
  tecnico_nome: string;
  rota_nome: string;
}

export interface GIARotaValidationError {
  type: 'missing_tipo_reparo' | 'missing_tempo_cadastrado' | 'rota_not_found' | 'tecnico_not_found' | 'unidade_not_found' | 'no_os_found';
  message: string;
  os_list?: { numero_samsung?: string; numero_interno: string; cliente_nome: string; cidade?: string; tipo_reparo?: string }[];
}

export interface GIARotaConflict {
  os_id: string;
  numero_samsung?: string;
  numero_interno: string;
  data_agendamento: string;
  rota_nome?: string;
}

export interface GIAParadaPlanejada {
  os_id: string;
  numero_samsung: string | null;
  numero_interno: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  cidade: string | null;
  endereco: string | null;
  tipo_reparo: string;
  tempo_estimado_min: number;
  lat: number | null;
  lng: number | null;
  pecas: { id: string; pn: string; delivery: string | null }[];
  dia: number;
  ordem: number;
}

export interface GIARotaPlan {
  unidade_id: string;
  rota_id: string;
  tecnico_id: string;
  nome_rota: string;
  nome_tecnico: string;
  data_inicio: string;
  paradas: GIAParadaPlanejada[];
  total_os: number;
  total_tempo_min: number;
  conflitos?: GIARotaConflict[];
}

function formatOSRef(os: { numero_os_samsung?: string | null; numero_interno?: string; cliente_nome?: string; cidade?: string | null }) {
  const samsung = os.numero_os_samsung ? `${os.numero_os_samsung} | ` : '';
  const interno = os.numero_interno || '?';
  const cliente = os.cliente_nome || '';
  const cidade = os.cidade ? ` (${os.cidade})` : '';
  return `${samsung}${interno} - ${cliente}${cidade}`;
}

export async function resolveGIACommand(command: GIARotaCommand): Promise<{
  unidade_id: string;
  tecnico_id: string;
  rota_id: string;
  rota_coluna_kanban: string;
} | GIARotaValidationError> {
  const { data: unidades } = await supabase
    .from('unidades')
    .select('id, nome')
    .ilike('nome', `%${command.unidade_nome}%`);

  if (!unidades || unidades.length === 0) {
    return { type: 'unidade_not_found', message: `Unidade "${command.unidade_nome}" não encontrada.` };
  }
  const unidade = unidades[0];

  const { data: tecnicos } = await supabase
    .from('usuarios')
    .select('id, nome')
    .eq('unidade_id', unidade.id)
    .eq('ativo', true)
    .ilike('nome', `%${command.tecnico_nome}%`);

  if (!tecnicos || tecnicos.length === 0) {
    return { type: 'tecnico_not_found', message: `Técnico "${command.tecnico_nome}" não encontrado na unidade ${unidade.nome}.` };
  }
  const tecnico = tecnicos[0];

  const { data: rotas } = await supabase
    .from('rotas')
    .select('id, nome, coluna_kanban, cor')
    .eq('unidade_id', unidade.id)
    .eq('ativa', true)
    .ilike('nome', `%${command.rota_nome}%`);

  if (!rotas || rotas.length === 0) {
    return { type: 'rota_not_found', message: `Rota "${command.rota_nome}" não encontrada na unidade ${unidade.nome}.` };
  }
  const rota = rotas[0];

  if (!rota.coluna_kanban) {
    return { type: 'rota_not_found', message: `Rota "${rota.nome}" não tem coluna kanban associada.` };
  }

  return {
    unidade_id: unidade.id,
    tecnico_id: tecnico.id,
    rota_id: rota.id,
    rota_coluna_kanban: rota.coluna_kanban,
  };
}

export async function validateAndPlanRoute(
  unidade_id: string,
  tecnico_id: string,
  rota_id: string,
  rota_coluna_kanban: string,
  data_inicio: string
): Promise<{ plan: GIARotaPlan } | { errors: GIARotaValidationError[] }> {
  const { data: unidade } = await supabase
    .from('unidades')
    .select('id, nome')
    .eq('id', unidade_id)
    .maybeSingle();

  const { data: tecnico } = await supabase
    .from('usuarios')
    .select('id, nome')
    .eq('id', tecnico_id)
    .maybeSingle();

  const { data: rota } = await supabase
    .from('rotas')
    .select('id, nome, cor')
    .eq('id', rota_id)
    .maybeSingle();

  if (!unidade || !tecnico || !rota) {
    return { errors: [{ type: 'unidade_not_found', message: 'Dados inválidos: unidade, técnico ou rota não encontrados.' }] };
  }

  const { data: osList, error: osError } = await supabase
    .from('os')
    .select('id, numero_os_interna, numero_os_samsung, cliente_nome, cliente_telefone, cidade, endereco_completo, tipo_reparo, lat, lng')
    .eq('unidade_id', unidade_id)
    .eq('coluna_kanban', rota_coluna_kanban);

  if (osError || !osList || osList.length === 0) {
    return { errors: [{ type: 'no_os_found', message: `Nenhuma OS encontrada na coluna "${rota_coluna_kanban}" da unidade ${unidade.nome}.` }] };
  }

  const errors: GIARotaValidationError[] = [];

  const osSemTipoReparo = osList.filter(os => !os.tipo_reparo || os.tipo_reparo.trim() === '');
  if (osSemTipoReparo.length > 0) {
    errors.push({
      type: 'missing_tipo_reparo',
      message: 'As seguintes OS estão sem Tipo de Reparo preenchido:',
      os_list: osSemTipoReparo.map(os => ({
        numero_samsung: os.numero_os_samsung || undefined,
        numero_interno: os.numero_os_interna || os.id.substring(0, 8),
        cliente_nome: os.cliente_nome,
        cidade: os.cidade || undefined,
      })),
    });
  }

  if (errors.length > 0) return { errors };

  const { data: tempos } = await supabase
    .from('gia_tempos_reparo')
    .select('tipo_reparo, tempo_minutos')
    .eq('unidade_id', unidade_id)
    .eq('ativo', true);

  const tempoMap = new Map((tempos || []).map(t => [t.tipo_reparo.toLowerCase(), t.tempo_minutos]));

  const osSemTempoCadastrado = osList.filter(os => {
    const tipo = os.tipo_reparo?.toLowerCase();
    return tipo && !tempoMap.has(tipo);
  });

  if (osSemTempoCadastrado.length > 0) {
    errors.push({
      type: 'missing_tempo_cadastrado',
      message: 'As seguintes OS têm Tipo de Reparo sem tempo cadastrado na configuração:',
      os_list: osSemTempoCadastrado.map(os => ({
        numero_samsung: os.numero_os_samsung || undefined,
        numero_interno: os.numero_os_interna || os.id.substring(0, 8),
        cliente_nome: os.cliente_nome,
        cidade: os.cidade || undefined,
        tipo_reparo: os.tipo_reparo || undefined,
      })),
    });
  }

  if (errors.length > 0) return { errors };

  const osIds = osList.map(os => os.id);
  const { data: pecasData } = await supabase
    .from('os_pecas')
    .select('os_id, estoque_peca_id, pn, delivery')
    .in('os_id', osIds);

  const { data: estoquePecas } = await supabase
    .from('estoque_pecas')
    .select('id, pn, delivery')
    .in('os_id', osIds);

  const pecasByOs = new Map<string, { id: string; pn: string; delivery: string | null }[]>();
  for (const peca of (pecasData || [])) {
    if (!pecasByOs.has(peca.os_id)) pecasByOs.set(peca.os_id, []);
    pecasByOs.get(peca.os_id)!.push({
      id: peca.estoque_peca_id || '',
      pn: peca.pn || '',
      delivery: peca.delivery || null,
    });
  }
  for (const peca of (estoquePecas || [])) {
    // Additional stock pieces linked to these OS
  }

  const { data: agendamentos } = await supabase
    .from('agendamentos')
    .select('os_id, tecnico_id, data_agendamento, rota_id')
    .eq('tecnico_id', tecnico_id)
    .gte('data_agendamento', data_inicio);

  const conflitos: GIARotaConflict[] = [];
  if (agendamentos && agendamentos.length > 0) {
    const conflictOsIds = agendamentos.map(a => a.os_id).filter(Boolean);
    const { data: conflictOs } = await supabase
      .from('os')
      .select('id, numero_os_interna, numero_os_samsung')
      .in('id', conflictOsIds);

    const osMap = new Map((conflictOs || []).map(os => [os.id, os]));

    for (const ag of agendamentos) {
      const os = osMap.get(ag.os_id);
      if (os) {
        conflitos.push({
          os_id: ag.os_id,
          numero_samsung: os.numero_os_samsung || undefined,
          numero_interno: os.numero_os_interna || ag.os_id.substring(0, 8),
          data_agendamento: ag.data_agendamento,
        });
      }
    }
  }

  const paradas: GIAParadaPlanejada[] = osList.map((os, idx) => ({
    os_id: os.id,
    numero_samsung: os.numero_os_samsung,
    numero_interno: os.numero_os_interna || os.id.substring(0, 8),
    cliente_nome: os.cliente_nome,
    cliente_telefone: os.cliente_telefone,
    cidade: os.cidade,
    endereco: os.endereco_completo,
    tipo_reparo: os.tipo_reparo!,
    tempo_estimado_min: tempoMap.get(os.tipo_reparo!.toLowerCase()) || 60,
    lat: os.lat ? Number(os.lat) : null,
    lng: os.lng ? Number(os.lng) : null,
    pecas: pecasByOs.get(os.id) || [],
    dia: 1,
    ordem: idx + 1,
  }));

  // Fetch technician work hours
  const { data: tecData } = await supabase
    .from('usuarios')
    .select('horario_inicio_expediente, horario_fim_expediente, duracao_almoco_minutos')
    .eq('id', tecnico_id)
    .maybeSingle();

  const horaInicioStr = tecData?.horario_inicio_expediente || '08:00';
  const horaFimStr = tecData?.horario_fim_expediente || '17:00';
  const tempoAlmoco = tecData?.duracao_almoco_minutos || 60;
  const [hI, mI] = horaInicioStr.split(':').map(Number);
  const [hF, mF] = horaFimStr.split(':').map(Number);
  const totalMinutosDia = (hF * 60 + mF) - (hI * 60 + mI);
  const MAX_MINUTOS_DIA = totalMinutosDia - tempoAlmoco;

  let diaAtual = 1;
  let tempoAcumuladoDia = 0;
  for (const parada of paradas) {
    const tempoParada = parada.tempo_estimado_min + 15;
    if (tempoAcumuladoDia + tempoParada > MAX_MINUTOS_DIA && tempoAcumuladoDia > 0) {
      diaAtual++;
      tempoAcumuladoDia = 0;
    }
    parada.dia = diaAtual;
    tempoAcumuladoDia += tempoParada;
  }

  for (let dia = 1; dia <= diaAtual; dia++) {
    const paradasDia = paradas.filter(p => p.dia === dia);
    paradasDia.forEach((p, idx) => { p.ordem = idx + 1; });
  }

  const totalTempo = paradas.reduce((sum, p) => sum + p.tempo_estimado_min, 0);

  const plan: GIARotaPlan = {
    unidade_id,
    rota_id,
    tecnico_id,
    nome_rota: rota.nome,
    nome_tecnico: tecnico.nome,
    data_inicio,
    paradas,
    total_os: paradas.length,
    total_tempo_min: totalTempo,
    conflitos: conflitos.length > 0 ? conflitos : undefined,
  };

  return { plan };
}

export async function saveRoutePlan(plan: GIARotaPlan, criado_por?: string): Promise<string | null> {
  const diasTotais = Math.max(...plan.paradas.map(p => p.dia));
  const dataInicio = new Date(plan.data_inicio);
  const dataFim = new Date(dataInicio);
  dataFim.setDate(dataFim.getDate() + diasTotais - 1);

  const { data: planoData, error: planoError } = await supabase
    .from('gia_planos_rota')
    .insert({
      unidade_id: plan.unidade_id,
      rota_id: plan.rota_id,
      tecnico_id: plan.tecnico_id,
      nome_rota: plan.nome_rota,
      nome_tecnico: plan.nome_tecnico,
      data_inicio: plan.data_inicio,
      data_fim: dataFim.toISOString().split('T')[0],
      status: 'planejado',
      total_os: plan.total_os,
      total_tempo_estimado_min: plan.total_tempo_min,
      criado_por: criado_por || null,
    })
    .select('id')
    .single();

  if (planoError || !planoData) return null;

  const paradas = plan.paradas.map(p => {
    const dataPrevista = new Date(plan.data_inicio);
    dataPrevista.setDate(dataPrevista.getDate() + p.dia - 1);

    return {
      plano_id: planoData.id,
      os_id: p.os_id,
      dia: p.dia,
      data_prevista: dataPrevista.toISOString().split('T')[0],
      ordem: p.ordem,
      tipo_reparo: p.tipo_reparo,
      tempo_estimado_min: p.tempo_estimado_min,
      status: 'pendente',
      os_numero_samsung: p.numero_samsung,
      os_numero_interno: p.numero_interno,
      cliente_nome: p.cliente_nome,
      cliente_telefone: p.cliente_telefone,
      cidade: p.cidade,
      endereco: p.endereco,
      pecas_json: p.pecas,
    };
  });

  const { error: paradasError } = await supabase
    .from('gia_plano_paradas')
    .insert(paradas);

  if (paradasError) return null;

  return planoData.id;
}

export function formatValidationErrors(errors: GIARotaValidationError[]): string {
  let msg = '';
  for (const err of errors) {
    msg += `\n${err.message}\n`;
    if (err.os_list) {
      for (const os of err.os_list) {
        msg += `  - ${formatOSRef(os)}`;
        if (err.type === 'missing_tempo_cadastrado' && os.tipo_reparo) {
          msg += ` [Tipo: ${os.tipo_reparo}]`;
        }
        msg += '\n';
      }
    }
  }
  return msg.trim();
}

export function formatConflicts(conflitos: GIARotaConflict[]): string {
  let msg = 'O técnico já tem OS agendadas para esses dias:\n';
  for (const c of conflitos) {
    const samsung = c.numero_samsung ? `${c.numero_samsung} | ` : '';
    msg += `  - ${samsung}${c.numero_interno} (${c.data_agendamento})\n`;
  }
  msg += '\nDeseja seguir mesmo assim?';
  return msg;
}
