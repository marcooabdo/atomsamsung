import { useState, useEffect } from 'react';
import { Plus, Trash2, CreditCard as Edit2, Save, X, Loader2, MessageSquare, List, ToggleLeft, ToggleRight, Clock, GripVertical, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  accentColor: string;
  unidadeId: string;
}

interface OpcaoAvaliacao {
  valor: string;
  label: string;
  resposta: string;
  acao: 'finalizar' | 'transferir' | 'reabrir';
  nps_score: number;
}

interface RegraFinalizacao {
  id: string;
  unidade_id: string;
  nome: string;
  mensagem_avaliacao: string;
  tipo_interacao: 'opcoes_numeradas' | 'botoes';
  opcoes: OpcaoAvaliacao[];
  timeout_minutos: number;
  mensagem_timeout: string;
  acao_timeout: string;
  ativo: boolean;
  is_default: boolean;
  created_at: string;
}

const ACOES_DISPONIVEIS = [
  { value: 'finalizar', label: 'Finalizar conversa' },
  { value: 'transferir', label: 'Transferir para atendente' },
  { value: 'reabrir', label: 'Manter conversa aberta' }
];

export function RegrasFinalizacaoManager({ accentColor, unidadeId }: Props) {
  const [regras, setRegras] = useState<RegraFinalizacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingRegra, setEditingRegra] = useState<RegraFinalizacao | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedRegra, setExpandedRegra] = useState<string | null>(null);

  const [form, setForm] = useState({
    nome: '',
    mensagem_avaliacao: '',
    tipo_interacao: 'opcoes_numeradas' as 'opcoes_numeradas' | 'botoes',
    opcoes: [] as OpcaoAvaliacao[],
    timeout_minutos: 60,
    mensagem_timeout: 'O tempo para avaliar expirou. Obrigado pelo contato!',
    acao_timeout: 'finalizar',
    ativo: true
  });

  useEffect(() => {
    loadRegras();
  }, [unidadeId]);

  const loadRegras = async () => {
    const { data } = await supabase
      .from('atom_connect_regras_finalizacao')
      .select('*')
      .eq('unidade_id', unidadeId)
      .order('created_at');

    if (data) {
      setRegras(data);
    }
    setLoading(false);
  };

  const openNewModal = () => {
    setEditingRegra(null);
    setForm({
      nome: '',
      mensagem_avaliacao: `Obrigado por entrar em contato! Por favor, avalie nosso atendimento:

1 - Muito Satisfeito
2 - Satisfeito
3 - Insatisfeito

Digite o numero correspondente a sua avaliacao.`,
      tipo_interacao: 'opcoes_numeradas',
      opcoes: [
        { valor: '1', label: 'Muito Satisfeito', resposta: 'Muito obrigado pela excelente avaliacao! Ficamos muito felizes em poder ajudar. Conte sempre conosco!', acao: 'finalizar', nps_score: 5 },
        { valor: '2', label: 'Satisfeito', resposta: 'Agradecemos seu feedback! Ficamos felizes em saber que conseguimos ajudar.', acao: 'finalizar', nps_score: 3 },
        { valor: '3', label: 'Insatisfeito', resposta: 'Obrigado pelo seu feedback. Lamentamos que sua experiencia nao tenha sido satisfatoria.', acao: 'finalizar', nps_score: 1 }
      ],
      timeout_minutos: 60,
      mensagem_timeout: 'O tempo para avaliar expirou. Obrigado pelo contato!',
      acao_timeout: 'finalizar',
      ativo: true
    });
    setShowModal(true);
  };

  const openEditModal = (regra: RegraFinalizacao) => {
    setEditingRegra(regra);
    setForm({
      nome: regra.nome,
      mensagem_avaliacao: regra.mensagem_avaliacao,
      tipo_interacao: regra.tipo_interacao,
      opcoes: regra.opcoes || [],
      timeout_minutos: regra.timeout_minutos || 60,
      mensagem_timeout: regra.mensagem_timeout || '',
      acao_timeout: regra.acao_timeout || 'finalizar',
      ativo: regra.ativo
    });
    setShowModal(true);
  };

  const addOpcao = () => {
    const novoValor = String(form.opcoes.length + 1);
    setForm(prev => ({
      ...prev,
      opcoes: [
        ...prev.opcoes,
        { valor: novoValor, label: '', resposta: '', acao: 'finalizar', nps_score: 3 }
      ]
    }));
  };

  const removeOpcao = (index: number) => {
    setForm(prev => ({
      ...prev,
      opcoes: prev.opcoes.filter((_, i) => i !== index)
    }));
  };

  const updateOpcao = (index: number, field: keyof OpcaoAvaliacao, value: string | number) => {
    setForm(prev => ({
      ...prev,
      opcoes: prev.opcoes.map((op, i) => i === index ? { ...op, [field]: value } : op)
    }));
  };

  const saveRegra = async () => {
    if (!form.nome.trim()) {
      alert('Digite um nome para a regra');
      return;
    }
    if (!form.mensagem_avaliacao.trim()) {
      alert('Digite a mensagem de avaliacao');
      return;
    }
    if (form.opcoes.length === 0) {
      alert('Adicione pelo menos uma opcao');
      return;
    }

    setSaving(true);

    const payload = {
      unidade_id: unidadeId,
      nome: form.nome.trim(),
      mensagem_avaliacao: form.mensagem_avaliacao.trim(),
      tipo_interacao: form.tipo_interacao,
      opcoes: form.opcoes,
      timeout_minutos: form.timeout_minutos,
      mensagem_timeout: form.mensagem_timeout.trim(),
      acao_timeout: form.acao_timeout,
      ativo: form.ativo
    };

    let error;
    if (editingRegra) {
      const result = await supabase
        .from('atom_connect_regras_finalizacao')
        .update(payload)
        .eq('id', editingRegra.id);
      error = result.error;
    } else {
      const result = await supabase
        .from('atom_connect_regras_finalizacao')
        .insert(payload);
      error = result.error;
    }

    if (error) {
      alert('Erro ao salvar: ' + error.message);
    } else {
      setShowModal(false);
      loadRegras();
    }

    setSaving(false);
  };

  const toggleAtivo = async (regra: RegraFinalizacao) => {
    await supabase
      .from('atom_connect_regras_finalizacao')
      .update({ ativo: !regra.ativo })
      .eq('id', regra.id);
    loadRegras();
  };

  const setAsDefault = async (regra: RegraFinalizacao) => {
    await supabase
      .from('atom_connect_regras_finalizacao')
      .update({ is_default: false })
      .eq('unidade_id', unidadeId);

    await supabase
      .from('atom_connect_regras_finalizacao')
      .update({ is_default: true })
      .eq('id', regra.id);

    loadRegras();
  };

  const deleteRegra = async (regra: RegraFinalizacao) => {
    if (!confirm(`Tem certeza que deseja excluir a regra "${regra.nome}"?`)) return;

    const { error } = await supabase
      .from('atom_connect_regras_finalizacao')
      .delete()
      .eq('id', regra.id);

    if (error) {
      alert('Erro ao excluir: ' + error.message);
    } else {
      loadRegras();
    }
  };

  const generatePreviewMessage = () => {
    if (form.tipo_interacao === 'opcoes_numeradas') {
      let preview = form.mensagem_avaliacao;
      return preview;
    }
    return form.mensagem_avaliacao;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Regras de Finalizacao</h3>
          <p className="text-sm text-gray-400">Configure mensagens de avaliação enviadas ao cliente</p>
        </div>
        <button
          onClick={openNewModal}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            backgroundColor: `${accentColor}20`,
            color: accentColor,
            border: `1px solid ${accentColor}40`
          }}
        >
          <Plus className="w-4 h-4" />
          Nova Regra
        </button>
      </div>

      {regras.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-gray-500">
          <MessageSquare className="w-16 h-16 mb-4 opacity-50" />
          <p className="text-lg">Nenhuma regra configurada</p>
          <p className="text-sm mt-2 text-center max-w-md">
            Crie regras para enviar mensagens de avaliacao ao cliente quando finalizar uma conversa
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {regras.map(regra => (
            <div
              key={regra.id}
              className="rounded-xl bg-white/5 border border-white/10 overflow-hidden"
            >
              <div
                className="flex items-center gap-4 p-4 cursor-pointer hover:bg-white/[0.03] transition-colors"
                onClick={() => setExpandedRegra(expandedRegra === regra.id ? null : regra.id)}
              >
                <button
                  onClick={(e) => { e.stopPropagation(); toggleAtivo(regra); }}
                  className="flex-shrink-0"
                  title={regra.ativo ? 'Desativar' : 'Ativar'}
                >
                  {regra.ativo ? (
                    <ToggleRight className="w-6 h-6" style={{ color: accentColor }} />
                  ) : (
                    <ToggleLeft className="w-6 h-6 text-gray-500" />
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="font-medium text-white">{regra.nome}</h4>
                    {regra.is_default && (
                      <span
                        className="text-[10px] px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                      >
                        PADRAO
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {regra.opcoes.length} opções - {regra.tipo_interacao === 'botoes' ? 'Botões' : 'Opções numeradas'}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {!regra.is_default && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setAsDefault(regra); }}
                      className="px-3 py-1.5 text-[11px] rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
                    >
                      Definir como padrao
                    </button>
                  )}
                  <button
                    onClick={(e) => { e.stopPropagation(); openEditModal(regra); }}
                    className="p-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={(e) => { e.stopPropagation(); deleteRegra(regra); }}
                    className="p-2 rounded-lg bg-white/5 text-gray-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {expandedRegra === regra.id ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </div>
              </div>

              <AnimatePresence>
                {expandedRegra === regra.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="border-t border-white/10"
                  >
                    <div className="p-4 space-y-4">
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Mensagem enviada ao cliente:</p>
                        <div className="p-3 bg-black/30 rounded-lg text-sm text-gray-300 whitespace-pre-wrap">
                          {regra.mensagem_avaliacao}
                        </div>
                      </div>

                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Opções de resposta:</p>
                        <div className="space-y-2">
                          {regra.opcoes.map((opcao, i) => (
                            <div key={i} className="flex items-start gap-3 p-3 bg-black/20 rounded-lg">
                              <span
                                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                                style={{ backgroundColor: `${accentColor}30`, color: accentColor }}
                              >
                                {opcao.valor}
                              </span>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm text-white font-medium">{opcao.label}</p>
                                <p className="text-xs text-gray-400 mt-1">{opcao.resposta}</p>
                                <div className="flex items-center gap-3 mt-2 text-[10px]">
                                  <span className="text-gray-500">
                                    Acao: <span className="text-gray-300">{ACOES_DISPONIVEIS.find(a => a.value === opcao.acao)?.label}</span>
                                  </span>
                                  <span className="text-gray-500">
                                    NPS: <span className="text-gray-300">{opcao.nps_score}</span>
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Timeout: {regra.timeout_minutos} minutos</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1A1A2E] rounded-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex-shrink-0 px-6 py-4 border-b border-white/10 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${accentColor}20` }}>
                    <MessageSquare className="w-5 h-5" style={{ color: accentColor }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white">
                      {editingRegra ? 'Editar Regra' : 'Nova Regra de Finalizacao'}
                    </h3>
                    <p className="text-xs text-gray-400">Configure a mensagem de avaliação</p>
                  </div>
                </div>
                <button
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Nome da Regra *</label>
                    <input
                      type="text"
                      value={form.nome}
                      onChange={(e) => setForm(prev => ({ ...prev, nome: e.target.value }))}
                      placeholder="Ex: Avaliacao Padrao"
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Tipo de Interacao</label>
                    <select
                      value={form.tipo_interacao}
                      onChange={(e) => setForm(prev => ({ ...prev, tipo_interacao: e.target.value as any }))}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-white/20"
                    >
                      <option value="opcoes_numeradas" className="bg-[#1A1A2E]">Opções Numeradas (1, 2, 3...)</option>
                      <option value="botoes" className="bg-[#1A1A2E]">Botoes do WhatsApp</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">
                    Mensagem de Avaliação *
                  </label>
                  <textarea
                    value={form.mensagem_avaliacao}
                    onChange={(e) => setForm(prev => ({ ...prev, mensagem_avaliacao: e.target.value }))}
                    placeholder="Digite a mensagem que será enviada ao cliente..."
                    rows={5}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20 resize-none"
                  />
                  <p className="text-[10px] text-gray-500 mt-1">
                    Inclua as opções na mensagem se estiver usando opções numeradas
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-3">
                    <label className="text-sm font-medium text-gray-400">
                      Opções de Resposta ({form.opcoes.length})
                    </label>
                    <button
                      onClick={addOpcao}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      style={{
                        backgroundColor: `${accentColor}20`,
                        color: accentColor
                      }}
                    >
                      <Plus className="w-3 h-3" />
                      Adicionar
                    </button>
                  </div>

                  <div className="space-y-3">
                    {form.opcoes.map((opcao, index) => (
                      <div key={index} className="p-4 bg-white/[0.03] border border-white/10 rounded-xl space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                              style={{ backgroundColor: `${accentColor}30`, color: accentColor }}
                            >
                              {index + 1}
                            </span>
                            <span className="text-sm font-medium text-white">Opção {index + 1}</span>
                          </div>
                          <button
                            onClick={() => removeOpcao(index)}
                            className="p-1.5 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] text-gray-500 mb-1">Valor (o que o cliente digita)</label>
                            <input
                              type="text"
                              value={opcao.valor}
                              onChange={(e) => updateOpcao(index, 'valor', e.target.value)}
                              placeholder="1"
                              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20"
                            />
                          </div>
                          <div>
                            <label className="block text-[11px] text-gray-500 mb-1">Label (nome da opção)</label>
                            <input
                              type="text"
                              value={opcao.label}
                              onChange={(e) => updateOpcao(index, 'label', e.target.value)}
                              placeholder="Muito Satisfeito"
                              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] text-gray-500 mb-1">Resposta (mensagem enviada ao cliente)</label>
                          <textarea
                            value={opcao.resposta}
                            onChange={(e) => updateOpcao(index, 'resposta', e.target.value)}
                            placeholder="Obrigado pelo seu feedback!"
                            rows={2}
                            className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20 resize-none"
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] text-gray-500 mb-1">Ação após resposta</label>
                            <select
                              value={opcao.acao}
                              onChange={(e) => updateOpcao(index, 'acao', e.target.value)}
                              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-white/20"
                            >
                              {ACOES_DISPONIVEIS.map(a => (
                                <option key={a.value} value={a.value} className="bg-[#1A1A2E]">{a.label}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] text-gray-500 mb-1">Score NPS (1-5)</label>
                            <input
                              type="number"
                              min="1"
                              max="5"
                              value={opcao.nps_score}
                              onChange={(e) => updateOpcao(index, 'nps_score', parseInt(e.target.value) || 1)}
                              className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-white/20"
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Timeout (minutos)</label>
                    <input
                      type="number"
                      value={form.timeout_minutos}
                      onChange={(e) => setForm(prev => ({ ...prev, timeout_minutos: parseInt(e.target.value) || 60 }))}
                      min="1"
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-white/20"
                    />
                    <p className="text-[10px] text-gray-500 mt-1">Tempo maximo para o cliente responder</p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Acao no Timeout</label>
                    <select
                      value={form.acao_timeout}
                      onChange={(e) => setForm(prev => ({ ...prev, acao_timeout: e.target.value }))}
                      className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-white/20"
                    >
                      {ACOES_DISPONIVEIS.map(a => (
                        <option key={a.value} value={a.value} className="bg-[#1A1A2E]">{a.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Mensagem de Timeout</label>
                  <textarea
                    value={form.mensagem_timeout}
                    onChange={(e) => setForm(prev => ({ ...prev, mensagem_timeout: e.target.value }))}
                    placeholder="Mensagem enviada quando o tempo expira..."
                    rows={2}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20 resize-none"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setForm(prev => ({ ...prev, ativo: !prev.ativo }))}
                    className="flex items-center gap-2"
                  >
                    {form.ativo ? (
                      <ToggleRight className="w-6 h-6" style={{ color: accentColor }} />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-gray-500" />
                    )}
                    <span className="text-sm text-gray-300">
                      {form.ativo ? 'Regra ativa' : 'Regra inativa'}
                    </span>
                  </button>
                </div>
              </div>

              <div className="flex-shrink-0 px-6 py-4 border-t border-white/10 flex items-center justify-end gap-3">
                <button
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2.5 bg-white/10 rounded-lg text-sm text-gray-400 hover:bg-white/20 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveRegra}
                  disabled={saving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-colors"
                  style={{ backgroundColor: accentColor, color: '#000' }}
                >
                  {saving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      Salvar Regra
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
