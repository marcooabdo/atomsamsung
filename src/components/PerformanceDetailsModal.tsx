import { X, Download, TrendingUp, TrendingDown, Clock, CheckCircle, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface PerformanceOS {
  id: string;
  numero_os: string;
  tipo_os: 'LP' | 'OW';
  cliente_nome: string;
  created_at: string;
  fechada_em: string | null;
  coluna_kanban: string;
  tempo_resolucao_dias: number;
  valor_total: number;
  status_final: 'aprovado' | 'reprovado' | 'aberto';
}

interface PerformanceDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  metric: 'eficiencia' | 'aprovacao';
  title: string;
  osList: PerformanceOS[];
  targetValue?: number;
  currentValue: number;
}

const STATUS: Record<string, { color: string; rgb: string }> = {
  aprovado:  { color: '#10B981', rgb: '16,185,129' },
  reprovado: { color: '#EF4444', rgb: '239,68,68' },
  aberto:    { color: '#F59E0B', rgb: '245,158,11' },
};

const TIPO: Record<string, { color: string; rgb: string }> = {
  LP: { color: '#A855F7', rgb: '168,85,247' },
  OW: { color: '#0EA5E9', rgb: '14,165,233' },
};

const tempoColor = (d: number) => d <= 3 ? STATUS.aprovado.color : d <= 7 ? STATUS.aberto.color : STATUS.reprovado.color;

