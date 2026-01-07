import { useState } from 'react';
import { ArrowLeft, Settings, Users } from 'lucide-react';
import { EditGroupModal } from './EditGroupModal';
import { GroupDetailsModal } from './GroupDetailsModal';

interface ConversationInfo {
  id: string;
  tipo: string;
  nome: string | null;
  descricao: string | null;
  other_user?: {
    id: string;
    nome: string;
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

  const displayName = conversation.tipo === 'direct' && conversation.other_user
    ? conversation.other_user.nome
    : conversation.nome;

  const getStatusText = () => {
    if (conversation.tipo === 'group') {
      return `${conversation.participants_count} participantes`;
    }

    if (!conversation.other_user) return '';

    if (conversation.other_user.status === 'online') {
      return 'online';
    }

    if (conversation.other_user.last_seen_at) {
      const lastSeen = new Date(conversation.other_user.last_seen_at);
      const now = new Date();
      const diff = now.getTime() - lastSeen.getTime();
      const minutes = Math.floor(diff / 60000);
      const hours = Math.floor(diff / 3600000);
      const days = Math.floor(diff / 86400000);

      if (minutes < 1) return 'visto agora';
      if (minutes < 60) return `visto há ${minutes} min`;
      if (hours < 24) return `visto há ${hours}h`;
      if (days === 1) return 'visto ontem';
      return `visto há ${days} dias`;
    }

    return 'offline';
  };

  const canEditGroup = conversation.tipo === 'group' && conversation.user_role === 'admin';

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

        <div className="w-11 h-11 rounded-full bg-[#1a3a4a] flex items-center justify-center overflow-hidden flex-shrink-0">
          {conversation.tipo === 'group' ? (
            <Users className="w-5 h-5 text-[#00D4FF]" />
          ) : (
            <span className="text-[#00D4FF] font-semibold text-lg">
              {displayName?.charAt(0).toUpperCase()}
            </span>
          )}
        </div>

        <div
          className={`flex-1 min-w-0 ${conversation.tipo === 'group' ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
          onClick={() => conversation.tipo === 'group' && setShowDetailsModal(true)}
        >
          <h2 className="font-semibold text-white truncate flex items-center gap-2">
            {displayName}
            {conversation.tipo === 'group' && (
              <span className="text-[10px] text-gray-500 font-normal">(ver detalhes)</span>
            )}
          </h2>
          <p className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
            {conversation.tipo === 'direct' && conversation.other_user?.status === 'online' && (
              <span className="w-2 h-2 bg-[#00D4FF] rounded-full"></span>
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
    </>
  );
}
