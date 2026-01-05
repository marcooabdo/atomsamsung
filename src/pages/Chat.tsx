import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ChatConversationList } from '../components/chat/ChatConversationList';
import { ChatWindow } from '../components/chat/ChatWindow';
import { CreateGroupModal } from '../components/chat/CreateGroupModal';
import { supabase } from '../lib/supabase';
import { Map, MessageCircle } from 'lucide-react';

export function Chat() {
  const { usuario } = useAuth();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'campus' | 'chat'>('chat');

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

  const loadOnlineCount = async () => {
    try {
      const { count } = await supabase
        .from('user_presence')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'online');
      setOnlineCount(count || 0);
    } catch (err) {
      console.error('Erro ao carregar contagem de usuários online:', err);
    }
  };

  if (!usuario) return null;

  return (
    <>
      <div className="h-[calc(100vh-8rem)] flex flex-col gap-0 -mx-8 -my-6">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#00D4FF]/20 bg-black/40 backdrop-blur-sm">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('campus')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeTab === 'campus'
                  ? 'bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/50'
                  : 'text-gray-400 hover:text-[#00D4FF] hover:bg-[#00D4FF]/10'
              }`}
            >
              <Map className="w-4 h-4" />
              <span className="font-medium">Campus</span>
            </button>
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                activeTab === 'chat'
                  ? 'bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/50'
                  : 'text-gray-400 hover:text-[#00D4FF] hover:bg-[#00D4FF]/10'
              }`}
            >
              <MessageCircle className="w-4 h-4" />
              <span className="font-medium">Chat</span>
            </button>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-[#39FF14] rounded-full animate-pulse"></div>
            <span className="text-sm text-gray-400">
              <span className="text-[#39FF14] font-semibold">{onlineCount}</span> online
            </span>
          </div>
        </div>

        <div className="flex-1 flex gap-0 overflow-hidden">
        <div
          className={`${
            isMobile && selectedConversationId ? 'hidden' : 'flex'
          } flex-col w-full md:w-[400px] bg-black/95 border-r border-[#00D4FF]/20`}
        >
          <ChatConversationList
            userId={usuario.id}
            selectedConversationId={selectedConversationId}
            onSelectConversation={setSelectedConversationId}
            onCreateGroup={() => setShowCreateGroupModal(true)}
          />
        </div>

        <div
          className={`${
            isMobile && !selectedConversationId ? 'hidden' : 'flex'
          } flex-1 bg-black/95`}
        >
          {selectedConversationId ? (
            <ChatWindow
              conversationId={selectedConversationId}
              userId={usuario.id}
              onBack={isMobile ? () => setSelectedConversationId(null) : undefined}
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center p-8">
              <div className="text-center max-w-md">
                <div className="w-32 h-32 mx-auto mb-6 rounded-full bg-[#00D4FF]/10 flex items-center justify-center">
                  <svg
                    className="w-16 h-16 text-[#00D4FF]/50"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-gray-400 mb-2">
                  Selecione uma conversa
                </h3>
                <p className="text-sm text-gray-500">
                  Escolha uma conversa na lista ou inicie uma nova
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
    </>
  );
}
