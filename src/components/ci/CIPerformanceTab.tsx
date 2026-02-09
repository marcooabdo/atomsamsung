import { Award, TrendingUp, Users } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { VendedorCI, GLASS, formatCurrency } from './types';

interface Props {
  vendedores: VendedorCI[];
}

export default function CIPerformanceTab({ vendedores }: Props) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className={`${GLASS} p-6`}>
        <h3 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-400" />
          Ranking de Vendedores
        </h3>
        <div className="space-y-3 max-h-[550px] overflow-y-auto ci-scrollbar">
          {vendedores.map((vendedor, idx) => {
            const maxFat = vendedores[0]?.faturamento || 1;
            const pct = (vendedor.faturamento / maxFat) * 100;
            return (
              <div key={vendedor.id} className="p-4 rounded-xl bg-slate-800/30 border border-slate-700/40 hover:border-slate-600/60 transition-all">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm ${
                      idx === 0 ? 'bg-gradient-to-br from-amber-400 to-yellow-500 text-slate-900' :
                      idx === 1 ? 'bg-gradient-to-br from-slate-300 to-slate-400 text-slate-900' :
                      idx === 2 ? 'bg-gradient-to-br from-amber-700 to-amber-600 text-white' :
                      'bg-slate-700 text-slate-300'
                    }`}>
                      {idx + 1}
                    </div>
                    <div>
                      <h4 className="font-medium text-white text-sm">{vendedor.nome}</h4>
                      <p className="text-xs text-slate-500">{vendedor.totalClientes} clientes | {vendedor.totalOS} OS</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-base font-bold text-cyan-400">{formatCurrency(vendedor.faturamento)}</p>
                    <p className="text-[10px] text-slate-500">TM: {formatCurrency(vendedor.ticketMedio)}</p>
                  </div>
                </div>
                <div className="h-1.5 rounded-full bg-slate-700/50 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
          {vendedores.length === 0 && (
            <div className="text-center py-16 text-slate-500">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhum vendedor vinculado</p>
              <p className="text-xs mt-1 text-slate-600">Vincule vendedores na aba Pagamentos das OS</p>
            </div>
          )}
        </div>
      </div>

      <div className={`${GLASS} p-6`}>
        <h3 className="text-lg font-semibold text-white mb-5 flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-cyan-400" />
          Comparativo de Performance
        </h3>
        {vendedores.length > 0 ? (
          <div className="h-[450px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={vendedores.slice(0, 6)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis type="number" stroke="#64748B" tickFormatter={(v) => v >= 1000 ? `R$ ${(v/1000).toFixed(0)}k` : `R$ ${v}`} />
                <YAxis type="category" dataKey="nome" stroke="#64748B" width={100} tick={{ fontSize: 12 }} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #06B6D4', borderRadius: '12px' }}
                  formatter={(value: number, name: string) => [formatCurrency(value), name === 'faturamento' ? 'Faturamento' : 'Ticket Medio']}
                />
                <Legend />
                <Bar dataKey="faturamento" name="Faturamento" fill="#06B6D4" radius={[0, 4, 4, 0]} />
                <Bar dataKey="ticketMedio" name="Ticket Medio" fill="#3B82F6" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-[450px] flex items-center justify-center text-slate-500">
            <div className="text-center">
              <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Sem dados de performance</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
