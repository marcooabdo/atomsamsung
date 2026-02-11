import { useState, useEffect, useMemo } from 'react';
import {
  Bot, Clock, DollarSign, Package, Wrench, CheckCircle, MapPin, Star,
  Phone, MessageSquare, User, MoreVertical, AlertTriangle, ArrowRight,
  Calendar, Navigation, Filter, Plus, Eye, UserPlus, Link2
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
  Bot,
  Clock,
  DollarSign,
  Package,
  Wrench,
  CheckCircle,
  MapPin,
  Star,
  MessageSquare
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

  return (
    <div className="h-full flex flex-col">
      {/* Filter Bar */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white/5 rounded-lg p-1">
            <button
              onClick={() => setFilterAtendente('all')}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                filterAtendente === 'all' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterAtendente('mine')}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                filterAtendente === 'mine' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Meus
            </button>
            <button
              onClick={() => setFilterAtendente('unassigned')}
              className={`px-3 py-1.5 rounded-md text-sm transition-colors ${
                filterAtendente === 'unassigned' ? 'bg-white/10 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Sem Atendente
            </button>
          </div>

          <span className="text-sm text-gray-500">
            {filteredConversas.length} conversa{filteredConversas.length !== 1 ? 's' : ''}
          </span>
        </div>

        <button
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            backgroundColor: `${accentColor}20`,
            color: accentColor,
            border: `1px solid ${accentColor}40`
          }}
        >
          <Plus className="w-4 h-4" />
          Nova Conversa
        </button>
      </div>

      {/* Kanban Board */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        <div className="flex gap-4 h-full min-w-max">
          {colunas.map(coluna => {
            const Icon = ICON_MAP[coluna.icone] || MessageSquare;
            const columnConversas = getConversasByColuna(coluna.id);
            const isDropTarget = dragOverColumn === coluna.id;

            return (
              <div
                key={coluna.id}
                className={`w-80 flex-shrink-0 flex flex-col rounded-xl transition-all duration-200 ${
                  isDropTarget ? 'ring-2 ring-offset-2 ring-offset-[#0A0A0F]' : ''
                }`}
                style={{
                  backgroundColor: isDropTarget ? `${coluna.cor}10` : 'rgba(255,255,255,0.03)',
                  ringColor: isDropTarget ? coluna.cor : undefined
                }}
                onDragOver={(e) => handleDragOver(e, coluna.id)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, coluna.id)}
              >
                {/* Column Header */}
                <div className="flex-shrink-0 p-4 border-b border-white/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: `${coluna.cor}20` }}
                      >
                        <Icon className="w-4 h-4" style={{ color: coluna.cor }} />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-white">{coluna.nome}</h3>
                        <p className="text-xs text-gray-500">{columnConversas.length} cliente{columnConversas.length !== 1 ? 's' : ''}</p>
                      </div>
                    </div>
                    {coluna.sla_minutos && (
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="w-3 h-3" />
                        {coluna.sla_minutos}min
                      </div>
                    )}
                  </div>
                </div>

                {/* Cards */}
                <div className="flex-1 overflow-y-auto p-2 space-y-2">
                  <AnimatePresence>
                    {columnConversas.map(conversa => {
                      const slaBreached = isSLABreached(conversa, coluna);
                      const atendente = atendentes.find(a => a.id === conversa.atendente_id);

                      return (
                        <motion.div
                          key={conversa.id}
                          layout
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.9 }}
                          draggable
                          onDragStart={(e: any) => handleDragStart(e, conversa)}
                          onClick={() => onSelectConversa(conversa)}
                          className={`p-3 rounded-lg bg-white/5 border cursor-pointer transition-all duration-200 hover:bg-white/10 ${
                            slaBreached ? 'animate-pulse border-red-500/50' : 'border-white/10 hover:border-white/20'
                          }`}
                          style={slaBreached ? {
                            boxShadow: '0 0 20px rgba(239, 68, 68, 0.3)'
                          } : undefined}
                        >
                          {/* SLA Warning */}
                          {slaBreached && (
                            <div className="flex items-center gap-2 mb-2 text-xs text-red-400">
                              <AlertTriangle className="w-3 h-3" />
                              SLA excedido
                            </div>
                          )}

                          {/* Client Info */}
                          <div className="flex items-start gap-3">
                            <div
                              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
                              style={{
                                backgroundColor: conversa.cliente_foto_url ? 'transparent' : `${coluna.cor}20`,
                                border: conversa.os_id ? `2px solid ${accentColor}` : undefined
                              }}
                            >
                              {conversa.cliente_foto_url ? (
                                <img
                                  src={conversa.cliente_foto_url}
                                  alt=""
                                  className="w-full h-full rounded-full object-cover"
                                />
                              ) : (
                                <User className="w-5 h-5" style={{ color: coluna.cor }} />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between">
                                <h4 className="text-sm font-medium text-white truncate">
                                  {conversa.cliente_nome || conversa.cliente_telefone}
                                </h4>
                                <span className="text-xs text-gray-500">
                                  {getTimeAgo(conversa.ultima_mensagem_at)}
                                </span>
                              </div>
                              <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                <Phone className="w-3 h-3" />
                                {conversa.cliente_telefone}
                              </p>
                            </div>
                          </div>

                          {/* Last Message */}
                          {conversa.ultima_mensagem && (
                            <p className="mt-2 text-xs text-gray-400 line-clamp-2">
                              {conversa.ultima_mensagem}
                            </p>
                          )}

                          {/* Tags & Status */}
                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {conversa.mensagens_nao_lidas > 0 && (
                                <span
                                  className="px-2 py-0.5 rounded-full text-xs font-bold text-black"
                                  style={{ backgroundColor: accentColor }}
                                >
                                  {conversa.mensagens_nao_lidas}
                                </span>
                              )}
                              {conversa.is_bot_ativo && (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-purple-500/20 text-purple-400">
                                  <Bot className="w-3 h-3" />
                                  Bot
                                </span>
                              )}
                              {conversa.os_id && (
                                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-500/20 text-blue-400">
                                  <Link2 className="w-3 h-3" />
                                  OS
                                </span>
                              )}
                            </div>

                            {/* Atendente */}
                            {atendente ? (
                              <div className="flex items-center gap-1">
                                <div className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                                  {atendente.foto_url ? (
                                    <img src={atendente.foto_url} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-[8px] text-gray-400">{atendente.nome?.charAt(0)}</span>
                                  )}
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={(e) => assignToMe(conversa, e)}
                                className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white transition-colors"
                              >
                                <UserPlus className="w-3 h-3" />
                                Assumir
                              </button>
                            )}
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>

                  {columnConversas.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-8 text-gray-600">
                      <Icon className="w-8 h-8 mb-2 opacity-50" />
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
