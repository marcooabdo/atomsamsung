import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { UnitFilter } from '../components/UnitFilter';
import {
  Activity,
  AlertTriangle,
  Clock,
  Download,
  Layers,
  TrendingUp,
  Zap,
  DollarSign,
  Target,
  BarChart2,
  X,
  Copy,
  Check,
} from 'lucide-react';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';

const COLUNAS_KANBAN = [
  { id: 'os_nova', label: 'OS Nova', color: '#0EA5E9' },
  { id: 'diagnostico', label: 'Diagnóstico/Triagem', color: '#06B6D4' },
  { id: 'negociacao_em_andamento', label: 'Enviar Orçamento', color: '#F59E0B' },
  { id: 'aguardando_aprovacao', label: 'Aguardando Aprovação', color: '#F97316' },
  { id: 'orcamento_aprovado', label: 'Orçamento Aprovado', color: '#10B981' },
  { id: 'aguardando_peca', label: 'Aguardando Peça', color: '#8B5CF6' },
  { id: 'peca_em_transito', label: 'Peça em Trânsito', color: '#3B82F6' },
  { id: 'em_reparo_ci', label: 'Em Reparo CI', color: '#0EA5E9' },
  { id: 'rota_preta', label: 'Rota Preta', color: '#1a1a1a' },
  { id: 'rota_vermelha', label: 'Rota Vermelha', color: '#EF4444' },
  { id: 'rota_azul', label: 'Rota Azul', color: '#3B82F6' },
  { id: 'rota_verde', label: 'Rota Verde', color: '#10B981' },
  { id: 'rota_rosa', label: 'Rota Rosa', color: '#EC4899' },
  { id: 'rota_amarela', label: 'Rota Amarela', color: '#EAB308' },
  { id: 'rota_laranja', label: 'Rota Laranja', color: '#F97316' },
  { id: 'em_rota_ih', label: 'Agendados (FTF)', color: '#10B981' },
  { id: 'em_reparo_ih', label: 'Reparo em Progresso IH', color: '#06B6D4' },
  { id: 'instalacao_inicial', label: 'Instalação Inicial', color: '#7C3AED' },
  { id: 'service_handling', label: 'Service Handling', color: '#DB2777' },
  { id: 'return_handling', label: 'Return Handling', color: '#D97706' },
  { id: 'trade_up', label: 'Trade Up', color: '#0891B2' },
  { id: 'saw', label: 'SAW', color: '#14B8A6' },
  { id: 'controle_qualidade', label: 'Controle de Qualidade / OQC', color: '#2563EB' },
  { id: 'qa_bt', label: 'Q&A / BT', color: '#7C3AED' },
  { id: 'reparo_concluido', label: 'Reparo Concluído', color: '#10B981' },
  { id: 'aguardando_fechamento', label: 'Aguardando Fechamento', color: '#F59E0B' },
  { id: 'os_fechada', label: 'OS Fechada', color: '#6B7280' },
  { id: 'orcamentos_rejeitados', label: 'Orçamentos Rejeitados', color: '#EF4444' },
];

interface OSRow {
  id: string;
  coluna_kanban: string;
  created_at: string;
  updated_at: string;
  coluna_kanban_desde: string | null;
  valor_total: number | null;
  valor_pecas: number | null;
  valor_servicos: number | null;
  valor_pago: number | null;
  tipo_os: string | null;
  tipo_atendimento: string | null;
  unidade_id: string | null;
  numero_os_samsung: string | null;
  numero_os_interna: string | null;
}

interface PecaRow {
  id: string;
  os_id: string;
  pn: string | null;
  codigo: string | null;
  valor_unitario: number | null;
  valor_gspn?: number | null;
}

interface PecaIssueOS {
  osId: string;
  osLabel: string;
  pecas: PecaRow[];
  semCodigo: number;
  semValor: number;
  semPeca?: boolean;
}

