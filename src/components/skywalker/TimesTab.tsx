import { useState, useEffect } from 'react';
import { Users, Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Time {
  id: string;
  nome: string;
  codigo: string;
  descricao: string | null;
  cor: string;
  icone: string;
  ativo: boolean;
  ordem: number;
}

export function TimesTab() {
  const [times, setTimes] = useState<Time[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTime, setEditingTime] = useState<Time | null>(null);
  const [showNovoTime, setShowNovoTime] = useState(false);

  const [novoTime, setNovoTime] = useState({
    nome: '',
    codigo: '',
    descricao: '',
    cor: '#3B82F6',
    icone: 'Users'
  });

  const cores = [
    '#3B82F6', '#10B981', '#F59E0B', '#EF4444',
    '#8B5CF6', '#EC4899', '#06B6D4', '#84CC16'
  ];

  useEffect(() => {
    loadTimes();
  }, []);

  const loadTimes = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('skywalker_times')
      .select('*')
      .order('ordem');

    if (data) setTimes(data);
    setLoading(false);
  };

  const handleSaveTime = async () => {
    if (!novoTime.nome.trim() || !novoTime.codigo.trim()) return;

    const ordem = times.length + 1;
    const { error } = await supabase.from('skywalker_times').insert({
      ...novoTime,
      codigo: novoTime.codigo.toLowerCase().replace(/\s+/g, '_'),
      ordem,
      ativo: true
    });

    if (!error) {
      setShowNovoTime(false);
      setNovoTime({ nome: '', codigo: '', descricao: '', cor: '#3B82F6', icone: 'Users' });
      loadTimes();
    }
  };

  const handleUpdateTime = async () => {
    if (!editingTime) return;

    const { error } = await supabase
      .from('skywalker_times')
      .update({
        nome: editingTime.nome,
        descricao: editingTime.descricao,
        cor: editingTime.cor
      })
      .eq('id', editingTime.id);

    if (!error) {
      setEditingTime(null);
      loadTimes();
    }
  };

  const handleDeleteTime = async (id: string) => {
    if (!confirm('Excluir este time? Profissionais vinculados serao afetados.')) return;
    await supabase.from('skywalker_times').delete().eq('id', id);
    loadTimes();
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
          <Users className="w-6 h-6 text-cyan-400" />
          Tipos de Times
        </h2>
        <button
          onClick={() => setShowNovoTime(true)}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg hover:opacity-90"
        >
          <Plus className="w-4 h-4" />
          Novo Time
        </button>
      </div>

      {showNovoTime && (
        <div className="bg-gray-800/80 rounded-xl p-6 border border-cyan-500/50">
          <h4 className="text-lg font-bold text-white mb-4">Criar Novo Time</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nome</label>
              <input
                type="text"
                value={novoTime.nome}
                onChange={(e) => setNovoTime({ ...novoTime, nome: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
                placeholder="Ex: Front Office"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Codigo (identificador)</label>
              <input
                type="text"
                value={novoTime.codigo}
                onChange={(e) => setNovoTime({ ...novoTime, codigo: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
                placeholder="Ex: front_office"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-400 mb-1">Descricao</label>
              <textarea
                value={novoTime.descricao}
                onChange={(e) => setNovoTime({ ...novoTime, descricao: e.target.value })}
                className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
                rows={2}
                placeholder="Descricao do time..."
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Cor</label>
              <div className="flex gap-2">
                {cores.map((cor) => (
                  <button
                    key={cor}
                    onClick={() => setNovoTime({ ...novoTime, cor })}
                    className={`w-8 h-8 rounded-full border-2 ${
                      novoTime.cor === cor ? 'border-white' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: cor }}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <button
              onClick={() => setShowNovoTime(false)}
              className="px-4 py-2 bg-gray-700 text-white rounded-lg"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveTime}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-600 text-white rounded-lg"
            >
              <Save className="w-4 h-4" />
              Salvar
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {times.map((time) => (
          <div
            key={time.id}
            className="bg-gray-800/50 rounded-xl p-5 border-2 transition-all"
            style={{ borderColor: time.cor + '50' }}
          >
            {editingTime?.id === time.id ? (
              <div className="space-y-3">
                <input
                  type="text"
                  value={editingTime.nome}
                  onChange={(e) => setEditingTime({ ...editingTime, nome: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                />
                <textarea
                  value={editingTime.descricao || ''}
                  onChange={(e) => setEditingTime({ ...editingTime, descricao: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded px-3 py-2 text-white"
                  rows={2}
                />
                <div className="flex gap-2">
                  {cores.map((cor) => (
                    <button
                      key={cor}
                      onClick={() => setEditingTime({ ...editingTime, cor })}
                      className={`w-6 h-6 rounded-full border-2 ${
                        editingTime.cor === cor ? 'border-white' : 'border-transparent'
                      }`}
                      style={{ backgroundColor: cor }}
                    />
                  ))}
                </div>
                <div className="flex justify-end gap-2">
                  <button onClick={() => setEditingTime(null)} className="p-1.5 text-gray-400 hover:text-white">
                    <X className="w-4 h-4" />
                  </button>
                  <button onClick={handleUpdateTime} className="p-1.5 text-cyan-400 hover:text-cyan-300">
                    <Save className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: time.cor + '20' }}
                    >
                      <Users className="w-5 h-5" style={{ color: time.cor }} />
                    </div>
                    <div>
                      <h4 className="text-white font-bold">{time.nome}</h4>
                      <p className="text-gray-500 text-xs">{time.codigo}</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => setEditingTime(time)}
                      className="p-1.5 text-gray-400 hover:text-cyan-400"
                    >
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteTime(time.id)}
                      className="p-1.5 text-gray-400 hover:text-red-400"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <p className="text-gray-400 text-sm">{time.descricao || 'Sem descricao'}</p>
              </>
            )}
          </div>
        ))}
      </div>

      {times.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Nenhum time cadastrado</p>
        </div>
      )}
    </div>
  );
}
