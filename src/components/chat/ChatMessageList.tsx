import { useState, useEffect, useRef, forwardRef, useImperativeHandle } from 'react';
import { supabase } from '../../lib/supabase';
import { ChatMessage } from './ChatMessage';
import { Loader, Pin, X, ChevronDown } from 'lucide-react';

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
  sender_photo?: string | null;
  read_by?: string[];
  pinned_at?: string | null;
  pinned_by?: string | null;
  mentioned_user_ids?: string[] | null;
}

interface ChatMessageListProps {
  conversationId: string;
  userId: string;
  conversationType: string;
  onEditMessage?: (message: Message) => void;
  onDeleteMessage?: (messageId: string) => void;
  onPinMessage?: (messageId: string) => void;
  currentUserName?: string;
}

export interface ChatMessageListRef {
  addMessage: (message: Message) => void;
  scrollToMessage: (messageId: string) => void;
}

export const ChatMessageList = forwardRef<ChatMessageListRef, ChatMessageListProps>(({ conversationId, userId, conversationType, onEditMessage, onDeleteMessage, onPinMessage, currentUserName }, ref) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [pinnedMessage, setPinnedMessage] = useState<Message | null>(null);
  const [showPinnedBanner, setShowPinnedBanner] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isInitialLoad, setIsInitialLoad] = useState(true);

  useEffect(() => {
    loadMessages();
    loadPinnedMessage();
    const channel = subscribeToMessages();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
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
    },
    scrollToMessage: (messageId: string) => {
      setTimeout(() => {
        const el = document.getElementById(`msg-${messageId}`);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          el.classList.add('ring-2', 'ring-[#00D4FF]/50', 'rounded-xl');
          setTimeout(() => el.classList.remove('ring-2', 'ring-[#00D4FF]/50', 'rounded-xl'), 2000);
        }
      }, 200);
    }
  }));

  const loadPinnedMessage = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`*, usuarios!chat_messages_sender_id_fkey(nome, foto_url)`)
        .eq('conversation_id', conversationId)
        .not('pinned_at', 'is', null)
        .order('pinned_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        setPinnedMessage(null);
        return;
      }

      const sender = Array.isArray(data.usuarios) ? data.usuarios[0] : data.usuarios;
      setPinnedMessage({
        ...data,
        sender_name: sender?.nome || 'Usuário',
        sender_photo: sender?.foto_url || null
      });
      setShowPinnedBanner(true);
    } catch {
      setPinnedMessage(null);
    }
  };

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
          usuarios!chat_messages_sender_id_fkey(nome, foto_url)
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

          if (msg.sender_id === userId) {
            const { data: reads } = await supabase
              .from('chat_message_reads')
              .select('user_id')
              .eq('message_id', msg.id);

            return {
              ...msg,
              sender_name: sender?.nome || 'Usuário',
              sender_photo: sender?.foto_url || null,
              read_by: reads?.map(r => r.user_id) || []
            };
          }

          return {
            ...msg,
            sender_name: sender?.nome || 'Usuário',
            sender_photo: sender?.foto_url || null,
            read_by: []
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
            .select('nome, foto_url')
            .eq('id', payload.new.sender_id)
            .maybeSingle();

          const newMessage = {
            ...payload.new,
            sender_name: sender?.nome || 'Usuário',
            sender_photo: sender?.foto_url || null
          };

          setMessages(prev => {
            if (prev.some(m => m.id === newMessage.id)) {
              return prev;
            }
            return [...prev, newMessage as Message];
          });

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
          if (payload.new.pinned_at) {
            loadPinnedMessage();
          } else if (pinnedMessage?.id === payload.new.id && !payload.new.pinned_at) {
            setPinnedMessage(null);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_message_reads'
        },
        (payload) => {
          const newRead = payload.new as { message_id: string; user_id: string };
          setMessages(prev => prev.map(msg => {
            if (msg.id === newRead.message_id && msg.sender_id === userId) {
              const currentReadBy = msg.read_by || [];
              if (!currentReadBy.includes(newRead.user_id)) {
                return { ...msg, read_by: [...currentReadBy, newRead.user_id] };
              }
            }
            return msg;
          }));
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

  const scrollToPinnedMessage = () => {
    if (pinnedMessage) {
      const el = document.getElementById(`msg-${pinnedMessage.id}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-[#FFD700]/50', 'rounded-xl');
        setTimeout(() => el.classList.remove('ring-2', 'ring-[#FFD700]/50', 'rounded-xl'), 2000);
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
    <div className="flex-1 flex flex-col overflow-hidden bg-[#0a1015]">
      {pinnedMessage && showPinnedBanner && !pinnedMessage.deleted_at && (
        <div
          onClick={scrollToPinnedMessage}
          className="flex items-center gap-3 px-4 py-2.5 bg-gradient-to-r from-[#FFD700]/5 to-transparent border-b border-[#FFD700]/20 cursor-pointer hover:bg-[#FFD700]/10 transition-colors"
        >
          <Pin className="w-4 h-4 text-[#FFD700] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-[#FFD700] font-medium">Mensagem fixada</p>
            <p className="text-xs text-gray-400 truncate">
              {pinnedMessage.content || (pinnedMessage.message_type === 'image' ? 'Imagem' : 'Arquivo')}
            </p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); setShowPinnedBanner(false); }}
            className="p-1 hover:bg-white/10 rounded"
          >
            <X className="w-3.5 h-3.5 text-gray-500" />
          </button>
        </div>
      )}

      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4"
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
                <div key={message.id} id={`msg-${message.id}`} className="transition-all duration-300">
                  <ChatMessage
                    message={message}
                    isOwnMessage={message.sender_id === userId}
                    showSenderName={showSenderName}
                    isGrouped={isGrouped}
                    conversationType={conversationType}
                    onEdit={onEditMessage}
                    onDelete={onDeleteMessage}
                    onPin={onPinMessage}
                    currentUserName={currentUserName}
                  />
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>
    </div>
  );
});
