import { useState } from 'react';
import { X, CheckCircle, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface AnaliseConcluidaModalProps {
  isOpen: boolean;
  osId: string;
  osNumero: string;
  onClose: () => void;
  onSuccess: () => void;
}

export function AnaliseConcluidaModal({ isOpen, osId, osNumero, onClose, onSuccess }: AnaliseConcluidaModalProps) {
  const { usuario } = useAuth();
  const [analise, setAnalise] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!analise.trim()) {
      alert('Por favor, descreva a análise realizada.');
      return;
    }

    setLoading(true);
    try {
      // Buscar informações da OS para decidir o fluxo
      const { data: osData, error: fetchError } = await supabase
        .from('os')
        .select('tipo_os, tipo_atendimento, is_cortesia')
        .eq('id', osId)
        .maybeSingle();

      if (fetchError) throw fetchError;

      // Determinar a próxima coluna baseado nas regras de negócio
      let proximaColuna = 'negociacao_em_andamento';
      let mensagemMovimentacao = 'OS movida para "Negociacao em Andamento"';

      // Verifica se deve pular a negociação (LP ou OW com cortesia)
      const devePularNegociacao = osData?.tipo_os === 'LP' ||
                                  (osData?.tipo_os === 'OW' && osData?.is_cortesia);

      if (devePularNegociacao) {
        // Define destino baseado no tipo de atendimento
        if (osData?.tipo_atendimento === 'CI') {
          proximaColuna = 'em_reparo_ci';
          mensagemMovimentacao = '✅ OS movida automaticamente para "EM REPARO CI" (Sem necessidade de negociação)';
        } else if (osData?.tipo_atendimento === 'IH') {
          proximaColuna = 'disponivel_ih';
          mensagemMovimentacao = '✅ OS movida automaticamente para "DISPONÍVEL IH" (Sem necessidade de negociação)';
        }
      }

      const { error: comentarioError } = await supabase
        .from('os_comentarios')
        .insert({
          os_id: osId,
          usuario_id: usuario?.id,
          comentario: `**ANÁLISE TÉCNICA CONCLUÍDA:**\n\n${analise.trim()}`,
          is_system: true
        });

      if (comentarioError) throw comentarioError;

      const { error: osError } = await supabase
        .from('os')
        .update({
          coluna_kanban: proximaColuna,
          updated_at: new Date().toISOString()
        })
        .eq('id', osId);

      if (osError) throw osError;

      alert(`Analise registrada!\n\n${mensagemMovimentacao}`);
      onSuccess();
      handleClose();
    } catch (error: any) {
      alert(`Erro ao salvar análise: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setAnalise('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div
        className="premium-card w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#00D4FF]/20">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(0,212,255,0.05) 100%)',
                border: '1px solid rgba(0,212,255,0.3)'
              }}
            >
              <CheckCircle className="w-5 h-5 text-[#00D4FF]" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-[#00D4FF]">Análise Técnica Concluída</h3>
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
          <div className="bg-[#00D4FF]/5 border border-[#00D4FF]/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <FileText className="w-5 h-5 text-[#00D4FF] flex-shrink-0 mt-1" />
              <div className="flex-1 text-sm text-gray-300">
                <p className="font-semibold text-[#00D4FF] mb-2">Instruções:</p>
                <ul className="list-disc list-inside space-y-1 text-gray-400">
                  <li>Descreva detalhadamente o diagnóstico realizado</li>
                  <li>Informe os defeitos encontrados</li>
                  <li>Liste as peças e serviços necessários</li>
                  <li>Após salvar, a OS será movida para "Aguardando Cotação"</li>
                </ul>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-[#00D4FF] mb-2">
              Detalhes da Análise Técnica *
            </label>
            <textarea
              value={analise}
              onChange={(e) => setAnalise(e.target.value)}
              placeholder="Descreva em detalhes a análise realizada, defeitos encontrados, peças necessárias, etc..."
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
              className="flex-1 neon-button px-6 py-3"
              disabled={loading}
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#00D4FF] border-t-transparent inline-block mr-2" />
                  Salvando...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4 inline mr-2" />
                  Concluir Análise
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
