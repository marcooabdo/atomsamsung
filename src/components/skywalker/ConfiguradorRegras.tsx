import { useState, useEffect } from 'react';
import { Settings, Star, Plus, Trash2, Save, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface Regra {
  id: string;
  chave: string;
  valor: number;
  descricao: string;
  categoria: string;
  ativo: boolean;
}

type Categoria = 'vendas' | 'reviews' | 'cultura' | 'os' | 'agendamentos' | 'pecas' | 'lp_ow';

const CATEGORIAS: Record<Categoria, { label: string; cor: string; icon: string }> = {
  vendas: { label: 'Vendas Store+ / Care+', cor: '#06B6D4', icon: '🛒' },
  reviews: { label: 'Reviews Google', cor: '#10B981', icon: '⭐' },
  cultura: { label: 'Cultura e Presenca', cor: '#EC4899', icon: '❤️' },
  os: { label: 'Ordens de Servico', cor: '#8B5CF6', icon: '📋' },
  agendamentos: { label: 'Agendamentos', cor: '#F59E0B', icon: '📅' },
  pecas: { label: 'Requisicoes de Pecas', cor: '#3B82F6', icon: '📦' },
  lp_ow: { label: 'Percentual LP/OW', cor: '#EF4444', icon: '📊' }
};

export function ConfiguradorRegras() {
  const { usuario } = useAuth();
  const [regras, setRegras] = useState<Regra[]>([]);
  const [editedValues, setEditedValues] = useState<Record<string, number>>({});
  const [novaRegra, setNovaRegra] = useState({
    categoria: 'vendas' as Categoria,
    chave: '',
    descricao: '',
    valor: 0,
    estrelas: 1
  });
  const [showAddRegra, setShowAddRegra] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);

  const loadRegras = async () => {
    const { data } = await supabase
      .from('skywalker_regras')
      .select('*')
      .eq('ativo', true)
      .order('chave');

    if (data) {
      const regrasComCategoria = data.map(r => ({
        ...r,
        categoria: r.chave.split('_')[0]
      }));
      setRegras(regrasComCategoria);
    }
  };

  useEffect(() => {
    loadRegras();
  }, []);

  const handleSave = async (id: string) => {
    const valor = editedValues[id];
    if (valor === undefined) return;

    setSaving(id);
    await supabase
      .from('skywalker_regras')
      .update({ valor })
      .eq('id', id);

    await loadRegras();
    setEditedValues(prev => {
      const newValues = { ...prev };
      delete newValues[id];
      return newValues;
    });
    setSaving(null);
  };

  const handleAddRegra = async () => {
    if (!novaRegra.chave || !usuario?.unidade_id) return;

    const chave = `${novaRegra.categoria}_${novaRegra.chave.toLowerCase().replace(/\s+/g, '_')}_${novaRegra.estrelas}_estrela${novaRegra.estrelas > 1 ? 's' : ''}`;

    await supabase
      .from('skywalker_regras')
      .insert({
        unidade_id: usuario.unidade_id,
        chave,
        valor: novaRegra.valor,
        descricao: novaRegra.descricao || `${novaRegra.chave} - ${novaRegra.estrelas} estrela(s)`,
        ativo: true
      });

    await loadRegras();
    setNovaRegra({
      categoria: 'vendas',
      chave: '',
      descricao: '',
      valor: 0,
      estrelas: 1
    });
    setShowAddRegra(false);
  };

  const handleDeleteRegra = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta regra?')) return;

    await supabase
      .from('skywalker_regras')
      .update({ ativo: false })
      .eq('id', id);

    await loadRegras();
  };

  const getRegrasPorCategoria = (cat: Categoria) => {
    return regras.filter(r => r.categoria === cat);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-gray-500/20 to-slate-500/20 rounded-xl border border-gray-500/30">
            <Settings className="w-6 h-6 text-gray-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Configurador de Regras</h2>
            <p className="text-gray-400 text-sm">Configure quantas estrelas cada metrica vale</p>
          </div>
        </div>

        <button
          onClick={() => setShowAddRegra(true)}
          className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-lg hover:from-cyan-600 hover:to-blue-600 transition-all flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nova Regra
        </button>
      </div>

      {showAddRegra && (
        <div className="p-6 bg-gray-900 border border-cyan-500/50 rounded-xl">
          <h3 className="text-white font-bold mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-cyan-400" />
            Criar Nova Regra
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <select
              value={novaRegra.categoria}
              onChange={(e) => setNovaRegra(prev => ({ ...prev, categoria: e.target.value as Categoria }))}
              className="px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            >
              {Object.entries(CATEGORIAS).map(([key, config]) => (
                <option key={key} value={key}>{config.icon} {config.label}</option>
              ))}
            </select>

            <input
              type="text"
              value={novaRegra.chave}
              onChange={(e) => setNovaRegra(prev => ({ ...prev, chave: e.target.value }))}
              placeholder="Nome da regra"
              className="px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />

            <input
              type="number"
              value={novaRegra.valor}
              onChange={(e) => setNovaRegra(prev => ({ ...prev, valor: parseFloat(e.target.value) }))}
              placeholder="Valor necessario"
              className="px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
            />

            <select
              value={novaRegra.estrelas}
              onChange={(e) => setNovaRegra(prev => ({ ...prev, estrelas: parseInt(e.target.value) }))}
              className="px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
            >
              <option value={1}>1 Estrela</option>
              <option value={2}>2 Estrelas</option>
              <option value={3}>3 Estrelas</option>
              <option value={5}>5 Estrelas</option>
            </select>

            <div className="flex gap-2">
              <button
                onClick={handleAddRegra}
                disabled={!novaRegra.chave || !novaRegra.valor}
                className="flex-1 px-4 py-3 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 font-medium hover:bg-green-500/30 disabled:opacity-50 transition-colors"
              >
                Criar
              </button>
              <button
                onClick={() => setShowAddRegra(false)}
                className="px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-gray-400 hover:bg-gray-600 transition-colors"
              >
                Cancelar
              </button>
            </div>
          </div>

          <input
            type="text"
            value={novaRegra.descricao}
            onChange={(e) => setNovaRegra(prev => ({ ...prev, descricao: e.target.value }))}
            placeholder="Descricao (opcional)"
            className="mt-4 w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500"
          />
        </div>
      )}

      <div className="grid grid-cols-1 gap-6">
        {Object.entries(CATEGORIAS).map(([catKey, catConfig]) => {
          const regrasCategoria = getRegrasPorCategoria(catKey as Categoria);
          if (regrasCategoria.length === 0) return null;

          return (
            <div key={catKey} className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
              <h3
                className="text-lg font-bold text-white mb-4 flex items-center gap-2"
                style={{ color: catConfig.cor }}
              >
                <span className="text-2xl">{catConfig.icon}</span>
                {catConfig.label}
              </h3>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                {regrasCategoria.map(regra => {
                  const currentValue = editedValues[regra.id] ?? regra.valor;
                  const hasChanges = editedValues[regra.id] !== undefined;

                  const estrelas = regra.chave.match(/(\d+)_estrela/)?.[1] || '1';

                  return (
                    <div
                      key={regra.id}
                      className="flex items-center gap-3 p-4 bg-gray-800/50 border border-gray-700 rounded-lg hover:border-cyan-500/30 transition-all"
                    >
                      <div className="flex items-center gap-2">
                        {Array.from({ length: parseInt(estrelas) }).map((_, i) => (
                          <Star key={i} className="w-4 h-4 text-yellow-400" fill="#facc15" />
                        ))}
                      </div>

                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{regra.descricao}</p>
                        <p className="text-gray-500 text-xs">{regra.chave}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={currentValue}
                          onChange={(e) => setEditedValues(prev => ({ ...prev, [regra.id]: parseFloat(e.target.value) }))}
                          className="w-20 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-center text-sm focus:outline-none focus:border-cyan-500"
                          step="1"
                        />

                        {hasChanges && (
                          <button
                            onClick={() => handleSave(regra.id)}
                            disabled={saving === regra.id}
                            className="p-2 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 hover:bg-green-500/30 transition-colors"
                          >
                            {saving === regra.id ? (
                              <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                            ) : (
                              <Check className="w-4 h-4" />
                            )}
                          </button>
                        )}

                        <button
                          onClick={() => handleDeleteRegra(regra.id)}
                          className="p-2 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 hover:bg-red-500/30 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-xl">
        <div className="flex items-start gap-3">
          <Star className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-cyan-400 font-medium mb-2">Como funciona?</p>
            <ul className="text-cyan-300/70 text-sm space-y-1">
              <li>• Cada regra define <strong>quantas estrelas</strong> o colaborador ganha ao atingir o valor especificado</li>
              <li>• Exemplo: &quot;10 vendas Store+ = 2 estrelas&quot; significa que ao atingir 10 vendas, o colaborador ganha 2★</li>
              <li>• As estrelas sao calculadas automaticamente com base nos dados reais do sistema</li>
              <li>• Voce pode criar multiplas regras por categoria com valores diferentes</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
