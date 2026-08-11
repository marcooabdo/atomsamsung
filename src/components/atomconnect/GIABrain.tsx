import { useState, useEffect, useRef } from 'react';
import { Brain, Plus, Save, Trash2, Loader2, ToggleLeft, ToggleRight, Search, ChevronDown, ChevronUp, Sparkles, MessageSquare, ArrowRight, Clock, Filter, X, BookOpen, Zap, MonitorSpeaker } from 'lucide-react';
import { GIADashboard } from './GIADashboard';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  accentColor: string;
  unidadeId?: string;
}

interface Conhecimento {
  id: string;
  titulo: string;
  conteudo: string;
  categoria: string;
  unidade_ids: string[] | null;
  ativo: boolean;
  ordem: number;
  criado_por: string | null;
  created_at: string;
  updated_at: string;
}

interface PipelineMensagem {
  id: string;
  coluna_kanban: string;
  tipo_atendimento: string;
  tipo_os: string;
  mensagem: string;
  ativo: boolean;
  frequencia_horas: number;
  unidade_ids: string[] | null;
  criado_por: string | null;
  created_at: string;
}

interface Unidade {
  id: string;
  nome: string;
}

const CATEGORIAS = [
  { id: 'geral', label: 'Geral', color: '#6B7280' },
  { id: 'atendimento', label: 'Atendimento', color: '#3B82F6' },
  { id: 'orcamento', label: 'Orçamento', color: '#F59E0B' },
  { id: 'reparo', label: 'Reparo', color: '#10B981' },
  { id: 'pecas', label: 'Peças', color: '#8B5CF6' },
  { id: 'prazos', label: 'Prazos', color: '#EF4444' },
  { id: 'negociacao', label: 'Negociação', color: '#EC4899' },
  { id: 'outro', label: 'Outro', color: '#6366F1' },
];

const COLUNAS_PIPELINE = [
  { id: 'os_nova', label: 'OS Nova', color: '#0EA5E9' },
  { id: 'diagnostico', label: 'Diagnóstico/Triagem', color: '#06B6D4' },
  { id: 'negociacao_em_andamento', label: 'Enviar Orçamento', color: '#F59E0B' },
  { id: 'aguardando_aprovacao', label: 'Aguardando Aprovação', color: '#F97316' },
  { id: 'orcamento_aprovado', label: 'Orçamento Aprovado', color: '#10B981' },
  { id: 'aguardando_peca', label: 'Aguardando Peça', color: '#8B5CF6' },
  { id: 'peca_em_transito', label: 'Peça em Trânsito', color: '#3B82F6' },
  { id: 'em_reparo_ci', label: 'Em Reparo CI', color: '#0EA5E9' },
  { id: 'rota_preta', label: 'Rota Preta', color: '#1a1a1a' },
  { id: 'rota_vermelha', label: 'Rota Vermelha', color: '#EF4444' },
  { id: 'rota_azul', label: 'Rota Azul', color: '#3B82F6' },
  { id: 'rota_verde', label: 'Rota Verde', color: '#10B981' },
  { id: 'rota_rosa', label: 'Rota Rosa', color: '#EC4899' },
  { id: 'rota_amarela', label: 'Rota Amarela', color: '#EAB308' },
  { id: 'rota_laranja', label: 'Rota Laranja', color: '#F97316' },
  { id: 'em_rota_ih', label: 'Agendados (FTF)', color: '#10B981' },
  { id: 'em_reparo_ih', label: 'Reparo em Progresso IH', color: '#06B6D4' },
  { id: 'instalacao_inicial', label: 'Instalação Inicial', color: '#7C3AED' },
  { id: 'service_handling', label: 'Service Handling', color: '#DB2777' },
  { id: 'return_handling', label: 'Return Handling', color: '#D97706' },
  { id: 'trade_up', label: 'Trade Up', color: '#0891B2' },
  { id: 'saw', label: 'SAW', color: '#14B8A6' },
  { id: 'controle_qualidade', label: 'Controle de Qualidade / OQC', color: '#2563EB' },
  { id: 'qa_bt', label: 'Q&A / BT', color: '#7C3AED' },
  { id: 'reparo_concluido', label: 'Reparo Concluído', color: '#10B981' },
  { id: 'aguardando_fechamento', label: 'Aguardando Fechamento', color: '#F59E0B' },
  { id: 'os_fechada', label: 'OS Fechada', color: '#6B7280' },
  { id: 'orcamentos_rejeitados', label: 'Orçamentos Rejeitados', color: '#EF4444' },
];

