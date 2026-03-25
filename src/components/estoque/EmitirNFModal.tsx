import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, FileText, Building2, User, Package, ChevronDown, Plus, Save, Send, Eye, Trash2, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface NFConfig {
  id: string;
  nome: string;
  tipo: 'nfse' | 'nfe';
  cfop: string | null;
  ncm: string | null;
  natureza_operacao: string | null;
  observacoes_padrao: string | null;
  numero_inicial: number;
  serie: string | null;
  ultimo_numero: number;
}

interface Destinatario {
  id: string;
  nome: string;
  documento: string;
  tipo_documento: 'cpf' | 'cnpj';
  inscricao_estadual: string | null;
  email: string | null;
  telefone: string | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
}

interface Peca {
  id: string;
  pn: string;
  descricao: string;
  valor_com_impostos: number;
  id_numerico: number | null;
}

interface EmitirNFModalProps {
  pecas: Peca[];
  unidadeId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const DESTINATARIO_INICIAL = {
  nome: '',
  documento: '',
  tipo_documento: 'cpf' as const,
  inscricao_estadual: '',
  email: '',
  telefone: '',
  cep: '',
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: ''
};

export function EmitirNFModal({ pecas, unidadeId, onClose, onSuccess }: EmitirNFModalProps) {
  const [nfConfigs, setNfConfigs] = useState<NFConfig[]>([]);
  const [destinatariosSalvos, setDestinatariosSalvos] = useState<Destinatario[]>([]);
  const [unidade, setUnidade] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [selectedConfig, setSelectedConfig] = useState<string>('');
  const [showConfigDropdown, setShowConfigDropdown] = useState(false);
  const [showDestinatarioDropdown, setShowDestinatarioDropdown] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [destinatario, setDestinatario] = useState(DESTINATARIO_INICIAL);
  const [salvarDestinatario, setSalvarDestinatario] = useState(false);

  const [cfop, setCfop] = useState('5102');
  const [ncm, setNcm] = useState('');
  const [naturezaOperacao, setNaturezaOperacao] = useState('Venda de Mercadorias');
  const [observacoes, setObservacoes] = useState('');

  const [emitindo, setEmitindo] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  useEffect(() => {
    loadData();
  }, [unidadeId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [configsRes, destRes, unidadeRes] = await Promise.all([
        supabase
          .from('nf_configuracoes')
          .select('*')
          .eq('unidade_id', unidadeId)
          .eq('tipo', 'nfe')
          .eq('ativo', true)
          .order('nome'),
        supabase
          .from('nf_destinatarios')
          .select('*')
          .eq('unidade_id', unidadeId)
          .eq('ativo', true)
          .order('nome'),
        supabase
          .from('unidades')
          .select('*')
          .eq('id', unidadeId)
          .maybeSingle()
      ]);

      setNfConfigs(configsRes.data || []);
      setDestinatariosSalvos(destRes.data || []);
      setUnidade(unidadeRes.data);

      if (configsRes.data && configsRes.data.length > 0) {
        const firstConfig = configsRes.data[0];
        setSelectedConfig(firstConfig.id);
        applyConfig(firstConfig);
      }
    } catch (error) {
      // ignored
    } finally {
      setLoading(false);
    }
  };

  const applyConfig = (config: NFConfig) => {
    setCfop(config.cfop || '5102');
    setNcm(config.ncm || '');
    setNaturezaOperacao(config.natureza_operacao || 'Venda de Mercadorias');
    setObservacoes(config.observacoes_padrao || '');
  };

  const handleSelectConfig = (configId: string) => {
    setSelectedConfig(configId);
    const config = nfConfigs.find(c => c.id === configId);
    if (config) applyConfig(config);
    setShowConfigDropdown(false);
  };

  const handleSelectDestinatario = (dest: Destinatario) => {
    setDestinatario({
      nome: dest.nome,
      documento: dest.documento,
      tipo_documento: dest.tipo_documento,
      inscricao_estadual: dest.inscricao_estadual || '',
      email: dest.email || '',
      telefone: dest.telefone || '',
      cep: dest.cep || '',
      logradouro: dest.logradouro || '',
      numero: dest.numero || '',
      complemento: dest.complemento || '',
      bairro: dest.bairro || '',
      cidade: dest.cidade || '',
      estado: dest.estado || ''
    });
    setShowDestinatarioDropdown(false);
  };

  const calcularTotalProdutos = () => {
    return pecas.reduce((sum, p) => sum + p.valor_com_impostos, 0);
  };

  const getProximoNumero = () => {
    const config = nfConfigs.find(c => c.id === selectedConfig);
    if (!config) return 1;
    return Math.max(config.numero_inicial, (config.ultimo_numero || 0) + 1);
  };

  const getSerie = () => {
    const config = nfConfigs.find(c => c.id === selectedConfig);
    return config?.serie || '1';
  };

  const handleSalvarDestinatario = async () => {
    if (!destinatario.nome || !destinatario.documento) {
      setMensagem({ tipo: 'error', texto: 'Nome e documento são obrigatórios' });
      return;
    }

    try {
      const { error } = await supabase
        .from('nf_destinatarios')
        .insert({
          unidade_id: unidadeId,
          nome: destinatario.nome,
          documento: destinatario.documento,
          tipo_documento: destinatario.tipo_documento,
          inscricao_estadual: destinatario.inscricao_estadual || null,
          email: destinatario.email || null,
          telefone: destinatario.telefone || null,
          cep: destinatario.cep || null,
          logradouro: destinatario.logradouro || null,
          numero: destinatario.numero || null,
          complemento: destinatario.complemento || null,
          bairro: destinatario.bairro || null,
          cidade: destinatario.cidade || null,
          estado: destinatario.estado || null
        });

      if (error) throw error;
      setMensagem({ tipo: 'success', texto: 'Destinatário salvo com sucesso!' });
      loadData();
    } catch (error: any) {
      setMensagem({ tipo: 'error', texto: error.message || 'Erro ao salvar' });
    }
  };

  const handleEmitirNF = async () => {
    if (!selectedConfig) {
      setMensagem({ tipo: 'error', texto: 'Selecione uma parametrização de NF-e' });
      return;
    }

    if (!destinatario.nome || !destinatario.documento) {
      setMensagem({ tipo: 'error', texto: 'Preencha os dados do destinatário' });
      return;
    }

    setEmitindo(true);
    setMensagem(null);

    try {
      if (salvarDestinatario) {
        await handleSalvarDestinatario();
      }

      const proximoNumero = getProximoNumero();
      const serie = getSerie();

      const { error } = await supabase
        .from('nf_emitidas')
        .insert({
          nf_config_id: selectedConfig,
          unidade_id: unidadeId,
          tipo: 'nfe',
          numero: String(proximoNumero),
          serie: serie,
          valor_servicos: 0,
          valor_produtos: calcularTotalProdutos(),
          valor_total: calcularTotalProdutos(),
          base_calculo: calcularTotalProdutos(),
          status: 'pendente',
          tomador_nome: destinatario.nome,
          tomador_documento: destinatario.documento,
          tomador_endereco: [
            destinatario.logradouro,
            destinatario.numero,
            destinatario.bairro,
            destinatario.cidade,
            destinatario.estado,
            destinatario.cep
          ].filter(Boolean).join(', '),
          observacoes: observacoes,
          response_api: {
            pecas: pecas.map(p => ({
              id: p.id,
              pn: p.pn,
              descricao: p.descricao,
              valor: p.valor_com_impostos,
              id_numerico: p.id_numerico
            })),
            cfop,
            ncm,
            natureza_operacao: naturezaOperacao
          }
        });

      if (error) throw error;

      await supabase
        .from('nf_configuracoes')
        .update({ ultimo_numero: proximoNumero })
        .eq('id', selectedConfig);

      setMensagem({ tipo: 'success', texto: `NF-e ${proximoNumero} registrada com sucesso! Aguardando processamento.` });

      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2000);
    } catch (error: any) {
      setMensagem({ tipo: 'error', texto: error.message || 'Erro ao emitir NF-e' });
    } finally {
      setEmitindo(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatCPFCNPJ = (doc: string) => {
    const clean = doc.replace(/\D/g, '');
    if (clean.length === 11) {
      return clean.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
    } else if (clean.length === 14) {
      return clean.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, '$1.$2.$3/$4-$5');
    }
    return doc;
  };

  const selectedConfigData = nfConfigs.find(c => c.id === selectedConfig);

  const modalContent = loading ? (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center">
      <div className="animate-spin w-8 h-8 border-2 border-[#00D4FF] border-t-transparent rounded-full" />
    </div>
  ) : (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-800 bg-gradient-to-r from-[#FFA500]/10 to-transparent">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-[#FFA500]/20">
              <FileText className="w-6 h-6 text-[#FFA500]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Emitir NF-e de Produtos</h2>
              <p className="text-sm text-gray-400">{pecas.length} {pecas.length === 1 ? 'peça selecionada' : 'peças selecionadas'}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          {mensagem && (
            <div className={`mb-4 p-4 rounded-lg flex items-center gap-3 ${
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="premium-card p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-[#FFA500] uppercase tracking-wider flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Tipo de Operação
                  </h3>
                </div>

                {nfConfigs.length === 0 ? (
                  <div className="text-center py-6 text-gray-400">
                    <AlertCircle className="w-10 h-10 mx-auto mb-2 opacity-50" />
                    <p>Nenhuma parametrização de NF-e cadastrada.</p>
                    <p className="text-xs mt-1">Configure em Atom Core Settings &gt; Nota Fiscal</p>
                  </div>
                ) : (
                  <div className="relative">
                    <button
                      onClick={() => setShowConfigDropdown(!showConfigDropdown)}
                      className="w-full flex items-center justify-between px-4 py-3 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 hover:border-[#FFA500]/50 transition-colors"
                    >
                      <span>{selectedConfigData?.nome || 'Selecione o tipo de operação'}</span>
                      <ChevronDown className={`w-5 h-5 transition-transform ${showConfigDropdown ? 'rotate-180' : ''}`} />
                    </button>

                    {showConfigDropdown && (
                      <div className="absolute left-0 right-0 top-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 overflow-hidden max-h-64 overflow-y-auto">
                        {nfConfigs.map(config => (
                          <button
                            key={config.id}
                            onClick={() => handleSelectConfig(config.id)}
                            className={`w-full px-4 py-3 text-left hover:bg-[#FFA500]/10 transition-colors ${
                              selectedConfig === config.id ? 'bg-[#FFA500]/20 text-[#FFA500]' : 'text-gray-200'
                            }`}
                          >
                            <div className="font-medium">{config.nome}</div>
                            <div className="text-xs text-gray-500 mt-0.5">
                              CFOP: {config.cfop || '-'} | Série: {config.serie || '1'}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {selectedConfigData && (
                  <div className="mt-4 grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">CFOP</label>
                      <input
                        type="text"
                        value={cfop}
                        onChange={(e) => setCfop(e.target.value)}
                        className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#FFA500]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">NCM</label>
                      <input
                        type="text"
                        value={ncm}
                        onChange={(e) => setNcm(e.target.value)}
                        className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#FFA500]"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] text-gray-500 mb-1">Natureza da Operação</label>
                      <input
                        type="text"
                        value={naturezaOperacao}
                        onChange={(e) => setNaturezaOperacao(e.target.value)}
                        className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#FFA500]"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="premium-card p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-[#00D4FF] uppercase tracking-wider flex items-center gap-2">
                    <User className="w-4 h-4" />
                    Destinatário
                  </h3>

                  {destinatariosSalvos.length > 0 && (
                    <div className="relative">
                      <button
                        onClick={() => setShowDestinatarioDropdown(!showDestinatarioDropdown)}
                        className="text-xs text-[#00D4FF] hover:text-[#00D4FF]/80 flex items-center gap-1"
                      >
                        Selecionar salvo
                        <ChevronDown className={`w-3 h-3 transition-transform ${showDestinatarioDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {showDestinatarioDropdown && (
                        <div className="absolute right-0 top-full mt-1 w-72 bg-gray-800 border border-gray-700 rounded-lg shadow-xl z-10 overflow-hidden max-h-64 overflow-y-auto">
                          {destinatariosSalvos.map(dest => (
                            <button
                              key={dest.id}
                              onClick={() => handleSelectDestinatario(dest)}
                              className="w-full px-4 py-3 text-left hover:bg-[#00D4FF]/10 transition-colors text-gray-200"
                            >
                              <div className="font-medium">{dest.nome}</div>
                              <div className="text-xs text-gray-500">{formatCPFCNPJ(dest.documento)}</div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2">
                      <label className="block text-[10px] text-gray-500 mb-1">Nome/Razão Social *</label>
                      <input
                        type="text"
                        value={destinatario.nome}
                        onChange={(e) => setDestinatario(prev => ({ ...prev, nome: e.target.value }))}
                        className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                        placeholder="Nome completo ou Razão Social"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">CPF/CNPJ *</label>
                      <input
                        type="text"
                        value={destinatario.documento}
                        onChange={(e) => setDestinatario(prev => ({ ...prev, documento: e.target.value }))}
                        className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                        placeholder="000.000.000-00"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">Tipo</label>
                      <select
                        value={destinatario.tipo_documento}
                        onChange={(e) => setDestinatario(prev => ({ ...prev, tipo_documento: e.target.value as 'cpf' | 'cnpj' }))}
                        className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                      >
                        <option value="cpf">CPF</option>
                        <option value="cnpj">CNPJ</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">IE</label>
                      <input
                        type="text"
                        value={destinatario.inscricao_estadual}
                        onChange={(e) => setDestinatario(prev => ({ ...prev, inscricao_estadual: e.target.value }))}
                        className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                        placeholder="Inscrição Estadual"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">Email</label>
                      <input
                        type="email"
                        value={destinatario.email}
                        onChange={(e) => setDestinatario(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">CEP</label>
                      <input
                        type="text"
                        value={destinatario.cep}
                        onChange={(e) => setDestinatario(prev => ({ ...prev, cep: e.target.value }))}
                        className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] text-gray-500 mb-1">Logradouro</label>
                      <input
                        type="text"
                        value={destinatario.logradouro}
                        onChange={(e) => setDestinatario(prev => ({ ...prev, logradouro: e.target.value }))}
                        className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">Número</label>
                      <input
                        type="text"
                        value={destinatario.numero}
                        onChange={(e) => setDestinatario(prev => ({ ...prev, numero: e.target.value }))}
                        className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">Bairro</label>
                      <input
                        type="text"
                        value={destinatario.bairro}
                        onChange={(e) => setDestinatario(prev => ({ ...prev, bairro: e.target.value }))}
                        className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">Cidade</label>
                      <input
                        type="text"
                        value={destinatario.cidade}
                        onChange={(e) => setDestinatario(prev => ({ ...prev, cidade: e.target.value }))}
                        className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-gray-500 mb-1">UF</label>
                      <input
                        type="text"
                        value={destinatario.estado}
                        onChange={(e) => setDestinatario(prev => ({ ...prev, estado: e.target.value }))}
                        className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                        maxLength={2}
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 cursor-pointer mt-2">
                    <input
                      type="checkbox"
                      checked={salvarDestinatario}
                      onChange={(e) => setSalvarDestinatario(e.target.checked)}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-[#00D4FF] focus:ring-[#00D4FF]"
                    />
                    <span className="text-sm text-gray-300">Salvar destinatário para uso futuro</span>
                  </label>
                </div>
              </div>

              <div className="premium-card p-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3">Observações</h3>
                <textarea
                  value={observacoes}
                  onChange={(e) => setObservacoes(e.target.value)}
                  className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#FFA500] resize-none"
                  rows={3}
                  placeholder="Observações adicionais..."
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="premium-card p-4 bg-gradient-to-br from-gray-800/50 to-gray-900/50">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                    <Eye className="w-4 h-4 text-[#00D4FF]" />
                    Preview da NF-e
                  </h3>
                  <span className="text-xs px-2 py-1 rounded bg-[#FFA500]/20 text-[#FFA500] font-mono">
                    N. {getProximoNumero()} | Série {getSerie()}
                  </span>
                </div>

                <div className="border border-gray-700 rounded-lg overflow-hidden">
                  <div className="bg-gradient-to-r from-[#00D4FF]/10 to-[#FFA500]/10 p-3 border-b border-gray-700">
                    <div className="text-center">
                      <p className="text-xs text-gray-500 uppercase">Nota Fiscal Eletrônica</p>
                      <p className="text-lg font-bold text-white">{unidade?.nome || 'Emitente'}</p>
                    </div>
                  </div>

                  <div className="p-3 border-b border-gray-700 bg-gray-800/30">
                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="text-gray-500 uppercase mb-1">Emitente</p>
                        <p className="text-white font-medium">{unidade?.nome || '-'}</p>
                        <p className="text-gray-400">{unidade?.cidade}, {unidade?.estado}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 uppercase mb-1">Destinatário</p>
                        <p className="text-white font-medium">{destinatario.nome || 'Não informado'}</p>
                        <p className="text-gray-400">{formatCPFCNPJ(destinatario.documento) || '-'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 border-b border-gray-700">
                    <p className="text-xs text-gray-500 uppercase mb-2">Produtos ({pecas.length})</p>
                    <div className="max-h-40 overflow-y-auto space-y-2">
                      {pecas.map((peca, idx) => (
                        <div key={peca.id} className="flex items-center justify-between text-xs p-2 bg-gray-800/50 rounded">
                          <div>
                            <span className="text-gray-400 mr-2">{idx + 1}.</span>
                            <span className="text-[#00D4FF] font-mono">{peca.pn}</span>
                            <span className="text-gray-400 ml-2 truncate max-w-[200px] inline-block align-bottom">
                              {peca.descricao}
                            </span>
                          </div>
                          <span className="text-[#39FF14] font-medium whitespace-nowrap">
                            {formatCurrency(peca.valor_com_impostos)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 bg-gradient-to-r from-[#39FF14]/10 to-transparent">
                    <div className="flex items-center justify-between">
                      <div className="text-xs text-gray-400">
                        <p>CFOP: {cfop}</p>
                        <p>NCM: {ncm || '-'}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-gray-500 uppercase">Valor Total</p>
                        <p className="text-2xl font-bold text-[#39FF14]">{formatCurrency(calcularTotalProdutos())}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="premium-card p-4">
                <h3 className="text-sm font-bold text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Peças Selecionadas
                </h3>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {pecas.map(peca => (
                    <div key={peca.id} className="flex items-center justify-between p-2 rounded bg-gray-800/50 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-[#39FF14] font-bold">#{peca.id_numerico || 'N/A'}</span>
                        <span className="text-[#00D4FF] font-mono">{peca.pn}</span>
                      </div>
                      <span className="text-gray-300">{formatCurrency(peca.valor_com_impostos)}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-3 pt-3 border-t border-gray-700 flex justify-between items-center">
                  <span className="text-sm text-gray-400">{pecas.length} {pecas.length === 1 ? 'item' : 'itens'}</span>
                  <span className="text-lg font-bold text-[#39FF14]">{formatCurrency(calcularTotalProdutos())}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-800 bg-gray-900/50">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors font-medium"
          >
            Cancelar
          </button>
          <button
            onClick={handleEmitirNF}
            disabled={emitindo || !selectedConfig || !destinatario.nome || !destinatario.documento}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
    </div>
  );

  return createPortal(modalContent, document.body);
}
