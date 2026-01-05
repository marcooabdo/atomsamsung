import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { ChatHeader } from './ChatHeader';
import { ChatMessageList } from './ChatMessageList';
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

  useEffect(() => {
    loadConversationInfo();
    markMessagesAsRead();
  }, [conversationId]);

  const loadConversationInfo = async () => {
    try {
      const { data: conv, error } = await supabase
        .from('chat_conversations')
        .select('*')
        .eq('id', conversationId)
        .single();

      if (error) throw error;

      const { data: participant } = await supabase
        .from('chat_participants')
        .select('role')
        .eq('conversation_id', conversationId)
        .eq('user_id', userId)
        .single();

      let enrichedConv: ConversationInfo = {
        ...conv,
        user_role: participant?.role
      };

      if (conv.tipo === 'direct') {
        const { data: otherParticipant } = await supabase
          .from('chat_participants')
          .select('user_id, usuarios(id, nome)')
          .eq('conversation_id', conversationId)
          .neq('user_id', userId)
          .single();

        if (otherParticipant && otherParticipant.usuarios) {
          const otherUser = Array.isArray(otherParticipant.usuarios)
            ? otherParticipant.usuarios[0]
            : otherParticipant.usuarios;

          const { data: presence } = await supabase
            .from('user_presence')
            .select('status, last_seen_at')
            .eq('user_id', otherUser.id)
            .maybeSingle();

          enrichedConv.other_user = {
            ...otherUser,
            status: presence?.status || 'offline',
            last_seen_at: presence?.last_seen_at
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
    } catch (err) {
      console.error('Erro ao carregar informações da conversa:', err);
    } finally {
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

  if (loading || !conversationInfo) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00D4FF]"></div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <ChatHeader
        conversation={conversationInfo}
        onBack={onBack}
        onRefresh={loadConversationInfo}
      />

      <ChatMessageList
        conversationId={conversationId}
        userId={userId}
        conversationType={conversationInfo.tipo}
      />

      <ChatInput
        conversationId={conversationId}
        userId={userId}
        onMessageSent={markMessagesAsRead}
      />
    </div>
  );
}
