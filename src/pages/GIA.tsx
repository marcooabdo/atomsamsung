import { useState, useCallback, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GIACoreVisualizer } from '../components/gia/GIACoreVisualizer';
import { GIAConversation, type GIAMessage, type GIACardData } from '../components/gia/GIAConversation';
import { GIAInputController } from '../components/gia/GIAInputController';
import { createMockAIStream } from '../components/gia/mockAIStream';
import type { CardData } from '../components/gia/giaScript';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { speakGia, stopGiaSpeaking } from '../lib/elevenLabsTTS';
import {
  Sparkles,
  History,
  Plus,
  Trash2,
  X,
  Wifi,
  WifiOff,
  AlertCircle,
} from 'lucide-react';

type ConnectionStatus = 'checking' | 'connected' | 'partial' | 'error';

interface ConnectionState {
  status: ConnectionStatus;
  chatgpt: boolean;
  elevenlabs: boolean;
  error?: string;
}

export function GIA() {
  const { usuario } = useAuth();
  const [currentMode, setCurrentMode] = useState<'voice' | 'text'>('text');
  const [aiState, setAiState] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [messages, setMessages] = useState<GIAMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<{ id: string; titulo: string; updated_at: string }[]>([]);
  const [connection, setConnection] = useState<ConnectionState>({ status: 'checking', chatgpt: false, elevenlabs: false });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [transcribedText, setTranscribedText] = useState<string | undefined>(undefined);
  const greetingDoneRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const cancelStreamRef = useRef<(() => void) | null>(null);
  const streamIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingContentRef = useRef<string>('');

  useEffect(() => {
    checkConnections();
    return () => {
      stopGiaSpeaking();
      if (streamIntervalRef.current) clearInterval(streamIntervalRef.current);
      if (cancelStreamRef.current) cancelStreamRef.current();
    };
  }, []);

  useEffect(() => {
    if (usuario?.id) loadConversations();
  }, [usuario?.id]);

  useEffect(() => {
    if (!usuario || greetingDoneRef.current) return;
    greetingDoneRef.current = true;

    const isChefe = usuario.email === 'marcoabdo@groupglobal.com.br' || usuario.tipo === 'master';
    const displayName = isChefe ? 'chefe' : (usuario.nome?.split(' ')[0] || 'usuario');
    const greetingText = `Ola ${displayName}! Sou a GIA, sua assistente inteligente. Estou conectada ao sistema ATOM e pronta pra te ajudar. O que você precisa?`;

    const greetingMessage: GIAMessage = {
      id: `greeting-${Date.now()}`,
      role: 'assistant',
      content: greetingText,
      timestamp: Date.now(),
    };
    setMessages([greetingMessage]);
    setAiState('speaking');
    speakGia(greetingText).finally(() => setAiState('idle'));
  }, [usuario]);

  const checkConnections = async () => {
    setConnection({ status: 'checking', chatgpt: false, elevenlabs: false });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setConnection({ status: 'connected', chatgpt: true, elevenlabs: true });
      } else {
        setConnection({ status: 'partial', chatgpt: false, elevenlabs: false, error: 'Usuario nao autenticado' });
      }
    } catch (err) {
      setConnection({ status: 'partial', chatgpt: false, elevenlabs: false, error: err instanceof Error ? err.message : 'Falha ao conectar' });
    }
  };

  const loadConversations = async () => {
    if (!usuario?.id) return;
    const { data } = await supabase
      .from('gia_conversations')
      .select('id, titulo, updated_at')
      .eq('usuario_id', usuario.id)
      .order('updated_at', { ascending: false })
      .limit(20);
    setConversations(data || []);
  };

  const loadConversation = async (convId: string) => {
    const { data } = await supabase
      .from('gia_messages')
      .select('id, role, content, metadata, created_at')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true });
    if (data) {
      const loaded: GIAMessage[] = data
        .filter(m => m.role !== 'system')
        .map(m => ({
          id: m.id,
          role: m.role as 'user' | 'assistant',
          content: m.content,
          cards: (m.metadata as Record<string, unknown>)?.cards as GIACardData[] | undefined,
          timestamp: new Date(m.created_at).getTime(),
        }));
      setMessages(loaded);
      setConversationId(convId);
    }
    setShowHistory(false);
  };

  const getGreetingText = useCallback(() => {
    if (!usuario) return 'Ola! Como posso ajudar?';
    const isChefe = usuario.email === 'marcoabdo@groupglobal.com.br' || usuario.tipo === 'master';
    const displayName = isChefe ? 'chefe' : (usuario.nome?.split(' ')[0] || 'usuario');
    return `Ola ${displayName}! Sou a GIA, sua assistente inteligente. Estou conectada ao sistema ATOM e pronta pra te ajudar. O que você precisa?`;
  }, [usuario]);

  const startNewConversation = () => {
    if (cancelStreamRef.current) {
      cancelStreamRef.current();
      cancelStreamRef.current = null;
    }
    setConversationId(null);
    setStreamingText('');

    const greetingText = getGreetingText();
    const greetingMessage: GIAMessage = {
      id: `greeting-${Date.now()}`,
      role: 'assistant',
      content: greetingText,
      timestamp: Date.now(),
    };
    setMessages([greetingMessage]);
    setAiState('speaking');
    speakGia(greetingText).finally(() => setAiState('idle'));
  };

  const deleteConversation = async (convId: string) => {
    await supabase.from('gia_conversations').delete().eq('id', convId);
    if (conversationId === convId) startNewConversation();
    loadConversations();
  };

  const sendMessageMock = useCallback((text: string) => {
    setIsProcessing(true);
    setTranscribedText(undefined);

    const userMessage: GIAMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMessage]);
    setAiState('thinking');

    setTimeout(() => {
      setAiState('speaking');
      let accumulated = '';
      const collectedCards: CardData[] = [];

      const cancel = createMockAIStream(
        (chunk) => {
          accumulated += chunk;
          setStreamingText(accumulated);
        },
        (card) => {
          collectedCards.push(card);
        },
        (fullText) => {
          setStreamingText('');
          const aiMessage: GIAMessage = {
            id: `ai-${Date.now()}`,
            role: 'assistant',
            content: fullText,
            cards: collectedCards as unknown as GIACardData[],
            timestamp: Date.now(),
          };
          setMessages(prev => [...prev, aiMessage]);
          setAiState('idle');
          setIsProcessing(false);
          cancelStreamRef.current = null;
        },
      );
      cancelStreamRef.current = cancel;
    }, 800);
  }, []);

  const sendMessageAPI = useCallback(async (text: string) => {
    if (!usuario) return;
    setIsProcessing(true);
    setTranscribedText(undefined);

    const userMessage: GIAMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMessage]);
    setAiState('thinking');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const history = messages.filter(m => !m.id.startsWith('greeting-')).slice(-10).map(m => ({ role: m.role, content: m.content }));
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gia-chat`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ message: text, conversationId, history }),
      });

      const result = await response.json();
      if (!response.ok) {
        const errMsg: GIAMessage = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: `Erro: ${result.error || 'desconhecido'}`,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, errMsg]);
        setAiState('idle');
        setIsProcessing(false);
        return;
      }

      if (result.conversationId && !conversationId) setConversationId(result.conversationId);

      setAiState('speaking');
      await streamResponse(result.content);

      const aiMessage: GIAMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: result.content,
        cards: result.cards,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, aiMessage]);

      if (currentMode !== 'voice') {
        setAiState('idle');
      }

      loadConversations();
    } catch (err) {
      const errMsg: GIAMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Erro de conexao: ${err instanceof Error ? err.message : 'Verifique sua internet.'}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errMsg]);
      setAiState('idle');
    } finally {
      setIsProcessing(false);
    }
  }, [usuario, messages, conversationId]);

  const streamResponse = useCallback((text: string): Promise<void> => {
    pendingContentRef.current = text;
    return new Promise((resolve) => {
      let i = 0;
      setStreamingText('');
      const interval = setInterval(() => {
        if (i < text.length) {
          const chunkSize = Math.floor(Math.random() * 4) + 2;
          const nextChunk = text.slice(i, i + chunkSize);
          setStreamingText(prev => prev + nextChunk);
          i += chunkSize;
        } else {
          clearInterval(interval);
          streamIntervalRef.current = null;
          setStreamingText('');
          pendingContentRef.current = '';
          resolve();
        }
      }, 22);
      streamIntervalRef.current = interval;
    });
  }, []);

  useEffect(() => {
    if (currentMode !== 'voice' || messages.length === 0) return;

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role === 'assistant' && !lastMessage.id.startsWith('greeting-')) {
      setIsSpeaking(true);
      setAiState('speaking');
      speakGia(lastMessage.content).then(() => {
        setIsSpeaking(false);
        setAiState('idle');
      }).catch(() => {
        setIsSpeaking(false);
        setAiState('idle');
      });
    }
  }, [messages, currentMode]);

  const sendMessage = useCallback((text: string) => {
    if (isProcessing) return;
    sendMessageAPI(text);
  }, [isProcessing, sendMessageAPI]);

  const toggleMicrophone = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }
    const SR = (window as unknown as Record<string, unknown>).SpeechRecognition ||
      (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SR) return;

    const recognition = new (SR as new () => SpeechRecognition)();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      if (transcript.trim()) {
        if (currentMode === 'voice') {
          sendMessage(transcript.trim());
        } else {
          setTranscribedText(transcript.trim());
        }
      }
      setIsListening(false);
    };
    recognition.onerror = () => setIsListening(false);
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setAiState('listening');
  }, [isListening, currentMode, sendMessage]);

  const handleStopSpeaking = useCallback(() => {
    stopGiaSpeaking();
    if (cancelStreamRef.current) {
      cancelStreamRef.current();
      cancelStreamRef.current = null;
    }
    if (streamIntervalRef.current) {
      clearInterval(streamIntervalRef.current);
      streamIntervalRef.current = null;
    }
    if (pendingContentRef.current) {
      const fullContent = pendingContentRef.current;
      pendingContentRef.current = '';
      setStreamingText('');
      const aiMessage: GIAMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: fullContent,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, aiMessage]);
    } else {
      setStreamingText('');
    }
    setIsSpeaking(false);
    setAiState('idle');
    setIsProcessing(false);
  }, []);

  const hasMessages = messages.length > 0 || isProcessing;

  return (
    <div className="h-screen flex flex-col -m-6 overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <GIAHeader
        aiState={aiState}
        connection={connection}
        showHistory={showHistory}
        onNewConversation={startNewConversation}
        onToggleHistory={() => { setShowHistory(!showHistory); if (!showHistory) loadConversations(); }}
        onCheckConnections={checkConnections}
      />

      <div className="flex-1 flex flex-col min-h-0 relative overflow-hidden">
        <AnimatePresence>
          {showHistory && (
            <HistoryPanel
              conversations={conversations}
              conversationId={conversationId}
              onLoad={loadConversation}
              onDelete={deleteConversation}
              onClose={() => setShowHistory(false)}
            />
          )}
        </AnimatePresence>

        {!hasMessages ? (
          <div className="flex-1 flex flex-col items-center justify-center relative">
            <div className="absolute inset-0 overflow-hidden">
              <GridBackground />
            </div>

            <div className="relative z-10 flex flex-col items-center">
              <GIACoreVisualizer state={aiState} mode={currentMode} />

              <motion.div
                className="text-center mt-2 px-8"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
              >
                <h2 className="text-xl font-bold mb-1.5" style={{ color: 'var(--text-primary)' }}>
                  {usuario?.nome?.split(' ')[0] || 'Usuario'}
                </h2>
                <p className="text-sm mb-6" style={{ color: 'var(--text-secondary)' }}>
                  Como posso ajudar voce hoje?
                </p>

                <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                  {[
                    'Como estao as OS hoje?',
                    'Analise o faturamento do mes',
                    'Quais pecas estao em falta?',
                    'Produtividade da equipe',
                  ].map((suggestion) => (
                    <motion.button
                      key={suggestion}
                      onClick={() => sendMessage(suggestion)}
                      className="px-4 py-2.5 rounded-xl text-xs font-medium"
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-primary)',
                        color: 'var(--text-secondary)',
                      }}
                      whileHover={{
                        background: 'rgba(168,85,247,0.08)',
                        borderColor: 'rgba(168,85,247,0.25)',
                        color: '#A855F7',
                        scale: 1.02,
                      }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {suggestion}
                    </motion.button>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-shrink-0">
              <GIACoreVisualizer state={aiState} mode={currentMode} compact />
            </div>
            <div className="flex-1 min-h-0">
              <GIAConversation
                messages={messages}
                streamingText={streamingText}
                isThinking={aiState === 'thinking'}
                userName={usuario?.nome?.split(' ')[0] || 'Voce'}
              />
            </div>
          </>
        )}

        <GIAInputController
          mode={currentMode}
          onModeChange={setCurrentMode}
          onSend={sendMessage}
          disabled={isProcessing}
          isListening={isListening}
          onMicToggle={toggleMicrophone}
          isSpeaking={isSpeaking || (aiState === 'speaking' && !!streamingText)}
          onStopSpeaking={handleStopSpeaking}
          transcribedText={transcribedText}
        />

      </div>
    </div>
  );
}

function GridBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden opacity-[0.03]">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(168,85,247,0.3) 1px, transparent 1px),
            linear-gradient(90deg, rgba(168,85,247,0.3) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'linear-gradient(180deg, transparent 0%, rgba(168,85,247,0.08) 50%, transparent 100%)',
          height: '200%',
        }}
        animate={{ y: ['-50%', '0%'] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
      />
    </div>
  );
}

interface GIAHeaderProps {
  aiState: string;
  connection: ConnectionState;
  showHistory: boolean;
  onNewConversation: () => void;
  onToggleHistory: () => void;
  onCheckConnections: () => void;
}

function GIAHeader({
  aiState,
  connection,
  onNewConversation,
  onToggleHistory,
  onCheckConnections,
}: GIAHeaderProps) {
  return (
    <header
      className="flex-shrink-0 flex items-center justify-between px-5 py-2.5 z-10"
      style={{
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border-primary)',
        backdropFilter: 'blur(20px)',
      }}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <div
            className="w-8 h-8 rounded-xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(192,132,252,0.06))',
              border: '1px solid rgba(168,85,247,0.2)',
              boxShadow: '0 0 15px rgba(168,85,247,0.15)',
            }}
          >
            <Sparkles className="w-3.5 h-3.5" style={{ color: '#A855F7' }} />
          </div>
          <div
            className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full"
            style={{
              background: '#A855F7',
              boxShadow: '0 0 6px #A855F7',
            }}
          />
        </div>
        <div>
          <h1 className="text-sm font-bold tracking-wide" style={{ color: 'var(--text-primary)' }}>GIA</h1>
          <p className="text-[8px] tracking-[0.2em] uppercase font-medium" style={{ color: 'var(--text-secondary)' }}>
            Global Intelligence Assistant
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <button
          onClick={onNewConversation}
          className="p-2 rounded-lg transition-colors hover:bg-white/5"
          title="Nova conversa"
        >
          <Plus className="w-3.5 h-3.5" style={{ color: '#4a5568' }} />
        </button>

        <button
          onClick={onToggleHistory}
          className="p-2 rounded-lg transition-colors hover:bg-white/5"
          title="Histórico"
        >
          <History className="w-3.5 h-3.5" style={{ color: '#4a5568' }} />
        </button>

        <div
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ml-1 cursor-pointer group relative"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
          onClick={onCheckConnections}
          title="Verificar conexão"
        >
          {connection.status === 'checking' ? (
            <>
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#f59e0b' }} />
              <span className="text-[9px] tracking-widest uppercase font-medium" style={{ color: '#f59e0b' }}>
                ...
              </span>
            </>
          ) : connection.status === 'partial' ? (
            <>
              <WifiOff className="w-3 h-3" style={{ color: '#ef4444' }} />
              <span className="text-[9px] tracking-widest uppercase" style={{ color: '#ef4444' }}>ERRO</span>
            </>
          ) : aiState === 'thinking' ? (
            <>
              <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#A855F7' }} />
              <span className="text-[9px] tracking-widest uppercase" style={{ color: '#A855F7' }}>
                PROC
              </span>
            </>
          ) : (
            <>
              <Wifi className="w-3 h-3" style={{ color: '#10b981' }} />
              <span className="text-[9px] tracking-widest uppercase" style={{ color: '#10b981' }}>BANCO OK</span>
            </>
          )}

          {(connection.status === 'error' || connection.status === 'partial') && connection.error && (
            <div
              className="absolute top-full right-0 mt-2 p-3 rounded-lg shadow-xl z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-64"
              style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}
            >
              <div className="flex items-start gap-2">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                <div>
                  <p className="text-[10px] font-medium text-red-400 mb-1">Erro de Conexao</p>
                  <p className="text-[9px]" style={{ color: '#64748b' }}>{connection.error}</p>
                  <p className="text-[9px] mt-2" style={{ color: '#64748b' }}>
                    Clique no botao de raio para ativar o modo REAL
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

interface HistoryPanelProps {
  conversations: { id: string; titulo: string; updated_at: string }[];
  conversationId: string | null;
  onLoad: (id: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

function HistoryPanel({ conversations, conversationId, onLoad, onDelete, onClose }: HistoryPanelProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-40 flex"
    >
      <motion.div
        initial={{ x: -300 }}
        animate={{ x: 0 }}
        exit={{ x: -300 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="w-72 h-full flex flex-col"
        style={{
          background: 'var(--bg-secondary)',
          borderRight: '1px solid var(--border-primary)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <span className="text-[10px] font-semibold tracking-[0.15em] uppercase" style={{ color: '#4a5568' }}>
            Historico
          </span>
          <button onClick={onClose} className="p-1 rounded hover:bg-white/5">
            <X className="w-3.5 h-3.5" style={{ color: '#4a5568' }} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.06) transparent' }}>
          {conversations.length === 0 && (
            <p className="text-center text-[11px] py-8" style={{ color: '#2d3748' }}>Nenhuma conversa</p>
          )}
          {conversations.map(conv => (
            <div
              key={conv.id}
              className="flex items-center gap-2 px-4 py-3 cursor-pointer transition-colors hover:bg-white/[0.02] group"
              style={{
                borderBottom: '1px solid rgba(255,255,255,0.02)',
                background: conversationId === conv.id ? 'rgba(168,85,247,0.06)' : 'transparent',
              }}
              onClick={() => onLoad(conv.id)}
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate" style={{ color: '#94a3b8' }}>
                  {conv.titulo || 'Conversa sem titulo'}
                </p>
                <p className="text-[10px] mt-0.5" style={{ color: '#2d3748' }}>
                  {new Date(conv.updated_at).toLocaleDateString('pt-BR', {
                    day: '2-digit',
                    month: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
                className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20"
              >
                <Trash2 className="w-3 h-3 text-gray-700 hover:text-red-400" />
              </button>
            </div>
          ))}
        </div>
      </motion.div>
      <div className="flex-1" onClick={onClose} />
    </motion.div>
  );
}
