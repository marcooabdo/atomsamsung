import { useState, useEffect, useRef } from 'react';
import { X, DollarSign, Upload, CreditCard, Clock, Save, CheckCircle, FileText, AlertCircle, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface AddPaymentModalProps {
  os: any;
  onClose: () => void;
  onSuccess: () => void;
}

type FormaPagamento = 'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | 'transferencia' | 'boleto' | 'outro';

export function AddPaymentModal({ os, onClose, onSuccess }: AddPaymentModalProps) {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(false);
  const [taxasMaquina, setTaxasMaquina] = useState<any[]>([]);
  const isSubmitting = useRef(false);

  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento>('pix');
  const [valor, setValor] = useState('');
  const [parcelamento, setParcelamento] = useState('1');
  const [taxaPercentual, setTaxaPercentual] = useState('0');
  const [taxaPagaPor, setTaxaPagaPor] = useState<'cliente' | 'empresa'>('empresa');
  const [nsu, setNsu] = useState('');
  const [pixIdTransacao, setPixIdTransacao] = useState('');
  const [skuMaquininha, setSkuMaquininha] = useState('');
  const [comprovante, setComprovante] = useState<File | null>(null);
  const [observacoes, setObservacoes] = useState('');

  const formasPagamento = [
    { value: 'pix', label: 'PIX', icon: '💳', color: 'var(--text-accent)', isAccent: true },
    { value: 'cartao_credito', label: 'Cartão de Crédito', icon: '💳', color: '#9D4EDD', isAccent: false },
    { value: 'cartao_debito', label: 'Cartão de Débito', icon: '💳', color: '#3b82f6', isAccent: false },
    { value: 'dinheiro', label: 'Dinheiro', icon: '💵', color: '#39FF14', isAccent: false },
    { value: 'transferencia', label: 'Transferência', icon: '🏦', color: '#10b981', isAccent: false },
    { value: 'boleto', label: 'Boleto', icon: '📄', color: '#FFBF00', isAccent: false },
    { value: 'outro', label: 'Outro', icon: '📋', color: '#6B7280', isAccent: false }
  ];

  const isCartao = formaPagamento === 'cartao_credito' || formaPagamento === 'cartao_debito';
  const isCredito = formaPagamento === 'cartao_credito';
  const isPix = formaPagamento === 'pix';

  useEffect(() => {
    const loadTaxasMaquina = async () => {
      if (!os.unidade_id) {
        console.warn('⚠️ OS sem unidade_id');
        return;
      }

      console.log('🔍 Carregando taxas para unidade:', os.unidade_id);

      const { data: taxasUnidade, error: errorUnidade } = await supabase
        .from('taxas_maquina')
        .select('*')
        .eq('unidade_id', os.unidade_id)
        .eq('ativo', true)
        .order('parcelamento');

      if (errorUnidade) {
        console.error('❌ Erro ao carregar taxas da unidade:', errorUnidade);
      }

      if (taxasUnidade && taxasUnidade.length > 0) {
        console.log('✅ Taxas da unidade carregadas:', taxasUnidade);
        setTaxasMaquina(taxasUnidade);
        return;
      }

      console.log('⚠️ Nenhuma taxa específica da unidade, buscando taxas globais');

      const { data: taxasGlobais, error: errorGlobais } = await supabase
        .from('taxas_maquina')
        .select('*')
        .is('unidade_id', null)
        .eq('ativo', true)
        .order('parcelamento');

      if (errorGlobais) {
        console.error('❌ Erro ao carregar taxas globais:', errorGlobais);
        return;
      }

      if (taxasGlobais) {
        console.log('✅ Taxas globais carregadas:', taxasGlobais);
        setTaxasMaquina(taxasGlobais);
      }
    };

    loadTaxasMaquina();
  }, [os.unidade_id]);

  useEffect(() => {
    console.log('🔄 Atualizando taxa - isCartao:', isCartao, 'parcelamento:', parcelamento, 'formaPagamento:', formaPagamento);

    if (!isCartao) {
      console.log('ℹ️ Não é cartão, zerando taxa');
      setTaxaPercentual('0');
      return;
    }

    if (taxasMaquina.length === 0) {
      console.log('⚠️ Nenhuma taxa carregada ainda');
      return;
    }

    const parcelaNum = parseInt(parcelamento);
    console.log('🔍 Buscando taxa para', parcelaNum, 'parcelas');
    console.log('📋 Taxas disponíveis:', taxasMaquina.map(t => ({ parc: t.parcelamento, credito: t.taxa, debito: t.debito })));

    const taxa = taxasMaquina.find(t => t.parcelamento === parcelaNum);
    console.log('📌 Taxa encontrada:', taxa);

    if (!taxa) {
      console.log('❌ Taxa não encontrada para', parcelaNum, 'parcelas');
      setTaxaPercentual('0');
      return;
    }

    if (formaPagamento === 'cartao_credito') {
      const taxaValor = Number(taxa.taxa || 0);
      console.log('💳 Aplicando taxa CRÉDITO:', taxaValor, '%');
      setTaxaPercentual(taxaValor.toString());
    } else if (formaPagamento === 'cartao_debito') {
      const taxaValor = Number(taxa.debito || 0);
      console.log('💳 Aplicando taxa DÉBITO:', taxaValor, '%');
      setTaxaPercentual(taxaValor.toString());
    }
  }, [isCartao, taxasMaquina, parcelamento, formaPagamento]);

  const handleComprovanteChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const maxSize = 10 * 1024 * 1024; // 10MB

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
      alert('Selecione a forma de pagamento');
      return false;
    }

    const valorNum = parseFloat(valor);
    if (!valor || isNaN(valorNum) || valorNum <= 0) {
      alert('Digite um valor valido maior que zero');
      return false;
    }

    if (isCartao && !nsu.trim()) {
      alert('NSU e obrigatorio para pagamentos com cartao');
      return false;
    }

    if (isPix && !pixIdTransacao.trim() && !nsu.trim()) {
      alert('Informe o ID da transacao ou NSU para pagamentos PIX');
      return false;
    }

    const parcelaNum = parseInt(parcelamento);
    if (isCartao && parcelaNum > 1 && parseFloat(taxaPercentual) === 0) {
      alert('Taxa de cartao e obrigatoria para pagamentos parcelados');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    if (!validarFormulario()) return;

    if (isSubmitting.current || loading) {
      return;
    }

    isSubmitting.current = true;
    setLoading(true);

    try {
      let comprovanteUrl = null;

      if (comprovante) {
        const fileName = `pagamento_${os.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const { error: uploadError } = await supabase.storage
          .from('pagamentos-comprovantes')
          .upload(fileName, comprovante);

        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage
          .from('pagamentos-comprovantes')
          .getPublicUrl(fileName);

        comprovanteUrl = publicUrl;
      }

      const cotacao = os.cotacoes?.find((c: any) => c.status === 'aprovada');

      const valorBruto = parseFloat(valor);
      const taxaValor = calcularTaxaValor();
      const valorLiquido = calcularValorLiquido();

      const { error: paymentError } = await supabase
        .from('pagamentos')
        .insert({
          os_id: os.id,
          cotacao_id: cotacao?.id || null,
          unidade_id: os.unidade_id,
          forma_pagamento: formaPagamento,
          valor: valorBruto,
          valor_bruto: valorBruto,
          valor_liquido: valorLiquido,
          parcelamento: isCredito ? parseInt(parcelamento) : 1,
          taxa_percentual: parseFloat(taxaPercentual),
          taxa_valor: taxaValor,
          taxa_paga_por: isCartao && parseFloat(taxaPercentual) > 0 ? taxaPagaPor : null,
          nsu: isCartao ? nsu.trim() : (isPix && nsu.trim() ? nsu.trim() : null),
          pix_id_transacao: isPix ? pixIdTransacao.trim() || null : null,
          comprovante_url: comprovanteUrl,
          sku_maquininha: null,
          observacoes: observacoes.trim() || null,
          lancado_por: usuario?.id,
          responsavel_fechamento: usuario?.id,
          data_lancamento: new Date().toISOString()
        });

      if (paymentError) {
        if (paymentError.message.includes('SKU')) {
          alert(paymentError.message);
        } else {
          throw paymentError;
        }
        return;
      }

      await supabase.from('os_comentarios').insert({
        os_id: os.id,
        usuario_id: usuario?.id,
        comentario: `Pagamento de R$ ${valorBruto.toFixed(2)} recebido via ${formasPagamento.find(f => f.value === formaPagamento)?.label}. Lancado por ${usuario?.nome}.`,
        is_system: true
      });

      alert('Pagamento registrado com sucesso!');
      onSuccess();
      onClose();
    } catch (error: any) {
      alert(`Erro ao registrar pagamento: ${error.message}`);
      isSubmitting.current = false;
    } finally {
      setLoading(false);
      isSubmitting.current = false;
    }
  };

  const getFormaPagamentoAtual = () => {
    return formasPagamento.find(f => f.value === formaPagamento);
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="premium-card w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-[#39FF14]/20 bg-gradient-to-r from-[#39FF14]/5 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#39FF14]/20 to-[#00D4FF]/20 flex items-center justify-center border-2 border-[#39FF14]/30">
                <DollarSign className="w-7 h-7 text-[#39FF14]" style={{ filter: 'drop-shadow(0 0 8px rgba(57, 255, 20, 0.6))' }} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[#39FF14]" style={{ textShadow: '0 0 20px rgba(57, 255, 20, 0.5)' }}>
                  REGISTRAR PAGAMENTO
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  OS: <span className="text-[#00D4FF] font-mono">{os.numero_os_samsung || os.numero_os_interna || 'S/N'}</span>
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-all"
            >
              <X className="w-6 h-6 text-gray-400 hover:text-white" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto cyber-scrollbar p-6">
          <div className="space-y-6">
            {/* Resumo da OS */}
            <div className="premium-card p-5 bg-gradient-to-br from-[#00D4FF]/10 to-transparent border-2 border-[#00D4FF]/30">
              <div className="grid grid-cols-3 gap-6">
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Cliente</p>
                  <p className="text-white font-bold text-lg">{os.cliente_nome}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Valor Total da OS</p>
                  <p className="text-[#00D4FF] font-bold text-2xl" style={{ textShadow: '0 0 20px rgba(var(--accent-rgb), 0.5)' }}>
                    R$ {(os.valor_total || 0).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Saldo Restante</p>
                  <p className="text-[#FFBF00] font-bold text-2xl" style={{ textShadow: '0 0 20px rgba(255, 191, 0, 0.5)' }}>
                    R$ {(os.saldo_restante || os.valor_total || 0).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>

            {/* Forma de Pagamento */}
            <div>
              <label className="block text-sm font-bold text-[#00D4FF] uppercase mb-3 tracking-wider">
                Forma de Pagamento *
              </label>
              <div className="grid grid-cols-4 gap-3">
                {formasPagamento.map(forma => (
                  <button
                    key={forma.value}
                    type="button"
                    onClick={() => setFormaPagamento(forma.value as FormaPagamento)}
                    className={`p-4 rounded-xl border-2 transition-all ${
                      formaPagamento === forma.value
                        ? 'border-[#00D4FF] bg-[#00D4FF]/20 scale-105'
                        : 'border-gray-700 bg-black/30 hover:border-gray-500'
                    }`}
                    style={formaPagamento === forma.value ? {
                      boxShadow: forma.isAccent
                        ? '0 0 30px rgba(var(--accent-rgb), 0.25)'
                        : `0 0 30px ${forma.color}40`
                    } : {}}
                  >
                    <div className="text-3xl mb-2">{forma.icon}</div>
                    <p className={`text-xs font-bold uppercase ${
                      formaPagamento === forma.value ? 'text-[#00D4FF]' : 'text-gray-400'
                    }`}>
                      {forma.label}
                    </p>
                  </button>
                ))}
              </div>
            </div>

            {/* Valor */}
            <div>
              <label className="block text-sm font-bold text-[#39FF14] uppercase mb-3 tracking-wider">
                Valor do Pagamento *
              </label>
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-[#39FF14]" />
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="0,00"
                  className="neon-input pl-14 text-2xl font-bold"
                  style={{ height: '60px' }}
                />
              </div>
            </div>

            {/* Parcelamento - Só para Crédito */}
            {isCredito && (
              <div>
                <label className="block text-sm font-bold text-[#9D4EDD] uppercase mb-3 tracking-wider">
                  <CreditCard className="w-4 h-4 inline mr-2" />
                  Parcelamento
                </label>
                <select
                  value={parcelamento}
                  onChange={(e) => setParcelamento(e.target.value)}
                  className="neon-input"
                >
                  <option value="1">À vista (1x)</option>
                  {[...Array(12)].map((_, i) => (
                    <option key={i + 2} value={i + 2}>{i + 2}x</option>
                  ))}
                </select>
              </div>
            )}

            {/* Campos específicos para Cartão */}
            {isCartao && (
              <div className="premium-card p-6 bg-gradient-to-br from-[#FFBF00]/10 to-transparent border-2 border-[#FFBF00]/30 space-y-5">
                <h3 className="text-sm font-bold text-[#FFBF00] uppercase tracking-wider flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Informações do Cartão
                </h3>

                <div className="mb-4">
                  <label className="block text-xs text-gray-400 uppercase mb-2 tracking-wider">
                    NSU da Transação *
                  </label>
                  <input
                    type="text"
                    value={nsu}
                    onChange={(e) => setNsu(e.target.value)}
                    placeholder="Ex: 123456789"
                    className="neon-input font-mono"
                  />
                  <p className="text-xs text-gray-500 mt-2">
                    Número sequencial único da transação do cartão
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-400 uppercase mb-2 tracking-wider">
                        Taxa de Cartão (%) {taxasMaquina.length > 0 && '- Automático'}
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={taxaPercentual}
                          onChange={(e) => setTaxaPercentual(e.target.value)}
                          readOnly={taxasMaquina.length > 0}
                          className={`neon-input ${taxasMaquina.length > 0 ? 'bg-gray-900/50 cursor-not-allowed' : ''}`}
                        />
                        {parseFloat(taxaPercentual) > 0 && (
                          <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#FFBF00] font-bold">
                            {taxaPercentual}%
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-gray-400 uppercase mb-2 tracking-wider">
                        Quem Paga a Taxa?
                      </label>
                      <select
                        value={taxaPagaPor}
                        onChange={(e) => setTaxaPagaPor(e.target.value as 'cliente' | 'empresa')}
                        className="neon-input"
                        disabled={parseFloat(taxaPercentual) === 0}
                      >
                        <option value="empresa">🏢 Empresa absorve</option>
                        <option value="cliente">👤 Cliente paga</option>
                      </select>
                    </div>
                  </div>

                  {parseFloat(taxaPercentual) > 0 && parseFloat(valor) > 0 && (
                    <div className="premium-card p-4 bg-gradient-to-br from-[#FFBF00]/20 to-transparent border-2 border-[#FFBF00]/40">
                      <div className="grid grid-cols-3 gap-4 text-center">
                        <div>
                          <p className="text-xs text-gray-400 uppercase mb-1">Taxa (%)</p>
                          <p className="text-[#FFBF00] font-bold text-xl" style={{ textShadow: '0 0 10px rgba(255, 191, 0, 0.5)' }}>
                            {taxaPercentual}%
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase mb-1">Desconto (R$)</p>
                          <p className="text-[#FF0064] font-bold text-xl" style={{ textShadow: '0 0 10px rgba(255, 0, 100, 0.5)' }}>
                            - R$ {calcularTaxaValor().toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase mb-1">Você Recebe</p>
                          <p className="text-[#39FF14] font-bold text-xl" style={{ textShadow: '0 0 10px rgba(57, 255, 20, 0.5)' }}>
                            R$ {calcularValorLiquido().toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {parseFloat(taxaPercentual) > 0 && taxaPagaPor === 'empresa' && parseFloat(valor) > 0 && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-[#FFBF00]/10 border border-[#FFBF00]/30">
                      <AlertCircle className="w-4 h-4 text-[#FFBF00] flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-[#FFBF00]">
                        A empresa absorverá R$ {calcularTaxaValor().toFixed(2)} de taxa, reduzindo o lucro desta OS
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Campos especificos para PIX */}
            {isPix && (
              <div className="premium-card p-6 bg-gradient-to-br from-[#00D4FF]/10 to-transparent border-2 border-[#00D4FF]/30 space-y-5">
                <h3 className="text-sm font-bold text-[#00D4FF] uppercase tracking-wider flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Informacoes do PIX
                </h3>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-2 tracking-wider">
                      ID da Transacao *
                    </label>
                    <input
                      type="text"
                      value={pixIdTransacao}
                      onChange={(e) => setPixIdTransacao(e.target.value)}
                      placeholder="Ex: E00000000202401151234..."
                      className="neon-input font-mono"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      ID da transacao PIX (End-to-End ID)
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-2 tracking-wider">
                      NSU (opcional)
                    </label>
                    <input
                      type="text"
                      value={nsu}
                      onChange={(e) => setNsu(e.target.value)}
                      placeholder="Ex: 123456789"
                      className="neon-input font-mono"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Numero sequencial unico (se disponivel)
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Comprovante */}
            <div>
              <label className="block text-sm font-bold text-[#FF0064] uppercase mb-3 tracking-wider">
                <Upload className="w-4 h-4 inline mr-2" />
                Comprovante de Pagamento (opcional)
              </label>

              {!comprovante ? (
                <label className="block cursor-pointer">
                  <div className="premium-card p-8 border-2 border-dashed border-[#FF0064]/40 hover:border-[#FF0064] bg-[#FF0064]/5 hover:bg-[#FF0064]/10 transition-all text-center">
                    <Upload className="w-12 h-12 text-[#FF0064] mx-auto mb-3" />
                    <p className="text-[#FF0064] font-bold mb-1">Clique para selecionar arquivo</p>
                    <p className="text-xs text-gray-500">Imagens ou PDF • Máximo 10MB</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={handleComprovanteChange}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="premium-card p-5 bg-gradient-to-br from-[#39FF14]/10 to-transparent border-2 border-[#39FF14]/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg bg-[#39FF14]/20 flex items-center justify-center">
                        <FileText className="w-6 h-6 text-[#39FF14]" />
                      </div>
                      <div>
                        <p className="text-[#39FF14] font-bold flex items-center gap-2">
                          <CheckCircle className="w-4 h-4" />
                          Arquivo Anexado
                        </p>
                        <p className="text-sm text-gray-400 mt-1">{comprovante.name}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {(comprovante.size / 1024).toFixed(2)} KB
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => setComprovante(null)}
                      className="p-2 hover:bg-[#FF0064]/20 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-5 h-5 text-[#FF0064]" />
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Observações */}
            <div>
              <label className="block text-sm font-bold text-[#00D4FF] uppercase mb-3 tracking-wider">
                Observações (opcional)
              </label>
              <textarea
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
                placeholder="Informações adicionais sobre o pagamento..."
                className="neon-input h-24 resize-none"
              />
            </div>

            {/* Resumo do Lançamento */}
            <div className="premium-card p-5 bg-[#00D4FF]/5 border border-[#00D4FF]/20">
              <div className="flex items-start gap-3">
                <Clock className="w-5 h-5 text-[#00D4FF] flex-shrink-0 mt-1" />
                <div className="space-y-2 text-sm">
                  <p className="text-gray-400 font-semibold uppercase tracking-wider text-xs">Informações do Lançamento</p>
                  <p className="text-white">
                    <strong className="text-[#00D4FF]">Data/Hora:</strong> {new Date().toLocaleString('pt-BR')}
                  </p>
                  <p className="text-white">
                    <strong className="text-[#00D4FF]">Lançado por:</strong> {usuario?.nome}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-[#39FF14]/20 bg-gradient-to-r from-[#39FF14]/5 to-transparent">
          <div className="flex gap-4">
            <button
              onClick={onClose}
              disabled={loading}
              className="flex-1 px-6 py-4 rounded-xl border-2 border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 transition-all font-bold uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancelar
            </button>
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 px-6 py-4 rounded-xl font-bold uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                backgroundColor: '#39FF1420',
                borderWidth: '2px',
                borderStyle: 'solid',
                borderColor: '#39FF14',
                color: '#39FF14',
                boxShadow: '0 0 30px rgba(57, 255, 20, 0.4)'
              }}
            >
              {loading ? (
                <span className="flex items-center justify-center gap-3">
                  <Clock className="w-5 h-5 animate-spin" />
                  Processando...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-3">
                  <Save className="w-5 h-5" />
                  Registrar Pagamento
                </span>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
