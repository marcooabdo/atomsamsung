import { useState, useEffect } from 'react';
import { Clock, Plus, Trash2, Save, AlertTriangle } from 'lucide-react';
import { useOtimizador } from '../../contexts/OtimizadorContext';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface TempoReparo {
  id?: string;
  tipo_reparo: string;
  tempo_minutos: number;
  ativo: boolean;
}

const TIPOS_REPARO_SUGERIDOS = [
  'Troca de painel',
  'Troca de placa',
  'Troca de compressor',
  'Troca de Open Cell',
  'Troca de peca (simples)',
  'Troca de peça (simples)',
  'Troca de serpentina',
  'Instalação Inicial',
  'Visita Técnica',
  'Coleta',
  'Coleta/Entrega',
  'Borracha',
];

export default function ConfiguracaoTemposReparo() {
  const { selectedUnidade } = useOtimizador();
  const { usuario } = useAuth();
  const [tempos, setTempos] = useState<TempoReparo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [novoTipo, setNovoTipo] = useState('');
  const [novoTempo, setNovoTempo] = useState(60);
  const [showSugestoes, setShowSugestoes] = useState(false);
  const [tiposNoBanco, setTiposNoBanco] = useState<string[]>([]);

  const canEdit = usuario?.tipo === 'master' || usuario?.tipo === 'gerente' || usuario?.tipo === 'administrador';

  useEffect(() => {
    if (selectedUnidade) {
      loadTempos();
      loadTiposUsados();
    }
  }, [selectedUnidade]);

  const loadTempos = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('gia_tempos_reparo')
        .select('*')
        .eq('unidade_id', selectedUnidade)
        .order('tipo_reparo');

      if (error) throw error;
      setTempos(data || []);
    } catch {
      setTempos([]);
    } finally {
      setLoading(false);
    }
  };

  const loadTiposUsados = async () => {
    try {
      const { data, error } = await supabase
        .from('os')
        .select('tipo_reparo')
        .eq('unidade_id', selectedUnidade!)
        .not('tipo_reparo', 'is', null)
        .not('tipo_reparo', 'eq', '');

      if (error) throw error;
      const tipos = [...new Set((data || []).map(d => d.tipo_reparo).filter(Boolean))];
      setTiposNoBanco(tipos);
    } catch {
      setTiposNoBanco([]);
    }
  };

  const handleAdd = async () => {
    if (!novoTipo.trim() || !selectedUnidade) return;

    const exists = tempos.some(t => t.tipo_reparo.toLowerCase() === novoTipo.trim().toLowerCase());
    if (exists) {
      alert('Este tipo de reparo já está cadastrado.');
      return;
    }

    try {
      const { data, error } = await supabase
        .from('gia_tempos_reparo')
        .insert({
          tipo_reparo: novoTipo.trim(),
          tempo_minutos: novoTempo,
          unidade_id: selectedUnidade,
          ativo: true,
        })
        .select()
        .single();

      if (error) throw error;
      setTempos([...tempos, data]);
      setNovoTipo('');
      setNovoTempo(60);
      setShowSugestoes(false);
    } catch {
      alert('Erro ao adicionar. Verifique se o tipo já não existe.');
    }
  };

  const handleUpdate = async (id: string, campo: string, valor: any) => {
    const updated = tempos.map(t => t.id === id ? { ...t, [campo]: valor } : t);
    setTempos(updated);
  };

  const handleSaveAll = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      for (const tempo of tempos) {
        if (!tempo.id) continue;
        const { error } = await supabase
          .from('gia_tempos_reparo')
          .update({
            tempo_minutos: tempo.tempo_minutos,
            ativo: tempo.ativo,
            updated_at: new Date().toISOString(),
          })
          .eq('id', tempo.id);
        if (error) throw error;
      }
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      alert('Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este tipo de reparo da configuração?')) return;
    try {
      const { error } = await supabase
        .from('gia_tempos_reparo')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setTempos(tempos.filter(t => t.id !== id));
    } catch {
      alert('Erro ao remover.');
    }
  };

  const tiposSemTempo = tiposNoBanco.filter(
    tipo => !tempos.some(t => t.tipo_reparo.toLowerCase() === tipo.toLowerCase())
  );

  const sugestoesDisponiveis = TIPOS_REPARO_SUGERIDOS.filter(
    tipo => !tempos.some(t => t.tipo_reparo.toLowerCase() === tipo.toLowerCase())
  );

  if (!selectedUnidade) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-400">
        Selecione uma unidade para configurar os tempos de reparo.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {tiposSemTempo.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-400 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-amber-300 font-medium text-sm">
                Tipos de reparo sem tempo cadastrado
              </p>
              <p className="text-amber-400/70 text-xs mt-1">
                A GIA não conseguirá montar rotas com OS que tenham esses tipos. Cadastre o tempo para cada um:
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {tiposSemTempo.map(tipo => (
                  <button
                    key={tipo}
                    onClick={() => { setNovoTipo(tipo); setShowSugestoes(false); }}
                    className="px-3 py-1 text-xs rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-colors"
                  >
                    + {tipo}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Clock className="w-6 h-6 text-cyan-400" />
            <div>
              <h3 className="text-xl font-bold text-white">Tempos por Tipo de Reparo</h3>
              <p className="text-gray-400 text-sm mt-0.5">
                Defina o tempo médio estimado para cada tipo de reparo. A GIA usará esses valores para calcular a duração das rotas.
              </p>
            </div>
          </div>
          {canEdit && tempos.length > 0 && (
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 rounded-lg text-white text-sm font-medium transition-all disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : saveSuccess ? 'Salvo!' : 'Salvar Alterações'}
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-center py-8 text-gray-400">Carregando...</div>
        ) : (
          <>
            {tempos.length === 0 ? (
              <div className="text-center py-8">
                <Clock className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                <p className="text-gray-400">Nenhum tempo cadastrado ainda.</p>
                <p className="text-gray-500 text-sm mt-1">Adicione os tipos de reparo abaixo para que a GIA possa calcular rotas.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-[1fr_120px_80px_40px] gap-3 px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <span>Tipo de Reparo</span>
                  <span>Tempo (min)</span>
                  <span>Ativo</span>
                  <span></span>
                </div>
                {tempos.map(tempo => (
                  <div
                    key={tempo.id}
                    className={`grid grid-cols-[1fr_120px_80px_40px] gap-3 items-center px-3 py-3 rounded-lg border transition-all ${
                      tempo.ativo
                        ? 'bg-gray-700/30 border-gray-600/50'
                        : 'bg-gray-800/30 border-gray-700/30 opacity-60'
                    }`}
                  >
                    <span className="text-white font-medium text-sm">{tempo.tipo_reparo}</span>
                    <input
                      type="number"
                      value={tempo.tempo_minutos}
                      onChange={(e) => handleUpdate(tempo.id!, 'tempo_minutos', Math.max(1, Number(e.target.value)))}
                      disabled={!canEdit}
                      className="w-full px-3 py-1.5 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500 disabled:opacity-50"
                      min="1"
                    />
                    <label className="flex items-center justify-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tempo.ativo}
                        onChange={(e) => handleUpdate(tempo.id!, 'ativo', e.target.checked)}
                        disabled={!canEdit}
                        className="w-4 h-4 rounded border-gray-600 text-cyan-500 focus:ring-cyan-500 focus:ring-offset-0 disabled:opacity-50"
                      />
                    </label>
                    {canEdit && (
                      <button
                        onClick={() => handleDelete(tempo.id!)}
                        className="p-1 text-gray-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {canEdit && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Plus className="w-5 h-5 text-green-400" />
            <h4 className="text-lg font-semibold text-white">Adicionar Tipo de Reparo</h4>
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1 relative">
              <label className="text-gray-400 text-sm mb-2 block">Tipo de Reparo</label>
              <input
                type="text"
                value={novoTipo}
                onChange={(e) => setNovoTipo(e.target.value)}
                onFocus={() => setShowSugestoes(true)}
                placeholder="Ex: Troca de painel"
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
              />
              {showSugestoes && sugestoesDisponiveis.length > 0 && (
                <div className="absolute z-10 top-full mt-1 left-0 right-0 bg-gray-800 border border-gray-600 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                  {sugestoesDisponiveis.map(sug => (
                    <button
                      key={sug}
                      onClick={() => { setNovoTipo(sug); setShowSugestoes(false); }}
                      className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="w-32">
              <label className="text-gray-400 text-sm mb-2 block">Tempo (min)</label>
              <input
                type="number"
                value={novoTempo}
                onChange={(e) => setNovoTempo(Math.max(1, Number(e.target.value)))}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500 transition-colors"
                min="1"
              />
            </div>
            <button
              onClick={handleAdd}
              disabled={!novoTipo.trim()}
              className="flex items-center gap-2 px-5 py-3 bg-green-600 hover:bg-green-700 rounded-lg text-white font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              Adicionar
            </button>
          </div>
        </div>
      )}

      {saveSuccess && (
        <div className="fixed bottom-8 right-8 bg-green-500 text-white px-6 py-4 rounded-lg shadow-lg z-50 animate-pulse">
          Tempos salvos com sucesso!
        </div>
      )}
    </div>
  );
}
