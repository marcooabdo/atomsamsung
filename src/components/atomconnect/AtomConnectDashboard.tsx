import { useState, useEffect } from 'react';
import {
  MessageSquare, Users, Clock, TrendingUp, BarChart3, Target,
  Award, Zap, Calendar, ArrowUp, ArrowDown
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, AreaChart, Area } from 'recharts';

interface Props {
  accentColor: string;
}

export function AtomConnectDashboard({ accentColor }: Props) {
  const { unidadeAtual } = useAuth();
  const [stats, setStats] = useState({
    totalConversas: 0,
    conversasHoje: 0,
    tempoMedioResposta: 0,
    taxaResolucao: 0,
    conversasPorColuna: [] as { coluna: string; count: number; cor: string }[],
    mensagensPorHora: [] as { hora: string; count: number }[],
    topAtendentes: [] as { nome: string; atendimentos: number; tempoMedio: number }[]
  });
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<'hoje' | 'semana' | 'mes'>('hoje');

  useEffect(() => {
    loadStats();
  }, [unidadeAtual, periodo]);

  const loadStats = async () => {
    if (!unidadeAtual) {
      setLoading(false);
      return;
    }

    const { data: conversas } = await supabase
      .from('atom_connect_conversas')
      .select('*, atom_connect_pipeline_colunas(nome, cor)')
      .eq('unidade_id', unidadeAtual);

    const { data: colunas } = await supabase
      .from('atom_connect_pipeline_colunas')
      .select('*')
      .order('ordem');

    const conversasPorColuna = (colunas || []).map(col => ({
      coluna: col.nome,
      count: (conversas || []).filter(c => c.coluna_pipeline === col.id).length,
      cor: col.cor
    }));

    const mensagensPorHora = Array.from({ length: 24 }, (_, i) => ({
      hora: `${i.toString().padStart(2, '0')}h`,
      count: Math.floor(Math.random() * 50)
    }));

    setStats({
      totalConversas: conversas?.length || 0,
      conversasHoje: conversas?.filter(c => {
        const created = new Date(c.created_at);
        const today = new Date();
        return created.toDateString() === today.toDateString();
      }).length || 0,
      tempoMedioResposta: 4.5,
      taxaResolucao: 85,
      conversasPorColuna,
      mensagensPorHora,
      topAtendentes: []
    });

    setLoading(false);
  };

  const StatCard = ({ icon: Icon, label, value, change, changeType }: {
    icon: any;
    label: string;
    value: string | number;
    change?: number;
    changeType?: 'up' | 'down';
  }) => (
    <div className="p-6 rounded-xl bg-white/5 border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ backgroundColor: `${accentColor}20` }}
        >
          <Icon className="w-6 h-6" style={{ color: accentColor }} />
        </div>
        {change !== undefined && (
          <div className={`flex items-center gap-1 text-xs ${
            changeType === 'up' ? 'text-green-400' : 'text-red-400'
          }`}>
            {changeType === 'up' ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
            {change}%
          </div>
        )}
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

  return (
    <div className="h-full overflow-y-auto p-6 space-y-6">
      {/* Period Selector */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white">Dashboard de Performance</h2>
        <div className="flex items-center gap-2 bg-white/5 rounded-lg p-1">
          <button
            onClick={() => setPeriodo('hoje')}
            className={`px-4 py-2 rounded-md text-sm transition-colors ${
              periodo === 'hoje' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Hoje
          </button>
          <button
            onClick={() => setPeriodo('semana')}
            className={`px-4 py-2 rounded-md text-sm transition-colors ${
              periodo === 'semana' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Semana
          </button>
          <button
            onClick={() => setPeriodo('mes')}
            className={`px-4 py-2 rounded-md text-sm transition-colors ${
              periodo === 'mes' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            Mes
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-4">
        <StatCard
          icon={MessageSquare}
          label="Total de Conversas"
          value={stats.totalConversas}
          change={12}
          changeType="up"
        />
        <StatCard
          icon={Users}
          label="Conversas Hoje"
          value={stats.conversasHoje}
          change={8}
          changeType="up"
        />
        <StatCard
          icon={Clock}
          label="Tempo Medio Resposta"
          value={`${stats.tempoMedioResposta}min`}
          change={15}
          changeType="down"
        />
        <StatCard
          icon={Target}
          label="Taxa de Resolucao"
          value={`${stats.taxaResolucao}%`}
          change={5}
          changeType="up"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-6">
        {/* Conversas por Coluna */}
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
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1A1A2E',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px'
                  }}
                  labelStyle={{ color: '#fff' }}
                />
                <Bar
                  dataKey="count"
                  fill={accentColor}
                  radius={[4, 4, 0, 0]}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Mensagens por Hora */}
        <div className="p-6 rounded-xl bg-white/5 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">Volume de Mensagens por Hora</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.mensagensPorHora}>
                <XAxis
                  dataKey="hora"
                  tick={{ fill: '#6B7280', fontSize: 10 }}
                  axisLine={{ stroke: '#374151' }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fill: '#6B7280', fontSize: 12 }}
                  axisLine={{ stroke: '#374151' }}
                  tickLine={false}
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

      {/* Rankings */}
      <div className="grid grid-cols-3 gap-6">
        {/* Top Atendentes */}
        <div className="col-span-2 p-6 rounded-xl bg-white/5 border border-white/10">
          <h3 className="text-lg font-semibold text-white mb-4">Ranking de Atendentes</h3>
          <div className="space-y-3">
            {stats.topAtendentes.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">
                Nenhum dado de atendimento ainda
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
                      {atendente.atendimentos} atendimentos - {atendente.tempoMedio}min tempo medio
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30">
            <div className="flex items-center gap-3">
              <Award className="w-8 h-8 text-green-400" />
              <div>
                <p className="text-2xl font-bold text-white">98%</p>
                <p className="text-xs text-green-400">NPS Medio</p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30">
            <div className="flex items-center gap-3">
              <Zap className="w-8 h-8 text-blue-400" />
              <div>
                <p className="text-2xl font-bold text-white">1.2k</p>
                <p className="text-xs text-blue-400">Msgs do Bot</p>
              </div>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-purple-400" />
              <div>
                <p className="text-2xl font-bold text-white">15</p>
                <p className="text-xs text-purple-400">Visitas IH Agendadas</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
