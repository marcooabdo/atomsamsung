import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Users, MessageSquare, UserCircle2 } from 'lucide-react';

interface Conversation {
  id: string;
  tipo: string;
  nome: string | null;
  unread_count: number;
  last_message: {
    content: string;
    message_type: string;
    sender_name: string;
    created_at: string;
  } | null;
  other_user?: {
    id: string;
    nome: string;
  };
}

interface User {
  id: string;
  nome: string;
  tipo: string;
  ativo: boolean;
}

interface ChatConversationListProps {
  userId: string;
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onCreateGroup: () => void;
}

export function ChatConversationList({
  userId,
  selectedConversationId,
  onSelectConversation,
  onCreateGroup
}: ChatConversationListProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState<'conversations' | 'contacts'>('conversations');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);

  useEffect(() => {
    loadConversations();

    const channel = supabase
      .channel('conversations-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_conversations'
        },
        () => {
          loadConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'chat_messages'
        },
        () => {
          loadConversations();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  useEffect(() => {
    if (activeTab === 'contacts') {
      loadUsers();
    }
  }, [activeTab]);

  const loadConversations = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_conversations_with_info')
        .select('*')
        .eq('user_id', userId)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const enrichedConversations = await Promise.all(
        (data || []).map(async (conv) => {
          if (conv.tipo === 'direct') {
            const { data: participants } = await supabase
              .from('chat_participants')
              .select('user_id, usuarios(id, nome)')
              .eq('conversation_id', conv.id)
              .neq('user_id', userId)
              .single();

            if (participants && participants.usuarios) {
              const otherUser = Array.isArray(participants.usuarios)
                ? participants.usuarios[0]
                : participants.usuarios;

              return {
                ...conv,
                other_user: otherUser
              };
            }
          }
          return conv;
        })
      );

      setConversations(enrichedConversations);
    } catch (err) {
      console.error('Erro ao carregar conversas:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      console.log('Carregando usuários... userId atual:', userId);
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome, tipo, ativo')
        .eq('ativo', true)
        .neq('id', userId)
        .order('nome');

      if (error) {
        console.error('Erro na query de usuários:', error);
        throw error;
      }

      console.log('Usuários carregados:', data);
      setUsers(data || []);
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleStartDirectConversation = async (otherUserId: string) => {
    try {
      const { data, error } = await supabase.rpc('create_direct_conversation', {
        user1_id: userId,
        user2_id: otherUserId
      });

      if (error) throw error;
      onSelectConversation(data);
      setActiveTab('conversations');
    } catch (err) {
      console.error('Erro ao criar conversa:', err);
      alert('Erro ao iniciar conversa');
    }
  };

  const filteredConversations = conversations.filter((conv) => {
    const searchLower = searchQuery.toLowerCase();
    if (conv.tipo === 'direct' && conv.other_user) {
      return conv.other_user.nome.toLowerCase().includes(searchLower);
    }
    return conv.nome?.toLowerCase().includes(searchLower);
  });

  const filteredUsers = users.filter((user) =>
    user.nome.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'agora';
    if (minutes < 60) return `${minutes}min`;
    if (hours < 24) return `${hours}h`;
    if (days === 1) return 'ontem';
    if (days < 7) return `${days}d`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const getMessagePreview = (conv: Conversation) => {
    if (!conv.last_message) return 'Sem mensagens';

    const { content, message_type, sender_name } = conv.last_message;
    const prefix = conv.tipo === 'group' ? `${sender_name}: ` : '';

    if (message_type === 'image') return `${prefix}📷 Foto`;
    if (message_type === 'document') return `${prefix}📎 Documento`;
    if (message_type === 'audio') return `${prefix}🎤 Áudio`;

    return `${prefix}${content}`;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-[#00D4FF]/20">
        <h2 className="text-xl font-bold text-[#00D4FF] mb-4 tech-heading">
          CHAT
        </h2>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('conversations')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'conversations'
                ? 'bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/50'
                : 'bg-black/40 text-gray-400 border border-gray-700 hover:border-[#00D4FF]/30'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Conversas
          </button>
          <button
            onClick={() => setActiveTab('contacts')}
            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold transition-all ${
              activeTab === 'contacts'
                ? 'bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/50'
                : 'bg-black/40 text-gray-400 border border-gray-700 hover:border-[#00D4FF]/30'
            }`}
          >
            <UserCircle2 className="w-4 h-4" />
            Contatos
          </button>
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder={activeTab === 'conversations' ? 'Buscar conversas...' : 'Buscar contatos...'}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-black/60 border border-[#00D4FF]/20 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-[#00D4FF]/50"
          />
        </div>

        {activeTab === 'conversations' && (
          <button
            onClick={onCreateGroup}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-[#00D4FF]/10 hover:bg-[#00D4FF]/20 border border-[#00D4FF]/30 rounded-lg text-[#00D4FF] font-semibold text-sm transition-all"
          >
            <Users className="w-4 h-4" />
            Novo Grupo
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto cyber-scrollbar">
        {activeTab === 'conversations' ? (
          loading ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00D4FF]"></div>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <MessageSquare className="w-12 h-12 mb-2 opacity-50" />
              <p className="text-sm">Nenhuma conversa ainda</p>
            </div>
          ) : (
            <div className="p-2">
              {filteredConversations.map((conv) => {
                const displayName = conv.tipo === 'direct' && conv.other_user
                  ? conv.other_user.nome
                  : conv.nome;

                return (
                  <button
                    key={conv.id}
                    onClick={() => onSelectConversation(conv.id)}
                    className={`w-full flex items-start gap-3 p-3 rounded-lg transition-all mb-1 ${
                      selectedConversationId === conv.id
                        ? 'bg-[#00D4FF]/15 border border-[#00D4FF]/50'
                        : 'hover:bg-[#00D4FF]/5 border border-transparent'
                    }`}
                  >
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-[#00D4FF]/20 flex items-center justify-center overflow-hidden">
                        {conv.tipo === 'group' ? (
                          <Users className="w-6 h-6 text-[#00D4FF]" />
                        ) : (
                          <div className="text-[#00D4FF] font-bold text-lg">
                            {displayName?.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between mb-1">
                        <h3 className="font-semibold text-gray-200 truncate">
                          {displayName}
                        </h3>
                        {conv.last_message && (
                          <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                            {formatTime(conv.last_message.created_at)}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <p className="text-sm text-gray-400 truncate flex-1">
                          {getMessagePreview(conv)}
                        </p>
                        {conv.unread_count > 0 && (
                          <span className="ml-2 flex-shrink-0 px-2 py-0.5 bg-[#39FF14] text-black text-xs font-bold rounded-full pulse-neon">
                            {conv.unread_count}
                          </span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )
        ) : (
          loadingUsers ? (
            <div className="flex items-center justify-center h-32">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00D4FF]"></div>
            </div>
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <UserCircle2 className="w-12 h-12 mb-2 opacity-50" />
              <p className="text-sm">Nenhum contato encontrado</p>
            </div>
          ) : (
            <div className="p-2">
              {filteredUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleStartDirectConversation(user.id)}
                  className="w-full flex items-start gap-3 p-3 rounded-lg transition-all mb-1 hover:bg-[#00D4FF]/5 border border-transparent hover:border-[#00D4FF]/30"
                >
                  <div className="relative flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-[#00D4FF]/20 flex items-center justify-center overflow-hidden">
                      <div className="text-[#00D4FF] font-bold text-lg">
                        {user.nome.charAt(0).toUpperCase()}
                      </div>
                    </div>
                  </div>

                  <div className="flex-1 min-w-0 text-left">
                    <h3 className="font-semibold text-gray-200 truncate">
                      {user.nome}
                    </h3>
                    <p className="text-xs text-gray-500 uppercase truncate">
                      {user.tipo}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
