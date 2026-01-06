import { useState, useEffect } from 'react';
import { CheckSquare, FileText, TrendingUp, Eye, Filter, BarChart2 } from 'lucide-react';
import { useOtimizador } from '../../contexts/OtimizadorContext';
import { supabase } from '../../lib/supabase';

interface ChecklistTemplate {
  id: string;
  nome: string;
  descricao: string;
  tipo_servico: string;
  itens: any[];
  ativo: boolean;
  created_at: string;
  uso_count: number;
  compliance_rate: number;
}

export default function SistemaChecklists() {
  const { selectedUnidade, loading } = useOtimizador();
  const [templates, setTemplates] = useState<ChecklistTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(true);
  const [filtroTipo, setFiltroTipo] = useState<string>('todos');
  const [selectedTemplate, setSelectedTemplate] = useState<ChecklistTemplate | null>(null);

  useEffect(() => {
    if (selectedUnidade) {
      loadTemplates();
    }
  }, [selectedUnidade, filtroTipo]);

  const loadTemplates = async () => {
    setLoadingTemplates(true);
    try {
      let query = supabase
        .from('checklist_templates')
        .select('*')
        .or(`unidade_id.eq.${selectedUnidade},unidade_id.is.null`)
        .eq('ativo', true)
        .order('nome');

      if (filtroTipo !== 'todos') {
        query = query.eq('tipo_servico', filtroTipo);
      }

      const { data: templatesData, error } = await query;

      if (error) throw error;

      const templatesComStats = await Promise.all(
        (templatesData || []).map(async (template) => {
          const { count: usoCount } = await supabase
            .from('agendamento_checklist_respostas')
            .select('*', { count: 'exact', head: true })
            .eq('template_id', template.id);

          const { data: respostas } = await supabase
            .from('agendamento_checklist_respostas')
            .select('resposta_checkbox')
            .eq('template_id', template.id)
            .not('resposta_checkbox', 'is', null);

          const totalRespostas = respostas?.length || 0;
          const respostasPositivas = respostas?.filter(r => r.resposta_checkbox === true).length || 0;
          const complianceRate = totalRespostas > 0
            ? Math.round((respostasPositivas / totalRespostas) * 100)
            : 0;

          return {
            ...template,
            uso_count: usoCount || 0,
            compliance_rate: complianceRate,
          };
        })
      );

      setTemplates(templatesComStats);
    } catch (error) {
    } finally {
      setLoadingTemplates(false);
    }
  };

  const totalTemplates = templates.length;
  const totalUsos = templates.reduce((sum, t) => sum + t.uso_count, 0);
  const mediaCompliance = templates.length > 0
    ? Math.round(templates.reduce((sum, t) => sum + t.compliance_rate, 0) / templates.length)
    : 0;

  if (loadingTemplates || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="futuristic-loader"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 via-rose-500 to-red-600">
            Sistema de Checklists
          </h2>
          <p className="text-gray-400 mt-1">Templates configuráveis e controle de qualidade</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-pink-500/10 to-pink-600/5 border border-pink-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Templates Ativos</p>
              <p className="text-3xl font-bold text-pink-400 mt-1">{totalTemplates}</p>
            </div>
            <CheckSquare className="w-12 h-12 text-pink-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total de Usos</p>
              <p className="text-3xl font-bold text-purple-400 mt-1">{totalUsos}</p>
            </div>
            <BarChart2 className="w-12 h-12 text-purple-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Compliance Médio</p>
              <p className="text-3xl font-bold text-green-400 mt-1">{mediaCompliance}%</p>
            </div>
            <TrendingUp className="w-12 h-12 text-green-400 opacity-50" />
          </div>
        </div>
      </div>

      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <Filter className="w-5 h-5 text-gray-400" />
          <select
            value={filtroTipo}
            onChange={(e) => setFiltroTipo(e.target.value)}
            className="px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-pink-500 transition-colors"
          >
            <option value="todos">Todos os Tipos</option>
            <option value="IH">IH - In Home</option>
            <option value="CI">CI - Carry In</option>
            <option value="geral">Geral</option>
            <option value="instalacao">Instalação</option>
            <option value="manutencao">Manutenção</option>
          </select>
        </div>

        {templates.length === 0 ? (
          <div className="text-center py-12">
            <CheckSquare className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">Nenhum template encontrado</p>
            <p className="text-gray-500 text-sm mt-2">
              {filtroTipo !== 'todos'
                ? 'Tente alterar os filtros'
                : 'Configure templates na página de Configurações'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {templates.map((template) => (
              <div
                key={template.id}
                className="bg-gray-700/30 border border-gray-600 rounded-lg p-6 hover:bg-gray-700/50 transition-colors cursor-pointer"
                onClick={() => setSelectedTemplate(template)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-xl font-bold text-white mb-2">{template.nome}</h3>
                    <p className="text-gray-400 text-sm">{template.descricao}</p>
                  </div>
                  <Eye className="w-5 h-5 text-gray-400" />
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <span className="px-3 py-1 bg-pink-500/20 border border-pink-500/30 rounded-full text-pink-400 text-xs">
                    {template.tipo_servico.toUpperCase()}
                  </span>
                  <span className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full text-blue-400 text-xs">
                    {template.itens?.length || 0} itens
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                    <p className="text-gray-400 text-xs">Vezes Usado</p>
                    <p className="text-purple-400 text-xl font-bold">{template.uso_count}</p>
                  </div>
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                    <p className="text-gray-400 text-xs">Compliance</p>
                    <p className="text-green-400 text-xl font-bold">{template.compliance_rate}%</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedTemplate && (
        <div
          className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedTemplate(null)}
        >
          <div
            className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-2xl font-bold text-white">{selectedTemplate.nome}</h3>
              <button
                onClick={() => setSelectedTemplate(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ✕
              </button>
            </div>

            <p className="text-gray-400 mb-6">{selectedTemplate.descricao}</p>

            <div className="space-y-3">
              <h4 className="text-lg font-bold text-white mb-3">Itens do Checklist</h4>
              {selectedTemplate.itens && selectedTemplate.itens.length > 0 ? (
                selectedTemplate.itens.map((item: any, index: number) => (
                  <div
                    key={index}
                    className="bg-gray-700/50 border border-gray-600 rounded-lg p-4 flex items-start gap-3"
                  >
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-pink-500/20 border border-pink-500/30 flex items-center justify-center">
                      <span className="text-pink-400 font-bold text-sm">{item.ordem || index + 1}</span>
                    </div>
                    <div className="flex-1">
                      <p className="text-white">{item.texto}</p>
                      <p className="text-gray-400 text-sm mt-1">
                        Tipo: <span className="text-pink-400">{item.tipo_resposta}</span>
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">Nenhum item configurado</p>
              )}
            </div>

            <div className="mt-6 grid grid-cols-3 gap-4">
              <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-4 text-center">
                <p className="text-gray-400 text-xs">Vezes Usado</p>
                <p className="text-purple-400 text-2xl font-bold">{selectedTemplate.uso_count}</p>
              </div>
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 text-center">
                <p className="text-gray-400 text-xs">Compliance</p>
                <p className="text-green-400 text-2xl font-bold">{selectedTemplate.compliance_rate}%</p>
              </div>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 text-center">
                <p className="text-gray-400 text-xs">Itens</p>
                <p className="text-blue-400 text-2xl font-bold">{selectedTemplate.itens?.length || 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
