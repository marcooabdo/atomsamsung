import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  MessageSquare, Users, BarChart3, Settings, Zap, Bell, Search,
  AlertTriangle, ArrowRight,
  X, Volume2, VolumeX, Megaphone, GitBranch, Radio, Building2, ChevronDown
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { ModalProvider } from '../contexts/ModalContext';
import { motion, AnimatePresence } from 'framer-motion';
import { AtomConnectKanban } from '../components/atomconnect/AtomConnectKanban';
import { AtomConnectChat } from '../components/atomconnect/AtomConnectChat';
import { AtomConnectDashboard } from '../components/atomconnect/AtomConnectDashboard';
import { AtomConnectMarketing } from '../components/atomconnect/AtomConnectMarketing';
import { AtomConnectAutomation } from '../components/atomconnect/AtomConnectAutomation';
import { AtomConnectSettings } from '../components/atomconnect/AtomConnectSettings';
import { AtomConnectNotification } from '../components/atomconnect/AtomConnectNotification';
import { NovaConversaModal } from '../components/atomconnect/NovaConversaModal';

type TabType = 'kanban' | 'dashboard' | 'marketing' | 'automation' | 'settings';

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
  is_group?: boolean;
  group_jid?: string | null;
  cliente_digitando?: string | null;
  cliente_digitando_at?: string | null;
  created_at: string;
}

interface Notification {
  id: string;
  type: 'message' | 'transfer' | 'sla';
  title: string;
  message: string;
  conversaId?: string;
  timestamp: Date;
}

