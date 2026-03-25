import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Package, Eye, Printer, MapPin, Clock, AlertCircle, CheckSquare, Square, FileText, Truck, X, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import type { Database } from '../../lib/database.types';
import { LabelSelector } from './LabelSelector';
import { LabelGenerator } from './LabelGenerator';
import { LocationSelector } from './LocationSelector';
import { EmitirNFModal } from './EmitirNFModal';
import { PecaDetailsModal } from './PecaDetailsModal';

type SortField = 'id' | 'nf_date' | 'pn';
type SortDirection = 'asc' | 'desc';

type EstoquePeca = Database['public']['Tables']['estoque_pecas']['Row'] & {
  nf_data_emissao?: string;
  nf_delivery?: string;
  os_numero?: string | null;
};

interface EstoqueGeralProps {
  selectedUnidade: string;
  user: any;
}

export function EstoqueGeral({ selectedUnidade, user }: EstoqueGeralProps) {
  const [pecas, setPecas] = useState<EstoquePeca[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showArquivadas, setShowArquivadas] = useState(false);
  const [selectedPeca, setSelectedPeca] = useState<EstoquePeca | null>(null);
  const [showLabelSelector, setShowLabelSelector] = useState(false);
  const [showLabelPreview, setShowLabelPreview] = useState(false);
  const [generatedLabels, setGeneratedLabels] = useState<any[]>([]);
  const [showLocationSelector, setShowLocationSelector] = useState(false);
  const [pecaLocalizacoes, setPecaLocalizacoes] = useState<any[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const [selectedPecas, setSelectedPecas] = useState<Set<string>>(new Set());
  const [showEmitirNFModal, setShowEmitirNFModal] = useState(false);
  const [despachandoSamsung, setDespachandoSamsung] = useState(false);

  const [sortField, setSortField] = useState<SortField>('nf_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  useEffect(() => {
    loadPecas();
  }, [statusFilter, showArquivadas, selectedUnidade]);

  const loadPecas = async () => {
    try {
      const unidadeFilter = selectedUnidade || (user?.unidade_id || null);
      const canSeeAllUnits = (user?.tipo === 'master' || user?.tipo === 'diretoria') && !user?.unidade_id;

      let query = supabase
        .from('estoque_pecas')
        .select(`
          *,
          estoque_nfs(
            data_emissao,
            delivery
          ),
          estoque_etiquetas(
            id_sequencial,
            delivery
          ),
          os:os_id(
            numero_os_interna,
            numero_os_samsung
          ),
          requisicoes_pecas!peca_estoque_id(
            id,
            status,
            quantidade_requisitada,
            created_at,
            requisitado_por,
            usuarios:requisitado_por(nome)
          )
        `);

      if (canSeeAllUnits) {
        if (selectedUnidade && selectedUnidade !== '' && selectedUnidade !== 'all') {
          query = query.eq('unidade_id', selectedUnidade);
        }
      } else if (unidadeFilter) {
        query = query.eq('unidade_id', unidadeFilter);
      }

      if (!showArquivadas) {
        query = query.neq('status', 'arquivada');
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      const enrichedPecas = (data || []).map((peca: any) => ({
        ...peca,
        nf_data_emissao: peca.estoque_nfs?.data_emissao,
        nf_delivery: peca.estoque_etiquetas?.[0]?.delivery || peca.estoque_nfs?.delivery,
        os_numero: peca.os?.numero_os_samsung || peca.os?.numero_os_interna || null,
      }));

      setPecas(enrichedPecas);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleDespacharSamsung = async () => {
    if (selectedPecas.size === 0) return;
    setDespachandoSamsung(true);
    try {
      const ids = Array.from(selectedPecas);

      const { error: updateError } = await supabase
        .from('estoque_pecas')
        .update({
          status: 'devolvida_samsung',
          data_coleta_transportadora: null,
          data_retorno_credito: null,
        })
        .in('id', ids);

      if (updateError) throw updateError;

      const historicoEntries = ids.map((id) => ({
        peca_id: id,
        usuario_id: user?.id || null,
        acao: 'Despachada para Samsung',
        status_anterior: pecas.find(p => p.id === id)?.status || null,
        status_novo: 'devolvida_samsung',
        observacao: 'Peça despachada em lote para logística reversa Samsung',
      }));

      await supabase.from('estoque_historico').insert(historicoEntries);

      clearSelection();
      await loadPecas();
    } catch (error: any) {
      alert(`Erro ao despachar peças para Samsung: ${error?.message || error}`);
    } finally {
      setDespachandoSamsung(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      disponivel: { label: 'Disponível', className: 'bg-green-500/20 text-green-400 border border-green-500/30' },
      reservada: { label: 'Reservada', className: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' },
      vinculada_tecnico: { label: 'Com Técnico', className: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
      em_rota: { label: 'Em Rota', className: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
      em_uso: { label: 'Em Uso', className: 'bg-orange-500/20 text-orange-400 border border-orange-500/30' },
      usada: { label: 'Usada', className: 'bg-gray-500/20 text-gray-400 border border-gray-500/30' },
      devolucao_pendente: { label: 'Devolução Pendente', className: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' },
      devolvida_nova: { label: 'Devolvida Nova', className: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' },
      devolvida_defeito: { label: 'Devolvida c/ Defeito', className: 'bg-red-500/20 text-red-400 border border-red-500/30' },
      devolvida_samsung: { label: 'Devolvida Samsung', className: 'bg-blue-600/20 text-blue-300 border border-blue-500/30' },
      usada_upc: { label: 'Usada UPC', className: 'bg-slate-500/20 text-slate-400 border border-slate-500/30' },
      arquivada: { label: 'Arquivada', className: 'bg-gray-500/20 text-gray-500 border border-gray-500/30' }
    };

    const badge = badges[status] || badges.disponivel;

    return (
      <span className={`px-3 py-1 rounded-full text-xs font-medium ${badge.className}`}>
        {badge.label}
      </span>
    );
  };

  const getDaysFromEmission = (dataEmissao: string | undefined) => {
    if (!dataEmissao) return null;
    const emissionDate = new Date(dataEmissao);
    const today = new Date();
    const diffTime = Math.abs(today.getTime() - emissionDate.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getAgeBadge = (days: number | null) => {
    if (days === null) return null;

    let className = '';
    let label = '';

    if (days <= 30) {
      className = 'bg-green-500/20 text-green-400 border border-green-500/30';
      label = `${days}d`;
    } else if (days <= 60) {
      className = 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30';
      label = `${days}d`;
    } else if (days <= 90) {
      className = 'bg-orange-500/20 text-orange-400 border border-orange-500/30';
      label = `${days}d`;
    } else {
      className = 'bg-red-500/20 text-red-400 border border-red-500/30';
      label = `${days}d`;
    }

    return (
      <span className={`px-2 py-0.5 rounded text-xs font-medium ${className} flex items-center gap-1`}>
        <Clock className="w-3 h-3" />
        {label}
      </span>
    );
  };

  const getLogisticaReversaStyle = (peca: EstoquePeca) => {
    const LOGISTICA_REVERSA_STATUSES = ['devolvida_samsung', 'devolvida_nova', 'devolvida_defeito'];
    if (!LOGISTICA_REVERSA_STATUSES.includes(peca.status)) return { cardClass: '', indicator: null };

    if (!peca.data_coleta_transportadora) {
      return {
        cardClass: 'border-orange-500 shadow-[0_0_15px_rgba(249,115,22,0.4)] animate-pulse',
        indicator: (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-orange-500/20 border border-orange-500/40 text-orange-400 text-xs font-semibold">
            <Truck className="w-3 h-3" />
            Aguardando Coleta
          </div>
        ),
      };
    }

    if (!peca.data_retorno_credito) {
      return {
        cardClass: 'border-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)] animate-pulse',
        indicator: (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-red-500/20 border border-red-500/40 text-red-400 text-xs font-semibold">
            <AlertCircle className="w-3 h-3" />
            Aguardando Crédito GSPN
          </div>
        ),
      };
    }

    return {
      cardClass: 'border-gray-600',
      indicator: (
        <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/20 border border-green-500/40 text-green-400 text-xs font-semibold">
          <CheckSquare className="w-3 h-3" />
          Crédito Retornado
        </div>
      ),
    };
  };

  const filteredPecas = pecas.filter((peca) => {
    const term = searchTerm.toLowerCase();
    return (
      peca.pn.toLowerCase().includes(term) ||
      (peca.id_numerico && peca.id_numerico.toString().includes(searchTerm)) ||
      (peca.descricao && peca.descricao.toLowerCase().includes(term)) ||
      (peca.nf_delivery && peca.nf_delivery.toLowerCase().includes(term)) ||
      (peca.os_numero && peca.os_numero.toLowerCase().includes(term))
    );
  });

  const isElegibleForNF = (peca: EstoquePeca) => {
    const DEVOLVIDA_STATUSES = ['devolvida_nova', 'devolvida_defeito', 'devolvida_samsung'];
    if (DEVOLVIDA_STATUSES.includes(peca.status)) return false;
    if (!(peca as any).gi_postada_em) return false;
    return true;
  };

  const toggleSelectPeca = (pecaId: string) => {
    const peca = pecas.find(p => p.id === pecaId);
    if (peca && !isElegibleForNF(peca)) return;
    setSelectedPecas(prev => {
      const newSet = new Set(prev);
      if (newSet.has(pecaId)) {
        newSet.delete(pecaId);
      } else {
        newSet.add(pecaId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    const currentPagePecas = filteredPecas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
    const elegiblePecas = currentPagePecas.filter(p => isElegibleForNF(p));
    const allSelected = elegiblePecas.length > 0 && elegiblePecas.every(p => selectedPecas.has(p.id));

    if (allSelected) {
      setSelectedPecas(prev => {
        const newSet = new Set(prev);
        elegiblePecas.forEach(p => newSet.delete(p.id));
        return newSet;
      });
    } else {
      setSelectedPecas(prev => {
        const newSet = new Set(prev);
        elegiblePecas.forEach(p => newSet.add(p.id));
        return newSet;
      });
    }
  };

  const clearSelection = () => {
    setSelectedPecas(new Set());
  };

  const getSelectedPecasData = () => {
    return pecas.filter(p => selectedPecas.has(p.id));
  };

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
    setCurrentPage(1);
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return <ArrowUpDown className="w-3.5 h-3.5 opacity-40" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3.5 h-3.5" />
      : <ArrowDown className="w-3.5 h-3.5" />;
  };

  const sortedPecas = [...filteredPecas].sort((a, b) => {
    const dir = sortDirection === 'asc' ? 1 : -1;
    switch (sortField) {
      case 'id':
        return ((a.id_numerico || 0) - (b.id_numerico || 0)) * dir;
      case 'nf_date': {
        const dateA = a.nf_data_emissao ? new Date(a.nf_data_emissao).getTime() : 0;
        const dateB = b.nf_data_emissao ? new Date(b.nf_data_emissao).getTime() : 0;
        return (dateA - dateB) * dir;
      }
      case 'pn':
        return a.pn.localeCompare(b.pn) * dir;
      default:
        return 0;
    }
  });

  const currentPagePecas = sortedPecas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const allCurrentPageSelected = currentPagePecas.length > 0 && currentPagePecas.every(p => selectedPecas.has(p.id));

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00D4FF]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 md:flex-[3] relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            placeholder="Buscar por PN, ID, descrição ou OS..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="neon-input w-full pl-10 pr-4 py-2"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="neon-input px-4 py-2 md:w-48"
        >
          <option value="all">Todos os Status</option>
          <option value="disponivel">Disponível</option>
          <option value="reservada">Reservada</option>
          <option value="vinculada_tecnico">Com Técnico</option>
          <option value="em_rota">Em Rota</option>
          <option value="em_uso">Em Uso</option>
          <option value="usada">Usada</option>
          <option value="devolucao_pendente">Devolução Pendente</option>
          <option value="devolvida_nova">Devolvida Nova</option>
          <option value="devolvida_defeito">Devolvida c/ Defeito</option>
          <option value="devolvida_samsung">Devolvida Samsung</option>
          <option value="usada_upc">Usada UPC</option>
        </select>

        <label className="flex items-center gap-2 px-4 py-2 border border-gray-700 rounded-lg cursor-pointer hover:border-[#00D4FF]/50 transition whitespace-nowrap">
          <input
            type="checkbox"
            checked={showArquivadas}
            onChange={(e) => setShowArquivadas(e.target.checked)}
            className="rounded"
          />
          <span className="text-sm text-gray-300">Mostrar Arquivadas</span>
        </label>

        {selectedPecas.size > 0 && (
          <>
            <button
              onClick={handleDespacharSamsung}
              disabled={despachandoSamsung}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg, rgba(59,130,246,0.3) 0%, rgba(59,130,246,0.1) 100%)',
                border: '2px solid rgba(59,130,246,0.7)',
                color: '#60a5fa',
                boxShadow: '0 0 15px rgba(59,130,246,0.2)'
              }}
            >
              <Truck className="w-4 h-4" />
              {despachandoSamsung ? 'Despachando...' : `Despachar para Samsung (${selectedPecas.size})`}
            </button>
            <button
              onClick={() => setShowEmitirNFModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all whitespace-nowrap"
              style={{
                background: 'linear-gradient(135deg, rgba(255,165,0,0.3) 0%, rgba(255,165,0,0.1) 100%)',
                border: '2px solid rgba(255,165,0,0.7)',
                color: '#FFA500',
                boxShadow: '0 0 15px rgba(255,165,0,0.2)'
              }}
            >
              <FileText className="w-4 h-4" />
              Emitir NF ({selectedPecas.size})
            </button>
          </>
        )}
      </div>

      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 uppercase tracking-wider mr-1">Ordenar:</span>
        {([
          { field: 'id' as SortField, label: 'ID' },
          { field: 'nf_date' as SortField, label: 'Data NF' },
          { field: 'pn' as SortField, label: 'Part Number' },
        ]).map(opt => (
          <button
            key={opt.field}
            onClick={() => toggleSort(opt.field)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              sortField === opt.field
                ? 'bg-[#00D4FF]/15 text-[#00D4FF] border border-[#00D4FF]/40'
                : 'bg-gray-800/60 text-gray-400 border border-gray-700 hover:border-gray-600 hover:text-gray-300'
            }`}
          >
            {getSortIcon(opt.field)}
            {opt.label}
          </button>
        ))}
      </div>

      {selectedPecas.size > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-[#FFA500]/10 border border-[#FFA500]/30">
          <div className="flex items-center gap-3">
            <CheckSquare className="w-5 h-5 text-[#FFA500]" />
            <span className="text-sm text-[#FFA500] font-medium">
              {selectedPecas.size} {selectedPecas.size === 1 ? 'peca selecionada' : 'pecas selecionadas'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSelectAll}
              className="text-xs text-gray-300 hover:text-white px-3 py-1.5 rounded bg-gray-800 hover:bg-gray-700 transition"
            >
              {allCurrentPageSelected ? 'Desmarcar pagina' : 'Selecionar pagina'}
            </button>
            <button
              onClick={clearSelection}
              className="text-xs text-red-400 hover:text-red-300 px-3 py-1.5 rounded bg-red-500/10 hover:bg-red-500/20 transition flex items-center gap-1"
            >
              <X className="w-3 h-3" />
              Limpar selecao
            </button>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-400">
          Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, sortedPecas.length)} a {Math.min(currentPage * itemsPerPage, sortedPecas.length)} de {sortedPecas.length} pecas
        </span>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-400">Itens por página:</span>
          <select
            value={itemsPerPage}
            onChange={(e) => {
              setItemsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="neon-input px-3 py-1 text-sm"
          >
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {sortedPecas.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Package className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Nenhuma peca encontrada</p>
          </div>
        ) : (
          currentPagePecas.map((peca) => {
            const { cardClass, indicator } = getLogisticaReversaStyle(peca);
            return (
              <div
                key={peca.id}
                onClick={() => setSelectedPeca(peca)}
                className={`premium-card p-4 hover-lift relative transition-all cursor-pointer ${
                  selectedPecas.has(peca.id)
                    ? 'ring-2 ring-[#FFA500] bg-[#FFA500]/5'
                    : cardClass
                }`}
              >
                {isElegibleForNF(peca) ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleSelectPeca(peca.id); }}
                    className={`absolute top-3 right-3 p-1.5 rounded-lg transition-all z-10 ${
                      selectedPecas.has(peca.id)
                        ? 'bg-[#FFA500] text-black'
                        : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
                    }`}
                  >
                    {selectedPecas.has(peca.id) ? (
                      <CheckSquare className="w-5 h-5" />
                    ) : (
                      <Square className="w-5 h-5" />
                    )}
                  </button>
                ) : (
                  <div
                    className="absolute top-3 right-3 p-1.5 rounded-lg z-10 bg-gray-800/50 text-gray-600 cursor-not-allowed"
                    title={
                      ['devolvida_nova', 'devolvida_defeito', 'devolvida_samsung'].includes(peca.status)
                        ? 'Peça devolvida não pode ser selecionada para NF'
                        : 'GI não postado — peça não elegível para emissão de NF'
                    }
                  >
                    <Square className="w-5 h-5" />
                  </div>
                )}

                <div className="flex items-start justify-between mb-3 pr-10">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="px-2.5 py-1 bg-[#39FF14]/20 text-[#39FF14] rounded font-bold text-sm">
                        ID #{peca.id_numerico || 'N/A'}
                      </div>
                      <div className="font-mono text-base font-semibold text-[#00D4FF]">
                        {peca.pn}
                      </div>
                    </div>
                    <div className="space-y-1 mb-2">
                      {peca.nf_delivery && (
                        <div className="text-xs text-gray-400 flex items-center gap-1">
                          <Package className="w-3 h-3 text-[#00D4FF]" />
                          Delivery: <span className="text-[#00D4FF] font-bold">{peca.nf_delivery}</span>
                        </div>
                      )}
                      {peca.nf_data_emissao && (
                        <div className="text-xs text-gray-400 flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          Entrada: <span className="text-gray-300">{new Date(peca.nf_data_emissao).toLocaleDateString('pt-BR')}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {getStatusBadge(peca.status)}
                      {getAgeBadge(getDaysFromEmission(peca.nf_data_emissao))}
                      {(() => {
                        const requisicaoAprovada = (peca as any).requisicoes_pecas?.find(
                          (req: any) => req.status === 'atendida'
                        );
                        if (requisicaoAprovada) {
                          return (
                            <div
                              className="px-2 py-1 rounded-md text-[10px] font-bold uppercase flex items-center gap-1"
                              style={{
                                backgroundColor: 'rgba(var(--accent-rgb), 0.125)',
                                color: 'var(--text-accent)',
                                border: '1px solid rgba(var(--accent-rgb), 0.38)'
                              }}
                            >
                              <Package className="w-3 h-3" />
                              REQ #{requisicaoAprovada.id.slice(0, 8)}
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </div>
                  </div>
                </div>

                <p className="text-sm text-gray-300 mb-3 line-clamp-2">
                  {peca.descricao}
                </p>

                {indicator && (
                  <div className="mb-3">
                    {indicator}
                  </div>
                )}

                {(() => {
                  const requisicaoAprovada = (peca as any).requisicoes_pecas?.find(
                    (req: any) => req.status === 'atendida'
                  );
                  if (requisicaoAprovada) {
                    return (
                      <div className="mb-3 p-2 rounded-lg bg-[#00D4FF]/10 border border-[#00D4FF]/30">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-[#00D4FF] font-semibold">Requisitado em:</span>
                          <span className="text-gray-300">
                            {new Date(requisicaoAprovada.created_at).toLocaleString('pt-BR')}
                          </span>
                        </div>
                        {requisicaoAprovada.usuarios?.nome && (
                          <div className="flex items-center justify-between text-xs mt-1">
                            <span className="text-[#00D4FF] font-semibold">Por:</span>
                            <span className="text-gray-300">{requisicaoAprovada.usuarios.nome}</span>
                          </div>
                        )}
                        {requisicaoAprovada.quantidade_requisitada && (
                          <div className="flex items-center justify-between text-xs mt-1">
                            <span className="text-[#00D4FF] font-semibold">Quantidade:</span>
                            <span className="text-gray-300">{requisicaoAprovada.quantidade_requisitada}</span>
                          </div>
                        )}
                      </div>
                    );
                  }
                  return null;
                })()}

                <div className="space-y-2 text-xs text-gray-400 mb-4">
                  {peca.localizacao && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Localização:</span>
                      <span className="font-medium text-gray-300">{peca.localizacao}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-500">Valor:</span>
                    <span className="font-medium text-[#39FF14]">
                      R$ {peca.valor_com_impostos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={(e) => { e.stopPropagation(); setSelectedPeca(peca); }}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#00D4FF]/10 text-[#00D4FF] rounded-lg hover:bg-[#00D4FF]/20 transition text-sm border border-[#00D4FF]/30"
                  >
                    <Eye className="w-4 h-4" />
                    Detalhes
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {sortedPecas.length > itemsPerPage && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <button
            onClick={() => setCurrentPage(1)}
            disabled={currentPage === 1}
            className="px-3 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            «
          </button>
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="px-3 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            ‹
          </button>

          {Array.from({ length: Math.ceil(sortedPecas.length / itemsPerPage) }, (_, i) => i + 1)
            .filter(page => {
              const totalPages = Math.ceil(sortedPecas.length / itemsPerPage);
              if (totalPages <= 7) return true;
              if (page === 1 || page === totalPages) return true;
              if (Math.abs(page - currentPage) <= 1) return true;
              if (page === 2 && currentPage <= 3) return true;
              if (page === totalPages - 1 && currentPage >= totalPages - 2) return true;
              return false;
            })
            .map((page, index, array) => (
              <>
                {index > 0 && array[index - 1] !== page - 1 && (
                  <span key={`ellipsis-${page}`} className="px-2 text-gray-500">...</span>
                )}
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-2 rounded-lg transition text-sm ${
                    currentPage === page
                      ? 'bg-[#00D4FF] text-black font-bold'
                      : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                  }`}
                >
                  {page}
                </button>
              </>
            ))}

          <button
            onClick={() => setCurrentPage(p => Math.min(Math.ceil(sortedPecas.length / itemsPerPage), p + 1))}
            disabled={currentPage >= Math.ceil(sortedPecas.length / itemsPerPage)}
            className="px-3 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            ›
          </button>
          <button
            onClick={() => setCurrentPage(Math.ceil(sortedPecas.length / itemsPerPage))}
            disabled={currentPage >= Math.ceil(sortedPecas.length / itemsPerPage)}
            className="px-3 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            »
          </button>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-gray-400 mt-6">
        <span>Total: <span className="text-[#00D4FF] font-bold">{sortedPecas.length}</span> pecas</span>
        <span>Valor total: <span className="text-[#39FF14] font-bold">R$ {sortedPecas.reduce((sum, p) => sum + p.valor_com_impostos, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></span>
      </div>

      {selectedPeca && (
        <PecaDetailsModal
          peca={selectedPeca}
          onClose={() => {
            setSelectedPeca(null);
            loadPecas();
          }}
          onShowLabelSelector={() => setShowLabelSelector(true)}
          onShowLocationSelector={(localizacoes) => {
            setPecaLocalizacoes(localizacoes);
            setShowLocationSelector(true);
          }}
        />
      )}

      {showLabelSelector && selectedPeca && (
        <LabelSelector
          items={[{
            id: selectedPeca.id,
            part_number: selectedPeca.part_number,
            descricao: selectedPeca.descricao,
            quantidade: 1,
            delivery: ''
          }]}
          unidadeId={selectedPeca.unidade_id}
          onGenerate={(labels) => {
            setGeneratedLabels(labels);
            setShowLabelSelector(false);
            setShowLabelPreview(true);
          }}
          onClose={() => setShowLabelSelector(false)}
        />
      )}

      {showLabelPreview && (
        <LabelGenerator
          labels={generatedLabels}
          onClose={() => {
            setShowLabelPreview(false);
            setGeneratedLabels([]);
          }}
        />
      )}

      {showLocationSelector && selectedPeca && (
        <LocationSelector
          partNumber={selectedPeca.pn}
          currentUnidadeId={selectedPeca.unidade_id}
          onSelect={async (binId, locationText) => {
            try {
              const localizacaoAnterior = selectedPeca.localizacao || 'Sem localização';

              await supabase
                .from('estoque_pecas')
                .update({
                  bin_id: binId || null,
                  localizacao: locationText || null
                })
                .eq('id', selectedPeca.id);

              await supabase.from('estoque_historico').insert({
                peca_id: selectedPeca.id,
                usuario_id: user?.id || null,
                acao: 'Localização Atualizada',
                origem: localizacaoAnterior,
                destino: locationText || 'Sem localização',
                observacao: `Localização alterada de "${localizacaoAnterior}" para "${locationText || 'Sem localização'}"`
              });

              setSelectedPeca({ ...selectedPeca, localizacao: locationText });
              setShowLocationSelector(false);
              await loadPecas();
              alert('Localização atualizada com sucesso!');
            } catch (error) {
              alert('Erro ao atualizar localização');
            }
          }}
          onClose={() => setShowLocationSelector(false)}
        />
      )}

      {showEmitirNFModal && selectedPecas.size > 0 && (
        <EmitirNFModal
          pecas={getSelectedPecasData()}
          unidadeId={selectedUnidade || user?.unidade_id || ''}
          onClose={() => setShowEmitirNFModal(false)}
          onSuccess={() => {
            clearSelection();
            loadPecas();
          }}
        />
      )}
    </div>
  );
}
