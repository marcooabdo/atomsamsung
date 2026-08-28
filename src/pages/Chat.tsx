import { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ChatConversationList } from '../components/chat/ChatConversationList';
import { ChatWindow, ChatWindowRef } from '../components/chat/ChatWindow';
import { CreateGroupModal } from '../components/chat/CreateGroupModal';
import { GlobalChatSearch } from '../components/chat/GlobalChatSearch';
import { supabase } from '../lib/supabase';
import { Building2, MessageCircle, GripVertical, Bell, X } from 'lucide-react';
import { ChatNotificationSettings } from '../components/ChatNotificationToast';
import { useUserPresence } from '../hooks/useUserPresence';

export function Chat() {
  const { usuario } = useAuth();
  const location = useLocation();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [targetMessageId, setTargetMessageId] = useState<string | null>(null);
  const [sidebarWidth, setSidebarWidth] = useState(380);
  const [showNotifSettings, setShowNotifSettings] = useState(false);
  const chatWindowRef = useRef<ChatWindowRef>(null);
  const isResizing = useRef(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useUserPresence(usuario?.id);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    loadOnlineCount();
    const interval = setInterval(loadOnlineCount, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setShowGlobalSearch(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const loadOnlineCount = async () => {
    try {
      const { count } = await supabase
        .from('user_presence')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'online');
      setOnlineCount(count || 0);
    } catch (err) {
      // ignored
    }
  };

  const handleSelectMessage = (conversationId: string, messageId: string) => {
    setSelectedConversationId(conversationId);
    setTargetMessageId(messageId);
    setShowGlobalSearch(false);
  };

  useEffect(() => {
    if (targetMessageId && chatWindowRef.current?.scrollToMessage) {
      chatWindowRef.current.scrollToMessage(targetMessageId);
      setTargetMessageId(null);
    }
  }, [selectedConversationId, targetMessageId]);

  useEffect(() => {
    const state = location.state as { openConversationId?: string } | null;
    if (state?.openConversationId) {
      setSelectedConversationId(state.openConversationId);
      window.history.replaceState({}, '');
    }
  }, [location.state]);

  useEffect(() => {
    window.dispatchEvent(new CustomEvent('chat-active-conversation', { detail: selectedConversationId }));
    return () => {
      window.dispatchEvent(new CustomEvent('chat-active-conversation', { detail: null }));
    };
  }, [selectedConversationId]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isResizing.current = true;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left;
      setSidebarWidth(Math.max(260, Math.min(600, newWidth)));
    };

    const handleMouseUp = () => {
      isResizing.current = false;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, []);

  if (!usuario) return null;

  return (
    <>
      <div className="h-screen flex flex-col -m-6 overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
        <div className="flex items-center justify-between px-6 py-3 border-b" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
          <div className="flex gap-1">
            <button
              className="flex items-center gap-2 px-5 py-2.5 rounded-full transition-all"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-primary)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'; }}
            >
              <Building2 className="w-4 h-4" />
              <span className="font-medium text-sm">Campus</span>
            </button>
            <button
              className="flex items-center gap-2 px-5 py-2.5 rounded-full transition-all"
              style={{ background: 'rgba(var(--accent-rgb), 0.1)', color: 'var(--text-accent)', border: '1px solid rgba(var(--accent-rgb), 0.3)' }}
            >
              <MessageCircle className="w-4 h-4" />
              <span className="font-medium text-sm">Chat</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <button
                onClick={() => setShowNotifSettings(!showNotifSettings)}
                className="p-2 rounded-lg transition-colors hover:bg-white/5"
                title="Configuracoes de notificacao"
              >
                <Bell className="w-4.5 h-4.5" style={{ color: 'var(--text-secondary)' }} />
              </button>
              {showNotifSettings && (
                <div className="absolute right-0 top-full mt-2 w-[300px] rounded-2xl border p-4 z-50 shadow-2xl" style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-primary)' }}>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Notificacoes</h4>
                    <button onClick={() => setShowNotifSettings(false)} className="p-1 rounded hover:bg-white/10">
                      <X className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
                    </button>
                  </div>
                  <ChatNotificationSettings />
                </div>
              )}
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full" style={{ border: '1px solid rgba(var(--accent-rgb), 0.3)', background: 'rgba(var(--accent-rgb), 0.08)' }}>
              <div className="w-2 h-2 rounded-full" style={{ background: 'var(--text-accent)' }}></div>
              <span className="text-sm font-medium" style={{ color: 'var(--text-accent)' }}>
                {onlineCount} online
              </span>
            </div>
          </div>
        </div>

        <div ref={containerRef} className="flex-1 flex overflow-hidden">
          <div
            className={`${
              isMobile && selectedConversationId ? 'hidden' : 'flex'
            } flex-col border-r flex-shrink-0`}
            style={{
              background: 'var(--bg-secondary)',
              borderColor: 'var(--border-primary)',
              width: isMobile ? '100%' : `${sidebarWidth}px`
            }}
          >
            <ChatConversationList
              userId={usuario.id}
              userType={usuario.tipo}
              selectedConversationId={selectedConversationId}
              onSelectConversation={setSelectedConversationId}
              onCreateGroup={() => setShowCreateGroupModal(true)}
              onOpenGlobalSearch={() => setShowGlobalSearch(true)}
            />
          </div>

          {!isMobile && (
            <div
              onMouseDown={handleMouseDown}
              className="w-1.5 flex-shrink-0 cursor-col-resize group relative hover:bg-[#00D4FF]/20 transition-colors"
              style={{ background: 'var(--border-primary)' }}
            >
              <div className="absolute inset-y-0 -left-1 -right-1" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity">
                <GripVertical className="w-3 h-3 text-[#00D4FF]" />
              </div>
            </div>
          )}

          <div
            className={`${
              isMobile && !selectedConversationId ? 'hidden' : 'flex'
            } flex-1 min-w-0`}
            style={{ background: 'var(--bg-primary)' }}
          >
            {selectedConversationId ? (
              <ChatWindow
                ref={chatWindowRef}
                conversationId={selectedConversationId}
                userId={usuario.id}
                onBack={isMobile ? () => setSelectedConversationId(null) : undefined}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <div className="w-28 h-28 mx-auto mb-6 rounded-full flex items-center justify-center" style={{ background: 'rgba(var(--accent-rgb), 0.08)', border: '1px solid rgba(var(--accent-rgb), 0.2)' }}>
                    <MessageCircle className="w-14 h-14" strokeWidth={1.5} style={{ color: 'rgba(var(--accent-rgb), 0.6)' as any }} />
                  </div>
                  <h3 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                    Selecione uma conversa
                  </h3>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Escolha uma conversa na lista ao lado ou inicie uma nova
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <CreateGroupModal
        isOpen={showCreateGroupModal}
        onClose={() => setShowCreateGroupModal(false)}
        userId={usuario.id}
        onGroupCreated={(conversationId) => {
          setSelectedConversationId(conversationId);
          setShowCreateGroupModal(false);
        }}
      />

      {showGlobalSearch && (
        <GlobalChatSearch
          userId={usuario.id}
          onSelectContact={(conversationId) => {
            setSelectedConversationId(conversationId);
            setShowGlobalSearch(false);
          }}
          onSelectMessage={handleSelectMessage}
          onClose={() => setShowGlobalSearch(false)}
        />
      )}
    </>
  );
}
