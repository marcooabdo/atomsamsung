import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { calcularECachearDistancia, TARIFA_POR_KM } from '../../lib/deslocamentoService';
import EditOSDeslocamentoModal from './EditOSDeslocamentoModal';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from 'recharts';
import { Truck, MapPin, DollarSign, AlertTriangle, Search, Download, CreditCard as Edit3, RotateCcw, TrendingUp, ChevronDown, ChevronUp, Filter, Clock, Loader2 } from 'lucide-react';

interface ReceitaDeslocamentoModuleProps {
  unidadeId: string | null;
  dataInicio: string;
  dataFim: string;
}

interface OSItem {
  id: string;
  numero_os_interna: string;
  numero_os_samsung: string | null;
  tipo_os: string;
  tipo_atendimento: string;
  cliente_cidade: string | null;
  cliente_estado: string | null;
  aparelho_modelo: string | null;
  created_at: string;
  unidade_id: string;
}

interface CacheItem {
  os_id: string;
  distancia_km: number;
  distancia_km_ida_volta: number;
  receita_calculada: number;
  km_manual: number | null;
  receita_manual: number | null;
  erro_calculo: boolean;
  erro_mensagem: string | null;
  origem_cidade: string | null;
  origem_estado: string | null;
  destino_cidade: string | null;
  destino_estado: string | null;
}

interface OSComDeslocamento extends OSItem {
  cache: CacheItem | null;
  kmEfetivo: number;
  receitaEfetiva: number;
  diasAberto: number;
  erroCalculo: boolean;
}

interface UnidadeInfo {
  id: string;
  nome: string;
  cidade: string | null;
  estado: string | null;
}

const PAGE_SIZE = 50;

