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
  return 'valor_peca' in item && !('valor_com_impostos' in item);
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
          String(Number(item.valor_peca).toFixed(2)),
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
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div
        className="relative w-full max-w-4xl rounded-2xl flex flex-col"
        style={{
          maxHeight: '90vh',
          background: 'var(--bg-card)',
          border: '1px solid rgba(var(--neon-green-rgb),0.28)',
          boxShadow: '0 0 40px rgba(var(--neon-green-rgb),0.06), var(--card-shadow)',
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 flex-shrink-0"
          style={{ borderBottom: '1px solid rgba(var(--neon-green-rgb),0.12)' }}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{
                background: 'rgba(var(--neon-green-rgb),0.1)',
                border: '1px solid rgba(var(--neon-green-rgb),0.3)',
              }}
            >
              <Package className="w-4 h-4" style={{ color: 'var(--neon-green)' }} />
            </div>
            <div>
              <h2 className="text-base font-bold tracking-wider uppercase" style={{ color: 'var(--text-primary)' }}>{categoria.label}</h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {categoria.pecas.length} {categoria.pecas.length === 1 ? 'peça' : 'peças'} &nbsp;·&nbsp;
                <span className="font-semibold" style={{ color: 'var(--neon-green)' }}>
                  {formatCurrency(categoria.total)}
                </span>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => exportCSV(categoria)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold uppercase tracking-wider transition-all"
              style={{
                background: 'rgba(var(--neon-green-rgb),0.1)',
                border: '1px solid rgba(var(--neon-green-rgb),0.35)',
                color: 'var(--neon-green)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(var(--neon-green-rgb),0.18)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'var(--neon-green-glow)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.background = 'rgba(var(--neon-green-rgb),0.1)';
                (e.currentTarget as HTMLElement).style.boxShadow = 'none';
              }}
            >
              <Download className="w-4 h-4" />
              Baixar Excel (CSV)
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
              style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-primary)',
                color: 'var(--text-secondary)',
              }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)';
              }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-y-auto cyber-scrollbar flex-1 px-6 py-4" style={{ maxHeight: '60vh' }}>
          {categoria.pecas.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16" style={{ color: 'var(--text-secondary)' }}>
              <AlertCircle className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">Nenhuma peça nesta categoria</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-primary)' }}>
                  <th className="text-left text-xs font-semibold uppercase tracking-wider py-2 pr-4 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>ID / PN</th>
                  <th className="text-left text-xs font-semibold uppercase tracking-wider py-2 pr-4" style={{ color: 'var(--text-secondary)' }}>Descrição</th>
                  <th className="text-right text-xs font-semibold uppercase tracking-wider py-2 pr-4 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>Valor</th>
                  <th className="text-left text-xs font-semibold uppercase tracking-wider py-2 pr-4 whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>OS Vinculada</th>
                  <th className="text-left text-xs font-semibold uppercase tracking-wider py-2" style={{ color: 'var(--text-secondary)' }}>Status / Coluna</th>
                </tr>
              </thead>
              <tbody>
                {categoria.pecas.map((item, i) => {
                  const isPed = isPedido(item);
                  const valor = isPed ? Number(item.valor_peca) : Number((item as PecaCredito).valor_com_impostos);
                  const idLabel = isPed
                    ? item.id.slice(0, 8) + '…'
                    : `#${(item as PecaCredito).id_numerico}`;
                  const coluna = isPed ? null : (item as PecaCredito).os_coluna;

                  return (
                    <tr
                      key={item.id}
                      className="transition-colors"
                      style={{
                        borderBottom: '1px solid var(--border-primary)',
                        background: i % 2 === 0 ? 'transparent' : 'rgba(var(--neon-green-rgb),0.02)',
                      }}
                      onMouseEnter={e => {
                        (e.currentTarget as HTMLElement).style.background = 'rgba(var(--neon-green-rgb),0.04)';
                      }}
                      onMouseLeave={e => {
                        (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? 'transparent' : 'rgba(var(--neon-green-rgb),0.02)';
                      }}
                    >
                      <td className="py-3 pr-4">
                        <div className="font-mono text-xs font-bold" style={{ color: 'var(--neon-green)' }}>{idLabel}</div>
                        <div className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{item.pn}</div>
                      </td>
                      <td className="py-3 pr-4 max-w-[220px]" style={{ color: 'var(--text-primary)' }}>
                        <span className="line-clamp-2">{item.descricao || '—'}</span>
                      </td>
                      <td className="py-3 pr-4 text-right font-bold whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>
                        {formatCurrency(valor)}
                      </td>
                      <td className="py-3 pr-4">
                        {(item as any).os_numero ? (
                          <span className="font-mono text-[#00D4FF] text-xs">{(item as any).os_numero}</span>
                        ) : (
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>—</span>
                        )}
                      </td>
                      <td className="py-3">
                        <div className="flex flex-col gap-1">
                          <span
                            className="inline-flex px-2 py-0.5 rounded text-xs font-medium w-fit"
                            style={{
                              background: 'var(--bg-secondary)',
                              border: '1px solid var(--border-primary)',
                              color: 'var(--text-primary)',
                            }}
                          >
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
        <div
          className="flex items-center justify-between px-6 py-3 rounded-b-2xl flex-shrink-0"
          style={{
            borderTop: '1px solid rgba(var(--neon-green-rgb),0.12)',
            background: 'var(--bg-card)',
          }}
        >
          <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{categoria.pecas.length} itens</span>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Total</span>
            <span className="text-lg font-bold" style={{ color: 'var(--neon-green)' }}>
              {formatCurrency(categoria.total)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
