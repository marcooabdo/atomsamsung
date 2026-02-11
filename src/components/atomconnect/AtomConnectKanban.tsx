import { useState, useEffect, useMemo } from 'react';
import {
  Bot, Clock, DollarSign, Package, Wrench, CheckCircle, MapPin, Star,
  Phone, MessageSquare, User, AlertTriangle,
  Plus, UserPlus, Link2
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
  accentColor: string;
}

const ICON_MAP: Record<string, any> = {
  Bot, Clock, DollarSign, Package, Wrench, CheckCircle, MapPin, Star, MessageSquare
};

export function AtomConnectKanban({ conversas, searchTerm, onSelectConversa, onUpdateConversa, accentColor }: Props) {
  const { usuario, unidadeAtual } = useAuth();
  const [colunas, setColunas] = useState<PipelineColuna[]>([]);
  const [draggedConversa, setDraggedConversa] = useState<Conversa | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [filterAtendente, setFilterAtendente] = useState<'all' | 'mine' | 'unassigned'>('all');
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
    if (!unidadeAtual) return;
    const { data } = await supabase
      .from('usuarios')
      .select('id, nome, foto_url')
      .eq('unidade_id', unidadeAtual)
      .eq('ativo', true);
    if (data) setAtendentes(data);
  };

  const filteredConversas = useMemo(() => {
    let filtered = conversas;

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

    return filtered;
  }, [conversas, searchTerm, filterAtendente, usuario]);

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
                className={`px-3 py-1 rounded-md text-[11px] font-medium transition-all ${
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

          <div className="flex items-center gap-1.5 text-[11px] text-white/20">
            <div className="w-1.5 h-1.5 rounded-full bg-cyan-400/40" />
            {totalConversas} conversa{totalConversas !== 1 ? 's' : ''}
          </div>
        </div>

        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-cyan-400 transition-all hover:bg-cyan-500/10"
          style={{ border: '1px solid rgba(0,212,255,0.15)' }}
        >
          <Plus className="w-3 h-3" />
          Nova Conversa
        </button>
      </div>

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
                className={`min-w-[260px] w-[260px] flex-shrink-0 flex flex-col h-full transition-all duration-200 ${
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
                        <h3 className="text-[11px] font-semibold text-white/80">{coluna.nome}</h3>
                        <p className="text-[9px] text-white/20">{columnConversas.length} cliente{columnConversas.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    {coluna.sla_minutos && (
                      <div className="flex items-center gap-1 text-[9px] text-white/20 px-1.5 py-0.5 rounded bg-white/[0.03]">
                        <Clock className="w-2.5 h-2.5" />
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
                              : 'border border-white/[0.04] bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/[0.08]'
                          }`}
                        >
                          {slaBreached && (
                            <div className="flex items-center gap-1 mb-1.5 text-[9px] text-red-400 font-medium">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              SLA excedido
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
                                <h4 className="text-[11px] font-medium text-white/80 truncate">
                                  {conversa.cliente_nome || conversa.cliente_telefone}
                                </h4>
                                <span className="text-[9px] text-white/15 ml-1 flex-shrink-0">
                                  {getTimeAgo(conversa.ultima_mensagem_at)}
                                </span>
                              </div>
                              <p className="text-[9px] text-white/25 flex items-center gap-0.5 mt-0.5">
                                <Phone className="w-2.5 h-2.5" />
                                {conversa.cliente_telefone}
                              </p>
                            </div>
                          </div>

                          {conversa.ultima_mensagem && (
                            <p className="mt-1.5 text-[10px] text-white/25 line-clamp-2 leading-relaxed">
                              {conversa.ultima_mensagem}
                            </p>
                          )}

                          <div className="mt-2 flex items-center justify-between">
                            <div className="flex items-center gap-1">
                              {conversa.mensagens_nao_lidas > 0 && (
                                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold text-black bg-cyan-400" style={{ boxShadow: '0 0 6px #00D4FF40' }}>
                                  {conversa.mensagens_nao_lidas}
                                </span>
                              )}
                              {conversa.is_bot_ativo && (
                                <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] bg-violet-500/15 text-violet-400">
                                  <Bot className="w-2.5 h-2.5" />
                                  Bot
                                </span>
                              )}
                              {conversa.os_id && (
                                <span className="flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[9px] bg-blue-500/15 text-blue-400">
                                  <Link2 className="w-2.5 h-2.5" />
                                  OS
                                </span>
                              )}
                            </div>

                            {atendente ? (
                              <div className="w-5 h-5 rounded-full bg-white/[0.06] flex items-center justify-center overflow-hidden border border-white/[0.08]">
                                {atendente.foto_url ? (
                                  <img src={atendente.foto_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[7px] text-white/40">{atendente.nome?.charAt(0)}</span>
                                )}
                              </div>
                            ) : (
                              <button
                                onClick={(e) => assignToMe(conversa, e)}
                                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] text-white/20 hover:text-cyan-400 hover:bg-cyan-500/10 transition-all opacity-0 group-hover:opacity-100"
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
                      <p className="text-[10px]">Nenhum cliente</p>
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
