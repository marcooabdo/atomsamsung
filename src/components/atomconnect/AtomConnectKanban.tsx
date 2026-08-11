import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Bot, Clock, DollarSign, Package, Wrench, CheckCircle, MapPin, Star,
  Phone, MessageSquare, User, Users, AlertTriangle,
  Plus, UserPlus, Link2, Filter, FileText, CalendarClock, X,
  Pencil, Check, ChevronsLeft, ChevronsRight, ArrowUp, ArrowDown
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
import { motion, AnimatePresence } from 'framer-motion';
import { FinalizarConversaModal, type ClosureData } from './FinalizarConversaModal';

interface Conversa {
  id: string;
  unidade_id: string;
  cliente_telefone: string;
  cliente_nome: string | null;
  cliente_foto_url: string | null;
  os_id: string | null;
  coluna_pipeline: string;
  atendente_id: string | null;
  ultima_mensagem: string | null;
  ultima_mensagem_at: string;
  ultima_resposta_cliente_at: string | null;
  ultima_resposta_operador_at: string | null;
  mensagens_nao_lidas: number;
  is_bot_ativo: boolean;
  tipo_atendimento: string;
  prioridade: string;
  tags: string[];
  is_group?: boolean;
  group_jid?: string | null;
  is_interno?: boolean;
  cliente_digitando?: string | null;
  cliente_digitando_at?: string | null;
  created_at: string;
}

interface PipelineColuna {
  id: string;
  nome: string;
  cor: string;
  icone: string;
  ordem: number;
  sla_minutos: number | null;
  is_bot_column: boolean;
  is_final: boolean;
}


interface Props {
  conversas: Conversa[];
  searchTerm: string;
  deepSearchIds?: string[];
  onSelectConversa: (c: Conversa) => void;
  onUpdateConversa: () => void;
  onNovaConversa: () => void;
  accentColor: string;
  unidadeId?: string;
}

const ICON_MAP: Record<string, any> = {
  Bot, Clock, DollarSign, Package, Wrench, CheckCircle, MapPin, Star, MessageSquare
};

