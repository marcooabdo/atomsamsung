import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Save, X, ChevronUp, ChevronDown, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useOtimizador } from '../../contexts/OtimizadorContext';

interface RegraPrioridade {
  id: string;
  unidade_id: string;
  nome: string;
  descricao: string | null;
  ativa: boolean;
  ordem: number;
  dias_na_etapa_min: number | null;
  dias_na_etapa_max: number | null;
  tipo_os: string[] | null;
  tipo_atendimento: string[] | null;
  modelos_aparelho: string[] | null;
  marcas_aparelho: string[] | null;
  colunas_kanban: string[] | null;
  cliente_vip: boolean | null;
  prioridade_resultado: 'baixa' | 'normal' | 'alta' | 'urgente';
}

const PRIORIDADES = [
  { value: 'baixa', label: 'Baixa', color: '#6B7280' },
  { value: 'normal', label: 'Normal', color: '#3B82F6' },
  { value: 'alta', label: 'Alta', color: '#F59E0B' },
  { value: 'urgente', label: 'Urgente', color: '#EF4444' },
];

const COLUNAS_KANBAN = [
  'os_nova', 'diagnostico', 'negociacao_em_andamento', 'aguardando_aprovacao',
  'orcamento_aprovado', 'aguardando_peca', 'peca_em_transito', 'peca_disponivel',
  'em_reparo_ci', 'rota_preta', 'rota_vermelha', 'rota_azul', 'rota_verde',
  'rota_rosa', 'rota_amarela', 'rota_laranja', 'em_rota_ih', 'reparo_concluido',
  'aguardando_fechamento', 'fechar_os', 'os_fechada', 'orcamentos_rejeitados'
];

