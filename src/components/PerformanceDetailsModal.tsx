import { X, Download, TrendingUp, TrendingDown, Clock, CheckCircle, XCircle } from 'lucide-react';
import * as XLSX from 'xlsx';

interface PerformanceOS {
  id: string;
  numero_os: string;
  tipo_os: 'LP' | 'OW';
  cliente_nome: string;
  created_at: string;
  data_fechamento: string | null;
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

export function PerformanceDetailsModal({
  isOpen,
  onClose,
  metric,
  title,
  osList,
  targetValue,
  currentValue
}: PerformanceDetailsModalProps) {
  if (!isOpen) return null;

  const exportToExcel = () => {
    const worksheetData = osList.map(os => ({
      'Número OS': os.numero_os,
      'Tipo': os.tipo_os,
      'Cliente': os.cliente_nome,
      'Data Abertura': new Date(os.created_at).toLocaleDateString('pt-BR'),
      'Data Fechamento': os.data_fechamento ? new Date(os.data_fechamento).toLocaleDateString('pt-BR') : 'Em aberto',
      'Status': os.status_final === 'aprovado' ? 'Aprovado' : os.status_final === 'reprovado' ? 'Reprovado' : 'Em aberto',
      'Tempo Resolução (dias)': os.tempo_resolucao_dias,
      'Valor Total': `R$ ${os.valor_total.toFixed(2)}`,
      'Coluna Kanban': os.coluna_kanban
    }));

    const worksheet = XLSX.utils.json_to_sheet(worksheetData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Performance');

    worksheet['!cols'] = [
      { width: 15 },
      { width: 8 },
      { width: 30 },
      { width: 15 },
      { width: 15 },
      { width: 12 },
      { width: 20 },
      { width: 15 },
      { width: 20 }
    ];

    XLSX.writeFile(workbook, `performance_${metric}_${new Date().getTime()}.xlsx`);
  };

  const metricIcon = metric === 'eficiencia' ? Clock : metric === 'aprovacao' ? CheckCircle : TrendingUp;
  const MetricIcon = metricIcon;

  const getStatusColor = (status: string) => {
    if (status === 'aprovado') return '#10B981';
    if (status === 'reprovado') return '#EF4444';
    return '#F59E0B';
  };

  const getStatusIcon = (status: string) => {
    if (status === 'aprovado') return <CheckCircle className="w-4 h-4" />;
    if (status === 'reprovado') return <XCircle className="w-4 h-4" />;
    return <Clock className="w-4 h-4" />;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
      <div
        className="w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-xl"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-accent)',
          boxShadow: 'var(--card-shadow)'
        }}
      >
        <div
          className="p-6 flex items-center justify-between"
          style={{ borderBottom: '1px solid var(--border-primary)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg"
              style={{
                background: 'rgba(var(--accent-rgb),0.12)',
                border: '1px solid rgba(var(--accent-rgb),0.3)',
              }}
            >
              <MetricIcon className="w-5 h-5" style={{ color: 'var(--text-accent)' }} />
            </div>
            <div>
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{title}</h2>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                {osList.length} ordem(ns) de serviço analisada(s)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={exportToExcel}
              className="px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-bold transition-all duration-300"
              style={{
                background: 'rgba(16,185,129,0.12)',
                border: '1px solid rgba(16,185,129,0.3)',
                color: '#10B981'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(16,185,129,0.22)';
                e.currentTarget.style.borderColor = 'rgba(16,185,129,0.5)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(16,185,129,0.12)';
                e.currentTarget.style.borderColor = 'rgba(16,185,129,0.3)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <Download className="w-4 h-4" />
              Exportar Excel
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-all duration-300"
              style={{
                background: 'rgba(239,68,68,0.12)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#EF4444'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239,68,68,0.22)';
                e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(239,68,68,0.12)';
                e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)';
              }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              className="p-4 rounded-lg"
              style={{
                background: 'rgba(var(--accent-rgb),0.06)',
                border: '1px solid rgba(var(--accent-rgb),0.2)'
              }}
            >
              <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>Valor Atual</p>
              <p className="text-2xl font-bold" style={{ color: 'var(--text-accent)' }}>
                {metric === 'eficiencia' ? `${currentValue.toFixed(1)} dias` : `${currentValue.toFixed(1)}%`}
              </p>
            </div>
            {targetValue !== undefined && (
              <div
                className="p-4 rounded-lg"
                style={{
                  background: 'rgba(16,185,129,0.06)',
                  border: '1px solid rgba(16,185,129,0.2)'
                }}
              >
                <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>Meta</p>
                <p className="text-2xl font-bold text-[#10B981]">
                  {metric === 'eficiencia' ? `${targetValue.toFixed(1)} dias` : `${targetValue.toFixed(1)}%`}
                </p>
              </div>
            )}
            <div
              className="p-4 rounded-lg"
              style={{
                background: targetValue && currentValue >= targetValue
                  ? 'rgba(16,185,129,0.06)'
                  : 'rgba(239,68,68,0.06)',
                border: targetValue && currentValue >= targetValue
                  ? '1px solid rgba(16,185,129,0.2)'
                  : '1px solid rgba(239,68,68,0.2)'
              }}
            >
              <p className="text-[10px] uppercase tracking-wider font-bold mb-1" style={{ color: 'var(--text-secondary)' }}>Status</p>
              <div className="flex items-center gap-2">
                {targetValue && currentValue >= targetValue ? (
                  <>
                    <TrendingUp className="w-5 h-5 text-[#10B981]" />
                    <p className="text-xl font-bold text-[#10B981]">Atingido</p>
                  </>
                ) : (
                  <>
                    <TrendingDown className="w-5 h-5 text-[#EF4444]" />
                    <p className="text-xl font-bold text-[#EF4444]">Abaixo</p>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-300px)]">
          <table className="w-full">
            <thead className="sticky top-0 z-10" style={{ background: 'var(--bg-card)' }}>
              <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                <th className="text-left p-4 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>OS</th>
                <th className="text-left p-4 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Tipo</th>
                <th className="text-left p-4 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Cliente</th>
                <th className="text-left p-4 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Abertura</th>
                <th className="text-left p-4 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Fechamento</th>
                <th className="text-left p-4 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Status</th>
                <th className="text-left p-4 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Tempo</th>
                <th className="text-right p-4 text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Valor</th>
              </tr>
            </thead>
            <tbody>
              {osList.map((os) => (
                <tr
                  key={os.id}
                  className="transition-all duration-200"
                  style={{ borderBottom: '1px solid var(--border-primary)', background: 'transparent' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(var(--accent-rgb),0.04)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <td className="p-4">
                    <span className="text-sm font-bold" style={{ color: 'var(--text-accent)' }}>{os.numero_os}</span>
                  </td>
                  <td className="p-4">
                    <span
                      className="text-[10px] font-bold px-2 py-1 rounded uppercase"
                      style={{
                        background: os.tipo_os === 'LP'
                          ? 'rgba(168,85,247,0.12)'
                          : 'rgba(14,165,233,0.12)',
                        color: os.tipo_os === 'LP' ? '#A855F7' : '#0EA5E9',
                        border: os.tipo_os === 'LP' ? '1px solid rgba(168,85,247,0.3)' : '1px solid rgba(14,165,233,0.3)'
                      }}
                    >
                      {os.tipo_os}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>{os.cliente_nome}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {new Date(os.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {os.data_fechamento ? new Date(os.data_fechamento).toLocaleDateString('pt-BR') : '-'}
                    </span>
                  </td>
                  <td className="p-4">
                    <div
                      className="flex items-center gap-2 w-fit px-2 py-1 rounded"
                      style={{
                        color: getStatusColor(os.status_final),
                        background: `${getStatusColor(os.status_final)}15`,
                        border: `1px solid ${getStatusColor(os.status_final)}30`
                      }}
                    >
                      {getStatusIcon(os.status_final)}
                      <span className="text-xs font-bold capitalize">{os.status_final}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span
                      className="text-sm font-bold"
                      style={{
                        color: os.tempo_resolucao_dias <= 3 ? '#10B981' : os.tempo_resolucao_dias <= 7 ? '#F59E0B' : '#EF4444'
                      }}
                    >
                      {os.tempo_resolucao_dias} dias
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    {os.valor_total > 0 ? (
                      <span className="text-sm font-bold text-[#10B981]">
                        R$ {os.valor_total.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>-</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
