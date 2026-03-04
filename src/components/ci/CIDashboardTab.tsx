import {
  DollarSign, Target, Star, Award, BarChart3, Activity,
  ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { PieChart as LucidePie } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Area, AreaChart, Line
} from 'recharts';
import { CIKPIs, VendedorCI, ClienteCI, DadoMensal, GLASS, CHART_COLORS, formatCurrency, getValorCliente } from './types';

interface Props {
  kpis: CIKPIs;
  clientes: ClienteCI[];
  vendedores: VendedorCI[];
  dadosMensais: DadoMensal[];
}

export default function CIDashboardTab({ kpis, clientes, vendedores, dadosMensais }: Props) {
  const chartData = clientes.slice(0, 10).map(c => ({
    name: c.nome.length > 15 ? c.nome.substring(0, 15) + '...' : c.nome,
    valor: getValorCliente(c),
    os: c.totalOS
  }));

  const pieData = vendedores.slice(0, 6).map((v, i) => ({
    name: v.nome.split(' ')[0],
    value: v.faturamento,
    color: CHART_COLORS[i % CHART_COLORS.length]
  }));

  const areaData = dadosMensais.map(d => ({ name: d.mes, faturamento: d.faturamento, orcamentos: d.qtd }));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          icon={DollarSign}
          iconColor="from-cyan-500/20 to-cyan-600/10 border-cyan-500/30"
          textColor="text-cyan-400"
          hoverBorder="hover:border-cyan-400/40"
          value={formatCurrency(kpis.totalFaturamento)}
          label="Faturamento Total"
          badge={
            <span className={`flex items-center gap-1 text-xs ${kpis.crescimento >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {kpis.crescimento >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
              {Math.abs(kpis.crescimento).toFixed(1)}%
            </span>
          }
        />
        <KPICard
          icon={Target}
          iconColor="from-blue-500/20 to-blue-600/10 border-blue-500/30"
          textColor="text-blue-400"
          hoverBorder="hover:border-blue-400/40"
          value={formatCurrency(kpis.ticketMedio)}
          label="Ticket Medio"
        />
        <KPICard
          icon={Star}
          iconColor="from-amber-500/20 to-amber-600/10 border-amber-500/30"
          textColor="text-amber-400"
          hoverBorder="hover:border-amber-400/40"
          value={kpis.clienteDoMes}
          subValue={formatCurrency(kpis.clienteDoMesValor)}
          subColor="text-amber-400"
          label="Cliente Destaque"
          badge={<span className="text-xs text-slate-500">{kpis.totalClientes} clientes</span>}
          isName
        />
        <KPICard
          icon={Award}
          iconColor="from-emerald-500/20 to-emerald-600/10 border-emerald-500/30"
          textColor="text-emerald-400"
          hoverBorder="hover:border-emerald-400/40"
          value={kpis.vendedorDestaque}
          subValue={formatCurrency(kpis.vendedorDestaqueValor)}
          subColor="text-emerald-400"
          label="Vendedor Destaque"
          isName
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className={`${GLASS} p-6 lg:col-span-2`}>
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-6" style={{ color: 'var(--text-primary)' }}>
            <BarChart3 className="w-5 h-5 text-cyan-400" />
            Top 10 Clientes por Faturamento
          </h3>
          {chartData.length > 0 ? (
            <div className="h-[350px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} />
                  <XAxis type="number" stroke="currentColor" strokeOpacity={0.5} tickFormatter={(v) => v >= 1000 ? `R$ ${(v/1000).toFixed(0)}k` : `R$ ${v}`} tick={{ fill: 'currentColor', fillOpacity: 0.7, fontSize: 11 }} />
                  <YAxis type="category" dataKey="name" stroke="currentColor" strokeOpacity={0.5} width={120} tick={{ fill: 'currentColor', fillOpacity: 0.7, fontSize: 11 }} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid rgba(var(--accent-rgb),0.4)', borderRadius: '12px', color: 'var(--text-primary)' }} formatter={(value: number) => [formatCurrency(value), 'Faturamento']} />
                  <Bar dataKey="valor" fill="url(#ciBarGradient)" radius={[0, 8, 8, 0]} />
                  <defs>
                    <linearGradient id="ciBarGradient" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#06B6D4" />
                      <stop offset="100%" stopColor="#3B82F6" />
                    </linearGradient>
                  </defs>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState icon={BarChart3} text="Nenhum dado para exibir" />}
        </div>

        <div className={`${GLASS} p-6`}>
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-6" style={{ color: 'var(--text-primary)' }}>
            <LucidePie className="w-5 h-5 text-blue-400" />
            Faturamento por Vendedor
          </h3>
          {pieData.length > 0 ? (
            <>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={4} dataKey="value">
                      {pieData.map((entry, idx) => <Cell key={idx} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid rgba(var(--accent-rgb),0.4)', borderRadius: '12px', color: 'var(--text-primary)' }} formatter={(value: number) => [formatCurrency(value), '']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 mt-2">
                {pieData.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                      <span style={{ color: 'var(--text-primary)' }}>{item.name}</span>
                    </div>
                    <span style={{ color: 'var(--text-secondary)' }}>{formatCurrency(item.value)}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <EmptyState icon={LucidePie} text="Nenhum vendedor vinculado" sub="Vincule vendedores na aba Pagamentos das OS" />
          )}
        </div>

        <div className={`${GLASS} p-6 lg:col-span-3`}>
          <h3 className="text-lg font-semibold flex items-center gap-2 mb-6" style={{ color: 'var(--text-primary)' }}>
            <Activity className="w-5 h-5 text-emerald-400" />
            Evolucao do Faturamento
          </h3>
          {areaData.length > 0 ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={areaData}>
                  <defs>
                    <linearGradient id="ciAreaGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#06B6D4" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.15} />
                  <XAxis dataKey="name" stroke="currentColor" strokeOpacity={0.5} tick={{ fill: 'currentColor', fillOpacity: 0.7 }} />
                  <YAxis stroke="currentColor" strokeOpacity={0.5} tickFormatter={(v) => v >= 1000 ? `R$ ${(v/1000).toFixed(0)}k` : `R$ ${v}`} tick={{ fill: 'currentColor', fillOpacity: 0.7 }} />
                  <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid rgba(var(--accent-rgb),0.4)', borderRadius: '12px', color: 'var(--text-primary)' }} formatter={(value: number, name: string) => [name === 'faturamento' ? formatCurrency(value) : value, name === 'faturamento' ? 'Faturamento' : 'Orcamentos']} />
                  <Area type="monotone" dataKey="faturamento" stroke="#06B6D4" strokeWidth={2} fillOpacity={1} fill="url(#ciAreaGradient)" />
                  <Line type="monotone" dataKey="orcamentos" stroke="#F59E0B" strokeWidth={2} dot={{ fill: '#F59E0B', strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : <EmptyState icon={Activity} text="Sem dados de evolucao" />}
        </div>
      </div>
    </div>
  );
}

function KPICard({ icon: Icon, iconColor, textColor, hoverBorder, value, label, badge, subValue, subColor, isName }: {
  icon: any; iconColor: string; textColor: string; hoverBorder: string;
  value: string; label: string; badge?: React.ReactNode;
  subValue?: string; subColor?: string; isName?: boolean;
}) {
  return (
    <div className={`${GLASS} p-5 group ${hoverBorder} transition-all duration-300`}>
      <div className="flex items-center justify-between mb-3">
        <div className={`p-2.5 rounded-xl bg-gradient-to-br ${iconColor} group-hover:scale-110 transition-transform`}>
          <Icon className={`w-5 h-5 ${textColor}`} />
        </div>
        {badge}
      </div>
      <p className={`${isName ? 'text-lg truncate' : 'text-2xl'} font-bold mb-0.5`} style={{ color: 'var(--text-primary)' }} title={value}>{value}</p>
      {subValue && <p className={`text-sm ${subColor}`}>{subValue}</p>}
      <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{label}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, text, sub }: { icon: any; text: string; sub?: string }) {
  return (
    <div className="h-[280px] flex items-center justify-center text-slate-500">
      <div className="text-center">
        <Icon className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p>{text}</p>
        {sub && <p className="text-xs mt-1">{sub}</p>}
      </div>
    </div>
  );
}
