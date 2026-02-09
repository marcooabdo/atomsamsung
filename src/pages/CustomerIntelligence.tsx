import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users, TrendingUp, DollarSign, Package, Award, Target,
  Calendar, Building2, ChevronDown, Search, Download,
  MapPin, Phone, Mail, Clock, CheckCircle, XCircle,
  BarChart3, PieChart, Activity, Zap, Star, ShoppingCart,
  ArrowUpRight, ArrowDownRight, RefreshCw, Filter
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, Area, AreaChart, Line, Legend
} from 'recharts';
import * as XLSX from 'xlsx';

const APPROVED_STAGES = [
  'orcamento_aprovado', 'aguardando_peca', 'peca_em_transito', 'peca_disponivel',
  'em_reparo_ci', 'disponivel_ih', 'em_rota_ih', 'saw', 'controle_qualidade',
  'reparo_concluido', 'aguardando_fechamento', 'fechar_os', 'os_fechada'
];

interface ClienteCI {
  id: string;
  nome: string;
  documento: string;
  telefone: string;
  email: string;
  endereco: string;
  cidade: string;
  estado: string;
  totalFaturado: number;
  totalPago: number;
  totalOS: number;
  ticketMedio: number;
  ultimaOS: string;
  vendedorId: string | null;
  vendedorNome: string;
  status: 'ativo' | 'pendente';
  pecas: { descricao: string; pn: string; quantidade: number; valorMedio: number }[];
}

interface VendedorCI {
  id: string;
  nome: string;
  faturamento: number;
  totalOS: number;
  totalClientes: number;
  ticketMedio: number;
}

interface PecaCI {
  pn: string;
  descricao: string;
  quantidade: number;
  valorTotal: number;
  valorMedio: number;
}

const COLORS = ['#06B6D4', '#3B82F6', '#F59E0B', '#10B981', '#EC4899', '#8B5CF6'];
const GLASS_CARD = 'backdrop-blur-xl bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/80 border border-cyan-500/20 rounded-2xl shadow-2xl shadow-cyan-500/5';
const GLASS_CARD_INNER = 'backdrop-blur-md bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-700/50 rounded-xl';

