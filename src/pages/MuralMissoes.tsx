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
  Database,
  Radio,
  Eye,
  Flame,
  MessageCircle,
  ExternalLink,
  Hash,
  X,
  Phone,
  Info,
  FileText,
  Layers,
} from 'lucide-react';
import { supabase } from '../lib/supabase';

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
  whatsapp_phone?: string | null;
  os_id?: string | null;
  os_numero?: string | null;
  gia_source?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface GIAAgentConfig {
  name: string;
  shortName: string;
  color: string;
  maxLoad: number;
  bgGradient: string;
  borderColor: string;
  headerGradient: string;
}

const GIA_AGENTS: GIAAgentConfig[] = [
  {
    name: 'GIA Connect',
    shortName: 'CONNECT',
    color: '#39FF14',
    maxLoad: 6,
    bgGradient: 'rgba(57,255,20,0.05)',
    borderColor: 'rgba(57,255,20,0.25)',
    headerGradient: 'linear-gradient(135deg, rgba(57,255,20,0.12), rgba(57,255,20,0.04))',
  },
  {
    name: 'GIA Sales',
    shortName: 'SALES',
    color: '#FF6B35',
    maxLoad: 5,
    bgGradient: 'rgba(255,107,53,0.05)',
    borderColor: 'rgba(255,107,53,0.25)',
    headerGradient: 'linear-gradient(135deg, rgba(255,107,53,0.12), rgba(255,107,53,0.04))',
  },
  {
    name: 'GIA Monitor',
    shortName: 'MONITOR',
    color: '#FF2D78',
    maxLoad: 4,
    bgGradient: 'rgba(255,45,120,0.05)',
    borderColor: 'rgba(255,45,120,0.25)',
    headerGradient: 'linear-gradient(135deg, rgba(255,45,120,0.12), rgba(255,45,120,0.04))',
  },
  {
    name: 'GIA Growth',
    shortName: 'GROWTH',
    color: '#FF6B35',
    maxLoad: 4,
    bgGradient: 'rgba(255,107,53,0.05)',
    borderColor: 'rgba(255,107,53,0.25)',
    headerGradient: 'linear-gradient(135deg, rgba(255,107,53,0.12), rgba(255,107,53,0.04))',
  },
  {
    name: 'GIA Tech',
    shortName: 'TECH',
    color: '#00D4FF',
    maxLoad: 7,
    bgGradient: 'rgba(0,212,255,0.05)',
    borderColor: 'rgba(0,212,255,0.25)',
    headerGradient: 'linear-gradient(135deg, rgba(0,212,255,0.12), rgba(0,212,255,0.04))',
  },
  {
    name: 'GIA Logistics',
    shortName: 'LOGISTICS',
    color: '#39FF14',
    maxLoad: 5,
    bgGradient: 'rgba(57,255,20,0.05)',
    borderColor: 'rgba(57,255,20,0.25)',
    headerGradient: 'linear-gradient(135deg, rgba(57,255,20,0.12), rgba(57,255,20,0.04))',
  },
  {
    name: 'GIA Stock',
    shortName: 'STOCK',
    color: '#00D4FF',
    maxLoad: 6,
    bgGradient: 'rgba(0,212,255,0.05)',
    borderColor: 'rgba(0,212,255,0.25)',
    headerGradient: 'linear-gradient(135deg, rgba(0,212,255,0.12), rgba(0,212,255,0.04))',
  },
  {
    name: 'GIA ESI',
    shortName: 'ESI',
    color: '#00D4FF',
    maxLoad: 3,
    bgGradient: 'rgba(0,212,255,0.05)',
    borderColor: 'rgba(0,212,255,0.25)',
    headerGradient: 'linear-gradient(135deg, rgba(0,212,255,0.12), rgba(0,212,255,0.04))',
  },
  {
    name: 'GIA Audit',
    shortName: 'AUDIT',
    color: '#39FF14',
    maxLoad: 5,
    bgGradient: 'rgba(57,255,20,0.05)',
    borderColor: 'rgba(57,255,20,0.25)',
    headerGradient: 'linear-gradient(135deg, rgba(57,255,20,0.12), rgba(57,255,20,0.04))',
  },
  {
    name: 'GIA Fiscal',
    shortName: 'FISCAL',
    color: '#FFA500',
    maxLoad: 4,
    bgGradient: 'rgba(255,165,0,0.05)',
    borderColor: 'rgba(255,165,0,0.25)',
    headerGradient: 'linear-gradient(135deg, rgba(255,165,0,0.12), rgba(255,165,0,0.04))',
  },
  {
    name: 'GIA Warranty',
    shortName: 'WARRANTY',
    color: '#FFA500',
    maxLoad: 4,
    bgGradient: 'rgba(255,165,0,0.05)',
    borderColor: 'rgba(255,165,0,0.25)',
    headerGradient: 'linear-gradient(135deg, rgba(255,165,0,0.12), rgba(255,165,0,0.04))',
  },
  {
    name: 'GIA Skywalker',
    shortName: 'SKYWALKER',
    color: '#A78BFA',
    maxLoad: 3,
    bgGradient: 'rgba(167,139,250,0.05)',
    borderColor: 'rgba(167,139,250,0.25)',
    headerGradient: 'linear-gradient(135deg, rgba(167,139,250,0.12), rgba(167,139,250,0.04))',
  },
];

