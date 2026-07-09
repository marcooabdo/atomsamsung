export const APPROVED_STAGES = [
  'orcamento_aprovado', 'aguardando_peca', 'peca_em_transito',
  'em_reparo_ci', 'em_rota_ih', 'saw', 'instalacao_inicial',
  'service_handling', 'return_handling', 'trade_up', 'controle_qualidade',
  'reparo_concluido', 'aguardando_fechamento', 'os_fechada'
];

export const KANBAN_LABELS: Record<string, string> = {
  'orcamento_aprovado': 'Orc. Aprovado',
  'aguardando_peca': 'Aguardando Peca',
  'peca_em_transito': 'Peca em Transito',
  'em_reparo_ci': 'Em Reparo',
  'em_rota_ih': 'Agendado',
  'saw': 'SAW',
  'instalacao_inicial': 'Instalacao Inicial',
  'service_handling': 'Service Handling',
  'return_handling': 'Return Handling',
  'trade_up': 'Trade Up',
  'controle_qualidade': 'Controle Qualidade',
  'reparo_concluido': 'Reparo Concluido',
  'aguardando_fechamento': 'Aguard. Fechamento',
  'os_fechada': 'OS Fechada'
};

export const KANBAN_COLORS: Record<string, string> = {
  'orcamento_aprovado': 'text-amber-400 bg-amber-500/20 border-amber-500/30',
  'aguardando_peca': 'text-orange-400 bg-orange-500/20 border-orange-500/30',
  'peca_em_transito': 'text-blue-400 bg-blue-500/20 border-blue-500/30',
  'em_reparo_ci': 'text-sky-400 bg-sky-500/20 border-sky-500/30',
  'em_rota_ih': 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
  'saw': 'text-green-400 bg-green-500/20 border-green-500/30',
  'instalacao_inicial': 'text-violet-400 bg-violet-500/20 border-violet-500/30',
  'service_handling': 'text-pink-400 bg-pink-500/20 border-pink-500/30',
  'return_handling': 'text-amber-400 bg-amber-500/20 border-amber-500/30',
  'trade_up': 'text-cyan-400 bg-cyan-500/20 border-cyan-500/30',
  'controle_qualidade': 'text-lime-400 bg-lime-500/20 border-lime-500/30',
  'reparo_concluido': 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
  'aguardando_fechamento': 'text-yellow-400 bg-yellow-500/20 border-yellow-500/30',
  'os_fechada': 'text-emerald-300 bg-emerald-500/20 border-emerald-500/30'
};

export const ORCAMENTO_TO_CATEGORY: Record<string, string> = {
  'samsung_contigo': 'SC',
  'acessorios': 'ACC',
  'normal': 'OW'
};

export const CI_FILTERS = ['geral', 'SC', 'ACC', 'OW'] as const;

export const CI_FILTER_COLORS: Record<string, string> = {
  'SC': 'text-amber-400 bg-amber-500/20 border-amber-500/30',
  'ACC': 'text-teal-400 bg-teal-500/20 border-teal-500/30',
  'OW': 'text-blue-400 bg-blue-500/20 border-blue-500/30'
};

export const CHART_COLORS = ['#06B6D4', '#3B82F6', '#14B8A6', '#10B981', '#F59E0B', '#0EA5E9', '#22D3EE', '#38BDF8'];

export const GLASS = 'backdrop-blur-xl border border-cyan-500/20 rounded-2xl shadow-2xl shadow-cyan-500/5 ci-glass-card';
export const GLASS_INNER = 'backdrop-blur-md rounded-xl ci-glass-inner' as const;

export interface OSRecord {
  id: string;
  numero_os_interna: string;
  tipo_os: string;
  tipo_orcamento: string;
  categoria: string;
  coluna_kanban: string;
  valor_total: number;
  valor_pago: number;
  valor_pecas: number;
  valor_servicos: number;
  created_at: string;
  fechada_em: string | null;
  orcamento_aprovado_em: string | null;
  vendedorNome: string;
  vendedorId: string | null;
  unidade_id: string | null;
  defeito_relatado: string | null;
  aparelho_modelo: string | null;
  numero_os_samsung: string | null;
  pecas: { pn: string; descricao: string; quantidade: number; valor_unitario: number; valor_total: number }[];
}

export interface ClienteCI {
  id: string;
  nome: string;
  documento: string;
  telefone: string;
  email: string;
  endereco: string;
  cidade: string;
  estado: string;
  totalFaturado: number;
  totalPago: number;
  totalOS: number;
  ticketMedio: number;
  ultimaOS: string;
  vendedorId: string | null;
  vendedorNome: string;
  status: 'ativo' | 'pendente';
  tiposOS: string[];
  osRecords: OSRecord[];
  pecas: PecaClienteCI[];
}

export interface PecaClienteCI {
  pn: string;
  descricao: string;
  quantidade: number;
  valorMedio: number;
}

export interface VendedorCI {
  id: string;
  nome: string;
  faturamento: number;
  totalOS: number;
  totalClientes: number;
  ticketMedio: number;
}

export interface PecaCI {
  pn: string;
  descricao: string;
  quantidade: number;
  valorTotal: number;
  valorMedio: number;
}

export interface CIKPIs {
  totalFaturamento: number;
  ticketMedio: number;
  clienteDoMes: string;
  clienteDoMesValor: number;
  vendedorDestaque: string;
  vendedorDestaqueValor: number;
  crescimento: number;
  totalClientes: number;
}

export interface DadoMensal {
  mes: string;
  faturamento: number;
  qtd: number;
}

export const formatCurrency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

export const formatDate = (dateStr: string | null) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('pt-BR');
};

export const getValorCliente = (c: ClienteCI) => c.totalPago > 0 ? c.totalPago : c.totalFaturado;