export function GIABrain({ accentColor, unidadeId }: Props) {
  const { usuario, unidadeAtual, unidades: allUnidades, unidadesAdicionais } = useAuth();
  const [activeTab, setActiveTab] = useState<'dashboard' | 'conhecimento' | 'pipeline'>('dashboard');
  const [selectedUnit, setSelectedUnit] = useState<string | undefined>(unidadeId);

  const isMasterDiretoria = (usuario?.tipo === 'master' || usuario?.tipo === 'diretoria') && !usuario?.unidade_id;
  const accessibleUnits = isMasterDiretoria
    ? allUnidades
    : allUnidades.filter(u => u.id === unidadeAtual || unidadesAdicionais.includes(u.id));

  useEffect(() => {
    setSelectedUnit(unidadeId);
  }, [unidadeId]);

  const tabs = [
    { id: 'dashboard' as const, label: 'Dashboard', icon: MonitorSpeaker },
    { id: 'conhecimento' as const, label: 'Base de Conhecimento', icon: BookOpen },
    { id: 'pipeline' as const, label: 'Mensagens Pipeline', icon: MessageSquare },
  ];

  return (
    <div className="h-full flex flex-col gap-4 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${accentColor}20` }}>
            <Brain className="w-5 h-5" style={{ color: accentColor }} />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>GIA Brain</h2>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Cérebro da GIA — Ensinamentos e Mensagens Automáticas</p>
          </div>
        </div>

        {accessibleUnits.length > 1 && (
          <select
            value={selectedUnit || ''}
            onChange={e => setSelectedUnit(e.target.value || undefined)}
            className="px-3 py-2 rounded-lg text-sm border-0 outline-none"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
          >
            {isMasterDiretoria && <option value="">Todas as Unidades</option>}
            {accessibleUnits.map(u => (
              <option key={u.id} value={u.id}>{u.nome}</option>
            ))}
          </select>
        )}
      </div>

      <div className="flex gap-1 p-1 rounded-xl" style={{ background: 'var(--bg-tertiary)' }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg text-sm font-medium transition-all"
              style={{
                background: isActive ? 'var(--bg-card)' : 'transparent',
                color: isActive ? accentColor : 'var(--text-secondary)',
                boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
              }}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="flex-1 overflow-auto">
        {activeTab === 'dashboard' && (
          <GIADashboard accentColor={accentColor} unidadeId={selectedUnit} />
        )}
        {activeTab === 'conhecimento' && (
          <ConhecimentoTab accentColor={accentColor} unidadeId={selectedUnit} usuarioId={usuario?.id} accessibleUnits={accessibleUnits} isMasterDiretoria={isMasterDiretoria} />
        )}
        {activeTab === 'pipeline' && (
          <PipelineMensagensTab accentColor={accentColor} unidadeId={selectedUnit} usuarioId={usuario?.id} accessibleUnits={accessibleUnits} isMasterDiretoria={isMasterDiretoria} />
        )}
      </div>
    </div>
  );
}

function ConhecimentoTab({ accentColor, unidadeId, usuarioId, accessibleUnits, isMasterDiretoria }: { accentColor: string; unidadeId?: string; usuarioId?: string; accessibleUnits: Unidade[]; isMasterDiretoria: boolean }) {
  const [items, setItems] = useState<Conhecimento[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategoria, setFilterCategoria] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [allUnidades, setAllUnidades] = useState<Unidade[]>([]);
  const unidades = isMasterDiretoria ? allUnidades : (accessibleUnits.length > 0 ? accessibleUnits : allUnidades);
  const [form, setForm] = useState({
    titulo: '',
    conteudo: '',
    categoria: 'geral',
    unidade_ids: null as string[] | null,
    ativo: true,
  });

  useEffect(() => {
    loadData();
    loadAllUnidades();
  }, []);

  const loadAllUnidades = async () => {
    const { data } = await supabase.from('unidades').select('id, nome').order('nome');
    if (data) setAllUnidades(data);
  };

  const loadData = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('gia_base_conhecimento')
      .select('*')
      .order('ordem', { ascending: true })
      .order('created_at', { ascending: false });
    if (data) setItems(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.titulo.trim() || !form.conteudo.trim()) return;
    setSaving(true);

    const payload = {
      titulo: form.titulo.trim(),
      conteudo: form.conteudo.trim(),
      categoria: form.categoria,
      unidade_ids: form.unidade_ids,
      ativo: form.ativo,
      criado_por: usuarioId || null,
    };

    if (editingId) {
      await supabase.from('gia_base_conhecimento').update(payload).eq('id', editingId);
    } else {
      await supabase.from('gia_base_conhecimento').insert(payload);
    }

    resetForm();
    setSaving(false);
    loadData();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este ensinamento?')) return;
    await supabase.from('gia_base_conhecimento').delete().eq('id', id);
    loadData();
  };

  const handleToggle = async (id: string, ativo: boolean) => {
    await supabase.from('gia_base_conhecimento').update({ ativo: !ativo }).eq('id', id);
    setItems(prev => prev.map(i => i.id === id ? { ...i, ativo: !ativo } : i));
  };

  const startEdit = (item: Conhecimento) => {
    setForm({
      titulo: item.titulo,
      conteudo: item.conteudo,
      categoria: item.categoria,
      unidade_ids: item.unidade_ids,
      ativo: item.ativo,
    });
    setEditingId(item.id);
    setShowForm(true);
  };

  const resetForm = () => {
    setForm({ titulo: '', conteudo: '', categoria: 'geral', unidade_ids: null, ativo: true });
    setEditingId(null);
    setShowForm(false);
  };

  const filtered = items.filter(i => {
    if (searchTerm && !i.titulo.toLowerCase().includes(searchTerm.toLowerCase()) && !i.conteudo.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    if (filterCategoria && i.categoria !== filterCategoria) return false;
    if (unidadeId) {
      const isUniversal = !i.unidade_ids || i.unidade_ids.length === 0;
      const matchesUnit = i.unidade_ids?.includes(unidadeId);
      if (!isUniversal && !matchesUnit) return false;
    }
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[200px] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
          <input
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Buscar ensinamentos..."
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
          />
        </div>
        <select
          value={filterCategoria}
          onChange={e => setFilterCategoria(e.target.value)}
          className="px-3 py-2.5 rounded-xl text-sm"
          style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
        >
          <option value="">Todas categorias</option>
          {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
        </select>
        <button
          onClick={() => { resetForm(); setShowForm(true); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:scale-[1.02]"
          style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}CC)` }}
        >
          <Plus className="w-4 h-4" />
          Novo Ensinamento
        </button>
      </div>

      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-2xl"
            style={{ background: 'var(--bg-card)', border: `1px solid ${accentColor}40` }}
          >
            <div className="p-5 space-y-4 overflow-visible">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                  {editingId ? 'Editar Ensinamento' : 'Novo Ensinamento'}
                </h3>
                <button onClick={resetForm} className="p-1 rounded-lg hover:bg-white/10">
                  <X className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Título</label>
                  <input
                    value={form.titulo}
                    onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
                    placeholder="Ex: Prazo de reparo LP"
                    className="w-full px-3 py-2.5 rounded-xl text-sm"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>Categoria</label>
                  <select
                    value={form.categoria}
                    onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}
                    className="w-full px-3 py-2.5 rounded-xl text-sm"
                    style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                  >
                    {CATEGORIAS.map(c => <option key={c.id} value={c.id}>{c.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                  Conteúdo / Instrução para a GIA
                </label>
                <textarea
                  value={form.conteudo}
                  onChange={e => setForm(f => ({ ...f, conteudo: e.target.value }))}
                  placeholder="Escreva aqui o que a GIA deve saber e como responder sobre este assunto..."
                  rows={5}
                  className="w-full px-3 py-2.5 rounded-xl text-sm resize-y"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                />
              </div>

              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: 'var(--text-secondary)' }}>
                  Unidades (deixe vazio para aplicar a TODAS)
                </label>
                <UnidadeSelector
                  unidades={unidades}
                  selected={form.unidade_ids}
                  onChange={ids => setForm(f => ({ ...f, unidade_ids: ids }))}
                  accentColor={accentColor}
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <button onClick={() => setForm(f => ({ ...f, ativo: !f.ativo }))}>
                    {form.ativo
                      ? <ToggleRight className="w-6 h-6" style={{ color: '#10B981' }} />
                      : <ToggleLeft className="w-6 h-6" style={{ color: 'var(--text-tertiary)' }} />
                    }
                  </button>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {form.ativo ? 'Ativo' : 'Desativado'}
                  </span>
                </label>

                <div className="flex gap-2">
                  <button onClick={resetForm} className="px-4 py-2 rounded-xl text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Cancelar
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={saving || !form.titulo.trim() || !form.conteudo.trim()}
                    className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50"
                    style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}CC)` }}
                  >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    Salvar
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin" style={{ color: accentColor }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Brain className="w-12 h-12 mx-auto mb-3" style={{ color: 'var(--text-tertiary)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Nenhum ensinamento cadastrado</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-tertiary)' }}>Adicione conhecimentos para a GIA usar no atendimento</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => {
            const cat = CATEGORIAS.find(c => c.id === item.categoria);
            return (
              <motion.div
                key={item.id}
                layout
                className="rounded-xl p-4 transition-all hover:scale-[1.002]"
                style={{
                  background: 'var(--bg-card)',
                  border: `1px solid ${item.ativo ? 'var(--border-primary)' : 'var(--border-primary)'}`,
                  opacity: item.ativo ? 1 : 0.5,
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: `${cat?.color}20`, color: cat?.color }}
                      >
                        {cat?.label}
                      </span>
                      {item.unidade_ids === null && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: '#10B98115', color: '#10B981' }}>
                          Todas unidades
                        </span>
                      )}
                      {item.unidade_ids && (
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full" style={{ background: '#3B82F615', color: '#3B82F6' }}>
                          {item.unidade_ids.length} unidade(s)
                        </span>
                      )}
                    </div>
                    <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{item.titulo}</h4>
                    <p className="text-xs mt-1 whitespace-pre-wrap line-clamp-3" style={{ color: 'var(--text-secondary)' }}>{item.conteudo}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => handleToggle(item.id, item.ativo)} className="p-1.5 rounded-lg hover:bg-white/10">
                      {item.ativo
                        ? <ToggleRight className="w-5 h-5" style={{ color: '#10B981' }} />
                        : <ToggleLeft className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                      }
                    </button>
                    <button onClick={() => startEdit(item)} className="p-1.5 rounded-lg hover:bg-white/10">
                      <Sparkles className="w-4 h-4" style={{ color: accentColor }} />
                    </button>
                    <button onClick={() => handleDelete(item.id)} className="p-1.5 rounded-lg hover:bg-white/10">
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function PipelineMensagensTab({ accentColor, unidadeId, usuarioId, accessibleUnits, isMasterDiretoria }: { accentColor: string; unidadeId?: string; usuarioId?: string; accessibleUnits: Unidade[]; isMasterDiretoria: boolean }) {
  const [mensagens, setMensagens] = useState<PipelineMensagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedColumn, setExpandedColumn] = useState<string | null>(null);
  const [editingMsg, setEditingMsg] = useState<PipelineMensagem | null>(null);
  const [saving, setSaving] = useState(false);
  const [allUnidades, setAllUnidades] = useState<Unidade[]>([]);
  const unidades = isMasterDiretoria ? allUnidades : (accessibleUnits.length > 0 ? accessibleUnits : allUnidades);
  const [showNewFor, setShowNewFor] = useState<string | null>(null);
  const [newForm, setNewForm] = useState({
    tipo_atendimento: 'todos',
    tipo_os: 'todos',
    mensagem: '',
    frequencia_horas: 0,
    unidade_ids: null as string[] | null,
  });

  useEffect(() => {
    loadData();
    loadAllUnidades();
  }, []);

  const loadAllUnidades = async () => {
    const { data } = await supabase.from('unidades').select('id, nome').order('nome');
    if (data) setAllUnidades(data);
  };

  const loadData = async () => {
    setLoading(true);
    const { data } = await supabase.from('gia_pipeline_mensagens').select('*').order('created_at');
    if (data) setMensagens(data);
    setLoading(false);
  };

  const handleToggle = async (id: string, ativo: boolean) => {
    await supabase.from('gia_pipeline_mensagens').update({ ativo: !ativo }).eq('id', id);
    setMensagens(prev => prev.map(m => m.id === id ? { ...m, ativo: !ativo } : m));
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir esta mensagem automática?')) return;
    await supabase.from('gia_pipeline_mensagens').delete().eq('id', id);
    setMensagens(prev => prev.filter(m => m.id !== id));
  };

  const handleSaveNew = async (colunaId: string) => {
    if (!newForm.mensagem.trim()) return;
    setSaving(true);
    await supabase.from('gia_pipeline_mensagens').insert({
      coluna_kanban: colunaId,
      tipo_atendimento: newForm.tipo_atendimento,
      tipo_os: newForm.tipo_os,
      mensagem: newForm.mensagem.trim(),
      frequencia_horas: newForm.frequencia_horas,
      unidade_ids: newForm.unidade_ids,
      ativo: true,
      criado_por: usuarioId || null,
    });
    setShowNewFor(null);
    setNewForm({ tipo_atendimento: 'todos', tipo_os: 'todos', mensagem: '', frequencia_horas: 0, unidade_ids: null });
    setSaving(false);
    loadData();
  };

  const handleUpdateMsg = async (msg: PipelineMensagem) => {
    setSaving(true);
    await supabase.from('gia_pipeline_mensagens').update({
      tipo_atendimento: msg.tipo_atendimento,
      tipo_os: msg.tipo_os,
      mensagem: msg.mensagem,
      frequencia_horas: msg.frequencia_horas,
      unidade_ids: msg.unidade_ids,
    }).eq('id', msg.id);
    setEditingMsg(null);
    setSaving(false);
    loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin" style={{ color: accentColor }} />
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-xs px-1" style={{ color: 'var(--text-tertiary)' }}>
        Configure mensagens automáticas que serão enviadas ao cliente quando a OS dele mudar de etapa no pipeline operacional.
        Você pode usar variáveis: {'{{cliente_nome}}'}, {'{{numero_os}}'}, {'{{modelo}}'}, {'{{status}}'}.
      </p>

      {COLUNAS_PIPELINE.map(coluna => {
        const colMsgs = mensagens.filter(m => {
          if (m.coluna_kanban !== coluna.id) return false;
          if (unidadeId) {
            const isUniversal = !m.unidade_ids || m.unidade_ids.length === 0;
            if (!isUniversal && !m.unidade_ids?.includes(unidadeId)) return false;
          }
          return true;
        });
        const isExpanded = expandedColumn === coluna.id;

        return (
          <div
            key={coluna.id}
            className="rounded-xl overflow-hidden transition-all"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
          >
            <button
              onClick={() => setExpandedColumn(isExpanded ? null : coluna.id)}
              className="w-full flex items-center gap-3 p-3 text-left hover:bg-white/5 transition-colors"
            >
              <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: coluna.color }} />
              <span className="text-sm font-medium flex-1" style={{ color: 'var(--text-primary)' }}>
                {coluna.label}
              </span>
              {colMsgs.length > 0 && (
                <span
                  className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: `${accentColor}20`, color: accentColor }}
                >
                  {colMsgs.filter(m => m.ativo).length} ativa(s)
                </span>
              )}
              {isExpanded ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />}
            </button>

            <AnimatePresence>
              {isExpanded && (
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: 'auto' }}
                  exit={{ height: 0 }}
                  className="overflow-hidden"
                >
                  <div className="px-3 pb-3 space-y-2" style={{ borderTop: '1px solid var(--border-primary)' }}>
                    <div className="pt-2" />
                    {colMsgs.length === 0 && showNewFor !== coluna.id && (
                      <p className="text-xs text-center py-3" style={{ color: 'var(--text-tertiary)' }}>
                        Nenhuma mensagem configurada para esta etapa
                      </p>
                    )}

                    {colMsgs.map(msg => (
                      <div key={msg.id} className="rounded-lg p-3 space-y-2" style={{ background: 'var(--bg-tertiary)', opacity: msg.ativo ? 1 : 0.5 }}>
                        {editingMsg?.id === msg.id ? (
                          <MensagemForm
                            form={editingMsg}
                            onChange={setEditingMsg}
                            onSave={() => handleUpdateMsg(editingMsg)}
                            onCancel={() => setEditingMsg(null)}
                            saving={saving}
                            accentColor={accentColor}
                            unidades={unidades}
                          />
                        ) : (
                          <>
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#3B82F615', color: '#3B82F6' }}>
                                {msg.tipo_atendimento === 'todos' ? 'CI + IH' : msg.tipo_atendimento}
                              </span>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full" style={{ background: '#F59E0B15', color: '#F59E0B' }}>
                                {msg.tipo_os === 'todos' ? 'LP + OW' : msg.tipo_os}
                              </span>
                              {msg.frequencia_horas > 0 && (
                                <span className="text-[10px] font-medium flex items-center gap-1" style={{ color: 'var(--text-tertiary)' }}>
                                  <Clock className="w-3 h-3" />
                                  A cada {msg.frequencia_horas}h
                                </span>
                              )}
                              {msg.frequencia_horas === 0 && (
                                <span className="text-[10px] font-medium" style={{ color: 'var(--text-tertiary)' }}>
                                  Enviar 1x
                                </span>
                              )}
                            </div>
                            <p className="text-xs whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>{msg.mensagem}</p>
                            <div className="flex items-center gap-1 pt-1">
                              <button onClick={() => handleToggle(msg.id, msg.ativo)} className="p-1 rounded hover:bg-white/10">
                                {msg.ativo ? <ToggleRight className="w-4 h-4 text-emerald-400" /> : <ToggleLeft className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />}
                              </button>
                              <button onClick={() => setEditingMsg({ ...msg })} className="p-1 rounded hover:bg-white/10">
                                <Sparkles className="w-3.5 h-3.5" style={{ color: accentColor }} />
                              </button>
                              <button onClick={() => handleDelete(msg.id)} className="p-1 rounded hover:bg-white/10">
                                <Trash2 className="w-3.5 h-3.5 text-red-400" />
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    ))}

                    {showNewFor === coluna.id ? (
                      <div className="rounded-lg p-3" style={{ background: 'var(--bg-tertiary)', border: `1px solid ${accentColor}30` }}>
                        <MensagemForm
                          form={{ ...newForm, id: '', coluna_kanban: coluna.id, ativo: true, criado_por: null, created_at: '' }}
                          onChange={(f: any) => setNewForm({ tipo_atendimento: f.tipo_atendimento, tipo_os: f.tipo_os, mensagem: f.mensagem, frequencia_horas: f.frequencia_horas, unidade_ids: f.unidade_ids })}
                          onSave={() => handleSaveNew(coluna.id)}
                          onCancel={() => setShowNewFor(null)}
                          saving={saving}
                          accentColor={accentColor}
                          unidades={unidades}
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => { setShowNewFor(coluna.id); setNewForm({ tipo_atendimento: 'todos', tipo_os: 'todos', mensagem: '', frequencia_horas: 0, unidade_ids: null }); }}
                        className="w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-medium transition-all hover:bg-white/5"
                        style={{ border: `1px dashed ${accentColor}40`, color: accentColor }}
                      >
                        <Plus className="w-3.5 h-3.5" />
                        Adicionar mensagem
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

function MensagemForm({ form, onChange, onSave, onCancel, saving, accentColor, unidades }: {
  form: PipelineMensagem;
  onChange: (f: any) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  accentColor: string;
  unidades: Unidade[];
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
        <div>
          <label className="text-[10px] font-medium mb-0.5 block" style={{ color: 'var(--text-tertiary)' }}>Tipo Atendimento</label>
          <select
            value={form.tipo_atendimento}
            onChange={e => onChange({ ...form, tipo_atendimento: e.target.value })}
            className="w-full px-2 py-1.5 rounded-lg text-xs"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
          >
            <option value="todos">CI + IH</option>
            <option value="CI">Somente CI</option>
            <option value="IH">Somente IH</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-medium mb-0.5 block" style={{ color: 'var(--text-tertiary)' }}>Tipo OS</label>
          <select
            value={form.tipo_os}
            onChange={e => onChange({ ...form, tipo_os: e.target.value })}
            className="w-full px-2 py-1.5 rounded-lg text-xs"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
          >
            <option value="todos">LP + OW</option>
            <option value="LP">Somente LP</option>
            <option value="OW">Somente OW</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-medium mb-0.5 block" style={{ color: 'var(--text-tertiary)' }}>Frequência</label>
          <select
            value={form.frequencia_horas}
            onChange={e => onChange({ ...form, frequencia_horas: parseInt(e.target.value) })}
            className="w-full px-2 py-1.5 rounded-lg text-xs"
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
          >
            <option value={0}>Enviar apenas 1x</option>
            <option value={12}>A cada 12 horas</option>
            <option value={24}>A cada 24 horas</option>
            <option value={48}>A cada 48 horas</option>
            <option value={72}>A cada 72 horas</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-[10px] font-medium mb-0.5 block" style={{ color: 'var(--text-tertiary)' }}>Mensagem</label>
        <textarea
          value={form.mensagem}
          onChange={e => onChange({ ...form, mensagem: e.target.value })}
          placeholder="Olá {{cliente_nome}}, sua OS {{numero_os}} está na etapa..."
          rows={3}
          className="w-full px-2 py-1.5 rounded-lg text-xs resize-y"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
        />
      </div>

      <div>
        <label className="text-[10px] font-medium mb-0.5 block" style={{ color: 'var(--text-tertiary)' }}>
          Unidades (vazio = todas)
        </label>
        <UnidadeSelector
          unidades={unidades}
          selected={form.unidade_ids}
          onChange={ids => onChange({ ...form, unidade_ids: ids })}
          accentColor={accentColor}
          compact
        />
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button onClick={onCancel} className="px-3 py-1.5 rounded-lg text-xs" style={{ color: 'var(--text-secondary)' }}>Cancelar</button>
        <button
          onClick={onSave}
          disabled={saving || !form.mensagem.trim()}
          className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50"
          style={{ background: accentColor }}
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
          Salvar
        </button>
      </div>
    </div>
  );
}

function UnidadeSelector({ unidades, selected, onChange, accentColor, compact }: {
  unidades: Unidade[];
  selected: string[] | null;
  onChange: (ids: string[] | null) => void;
  accentColor: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0, width: 0 });
  const isAll = selected === null;
  const sz = compact ? 'text-[10px]' : 'text-xs';

  useEffect(() => {
    if (open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setDropPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
    }
  }, [open]);

  return (
    <div className="relative">
      <button
        ref={btnRef}
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center gap-2 px-3 ${compact ? 'py-1.5' : 'py-2.5'} rounded-xl ${sz} text-left`}
        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
      >
        <span className="flex-1 truncate">
          {isAll ? 'Todas as unidades' : `${selected!.length} unidade(s) selecionada(s)`}
        </span>
        <ChevronDown className="w-3 h-3 flex-shrink-0" style={{ color: 'var(--text-tertiary)' }} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0" style={{ zIndex: 9998 }} onClick={() => setOpen(false)} />
          <div
            className="fixed rounded-xl max-h-48 overflow-auto shadow-2xl"
            style={{ zIndex: 9999, top: dropPos.top, left: dropPos.left, width: dropPos.width, background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
          >
            <button
              onClick={() => { onChange(null); setOpen(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2 ${sz} text-left hover:bg-white/5`}
              style={{ color: isAll ? accentColor : 'var(--text-primary)' }}
            >
              <div className="w-3.5 h-3.5 rounded border flex items-center justify-center" style={{ borderColor: isAll ? accentColor : 'var(--border-primary)', background: isAll ? accentColor : 'transparent' }}>
                {isAll && <span className="text-white text-[8px] font-bold">✓</span>}
              </div>
              Todas as unidades
            </button>
            {unidades.map(u => {
              const checked = selected?.includes(u.id);
              return (
                <button
                  key={u.id}
                  onClick={() => {
                    if (checked) {
                      const newIds = selected!.filter(id => id !== u.id);
                      onChange(newIds.length === 0 ? null : newIds);
                    } else {
                      onChange([...(selected || []), u.id]);
                    }
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 ${sz} text-left hover:bg-white/5`}
                  style={{ color: 'var(--text-primary)' }}
                >
                  <div className="w-3.5 h-3.5 rounded border flex items-center justify-center" style={{ borderColor: checked ? accentColor : 'var(--border-primary)', background: checked ? accentColor : 'transparent' }}>
                    {checked && <span className="text-white text-[8px] font-bold">✓</span>}
                  </div>
                  {u.nome}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}


