import { useState, useEffect } from 'react';
import {
  MessageSquare, Users, Clock, TrendingUp, BarChart3, Target,
  Inbox
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface Props {
  accentColor: string;
  unidadeId?: string;
}

export function AtomConnectDashboard({ accentColor, unidadeId }: Props) {
  const { unidadeAtual } = useAuth();
  const [stats, setStats] = useState({
    totalConversas: 0,
    conversasHoje: 0,
    semAtendente: 0,
    conversasPorColuna: [] as { coluna: string; count: number; cor: string }[],
    conversasPorDia: [] as { dia: string; count: number }[],
    topAtendentes: [] as { nome: string; atendimentos: number }[]
  });
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<'hoje' | 'semana' | 'mes'>('hoje');

  const effectiveUnidadeId = unidadeId || unidadeAtual;

  useEffect(() => {
    loadStats();
  }, [effectiveUnidadeId, periodo]);

  const loadStats = async () => {
    if (!effectiveUnidadeId) {
      setLoading(false);
      return;
    }

    const { data: conversas } = await supabase
      .from('atom_connect_conversas')
      .select('*, atom_connect_pipeline_colunas(nome, cor)')
      .eq('unidade_id', effectiveUnidadeId);

    const { data: colunas } = await supabase
      .from('atom_connect_pipeline_colunas')
      .select('*')
      .order('ordem');

    const allConversas = conversas || [];

    const conversasPorColuna = (colunas || []).map(col => ({
      coluna: col.nome,
      count: allConversas.filter(c => c.coluna_pipeline === col.id).length,
      cor: col.cor
    }));

    const today = new Date();
    const conversasHoje = allConversas.filter(c => {
      const created = new Date(c.created_at);
      return created.toDateString() === today.toDateString();
    }).length;

    const semAtendente = allConversas.filter(c => !c.atendente_id).length;

    const conversasPorDia: { dia: string; count: number }[] = [];
    const days = periodo === 'hoje' ? 1 : periodo === 'semana' ? 7 : 30;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const count = allConversas.filter(c => {
        const created = new Date(c.created_at);
        return created.toDateString() === d.toDateString();
      }).length;
      conversasPorDia.push({ dia: dayStr, count });
    }

    const atendenteMap: Record<string, { nome: string; count: number }> = {};
    for (const c of allConversas) {
      if (c.atendente_id) {
        if (!atendenteMap[c.atendente_id]) {
          atendenteMap[c.atendente_id] = { nome: c.atendente_id, count: 0 };
        }
        atendenteMap[c.atendente_id].count++;
      }
    }

    if (Object.keys(atendenteMap).length > 0) {
      const ids = Object.keys(atendenteMap);
      const { data: usuarios } = await supabase
        .from('usuarios')
        .select('id, nome')
        .in('id', ids);
      if (usuarios) {
        for (const u of usuarios) {
          if (atendenteMap[u.id]) {
            atendenteMap[u.id].nome = u.nome || u.id;
          }
        }
      }
    }

    const topAtendentes = Object.values(atendenteMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(a => ({ nome: a.nome, atendimentos: a.count }));

    setStats({
      totalConversas: allConversas.length,
      conversasHoje,
      semAtendente,
      conversasPorColuna,
      conversasPorDia,
      topAtendentes
    });

    setLoading(false);
  };

  const StatCard = ({ icon: Icon, label, value }: {
    icon: any;
    label: string;
    value: string | number;
  }) => (
    <div className="p-6 rounded-xl bg-white/5 border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${accentColor}20` }}
        >
          <Icon className="w-6 h-6" style={{ color: accentColor }} />
        </div>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-sm text-gray-400 mt-1">{label}</p>
    </div>
  );

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const hasData = stats.totalConversas > 0;

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Dashboard</h2>
        <div className="flex items-center gap-2 bg-white/5 rounded-lg p-1">
          {(['hoje', 'semana', 'mes'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className={`px-4 py-2 rounded-md text-sm transition-colors ${
                periodo === p ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {p === 'hoje' ? 'Hoje' : p === 'semana' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard icon={MessageSquare} label="Total de Conversas" value={stats.totalConversas} />
        <StatCard icon={Users} label="Conversas Hoje" value={stats.conversasHoje} />
        <StatCard icon={Clock} label="Sem Atendente" value={stats.semAtendente} />
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <Inbox className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg font-medium text-white/40">Nenhum dado disponivel</p>
          <p className="text-sm text-white/20 mt-1">As metricas aparecerao conforme as conversas forem criadas</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-6">
            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">Conversas por Estagio</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.conversasPorColuna}>
                    <XAxis
                      dataKey="coluna"
                      tick={{ fill: '#6B7280', fontSize: 10 }}
                      axisLine={{ stroke: '#374151' }}
                      tickLine={false}
                      angle={-45}
                      textAnchor="end"
                      height={80}
                    />
                    <YAxis
                      tick={{ fill: '#6B7280', fontSize: 12 }}
                      axisLine={{ stroke: '#374151' }}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1A1A2E',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px'
                      }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <Bar dataKey="count" fill={accentColor} radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="p-6 rounded-xl bg-white/5 border border-white/10">
              <h3 className="text-lg font-semibold text-white mb-4">Volume de Conversas</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.conversasPorDia}>
                    <XAxis
                      dataKey="dia"
                      tick={{ fill: '#6B7280', fontSize: 10 }}
                      axisLine={{ stroke: '#374151' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#6B7280', fontSize: 12 }}
                      axisLine={{ stroke: '#374151' }}
                      tickLine={false}
                      allowDecimals={false}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: '#1A1A2E',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px'
                      }}
                      labelStyle={{ color: '#fff' }}
                    />
                    <defs>
                      <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={accentColor} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={accentColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="count"
                      stroke={accentColor}
                      strokeWidth={2}
                      fill="url(#colorCount)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          <div className="p-6 rounded-xl bg-white/5 border border-white/10">
            <h3 className="text-lg font-semibold text-white mb-4">Ranking de Atendentes</h3>
            <div className="space-y-3">
              {stats.topAtendentes.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-8">
                  Nenhum atendente com conversas atribuidas
                </p>
              ) : (
                stats.topAtendentes.map((atendente, index) => (
                  <div
                    key={atendente.nome}
                    className="flex items-center gap-4 p-3 rounded-lg bg-white/5"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                      style={{
                        backgroundColor: index === 0 ? '#FFD700' : index === 1 ? '#C0C0C0' : index === 2 ? '#CD7F32' : `${accentColor}20`,
                        color: index < 3 ? '#000' : accentColor
                      }}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-white">{atendente.nome}</p>
                      <p className="text-xs text-gray-400">
                        {atendente.atendimentos} conversa{atendente.atendimentos !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
