import { Package, BarChart3 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { PecaCI, GLASS, GLASS_INNER, formatCurrency } from './types';

interface Props {
  pecas: PecaCI[];
}

export default function CIProdutosTab({ pecas }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className={`${GLASS} p-6`}>
        <h3 className="text-lg font-semibold mb-5 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Package className="w-5 h-5 text-emerald-400" />
          Pecas Mais Utilizadas
        </h3>
        <div className="space-y-2.5 max-h-[520px] overflow-y-auto ci-scrollbar">
          {pecas.slice(0, 15).map((peca, idx) => (
            <div key={idx} className={`${GLASS_INNER} p-3.5`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <span className="w-7 h-7 rounded-lg bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-[10px] font-bold flex-shrink-0">
                    {idx + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{peca.descricao}</p>
                    {peca.pn && <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{peca.pn}</p>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm text-cyan-400 font-semibold">{peca.quantidade}x</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{formatCurrency(peca.valorTotal)}</p>
                </div>
              </div>
              <div className="mt-2 pt-2 flex items-center justify-between" style={{ borderTop: '1px solid var(--border-primary)' }}>
                <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>Valor Medio: {formatCurrency(peca.valorMedio)}</span>
                <div className="h-1 flex-1 mx-3 rounded-full overflow-hidden" style={{ background: 'rgba(var(--accent-rgb),0.12)' }}>
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500"
                    style={{ width: `${Math.min(100, (peca.quantidade / (pecas[0]?.quantidade || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
          {pecas.length === 0 && (
            <div className="text-center py-16" style={{ color: 'var(--text-secondary)' }}>
              <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhuma peca encontrada</p>
            </div>
          )}
        </div>
      </div>

      <div className={`${GLASS} p-6`}>
        <h3 className="text-lg font-semibold mb-5 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <BarChart3 className="w-5 h-5 text-blue-400" />
          Volume por Produto
        </h3>
        {pecas.length > 0 ? (
          <div className="h-[480px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={pecas.slice(0, 10)}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.1)" />
                <XAxis dataKey="pn" stroke="#94A3B8" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                <YAxis stroke="#94A3B8" />
                <Tooltip
                  contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid #3B82F6', borderRadius: '12px', color: 'var(--text-primary)' }}
                  formatter={(value: number, name: string) => [
                    name === 'quantidade' ? `${value} unidades` : formatCurrency(value),
                    name === 'quantidade' ? 'Quantidade' : 'Valor Total'
                  ]}
                />
                <Legend />
                <Bar dataKey="quantidade" name="Quantidade" fill="#10B981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="valorTotal" name="Valor Total" fill="#3B82F6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[480px] flex items-center justify-center" style={{ color: 'var(--text-secondary)' }}>
            <div className="text-center">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Sem dados de produtos</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
