import { useState, useEffect } from 'react';
import {
  MessageSquare, Users, Clock, TrendingUp, BarChart3, Target,
  Inbox, AlertTriangle, Timer, UserCheck, Phone, Zap, ChevronDown,
  ChevronUp
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface Props {
  accentColor: string;
  unidadeId?: string;
}

interface ResponseMetrics {
  avg_first_response_seconds: number;
  avg_between_response_seconds: number;
  sla_minutes: number;
  sla_expired_count: number;
  oldest_waiting: {
    conversa_id: string;
    cliente_nome: string | null;
    cliente_telefone: string;
    waiting_seconds: number;
    last_client_msg: string;
  } | null;
  all_waiting: {
    conversa_id: string;
    cliente_nome: string | null;
    cliente_telefone: string;
    waiting_seconds: number;
  }[];
  per_attendant: {
    atendente_id: string;
    avg_first_response_seconds: number;
    avg_between_response_seconds: number;
    total_conversations: number;
    total_responses: number;
  }[];
}

const formatDuration = (seconds: number): string => {
  if (!seconds || seconds <= 0) return '--';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.round(seconds % 60);
    return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  }
  const hours = Math.floor(seconds / 3600);
  const mins = Math.round((seconds % 3600) / 60);
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

const formatWaitingTime = (seconds: number): string => {
  if (!seconds || seconds <= 0) return 'agora';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
  if (seconds < 86400) {
    const h = Math.floor(seconds / 3600);
    const m = Math.round((seconds % 3600) / 60);
    return `${h}h${m > 0 ? ` ${m}m` : ''}`;
  }
  const d = Math.floor(seconds / 86400);
  const h = Math.round((seconds % 86400) / 3600);
  return `${d}d${h > 0 ? ` ${h}h` : ''}`;
};

const formatPhone = (phone: string): string => {
  const clean = phone.replace(/\D/g, '');
  if (clean.startsWith('55') && clean.length >= 12) {
    const ddd = clean.slice(2, 4);
    const num = clean.slice(4);
    if (num.length === 9) return `(${ddd}) ${num.slice(0, 5)}-${num.slice(5)}`;
    return `(${ddd}) ${num.slice(0, 4)}-${num.slice(4)}`;
  }
  return phone;
};

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
  const [responseMetrics, setResponseMetrics] = useState<ResponseMetrics | null>(null);
  const [attendantNames, setAttendantNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<'hoje' | 'semana' | 'mes'>('hoje');
  const [showAllWaiting, setShowAllWaiting] = useState(false);
  const [expandedAttendant, setExpandedAttendant] = useState(false);

  const effectiveUnidadeId = unidadeId || unidadeAtual;

  useEffect(() => {
    loadStats();
  }, [effectiveUnidadeId, periodo]);

  const loadStats = async () => {
    const [conversasResult, colunasResult, metricsResult] = await Promise.all([
      (() => {
        let query = supabase
          .from('atom_connect_conversas')
          .select('*, atom_connect_pipeline_colunas(nome, cor)');
        if (effectiveUnidadeId) query = query.eq('unidade_id', effectiveUnidadeId);
        return query;
      })(),
      (() => {
        let query = supabase
          .from('atom_connect_pipeline_colunas')
          .select('*')
          .order('ordem');
        if (effectiveUnidadeId) query = query.or(`unidade_id.eq.${effectiveUnidadeId},unidade_id.is.null`);
        return query;
      })(),
      supabase.rpc('get_atom_connect_response_metrics', {
        p_unidade_id: effectiveUnidadeId || null
      })
    ]);

    const conversas = conversasResult.data || [];
    const colunas = colunasResult.data || [];
    const metrics = metricsResult.data as ResponseMetrics | null;

    const conversasPorColuna = colunas.map(col => ({
      coluna: col.nome,
      count: conversas.filter(c => c.coluna_pipeline === col.id).length,
      cor: col.cor
    }));

    const today = new Date();
    const conversasHoje = conversas.filter(c => {
      const created = new Date(c.created_at);
      return created.toDateString() === today.toDateString();
    }).length;

    const semAtendente = conversas.filter(c => !c.atendente_id).length;

    const conversasPorDia: { dia: string; count: number }[] = [];
    const days = periodo === 'hoje' ? 1 : periodo === 'semana' ? 7 : 30;
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      const count = conversas.filter(c => {
        const created = new Date(c.created_at);
        return created.toDateString() === d.toDateString();
      }).length;
      conversasPorDia.push({ dia: dayStr, count });
    }

    const atendenteMap: Record<string, { nome: string; count: number }> = {};
    for (const c of conversas) {
      if (c.atendente_id) {
        if (!atendenteMap[c.atendente_id]) {
          atendenteMap[c.atendente_id] = { nome: c.atendente_id, count: 0 };
        }
        atendenteMap[c.atendente_id].count++;
      }
    }

    const allAttendantIds = new Set<string>();
    Object.keys(atendenteMap).forEach(id => allAttendantIds.add(id));
    if (metrics?.per_attendant) {
      metrics.per_attendant.forEach(a => allAttendantIds.add(a.atendente_id));
    }

    if (allAttendantIds.size > 0) {
      const ids = Array.from(allAttendantIds);
      const { data: usuarios } = await supabase
        .from('usuarios')
        .select('id, nome')
        .in('id', ids);
      if (usuarios) {
        const namesMap: Record<string, string> = {};
        for (const u of usuarios) {
          namesMap[u.id] = u.nome || u.id;
          if (atendenteMap[u.id]) {
            atendenteMap[u.id].nome = u.nome || u.id;
          }
        }
        setAttendantNames(namesMap);
      }
    }

    const topAtendentes = Object.values(atendenteMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(a => ({ nome: a.nome, atendimentos: a.count }));

    setStats({
      totalConversas: conversas.length,
      conversasHoje,
      semAtendente,
      conversasPorColuna,
      conversasPorDia,
      topAtendentes
    });

    setResponseMetrics(metrics);
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  const hasData = stats.totalConversas > 0;
  const slaExpired = responseMetrics?.sla_expired_count || 0;
  const slaMinutes = responseMetrics?.sla_minutes || 20;
  const oldest = responseMetrics?.oldest_waiting;
  const allWaiting = responseMetrics?.all_waiting || [];
  const perAttendant = responseMetrics?.per_attendant || [];

  const avgFirstResponse = responseMetrics?.avg_first_response_seconds || 0;
  const avgBetween = responseMetrics?.avg_between_response_seconds || 0;

  const firstResponseColor = avgFirstResponse > 0 && avgFirstResponse > slaMinutes * 60 ? '#ef4444' :
    avgFirstResponse > 0 && avgFirstResponse > (slaMinutes * 60) * 0.7 ? '#f59e0b' : '#10b981';

  const slaColor = slaExpired > 0 ? '#ef4444' : '#10b981';

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

      {/* Row 1: Core Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="p-5 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accentColor}20` }}>
              <MessageSquare className="w-5 h-5" style={{ color: accentColor }} />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{stats.totalConversas}</p>
          <p className="text-sm text-gray-400 mt-1">Total de Conversas</p>
        </div>
        <div className="p-5 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accentColor}20` }}>
              <Users className="w-5 h-5" style={{ color: accentColor }} />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{stats.conversasHoje}</p>
          <p className="text-sm text-gray-400 mt-1">Conversas Hoje</p>
        </div>
        <div className="p-5 rounded-xl bg-white/5 border border-white/10">
          <div className="flex items-center justify-between mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-amber-500/20">
              <Clock className="w-5 h-5 text-amber-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{stats.semAtendente}</p>
          <p className="text-sm text-gray-400 mt-1">Sem Atendente</p>
        </div>
      </div>

      {/* Row 2: Response Time Metrics + SLA */}
      <div className="grid grid-cols-4 gap-4">
        <div className="p-5 rounded-xl bg-white/5 border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl" style={{ backgroundColor: firstResponseColor }} />
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${firstResponseColor}20` }}>
              <Zap className="w-5 h-5" style={{ color: firstResponseColor }} />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{formatDuration(avgFirstResponse)}</p>
          <p className="text-sm text-gray-400 mt-1">Tempo Medio 1a Resposta</p>
          <p className="text-xs mt-2" style={{ color: firstResponseColor }}>
            SLA: {slaMinutes}min
          </p>
        </div>

        <div className="p-5 rounded-xl bg-white/5 border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl" style={{ backgroundColor: accentColor }} />
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accentColor}20` }}>
              <Timer className="w-5 h-5" style={{ color: accentColor }} />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{formatDuration(avgBetween)}</p>
          <p className="text-sm text-gray-400 mt-1">Tempo Medio Entre Respostas</p>
          <p className="text-xs text-gray-500 mt-2">Cliente enviou - voce respondeu</p>
        </div>

        <div className="p-5 rounded-xl bg-white/5 border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl" style={{ backgroundColor: slaColor }} />
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${slaColor}20` }}>
              <AlertTriangle className="w-5 h-5" style={{ color: slaColor }} />
            </div>
          </div>
          <p className="text-2xl font-bold" style={{ color: slaExpired > 0 ? '#ef4444' : 'white' }}>
            {slaExpired}
          </p>
          <p className="text-sm text-gray-400 mt-1">SLA Expirado</p>
          <p className="text-xs mt-2" style={{ color: slaColor }}>
            Limite: {slaMinutes}min para 1a resposta
          </p>
        </div>

        <div className="p-5 rounded-xl bg-white/5 border border-white/10 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl" style={{ backgroundColor: oldest ? '#f59e0b' : '#10b981' }} />
          <div className="flex items-center gap-2 mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: oldest ? '#f59e0b20' : '#10b98120' }}>
              <Phone className="w-5 h-5" style={{ color: oldest ? '#f59e0b' : '#10b981' }} />
            </div>
          </div>
          {oldest ? (
            <>
              <p className="text-lg font-bold text-white truncate">
                {oldest.cliente_nome || formatPhone(oldest.cliente_telefone)}
              </p>
              <p className="text-sm text-amber-400 mt-1 font-medium">
                Aguardando ha {formatWaitingTime(oldest.waiting_seconds)}
              </p>
              <p className="text-xs text-gray-500 mt-1">Contato mais antigo sem resposta</p>
            </>
          ) : (
            <>
              <p className="text-lg font-bold text-emerald-400">Todos respondidos</p>
              <p className="text-sm text-gray-400 mt-1">Nenhum contato aguardando</p>
            </>
          )}
        </div>
      </div>

      {/* Waiting contacts list */}
      {allWaiting.length > 1 && (
        <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
          <button
            onClick={() => setShowAllWaiting(!showAllWaiting)}
            className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-400" />
              <span className="text-sm font-medium text-white">
                {allWaiting.length} contato{allWaiting.length !== 1 ? 's' : ''} aguardando resposta
              </span>
            </div>
            {showAllWaiting ? (
              <ChevronUp className="w-4 h-4 text-gray-400" />
            ) : (
              <ChevronDown className="w-4 h-4 text-gray-400" />
            )}
          </button>
          {showAllWaiting && (
            <div className="border-t border-white/10">
              {allWaiting.slice(0, 10).map((w, i) => (
                <div
                  key={w.conversa_id}
                  className={`flex items-center justify-between px-4 py-3 ${
                    i % 2 === 0 ? 'bg-white/[0.02]' : ''
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center text-xs font-bold text-amber-400">
                      {i + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">
                        {w.cliente_nome || formatPhone(w.cliente_telefone)}
                      </p>
                      {w.cliente_nome && (
                        <p className="text-xs text-gray-500">{formatPhone(w.cliente_telefone)}</p>
                      )}
                    </div>
                  </div>
                  <span className={`text-sm font-medium ${
                    w.waiting_seconds > 3600 ? 'text-red-400' :
                    w.waiting_seconds > 1200 ? 'text-amber-400' : 'text-gray-400'
                  }`}>
                    {formatWaitingTime(w.waiting_seconds)}
                  </span>
                </div>
              ))}
              {allWaiting.length > 10 && (
                <div className="px-4 py-2 text-xs text-gray-500 text-center border-t border-white/5">
                  +{allWaiting.length - 10} contatos adicionais
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {!hasData ? (
        <div className="flex flex-col items-center justify-center py-20 text-gray-500">
          <Inbox className="w-16 h-16 mb-4 opacity-30" />
          <p className="text-lg font-medium text-white/40">Nenhum dado disponivel</p>
          <p className="text-sm text-white/20 mt-1">As metricas aparecerao conforme as conversas forem criadas</p>
        </div>
      ) : (
        <>
          {/* Per-attendant response times */}
          {perAttendant.length > 0 && (
            <div className="rounded-xl bg-white/5 border border-white/10 overflow-hidden">
              <button
                onClick={() => setExpandedAttendant(!expandedAttendant)}
                className="w-full flex items-center justify-between p-5 hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <UserCheck className="w-5 h-5" style={{ color: accentColor }} />
                  <span className="text-base font-semibold text-white">Tempos de Resposta por Atendente</span>
                  <span className="text-xs text-gray-500 bg-white/5 px-2 py-0.5 rounded-full">
                    {perAttendant.length} atendente{perAttendant.length !== 1 ? 's' : ''}
                  </span>
                </div>
                {expandedAttendant ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>
              {expandedAttendant && (
                <div className="border-t border-white/10">
                  <div className="grid grid-cols-[1fr_140px_140px_100px] gap-2 px-5 py-3 text-xs text-gray-500 uppercase tracking-wider border-b border-white/5">
                    <span>Atendente</span>
                    <span className="text-center">1a Resposta</span>
                    <span className="text-center">Entre Respostas</span>
                    <span className="text-center">Atendimentos</span>
                  </div>
                  {perAttendant
                    .sort((a, b) => a.avg_first_response_seconds - b.avg_first_response_seconds)
                    .map((att, i) => {
                      const name = attendantNames[att.atendente_id] || att.atendente_id.slice(0, 8);
                      const firstOk = att.avg_first_response_seconds > 0 && att.avg_first_response_seconds <= slaMinutes * 60;
                      const firstWarn = att.avg_first_response_seconds > 0 && att.avg_first_response_seconds > (slaMinutes * 60) * 0.7;
                      const firstBad = att.avg_first_response_seconds > 0 && att.avg_first_response_seconds > slaMinutes * 60;

                      return (
                        <div
                          key={att.atendente_id}
                          className={`grid grid-cols-[1fr_140px_140px_100px] gap-2 px-5 py-3 items-center ${
                            i % 2 === 0 ? 'bg-white/[0.02]' : ''
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                              style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                            >
                              {name.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-sm font-medium text-white truncate">{name}</span>
                          </div>
                          <div className="text-center">
                            <span className={`text-sm font-semibold ${
                              firstBad ? 'text-red-400' : firstWarn ? 'text-amber-400' : firstOk ? 'text-emerald-400' : 'text-gray-400'
                            }`}>
                              {formatDuration(att.avg_first_response_seconds)}
                            </span>
                          </div>
                          <div className="text-center">
                            <span className="text-sm font-semibold text-white">
                              {formatDuration(att.avg_between_response_seconds)}
                            </span>
                          </div>
                          <div className="text-center">
                            <span className="text-sm text-gray-400">
                              {att.total_conversations}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* Charts */}
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

          {/* Ranking */}
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
