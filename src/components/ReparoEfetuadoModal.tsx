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
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className="premium-card w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#2563EB]/20">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(37,99,235,0.2) 0%, rgba(37,99,235,0.05) 100%)',
                border: '1px solid rgba(37,99,235,0.3)'
              }}
            >
              <Wrench className="w-5 h-5 text-[#2563EB]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#2563EB]">Reparo Efetuado</h3>
              <p className="text-sm text-gray-400">OS: {osNumero}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="bg-[#2563EB]/5 border border-[#2563EB]/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Wrench className="w-5 h-5 text-[#2563EB] flex-shrink-0 mt-1" />
              <div className="flex-1 text-sm text-gray-300">
                <p className="font-semibold text-[#2563EB] mb-2">Controle de Qualidade (OQC)</p>
                <ul className="list-disc list-inside space-y-1 text-gray-400">
                  <li>Descreva o reparo realizado no aparelho</li>
                  <li>Informe os componentes substituidos</li>
                  <li>Apos salvar, a OS sera movida para OQC</li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-[#2563EB] mb-2">
              Descricao do Reparo Efetuado *
            </label>
            <textarea
              value={reparo}
              onChange={(e) => setReparo(e.target.value)}
              placeholder="Descreva em detalhes o reparo realizado, componentes substituidos, testes realizados..."
              className="neon-input w-full h-48 resize-none"
              required
            />
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={handleClose}
              className="flex-1 px-6 py-3 rounded-lg font-bold transition-all duration-300"
              style={{
                background: 'rgba(107,114,128,0.1)',
                border: '1px solid #6B7280',
                color: '#9CA3AF'
              }}
              disabled={loading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 px-6 py-3 rounded-lg font-bold transition-all duration-300"
              style={{
                background: 'linear-gradient(135deg, rgba(37,99,235,0.2), rgba(37,99,235,0.1))',
                border: '1px solid #2563EB',
                color: '#2563EB'
              }}
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#2563EB] border-t-transparent inline-block mr-2" />
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
