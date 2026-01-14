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

  useEffect(() => {
    loadChecklists();
  }, [osId]);

  const loadChecklists = async () => {
    setLoading(true);
    try {
      // Carregar checklists vinculados
      const { data: vinculados } = await supabase
        .from('os_checklist_vinculados')
        .select(`
          *,
          checklist_template:checklist_templates(*)
        `)
        .eq('os_id', osId);

      setChecklistsVinculados(vinculados || []);

      // Carregar templates ADM disponíveis
      const { data: templates } = await supabase
        .from('checklist_templates')
        .select('*')
        .eq('tipo_checklist', 'ADM')
        .eq('ativo', true)
        .or(`unidade_id.eq.${unidadeId},unidade_id.is.null`);

      setChecklistTemplates(templates || []);

      // Vincular automaticamente checklists que se aplicam
      for (const template of templates || []) {
        const jaVinculado = vinculados?.some(v => v.checklist_template_id === template.id);
        if (!jaVinculado &&
            template.tipo_os?.includes(tipoOS) &&
            template.tipos_atendimento?.includes(tipoAtendimento)) {
          await supabase
            .from('os_checklist_vinculados')
            .insert({
              os_id: osId,
              checklist_template_id: template.id,
              vinculado_automaticamente: true,
              vinculado_por: usuario?.id
            });
        }
      }

      // Recarregar vinculados após adicionar automaticamente
      const { data: vinculadosAtualizados } = await supabase
        .from('os_checklist_vinculados')
        .select(`
          *,
          checklist_template:checklist_templates(*)
        `)
        .eq('os_id', osId);

      setChecklistsVinculados(vinculadosAtualizados || []);
    } catch (error) {
      console.error('Erro ao carregar checklists:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVincularChecklist = async (templateId: string) => {
    try {
      await supabase
        .from('os_checklist_vinculados')
        .insert({
          os_id: osId,
          checklist_template_id: templateId,
          vinculado_automaticamente: false,
          vinculado_por: usuario?.id
        });

      await loadChecklists();
      setShowAddModal(false);

      await supabase.from('os_comentarios').insert({
        os_id: osId,
        usuario_id: usuario?.id,
        comentario: `${usuario?.nome} adicionou um checklist manualmente`,
        is_system: true
      });
    } catch (error) {
      alert('Erro ao vincular checklist');
    }
  };

  const handleRemoverChecklist = async (vinculoId: string) => {
    if (!confirm('Deseja remover este checklist?')) return;

    try {
      await supabase
        .from('os_checklist_vinculados')
        .delete()
        .eq('id', vinculoId);

      await loadChecklists();

      await supabase.from('os_comentarios').insert({
        os_id: osId,
        usuario_id: usuario?.id,
        comentario: `${usuario?.nome} removeu um checklist`,
        is_system: true
      });
    } catch (error) {
      alert('Erro ao remover checklist');
    }
  };

  const handleToggleItem = async (vinculoId: string, itemOrdem: number, checked: boolean) => {
    try {
      const vinculo = checklistsVinculados.find(v => v.id === vinculoId);
      if (!vinculo) return;

      const respostas = vinculo.respostas || [];
      const respostaExistente = respostas.find((r: any) => r.ordem === itemOrdem);

      let novasRespostas;
      if (respostaExistente) {
        novasRespostas = respostas.map((r: any) =>
          r.ordem === itemOrdem
            ? { ...r, checked, updated_at: new Date().toISOString(), updated_by: usuario?.id }
            : r
        );
      } else {
        novasRespostas = [
          ...respostas,
          {
            ordem: itemOrdem,
            checked,
            updated_at: new Date().toISOString(),
            updated_by: usuario?.id
          }
        ];
      }

      await supabase
        .from('os_checklist_vinculados')
        .update({ respostas: novasRespostas })
        .eq('id', vinculoId);

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

    // Filtrar por tipo de OS
    if (t.tipo_os && t.tipo_os.length > 0 && !t.tipo_os.includes(tipoOS)) {
      return false;
    }

    // Filtrar por tipo de atendimento
    if (t.tipos_atendimento && t.tipos_atendimento.length > 0 && !t.tipos_atendimento.includes(tipoAtendimento)) {
      return false;
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
              <div key={vinculo.id} className="premium-card p-4">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h4 className="text-sm font-bold text-[#39FF14]">{template.nome}</h4>
                      {vinculo.vinculado_automaticamente && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                          AUTOMÁTICO
                        </span>
                      )}
                    </div>
                    {template.descricao && (
                      <p className="text-xs text-gray-400 mt-1">{template.descricao}</p>
                    )}
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
                              Concluído em {new Date(resposta.updated_at).toLocaleString('pt-BR')}
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
          <div className="bg-[#1a1f2e] border border-[#39FF14]/30 rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-[#39FF14]/20">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-[#39FF14]">Adicionar Checklist</h3>
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
                <div className="space-y-3">
                  {templatesDisponiveis.map((template) => (
                    <div
                      key={template.id}
                      className="premium-card p-4 hover:border-[#39FF14]/50 transition-all cursor-pointer"
                      onClick={() => handleVincularChecklist(template.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h4 className="text-sm font-bold text-gray-200">{template.nome}</h4>
                          {template.descricao && (
                            <p className="text-xs text-gray-400 mt-1">{template.descricao}</p>
                          )}
                          <div className="flex gap-2 mt-2 flex-wrap">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
                              OS: {template.tipo_os?.join(', ') || 'Todos'}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                              Atend: {template.tipos_atendimento?.join(', ') || 'Todos'}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-400 border border-purple-500/30">
                              {template.itens?.length || 0} itens
                            </span>
                          </div>
                        </div>
                        <Plus className="w-5 h-5 text-[#39FF14] flex-shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
