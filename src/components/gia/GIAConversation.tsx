import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sparkles,
  TrendingUp,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  List,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import {
  BarChart,
  ColumnChart,
  LineChart,
  AreaChart,
  PieChart,
  DonutChart,
  RadarChart,
  type ChartDataPoint,
} from './GIACharts';

export interface GIAMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  cards?: GIACardData[];
  timestamp: number;
}

export interface GIACardData {
  id: string;
  type: 'alert' | 'metric' | 'status' | 'list' | 'bar' | 'column' | 'line' | 'area' | 'pie' | 'donut' | 'radar';
  title: string;
  value?: string;
  subtitle?: string;
  color: string;
  items?: { label: string; value: string; status?: string }[];
  chartData?: ChartDataPoint[];
}

interface GIAConversationProps {
  messages: GIAMessage[];
  streamingText: string;
  isThinking: boolean;
  userName: string;
}

const colorMap: Record<string, { accent: string; bg: string; border: string; glow: string; badge: string; gradient: string }> = {
  red: {
    accent: '#ef4444',
    bg: 'rgba(239,68,68,0.06)',
    border: 'rgba(239,68,68,0.15)',
    glow: '0 0 20px rgba(239,68,68,0.08)',
    badge: 'rgba(239,68,68,0.12)',
    gradient: 'linear-gradient(135deg, rgba(239,68,68,0.1) 0%, rgba(239,68,68,0.03) 100%)',
  },
  green: {
    accent: '#10b981',
    bg: 'rgba(16,185,129,0.06)',
    border: 'rgba(16,185,129,0.15)',
    glow: '0 0 20px rgba(16,185,129,0.08)',
    badge: 'rgba(16,185,129,0.12)',
    gradient: 'linear-gradient(135deg, rgba(16,185,129,0.1) 0%, rgba(16,185,129,0.03) 100%)',
  },
  cyan: {
    accent: '#00d2ff',
    bg: 'rgba(0,210,255,0.05)',
    border: 'rgba(0,210,255,0.12)',
    glow: '0 0 20px rgba(0,210,255,0.06)',
    badge: 'rgba(0,210,255,0.1)',
    gradient: 'linear-gradient(135deg, rgba(0,210,255,0.08) 0%, rgba(0,210,255,0.02) 100%)',
  },
  amber: {
    accent: '#f59e0b',
    bg: 'rgba(245,158,11,0.06)',
    border: 'rgba(245,158,11,0.15)',
    glow: '0 0 20px rgba(245,158,11,0.08)',
    badge: 'rgba(245,158,11,0.12)',
    gradient: 'linear-gradient(135deg, rgba(245,158,11,0.1) 0%, rgba(245,158,11,0.03) 100%)',
  },
  blue: {
    accent: '#3b82f6',
    bg: 'rgba(59,130,246,0.06)',
    border: 'rgba(59,130,246,0.15)',
    glow: '0 0 20px rgba(59,130,246,0.08)',
    badge: 'rgba(59,130,246,0.12)',
    gradient: 'linear-gradient(135deg, rgba(59,130,246,0.1) 0%, rgba(59,130,246,0.03) 100%)',
  },
};

const iconMap: Record<string, typeof TrendingUp> = {
  alert: AlertTriangle,
  metric: TrendingUp,
  chart: BarChart3,
  status: CheckCircle2,
  list: List,
};

