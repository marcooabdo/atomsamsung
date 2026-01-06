import { useState } from 'react';
import { X, AlertTriangle, CheckCircle, Package } from 'lucide-react';

interface DevolucaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (motivo: string, tipo: 'nova' | 'nova_com_defeito' | 'usada') => void;
  requisicao: {
    codigo_peca: string;
    descricao: string;
  };
  tipoOS: string;
}

export function DevolucaoModal({ isOpen, onClose, onConfirm, requisicao, tipoOS }: DevolucaoModalProps) {
  const [motivo, setMotivo] = useState('');
  const [tipo, setTipo] = useState<'nova' | 'nova_com_defeito' | 'usada'>('nova');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const isOWouLP = tipoOS === 'OW' || tipoOS === 'LP';

  const handleSubmit = async () => {
    if (!motivo.trim() || motivo.trim().length < 10) {
      alert('Por favor, informe um motivo com pelo menos 10 caracteres');
      return;
    }

    setLoading(true);
    try {
      await onConfirm(motivo, tipo);
      setMotivo('');
      setTipo('nova');
      onClose();
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setMotivo('');
      setTipo('nova');
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 to-black border border-[#00D4FF]/30 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto cyber-scrollbar shadow-2xl">
        <div className="sticky top-0 bg-gradient-to-r from-[#FF0064] to-[#FF6B00] p-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <Package className="w-6 h-6 text-white" />
            <h2 className="text-2xl font-bold text-white">Solicitar Devolução de Peça</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-white hover:bg-white/10 p-2 rounded-lg transition disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-[#00D4FF]/10 border border-[#00D4FF]/30 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-[#00D4FF] mb-3 uppercase tracking-wider">
              Informações da Peça
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 uppercase">PN:</span>
                <span className="text-sm font-mono font-bold text-white">{requisicao.codigo_peca}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-xs text-gray-400 uppercase">Descrição:</span>
                <span className="text-sm text-gray-200">{requisicao.descricao}</span>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">
              Motivo da Devolução *
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo da devolução (mínimo 10 caracteres)"
              rows={4}
              className="neon-input"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-2">
              Caracteres: {motivo.length} / mínimo 10
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">
              Tipo de Devolução *
            </label>

            {isOWouLP && (
              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3 mb-4 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-300">
                  Para OS tipo <strong>{tipoOS}</strong>, apenas devoluções de peças novas ou com defeito de fábrica são permitidas.
                </p>
              </div>
            )}

            <div className="space-y-3">
              <label className="flex items-start gap-4 p-4 border border-gray-700 rounded-lg cursor-pointer hover:border-[#39FF14]/50 transition group">
                <input
                  type="radio"
                  name="tipo"
                  value="nova"
                  checked={tipo === 'nova'}
                  onChange={(e) => setTipo(e.target.value as 'nova')}
                  disabled={loading}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="w-5 h-5 text-[#39FF14]" />
                    <span className="font-semibold text-white">Peça Nova</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    A peça não foi utilizada e está em perfeito estado. Pode ser reaproveitada.
                  </p>
                </div>
              </label>

              <label className="flex items-start gap-4 p-4 border border-gray-700 rounded-lg cursor-pointer hover:border-[#FF0064]/50 transition group">
                <input
                  type="radio"
                  name="tipo"
                  value="nova_com_defeito"
                  checked={tipo === 'nova_com_defeito'}
                  onChange={(e) => setTipo(e.target.value as 'nova_com_defeito')}
                  disabled={loading}
                  className="mt-1"
                />
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertTriangle className="w-5 h-5 text-[#FF0064]" />
                    <span className="font-semibold text-white">Nova com Defeito</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    A peça não funcionou corretamente. Apresenta defeito de fábrica.
                  </p>
                </div>
              </label>

              {!isOWouLP && (
                <label className="flex items-start gap-4 p-4 border border-gray-700 rounded-lg cursor-pointer hover:border-gray-500 transition group">
                  <input
                    type="radio"
                    name="tipo"
                    value="usada"
                    checked={tipo === 'usada'}
                    onChange={(e) => setTipo(e.target.value as 'usada')}
                    disabled={loading}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="w-5 h-5 text-gray-400" />
                      <span className="font-semibold text-white">Peça Usada</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      A peça foi utilizada no reparo do aparelho.
                    </p>
                  </div>
                </label>
              )}
            </div>
          </div>

          <div className="bg-[#00D4FF]/10 border border-[#00D4FF]/30 rounded-lg p-4">
            <p className="text-xs text-gray-300">
              <strong>Atenção:</strong> Esta solicitação será enviada para aprovação do estoque.
              A peça continuará vinculada a você até que a devolução seja aprovada.
            </p>
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-900/95 backdrop-blur-sm border-t border-gray-800 p-6 flex gap-4">
          <button
            onClick={handleClose}
            disabled={loading}
            className="flex-1 px-6 py-3 border border-gray-700 rounded-lg font-medium hover:bg-gray-800 transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !motivo.trim() || motivo.trim().length < 10}
            className="flex-1 neon-button px-6 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Processando...' : 'Confirmar Devolução'}
          </button>
        </div>
      </div>
    </div>
  );
}
