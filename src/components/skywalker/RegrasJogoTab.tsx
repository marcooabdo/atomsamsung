import { useState, useEffect } from 'react';
import { BookOpen, Plus, Pencil, Trash2, Star, ChevronDown, ChevronUp, Save, X, AlertTriangle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Pilar {
  id: string;
  nome: string;
  descricao: string | null;
  tipo_metrica: string;
  time_aplicavel: string[];
  max_estrelas: number;
  meta_front_office: number;
  meta_inside_sales: number;
  ordem: number;
  ativo: boolean;
}

interface RegraEstrela {
  id: string;
  pilar_id: string;
  time: string;
  valor_minimo: number;
  valor_maximo: number | null;
  estrelas: number;
  ativo: boolean;
}

interface RegraPromocao {
  id: string;
  tipo: 'promocao' | 'rebaixamento';
  nome: string;
  descricao: string | null;
  condicao: string;
  ativo: boolean;
  obrigatorio: boolean;
  ordem: number;
}

interface NovaRegraPromocao {
  tipo: 'promocao' | 'rebaixamento';
  nome: string;
  descricao: string;
  condicao: string;
  obrigatorio: boolean;
}

interface Bonificacao {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: 'valor_fixo' | 'percentual' | 'estrelas_bonus';
  valor: number;
  condicao: string;
  condicao_valor: number | null;
  time_aplicavel: string[] | null;
  nivel_minimo_id: string | null;
  ativo: boolean;
}

export function RegrasJogoTab() {
  const [pilares, setPilares] = useState<Pilar[]>([]);
  const [regrasEstrelas, setRegrasEstrelas] = useState<RegraEstrela[]>([]);
  const [regrasPromocao, setRegrasPromocao] = useState<RegraPromocao[]>([]);
  const [bonificacoes, setBonificacoes] = useState<Bonificacao[]>([]);
  const [loading, setLoading] = useState(true);

  const [expandedPilar, setExpandedPilar] = useState<string | null>(null);
  const [editingRegra, setEditingRegra] = useState<RegraEstrela | null>(null);
  const [showNovaRegra, setShowNovaRegra] = useState<string | null>(null);
  const [showNovoPilar, setShowNovoPilar] = useState(false);
  const [editingPilar, setEditingPilar] = useState<Pilar | null>(null);
  const [showNovaBonificacao, setShowNovaBonificacao] = useState(false);
  const [showNovaRegraPromocao, setShowNovaRegraPromocao] = useState(false);
  const [editingRegraPromocao, setEditingRegraPromocao] = useState<RegraPromocao | null>(null);
  const [tipoRegraPromocao, setTipoRegraPromocao] = useState<'promocao' | 'rebaixamento'>('promocao');

  const [novoPilar, setNovoPilar] = useState({
    nome: '',
    descricao: '',
    tipo_metrica: 'quantidade',
    time_aplicavel: ['front_office', 'inside_sales'],
    max_estrelas: 3,
    meta_front_office: 10,
    meta_inside_sales: 10
  });

  const [novaRegra, setNovaRegra] = useState({
    pilar_id: '',
    time: 'front_office',
    valor_minimo: 0,
    valor_maximo: null as number | null,
    estrelas: 1
  });

  const [novaBonificacao, setNovaBonificacao] = useState({
    nome: '',
    descricao: '',
    tipo: 'valor_fixo' as const,
    valor: 0,
    condicao: 'meta_atingida',
    condicao_valor: null as number | null,
    time_aplicavel: ['front_office', 'inside_sales']
  });

  const [novaRegraPromocao, setNovaRegraPromocao] = useState<NovaRegraPromocao>({
    tipo: 'promocao',
    nome: '',
    descricao: '',
    condicao: '',
    obrigatorio: false
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [pilaresRes, regrasRes, promocaoRes, bonusRes] = await Promise.all([
      supabase.from('skywalker_pilares').select('*').order('ordem'),
      supabase.from('skywalker_regras_estrelas').select('*').order('pilar_id, valor_minimo'),
      supabase.from('skywalker_regras_promocao').select('*').order('tipo, ordem'),
      supabase.from('skywalker_bonificacoes').select('*').order('created_at')
    ]);

    if (pilaresRes.data) setPilares(pilaresRes.data);
    if (regrasRes.data) setRegrasEstrelas(regrasRes.data);
    if (promocaoRes.data) setRegrasPromocao(promocaoRes.data);
    if (bonusRes.data) setBonificacoes(bonusRes.data);
    setLoading(false);
  };

  const handleSavePilar = async () => {
    if (!novoPilar.nome.trim()) return;

    const ordem = pilares.length + 1;
    const { error } = await supabase.from('skywalker_pilares').insert({
      ...novoPilar,
      ordem,
      ativo: true
    });

    if (!error) {
      setShowNovoPilar(false);
      setNovoPilar({
        nome: '',
        descricao: '',
        tipo_metrica: 'quantidade',
        time_aplicavel: ['front_office', 'inside_sales'],
        max_estrelas: 3,
        meta_front_office: 10,
        meta_inside_sales: 10
      });
      loadData();
    }
  };

  const handleUpdatePilar = async () => {
    if (!editingPilar) return;

    const { error } = await supabase
      .from('skywalker_pilares')
      .update({
        nome: editingPilar.nome,
        descricao: editingPilar.descricao,
        tipo_metrica: editingPilar.tipo_metrica,
        time_aplicavel: editingPilar.time_aplicavel,
        max_estrelas: editingPilar.max_estrelas,
        meta_front_office: editingPilar.meta_front_office,
        meta_inside_sales: editingPilar.meta_inside_sales
      })
      .eq('id', editingPilar.id);

    if (!error) {
      setEditingPilar(null);
      loadData();
    }
  };

  const handleDeletePilar = async (id: string) => {
    if (!confirm('Excluir este pilar e todas as regras associadas?')) return;

    await supabase.from('skywalker_regras_estrelas').delete().eq('pilar_id', id);
    await supabase.from('skywalker_pilares').delete().eq('id', id);
    loadData();
  };

  const handleSaveRegra = async () => {
    if (!novaRegra.pilar_id) return;

    const { error } = await supabase.from('skywalker_regras_estrelas').insert({
      ...novaRegra,
      ativo: true
    });

    if (!error) {
      setShowNovaRegra(null);
      setNovaRegra({
        pilar_id: '',
        time: 'front_office',
        valor_minimo: 0,
        valor_maximo: null,
        estrelas: 1
      });
      loadData();
    }
  };

  const handleUpdateRegra = async () => {
    if (!editingRegra) return;

    const { error } = await supabase
      .from('skywalker_regras_estrelas')
      .update({
        time: editingRegra.time,
        valor_minimo: editingRegra.valor_minimo,
        valor_maximo: editingRegra.valor_maximo,
        estrelas: editingRegra.estrelas
      })
      .eq('id', editingRegra.id);

    if (!error) {
      setEditingRegra(null);
      loadData();
    }
  };

  const handleDeleteRegra = async (id: string) => {
    if (!confirm('Excluir esta regra?')) return;
    await supabase.from('skywalker_regras_estrelas').delete().eq('id', id);
    loadData();
  };

  const handleToggleRegraPromocao = async (id: string, ativo: boolean) => {
    await supabase.from('skywalker_regras_promocao').update({ ativo }).eq('id', id);
    loadData();
  };

  const handleSaveRegraPromocao = async () => {
    if (!novaRegraPromocao.nome.trim() || !novaRegraPromocao.condicao.trim()) return;

    const ordem = regrasPromocao.filter(r => r.tipo === novaRegraPromocao.tipo).length + 1;
    const { error } = await supabase.from('skywalker_regras_promocao').insert({
      ...novaRegraPromocao,
      ordem,
      ativo: true
    });

    if (!error) {
      setShowNovaRegraPromocao(false);
      setNovaRegraPromocao({
        tipo: 'promocao',
        nome: '',
        descricao: '',
        condicao: '',
        obrigatorio: false
      });
      loadData();
    }
  };

  const handleUpdateRegraPromocao = async () => {
    if (!editingRegraPromocao) return;

    const { error } = await supabase
      .from('skywalker_regras_promocao')
      .update({
        nome: editingRegraPromocao.nome,
        descricao: editingRegraPromocao.descricao,
        condicao: editingRegraPromocao.condicao,
        obrigatorio: editingRegraPromocao.obrigatorio,
        ativo: editingRegraPromocao.ativo
      })
      .eq('id', editingRegraPromocao.id);

    if (!error) {
      setEditingRegraPromocao(null);
      loadData();
    }
  };

  const handleDeleteRegraPromocao = async (id: string) => {
    if (!confirm('Excluir esta regra?')) return;
    await supabase.from('skywalker_regras_promocao').delete().eq('id', id);
    loadData();
  };

  const handleSaveBonificacao = async () => {
    if (!novaBonificacao.nome.trim()) return;

    const { error } = await supabase.from('skywalker_bonificacoes').insert({
      ...novaBonificacao,
      ativo: true
    });

    if (!error) {
      setShowNovaBonificacao(false);
      setNovaBonificacao({
        nome: '',
        descricao: '',
        tipo: 'valor_fixo',
        valor: 0,
        condicao: 'meta_atingida',
        condicao_valor: null,
        time_aplicavel: ['front_office', 'inside_sales']
      });
      loadData();
    }
  };

  const handleDeleteBonificacao = async (id: string) => {
    if (!confirm('Excluir esta bonificacao?')) return;
    await supabase.from('skywalker_bonificacoes').delete().eq('id', id);
    loadData();
  };

  const getTimeName = (time: string) => {
    return time === 'front_office' ? 'Front Office' : 'Inside Sales';
  };

  const getMetricaLabel = (pilar: Pilar, valor: number) => {
    if (pilar.tipo_metrica === 'percentual') return `${valor}%`;
    if (pilar.tipo_metrica === 'valor') return `R$ ${valor}`;
    return valor.toString();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <BookOpen className="w-6 h-6 text-blue-400" />
          Regras do Jogo
        </h2>
        <p className="text-gray-400 text-sm">Configure pilares, metas e estrelas</p>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-cyan-400">Pilares de Avaliacao</h3>
          <button
            onClick={() => setShowNovoPilar(true)}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:opacity-90"
          >
            <Plus className="w-4 h-4" />
            Novo Pilar
          </button>
        </div>

        {showNovoPilar && (
          <div className="bg-gray-800/80 rounded-xl p-6 border border-cyan-500/50">
            <h4 className="text-lg font-bold text-white mb-4">Criar Novo Pilar</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nome</label>
                <input
                  type="text"
                  value={novoPilar.nome}
                  onChange={(e) => setNovoPilar({ ...novoPilar, nome: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  placeholder="Ex: Taxa de Conversao"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Tipo de Metrica</label>
                <select
                  value={novoPilar.tipo_metrica}
                  onChange={(e) => setNovoPilar({ ...novoPilar, tipo_metrica: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
                >
                  <option value="quantidade">Quantidade</option>
                  <option value="percentual">Percentual</option>
                  <option value="valor">Valor (R$)</option>
                  <option value="binario">Sim/Nao</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm text-gray-400 mb-1">Descricao</label>
                <textarea
                  value={novoPilar.descricao}
                  onChange={(e) => setNovoPilar({ ...novoPilar, descricao: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  rows={2}
                  placeholder="Descreva o que este pilar avalia..."
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Maximo de Estrelas</label>
                <input
                  type="number"
                  value={novoPilar.max_estrelas}
                  onChange={(e) => setNovoPilar({ ...novoPilar, max_estrelas: Number(e.target.value) })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  min={1}
                  max={5}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Aplicavel a</label>
                <div className="flex gap-4 mt-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={novoPilar.time_aplicavel.includes('front_office')}
                      onChange={(e) => {
                        const times = e.target.checked
                          ? [...novoPilar.time_aplicavel, 'front_office']
                          : novoPilar.time_aplicavel.filter(t => t !== 'front_office');
                        setNovoPilar({ ...novoPilar, time_aplicavel: times });
                      }}
                      className="w-4 h-4 accent-cyan-500"
                    />
                    <span className="text-gray-300">Front Office</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={novoPilar.time_aplicavel.includes('inside_sales')}
                      onChange={(e) => {
                        const times = e.target.checked
                          ? [...novoPilar.time_aplicavel, 'inside_sales']
                          : novoPilar.time_aplicavel.filter(t => t !== 'inside_sales');
                        setNovoPilar({ ...novoPilar, time_aplicavel: times });
                      }}
                      className="w-4 h-4 accent-cyan-500"
                    />
                    <span className="text-gray-300">Inside Sales</span>
                  </label>
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Meta Front Office</label>
                <input
                  type="number"
                  value={novoPilar.meta_front_office}
                  onChange={(e) => setNovoPilar({ ...novoPilar, meta_front_office: Number(e.target.value) })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Meta Inside Sales</label>
                <input
                  type="number"
                  value={novoPilar.meta_inside_sales}
                  onChange={(e) => setNovoPilar({ ...novoPilar, meta_inside_sales: Number(e.target.value) })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowNovoPilar(false)}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleSavePilar}
                className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700"
              >
                <Save className="w-4 h-4" />
                Salvar Pilar
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {pilares.map((pilar) => {
            const regras = regrasEstrelas.filter(r => r.pilar_id === pilar.id);
            const isExpanded = expandedPilar === pilar.id;
            const isEditing = editingPilar?.id === pilar.id;

            return (
              <div key={pilar.id} className="bg-gray-800/50 rounded-xl border border-gray-700 overflow-hidden">
                <div
                  className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-800/80"
                  onClick={() => setExpandedPilar(isExpanded ? null : pilar.id)}
                >
                  <div className="flex items-center gap-4">
                    <div className="p-2 bg-cyan-500/20 rounded-lg">
                      <Star className="w-5 h-5 text-cyan-400" />
                    </div>
                    <div>
                      <h4 className="text-white font-bold">{pilar.nome}</h4>
                      <p className="text-gray-400 text-sm">{pilar.descricao}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex gap-2">
                      {pilar.time_aplicavel.map(time => (
                        <span
                          key={time}
                          className={`px-2 py-1 rounded text-xs ${
                            time === 'front_office'
                              ? 'bg-blue-500/20 text-blue-400'
                              : 'bg-purple-500/20 text-purple-400'
                          }`}
                        >
                          {getTimeName(time)}
                        </span>
                      ))}
                    </div>
                    <span className="text-gray-400 text-sm">{regras.length} regras</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingPilar(pilar);
                        }}
                        className="p-1.5 text-gray-400 hover:text-cyan-400 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeletePilar(pilar.id);
                        }}
                        className="p-1.5 text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-5 h-5 text-gray-400" />
                    ) : (
                      <ChevronDown className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-700 p-4 space-y-4">
                    {isEditing && (
                      <div className="bg-gray-900/50 rounded-lg p-4 border border-cyan-500/30 mb-4">
                        <h5 className="text-cyan-400 font-bold mb-3">Editar Pilar</h5>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <input
                            type="text"
                            value={editingPilar.nome}
                            onChange={(e) => setEditingPilar({ ...editingPilar, nome: e.target.value })}
                            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                            placeholder="Nome"
                          />
                          <select
                            value={editingPilar.tipo_metrica}
                            onChange={(e) => setEditingPilar({ ...editingPilar, tipo_metrica: e.target.value })}
                            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                          >
                            <option value="quantidade">Quantidade</option>
                            <option value="percentual">Percentual</option>
                            <option value="valor">Valor</option>
                            <option value="binario">Sim/Nao</option>
                          </select>
                          <input
                            type="number"
                            value={editingPilar.max_estrelas}
                            onChange={(e) => setEditingPilar({ ...editingPilar, max_estrelas: Number(e.target.value) })}
                            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                            placeholder="Max Estrelas"
                          />
                        </div>
                        <div className="flex justify-end gap-2 mt-3">
                          <button
                            onClick={() => setEditingPilar(null)}
                            className="px-3 py-1.5 bg-gray-700 text-white rounded text-sm"
                          >
                            Cancelar
                          </button>
                          <button
                            onClick={handleUpdatePilar}
                            className="px-3 py-1.5 bg-cyan-600 text-white rounded text-sm"
                          >
                            Salvar
                          </button>
                        </div>
                      </div>
                    )}

                    <div className="flex items-center justify-between mb-2">
                      <span className="text-gray-400 text-sm font-medium">Regras de Estrelas</span>
                      <button
                        onClick={() => {
                          setNovaRegra({ ...novaRegra, pilar_id: pilar.id });
                          setShowNovaRegra(pilar.id);
                        }}
                        className="flex items-center gap-1 px-3 py-1.5 bg-cyan-600/20 text-cyan-400 rounded text-sm hover:bg-cyan-600/30"
                      >
                        <Plus className="w-3 h-3" />
                        Nova Regra
                      </button>
                    </div>

                    {showNovaRegra === pilar.id && (
                      <div className="bg-gray-900/80 rounded-lg p-4 border border-cyan-500/30">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                          <select
                            value={novaRegra.time}
                            onChange={(e) => setNovaRegra({ ...novaRegra, time: e.target.value })}
                            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                          >
                            <option value="front_office">Front Office</option>
                            <option value="inside_sales">Inside Sales</option>
                          </select>
                          <input
                            type="number"
                            value={novaRegra.valor_minimo}
                            onChange={(e) => setNovaRegra({ ...novaRegra, valor_minimo: Number(e.target.value) })}
                            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                            placeholder="Valor Minimo"
                          />
                          <input
                            type="number"
                            value={novaRegra.valor_maximo || ''}
                            onChange={(e) => setNovaRegra({ ...novaRegra, valor_maximo: e.target.value ? Number(e.target.value) : null })}
                            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                            placeholder="Valor Maximo"
                          />
                          <input
                            type="number"
                            value={novaRegra.estrelas}
                            onChange={(e) => setNovaRegra({ ...novaRegra, estrelas: Number(e.target.value) })}
                            className="bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                            placeholder="Estrelas"
                            min={0}
                            max={pilar.max_estrelas}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => setShowNovaRegra(null)}
                              className="flex-1 px-3 py-2 bg-gray-700 text-white rounded text-sm"
                            >
                              <X className="w-4 h-4 mx-auto" />
                            </button>
                            <button
                              onClick={handleSaveRegra}
                              className="flex-1 px-3 py-2 bg-cyan-600 text-white rounded text-sm"
                            >
                              <Save className="w-4 h-4 mx-auto" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      {regras.length === 0 ? (
                        <p className="text-gray-500 text-sm text-center py-4">Nenhuma regra configurada</p>
                      ) : (
                        regras.map((regra) => (
                          <div
                            key={regra.id}
                            className="flex items-center justify-between p-3 bg-gray-900/50 rounded-lg"
                          >
                            {editingRegra?.id === regra.id ? (
                              <div className="flex-1 grid grid-cols-5 gap-3">
                                <select
                                  value={editingRegra.time}
                                  onChange={(e) => setEditingRegra({ ...editingRegra, time: e.target.value })}
                                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-sm"
                                >
                                  <option value="front_office">Front Office</option>
                                  <option value="inside_sales">Inside Sales</option>
                                </select>
                                <input
                                  type="number"
                                  value={editingRegra.valor_minimo}
                                  onChange={(e) => setEditingRegra({ ...editingRegra, valor_minimo: Number(e.target.value) })}
                                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-sm"
                                />
                                <input
                                  type="number"
                                  value={editingRegra.valor_maximo || ''}
                                  onChange={(e) => setEditingRegra({ ...editingRegra, valor_maximo: e.target.value ? Number(e.target.value) : null })}
                                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-sm"
                                />
                                <input
                                  type="number"
                                  value={editingRegra.estrelas}
                                  onChange={(e) => setEditingRegra({ ...editingRegra, estrelas: Number(e.target.value) })}
                                  className="bg-gray-800 border border-gray-700 rounded px-2 py-1 text-white text-sm"
                                />
                                <div className="flex gap-1">
                                  <button onClick={() => setEditingRegra(null)} className="p-1 text-gray-400 hover:text-white">
                                    <X className="w-4 h-4" />
                                  </button>
                                  <button onClick={handleUpdateRegra} className="p-1 text-cyan-400 hover:text-cyan-300">
                                    <Save className="w-4 h-4" />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-center gap-4">
                                  <span className={`px-2 py-1 rounded text-xs ${
                                    regra.time === 'front_office'
                                      ? 'bg-blue-500/20 text-blue-400'
                                      : 'bg-purple-500/20 text-purple-400'
                                  }`}>
                                    {getTimeName(regra.time)}
                                  </span>
                                  <span className="text-gray-300">
                                    {getMetricaLabel(pilar, regra.valor_minimo)}
                                    {regra.valor_maximo && ` - ${getMetricaLabel(pilar, regra.valor_maximo)}`}
                                    {!regra.valor_maximo && '+'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center gap-0.5">
                                    {Array.from({ length: regra.estrelas }).map((_, i) => (
                                      <Star key={i} className="w-4 h-4 text-yellow-400 fill-current" />
                                    ))}
                                    {regra.estrelas === 0 && <span className="text-gray-500 text-sm">0 estrelas</span>}
                                  </div>
                                  <button
                                    onClick={() => setEditingRegra(regra)}
                                    className="p-1 text-gray-400 hover:text-cyan-400"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteRegra(regra.id)}
                                    className="p-1 text-gray-400 hover:text-red-400"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              </>
                            )}
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-gray-800/50 rounded-xl border border-green-500/30 overflow-hidden">
          <div className="p-4 flex items-center justify-between bg-green-500/10">
            <h3 className="text-lg font-bold text-green-400 flex items-center gap-2">
              <ChevronUp className="w-5 h-5" />
              Regras de Promocao
            </h3>
            <button
              onClick={() => {
                setTipoRegraPromocao('promocao');
                setNovaRegraPromocao({ ...novaRegraPromocao, tipo: 'promocao' });
                setShowNovaRegraPromocao(true);
              }}
              className="flex items-center gap-1 px-3 py-1.5 bg-green-600/20 text-green-400 rounded text-sm hover:bg-green-600/30"
            >
              <Plus className="w-4 h-4" />
              Nova
            </button>
          </div>
          <div className="p-4 space-y-2">
            {regrasPromocao.filter(r => r.tipo === 'promocao').map((regra) => (
              <div key={regra.id}>
                {editingRegraPromocao?.id === regra.id ? (
                  <div className="bg-gray-900/50 rounded-lg p-3 border border-green-500/50 space-y-2">
                    <input
                      type="text"
                      value={editingRegraPromocao.nome}
                      onChange={(e) => setEditingRegraPromocao({ ...editingRegraPromocao, nome: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                      placeholder="Nome da regra"
                    />
                    <textarea
                      value={editingRegraPromocao.descricao || ''}
                      onChange={(e) => setEditingRegraPromocao({ ...editingRegraPromocao, descricao: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                      placeholder="Descricao"
                      rows={2}
                    />
                    <input
                      type="text"
                      value={editingRegraPromocao.condicao}
                      onChange={(e) => setEditingRegraPromocao({ ...editingRegraPromocao, condicao: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                      placeholder="Codigo da condicao"
                    />
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingRegraPromocao.obrigatorio}
                          onChange={(e) => setEditingRegraPromocao({ ...editingRegraPromocao, obrigatorio: e.target.checked })}
                          className="w-4 h-4 accent-green-500"
                        />
                        <span className="text-gray-300 text-sm">Obrigatorio</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingRegraPromocao.ativo}
                          onChange={(e) => setEditingRegraPromocao({ ...editingRegraPromocao, ativo: e.target.checked })}
                          className="w-4 h-4 accent-green-500"
                        />
                        <span className="text-gray-300 text-sm">Ativo</span>
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingRegraPromocao(null)}
                        className="flex-1 px-3 py-1.5 bg-gray-700 text-white rounded text-sm"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleUpdateRegraPromocao}
                        className="flex-1 px-3 py-1.5 bg-green-600 text-white rounded text-sm"
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg hover:bg-gray-900">
                    <input
                      type="checkbox"
                      checked={regra.ativo}
                      onChange={(e) => handleToggleRegraPromocao(regra.id, e.target.checked)}
                      className="w-4 h-4 accent-green-500"
                    />
                    <div className="flex-1">
                      <span className={`text-sm font-medium ${regra.ativo ? 'text-gray-300' : 'text-gray-500'}`}>
                        {regra.nome}
                      </span>
                      {regra.descricao && (
                        <p className="text-xs text-gray-500 mt-0.5">{regra.descricao}</p>
                      )}
                      {regra.obrigatorio && (
                        <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">
                          Obrigatorio
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditingRegraPromocao(regra)}
                        className="p-1.5 text-gray-400 hover:text-green-400"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteRegraPromocao(regra.id)}
                        className="p-1.5 text-gray-400 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {regrasPromocao.filter(r => r.tipo === 'promocao').length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">Nenhuma regra configurada</p>
            )}
          </div>
        </div>

        <div className="bg-gray-800/50 rounded-xl border border-red-500/30 overflow-hidden">
          <div className="p-4 flex items-center justify-between bg-red-500/10">
            <h3 className="text-lg font-bold text-red-400 flex items-center gap-2">
              <ChevronDown className="w-5 h-5" />
              Regras de Rebaixamento
            </h3>
            <button
              onClick={() => {
                setTipoRegraPromocao('rebaixamento');
                setNovaRegraPromocao({ ...novaRegraPromocao, tipo: 'rebaixamento' });
                setShowNovaRegraPromocao(true);
              }}
              className="flex items-center gap-1 px-3 py-1.5 bg-red-600/20 text-red-400 rounded text-sm hover:bg-red-600/30"
            >
              <Plus className="w-4 h-4" />
              Nova
            </button>
          </div>
          <div className="p-4 space-y-2">
            {regrasPromocao.filter(r => r.tipo === 'rebaixamento').map((regra) => (
              <div key={regra.id}>
                {editingRegraPromocao?.id === regra.id ? (
                  <div className="bg-gray-900/50 rounded-lg p-3 border border-red-500/50 space-y-2">
                    <input
                      type="text"
                      value={editingRegraPromocao.nome}
                      onChange={(e) => setEditingRegraPromocao({ ...editingRegraPromocao, nome: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                      placeholder="Nome da regra"
                    />
                    <textarea
                      value={editingRegraPromocao.descricao || ''}
                      onChange={(e) => setEditingRegraPromocao({ ...editingRegraPromocao, descricao: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                      placeholder="Descricao"
                      rows={2}
                    />
                    <input
                      type="text"
                      value={editingRegraPromocao.condicao}
                      onChange={(e) => setEditingRegraPromocao({ ...editingRegraPromocao, condicao: e.target.value })}
                      className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                      placeholder="Codigo da condicao"
                    />
                    <div className="flex items-center justify-between">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingRegraPromocao.obrigatorio}
                          onChange={(e) => setEditingRegraPromocao({ ...editingRegraPromocao, obrigatorio: e.target.checked })}
                          className="w-4 h-4 accent-red-500"
                        />
                        <span className="text-gray-300 text-sm">Obrigatorio</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editingRegraPromocao.ativo}
                          onChange={(e) => setEditingRegraPromocao({ ...editingRegraPromocao, ativo: e.target.checked })}
                          className="w-4 h-4 accent-red-500"
                        />
                        <span className="text-gray-300 text-sm">Ativo</span>
                      </label>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditingRegraPromocao(null)}
                        className="flex-1 px-3 py-1.5 bg-gray-700 text-white rounded text-sm"
                      >
                        Cancelar
                      </button>
                      <button
                        onClick={handleUpdateRegraPromocao}
                        className="flex-1 px-3 py-1.5 bg-red-600 text-white rounded text-sm"
                      >
                        Salvar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg hover:bg-gray-900">
                    <input
                      type="checkbox"
                      checked={regra.ativo}
                      onChange={(e) => handleToggleRegraPromocao(regra.id, e.target.checked)}
                      className="w-4 h-4 accent-red-500"
                    />
                    <div className="flex-1">
                      <span className={`text-sm font-medium ${regra.ativo ? 'text-gray-300' : 'text-gray-500'}`}>
                        {regra.nome}
                      </span>
                      {regra.descricao && (
                        <p className="text-xs text-gray-500 mt-0.5">{regra.descricao}</p>
                      )}
                      {regra.obrigatorio && (
                        <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded">
                          Obrigatorio
                        </span>
                      )}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={() => setEditingRegraPromocao(regra)}
                        className="p-1.5 text-gray-400 hover:text-red-400"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteRegraPromocao(regra.id)}
                        className="p-1.5 text-gray-400 hover:text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
            {regrasPromocao.filter(r => r.tipo === 'rebaixamento').length === 0 && (
              <p className="text-gray-500 text-sm text-center py-4">Nenhuma regra configurada</p>
            )}
          </div>
        </div>
      </div>

      {showNovaRegraPromocao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
          <div className="bg-gray-900 border border-cyan-500/50 rounded-xl p-6 w-full max-w-2xl">
            <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Criar Nova Regra de {tipoRegraPromocao === 'promocao' ? 'Promocao' : 'Rebaixamento'}
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nome da Regra *</label>
                <input
                  type="text"
                  value={novaRegraPromocao.nome}
                  onChange={(e) => setNovaRegraPromocao({ ...novaRegraPromocao, nome: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  placeholder="Ex: Atingir meta mensal"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Descricao</label>
                <textarea
                  value={novaRegraPromocao.descricao}
                  onChange={(e) => setNovaRegraPromocao({ ...novaRegraPromocao, descricao: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  placeholder="Descreva em detalhes a condicao para aplicacao desta regra"
                  rows={3}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Codigo da Condicao *</label>
                <input
                  type="text"
                  value={novaRegraPromocao.condicao}
                  onChange={(e) => setNovaRegraPromocao({ ...novaRegraPromocao, condicao: e.target.value })}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white font-mono text-sm"
                  placeholder="Ex: meta_atingida, estrelas_minimas, meses_consecutivos"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Codigo usado no sistema para verificar a condicao
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={novaRegraPromocao.obrigatorio}
                  onChange={(e) => setNovaRegraPromocao({ ...novaRegraPromocao, obrigatorio: e.target.checked })}
                  className={`w-4 h-4 ${tipoRegraPromocao === 'promocao' ? 'accent-green-500' : 'accent-red-500'}`}
                />
                <span className="text-gray-300">Regra obrigatoria</span>
              </label>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowNovaRegraPromocao(false)}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveRegraPromocao}
                className={`flex items-center gap-2 px-4 py-2 ${
                  tipoRegraPromocao === 'promocao' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
                } text-white rounded-lg`}
              >
                <Save className="w-4 h-4" />
                Salvar Regra
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-yellow-400 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Bonificacoes Extras
          </h3>
          <button
            onClick={() => setShowNovaBonificacao(true)}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-600/20 text-yellow-400 rounded-lg hover:bg-yellow-600/30"
          >
            <Plus className="w-4 h-4" />
            Nova Bonificacao
          </button>
        </div>

        {showNovaBonificacao && (
          <div className="bg-gray-800/80 rounded-xl p-6 border border-yellow-500/50">
            <h4 className="text-lg font-bold text-white mb-4">Criar Bonificacao</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Nome</label>
                <input
                  type="text"
                  value={novaBonificacao.nome}
                  onChange={(e) => setNovaBonificacao({ ...novaBonificacao, nome: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
                  placeholder="Ex: Bonus Meta Trimestral"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Tipo</label>
                <select
                  value={novaBonificacao.tipo}
                  onChange={(e) => setNovaBonificacao({ ...novaBonificacao, tipo: e.target.value as any })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
                >
                  <option value="valor_fixo">Valor Fixo (R$)</option>
                  <option value="percentual">Percentual</option>
                  <option value="estrelas_bonus">Estrelas Bonus</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Valor</label>
                <input
                  type="number"
                  value={novaBonificacao.valor}
                  onChange={(e) => setNovaBonificacao({ ...novaBonificacao, valor: Number(e.target.value) })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Condicao</label>
                <select
                  value={novaBonificacao.condicao}
                  onChange={(e) => setNovaBonificacao({ ...novaBonificacao, condicao: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
                >
                  <option value="meta_atingida">Meta Atingida</option>
                  <option value="meta_superada">Meta Superada</option>
                  <option value="top_ranking">Top do Ranking</option>
                  <option value="promocao">Ao ser Promovido</option>
                  <option value="trimestre_completo">Trimestre Completo</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button
                onClick={() => setShowNovaBonificacao(false)}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveBonificacao}
                className="px-4 py-2 bg-yellow-600 text-white rounded-lg"
              >
                Salvar
              </button>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bonificacoes.map((bonus) => (
            <div
              key={bonus.id}
              className="bg-gray-800/50 rounded-xl p-4 border border-gray-700"
            >
              <div className="flex items-center justify-between mb-2">
                <h4 className="text-white font-bold">{bonus.nome}</h4>
                <button
                  onClick={() => handleDeleteBonificacao(bonus.id)}
                  className="p-1 text-gray-400 hover:text-red-400"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <p className="text-gray-400 text-sm mb-3">{bonus.descricao || 'Sem descricao'}</p>
              <div className="flex items-center justify-between">
                <span className={`px-2 py-1 rounded text-xs ${
                  bonus.tipo === 'valor_fixo' ? 'bg-green-500/20 text-green-400' :
                  bonus.tipo === 'percentual' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {bonus.tipo === 'valor_fixo' ? `R$ ${bonus.valor}` :
                   bonus.tipo === 'percentual' ? `${bonus.valor}%` :
                   `+${bonus.valor} estrelas`}
                </span>
                <span className="text-gray-500 text-xs">{bonus.condicao.replace('_', ' ')}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
