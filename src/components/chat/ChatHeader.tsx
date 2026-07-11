import { useState } from 'react';
import { ArrowLeft, Settings, Users } from 'lucide-react';
import { EditGroupModal } from './EditGroupModal';
import { GroupDetailsModal } from './GroupDetailsModal';
import { ChatDetailsModal } from './ChatDetailsModal';
import { useOtherUserPresence, formatLastSeen } from '../../hooks/useUserPresence';

interface ConversationInfo {
  id: string;
  tipo: string;
  nome: string | null;
  descricao: string | null;
  foto_url?: string | null;
  other_user?: {
    id: string;
    nome: string;
    foto_url?: string | null;
    status?: string;
    last_seen_at?: string;
  };
  participants_count?: number;
  user_role?: string;
}

interface ChatHeaderProps {
  conversation: ConversationInfo;
  onBack?: () => void;
  onRefresh: () => void;
}

export function ChatHeader({ conversation, onBack, onRefresh }: ChatHeaderProps) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showChatDetails, setShowChatDetails] = useState(false);

  const otherUserId = conversation.tipo === 'direct' ? conversation.other_user?.id : undefined;
  const presence = useOtherUserPresence(otherUserId);

  const displayName = conversation.tipo === 'direct' && conversation.other_user
    ? conversation.other_user.nome
    : conversation.nome;

  const getStatusText = () => {
    if (conversation.tipo === 'group') {
      return `${conversation.participants_count} participantes`;
    }

    if (!presence) {
      return 'offline';
    }

    if (presence.status === 'online') {
      return 'online';
    }

    if (presence.last_seen_at) {
      return `visto ${formatLastSeen(presence.last_seen_at)}`;
    }

    return 'offline';
  };

  const isOnline = conversation.tipo === 'direct' && presence?.status === 'online';
  const canEditGroup = conversation.tipo === 'group' && conversation.user_role === 'admin';

  const handleHeaderClick = () => {
    setShowChatDetails(true);
  };

  return (
    <>
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1a3a4a]/50 bg-[#0d1419]">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 hover:bg-[#1a3a4a]/50 rounded-lg transition-all md:hidden"
          >
            <ArrowLeft className="w-5 h-5 text-[#00D4FF]" />
          </button>
        )}

        <div
          onClick={handleHeaderClick}
          className="w-11 h-11 rounded-full bg-[#1a3a4a] flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer hover:opacity-80 transition-all"
        >
          {conversation.tipo === 'group' ? (
            conversation.foto_url ? (
              <img
                src={conversation.foto_url}
                alt={displayName || 'Grupo'}
                className="w-full h-full object-cover"
              />
            ) : (
              <Users className="w-5 h-5 text-[#00D4FF]" />
            )
          ) : conversation.other_user?.foto_url ? (
            <img
              src={conversation.other_user.foto_url}
              alt={displayName || ''}
              className="w-full h-full object-cover"
            />
          ) : (
            <span className="text-[#00D4FF] font-semibold text-lg">
              {displayName?.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div
          className="flex-1 min-w-0 cursor-pointer hover:opacity-80 transition-opacity"
          onClick={handleHeaderClick}
        >
          <h2 className="font-semibold text-white truncate flex items-center gap-2">
            {displayName}
            <span className="text-[10px] text-gray-500 font-normal">(ver detalhes)</span>
          </h2>
          <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
            {isOnline && (
              <span className="w-2 h-2 bg-[#00D4FF] rounded-full animate-pulse"></span>
            )}
            {getStatusText()}
          </p>
        </div>

        {canEditGroup && (
          <button
            onClick={() => setShowEditModal(true)}
            className="p-2 hover:bg-[#1a3a4a]/50 rounded-lg transition-all"
            title="Configurações do grupo"
          >
            <Settings className="w-5 h-5 text-gray-400 hover:text-[#00D4FF]" />
          </button>
        )}
      </div>

      {showEditModal && (
        <EditGroupModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          conversationId={conversation.id}
          onUpdate={onRefresh}
        />
      )}

      {showDetailsModal && (
        <GroupDetailsModal
          isOpen={showDetailsModal}
          onClose={() => setShowDetailsModal(false)}
          conversationId={conversation.id}
          groupName={conversation.nome}
          groupDescription={conversation.descricao}
        />
      )}

      <ChatDetailsModal
        isOpen={showChatDetails}
        onClose={() => setShowChatDetails(false)}
        conversationId={conversation.id}
        conversationType={conversation.tipo as 'direct' | 'group'}
        otherUserId={otherUserId}
        conversationName={displayName || undefined}
        groupPhotoUrl={conversation.tipo === 'group' ? conversation.foto_url : undefined}
      />
    </>
  );
}
