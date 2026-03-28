import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { UnitFilter } from '../components/UnitFilter';
import { PerformanceDetailsModal } from '../components/PerformanceDetailsModal';
import { GoalsConfigModal } from '../components/GoalsConfigModal';
import { InfoModal } from '../components/InfoModal';
import {
  TrendingUp,
  Package,
  FileText,
  CheckCircle,
  Clock,
  AlertCircle,
  DollarSign,
  Users,
  Activity,
  Zap,
  Settings,
  Calendar,
  Filter,
  Brain
} from 'lucide-react';

interface KanbanColumnCount {
  coluna: string;
  label: string;
  count: number;
  color: string;
}

interface DashboardStats {
  totalOS: number;
  totalOSLP: number;
  totalOSOW: number;
  osAbertas: number;
  osAbertasLP: number;
  osAbertasOW: number;
  cotacoesPendentes: number;
  cotacoesAprovadas: number;
  pecasDisponiveis: number;
  agendamentos: number;
  receitaLP: number;
  receitaOW: number;
  osLPFechadas: number;
  osAtrasadas: number;
  eficienciaOperacional: number;
  taxaAprovacao: number;
  kanbanColumns: KanbanColumnCount[];
  metaReceitaLP?: number;
  metaReceitaOW?: number;
  metaEficiencia?: number;
  metaTaxaAprovacao?: number;
  metaLPContagem?: number;
}

interface PerformanceOS {
  id: string;
  numero_os: string;
  tipo_os: 'LP' | 'OW';
  cliente_nome: string;
  created_at: string;
  fechada_em: string | null;
  coluna_kanban: string;
  tempo_resolucao_dias: number;
  valor_total: number;
  status_final: 'aprovado' | 'reprovado' | 'aberto';
}

async function fetchAllPages<T>(
  buildQuery: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>
): Promise<T[]> {
  const PAGE_SIZE = 1000;
  const results: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await buildQuery(from, from + PAGE_SIZE - 1);
    if (error) { break; }
    const rows = data || [];
    results.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return results;
}

const KANBAN_LABELS: Record<string, { label: string; color: string }> = {
  os_nova: { label: 'OS Nova', color: '#0EA5E9' },
  diagnostico: { label: 'Diagnostico', color: '#8B5CF6' },
  negociacao_em_andamento: { label: 'Negociacao', color: '#F59E0B' },
  orcamento_aprovado: { label: 'Orc. Aprovado', color: '#10B981' },
  orcamentos_rejeitados: { label: 'Orc. Rejeitado', color: '#EF4444' },
  aguardando_peca: { label: 'Aguardando Peca', color: '#F97316' },
  peca_em_transito: { label: 'Peca em Transito', color: '#06B6D4' },
  peca_disponivel: { label: 'Peca Disponivel', color: '#14B8A6' },
  em_reparo: { label: 'Em Reparo', color: '#10B981' },
  em_reparo_ci: { label: 'Reparo CI', color: '#22C55E' },
  rota_azul: { label: 'Rota Azul', color: '#3B82F6' },
  rota_vermelha: { label: 'Rota Vermelha', color: '#EF4444' },
  pronto_retirada: { label: 'Pronto Retirada', color: '#059669' },
  os_fechada: { label: 'OS Fechada', color: '#6B7280' },
};

