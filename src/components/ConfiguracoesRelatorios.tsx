import { useState, useEffect, useCallback } from 'react';
import { FileText, Clock, Save, ToggleLeft, ToggleRight, X, Loader2, Plus, Trash2, Calendar, Send, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface RelatorioConfig {
  id: string;
  tipo: string;
  nome: string;
  emoji: string;
  horario: string;
  horarios: string[];
  dias_semana: number[];
  ativo: boolean;
  template_formato: string;
  grupo_destino: string | null;
  created_at: string;
  updated_at: string;
}

const DIAS_SEMANA_LABELS: Record<number, string> = {
  0: 'Dom',
  1: 'Seg',
  2: 'Ter',
  3: 'Qua',
  4: 'Qui',
  5: 'Sex',
  6: 'Sáb',
};

const DIAS_SEMANA_FULL: Record<number, string> = {
  0: 'Domingo',
  1: 'Segunda',
  2: 'Terça',
  3: 'Quarta',
  4: 'Quinta',
  5: 'Sexta',
  6: 'Sábado',
};

export function ConfiguracoesRelatorios() {
  const [relatorios, setRelatorios] = useState<RelatorioConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [newHorarioInput, setNewHorarioInput] = useState<Record<string, string>>({});

  const fetchRelatorios = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('gia_relatorios_config' as any)
      .select('*')
      .order('nome');

    if (error) {
      console.error('Erro ao buscar relatórios:', error);
    } else {
      setRelatorios((data || []).map((r: any) => ({
        ...r,
        horarios: r.horarios || [],
        dias_semana: r.dias_semana || [1, 2, 3, 4, 5],
      })));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchRelatorios();
  }, [fetchRelatorios]);

  const showSuccess = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  const handleToggleAtivo = async (relatorio: RelatorioConfig) => {
    const { error } = await supabase
      .from('gia_relatorios_config' as any)
      .update({ ativo: !relatorio.ativo, updated_at: new Date().toISOString() })
      .eq('id', relatorio.id);

    if (!error) {
      setRelatorios(prev =>
        prev.map(r => r.id === relatorio.id ? { ...r, ativo: !r.ativo } : r)
      );
    }
  };

  const handleAddHorario = async (relatorio: RelatorioConfig) => {
    const newTime = newHorarioInput[relatorio.id];
    if (!newTime) return;
    if (relatorio.horarios.includes(newTime)) return;

    const updatedHorarios = [...relatorio.horarios, newTime].sort();
    setSaving(relatorio.id);

    const { error } = await supabase
      .from('gia_relatorios_config' as any)
      .update({ horarios: updatedHorarios, updated_at: new Date().toISOString() })
      .eq('id', relatorio.id);

    if (!error) {
      setRelatorios(prev =>
        prev.map(r => r.id === relatorio.id ? { ...r, horarios: updatedHorarios } : r)
      );
      setNewHorarioInput(prev => ({ ...prev, [relatorio.id]: '' }));
      showSuccess('Horário adicionado!');
    }
    setSaving(null);
  };

  const handleRemoveHorario = async (relatorio: RelatorioConfig, horario: string) => {
    const updatedHorarios = relatorio.horarios.filter(h => h !== horario);
    setSaving(relatorio.id);

    const { error } = await supabase
      .from('gia_relatorios_config' as any)
      .update({ horarios: updatedHorarios, updated_at: new Date().toISOString() })
      .eq('id', relatorio.id);

    if (!error) {
      setRelatorios(prev =>
        prev.map(r => r.id === relatorio.id ? { ...r, horarios: updatedHorarios } : r)
      );
      showSuccess('Horário removido!');
    }
    setSaving(null);
  };

  const handleToggleDia = async (relatorio: RelatorioConfig, dia: number) => {
    const current = relatorio.dias_semana;
    const updatedDias = current.includes(dia)
      ? current.filter(d => d !== dia)
      : [...current, dia].sort((a, b) => a - b);

    setSaving(relatorio.id);

    const { error } = await supabase
      .from('gia_relatorios_config' as any)
      .update({ dias_semana: updatedDias, updated_at: new Date().toISOString() })
      .eq('id', relatorio.id);

    if (!error) {
      setRelatorios(prev =>
        prev.map(r => r.id === relatorio.id ? { ...r, dias_semana: updatedDias } : r)
      );
    }
    setSaving(null);
  };

  const getDiasLabel = (dias: number[]) => {
    if (dias.length === 7) return 'Todos os dias';
    if (dias.length === 0) return 'Nenhum dia';
    if (JSON.stringify(dias) === JSON.stringify([1, 2, 3, 4, 5])) return 'Seg a Sex';
    if (JSON.stringify(dias) === JSON.stringify([1, 2, 3, 4, 5, 6])) return 'Seg a Sáb';
    return dias.map(d => DIAS_SEMANA_LABELS[d]).join(', ');
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="tech-heading text-2xl flex items-center gap-3">
          <Send className="w-7 h-7 text-[#39FF14]" />
          Central de Relatórios
        </h2>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#39FF14] animate-pulse" />
            {relatorios.filter(r => r.ativo).length} ativos
          </span>
          <span className="text-sm text-gray-500">
            {relatorios.length} relatórios configurados
          </span>
        </div>
      </div>

      {/* Info Banner */}
      <div className="bg-[#39FF14]/5 border border-[#39FF14]/20 rounded-xl px-5 py-4 flex items-start gap-3">
        <Info className="w-5 h-5 text-[#39FF14] mt-0.5 flex-shrink-0" />
        <div className="text-sm text-gray-300">
          <p className="font-medium text-white mb-1">Relatórios enviados pela GIA no WhatsApp</p>
          <p className="text-gray-400">
            Gerencie os horários e dias da semana de cada relatório. Clique em um relatório para expandir e editar os detalhes.
          </p>
        </div>
      </div>

      {/* Success Message */}
      {successMessage && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-lg px-4 py-3 text-green-400 text-sm animate-in fade-in duration-200">
          {successMessage}
        </div>
      )}

      {/* Reports List */}
      <div className="space-y-3">
        {relatorios.map((relatorio) => {
          const isExpanded = expandedId === relatorio.id;
          const isSaving = saving === relatorio.id;

          return (
            <div
              key={relatorio.id}
              className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                relatorio.ativo
                  ? 'bg-gray-900/60 border-gray-700/60 hover:border-[#39FF14]/30'
                  : 'bg-gray-900/30 border-gray-800/40 opacity-60'
              }`}
            >
              {/* Main Row */}
              <div
                className="flex items-center gap-4 px-5 py-4 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : relatorio.id)}
              >
                {/* Toggle */}
                <button
                  onClick={(e) => { e.stopPropagation(); handleToggleAtivo(relatorio); }}
                  className="flex-shrink-0 transition-transform hover:scale-110"
                  title={relatorio.ativo ? 'Desativar' : 'Ativar'}
                >
                  {relatorio.ativo ? (
                    <ToggleRight className="w-7 h-7 text-[#39FF14]" />
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

                {/* Schedule summary */}
                <div className="hidden sm:flex items-center gap-3 flex-shrink-0">
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Clock className="w-3.5 h-3.5" />
                    <span className="font-mono">
                      {relatorio.horarios.length > 0
                        ? relatorio.horarios.length === 1
                          ? relatorio.horarios[0]
                          : `${relatorio.horarios.length}x/dia`
                        : '—'
                      }
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-gray-400">
                    <Calendar className="w-3.5 h-3.5" />
                    <span>{getDiasLabel(relatorio.dias_semana)}</span>
                  </div>
                </div>

                {/* Expand/Collapse */}
                <div className="flex-shrink-0">
                  {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                  )}
                </div>
              </div>

              {/* Expanded Details */}
              {isExpanded && (
                <div className="border-t border-gray-700/50 px-5 py-5 space-y-5">
                  {/* Horarios Section */}
                  <div>
                    <label className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-3">
                      <Clock className="w-4 h-4 text-[#39FF14]" />
                      Horários de Envio
                    </label>

                    <div className="flex flex-wrap gap-2 mb-3">
                      {relatorio.horarios.length === 0 && (
                        <span className="text-sm text-gray-500 italic">Nenhum horário definido</span>
                      )}
                      {relatorio.horarios.map(horario => (
                        <div
                          key={horario}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gray-800 border border-gray-600 text-sm text-white font-mono group"
                        >
                          <Clock className="w-3.5 h-3.5 text-gray-400" />
                          {horario}
                          <button
                            onClick={() => handleRemoveHorario(relatorio, horario)}
                            className="ml-1 p-0.5 rounded text-gray-500 hover:text-red-400 hover:bg-red-400/10 transition-colors opacity-0 group-hover:opacity-100"
                            title="Remover horário"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>

                    {/* Add new horario */}
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        value={newHorarioInput[relatorio.id] || ''}
                        onChange={(e) => setNewHorarioInput(prev => ({ ...prev, [relatorio.id]: e.target.value }))}
                        className="bg-gray-800 border border-gray-600 rounded-lg px-3 py-2 text-sm text-white w-[130px] focus:border-[#39FF14] focus:ring-1 focus:ring-[#39FF14] outline-none transition-all"
                      />
                      <button
                        onClick={() => handleAddHorario(relatorio)}
                        disabled={!newHorarioInput[relatorio.id] || isSaving}
                        className="flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg bg-[#39FF14]/10 border border-[#39FF14]/30 text-[#39FF14] hover:bg-[#39FF14]/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        <Plus className="w-4 h-4" />
                        Adicionar
                      </button>
                      {isSaving && <Loader2 className="w-4 h-4 text-[#39FF14] animate-spin" />}
                    </div>
                  </div>

                  {/* Dias da Semana Section */}
                  <div>
                    <label className="text-sm font-medium text-gray-300 flex items-center gap-2 mb-3">
                      <Calendar className="w-4 h-4 text-[#39FF14]" />
                      Dias da Semana
                    </label>

                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 4, 5, 6, 0].map(dia => {
                        const isActive = relatorio.dias_semana.includes(dia);
                        return (
                          <button
                            key={dia}
                            onClick={() => handleToggleDia(relatorio, dia)}
                            className={`px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
                              isActive
                                ? 'bg-[#39FF14]/15 border-[#39FF14]/40 text-[#39FF14]'
                                : 'bg-gray-800/50 border-gray-700 text-gray-500 hover:border-gray-500 hover:text-gray-300'
                            }`}
                            title={DIAS_SEMANA_FULL[dia]}
                          >
                            {DIAS_SEMANA_LABELS[dia]}
                          </button>
                        );
                      })}
                    </div>

                    <p className="text-xs text-gray-500 mt-2">
                      O relatório será enviado apenas nos dias selecionados nos horários definidos acima.
                    </p>
                  </div>

                  {/* Info footer */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-700/50">
                    <div className="text-xs text-gray-500">
                      Última atualização: {new Date(relatorio.updated_at).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}
                    </div>
                    {relatorio.grupo_destino && (
                      <div className="text-xs text-gray-500 flex items-center gap-1.5">
                        <Send className="w-3 h-3" />
                        Grupo configurado
                      </div>
                    )}
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
            Os relatórios da GIA aparecerão aqui conforme forem sendo criados.
          </p>
        </div>
      )}
    </div>
  );
}
