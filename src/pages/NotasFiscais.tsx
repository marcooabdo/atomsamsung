import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { UnitFilter } from '../components/UnitFilter';
import { EmitirNFSeModal } from '../components/EmitirNFSeModal';
import {
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  DollarSign,
  Package,
  Filter,
  Download,
  Eye,
  Calendar,
  TrendingUp,
  Building2,
  Search,
  RefreshCw,
  Loader2,
  Receipt
} from 'lucide-react';

interface NotaFiscal {
  id: string;
  tipo: 'nfse' | 'nfe';
  provedor: string | null;
  numero: string | null;
  serie: string | null;
  chave_acesso: string | null;
  valor_servicos: number;
  valor_produtos: number;
  valor_total: number;
  valor_retencoes: number;
  status: 'pendente' | 'processando' | 'emitida' | 'cancelada' | 'erro';
  data_emissao: string | null;
  tomador_nome: string | null;
  tomador_documento: string | null;
  tomador_endereco: string | null;
  tomador_telefone: string | null;
  tomador_email: string | null;
  tomador_logradouro: string | null;
  tomador_numero: string | null;
  tomador_bairro: string | null;
  tomador_cep: string | null;
  tomador_cidade_ibge: string | null;
  protocolo: string | null;
  pdf_url: string | null;
  xml_url: string | null;
  erro_mensagem: string | null;
  observacoes: string | null;
  observacao_final: string | null;
  tentativas: number | null;
  payload_json: any;
  created_at: string;
  os_id?: string | null;
  os?: {
    numero_os_samsung: string | null;
    numero_os_interna: string | null;
    tipo_os: string | null;
  };
  unidade?: {
    id: string;
    nome: string;
  };
  emitido_por_usuario?: {
    nome: string;
  };
}

interface Stats {
  total_emitidas: number;
  total_pendentes: number;
  total_erro: number;
  total_canceladas: number;
  valor_total_emitidas: number;
  valor_total_mes: number;
  quantidade_mes: number;
}

const getStorageUrl = (path: string | null): string | null => {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  return `${supabaseUrl}/storage/v1/object/public/nf-emitidas/${cleanPath}`;
};