const COLUMN_CAPACITY = 100;

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

function formatFullDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function LiveClock() {
  const [time, setTime] = useState(new Date());
  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="font-mono text-[#00D4FF] font-bold tabular-nums text-sm">
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
          'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.025) 2px, rgba(0,0,0,0.025) 4px)',
      }}
    />
  );
}

type BadgeConfig = {
  label: string;
  bg: string;
  border: string;
  color: string;
  glow: string | null;
};

function getTaskBadge(titulo = '', descricao = ''): BadgeConfig {
  const text = `${titulo} ${descricao}`.toLowerCase();
  if (/aprovado|pix/.test(text))
    return { label: 'APROVADO', bg: 'rgba(52,211,153,0.15)', border: 'rgba(52,211,153,0.55)', color: '#34D399', glow: 'rgba(52,211,153,0.3)' };
  if (/orçamento|cotação|orcamento|cotacao/.test(text))
    return { label: 'ORÇAMENTO', bg: 'rgba(234,179,8,0.18)', border: 'rgba(234,179,8,0.5)', color: '#FACC15', glow: 'rgba(234,179,8,0.3)' };
  if (/garantia/.test(text))
    return { label: 'GARANTIA', bg: 'rgba(168,85,247,0.15)', border: 'rgba(168,85,247,0.5)', color: '#C084FC', glow: 'rgba(168,85,247,0.25)' };
  if (/status|acompanhamento/.test(text))
    return { label: 'ACOMPANHAMENTO', bg: 'rgba(6,182,212,0.15)', border: 'rgba(6,182,212,0.5)', color: '#22D3EE', glow: 'rgba(6,182,212,0.25)' };
  return { label: 'TRIAGEM', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.3)', color: '#64748B', glow: null };
}

function openWhatsApp(phone: string) {
  const digits = phone.replace(/\D/g, '');
  const num = digits.startsWith('55') ? digits : `55${digits}`;
  window.open(`https://wa.me/${num}`, '_blank');
}

interface TaskDetailModalProps {
  task: MuralTarefa;
  accentColor: string;
  onClose: () => void;
  onComplete: (id: string) => void;
  completing: boolean;
}

