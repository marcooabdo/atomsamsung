import { useState, useCallback, useRef, useEffect } from 'react';
import { AudioVisualizer } from '../components/gia/AudioVisualizer';
import { ConversationPanel } from '../components/gia/ConversationPanel';
import { ReactiveCards } from '../components/gia/ReactiveCards';
import { GIA_SCRIPT, type CardData } from '../components/gia/giaScript';
import { Sparkles } from 'lucide-react';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  text: string;
}

export function GIA() {
  const [aiState, setAiState] = useState<'idle' | 'listening' | 'thinking' | 'speaking'>('idle');
  const [messages, setMessages] = useState<Message[]>([]);
  const [streamingText, setStreamingText] = useState('');
  const [activeCards, setActiveCards] = useState<CardData[]>([]);
  const [scriptIndex, setScriptIndex] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const abortRef = useRef(false);
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimeouts = () => {
    timeoutsRef.current.forEach(clearTimeout);
    timeoutsRef.current = [];
  };

  useEffect(() => {
    return () => clearTimeouts();
  }, []);

  const streamText = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      let i = 0;
      setStreamingText('');
      const interval = setInterval(() => {
        if (abortRef.current) {
          clearInterval(interval);
          setStreamingText('');
          resolve();
          return;
        }
        if (i < text.length) {
          const chunkSize = Math.floor(Math.random() * 3) + 1;
          const nextChunk = text.slice(i, i + chunkSize);
          setStreamingText((prev) => prev + nextChunk);
          i += chunkSize;
        } else {
          clearInterval(interval);
          setStreamingText('');
          resolve();
        }
      }, 35);
    });
  }, []);

  const scheduleCards = useCallback((cards: CardData[]) => {
    cards.forEach((card) => {
      const t = setTimeout(() => {
        if (!abortRef.current) {
          setActiveCards((prev) => {
            if (prev.find((c) => c.id === card.id)) return prev;
            return [...prev, card];
          });
        }
      }, card.delay || 0);
      timeoutsRef.current.push(t);
    });
  }, []);

  const runStep = useCallback(async (index: number) => {
    if (index >= GIA_SCRIPT.length || abortRef.current) {
      setIsRunning(false);
      setAiState('idle');
      return;
    }

    const step = GIA_SCRIPT[index];

    if (index > 0) {
      setMessages((prev) => [
        ...prev,
        {
          id: `user-${index}`,
          role: 'user',
          text: getSimulatedUserPrompt(index),
        },
      ]);
      setAiState('listening');
      await sleep(1200);
    }

    if (abortRef.current) return;

    setAiState('thinking');
    await sleep(step.thinkingDuration);
    if (abortRef.current) return;

    setAiState('speaking');
    scheduleCards(step.cards);
    await streamText(step.aiText);
    if (abortRef.current) return;

    setMessages((prev) => [
      ...prev,
      {
        id: `ai-${index}`,
        role: 'assistant',
        text: step.aiText,
      },
    ]);

    setAiState('idle');
    setScriptIndex(index + 1);

    const nextT = setTimeout(() => {
      if (!abortRef.current && index + 1 < GIA_SCRIPT.length) {
        runStep(index + 1);
      } else {
        setIsRunning(false);
      }
    }, 2500);
    timeoutsRef.current.push(nextT);
  }, [streamText, scheduleCards]);

  const handleMicToggle = useCallback(() => {
    if (isRunning) return;
    abortRef.current = false;
    setIsRunning(true);
    setScriptIndex(0);
    setActiveCards([]);
    setMessages([]);
    setStreamingText('');
    runStep(0);
  }, [isRunning, runStep]);

  const handleSkip = useCallback(() => {
    if (!isRunning) return;
    abortRef.current = true;
    clearTimeouts();
    setStreamingText('');

    const currentStep = GIA_SCRIPT[scriptIndex] || GIA_SCRIPT[scriptIndex - 1];
    if (currentStep) {
      setMessages((prev) => {
        if (prev.find((m) => m.id === `ai-${scriptIndex}`)) return prev;
        return [
          ...prev,
          { id: `ai-${scriptIndex}`, role: 'assistant', text: currentStep.aiText },
        ];
      });
      currentStep.cards.forEach((card) => {
        setActiveCards((prev) => {
          if (prev.find((c) => c.id === card.id)) return prev;
          return [...prev, card];
        });
      });
    }

    const nextIdx = scriptIndex + 1;
    if (nextIdx < GIA_SCRIPT.length) {
      setScriptIndex(nextIdx);
      abortRef.current = false;
      const t = setTimeout(() => runStep(nextIdx), 500);
      timeoutsRef.current.push(t);
    } else {
      setIsRunning(false);
      setAiState('idle');
    }
  }, [isRunning, scriptIndex, runStep]);

  const handleReset = useCallback(() => {
    abortRef.current = true;
    clearTimeouts();
    setAiState('idle');
    setMessages([]);
    setStreamingText('');
    setActiveCards([]);
    setScriptIndex(0);
    setIsRunning(false);
    setTimeout(() => { abortRef.current = false; }, 100);
  }, []);

  return (
    <div className="h-[calc(100vh-48px)] flex flex-col -m-6">
      <header className="flex-shrink-0 flex items-center justify-between px-8 py-4 border-b"
        style={{ borderColor: 'rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.2)' }}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: 'linear-gradient(135deg, rgba(0, 210, 255, 0.15), rgba(0, 255, 200, 0.08))',
                border: '1px solid rgba(0, 210, 255, 0.25)',
                boxShadow: '0 0 20px rgba(0, 210, 255, 0.15)',
              }}>
              <Sparkles className="w-5 h-5" style={{ color: '#00d2ff' }} />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
              style={{
                background: isRunning ? '#00d2ff' : '#374151',
                boxShadow: isRunning ? '0 0 6px #00d2ff' : 'none',
              }} />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-wide" style={{ color: '#e2e8f0' }}>
              GIA
            </h1>
            <p className="text-[10px] tracking-widest uppercase font-medium" style={{ color: '#475569' }}>
              Group Intelligence Assistant
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="w-1.5 h-1.5 rounded-full" style={{
              background: isRunning ? '#10b981' : '#374151',
              boxShadow: isRunning ? '0 0 4px #10b981' : 'none',
            }} />
            <span className="text-[10px] uppercase tracking-widest font-medium" style={{ color: '#64748b' }}>
              {isRunning ? 'Ativo' : 'Standby'}
            </span>
          </div>
          <span className="text-[10px] tabular-nums" style={{ color: '#374151' }}>
            v2.0
          </span>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-shrink-0 flex items-center justify-center py-8"
            style={{ background: 'radial-gradient(ellipse at center, rgba(0, 210, 255, 0.03) 0%, transparent 70%)' }}>
            <AudioVisualizer state={aiState} />
          </div>

          <div className="flex-1 min-h-0 border-t" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
            <ConversationPanel
              messages={messages}
              aiState={aiState}
              streamingText={streamingText}
              onMicToggle={handleMicToggle}
              onSkip={handleSkip}
              onReset={handleReset}
              isRunning={isRunning}
            />
          </div>
        </div>

        <div className="w-[380px] flex-shrink-0 border-l"
          style={{
            borderColor: 'rgba(255,255,255,0.06)',
            background: 'rgba(0,0,0,0.15)',
          }}>
          <div className="h-12 flex items-center px-4 border-b"
            style={{ borderColor: 'rgba(255,255,255,0.06)' }}>
            <span className="text-[10px] uppercase tracking-widest font-semibold" style={{ color: '#475569' }}>
              Dados em Tempo Real
            </span>
            {activeCards.length > 0 && (
              <span className="ml-auto text-[10px] tabular-nums px-2 py-0.5 rounded-full"
                style={{ background: 'rgba(0, 210, 255, 0.1)', color: '#00d2ff', border: '1px solid rgba(0, 210, 255, 0.2)' }}>
                {activeCards.length}
              </span>
            )}
          </div>
          <div className="h-[calc(100%-48px)]">
            <ReactiveCards cards={activeCards} />
          </div>
        </div>
      </div>
    </div>
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getSimulatedUserPrompt(index: number): string {
  const prompts = [
    '',
    'GIA, como estao as pendencias hoje?',
    'E o faturamento? Batemos a meta?',
    'Qual a situacao do estoque de pecas?',
    'Como esta a produtividade da equipe?',
  ];
  return prompts[index] || 'Continue a analise...';
}
