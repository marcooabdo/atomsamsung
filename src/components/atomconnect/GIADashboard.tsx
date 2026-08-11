import { useState, useEffect, useCallback } from 'react';
import {
  Brain, MessageSquare, AlertTriangle, TrendingUp, Clock, Users,
  ArrowUpRight, ArrowDownRight, Zap, ShieldAlert, BookOpen, RefreshCw,
  HelpCircle, CheckCircle2, XCircle, Activity, BarChart3, Loader2,
  ThumbsUp, ThumbsDown, Sparkles, Target, Lightbulb, MonitorSpeaker
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  accentColor: string;
  unidadeId?: string;
}

interface DashMetrics {
  totalAtendimentos: number;
  totalHoje: number;
  totalSemana: number;
  totalMes: number;
  tokensHoje: number;
  tokensMes: number;
  custoEstimadoMes: number;
  taxaEscalacao: number;
  escaladosHoje: number;
  tempoMedioResposta: number;
  conversasAtivas: number;
  topCategoriasCliente: Array<{ text: string; count: number }>;
  motivosEscalacao: Array<{ motivo: string; count: number }>;
  hourlyActivity: Array<{ hour: number; count: number }>;
  dailyActivity: Array<{ date: string; total: number; escalated: number }>;
  recentEscalations: Array<{
    id: string;
    conversa_id: string;
    mensagem_cliente: string;
    resposta_gia: string;
    motivo_transferencia: string;
    created_at: string;
    cliente_nome?: string;
  }>;
  recentInteractions: Array<{
    id: string;
    mensagem_cliente: string;
    resposta_gia: string;
    tokens_usados: number;
    transferiu_para_humano: boolean;
    tempo_resposta_ms: number;
    created_at: string;
    cliente_nome?: string;
  }>;
  unansweredTopics: Array<{ topic: string; count: number }>;
}

const EMPTY_METRICS: DashMetrics = {
  totalAtendimentos: 0, totalHoje: 0, totalSemana: 0, totalMes: 0,
  tokensHoje: 0, tokensMes: 0, custoEstimadoMes: 0,
  taxaEscalacao: 0, escaladosHoje: 0, tempoMedioResposta: 0, conversasAtivas: 0,
  topCategoriasCliente: [], motivosEscalacao: [], hourlyActivity: [], dailyActivity: [],
  recentEscalations: [], recentInteractions: [], unansweredTopics: [],
};