function TaskDetailModal({ task, accentColor, onClose, onComplete, completing }: TaskDetailModalProps) {
  const isAlta = task.prioridade === 'alta';
  const badge = getTaskBadge(task.titulo, task.descricao);
  const isConnect = task.gia_source === 'CONNECT' || !!task.whatsapp_phone;
  const borderColor = isAlta ? '#EF4444' : accentColor;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.92, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.92, y: 20 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        className="relative w-full max-w-lg rounded-2xl overflow-hidden"
        style={{
          background: 'linear-gradient(145deg, rgba(8,12,30,0.99), rgba(4,6,18,1))',
          border: `1px solid ${borderColor}45`,
          boxShadow: `0 0 80px ${borderColor}15, 0 30px 100px rgba(0,0,0,0.8)`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute top-0 left-0 right-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${borderColor}90, transparent)` }} />
        <div className="absolute left-0 top-0 bottom-0 w-0.5" style={{ background: `linear-gradient(180deg, transparent, ${borderColor}80, transparent)` }} />

        <div className="p-5">
          <div className="flex items-start justify-between gap-3 mb-4">
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

          <h2 className="text-base font-black leading-snug mb-4" style={{ color: isAlta ? '#FCA5A5' : '#F1F5F9' }}>
            {task.titulo}
          </h2>

          {task.descricao && (
            <div className="rounded-xl p-3.5 mb-4" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center gap-1.5 mb-2">
                <FileText className="w-3 h-3 text-slate-600" />
                <span className="text-[9px] font-mono text-slate-600 uppercase tracking-widest">Descrição</span>
              </div>
              <p className="text-[12px] text-slate-300 leading-relaxed">{task.descricao}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 mb-4">
            {[
              { label: 'Agente', content: (
                <div className="flex items-center gap-1.5">
                  <div className="w-4 h-4 rounded-md flex items-center justify-center" style={{ background: `${accentColor}20` }}>
                    <Bot className="w-2.5 h-2.5" style={{ color: accentColor }} />
                  </div>
                  <span className="text-[11px] font-bold" style={{ color: accentColor }}>{task.gia_responsavel}</span>
                </div>
              )},
              { label: 'Criada em', content: (
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3 h-3 text-slate-500" />
                  <span className="text-[10px] font-mono text-slate-300">{formatFullDate(task.created_at)}</span>
                </div>
              )},
              { label: 'Setor', content: (
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: accentColor }} />
                  <span className="text-[11px] font-bold text-slate-300">{task.setor || task.gia_responsavel}</span>
                </div>
              )},
              { label: 'Prioridade', content: (
                <div className="flex items-center gap-1.5">
                  {isAlta ? <Flame className="w-3 h-3 text-red-400" /> : <Info className="w-3 h-3 text-slate-500" />}
                  <span className={`text-[11px] font-bold ${isAlta ? 'text-red-400' : 'text-slate-400'}`}>{isAlta ? 'ALTA' : 'NORMAL'}</span>
                </div>
              )},
            ].map(({ label, content }) => (
              <div key={label} className="rounded-xl p-3" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.05)' }}>
                <p className="text-[9px] font-mono text-slate-600 uppercase tracking-widest mb-1">{label}</p>
                {content}
              </div>
            ))}
          </div>

          {task.whatsapp_phone && (
            <div className="rounded-xl p-3 mb-3 flex items-center justify-between" style={{ background: 'rgba(37,211,102,0.06)', border: '1px solid rgba(37,211,102,0.2)' }}>
              <div className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-[#25D366]" />
                <span className="text-[11px] font-mono text-[#25D366]">{task.whatsapp_phone}</span>
              </div>
              <button
                onClick={() => openWhatsApp(task.whatsapp_phone!)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wider transition-all hover:scale-[1.02] active:scale-95 font-mono"
                style={{ background: 'rgba(37,211,102,0.18)', border: '1px solid rgba(37,211,102,0.4)', color: '#25D366', boxShadow: '0 0 12px rgba(37,211,102,0.2)' }}
              >
                <MessageCircle className="w-3 h-3" />
                ABRIR CHAT
              </button>
            </div>
          )}

          {task.os_id && (
            <div className="rounded-xl p-3 mb-3 flex items-center justify-between" style={{ background: `${accentColor}08`, border: `1px solid ${accentColor}25` }}>
              <div className="flex items-center gap-2">
                <Hash className="w-3.5 h-3.5" style={{ color: accentColor }} />
                <span className="text-[11px] font-mono" style={{ color: accentColor }}>OS #{task.os_numero || task.os_id?.slice(0, 8)}</span>
              </div>
              <a
                href={`/kanban?os=${task.os_id}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black tracking-wider transition-all hover:scale-[1.02] active:scale-95 font-mono"
                style={{ background: `${accentColor}18`, border: `1px solid ${accentColor}40`, color: accentColor, boxShadow: `0 0 12px ${accentColor}20` }}
              >
                <ExternalLink className="w-3 h-3" />
                VER OS
              </a>
            </div>
          )}

          <div className="flex gap-2 mt-2">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl text-[11px] font-black tracking-wider transition-all hover:bg-white/10 font-mono"
              style={{ border: '1px solid rgba(255,255,255,0.08)', color: '#64748B' }}
            >
              FECHAR
            </button>
            <button
              onClick={() => { onComplete(task.id); onClose(); }}
              disabled={completing}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[11px] font-black tracking-wider transition-all disabled:opacity-40 font-mono"
              style={{
                background: completing ? 'rgba(255,255,255,0.04)' : `linear-gradient(135deg, ${accentColor}28, ${accentColor}12)`,
                border: `1px solid ${accentColor}50`,
                color: accentColor,
                boxShadow: completing ? 'none' : `0 0 18px ${accentColor}22`,
              }}
            >
              {completing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              {completing ? 'SALVANDO...' : 'MARCAR CONCLUÍDA'}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
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
              style={{ background: badge.bg, border: `1px solid ${badge.border}`, boxShadow: badge.glow && hovered ? `0 0 6px ${badge.glow}` : 'none', transition: 'box-shadow 0.18s ease' }}
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
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1">
                <Clock className="w-2 h-2 text-slate-700" />
                <span className="text-[9px] font-mono text-slate-700">{formatTime(task.created_at)}</span>
              </div>
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

interface AgentColumnProps {
  agent: GIAAgentConfig;
  tasks: MuralTarefa[];
  completingId: string | null;
  onComplete: (id: string) => void;
}

function AgentColumn({ agent, tasks, completingId, onComplete }: AgentColumnProps) {
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
                <h3 className="text-[13px] font-black tracking-widest uppercase leading-none" style={{ color: agent.color, textShadow: `0 0 10px ${agent.color}50` }}>
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

function agentMatchesTask(agent: GIAAgentConfig, task: MuralTarefa): boolean {
  const resp = (task.gia_responsavel || '').toLowerCase();
  const agentLower = agent.name.toLowerCase();
  const shortLower = agent.shortName.toLowerCase();
  return resp.includes(shortLower) || resp.includes(agentLower.replace('gia ', ''));
}

export function MuralMissoes() {
  const [tasks, setTasks] = useState<MuralTarefa[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);
  const [completedCount, setCompletedCount] = useState(0);
  const [newTaskFlash, setNewTaskFlash] = useState(false);
  const [activeAgentIdx, setActiveAgentIdx] = useState(0);
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
    if (!error && data) setTasks(sortTasks(data as MuralTarefa[]));
    setLoading(false);
  }, []);

  useEffect(() => {
    loadTasks();
    const channel = supabase
      .channel('mural-tarefas-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gia_mural_tarefas' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          const t = payload.new as MuralTarefa;
          if (t.status === 'pendente') {
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
  const activeAgent = GIA_AGENTS[activeAgentIdx];
  const activeAgentTasks = tasks.filter((t) => agentMatchesTask(activeAgent, t));

  return (
    <div
      className="flex flex-col relative overflow-hidden"
      style={{ height: '100vh', background: 'linear-gradient(160deg, #030510 0%, #060a18 40%, #04080f 100%)', color: '#E2E8F0' }}
    >
      <ScanlineOverlay />

      <div className="absolute inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-10" style={{ background: '#00D4FF', filter: 'blur(120px)', transform: 'translate(-50%,-50%)' }} />
        <div className="absolute bottom-1/3 right-1/4 w-72 h-72 rounded-full opacity-10" style={{ background: '#39FF14', filter: 'blur(130px)', transform: 'translate(50%,50%)' }} />
      </div>

      <div className="absolute top-0 left-0 right-0 h-px z-10" style={{ background: 'linear-gradient(90deg, transparent, #00D4FF 30%, #39FF14 70%, transparent)' }} />

      <div
        className="relative z-10 flex-shrink-0 px-5 py-2.5 flex items-center justify-between"
        style={{ background: 'rgba(3,5,16,0.92)', borderBottom: '1px solid rgba(0,212,255,0.1)', backdropFilter: 'blur(24px)' }}
      >
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div
              className="relative w-9 h-9 rounded-xl flex items-center justify-center"
              style={{ background: 'linear-gradient(135deg, rgba(0,212,255,0.2), rgba(57,255,20,0.06))', border: '1px solid rgba(0,212,255,0.35)', boxShadow: '0 0 20px rgba(0,212,255,0.15)' }}
            >
              <Target className="w-4.5 h-4.5 text-[#00D4FF]" style={{ width: 18, height: 18 }} />
              <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#39FF14] animate-pulse" style={{ boxShadow: '0 0 8px #39FF14' }} />
            </div>
            <div>
              <h1
                className="text-base font-black tracking-[0.2em] uppercase leading-none"
                style={{ background: 'linear-gradient(90deg, #00D4FF, #39FF14)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}
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
                style={{ background: 'rgba(57,255,20,0.1)', border: '1px solid rgba(57,255,20,0.3)', boxShadow: '0 0 12px rgba(57,255,20,0.12)' }}
              >
                <Zap className="w-2.5 h-2.5 text-[#39FF14] animate-pulse" />
                <span className="text-[9px] font-black text-[#39FF14] tracking-wider font-mono">NOVA MISSAO</span>
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
                  <div className="w-2 h-2 rounded-full bg-[#39FF14]" style={{ boxShadow: '0 0 6px #39FF14' }} />
                  <div className="absolute inset-0 w-2 h-2 rounded-full bg-[#39FF14] animate-ping opacity-40" />
                </div>
                <Wifi className="w-3 h-3 text-[#39FF14]" />
                <span className="text-[9px] text-[#39FF14] font-black tracking-wider font-mono">ONLINE</span>
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

      <div
        className="relative z-10 flex-shrink-0 px-4 py-0 flex items-center gap-1 overflow-x-auto"
        style={{ background: 'rgba(3,5,16,0.8)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}
      >
        <span className="text-[9px] font-mono text-slate-700 uppercase tracking-widest pr-3 flex-shrink-0 py-2.5" style={{ borderRight: '1px solid rgba(255,255,255,0.05)' }}>
          CARGA<br />AGENTES
        </span>
        <div className="flex items-center gap-1 overflow-x-auto py-2" style={{ scrollbarWidth: 'none' }}>
          {GIA_AGENTS.map((agent, idx) => {
            const agentTasks = tasks.filter((t) => agentMatchesTask(agent, t));
            const isActive = idx === activeAgentIdx;
            const pct = Math.min((agentTasks.length / agent.maxLoad) * 100, 100);
            return (
              <button
                key={agent.shortName}
                onClick={() => setActiveAgentIdx(idx)}
                className="flex-shrink-0 flex flex-col items-start px-3 py-1.5 rounded-xl transition-all"
                style={{
                  background: isActive ? `${agent.color}12` : 'transparent',
                  border: `1px solid ${isActive ? `${agent.color}40` : 'transparent'}`,
                  minWidth: 80,
                }}
              >
                <div className="flex items-center gap-1.5 mb-1">
                  <div
                    className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                    style={{ background: agentTasks.length > 0 ? agent.color : '#1E293B', boxShadow: agentTasks.length > 0 ? `0 0 4px ${agent.color}` : 'none' }}
                  />
                  <span
                    className="text-[10px] font-black tracking-wider font-mono"
                    style={{ color: isActive ? agent.color : agentTasks.length > 0 ? `${agent.color}90` : '#334155' }}
                  >
                    {agent.shortName}
                  </span>
                  {agentTasks.filter((t) => t.prioridade === 'alta').length > 0 && (
                    <span className="text-[8px] font-black px-1 rounded animate-pulse font-mono" style={{ background: 'rgba(239,68,68,0.2)', color: '#F87171', border: '1px solid rgba(239,68,68,0.3)' }}>
                      {agentTasks.filter((t) => t.prioridade === 'alta').length}!
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 w-full">
                  <div className="flex-1 h-0.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                    {agentTasks.length > 0 && (
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${pct}%`,
                          background: pct >= 80 ? `linear-gradient(90deg, ${agent.color}, #EF4444)` : `linear-gradient(90deg, ${agent.color}80, ${agent.color})`,
                          boxShadow: `0 0 3px ${agent.color}60`,
                        }}
                      />
                    )}
                  </div>
                  <span className="text-[8px] font-mono tabular-nums flex-shrink-0" style={{ color: agentTasks.length > 0 ? agent.color : '#1E293B' }}>
                    {agentTasks.length}/{agent.maxLoad}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="relative z-10 flex-1 overflow-hidden p-3">
        {loading ? (
          <div className="h-full flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="relative w-14 h-14">
                <div className="absolute inset-0 rounded-full border-2 border-transparent animate-spin" style={{ borderTopColor: '#00D4FF', borderRightColor: '#39FF14' }} />
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
        style={{ background: 'rgba(3,5,16,0.88)', borderTop: '1px solid rgba(255,255,255,0.04)' }}
      >
        <div className="flex items-center gap-1.5">
          <Bot className="w-3 h-3 text-slate-800" />
          <span className="text-[9px] text-slate-800 font-mono">ATOM INTELLIGENCE SYSTEM — V2.0</span>
        </div>
        <div className="flex items-center gap-3 text-[9px] font-mono text-slate-800">
          <span>GIA_MURAL_TAREFAS</span>
          <span className="text-slate-700">|</span>
          <span className="text-[#39FF14] opacity-50">ESTADO: {connected ? 'ATIVO' : 'OFFLINE'}</span>
        </div>
      </div>
    </div>
  );
}
