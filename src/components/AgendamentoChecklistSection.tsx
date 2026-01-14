import { useState, useEffect } from 'react';
import { CheckSquare, Plus, X, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface AgendamentoChecklistSectionProps {
  agendamentoId: string | null;
  unidadeId: string;
  tipoOS?: string;
  tipoAtendimento?: string;
  osId?: string;
}

export function AgendamentoChecklistSection({ agendamentoId, unidadeId, tipoOS, tipoAtendimento, osId }: AgendamentoChecklistSectionProps) {
  const { usuario } = useAuth();
  const [checklistsVinculados, setChecklistsVinculados] = useState<any[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<any[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (agendamentoId) {
      loadChecklists();
    }
  }, [agendamentoId]);

  const loadChecklists = async () => {
    if (!agendamentoId) return;

    setLoading(true);
    try {
      console.log('Carregando checklists para agendamento:', agendamentoId, 'tipo OS:', tipoOS, 'atendimento:', tipoAtendimento);

      // Carregar checklists vinculados do agendamento (técnico)
      const { data: vinculados, error: errorVinculados } = await supabase
        .from('agendamento_checklist_vinculados')
        .select(`
          *,
          checklist_template:checklist_templates(*)
        `)
        .eq('agendamento_id', agendamentoId);

      if (errorVinculados) {
        console.error('Erro ao carregar vinculados:', errorVinculados);
      }

      console.log('Checklists técnicos vinculados:', vinculados);
      setChecklistsVinculados(vinculados || []);

    
      // Carregar templates TÉCNICO disponíveis
      const { data: templates, error: errorTemplates } = await supabase
        .from('checklist_templates')
        .select('*')
        .eq('tipo_checklist', 'TÉCNICO')
        .eq('ativo', true)
        .or(`unidade_id.eq.${unidadeId},unidade_id.is.null`);

      if (errorTemplates) {
        console.error('Erro ao carregar templates:', errorTemplates);
      }

      console.log('Templates técnicos disponíveis:', templates);
      setChecklistTemplates(templates || []);
    } catch (error) {
      console.error('Erro ao carregar checklists:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVincularChecklist = async (templateId: string) => {
    if (!agendamentoId) return;

    try {
      console.log('Vinculando checklist técnico:', templateId, 'para agendamento:', agendamentoId);

      const { data, error } = await supabase
        .from('agendamento_checklist_vinculados')
        .insert({
          agendamento_id: agendamentoId,
          checklist_template_id: templateId,
          vinculado_por: usuario?.id,
          respostas: []
        })
        .select();

      if (error) {
        console.error('Erro ao inserir vínculo:', error);
        alert(`Erro ao vincular checklist: ${error.message}`);
        return;
      }

      console.log('Checklist vinculado com sucesso:', data);

      setShowAddModal(false);
      await loadChecklists();
    } catch (error) {
      console.error('Erro ao vincular checklist:', error);
      alert('Erro ao vincular checklist');
    }
  };

  const handleRemoverChecklist = async (vinculoId: string) => {
    if (!confirm('Deseja remover este checklist?')) return;

    try {
      await supabase
        .from('agendamento_checklist_vinculados')
        .delete()
        .eq('id', vinculoId);

      await loadChecklists();
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
        .from('agendamento_checklist_vinculados')
        .update({ respostas: novasRespostas })
        .eq('id', vinculoId);

      await loadChecklists();
    } catch (error) {
      alert('Erro ao atualizar item do checklist');
    }
  };

  const templatesDisponiveis = checklistTemplates.filter(t => {
    console.log('Avaliando template técnico:', t.nome, {
      tipo_os: t.tipo_os,
      tipos_atendimento: t.tipos_atendimento,
      osAtual: tipoOS,
      atendimentoAtual: tipoAtendimento
    });

    // Não mostrar se já está vinculado
    if (checklistsVinculados.some(v => v.checklist_template_id === t.id)) {
      console.log('Template já vinculado:', t.nome);
      return false;
    }

    // Filtrar por tipo de OS
    if (tipoOS && t.tipo_os && t.tipo_os.length > 0 && !t.tipo_os.includes(tipoOS)) {
      console.log('Template filtrado por tipo_os:', t.nome);
      return false;
    }

    // Filtrar por tipo de atendimento
    if (tipoAtendimento && t.tipos_atendimento && t.tipos_atendimento.length > 0 && !t.tipos_atendimento.includes(tipoAtendimento)) {
      console.log('Template filtrado por tipos_atendimento:', t.nome);
      return false;
    }

    console.log('Template técnico disponível:', t.nome);
    return true;
  });

  console.log('Total templates técnicos disponíveis:', templatesDisponiveis.length);

  if (!agendamentoId) {
    return (
      <div className="premium-card p-6 text-center">
        <CheckSquare className="w-12 h-12 text-gray-600 mx-auto mb-3" />
        <p className="text-gray-500 text-sm">
          Crie um agendamento para vincular checklists técnicos
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="futuristic-loader"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Checklists Tecnicos do Agendamento - Editaveis */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-[#00D4FF] uppercase tracking-wider">
            Checklists Técnicos
          </h4>
          <p className="text-xs text-gray-400 mt-1">
            Checklists para serem preenchidos pelo técnico durante a execução
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="neon-button text-xs px-3 py-2 flex items-center gap-2"
          style={{
            backgroundColor: '#00D4FF20',
            color: '#00D4FF',
            borderColor: '#00D4FF60'
          }}
        >
          <Plus className="w-4 h-4" />
          ADICIONAR
        </button>
      </div>

      {checklistsVinculados.length === 0 ? (
        <div className="text-center py-8 premium-card">
          <CheckSquare className="w-10 h-10 text-gray-600 mx-auto mb-2" />
          <p className="text-gray-500 text-xs">
            Nenhum checklist técnico vinculado
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {checklistsVinculados.map((vinculo) => {
            const template = vinculo.checklist_template;
            if (!template) return null;

            const respostas = vinculo.respostas || [];

            return (
              <div key={vinculo.id} className="premium-card p-3">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h5 className="text-xs font-bold text-[#00D4FF]">{template.nome}</h5>
                    {template.descricao && (
                      <p className="text-[10px] text-gray-400 mt-0.5">{template.descricao}</p>
                    )}
                  </div>
                  <button
                    onClick={() => handleRemoverChecklist(vinculo.id)}
                    className="text-red-400 hover:text-red-300 transition-colors"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>

                <div className="space-y-1.5">
                  {template.itens?.map((item: any) => {
                    const resposta = respostas.find((r: any) => r.ordem === item.ordem);
                    const checked = resposta?.checked || false;

                    return (
                      <div key={item.ordem} className="flex items-start gap-2 p-1.5 rounded hover:bg-white/5 transition-colors">
                        <button
                          onClick={() => handleToggleItem(vinculo.id, item.ordem, !checked)}
                          className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center transition-all ${
                            checked
                              ? 'bg-[#00D4FF]/20 border-[#00D4FF]'
                              : 'border-gray-500 hover:border-[#00D4FF]'
                          }`}
                        >
                          {checked && <CheckSquare className="w-3 h-3 text-[#00D4FF]" />}
                        </button>
                        <div className="flex-1">
                          <p className={`text-xs ${checked ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                            {item.texto}
                          </p>
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
          <div className="bg-[#1a1f2e] border border-[#00D4FF]/30 rounded-lg w-full max-w-2xl max-h-[80vh] overflow-hidden">
            <div className="p-6 border-b border-[#00D4FF]/20">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-[#00D4FF]">Adicionar Checklist Técnico</h3>
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
                    Todos os checklists técnicos disponíveis já foram vinculados
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {templatesDisponiveis.map((template) => (
                    <div
                      key={template.id}
                      className="premium-card p-4 hover:border-[#00D4FF]/50 transition-all cursor-pointer"
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
                        <Plus className="w-5 h-5 text-[#00D4FF] flex-shrink-0" />
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
