import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { UnitFilter } from '../components/UnitFilter';
import AuditarOSModal from '../components/audit/AuditarOSModal';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import {
  Shield, ShieldCheck, ShieldX, Search, Filter, DollarSign,
  Truck, TrendingUp, Package, AlertTriangle, ChevronDown, ChevronUp,
  ScanSearch
} from 'lucide-react';

interface OSAudit {
  id: string;
  numero_os_interna: string;
  numero_os_samsung: string | null;
  tipo_os: string;
  tipo_atendimento: string;
  cliente_cidade: string | null;
  cliente_estado: string | null;
  aparelho_modelo: string | null;
  coluna_kanban: string | null;
  status_samsung_desc: string | null;
  status_samsung_reason: string | null;
  valor_total: number | null;
  valor_pecas: number | null;
  auditado_km_valor: number | null;
  auditado_mao_obra_valor: number | null;
  auditado_imposto_valor: number | null;
  auditado_status: boolean;
  auditado_observacao: string | null;
  created_at: string;
  unidade_id: string;
  pecas_count: number;
  pecas_y: number;
  pecas_x: number;
  pecas_pending: number;
  custo_gspn_total: number;
}

const TIPO_ATENDIMENTO_OPTIONS = ['IH', 'CI', 'II', 'RH', 'SH', 'CC'];
const PAGE_SIZE = 40;

