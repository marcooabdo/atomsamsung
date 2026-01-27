import { useState, useEffect } from 'react';
import { FileText, Building2, User, DollarSign, Percent, Receipt, Send, AlertCircle, CheckCircle, Clock, X, ChevronDown, FileCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';

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
  status: string;
  data_emissao: string | null;
  protocolo: string | null;
  nf_config: { nome: string } | null;
}

interface OSNotaFiscalTabProps {
  osId: string;
  clienteNome: string;
  clienteDocumento?: string | null;
  clienteTelefone?: string | null;
  clienteEmail?: string | null;
  clienteEndereco?: string | null;
  unidadeId: string;
  valorServicos: number;
  valorPecas: number;
  valorTotal: number;
  onReload?: () => void;
}

export function OSNotaFiscalTab({
  osId,
  clienteNome,
  clienteDocumento,
  clienteTelefone,
  clienteEmail,
  clienteEndereco,
  unidadeId,
  valorServicos,
  valorPecas,
  valorTotal
}: OSNotaFiscalTabProps) {
  const [nfConfigs, setNfConfigs] = useState<NFConfig[]>([]);
  const [nfsEmitidas, setNfsEmitidas] = useState<NFEmitida[]>([]);
  const [unidade, setUnidade] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [activeSection, setActiveSection] = useState<'nfse' | 'nfe'>('nfse');
  const [selectedConfig, setSelectedConfig] = useState<string>('');
  const [selectedNFeConfig, setSelectedNFeConfig] = useState<string>('');
  const [showConfigDropdown, setShowConfigDropdown] = useState(false);
  const [showNFeConfigDropdown, setShowNFeConfigDropdown] = useState(false);

  const [formNFSe, setFormNFSe] = useState({
    valorServicos: valorServicos,
    aliquotaIss: 5,
    retencaoIr: 0,
    retencaoPis: 0,
    retencaoCofins: 0,
    retencaoCsll: 0,
    retencaoInss: 0,
    codigoServico: '',
    observacoes: ''
  });

  const [formNFe, setFormNFe] = useState({
    valorProdutos: valorPecas,
    cfop: '5102',
    ncm: '',
    observacoes: ''
  });

  const [emitindo, setEmitindo] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  useEffect(() => {
    loadData();
  }, [unidadeId, osId]);

  useEffect(() => {
    setFormNFSe(prev => ({ ...prev, valorServicos }));
    setFormNFe(prev => ({ ...prev, valorProdutos: valorPecas }));
  }, [valorServicos, valorPecas]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [configsRes, unidadeRes, nfsRes] = await Promise.all([
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
          .select('*, nf_config:nf_configuracoes(nome)')
          .eq('os_id', osId)
          .order('created_at', { ascending: false })
      ]);

      setNfConfigs(configsRes.data || []);
      setUnidade(unidadeRes.data);
      setNfsEmitidas(nfsRes.data || []);

      if (configsRes.data && configsRes.data.length > 0) {
        const firstNfse = configsRes.data.find(c => c.tipo === 'nfse');
        if (firstNfse) {
          setSelectedConfig(firstNfse.id);
          applyConfigToForm(firstNfse);
        }

        const firstNfe = configsRes.data.find(c => c.tipo === 'nfe');
        if (firstNfe) {
          setSelectedNFeConfig(firstNfe.id);
          applyConfigToForm(firstNfe);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  };

  const applyConfigToForm = (config: NFConfig) => {
    if (config.tipo === 'nfse') {
      setFormNFSe(prev => ({
        ...prev,
        aliquotaIss: config.aliquota_iss || 5,
        retencaoIr: config.retencao_ir || 0,
        retencaoPis: config.retencao_pis || 0,
        retencaoCofins: config.retencao_cofins || 0,
        retencaoCsll: config.retencao_csll || 0,
        retencaoInss: config.retencao_inss || 0,
        codigoServico: config.codigo_servico || '',
        observacoes: config.observacoes_padrao || ''
      }));
    } else {
      setFormNFe(prev => ({
        ...prev,
        cfop: config.cfop || '5102',
        ncm: config.ncm || '',
        observacoes: config.observacoes_padrao || ''
      }));
    }
  };

  const handleSelectConfig = (configId: string) => {
    setSelectedConfig(configId);
    const config = nfConfigs.find(c => c.id === configId);
    if (config) {
      applyConfigToForm(config);
    }
    setShowConfigDropdown(false);
  };

  const handleSelectNFeConfig = (configId: string) => {
    setSelectedNFeConfig(configId);
    const config = nfConfigs.find(c => c.id === configId);
    if (config) {
      applyConfigToForm(config);
    }
    setShowNFeConfigDropdown(false);
  };

  const calcularTotalRetencoes = () => {
    const base = formNFSe.valorServicos;
    return (
      (base * formNFSe.retencaoIr / 100) +
      (base * formNFSe.retencaoPis / 100) +
      (base * formNFSe.retencaoCofins / 100) +
      (base * formNFSe.retencaoCsll / 100) +
      (base * formNFSe.retencaoInss / 100)
    );
  };

  const calcularISS = () => {
    return formNFSe.valorServicos * formNFSe.aliquotaIss / 100;
  };

  const calcularValorLiquidoNFSe = () => {
    return formNFSe.valorServicos - calcularTotalRetencoes();
  };

  const handleEmitirNFSe = async () => {
    if (!selectedConfig) {
      setMensagem({ tipo: 'error', texto: 'Selecione uma parametrização de NFS-e' });
      return;
    }

    setEmitindo(true);
    setMensagem(null);

    try {
      const { error } = await supabase
        .from('nf_emitidas')
        .insert({
          os_id: osId,
          nf_config_id: selectedConfig,
          unidade_id: unidadeId,
          tipo: 'nfse',
          valor_servicos: formNFSe.valorServicos,
          valor_produtos: 0,
          valor_total: formNFSe.valorServicos,
          valor_retencoes: calcularTotalRetencoes(),
          base_calculo: formNFSe.valorServicos,
          status: 'pendente',
          tomador_nome: clienteNome,
          tomador_documento: clienteDocumento,
          tomador_endereco: clienteEndereco,
          observacoes: formNFSe.observacoes
        });

      if (error) throw error;

      setMensagem({ tipo: 'success', texto: 'NFS-e registrada com sucesso! Aguardando processamento da API.' });
      loadData();
    } catch (error: any) {
      console.error('Erro ao emitir NFS-e:', error);
      setMensagem({ tipo: 'error', texto: error.message || 'Erro ao emitir NFS-e' });
    } finally {
      setEmitindo(false);
    }
  };

  const handleEmitirNFe = async () => {
    if (!selectedNFeConfig && nfeConfigs.length > 0) {
      setMensagem({ tipo: 'error', texto: 'Selecione uma parametrização de NF-e' });
      return;
    }

    setEmitindo(true);
    setMensagem(null);

    try {
      const { error } = await supabase
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
          observacoes: formNFe.observacoes
        });

      if (error) throw error;

      setMensagem({ tipo: 'success', texto: 'NF-e registrada com sucesso! Aguardando processamento da API.' });
      loadData();
    } catch (error: any) {
      console.error('Erro ao emitir NF-e:', error);
      setMensagem({ tipo: 'error', texto: error.message || 'Erro ao emitir NF-e' });
    } finally {
      setEmitindo(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { bg: string; text: string; icon: any }> = {
      pendente: { bg: 'bg-yellow-500/20', text: 'text-yellow-400', icon: Clock },
      processando: { bg: 'bg-blue-500/20', text: 'text-blue-400', icon: Clock },
      emitida: { bg: 'bg-green-500/20', text: 'text-green-400', icon: CheckCircle },
      cancelada: { bg: 'bg-gray-500/20', text: 'text-gray-400', icon: X },
      erro: { bg: 'bg-red-500/20', text: 'text-red-400', icon: AlertCircle }
    };
    const config = statusConfig[status] || statusConfig.pendente;
    const Icon = config.icon;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.text}`}>
        <Icon className="w-3 h-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const nfseConfigs = nfConfigs.filter(c => c.tipo === 'nfse');
  const nfeConfigs = nfConfigs.filter(c => c.tipo === 'nfe');
  const selectedConfigData = nfConfigs.find(c => c.id === selectedConfig);
  const selectedNFeConfigData = nfConfigs.find(c => c.id === selectedNFeConfig);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-2 border-[#00D4FF] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {mensagem && (
        <div className={`p-4 rounded-lg flex items-center gap-3 ${
          mensagem.tipo === 'success'
            ? 'bg-green-500/10 border border-green-500/30 text-green-400'
            : 'bg-red-500/10 border border-red-500/30 text-red-400'
        }`}>
          {mensagem.tipo === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
          <span>{mensagem.texto}</span>
          <button onClick={() => setMensagem(null)} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="premium-card p-4 bg-gradient-to-br from-[#00D4FF]/5 to-transparent border border-[#00D4FF]/20">
          <h4 className="text-sm font-bold text-[#00D4FF] uppercase tracking-wider mb-3 flex items-center gap-2">
            <User className="w-4 h-4" />
            Dados do Tomador (Cliente)
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Nome:</span>
              <span className="text-gray-200 font-medium">{clienteNome || 'Não informado'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">CPF/CNPJ:</span>
              <span className="text-gray-200 font-medium">{clienteDocumento || 'Não informado'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Telefone:</span>
              <span className="text-gray-200 font-medium">{clienteTelefone || 'Não informado'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Email:</span>
              <span className="text-gray-200 font-medium truncate max-w-[200px]">{clienteEmail || 'Não informado'}</span>
            </div>
            {clienteEndereco && (
              <div className="pt-2 border-t border-gray-700">
                <span className="text-gray-500 text-xs">Endereco:</span>
                <p className="text-gray-300 text-xs mt-1">{clienteEndereco}</p>
              </div>
            )}
          </div>
        </div>

        <div className="premium-card p-4 bg-gradient-to-br from-[#FFA500]/5 to-transparent border border-[#FFA500]/20">
          <h4 className="text-sm font-bold text-[#FFA500] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Dados do Prestador (Emitente)
          </h4>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Razao Social:</span>
              <span className="text-gray-200 font-medium">{unidade?.nome || 'Carregando...'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Cidade:</span>
              <span className="text-gray-200 font-medium">{unidade?.cidade || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Estado:</span>
              <span className="text-gray-200 font-medium">{unidade?.estado || '-'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Telefone:</span>
              <span className="text-gray-200 font-medium">{unidade?.telefone || '-'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex gap-2 border-b border-gray-700">
        <button
          onClick={() => setActiveSection('nfse')}
          className={`px-4 py-3 text-sm font-bold uppercase tracking-wider transition-all ${
            activeSection === 'nfse'
              ? 'text-[#00D4FF] border-b-2 border-[#00D4FF] bg-[#00D4FF]/5'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <Receipt className="w-4 h-4 inline mr-2" />
          NFS-e (Servicos)
        </button>
        <button
          onClick={() => setActiveSection('nfe')}
          className={`px-4 py-3 text-sm font-bold uppercase tracking-wider transition-all ${
            activeSection === 'nfe'
              ? 'text-[#00D4FF] border-b-2 border-[#00D4FF] bg-[#00D4FF]/5'
              : 'text-gray-400 hover:text-gray-200'
          }`}
        >
          <FileText className="w-4 h-4 inline mr-2" />
          NF-e (Produtos)
        </button>
      </div>

      {activeSection === 'nfse' && (
        <div className="space-y-4">
          <div className="premium-card p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-[#00D4FF]" />
                Emissao de NFS-e
              </h4>

              {nfseConfigs.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowConfigDropdown(!showConfigDropdown)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 hover:border-[#00D4FF]/50 transition-colors"
                  >
                    <span>{selectedConfigData?.nome || 'Selecionar parametrizacao'}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${showConfigDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showConfigDropdown && (
                    <div className="absolute right-0 top-full mt-1 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 overflow-hidden">
                      {nfseConfigs.map(config => (
                        <button
                          key={config.id}
                          onClick={() => handleSelectConfig(config.id)}
                          className={`w-full px-4 py-3 text-left text-sm hover:bg-[#00D4FF]/10 transition-colors ${
                            selectedConfig === config.id ? 'bg-[#00D4FF]/20 text-[#00D4FF]' : 'text-gray-200'
                          }`}
                        >
                          <div className="font-medium">{config.nome}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            ISS: {config.aliquota_iss}% | Cod: {config.codigo_servico || '-'}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {nfseConfigs.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma parametrizacao de NFS-e cadastrada para esta unidade.</p>
                <p className="text-sm mt-1">Configure em Atom Core Settings &gt; Nota Fiscal</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                      Valor dos Servicos (Base de Calculo)
                    </label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                      <input
                        type="number"
                        value={formNFSe.valorServicos}
                        onChange={(e) => setFormNFSe(prev => ({ ...prev, valorServicos: parseFloat(e.target.value) || 0 }))}
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 focus:outline-none focus:border-[#00D4FF] transition-colors"
                        step="0.01"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                      Codigo do Servico (LC 116)
                    </label>
                    <input
                      type="text"
                      value={formNFSe.codigoServico}
                      onChange={(e) => setFormNFSe(prev => ({ ...prev, codigoServico: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 focus:outline-none focus:border-[#00D4FF] transition-colors"
                      placeholder="Ex: 14.01"
                    />
                  </div>
                </div>

                <div className="premium-card p-3 bg-gray-800/50">
                  <h5 className="text-xs font-bold text-gray-300 uppercase mb-3 flex items-center gap-2">
                    <Percent className="w-3.5 h-3.5" />
                    Aliquotas e Retencoes
                  </h5>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">ISS (%)</label>
                      <input
                        type="number"
                        value={formNFSe.aliquotaIss}
                        onChange={(e) => setFormNFSe(prev => ({ ...prev, aliquotaIss: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-2 py-1.5 rounded bg-gray-700 border border-gray-600 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">IR (%)</label>
                      <input
                        type="number"
                        value={formNFSe.retencaoIr}
                        onChange={(e) => setFormNFSe(prev => ({ ...prev, retencaoIr: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-2 py-1.5 rounded bg-gray-700 border border-gray-600 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">PIS (%)</label>
                      <input
                        type="number"
                        value={formNFSe.retencaoPis}
                        onChange={(e) => setFormNFSe(prev => ({ ...prev, retencaoPis: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-2 py-1.5 rounded bg-gray-700 border border-gray-600 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">COFINS (%)</label>
                      <input
                        type="number"
                        value={formNFSe.retencaoCofins}
                        onChange={(e) => setFormNFSe(prev => ({ ...prev, retencaoCofins: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-2 py-1.5 rounded bg-gray-700 border border-gray-600 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">CSLL (%)</label>
                      <input
                        type="number"
                        value={formNFSe.retencaoCsll}
                        onChange={(e) => setFormNFSe(prev => ({ ...prev, retencaoCsll: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-2 py-1.5 rounded bg-gray-700 border border-gray-600 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                        step="0.01"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">INSS (%)</label>
                      <input
                        type="number"
                        value={formNFSe.retencaoInss}
                        onChange={(e) => setFormNFSe(prev => ({ ...prev, retencaoInss: parseFloat(e.target.value) || 0 }))}
                        className="w-full px-2 py-1.5 rounded bg-gray-700 border border-gray-600 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                        step="0.01"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Observacoes da Nota
                  </label>
                  <textarea
                    value={formNFSe.observacoes}
                    onChange={(e) => setFormNFSe(prev => ({ ...prev, observacoes: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 focus:outline-none focus:border-[#00D4FF] transition-colors resize-none"
                    rows={3}
                    placeholder="Observacoes que serao incluidas na nota fiscal..."
                  />
                </div>

                <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-[#00D4FF]/10 to-[#FFA500]/10 border border-[#00D4FF]/30">
                  <div className="space-y-1">
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-400">Base de Calculo:</span>
                      <span className="text-white font-bold">{formatCurrency(formNFSe.valorServicos)}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-400">ISS ({formNFSe.aliquotaIss}%):</span>
                      <span className="text-yellow-400">{formatCurrency(calcularISS())}</span>
                    </div>
                    <div className="flex items-center gap-4 text-sm">
                      <span className="text-gray-400">Total Retencoes:</span>
                      <span className="text-red-400">- {formatCurrency(calcularTotalRetencoes())}</span>
                    </div>
                    <div className="flex items-center gap-4 text-base pt-2 border-t border-gray-700">
                      <span className="text-gray-200 font-medium">Valor Liquido:</span>
                      <span className="text-[#00D4FF] font-bold text-lg">{formatCurrency(calcularValorLiquidoNFSe())}</span>
                    </div>
                  </div>

                  <button
                    onClick={handleEmitirNFSe}
                    disabled={emitindo || formNFSe.valorServicos <= 0}
                    className="flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    style={{
                      background: 'linear-gradient(135deg, rgba(0,212,255,0.3) 0%, rgba(0,212,255,0.1) 100%)',
                      border: '2px solid rgba(0,212,255,0.7)',
                      color: '#00D4FF',
                      boxShadow: '0 0 20px rgba(0,212,255,0.3)'
                    }}
                  >
                    {emitindo ? (
                      <>
                        <div className="w-4 h-4 border-2 border-[#00D4FF] border-t-transparent rounded-full animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4" />
                        Emitir NFS-e
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {activeSection === 'nfe' && (
        <div className="space-y-4">
          <div className="premium-card p-4">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-[#FFA500]" />
                Emissao de NF-e (Produtos/Pecas)
              </h4>

              {nfeConfigs.length > 0 && (
                <div className="relative">
                  <button
                    onClick={() => setShowNFeConfigDropdown(!showNFeConfigDropdown)}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-800 border border-gray-700 text-sm text-gray-200 hover:border-[#FFA500]/50 transition-colors"
                  >
                    <span>{selectedNFeConfigData?.nome || 'Selecionar parametrizacao'}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform ${showNFeConfigDropdown ? 'rotate-180' : ''}`} />
                  </button>

                  {showNFeConfigDropdown && (
                    <div className="absolute right-0 top-full mt-1 w-64 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 overflow-hidden">
                      {nfeConfigs.map(config => (
                        <button
                          key={config.id}
                          onClick={() => handleSelectNFeConfig(config.id)}
                          className={`w-full px-4 py-3 text-left text-sm hover:bg-[#FFA500]/10 transition-colors ${
                            selectedNFeConfig === config.id ? 'bg-[#FFA500]/20 text-[#FFA500]' : 'text-gray-200'
                          }`}
                        >
                          <div className="font-medium">{config.nome}</div>
                          <div className="text-xs text-gray-500 mt-0.5">
                            CFOP: {config.cfop || '-'} | NCM: {config.ncm || '-'}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {nfeConfigs.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>Nenhuma parametrizacao de NF-e cadastrada para esta unidade.</p>
                <p className="text-sm mt-1">Configure em Atom Core Settings &gt; Nota Fiscal</p>
              </div>
            ) : (
              <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Valor dos Produtos
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="number"
                      value={formNFe.valorProdutos}
                      onChange={(e) => setFormNFe(prev => ({ ...prev, valorProdutos: parseFloat(e.target.value) || 0 }))}
                      className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 focus:outline-none focus:border-[#00D4FF] transition-colors"
                      step="0.01"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    CFOP
                  </label>
                  <input
                    type="text"
                    value={formNFe.cfop}
                    onChange={(e) => setFormNFe(prev => ({ ...prev, cfop: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 focus:outline-none focus:border-[#00D4FF] transition-colors"
                    placeholder="Ex: 5102"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    NCM
                  </label>
                  <input
                    type="text"
                    value={formNFe.ncm}
                    onChange={(e) => setFormNFe(prev => ({ ...prev, ncm: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 focus:outline-none focus:border-[#00D4FF] transition-colors"
                    placeholder="Ex: 85171210"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Observacoes da Nota
                </label>
                <textarea
                  value={formNFe.observacoes}
                  onChange={(e) => setFormNFe(prev => ({ ...prev, observacoes: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 focus:outline-none focus:border-[#00D4FF] transition-colors resize-none"
                  rows={3}
                  placeholder="Observacoes que serao incluidas na nota fiscal..."
                />
              </div>

              <div className="flex items-center justify-between p-4 rounded-lg bg-gradient-to-r from-[#FFA500]/10 to-[#00D4FF]/10 border border-[#FFA500]/30">
                <div className="space-y-1">
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-gray-400">Valor Total dos Produtos:</span>
                    <span className="text-[#FFA500] font-bold text-lg">{formatCurrency(formNFe.valorProdutos)}</span>
                  </div>
                </div>

                <button
                  onClick={handleEmitirNFe}
                  disabled={emitindo || formNFe.valorProdutos <= 0}
                  className="flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,165,0,0.3) 0%, rgba(255,165,0,0.1) 100%)',
                    border: '2px solid rgba(255,165,0,0.7)',
                    color: '#FFA500',
                    boxShadow: '0 0 20px rgba(255,165,0,0.3)'
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
                      Emitir NF-e
                    </>
                  )}
                </button>
              </div>
              </div>
            )}
          </div>
        </div>
      )}

      {nfsEmitidas.length > 0 && (
        <div className="premium-card p-4">
          <h4 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-[#00D4FF]" />
            Notas Fiscais desta OS
          </h4>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">Tipo</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">Parametrizacao</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">Numero</th>
                  <th className="text-right py-2 px-3 text-gray-400 font-medium">Valor</th>
                  <th className="text-center py-2 px-3 text-gray-400 font-medium">Status</th>
                  <th className="text-left py-2 px-3 text-gray-400 font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {nfsEmitidas.map(nf => (
                  <tr key={nf.id} className="border-b border-gray-800 hover:bg-gray-800/50">
                    <td className="py-2 px-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                        nf.tipo === 'nfse'
                          ? 'bg-blue-500/20 text-blue-400'
                          : 'bg-purple-500/20 text-purple-400'
                      }`}>
                        {nf.tipo === 'nfse' ? 'NFS-e' : 'NF-e'}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-gray-300">{nf.nf_config?.nome || '-'}</td>
                    <td className="py-2 px-3 text-gray-200 font-mono">{nf.numero || '-'}</td>
                    <td className="py-2 px-3 text-right text-gray-200">{formatCurrency(nf.valor_total)}</td>
                    <td className="py-2 px-3 text-center">{getStatusBadge(nf.status)}</td>
                    <td className="py-2 px-3 text-gray-400">
                      {nf.data_emissao
                        ? new Date(nf.data_emissao).toLocaleDateString('pt-BR')
                        : new Date(nf.data_emissao || '').toLocaleDateString('pt-BR')
                      }
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
