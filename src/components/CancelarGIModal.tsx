import { useState } from 'react';
import { X, XCircle, AlertTriangle } from 'lucide-react';

interface CancelarGIModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (motivo: string, pecasSelecionadas?: string[]) => void;
  requisicao: {
    codigo_peca: string;
    descricao: string;
  };
  isLote?: boolean;
  pecasLote?: Array<{
    id: string;
    id_numerico: number;
    valor_com_impostos: string;
    delivery: string | null;
  }>;
}

export function CancelarGIModal({ isOpen, onClose, onConfirm, requisicao, isLote, pecasLote }: CancelarGIModalProps) {
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [pecasSelecionadas, setPecasSelecionadas] = useState<string[]>(
    isLote && pecasLote ? pecasLote.map(p => p.id) : []
  );

  if (!isOpen) return null;

  const handleTogglePeca = (pecaId: string) => {
    setPecasSelecionadas(prev =>
      prev.includes(pecaId)
        ? prev.filter(id => id !== pecaId)
        : [...prev, pecaId]
    );
  };

  const handleToggleTodas = () => {
    if (!pecasLote) return;
    if (pecasSelecionadas.length === pecasLote.length) {
      setPecasSelecionadas([]);
    } else {
      setPecasSelecionadas(pecasLote.map(p => p.id));
    }
  };

  const handleSubmit = async () => {
    if (!motivo.trim() || motivo.trim().length < 10) {
      alert('Por favor, informe um motivo com pelo menos 10 caracteres');
      return;
    }

    if (isLote && pecasSelecionadas.length === 0) {
      alert('Por favor, selecione pelo menos uma peça para cancelar a GI');
      return;
    }

    setLoading(true);
    try {
      await onConfirm(motivo, isLote ? pecasSelecionadas : undefined);
      setMotivo('');
      onClose();
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setMotivo('');
      setPecasSelecionadas(isLote && pecasLote ? pecasLote.map(p => p.id) : []);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-gradient-to-br from-gray-900 to-black border border-[#FF0064]/30 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto cyber-scrollbar shadow-2xl">
        <div className="sticky top-0 bg-gradient-to-r from-[#FF0064] to-[#FF6B00] p-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <XCircle className="w-6 h-6 text-white" />
            <h2 className="text-2xl font-bold text-white">Cancelar GI</h2>
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
          <div className="bg-[#FF0064]/10 border border-[#FF0064]/30 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-[#FF0064] mb-3 uppercase tracking-wider">
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

          {isLote && pecasLote && pecasLote.length > 1 && (
            <div className="bg-[#00D4FF]/10 border border-[#00D4FF]/30 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[#00D4FF] uppercase tracking-wider">
                  Selecione as peças para cancelar GI
                </h3>
                <button
                  onClick={handleToggleTodas}
                  type="button"
                  className="text-xs px-3 py-1 rounded border border-[#00D4FF]/40 text-[#00D4FF] hover:bg-[#00D4FF]/10 transition-colors"
                >
                  {pecasSelecionadas.length === pecasLote.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                </button>
              </div>
              <div className="space-y-2">
                {pecasLote.map((peca) => (
                  <label
                    key={peca.id}
                    className="flex items-center gap-3 p-3 rounded bg-gray-900/50 hover:bg-gray-900/70 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={pecasSelecionadas.includes(peca.id)}
                      onChange={() => handleTogglePeca(peca.id)}
                      className="w-4 h-4 rounded border-[#00D4FF]/40 text-[#00D4FF] focus:ring-[#00D4FF] focus:ring-offset-0"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[#00D4FF] font-bold">ID #{peca.id_numerico}</span>
                        {peca.delivery && (
                          <span className="text-xs text-gray-400">Delivery: {peca.delivery}</span>
                        )}
                        <span className="text-xs text-gray-300">
                          R$ {Number(peca.valor_com_impostos).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {pecasSelecionadas.length} de {pecasLote.length} peça(s) selecionada(s)
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-3 uppercase tracking-wider">
              Motivo do Cancelamento *
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo do cancelamento da GI (mínimo 10 caracteres)"
              rows={4}
              className="neon-input"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-2">
              Caracteres: {motivo.length} / mínimo 10
            </p>
          </div>

          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-xs text-yellow-300 font-semibold">Atenção:</p>
              <p className="text-xs text-yellow-300">
                Ao cancelar a GI, {isLote && pecasLote && pecasLote.length > 1 ? 'as peças selecionadas voltarão' : 'a peça voltará'} para o status <strong>ATENDIDA</strong> e {isLote && pecasLote && pecasLote.length > 1 ? 'poderão' : 'poderá'} ser devolvida{isLote && pecasLote && pecasLote.length > 1 ? 's' : ''} ou ter a GI postada novamente.
              </p>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-900/95 backdrop-blur-sm border-t border-gray-800 p-6 flex gap-4">
          <button
            onClick={handleClose}
            disabled={loading}
            className="flex-1 px-6 py-3 border border-gray-700 rounded-lg font-medium hover:bg-gray-800 transition disabled:opacity-50"
          >
            Voltar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !motivo.trim() || motivo.trim().length < 10 || (isLote && pecasSelecionadas.length === 0)}
            className="flex-1 px-6 py-3 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              backgroundColor: loading ? 'rgba(255,0,100,0.3)' : 'rgba(255,0,100,0.2)',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: '#FF0064',
              color: '#FF0064'
            }}
          >
            {loading ? 'Cancelando...' : 'Confirmar Cancelamento'}
          </button>
        </div>
      </div>
    </div>
  );
}
