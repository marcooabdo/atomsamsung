import { useState, useEffect, useCallback, useRef } from 'react';
import {
  MessageSquare, Users, BarChart3, Settings, Zap, Bell, Search,
  Filter, Plus, Phone, Bot, Clock, DollarSign, Package, Wrench,
  CheckCircle, MapPin, Star, ChevronRight, MoreVertical, Send,
  Paperclip, Mic, Image, Smile, AlertTriangle, UserPlus, ArrowRight,
  Calendar, Navigation, X, Volume2, VolumeX, Megaphone, GitBranch
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
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const loadConversas = useCallback(async () => {
    if (!unidadeAtual) return;

    const { data, error } = await supabase
      .from('atom_connect_conversas')
      .select('*')
      .eq('unidade_id', unidadeAtual)
      .order('ultima_mensagem_at', { ascending: false });

    if (!error && data) {
      setConversas(data);
      const unread = data.reduce((acc, c) => acc + (c.mensagens_nao_lidas || 0), 0);
      setUnreadCount(unread);
    }
    setLoading(false);
  }, [unidadeAtual]);

  useEffect(() => {
    loadConversas();
  }, [loadConversas]);

  useEffect(() => {
    if (!unidadeAtual) return;

    const channel = supabase
      .channel('atom-connect-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'atom_connect_conversas',
          filter: `unidade_id=eq.${unidadeAtual}`
        },
        (payload) => {
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
        }
      )
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

  const tabs = [
    { id: 'kanban' as TabType, label: 'Pipeline', icon: Users },
    { id: 'dashboard' as TabType, label: 'Dashboard', icon: BarChart3 },
    { id: 'marketing' as TabType, label: 'Marketing', icon: Megaphone },
    { id: 'automation' as TabType, label: 'Automacao', icon: GitBranch },
    { id: 'settings' as TabType, label: 'Configuracoes', icon: Settings },
  ];

  const getAccentColor = () => {
    const colors: Record<string, string> = {
      cyan: '#00D4FF',
      green: '#39FF14',
      purple: '#8B5CF6',
      orange: '#FF6B35',
      pink: '#FF1493',
      blue: '#3B82F6'
    };
    return colors[theme] || '#00D4FF';
  };

  const accentColor = getAccentColor();

  return (
    <div className="h-full flex flex-col bg-[#0A0A0F] overflow-hidden">
      <audio ref={audioRef} src="/notification.mp3" preload="auto" />

      {/* Header */}
      <header className="flex-shrink-0 h-16 border-b border-white/10 bg-black/40 backdrop-blur-xl flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${accentColor}20, ${accentColor}40)`,
                boxShadow: `0 0 20px ${accentColor}30`
              }}
            >
              <Zap className="w-5 h-5" style={{ color: accentColor }} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">ATOM CONNECT</h1>
              <p className="text-xs text-gray-500">Central de Atendimento</p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="Buscar cliente ou telefone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-64 pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20"
            />
          </div>

          {/* Sound Toggle */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
          >
            {soundEnabled ? (
              <Volume2 className="w-5 h-5 text-gray-400" />
            ) : (
              <VolumeX className="w-5 h-5 text-gray-500" />
            )}
          </button>

          {/* Notifications */}
          <div className="relative">
            <button
              onClick={() => setShowNotifications(!showNotifications)}
              className="relative p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
            >
              <Bell className="w-5 h-5 text-gray-400" />
              {unreadCount > 0 && (
                <span
                  className="absolute -top-1 -right-1 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center text-black"
                  style={{ backgroundColor: accentColor }}
                >
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {showNotifications && (
                <motion.div
                  initial={{ opacity: 0, y: 10, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  className="absolute right-0 top-12 w-80 max-h-96 overflow-y-auto bg-[#1A1A2E] border border-white/10 rounded-xl shadow-2xl z-50"
                >
                  <div className="p-3 border-b border-white/10">
                    <h3 className="font-semibold text-white">Notificacoes</h3>
                  </div>
                  {notifications.length === 0 ? (
                    <div className="p-6 text-center text-gray-500">
                      Nenhuma notificacao
                    </div>
                  ) : (
                    notifications.map(n => (
                      <div
                        key={n.id}
                        className="p-3 border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors"
                        onClick={() => handleNotificationClick(n)}
                      >
                        <div className="flex items-start gap-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: `${accentColor}20` }}
                          >
                            {n.type === 'message' ? (
                              <MessageSquare className="w-4 h-4" style={{ color: accentColor }} />
                            ) : n.type === 'transfer' ? (
                              <ArrowRight className="w-4 h-4" style={{ color: accentColor }} />
                            ) : (
                              <AlertTriangle className="w-4 h-4 text-red-400" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-white truncate">{n.title}</p>
                            <p className="text-xs text-gray-400 truncate">{n.message}</p>
                            <p className="text-xs text-gray-600 mt-1">
                              {n.timestamp.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              dismissNotification(n.id);
                            }}
                            className="p-1 hover:bg-white/10 rounded"
                          >
                            <X className="w-3 h-3 text-gray-500" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* User */}
          <div className="flex items-center gap-3 pl-4 border-l border-white/10">
            <div className="text-right">
              <p className="text-sm font-medium text-white">{usuario?.nome}</p>
              <p className="text-xs text-gray-500">{unidades?.find(u => u.id === unidadeAtual)?.nome || 'Unidade'}</p>
            </div>
            <div
              className="w-10 h-10 rounded-full bg-gradient-to-br from-white/10 to-white/5 flex items-center justify-center"
              style={{ border: `2px solid ${accentColor}` }}
            >
              {usuario?.foto_url ? (
                <img src={usuario.foto_url} alt="" className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="text-sm font-bold" style={{ color: accentColor }}>
                  {usuario?.nome?.charAt(0)}
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <nav className="w-20 flex-shrink-0 border-r border-white/10 bg-black/20 flex flex-col items-center py-4 gap-2">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`relative w-14 h-14 rounded-xl flex flex-col items-center justify-center gap-1 transition-all duration-200 ${
                  isActive ? 'bg-white/10' : 'hover:bg-white/5'
                }`}
                style={isActive ? {
                  boxShadow: `0 0 20px ${accentColor}20`,
                  border: `1px solid ${accentColor}40`
                } : undefined}
              >
                <Icon
                  className="w-5 h-5"
                  style={{ color: isActive ? accentColor : '#6B7280' }}
                />
                <span
                  className="text-[10px] font-medium"
                  style={{ color: isActive ? accentColor : '#6B7280' }}
                >
                  {tab.label}
                </span>
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 rounded-r"
                    style={{ backgroundColor: accentColor }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Content Area */}
        <main className="flex-1 overflow-hidden">
          <AnimatePresence mode="wait">
            {activeTab === 'kanban' && (
              <motion.div
                key="kanban"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
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
                  accentColor={accentColor}
                />
              </motion.div>
            )}
            {activeTab === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full"
              >
                <AtomConnectDashboard accentColor={accentColor} />
              </motion.div>
            )}
            {activeTab === 'marketing' && (
              <motion.div
                key="marketing"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full"
              >
                <AtomConnectMarketing accentColor={accentColor} />
              </motion.div>
            )}
            {activeTab === 'automation' && (
              <motion.div
                key="automation"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full"
              >
                <AtomConnectAutomation accentColor={accentColor} />
              </motion.div>
            )}
            {activeTab === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="h-full"
              >
                <AtomConnectSettings accentColor={accentColor} />
              </motion.div>
            )}
          </AnimatePresence>
        </main>

        {/* Chat Panel */}
        <AnimatePresence>
          {showChat && selectedConversa && (
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-[450px] flex-shrink-0 border-l border-white/10 bg-[#0D0D12]"
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

      {/* Toast Notifications */}
      <AtomConnectNotification
        notifications={notifications}
        onDismiss={dismissNotification}
        onClick={handleNotificationClick}
        accentColor={accentColor}
      />
    </div>
  );
}
