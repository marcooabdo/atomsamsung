import { useState, useEffect } from 'react';
import { X, DollarSign, Upload, Save, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface EditPaymentModalProps {
  isOpen: boolean;
  payment: any;
  onClose: () => void;
  onSuccess: () => void;
}

type FormaPagamento = 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | 'transferencia' | 'boleto' | 'outro';

export function EditPaymentModal({ isOpen, payment, onClose, onSuccess }: EditPaymentModalProps) {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(false);
  const [taxasMaquina, setTaxasMaquina] = useState<any[]>([]);

  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>(payment?.forma_pagamento || 'pix');
  const [valor, setValor] = useState(payment?.valor?.toString() || '');
  const [parcelamento, setParcelamento] = useState(payment?.parcelamento?.toString() || '1');
  const [taxaPercentual, setTaxaPercentual] = useState(payment?.taxa_percentual?.toString() || '0');
  const [taxaPagaPor, setTaxaPagaPor] = useState<'cliente' | 'empresa'>(payment?.taxa_paga_por || 'empresa');
  const [nsu, setNsu] = useState(payment?.nsu || '');
  const [skuMaquininha, setSkuMaquininha] = useState(payment?.sku_maquininha || '');
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [observacoes, setObservacoes] = useState(payment?.observacoes || '');
  const [trocarComprovante, setTrocarComprovante] = useState(false);

  const formasPagamento = [
    { value: 'pix', label: 'PIX', icon: '💳', color: '#00D4FF' },
    { value: 'cartao_credito', label: 'Cartão de Crédito', icon: '💳', color: '#9D4EDD' },
    { value: 'cartao_debito', label: 'Cartão de Débito', icon: '💳', color: '#3b82f6' },
    { value: 'dinheiro', label: 'Dinheiro', icon: '💵', color: '#39FF14' },
    { value: 'transferencia', label: 'Transferência', icon: '🏦', color: '#10b981' },
    { value: 'boleto', label: 'Boleto', icon: '📄', color: '#FFBF00' },
    { value: 'outro', label: 'Outro', icon: '📋', color: '#6B7280' }
  ];

  const isCartao = formaPagamento === 'cartao_credito' || formaPagamento === 'cartao_debito';

  useEffect(() => {
    if (isOpen && payment) {
      setFormaPagamento(payment.forma_pagamento);
      setValor(payment.valor?.toString() || '');
      setParcelamento(payment.parcelamento?.toString() || '1');
      setTaxaPercentual(payment.taxa_percentual?.toString() || '0');
      setTaxaPagaPor(payment.taxa_paga_por || 'empresa');
      setNsu(payment.nsu || '');
      setSkuMaquininha(payment.sku_maquininha || '');
      setObservacoes(payment.observacoes || '');
      setTrocarComprovante(false);
      setComprovante(null);
    }
  }, [isOpen, payment]);

  useEffect(() => {
    const loadTaxasMaquina = async () => {
      if (!payment?.unidade_id) return;

      const { data } = await supabase
        .from('taxas_maquina')
        .select('*')
        .or(`unidade_id.eq.${payment.unidade_id},unidade_id.is.null`)
        .eq('ativo', true)
        .order('parcelamento');

      if (data) {
        setTaxasMaquina(data);
      }
    };

    if (isOpen) {
      loadTaxasMaquina();
    }
  }, [isOpen, payment?.unidade_id]);

  useEffect(() => {
    if (isCartao && taxasMaquina.length > 0) {
      const taxa = taxasMaquina.find(t => t.parcelamento === parseInt(parcelamento));
      if (taxa) {
        if (formaPagamento === 'cartao_credito') {
          setTaxaPercentual(taxa.taxa?.toString() || '0');
        } else if (formaPagamento === 'cartao_debito') {
          setTaxaPercentual(taxa.debito?.toString() || '0');
        }
      }
    } else if (!isCartao) {
      setTaxaPercentual('0');
    }
  }, [isCartao, taxasMaquina, parcelamento, formaPagamento]);

  const handleComprovanteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const maxSize = 10 * 1024 * 1024;

      if (file.size > maxSize) {
        alert('Arquivo muito grande! Tamanho máximo: 10MB');
        return;
      }

      setComprovante(file);
    }
  };

  const calcularTaxaValor = () => {
    const valorNum = parseFloat(valor) || 0;
    const taxaNum = parseFloat(taxaPercentual) || 0;
    return (valorNum * taxaNum) / 100;
  };

  const calcularValorLiquido = () => {
    const valorNum = parseFloat(valor) || 0;
    const taxaValor = calcularTaxaValor();

    if (taxaPagaPor === 'empresa') {
      return valorNum - taxaValor;
    }
    return valorNum;
  };

  const validarFormulario = () => {
    if (!formaPagamento) {
      alert('❌ Selecione a forma de pagamento');
      return false;
    }

    const valorNum = parseFloat(valor);
    if (!valor || isNaN(valorNum) || valorNum <= 0) {
      alert('❌ Digite um valor válido maior que zero');
      return false;
    }

    if (trocarComprovante && !comprovante) {
      alert('❌ Selecione um novo comprovante');
      return false;
    }

    if (isCartao && !nsu.trim()) {
      alert('❌ NSU é obrigatório para pagamentos com cartão');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validarFormulario()) return;

    setLoading(true);

    try {
      let comprovanteUrl = payment.comprovante_url;

      // Se escolheu trocar comprovante, fazer upload do novo
      if (trocarComprovante && comprovante) {
        const fileExt = comprovante.name.split('.').pop();
        const fileName = `${payment.cotacao_id || payment.os_id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('pagamentos-comprovantes')
          .upload(fileName, comprovante);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('pagamentos-comprovantes')
          .getPublicUrl(fileName);

        comprovanteUrl = urlData.publicUrl;
      }

      const valorBruto = parseFloat(valor);
      const taxaValor = calcularTaxaValor();
      const valorLiquido = calcularValorLiquido();

      const { error } = await supabase
        .from('pagamentos')
        .update({
          forma_pagamento: formaPagamento,
          valor: valorBruto,
          valor_bruto: valorBruto,
          valor_liquido: valorLiquido,
          parcelamento: parseInt(parcelamento),
          taxa_percentual: parseFloat(taxaPercentual),
          taxa_valor: taxaValor,
          taxa_paga_por: taxaPagaPor,
          nsu: nsu || null,
          sku_maquininha: skuMaquininha || null,
          comprovante_url: comprovanteUrl,
          observacoes: observacoes || null
        })
        .eq('id', payment.id);

      if (error) throw error;

      alert('✅ Pagamento atualizado com sucesso!');
      onSuccess();
      onClose();
    } catch (error: any) {
      console.error('Erro ao atualizar pagamento:', error);
      alert(`❌ Erro ao atualizar pagamento: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !payment) return null;

  const taxaValor = calcularTaxaValor();
  const valorLiquido = calcularValorLiquido();

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
      <div className="bg-[#0F0F0F] border border-[#00D4FF]/30 rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-[#0F0F0F] border-b border-[#00D4FF]/20 p-6 z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[#00D4FF]/10 rounded-lg">
                <DollarSign className="w-6 h-6 text-[#00D4FF]" />
              </div>
              <h2 className="text-2xl font-bold text-white">Editar Pagamento</h2>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <X className="w-6 h-6 text-gray-400" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-3">
              Forma de Pagamento *
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {formasPagamento.map((forma) => (
                <button
                  key={forma.value}
                  type="button"
                  onClick={() => setFormaPagamento(forma.value as FormaPagamento)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    formaPagamento === forma.value
                      ? 'border-[#00D4FF] bg-[#00D4FF]/10'
                      : 'border-gray-700 hover:border-gray-600'
                  }`}
                >
                  <div className="text-2xl mb-2">{forma.icon}</div>
                  <div className="text-xs text-gray-300 font-medium">{forma.label}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Valor (R$) *
              </label>
              <input
                type="number"
                step="0.01"
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#00D4FF]"
                placeholder="0.00"
              />
            </div>

            {isCartao && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Parcelamento
                </label>
                <select
                  value={parcelamento}
                  onChange={(e) => setParcelamento(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#00D4FF]"
                >
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(n => (
                    <option key={n} value={n}>{n}x</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          {isCartao && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Taxa (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={taxaPercentual}
                    onChange={(e) => setTaxaPercentual(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#00D4FF]"
                    placeholder="0.00"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Taxa paga por
                  </label>
                  <select
                    value={taxaPagaPor}
                    onChange={(e) => setTaxaPagaPor(e.target.value as 'cliente' | 'empresa')}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#00D4FF]"
                  >
                    <option value="empresa">Empresa</option>
                    <option value="cliente">Cliente</option>
                  </select>
                </div>
              </div>

              <div className="premium-card p-4 bg-[#00D4FF]/5">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-gray-400 mb-1">Taxa (R$)</p>
                    <p className="text-[#FF0064] font-bold">R$ {taxaValor.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 mb-1">Valor Líquido</p>
                    <p className="text-[#39FF14] font-bold">R$ {valorLiquido.toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    NSU *
                  </label>
                  <input
                    type="text"
                    value={nsu}
                    onChange={(e) => setNsu(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#00D4FF]"
                    placeholder="Número NSU"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    SKU Maquininha
                  </label>
                  <input
                    type="text"
                    value={skuMaquininha}
                    onChange={(e) => setSkuMaquininha(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#00D4FF]"
                    placeholder="SKU"
                  />
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Comprovante
            </label>

            {!trocarComprovante ? (
              <div className="premium-card p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-500/10 rounded-lg">
                    <Upload className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-sm text-white font-medium">Comprovante atual mantido</p>
                    <p className="text-xs text-gray-400">Clique para trocar o arquivo</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setTrocarComprovante(true)}
                  className="px-4 py-2 bg-[#00D4FF]/10 text-[#00D4FF] rounded-lg hover:bg-[#00D4FF]/20 transition-colors"
                >
                  Trocar
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="premium-card p-4 border-2 border-dashed border-[#00D4FF]/30 hover:border-[#00D4FF]/50 transition-colors">
                  <input
                    type="file"
                    onChange={handleComprovanteChange}
                    accept="image/*,application/pdf"
                    className="hidden"
                    id="edit-comprovante-upload"
                  />
                  <label
                    htmlFor="edit-comprovante-upload"
                    className="cursor-pointer flex flex-col items-center gap-2"
                  >
                    <Upload className="w-8 h-8 text-[#00D4FF]" />
                    <p className="text-sm text-gray-300">
                      {comprovante ? comprovante.name : 'Clique para selecionar novo comprovante'}
                    </p>
                    <p className="text-xs text-gray-500">PDF ou Imagem (máx 10MB)</p>
                  </label>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setTrocarComprovante(false);
                    setComprovante(null);
                  }}
                  className="w-full px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors"
                >
                  Cancelar troca
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Observações
            </label>
            <textarea
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
              className="w-full px-4 py-3 bg-gray-800/50 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-[#00D4FF] resize-none"
              placeholder="Informações adicionais sobre o pagamento..."
            />
          </div>

          <div className="premium-card p-4 bg-yellow-500/5 border border-yellow-500/20">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-200">
                <p className="font-medium mb-1">Atenção ao editar pagamento</p>
                <p className="text-xs text-yellow-300/80">
                  Todas as alterações serão registradas. Se trocar o comprovante, o anterior será substituído.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-[#0F0F0F] border-t border-[#00D4FF]/20 p-6">
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-6 py-3 border border-gray-700 rounded-lg text-white hover:bg-gray-800 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-6 py-3 bg-[#00D4FF] text-black rounded-lg font-bold hover:bg-[#00D4FF]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                  Salvando...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  Salvar Alterações
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
