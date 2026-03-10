import { useState } from 'react';
import {
  CheckCircle2, DollarSign, FileText, Calendar, Tag,
  X, Loader2, ShoppingCart, Send, Clock, Info,
  PhoneOff, Undo2, AlertCircle
} from 'lucide-react';
import { motion } from 'framer-motion';

interface Props {
  accentColor: string;
  isDark: boolean;
  clienteNome: string | null;
  clienteTelefone: string;
  onConfirm: (data: ClosureData) => Promise<void>;
  onCancel: () => void;
}

export interface ClosureData {
  resultado_conversa: string;
  valor_orcamento: number | null;
  resumo_fechamento: string;
  proxima_acao_data: string | null;
  proxima_acao_descricao: string;
  tags_oportunidade: string[];
}

const RESULTADOS = [
  { value: 'venda_realizada', label: 'Venda Realizada', icon: ShoppingCart, color: '#10b981' },
  { value: 'orcamento_enviado', label: 'Orcamento Enviado', icon: Send, color: '#3b82f6' },
  { value: 'orcamento_recusado', label: 'Orcamento Recusado', icon: X, color: '#ef4444' },
  { value: 'agendamento_marcado', label: 'Agendamento Marcado', icon: Calendar, color: '#8b5cf6' },
  { value: 'apenas_informacao', label: 'Apenas Informacao', icon: Info, color: '#6b7280' },
  { value: 'sem_interesse', label: 'Sem Interesse', icon: PhoneOff, color: '#f59e0b' },
  { value: 'retornar_depois', label: 'Retornar Depois', icon: Clock, color: '#f97316' },
  { value: 'outro', label: 'Outro', icon: FileText, color: '#64748b' },
];

const TAGS_OPTIONS = [
  { value: 'venda_perdida', label: 'Venda Perdida', color: '#ef4444' },
  { value: 'orcamento_pendente', label: 'Orcamento Pendente', color: '#f59e0b' },
  { value: 'cliente_quente', label: 'Cliente Quente', color: '#f97316' },
  { value: 'recontatar', label: 'Recontatar', color: '#3b82f6' },
  { value: 'fidelizar', label: 'Fidelizar', color: '#10b981' },
  { value: 'indicacao', label: 'Indicacao', color: '#8b5cf6' },
];

const showValorFor = ['venda_realizada', 'orcamento_enviado', 'orcamento_recusado'];
const showFollowUpFor = ['orcamento_enviado', 'retornar_depois', 'agendamento_marcado'];

