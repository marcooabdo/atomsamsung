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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.85)' }}>
      <div
        className="w-full max-w-6xl max-h-[90vh] overflow-hidden rounded-xl"
        style={{
          background: 'linear-gradient(135deg, rgba(0,0,0,0.95) 0%, rgba(10,10,10,0.98) 100%)',
          border: '1px solid rgba(6,182,212,0.3)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(6,182,212,0.1)'
        }}
      >
        <div className="p-6 border-b border-gray-800/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(6,182,212,0.15) 0%, rgba(6,182,212,0.05) 100%)',
                border: '1px solid rgba(6,182,212,0.3)',
                boxShadow: '0 0 12px rgba(6,182,212,0.15)'
              }}
            >
              <MetricIcon className="w-5 h-5 text-[#06B6D4]" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">{title}</h2>
              <p className="text-xs text-gray-400 mt-1">
                {osList.length} ordem(ns) de serviço analisada(s)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={exportToExcel}
              className="px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-bold transition-all duration-300"
              style={{
                background: 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(16,185,129,0.1) 100%)',
                border: '1px solid rgba(16,185,129,0.3)',
                color: '#10B981'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(16,185,129,0.3) 0%, rgba(16,185,129,0.2) 100%)';
                e.currentTarget.style.borderColor = 'rgba(16,185,129,0.5)';
                e.currentTarget.style.transform = 'translateY(-1px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(16,185,129,0.1) 100%)';
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
                background: 'linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(239,68,68,0.1) 100%)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#EF4444'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(239,68,68,0.3) 0%, rgba(239,68,68,0.2) 100%)';
                e.currentTarget.style.borderColor = 'rgba(239,68,68,0.5)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(239,68,68,0.1) 100%)';
                e.currentTarget.style.borderColor = 'rgba(239,68,68,0.3)';
              }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 border-b border-gray-800/50">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              className="p-4 rounded-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(6,182,212,0.08) 0%, rgba(6,182,212,0.02) 100%)',
                border: '1px solid rgba(6,182,212,0.2)'
              }}
            >
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Valor Atual</p>
              <p className="text-2xl font-bold text-[#06B6D4]">
                {metric === 'eficiencia' ? `${currentValue.toFixed(1)} dias` : `${currentValue.toFixed(1)}%`}
              </p>
            </div>
            {targetValue !== undefined && (
              <div
                className="p-4 rounded-lg"
                style={{
                  background: 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(16,185,129,0.02) 100%)',
                  border: '1px solid rgba(16,185,129,0.2)'
                }}
              >
                <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Meta</p>
                <p className="text-2xl font-bold text-[#10B981]">
                  {metric === 'eficiencia' ? `${targetValue.toFixed(1)} dias` : `${targetValue.toFixed(1)}%`}
                </p>
              </div>
            )}
            <div
              className="p-4 rounded-lg"
              style={{
                background: targetValue && currentValue >= targetValue
                  ? 'linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(16,185,129,0.02) 100%)'
                  : 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(239,68,68,0.02) 100%)',
                border: targetValue && currentValue >= targetValue
                  ? '1px solid rgba(16,185,129,0.2)'
                  : '1px solid rgba(239,68,68,0.2)'
              }}
            >
              <p className="text-[10px] text-gray-500 uppercase tracking-wider font-bold mb-1">Status</p>
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
            <thead className="sticky top-0 z-10" style={{ background: 'rgba(0,0,0,0.95)' }}>
              <tr className="border-b border-gray-800/50">
                <th className="text-left p-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider">OS</th>
                <th className="text-left p-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="text-left p-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Cliente</th>
                <th className="text-left p-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Abertura</th>
                <th className="text-left p-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Fechamento</th>
                <th className="text-left p-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="text-left p-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Tempo</th>
                <th className="text-right p-4 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Valor</th>
              </tr>
            </thead>
            <tbody>
              {osList.map((os) => (
                <tr
                  key={os.id}
                  className="border-b border-gray-800/30 transition-all duration-200"
                  style={{ background: 'rgba(0,0,0,0.2)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(6,182,212,0.05)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(0,0,0,0.2)';
                  }}
                >
                  <td className="p-4">
                    <span className="text-sm font-bold text-[#06B6D4]">{os.numero_os}</span>
                  </td>
                  <td className="p-4">
                    <span
                      className="text-[10px] font-bold px-2 py-1 rounded uppercase"
                      style={{
                        background: os.tipo_os === 'LP'
                          ? 'linear-gradient(135deg, rgba(168,85,247,0.2) 0%, rgba(168,85,247,0.1) 100%)'
                          : 'linear-gradient(135deg, rgba(14,165,233,0.2) 0%, rgba(14,165,233,0.1) 100%)',
                        color: os.tipo_os === 'LP' ? '#A855F7' : '#0EA5E9',
                        border: os.tipo_os === 'LP' ? '1px solid rgba(168,85,247,0.3)' : '1px solid rgba(14,165,233,0.3)'
                      }}
                    >
                      {os.tipo_os}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-sm text-gray-300">{os.cliente_nome}</span>
                  </td>
                  <td className="p-4">
                    <span className="text-xs text-gray-400">
                      {new Date(os.created_at).toLocaleDateString('pt-BR')}
                    </span>
                  </td>
                  <td className="p-4">
                    <span className="text-xs text-gray-400">
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
                      <span className="text-xs text-gray-500">-</span>
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
