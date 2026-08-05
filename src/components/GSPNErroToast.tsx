import { useEffect, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import type { GSPNErro } from '../hooks/useGSPNErros';

interface GSPNErroToastProps {
  erro: GSPNErro | null;
  onDismiss: () => void;
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

export function GSPNErroToast({ erro, onDismiss }: GSPNErroToastProps) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (erro) {
      requestAnimationFrame(() => setVisible(true));
    } else {
      setVisible(false);
    }
  }, [erro]);

  if (!erro) return null;

  const osInfo = erro.numero_os_samsung ? ` (OS ${erro.numero_os_samsung})` : '';

  return (
    <div className="fixed top-4 right-4 z-[9999] max-w-md w-full pointer-events-none">
      <div
        className={`pointer-events-auto transform transition-all duration-300 ease-out ${
          visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
        }`}
      >
        <div className="bg-red-950/95 border border-red-500/30 rounded-xl shadow-2xl shadow-red-500/10 p-4 backdrop-blur-sm">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2 mb-1">
                <span className="text-xs font-semibold text-red-400 uppercase tracking-wide">
                  {formatProcesso(erro.processo)}{osInfo}
                </span>
                <button
                  onClick={onDismiss}
                  className="text-red-400/60 hover:text-red-300 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-red-100/90 break-words line-clamp-3">
                {erro.mensagem}
              </p>
              <p className="text-[10px] text-red-400/50 mt-1.5">
                {new Date(erro.criado_em).toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
