import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { UnitFilter } from '../components/UnitFilter';
import { PerformanceDetailsModal } from '../components/PerformanceDetailsModal';
import { GoalsConfigModal } from '../components/GoalsConfigModal';
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
  Settings
} from 'lucide-react';

interface DashboardStats {
  totalOS: number;
  osAbertas: number;
  cotacoesPendentes: number;
  cotacoesAprovadas: number;
  pecasEstoque: number;
  agendamentosHoje: number;
  receitaMesLP: number;
  receitaMesOW: number;
  osAtrasadas: number;
  eficienciaOperacional: number;
  taxaAprovacao: number;
  metaReceitaLP?: number;
  metaReceitaOW?: number;
  metaEficiencia?: number;
  metaTaxaAprovacao?: number;
  trendOSAbertas: number;
  trendCotacoesPendentes: number;
  trendCotacoesAprovadas: number;
  trendPecasEstoque: number;
  trendAgendamentos: number;
  trendReceitaLP: number;
  trendReceitaOW: number;
  trendOSAtrasadas: number;
}

interface PerformanceOS {
  id: string;
  numero_os: string;
  tipo_os: 'LP' | 'OW';
  cliente_nome: string;
  created_at: string;
  data_fechamento: string | null;
  coluna_kanban: string;
  tempo_resolucao_dias: number;
  valor_total: number;
  status_final: 'aprovado' | 'reprovado' | 'aberto';
}

