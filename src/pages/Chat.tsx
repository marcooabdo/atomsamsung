import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { ChatConversationList } from '../components/chat/ChatConversationList';
import { ChatWindow } from '../components/chat/ChatWindow';
import { CreateGroupModal } from '../components/chat/CreateGroupModal';

export function Chat() {
  const { usuario } = useAuth();
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  if (!usuario) return null;

  return (
    <>
      <div className="h-[calc(100vh-6rem)] flex gap-4">
        <div
          className={`${
            isMobile && selectedConversationId ? 'hidden' : 'flex'
          } flex-col w-full md:w-[380px] bg-black/40 border border-[#00D4FF]/20 rounded-lg overflow-hidden`}
          style={{
            boxShadow: '0 0 40px rgba(0, 212, 255, 0.1)'
          }}
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
          } flex-1 bg-black/40 border border-[#00D4FF]/20 rounded-lg overflow-hidden`}
          style={{
            boxShadow: '0 0 40px rgba(0, 212, 255, 0.1)'
          }}
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
