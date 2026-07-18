import { PipelineRow } from '../../pages/GerencialDashboard';
import { format, differenceInDays } from 'date-fns';
import { AlertTriangle, Clock } from 'lucide-react';

interface Props {
  data: PipelineRow[];
}

export function PipelineTable({ data }: Props) {
  const activeRows = data.filter(r => r.count > 0 || r.id === 'aguardando_peca');
  const totalCards = activeRows.reduce((acc, r) => acc + r.count, 0);

  return (
    <div className="bg-[#1a1d27] rounded-xl border border-[#2a2e3a] overflow-hidden">
      <div className="p-5 border-b border-[#2a2e3a] flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-white">Pipeline Kanban</h2>
          <p className="text-xs text-[#6b7280] mt-0.5">{totalCards} OS ativas no pipeline</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#2a2e3a]">
              <th className="text-left px-5 py-3 text-xs font-medium text-[#6b7280] uppercase tracking-wide">Etapa</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-[#6b7280] uppercase tracking-wide">Qtd</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-[#6b7280] uppercase tracking-wide">Card Mais Antigo</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-[#6b7280] uppercase tracking-wide">Tempo na Etapa</th>
              <th className="text-center px-4 py-3 text-xs font-medium text-[#6b7280] uppercase tracking-wide">Alertas</th>
            </tr>
          </thead>
          <tbody>
            {activeRows.map(row => {
              const days = row.hoursInStage ? Math.floor(row.hoursInStage / 24) : null;
              const hours = row.hoursInStage ? row.hoursInStage % 24 : null;
              const isOld = days !== null && days > 7;

              return (
                <tr key={row.id} className="border-b border-[#2a2e3a]/50 hover:bg-[#232733] transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ background: row.color }} />
                      <span className="text-white font-medium text-sm">{row.label}</span>
                    </div>
                  </td>
                  <td className="text-center px-4 py-3">
                    <span className="inline-flex items-center justify-center min-w-[32px] px-2 py-0.5 rounded-full text-xs font-bold bg-[#232733] text-white">
                      {row.count}
                    </span>
                  </td>
                  <td className="text-center px-4 py-3 text-xs text-[#9ca3af]">
                    {row.oldestCardDate
                      ? format(new Date(row.oldestCardDate), 'dd/MM/yyyy HH:mm')
                      : '-'}
                  </td>
                  <td className="text-center px-4 py-3">
                    {days !== null ? (
                      <span className={`inline-flex items-center gap-1 text-xs font-medium ${isOld ? 'text-red-400' : 'text-[#9ca3af]'}`}>
                        <Clock className="w-3 h-3" />
                        {days > 0 ? `${days}d ${hours}h` : `${hours}h`}
                      </span>
                    ) : (
                      <span className="text-xs text-[#6b7280]">-</span>
                    )}
                  </td>
                  <td className="text-center px-4 py-3">
                    {row.alertCount !== undefined && row.alertCount > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                        <AlertTriangle className="w-3 h-3" />
                        {row.alertCount}
                      </span>
                    ) : row.id === 'aguardando_peca' ? (
                      <span className="text-xs text-green-400">0</span>
                    ) : (
                      <span className="text-xs text-[#6b7280]">-</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
