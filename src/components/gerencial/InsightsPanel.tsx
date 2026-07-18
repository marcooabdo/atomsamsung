import { useMemo } from 'react';
import { OSData, PipelineRow } from '../../pages/GerencialDashboard';
import { TriangleAlert as AlertTriangle, TrendingDown, Clock, Zap, CircleAlert as AlertCircle } from 'lucide-react';
import { differenceInDays, differenceInHours } from 'date-fns';

interface Props {
  osList: OSData[];
  pipelineData: PipelineRow[];
}

interface Insight {
  type: 'critical' | 'warning' | 'info';
  title: string;
  description: string;
}

export function InsightsPanel({ osList, pipelineData }: Props) {
  const insights = useMemo((): Insight[] => {
    const result: Insight[] = [];

    const aguardandoPeca = pipelineData.find(p => p.id === 'aguardando_peca');
    if (aguardandoPeca && aguardandoPeca.alertCount && aguardandoPeca.alertCount > 0) {
      result.push({
        type: 'critical',
        title: `${aguardandoPeca.alertCount} OS com problema de peça`,
        description: 'OS aguardando peça com valor R$0 ou sem código cadastrado. Verificar registro de preço GSPN.',
      });
    }

    const staleColumns = pipelineData.filter(p => p.hoursInStage && p.hoursInStage > 168 && p.count > 0);
    staleColumns.forEach(col => {
      const days = Math.floor(col.hoursInStage! / 24);
      result.push({
        type: 'warning',
        title: `${col.label}: card há ${days} dias`,
        description: `${col.count} OS nesta etapa. Card mais antigo parado há ${days} dias sem movimentação.`,
      });
    });

    const osNova = pipelineData.find(p => p.id === 'os_nova');
    if (osNova && osNova.count > 100) {
      result.push({
        type: 'warning',
        title: `${osNova.count} OS na fila de entrada`,
        description: 'Volume alto de OS aguardando triagem inicial. Considere reforço na equipe de diagnóstico.',
      });
    }

    const abertas = osList.filter(os => os.coluna_kanban !== 'os_fechada');
    const oldOS = abertas.filter(os => differenceInDays(new Date(), new Date(os.created_at)) > 30);
    if (oldOS.length > 0) {
      result.push({
        type: 'warning',
        title: `${oldOS.length} OS abertas há mais de 30 dias`,
        description: 'OS ultrapassaram o prazo ideal de conclusão. Revisar gargalos no processo.',
      });
    }

    const fechadasHoje = osList.filter(os => {
      if (!os.fechada_em) return false;
      const today = new Date().toISOString().slice(0, 10);
      return os.fechada_em.startsWith(today);
    });
    if (fechadasHoje.length > 0) {
      result.push({
        type: 'info',
        title: `${fechadasHoje.length} OS fechadas hoje`,
        description: `Produtividade do dia: ${fechadasHoje.length} ordens de serviço concluídas.`,
      });
    }

    const totalValor = abertas.reduce((acc, os) => acc + Number(os.valor_total || 0), 0);
    if (totalValor > 100000) {
      result.push({
        type: 'info',
        title: `R$ ${(totalValor / 1000).toFixed(0)}k em receita pendente`,
        description: 'Valor total de OS abertas aguardando conclusão e faturamento.',
      });
    }

    if (result.length === 0) {
      result.push({
        type: 'info',
        title: 'Tudo operando normalmente',
        description: 'Nenhum alerta crítico identificado no momento.',
      });
    }

    return result;
  }, [osList, pipelineData]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'critical': return <AlertCircle className="w-4 h-4 text-red-400" />;
      case 'warning': return <AlertTriangle className="w-4 h-4 text-amber-400" />;
      default: return <Zap className="w-4 h-4 text-blue-400" />;
    }
  };

  const getBorder = (type: string) => {
    switch (type) {
      case 'critical': return 'border-l-red-500';
      case 'warning': return 'border-l-amber-500';
      default: return 'border-l-blue-500';
    }
  };

  return (
    <div className="bg-[#1a1d27] rounded-xl border border-[#2a2e3a] p-5 h-full">
      <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
        <Zap className="w-4 h-4 text-amber-400" />
        Insights & Alertas
      </h3>

      <div className="flex flex-col gap-3 max-h-[440px] overflow-y-auto pr-1">
        {insights.map((insight, i) => (
          <div
            key={i}
            className={`bg-[#232733] rounded-lg p-3 border-l-[3px] ${getBorder(insight.type)} transition-all hover:bg-[#2a2e3a]`}
          >
            <div className="flex items-start gap-2">
              <div className="mt-0.5 flex-shrink-0">{getIcon(insight.type)}</div>
              <div>
                <p className="text-xs font-semibold text-white">{insight.title}</p>
                <p className="text-[11px] text-[#9ca3af] mt-1 leading-relaxed">{insight.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
