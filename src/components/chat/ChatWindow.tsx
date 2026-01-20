import { useState, useEffect, useRef, DragEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { ChatHeader } from './ChatHeader';
import { ChatMessageList, ChatMessageListRef, Message } from './ChatMessageList';
import { ChatInput, ChatInputRef } from './ChatInput';
import { Image } from 'lucide-react';

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
  foto_url?: string | null;
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
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const messageListRef = useRef<ChatMessageListRef>(null);
  const dragCounterRef = useRef(0);
  const chatInputRef = useRef<ChatInputRef>(null);

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
      setError('Erro ao carregar conversa');
      setLoading(false);
    }
  };

  const markMessagesAsRead = async () => {
    try {
      await supabase.rpc('mark_conversation_as_read', {
        p_conversation_id: conversationId,
        p_user_id: userId
      });
    } catch (err) {
      console.error('Erro ao marcar mensagens como lidas:', err);
    }
  };

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDraggingOver(true);
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDraggingOver(false);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    dragCounterRef.current = 0;

    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => file.type.startsWith('image/'));

    if (imageFile && chatInputRef.current?.prepareImagePreview) {
      chatInputRef.current.prepareImagePreview(imageFile);
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
    <div
      className="relative flex flex-col h-full w-full bg-[#0a1015]"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDraggingOver && (
        <div className="absolute inset-0 bg-[#00D4FF]/10 border-4 border-dashed border-[#00D4FF] backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center bg-[#0d1419]/95 px-12 py-8 rounded-2xl border-2 border-[#00D4FF] shadow-2xl">
            <div className="relative">
              <Image className="w-24 h-24 text-[#00D4FF] mx-auto mb-4 animate-bounce" />
              <div className="absolute inset-0 w-24 h-24 mx-auto">
                <div className="w-full h-full border-4 border-[#00D4FF] rounded-full animate-ping opacity-20"></div>
              </div>
            </div>
            <p className="text-2xl font-bold text-[#00D4FF] mb-2">Solte a imagem aqui</p>
            <p className="text-base text-gray-300">Para enviar no chat</p>
          </div>
        </div>
      )}

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
        ref={chatInputRef}
        conversationId={conversationId}
        userId={userId}
        onMessageSent={markMessagesAsRead}
        onMessageAdded={(msg) => messageListRef.current?.addMessage(msg)}
      />
    </div>
  );
}
