import { useState } from 'react';
import { X, AlertTriangle, CheckCircle, Package } from 'lucide-react';

interface DevolucaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (motivo: string, tipo: 'nova' | 'nova_com_defeito' | 'usada', pecasSelecionadas?: string[]) => void;
  requisicao: {
    codigo_peca: string;
    descricao: string;
  };
  tipoOS: string;
  isLote?: boolean;
  pecasLote?: Array<{
    id: string;
    id_numerico: number;
    valor_com_impostos: string;
    delivery: string | null;
  }>;
}

export function DevolucaoModal({ isOpen, onClose, onConfirm, requisicao, tipoOS, isLote, pecasLote }: DevolucaoModalProps) {
  const [motivo, setMotivo] = useState('');
  const [tipo, setTipo] = useState<'nova' | 'nova_com_defeito' | 'usada'>('nova');
  const [loading, setLoading] = useState(false);
  const [pecasSelecionadas, setPecasSelecionadas] = useState<string[]>(
    isLote && pecasLote ? pecasLote.map(p => p.id) : []
  );

  if (!isOpen) return null;

  const isOWouLP = tipoOS === 'OW' || tipoOS === 'LP';

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
      alert('Por favor, selecione pelo menos uma peça para devolver');
      return;
    }

    setLoading(true);
    try {
      await onConfirm(motivo, tipo, isLote ? pecasSelecionadas : undefined);
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
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={e => e.stopPropagation()}>
      <div
        className="rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--bg-card)', border: '1px solid rgba(var(--accent-rgb),0.3)', boxShadow: 'var(--card-shadow)' }}
      >
        <div className="sticky top-0 p-6 flex items-center justify-between z-10" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: 'rgba(var(--accent-rgb),0.12)', border: '1px solid rgba(var(--accent-rgb),0.3)' }}>
              <Package className="w-5 h-5" style={{ color: 'var(--text-accent)' }} />
            </div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Solicitar Devolução de Peça</h2>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-2 rounded-lg transition-colors disabled:opacity-50"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(var(--accent-rgb),0.06)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="rounded-lg p-4" style={{ background: 'rgba(var(--accent-rgb),0.06)', border: '1px solid rgba(var(--accent-rgb),0.2)' }}>
            <h3 className="text-sm font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--text-accent)' }}>
              Informações da Peça
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs uppercase" style={{ color: 'var(--text-secondary)' }}>PN:</span>
                <span className="text-sm font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{requisicao.codigo_peca}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-xs uppercase" style={{ color: 'var(--text-secondary)' }}>Descrição:</span>
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{requisicao.descricao}</span>
              </div>
            </div>
          </div>

          {isLote && pecasLote && pecasLote.length > 1 && (
            <div className="rounded-lg p-4" style={{ background: 'rgba(var(--accent-rgb),0.06)', border: '1px solid rgba(var(--accent-rgb),0.2)' }}>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-accent)' }}>
                  Selecione as peças para devolução
                </h3>
                <button
                  onClick={handleToggleTodas}
                  type="button"
                  className="text-xs px-3 py-1 rounded transition-colors"
                  style={{ border: '1px solid rgba(var(--accent-rgb),0.4)', color: 'var(--text-accent)' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(var(--accent-rgb),0.1)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                >
                  {pecasSelecionadas.length === pecasLote.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                </button>
              </div>
              <div className="space-y-2">
                {pecasLote.map((peca) => (
                  <label
                    key={peca.id}
                    className="flex items-center gap-3 p-3 rounded cursor-pointer transition-colors"
                    style={{ background: 'rgba(var(--accent-rgb),0.04)', border: '1px solid rgba(var(--accent-rgb),0.12)' }}
                  >
                    <input
                      type="checkbox"
                      checked={pecasSelecionadas.includes(peca.id)}
                      onChange={() => handleTogglePeca(peca.id)}
                      className="w-4 h-4 rounded"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold" style={{ color: 'var(--text-accent)' }}>ID #{peca.id_numerico}</span>
                        {peca.delivery && (
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Delivery: {peca.delivery}</span>
                        )}
                        <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
                          R$ {Number(peca.valor_com_impostos).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
                {pecasSelecionadas.length} de {pecasLote.length} peça(s) selecionada(s)
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--text-accent)' }}>
              Motivo da Devolução *
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo da devolução (mínimo 10 caracteres)"
              rows={4}
              className="w-full px-4 py-3 rounded-lg resize-none focus:outline-none transition-colors"
              style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(var(--accent-rgb),0.3)', color: 'var(--text-primary)' }}
              disabled={loading}
            />
            <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
              Caracteres: {motivo.length} / mínimo 10
            </p>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-3 uppercase tracking-wider" style={{ color: 'var(--text-accent)' }}>
              Tipo de Devolução *
            </label>

            {isOWouLP && (
              <div className="rounded-lg p-3 mb-4 flex items-start gap-2" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  Para OS tipo <strong>{tipoOS}</strong>, apenas devoluções de peças novas ou com defeito de fábrica são permitidas.
                </p>
              </div>
            )}

            <div className="space-y-3">
              <label
                className="flex items-start gap-4 p-4 rounded-lg cursor-pointer transition-all"
                style={{ border: `1px solid ${tipo === 'nova' ? 'rgba(16,185,129,0.5)' : 'rgba(var(--accent-rgb),0.2)'}`, background: tipo === 'nova' ? 'rgba(16,185,129,0.06)' : 'transparent' }}
              >
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
                    <CheckCircle className="w-5 h-5" style={{ color: '#10B981' }} />
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Peça Nova</span>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    A peça não foi utilizada e está em perfeito estado. Pode ser reaproveitada.
                  </p>
                </div>
              </label>

              <label
                className="flex items-start gap-4 p-4 rounded-lg cursor-pointer transition-all"
                style={{ border: `1px solid ${tipo === 'nova_com_defeito' ? 'rgba(239,68,68,0.5)' : 'rgba(var(--accent-rgb),0.2)'}`, background: tipo === 'nova_com_defeito' ? 'rgba(239,68,68,0.06)' : 'transparent' }}
              >
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
                    <AlertTriangle className="w-5 h-5" style={{ color: '#EF4444' }} />
                    <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Nova com Defeito</span>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    A peça não funcionou corretamente. Apresenta defeito de fábrica.
                  </p>
                </div>
              </label>

              {!isOWouLP && (
                <label
                  className="flex items-start gap-4 p-4 rounded-lg cursor-pointer transition-all"
                  style={{ border: `1px solid ${tipo === 'usada' ? 'rgba(var(--accent-rgb),0.4)' : 'rgba(var(--accent-rgb),0.2)'}`, background: tipo === 'usada' ? 'rgba(var(--accent-rgb),0.06)' : 'transparent' }}
                >
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
                      <Package className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                      <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>Peça Usada</span>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      A peça foi utilizada no reparo do aparelho.
                    </p>
                  </div>
                </label>
              )}
            </div>
          </div>

          <div className="rounded-lg p-4" style={{ background: 'rgba(var(--accent-rgb),0.06)', border: '1px solid rgba(var(--accent-rgb),0.2)' }}>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              <strong>Atenção:</strong> Esta solicitação será enviada para aprovação do estoque.
              A peça continuará vinculada a você até que a devolução seja aprovada.
            </p>
          </div>
        </div>

        <div className="sticky bottom-0 p-6 flex gap-4" style={{ background: 'var(--bg-card)', borderTop: '1px solid var(--border-primary)' }}>
          <button
            onClick={handleClose}
            disabled={loading}
            className="flex-1 px-6 py-3 rounded-lg font-medium transition-all duration-300 disabled:opacity-50"
            style={{ background: 'transparent', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(var(--accent-rgb),0.06)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !motivo.trim() || motivo.trim().length < 10 || (isLote && pecasSelecionadas.length === 0)}
            className="flex-1 px-6 py-3 rounded-lg font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'rgba(var(--accent-rgb),0.15)', border: '1px solid rgba(var(--accent-rgb),0.4)', color: 'var(--text-accent)' }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'rgba(var(--accent-rgb),0.25)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(var(--accent-rgb),0.15)'; }}
          >
            {loading ? 'Processando...' : 'Confirmar Devolução'}
          </button>
        </div>
      </div>
    </div>
  );
}
