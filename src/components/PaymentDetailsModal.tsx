import { X, Download, Calendar, User, DollarSign, FileText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useState, useEffect } from 'react';

interface PaymentDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  payment: any;
}

export function PaymentDetailsModal({ isOpen, onClose, payment }: PaymentDetailsModalProps) {
  const [usuario, setUsuario] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (isOpen && payment?.lancado_por) {
      loadUsuario();
    }
  }, [isOpen, payment?.lancado_por]);

  const loadUsuario = async () => {
    try {
      const { data } = await supabase
        .from('usuarios')
        .select('nome')
        .eq('id', payment.lancado_por)
        .maybeSingle();

      setUsuario(data);
    } catch (error) {
      console.error('Erro ao carregar usuário:', error);
    }
  };

  const handleDownload = async () => {
    if (!payment?.comprovante_url) {
      alert('Nenhum comprovante disponível para download');
      return;
    }

    try {
      setLoading(true);

      // Se for uma URL pública, abre em nova aba
      if (payment.comprovante_url.startsWith('http')) {
        window.open(payment.comprovante_url, '_blank');
        return;
      }

      // Caso contrário, tenta baixar do storage
      const { data, error } = await supabase.storage
        .from('pagamentos-comprovantes')
        .download(payment.comprovante_url);

      if (error) throw error;

      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `comprovante-${payment.id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao fazer download:', error);
      alert('Erro ao fazer download do comprovante');
    } finally {
      setLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return {
      date: date.toLocaleDateString('pt-BR'),
      time: date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
    };
  };

  const getFormaPagamentoInfo = (forma: string) => {
    const formas: Record<string, { label: string; color: string; icon: string }> = {
      cartao_credito: { label: 'Cartão de Crédito', color: '#FF0064', icon: '💳' },
      cartao_debito: { label: 'Cartão de Débito', color: '#3b82f6', icon: '💳' },
      dinheiro: { label: 'Dinheiro', color: '#39FF14', icon: '💵' },
      transferencia: { label: 'Transferência', color: '#10b981', icon: '🏦' },
      boleto: { label: 'Boleto', color: '#FFBF00', icon: '📄' },
      outro: { label: 'Outro', color: '#6B7280', icon: '📋' }
    };
    return formas[forma] || formas.outro;
  };

  if (!isOpen || !payment) return null;

  const formaPgtoInfo = getFormaPagamentoInfo(payment.forma_pagamento);
  const dateTime = formatDateTime(payment.created_at);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4">
      <div className="bg-[#0F0F0F] border border-[#00D4FF]/30 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-[#0F0F0F] border-b border-[#00D4FF]/20 p-6 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl"
              style={{
                backgroundColor: `${formaPgtoInfo.color}20`,
                border: `2px solid ${formaPgtoInfo.color}`
              }}
            >
              {formaPgtoInfo.icon}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Detalhes do Pagamento</h2>
              <p className="text-sm text-gray-400" style={{ color: formaPgtoInfo.color }}>
                {formaPgtoInfo.label}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#FF0064]/20 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-[#FF0064]" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="premium-card p-6 bg-gradient-to-r from-[#39FF14]/5 to-[#00D4FF]/5">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-gray-400 uppercase mb-2">Valor Bruto</p>
                <p className="text-3xl font-bold text-white">
                  R$ {(payment.valor_bruto || payment.valor).toFixed(2)}
                </p>
              </div>

              {payment.taxa_valor && payment.taxa_valor > 0 && (
                <div>
                  <p className="text-xs text-gray-400 uppercase mb-2">Valor Líquido</p>
                  <p className="text-3xl font-bold text-[#39FF14]">
                    R$ {payment.valor_liquido.toFixed(2)}
                  </p>
                </div>
              )}
            </div>

            {payment.taxa_valor && payment.taxa_valor > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-700">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-400 uppercase">Taxa</p>
                    <p className="text-lg font-semibold text-[#FF0064]">
                      R$ {payment.taxa_valor.toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase">Taxa %</p>
                    <p className="text-lg font-semibold text-gray-300">
                      {payment.taxa_percentual}%
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="premium-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-[#00D4FF]" />
                <p className="text-xs text-gray-400 uppercase">Data e Hora</p>
              </div>
              <p className="text-lg font-semibold text-white">{dateTime.date}</p>
              <p className="text-sm text-gray-400">{dateTime.time}</p>
            </div>

            <div className="premium-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <User className="w-4 h-4 text-[#39FF14]" />
                <p className="text-xs text-gray-400 uppercase">Lançado Por</p>
              </div>
              <p className="text-lg font-semibold text-white">
                {usuario?.nome || 'Carregando...'}
              </p>
            </div>
          </div>

          {payment.parcelamento && payment.parcelamento > 1 && (
            <div className="premium-card p-4">
              <p className="text-xs text-gray-400 uppercase mb-2">Parcelamento</p>
              <p className="text-lg font-semibold text-white">
                {payment.parcelamento}x de R$ {((payment.valor_bruto || payment.valor) / payment.parcelamento).toFixed(2)}
              </p>
            </div>
          )}

          {payment.nsu && (
            <div className="premium-card p-4">
              <p className="text-xs text-gray-400 uppercase mb-2">NSU</p>
              <p className="text-lg font-mono font-semibold text-white">{payment.nsu}</p>
            </div>
          )}

          {payment.observacoes && (
            <div className="premium-card p-4 bg-[#00D4FF]/5">
              <p className="text-xs text-gray-400 uppercase mb-2">Observações</p>
              <p className="text-sm text-gray-300 whitespace-pre-wrap">{payment.observacoes}</p>
            </div>
          )}

          {payment.comprovante_url && (
            <div className="premium-card p-6 bg-gradient-to-br from-[#FFBF00]/10 to-[#FF0064]/10">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-[#FFBF00]/20 border-2 border-[#FFBF00] flex items-center justify-center">
                    <FileText className="w-6 h-6 text-[#FFBF00]" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">Comprovante Anexado</p>
                    <p className="text-xs text-gray-400">comprovante-pagamento.pdf</p>
                  </div>
                </div>
              </div>

              <button
                onClick={handleDownload}
                disabled={loading}
                className="w-full premium-button-secondary py-3 flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Download className="w-5 h-5" />
                {loading ? 'Baixando...' : 'Fazer Download'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
