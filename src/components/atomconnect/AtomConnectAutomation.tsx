import { useState, useEffect } from 'react';
import {
  GitBranch, Plus, Play, Pause, Trash2, Edit2, MessageSquare,
  Clock, ArrowRight, Zap, Bot, Settings, ChevronRight, X,
  Save, Copy, AlertTriangle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  accentColor: string;
}

interface Fluxo {
  id: string;
  nome: string;
  descricao: string | null;
  trigger_type: string;
  trigger_value: string | null;
  steps: FluxoStep[];
  is_active: boolean;
  created_at: string;
}

interface FluxoStep {
  id: string;
  type: 'message' | 'delay' | 'condition' | 'move_column' | 'assign';
  content?: string;
  delay_seconds?: number;
  column_id?: string;
  condition?: {
    field: string;
    operator: string;
    value: string;
  };
}

export function AtomConnectAutomation({ accentColor }: Props) {
  const { unidadeAtual } = useAuth();
  const [fluxos, setFluxos] = useState<Fluxo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showEditor, setShowEditor] = useState(false);
  const [editingFluxo, setEditingFluxo] = useState<Fluxo | null>(null);
  const [colunas, setColunas] = useState<{ id: string; nome: string }[]>([]);

  const [newFluxo, setNewFluxo] = useState({
    nome: '',
    descricao: '',
    trigger_type: 'keyword' as 'keyword' | 'regex' | 'webhook' | 'manual' | 'coluna_change',
    trigger_value: '',
    steps: [] as FluxoStep[]
  });

  useEffect(() => {
    loadFluxos();
    loadColunas();
  }, [unidadeAtual]);

  const loadFluxos = async () => {
    const { data, error } = await supabase
      .from('atom_connect_fluxos')
      .select('*')
      .or(`unidade_id.is.null,unidade_id.eq.${unidadeAtual}`)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setFluxos(data);
    }
    setLoading(false);
  };

  const loadColunas = async () => {
    const { data } = await supabase
      .from('atom_connect_pipeline_colunas')
      .select('id, nome')
      .order('ordem');
    if (data) setColunas(data);
  };

  const addStep = (type: FluxoStep['type']) => {
    const step: FluxoStep = {
      id: crypto.randomUUID(),
      type,
      content: type === 'message' ? '' : undefined,
      delay_seconds: type === 'delay' ? 5 : undefined,
      column_id: type === 'move_column' ? colunas[0]?.id : undefined
    };
    setNewFluxo(prev => ({ ...prev, steps: [...prev.steps, step] }));
  };

  const updateStep = (stepId: string, updates: Partial<FluxoStep>) => {
    setNewFluxo(prev => ({
      ...prev,
      steps: prev.steps.map(s => s.id === stepId ? { ...s, ...updates } : s)
    }));
  };

  const removeStep = (stepId: string) => {
    setNewFluxo(prev => ({
      ...prev,
      steps: prev.steps.filter(s => s.id !== stepId)
    }));
  };

  const saveFluxo = async () => {
    if (!newFluxo.nome || newFluxo.steps.length === 0) {
      alert('Preencha o nome e adicione pelo menos um passo');
      return;
    }

    if (editingFluxo) {
      await supabase
        .from('atom_connect_fluxos')
        .update({
          nome: newFluxo.nome,
          descricao: newFluxo.descricao,
          trigger_type: newFluxo.trigger_type,
          trigger_value: newFluxo.trigger_value,
          steps: newFluxo.steps
        })
        .eq('id', editingFluxo.id);
    } else {
      await supabase
        .from('atom_connect_fluxos')
        .insert({
          unidade_id: unidadeAtual,
          nome: newFluxo.nome,
          descricao: newFluxo.descricao,
          trigger_type: newFluxo.trigger_type,
          trigger_value: newFluxo.trigger_value,
          steps: newFluxo.steps
        });
    }

    setShowEditor(false);
    setEditingFluxo(null);
    setNewFluxo({
      nome: '',
      descricao: '',
      trigger_type: 'keyword',
      trigger_value: '',
      steps: []
    });
    loadFluxos();
  };

  const toggleFluxo = async (id: string, isActive: boolean) => {
    await supabase
      .from('atom_connect_fluxos')
      .update({ is_active: !isActive })
      .eq('id', id);
    loadFluxos();
  };

  const deleteFluxo = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este fluxo?')) return;
    await supabase
      .from('atom_connect_fluxos')
      .delete()
      .eq('id', id);
    loadFluxos();
  };

  const editFluxo = (fluxo: Fluxo) => {
    setEditingFluxo(fluxo);
    setNewFluxo({
      nome: fluxo.nome,
      descricao: fluxo.descricao || '',
      trigger_type: fluxo.trigger_type as any,
      trigger_value: fluxo.trigger_value || '',
      steps: fluxo.steps || []
    });
    setShowEditor(true);
  };

  const getTriggerLabel = (type: string) => {
    switch (type) {
      case 'keyword': return 'Palavra-chave';
      case 'regex': return 'Expressao Regular';
      case 'webhook': return 'Webhook';
      case 'manual': return 'Disparo Manual';
      case 'coluna_change': return 'Mudanca de Coluna';
      default: return type;
    }
  };

  const getStepIcon = (type: string) => {
    switch (type) {
      case 'message': return MessageSquare;
      case 'delay': return Clock;
      case 'condition': return GitBranch;
      case 'move_column': return ArrowRight;
      case 'assign': return Settings;
      default: return Zap;
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Automacao & Fluxos</h2>
          <p className="text-sm text-gray-400">Configure respostas automaticas e fluxos do bot</p>
        </div>
        <button
          onClick={() => {
            setEditingFluxo(null);
            setNewFluxo({
              nome: '',
              descricao: '',
              trigger_type: 'keyword',
              trigger_value: '',
              steps: []
            });
            setShowEditor(true);
          }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            backgroundColor: `${accentColor}20`,
            color: accentColor,
            border: `1px solid ${accentColor}40`
          }}
        >
          <Plus className="w-4 h-4" />
          Novo Fluxo
        </button>
      </div>

      {/* Flows List */}
      <div className="flex-1 overflow-y-auto p-6">
        {fluxos.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <Bot className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg">Nenhum fluxo criado</p>
            <p className="text-sm mt-2">Crie seu primeiro fluxo de automacao</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {fluxos.map(fluxo => (
              <motion.div
                key={fluxo.id}
                layout
                className="p-5 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: `${accentColor}20` }}
                    >
                      <Bot className="w-5 h-5" style={{ color: accentColor }} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">{fluxo.nome}</h3>
                      <p className="text-xs text-gray-400">{getTriggerLabel(fluxo.trigger_type)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => toggleFluxo(fluxo.id, fluxo.is_active)}
                      className={`p-1.5 rounded-lg transition-colors ${
                        fluxo.is_active
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-white/5 text-gray-500'
                      }`}
                    >
                      {fluxo.is_active ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => editFluxo(fluxo)}
                      className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => deleteFluxo(fluxo.id)}
                      className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {fluxo.descricao && (
                  <p className="text-sm text-gray-400 mt-3">{fluxo.descricao}</p>
                )}

                {/* Steps Preview */}
                <div className="mt-4 flex items-center gap-2 flex-wrap">
                  {(fluxo.steps || []).slice(0, 5).map((step, index) => {
                    const Icon = getStepIcon(step.type);
                    return (
                      <div
                        key={step.id}
                        className="flex items-center gap-1 px-2 py-1 rounded-full bg-white/5 text-xs text-gray-400"
                      >
                        <Icon className="w-3 h-3" />
                        {step.type === 'message' && 'Mensagem'}
                        {step.type === 'delay' && `${step.delay_seconds}s`}
                        {step.type === 'move_column' && 'Mover'}
                      </div>
                    );
                  })}
                  {(fluxo.steps || []).length > 5 && (
                    <span className="text-xs text-gray-500">
                      +{(fluxo.steps || []).length - 5} mais
                    </span>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* Flow Editor Modal */}
      <AnimatePresence>
        {showEditor && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6"
            onClick={() => setShowEditor(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1A1A2E] rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white">
                  {editingFluxo ? 'Editar Fluxo' : 'Novo Fluxo de Automacao'}
                </h3>
                <button
                  onClick={() => setShowEditor(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Nome do Fluxo *
                    </label>
                    <input
                      type="text"
                      value={newFluxo.nome}
                      onChange={(e) => setNewFluxo(prev => ({ ...prev, nome: e.target.value }))}
                      placeholder="Ex: Boas vindas"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Descricao
                    </label>
                    <input
                      type="text"
                      value={newFluxo.descricao}
                      onChange={(e) => setNewFluxo(prev => ({ ...prev, descricao: e.target.value }))}
                      placeholder="Descricao do fluxo"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20"
                    />
                  </div>
                </div>

                {/* Trigger */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Gatilho de Ativacao
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <select
                      value={newFluxo.trigger_type}
                      onChange={(e) => setNewFluxo(prev => ({ ...prev, trigger_type: e.target.value as any }))}
                      className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-white/20"
                    >
                      <option value="keyword">Palavra-chave</option>
                      <option value="regex">Expressao Regular</option>
                      <option value="manual">Disparo Manual</option>
                      <option value="coluna_change">Mudanca de Coluna</option>
                    </select>
                    {(newFluxo.trigger_type === 'keyword' || newFluxo.trigger_type === 'regex') && (
                      <input
                        type="text"
                        value={newFluxo.trigger_value}
                        onChange={(e) => setNewFluxo(prev => ({ ...prev, trigger_value: e.target.value }))}
                        placeholder={newFluxo.trigger_type === 'keyword' ? 'Ex: oi, ola, bom dia' : 'Ex: ^(oi|ola)'}
                        className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20"
                      />
                    )}
                    {newFluxo.trigger_type === 'coluna_change' && (
                      <select
                        value={newFluxo.trigger_value}
                        onChange={(e) => setNewFluxo(prev => ({ ...prev, trigger_value: e.target.value }))}
                        className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-white/20"
                      >
                        <option value="">Selecione a coluna</option>
                        {colunas.map(col => (
                          <option key={col.id} value={col.id}>{col.nome}</option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>

                {/* Steps */}
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Passos do Fluxo
                  </label>
                  <div className="space-y-3">
                    {newFluxo.steps.map((step, index) => {
                      const Icon = getStepIcon(step.type);
                      return (
                        <div
                          key={step.id}
                          className="p-4 bg-white/5 border border-white/10 rounded-lg"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs text-gray-400">
                                {index + 1}
                              </span>
                              <Icon className="w-4 h-4" style={{ color: accentColor }} />
                              <span className="text-sm text-white capitalize">{step.type}</span>
                            </div>
                            <button
                              onClick={() => removeStep(step.id)}
                              className="p-1 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>

                          {step.type === 'message' && (
                            <textarea
                              value={step.content || ''}
                              onChange={(e) => updateStep(step.id, { content: e.target.value })}
                              placeholder="Digite a mensagem..."
                              rows={3}
                              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20 resize-none"
                            />
                          )}

                          {step.type === 'delay' && (
                            <div className="flex items-center gap-3">
                              <input
                                type="number"
                                value={step.delay_seconds || 5}
                                onChange={(e) => updateStep(step.id, { delay_seconds: Number(e.target.value) })}
                                min={1}
                                max={300}
                                className="w-24 px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-white/20"
                              />
                              <span className="text-sm text-gray-400">segundos</span>
                            </div>
                          )}

                          {step.type === 'move_column' && (
                            <select
                              value={step.column_id || ''}
                              onChange={(e) => updateStep(step.id, { column_id: e.target.value })}
                              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-white/20"
                            >
                              {colunas.map(col => (
                                <option key={col.id} value={col.id}>{col.nome}</option>
                              ))}
                            </select>
                          )}
                        </div>
                      );
                    })}

                    {/* Add Step Buttons */}
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => addStep('message')}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 transition-colors text-sm"
                      >
                        <MessageSquare className="w-4 h-4" />
                        Mensagem
                      </button>
                      <button
                        onClick={() => addStep('delay')}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 transition-colors text-sm"
                      >
                        <Clock className="w-4 h-4" />
                        Delay
                      </button>
                      <button
                        onClick={() => addStep('move_column')}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 transition-colors text-sm"
                      >
                        <ArrowRight className="w-4 h-4" />
                        Mover Coluna
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-white/10 flex justify-end gap-3">
                <button
                  onClick={() => setShowEditor(false)}
                  className="px-4 py-2 bg-white/10 rounded-lg text-sm text-gray-400 hover:bg-white/20 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveFluxo}
                  className="flex items-center gap-2 px-6 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    backgroundColor: accentColor,
                    color: '#000'
                  }}
                >
                  <Save className="w-4 h-4" />
                  Salvar Fluxo
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
