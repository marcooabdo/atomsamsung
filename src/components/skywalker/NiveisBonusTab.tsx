import { useState, useEffect } from 'react';
import { Award, Plus, Pencil, Trash2, Star, Save, X, TrendingUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Nivel {
  id: string;
  nome: string;
  ordem: number;
  estrelas_necessarias: number;
  meses_consecutivos: number;
  cor: string;
  descricao: string | null;
  bonus_valor: number;
  ativo: boolean;
}

export function NiveisBonusTab() {
  const [niveis, setNiveis] = useState<Nivel[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingNivel, setEditingNivel] = useState<Nivel | null>(null);
  const [showNovoNivel, setShowNovoNivel] = useState(false);

  const [novoNivel, setNovoNivel] = useState({
    nome: '',
    estrelas_necessarias: 6,
    meses_consecutivos: 2,
    cor: '#3B82F6',
    descricao: '',
    bonus_valor: 0
  });

  const cores = [
    { nome: 'Azul', valor: '#3B82F6' },
    { nome: 'Verde', valor: '#10B981' },
    { nome: 'Amarelo', valor: '#F59E0B' },
    { nome: 'Vermelho', valor: '#EF4444' },
    { nome: 'Roxo', valor: '#8B5CF6' },
    { nome: 'Rosa', valor: '#EC4899' },
    { nome: 'Ciano', valor: '#06B6D4' },
    { nome: 'Prata', valor: '#9CA3AF' },
    { nome: 'Ouro', valor: '#FFD700' },
    { nome: 'Bronze', valor: '#CD7F32' },
    { nome: 'Platina', valor: '#E5E4E2' },
    { nome: 'Diamante', valor: '#00D4FF' }
  ];

  useEffect(() => {
    loadNiveis();
  }, []);

  const loadNiveis = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('skywalker_niveis')
      .select('*')
      .order('ordem');

    if (data) setNiveis(data);
    setLoading(false);
  };

  const handleSaveNivel = async () => {
    if (!novoNivel.nome.trim()) return;

    const ordem = niveis.length + 1;
    const { error } = await supabase.from('skywalker_niveis').insert({
      ...novoNivel,
      ordem,
      ativo: true
    });

    if (!error) {
      setShowNovoNivel(false);
      setNovoNivel({
        nome: '',
        estrelas_necessarias: 6,
        meses_consecutivos: 2,
        cor: '#3B82F6',
        descricao: '',
        bonus_valor: 0
      });
      loadNiveis();
    }
  };

  const handleUpdateNivel = async () => {
    if (!editingNivel) return;

    const { error } = await supabase
      .from('skywalker_niveis')
      .update({
        nome: editingNivel.nome,
        estrelas_necessarias: editingNivel.estrelas_necessarias,
        meses_consecutivos: editingNivel.meses_consecutivos,
        cor: editingNivel.cor,
        descricao: editingNivel.descricao,
        bonus_valor: editingNivel.bonus_valor
      })
      .eq('id', editingNivel.id);

    if (!error) {
      setEditingNivel(null);
      loadNiveis();
    }
  };

  const handleDeleteNivel = async (id: string) => {
    if (!confirm('Excluir este nivel? Profissionais neste nivel serao afetados.')) return;
    await supabase.from('skywalker_niveis').delete().eq('id', id);
    loadNiveis();
  };

  const handleMoveNivel = async (id: string, direction: 'up' | 'down') => {
    const idx = niveis.findIndex(n => n.id === id);
    if (direction === 'up' && idx > 0) {
      const prevNivel = niveis[idx - 1];
      const currentNivel = niveis[idx];
      await supabase.from('skywalker_niveis').update({ ordem: currentNivel.ordem }).eq('id', prevNivel.id);
      await supabase.from('skywalker_niveis').update({ ordem: prevNivel.ordem }).eq('id', currentNivel.id);
    } else if (direction === 'down' && idx < niveis.length - 1) {
      const nextNivel = niveis[idx + 1];
      const currentNivel = niveis[idx];
      await supabase.from('skywalker_niveis').update({ ordem: currentNivel.ordem }).eq('id', nextNivel.id);
      await supabase.from('skywalker_niveis').update({ ordem: nextNivel.ordem }).eq('id', currentNivel.id);
    }
    loadNiveis();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <Award className="w-6 h-6 text-yellow-400" />
          Niveis e Bonus
        </h2>
        <button
          onClick={() => setShowNovoNivel(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-yellow-600 to-orange-600 text-white rounded-lg hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          Novo Nivel
        </button>
      </div>

      <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-4">
        <h4 className="text-cyan-400 font-bold mb-2">Como funciona a progressao?</h4>
        <p className="text-gray-400 text-sm">
          Profissionais sobem de nivel ao atingir o numero minimo de estrelas por uma quantidade de meses consecutivos.
          Cada nivel oferece um bonus mensal fixo alem de outros beneficios.
        </p>
      </div>

      {showNovoNivel && (
        <div className="bg-gray-800/80 rounded-xl p-6 border border-yellow-500/50">
          <h4 className="text-lg font-bold text-white mb-4">Criar Novo Nivel</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nome do Nivel</label>
              <input
                type="text"
                value={novoNivel.nome}
                onChange={(e) => setNovoNivel({ ...novoNivel, nome: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
                placeholder="Ex: Gold, Platinum, Diamond..."
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Cor do Nivel</label>
              <div className="flex gap-2 flex-wrap">
                {cores.map((cor) => (
                  <button
                    key={cor.valor}
                    onClick={() => setNovoNivel({ ...novoNivel, cor: cor.valor })}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${
                      novoNivel.cor === cor.valor ? 'border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: cor.valor }}
                    title={cor.nome}
                  />
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Estrelas Necessarias</label>
              <input
                type="number"
                value={novoNivel.estrelas_necessarias}
                onChange={(e) => setNovoNivel({ ...novoNivel, estrelas_necessarias: Number(e.target.value) })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
                min={0}
                max={20}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Meses Consecutivos</label>
              <input
                type="number"
                value={novoNivel.meses_consecutivos}
                onChange={(e) => setNovoNivel({ ...novoNivel, meses_consecutivos: Number(e.target.value) })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
                min={0}
                max={12}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Bonus Mensal (R$)</label>
              <input
                type="number"
                value={novoNivel.bonus_valor}
                onChange={(e) => setNovoNivel({ ...novoNivel, bonus_valor: Number(e.target.value) })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
                min={0}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Descricao</label>
              <input
                type="text"
                value={novoNivel.descricao}
                onChange={(e) => setNovoNivel({ ...novoNivel, descricao: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
                placeholder="Descricao opcional..."
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-6">
            <button
              onClick={() => setShowNovoNivel(false)}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveNivel}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
            >
              <Save className="w-4 h-4" />
              Salvar Nivel
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {niveis.map((nivel, idx) => (
          <div
            key={nivel.id}
            className="rounded-xl p-6 border-2 transition-all hover:shadow-lg"
            style={{
              backgroundColor: nivel.cor + '10',
              borderColor: nivel.cor + '50'
            }}
          >
            {editingNivel?.id === nivel.id ? (
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <input
                    type="text"
                    value={editingNivel.nome}
                    onChange={(e) => setEditingNivel({ ...editingNivel, nome: e.target.value })}
                    className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                    placeholder="Nome"
                  />
                  <input
                    type="number"
                    value={editingNivel.estrelas_necessarias}
                    onChange={(e) => setEditingNivel({ ...editingNivel, estrelas_necessarias: Number(e.target.value) })}
                    className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                    placeholder="Estrelas"
                  />
                  <input
                    type="number"
                    value={editingNivel.meses_consecutivos}
                    onChange={(e) => setEditingNivel({ ...editingNivel, meses_consecutivos: Number(e.target.value) })}
                    className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                    placeholder="Meses"
                  />
                  <input
                    type="number"
                    value={editingNivel.bonus_valor}
                    onChange={(e) => setEditingNivel({ ...editingNivel, bonus_valor: Number(e.target.value) })}
                    className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                    placeholder="Bonus R$"
                  />
                  <input
                    type="text"
                    value={editingNivel.descricao || ''}
                    onChange={(e) => setEditingNivel({ ...editingNivel, descricao: e.target.value })}
                    className="bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                    placeholder="Descricao"
                  />
                  <div className="flex gap-2 flex-wrap items-center">
                    {cores.map((cor) => (
                      <button
                        key={cor.valor}
                        onClick={() => setEditingNivel({ ...editingNivel, cor: cor.valor })}
                        className={`w-6 h-6 rounded-full border-2 ${
                          editingNivel.cor === cor.valor ? 'border-white' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: cor.valor }}
                      />
                    ))}
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => setEditingNivel(null)}
                    className="px-3 py-1.5 bg-gray-700 text-white rounded text-sm"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <button
                    onClick={handleUpdateNivel}
                    className="px-3 py-1.5 bg-cyan-600 text-white rounded text-sm"
                  >
                    <Save className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-6">
                  <div
                    className="w-16 h-16 rounded-full flex items-center justify-center text-2xl font-bold"
                    style={{ backgroundColor: nivel.cor + '30', color: nivel.cor }}
                  >
                    {nivel.ordem}
                  </div>
                  <div>
                    <h3 className="text-2xl font-bold" style={{ color: nivel.cor }}>
                      {nivel.nome}
                    </h3>
                    <p className="text-gray-400 text-sm">{nivel.descricao}</p>
                    <div className="flex items-center gap-4 mt-2">
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 text-yellow-400" />
                        <span className="text-gray-300 text-sm">
                          {nivel.estrelas_necessarias} estrelas
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <TrendingUp className="w-4 h-4 text-cyan-400" />
                        <span className="text-gray-300 text-sm">
                          {nivel.meses_consecutivos} meses
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <div className="text-gray-400 text-sm">Bonus Mensal</div>
                    <div className="text-2xl font-bold text-green-400">
                      R$ {nivel.bonus_valor?.toLocaleString('pt-BR') || 0}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => handleMoveNivel(nivel.id, 'up')}
                      disabled={idx === 0}
                      className="p-1 text-gray-400 hover:text-white disabled:opacity-30"
                    >
                      <TrendingUp className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleMoveNivel(nivel.id, 'down')}
                      disabled={idx === niveis.length - 1}
                      className="p-1 text-gray-400 hover:text-white disabled:opacity-30 rotate-180"
                    >
                      <TrendingUp className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setEditingNivel(nivel)}
                      className="p-2 text-gray-400 hover:text-cyan-400 transition-colors"
                    >
                      <Pencil className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDeleteNivel(nivel.id)}
                      className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {niveis.length === 0 && (
        <div className="text-center py-12">
          <Award className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Nenhum nivel cadastrado</p>
          <p className="text-gray-500 text-sm">Clique em "Novo Nivel" para comecar</p>
        </div>
      )}
    </div>
  );
}
