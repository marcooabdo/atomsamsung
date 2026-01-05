import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { supabase } from '../../lib/supabase';
import { ChatMessage } from './ChatMessage';
import { Loader } from 'lucide-react';

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  message_type: string;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  reply_to_message_id: string | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  sender_name: string;
  read_by?: string[];
}

interface ChatMessageListProps {
  conversationId: string;
  userId: string;
  conversationType: string;
}

export interface ChatMessageListRef {
  addMessage: (message: Message) => void;
}

export const ChatMessageList = forwardRef<ChatMessageListRef, ChatMessageListProps>(({ conversationId, userId, conversationType }, ref) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    loadMessages();
    subscribeToMessages();

    return () => {
      supabase.removeAllChannels();
    };
  }, [conversationId]);

  useEffect(() => {
    if (isInitialLoad && messages.length > 0) {
      scrollToBottom();
      setIsInitialLoad(false);
    }
  }, [messages, isInitialLoad]);

  useImperativeHandle(ref, () => ({
    addMessage: (message: Message) => {
      setMessages(prev => {
        if (prev.some(m => m.id === message.id)) {
          return prev;
        }
        return [...prev, message];
      });
      setTimeout(() => scrollToBottom(), 100);
    }
  }));

  const loadMessages = async (before?: string) => {
    try {
      if (before) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      let query = supabase
        .from('chat_messages')
        .select(`
          *,
          usuarios!chat_messages_sender_id_fkey(nome)
        `)
        .eq('conversation_id', conversationId)
        .order('created_at', { ascending: false })
        .limit(50);

      if (before) {
        query = query.lt('created_at', before);
      }

      const { data, error } = await query;

      if (error) throw error;

      const enrichedMessages = await Promise.all(
        (data || []).map(async (msg) => {
          const sender = Array.isArray(msg.usuarios) ? msg.usuarios[0] : msg.usuarios;

          if (conversationType === 'group' && msg.sender_id !== userId) {
            const { data: reads } = await supabase
              .from('chat_message_reads')
              .select('user_id')
              .eq('message_id', msg.id);

            return {
              ...msg,
              sender_name: sender?.nome || 'Usuário',
              read_by: reads?.map(r => r.user_id) || []
            };
          }

          return {
            ...msg,
            sender_name: sender?.nome || 'Usuário'
          };
        })
      );

      if (before) {
        if (enrichedMessages.length < 50) {
          setHasMore(false);
        }
        setMessages(prev => [...enrichedMessages.reverse(), ...prev]);
      } else {
        setMessages(enrichedMessages.reverse());
        if (enrichedMessages.length < 50) {
          setHasMore(false);
        }
      }
    } catch (err) {
      console.error('Erro ao carregar mensagens:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const subscribeToMessages = () => {
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        async (payload) => {
          const { data: sender } = await supabase
            .from('usuarios')
            .select('nome')
            .eq('id', payload.new.sender_id)
            .maybeSingle();

          const newMessage = {
            ...payload.new,
            sender_name: sender?.nome || 'Usuário'
          };

          setMessages(prev => [...prev, newMessage as Message]);

          setTimeout(() => {
            scrollToBottom();
          }, 100);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `conversation_id=eq.${conversationId}`
        },
        (payload) => {
          setMessages(prev =>
            prev.map(msg => msg.id === payload.new.id ? { ...msg, ...payload.new } : msg)
          );
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_message_reads'
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return channel;
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleScroll = () => {
    if (!containerRef.current || loadingMore || !hasMore) return;

    if (containerRef.current.scrollTop === 0) {
      const oldHeight = containerRef.current.scrollHeight;
      const firstMessage = messages[0];

      if (firstMessage) {
        loadMessages(firstMessage.created_at).then(() => {
          requestAnimationFrame(() => {
            if (containerRef.current) {
              const newHeight = containerRef.current.scrollHeight;
              containerRef.current.scrollTop = newHeight - oldHeight;
            }
          });
        });
      }
    }
  };

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center bg-[#0a1015]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00D4FF]"></div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="flex-1 overflow-y-auto p-4 bg-[#0a1015]"
    >
      {loadingMore && (
        <div className="flex justify-center py-4">
          <Loader className="w-6 h-6 text-[#00D4FF] animate-spin" />
        </div>
      )}

      {messages.length === 0 ? (
        <div className="flex items-center justify-center h-full text-gray-500">
          <div className="text-center">
            <p className="text-sm">Nenhuma mensagem ainda</p>
            <p className="text-xs mt-1">Envie a primeira mensagem</p>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map((message, index) => {
            const showSenderName = conversationType === 'group' &&
              message.sender_id !== userId &&
              (index === 0 || messages[index - 1].sender_id !== message.sender_id);

            const isGrouped = index > 0 &&
              messages[index - 1].sender_id === message.sender_id &&
              new Date(message.created_at).getTime() - new Date(messages[index - 1].created_at).getTime() < 60000;

            return (
              <ChatMessage
                key={message.id}
                message={message}
                isOwnMessage={message.sender_id === userId}
                showSenderName={showSenderName}
                isGrouped={isGrouped}
                conversationType={conversationType}
              />
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      )}
    </div>
  );
});
