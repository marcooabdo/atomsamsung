import { useState, useEffect } from 'react';
import { DollarSign, Download, Eye, CreditCard, User, Calendar, CreditCard as Edit, Send, ThumbsUp, ThumbsDown, Copy, Check, X, AlertTriangle, MessageSquare, Percent, Tag, UserCheck, ChevronDown, Crown, Lock, Search, RefreshCw } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { AddPaymentModal } from './AddPaymentModal';
import { PaymentDetailsModal } from './PaymentDetailsModal';
import { EditPaymentModal } from './EditPaymentModal';
import { SuccessModal } from './SuccessModal';

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
  const [descontoTipo, setDescontoTipo] = useState<'valor' | 'percentual'>(os.desconto_tipo || 'valor');
  const [descontoValor, setDescontoValor] = useState<string>(os.desconto_valor?.toString() || '');
  const [salvandoDesconto, setSalvandoDesconto] = useState(false);
  const [approvalLink, setApprovalLink] = useState<string>('');
  const [linkCopied, setLinkCopied] = useState(false);
  const [gerandoLink, setGerandoLink] = useState(false);
  const [linkExpiresAt, setLinkExpiresAt] = useState<string | null>(null);
  const [carregandoLink, setCarregandoLink] = useState(false);
  const [usuariosUnidade, setUsuariosUnidade] = useState<any[]>([]);
  const [vendedorResponsavel, setVendedorResponsavel] = useState<string | null>(os.vendedor_responsavel_id || null);
  const [salvandoVendedor, setSalvandoVendedor] = useState(false);
  const [showVendedorDropdown, setShowVendedorDropdown] = useState(false);
  const [vendedorSearch, setVendedorSearch] = useState('');
  const [showAprovarModal, setShowAprovarModal] = useState(false);
  const [showReprovarSuccessModal, setShowReprovarSuccessModal] = useState(false);
  const [showConfirmAprovarModal, setShowConfirmAprovarModal] = useState(false);

  const podeEditarVendedor = () => {
    if (!os.vendedor_responsavel_id) return true;
    if (!usuario) return false;
    return ['master', 'diretoria', 'gerente'].includes(usuario.tipo);
  };

  useEffect(() => {
    loadPagamentos();
    loadUsuariosUnidade();
  }, [osId]);

  useEffect(() => {
    setVendedorResponsavel(os.vendedor_responsavel_id || null);
  }, [os.vendedor_responsavel_id, os.updated_at]);

  const loadUsuariosUnidade = async () => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome, tipo, unidade_id')
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;

      const filtrados = (data || []).filter(u => {
        if (!os.unidade_id) return true;
        return u.unidade_id === os.unidade_id || !u.unidade_id;
      });

      setUsuariosUnidade(filtrados);
    } catch (error) {
      console.error('Erro ao carregar usuarios:', error);
    }
  };

  const handleSalvarVendedorResponsavel = async (novoVendedorId: string | null) => {
    console.log('=== SALVANDO VENDEDOR ===');
    console.log('osId:', osId);
    console.log('novoVendedorId:', novoVendedorId);
    console.log('os.vendedor_responsavel_id atual:', os.vendedor_responsavel_id);
    console.log('podeEditarVendedor():', podeEditarVendedor());

    if (!podeEditarVendedor() && os.vendedor_responsavel_id) {
      alert('Somente gerentes, diretoria ou master podem alterar o vendedor responsavel.');
      return;
    }

    setSalvandoVendedor(true);
    setShowVendedorDropdown(false);
    setVendedorResponsavel(novoVendedorId);

    try {
      const vendedorAnteriorId = os.vendedor_responsavel_id;
      const vendedorAnterior = usuariosUnidade.find(u => u.id === vendedorAnteriorId);
      const vendedorNovo = usuariosUnidade.find(u => u.id === novoVendedorId);

      console.log('Executando update...');
      const { data, error: updateError } = await supabase
        .from('os')
        .update({
          vendedor_responsavel_id: novoVendedorId,
          vendedor_responsavel_definido_em: new Date().toISOString(),
          vendedor_responsavel_definido_por: usuario?.id || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', osId)
        .select();

      console.log('Resultado update:', { data, error: updateError });

      if (updateError) {
        setVendedorResponsavel(vendedorAnteriorId || null);
        throw updateError;
      }

      let comentario = '';
      if (novoVendedorId === null) {
        comentario = vendedorAnterior
          ? `Vendedor responsavel removido (era: ${vendedorAnterior.nome})`
          : 'Vendedor responsavel removido';
      } else if (vendedorAnterior) {
        comentario = `Vendedor responsavel alterado de ${vendedorAnterior.nome} para ${vendedorNovo?.nome || 'Desconhecido'}`;
      } else {
        comentario = `Vendedor responsavel definido: ${vendedorNovo?.nome || 'Desconhecido'}`;
      }

      console.log('Inserindo comentario:', comentario);
      const { error: commentError } = await supabase.from('os_comentarios').insert({
        os_id: osId,
        usuario_id: usuario?.id || null,
        comentario,
        is_system: true
      });

      if (commentError) {
        console.error('Erro ao inserir comentario:', commentError);
      }

      console.log('Sucesso! Chamando onUpdate...');
      onUpdate();
    } catch (error: any) {
      console.error('Erro ao salvar vendedor:', error);
      alert(`Erro ao salvar vendedor: ${error.message}`);
    } finally {
      setSalvandoVendedor(false);
    }
  };

  useEffect(() => {
    if (os) {
      loadPecasServicos();
    }
  }, [osId, os?.tipo_orcamento]);

  useEffect(() => {
    setDescontoTipo(os.desconto_tipo || 'valor');
    setDescontoValor(os.desconto_valor?.toString() || '');
  }, [os.desconto_tipo, os.desconto_valor]);

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
    const isSCACC = os?.tipo_orcamento === 'samsung_contigo' || os?.tipo_orcamento === 'acessorios';

    // Carregar peças de ambas as tabelas
    const [pecasCotacaoRes, pecasOSRes] = await Promise.all([
      supabase.from('cotacoes_pecas').select('pn, descricao, quantidade, valor_final_unitario, valor_total').eq('os_id', osId),
      supabase.from('os_pecas').select('pn, descricao, quantidade, valor_unitario, valor_total').eq('os_id', osId)
    ]);

    // Combinar peças normalizando os campos
    const pecasCotacao = (pecasCotacaoRes.data || []).map(p => ({
      ...p,
      valor_unitario: p.valor_final_unitario,
      valor_total: p.valor_total
    }));

    const pecasOS = (pecasOSRes.data || []).map(p => ({
      ...p,
      valor_total: p.valor_total
    }));

    const todasPecas = [...pecasCotacao, ...pecasOS];

    // Carregar serviços da tabela correta baseado no tipo de OS
    let servicosData: any[] = [];
    if (isSCACC) {
      const { data } = await supabase
        .from('os_servicos')
        .select('descricao, quantidade, valor_unitario, valor_total')
        .eq('os_id', osId);
      servicosData = data || [];
    } else {
      const { data } = await supabase
        .from('cotacoes_servicos')
        .select('descricao, quantidade, valor_unitario, valor_total')
        .eq('os_id', osId);
      servicosData = data || [];
    }

    setPecas(todasPecas);
    setServicos(servicosData);
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

    const valorTotal = calcularValorFinal();
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
          coluna_kanban: 'negociacao_em_andamento',
          orcamento_pendente_reenvio: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', osId);

      if (error) throw error;

      await supabase
        .from('os_pecas')
        .update({ alerta_preco_nf: false, valor_anterior_nf: null })
        .eq('os_id', osId);

      await supabase.from('os_comentarios').insert({
        os_id: osId,
        usuario_id: usuario?.id,
        comentario: `Orçamento enviado ao cliente (Versão ${novaVersao}) - Valor: R$ ${valorAtual.toFixed(2)}`,
        is_system: true
      });

      try {
        const response = await fetch('https://fiberless-uncourageously-lesli.ngrok-free.dev/webhook/enviar-orcamento', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ os_id: osId }),
        });

        if (response.ok) {
          console.log('GIA acionada! O cliente receberá o link no WhatsApp.');
        } else {
          console.error('Erro GIA:', await response.text());
        }
      } catch (webhookError) {
        console.error('Erro ao acionar GIA:', webhookError);
      }

      setShowWhatsAppModal(false);
      onUpdate();
      alert('Orçamento marcado como enviado!');
    } catch (error: any) {
      alert(`Erro ao enviar orçamento: ${error.message}`);
    } finally {
      setProcessando(false);
    }
  };

  const carregarLinkExistente = async () => {
    setCarregandoLink(true);
    try {
      const { data } = await supabase
        .from('orcamento_links')
        .select('token, expires_at, status')
        .eq('os_id', osId)
        .eq('ativo', true)
        .eq('status', 'pendente')
        .order('created_at', { ascending: false })
        .maybeSingle();

      if (data?.token) {
        if (data.expires_at && new Date(data.expires_at) < new Date()) {
          setApprovalLink('');
          setLinkExpiresAt(null);
          return;
        }
        const baseUrl = window.location.origin;
        setApprovalLink(`${baseUrl}/orcamento/${data.token}`);
        setLinkExpiresAt(data.expires_at);
      } else {
        setApprovalLink('');
        setLinkExpiresAt(null);
      }
    } catch {
      setApprovalLink('');
      setLinkExpiresAt(null);
    } finally {
      setCarregandoLink(false);
    }
  };

  const gerarLinkAprovacao = async () => {
    setGerandoLink(true);
    try {
      const { data, error } = await supabase
        .rpc('upsert_orcamento_link', { p_os_id: osId });

      if (error) throw error;

      if (data && data.length > 0) {
        const token = data[0].token;
        const expiresAt = data[0].expires_at;
        const baseUrl = window.location.origin;
        const link = `${baseUrl}/orcamento/${token}`;
        setApprovalLink(link);
        setLinkExpiresAt(expiresAt);
        onUpdate();
        return link;
      }
    } catch (error: any) {
      alert(`Erro ao gerar link: ${error.message}`);
    } finally {
      setGerandoLink(false);
    }
  };

  const copiarLink = () => {
    if (approvalLink) {
      navigator.clipboard.writeText(approvalLink);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 3000);
    }
  };

  useEffect(() => {
    if (showWhatsAppModal) {
      setLinkCopied(false);
      carregarLinkExistente();
    }
  }, [showWhatsAppModal]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (showVendedorDropdown && !target.closest('[data-vendedor-dropdown]')) {
        setShowVendedorDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showVendedorDropdown]);

  const handleAprovarOrcamento = () => {
    setShowConfirmAprovarModal(true);
  };

  const confirmarAprovacao = async () => {
    setShowConfirmAprovarModal(false);
    setProcessando(true);
    try {
      const valorAtual = os.valor_total || 0;
      const versaoAtual = os.versao_orcamento || 1;

      const { error } = await supabase
        .from('os')
        .update({
          coluna_kanban: 'orcamento_aprovado',
          orcamento_aprovado_em: new Date().toISOString(),
          orcamento_aprovado_por: usuario?.id,
          valor_quando_aprovado: valorAtual,
          versao_quando_aprovado: versaoAtual,
          bloqueio_movimentacao_automatica: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', osId);

      if (error) throw error;

      await supabase.from('os_comentarios').insert({
        os_id: osId,
        usuario_id: usuario?.id,
        comentario: `Orçamento APROVADO pelo cliente - Valor: R$ ${valorAtual.toFixed(2)}`,
        is_system: true
      });

      onUpdate();
      setShowAprovarModal(true);
    } catch (error: any) {
      alert(`Erro ao aprovar orçamento: ${error.message}`);
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
          orcamento_reprovado_em: new Date().toISOString(),
          orcamento_reprovado_por: usuario?.id,
          observacoes_internas: `${os.observacoes_internas || ''}\n\n**ORÇAMENTO REPROVADO:** ${motivoReprovacao}`,
          updated_at: new Date().toISOString()
        })
        .eq('id', osId);

      if (error) throw error;

      await supabase.from('os_comentarios').insert({
        os_id: osId,
        usuario_id: usuario?.id,
        comentario: `Orçamento REPROVADO: ${motivoReprovacao}`,
        is_system: true
      });

      setShowReprovarModal(false);
      setMotivoReprovacao('');
      onUpdate();
      setShowReprovarSuccessModal(true);
    } catch (error: any) {
      alert(`Erro ao reprovar orçamento: ${error.message}`);
    } finally {
      setProcessando(false);
    }
  };

  const handleSalvarDesconto = async () => {
    setSalvandoDesconto(true);
    try {
      const valorNumerico = parseFloat(descontoValor.replace(',', '.')) || 0;

      if (descontoTipo === 'percentual' && valorNumerico > 100) {
        alert('O desconto percentual nao pode ser maior que 100%');
        return;
      }

      const valorBruto = calcularSubtotal();
      if (descontoTipo === 'valor' && valorNumerico > valorBruto) {
        alert('O desconto em valor nao pode ser maior que o valor total');
        return;
      }

      const { error } = await supabase
        .from('os')
        .update({
          desconto_tipo: valorNumerico > 0 ? descontoTipo : null,
          desconto_valor: valorNumerico,
          updated_at: new Date().toISOString()
        })
        .eq('id', osId);

      if (error) throw error;

      await supabase.from('os_comentarios').insert({
        os_id: osId,
        usuario_id: usuario?.id,
        comentario: valorNumerico > 0
          ? `Desconto aplicado: ${descontoTipo === 'percentual' ? `${valorNumerico}%` : `R$ ${valorNumerico.toFixed(2)}`}`
          : 'Desconto removido',
        is_system: true
      });

      onUpdate();
    } catch (error: any) {
      alert(`Erro ao salvar desconto: ${error.message}`);
    } finally {
      setSalvandoDesconto(false);
    }
  };

  const handleRemoverDesconto = async () => {
    setSalvandoDesconto(true);
    try {
      const { error } = await supabase
        .from('os')
        .update({
          desconto_tipo: null,
          desconto_valor: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', osId);

      if (error) throw error;

      setDescontoValor('');
      setDescontoTipo('valor');

      await supabase.from('os_comentarios').insert({
        os_id: osId,
        usuario_id: usuario?.id,
        comentario: 'Desconto removido',
        is_system: true
      });

      onUpdate();
    } catch (error: any) {
      alert(`Erro ao remover desconto: ${error.message}`);
    } finally {
      setSalvandoDesconto(false);
    }
  };

  const calcularSubtotal = () => {
    const totalPecas = pecas.reduce((sum, p) => sum + (p.valor_total || 0), 0);
    const totalServicos = servicos.reduce((sum, s) => sum + (s.valor_total || 0), 0);
    return totalPecas + totalServicos;
  };

  const calcularDescontoPreview = () => {
    const valorBruto = calcularSubtotal();
    const valorNumerico = parseFloat(descontoValor.replace(',', '.')) || 0;

    if (descontoTipo === 'percentual') {
      return (valorBruto * valorNumerico / 100);
    }
    return valorNumerico;
  };

  const calcularValorFinal = () => {
    const subtotal = calcularSubtotal();
    const desconto = os.valor_desconto_calculado || 0;
    return Math.max(subtotal - desconto, 0);
  };

  const calcularSaldoRestante = () => {
    const valorFinal = calcularValorFinal();
    const valorPago = os.valor_pago || 0;
    return Math.max(valorFinal - valorPago, 0);
  };

  return (
    <>
      <div className="space-y-4">
        {os.orcamento_pendente_reenvio && (
          <div className="p-4 rounded-xl border-2 border-[#FFBF00] bg-[#FFBF00]/10 flex items-start gap-3">
            <div className="w-10 h-10 rounded-full bg-[#FFBF00]/20 border border-[#FFBF00]/60 flex items-center justify-center flex-shrink-0">
              <AlertTriangle className="w-5 h-5 text-[#FFBF00]" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-[#FFBF00] uppercase tracking-wide mb-1">
                Atencao: Orcamento Desatualizado
              </p>
              <p className="text-xs text-[#FFBF00]/80 leading-relaxed">
                O custo de uma ou mais pecas foi atualizado na entrada da Nota Fiscal. O valor total da OS foi recalculado automaticamente. E necessario gerar e enviar um <strong>NOVO ORCAMENTO</strong> para o cliente.
              </p>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-[#FFBF00]/60 whitespace-nowrap">
              <RefreshCw className="w-3 h-3" />
              Reenvio necessario
            </div>
          </div>
        )}

        {os.is_cortesia && (
          <div className="premium-card p-6 bg-gradient-to-r from-[#39FF14]/20 to-[#10B981]/10 border-2 border-[#39FF14] animate-pulse">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-[#39FF14]/30 flex items-center justify-center border-2 border-[#39FF14]">
                <DollarSign className="w-6 h-6 text-[#39FF14]" />
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold text-[#39FF14] uppercase tracking-wider mb-1 flex items-center gap-2">
                  🎁 CORTESIA APLICADA
                </h3>
                <p className="text-sm text-gray-300 font-medium">
                  Esta OS foi marcada como CORTESIA. Não haverá cobrança ao cliente.
                </p>
                {os.motivo_cortesia && (
                  <div className="mt-3 p-3 rounded-lg bg-[#39FF14]/10 border border-[#39FF14]/30">
                    <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Motivo da Cortesia:</p>
                    <p className="text-sm text-gray-200 font-medium">{os.motivo_cortesia}</p>
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="px-4 py-2 rounded-lg bg-[#39FF14]/20 border border-[#39FF14]">
                  <p className="text-xs text-gray-400 uppercase">Valor Total</p>
                  <p className="text-2xl font-bold text-[#39FF14]">R$ 0,00</p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VENDEDOR RESPONSAVEL - Em destaque no topo */}
        <div className={`premium-card p-6 ${vendedorResponsavel
          ? 'bg-gradient-to-r from-[#9D4EDD]/20 to-[#00D4FF]/10 border-2 border-[#9D4EDD]'
          : 'bg-gradient-to-r from-gray-800/50 to-gray-700/30 border-2 border-dashed border-gray-600'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                vendedorResponsavel
                  ? 'bg-gradient-to-br from-[#9D4EDD] to-[#00D4FF] shadow-lg shadow-[#9D4EDD]/30'
                  : 'bg-gray-700/50 border-2 border-dashed border-gray-500'
              }`}>
                {vendedorResponsavel ? (
                  <Crown className="w-7 h-7 text-white" />
                ) : (
                  <User className="w-7 h-7 text-gray-400" />
                )}
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h3 className={`text-lg font-bold uppercase tracking-wide ${
                    vendedorResponsavel ? 'text-[#9D4EDD]' : 'text-gray-400'
                  }`}>
                    VENDEDOR RESPONSAVEL
                  </h3>
                  {vendedorResponsavel && !podeEditarVendedor() && (
                    <Lock className="w-4 h-4 text-gray-500" title="Somente gerentes podem alterar" />
                  )}
                </div>
                {vendedorResponsavel ? (
                  <p className="text-xl font-bold text-white">
                    {usuariosUnidade.find(u => u.id === vendedorResponsavel)?.nome || 'Carregando...'}
                  </p>
                ) : (
                  <p className="text-sm text-gray-400">Nenhum vendedor definido - Clique para selecionar</p>
                )}
              </div>
            </div>

            <div>
              {podeEditarVendedor() ? (
                <button
                  onClick={() => { setShowVendedorDropdown(true); setVendedorSearch(''); }}
                  disabled={salvandoVendedor}
                  className={`px-4 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 transition-all ${
                    vendedorResponsavel
                      ? 'bg-[#9D4EDD]/20 text-[#9D4EDD] border border-[#9D4EDD]/40 hover:bg-[#9D4EDD]/30'
                      : 'bg-[#00D4FF] text-black hover:bg-[#00D4FF]/90'
                  }`}
                >
                  {salvandoVendedor ? (
                    <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <UserCheck className="w-4 h-4" />
                  )}
                  {vendedorResponsavel ? 'Alterar' : 'Definir Vendedor'}
                  <ChevronDown className={`w-4 h-4 transition-transform ${showVendedorDropdown ? 'rotate-180' : ''}`} />
                </button>
              ) : (
                <div className="px-4 py-2.5 rounded-xl bg-gray-800/50 border border-gray-700 text-gray-500 text-sm flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Bloqueado
                </div>
              )}
            </div>
          </div>

          {os.vendedor_responsavel_definido_em && (
            <div className="mt-4 pt-3 border-t border-gray-700/50 flex items-center gap-4 text-xs text-gray-500">
              <span>Definido em: {new Date(os.vendedor_responsavel_definido_em).toLocaleString('pt-BR')}</span>
            </div>
          )}
        </div>

        <div className="premium-card p-6 bg-gradient-to-r from-[#F59E0B]/10 to-[#00D4FF]/10 border border-[#F59E0B]/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#F59E0B]/20 flex items-center justify-center border border-[#F59E0B]/40">
                <MessageSquare className="w-5 h-5 text-[#F59E0B]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#F59E0B]">NEGOCIACAO DE ORCAMENTO</h3>
                <p className="text-xs text-gray-400">Envie, aprove ou reprove o orçamento</p>
              </div>
            </div>
            {os.versao_orcamento > 1 && (
              <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-[#FF0064]/20 text-[#FF0064] border border-[#FF0064]/40 animate-pulse">
                <AlertTriangle className="w-3 h-3 inline mr-1" />
                {os.versao_orcamento}º ORÇAMENTO
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

          <div className="grid grid-cols-3 gap-3 mb-4">
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
            {(() => {
              const isAprovado = os.orcamento_aprovado_em &&
                os.valor_quando_aprovado !== null &&
                os.valor_quando_aprovado !== undefined &&
                Math.abs((os.valor_total || 0) - os.valor_quando_aprovado) < 0.01;

              if (isAprovado) {
                return (
                  <div
                    className="flex flex-col items-center justify-center gap-1 px-4 py-2 rounded-lg font-bold text-xs uppercase"
                    style={{
                      backgroundColor: '#39FF1430',
                      color: '#39FF14',
                      border: '2px solid #39FF14'
                    }}
                  >
                    <div className="flex items-center gap-1">
                      <Check className="w-4 h-4" />
                      APROVADO
                    </div>
                    <span className="text-[10px] font-normal opacity-80">
                      {new Date(os.orcamento_aprovado_em).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                );
              }

              return (
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
              );
            })()}
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

          {os.status_orcamento_link && os.status_orcamento_link !== 'pendente' && (
            <div className={`mb-3 p-4 rounded-lg border ${
              os.status_orcamento_link === 'aprovado'
                ? 'bg-[#39FF14]/10 border-[#39FF14]/40'
                : os.status_orcamento_link === 'rejeitado'
                ? 'bg-[#FF0064]/10 border-[#FF0064]/40'
                : 'bg-[#F59E0B]/10 border-[#F59E0B]/40'
            }`}>
              <div className="flex items-center gap-3 mb-2">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  os.status_orcamento_link === 'aprovado'
                    ? 'bg-[#39FF14]/20'
                    : os.status_orcamento_link === 'rejeitado'
                    ? 'bg-[#FF0064]/20'
                    : 'bg-[#F59E0B]/20'
                }`}>
                  {os.status_orcamento_link === 'aprovado' ? (
                    <ThumbsUp className="w-4 h-4 text-[#39FF14]" />
                  ) : os.status_orcamento_link === 'rejeitado' ? (
                    <ThumbsDown className="w-4 h-4 text-[#FF0064]" />
                  ) : (
                    <MessageSquare className="w-4 h-4 text-[#F59E0B]" />
                  )}
                </div>
                <div>
                  <p className={`text-sm font-bold uppercase ${
                    os.status_orcamento_link === 'aprovado'
                      ? 'text-[#39FF14]'
                      : os.status_orcamento_link === 'rejeitado'
                      ? 'text-[#FF0064]'
                      : 'text-[#F59E0B]'
                  }`}>
                    {os.status_orcamento_link === 'aprovado'
                      ? 'CLIENTE APROVOU VIA LINK'
                      : os.status_orcamento_link === 'rejeitado'
                      ? 'CLIENTE REJEITOU VIA LINK'
                      : 'CLIENTE QUER NEGOCIAR'}
                  </p>
                  {os.orcamento_aprovado_em && os.status_orcamento_link === 'aprovado' && (
                    <p className="text-xs text-gray-400">
                      Aprovado em {new Date(os.orcamento_aprovado_em).toLocaleString('pt-BR')}
                    </p>
                  )}
                  {os.orcamento_reprovado_em && os.status_orcamento_link === 'rejeitado' && (
                    <p className="text-xs text-gray-400">
                      Rejeitado em {new Date(os.orcamento_reprovado_em).toLocaleString('pt-BR')}
                    </p>
                  )}
                </div>
              </div>
              {os.mensagem_cliente_orcamento && (
                <div className="mt-3 p-3 rounded-lg bg-black/20 border border-gray-700">
                  <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Mensagem do Cliente:</p>
                  <p className="text-sm text-white italic">"{os.mensagem_cliente_orcamento}"</p>
                </div>
              )}
            </div>
          )}

          {os.orcamento_aprovado_em && !os.status_orcamento_link && (
            <div className="mb-3 p-3 rounded-lg bg-[#39FF14]/10 border border-[#39FF14]/30">
              <p className="text-xs text-[#39FF14]">
                <ThumbsUp className="w-3 h-3 inline mr-1" />
                Orçamento APROVADO em {new Date(os.orcamento_aprovado_em).toLocaleString('pt-BR')}
              </p>
            </div>
          )}

          {os.orcamento_reprovado_em && !os.status_orcamento_link && (
            <div className="p-3 rounded-lg bg-[#FF0064]/10 border border-[#FF0064]/30">
              <p className="text-xs text-[#FF0064]">
                <ThumbsDown className="w-3 h-3 inline mr-1" />
                Orçamento REPROVADO em {new Date(os.orcamento_reprovado_em).toLocaleString('pt-BR')}
              </p>
            </div>
          )}
        </div>

        <div className="premium-card p-6 bg-gradient-to-r from-[#9D4EDD]/10 to-[#FF0064]/10 border border-[#9D4EDD]/30">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#9D4EDD]/20 flex items-center justify-center border border-[#9D4EDD]/40">
                <Tag className="w-5 h-5 text-[#9D4EDD]" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#9D4EDD]">DESCONTO</h3>
                <p className="text-xs text-gray-400">Aplique desconto para o cliente</p>
              </div>
            </div>
            {os.valor_desconto_calculado > 0 && (
              <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/40">
                -R$ {(os.valor_desconto_calculado || 0).toFixed(2)} APLICADO
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs text-gray-400 uppercase mb-2">Tipo de Desconto</label>
              <div className="flex rounded-lg overflow-hidden border border-gray-700">
                <button
                  type="button"
                  onClick={() => setDescontoTipo('valor')}
                  className={`flex-1 px-4 py-3 text-sm font-bold uppercase transition-all flex items-center justify-center gap-2 ${
                    descontoTipo === 'valor'
                      ? 'bg-[#9D4EDD] text-white'
                      : 'bg-black/30 text-gray-400 hover:bg-gray-800'
                  }`}
                >
                  <DollarSign className="w-4 h-4" />
                  Valor (R$)
                </button>
                <button
                  type="button"
                  onClick={() => setDescontoTipo('percentual')}
                  className={`flex-1 px-4 py-3 text-sm font-bold uppercase transition-all flex items-center justify-center gap-2 ${
                    descontoTipo === 'percentual'
                      ? 'bg-[#9D4EDD] text-white'
                      : 'bg-black/30 text-gray-400 hover:bg-gray-800'
                  }`}
                >
                  <Percent className="w-4 h-4" />
                  Percentual (%)
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 uppercase mb-2">
                {descontoTipo === 'percentual' ? 'Percentual (%)' : 'Valor (R$)'}
              </label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                  {descontoTipo === 'percentual' ? '%' : 'R$'}
                </span>
                <input
                  type="text"
                  value={descontoValor}
                  onChange={(e) => setDescontoValor(e.target.value.replace(/[^0-9.,]/g, ''))}
                  placeholder="0,00"
                  className="w-full pl-10 pr-4 py-3 bg-black/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#9D4EDD] focus:outline-none text-lg font-mono"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 uppercase mb-2">Preview do Desconto</label>
              <div className="px-4 py-3 bg-black/50 border border-gray-700 rounded-lg">
                <p className="text-lg font-bold text-[#FF0064] font-mono">
                  -R$ {calcularDescontoPreview().toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">
                  Valor final: R$ {Math.max(calcularSubtotal() - calcularDescontoPreview(), 0).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSalvarDesconto}
              disabled={salvandoDesconto}
              className="flex-1 px-6 py-3 rounded-lg font-bold text-sm uppercase transition-all flex items-center justify-center gap-2"
              style={{
                backgroundColor: '#9D4EDD20',
                color: '#9D4EDD',
                border: '1px solid #9D4EDD60'
              }}
            >
              <Check className="w-4 h-4" />
              {salvandoDesconto ? 'Salvando...' : 'Aplicar Desconto'}
            </button>
            {os.valor_desconto_calculado > 0 && (
              <button
                onClick={handleRemoverDesconto}
                disabled={salvandoDesconto}
                className="px-6 py-3 rounded-lg font-bold text-sm uppercase transition-all flex items-center justify-center gap-2"
                style={{
                  backgroundColor: '#FF006420',
                  color: '#FF0064',
                  border: '1px solid #FF006460'
                }}
              >
                <X className="w-4 h-4" />
                Remover
              </button>
            )}
          </div>
        </div>

        <div className="premium-card p-6 bg-gradient-to-r from-[#39FF14]/5 to-[#00D4FF]/5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <div>
              <p className="text-xs text-gray-400 uppercase mb-1">Subtotal</p>
              <p className="text-xl font-bold text-gray-300">
                R$ {calcularSubtotal().toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase mb-1">Desconto</p>
              <p className={`text-xl font-bold ${os.valor_desconto_calculado > 0 ? 'text-[#FF0064]' : 'text-gray-500'}`}>
                {os.valor_desconto_calculado > 0 ? '-' : ''}R$ {(os.valor_desconto_calculado || 0).toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase mb-1">Valor Final</p>
              <p className="text-2xl font-bold text-[#00D4FF]">
                R$ {calcularValorFinal().toFixed(2)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase mb-1">Valor Pago</p>
              <p className="text-2xl font-bold text-[#39FF14]">
                R$ {(os.valor_pago || 0).toFixed(2)}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-gray-700">
            <div>
              <p className="text-xs text-gray-400 uppercase mb-1">Saldo Restante</p>
              <p className="text-2xl font-bold text-[#FFBF00]">
                R$ {calcularSaldoRestante().toFixed(2)}
              </p>
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
                          R$ {(pagamento.valor || 0).toFixed(2)}
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
                    R$ {calcularValorFinal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
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

              <div className="premium-card p-4 bg-[#00D4FF]/5 border border-[#00D4FF]/20 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Send className="w-4 h-4 text-[#00D4FF]" />
                    <span className="text-xs text-[#00D4FF] uppercase tracking-wider font-bold">
                      Link de Aprovacao
                    </span>
                  </div>
                  {approvalLink && !gerandoLink && (
                    <button
                      onClick={copiarLink}
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                        linkCopied
                          ? 'bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/40'
                          : 'bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/40 hover:bg-[#00D4FF]/30'
                      }`}
                    >
                      {linkCopied ? (
                        <>
                          <Check className="w-4 h-4" />
                          COPIADO!
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          COPIAR LINK
                        </>
                      )}
                    </button>
                  )}
                </div>

                {(gerandoLink || carregandoLink) ? (
                  <div className="flex flex-col items-center justify-center py-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00D4FF] mb-3"></div>
                    <p className="text-xs text-gray-400">{carregandoLink ? 'Verificando link existente...' : 'Gerando link seguro...'}</p>
                  </div>
                ) : approvalLink ? (
                  <>
                    <div className="text-xs text-gray-300 bg-black/30 p-3 rounded-lg border border-gray-800 break-all font-mono mb-3">
                      {approvalLink}
                    </div>

                    <div className="mb-3 p-2 bg-yellow-500/10 border border-yellow-500/30 rounded-lg flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                      <p className="text-[10px] text-yellow-300">
                        <strong>Validade:</strong> Este link expira em{' '}
                        <strong>
                          {linkExpiresAt
                            ? new Date(linkExpiresAt).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
                            : '72 horas'}
                        </strong>
                      </p>
                    </div>

                    <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                      <p className="text-[10px] text-blue-300 leading-relaxed">
                        <strong>Como funciona:</strong> Ao acessar o link, o cliente poderá visualizar o orçamento completo e:
                      </p>
                      <ul className="text-[10px] text-blue-300 mt-2 ml-4 space-y-1">
                        <li>✓ <strong>Aprovar</strong> o orçamento</li>
                        <li>✓ <strong>Rejeitar</strong> com motivo</li>
                        <li>✓ <strong>Negociar</strong> enviando uma mensagem</li>
                      </ul>
                      <p className="text-[10px] text-blue-300 mt-2">
                        <strong>Importante:</strong> Ao tomar qualquer acao, o sistema capturara automaticamente:
                      </p>
                      <ul className="text-[10px] text-blue-300 mt-1 ml-4 space-y-1">
                        <li>• Localizacao GPS do cliente</li>
                        <li>• Selfie do cliente (via camera)</li>
                        <li>• Data e hora da acao</li>
                      </ul>
                      <p className="text-[10px] text-blue-300 mt-2">
                        Todas essas informacoes serao salvas nos <strong>Anexos da OS</strong> automaticamente.
                      </p>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6">
                    <p className="text-xs text-gray-400 mb-4">
                      Clique no botao abaixo para gerar um link de aprovacao
                    </p>
                    <button
                      onClick={gerarLinkAprovacao}
                      disabled={gerandoLink}
                      className="px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all flex items-center justify-center gap-2 mx-auto"
                      style={{
                        backgroundColor: '#00D4FF20',
                        color: '#00D4FF',
                        border: '1px solid #00D4FF60',
                        boxShadow: '0 0 20px #00D4FF30'
                      }}
                    >
                      <Send className="w-5 h-5" />
                      GERAR LINK
                    </button>
                    <p className="text-[10px] text-gray-500 mt-3">
                      Link tera validade de 72 horas
                    </p>
                  </div>
                )}
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

      {showVendedorDropdown && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={() => setShowVendedorDropdown(false)}>
          <div data-vendedor-dropdown className="premium-card w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-[#9D4EDD]/20">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#9D4EDD] to-[#00D4FF] flex items-center justify-center">
                  <Crown className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#9D4EDD]">SELECIONAR VENDEDOR</h2>
                  <p className="text-xs text-gray-400">Escolha o vendedor responsavel</p>
                </div>
              </div>
              <button
                onClick={() => setShowVendedorDropdown(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
              >
                <X className="w-6 h-6 text-gray-400" />
              </button>
            </div>

            <div className="p-4 border-b border-gray-700/50">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  value={vendedorSearch}
                  onChange={(e) => setVendedorSearch(e.target.value)}
                  placeholder="Pesquisar vendedor..."
                  className="w-full pl-10 pr-4 py-3 bg-black/50 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:border-[#9D4EDD] focus:outline-none"
                  autoFocus
                />
              </div>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {vendedorResponsavel && (
                <button
                  onClick={() => handleSalvarVendedorResponsavel(null)}
                  className="w-full px-6 py-4 text-left hover:bg-red-500/10 flex items-center gap-4 text-red-400 border-b border-gray-800 transition-colors"
                >
                  <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                    <X className="w-5 h-5" />
                  </div>
                  <span className="font-medium">Remover vendedor</span>
                </button>
              )}
              {usuariosUnidade
                .filter(u => u.nome.toLowerCase().includes(vendedorSearch.toLowerCase()))
                .map(u => (
                <button
                  key={u.id}
                  onClick={() => handleSalvarVendedorResponsavel(u.id)}
                  className={`w-full px-6 py-4 text-left hover:bg-[#9D4EDD]/10 flex items-center justify-between transition-colors ${
                    vendedorResponsavel === u.id ? 'bg-[#9D4EDD]/20' : ''
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                      vendedorResponsavel === u.id
                        ? 'bg-gradient-to-br from-[#9D4EDD] to-[#00D4FF] text-white'
                        : 'bg-gray-700 text-gray-300'
                    }`}>
                      {u.nome.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-white font-medium">{u.nome}</span>
                      {u.tipo && <p className="text-xs text-gray-500 capitalize">{u.tipo}</p>}
                    </div>
                  </div>
                  {vendedorResponsavel === u.id && (
                    <Check className="w-5 h-5 text-[#9D4EDD]" />
                  )}
                </button>
              ))}
              {usuariosUnidade.filter(u => u.nome.toLowerCase().includes(vendedorSearch.toLowerCase())).length === 0 && (
                <div className="px-6 py-8 text-center text-gray-500">
                  <Search className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>Nenhum vendedor encontrado</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showConfirmAprovarModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
          <div className="premium-card w-full max-w-lg">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-[#39FF14]/20 flex items-center justify-center">
                  <ThumbsUp className="w-6 h-6 text-[#39FF14]" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white">Confirmar Aprovação</h3>
                  <p className="text-sm text-gray-400">Esta ação não pode ser desfeita</p>
                </div>
              </div>

              <div className="bg-[#1A1A1A] rounded-lg p-4 mb-6 border border-[#39FF14]/20">
                <p className="text-white text-sm leading-relaxed">
                  Confirma a <span className="text-[#39FF14] font-bold">APROVAÇÃO</span> do orçamento?
                </p>
                <p className="text-gray-400 text-xs mt-2">
                  A OS será movida para a coluna "Orçamento Aprovado"
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setShowConfirmAprovarModal(false)}
                  disabled={processando}
                  className="flex-1 px-6 py-3 border border-gray-700 rounded-lg text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarAprovacao}
                  disabled={processando}
                  className="flex-1 px-6 py-3 rounded-lg font-bold transition-all disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, #39FF14 0%, #00D4FF 100%)',
                    color: '#000'
                  }}
                >
                  {processando ? 'Aprovando...' : 'Confirmar Aprovação'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <SuccessModal
        isOpen={showAprovarModal}
        onClose={() => setShowAprovarModal(false)}
        title="Orçamento Aprovado"
        message="Orçamento aprovado com sucesso! OS movida para coluna Orçamento Aprovado."
      />

      <SuccessModal
        isOpen={showReprovarSuccessModal}
        onClose={() => setShowReprovarSuccessModal(false)}
        title="Orçamento Reprovado"
        message="Orçamento reprovado. OS movida para coluna Orçamentos Rejeitados."
      />
    </>
  );
}
