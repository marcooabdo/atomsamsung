import { useState, useEffect } from 'react';
import { CheckSquare, Plus, X, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface OSChecklistTabProps {
  osId: string;
  tipoOS: string;
  tipoAtendimento: string;
  unidadeId: string;
}

export function OSChecklistTab({ osId, tipoOS, tipoAtendimento, unidadeId }: OSChecklistTabProps) {
  const { usuario } = useAuth();
  const [checklistsVinculados, setChecklistsVinculados] = useState<any[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showJustificativaModal, setShowJustificativaModal] = useState(false);
  const [justificativaText, setJustificativaText] = useState('');
  const [checklistToRemove, setChecklistToRemove] = useState<{ id: string; nome: string } | null>(null);
  const [removendo, setRemovendo] = useState(false);

  useEffect(() => {
    loadChecklists();
  }, [osId]);

  const loadChecklists = async () => {
    setLoading(true);
    try {
      // Carregar checklists vinculados
      const { data: vinculados, error: errorVinculados } = await supabase
        .from('os_checklist_vinculados')
        .select(`
          *,
          checklist_template:checklist_templates(*)
        `)
        .eq('os_id', osId);

      setChecklistsVinculados(vinculados || []);

      // Carregar templates ADM disponíveis
      const { data: templates, error: errorTemplates } = await supabase
        .from('checklist_templates')
        .select('*')
        .eq('tipo_checklist', 'ADM')
        .eq('ativo', true)
        .or(`unidade_id.eq.${unidadeId},unidade_id.is.null`);

      setChecklistTemplates(templates || []);
    } catch (error) {
      // error loading checklists
    } finally {
      setLoading(false);
    }
  };

  const handleVincularChecklist = async (templateId: string) => {
    try {
      const template = checklistTemplates.find(t => t.id === templateId);
      const nomeChecklist = template?.nome || 'Checklist';

      const { data, error } = await supabase
        .from('os_checklist_vinculados')
        .insert({
          os_id: osId,
          checklist_template_id: templateId,
          vinculado_automaticamente: false,
          vinculado_por: usuario?.id,
          respostas: []
        })
        .select();

      if (error) {
        alert(`Erro ao vincular checklist: ${error.message}`);
        return;
      }

      setShowAddModal(false);
      await loadChecklists();

      await supabase.from('os_comentarios').insert({
        os_id: osId,
        usuario_id: usuario?.id,
        comentario: `${usuario?.nome} adicionou o checklist ADM "${nomeChecklist}" manualmente`,
        is_system: true
      });
    } catch (error) {
      alert('Erro ao vincular checklist');
    }
  };

  const handleRemoverChecklist = (vinculoId: string) => {
    const vinculo = checklistsVinculados.find(v => v.id === vinculoId);
    if (!vinculo) return;

    const template = vinculo.checklist_template;
    const nomeChecklist = template?.nome || 'Checklist';

    setChecklistToRemove({ id: vinculoId, nome: nomeChecklist });
    setJustificativaText('');
    setShowJustificativaModal(true);
  };

  const confirmarRemocao = async () => {
    if (!checklistToRemove) return;

    if (!justificativaText.trim() || justificativaText.trim().length < 10) {
      alert('A justificativa deve ter no mínimo 10 caracteres.');
      return;
    }

    setRemovendo(true);
    try {
      await supabase
        .from('os_checklist_vinculados')
        .delete()
        .eq('id', checklistToRemove.id);

      await loadChecklists();

      await supabase.from('os_comentarios').insert({
        os_id: osId,
        usuario_id: usuario?.id,
        comentario: `${usuario?.nome} REMOVEU o checklist ADM "${checklistToRemove.nome}"\n\nJustificativa: ${justificativaText}`,
        is_system: true
      });

      setShowJustificativaModal(false);
      setChecklistToRemove(null);
      setJustificativaText('');
    } catch (error) {
      alert('Erro ao remover checklist');
    } finally {
      setRemovendo(false);
    }
  };

  const handleToggleItem = async (vinculoId: string, itemOrdem: number, checked: boolean) => {
    try {
      const vinculo = checklistsVinculados.find(v => v.id === vinculoId);
      if (!vinculo) return;

      const template = vinculo.checklist_template;
      const item = template?.itens?.find((i: any) => i.ordem === itemOrdem);
      const itemTexto = item?.texto || `Item ${itemOrdem}`;
      const nomeChecklist = template?.nome || 'Checklist';

      const respostas = vinculo.respostas || [];
      const respostaExistente = respostas.find((r: any) => r.ordem === itemOrdem);

      // Se está tentando DESMARCAR um item que já estava marcado, exige justificativa
      if (respostaExistente?.checked && !checked) {
        const justificativa = prompt(`Por que você está desmarcando o item "${itemTexto}"?\n\nJustificativa:`);

        if (!justificativa || justificativa.trim() === '') {
          alert('Justificativa é obrigatória para desmarcar um item já marcado.');
          return;
        }

        let novasRespostas = respostas.map((r: any) =>
          r.ordem === itemOrdem
            ? {
                ...r,
                checked,
                updated_at: new Date().toISOString(),
                updated_by: usuario?.id,
                updated_by_name: usuario?.nome,
                justificativa_desmarcacao: justificativa
              }
            : r
        );

        await supabase
          .from('os_checklist_vinculados')
          .update({ respostas: novasRespostas })
          .eq('id', vinculoId);

        await supabase.from('os_comentarios').insert({
          os_id: osId,
          usuario_id: usuario?.id,
          comentario: `[CHECKLIST ADM "${nomeChecklist}"] ${usuario?.nome} DESMARCOU: "${itemTexto}"\n\nJustificativa: ${justificativa}`,
          is_system: true
        });

        await loadChecklists();
        return;
      }

      // Marcar item normalmente (sem justificativa)
      let novasRespostas;
      if (respostaExistente) {
        novasRespostas = respostas.map((r: any) =>
          r.ordem === itemOrdem
            ? { ...r, checked, updated_at: new Date().toISOString(), updated_by: usuario?.id, updated_by_name: usuario?.nome }
            : r
        );
      } else {
        novasRespostas = [
          ...respostas,
          {
            ordem: itemOrdem,
            checked,
            updated_at: new Date().toISOString(),
            updated_by: usuario?.id,
            updated_by_name: usuario?.nome
          }
        ];
      }

      await supabase
        .from('os_checklist_vinculados')
        .update({ respostas: novasRespostas })
        .eq('id', vinculoId);

      if (checked) {
        await supabase.from('os_comentarios').insert({
          os_id: osId,
          usuario_id: usuario?.id,
          comentario: `[CHECKLIST ADM "${nomeChecklist}"] ${usuario?.nome} MARCOU: "${itemTexto}"`,
          is_system: true
        });
      }

      await loadChecklists();
    } catch (error) {
      alert('Erro ao atualizar item do checklist');
    }
  };

  const templatesDisponiveis = checklistTemplates.filter(t => {
    // Não mostrar se já está vinculado
    if (checklistsVinculados.some(v => v.checklist_template_id === t.id)) {
      return false;
    }

    // Se não tem filtros definidos (null ou vazio), mostra para todos
    // Filtrar por tipo de OS apenas se houver filtros E houver tipo de OS na OS
    if (t.tipo_os && Array.isArray(t.tipo_os) && t.tipo_os.length > 0) {
      if (tipoOS && !t.tipo_os.includes(tipoOS)) {
        return false;
      }
    }

    // Filtrar por tipo de atendimento apenas se houver filtros E houver tipo de atendimento na OS
    if (t.tipos_atendimento && Array.isArray(t.tipos_atendimento) && t.tipos_atendimento.length > 0) {
      if (tipoAtendimento && !t.tipos_atendimento.includes(tipoAtendimento)) {
        return false;
      }
    }

    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="futuristic-loader"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-[#39FF14] uppercase tracking-wider flex items-center gap-2">
              <CheckSquare className="w-4 h-4" />
              Checklists Administrativos
            </h3>
            <p className="text-xs text-gray-400 mt-2">
              Checklists vinculados automaticamente e manualmente para esta OS
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="neon-button text-xs px-3 py-2 flex items-center gap-2"
            style={{
              backgroundColor: '#39FF1420',
              color: '#39FF14',
              borderColor: '#39FF1460'
            }}
          >
            <Plus className="w-4 h-4" />
            ADICIONAR
          </button>
        </div>
      </div>

      {checklistsVinculados.length === 0 ? (
        <div className="text-center py-12 premium-card">
          <CheckSquare className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm mb-2">Nenhum checklist vinculado</p>
          <p className="text-xs text-gray-600">
            Clique em "ADICIONAR" para vincular um checklist manualmente
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {checklistsVinculados.map((vinculo) => {
            const template = vinculo.checklist_template;
            if (!template) return null;

            const respostas = vinculo.respostas || [];

            return (
              <div key={vinculo.id} className="bg-[#0a0f1a] border border-gray-800 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-800">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="text-sm font-bold text-[#39FF14] uppercase tracking-wider">{template.nome}</h4>
                      {vinculo.vinculado_automaticamente && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          AUTOMÁTICO
                        </span>
                      )}
                    </div>
                  </div>
                  {!vinculo.vinculado_automaticamente && (
                    <button
                      onClick={() => handleRemoverChecklist(vinculo.id)}
                      className="text-red-400 hover:text-red-300 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="space-y-2">
                  {template.itens?.map((item: any) => {
                    const resposta = respostas.find((r: any) => r.ordem === item.ordem);
                    const checked = resposta?.checked || false;

                    return (
                      <div key={item.ordem} className="flex items-start gap-3 p-2 rounded hover:bg-white/5 transition-colors">
                        <button
                          onClick={() => handleToggleItem(vinculo.id, item.ordem, !checked)}
                          className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                            checked
                              ? 'bg-[#39FF14]/20 border-[#39FF14]'
                              : 'border-gray-500 hover:border-[#39FF14]'
                          }`}
                        >
                          {checked && <CheckSquare className="w-4 h-4 text-[#39FF14]" />}
                        </button>
                        <div className="flex-1">
                          <p className={`text-sm ${checked ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                            {item.texto}
                          </p>
                          {checked && resposta?.updated_at && (
                            <p className="text-xs text-gray-500 mt-1">
                              {resposta.updated_by_name || 'Usuario'} - {new Date(resposta.updated_at).toLocaleString('pt-BR')}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal para adicionar checklist */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100]">
          <div className="bg-[#0f1419] border border-[#39FF14]/40 rounded-lg w-full max-w-3xl max-h-[80vh] overflow-hidden shadow-2xl shadow-[#39FF14]/10">
            <div className="p-6 border-b border-[#39FF14]/30 bg-gradient-to-r from-[#0f1419] to-[#1a1f2e]">
              <div className="flex items-center justify-between">
                <h3 className="text-xl font-bold text-[#39FF14] uppercase tracking-wider">Adicionar Checklist</h3>
                <button
                  onClick={() => setShowAddModal(false)}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(80vh-100px)]">
              {templatesDisponiveis.length === 0 ? (
                <div className="text-center py-12">
                  <CheckSquare className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">
                    Todos os checklists disponíveis já foram vinculados
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {templatesDisponiveis.map((template) => (
                    <div
                      key={template.id}
                      className="bg-[#1a1f2e] border border-gray-700 rounded-lg p-5 hover:border-[#39FF14]/50 hover:shadow-lg hover:shadow-[#39FF14]/10 transition-all group"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-base font-bold text-gray-100 mb-2">{template.nome}</h4>
                          {template.descricao && (
                            <p className="text-sm text-gray-400 mb-3">{template.descricao}</p>
                          )}
                          <div className="flex gap-2 flex-wrap">
                            <span className="px-3 py-1 rounded text-xs font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
                              OS: {(template.tipo_os && template.tipo_os.length > 0) ? template.tipo_os.join(', ') : 'Todos'}
                            </span>
                            <span className="px-3 py-1 rounded text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/40">
                              Atend: {(template.tipos_atendimento && template.tipos_atendimento.length > 0) ? template.tipos_atendimento.join(', ') : 'Todos'}
                            </span>
                            <span className="px-3 py-1 rounded text-xs font-bold bg-purple-500/20 text-purple-400 border border-purple-500/40">
                              {template.itens?.length || 0} itens
                            </span>
                          </div>
                        </div>
                        <button
                          onClick={() => handleVincularChecklist(template.id)}
                          className="ml-4 w-10 h-10 rounded-lg bg-[#39FF14]/20 border border-[#39FF14]/40 flex items-center justify-center hover:bg-[#39FF14]/30 transition-colors group-hover:scale-110 transform"
                        >
                          <Plus className="w-5 h-5 text-[#39FF14]" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showJustificativaModal && checklistToRemove && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4">
          <div className="premium-card w-full max-w-lg">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-400" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white">Remover Checklist</h3>
                  <p className="text-sm text-gray-400">Por que você está removendo este checklist?</p>
                </div>
                <button
                  onClick={() => {
                    setShowJustificativaModal(false);
                    setChecklistToRemove(null);
                    setJustificativaText('');
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-[#1A1A1A] rounded-lg p-4 mb-4 border border-red-500/20">
                <p className="text-white font-bold mb-2">"{checklistToRemove.nome}"</p>
                <p className="text-gray-400 text-xs">
                  Esta ação não pode ser desfeita. Uma justificativa será registrada no histórico da OS.
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-bold text-white mb-2">
                  Justificativa *
                </label>
                <textarea
                  value={justificativaText}
                  onChange={(e) => setJustificativaText(e.target.value)}
                  placeholder="Descreva o motivo da remoção (mínimo 10 caracteres)..."
                  rows={4}
                  className="w-full px-4 py-3 bg-[#0a0f1a] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#00D4FF] focus:outline-none resize-none"
                  disabled={removendo}
                />
                <p className="text-xs text-gray-500 mt-1">
                  {justificativaText.length} / 10 caracteres mínimos
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowJustificativaModal(false);
                    setChecklistToRemove(null);
                    setJustificativaText('');
                  }}
                  disabled={removendo}
                  className="flex-1 px-6 py-3 border border-gray-700 rounded-lg text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarRemocao}
                  disabled={removendo || justificativaText.trim().length < 10}
                  className="flex-1 px-6 py-3 bg-red-500 text-white rounded-lg font-bold hover:bg-red-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {removendo ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Removendo...
                    </>
                  ) : (
                    <>
                      <Trash2 className="w-5 h-5" />
                      Confirmar Remoção
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
