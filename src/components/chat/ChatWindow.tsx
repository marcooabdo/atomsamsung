import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { ChatHeader } from './ChatHeader';
import { ChatMessageList, ChatMessageListRef, Message } from './ChatMessageList';
import { ChatInput } from './ChatInput';

interface ChatWindowProps {
  conversationId: string;
  userId: string;
  onBack?: () => void;
}

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

export function ChatWindow({ conversationId, userId, onBack }: ChatWindowProps) {
  const [conversationInfo, setConversationInfo] = useState<ConversationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const messageListRef = useRef<ChatMessageListRef>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    loadConversationInfo();
    markMessagesAsRead();
  }, [conversationId]);

  const loadConversationInfo = async () => {
    try {
      const { data: conv, error: convError } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('id', conversationId)
        .maybeSingle();

      if (convError) {
        console.error('Erro ao buscar conversa:', convError);
        setError('Erro ao carregar conversa');
        setLoading(false);
        return;
      }

      if (!conv) {
        setError('Conversa nao encontrada');
        setLoading(false);
        return;
      }

      const { data: participant } = await supabase
        .from('chat_participants')
        .select('role')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .maybeSingle();

      let enrichedConv: ConversationInfo = {
        ...conv,
        user_role: participant?.role || 'member'
      };

      if (conv.tipo === 'direct') {
        const { data: otherParticipant } = await supabase
          .from('chat_participants')
          .select('user_id, usuarios(id, nome)')
          .eq('conversation_id', conversationId)
          .neq('user_id', userId)
          .maybeSingle();

        if (otherParticipant && otherParticipant.usuarios) {
          const otherUser = Array.isArray(otherParticipant.usuarios)
            ? otherParticipant.usuarios[0]
            : otherParticipant.usuarios;

          enrichedConv.other_user = {
            ...otherUser,
            status: 'offline',
            last_seen_at: undefined
          };
        }
      } else {
        const { count } = await supabase
          .from('chat_participants')
          .select('*', { count: 'exact', head: true })
          .eq('conversation_id', conversationId);

        enrichedConv.participants_count = count || 0;
      }

      setConversationInfo(enrichedConv);
      setLoading(false);
    } catch (err) {
      console.error('Erro ao carregar informações da conversa:', err);
      setError('Erro ao carregar conversa');
      setLoading(false);
    }
  };

  const markMessagesAsRead = async () => {
    try {
      await supabase.rpc('mark_messages_as_read', {
        p_conversation_id: conversationId,
        p_user_id: userId
      });
    } catch (err) {
      console.error('Erro ao marcar mensagens como lidas:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-[#0a1015]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00D4FF]"></div>
      </div>
    );
  }

  if (error || !conversationInfo) {
    return (
      <div className="flex items-center justify-center h-full w-full bg-[#0a1015]">
        <div className="text-center">
          <p className="text-gray-400 mb-4">{error || 'Conversa nao encontrada'}</p>
          <button
            onClick={() => {
              setLoading(true);
              setError(null);
              loadConversationInfo();
            }}
            className="px-4 py-2 bg-[#00D4FF]/20 text-[#00D4FF] rounded-lg hover:bg-[#00D4FF]/30 transition-all"
          >
            Tentar novamente
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full w-full bg-[#0a1015]">
      <ChatHeader
        conversation={conversationInfo}
        onBack={onBack}
        onRefresh={loadConversationInfo}
      />

      <ChatMessageList
        ref={messageListRef}
        conversationId={conversationId}
        userId={userId}
        conversationType={conversationInfo.tipo}
      />

      <ChatInput
        conversationId={conversationId}
        userId={userId}
        onMessageSent={markMessagesAsRead}
        onMessageAdded={(msg) => messageListRef.current?.addMessage(msg)}
      />
    </div>
  );
}
