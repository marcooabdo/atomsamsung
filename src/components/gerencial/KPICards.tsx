import { useMemo } from 'react';
import { OSData } from '../../pages/GerencialDashboard';
import { differenceInDays } from 'date-fns';
import {
  FileText, CheckCircle, Clock, DollarSign,
  Wrench, Truck, TrendingUp, Timer
} from 'lucide-react';

interface Props {
  osList: OSData[];
}

export function KPICards({ osList }: Props) {
  const kpis = useMemo(() => {
    const totalOS = osList.length;
    const abertas = osList.filter(os => os.coluna_kanban !== 'os_fechada').length;
    const fechadas = osList.filter(os => os.coluna_kanban === 'os_fechada').length;
    const lp = osList.filter(os => os.tipo_os === 'LP').length;
    const ow = osList.filter(os => os.tipo_os === 'OW').length;
    const ih = osList.filter(os => os.tipo_atendimento === 'IH').length;
    const ci = osList.filter(os => os.tipo_atendimento === 'CI').length;

    const valorTotal = osList.reduce((acc, os) => acc + Number(os.valor_total || 0), 0);
    const valorPecas = osList.reduce((acc, os) => acc + Number(os.valor_pecas || 0), 0);
    const valorServicos = osList.reduce((acc, os) => acc + Number(os.valor_servicos || 0), 0);

    const osFechadasComData = osList.filter(os => os.fechada_em && os.created_at);
    let tempoMedio = 0;
    if (osFechadasComData.length > 0) {
      const totalDias = osFechadasComData.reduce((acc, os) => {
        return acc + differenceInDays(new Date(os.fechada_em!), new Date(os.created_at));
      }, 0);
      tempoMedio = Math.round(totalDias / osFechadasComData.length);
    }

    return { totalOS, abertas, fechadas, lp, ow, ih, ci, valorTotal, valorPecas, valorServicos, tempoMedio };
  }, [osList]);

  const cards = [
    { label: 'Total de OS', value: kpis.totalOS.toLocaleString('pt-BR'), icon: FileText, color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
    { label: 'OS Abertas', value: kpis.abertas.toLocaleString('pt-BR'), icon: Clock, color: '#f59e0b', bg: 'rgba(245,158,11,0.1)' },
    { label: 'OS Fechadas', value: kpis.fechadas.toLocaleString('pt-BR'), icon: CheckCircle, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    { label: 'Receita Total', value: `R$ ${kpis.valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, color: '#10b981', bg: 'rgba(16,185,129,0.1)' },
    { label: 'LP', value: kpis.lp.toLocaleString('pt-BR'), icon: Wrench, color: '#06b6d4', bg: 'rgba(6,182,212,0.1)', subtitle: 'Local Pickup' },
    { label: 'OW', value: kpis.ow.toLocaleString('pt-BR'), icon: Truck, color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)', subtitle: 'One Way' },
    { label: 'IH', value: kpis.ih.toLocaleString('pt-BR'), icon: TrendingUp, color: '#ec4899', bg: 'rgba(236,72,153,0.1)', subtitle: 'In Home' },
    { label: 'CI', value: kpis.ci.toLocaleString('pt-BR'), icon: Wrench, color: '#f97316', bg: 'rgba(249,115,22,0.1)', subtitle: 'Carry In' },
    { label: 'Tempo Médio', value: `${kpis.tempoMedio} dias`, icon: Timer, color: '#6366f1', bg: 'rgba(99,102,241,0.1)', subtitle: 'Abertura→Fechamento' },
    { label: 'Valor Peças', value: `R$ ${kpis.valorPecas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, icon: DollarSign, color: '#14b8a6', bg: 'rgba(20,184,166,0.1)' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map(card => {
        const Icon = card.icon;
        return (
          <div
            key={card.label}
            className="bg-[#1a1d27] rounded-xl border border-[#2a2e3a] p-4 hover:border-[#3a3f4d] transition-all duration-200 group"
          >
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: card.bg }}>
                <Icon className="w-4 h-4" style={{ color: card.color }} />
              </div>
              <span className="text-xs text-[#6b7280] font-medium uppercase tracking-wide">{card.label}</span>
            </div>
            <p className="text-xl font-bold text-white group-hover:text-blue-300 transition-colors">{card.value}</p>
            {card.subtitle && <p className="text-[10px] text-[#6b7280] mt-1">{card.subtitle}</p>}
          </div>
        );
      })}
    </div>
  );
}
