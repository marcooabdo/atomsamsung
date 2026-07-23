import { useState, useEffect } from 'react';
import { Package, AlertCircle, CheckCircle, Clock, XCircle, TrendingUp, Filter, FileText, List, User, Search, ChevronDown, ChevronRight, Truck, ArrowRight } from 'lucide-react';
import { useOtimizador } from '../../contexts/OtimizadorContext';
import { supabase } from '../../lib/supabase';
import RomaneioView from './RomaneioView';

interface Requisicao {
  id: string;
  codigo_peca: string;
  descricao: string;
  quantidade_requisitada: number;
  status: string;
  created_at: string;
  gi_postada_em: string | null;
  peca_estoque_id: string | null;
  tecnico_id: string | null;
  motivo_devolucao: string | null;
  tipo_devolucao: string | null;
  motivo_reprovacao: string | null;
  motivo_cancelamento: string | null;
  is_lote: boolean;
  pecas_estoque_ids: string[];
  os: {
    numero_os_interna: string;
    numero_os_samsung: string | null;
    tipo_os: string;
    tipo_orcamento: string;
    tipo_atendimento: string;
    cliente_nome: string;
    aparelho_modelo: string;
    data_agendamento: string | null;
    periodo_agendamento: string | null;
    tecnico_agendado_id: string | null;
  } | null;
  requisitado_por_usuario: { nome: string } | null;
  atendido_por_usuario: { nome: string } | null;
  tecnico_usuario: { nome: string } | null;
  peca_estoque: {
    id_numerico: number;
    status: string;
    estoque_etiquetas: { delivery: string }[];
  } | null;
  pecas_estoque_lote: {
    id: string;
    id_numerico: number;
    status: string;
    estoque_etiquetas: { delivery: string }[];
  }[];
}

interface PecaMaisRequisitada {
  codigo_peca: string;
  descricao: string;
  total: number;
}

interface Tecnico {
  id: string;
  nome: string;
}