export function Dashboard() {
  const { user } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    totalOS: 0,
    osAbertas: 0,
    cotacoesPendentes: 0,
    cotacoesAprovadas: 0,
    pecasEstoque: 0,
    agendamentosHoje: 0,
    receitaMesLP: 0,
    receitaMesOW: 0,
    osAtrasadas: 0,
    eficienciaOperacional: 0,
    taxaAprovacao: 0,
    trendOSAbertas: 0,
    trendCotacoesPendentes: 0,
    trendCotacoesAprovadas: 0,
    trendPecasEstoque: 0,
    trendAgendamentos: 0,
    trendReceitaLP: 0,
    trendReceitaOW: 0,
    trendOSAtrasadas: 0,
  });
  const [loading, setLoading] = useState(true);
  const [unidades, setUnidades] = useState<Array<{id: string; nome: string}>>([]);
  const [selectedUnidade, setSelectedUnidade] = useState('');
  const [showGoalsModal, setShowGoalsModal] = useState(false);
  const [showPerformanceModal, setShowPerformanceModal] = useState(false);
  const [performanceModalType, setPerformanceModalType] = useState<'eficiencia' | 'aprovacao'>('eficiencia');
  const [performanceOSList, setPerformanceOSList] = useState<PerformanceOS[]>([]);

  useEffect(() => {
    loadUnidades();
  }, []);

  useEffect(() => {
    if (user) {
      if (user.unidade_id) {
        setSelectedUnidade(user.unidade_id);
      }
      loadDashboardData();
    }
  }, [user, selectedUnidade]);

  const loadUnidades = async () => {
    const { data } = await supabase.from('unidades').select('id, nome').order('nome');
    setUnidades(data || []);
  };

  const loadDashboardData = async () => {
    try {
      const unidadeFilter = selectedUnidade || (user?.unidade_id || null);
      const canSeeAllUnits = (user?.tipo === 'master' || user?.tipo === 'diretoria') && !user?.unidade_id;

      const buildQuery = (table: string) => {
        let query = supabase.from(table).select('*', { count: 'exact', head: true });
        if (!canSeeAllUnits && unidadeFilter) {
          query = query.eq('unidade_id', unidadeFilter);
        } else if (selectedUnidade) {
          query = query.eq('unidade_id', selectedUnidade);
        }
        return query;
      };

      const hoje = new Date().toISOString().split('T')[0];
      const mesAtual = new Date();
      const mesAnterior = new Date(mesAtual.getFullYear(), mesAtual.getMonth() - 1, 1);
      const inicioMesAtual = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 1).toISOString().split('T')[0];
      const inicioMesAnterior = new Date(mesAnterior.getFullYear(), mesAnterior.getMonth(), 1).toISOString().split('T')[0];
      const fimMesAnterior = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 0).toISOString().split('T')[0];

      let osQueryAtual = supabase.from('os').select('*').gte('created_at', inicioMesAtual);
      let osQueryAnterior = supabase.from('os').select('*').gte('created_at', inicioMesAnterior).lte('created_at', fimMesAnterior);

      if (!canSeeAllUnits && unidadeFilter) {
        osQueryAtual = osQueryAtual.eq('unidade_id', unidadeFilter);
        osQueryAnterior = osQueryAnterior.eq('unidade_id', unidadeFilter);
      } else if (selectedUnidade) {
        osQueryAtual = osQueryAtual.eq('unidade_id', selectedUnidade);
        osQueryAnterior = osQueryAnterior.eq('unidade_id', selectedUnidade);
      }

      const [osAtualData, osAnteriorData] = await Promise.all([
        osQueryAtual,
        osQueryAnterior
      ]);

      const osAtual = osAtualData.data || [];
      const osAnterior = osAnteriorData.data || [];

      const osAbertasAtual = osAtual.filter(os => os.coluna_kanban !== 'os_fechada').length;
      const osAbertasAnterior = osAnterior.filter(os => os.coluna_kanban !== 'os_fechada').length;

      const receitaLPAtual = osAtual.filter(os => os.tipo_os === 'LP').reduce((sum, os) => sum + (os.valor_total || 0), 0);
      const receitaOWAtual = osAtual.filter(os => os.tipo_os === 'OW').reduce((sum, os) => sum + (os.valor_total || 0), 0);
      const receitaLPAnterior = osAnterior.filter(os => os.tipo_os === 'LP').reduce((sum, os) => sum + (os.valor_total || 0), 0);
      const receitaOWAnterior = osAnterior.filter(os => os.tipo_os === 'OW').reduce((sum, os) => sum + (os.valor_total || 0), 0);

      const osFechadasAtual = osAtual.filter(os => os.coluna_kanban === 'os_fechada');
      let totalDiasResolucao = 0;
      let countResolucao = 0;

      osFechadasAtual.forEach(os => {
        const inicio = new Date(os.created_at);
        const fim = os.data_fechamento ? new Date(os.data_fechamento) : new Date();
        const dias = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));
        totalDiasResolucao += dias;
        countResolucao++;
      });

      const eficienciaOperacional = countResolucao > 0 ? totalDiasResolucao / countResolucao : 0;

      let cotacoesQueryAtual = supabase.from('cotacoes').select('*').gte('created_at', inicioMesAtual).eq('tipo_os', 'OW');
      if (!canSeeAllUnits && unidadeFilter) {
        cotacoesQueryAtual = cotacoesQueryAtual.eq('unidade_id', unidadeFilter);
      } else if (selectedUnidade) {
        cotacoesQueryAtual = cotacoesQueryAtual.eq('unidade_id', selectedUnidade);
      }

      const cotacoesData = await cotacoesQueryAtual;
      const cotacoes = cotacoesData.data || [];

      const cotacoesAprovadas = cotacoes.filter(c => c.status === 'aprovada');
      const cotacoesReprovadas = cotacoes.filter(c => c.status === 'reprovada' || c.status === 'reprovada_refeita');
      const totalOrcamentosFinalizados = cotacoesAprovadas.length + cotacoesReprovadas.length;

      const taxaAprovacao = totalOrcamentosFinalizados > 0
        ? (cotacoesAprovadas.length / totalOrcamentosFinalizados) * 100
        : 0;

      const [
        cotacoesPendentesResult,
        cotacoesAprovadasResult,
        pecasResult,
        agendamentosResult,
        metasResult
      ] = await Promise.all([
        buildQuery('cotacoes').in('status', ['pendente_preenchimento', 'enviada']),
        buildQuery('cotacoes').eq('status', 'aprovada'),
        buildQuery('estoque_pecas').eq('status', 'disponivel'),
        buildQuery('os').eq('data_agendamento', hoje).neq('coluna_kanban', 'os_fechada'),
        (async () => {
          if (!unidadeFilter) return { data: null };
          return await supabase
            .from('metas_performance')
            .select('*')
            .eq('unidade_id', unidadeFilter)
            .eq('ano', mesAtual.getFullYear())
            .eq('mes', mesAtual.getMonth() + 1)
            .maybeSingle();
        })()
      ]);

      const metas = metasResult.data;

      const calcularTrend = (atual: number, anterior: number) => {
        if (anterior === 0) return 0;
        return ((atual - anterior) / anterior) * 100;
      };

      setStats({
        totalOS: osAtual.length,
        osAbertas: osAbertasAtual,
        cotacoesPendentes: cotacoesPendentesResult.count || 0,
        cotacoesAprovadas: cotacoesAprovadasResult.count || 0,
        pecasEstoque: pecasResult.count || 0,
        agendamentosHoje: agendamentosResult.count || 0,
        receitaMesLP: receitaLPAtual,
        receitaMesOW: receitaOWAtual,
        osAtrasadas: 0,
        eficienciaOperacional,
        taxaAprovacao,
        metaReceitaLP: metas ? Number(metas.meta_receita_lp) : undefined,
        metaReceitaOW: metas ? Number(metas.meta_receita_ow) : undefined,
        metaEficiencia: metas ? Number(metas.meta_eficiencia_operacional) : undefined,
        metaTaxaAprovacao: metas ? Number(metas.meta_taxa_aprovacao) : undefined,
        trendOSAbertas: calcularTrend(osAbertasAtual, osAbertasAnterior),
        trendCotacoesPendentes: 0,
        trendCotacoesAprovadas: 0,
        trendPecasEstoque: 0,
        trendAgendamentos: 0,
        trendReceitaLP: calcularTrend(receitaLPAtual, receitaLPAnterior),
        trendReceitaOW: calcularTrend(receitaOWAtual, receitaOWAnterior),
        trendOSAtrasadas: 0,
      });
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadPerformanceDetails = async (type: 'eficiencia' | 'aprovacao') => {
    try {
      const unidadeFilter = selectedUnidade || (user?.unidade_id || null);
      const canSeeAllUnits = (user?.tipo === 'master' || user?.tipo === 'diretoria') && !user?.unidade_id;

      const mesAtual = new Date();
      const inicioMesAtual = new Date(mesAtual.getFullYear(), mesAtual.getMonth(), 1).toISOString().split('T')[0];

      if (type === 'aprovacao') {
        let cotacoesQuery = supabase
          .from('cotacoes')
          .select('*')
          .gte('created_at', inicioMesAtual)
          .eq('tipo_os', 'OW')
          .in('status', ['aprovada', 'reprovada', 'reprovada_refeita']);

        if (!canSeeAllUnits && unidadeFilter) {
          cotacoesQuery = cotacoesQuery.eq('unidade_id', unidadeFilter);
        } else if (selectedUnidade) {
          cotacoesQuery = cotacoesQuery.eq('unidade_id', selectedUnidade);
        }

        const { data: cotacoesData } = await cotacoesQuery;
        const cotacoesList = cotacoesData || [];

        const performanceList: PerformanceOS[] = cotacoessList.map(cotacao => {
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
            numero_os: cotacao.numero_cotacao,
            tipo_os: cotacao.tipo_os,
            cliente_nome: cotacao.cliente_nome || 'Cliente não informado',
            created_at: cotacao.created_at,
            data_fechamento: cotacao.aprovada_em || cotacao.reprovada_em,
            coluna_kanban: cotacao.status,
            tempo_resolucao_dias: dias,
            valor_total: 0,
            status_final
          };
        });

        setPerformanceOSList(performanceList);
      } else {
        let query = supabase.from('os').select('*').gte('created_at', inicioMesAtual);

        if (!canSeeAllUnits && unidadeFilter) {
          query = query.eq('unidade_id', unidadeFilter);
        } else if (selectedUnidade) {
          query = query.eq('unidade_id', selectedUnidade);
        }

        const { data: osData } = await query;
        const osList = osData || [];

        const performanceList: PerformanceOS[] = osList.map(os => {
          const inicio = new Date(os.created_at);
          const fim = os.data_fechamento ? new Date(os.data_fechamento) : new Date();
          const dias = Math.ceil((fim.getTime() - inicio.getTime()) / (1000 * 60 * 60 * 24));

          let status_final: 'aprovado' | 'reprovado' | 'aberto' = 'aberto';
          if (os.coluna_kanban === 'os_fechada') {
            status_final = os.status_final === 'reprovada' ? 'reprovado' : 'aprovado';
          }

          return {
            id: os.id,
            numero_os: os.numero_os || os.numero_os_samsung || 'S/N',
            tipo_os: os.tipo_os,
            cliente_nome: os.cliente_nome || 'Cliente não informado',
            created_at: os.created_at,
            data_fechamento: os.data_fechamento,
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
      console.error('Error loading performance details:', error);
    }
  };

  const formatTrend = (value: number) => {
    if (value === 0) return '0%';
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)}%`;
  };

  const formatCurrency = (value: number) => {
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const statCards = [
    { title: 'OS Abertas', value: stats.osAbertas, icon: FileText, color: '#0EA5E9', trend: formatTrend(stats.trendOSAbertas), hasGoal: false },
    { title: 'Cotações Pendentes', value: stats.cotacoesPendentes, icon: Clock, color: '#F59E0B', trend: formatTrend(stats.trendCotacoesPendentes), hasGoal: false },
    { title: 'Cotações Aprovadas', value: stats.cotacoesAprovadas, icon: CheckCircle, color: '#10B981', trend: formatTrend(stats.trendCotacoesAprovadas), hasGoal: false },
    { title: 'Peças Disponíveis', value: stats.pecasEstoque, icon: Package, color: '#06B6D4', trend: formatTrend(stats.trendPecasEstoque), hasGoal: false },
    { title: 'Agendamentos Hoje', value: stats.agendamentosHoje, icon: Users, color: '#0EA5E9', trend: formatTrend(stats.trendAgendamentos), hasGoal: false },
    { title: 'Receita do Mês LP', value: formatCurrency(stats.receitaMesLP), icon: DollarSign, color: '#A855F7', trend: formatTrend(stats.trendReceitaLP), hasGoal: true, goal: stats.metaReceitaLP, onClick: () => setShowGoalsModal(true) },
    { title: 'Receita do Mês OW', value: formatCurrency(stats.receitaMesOW), icon: DollarSign, color: '#0EA5E9', trend: formatTrend(stats.trendReceitaOW), hasGoal: true, goal: stats.metaReceitaOW, onClick: () => setShowGoalsModal(true) },
    { title: 'OS com Alerta', value: stats.osAtrasadas, icon: AlertCircle, color: '#EF4444', trend: formatTrend(stats.trendOSAtrasadas), hasGoal: false }
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {statCards.map((stat, index) => {
          const Icon = stat.icon;
          const isPositive = stat.trend.startsWith('+');
          const isNeutral = stat.trend === '0%';

          const calculateProgress = () => {
            if (!stat.hasGoal || !stat.goal) {
              return typeof stat.value === 'number' ? Math.min(100, stat.value) : 50;
            }
            const numValue = typeof stat.value === 'string'
              ? parseFloat(stat.value.replace('R$', '').replace(/\./g, '').replace(',', '.'))
              : stat.value;
            return Math.min(100, (numValue / stat.goal) * 100);
          };

          return (
            <div
              key={index}
              className="rounded-xl p-4 group relative overflow-hidden transition-all duration-300"
              style={{
                background: `linear-gradient(135deg, ${stat.color}08 0%, rgba(0,0,0,0.4) 100%)`,
                border: `1px solid ${stat.color}30`,
                boxShadow: `0 2px 10px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.05)`,
                animationDelay: `${index * 50}ms`,
                cursor: stat.hasGoal ? 'pointer' : 'default'
              }}
              onClick={stat.onClick}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = `${stat.color}60`;
                e.currentTarget.style.boxShadow = `0 4px 20px ${stat.color}30, inset 0 1px 1px rgba(255,255,255,0.1)`;
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = `${stat.color}30`;
                e.currentTarget.style.boxShadow = `0 2px 10px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.05)`;
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
                <div className="flex items-center gap-1">
                  <div
                    className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                    style={{
                      background: isNeutral
                        ? 'linear-gradient(135deg, rgba(107,114,128,0.2) 0%, rgba(107,114,128,0.08) 100%)'
                        : isPositive
                        ? 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(16,185,129,0.08) 100%)'
                        : 'linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(239,68,68,0.08) 100%)',
                      color: isNeutral ? '#6B7280' : isPositive ? '#10B981' : '#EF4444',
                      border: `1px solid ${isNeutral ? 'rgba(107,114,128,0.3)' : isPositive ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                      boxShadow: `0 0 6px ${isNeutral ? 'rgba(107,114,128,0.1)' : isPositive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}`
                    }}
                  >
                    {stat.trend}
                  </div>
                  {stat.hasGoal && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setShowGoalsModal(true);
                      }}
                      className="p-1 rounded transition-all duration-200"
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)'
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                      }}
                    >
                      <Settings className="w-3 h-3 text-gray-400" />
                    </button>
                  )}
                </div>
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

              {stat.hasGoal && stat.goal && (
                <p className="text-[10px] text-gray-500 mb-2">
                  Meta: {formatCurrency(stat.goal)}
                </p>
              )}

              <div className="h-1 bg-black/60 rounded-full overflow-hidden">
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
            background: 'linear-gradient(135deg, rgba(0,212,255,0.08) 0%, rgba(0,0,0,0.4) 100%)',
            border: '1px solid rgba(0,212,255,0.3)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.05)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(0,212,255,0.6)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,212,255,0.3), inset 0 1px 1px rgba(255,255,255,0.1)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(0,212,255,0.3)';
            e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.05)';
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
            <div className="flex items-center justify-between p-2.5 rounded-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(14,165,233,0.08) 0%, rgba(14,165,233,0.02) 100%)',
                border: '1px solid rgba(14,165,233,0.2)',
                boxShadow: '0 0 6px rgba(14,165,233,0.08)'
              }}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#0EA5E9]" style={{ boxShadow: '0 0 4px rgba(14,165,233,0.4)' }} />
                <span className="text-xs font-medium text-gray-300">OS em Análise</span>
              </div>
              <span className="text-sm font-bold text-[#0EA5E9]">
                {Math.floor(stats.osAbertas * 0.3)}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(245,158,11,0.08) 0%, rgba(245,158,11,0.02) 100%)',
                border: '1px solid rgba(245,158,11,0.2)',
                boxShadow: '0 0 6px rgba(245,158,11,0.08)'
              }}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#F59E0B]" style={{ boxShadow: '0 0 4px rgba(245,158,11,0.4)' }} />
                <span className="text-xs font-medium text-gray-300">Aguardando Peças</span>
              </div>
              <span className="text-sm font-bold text-[#F59E0B]">
                {Math.floor(stats.osAbertas * 0.4)}
              </span>
            </div>

            <div className="flex items-center justify-between p-2.5 rounded-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(16,185,129,0.02) 100%)',
                border: '1px solid rgba(16,185,129,0.2)',
                boxShadow: '0 0 6px rgba(16,185,129,0.08)'
              }}
            >
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#10B981]" style={{ boxShadow: '0 0 4px rgba(16,185,129,0.4)' }} />
                <span className="text-xs font-medium text-gray-300">Em Reparo</span>
              </div>
              <span className="text-sm font-bold text-[#10B981]">
                {Math.floor(stats.osAbertas * 0.3)}
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-xl p-4 relative overflow-hidden transition-all duration-300"
          style={{
            background: 'linear-gradient(135deg, rgba(0,245,255,0.08) 0%, rgba(0,0,0,0.4) 100%)',
            border: '1px solid rgba(0,245,255,0.3)',
            boxShadow: '0 2px 10px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.05)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = 'rgba(0,245,255,0.6)';
            e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,245,255,0.3), inset 0 1px 1px rgba(255,255,255,0.1)';
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(0,245,255,0.3)';
            e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.05)';
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
              onClick={() => setShowGoalsModal(true)}
              className="p-1.5 rounded transition-all duration-200"
              style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
              }}
            >
              <Settings className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          <div className="space-y-3">
            <div
              className="cursor-pointer transition-all duration-200 p-2 rounded-lg"
              onClick={() => loadPerformanceDetails('aprovacao')}
              style={{ background: 'rgba(0,0,0,0.2)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(16,185,129,0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0,0,0,0.2)';
              }}
            >
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Taxa de Aprovação</span>
                <span className="text-xs text-[#10B981] font-bold">{stats.taxaAprovacao.toFixed(1)}%</span>
              </div>
              <div className="h-1.5 bg-black/60 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000" style={{
                  width: `${Math.min(100, stats.taxaAprovacao)}%`,
                  background: 'linear-gradient(90deg, #10B981 0%, #06B6D4 100%)',
                  boxShadow: '0 0 8px rgba(16,185,129,0.4)'
                }} />
              </div>
              {stats.metaTaxaAprovacao && (
                <p className="text-[9px] text-gray-600 mt-1">Meta: {stats.metaTaxaAprovacao.toFixed(1)}%</p>
              )}
            </div>

            <div
              className="cursor-pointer transition-all duration-200 p-2 rounded-lg"
              onClick={() => loadPerformanceDetails('eficiencia')}
              style={{ background: 'rgba(0,0,0,0.2)' }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(14,165,233,0.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0,0,0,0.2)';
              }}
            >
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Eficiência Operacional</span>
                <span className="text-xs text-[#0EA5E9] font-bold">{stats.eficienciaOperacional.toFixed(1)} dias</span>
              </div>
              <div className="h-1.5 bg-black/60 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000" style={{
                  width: stats.metaEficiencia
                    ? `${Math.min(100, (stats.metaEficiencia / Math.max(stats.eficienciaOperacional, 1)) * 100)}%`
                    : `${Math.min(100, 100 - (stats.eficienciaOperacional * 10))}%`,
                  background: 'linear-gradient(90deg, #0EA5E9 0%, #3B82F6 100%)',
                  boxShadow: '0 0 8px rgba(14,165,233,0.4)'
                }} />
              </div>
              {stats.metaEficiencia && (
                <p className="text-[9px] text-gray-600 mt-1">Meta: {stats.metaEficiencia.toFixed(1)} dias</p>
              )}
            </div>
          </div>
        </div>
      </div>

      <PerformanceDetailsModal
        isOpen={showPerformanceModal}
        onClose={() => setShowPerformanceModal(false)}
        metric={performanceModalType}
        title={performanceModalType === 'eficiencia' ? 'Eficiência Operacional' : 'Taxa de Aprovação'}
        osList={performanceOSList}
        targetValue={performanceModalType === 'eficiencia' ? stats.metaEficiencia : stats.metaTaxaAprovacao}
        currentValue={performanceModalType === 'eficiencia' ? stats.eficienciaOperacional : stats.taxaAprovacao}
      />

      <GoalsConfigModal
        isOpen={showGoalsModal}
        onClose={() => setShowGoalsModal(false)}
        unidadeId={selectedUnidade || user?.unidade_id || ''}
        onSaved={() => {
          loadDashboardData();
        }}
      />
    </div>
  );
}
