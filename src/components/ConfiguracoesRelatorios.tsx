import { useState, useEffect, useCallback } from 'react';
import { FileText, Clock, Save, CreditCard as Edit, Eye, ToggleLeft, ToggleRight, X, Loader2 } from 'lucide-react';
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

function renderTemplatePreview(template: string): string {
  if (!template) return '';
  // Convert *text* to <strong>text</strong>
  let html = template.replace(/\*(.*?)\*/g, '<strong>$1</strong>');
  // Convert newlines to <br>
  html = html.replace(/\n/g, '<br>');
  return html;
}

export function ConfiguracoesRelatorios() {
  const [relatorios, setRelatorios] = useState<RelatorioConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<RelatorioConfig>>({});
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const fetchRelatorios = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('gia_relatorios_config' as any)
      .select('*')
      .order('nome');

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

  const handleEdit = (relatorio: RelatorioConfig) => {
    setEditingId(relatorio.id);
    setEditForm({
      template_formato: relatorio.template_formato,
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

  const handleToggleAtivo = async (relatorio: RelatorioConfig) => {
    const { error } = await supabase
      .from('gia_relatorios_config' as any)
      .update({
        ativo: !relatorio.ativo,
        updated_at: new Date().toISOString(),
      })
      .eq('id', relatorio.id);

    if (error) {
      console.error('Erro ao alternar status:', error);
    } else {
      setRelatorios((prev) =>
        prev.map((r) =>
          r.id === relatorio.id ? { ...r, ativo: !r.ativo } : r
        )
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
          {relatorios.length} relatórios configurados
        </span>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 text-green-400 text-sm">
          {successMessage}
        </div>
      )}

      {/* Grid of Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {relatorios.map((relatorio) => (
          <div
            key={relatorio.id}
            className={`premium-card rounded-xl p-5 border transition-all duration-200 ${
              relatorio.ativo
                ? 'border-[#00D4FF]/20 hover:border-[#00D4FF]/40'
                : 'border-gray-700/50 opacity-60'
            } ${editingId === relatorio.id ? 'col-span-1 md:col-span-2 xl:col-span-3' : ''}`}
          >
            {/* Card Header */}
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{relatorio.emoji}</span>
                <div>
                  <h3 className="text-white font-semibold text-lg leading-tight">
                    {relatorio.nome}
                  </h3>
                  <span className="text-xs text-gray-400 bg-gray-800 px-2 py-0.5 rounded-full">
                    {relatorio.tipo}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleToggleAtivo(relatorio)}
                className="flex items-center gap-1 transition-colors"
                title={relatorio.ativo ? 'Desativar' : 'Ativar'}
              >
                {relatorio.ativo ? (
                  <ToggleRight className="w-7 h-7 text-[#00D4FF]" />
                ) : (
                  <ToggleLeft className="w-7 h-7 text-gray-500" />
                )}
              </button>
            </div>

            {/* Card Info */}
            <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4" />
                <span>{relatorio.horario}</span>
              </div>
              <div
                className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                  relatorio.ativo
                    ? 'bg-[#00D4FF]/10 text-[#00D4FF]'
                    : 'bg-gray-700 text-gray-500'
                }`}
              >
                {relatorio.ativo ? 'Ativo' : 'Inativo'}
              </div>
            </div>

            {/* Edit Button or Editor */}
            {editingId === relatorio.id ? (
              <div className="space-y-4 border-t border-gray-700/50 pt-4">
                {/* Horario Editor */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Horário de Envio
                  </label>
                  <input
                    type="time"
                    value={editForm.horario || ''}
                    onChange={(e) =>
                      setEditForm((prev) => ({ ...prev, horario: e.target.value }))
                    }
                    className="neon-input w-full max-w-[200px] px-3 py-2 rounded-lg bg-gray-800 border border-gray-600 text-white focus:border-[#00D4FF] focus:ring-1 focus:ring-[#00D4FF] outline-none transition-all"
                  />
                </div>

                {/* Template Editor */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-300">
                      <FileText className="w-4 h-4 inline mr-1" />
                      Template do Relatório
                    </label>
                    <button
                      onClick={() => setShowPreview(!showPreview)}
                      className="flex items-center gap-1.5 text-sm text-[#00D4FF] hover:text-[#00D4FF]/80 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                      {showPreview ? 'Ocultar Preview' : 'Ver Preview'}
                    </button>
                  </div>

                  <div className={`grid gap-4 ${showPreview ? 'grid-cols-1 lg:grid-cols-2' : 'grid-cols-1'}`}>
                    <textarea
                      value={editForm.template_formato || ''}
                      onChange={(e) =>
                        setEditForm((prev) => ({
                          ...prev,
                          template_formato: e.target.value,
                        }))
                      }
                      rows={16}
                      placeholder="Digite o template do relatório...&#10;Use *texto* para negrito&#10;Emojis são suportados 📊"
                      className="neon-input w-full px-4 py-3 rounded-lg bg-gray-900 border border-gray-600 text-white font-mono text-sm focus:border-[#00D4FF] focus:ring-1 focus:ring-[#00D4FF] outline-none transition-all resize-y leading-relaxed"
                    />

                    {/* Preview */}
                    {showPreview && (
                      <div className="bg-gray-900/80 border border-gray-700 rounded-lg p-4 overflow-auto max-h-[400px]">
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-3 pb-2 border-b border-gray-700">
                          <Eye className="w-3.5 h-3.5" />
                          PREVIEW
                        </div>
                        <div
                          className="text-sm text-gray-200 leading-relaxed whitespace-pre-wrap"
                          dangerouslySetInnerHTML={{
                            __html: renderTemplatePreview(
                              editForm.template_formato || ''
                            ),
                          }}
                        />
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-gray-500 mt-2">
                    Dica: Use <code className="bg-gray-800 px-1 rounded">*texto*</code> para
                    negrito. Emojis e quebras de linha são preservados.
                  </p>
                </div>

                {/* Action Buttons */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={() => handleSave(relatorio.id)}
                    disabled={saving}
                    className="flex items-center gap-2 px-4 py-2 bg-[#00D4FF] hover:bg-[#00D4FF]/90 text-gray-900 font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {saving ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Save className="w-4 h-4" />
                    )}
                    Salvar Alterações
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
            ) : (
              <button
                onClick={() => handleEdit(relatorio)}
                className="flex items-center gap-2 w-full justify-center px-4 py-2.5 bg-gray-800 hover:bg-gray-700 border border-gray-600 hover:border-[#00D4FF]/50 text-gray-300 hover:text-white rounded-lg transition-all"
              >
                <Edit className="w-4 h-4" />
                Editar Template
              </button>
            )}
          </div>
        ))}
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
