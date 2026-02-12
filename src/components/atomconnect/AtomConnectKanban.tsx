import { useState, useEffect, useMemo } from 'react';
import {
  Bot, Clock, DollarSign, Package, Wrench, CheckCircle, MapPin, Star,
  Phone, MessageSquare, User, AlertTriangle,
  Plus, UserPlus, Link2, Filter, FileText, CalendarClock, X
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

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
  mensagens_nao_lidas: number;
  is_bot_ativo: boolean;
  tipo_atendimento: string;
  prioridade: string;
  tags: string[];
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
  onSelectConversa: (c: Conversa) => void;
  onUpdateConversa: () => void;
  onNovaConversa: () => void;
  accentColor: string;
}

const ICON_MAP: Record<string, any> = {
  Bot, Clock, DollarSign, Package, Wrench, CheckCircle, MapPin, Star, MessageSquare
};

export function AtomConnectKanban({ conversas, searchTerm, onSelectConversa, onUpdateConversa, onNovaConversa, accentColor }: Props) {
  const { usuario } = useAuth();
  const [colunas, setColunas] = useState<PipelineColuna[]>([]);
  const [draggedConversa, setDraggedConversa] = useState<Conversa | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [filterAtendente, setFilterAtendente] = useState<'all' | 'mine' | 'unassigned'>('all');
  const [filterVendedor, setFilterVendedor] = useState<string>('all');
  const [filterDiasSemRetorno, setFilterDiasSemRetorno] = useState<number | null>(null);
  const [filterVinculadoOS, setFilterVinculadoOS] = useState<'all' | 'yes' | 'no'>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [atendentes, setAtendentes] = useState<any[]>([]);

  useEffect(() => {
    loadColunas();
    loadAtendentes();
  }, []);

  const loadColunas = async () => {
    const { data } = await supabase
      .from('atom_connect_pipeline_colunas')
      .select('*')
      .order('ordem');
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
      filtered = filtered.filter(c =>
        c.cliente_nome?.toLowerCase().includes(term) ||
        c.cliente_telefone.includes(term) ||
        c.ultima_mensagem?.toLowerCase().includes(term)
      );
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
  }, [conversas, searchTerm, filterAtendente, filterVendedor, filterDiasSemRetorno, filterVinculadoOS, usuario]);

  const getConversasByColuna = (colunaId: string) => {
    return filteredConversas
      .filter(c => c.coluna_pipeline === colunaId)
      .sort((a, b) => new Date(b.ultima_mensagem_at).getTime() - new Date(a.ultima_mensagem_at).getTime());
  };

  const handleDragStart = (e: React.DragEvent, conversa: Conversa) => {
    setDraggedConversa(conversa);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, colunaId: string) => {
    e.preventDefault();
    setDragOverColumn(colunaId);
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
  };

  const handleDrop = async (e: React.DragEvent, colunaId: string) => {
    e.preventDefault();
    setDragOverColumn(null);

    if (!draggedConversa || draggedConversa.coluna_pipeline === colunaId) {
      setDraggedConversa(null);
      return;
    }

    await supabase
      .from('atom_connect_conversas')
      .update({ coluna_pipeline: colunaId })
      .eq('id', draggedConversa.id);

    setDraggedConversa(null);
    onUpdateConversa();
  };

  const isSLABreached = (conversa: Conversa, coluna: PipelineColuna): boolean => {
    if (!coluna.sla_minutos || !conversa.ultima_resposta_cliente_at) return false;
    const lastResponse = new Date(conversa.ultima_resposta_cliente_at);
    const now = new Date();
    const diffMinutes = (now.getTime() - lastResponse.getTime()) / (1000 * 60);
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
      .update({ atendente_id: usuario?.id })
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
            const isDropTarget = dragOverColumn === coluna.id;

            return (
              <div
                key={coluna.id}
                className={`min-w-[280px] w-[280px] flex-shrink-0 flex flex-col h-full transition-all duration-200 ${
                  idx > 0 ? 'border-l border-white/[0.04]' : ''
                }`}
                style={{
                  background: isDropTarget ? `${coluna.cor}08` : 'transparent',
                }}
                onDragOver={(e) => handleDragOver(e, coluna.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, coluna.id)}
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
                      <div>
                        <h3 className="text-xs font-semibold text-white/80">{coluna.nome}</h3>
                        <p className="text-[11px] text-white/30">{columnConversas.length} cliente{columnConversas.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    {coluna.sla_minutos && (
                      <div className="flex items-center gap-1 text-[10px] text-white/25 px-1.5 py-0.5 rounded bg-white/[0.03]">
                        <Clock className="w-3 h-3" />
                        {coluna.sla_minutos}min
                      </div>
                    )}
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
                          draggable
                          onDragStart={(e: any) => handleDragStart(e, conversa)}
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
                              ) : (
                                <User className="w-3.5 h-3.5" style={{ color: coluna.cor }} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h4 className="text-xs font-medium text-white/85 truncate">
                                  {conversa.cliente_nome || conversa.cliente_telefone}
                                </h4>
                                <span className="text-[10px] text-white/20 ml-1 flex-shrink-0">
                                  {getTimeAgo(conversa.ultima_mensagem_at)}
                                </span>
                              </div>
                              <p className="text-[11px] text-white/30 flex items-center gap-0.5 mt-0.5">
                                <Phone className="w-3 h-3" />
                                {conversa.cliente_telefone}
                              </p>
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
                                  Bot
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
                              <div className="w-5 h-5 rounded-full bg-white/[0.06] flex items-center justify-center overflow-hidden border border-white/[0.08]">
                                {atendente.foto_url ? (
                                  <img src={atendente.foto_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[9px] text-white/40">{atendente.nome?.charAt(0)}</span>
                                )}
                              </div>
                            ) : (
                              <button
                                onClick={(e) => assignToMe(conversa, e)}
                                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] text-white/20 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all opacity-0 group-hover:opacity-100"
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
    </div>
  );
}
