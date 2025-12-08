import { AlertTriangle, XCircle, Lightbulb } from 'lucide-react';

interface ExcludedOSPanelProps {
  osExcluidas: Array<{
    id: string;
    numero_os: string;
    cliente_nome?: string;
    endereco?: string;
    motivo: string;
    sugestao?: string;
    tecnicos_sugeridos?: string[];
  }>;
}

export default function ExcludedOSPanel({ osExcluidas }: ExcludedOSPanelProps) {
  if (!osExcluidas || osExcluidas.length === 0) {
    return null;
  }

  return (
    <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-6">
      <div className="flex items-center gap-3 mb-4">
        <XCircle className="w-6 h-6 text-red-400" />
        <h3 className="text-xl font-bold text-red-400">
          OSs Excluídas da Otimização ({osExcluidas.length})
        </h3>
      </div>

      <div className="space-y-3">
        {osExcluidas.map((os) => (
          <div
            key={os.id}
            className="bg-gray-800/50 border border-red-500/20 rounded-lg p-4"
          >
            <div className="flex items-start gap-4">
              <AlertTriangle className="w-6 h-6 text-red-400 flex-shrink-0 mt-1" />

              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-white font-bold">{os.numero_os}</span>
                  {os.cliente_nome && (
                    <span className="text-gray-400 text-sm">
                      {os.cliente_nome}
                    </span>
                  )}
                </div>

                {os.endereco && (
                  <p className="text-gray-500 text-sm mb-2">{os.endereco}</p>
                )}

                <div className="bg-red-500/10 border border-red-500/20 rounded p-3 mb-2">
                  <p className="text-red-300 text-sm font-medium">
                    Motivo: {os.motivo}
                  </p>
                </div>

                {os.sugestao && (
                  <div className="bg-blue-500/10 border border-blue-500/20 rounded p-3 flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
                    <p className="text-blue-300 text-sm">
                      <strong>Sugestão:</strong> {os.sugestao}
                    </p>
                  </div>
                )}

                {os.tecnicos_sugeridos && os.tecnicos_sugeridos.length > 0 && (
                  <div className="mt-2 bg-green-500/10 border border-green-500/20 rounded p-3">
                    <p className="text-green-300 text-sm">
                      <strong>Técnicos Compatíveis:</strong>{' '}
                      {os.tecnicos_sugeridos.join(', ')}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
        <p className="text-yellow-300 text-sm">
          <strong>Ação Recomendada:</strong> Corrija os problemas listados acima
          antes de executar nova otimização para incluir todas as OSs na rota.
        </p>
      </div>
    </div>
  );
}