export function AtomConnectKanban({ conversas, searchTerm, deepSearchIds = [], onSelectConversa, onUpdateConversa, onNovaConversa, accentColor, unidadeId }: Props) {
  const { usuario, unidadeAtual } = useAuth();
  const { isDark } = useTheme();
  const effectiveUnidadeId = unidadeId || unidadeAtual;
  const [colunas, setColunas] = useState<PipelineColuna[]>([]);

  const [pendingFinalizeConversa, setPendingFinalizeConversa] = useState<Conversa | null>(null);
  const [filterAtendente, setFilterAtendente] = useState<'all' | 'mine' | 'unassigned'>('all');
  const [filterVendedor, setFilterVendedor] = useState<string>('all');
  const [filterDiasSemRetorno, setFilterDiasSemRetorno] = useState<number | null>(null);
  const [filterVinculadoOS, setFilterVinculadoOS] = useState<'all' | 'yes' | 'no'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [atendentes, setAtendentes] = useState<any[]>([]);
  const [osMap, setOsMap] = useState<Record<string, { numero_os_interna?: string; numero_os_samsung?: string }>>({});
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null);
  const [editingColumnName, setEditingColumnName] = useState('');
  const [collapsedColumns, setCollapsedColumns] = useState<Set<string>>(new Set());
  const [columnSortOrder, setColumnSortOrder] = useState<Record<string, 'asc' | 'desc'>>({});

  const FIXED_COLUMNS = ['bot_triagem', 'fila_espera', 'finalizado_nps', 'monitor_atrito'];
  const isMaster = usuario?.cargo === 'master';

  const canEditColumn = (coluna: PipelineColuna) => {
    return isMaster && !FIXED_COLUMNS.includes(coluna.id);
  };

  const startEditingColumn = (coluna: PipelineColuna) => {
    setEditingColumnId(coluna.id);
    setEditingColumnName(coluna.nome);
  };

  const saveColumnName = async (colunaId: string) => {
    const trimmed = editingColumnName.trim();
    if (!trimmed) { setEditingColumnId(null); return; }

    await supabase
      .from('atom_connect_pipeline_colunas')
      .update({ nome: trimmed })
      .eq('id', colunaId);

    setColunas(prev => prev.map(c => c.id === colunaId ? { ...c, nome: trimmed } : c));
    setEditingColumnId(null);
  };

  const toggleColumnCollapse = (colunaId: string) => {
    setCollapsedColumns(prev => {
      const next = new Set(prev);
      if (next.has(colunaId)) next.delete(colunaId);
      else next.add(colunaId);
      return next;
    });
  };

  const getOldestConversaAge = (conversasList: Conversa[]) => {
    if (conversasList.length === 0) return null;
    let oldest = conversasList[0].created_at;
    for (const c of conversasList) {
      if (c.created_at < oldest) oldest = c.created_at;
    }
    const diffMs = Date.now() - new Date(oldest).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);
    if (diffMins < 60) return `${diffMins}min`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}d`;
  };

  const getUnreadCount = (conversasList: Conversa[]) => {
    return conversasList.reduce((sum, c) => sum + (c.mensagens_nao_lidas || 0), 0);
  };

  const getInitials = (name: string | undefined) => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  const loadOsData = useCallback(async () => {
    const osIds = conversas.filter(c => c.os_id).map(c => c.os_id!);
    if (osIds.length === 0) { setOsMap({}); return; }

    const unique = [...new Set(osIds)];
    const { data } = await supabase
      .from('os')
      .select('id, numero_os_interna, numero_os_samsung')
      .in('id', unique);

    if (data) {
      const map: Record<string, { numero_os_interna?: string; numero_os_samsung?: string }> = {};
      data.forEach(os => { map[os.id] = os; });
      setOsMap(map);
    }
  }, [conversas]);

  useEffect(() => {
    loadColunas();
    loadAtendentes();
  }, [effectiveUnidadeId]);

  useEffect(() => {
    loadOsData();
  }, [loadOsData]);

  const loadColunas = async () => {
    let query = supabase
      .from('atom_connect_pipeline_colunas')
      .select('*')
      .order('ordem');

    if (effectiveUnidadeId) {
      query = query.or(`unidade_id.is.null,unidade_id.eq.${effectiveUnidadeId}`);
    } else {
      query = query.is('unidade_id', null);
    }

    const { data } = await query;
    if (data) setColunas(data);
  };

  const loadAtendentes = async () => {
    const { data } = await supabase
      .from('usuarios')
      .select('id, nome, foto_url, unidade_id')
      .eq('ativo', true);
    if (data) setAtendentes(data);
  };

  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (filterVendedor !== 'all') count++;
    if (filterDiasSemRetorno !== null) count++;
    if (filterVinculadoOS !== 'all') count++;
    return count;
  }, [filterVendedor, filterDiasSemRetorno, filterVinculadoOS]);

  const filteredConversas = useMemo(() => {
    let filtered = conversas.filter(c => c.ultima_mensagem);

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(c => {
        if (c.cliente_nome?.toLowerCase().includes(term)) return true;
        if (c.cliente_telefone.includes(term)) return true;
        if (c.ultima_mensagem?.toLowerCase().includes(term)) return true;
        if (c.os_id && osMap[c.os_id]) {
          const os = osMap[c.os_id];
          if (os.numero_os_interna?.toLowerCase().includes(term)) return true;
          if (os.numero_os_samsung?.toLowerCase().includes(term)) return true;
        }
        if (deepSearchIds.includes(c.id)) return true;
        return false;
      });
    }

    if (filterAtendente === 'mine') {
      filtered = filtered.filter(c => c.atendente_id === usuario?.id);
    } else if (filterAtendente === 'unassigned') {
      filtered = filtered.filter(c => !c.atendente_id);
    }

    if (filterVendedor !== 'all') {
      filtered = filtered.filter(c => c.atendente_id === filterVendedor);
    }

    if (filterDiasSemRetorno !== null) {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - filterDiasSemRetorno);
      filtered = filtered.filter(c => {
        if (!c.ultima_resposta_cliente_at) return true;
        return new Date(c.ultima_resposta_cliente_at) < cutoffDate;
      });
    }

    if (filterVinculadoOS === 'yes') {
      filtered = filtered.filter(c => c.os_id !== null);
    } else if (filterVinculadoOS === 'no') {
      filtered = filtered.filter(c => c.os_id === null);
    }

    return filtered;
  }, [conversas, searchTerm, filterAtendente, filterVendedor, filterDiasSemRetorno, filterVinculadoOS, usuario, osMap, deepSearchIds]);

  const getConversasByColuna = (colunaId: string) => {
    const order = columnSortOrder[colunaId] ?? 'desc';
    return filteredConversas
      .filter(c => c.coluna_pipeline === colunaId)
      .sort((a, b) => {
        const diff = new Date(a.ultima_mensagem_at).getTime() - new Date(b.ultima_mensagem_at).getTime();
        return order === 'asc' ? diff : -diff;
      });
  };

  const toggleColumnSort = (colunaId: string) => {
    setColumnSortOrder(prev => ({
      ...prev,
      [colunaId]: (prev[colunaId] ?? 'desc') === 'desc' ? 'asc' : 'desc'
    }));
  };



  const handleKanbanFinalize = async (data: ClosureData) => {
    if (!pendingFinalizeConversa) return;

    await supabase
      .from('atom_connect_conversas')
      .update({
        coluna_pipeline: 'finalizado_nps',
        is_bot_ativo: false,
        aguardando_avaliacao: false,
        resultado_conversa: data.resultado_conversa,
        valor_orcamento: data.valor_orcamento,
        resumo_fechamento: data.resumo_fechamento,
        proxima_acao_data: data.proxima_acao_data ? new Date(data.proxima_acao_data + 'T12:00:00').toISOString() : null,
        proxima_acao_descricao: data.proxima_acao_descricao || null,
        tags_oportunidade: data.tags_oportunidade,
        finalizado_at: new Date().toISOString(),
        finalizado_por: usuario?.id || null,
      })
      .eq('id', pendingFinalizeConversa.id);

    setPendingFinalizeConversa(null);
    onUpdateConversa();
  };

  const isSLABreached = (conversa: Conversa, coluna: PipelineColuna): boolean => {
    if (conversa.is_interno) return false;
    if (!coluna.sla_minutos || !conversa.ultima_resposta_cliente_at) return false;
    const lastClientMsg = new Date(conversa.ultima_resposta_cliente_at);
    if (conversa.ultima_resposta_operador_at) {
      const lastOperatorMsg = new Date(conversa.ultima_resposta_operador_at);
      if (lastOperatorMsg >= lastClientMsg) return false;
    }
    const now = new Date();
    const diffMinutes = (now.getTime() - lastClientMsg.getTime()) / (1000 * 60);
    return diffMinutes > coluna.sla_minutos;
  };

  const getTimeAgo = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'agora';
    if (diffMins < 60) return `${diffMins}min`;
    if (diffHours < 24) return `${diffHours}h`;
    return `${diffDays}d`;
  };

  const assignToMe = async (conversa: Conversa, e: React.MouseEvent) => {
    e.stopPropagation();
    await supabase
      .from('atom_connect_conversas')
      .update({
        atendente_id: usuario?.id,
        is_bot_ativo: false,
        aguardando_avaliacao: false,
        regra_finalizacao_id: null,
      })
      .eq('id', conversa.id);
    onUpdateConversa();
  };

  const clearAllFilters = () => {
    setFilterVendedor('all');
    setFilterDiasSemRetorno(null);
    setFilterVinculadoOS('all');
  };

  const totalConversas = filteredConversas.length;

  return (
    <div className="h-full flex flex-col">
      {/* Filter Bar */}
      <div className="flex-shrink-0 px-5 py-2.5 flex items-center justify-between border-b border-white/[0.04]">
        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white/[0.03] rounded-lg p-0.5 border border-white/[0.06]">
            {(['all', 'mine', 'unassigned'] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilterAtendente(f)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                  filterAtendente === f
                    ? 'bg-cyan-500/15 text-cyan-400 shadow-sm'
                    : 'text-white/30 hover:text-white/50'
                }`}
                style={filterAtendente === f ? { boxShadow: '0 0 10px rgba(0,212,255,0.1)' } : undefined}
              >
                {f === 'all' ? 'Todos' : f === 'mine' ? 'Meus' : 'Sem Atendente'}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              showFilters || activeFiltersCount > 0
                ? 'bg-cyan-500/15 text-cyan-400 border border-cyan-500/30'
                : 'bg-white/[0.03] text-white/40 border border-white/[0.06] hover:text-white/60'
            }`}
          >
            <Filter className="w-3 h-3" />
            Filtros
            {activeFiltersCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-cyan-500 text-black">
                {activeFiltersCount}
              </span>
            )}
          </button>

          <div className="flex items-center gap-1.5 text-xs text-white/20">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/40" />
            {totalConversas} conversa{totalConversas !== 1 ? 's' : ''}
          </div>
        </div>

        <button
          onClick={onNovaConversa}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-cyan-400 transition-all hover:bg-cyan-500/10"
          style={{ border: '1px solid rgba(0,212,255,0.15)' }}
        >
          <Plus className="w-3 h-3" />
          Nova Conversa
        </button>
      </div>

      {/* Expanded Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-white/[0.04]"
          >
            <div className="px-5 py-3 flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <User className="w-3.5 h-3.5 text-white/30" />
                <select
                  value={filterVendedor}
                  onChange={(e) => setFilterVendedor(e.target.value)}
                  className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/40"
                >
                  <option value="all" className="bg-[#12122a]">Todos Atendentes</option>
                  {atendentes.map(a => (
                    <option key={a.id} value={a.id} className="bg-[#12122a]">{a.nome}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <CalendarClock className="w-3.5 h-3.5 text-white/30" />
                <select
                  value={filterDiasSemRetorno ?? ''}
                  onChange={(e) => setFilterDiasSemRetorno(e.target.value ? Number(e.target.value) : null)}
                  className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/40"
                >
                  <option value="" className="bg-[#12122a]">Dias sem retorno</option>
                  <option value="1" className="bg-[#12122a]">+1 dia sem retorno</option>
                  <option value="3" className="bg-[#12122a]">+3 dias sem retorno</option>
                  <option value="7" className="bg-[#12122a]">+7 dias sem retorno</option>
                  <option value="15" className="bg-[#12122a]">+15 dias sem retorno</option>
                  <option value="30" className="bg-[#12122a]">+30 dias sem retorno</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <FileText className="w-3.5 h-3.5 text-white/30" />
                <select
                  value={filterVinculadoOS}
                  onChange={(e) => setFilterVinculadoOS(e.target.value as 'all' | 'yes' | 'no')}
                  className="bg-white/[0.05] border border-white/[0.08] rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:border-cyan-500/40"
                >
                  <option value="all" className="bg-[#12122a]">Vinculado a OS</option>
                  <option value="yes" className="bg-[#12122a]">Com OS vinculada</option>
                  <option value="no" className="bg-[#12122a]">Sem OS vinculada</option>
                </select>
              </div>

              {activeFiltersCount > 0 && (
                <button
                  onClick={clearAllFilters}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <X className="w-3 h-3" />
                  Limpar filtros
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Kanban Board - fills remaining height */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden min-h-0">
        <div className="flex gap-0 h-full">
          {colunas.map((coluna, idx) => {
            const Icon = ICON_MAP[coluna.icone] || MessageSquare;
            const columnConversas = getConversasByColuna(coluna.id);
            const isDropTarget = false;
            const isCollapsed = collapsedColumns.has(coluna.id);
            const oldestAge = getOldestConversaAge(columnConversas);
            const unreadTotal = getUnreadCount(columnConversas);
            const slaBreachedCount = columnConversas.filter(c => isSLABreached(c, coluna)).length;
            const noAttendenteCount = columnConversas.filter(c => !c.atendente_id).length;

            if (isCollapsed) {
              return (
                <div
                  key={coluna.id}
                  className={`w-[52px] min-w-[52px] flex-shrink-0 flex flex-col h-full transition-all duration-300 cursor-pointer group/col ${
                    idx > 0 ? 'border-l border-white/[0.04]' : ''
                  }`}
                  style={{ background: isDropTarget ? `${coluna.cor}08` : 'transparent' }}
                  onClick={() => toggleColumnCollapse(coluna.id)}


                >
                  <div className="flex flex-col items-center gap-3 py-3 border-b border-white/[0.04]">
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center"
                      style={{ backgroundColor: `${coluna.cor}15` }}
                    >
                      <Icon className="w-3.5 h-3.5" style={{ color: coluna.cor }} />
                    </div>
                    <ChevronsRight className="w-3.5 h-3.5 text-white/20 group-hover/col:text-white/50 transition-colors" />
                  </div>

                  <div className="flex-1 flex flex-col items-center py-4 gap-3">
                    <div className="flex flex-col items-center">
                      <span
                        className="text-lg font-bold leading-none"
                        style={{ color: coluna.cor }}
                      >
                        {columnConversas.length}
                      </span>
                      <span className="text-[9px] text-white/30 mt-0.5">conv.</span>
                    </div>

                    {oldestAge && (
                      <div className="flex flex-col items-center" title="Conversa mais antiga">
                        <Clock className="w-3 h-3 text-white/25 mb-0.5" />
                        <span className="text-[10px] text-white/40 font-medium">{oldestAge}</span>
                      </div>
                    )}

                    {unreadTotal > 0 && (
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-black bg-cyan-400"
                        style={{ boxShadow: '0 0 8px #00D4FF40' }}
                        title={`${unreadTotal} nao lidas`}
                      >
                        {unreadTotal > 99 ? '99+' : unreadTotal}
                      </div>
                    )}

                    {slaBreachedCount > 0 && (
                      <div className="flex flex-col items-center" title={`${slaBreachedCount} SLA excedido`}>
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
                        <span className="text-[10px] text-red-400 font-medium">{slaBreachedCount}</span>
                      </div>
                    )}

                    {noAttendenteCount > 0 && !slaBreachedCount && (
                      <div className="flex flex-col items-center" title={`${noAttendenteCount} sem atendente`}>
                        <User className="w-3 h-3 text-amber-400" />
                        <span className="text-[10px] text-amber-400 font-medium">{noAttendenteCount}</span>
                      </div>
                    )}
                  </div>

                  <div className="writing-mode-vertical flex items-center justify-center pb-4 px-1">
                    <span
                      className="text-[10px] font-semibold tracking-wider text-white/40 whitespace-nowrap"
                      style={{ writingMode: 'vertical-lr', textOrientation: 'mixed' }}
                    >
                      {coluna.nome}
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={coluna.id}
                className={`min-w-[280px] w-[280px] flex-shrink-0 flex flex-col h-full transition-all duration-300 ${
                  idx > 0 ? 'border-l border-white/[0.04]' : ''
                }`}
                style={{
                  background: isDropTarget ? `${coluna.cor}08` : 'transparent',
                }}


              >
                {/* Column Header */}
                <div className="flex-shrink-0 px-3 py-2.5 border-b border-white/[0.04]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-md flex items-center justify-center"
                        style={{ backgroundColor: `${coluna.cor}15` }}
                      >
                        <Icon className="w-3 h-3" style={{ color: coluna.cor }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        {editingColumnId === coluna.id ? (
                          <div className="flex items-center gap-1">
                            <input
                              autoFocus
                              value={editingColumnName}
                              onChange={(e) => setEditingColumnName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveColumnName(coluna.id);
                                if (e.key === 'Escape') setEditingColumnId(null);
                              }}
                              onBlur={() => saveColumnName(coluna.id)}
                              className="text-xs font-semibold text-white bg-white/10 border border-white/20 rounded px-1.5 py-0.5 w-full focus:outline-none focus:border-white/40"
                            />
                            <button
                              onMouseDown={(e) => { e.preventDefault(); saveColumnName(coluna.id); }}
                              className="p-0.5 rounded hover:bg-white/10 text-green-400 flex-shrink-0"
                            >
                              <Check className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 group/title">
                            <h3 className="text-xs font-semibold text-white/80 truncate">{coluna.nome}</h3>
                            {canEditColumn(coluna) && (
                              <button
                                onClick={() => startEditingColumn(coluna)}
                                className="p-0.5 rounded hover:bg-white/10 text-white/20 hover:text-white/60 opacity-0 group-hover/title:opacity-100 transition-opacity flex-shrink-0"
                                title="Renomear coluna"
                              >
                                <Pencil className="w-2.5 h-2.5" />
                              </button>
                            )}
                          </div>
                        )}
                        <p className="text-[11px] text-white/30">{columnConversas.length} cliente{columnConversas.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      {coluna.sla_minutos && (
                        <div className="flex items-center gap-1 text-[10px] text-white/25 px-1.5 py-0.5 rounded bg-white/[0.03]">
                          <Clock className="w-3 h-3" />
                          {coluna.sla_minutos}min
                        </div>
                      )}
                      <button
                        onClick={() => toggleColumnSort(coluna.id)}
                        className="p-1 rounded hover:bg-white/10 transition-colors"
                        style={{ color: (columnSortOrder[coluna.id] ?? 'desc') === 'asc' ? accentColor : 'rgba(255,255,255,0.2)' }}
                        title={(columnSortOrder[coluna.id] ?? 'desc') === 'desc' ? 'Mais recentes primeiro — clique para inverter' : 'Mais antigos primeiro — clique para inverter'}
                      >
                        {(columnSortOrder[coluna.id] ?? 'desc') === 'desc'
                          ? <ArrowDown className="w-3.5 h-3.5" />
                          : <ArrowUp className="w-3.5 h-3.5" />
                        }
                      </button>
                      <button
                        onClick={() => toggleColumnCollapse(coluna.id)}
                        className="p-1 rounded hover:bg-white/10 text-white/20 hover:text-white/50 transition-colors"
                        title="Minimizar coluna"
                      >
                        <ChevronsLeft className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  {isDropTarget && (
                    <div className="mt-2 h-0.5 rounded-full" style={{ background: `linear-gradient(90deg, ${coluna.cor}, transparent)` }} />
                  )}
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.05) transparent' }}>
                  <AnimatePresence>
                    {columnConversas.map(conversa => {
                      const slaBreached = isSLABreached(conversa, coluna);
                      const atendente = atendentes.find(a => a.id === conversa.atendente_id);

                      return (
                        <motion.div
                          key={conversa.id}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}

                          onClick={() => onSelectConversa(conversa)}
                          className={`p-2.5 rounded-lg cursor-pointer transition-all duration-150 group ${
                            slaBreached
                              ? 'border border-red-500/30 bg-red-500/[0.05]'
                              : !conversa.atendente_id
                                ? 'border border-amber-500/30 bg-amber-500/[0.04] hover:bg-amber-500/[0.08]'
                                : 'border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.08]'
                          }`}
                        >
                          {slaBreached && (
                            <div className="flex items-center gap-1 mb-1.5 text-[11px] text-red-400 font-medium">
                              <AlertTriangle className="w-3 h-3" />
                              SLA excedido
                            </div>
                          )}

                          {!conversa.atendente_id && !slaBreached && (
                            <div className="flex items-center gap-1 mb-1.5 text-[11px] text-amber-400 font-medium">
                              <div className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                              Sem atendente
                            </div>
                          )}

                          <div className="flex items-start gap-2">
                            <div
                              className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{
                                backgroundColor: conversa.cliente_foto_url ? 'transparent' : `${coluna.cor}12`,
                                border: conversa.os_id ? `1.5px solid ${accentColor}50` : '1.5px solid rgba(255,255,255,0.06)'
                              }}
                            >
                              {conversa.cliente_foto_url ? (
                                <img src={conversa.cliente_foto_url} alt="" className="w-full h-full rounded-full object-cover" />
                              ) : conversa.is_group ? (
                                <Users className="w-3.5 h-3.5" style={{ color: coluna.cor }} />
                              ) : (
                                <User className="w-3.5 h-3.5" style={{ color: coluna.cor }} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-medium text-white/85 truncate flex items-center gap-1">
                                  {conversa.is_interno && <span className="text-[9px] px-1 py-0.5 rounded bg-amber-500/20 text-amber-400 flex-shrink-0 font-semibold">Interno</span>}
                                  {conversa.is_group && !conversa.is_interno && <span className="text-[9px] px-1 py-0.5 rounded bg-emerald-500/15 text-emerald-400 flex-shrink-0">Grupo</span>}
                                  {conversa.cliente_nome || conversa.cliente_telefone}
                                </h4>
                                <span className="text-[10px] text-white/20 ml-1 flex-shrink-0">
                                  {getTimeAgo(conversa.ultima_mensagem_at)}
                                </span>
                              </div>
                              {!conversa.is_group && (
                              <p className="text-[11px] text-white/30 flex items-center gap-0.5 mt-0.5">
                                <Phone className="w-3 h-3" />
                                {conversa.cliente_telefone}
                              </p>
                              )}
                              {conversa.os_id && osMap[conversa.os_id] && (
                              <p className="text-[10px] text-blue-400/70 flex items-center gap-0.5 mt-0.5 truncate">
                                <FileText className="w-3 h-3 flex-shrink-0" />
                                OS #{osMap[conversa.os_id].numero_os_samsung || osMap[conversa.os_id].numero_os_interna}
                              </p>
                              )}
                            </div>
                          </div>

                          {conversa.ultima_mensagem && (
                            <p className="mt-1.5 text-[11px] text-white/30 line-clamp-2 leading-relaxed">
                              {conversa.ultima_mensagem}
                            </p>
                          )}

                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              {conversa.mensagens_nao_lidas > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold text-black bg-cyan-400" style={{ boxShadow: '0 0 6px #00D4FF40' }}>
                                  {conversa.mensagens_nao_lidas}
                                </span>
                              )}
                              {conversa.is_bot_ativo && (
                                <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] bg-violet-500/15 text-violet-400">
                                  <Bot className="w-3 h-3" />
                                  GIA
                                </span>
                              )}
                              {conversa.os_id && (
                                <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] bg-blue-500/15 text-blue-400">
                                  <Link2 className="w-3 h-3" />
                                  OS
                                </span>
                              )}
                            </div>

                            {atendente ? (
                              atendente.id === usuario?.id ? (
                                <div
                                  className="w-5 h-5 rounded-full bg-white/[0.06] flex items-center justify-center overflow-hidden border border-white/[0.08]"
                                  title={atendente.nome || ''}
                                >
                                  {atendente.foto_url ? (
                                    <img src={atendente.foto_url} alt={atendente.nome || ''} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-[8px] font-semibold text-white/50 leading-none">{getInitials(atendente.nome)}</span>
                                  )}
                                </div>
                              ) : (
                                <button
                                  onClick={(e) => assignToMe(conversa, e)}
                                  className="relative group/avatar"
                                  title={`${atendente.nome} - Clique para assumir`}
                                >
                                  <div className="w-5 h-5 rounded-full bg-white/[0.06] flex items-center justify-center overflow-hidden border border-white/[0.08] group-hover/avatar:border-cyan-400/50 transition-colors">
                                    {atendente.foto_url ? (
                                      <img src={atendente.foto_url} alt={atendente.nome || ''} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-[8px] font-semibold text-white/50 leading-none">{getInitials(atendente.nome)}</span>
                                    )}
                                  </div>
                                  <div className="absolute inset-0 rounded-full bg-cyan-400/20 flex items-center justify-center opacity-0 group-hover/avatar:opacity-100 transition-opacity">
                                    <UserPlus className="w-2.5 h-2.5 text-cyan-400" />
                                  </div>
                                </button>
                              )
                            ) : (
                              <button
                                onClick={(e) => assignToMe(conversa, e)}
                                className="flex items-center gap-0.5 px-2 py-0.5 rounded text-[10px] font-semibold transition-all"
                                style={{
                                  color: '#00D4FF',
                                  backgroundColor: 'rgba(0, 212, 255, 0.12)',
                                  border: '1px solid rgba(0, 212, 255, 0.25)',
                                  textShadow: '0 0 8px rgba(0, 212, 255, 0.5)',
                                  boxShadow: '0 0 6px rgba(0, 212, 255, 0.15)'
                                }}
                              >
                                <UserPlus className="w-2.5 h-2.5" />
                                Assumir
                              </button>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {columnConversas.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-white/10">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center mb-2" style={{ background: `${coluna.cor}08` }}>
                        <Icon className="w-5 h-5" style={{ color: `${coluna.cor}30` }} />
                      </div>
                      <p className="text-xs">Nenhum cliente</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <AnimatePresence>
        {pendingFinalizeConversa && (
          <FinalizarConversaModal
            accentColor={accentColor}
            isDark={isDark}
            clienteNome={pendingFinalizeConversa.cliente_nome}
            clienteTelefone={pendingFinalizeConversa.cliente_telefone}
            onConfirm={handleKanbanFinalize}
            onCancel={() => setPendingFinalizeConversa(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
