import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Clock, Flame, Hash, MessageCircle, RefreshCw } from 'lucide-react';
import type { MuralTarefa } from './types';
import { getTaskBadge, openWhatsApp, formatTime } from './utils';
import { TaskDetailModal } from './TaskDetailModal';

interface TaskCardProps {
  task: MuralTarefa;
  onComplete: (id: string) => void;
  completing: boolean;
  accentColor: string;
  index: number;
}

export function TaskCard({ task, onComplete, completing, accentColor, index }: TaskCardProps) {
  const isAlta = task.prioridade === 'alta';
  const [hovered, setHovered] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const badge = getTaskBadge(task.titulo, task.descricao);
  const isConnect = task.gia_source === 'CONNECT' || !!task.whatsapp_phone;

  function handleWhatsAppClick(e: React.MouseEvent) {
    e.stopPropagation();
    if (task.whatsapp_phone) openWhatsApp(task.whatsapp_phone);
  }

  function handleCompleteClick(e: React.MouseEvent) {
    e.stopPropagation();
    onComplete(task.id);
  }

  return (
    <>
      <motion.div
        layout
        initial={{ opacity: 0, y: -10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9, x: 50, filter: 'blur(4px)' }}
        transition={{ duration: 0.28, type: 'spring', stiffness: 320, damping: 26, delay: index * 0.025 }}
        className="relative rounded-xl overflow-hidden cursor-pointer select-none"
        style={{
          background: isAlta
            ? 'linear-gradient(145deg, rgba(30,8,8,0.96), rgba(12,5,20,0.98))'
            : hovered
              ? 'linear-gradient(145deg, rgba(14,22,48,0.97), rgba(7,11,26,0.99))'
              : 'linear-gradient(145deg, rgba(10,15,35,0.92), rgba(5,8,20,0.96))',
          border: `1px solid ${isAlta ? 'rgba(239,68,68,0.4)' : hovered ? `${accentColor}50` : `${accentColor}22`}`,
          boxShadow: hovered
            ? isAlta ? '0 4px 18px rgba(239,68,68,0.18)' : `0 4px 18px ${accentColor}14`
            : isAlta ? '0 2px 10px rgba(239,68,68,0.1)' : '0 2px 8px rgba(0,0,0,0.4)',
          transform: hovered ? 'translateY(-1px)' : 'translateY(0)',
          transition: 'all 0.18s cubic-bezier(0.4,0,0.2,1)',
        }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => setShowModal(true)}
      >
        <div
          className="absolute top-0 left-0 right-0 h-px"
          style={{
            background: isAlta
              ? 'linear-gradient(90deg, transparent, rgba(239,68,68,0.8) 50%, transparent)'
              : `linear-gradient(90deg, transparent, ${accentColor}${hovered ? '80' : '50'} 50%, transparent)`,
            transition: 'background 0.18s ease',
          }}
        />
        <div
          className="absolute left-0 top-0 bottom-0 w-0.5"
          style={{
            background: isAlta
              ? 'linear-gradient(180deg, transparent, rgba(239,68,68,0.7), transparent)'
              : `linear-gradient(180deg, transparent, ${accentColor}${hovered ? '70' : '35'}, transparent)`,
            transition: 'background 0.18s ease',
          }}
        />

        <div className="px-3 py-2.5">
          <div className="flex items-center justify-between gap-1.5 mb-1.5">
            <div
              className="inline-flex items-center px-1.5 py-0.5 rounded flex-shrink-0"
              style={{
                background: badge.bg,
                border: `1px solid ${badge.border}`,
                boxShadow: badge.glow && hovered ? `0 0 6px ${badge.glow}` : 'none',
                transition: 'box-shadow 0.18s ease',
              }}
            >
              <span className="text-[8px] font-black tracking-[0.08em] font-mono" style={{ color: badge.color }}>{badge.label}</span>
            </div>

            <div className="flex items-center gap-1.5 flex-shrink-0">
              {isAlta && (
                <div className="flex items-center gap-0.5">
                  <Flame className="w-2.5 h-2.5 text-red-400 animate-pulse" style={{ filter: 'drop-shadow(0 0 3px #EF4444)' }} />
                  <span className="text-[8px] font-black text-red-400 tracking-widest font-mono">ALTA</span>
                </div>
              )}
              {task.os_numero && (
                <div className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded" style={{ background: `${accentColor}10`, border: `1px solid ${accentColor}28` }}>
                  <Hash className="w-2 h-2" style={{ color: accentColor }} />
                  <span className="text-[8px] font-black tracking-wider font-mono" style={{ color: accentColor }}>{task.os_numero}</span>
                </div>
              )}
              {isConnect && (
                <button
                  onClick={handleWhatsAppClick}
                  title={task.whatsapp_phone ? `Abrir WhatsApp: ${task.whatsapp_phone}` : 'WhatsApp'}
                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded transition-all active:scale-90"
                  style={{
                    background: hovered ? 'rgba(37,211,102,0.2)' : 'rgba(37,211,102,0.1)',
                    border: '1px solid rgba(37,211,102,0.35)',
                    boxShadow: hovered ? '0 0 8px rgba(37,211,102,0.3)' : 'none',
                    transition: 'all 0.18s ease',
                  }}
                >
                  <MessageCircle className="w-2.5 h-2.5 text-[#25D366]" />
                  <span className="text-[8px] font-black text-[#25D366] tracking-wider font-mono">WHATSAPP</span>
                </button>
              )}
            </div>
          </div>

          <p
            className="text-[12px] font-bold leading-snug"
            style={{
              color: isAlta ? '#FCA5A5' : hovered ? '#F1F5F9' : '#CBD5E1',
              transition: 'color 0.18s ease',
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {task.titulo}
          </p>

          {task.descricao && (
            <p
              className="text-[10px] leading-snug mt-1 pl-2"
              style={{
                color: '#2D3748',
                borderLeft: `1px solid ${hovered ? `${accentColor}35` : 'rgba(255,255,255,0.05)'}`,
                overflow: 'hidden',
                display: '-webkit-box',
                WebkitLineClamp: 1,
                WebkitBoxOrient: 'vertical',
                transition: 'border-color 0.18s ease',
              }}
            >
              {task.descricao}
            </p>
          )}

          <div className="flex items-center justify-between mt-2 pt-1.5" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
            <div className="flex items-center gap-1">
              <Clock className="w-2 h-2 text-slate-700" />
              <span className="text-[9px] font-mono text-slate-700">{formatTime(task.created_at)}</span>
            </div>
            <button
              onClick={handleCompleteClick}
              disabled={completing}
              className="flex items-center gap-1 px-2 py-1 rounded-md transition-all disabled:opacity-40 active:scale-95"
              style={{
                background: hovered ? `${accentColor}25` : `${accentColor}12`,
                border: `1px solid ${hovered ? `${accentColor}50` : `${accentColor}25`}`,
                color: accentColor,
                boxShadow: hovered ? `0 0 10px ${accentColor}22` : 'none',
                transition: 'all 0.18s ease',
              }}
            >
              {completing ? <RefreshCw className="w-2.5 h-2.5 animate-spin" /> : <CheckCircle2 className="w-2.5 h-2.5" />}
              <span className="text-[9px] font-black tracking-wider font-mono">{completing ? '...' : 'OK'}</span>
            </button>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {showModal && (
          <TaskDetailModal
            task={task}
            accentColor={accentColor}
            onClose={() => setShowModal(false)}
            onComplete={onComplete}
            completing={completing}
          />
        )}
      </AnimatePresence>
    </>
  );
}