export default function AtomConnect() {
  const { usuario, unidadeAtual, unidades } = useAuth();
  const { theme } = useTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<TabType>('kanban');
  const [conversas, setConversas] = useState<Conversa[]>([]);
  const [selectedConversa, setSelectedConversa] = useState<Conversa | null>(null);
  const [showChat, setShowChat] = useState(false);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNovaConversa, setShowNovaConversa] = useState(false);
  const [showUnidadeFilter, setShowUnidadeFilter] = useState(false);
  const [deepSearchIds, setDeepSearchIds] = useState<string[]>([]);

  const canFilterUnits = (usuario?.tipo === 'master' || usuario?.tipo === 'diretoria') && !usuario?.unidade_id;
  const [selectedUnidadeFilter, setSelectedUnidadeFilter] = useState<string | null>(canFilterUnits ? null : (unidadeAtual || null));
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const lastNotifiedRef = useRef<Record<string, number>>({});
  const selectedConversaRef = useRef<Conversa | null>(null);
  const lastNotificationTimeRef = useRef<Record<string, number>>({});
  const deepLinkProcessedRef = useRef(false);

  const loadConversas = useCallback(async () => {
    const filterUnidade = selectedUnidadeFilter || unidadeAtual;
    const buildQuery = (finalizadas: boolean) => {
      let q = supabase
        .from('atom_connect_conversas')
        .select('*')
        .order('ultima_mensagem_at', { ascending: false });

      if (filterUnidade) {
        q = q.eq('unidade_id', filterUnidade);
      } else if (usuario?.nivel !== 'master' && usuario?.unidade_id) {
        q = q.eq('unidade_id', usuario.unidade_id);
      }

      if (finalizadas) {
        q = q.eq('coluna_pipeline', 'finalizado_nps');
      } else {
        q = q.neq('coluna_pipeline', 'finalizado_nps');
      }

      return q;
    };

    // Fase 1: carrega conversas ativas imediatamente
    const { data: ativas, error } = await buildQuery(false);
    if (!error && ativas) {
      setConversas(ativas);
      const unread = ativas.reduce((acc, c) => acc + (c.mensagens_nao_lidas || 0), 0);
      setUnreadCount(unread);
    }
    setLoading(false);

    // Fase 2: carrega finalizadas em background sem bloquear a UI
    const { data: finalizadas } = await buildQuery(true);
    if (finalizadas && finalizadas.length > 0) {
      setConversas(prev => {
        const existingIds = new Set(prev.map(c => c.id));
        const novas = finalizadas.filter(c => !existingIds.has(c.id));
        return novas.length > 0 ? [...prev, ...novas] : prev;
      });
    }
  }, [selectedUnidadeFilter, unidadeAtual, usuario]);

  useEffect(() => {
    loadConversas();
  }, [loadConversas]);

  useEffect(() => {
    if (!searchTerm || searchTerm.length < 3) {
      setDeepSearchIds([]);
      return;
    }
    const timeout = setTimeout(async () => {
      try {
        const { data } = await supabase
          .from('atom_connect_mensagens')
          .select('conversa_id')
          .ilike('conteudo', `%${searchTerm}%`)
          .limit(50);

        if (data) {
          const ids = [...new Set(data.map(m => m.conversa_id))];
          setDeepSearchIds(ids);
        }
      } catch {
        setDeepSearchIds([]);
      }
    }, 500);
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  useEffect(() => {
    if (deepLinkProcessedRef.current || loading) return;
    const osId = searchParams.get('os_id');
    const phone = searchParams.get('phone');
    if (!osId || !phone) return;

    deepLinkProcessedRef.current = true;
    setSearchParams({}, { replace: true });

    (async () => {
      const formattedPhone = phone.startsWith('55') ? phone : `55${phone}`;
      const targetUnidade = selectedUnidadeFilter || unidadeAtual || usuario?.unidade_id;

      const { data: existing } = await supabase
        .from('atom_connect_conversas')
        .select('*')
        .eq('cliente_telefone', formattedPhone)
        .eq('unidade_id', targetUnidade!)
        .maybeSingle();

      if (existing) {
        if (!existing.os_id) {
          await supabase
            .from('atom_connect_conversas')
            .update({ os_id: osId })
            .eq('id', existing.id);
          existing.os_id = osId;
        }
        setSelectedConversa(existing);
        setShowChat(true);
        await loadConversas();
        return;
      }

      const { data: osInfo } = await supabase
        .from('os')
        .select('id, cliente_nome')
        .eq('id', osId)
        .maybeSingle();

      let colQuery = supabase
        .from('atom_connect_pipeline_colunas')
        .select('id')
        .order('ordem', { ascending: true })
        .limit(1);

      if (targetUnidade) {
        colQuery = colQuery.or(`unidade_id.is.null,unidade_id.eq.${targetUnidade}`);
      }

      const { data: firstColumn } = await colQuery.maybeSingle();

      const { data: newConversa } = await supabase
        .from('atom_connect_conversas')
        .insert({
          unidade_id: targetUnidade!,
          cliente_telefone: formattedPhone,
          cliente_nome: osInfo?.cliente_nome || null,
          os_id: osId,
          coluna_pipeline: firstColumn?.id || 'bot_triagem',
          atendente_id: usuario?.id || null,
          is_bot_ativo: false,
          tipo_atendimento: 'whatsapp',
          prioridade: 'normal',
          ultima_mensagem_at: new Date().toISOString()
        })
        .select()
        .single();

      if (newConversa) {
        setSelectedConversa(newConversa);
        setShowChat(true);
        await loadConversas();
      }
    })();
  }, [searchParams, loading, selectedUnidadeFilter, unidadeAtual, usuario]);

  useEffect(() => {
    selectedConversaRef.current = selectedConversa;
  }, [selectedConversa]);

  useEffect(() => {
    const filterUnidadeId = selectedUnidadeFilter || unidadeAtual || (usuario?.nivel !== 'master' ? usuario?.unidade_id : null);

    const channelConfig: any = {
      event: '*',
      schema: 'public',
      table: 'atom_connect_conversas'
    };

    if (filterUnidadeId) {
      channelConfig.filter = `unidade_id=eq.${filterUnidadeId}`;
    }

    const channel = supabase
      .channel(`atom-connect-rt-${filterUnidadeId || 'all'}`)
      .on('postgres_changes', channelConfig, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newConversa = payload.new as Conversa;
          setConversas(prev => {
            const exists = prev.some(c => c.id === newConversa.id);
            if (exists) return prev;
            return [newConversa, ...prev];
          });
          if (newConversa.mensagens_nao_lidas > 0) {
            const now = Date.now();
            const lastTime = lastNotificationTimeRef.current[newConversa.id] || 0;
            if (now - lastTime > 2000) {
              lastNotifiedRef.current[newConversa.id] = newConversa.mensagens_nao_lidas;
              lastNotificationTimeRef.current[newConversa.id] = now;
              showNewMessageNotification(newConversa);
            }
          }
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as Conversa;
          setConversas(prev => prev.map(c => c.id === updated.id ? updated : c));
          if (selectedConversaRef.current?.id === updated.id) {
            setSelectedConversa(updated);
          }
          const previousUnread = lastNotifiedRef.current[updated.id] ?? 0;
          if (updated.mensagens_nao_lidas > previousUnread) {
            const now = Date.now();
            const lastTime = lastNotificationTimeRef.current[updated.id] || 0;
            if (now - lastTime > 2000) {
              lastNotifiedRef.current[updated.id] = updated.mensagens_nao_lidas;
              lastNotificationTimeRef.current[updated.id] = now;
              showNewMessageNotification(updated);
            } else {
              lastNotifiedRef.current[updated.id] = updated.mensagens_nao_lidas;
            }
          } else {
            lastNotifiedRef.current[updated.id] = updated.mensagens_nao_lidas;
          }
        } else if (payload.eventType === 'DELETE') {
          setConversas(prev => prev.filter(c => c.id !== payload.old.id));
          delete lastNotifiedRef.current[payload.old.id];
          delete lastNotificationTimeRef.current[payload.old.id];
        }
      })
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'atom_connect_transferencias'
        },
        (payload) => {
          const transfer = payload.new as any;
          if (transfer.para_usuario_id === usuario?.id) {
            showTransferNotification(transfer);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [selectedUnidadeFilter, unidadeAtual, usuario]);

  const showNewMessageNotification = (conversa: Conversa) => {
    const notification: Notification = {
      id: crypto.randomUUID(),
      type: 'message',
      title: conversa.cliente_nome || conversa.cliente_telefone,
      message: conversa.ultima_mensagem || 'Nova mensagem',
      conversaId: conversa.id,
      timestamp: new Date()
    };
    setNotifications(prev => [notification, ...prev.slice(0, 9)]);

    if (soundEnabled && audioRef.current) {
      audioRef.current.play().catch(() => {});
    }

  };

  const showTransferNotification = async (transfer: any) => {
    const { data: conversa } = await supabase
      .from('atom_connect_conversas')
      .select('*')
      .eq('id', transfer.conversa_id)
      .maybeSingle();

    if (conversa) {
      const notification: Notification = {
        id: crypto.randomUUID(),
        type: 'transfer',
        title: 'Atendimento Transferido',
        message: `${conversa.cliente_nome || conversa.cliente_telefone} foi transferido para você`,
        conversaId: conversa.id,
        timestamp: new Date()
      };
      setNotifications(prev => [notification, ...prev.slice(0, 9)]);

      if (soundEnabled && audioRef.current) {
        audioRef.current.play().catch(() => {});
      }
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (notification.conversaId) {
      const conversa = conversas.find(c => c.id === notification.conversaId);
      if (conversa) {
        setSelectedConversa(conversa);
        setShowChat(true);
      }
    }
    setShowNotifications(false);
  };

  const dismissNotification = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };


  const handleNovaConversaCriada = async (conversaId: string) => {
    setShowNovaConversa(false);
    await loadConversas();
    const { data } = await supabase
      .from('atom_connect_conversas')
      .select('*')
      .eq('id', conversaId)
      .maybeSingle();
    if (data) {
      setSelectedConversa(data);
      setShowChat(true);
    }
  };

  const tabs = [
    { id: 'kanban' as TabType, label: 'Pipeline', icon: Users },
    { id: 'dashboard' as TabType, label: 'Dashboard', icon: BarChart3 },
    { id: 'marketing' as TabType, label: 'Marketing', icon: Megaphone },
    { id: 'automation' as TabType, label: 'Automacao', icon: GitBranch },
    { id: 'settings' as TabType, label: 'Configuracoes', icon: Settings },
  ];

  const accentColor = '#00D4FF';

  return (
    <ModalProvider>
      <div className="-m-6 h-screen flex flex-col overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <audio ref={audioRef} src="/notification.mp3" preload="auto" />

      {/* Top Bar */}
      <header className="flex-shrink-0" style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)' }}>
        <div className="h-16 flex items-center justify-between px-5 relative">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div
                className="w-7 h-7 rounded-lg flex items-center justify-center"
                style={{ background: 'linear-gradient(135deg, #00D4FF15, #00D4FF30)' }}
              >
                <Radio className="w-3.5 h-3.5 text-cyan-400" />
              </div>
              <div className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-400" style={{ boxShadow: '0 0 6px #10b981' }} />
            </div>
            <div>
              <h1 className="text-xs font-bold text-white tracking-wider">ATOM CONNECT</h1>
              <p className="text-[9px] text-cyan-500/60 font-medium tracking-wide">CENTRAL DE ATENDIMENTO</p>
            </div>
          </div>

          {/* Unit Filter - Center - ALWAYS VISIBLE */}
          <div className="absolute left-1/2 -translate-x-1/2">
            <div className="relative">
              {canFilterUnits ? (
                <>
                  <button
                    onClick={() => setShowUnidadeFilter(!showUnidadeFilter)}
                    className="flex items-center gap-3 px-6 py-2.5 rounded-xl border-2 border-cyan-400/60 bg-gradient-to-r from-cyan-500/25 to-cyan-600/25 text-cyan-300 hover:from-cyan-500/35 hover:to-cyan-600/35 hover:border-cyan-400/80 transition-all shadow-lg animate-pulse"
                    style={{ boxShadow: '0 0 25px rgba(0, 212, 255, 0.5), inset 0 0 20px rgba(0, 212, 255, 0.15)' }}
                  >
                    <Building2 className="w-5 h-5" />
                    <span className="text-sm font-bold tracking-wide">
                      {selectedUnidadeFilter && unidades
                        ? unidades.find(u => u.id === selectedUnidadeFilter)?.nome || 'FILTRO DE UNIDADES'
                        : 'TODAS AS UNIDADES'}
                    </span>
                    <ChevronDown className="w-4 h-4" />
                  </button>

                  <AnimatePresence>
                    {showUnidadeFilter && (
                      <motion.div
                        initial={{ opacity: 0, y: 8, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 8, scale: 0.96 }}
                        className="absolute left-1/2 -translate-x-1/2 top-14 w-72 max-h-80 overflow-y-auto rounded-xl border-2 border-cyan-400/40 shadow-2xl z-50"
                        style={{
                          background: 'var(--bg-card)',
                          border: '2px solid rgba(var(--accent-rgb), 0.3)',
                          boxShadow: '0 0 30px rgba(var(--accent-rgb), 0.2)'
                        }}
                      >
                        <button
                          onClick={() => {
                            setSelectedUnidadeFilter(null);
                            setShowUnidadeFilter(false);
                          }}
                          className={`w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.08] transition-colors ${
                            !selectedUnidadeFilter ? 'bg-cyan-500/20 text-cyan-300 border-l-4 border-cyan-400' : 'text-white/70'
                          }`}
                        >
                          <Building2 className="w-5 h-5" />
                          <span className="text-sm font-bold">TODAS AS UNIDADES</span>
                        </button>
                        {unidades && unidades.length > 0 ? (
                          unidades.map(unidade => (
                            <button
                              key={unidade.id}
                              onClick={() => {
                                setSelectedUnidadeFilter(unidade.id);
                                setShowUnidadeFilter(false);
                              }}
                              className={`w-full flex items-center gap-3 px-4 py-3.5 text-left hover:bg-white/[0.08] transition-colors ${
                                selectedUnidadeFilter === unidade.id ? 'bg-cyan-500/20 text-cyan-300 border-l-4 border-cyan-400' : 'text-white/70'
                              }`}
                            >
                              <Building2 className="w-5 h-5" />
                              <span className="text-sm font-medium">{unidade.nome}</span>
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-3.5 text-white/50 text-sm text-center">
                            Nenhuma unidade disponivel
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </>
              ) : (
                <div className="flex items-center gap-3 px-6 py-2.5 rounded-xl border-2 border-cyan-400/30 bg-cyan-500/10 text-cyan-300">
                  <Building2 className="w-5 h-5" />
                  <span className="text-sm font-bold tracking-wide">
                    {unidades?.find(u => u.id === unidadeAtual)?.nome || 'Sua Unidade'}
                  </span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20" />
              <input
                type="text"
                placeholder="Nome, telefone, OS, mensagem..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-56 pl-8 pr-8 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[11px] text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/30 focus:bg-white/[0.06] transition-all"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-white/10"
                >
                  <X className="w-3 h-3 text-white/30" />
                </button>
              )}
            </div>

            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
            >
              {soundEnabled ? (
                <Volume2 className="w-3.5 h-3.5 text-white/30" />
              ) : (
                <VolumeX className="w-3.5 h-3.5 text-white/15" />
              )}
            </button>

            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-1.5 rounded-lg hover:bg-white/[0.06] transition-colors"
              >
                <Bell className="w-3.5 h-3.5 text-white/30" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 rounded-full text-[8px] font-bold flex items-center justify-center text-black bg-cyan-400" style={{ boxShadow: '0 0 8px #00D4FF60' }}>
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    className="absolute right-0 top-9 w-72 max-h-80 overflow-y-auto rounded-xl border border-white/[0.08] shadow-2xl z-50"
                    style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
                  >
                    <div className="p-3" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                      <h3 className="font-semibold text-xs" style={{ color: 'var(--text-primary)' }}>Notificacoes</h3>
                    </div>
                    {notifications.length === 0 ? (
                      <div className="p-5 text-center text-white/20 text-xs">
                        Nenhuma notificacao
                      </div>
                    ) : (
                      notifications.map(n => (
                        <div
                          key={n.id}
                          className="p-2.5 border-b border-white/[0.04] hover:bg-white/[0.04] cursor-pointer transition-colors"
                          onClick={() => handleNotificationClick(n)}
                        >
                          <div className="flex items-start gap-2.5">
                            <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-cyan-500/10">
                              {n.type === 'message' ? (
                                <MessageSquare className="w-3.5 h-3.5 text-cyan-400" />
                              ) : n.type === 'transfer' ? (
                                <ArrowRight className="w-3.5 h-3.5 text-cyan-400" />
                              ) : (
                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[11px] font-medium text-white truncate">{n.title}</p>
                              <p className="text-[10px] text-white/40 truncate">{n.message}</p>
                            </div>
                            <button
                              onClick={(e) => { e.stopPropagation(); dismissNotification(n.id); }}
                              className="p-0.5 hover:bg-white/10 rounded"
                            >
                              <X className="w-2.5 h-2.5 text-white/20" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Horizontal Tabs */}
        <div className="flex items-center px-5 gap-0.5">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-3.5 py-2 text-[11px] font-medium transition-all duration-200 ${
                  isActive ? 'text-cyan-400' : 'text-white/30 hover:text-white/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {isActive && (
                  <motion.div
                    layoutId="connectTabIndicator"
                    className="absolute bottom-0 left-1 right-1 h-[2px] rounded-full bg-cyan-400"
                    style={{ boxShadow: '0 0 10px #00D4FF60, 0 0 20px #00D4FF20' }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        <main className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === 'kanban' && (
              <motion.div
                key="kanban"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="h-full"
              >
                <AtomConnectKanban
                  conversas={conversas}
                  searchTerm={searchTerm}
                  deepSearchIds={deepSearchIds}
                  onSelectConversa={(c) => {
                    setSelectedConversa(c);
                    setShowChat(true);
                  }}
                  onUpdateConversa={loadConversas}
                  onNovaConversa={() => setShowNovaConversa(true)}
                  accentColor={accentColor}
                  unidadeId={selectedUnidadeFilter || unidadeAtual || undefined}
                />
              </motion.div>
            )}
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="h-full"
              >
                <AtomConnectDashboard accentColor={accentColor} unidadeId={selectedUnidadeFilter || unidadeAtual || undefined} />
              </motion.div>
            )}
            {activeTab === 'marketing' && (
              <motion.div
                key="marketing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="h-full"
              >
                <AtomConnectMarketing accentColor={accentColor} unidadeId={selectedUnidadeFilter || unidadeAtual || undefined} />
              </motion.div>
            )}
            {activeTab === 'automation' && (
              <motion.div
                key="automation"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="h-full"
              >
                <AtomConnectAutomation accentColor={accentColor} unidadeId={selectedUnidadeFilter || unidadeAtual || undefined} />
              </motion.div>
            )}
            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
                className="h-full"
              >
                <AtomConnectSettings accentColor={accentColor} unidadeId={selectedUnidadeFilter || unidadeAtual || undefined} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <AnimatePresence>
          {showChat && selectedConversa && (
            <AtomConnectChat
              conversa={selectedConversa}
              onClose={() => {
                setShowChat(false);
                setSelectedConversa(null);
              }}
              onUpdate={loadConversas}
              accentColor={accentColor}
              unidadeId={selectedUnidadeFilter || unidadeAtual || undefined}
            />
          )}
        </AnimatePresence>
      </div>

      <AtomConnectNotification
        notifications={notifications}
        onDismiss={dismissNotification}
        onClick={handleNotificationClick}
        accentColor={accentColor}
      />

      <AnimatePresence>
        {showNovaConversa && (
          <NovaConversaModal
            accentColor={accentColor}
            onClose={() => setShowNovaConversa(false)}
            onConversaCriada={handleNovaConversaCriada}
          />
        )}
      </AnimatePresence>
      </div>
    </ModalProvider>
  );
}
