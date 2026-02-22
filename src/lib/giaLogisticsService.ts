import { supabase } from './supabase';
import { geocodeAddress, geocodeCEP } from './geocoding';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OSLogistica {
  id: string;
  numero_os_interna: string | null;
  numero_os_samsung: string | null;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  cliente_endereco: string | null;
  cliente_logradouro: string | null;
  cliente_numero: string | null;
  cliente_bairro: string | null;
  cliente_cidade: string | null;
  cliente_cep: string | null;
  aparelho_linha: string | null;
  tecnico_agendado_id: string | null;
  lat: number | null;
  lng: number | null;
  status_agendamento_gia: string | null;
  coluna_kanban: string | null;
  confirmado_com_cliente: boolean;
  unidade_id: string | null;
  rota_id: string | null;
  whatsapp_sent_at: string | null;
  data_agendamento: string | null;
}

export interface RotaOtimizada {
  id: string;
  nome: string;
  data_rota: string | null;
  status_rota: string;
  skill: string | null;
  cor: string | null;
  cidades: string[] | null;
  total_os: number;
  tecnico_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  unidade_id: string | null;
}

export interface RotaColuna {
  id: string;
  nome: string;
  cor: string | null;
  coluna_kanban: string;
  cidades: string[];
}

export interface TecnicoLogistica {
  id: string;
  nome: string;
  habilidades: string[] | null;
  horario_inicio_expediente: string | null;
  horario_fim_expediente: string | null;
  duracao_almoco_minutos: number | null;
  horario_almoco_inicio: string | null;
}

// ---------------------------------------------------------------------------
// Geocoding
// ---------------------------------------------------------------------------

