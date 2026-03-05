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
    gi_postada_em?: string | null;
    gi_postada_por?: string | null;
    usuario_gi_postado?: { nome: string } | null;
  }>;
}

export function CancelarGIModal({ isOpen, onClose, onConfirm, requisicao, isLote, pecasLote }: CancelarGIModalProps) {
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const [pecasSelecionadas, setPecasSelecionadas] = useState<string[]>(
    isLote && pecasLote ? pecasLote.filter(p => p.gi_postada_em).map(p => p.id) : []
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
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div
        className="rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        style={{ background: 'var(--bg-card)', border: '1px solid rgba(var(--accent-rgb),0.3)', boxShadow: 'var(--card-shadow)' }}
      >
        <div className="sticky top-0 p-6 flex items-center justify-between z-10" style={{ background: 'var(--bg-card)', borderBottom: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <XCircle className="w-5 h-5" style={{ color: '#EF4444' }} />
            </div>
            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Cancelar GI</h2>
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
          <div className="rounded-lg p-4" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
            <h3 className="text-sm font-semibold mb-3 uppercase tracking-wider" style={{ color: '#EF4444' }}>
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
                  Selecione as peças para cancelar GI
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
                    className={`flex items-center gap-3 p-3 rounded transition-colors ${peca.gi_postada_em ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                    style={{
                      background: peca.gi_postada_em ? 'rgba(var(--accent-rgb),0.04)' : 'rgba(var(--accent-rgb),0.02)',
                      border: '1px solid rgba(var(--accent-rgb),0.12)'
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={pecasSelecionadas.includes(peca.id)}
                      onChange={() => handleTogglePeca(peca.id)}
                      disabled={!peca.gi_postada_em}
                      className="w-4 h-4 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-mono font-bold" style={{ color: 'var(--text-accent)' }}>ID #{peca.id_numerico}</span>
                        {peca.delivery && (
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Delivery: {peca.delivery}</span>
                        )}
                        <span className="text-xs" style={{ color: 'var(--text-primary)' }}>
                          R$ {Number(peca.valor_com_impostos).toFixed(2)}
                        </span>
                        {peca.gi_postada_em ? (
                          <span className="text-[10px] px-2 py-1 rounded" style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)' }}>
                            GI postada em {new Date(peca.gi_postada_em).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })} por {peca.usuario_gi_postado?.nome || 'N/A'}
                          </span>
                        ) : (
                          <span className="text-[10px] px-2 py-1 rounded" style={{ background: 'rgba(var(--accent-rgb),0.06)', color: 'var(--text-secondary)', border: '1px solid rgba(var(--accent-rgb),0.15)' }}>
                            GI não postada
                          </span>
                        )}
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
              Motivo do Cancelamento *
            </label>
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Descreva o motivo do cancelamento da GI (mínimo 10 caracteres)"
              rows={4}
              className="w-full px-4 py-3 rounded-lg resize-none focus:outline-none transition-colors"
              style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(var(--accent-rgb),0.3)', color: 'var(--text-primary)' }}
              disabled={loading}
            />
            <p className="text-xs mt-2" style={{ color: 'var(--text-secondary)' }}>
              Caracteres: {motivo.length} / mínimo 10
            </p>
          </div>

          <div className="rounded-lg p-4 flex items-start gap-2" style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)' }}>
            <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#F59E0B' }} />
            <div className="space-y-1">
              <p className="text-xs font-semibold" style={{ color: '#F59E0B' }}>Atenção:</p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Ao cancelar a GI, {isLote && pecasLote && pecasLote.length > 1 ? 'as peças selecionadas voltarão' : 'a peça voltará'} para o status <strong>ATENDIDA</strong> e {isLote && pecasLote && pecasLote.length > 1 ? 'poderão' : 'poderá'} ser devolvida{isLote && pecasLote && pecasLote.length > 1 ? 's' : ''} ou ter a GI postada novamente.
              </p>
            </div>
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
            Voltar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !motivo.trim() || motivo.trim().length < 10 || (isLote && pecasSelecionadas.length === 0)}
            className="flex-1 px-6 py-3 rounded-lg font-medium transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', color: '#EF4444' }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'rgba(239,68,68,0.22)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; }}
          >
            {loading ? 'Cancelando...' : 'Confirmar Cancelamento'}
          </button>
        </div>
      </div>
    </div>
  );
}
