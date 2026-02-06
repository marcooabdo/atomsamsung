import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles } from 'lucide-react';

export interface GIAMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  cards?: GIACardData[];
  timestamp: number;
}

export interface GIACardData {
  id: string;
  type: 'alert' | 'metric' | 'chart' | 'status' | 'list';
  title: string;
  value?: string;
  subtitle?: string;
  color: string;
  items?: { label: string; value: string; status?: string }[];
  chartData?: { label: string; value: number }[];
}

interface GIAConversationProps {
  messages: GIAMessage[];
  streamingText: string;
  isThinking: boolean;
  userName: string;
}

const colorMap: Record<string, { accent: string; bg: string; border: string }> = {
  red: { accent: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)' },
  green: { accent: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)' },
  cyan: { accent: '#00d2ff', bg: 'rgba(0,210,255,0.06)', border: 'rgba(0,210,255,0.2)' },
  amber: { accent: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)' },
  blue: { accent: '#3b82f6', bg: 'rgba(59,130,246,0.08)', border: 'rgba(59,130,246,0.2)' },
};

function MiniCard({ card }: { card: GIACardData }) {
  const colors = colorMap[card.color] || colorMap.cyan;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="rounded-xl overflow-hidden mt-2"
      style={{
        background: colors.bg,
        border: `1px solid ${colors.border}`,
      }}
    >
      <div className="px-3 py-2.5">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: colors.accent }} />
          <span className="text-[10px] font-semibold tracking-wide uppercase" style={{ color: colors.accent }}>
            {card.title}
          </span>
        </div>

        {card.value && (
          <div className="mt-1">
            <span className="text-xl font-bold" style={{ color: colors.accent }}>
              {card.value}
            </span>
            {card.subtitle && (
              <p className="text-[11px] mt-0.5" style={{ color: 'rgba(255,255,255,0.4)' }}>{card.subtitle}</p>
            )}
          </div>
        )}

        {card.items && (
          <div className="space-y-1 mt-1.5">
            {card.items.map((item, i) => (
              <div key={i} className="flex items-center justify-between py-0.5">
                <div className="flex items-center gap-1.5">
                  <div className="w-1 h-1 rounded-full" style={{
                    background: item.status === 'good' ? '#10b981' : item.status === 'bad' ? '#ef4444' : colors.accent,
                  }} />
                  <span className="text-[11px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{item.label}</span>
                </div>
                <span className="text-[11px] font-medium" style={{
                  color: item.status === 'good' ? '#10b981' : item.status === 'bad' ? '#ef4444' : 'rgba(255,255,255,0.7)',
                }}>
                  {item.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {card.chartData && (
          <div className="space-y-1.5 mt-2">
            {card.chartData.map((item, i) => {
              const max = Math.max(...(card.chartData || []).map(d => d.value));
              return (
                <div key={i}>
                  <div className="flex justify-between items-center mb-0.5">
                    <span className="text-[10px]" style={{ color: 'rgba(255,255,255,0.5)' }}>{item.label}</span>
                    <span className="text-[10px] font-bold tabular-nums" style={{ color: colors.accent }}>
                      {item.value >= 1000 ? `R$ ${(item.value / 1000).toFixed(1)}k` : item.value}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.04)' }}>
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: colors.accent }}
                      initial={{ width: 0 }}
                      animate={{ width: `${(item.value / max) * 100}%` }}
                      transition={{ duration: 0.6, delay: i * 0.1 }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
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
      className="h-full overflow-y-auto px-4 sm:px-8 py-6 space-y-5"
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
            <div className={`max-w-[90%] sm:max-w-[75%] ${msg.role === 'user' ? '' : ''}`}>
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
                <div className="mt-2 space-y-2">
                  {msg.cards.map((card) => (
                    <MiniCard key={card.id} card={card} />
                  ))}
                </div>
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
            <div className="max-w-[90%] sm:max-w-[75%]">
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
