import { RefreshCw, CheckCircle, AlertCircle, X } from 'lucide-react';
import { useState, useEffect } from 'react';

interface GSPNSyncIndicatorProps {
  isSyncing: boolean;
  syncError: string | null;
  mudancas: string[] | null;
}

export function GSPNSyncIndicator({ isSyncing, syncError, mudancas }: GSPNSyncIndicatorProps) {
  const [showMudancas, setShowMudancas] = useState(false);
  const [showError, setShowError] = useState(false);

  useEffect(() => {
    if (mudancas && mudancas.length > 0) {
      setShowMudancas(true);
      const timer = setTimeout(() => setShowMudancas(false), 8000);
      return () => clearTimeout(timer);
    }
  }, [mudancas]);

  useEffect(() => {
    if (syncError) {
      setShowError(true);
      const timer = setTimeout(() => setShowError(false), 10000);
      return () => clearTimeout(timer);
    }
  }, [syncError]);

  if (isSyncing) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20 text-blue-400 text-xs animate-pulse">
        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        <span>Atualizando dados da Samsung...</span>
      </div>
    );
  }

  if (showMudancas && mudancas && mudancas.length > 0) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
        <CheckCircle className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">
          Atualizado: {mudancas.slice(0, 3).join(', ')}{mudancas.length > 3 ? ` +${mudancas.length - 3}` : ''}
        </span>
        <button onClick={() => setShowMudancas(false)} className="ml-auto opacity-60 hover:opacity-100">
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  if (showError && syncError) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">
        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="truncate">{syncError}</span>
        <button onClick={() => setShowError(false)} className="ml-auto opacity-60 hover:opacity-100">
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  return null;
}
