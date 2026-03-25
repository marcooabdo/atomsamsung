import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Bot,
  Flame,
  Layers,
  Radio,
  RefreshCw,
  Target,
  Wifi,
  WifiOff,
  Zap,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useNeonGreen } from '../contexts/ThemeContext';
import type { MuralTarefa } from './mural/types';
import { getGiaAgents } from './mural/constants';
import { agentMatchesTask, sortTasks } from './mural/utils';
import { LiveClock } from './mural/LiveClock';
import { ScanlineOverlay } from './mural/ScanlineOverlay';
import { AgentLoadBar } from './mural/AgentLoadBar';
import { AgentColumn } from './mural/AgentColumn';

export function MuralMissoes() {
  const { unidadeAtual, usuario } = useAuth();
  const neonGreen = useNeonGreen();
  const GIA_AGENTS = getGiaAgents(neonGreen);
  const [tasks, setTasks] = useState<MuralTarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [newTaskFlash, setNewTaskFlash] = useState(false);
  const [activeAgentIdx, setActiveAgentIdx] = useState(0);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isMaster = usuario?.tipo === 'master' || usuario?.tipo === 'diretoria';

  const loadTasks = useCallback(async () => {
    let query = supabase
      .from('gia_mural_tarefas')
      .select('*')
      .eq('status', 'pendente')
      .order('created_at', { ascending: true });

    if (!isMaster && unidadeAtual) {
      query = query.or(`unidade_id.eq.${unidadeAtual},unidade_id.is.null`);
    }

    const { data, error } = await query;
    if (!error && data) setTasks(sortTasks(data as MuralTarefa[]));
    setLoading(false);
  }, [unidadeAtual, isMaster]);

  useEffect(() => {
    loadTasks();
    const channel = supabase
      .channel('mural-tarefas-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gia_mural_tarefas' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const t = payload.new as MuralTarefa;
          const belongsToUnit = isMaster || !t.unidade_id || t.unidade_id === unidadeAtual;
          if (t.status === 'pendente' && belongsToUnit) {
            setTasks((prev) => sortTasks([...prev, t]));
            setNewTaskFlash(true);
            if (flashTimeout.current) clearTimeout(flashTimeout.current);
            flashTimeout.current = setTimeout(() => setNewTaskFlash(false), 4000);
          }
        } else if (payload.eventType === 'UPDATE') {
          const t = payload.new as MuralTarefa;
          if (t.status === 'concluido') {
            setTasks((prev) => prev.filter((x) => x.id !== t.id));
            setCompletedCount((c) => c + 1);
          } else {
            setTasks((prev) => sortTasks(prev.map((x) => (x.id === t.id ? t : x))));
          }
        } else if (payload.eventType === 'DELETE') {
          setTasks((prev) => prev.filter((x) => x.id !== (payload.old as MuralTarefa).id));
        }
      })
      .subscribe((s) => setConnected(s === 'SUBSCRIBED'));

    return () => {
      supabase.removeChannel(channel);
      if (flashTimeout.current) clearTimeout(flashTimeout.current);
    };
  }, [loadTasks]);

  const handleComplete = async (id: string) => {
    setCompletingId(id);
    try {
      await supabase
        .from('gia_mural_tarefas')
        .update({ status: 'concluido', concluido_at: new Date().toISOString() })
        .eq('id', id);
    } finally {
      setCompletingId(null);
    }
  };

  const totalPending = tasks.length;
  const highPriorityCount = tasks.filter((t) => t.prioridade === 'alta').length;

  void completedCount;

  return (
    <div
      className="flex flex-col relative overflow-hidden"
      style={{ height: '100vh', background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      <ScanlineOverlay />

      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-10" style={{ background: '#00D4FF', filter: 'blur(120px)', transform: 'translate(-50%,-50%)' }} />
        <div className="absolute bottom-1/3 right-1/4 w-72 h-72 rounded-full opacity-10" style={{ background: neonGreen, filter: 'blur(130px)', transform: 'translate(50%,50%)' }} />
      </div>

      <div className="absolute top-0 left-0 right-0 h-px z-10" style={{ background: `linear-gradient(90deg, transparent, #00D4FF 30%, ${neonGreen} 70%, transparent)` }} />

      <div
        className="relative z-10 flex-shrink-0 px-5 py-2.5 flex items-center justify-between"
        style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)', backdropFilter: 'blur(24px)' }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div
              className="relative w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(57,255,20,0.06))', border: '1px solid rgba(0,212,255,0.35)', boxShadow: '0 0 20px rgba(0,212,255,0.15)' }}
            >
              <Target style={{ width: 18, height: 18, color: '#00D4FF' }} />
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full animate-pulse" style={{ background: neonGreen, boxShadow: `0 0 8px ${neonGreen}` }} />
            </div>
            <div>
              <h1
                className="text-base font-black tracking-[0.2em] uppercase leading-none"
                style={{ background: `linear-gradient(90deg, #00D4FF, ${neonGreen})`, WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
              >
                ATOM COMMAND
              </h1>
              <p className="text-[8px] text-slate-600 tracking-[0.3em] uppercase font-mono mt-0.5">GROUP GLOBAL — REALTIME</p>
            </div>
          </div>

          <AnimatePresence>
            {newTaskFlash && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, x: -8 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.85 }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full"
                style={{ background: `${neonGreen}1A`, border: `1px solid ${neonGreen}4D`, boxShadow: `0 0 12px ${neonGreen}1F` }}
              >
                <Zap className="w-2.5 h-2.5 animate-pulse" style={{ color: neonGreen }} />
                <span className="text-[9px] font-black tracking-wider font-mono" style={{ color: neonGreen }}>NOVA MISSAO</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
              style={{ background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.15)' }}
            >
              <Layers className="w-3 h-3 text-[#00D4FF]" />
              <span className="text-sm font-black text-[#00D4FF] tabular-nums">{totalPending}</span>
            </div>
            {highPriorityCount > 0 && (
              <div
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
                style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}
              >
                <Flame className="w-3 h-3 text-red-400 animate-pulse" />
                <span className="text-sm font-black text-red-400 tabular-nums">{highPriorityCount}</span>
              </div>
            )}
          </div>

          <div className="h-6 w-px bg-slate-800" />

          <div className="flex items-center gap-2">
            {connected ? (
              <>
                <div className="relative">
                  <div className="w-2 h-2 rounded-full" style={{ background: neonGreen, boxShadow: `0 0 6px ${neonGreen}` }} />
                  <div className="absolute inset-0 w-2 h-2 rounded-full animate-ping opacity-40" style={{ background: neonGreen }} />
                </div>
                <Wifi className="w-3 h-3" style={{ color: neonGreen }} />
                <span className="text-[9px] font-black tracking-wider font-mono" style={{ color: neonGreen }}>ONLINE</span>
              </>
            ) : (
              <>
                <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                <WifiOff className="w-3 h-3 text-red-400" />
                <span className="text-[9px] text-red-400 font-black font-mono">OFFLINE</span>
              </>
            )}
            <button onClick={loadTasks} className="p-1 rounded hover:bg-white/5 transition-colors">
              <RefreshCw className="w-3 h-3 text-slate-600" />
            </button>
          </div>

          <LiveClock />
        </div>
      </div>

      <AnimatePresence>
        {highPriorityCount > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="relative z-10 flex-shrink-0 overflow-hidden"
          >
            <div className="px-5 py-1.5 flex items-center justify-between" style={{ background: 'linear-gradient(90deg, rgba(239,68,68,0.1), transparent)', borderBottom: '1px solid rgba(239,68,68,0.15)' }}>
              <div className="flex items-center gap-2">
                <Flame className="w-3.5 h-3.5 text-red-400 animate-pulse" style={{ filter: 'drop-shadow(0 0 3px rgba(239,68,68,0.8))' }} />
                <span className="text-[10px] font-black text-red-400 tracking-wider uppercase font-mono">
                  ALERTA: {highPriorityCount} {highPriorityCount === 1 ? 'missao critica' : 'missoes criticas'} aguardando resolucao
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <Activity className="w-3 h-3 text-red-600 animate-pulse" />
                <span className="text-[9px] font-mono text-red-700">PRIORIDADE_MAXIMA</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AgentLoadBar
        agents={GIA_AGENTS}
        tasks={tasks}
        activeAgentIdx={activeAgentIdx}
        onAgentClick={setActiveAgentIdx}
      />

      <div className="relative z-10 flex-1 overflow-hidden p-3">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: '#00D4FF', borderRightColor: neonGreen }} />
                <div className="absolute inset-2 rounded-full border border-transparent animate-spin" style={{ borderBottomColor: '#00D4FF', animationDirection: 'reverse', animationDuration: '0.6s' }} />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Radio className="w-5 h-5 text-[#00D4FF] animate-pulse" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-[#00D4FF] tracking-wider font-mono">CONECTANDO AO ATOM...</p>
                <p className="text-[10px] text-slate-600 font-mono mt-1">sincronizando_banco_de_dados...</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex gap-3 overflow-x-auto pb-1">
            {GIA_AGENTS.map((agent) => {
              const agentTasks = tasks.filter((t) => agentMatchesTask(agent, t));
              return (
                <AgentColumn
                  key={agent.shortName}
                  agent={agent}
                  tasks={agentTasks}
                  completingId={completingId}
                  onComplete={handleComplete}
                />
              );
            })}
          </div>
        )}
      </div>

      <div
        className="relative z-10 flex-shrink-0 px-5 py-1.5 flex items-center justify-between"
        style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-primary)' }}
      >
        <div className="flex items-center gap-1.5">
          <Bot className="w-3 h-3 text-slate-800" />
          <span className="text-[9px] text-slate-800 font-mono">ATOM INTELLIGENCE SYSTEM — V2.0</span>
        </div>
        <div className="flex items-center gap-3 text-[9px] font-mono text-slate-800">
          <span>GIA_MURAL_TAREFAS</span>
          <span className="text-slate-700">|</span>
          <span style={{ color: neonGreen, opacity: 0.5 }}>ESTADO: {connected ? 'ATIVO' : 'OFFLINE'}</span>
        </div>
      </div>
    </div>
  );
}