export function AtomAudit() {
  const { usuario } = useAuth();
  const [osList, setOsList] = useState<OSAudit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUnidade, setSelectedUnidade] = useState('');
  const [unidades, setUnidades] = useState<Array<{ id: string; nome: string }>>([]);

  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [tipoGarantia, setTipoGarantia] = useState<'LP' | 'OW' | 'TODOS'>('TODOS');
  const [tipoAtendimentoFilter, setTipoAtendimentoFilter] = useState<string[]>(['IH', 'CI', 'II', 'RH', 'SH', 'CC']);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroCidade, setFiltroCidade] = useState('');
  const [filtroModelo, setFiltroModelo] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<string[]>([]);
  const [showOnlyPending, setShowOnlyPending] = useState(false);

  const [sortField, setSortField] = useState<'maoObra' | 'km' | 'cidade' | 'modelo'>('maoObra');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState(0);

  const [auditingOSId, setAuditingOSId] = useState<string | null>(null);

  const [samsungStatuses, setSamsungStatuses] = useState<string[]>([]);

  useEffect(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    setDataInicio(firstDay.toISOString().split('T')[0]);
    setDataFim(today.toISOString().split('T')[0]);
    loadUnidades();
  }, []);

  useEffect(() => {
    if (usuario) {
      if (usuario.tipo !== 'master' && usuario.tipo !== 'diretoria' && usuario.unidade_id) {
        setSelectedUnidade(usuario.unidade_id);
      }
    }
  }, [usuario]);

  useEffect(() => {
    if (dataInicio && dataFim) loadData();
  }, [dataInicio, dataFim, selectedUnidade, tipoGarantia, tipoAtendimentoFilter]);

  const loadUnidades = async () => {
    const { data } = await supabase.from('unidades').select('id, nome').order('nome');
    setUnidades(data || []);
  };

  const canSelectUnit = usuario?.tipo === 'master' || usuario?.tipo === 'diretoria';

  const loadData = async () => {
    setLoading(true);
    setPage(0);
    try {
      let query = supabase
        .from('os')
        .select('id, numero_os_interna, numero_os_samsung, tipo_os, tipo_atendimento, cliente_cidade, cliente_estado, aparelho_modelo, coluna_kanban, status_samsung_desc, status_samsung_reason, valor_total, valor_pecas, auditado_km_valor, auditado_mao_obra_valor, auditado_imposto_valor, auditado_status, auditado_observacao, created_at, unidade_id')
        .gte('created_at', `${dataInicio}T00:00:00`)
        .lte('created_at', `${dataFim}T23:59:59`)
        .order('created_at', { ascending: false });

      if (tipoGarantia !== 'TODOS') {
        query = query.eq('tipo_os', tipoGarantia);
      }
      if (tipoAtendimentoFilter.length > 0 && tipoAtendimentoFilter.length < TIPO_ATENDIMENTO_OPTIONS.length) {
        query = query.in('tipo_atendimento', tipoAtendimentoFilter);
      }
      if (selectedUnidade) {
        query = query.eq('unidade_id', selectedUnidade);
      } else if (!canSelectUnit && usuario?.unidade_id) {
        query = query.eq('unidade_id', usuario.unidade_id);
      }

      const allOS: any[] = [];
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data, error } = await query.range(from, from + batchSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allOS.push(...data);
        if (data.length < batchSize) break;
        from += batchSize;
      }

      const osIds = allOS.map(o => o.id);
      const pecasMap: Record<string, { count: number; y: number; x: number; pending: number; custoGspn: number }> = {};

      if (osIds.length > 0) {
        for (let i = 0; i < osIds.length; i += 500) {
          const batch = osIds.slice(i, i + 500);
          const { data: pecasData } = await supabase
            .from('os_pecas')
            .select('os_id, auditado_samsung_status, valor_gspn, quantidade, is_cortesia_samsung')
            .in('os_id', batch);
          (pecasData || []).forEach(p => {
            if (!pecasMap[p.os_id]) pecasMap[p.os_id] = { count: 0, y: 0, x: 0, pending: 0, custoGspn: 0 };
            pecasMap[p.os_id].count++;
            if (p.auditado_samsung_status === 'Y') pecasMap[p.os_id].y++;
            else if (p.auditado_samsung_status === 'X') pecasMap[p.os_id].x++;
            else pecasMap[p.os_id].pending++;
            if (!p.is_cortesia_samsung) {
              pecasMap[p.os_id].custoGspn += (p.valor_gspn || 0) * (p.quantidade || 1);
            }
          });
        }
      }

      const statusSet = new Set<string>();
      const enriched: OSAudit[] = allOS.map(os => {
        const sDesc = (os.status_samsung_desc || '').trim();
        if (sDesc && sDesc !== 'NOT_FOUND' && sDesc !== 'FOUND') statusSet.add(sDesc);
        const pm = pecasMap[os.id] || { count: 0, y: 0, x: 0, pending: 0, custoGspn: 0 };
        return {
          ...os,
          status_samsung_desc: sDesc || null,
          status_samsung_reason: (os.status_samsung_reason || '').trim() || null,
          auditado_status: os.auditado_status || false,
          auditado_observacao: os.auditado_observacao || null,
          pecas_count: pm.count,
          pecas_y: pm.y,
          pecas_x: pm.x,
          pecas_pending: pm.pending,
          custo_gspn_total: pm.custoGspn,
        };
      });

      setSamsungStatuses(Array.from(statusSet).sort());
      setOsList(enriched);
    } catch (err) {
      console.error('Error loading audit data:', err);
    } finally {
      setLoading(false);
    }
  };

  const cidadesDisponiveis = useMemo(() => {
    const set = new Set<string>();
    osList.forEach(o => { if (o.cliente_cidade) set.add(o.cliente_cidade); });
    return Array.from(set).sort();
  }, [osList]);

  const modelosDisponiveis = useMemo(() => {
    const set = new Set<string>();
    osList.forEach(o => { if (o.aparelho_modelo) set.add(o.aparelho_modelo); });
    return Array.from(set).sort();
  }, [osList]);

  const filteredOS = useMemo(() => {
    let list = [...osList];
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      list = list.filter(o =>
        o.numero_os_interna?.toLowerCase().includes(term) ||
        o.numero_os_samsung?.toLowerCase().includes(term) ||
        o.cliente_cidade?.toLowerCase().includes(term) ||
        o.aparelho_modelo?.toLowerCase().includes(term)
      );
    }
    if (filtroCidade) list = list.filter(o => o.cliente_cidade === filtroCidade);
    if (filtroModelo) list = list.filter(o => o.aparelho_modelo === filtroModelo);
    if (filtroStatus.length > 0) list = list.filter(o => o.status_samsung_desc && filtroStatus.includes(o.status_samsung_desc));
    if (showOnlyPending) list = list.filter(o => !o.auditado_status);

    list.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'maoObra': return ((a.auditado_mao_obra_valor || 0) - (b.auditado_mao_obra_valor || 0)) * dir;
        case 'km': return ((a.auditado_km_valor || 0) - (b.auditado_km_valor || 0)) * dir;
        case 'cidade': return (a.cliente_cidade || '').localeCompare(b.cliente_cidade || '') * dir;
        case 'modelo': return (a.aparelho_modelo || '').localeCompare(b.aparelho_modelo || '') * dir;
        default: return 0;
      }
    });
    return list;
  }, [osList, searchTerm, filtroCidade, filtroModelo, filtroStatus, showOnlyPending, sortField, sortDir]);

  const totals = useMemo(() => {
    const total = filteredOS.length;
    const auditadas = filteredOS.filter(o => o.auditado_status).length;
    const pendentes = total - auditadas;
    const receitaMaoObra = filteredOS.reduce((s, o) => s + (o.auditado_mao_obra_valor || 0), 0);
    const receitaKm = filteredOS.reduce((s, o) => s + (o.auditado_km_valor || 0), 0);
    const receitaTotal = receitaMaoObra + receitaKm;
    const lucroOW = filteredOS
      .filter(o => o.tipo_os === 'OW')
      .reduce((s, o) => s + ((o.valor_total || 0) - o.custo_gspn_total), 0);
    return { total, auditadas, pendentes, receitaMaoObra, receitaKm, receitaTotal, lucroOW };
  }, [filteredOS]);

  const chartTopModelosRentaveis = useMemo(() => {
    const map: Record<string, number> = {};
    filteredOS.forEach(o => {
      const m = o.aparelho_modelo || 'Sem modelo';
      map[m] = (map[m] || 0) + (o.auditado_mao_obra_valor || 0) + (o.auditado_km_valor || 0);
    });
    return Object.entries(map)
      .filter(([, v]) => v > 0)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([modelo, receita]) => ({ modelo, receita: Math.round(receita * 100) / 100 }));
  }, [filteredOS]);

  const pagedOS = useMemo(() => filteredOS.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE), [filteredOS, page]);
  const totalPages = Math.ceil(filteredOS.length / PAGE_SIZE);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('desc'); }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const handleExportar = async () => {
    const XLSX = await import('xlsx');
    const rows = filteredOS.map(o => ({
      'OS Samsung': o.numero_os_samsung || '',
      'OS Interna': o.numero_os_interna,
      'Tipo': o.tipo_os,
      'Atendimento': o.tipo_atendimento,
      'Status Samsung': o.status_samsung_desc || '',
      'Motivo Samsung': o.status_samsung_reason || '',
      'Cidade': o.cliente_cidade || '',
      'Modelo': o.aparelho_modelo || '',
      'Mao de Obra R$': o.auditado_mao_obra_valor || 0,
      'Imposto R$': o.auditado_imposto_valor || 0,
      'KM R$': o.auditado_km_valor || 0,
      'Pecas Total': o.pecas_count,
      'Pecas Y': o.pecas_y,
      'Pecas X': o.pecas_x,
      'Pecas Pendentes': o.pecas_pending,
      'Auditada': o.auditado_status ? 'SIM' : 'NAO',
      'Observacao': o.auditado_observacao || '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Auditoria');
    XLSX.writeFile(wb, `atom_audit_${dataInicio}_${dataFim}.xlsx`);
  };

  const toggleTipoAtendimento = (tipo: string) => {
    setTipoAtendimentoFilter(prev =>
      prev.includes(tipo) ? prev.filter(t => t !== tipo) : [...prev, tipo]
    );
  };

  if (loading && osList.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center">
            <Shield className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400" style={{ textShadow: '0 0 30px rgba(0,212,255,0.2)' }}>
              ATOM AUDIT
            </h1>
            <p className="text-gray-500 text-sm">Auditoria de faturamento por OS</p>
          </div>
        </div>
        <div className="flex items-center justify-center py-20">
          <div className="futuristic-loader" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center shadow-[0_0_20px_rgba(0,212,255,0.1)]">
            <Shield className="w-6 h-6 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-400">
              ATOM AUDIT
            </h1>
            <p className="text-gray-500 text-sm">Cao de guarda do faturamento</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3">
        <div className="premium-card p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-cyan-500 rounded-l-xl" />
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">OS no Periodo</p>
          <p className="text-2xl font-bold text-white">{totals.total}</p>
          <p className="text-xs text-gray-600 mt-0.5">
            <span className="text-emerald-400">{totals.auditadas}</span> auditadas / <span className="text-amber-400">{totals.pendentes}</span> pendentes
          </p>
        </div>

        <div className="premium-card p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 rounded-l-xl" />
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Lucro OW</p>
          <p className={`text-2xl font-bold ${totals.lucroOW >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
            {formatCurrency(totals.lucroOW)}
          </p>
          <p className="text-xs text-gray-600 mt-0.5">Cliente - Custo GSPN</p>
        </div>

        <div className="premium-card p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 rounded-l-xl" />
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Receita Mao de Obra</p>
          <p className="text-2xl font-bold text-blue-400">{formatCurrency(totals.receitaMaoObra)}</p>
          <p className="text-xs text-gray-600 mt-0.5">Pago pela fabrica</p>
        </div>

        <div className="premium-card p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-teal-500 rounded-l-xl" />
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Receita KM</p>
          <p className="text-2xl font-bold text-teal-400">{formatCurrency(totals.receitaKm)}</p>
          <p className="text-xs text-gray-600 mt-0.5">Deslocamento IH</p>
        </div>

        <div className="premium-card p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-amber-500 rounded-l-xl" />
          <p className="text-[10px] text-gray-500 uppercase tracking-wider mb-1">Receita Total Auditada</p>
          <p className="text-2xl font-bold text-amber-400">{formatCurrency(totals.receitaTotal)}</p>
          <p className="text-xs text-gray-600 mt-0.5">Mao de obra + KM</p>
        </div>
      </div>

      {chartTopModelosRentaveis.length > 0 && (
        <div className="premium-card p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-cyan-400" />
            Top Modelos Rentaveis (Mao de Obra + KM)
          </h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartTopModelosRentaveis} layout="vertical" margin={{ left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#222" horizontal={false} />
                <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={v => `R$${v}`} />
                <YAxis type="category" dataKey="modelo" tick={{ fill: '#9ca3af', fontSize: 10 }} width={120} />
                <Tooltip
                  contentStyle={{ background: '#111128', border: '1px solid rgba(0,212,255,0.2)', borderRadius: '8px', color: '#fff' }}
                  formatter={(v: number) => [formatCurrency(v), 'Receita']}
                />
                <Bar dataKey="receita" name="Receita" fill="#06b6d4" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="premium-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-gray-400">
            <Filter className="w-3.5 h-3.5" />
            Filtros
          </div>

          {canSelectUnit && (
            <UnitFilter
              unidades={unidades}
              selectedUnidade={selectedUnidade}
              onUnidadeChange={setSelectedUnidade}
            />
          )}

          <div className="flex items-center gap-2">
            <input type="date" value={dataInicio} onChange={e => setDataInicio(e.target.value)} className="neon-input text-xs" />
            <span className="text-gray-600 text-xs">ate</span>
            <input type="date" value={dataFim} onChange={e => setDataFim(e.target.value)} className="neon-input text-xs" />
          </div>

          <div className="flex items-center gap-1 bg-[#111128] rounded-lg p-1 border border-white/5">
            {(['TODOS', 'LP', 'OW'] as const).map(t => (
              <button
                key={t}
                onClick={() => setTipoGarantia(t)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                  tipoGarantia === t
                    ? 'bg-cyan-500/20 border border-cyan-500/40 text-cyan-400'
                    : 'text-gray-500 hover:text-white'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <button
            onClick={() => { setShowOnlyPending(!showOnlyPending); setPage(0); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
              showOnlyPending
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                : 'bg-white/5 border-white/10 text-gray-500 hover:text-white'
            }`}
          >
            Pendentes ({totals.pendentes})
          </button>

          <button
            onClick={handleExportar}
            className="px-3 py-1.5 rounded-lg text-xs bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 transition-colors"
          >
            Exportar
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] text-gray-500 uppercase tracking-wider">Tipo Atendimento:</span>
          {TIPO_ATENDIMENTO_OPTIONS.map(tipo => (
            <button
              key={tipo}
              onClick={() => toggleTipoAtendimento(tipo)}
              className={`px-2 py-1 rounded text-[11px] font-medium transition-all border ${
                tipoAtendimentoFilter.includes(tipo)
                  ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                  : 'bg-white/[0.02] border-white/5 text-gray-600'
              }`}
            >
              {tipo}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-[280px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-600" />
            <input
              type="text"
              value={searchTerm}
              onChange={e => { setSearchTerm(e.target.value); setPage(0); }}
              placeholder="Buscar OS, cidade, modelo..."
              className="neon-input w-full pl-9 text-sm"
            />
          </div>
          <select value={filtroCidade} onChange={e => { setFiltroCidade(e.target.value); setPage(0); }} className="neon-input text-xs max-w-[180px]">
            <option value="">Todas Cidades</option>
            {cidadesDisponiveis.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filtroModelo} onChange={e => { setFiltroModelo(e.target.value); setPage(0); }} className="neon-input text-xs max-w-[180px]">
            <option value="">Todos Modelos</option>
            {modelosDisponiveis.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
          {samsungStatuses.length > 0 && (
            <select
              value={filtroStatus.length === 1 ? filtroStatus[0] : ''}
              onChange={e => { setFiltroStatus(e.target.value ? [e.target.value] : []); setPage(0); }}
              className="neon-input text-xs max-w-[200px]"
            >
              <option value="">Todos Status Samsung</option>
              {samsungStatuses.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          )}
        </div>
      </div>

      <div className="premium-card overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/5 bg-white/[0.01]">
          <p className="text-xs text-gray-400 font-medium">{filteredOS.length} OS encontradas</p>
          <p className="text-xs text-gray-600">Pag. {page + 1}/{totalPages || 1}</p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/5 bg-white/[0.015]">
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">OS</th>
                <th className="text-left px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Status Samsung</th>
                <th className="text-center px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Tipo</th>
                <th className="text-left px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => toggleSort('cidade')}>
                  <span className="flex items-center gap-1">Cidade <SortIcon field="cidade" /></span>
                </th>
                <th className="text-left px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => toggleSort('modelo')}>
                  <span className="flex items-center gap-1">Modelo <SortIcon field="modelo" /></span>
                </th>
                <th className="text-right px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => toggleSort('maoObra')}>
                  <span className="flex items-center justify-end gap-1">Mao Obra <SortIcon field="maoObra" /></span>
                </th>
                <th className="text-right px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Imposto</th>
                <th className="text-right px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-white" onClick={() => toggleSort('km')}>
                  <span className="flex items-center justify-end gap-1">KM <SortIcon field="km" /></span>
                </th>
                <th className="text-center px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Pecas</th>
                <th className="text-center px-3 py-3 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Acao</th>
              </tr>
            </thead>
            <tbody>
              {pagedOS.map((os, idx) => {
                const isAuditada = os.auditado_status;
                return (
                  <tr
                    key={os.id}
                    className={`border-b border-white/[0.03] transition-colors ${
                      isAuditada
                        ? 'bg-emerald-500/[0.02] hover:bg-emerald-500/[0.05]'
                        : idx % 2 === 0
                          ? 'bg-white/[0.01] hover:bg-white/[0.03]'
                          : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className={`font-bold ${os.numero_os_samsung ? 'text-lg text-white tracking-wide' : 'text-sm text-gray-300'}`}>
                          {os.numero_os_samsung || os.numero_os_interna}
                        </p>
                        {os.numero_os_samsung && (
                          <p className="text-[10px] text-gray-600">{os.numero_os_interna}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-3 max-w-[180px]">
                      <div className="flex items-center gap-1.5">
                        {os.status_samsung_desc ? (
                          <div className="min-w-0">
                            <p className={`text-xs font-medium truncate ${
                              os.status_samsung_desc === 'REPARO COMPLETO' ? 'text-emerald-400' :
                              os.status_samsung_desc === 'PENDENTE' ? 'text-amber-400' :
                              os.status_samsung_desc.includes('DESIGNADO') ? 'text-cyan-400' :
                              os.status_samsung_desc.includes('RECUSADO') ? 'text-red-400' :
                              'text-gray-300'
                            }`}>
                              {os.status_samsung_desc}
                            </p>
                            {os.status_samsung_reason && (
                              <p className="text-[10px] text-gray-600 truncate" title={os.status_samsung_reason}>{os.status_samsung_reason}</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-700">-</span>
                        )}
                        {isAuditada && <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />}
                      </div>
                      {os.auditado_observacao && (
                        <p className="text-[10px] text-amber-500/70 truncate mt-0.5" title={os.auditado_observacao}>{os.auditado_observacao}</p>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          os.tipo_os === 'LP' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'
                        }`}>
                          {os.tipo_os}
                        </span>
                        <span className="text-[10px] text-gray-600">{os.tipo_atendimento}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-sm text-gray-300 max-w-[120px] truncate">
                      {os.cliente_cidade || <span className="text-gray-600">-</span>}
                    </td>
                    <td className="px-3 py-3 text-xs text-gray-400 max-w-[120px] truncate">
                      {os.aparelho_modelo || <span className="text-gray-600">-</span>}
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className={`text-sm font-medium ${os.auditado_mao_obra_valor ? 'text-blue-400' : 'text-gray-700'}`}>
                        {os.auditado_mao_obra_valor ? formatCurrency(os.auditado_mao_obra_valor) : '-'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className={`text-xs ${os.auditado_imposto_valor ? 'text-gray-300' : 'text-gray-700'}`}>
                        {os.auditado_imposto_valor ? formatCurrency(os.auditado_imposto_valor) : '-'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className={`text-sm font-medium ${os.auditado_km_valor ? 'text-teal-400' : 'text-gray-700'}`}>
                        {os.auditado_km_valor ? formatCurrency(os.auditado_km_valor) : '-'}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {os.pecas_count > 0 ? (
                        <div className="flex items-center justify-center gap-1">
                          {os.pecas_y > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400">{os.pecas_y}Y</span>
                          )}
                          {os.pecas_x > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400">{os.pecas_x}X</span>
                          )}
                          {os.pecas_pending > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] bg-white/5 text-gray-500">{os.pecas_pending}</span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[10px] text-gray-700">-</span>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center">
                      <button
                        onClick={() => setAuditingOSId(os.id)}
                        className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold transition-all border ${
                          isAuditada
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20 shadow-[0_0_8px_rgba(16,185,129,0.08)]'
                            : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 shadow-[0_0_8px_rgba(0,212,255,0.08)]'
                        }`}
                      >
                        <ScanSearch className="w-3.5 h-3.5" />
                        AUDITAR
                      </button>
                    </td>
                  </tr>
                );
              })}
              {pagedOS.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-16 text-center text-gray-600">
                    Nenhuma OS encontrada com os filtros aplicados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/5">
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} className="px-3 py-1.5 rounded-lg text-xs bg-white/5 border border-white/10 text-gray-400 hover:text-white disabled:opacity-30">Anterior</button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 7) pageNum = i;
                else if (page < 4) pageNum = i;
                else if (page > totalPages - 5) pageNum = totalPages - 7 + i;
                else pageNum = page - 3 + i;
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-7 h-7 rounded-lg text-[11px] font-medium transition-colors ${
                      page === pageNum ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'bg-white/5 text-gray-500 hover:text-white'
                    }`}
                  >
                    {pageNum + 1}
                  </button>
                );
              })}
            </div>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="px-3 py-1.5 rounded-lg text-xs bg-white/5 border border-white/10 text-gray-400 hover:text-white disabled:opacity-30">Proxima</button>
          </div>
        )}
      </div>

      {auditingOSId && (
        <AuditarOSModal
          osId={auditingOSId}
          onClose={() => setAuditingOSId(null)}
          onSaved={() => {
            setAuditingOSId(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
