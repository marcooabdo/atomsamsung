import { useState, useEffect, useCallback } from 'react';
import { FileText, Clock, Save, Eye, ToggleLeft, ToggleRight, X, Loader2, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface RelatorioConfig {
  id: string;
  tipo: string;
  nome: string;
  emoji: string;
  horario: string;
  ativo: boolean;
  template_formato: string;
  created_at: string;
  updated_at: string;
}

const DEFAULT_TEMPLATES: Record<string, string> = {
  pulso_operacional: `🔴 *PULSO OPERACIONAL*
━━━━━━━━━━━━━━━━━━━━━

⚠️ *OS PARADAS HÁ MAIS DE 2 HORAS:*

{lista_os_paradas}

📊 *RESUMO POR COLUNA:*
{resumo_colunas}

🔔 Total de OS paradas: {total_paradas}
⏰ Relatório gerado: {horario}`,

  estoque_dia: `📦 *ESTOQUE DO DIA*
━━━━━━━━━━━━━━━━━━━━━

📊 *SITUAÇÃO GERAL:*
• Total de peças em estoque: {total_pecas}
• Peças disponíveis: {disponiveis}
• Peças vinculadas: {vinculadas}
• Peças em trânsito: {em_transito}

📋 *REQUISIÇÕES PENDENTES:*
{requisicoes_pendentes}

🔔 Alertas:
{alertas_estoque}

⏰ Relatório gerado: {horario}`,

  resumo_final: `🏁 *RESUMO FINAL DO DIA*
━━━━━━━━━━━━━━━━━━━━━

📊 *MOVIMENTAÇÃO DO DIA:*
• OS abertas hoje: {abertas_hoje}
• OS fechadas hoje: {fechadas_hoje}
• OS em andamento: {em_andamento}

💰 *FINANCEIRO:*
• Faturamento do dia: R$ {faturamento}
• Pagamentos recebidos: {pagamentos}

👥 *DESEMPENHO TÉCNICOS:*
{desempenho_tecnicos}

⏰ Relatório gerado: {horario}`,

  agendamentos_ih: `📅 *AGENDAMENTOS IH*
━━━━━━━━━━━━━━━━━━━━━

📋 *AGENDA DO DIA:*
{lista_agendamentos}

📊 *RESUMO:*
• Total agendados: {total}
• Manhã: {manha}
• Tarde: {tarde}

🗺️ *ROTAS:*
{rotas_dia}

⏰ Relatório gerado: {horario}`,

  compliance_erros: `⚠️ *COMPLIANCE E ERROS*
━━━━━━━━━━━━━━━━━━━━━

🚨 *ALERTAS CRÍTICOS:*
{alertas_criticos}

📋 *PENDÊNCIAS:*
{pendencias}

📊 *INDICADORES:*
• SLA médio: {sla_medio}
• OS fora do prazo: {fora_prazo}
• Erros de processo: {erros}

⏰ Relatório gerado: {horario}`,

  limite_credito_gspn: `💳 *LIMITE DE CRÉDITO GSPN*
━━━━━━━━━━━━━━━━━━━━━

💰 *SITUAÇÃO ATUAL:*
• Limite total: R$ {limite_total}
• Utilizado: R$ {utilizado}
• Disponível: R$ {disponivel}
• % utilizado: {percentual}%

📋 *PEÇAS PENDENTES DE CRÉDITO:*
{pecas_pendentes}

⚠️ *ALERTAS:*
{alertas_credito}

⏰ Relatório gerado: {horario}`,

  mapa_rotas: `🗺️ *MAPA DE ROTAS*
━━━━━━━━━━━━━━━━━━━━━

📋 *ROTAS DO DIA:*
{rotas}

📊 *RESUMO:*
• Total de visitas: {total_visitas}
• Km estimado: {km_total}
• Técnicos em rota: {tecnicos_rota}

⏰ Relatório gerado: {horario}`,

  nucleo_pecas: `🔧 *NÚCLEO DE PEÇAS*
━━━━━━━━━━━━━━━━━━━━━

📦 *MOVIMENTAÇÃO:*
• Entradas hoje: {entradas}
• Saídas hoje: {saidas}
• Devoluções pendentes: {devolucoes}

📋 *REQUISIÇÕES:*
{requisicoes}

⚠️ *ALERTAS DE ESTOQUE:*
{alertas}

⏰ Relatório gerado: {horario}`,

  abertura_fechamento: `📊 *ABERTURA E FECHAMENTO*
━━━━━━━━━━━━━━━━━━━━━

📈 *ABERTURA:*
• OS abertas hoje: {abertas_hoje}
• Por tipo: LP={lp} | OW={ow}
• IH={ih} | CI={ci}

📉 *FECHAMENTO:*
• OS fechadas hoje: {fechadas_hoje}
• Tempo médio: {tempo_medio}

📊 *SALDO:*
• Backlog atual: {backlog}
• Variação: {variacao}

⏰ Relatório gerado: {horario}`,
};

function renderTemplatePreview(template: string): string {
  if (!template) return '';
  let html = template.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
  html = html.replace(/\n/g, '<br>');
  return html;
}

export function ConfiguracoesRelatorios() {
  const [relatorios, setRelatorios] = useState<RelatorioConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<RelatorioConfig>>({});
  const [saving, setSaving] = useState(false);
  const [savingHorario, setSavingHorario] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchRelatorios = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('gia_relatorios_config' as any)
      .select('*')
      .order('horario');

    if (error) {
      console.error('Erro ao buscar relatórios:', error);
    } else {
      setRelatorios(data || []);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRelatorios();
  }, [fetchRelatorios]);

  const getEffectiveTemplate = (relatorio: RelatorioConfig): string => {
    return relatorio.template_formato || DEFAULT_TEMPLATES[relatorio.tipo] || '';
  };

  const handleEdit = (relatorio: RelatorioConfig) => {
    setEditingId(relatorio.id);
    setEditForm({
      template_formato: getEffectiveTemplate(relatorio),
      horario: relatorio.horario,
    });
    setShowPreview(false);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditForm({});
    setShowPreview(false);
  };

  const handleSave = async (id: string) => {
    setSaving(true);
    const { error } = await supabase
      .from('gia_relatorios_config' as any)
      .update({
        template_formato: editForm.template_formato,
        horario: editForm.horario,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      console.error('Erro ao salvar:', error);
    } else {
      setSuccessMessage('Relatório atualizado com sucesso!');
      setTimeout(() => setSuccessMessage(null), 3000);
      setEditingId(null);
      setEditForm({});
      fetchRelatorios();
    }
    setSaving(false);
  };

  const handleHorarioChange = async (relatorio: RelatorioConfig, newHorario: string) => {
    setSavingHorario(relatorio.id);
    const { error } = await supabase
      .from('gia_relatorios_config' as any)
      .update({
        horario: newHorario,
        updated_at: new Date().toISOString(),
      })
      .eq('id', relatorio.id);

    if (!error) {
      setRelatorios(prev =>
        prev.map(r => r.id === relatorio.id ? { ...r, horario: newHorario } : r)
      );
    }
    setSavingHorario(null);
  };

  const handleToggleAtivo = async (relatorio: RelatorioConfig) => {
    const { error } = await supabase
      .from('gia_relatorios_config' as any)
      .update({
        ativo: !relatorio.ativo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', relatorio.id);

    if (!error) {
      setRelatorios(prev =>
        prev.map(r => r.id === relatorio.id ? { ...r, ativo: !r.ativo } : r)
      );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-[#00D4FF] animate-spin" />
        <span className="ml-3 text-gray-400">Carregando relatórios...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="tech-heading text-2xl flex items-center gap-3">
          <FileText className="w-7 h-7 text-[#00D4FF]" />
          Configurações de Relatórios GIA
        </h2>
        <span className="text-sm text-gray-400">
          {relatorios.filter(r => r.ativo).length} ativos de {relatorios.length} relatórios
        </span>
      </div>

      {/* Info Banner */}
      <div className="bg-[#00D4FF]/5 border border-[#00D4FF]/20 rounded-lg px-4 py-3 flex items-start gap-3">
        <Info className="w-5 h-5 text-[#00D4FF] mt-0.5 flex-shrink-0" />
        <div className="text-sm text-gray-300">
          <p>Edite os horários diretamente e clique no template para personalizar o formato de cada relatório.</p>
          <p className="text-gray-500 text-xs mt-1">Variáveis entre {'{chaves}'} são substituídas automaticamente pela GIA com dados em tempo real.</p>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 text-green-400 text-sm">
          {successMessage}
        </div>
      )}

      {/* Reports Table */}
      <div className="space-y-3">
        {relatorios.map((relatorio) => {
          const template = getEffectiveTemplate(relatorio);
          const isExpanded = expandedId === relatorio.id;
          const isEditing = editingId === relatorio.id;

          return (
            <div
              key={relatorio.id}
              className={`premium-card rounded-xl border transition-all duration-200 ${
                relatorio.ativo
                  ? 'border-[#00D4FF]/15 hover:border-[#00D4FF]/30'
                  : 'border-gray-700/40 opacity-50'
              }`}
            >
              {/* Main Row */}
              <div className="flex items-center gap-4 px-5 py-4">
                {/* Toggle */}
                <button
                  onClick={() => handleToggleAtivo(relatorio)}
                  className="flex-shrink-0 transition-transform hover:scale-110"
                  title={relatorio.ativo ? 'Desativar' : 'Ativar'}
                >
                  {relatorio.ativo ? (
                    <ToggleRight className="w-7 h-7 text-[#00D4FF]" />
                  ) : (
                    <ToggleLeft className="w-7 h-7 text-gray-500" />
                  )}
                </button>

                {/* Emoji + Name */}
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <span className="text-2xl flex-shrink-0">{relatorio.emoji}</span>
                  <div className="min-w-0">
                    <h3 className="text-white font-semibold text-sm truncate">{relatorio.nome}</h3>
                    <span className="text-[10px] text-gray-500 uppercase tracking-wider">{relatorio.tipo}</span>
                  </div>
                </div>

                {/* Horario - directly editable */}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <input
                    type="time"
                    value={relatorio.horario}
                    onChange={(e) => handleHorarioChange(relatorio, e.target.value)}
                    className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white w-[110px] focus:border-[#00D4FF] focus:ring-1 focus:ring-[#00D4FF] outline-none transition-all cursor-pointer"
                  />
                  {savingHorario === relatorio.id && (
                    <Loader2 className="w-4 h-4 text-[#00D4FF] animate-spin" />
                  )}
                </div>

                {/* Expand/Collapse Template */}
                <button
                  onClick={() => {
                    if (isEditing) return;
                    setExpandedId(isExpanded ? null : relatorio.id);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border transition-all flex-shrink-0 bg-gray-800 border-gray-600 hover:border-[#00D4FF]/50 text-gray-300 hover:text-white"
                  title="Ver/Editar template"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Template
                  {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* Expanded Template View */}
              {isExpanded && !isEditing && (
                <div className="border-t border-gray-700/50 px-5 py-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-gray-400 uppercase tracking-wider font-medium">
                      Template Atual
                      {!relatorio.template_formato && (
                        <span className="ml-2 text-yellow-500/80">(padrão do sistema)</span>
                      )}
                    </span>
                    <button
                      onClick={() => handleEdit(relatorio)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[#00D4FF]/10 border border-[#00D4FF]/30 text-[#00D4FF] hover:bg-[#00D4FF]/20 transition-all"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Editar Template
                    </button>
                  </div>
                  <div className="bg-gray-900/80 border border-gray-700/50 rounded-lg p-4 max-h-[300px] overflow-auto">
                    <pre className="text-sm text-gray-300 whitespace-pre-wrap font-mono leading-relaxed">
                      {template || '(Nenhum template definido)'}
                    </pre>
                  </div>
                </div>
              )}

              {/* Editing Template */}
              {isEditing && (
                <div className="border-t border-gray-700/50 px-5 py-4 space-y-4">
                  {/* Template Editor */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                        <FileText className="w-4 h-4" />
                        Editando Template
                      </label>
                      <button
                        onClick={() => setShowPreview(!showPreview)}
                        className="flex items-center gap-1.5 text-xs text-[#00D4FF] hover:text-[#00D4FF]/80 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {showPreview ? 'Ocultar Preview' : 'Ver Preview'}
                      </button>
                    </div>

                    <div className={`grid gap-4 ${showPreview ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
                      <textarea
                        value={editForm.template_formato || ''}
                        onChange={(e) =>
                          setEditForm(prev => ({ ...prev, template_formato: e.target.value }))
                        }
                        rows={18}
                        placeholder="Digite o template do relatório..."
                        className="w-full px-4 py-3 rounded-lg bg-gray-900 border border-gray-600 text-white font-mono text-sm focus:border-[#00D4FF] focus:ring-1 focus:ring-[#00D4FF] outline-none transition-all resize-y leading-relaxed"
                      />

                      {showPreview && (
                        <div className="bg-gray-900/80 border border-gray-700 rounded-lg p-4 overflow-auto max-h-[440px]">
                          <div className="flex items-center gap-2 text-xs text-gray-500 mb-3 pb-2 border-b border-gray-700">
                            <Eye className="w-3.5 h-3.5" />
                            PREVIEW (WhatsApp)
                          </div>
                          <div
                            className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap"
                            dangerouslySetInnerHTML={{
                              __html: renderTemplatePreview(editForm.template_formato || ''),
                            }}
                          />
                        </div>
                      )}
                    </div>

                    <p className="text-xs text-gray-500 mt-2">
                      Use <code className="bg-gray-800 px-1 rounded">*texto*</code> para negrito.
                      Variáveis <code className="bg-gray-800 px-1 rounded">{'{variavel}'}</code> são preenchidas pela GIA.
                    </p>
                  </div>

                  {/* Horario in edit mode */}
                  <div className="flex items-center gap-3">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <label className="text-sm text-gray-300">Horário:</label>
                    <input
                      type="time"
                      value={editForm.horario || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, horario: e.target.value }))}
                      className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-1.5 text-sm text-white focus:border-[#00D4FF] focus:ring-1 focus:ring-[#00D4FF] outline-none transition-all"
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-3 pt-2 border-t border-gray-700/50">
                    <button
                      onClick={() => handleSave(relatorio.id)}
                      disabled={saving}
                      className="flex items-center gap-2 px-5 py-2 bg-[#00D4FF] hover:bg-[#00D4FF]/90 text-gray-900 font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                      Salvar
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      className="flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-all"
                    >
                      <X className="w-4 h-4" />
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {relatorios.length === 0 && !loading && (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Nenhum relatório configurado</p>
          <p className="text-gray-500 text-sm mt-1">
            Os templates de relatórios GIA aparecerão aqui.
          </p>
        </div>
      )}
    </div>
  );
}
