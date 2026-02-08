import { forwardRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle,
  TrendingUp,
  BarChart3,
  CheckCircle2,
  List,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
} from 'lucide-react';
import type { CardData } from './giaScript';

interface ReactiveCardsProps {
  cards: CardData[];
}

const colorMap = {
  red: {
    bg: 'rgba(239, 68, 68, 0.08)',
    border: 'rgba(239, 68, 68, 0.2)',
    accent: '#ef4444',
    glow: '0 0 30px rgba(239, 68, 68, 0.12)',
    badge: 'rgba(239, 68, 68, 0.15)',
    gradient: 'linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(239, 68, 68, 0.04))',
  },
  green: {
    bg: 'rgba(16, 185, 129, 0.08)',
    border: 'rgba(16, 185, 129, 0.2)',
    accent: '#10b981',
    glow: '0 0 30px rgba(16, 185, 129, 0.12)',
    badge: 'rgba(16, 185, 129, 0.15)',
    gradient: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12), rgba(16, 185, 129, 0.04))',
  },
  cyan: {
    bg: 'rgba(0, 210, 255, 0.06)',
    border: 'rgba(0, 210, 255, 0.2)',
    accent: '#00d2ff',
    glow: '0 0 30px rgba(0, 210, 255, 0.1)',
    badge: 'rgba(0, 210, 255, 0.15)',
    gradient: 'linear-gradient(135deg, rgba(0, 210, 255, 0.1), rgba(0, 210, 255, 0.03))',
  },
  amber: {
    bg: 'rgba(245, 158, 11, 0.08)',
    border: 'rgba(245, 158, 11, 0.2)',
    accent: '#f59e0b',
    glow: '0 0 30px rgba(245, 158, 11, 0.12)',
    badge: 'rgba(245, 158, 11, 0.15)',
    gradient: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12), rgba(245, 158, 11, 0.04))',
  },
  blue: {
    bg: 'rgba(59, 130, 246, 0.08)',
    border: 'rgba(59, 130, 246, 0.2)',
    accent: '#3b82f6',
    glow: '0 0 30px rgba(59, 130, 246, 0.12)',
    badge: 'rgba(59, 130, 246, 0.15)',
    gradient: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(59, 130, 246, 0.04))',
  },
};

const iconMap = {
  alert: AlertTriangle,
  metric: TrendingUp,
  chart: BarChart3,
  status: CheckCircle2,
  list: List,
};

function MiniBar({ data, color }: { data: { label: string; value: number }[]; color: string }) {
  const max = Math.max(...data.map((d) => d.value));
  return (
    <div className="space-y-2.5 mt-3">
      {data.map((item, i) => (
        <div key={i}>
          <div className="flex justify-between items-center mb-1">
            <span className="text-xs font-medium" style={{ color: '#94a3b8' }}>{item.label}</span>
            <span className="text-xs font-bold tabular-nums" style={{ color }}>
              {item.value >= 1000 ? `R$ ${(item.value / 1000).toFixed(1)}k` : item.value}
            </span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
            <motion.div
              className="h-full rounded-full"
              style={{
                background: `linear-gradient(90deg, ${color}, ${color}aa)`,
                boxShadow: `0 0 8px ${color}40`,
              }}
              initial={{ width: 0 }}
              animate={{ width: `${(item.value / max) * 100}%` }}
              transition={{ duration: 0.8, delay: i * 0.12, ease: [0.23, 1, 0.32, 1] }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusList({ items, color }: { items: { label: string; value: string; status?: string }[]; color: string }) {
  return (
    <div className="space-y-2 mt-3">
      {items.map((item, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.08 }}
          className="flex items-center justify-between py-1.5 px-2 rounded-lg"
          style={{ background: 'rgba(255,255,255,0.02)' }}
        >
          <div className="flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full" style={{
              background: item.status === 'good' ? '#10b981' : item.status === 'bad' ? '#ef4444' : color,
              boxShadow: `0 0 4px ${item.status === 'good' ? '#10b981' : item.status === 'bad' ? '#ef4444' : color}`,
            }} />
            <span className="text-xs" style={{ color: '#94a3b8' }}>{item.label}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium" style={{ color: item.status === 'good' ? '#10b981' : item.status === 'bad' ? '#ef4444' : '#e2e8f0' }}>
              {item.value}
            </span>
            {item.status === 'good' && <ArrowUpRight className="w-3 h-3 text-emerald-500" />}
            {item.status === 'bad' && <ArrowDownRight className="w-3 h-3 text-red-500" />}
            {item.status === 'neutral' && <Minus className="w-3 h-3 text-gray-500" />}
          </div>
        </motion.div>
      ))}
    </div>
  );
}

const DataCard = forwardRef<HTMLDivElement, { card: CardData }>(({ card }, ref) => {
  const colors = colorMap[card.color];
  const Icon = iconMap[card.type];

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, x: 60, scale: 0.92 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: 60, scale: 0.92 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: colors.gradient,
        border: `1px solid ${colors.border}`,
        boxShadow: colors.glow,
      }}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl" style={{ background: colors.badge }}>
              <Icon className="w-4 h-4" style={{ color: colors.accent }} />
            </div>
            <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: colors.accent }}>
              {card.title}
            </span>
          </div>
        </div>

        {card.value && (
          <div className="mt-3">
            <span className="text-3xl font-bold tracking-tight" style={{
              color: colors.accent,
              textShadow: `0 0 20px ${colors.accent}30`,
            }}>
              {card.value}
            </span>
            {card.subtitle && (
              <p className="text-xs mt-1.5" style={{ color: '#64748b' }}>{card.subtitle}</p>
            )}
          </div>
        )}

        {card.chartData && <MiniBar data={card.chartData} color={colors.accent} />}
        {card.items && <StatusList items={card.items} color={colors.accent} />}
      </div>
    </motion.div>
  );
});

export function ReactiveCards({ cards }: ReactiveCardsProps) {
  return (
    <div className="h-full overflow-y-auto p-4 space-y-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
      <AnimatePresence mode="popLayout">
        {cards.length === 0 && (
          <motion.div
            key="empty"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center h-full text-center px-6"
          >
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: 'rgba(0, 210, 255, 0.06)', border: '1px solid rgba(0, 210, 255, 0.1)' }}>
              <BarChart3 className="w-7 h-7" style={{ color: '#1e3a5f' }} />
            </div>
            <p className="text-sm font-medium" style={{ color: '#2d4a6e' }}>Dashboard Reativo</p>
            <p className="text-xs mt-1.5" style={{ color: '#1a2e47' }}>
              Cards de dados aparecerao aqui conforme a GIA analisa as informacoes
            </p>
          </motion.div>
        )}

        {cards.map((card) => (
          <DataCard key={card.id} card={card} />
        ))}
      </AnimatePresence>
    </div>
  );
}
