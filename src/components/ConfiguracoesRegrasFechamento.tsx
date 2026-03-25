import { useState, useEffect } from 'react';
import {
  ShieldCheck, ShieldAlert, ShieldX, Plus, Trash2, Pencil,
  Save, X, Package, DollarSign, FileText, Wrench,
  ChevronDown, ChevronUp, ToggleLeft, ToggleRight, Loader2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Regra {
  id: string;
  unidade_id: string | null;
  codigo: string;
  titulo: string;
  descricao: string;
  categoria: 'pecas' | 'financeiro' | 'fiscal' | 'operacional';
  severidade: 'bloqueante' | 'alerta';
  ativa: boolean;
  aplica_lp: boolean;
  aplica_ow: boolean;
  aplica_ih: boolean;
  aplica_ci: boolean;
  ordem: number;
}

const CATEGORIA_CONFIG: Record<string, { icon: typeof Package; label: string; color: string }> = {
  pecas: { icon: Package, label: 'Pecas', color: '#00D4FF' },
  financeiro: { icon: DollarSign, label: 'Financeiro', color: '#39FF14' },
  fiscal: { icon: FileText, label: 'Fiscal', color: '#FFA500' },
  operacional: { icon: Wrench, label: 'Operacional', color: '#FF6B35' },
};

const EMPTY_REGRA: Omit<Regra, 'id'> = {
  unidade_id: null,
  codigo: '',
  titulo: '',
  descricao: '',
  categoria: 'operacional',
  severidade: 'bloqueante',
  ativa: true,
  aplica_lp: true,
  aplica_ow: true,
  aplica_ih: true,
  aplica_ci: true,
  ordem: 99,
};

interface Props {
  selectedUnidade: string;
}

export function ConfiguracoesRegrasFechamento({ selectedUnidade }: Props) {
  const { usuario } = useAuth();
  const [regras, setRegras] = useState<Regra[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState(EMPTY_REGRA);
  const [saving, setSaving] = useState(false);
  const [expandedCat, setExpandedCat] = useState<Record<string, boolean>>({
    pecas: true, financeiro: true, fiscal: true, operacional: true,
  });

  useEffect(() => { loadRegras(); }, [selectedUnidade]);

  async function loadRegras() {
    setLoading(true);
    const { data } = await supabase
      .from('regras_fechamento_os')
      .select('*')
      .or(selectedUnidade ? `unidade_id.is.null,unidade_id.eq.${selectedUnidade}` : 'unidade_id.is.null')
      .order('ordem');
    setRegras((data || []) as Regra[]);
    setLoading(false);
  }

  async function handleSave() {
    setSaving(true);
    try {
      if (editingId) {
        await supabase.from('regras_fechamento_os').update({
          titulo: formData.titulo,
          descricao: formData.descricao,
          categoria: formData.categoria,
          severidade: formData.severidade,
          ativa: formData.ativa,
          aplica_lp: formData.aplica_lp,
          aplica_ow: formData.aplica_ow,
          aplica_ih: formData.aplica_ih,
          aplica_ci: formData.aplica_ci,
          ordem: formData.ordem,
          updated_at: new Date().toISOString(),
        }).eq('id', editingId);
      } else {
        await supabase.from('regras_fechamento_os').insert({
          ...formData,
          unidade_id: selectedUnidade || null,
        });
      }
      setShowForm(false);
      setEditingId(null);
      setFormData(EMPTY_REGRA);
      await loadRegras();
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(regra: Regra) {
    await supabase.from('regras_fechamento_os').update({ ativa: !regra.ativa, updated_at: new Date().toISOString() }).eq('id', regra.id);
    setRegras(prev => prev.map(r => r.id === regra.id ? { ...r, ativa: !r.ativa } : r));
  }

  async function handleDelete(id: string) {
    await supabase.from('regras_fechamento_os').delete().eq('id', id);
    setRegras(prev => prev.filter(r => r.id !== id));
  }

  function startEdit(regra: Regra) {
    setFormData(regra);
    setEditingId(regra.id);
    setShowForm(true);
  }

  function groupByCategoria(items: Regra[]) {
    const groups: Record<string, Regra[]> = {};
    for (const item of items) {
      if (!groups[item.categoria]) groups[item.categoria] = [];
      groups[item.categoria].push(item);
    }
    return groups;
  }

  const grouped = groupByCategoria(regras);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-black tracking-wider uppercase" style={{ color: '#FF0064' }}>
            Regras de Fechamento de OS
          </h3>
          <p className="text-xs text-gray-500 mt-1">
            Configure as validacoes que serao verificadas ao fechar uma OS. Regras globais se aplicam a todas as unidades.
          </p>
        </div>
        <button
          onClick={() => { setFormData(EMPTY_REGRA); setEditingId(null); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-xs transition-all"
          style={{
            background: 'linear-gradient(135deg, rgba(255,0,100,0.15) 0%, rgba(255,0,100,0.05) 100%)',
            border: '1px solid rgba(255,0,100,0.4)',
            color: '#FF0064',
          }}
        >
          <Plus className="w-3.5 h-3.5" />
          Nova Regra
        </button>
      </div>

      {showForm && (
        <div
          className="rounded-xl p-5 space-y-4"
          style={{
            background: 'rgba(255,255,255,0.03)',
            border: '1px solid rgba(255,0,100,0.2)',
          }}
        >
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold text-white">{editingId ? 'Editar Regra' : 'Nova Regra'}</h4>
            <button onClick={() => { setShowForm(false); setEditingId(null); }} className="p-1 rounded hover:bg-white/10">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Codigo</label>
              <input
                value={formData.codigo}
                onChange={e => setFormData(p => ({ ...p, codigo: e.target.value.toUpperCase().replace(/\s/g, '_') }))}
                disabled={!!editingId}
                className="neon-input w-full px-3 py-2 rounded-lg text-sm"
                placeholder="EX: MINHA_REGRA"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Titulo</label>
              <input
                value={formData.titulo}
                onChange={e => setFormData(p => ({ ...p, titulo: e.target.value }))}
                className="neon-input w-full px-3 py-2 rounded-lg text-sm"
                placeholder="Nome exibido para o usuario"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Descricao</label>
            <textarea
              value={formData.descricao}
              onChange={e => setFormData(p => ({ ...p, descricao: e.target.value }))}
              className="neon-input w-full px-3 py-2 rounded-lg text-sm"
              rows={2}
              placeholder="Descricao detalhada da regra..."
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Categoria</label>
              <select
                value={formData.categoria}
                onChange={e => setFormData(p => ({ ...p, categoria: e.target.value as any }))}
                className="neon-input w-full px-3 py-2 rounded-lg text-sm"
              >
                {Object.entries(CATEGORIA_CONFIG).map(([key, cfg]) => (
                  <option key={key} value={key}>{cfg.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Severidade</label>
              <select
                value={formData.severidade}
                onChange={e => setFormData(p => ({ ...p, severidade: e.target.value as any }))}
                className="neon-input w-full px-3 py-2 rounded-lg text-sm"
              >
                <option value="bloqueante">Bloqueante</option>
                <option value="alerta">Alerta</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-1 block">Ordem</label>
              <input
                type="number"
                value={formData.ordem}
                onChange={e => setFormData(p => ({ ...p, ordem: parseInt(e.target.value) || 0 }))}
                className="neon-input w-full px-3 py-2 rounded-lg text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 block">Aplica-se a</label>
            <div className="flex items-center gap-4">
              {[
                { key: 'aplica_lp', label: 'LP' },
                { key: 'aplica_ow', label: 'OW' },
                { key: 'aplica_ih', label: 'IH' },
                { key: 'aplica_ci', label: 'CI' },
              ].map(opt => (
                <label key={opt.key} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={(formData as any)[opt.key]}
                    onChange={e => setFormData(p => ({ ...p, [opt.key]: e.target.checked }))}
                    className="rounded border-gray-600"
                  />
                  <span className="text-xs font-bold text-gray-300">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => { setShowForm(false); setEditingId(null); }}
              className="px-4 py-2 rounded-lg text-sm font-bold text-gray-400 hover:bg-white/5 transition-colors"
              style={{ border: '1px solid rgba(255,255,255,0.1)' }}
            >
              Cancelar
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !formData.codigo || !formData.titulo}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, #FF0064 0%, #FF6B35 100%)',
                color: '#fff',
              }}
            >
              <Save className="w-3.5 h-3.5" />
              {saving ? 'Salvando...' : editingId ? 'Atualizar' : 'Criar Regra'}
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {Object.entries(CATEGORIA_CONFIG).map(([catKey, catCfg]) => {
          const items = grouped[catKey] || [];
          const CatIcon = catCfg.icon;
          const isExpanded = expandedCat[catKey];

          return (
            <div
              key={catKey}
              className="rounded-xl overflow-hidden"
              style={{ border: '1px solid rgba(255,255,255,0.08)' }}
            >
              <button
                onClick={() => setExpandedCat(p => ({ ...p, [catKey]: !p[catKey] }))}
                className="w-full flex items-center justify-between px-4 py-3 transition-colors hover:bg-white/5"
                style={{ background: 'rgba(255,255,255,0.02)' }}
              >
                <div className="flex items-center gap-2.5">
                  <CatIcon className="w-4 h-4" style={{ color: catCfg.color }} />
                  <span className="text-xs font-black tracking-wider uppercase" style={{ color: catCfg.color }}>
                    {catCfg.label}
                  </span>
                  <span className="px-1.5 py-0.5 rounded text-[9px] font-bold" style={{
                    background: `${catCfg.color}20`,
                    color: catCfg.color,
                  }}>
                    {items.length}
                  </span>
                </div>
                {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
              </button>

              {isExpanded && (
                <div className="px-4 pb-3 space-y-2">
                  {items.length === 0 ? (
                    <p className="text-xs text-gray-600 text-center py-3">Nenhuma regra nesta categoria</p>
                  ) : (
                    items.map(regra => (
                      <div
                        key={regra.id}
                        className="flex items-start gap-3 p-3 rounded-lg transition-all"
                        style={{
                          background: regra.ativa ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)',
                          border: `1px solid ${regra.ativa ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)'}`,
                          opacity: regra.ativa ? 1 : 0.5,
                        }}
                      >
                        <button onClick={() => handleToggle(regra)} className="mt-0.5 shrink-0">
                          {regra.ativa ? (
                            <ToggleRight className="w-5 h-5" style={{ color: catCfg.color }} />
                          ) : (
                            <ToggleLeft className="w-5 h-5 text-gray-600" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            {regra.severidade === 'bloqueante' ? (
                              <ShieldX className="w-3.5 h-3.5 text-[#FF0064] shrink-0" />
                            ) : (
                              <ShieldAlert className="w-3.5 h-3.5 text-[#FFBF00] shrink-0" />
                            )}
                            <span className="text-xs font-bold text-white truncate">{regra.titulo}</span>
                            <span className="px-1 py-0.5 rounded text-[8px] font-bold uppercase shrink-0" style={{
                              background: regra.severidade === 'bloqueante' ? 'rgba(255,0,100,0.15)' : 'rgba(255,191,0,0.15)',
                              color: regra.severidade === 'bloqueante' ? '#FF0064' : '#FFBF00',
                            }}>
                              {regra.severidade}
                            </span>
                            {!regra.unidade_id && (
                              <span className="px-1 py-0.5 rounded text-[8px] font-bold uppercase shrink-0" style={{
                                background: 'rgba(0,212,255,0.12)', color: '#00D4FF',
                              }}>GLOBAL</span>
                            )}
                          </div>
                          <p className="text-[10px] text-gray-500 mb-1.5">{regra.descricao}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-[9px] font-mono text-gray-600">{regra.codigo}</span>
                            <span className="text-[9px] text-gray-600">|</span>
                            {regra.aplica_lp && <span className="px-1 py-0.5 rounded text-[8px] font-bold bg-blue-500/10 text-blue-400">LP</span>}
                            {regra.aplica_ow && <span className="px-1 py-0.5 rounded text-[8px] font-bold bg-green-500/10 text-green-400">OW</span>}
                            {regra.aplica_ih && <span className="px-1 py-0.5 rounded text-[8px] font-bold bg-orange-500/10 text-orange-400">IH</span>}
                            {regra.aplica_ci && <span className="px-1 py-0.5 rounded text-[8px] font-bold bg-cyan-500/10 text-cyan-400">CI</span>}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => startEdit(regra)}
                            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                            title="Editar regra"
                          >
                            <Pencil className="w-3.5 h-3.5 text-gray-400" />
                          </button>
                          {regra.unidade_id && (
                            <button
                              onClick={() => handleDelete(regra.id)}
                              className="p-1.5 rounded-lg hover:bg-red-500/10 transition-colors"
                              title="Excluir regra"
                            >
                              <Trash2 className="w-3.5 h-3.5 text-red-400" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {regras.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <ShieldCheck className="w-10 h-10 text-gray-700" />
          <p className="text-sm text-gray-500">Nenhuma regra de fechamento configurada</p>
          <p className="text-xs text-gray-600">Clique em "Nova Regra" para criar a primeira</p>
        </div>
      )}
    </div>
  );
}
