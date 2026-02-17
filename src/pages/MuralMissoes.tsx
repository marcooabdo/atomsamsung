import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Bot,
  Wifi,
  WifiOff,
  Zap,
  RefreshCw,
  Plus,
  Activity,
  Target,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { BOARD_CONFIG, ACTIVE_SECTORS, type SectorKey } from '../config/boardConfig';

interface MuralTarefa {
  id: string;
  created_at: string;
  setor: string;
  prioridade: 'alta' | 'normal';
  titulo: string;
  descricao: string;
  status: 'pendente' | 'concluido';
  gia_responsavel: string;
  concluido_por: string | null;
  concluido_at: string | null;
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);

  if (diffMin < 1) return 'agora';
  if (diffMin < 60) return `${diffMin}min atras`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h atras`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

interface TaskCardProps {
  task: MuralTarefa;
  onComplete: (id: string) => void;
  completing: boolean;
  accentColor: string;
}

function TaskCard({ task, onComplete, completing, accentColor }: TaskCardProps) {
  const isAlta = task.prioridade === 'alta';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, x: 40 }}
      transition={{ duration: 0.3, type: 'spring', stiffness: 300, damping: 25 }}
      className="relative rounded-xl overflow-hidden"
      style={{
        background: 'rgba(10,15,30,0.8)',
        border: `1px solid ${isAlta ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.08)'}`,
        boxShadow: isAlta ? '0 0 20px rgba(239,68,68,0.15)' : '0 2px 12px rgba(0,0,0,0.3)',
      }}
    >
      {isAlta && (
        <div
          className="absolute top-0 left-0 right-0 h-0.5 animate-pulse"
          style={{ background: 'linear-gradient(90deg, transparent, #EF4444, transparent)' }}
        />
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-start gap-2 flex-1 min-w-0">
            {isAlta && (
              <div className="flex-shrink-0 mt-0.5">
                <AlertTriangle
                  className="w-4 h-4 text-red-400 animate-pulse"
                  style={{ filter: 'drop-shadow(0 0 4px rgba(239,68,68,0.8))' }}
                />
              </div>
            )}
            <p
              className="text-sm font-bold leading-tight"
              style={{ color: isAlta ? '#F87171' : '#F1F5F9' }}
            >
              {task.titulo}
            </p>
          </div>

          <span
            className="flex-shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider"
            style={{
              background: isAlta ? 'rgba(239,68,68,0.2)' : 'rgba(255,255,255,0.08)',
              color: isAlta ? '#F87171' : '#94A3B8',
              border: `1px solid ${isAlta ? 'rgba(239,68,68,0.4)' : 'rgba(255,255,255,0.1)'}`,
            }}
          >
            {isAlta ? 'ALTA' : 'NORMAL'}
          </span>
        </div>

        {task.descricao && (
          <p className="text-xs text-slate-400 leading-relaxed mb-3 line-clamp-3">
            {task.descricao}
          </p>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <Bot className="w-3 h-3" style={{ color: accentColor, opacity: 0.7 }} />
              <span className="text-[10px] font-medium" style={{ color: accentColor, opacity: 0.8 }}>
                {task.gia_responsavel}
              </span>
            </div>
            <div className="flex items-center gap-1 text-slate-500">
              <Clock className="w-3 h-3" />
              <span className="text-[10px]">{formatTime(task.created_at)}</span>
            </div>
          </div>

          <button
            onClick={() => onComplete(task.id)}
            disabled={completing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
            style={{
              background: completing
                ? 'rgba(255,255,255,0.05)'
                : `linear-gradient(135deg, ${accentColor}25, ${accentColor}10)`,
              border: `1px solid ${accentColor}50`,
              color: accentColor,
            }}
            onMouseEnter={(e) => {
              if (!completing) {
                e.currentTarget.style.background = `linear-gradient(135deg, ${accentColor}40, ${accentColor}20)`;
                e.currentTarget.style.boxShadow = `0 0 10px ${accentColor}40`;
              }
            }}
            onMouseLeave={(e) => {
              if (!completing) {
                e.currentTarget.style.background = `linear-gradient(135deg, ${accentColor}25, ${accentColor}10)`;
                e.currentTarget.style.boxShadow = 'none';
              }
            }}
          >
            {completing ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3 h-3" />
            )}
            {completing ? 'SALVANDO' : 'CONCLUIR'}
          </button>
        </div>
      </div>
    </motion.div>
  );
}

interface SectorColumnProps {
  sectorKey: SectorKey;
  tasks: MuralTarefa[];
  completingId: string | null;
  onComplete: (id: string) => void;
}

function SectorColumn({ sectorKey, tasks, completingId, onComplete }: SectorColumnProps) {
  const config = BOARD_CONFIG[sectorKey];
  if (!config) return null;

  const Icon = config.icon;
  const highCount = tasks.filter((t) => t.prioridade === 'alta').length;

  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden flex-1 min-w-0"
      style={{
        background: 'rgba(8,12,24,0.7)',
        border: `1px solid ${config.borderColor}`,
        backdropFilter: 'blur(12px)',
      }}
    >
      <div
        className="px-5 py-4 flex items-center justify-between flex-shrink-0"
        style={{ background: config.headerGradient, borderBottom: `1px solid ${config.borderColor}` }}
      >
        <div className="flex items-center gap-3">
          <div
            className="p-2 rounded-lg"
            style={{
              background: config.badgeColor,
              border: `1px solid ${config.accentColor}30`,
            }}
          >
            <Icon className="w-4 h-4" style={{ color: config.accentColor }} />
          </div>
          <div>
            <h3 className="text-sm font-bold tracking-wide" style={{ color: config.accentColor }}>
              {config.title.toUpperCase()}
            </h3>
            <p className="text-[10px] text-slate-500 mt-0.5">
              {tasks.length} {tasks.length === 1 ? 'missao pendente' : 'missoes pendentes'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {highCount > 0 && (
            <div
              className="flex items-center gap-1 px-2 py-1 rounded-full animate-pulse"
              style={{
                background: 'rgba(239,68,68,0.2)',
                border: '1px solid rgba(239,68,68,0.4)',
              }}
            >
              <AlertTriangle className="w-3 h-3 text-red-400" />
              <span className="text-[10px] font-bold text-red-400">{highCount}</span>
            </div>
          )}
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
            style={{
              background: config.badgeColor,
              color: config.accentColor,
              border: `1px solid ${config.accentColor}40`,
            }}
          >
            {tasks.length}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3 cyber-scrollbar min-h-[200px]">
        <AnimatePresence mode="popLayout">
          {tasks.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-12 text-center"
            >
              <div
                className="w-12 h-12 rounded-full flex items-center justify-center mb-3"
                style={{ background: config.badgeColor }}
              >
                <CheckCircle2 className="w-6 h-6" style={{ color: config.accentColor, opacity: 0.5 }} />
              </div>
              <p className="text-xs text-slate-500 font-medium">Nenhuma missao pendente</p>
              <p className="text-[10px] text-slate-600 mt-1">Aguardando instrucoes da GIA</p>
            </motion.div>
          ) : (
            tasks.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onComplete={onComplete}
                completing={completingId === task.id}
                accentColor={config.accentColor}
              />
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export function MuralMissoes() {
  const [tasks, setTasks] = useState<MuralTarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [newTaskPing, setNewTaskPing] = useState(false);

  const sortTasks = (list: MuralTarefa[]) =>
    [...list].sort((a, b) => {
      if (a.prioridade === 'alta' && b.prioridade !== 'alta') return -1;
      if (a.prioridade !== 'alta' && b.prioridade === 'alta') return 1;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

  const loadTasks = useCallback(async () => {
    const { data, error } = await supabase
      .from('gia_mural_tarefas')
      .select('*')
      .eq('status', 'pendente')
      .order('created_at', { ascending: true });

    if (!error && data) {
      setTasks(sortTasks(data as MuralTarefa[]));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTasks();

    const channel = supabase
      .channel('mural-tarefas-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'gia_mural_tarefas' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newTask = payload.new as MuralTarefa;
            if (newTask.status === 'pendente') {
              setTasks((prev) => sortTasks([...prev, newTask]));
              setNewTaskPing(true);
              setTimeout(() => setNewTaskPing(false), 3000);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updated = payload.new as MuralTarefa;
            if (updated.status === 'concluido') {
              setTasks((prev) => prev.filter((t) => t.id !== updated.id));
              setCompletedCount((c) => c + 1);
            } else {
              setTasks((prev) =>
                sortTasks(prev.map((t) => (t.id === updated.id ? updated : t)))
              );
            }
          } else if (payload.eventType === 'DELETE') {
            setTasks((prev) => prev.filter((t) => t.id !== (payload.old as MuralTarefa).id));
          }
        }
      )
      .subscribe((status) => {
        setConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadTasks]);

  const handleComplete = async (id: string) => {
    setCompletingId(id);
    try {
      await supabase
        .from('gia_mural_tarefas')
        .update({ status: 'concluido', concluido_at: new Date().toISOString() })
        .eq('id', id);
    } catch (err) {
      console.error('Erro ao concluir tarefa:', err);
    } finally {
      setCompletingId(null);
    }
  };

  const totalPending = tasks.length;
  const highPriorityCount = tasks.filter((t) => t.prioridade === 'alta').length;

  return (
    <div
      className="flex flex-col h-full min-h-screen"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      <div
        className="flex-shrink-0 px-6 py-4 flex items-center justify-between"
        style={{
          background: 'rgba(8,12,24,0.9)',
          borderBottom: '1px solid rgba(0,212,255,0.15)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div
              className="p-2.5 rounded-xl"
              style={{
                background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(57,255,20,0.1))',
                border: '1px solid rgba(0,212,255,0.3)',
                boxShadow: '0 0 20px rgba(0,212,255,0.15)',
              }}
            >
              <Target className="w-6 h-6 text-[#00D4FF]" />
            </div>
            <div>
              <h1
                className="text-xl font-black tracking-widest uppercase"
                style={{
                  background: 'linear-gradient(90deg, #00D4FF, #39FF14)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                  textShadow: 'none',
                  letterSpacing: '0.15em',
                }}
              >
                ATOM Command Center
              </h1>
              <p className="text-[10px] text-slate-500 tracking-widest uppercase">
                Mural de Missoes — Realtime
              </p>
            </div>
          </div>

          {newTaskPing && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, x: -10 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full"
              style={{
                background: 'rgba(57,255,20,0.15)',
                border: '1px solid rgba(57,255,20,0.4)',
              }}
            >
              <Plus className="w-3.5 h-3.5 text-[#39FF14] animate-spin" />
              <span className="text-xs font-bold text-[#39FF14]">Nova Missao!</span>
            </motion.div>
          )}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="text-xl font-black" style={{ color: '#00D4FF' }}>
                {totalPending}
              </div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider">Pendentes</div>
            </div>
            {highPriorityCount > 0 && (
              <div className="text-center">
                <div className="text-xl font-black text-red-400 animate-pulse">
                  {highPriorityCount}
                </div>
                <div className="text-[9px] text-slate-500 uppercase tracking-wider">Alta Prior.</div>
              </div>
            )}
            <div className="text-center">
              <div className="text-xl font-black text-[#39FF14]">{completedCount}</div>
              <div className="text-[9px] text-slate-500 uppercase tracking-wider">Concluidas</div>
            </div>
          </div>

          <div className="w-px h-8 bg-slate-700" />

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              {connected ? (
                <>
                  <div className="relative">
                    <div className="w-2 h-2 rounded-full bg-[#39FF14]" />
                    <div className="absolute inset-0 w-2 h-2 rounded-full bg-[#39FF14] animate-ping opacity-60" />
                  </div>
                  <div className="flex items-center gap-1">
                    <Wifi className="w-3.5 h-3.5 text-[#39FF14]" />
                    <span className="text-[10px] text-[#39FF14] font-bold">REALTIME ATIVO</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 rounded-full bg-red-500" />
                  <div className="flex items-center gap-1">
                    <WifiOff className="w-3.5 h-3.5 text-red-400" />
                    <span className="text-[10px] text-red-400 font-bold">DESCONECTADO</span>
                  </div>
                </>
              )}
            </div>
            <button
              onClick={loadTasks}
              className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
              title="Recarregar"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        </div>
      </div>

      {highPriorityCount > 0 && (
        <div
          className="flex-shrink-0 px-6 py-2 flex items-center gap-3"
          style={{
            background: 'linear-gradient(90deg, rgba(239,68,68,0.1), transparent)',
            borderBottom: '1px solid rgba(239,68,68,0.2)',
          }}
        >
          <Activity className="w-4 h-4 text-red-400 animate-pulse" />
          <span className="text-xs font-bold text-red-400">
            ATENCAO: {highPriorityCount} {highPriorityCount === 1 ? 'missao de alta prioridade requer' : 'missoes de alta prioridade requerem'} atencao imediata
          </span>
          <Zap className="w-4 h-4 text-red-400 animate-pulse" />
        </div>
      )}

      <div className="flex-1 overflow-hidden p-5">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="futuristic-loader" />
              <p className="text-sm text-slate-400">Conectando ao banco de dados...</p>
            </div>
          </div>
        ) : (
          <div className="h-full flex gap-4 overflow-x-auto">
            {ACTIVE_SECTORS.map((sectorKey) => {
              const sectorTasks = tasks.filter((t) => t.setor === sectorKey);
              return (
                <SectorColumn
                  key={sectorKey}
                  sectorKey={sectorKey}
                  tasks={sectorTasks}
                  completingId={completingId}
                  onComplete={handleComplete}
                />
              );
            })}
          </div>
        )}
      </div>

      <div
        className="flex-shrink-0 px-6 py-2 flex items-center justify-between"
        style={{
          borderTop: '1px solid rgba(255,255,255,0.05)',
          background: 'rgba(8,12,24,0.6)',
        }}
      >
        <div className="flex items-center gap-2">
          <Bot className="w-3.5 h-3.5 text-slate-600" />
          <span className="text-[10px] text-slate-600">
            Alimentado por Agentes de IA — as tarefas sao criadas automaticamente pelo backend
          </span>
        </div>
        <span className="text-[10px] text-slate-600">
          {new Date().toLocaleString('pt-BR')}
        </span>
      </div>
    </div>
  );
}
