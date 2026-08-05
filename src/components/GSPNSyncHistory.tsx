import { Clock, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface SyncRecord {
  id: string;
  status: 'em_andamento' | 'concluido' | 'erro';
  iniciado_em: string;
  finalizado_em: string | null;
  mudancas: string[] | null;
  novos_anexos: number | null;
  erro: string | null;
}

interface GSPNSyncHistoryProps {
  syncHistory: SyncRecord[];
  loading?: boolean;
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatDuration(start: string, end: string | null): string {
  if (!end) return '...';
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function GSPNSyncHistory({ syncHistory, loading }: GSPNSyncHistoryProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center py-6 text-gray-500 text-sm">
        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
        Carregando histórico...
      </div>
    );
  }

  if (syncHistory.length === 0) {
    return (
      <p className="text-center text-gray-500 text-sm py-6">Nenhuma sincronização registrada.</p>
    );
  }

  return (
    <div className="space-y-2 max-h-64 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
      {syncHistory.map(record => (
        <div
          key={record.id}
          className={`flex items-start gap-3 p-3 rounded-lg border ${
            record.status === 'concluido'
              ? 'bg-emerald-500/5 border-emerald-500/20'
              : record.status === 'erro'
              ? 'bg-red-500/5 border-red-500/20'
              : 'bg-blue-500/5 border-blue-500/20'
          }`}
        >
          <div className="mt-0.5">
            {record.status === 'concluido' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
            {record.status === 'erro' && <AlertCircle className="w-4 h-4 text-red-500" />}
            {record.status === 'em_andamento' && <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium" style={{ color: record.status === 'concluido' ? '#10b981' : record.status === 'erro' ? '#ef4444' : '#3b82f6' }}>
                {record.status === 'concluido' ? 'Concluído' : record.status === 'erro' ? 'Erro' : 'Em andamento'}
              </span>
              <span className="text-[10px] text-gray-500">
                {formatDuration(record.iniciado_em, record.finalizado_em)}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-0.5">
              <Clock className="w-3 h-3 inline mr-1" />
              {formatDateTime(record.iniciado_em)}
            </p>
            {record.status === 'concluido' && record.mudancas && record.mudancas.length > 0 && (
              <p className="text-[11px] text-emerald-400/80 mt-1">
                Mudanças: {record.mudancas.join(', ')}
              </p>
            )}
            {record.status === 'concluido' && record.novos_anexos != null && record.novos_anexos > 0 && (
              <p className="text-[11px] text-emerald-400/80 mt-0.5">
                +{record.novos_anexos} anexo{record.novos_anexos > 1 ? 's' : ''}
              </p>
            )}
            {record.status === 'erro' && record.erro && (
              <p className="text-[11px] text-red-400/80 mt-1 break-words">
                {record.erro}
              </p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}


export { GSPNSyncHistory }