export function FinalizarConversaModal({ accentColor, isDark, clienteNome, clienteTelefone, onConfirm, onCancel }: Props) {
  const [resultado, setResultado] = useState('');
  const [valor, setValor] = useState('');
  const [resumo, setResumo] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [followUpDesc, setFollowUpDesc] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const dropdownBg = 'var(--bg-card)';
  const dropdownBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
  const textPrimary = 'var(--text-primary)';
  const textSecondary = 'var(--text-secondary)';
  const inputBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const handleConfirm = async () => {
    if (!resultado) {
      setError('Selecione o resultado da conversa');
      return;
    }
    if (!resumo.trim()) {
      setError('Escreva um resumo do atendimento');
      return;
    }
    setError('');
    setSaving(true);

    try {
      await onConfirm({
        resultado_conversa: resultado,
        valor_orcamento: valor ? parseFloat(valor.replace(',', '.')) : null,
        resumo_fechamento: resumo.trim(),
        proxima_acao_data: followUpDate || null,
        proxima_acao_descricao: followUpDesc.trim(),
        tags_oportunidade: selectedTags,
      });
    } catch {
      setError('Erro ao finalizar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  const showValor = showValorFor.includes(resultado);
  const showFollowUp = showFollowUpFor.includes(resultado);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 bg-black/80 flex items-center justify-center z-50"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.92, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.92, opacity: 0, y: 20 }}
        className="rounded-xl w-[520px] max-h-[90vh] overflow-hidden flex flex-col"
        style={{ background: dropdownBg, border: `1px solid ${dropdownBorder}` }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: dropdownBorder }}>
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: `linear-gradient(135deg, ${accentColor}20, ${accentColor}40)` }}
            >
              <CheckCircle2 className="w-5 h-5" style={{ color: accentColor }} />
            </div>
            <div>
              <h3 className="text-sm font-bold" style={{ color: textPrimary }}>Finalizar Atendimento</h3>
              <p className="text-xs" style={{ color: textSecondary }}>
                {clienteNome || clienteTelefone}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
          >
            <X className="w-4 h-4" style={{ color: textSecondary }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5" style={{ scrollbarWidth: 'thin' }}>
          <div>
            <label className="text-xs font-semibold mb-2.5 flex items-center gap-1.5" style={{ color: textPrimary }}>
              <FileText className="w-3.5 h-3.5" style={{ color: accentColor }} />
              Resultado da Conversa *
            </label>
            <div className="grid grid-cols-2 gap-1.5">
              {RESULTADOS.map(r => {
                const Icon = r.icon;
                const selected = resultado === r.value;
                return (
                  <button
                    key={r.value}
                    onClick={() => { setResultado(r.value); setError(''); }}
                    className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left"
                    style={{
                      backgroundColor: selected ? `${r.color}20` : isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                      border: `1.5px solid ${selected ? `${r.color}60` : 'transparent'}`,
                      color: selected ? r.color : isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                    }}
                  >
                    <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                    {r.label}
                  </button>
                );
              })}
            </div>
          </div>

          {showValor && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              transition={{ duration: 0.2 }}
            >
              <label className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: textPrimary }}>
                <DollarSign className="w-3.5 h-3.5" style={{ color: accentColor }} />
                Valor do Orcamento (R$)
              </label>
              <input
                type="text"
                value={valor}
                onChange={(e) => {
                  const v = e.target.value.replace(/[^\d,.]/g, '');
                  setValor(v);
                }}
                placeholder="0,00"
                className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none transition-all"
                style={{
                  backgroundColor: inputBg,
                  border: `1px solid ${dropdownBorder}`,
                  color: textPrimary,
                }}
              />
            </motion.div>
          )}

          <div>
            <label className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: textPrimary }}>
              <FileText className="w-3.5 h-3.5" style={{ color: accentColor }} />
              Resumo do Atendimento *
            </label>
            <textarea
              value={resumo}
              onChange={(e) => { setResumo(e.target.value); setError(''); }}
              placeholder="Descreva o que aconteceu na conversa, o que o cliente queria, decisoes tomadas..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg text-xs focus:outline-none transition-all resize-none leading-relaxed"
              style={{
                backgroundColor: inputBg,
                border: `1px solid ${dropdownBorder}`,
                color: textPrimary,
              }}
            />
          </div>

          {showFollowUp && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="space-y-2"
            >
              <label className="text-xs font-semibold flex items-center gap-1.5" style={{ color: textPrimary }}>
                <Calendar className="w-3.5 h-3.5" style={{ color: accentColor }} />
                Follow-up
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={followUpDate}
                  onChange={(e) => setFollowUpDate(e.target.value)}
                  className="px-3 py-2 rounded-lg text-xs focus:outline-none"
                  style={{
                    backgroundColor: inputBg,
                    border: `1px solid ${dropdownBorder}`,
                    color: textPrimary,
                    colorScheme: isDark ? 'dark' : 'light',
                  }}
                />
                <input
                  type="text"
                  value={followUpDesc}
                  onChange={(e) => setFollowUpDesc(e.target.value)}
                  placeholder="Ex: Ligar para confirmar"
                  className="px-3 py-2 rounded-lg text-xs focus:outline-none"
                  style={{
                    backgroundColor: inputBg,
                    border: `1px solid ${dropdownBorder}`,
                    color: textPrimary,
                  }}
                />
              </div>
            </motion.div>
          )}

          <div>
            <label className="text-xs font-semibold mb-2 flex items-center gap-1.5" style={{ color: textPrimary }}>
              <Tag className="w-3.5 h-3.5" style={{ color: accentColor }} />
              Tags de Oportunidade
            </label>
            <div className="flex flex-wrap gap-1.5">
              {TAGS_OPTIONS.map(tag => {
                const selected = selectedTags.includes(tag.value);
                return (
                  <button
                    key={tag.value}
                    onClick={() => toggleTag(tag.value)}
                    className="px-2.5 py-1 rounded-full text-[11px] font-medium transition-all"
                    style={{
                      backgroundColor: selected ? `${tag.color}20` : isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)',
                      border: `1px solid ${selected ? `${tag.color}50` : 'transparent'}`,
                      color: selected ? tag.color : isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                    }}
                  >
                    {tag.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {error && (
          <div className="mx-5 mb-2 flex items-center gap-2 p-2.5 rounded-lg bg-red-500/10 border border-red-500/20">
            <AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
            <span className="text-xs text-red-400">{error}</span>
          </div>
        )}

        <div className="p-5 border-t flex items-center gap-3" style={{ borderColor: dropdownBorder }}>
          <button
            onClick={onCancel}
            className="flex-1 px-4 py-2.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              backgroundColor: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              color: textSecondary,
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50"
            style={{
              background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)`,
              color: '#000',
              boxShadow: `0 0 20px ${accentColor}30`,
            }}
          >
            {saving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCircle2 className="w-3.5 h-3.5" />
            )}
            Finalizar Atendimento
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