function formatDuration(days: number, hours?: number): string {
  if (days === 0 && hours !== undefined) {
    const h = Math.floor(hours);
    if (h === 0) return '<1h';
    return `${h}h`;
  }
  return `${days} dia${days !== 1 ? 's' : ''}`;
}

export function Cockpit() {
  const { usuario, unidades, unidadesAdicionais, allUserUnits } = useAuth();
  const [selectedUnidade, setSelectedUnidade] = useState('');
  const [filterAtendimento, setFilterAtendimento] = useState<'' | 'IH' | 'CI'>('');
  const [osData, setOsData] = useState<OSRow[]>([]);
  const [pecasMap, setPecasMap] = useState<Map<string, PecaRow[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [listModal, setListModal] = useState<{ open: boolean; osList: PecaIssueOS[] }>({ open: false, osList: [] });
  const [daysModal, setDaysModal] = useState<{ open: boolean; title: string; items: { label: string; days: number; hours?: number }[] }>({ open: false, title: '', items: [] });

  const canSeeAllUnits = (usuario?.tipo === 'master' || usuario?.tipo === 'diretoria') && !usuario?.unidade_id;
  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    if (usuario) loadData();
  }, [usuario, selectedUnidade, unidadesAdicionais]);

  useEffect(() => {
    if (!usuario) return;
    const channel = supabase
      .channel('cockpit-os-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'os' }, () => {
        loadData(true);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [usuario, selectedUnidade, unidadesAdicionais]);

  const loadData = useCallback(async (silent = false) => {
    if (!silent && !hasLoadedOnce.current) setLoading(true);
    try {
      let query = supabase
        .from('os')
        .select('id, coluna_kanban, created_at, updated_at, coluna_kanban_desde, valor_total, valor_pecas, valor_servicos, valor_pago, tipo_os, tipo_atendimento, unidade_id, numero_os_samsung, numero_os_interna')
        .neq('arquivada', true);

      if (selectedUnidade) {
        query = query.eq('unidade_id', selectedUnidade);
      } else if (!canSeeAllUnits) {
        if (allUserUnits.length > 0) {
          query = query.in('unidade_id', allUserUnits);
        } else if (usuario?.unidade_id) {
          query = query.eq('unidade_id', usuario.unidade_id);
        }
      }

      const allOS: OSRow[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await query.range(from, from + pageSize - 1);
        if (error) break;
        if (data) allOS.push(...(data as OSRow[]));
        hasMore = (data?.length || 0) === pageSize;
        from += pageSize;
      }
      setOsData(allOS);

      // Load pecas for all open OS to check missing code/value
      const openOsIds = allOS.filter(os => os.coluna_kanban !== 'os_fechada').map(os => os.id);
      const map = new Map<string, PecaRow[]>();
      if (openOsIds.length > 0) {
        const batchSize = 100;
        for (let i = 0; i < openOsIds.length; i += batchSize) {
          const batch = openOsIds.slice(i, i + batchSize);
          const { data: pecas } = await supabase
            .from('os_pecas')
            .select('id, os_id, pn, codigo, valor_unitario, valor_gspn')
            .in('os_id', batch);
          if (pecas) {
            for (const p of pecas as PecaRow[]) {
              if (!map.has(p.os_id)) map.set(p.os_id, []);
              map.get(p.os_id)!.push(p);
            }
          }
        }
        // Also load requisicoes_pecas for OS that have no os_pecas
        const osWithoutPecas = openOsIds.filter(id => !map.has(id));
        for (let i = 0; i < osWithoutPecas.length; i += batchSize) {
          const batch = osWithoutPecas.slice(i, i + batchSize);
          const { data: reqs } = await supabase
            .from('requisicoes_pecas')
            .select('id, os_id, codigo_peca, valor_peca')
            .in('os_id', batch)
            .not('status', 'in', '(cancelada,reprovada)');
          if (reqs) {
            for (const r of reqs as any[]) {
              if (!map.has(r.os_id)) map.set(r.os_id, []);
              map.get(r.os_id)!.push({
                id: r.id,
                os_id: r.os_id,
                pn: r.codigo_peca,
                codigo: r.codigo_peca,
                valor_unitario: r.valor_peca,
                valor_gspn: r.valor_peca,
              });
            }
          }
        }
      }
      setPecasMap(map);
    } catch (err) {
      console.error('Cockpit load error:', err);
    } finally {
      setLoading(false);
      hasLoadedOnce.current = true;
    }
  }, [usuario, selectedUnidade, unidadesAdicionais]);

  const filteredOsData = useMemo(() => {
    if (!filterAtendimento) return osData;
    return osData.filter(os => os.tipo_atendimento === filterAtendimento);
  }, [osData, filterAtendimento]);

  const dailyStats = useMemo(() => {
    const last30Days: { date: string; abertas: number; fechadas: number }[] = [];
    const now = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const abertas = filteredOsData.filter(os => os.created_at?.startsWith(dateStr)).length;
      const fechadas = filteredOsData.filter(os => os.coluna_kanban === 'os_fechada' && os.updated_at?.startsWith(dateStr)).length;
      last30Days.push({ date: dateStr, abertas, fechadas });
    }
    return last30Days;
  }, [filteredOsData]);

  const columnStats = useMemo(() => {
    const now = new Date();
    return COLUNAS_KANBAN.map(col => {
      const cards = filteredOsData.filter(os => os.coluna_kanban === col.id);
      const count = cards.length;

      let oldestDays = 0;
      let oldestOSLabel = '';
      let oldestHours = 0;
      let oldestInStageDays = 0;
      let oldestInStageOSLabel = '';
      let oldestInStageHours = 0;
      const allOsDays: { label: string; days: number; hours?: number }[] = [];
      const allOsStageDays: { label: string; days: number; hours?: number }[] = [];

      if (cards.length > 0) {
        cards.forEach(os => {
          const osLabel = os.numero_os_samsung || os.numero_os_interna || os.id.slice(0, 8);
          const msOpen = now.getTime() - new Date(os.created_at).getTime();
          const hoursOpen = msOpen / (1000 * 60 * 60);
          const daysOpen = Math.floor(hoursOpen / 24);
          allOsDays.push({ label: osLabel, days: daysOpen, hours: hoursOpen });

          const stageDate = os.coluna_kanban_desde || os.updated_at || os.created_at;
          const msInStage = now.getTime() - new Date(stageDate).getTime();
          const hoursInStage = msInStage / (1000 * 60 * 60);
          const daysInStage = Math.floor(hoursInStage / 24);
          allOsStageDays.push({ label: osLabel, days: daysInStage, hours: hoursInStage });
        });

        allOsDays.sort((a, b) => b.days - a.days);
        allOsStageDays.sort((a, b) => b.days - a.days);

        oldestDays = allOsDays[0]?.days || 0;
        oldestOSLabel = allOsDays[0]?.label || '';
        oldestHours = allOsDays[0]?.hours || 0;
        oldestInStageDays = allOsStageDays[0]?.days || 0;
        oldestInStageOSLabel = allOsStageDays[0]?.label || '';
        oldestInStageHours = allOsStageDays[0]?.hours || 0;
      }

      let semCodigoOuValor = 0;
      let totalSemCodigo = 0;
      let totalSemValor = 0;
      let totalSemPeca = 0;
      const osComProblema: PecaIssueOS[] = [];
      cards.forEach(os => {
        const pecas = pecasMap.get(os.id);
        if (!pecas || pecas.length === 0) {
          semCodigoOuValor++;
          totalSemPeca++;
          osComProblema.push({
            osId: os.id,
            osLabel: os.numero_os_samsung || os.numero_os_interna || os.id.slice(0, 8),
            pecas: [],
            semCodigo: 0,
            semValor: 0,
            semPeca: true,
          });
        } else {
          const hasCodigo = (p: PecaRow) => (p.pn && p.pn.trim() !== '') || (p.codigo && p.codigo.trim() !== '');
          const semCodigo = pecas.filter(p => !hasCodigo(p)).length;
          const semValor = pecas.filter(p => hasCodigo(p) && (Number(p.valor_unitario || 0) < 0.01 && Number(p.valor_gspn || 0) < 0.01)).length;
          if (semCodigo > 0 || semValor > 0) {
            semCodigoOuValor++;
            if (semCodigo > 0) totalSemCodigo++;
            if (semValor > 0) totalSemValor++;
            osComProblema.push({
              osId: os.id,
              osLabel: os.numero_os_samsung || os.numero_os_interna || os.id.slice(0, 8),
              pecas,
              semCodigo,
              semValor,
            });
          }
        }
      });

      return { ...col, count, oldestDays, oldestOSLabel, oldestHours, oldestInStageDays, oldestInStageOSLabel, oldestInStageHours, semCodigoOuValor, totalSemCodigo, totalSemValor, totalSemPeca, osComProblema, allOsDays, allOsStageDays };
    });
  }, [filteredOsData, pecasMap]);

  const kpis = useMemo(() => {
    const totalOS = filteredOsData.length;
    const osAbertas = filteredOsData.filter(os => os.coluna_kanban !== 'os_fechada').length;
    const osFechadas = filteredOsData.filter(os => os.coluna_kanban === 'os_fechada').length;
    const lpCount = filteredOsData.filter(os => os.tipo_os === 'LP').length;
    const owCount = filteredOsData.filter(os => os.tipo_os === 'OW').length;
    const ihCount = filteredOsData.filter(os => os.tipo_atendimento === 'IH').length;
    const ciCount = filteredOsData.filter(os => os.tipo_atendimento === 'CI').length;

    const valorTotal = filteredOsData.reduce((sum, os) => sum + (os.valor_total || 0), 0);
    const valorPecas = filteredOsData.reduce((sum, os) => sum + (os.valor_pecas || 0), 0);
    const valorServicos = filteredOsData.reduce((sum, os) => sum + (os.valor_servicos || 0), 0);
    const valorPago = filteredOsData.reduce((sum, os) => sum + (os.valor_pago || 0), 0);

    const avgDaysOpen = osAbertas > 0
      ? filteredOsData.filter(os => os.coluna_kanban !== 'os_fechada').reduce((sum, os) => {
          const days = Math.floor((Date.now() - new Date(os.created_at).getTime()) / (1000 * 60 * 60 * 24));
          return sum + days;
        }, 0) / osAbertas
      : 0;

    return { totalOS, osAbertas, osFechadas, lpCount, owCount, ihCount, ciCount, valorTotal, valorPecas, valorServicos, valorPago, avgDaysOpen };
  }, [filteredOsData]);

  const warrantyDistribution = useMemo(() => {
    return [
      { name: 'LP', value: kpis.lpCount, color: '#0EA5E9' },
      { name: 'OW', value: kpis.owCount, color: '#F59E0B' },
      { name: 'Outros', value: kpis.totalOS - kpis.lpCount - kpis.owCount, color: '#6B7280' },
    ].filter(t => t.value > 0);
  }, [kpis]);

  const serviceDistribution = useMemo(() => {
    return [
      { name: 'IH', value: kpis.ihCount, color: '#10B981' },
      { name: 'CI', value: kpis.ciCount, color: '#00D4FF' },
      { name: 'Outros', value: kpis.totalOS - kpis.ihCount - kpis.ciCount, color: '#6B7280' },
    ].filter(t => t.value > 0);
  }, [kpis]);

  function exportCSV() {
    const header = 'Coluna,Quantidade,Card Mais Antigo (dias),Problemas Peças\n';
    const rows = columnStats.map(c => `"${c.label}",${c.count},${c.oldestDays},${c.semCodigoOuValor}`).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cockpit_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function formatCurrency(value: number) {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-2 border-[#00D4FF] border-t-transparent rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Carregando Cockpit...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#00D4FF]/20 to-[#00D4FF]/5 border border-[#00D4FF]/30 flex items-center justify-center">
            <Activity className="w-5 h-5 text-[#00D4FF]" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Cockpit Executivo</h1>
            <p className="text-xs text-gray-500">Visão gerencial em tempo real</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <UnitFilter unidades={unidades} selectedUnidade={selectedUnidade} onUnidadeChange={setSelectedUnidade} />
          <select
            value={filterAtendimento}
            onChange={(e) => setFilterAtendimento(e.target.value as '' | 'IH' | 'CI')}
            className="px-3 py-2 rounded-lg bg-gray-800/60 border border-gray-700 text-sm text-gray-200 focus:outline-none focus:border-[#00D4FF]/50"
          >
            <option value="">Todos (IH/CI)</option>
            <option value="IH">Somente IH</option>
            <option value="CI">Somente CI</option>
          </select>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#00D4FF]/10 border border-[#00D4FF]/30 text-[#00D4FF] text-sm hover:bg-[#00D4FF]/20 transition-all">
            <Download className="w-4 h-4" />
            Exportar
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
        <KPICard icon={Layers} label="Total OS" value={kpis.totalOS.toString()} color="#00D4FF" />
        <KPICard icon={Zap} label="OS Abertas" value={kpis.osAbertas.toString()} color="#F59E0B" />
        <KPICard icon={Target} label="OS Fechadas" value={kpis.osFechadas.toString()} color="#10B981" />
        <KPICard icon={Clock} label="Dias Médio Aberta" value={kpis.avgDaysOpen.toFixed(1)} color="#F97316" />
        <KPICard icon={DollarSign} label="Valor Total" value={formatCurrency(kpis.valorTotal)} color="#39FF14" />
      </div>

      {/* Type breakdown */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <TypeBadge label="LP" count={kpis.lpCount} color="#0EA5E9" />
        <TypeBadge label="OW" count={kpis.owCount} color="#F59E0B" />
        <TypeBadge label="IH" count={kpis.ihCount} color="#10B981" />
        <TypeBadge label="CI" count={kpis.ciCount} color="#8B5CF6" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Line chart: OS opened/closed per day */}
        <div className="lg:col-span-2 rounded-xl border border-gray-800/60 bg-[#0D0D12]/80 backdrop-blur-sm p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#00D4FF]" />
            OS Abertas vs Fechadas (Últimos 30 dias)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dailyStats}>
                <defs>
                  <linearGradient id="gradAbertas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#00D4FF" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#00D4FF" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradFechadas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#39FF14" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#39FF14" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                <XAxis dataKey="date" tick={{ fill: '#6b7280', fontSize: 10 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fill: '#6b7280', fontSize: 10 }} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }} labelStyle={{ color: '#9ca3af' }} />
                <Area type="monotone" dataKey="abertas" stroke="#00D4FF" fill="url(#gradAbertas)" strokeWidth={2} name="Abertas" />
                <Area type="monotone" dataKey="fechadas" stroke="#39FF14" fill="url(#gradFechadas)" strokeWidth={2} name="Fechadas" />
                <Legend wrapperStyle={{ paddingTop: 10 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie chart: Garantia (LP/OW) */}
        <div className="rounded-xl border border-gray-800/60 bg-[#0D0D12]/80 backdrop-blur-sm p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-[#0EA5E9]" />
            Tipo de Garantia
          </h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={warrantyDistribution} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {warrantyDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie chart: Servico (IH/CI) */}
        <div className="rounded-xl border border-gray-800/60 bg-[#0D0D12]/80 backdrop-blur-sm p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-[#10B981]" />
            Tipo de Serviço
          </h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={serviceDistribution} cx="50%" cy="50%" innerRadius={40} outerRadius={70} dataKey="value" nameKey="name" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {serviceDistribution.map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Pipeline Status Table - ALL columns */}
      <div className="rounded-xl border border-gray-800/60 bg-[#0D0D12]/80 backdrop-blur-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-800/60 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-300 flex items-center gap-2">
            <Layers className="w-4 h-4 text-[#00D4FF]" />
            Pipeline Completo - Central ATOM
          </h3>
          <span className="text-xs text-gray-500">{osData.length} OS no sistema</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-800/40">
                <th className="text-left px-5 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Etapa</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Quantidade</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">OS Mais Antiga</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Mais Antiga na Etapa</th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">Problemas Peça</th>
              </tr>
            </thead>
            <tbody>
              {columnStats.map((col) => (
                <tr key={col.id} className="border-b border-gray-800/20 hover:bg-white/[0.02] transition-colors">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                      <span className="text-sm text-gray-300">{col.label}</span>
                    </div>
                  </td>
                  <td className="text-center px-4 py-3">
                    <span className="inline-flex items-center justify-center min-w-[36px] px-2.5 py-1 rounded-full text-xs font-bold" style={{ backgroundColor: `${col.color}20`, color: col.color }}>
                      {col.count}
                    </span>
                  </td>
                  <td className="text-center px-4 py-3">
                    {col.count > 0 ? (
                      <button
                        onClick={() => setDaysModal({ open: true, title: `${col.label} - Dias Aberto`, items: col.allOsDays })}
                        className={`text-xs font-semibold px-2 py-0.5 rounded cursor-pointer hover:ring-1 hover:ring-gray-600 transition-all ${col.oldestDays > 14 ? 'text-red-300 bg-red-500/10' : col.oldestDays > 7 ? 'text-yellow-300 bg-yellow-500/10' : 'text-gray-400 bg-gray-800/40'}`}
                      >
                        {formatDuration(col.oldestDays, col.oldestHours)}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-600">-</span>
                    )}
                  </td>
                  <td className="text-center px-4 py-3">
                    {col.count > 0 ? (
                      <button
                        onClick={() => setDaysModal({ open: true, title: `${col.label} - Dias na Etapa`, items: col.allOsStageDays })}
                        className={`text-xs font-semibold px-2 py-0.5 rounded cursor-pointer hover:ring-1 hover:ring-gray-600 transition-all ${col.oldestInStageDays > 14 ? 'text-red-300 bg-red-500/10' : col.oldestInStageDays > 7 ? 'text-yellow-300 bg-yellow-500/10' : 'text-gray-400 bg-gray-800/40'}`}
                      >
                        {formatDuration(col.oldestInStageDays, col.oldestInStageHours)}
                      </button>
                    ) : (
                      <span className="text-xs text-gray-600">-</span>
                    )}
                  </td>
                  <td className="text-center px-4 py-3">
                    {col.semCodigoOuValor > 0 ? (
                      <button
                        onClick={() => setListModal({ open: true, osList: col.osComProblema })}
                        className="inline-flex flex-col items-center gap-0.5 text-xs font-medium text-red-400 hover:text-red-300 transition-colors cursor-pointer"
                      >
                        <span className="flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          {col.semCodigoOuValor}
                        </span>
                        <span className="text-[10px] text-gray-500 font-normal">
                          {[col.totalSemPeca > 0 ? `${col.totalSemPeca} s/peça` : '', col.totalSemCodigo > 0 ? `${col.totalSemCodigo} s/cod` : '', col.totalSemValor > 0 ? `${col.totalSemValor} s/valor` : ''].filter(Boolean).join(' | ')}
                        </span>
                      </button>
                    ) : (
                      <span className="text-xs text-green-500">{col.count > 0 ? 'OK' : '-'}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-gray-700/50 bg-white/[0.02]">
                <td className="px-5 py-3 text-sm font-semibold text-gray-300">Total</td>
                <td className="text-center px-4 py-3">
                  <span className="text-sm font-bold text-[#00D4FF]">{columnStats.reduce((s, c) => s + c.count, 0)}</span>
                </td>
                <td className="text-center px-4 py-3">
                  <span className="text-xs text-gray-400 font-medium">
                    Max: {formatDuration(Math.max(...columnStats.filter(c => c.count > 0).map(c => c.oldestDays), 0))}
                  </span>
                </td>
                <td className="text-center px-4 py-3">
                  <span className="text-xs text-gray-400 font-medium">
                    Max: {formatDuration(Math.max(...columnStats.filter(c => c.count > 0).map(c => c.oldestInStageDays), 0))}
                  </span>
                </td>
                <td className="text-center px-4 py-3">
                  <div className="flex flex-col items-center gap-0.5">
                    <span className="text-xs font-medium text-red-400">
                      {columnStats.reduce((s, c) => s + c.semCodigoOuValor, 0)} OS
                    </span>
                    <span className="text-[10px] text-gray-500">
                      {columnStats.reduce((s, c) => s + c.totalSemPeca, 0)} s/peça | {columnStats.reduce((s, c) => s + c.totalSemCodigo, 0)} s/cod | {columnStats.reduce((s, c) => s + c.totalSemValor, 0)} s/valor
                    </span>
                  </div>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Bottom insights row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Top bottlenecks */}
        <div className="rounded-xl border border-gray-800/60 bg-[#0D0D12]/80 backdrop-blur-sm p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-yellow-400" />
            Gargalos (Maior Tempo)
          </h3>
          <div className="space-y-3">
            {columnStats
              .filter(c => c.count > 0 && c.id !== 'os_fechada')
              .sort((a, b) => b.oldestDays - a.oldestDays)
              .slice(0, 5)
              .map((col) => (
                <div key={col.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: col.color }} />
                    <span className="text-xs text-gray-400">{col.label}</span>
                  </div>
                  <span className={`text-xs font-bold ${col.oldestDays > 14 ? 'text-red-400' : col.oldestDays > 7 ? 'text-yellow-400' : 'text-gray-300'}`}>
                    {col.oldestDays}d
                  </span>
                </div>
              ))}
          </div>
        </div>

        {/* Volume by column - bar chart */}
        <div className="rounded-xl border border-gray-800/60 bg-[#0D0D12]/80 backdrop-blur-sm p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <BarChart2 className="w-4 h-4 text-[#00D4FF]" />
            Volume por Etapa
          </h3>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={columnStats.filter(c => c.count > 0 && c.id !== 'os_fechada').slice(0, 8)} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#6b7280', fontSize: 10 }} />
                <YAxis type="category" dataKey="label" tick={{ fill: '#9ca3af', fontSize: 9 }} width={110} />
                <Tooltip contentStyle={{ backgroundColor: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }} />
                <Bar dataKey="count" name="OS" radius={[0, 4, 4, 0]}>
                  {columnStats.filter(c => c.count > 0 && c.id !== 'os_fechada').slice(0, 8).map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Financial summary */}
        <div className="rounded-xl border border-gray-800/60 bg-[#0D0D12]/80 backdrop-blur-sm p-5">
          <h3 className="text-sm font-semibold text-gray-300 mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-[#39FF14]" />
            Resumo Financeiro
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Valor Total OS</span>
              <span className="text-sm font-bold text-white">{formatCurrency(kpis.valorTotal)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Valor Peças</span>
              <span className="text-sm font-bold text-[#00D4FF]">{formatCurrency(kpis.valorPecas)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Valor Serviços</span>
              <span className="text-sm font-bold text-[#39FF14]">{formatCurrency(kpis.valorServicos)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Valor Pago</span>
              <span className="text-sm font-bold text-green-400">{formatCurrency(kpis.valorPago)}</span>
            </div>
            <div className="h-px bg-gray-800 my-2" />
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Ticket Médio</span>
              <span className="text-sm font-bold text-[#00D4FF]">
                {kpis.osFechadas > 0 ? formatCurrency(kpis.valorTotal / kpis.osFechadas) : 'R$ 0,00'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500">Taxa Conversão</span>
              <span className="text-sm font-bold text-green-400">
                {kpis.totalOS > 0 ? ((kpis.osFechadas / kpis.totalOS) * 100).toFixed(1) : 0}%
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* List OS Modal */}
      {daysModal.open && (
        <DaysListModal
          title={daysModal.title}
          items={daysModal.items}
          onClose={() => setDaysModal({ open: false, title: '', items: [] })}
        />
      )}
      {listModal.open && (
        <ListOSModal
          osList={listModal.osList}
          onClose={() => setListModal({ open: false, osList: [] })}
        />
      )}
    </div>
  );
}

function DaysListModal({ title, items, onClose }: { title: string; items: { label: string; days: number; hours?: number }[]; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = items.map(item => `${item.label} - ${formatDuration(item.days, item.hours)}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#12121a] border border-gray-800 rounded-xl w-full max-w-md max-h-[70vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-white">{title} ({items.length} OS)</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${copied ? 'bg-green-500/20 text-green-300' : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'}`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="space-y-1.5">
            {items.map((item, i) => (
              <div key={i} className="flex items-center justify-between px-3 py-2 rounded-lg bg-gray-900/50 border border-gray-800/40">
                <span className="text-sm font-mono text-[#00D4FF]">{item.label}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded ${item.days > 14 ? 'text-red-300 bg-red-500/10' : item.days > 7 ? 'text-yellow-300 bg-yellow-500/10' : 'text-gray-400 bg-gray-800/40'}`}>
                  {formatDuration(item.days, item.hours)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function ListOSModal({ osList, onClose }: { osList: PecaIssueOS[]; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const text = osList.map(os => {
      const issues: string[] = [];
      if (os.semPeca) issues.push('sem peça cadastrada');
      if (os.semCodigo > 0) issues.push(`${os.semCodigo} sem código`);
      if (os.semValor > 0) issues.push(`${os.semValor} peça com valor R$0`);
      return `${os.osLabel} - ${issues.join(', ')}`;
    }).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-[#12121a] border border-gray-800 rounded-xl w-full max-w-md max-h-[70vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-800">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-400" />
            OS com Problemas nas Peças ({osList.length})
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${copied ? 'bg-green-500/20 text-green-300' : 'bg-gray-800 text-gray-300 hover:bg-gray-700 hover:text-white'}`}
            >
              {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-800 transition-colors">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          <div className="space-y-2">
            {osList.map(os => (
              <div key={os.osId} className="px-3 py-2.5 rounded-lg bg-gray-900/50 border border-gray-800/40">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-mono text-[#00D4FF]">{os.osLabel}</span>
                </div>
                <div className="flex items-center gap-3 mt-1">
                  {os.semPeca && (
                    <span className="text-xs text-red-400">sem peça cadastrada</span>
                  )}
                  {os.semCodigo > 0 && (
                    <span className="text-xs text-orange-400">{os.semCodigo} sem código</span>
                  )}
                  {os.semValor > 0 && (
                    <span className="text-xs text-yellow-400">{os.semValor} peça com valor R$0</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function KPICard({ icon: Icon, label, value, color }: { icon: any; label: string; value: string; color: string }) {
  return (
    <div className="rounded-xl border border-gray-800/60 bg-[#0D0D12]/80 backdrop-blur-sm p-4 hover:border-opacity-100 transition-all" style={{ borderColor: `${color}30` }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" style={{ color }} />
        <span className="text-xs text-gray-500 uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-xl font-bold text-white truncate">{value}</p>
    </div>
  );
}

function TypeBadge({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-lg border transition-all" style={{ borderColor: `${color}30`, backgroundColor: `${color}08` }}>
      <span className="text-sm font-bold" style={{ color }}>{label}</span>
      <span className="text-lg font-bold text-white">{count}</span>
    </div>
  );
}

export default Cockpit;