const STATUS_CONFIG: Record<string, { bg: string; border: string; text: string; label: string }> = {
  pendente: { bg: 'bg-yellow-500/20', border: 'border-yellow-500/30', text: 'text-yellow-400', label: 'Pendente' },
  atendida: { bg: 'bg-blue-500/20', border: 'border-blue-500/30', text: 'text-blue-400', label: 'Atendida' },
  em_uso: { bg: 'bg-cyan-500/20', border: 'border-cyan-500/30', text: 'text-cyan-400', label: 'Em Uso' },
  gi_postada: { bg: 'bg-green-500/20', border: 'border-green-500/30', text: 'text-green-400', label: 'GI Postada' },
  devolvida: { bg: 'bg-gray-500/20', border: 'border-gray-500/30', text: 'text-gray-400', label: 'Devolvida' },
  devolvida_samsung: { bg: 'bg-teal-500/20', border: 'border-teal-500/30', text: 'text-teal-400', label: 'Devolvida Samsung' },
  devolvida_upc: { bg: 'bg-slate-500/20', border: 'border-slate-500/30', text: 'text-slate-400', label: 'Devolvida UPC' },
  devolucao_completa: { bg: 'bg-emerald-500/20', border: 'border-emerald-500/30', text: 'text-emerald-400', label: 'Devolução Completa' },
  reprovada: { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-400', label: 'Reprovada' },
  cancelada: { bg: 'bg-red-500/20', border: 'border-red-500/30', text: 'text-red-400', label: 'Cancelada' },
};

export default function ControlePecas() {
  const { selectedUnidade, loading, isMaster } = useOtimizador();
  const [activeTab, setActiveTab] = useState<'requisicoes' | 'romaneio'>('requisicoes');
  const [requisicoes, setRequisicoes] = useState<Requisicao[]>([]);
  const [pecasMaisRequisitadas, setPecasMaisRequisitadas] = useState<PecaMaisRequisitada[]>([]);
  const [loadingRequisicoes, setLoadingRequisicoes] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');
  const [filtroTecnico, setFiltroTecnico] = useState<string>('todos');
  const [buscaTexto, setBuscaTexto] = useState('');
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [expandedReq, setExpandedReq] = useState<string | null>(null);

  useEffect(() => {
    if (selectedUnidade || isMaster) {
      loadRequisicoes();
      loadPecasMaisRequisitadas();
      loadTecnicos();
    }
  }, [selectedUnidade, filtroStatus, filtroTecnico, isMaster]);

  const loadTecnicos = async () => {
    let q = supabase
      .from('os')
      .select('tecnico_agendado_id, usuarios!os_tecnico_agendado_id_fkey(id, nome)')
      .eq('tipo_atendimento', 'IH')
      .not('tecnico_agendado_id', 'is', null);
    if (selectedUnidade) q = q.eq('unidade_id', selectedUnidade);
    const { data } = await q;

    const tecMap = new Map<string, string>();
    data?.forEach((row: any) => {
      if (row.usuarios?.id && row.usuarios?.nome) {
        tecMap.set(row.usuarios.id, row.usuarios.nome);
      }
    });

    setTecnicos(Array.from(tecMap.entries()).map(([id, nome]) => ({ id, nome })).sort((a, b) => a.nome.localeCompare(b.nome)));
  };

  const loadRequisicoes = async () => {
    setLoadingRequisicoes(true);
    try {
      let query = supabase
        .from('requisicoes_pecas')
        .select(`
          *,
          os:os!requisicoes_pecas_os_id_fkey(
            numero_os_interna, numero_os_samsung,
            tipo_os, tipo_orcamento, tipo_atendimento,
            cliente_nome, aparelho_modelo,
            data_agendamento, periodo_agendamento, tecnico_agendado_id
          ),
          requisitado_por_usuario:usuarios!requisicoes_pecas_requisitado_por_fkey(nome),
          atendido_por_usuario:usuarios!requisicoes_pecas_atendido_por_fkey(nome),
          tecnico_usuario:usuarios!requisicoes_pecas_tecnico_id_fkey(nome),
          peca_estoque:estoque_pecas!requisicoes_pecas_peca_estoque_id_fkey(
            id_numerico, status,
            estoque_etiquetas(delivery)
          )
        `)
        .order('created_at', { ascending: false })
        .limit(200);

      if (selectedUnidade) {
        query = query.eq('unidade_id', selectedUnidade);
      }

      if (filtroStatus !== 'todos') {
        query = query.eq('status', filtroStatus);
      }

      const { data, error } = await query;
      if (error) throw error;

      let filtered = (data || []).filter((r: any) => {
        if (!r.os) return false;
        if (r.os.tipo_orcamento === 'samsung_contigo' || r.os.tipo_orcamento === 'acessorios') return false;
        return true;
      });

      if (filtroTecnico !== 'todos') {
        filtered = filtered.filter((r: any) => r.os?.tecnico_agendado_id === filtroTecnico);
      }

      const enriched = await Promise.all(filtered.map(async (req: any) => {
        let pecasLote: any[] = [];
        if (req.is_lote && req.pecas_estoque_ids?.length > 0) {
          const { data: loteData } = await supabase
            .from('estoque_pecas')
            .select('id, id_numerico, status, estoque_etiquetas(delivery)')
            .in('id', req.pecas_estoque_ids);
          pecasLote = loteData || [];
        }
        return { ...req, pecas_estoque_lote: pecasLote };
      }));

      setRequisicoes(enriched);
    } catch (error) {
      // ignored
    } finally {
      setLoadingRequisicoes(false);
    }
  };

  const loadPecasMaisRequisitadas = async () => {
    try {
      let q = supabase
        .from('requisicoes_pecas')
        .select('codigo_peca, descricao, quantidade_requisitada, os:os!requisicoes_pecas_os_id_fkey(tipo_orcamento, tipo_atendimento)');
      if (selectedUnidade) q = q.eq('unidade_id', selectedUnidade);

      const { data, error } = await q;

      if (error) throw error;

      const pecasMap = new Map<string, { descricao: string; total: number }>();
      data?.forEach((req: any) => {
        if (req.os?.tipo_orcamento === 'samsung_contigo' || req.os?.tipo_orcamento === 'acessorios') return;
        const key = req.codigo_peca;
        const existing = pecasMap.get(key);
        if (existing) {
          existing.total += Number(req.quantidade_requisitada);
        } else {
          pecasMap.set(key, { descricao: req.descricao, total: Number(req.quantidade_requisitada) });
        }
      });

      const topPecas = Array.from(pecasMap.entries())
        .map(([codigo_peca, { descricao, total }]) => ({ codigo_peca, descricao, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      setPecasMaisRequisitadas(topPecas);
    } catch (error) {
      // ignored
    }
  };

  const filteredRequisicoes = requisicoes.filter(r => {
    if (!buscaTexto) return true;
    const search = buscaTexto.toLowerCase();
    return (
      r.codigo_peca?.toLowerCase().includes(search) ||
      r.descricao?.toLowerCase().includes(search) ||
      r.os?.numero_os_samsung?.toLowerCase().includes(search) ||
      r.os?.numero_os_interna?.toLowerCase().includes(search) ||
      r.os?.cliente_nome?.toLowerCase().includes(search)
    );
  });

  const countByStatus = (status: string) => filteredRequisicoes.filter(r => r.status === status).length;
  const totalRequisicoes = filteredRequisicoes.length;
  const pendentes = countByStatus('pendente');
  const atendidas = countByStatus('atendida');
  const giPostadas = countByStatus('gi_postada');
  const emUso = countByStatus('em_uso');

  const getStatusBadge = (status: string) => {
    const badge = STATUS_CONFIG[status] || STATUS_CONFIG.pendente;
    return (
      <span className={`px-2.5 py-0.5 ${badge.bg} border ${badge.border} rounded-full ${badge.text} text-xs font-medium`}>
        {badge.label}
      </span>
    );
  };

  const getPecaIdDisplay = (req: Requisicao) => {
    if (req.is_lote && req.pecas_estoque_lote?.length > 0) {
      return req.pecas_estoque_lote.map(p => `#${p.id_numerico}`).join(', ');
    }
    if (req.peca_estoque?.id_numerico) {
      return `#${req.peca_estoque.id_numerico}`;
    }
    return null;
  };

  const getDeliveryDisplay = (req: Requisicao) => {
    if (req.is_lote && req.pecas_estoque_lote?.length > 0) {
      const deliveries = req.pecas_estoque_lote
        .map(p => p.estoque_etiquetas?.[0]?.delivery)
        .filter(Boolean);
      return deliveries.length > 0 ? deliveries.join(', ') : null;
    }
    if (req.peca_estoque?.estoque_etiquetas?.[0]?.delivery) {
      return req.peca_estoque.estoque_etiquetas[0].delivery;
    }
    return null;
  };

  const getEstoqueStatus = (req: Requisicao) => {
    if (req.is_lote && req.pecas_estoque_lote?.length > 0) {
      return req.pecas_estoque_lote.map(p => p.status).join(', ');
    }
    if (req.peca_estoque?.status) return req.peca_estoque.status;
    return null;
  };

  if (loadingRequisicoes || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="futuristic-loader"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-500 to-yellow-600">
            Núcleo de Peças
          </h2>
          <p className="text-gray-400 mt-1">Requisicoes IH, status, gestao de GI e romaneio</p>
        </div>
      </div>

      <div className="flex gap-2 bg-gray-800/50 border border-gray-700 rounded-xl p-2">
        <button
          onClick={() => setActiveTab('requisicoes')}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
            activeTab === 'requisicoes'
              ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/30'
              : 'bg-gray-700/30 text-gray-400 hover:bg-gray-700/50'
          }`}
        >
          <List className="w-5 h-5" />
          Requisicoes
        </button>
        <button
          onClick={() => setActiveTab('romaneio')}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
            activeTab === 'romaneio'
              ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/30'
              : 'bg-gray-700/30 text-gray-400 hover:bg-gray-700/50'
          }`}
        >
          <FileText className="w-5 h-5" />
          Romaneio
        </button>
      </div>

      {activeTab === 'romaneio' ? (
        <RomaneioView />
      ) : (
        <>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/20 rounded-xl p-4">
              <p className="text-gray-400 text-xs">Total</p>
              <p className="text-2xl font-bold text-orange-400 mt-1">{totalRequisicoes}</p>
            </div>
            <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border border-yellow-500/20 rounded-xl p-4">
              <p className="text-gray-400 text-xs">Pendentes</p>
              <p className="text-2xl font-bold text-yellow-400 mt-1">{pendentes}</p>
            </div>
            <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl p-4">
              <p className="text-gray-400 text-xs">Atendidas</p>
              <p className="text-2xl font-bold text-blue-400 mt-1">{atendidas}</p>
            </div>
            <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-600/5 border border-cyan-500/20 rounded-xl p-4">
              <p className="text-gray-400 text-xs">Em Uso</p>
              <p className="text-2xl font-bold text-cyan-400 mt-1">{emUso}</p>
            </div>
            <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-xl p-4">
              <p className="text-gray-400 text-xs">GI Postadas</p>
              <p className="text-2xl font-bold text-green-400 mt-1">{giPostadas}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <h3 className="text-xl font-bold text-white">Requisicoes Recentes</h3>
              </div>

              <div className="flex flex-wrap items-center gap-3 mb-5">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    placeholder="Buscar PN, OS, cliente..."
                    value={buscaTexto}
                    onChange={(e) => setBuscaTexto(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500 transition-colors"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <select
                    value={filtroStatus}
                    onChange={(e) => setFiltroStatus(e.target.value)}
                    className="px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500 transition-colors"
                  >
                    <option value="todos">Todos Status</option>
                    <option value="pendente">Pendente</option>
                    <option value="atendida">Atendida</option>
                    <option value="em_uso">Em Uso</option>
                    <option value="gi_postada">GI Postada</option>
                    <option value="devolvida">Devolvida</option>
                    <option value="devolvida_samsung">Dev. Samsung</option>
                    <option value="devolvida_upc">Dev. UPC</option>
                    <option value="devolucao_completa">Dev. Completa</option>
                    <option value="reprovada">Reprovada</option>
                    <option value="cancelada">Cancelada</option>
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <select
                    value={filtroTecnico}
                    onChange={(e) => setFiltroTecnico(e.target.value)}
                    className="px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-orange-500 transition-colors"
                  >
                    <option value="todos">Todos Técnicos</option>
                    {tecnicos.map(t => (
                      <option key={t.id} value={t.id}>{t.nome}</option>
                    ))}
                  </select>
                </div>
              </div>

              {filteredRequisicoes.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400 text-lg">Nenhuma requisicao encontrada</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[700px] overflow-y-auto pr-1">
                  {filteredRequisicoes.map((req) => {
                    const pecaId = getPecaIdDisplay(req);
                    const delivery = getDeliveryDisplay(req);
                    const estoqueStatus = getEstoqueStatus(req);
                    const isExpanded = expandedReq === req.id;
                    const osNum = req.os?.numero_os_samsung || req.os?.numero_os_interna;

                    return (
                      <div
                        key={req.id}
                        className="bg-gray-700/30 border border-gray-600 rounded-lg overflow-hidden hover:border-gray-500 transition-colors"
                      >
                        <div
                          className="p-3 cursor-pointer"
                          onClick={() => setExpandedReq(isExpanded ? null : req.id)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2 min-w-0 flex-1">
                              {isExpanded ? <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-white font-bold text-sm font-mono">{req.codigo_peca}</span>
                                  {getStatusBadge(req.status)}
                                  {pecaId && (
                                    <span className="text-xs text-cyan-400 font-mono bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">
                                      {pecaId}
                                    </span>
                                  )}
                                  {delivery && (
                                    <span className="text-xs text-orange-400 font-mono bg-orange-500/10 border border-orange-500/20 px-1.5 py-0.5 rounded">
                                      DL: {delivery}
                                    </span>
                                  )}
                                </div>
                                <p className="text-gray-500 text-xs mt-0.5 truncate">{req.descricao}</p>
                              </div>
                            </div>
                            <div className="text-right flex-shrink-0">
                              <p className="text-white font-bold text-sm">OS {osNum}</p>
                              <p className="text-gray-500 text-xs">Qtd: {req.quantidade_requisitada}</p>
                            </div>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="px-3 pb-3 border-t border-gray-700 pt-3">
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
                              <div>
                                <p className="text-gray-600 uppercase tracking-wider mb-0.5">Cliente</p>
                                <p className="text-gray-300">{req.os?.cliente_nome || '-'}</p>
                              </div>
                              <div>
                                <p className="text-gray-600 uppercase tracking-wider mb-0.5">Aparelho</p>
                                <p className="text-gray-300">{req.os?.aparelho_modelo || '-'}</p>
                              </div>
                              <div>
                                <p className="text-gray-600 uppercase tracking-wider mb-0.5">Tipo OS</p>
                                <p className="text-gray-300">{req.os?.tipo_os} / {req.os?.tipo_orcamento}</p>
                              </div>
                              <div>
                                <p className="text-gray-600 uppercase tracking-wider mb-0.5">Requisitado por</p>
                                <p className="text-gray-300">{req.requisitado_por_usuario?.nome || '-'}</p>
                              </div>
                              {req.atendido_por_usuario && (
                                <div>
                                  <p className="text-gray-600 uppercase tracking-wider mb-0.5">Atendido por</p>
                                  <p className="text-gray-300">{req.atendido_por_usuario.nome}</p>
                                </div>
                              )}
                              <div>
                                <p className="text-gray-600 uppercase tracking-wider mb-0.5">Data Requisicao</p>
                                <p className="text-gray-300">
                                  {new Date(req.created_at).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                </p>
                              </div>
                              {req.os?.data_agendamento && (
                                <div>
                                  <p className="text-gray-600 uppercase tracking-wider mb-0.5">Agendamento</p>
                                  <p className="text-gray-300">
                                    {new Date(req.os.data_agendamento + 'T12:00:00').toLocaleDateString('pt-BR')} {req.os.periodo_agendamento ? `(${req.os.periodo_agendamento})` : ''}
                                  </p>
                                </div>
                              )}
                              {req.gi_postada_em && (
                                <div>
                                  <p className="text-gray-600 uppercase tracking-wider mb-0.5">GI Postada em</p>
                                  <p className="text-green-400">
                                    {new Date(req.gi_postada_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                                  </p>
                                </div>
                              )}
                              {estoqueStatus && (
                                <div>
                                  <p className="text-gray-600 uppercase tracking-wider mb-0.5">Status Estoque</p>
                                  <p className="text-cyan-400 font-mono text-xs">{estoqueStatus.replace(/_/g, ' ')}</p>
                                </div>
                              )}
                              {req.motivo_devolucao && (
                                <div className="col-span-2">
                                  <p className="text-gray-600 uppercase tracking-wider mb-0.5">Motivo Devolucao</p>
                                  <p className="text-yellow-400">{req.motivo_devolucao}</p>
                                </div>
                              )}
                              {req.motivo_reprovacao && (
                                <div className="col-span-2">
                                  <p className="text-gray-600 uppercase tracking-wider mb-0.5">Motivo Reprovacao</p>
                                  <p className="text-red-400">{req.motivo_reprovacao}</p>
                                </div>
                              )}
                              {req.motivo_cancelamento && (
                                <div className="col-span-2">
                                  <p className="text-gray-600 uppercase tracking-wider mb-0.5">Motivo Cancelamento</p>
                                  <p className="text-red-400">{req.motivo_cancelamento}</p>
                                </div>
                              )}
                            </div>

                            {req.is_lote && req.pecas_estoque_lote?.length > 0 && (
                              <div className="mt-3 pt-2 border-t border-gray-700">
                                <p className="text-gray-600 text-xs uppercase tracking-wider mb-1.5">Pecas do Lote</p>
                                <div className="flex flex-wrap gap-2">
                                  {req.pecas_estoque_lote.map(p => (
                                    <div key={p.id} className="flex items-center gap-1 bg-gray-800/80 border border-gray-600 rounded px-2 py-1">
                                      <span className="text-cyan-400 font-mono text-xs">#{p.id_numerico}</span>
                                      {p.estoque_etiquetas?.[0]?.delivery && (
                                        <>
                                          <span className="text-gray-600">|</span>
                                          <span className="text-orange-400 text-xs">{p.estoque_etiquetas[0].delivery}</span>
                                        </>
                                      )}
                                      <span className="text-gray-500 text-xs">({p.status?.replace(/_/g, ' ')})</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                  <TrendingUp className="w-5 h-5 text-orange-400" />
                  <h3 className="text-lg font-bold text-white">Top 5 Pecas</h3>
                </div>
                {pecasMaisRequisitadas.length === 0 ? (
                  <div className="text-center py-6">
                    <Package className="w-10 h-10 text-gray-500 mx-auto mb-2" />
                    <p className="text-gray-400 text-sm">Sem dados</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {pecasMaisRequisitadas.map((peca, index) => (
                      <div key={peca.codigo_peca} className="bg-gray-700/30 border border-gray-600 rounded-lg p-3">
                        <div className="flex items-center gap-2 mb-1">
                          <div className="w-6 h-6 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center flex-shrink-0">
                            <span className="text-orange-400 font-bold text-xs">{index + 1}</span>
                          </div>
                          <div className="min-w-0 flex-1">
                            <h4 className="text-white font-bold text-sm font-mono">{peca.codigo_peca}</h4>
                            <p className="text-gray-400 text-xs truncate">{peca.descricao}</p>
                          </div>
                          <span className="text-orange-400 font-bold text-lg">{peca.total}x</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {filtroTecnico !== 'todos' && (
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
                  <div className="flex items-center gap-3 mb-4">
                    <Truck className="w-5 h-5 text-cyan-400" />
                    <h3 className="text-lg font-bold text-white">Resumo Técnico</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total com técnico</span>
                      <span className="text-white font-bold">{filteredRequisicoes.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-yellow-400">Pendentes</span>
                      <span className="text-yellow-400 font-bold">{pendentes}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-blue-400">Atendidas</span>
                      <span className="text-blue-400 font-bold">{atendidas}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-cyan-400">Em Uso</span>
                      <span className="text-cyan-400 font-bold">{emUso}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-green-400">GI Postadas</span>
                      <span className="text-green-400 font-bold">{giPostadas}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Devolvidas</span>
                      <span className="text-gray-400 font-bold">{countByStatus('devolvida')}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
