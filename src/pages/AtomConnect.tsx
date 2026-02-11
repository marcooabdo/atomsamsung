import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MessageSquare, Users, BarChart3, Settings, Zap, Bell, Search,
  AlertTriangle, ArrowRight,
  X, Volume2, VolumeX, Megaphone, GitBranch, Radio
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadConversas = useCallback(async () => {
    let query = supabase
      .from('atom_connect_conversas')
      .select('*')
      .order('ultima_mensagem_at', { ascending: false });

    if (unidadeAtual) {
      query = query.eq('unidade_id', unidadeAtual);
    } else if (usuario?.nivel !== 'master' && usuario?.unidade_id) {
      query = query.eq('unidade_id', usuario.unidade_id);
    }

    const { data, error } = await query;

    if (!error && data) {
      setConversas(data);
      const unread = data.reduce((acc, c) => acc + (c.mensagens_nao_lidas || 0), 0);
      setUnreadCount(unread);
    }
    setLoading(false);
  }, [unidadeAtual, usuario]);

  useEffect(() => {
    loadConversas();
  }, [loadConversas]);

  useEffect(() => {
    const filterUnidadeId = unidadeAtual || (usuario?.nivel !== 'master' ? usuario?.unidade_id : null);

    const channelConfig: any = {
      event: '*',
      schema: 'public',
      table: 'atom_connect_conversas'
    };

    if (filterUnidadeId) {
      channelConfig.filter = `unidade_id=eq.${filterUnidadeId}`;
    }

    const channel = supabase
      .channel('atom-connect-realtime')
      .on('postgres_changes', channelConfig, (payload) => {
        if (payload.eventType === 'INSERT') {
          const newConversa = payload.new as Conversa;
          setConversas(prev => [newConversa, ...prev]);
          showNewMessageNotification(newConversa);
        } else if (payload.eventType === 'UPDATE') {
          const updated = payload.new as Conversa;
          setConversas(prev => prev.map(c => c.id === updated.id ? updated : c));
          if (selectedConversa?.id === updated.id) {
            setSelectedConversa(updated);
          }
          if (updated.mensagens_nao_lidas > 0 && !updated.atendente_id) {
            showNewMessageNotification(updated);
          }
        } else if (payload.eventType === 'DELETE') {
          setConversas(prev => prev.filter(c => c.id !== payload.old.id));
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
  }, [unidadeAtual, selectedConversa, usuario]);

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

    if (Notification.permission === 'granted') {
      new Notification(notification.title, {
        body: notification.message,
        icon: '/2_-_icone_branco_com_fundo_preto.png'
      });
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
        message: `${conversa.cliente_nome || conversa.cliente_telefone} foi transferido para voce`,
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

  useEffect(() => {
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  }, []);

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
    <div className="-m-6 h-screen flex flex-col overflow-hidden" style={{ background: 'linear-gradient(180deg, #060610 0%, #0A0A18 50%, #080814 100%)' }}>
      <audio ref={audioRef} src="/notification.mp3" preload="auto" />

      {/* Top Bar */}
      <header className="flex-shrink-0 border-b border-white/[0.06]" style={{ background: 'linear-gradient(180deg, rgba(0,212,255,0.03) 0%, transparent 100%)' }}>
        <div className="h-12 flex items-center justify-between px-5">
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

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-white/20" />
              <input
                type="text"
                placeholder="Buscar cliente..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-48 pl-8 pr-3 py-1.5 bg-white/[0.04] border border-white/[0.06] rounded-lg text-[11px] text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/30 focus:bg-white/[0.06] transition-all"
              />
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
                    style={{ background: 'linear-gradient(180deg, #12122a, #0d0d1e)' }}
                  >
                    <div className="p-3 border-b border-white/[0.06]">
                      <h3 className="font-semibold text-white text-xs">Notificacoes</h3>
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
                  onSelectConversa={(c) => {
                    setSelectedConversa(c);
                    setShowChat(true);
                  }}
                  onUpdateConversa={loadConversas}
                  onNovaConversa={() => setShowNovaConversa(true)}
                  accentColor={accentColor}
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
                <AtomConnectDashboard accentColor={accentColor} />
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
                <AtomConnectMarketing accentColor={accentColor} />
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
                <AtomConnectAutomation accentColor={accentColor} />
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
                <AtomConnectSettings accentColor={accentColor} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        <AnimatePresence>
          {showChat && selectedConversa && (
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="flex-1 border-l border-white/[0.06] min-w-0"
              style={{ background: '#0A0A16', maxWidth: '75%' }}
            >
              <AtomConnectChat
                conversa={selectedConversa}
                onClose={() => {
                  setShowChat(false);
                  setSelectedConversa(null);
                }}
                onUpdate={loadConversas}
                accentColor={accentColor}
              />
            </motion.div>
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
  );
}
