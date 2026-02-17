import { useEffect, useState, useCallback, useRef } from 'react';
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
  Activity,
  Target,
  Shield,
  Cpu,
  ChevronRight,
  Layers,
  Database,
  Radio,
  Eye,
  Flame,
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
  if (diffMin < 60) return `${diffMin}min`;
  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
}

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="font-mono text-[#00D4FF] font-bold tabular-nums">
      {time.toLocaleTimeString('pt-BR')}
    </span>
  );
}

function ScanlineOverlay() {
  return (
    <div
      className="pointer-events-none fixed inset-0 z-0"
      style={{
        background:
          'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.03) 2px, rgba(0,0,0,0.03) 4px)',
      }}
    />
  );
}

function GlowOrb({ color, size, top, left, blur }: { color: string; size: number; top: string; left: string; blur: number }) {
  return (
    <div
      className="pointer-events-none absolute rounded-full opacity-20"
      style={{
        width: size,
        height: size,
        top,
        left,
        background: color,
        filter: `blur(${blur}px)`,
        transform: 'translate(-50%, -50%)',
      }}
    />
  );
}

interface GIAAgentLoadProps {
  name: string;
  color: string;
  taskCount: number;
  maxLoad: number;
  highCount: number;
}

function GIAAgentLoad({ name, color, taskCount, maxLoad, highCount }: GIAAgentLoadProps) {
  const pct = Math.min((taskCount / maxLoad) * 100, 100);
  const isOverloaded = pct >= 80;
  const isActive = taskCount > 0;
  const shortName = name.replace('GIA ', '');

  return (
    <div
      className="flex flex-col gap-1 px-3 py-2 rounded-xl flex-shrink-0"
      style={{
        background: isActive ? `${color}08` : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isActive ? `${color}25` : 'rgba(255,255,255,0.06)'}`,
        minWidth: 90,
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          <div
            className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${isActive ? (isOverloaded ? 'animate-pulse' : '') : ''}`}
            style={{ background: isActive ? color : '#1E293B', boxShadow: isActive ? `0 0 4px ${color}` : 'none' }}
          />
          <span
            className="text-[10px] font-black tracking-wider"
            style={{ color: isActive ? color : '#334155' }}
          >
            {shortName}
          </span>
        </div>
        {highCount > 0 && (
          <span
            className="text-[8px] font-black px-1 rounded animate-pulse"
            style={{ background: 'rgba(239,68,68,0.2)', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)' }}
          >
            {highCount}!
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
          {isActive && (
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              style={{
                background: isOverloaded
                  ? `linear-gradient(90deg, ${color}, #EF4444)`
                  : `linear-gradient(90deg, ${color}80, ${color})`,
                boxShadow: isActive ? `0 0 4px ${color}60` : 'none',
              }}
            />
          )}
        </div>
        <span
          className="text-[9px] font-mono tabular-nums flex-shrink-0"
          style={{ color: isActive ? color : '#1E293B' }}
        >
          {taskCount}/{maxLoad}
        </span>
      </div>
    </div>
  );
}

const GIA_AGENTS = [
  { name: 'GIA Prime', color: '#00D4FF', maxLoad: 8 },
  { name: 'GIA Connect', color: '#39FF14', maxLoad: 6 },
  { name: 'GIA Sales', color: '#FF6B35', maxLoad: 5 },
  { name: 'GIA Stock', color: '#00D4FF', maxLoad: 6 },
  { name: 'GIA Fiscal', color: '#FFA500', maxLoad: 4 },
  { name: 'GIA Audit', color: '#39FF14', maxLoad: 5 },
  { name: 'GIA Tech', color: '#00D4FF', maxLoad: 7 },
  { name: 'GIA Logistics', color: '#39FF14', maxLoad: 5 },
  { name: 'GIA Monitor', color: '#FF2D78', maxLoad: 4 },
  { name: 'GIA Growth', color: '#FF6B35', maxLoad: 4 },
  { name: 'GIA ESI', color: '#00D4FF', maxLoad: 3 },
  { name: 'GIA Warranty', color: '#FFA500', maxLoad: 4 },
  { name: 'GIA Skywalker', color: '#A78BFA', maxLoad: 3 },
];

interface StatCardProps {
  label: string;
  value: string | number;
  icon: React.ElementType;
  color: string;
  pulse?: boolean;
}

function StatCard({ label, value, icon: Icon, color, pulse }: StatCardProps) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 rounded-xl"
      style={{
        background: `${color}08`,
        border: `1px solid ${color}25`,
      }}
    >
      <div
        className="p-2 rounded-lg flex-shrink-0"
        style={{ background: `${color}15`, border: `1px solid ${color}30` }}
      >
        <Icon
          className={`w-4 h-4 ${pulse ? 'animate-pulse' : ''}`}
          style={{ color }}
        />
      </div>
      <div>
        <div
          className={`text-2xl font-black tabular-nums leading-none ${pulse ? 'animate-pulse' : ''}`}
          style={{ color }}
        >
          {value}
        </div>
        <div className="text-[9px] text-slate-500 uppercase tracking-widest mt-0.5">{label}</div>
      </div>
    </div>
  );
}

interface TaskCardProps {
  task: MuralTarefa;
  onComplete: (id: string) => void;
  completing: boolean;
  accentColor: string;
  index: number;
}

function TaskCard({ task, onComplete, completing, accentColor, index }: TaskCardProps) {
  const isAlta = task.prioridade === 'alta';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.88, x: 60, filter: 'blur(4px)' }}
      transition={{ duration: 0.35, type: 'spring', stiffness: 280, damping: 22, delay: index * 0.04 }}
      className="relative rounded-xl overflow-hidden group"
      style={{
        background: isAlta
          ? 'linear-gradient(135deg, rgba(239,68,68,0.06), rgba(10,15,30,0.9))'
          : 'linear-gradient(135deg, rgba(15,23,42,0.9), rgba(8,12,24,0.95))',
        border: `1px solid ${isAlta ? 'rgba(239,68,68,0.35)' : 'rgba(255,255,255,0.07)'}`,
        boxShadow: isAlta
          ? '0 4px 24px rgba(239,68,68,0.12), inset 0 1px 0 rgba(239,68,68,0.1)'
          : '0 2px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.03)',
      }}
    >
      {isAlta && (
        <>
          <div
            className="absolute top-0 left-0 right-0 h-px animate-pulse"
            style={{ background: 'linear-gradient(90deg, transparent 0%, #EF4444 50%, transparent 100%)' }}
          />
          <div
            className="absolute left-0 top-0 bottom-0 w-px"
            style={{ background: 'linear-gradient(180deg, transparent, #EF4444, transparent)' }}
          />
        </>
      )}

      <div
        className="absolute right-0 top-0 bottom-0 w-px opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: `linear-gradient(180deg, transparent, ${accentColor}, transparent)` }}
      />

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {isAlta ? (
              <Flame
                className="w-3.5 h-3.5 flex-shrink-0 animate-pulse"
                style={{ color: '#EF4444', filter: 'drop-shadow(0 0 6px rgba(239,68,68,1))' }}
              />
            ) : (
              <ChevronRight className="w-3 h-3 flex-shrink-0 opacity-30" style={{ color: accentColor }} />
            )}
            <p
              className="text-[13px] font-bold leading-snug"
              style={{ color: isAlta ? '#FCA5A5' : '#E2E8F0' }}
            >
              {task.titulo}
            </p>
          </div>

          <span
            className="flex-shrink-0 text-[9px] font-black px-2 py-0.5 rounded tracking-widest uppercase"
            style={{
              background: isAlta ? 'rgba(239,68,68,0.18)' : `${accentColor}12`,
              color: isAlta ? '#F87171' : accentColor,
              border: `1px solid ${isAlta ? 'rgba(239,68,68,0.3)' : `${accentColor}30`}`,
            }}
          >
            {isAlta ? '!! ALTA' : 'NORMAL'}
          </span>
        </div>

        {task.descricao && (
          <p className="text-[11px] text-slate-500 leading-relaxed mb-3 pl-5 line-clamp-2 border-l border-slate-700/50">
            {task.descricao}
          </p>
        )}

        <div
          className="flex items-center justify-between pt-2.5"
          style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}
        >
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div
                className="w-4 h-4 rounded-full flex items-center justify-center"
                style={{ background: `${accentColor}20`, border: `1px solid ${accentColor}40` }}
              >
                <Bot className="w-2.5 h-2.5" style={{ color: accentColor }} />
              </div>
              <span className="text-[10px] font-semibold" style={{ color: accentColor }}>
                {task.gia_responsavel}
              </span>
            </div>
            <div className="flex items-center gap-1 text-slate-600">
              <Clock className="w-2.5 h-2.5" />
              <span className="text-[10px] font-mono">{formatTime(task.created_at)}</span>
            </div>
          </div>

          <button
            onClick={() => onComplete(task.id)}
            disabled={completing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wider uppercase transition-all duration-200 disabled:opacity-40"
            style={{
              background: completing
                ? 'rgba(255,255,255,0.04)'
                : `linear-gradient(135deg, ${accentColor}22, ${accentColor}08)`,
              border: `1px solid ${accentColor}45`,
              color: accentColor,
            }}
            onMouseEnter={(e) => {
              if (!completing) {
                (e.currentTarget as HTMLButtonElement).style.background = `linear-gradient(135deg, ${accentColor}35, ${accentColor}18)`;
                (e.currentTarget as HTMLButtonElement).style.boxShadow = `0 0 12px ${accentColor}35, 0 0 4px ${accentColor}20`;
              }
            }}
            onMouseLeave={(e) => {
              if (!completing) {
                (e.currentTarget as HTMLButtonElement).style.background = `linear-gradient(135deg, ${accentColor}22, ${accentColor}08)`;
                (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
              }
            }}
          >
            {completing ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3 h-3" />
            )}
            {completing ? 'OK...' : 'CONCLUIR'}
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
  const hasNew = tasks.some((t) => {
    const age = Date.now() - new Date(t.created_at).getTime();
    return age < 30000;
  });

  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden flex-1 min-w-[280px]"
      style={{
        background: 'rgba(7,10,22,0.85)',
        border: `1px solid ${config.borderColor}`,
        backdropFilter: 'blur(20px)',
        boxShadow: `0 0 40px ${config.accentColor}08, inset 0 1px 0 rgba(255,255,255,0.04)`,
      }}
    >
      <div
        className="px-4 py-3.5 flex-shrink-0 relative overflow-hidden"
        style={{ background: config.headerGradient, borderBottom: `1px solid ${config.borderColor}` }}
      >
        <div
          className="absolute inset-0 opacity-30"
          style={{
            background: `radial-gradient(ellipse at top left, ${config.accentColor}20 0%, transparent 60%)`,
          }}
        />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center relative"
              style={{
                background: `linear-gradient(135deg, ${config.accentColor}20, ${config.accentColor}08)`,
                border: `1px solid ${config.accentColor}40`,
                boxShadow: `0 0 16px ${config.accentColor}25`,
              }}
            >
              <Icon className="w-4.5 h-4.5" style={{ color: config.accentColor, width: 18, height: 18 }} />
              {hasNew && (
                <div
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-pulse"
                  style={{ background: config.accentColor, boxShadow: `0 0 6px ${config.accentColor}` }}
                />
              )}
            </div>
            <div>
              <h3
                className="text-sm font-black tracking-widest uppercase"
                style={{ color: config.accentColor, textShadow: `0 0 12px ${config.accentColor}60` }}
              >
                {config.title}
              </h3>
              <div className="flex items-center gap-2 mt-0.5">
                <div className="w-1 h-1 rounded-full" style={{ background: config.accentColor, opacity: 0.6 }} />
                <span className="text-[9px] text-slate-500 tracking-widest uppercase font-mono">
                  {tasks.length} {tasks.length === 1 ? 'MISSAO' : 'MISSOES'} ATIVAS
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {highCount > 0 && (
              <motion.div
                animate={{ scale: [1, 1.08, 1] }}
                transition={{ duration: 1.2, repeat: Infinity }}
                className="flex items-center gap-1 px-2 py-0.5 rounded"
                style={{
                  background: 'rgba(239,68,68,0.15)',
                  border: '1px solid rgba(239,68,68,0.35)',
                }}
              >
                <AlertTriangle className="w-2.5 h-2.5 text-red-400" />
                <span className="text-[9px] font-black text-red-400 tracking-wider">{highCount} ALTA</span>
              </motion.div>
            )}
            <div
              className="min-w-[28px] h-7 px-2 rounded-lg flex items-center justify-center text-xs font-black"
              style={{
                background: tasks.length > 0 ? `${config.accentColor}20` : 'rgba(255,255,255,0.05)',
                color: tasks.length > 0 ? config.accentColor : '#334155',
                border: `1px solid ${tasks.length > 0 ? `${config.accentColor}40` : 'rgba(255,255,255,0.06)'}`,
              }}
            >
              {tasks.length}
            </div>
          </div>
        </div>
      </div>

      <div
        className="px-3 py-2 flex-shrink-0 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.2)' }}
      >
        <div className="flex items-center gap-1.5">
          <Database className="w-2.5 h-2.5" style={{ color: config.accentColor, opacity: 0.5 }} />
          <span className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">
            SETOR.{sectorKey}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Eye className="w-2.5 h-2.5 text-slate-700" />
          <span className="text-[9px] font-mono text-slate-700">REALTIME</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 cyber-scrollbar min-h-[180px]">
        <AnimatePresence mode="popLayout">
          {tasks.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center py-14 text-center"
            >
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4 relative"
                style={{
                  background: `linear-gradient(135deg, ${config.accentColor}10, transparent)`,
                  border: `1px solid ${config.accentColor}20`,
                }}
              >
                <Shield className="w-6 h-6" style={{ color: config.accentColor, opacity: 0.3 }} />
                <div
                  className="absolute inset-0 rounded-2xl animate-pulse"
                  style={{ background: `radial-gradient(ellipse, ${config.accentColor}08, transparent)` }}
                />
              </div>
              <p className="text-xs font-bold text-slate-600 tracking-wider uppercase">Sistema Limpo</p>
              <p className="text-[10px] text-slate-700 mt-1 font-mono">aguardando_instrucoes_gia...</p>
            </motion.div>
          ) : (
            tasks.map((task, i) => (
              <TaskCard
                key={task.id}
                task={task}
                onComplete={onComplete}
                completing={completingId === task.id}
                accentColor={config.accentColor}
                index={i}
              />
            ))
          )}
        </AnimatePresence>
      </div>

      <div
        className="px-3 py-2 flex items-center justify-between flex-shrink-0"
        style={{ borderTop: `1px solid ${config.accentColor}12`, background: 'rgba(0,0,0,0.3)' }}
      >
        <div className="h-1 flex-1 rounded-full overflow-hidden mr-2" style={{ background: 'rgba(255,255,255,0.05)' }}>
          {tasks.length > 0 && (
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min((tasks.length / 10) * 100, 100)}%` }}
              style={{ background: `linear-gradient(90deg, ${config.accentColor}80, ${config.accentColor})` }}
            />
          )}
        </div>
        <span className="text-[9px] font-mono text-slate-600">{tasks.length}/10</span>
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
  const [newTaskFlash, setNewTaskFlash] = useState(false);
  const flashTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gia_mural_tarefas' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newTask = payload.new as MuralTarefa;
          if (newTask.status === 'pendente') {
            setTasks((prev) => sortTasks([...prev, newTask]));
            setNewTaskFlash(true);
            if (flashTimeout.current) clearTimeout(flashTimeout.current);
            flashTimeout.current = setTimeout(() => setNewTaskFlash(false), 4000);
          }
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as MuralTarefa;
          if (updated.status === 'concluido') {
            setTasks((prev) => prev.filter((t) => t.id !== updated.id));
            setCompletedCount((c) => c + 1);
          } else {
            setTasks((prev) => sortTasks(prev.map((t) => (t.id === updated.id ? updated : t))));
          }
        } else if (payload.eventType === 'DELETE') {
          setTasks((prev) => prev.filter((t) => t.id !== (payload.old as MuralTarefa).id));
        }
      })
      .subscribe((status) => setConnected(status === 'SUBSCRIBED'));

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

  return (
    <div
      className="flex flex-col relative overflow-hidden"
      style={{
        height: '100vh',
        background: 'linear-gradient(160deg, #030510 0%, #060a18 40%, #04080f 100%)',
        color: '#E2E8F0',
      }}
    >
      <ScanlineOverlay />
      <GlowOrb color="#00D4FF" size={600} top="0%" left="25%" blur={120} />
      <GlowOrb color="#39FF14" size={400} top="50%" left="75%" blur={140} />
      <GlowOrb color="#FF6B35" size={300} top="80%" left="15%" blur={100} />

      <div
        className="absolute top-0 left-0 right-0 h-px z-10"
        style={{ background: 'linear-gradient(90deg, transparent 0%, #00D4FF 30%, #39FF14 70%, transparent 100%)' }}
      />

      {/* Header */}
      <div
        className="relative z-10 flex-shrink-0 px-6 py-3 flex items-center justify-between"
        style={{
          background: 'rgba(3,5,16,0.9)',
          borderBottom: '1px solid rgba(0,212,255,0.12)',
          backdropFilter: 'blur(24px)',
        }}
      >
        <div className="flex items-center gap-5">
          <div className="flex items-center gap-3">
            <div
              className="relative w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(57,255,20,0.08))',
                border: '1px solid rgba(0,212,255,0.4)',
                boxShadow: '0 0 24px rgba(0,212,255,0.2)',
              }}
            >
              <Target className="w-5 h-5 text-[#00D4FF]" />
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#39FF14] animate-pulse"
                style={{ boxShadow: '0 0 8px #39FF14' }} />
            </div>
            <div>
              <div className="flex items-baseline gap-2">
                <h1
                  className="text-lg font-black tracking-[0.18em] uppercase leading-none"
                  style={{
                    background: 'linear-gradient(90deg, #00D4FF 0%, #39FF14 60%, #00D4FF 100%)',
                    backgroundSize: '200%',
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                    backgroundClip: 'text',
                  }}
                >
                  ATOM Command Center
                </h1>
                <span className="text-[9px] text-slate-600 font-mono tracking-widest border border-slate-700/50 px-1.5 py-0.5 rounded">
                  v2.0
                </span>
              </div>
              <p className="text-[9px] text-slate-600 tracking-[0.25em] uppercase font-mono mt-0.5">
                Mural de Missoes — Group Global Intelligence
              </p>
            </div>
          </div>

          <AnimatePresence>
            {newTaskFlash && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8, x: -10 }}
                animate={{ opacity: 1, scale: 1, x: 0 }}
                exit={{ opacity: 0, scale: 0.85 }}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full"
                style={{
                  background: 'rgba(57,255,20,0.12)',
                  border: '1px solid rgba(57,255,20,0.35)',
                  boxShadow: '0 0 16px rgba(57,255,20,0.15)',
                }}
              >
                <Zap className="w-3 h-3 text-[#39FF14] animate-pulse" />
                <span className="text-[10px] font-black text-[#39FF14] tracking-wider">NOVA MISSAO RECEBIDA</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <StatCard label="Pendentes" value={totalPending} icon={Layers} color="#00D4FF" />
            {highPriorityCount > 0 && (
              <StatCard label="Alta Prior." value={highPriorityCount} icon={Flame} color="#EF4444" pulse />
            )}
            <StatCard label="Concluidas" value={completedCount} icon={CheckCircle2} color="#39FF14" />
          </div>

          <div className="h-8 w-px bg-slate-800" />

          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-2">
              {connected ? (
                <>
                  <div className="relative">
                    <div className="w-2 h-2 rounded-full bg-[#39FF14]" style={{ boxShadow: '0 0 6px #39FF14' }} />
                    <div className="absolute inset-0 w-2 h-2 rounded-full bg-[#39FF14] animate-ping opacity-50" />
                  </div>
                  <Wifi className="w-3.5 h-3.5 text-[#39FF14]" />
                  <span className="text-[10px] text-[#39FF14] font-black tracking-wider">REALTIME ATIVO</span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                  <WifiOff className="w-3.5 h-3.5 text-red-400" />
                  <span className="text-[10px] text-red-400 font-black">DESCONECTADO</span>
                </>
              )}
              <button onClick={loadTasks} className="p-1 rounded hover:bg-white/5 transition-colors ml-1">
                <RefreshCw className="w-3 h-3 text-slate-500" />
              </button>
            </div>
            <LiveClock />
          </div>
        </div>
      </div>

      {/* Alert Bar */}
      <AnimatePresence>
        {highPriorityCount > 0 && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="relative z-10 flex-shrink-0 overflow-hidden"
          >
            <div
              className="px-6 py-2 flex items-center justify-between"
              style={{
                background: 'linear-gradient(90deg, rgba(239,68,68,0.12) 0%, rgba(239,68,68,0.04) 60%, transparent)',
                borderBottom: '1px solid rgba(239,68,68,0.18)',
              }}
            >
              <div className="flex items-center gap-3">
                <Flame className="w-4 h-4 text-red-400 animate-pulse" style={{ filter: 'drop-shadow(0 0 4px rgba(239,68,68,0.8))' }} />
                <span className="text-xs font-black text-red-400 tracking-wider uppercase">
                  ALERTA: {highPriorityCount} {highPriorityCount === 1 ? 'missao critica aguardando' : 'missoes criticas aguardando'} resolucao imediata
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Activity className="w-3.5 h-3.5 text-red-500 animate-pulse" />
                <span className="text-[10px] font-mono text-red-600">PRIORIDADE_MAXIMA</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* GIA Agents Load Bar */}
      <div
        className="relative z-10 flex-shrink-0 px-4 py-2.5 flex items-center gap-3 overflow-x-auto"
        style={{
          background: 'rgba(3,5,16,0.75)',
          borderBottom: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <div className="flex items-center gap-2 flex-shrink-0 pr-3" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
          <Cpu className="w-3 h-3 text-slate-600" />
          <div>
            <p className="text-[9px] text-slate-500 font-mono uppercase tracking-widest leading-none">Carga</p>
            <p className="text-[9px] text-slate-600 font-mono leading-none">Agentes</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-nowrap">
          {GIA_AGENTS.map((agent) => {
            const agentTasks = tasks.filter((t) =>
              t.gia_responsavel?.toLowerCase().includes(agent.name.toLowerCase().replace('gia ', ''))
            );
            const highTasks = agentTasks.filter((t) => t.prioridade === 'alta').length;
            return (
              <GIAAgentLoad
                key={agent.name}
                name={agent.name}
                color={agent.color}
                taskCount={agentTasks.length}
                maxLoad={agent.maxLoad}
                highCount={highTasks}
              />
            );
          })}
        </div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 flex-1 overflow-hidden p-4">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-5">
              <div className="relative w-16 h-16">
                <div
                  className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
                  style={{ borderTopColor: '#00D4FF', borderRightColor: '#39FF14' }}
                />
                <div
                  className="absolute inset-2 rounded-full border border-transparent animate-spin"
                  style={{
                    borderBottomColor: '#00D4FF',
                    animationDirection: 'reverse',
                    animationDuration: '0.6s',
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Radio className="w-5 h-5 text-[#00D4FF] animate-pulse" />
                </div>
              </div>
              <div className="text-center">
                <p className="text-sm font-bold text-[#00D4FF] tracking-wider">CONECTANDO AO ATOM...</p>
                <p className="text-[10px] text-slate-600 font-mono mt-1">sincronizando_banco_de_dados...</p>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-full flex gap-4 overflow-x-auto pb-1">
            {ACTIVE_SECTORS.map((sectorKey) => (
              <SectorColumn
                key={sectorKey}
                sectorKey={sectorKey}
                tasks={tasks.filter((t) => t.setor === sectorKey)}
                completingId={completingId}
                onComplete={handleComplete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        className="relative z-10 flex-shrink-0 px-6 py-2 flex items-center justify-between"
        style={{
          background: 'rgba(3,5,16,0.85)',
          borderTop: '1px solid rgba(255,255,255,0.04)',
        }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Bot className="w-3 h-3 text-slate-700" />
            <span className="text-[9px] text-slate-700 font-mono">
              ATOM INTELLIGENCE SYSTEM — Tarefas inseridas automaticamente por Agentes de IA
            </span>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[9px] font-mono text-slate-700">
          <span>GIA_MURAL_TAREFAS</span>
          <span style={{ color: 'rgba(0,212,255,0.3)' }}>|</span>
          <span>{new Date().toLocaleDateString('pt-BR')}</span>
          <span style={{ color: 'rgba(0,212,255,0.3)' }}>|</span>
          <span className="text-[#39FF14] opacity-60">v2.0-realtime</span>
        </div>
      </div>

    </div>
  );
}
