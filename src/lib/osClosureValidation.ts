import { supabase } from './supabase';

export interface RegraFechamento {
  id: string;
  codigo: string;
  titulo: string;
  descricao: string;
  categoria: 'pecas' | 'financeiro' | 'fiscal' | 'operacional';
  severidade: 'bloqueante' | 'alerta';
  ativa: boolean;
  aplica_lp: boolean;
  aplica_ow: boolean;
  aplica_ih: boolean;
  aplica_ci: boolean;
  ordem: number;
}

export interface AlertaFechamento {
  regra_codigo: string;
  regra_titulo: string;
  categoria: 'pecas' | 'financeiro' | 'fiscal' | 'operacional';
  severidade: 'bloqueante' | 'alerta';
  mensagem: string;
  dados_contexto: Record<string, unknown>;
}

export interface ValidacaoResultado {
  aprovado: boolean;
  alertas: AlertaFechamento[];
  bloqueios: AlertaFechamento[];
  totalChecks: number;
  passedChecks: number;
}

interface OSData {
  id: string;
  numero_os_samsung: string | null;
  numero_os_interna: string | null;
  tipo_os: string;
  tipo_atendimento: string;
  tipo_orcamento: string | null;
  unidade_id: string;
  valor_total: number;
  valor_pago: number;
  valor_pecas: number;
  valor_servicos: number;
  saldo_restante: number;
  status_pagamento: string;
  vendedor_responsavel_id: string | null;
  is_cortesia: boolean;
  coluna_kanban: string;
}

const TIPO_ORCAMENTO_LP = ['samsung_contigo', 'acessorios'];

export function isOrcamentoLP(os: { tipo_os?: string; tipo_orcamento?: string | null }): boolean {
  return os.tipo_os === 'LP' || TIPO_ORCAMENTO_LP.includes(os.tipo_orcamento || '');
}

interface OSPeca {
  id: string;
  pn: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number | null;
  status: string;
  gi_postado_em: string | null;
}

interface Pagamento {
  id: string;
  valor: number;
  forma_pagamento: string;
}

interface NFEmitida {
  id: string;
  tipo: string;
  status: string;
}

interface OSServico {
  id: string;
  descricao: string;
  valor_total: number;
}

interface CotacaoPeca {
  id: string;
  pn: string;
  markup_aplicado: number | null;
  valor_final_unitario: number;
}

async function loadRegras(unidadeId: string): Promise<RegraFechamento[]> {
  const { data } = await supabase
    .from('regras_fechamento_os')
    .select('*')
    .eq('ativa', true)
    .or(`unidade_id.is.null,unidade_id.eq.${unidadeId}`)
    .order('ordem');
  return (data || []) as RegraFechamento[];
}

function regraApplies(regra: RegraFechamento, os: OSData): boolean {
  const effectiveLP = isOrcamentoLP(os);
  const isOW = os.tipo_os === 'OW' && !effectiveLP;
  const isIH = os.tipo_atendimento === 'IH';
  const isCI = os.tipo_atendimento === 'CI';

  if (effectiveLP && !regra.aplica_lp) return false;
  if (isOW && !regra.aplica_ow) return false;
  if (isIH && !regra.aplica_ih) return false;
  if (isCI && !regra.aplica_ci) return false;

  return true;
}

function checkGIPostada(pecas: OSPeca[]): AlertaFechamento | null {
  const pecasAprovadas = pecas.filter(p =>
    ['aprovada', 'em_transito', 'disponivel', 'vinculada_tecnico', 'em_uso', 'usada'].includes(p.status)
  );
  if (pecasAprovadas.length === 0) return null;

  const semGI = pecasAprovadas.filter(p => !p.gi_postado_em);
  if (semGI.length === 0) return null;

  return {
    regra_codigo: 'GI_POSTADA',
    regra_titulo: 'GI de todas as pecas postada',
    categoria: 'pecas',
    severidade: 'bloqueante',
    mensagem: `${semGI.length} peca(s) sem GI postada: ${semGI.map(p => p.pn || p.descricao).join(', ')}`,
    dados_contexto: { pecas_sem_gi: semGI.map(p => ({ id: p.id, pn: p.pn, descricao: p.descricao })) },
  };
}