function MetricCard({ card, delay = 0 }: { card: GIACardData; delay?: number }) {
  const colors = colorMap[card.color] || colorMap.cyan;
  const Icon = iconMap[card.type] || TrendingUp;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: [0.23, 1, 0.32, 1] }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: colors.gradient,
        border: `1px solid ${colors.border}`,
        boxShadow: colors.glow,
      }}
    >
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: colors.badge }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color: colors.accent }} />
          </div>
          <span
            className="text-[10px] font-bold tracking-wider uppercase"
            style={{ color: colors.accent }}
          >
            {card.title}
          </span>
        </div>

        {card.value && (
          <div>
            <span
              className="text-2xl font-bold tracking-tight block"
              style={{ color: colors.accent, textShadow: `0 0 20px ${colors.accent}25` }}
            >
              {card.value}
            </span>
            {card.subtitle && (
              <p className="text-[11px] mt-1" style={{ color: 'rgba(255,255,255,0.35)' }}>
                {card.subtitle}
              </p>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ListCard({ card, delay = 0 }: { card: GIACardData; delay?: number }) {
  const colors = colorMap[card.color] || colorMap.cyan;
  const Icon = iconMap[card.type] || List;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.5, delay, ease: [0.23, 1, 0.32, 1] }}
      className="rounded-2xl overflow-hidden"
      style={{
        background: 'rgba(255,255,255,0.02)',
        border: `1px solid ${colors.border}`,
        boxShadow: colors.glow,
      }}
    >
      <div className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <div
            className="w-7 h-7 rounded-lg flex items-center justify-center"
            style={{ background: colors.badge }}
          >
            <Icon className="w-3.5 h-3.5" style={{ color: colors.accent }} />
          </div>
          <span
            className="text-[10px] font-bold tracking-wider uppercase"
            style={{ color: colors.accent }}
          >
            {card.title}
          </span>
        </div>

        <div className="space-y-1">
          {card.items?.map((item, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: 8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: delay + i * 0.06 }}
              className="flex items-center justify-between py-2 px-2.5 rounded-lg"
              style={{ background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent' }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{
                    background: item.status === 'good' ? '#10b981' : item.status === 'bad' ? '#ef4444' : colors.accent,
                    boxShadow: `0 0 6px ${item.status === 'good' ? '#10b98180' : item.status === 'bad' ? '#ef444480' : `${colors.accent}80`}`,
                  }}
                />
                <span className="text-xs" style={{ color: 'rgba(255,255,255,0.55)' }}>
                  {item.label}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className="text-xs font-semibold tabular-nums"
                  style={{
                    color: item.status === 'good' ? '#10b981' : item.status === 'bad' ? '#ef4444' : '#e2e8f0',
                  }}
                >
                  {item.value}
                </span>
                {item.status === 'good' && <ArrowUpRight className="w-3 h-3 text-emerald-500" />}
                {item.status === 'bad' && <ArrowDownRight className="w-3 h-3 text-red-500" />}
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </motion.div>
  );
}


function InlineCards({ cards }: { cards: GIACardData[] }) {
  const metricCards = cards.filter(c => c.type === 'metric' || c.type === 'alert' || c.type === 'status');
  const listCards = cards.filter(c => c.type === 'list');
  const barCharts = cards.filter(c => c.type === 'bar');
  const columnCharts = cards.filter(c => c.type === 'column');
  const lineCharts = cards.filter(c => c.type === 'line');
  const areaCharts = cards.filter(c => c.type === 'area');
  const pieCharts = cards.filter(c => c.type === 'pie');
  const donutCharts = cards.filter(c => c.type === 'donut');
  const radarCharts = cards.filter(c => c.type === 'radar');

  const useGrid = metricCards.length >= 2;
  let currentDelay = 0;

  return (
    <div className="mt-3 space-y-3">
      {useGrid ? (
        <div className="grid grid-cols-2 gap-2.5">
          {metricCards.map((card, i) => {
            const delay = i * 0.08;
            return <MetricCard key={card.id} card={card} delay={delay} />;
          })}
        </div>
      ) : (
        metricCards.map((card, i) => {
          const delay = i * 0.08;
          return <MetricCard key={card.id} card={card} delay={delay} />;
        })
      )}

      {listCards.map((card, i) => {
        currentDelay = (metricCards.length * 0.08) + i * 0.1;
        return <ListCard key={card.id} card={card} delay={currentDelay} />;
      })}

      {barCharts.map((card, i) => {
        currentDelay = (metricCards.length * 0.08) + (listCards.length * 0.1) + i * 0.1;
        return (
          <BarChart
            key={card.id}
            data={card.chartData || []}
            title={card.title}
            color={card.color}
            delay={currentDelay}
            subtitle={card.subtitle}
          />
        );
      })}

      {columnCharts.map((card, i) => {
        currentDelay = (metricCards.length * 0.08) + (listCards.length * 0.1) + (barCharts.length * 0.1) + i * 0.1;
        return (
          <ColumnChart
            key={card.id}
            data={card.chartData || []}
            title={card.title}
            color={card.color}
            delay={currentDelay}
            subtitle={card.subtitle}
          />
        );
      })}

      {lineCharts.map((card, i) => {
        currentDelay = (metricCards.length * 0.08) + (listCards.length * 0.1) + (barCharts.length * 0.1) + (columnCharts.length * 0.1) + i * 0.1;
        return (
          <LineChart
            key={card.id}
            data={card.chartData || []}
            title={card.title}
            color={card.color}
            delay={currentDelay}
            subtitle={card.subtitle}
          />
        );
      })}

      {areaCharts.map((card, i) => {
        currentDelay += i * 0.1;
        return (
          <AreaChart
            key={card.id}
            data={card.chartData || []}
            title={card.title}
            color={card.color}
            delay={currentDelay}
            subtitle={card.subtitle}
          />
        );
      })}

      {pieCharts.map((card, i) => {
        currentDelay += i * 0.1;
        return (
          <PieChart
            key={card.id}
            data={card.chartData || []}
            title={card.title}
            color={card.color}
            delay={currentDelay}
            subtitle={card.subtitle}
          />
        );
      })}

      {donutCharts.map((card, i) => {
        currentDelay += i * 0.1;
        return (
          <DonutChart
            key={card.id}
            data={card.chartData || []}
            title={card.title}
            color={card.color}
            delay={currentDelay}
            subtitle={card.subtitle}
          />
        );
      })}

      {radarCharts.map((card, i) => {
        currentDelay += i * 0.1;
        return (
          <RadarChart
            key={card.id}
            data={card.chartData || []}
            title={card.title}
            color={card.color}
            delay={currentDelay}
            subtitle={card.subtitle}
          />
        );
      })}
    </div>
  );
}

function formatText(text: string) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#e2e8f0">$1</strong>')
    .replace(/^- /gm, '<span style="color:#00d2ff;margin-right:6px">&#8226;</span>')
    .replace(/\n/g, '<br/>');
}

export function GIAConversation({ messages, streamingText, isThinking, userName }: GIAConversationProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText, isThinking]);

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-y-auto px-4 sm:px-8 pt-8 pb-16 space-y-5"
      style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.08) transparent' }}
    >
      <AnimatePresence mode="popLayout">
        {messages.map((msg) => (
          <motion.div
            key={msg.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: [0.23, 1, 0.32, 1] }}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`max-w-[95%] sm:max-w-[80%] ${msg.role === 'user' ? '' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="flex items-center gap-2 mb-1.5">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center"
                    style={{
                      background: 'linear-gradient(135deg, rgba(0,210,255,0.3), rgba(0,255,200,0.2))',
                      border: '1px solid rgba(0,210,255,0.3)',
                    }}>
                    <Sparkles className="w-2.5 h-2.5" style={{ color: '#00d2ff' }} />
                  </div>
                  <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#00d2ff' }}>
                    GIA
                  </span>
                </div>
              )}

              {msg.role === 'user' && (
                <div className="flex items-center gap-2 mb-1.5 justify-end">
                  <span className="text-[10px] font-medium tracking-wide" style={{ color: 'rgba(255,255,255,0.3)' }}>
                    {userName}
                  </span>
                </div>
              )}

              <div
                className="rounded-2xl px-4 py-3"
                style={{
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, rgba(0,210,255,0.12), rgba(0,150,255,0.08))'
                    : 'rgba(255,255,255,0.025)',
                  border: msg.role === 'user'
                    ? '1px solid rgba(0,210,255,0.2)'
                    : '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <div
                  className="text-sm leading-relaxed"
                  style={{ color: msg.role === 'user' ? '#d0e4f0' : '#b8c8d8' }}
                  dangerouslySetInnerHTML={{ __html: formatText(msg.content) }}
                />
              </div>

              {msg.cards && msg.cards.length > 0 && (
                <InlineCards cards={msg.cards} />
              )}
            </div>
          </motion.div>
        ))}

        {streamingText && (
          <motion.div
            key="streaming"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="max-w-[95%] sm:max-w-[80%]">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="w-5 h-5 rounded-full flex items-center justify-center"
                  style={{
                    background: 'linear-gradient(135deg, rgba(0,210,255,0.3), rgba(0,255,200,0.2))',
                    border: '1px solid rgba(0,210,255,0.3)',
                  }}>
                  <Sparkles className="w-2.5 h-2.5" style={{ color: '#00d2ff' }} />
                </div>
                <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#00d2ff' }}>
                  GIA
                </span>
              </div>
              <div
                className="rounded-2xl px-4 py-3"
                style={{
                  background: 'rgba(255,255,255,0.025)',
                  border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <div
                  className="text-sm leading-relaxed"
                  style={{ color: '#b8c8d8' }}
                  dangerouslySetInnerHTML={{ __html: formatText(streamingText) }}
                />
                <motion.span
                  className="inline-block w-[2px] h-4 ml-0.5 align-text-bottom"
                  style={{ background: '#00d2ff' }}
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity }}
                />
              </div>
            </div>
          </motion.div>
        )}

        {isThinking && !streamingText && (
          <motion.div
            key="thinking"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex justify-start"
          >
            <div className="flex items-center gap-3 px-4 py-3 rounded-2xl"
              style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div className="flex gap-1.5">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-2 h-2 rounded-full"
                    style={{ background: 'rgba(200,220,240,0.8)' }}
                    animate={{ y: [0, -8, 0], opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 0.7, repeat: Infinity, delay: i * 0.15, ease: 'easeInOut' }}
                  />
                ))}
              </div>
              <span className="text-xs" style={{ color: 'rgba(255,255,255,0.3)' }}>Consultando dados...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
