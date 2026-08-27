import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MessageSquare, X, Bell, BellOff, BellRing } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Notification {
  id: string;
  senderName: string;
  senderPhotoUrl: string | null;
  message: string;
  conversationId: string;
  conversationType: string;
  conversationName: string | null;
  timestamp: number;
}

export type ChatNotifMode = 'all' | 'minimal' | 'off';

const NOTIFICATION_DURATION = 5000;
const MAX_VISIBLE = 3;

export function ChatNotificationToast() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [exiting, setExiting] = useState<Set<string>>(new Set());
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const notifModeRef = useRef<ChatNotifMode>('all');
  const mutedConvsRef = useRef<Set<string>>(new Set());
  const browserPermissionRef = useRef<NotificationPermission>('default');

  useEffect(() => {
    if (!usuario?.id) return;

    // Load notification preference
    (async () => {
      const { data } = await supabase
        .from('usuarios')
        .select('chat_notif_mode')
        .eq('id', usuario.id)
        .maybeSingle();
      if (data?.chat_notif_mode) {
        notifModeRef.current = data.chat_notif_mode as ChatNotifMode;
      }
    })();

    // Load muted conversations
    (async () => {
      const { data } = await supabase
        .from('chat_participants')
        .select('conversation_id, muted_at')
        .eq('user_id', usuario.id)
        .not('muted_at', 'is', null);
      const muted = new Set<string>();
      (data || []).forEach((p: any) => muted.add(p.conversation_id));
      mutedConvsRef.current = muted;
    })();

    // Request browser notification permission
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then(p => {
        browserPermissionRef.current = p;
      });
    } else if ('Notification' in window) {
      browserPermissionRef.current = Notification.permission;
    }
  }, [usuario?.id]);

  const dismissNotification = useCallback((id: string) => {
    setExiting(prev => new Set(prev).add(id));
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
      setExiting(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }, 300);
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
  }, []);

  const scheduleRemoval = useCallback((id: string) => {
    const timer = setTimeout(() => {
      dismissNotification(id);
    }, NOTIFICATION_DURATION);
    timersRef.current.set(id, timer);
  }, [dismissNotification]);

  const handleClick = useCallback((notification: Notification) => {
    dismissNotification(notification.id);
    navigate('/chat', { state: { openConversationId: notification.conversationId } });
  }, [navigate, dismissNotification]);

  const sendBrowserNotification = useCallback((title: string, body: string, conversationId: string) => {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (document.hasFocus() && location.pathname === '/chat') return;

    try {
      const notif = new Notification(title, {
        body,
        icon: '/2_-_icone_branco_com_fundo_preto.png',
        tag: conversationId,
        renotify: true,
        silent: false,
      });
      notif.onclick = () => {
        window.focus();
        navigate('/chat', { state: { openConversationId: conversationId } });
        notif.close();
      };
      setTimeout(() => notif.close(), 6000);
    } catch {
      // Notification API not fully supported
    }
  }, [navigate, location.pathname]);

  useEffect(() => {
    if (!usuario?.id) return;

    const channelName = `chat-toast-${usuario.id}-${Date.now()}`;
    const channel = supabase.channel(channelName);

    channel
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        async (payload) => {
          const msg = payload.new as Record<string, unknown>;

          if (msg.sender_id === usuario.id) return;
          if (msg.message_type === 'system') return;

          // Check if conversation is muted
          const convId = msg.conversation_id as string;
          if (mutedConvsRef.current.has(convId)) return;

          // Check user notification mode
          const mode = notifModeRef.current;
          if (mode === 'off') return;

          try {
            const [senderRes, convRes] = await Promise.all([
              supabase
                .from('usuarios')
                .select('nome, foto_url')
                .eq('id', msg.sender_id as string)
                .maybeSingle(),
              supabase
                .from('chat_conversations')
                .select('tipo, nome')
                .eq('id', convId)
                .maybeSingle(),
            ]);

            const isParticipant = await supabase
              .from('chat_participants')
              .select('id')
              .eq('conversation_id', convId)
              .eq('user_id', usuario.id)
              .maybeSingle();

            if (!isParticipant.data) return;

            const senderName = senderRes.data?.nome || 'Usuario';
            const senderPhotoUrl = senderRes.data?.foto_url || null;
            const convType = (convRes.data?.tipo as string) || 'direct';
            const convName = convRes.data?.nome || null;

            let preview = '';
            const messageType = msg.message_type as string;
            if (messageType === 'text') {
              const content = (msg.content as string) || '';
              preview = content.length > 80 ? content.slice(0, 80) + '...' : content;
            } else if (messageType === 'image') {
              preview = 'Enviou uma imagem';
            } else if (messageType === 'file') {
              preview = 'Enviou um arquivo';
            } else if (messageType === 'audio') {
              preview = 'Enviou um audio';
            } else {
              preview = 'Nova mensagem';
            }

            // Build display based on mode
            let displayName = senderName;
            let displayMessage = preview;
            let browserTitle = '';
            let browserBody = '';

            if (mode === 'minimal') {
              displayName = 'QG de Comunicacao';
              displayMessage = 'Nova mensagem';
              browserTitle = 'QG de Comunicacao';
              browserBody = 'Voce recebeu uma nova mensagem';
            } else {
              // mode === 'all'
              if (convType === 'group' && convName) {
                browserTitle = convName;
                browserBody = `${senderName}: ${preview}`;
              } else {
                browserTitle = senderName;
                browserBody = preview;
              }
            }

            // In-app toast (only when on chat page skip)
            if (location.pathname !== '/chat') {
              const notification: Notification = {
                id: msg.id as string,
                senderName: displayName,
                senderPhotoUrl: mode === 'minimal' ? null : senderPhotoUrl,
                message: displayMessage,
                conversationId: convId,
                conversationType: convType,
                conversationName: mode === 'minimal' ? null : convName,
                timestamp: Date.now(),
              };

              setNotifications(prev => {
                const updated = [notification, ...prev];
                return updated.slice(0, MAX_VISIBLE + 2);
              });

              scheduleRemoval(notification.id);
            }

            // Browser notification (works even on other tabs/apps)
            sendBrowserNotification(browserTitle, browserBody, convId);
          } catch {
            // silently ignore
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      timersRef.current.forEach(timer => clearTimeout(timer));
      timersRef.current.clear();
    };
  }, [usuario?.id, location.pathname, scheduleRemoval, sendBrowserNotification]);

  const visible = notifications.slice(0, MAX_VISIBLE);

  if (visible.length === 0) return null;

  const getUserColor = (name: string) => {
    const colors = [
      '#00D4FF', '#39FF14', '#FF6B35', '#FFD700', '#FF1493',
      '#8A2BE2', '#00FA9A', '#FF69B4'
    ];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  return (
    <div className="fixed top-4 right-4 z-[9999] flex flex-col gap-2 pointer-events-none" style={{ maxWidth: '380px', width: '100%' }}>
      {visible.map((notification) => {
        const isExiting = exiting.has(notification.id);
        const accentColor = getUserColor(notification.senderName);

        return (
          <div
            key={notification.id}
            onClick={() => handleClick(notification)}
            className="pointer-events-auto cursor-pointer group"
            style={{
              animation: isExiting ? 'notif-slide-out 0.3s ease-in forwards' : 'notif-slide-in 0.35s ease-out',
              opacity: isExiting ? 0 : 1,
              transform: isExiting ? 'translateX(120%)' : 'translateX(0)',
              transition: 'opacity 0.3s ease, transform 0.3s ease',
            }}
          >
            <div
              className="relative rounded-2xl overflow-hidden shadow-2xl backdrop-blur-xl"
              style={{
                background: 'linear-gradient(135deg, rgba(15, 25, 35, 0.97), rgba(10, 18, 28, 0.98))',
                border: `1px solid rgba(${parseInt(accentColor.slice(1, 3), 16)}, ${parseInt(accentColor.slice(3, 5), 16)}, ${parseInt(accentColor.slice(5, 7), 16)}, 0.25)`,
                boxShadow: `0 8px 32px rgba(0, 0, 0, 0.5), 0 0 20px rgba(${parseInt(accentColor.slice(1, 3), 16)}, ${parseInt(accentColor.slice(3, 5), 16)}, ${parseInt(accentColor.slice(5, 7), 16)}, 0.08)`,
              }}
            >
              <div
                className="absolute top-0 left-0 h-full w-[3px] rounded-l-2xl"
                style={{ background: accentColor }}
              />

              <div
                className="absolute bottom-0 left-0 h-[2px] rounded-b-2xl"
                style={{
                  background: accentColor,
                  animation: `notif-progress ${NOTIFICATION_DURATION}ms linear forwards`,
                  opacity: 0.6,
                }}
              />

              <div className="flex items-start gap-3 p-3.5 pl-5">
                <div className="flex-shrink-0 mt-0.5">
                  {notification.senderPhotoUrl ? (
                    <img
                      src={notification.senderPhotoUrl}
                      alt={notification.senderName}
                      className="w-10 h-10 rounded-full object-cover"
                      style={{ border: `2px solid ${accentColor}40` }}
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm"
                      style={{
                        background: `${accentColor}20`,
                        color: accentColor,
                        border: `2px solid ${accentColor}40`,
                      }}
                    >
                      {notification.senderName.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white truncate">
                      {notification.senderName}
                    </span>
                    {notification.conversationType === 'group' && notification.conversationName && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full truncate max-w-[120px]" style={{ background: `${accentColor}15`, color: accentColor }}>
                        {notification.conversationName}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5 line-clamp-2 leading-relaxed">
                    {notification.message}
                  </p>
                </div>

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    dismissNotification(notification.id);
                  }}
                  className="flex-shrink-0 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
                >
                  <X className="w-3.5 h-3.5 text-gray-500" />
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function ChatNotificationSettings() {
  const { usuario } = useAuth();
  const [mode, setMode] = useState<ChatNotifMode>('all');
  const [loading, setLoading] = useState(true);
  const [browserPermission, setBrowserPermission] = useState<NotificationPermission>('default');

  useEffect(() => {
    if (!usuario?.id) return;
    (async () => {
      const { data } = await supabase
        .from('usuarios')
        .select('chat_notif_mode')
        .eq('id', usuario.id)
        .maybeSingle();
      if (data?.chat_notif_mode) setMode(data.chat_notif_mode as ChatNotifMode);
      setLoading(false);
    })();

    if ('Notification' in window) {
      setBrowserPermission(Notification.permission);
    }
  }, [usuario?.id]);

  const handleChangeMode = async (newMode: ChatNotifMode) => {
    if (!usuario?.id) return;
    setMode(newMode);
    await supabase
      .from('usuarios')
      .update({ chat_notif_mode: newMode })
      .eq('id', usuario.id);
  };

  const handleRequestPermission = async () => {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    setBrowserPermission(permission);
  };

  if (loading) return null;

  return (
    <div className="space-y-4">
      {browserPermission !== 'granted' && (
        <div className="bg-[#1a3a4a]/50 border border-[#00D4FF]/20 rounded-xl p-3">
          <p className="text-xs text-gray-400 mb-2">
            Para receber notificacoes mesmo em outras abas ou programas, ative as notificacoes do navegador.
          </p>
          <button
            onClick={handleRequestPermission}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#00D4FF]/20 text-[#00D4FF] rounded-lg text-xs font-medium hover:bg-[#00D4FF]/30 transition-colors"
          >
            <BellRing className="w-3.5 h-3.5" />
            Ativar notificacoes do navegador
          </button>
          {browserPermission === 'denied' && (
            <p className="text-[10px] text-red-400 mt-1.5">
              Notificacoes bloqueadas. Altere nas configuracoes do navegador.
            </p>
          )}
        </div>
      )}

      <div className="space-y-1.5">
        <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">Modo de notificacao</p>
        {[
          { value: 'all' as ChatNotifMode, label: 'Mostrar tudo', desc: 'Nome do remetente e mensagem', icon: Bell },
          { value: 'minimal' as ChatNotifMode, label: 'Apenas notificar', desc: 'Sem mostrar quem enviou', icon: BellRing },
          { value: 'off' as ChatNotifMode, label: 'Desativado', desc: 'Sem notificacoes', icon: BellOff },
        ].map(opt => (
          <button
            key={opt.value}
            onClick={() => handleChangeMode(opt.value)}
            className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
              mode === opt.value
                ? 'bg-[#00D4FF]/10 border border-[#00D4FF]/30'
                : 'bg-[#0a1218]/50 border border-transparent hover:border-[#1a3a4a]/50'
            }`}
          >
            <opt.icon className={`w-4 h-4 ${mode === opt.value ? 'text-[#00D4FF]' : 'text-gray-500'}`} />
            <div>
              <p className={`text-sm font-medium ${mode === opt.value ? 'text-white' : 'text-gray-300'}`}>
                {opt.label}
              </p>
              <p className="text-[10px] text-gray-500">{opt.desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
