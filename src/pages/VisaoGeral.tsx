import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import {
  BarChart3,
  TrendingUp,
  Clock,
  AlertTriangle,
  Download,
  Package,
  Wrench,
  DollarSign,
  Activity,
  Users,
  CheckCircle2,
  XCircle,
  Timer,
  Layers,
  ArrowUpRight,
  ArrowDownRight,
  RefreshCw,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Area,
  AreaChart,
  Legend,
} from 'recharts';

interface ColumnData {
  coluna_kanban: string;
  total: number;
  mais_antigo: string;
  sem_valor: number;
  valor_total_soma: number;
  media_dias: number;
}

interface OSData {
  id: string;
  coluna_kanban: string;
  tipo_os: string;
  tipo_atendimento: string;
  valor_total: number;
  created_at: string;
  updated_at: string;
  dias_na_etapa: number;
  numero_os_samsung: string;
  numero_os_interna: string;
  aparelho_modelo: string;
  status_pagamento: string;
  unidade_id: string;
  fechada_em: string | null;
  arquivada: boolean;
}

const COLUMN_LABELS: Record<string, string> = {
  os_nova: 'OS Nova',
  instalacao_inicial: 'Instalação Inicial',
  diagnostico: 'Diagnóstico',
  aguardando_aprovacao: 'Aguardando Aprovação',
  negociacao_em_andamento: 'Negociação em Andamento',
  orcamento_aprovado: 'Orçamento Aprovado',
  orcamentos_rejeitados: 'Orçamentos Rejeitados',
  aguardando_peca: 'Aguardando Peça',
  peca_em_transito: 'Peça em Trânsito',
  em_reparo_ci: 'Em Reparo (CI)',
  em_rota_ih: 'Em Rota (IH)',
  reparo_concluido: 'Reparo Concluído',
  controle_qualidade: 'Controle de Qualidade',
  qa_bt: 'QA BT',
  aguardando_fechamento: 'Aguardando Fechamento',
  os_fechada: 'OS Fechada',
  saw: 'SAW',
  service_handling: 'Service Handling',
  return_handling: 'Return Handling',
  trade_up: 'Trade Up',
  rota_verde: 'Rota Verde',
  rota_azul: 'Rota Azul',
  rota_amarela: 'Rota Amarela',
  rota_laranja: 'Rota Laranja',
  rota_rosa: 'Rota Rosa',
  rota_vermelha: 'Rota Vermelha',
  rota_preta: 'Rota Preta',
};

const COLUMN_COLORS: Record<string, string> = {
  os_nova: '#3B82F6',
  instalacao_inicial: '#8B5CF6',
  diagnostico: '#F59E0B',
  aguardando_aprovacao: '#EF4444',
  negociacao_em_andamento: '#F97316',
  orcamento_aprovado: '#10B981',
  orcamentos_rejeitados: '#DC2626',
  aguardando_peca: '#6366F1',
  peca_em_transito: '#0EA5E9',
  em_reparo_ci: '#14B8A6',
  em_rota_ih: '#84CC16',
  reparo_concluido: '#22C55E',
  controle_qualidade: '#A855F7',
  qa_bt: '#EC4899',
  aguardando_fechamento: '#F59E0B',
  os_fechada: '#6B7280',
  saw: '#0D9488',
  service_handling: '#7C3AED',
  return_handling: '#BE185D',
  trade_up: '#059669',
  rota_verde: '#16A34A',
  rota_azul: '#2563EB',
  rota_amarela: '#EAB308',
  rota_laranja: '#EA580C',
  rota_rosa: '#DB2777',
  rota_vermelha: '#DC2626',
  rota_preta: '#1F2937',
};

const PIE_COLORS = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];