export function NotasFiscais() {
  const { user, usuario, allUserUnits } = useAuth();
  const canSeeAllUnits = (usuario?.tipo === 'master' || usuario?.tipo === 'diretoria') && !usuario?.unidade_id;
  const [loading, setLoading] = useState(true);
  const [notasFiscais, setNotasFiscais] = useState<NotaFiscal[]>([]);
  const [filteredNotas, setFilteredNotas] = useState<NotaFiscal[]>([]);

  // Filtros
  const [tipoFiltro, setTipoFiltro] = useState<'todos' | 'nfse' | 'nfe'>('todos');
  const [tipoOsFiltro, setTipoOsFiltro] = useState<'todos' | 'LP' | 'OW'>('todos');
  const [statusFiltro, setStatusFiltro] = useState<string>('todos');
  const [selectedUnidade, setSelectedUnidade] = useState<string>(
    !canSeeAllUnits && allUserUnits.length <= 1 && usuario?.unidade_id ? usuario.unidade_id : ''
  );
  const [periodoFiltro, setPeriodoFiltro] = useState<'mes' | 'trimestre' | 'ano' | 'todos'>('todos');
  const [searchTerm, setSearchTerm] = useState('');

  // Estatísticas
  const [statsNFSe, setStatsNFSe] = useState<Stats>({
    total_emitidas: 0,
    total_pendentes: 0,
    total_erro: 0,
    total_canceladas: 0,
    valor_total_emitidas: 0,
    valor_total_mes: 0,
    quantidade_mes: 0
  });

  const [statsNFe, setStatsNFe] = useState<Stats>({
    total_emitidas: 0,
    total_pendentes: 0,
    total_erro: 0,
    total_canceladas: 0,
    valor_total_emitidas: 0,
    valor_total_mes: 0,
    quantidade_mes: 0
  });

  const [unidades, setUnidades] = useState<any[]>([]);
  const [notaDetalhes, setNotaDetalhes] = useState<NotaFiscal | null>(null);
  const [showRetryModal, setShowRetryModal] = useState(false);
  const [retryNota, setRetryNota] = useState<NotaFiscal | null>(null);
  const [emittingId, setEmittingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ tipo: 'success' | 'error'; texto: string } | null>(null);
  const [showPayload, setShowPayload] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  };

  useEffect(() => {
    loadData();
  }, [user]);

  useEffect(() => {
    aplicarFiltros();
  }, [notasFiscais, tipoFiltro, tipoOsFiltro, statusFiltro, selectedUnidade, periodoFiltro, searchTerm]);

  const loadData = async () => {
    if (!user) return;

    try {
      setLoading(true);

      // Carregar unidades
      const { data: unidadesData } = await supabase
        .from('unidades')
        .select('id, nome')
        .order('nome');

      setUnidades(unidadesData || []);

      // Carregar notas fiscais
      let nfsQuery = supabase
        .from('nf_emitidas')
        .select(`
          *,
          os(numero_os_samsung, numero_os_interna, tipo_os),
          unidade:unidades(id, nome),
          emitido_por_usuario:usuarios!nf_emitidas_emitido_por_fkey(nome)
        `)
        .order('created_at', { ascending: false });

      if (!canSeeAllUnits) {
        if (selectedUnidade) {
          nfsQuery = nfsQuery.eq('unidade_id', selectedUnidade);
        } else if (allUserUnits.length > 1) {
          nfsQuery = nfsQuery.in('unidade_id', allUserUnits);
        } else if (usuario?.unidade_id) {
          nfsQuery = nfsQuery.eq('unidade_id', usuario.unidade_id);
        }
      }

      const { data: nfsData, error } = await nfsQuery;

      if (error) throw error;

      setNotasFiscais(nfsData || []);
      calcularEstatisticas(nfsData || []);
    } catch (error) {
      // ignored
    } finally {
      setLoading(false);
    }
  };

  const calcularEstatisticas = (notas: NotaFiscal[]) => {
    const hoje = new Date();
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);

    const nfseStats: Stats = {
      total_emitidas: 0,
      total_pendentes: 0,
      total_erro: 0,
      total_canceladas: 0,
      valor_total_emitidas: 0,
      valor_total_mes: 0,
      quantidade_mes: 0
    };

    const nfeStats: Stats = {
      total_emitidas: 0,
      total_pendentes: 0,
      total_erro: 0,
      total_canceladas: 0,
      valor_total_emitidas: 0,
      valor_total_mes: 0,
      quantidade_mes: 0
    };

    notas.forEach(nota => {
      const stats = nota.tipo === 'nfse' ? nfseStats : nfeStats;

      if (nota.status === 'emitida') {
        stats.total_emitidas++;
        stats.valor_total_emitidas += nota.valor_total;

        if (nota.data_emissao && new Date(nota.data_emissao) >= inicioMes) {
          stats.valor_total_mes += nota.valor_total;
          stats.quantidade_mes++;
        }
      } else if (nota.status === 'pendente' || nota.status === 'processando') {
        stats.total_pendentes++;
      } else if (nota.status === 'erro') {
        stats.total_erro++;
      } else if (nota.status === 'cancelada') {
        stats.total_canceladas++;
      }
    });

    setStatsNFSe(nfseStats);
    setStatsNFe(nfeStats);
  };

  const showToast = (tipo: 'success' | 'error', texto: string) => {
    setToast({ tipo, texto });
    setTimeout(() => setToast(null), 4000);
  };

  const dispatchNFe = async (nfId: string) => {
    const { data, error } = await supabase.functions.invoke('emit-nfe', {
      body: { nfe_id: nfId }
    });
    if (error) throw new Error(error.message || 'Erro ao acionar servidor de emissao');
    if (data && !data.success) throw new Error(data?.data?.message || data?.data?.error || `Erro HTTP ${data.status}`);
    return data;
  };

  const dispatchNFSe = async (nfId: string) => {
    const response = await fetch('https://bot-post-products.groupglobal.com.br/api/nuvemFiscal/nfse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nfse_id: nfId })
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err?.message || err?.error || `Erro HTTP ${response.status}`);
    }
    return response.json();
  };

  const handleRetry = async (nf: NotaFiscal) => {
    if (nf.tipo === 'nfse') {
      try {
        const { error } = await supabase
          .from('nf_emitidas')
          .update({ status: 'pendente' })
          .eq('id', nf.id);

        if (error) throw error;

        setRetryNota({ ...nf, status: 'pendente' });
        setShowRetryModal(true);
        setNotaDetalhes(null);
      } catch (error) {
        // ignored
      }
      return;
    }

    // NFe: atualiza status e dispara endpoint diretamente
    try {
      setEmittingId(nf.id);
      setNotaDetalhes(null);

      const { error } = await supabase
        .from('nf_emitidas')
        .update({ status: 'pendente', erro_mensagem: null })
        .eq('id', nf.id);

      if (error) throw error;

      await dispatchNFe(nf.id);
      showToast('success', 'Emissao iniciada');
      loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Erro ao reenviar NF-e');
    } finally {
      setEmittingId(null);
    }
  };

  const aplicarFiltros = () => {
    let filtered = [...notasFiscais];

    // Filtro de tipo de NF
    if (tipoFiltro !== 'todos') {
      filtered = filtered.filter(nf => nf.tipo === tipoFiltro);
    }

    // Filtro de tipo de OS (LP/OW)
    if (tipoOsFiltro !== 'todos') {
      filtered = filtered.filter(nf => nf.os?.tipo_os === tipoOsFiltro);
    }

    // Filtro de status
    if (statusFiltro !== 'todos') {
      filtered = filtered.filter(nf => nf.status === statusFiltro);
    }

    // Filtro de unidade
    if (selectedUnidade) {
      filtered = filtered.filter(nf => nf.unidade?.id === selectedUnidade);
    }

    // Filtro de período
    if (periodoFiltro !== 'todos') {
      const hoje = new Date();
      let dataInicio: Date;

      switch (periodoFiltro) {
        case 'mes':
          dataInicio = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
          break;
        case 'trimestre':
          dataInicio = new Date(hoje.getFullYear(), hoje.getMonth() - 3, 1);
          break;
        case 'ano':
          dataInicio = new Date(hoje.getFullYear(), 0, 1);
          break;
        default:
          dataInicio = new Date(0);
      }

      filtered = filtered.filter(nf => new Date(nf.created_at) >= dataInicio);
    }

    // Busca por termo
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(nf =>
        nf.numero?.toLowerCase().includes(term) ||
        nf.chave_acesso?.toLowerCase().includes(term) ||
        nf.tomador_nome?.toLowerCase().includes(term) ||
        nf.tomador_documento?.toLowerCase().includes(term) ||
        nf.os?.numero_os_samsung?.toLowerCase().includes(term) ||
        nf.os?.numero_os_interna?.toLowerCase().includes(term)
      );
    }

    setFilteredNotas(filtered);
  };

  const getStatusBadge = (status: string) => {
    const configs = {
      emitida: {
        bg: '#39FF1410',
        border: '#39FF1460',
        color: '#39FF14',
        icon: CheckCircle,
        label: 'EMITIDA'
      },
      pendente: {
        bg: '#FFBF0010',
        border: '#FFBF0060',
        color: '#FFBF00',
        icon: Clock,
        label: 'PENDENTE'
      },
      processando: {
        bg: '#00D4FF10',
        border: 'rgba(var(--accent-rgb), 0.38)',
        color: 'var(--text-accent)',
        icon: Clock,
        label: 'PROCESSANDO'
      },
      erro: {
        bg: '#FF006410',
        border: '#FF006460',
        color: '#FF0064',
        icon: XCircle,
        label: 'ERRO'
      },
      cancelada: {
        bg: '#71717A10',
        border: '#71717A60',
        color: '#71717A',
        icon: XCircle,
        label: 'CANCELADA'
      }
    };

    const config = configs[status as keyof typeof configs] || configs.pendente;
    const Icon = config.icon;

    return (
      <span
        className="px-2 py-1 rounded-full text-xs font-bold flex items-center gap-1 w-fit"
        style={{
          backgroundColor: config.bg,
          border: `1px solid ${config.border}`,
          color: config.color
        }}
      >
        <Icon className="w-3 h-3" />
        {config.label}
      </span>
    );
  };

  const getTipoBadge = (tipo: string) => {
    return (
      <span
        className="px-2 py-1 rounded text-xs font-bold"
        style={{
          backgroundColor: tipo === 'nfse' ? '#9333EA20' : '#3B82F620',
          border: `1px solid ${tipo === 'nfse' ? '#9333EA' : '#3B82F6'}`,
          color: tipo === 'nfse' ? '#9333EA' : '#3B82F6'
        }}
      >
        {tipo === 'nfse' ? 'NFS-e' : 'NF-e'}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00D4FF] mx-auto mb-4"></div>
          <p className="text-gray-400">Carregando notas fiscais...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* Filtro de Unidade */}
      {(canSeeAllUnits || allUserUnits.length > 1) && (
        <UnitFilter
          unidades={canSeeAllUnits ? unidades : unidades.filter(u => allUserUnits.includes(u.id))}
          selectedUnidade={selectedUnidade}
          onUnidadeChange={setSelectedUnidade}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#00D4FF] flex items-center gap-3">
            <FileText className="w-8 h-8" />
            Gerenciamento de Notas Fiscais
          </h1>
          <p className="text-gray-400 mt-1">
            Visualize e gerencie todas as NFS-e e NF-e emitidas
          </p>
        </div>
      </div>

      {/* Dashboard de Estatísticas */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Estatísticas NFS-e */}
        <div className="premium-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-[#9333EA] flex items-center gap-2">
              <FileText className="w-5 h-5" />
              NFS-e - Notas de Serviço
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#39FF1410] border border-[#39FF1460] rounded-lg p-4">
              <p className="text-xs text-gray-400 uppercase mb-1">Emitidas</p>
              <p className="text-2xl font-bold text-[#39FF14]">{statsNFSe.total_emitidas}</p>
              <p className="text-xs text-gray-500 mt-1">
                R$ {statsNFSe.valor_total_emitidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="bg-[#FFBF0010] border border-[#FFBF0060] rounded-lg p-4">
              <p className="text-xs text-gray-400 uppercase mb-1">Pendentes</p>
              <p className="text-2xl font-bold text-[#FFBF00]">{statsNFSe.total_pendentes}</p>
            </div>

            <div className="bg-[#FF006410] border border-[#FF006460] rounded-lg p-4">
              <p className="text-xs text-gray-400 uppercase mb-1">Erro</p>
              <p className="text-2xl font-bold text-[#FF0064]">{statsNFSe.total_erro}</p>
            </div>

            <div className="bg-[#71717A10] border border-[#71717A60] rounded-lg p-4">
              <p className="text-xs text-gray-400 uppercase mb-1">Canceladas</p>
              <p className="text-2xl font-bold text-[#71717A]">{statsNFSe.total_canceladas}</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[#9333EA]/20">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Total no mês:</span>
              <div className="text-right">
                <p className="text-lg font-bold text-[#9333EA]">
                  R$ {statsNFSe.valor_total_mes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-500">{statsNFSe.quantidade_mes} notas</p>
              </div>
            </div>
          </div>
        </div>

        {/* Estatísticas NF-e */}
        <div className="premium-card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-[#3B82F6] flex items-center gap-2">
              <Package className="w-5 h-5" />
              NF-e - Notas de Produto
            </h2>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[#39FF1410] border border-[#39FF1460] rounded-lg p-4">
              <p className="text-xs text-gray-400 uppercase mb-1">Emitidas</p>
              <p className="text-2xl font-bold text-[#39FF14]">{statsNFe.total_emitidas}</p>
              <p className="text-xs text-gray-500 mt-1">
                R$ {statsNFe.valor_total_emitidas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>

            <div className="bg-[#FFBF0010] border border-[#FFBF0060] rounded-lg p-4">
              <p className="text-xs text-gray-400 uppercase mb-1">Pendentes</p>
              <p className="text-2xl font-bold text-[#FFBF00]">{statsNFe.total_pendentes}</p>
            </div>

            <div className="bg-[#FF006410] border border-[#FF006460] rounded-lg p-4">
              <p className="text-xs text-gray-400 uppercase mb-1">Erro</p>
              <p className="text-2xl font-bold text-[#FF0064]">{statsNFe.total_erro}</p>
            </div>

            <div className="bg-[#71717A10] border border-[#71717A60] rounded-lg p-4">
              <p className="text-xs text-gray-400 uppercase mb-1">Canceladas</p>
              <p className="text-2xl font-bold text-[#71717A]">{statsNFe.total_canceladas}</p>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-[#3B82F6]/20">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-400">Total no mês:</span>
              <div className="text-right">
                <p className="text-lg font-bold text-[#3B82F6]">
                  R$ {statsNFe.valor_total_mes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-500">{statsNFe.quantidade_mes} notas</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="premium-card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-[#00D4FF]" />
          <h3 className="text-lg font-bold text-[#00D4FF]">Filtros</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4">
          {/* Busca */}
          <div className="lg:col-span-2">
            <label className="block text-xs text-gray-400 mb-2">Buscar</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Numero, chave, tomador, OS..."
                className="neon-input w-full pl-10"
              />
            </div>
          </div>

          {/* Tipo de NF */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">Tipo de NF</label>
            <select
              value={tipoFiltro}
              onChange={(e) => setTipoFiltro(e.target.value as any)}
              className="neon-input w-full"
            >
              <option value="todos">Todas</option>
              <option value="nfse">NFS-e</option>
              <option value="nfe">NF-e</option>
            </select>
          </div>

          {/* Tipo de OS */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">Tipo de OS</label>
            <select
              value={tipoOsFiltro}
              onChange={(e) => setTipoOsFiltro(e.target.value as any)}
              className="neon-input w-full"
            >
              <option value="todos">Todas</option>
              <option value="LP">LP (Garantia)</option>
              <option value="OW">OW (Fora Garantia)</option>
            </select>
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">Status</label>
            <select
              value={statusFiltro}
              onChange={(e) => setStatusFiltro(e.target.value)}
              className="neon-input w-full"
            >
              <option value="todos">Todos</option>
              <option value="emitida">Emitida</option>
              <option value="pendente">Pendente</option>
              <option value="processando">Processando</option>
              <option value="erro">Erro</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>

          {/* Periodo */}
          <div>
            <label className="block text-xs text-gray-400 mb-2">Periodo</label>
            <select
              value={periodoFiltro}
              onChange={(e) => setPeriodoFiltro(e.target.value as any)}
              className="neon-input w-full"
            >
              <option value="mes">Este mês</option>
              <option value="trimestre">Último trimestre</option>
              <option value="ano">Este ano</option>
              <option value="todos">Todos</option>
            </select>
          </div>
        </div>

        <div className="mt-4 text-sm text-gray-400">
          Exibindo {filteredNotas.length} de {notasFiscais.length} notas fiscais
        </div>
      </div>

      {/* Lista de Notas Fiscais */}
      <div className="premium-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[#00D4FF] flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Notas Fiscais ({filteredNotas.length})
          </h3>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all"
            style={{
              backgroundColor: 'rgba(0, 212, 255, 0.1)',
              border: '1px solid rgba(0, 212, 255, 0.4)',
              color: '#00D4FF',
              opacity: refreshing ? 0.6 : 1
            }}
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Atualizando...' : 'Atualizar'}
          </button>
        </div>

        <div className="space-y-3">
          {filteredNotas.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Nenhuma nota fiscal encontrada</p>
            </div>
          ) : (
            filteredNotas.map(nf => (
              <div key={nf.id} className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 hover:border-[#00D4FF]/50 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      {getTipoBadge(nf.tipo)}
                      {getStatusBadge(nf.status)}

                      {nf.numero && (
                        <span className="text-sm font-mono text-[#00D4FF]">
                          #{nf.numero}{nf.serie ? `-${nf.serie}` : ''}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
                      {/* Tomador */}
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Tomador</p>
                        <p className="text-sm text-gray-200 font-medium">{nf.tomador_nome || 'N/A'}</p>
                        {nf.tomador_documento && (
                          <p className="text-xs text-gray-500 font-mono">{nf.tomador_documento}</p>
                        )}
                      </div>

                      {/* OS Vinculada */}
                      {nf.os && (
                        <div>
                          <p className="text-xs text-gray-500 uppercase">OS Vinculada</p>
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-gray-200 font-mono">
                              {nf.os.numero_os_samsung || nf.os.numero_os_interna || 'N/A'}
                            </p>
                            {nf.os.tipo_os && (
                              <span
                                className="px-1.5 py-0.5 rounded text-[10px] font-bold"
                                style={{
                                  backgroundColor: nf.os.tipo_os === 'LP' ? '#10B98120' : '#F9731620',
                                  border: `1px solid ${nf.os.tipo_os === 'LP' ? '#10B981' : '#F97316'}`,
                                  color: nf.os.tipo_os === 'LP' ? '#10B981' : '#F97316'
                                }}
                              >
                                {nf.os.tipo_os}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Valores */}
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Valores</p>
                        {nf.tipo === 'nfse' && nf.valor_servicos > 0 && (
                          <p className="text-sm text-gray-200">
                            Serviços: <span className="text-[#39FF14] font-bold">
                              R$ {nf.valor_servicos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </p>
                        )}
                        {nf.tipo === 'nfe' && nf.valor_produtos > 0 && (
                          <p className="text-sm text-gray-200">
                            Produtos: <span className="text-[#39FF14] font-bold">
                              R$ {nf.valor_produtos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </p>
                        )}
                        <p className="text-sm text-gray-200">
                          Total: <span className="text-[#00D4FF] font-bold">
                            R$ {nf.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </span>
                        </p>
                        {nf.valor_retencoes > 0 && (
                          <p className="text-xs text-gray-500">
                            Retenções: R$ {nf.valor_retencoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                          </p>
                        )}
                      </div>

                      {/* Data e Emitido por */}
                      <div>
                        <p className="text-xs text-gray-500 uppercase">Emissão</p>
                        {nf.data_emissao ? (
                          <p className="text-sm text-gray-200">
                            {new Date(nf.data_emissao).toLocaleDateString('pt-BR')}
                          </p>
                        ) : (
                          <p className="text-sm text-gray-500">Aguardando</p>
                        )}
                        {nf.emitido_por_usuario && (
                          <p className="text-xs text-gray-500">por {nf.emitido_por_usuario.nome}</p>
                        )}
                        {nf.unidade && (
                          <p className="text-xs text-gray-500">{nf.unidade.nome}</p>
                        )}
                      </div>
                    </div>

                    {/* Protocolo e Chave de Acesso */}
                    {(nf.protocolo || nf.chave_acesso) && (
                      <div className="mt-3 pt-3 border-t border-gray-700 grid grid-cols-1 md:grid-cols-2 gap-3">
                        {nf.protocolo && (
                          <div>
                            <p className="text-xs text-gray-500">Protocolo:</p>
                            <p className="text-xs text-gray-300 font-mono">{nf.protocolo}</p>
                          </div>
                        )}
                        {nf.chave_acesso && (
                          <div>
                            <p className="text-xs text-gray-500">Chave de Acesso:</p>
                            <p className="text-xs text-gray-300 font-mono break-all">{nf.chave_acesso}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Mensagem de erro */}
                    {nf.status === 'erro' && (
                      <div className="mt-3 p-3 rounded-lg" style={{ backgroundColor: '#FF006415', border: '1px solid #FF006450' }}>
                        <div className="flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#FF0064' }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold mb-1" style={{ color: '#FF0064' }}>Erro na emissao:</p>
                            <p className="text-xs break-words" style={{ color: '#E5E7EB' }}>
                              {nf.erro_mensagem || 'Falha ao processar a nota fiscal. Verifique os dados e tente novamente.'}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {(nf.observacao_final || nf.observacoes) && (
                      <div className="mt-3 text-xs text-gray-400">
                        <span className="font-bold">Obs:</span> {nf.observacao_final || nf.observacoes}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => setNotaDetalhes(nf)}
                      className="neon-button p-2"
                      style={{
                        backgroundColor: 'rgba(var(--accent-rgb), 0.125)',
                        borderColor: 'var(--text-accent)',
                        color: 'var(--text-accent)'
                      }}
                      title="Ver detalhes"
                    >
                      <Eye className="w-4 h-4" />
                    </button>

                    {(nf.status === 'erro' || nf.status === 'pendente') && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRetry(nf);
                        }}
                        disabled={emittingId === nf.id}
                        className="neon-button p-2"
                        style={{
                          backgroundColor: nf.status === 'erro' ? '#FFBF0020' : '#00D4FF20',
                          borderColor: nf.status === 'erro' ? '#FFBF00' : '#00D4FF',
                          color: nf.status === 'erro' ? '#FFBF00' : '#00D4FF',
                          opacity: emittingId === nf.id ? 0.6 : 1
                        }}
                        title={nf.status === 'erro' ? 'Tentar novamente' : 'Reenviar'}
                      >
                        <RefreshCw className={`w-4 h-4 ${emittingId === nf.id ? 'animate-spin' : ''}`} />
                      </button>
                    )}

                    {nf.pdf_url && (
                      <a
                        href={getStorageUrl(nf.pdf_url) || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="neon-button p-2"
                        style={{
                          backgroundColor: '#39FF1420',
                          borderColor: '#39FF14',
                          color: '#39FF14'
                        }}
                        title="Download PDF"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    )}

                    {nf.xml_url && (
                      <a
                        href={getStorageUrl(nf.xml_url) || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="neon-button p-2"
                        style={{
                          backgroundColor: '#FFBF0020',
                          borderColor: '#FFBF00',
                          color: '#FFBF00'
                        }}
                        title="Download XML"
                      >
                        <FileText className="w-4 h-4" />
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Modal de Detalhes */}
      {notaDetalhes && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="premium-card max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="border-b border-[#00D4FF]/20 p-6 flex items-center justify-between sticky top-0 bg-gray-900 z-10">
              <div>
                <h2 className="text-xl font-bold text-[#00D4FF] flex items-center gap-2">
                  <FileText className="w-6 h-6" />
                  Detalhes da Nota Fiscal
                </h2>
                <div className="flex items-center gap-2 mt-2">
                  {getTipoBadge(notaDetalhes.tipo)}
                  {getStatusBadge(notaDetalhes.status)}
                </div>
              </div>
              <button
                onClick={() => { setNotaDetalhes(null); setShowPayload(false); }}
                className="p-2 hover:bg-[#00D4FF]/10 rounded-lg transition-colors"
              >
                <XCircle className="w-5 h-5 text-[#00D4FF]" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Informações Básicas */}
              <div>
                <h3 className="text-sm font-bold text-[#00D4FF] mb-3 uppercase">Informações Básicas</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Número</p>
                    <p className="text-sm text-gray-200 font-mono">{notaDetalhes.numero || 'N/A'}</p>
                  </div>
                  {notaDetalhes.serie && (
                    <div>
                      <p className="text-xs text-gray-500">Série</p>
                      <p className="text-sm text-gray-200 font-mono">{notaDetalhes.serie}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-gray-500">Data de Emissão</p>
                    <p className="text-sm text-gray-200">
                      {notaDetalhes.data_emissao
                        ? new Date(notaDetalhes.data_emissao).toLocaleString('pt-BR')
                        : 'Aguardando'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Data de Criação</p>
                    <p className="text-sm text-gray-200">
                      {new Date(notaDetalhes.created_at).toLocaleString('pt-BR')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Tomador */}
              <div>
                <h3 className="text-sm font-bold text-[#00D4FF] mb-3 uppercase">Tomador</h3>
                <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                  <p className="text-sm text-gray-200 font-medium mb-1">
                    {notaDetalhes.tomador_nome || 'N/A'}
                  </p>
                  {notaDetalhes.tomador_documento && (
                    <p className="text-xs text-gray-400 font-mono">{notaDetalhes.tomador_documento}</p>
                  )}
                  {notaDetalhes.tomador_endereco && (
                    <p className="text-xs text-gray-400 mt-2">{notaDetalhes.tomador_endereco}</p>
                  )}
                </div>
              </div>

              {/* Valores */}
              <div>
                <h3 className="text-sm font-bold text-[#00D4FF] mb-3 uppercase">Valores</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {notaDetalhes.valor_servicos > 0 && (
                    <div className="bg-[#9333EA10] border border-[#9333EA60] rounded-lg p-4">
                      <p className="text-xs text-gray-400 mb-1">Serviços</p>
                      <p className="text-lg font-bold text-[#9333EA]">
                        R$ {notaDetalhes.valor_servicos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}
                  {notaDetalhes.valor_produtos > 0 && (
                    <div className="bg-[#3B82F610] border border-[#3B82F660] rounded-lg p-4">
                      <p className="text-xs text-gray-400 mb-1">Produtos</p>
                      <p className="text-lg font-bold text-[#3B82F6]">
                        R$ {notaDetalhes.valor_produtos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}
                  {notaDetalhes.valor_retencoes > 0 && (
                    <div className="bg-[#FF006410] border border-[#FF006460] rounded-lg p-4">
                      <p className="text-xs text-gray-400 mb-1">Retenções</p>
                      <p className="text-lg font-bold text-[#FF0064]">
                        R$ {notaDetalhes.valor_retencoes.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                    </div>
                  )}
                  <div className="bg-[#39FF1410] border border-[#39FF1460] rounded-lg p-4">
                    <p className="text-xs text-gray-400 mb-1">Total</p>
                    <p className="text-lg font-bold text-[#39FF14]">
                      R$ {notaDetalhes.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                </div>
              </div>

              {/* Protocolo e Chave */}
              {(notaDetalhes.protocolo || notaDetalhes.chave_acesso) && (
                <div>
                  <h3 className="text-sm font-bold text-[#00D4FF] mb-3 uppercase">Autenticação</h3>
                  <div className="space-y-3">
                    {notaDetalhes.protocolo && (
                      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                        <p className="text-xs text-gray-500 mb-1">Protocolo</p>
                        <p className="text-sm text-gray-200 font-mono">{notaDetalhes.protocolo}</p>
                      </div>
                    )}
                    {notaDetalhes.chave_acesso && (
                      <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4">
                        <p className="text-xs text-gray-500 mb-1">Chave de Acesso</p>
                        <p className="text-sm text-gray-200 font-mono break-all">{notaDetalhes.chave_acesso}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {(notaDetalhes.observacao_final || notaDetalhes.observacoes || notaDetalhes.status === 'erro') && (
                <div>
                  <h3 className="text-sm font-bold text-[#00D4FF] mb-3 uppercase">Observacoes</h3>
                  {(notaDetalhes.observacao_final || notaDetalhes.observacoes) && (
                    <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-3">
                      <p className="text-sm text-gray-300 whitespace-pre-wrap">{notaDetalhes.observacao_final || notaDetalhes.observacoes}</p>
                    </div>
                  )}
                  {notaDetalhes.status === 'erro' && (
                    <div className="rounded-lg p-4" style={{ backgroundColor: '#FF006415', border: '1px solid #FF006450' }}>
                      <div className="flex items-start gap-2">
                        <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#FF0064' }} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-bold mb-1" style={{ color: '#FF0064' }}>Mensagem de Erro:</p>
                          <p className="text-sm break-words" style={{ color: '#E5E7EB' }}>
                            {notaDetalhes.erro_mensagem || 'Falha ao processar a nota fiscal. Verifique os dados e tente novamente.'}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Downloads */}
              {(notaDetalhes.pdf_url || notaDetalhes.xml_url) && (
                <div>
                  <h3 className="text-sm font-bold text-[#00D4FF] mb-3 uppercase">Downloads</h3>
                  <div className="flex gap-3">
                    {notaDetalhes.pdf_url && (
                      <a
                        href={getStorageUrl(notaDetalhes.pdf_url) || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="neon-button px-4 py-2 flex items-center gap-2"
                        style={{
                          backgroundColor: '#39FF1420',
                          borderColor: '#39FF14',
                          color: '#39FF14'
                        }}
                      >
                        <Download className="w-4 h-4" />
                        Download PDF
                      </a>
                    )}
                    {notaDetalhes.xml_url && (
                      <a
                        href={getStorageUrl(notaDetalhes.xml_url) || '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="neon-button px-4 py-2 flex items-center gap-2"
                        style={{
                          backgroundColor: '#FFBF0020',
                          borderColor: '#FFBF00',
                          color: '#FFBF00'
                        }}
                      >
                        <FileText className="w-4 h-4" />
                        Download XML
                      </a>
                    )}
                  </div>
                </div>
              )}

              {notaDetalhes.tentativas && notaDetalhes.tentativas > 0 && (
                <div className="text-xs text-gray-500">
                  Tentativas de emissao: {notaDetalhes.tentativas}
                </div>
              )}

              {/* Payload JSON */}
              {notaDetalhes.payload_json && (
                <div>
                  <button
                    onClick={() => setShowPayload(v => !v)}
                    className="flex items-center gap-2 w-full text-left group"
                  >
                    <h3 className="text-sm font-bold text-[#00D4FF] uppercase">Payload JSON</h3>
                    <span
                      className="text-xs px-2 py-0.5 rounded font-mono transition-colors"
                      style={{
                        backgroundColor: showPayload ? '#00D4FF20' : '#ffffff10',
                        border: '1px solid',
                        borderColor: showPayload ? '#00D4FF60' : '#ffffff20',
                        color: showPayload ? '#00D4FF' : '#9CA3AF'
                      }}
                    >
                      {showPayload ? 'ocultar' : 'visualizar'}
                    </span>
                  </button>

                  {showPayload && (
                    <div className="mt-3 relative">
                      <div
                        className="rounded-lg p-4 overflow-auto max-h-80 text-xs font-mono leading-relaxed"
                        style={{ backgroundColor: '#0a0a0a', border: '1px solid #ffffff15', color: '#a3e635' }}
                      >
                        <pre className="whitespace-pre-wrap break-words">
                          {JSON.stringify(notaDetalhes.payload_json, null, 2)}
                        </pre>
                      </div>
                      <button
                        onClick={() => navigator.clipboard.writeText(JSON.stringify(notaDetalhes.payload_json, null, 2))}
                        className="absolute top-2 right-2 text-xs px-2 py-1 rounded transition-colors"
                        style={{
                          backgroundColor: '#ffffff15',
                          border: '1px solid #ffffff20',
                          color: '#9CA3AF'
                        }}
                        title="Copiar"
                      >
                        Copiar
                      </button>
                    </div>
                  )}
                </div>
              )}

              {(notaDetalhes.status === 'erro' || notaDetalhes.status === 'pendente') && (
                <div className="pt-4 border-t border-gray-700">
                  <button
                    onClick={() => handleRetry(notaDetalhes)}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all"
                    style={{
                      backgroundColor: notaDetalhes.status === 'erro' ? '#FFBF0020' : '#00D4FF20',
                      border: `2px solid ${notaDetalhes.status === 'erro' ? '#FFBF00' : '#00D4FF'}`,
                      color: notaDetalhes.status === 'erro' ? '#FFBF00' : '#00D4FF',
                      boxShadow: `0 0 15px ${notaDetalhes.status === 'erro' ? 'rgba(255,191,0,0.2)' : 'rgba(0,212,255,0.2)'}`
                    }}
                  >
                    <RefreshCw className="w-4 h-4" />
                    {notaDetalhes.status === 'erro' ? 'Tentar Novamente' : 'Reenviar'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showRetryModal && retryNota && retryNota.unidade && (
        <EmitirNFSeModal
          isOpen={showRetryModal}
          onClose={() => {
            setShowRetryModal(false);
            setRetryNota(null);
          }}
          onSuccess={() => {
            loadData();
            setShowRetryModal(false);
            setRetryNota(null);
          }}
          osId={retryNota.os_id || undefined}
          unidadeId={retryNota.unidade.id}
          clienteNome={retryNota.tomador_nome || ''}
          clienteDocumento={retryNota.tomador_documento}
          clienteTelefone={retryNota.tomador_telefone}
          clienteEmail={retryNota.tomador_email}
          clienteEndereco={retryNota.tomador_endereco}
          clienteLogradouro={retryNota.tomador_logradouro}
          clienteNumero={retryNota.tomador_numero}
          clienteBairro={retryNota.tomador_bairro}
          clienteCep={retryNota.tomador_cep}
          clienteCidadeIbge={retryNota.tomador_cidade_ibge}
          clienteMunicipio={(retryNota as any).tomador_municipio}
          clienteUF={(retryNota as any).tomador_uf}
          valorServicos={retryNota.valor_servicos || retryNota.valor_total}
          descricaoServico={(retryNota as any).payload_json?.infDPS?.serv?.cServ?.xDescServ}
          existingNfId={retryNota.id}
        />
      )}

      {toast && (
        <div
          className="fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-5 py-3 rounded-xl shadow-2xl border text-sm font-semibold animate-fade-in"
          style={{
            backgroundColor: toast.tipo === 'success' ? '#39FF1415' : '#FF006415',
            borderColor: toast.tipo === 'success' ? '#39FF1460' : '#FF006460',
            color: toast.tipo === 'success' ? '#39FF14' : '#FF0064',
            boxShadow: `0 0 20px ${toast.tipo === 'success' ? 'rgba(57,255,20,0.15)' : 'rgba(255,0,100,0.15)'}`
          }}
        >
          {toast.tipo === 'success' ? (
            <CheckCircle className="w-4 h-4 flex-shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
          )}
          {toast.texto}
        </div>
      )}
    </div>
  );
}
