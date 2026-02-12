import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Plus, Edit, Trash2, Save, X, Receipt, FileText, Building2, Percent, AlertCircle, CheckCircle, Calculator, Globe, Landmark, Filter, Code, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface NFConfig {
  id: string;
  unidade_id: string;
  tipo: 'nfse' | 'nfe';
  nome: string;
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
  cst_icms: string | null;
  cst_pis: string | null;
  cst_cofins: string | null;
  natureza_operacao: string | null;
  regime_tributario: string | null;
  observacoes_padrao: string | null;
  numero_inicial: number;
  serie: string | null;
  ultimo_numero: number;
  tipo_emissao: string | null;
  regime_especial_tributacao: string | null;
  codigo_tributario_municipal: string | null;
  codigo_nbs: string | null;
  iss_aliquota: number;
  iss_retido: boolean;
  iss_retencao_percentual: number;
  cst_ibs_cbs: string | null;
  classificacao_tributaria: string | null;
  base_calculo_percentual: number;
  ibs_estadual_aliquota: number;
  ibs_estadual_diferimento: number;
  ibs_estadual_reducao: number;
  ibs_municipal_aliquota: number;
  ibs_municipal_diferimento: number;
  ibs_municipal_reducao: number;
  cbs_federal_aliquota: number;
  cbs_federal_diferimento: number;
  cbs_federal_reducao: number;
  is_cst: string | null;
  is_classificacao_tributaria: string | null;
  is_aliquota: number;
  is_aliquota_especifica: number;
  nfe_tipo_nota: string | null;
  nfe_tipo_ambiente: string | null;
  nfe_tipo_documento: string | null;
  nfe_finalidade: string | null;
  nfe_modelo_documento: string | null;
  nfe_informacoes_fisco: string | null;
  nfe_ultima_nf_emitida: number;
  icms_csosn: string | null;
  icms_cst: string | null;
  icms_aliquota: number;
  ipi_cst: string | null;
  ipi_aliquota: number;
  issqn_cst: string | null;
  issqn_aliquota: number;
  issqn_base: number;
  pis_cst: string | null;
  pis_aliquota: number;
  pis_base_calculo: number;
  cofins_cst: string | null;
  cofins_aliquota: number;
  cofins_base_calculo: number;
  ativo: boolean;
  created_at: string;
}

interface NFExcecao {
  id: string;
  configuracao_id: string;
  unidade_id: string;
  nome: string;
  tipo_imposto: string;
  estados: string[] | null;
  produtos_ids: string[] | null;
  ncms: string[] | null;
  origens: string[] | null;
  csts: string[] | null;
  cfops: string[] | null;
  valores: any;
  ativo: boolean;
  prioridade: number;
}

interface Unidade {
  id: string;
  nome: string;
}

interface ConfiguracoesNFProps {
  unidades: Unidade[];
}

interface Variavel {
  variavel: string;
  descricao: string;
  categoria: string;
}

const FORM_INICIAL = {
  nome: '',
  tipo: 'nfse' as const,
  codigo_servico: '',
  cnae: '',
  aliquota_iss: '5',
  retencao_ir: '0',
  retencao_pis: '0',
  retencao_cofins: '0',
  retencao_csll: '0',
  retencao_inss: '0',
  cfop: '',
  ncm: '',
  cst_icms: '',
  cst_pis: '',
  cst_cofins: '',
  natureza_operacao: '',
  regime_tributario: '1',
  observacoes_padrao: '',
  unidade_id: '',
  numero_inicial: '1',
  serie: '1',
  tipo_emissao: 'simples_nacional',
  regime_especial_tributacao: '',
  codigo_tributario_municipal: '',
  codigo_nbs: '',
  provedor: 'nacional',
  nfse_tipo_ambiente: '2',
  nfse_codigo_tributacao_nacional: '',
  nfse_codigo_nbs: '',
  nfse_codigo_municipio_prestacao: '',
  nfse_descricao_servico: '',
  nfse_trib_issqn: '1',
  nfse_codigo_municipio_ibge: '',
  iss_aliquota: '5',
  iss_retido: false,
  iss_retencao_percentual: '0',
  cst_ibs_cbs: '',
  classificacao_tributaria: '',
  base_calculo_percentual: '100',
  ibs_estadual_aliquota: '0',
  ibs_estadual_diferimento: '0',
  ibs_estadual_reducao: '0',
  ibs_municipal_aliquota: '0',
  ibs_municipal_diferimento: '0',
  ibs_municipal_reducao: '0',
  cbs_federal_aliquota: '0',
  cbs_federal_diferimento: '0',
  cbs_federal_reducao: '0',
  is_cst: '',
  is_classificacao_tributaria: '',
  is_aliquota: '0',
  is_aliquota_especifica: '0',
  nfe_tipo_nota: '1',
  nfe_tipo_ambiente: '2',
  nfe_tipo_documento: '55',
  nfe_finalidade: '1',
  nfe_modelo_documento: '55',
  nfe_informacoes_fisco: '',
  nfe_ultima_nf_emitida: '0',
  icms_csosn: '',
  icms_cst: '',
  icms_aliquota: '0',
  ipi_cst: '',
  ipi_aliquota: '0',
  issqn_cst: '',
  issqn_aliquota: '0',
  issqn_base: '100',
  pis_cst: '',
  pis_aliquota: '0',
  pis_base_calculo: '100',
  cofins_cst: '',
  cofins_aliquota: '0',
  cofins_base_calculo: '100',
  ativo: true
};

const ESTADOS_BRASIL = ['AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'];

