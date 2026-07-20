import { X, Package, FileText, Truck, Building2, Calendar, Hash, DollarSign, Download } from 'lucide-react';

interface ProdutoTaxes {
  icms: { valor: number; aliquota: number } | null;
  icms_st: { valor: number; aliquota: number } | null;
  ipi: { valor: number; aliquota: number } | null;
  pis: { valor: number; aliquota: number } | null;
  cofins: { valor: number; aliquota: number } | null;
}

interface NFParsed {
  numeroNF: string;
  chaveAcesso: string;
  fornecedor: string;
  dataEmissao: string;
  valorTotal: number;
  delivery: string | null;
  xmlContent: string;
  produtos: {
    pn: string;
    descricao: string;
    quantidade: number;
    valorUnitario: number;
    valorComImpostos: number;
    taxes: ProdutoTaxes;
  }[];
}

interface NFPendenteDetailsModalProps {
  nf: any;
  parseXML: (xml: string) => NFParsed;
  onClose: () => void;
  onDarEntrada: () => void;
}

export function NFPendenteDetailsModal({ nf, parseXML, onClose, onDarEntrada }: NFPendenteDetailsModalProps) {
  const parsed = parseXML(nf.xml_conteudo);

  const formatCurrency = (value: number) =>
    value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const totalImpostos = parsed.produtos.reduce((acc, p) => {
    const icms = p.taxes.icms?.valor || 0;
    const icmsSt = p.taxes.icms_st?.valor || 0;
    const ipi = p.taxes.ipi?.valor || 0;
    const pis = p.taxes.pis?.valor || 0;
    const cofins = p.taxes.cofins?.valor || 0;
    return acc + icms + icmsSt + ipi + pis + cofins;
  }, 0);

  return (
    <div
      className="fixed inset-0 flex items-center justify-center z-[9999] p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden flex flex-col"
        style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-primary)' }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border-primary)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'rgba(245,158,11,0.15)' }}>
              <FileText size={20} style={{ color: '#F59E0B' }} />
            </div>
            <div>
              <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                NF-e #{parsed.numeroNF}
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                Pendente de entrada
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors hover:bg-white/10"
          >
            <X size={18} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Info Cards Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <InfoCard icon={<Building2 size={16} />} label="Fornecedor" value={parsed.fornecedor} fullWidth />
            <InfoCard icon={<Calendar size={16} />} label="Data Emissao" value={parsed.dataEmissao} />
            <InfoCard icon={<DollarSign size={16} />} label="Valor Total" value={formatCurrency(parsed.valorTotal)} highlight />
            <InfoCard icon={<Hash size={16} />} label="Qtd. Itens" value={String(parsed.produtos.length)} />
            {parsed.delivery && (
              <InfoCard icon={<Truck size={16} />} label="Delivery" value={parsed.delivery} />
            )}
          </div>

          {/* Chave de Acesso */}
          <div className="rounded-xl p-3" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
            <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: 'var(--text-secondary)' }}>
              Chave de Acesso
            </span>
            <p className="text-xs font-mono mt-1 break-all" style={{ color: 'var(--text-primary)' }}>
              {parsed.chaveAcesso}
            </p>
          </div>

          {/* Resumo de Impostos */}
          <div className="rounded-xl p-3" style={{ background: 'rgba(59,130,246,0.06)', border: '1px solid rgba(59,130,246,0.15)' }}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold" style={{ color: '#3B82F6' }}>Total de Impostos</span>
              <span className="text-sm font-bold" style={{ color: '#3B82F6' }}>{formatCurrency(totalImpostos)}</span>
            </div>
          </div>

          {/* Products Table */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Package size={16} style={{ color: '#F59E0B' }} />
              <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                Itens ({parsed.produtos.length})
              </h3>
            </div>
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-primary)' }}>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: 'var(--bg-secondary)' }}>
                      <th className="text-left px-3 py-2.5 font-bold" style={{ color: 'var(--text-secondary)' }}>PN</th>
                      <th className="text-left px-3 py-2.5 font-bold" style={{ color: 'var(--text-secondary)' }}>Descricao</th>
                      <th className="text-center px-3 py-2.5 font-bold" style={{ color: 'var(--text-secondary)' }}>Qtd</th>
                      <th className="text-right px-3 py-2.5 font-bold" style={{ color: 'var(--text-secondary)' }}>Unitario</th>
                      <th className="text-right px-3 py-2.5 font-bold" style={{ color: 'var(--text-secondary)' }}>ICMS</th>
                      <th className="text-right px-3 py-2.5 font-bold" style={{ color: 'var(--text-secondary)' }}>ICMS-ST</th>
                      <th className="text-right px-3 py-2.5 font-bold" style={{ color: 'var(--text-secondary)' }}>IPI</th>
                      <th className="text-right px-3 py-2.5 font-bold" style={{ color: 'var(--text-secondary)' }}>Total c/ Imp.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.produtos.map((p, i) => (
                      <tr
                        key={i}
                        className="transition-colors"
                        style={{ borderTop: '1px solid var(--border-primary)' }}
                      >
                        <td className="px-3 py-2.5 font-mono font-bold" style={{ color: 'var(--text-primary)' }}>{p.pn}</td>
                        <td className="px-3 py-2.5 max-w-[200px] truncate" style={{ color: 'var(--text-secondary)' }} title={p.descricao}>{p.descricao}</td>
                        <td className="px-3 py-2.5 text-center font-bold" style={{ color: 'var(--text-primary)' }}>{p.quantidade}</td>
                        <td className="px-3 py-2.5 text-right" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(p.valorUnitario)}</td>
                        <td className="px-3 py-2.5 text-right" style={{ color: p.taxes.icms?.valor ? '#3B82F6' : 'var(--text-muted)' }}>
                          {p.taxes.icms?.valor ? formatCurrency(p.taxes.icms.valor) : '-'}
                        </td>
                        <td className="px-3 py-2.5 text-right" style={{ color: p.taxes.icms_st?.valor ? '#8B5CF6' : 'var(--text-muted)' }}>
                          {p.taxes.icms_st?.valor ? formatCurrency(p.taxes.icms_st.valor) : '-'}
                        </td>
                        <td className="px-3 py-2.5 text-right" style={{ color: p.taxes.ipi?.valor ? '#F59E0B' : 'var(--text-muted)' }}>
                          {p.taxes.ipi?.valor ? formatCurrency(p.taxes.ipi.valor) : '-'}
                        </td>
                        <td className="px-3 py-2.5 text-right font-bold" style={{ color: '#10B981' }}>
                          {formatCurrency(p.valorComImpostos)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ background: 'var(--bg-secondary)', borderTop: '2px solid var(--border-primary)' }}>
                      <td colSpan={3} className="px-3 py-2.5 font-bold" style={{ color: 'var(--text-primary)' }}>TOTAL</td>
                      <td className="px-3 py-2.5 text-right font-bold" style={{ color: 'var(--text-secondary)' }}>
                        {formatCurrency(parsed.produtos.reduce((a, p) => a + p.valorUnitario * p.quantidade, 0))}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold" style={{ color: '#3B82F6' }}>
                        {formatCurrency(parsed.produtos.reduce((a, p) => a + (p.taxes.icms?.valor || 0), 0))}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold" style={{ color: '#8B5CF6' }}>
                        {formatCurrency(parsed.produtos.reduce((a, p) => a + (p.taxes.icms_st?.valor || 0), 0))}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold" style={{ color: '#F59E0B' }}>
                        {formatCurrency(parsed.produtos.reduce((a, p) => a + (p.taxes.ipi?.valor || 0), 0))}
                      </td>
                      <td className="px-3 py-2.5 text-right font-bold" style={{ color: '#10B981' }}>
                        {formatCurrency(parsed.valorTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-5 border-t" style={{ borderColor: 'var(--border-primary)' }}>
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl text-sm font-bold transition-colors"
            style={{ color: 'var(--text-secondary)', background: 'var(--bg-secondary)' }}
          >
            Fechar
          </button>
          <button
            onClick={onDarEntrada}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{ background: 'rgba(16,185,129,0.15)', color: '#10B981', border: '1px solid rgba(16,185,129,0.3)' }}
          >
            <Download size={16} />
            Dar Entrada
          </button>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ icon, label, value, fullWidth, highlight }: { icon: React.ReactNode; label: string; value: string; fullWidth?: boolean; highlight?: boolean }) {
  return (
    <div
      className={`rounded-xl p-3 ${fullWidth ? 'col-span-2 md:col-span-4' : ''}`}
      style={{
        background: highlight ? 'rgba(16,185,129,0.06)' : 'var(--bg-secondary)',
        border: highlight ? '1px solid rgba(16,185,129,0.2)' : '1px solid var(--border-primary)',
      }}
    >
      <div className="flex items-center gap-1.5 mb-1">
        <span style={{ color: 'var(--text-muted)' }}>{icon}</span>
        <span className="text-[10px] uppercase font-bold tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          {label}
        </span>
      </div>
      <p className={`text-sm font-bold truncate ${highlight ? '' : ''}`} style={{ color: highlight ? '#10B981' : 'var(--text-primary)' }}>
        {value}
      </p>
    </div>
  );
}
