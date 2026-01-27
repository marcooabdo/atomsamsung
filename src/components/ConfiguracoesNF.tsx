import { useState, useEffect } from 'react';
import { Plus, Edit, Trash2, Save, X, Receipt, FileText, Building2, Percent, AlertCircle, CheckCircle } from 'lucide-react';
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
  ativo: boolean;
  created_at: string;
}

interface Unidade {
  id: string;
  nome: string;
}

interface ConfiguracoesNFProps {
  unidades: Unidade[];
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
  regime_tributario: '',
  observacoes_padrao: '',
  unidade_id: '',
  numero_inicial: '1',
  serie: '1',
  ativo: true
};

export function ConfiguracoesNF({ unidades }: ConfiguracoesNFProps) {
  const [configs, setConfigs] = useState<NFConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedUnidade, setSelectedUnidade] = useState<string>('');
  const [form, setForm] = useState(FORM_INICIAL);
  const [saving, setSaving] = useState(false);
  const [mensagem, setMensagem] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);

  useEffect(() => {
    loadConfigs();
  }, []);

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
      const payload = {
        nome: form.nome.trim(),
        tipo: form.tipo,
        unidade_id: form.unidade_id,
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
      handleCloseModal();
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

  const filteredConfigs = selectedUnidade
    ? configs.filter(c => c.unidade_id === selectedUnidade)
    : configs;

  const getUnidadeNome = (unidadeId: string) => {
    return unidades.find(u => u.id === unidadeId)?.nome || 'Unidade desconhecida';
  };

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
                    <div>
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
                          ISS: {config.aliquota_iss}%
                        </span>
                        {config.codigo_servico && (
                          <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">
                            Cod: {config.codigo_servico}
                          </span>
                        )}
                        {config.cnae && (
                          <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">
                            CNAE: {config.cnae}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
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
                    <div>
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
                        {config.ncm && (
                          <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">
                            NCM: {config.ncm}
                          </span>
                        )}
                        {config.natureza_operacao && (
                          <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">
                            {config.natureza_operacao}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
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

      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-xl border border-gray-800 w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Nome da Parametrizacao *
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

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.ativo}
                      onChange={(e) => setForm(prev => ({ ...prev, ativo: e.target.checked }))}
                      className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-[#00D4FF] focus:ring-[#00D4FF]"
                    />
                    <span className="text-sm text-gray-300">Ativo</span>
                  </label>
                </div>
              </div>

              <div className="border-t border-gray-800 pt-4">
                <h4 className="text-sm font-bold text-gray-400 uppercase mb-3">Numeracao da Nota</h4>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Numero Inicial</label>
                    <input
                      type="number"
                      value={form.numero_inicial}
                      onChange={(e) => setForm(prev => ({ ...prev, numero_inicial: e.target.value }))}
                      className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-gray-500 mb-1">Serie</label>
                    <input
                      type="text"
                      value={form.serie}
                      onChange={(e) => setForm(prev => ({ ...prev, serie: e.target.value }))}
                      className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                      placeholder="Ex: 1"
                    />
                  </div>
                </div>
              </div>

              {form.tipo === 'nfse' && (
                <>
                  <div className="border-t border-gray-800 pt-4">
                    <h4 className="text-sm font-bold text-[#00D4FF] uppercase mb-3 flex items-center gap-2">
                      <Percent className="w-4 h-4" />
                      Aliquotas e Retencoes
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
                        <label className="block text-[10px] text-gray-500 mb-1">Aliquota ISS (%)</label>
                        <input
                          type="number"
                          value={form.aliquota_iss}
                          onChange={(e) => setForm(prev => ({ ...prev, aliquota_iss: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Retencao IR (%)</label>
                        <input
                          type="number"
                          value={form.retencao_ir}
                          onChange={(e) => setForm(prev => ({ ...prev, retencao_ir: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Retencao PIS (%)</label>
                        <input
                          type="number"
                          value={form.retencao_pis}
                          onChange={(e) => setForm(prev => ({ ...prev, retencao_pis: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Retencao COFINS (%)</label>
                        <input
                          type="number"
                          value={form.retencao_cofins}
                          onChange={(e) => setForm(prev => ({ ...prev, retencao_cofins: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Retencao CSLL (%)</label>
                        <input
                          type="number"
                          value={form.retencao_csll}
                          onChange={(e) => setForm(prev => ({ ...prev, retencao_csll: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                          step="0.01"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Retencao INSS (%)</label>
                        <input
                          type="number"
                          value={form.retencao_inss}
                          onChange={(e) => setForm(prev => ({ ...prev, retencao_inss: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                          step="0.01"
                        />
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
                      Dados Fiscais NF-e
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">CFOP</label>
                        <input
                          type="text"
                          value={form.cfop}
                          onChange={(e) => setForm(prev => ({ ...prev, cfop: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                          placeholder="Ex: 5102"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">NCM</label>
                        <input
                          type="text"
                          value={form.ncm}
                          onChange={(e) => setForm(prev => ({ ...prev, ncm: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                          placeholder="Ex: 85171210"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">CST ICMS</label>
                        <input
                          type="text"
                          value={form.cst_icms}
                          onChange={(e) => setForm(prev => ({ ...prev, cst_icms: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                          placeholder="Ex: 00"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">CST PIS</label>
                        <input
                          type="text"
                          value={form.cst_pis}
                          onChange={(e) => setForm(prev => ({ ...prev, cst_pis: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                          placeholder="Ex: 01"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">CST COFINS</label>
                        <input
                          type="text"
                          value={form.cst_cofins}
                          onChange={(e) => setForm(prev => ({ ...prev, cst_cofins: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                          placeholder="Ex: 01"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] text-gray-500 mb-1">Regime Tributario</label>
                        <select
                          value={form.regime_tributario}
                          onChange={(e) => setForm(prev => ({ ...prev, regime_tributario: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                        >
                          <option value="">Selecione...</option>
                          <option value="1">1 - Simples Nacional</option>
                          <option value="2">2 - Simples Nacional - Excesso</option>
                          <option value="3">3 - Regime Normal</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[10px] text-gray-500 mb-1">Natureza da Operacao</label>
                        <input
                          type="text"
                          value={form.natureza_operacao}
                          onChange={(e) => setForm(prev => ({ ...prev, natureza_operacao: e.target.value }))}
                          className="w-full px-3 py-2 rounded bg-gray-800 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                          placeholder="Ex: Venda de Mercadorias"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              <div className="border-t border-gray-800 pt-4">
                <label className="block text-xs font-medium text-gray-400 mb-1.5">
                  Observacoes Padrao da Nota
                </label>
                <textarea
                  value={form.observacoes_padrao}
                  onChange={(e) => setForm(prev => ({ ...prev, observacoes_padrao: e.target.value }))}
                  className="w-full px-4 py-2.5 rounded-lg bg-gray-800 border border-gray-700 text-gray-200 focus:outline-none focus:border-[#00D4FF] resize-none"
                  rows={3}
                  placeholder="Texto que sera incluido automaticamente na nota fiscal..."
                />
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
        </div>
      )}
    </div>
  );
}
