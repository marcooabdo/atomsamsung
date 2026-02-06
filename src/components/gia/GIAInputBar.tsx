import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Send, Loader2 } from 'lucide-react';

interface GIAInputBarProps {
  onSend: (text: string) => void;
  disabled: boolean;
  isListening: boolean;
  onMicToggle: () => void;
}

export function GIAInputBar({ onSend, disabled, isListening, onMicToggle }: GIAInputBarProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled]);

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
    <div className="flex-shrink-0 px-4 sm:px-8 pb-6 pt-3">
      <form
        onSubmit={handleSubmit}
        className="relative flex items-center gap-3 rounded-2xl px-4 py-3 transition-all duration-300"
        style={{
          background: 'rgba(255,255,255,0.03)',
          border: `1px solid ${text.length > 0 ? 'rgba(0,210,255,0.2)' : 'rgba(255,255,255,0.06)'}`,
          boxShadow: text.length > 0 ? '0 0 20px rgba(0,210,255,0.05)' : 'none',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Digite sua mensagem..."
          disabled={disabled}
          className="flex-1 bg-transparent text-sm text-white placeholder-gray-600 outline-none disabled:opacity-40"
          style={{ caretColor: '#00d2ff' }}
        />

        <div className="flex items-center gap-2">
          <motion.button
            type="button"
            onClick={onMicToggle}
            disabled={disabled}
            className="relative p-2.5 rounded-full transition-all disabled:opacity-30"
            style={{
              background: isListening
                ? 'linear-gradient(135deg, #00d2ff, #00ffc8)'
                : 'rgba(0,210,255,0.08)',
              border: isListening
                ? 'none'
                : '1px solid rgba(0,210,255,0.15)',
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
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
                animate={{ scale: [1, 1.6], opacity: [0.6, 0] }}
                transition={{ duration: 1.2, repeat: Infinity }}
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
                : 'rgba(255,255,255,0.04)',
              border: text.trim()
                ? '1px solid rgba(0,210,255,0.4)'
                : '1px solid rgba(255,255,255,0.06)',
              boxShadow: text.trim() ? '0 0 15px rgba(0,210,255,0.2)' : 'none',
            }}
            whileHover={text.trim() ? { scale: 1.05 } : {}}
            whileTap={text.trim() ? { scale: 0.92 } : {}}
          >
            {disabled ? (
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#00d2ff' }} />
            ) : (
              <Send className="w-4 h-4" style={{ color: text.trim() ? '#fff' : 'rgba(255,255,255,0.2)' }} />
            )}
          </motion.button>
        </div>
      </form>

      <p className="text-center mt-2 text-[10px] tracking-wider" style={{ color: 'rgba(255,255,255,0.15)' }}>
        GIA tem acesso aos dados operacionais em tempo real
      </p>
    </div>
  );
}