export async function geocodificarOSLogistica(os: OSLogistica): Promise<{ lat: number; lng: number } | null> {
  try {
    if (os.cliente_cep) {
      const coords = await geocodeCEP(os.cliente_cep);
      if (coords) return coords;
    }
    const partes = [
      os.cliente_logradouro || os.cliente_endereco,
      os.cliente_numero,
      os.cliente_bairro,
      os.cliente_cidade,
      'Brasil',
    ].filter(Boolean).join(', ');

    if (partes) {
      const result = await geocodeAddress(partes);
      if (result) return { lat: result.lat, lng: result.lng };
    }
    return null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Fetch helpers
// ---------------------------------------------------------------------------

const COR_POR_COLUNA: Record<string, string> = {
  rota_preta: '#111827',
  rota_vermelha: '#EF4444',
  rota_azul: '#3B82F6',
  rota_verde: '#10B981',
  rota_amarela: '#F59E0B',
  rota_laranja: '#F97316',
  rota_rosa: '#EC4899',
  rota_roxo: '#8B5CF6',
  rota_cinza: '#6B7280',
  rota_branca: '#E5E7EB',
};

export async function buscarRotasColuna(unidadeId: string): Promise<RotaColuna[]> {
  const [rotasDB, osDistinct] = await Promise.all([
    supabase
      .from('rotas')
      .select('id, nome, cor, coluna_kanban, cidades')
      .eq('unidade_id', unidadeId)
      .eq('ativa', true)
      .not('coluna_kanban', 'is', null)
      .order('nome'),
    supabase
      .from('os')
      .select('coluna_kanban')
      .eq('unidade_id', unidadeId)
      .like('coluna_kanban', 'rota_%'),
  ]);

  const rotasCadastradas = (rotasDB.data ?? []) as RotaColuna[];
  const colunasUsadas = new Set(rotasCadastradas.map(r => r.coluna_kanban));

  const colunasDistintas = new Set(
    (osDistinct.data ?? [])
      .map(r => r.coluna_kanban as string)
      .filter(Boolean)
  );

  const extras: RotaColuna[] = [];
  for (const coluna of colunasDistintas) {
    if (!colunasUsadas.has(coluna)) {
      const sufixo = coluna.replace(/^rota_/, '');
      const nome = 'Rota ' + sufixo.charAt(0).toUpperCase() + sufixo.slice(1);
      extras.push({
        id: coluna,
        nome,
        cor: COR_POR_COLUNA[coluna] ?? '#6B7280',
        coluna_kanban: coluna,
        cidades: [],
      });
    }
  }

  return [...rotasCadastradas, ...extras].sort((a, b) => a.nome.localeCompare(b.nome));
}

export async function buscarTecnicosLogistica(unidadeId: string): Promise<TecnicoLogistica[]> {
  const { data } = await supabase
    .from('usuarios')
    .select('id, nome, habilidades, horario_inicio_expediente, horario_fim_expediente, duracao_almoco_minutos, horario_almoco_inicio')
    .eq('unidade_id', unidadeId)
    .in('tipo', ['tecnico', 'tecnico_ih'])
    .eq('ativo', true)
    .order('nome');
  return (data ?? []) as TecnicoLogistica[];
}

export async function buscarOSsDaRota(unidadeId: string, colunaKanban: string): Promise<OSLogistica[]> {
  const { data } = await supabase
    .from('os')
    .select(
      'id, numero_os_interna, numero_os_samsung, cliente_nome, cliente_telefone, ' +
      'cliente_endereco, cliente_logradouro, cliente_numero, cliente_bairro, ' +
      'cliente_cidade, cliente_cep, aparelho_linha, tecnico_agendado_id, ' +
      'lat, lng, status_agendamento_gia, coluna_kanban, confirmado_com_cliente, ' +
      'unidade_id, rota_id, whatsapp_sent_at, data_agendamento'
    )
    .eq('unidade_id', unidadeId)
    .eq('coluna_kanban', colunaKanban)
    .order('created_at', { ascending: true });
  return (data ?? []) as OSLogistica[];
}

// ---------------------------------------------------------------------------
// Skill filter — FIX: trim + toUpperCase on both sides
// ---------------------------------------------------------------------------

export function tecnicoAtendeLinha(tecnico: TecnicoLogistica, aparelhoLinha: string | null): boolean {
  if (!tecnico.habilidades || tecnico.habilidades.length === 0) return true;
  if (!aparelhoLinha) return true;
  const norm = aparelhoLinha.trim().toUpperCase();
  return tecnico.habilidades.some(h => h.trim().toUpperCase() === norm);
}

// ---------------------------------------------------------------------------
// Time filter helper — multi-day bin-packing with strict daily limits
// ---------------------------------------------------------------------------

export interface JanelaTempoResult {
  aprovadas: OSLogistica[];
  sobrasHorario: OSLogistica[];
  minutosUsados: number;
  minutosDisponiveis: number;
  diasNecessarios: number;
}

function _timeToMin(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * Distribui OSs em dias respeitando o limite diário de horas úteis (bin-packing).
 * - Se o horário atual já passou do expediente, Dia 1 = amanhã.
 * - Cada OS custa minutosOsPadrao + minutosDeslocamento.
 * - Quando um dia está cheio, fecha-o e abre o próximo.
 * - O que não couber em nenhum dia disponível vai para sobrasHorario.
 */
export function filtrarPorJanelaTempo(
  osList: OSLogistica[],
  tecnico: TecnicoLogistica,
  minutosOsPadrao = 60,
  minutosDeslocamento = 20,
  maxDias = 5
): JanelaTempoResult {
  const inicioStr = tecnico.horario_inicio_expediente ?? '08:00';
  const fimStr = tecnico.horario_fim_expediente ?? '18:00';
  const almocoDur = tecnico.duracao_almoco_minutos ?? 60;

  const inicioMin = _timeToMin(inicioStr);
  const fimMin = _timeToMin(fimStr);
  const limiteMinDia = fimMin - inicioMin - almocoDur;

  // FIX: Day 1 start guard — if past expediente, start tomorrow
  const agora = new Date();
  const agoraMin = agora.getHours() * 60 + agora.getMinutes();
  const diaOffset = agoraMin >= fimMin ? 1 : 0;

  const aprovadas: OSLogistica[] = [];
  const sobrasHorario: OSLogistica[] = [];

  let dia = 1 + diaOffset;
  let tempoAcumuladoDia = 0;
  let totalMinutosUsados = 0;

  const custoPorOS = minutosOsPadrao + minutosDeslocamento;

  for (const os of osList) {
    if (tempoAcumuladoDia + custoPorOS <= limiteMinDia) {
      aprovadas.push(os);
      tempoAcumuladoDia += custoPorOS;
      totalMinutosUsados += custoPorOS;
    } else {
      if (dia < maxDias) {
        dia++;
        tempoAcumuladoDia = custoPorOS;
        totalMinutosUsados += custoPorOS;
        aprovadas.push(os);
      } else {
        sobrasHorario.push(os);
      }
    }
  }

  return {
    aprovadas,
    sobrasHorario,
    minutosUsados: totalMinutosUsados,
    minutosDisponiveis: limiteMinDia * (maxDias - diaOffset),
    diasNecessarios: dia,
  };
}

// ---------------------------------------------------------------------------
// Save route draft
// ---------------------------------------------------------------------------

export async function salvarRotaRascunho(params: {
  unidadeId: string;
  tecnicoId: string;
  nome: string;
  dataRota: string;
  cor: string | null;
  cidades: string[];
  skill: string;
  osIds: string[];
  colunaKanban: string;
}): Promise<string | null> {
  const { data: rota, error } = await supabase
    .from('rotas_otimizadas')
    .insert({
      unidade_id: params.unidadeId,
      tecnico_id: params.tecnicoId,
      nome: params.nome,
      data_rota: params.dataRota,
      status_rota: 'rascunho',
      skill: params.skill,
      cor: params.cor,
      cidades: params.cidades,
      total_os: params.osIds.length,
      metadata: {
        gerado_por: 'GIA Logistics',
        coluna_kanban_origem: params.colunaKanban,
        os_ids: params.osIds,
      },
    })
    .select('id')
    .single();

  if (error || !rota) return null;

  await supabase
    .from('os')
    .update({ rota_id: rota.id, status_agendamento_gia: 'em_rascunho' })
    .in('id', params.osIds);

  return rota.id;
}

// ---------------------------------------------------------------------------
// Approve route + schedule + send WhatsApp batch
// ---------------------------------------------------------------------------

export async function confirmarRotaEAgendar(params: {
  rotaId: string;
  tecnicoId: string;
  tecnicoNome: string;
  dataRota: string;
  periodoRota: string;
  osIds: string[];
  unidadeId: string;
  osList: OSLogistica[];
}): Promise<{ enviados: number; falhas: number; erros: string[] }> {
  const { rotaId, tecnicoId, tecnicoNome, dataRota, periodoRota, osIds, unidadeId, osList } = params;

  await supabase
    .from('rotas_otimizadas')
    .update({ status_rota: 'aprovada_notificando' })
    .eq('id', rotaId);

  await supabase
    .from('os')
    .update({
      tecnico_agendado_id: tecnicoId,
      data_agendamento: dataRota,
      periodo_agendamento: periodoRota,
      status_agendamento_gia: 'aguardando_confirmacao_cliente',
      whatsapp_sent_at: new Date().toISOString(),
    })
    .in('id', osIds);

  const { enviarLoteConfirmacoes } = await import('./whatsappGIA');

  const payload = osList.map(os => ({
    os_id: os.id,
    cliente_nome: os.cliente_nome ?? 'Cliente',
    telefone: os.cliente_telefone ?? '',
    data_agendamento: dataRota,
    tecnico_nome: tecnicoNome,
    unidade_id: unidadeId,
  }));

  const resultado = await enviarLoteConfirmacoes(payload);
  return { enviados: resultado.enviados, falhas: resultado.falhas, erros: [] };
}

// ---------------------------------------------------------------------------
// Route management
// ---------------------------------------------------------------------------

export async function descartarRotaOtimizada(rotaId: string): Promise<boolean> {
  await supabase
    .from('os')
    .update({ rota_id: null, status_agendamento_gia: 'pronta_para_roteirizar' })
    .eq('rota_id', rotaId);

  const { error } = await supabase
    .from('rotas_otimizadas')
    .delete()
    .eq('id', rotaId);

  return !error;
}

export async function marcarRotaLiberada(rotaId: string): Promise<boolean> {
  const { error } = await supabase
    .from('rotas_otimizadas')
    .update({ status_rota: 'liberada_tecnico' })
    .eq('id', rotaId);
  return !error;
}
