import { useState, useEffect } from 'react';
import { DollarSign, Download, Eye, CreditCard, User, Calendar, Edit } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { AddPaymentModal } from './AddPaymentModal';
import { PaymentDetailsModal } from './PaymentDetailsModal';
import { EditPaymentModal } from './EditPaymentModal';

interface OSPagamentoTabProps {
  osId: string;
  os: any;
  onUpdate: () => void;
}

export function OSPagamentoTab({ osId, os, onUpdate }: OSPagamentoTabProps) {
  const { usuario } = useAuth();
  const [pagamentos, setPagamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [showPaymentDetailsModal, setShowPaymentDetailsModal] = useState(false);
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false);
  const [paymentToEdit, setPaymentToEdit] = useState<any>(null);

  useEffect(() => {
    loadPagamentos();
  }, [osId]);

  const loadPagamentos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('pagamentos')
        .select(`
          *,
          lancado_por_usuario:lancado_por(nome),
          responsavel_usuario:responsavel_fechamento(nome)
        `)
        .eq('os_id', osId)
        .order('data_lancamento', { ascending: false });

      if (error) throw error;
      setPagamentos(data || []);
    } catch (error) {
      console.error('Erro ao carregar pagamentos:', error);
    } finally {
      setLoading(false);
    }
  };

  const getFormaPagamentoLabel = (forma: string) => {
    const labels: Record<string, string> = {
      pix: 'PIX',
      cartao_credito: 'Cartão de Crédito',
      cartao_debito: 'Cartão de Débito',
      dinheiro: 'Dinheiro',
      transferencia: 'Transferência',
      boleto: 'Boleto',
      outro: 'Outro'
    };
    return labels[forma] || forma;
  };

  const getFormaPagamentoColor = (forma: string) => {
    const colors: Record<string, string> = {
      pix: '#00D4FF',
      cartao_credito: '#9D4EDD',
      cartao_debito: '#3b82f6',
      dinheiro: '#39FF14',
      transferencia: '#10b981',
      boleto: '#FFBF00',
      outro: '#6B7280'
    };
    return colors[forma] || '#6B7280';
  };

  return (
    <>
      <div className="space-y-4">
        <div className="premium-card p-6 bg-gradient-to-r from-[#39FF14]/5 to-[#00D4FF]/5">
          <div className="grid grid-cols-3 gap-6 mb-4">
            <div>
              <p className="text-xs text-gray-400 uppercase mb-1">Valor Total</p>
              <p className="text-2xl font-bold text-[#00D4FF]">
                R$ {(os.valor_total || 0).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase mb-1">Valor Pago</p>
              <p className="text-2xl font-bold text-[#39FF14]">
                R$ {(os.valor_pago || 0).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase mb-1">Saldo Restante</p>
              <p className="text-2xl font-bold text-[#FFBF00]">
                R$ {((os.saldo_restante) || 0).toFixed(2)}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <span className={`px-4 py-2 rounded-lg text-xs font-bold uppercase ${
                os.status_pagamento === 'pago' ? 'bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/40' :
                os.status_pagamento === 'parcial' ? 'bg-[#FFBF00]/20 text-[#FFBF00] border border-[#FFBF00]/40' :
                'bg-[#FF0064]/20 text-[#FF0064] border border-[#FF0064]/40'
              }`}>
                {os.status_pagamento === 'pago' ? '✓ Pago 100%' :
                 os.status_pagamento === 'parcial' ? '⚠ Pago Parcial' :
                 '○ Pendente'}
              </span>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="neon-button px-6 py-3"
            >
              <DollarSign className="w-4 h-4 inline mr-2" />
              Adicionar Pagamento
            </button>
          </div>
        </div>

        <div>
          <h4 className="text-[#00D4FF] font-bold mb-3 uppercase text-sm flex items-center gap-2">
            <DollarSign className="w-4 h-4" />
            Histórico de Pagamentos ({pagamentos.length})
          </h4>

          {loading ? (
            <p className="text-center text-gray-500 py-8">Carregando pagamentos...</p>
          ) : pagamentos.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Nenhum pagamento registrado ainda</p>
              <p className="text-xs text-gray-600 mt-2">Clique em "Adicionar Pagamento" para registrar o primeiro</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pagamentos.map((pagamento, index) => (
                <div
                  key={pagamento.id}
                  onClick={() => {
                    setSelectedPayment(pagamento);
                    setShowPaymentDetailsModal(true);
                  }}
                  className="premium-card p-5 hover-lift cursor-pointer transition-all hover:border-[#00D4FF]/50"
                  style={{
                    borderLeft: `4px solid ${getFormaPagamentoColor(pagamento.forma_pagamento)}`
                  }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center"
                        style={{
                          backgroundColor: `${getFormaPagamentoColor(pagamento.forma_pagamento)}20`,
                          borderColor: getFormaPagamentoColor(pagamento.forma_pagamento),
                          borderWidth: '2px'
                        }}
                      >
                        <DollarSign
                          className="w-5 h-5"
                          style={{ color: getFormaPagamentoColor(pagamento.forma_pagamento) }}
                        />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-white">
                          R$ {(pagamento.valor_liquido || pagamento.valor).toFixed(2)}
                        </p>
                        <p
                          className="text-xs font-semibold"
                          style={{ color: getFormaPagamentoColor(pagamento.forma_pagamento) }}
                        >
                          {getFormaPagamentoLabel(pagamento.forma_pagamento)}
                          {pagamento.parcelamento && pagamento.parcelamento > 1 && ` - ${pagamento.parcelamento}x`}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {index === 0 && (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#FFBF00]/20 text-[#FFBF00] border border-[#FFBF00]/40">
                          MAIS RECENTE
                        </span>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setPaymentToEdit(pagamento);
                          setShowEditPaymentModal(true);
                        }}
                        className="p-2 hover:bg-[#00D4FF]/20 rounded-lg transition-colors"
                        title="Editar pagamento"
                      >
                        <Edit className="w-4 h-4 text-[#00D4FF]" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4 mb-3">
                    <div>
                      <p className="text-xs text-gray-400 uppercase mb-1">
                        <User className="w-3 h-3 inline mr-1" />
                        Lançado por
                      </p>
                      <p className="text-sm text-gray-300">{pagamento.lancado_por_usuario?.nome}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase mb-1">
                        <User className="w-3 h-3 inline mr-1" />
                        Responsável
                      </p>
                      <p className="text-sm text-gray-300">{pagamento.responsavel_usuario?.nome}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase mb-1">
                        <Calendar className="w-3 h-3 inline mr-1" />
                        Data/Hora
                      </p>
                      <p className="text-sm text-gray-300">
                        {new Date(pagamento.data_lancamento).toLocaleString('pt-BR')}
                      </p>
                    </div>
                    {pagamento.nsu && (
                      <div>
                        <p className="text-xs text-gray-400 uppercase mb-1">
                          <CreditCard className="w-3 h-3 inline mr-1" />
                          NSU
                        </p>
                        <p className="text-sm text-gray-300 font-mono">{pagamento.nsu}</p>
                      </div>
                    )}
                    {pagamento.sku_maquininha && (
                      <div>
                        <p className="text-xs text-gray-400 uppercase mb-1">
                          <CreditCard className="w-3 h-3 inline mr-1" />
                          SKU Maquininha
                        </p>
                        <p className="text-sm text-gray-300 font-mono">{pagamento.sku_maquininha}</p>
                      </div>
                    )}
                  </div>

                  {pagamento.taxa_percentual > 0 && (
                    <div className="mb-3 premium-card p-3 bg-[#FFBF00]/5 border border-[#FFBF00]/20">
                      <p className="text-xs text-gray-400 uppercase mb-2">Detalhes da Taxa</p>
                      <div className="grid grid-cols-3 gap-3 text-sm">
                        <div>
                          <span className="text-gray-400">Valor Bruto:</span>
                          <p className="text-white font-mono">R$ {(pagamento.valor_bruto || pagamento.valor).toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-gray-400">Taxa ({pagamento.taxa_percentual}%):</span>
                          <p className="text-[#FFBF00] font-mono">R$ {(pagamento.taxa_valor || 0).toFixed(2)}</p>
                        </div>
                        <div>
                          <span className="text-gray-400">Valor Líquido:</span>
                          <p className="text-[#39FF14] font-mono font-bold">R$ {(pagamento.valor_liquido || pagamento.valor).toFixed(2)}</p>
                        </div>
                      </div>
                      {pagamento.taxa_paga_por && (
                        <p className="text-xs text-gray-400 mt-2">
                          Taxa paga por: <span className={pagamento.taxa_paga_por === 'empresa' ? 'text-[#FFBF00]' : 'text-[#00D4FF]'}>
                            {pagamento.taxa_paga_por === 'empresa' ? 'Empresa (absorvida)' : 'Cliente (repassada)'}
                          </span>
                        </p>
                      )}
                    </div>
                  )}

                  {pagamento.observacoes && (
                    <div className="mb-3 premium-card p-3 bg-[#00D4FF]/5">
                      <p className="text-xs text-gray-400 uppercase mb-1">Observações</p>
                      <p className="text-sm text-gray-300">{pagamento.observacoes}</p>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <a
                      href={pagamento.comprovante_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 neon-button text-xs px-4 py-2 flex items-center justify-center gap-2"
                    >
                      <Eye className="w-3 h-3" />
                      Ver Comprovante
                    </a>
                    <a
                      href={pagamento.comprovante_url}
                      download
                      className="flex-1 neon-button text-xs px-4 py-2 flex items-center justify-center gap-2 opacity-70 hover:opacity-100"
                    >
                      <Download className="w-3 h-3" />
                      Baixar
                    </a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <AddPaymentModal
          os={os}
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            loadPagamentos();
            onUpdate();
          }}
        />
      )}

      <PaymentDetailsModal
        isOpen={showPaymentDetailsModal}
        onClose={() => {
          setShowPaymentDetailsModal(false);
          setSelectedPayment(null);
        }}
        payment={selectedPayment}
      />

      <EditPaymentModal
        isOpen={showEditPaymentModal}
        payment={paymentToEdit}
        onClose={() => {
          setShowEditPaymentModal(false);
          setPaymentToEdit(null);
        }}
        onSuccess={() => {
          loadPagamentos();
          onUpdate();
        }}
      />
    </>
  );
}