export function PerformanceDetailsModal({ isOpen, onClose, metric, title, osList, targetValue, currentValue }: PerformanceDetailsModalProps) {
  if (!isOpen) return null;

  const exportToExcel = () => {
    const ws = XLSX.utils.json_to_sheet(osList.map(os => ({
      'Número OS': os.numero_os, 'Tipo': os.tipo_os, 'Cliente': os.cliente_nome,
      'Data Abertura': new Date(os.created_at).toLocaleDateString('pt-BR'),
      'Data Fechamento': os.fechada_em ? new Date(os.fechada_em).toLocaleDateString('pt-BR') : 'Em aberto',
      'Status': os.status_final === 'aprovado' ? 'Aprovado' : os.status_final === 'reprovado' ? 'Reprovado' : 'Em aberto',
      'Tempo (dias)': os.tempo_resolucao_dias, 'Valor Total': `R$ ${os.valor_total.toFixed(2)}`, 'Coluna': os.coluna_kanban
    })));
    ws['!cols'] = [15,8,30,15,15,12,20,15,20].map(w => ({ width: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Performance');
    XLSX.writeFile(wb, `performance_${metric}_${Date.now()}.xlsx`);
  };

  const MetricIcon = metric === 'eficiencia' ? Clock : CheckCircle;
  const statusEntry = (s: string) => STATUS[s] ?? STATUS.aberto;
  const statusIcon  = (s: string) => s === 'aprovado' ? <CheckCircle className="w-4 h-4" /> : s === 'reprovado' ? <XCircle className="w-4 h-4" /> : <Clock className="w-4 h-4" />;

  const goalMet = targetValue !== undefined && currentValue >= targetValue;
  const ok  = STATUS.aprovado;
  const err = STATUS.reprovado;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div
        className="w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-xl"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-accent)', boxShadow: 'var(--card-shadow)' }}
      >
        {/* Header */}
        <div className="p-6 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg" style={{ background: 'rgba(var(--accent-rgb),0.12)', border: '1px solid rgba(var(--accent-rgb),0.3)' }}>
              <MetricIcon className="w-5 h-5" style={{ color: 'var(--text-accent)' }} />
            </div>
            <div>
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{osList.length} ordem(ns) de serviço analisada(s)</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={exportToExcel}
              className="px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-bold transition-all duration-300"
              style={{ background: `rgba(${ok.rgb},0.10)`, border: `1px solid rgba(${ok.rgb},0.3)`, color: ok.color }}
              onMouseEnter={(e) => { e.currentTarget.style.background = `rgba(${ok.rgb},0.20)`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = `rgba(${ok.rgb},0.10)`; e.currentTarget.style.transform = 'translateY(0)'; }}
            >
              <Download className="w-4 h-4" />Exportar Excel
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-all duration-300"
              style={{ background: `rgba(${err.rgb},0.10)`, border: `1px solid rgba(${err.rgb},0.3)`, color: err.color }}
              onMouseEnter={(e) => { e.currentTarget.style.background = `rgba(${err.rgb},0.20)`; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = `rgba(${err.rgb},0.10)`; }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Summary */}
        <div className="p-6" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 rounded-lg" style={{ background: 'rgba(var(--accent-rgb),0.06)', border: '1px solid rgba(var(--accent-rgb),0.2)' }}>
              <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>Valor Atual</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-accent)' }}>
                {metric === 'eficiencia' ? `${currentValue.toFixed(1)} dias` : `${currentValue.toFixed(1)}%`}
              </p>
            </div>
            {targetValue !== undefined && (
              <div className="p-4 rounded-lg" style={{ background: `rgba(${ok.rgb},0.06)`, border: `1px solid rgba(${ok.rgb},0.2)` }}>
                <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>Meta</p>
                <p className="text-2xl font-bold" style={{ color: ok.color }}>
                  {metric === 'eficiencia' ? `${targetValue.toFixed(1)} dias` : `${targetValue.toFixed(1)}%`}
                </p>
              </div>
            )}
            <div className="p-4 rounded-lg" style={{ background: `rgba(${goalMet ? ok.rgb : err.rgb},0.06)`, border: `1px solid rgba(${goalMet ? ok.rgb : err.rgb},0.2)` }}>
              <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>Status</p>
              <div className="flex items-center gap-2">
                {goalMet
                  ? <><TrendingUp className="w-5 h-5" style={{ color: ok.color }} /><p className="text-xl font-bold" style={{ color: ok.color }}>Atingido</p></>
                  : <><TrendingDown className="w-5 h-5" style={{ color: err.color }} /><p className="text-xl font-bold" style={{ color: err.color }}>Abaixo</p></>
                }
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-y-auto max-h-[calc(90vh-300px)]">
          <table className="w-full">
            <thead className="sticky top-0 z-10" style={{ background: 'var(--bg-card)' }}>
              <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                {['OS','Tipo','Cliente','Abertura','Fechamento','Status','Tempo','Valor'].map((h, i) => (
                  <th key={h} className={`${i === 7 ? 'text-right' : 'text-left'} p-4 text-[10px] font-bold uppercase tracking-wider`} style={{ color: 'var(--text-secondary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {osList.map((os) => {
                const se = statusEntry(os.status_final);
                const te = TIPO[os.tipo_os] ?? TIPO.OW;
                return (
                  <tr key={os.id} className="transition-all duration-200"
                    style={{ borderBottom: '1px solid var(--border-primary)', background: 'transparent' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(var(--accent-rgb),0.04)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                  >
                    <td className="p-4"><span className="text-sm font-bold" style={{ color: 'var(--text-accent)' }}>{os.numero_os}</span></td>
                    <td className="p-4">
                      <span className="text-[10px] font-bold px-2 py-1 rounded uppercase"
                        style={{ background: `rgba(${te.rgb},0.10)`, color: te.color, border: `1px solid rgba(${te.rgb},0.3)` }}>
                        {os.tipo_os}
                      </span>
                    </td>
                    <td className="p-4"><span className="text-sm" style={{ color: 'var(--text-primary)' }}>{os.cliente_nome}</span></td>
                    <td className="p-4"><span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{new Date(os.created_at).toLocaleDateString('pt-BR')}</span></td>
                    <td className="p-4"><span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{os.fechada_em ? new Date(os.fechada_em).toLocaleDateString('pt-BR') : '-'}</span></td>
                    <td className="p-4">
                      <div className="flex items-center gap-2 w-fit px-2 py-1 rounded"
                        style={{ color: se.color, background: `rgba(${se.rgb},0.10)`, border: `1px solid rgba(${se.rgb},0.3)` }}>
                        {statusIcon(os.status_final)}
                        <span className="text-xs font-bold capitalize">{os.status_final}</span>
                      </div>
                    </td>
                    <td className="p-4"><span className="text-sm font-bold" style={{ color: tempoColor(os.tempo_resolucao_dias) }}>{os.tempo_resolucao_dias} dias</span></td>
                    <td className="p-4 text-right">
                      {os.valor_total > 0
                        ? <span className="text-sm font-bold" style={{ color: ok.color }}>R$ {os.valor_total.toFixed(2)}</span>
                        : <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>-</span>
                      }
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