export default function CustomerIntelligence() {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [unidades, setUnidades] = useState<{ id: string; nome: string }[]>([]);
  const [selectedUnidade, setSelectedUnidade] = useState<string>('');
  const [tipoFiltro, setTipoFiltro] = useState<'geral' | 'SCC' | 'ACC' | 'OW'>('geral');
  const [periodoFiltro, setPeriodoFiltro] = useState<'mes' | 'trimestre' | 'semestre' | 'ano' | 'todos'>('todos');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'carteira' | 'vendedores' | 'produtos'>('dashboard');

  const [clientes, setClientes] = useState<ClienteCI[]>([]);
  const [vendedores, setVendedores] = useState<VendedorCI[]>([]);
  const [pecasPopulares, setPecasPopulares] = useState<PecaCI[]>([]);
  const [dadosMensais, setDadosMensais] = useState<{ mes: string; faturamento: number; qtd: number }[]>([]);

  const [selectedCliente, setSelectedCliente] = useState<ClienteCI | null>(null);
  const [selectedVendedorFilter, setSelectedVendedorFilter] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [kpis, setKpis] = useState({
    totalFaturamento: 0,
    ticketMedio: 0,
    clienteDoMes: '',
    clienteDoMesValor: 0,
    vendedorDestaque: '',
    vendedorDestaqueValor: 0,
    crescimento: 0,
    totalClientes: 0
  });

  const isMaster = usuario?.tipo === 'master';
  const isDiretoria = usuario?.tipo === 'diretoria';
  const isGerente = isMaster || isDiretoria;

  useEffect(() => {
    const loadUnidades = async () => {
      const { data } = await supabase.from('unidades').select('id, nome').order('nome');
      setUnidades(data || []);
    };
    loadUnidades();
  }, []);

  useEffect(() => {
    if (usuario?.unidade_id && !isGerente) {
      setSelectedUnidade(usuario.unidade_id);
    }
  }, [usuario, isGerente]);

  const getDateRange = useCallback(() => {
    const now = new Date();
    let start: Date | null = null;

    switch (periodoFiltro) {
      case 'mes':
        start = new Date(now);
        start.setMonth(now.getMonth() - 1);
        break;
      case 'trimestre':
        start = new Date(now);
        start.setMonth(now.getMonth() - 3);
        break;
      case 'semestre':
        start = new Date(now);
        start.setMonth(now.getMonth() - 6);
        break;
      case 'ano':
        start = new Date(now);
        start.setFullYear(now.getFullYear() - 1);
        break;
      case 'todos':
        start = null;
        break;
    }

    return start;
  }, [periodoFiltro]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const dateStart = getDateRange();

      let osQuery = supabase
        .from('os')
        .select(`
          id, numero_os_interna, cliente_nome, cliente_cpf_cnpj, cliente_telefone, cliente_email,
          cliente_logradouro, cliente_numero, cliente_bairro, cliente_cidade, cliente_estado,
          tipo_os, valor_total, valor_pecas, valor_servicos,
          created_at, fechada_em, coluna_kanban, criado_por, unidade_id,
          vendedor_responsavel_id, orcamento_aprovado_em, orcamento_aprovado
        `)
        .in('coluna_kanban', APPROVED_STAGES);

      if (dateStart) {
        osQuery = osQuery.gte('created_at', dateStart.toISOString());
      }

      if (selectedUnidade) {
        osQuery = osQuery.eq('unidade_id', selectedUnidade);
      }

      if (tipoFiltro !== 'geral') {
        osQuery = osQuery.eq('tipo_os', tipoFiltro);
      }

      const { data: osData, error: osError } = await osQuery;
      if (osError) throw osError;

      const osIds = (osData || []).map(o => o.id);

      let pagamentosData: any[] = [];
      if (osIds.length > 0) {
        const batchSize = 50;
        for (let i = 0; i < osIds.length; i += batchSize) {
          const batch = osIds.slice(i, i + batchSize);
          const { data } = await supabase
            .from('pagamentos')
            .select('os_id, valor, valor_bruto, valor_liquido, forma_pagamento')
            .in('os_id', batch);
          if (data) pagamentosData = pagamentosData.concat(data);
        }
      }

      let pecasData: any[] = [];
      if (osIds.length > 0) {
        const batchSize = 50;
        for (let i = 0; i < osIds.length; i += batchSize) {
          const batch = osIds.slice(i, i + batchSize);
          const { data } = await supabase
            .from('os_pecas')
            .select('os_id, pn, codigo, descricao, quantidade, valor_unitario, valor_total, devolvida_em')
            .in('os_id', batch)
            .is('devolvida_em', null);
          if (data) pecasData = pecasData.concat(data);
        }
      }

      const { data: usuariosData } = await supabase
        .from('usuarios')
        .select('id, nome, tipo, unidade_id')
        .eq('ativo', true);

      const usuariosMap = new Map((usuariosData || []).map(u => [u.id, u]));

      const pagamentosPorOS = new Map<string, number>();
      pagamentosData.forEach(p => {
        const val = Number(p.valor_liquido) || Number(p.valor) || 0;
        pagamentosPorOS.set(p.os_id, (pagamentosPorOS.get(p.os_id) || 0) + val);
      });

      const pecasPorOS = new Map<string, any[]>();
      pecasData.forEach(p => {
        if (!pecasPorOS.has(p.os_id)) pecasPorOS.set(p.os_id, []);
        pecasPorOS.get(p.os_id)!.push(p);
      });

      const clientesMap = new Map<string, ClienteCI>();
      const vendedoresMap = new Map<string, VendedorCI>();
      const pecasGlobalMap = new Map<string, PecaCI>();
      const clientePecasMap = new Map<string, Map<string, { descricao: string; pn: string; quantidade: number; valorTotal: number }>>();
      const vendedorClientesSet = new Map<string, Set<string>>();

      (osData || []).forEach(os => {
        const clienteKey = os.cliente_cpf_cnpj || os.cliente_nome || 'desconhecido';
        const vendedorId = os.vendedor_responsavel_id || null;
        const vendedorUser = vendedorId ? usuariosMap.get(vendedorId) : null;
        const vendedorNome = vendedorUser?.nome || (vendedorId ? 'Vendedor' : 'Sem vendedor');

        const valorOS = Number(os.valor_total) || 0;
        const valorPago = pagamentosPorOS.get(os.id) || 0;
        const valorFinal = valorPago > 0 ? valorPago : valorOS;

        const existing = clientesMap.get(clienteKey);
        if (existing) {
          existing.totalFaturado += valorOS;
          existing.totalPago += valorPago;
          existing.totalOS += 1;
          const dataRef = os.orcamento_aprovado_em || os.fechada_em || os.created_at;
          if (dataRef && dataRef > existing.ultimaOS) {
            existing.ultimaOS = dataRef;
          }
          if (!existing.vendedorId && vendedorId) {
            existing.vendedorId = vendedorId;
            existing.vendedorNome = vendedorNome;
          }
          if (os.coluna_kanban === 'os_fechada') {
            existing.status = 'ativo';
          }
        } else {
          clientesMap.set(clienteKey, {
            id: clienteKey,
            nome: os.cliente_nome || 'Cliente',
            documento: os.cliente_cpf_cnpj || '',
            telefone: os.cliente_telefone || '',
            email: os.cliente_email || '',
            endereco: [os.cliente_logradouro, os.cliente_numero, os.cliente_bairro].filter(Boolean).join(', '),
            cidade: os.cliente_cidade || '',
            estado: os.cliente_estado || '',
            totalFaturado: valorOS,
            totalPago: valorPago,
            totalOS: 1,
            ticketMedio: 0,
            ultimaOS: os.orcamento_aprovado_em || os.fechada_em || os.created_at,
            vendedorId: vendedorId,
            vendedorNome: vendedorNome,
            status: os.coluna_kanban === 'os_fechada' ? 'ativo' : 'pendente',
            pecas: []
          });
        }

        if (vendedorId) {
          const existingV = vendedoresMap.get(vendedorId);
          if (existingV) {
            existingV.faturamento += valorFinal;
            existingV.totalOS += 1;
          } else {
            vendedoresMap.set(vendedorId, {
              id: vendedorId,
              nome: vendedorNome,
              faturamento: valorFinal,
              totalOS: 1,
              totalClientes: 0,
              ticketMedio: 0
            });
          }

          if (!vendedorClientesSet.has(vendedorId)) {
            vendedorClientesSet.set(vendedorId, new Set());
          }
          vendedorClientesSet.get(vendedorId)!.add(clienteKey);
        }

        const osPecas = pecasPorOS.get(os.id) || [];
        if (!clientePecasMap.has(clienteKey)) {
          clientePecasMap.set(clienteKey, new Map());
        }
        const cpMap = clientePecasMap.get(clienteKey)!;

        osPecas.forEach((peca: any) => {
          const pecaKey = peca.pn || peca.descricao || peca.codigo;
          if (!pecaKey) return;
          const qtd = Number(peca.quantidade) || 1;
          const vUnit = Number(peca.valor_unitario) || 0;
          const vTotal = Number(peca.valor_total) || vUnit * qtd;

          const existingP = pecasGlobalMap.get(pecaKey);
          if (existingP) {
            existingP.quantidade += qtd;
            existingP.valorTotal += vTotal;
          } else {
            pecasGlobalMap.set(pecaKey, {
              pn: peca.pn || peca.codigo || '',
              descricao: peca.descricao || pecaKey,
              quantidade: qtd,
              valorTotal: vTotal,
              valorMedio: vUnit
            });
          }

          const existingCP = cpMap.get(pecaKey);
          if (existingCP) {
            existingCP.quantidade += qtd;
            existingCP.valorTotal += vTotal;
          } else {
            cpMap.set(pecaKey, {
              pn: peca.pn || peca.codigo || '',
              descricao: peca.descricao || pecaKey,
              quantidade: qtd,
              valorTotal: vTotal
            });
          }
        });
      });

      vendedorClientesSet.forEach((clienteSet, vendedorId) => {
        const v = vendedoresMap.get(vendedorId);
        if (v) {
          v.totalClientes = clienteSet.size;
          v.ticketMedio = v.totalOS > 0 ? v.faturamento / v.totalOS : 0;
        }
      });

      clientePecasMap.forEach((pecas, clienteKey) => {
        const cliente = clientesMap.get(clienteKey);
        if (cliente) {
          cliente.pecas = Array.from(pecas.values())
            .sort((a, b) => b.quantidade - a.quantidade)
            .slice(0, 5)
            .map(p => ({
              pn: p.pn,
              descricao: p.descricao,
              quantidade: p.quantidade,
              valorMedio: p.valorTotal / p.quantidade
            }));
        }
      });

      const clientesArray = Array.from(clientesMap.values())
        .map(c => {
          const valorRef = c.totalPago > 0 ? c.totalPago : c.totalFaturado;
          return {
            ...c,
            ticketMedio: c.totalOS > 0 ? valorRef / c.totalOS : 0
          };
        })
        .sort((a, b) => {
          const valA = a.totalPago > 0 ? a.totalPago : a.totalFaturado;
          const valB = b.totalPago > 0 ? b.totalPago : b.totalFaturado;
          return valB - valA;
        });
      setClientes(clientesArray);

      const vendedoresArray = Array.from(vendedoresMap.values())
        .sort((a, b) => b.faturamento - a.faturamento);
      setVendedores(vendedoresArray);

      const pecasArray = Array.from(pecasGlobalMap.values())
        .map(p => ({ ...p, valorMedio: p.quantidade > 0 ? p.valorTotal / p.quantidade : 0 }))
        .sort((a, b) => b.quantidade - a.quantidade);
      setPecasPopulares(pecasArray);

      const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const mensaisMap = new Map<string, { faturamento: number; qtd: number }>();

      (osData || []).forEach(os => {
        const dataRef = os.orcamento_aprovado_em || os.created_at;
        const dt = new Date(dataRef);
        const mesKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        const valorOS = Number(os.valor_total) || 0;
        const valorPago = pagamentosPorOS.get(os.id) || 0;
        const valorFinal = valorPago > 0 ? valorPago : valorOS;

        const e = mensaisMap.get(mesKey);
        if (e) {
          e.faturamento += valorFinal;
          e.qtd += 1;
        } else {
          mensaisMap.set(mesKey, { faturamento: valorFinal, qtd: 1 });
        }
      });

      const dadosMensaisArray = Array.from(mensaisMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([key, data]) => {
          const [ano, mes] = key.split('-');
          return { mes: `${mesesNomes[parseInt(mes) - 1]}/${ano.slice(2)}`, faturamento: data.faturamento, qtd: data.qtd };
        });
      setDadosMensais(dadosMensaisArray);

      const totalFaturamento = clientesArray.reduce((sum, c) => sum + (c.totalPago > 0 ? c.totalPago : c.totalFaturado), 0);
      const totalOS = clientesArray.reduce((sum, c) => sum + c.totalOS, 0);
      const ticketMedio = totalOS > 0 ? totalFaturamento / totalOS : 0;
      const topCliente = clientesArray[0];
      const topVendedor = vendedoresArray[0];

      const mesAtualVal = dadosMensaisArray[dadosMensaisArray.length - 1]?.faturamento || 0;
      const mesAnteriorVal = dadosMensaisArray[dadosMensaisArray.length - 2]?.faturamento || 0;
      const crescimento = mesAnteriorVal > 0 ? ((mesAtualVal - mesAnteriorVal) / mesAnteriorVal) * 100 : 0;

      setKpis({
        totalFaturamento,
        ticketMedio,
        clienteDoMes: topCliente?.nome || 'N/A',
        clienteDoMesValor: topCliente ? (topCliente.totalPago > 0 ? topCliente.totalPago : topCliente.totalFaturado) : 0,
        vendedorDestaque: topVendedor?.nome || 'N/A',
        vendedorDestaqueValor: topVendedor?.faturamento || 0,
        crescimento,
        totalClientes: clientesArray.length
      });
    } catch (error) {
      console.error('Erro ao carregar dados CI:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedUnidade, tipoFiltro, getDateRange]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const filteredClientes = useMemo(() => {
    let filtered = clientes;
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
  }, [clientes, searchTerm, selectedVendedorFilter]);

  const getValorCliente = (c: ClienteCI) => c.totalPago > 0 ? c.totalPago : c.totalFaturado;

  const exportToExcel = () => {
    const data = filteredClientes.map(c => ({
      'Cliente': c.nome,
      'Documento': c.documento,
      'Telefone': c.telefone,
      'Cidade': c.cidade,
      'Estado': c.estado,
      'Valor Total': getValorCliente(c),
      'Ticket Medio': c.ticketMedio,
      'Total OS': c.totalOS,
      'Vendedor': c.vendedorNome,
      'Status': c.status
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
    XLSX.writeFile(wb, `customer_intelligence_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const chartData = useMemo(() =>
    filteredClientes.slice(0, 10).map(c => ({
      name: c.nome.length > 15 ? c.nome.substring(0, 15) + '...' : c.nome,
      valor: getValorCliente(c),
      os: c.totalOS
    })), [filteredClientes]);

  const pieData = useMemo(() =>
    vendedores.slice(0, 6).map((v, i) => ({
      name: v.nome.split(' ')[0],
      value: v.faturamento,
      color: COLORS[i % COLORS.length]
    })), [vendedores]);

  const areaData = useMemo(() =>
    dadosMensais.map(d => ({ name: d.mes, faturamento: d.faturamento, orcamentos: d.qtd })),
    [dadosMensais]);

  const carteiraLabel = isGerente ? 'Carteira de Vendas' : 'Minha Carteira';

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
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 p-6">
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSA2MCAwIEwgMCAwIDAgNjAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgxNDEsIDI0MiwgMjQ1LCAwLjAzKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-50 pointer-events-none" />

      <div className="relative z-10 max-w-[1800px] mx-auto space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-teal-400 bg-clip-text text-transparent flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-blue-500/20 border border-cyan-500/30">
                <Zap className="w-8 h-8 text-cyan-400" />
              </div>
              Customer Intelligence
            </h1>
            <p className="text-slate-400 mt-1">Gestao 360 da carteira de clientes e performance de vendas</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isGerente && (
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400" />
                <select
                  value={selectedUnidade}
                  onChange={(e) => setSelectedUnidade(e.target.value)}
                  className="pl-10 pr-8 py-2.5 rounded-xl bg-slate-800/50 border border-cyan-500/30 text-white text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 appearance-none cursor-pointer min-w-[200px]"
                >
                  <option value="">Todas Unidades</option>
                  {unidades.map(u => (
                    <option key={u.id} value={u.id}>{u.nome}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400 pointer-events-none" />
              </div>
            )}

            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-800/50 border border-cyan-500/30">
              {(['geral', 'SCC', 'ACC', 'OW'] as const).map(tipo => (
                <button
                  key={tipo}
                  onClick={() => setTipoFiltro(tipo)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
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
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400" />
              <select
                value={periodoFiltro}
                onChange={(e) => setPeriodoFiltro(e.target.value as any)}
                className="pl-10 pr-8 py-2.5 rounded-xl bg-slate-800/50 border border-cyan-500/30 text-white text-sm focus:border-cyan-400 appearance-none cursor-pointer"
              >
                <option value="mes">Ultimo Mes</option>
                <option value="trimestre">Ultimo Trimestre</option>
                <option value="semestre">Ultimo Semestre</option>
                <option value="ano">Ultimo Ano</option>
                <option value="todos">Todo Periodo</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400 pointer-events-none" />
            </div>

            <button
              onClick={() => { setRefreshing(true); loadData(); }}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-slate-800/50 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className={`${GLASS_CARD} p-5 group hover:border-cyan-400/40 transition-all duration-300`}>
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30 group-hover:scale-110 transition-transform">
                <DollarSign className="w-5 h-5 text-cyan-400" />
              </div>
              <span className={`flex items-center gap-1 text-xs ${kpis.crescimento >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {kpis.crescimento >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                {Math.abs(kpis.crescimento).toFixed(1)}%
              </span>
            </div>
            <p className="text-2xl font-bold text-white mb-1">{formatCurrency(kpis.totalFaturamento)}</p>
            <p className="text-sm text-slate-400">Faturamento Total</p>
          </div>

          <div className={`${GLASS_CARD} p-5 group hover:border-blue-400/40 transition-all duration-300`}>
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-600/10 border border-blue-500/30 group-hover:scale-110 transition-transform">
                <Target className="w-5 h-5 text-blue-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white mb-1">{formatCurrency(kpis.ticketMedio)}</p>
            <p className="text-sm text-slate-400">Ticket Medio Geral</p>
          </div>

          <div className={`${GLASS_CARD} p-5 group hover:border-amber-400/40 transition-all duration-300`}>
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 group-hover:scale-110 transition-transform">
                <Star className="w-5 h-5 text-amber-400" />
              </div>
              <span className="text-xs text-slate-500">{kpis.totalClientes} clientes</span>
            </div>
            <p className="text-lg font-bold text-white mb-0.5 truncate" title={kpis.clienteDoMes}>{kpis.clienteDoMes}</p>
            <p className="text-sm text-amber-400">{formatCurrency(kpis.clienteDoMesValor)}</p>
            <p className="text-xs text-slate-400 mt-1">Cliente Destaque</p>
          </div>

          <div className={`${GLASS_CARD} p-5 group hover:border-emerald-400/40 transition-all duration-300`}>
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 group-hover:scale-110 transition-transform">
                <Award className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
            <p className="text-lg font-bold text-white mb-0.5 truncate" title={kpis.vendedorDestaque}>{kpis.vendedorDestaque}</p>
            <p className="text-sm text-emerald-400">{formatCurrency(kpis.vendedorDestaqueValor)}</p>
            <p className="text-xs text-slate-400 mt-1">Vendedor Destaque</p>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-800/30 border border-slate-700/50 w-fit">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
            { id: 'carteira', label: carteiraLabel, icon: Users },
            { id: 'vendedores', label: 'Performance', icon: TrendingUp },
            { id: 'produtos', label: 'Produtos', icon: Package }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.id
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-slate-700/30'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>

        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className={`${GLASS_CARD} p-6 lg:col-span-2`}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-cyan-400" />
                  Top 10 Clientes por Faturamento
                </h3>
                <button onClick={exportToExcel} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 text-sm transition-all">
                  <Download className="w-4 h-4" /> Exportar
                </button>
              </div>
              {chartData.length > 0 ? (
                <div className="h-[350px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis type="number" stroke="#64748B" tickFormatter={(v) => v >= 1000 ? `R$ ${(v/1000).toFixed(0)}k` : `R$ ${v}`} />
                      <YAxis type="category" dataKey="name" stroke="#64748B" width={120} tick={{ fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #06B6D4', borderRadius: '12px' }} formatter={(value: number) => [formatCurrency(value), 'Faturamento']} />
                      <Bar dataKey="valor" fill="url(#barGradient)" radius={[0, 8, 8, 0]} />
                      <defs>
                        <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                          <stop offset="0%" stopColor="#06B6D4" />
                          <stop offset="100%" stopColor="#3B82F6" />
                        </linearGradient>
                      </defs>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[350px] flex items-center justify-center text-slate-500">
                  <div className="text-center">
                    <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Nenhum dado para exibir</p>
                  </div>
                </div>
              )}
            </div>

            <div className={`${GLASS_CARD} p-6`}>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-6">
                <PieChart className="w-5 h-5 text-blue-400" />
                Faturamento por Vendedor
              </h3>
              {pieData.length > 0 ? (
                <>
                  <div className="h-[280px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <RePieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                          {pieData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #3B82F6', borderRadius: '12px' }} formatter={(value: number) => [formatCurrency(value), '']} />
                      </RePieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 mt-4">
                    {pieData.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                          <span className="text-slate-300">{item.name}</span>
                        </div>
                        <span className="text-slate-400">{formatCurrency(item.value)}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="h-[280px] flex items-center justify-center text-slate-500">
                  <div className="text-center">
                    <PieChart className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Nenhum vendedor vinculado</p>
                    <p className="text-xs mt-1">Vincule vendedores na aba Pagamentos das OS</p>
                  </div>
                </div>
              )}
            </div>

            <div className={`${GLASS_CARD} p-6 lg:col-span-3`}>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-6">
                <Activity className="w-5 h-5 text-emerald-400" />
                Evolucao do Faturamento
              </h3>
              {areaData.length > 0 ? (
                <div className="h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={areaData}>
                      <defs>
                        <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#06B6D4" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#06B6D4" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="name" stroke="#64748B" />
                      <YAxis stroke="#64748B" tickFormatter={(v) => v >= 1000 ? `R$ ${(v/1000).toFixed(0)}k` : `R$ ${v}`} />
                      <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #06B6D4', borderRadius: '12px' }} formatter={(value: number, name: string) => [name === 'faturamento' ? formatCurrency(value) : value, name === 'faturamento' ? 'Faturamento' : 'Orcamentos']} />
                      <Area type="monotone" dataKey="faturamento" stroke="#06B6D4" strokeWidth={2} fillOpacity={1} fill="url(#areaGradient)" />
                      <Line type="monotone" dataKey="orcamentos" stroke="#F59E0B" strokeWidth={2} dot={{ fill: '#F59E0B', strokeWidth: 2 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-slate-500">
                  <div className="text-center">
                    <Activity className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Sem dados de evolucao</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Carteira Tab */}
        {activeTab === 'carteira' && (
          <div className="space-y-6">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Buscar cliente por nome, documento ou telefone..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white placeholder-slate-500 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500/50"
                />
              </div>

              {vendedores.length > 0 && (
                <div className="relative">
                  <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400" />
                  <select
                    value={selectedVendedorFilter || ''}
                    onChange={(e) => setSelectedVendedorFilter(e.target.value || null)}
                    className="pl-10 pr-8 py-3 rounded-xl bg-slate-800/50 border border-slate-700 text-white text-sm focus:border-cyan-500 appearance-none cursor-pointer min-w-[200px]"
                  >
                    <option value="">Todos Vendedores</option>
                    {vendedores.map(v => (
                      <option key={v.id} value={v.id}>{v.nome}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400 pointer-events-none" />
                </div>
              )}

              <div className="text-sm text-slate-400">
                {filteredClientes.length} cliente{filteredClientes.length !== 1 ? 's' : ''}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className={`${GLASS_CARD} p-4 lg:col-span-1 max-h-[700px] overflow-y-auto custom-scrollbar`}>
                <h3 className="text-lg font-semibold text-white mb-4 sticky top-0 bg-slate-900/90 py-2 -mt-2 -mx-2 px-2 z-10">
                  {isGerente ? 'Todos os Clientes' : 'Meus Clientes'}
                </h3>
                <div className="space-y-2">
                  {filteredClientes.map((cliente, idx) => (
                    <div
                      key={cliente.id}
                      onClick={() => setSelectedCliente(cliente)}
                      className={`p-4 rounded-xl cursor-pointer transition-all ${
                        selectedCliente?.id === cliente.id
                          ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/40'
                          : 'bg-slate-800/40 border border-slate-700/50 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                              {idx + 1}
                            </span>
                            <h4 className="font-medium text-white truncate">{cliente.nome}</h4>
                          </div>
                          <p className="text-sm text-slate-400 mt-1">{cliente.documento || 'Sem documento'}</p>
                        </div>
                        <div className="text-right flex-shrink-0 ml-2">
                          <p className="text-cyan-400 font-semibold">{formatCurrency(getValorCliente(cliente))}</p>
                          <p className="text-xs text-slate-500">{cliente.totalOS} OS</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs border ${
                          cliente.status === 'ativo' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                        }`}>
                          {cliente.status}
                        </span>
                        <span className="text-xs text-slate-500">{cliente.vendedorNome}</span>
                      </div>
                    </div>
                  ))}
                  {filteredClientes.length === 0 && (
                    <div className="text-center py-12 text-slate-500">
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>Nenhum cliente encontrado</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="lg:col-span-2 space-y-6">
                {selectedCliente ? (
                  <>
                    <div className={`${GLASS_CARD} p-6`}>
                      <div className="flex items-start justify-between mb-6">
                        <div>
                          <h3 className="text-xl font-bold text-white">{selectedCliente.nome}</h3>
                          <p className="text-slate-400">{selectedCliente.documento}</p>
                        </div>
                        <span className={`px-3 py-1 rounded-full text-sm border ${
                          selectedCliente.status === 'ativo' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                        }`}>
                          {selectedCliente.status === 'ativo' ? <CheckCircle className="w-4 h-4 inline mr-1" /> : <Clock className="w-4 h-4 inline mr-1" />}
                          {selectedCliente.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className={`${GLASS_CARD_INNER} p-4`}>
                          <div className="flex items-center gap-3 text-slate-300">
                            <Phone className="w-5 h-5 text-cyan-400" />
                            <span>{selectedCliente.telefone || 'Nao informado'}</span>
                          </div>
                        </div>
                        <div className={`${GLASS_CARD_INNER} p-4`}>
                          <div className="flex items-center gap-3 text-slate-300">
                            <Mail className="w-5 h-5 text-blue-400" />
                            <span className="truncate">{selectedCliente.email || 'Nao informado'}</span>
                          </div>
                        </div>
                        {selectedCliente.endereco && (
                          <div className={`${GLASS_CARD_INNER} p-4 md:col-span-2`}>
                            <div className="flex items-start gap-3 text-slate-300">
                              <MapPin className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                              <span>
                                {selectedCliente.endereco}
                                {selectedCliente.cidade && ` - ${selectedCliente.cidade}/${selectedCliente.estado}`}
                              </span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className={`${GLASS_CARD} p-4`}>
                        <p className="text-sm text-slate-400 mb-1">Total Faturado</p>
                        <p className="text-xl font-bold text-cyan-400">{formatCurrency(getValorCliente(selectedCliente))}</p>
                      </div>
                      <div className={`${GLASS_CARD} p-4`}>
                        <p className="text-sm text-slate-400 mb-1">Ticket Medio</p>
                        <p className="text-xl font-bold text-blue-400">{formatCurrency(selectedCliente.ticketMedio)}</p>
                      </div>
                      <div className={`${GLASS_CARD} p-4`}>
                        <p className="text-sm text-slate-400 mb-1">Total OS Aprovadas</p>
                        <p className="text-xl font-bold text-white">{selectedCliente.totalOS}</p>
                      </div>
                    </div>

                    {selectedCliente.vendedorId && (
                      <div className={`${GLASS_CARD} p-4`}>
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-lg bg-emerald-500/20 border border-emerald-500/30">
                            <Award className="w-5 h-5 text-emerald-400" />
                          </div>
                          <div>
                            <p className="text-sm text-slate-400">Vendedor Responsavel</p>
                            <p className="font-semibold text-white">{selectedCliente.vendedorNome}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className={`${GLASS_CARD} p-6`}>
                      <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <ShoppingCart className="w-5 h-5 text-amber-400" />
                        Pecas Utilizadas
                      </h4>
                      {selectedCliente.pecas.length > 0 ? (
                        <div className="space-y-3">
                          {selectedCliente.pecas.map((peca, idx) => (
                            <div key={idx} className={`${GLASS_CARD_INNER} p-4 flex items-center justify-between`}>
                              <div className="flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
                                  {idx + 1}
                                </span>
                                <div>
                                  <p className="font-medium text-white">{peca.descricao}</p>
                                  {peca.pn && <p className="text-sm text-slate-500">{peca.pn}</p>}
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-cyan-400 font-semibold">{peca.quantidade}x</p>
                                <p className="text-sm text-slate-500">Media: {formatCurrency(peca.valorMedio)}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-slate-500">
                          <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                          <p>Sem pecas registradas</p>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className={`${GLASS_CARD} p-12 flex flex-col items-center justify-center min-h-[400px]`}>
                    <Users className="w-16 h-16 text-slate-600 mb-4" />
                    <h3 className="text-xl font-semibold text-slate-400 mb-2">Selecione um Cliente</h3>
                    <p className="text-slate-500 text-center max-w-sm">
                      Clique em um cliente na lista para ver detalhes completos.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Performance Tab */}
        {activeTab === 'vendedores' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className={`${GLASS_CARD} p-6`}>
              <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                Ranking de Vendedores
              </h3>
              <div className="space-y-3">
                {vendedores.map((vendedor, idx) => (
                  <div key={vendedor.id} className="p-4 rounded-xl bg-slate-800/40 border border-slate-700/50 hover:border-slate-600 transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg ${
                          idx === 0 ? 'bg-gradient-to-br from-amber-500 to-yellow-500 text-slate-900' :
                          idx === 1 ? 'bg-gradient-to-br from-slate-400 to-slate-300 text-slate-900' :
                          idx === 2 ? 'bg-gradient-to-br from-amber-700 to-amber-600 text-white' :
                          'bg-slate-700 text-slate-300'
                        }`}>
                          {idx + 1}
                        </div>
                        <div>
                          <h4 className="font-medium text-white">{vendedor.nome}</h4>
                          <p className="text-sm text-slate-500">{vendedor.totalClientes} clientes</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-bold text-cyan-400">{formatCurrency(vendedor.faturamento)}</p>
                        <p className="text-sm text-slate-500">{vendedor.totalOS} OS</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-700/50 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-500">Ticket Medio</p>
                        <p className="text-sm font-semibold text-blue-400">{formatCurrency(vendedor.ticketMedio)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Clientes Ativos</p>
                        <p className="text-sm font-semibold text-emerald-400">{vendedor.totalClientes}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {vendedores.length === 0 && (
                  <div className="text-center py-12 text-slate-500">
                    <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhum vendedor vinculado</p>
                    <p className="text-xs mt-1">Vincule vendedores na aba Pagamentos das OS</p>
                  </div>
                )}
              </div>
            </div>

            <div className={`${GLASS_CARD} p-6`}>
              <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
                Comparativo de Performance
              </h3>
              {vendedores.length > 0 ? (
                <div className="h-[400px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={vendedores.slice(0, 6)} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis type="number" stroke="#64748B" tickFormatter={(v) => v >= 1000 ? `R$ ${(v/1000).toFixed(0)}k` : `R$ ${v}`} />
                      <YAxis type="category" dataKey="nome" stroke="#64748B" width={100} tick={{ fontSize: 12 }} />
                      <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #06B6D4', borderRadius: '12px' }} formatter={(value: number, name: string) => [formatCurrency(value), name === 'faturamento' ? 'Faturamento' : 'Ticket Medio']} />
                      <Legend />
                      <Bar dataKey="faturamento" name="Faturamento" fill="#06B6D4" radius={[0, 4, 4, 0]} />
                      <Bar dataKey="ticketMedio" name="Ticket Medio" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[400px] flex items-center justify-center text-slate-500">
                  <div className="text-center">
                    <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Sem dados de performance</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Produtos Tab */}
        {activeTab === 'produtos' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className={`${GLASS_CARD} p-6`}>
              <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-400" />
                Pecas Mais Utilizadas
              </h3>
              <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
                {pecasPopulares.slice(0, 15).map((peca, idx) => (
                  <div key={idx} className={`${GLASS_CARD_INNER} p-4`}>
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3">
                        <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-green-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold flex-shrink-0">
                          {idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="font-medium text-white truncate">{peca.descricao}</p>
                          {peca.pn && <p className="text-sm text-slate-500">{peca.pn}</p>}
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <p className="text-cyan-400 font-semibold">{peca.quantidade}x</p>
                        <p className="text-sm text-slate-500">{formatCurrency(peca.valorTotal)}</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-700/30 flex items-center justify-between">
                      <span className="text-xs text-slate-500">Valor Medio: {formatCurrency(peca.valorMedio)}</span>
                    </div>
                  </div>
                ))}
                {pecasPopulares.length === 0 && (
                  <div className="text-center py-12 text-slate-500">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>Nenhuma peca encontrada</p>
                  </div>
                )}
              </div>
            </div>

            <div className={`${GLASS_CARD} p-6`}>
              <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <BarChart3 className="w-5 h-5 text-blue-400" />
                Volume por Produto
              </h3>
              {pecasPopulares.length > 0 ? (
                <div className="h-[450px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={pecasPopulares.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                      <XAxis dataKey="pn" stroke="#64748B" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                      <YAxis stroke="#64748B" />
                      <Tooltip contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #3B82F6', borderRadius: '12px' }} formatter={(value: number, name: string) => [name === 'quantidade' ? `${value} unidades` : formatCurrency(value), name === 'quantidade' ? 'Quantidade' : 'Valor Total']} />
                      <Legend />
                      <Bar dataKey="quantidade" name="Quantidade" fill="#10B981" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="valorTotal" name="Valor Total" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="h-[450px] flex items-center justify-center text-slate-500">
                  <div className="text-center">
                    <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
                    <p>Sem dados de produtos</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(30, 41, 59, 0.5); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(6, 182, 212, 0.3); border-radius: 3px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(6, 182, 212, 0.5); }
      `}</style>
    </div>
  );
}
