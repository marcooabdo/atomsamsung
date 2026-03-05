import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Mic, MicOff, Send, Loader2, Volume2, VolumeX, Square } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';

interface GIAInputBarProps {
  onSend: (text: string) => void;
  disabled: boolean;
  isListening: boolean;
  onMicToggle: () => void;
  voiceEnabled: boolean;
  onVoiceToggle: () => void;
  isSpeaking: boolean;
  onStopSpeaking: () => void;
  transcribedText?: string;
}

export function GIAInputBar({
  onSend,
  disabled,
  isListening,
  onMicToggle,
  voiceEnabled,
  onVoiceToggle,
  isSpeaking,
  onStopSpeaking,
  transcribedText,
}: GIAInputBarProps) {
  const [text, setText] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const { isDark } = useTheme();

  const inputTextColor = isDark ? '#e2e8f0' : '#1e293b';
  const iconColorWhite = isDark ? '#fff' : '#334155';
  const iconColorMuted = isDark ? 'rgba(255,255,255,0.4)' : '#94a3b8';
  const hintTextColor = isDark ? 'rgba(255,255,255,0.15)' : '#94a3b8';
  const formBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';
  const formBorderDefault = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.10)';
  const formBorderActive = 'rgba(0,210,255,0.2)';
  const btnBgOff = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
  const btnBorderOff = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(0,0,0,0.10)';
  const sendBtnBgOff = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.06)';
  const sendBtnBorderOff = isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(0,0,0,0.10)';

  useEffect(() => {
    if (!disabled && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled]);

  useEffect(() => {
    if (transcribedText) {
      setText(transcribedText);
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }
  }, [transcribedText]);

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
          background: formBg,
          border: `1px solid ${text.length > 0 ? formBorderActive : formBorderDefault}`,
          boxShadow: text.length > 0 ? '0 0 20px rgba(0,210,255,0.05)' : 'none',
        }}
      >
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isListening ? 'Ouvindo...' : 'Digite sua mensagem...'}
          disabled={disabled}
          className="flex-1 bg-transparent text-sm placeholder-gray-500 outline-none disabled:opacity-40"
          style={{ caretColor: '#00d2ff', color: inputTextColor }}
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
                : 'rgba(0,210,255,0.08)',
              border: isListening
                ? 'none'
                : '1px solid rgba(0,210,255,0.15)',
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            title={isListening ? 'Parar de ouvir' : 'Falar'}
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
            type="button"
            onClick={onVoiceToggle}
            disabled={disabled}
            className="relative p-2.5 rounded-full transition-all disabled:opacity-30"
            style={{
              background: voiceEnabled
                ? 'linear-gradient(135deg, #10b981, #059669)'
                : btnBgOff,
              border: voiceEnabled ? 'none' : btnBorderOff,
            }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.92 }}
            title={voiceEnabled ? 'Desativar voz da GIA (modo conversa)' : 'Ativar voz da GIA (modo conversa)'}
          >
            {voiceEnabled ? (
              <Volume2 className="w-4 h-4" style={{ color: iconColorWhite }} />
            ) : (
              <VolumeX className="w-4 h-4" style={{ color: iconColorMuted }} />
            )}
            {voiceEnabled && (
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ border: '2px solid rgba(16,185,129,0.4)' }}
                animate={{ scale: [1, 1.3], opacity: [0.5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
          </motion.button>

          {isSpeaking && (
            <motion.button
              type="button"
              onClick={onStopSpeaking}
              className="p-2.5 rounded-full transition-all"
              style={{
                background: 'rgba(239,68,68,0.15)',
                border: '1px solid rgba(239,68,68,0.3)',
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.92 }}
              title="Parar fala"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
            >
              <Square className="w-4 h-4" style={{ color: '#ef4444' }} />
            </motion.button>
          )}

          <motion.button
            type="submit"
            disabled={disabled || !text.trim()}
            className="p-2.5 rounded-full transition-all disabled:opacity-20"
            style={{
              background: text.trim()
                ? 'linear-gradient(135deg, #00d2ff, #0090ff)'
                : sendBtnBgOff,
              border: text.trim()
                ? '1px solid rgba(0,210,255,0.4)'
                : sendBtnBorderOff,
              boxShadow: text.trim() ? '0 0 15px rgba(0,210,255,0.2)' : 'none',
            }}
            whileHover={text.trim() ? { scale: 1.05 } : {}}
            whileTap={text.trim() ? { scale: 0.92 } : {}}
          >
            {disabled ? (
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#00d2ff' }} />
            ) : (
              <Send className="w-4 h-4" style={{ color: text.trim() ? iconColorWhite : iconColorMuted }} />
            )}
          </motion.button>
        </div>
      </form>

      <p className="text-center mt-2 text-[10px] tracking-wider" style={{ color: hintTextColor }}>
        {voiceEnabled ? 'Modo conversa ativado - Fale e a GIA responde com voz' : 'GIA tem acesso aos dados operacionais em tempo real'}
      </p>
    </div>
  );
}
