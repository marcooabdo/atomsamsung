import { useState } from 'react';
import { X, DollarSign } from 'lucide-react';

interface ModalRegistrarValorGSPNProps {
  requisicao: any;
  onConfirm: (valor: number) => void;
  onCancel: () => void;
}

export function ModalRegistrarValorGSPN({ requisicao, onConfirm, onCancel }: ModalRegistrarValorGSPNProps) {
  const [valorGSPN, setValorGSPN] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const valor = parseFloat(valorGSPN);
    if (isNaN(valor) || valor <= 0) {
      alert('Digite um valor válido');
      return;
    }

    setLoading(true);
    try {
      await onConfirm(valor);
    } catch (error) {
      alert('Erro ao registrar valor');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="premium-card max-w-lg w-full">
        <div className="border-b border-[#FFBF00]/20 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#FFBF00] flex items-center gap-2">
              <DollarSign className="w-6 h-6" />
              Registrar Valor GSPN
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Consulte e registre o valor da peça no sistema GSPN Samsung
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

          <div>
            <label className="block text-sm font-bold text-[#FFBF00] mb-2 flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              Valor da Peça no GSPN (R$) *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={valorGSPN}
              onChange={(e) => setValorGSPN(e.target.value)}
              placeholder="0.00"
              className="neon-input w-full"
              required
              autoFocus
            />
            <p className="text-xs text-gray-500 mt-1">
              Valor unitário consultado no sistema GSPN Samsung
            </p>
          </div>

          <div className="bg-[#00D4FF]/10 border border-[#00D4FF]/30 rounded-lg p-4">
            <p className="text-xs text-gray-400">
              <strong className="text-[#00D4FF]">Importante:</strong> Este valor será usado posteriormente
              ao criar o pedido. Você pode registrar o valor agora e criar o pedido mais tarde.
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
              {loading ? 'SALVANDO...' : 'SALVAR VALOR'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
