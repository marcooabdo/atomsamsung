import { useState, useEffect } from 'react';
import { Clock, TrendingRight, User, Zap, AlertCircle, CheckCircle, Package } from 'lucide-react';
import { pipelineEngine, PipelineLog, StatusPecasOS } from '../lib/pipelineEngine';

interface OSPipelineInfoProps {
  osId: string;
}

export default function OSPipelineInfo({ osId }: OSPipelineInfoProps) {
  const [logs, setLogs] = useState<PipelineLog[]>([]);
  const [statusPecas, setStatusPecas] = useState<StatusPecasOS | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    carregarDados();
  }, [osId]);

  const carregarDados = async () => {
    try {
      setLoading(true);
      const [logsData, pecasData] = await Promise.all([
        pipelineEngine.buscarLogsOS(osId),
        pipelineEngine.buscarStatusPecasOS(osId),
      ]);

      setLogs(logsData);
      setStatusPecas(pecasData);
    } catch (error) {
      console.error('Erro ao carregar dados do pipeline:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {statusPecas && statusPecas.total_pecas > 0 && (
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Package className="w-5 h-5 text-blue-400" />
            <h4 className="text-sm font-medium text-white">Status das Peças</h4>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Total de peças requisitadas:</span>
              <span className="text-sm font-medium text-white">{statusPecas.total_pecas}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Peças recebidas:</span>
              <span className="text-sm font-medium text-green-400">
                {statusPecas.pecas_recebidas_completas}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Peças pendentes:</span>
              <span className="text-sm font-medium text-yellow-400">
                {statusPecas.pecas_pendentes}
              </span>
            </div>

            <div className="pt-3 border-t border-gray-700">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-400">Progresso de recebimento:</span>
                <span className="text-sm font-medium text-white">
                  {statusPecas.percentual_recebimento.toFixed(0)}%
                </span>
              </div>

              <div className="w-full bg-gray-700 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all duration-300 ${
                    statusPecas.todas_pecas_recebidas
                      ? 'bg-green-500'
                      : statusPecas.percentual_recebimento > 50
                      ? 'bg-blue-500'
                      : 'bg-yellow-500'
                  }`}
                  style={{ width: `${statusPecas.percentual_recebimento}%` }}
                />
              </div>
            </div>

            {statusPecas.todas_pecas_recebidas && (
              <div className="flex items-center gap-2 pt-2 text-green-400">
                <CheckCircle className="w-4 h-4" />
                <span className="text-sm font-medium">Todas as peças foram recebidas</span>
              </div>
            )}
          </div>
        </div>
      )}

      {logs.length > 0 && (
        <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-5 h-5 text-purple-400" />
            <h4 className="text-sm font-medium text-white">Histórico de Movimentações</h4>
          </div>

          <div className="space-y-3">
            {logs.map((log: any, index) => (
              <div key={log.id} className="relative pl-6 pb-3 last:pb-0">
                {index !== logs.length - 1 && (
                  <div className="absolute left-2 top-6 bottom-0 w-0.5 bg-gray-700" />
                )}

                <div className="absolute left-0 top-1">
                  {log.tipo_movimentacao === 'automatica' ? (
                    <div className="w-4 h-4 rounded-full bg-blue-500 flex items-center justify-center">
                      <Zap className="w-2.5 h-2.5 text-white" />
                    </div>
                  ) : (
                    <div className="w-4 h-4 rounded-full bg-purple-500 flex items-center justify-center">
                      <User className="w-2.5 h-2.5 text-white" />
                    </div>
                  )}
                </div>

                <div className="bg-gray-900/50 rounded-lg p-3 border border-gray-700/50">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <TrendingRight className="w-4 h-4 text-gray-400" />
                      <span className="text-sm text-gray-300">
                        {log.coluna_origem} → {log.coluna_destino}
                      </span>
                    </div>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        log.tipo_movimentacao === 'automatica'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-purple-500/20 text-purple-400'
                      }`}
                    >
                      {log.tipo_movimentacao === 'automatica' ? 'Automática' : 'Manual'}
                    </span>
                  </div>

                  {log.motivo_texto && (
                    <p className="text-sm text-gray-400 mb-2">{log.motivo_texto}</p>
                  )}

                  {log.regra?.nome && (
                    <div className="text-xs text-gray-500 mb-1">
                      Regra aplicada: {log.regra.nome}
                    </div>
                  )}

                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <div className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(log.executado_em).toLocaleString('pt-BR')}
                    </div>
                    {log.usuario?.nome && (
                      <div className="flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {log.usuario.nome}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {logs.length === 0 && (!statusPecas || statusPecas.total_pecas === 0) && (
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">
            Nenhuma informação de pipeline disponível para esta OS
          </p>
        </div>
      )}
    </div>
  );
}
