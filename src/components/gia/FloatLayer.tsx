import { motion, AnimatePresence } from 'framer-motion';
import { X, BarChart3 } from 'lucide-react';
import { ReactiveCards } from './ReactiveCards';
import type { CardData } from './giaScript';

interface FloatLayerProps {
  cards: CardData[];
  visible: boolean;
  onToggle: () => void;
}

export function FloatLayer({ cards, visible, onToggle }: FloatLayerProps) {
  return (
    <AnimatePresence>
      {visible && cards.length > 0 && (
        <motion.div
          initial={{ x: '100%', opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          exit={{ x: '100%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="absolute right-0 top-0 bottom-0 w-[360px] z-30 hidden lg:flex flex-col"
          style={{
            background: 'rgba(6,10,16,0.92)',
            borderLeft: '1px solid rgba(0,210,255,0.08)',
            backdropFilter: 'blur(20px)',
            boxShadow: '-20px 0 60px rgba(0,0,0,0.3)',
          }}
        >
          <div
            className="flex items-center justify-between px-4 py-3 flex-shrink-0"
            style={{ borderBottom: '1px solid rgba(0,210,255,0.06)' }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center"
                style={{
                  background: 'rgba(0,210,255,0.1)',
                  border: '1px solid rgba(0,210,255,0.15)',
                }}
              >
                <BarChart3 className="w-3 h-3" style={{ color: '#00d2ff' }} />
              </div>
              <span
                className="text-[10px] uppercase tracking-[0.2em] font-semibold"
                style={{ color: '#00d2ff' }}
              >
                Dados Reativos
              </span>
              <motion.span
                className="text-[10px] tabular-nums px-2 py-0.5 rounded-full"
                style={{
                  background: 'rgba(0,210,255,0.1)',
                  color: '#00d2ff',
                  border: '1px solid rgba(0,210,255,0.15)',
                }}
                key={cards.length}
                initial={{ scale: 1.3 }}
                animate={{ scale: 1 }}
              >
                {cards.length}
              </motion.span>
            </div>

            <button
              onClick={onToggle}
              className="p-1.5 rounded-lg transition-colors hover:bg-white/5"
              title="Fechar painel"
            >
              <X className="w-3.5 h-3.5" style={{ color: '#475569' }} />
            </button>
          </div>

          <div className="flex-1 min-h-0">
            <ReactiveCards cards={cards} />
          </div>

          <div
            className="px-4 py-2 flex-shrink-0"
            style={{ borderTop: '1px solid rgba(0,210,255,0.04)' }}
          >
            <div className="flex items-center gap-1.5">
              <motion.div
                className="w-1 h-1 rounded-full"
                style={{ background: '#00d2ff' }}
                animate={{ opacity: [0.3, 1, 0.3] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
              <span className="text-[9px] tracking-widest uppercase" style={{ color: '#1e3a5f' }}>
                Atualizado em tempo real
              </span>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