function checkPrecoPecas(pecas: OSPeca[]): AlertaFechamento | null {
  const pecasAtivas = pecas.filter(p =>
    !['cancelada', 'devolvida', 'requisitada'].includes(p.status)
  );
  if (pecasAtivas.length === 0) return null;

  const semPreco = pecasAtivas.filter(p => !p.valor_unitario || p.valor_unitario <= 0);
  if (semPreco.length === 0) return null;

  return {
    regra_codigo: 'PRECO_PECAS',
    regra_titulo: 'Precos das pecas preenchidos',
    categoria: 'pecas',
    severidade: 'bloqueante',
    mensagem: `${semPreco.length} peca(s) sem preco: ${semPreco.map(p => p.pn || p.descricao).join(', ')}`,
    dados_contexto: { pecas_sem_preco: semPreco.map(p => ({ id: p.id, pn: p.pn })) },
  };
}

function checkMarkupPecas(cotacaoPecas: CotacaoPeca[]): AlertaFechamento | null {
  if (cotacaoPecas.length === 0) return null;

  const semMarkup = cotacaoPecas.filter(p => p.markup_aplicado === null || p.markup_aplicado === 0);
  if (semMarkup.length === 0) return null;

  return {
    regra_codigo: 'MARKUP_PECAS',
    regra_titulo: 'Markup aplicado nas pecas',
    categoria: 'pecas',
    severidade: 'alerta',
    mensagem: `${semMarkup.length} peca(s) sem markup na cotacao: ${semMarkup.map(p => p.pn).join(', ')}`,
    dados_contexto: { pecas_sem_markup: semMarkup.map(p => ({ id: p.id, pn: p.pn })) },
  };
}

function checkVendedorDesignado(os: OSData): AlertaFechamento | null {
  if (os.vendedor_responsavel_id) return null;

  return {
    regra_codigo: 'VENDEDOR_DESIGNADO',
    regra_titulo: 'Vendedor responsavel designado',
    categoria: 'operacional',
    severidade: 'bloqueante',
    mensagem: 'Nenhum vendedor responsavel foi designado para esta OS.',
    dados_contexto: {},
  };
}

function checkServicoAdicionado(os: OSData, servicos: OSServico[]): AlertaFechamento | null {
  if (os.tipo_orcamento !== 'normal') return null;
  if (servicos.length > 0) return null;

  return {
    regra_codigo: 'SERVICO_ADICIONADO',
    regra_titulo: 'Servico adicionado na OS (OW)',
    categoria: 'operacional',
    severidade: 'bloqueante',
    mensagem: 'OS do tipo OW com orcamento normal deve ter ao menos um servico adicionado.',
    dados_contexto: {},
  };
}

function checkPagamentoRegistrado(pagamentos: Pagamento[]): AlertaFechamento | null {
  if (pagamentos.length > 0) return null;

  return {
    regra_codigo: 'PAGAMENTO_REGISTRADO',
    regra_titulo: 'Pagamentos registrados',
    categoria: 'financeiro',
    severidade: 'bloqueante',
    mensagem: 'Nenhum pagamento foi registrado para esta OS.',
    dados_contexto: {},
  };
}

