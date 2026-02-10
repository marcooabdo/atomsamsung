import { useState, useEffect, useMemo } from 'react';
import {
  Zap, Building2, ChevronDown, Calendar, RefreshCw,
  BarChart3, Users, TrendingUp, Package, Download, Printer
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { useCIData } from '../components/ci/useCIData';
import { PecaCI, CI_FILTERS, getValorCliente } from '../components/ci/types';
import { exportExcel, generateHTMLReport } from '../components/ci/ciExport';
import CIDashboardTab from '../components/ci/CIDashboardTab';
import CICarteiraTab from '../components/ci/CICarteiraTab';
import CIPerformanceTab from '../components/ci/CIPerformanceTab';
import CIProdutosTab from '../components/ci/CIProdutosTab';

type Tab = 'dashboard' | 'carteira' | 'vendedores' | 'produtos';

export default function CustomerIntelligence() {
  const { usuario } = useAuth();
  const isMaster = usuario?.tipo === 'master';
  const isDiretoria = usuario?.tipo === 'diretoria';
  const isGerente = isMaster || isDiretoria;

  const [unidades, setUnidades] = useState<{ id: string; nome: string }[]>([]);
  const [selectedUnidade, setSelectedUnidade] = useState('');
  const [tipoFiltro, setTipoFiltro] = useState('geral');
  const [periodoFiltro, setPeriodoFiltro] = useState('todos');
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedVendedorFilter, setSelectedVendedorFilter] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('unidades').select('id, nome').order('nome');
      setUnidades(data || []);
    };
    load();
  }, []);

  useEffect(() => {
    if (usuario?.unidade_id && !isGerente) setSelectedUnidade(usuario.unidade_id);
  }, [usuario, isGerente]);

  const {
    loading, refreshing, refresh,
    allClientes, allVendedores, allPecas,
    dadosMensais, kpis
  } = useCIData(usuario?.unidade_id || null, isGerente, selectedUnidade, periodoFiltro);

  const filteredClientes = useMemo(() => {
    let filtered = allClientes;
    if (tipoFiltro !== 'geral') {
      filtered = filtered.filter(c => c.tiposOS.includes(tipoFiltro));
    }
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c =>
        c.nome.toLowerCase().includes(term) ||
        c.documento.includes(term) ||
        c.telefone.includes(term)
      );
    }
    if (selectedVendedorFilter) {
      filtered = filtered.filter(c => c.vendedorId === selectedVendedorFilter);
    }
    return filtered;
  }, [allClientes, tipoFiltro, searchTerm, selectedVendedorFilter]);

  const filteredVendedores = useMemo(() => {
    if (tipoFiltro === 'geral') return allVendedores;
    const clienteVendedorIds = new Set(filteredClientes.filter(c => c.vendedorId).map(c => c.vendedorId));
    return allVendedores.filter(v => clienteVendedorIds.has(v.id));
  }, [allVendedores, tipoFiltro, filteredClientes]);

  const filteredPecas = useMemo(() => {
    if (tipoFiltro === 'geral') return allPecas;
    const osIds = new Set(filteredClientes.flatMap(c => c.osRecords.map(o => o.id)));
    const pecasMap = new Map<string, PecaCI>();
    filteredClientes.forEach(c => {
      c.osRecords.forEach(os => {
        if (!osIds.has(os.id)) return;
        os.pecas.forEach(p => {
          const key = p.pn || p.descricao;
          const ex = pecasMap.get(key);
          if (ex) { ex.quantidade += p.quantidade; ex.valorTotal += p.valor_total; }
          else pecasMap.set(key, { pn: p.pn, descricao: p.descricao, quantidade: p.quantidade, valorTotal: p.valor_total, valorMedio: p.valor_unitario });
        });
      });
    });
    return Array.from(pecasMap.values())
      .map(p => ({ ...p, valorMedio: p.quantidade > 0 ? p.valorTotal / p.quantidade : 0 }))
      .sort((a, b) => b.quantidade - a.quantidade);
  }, [allPecas, tipoFiltro, filteredClientes]);

  const filteredKpis = useMemo(() => {
    if (tipoFiltro === 'geral') return kpis;
    const totalFaturamento = filteredClientes.reduce((s, c) => s + getValorCliente(c), 0);
    const totalOS = filteredClientes.reduce((s, c) => s + c.totalOS, 0);
    const top = filteredClientes[0];
    const topV = filteredVendedores[0];
    return {
      totalFaturamento,
      ticketMedio: totalOS > 0 ? totalFaturamento / totalOS : 0,
      clienteDoMes: top?.nome || 'N/A',
      clienteDoMesValor: top ? getValorCliente(top) : 0,
      vendedorDestaque: topV?.nome || 'N/A',
      vendedorDestaqueValor: topV?.faturamento || 0,
      crescimento: kpis.crescimento,
      totalClientes: filteredClientes.length
    };
  }, [kpis, tipoFiltro, filteredClientes, filteredVendedores]);

  const carteiraLabel = isGerente ? 'Carteira de Vendas' : 'Minha Carteira';

  const handleExportExcel = () => exportExcel(filteredClientes, filteredVendedores, filteredPecas, filteredKpis);
  const handleReport = () => generateHTMLReport(
    filteredClientes, filteredVendedores, filteredPecas, filteredKpis,
    { tipo: tipoFiltro, periodo: periodoFiltro, unidade: selectedUnidade }
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-cyan-400 animate-pulse">Carregando Customer Intelligence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-4 lg:p-6">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgxNDEsIDI0MiwgMjQ1LCAwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50 pointer-events-none" />

      <div className="relative z-10 max-w-[1800px] mx-auto space-y-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
              <Zap className="w-7 h-7 text-cyan-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-teal-400 bg-clip-text text-transparent">
                Customer Intelligence
              </h1>
              <p className="text-slate-500 text-xs">Gestao 360 da carteira de clientes e performance de vendas</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {isGerente && (
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400" />
                <select
                  value={selectedUnidade}
                  onChange={(e) => setSelectedUnidade(e.target.value)}
                  className="pl-9 pr-8 py-2 rounded-xl bg-slate-800/50 border border-cyan-500/30 text-white text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 appearance-none cursor-pointer min-w-[180px]"
                >
                  <option value="">Todas Unidades</option>
                  {unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cyan-400 pointer-events-none" />
              </div>
            )}

            <div className="flex items-center gap-0.5 p-0.5 rounded-xl bg-slate-800/50 border border-cyan-500/30">
              {CI_FILTERS.map(tipo => (
                <button
                  key={tipo}
                  onClick={() => setTipoFiltro(tipo)}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    tipoFiltro === tipo
                      ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-lg shadow-cyan-500/25'
                      : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}
                >
                  {tipo === 'geral' ? 'Geral' : tipo}
                </button>
              ))}
            </div>

            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cyan-400" />
              <select
                value={periodoFiltro}
                onChange={(e) => setPeriodoFiltro(e.target.value)}
                className="pl-9 pr-8 py-2 rounded-xl bg-slate-800/50 border border-cyan-500/30 text-white text-sm focus:border-cyan-400 appearance-none cursor-pointer"
              >
                <option value="mes">Ultimo Mes</option>
                <option value="trimestre">Ultimo Trimestre</option>
                <option value="semestre">Ultimo Semestre</option>
                <option value="ano">Ultimo Ano</option>
                <option value="todos">Todo Periodo</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-cyan-400 pointer-events-none" />
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={handleReport}
                title="Abrir relatorio"
                className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-cyan-400 hover:border-cyan-500/30 hover:bg-cyan-500/10 transition-all"
              >
                <Printer className="w-4 h-4" />
              </button>
              <button
                onClick={handleExportExcel}
                title="Exportar Excel"
                className="p-2 rounded-xl bg-slate-800/50 border border-slate-700/50 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/30 hover:bg-emerald-500/10 transition-all"
              >
                <Download className="w-4 h-4" />
              </button>
              <button
                onClick={refresh}
                disabled={refreshing}
                className="p-2 rounded-xl bg-slate-800/50 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition-all disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-800/30 border border-slate-700/40 w-fit">
          {([
            { id: 'dashboard' as Tab, label: 'Dashboard', icon: BarChart3 },
            { id: 'carteira' as Tab, label: carteiraLabel, icon: Users },
            { id: 'vendedores' as Tab, label: 'Performance', icon: TrendingUp },
            { id: 'produtos' as Tab, label: 'Produtos', icon: Package }
          ]).map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30 shadow-lg shadow-cyan-500/10'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {activeTab === 'dashboard' && (
          <CIDashboardTab
            kpis={filteredKpis}
            clientes={filteredClientes}
            vendedores={filteredVendedores}
            dadosMensais={dadosMensais}
          />
        )}

        {activeTab === 'carteira' && (
          <CICarteiraTab
            clientes={filteredClientes}
            vendedores={filteredVendedores}
            isGerente={isGerente}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            selectedVendedorFilter={selectedVendedorFilter}
            onVendedorFilterChange={setSelectedVendedorFilter}
          />
        )}

        {activeTab === 'vendedores' && (
          <CIPerformanceTab vendedores={filteredVendedores} />
        )}

        {activeTab === 'produtos' && (
          <CIProdutosTab pecas={filteredPecas} />
        )}
      </div>

      <style>{`
        .ci-scrollbar::-webkit-scrollbar { width: 5px; }
        .ci-scrollbar::-webkit-scrollbar-track { background: rgba(30, 41, 59, 0.3); border-radius: 3px; }
        .ci-scrollbar::-webkit-scrollbar-thumb { background: rgba(6, 182, 212, 0.25); border-radius: 3px; }
        .ci-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(6, 182, 212, 0.45); }
      `}</style>
    </div>
  );
}
