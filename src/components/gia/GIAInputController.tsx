import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Send, Loader2, Keyboard, AudioLines, Square } from 'lucide-react';

interface GIAInputControllerProps {
  mode: 'voice' | 'text';
  onModeChange: (mode: 'voice' | 'text') => void;
  onSend: (text: string) => void;
  disabled: boolean;
  isListening: boolean;
  onMicToggle: () => void;
  isSpeaking: boolean;
  onStopSpeaking: () => void;
  transcribedText?: string;
}

export function GIAInputController({
  mode,
  onModeChange,
  onSend,
  disabled,
  isListening,
  onMicToggle,
  isSpeaking,
  onStopSpeaking,
  transcribedText,
}: GIAInputControllerProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!disabled && mode === 'text' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled, mode]);

  useEffect(() => {
    if (transcribedText) {
      if (mode === 'voice') {
        onSend(transcribedText);
      } else {
        setText(transcribedText);
        inputRef.current?.focus();
      }
    }
  }, [transcribedText, mode, onSend]);

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!text.trim() || disabled) return;
    onSend(text.trim());
    setText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="flex-shrink-0 px-4 sm:px-8 pb-5 pt-3">
      <div className="flex items-center justify-center mb-4">
        <div
          className="relative flex items-center rounded-full p-0.5"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.08)',
          }}
        >
          <motion.div
            className="absolute rounded-full"
            style={{
              width: '50%',
              height: 'calc(100% - 4px)',
              top: 2,
              background: 'linear-gradient(135deg, rgba(0,210,255,0.15), rgba(0,180,255,0.08))',
              border: '1px solid rgba(0,210,255,0.3)',
              boxShadow: '0 0 15px rgba(0,210,255,0.1)',
            }}
            animate={{ left: mode === 'voice' ? 2 : '50%' }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
          />

          <button
            onClick={() => onModeChange('voice')}
            className="relative z-10 flex items-center gap-2 px-5 py-2 rounded-full transition-colors"
          >
            <AudioLines
              className="w-3.5 h-3.5"
              style={{ color: mode === 'voice' ? '#00d2ff' : '#4a5568' }}
            />
            <span
              className="text-[11px] font-semibold tracking-widest uppercase"
              style={{ color: mode === 'voice' ? '#00d2ff' : '#4a5568' }}
            >
              VOZ
            </span>
          </button>

          <button
            onClick={() => onModeChange('text')}
            className="relative z-10 flex items-center gap-2 px-5 py-2 rounded-full transition-colors"
          >
            <Keyboard
              className="w-3.5 h-3.5"
              style={{ color: mode === 'text' ? '#00d2ff' : '#4a5568' }}
            />
            <span
              className="text-[11px] font-semibold tracking-widest uppercase"
              style={{ color: mode === 'text' ? '#00d2ff' : '#4a5568' }}
            >
              TEXTO
            </span>
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {mode === 'voice' ? (
          <motion.div
            key="voice-input"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col items-center gap-4"
          >
            <div className="flex items-center gap-4">
              {isSpeaking && (
                <motion.button
                  onClick={onStopSpeaking}
                  className="p-3 rounded-full"
                  style={{
                    background: 'rgba(239,68,68,0.12)',
                    border: '1px solid rgba(239,68,68,0.25)',
                  }}
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.9 }}
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  title="Parar fala"
                >
                  <Square className="w-4 h-4" style={{ color: '#ef4444' }} />
                </motion.button>
              )}

              <motion.button
                onClick={onMicToggle}
                disabled={disabled}
                className="relative p-6 rounded-full disabled:opacity-30"
                style={{
                  background: isListening
                    ? 'linear-gradient(135deg, #00d2ff, #00ffc8)'
                    : 'rgba(0,210,255,0.08)',
                  border: isListening ? 'none' : '2px solid rgba(0,210,255,0.25)',
                  boxShadow: isListening
                    ? '0 0 40px rgba(0,210,255,0.4), 0 0 80px rgba(0,210,255,0.15)'
                    : '0 0 20px rgba(0,210,255,0.08)',
                }}
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.92 }}
              >
                {disabled ? (
                  <Loader2 className="w-7 h-7 animate-spin" style={{ color: '#00d2ff' }} />
                ) : isListening ? (
                  <MicOff className="w-7 h-7" style={{ color: '#0a0e1a' }} />
                ) : (
                  <Mic className="w-7 h-7" style={{ color: '#00d2ff' }} />
                )}

                {isListening && (
                  <>
                    <motion.div
                      className="absolute inset-0 rounded-full"
                      style={{ border: '2px solid rgba(0,210,255,0.5)' }}
                      animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
                      transition={{ duration: 1.2, repeat: Infinity }}
                    />
                    <motion.div
                      className="absolute inset-0 rounded-full"
                      style={{ border: '2px solid rgba(0,210,255,0.3)' }}
                      animate={{ scale: [1, 2], opacity: [0.4, 0] }}
                      transition={{ duration: 1.8, repeat: Infinity, delay: 0.3 }}
                    />
                  </>
                )}
              </motion.button>
            </div>

            <p className="text-[10px] tracking-[0.15em] uppercase" style={{ color: '#374151' }}>
              {disabled
                ? 'Processando...'
                : isListening
                  ? 'Ouvindo - Fale agora'
                  : 'Pressione para falar'}
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="text-input"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.25 }}
          >
            <form
              onSubmit={handleSubmit}
              className="relative flex items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-300"
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: `1px solid ${text.length > 0 ? 'rgba(0,210,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
                boxShadow: text.length > 0 ? '0 0 25px rgba(0,210,255,0.05)' : 'none',
              }}
            >
              <input
                ref={inputRef}
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua mensagem para a GIA..."
                disabled={disabled}
                className="flex-1 bg-transparent text-sm text-white placeholder-gray-700 outline-none disabled:opacity-40"
                style={{ caretColor: '#00d2ff' }}
              />

              <div className="flex items-center gap-1.5">
                <motion.button
                  type="button"
                  onClick={onMicToggle}
                  disabled={disabled}
                  className="relative p-2.5 rounded-full transition-all disabled:opacity-30"
                  style={{
                    background: isListening
                      ? 'linear-gradient(135deg, #00d2ff, #00ffc8)'
                      : 'rgba(0,210,255,0.06)',
                    border: isListening ? 'none' : '1px solid rgba(0,210,255,0.12)',
                  }}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.92 }}
                  title="Falar"
                >
                  {isListening ? (
                    <MicOff className="w-4 h-4" style={{ color: '#0a0e1a' }} />
                  ) : (
                    <Mic className="w-4 h-4" style={{ color: '#00d2ff' }} />
                  )}
                  {isListening && (
                    <motion.div
                      className="absolute inset-0 rounded-full"
                      style={{ border: '2px solid rgba(0,210,255,0.5)' }}
                      animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                  )}
                </motion.button>

                <motion.button
                  type="submit"
                  disabled={disabled || !text.trim()}
                  className="p-2.5 rounded-full transition-all disabled:opacity-20"
                  style={{
                    background: text.trim()
                      ? 'linear-gradient(135deg, #00d2ff, #0090ff)'
                      : 'rgba(255,255,255,0.03)',
                    border: text.trim()
                      ? '1px solid rgba(0,210,255,0.4)'
                      : '1px solid rgba(255,255,255,0.05)',
                    boxShadow: text.trim() ? '0 0 15px rgba(0,210,255,0.15)' : 'none',
                  }}
                  whileHover={text.trim() ? { scale: 1.05 } : {}}
                  whileTap={text.trim() ? { scale: 0.92 } : {}}
                >
                  {disabled ? (
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#00d2ff' }} />
                  ) : (
                    <Send className="w-4 h-4" style={{ color: text.trim() ? '#fff' : 'rgba(255,255,255,0.15)' }} />
                  )}
                </motion.button>
              </div>
            </form>

            <p className="text-center mt-2 text-[10px] tracking-[0.12em]" style={{ color: 'rgba(255,255,255,0.12)' }}>
              GIA tem acesso aos dados operacionais em tempo real
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
