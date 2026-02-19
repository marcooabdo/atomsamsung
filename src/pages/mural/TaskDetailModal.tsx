import { motion } from 'framer-motion';
import {
  Bot,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Flame,
  Hash,
  Info,
  MessageCircle,
  Phone,
  RefreshCw,
  X,
} from 'lucide-react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import type { MuralTarefa } from './types';
import { formatFullDate, getTaskBadge } from './utils';

interface TaskDetailModalProps {
  task: MuralTarefa;
  accentColor: string;
  onClose: () => void;
  onComplete: (id: string) => void;
  completing: boolean;
}

export function TaskDetailModal({ task, accentColor, onClose, onComplete, completing }: TaskDetailModalProps) {
  const navigate = useNavigate();
  const isAlta = task.prioridade === 'alta';
  const badge = getTaskBadge(task.titulo, task.descricao);
  const isConnect = task.gia_source === 'CONNECT' || !!task.whatsapp_phone;
  const borderColor = isAlta ? '#EF4444' : accentColor;

  function handleOpenChat() {
    const phone = task.whatsapp_phone!.replace(/\D/g, '');
    const params = new URLSearchParams({ phone });
    if (task.os_id) params.set('os_id', task.os_id);
    onClose();
    navigate(`/atom-connect?${params.toString()}`);
  }

  const modalContent = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 flex items-center justify-center p-6"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', zIndex: 99999 }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        className="relative w-full rounded-2xl overflow-hidden"
        style={{
          maxWidth: '680px',
          maxHeight: 'calc(100vh - 80px)',
          overflowY: 'auto',
          background: 'linear-gradient(145deg, rgba(8,12,30,0.99), rgba(4,6,18,1))',
          border: `1px solid ${borderColor}45`,
          boxShadow: `0 0 80px ${borderColor}20, 0 30px 100px rgba(0,0,0,0.9)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${borderColor}90, transparent)` }} />
        <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{ background: `linear-gradient(180deg, transparent, ${borderColor}80, transparent)` }} />

        <div className="p-7">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div className="flex items-center gap-2 flex-wrap">
              <div
                className="inline-flex items-center px-2 py-1 rounded-md"
                style={{ background: badge.bg, border: `1px solid ${badge.border}`, boxShadow: badge.glow ? `0 0 10px ${badge.glow}` : 'none' }}
              >
                <span className="text-[9px] font-black tracking-widest font-mono" style={{ color: badge.color }}>{badge.label}</span>
              </div>
              {isAlta && (
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md" style={{ background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)' }}>
                  <Flame className="w-2.5 h-2.5 text-red-400 animate-pulse" />
                  <span className="text-[9px] font-black text-red-400 tracking-widest font-mono">ALTA</span>
                </div>
              )}
              {task.os_numero && (
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md" style={{ background: `${accentColor}12`, border: `1px solid ${accentColor}35` }}>
                  <Hash className="w-2.5 h-2.5" style={{ color: accentColor }} />
                  <span className="text-[9px] font-black tracking-wider font-mono" style={{ color: accentColor }}>OS {task.os_numero}</span>
                </div>
              )}
              {isConnect && (
                <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md" style={{ background: 'rgba(37,211,102,0.12)', border: '1px solid rgba(37,211,102,0.3)' }}>
                  <MessageCircle className="w-2.5 h-2.5 text-[#25D366]" />
                  <span className="text-[9px] font-black text-[#25D366] tracking-wider font-mono">CONNECT</span>
                </div>
              )}
            </div>
            <button onClick={onClose} className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10" style={{ border: '1px solid rgba(255,255,255,0.08)' }}>
              <X className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>

          <h2 className="text-lg font-black leading-snug mb-5" style={{ color: isAlta ? '#FCA5A5' : '#F1F5F9' }}>
            {task.titulo}
          </h2>

          {task.descricao && (
            <div className="rounded-xl p-4 mb-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <FileText className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-[10px] font-mono text-slate-500 uppercase tracking-widest">Descricao</span>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed">{task.descricao}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 mb-5">
            {[
              {
                label: 'Agente', content: (
                  <div className="flex items-center gap-2">
                    <div className="w-5 h-5 rounded-md flex items-center justify-center" style={{ background: `${accentColor}20` }}>
                      <Bot className="w-3 h-3" style={{ color: accentColor }} />
                    </div>
                    <span className="text-sm font-bold" style={{ color: accentColor }}>{task.gia_responsavel}</span>
                  </div>
                )
              },
              {
                label: 'Criada em', content: (
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-xs font-mono text-slate-300">{formatFullDate(task.created_at)}</span>
                  </div>
                )
              },
              {
                label: 'Setor', content: (
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ background: accentColor }} />
                    <span className="text-sm font-bold text-slate-300">{task.setor || task.gia_responsavel}</span>
                  </div>
                )
              },
              {
                label: 'Prioridade', content: (
                  <div className="flex items-center gap-2">
                    {isAlta ? <Flame className="w-3.5 h-3.5 text-red-400" /> : <Info className="w-3.5 h-3.5 text-slate-500" />}
                    <span className={`text-sm font-bold ${isAlta ? 'text-red-400' : 'text-slate-400'}`}>{isAlta ? 'ALTA' : 'NORMAL'}</span>
                  </div>
                )
              },
            ].map(({ label, content }) => (
              <div key={label} className="rounded-xl p-4" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-2">{label}</p>
                {content}
              </div>
            ))}
          </div>

          {task.whatsapp_phone && (
            <div className="rounded-xl p-4 mb-3 flex items-center justify-between" style={{ background: 'rgba(37,211,102,0.06)', border: '1px solid rgba(37,211,102,0.2)' }}>
              <div className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-[#25D366]" />
                <span className="text-sm font-mono text-[#25D366]">{task.whatsapp_phone}</span>
              </div>
              <button
                onClick={handleOpenChat}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-black tracking-wider transition-all hover:scale-[1.02] active:scale-95 font-mono"
                style={{ background: 'rgba(37,211,102,0.18)', border: '1px solid rgba(37,211,102,0.4)', color: '#25D366', boxShadow: '0 0 16px rgba(37,211,102,0.25)' }}
              >
                <MessageCircle className="w-3.5 h-3.5" />
                ABRIR CHAT
              </button>
            </div>
          )}

          {task.os_id && (
            <div className="rounded-xl p-4 mb-3 flex items-center justify-between" style={{ background: `${accentColor}08`, border: `1px solid ${accentColor}25` }}>
              <div className="flex items-center gap-2.5">
                <Hash className="w-4 h-4" style={{ color: accentColor }} />
                <span className="text-sm font-mono" style={{ color: accentColor }}>OS #{task.os_numero || task.os_id?.slice(0, 8)}</span>
              </div>
              <a
                href={`/kanban?os=${task.os_id}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-[11px] font-black tracking-wider transition-all hover:scale-[1.02] active:scale-95 font-mono"
                style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}40`, color: accentColor, boxShadow: `0 0 16px ${accentColor}25` }}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                VER OS
              </a>
            </div>
          )}

          <div className="flex gap-3 mt-4">
            <button
              onClick={onClose}
              className="flex-1 py-3 rounded-xl text-[12px] font-black tracking-wider transition-all hover:bg-white/10 font-mono"
              style={{ border: '1px solid rgba(255,255,255,0.08)', color: '#64748B' }}
            >
              FECHAR
            </button>
            <button
              onClick={() => { onComplete(task.id); onClose(); }}
              disabled={completing}
              className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-[12px] font-black tracking-wider transition-all disabled:opacity-40 font-mono"
              style={{
                background: completing ? 'rgba(255,255,255,0.04)' : `linear-gradient(135deg, ${accentColor}28, ${accentColor}12)`,
                border: `1px solid ${accentColor}50`,
                color: accentColor,
                boxShadow: completing ? 'none' : `0 0 20px ${accentColor}25`,
              }}
            >
              {completing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {completing ? 'SALVANDO...' : 'MARCAR CONCLUIDA'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );

  return createPortal(modalContent, document.body);
}
