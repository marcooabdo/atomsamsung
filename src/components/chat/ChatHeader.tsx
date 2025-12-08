import { useState } from 'react';
import { ArrowLeft, Settings, Users } from 'lucide-react';
import { EditGroupModal } from './EditGroupModal';

interface ConversationInfo {
  id: string;
  tipo: string;
  nome: string | null;
  descricao: string | null;
  foto_url: string | null;
  other_user?: {
    id: string;
    nome: string;
    foto_url: string | null;
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

  const displayName = conversation.tipo === 'direct' && conversation.other_user
    ? conversation.other_user.nome
    : conversation.nome;

  const displayPhoto = conversation.tipo === 'direct' && conversation.other_user
    ? conversation.other_user.foto_url
    : conversation.foto_url;

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
      <div className="flex items-center gap-3 p-4 border-b border-[#00D4FF]/20 bg-black/40">
        {onBack && (
          <button
            onClick={onBack}
            className="p-2 hover:bg-[#00D4FF]/10 rounded-lg transition-all md:hidden"
          >
            <ArrowLeft className="w-5 h-5 text-[#00D4FF]" />
          </button>
        )}

        <div className="w-10 h-10 rounded-full bg-[#00D4FF]/20 flex items-center justify-center overflow-hidden flex-shrink-0">
          {displayPhoto ? (
            <img src={displayPhoto} alt="" className="w-full h-full object-cover" />
          ) : conversation.tipo === 'group' ? (
            <Users className="w-5 h-5 text-[#00D4FF]" />
          ) : (
            <div className="text-[#00D4FF] font-bold">
              {displayName?.charAt(0).toUpperCase()}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-gray-200 truncate">
            {displayName}
          </h2>
          <p className="text-xs text-gray-400 flex items-center gap-1">
            {conversation.tipo === 'direct' && conversation.other_user?.status === 'online' && (
              <span className="w-2 h-2 bg-[#39FF14] rounded-full pulse-neon"></span>
            )}
            {getStatusText()}
          </p>
        </div>

        {canEditGroup && (
          <button
            onClick={() => setShowEditModal(true)}
            className="p-2 hover:bg-[#00D4FF]/10 rounded-lg transition-all"
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
    </>
  );
}