export default function ConfiguracaoPrioridades() {
  const { selectedUnidade } = useOtimizador();
  const [regras, setRegras] = useState<RegraPrioridade[]>([]);
  const [loading, setLoading] = useState(true);
  const [editando, setEditando] = useState<string | null>(null);
  const [criandoNova, setCriandoNova] = useState(false);
  const [formData, setFormData] = useState<Partial<RegraPrioridade>>({
    nome: '',
    descricao: '',
    ativa: true,
    ordem: 0,
    prioridade_resultado: 'normal',
  });

  useEffect(() => {
    if (selectedUnidade) {
      loadRegras();
    }
  }, [selectedUnidade]);

  const loadRegras = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('regras_prioridade')
        .select('*')
        .eq('unidade_id', selectedUnidade)
        .order('ordem');

      if (error) throw error;
      setRegras(data || []);
    } catch (error) {
      alert('Erro ao carregar regras de prioridade');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.nome || !formData.prioridade_resultado) {
      alert('Preencha os campos obrigatórios: Nome e Prioridade Resultado');
      return;
    }

    try {
      if (editando) {
        const { error } = await supabase
          .from('regras_prioridade')
          .update({
            ...formData,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editando);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('regras_prioridade')
          .insert({
            ...formData,
            unidade_id: selectedUnidade,
            ordem: regras.length,
          });

        if (error) throw error;
      }

      await loadRegras();
      cancelEdit();
    } catch (error) {
      alert('Erro ao salvar regra de prioridade');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta regra?')) return;

    try {
      const { error } = await supabase
        .from('regras_prioridade')
        .delete()
        .eq('id', id);

      if (error) throw error;
      await loadRegras();
    } catch (error) {
      alert('Erro ao excluir regra de prioridade');
    }
  };

  const handleMoveUp = async (regra: RegraPrioridade) => {
    const index = regras.findIndex(r => r.id === regra.id);
    if (index === 0) return;

    const newRegras = [...regras];
    [newRegras[index - 1], newRegras[index]] = [newRegras[index], newRegras[index - 1]];

    await updateOrders(newRegras);
  };

  const handleMoveDown = async (regra: RegraPrioridade) => {
    const index = regras.findIndex(r => r.id === regra.id);
    if (index === regras.length - 1) return;

    const newRegras = [...regras];
    [newRegras[index], newRegras[index + 1]] = [newRegras[index + 1], newRegras[index]];

    await updateOrders(newRegras);
  };

  const updateOrders = async (newRegras: RegraPrioridade[]) => {
    try {
      const updates = newRegras.map((regra, index) =>
        supabase
          .from('regras_prioridade')
          .update({ ordem: index })
          .eq('id', regra.id)
      );

      await Promise.all(updates);
      await loadRegras();
    } catch (error) {
    }
  };

  const toggleAtiva = async (id: string, ativa: boolean) => {
    try {
      const { error } = await supabase
        .from('regras_prioridade')
        .update({ ativa: !ativa })
        .eq('id', id);

      if (error) throw error;
      await loadRegras();
    } catch (error) {
    }
  };

  const startEdit = (regra: RegraPrioridade) => {
    setEditando(regra.id);
    setFormData(regra);
    setCriandoNova(false);
  };

  const startNew = () => {
    setFormData({
      nome: '',
      descricao: '',
      ativa: true,
      ordem: 0,
      prioridade_resultado: 'normal',
    });
    setCriandoNova(true);
    setEditando(null);
  };

  const cancelEdit = () => {
    setEditando(null);
    setCriandoNova(false);
    setFormData({
      nome: '',
      descricao: '',
      ativa: true,
      ordem: 0,
      prioridade_resultado: 'normal',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="futuristic-loader"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold text-white">Regras de Prioridade</h3>
          <p className="text-gray-400 mt-1">
            Configure critérios automáticos para classificar a prioridade das OSs
          </p>
        </div>
        <button
          onClick={startNew}
          disabled={criandoNova || editando !== null}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 rounded-lg text-white font-medium transition-all disabled:opacity-50"
        >
          <Plus className="w-5 h-5" />
          Nova Regra
        </button>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/30 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-300">
            <p className="font-medium mb-1">Como funciona:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>As regras são aplicadas na ordem de prioridade (primeiro = maior prioridade)</li>
              <li>A primeira regra que atender TODAS as condições será aplicada</li>
              <li>Condições vazias são ignoradas (aplicam para qualquer valor)</li>
              <li>Use a ordem estrategicamente: regras mais específicas devem vir primeiro</li>
            </ul>
          </div>
        </div>
      </div>

      {(criandoNova || editando) && (
        <div className="bg-gray-800/50 border-2 border-cyan-500/50 rounded-xl p-6">
          <h4 className="text-xl font-bold text-white mb-4">
            {editando ? 'Editar Regra' : 'Nova Regra'}
          </h4>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">
                  Nome da Regra *
                </label>
                <input
                  type="text"
                  value={formData.nome || ''}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  placeholder="Ex: OSs urgentes com mais de 15 dias"
                />
              </div>

              <div>
                <label className="text-gray-300 text-sm font-medium mb-2 block">
                  Prioridade Resultado *
                </label>
                <select
                  value={formData.prioridade_resultado || 'normal'}
                  onChange={(e) => setFormData({ ...formData, prioridade_resultado: e.target.value as any })}
                  className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                >
                  {PRIORIDADES.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-gray-300 text-sm font-medium mb-2 block">Descrição</label>
              <textarea
                value={formData.descricao || ''}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                rows={2}
                placeholder="Descreva quando esta regra deve ser aplicada"
              />
            </div>

            <div className="border-t border-gray-700 pt-4">
              <h5 className="text-white font-medium mb-3">Condições (deixe em branco para ignorar)</h5>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-gray-400 text-sm mb-2 block">Dias na etapa (mínimo)</label>
                  <input
                    type="number"
                    value={formData.dias_na_etapa_min || ''}
                    onChange={(e) => setFormData({ ...formData, dias_na_etapa_min: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    placeholder="Ex: 10"
                  />
                </div>

                <div>
                  <label className="text-gray-400 text-sm mb-2 block">Dias na etapa (máximo)</label>
                  <input
                    type="number"
                    value={formData.dias_na_etapa_max || ''}
                    onChange={(e) => setFormData({ ...formData, dias_na_etapa_max: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    placeholder="Ex: 20"
                  />
                </div>

                <div>
                  <label className="text-gray-400 text-sm mb-2 block">Tipo de OS</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.tipo_os?.includes('LP') || false}
                        onChange={(e) => {
                          const current = formData.tipo_os || [];
                          setFormData({
                            ...formData,
                            tipo_os: e.target.checked
                              ? [...current, 'LP']
                              : current.filter(t => t !== 'LP')
                          });
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-white">LP</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.tipo_os?.includes('OW') || false}
                        onChange={(e) => {
                          const current = formData.tipo_os || [];
                          setFormData({
                            ...formData,
                            tipo_os: e.target.checked
                              ? [...current, 'OW']
                              : current.filter(t => t !== 'OW')
                          });
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-white">OW</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="text-gray-400 text-sm mb-2 block">Tipo de Atendimento</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.tipo_atendimento?.includes('IH') || false}
                        onChange={(e) => {
                          const current = formData.tipo_atendimento || [];
                          setFormData({
                            ...formData,
                            tipo_atendimento: e.target.checked
                              ? [...current, 'IH']
                              : current.filter(t => t !== 'IH')
                          });
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-white">IH</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={formData.tipo_atendimento?.includes('CI') || false}
                        onChange={(e) => {
                          const current = formData.tipo_atendimento || [];
                          setFormData({
                            ...formData,
                            tipo_atendimento: e.target.checked
                              ? [...current, 'CI']
                              : current.filter(t => t !== 'CI')
                          });
                        }}
                        className="w-4 h-4"
                      />
                      <span className="text-white">CI</span>
                    </label>
                  </div>
                </div>

                <div>
                  <label className="text-gray-400 text-sm mb-2 block">Modelos (separados por vírgula)</label>
                  <input
                    type="text"
                    value={formData.modelos_aparelho?.join(', ') || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      modelos_aparelho: e.target.value ? e.target.value.split(',').map(m => m.trim()) : null
                    })}
                    className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    placeholder="Ex: Galaxy S21, iPhone 12"
                  />
                </div>

                <div>
                  <label className="text-gray-400 text-sm mb-2 block">Marcas (separadas por vírgula)</label>
                  <input
                    type="text"
                    value={formData.marcas_aparelho?.join(', ') || ''}
                    onChange={(e) => setFormData({
                      ...formData,
                      marcas_aparelho: e.target.value ? e.target.value.split(',').map(m => m.trim()) : null
                    })}
                    className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                    placeholder="Ex: Samsung, Apple"
                  />
                </div>

                <div>
                  <label className="text-gray-400 text-sm mb-2 block">Cliente VIP</label>
                  <select
                    value={formData.cliente_vip === null ? '' : formData.cliente_vip ? 'true' : 'false'}
                    onChange={(e) => setFormData({
                      ...formData,
                      cliente_vip: e.target.value === '' ? null : e.target.value === 'true'
                    })}
                    className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                  >
                    <option value="">Qualquer</option>
                    <option value="true">Apenas VIP</option>
                    <option value="false">Apenas não-VIP</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-4 border-t border-gray-700">
              <button
                onClick={handleSave}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-lg text-white font-medium transition-all"
              >
                <Save className="w-4 h-4" />
                Salvar
              </button>
              <button
                onClick={cancelEdit}
                className="flex items-center gap-2 px-6 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-white font-medium transition-all"
              >
                <X className="w-4 h-4" />
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {regras.map((regra, index) => {
          const prioridade = PRIORIDADES.find(p => p.value === regra.prioridade_resultado);

          return (
            <div
              key={regra.id}
              className={`bg-gray-800/50 border rounded-xl p-4 transition-all ${
                regra.ativa ? 'border-gray-700' : 'border-gray-800 opacity-50'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => handleMoveUp(regra)}
                    disabled={index === 0}
                    className="p-1 hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  </button>
                  <button
                    onClick={() => handleMoveDown(regra)}
                    disabled={index === regras.length - 1}
                    className="p-1 hover:bg-gray-700 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  </button>
                </div>

                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-gray-500 font-mono">#{index + 1}</span>
                    <h4 className="text-lg font-bold text-white">{regra.nome}</h4>
                    <span
                      className="px-3 py-1 rounded-full text-xs font-bold"
                      style={{
                        backgroundColor: `${prioridade?.color}20`,
                        color: prioridade?.color,
                        border: `1px solid ${prioridade?.color}40`
                      }}
                    >
                      → {prioridade?.label}
                    </span>
                  </div>

                  {regra.descricao && (
                    <p className="text-gray-400 text-sm mb-3">{regra.descricao}</p>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {regra.dias_na_etapa_min && (
                      <span className="px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded text-blue-300 text-xs">
                        ≥ {regra.dias_na_etapa_min} dias
                      </span>
                    )}
                    {regra.dias_na_etapa_max && (
                      <span className="px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded text-blue-300 text-xs">
                        ≤ {regra.dias_na_etapa_max} dias
                      </span>
                    )}
                    {regra.tipo_os && regra.tipo_os.length > 0 && (
                      <span className="px-2 py-1 bg-purple-500/20 border border-purple-500/30 rounded text-purple-300 text-xs">
                        Tipo: {regra.tipo_os.join(', ')}
                      </span>
                    )}
                    {regra.tipo_atendimento && regra.tipo_atendimento.length > 0 && (
                      <span className="px-2 py-1 bg-green-500/20 border border-green-500/30 rounded text-green-300 text-xs">
                        Atend: {regra.tipo_atendimento.join(', ')}
                      </span>
                    )}
                    {regra.modelos_aparelho && regra.modelos_aparelho.length > 0 && (
                      <span className="px-2 py-1 bg-yellow-500/20 border border-yellow-500/30 rounded text-yellow-300 text-xs">
                        Modelos: {regra.modelos_aparelho.join(', ')}
                      </span>
                    )}
                    {regra.marcas_aparelho && regra.marcas_aparelho.length > 0 && (
                      <span className="px-2 py-1 bg-orange-500/20 border border-orange-500/30 rounded text-orange-300 text-xs">
                        Marcas: {regra.marcas_aparelho.join(', ')}
                      </span>
                    )}
                    {regra.cliente_vip === true && (
                      <span className="px-2 py-1 bg-pink-500/20 border border-pink-500/30 rounded text-pink-300 text-xs">
                        Cliente VIP
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleAtiva(regra.id, regra.ativa)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                      regra.ativa
                        ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                        : 'bg-gray-700 text-gray-400 border border-gray-600'
                    }`}
                  >
                    {regra.ativa ? 'Ativa' : 'Inativa'}
                  </button>
                  <button
                    onClick={() => startEdit(regra)}
                    className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
                  >
                    <Edit2 className="w-4 h-4 text-gray-400" />
                  </button>
                  <button
                    onClick={() => handleDelete(regra.id)}
                    className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {regras.length === 0 && !criandoNova && (
          <div className="text-center py-12 text-gray-500">
            <p>Nenhuma regra de prioridade configurada</p>
            <p className="text-sm mt-1">Clique em "Nova Regra" para começar</p>
          </div>
        )}
      </div>
    </div>
  );
}
