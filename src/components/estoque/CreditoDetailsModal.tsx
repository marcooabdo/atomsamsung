import { X, Download, Package, AlertCircle } from 'lucide-react';
import { CategoriaCredito, PecaCredito, PedidoCredito } from './useCreditoGSPN';

interface CreditoDetailsModalProps {
  categoria: CategoriaCredito | null;
  onClose: () => void;
}

function formatCurrency(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);
}

function isPedido(item: PecaCredito | PedidoCredito): item is PedidoCredito {
  return 'valor_estimado' in item;
}

function exportCSV(categoria: CategoriaCredito) {
  const rows = [
    ['ID Numerico', 'PN / Codigo', 'Descricao', 'Valor (R$)', 'OS Vinculada', 'Status'],
    ...categoria.pecas.map(item => {
      if (isPedido(item)) {
        return [
          item.id.slice(0, 8),
          item.pn,
          item.descricao || '',
          String(Number(item.valor_estimado).toFixed(2)),
          item.os_numero || '',
          item.status,
        ];
      }
      return [
        String((item as PecaCredito).id_numerico || ''),
        item.pn,
        item.descricao || '',
        String(Number((item as PecaCredito).valor_com_impostos).toFixed(2)),
        (item as PecaCredito).os_numero || '',
        item.status,
      ];
    }),
  ];

  const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `credito_gspn_${categoria.id}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

const COLUNA_LABELS: Record<string, string> = {
  recebido:            'Recebido',
  em_analise:          'Em Análise',
  aguardando_peca:     'Aguard. Peça',
  peca_em_transito:    'Peça em Trânsito',
  em_reparo:           'Em Reparo',
  pronto:              'Pronto',
  entregue:            'Entregue',
  os_fechada:          'Fechada',
};

export function CreditoDetailsModal({ categoria, onClose }: CreditoDetailsModalProps) {
  if (!categoria) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full max-w-4xl rounded-2xl border border-[#39FF14]/30 bg-[#0f172a] shadow-[0_0_60px_rgba(57,255,20,0.15)] flex flex-col"
        style={{ maxHeight: '90vh' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#39FF14]/20 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#39FF14]/10 border border-[#39FF14]/30 flex items-center justify-center">
              <Package className="w-4 h-4 text-[#39FF14]" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wider uppercase">{categoria.label}</h2>
              <p className="text-xs text-gray-400">
                {categoria.pecas.length} {categoria.pecas.length === 1 ? 'peça' : 'peças'} &nbsp;·&nbsp;
                <span className="text-[#39FF14] font-semibold">
                  {formatCurrency(categoria.total)}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => exportCSV(categoria)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#39FF14]/10 border border-[#39FF14]/40 text-[#39FF14] text-sm font-bold uppercase tracking-wider hover:bg-[#39FF14]/20 hover:shadow-[0_0_15px_rgba(57,255,20,0.3)] transition-all"
            >
              <Download className="w-4 h-4" />
              Baixar Excel (CSV)
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-700/50 hover:bg-slate-600/50 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-y-auto cyber-scrollbar flex-1 px-6 py-4" style={{ maxHeight: '60vh' }}>
          {categoria.pecas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-gray-500">
              <AlertCircle className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">Nenhuma peça nesta categoria</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-700/60">
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider py-2 pr-4 whitespace-nowrap">ID / PN</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider py-2 pr-4">Descrição</th>
                  <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider py-2 pr-4 whitespace-nowrap">Valor</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider py-2 pr-4 whitespace-nowrap">OS Vinculada</th>
                  <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider py-2">Status / Coluna</th>
                </tr>
              </thead>
              <tbody>
                {categoria.pecas.map((item, i) => {
                  const isPed = isPedido(item);
                  const valor = isPed ? Number(item.valor_estimado) : Number((item as PecaCredito).valor_com_impostos);
                  const idLabel = isPed
                    ? item.id.slice(0, 8) + '…'
                    : `#${(item as PecaCredito).id_numerico}`;
                  const coluna = isPed ? null : (item as PecaCredito).os_coluna;

                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-slate-800/60 hover:bg-[#39FF14]/5 transition-colors ${i % 2 === 0 ? 'bg-transparent' : 'bg-slate-800/20'}`}
                    >
                      <td className="py-3 pr-4">
                        <div className="font-mono text-[#39FF14] text-xs font-bold">{idLabel}</div>
                        <div className="text-gray-400 text-xs mt-0.5">{item.pn}</div>
                      </td>
                      <td className="py-3 pr-4 text-gray-300 max-w-[220px]">
                        <span className="line-clamp-2">{item.descricao || '—'}</span>
                      </td>
                      <td className="py-3 pr-4 text-right font-bold text-white whitespace-nowrap">
                        {formatCurrency(valor)}
                      </td>
                      <td className="py-3 pr-4">
                        {(item as any).os_numero ? (
                          <span className="font-mono text-[#00D4FF] text-xs">{(item as any).os_numero}</span>
                        ) : (
                          <span className="text-gray-600 text-xs">—</span>
                        )}
                      </td>
                      <td className="py-3">
                        <div className="flex flex-col gap-1">
                          <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-slate-700/60 text-gray-300 w-fit">
                            {item.status}
                          </span>
                          {coluna && coluna !== 'os_fechada' && (
                            <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-[#00D4FF]/10 text-[#00D4FF] w-fit">
                              {COLUNA_LABELS[coluna] || coluna}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Footer total */}
        <div className="flex items-center justify-between px-6 py-3 border-t border-[#39FF14]/20 bg-[#0f172a] rounded-b-2xl flex-shrink-0">
          <span className="text-xs text-gray-500 uppercase tracking-wider">{categoria.pecas.length} itens</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 uppercase tracking-wider">Total</span>
            <span className="text-lg font-bold text-[#39FF14] drop-shadow-[0_0_8px_rgba(57,255,20,0.6)]">
              {formatCurrency(categoria.total)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