function checkPagamentoIntegral(os: OSData): AlertaFechamento | null {
  if (os.status_pagamento === 'pago') return null;
  if (os.valor_total <= 0) return null;

  const percentPago = os.valor_total > 0 ? ((os.valor_pago / os.valor_total) * 100) : 0;

  return {
    regra_codigo: 'PAGAMENTO_INTEGRAL',
    regra_titulo: 'Pagamento 100% realizado',
    categoria: 'financeiro',
    severidade: 'alerta',
    mensagem: `Pagamento em ${percentPago.toFixed(0)}% (R$ ${os.valor_pago.toFixed(2)} de R$ ${os.valor_total.toFixed(2)}). Saldo: R$ ${os.saldo_restante.toFixed(2)}`,
    dados_contexto: {
      valor_total: os.valor_total,
      valor_pago: os.valor_pago,
      saldo: os.saldo_restante,
      percentual: percentPago,
    },
  };
}

function checkNFSeEmitida(os: OSData, nfs: NFEmitida[]): AlertaFechamento | null {
  if (isOrcamentoLP(os)) return null;

  const nfse = nfs.find(n => n.tipo === 'nfse' && n.status === 'emitida');
  if (nfse) return null;

  return {
    regra_codigo: 'NFSE_EMITIDA',
    regra_titulo: 'NFS-e emitida',
    categoria: 'fiscal',
    severidade: 'alerta',
    mensagem: 'A NFS-e (nota fiscal de servico) ainda nao foi emitida para esta OS.',
    dados_contexto: {},
  };
}

function checkNFeEmitida(nfs: NFEmitida[], pecas: OSPeca[]): AlertaFechamento | null {
  const pecasAtivas = pecas.filter(p => !['cancelada', 'devolvida', 'requisitada'].includes(p.status));
  if (pecasAtivas.length === 0) return null;

  const nfe = nfs.find(n => n.tipo === 'nfe' && n.status === 'emitida');
  if (nfe) return null;

  return {
    regra_codigo: 'NFE_EMITIDA',
    regra_titulo: 'NF-e emitida',
    categoria: 'fiscal',
    severidade: 'alerta',
    mensagem: 'A NF-e (nota fiscal de produto) ainda nao foi emitida e ha pecas na OS.',
    dados_contexto: { total_pecas: pecasAtivas.length },
  };
}

function checkValorZero(os: OSData, pecas: OSPeca[], servicos: OSServico[]): AlertaFechamento | null {
  if (os.is_cortesia) return null;

  const problems: string[] = [];

  const pecasAtivas = pecas.filter(p => !['cancelada', 'devolvida', 'requisitada'].includes(p.status));
  if (pecasAtivas.length > 0 && os.valor_pecas <= 0) {
    problems.push('Valor de pecas zerado com pecas ativas');
  }

  if (servicos.length > 0 && os.valor_servicos <= 0) {
    problems.push('Valor de servicos zerado com servicos cadastrados');
  }

  if (os.tipo_os === 'OW' && os.valor_total <= 0 && !os.is_cortesia) {
    problems.push('Valor total da OS zerado (OW nao-cortesia)');
  }

  if (problems.length === 0) return null;

  return {
    regra_codigo: 'VALOR_ZERO',
    regra_titulo: 'Nenhum valor zerado indevidamente',
    categoria: 'financeiro',
    severidade: 'bloqueante',
    mensagem: problems.join('; '),
    dados_contexto: { problemas: problems },
  };
}

const CHECK_MAP: Record<string, (os: OSData, pecas: OSPeca[], pagamentos: Pagamento[], nfs: NFEmitida[], servicos: OSServico[], cotacaoPecas: CotacaoPeca[]) => AlertaFechamento | null> = {
  GI_POSTADA: (_, pecas) => checkGIPostada(pecas),
  PRECO_PECAS: (_, pecas) => checkPrecoPecas(pecas),
  MARKUP_PECAS: (_os, _p, _pg, _n, _s, cp) => checkMarkupPecas(cp),
  VENDEDOR_DESIGNADO: (os) => checkVendedorDesignado(os),
  SERVICO_ADICIONADO: (os, _p, _pg, _n, s) => checkServicoAdicionado(os, s),
  PAGAMENTO_REGISTRADO: (_os, _p, pg) => checkPagamentoRegistrado(pg),
  PAGAMENTO_INTEGRAL: (os) => checkPagamentoIntegral(os),
  NFSE_EMITIDA: (os, _p, _pg, nfs) => checkNFSeEmitida(os, nfs),
  NFE_EMITIDA: (_os, pecas, _pg, nfs) => checkNFeEmitida(nfs, pecas),
  VALOR_ZERO: (os, pecas, _pg, _n, servicos) => checkValorZero(os, pecas, servicos),
};

