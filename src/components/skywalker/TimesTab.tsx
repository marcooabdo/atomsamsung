import { useState } from 'react';
import { Users, Plus, Pencil, Trash2, Save, X } from 'lucide-react';
import { useSkywalker } from '../../contexts/SkywalkerContext';
import { supabase } from '../../lib/supabase';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

const CORES = [
  { nome: 'Blue', hex: '#3B82F6' }, { nome: 'Green', hex: '#10B981' },
  { nome: 'Yellow', hex: '#F59E0B' }, { nome: 'Red', hex: '#EF4444' },
  { nome: 'Cyan', hex: '#06B6D4' }, { nome: 'Orange', hex: '#F97316' },
  { nome: 'Teal', hex: '#14B8A6' }, { nome: 'Rose', hex: '#F43F5E' },
];

export function TimesTab() {
  const { times, profissionais, loadTimes } = useSkywalker();
  const [showNovo, setShowNovo] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: '', codigo: '', descricao: '', cor: '#3B82F6' });
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; id: string; nome: string }>({ show: false, id: '', nome: '' });

  const handleSave = async () => {
    if (!form.nome.trim() || (!editingId && !form.codigo.trim())) return;
    const maxOrdem = times.reduce((m, t) => Math.max(m, t.ordem), 0);
    if (editingId) {
      await supabase.from('skywalker_times').update({ nome: form.nome, descricao: form.descricao, cor: form.cor }).eq('id', editingId);
    } else {
      await supabase.from('skywalker_times').insert({ nome: form.nome, codigo: form.codigo.toLowerCase().replace(/\s+/g, '_'), descricao: form.descricao, cor: form.cor, ordem: maxOrdem + 1, ativo: true });
    }
    setShowNovo(false);
    setShowEditModal(false);
    setEditingId(null);
    setForm({ nome: '', codigo: '', descricao: '', cor: '#3B82F6' });
    loadTimes();
  };

  const handleEdit = (time: any) => {
    setForm({ nome: time.nome, codigo: time.codigo, descricao: time.descricao || '', cor: time.cor });
    setEditingId(time.id);
    setShowEditModal(true);
  };

  const handleDelete = async (id: string, nome: string) => {
    setDeleteConfirm({ show: true, id, nome });
  };

  const confirmDelete = async () => {
    await supabase.from('skywalker_times').update({ ativo: false }).eq('id', deleteConfirm.id);
    loadTimes();
  };

  const getMemberCount = (timeId: string) => {
    return profissionais.filter(p => p.time_id === timeId).length;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Users className="w-5 h-5" style={{ color: 'var(--text-accent)' }} />
          Times ({times.length})
        </h2>
        <button
          onClick={() => { setShowNovo(true); setEditingId(null); setForm({ nome: '', codigo: '', descricao: '', cor: '#3B82F6' }); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm"
          style={{ backgroundColor: 'var(--text-accent)', color: 'var(--text-on-accent)' }}
        >
          <Plus className="w-4 h-4" />
          Novo Time
        </button>
      </div>

      {showNovo && !editingId && (
        <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-accent)' }}>
          <h4 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Criar Time</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Nome</label>
              <input type="text" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} placeholder="Ex: Front Office" />
            </div>
            {!editingId && (
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Código (identificador)</label>
                <input type="text" value={form.codigo} onChange={(e) => setForm({ ...form, codigo: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} placeholder="Ex: front_office" />
              </div>
            )}
            <div className={editingId ? '' : 'md:col-span-2'}>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Descricao</label>
              <textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} rows={2} placeholder="Descrição do time..." />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Cor</label>
              <div className="flex flex-wrap gap-1.5">
                {CORES.map(c => (
                  <button key={c.hex} onClick={() => setForm({ ...form, cor: c.hex })} className="w-7 h-7 rounded-full border-2 transition-all" style={{ backgroundColor: c.hex, borderColor: form.cor === c.hex ? 'white' : 'transparent', transform: form.cor === c.hex ? 'scale(1.2)' : 'scale(1)' }} title={c.nome} />
                ))}
              </div>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => { setShowNovo(false); setEditingId(null); }} className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>Cancelar</button>
            <button onClick={handleSave} className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: 'var(--text-accent)', color: 'var(--text-on-accent)' }}>
              <Save className="w-4 h-4" />
              Salvar
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {times.map((time) => {
          const memberCount = getMemberCount(time.id);
          return (
            <div key={time.id} className="rounded-xl p-5 transition-all" style={{ backgroundColor: 'var(--bg-card)', border: `2px solid ${time.cor}30` }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: time.cor + '20' }}>
                    <Users className="w-5 h-5" style={{ color: time.cor }} />
                  </div>
                  <div>
                    <h4 className="font-bold" style={{ color: time.cor }}>{time.nome}</h4>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{time.codigo}</p>
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => handleEdit(time)} className="p-1.5 rounded" style={{ color: 'var(--text-secondary)' }}>
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDelete(time.id, time.nome)} className="p-1.5 rounded" style={{ color: 'var(--text-secondary)' }}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <p className="text-sm mb-3" style={{ color: 'var(--text-secondary)' }}>{time.descricao || 'Sem descricao'}</p>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-1 rounded-full font-medium" style={{ backgroundColor: time.cor + '15', color: time.cor }}>
                  {memberCount} membro{memberCount !== 1 ? 's' : ''}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {times.length === 0 && (
        <div className="text-center py-16">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: 'var(--text-secondary)' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Nenhum time cadastrado</p>
        </div>
      )}

      {showEditModal && editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-2xl rounded-xl p-6" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-accent)' }}>
            <h4 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Pencil className="w-5 h-5" style={{ color: 'var(--text-accent)' }} />
              Editar Time
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Nome</label>
                <input type="text" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} placeholder="Ex: Front Office" />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Código (somente leitura)</label>
                <input type="text" value={form.codigo} disabled className="w-full rounded-lg px-3 py-2 text-sm opacity-60" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Descricao</label>
                <textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} rows={2} placeholder="Descrição do time..." />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Cor</label>
                <div className="flex flex-wrap gap-1.5">
                  {CORES.map(c => (
                    <button key={c.hex} onClick={() => setForm({ ...form, cor: c.hex })} className="w-7 h-7 rounded-full border-2 transition-all" style={{ backgroundColor: c.hex, borderColor: form.cor === c.hex ? 'white' : 'transparent', transform: form.cor === c.hex ? 'scale(1.2)' : 'scale(1)' }} title={c.nome} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => { setShowEditModal(false); setEditingId(null); }} className="px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>Cancelar</button>
              <button onClick={handleSave} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: 'var(--text-accent)', color: 'var(--text-on-accent)' }}>
                <Save className="w-4 h-4" />
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, id: '', nome: '' })}
        onConfirm={confirmDelete}
        title="Excluir Time"
        message={`Tem certeza que deseja excluir o time "${deleteConfirm.nome}"? Profissionais vinculados a este time poderão ser afetados. Esta ação não pode ser desfeita.`}
      />
    </div>
  );
}
