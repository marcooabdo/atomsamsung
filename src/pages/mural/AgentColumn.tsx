import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Bot, Database, Eye, Shield } from 'lucide-react';
import type { GIAAgentConfig, MuralTarefa } from './types';
import { COLUMN_CAPACITY } from './constants';
import { TaskCard } from './TaskCard';

interface AgentColumnProps {
  agent: GIAAgentConfig;
  tasks: MuralTarefa[];
  completingId: string | null;
  onComplete: (id: string) => void;
}

export function AgentColumn({ agent, tasks, completingId, onComplete }: AgentColumnProps) {
  const highCount = tasks.filter((t) => t.prioridade === 'alta').length;
  const hasNew = tasks.some((t) => Date.now() - new Date(t.created_at).getTime() < 30000);
  const pct = Math.min((tasks.length / COLUMN_CAPACITY) * 100, 100);
  const isOverloaded = tasks.length > COLUMN_CAPACITY;

  return (
    <div
      className="flex flex-col rounded-2xl overflow-hidden flex-shrink-0 w-[280px]"
      style={{
        background: 'rgba(6,9,20,0.88)',
        border: `1px solid ${agent.borderColor}`,
        backdropFilter: 'blur(20px)',
        boxShadow: `0 0 40px ${agent.color}06, inset 0 1px 0 rgba(255,255,255,0.03)`,
      }}
    >
      <div
        className="px-4 py-3 flex-shrink-0 relative overflow-hidden"
        style={{ background: agent.headerGradient, borderBottom: `1px solid ${agent.borderColor}` }}
      >
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${agent.color}25, ${agent.color}08)`,
                  border: `1px solid ${agent.color}45`,
                  boxShadow: `0 0 14px ${agent.color}20`,
                }}
              >
                <Bot className="w-3.5 h-3.5" style={{ color: agent.color }} />
              </div>
              {hasNew && (
                <div
                  className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full animate-pulse"
                  style={{ background: agent.color, boxShadow: `0 0 6px ${agent.color}` }}
                />
              )}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3
                  className="text-[13px] font-black tracking-widest uppercase leading-none"
                  style={{ color: agent.color, textShadow: `0 0 10px ${agent.color}50` }}
                >
                  GIA {agent.shortName}
                </h3>
                {highCount > 0 && (
                  <motion.div
                    animate={{ scale: [1, 1.1, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="flex items-center gap-0.5 px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(239,68,68,0.2)', border: '1px solid rgba(239,68,68,0.4)' }}
                  >
                    <AlertTriangle className="w-2 h-2 text-red-400" />
                    <span className="text-[8px] font-black text-red-400 font-mono">{highCount}</span>
                  </motion.div>
                )}
              </div>
              <p className="text-[9px] font-mono mt-0.5" style={{ color: tasks.length > 0 ? `${agent.color}80` : '#334155' }}>
                {tasks.length} {tasks.length === 1 ? 'missao' : 'missoes'}
              </p>
            </div>
          </div>

          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black"
            style={{
              background: tasks.length > 0 ? `${agent.color}20` : 'rgba(255,255,255,0.04)',
              color: tasks.length > 0 ? agent.color : '#334155',
              border: `1px solid ${tasks.length > 0 ? `${agent.color}40` : 'rgba(255,255,255,0.05)'}`,
            }}
          >
            {tasks.length}
          </div>
        </div>
      </div>

      <div
        className="px-3 py-1.5 flex-shrink-0 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.25)' }}
      >
        <div className="flex items-center gap-1.5">
          <Database className="w-2 h-2" style={{ color: agent.color, opacity: 0.4 }} />
          <span className="text-[8px] font-mono text-slate-700 uppercase tracking-widest">SETOR.{agent.shortName}</span>
        </div>
        <div className="flex items-center gap-1">
          <Eye className="w-2 h-2 text-slate-800" />
          <span className="text-[8px] font-mono text-slate-800">REALTIME</span>
        </div>
      </div>

      <div
        className="flex-1 overflow-y-auto p-2.5 space-y-2 min-h-[200px]"
        style={{ scrollbarWidth: 'thin', scrollbarColor: `${agent.color}15 transparent` }}
      >
        <AnimatePresence mode="popLayout">
          {tasks.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-10 text-center"
            >
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center mb-3 relative"
                style={{ background: `${agent.color}08`, border: `1px solid ${agent.color}15` }}
              >
                <Shield className="w-5 h-5" style={{ color: agent.color, opacity: 0.25 }} />
              </div>
              <p className="text-[10px] font-bold text-slate-700 tracking-wider uppercase">Sistema Limpo</p>
              <p className="text-[9px] text-slate-800 mt-0.5 font-mono">aguardando_gia...</p>
            </motion.div>
          ) : (
            tasks.map((task, i) => (
              <TaskCard
                key={task.id}
                task={task}
                onComplete={onComplete}
                completing={completingId === task.id}
                accentColor={agent.color}
                index={i}
              />
            ))
          )}
        </AnimatePresence>
      </div>

      <div
        className="px-2.5 py-1.5 flex items-center gap-2 flex-shrink-0"
        style={{ borderTop: `1px solid ${agent.color}10`, background: 'rgba(0,0,0,0.35)' }}
      >
        <div className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.05)' }}>
          {tasks.length > 0 && (
            <motion.div
              className="h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{
                background: isOverloaded
                  ? 'linear-gradient(90deg, #EF444470, #EF4444)'
                  : `linear-gradient(90deg, ${agent.color}70, ${agent.color})`,
                boxShadow: isOverloaded ? '0 0 4px rgba(239,68,68,0.4)' : `0 0 4px ${agent.color}35`,
              }}
            />
          )}
        </div>
        <span className="text-[8px] font-mono flex-shrink-0" style={{ color: isOverloaded ? '#EF4444' : '#2D3748' }}>
          {tasks.length}/{COLUMN_CAPACITY}
        </span>
      </div>
    </div>
  );
}
