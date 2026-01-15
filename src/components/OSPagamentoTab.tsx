import { useState, useEffect } from 'react';
import { DollarSign, Download, Eye, CreditCard, User, Calendar, Edit, Send, ThumbsUp, ThumbsDown, Copy, Check, X, AlertTriangle, MessageSquare } from 'lucide-react';
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
  const [pecas, setPecas] = useState<any[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [showPaymentDetailsModal, setShowPaymentDetailsModal] = useState(false);
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false);
  const [paymentToEdit, setPaymentToEdit] = useState<any>(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [textoCopied, setTextoCopied] = useState(false);
  const [processando, setProcessando] = useState(false);
  const [showReprovarModal, setShowReprovarModal] = useState(false);
  const [motivoReprovacao, setMotivoReprovacao] = useState('');

  useEffect(() => {
    loadPagamentos();
    loadPecasServicos();
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
    } finally {
      setLoading(false);
    }
  };

  const loadPecasServicos = async () => {
    const [pecasRes, servicosRes] = await Promise.all([
      supabase.from('cotacoes_pecas').select('pn, descricao, quantidade, valor_final_unitario, valor_total').eq('os_id', osId),
      supabase.from('cotacoes_servicos').select('descricao, quantidade, valor_unitario, valor_total').eq('os_id', osId)
    ]);
    setPecas(pecasRes.data || []);
    setServicos(servicosRes.data || []);
  };

  const getFormaPagamentoLabel = (forma: string) => {
    const labels: Record<string, string> = {
      pix: 'PIX',
      cartao_credito: 'Cartao de Credito',
      cartao_debito: 'Cartao de Debito',
      dinheiro: 'Dinheiro',
      transferencia: 'Transferencia',
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

  const gerarTextoWhatsApp = () => {
    const itensTexto = [...pecas, ...servicos].map(item => {
      const desc = item.descricao || item.pn;
      const qtd = item.quantidade;
      return `- ${desc} (${qtd}x)`;
    }).join('\n');

    const valorTotal = os.valor_total || 0;
    const nomeCliente = os.cliente_nome?.split(' ')[0] || 'Cliente';

    return `Prezado(a) ${nomeCliente},

Segue o orcamento do seu aparelho ${os.aparelho_modelo || 'Samsung'}:

*PECAS/SERVICOS:*
${itensTexto || 'Servicos tecnicos'}

*VALOR TOTAL: R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}*

*FORMAS DE PAGAMENTO:*
- PIX (a vista)
- Cartao de Credito (ate 12x)
- Cartao de Debito
- Dinheiro

O prazo para o servico e de aproximadamente 3 a 5 dias uteis apos a aprovacao do orcamento.

Ficamos no aguardo da sua confirmacao!

Atenciosamente,
Assistencia Tecnica Samsung`;
  };

  const copiarTexto = () => {
    navigator.clipboard.writeText(gerarTextoWhatsApp());
    setTextoCopied(true);
    setTimeout(() => setTextoCopied(false), 3000);
  };

  const handleEnviarOrcamento = async () => {
    setProcessando(true);
    try {
      const valorAtual = os.valor_total || 0;
      const valorInicial = os.valor_orcamento_inicial;
      const versaoAtual = os.versao_orcamento || 1;
      let novaVersao = versaoAtual;

      if (valorInicial !== null && valorInicial !== undefined && valorAtual !== valorInicial) {
        novaVersao = versaoAtual + 1;
      }

      const { error } = await supabase
        .from('os')
        .update({
          orcamento_enviado: true,
          orcamento_enviado_em: new Date().toISOString(),
          orcamento_enviado_por: usuario?.id,
          versao_orcamento: novaVersao,
          valor_orcamento_inicial: valorInicial === null ? valorAtual : valorInicial,
          updated_at: new Date().toISOString()
        })
        .eq('id', osId);

      if (error) throw error;

      await supabase.from('os_comentarios').insert({
        os_id: osId,
        usuario_id: usuario?.id,
        comentario: `Orcamento enviado ao cliente (Versao ${novaVersao}) - Valor: R$ ${valorAtual.toFixed(2)}`,
        is_system: true
      });

      setShowWhatsAppModal(false);
      onUpdate();
      alert('Orcamento marcado como enviado!');
    } catch (error: any) {
      alert(`Erro ao enviar orcamento: ${error.message}`);
    } finally {
      setProcessando(false);
    }
  };

  const handleAprovarOrcamento = async () => {
    if (!confirm('Confirma a APROVACAO do orcamento? A OS sera movida para "Orcamento Aprovado".')) return;

    setProcessando(true);
    try {
      const { error } = await supabase
        .from('os')
        .update({
          coluna_kanban: 'orcamento_aprovado',
          updated_at: new Date().toISOString()
        })
        .eq('id', osId);

      if (error) throw error;

      await supabase.from('os_comentarios').insert({
        os_id: osId,
        usuario_id: usuario?.id,
        comentario: `Orcamento APROVADO pelo cliente - Valor: R$ ${(os.valor_total || 0).toFixed(2)}`,
        is_system: true
      });

      onUpdate();
      alert('Orcamento aprovado! OS movida para "Orcamento Aprovado".');
    } catch (error: any) {
      alert(`Erro ao aprovar orcamento: ${error.message}`);
    } finally {
      setProcessando(false);
    }
  };

  const handleReprovarOrcamento = async () => {
    if (!motivoReprovacao.trim()) {
      alert('Por favor, informe o motivo da reprovacao.');
      return;
    }

    setProcessando(true);
    try {
      const { error } = await supabase
        .from('os')
        .update({
          coluna_kanban: 'orcamentos_rejeitados',
          observacoes_internas: `${os.observacoes_internas || ''}\n\n**ORCAMENTO REPROVADO:** ${motivoReprovacao}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', osId);

      if (error) throw error;

      await supabase.from('os_comentarios').insert({
        os_id: osId,
        usuario_id: usuario?.id,
        comentario: `Orcamento REPROVADO: ${motivoReprovacao}`,
        is_system: true
      });

      setShowReprovarModal(false);
      setMotivoReprovacao('');
      onUpdate();
      alert('Orcamento reprovado. OS movida para "Orcamentos Rejeitados".');
    } catch (error: any) {
      alert(`Erro ao reprovar orcamento: ${error.message}`);
    } finally {
      setProcessando(false);
    }
  };

  const podeGerenciarOrcamento = os.coluna_kanban === 'negociacao_em_andamento' ||
                                  os.coluna_kanban === 'aguardando_aprovacao' ||
                                  os.coluna_kanban === 'diagnostico';

  return (
    <>
      <div className="space-y-4">
        {podeGerenciarOrcamento && (
          <div className="premium-card p-6 bg-gradient-to-r from-[#F59E0B]/10 to-[#00D4FF]/10 border border-[#F59E0B]/30">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/20 flex items-center justify-center border border-[#F59E0B]/40">
                  <MessageSquare className="w-5 h-5 text-[#F59E0B]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-[#F59E0B]">NEGOCIACAO DE ORCAMENTO</h3>
                  <p className="text-xs text-gray-400">Envie, aprove ou reprove o orcamento</p>
                </div>
              </div>
              {os.versao_orcamento > 1 && (
                <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-[#FF0064]/20 text-[#FF0064] border border-[#FF0064]/40 animate-pulse">
                  <AlertTriangle className="w-3 h-3 inline mr-1" />
                  {os.versao_orcamento}o ORCAMENTO
                </span>
              )}
            </div>

            {os.orcamento_enviado && (
              <div className="mb-4 p-3 rounded-lg bg-[#00D4FF]/10 border border-[#00D4FF]/30">
                <p className="text-xs text-[#00D4FF]">
                  <Check className="w-3 h-3 inline mr-1" />
                  Orcamento enviado em {new Date(os.orcamento_enviado_em).toLocaleString('pt-BR')}
                </p>
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <button
                onClick={() => setShowWhatsAppModal(true)}
                disabled={processando}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold text-sm uppercase transition-all"
                style={{
                  backgroundColor: '#25D36620',
                  color: '#25D366',
                  border: '1px solid #25D36660'
                }}
              >
                <Send className="w-4 h-4" />
                {os.orcamento_enviado ? 'Reenviar' : 'Enviar'}
              </button>
              <button
                onClick={handleAprovarOrcamento}
                disabled={processando}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold text-sm uppercase transition-all"
                style={{
                  backgroundColor: '#39FF1420',
                  color: '#39FF14',
                  border: '1px solid #39FF1460'
                }}
              >
                <ThumbsUp className="w-4 h-4" />
                Aprovar
              </button>
              <button
                onClick={() => setShowReprovarModal(true)}
                disabled={processando}
                className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-bold text-sm uppercase transition-all"
                style={{
                  backgroundColor: '#FF006420',
                  color: '#FF0064',
                  border: '1px solid #FF006460'
                }}
              >
                <ThumbsDown className="w-4 h-4" />
                Reprovar
              </button>
            </div>
          </div>
        )}

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
                {os.status_pagamento === 'pago' ? 'Pago 100%' :
                 os.status_pagamento === 'parcial' ? 'Pago Parcial' :
                 'Pendente'}
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
            Historico de Pagamentos ({pagamentos.length})
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
                        Lancado por
                      </p>
                      <p className="text-sm text-gray-300">{pagamento.lancado_por_usuario?.nome}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-400 uppercase mb-1">
                        <User className="w-3 h-3 inline mr-1" />
                        Responsavel
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
                          <span className="text-gray-400">Valor Liquido:</span>
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
                      <p className="text-xs text-gray-400 uppercase mb-1">Observacoes</p>
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

      {showWhatsAppModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="premium-card w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-[#00D4FF]/20">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#25D366]/20 to-[#128C7E]/20 flex items-center justify-center border border-[#25D366]/40">
                  <Send className="w-6 h-6 text-[#25D366]" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#00D4FF]">ENVIAR ORCAMENTO</h2>
                  <p className="text-xs text-gray-400">Copie o texto e envie pelo WhatsApp</p>
                </div>
              </div>
              <button
                onClick={() => setShowWhatsAppModal(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400 uppercase tracking-wider">Cliente</span>
                  <span className="text-sm font-bold text-white">{os.cliente_nome}</span>
                </div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs text-gray-400 uppercase tracking-wider">Aparelho</span>
                  <span className="text-sm text-gray-300">{os.aparelho_modelo || 'Samsung'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400 uppercase tracking-wider">Valor Total</span>
                  <span className="text-lg font-bold text-[#39FF14]">
                    R$ {(os.valor_total || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>

              <div className="premium-card p-4 bg-[#25D366]/5 border border-[#25D366]/20">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-[#25D366] uppercase tracking-wider font-bold">Texto para WhatsApp</span>
                  <button
                    onClick={copiarTexto}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                      textoCopied
                        ? 'bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/40'
                        : 'bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/40 hover:bg-[#25D366]/30'
                    }`}
                  >
                    {textoCopied ? (
                      <>
                        <Check className="w-4 h-4" />
                        COPIADO!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        COPIAR
                      </>
                    )}
                  </button>
                </div>
                <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans leading-relaxed bg-black/30 p-4 rounded-lg border border-gray-800 max-h-[300px] overflow-y-auto">
                  {gerarTextoWhatsApp()}
                </pre>
              </div>
            </div>

            <div className="p-6 border-t border-[#00D4FF]/20 flex gap-3">
              <button
                onClick={() => setShowWhatsAppModal(false)}
                className="flex-1 px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all border border-gray-700 text-gray-400 hover:bg-gray-800/60"
              >
                CANCELAR
              </button>
              <button
                onClick={handleEnviarOrcamento}
                disabled={processando}
                className="flex-1 neon-button flex items-center justify-center gap-2"
                style={{
                  backgroundColor: '#25D36620',
                  color: '#25D366',
                  border: '1px solid #25D36660',
                  boxShadow: '0 0 20px #25D36630'
                }}
              >
                <Send className="w-5 h-5" />
                {processando ? 'PROCESSANDO...' : 'MARCAR COMO ENVIADO'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReprovarModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="premium-card w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-[#FF0064]/20">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-[#FF0064]/20 flex items-center justify-center border border-[#FF0064]/40">
                  <ThumbsDown className="w-6 h-6 text-[#FF0064]" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#FF0064]">REPROVAR ORCAMENTO</h2>
                  <p className="text-xs text-gray-400">Informe o motivo da reprovacao</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowReprovarModal(false);
                  setMotivoReprovacao('');
                }}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="p-6">
              <textarea
                value={motivoReprovacao}
                onChange={(e) => setMotivoReprovacao(e.target.value)}
                placeholder="Digite o motivo da reprovacao..."
                className="w-full h-32 px-4 py-3 bg-black/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#FF0064] focus:outline-none resize-none"
              />
            </div>

            <div className="p-6 border-t border-gray-700 flex gap-3">
              <button
                onClick={() => {
                  setShowReprovarModal(false);
                  setMotivoReprovacao('');
                }}
                className="flex-1 px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all border border-gray-700 text-gray-400 hover:bg-gray-800/60"
              >
                CANCELAR
              </button>
              <button
                onClick={handleReprovarOrcamento}
                disabled={processando || !motivoReprovacao.trim()}
                className="flex-1 px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2"
                style={{
                  backgroundColor: '#FF006420',
                  color: '#FF0064',
                  border: '1px solid #FF006460'
                }}
              >
                <ThumbsDown className="w-5 h-5" />
                {processando ? 'PROCESSANDO...' : 'CONFIRMAR REPROVACAO'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
