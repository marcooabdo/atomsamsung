import { useState, useEffect } from 'react';
import { X, Target, Save, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface GoalsConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  unidadeId: string;
  onSaved?: () => void;
}

interface PerformanceGoal {
  id?: string;
  unidade_id: string;
  ano: number;
  mes: number;
  meta_receita_lp: number;
  meta_receita_ow: number;
  meta_eficiencia_operacional: number;
  meta_taxa_aprovacao: number;
}

const ACCENT_FIELDS = [
  { key: 'meta_receita_lp' as const,             label: 'Meta Receita LP',          prefix: 'R$', min: 0,   step: 100, max: undefined,  hint: null,                                  rgb: '168,85,247',  color: '#A855F7' },
  { key: 'meta_receita_ow' as const,             label: 'Meta Receita OW',          prefix: 'R$', min: 0,   step: 100, max: undefined,  hint: null,                                  rgb: '14,165,233',  color: '#0EA5E9' },
  { key: 'meta_eficiencia_operacional' as const, label: 'Meta Eficiência (dias)',   prefix: null, min: 1,   step: 0.5, max: undefined,  hint: 'Tempo máximo ideal para conclusão de OS', rgb: '6,182,212',  color: '#06B6D4' },
  { key: 'meta_taxa_aprovacao' as const,         label: 'Meta Taxa Aprovação (%)', prefix: null, min: 0,   step: 1,   max: 100,        hint: 'Percentual de aprovações esperado',   rgb: '16,185,129',  color: '#10B981' },
];

export function GoalsConfigModal({ isOpen, onClose, unidadeId, onSaved }: GoalsConfigModalProps) {
  const { usuario } = useAuth();
  const [saving, setSaving] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [goals, setGoals] = useState<PerformanceGoal>({
    unidade_id: unidadeId,
    ano: selectedYear,
    mes: selectedMonth,
    meta_receita_lp: 0,
    meta_receita_ow: 0,
    meta_eficiencia_operacional: 3,
    meta_taxa_aprovacao: 90
  });

  useEffect(() => {
    if (isOpen && unidadeId) loadGoals();
  }, [isOpen, unidadeId, selectedMonth, selectedYear]);

  const loadGoals = async () => {
    try {
      const { data, error } = await supabase
        .from('metas_performance').select('*')
        .eq('unidade_id', unidadeId).eq('ano', selectedYear).eq('mes', selectedMonth)
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setGoals({ ...data, meta_receita_lp: Number(data.meta_receita_lp), meta_receita_ow: Number(data.meta_receita_ow), meta_eficiencia_operacional: Number(data.meta_eficiencia_operacional), meta_taxa_aprovacao: Number(data.meta_taxa_aprovacao) });
      } else {
        setGoals({ unidade_id: unidadeId, ano: selectedYear, mes: selectedMonth, meta_receita_lp: 0, meta_receita_ow: 0, meta_eficiencia_operacional: 3, meta_taxa_aprovacao: 90 });
      }
    } catch (_) {}
  };

  const handleSave = async () => {
    if (!usuario?.id) { alert('Usuário não identificado.'); return; }
    if (!unidadeId)   { alert('Unidade não identificada.'); return; }
    setSaving(true);
    try {
      const goalData = { unidade_id: unidadeId, ano: selectedYear, mes: selectedMonth, meta_receita_lp: goals.meta_receita_lp, meta_receita_ow: goals.meta_receita_ow, meta_eficiencia_operacional: goals.meta_eficiencia_operacional, meta_taxa_aprovacao: goals.meta_taxa_aprovacao, criado_por: usuario.id };
      const { error } = goals.id
        ? await supabase.from('metas_performance').update(goalData).eq('id', goals.id)
        : await supabase.from('metas_performance').insert([goalData]);
      if (error) throw error;
      if (onSaved) onSaved();
      onClose();
    } catch (error: unknown) {
      alert(`Erro ao salvar metas: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const months = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];
  const years = Array.from({ length: 3 }, (_, i) => new Date().getFullYear() - 1 + i);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div
        className="w-full max-w-2xl rounded-xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-accent)', boxShadow: 'var(--card-shadow)' }}
      >
        {/* Header */}
        <div className="p-6 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg"
              style={{ background: 'rgba(var(--accent-rgb),0.12)', border: '1px solid rgba(var(--accent-rgb),0.3)' }}
            >
              <Target className="w-5 h-5" style={{ color: 'var(--text-accent)' }} />
            </div>
            <div>
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>Configurar Metas</h2>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Defina as metas de performance para o período</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-all duration-300"
            style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.3)', color: '#EF4444' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.20)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.10)'; }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Period */}
          <div
            className="p-4 rounded-lg"
            style={{ background: 'rgba(var(--accent-rgb),0.06)', border: '1px solid rgba(var(--accent-rgb),0.2)' }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4" style={{ color: 'var(--text-accent)' }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--text-accent)' }}>Período</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Mês', value: selectedMonth, onChange: (v: number) => setSelectedMonth(v), options: months.map((m, i) => ({ value: i + 1, label: m })) },
                { label: 'Ano', value: selectedYear,  onChange: (v: number) => setSelectedYear(v),  options: years.map(y => ({ value: y, label: String(y) })) },
              ].map(({ label, value, onChange, options }) => (
                <div key={label}>
                  <label className="block text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>{label}</label>
                  <select
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                  >
                    {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

          {/* Goal fields */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {ACCENT_FIELDS.map((field) => (
              <div
                key={field.key}
                className="p-4 rounded-lg"
                style={{ background: `rgba(${field.rgb},0.06)`, border: `1px solid rgba(${field.rgb},0.2)` }}
              >
                <label className="block text-xs font-bold uppercase tracking-wider mb-2" style={{ color: field.color }}>
                  {field.label}
                </label>
                <div className="relative">
                  {field.prefix && (
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                      {field.prefix}
                    </span>
                  )}
                  <input
                    type="number"
                    value={goals[field.key]}
                    onChange={(e) => setGoals({ ...goals, [field.key]: Number(e.target.value) })}
                    className="w-full py-2 rounded-lg text-sm"
                    style={{
                      paddingLeft: field.prefix ? '2.5rem' : '0.75rem',
                      paddingRight: '0.75rem',
                      background: 'var(--bg-secondary)',
                      border: `1px solid rgba(${field.rgb},0.3)`,
                      color: 'var(--text-primary)'
                    }}
                    min={field.min}
                    step={field.step}
                    {...(field.max !== undefined ? { max: field.max } : {})}
                  />
                </div>
                {field.hint && (
                  <p className="text-[10px] mt-1" style={{ color: 'var(--text-secondary)' }}>{field.hint}</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 flex justify-end gap-3" style={{ borderTop: '1px solid var(--border-primary)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-bold transition-all duration-300"
            style={{ background: 'transparent', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(var(--accent-rgb),0.06)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-all duration-300"
            style={{ background: 'rgba(var(--accent-rgb),0.15)', border: '1px solid rgba(var(--accent-rgb),0.4)', color: 'var(--text-accent)', opacity: saving ? 0.5 : 1 }}
            onMouseEnter={(e) => { if (!saving) { e.currentTarget.style.background = 'rgba(var(--accent-rgb),0.25)'; e.currentTarget.style.transform = 'translateY(-1px)'; } }}
            onMouseLeave={(e) => { if (!saving) { e.currentTarget.style.background = 'rgba(var(--accent-rgb),0.15)'; e.currentTarget.style.transform = 'translateY(0)'; } }}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar Metas'}
          </button>
        </div>
      </div>
    </div>
  );
}
