import { useState, useEffect, useRef, forwardRef, useImperativeHandle, DragEvent } from 'react';
import { supabase } from '../../lib/supabase';
import { ChatHeader } from './ChatHeader';
import { ChatMessageList, ChatMessageListRef, Message } from './ChatMessageList';
import { ChatInput, ChatInputRef } from './ChatInput';
import { Image, FileText, Music } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface ChatWindowProps {
  conversationId: string;
  userId: string;
  onBack?: () => void;
}

export interface ChatWindowRef {
  scrollToMessage: (messageId: string) => void;
}

interface Participant {
  user_id: string;
  nome: string;
  foto_url?: string | null;
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
    foto_url?: string | null;
    status?: string;
    last_seen_at?: string;
  };
  participants_count?: number;
  user_role?: string;
}

export const ChatWindow = forwardRef<ChatWindowRef, ChatWindowProps>(({ conversationId, userId, onBack }, ref) => {
  const { usuario } = useAuth();
  const [conversationInfo, setConversationInfo] = useState<ConversationInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [editingMessage, setEditingMessage] = useState<{ id: string; content: string } | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const messageListRef = useRef<ChatMessageListRef>(null);
  const dragCounterRef = useRef(0);
  const chatInputRef = useRef<ChatInputRef>(null);

  useImperativeHandle(ref, () => ({
    scrollToMessage: (messageId: string) => {
      messageListRef.current?.scrollToMessage(messageId);
    }
  }));

  useEffect(() => {
    setLoading(true);
    setError(null);
    setEditingMessage(null);
    loadConversationInfo();
    loadParticipants();
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
          .select('user_id, usuarios(id, nome, foto_url)')
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

  const loadParticipants = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_participants')
        .select('user_id, usuarios(id, nome, foto_url)')
        .eq('conversation_id', conversationId);

      if (error || !data) return;

      const mapped: Participant[] = data.map(p => {
        const user = Array.isArray(p.usuarios) ? p.usuarios[0] : p.usuarios;
        return {
          user_id: p.user_id,
          nome: (user as any)?.nome || 'Usuário',
          foto_url: (user as any)?.foto_url || null
        };
      });

      setParticipants(mapped);
    } catch {
      // ignored
    }
  };

  const markMessagesAsRead = async () => {
    try {
      await supabase.rpc('mark_conversation_as_read', {
        p_conversation_id: conversationId,
        p_user_id: userId
      });
    } catch (err) {
      // ignored
    }
  };

  const handleEditMessage = (message: Message) => {
    setEditingMessage({ id: message.id, content: message.content || '' });
    chatInputRef.current?.focus();
  };

  const handleEditComplete = async (messageId: string, newContent: string) => {
    try {
      const { error } = await supabase
        .from('chat_messages')
        .update({ content: newContent, edited_at: new Date().toISOString() })
        .eq('id', messageId)
        .eq('sender_id', userId);

      if (error) throw error;
      setEditingMessage(null);
    } catch {
      alert('Erro ao editar mensagem');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm('Tem certeza que deseja apagar esta mensagem?')) return;

    try {
      const { error } = await supabase
        .from('chat_messages')
        .update({ deleted_at: new Date().toISOString(), content: null })
        .eq('id', messageId)
        .eq('sender_id', userId);

      if (error) throw error;
    } catch {
      alert('Erro ao apagar mensagem');
    }
  };

  const handlePinMessage = async (messageId: string) => {
    try {
      const existingMsg = await supabase
        .from('chat_messages')
        .select('pinned_at, content, message_type')
        .eq('id', messageId)
        .maybeSingle();

      if (existingMsg.data?.pinned_at) {
        const { error } = await supabase
          .from('chat_messages')
          .update({ pinned_at: null, pinned_by: null })
          .eq('id', messageId);

        if (error) throw error;

        await supabase.from('chat_messages').insert({
          conversation_id: conversationId,
          sender_id: userId,
          content: `${usuario?.nome || 'Alguém'} desafixou uma mensagem`,
          message_type: 'system'
        });
      } else {
        await supabase
          .from('chat_messages')
          .update({ pinned_at: null, pinned_by: null })
          .eq('conversation_id', conversationId)
          .not('pinned_at', 'is', null);

        const { error } = await supabase
          .from('chat_messages')
          .update({ pinned_at: new Date().toISOString(), pinned_by: userId })
          .eq('id', messageId);

        if (error) throw error;

        const preview = existingMsg.data?.message_type === 'text'
          ? (existingMsg.data.content?.substring(0, 30) || 'mensagem')
          : existingMsg.data?.message_type === 'image' ? 'uma foto' : 'um arquivo';

        await supabase.from('chat_messages').insert({
          conversation_id: conversationId,
          sender_id: userId,
          content: `${usuario?.nome || 'Alguém'} fixou "${preview}"`,
          message_type: 'system'
        });
      }
    } catch {
      alert('Erro ao fixar/desafixar mensagem');
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
    if (files.length > 0 && chatInputRef.current?.prepareFilePreviews) {
      chatInputRef.current.prepareFilePreviews(files);
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
              <div className="flex items-center justify-center gap-3">
                <Image className="w-16 h-16 text-[#00D4FF] animate-bounce" style={{ animationDelay: '0ms' }} />
                <FileText className="w-16 h-16 text-[#00D4FF] animate-bounce" style={{ animationDelay: '100ms' }} />
                <Music className="w-16 h-16 text-[#00D4FF] animate-bounce" style={{ animationDelay: '200ms' }} />
              </div>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-40 h-40 border-4 border-[#00D4FF] rounded-full animate-ping opacity-20"></div>
              </div>
            </div>
            <p className="text-2xl font-bold text-[#00D4FF] mb-2 mt-4">Solte os arquivos aqui</p>
            <p className="text-base text-gray-300">Imagens, documentos ou áudios</p>
            <p className="text-sm text-gray-500 mt-1">Envie múltiplos arquivos de uma vez</p>
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
        onEditMessage={handleEditMessage}
        onDeleteMessage={handleDeleteMessage}
        onPinMessage={handlePinMessage}
        currentUserName={usuario?.nome}
      />

      <ChatInput
        ref={chatInputRef}
        conversationId={conversationId}
        userId={userId}
        userName={usuario?.nome}
        onMessageSent={markMessagesAsRead}
        onMessageAdded={(msg) => messageListRef.current?.addMessage(msg)}
        editingMessage={editingMessage}
        onCancelEdit={() => setEditingMessage(null)}
        onEditComplete={handleEditComplete}
        participants={participants}
      />
    </div>
  );
});

ChatWindow.displayName = 'ChatWindow';
