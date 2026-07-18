import { useMemo } from 'react';
import { OSData } from '../../pages/GerencialDashboard';
import { DollarSign, TrendingUp, Package, Wrench } from 'lucide-react';

interface Props {
  osList: OSData[];
}

export function FinancialSummary({ osList }: Props) {
  const stats = useMemo(() => {
    const fechadas = osList.filter(os => os.coluna_kanban === 'os_fechada');
    const abertas = osList.filter(os => os.coluna_kanban !== 'os_fechada');

    const receitaFechadas = fechadas.reduce((acc, os) => acc + Number(os.valor_total || 0), 0);
    const receitaAbertas = abertas.reduce((acc, os) => acc + Number(os.valor_total || 0), 0);
    const pecasFechadas = fechadas.reduce((acc, os) => acc + Number(os.valor_pecas || 0), 0);
    const pecasAbertas = abertas.reduce((acc, os) => acc + Number(os.valor_pecas || 0), 0);
    const servicosFechadas = fechadas.reduce((acc, os) => acc + Number(os.valor_servicos || 0), 0);
    const servicosAbertas = abertas.reduce((acc, os) => acc + Number(os.valor_servicos || 0), 0);

    const ticketMedio = fechadas.length > 0 ? receitaFechadas / fechadas.length : 0;
    const margemBruta = receitaFechadas > 0 ? ((receitaFechadas - pecasFechadas) / receitaFechadas) * 100 : 0;

    return {
      receitaFechadas, receitaAbertas,
      pecasFechadas, pecasAbertas,
      servicosFechadas, servicosAbertas,
      ticketMedio, margemBruta,
      totalFechadas: fechadas.length,
      totalAbertas: abertas.length,
    };
  }, [osList]);

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="bg-[#1a1d27] rounded-xl border border-[#2a2e3a] p-5">
      <h2 className="text-base font-semibold text-white mb-5">Resumo Financeiro</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-[#232733] rounded-lg p-4 border border-[#2a2e3a]">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-green-400" />
            <span className="text-xs text-[#6b7280] uppercase">Ticket Médio</span>
          </div>
          <p className="text-lg font-bold text-white">{fmt(stats.ticketMedio)}</p>
          <p className="text-[10px] text-[#6b7280] mt-1">Base: {stats.totalFechadas} OS fechadas</p>
        </div>
        <div className="bg-[#232733] rounded-lg p-4 border border-[#2a2e3a]">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-blue-400" />
            <span className="text-xs text-[#6b7280] uppercase">Margem Bruta</span>
          </div>
          <p className="text-lg font-bold text-white">{stats.margemBruta.toFixed(1)}%</p>
          <p className="text-[10px] text-[#6b7280] mt-1">(Receita - Peças) / Receita</p>
        </div>
        <div className="bg-[#232733] rounded-lg p-4 border border-[#2a2e3a]">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-cyan-400" />
            <span className="text-xs text-[#6b7280] uppercase">Receita Pendente</span>
          </div>
          <p className="text-lg font-bold text-white">{fmt(stats.receitaAbertas)}</p>
          <p className="text-[10px] text-[#6b7280] mt-1">{stats.totalAbertas} OS em aberto</p>
        </div>
        <div className="bg-[#232733] rounded-lg p-4 border border-[#2a2e3a]">
          <div className="flex items-center gap-2 mb-2">
            <Wrench className="w-4 h-4 text-amber-400" />
            <span className="text-xs text-[#6b7280] uppercase">Serviços (Fechadas)</span>
          </div>
          <p className="text-lg font-bold text-white">{fmt(stats.servicosFechadas)}</p>
          <p className="text-[10px] text-[#6b7280] mt-1">Valor total de mão de obra</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2a2e3a]">
              <th className="text-left px-4 py-2 text-xs font-medium text-[#6b7280] uppercase">Categoria</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-[#6b7280] uppercase">OS Fechadas</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-[#6b7280] uppercase">OS Abertas</th>
              <th className="text-right px-4 py-2 text-xs font-medium text-[#6b7280] uppercase">Total Geral</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b border-[#2a2e3a]/50 hover:bg-[#232733]">
              <td className="px-4 py-2.5 text-white font-medium">Receita Total</td>
              <td className="px-4 py-2.5 text-right text-green-400 font-medium">{fmt(stats.receitaFechadas)}</td>
              <td className="px-4 py-2.5 text-right text-[#9ca3af]">{fmt(stats.receitaAbertas)}</td>
              <td className="px-4 py-2.5 text-right text-white font-bold">{fmt(stats.receitaFechadas + stats.receitaAbertas)}</td>
            </tr>
            <tr className="border-b border-[#2a2e3a]/50 hover:bg-[#232733]">
              <td className="px-4 py-2.5 text-white font-medium">Custo Peças</td>
              <td className="px-4 py-2.5 text-right text-red-400 font-medium">{fmt(stats.pecasFechadas)}</td>
              <td className="px-4 py-2.5 text-right text-[#9ca3af]">{fmt(stats.pecasAbertas)}</td>
              <td className="px-4 py-2.5 text-right text-white font-bold">{fmt(stats.pecasFechadas + stats.pecasAbertas)}</td>
            </tr>
            <tr className="border-b border-[#2a2e3a]/50 hover:bg-[#232733]">
              <td className="px-4 py-2.5 text-white font-medium">Serviços</td>
              <td className="px-4 py-2.5 text-right text-blue-400 font-medium">{fmt(stats.servicosFechadas)}</td>
              <td className="px-4 py-2.5 text-right text-[#9ca3af]">{fmt(stats.servicosAbertas)}</td>
              <td className="px-4 py-2.5 text-right text-white font-bold">{fmt(stats.servicosFechadas + stats.servicosAbertas)}</td>
            </tr>
            <tr className="hover:bg-[#232733]">
              <td className="px-4 py-2.5 text-white font-bold">Lucro Bruto (Receita - Peças)</td>
              <td className="px-4 py-2.5 text-right text-green-400 font-bold">{fmt(stats.receitaFechadas - stats.pecasFechadas)}</td>
              <td className="px-4 py-2.5 text-right text-[#9ca3af]">{fmt(stats.receitaAbertas - stats.pecasAbertas)}</td>
              <td className="px-4 py-2.5 text-right text-green-300 font-bold">{fmt((stats.receitaFechadas + stats.receitaAbertas) - (stats.pecasFechadas + stats.pecasAbertas))}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