export function Dashboard() {
  const { usuario } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalOS: 0,
    totalOSLP: 0,
    totalOSOW: 0,
    osAbertas: 0,
    osAbertasLP: 0,
    osAbertasOW: 0,
    cotacoesPendentes: 0,
    cotacoesAprovadas: 0,
    pecasDisponiveis: 0,
    agendamentos: 0,
    receitaLP: 0,
    receitaOW: 0,
    osLPFechadas: 0,
    osAtrasadas: 0,
    eficienciaOperacional: 0,
    taxaAprovacao: 0,
    kanbanColumns: [],
  });
  const [loading, setLoading] = useState(true);
  const [unidades, setUnidades] = useState<Array<{id: string; nome: string}>>([]);
  const [selectedUnidade, setSelectedUnidade] = useState('');
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [performanceModalType, setPerformanceModalType] = useState<'eficiencia' | 'aprovacao'>('eficiencia');
  const [performanceOSList, setPerformanceOSList] = useState<PerformanceOS[]>([]);

  const today = new Date();
  const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const [dataInicio, setDataInicio] = useState(firstDayOfMonth.toISOString().split('T')[0]);
  const [dataFim, setDataFim] = useState(today.toISOString().split('T')[0]);

  useEffect(() => {
    loadUnidades();
  }, []);

  useEffect(() => {
    if (usuario && usuario.unidade_id && !selectedUnidade) {
      setSelectedUnidade(usuario.unidade_id);
    }
  }, [usuario]);

  useEffect(() => {
    if (usuario) {
      loadDashboardData();
    }
  }, [usuario, selectedUnidade, dataInicio, dataFim]);

  const loadUnidades = async () => {
    const { data } = await supabase.from('unidades').select('id, nome').order('nome');
    setUnidades(data || []);
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const canSeeAllUnits = (usuario?.tipo === 'master' || usuario?.tipo === 'diretoria') && !usuario?.unidade_id;
      const unidadeFilter = selectedUnidade || (canSeeAllUnits ? null : usuario?.unidade_id);

      const osList = await fetchAllPages<Record<string, unknown>>((from, to) => {
        let q = supabase
          .from('os')
          .select('id, coluna_kanban, tipo_os, valor_total, fechada_em, created_at, orcamento_aprovado, orcamento_aprovado_reprovado_em, unidade_id')
          .gte('created_at', `${dataInicio}T00:00:00`)
          .lte('created_at', `${dataFim}T23:59:59`)
          .range(from, to);
        if (unidadeFilter) q = q.eq('unidade_id', unidadeFilter);
        return q;
      }) as any[];

      const osAbertasQuery = fetchAllPages<Record<string, unknown>>((from, to) => {
        let q = supabase
          .from('os')
          .select('id, tipo_os, coluna_kanban, unidade_id')
          .neq('coluna_kanban', 'os_fechada')
          .range(from, to);
        if (unidadeFilter) q = q.eq('unidade_id', unidadeFilter);
        return q;
      });

      let totalOSQuery = supabase
        .from('os')
        .select('*', { count: 'exact', head: true });
      if (unidadeFilter) totalOSQuery = totalOSQuery.eq('unidade_id', unidadeFilter);

      const [osAbertasList, totalOSResult] = await Promise.all([
        osAbertasQuery as Promise<any[]>,
        totalOSQuery,
      ]);

      const osAbertas = osAbertasList.length;
      const osAbertasLP = osAbertasList.filter(os => os.tipo_os === 'LP').length;
      const osAbertasOW = osAbertasList.filter(os => os.tipo_os === 'OW').length;
      const totalOSCount = totalOSResult.count || 0;

      const osListLP = osList.filter(os => os.tipo_os === 'LP');
      const osListOW = osList.filter(os => os.tipo_os === 'OW');
      const receitaLP = osListLP.length;
      const osLPFechadas = osListLP.filter(os => os.coluna_kanban === 'os_fechada').length;
      const receitaOW = osListOW.reduce((sum, os) => sum + (Number(os.valor_total) || 0), 0);

      const kanbanCountMap: Record<string, number> = {};
      osList.forEach(os => {
        const col = os.coluna_kanban as string;
        if (col && col !== 'os_fechada') {
          kanbanCountMap[col] = (kanbanCountMap[col] || 0) + 1;
        }
      });
      const kanbanColumns: KanbanColumnCount[] = Object.entries(kanbanCountMap)
        .map(([coluna, count]) => ({
          coluna,
          label: KANBAN_LABELS[coluna]?.label || coluna.replace(/_/g, ' '),
          count,
          color: KANBAN_LABELS[coluna]?.color || '#6B7280',
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 8);

      const osFechadas = osList.filter(os => os.coluna_kanban === 'os_fechada');
      let totalDiasResolucao = 0;
      let countResolucao = 0;

      osFechadas.forEach(os => {
        const inicio = new Date(os.created_at);
        const fim = os.fechada_em ? new Date(os.fechada_em) : new Date();
        const dias = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
        totalDiasResolucao += dias;
        countResolucao++;
      });

      const eficienciaOperacional = countResolucao > 0 ? totalDiasResolucao / countResolucao : 0;

      const cotacoes = await fetchAllPages<Record<string, unknown>>((from, to) => {
        let q = supabase
          .from('cotacoes')
          .select('id, status, unidade_id')
          .gte('created_at', `${dataInicio}T00:00:00`)
          .lte('created_at', `${dataFim}T23:59:59`)
          .eq('tipo_os', 'OW')
          .range(from, to);
        if (unidadeFilter) q = q.eq('unidade_id', unidadeFilter);
        return q;
      }) as any[];

      const cotacoesAprovadas = cotacoes.filter(c => c.status === 'aprovada');
      const cotacoesReprovadas = cotacoes.filter(c => c.status === 'reprovada' || c.status === 'reprovada_refeita');

      const osOWAprovadas = osList.filter(os => os.tipo_os === 'OW' && os.orcamento_aprovado === true);
      const osOWReprovadas = osList.filter(os => os.tipo_os === 'OW' && os.orcamento_aprovado_reprovado_em !== null && os.orcamento_aprovado !== true);

      const totalOrcamentosFinalizados = cotacoesAprovadas.length + cotacoesReprovadas.length + osOWAprovadas.length + osOWReprovadas.length;
      const totalAprovados = cotacoesAprovadas.length + osOWAprovadas.length;

      const taxaAprovacao = totalOrcamentosFinalizados > 0
        ? (totalAprovados / totalOrcamentosFinalizados) * 100
        : 0;

      let cotacoesPendentesQuery = supabase
        .from('cotacoes')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${dataInicio}T00:00:00`)
        .lte('created_at', `${dataFim}T23:59:59`)
        .in('status', ['pendente_preenchimento', 'enviada']);

      if (unidadeFilter) {
        cotacoesPendentesQuery = cotacoesPendentesQuery.eq('unidade_id', unidadeFilter);
      }

      let cotacoesAprovadasQuery = supabase
        .from('cotacoes')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${dataInicio}T00:00:00`)
        .lte('created_at', `${dataFim}T23:59:59`)
        .eq('status', 'aprovada');

      if (unidadeFilter) {
        cotacoesAprovadasQuery = cotacoesAprovadasQuery.eq('unidade_id', unidadeFilter);
      }

      let pecasQuery = supabase
        .from('estoque_pecas')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'disponivel');

      if (unidadeFilter) {
        pecasQuery = pecasQuery.eq('unidade_id', unidadeFilter);
      }

      let agendamentosQuery = supabase
        .from('os')
        .select('*', { count: 'exact', head: true })
        .gte('data_agendamento', dataInicio)
        .lte('data_agendamento', dataFim)
        .neq('coluna_kanban', 'os_fechada')
        .not('data_agendamento', 'is', null);

      if (unidadeFilter) {
        agendamentosQuery = agendamentosQuery.eq('unidade_id', unidadeFilter);
      }

      const mesAtual = new Date();
      let metasQuery = { data: null as any };
      let metaLPQuery = { data: null as any };
      if (unidadeFilter) {
        metasQuery = await supabase
          .from('metas_performance')
          .select('*')
          .eq('unidade_id', unidadeFilter)
          .eq('ano', mesAtual.getFullYear())
          .eq('mes', mesAtual.getMonth() + 1)
          .maybeSingle();

        const mesRef = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 1).toISOString().split('T')[0];
        metaLPQuery = await supabase
          .from('skywalker_lp_unidade')
          .select('meta_lp, realizado_lp')
          .eq('unidade_id', unidadeFilter)
          .eq('mes_referencia', mesRef)
          .maybeSingle();
      }

      const [
        cotacoesPendentesResult,
        cotacoesAprovadasResult,
        pecasResult,
        agendamentosResult
      ] = await Promise.all([
        cotacoesPendentesQuery,
        cotacoesAprovadasQuery,
        pecasQuery,
        agendamentosQuery
      ]);

      const metas = metasQuery.data;
      const metaLP = metaLPQuery.data;

      setStats({
        totalOS: totalOSCount,
        totalOSLP: osListLP.length,
        totalOSOW: osListOW.length,
        osAbertas,
        osAbertasLP,
        osAbertasOW,
        cotacoesPendentes: cotacoesPendentesResult.count || 0,
        cotacoesAprovadas: cotacoesAprovadasResult.count || 0,
        pecasDisponiveis: pecasResult.count || 0,
        agendamentos: agendamentosResult.count || 0,
        receitaLP,
        receitaOW,
        osLPFechadas,
        osAtrasadas: 0,
        eficienciaOperacional,
        taxaAprovacao,
        kanbanColumns,
        metaReceitaLP: metas ? Number(metas.meta_receita_lp) : undefined,
        metaReceitaOW: metas ? Number(metas.meta_receita_ow) : undefined,
        metaEficiencia: metas ? Number(metas.meta_eficiencia_operacional) : undefined,
        metaTaxaAprovacao: metas ? Number(metas.meta_taxa_aprovacao) : undefined,
        metaLPContagem: metaLP ? Number(metaLP.meta_lp) : undefined,
      });
    } catch (error) {
      // ignored
    } finally {
      setLoading(false);
    }
  };

  const loadPerformanceDetails = async (type: 'eficiencia' | 'aprovacao') => {
    try {
      const canSeeAllUnits = (usuario?.tipo === 'master' || usuario?.tipo === 'diretoria') && !usuario?.unidade_id;
      const unidadeFilter = selectedUnidade || (canSeeAllUnits ? null : usuario?.unidade_id);

      if (type === 'aprovacao') {
        let cotacoesQuery = supabase
          .from('cotacoes')
          .select('*')
          .gte('created_at', `${dataInicio}T00:00:00`)
          .lte('created_at', `${dataFim}T23:59:59`)
          .eq('tipo_os', 'OW')
          .in('status', ['aprovada', 'reprovada', 'reprovada_refeita']);

        if (unidadeFilter) {
          cotacoesQuery = cotacoesQuery.eq('unidade_id', unidadeFilter);
        }

        const { data: cotacoesData } = await cotacoesQuery;
        const cotacoesList = cotacoesData || [];

        let osQuery = supabase
          .from('os')
          .select('*')
          .gte('created_at', `${dataInicio}T00:00:00`)
          .lte('created_at', `${dataFim}T23:59:59`)
          .eq('tipo_os', 'OW')
          .not('orcamento_aprovado_em', 'is', null);

        if (unidadeFilter) {
          osQuery = osQuery.eq('unidade_id', unidadeFilter);
        }

        const { data: osData } = await osQuery;
        const osOWList = osData || [];

        const performanceListCotacoes: PerformanceOS[] = cotacoesList.map(cotacao => {
          const inicio = new Date(cotacao.created_at);
          const fim = cotacao.aprovada_em
            ? new Date(cotacao.aprovada_em)
            : cotacao.reprovada_em
            ? new Date(cotacao.reprovada_em)
            : new Date();
          const dias = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));

          let status_final: 'aprovado' | 'reprovado' | 'aberto' = 'aberto';
          if (cotacao.status === 'aprovada') {
            status_final = 'aprovado';
          } else if (cotacao.status === 'reprovada' || cotacao.status === 'reprovada_refeita') {
            status_final = 'reprovado';
          }

          return {
            id: cotacao.id,
            numero_os: `Cotacao #${cotacao.numero_cotacao}`,
            tipo_os: cotacao.tipo_os,
            cliente_nome: cotacao.cliente_nome || 'Cliente nao informado',
            created_at: cotacao.created_at,
            fechada_em: cotacao.aprovada_em || cotacao.reprovada_em,
            coluna_kanban: cotacao.status,
            tempo_resolucao_dias: dias,
            valor_total: 0,
            status_final
          };
        });

        const performanceListOS: PerformanceOS[] = osOWList.map(os => {
          const inicio = new Date(os.created_at);
          const fim = os.orcamento_aprovado_em
            ? new Date(os.orcamento_aprovado_em)
            : os.orcamento_aprovado_reprovado_em
            ? new Date(os.orcamento_aprovado_reprovado_em)
            : new Date();
          const dias = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));

          let status_final: 'aprovado' | 'reprovado' | 'aberto' = 'aberto';
          if (os.orcamento_aprovado === true) {
            status_final = 'aprovado';
          } else if (os.orcamento_aprovado_reprovado_em !== null && os.orcamento_aprovado !== true) {
            status_final = 'reprovado';
          }

          return {
            id: os.id,
            numero_os: os.numero_os_samsung || os.numero_os_interna || 'S/N',
            tipo_os: os.tipo_os,
            cliente_nome: os.cliente_nome || 'Cliente nao informado',
            created_at: os.created_at,
            fechada_em: os.orcamento_aprovado_em || os.orcamento_aprovado_reprovado_em,
            coluna_kanban: os.coluna_kanban,
            tempo_resolucao_dias: dias,
            valor_total: os.valor_total || 0,
            status_final
          };
        });

        setPerformanceOSList([...performanceListCotacoes, ...performanceListOS]);
      } else {
        let query = supabase
          .from('os')
          .select('*')
          .gte('created_at', `${dataInicio}T00:00:00`)
          .lte('created_at', `${dataFim}T23:59:59`);

        if (unidadeFilter) {
          query = query.eq('unidade_id', unidadeFilter);
        }

        const { data: osData } = await query;
        const osList = osData || [];

        const performanceList: PerformanceOS[] = osList.map(os => {
          const inicio = new Date(os.created_at);
          const fim = os.fechada_em ? new Date(os.fechada_em) : new Date();
          const dias = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));

          let status_final: 'aprovado' | 'reprovado' | 'aberto' = 'aberto';
          if (os.coluna_kanban === 'os_fechada') {
            status_final = os.status_final === 'reprovada' ? 'reprovado' : 'aprovado';
          }

          return {
            id: os.id,
            numero_os: os.numero_os || os.numero_os_samsung || 'S/N',
            tipo_os: os.tipo_os,
            cliente_nome: os.cliente_nome || 'Cliente nao informado',
            created_at: os.created_at,
            fechada_em: os.fechada_em,
            coluna_kanban: os.coluna_kanban,
            tempo_resolucao_dias: dias,
            valor_total: os.valor_total || 0,
            status_final
          };
        });

        setPerformanceOSList(performanceList);
      }

      setPerformanceModalType(type);
      setShowPerformanceModal(true);
    } catch (error) {
    }
  };

  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDateLabel = () => {
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    const formatOptions: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', year: 'numeric' };
    return `${inicio.toLocaleDateString('pt-BR', formatOptions)} - ${fim.toLocaleDateString('pt-BR', formatOptions)}`;
  };

  const statCards = [
    { title: 'Total de OS', value: stats.totalOS, icon: FileText, color: '#0EA5E9', hasGoal: false },
    { title: 'OS Abertas', value: stats.osAbertas, icon: Activity, color: '#3B82F6', hasGoal: false },
    { title: 'Cotacoes Pendentes', value: stats.cotacoesPendentes, icon: Clock, color: '#F59E0B', hasGoal: false },
    { title: 'Cotacoes Aprovadas', value: stats.cotacoesAprovadas, icon: CheckCircle, color: '#10B981', hasGoal: false },
    { title: 'Pecas Disponiveis', value: stats.pecasDisponiveis, icon: Package, color: '#06B6D4', hasGoal: false },
    { title: 'Agendamentos', value: stats.agendamentos, icon: Users, color: '#0EA5E9', hasGoal: false },
    { title: 'Receita LP', value: stats.receitaLP, subtitle: `${stats.osLPFechadas} fechadas no periodo`, icon: DollarSign, color: '#10B981', hasGoal: true, goal: stats.metaLPContagem, isCount: true, onClick: () => {
      const unidadeId = selectedUnidade || usuario?.unidade_id;
      if (!unidadeId) {
        setShowInfoModal(true);
        return;
      }
      setShowGoalsModal(true);
    } },
    { title: 'Receita OW', value: formatCurrency(stats.receitaOW), subtitle: `${stats.totalOSOW} OS no periodo`, icon: DollarSign, color: '#0EA5E9', hasGoal: true, goal: stats.metaReceitaOW, onClick: () => {
      const unidadeId = selectedUnidade || usuario?.unidade_id;
      if (!unidadeId) {
        setShowInfoModal(true);
        return;
      }
      setShowGoalsModal(true);
    } },
    { title: 'OS com Alerta', value: stats.osAtrasadas, icon: AlertCircle, color: '#EF4444', hasGoal: false }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="futuristic-loader"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <UnitFilter
        unidades={unidades}
        selectedUnidade={selectedUnidade}
        onUnidadeChange={setSelectedUnidade}
      />

      <div className="flex items-center gap-4 p-4 rounded-xl" style={{
        background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.08) 0%, var(--card-gradient-end) 100%)',
        border: '1px solid rgba(var(--accent-rgb),0.3)'
      }}>
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-cyan-400" />
          <span className="text-gray-400 text-sm font-medium">Periodo:</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="px-3 py-2 bg-gray-800/80 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
            />
          </div>
          <span className="text-gray-500">até</span>
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-gray-500" />
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="px-3 py-2 bg-gray-800/80 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
            />
          </div>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <div className="px-3 py-1.5 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
            <span className="text-cyan-400 text-sm font-medium">{formatDateLabel()}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;

          const calculateProgress = () => {
            if (stat.hasGoal && stat.goal && stat.goal > 0) {
              const numValue = typeof stat.value === 'string'
                ? parseFloat(stat.value.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0
                : (stat.value as number);
              return Math.min(100, (numValue / stat.goal) * 100);
            }

            if (stat.hasGoal && (!stat.goal || stat.goal === 0)) {
              const numValue = typeof stat.value === 'string'
                ? parseFloat(stat.value.replace('R$', '').replace(/\./g, '').replace(',', '.').trim()) || 0
                : (stat.value as number);
              if (numValue <= 0) return 0;
              return 40;
            }

            const numValue = typeof stat.value === 'number' ? stat.value : 0;
            if (numValue <= 0) return 0;
            const allNumericValues = statCards
              .filter(s => !s.hasGoal && typeof s.value === 'number')
              .map(s => s.value as number);
            const maxValue = Math.max(...allNumericValues, 1);
            return Math.min(100, (numValue / maxValue) * 100);
          };

          return (
            <div
              key={index}
              className="rounded-xl p-4 group relative overflow-hidden transition-all duration-300"
              style={{
                background: `linear-gradient(135deg, ${stat.color}08 0%, var(--card-gradient-end) 100%)`,
                border: `1px solid ${stat.color}30`,
                boxShadow: `0 2px 10px var(--shadow-primary), inset 0 1px 1px var(--card-inset-glow)`,
                animationDelay: `${index * 50}ms`,
                cursor: stat.hasGoal ? 'pointer' : 'default'
              }}
              onClick={stat.onClick}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${stat.color}60`;
                e.currentTarget.style.boxShadow = `0 4px 20px ${stat.color}30, inset 0 1px 1px var(--subtle-border)`;
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = `${stat.color}30`;
                e.currentTarget.style.boxShadow = `0 2px 10px var(--shadow-primary), inset 0 1px 1px var(--card-inset-glow)`;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div className="absolute top-0 left-0 w-full h-0.5" style={{
                background: `linear-gradient(90deg, ${stat.color} 0%, transparent 100%)`,
                opacity: 0.4
              }}></div>

              <div className="flex items-start justify-between mb-3">
                <div className="p-2 rounded-lg" style={{
                  background: `linear-gradient(135deg, ${stat.color}15 0%, ${stat.color}08 100%)`,
                  border: `1px solid ${stat.color}30`,
                  boxShadow: `0 0 8px ${stat.color}15`
                }}>
                  <Icon
                    className="w-4 h-4"
                    style={{ color: stat.color }}
                  />
                </div>
                {stat.hasGoal && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      const unidadeId = selectedUnidade || usuario?.unidade_id;
                      if (!unidadeId) {
                        setShowInfoModal(true);
                        return;
                      }
                      setShowGoalsModal(true);
                    }}
                    className="p-1 rounded transition-all duration-200"
                    style={{
                      background: 'var(--card-inset-glow)',
                      border: '1px solid var(--subtle-border)'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = 'var(--subtle-border)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'var(--card-inset-glow)';
                    }}
                  >
                    <Settings className="w-3 h-3 text-gray-400" />
                  </button>
                )}
              </div>

              <h4 className="text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-widest">
                {stat.title}
              </h4>

              <p
                className="text-xl font-bold tracking-tight mb-1"
                style={{ color: stat.color }}
              >
                {stat.value}
              </p>

              {'subtitle' in stat && stat.subtitle && (
                <p className="text-[10px] font-medium mb-1" style={{ color: `${stat.color}99` }}>
                  {stat.subtitle}
                </p>
              )}

              {stat.hasGoal && stat.goal && (
                <p className="text-[10px] text-gray-500 mb-2">
                  {'isCount' in stat && stat.isCount ? `Meta: ${stat.goal} OS` : `Meta: ${formatCurrency(stat.goal)}`}
                </p>
              )}

              <div className="h-1 bg-[var(--progress-track)] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${calculateProgress()}%`,
                    background: `linear-gradient(90deg, ${stat.color} 0%, ${stat.color}90 100%)`,
                    boxShadow: `0 0 6px ${stat.color}40`
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <div className="rounded-xl p-4 relative overflow-hidden transition-all duration-300"
          style={{
            background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.08) 0%, var(--card-gradient-end) 100%)',
            border: '1px solid rgba(var(--accent-rgb),0.3)',
            boxShadow: '0 2px 10px var(--shadow-primary), inset 0 1px 1px var(--card-inset-glow)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(var(--accent-rgb),0.6)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(var(--accent-rgb),0.3), inset 0 1px 1px var(--subtle-border)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(var(--accent-rgb),0.3)';
            e.currentTarget.style.boxShadow = '0 2px 10px var(--shadow-primary), inset 0 1px 1px var(--card-inset-glow)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div className="absolute top-0 left-0 w-full h-0.5" style={{
            background: 'linear-gradient(90deg, #0EA5E9 0%, transparent 100%)',
            opacity: 0.4
          }}></div>

          <div className="flex items-center gap-2 mb-4 px-2 py-1.5 rounded-lg w-fit" style={{
            background: 'linear-gradient(90deg, rgba(14,165,233,0.1) 0%, transparent 100%)',
            border: '1px solid rgba(14,165,233,0.25)'
          }}>
            <Zap className="w-4 h-4 text-[#0EA5E9]" />
            <h4 className="tech-heading text-xs text-[#0EA5E9] tracking-widest">FLUXO KANBAN</h4>
          </div>

          <div className="space-y-2">
            {stats.kanbanColumns.length > 0 ? stats.kanbanColumns.map((col) => (
              <div key={col.coluna} className="flex items-center justify-between p-2.5 rounded-lg"
                style={{
                  background: `linear-gradient(135deg, ${col.color}14 0%, ${col.color}04 100%)`,
                  border: `1px solid ${col.color}33`,
                  boxShadow: `0 0 6px ${col.color}14`
                }}
              >
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color, boxShadow: `0 0 4px ${col.color}66` }} />
                  <span className="text-xs font-medium text-gray-300">{col.label}</span>
                </div>
                <span className="text-sm font-bold" style={{ color: col.color }}>
                  {col.count}
                </span>
              </div>
            )) : (
              <p className="text-xs text-gray-500 text-center py-4">Nenhuma OS aberta no periodo</p>
            )}
          </div>
        </div>

        <div className="rounded-xl p-4 relative overflow-hidden transition-all duration-300"
          style={{
            background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.08) 0%, var(--card-gradient-end) 100%)',
            border: '1px solid rgba(var(--accent-rgb),0.3)',
            boxShadow: '0 2px 10px var(--shadow-primary), inset 0 1px 1px var(--card-inset-glow)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(var(--accent-rgb),0.6)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(var(--accent-rgb),0.3), inset 0 1px 1px var(--subtle-border)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(var(--accent-rgb),0.3)';
            e.currentTarget.style.boxShadow = '0 2px 10px var(--shadow-primary), inset 0 1px 1px var(--card-inset-glow)';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          <div className="absolute top-0 left-0 w-full h-0.5" style={{
            background: 'linear-gradient(90deg, #06B6D4 0%, transparent 100%)',
            opacity: 0.4
          }}></div>

          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2 px-2 py-1.5 rounded-lg w-fit" style={{
              background: 'linear-gradient(90deg, rgba(6,182,212,0.1) 0%, transparent 100%)',
              border: '1px solid rgba(6,182,212,0.25)'
            }}>
              <Activity className="w-4 h-4 text-[#06B6D4]" />
              <h4 className="tech-heading text-xs text-[#06B6D4] tracking-widest">PERFORMANCE</h4>
            </div>
            <button
              onClick={() => {
                const unidadeId = selectedUnidade || usuario?.unidade_id;
                if (!unidadeId) {
                  setShowInfoModal(true);
                  return;
                }
                setShowGoalsModal(true);
              }}
              className="p-1.5 rounded transition-all duration-200"
              style={{
                background: 'var(--card-inset-glow)',
                border: '1px solid var(--subtle-border)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--subtle-border)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--card-inset-glow)';
              }}
            >
              <Settings className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          <div className="space-y-3">
            <div
              className="cursor-pointer transition-all duration-200 p-2 rounded-lg"
              onClick={() => loadPerformanceDetails('aprovacao')}
              style={{ background: 'var(--bg-secondary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(16,185,129,0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-secondary)';
              }}
            >
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--text-secondary)' }}>Taxa de Aprovacao</span>
                <span className="text-xs text-[#10B981] font-bold">{stats.taxaAprovacao.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 bg-[var(--progress-track)] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000" style={{
                  width: `${Math.min(100, stats.taxaAprovacao)}%`,
                  background: 'linear-gradient(90deg, #10B981 0%, #06B6D4 100%)',
                  boxShadow: '0 0 8px rgba(16,185,129,0.4)'
                }} />
              </div>
              {stats.metaTaxaAprovacao && (
                <p className="text-[9px] mt-1" style={{ color: 'var(--text-secondary)' }}>Meta: {stats.metaTaxaAprovacao.toFixed(1)}%</p>
              )}
            </div>

            <div
              className="cursor-pointer transition-all duration-200 p-2 rounded-lg"
              onClick={() => loadPerformanceDetails('eficiencia')}
              style={{ background: 'var(--bg-secondary)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(14,165,233,0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'var(--bg-secondary)';
              }}
            >
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: 'var(--text-secondary)' }}>Eficiencia Operacional</span>
                <span className="text-xs text-[#0EA5E9] font-bold">{stats.eficienciaOperacional.toFixed(1)} dias</span>
              </div>
              <div className="h-1.5 bg-[var(--progress-track)] rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000" style={{
                  width: stats.eficienciaOperacional === 0
                    ? '0%'
                    : stats.metaEficiencia && stats.metaEficiencia > 0
                      ? `${Math.min(100, (stats.metaEficiencia / Math.max(stats.eficienciaOperacional, 0.1)) * 100)}%`
                      : `${Math.min(100, Math.max(10, 100 - (stats.eficienciaOperacional / 30) * 100))}%`,
                  background: 'linear-gradient(90deg, #0EA5E9 0%, #3B82F6 100%)',
                  boxShadow: '0 0 8px rgba(14,165,233,0.4)'
                }} />
              </div>
              {stats.metaEficiencia && (
                <p className="text-[9px] mt-1" style={{ color: 'var(--text-secondary)' }}>Meta: {stats.metaEficiencia.toFixed(1)} dias</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <PerformanceDetailsModal
        isOpen={showPerformanceModal}
        onClose={() => setShowPerformanceModal(false)}
        metric={performanceModalType}
        title={performanceModalType === 'eficiencia' ? 'Eficiencia Operacional' : 'Taxa de Aprovacao'}
        osList={performanceOSList}
        targetValue={performanceModalType === 'eficiencia' ? stats.metaEficiencia : stats.metaTaxaAprovacao}
        currentValue={performanceModalType === 'eficiencia' ? stats.eficienciaOperacional : stats.taxaAprovacao}
      />

      {(selectedUnidade || usuario?.unidade_id) && (
        <GoalsConfigModal
          isOpen={showGoalsModal}
          onClose={() => setShowGoalsModal(false)}
          unidadeId={selectedUnidade || usuario?.unidade_id!}
          onSaved={() => {
            loadDashboardData();
          }}
        />
      )}

      <InfoModal
        isOpen={showInfoModal}
        onClose={() => setShowInfoModal(false)}
        title="Selecione uma Unidade"
        message="Para configurar as metas de performance, é necessário selecionar uma unidade específica. Por favor, utilize o filtro de unidades no topo da página."
      />

    </div>
  );
}
