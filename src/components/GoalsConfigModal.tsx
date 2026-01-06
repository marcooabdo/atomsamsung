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

export function GoalsConfigModal({ isOpen, onClose, unidadeId, onSaved }: GoalsConfigModalProps) {
  const { user } = useAuth();
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
    if (isOpen && unidadeId) {
      loadGoals();
    }
  }, [isOpen, unidadeId, selectedMonth, selectedYear]);

  const loadGoals = async () => {
    try {
      const { data, error } = await supabase
        .from('metas_performance')
        .select('*')
        .eq('unidade_id', unidadeId)
        .eq('ano', selectedYear)
        .eq('mes', selectedMonth)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setGoals({
          ...data,
          meta_receita_lp: Number(data.meta_receita_lp),
          meta_receita_ow: Number(data.meta_receita_ow),
          meta_eficiencia_operacional: Number(data.meta_eficiencia_operacional),
          meta_taxa_aprovacao: Number(data.meta_taxa_aprovacao)
        });
      } else {
        setGoals({
          unidade_id: unidadeId,
          ano: selectedYear,
          mes: selectedMonth,
          meta_receita_lp: 0,
          meta_receita_ow: 0,
          meta_eficiencia_operacional: 3,
          meta_taxa_aprovacao: 90
        });
      }
    } catch (error) {
    }
  };

  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    try {
      const goalData = {
        unidade_id: unidadeId,
        ano: selectedYear,
        mes: selectedMonth,
        meta_receita_lp: goals.meta_receita_lp,
        meta_receita_ow: goals.meta_receita_ow,
        meta_eficiencia_operacional: goals.meta_eficiencia_operacional,
        meta_taxa_aprovacao: goals.meta_taxa_aprovacao,
        criado_por: user.id
      };

      if (goals.id) {
        const { error } = await supabase
          .from('metas_performance')
          .update(goalData)
          .eq('id', goals.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('metas_performance')
          .insert([goalData]);

        if (error) throw error;
      }

      if (onSaved) onSaved();
      onClose();
    } catch (error) {
      alert('Erro ao salvar metas. Verifique os dados e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  const months = [
    'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
    'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 3 }, (_, i) => currentYear - 1 + i);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
      <div
        className="w-full max-w-2xl rounded-xl"
        style={{
          background: 'linear-gradient(135deg, rgba(0,0,0,0.95) 0%, rgba(10,10,10,0.98) 100%)',
          border: '1px solid rgba(16,185,129,0.3)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(16,185,129,0.1)'
        }}
      >
        <div className="p-6 border-b border-gray-800/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.05) 100%)',
                border: '1px solid rgba(16,185,129,0.3)',
                boxShadow: '0 0 12px rgba(16,185,129,0.15)'
              }}
            >
              <Target className="w-5 h-5 text-[#10B981]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Configurar Metas</h2>
              <p className="text-xs text-gray-400 mt-1">
                Defina as metas de performance para o período
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-all duration-300"
            style={{
              background: 'linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(239,68,68,0.1) 100%)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#EF4444'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(239,68,68,0.3) 0%, rgba(239,68,68,0.2) 100%)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(239,68,68,0.1) 100%)';
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div
            className="p-4 rounded-lg"
            style={{
              background: 'linear-gradient(135deg, rgba(6,182,212,0.08) 0%, rgba(6,182,212,0.02) 100%)',
              border: '1px solid rgba(6,182,212,0.2)'
            }}
          >
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-4 h-4 text-[#06B6D4]" />
              <span className="text-xs font-bold text-[#06B6D4] uppercase tracking-wider">Período</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-2">Mês</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white"
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  {months.map((month, index) => (
                    <option key={index} value={index + 1}>{month}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-2">Ano</label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full px-3 py-2 rounded-lg text-sm text-white"
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  {years.map((year) => (
                    <option key={year} value={year}>{year}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div
              className="p-4 rounded-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(168,85,247,0.08) 0%, rgba(168,85,247,0.02) 100%)',
                border: '1px solid rgba(168,85,247,0.2)'
              }}
            >
              <label className="block text-xs font-bold text-[#A855F7] uppercase tracking-wider mb-2">
                Meta Receita LP
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">R$</span>
                <input
                  type="number"
                  value={goals.meta_receita_lp}
                  onChange={(e) => setGoals({ ...goals, meta_receita_lp: Number(e.target.value) })}
                  className="w-full pl-10 pr-3 py-2 rounded-lg text-sm text-white"
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(168,85,247,0.3)'
                  }}
                  min="0"
                  step="100"
                />
              </div>
            </div>

            <div
              className="p-4 rounded-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(14,165,233,0.08) 0%, rgba(14,165,233,0.02) 100%)',
                border: '1px solid rgba(14,165,233,0.2)'
              }}
            >
              <label className="block text-xs font-bold text-[#0EA5E9] uppercase tracking-wider mb-2">
                Meta Receita OW
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400">R$</span>
                <input
                  type="number"
                  value={goals.meta_receita_ow}
                  onChange={(e) => setGoals({ ...goals, meta_receita_ow: Number(e.target.value) })}
                  className="w-full pl-10 pr-3 py-2 rounded-lg text-sm text-white"
                  style={{
                    background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(14,165,233,0.3)'
                  }}
                  min="0"
                  step="100"
                />
              </div>
            </div>

            <div
              className="p-4 rounded-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(6,182,212,0.08) 0%, rgba(6,182,212,0.02) 100%)',
                border: '1px solid rgba(6,182,212,0.2)'
              }}
            >
              <label className="block text-xs font-bold text-[#06B6D4] uppercase tracking-wider mb-2">
                Meta Eficiência (dias)
              </label>
              <input
                type="number"
                value={goals.meta_eficiencia_operacional}
                onChange={(e) => setGoals({ ...goals, meta_eficiencia_operacional: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg text-sm text-white"
                style={{
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(6,182,212,0.3)'
                }}
                min="1"
                step="0.5"
              />
              <p className="text-[10px] text-gray-500 mt-1">
                Tempo máximo ideal para conclusão de OS
              </p>
            </div>

            <div
              className="p-4 rounded-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(16,185,129,0.02) 100%)',
                border: '1px solid rgba(16,185,129,0.2)'
              }}
            >
              <label className="block text-xs font-bold text-[#10B981] uppercase tracking-wider mb-2">
                Meta Taxa Aprovação (%)
              </label>
              <input
                type="number"
                value={goals.meta_taxa_aprovacao}
                onChange={(e) => setGoals({ ...goals, meta_taxa_aprovacao: Number(e.target.value) })}
                className="w-full px-3 py-2 rounded-lg text-sm text-white"
                style={{
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(16,185,129,0.3)'
                }}
                min="0"
                max="100"
                step="1"
              />
              <p className="text-[10px] text-gray-500 mt-1">
                Percentual de aprovações esperado
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 border-t border-gray-800/50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm font-bold text-gray-400 transition-all duration-300"
            style={{
              background: 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
              border: '1px solid rgba(255,255,255,0.1)'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)';
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-6 py-2 rounded-lg flex items-center gap-2 text-sm font-bold transition-all duration-300"
            style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(16,185,129,0.1) 100%)',
              border: '1px solid rgba(16,185,129,0.3)',
              color: '#10B981',
              opacity: saving ? 0.5 : 1
            }}
            onMouseEnter={(e) => {
              if (!saving) {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(16,185,129,0.3) 0%, rgba(16,185,129,0.2) 100%)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }
            }}
            onMouseLeave={(e) => {
              if (!saving) {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(16,185,129,0.1) 100%)';
                e.currentTarget.style.transform = 'translateY(0)';
              }
            }}
          >
            <Save className="w-4 h-4" />
            {saving ? 'Salvando...' : 'Salvar Metas'}
          </button>
        </div>
      </div>
    </div>
  );
}