export async function validarFechamentoOS(osId: string): Promise<ValidacaoResultado> {
  const { data: osData } = await supabase
    .from('os')
    .select('id, numero_os_samsung, numero_os_interna, tipo_os, tipo_atendimento, tipo_orcamento, unidade_id, valor_total, valor_pago, valor_pecas, valor_servicos, saldo_restante, status_pagamento, vendedor_responsavel_id, is_cortesia, coluna_kanban')
    .eq('id', osId)
    .maybeSingle();

  if (!osData) {
    return { aprovado: false, alertas: [], bloqueios: [{ regra_codigo: 'OS_NAO_ENCONTRADA', regra_titulo: 'OS nao encontrada', categoria: 'operacional', severidade: 'bloqueante', mensagem: 'OS nao localizada no sistema.', dados_contexto: {} }], totalChecks: 0, passedChecks: 0 };
  }

  const os: OSData = {
    ...osData,
    valor_total: Number(osData.valor_total) || 0,
    valor_pago: Number(osData.valor_pago) || 0,
    valor_pecas: Number(osData.valor_pecas) || 0,
    valor_servicos: Number(osData.valor_servicos) || 0,
    saldo_restante: Number(osData.saldo_restante) || 0,
    is_cortesia: osData.is_cortesia || false,
    vendedor_responsavel_id: osData.vendedor_responsavel_id || null,
  };

  const [pecasRes, pagamentosRes, nfsRes, servicosRes, cotacaoPecasRes, regras] = await Promise.all([
    supabase.from('os_pecas').select('id, pn, descricao, quantidade, valor_unitario, status, gi_postado_em').eq('os_id', osId),
    supabase.from('pagamentos').select('id, valor, forma_pagamento').eq('os_id', osId),
    supabase.from('nf_emitidas').select('id, tipo, status').eq('os_id', osId),
    supabase.from('os_servicos').select('id, descricao, valor_total').eq('os_id', osId),
    supabase.from('cotacoes').select('id').eq('os_id', osId).maybeSingle().then(async (cotRes) => {
      if (!cotRes.data?.id) return { data: [] };
      return supabase.from('cotacoes_pecas').select('id, pn, markup_aplicado, valor_final_unitario').eq('cotacao_id', cotRes.data.id);
    }),
    loadRegras(os.unidade_id),
  ]);

  const pecas = (pecasRes.data || []) as OSPeca[];
  const pagamentos = (pagamentosRes.data || []) as Pagamento[];
  const nfs = (nfsRes.data || []) as NFEmitida[];
  const servicos = (servicosRes.data || []) as OSServico[];
  const cotacaoPecas = (cotacaoPecasRes.data || []) as CotacaoPeca[];

  const alertas: AlertaFechamento[] = [];
  const bloqueios: AlertaFechamento[] = [];
  let passedChecks = 0;
  let totalChecks = 0;

  for (const regra of regras) {
    if (!regraApplies(regra, os)) continue;

    const checkFn = CHECK_MAP[regra.codigo];
    if (!checkFn) continue;

    totalChecks++;
    const resultado = checkFn(os, pecas, pagamentos, nfs, servicos, cotacaoPecas);

    if (resultado) {
      resultado.severidade = regra.severidade;
      if (regra.severidade === 'bloqueante') {
        bloqueios.push(resultado);
      } else {
        alertas.push(resultado);
      }
    } else {
      passedChecks++;
    }
  }

  return {
    aprovado: bloqueios.length === 0,
    alertas,
    bloqueios,
    totalChecks,
    passedChecks,
  };
}