export default function ReceitaDeslocamentoModule({ unidadeId, dataInicio, dataFim }: ReceitaDeslocamentoModuleProps) {
  const [osList, setOsList] = useState<OSComDeslocamento[]>([]);
  const [unidadesMap, setUnidadesMap] = useState<Record<string, UnidadeInfo>>({});
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [calcProgress, setCalcProgress] = useState({ current: 0, total: 0 });

  const [tipoOS, setTipoOS] = useState<'LP' | 'OW'>('LP');
  const [searchTerm, setSearchTerm] = useState('');
  const [filtroCidade, setFiltroCidade] = useState('');
  const [filtroModelo, setFiltroModelo] = useState('');
  const [showOnlyErrors, setShowOnlyErrors] = useState(false);
  const [sortField, setSortField] = useState<'receita' | 'km' | 'cidade' | 'dias'>('receita');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const [editingOS, setEditingOS] = useState<OSComDeslocamento | null>(null);
  const [page, setPage] = useState(0);

  useEffect(() => {
    loadData();
  }, [unidadeId, dataInicio, dataFim, tipoOS]);

  const loadData = async () => {
    setLoading(true);
    setPage(0);
    try {
      const { data: unidadesData } = await supabase
        .from('unidades')
        .select('id, nome, cidade, estado');

      const uMap: Record<string, UnidadeInfo> = {};
      (unidadesData || []).forEach(u => {
        uMap[u.id] = u as UnidadeInfo;
      });
      setUnidadesMap(uMap);

      let query = supabase
        .from('os')
        .select('id, numero_os_interna, numero_os_samsung, tipo_os, tipo_atendimento, cliente_cidade, cliente_estado, aparelho_modelo, created_at, unidade_id')
        .eq('tipo_atendimento', 'IH')
        .eq('tipo_os', tipoOS)
        .gte('created_at', `${dataInicio}T00:00:00`)
        .lte('created_at', `${dataFim}T23:59:59`)
        .order('created_at', { ascending: false });

      if (unidadeId) {
        query = query.eq('unidade_id', unidadeId);
      }

      const allOS: OSItem[] = [];
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data, error } = await query.range(from, from + batchSize - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        allOS.push(...(data as OSItem[]));
        if (data.length < batchSize) break;
        from += batchSize;
      }

      const osIds = allOS.map(o => o.id);
      const cacheMap: Record<string, CacheItem> = {};

      if (osIds.length > 0) {
        for (let i = 0; i < osIds.length; i += 500) {
          const batch = osIds.slice(i, i + 500);
          const { data: cacheData } = await supabase
            .from('deslocamento_km_cache')
            .select('os_id, distancia_km, distancia_km_ida_volta, receita_calculada, km_manual, receita_manual, erro_calculo, erro_mensagem, origem_cidade, origem_estado, destino_cidade, destino_estado')
            .in('os_id', batch);
          (cacheData || []).forEach(c => {
            cacheMap[c.os_id] = c as CacheItem;
          });
        }
      }

      const now = new Date();
      const combined: OSComDeslocamento[] = allOS.map(os => {
        const cache = cacheMap[os.id] || null;
        const kmEfetivo = cache?.km_manual ?? cache?.distancia_km_ida_volta ?? 0;
        const receitaEfetiva = cache?.receita_manual ?? (cache?.km_manual ? Math.round(cache.km_manual * TARIFA_POR_KM * 100) / 100 : cache?.receita_calculada ?? 0);
        const diasAberto = Math.max(0, Math.floor((now.getTime() - new Date(os.created_at).getTime()) / 86400000));
        const erroCalculo = cache?.erro_calculo ?? false;

        return { ...os, cache, kmEfetivo, receitaEfetiva, diasAberto, erroCalculo };
      });

      setOsList(combined);
    } catch (err) {
      console.error('Erro ao carregar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCalcularTodos = async () => {
    const semCache = osList.filter(o => !o.cache && o.cliente_cidade);
    if (semCache.length === 0) return;

    setCalculating(true);
    setCalcProgress({ current: 0, total: semCache.length });

    for (let i = 0; i < semCache.length; i++) {
      const os = semCache[i];
      const unidade = unidadesMap[os.unidade_id];
      if (!unidade?.cidade || !unidade?.estado || !os.cliente_cidade || !os.cliente_estado) continue;

      await calcularECachearDistancia(
        os.id,
        os.unidade_id,
        unidade.cidade,
        unidade.estado,
        os.cliente_cidade,
        os.cliente_estado
      );
      setCalcProgress({ current: i + 1, total: semCache.length });
    }

    setCalculating(false);
    await loadData();
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
    if (filtroCidade) {
      list = list.filter(o => o.cliente_cidade === filtroCidade);
    }
    if (filtroModelo) {
      list = list.filter(o => o.aparelho_modelo === filtroModelo);
    }
    if (showOnlyErrors) {
      list = list.filter(o => o.erroCalculo || !o.cache);
    }

    list.sort((a, b) => {
      const dir = sortDir === 'asc' ? 1 : -1;
      switch (sortField) {
        case 'receita': return (a.receitaEfetiva - b.receitaEfetiva) * dir;
        case 'km': return (a.kmEfetivo - b.kmEfetivo) * dir;
        case 'cidade': return (a.cliente_cidade || '').localeCompare(b.cliente_cidade || '') * dir;
        case 'dias': return (a.diasAberto - b.diasAberto) * dir;
        default: return 0;
      }
    });

    return list;
  }, [osList, searchTerm, filtroCidade, filtroModelo, showOnlyErrors, sortField, sortDir]);

  const totals = useMemo(() => {
    const total = filteredOS.length;
    const receitaTotal = filteredOS.reduce((sum, o) => sum + o.receitaEfetiva, 0);
    const kmTotal = filteredOS.reduce((sum, o) => sum + o.kmEfetivo, 0);
    const comErro = filteredOS.filter(o => o.erroCalculo || !o.cache).length;
    const semCidade = filteredOS.filter(o => !o.cliente_cidade).length;
    return { total, receitaTotal, kmTotal, comErro, semCidade };
  }, [filteredOS]);

  const chartEvolucaoDiaria = useMemo(() => {
    const map: Record<string, number> = {};
    filteredOS.forEach(o => {
      const day = new Date(o.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
      map[day] = (map[day] || 0) + 1;
    });
    return Object.entries(map)
      .map(([dia, count]) => ({ dia, count }))
      .sort((a, b) => {
        const [dA, mA] = a.dia.split('/').map(Number);
        const [dB, mB] = b.dia.split('/').map(Number);
        return mA !== mB ? mA - mB : dA - dB;
      });
  }, [filteredOS]);

  const chartTopCidadesVolume = useMemo(() => {
    const map: Record<string, number> = {};
    filteredOS.forEach(o => {
      const city = o.cliente_cidade || 'Sem cidade';
      map[city] = (map[city] || 0) + 1;
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([cidade, count]) => ({ cidade, count }));
  }, [filteredOS]);

  const chartTopCidadesReceita = useMemo(() => {
    const map: Record<string, number> = {};
    filteredOS.forEach(o => {
      const city = o.cliente_cidade || 'Sem cidade';
      map[city] = (map[city] || 0) + o.receitaEfetiva;
    });
    return Object.entries(map)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([cidade, receita]) => ({ cidade, receita: Math.round(receita * 100) / 100 }));
  }, [filteredOS]);

  const pagedOS = useMemo(() => {
    return filteredOS.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  }, [filteredOS, page]);

  const totalPages = Math.ceil(filteredOS.length / PAGE_SIZE);

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: typeof sortField }) => {
    if (sortField !== field) return null;
    return sortDir === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />;
  };

  const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const handleExportar = async () => {
    const XLSX = await import('xlsx');
    const rows = filteredOS.map(o => ({
      'OS': o.numero_os_interna,
      'OS Samsung': o.numero_os_samsung || '',
      'Tipo': o.tipo_os,
      'Cidade Cliente': o.cliente_cidade || '',
      'Estado': o.cliente_estado || '',
      'Modelo': o.aparelho_modelo || '',
      'Dias em Aberto': o.diasAberto,
      'KM Ida e Volta': o.kmEfetivo,
      'Receita R$': o.receitaEfetiva,
      'KM Manual': o.cache?.km_manual || '',
      'Receita Manual': o.cache?.receita_manual || '',
      'Erro': o.erroCalculo ? 'SIM' : '',
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Deslocamento KM');
    XLSX.writeFile(wb, `deslocamento_km_${tipoOS}_${dataInicio}_${dataFim}.xlsx`);
  };

  const getOrigemForOS = (os: OSComDeslocamento) => {
    const unidade = unidadesMap[os.unidade_id];
    return {
      cidade: unidade?.cidade || '',
      estado: unidade?.estado || '',
    };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="futuristic-loader" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 bg-gray-800/50 rounded-lg p-1 border border-gray-700">
          {(['LP', 'OW'] as const).map(t => (
            <button
              key={t}
              onClick={() => setTipoOS(t)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${
                tipoOS === t
                  ? 'bg-[#00D4FF]/20 border border-[#00D4FF]/50 text-[#00D4FF]'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => { setSearchTerm(e.target.value); setPage(0); }}
            placeholder="Buscar OS, cidade, modelo..."
            className="neon-input w-full pl-9"
          />
        </div>

        <select
          value={filtroCidade}
          onChange={(e) => { setFiltroCidade(e.target.value); setPage(0); }}
          className="neon-input text-sm max-w-[200px]"
        >
          <option value="">Todas as Cidades</option>
          {cidadesDisponiveis.map(c => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        <select
          value={filtroModelo}
          onChange={(e) => { setFiltroModelo(e.target.value); setPage(0); }}
          className="neon-input text-sm max-w-[200px]"
        >
          <option value="">Todos os Modelos</option>
          {modelosDisponiveis.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>

        <button
          onClick={() => { setShowOnlyErrors(!showOnlyErrors); setPage(0); }}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all border ${
            showOnlyErrors
              ? 'bg-red-500/20 border-red-500/50 text-red-400'
              : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5" />
          Erros ({totals.comErro})
        </button>

        <button
          onClick={handleExportar}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm bg-white/5 border border-white/10 text-gray-300 hover:bg-white/10 transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Excel
        </button>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <div className="premium-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#00D4FF] rounded-l-xl" />
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-[#00D4FF]/10 flex items-center justify-center">
              <Truck className="w-5 h-5 text-[#00D4FF]" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">{totals.total}</p>
          <p className="text-sm text-gray-400 mt-1">OS IH ({tipoOS})</p>
        </div>

        <div className="premium-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-emerald-500 rounded-l-xl" />
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-400">{formatCurrency(totals.receitaTotal)}</p>
          <p className="text-sm text-gray-400 mt-1">Receita Deslocamento</p>
          <p className="text-xs text-gray-500 mt-0.5">R$ {TARIFA_POR_KM}/km</p>
        </div>

        <div className="premium-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 rounded-l-xl" />
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <MapPin className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-blue-400">{totals.kmTotal.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} km</p>
          <p className="text-sm text-gray-400 mt-1">KM Total (Ida e Volta)</p>
        </div>

        <div className="premium-card p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl" style={{ backgroundColor: totals.comErro > 0 ? '#ef4444' : '#10b981' }} />
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: totals.comErro > 0 ? '#ef444420' : '#10b98120' }}>
              <AlertTriangle className="w-5 h-5" style={{ color: totals.comErro > 0 ? '#ef4444' : '#10b981' }} />
            </div>
          </div>
          <p className="text-2xl font-bold" style={{ color: totals.comErro > 0 ? '#ef4444' : '#10b981' }}>
            {totals.comErro}
          </p>
          <p className="text-sm text-gray-400 mt-1">{totals.comErro > 0 ? 'OS com Erros/Pendentes' : 'Todas calculadas'}</p>
        </div>
      </div>

      {totals.comErro > 0 && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-amber-500/10 border border-amber-500/30">
          <div className="flex items-center gap-3">
            <RotateCcw className={`w-5 h-5 text-amber-400 ${calculating ? 'animate-spin' : ''}`} />
            <div>
              <p className="text-sm font-medium text-amber-300">
                {totals.comErro} OS sem calculo de distancia
              </p>
              {calculating && (
                <p className="text-xs text-amber-400/70">
                  Calculando {calcProgress.current}/{calcProgress.total}...
                </p>
              )}
            </div>
          </div>
          <button
            onClick={handleCalcularTodos}
            disabled={calculating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-colors text-sm font-medium disabled:opacity-50"
          >
            {calculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
            {calculating ? 'Calculando...' : 'Calcular Todos'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="premium-card p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-[#00D4FF]" />
            Evolucao Diaria de OS
          </h3>
          <div className="h-[200px]">
            {chartEvolucaoDiaria.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartEvolucaoDiaria}>
                  <defs>
                    <linearGradient id="colorOsCount" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00D4FF" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#00D4FF" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="dia" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                    labelStyle={{ color: '#9ca3af' }}
                  />
                  <Area type="monotone" dataKey="count" name="OS" stroke="#00D4FF" strokeWidth={2} fill="url(#colorOsCount)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">Sem dados</div>
            )}
          </div>
        </div>

        <div className="premium-card p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-blue-400" />
            Top Cidades (Volume)
          </h3>
          <div className="h-[200px]">
            {chartTopCidadesVolume.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartTopCidadesVolume} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="cidade" tick={{ fill: '#9ca3af', fontSize: 10 }} width={100} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                  />
                  <Bar dataKey="count" name="OS" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">Sem dados</div>
            )}
          </div>
        </div>

        <div className="premium-card p-5">
          <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-emerald-400" />
            Top Cidades (Receita)
          </h3>
          <div className="h-[200px]">
            {chartTopCidadesReceita.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartTopCidadesReceita} layout="vertical" margin={{ left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} tickFormatter={(v) => `R$${v}`} />
                  <YAxis type="category" dataKey="cidade" tick={{ fill: '#9ca3af', fontSize: 10 }} width={100} />
                  <Tooltip
                    contentStyle={{ background: '#1a1a2e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', color: '#fff' }}
                    formatter={(v: number) => [formatCurrency(v), 'Receita']}
                  />
                  <Bar dataKey="receita" name="Receita" fill="#10b981" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">Sem dados</div>
            )}
          </div>
        </div>
      </div>

      <div className="premium-card overflow-hidden">
        <div className="flex items-center justify-between p-4 border-b border-white/10">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            Tabela de Auditoria ({filteredOS.length} OS)
          </h3>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Pagina {page + 1} de {totalPages || 1}</span>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02]">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">OS</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Tipo</th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Modelo</th>
                <th
                  className="text-left px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                  onClick={() => toggleSort('cidade')}
                >
                  <div className="flex items-center gap-1">Cidade <SortIcon field="cidade" /></div>
                </th>
                <th
                  className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                  onClick={() => toggleSort('dias')}
                >
                  <div className="flex items-center justify-end gap-1">Prazo <SortIcon field="dias" /></div>
                </th>
                <th
                  className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                  onClick={() => toggleSort('km')}
                >
                  <div className="flex items-center justify-end gap-1">KM (I/V) <SortIcon field="km" /></div>
                </th>
                <th
                  className="text-right px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider cursor-pointer hover:text-white transition-colors"
                  onClick={() => toggleSort('receita')}
                >
                  <div className="flex items-center justify-end gap-1">Receita <SortIcon field="receita" /></div>
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-gray-400 uppercase tracking-wider">Acoes</th>
              </tr>
            </thead>
            <tbody>
              {pagedOS.map((os, idx) => {
                const hasError = os.erroCalculo || !os.cache;
                const isManual = !!os.cache?.km_manual || !!os.cache?.receita_manual;
                return (
                  <tr
                    key={os.id}
                    className={`border-b border-white/5 transition-colors ${
                      hasError
                        ? 'bg-red-500/[0.06] hover:bg-red-500/[0.1]'
                        : idx % 2 === 0
                          ? 'bg-white/[0.01] hover:bg-white/[0.04]'
                          : 'hover:bg-white/[0.04]'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <div>
                        <p className="text-sm font-medium text-white">{os.numero_os_interna}</p>
                        {os.numero_os_samsung && (
                          <p className="text-[11px] text-gray-500">{os.numero_os_samsung}</p>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-xs font-semibold ${
                        os.tipo_os === 'LP' ? 'bg-blue-500/20 text-blue-400' : 'bg-amber-500/20 text-amber-400'
                      }`}>
                        {os.tipo_os}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-300 max-w-[150px] truncate">
                      {os.aparelho_modelo || <span className="text-gray-600">-</span>}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {hasError && <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />}
                        <span className={`text-sm ${hasError ? 'text-red-400' : 'text-gray-300'}`}>
                          {os.cliente_cidade || <span className="text-red-400 italic">Sem cidade</span>}
                        </span>
                        {os.cliente_estado && (
                          <span className="text-xs text-gray-600">/{os.cliente_estado}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span className={`text-sm ${os.diasAberto > 15 ? 'text-amber-400' : 'text-gray-400'}`}>
                        {os.diasAberto}d
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-right">
                        <span className={`text-sm font-medium ${isManual ? 'text-amber-300' : 'text-cyan-400'}`}>
                          {os.kmEfetivo > 0 ? `${os.kmEfetivo.toFixed(1)}` : '-'}
                        </span>
                        {isManual && (
                          <span className="text-[10px] text-amber-500/70 ml-1">(M)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="text-right">
                        <span className={`text-sm font-semibold ${isManual ? 'text-amber-300' : 'text-emerald-400'}`}>
                          {os.receitaEfetiva > 0 ? formatCurrency(os.receitaEfetiva) : '-'}
                        </span>
                        {isManual && (
                          <span className="text-[10px] text-amber-500/70 ml-1">(M)</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setEditingOS(os)}
                        className="p-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:bg-[#00D4FF]/10 hover:text-[#00D4FF] hover:border-[#00D4FF]/30 transition-all"
                        title="Editar"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
              {pagedOS.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-gray-500">
                    Nenhuma OS encontrada com os filtros aplicados
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-white/10">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 rounded-lg text-sm bg-white/5 border border-white/10 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              Anterior
            </button>
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum: number;
                if (totalPages <= 5) {
                  pageNum = i;
                } else if (page < 3) {
                  pageNum = i;
                } else if (page > totalPages - 4) {
                  pageNum = totalPages - 5 + i;
                } else {
                  pageNum = page - 2 + i;
                }
                return (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${
                      page === pageNum
                        ? 'bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/50'
                        : 'bg-white/5 text-gray-400 hover:text-white'
                    }`}
                  >
                    {pageNum + 1}
                  </button>
                );
              })}
            </div>
            <button
              onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 rounded-lg text-sm bg-white/5 border border-white/10 text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
            >
              Proxima
            </button>
          </div>
        )}
      </div>

      {editingOS && (
        <EditOSDeslocamentoModal
          os={editingOS}
          origemCidade={getOrigemForOS(editingOS).cidade}
          origemEstado={getOrigemForOS(editingOS).estado}
          onClose={() => setEditingOS(null)}
          onSaved={() => {
            setEditingOS(null);
            loadData();
          }}
        />
      )}
    </div>
  );
}
