import { useState } from 'react';
import { AlertTriangle, RefreshCw, ChevronDown, Clock, Server } from 'lucide-react';
import type { GSPNErro } from '../hooks/useGSPNErros';

interface GSPNErrosHistoricoProps {
  erros: GSPNErro[];
  loading: boolean;
  hasMore: boolean;
  onLoadMore: () => Promise<void>;
}

function formatProcesso(processo: string): string {
  const map: Record<string, string> = {
    'cron-leve': 'Cron Leve',
    'cron-pesado': 'Cron Pesado',
    'refresh': 'Refresh',
    'busca-manual': 'Busca Manual',
  };
  return map[processo] || processo;
}

function processoColor(processo: string): string {
  switch (processo) {
    case 'cron-leve': return 'bg-amber-500/20 text-amber-400 border-amber-500/30';
    case 'cron-pesado': return 'bg-orange-500/20 text-orange-400 border-orange-500/30';
    case 'refresh': return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    case 'busca-manual': return 'bg-purple-500/20 text-purple-400 border-purple-500/30';
    default: return 'bg-red-500/20 text-red-400 border-red-500/30';
  }
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'agora';
  if (mins < 60) return `${mins}min atrás`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h atrás`;
  const days = Math.floor(hours / 24);
  return `${days}d atrás`;
}

export function GSPNErrosHistorico({ erros, loading, hasMore, onLoadMore }: GSPNErrosHistoricoProps) {
  const [loadingMore, setLoadingMore] = useState(false);

  async function handleLoadMore() {
    setLoadingMore(true);
    await onLoadMore();
    setLoadingMore(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-gray-500">
        <RefreshCw className="w-5 h-5 animate-spin mr-2" />
        <span className="text-sm">Carregando erros...</span>
      </div>
    );
  }

  if (erros.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-gray-500">
        <Server className="w-10 h-10 mb-3 text-gray-600" />
        <p className="text-sm font-medium text-gray-400">Nenhum erro registrado</p>
        <p className="text-xs text-gray-600 mt-1">Erros de sincronização GSPN aparecerão aqui</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {erros.map((erro) => (
        <div
          key={erro.id}
          className="p-3 rounded-lg border bg-red-500/5 border-red-500/15 hover:border-red-500/30 transition-colors"
        >
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 mt-0.5">
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${processoColor(erro.processo)}`}>
                  {formatProcesso(erro.processo)}
                </span>
                {erro.numero_os_samsung && (
                  <span className="text-[10px] text-gray-500 font-mono">
                    OS {erro.numero_os_samsung}
                  </span>
                )}
                <span className="text-[10px] text-gray-600 ml-auto flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {timeAgo(erro.criado_em)}
                </span>
              </div>
              <p className="text-xs text-red-200/80 break-words leading-relaxed">
                {erro.mensagem}
              </p>
              <p className="text-[10px] text-gray-600 mt-1.5">
                {new Date(erro.criado_em).toLocaleString('pt-BR', {
                  day: '2-digit', month: '2-digit', year: '2-digit',
                  hour: '2-digit', minute: '2-digit', second: '2-digit',
                })}
              </p>
            </div>
          </div>
        </div>
      ))}

      {hasMore && (
        <button
          onClick={handleLoadMore}
          disabled={loadingMore}
          className="w-full py-2.5 text-xs text-gray-400 hover:text-gray-300 flex items-center justify-center gap-1.5 rounded-lg border border-white/5 hover:border-white/10 transition-colors disabled:opacity-50"
        >
          {loadingMore ? (
            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5" />
          )}
          {loadingMore ? 'Carregando...' : 'Carregar mais'}
        </button>
      )}
    </div>
  );
}