function formatTimeAgo(dateStr: string): string {
  if (!dateStr) return '-';
  const now = new Date();
  const date = new Date(dateStr);
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffHours / 24);

  if (diffDays > 0) return `${diffDays}d ${diffHours % 24}h`;
  if (diffHours > 0) return `${diffHours}h`;
  const diffMin = Math.floor(diffMs / (1000 * 60));
  return `${diffMin}min`;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function VisaoGeral() {
  const [columnData, setColumnData] = useState<ColumnData[]>([]);
  const [allOS, setAllOS] = useState<OSData[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: osData, error } = await supabase
        .from('os')
        .select('id, coluna_kanban, tipo_os, tipo_atendimento, valor_total, created_at, updated_at, dias_na_etapa, numero_os_samsung, numero_os_interna, aparelho_modelo, status_pagamento, unidade_id, fechada_em, arquivada')
        .eq('arquivada', false)
        .limit(5000);

      if (error) {
        console.error('Error fetching OS data:', error);
      } else if (osData) {
        setAllOS(osData as OSData[]);
      }
      setLastRefresh(new Date());
    } catch (err) {
      console.error('Error fetching visao geral data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, []);

  const stats = useMemo(() => {
    const byColumn: Record<string, { total: number; oldest: string; semValor: number; valorTotal: number }> = {};
    const byType: Record<string, number> = {};
    let totalOS = 0;
    let totalValor = 0;
    let osAbertas = 0;
    let osFechadas = 0;
    let osComValor = 0;
    let osSemValor = 0;

    allOS.forEach((os) => {
      totalOS++;
      totalValor += os.valor_total || 0;

      if (os.fechada_em) osFechadas++;
      else osAbertas++;

      if (os.valor_total && os.valor_total > 0) osComValor++;
      else osSemValor++;

      // By type
      const tipo = os.tipo_os || 'N/A';
      byType[tipo] = (byType[tipo] || 0) + 1;

      // By column
      const col = os.coluna_kanban || 'sem_coluna';
      if (!byColumn[col]) {
        byColumn[col] = { total: 0, oldest: os.updated_at, semValor: 0, valorTotal: 0 };
      }
      byColumn[col].total++;
      byColumn[col].valorTotal += os.valor_total || 0;

      if (!os.valor_total || os.valor_total === 0) {
        byColumn[col].semValor++;
      }

      if (os.updated_at < byColumn[col].oldest) {
        byColumn[col].oldest = os.updated_at;
      }
    });

    return { byColumn, byType, totalOS, totalValor, osAbertas, osFechadas, osComValor, osSemValor };
  }, [allOS]);

  const columnRows = useMemo(() => {
    return Object.entries(stats.byColumn)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([key, val]) => ({
        coluna: key,
        label: COLUMN_LABELS[key] || key.replace(/_/g, ' '),
        total: val.total,
        oldest: val.oldest,
        semValor: val.semValor,
        valorTotal: val.valorTotal,
      }));
  }, [stats]);

  const chartDataByColumn = useMemo(() => {
    return columnRows.slice(0, 12).map((r) => ({
      name: r.label.length > 12 ? r.label.slice(0, 12) + '...' : r.label,
      fullName: r.label,
      quantidade: r.total,
    }));
  }, [columnRows]);

  const chartDataByType = useMemo(() => {
    return Object.entries(stats.byType).map(([name, value]) => ({ name, value }));
  }, [stats]);

  const aguardandoPecaStats = useMemo(() => {
    const pecaOS = allOS.filter((os) => os.coluna_kanban === 'aguardando_peca');
    const comErroValor = pecaOS.filter((os) => !os.valor_total || os.valor_total === 0);
    const semCodigo = pecaOS.filter((os) => !os.numero_os_samsung && !os.numero_os_interna);
    return { total: pecaOS.length, comErroValor: comErroValor.length, semCodigo: semCodigo.length };
  }, [allOS]);

  const rotas = useMemo(() => {
    const rotaCols = ['rota_verde', 'rota_azul', 'rota_amarela', 'rota_laranja', 'rota_rosa', 'rota_vermelha', 'rota_preta'];
    return rotaCols.map((col) => {
      const osCol = allOS.filter((os) => os.coluna_kanban === col);
      return {
        name: COLUMN_LABELS[col] || col,
        quantidade: osCol.length,
        valor: osCol.reduce((s, os) => s + (os.valor_total || 0), 0),
      };
    }).filter(r => r.quantidade > 0);
  }, [allOS]);

  const exportToCSV = () => {
    const headers = ['Coluna', 'Quantidade', 'Card Mais Antigo', 'Tempo na Etapa', 'Sem Valor/Código', 'Valor Total'];
    const rows = columnRows.map((r) => [
      r.label,
      r.total.toString(),
      new Date(r.oldest).toLocaleString('pt-BR'),
      formatTimeAgo(r.oldest),
      r.semValor.toString(),
      formatCurrency(r.valorTotal),
    ]);

    const csv = [headers.join(';'), ...rows.map((r) => r.join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `visao-geral-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && allOS.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Visão Geral</h1>
          <p className="text-sm text-gray-500 mt-1">
            Painel executivo - Atualizado em {lastRefresh.toLocaleTimeString('pt-BR')}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar CSV
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total de OS Ativas"
          value={stats.osAbertas.toString()}
          subtitle={`${stats.osFechadas} fechadas`}
          icon={<Layers className="w-5 h-5" />}
          color="blue"
        />
        <KPICard
          title="Valor Total em OS"
          value={formatCurrency(stats.totalValor)}
          subtitle={`${stats.osComValor} OS com valor`}
          icon={<DollarSign className="w-5 h-5" />}
          color="green"
        />
        <KPICard
          title="OS Tipo OW"
          value={(stats.byType['OW'] || 0).toString()}
          subtitle={`${((stats.byType['OW'] || 0) / Math.max(stats.totalOS, 1) * 100).toFixed(0)}% do total`}
          icon={<Wrench className="w-5 h-5" />}
          color="amber"
        />
        <KPICard
          title="OS Tipo LP"
          value={(stats.byType['LP'] || 0).toString()}
          subtitle={`${((stats.byType['LP'] || 0) / Math.max(stats.totalOS, 1) * 100).toFixed(0)}% do total`}
          icon={<Package className="w-5 h-5" />}
          color="teal"
        />
      </div>

      {/* Second Row KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Aguardando Peça"
          value={aguardandoPecaStats.total.toString()}
          subtitle={`${aguardandoPecaStats.comErroValor} com valor R$0`}
          icon={<AlertTriangle className="w-5 h-5" />}
          color="red"
          alert={aguardandoPecaStats.comErroValor > 0}
        />
        <KPICard
          title="Sem Código (Ag. Peça)"
          value={aguardandoPecaStats.semCodigo.toString()}
          subtitle="OS sem código Samsung/Interna"
          icon={<XCircle className="w-5 h-5" />}
          color="red"
          alert={aguardandoPecaStats.semCodigo > 0}
        />
        <KPICard
          title="Em Rota (IH)"
          value={(stats.byColumn['em_rota_ih']?.total || 0).toString()}
          subtitle={formatCurrency(stats.byColumn['em_rota_ih']?.valorTotal || 0)}
          icon={<Activity className="w-5 h-5" />}
          color="lime"
        />
        <KPICard
          title="Em Reparo (CI)"
          value={(stats.byColumn['em_reparo_ci']?.total || 0).toString()}
          subtitle={formatCurrency(stats.byColumn['em_reparo_ci']?.valorTotal || 0)}
          icon={<Wrench className="w-5 h-5" />}
          color="cyan"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bar chart - OS by column */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            OS por Etapa (Top 12)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartDataByColumn} margin={{ top: 5, right: 20, left: 0, bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11 }}
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: number) => [value, 'Quantidade']}
                labelFormatter={(label: string, payload: any[]) => payload?.[0]?.payload?.fullName || label}
              />
              <Bar dataKey="quantidade" fill="#3B82F6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie chart - OS by type */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-green-600" />
            Distribuição por Tipo
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={chartDataByType}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={100}
                paddingAngle={3}
                dataKey="value"
                label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
              >
                {chartDataByType.map((_, index) => (
                  <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value: number) => [value, 'OS']} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Rotas Chart */}
      {rotas.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <Activity className="w-4 h-4 text-green-600" />
            OS em Rotas
          </h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={rotas} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip
                formatter={(value: number, name: string) => {
                  if (name === 'valor') return [formatCurrency(value), 'Valor'];
                  return [value, 'Quantidade'];
                }}
              />
              <Bar dataKey="quantidade" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Insights / Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Alertas e Insights
          </h3>
          <div className="space-y-3">
            {aguardandoPecaStats.comErroValor > 0 && (
              <AlertItem
                type="error"
                message={`${aguardandoPecaStats.comErroValor} OS em "Aguardando Peça" com valor R$ 0,00`}
              />
            )}
            {aguardandoPecaStats.semCodigo > 0 && (
              <AlertItem
                type="error"
                message={`${aguardandoPecaStats.semCodigo} OS em "Aguardando Peça" sem código Samsung/Interna`}
              />
            )}
            {(stats.byColumn['os_nova']?.total || 0) > 50 && (
              <AlertItem
                type="warning"
                message={`${stats.byColumn['os_nova']?.total} OS novas aguardando triagem`}
              />
            )}
            {(stats.byColumn['return_handling']?.total || 0) > 20 && (
              <AlertItem
                type="warning"
                message={`${stats.byColumn['return_handling']?.total} OS em Return Handling`}
              />
            )}
            {(stats.byColumn['reparo_concluido']?.total || 0) > 30 && (
              <AlertItem
                type="info"
                message={`${stats.byColumn['reparo_concluido']?.total} OS com reparo concluído aguardando próximo passo`}
              />
            )}
            {stats.osSemValor > stats.osComValor && (
              <AlertItem
                type="warning"
                message={`${stats.osSemValor} OS sem valor cadastrado (${((stats.osSemValor / Math.max(stats.totalOS, 1)) * 100).toFixed(0)}% do total)`}
              />
            )}
          </div>
        </div>

        {/* Summary Numbers */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
          <h3 className="text-sm font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            Resumo Financeiro
          </h3>
          <div className="space-y-4">
            <SummaryRow label="Valor Total em OS" value={formatCurrency(stats.totalValor)} />
            <SummaryRow label="Valor em Ag. Peça" value={formatCurrency(stats.byColumn['aguardando_peca']?.valorTotal || 0)} />
            <SummaryRow label="Valor em Peça em Trânsito" value={formatCurrency(stats.byColumn['peca_em_transito']?.valorTotal || 0)} />
            <SummaryRow label="Valor em Rotas (IH)" value={formatCurrency(stats.byColumn['em_rota_ih']?.valorTotal || 0)} />
            <SummaryRow label="Valor em Rotas" value={formatCurrency(rotas.reduce((s, r) => s + r.valor, 0))} />
            <SummaryRow label="Ticket Médio" value={formatCurrency(stats.totalValor / Math.max(stats.osComValor, 1))} />
          </div>
        </div>
      </div>

      {/* Column Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            Todas as Etapas do Kanban
          </h3>
          <span className="text-xs text-gray-500">{columnRows.length} etapas ativas</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Etapa</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Qtd. Cards</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Card Mais Antigo</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Tempo na Etapa</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Sem Valor/Código</th>
                <th className="text-right px-6 py-3 text-xs font-semibold text-gray-600 uppercase tracking-wider">Valor Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {columnRows.map((row) => (
                <tr key={row.coluna} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-3">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full flex-shrink-0"
                        style={{ backgroundColor: COLUMN_COLORS[row.coluna] || '#6B7280' }}
                      />
                      <span className="text-sm font-medium text-gray-900">{row.label}</span>
                    </div>
                  </td>
                  <td className="text-center px-4 py-3">
                    <span className="inline-flex items-center justify-center min-w-[2rem] px-2 py-0.5 text-sm font-bold text-blue-700 bg-blue-50 rounded-full">
                      {row.total}
                    </span>
                  </td>
                  <td className="text-center px-4 py-3 text-xs text-gray-600">
                    {row.oldest ? new Date(row.oldest).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-'}
                  </td>
                  <td className="text-center px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      getTimeClass(row.oldest)
                    }`}>
                      {formatTimeAgo(row.oldest)}
                    </span>
                  </td>
                  <td className="text-center px-4 py-3">
                    {row.semValor > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded">
                        <AlertTriangle className="w-3 h-3" />
                        {row.semValor}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-400">-</span>
                    )}
                  </td>
                  <td className="text-right px-6 py-3 text-sm font-medium text-gray-900">
                    {row.valorTotal > 0 ? formatCurrency(row.valorTotal) : <span className="text-gray-400">-</span>}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 border-t border-gray-200 font-semibold">
                <td className="px-6 py-3 text-sm text-gray-700">Total</td>
                <td className="text-center px-4 py-3 text-sm text-gray-900">
                  {columnRows.reduce((s, r) => s + r.total, 0)}
                </td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3"></td>
                <td className="text-center px-4 py-3 text-sm text-red-700">
                  {columnRows.reduce((s, r) => s + r.semValor, 0)}
                </td>
                <td className="text-right px-6 py-3 text-sm text-gray-900">
                  {formatCurrency(columnRows.reduce((s, r) => s + r.valorTotal, 0))}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
}

function getTimeClass(dateStr: string): string {
  if (!dateStr) return 'text-gray-500 bg-gray-100';
  const diffHours = (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60);
  if (diffHours > 72) return 'text-red-700 bg-red-50';
  if (diffHours > 24) return 'text-amber-700 bg-amber-50';
  return 'text-green-700 bg-green-50';
}

function KPICard({
  title,
  value,
  subtitle,
  icon,
  color,
  alert,
}: {
  title: string;
  value: string;
  subtitle: string;
  icon: React.ReactNode;
  color: string;
  alert?: boolean;
}) {
  const colorMap: Record<string, { bg: string; icon: string; border: string }> = {
    blue: { bg: 'bg-blue-50', icon: 'text-blue-600', border: 'border-blue-100' },
    green: { bg: 'bg-emerald-50', icon: 'text-emerald-600', border: 'border-emerald-100' },
    amber: { bg: 'bg-amber-50', icon: 'text-amber-600', border: 'border-amber-100' },
    teal: { bg: 'bg-teal-50', icon: 'text-teal-600', border: 'border-teal-100' },
    red: { bg: 'bg-red-50', icon: 'text-red-600', border: 'border-red-100' },
    lime: { bg: 'bg-lime-50', icon: 'text-lime-600', border: 'border-lime-100' },
    cyan: { bg: 'bg-cyan-50', icon: 'text-cyan-600', border: 'border-cyan-100' },
  };
  const c = colorMap[color] || colorMap.blue;

  return (
    <div className={`bg-white rounded-xl border ${alert ? 'border-red-300 ring-1 ring-red-100' : 'border-gray-200'} p-5 shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          <p className="text-xs text-gray-500">{subtitle}</p>
        </div>
        <div className={`p-2.5 rounded-lg ${c.bg} ${c.border} border`}>
          <span className={c.icon}>{icon}</span>
        </div>
      </div>
    </div>
  );
}

function AlertItem({ type, message }: { type: 'error' | 'warning' | 'info'; message: string }) {
  const styles = {
    error: 'bg-red-50 border-red-200 text-red-800',
    warning: 'bg-amber-50 border-amber-200 text-amber-800',
    info: 'bg-blue-50 border-blue-200 text-blue-800',
  };
  const icons = {
    error: <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />,
    warning: <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />,
    info: <Activity className="w-4 h-4 text-blue-500 flex-shrink-0" />,
  };

  return (
    <div className={`flex items-center gap-3 px-4 py-3 rounded-lg border ${styles[type]}`}>
      {icons[type]}
      <span className="text-sm">{message}</span>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
      <span className="text-sm text-gray-600">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}
