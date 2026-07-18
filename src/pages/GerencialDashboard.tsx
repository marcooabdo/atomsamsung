import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { COLUNAS_KANBAN } from '../lib/constants';
import { KPICards } from '../components/gerencial/KPICards';
import { PipelineTable } from '../components/gerencial/PipelineTable';
import { ChartsSection } from '../components/gerencial/ChartsSection';
import { FinancialSummary } from '../components/gerencial/FinancialSummary';
import { InsightsPanel } from '../components/gerencial/InsightsPanel';
import { RefreshCw, Download, Building2, ChartBar as BarChart3 } from 'lucide-react';
import { format, subDays, differenceInHours, differenceInDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface OSData {
  id: string;
  numero_os_samsung: string;
  numero_os_interna: string;
  coluna_kanban: string;
  tipo_os: string;
  tipo_atendimento: string;
  valor_total: string;
  valor_pecas: string;
  valor_servicos: string;
  created_at: string;
  fechada_em: string | null;
  unidade_id: string;
  cliente_nome: string;
  coluna_kanban_moved_at: string | null;
  updated_at: string | null;
}

export interface RequisicaoData {
  id: string;
  os_id: string;
  codigo_peca: string | null;
  valor_peca: string | null;
  status: string;
}

export interface OSPecaData {
  os_id: string;
  pn: string;
  codigo: string;
  valor_gspn: string;
}

export interface PipelineRow {
  id: string;
  label: string;
  color: string;
  count: number;
  oldestCardDate: string | null;
  hoursInStage: number | null;
  alertCount?: number;
}

export interface DashboardData {
  osList: OSData[];
  requisicoes: RequisicaoData[];
  osPecas: OSPecaData[];
  unidades: { id: string; nome: string }[];
}

export function GerencialDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedUnit, setSelectedUnit] = useState<string>('all');
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const [osResult, reqResult, pecasResult, unidadesResult] = await Promise.all([
        supabase.from('os').select('id, numero_os_samsung, numero_os_interna, coluna_kanban, tipo_os, tipo_atendimento, valor_total, valor_pecas, valor_servicos, created_at, fechada_em, unidade_id, cliente_nome, updated_at'),
        supabase.from('requisicoes_pecas').select('id, os_id, codigo_peca, valor_peca, status'),
        supabase.from('os_pecas').select('os_id, pn, codigo, valor_gspn'),
        supabase.from('unidades').select('id, nome').eq('ativa', true),
      ]);

      setData({
        osList: (osResult.data || []) as OSData[],
        requisicoes: (reqResult.data || []) as RequisicaoData[],
        osPecas: (pecasResult.data || []) as OSPecaData[],
        unidades: (unidadesResult.data || []) as { id: string; nome: string }[],
      });
      setLastUpdate(new Date());
    } catch (err) {
      console.error('Error fetching data:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const filteredOS = useMemo(() => {
    if (!data) return [];
    if (selectedUnit === 'all') return data.osList;
    return data.osList.filter(os => os.unidade_id === selectedUnit);
  }, [data, selectedUnit]);

  const pipelineData = useMemo((): PipelineRow[] => {
    if (!data) return [];
    const statusTerminais = ['pedido_feito', 'gi_postada', 'devolvida', 'devolvida_samsung', 'devolvida_upc', 'devolucao_pendente', 'cancelada', 'reprovada'];

    return COLUNAS_KANBAN.map(col => {
      const osInCol = filteredOS.filter(os => os.coluna_kanban === col.id);
      const count = osInCol.length;

      let oldestCardDate: string | null = null;
      let hoursInStage: number | null = null;

      if (count > 0) {
        const dates = osInCol
          .map(os => os.updated_at || os.created_at)
          .filter(Boolean)
          .sort();
        if (dates.length > 0) {
          oldestCardDate = dates[0];
          hoursInStage = differenceInHours(new Date(), new Date(dates[0]));
        }
      }

      let alertCount: number | undefined;
      if (col.id === 'aguardando_peca') {
        alertCount = 0;
        osInCol.forEach(os => {
          const reqs = data.requisicoes.filter(r => r.os_id === os.id);
          const pecasAtivas = reqs.filter(r => !statusTerminais.includes(r.status));
          
          const hasMissingCode = pecasAtivas.length > 0 && pecasAtivas.every(r => !r.codigo_peca);
          if (hasMissingCode) {
            alertCount!++;
            return;
          }
          
          const hasSemValor = pecasAtivas.some(r => {
            if (!r.codigo_peca) return false;
            if (r.valor_peca && Number(r.valor_peca) > 0) return false;
            const osPecaMatch = data.osPecas.find(p => 
              p.os_id === os.id && (p.pn === r.codigo_peca || p.codigo === r.codigo_peca)
            );
            if (osPecaMatch && Number(osPecaMatch.valor_gspn) > 0) return false;
            return true;
          });
          if (hasSemValor) alertCount!++;
        });
      }

      return { id: col.id, label: col.label, color: col.color, count, oldestCardDate, hoursInStage, alertCount };
    });
  }, [filteredOS, data]);

  const exportCSV = () => {
    const headers = ['Coluna', 'Quantidade', 'Card Mais Antigo', 'Horas na Etapa', 'Alertas'];
    const rows = pipelineData
      .filter(r => r.count > 0)
      .map(r => [
        r.label,
        r.count,
        r.oldestCardDate ? format(new Date(r.oldestCardDate), 'dd/MM/yyyy HH:mm') : '-',
        r.hoursInStage ?? '-',
        r.alertCount ?? '-',
      ]);
    const csv = [headers, ...rows].map(r => r.join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `gerencial_${format(new Date(), 'yyyy-MM-dd_HH-mm')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f1117]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-3 border-blue-500/30 border-t-blue-500 rounded-full animate-spin" />
          <p className="text-[#9ca3af] text-sm">Carregando painel gerencial...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f1117] p-6 lg:p-8">
      <header className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <BarChart3 className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white tracking-tight">Painel Gerencial</h1>
            <p className="text-sm text-[#6b7280]">
              Atualizado {format(lastUpdate, "dd/MM 'às' HH:mm", { locale: ptBR })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[#1a1d27] rounded-lg px-3 py-2 border border-[#2a2e3a]">
            <Building2 className="w-4 h-4 text-[#6b7280]" />
            <select
              value={selectedUnit}
              onChange={e => setSelectedUnit(e.target.value)}
              className="bg-transparent text-sm text-white border-none outline-none cursor-pointer"
            >
              <option value="all" className="bg-[#1a1d27]">Todas as Unidades</option>
              {data?.unidades.map(u => (
                <option key={u.id} value={u.id} className="bg-[#1a1d27]">{u.nome}</option>
              ))}
            </select>
          </div>

          <button
            onClick={exportCSV}
            className="flex items-center gap-2 bg-[#1a1d27] hover:bg-[#232733] text-sm text-white px-4 py-2 rounded-lg border border-[#2a2e3a] transition-colors"
          >
            <Download className="w-4 h-4" />
            Exportar
          </button>

          <button
            onClick={fetchData}
            disabled={refreshing}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-sm text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </header>

      <KPICards osList={filteredOS} />

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 mt-8">
        <div className="xl:col-span-2">
          <ChartsSection osList={filteredOS} />
        </div>
        <div>
          <InsightsPanel osList={filteredOS} pipelineData={pipelineData} />
        </div>
      </div>

      <div className="mt-8">
        <FinancialSummary osList={filteredOS} />
      </div>

      <div className="mt-8">
        <PipelineTable data={pipelineData} />
      </div>
    </div>
  );
}
