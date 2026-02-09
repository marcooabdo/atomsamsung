import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users, TrendingUp, DollarSign, Package, Award, Target, Filter,
  Calendar, Building2, ChevronDown, ChevronRight, Search, Download,
  MapPin, Phone, Mail, Clock, AlertTriangle, CheckCircle, XCircle,
  BarChart3, PieChart, Activity, Zap, Star, ShoppingCart, Percent,
  ArrowUpRight, ArrowDownRight, Eye, ExternalLink, RefreshCw
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart as RePieChart, Pie, Cell, Area, AreaChart,
  Legend, RadialBarChart, RadialBar
} from 'recharts';
import * as XLSX from 'xlsx';

interface Cliente {
  id: string;
  nome: string;
  documento: string;
  telefone: string;
  email: string;
  endereco: string;
  cidade: string;
  estado: string;
  totalGasto: number;
  totalCompras: number;
  ticketMedio: number;
  ultimaCompra: string;
  vendedorId: string | null;
  vendedorNome: string;
  margemMedia: number;
  descontoMedio: number;
  pecasMaisCompradas: { pn: string; descricao: string; quantidade: number; valorMedio: number }[];
  status: 'ativo' | 'inativo' | 'pendente';
}

interface Vendedor {
  id: string;
  nome: string;
  faturamentoTotal: number;
  ticketMedio: number;
  totalVendas: number;
  totalClientes: number;
  conversao: number;
}

interface PecaPopular {
  pn: string;
  descricao: string;
  quantidade: number;
  valorTotal: number;
  valorMedio: number;
  margemMedia: number;
  clientesUnicos: number;
}

const COLORS = ['#06B6D4', '#8B5CF6', '#F59E0B', '#10B981', '#EC4899', '#3B82F6'];

const GLASS_CARD = 'backdrop-blur-xl bg-gradient-to-br from-slate-900/80 via-slate-800/60 to-slate-900/80 border border-cyan-500/20 rounded-2xl shadow-2xl shadow-cyan-500/5';
const GLASS_CARD_INNER = 'backdrop-blur-md bg-gradient-to-br from-slate-800/40 to-slate-900/40 border border-slate-700/50 rounded-xl';

