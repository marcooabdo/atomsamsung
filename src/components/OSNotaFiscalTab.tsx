import { useState, useEffect } from 'react';
import {
  FileText, Building2, User, DollarSign, Receipt, Send,
  AlertCircle, CheckCircle, Clock, X, ChevronDown, RefreshCw,
  Download, Package, Wrench, Edit3, Save, RotateCcw, Truck, Box, Ban, Trash2
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { EmitirNFSeModal } from './EmitirNFSeModal';

interface NFConfig {
  id: string;
  nome: string;
  tipo: 'nfse' | 'nfe';
  codigo_servico: string | null;
  cnae: string | null;
  aliquota_iss: number;
  retencao_ir: number;
  retencao_pis: number;
  retencao_cofins: number;
  retencao_csll: number;
  retencao_inss: number;
  cfop: string | null;
  ncm: string | null;
  observacoes_padrao: string | null;
}

interface NFEmitida {
  id: string;
  tipo: 'nfse' | 'nfe';
  numero: string | null;
  serie: string | null;
  valor_total: number;
  valor_servicos: number;
  valor_produtos: number;
  status: string;
  data_emissao: string | null;
  protocolo: string | null;
  erro_mensagem: string | null;
  pdf_url: string | null;
  xml_url: string | null;
  nuvem_fiscal_id: string | null;
  tentativas: number | null;
  nf_config: { nome: string } | null;
}

interface PecaItem {
  id: string;
  pn: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  status: string | null;
  gi_postado_em: string | null;
  devolvida_em: string | null;
  usada_em: string | null;
  exibir_no_pdf?: boolean;
  source: 'os_pecas' | 'cotacoes_pecas' | 'requisicoes_pecas';
}

interface ServicoItem {
  id: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  codigo_servico?: string | null;
  source: 'os_servicos' | 'cotacoes_servicos';
}

interface EditValues {
  descricao: string;
  quantidade: number;
  valor_unitario: number;
}

interface OSNotaFiscalTabProps {
  osId: string;
  clienteNome: string;
  clienteDocumento?: string | null;
  clienteTelefone?: string | null;
  clienteEmail?: string | null;
  clienteEndereco?: string | null;
  clienteLogradouro?: string | null;
  clienteNumero?: string | null;
  clienteBairro?: string | null;
  clienteCep?: string | null;
  clienteCidade?: string | null;
  clienteCidadeIbge?: string | null;
  clienteMunicipio?: string | null;
  clienteUF?: string | null;
  unidadeId: string;
  valorServicos: number;
  valorPecas: number;
  valorTotal: number;
  valorPago: number;
  valorDesconto: number;
  tipoOs?: string;
  isCortesia?: boolean;
  onReload?: () => void;
  onClienteUpdate?: (dados: { nome: string; documento: string; telefone: string; email: string; endereco: string }) => void;
}

export function OSNotaFiscalTab({
  osId,
  clienteNome,
  clienteDocumento,
  clienteTelefone,
  clienteEmail,
  clienteEndereco,
  clienteLogradouro,
  clienteNumero,
  clienteBairro,
  clienteCep,
  clienteCidade,
  clienteCidadeIbge,
  clienteMunicipio,
  clienteUF,
  unidadeId,
  tipoOs,
  isCortesia,
  onReload,
  onClienteUpdate
}: OSNotaFiscalTabProps) {
  const [nfConfigs, setNfConfigs] = useState<NFConfig[]>([]);
  const [nfsEmitidas, setNfsEmitidas] = useState<NFEmitida[]>([]);
  const [unidade, setUnidade] = useState<any>(null);
  const [pecas, setPecas] = useState<PecaItem[]>([]);
  const [servicos, setServicos] = useState<ServicoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [valorPago, setValorPago] = useState(0);
  const [valorDesconto, setValorDesconto] = useState(0);

  const [selectedNFeConfig, setSelectedNFeConfig] = useState<string>('');
  const [showNFeConfigDropdown, setShowNFeConfigDropdown] = useState(false);

  const [formNFe, setFormNFe] = useState({
    valorProdutos: 0,
    cfop: '5102',
    ncm: '',
    observacoes: ''
  });

  const [emitindo, setEmitindo] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);
  const [showNFSeModal, setShowNFSeModal] = useState(false);
  const [retryNfId, setRetryNfId] = useState<string | null>(null);
  const [retryingNfId, setRetryingNfId] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingType, setEditingType] = useState<'peca' | 'servico' | null>(null);
  const [editValues, setEditValues] = useState<EditValues>({ descricao: '', quantidade: 1, valor_unitario: 0 });
  const [saving, setSaving] = useState(false);

  const [descontoServicosManual, setDescontoServicosManual] = useState<number | null>(null);
  const [editingDescontoServicos, setEditingDescontoServicos] = useState(false);
  const [editingDescontoPecas, setEditingDescontoPecas] = useState(false);
  const [descontoServicosInput, setDescontoServicosInput] = useState('');
  const [descontoPecasInput, setDescontoPecasInput] = useState('');

  const [editingCliente, setEditingCliente] = useState(false);
  const [clienteForm, setClienteForm] = useState({
    nome: clienteNome || '',
    documento: clienteDocumento || '',
    telefone: clienteTelefone || '',
    email: clienteEmail || '',
    endereco: clienteEndereco || ''
  });
  const [salvandoCliente, setSalvandoCliente] = useState(false);

  const isLpOrCortesia = tipoOs === 'LP' || isCortesia === true;

  useEffect(() => {
    loadData();
  }, [unidadeId, osId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [configsRes, unidadeRes, nfsRes, osPecasRes, cotPecasRes, reqPecasRes, osServicosRes, cotServicosRes, osRes] = await Promise.all([
        supabase
          .from('nf_configuracoes')
          .select('*')
          .eq('unidade_id', unidadeId)
          .eq('ativo', true)
          .order('nome'),
        supabase
          .from('unidades')
          .select('*')
          .eq('id', unidadeId)
          .maybeSingle(),
        supabase
          .from('nf_emitidas')
          .select('*, nuvem_fiscal_id, nf_config:nf_configuracoes(nome)')
          .eq('os_id', osId)
          .order('created_at', { ascending: false }),
        supabase
          .from('os_pecas')
          .select('id, pn, descricao, quantidade, valor_unitario, valor_total, status, gi_postado_em, devolvida_em, usada_em, exibir_no_pdf')
          .eq('os_id', osId)
          .order('created_at', { ascending: true }),
        supabase
          .from('cotacoes_pecas')
          .select('id, pn, descricao, quantidade, valor_final_unitario, valor_total, exibir_no_pdf')
          .eq('os_id', osId)
          .order('created_at', { ascending: true }),
        supabase
          .from('requisicoes_pecas')
          .select('id, pn:codigo_peca, descricao, quantidade:quantidade_requisitada, valor_peca, status')
          .eq('os_id', osId)
          .not('status', 'eq', 'cancelada')
          .order('created_at', { ascending: true }),
        supabase
          .from('os_servicos')
          .select('id, descricao, quantidade, valor_unitario, valor_total, codigo_servico')
          .eq('os_id', osId)
          .order('created_at', { ascending: true }),
        supabase
          .from('cotacoes_servicos')
          .select('id, descricao, quantidade, valor_unitario, valor_total, servico:servicos(codigo)')
          .eq('os_id', osId)
          .order('created_at', { ascending: true }),
        supabase
          .from('os')
          .select('valor_pago, valor_desconto_calculado')
          .eq('id', osId)
          .maybeSingle()
      ]);

      setNfConfigs(configsRes.data || []);
      setUnidade(unidadeRes.data);
      setNfsEmitidas(nfsRes.data || []);

      if (osRes.data) {
        setValorPago(osRes.data.valor_pago || 0);
        setValorDesconto(osRes.data.valor_desconto_calculado || 0);
      }

      const osPecasIds = new Set((osPecasRes.data || []).map((p: any) => p.pn));
      const osPecasMapped: PecaItem[] = (osPecasRes.data || []).map((p: any) => ({
        ...p,
        valor_unitario: p.valor_unitario || 0,
        valor_total: p.valor_total || 0,
        exibir_no_pdf: p.exibir_no_pdf !== false,
        source: 'os_pecas' as const
      }));
      const cotPecasMapped: PecaItem[] = (cotPecasRes.data || [])
        .filter((p: any) => !osPecasIds.has(p.pn))
        .map((p: any) => ({
          id: p.id,
          pn: p.pn,
          descricao: p.descricao,
          quantidade: p.quantidade,
          valor_unitario: p.valor_final_unitario || 0,
          valor_total: p.valor_total || 0,
          status: null,
          gi_postado_em: null,
          devolvida_em: null,
          usada_em: null,
          exibir_no_pdf: p.exibir_no_pdf !== false,
          source: 'cotacoes_pecas' as const
        }));

      const allExistingPNs = new Set([...osPecasIds, ...(cotPecasRes.data || []).map((p: any) => p.pn)]);
      const reqPecasMapped: PecaItem[] = (reqPecasRes.data || [])
        .filter((p: any) => !allExistingPNs.has(p.pn))
        .map((p: any) => ({
          id: p.id,
          pn: p.pn,
          descricao: p.descricao,
          quantidade: p.quantidade || 1,
          valor_unitario: p.valor_peca || 0,
          valor_total: (p.valor_peca || 0) * (p.quantidade || 1),
          status: p.status,
          gi_postado_em: null,
          devolvida_em: null,
          usada_em: null,
          exibir_no_pdf: true,
          source: 'requisicoes_pecas' as const
        }));

      const allPecas = [...osPecasMapped, ...cotPecasMapped, ...reqPecasMapped].filter(p =>
        !p.devolvida_em &&
        p.status !== 'devolvida' &&
        p.status !== 'cancelada'
      );
      setPecas(allPecas);

      const osServIds = new Set((osServicosRes.data || []).map((s: any) => s.descricao));
      const osServMapped: ServicoItem[] = (osServicosRes.data || []).map((s: any) => ({
        id: s.id,
        descricao: s.descricao,
        quantidade: s.quantidade,
        valor_unitario: s.valor_unitario || 0,
        valor_total: s.valor_total || 0,
        codigo_servico: s.codigo_servico,
        source: 'os_servicos' as const
      }));
      const cotServMapped: ServicoItem[] = (cotServicosRes.data || [])
        .filter((s: any) => !osServIds.has(s.descricao))
        .map((s: any) => ({
          id: s.id,
          descricao: s.descricao,
          quantidade: s.quantidade,
          valor_unitario: s.valor_unitario || 0,
          valor_total: s.valor_total || 0,
          codigo_servico: (s.servico as any)?.codigo || null,
          source: 'cotacoes_servicos' as const
        }));
      setServicos([...osServMapped, ...cotServMapped]);

      const nfeConfigs = (configsRes.data || []).filter((c: NFConfig) => c.tipo === 'nfe');
      if (nfeConfigs.length > 0 && !selectedNFeConfig) {
        setSelectedNFeConfig(nfeConfigs[0].id);
        applyNFeConfig(nfeConfigs[0]);
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyNFeConfig = (config: NFConfig) => {
    setFormNFe(prev => ({
      ...prev,
      cfop: config.cfop || '5102',
      ncm: config.ncm || '',
      observacoes: config.observacoes_padrao || ''
    }));
  };

  const handleSalvarCliente = async () => {
    setSalvandoCliente(true);
    try {
      const { error } = await supabase
        .from('os')
        .update({
          cliente_nome: clienteForm.nome,
          cliente_documento: clienteForm.documento,
          cliente_telefone: clienteForm.telefone,
          cliente_email: clienteForm.email,
          cliente_endereco: clienteForm.endereco
        })
        .eq('id', osId);

      if (error) throw error;

      setMensagem({ tipo: 'success', texto: 'Dados do cliente atualizados!' });
      setEditingCliente(false);
      onClienteUpdate?.(clienteForm);
      onReload?.();
    } catch (error: any) {
      setMensagem({ tipo: 'error', texto: error.message || 'Erro ao salvar dados do cliente' });
    } finally {
      setSalvandoCliente(false);
    }
  };

  const handleSelectNFeConfig = (configId: string) => {
    setSelectedNFeConfig(configId);
    const config = nfConfigs.find(c => c.id === configId);
    if (config) applyNFeConfig(config);
    setShowNFeConfigDropdown(false);
  };

  const startEdit = (type: 'peca' | 'servico', item: PecaItem | ServicoItem) => {
    setEditingId(item.id);
    setEditingType(type);
    setEditValues({
      descricao: item.descricao,
      quantidade: item.quantidade,
      valor_unitario: item.valor_unitario,
    });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingType(null);
  };

  const handleSave = async () => {
    if (!editingId || !editingType) return;
    setSaving(true);
    try {
      const newTotal = editValues.valor_unitario * editValues.quantidade;

      if (editingType === 'peca') {
        const peca = pecas.find(p => p.id === editingId);
        if (!peca) return;
        const table = peca.source;
        let updateData: Record<string, any>;
        if (peca.source === 'os_pecas') {
          updateData = {
            descricao: editValues.descricao,
            valor_unitario: editValues.valor_unitario,
            quantidade: editValues.quantidade,
            valor_total: newTotal,
            valor_gspn: editValues.valor_unitario
          };
        } else if (peca.source === 'requisicoes_pecas') {
          updateData = {
            descricao: editValues.descricao,
            valor_peca: editValues.valor_unitario,
            quantidade: editValues.quantidade
          };
        } else {
          updateData = {
            descricao: editValues.descricao,
            valor_final_unitario: editValues.valor_unitario,
            quantidade: editValues.quantidade,
            valor_total: newTotal
          };
        }
        const { error } = await supabase.from(table).update(updateData).eq('id', editingId);
        if (error) throw error;
      } else {
        const servico = servicos.find(s => s.id === editingId);
        if (!servico) return;
        const { error } = await supabase
          .from(servico.source)
          .update({
            descricao: editValues.descricao,
            valor_unitario: editValues.valor_unitario,
            quantidade: editValues.quantidade,
            valor_total: newTotal,
          })
          .eq('id', editingId);
        if (error) throw error;
      }

      cancelEdit();
      await loadData();
      onReload?.();
    } catch (error: any) {
      setMensagem({ tipo: 'error', texto: error.message || 'Erro ao salvar' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (type: 'peca' | 'servico', item: PecaItem | ServicoItem) => {
    if (!confirm('Remover este item da nota fiscal?')) return;
    try {
      const table = type === 'peca' ? (item as PecaItem).source : (item as ServicoItem).source;
      const { error } = await supabase.from(table).delete().eq('id', item.id);
      if (error) throw error;
      await loadData();
      onReload?.();
    } catch (error: any) {
      setMensagem({ tipo: 'error', texto: error.message || 'Erro ao excluir' });
    }
  };

  const getPecaStatusConfig = (peca: PecaItem) => {
    if (peca.gi_postado_em) return { label: 'GI Postado', color: '#3b82f6', bg: '#3b82f620', icon: Truck };
    if (peca.usada_em) return { label: 'Usada', color: '#39FF14', bg: '#39FF1420', icon: CheckCircle };

    const workflowMap: Record<string, { label: string; color: string; bg: string; icon: any; isAccent?: boolean }> = {
      requisitada: { label: 'Requisitada', color: '#FFBF00', bg: '#FFBF0020', icon: Clock },
      aprovada: { label: 'Aprovada', color: '#00D4FF', bg: 'rgba(var(--accent-rgb), 0.125)', icon: CheckCircle, isAccent: true },
      em_transito: { label: 'Em Transito', color: '#FFA500', bg: '#FFA50020', icon: Truck },
      disponivel: { label: 'Disponivel', color: '#10b981', bg: '#10b98120', icon: Box },
      vinculada_tecnico: { label: 'Com Tecnico', color: '#3b82f6', bg: '#3b82f620', icon: User },
      em_uso: { label: 'Em Uso', color: '#00D4FF', bg: 'rgba(var(--accent-rgb), 0.125)', icon: Wrench, isAccent: true },
      usada: { label: 'Usada', color: '#39FF14', bg: '#39FF1420', icon: CheckCircle },
    };

    if (peca.status && workflowMap[peca.status]) {
      return workflowMap[peca.status];
    }

    return { label: 'Pendente', color: '#FFBF00', bg: '#FFBF0020', icon: Clock };
  };

  const startEditDescontoServicos = () => {
    setDescontoServicosInput(descontoServicos.toFixed(2));
    setEditingDescontoServicos(true);
    setEditingDescontoPecas(false);
  };

  const startEditDescontoPecas = () => {
    setDescontoPecasInput(descontoPecas.toFixed(2));
    setEditingDescontoPecas(true);
    setEditingDescontoServicos(false);
  };

  const confirmDescontoServicos = () => {
    const val = Math.max(0, Math.min(parseFloat(descontoServicosInput.replace(',', '.')) || 0, valorDesconto));
    const clamped = Math.min(val, totalServicos);
    setDescontoServicosManual(Math.round(clamped * 100) / 100);
    setEditingDescontoServicos(false);
  };

  const confirmDescontoPecas = () => {
    const val = Math.max(0, Math.min(parseFloat(descontoPecasInput.replace(',', '.')) || 0, valorDesconto));
    const clamped = Math.min(val, totalPecas);
    const newServicos = Math.round((valorDesconto - clamped) * 100) / 100;
    setDescontoServicosManual(Math.min(newServicos, totalServicos));
    setEditingDescontoPecas(false);
  };

  const resetDescontoSplit = () => {
    setDescontoServicosManual(null);
    setEditingDescontoServicos(false);
    setEditingDescontoPecas(false);
  };

  const totalServicos = servicos.reduce((sum, s) => sum + s.valor_total, 0);
  const totalPecas = pecas.reduce((sum, p) => sum + p.valor_total, 0);
  const totalBruto = totalServicos + totalPecas;

  const descontoProporcionalServicos = totalBruto > 0
    ? Math.round((totalServicos / totalBruto) * valorDesconto * 100) / 100
    : 0;

  const descontoServicos = descontoServicosManual !== null
    ? descontoServicosManual
    : descontoProporcionalServicos;
  const descontoPecas = Math.round((valorDesconto - descontoServicos) * 100) / 100;

  const totalServicosComDesconto = Math.max(totalServicos - descontoServicos, 0);
  const totalPecasComDesconto = Math.max(totalPecas - descontoPecas, 0);
  const totalComDesconto = Math.max(totalBruto - valorDesconto, 0);
  const pagamentoIntegral = valorPago >= totalComDesconto && totalComDesconto > 0;
  const faltaPagar = Math.max(totalComDesconto - valorPago, 0);

  const activeNfse = nfsEmitidas.filter(nf => nf.tipo === 'nfse' && nf.status !== 'cancelada');
  const activeNfe = nfsEmitidas.filter(nf => nf.tipo === 'nfe' && nf.status !== 'cancelada');

  const valorServicosInvoiced = activeNfse
    .filter(nf => nf.status !== 'erro')
    .reduce((sum, nf) => sum + (nf.valor_servicos || nf.valor_total || 0), 0);
  const valorPecasInvoiced = activeNfe
    .filter(nf => nf.status !== 'erro')
    .reduce((sum, nf) => sum + (nf.valor_produtos || nf.valor_total || 0), 0);

  const valorServicosRestante = Math.max(totalServicosComDesconto - valorServicosInvoiced, 0);
  const valorPecasRestante = Math.max(totalPecasComDesconto - valorPecasInvoiced, 0);

  useEffect(() => {
    setFormNFe(prev => ({ ...prev, valorProdutos: valorPecasRestante }));
  }, [valorPecasRestante]);

  const servicosPctInvoiced = totalServicosComDesconto > 0 ? Math.min((valorServicosInvoiced / totalServicosComDesconto) * 100, 100) : 0;
  const pecasPctInvoiced = totalPecasComDesconto > 0 ? Math.min((valorPecasInvoiced / totalPecasComDesconto) * 100, 100) : 0;

  const canEmitNfse = !isLpOrCortesia && pagamentoIntegral && valorServicosRestante > 0.01 && totalServicosComDesconto > 0;
  const canEmitNfe = (isLpOrCortesia || pagamentoIntegral) && valorPecasRestante > 0.01 && totalPecasComDesconto > 0;

  const showPaymentWarning = !isLpOrCortesia && !pagamentoIntegral && totalComDesconto > 0;

  const handleEmitirNFe = async () => {
    if (!selectedNFeConfig && nfeConfigs.length > 0) {
      setMensagem({ tipo: 'error', texto: 'Selecione uma parametrizacao de NF-e' });
      return;
    }
    if (formNFe.valorProdutos <= 0) {
      setMensagem({ tipo: 'error', texto: 'Valor dos produtos deve ser maior que zero' });
      return;
    }

    setEmitindo(true);
    setMensagem(null);

    try {
      const { data: inserted, error } = await supabase
        .from('nf_emitidas')
        .insert({
          os_id: osId,
          nf_config_id: selectedNFeConfig || null,
          unidade_id: unidadeId,
          tipo: 'nfe',
          valor_servicos: 0,
          valor_produtos: formNFe.valorProdutos,
          valor_total: formNFe.valorProdutos,
          valor_retencoes: 0,
          base_calculo: formNFe.valorProdutos,
          status: 'pendente',
          tomador_nome: clienteNome,
          tomador_documento: clienteDocumento,
          tomador_endereco: clienteEndereco,
          observacoes: formNFe.observacoes,
          tentativas: 1
        })
        .select('id')
        .single();

      if (error) throw error;

      if (inserted?.id) {
        try {
          const nfeResponse = await fetch('https://bot-post-products.groupglobal.com.br/api/nuvemFiscal/nfe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nfe_id: inserted.id })
          });
          if (!nfeResponse.ok) {
            const errData = await nfeResponse.json().catch(() => ({}));
            throw new Error(errData?.message || errData?.error || `Erro HTTP ${nfeResponse.status}`);
          }
          setMensagem({ tipo: 'success', texto: 'Emissao iniciada' });
        } catch (fetchErr: any) {
          setMensagem({ tipo: 'error', texto: fetchErr.message || 'Erro ao acionar servidor de emissao' });
        }
      }

      loadData();
    } catch (error: any) {
      setMensagem({ tipo: 'error', texto: error.message || 'Erro ao emitir NF-e' });
    } finally {
      setEmitindo(false);
    }
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { bg: string; border: string; color: string; label: string; icon: any }> = {
      pendente: { bg: '#FFBF0015', border: '#FFBF0040', color: '#FFBF00', label: 'Na Fila', icon: Clock },
      processando: { bg: 'rgba(var(--accent-rgb), 0.082)', border: 'rgba(var(--accent-rgb), 0.25)', color: 'var(--text-accent)', label: 'Processando', icon: Clock },
      emitida: { bg: '#39FF1415', border: '#39FF1440', color: '#39FF14', label: 'Emitida', icon: CheckCircle },
      cancelada: { bg: '#71717A15', border: '#71717A40', color: '#71717A', label: 'Cancelada', icon: X },
      erro: { bg: '#FF006415', border: '#FF006440', color: '#FF0064', label: 'Erro', icon: AlertCircle }
    };
    const c = configs[status] || configs.pendente;
    const Icon = c.icon;
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold"
        style={{ backgroundColor: c.bg, border: `1px solid ${c.border}`, color: c.color }}
      >
        <Icon className="w-3 h-3" />
        {c.label}
      </span>
    );
  };

  const nfseConfigs = nfConfigs.filter(c => c.tipo === 'nfse');
  const nfeConfigs = nfConfigs.filter(c => c.tipo === 'nfe');
  const selectedNFeConfigData = nfConfigs.find(c => c.id === selectedNFeConfig);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-[#00D4FF] border-t-transparent rounded-full" />
      </div>
    );
  }

  const renderEditableRow = (
    type: 'peca' | 'servico',
    item: PecaItem | ServicoItem,
    extraCols?: React.ReactNode
  ) => {
    const isEditing = editingId === item.id && editingType === type;

    return (
      <tr key={item.id} className="border-t border-gray-800 hover:bg-gray-800/30 transition-colors">
        {extraCols}
        <td className="py-2 px-3">
          {isEditing ? (
            <input
              type="text"
              value={editValues.descricao}
              onChange={(e) => setEditValues(prev => ({ ...prev, descricao: e.target.value }))}
              className="w-full px-1.5 py-1 rounded bg-gray-700 border border-[#00D4FF]/50 text-gray-200 text-xs focus:outline-none"
            />
          ) : (
            <span className="text-gray-300 text-xs">{item.descricao}</span>
          )}
        </td>
        <td className="py-2 px-3 text-center">
          {isEditing ? (
            <input
              type="number"
              value={editValues.quantidade}
              onChange={(e) => setEditValues(prev => ({ ...prev, quantidade: parseInt(e.target.value) || 1 }))}
              className="w-14 px-1.5 py-1 rounded bg-gray-700 border border-[#FFA500]/50 text-gray-200 text-xs text-center focus:outline-none"
              min={1}
            />
          ) : (
            <span className="text-gray-300 text-xs">{item.quantidade}</span>
          )}
        </td>
        <td className="py-2 px-3 text-right">
          {isEditing ? (
            <input
              type="number"
              value={editValues.valor_unitario}
              onChange={(e) => setEditValues(prev => ({ ...prev, valor_unitario: parseFloat(e.target.value) || 0 }))}
              className="w-24 px-1.5 py-1 rounded bg-gray-700 border border-[#FFA500]/50 text-gray-200 text-xs text-right focus:outline-none"
              step="0.01"
            />
          ) : (
            <span className="text-gray-300 text-xs">{formatCurrency(item.valor_unitario)}</span>
          )}
        </td>
        <td className="py-2 px-3 text-right">
          <span className="text-white font-medium text-xs">
            {isEditing
              ? formatCurrency(editValues.valor_unitario * editValues.quantidade)
              : formatCurrency(item.valor_total)
            }
          </span>
        </td>
        <td className="py-2 px-3 text-center">
          {isEditing ? (
            <div className="flex items-center gap-1 justify-center">
              <button onClick={handleSave} disabled={saving} className="p-1 rounded hover:bg-[#39FF14]/20 transition-colors" title="Salvar">
                <Save className="w-3.5 h-3.5 text-[#39FF14]" />
              </button>
              <button onClick={cancelEdit} className="p-1 rounded hover:bg-[#FF0064]/20 transition-colors" title="Cancelar">
                <X className="w-3.5 h-3.5 text-[#FF0064]" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-0.5 justify-center">
              <button onClick={() => startEdit(type, item)} className="p-1 rounded hover:bg-[#FFA500]/20 transition-colors" title="Editar">
                <Edit3 className="w-3.5 h-3.5 text-gray-500 hover:text-[#FFA500]" />
              </button>
              <button onClick={() => handleDelete(type, item)} className="p-1 rounded hover:bg-[#FF0064]/20 transition-colors" title="Excluir">
                <Trash2 className="w-3.5 h-3.5 text-gray-500 hover:text-[#FF0064]" />
              </button>
            </div>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="space-y-6">
      {mensagem && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          mensagem.tipo === 'success'
            ? 'bg-green-500/10 border border-green-500/30 text-green-400'
            : 'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          {mensagem.tipo === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span className="flex-1">{mensagem.texto}</span>
          <button onClick={() => setMensagem(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {showPaymentWarning && (
        <div className="premium-card p-6 bg-[#FF0064]/10 border-2 border-[#FF0064]/40">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-[#FF0064]/20 flex items-center justify-center border border-[#FF0064]/40">
              <AlertCircle className="w-6 h-6 text-[#FF0064]" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-bold text-[#FF0064]">PAGAMENTO INTEGRAL NECESSARIO</h3>
              <p className="text-sm text-gray-300 mt-1">
                A emissao de notas fiscais so e liberada apos o pagamento integral da OS.
              </p>
              <div className="flex gap-6 mt-3">
                <div>
                  <p className="text-[10px] text-gray-500 uppercase">Valor Total OS</p>
                  <p className="text-sm font-bold text-white">{formatCurrency(totalComDesconto)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase">Valor Pago</p>
                  <p className="text-sm font-bold text-[#FFBF00]">{formatCurrency(valorPago)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-gray-500 uppercase">Falta Pagar</p>
                  <p className="text-sm font-bold text-[#FF0064]">{formatCurrency(faltaPagar)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="premium-card p-4 bg-gradient-to-br from-[#00D4FF]/5 to-transparent border border-[#00D4FF]/20">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-bold text-[#00D4FF] uppercase tracking-wider flex items-center gap-2">
              <User className="w-4 h-4" />
              Tomador (Cliente)
            </h4>
            {!editingCliente ? (
              <button
                onClick={() => {
                  setClienteForm({
                    nome: clienteNome || '',
                    documento: clienteDocumento || '',
                    telefone: clienteTelefone || '',
                    email: clienteEmail || '',
                    endereco: clienteEndereco || ''
                  });
                  setEditingCliente(true);
                }}
                className="p-1.5 rounded hover:bg-[#00D4FF]/20 transition-colors"
                title="Editar dados do cliente"
              >
                <Edit3 className="w-3.5 h-3.5 text-[#00D4FF]" />
              </button>
            ) : (
              <div className="flex items-center gap-1">
                <button
                  onClick={handleSalvarCliente}
                  disabled={salvandoCliente}
                  className="p-1.5 rounded hover:bg-[#39FF14]/20 transition-colors"
                  title="Salvar"
                >
                  {salvandoCliente ? (
                    <RefreshCw className="w-3.5 h-3.5 text-[#39FF14] animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5 text-[#39FF14]" />
                  )}
                </button>
                <button
                  onClick={() => setEditingCliente(false)}
                  className="p-1.5 rounded hover:bg-[#FF0064]/20 transition-colors"
                  title="Cancelar"
                >
                  <X className="w-3.5 h-3.5 text-[#FF0064]" />
                </button>
              </div>
            )}
          </div>

          {editingCliente ? (
            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-gray-500 uppercase mb-1">Nome</label>
                <input
                  type="text"
                  value={clienteForm.nome}
                  onChange={(e) => setClienteForm(prev => ({ ...prev, nome: e.target.value }))}
                  className="w-full px-2.5 py-1.5 rounded bg-gray-800 border border-[#00D4FF]/30 text-gray-200 text-sm focus:outline-none focus:border-[#00D4FF]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 uppercase mb-1">CPF/CNPJ</label>
                <input
                  type="text"
                  value={clienteForm.documento}
                  onChange={(e) => setClienteForm(prev => ({ ...prev, documento: e.target.value }))}
                  className="w-full px-2.5 py-1.5 rounded bg-gray-800 border border-[#00D4FF]/30 text-gray-200 text-sm focus:outline-none focus:border-[#00D4FF]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 uppercase mb-1">Telefone</label>
                <input
                  type="text"
                  value={clienteForm.telefone}
                  onChange={(e) => setClienteForm(prev => ({ ...prev, telefone: e.target.value }))}
                  className="w-full px-2.5 py-1.5 rounded bg-gray-800 border border-[#00D4FF]/30 text-gray-200 text-sm focus:outline-none focus:border-[#00D4FF]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 uppercase mb-1">Email</label>
                <input
                  type="email"
                  value={clienteForm.email}
                  onChange={(e) => setClienteForm(prev => ({ ...prev, email: e.target.value }))}
                  className="w-full px-2.5 py-1.5 rounded bg-gray-800 border border-[#00D4FF]/30 text-gray-200 text-sm focus:outline-none focus:border-[#00D4FF]"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 uppercase mb-1">Endereco</label>
                <textarea
                  value={clienteForm.endereco}
                  onChange={(e) => setClienteForm(prev => ({ ...prev, endereco: e.target.value }))}
                  rows={2}
                  className="w-full px-2.5 py-1.5 rounded bg-gray-800 border border-[#00D4FF]/30 text-gray-200 text-sm focus:outline-none focus:border-[#00D4FF] resize-none"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Nome:</span>
                <span className="text-gray-200 font-medium">{clienteNome || 'Nao informado'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">CPF/CNPJ:</span>
                <span className="text-gray-200 font-medium">{clienteDocumento || 'Nao informado'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Telefone:</span>
                <span className="text-gray-200 font-medium">{clienteTelefone || 'Nao informado'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Email:</span>
                <span className="text-gray-200 font-medium truncate max-w-[200px]">{clienteEmail || 'Nao informado'}</span>
              </div>
              {clienteEndereco && (
                <div className="pt-2 border-t border-gray-700">
                  <span className="text-gray-500 text-xs">Endereco:</span>
                  <p className="text-gray-300 text-xs mt-1">{clienteEndereco}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="premium-card p-4 bg-gradient-to-br from-[#FFA500]/5 to-transparent border border-[#FFA500]/20">
          <h4 className="text-sm font-bold text-[#FFA500] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Prestador (Emitente)
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Razao Social:</span>
              <span className="text-gray-200 font-medium">{unidade?.razao_social || unidade?.nome || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">CNPJ:</span>
              <span className="text-gray-200 font-mono">{unidade?.cnpj || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Cidade:</span>
              <span className="text-gray-200">{unidade?.cidade || '-'} / {unidade?.estado || '-'}</span>
            </div>
          </div>
        </div>
      </div>

      {!isLpOrCortesia && (
        <div className="premium-card p-5 border border-[#00D4FF]/20">
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-bold text-[#00D4FF] uppercase tracking-wider flex items-center gap-2">
              <Wrench className="w-4 h-4" />
              NFS-e -- Servicos
            </h4>
            {servicosPctInvoiced >= 100 && totalServicos > 0 && (
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/40">
                100% FATURADO
              </span>
            )}
          </div>

          <div className={`grid gap-4 mb-4 ${valorDesconto > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
            <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
              <p className="text-[10px] text-gray-500 uppercase mb-1">Valor Servicos</p>
              <p className={`text-lg font-bold ${descontoServicos > 0 ? 'text-gray-400 line-through' : 'text-white'}`}>{formatCurrency(totalServicos)}</p>
              {descontoServicos > 0 && (
                <p className="text-sm font-bold text-white">{formatCurrency(totalServicosComDesconto)}</p>
              )}
            </div>
            {valorDesconto > 0 && (
              <div
                className={`p-3 rounded-lg border transition-all ${editingDescontoServicos ? 'bg-[#FF0064]/20 border-[#FF0064]/60' : 'bg-[#FF0064]/10 border-[#FF0064]/30 cursor-pointer hover:border-[#FF0064]/60'}`}
                onClick={() => !editingDescontoServicos && startEditDescontoServicos()}
              >
                <p className="text-[10px] text-[#FF0064] uppercase mb-1 flex items-center gap-1">
                  Desconto
                  {!editingDescontoServicos && <Edit3 className="w-2.5 h-2.5 opacity-50" />}
                </p>
                {editingDescontoServicos ? (
                  <div className="flex items-center gap-1">
                    <span className="text-sm text-[#FF0064] font-bold">-R$</span>
                    <input
                      type="text"
                      value={descontoServicosInput}
                      onChange={(e) => setDescontoServicosInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') confirmDescontoServicos();
                        if (e.key === 'Escape') setEditingDescontoServicos(false);
                      }}
                      autoFocus
                      className="w-full bg-transparent border-b border-[#FF0064]/60 text-[#FF0064] font-bold text-lg outline-none"
                    />
                  </div>
                ) : (
                  <p className="text-lg font-bold text-[#FF0064]">- {formatCurrency(descontoServicos)}</p>
                )}
                {editingDescontoServicos && (
                  <div className="flex gap-1 mt-1">
                    <button onClick={(e) => { e.stopPropagation(); confirmDescontoServicos(); }} className="text-[9px] px-1.5 py-0.5 rounded bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/30 hover:bg-[#39FF14]/30">OK</button>
                    <button onClick={(e) => { e.stopPropagation(); setEditingDescontoServicos(false); }} className="text-[9px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600">Esc</button>
                  </div>
                )}
              </div>
            )}
            <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
              <p className="text-[10px] text-gray-500 uppercase mb-1">Ja Faturado</p>
              <p className="text-lg font-bold text-[#39FF14]">{formatCurrency(valorServicosInvoiced)}</p>
            </div>
            <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
              <p className="text-[10px] text-gray-500 uppercase mb-1">A Faturar</p>
              <p className={`text-lg font-bold ${valorServicosRestante > 0 ? 'text-[#FFBF00]' : 'text-gray-500'}`}>
                {formatCurrency(valorServicosRestante)}
              </p>
            </div>
          </div>

          {totalServicos > 0 && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
                <span>Progresso de faturamento</span>
                <span>{servicosPctInvoiced.toFixed(0)}%</span>
              </div>
              <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${servicosPctInvoiced}%`,
                    background: servicosPctInvoiced >= 100
                      ? 'linear-gradient(90deg, #39FF14, #10B981)'
                      : 'linear-gradient(90deg, #00D4FF, #39FF14)'
                  }}
                />
              </div>
            </div>
          )}

          {servicos.length > 0 && (
            <div className="mb-4">
              <div className="overflow-x-auto rounded-lg border border-gray-700">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-800/80">
                      <th className="text-left py-2.5 px-3 text-[10px] text-gray-400 uppercase font-bold">Descricao</th>
                      <th className="text-center py-2.5 px-3 text-[10px] text-gray-400 uppercase font-bold">Qtd</th>
                      <th className="text-right py-2.5 px-3 text-[10px] text-gray-400 uppercase font-bold">Unit.</th>
                      <th className="text-right py-2.5 px-3 text-[10px] text-gray-400 uppercase font-bold">Total</th>
                      <th className="text-center py-2.5 px-3 text-[10px] text-gray-400 uppercase font-bold w-20"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {servicos.map(servico => renderEditableRow('servico', servico))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-gray-700 bg-gray-800/50">
                      <td colSpan={3} className="py-2.5 px-3 text-right text-xs font-bold text-gray-300 uppercase">
                        Subtotal Servicos ({servicos.length})
                      </td>
                      <td className="py-2.5 px-3 text-right text-sm font-bold text-[#00D4FF]">
                        {formatCurrency(totalServicos)}
                      </td>
                      <td></td>
                    </tr>
                    {valorDesconto > 0 && (
                      <tr className="bg-[#FF0064]/5">
                        <td colSpan={3} className="py-2 px-3 text-right text-xs font-bold text-[#FF0064] uppercase">
                          <span
                            className="cursor-pointer hover:underline inline-flex items-center gap-1"
                            onClick={startEditDescontoServicos}
                          >
                            Desconto {descontoServicosManual !== null ? '(editado)' : '(proporcional)'}
                            <Edit3 className="w-2.5 h-2.5 opacity-50" />
                          </span>
                        </td>
                        <td className="py-2 px-3 text-right text-sm font-bold text-[#FF0064]">
                          - {formatCurrency(descontoServicos)}
                        </td>
                        <td></td>
                      </tr>
                    )}
                    {descontoServicos > 0 && (
                      <tr className="bg-gray-800/80">
                        <td colSpan={3} className="py-2.5 px-3 text-right text-xs font-bold text-white uppercase">
                          Total p/ NFS-e
                        </td>
                        <td className="py-2.5 px-3 text-right text-sm font-bold text-white">
                          {formatCurrency(totalServicosComDesconto)}
                        </td>
                        <td></td>
                      </tr>
                    )}
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {canEmitNfse ? (
            <button
              onClick={() => {
                setRetryNfId(null);
                setShowNFSeModal(true);
              }}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all"
              style={{
                background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.25) 0%, rgba(var(--accent-rgb),0.08) 100%)',
                border: '2px solid rgba(var(--accent-rgb),0.6)',
                color: 'var(--text-accent)',
                boxShadow: '0 0 15px rgba(var(--accent-rgb),0.15)'
              }}
            >
              <Send className="w-4 h-4" />
              Emitir NFS-e -- {formatCurrency(valorServicosRestante)}
            </button>
          ) : servicos.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-2">Nenhum servico cadastrado nesta OS</p>
          ) : servicosPctInvoiced >= 100 ? (
            <p className="text-center text-sm text-[#39FF14] py-2 flex items-center justify-center gap-2">
              <CheckCircle className="w-4 h-4" />
              Todos os servicos ja foram faturados
            </p>
          ) : !pagamentoIntegral ? (
            <p className="text-center text-sm text-[#FF0064] py-2">Pagamento integral necessario para emitir NFS-e</p>
          ) : null}
        </div>
      )}

      <div className="premium-card p-5 border border-[#FFA500]/20">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-bold text-[#FFA500] uppercase tracking-wider flex items-center gap-2">
            <Package className="w-4 h-4" />
            NF-e -- Produtos / Pecas
          </h4>
          {pecasPctInvoiced >= 100 && totalPecas > 0 && (
            <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/40">
              100% FATURADO
            </span>
          )}
        </div>

        <div className={`grid gap-4 mb-4 ${valorDesconto > 0 ? 'grid-cols-4' : 'grid-cols-3'}`}>
          <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
            <p className="text-[10px] text-gray-500 uppercase mb-1">Valor Pecas</p>
            <p className={`text-lg font-bold ${descontoPecas > 0 ? 'text-gray-400 line-through' : 'text-white'}`}>{formatCurrency(totalPecas)}</p>
            {descontoPecas > 0 && (
              <p className="text-sm font-bold text-white">{formatCurrency(totalPecasComDesconto)}</p>
            )}
          </div>
          {valorDesconto > 0 && (
            <div
              className={`p-3 rounded-lg border transition-all ${editingDescontoPecas ? 'bg-[#FF0064]/20 border-[#FF0064]/60' : 'bg-[#FF0064]/10 border-[#FF0064]/30 cursor-pointer hover:border-[#FF0064]/60'}`}
              onClick={() => !editingDescontoPecas && startEditDescontoPecas()}
            >
              <p className="text-[10px] text-[#FF0064] uppercase mb-1 flex items-center gap-1">
                Desconto
                {!editingDescontoPecas && <Edit3 className="w-2.5 h-2.5 opacity-50" />}
              </p>
              {editingDescontoPecas ? (
                <div className="flex items-center gap-1">
                  <span className="text-sm text-[#FF0064] font-bold">-R$</span>
                  <input
                    type="text"
                    value={descontoPecasInput}
                    onChange={(e) => setDescontoPecasInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') confirmDescontoPecas();
                      if (e.key === 'Escape') setEditingDescontoPecas(false);
                    }}
                    autoFocus
                    className="w-full bg-transparent border-b border-[#FF0064]/60 text-[#FF0064] font-bold text-lg outline-none"
                  />
                </div>
              ) : (
                <p className="text-lg font-bold text-[#FF0064]">- {formatCurrency(descontoPecas)}</p>
              )}
              {editingDescontoPecas && (
                <div className="flex gap-1 mt-1">
                  <button onClick={(e) => { e.stopPropagation(); confirmDescontoPecas(); }} className="text-[9px] px-1.5 py-0.5 rounded bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/30 hover:bg-[#39FF14]/30">OK</button>
                  <button onClick={(e) => { e.stopPropagation(); setEditingDescontoPecas(false); }} className="text-[9px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 border border-gray-600 hover:bg-gray-600">Esc</button>
                </div>
              )}
            </div>
          )}
          <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
            <p className="text-[10px] text-gray-500 uppercase mb-1">Ja Faturado</p>
            <p className="text-lg font-bold text-[#39FF14]">{formatCurrency(valorPecasInvoiced)}</p>
          </div>
          <div className="p-3 rounded-lg bg-gray-800/50 border border-gray-700">
            <p className="text-[10px] text-gray-500 uppercase mb-1">A Faturar</p>
            <p className={`text-lg font-bold ${valorPecasRestante > 0 ? 'text-[#FFBF00]' : 'text-gray-500'}`}>
              {formatCurrency(valorPecasRestante)}
            </p>
          </div>
        </div>

        {totalPecas > 0 && (
          <div className="mb-4">
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1">
              <span>Progresso de faturamento</span>
              <span>{pecasPctInvoiced.toFixed(0)}%</span>
            </div>
            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${pecasPctInvoiced}%`,
                  background: pecasPctInvoiced >= 100
                    ? 'linear-gradient(90deg, #39FF14, #10B981)'
                    : 'linear-gradient(90deg, #FFA500, #39FF14)'
                }}
              />
            </div>
          </div>
        )}

        {pecas.length > 0 && (
          <div className="mb-4">
            <div className="overflow-x-auto rounded-lg border border-gray-700">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-800/80">
                    <th className="text-left py-2.5 px-3 text-[10px] text-gray-400 uppercase font-bold">PN</th>
                    <th className="text-center py-2.5 px-3 text-[10px] text-gray-400 uppercase font-bold w-24">Status</th>
                    <th className="text-left py-2.5 px-3 text-[10px] text-gray-400 uppercase font-bold">Descricao</th>
                    <th className="text-center py-2.5 px-3 text-[10px] text-gray-400 uppercase font-bold">Qtd</th>
                    <th className="text-right py-2.5 px-3 text-[10px] text-gray-400 uppercase font-bold">Unit.</th>
                    <th className="text-right py-2.5 px-3 text-[10px] text-gray-400 uppercase font-bold">Total</th>
                    <th className="text-center py-2.5 px-3 text-[10px] text-gray-400 uppercase font-bold w-20"></th>
                  </tr>
                </thead>
                <tbody>
                  {pecas.map(peca => {
                    const sc = getPecaStatusConfig(peca);
                    const StatusIcon = sc.icon;
                    return renderEditableRow(
                      'peca',
                      peca,
                      <>
                        <td className="py-2 px-3">
                          <span className="font-mono text-xs text-[#00D4FF]">{peca.pn}</span>
                        </td>
                        <td className="py-2 px-3 text-center">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap"
                            style={{ backgroundColor: sc.bg, border: sc.isAccent ? '1px solid rgba(var(--accent-rgb), 0.25)' : `1px solid ${sc.color}40`, color: sc.isAccent ? 'var(--text-accent)' : sc.color }}
                          >
                            <StatusIcon className="w-2.5 h-2.5" />
                            {sc.label}
                          </span>
                        </td>
                      </>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-gray-700 bg-gray-800/50">
                    <td colSpan={5} className="py-2.5 px-3 text-right text-xs font-bold text-gray-300 uppercase">
                      Subtotal Pecas ({pecas.length})
                    </td>
                    <td className="py-2.5 px-3 text-right text-sm font-bold text-[#FFA500]">
                      {formatCurrency(totalPecas)}
                    </td>
                    <td></td>
                  </tr>
                  {valorDesconto > 0 && (
                    <tr className="bg-[#FF0064]/5">
                      <td colSpan={5} className="py-2 px-3 text-right text-xs font-bold text-[#FF0064] uppercase">
                        <span
                          className="cursor-pointer hover:underline inline-flex items-center gap-1"
                          onClick={startEditDescontoPecas}
                        >
                          Desconto {descontoServicosManual !== null ? '(editado)' : '(proporcional)'}
                          <Edit3 className="w-2.5 h-2.5 opacity-50" />
                        </span>
                      </td>
                      <td className="py-2 px-3 text-right text-sm font-bold text-[#FF0064]">
                        - {formatCurrency(descontoPecas)}
                      </td>
                      <td></td>
                    </tr>
                  )}
                  {descontoPecas > 0 && (
                    <tr className="bg-gray-800/80">
                      <td colSpan={5} className="py-2.5 px-3 text-right text-xs font-bold text-white uppercase">
                        Total p/ NF-e
                      </td>
                      <td className="py-2.5 px-3 text-right text-sm font-bold text-white">
                        {formatCurrency(totalPecasComDesconto)}
                      </td>
                      <td></td>
                    </tr>
                  )}
                </tfoot>
              </table>
            </div>
          </div>
        )}

        {valorDesconto > 0 && (
          <div className="mb-4 p-3 rounded-lg bg-[#FF0064]/10 border border-[#FF0064]/30 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Desconto total na OS</p>
              <p className="text-sm font-bold text-[#FF0064]">- {formatCurrency(valorDesconto)}</p>
            </div>
            {totalServicos > 0 && totalPecas > 0 && (
              <div className="flex items-center gap-4 text-xs">
                <div
                  className="text-right cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={startEditDescontoServicos}
                >
                  <p className="text-gray-500 flex items-center gap-1 justify-end">Servicos <Edit3 className="w-2.5 h-2.5 opacity-50" /></p>
                  <p className="text-[#FF0064] font-bold">- {formatCurrency(descontoServicos)}</p>
                </div>
                <div className="w-px h-8 bg-gray-700" />
                <div
                  className="text-right cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={startEditDescontoPecas}
                >
                  <p className="text-gray-500 flex items-center gap-1 justify-end">Pecas <Edit3 className="w-2.5 h-2.5 opacity-50" /></p>
                  <p className="text-[#FF0064] font-bold">- {formatCurrency(descontoPecas)}</p>
                </div>
                {descontoServicosManual !== null && (
                  <>
                    <div className="w-px h-8 bg-gray-700" />
                    <button
                      onClick={resetDescontoSplit}
                      className="flex items-center gap-1 px-2 py-1 rounded bg-gray-700/50 text-gray-400 hover:text-white hover:bg-gray-600/50 transition-colors"
                      title="Voltar ao rateio proporcional"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span className="text-[10px]">Resetar</span>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {canEmitNfe ? (
          <div className="space-y-4">
            {nfeConfigs.length > 0 && (
              <div className="relative">
                <label className="block text-[10px] text-gray-500 mb-1">Parametrizacao NF-e</label>
                <button
                  onClick={() => setShowNFeConfigDropdown(!showNFeConfigDropdown)}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 hover:border-[#FFA500]/50 transition-colors"
                >
                  <span>{selectedNFeConfigData?.nome || 'Selecionar'}</span>
                  <ChevronDown className={`w-4 h-4 transition-transform ${showNFeConfigDropdown ? 'rotate-180' : ''}`} />
                </button>
                {showNFeConfigDropdown && (
                  <div className="absolute left-0 right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 overflow-hidden max-h-48 overflow-y-auto">
                    {nfeConfigs.map(config => (
                      <button
                        key={config.id}
                        onClick={() => handleSelectNFeConfig(config.id)}
                        className={`w-full px-4 py-3 text-left text-sm hover:bg-[#FFA500]/10 transition-colors ${
                          selectedNFeConfig === config.id ? 'bg-[#FFA500]/20 text-[#FFA500]' : 'text-gray-200'
                        }`}
                      >
                        <div className="font-medium">{config.nome}</div>
                        <div className="text-xs text-gray-500 mt-0.5">CFOP: {config.cfop || '-'} | NCM: {config.ncm || '-'}</div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">Valor (R$)</label>
                <div className="relative">
                  <DollarSign className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-500" />
                  <input
                    type="number"
                    value={formNFe.valorProdutos}
                    onChange={(e) => setFormNFe(prev => ({ ...prev, valorProdutos: parseFloat(e.target.value) || 0 }))}
                    className="w-full pl-8 pr-3 py-2 rounded bg-gray-800 border border-gray-700 text-gray-200 focus:outline-none focus:border-[#FFA500] text-sm"
                    step="0.01"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">CFOP</label>
                <input
                  type="text"
                  value={formNFe.cfop}
                  onChange={(e) => setFormNFe(prev => ({ ...prev, cfop: e.target.value }))}
                  className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-gray-200 focus:outline-none focus:border-[#FFA500] text-sm"
                />
              </div>
              <div>
                <label className="block text-[10px] text-gray-500 mb-1">NCM</label>
                <input
                  type="text"
                  value={formNFe.ncm}
                  onChange={(e) => setFormNFe(prev => ({ ...prev, ncm: e.target.value }))}
                  className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-gray-200 focus:outline-none focus:border-[#FFA500] text-sm"
                />
              </div>
            </div>

            <textarea
              value={formNFe.observacoes}
              onChange={(e) => setFormNFe(prev => ({ ...prev, observacoes: e.target.value }))}
              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-gray-200 focus:outline-none focus:border-[#FFA500] resize-none text-sm"
              rows={2}
              placeholder="Observacoes..."
            />

            <button
              onClick={handleEmitirNFe}
              disabled={emitindo || formNFe.valorProdutos <= 0}
              className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, rgba(255,165,0,0.25) 0%, rgba(255,165,0,0.08) 100%)',
                border: '2px solid rgba(255,165,0,0.6)',
                color: '#FFA500',
                boxShadow: '0 0 15px rgba(255,165,0,0.15)'
              }}
            >
              {emitindo ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#FFA500] border-t-transparent rounded-full animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4" />
                  Emitir NF-e -- {formatCurrency(formNFe.valorProdutos)}
                </>
              )}
            </button>
          </div>
        ) : pecas.length === 0 ? (
          <p className="text-center text-sm text-gray-500 py-2">Nenhuma peca cadastrada nesta OS</p>
        ) : pecasPctInvoiced >= 100 ? (
          <p className="text-center text-sm text-[#39FF14] py-2 flex items-center justify-center gap-2">
            <CheckCircle className="w-4 h-4" />
            Todas as pecas ja foram faturadas
          </p>
        ) : !isLpOrCortesia && !pagamentoIntegral ? (
          <p className="text-center text-sm text-[#FF0064] py-2">Pagamento integral necessario para emitir NF-e</p>
        ) : null}
      </div>

      {nfsEmitidas.length > 0 && (
        <div className="premium-card p-5">
          <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#00D4FF]" />
            Notas Fiscais desta OS ({nfsEmitidas.length})
          </h4>

          <div className="space-y-2">
            {nfsEmitidas.map(nf => {
              const pdfLink = nf.pdf_url || (nf.nuvem_fiscal_id ? `https://api.nuvemfiscal.com.br/nfse/${nf.nuvem_fiscal_id}/pdf` : null);
              const xmlLink = nf.xml_url || (nf.nuvem_fiscal_id ? `https://api.nuvemfiscal.com.br/nfse/${nf.nuvem_fiscal_id}/xml` : null);

              return (
                <div
                  key={nf.id}
                  className="flex items-center justify-between p-3 rounded-lg bg-gray-800/50 border border-gray-700 hover:border-gray-600 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold ${
                      nf.tipo === 'nfse'
                        ? 'bg-[#00D4FF]/15 text-[#00D4FF] border border-[#00D4FF]/30'
                        : 'bg-[#FFA500]/15 text-[#FFA500] border border-[#FFA500]/30'
                    }`}>
                      {nf.tipo === 'nfse' ? 'NFS-e' : 'NF-e'}
                    </span>
                    {getStatusBadge(nf.status)}
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm text-gray-300 truncate">
                        {nf.numero ? `#${nf.numero}` : ''}
                        {nf.nf_config?.nome ? ` - ${nf.nf_config.nome}` : ''}
                      </span>
                      {nf.nuvem_fiscal_id && (
                        <span className="text-[10px] text-gray-500 font-mono truncate">
                          ID: {nf.nuvem_fiscal_id}
                        </span>
                      )}
                    </div>
                    <span className="text-sm font-bold text-white ml-auto mr-3">
                      {formatCurrency(nf.valor_total)}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {(nf.status === 'erro' || nf.status === 'pendente') && (
                      <button
                        disabled={retryingNfId === nf.id}
                        onClick={async () => {
                          if (nf.tipo === 'nfse') {
                            setRetryNfId(nf.id);
                            setShowNFSeModal(true);
                          } else {
                            setRetryingNfId(nf.id);
                            setMensagem(null);
                            try {
                              await supabase
                                .from('nf_emitidas')
                                .update({ status: 'pendente', erro_mensagem: null })
                                .eq('id', nf.id);

                              const nfeResponse = await fetch('https://bot-post-products.groupglobal.com.br/api/nuvemFiscal/nfe', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ nfe_id: nf.id })
                              });
                              if (!nfeResponse.ok) {
                                const errData = await nfeResponse.json().catch(() => ({}));
                                throw new Error(errData?.message || errData?.error || `Erro HTTP ${nfeResponse.status}`);
                              }
                              setMensagem({ tipo: 'success', texto: 'Emissao iniciada' });
                              loadData();
                            } catch (err: any) {
                              setMensagem({ tipo: 'error', texto: err.message || 'Erro ao reenviar NF-e' });
                            } finally {
                              setRetryingNfId(null);
                            }
                          }
                        }}
                        className={`flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-bold transition-colors ${
                          nf.status === 'erro'
                            ? 'bg-[#FFBF00]/20 text-[#FFBF00] border border-[#FFBF00]/40 hover:bg-[#FFBF00]/30'
                            : 'bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/40 hover:bg-[#00D4FF]/30'
                        }`}
                        style={{ opacity: retryingNfId === nf.id ? 0.6 : 1 }}
                      >
                        <RefreshCw className={`w-3 h-3 ${retryingNfId === nf.id ? 'animate-spin' : ''}`} />
                        {nf.status === 'erro' ? 'Tentar Novamente' : 'Reprocessar'}
                      </button>
                    )}
                    {pdfLink && (
                      <a
                        href={pdfLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded hover:bg-[#39FF14]/20 transition-colors"
                        title="Download PDF"
                      >
                        <Download className="w-4 h-4 text-[#39FF14]" />
                      </a>
                    )}
                    {xmlLink && (
                      <a
                        href={xmlLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded hover:bg-[#FFBF00]/20 transition-colors"
                        title="Download XML"
                      >
                        <FileText className="w-4 h-4 text-[#FFBF00]" />
                      </a>
                    )}
                  </div>
                </div>
              );
            })}

            {nfsEmitidas.some(nf => nf.status === 'erro' && nf.erro_mensagem) && (
              <div className="mt-2 p-3 bg-[#FF0064]/10 border border-[#FF0064]/30 rounded-lg">
                <p className="text-xs font-bold text-[#FF0064] mb-1">Erro na emissao:</p>
                <p className="text-xs text-gray-300">
                  {nfsEmitidas.find(nf => nf.status === 'erro')?.erro_mensagem}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {showNFSeModal && (
        <EmitirNFSeModal
          isOpen={showNFSeModal}
          onClose={() => {
            setShowNFSeModal(false);
            setRetryNfId(null);
          }}
          onSuccess={() => {
            loadData();
            setShowNFSeModal(false);
            setRetryNfId(null);
          }}
          osId={osId}
          unidadeId={unidadeId}
          clienteNome={clienteNome}
          clienteDocumento={clienteDocumento}
          clienteTelefone={clienteTelefone}
          clienteEmail={clienteEmail}
          clienteEndereco={clienteEndereco}
          clienteLogradouro={clienteLogradouro}
          clienteNumero={clienteNumero}
          clienteBairro={clienteBairro}
          clienteCep={clienteCep}
          clienteCidadeIbge={clienteCidadeIbge}
          clienteMunicipio={clienteMunicipio}
          clienteUF={clienteUF}
          valorServicos={valorServicosRestante}
          existingNfId={retryNfId}
        />
      )}
    </div>
  );
}