export async function salvarAlertasFechamento(
  osId: string,
  unidadeId: string,
  alertas: AlertaFechamento[]
): Promise<void> {
  await supabase.from('os_alertas_fechamento').delete().eq('os_id', osId).eq('resolvido', false);

  if (alertas.length === 0) return;

  const rows = alertas.map(a => ({
    os_id: osId,
    unidade_id: unidadeId,
    regra_codigo: a.regra_codigo,
    regra_titulo: a.regra_titulo,
    categoria: a.categoria,
    severidade: a.severidade,
    mensagem: a.mensagem,
    dados_contexto: a.dados_contexto,
  }));

  await supabase.from('os_alertas_fechamento').insert(rows);
}

export async function criarAlertasGIAWarranty(
  osId: string,
  osNumero: string,
  unidadeId: string,
  alertas: AlertaFechamento[]
): Promise<void> {
  if (alertas.length === 0) return;

  const bloqueios = alertas.filter(a => a.severidade === 'bloqueante');
  const avisos = alertas.filter(a => a.severidade === 'alerta');

  const linhas: string[] = [];
  if (bloqueios.length > 0) {
    linhas.push(`BLOQUEIOS (${bloqueios.length}):`);
    bloqueios.forEach(b => linhas.push(`- ${b.regra_titulo}: ${b.mensagem}`));
  }
  if (avisos.length > 0) {
    linhas.push(`ALERTAS (${avisos.length}):`);
    avisos.forEach(a => linhas.push(`- ${a.regra_titulo}: ${a.mensagem}`));
  }

  const descricao = linhas.join('\n');
  const titulo = `OS ${osNumero} - ${bloqueios.length + avisos.length} desvio(s) no fechamento`;
  const metadata = {
    tipo: 'fechamento_os',
    total_bloqueios: bloqueios.length,
    total_alertas: avisos.length,
    regras: alertas.map(a => a.regra_codigo),
  };

  const { data: existing } = await supabase
    .from('gia_mural_tarefas')
    .select('id')
    .eq('os_id', osId)
    .eq('gia_source', 'GIA Warranty')
    .eq('status', 'pendente')
    .maybeSingle();

  if (existing) {
    await supabase.from('gia_mural_tarefas').update({
      titulo,
      descricao,
      prioridade: bloqueios.length > 0 ? 'alta' : 'normal',
      metadata,
    }).eq('id', existing.id);
  } else {
    await supabase.from('gia_mural_tarefas').insert({
      gia_source: 'GIA Warranty',
      gia_responsavel: 'GIA Warranty',
      prioridade: bloqueios.length > 0 ? 'alta' : 'normal',
      titulo,
      descricao,
      status: 'pendente',
      unidade_id: unidadeId,
      os_id: osId,
      os_numero: osNumero,
      metadata,
    });
  }
}

export async function executarFechamentoOS(
  osId: string,
  userId: string
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('os')
    .update({
      coluna_kanban: 'os_fechada',
      fechada_em: new Date().toISOString(),
      fechada_por: userId,
    })
    .eq('id', osId);

  if (error) return { success: false, error: error.message };

  await supabase.from('os_alertas_fechamento').update({ resolvido: true, resolvido_em: new Date().toISOString(), resolvido_por: userId }).eq('os_id', osId).eq('resolvido', false);

  return { success: true };
}

export async function getAlertasOS(osId: string): Promise<AlertaFechamento[]> {
  const { data } = await supabase
    .from('os_alertas_fechamento')
    .select('*')
    .eq('os_id', osId)
    .eq('resolvido', false)
    .order('severidade', { ascending: true });

  return (data || []).map(d => ({
    regra_codigo: d.regra_codigo,
    regra_titulo: d.regra_titulo,
    categoria: d.categoria,
    severidade: d.severidade,
    mensagem: d.mensagem,
    dados_contexto: d.dados_contexto || {},
  }));
}