export default function CustomerIntelligence() {
  const { user, unidades } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [selectedUnidade, setSelectedUnidade] = useState<string>('');
  const [tipoFiltro, setTipoFiltro] = useState<'geral' | 'SCC' | 'ACC' | 'OW'>('geral');
  const [periodoFiltro, setPeriodoFiltro] = useState<'hoje' | 'semana' | 'mes' | 'ano' | 'personalizado'>('mes');
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  });
  const [dataFim, setDataFim] = useState(() => new Date().toISOString().split('T')[0]);

  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [vendedores, setVendedores] = useState<Vendedor[]>([]);
  const [pecasPopulares, setPecasPopulares] = useState<PecaPopular[]>([]);
  const [dadosMensais, setDadosMensais] = useState<{ mes: string; faturamento: number; orcamentos: number }[]>([]);
  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(null);
  const [selectedVendedor, setSelectedVendedor] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'carteira' | 'vendedores' | 'produtos'>('dashboard');

  const [kpis, setKpis] = useState({
    ticketMedioGeral: 0,
    clienteDoMes: '',
    clienteDoMesValor: 0,
    vendedorDestaque: '',
    vendedorDestaqueValor: 0,
    totalFaturamento: 0,
    totalClientes: 0,
    crescimento: 0
  });

  const isMaster = user?.tipo === 'master';

  useEffect(() => {
    if (user?.unidade_id && !isMaster) {
      setSelectedUnidade(user.unidade_id);
    }
  }, [user, isMaster]);

  const getDateRange = useCallback(() => {
    const now = new Date();
    let start: Date;
    let end = new Date(now);
    end.setHours(23, 59, 59, 999);

    switch (periodoFiltro) {
      case 'hoje':
        start = new Date(now);
        start.setHours(0, 0, 0, 0);
        break;
      case 'semana':
        start = new Date(now);
        start.setDate(now.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        break;
      case 'mes':
        start = new Date(now);
        start.setMonth(now.getMonth() - 1);
        start.setHours(0, 0, 0, 0);
        break;
      case 'ano':
        start = new Date(now);
        start.setFullYear(now.getFullYear() - 1);
        start.setHours(0, 0, 0, 0);
        break;
      case 'personalizado':
        start = new Date(dataInicio);
        end = new Date(dataFim);
        end.setHours(23, 59, 59, 999);
        break;
      default:
        start = new Date(now);
        start.setMonth(now.getMonth() - 1);
    }

    return { start, end };
  }, [periodoFiltro, dataInicio, dataFim]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();

      let osQuery = supabase
        .from('os')
        .select(`
          id, cliente_nome, cliente_cpf_cnpj, cliente_telefone, cliente_email,
          cliente_logradouro, cliente_numero, cliente_bairro, cliente_cidade, cliente_estado,
          tipo_os, valor_total, valor_pecas, valor_servicos, desconto_valor, desconto_tipo,
          created_at, fechada_em, coluna_kanban, criado_por, unidade_id,
          vendedor_responsavel_id, orcamento_aprovado_em, orcamento_aprovado,
          os_pecas (id, codigo, pn, descricao, quantidade, valor_unitario, valor_total, status, devolvida_em)
        `)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (selectedUnidade) {
        osQuery = osQuery.eq('unidade_id', selectedUnidade);
      }

      if (tipoFiltro !== 'geral') {
        osQuery = osQuery.eq('tipo_os', tipoFiltro);
      }

      const { data: osData, error: osError } = await osQuery;
      if (osError) throw osError;

      let cotacoesQuery = supabase
        .from('cotacoes')
        .select(`
          id, cliente_nome, cliente_cpf_cnpj, cliente_telefone, cliente_email,
          cliente_logradouro, cliente_numero, cliente_bairro, cliente_cidade, cliente_estado,
          tipo_os, status, criado_por, unidade_id, created_at,
          cotacoes_pecas (pn, descricao, quantidade, valor_base_gspn, valor_final_unitario, valor_total)
        `)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString());

      if (selectedUnidade) {
        cotacoesQuery = cotacoesQuery.eq('unidade_id', selectedUnidade);
      }

      if (tipoFiltro !== 'geral') {
        cotacoesQuery = cotacoesQuery.eq('tipo_os', tipoFiltro);
      }

      const { data: cotacoesData, error: cotacoesError } = await cotacoesQuery;
      if (cotacoesError) throw cotacoesError;

      let vendasQuery = supabase
        .from('vendas')
        .select(`
          id, cliente_nome, cliente_documento, cliente_contato, produto_nome, produto_tipo,
          vendedor_id, preco, tipo_venda, status, created_at, unidade_id
        `)
        .gte('created_at', start.toISOString())
        .lte('created_at', end.toISOString())
        .eq('status', 'concluida');

      if (selectedUnidade) {
        vendasQuery = vendasQuery.eq('unidade_id', selectedUnidade);
      }

      const { data: vendasData, error: vendasError } = await vendasQuery;
      if (vendasError) throw vendasError;

      const { data: usuariosData } = await supabase
        .from('usuarios')
        .select('id, nome, tipo, unidade_id')
        .eq('ativo', true);

      const usuariosMap = new Map((usuariosData || []).map(u => [u.id, u]));

      const clientesMap = new Map<string, Cliente>();

      (osData || []).forEach(os => {
        const key = os.cliente_cpf_cnpj || os.cliente_nome || 'desconhecido';
        const existing = clientesMap.get(key);
        const valor = Number(os.valor_total) || 0;
        const desconto = Number(os.desconto_valor) || 0;
        const vendedorId = (os as any).vendedor_responsavel_id || os.criado_por;
        const vendedor = usuariosMap.get(vendedorId);
        const isAprovado = (os as any).orcamento_aprovado === true ||
                          os.coluna_kanban === 'orcamento_aprovado' ||
                          os.coluna_kanban === 'aguardando_peca' ||
                          os.coluna_kanban === 'peca_em_transito' ||
                          os.coluna_kanban === 'peca_disponivel' ||
                          os.coluna_kanban === 'em_reparo_ci' ||
                          os.coluna_kanban === 'disponivel_ih' ||
                          os.coluna_kanban === 'em_rota_ih' ||
                          os.coluna_kanban === 'saw' ||
                          os.coluna_kanban === 'controle_qualidade' ||
                          os.coluna_kanban === 'reparo_concluido' ||
                          os.coluna_kanban === 'aguardando_fechamento' ||
                          os.coluna_kanban === 'fechar_os' ||
                          os.coluna_kanban === 'os_fechada' ||
                          (os as any).orcamento_aprovado_em != null;

        const osPecas = ((os as any).os_pecas || []).filter((p: any) => !p.devolvida_em);

        if (existing) {
          if (isAprovado) {
            existing.totalGasto += valor;
            existing.totalCompras += 1;
          }
          existing.descontoMedio = (existing.descontoMedio + desconto) / 2;
          const dataRef = os.fechada_em || (os as any).orcamento_aprovado_em || os.created_at;
          if (dataRef && dataRef > existing.ultimaCompra) {
            existing.ultimaCompra = dataRef;
          }
          if (!existing.vendedorId && vendedorId) {
            existing.vendedorId = vendedorId;
            existing.vendedorNome = vendedor?.nome || 'N/A';
          }
        } else if (isAprovado) {
          clientesMap.set(key, {
            id: key,
            nome: os.cliente_nome || 'Cliente',
            documento: os.cliente_cpf_cnpj || '',
            telefone: os.cliente_telefone || '',
            email: os.cliente_email || '',
            endereco: [os.cliente_logradouro, os.cliente_numero, os.cliente_bairro].filter(Boolean).join(', '),
            cidade: os.cliente_cidade || '',
            estado: os.cliente_estado || '',
            totalGasto: valor,
            totalCompras: 1,
            ticketMedio: valor,
            ultimaCompra: os.fechada_em || (os as any).orcamento_aprovado_em || os.created_at,
            vendedorId: vendedorId,
            vendedorNome: vendedor?.nome || 'N/A',
            margemMedia: 0,
            descontoMedio: desconto,
            pecasMaisCompradas: [],
            status: os.coluna_kanban === 'os_fechada' ? 'ativo' : 'pendente'
          });
        }
      });

      (vendasData || []).forEach(venda => {
        const key = venda.cliente_documento || venda.cliente_nome || 'desconhecido';
        const existing = clientesMap.get(key);
        const valor = Number(venda.preco) || 0;
        const vendedor = usuariosMap.get(venda.vendedor_id);

        if (existing) {
          existing.totalGasto += valor;
          existing.totalCompras += 1;
          if (!existing.vendedorId && venda.vendedor_id) {
            existing.vendedorId = venda.vendedor_id;
            existing.vendedorNome = vendedor?.nome || 'N/A';
          }
        } else {
          clientesMap.set(key, {
            id: key,
            nome: venda.cliente_nome || 'Cliente',
            documento: venda.cliente_documento || '',
            telefone: venda.cliente_contato || '',
            email: '',
            endereco: '',
            cidade: '',
            estado: '',
            totalGasto: valor,
            totalCompras: 1,
            ticketMedio: valor,
            ultimaCompra: venda.created_at,
            vendedorId: venda.vendedor_id,
            vendedorNome: vendedor?.nome || 'N/A',
            margemMedia: 0,
            descontoMedio: 0,
            pecasMaisCompradas: [],
            status: 'ativo'
          });
        }
      });

      const pecasMap = new Map<string, PecaPopular>();
      const clientePecasMap = new Map<string, Map<string, { pn: string; descricao: string; quantidade: number; valorTotal: number }>>();

      (osData || []).forEach(os => {
        const clienteKey = os.cliente_cpf_cnpj || os.cliente_nome || 'desconhecido';
        const osPecas = ((os as any).os_pecas || []).filter((p: any) => !p.devolvida_em);

        if (!clientePecasMap.has(clienteKey)) {
          clientePecasMap.set(clienteKey, new Map());
        }
        const clientePecas = clientePecasMap.get(clienteKey)!;

        osPecas.forEach((peca: any) => {
          const pecaKey = peca.pn || peca.descricao || peca.codigo;
          if (!pecaKey) return;

          const quantidade = Number(peca.quantidade) || 1;
          const valorUnit = Number(peca.valor_unitario) || 0;
          const valorTotal = Number(peca.valor_total) || valorUnit * quantidade;

          const existingPeca = pecasMap.get(pecaKey);
          if (existingPeca) {
            existingPeca.quantidade += quantidade;
            existingPeca.valorTotal += valorTotal;
            if (!existingPeca.clientesUnicos) existingPeca.clientesUnicos = 1;
          } else {
            pecasMap.set(pecaKey, {
              pn: peca.pn || peca.codigo || '',
              descricao: peca.descricao || pecaKey,
              quantidade,
              valorTotal,
              valorMedio: valorUnit,
              margemMedia: 0,
              clientesUnicos: 1
            });
          }

          const existingClientePeca = clientePecas.get(pecaKey);
          if (existingClientePeca) {
            existingClientePeca.quantidade += quantidade;
            existingClientePeca.valorTotal += valorTotal;
          } else {
            clientePecas.set(pecaKey, {
              pn: peca.pn || peca.codigo || '',
              descricao: peca.descricao || pecaKey,
              quantidade,
              valorTotal
            });
          }
        });
      });

      (cotacoesData || []).forEach(cotacao => {
        const clienteKey = cotacao.cliente_cpf_cnpj || cotacao.cliente_nome || 'desconhecido';

        if (!clientePecasMap.has(clienteKey)) {
          clientePecasMap.set(clienteKey, new Map());
        }
        const clientePecas = clientePecasMap.get(clienteKey)!;

        (cotacao.cotacoes_pecas || []).forEach((peca: any) => {
          const pecaKey = peca.pn || peca.descricao;
          const quantidade = Number(peca.quantidade) || 1;
          const valorBase = Number(peca.valor_base_gspn) || 0;
          const valorFinal = Number(peca.valor_final_unitario) || valorBase;
          const valorTotal = Number(peca.valor_total) || valorFinal * quantidade;
          const margem = valorBase > 0 ? ((valorFinal - valorBase) / valorBase) * 100 : 0;

          const existingPeca = pecasMap.get(pecaKey);
          if (existingPeca) {
            existingPeca.quantidade += quantidade;
            existingPeca.valorTotal += valorTotal;
            existingPeca.margemMedia = (existingPeca.margemMedia + margem) / 2;
            if (!existingPeca.clientesUnicos) existingPeca.clientesUnicos = 1;
          } else {
            pecasMap.set(pecaKey, {
              pn: peca.pn || '',
              descricao: peca.descricao || pecaKey,
              quantidade,
              valorTotal,
              valorMedio: valorFinal,
              margemMedia: margem,
              clientesUnicos: 1
            });
          }

          const existingClientePeca = clientePecas.get(pecaKey);
          if (existingClientePeca) {
            existingClientePeca.quantidade += quantidade;
            existingClientePeca.valorTotal += valorTotal;
          } else {
            clientePecas.set(pecaKey, {
              pn: peca.pn || '',
              descricao: peca.descricao || pecaKey,
              quantidade,
              valorTotal
            });
          }
        });
      });

      clientePecasMap.forEach((pecas, clienteKey) => {
        const cliente = clientesMap.get(clienteKey);
        if (cliente) {
          const sorted = Array.from(pecas.values())
            .sort((a, b) => b.quantidade - a.quantidade)
            .slice(0, 5)
            .map(p => ({
              pn: p.pn,
              descricao: p.descricao,
              quantidade: p.quantidade,
              valorMedio: p.valorTotal / p.quantidade
            }));
          cliente.pecasMaisCompradas = sorted;
        }
      });

      const clientesArray = Array.from(clientesMap.values())
        .map(c => ({
          ...c,
          ticketMedio: c.totalCompras > 0 ? c.totalGasto / c.totalCompras : 0
        }))
        .sort((a, b) => b.totalGasto - a.totalGasto);

      setClientes(clientesArray);

      const pecasArray = Array.from(pecasMap.values())
        .map(p => ({
          ...p,
          valorMedio: p.quantidade > 0 ? p.valorTotal / p.quantidade : 0
        }))
        .sort((a, b) => b.quantidade - a.quantidade);
      setPecasPopulares(pecasArray);

      const vendedoresMap = new Map<string, Vendedor>();

      clientesArray.forEach(cliente => {
        if (cliente.vendedorId) {
          const existing = vendedoresMap.get(cliente.vendedorId);
          if (existing) {
            existing.faturamentoTotal += cliente.totalGasto;
            existing.totalVendas += cliente.totalCompras;
            existing.totalClientes += 1;
          } else {
            vendedoresMap.set(cliente.vendedorId, {
              id: cliente.vendedorId,
              nome: cliente.vendedorNome,
              faturamentoTotal: cliente.totalGasto,
              ticketMedio: 0,
              totalVendas: cliente.totalCompras,
              totalClientes: 1,
              conversao: 0
            });
          }
        }
      });

      const vendedoresArray = Array.from(vendedoresMap.values())
        .map(v => ({
          ...v,
          ticketMedio: v.totalVendas > 0 ? v.faturamentoTotal / v.totalVendas : 0
        }))
        .sort((a, b) => b.faturamentoTotal - a.faturamentoTotal);
      setVendedores(vendedoresArray);

      const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const mensaisMap = new Map<string, { faturamento: number; orcamentos: number }>();

      (osData || []).forEach(os => {
        const isAprovado = os.coluna_kanban === 'orcamento_aprovado' ||
                          os.coluna_kanban === 'aguardando_peca' ||
                          os.coluna_kanban === 'peca_em_transito' ||
                          os.coluna_kanban === 'peca_disponivel' ||
                          os.coluna_kanban === 'em_reparo_ci' ||
                          os.coluna_kanban === 'disponivel_ih' ||
                          os.coluna_kanban === 'em_rota_ih' ||
                          os.coluna_kanban === 'saw' ||
                          os.coluna_kanban === 'controle_qualidade' ||
                          os.coluna_kanban === 'reparo_concluido' ||
                          os.coluna_kanban === 'aguardando_fechamento' ||
                          os.coluna_kanban === 'fechar_os' ||
                          os.coluna_kanban === 'os_fechada' ||
                          (os as any).orcamento_aprovado_em != null;
        if (!isAprovado) return;

        const dataRef = (os as any).orcamento_aprovado_em || os.created_at;
        const data = new Date(dataRef);
        const mesKey = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}`;
        const valor = Number(os.valor_total) || 0;

        const existing = mensaisMap.get(mesKey);
        if (existing) {
          existing.faturamento += valor;
          existing.orcamentos += 1;
        } else {
          mensaisMap.set(mesKey, { faturamento: valor, orcamentos: 1 });
        }
      });

      const dadosMensaisArray = Array.from(mensaisMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([key, data]) => {
          const [ano, mes] = key.split('-');
          return {
            mes: `${mesesNomes[parseInt(mes) - 1]}/${ano.slice(2)}`,
            faturamento: data.faturamento,
            orcamentos: data.orcamentos
          };
        });
      setDadosMensais(dadosMensaisArray);

      const totalFaturamento = clientesArray.reduce((sum, c) => sum + c.totalGasto, 0);
      const ticketMedioGeral = clientesArray.length > 0
        ? totalFaturamento / clientesArray.reduce((sum, c) => sum + c.totalCompras, 0)
        : 0;
      const topCliente = clientesArray[0];
      const topVendedor = vendedoresArray[0];

      const mesAtual = dadosMensaisArray[dadosMensaisArray.length - 1]?.faturamento || 0;
      const mesAnterior = dadosMensaisArray[dadosMensaisArray.length - 2]?.faturamento || 0;
      const crescimentoCalc = mesAnterior > 0 ? ((mesAtual - mesAnterior) / mesAnterior) * 100 : 0;

      setKpis({
        ticketMedioGeral,
        clienteDoMes: topCliente?.nome || 'N/A',
        clienteDoMesValor: topCliente?.totalGasto || 0,
        vendedorDestaque: topVendedor?.nome || 'N/A',
        vendedorDestaqueValor: topVendedor?.faturamentoTotal || 0,
        totalFaturamento,
        totalClientes: clientesArray.length,
        crescimento: crescimentoCalc
      });

    } catch (error) {
      console.error('Erro ao carregar dados:', error);
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

    if (selectedVendedor) {
      filtered = filtered.filter(c => c.vendedorId === selectedVendedor);
    }

    return filtered;
  }, [clientes, searchTerm, selectedVendedor]);

  const exportToExcel = () => {
    const data = filteredClientes.map(c => ({
      'Cliente': c.nome,
      'Documento': c.documento,
      'Telefone': c.telefone,
      'Cidade': c.cidade,
      'Estado': c.estado,
      'Total Gasto': c.totalGasto,
      'Ticket Medio': c.ticketMedio,
      'Total Compras': c.totalCompras,
      'Vendedor': c.vendedorNome,
      'Status': c.status
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Clientes');
    XLSX.writeFile(wb, `customer_intelligence_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const getMarginColor = (margin: number) => {
    if (margin >= 30) return 'text-emerald-400';
    if (margin >= 15) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ativo': return 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30';
      case 'pendente': return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'inativo': return 'bg-red-500/20 text-red-400 border-red-500/30';
      default: return 'bg-slate-500/20 text-slate-400 border-slate-500/30';
    }
  };

  const chartData = useMemo(() => {
    return filteredClientes.slice(0, 10).map(c => ({
      name: c.nome.split(' ')[0],
      valor: c.totalGasto,
      compras: c.totalCompras
    }));
  }, [filteredClientes]);

  const pieData = useMemo(() => {
    const byVendedor = vendedores.slice(0, 5).map((v, i) => ({
      name: v.nome.split(' ')[0],
      value: v.faturamentoTotal,
      color: COLORS[i % COLORS.length]
    }));
    return byVendedor;
  }, [vendedores]);

  const areaData = useMemo(() => {
    return dadosMensais.map(d => ({
      name: d.mes,
      faturamento: d.faturamento,
      orcamentos: d.orcamentos
    }));
  }, [dadosMensais]);

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
            <h1 className="text-3xl font-bold bg-gradient-to-r from-cyan-400 via-blue-400 to-purple-400 bg-clip-text text-transparent flex items-center gap-3">
              <div className="p-2 rounded-xl bg-gradient-to-br from-cyan-500/20 to-purple-500/20 border border-cyan-500/30">
                <Zap className="w-8 h-8 text-cyan-400" />
              </div>
              Customer Intelligence & Sales Hub
            </h1>
            <p className="text-slate-400 mt-1">Gestao 360 da carteira de clientes e performance de vendas</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isMaster && (
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400" />
                <select
                  value={selectedUnidade}
                  onChange={(e) => setSelectedUnidade(e.target.value)}
                  className="pl-10 pr-8 py-2.5 rounded-xl bg-slate-800/50 border border-cyan-500/30 text-white text-sm focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 appearance-none cursor-pointer min-w-[180px]"
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
                <option value="hoje">Hoje</option>
                <option value="semana">Ultima Semana</option>
                <option value="mes">Ultimo Mes</option>
                <option value="ano">Ultimo Ano</option>
                <option value="personalizado">Personalizado</option>
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400 pointer-events-none" />
            </div>

            {periodoFiltro === 'personalizado' && (
              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={dataInicio}
                  onChange={(e) => setDataInicio(e.target.value)}
                  className="px-3 py-2.5 rounded-xl bg-slate-800/50 border border-cyan-500/30 text-white text-sm focus:border-cyan-400"
                />
                <span className="text-slate-500">ate</span>
                <input
                  type="date"
                  value={dataFim}
                  onChange={(e) => setDataFim(e.target.value)}
                  className="px-3 py-2.5 rounded-xl bg-slate-800/50 border border-cyan-500/30 text-white text-sm focus:border-cyan-400"
                />
              </div>
            )}

            <button
              onClick={() => { setRefreshing(true); loadData(); }}
              disabled={refreshing}
              className="p-2.5 rounded-xl bg-slate-800/50 border border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/20 transition-all disabled:opacity-50"
            >
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

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

          <div className={`${GLASS_CARD} p-5 group hover:border-purple-400/40 transition-all duration-300`}>
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-600/10 border border-purple-500/30 group-hover:scale-110 transition-transform">
                <Target className="w-5 h-5 text-purple-400" />
              </div>
            </div>
            <p className="text-2xl font-bold text-white mb-1">{formatCurrency(kpis.ticketMedioGeral)}</p>
            <p className="text-sm text-slate-400">Ticket Medio Geral</p>
          </div>

          <div className={`${GLASS_CARD} p-5 group hover:border-amber-400/40 transition-all duration-300`}>
            <div className="flex items-center justify-between mb-3">
              <div className="p-2.5 rounded-xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 group-hover:scale-110 transition-transform">
                <Star className="w-5 h-5 text-amber-400" />
              </div>
            </div>
            <p className="text-lg font-bold text-white mb-0.5 truncate" title={kpis.clienteDoMes}>{kpis.clienteDoMes}</p>
            <p className="text-sm text-amber-400">{formatCurrency(kpis.clienteDoMesValor)}</p>
            <p className="text-xs text-slate-400 mt-1">Cliente do Mes</p>
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

        <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-800/30 border border-slate-700/50 w-fit">
          {[
            { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
            { id: 'carteira', label: 'Minha Carteira', icon: Users },
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

        {activeTab === 'dashboard' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className={`${GLASS_CARD} p-6 lg:col-span-2`}>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-cyan-400" />
                  Top 10 Clientes por Faturamento
                </h3>
                <button
                  onClick={exportToExcel}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-700/50 text-slate-300 hover:bg-slate-600/50 text-sm transition-all"
                >
                  <Download className="w-4 h-4" />
                  Exportar
                </button>
              </div>
              <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" stroke="#64748B" tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="name" stroke="#64748B" width={80} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #06B6D4', borderRadius: '12px' }}
                      formatter={(value: number) => [formatCurrency(value), 'Faturamento']}
                    />
                    <Bar dataKey="valor" fill="url(#barGradient)" radius={[0, 8, 8, 0]} />
                    <defs>
                      <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor="#06B6D4" />
                        <stop offset="100%" stopColor="#8B5CF6" />
                      </linearGradient>
                    </defs>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className={`${GLASS_CARD} p-6`}>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-6">
                <PieChart className="w-5 h-5 text-purple-400" />
                Faturamento por Vendedor
              </h3>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RePieChart>
                    <Pie
                      data={pieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #8B5CF6', borderRadius: '12px' }}
                      formatter={(value: number) => [formatCurrency(value), '']}
                    />
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
            </div>

            <div className={`${GLASS_CARD} p-6 lg:col-span-3`}>
              <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-6">
                <Activity className="w-5 h-5 text-emerald-400" />
                Evolucao do Faturamento
              </h3>
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
                    <YAxis stroke="#64748B" tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #06B6D4', borderRadius: '12px' }}
                      formatter={(value: number, name: string) => [
                        name === 'faturamento' ? formatCurrency(value) : value,
                        name === 'faturamento' ? 'Faturamento' : 'Orcamentos Aprovados'
                      ]}
                    />
                    <Area type="monotone" dataKey="faturamento" stroke="#06B6D4" strokeWidth={2} fillOpacity={1} fill="url(#areaGradient)" />
                    <Line type="monotone" dataKey="orcamentos" stroke="#F59E0B" strokeWidth={2} dot={{ fill: '#F59E0B', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

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
                    value={selectedVendedor || ''}
                    onChange={(e) => setSelectedVendedor(e.target.value || null)}
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
                {filteredClientes.length} cliente{filteredClientes.length !== 1 ? 's' : ''} encontrado{filteredClientes.length !== 1 ? 's' : ''}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className={`${GLASS_CARD} p-4 lg:col-span-1 max-h-[700px] overflow-y-auto custom-scrollbar`}>
                <h3 className="text-lg font-semibold text-white mb-4 sticky top-0 bg-slate-900/90 py-2 -mt-2 -mx-2 px-2">
                  Lista de Clientes
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
                            <span className="w-6 h-6 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center text-xs font-bold text-white">
                              {idx + 1}
                            </span>
                            <h4 className="font-medium text-white truncate">{cliente.nome}</h4>
                          </div>
                          <p className="text-sm text-slate-400 mt-1">{cliente.documento || 'Sem documento'}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-cyan-400 font-semibold">{formatCurrency(cliente.totalGasto)}</p>
                          <p className="text-xs text-slate-500">{cliente.totalCompras} compras</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between mt-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs border ${getStatusColor(cliente.status)}`}>
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
                        <span className={`px-3 py-1 rounded-full text-sm border ${getStatusColor(selectedCliente.status)}`}>
                          {selectedCliente.status === 'ativo' && <CheckCircle className="w-4 h-4 inline mr-1" />}
                          {selectedCliente.status === 'pendente' && <Clock className="w-4 h-4 inline mr-1" />}
                          {selectedCliente.status === 'inativo' && <XCircle className="w-4 h-4 inline mr-1" />}
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
                            <Mail className="w-5 h-5 text-purple-400" />
                            <span className="truncate">{selectedCliente.email || 'Nao informado'}</span>
                          </div>
                        </div>
                        <div className={`${GLASS_CARD_INNER} p-4 md:col-span-2`}>
                          <div className="flex items-start gap-3 text-slate-300">
                            <MapPin className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                            <div>
                              <span>{selectedCliente.endereco || 'Nao informado'}</span>
                              {selectedCliente.cidade && (
                                <span className="text-slate-500"> - {selectedCliente.cidade}/{selectedCliente.estado}</span>
                              )}
                              {selectedCliente.endereco && (
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedCliente.endereco + ' ' + selectedCliente.cidade)}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="ml-2 text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
                                >
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className={`${GLASS_CARD} p-4`}>
                        <p className="text-sm text-slate-400 mb-1">Total Gasto</p>
                        <p className="text-xl font-bold text-cyan-400">{formatCurrency(selectedCliente.totalGasto)}</p>
                      </div>
                      <div className={`${GLASS_CARD} p-4`}>
                        <p className="text-sm text-slate-400 mb-1">Ticket Medio</p>
                        <p className="text-xl font-bold text-purple-400">{formatCurrency(selectedCliente.ticketMedio)}</p>
                      </div>
                      <div className={`${GLASS_CARD} p-4`}>
                        <p className="text-sm text-slate-400 mb-1">Total Compras</p>
                        <p className="text-xl font-bold text-white">{selectedCliente.totalCompras}</p>
                      </div>
                      <div className={`${GLASS_CARD} p-4`}>
                        <p className="text-sm text-slate-400 mb-1">Desconto Medio</p>
                        <p className={`text-xl font-bold ${selectedCliente.descontoMedio > 10 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {selectedCliente.descontoMedio.toFixed(1)}%
                        </p>
                      </div>
                    </div>

                    <div className={`${GLASS_CARD} p-6`}>
                      <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <ShoppingCart className="w-5 h-5 text-amber-400" />
                        Top 5 Pecas Mais Compradas
                      </h4>
                      {selectedCliente.pecasMaisCompradas.length > 0 ? (
                        <div className="space-y-3">
                          {selectedCliente.pecasMaisCompradas.map((peca, idx) => (
                            <div key={idx} className={`${GLASS_CARD_INNER} p-4 flex items-center justify-between`}>
                              <div className="flex items-center gap-3">
                                <span className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
                                  {idx + 1}
                                </span>
                                <div>
                                  <p className="font-medium text-white">{peca.descricao}</p>
                                  <p className="text-sm text-slate-500">{peca.pn}</p>
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
                          <p>Sem historico de pecas</p>
                        </div>
                      )}
                    </div>
                  </>
                ) : (
                  <div className={`${GLASS_CARD} p-12 flex flex-col items-center justify-center min-h-[400px]`}>
                    <Users className="w-16 h-16 text-slate-600 mb-4" />
                    <h3 className="text-xl font-semibold text-slate-400 mb-2">Selecione um Cliente</h3>
                    <p className="text-slate-500 text-center max-w-sm">
                      Clique em um cliente na lista ao lado para ver os detalhes completos do perfil e historico de compras.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'vendedores' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className={`${GLASS_CARD} p-6`}>
              <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-400" />
                Ranking de Vendedores
              </h3>
              <div className="space-y-3">
                {vendedores.map((vendedor, idx) => (
                  <div
                    key={vendedor.id}
                    onClick={() => setSelectedVendedor(selectedVendedor === vendedor.id ? null : vendedor.id)}
                    className={`p-4 rounded-xl cursor-pointer transition-all ${
                      selectedVendedor === vendedor.id
                        ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 border border-amber-500/40'
                        : 'bg-slate-800/40 border border-slate-700/50 hover:border-slate-600'
                    }`}
                  >
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
                        <p className="text-lg font-bold text-cyan-400">{formatCurrency(vendedor.faturamentoTotal)}</p>
                        <p className="text-sm text-slate-500">{vendedor.totalVendas} vendas</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-700/50 grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-slate-500">Ticket Medio</p>
                        <p className="text-sm font-semibold text-purple-400">{formatCurrency(vendedor.ticketMedio)}</p>
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
                    <p>Nenhum vendedor encontrado</p>
                  </div>
                )}
              </div>
            </div>

            <div className={`${GLASS_CARD} p-6`}>
              <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
                Comparativo de Performance
              </h3>
              <div className="h-[400px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={vendedores.slice(0, 6)} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis type="number" stroke="#64748B" tickFormatter={(v) => `R$ ${(v/1000).toFixed(0)}k`} />
                    <YAxis type="category" dataKey="nome" stroke="#64748B" width={100} tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #06B6D4', borderRadius: '12px' }}
                      formatter={(value: number, name: string) => [
                        formatCurrency(value),
                        name === 'faturamentoTotal' ? 'Faturamento' : 'Ticket Medio'
                      ]}
                    />
                    <Legend />
                    <Bar dataKey="faturamentoTotal" name="Faturamento" fill="#06B6D4" radius={[0, 4, 4, 0]} />
                    <Bar dataKey="ticketMedio" name="Ticket Medio" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'produtos' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className={`${GLASS_CARD} p-6`}>
              <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                <Package className="w-5 h-5 text-emerald-400" />
                Pecas Mais Vendidas
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
                          <p className="text-sm text-slate-500">{peca.pn}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0 ml-4">
                        <p className="text-cyan-400 font-semibold">{peca.quantidade}x</p>
                        <p className="text-sm text-slate-500">{formatCurrency(peca.valorTotal)}</p>
                      </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-slate-700/30 flex items-center justify-between">
                      <span className="text-xs text-slate-500">Valor Medio: {formatCurrency(peca.valorMedio)}</span>
                      <span className={`text-xs ${getMarginColor(peca.margemMedia)}`}>
                        Margem: {peca.margemMedia.toFixed(1)}%
                      </span>
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
                <BarChart3 className="w-5 h-5 text-purple-400" />
                Volume por Produto
              </h3>
              <div className="h-[450px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pecasPopulares.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="pn" stroke="#64748B" tick={{ fontSize: 10 }} angle={-45} textAnchor="end" height={80} />
                    <YAxis stroke="#64748B" />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#1E293B', border: '1px solid #8B5CF6', borderRadius: '12px' }}
                      formatter={(value: number, name: string) => [
                        name === 'quantidade' ? `${value} unidades` : formatCurrency(value),
                        name === 'quantidade' ? 'Quantidade' : 'Valor Total'
                      ]}
                    />
                    <Legend />
                    <Bar dataKey="quantidade" name="Quantidade" fill="#10B981" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="valorTotal" name="Valor Total" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(30, 41, 59, 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(6, 182, 212, 0.3);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(6, 182, 212, 0.5);
        }
      `}</style>
    </div>
  );
}
