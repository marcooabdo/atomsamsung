import { useState, useEffect } from 'react';
import { Award, Plus, Pencil, Trash2, Star, Save, X, ChevronUp, ChevronDown } from 'lucide-react';
import { useSkywalker, type Nivel } from '../../contexts/SkywalkerContext';
import { supabase } from '../../lib/supabase';

const CORES = [
  { nome: 'Blue', hex: '#3B82F6' }, { nome: 'Green', hex: '#10B981' },
  { nome: 'Yellow', hex: '#F59E0B' }, { nome: 'Red', hex: '#EF4444' },
  { nome: 'Cyan', hex: '#06B6D4' }, { nome: 'Orange', hex: '#F97316' },
  { nome: 'Teal', hex: '#14B8A6' }, { nome: 'Rose', hex: '#F43F5E' },
  { nome: 'Gold', hex: '#D4A017' }, { nome: 'Bronze', hex: '#CD7F32' },
  { nome: 'Platinum', hex: '#A0AEC0' }, { nome: 'Diamond', hex: '#60A5FA' },
];

export function NiveisBonusTab() {
  const { niveis, loadNiveis } = useSkywalker();
  const [showNovo, setShowNovo] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nome: '', cor: '#3B82F6', estrelas_necessarias: 6, meses_consecutivos: 2, bonus_valor: 0, descricao: '' });

  const handleSave = async () => {
    if (!form.nome) return;
    const maxOrdem = niveis.reduce((m, n) => Math.max(m, n.ordem), 0);
    if (editingId) {
      await supabase.from('skywalker_niveis').update({ nome: form.nome, cor: form.cor, estrelas_necessarias: form.estrelas_necessarias, meses_consecutivos: form.meses_consecutivos, bonus_valor: form.bonus_valor, descricao: form.descricao }).eq('id', editingId);
    } else {
      await supabase.from('skywalker_niveis').insert({ ...form, ordem: maxOrdem + 1, ativo: true });
    }
    setShowNovo(false);
    setEditingId(null);
    setForm({ nome: '', cor: '#3B82F6', estrelas_necessarias: 6, meses_consecutivos: 2, bonus_valor: 0, descricao: '' });
    loadNiveis();
  };

  const handleEdit = (nivel: Nivel) => {
    setForm({ nome: nivel.nome, cor: nivel.cor, estrelas_necessarias: nivel.estrelas_necessarias, meses_consecutivos: nivel.meses_consecutivos, bonus_valor: nivel.bonus_valor || 0, descricao: nivel.descricao || '' });
    setEditingId(nivel.id);
    setShowNovo(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este nivel?')) return;
    await supabase.from('skywalker_niveis').update({ ativo: false }).eq('id', id);
    loadNiveis();
  };

  const handleMove = async (id: string, direction: 'up' | 'down') => {
    const idx = niveis.findIndex(n => n.id === id);
    if (idx < 0) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= niveis.length) return;
    await Promise.all([
      supabase.from('skywalker_niveis').update({ ordem: niveis[swapIdx].ordem }).eq('id', niveis[idx].id),
      supabase.from('skywalker_niveis').update({ ordem: niveis[idx].ordem }).eq('id', niveis[swapIdx].id),
    ]);
    loadNiveis();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Award className="w-5 h-5" style={{ color: '#FBBF24' }} />
          Niveis e Bonus ({niveis.length})
        </h2>
        <button onClick={() => { setShowNovo(true); setEditingId(null); setForm({ nome: '', cor: '#3B82F6', estrelas_necessarias: 6, meses_consecutivos: 2, bonus_valor: 0, descricao: '' }); }} className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm" style={{ backgroundColor: 'var(--text-accent)', color: 'var(--text-on-accent)' }}>
          <Plus className="w-4 h-4" />
          Novo Nivel
        </button>
      </div>

      {showNovo && (
        <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-accent)' }}>
          <h4 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>{editingId ? 'Editar Nivel' : 'Criar Nivel'}</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Nome</label>
              <input type="text" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} placeholder="Ex: Starter" />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Cor</label>
              <div className="flex flex-wrap gap-1.5">
                {CORES.map(c => (
                  <button key={c.hex} onClick={() => setForm({ ...form, cor: c.hex })} className="w-7 h-7 rounded-full border-2 transition-all" style={{ backgroundColor: c.hex, borderColor: form.cor === c.hex ? 'white' : 'transparent', transform: form.cor === c.hex ? 'scale(1.2)' : 'scale(1)' }} title={c.nome} />
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Descricao</label>
              <input type="text" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Estrelas Necessarias</label>
              <input type="number" value={form.estrelas_necessarias} onChange={(e) => setForm({ ...form, estrelas_necessarias: Number(e.target.value) })} min={0} max={20} className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Meses Consecutivos</label>
              <input type="number" value={form.meses_consecutivos} onChange={(e) => setForm({ ...form, meses_consecutivos: Number(e.target.value) })} min={0} max={12} className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Bonus Mensal (R$)</label>
              <input type="number" value={form.bonus_valor} onChange={(e) => setForm({ ...form, bonus_valor: Number(e.target.value) })} min={0} className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} />
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

      <div className="space-y-3">
        {niveis.map((nivel, idx) => (
          <div key={nivel.id} className="rounded-xl p-5 transition-all" style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${nivel.cor}30` }}>
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold" style={{ backgroundColor: nivel.cor + '20', color: nivel.cor }}>
                {nivel.ordem}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-lg font-bold" style={{ color: nivel.cor }}>{nivel.nome}</h4>
                {nivel.descricao && <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{nivel.descricao}</p>}
                <div className="flex items-center gap-4 mt-2">
                  <div className="flex items-center gap-1">
                    <Star className="w-3.5 h-3.5" style={{ color: '#FBBF24' }} />
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{nivel.estrelas_necessarias} estrelas</span>
                  </div>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{nivel.meses_consecutivos} meses</span>
                  {nivel.bonus_valor > 0 && (
                    <span className="text-xs font-medium" style={{ color: '#10B981' }}>R$ {nivel.bonus_valor.toLocaleString('pt-BR')}/mes</span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleMove(nivel.id, 'up')} disabled={idx === 0} className="p-1.5 rounded disabled:opacity-20" style={{ color: 'var(--text-secondary)' }}>
                  <ChevronUp className="w-4 h-4" />
                </button>
                <button onClick={() => handleMove(nivel.id, 'down')} disabled={idx === niveis.length - 1} className="p-1.5 rounded disabled:opacity-20" style={{ color: 'var(--text-secondary)' }}>
                  <ChevronDown className="w-4 h-4" />
                </button>
                <button onClick={() => handleEdit(nivel)} className="p-1.5 rounded" style={{ color: 'var(--text-secondary)' }}>
                  <Pencil className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(nivel.id)} className="p-1.5 rounded" style={{ color: 'var(--text-secondary)' }}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {niveis.length === 0 && (
        <div className="text-center py-16">
          <Award className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: 'var(--text-secondary)' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Nenhum nivel configurado</p>
        </div>
      )}
    </div>
  );
}
