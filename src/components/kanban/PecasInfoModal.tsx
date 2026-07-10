import { useState, useMemo } from 'react';
import { X, Download, AlertTriangle, Package, DollarSign } from 'lucide-react';

interface OSData {
  id: string;
  numero_os_samsung: string | null;
  numero_os_interna: string | null;
  tipo_os: string | null;
  tipo_atendimento: string | null;
  created_at: string;
  os_pecas?: Array<{
    pn: string;
    descricao: string | null;
    valor_gspn: number | null;
    quantidade: number;
  }>;
  requisicoes?: Array<{
    id: string;
    status: string;
    codigo_peca: string;
    descricao: string;
    valor_peca: number | null;
    created_at: string;
  }>;
}

interface PecasInfoModalProps {
  show: boolean;
  onClose: () => void;
  osCards: OSData[];
}

interface PecaResumo {
  osNumero: string;
  tipoOS: string;
  tat: number;
  codigoPeca: string;
  descricao: string;
  valor: number | null;
  status: string;
}

function calcTAT(createdAt: string): number {
  const now = new Date();
  const created = new Date(createdAt);
  return Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
}

export function PecasInfoModal({ show, onClose, osCards }: PecasInfoModalProps) {
  const [tab, setTab] = useState<'resumo' | 'sem_valor'>('resumo');

  const pecas = useMemo<PecaResumo[]>(() => {
    const result: PecaResumo[] = [];
    for (const os of osCards) {
      const osNumero = os.numero_os_samsung || os.numero_os_interna || 'N/A';
      const tipoOS = os.tipo_os || os.tipo_atendimento || 'N/A';
      const tat = calcTAT(os.created_at);

      const reqs = os.requisicoes || [];
      const pecasRequisitadas = reqs.filter(r =>
        r.status === 'requisitada' || r.status === 'pendente' || r.status === 'aguardando'
      );

      for (const req of pecasRequisitadas) {
        const valorGSPN = os.os_pecas?.find(p => p.pn === req.codigo_peca)?.valor_gspn ?? null;
        const valor = req.valor_peca ?? valorGSPN;
        result.push({
          osNumero,
          tipoOS: tipoOS.toUpperCase(),
          tat,
          codigoPeca: req.codigo_peca,
          descricao: req.descricao,
          valor,
          status: req.status,
        });
      }

      if (pecasRequisitadas.length === 0 && reqs.length > 0) {
        for (const req of reqs) {
          const valorGSPN = os.os_pecas?.find(p => p.pn === req.codigo_peca)?.valor_gspn ?? null;
          const valor = req.valor_peca ?? valorGSPN;
          result.push({
            osNumero,
            tipoOS: tipoOS.toUpperCase(),
            tat,
            codigoPeca: req.codigo_peca,
            descricao: req.descricao,
            valor,
            status: req.status,
          });
        }
      }
    }
    return result;
  }, [osCards]);

  const totalPecas = pecas.length;
  const pecasComValor = pecas.filter(p => p.valor !== null && p.valor > 0);
  const pecasSemValor = pecas.filter(p => p.valor === null || p.valor === 0);
  const valorTotal = pecasComValor.reduce((sum, p) => sum + (p.valor || 0), 0);

  const downloadCSV = () => {
    const headers = ['Tipo OS', 'TAT (dias)', 'OS', 'Codigo Peca', 'Descricao', 'Valor GSPN', 'Status'];
    const rows = pecas.map(p => [
      p.tipoOS,
      p.tat.toString(),
      p.osNumero,
      p.codigoPeca,
      p.descricao,
      p.valor !== null ? p.valor.toFixed(2) : '',
      p.status,
    ]);

    const csvContent = [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pecas_aguardando_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-purple-500/20 border border-purple-500/40">
              <Package className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Pecas Requisitadas</h2>
              <p className="text-xs text-gray-400">Coluna Aguardando Peca</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-700 transition-colors text-gray-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3 px-6 py-4">
          <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-white">{totalPecas}</div>
            <div className="text-xs text-gray-400 mt-1">Pecas Requisitadas</div>
          </div>
          <div className="bg-gray-800/60 border border-emerald-800/40 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-emerald-400">
              R$ {valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </div>
            <div className="text-xs text-gray-400 mt-1">Valor Total</div>
          </div>
          <div className="bg-gray-800/60 border border-amber-800/40 rounded-xl p-3 text-center">
            <div className="text-2xl font-bold text-amber-400">{pecasSemValor.length}</div>
            <div className="text-xs text-gray-400 mt-1">Sem Valor GSPN</div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-2 px-6 pb-2">
          <button
            onClick={() => setTab('resumo')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tab === 'resumo'
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                : 'text-gray-400 hover:text-gray-200 border border-transparent'
            }`}
          >
            Todas ({totalPecas})
          </button>
          <button
            onClick={() => setTab('sem_valor')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1 ${
              tab === 'sem_valor'
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                : 'text-gray-400 hover:text-gray-200 border border-transparent'
            }`}
          >
            <AlertTriangle className="w-3 h-3" />
            Sem Valor ({pecasSemValor.length})
          </button>
          <div className="ml-auto">
            <button
              onClick={downloadCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/20 text-blue-300 border border-blue-500/40 hover:bg-blue-500/30 transition-all"
            >
              <Download className="w-3 h-3" />
              Exportar CSV
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto px-6 pb-4">
          <table className="w-full text-xs">
            <thead className="sticky top-0 bg-gray-900">
              <tr className="border-b border-gray-700">
                <th className="text-left py-2 px-2 text-gray-400 font-medium">Tipo</th>
                <th className="text-left py-2 px-2 text-gray-400 font-medium">TAT</th>
                <th className="text-left py-2 px-2 text-gray-400 font-medium">OS</th>
                <th className="text-left py-2 px-2 text-gray-400 font-medium">Peca</th>
                <th className="text-left py-2 px-2 text-gray-400 font-medium">Descricao</th>
                <th className="text-right py-2 px-2 text-gray-400 font-medium">Valor</th>
              </tr>
            </thead>
            <tbody>
              {(tab === 'resumo' ? pecas : pecasSemValor).map((p, i) => (
                <tr
                  key={`${p.osNumero}-${p.codigoPeca}-${i}`}
                  className="border-b border-gray-800 hover:bg-gray-800/50 transition-colors"
                >
                  <td className="py-2 px-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      p.tipoOS === 'LP' ? 'bg-blue-500/20 text-blue-300' :
                      p.tipoOS === 'IH' ? 'bg-green-500/20 text-green-300' :
                      p.tipoOS === 'CI' ? 'bg-orange-500/20 text-orange-300' :
                      'bg-gray-600/30 text-gray-300'
                    }`}>
                      {p.tipoOS}
                    </span>
                  </td>
                  <td className="py-2 px-2">
                    <span className={`font-mono ${
                      p.tat > 7 ? 'text-red-400' : p.tat > 4 ? 'text-amber-400' : 'text-gray-300'
                    }`}>
                      {p.tat}d
                    </span>
                  </td>
                  <td className="py-2 px-2 text-gray-200 font-mono">{p.osNumero}</td>
                  <td className="py-2 px-2 text-gray-300 font-mono">{p.codigoPeca}</td>
                  <td className="py-2 px-2 text-gray-400 max-w-[180px] truncate">{p.descricao}</td>
                  <td className="py-2 px-2 text-right">
                    {p.valor !== null && p.valor > 0 ? (
                      <span className="text-emerald-400 font-medium">
                        R$ {p.valor.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-amber-400 flex items-center justify-end gap-1">
                        <AlertTriangle className="w-3 h-3" />
                        Sem valor
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {(tab === 'resumo' ? pecas : pecasSemValor).length === 0 && (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-gray-500">
                    {tab === 'resumo' ? 'Nenhuma peca requisitada nesta coluna.' : 'Todas as pecas possuem valor GSPN.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
