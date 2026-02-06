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
  isReadOnly?: boolean;
}

export function AgendamentoChecklistSection({ agendamentoId, unidadeId, tipoOS, tipoAtendimento, osId, isReadOnly = false }: AgendamentoChecklistSectionProps) {
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
      console.log('========================================');
      console.log('🔍 DIAGNÓSTICO: Carregando checklists técnicos');
      console.log('========================================');
      console.log('📋 Parâmetros recebidos:');
      console.log('  - agendamentoId:', agendamentoId);
      console.log('  - unidadeId:', unidadeId);
      console.log('  - tipoOS:', tipoOS);
      console.log('  - tipoAtendimento:', tipoAtendimento);
      console.log('  - osId:', osId);

      // Carregar checklists vinculados do agendamento (técnico)
      const { data: vinculados, error: errorVinculados } = await supabase
        .from('agendamento_checklist_vinculados')
        .select(`
          *,
          checklist_template:checklist_templates(*)
        `)
        .eq('agendamento_id', agendamentoId);

      if (errorVinculados) {
        console.error('❌ Erro ao carregar vinculados:', errorVinculados);
      }

      console.log('✅ Checklists técnicos já vinculados:', vinculados?.length || 0);
      setChecklistsVinculados(vinculados || []);


      // Carregar templates TÉCNICO disponíveis
      console.log('🔎 Buscando templates TÉCNICO do banco...');
      console.log('Query: tipo_checklist=TÉCNICO, ativo=true, unidade=' + unidadeId + ' OU null');

      const { data: templates, error: errorTemplates } = await supabase
        .from('checklist_templates')
        .select('*')
        .eq('tipo_checklist', 'TÉCNICO')
        .eq('ativo', true)
        .or(`unidade_id.eq.${unidadeId},unidade_id.is.null`);

      if (errorTemplates) {
        console.error('❌ Erro ao carregar templates:', errorTemplates);
      }

      console.log('📦 Total de templates TÉCNICO encontrados no BD:', templates?.length || 0);
      if (templates && templates.length > 0) {
        templates.forEach((t, index) => {
          console.log(`  ${index + 1}. ${t.nome}`, {
            tipo_os: t.tipo_os || 'TODOS',
            tipos_atendimento: t.tipos_atendimento || 'TODOS',
            unidade_id: t.unidade_id || 'TODAS'
          });
        });
      } else {
        console.warn('⚠️ NENHUM template técnico encontrado no banco!');
        console.warn('   Verifique se existem templates com tipo_checklist=TÉCNICO e ativo=true');
      }

      setChecklistTemplates(templates || []);
      console.log('========================================');
    } catch (error) {
      console.error('❌ Erro ao carregar checklists:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleVincularChecklist = async (templateId: string) => {
    if (!agendamentoId) return;

    try {
      console.log('Vinculando checklist técnico:', templateId, 'para agendamento:', agendamentoId);

      const template = checklistTemplates.find(t => t.id === templateId);
      const nomeChecklist = template?.nome || 'Checklist';

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

      if (osId) {
        await supabase.from('os_comentarios').insert({
          os_id: osId,
          usuario_id: usuario?.id,
          comentario: `${usuario?.nome} adicionou o checklist TÉCNICO "${nomeChecklist}" manualmente`,
          is_system: true
        });
      }
    } catch (error) {
      console.error('Erro ao vincular checklist:', error);
      alert('Erro ao vincular checklist');
    }
  };

  const handleRemoverChecklist = async (vinculoId: string) => {
    const vinculo = checklistsVinculados.find(v => v.id === vinculoId);
    if (!vinculo) return;

    const template = vinculo.checklist_template;
    const nomeChecklist = template?.nome || 'Checklist';

    const justificativa = prompt(`Por que você está removendo o checklist "${nomeChecklist}"?\n\nJustificativa:`);

    if (!justificativa || justificativa.trim() === '') {
      alert('Justificativa é obrigatória para remover um checklist.');
      return;
    }

    try {
      await supabase
        .from('agendamento_checklist_vinculados')
        .delete()
        .eq('id', vinculoId);

      await loadChecklists();

      if (osId) {
        await supabase.from('os_comentarios').insert({
          os_id: osId,
          usuario_id: usuario?.id,
          comentario: `${usuario?.nome} REMOVEU o checklist TÉCNICO "${nomeChecklist}"\n\nJustificativa: ${justificativa}`,
          is_system: true
        });
      }
    } catch (error) {
      alert('Erro ao remover checklist');
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

    // Se não tem filtros definidos (null ou vazio), mostra para todos
    // Filtrar por tipo de OS apenas se houver filtros E houver tipo de OS na OS
    if (t.tipo_os && Array.isArray(t.tipo_os) && t.tipo_os.length > 0) {
      if (tipoOS && !t.tipo_os.includes(tipoOS)) {
        console.log('Template filtrado por tipo_os:', t.nome, 'esperava um de:', t.tipo_os, 'mas OS é:', tipoOS);
        return false;
      }
    }

    // Filtrar por tipo de atendimento apenas se houver filtros E houver tipo de atendimento na OS
    if (t.tipos_atendimento && Array.isArray(t.tipos_atendimento) && t.tipos_atendimento.length > 0) {
      if (tipoAtendimento && !t.tipos_atendimento.includes(tipoAtendimento)) {
        console.log('Template filtrado por tipos_atendimento:', t.nome, 'esperava um de:', t.tipos_atendimento, 'mas OS é:', tipoAtendimento);
        return false;
      }
    }

    console.log('✅ Template técnico DISPONÍVEL:', t.nome);
    return true;
  });

  console.log('🔍 Total de templates carregados do BD:', checklistTemplates.length);
  console.log('✅ Total templates técnicos DISPONÍVEIS após filtros:', templatesDisponiveis.length);
  console.log('📋 Templates disponíveis:', templatesDisponiveis.map(t => t.nome));

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
            Visualização dos checklists vinculados. Preenchimento feito apenas pelo técnico no mobile
          </p>
        </div>
        {!isReadOnly && (
          <button
            onClick={() => setShowAddModal(true)}
            className="neon-button text-xs px-3 py-2 flex items-center gap-2"
            style={{
              backgroundColor: 'rgba(var(--accent-rgb), 0.125)',
              color: 'var(--text-accent)',
              borderColor: 'rgba(var(--accent-rgb), 0.38)'
            }}
          >
            <Plus className="w-4 h-4" />
            ADICIONAR
          </button>
        )}
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
                  {!isReadOnly && (
                    <button
                      onClick={() => handleRemoverChecklist(vinculo.id)}
                      className="text-red-400 hover:text-red-300 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>

                <div className="space-y-1.5">
                  {template.itens?.map((item: any) => {
                    const resposta = respostas.find((r: any) => r.ordem === item.ordem);
                    const checked = resposta?.checked || false;

                    return (
                      <div key={item.ordem} className="flex items-start gap-2 p-1.5 rounded">
                        <div
                          className={`flex-shrink-0 w-4 h-4 rounded border-2 flex items-center justify-center ${
                            checked
                              ? 'bg-[#00D4FF]/20 border-[#00D4FF]'
                              : 'border-gray-600'
                          }`}
                        >
                          {checked && <CheckSquare className="w-3 h-3 text-[#00D4FF]" />}
                        </div>
                        <div className="flex-1">
                          <p className={`text-xs ${checked ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                            {item.texto}
                          </p>
                          {checked && resposta?.updated_at && (
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              Preenchido por: {resposta.updated_by_name || 'Técnico'} - {new Date(resposta.updated_at).toLocaleString('pt-BR')}
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
