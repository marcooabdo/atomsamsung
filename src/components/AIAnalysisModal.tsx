import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import {
  X,
  Brain,
  Loader2,
  Sparkles,
  Clock,
  ChevronDown,
  ChevronUp,
  Trash2,
  RefreshCw
} from 'lucide-react';

interface AIAnalysisModalProps {
  isOpen: boolean;
  onClose: () => void;
  unidadeId?: string;
  periodoInicio: string;
  periodoFim: string;
}

interface Analise {
  id: string;
  tipo: string;
  periodo_inicio: string;
  periodo_fim: string;
  resultado: string;
  modelo: string;
  tokens_utilizados: number;
  created_at: string;
}

export function AIAnalysisModal({ isOpen, onClose, unidadeId, periodoInicio, periodoFim }: AIAnalysisModalProps) {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(false);
  const [currentAnalysis, setCurrentAnalysis] = useState<Analise | null>(null);
  const [previousAnalyses, setPreviousAnalyses] = useState<Analise[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadPreviousAnalyses();
    }
  }, [isOpen]);

  const loadPreviousAnalyses = async () => {
    const { data } = await supabase
      .from('analises_ia')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);
    setPreviousAnalyses(data || []);
  };

  const runAnalysis = async () => {
    setLoading(true);
    setError('');
    setCurrentAnalysis(null);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setError('Sessao expirada. Faca login novamente.');
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-analysis`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          unidadeId: unidadeId || null,
          tipo: 'dashboard_geral',
          periodoInicio,
          periodoFim,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || 'Erro ao gerar analise');
        return;
      }

      setCurrentAnalysis(result.analise);
      loadPreviousAnalyses();
    } catch (err) {
      setError('Erro de conexao. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const deleteAnalysis = async (id: string) => {
    await supabase.from('analises_ia').delete().eq('id', id);
    if (currentAnalysis?.id === id) setCurrentAnalysis(null);
    loadPreviousAnalyses();
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderMarkdown = (text: string) => {
    return text
      .replace(/\*\*(.*?)\*\*/g, '<strong class="text-cyan-300">$1</strong>')
      .replace(/^### (.*$)/gm, '<h3 class="text-base font-bold text-white mt-4 mb-2">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="text-lg font-bold text-white mt-5 mb-2">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="text-xl font-bold text-white mt-6 mb-3">$1</h1>')
      .replace(/^- (.*$)/gm, '<li class="ml-4 text-gray-300 mb-1">$1</li>')
      .replace(/^(\d+)\. (.*$)/gm, '<li class="ml-4 text-gray-300 mb-1"><span class="text-cyan-400 font-bold">$1.</span> $2</li>')
      .replace(/\n\n/g, '<br/><br/>')
      .replace(/\n/g, '<br/>');
  };

  if (!isOpen) return null;

  const isMaster = usuario?.tipo === 'master' || usuario?.tipo === 'diretoria';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}>
      <div className="w-full max-w-3xl max-h-[85vh] flex flex-col rounded-2xl overflow-hidden" style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        border: '1px solid rgba(6,182,212,0.3)',
        boxShadow: '0 0 40px rgba(6,182,212,0.15)'
      }}>
        <div className="flex items-center justify-between p-5 border-b border-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl" style={{
              background: 'linear-gradient(135deg, rgba(6,182,212,0.2), rgba(59,130,246,0.2))',
              border: '1px solid rgba(6,182,212,0.3)'
            }}>
              <Brain className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Análise Inteligente</h2>
              <p className="text-xs text-gray-400">Powered by GPT-4o Mini</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-700/50 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{
            background: 'rgba(6,182,212,0.05)',
            border: '1px solid rgba(6,182,212,0.15)'
          }}>
            <Clock className="w-4 h-4 text-cyan-400 shrink-0" />
            <span className="text-sm text-gray-300">
              Periodo: <span className="text-white font-medium">{new Date(periodoInicio).toLocaleDateString('pt-BR')} - {new Date(periodoFim).toLocaleDateString('pt-BR')}</span>
            </span>
          </div>

          {!currentAnalysis && !loading && (
            <div className="text-center py-8">
              <div className="inline-flex p-4 rounded-2xl mb-4" style={{
                background: 'linear-gradient(135deg, rgba(6,182,212,0.1), rgba(59,130,246,0.1))',
                border: '1px solid rgba(6,182,212,0.2)'
              }}>
                <Sparkles className="w-10 h-10 text-cyan-400" />
              </div>
              <p className="text-gray-300 mb-1 text-sm">Clique no botão abaixo para gerar uma análise completa</p>
              <p className="text-gray-500 text-xs">dos dados operacionais do periodo selecionado</p>
            </div>
          )}

          {loading && (
            <div className="text-center py-12">
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-xl" style={{
                background: 'rgba(6,182,212,0.1)',
                border: '1px solid rgba(6,182,212,0.2)'
              }}>
                <Loader2 className="w-5 h-5 text-cyan-400 animate-spin" />
                <span className="text-cyan-300 text-sm font-medium">Analisando dados com IA...</span>
              </div>
              <p className="text-gray-500 text-xs mt-3">Isso pode levar alguns segundos</p>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-xl" style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          {currentAnalysis && (
            <div className="rounded-xl p-5" style={{
              background: 'rgba(0,0,0,0.3)',
              border: '1px solid rgba(6,182,212,0.15)'
            }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs text-gray-400 font-medium">{formatDate(currentAnalysis.created_at)}</span>
                </div>
                <span className="text-[10px] text-gray-500 px-2 py-0.5 rounded bg-gray-800">{currentAnalysis.tokens_utilizados} tokens</span>
              </div>
              <div
                className="text-sm text-gray-300 leading-relaxed prose-invert"
                dangerouslySetInnerHTML={{ __html: renderMarkdown(currentAnalysis.resultado) }}
              />
            </div>
          )}

          {previousAnalyses.length > 0 && (
            <div>
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="flex items-center gap-2 text-sm text-gray-400 hover:text-gray-300 transition-colors"
              >
                {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                Historico ({previousAnalyses.length})
              </button>

              {showHistory && (
                <div className="mt-3 space-y-2">
                  {previousAnalyses.map((a) => (
                    <div
                      key={a.id}
                      className="p-3 rounded-lg cursor-pointer transition-all"
                      style={{
                        background: currentAnalysis?.id === a.id ? 'rgba(6,182,212,0.1)' : 'rgba(0,0,0,0.2)',
                        border: currentAnalysis?.id === a.id ? '1px solid rgba(6,182,212,0.3)' : '1px solid rgba(255,255,255,0.05)'
                      }}
                      onClick={() => setCurrentAnalysis(a)}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <span className="text-xs text-white font-medium">{formatDate(a.created_at)}</span>
                          <span className="text-[10px] text-gray-500 ml-2">
                            {a.periodo_inicio && a.periodo_fim
                              ? `${new Date(a.periodo_inicio).toLocaleDateString('pt-BR')} - ${new Date(a.periodo_fim).toLocaleDateString('pt-BR')}`
                              : ''
                            }
                          </span>
                        </div>
                        {isMaster && (
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteAnalysis(a.id); }}
                            className="p-1 rounded hover:bg-red-500/20 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5 text-gray-500 hover:text-red-400" />
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-gray-400 mt-1 line-clamp-2">{a.resultado.slice(0, 120)}...</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-4 border-t border-gray-700/50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Fechar
          </button>
          <button
            onClick={runAnalysis}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium transition-all disabled:opacity-50"
            style={{
              background: loading ? 'rgba(6,182,212,0.1)' : 'linear-gradient(135deg, #0891b2, #0284c7)',
              border: '1px solid rgba(6,182,212,0.4)',
              boxShadow: loading ? 'none' : '0 0 20px rgba(6,182,212,0.3)'
            }}
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-cyan-300" />
                <span className="text-cyan-300">Analisando...</span>
              </>
            ) : (
              <>
                {currentAnalysis ? <RefreshCw className="w-4 h-4 text-white" /> : <Brain className="w-4 h-4 text-white" />}
                <span className="text-white">{currentAnalysis ? 'Nova Análise' : 'Gerar Análise'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
