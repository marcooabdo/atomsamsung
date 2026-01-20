import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ChatConversationList } from '../components/chat/ChatConversationList';
import { ChatWindow, ChatWindowRef } from '../components/chat/ChatWindow';
import { CreateGroupModal } from '../components/chat/CreateGroupModal';
import { GlobalChatSearch } from '../components/chat/GlobalChatSearch';
import { supabase } from '../lib/supabase';
import { Building2, MessageCircle, Search } from 'lucide-react';
import { useUserPresence } from '../hooks/useUserPresence';

export function Chat() {
  const { usuario } = useAuth();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [showGlobalSearch, setShowGlobalSearch] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [targetMessageId, setTargetMessageId] = useState<string | null>(null);
  const chatWindowRef = useRef<ChatWindowRef>(null);

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
      console.error('Erro ao carregar usuários online:', err);
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

  if (!usuario) return null;

  return (
    <>
      <div className="fixed inset-0 top-[48px] flex flex-col bg-[#0a1015] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-3 border-b border-[#1a3a4a]/50 bg-[#0d1419]">
          <div className="flex gap-1">
            <button
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-gray-400 hover:text-white hover:bg-[#1a3a4a]/30 transition-all"
            >
              <Building2 className="w-4 h-4" />
              <span className="font-medium text-sm">Campus</span>
            </button>
            <button
              className="flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#0d2832] text-[#00D4FF] border border-[#00D4FF]/30 transition-all"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="font-medium text-sm">Chat</span>
            </button>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowGlobalSearch(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-full border border-[#1a3a4a]/50 bg-[#0d1419] hover:bg-[#151f26] hover:border-[#00D4FF]/30 transition-all group"
              title="Busca Global (Ctrl+K)"
            >
              <Search className="w-4 h-4 text-gray-400 group-hover:text-[#00D4FF]" />
              <span className="text-sm text-gray-400 group-hover:text-[#00D4FF] font-medium">
                Buscar
              </span>
              <span className="text-xs text-gray-600 bg-[#1a3a4a]/30 px-2 py-0.5 rounded">
                Ctrl+K
              </span>
            </button>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full border border-[#00D4FF]/30 bg-[#0d2832]">
              <div className="w-2 h-2 bg-[#00D4FF] rounded-full"></div>
              <span className="text-sm text-[#00D4FF] font-medium">
                {onlineCount} online
              </span>
            </div>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div
            className={`${
              isMobile && selectedConversationId ? 'hidden' : 'flex'
            } flex-col w-full md:w-[380px] lg:w-[420px] bg-[#0d1419] border-r border-[#1a3a4a]/50`}
          >
            <ChatConversationList
              userId={usuario.id}
              userType={usuario.tipo}
              selectedConversationId={selectedConversationId}
              onSelectConversation={setSelectedConversationId}
              onCreateGroup={() => setShowCreateGroupModal(true)}
            />
          </div>

          <div
            className={`${
              isMobile && !selectedConversationId ? 'hidden' : 'flex'
            } flex-1 bg-[#0a1015]`}
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
                  <div className="w-28 h-28 mx-auto mb-6 rounded-full bg-[#0d2832] border border-[#00D4FF]/20 flex items-center justify-center">
                    <MessageCircle className="w-14 h-14 text-[#00D4FF]/60" strokeWidth={1.5} />
                  </div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    Selecione uma conversa
                  </h3>
                  <p className="text-sm text-gray-500">
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
