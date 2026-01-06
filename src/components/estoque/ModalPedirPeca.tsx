import { useState } from 'react';
import { X, Package, FileText } from 'lucide-react';

interface ModalPedirPecaProps {
  requisicao: any;
  onConfirm: (dados: {
    valorEstimado: number;
    numeroPedido: string;
    observacoes: string;
  }) => void;
  onCancel: () => void;
}

export function ModalPedirPeca({ requisicao, onConfirm, onCancel }: ModalPedirPecaProps) {
  const [numeroPedido, setNumeroPedido] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!numeroPedido.trim()) {
      alert('Digite o número do pedido');
      return;
    }

    if (!requisicao.valor_peca) {
      alert('Erro: Valor GSPN não está registrado');
      return;
    }

    const valorNumerico = Number(requisicao.valor_peca);
    if (isNaN(valorNumerico) || valorNumerico <= 0) {
      alert('Erro: Valor GSPN inválido. Por favor, registre o valor correto.');
      return;
    }

    setLoading(true);
    try {
      await onConfirm({
        valorEstimado: valorNumerico,
        numeroPedido: numeroPedido.trim(),
        observacoes
      });
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
              <Package className="w-6 h-6" />
              Criar Pedido de Peça
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Registre o número do pedido Samsung
            </p>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-[#FFBF00]/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-[#FFBF00]" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="bg-[#00D4FF]/10 border border-[#00D4FF]/30 rounded-lg p-4 space-y-2">
            <div>
              <p className="text-xs text-gray-500 uppercase">Descrição</p>
              <p className="text-sm text-gray-200 font-medium">{requisicao.descricao}</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 uppercase">Part Number</p>
                <p className="text-sm text-gray-200 font-mono">{requisicao.codigo_peca}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase">Quantidade</p>
                <p className="text-sm text-gray-200">{requisicao.quantidade_requisitada}</p>
              </div>
            </div>
          </div>

          <div className="bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-lg p-4">
            <div>
              <p className="text-xs text-gray-500 uppercase">Valor GSPN Registrado</p>
              <p className="text-lg font-bold text-[#39FF14]">
                R$ {Number(requisicao.valor_peca || 0).toFixed(2)}
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-bold text-[#FFBF00] mb-2 flex items-center gap-2">
              <Package className="w-4 h-4" />
              Número do Pedido Samsung *
            </label>
            <input
              type="text"
              value={numeroPedido}
              onChange={(e) => setNumeroPedido(e.target.value)}
              placeholder="Ex: PED-123456"
              className="neon-input w-full"
              required
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">
              Número do pedido gerado no sistema Samsung
            </p>
          </div>

          <div>
            <label className="block text-sm font-bold text-[#00D4FF] mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Observações
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              placeholder="Informações adicionais sobre o pedido (opcional)..."
              rows={3}
              className="neon-input w-full"
            />
          </div>

          <div className="bg-[#00D4FF]/10 border border-[#00D4FF]/30 rounded-lg p-4">
            <p className="text-xs text-gray-400">
              <strong className="text-[#00D4FF]">Importante:</strong> Ao criar o pedido, a OS será
              automaticamente movida para a coluna "Peça em Trânsito" no Kanban.
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
              disabled={loading}
              className="flex-1 neon-button text-sm py-3"
              style={{
                backgroundColor: '#39FF1420',
                color: '#39FF14',
                borderColor: '#39FF1460'
              }}
            >
              {loading ? 'CRIANDO...' : 'CRIAR PEDIDO'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