export function ConfiguracoesNF({ unidades }: ConfiguracoesNFProps) {
  const [configs, setConfigs] = useState<NFConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedUnidade, setSelectedUnidade] = useState<string>('');
  const [form, setForm] = useState(FORM_INICIAL);
  const [saving, setSaving] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  const [excecoes, setExcecoes] = useState<NFExcecao[]>([]);
  const [showExcecaoModal, setShowExcecaoModal] = useState(false);
  const [tipoImpostoExcecao, setTipoImpostoExcecao] = useState<string>('');
  const [showVariaveisModal, setShowVariaveisModal] = useState(false);
  const [variaveis, setVariaveis] = useState<Variavel[]>([]);

  useEffect(() => {
    loadConfigs();
    loadVariaveis();
  }, []);

  useEffect(() => {
    if (editingId) {
      loadExcecoes(editingId);
    }
  }, [editingId]);

  const loadConfigs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('nf_configuracoes')
        .select('*')
        .order('nome');

      if (error) throw error;
      setConfigs(data || []);
    } catch (error) {
      console.error('Erro ao carregar configuracoes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadExcecoes = async (configId: string) => {
    try {
      const { data, error } = await supabase
        .from('nf_excecoes_fiscais')
        .select('*')
        .eq('configuracao_id', configId)
        .order('prioridade', { ascending: false });

      if (error) throw error;
      setExcecoes(data || []);
    } catch (error) {
      console.error('Erro ao carregar exceções:', error);
    }
  };

  const loadVariaveis = async () => {
    try {
      const { data, error } = await supabase
        .from('nf_variaveis_disponiveis')
        .select('variavel, descricao, categoria')
        .eq('ativo', true)
        .order('categoria', { ascending: true });

      if (error) throw error;
      setVariaveis(data || []);
    } catch (error) {
      console.error('Erro ao carregar variáveis:', error);
    }
  };

  const handleOpenModal = (config?: NFConfig) => {
    if (config) {
      setEditingId(config.id);
      setForm({
        nome: config.nome,
        tipo: config.tipo,
        codigo_servico: config.codigo_servico || '',
        cnae: config.cnae || '',
        aliquota_iss: String(config.aliquota_iss || 0),
        retencao_ir: String(config.retencao_ir || 0),
        retencao_pis: String(config.retencao_pis || 0),
        retencao_cofins: String(config.retencao_cofins || 0),
        retencao_csll: String(config.retencao_csll || 0),
        retencao_inss: String(config.retencao_inss || 0),
        cfop: config.cfop || '',
        ncm: config.ncm || '',
        cst_icms: config.cst_icms || '',
        cst_pis: config.cst_pis || '',
        cst_cofins: config.cst_cofins || '',
        natureza_operacao: config.natureza_operacao || '',
        regime_tributario: config.regime_tributario || '',
        observacoes_padrao: config.observacoes_padrao || '',
        unidade_id: config.unidade_id,
        numero_inicial: String(config.numero_inicial || 1),
        serie: config.serie || '1',
        tipo_emissao: config.tipo_emissao || 'simples_nacional',
        regime_especial_tributacao: config.regime_especial_tributacao || '',
        codigo_tributario_municipal: config.codigo_tributario_municipal || '',
        codigo_nbs: config.codigo_nbs || '',
        provedor: (config as any).provedor || 'nacional',
        nfse_tipo_ambiente: String((config as any).nfse_tipo_ambiente || 2),
        nfse_codigo_tributacao_nacional: (config as any).nfse_codigo_tributacao_nacional || '',
        nfse_codigo_nbs: (config as any).nfse_codigo_nbs || '',
        nfse_codigo_municipio_prestacao: (config as any).nfse_codigo_municipio_prestacao || '',
        nfse_descricao_servico: (config as any).nfse_descricao_servico || '',
        nfse_trib_issqn: ((config as any).nfse_trib_issqn !== null && (config as any).nfse_trib_issqn !== undefined) ? String((config as any).nfse_trib_issqn) : '1',
        nfse_codigo_municipio_ibge: (config as any).nfse_codigo_municipio_ibge || '',
        iss_aliquota: String(config.iss_aliquota || 0),
        iss_retido: config.iss_retido || false,
        iss_retencao_percentual: String(config.iss_retencao_percentual || 0),
        cst_ibs_cbs: config.cst_ibs_cbs || '',
        classificacao_tributaria: config.classificacao_tributaria || '',
        base_calculo_percentual: String(config.base_calculo_percentual || 100),
        ibs_estadual_aliquota: String(config.ibs_estadual_aliquota || 0),
        ibs_estadual_diferimento: String(config.ibs_estadual_diferimento || 0),
        ibs_estadual_reducao: String(config.ibs_estadual_reducao || 0),
        ibs_municipal_aliquota: String(config.ibs_municipal_aliquota || 0),
        ibs_municipal_diferimento: String(config.ibs_municipal_diferimento || 0),
        ibs_municipal_reducao: String(config.ibs_municipal_reducao || 0),
        cbs_federal_aliquota: String(config.cbs_federal_aliquota || 0),
        cbs_federal_diferimento: String(config.cbs_federal_diferimento || 0),
        cbs_federal_reducao: String(config.cbs_federal_reducao || 0),
        is_cst: config.is_cst || '',
        is_classificacao_tributaria: config.is_classificacao_tributaria || '',
        is_aliquota: String(config.is_aliquota || 0),
        is_aliquota_especifica: String(config.is_aliquota_especifica || 0),
        nfe_tipo_nota: config.nfe_tipo_nota || '1',
        nfe_tipo_ambiente: config.nfe_tipo_ambiente || '2',
        nfe_tipo_documento: config.nfe_tipo_documento || '55',
        nfe_finalidade: config.nfe_finalidade || '1',
        nfe_modelo_documento: config.nfe_modelo_documento || '55',
        nfe_informacoes_fisco: config.nfe_informacoes_fisco || '',
        nfe_ultima_nf_emitida: String(config.nfe_ultima_nf_emitida || 0),
        icms_csosn: config.icms_csosn || '',
        icms_cst: config.icms_cst || '',
        icms_aliquota: String(config.icms_aliquota || 0),
        ipi_cst: config.ipi_cst || '',
        ipi_aliquota: String(config.ipi_aliquota || 0),
        issqn_cst: config.issqn_cst || '',
        issqn_aliquota: String(config.issqn_aliquota || 0),
        issqn_base: String(config.issqn_base || 100),
        pis_cst: config.pis_cst || '',
        pis_aliquota: String(config.pis_aliquota || 0),
        pis_base_calculo: String(config.pis_base_calculo || 100),
        cofins_cst: config.cofins_cst || '',
        cofins_aliquota: String(config.cofins_aliquota || 0),
        cofins_base_calculo: String(config.cofins_base_calculo || 100),
        ativo: config.ativo
      });
    } else {
      setEditingId(null);
      setForm({ ...FORM_INICIAL, unidade_id: selectedUnidade || unidades[0]?.id || '' });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingId(null);
    setForm(FORM_INICIAL);
    setExcecoes([]);
  };

  const handleSave = async () => {
    if (!form.nome.trim()) {
      setMensagem({ tipo: 'error', texto: 'Nome da parametrizacao e obrigatorio' });
      return;
    }

    if (!form.unidade_id) {
      setMensagem({ tipo: 'error', texto: 'Selecione uma unidade' });
      return;
    }

    setSaving(true);
    setMensagem(null);

    try {
      const payload: any = {
        nome: form.nome.trim(),
        tipo: form.tipo,
        unidade_id: form.unidade_id,
        provedor: form.provedor || 'nacional',
        nfse_tipo_ambiente: parseInt(form.nfse_tipo_ambiente) || 2,
        nfse_codigo_tributacao_nacional: form.nfse_codigo_tributacao_nacional || null,
        nfse_codigo_nbs: form.nfse_codigo_nbs || null,
        nfse_codigo_municipio_prestacao: form.nfse_codigo_municipio_prestacao || null,
        nfse_descricao_servico: form.nfse_descricao_servico || null,
        nfse_trib_issqn: form.nfse_trib_issqn !== '' ? parseInt(form.nfse_trib_issqn) : 1,
        nfse_codigo_municipio_ibge: form.nfse_codigo_municipio_ibge || null,
        codigo_servico: form.codigo_servico || null,
        cnae: form.cnae || null,
        aliquota_iss: parseFloat(form.aliquota_iss) || 0,
        retencao_ir: parseFloat(form.retencao_ir) || 0,
        retencao_pis: parseFloat(form.retencao_pis) || 0,
        retencao_cofins: parseFloat(form.retencao_cofins) || 0,
        retencao_csll: parseFloat(form.retencao_csll) || 0,
        retencao_inss: parseFloat(form.retencao_inss) || 0,
        cfop: form.cfop || null,
        ncm: form.ncm || null,
        cst_icms: form.cst_icms || null,
        cst_pis: form.cst_pis || null,
        cst_cofins: form.cst_cofins || null,
        natureza_operacao: form.natureza_operacao || null,
        regime_tributario: form.regime_tributario || null,
        observacoes_padrao: form.observacoes_padrao || null,
        numero_inicial: parseInt(form.numero_inicial) || 1,
        serie: form.serie || '1',
        tipo_emissao: form.tipo_emissao || null,
        regime_especial_tributacao: form.regime_especial_tributacao || null,
        codigo_tributario_municipal: form.codigo_tributario_municipal || null,
        codigo_nbs: form.codigo_nbs || null,
        iss_aliquota: parseFloat(form.iss_aliquota) || 0,
        iss_retido: form.iss_retido,
        iss_retencao_percentual: parseFloat(form.iss_retencao_percentual) || 0,
        cst_ibs_cbs: form.cst_ibs_cbs || null,
        classificacao_tributaria: form.classificacao_tributaria || null,
        base_calculo_percentual: parseFloat(form.base_calculo_percentual) || 100,
        ibs_estadual_aliquota: parseFloat(form.ibs_estadual_aliquota) || 0,
        ibs_estadual_diferimento: parseFloat(form.ibs_estadual_diferimento) || 0,
        ibs_estadual_reducao: parseFloat(form.ibs_estadual_reducao) || 0,
        ibs_municipal_aliquota: parseFloat(form.ibs_municipal_aliquota) || 0,
        ibs_municipal_diferimento: parseFloat(form.ibs_municipal_diferimento) || 0,
        ibs_municipal_reducao: parseFloat(form.ibs_municipal_reducao) || 0,
        cbs_federal_aliquota: parseFloat(form.cbs_federal_aliquota) || 0,
        cbs_federal_diferimento: parseFloat(form.cbs_federal_diferimento) || 0,
        cbs_federal_reducao: parseFloat(form.cbs_federal_reducao) || 0,
        is_cst: form.is_cst || null,
        is_classificacao_tributaria: form.is_classificacao_tributaria || null,
        is_aliquota: parseFloat(form.is_aliquota) || 0,
        is_aliquota_especifica: parseFloat(form.is_aliquota_especifica) || 0,
        nfe_tipo_nota: form.nfe_tipo_nota || null,
        nfe_tipo_ambiente: form.nfe_tipo_ambiente || null,
        nfe_tipo_documento: form.nfe_tipo_documento || null,
        nfe_finalidade: form.nfe_finalidade || null,
        nfe_modelo_documento: form.nfe_modelo_documento || null,
        nfe_informacoes_fisco: form.nfe_informacoes_fisco || null,
        nfe_ultima_nf_emitida: parseInt(form.nfe_ultima_nf_emitida) || 0,
        icms_csosn: form.icms_csosn || null,
        icms_cst: form.icms_cst || null,
        icms_aliquota: parseFloat(form.icms_aliquota) || 0,
        ipi_cst: form.ipi_cst || null,
        ipi_aliquota: parseFloat(form.ipi_aliquota) || 0,
        issqn_cst: form.issqn_cst || null,
        issqn_aliquota: parseFloat(form.issqn_aliquota) || 0,
        issqn_base: parseFloat(form.issqn_base) || 100,
        pis_cst: form.pis_cst || null,
        pis_aliquota: parseFloat(form.pis_aliquota) || 0,
        pis_base_calculo: parseFloat(form.pis_base_calculo) || 100,
        cofins_cst: form.cofins_cst || null,
        cofins_aliquota: parseFloat(form.cofins_aliquota) || 0,
        cofins_base_calculo: parseFloat(form.cofins_base_calculo) || 100,
        ativo: form.ativo
      };

      if (editingId) {
        const { error } = await supabase
          .from('nf_configuracoes')
          .update(payload)
          .eq('id', editingId);

        if (error) throw error;
        setMensagem({ tipo: 'success', texto: 'Parametrizacao atualizada com sucesso!' });
      } else {
        const { error } = await supabase
          .from('nf_configuracoes')
          .insert(payload);

        if (error) throw error;
        setMensagem({ tipo: 'success', texto: 'Parametrizacao criada com sucesso!' });
      }

      await loadConfigs();
      setTimeout(() => handleCloseModal(), 1500);
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      setMensagem({ tipo: 'error', texto: error.message || 'Erro ao salvar configuracao' });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta parametrizacao?')) return;

    try {
      const { error } = await supabase
        .from('nf_configuracoes')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setMensagem({ tipo: 'success', texto: 'Parametrizacao excluida com sucesso!' });
      await loadConfigs();
    } catch (error: any) {
      console.error('Erro ao excluir:', error);
      setMensagem({ tipo: 'error', texto: error.message || 'Erro ao excluir' });
    }
  };

  const handleDeleteExcecao = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta exceção?')) return;

    try {
      const { error } = await supabase
        .from('nf_excecoes_fiscais')
        .delete()
        .eq('id', id);

      if (error) throw error;
      if (editingId) {
        await loadExcecoes(editingId);
      }
      setMensagem({ tipo: 'success', texto: 'Exceção excluída com sucesso!' });
    } catch (error: any) {
      console.error('Erro ao excluir exceção:', error);
      setMensagem({ tipo: 'error', texto: error.message || 'Erro ao excluir exceção' });
    }
  };

  const insertVariavel = (variavel: string) => {
    const textarea = document.getElementById('observacoes_padrao') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = form.observacoes_padrao || '';
      const before = text.substring(0, start);
      const after = text.substring(end, text.length);
      setForm(prev => ({ ...prev, observacoes_padrao: before + variavel + after }));

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variavel.length, start + variavel.length);
      }, 0);
    }
    setShowVariaveisModal(false);
  };

  const insertVariavelFisco = (variavel: string) => {
    const textarea = document.getElementById('nfe_informacoes_fisco') as HTMLTextAreaElement;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = form.nfe_informacoes_fisco || '';
      const before = text.substring(0, start);
      const after = text.substring(end, text.length);
      setForm(prev => ({ ...prev, nfe_informacoes_fisco: before + variavel + after }));

      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + variavel.length, start + variavel.length);
      }, 0);
    }
    setShowVariaveisModal(false);
  };

  const filteredConfigs = selectedUnidade
    ? configs.filter(c => c.unidade_id === selectedUnidade)
    : configs;

  const getUnidadeNome = (unidadeId: string) => {
    return unidades.find(u => u.id === unidadeId)?.nome || 'Unidade desconhecida';
  };

  const variaveisPorCategoria = variaveis.reduce((acc, v) => {
    if (!acc[v.categoria]) acc[v.categoria] = [];
    acc[v.categoria].push(v);
    return acc;
  }, {} as Record<string, Variavel[]>);

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

      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4">
          <label className="text-sm text-gray-400">Filtrar por Unidade:</label>
          <select
            value={selectedUnidade}
            onChange={(e) => setSelectedUnidade(e.target.value)}
            className="px-4 py-2 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 focus:outline-none focus:border-[#00D4FF]"
          >
            <option value="">Todas as unidades</option>
            {unidades.map(u => (
              <option key={u.id} value={u.id}>{u.nome}</option>
            ))}
          </select>
        </div>

        <button
          onClick={() => handleOpenModal()}
          className="neon-button flex items-center gap-2 px-4 py-2"
        >
          <Plus className="w-4 h-4" />
          Nova Parametrizacao
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="premium-card p-4">
          <h3 className="text-lg font-bold text-[#00D4FF] mb-4 flex items-center gap-2">
            <Receipt className="w-5 h-5" />
            NFS-e (Nota Fiscal de Servico)
          </h3>

          {filteredConfigs.filter(c => c.tipo === 'nfse').length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <Receipt className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma parametrizacao de NFS-e cadastrada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredConfigs.filter(c => c.tipo === 'nfse').map(config => (
                <div
                  key={config.id}
                  className={`p-4 rounded-lg border transition-all ${
                    config.ativo
                      ? 'bg-gray-800/50 border-gray-700 hover:border-[#00D4FF]/50'
                      : 'bg-gray-900/50 border-gray-800 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-bold text-white flex items-center gap-2">
                        {config.nome}
                        {!config.ativo && (
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-400">Inativo</span>
                        )}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        <Building2 className="w-3 h-3 inline mr-1" />
                        {getUnidadeNome(config.unidade_id)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className="text-xs px-2 py-1 rounded bg-[#00D4FF]/10 text-[#00D4FF]">
                          ISS: {config.iss_aliquota || config.aliquota_iss}%
                        </span>
                        {(config as any).provedor && (
                          <span className={`text-xs px-2 py-1 rounded ${
                            (config as any).provedor === 'nacional'
                              ? 'bg-[#FBB024]/10 text-[#FBB024]'
                              : 'bg-blue-500/10 text-blue-400'
                          }`}>
                            {(config as any).provedor === 'nacional' ? 'Nacional' : 'Municipal'}
                          </span>
                        )}
                        {config.codigo_servico && (
                          <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">
                            LC 116: {config.codigo_servico}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <button
                        onClick={() => handleOpenModal(config)}
                        className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-[#00D4FF] transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(config.id)}
                        className="p-2 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="premium-card p-4">
          <h3 className="text-lg font-bold text-[#FFA500] mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5" />
            NF-e (Nota Fiscal Eletronica)
          </h3>

          {filteredConfigs.filter(c => c.tipo === 'nfe').length === 0 ? (
            <div className="text-center py-8 text-gray-400">
              <FileText className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Nenhuma parametrizacao de NF-e cadastrada</p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredConfigs.filter(c => c.tipo === 'nfe').map(config => (
                <div
                  key={config.id}
                  className={`p-4 rounded-lg border transition-all ${
                    config.ativo
                      ? 'bg-gray-800/50 border-gray-700 hover:border-[#FFA500]/50'
                      : 'bg-gray-900/50 border-gray-800 opacity-60'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <h4 className="font-bold text-white flex items-center gap-2">
                        {config.nome}
                        {!config.ativo && (
                          <span className="text-xs px-2 py-0.5 rounded bg-gray-700 text-gray-400">Inativo</span>
                        )}
                      </h4>
                      <p className="text-xs text-gray-500 mt-1">
                        <Building2 className="w-3 h-3 inline mr-1" />
                        {getUnidadeNome(config.unidade_id)}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {config.cfop && (
                          <span className="text-xs px-2 py-1 rounded bg-[#FFA500]/10 text-[#FFA500]">
                            CFOP: {config.cfop}
                          </span>
                        )}
                        {config.icms_csosn && (
                          <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">
                            CSOSN: {config.icms_csosn}
                          </span>
                        )}
                        {config.icms_cst && (
                          <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">
                            CST ICMS: {config.icms_cst}
                          </span>
                        )}
                        {config.natureza_operacao && (
                          <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">
                            {config.natureza_operacao}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-2">
                      <button
                        onClick={() => handleOpenModal(config)}
                        className="p-2 rounded-lg hover:bg-gray-700 text-gray-400 hover:text-[#FFA500] transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(config.id)}
                        className="p-2 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && createPortal(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-6xl max-h-[95vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                {form.tipo === 'nfse' ? <Receipt className="w-5 h-5 text-[#00D4FF]" /> : <FileText className="w-5 h-5 text-[#FFA500]" />}
                {editingId ? 'Editar Parametrizacao' : 'Nova Parametrizacao'}
              </h3>
              <button
                onClick={handleCloseModal}
                className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Titulo/Nome da Parametrizacao *
                  </label>
                  <input
                    type="text"
                    value={form.nome}
                    onChange={(e) => setForm(prev => ({ ...prev, nome: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                    placeholder="Ex: Servico de Manutencao"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Tipo de Nota Fiscal *
                  </label>
                  <select
                    value={form.tipo}
                    onChange={(e) => setForm(prev => ({ ...prev, tipo: e.target.value as 'nfse' | 'nfe' }))}
                    className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                  >
                    <option value="nfse">NFS-e (Servicos)</option>
                    <option value="nfe">NF-e (Produtos)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Unidade *
                  </label>
                  <select
                    value={form.unidade_id}
                    onChange={(e) => setForm(prev => ({ ...prev, unidade_id: e.target.value }))}
                    className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                  >
                    <option value="">Selecione...</option>
                    {unidades.map(u => (
                      <option key={u.id} value={u.id}>{u.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Numero Inicial</label>
                  <input
                    type="number"
                    value={form.numero_inicial}
                    onChange={(e) => setForm(prev => ({ ...prev, numero_inicial: e.target.value }))}
                    className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                    min="1"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">Serie</label>
                  <input
                    type="text"
                    value={form.serie}
                    onChange={(e) => setForm(prev => ({ ...prev, serie: e.target.value }))}
                    className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                    placeholder="Ex: 1"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.ativo}
                      onChange={(e) => setForm(prev => ({ ...prev, ativo: e.target.checked }))}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-[#00D4FF] focus:ring-[#00D4FF]"
                    />
                    <span className="text-sm text-gray-300">Parametrizacao Ativa</span>
                  </label>
                </div>
              </div>

              {form.tipo === 'nfse' && (
                <>
                  <div className="border-t border-gray-800 pt-4">
                    <h4 className="text-sm font-bold text-[#00D4FF] uppercase mb-3 flex items-center gap-2">
                      <Receipt className="w-4 h-4" />
                      Dados Fiscais NFS-e
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Provedor NFS-e</label>
                        <select
                          value={form.provedor}
                          onChange={(e) => setForm(prev => ({ ...prev, provedor: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                        >
                          <option value="nacional">NFS-e Nacional</option>
                          <option value="municipal">NFS-e Municipal</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Tipo de Emissao</label>
                        <select
                          value={form.tipo_emissao}
                          onChange={(e) => setForm(prev => ({ ...prev, tipo_emissao: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                        >
                          <option value="simples_nacional">Optante Simples Nacional</option>
                          <option value="nfse_nacional">NFSe Nacional</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[10px] text-gray-500 mb-1">Natureza da Operacao</label>
                        <input
                          type="text"
                          value={form.natureza_operacao}
                          onChange={(e) => setForm(prev => ({ ...prev, natureza_operacao: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                          placeholder="Ex: Prestacao de Servicos"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Regime Especial Tributacao</label>
                        <select
                          value={form.regime_especial_tributacao}
                          onChange={(e) => setForm(prev => ({ ...prev, regime_especial_tributacao: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                        >
                          <option value="">Nenhum</option>
                          <option value="1">Microempresa Municipal</option>
                          <option value="2">Estimativa</option>
                          <option value="3">Sociedade de Profissionais</option>
                          <option value="4">Cooperativa</option>
                          <option value="5">MEI</option>
                          <option value="6">ME/EPP Simples Nacional</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Codigo Servico (LC 116)</label>
                        <input
                          type="text"
                          value={form.codigo_servico}
                          onChange={(e) => setForm(prev => ({ ...prev, codigo_servico: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                          placeholder="Ex: 14.01"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">CNAE</label>
                        <input
                          type="text"
                          value={form.cnae}
                          onChange={(e) => setForm(prev => ({ ...prev, cnae: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                          placeholder="Ex: 9512500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Codigo Tributario Municipal</label>
                        <input
                          type="text"
                          value={form.codigo_tributario_municipal}
                          onChange={(e) => setForm(prev => ({ ...prev, codigo_tributario_municipal: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                          placeholder="Ex: 1401"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Codigo NBS</label>
                        <input
                          type="text"
                          value={form.codigo_nbs}
                          onChange={(e) => setForm(prev => ({ ...prev, codigo_nbs: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                          placeholder="Ex: 1.1401.00.00"
                        />
                      </div>
                    </div>
                  </div>

                  {form.provedor === 'nacional' && (
                    <div className="border-t border-gray-800 pt-4">
                      <h4 className="text-sm font-bold text-[#FBB024] uppercase mb-3 flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        NFS-e Nacional - Campos DPS
                      </h4>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">Ambiente</label>
                          <select
                            value={form.nfse_tipo_ambiente}
                            onChange={(e) => setForm(prev => ({ ...prev, nfse_tipo_ambiente: e.target.value }))}
                            className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#FBB024]"
                          >
                            <option value="2">2 - Homologacao</option>
                            <option value="1">1 - Producao</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">cTribNac (Cod. Tributacao Nacional)</label>
                          <input
                            type="text"
                            value={form.nfse_codigo_tributacao_nacional}
                            onChange={(e) => setForm(prev => ({ ...prev, nfse_codigo_tributacao_nacional: e.target.value }))}
                            className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#FBB024] font-mono"
                            placeholder="Ex: 140101"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">cNBS (Cod. NBS)</label>
                          <input
                            type="text"
                            value={form.nfse_codigo_nbs}
                            onChange={(e) => setForm(prev => ({ ...prev, nfse_codigo_nbs: e.target.value }))}
                            className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#FBB024] font-mono"
                            placeholder="Ex: 120018100"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">cLocPrestacao (Municipio Prestacao)</label>
                          <input
                            type="text"
                            value={form.nfse_codigo_municipio_prestacao}
                            onChange={(e) => setForm(prev => ({ ...prev, nfse_codigo_municipio_prestacao: e.target.value }))}
                            className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#FBB024] font-mono"
                            placeholder="Ex: 3170206"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">tribISSQN</label>
                          <select
                            value={form.nfse_trib_issqn}
                            onChange={(e) => setForm(prev => ({ ...prev, nfse_trib_issqn: e.target.value }))}
                            className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#FBB024]"
                          >
                            <option value="0">0 - Reserva</option>
                            <option value="1">1 - Exigivel</option>
                            <option value="2">2 - Nao Incidencia</option>
                            <option value="3">3 - Isencao</option>
                            <option value="4">4 - Imunidade</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">cMun IBGE (Tomador Padrao)</label>
                          <input
                            type="text"
                            value={form.nfse_codigo_municipio_ibge}
                            onChange={(e) => setForm(prev => ({ ...prev, nfse_codigo_municipio_ibge: e.target.value }))}
                            className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#FBB024] font-mono"
                            placeholder="Ex: 3550308"
                          />
                        </div>
                        <div className="md:col-span-3">
                          <label className="block text-[10px] text-gray-500 mb-1">xDescServ (Descricao Padrao do Servico)</label>
                          <input
                            type="text"
                            value={form.nfse_descricao_servico}
                            onChange={(e) => setForm(prev => ({ ...prev, nfse_descricao_servico: e.target.value }))}
                            className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#FBB024]"
                            placeholder="Ex: Lubrificacao, limpeza, lustração, revisão, carga e recarga..."
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="border-t border-gray-800 pt-4">
                    <h4 className="text-sm font-bold text-[#39FF14] uppercase mb-3 flex items-center gap-2">
                      <Calculator className="w-4 h-4" />
                      ISS - Imposto Sobre Servicos
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Aliquota ISS (%)</label>
                        <input
                          type="number"
                          value={form.iss_aliquota}
                          onChange={(e) => setForm(prev => ({ ...prev, iss_aliquota: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#39FF14]"
                          step="0.01"
                        />
                      </div>
                      <div className="flex items-end pb-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={form.iss_retido}
                            onChange={(e) => setForm(prev => ({ ...prev, iss_retido: e.target.checked }))}
                            className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-[#39FF14] focus:ring-[#39FF14]"
                          />
                          <span className="text-sm text-gray-300">ISS Retido na Fonte</span>
                        </label>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">% Retencao ISS</label>
                        <input
                          type="number"
                          value={form.iss_retencao_percentual}
                          onChange={(e) => setForm(prev => ({ ...prev, iss_retencao_percentual: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#39FF14]"
                          step="0.01"
                          disabled={!form.iss_retido}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-800 pt-4">
                    <h4 className="text-sm font-bold text-[#FFA500] uppercase mb-3 flex items-center gap-2">
                      <Percent className="w-4 h-4" />
                      Aliquotas Federais
                    </h4>
                    <div className="grid grid-cols-5 gap-3">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">PIS (%)</label>
                        <input
                          type="number"
                          value={form.retencao_pis}
                          onChange={(e) => setForm(prev => ({ ...prev, retencao_pis: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#FFA500]"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">COFINS (%)</label>
                        <input
                          type="number"
                          value={form.retencao_cofins}
                          onChange={(e) => setForm(prev => ({ ...prev, retencao_cofins: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#FFA500]"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">INSS (%)</label>
                        <input
                          type="number"
                          value={form.retencao_inss}
                          onChange={(e) => setForm(prev => ({ ...prev, retencao_inss: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#FFA500]"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">IR (%)</label>
                        <input
                          type="number"
                          value={form.retencao_ir}
                          onChange={(e) => setForm(prev => ({ ...prev, retencao_ir: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#FFA500]"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">CSLL (%)</label>
                        <input
                          type="number"
                          value={form.retencao_csll}
                          onChange={(e) => setForm(prev => ({ ...prev, retencao_csll: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#FFA500]"
                          step="0.01"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-800 pt-4">
                    <h4 className="text-sm font-bold uppercase mb-3 flex items-center gap-2" style={{ color: '#FF6B6B' }}>
                      <Globe className="w-4 h-4" />
                      IBS/CBS - Reforma Tributaria
                    </h4>
                    <p className="text-xs text-gray-500 mb-4">Simples Nacional - Reforma Tributaria (EC 132/2023) - Transicao 2026-2033</p>

                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">CST IBS/CBS</label>
                        <input
                          type="text"
                          value={form.cst_ibs_cbs}
                          onChange={(e) => setForm(prev => ({ ...prev, cst_ibs_cbs: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#FF6B6B]"
                          placeholder="Ex: 00"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Classificacao Tributaria (cClassTrib)</label>
                        <input
                          type="text"
                          value={form.classificacao_tributaria}
                          onChange={(e) => setForm(prev => ({ ...prev, classificacao_tributaria: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#FF6B6B]"
                          placeholder="Ex: 01"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Base Calculo (%)</label>
                        <input
                          type="number"
                          value={form.base_calculo_percentual}
                          onChange={(e) => setForm(prev => ({ ...prev, base_calculo_percentual: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#FF6B6B]"
                          step="0.01"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                        <h5 className="text-xs font-bold text-blue-400 mb-2 flex items-center gap-1">
                          <Landmark className="w-3 h-3" />
                          IBS Estadual (UF)
                        </h5>
                        <div className="space-y-2">
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">Aliquota (%)</label>
                            <input
                              type="number"
                              value={form.ibs_estadual_aliquota}
                              onChange={(e) => setForm(prev => ({ ...prev, ibs_estadual_aliquota: e.target.value }))}
                              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                              step="0.01"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">Diferimento (%)</label>
                            <input
                              type="number"
                              value={form.ibs_estadual_diferimento}
                              onChange={(e) => setForm(prev => ({ ...prev, ibs_estadual_diferimento: e.target.value }))}
                              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                              step="0.01"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">Reducao Aliquota (%)</label>
                            <input
                              type="number"
                              value={form.ibs_estadual_reducao}
                              onChange={(e) => setForm(prev => ({ ...prev, ibs_estadual_reducao: e.target.value }))}
                              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                              step="0.01"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                        <h5 className="text-xs font-bold text-green-400 mb-2 flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          IBS Municipal
                        </h5>
                        <div className="space-y-2">
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">Aliquota (%)</label>
                            <input
                              type="number"
                              value={form.ibs_municipal_aliquota}
                              onChange={(e) => setForm(prev => ({ ...prev, ibs_municipal_aliquota: e.target.value }))}
                              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-green-500"
                              step="0.01"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">Diferimento (%)</label>
                            <input
                              type="number"
                              value={form.ibs_municipal_diferimento}
                              onChange={(e) => setForm(prev => ({ ...prev, ibs_municipal_diferimento: e.target.value }))}
                              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-green-500"
                              step="0.01"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">Reducao Aliquota (%)</label>
                            <input
                              type="number"
                              value={form.ibs_municipal_reducao}
                              onChange={(e) => setForm(prev => ({ ...prev, ibs_municipal_reducao: e.target.value }))}
                              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-green-500"
                              step="0.01"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                        <h5 className="text-xs font-bold text-yellow-400 mb-2 flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          CBS Federal
                        </h5>
                        <div className="space-y-2">
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">Aliquota (%)</label>
                            <input
                              type="number"
                              value={form.cbs_federal_aliquota}
                              onChange={(e) => setForm(prev => ({ ...prev, cbs_federal_aliquota: e.target.value }))}
                              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-yellow-500"
                              step="0.01"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">Diferimento (%)</label>
                            <input
                              type="number"
                              value={form.cbs_federal_diferimento}
                              onChange={(e) => setForm(prev => ({ ...prev, cbs_federal_diferimento: e.target.value }))}
                              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-yellow-500"
                              step="0.01"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">Reducao Aliquota (%)</label>
                            <input
                              type="number"
                              value={form.cbs_federal_reducao}
                              onChange={(e) => setForm(prev => ({ ...prev, cbs_federal_reducao: e.target.value }))}
                              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-yellow-500"
                              step="0.01"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-4 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                      <h5 className="text-xs font-bold text-red-400 mb-2">Imposto Seletivo (IS)</h5>
                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">CST IS (CSTIS)</label>
                          <input
                            type="text"
                            value={form.is_cst}
                            onChange={(e) => setForm(prev => ({ ...prev, is_cst: e.target.value }))}
                            className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-red-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">Classificacao Tributaria IS</label>
                          <input
                            type="text"
                            value={form.is_classificacao_tributaria}
                            onChange={(e) => setForm(prev => ({ ...prev, is_classificacao_tributaria: e.target.value }))}
                            className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-red-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">Aliquota IS (%)</label>
                          <input
                            type="number"
                            value={form.is_aliquota}
                            onChange={(e) => setForm(prev => ({ ...prev, is_aliquota: e.target.value }))}
                            className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-red-500"
                            step="0.01"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">Aliquota Especifica (R$/un)</label>
                          <input
                            type="number"
                            value={form.is_aliquota_especifica}
                            onChange={(e) => setForm(prev => ({ ...prev, is_aliquota_especifica: e.target.value }))}
                            className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-red-500"
                            step="0.0001"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              {form.tipo === 'nfe' && (
                <>
                  <div className="border-t border-gray-800 pt-4">
                    <h4 className="text-sm font-bold text-[#FFA500] uppercase mb-3 flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Configuracoes Gerais NF-e
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Tipo de Nota</label>
                        <select
                          value={form.nfe_tipo_nota}
                          onChange={(e) => setForm(prev => ({ ...prev, nfe_tipo_nota: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#FFA500]"
                        >
                          <option value="0">0 - Entrada</option>
                          <option value="1">1 - Saida</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Tipo de Ambiente</label>
                        <select
                          value={form.nfe_tipo_ambiente}
                          onChange={(e) => setForm(prev => ({ ...prev, nfe_tipo_ambiente: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#FFA500]"
                        >
                          <option value="1">1 - Producao</option>
                          <option value="2">2 - Homologacao</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Finalidade</label>
                        <select
                          value={form.nfe_finalidade}
                          onChange={(e) => setForm(prev => ({ ...prev, nfe_finalidade: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#FFA500]"
                        >
                          <option value="1">1 - Normal</option>
                          <option value="2">2 - Complementar</option>
                          <option value="3">3 - Ajuste</option>
                          <option value="4">4 - Devolucao</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Modelo Documento</label>
                        <input
                          type="text"
                          value={form.nfe_modelo_documento}
                          onChange={(e) => setForm(prev => ({ ...prev, nfe_modelo_documento: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#FFA500]"
                          placeholder="55"
                        />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[10px] text-gray-500 mb-1">Natureza da Operacao</label>
                        <input
                          type="text"
                          value={form.natureza_operacao}
                          onChange={(e) => setForm(prev => ({ ...prev, natureza_operacao: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#FFA500]"
                          placeholder="Ex: Venda de Mercadorias"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Regime Tributario</label>
                        <select
                          value={form.regime_tributario}
                          onChange={(e) => setForm(prev => ({ ...prev, regime_tributario: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#FFA500]"
                        >
                          <option value="">Selecione...</option>
                          <option value="1">1 - Simples Nacional</option>
                          <option value="2">2 - Simples Nacional - Excesso</option>
                          <option value="3">3 - Regime Normal</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Ultima NF Emitida</label>
                        <input
                          type="number"
                          value={form.nfe_ultima_nf_emitida}
                          onChange={(e) => setForm(prev => ({ ...prev, nfe_ultima_nf_emitida: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#FFA500]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* ICMS */}
                  <div className="border-t border-gray-800 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-bold text-blue-400 uppercase flex items-center gap-2">
                        <Calculator className="w-4 h-4" />
                        ICMS
                      </h4>
                      <button
                        type="button"
                        onClick={() => { setTipoImpostoExcecao('icms'); setShowExcecaoModal(true); }}
                        className="text-xs px-3 py-1 rounded bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors flex items-center gap-1"
                      >
                        <Filter className="w-3 h-3" />
                        Nova Excecao
                      </button>
                    </div>

                    {/* Condicional: CSOSN para Simples Nacional, CST ICMS para os demais */}
                    {form.regime_tributario === '1' || form.regime_tributario === '2' ? (
                      <>
                        <p className="text-xs text-gray-500 mb-3">No Simples Nacional, utilize o CSOSN. O ICMS e calculado dentro do DAS.</p>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">CSOSN</label>
                            <input
                              type="text"
                              value={form.icms_csosn}
                              onChange={(e) => setForm(prev => ({ ...prev, icms_csosn: e.target.value }))}
                              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                              placeholder="Ex: 102"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">CFOP</label>
                            <input
                              type="text"
                              value={form.cfop}
                              onChange={(e) => setForm(prev => ({ ...prev, cfop: e.target.value }))}
                              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                              placeholder="Ex: 5102"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">Aliquota ICMS (%)</label>
                            <input
                              type="number"
                              value={form.icms_aliquota}
                              onChange={(e) => setForm(prev => ({ ...prev, icms_aliquota: e.target.value }))}
                              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                              step="0.01"
                            />
                          </div>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="text-xs text-gray-500 mb-3">Para Regime Normal, utilize o CST ICMS - Situação Tributária.</p>
                        <div className="grid grid-cols-3 gap-3">
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">CST ICMS</label>
                            <input
                              type="text"
                              value={form.icms_cst}
                              onChange={(e) => setForm(prev => ({ ...prev, icms_cst: e.target.value }))}
                              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                              placeholder="Ex: 00"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">CFOP</label>
                            <input
                              type="text"
                              value={form.cfop}
                              onChange={(e) => setForm(prev => ({ ...prev, cfop: e.target.value }))}
                              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                              placeholder="Ex: 5102"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">Aliquota ICMS (%)</label>
                            <input
                              type="number"
                              value={form.icms_aliquota}
                              onChange={(e) => setForm(prev => ({ ...prev, icms_aliquota: e.target.value }))}
                              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                              step="0.01"
                            />
                          </div>
                        </div>
                      </>
                    )}

                    {excecoes.filter(e => e.tipo_imposto === 'icms').length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-gray-500">Exceções cadastradas:</p>
                        {excecoes.filter(e => e.tipo_imposto === 'icms').map(exc => (
                          <div key={exc.id} className="p-2 rounded bg-gray-800/50 border border-gray-700 flex items-center justify-between">
                            <span className="text-sm text-gray-300">{exc.nome}</span>
                            <button
                              onClick={() => handleDeleteExcecao(exc.id)}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* IPI */}
                  <div className="border-t border-gray-800 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-bold text-purple-400 uppercase flex items-center gap-2">
                        <Calculator className="w-4 h-4" />
                        IPI
                      </h4>
                      <button
                        type="button"
                        onClick={() => { setTipoImpostoExcecao('ipi'); setShowExcecaoModal(true); }}
                        className="text-xs px-3 py-1 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 transition-colors flex items-center gap-1"
                      >
                        <Filter className="w-3 h-3" />
                        Nova Excecao
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">CST IPI</label>
                        <input
                          type="text"
                          value={form.ipi_cst}
                          onChange={(e) => setForm(prev => ({ ...prev, ipi_cst: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-purple-500"
                          placeholder="Ex: 99"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Aliquota IPI (%)</label>
                        <input
                          type="number"
                          value={form.ipi_aliquota}
                          onChange={(e) => setForm(prev => ({ ...prev, ipi_aliquota: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-purple-500"
                          step="0.01"
                        />
                      </div>
                    </div>

                    {excecoes.filter(e => e.tipo_imposto === 'ipi').length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-gray-500">Exceções cadastradas:</p>
                        {excecoes.filter(e => e.tipo_imposto === 'ipi').map(exc => (
                          <div key={exc.id} className="p-2 rounded bg-gray-800/50 border border-gray-700 flex items-center justify-between">
                            <span className="text-sm text-gray-300">{exc.nome}</span>
                            <button
                              onClick={() => handleDeleteExcecao(exc.id)}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* ISSQN */}
                  <div className="border-t border-gray-800 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-bold text-green-400 uppercase flex items-center gap-2">
                        <Calculator className="w-4 h-4" />
                        ISSQN
                      </h4>
                      <button
                        type="button"
                        onClick={() => { setTipoImpostoExcecao('issqn'); setShowExcecaoModal(true); }}
                        className="text-xs px-3 py-1 rounded bg-green-500/20 hover:bg-green-500/30 text-green-400 transition-colors flex items-center gap-1"
                      >
                        <Filter className="w-3 h-3" />
                        Nova Excecao
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">CST ISSQN</label>
                        <input
                          type="text"
                          value={form.issqn_cst}
                          onChange={(e) => setForm(prev => ({ ...prev, issqn_cst: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-green-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Aliquota (%)</label>
                        <input
                          type="number"
                          value={form.issqn_aliquota}
                          onChange={(e) => setForm(prev => ({ ...prev, issqn_aliquota: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-green-500"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Base (%)</label>
                        <input
                          type="number"
                          value={form.issqn_base}
                          onChange={(e) => setForm(prev => ({ ...prev, issqn_base: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-green-500"
                          step="0.01"
                        />
                      </div>
                    </div>

                    {excecoes.filter(e => e.tipo_imposto === 'issqn').length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-gray-500">Exceções cadastradas:</p>
                        {excecoes.filter(e => e.tipo_imposto === 'issqn').map(exc => (
                          <div key={exc.id} className="p-2 rounded bg-gray-800/50 border border-gray-700 flex items-center justify-between">
                            <span className="text-sm text-gray-300">{exc.nome}</span>
                            <button
                              onClick={() => handleDeleteExcecao(exc.id)}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* PIS */}
                  <div className="border-t border-gray-800 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-bold text-yellow-400 uppercase flex items-center gap-2">
                        <Percent className="w-4 h-4" />
                        PIS
                      </h4>
                      <button
                        type="button"
                        onClick={() => { setTipoImpostoExcecao('pis'); setShowExcecaoModal(true); }}
                        className="text-xs px-3 py-1 rounded bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 transition-colors flex items-center gap-1"
                      >
                        <Filter className="w-3 h-3" />
                        Nova Excecao
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">CST PIS</label>
                        <input
                          type="text"
                          value={form.pis_cst}
                          onChange={(e) => setForm(prev => ({ ...prev, pis_cst: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-yellow-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Aliquota PIS (%)</label>
                        <input
                          type="number"
                          value={form.pis_aliquota}
                          onChange={(e) => setForm(prev => ({ ...prev, pis_aliquota: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-yellow-500"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Base de Calculo (%)</label>
                        <input
                          type="number"
                          value={form.pis_base_calculo}
                          onChange={(e) => setForm(prev => ({ ...prev, pis_base_calculo: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-yellow-500"
                          step="0.01"
                        />
                      </div>
                    </div>

                    {excecoes.filter(e => e.tipo_imposto === 'pis').length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-gray-500">Exceções cadastradas:</p>
                        {excecoes.filter(e => e.tipo_imposto === 'pis').map(exc => (
                          <div key={exc.id} className="p-2 rounded bg-gray-800/50 border border-gray-700 flex items-center justify-between">
                            <span className="text-sm text-gray-300">{exc.nome}</span>
                            <button
                              onClick={() => handleDeleteExcecao(exc.id)}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* COFINS */}
                  <div className="border-t border-gray-800 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-bold text-orange-400 uppercase flex items-center gap-2">
                        <Percent className="w-4 h-4" />
                        COFINS
                      </h4>
                      <button
                        type="button"
                        onClick={() => { setTipoImpostoExcecao('cofins'); setShowExcecaoModal(true); }}
                        className="text-xs px-3 py-1 rounded bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 transition-colors flex items-center gap-1"
                      >
                        <Filter className="w-3 h-3" />
                        Nova Excecao
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">CST COFINS</label>
                        <input
                          type="text"
                          value={form.cofins_cst}
                          onChange={(e) => setForm(prev => ({ ...prev, cofins_cst: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-orange-500"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Aliquota COFINS (%)</label>
                        <input
                          type="number"
                          value={form.cofins_aliquota}
                          onChange={(e) => setForm(prev => ({ ...prev, cofins_aliquota: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-orange-500"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Base de Calculo (%)</label>
                        <input
                          type="number"
                          value={form.cofins_base_calculo}
                          onChange={(e) => setForm(prev => ({ ...prev, cofins_base_calculo: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-orange-500"
                          step="0.01"
                        />
                      </div>
                    </div>

                    {excecoes.filter(e => e.tipo_imposto === 'cofins').length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-gray-500">Exceções cadastradas:</p>
                        {excecoes.filter(e => e.tipo_imposto === 'cofins').map(exc => (
                          <div key={exc.id} className="p-2 rounded bg-gray-800/50 border border-gray-700 flex items-center justify-between">
                            <span className="text-sm text-gray-300">{exc.nome}</span>
                            <button
                              onClick={() => handleDeleteExcecao(exc.id)}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* IBS/CBS - Igual ao da NFS-e mas com botão de exceção */}
                  <div className="border-t border-gray-800 pt-4">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-bold uppercase flex items-center gap-2" style={{ color: '#FF6B6B' }}>
                        <Globe className="w-4 h-4" />
                        IBS/CBS - Reforma Tributaria
                      </h4>
                      <button
                        type="button"
                        onClick={() => { setTipoImpostoExcecao('ibs_cbs'); setShowExcecaoModal(true); }}
                        className="text-xs px-3 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 transition-colors flex items-center gap-1"
                      >
                        <Filter className="w-3 h-3" />
                        Nova Excecao
                      </button>
                    </div>
                    <p className="text-xs text-gray-500 mb-4">Simples Nacional - Reforma Tributaria (EC 132/2023) - Transicao 2026-2033</p>

                    <div className="grid grid-cols-3 gap-3 mb-4">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">CST IBS/CBS</label>
                        <input
                          type="text"
                          value={form.cst_ibs_cbs}
                          onChange={(e) => setForm(prev => ({ ...prev, cst_ibs_cbs: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#FF6B6B]"
                          placeholder="Ex: 00"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Classificacao Tributaria (cClassTrib)</label>
                        <input
                          type="text"
                          value={form.classificacao_tributaria}
                          onChange={(e) => setForm(prev => ({ ...prev, classificacao_tributaria: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#FF6B6B]"
                          placeholder="Ex: 01"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Base Calculo (%)</label>
                        <input
                          type="number"
                          value={form.base_calculo_percentual}
                          onChange={(e) => setForm(prev => ({ ...prev, base_calculo_percentual: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#FF6B6B]"
                          step="0.01"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
                        <h5 className="text-xs font-bold text-blue-400 mb-2 flex items-center gap-1">
                          <Landmark className="w-3 h-3" />
                          IBS Estadual (UF)
                        </h5>
                        <div className="space-y-2">
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">Aliquota (%)</label>
                            <input
                              type="number"
                              value={form.ibs_estadual_aliquota}
                              onChange={(e) => setForm(prev => ({ ...prev, ibs_estadual_aliquota: e.target.value }))}
                              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                              step="0.01"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">Diferimento (%)</label>
                            <input
                              type="number"
                              value={form.ibs_estadual_diferimento}
                              onChange={(e) => setForm(prev => ({ ...prev, ibs_estadual_diferimento: e.target.value }))}
                              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                              step="0.01"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">Reducao Aliquota (%)</label>
                            <input
                              type="number"
                              value={form.ibs_estadual_reducao}
                              onChange={(e) => setForm(prev => ({ ...prev, ibs_estadual_reducao: e.target.value }))}
                              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-blue-500"
                              step="0.01"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
                        <h5 className="text-xs font-bold text-green-400 mb-2 flex items-center gap-1">
                          <Building2 className="w-3 h-3" />
                          IBS Municipal
                        </h5>
                        <div className="space-y-2">
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">Aliquota (%)</label>
                            <input
                              type="number"
                              value={form.ibs_municipal_aliquota}
                              onChange={(e) => setForm(prev => ({ ...prev, ibs_municipal_aliquota: e.target.value }))}
                              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-green-500"
                              step="0.01"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">Diferimento (%)</label>
                            <input
                              type="number"
                              value={form.ibs_municipal_diferimento}
                              onChange={(e) => setForm(prev => ({ ...prev, ibs_municipal_diferimento: e.target.value }))}
                              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-green-500"
                              step="0.01"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">Reducao Aliquota (%)</label>
                            <input
                              type="number"
                              value={form.ibs_municipal_reducao}
                              onChange={(e) => setForm(prev => ({ ...prev, ibs_municipal_reducao: e.target.value }))}
                              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-green-500"
                              step="0.01"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-yellow-500/5 border border-yellow-500/20">
                        <h5 className="text-xs font-bold text-yellow-400 mb-2 flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          CBS Federal
                        </h5>
                        <div className="space-y-2">
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">Aliquota (%)</label>
                            <input
                              type="number"
                              value={form.cbs_federal_aliquota}
                              onChange={(e) => setForm(prev => ({ ...prev, cbs_federal_aliquota: e.target.value }))}
                              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-yellow-500"
                              step="0.01"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">Diferimento (%)</label>
                            <input
                              type="number"
                              value={form.cbs_federal_diferimento}
                              onChange={(e) => setForm(prev => ({ ...prev, cbs_federal_diferimento: e.target.value }))}
                              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-yellow-500"
                              step="0.01"
                            />
                          </div>
                          <div>
                            <label className="block text-[10px] text-gray-500 mb-1">Reducao Aliquota (%)</label>
                            <input
                              type="number"
                              value={form.cbs_federal_reducao}
                              onChange={(e) => setForm(prev => ({ ...prev, cbs_federal_reducao: e.target.value }))}
                              className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-yellow-500"
                              step="0.01"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-red-500/5 border border-red-500/20">
                      <h5 className="text-xs font-bold text-red-400 mb-2">Imposto Seletivo (IS)</h5>
                      <div className="grid grid-cols-4 gap-3">
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">CST IS (CSTIS)</label>
                          <input
                            type="text"
                            value={form.is_cst}
                            onChange={(e) => setForm(prev => ({ ...prev, is_cst: e.target.value }))}
                            className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-red-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">Classificacao Tributaria IS</label>
                          <input
                            type="text"
                            value={form.is_classificacao_tributaria}
                            onChange={(e) => setForm(prev => ({ ...prev, is_classificacao_tributaria: e.target.value }))}
                            className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-red-500"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">Aliquota IS (%)</label>
                          <input
                            type="number"
                            value={form.is_aliquota}
                            onChange={(e) => setForm(prev => ({ ...prev, is_aliquota: e.target.value }))}
                            className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-red-500"
                            step="0.01"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] text-gray-500 mb-1">Aliquota Especifica (R$/un)</label>
                          <input
                            type="number"
                            value={form.is_aliquota_especifica}
                            onChange={(e) => setForm(prev => ({ ...prev, is_aliquota_especifica: e.target.value }))}
                            className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-red-500"
                            step="0.0001"
                          />
                        </div>
                      </div>
                    </div>

                    {excecoes.filter(e => e.tipo_imposto === 'ibs_cbs').length > 0 && (
                      <div className="mt-3 space-y-2">
                        <p className="text-xs text-gray-500">Exceções cadastradas:</p>
                        {excecoes.filter(e => e.tipo_imposto === 'ibs_cbs').map(exc => (
                          <div key={exc.id} className="p-2 rounded bg-gray-800/50 border border-gray-700 flex items-center justify-between">
                            <span className="text-sm text-gray-300">{exc.nome}</span>
                            <button
                              onClick={() => handleDeleteExcecao(exc.id)}
                              className="text-xs text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Informações para o Fisco */}
                  <div className="border-t border-gray-800 pt-4">
                    <div className="flex items-center justify-between mb-2">
                      <label className="block text-xs font-medium text-gray-400">
                        Informacoes Fisco para notas desta operacao
                      </label>
                      <button
                        type="button"
                        onClick={() => setShowVariaveisModal(true)}
                        className="text-xs px-3 py-1 rounded bg-[#00D4FF]/20 hover:bg-[#00D4FF]/30 text-[#00D4FF] transition-colors flex items-center gap-1"
                      >
                        <Code className="w-3 h-3" />
                        Inserir Variavel
                      </button>
                    </div>
                    <textarea
                      id="nfe_informacoes_fisco"
                      value={form.nfe_informacoes_fisco}
                      onChange={(e) => setForm(prev => ({ ...prev, nfe_informacoes_fisco: e.target.value }))}
                      className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 focus:outline-none focus:border-[#FFA500] resize-none font-mono text-sm"
                      rows={3}
                      placeholder="Informacoes adicionais de interesse do Fisco. Use variaveis como {cliente_nome}, {nota_numero}, etc."
                    />
                  </div>
                </>
              )}

              <div className="border-t border-gray-800 pt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-medium text-gray-400">
                    Observacoes Padrao da Nota
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowVariaveisModal(true)}
                    className="text-xs px-3 py-1 rounded bg-[#00D4FF]/20 hover:bg-[#00D4FF]/30 text-[#00D4FF] transition-colors flex items-center gap-1"
                  >
                    <Code className="w-3 h-3" />
                    Inserir Variavel
                  </button>
                </div>
                <textarea
                  id="observacoes_padrao"
                  value={form.observacoes_padrao}
                  onChange={(e) => setForm(prev => ({ ...prev, observacoes_padrao: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 focus:outline-none focus:border-[#00D4FF] resize-none font-mono text-sm"
                  rows={3}
                  placeholder="Texto que sera incluido automaticamente na nota fiscal. Use variaveis como {cliente_nome}, {nota_numero}, etc."
                />
                <p className="text-xs text-gray-500 mt-2 flex items-start gap-1">
                  <Info className="w-3 h-3 mt-0.5 flex-shrink-0" />
                  Use variaveis entre chaves para inserir dados dinamicos. Clique em "Inserir Variavel" para ver opcoes disponiveis.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-800">
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="neon-button flex items-center gap-2 px-4 py-2"
              >
                {saving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-[#00D4FF] border-t-transparent rounded-full animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Salvar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de Variáveis */}
      {showVariaveisModal && createPortal(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Code className="w-5 h-5 text-[#00D4FF]" />
                Variaveis Disponiveis
              </h3>
              <button
                onClick={() => setShowVariaveisModal(false)}
                className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <p className="text-sm text-gray-400">
                Clique em uma variavel para inseri-la no campo de observacoes.
              </p>

              {Object.entries(variaveisPorCategoria).map(([categoria, vars]) => (
                <div key={categoria} className="space-y-2">
                  <h4 className="text-sm font-bold text-[#00D4FF] uppercase">{categoria}</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {vars.map((v) => (
                      <button
                        key={v.variavel}
                        onClick={() => form.tipo === 'nfe' && document.activeElement?.id === 'nfe_informacoes_fisco'
                          ? insertVariavelFisco(v.variavel)
                          : insertVariavel(v.variavel)
                        }
                        className="p-3 rounded-lg bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-[#00D4FF] transition-all text-left"
                      >
                        <div className="flex items-center justify-between">
                          <code className="text-sm text-[#00D4FF] font-mono">{v.variavel}</code>
                          <Plus className="w-4 h-4 text-gray-500" />
                        </div>
                        <p className="text-xs text-gray-400 mt-1">{v.descricao}</p>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Modal de Exceção (placeholder - será implementado no próximo passo) */}
      {showExcecaoModal && createPortal(
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-4">
          <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-3xl">
            <div className="flex items-center justify-between p-4 border-b border-gray-800">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Filter className="w-5 h-5 text-[#00D4FF]" />
                Nova Excecao de {tipoImpostoExcecao.toUpperCase()}
              </h3>
              <button
                onClick={() => setShowExcecaoModal(false)}
                className="p-2 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4">
              <p className="text-sm text-gray-400 text-center py-8">
                Funcionalidade de excecoes em desenvolvimento.
                <br />
                As excecoes permitirao criar regras especificas por estado, produto, NCM, origem, CST e CFOP.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-gray-800">
              <button
                onClick={() => setShowExcecaoModal(false)}
                className="px-4 py-2 rounded-lg bg-gray-800 text-gray-300 hover:bg-gray-700 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