export function GIADashboard({ accentColor, unidadeId }: Props) {
  const [metrics, setMetrics] = useState<DashMetrics>(EMPTY_METRICS);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const loadMetrics = useCallback(async () => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    const weekStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).toISOString();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    let baseQuery = supabase.from('gia_atendimento_logs').select('*');
    if (unidadeId) baseQuery = baseQuery.eq('unidade_id', unidadeId);

    const [allResult, todayResult, weekResult, monthResult, activeConversas] = await Promise.all([
      baseQuery.order('created_at', { ascending: false }).limit(500),
      supabase.from('gia_atendimento_logs').select('id, tokens_usados, transferiu_para_humano, tempo_resposta_ms, motivo_transferencia, mensagem_cliente, resposta_gia, created_at, conversa_id, os_id')
        .gte('created_at', todayStart).order('created_at', { ascending: false }),
      supabase.from('gia_atendimento_logs').select('id, tokens_usados, transferiu_para_humano, created_at, resposta_gia')
        .gte('created_at', weekStart),
      supabase.from('gia_atendimento_logs').select('id, tokens_usados, transferiu_para_humano, tempo_resposta_ms, created_at, mensagem_cliente, motivo_transferencia, resposta_gia')
        .gte('created_at', monthStart),
      supabase.from('atom_connect_conversas').select('id').eq('is_bot_ativo', true),
    ]);

    const allLogs = allResult.data || [];
    const todayLogs = todayResult.data || [];
    const weekLogs = weekResult.data || [];
    const monthLogs = monthResult.data || [];

    const failPattern = /n[aã]o\s+(consegui|localizei|encontrei|achei)|infelizmente|encaminhar.*equipe|n[aã]o\s+possuo/i;

    const tokensHoje = todayLogs.reduce((s, l) => s + (l.tokens_usados || 0), 0);
    const tokensMes = monthLogs.reduce((s, l) => s + (l.tokens_usados || 0), 0);
    const custoInput = (tokensMes * 0.6) / 1_000_000 * 0.15;
    const custoOutput = (tokensMes * 0.4) / 1_000_000 * 0.60;
    const custoEstimadoMes = custoInput + custoOutput;

    const isEscalation = (l: any) => l.transferiu_para_humano || failPattern.test(l.resposta_gia || '');
    const escaladosMes = monthLogs.filter(isEscalation).length;
    const taxaEscalacao = monthLogs.length > 0 ? (escaladosMes / monthLogs.length) * 100 : 0;
    const escaladosHoje = todayLogs.filter(isEscalation).length;

    const tempos = monthLogs.filter(l => l.tempo_resposta_ms > 0).map(l => l.tempo_resposta_ms);
    const tempoMedioResposta = tempos.length > 0 ? tempos.reduce((a, b) => a + b, 0) / tempos.length : 0;

    const hourlyActivity: Array<{ hour: number; count: number }> = [];
    for (let h = 0; h < 24; h++) {
      hourlyActivity.push({
        hour: h,
        count: todayLogs.filter(l => new Date(l.created_at).getHours() === h).length,
      });
    }

    const dailyMap = new Map<string, { total: number; escalated: number }>();
    for (const l of monthLogs) {
      const d = new Date(l.created_at).toISOString().split('T')[0];
      const entry = dailyMap.get(d) || { total: 0, escalated: 0 };
      entry.total++;
      if (l.transferiu_para_humano) entry.escalated++;
      dailyMap.set(d, entry);
    }
    const dailyActivity = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const escalationLogs = allLogs.filter(l =>
      l.transferiu_para_humano || failPattern.test(l.resposta_gia || '')
    ).slice(0, 20);
    const recentEscalations: DashMetrics['recentEscalations'] = [];
    const conversaCache = new Map<string, string>();
    for (const l of escalationLogs) {
      let clienteNome = conversaCache.get(l.conversa_id || '') || '';
      if (!clienteNome && l.conversa_id) {
        const { data: conv } = await supabase
          .from('atom_connect_conversas')
          .select('cliente_nome')
          .eq('id', l.conversa_id)
          .maybeSingle();
        clienteNome = conv?.cliente_nome || '';
        conversaCache.set(l.conversa_id, clienteNome);
      }
      const motivo = l.motivo_transferencia
        || (l.transferiu_para_humano ? 'Transferiu para humano' : null)
        || (!l.os_id && /os|ordem/i.test(l.mensagem_cliente || '') ? 'OS não encontrada' : null)
        || 'GIA não soube responder';
      recentEscalations.push({
        id: l.id,
        conversa_id: l.conversa_id,
        mensagem_cliente: l.mensagem_cliente,
        resposta_gia: l.resposta_gia,
        motivo_transferencia: motivo,
        created_at: l.created_at,
        cliente_nome: clienteNome,
      });
    }

    const motivoMap = new Map<string, number>();
    for (const l of escalationLogs.filter(l => true)) {
      const m = l.motivo_transferencia
        || (l.transferiu_para_humano ? 'Transferiu para humano' : '')
        || (!l.os_id && /os|ordem/i.test(l.mensagem_cliente || '') ? 'OS não encontrada' : '')
        || 'Não soube responder';
      if (m) motivoMap.set(m, (motivoMap.get(m) || 0) + 1);
    }
    const motivosEscalacao = Array.from(motivoMap.entries())
      .map(([motivo, count]) => ({ motivo, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const topicMap = new Map<string, number>();
    for (const l of allLogs.filter(l => l.mensagem_cliente && (l.transferiu_para_humano || failPattern.test(l.resposta_gia || '')))) {
      const msg = l.mensagem_cliente.trim();
      if (msg.length > 3) {
        const key = msg.length > 60 ? msg.substring(0, 60) + '...' : msg;
        topicMap.set(key, (topicMap.get(key) || 0) + 1);
      }
    }
    const unansweredTopics = Array.from(topicMap.entries())
      .map(([topic, count]) => ({ topic, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const recentInteractions = allLogs.slice(0, 30).map((l: any) => ({
      id: l.id,
      mensagem_cliente: l.mensagem_cliente,
      resposta_gia: l.resposta_gia,
      tokens_usados: l.tokens_usados,
      transferiu_para_humano: l.transferiu_para_humano,
      tempo_resposta_ms: l.tempo_resposta_ms,
      created_at: l.created_at,
    }));

    setMetrics({
      totalAtendimentos: allLogs.length,
      totalHoje: todayLogs.length,
      totalSemana: weekLogs.length,
      totalMes: monthLogs.length,
      tokensHoje,
      tokensMes,
      custoEstimadoMes,
      taxaEscalacao,
      escaladosHoje,
      tempoMedioResposta,
      conversasAtivas: activeConversas.data?.length || 0,
      topCategoriasCliente: [],
      motivosEscalacao,
      hourlyActivity,
      dailyActivity,
      recentEscalations,
      recentInteractions,
      unansweredTopics,
    });

    setLastRefresh(new Date());
    setLoading(false);
  }, [unidadeId]);

  useEffect(() => {
    loadMetrics();
  }, [loadMetrics]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(loadMetrics, 30000);
    return () => clearInterval(interval);
  }, [autoRefresh, loadMetrics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3" style={{ color: accentColor }} />
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Carregando métricas da GIA...</p>
        </div>
      </div>
    );
  }

  const maxHourly = Math.max(...metrics.hourlyActivity.map(h => h.count), 1);
  const maxDaily = Math.max(...metrics.dailyActivity.map(d => d.total), 1);

  return (
    <div className="space-y-4 pb-8">
      {/* Header with auto-refresh */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${accentColor}20` }}>
            <MonitorSpeaker className="w-5 h-5" style={{ color: accentColor }} />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Centro de Operações GIA</h2>
            <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
              Atualizado {lastRefresh.toLocaleTimeString('pt-BR')} {autoRefresh && '· Auto-refresh 30s'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
            style={{
              background: autoRefresh ? `${accentColor}15` : 'var(--bg-tertiary)',
              color: autoRefresh ? accentColor : 'var(--text-tertiary)',
              border: `1px solid ${autoRefresh ? accentColor + '30' : 'var(--border-primary)'}`,
            }}
          >
            <Activity className={`w-3 h-3 ${autoRefresh ? 'animate-pulse' : ''}`} />
            {autoRefresh ? 'LIVE' : 'Pausado'}
          </button>
          <button
            onClick={() => { setLoading(true); loadMetrics(); }}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
            style={{ color: 'var(--text-secondary)' }}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* KPI Cards Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        <KPICard
          icon={MessageSquare}
          label="Atendimentos Hoje"
          value={metrics.totalHoje}
          color="#3B82F6"
          subtitle={`${metrics.totalSemana} esta semana`}
        />
        <KPICard
          icon={Brain}
          label="Conversas Ativas"
          value={metrics.conversasAtivas}
          color={accentColor}
          subtitle="GIA respondendo agora"
          pulse
        />
        <KPICard
          icon={AlertTriangle}
          label="Escalações Hoje"
          value={metrics.escaladosHoje}
          color="#F59E0B"
          subtitle={`${metrics.taxaEscalacao.toFixed(1)}% taxa mensal`}
          warning={metrics.taxaEscalacao > 30}
        />
        <KPICard
          icon={Clock}
          label="Tempo Médio"
          value={`${(metrics.tempoMedioResposta / 1000).toFixed(1)}s`}
          color="#10B981"
          subtitle="de resposta"
        />
        <KPICard
          icon={Zap}
          label="Tokens Hoje"
          value={formatNumber(metrics.tokensHoje)}
          color="#8B5CF6"
          subtitle={`${formatNumber(metrics.tokensMes)} este mês`}
        />
        <KPICard
          icon={TrendingUp}
          label="Custo Estimado"
          value={`$${metrics.custoEstimadoMes.toFixed(2)}`}
          color="#06B6D4"
          subtitle="este mês (USD)"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Hourly Activity */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4" style={{ color: accentColor }} />
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Atividade por Hora (Hoje)</h3>
          </div>
          <div className="flex items-end gap-[2px] h-32">
            {metrics.hourlyActivity.map(h => (
              <div key={h.hour} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-sm transition-all duration-500"
                  style={{
                    height: `${Math.max((h.count / maxHourly) * 100, 2)}%`,
                    background: h.hour === new Date().getHours()
                      ? `linear-gradient(180deg, ${accentColor}, ${accentColor}80)`
                      : h.count > 0 ? `${accentColor}50` : 'var(--bg-tertiary)',
                    minHeight: '2px',
                  }}
                />
                {h.hour % 3 === 0 && (
                  <span className="text-[8px]" style={{ color: 'var(--text-tertiary)' }}>{h.hour}h</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Daily Activity (last 14 days) */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4" style={{ color: '#10B981' }} />
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Atendimentos Diários</h3>
          </div>
          {metrics.dailyActivity.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Sem dados ainda</p>
            </div>
          ) : (
            <div className="flex items-end gap-1 h-32">
              {metrics.dailyActivity.slice(-14).map((d, i) => (
                <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full relative" style={{ height: `${Math.max((d.total / maxDaily) * 100, 4)}%` }}>
                    <div
                      className="absolute bottom-0 w-full rounded-t-sm"
                      style={{ height: '100%', background: `${accentColor}60` }}
                    />
                    {d.escalated > 0 && (
                      <div
                        className="absolute bottom-0 w-full rounded-t-sm"
                        style={{ height: `${(d.escalated / d.total) * 100}%`, background: '#F59E0B80' }}
                      />
                    )}
                  </div>
                  {i % 2 === 0 && (
                    <span className="text-[7px]" style={{ color: 'var(--text-tertiary)' }}>
                      {new Date(d.date + 'T12:00:00').toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
          <div className="flex items-center gap-4 mt-2">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: `${accentColor}60` }} />
              <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Total</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-sm" style={{ background: '#F59E0B80' }} />
              <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>Escalações</span>
            </div>
          </div>
        </div>
      </div>

      {/* Escalation Analysis & Training Gaps Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Escalation reasons */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-2 mb-3">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Motivos de Escalação</h3>
          </div>
          {metrics.motivosEscalacao.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Sem escalações registradas</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2 max-h-48 overflow-auto">
              {metrics.motivosEscalacao.map((m, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs truncate" style={{ color: 'var(--text-primary)' }}>{m.motivo}</p>
                    <div className="mt-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(m.count / metrics.motivosEscalacao[0].count) * 100}%`,
                          background: 'linear-gradient(90deg, #F59E0B, #EF4444)',
                        }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-bold flex-shrink-0" style={{ color: '#F59E0B' }}>{m.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Training gaps - unanswered topics */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Lightbulb className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Precisa Treinar</h3>
            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 font-medium">
              Perguntas sem resposta
            </span>
          </div>
          {metrics.unansweredTopics.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-center">
                <ThumbsUp className="w-8 h-8 mx-auto mb-2 text-emerald-400" />
                <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>GIA está bem treinada!</p>
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 max-h-48 overflow-auto">
              {metrics.unansweredTopics.map((t, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 p-2 rounded-lg"
                  style={{ background: 'var(--bg-tertiary)' }}
                >
                  <HelpCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                  <p className="text-[11px] flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                    {t.topic}
                  </p>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400">
                    {t.count}x
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Performance gauge */}
        <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-2 mb-3">
            <Target className="w-4 h-4" style={{ color: accentColor }} />
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Performance</h3>
          </div>
          <div className="space-y-4">
            <PerformanceGauge
              label="Taxa de Resolução Autônoma"
              value={100 - metrics.taxaEscalacao}
              target={80}
              color="#10B981"
              suffix="%"
            />
            <PerformanceGauge
              label="Velocidade de Resposta"
              value={Math.min(100, Math.max(0, 100 - (metrics.tempoMedioResposta / 50)))}
              target={90}
              color="#3B82F6"
              displayValue={`${(metrics.tempoMedioResposta / 1000).toFixed(1)}s`}
            />
            <PerformanceGauge
              label="Volume Diário"
              value={Math.min(100, (metrics.totalHoje / Math.max(metrics.totalMes / 30, 1)) * 100)}
              target={70}
              color={accentColor}
              displayValue={`${metrics.totalHoje}`}
            />
          </div>
        </div>
      </div>

      {/* Recent Escalations (Full Width) */}
      <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400" />
            <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Últimas Escalações — Revisão de Risco</h3>
          </div>
          <span className="text-[10px] font-medium px-2 py-1 rounded-full" style={{ background: '#EF444415', color: '#EF4444' }}>
            {metrics.recentEscalations.length} registros
          </span>
        </div>
        {metrics.recentEscalations.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Nenhuma escalação registrada</p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>A GIA está resolvendo tudo sozinha!</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-80 overflow-auto">
            {metrics.recentEscalations.map(esc => (
              <motion.div
                key={esc.id}
                className="rounded-xl p-3 cursor-pointer transition-all hover:scale-[1.002]"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)' }}
                onClick={() => setSelectedLog(selectedLog?.id === esc.id ? null : esc)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: '#F59E0B15' }}>
                    <ShieldAlert className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold" style={{ color: accentColor }}>
                        {esc.cliente_nome || 'Cliente'}
                      </span>
                      <span className="text-[9px]" style={{ color: 'var(--text-tertiary)' }}>
                        {formatTimeAgo(esc.created_at)}
                      </span>
                    </div>
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                      Cliente: "{esc.mensagem_cliente}"
                    </p>
                    <AnimatePresence>
                      {selectedLog?.id === esc.id && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-2 pt-2 space-y-2" style={{ borderTop: '1px solid var(--border-primary)' }}>
                            <div>
                              <span className="text-[9px] font-bold uppercase" style={{ color: '#3B82F6' }}>Resposta GIA:</span>
                              <p className="text-xs mt-0.5 whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>
                                {esc.resposta_gia || '(sem resposta)'}
                              </p>
                            </div>
                            <div>
                              <span className="text-[9px] font-bold uppercase text-amber-400">Motivo:</span>
                              <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                {esc.motivo_transferencia || 'Não especificado'}
                              </p>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Interactions Feed */}
      <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4" style={{ color: accentColor }} />
          <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Feed de Atendimentos em Tempo Real</h3>
        </div>
        {metrics.recentInteractions.length === 0 ? (
          <div className="text-center py-8">
            <Brain className="w-10 h-10 mx-auto mb-2" style={{ color: 'var(--text-tertiary)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Nenhum atendimento ainda</p>
            <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Os atendimentos aparecerão aqui em tempo real</p>
          </div>
        ) : (
          <div className="space-y-1.5 max-h-96 overflow-auto">
            {metrics.recentInteractions.map(log => (
              <div
                key={log.id}
                className="flex items-center gap-3 p-2.5 rounded-xl transition-all hover:bg-white/5"
                style={{ background: log.transferiu_para_humano ? '#F59E0B08' : 'transparent' }}
              >
                <div
                  className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    background: log.transferiu_para_humano ? '#F59E0B15' : `${accentColor}15`,
                  }}
                >
                  {log.transferiu_para_humano
                    ? <ArrowUpRight className="w-3 h-3 text-amber-400" />
                    : <CheckCircle2 className="w-3 h-3" style={{ color: '#10B981' }} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] truncate" style={{ color: 'var(--text-primary)' }}>
                    {log.mensagem_cliente}
                  </p>
                  <p className="text-[10px] truncate" style={{ color: 'var(--text-tertiary)' }}>
                    GIA: {log.resposta_gia?.substring(0, 80)}...
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-[9px] tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                    {(log.tempo_resposta_ms / 1000).toFixed(1)}s
                  </span>
                  <span className="text-[9px] tabular-nums" style={{ color: 'var(--text-tertiary)' }}>
                    {log.tokens_usados}tk
                  </span>
                  <span className="text-[9px]" style={{ color: 'var(--text-tertiary)' }}>
                    {formatTimeAgo(log.created_at)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KPICard({ icon: Icon, label, value, color, subtitle, warning, pulse }: {
  icon: any; label: string; value: string | number; color: string; subtitle?: string; warning?: boolean; pulse?: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-4 relative overflow-hidden"
      style={{ background: 'var(--bg-card)', border: `1px solid ${warning ? '#EF444440' : 'var(--border-primary)'}` }}
    >
      {pulse && (
        <div className="absolute top-3 right-3 w-2 h-2 rounded-full animate-pulse" style={{ background: color }} />
      )}
      <div className="w-8 h-8 rounded-xl flex items-center justify-center mb-2" style={{ background: `${color}15` }}>
        <Icon className="w-4 h-4" style={{ color }} />
      </div>
      <p className="text-2xl font-black tabular-nums" style={{ color: 'var(--text-primary)' }}>
        {value}
      </p>
      <p className="text-[11px] font-medium mt-0.5" style={{ color: 'var(--text-secondary)' }}>{label}</p>
      {subtitle && (
        <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{subtitle}</p>
      )}
    </div>
  );
}

function PerformanceGauge({ label, value, target, color, suffix, displayValue }: {
  label: string; value: number; target: number; color: string; suffix?: string; displayValue?: string;
}) {
  const clampedValue = Math.min(100, Math.max(0, value));
  const isAboveTarget = clampedValue >= target;

  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
        <span className="text-xs font-bold tabular-nums" style={{ color: isAboveTarget ? '#10B981' : '#F59E0B' }}>
          {displayValue || `${clampedValue.toFixed(0)}${suffix || ''}`}
        </span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
        <motion.div
          className="h-full rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${clampedValue}%` }}
          transition={{ duration: 1, ease: 'easeOut' }}
          style={{
            background: `linear-gradient(90deg, ${color}80, ${color})`,
          }}
        />
      </div>
      <div className="flex justify-end mt-0.5">
        <span className="text-[8px]" style={{ color: 'var(--text-tertiary)' }}>Meta: {target}%</span>
      </div>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function formatTimeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'agora';
  if (min < 60) return `${min}m`;
  const hrs = Math.floor(min / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}
