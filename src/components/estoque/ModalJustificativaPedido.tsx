import { useState } from 'react';
import { X, AlertTriangle, Package } from 'lucide-react';

interface ModalJustificativaPedidoProps {
  requisicao: any;
  idsDisponiveis: number;
  onConfirm: (justificativa: string) => void;
  onCancel: () => void;
}

export function ModalJustificativaPedido({ requisicao, idsDisponiveis, onConfirm, onCancel }: ModalJustificativaPedidoProps) {
  const [justificativa, setJustificativa] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!justificativa.trim() || justificativa.trim().length < 10) {
      alert('A justificativa deve ter no mínimo 10 caracteres');
      return;
    }

    setLoading(true);
    try {
      await onConfirm(justificativa.trim());
    } catch (error) {
      alert('Erro ao criar pedido');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="premium-card max-w-2xl w-full">
        <div className="border-b border-[#FFBF00]/20 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#FFBF00] flex items-center gap-2">
              <AlertTriangle className="w-6 h-6" />
              Justificativa Necessária
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Há IDs disponíveis no estoque. Por que criar novo pedido?
            </p>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-[#FFBF00]/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-[#FFBF00]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="bg-[#FF006410] border border-[#FF006460] rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Package className="w-5 h-5 text-[#FF0064] flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-bold text-[#FF0064] mb-2">
                  ATENÇÃO: {idsDisponiveis} ID(s) DISPONÍVEL(EIS) NO ESTOQUE
                </p>
                <p className="text-xs text-gray-300 mb-3">
                  Peça: {requisicao.descricao} ({requisicao.codigo_peca})
                </p>
                <p className="text-xs text-gray-400">
                  Por padrão, requisições devem ser atendidas com peças do estoque.
                  Criar um novo pedido gera custos adicionais e aumenta o estoque desnecessariamente.
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-[#FFBF00] mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" />
              Por que você está criando um pedido mesmo havendo IDs disponíveis? *
            </label>
            <textarea
              value={justificativa}
              onChange={(e) => setJustificativa(e.target.value)}
              placeholder="Exemplo: IDs disponíveis estão com defeito visual, cliente exige peça nova lacrada..."
              rows={4}
              className="neon-input w-full"
              required
              autoFocus
              minLength={10}
            />
            <p className="text-xs text-gray-500 mt-1">
              Mínimo 10 caracteres. Esta justificativa será registrada no histórico da OS.
            </p>
          </div>

          <div className="bg-[#FFBF00]/10 border border-[#FFBF00]/30 rounded-lg p-4">
            <p className="text-xs text-gray-400">
              <strong className="text-[#FFBF00]">Importante:</strong> Esta ação será registrada no log
              do sistema com sua justificativa. Use este recurso apenas quando realmente necessário.
            </p>
          </div>

          <div className="flex gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 neon-button text-sm py-3"
              style={{
                backgroundColor: '#FF006420',
                color: '#FF0064',
                borderColor: '#FF006460'
              }}
            >
              CANCELAR
            </button>
            <button
              type="submit"
              disabled={loading || justificativa.trim().length < 10}
              className="flex-1 neon-button text-sm py-3"
              style={{
                backgroundColor: 'rgba(var(--accent-rgb), 0.125)',
                color: 'var(--text-accent)',
                borderColor: 'rgba(var(--accent-rgb), 0.38)',
                opacity: loading || justificativa.trim().length < 10 ? 0.5 : 1
              }}
            >
              {loading ? 'CRIANDO PEDIDO...' : 'CONFIRMAR E CRIAR PEDIDO'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
