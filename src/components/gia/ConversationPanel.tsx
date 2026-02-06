import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, SkipForward, RotateCcw } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  isStreaming?: boolean;
}

interface ConversationPanelProps {
  messages: Message[];
  aiState: 'idle' | 'listening' | 'thinking' | 'speaking';
  streamingText: string;
  onMicToggle: () => void;
  onSkip: () => void;
  onReset: () => void;
  isRunning: boolean;
}

export function ConversationPanel({
  messages,
  aiState,
  streamingText,
  onMicToggle,
  onSkip,
  onReset,
  isRunning,
}: ConversationPanelProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4" style={{ scrollbarWidth: 'thin', scrollbarColor: '#1e293b transparent' }}>
        <AnimatePresence mode="popLayout">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.95 }}
              transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className="max-w-[85%] rounded-2xl px-5 py-3.5"
                style={{
                  background: msg.role === 'user'
                    ? 'linear-gradient(135deg, rgba(0, 210, 255, 0.15), rgba(0, 150, 255, 0.1))'
                    : 'rgba(255, 255, 255, 0.03)',
                  border: msg.role === 'user'
                    ? '1px solid rgba(0, 210, 255, 0.25)'
                    : '1px solid rgba(255, 255, 255, 0.06)',
                  backdropFilter: 'blur(10px)',
                }}
              >
                {msg.role === 'assistant' && (
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                      style={{
                        background: 'linear-gradient(135deg, #00d2ff, #00ffc8)',
                        color: '#0a0e1a',
                      }}>
                      G
                    </div>
                    <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#00d2ff' }}>
                      GIA
                    </span>
                  </div>
                )}
                <p className="text-sm leading-relaxed" style={{
                  color: msg.role === 'user' ? '#e2e8f0' : '#c8d6e5',
                }}>
                  {msg.text}
                </p>
              </div>
            </motion.div>
          ))}

          {streamingText && (
            <motion.div
              key="streaming"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div
                className="max-w-[85%] rounded-2xl px-5 py-3.5"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.06)',
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                    style={{ background: 'linear-gradient(135deg, #00d2ff, #00ffc8)', color: '#0a0e1a' }}>
                    G
                  </div>
                  <span className="text-[10px] font-semibold tracking-widest uppercase" style={{ color: '#00d2ff' }}>
                    GIA
                  </span>
                </div>
                <p className="text-sm leading-relaxed" style={{ color: '#c8d6e5' }}>
                  {streamingText}
                  <motion.span
                    className="inline-block w-[2px] h-4 ml-0.5 align-text-bottom"
                    style={{ background: '#00d2ff' }}
                    animate={{ opacity: [1, 0] }}
                    transition={{ duration: 0.6, repeat: Infinity }}
                  />
                </p>
              </div>
            </motion.div>
          )}

          {aiState === 'thinking' && !streamingText && (
            <motion.div
              key="thinking"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex justify-start"
            >
              <div className="flex items-center gap-2 px-5 py-3 rounded-2xl"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex gap-1.5">
                  {[0, 1, 2].map((i) => (
                    <motion.div
                      key={i}
                      className="w-2 h-2 rounded-full"
                      style={{ background: '#00d2ff' }}
                      animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
                      transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </div>
                <span className="text-xs ml-1" style={{ color: '#4a5568' }}>Analisando dados...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex-shrink-0 px-6 py-5 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
        <div className="flex items-center justify-center gap-4">
          <motion.button
            onClick={onReset}
            className="p-3 rounded-xl transition-colors"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#64748b',
            }}
            whileHover={{ scale: 1.05, borderColor: 'rgba(255,255,255,0.15)' }}
            whileTap={{ scale: 0.95 }}
            title="Reiniciar"
          >
            <RotateCcw className="w-4 h-4" />
          </motion.button>

          <motion.button
            onClick={onMicToggle}
            className="relative p-5 rounded-full"
            style={{
              background: aiState === 'listening'
                ? 'linear-gradient(135deg, #00d2ff, #00ffc8)'
                : 'rgba(0, 210, 255, 0.1)',
              border: aiState === 'listening'
                ? 'none'
                : '1px solid rgba(0, 210, 255, 0.3)',
              boxShadow: aiState === 'listening'
                ? '0 0 30px rgba(0, 210, 255, 0.4), 0 0 60px rgba(0, 210, 255, 0.15)'
                : '0 0 20px rgba(0, 210, 255, 0.1)',
            }}
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
          >
            {aiState === 'listening' ? (
              <MicOff className="w-6 h-6" style={{ color: '#0a0e1a' }} />
            ) : (
              <Mic className="w-6 h-6" style={{ color: '#00d2ff' }} />
            )}
            {aiState === 'listening' && (
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ border: '2px solid rgba(0, 210, 255, 0.5)' }}
                animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
            )}
          </motion.button>

          <motion.button
            onClick={onSkip}
            disabled={!isRunning}
            className="p-3 rounded-xl transition-colors disabled:opacity-30"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              color: '#64748b',
            }}
            whileHover={{ scale: 1.05, borderColor: 'rgba(255,255,255,0.15)' }}
            whileTap={{ scale: 0.95 }}
            title="Proximo"
          >
            <SkipForward className="w-4 h-4" />
          </motion.button>
        </div>
        <p className="text-center mt-3 text-[10px] tracking-wider uppercase" style={{ color: '#374151' }}>
          {aiState === 'idle' ? 'Pressione o microfone para iniciar' : 'Demonstracao em andamento'}
        </p>
      </div>
    </div>
  );
}
