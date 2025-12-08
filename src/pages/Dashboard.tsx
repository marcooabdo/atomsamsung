import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { UnitFilter } from '../components/UnitFilter';
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
  Zap
} from 'lucide-react';

interface DashboardStats {
  totalOS: number;
  osAbertas: number;
  cotacoesPendentes: number;
  cotacoesAprovadas: number;
  pecasEstoque: number;
  agendamentosHoje: number;
  receitaMes: number;
  osAtrasadas: number;
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
    receitaMes: 0,
    osAtrasadas: 0,
  });
  const [loading, setLoading] = useState(true);
  const [unidades, setUnidades] = useState<Array<{id: string; nome: string}>>([]);
  const [selectedUnidade, setSelectedUnidade] = useState('');

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

      const [
        osResult,
        osAbertasResult,
        cotacoesPendentesResult,
        cotacoesAprovadasResult,
        pecasResult,
        agendamentosResult,
        receitaResult
      ] = await Promise.all([
        buildQuery('os'),
        buildQuery('os').neq('coluna_kanban', 'os_fechada'),
        buildQuery('cotacoes').in('status', ['pendente_preenchimento', 'enviada']),
        buildQuery('cotacoes').eq('status', 'aprovada'),
        buildQuery('estoque_pecas').eq('status', 'disponivel'),
        buildQuery('os').eq('data_agendamento', hoje).neq('coluna_kanban', 'os_fechada'),
        (async () => {
          let query = supabase.from('financeiro_lancamentos').select('valor').gte('data_pagamento', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]);
          if (!canSeeAllUnits && unidadeFilter) {
            query = query.eq('unidade_id', unidadeFilter);
          } else if (selectedUnidade) {
            query = query.eq('unidade_id', selectedUnidade);
          }
          return query;
        })()
      ]);

      const receita = receitaResult.data?.reduce((sum, item) => sum + (item.valor || 0), 0) || 0;

      setStats({
        totalOS: osResult.count || 0,
        osAbertas: osAbertasResult.count || 0,
        cotacoesPendentes: cotacoesPendentesResult.count || 0,
        cotacoesAprovadas: cotacoesAprovadasResult.count || 0,
        pecasEstoque: pecasResult.count || 0,
        agendamentosHoje: agendamentosResult.count || 0,
        receitaMes: receita,
        osAtrasadas: 0,
      });
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    { title: 'OS Abertas', value: stats.osAbertas, icon: FileText, color: '#0EA5E9', trend: '+12%' },
    { title: 'Cotações Pendentes', value: stats.cotacoesPendentes, icon: Clock, color: '#F59E0B', trend: '-5%' },
    { title: 'Cotações Aprovadas', value: stats.cotacoesAprovadas, icon: CheckCircle, color: '#10B981', trend: '+8%' },
    { title: 'Peças Disponíveis', value: stats.pecasEstoque, icon: Package, color: '#06B6D4', trend: '+3%' },
    { title: 'Agendamentos Hoje', value: stats.agendamentosHoje, icon: Users, color: '#0EA5E9', trend: '+15%' },
    { title: 'Receita do Mês', value: `R$ ${stats.receitaMes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, color: '#10B981', trend: '+22%' },
    { title: 'Total de OS', value: stats.totalOS, icon: TrendingUp, color: '#0EA5E9', trend: '+18%' },
    { title: 'OS com Alerta', value: stats.osAtrasadas, icon: AlertCircle, color: '#EF4444', trend: '-10%' }
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

          return (
            <div
              key={index}
              className="rounded-xl p-4 group relative overflow-hidden transition-all duration-300"
              style={{
                background: `linear-gradient(135deg, ${stat.color}08 0%, rgba(0,0,0,0.4) 100%)`,
                border: `1px solid ${stat.color}30`,
                boxShadow: `0 2px 10px rgba(0,0,0,0.3), inset 0 1px 1px rgba(255,255,255,0.05)`,
                animationDelay: `${index * 50}ms`
              }}
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
                <div
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                  style={{
                    background: isPositive
                      ? 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(16,185,129,0.08) 100%)'
                      : 'linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(239,68,68,0.08) 100%)',
                    color: isPositive ? '#10B981' : '#EF4444',
                    border: `1px solid ${isPositive ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                    boxShadow: `0 0 6px ${isPositive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)'}`
                  }}
                >
                  {stat.trend}
                </div>
              </div>

              <h4 className="text-[10px] font-bold text-gray-500 mb-2 uppercase tracking-widest">
                {stat.title}
              </h4>

              <p
                className="text-xl font-bold tracking-tight mb-3"
                style={{ color: stat.color }}
              >
                {stat.value}
              </p>

              <div className="h-1 bg-black/60 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-1000"
                  style={{
                    width: `${Math.min(100, (typeof stat.value === 'number' ? stat.value : 50))}%`,
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

          <div className="flex items-center gap-2 mb-4 px-2 py-1.5 rounded-lg w-fit" style={{
            background: 'linear-gradient(90deg, rgba(6,182,212,0.1) 0%, transparent 100%)',
            border: '1px solid rgba(6,182,212,0.25)'
          }}>
            <Activity className="w-4 h-4 text-[#06B6D4]" />
            <h4 className="tech-heading text-xs text-[#06B6D4] tracking-widest">PERFORMANCE</h4>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Taxa de Conclusão</span>
                <span className="text-xs text-[#10B981] font-bold">94%</span>
              </div>
              <div className="h-1.5 bg-black/60 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000" style={{
                  width: '94%',
                  background: 'linear-gradient(90deg, #10B981 0%, #06B6D4 100%)',
                  boxShadow: '0 0 8px rgba(16,185,129,0.4)'
                }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Eficiência Operacional</span>
                <span className="text-xs text-[#0EA5E9] font-bold">87%</span>
              </div>
              <div className="h-1.5 bg-black/60 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000" style={{
                  width: '87%',
                  background: 'linear-gradient(90deg, #0EA5E9 0%, #3B82F6 100%)',
                  boxShadow: '0 0 8px rgba(14,165,233,0.4)'
                }} />
              </div>
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] text-gray-500 uppercase tracking-wider font-bold">Satisfação do Cliente</span>
                <span className="text-xs text-[#10B981] font-bold">96%</span>
              </div>
              <div className="h-1.5 bg-black/60 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-1000" style={{
                  width: '96%',
                  background: 'linear-gradient(90deg, #10B981 0%, #0EA5E9 100%)',
                  boxShadow: '0 0 8px rgba(16,185,129,0.4)'
                }} />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
