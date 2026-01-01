import { useState } from 'react';
import { Settings, Save, Star, ShoppingCart, MessageSquare, Heart, Trophy, DollarSign, AlertCircle, Check, Plus, UserPlus, User } from 'lucide-react';
import { useSkywalker } from '../../contexts/SkywalkerContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { NIVEIS_CONFIG } from './types';

export function RegrasJogo() {
  const { usuario } = useAuth();
  const { regras, updateRegra, colaboradores, loadColaboradores, refreshAll } = useSkywalker();
  const [editedValues, setEditedValues] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [showAddColaborador, setShowAddColaborador] = useState(false);
  const [newColaborador, setNewColaborador] = useState({ usuario_id: '', perfil: 'front_office' as const });
  const [usuarios, setUsuarios] = useState<Array<{ id: string; nome: string }>>([]);
  const [addingColaborador, setAddingColaborador] = useState(false);

  const handleValueChange = (id: string, valor: number) => {
    setEditedValues(prev => ({ ...prev, [id]: valor }));
  };

  const handleSave = async (id: string) => {
    const valor = editedValues[id];
    if (valor === undefined) return;

    setSaving(id);
    await updateRegra(id, valor);
    setEditedValues(prev => {
      const newValues = { ...prev };
      delete newValues[id];
      return newValues;
    });
    setSaving(null);
  };

  const loadUsuarios = async () => {
    const { data } = await supabase
      .from('usuarios')
      .select('id, nome')
      .eq('ativo', true)
      .order('nome');

    if (data) {
      const existingIds = colaboradores.map(c => c.usuario_id);
      setUsuarios(data.filter(u => !existingIds.includes(u.id)));
    }
  };

  const handleAddColaborador = async () => {
    if (!newColaborador.usuario_id || !usuario?.unidade_id) return;

    setAddingColaborador(true);
    const { error } = await supabase
      .from('skywalker_colaboradores')
      .insert({
        usuario_id: newColaborador.usuario_id,
        unidade_id: usuario.unidade_id,
        perfil: newColaborador.perfil,
        nivel: 'starter'
      });

    if (!error) {
      await loadColaboradores();
      setNewColaborador({ usuario_id: '', perfil: 'front_office' });
      setShowAddColaborador(false);
    }
    setAddingColaborador(false);
  };

  const getRegrasByCategory = (prefix: string) => {
    return regras.filter(r => r.chave.startsWith(prefix));
  };

  const regrasVendas = getRegrasByCategory('vendas_');
  const regrasReviews = getRegrasByCategory('reviews_');
  const regrasMetas = getRegrasByCategory('meta_');
  const regrasMeses = getRegrasByCategory('meses_');
  const regrasBonus = getRegrasByCategory('bonus_');

  const RegraInput = ({ regra }: { regra: typeof regras[0] }) => {
    const currentValue = editedValues[regra.id] ?? regra.valor;
    const hasChanges = editedValues[regra.id] !== undefined;

    return (
      <div className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
        <div className="flex-1">
          <p className="text-white text-sm font-medium">{regra.descricao || regra.chave}</p>
          <p className="text-gray-500 text-xs">{regra.chave}</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="number"
            value={currentValue}
            onChange={(e) => handleValueChange(regra.id, parseFloat(e.target.value))}
            className="w-24 px-3 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white text-center focus:outline-none focus:border-cyan-500"
            step={regra.chave.includes('bonus') ? '0.5' : '1'}
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
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-gradient-to-br from-gray-500/20 to-slate-500/20 rounded-xl border border-gray-500/30">
            <Settings className="w-6 h-6 text-gray-400" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Regras do Jogo</h2>
            <p className="text-gray-400 text-sm">Configure os criterios de gamificacao</p>
          </div>
        </div>
      </div>

      <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-xl flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-yellow-400 font-medium">Importante</p>
          <p className="text-yellow-300/70 text-sm">
            Alteracoes nas regras afetam o calculo de estrelas em tempo real para todos os colaboradores.
          </p>
        </div>
      </div>

      <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <UserPlus className="w-5 h-5 text-cyan-400" />
            Colaboradores Cadastrados
          </h3>
          <button
            onClick={() => {
              loadUsuarios();
              setShowAddColaborador(true);
            }}
            className="px-4 py-2 bg-cyan-500/20 border border-cyan-500/50 rounded-lg text-cyan-400 text-sm font-medium hover:bg-cyan-500/30 transition-colors flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Adicionar
          </button>
        </div>

        {showAddColaborador && (
          <div className="mb-4 p-4 bg-gray-800/50 border border-gray-600 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <select
                value={newColaborador.usuario_id}
                onChange={(e) => setNewColaborador(prev => ({ ...prev, usuario_id: e.target.value }))}
                className="px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="">Selecione o usuario</option>
                {usuarios.map(u => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
              <select
                value={newColaborador.perfil}
                onChange={(e) => setNewColaborador(prev => ({ ...prev, perfil: e.target.value as 'front_office' | 'inside_sales' }))}
                className="px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="front_office">Front Office</option>
                <option value="inside_sales">Inside Sales</option>
              </select>
              <div className="flex gap-2">
                <button
                  onClick={handleAddColaborador}
                  disabled={!newColaborador.usuario_id || addingColaborador}
                  className="flex-1 px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 font-medium hover:bg-green-500/30 disabled:opacity-50 transition-colors"
                >
                  {addingColaborador ? 'Salvando...' : 'Confirmar'}
                </button>
                <button
                  onClick={() => setShowAddColaborador(false)}
                  className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-400 hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {colaboradores.map(colab => {
            const nivelConfig = NIVEIS_CONFIG[colab.nivel];
            return (
              <div key={colab.id} className="p-3 bg-gray-800/50 border border-gray-700 rounded-lg flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center">
                  <User className="w-5 h-5 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-white font-medium truncate">{colab.usuario?.nome}</p>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">
                      {colab.perfil === 'front_office' ? 'Front Office' : 'Inside Sales'}
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded text-xs font-medium"
                      style={{ backgroundColor: `${nivelConfig.cor}20`, color: nivelConfig.cor }}
                    >
                      {nivelConfig.label}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <ShoppingCart className="w-5 h-5 text-cyan-400" />
            Regras de Vendas
          </h3>
          <div className="space-y-3">
            {regrasVendas.map(regra => (
              <RegraInput key={regra.id} regra={regra} />
            ))}
          </div>
        </div>

        <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-green-400" />
            Regras de Reviews
          </h3>
          <div className="space-y-3">
            {regrasReviews.map(regra => (
              <RegraInput key={regra.id} regra={regra} />
            ))}
          </div>
        </div>

        <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-400" />
            Metas de Estrelas por Nivel
          </h3>
          <div className="space-y-3">
            {regrasMetas.map(regra => (
              <RegraInput key={regra.id} regra={regra} />
            ))}
          </div>
        </div>

        <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Star className="w-5 h-5 text-orange-400" />
            Meses para Promocao
          </h3>
          <div className="space-y-3">
            {regrasMeses.map(regra => (
              <RegraInput key={regra.id} regra={regra} />
            ))}
          </div>
        </div>

        <div className="lg:col-span-2 bg-gray-900/50 border border-gray-700 rounded-xl p-6">
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <DollarSign className="w-5 h-5 text-green-400" />
            Bonus de Comissao (%)
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {regrasBonus.map(regra => (
              <RegraInput key={regra.id} regra={regra} />
            ))}
          </div>
        </div>
      </div>

      <div className="bg-gray-900/50 border border-gray-700 rounded-xl p-6">
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Heart className="w-5 h-5 text-pink-400" />
          Regras de Cultura (Trava de Crescimento)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
            <p className="text-white font-medium mb-2">0 Estrelas (Faltas/Atrasos)</p>
            <p className="text-gray-400 text-sm">Colaborador nao compareceu ou teve atrasos significativos.</p>
            <p className="text-red-400 text-xs mt-2">TRAVA: Nao pode subir de nivel</p>
          </div>
          <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
            <p className="text-white font-medium mb-2">1 Estrela (Sem Faltas)</p>
            <p className="text-gray-400 text-sm">Presenca em reunioes e sem atrasos no mes.</p>
          </div>
          <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
            <p className="text-white font-medium mb-2">2 Estrelas (Proativo)</p>
            <p className="text-gray-400 text-sm">Sem faltas + comportamento proativo identificado.</p>
          </div>
          <div className="p-4 bg-gray-800/50 border border-gray-700 rounded-lg">
            <p className="text-white font-medium mb-2">3 Estrelas (Exemplar)</p>
            <p className="text-gray-400 text-sm">Colaborador destaque em cultura e engajamento.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
