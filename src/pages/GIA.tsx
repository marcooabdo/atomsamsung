import { useState, useCallback, useRef, useEffect } from 'react';
import { JarvisParticles } from '../components/gia/JarvisParticles';
import { GIAConversation, type GIAMessage, type GIACardData } from '../components/gia/GIAConversation';
import { GIAInputBar } from '../components/gia/GIAInputBar';
import { ReactiveCards } from '../components/gia/ReactiveCards';
import type { CardData } from '../components/gia/giaScript';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { speakGia, checkElevenLabsConnection, stopGiaSpeaking, isGiaSpeaking } from '../lib/elevenLabsTTS';
import { Sparkles, History, Plus, Trash2, X, AlertCircle, Wifi, WifiOff } from 'lucide-react';

type ConnectionStatus = 'checking' | 'connected' | 'partial' | 'error';

interface ConnectionState {
  status: ConnectionStatus;
  chatgpt: boolean;
  elevenlabs: boolean;
  error?: string;
}

export function GIA() {
  const { usuario } = useAuth();
  const [aiState, setAiState] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [messages, setMessages] = useState<GIAMessage[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [activeCards, setActiveCards] = useState<CardData[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [conversations, setConversations] = useState<{ id: string; titulo: string; updated_at: string }[]>([]);
  const [connection, setConnection] = useState<ConnectionState>({ status: 'checking', chatgpt: false, elevenlabs: false });
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(false);
  const [transcribedText, setTranscribedText] = useState<string | undefined>(undefined);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const greetedRef = useRef(false);

  useEffect(() => {
    checkConnections();
  }, []);

  useEffect(() => {
    if (usuario?.id) {
      loadConversations();
    }
  }, [usuario?.id]);

  useEffect(() => {
    if (usuario?.tipo === 'master' && messages.length === 0 && !conversationId && connection.elevenlabs && voiceEnabled && !greetedRef.current) {
      greetedRef.current = true;
      const timer = setTimeout(async () => {
        setIsSpeaking(true);
        await speakGia('Ola, chefe! Em que posso te ajudar?');
        setIsSpeaking(false);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [usuario?.tipo, messages.length, conversationId, connection.elevenlabs, voiceEnabled]);

  useEffect(() => {
    const interval = setInterval(() => {
      setIsSpeaking(isGiaSpeaking());
    }, 500);
    return () => clearInterval(interval);
  }, []);

  const checkConnections = async () => {
    setConnection({ status: 'checking', chatgpt: false, elevenlabs: false });

    let chatgptOk = false;
    let elevenlabsOk = false;
    let errorMsg = '';

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gia-chat`;
        const testResponse = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
            'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          },
          body: JSON.stringify({ message: 'ping', conversationId: null, history: [] }),
        });

        if (testResponse.ok) {
          chatgptOk = true;
        } else {
          const errData = await testResponse.json().catch(() => ({}));
          if (errData.error === 'OPENAI_API_KEY not configured') {
            errorMsg = 'Chave OpenAI nao configurada';
          } else if (testResponse.status === 401) {
            errorMsg = errData.details || 'Sessao expirada - faca login novamente';
          } else if (testResponse.status === 502 && errData.details) {
            if (errData.details.includes('401') || errData.details.includes('Incorrect API key')) {
              errorMsg = 'Chave OpenAI invalida ou expirada';
            } else {
              errorMsg = 'Erro na API OpenAI';
            }
          } else {
            errorMsg = errData.error || `Erro ${testResponse.status}`;
          }
        }
      } else {
        errorMsg = 'Usuario nao autenticado';
      }
    } catch (err) {
      errorMsg = 'Falha ao conectar com o servidor';
    }

    const elevenResult = await checkElevenLabsConnection();
    elevenlabsOk = elevenResult.ok;
    if (!elevenlabsOk && !errorMsg) {
      errorMsg = elevenResult.error || 'Erro ElevenLabs';
    }

    if (chatgptOk && elevenlabsOk) {
      setConnection({ status: 'connected', chatgpt: true, elevenlabs: true });
    } else if (chatgptOk || elevenlabsOk) {
      setConnection({ status: 'partial', chatgpt: chatgptOk, elevenlabs: elevenlabsOk, error: errorMsg });
    } else {
      setConnection({ status: 'error', chatgpt: false, elevenlabs: false, error: errorMsg });
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

      const allCards: CardData[] = [];
      for (const msg of loaded) {
        if (msg.cards) {
          for (const c of msg.cards) {
            allCards.push(c as unknown as CardData);
          }
        }
      }
      setActiveCards(allCards);
    }
    setShowHistory(false);
  };

  const startNewConversation = () => {
    setMessages([]);
    setConversationId(null);
    setActiveCards([]);
    setStreamingText('');
    setAiState('idle');
  };

  const deleteConversation = async (convId: string) => {
    await supabase.from('gia_conversations').delete().eq('id', convId);
    if (conversationId === convId) {
      startNewConversation();
    }
    loadConversations();
  };

  const streamResponse = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      let i = 0;
      setStreamingText('');
      const interval = setInterval(() => {
        if (i < text.length) {
          const chunkSize = Math.floor(Math.random() * 4) + 2;
          const nextChunk = text.slice(i, i + chunkSize);
          setStreamingText((prev) => prev + nextChunk);
          i += chunkSize;
        } else {
          clearInterval(interval);
          setStreamingText('');
          resolve();
        }
      }, 25);
    });
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (isProcessing || !usuario) return;

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

      const history = messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content,
      }));

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gia-chat`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          message: text,
          conversationId,
          history,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        let errorContent = '';
        if (result.error === 'OPENAI_API_KEY not configured') {
          errorContent = 'A chave da API OpenAI ainda nao foi configurada. Peca ao administrador para adicionar a OPENAI_API_KEY na tabela system_secrets do Supabase.';
        } else {
          errorContent = `Desculpe, ocorreu um erro: ${result.error || 'desconhecido'}`;
          if (result.details) errorContent += `\n\nDetalhes: ${typeof result.details === 'string' ? result.details : JSON.stringify(result.details)}`;
        }
        const errMsg: GIAMessage = {
          id: `err-${Date.now()}`,
          role: 'assistant',
          content: errorContent,
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, errMsg]);
        setAiState('idle');
        setIsProcessing(false);
        return;
      }

      if (result.conversationId && !conversationId) {
        setConversationId(result.conversationId);
      }

      if (result.cards && result.cards.length > 0) {
        const newCards = result.cards.map((c: Record<string, unknown>, i: number) => ({
          ...c,
          delay: i * 300,
        }));
        newCards.forEach((card: CardData, i: number) => {
          setTimeout(() => {
            setActiveCards(prev => {
              if (prev.find(c => c.id === card.id)) return prev;
              return [...prev, card];
            });
          }, i * 300);
        });
      }

      setAiState('speaking');
      await streamResponse(result.content);

      if (voiceEnabled) {
        setIsSpeaking(true);
        speakGia(result.content).finally(() => setIsSpeaking(false));
      }

      const aiMessage: GIAMessage = {
        id: `ai-${Date.now()}`,
        role: 'assistant',
        content: result.content,
        cards: result.cards,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, aiMessage]);
      setAiState('idle');
      loadConversations();
    } catch (err) {
      const errMsg: GIAMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Erro de conexao: ${err instanceof Error ? err.message : 'Verifique sua internet e tente novamente.'}`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errMsg]);
      setAiState('idle');
    } finally {
      setIsProcessing(false);
    }
  }, [isProcessing, usuario, messages, conversationId, streamResponse, voiceEnabled]);

  const toggleMicrophone = useCallback(() => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const SpeechRecognition = (window as unknown as Record<string, unknown>).SpeechRecognition || (window as unknown as Record<string, unknown>).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new (SpeechRecognition as new () => SpeechRecognition)();
    recognition.lang = 'pt-BR';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      const transcript = event.results[0][0].transcript;
      if (transcript.trim()) {
        if (voiceEnabled) {
          sendMessage(transcript.trim());
        } else {
          setTranscribedText(transcript.trim());
        }
      }
      setIsListening(false);
    };

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setAiState('listening');
  }, [isListening, sendMessage, voiceEnabled]);

  const toggleVoice = useCallback(() => {
    setVoiceEnabled(prev => !prev);
    if (isSpeaking) {
      stopGiaSpeaking();
      setIsSpeaking(false);
    }
  }, [isSpeaking]);

  const handleStopSpeaking = useCallback(() => {
    stopGiaSpeaking();
    setIsSpeaking(false);
  }, []);

  const isActive = connection.status === 'connected' || connection.status === 'partial';

  return (
    <div className="h-[calc(100vh-48px)] flex flex-col -m-6 overflow-hidden" style={{ background: '#060a10' }}>
      <header className="flex-shrink-0 flex items-center justify-between px-6 py-3 z-10"
        style={{ background: 'rgba(6,10,16,0.8)', borderBottom: '1px solid rgba(255,255,255,0.04)', backdropFilter: 'blur(20px)' }}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(0,210,255,0.15), rgba(0,255,200,0.08))',
                border: '1px solid rgba(0,210,255,0.25)',
                boxShadow: isActive ? '0 0 20px rgba(0,210,255,0.15)' : 'none',
              }}>
              <Sparkles className="w-4 h-4" style={{ color: '#00d2ff' }} />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full"
              style={{
                background: isActive ? '#00d2ff' : '#374151',
                boxShadow: isActive ? '0 0 6px #00d2ff' : 'none',
              }} />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-wide" style={{ color: '#e2e8f0' }}>GIA</h1>
            <p className="text-[9px] tracking-widest uppercase font-medium" style={{ color: '#475569' }}>
              Global Intelligence Assistant
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={startNewConversation}
            className="p-2 rounded-lg transition-colors hover:bg-white/5"
            title="Nova conversa"
          >
            <Plus className="w-4 h-4" style={{ color: '#64748b' }} />
          </button>
          <button
            onClick={() => { setShowHistory(!showHistory); if (!showHistory) loadConversations(); }}
            className="p-2 rounded-lg transition-colors hover:bg-white/5"
            title="Historico"
          >
            <History className="w-4 h-4" style={{ color: '#64748b' }} />
          </button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg ml-2 cursor-pointer group relative"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}
            onClick={checkConnections}
            title="Clique para verificar conexao"
          >
            {connection.status === 'checking' ? (
              <>
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#f59e0b' }} />
                <span className="text-[10px] uppercase tracking-widest font-medium" style={{ color: '#f59e0b' }}>
                  Verificando...
                </span>
              </>
            ) : connection.status === 'error' ? (
              <>
                <WifiOff className="w-3 h-3" style={{ color: '#ef4444' }} />
                <span className="text-[10px] uppercase tracking-widest font-medium" style={{ color: '#ef4444' }}>
                  Desconectado
                </span>
              </>
            ) : connection.status === 'partial' ? (
              <>
                <AlertCircle className="w-3 h-3" style={{ color: '#f59e0b' }} />
                <span className="text-[10px] uppercase tracking-widest font-medium" style={{ color: '#f59e0b' }}>
                  Parcial
                </span>
              </>
            ) : aiState === 'thinking' ? (
              <>
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#00d2ff' }} />
                <span className="text-[10px] uppercase tracking-widest font-medium" style={{ color: '#00d2ff' }}>
                  Analisando
                </span>
              </>
            ) : aiState === 'speaking' ? (
              <>
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#10b981' }} />
                <span className="text-[10px] uppercase tracking-widest font-medium" style={{ color: '#10b981' }}>
                  Respondendo
                </span>
              </>
            ) : aiState === 'listening' ? (
              <>
                <div className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: '#8b5cf6' }} />
                <span className="text-[10px] uppercase tracking-widest font-medium" style={{ color: '#8b5cf6' }}>
                  Ouvindo
                </span>
              </>
            ) : (
              <>
                <Wifi className="w-3 h-3" style={{ color: '#10b981' }} />
                <span className="text-[10px] uppercase tracking-widest font-medium" style={{ color: '#10b981' }}>
                  Conectado
                </span>
              </>
            )}

            {(connection.status === 'error' || connection.status === 'partial') && connection.error && (
              <div className="absolute top-full right-0 mt-2 p-3 rounded-lg shadow-xl z-50 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none w-64"
                style={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)' }}>
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                  <div>
                    <p className="text-xs font-medium text-red-400 mb-1">Erro de Conexao</p>
                    <p className="text-[10px]" style={{ color: '#94a3b8' }}>{connection.error}</p>
                    <div className="flex gap-3 mt-2 text-[9px]">
                      <span style={{ color: connection.chatgpt ? '#10b981' : '#ef4444' }}>
                        ChatGPT: {connection.chatgpt ? 'OK' : 'ERRO'}
                      </span>
                      <span style={{ color: connection.elevenlabs ? '#10b981' : '#ef4444' }}>
                        Voz: {connection.elevenlabs ? 'OK' : 'ERRO'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex-1 flex min-h-0 relative">
        {showHistory && (
          <div className="absolute inset-0 z-20 flex">
            <div className="w-80 h-full flex flex-col"
              style={{ background: 'rgba(6,10,16,0.98)', borderRight: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
                <span className="text-xs font-semibold tracking-wide uppercase" style={{ color: '#64748b' }}>
                  Conversas anteriores
                </span>
                <button onClick={() => setShowHistory(false)} className="p-1 rounded hover:bg-white/5">
                  <X className="w-4 h-4" style={{ color: '#64748b' }} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {conversations.length === 0 && (
                  <p className="text-center text-xs py-8" style={{ color: '#374151' }}>Nenhuma conversa ainda</p>
                )}
                {conversations.map(conv => (
                  <div
                    key={conv.id}
                    className="flex items-center gap-2 px-4 py-3 cursor-pointer transition-colors hover:bg-white/3 group"
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.03)',
                      background: conversationId === conv.id ? 'rgba(0,210,255,0.05)' : 'transparent',
                    }}
                    onClick={() => loadConversation(conv.id)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate" style={{ color: '#c8d6e5' }}>
                        {conv.titulo || 'Conversa sem titulo'}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: '#374151' }}>
                        {new Date(conv.updated_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); deleteConversation(conv.id); }}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500/20"
                    >
                      <Trash2 className="w-3 h-3 text-gray-600 hover:text-red-400" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex-1" onClick={() => setShowHistory(false)} />
          </div>
        )}

        <div className="flex-1 flex flex-col min-w-0 relative">
          {messages.length === 0 && !isProcessing ? (
            <div className="flex-1 flex flex-col items-center justify-center relative">
              <div className="absolute inset-0">
                <JarvisParticles state={aiState} />
              </div>

              <div className="relative z-10 text-center px-8">
                <div className="mb-6">
                  <div className="w-16 h-16 mx-auto rounded-2xl flex items-center justify-center mb-4"
                    style={{
                      background: 'linear-gradient(135deg, rgba(0,210,255,0.12), rgba(0,255,200,0.06))',
                      border: '1px solid rgba(0,210,255,0.2)',
                      boxShadow: '0 0 40px rgba(0,210,255,0.1)',
                    }}>
                    <Sparkles className="w-7 h-7" style={{ color: '#00d2ff' }} />
                  </div>
                  <h2 className="text-xl font-bold mb-1" style={{ color: '#e2e8f0' }}>
                    Ola, {usuario?.nome?.split(' ')[0] || 'Usuario'}
                  </h2>
                  <p className="text-sm" style={{ color: '#475569' }}>
                    Como posso ajudar voce hoje?
                  </p>
                </div>

                <div className="flex flex-wrap gap-2 justify-center max-w-lg">
                  {[
                    'Como estao as OS hoje?',
                    'Analise o faturamento do mes',
                    'Quais pecas estao em falta?',
                    'Produtividade da equipe',
                  ].map((suggestion) => (
                    <button
                      key={suggestion}
                      onClick={() => sendMessage(suggestion)}
                      className="px-4 py-2 rounded-xl text-xs font-medium transition-all hover:scale-[1.02]"
                      style={{
                        background: 'rgba(255,255,255,0.04)',
                        border: '1px solid rgba(255,255,255,0.08)',
                        color: '#94a3b8',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = 'rgba(0,210,255,0.08)';
                        e.currentTarget.style.borderColor = 'rgba(0,210,255,0.2)';
                        e.currentTarget.style.color = '#00d2ff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)';
                        e.currentTarget.style.color = '#94a3b8';
                      }}
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col min-h-0">
              <GIAConversation
                messages={messages}
                streamingText={streamingText}
                isThinking={aiState === 'thinking'}
                userName={usuario?.nome?.split(' ')[0] || 'Voce'}
              />
            </div>
          )}

          <div className="relative z-10">
            <GIAInputBar
              onSend={sendMessage}
              disabled={isProcessing}
              isListening={isListening}
              onMicToggle={toggleMicrophone}
              voiceEnabled={voiceEnabled}
              onVoiceToggle={toggleVoice}
              isSpeaking={isSpeaking}
              onStopSpeaking={handleStopSpeaking}
              transcribedText={transcribedText}
            />
          </div>
        </div>

        {activeCards.length > 0 && (
          <div className="w-[360px] flex-shrink-0 border-l hidden lg:block"
            style={{ borderColor: 'rgba(255,255,255,0.04)', background: 'rgba(0,0,0,0.2)' }}>
            <div className="h-11 flex items-center px-4 border-b"
              style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
              <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#475569' }}>
                Dados em Tempo Real
              </span>
              <span className="ml-auto text-[10px] tabular-nums px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(0,210,255,0.1)', color: '#00d2ff', border: '1px solid rgba(0,210,255,0.15)' }}>
                {activeCards.length}
              </span>
            </div>
            <div className="h-[calc(100%-44px)]">
              <ReactiveCards cards={activeCards} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
