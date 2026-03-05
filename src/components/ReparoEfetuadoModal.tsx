import { useState } from 'react';
import { X, Wrench, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useModal } from '../contexts/ModalContext';

interface ReparoEfetuadoModalProps {
  isOpen: boolean;
  osId: string;
  osNumero: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function ReparoEfetuadoModal({ isOpen, osId, osNumero, onClose, onSuccess }: ReparoEfetuadoModalProps) {
  const { usuario } = useAuth();
  const { showAlert } = useModal();
  const [reparo, setReparo] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reparo.trim()) {
      showAlert({ message: 'Por favor, descreva o reparo efetuado.', type: 'warning' });
      return;
    }

    setLoading(true);
    try {
      const { error: comentarioError } = await supabase
        .from('os_comentarios')
        .insert({
          os_id: osId,
          usuario_id: usuario?.id,
          comentario: `**REPARO EFETUADO:**\n\n${reparo.trim()}`,
          is_system: true
        });

      if (comentarioError) throw comentarioError;

      const { error: osError } = await supabase
        .from('os')
        .update({
          coluna_kanban: 'controle_qualidade',
          reparo_efetuado: reparo.trim(),
          updated_at: new Date().toISOString()
        })
        .eq('id', osId);

      if (osError) throw osError;

      onSuccess();
      handleClose();
    } catch (error: any) {
      showAlert({ message: `Erro ao salvar reparo: ${error.message}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setReparo('');
    onClose();
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl"
        style={{ background: 'var(--bg-card)', border: '1px solid rgba(var(--accent-rgb),0.3)', boxShadow: 'var(--card-shadow)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-6 pb-4" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: 'rgba(var(--accent-rgb),0.12)', border: '1px solid rgba(var(--accent-rgb),0.3)' }}>
              <Wrench className="w-5 h-5" style={{ color: 'var(--text-accent)' }} />
            </div>
            <div>
              <h3 className="text-lg font-bold" style={{ color: 'var(--text-accent)' }}>Reparo Efetuado</h3>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>OS: {osNumero}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(var(--accent-rgb),0.06)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="rounded-lg p-4" style={{ background: 'rgba(var(--accent-rgb),0.06)', border: '1px solid rgba(var(--accent-rgb),0.2)' }}>
            <div className="flex items-start gap-3">
              <Wrench className="w-5 h-5 flex-shrink-0 mt-1" style={{ color: 'var(--text-accent)' }} />
              <div className="flex-1 text-sm">
                <p className="font-semibold mb-2" style={{ color: 'var(--text-accent)' }}>Controle de Qualidade (OQC)</p>
                <ul className="list-disc list-inside space-y-1" style={{ color: 'var(--text-secondary)' }}>
                  <li>Descreva o reparo realizado no aparelho</li>
                  <li>Informe os componentes substituídos</li>
                  <li>Após salvar, a OS será movida para OQC</li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold mb-2" style={{ color: 'var(--text-accent)' }}>
              Descrição do Reparo Efetuado *
            </label>
            <textarea
              value={reparo}
              onChange={(e) => setReparo(e.target.value)}
              placeholder="Descreva em detalhes o reparo realizado, componentes substituídos, testes realizados..."
              className="w-full h-48 resize-none rounded-lg px-4 py-3 text-sm focus:outline-none transition-colors"
              style={{ background: 'var(--bg-secondary)', border: '1px solid rgba(var(--accent-rgb),0.3)', color: 'var(--text-primary)' }}
              required
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-6 py-3 rounded-lg font-bold transition-all duration-300"
              style={{ background: 'transparent', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}
              disabled={loading}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(var(--accent-rgb),0.06)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 rounded-lg font-bold transition-all duration-300"
              style={{ background: 'rgba(var(--accent-rgb),0.15)', border: '1px solid rgba(var(--accent-rgb),0.4)', color: 'var(--text-accent)' }}
              disabled={loading}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.background = 'rgba(var(--accent-rgb),0.25)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(var(--accent-rgb),0.15)'; }}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-t-transparent inline-block mr-2" style={{ borderColor: 'var(--text-accent)', borderTopColor: 'transparent' }} />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 inline mr-2" />
                  Registrar Reparo e Mover p/ OQC
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
