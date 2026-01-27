import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Filter, Package, Eye, History, Printer, MapPin, Clock, AlertCircle, CheckSquare, Square, FileText, X } from 'lucide-react';
import type { Database } from '../../lib/database.types';
import { LabelSelector } from './LabelSelector';
import { LabelGenerator } from './LabelGenerator';
import { LocationSelector } from './LocationSelector';
import { EmitirNFModal } from './EmitirNFModal';
import { PecaDetailsModal } from './PecaDetailsModal';

type EstoquePeca = Database['public']['Tables']['estoque_pecas']['Row'] & {
  nf_data_emissao?: string;
  nf_delivery?: string;
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
  const [showHistory, setShowHistory] = useState<string | null>(null);
  const [showLabelSelector, setShowLabelSelector] = useState(false);
  const [showLabelPreview, setShowLabelPreview] = useState(false);
  const [generatedLabels, setGeneratedLabels] = useState<any[]>([]);
  const [showLocationSelector, setShowLocationSelector] = useState(false);
  const [pecaLocalizacoes, setPecaLocalizacoes] = useState<any[]>([]);
  const [historicoData, setHistoricoData] = useState<any[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  const [selectedPecas, setSelectedPecas] = useState<Set<string>>(new Set());
  const [showEmitirNFModal, setShowEmitirNFModal] = useState(false);

  useEffect(() => {
    loadPecas();
  }, [statusFilter, showArquivadas, selectedUnidade]);

  useEffect(() => {
    if (showHistory) {
      loadHistorico(showHistory);
    }
  }, [showHistory]);

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
          requisicoes_pecas!peca_estoque_id(
            id,
            status,
            quantidade_requisitada,
            created_at,
            requisitado_por,
            usuarios:requisitado_por(nome)
          )
        `);

      // Aplicar filtro de unidade
      if (canSeeAllUnits) {
        // Master/Diretoria: filtrar SOMENTE se selectedUnidade for UUID válido
        if (selectedUnidade && selectedUnidade !== '' && selectedUnidade !== 'all') {
          query = query.eq('unidade_id', selectedUnidade);
        } else {
          // NÃO aplicar filtro - ver tudo
        }
      } else if (unidadeFilter) {
        // Usuário normal: filtrar pela sua unidade
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
        nf_delivery: peca.estoque_etiquetas?.[0]?.delivery || peca.estoque_nfs?.delivery
      }));

      enrichedPecas.sort((a, b) => {
        const dateA = a.nf_data_emissao ? new Date(a.nf_data_emissao).getTime() : 0;
        const dateB = b.nf_data_emissao ? new Date(b.nf_data_emissao).getTime() : 0;
        return dateA - dateB;
      });

      setPecas(enrichedPecas);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const loadHistorico = async (pecaId: string) => {
    setLoadingHistorico(true);
    setHistoricoData([]);
    try {
      const { data, error } = await supabase
        .from('estoque_historico')
        .select(`
          *,
          usuario:usuarios(nome),
          peca:estoque_pecas(
            id,
            pn,
            descricao,
            id_numerico,
            nf:estoque_nfs(
              numero_nf,
              data_emissao,
              delivery,
              fornecedor
            )
          )
        `)
        .eq('peca_id', pecaId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setHistoricoData(data || []);
    } catch (error) {
      setHistoricoData([]);
    } finally {
      setLoadingHistorico(false);
    }
  };


  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      disponivel: { label: 'Disponível', className: 'bg-green-500/20 text-green-400 border border-green-500/30' },
      reservada: { label: 'Reservada', className: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' },
      vinculada_tecnico: { label: 'Com Técnico', className: 'bg-blue-500/20 text-blue-400 border border-blue-500/30' },
      em_rota: { label: 'Em Rota', className: 'bg-purple-500/20 text-purple-400 border border-purple-500/30' },
      em_uso: { label: 'Em Uso', className: 'bg-orange-500/20 text-orange-400 border border-orange-500/30' },
      usada: { label: 'Usada', className: 'bg-gray-500/20 text-gray-400 border border-gray-500/30' },
      devolucao_pendente: { label: 'Devolução Pendente', className: 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30' },
      devolvida_nova: { label: 'Devolvida Nova', className: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' },
      devolvida_defeito: { label: 'Devolvida c/ Defeito', className: 'bg-red-500/20 text-red-400 border border-red-500/30' },
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

  const filteredPecas = pecas.filter((peca) =>
    peca.pn.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (peca.id_numerico && peca.id_numerico.toString().includes(searchTerm)) ||
    peca.descricao.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (peca.nf_delivery && peca.nf_delivery.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const toggleSelectPeca = (pecaId: string) => {
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
    const allSelected = currentPagePecas.every(p => selectedPecas.has(p.id));

    if (allSelected) {
      setSelectedPecas(prev => {
        const newSet = new Set(prev);
        currentPagePecas.forEach(p => newSet.delete(p.id));
        return newSet;
      });
    } else {
      setSelectedPecas(prev => {
        const newSet = new Set(prev);
        currentPagePecas.forEach(p => newSet.add(p.id));
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

  const currentPagePecas = filteredPecas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);
  const allCurrentPageSelected = currentPagePecas.length > 0 && currentPagePecas.every(p => selectedPecas.has(p.id));
  const someCurrentPageSelected = currentPagePecas.some(p => selectedPecas.has(p.id));

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
            placeholder="Buscar por PN, ID ou descrição..."
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
        )}
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
          Mostrando {Math.min((currentPage - 1) * itemsPerPage + 1, filteredPecas.length)} a {Math.min(currentPage * itemsPerPage, filteredPecas.length)} de {filteredPecas.length} peças
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
        {filteredPecas.length === 0 ? (
          <div className="col-span-full text-center py-12">
            <Package className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Nenhuma peça encontrada</p>
          </div>
        ) : (
          filteredPecas.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((peca) => (
            <div
              key={peca.id}
              className={`premium-card p-4 hover-lift relative transition-all ${
                selectedPecas.has(peca.id)
                  ? 'ring-2 ring-[#FFA500] bg-[#FFA500]/5'
                  : ''
              }`}
            >
              <button
                onClick={() => toggleSelectPeca(peca.id)}
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
                              backgroundColor: '#00D4FF20',
                              color: '#00D4FF',
                              border: '1px solid #00D4FF60'
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
                  onClick={() => setSelectedPeca(peca)}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-[#00D4FF]/10 text-[#00D4FF] rounded-lg hover:bg-[#00D4FF]/20 transition text-sm border border-[#00D4FF]/30"
                >
                  <Eye className="w-4 h-4" />
                  Ver Detalhes
                </button>
                <button
                  onClick={() => setShowHistory(peca.id)}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition text-sm border border-gray-700"
                  title="Ver Histórico"
                >
                  <History className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {filteredPecas.length > itemsPerPage && (
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

          {Array.from({ length: Math.ceil(filteredPecas.length / itemsPerPage) }, (_, i) => i + 1)
            .filter(page => {
              const totalPages = Math.ceil(filteredPecas.length / itemsPerPage);
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
            onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredPecas.length / itemsPerPage), p + 1))}
            disabled={currentPage >= Math.ceil(filteredPecas.length / itemsPerPage)}
            className="px-3 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            ›
          </button>
          <button
            onClick={() => setCurrentPage(Math.ceil(filteredPecas.length / itemsPerPage))}
            disabled={currentPage >= Math.ceil(filteredPecas.length / itemsPerPage)}
            className="px-3 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            »
          </button>
        </div>
      )}

      <div className="flex items-center justify-between text-sm text-gray-400 mt-6">
        <span>Total: <span className="text-[#00D4FF] font-bold">{filteredPecas.length}</span> peças</span>
        <span>Valor total: <span className="text-[#39FF14] font-bold">R$ {filteredPecas.reduce((sum, p) => sum + p.valor_com_impostos, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></span>
      </div>

      {/* Modal de Detalhes */}
      {selectedPeca && (
        <PecaDetailsModal
          peca={selectedPeca}
          onClose={() => setSelectedPeca(null)}
          onShowLabelSelector={() => setShowLabelSelector(true)}
          onShowLocationSelector={(localizacoes) => {
            setPecaLocalizacoes(localizacoes);
            setShowLocationSelector(true);
          }}
        />
      )}

      {/* Label Selector for Single Piece */}
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

      {/* Label Preview */}
      {showLabelPreview && (
        <LabelGenerator
          labels={generatedLabels}
          onClose={() => {
            setShowLabelPreview(false);
            setGeneratedLabels([]);
          }}
        />
      )}

      {/* Location Selector */}
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

              // Registrar no histórico
              await supabase.from('estoque_historico').insert({
                peca_id: selectedPeca.id,
                usuario_id: usuario.id,
                acao: 'Localização Atualizada',
                origem: localizacaoAnterior,
                destino: locationText || 'Sem localização',
                observacao: `Localização alterada de "${localizacaoAnterior}" para "${locationText || 'Sem localização'}"`
              });

              setSelectedPeca({ ...selectedPeca, localizacao: locationText });
              setShowLocationSelector(false);
              await loadPecas();
              alert('✅ Localização atualizada com sucesso!');
            } catch (error) {
              alert('❌ Erro ao atualizar localização');
            }
          }}
          onClose={() => setShowLocationSelector(false)}
        />
      )}

      {/* Modal de Histórico */}
      {showHistory && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="premium-card w-full max-w-3xl max-h-[80vh] flex flex-col p-6">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-[#00D4FF]">Histórico da Peça</h2>
              <button
                onClick={() => setShowHistory(null)}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
              >
                <span className="text-2xl text-gray-400">×</span>
              </button>
            </div>

            {/* Informações da NF e Delivery */}
            {historicoData.length > 0 && historicoData[0].peca?.nf && (
              <div className="mb-6 p-4 bg-gray-800/50 rounded-lg border border-gray-700 space-y-2">
                <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Informações de Entrada</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  {historicoData[0].peca.id_numerico && (
                    <div>
                      <span className="text-gray-500">ID Peça:</span>
                      <span className="text-[#39FF14] font-bold ml-2">#{historicoData[0].peca.id_numerico}</span>
                    </div>
                  )}
                  <div>
                    <span className="text-gray-500">PN:</span>
                    <span className="text-white font-mono ml-2">{historicoData[0].peca.pn}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Número NF:</span>
                    <span className="text-white font-bold ml-2">{historicoData[0].peca.nf.numero_nf}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Fornecedor:</span>
                    <span className="text-white ml-2">{historicoData[0].peca.nf.fornecedor}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Data Emissão:</span>
                    <span className="text-white ml-2">
                      {new Date(historicoData[0].peca.nf.data_emissao).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                  {historicoData[0].peca.nf.delivery && (
                    <div>
                      <span className="text-gray-500">Delivery:</span>
                      <span className="text-[#00D4FF] font-bold ml-2">{historicoData[0].peca.nf.delivery}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {loadingHistorico ? (
              <div className="text-center py-12">
                <div className="w-12 h-12 border-4 border-[#00D4FF] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                <p className="text-gray-400">Carregando histórico...</p>
              </div>
            ) : historicoData.length === 0 ? (
              <div className="text-center py-12">
                <History className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p className="text-gray-400">Nenhum histórico encontrado para esta peça</p>
              </div>
            ) : (
              <div className="space-y-3 flex-1 overflow-y-auto cyber-scrollbar">
                {historicoData.map((item) => (
                  <div key={item.id} className="p-4 bg-gray-800/50 rounded-lg border border-gray-700">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 bg-[#00D4FF]/20 text-[#00D4FF] rounded text-xs font-medium">
                            {item.acao}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(item.created_at).toLocaleString('pt-BR')}
                          </span>
                        </div>

                        {item.status_anterior && item.status_novo && (
                          <div className="flex items-center gap-2 text-sm mt-2">
                            <span className="text-gray-400">Status:</span>
                            {getStatusBadge(item.status_anterior)}
                            <span className="text-gray-500">→</span>
                            {getStatusBadge(item.status_novo)}
                          </div>
                        )}

                        {item.origem && (
                          <div className="text-sm text-gray-400 mt-2">
                            <strong>Origem:</strong> {item.origem}
                          </div>
                        )}

                        {item.destino && (
                          <div className="text-sm text-gray-400 mt-1">
                            <strong>Destino:</strong> {item.destino}
                          </div>
                        )}

                        {item.observacao && (
                          <div
                            className="text-sm mt-2 p-3 rounded border"
                            style={{
                              backgroundColor: item.observacao.includes('⚠️ DEFEITO:') ? '#FF006410' : 'rgba(17, 24, 39, 0.5)',
                              borderColor: item.observacao.includes('⚠️ DEFEITO:') ? '#FF006460' : 'rgba(75, 85, 99, 0.5)',
                              color: item.observacao.includes('⚠️ DEFEITO:') ? '#FF0064' : 'rgb(209, 213, 219)'
                            }}
                          >
                            {item.observacao.includes('⚠️ DEFEITO:') && (
                              <div className="font-bold mb-1 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4" />
                                <span>PEÇA COM DEFEITO DE FÁBRICA</span>
                              </div>
                            )}
                            <div className={item.observacao.includes('⚠️ DEFEITO:') ? 'font-medium' : ''}>
                              {item.observacao}
                            </div>
                          </div>
                        )}
                      </div>

                      {item.usuario && (
                        <div className="text-xs text-gray-500 ml-4">
                          {item.usuario.nome}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="pt-4 border-t border-gray-700 mt-6">
              <button
                onClick={() => setShowHistory(null)}
                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
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
