import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, Users, MessageSquare, AtSign } from 'lucide-react';
import { ProfilePhotoUpload } from '../ProfilePhotoUpload';

interface Conversation {
  id: string;
  tipo: string;
  nome: string | null;
  foto_url?: string | null;
  unread_count: number;
  participants_count?: number;
  last_message: {
    content: string;
    message_type: string;
    sender_name: string;
    created_at: string;
  } | null;
  other_user?: {
    id: string;
    nome: string;
    foto_url?: string | null;
    tipo?: string;
    unidade?: {
      cidade: string | null;
    } | null;
  };
}

interface User {
  id: string;
  nome: string;
  tipo: string;
  ativo: boolean;
  foto_url?: string | null;
  unidade?: {
    cidade: string | null;
  } | null;
}

interface ChatConversationListProps {
  userId: string;
  userType: string;
  selectedConversationId: string | null;
  onSelectConversation: (id: string) => void;
  onCreateGroup: () => void;
}

export function ChatConversationList({
  userId,
  userType,
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
  const [creatingConversation, setCreatingConversation] = useState(false);

  useEffect(() => {
    loadConversations();
    loadUsers();

    const channelName = `conversations-${userId}`;
    const channel = supabase
      .channel(channelName)
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
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages'
        },
        () => {
          loadConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_message_reads'
        },
        () => {
          loadConversations();
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_participants'
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
        .eq('user_id', userId);

      if (error) throw error;

      const conversationsWithMessages = (data || []).filter(conv => conv.last_message !== null);

      const sortedConversations = conversationsWithMessages.sort((a, b) => {
        const dateA = a.last_message?.created_at ? new Date(a.last_message.created_at).getTime() : 0;
        const dateB = b.last_message?.created_at ? new Date(b.last_message.created_at).getTime() : 0;
        return dateB - dateA;
      });

      const enrichedConversations = await Promise.all(
        sortedConversations.map(async (conv) => {
          if (conv.tipo === 'direct') {
            const { data: participants, error } = await supabase
              .from('chat_participants')
              .select('user_id, usuarios(id, nome, foto_url, tipo, unidade_id)')
              .eq('conversation_id', conv.id)
              .neq('user_id', userId)
              .single();

            if (error) {
              console.error('Erro ao buscar participante:', error);
            }

            if (participants && participants.usuarios) {
              let otherUser = Array.isArray(participants.usuarios)
                ? participants.usuarios[0]
                : participants.usuarios;

              let unidadeData = null;
              if (otherUser.unidade_id) {
                const { data: unidadeInfo } = await supabase
                  .from('unidades')
                  .select('cidade')
                  .eq('id', otherUser.unidade_id)
                  .single();
                unidadeData = unidadeInfo;
              }

              return {
                ...conv,
                other_user: {
                  id: otherUser.id,
                  nome: otherUser.nome,
                  foto_url: otherUser.foto_url,
                  tipo: otherUser.tipo,
                  unidade: unidadeData
                }
              };
            }
          } else if (conv.tipo === 'group') {
            const { count, error } = await supabase
              .from('chat_participants')
              .select('id', { count: 'exact', head: true })
              .eq('conversation_id', conv.id);

            return {
              ...conv,
              participants_count: count || 0
            };
          }
          return conv;
        })
      );

      setConversations(enrichedConversations);
    } catch (err) {
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    setLoadingUsers(true);
    try {
      const { data: usersData, error } = await supabase
        .from('usuarios')
        .select('id, nome, tipo, ativo, foto_url, unidade_id')
        .eq('ativo', true)
        .neq('id', userId)
        .order('nome');

      if (error) throw error;

      const { data: unidadesData } = await supabase
        .from('unidades')
        .select('id, cidade');

      const unidadesMap: Record<string, string> = {};
      (unidadesData || []).forEach((u: any) => {
        if (u.id && u.cidade) {
          unidadesMap[u.id] = u.cidade;
        }
      });

      const processedUsers: User[] = (usersData || []).map((user: any) => ({
        id: user.id,
        nome: user.nome,
        tipo: user.tipo,
        ativo: user.ativo,
        foto_url: user.foto_url,
        unidade: user.unidade_id && unidadesMap[user.unidade_id]
          ? { cidade: unidadesMap[user.unidade_id] }
          : null
      }));

      setUsers(processedUsers);
    } catch (err) {
      console.error('Erro ao carregar usuarios:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleStartDirectConversation = async (otherUserId: string) => {
    if (creatingConversation) return;

    setCreatingConversation(true);
    try {
      const { data, error } = await supabase.rpc('create_direct_conversation', {
        user1_id: userId,
        user2_id: otherUserId
      });

      if (error) throw error;
      if (!data) throw new Error('Nenhum ID de conversa retornado');

      await loadConversations();
      onSelectConversation(data);
      setActiveTab('conversations');
    } catch (err: any) {
      alert(`Erro ao iniciar conversa: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setCreatingConversation(false);
    }
  };

  const handleSelectConversation = async (conversationId: string) => {
    setConversations(prev =>
      prev.map(conv =>
        conv.id === conversationId
          ? { ...conv, unread_count: 0 }
          : conv
      )
    );

    onSelectConversation(conversationId);

    window.dispatchEvent(new CustomEvent('chat:messages-read', {
      detail: { conversationId, userId }
    }));

    await supabase.rpc('mark_messages_as_read', {
      p_conversation_id: conversationId,
      p_user_id: userId
    });

    await loadConversations();
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

    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}min`;
    if (hours < 24) {
      return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    if (days < 7) {
      return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' +
             date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
  };

  const getMessagePreview = (conv: Conversation) => {
    if (!conv.last_message) return 'Sem mensagens';

    const { content, message_type, sender_name } = conv.last_message;
    const prefix = conv.tipo === 'group' ? `${sender_name.split(' ')[0]}: ` : '';

    if (message_type === 'image') return `${prefix}Foto`;
    if (message_type === 'document') return `${prefix}Documento`;
    if (message_type === 'audio') return `${prefix}Audio`;

    const maxLength = 30;
    const text = `${prefix}${content}`;
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  };

  return (
    <div className="flex flex-col h-full bg-[#0d1419]">
      <div className="p-5">
        <h2 className="text-2xl font-bold text-[#00D4FF] mb-5 tracking-[0.2em]">
          CHAT
        </h2>

        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setActiveTab('conversations')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'conversations'
                ? 'bg-[#0d2832] text-[#00D4FF] border border-[#00D4FF]/40'
                : 'bg-[#151f26] text-gray-400 border border-[#1a3a4a]/50 hover:border-[#00D4FF]/30'
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            Conversas
          </button>
          <button
            onClick={() => setActiveTab('contacts')}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === 'contacts'
                ? 'bg-[#0d2832] text-[#00D4FF] border border-[#00D4FF]/40'
                : 'bg-[#151f26] text-gray-400 border border-[#1a3a4a]/50 hover:border-[#00D4FF]/30'
            }`}
          >
            <AtSign className="w-4 h-4" />
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
            className="w-full pl-10 pr-4 py-2.5 bg-[#151f26] border border-[#1a3a4a]/50 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-[#00D4FF]/40"
          />
        </div>

        {activeTab === 'conversations' && (
          <button
            onClick={onCreateGroup}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#0d2832] hover:bg-[#0d2832]/80 border border-[#00D4FF]/30 rounded-lg text-[#00D4FF] font-medium text-sm transition-all"
          >
            <Users className="w-4 h-4" />
            Novo Grupo
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
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
            <div className="px-3">
              {filteredConversations.map((conv) => {
                const displayName = conv.tipo === 'direct' && conv.other_user
                  ? conv.other_user.nome
                  : conv.nome;

                return (
                  <button
                    key={conv.id}
                    onClick={() => handleSelectConversation(conv.id)}
                    className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all mb-1 ${
                      selectedConversationId === conv.id
                        ? 'bg-[#00D4FF]/10'
                        : 'hover:bg-[#1a3a4a]/30'
                    }`}
                  >
                    <div className="flex-shrink-0">
                      {conv.tipo === 'group' ? (
                        conv.foto_url ? (
                          <img
                            src={conv.foto_url}
                            alt={displayName || 'Grupo'}
                            className="w-12 h-12 rounded-full object-cover border-2 border-[#1a3a4a]"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-full bg-[#1a3a4a] flex items-center justify-center">
                            <Users className="w-5 h-5 text-[#00D4FF]" />
                          </div>
                        )
                      ) : (
                        <ProfilePhotoUpload
                          userId={conv.other_user?.id || ''}
                          currentPhotoUrl={conv.other_user?.foto_url || undefined}
                          userName={displayName || 'U'}
                          onPhotoUpdated={() => {}}
                          size="small"
                          editable={false}
                        />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-white truncate">
                            {displayName}
                          </h3>
                          {conv.tipo === 'group' && conv.participants_count !== undefined ? (
                            <p className="text-xs text-gray-500 uppercase mt-0.5">
                              {conv.participants_count} {conv.participants_count === 1 ? 'participante' : 'participantes'}
                            </p>
                          ) : userType !== 'MASTER' && conv.tipo === 'direct' && conv.other_user && (
                            <p className="text-xs text-gray-500 uppercase mt-0.5">
                              {conv.other_user.tipo}{conv.other_user.unidade?.cidade ? ` - ${conv.other_user.unidade.cidade}` : ''}
                            </p>
                          )}
                        </div>
                        {conv.last_message && (
                          <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                            {formatTime(conv.last_message.created_at)}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-1">
                        <p className="text-sm text-gray-400 truncate pr-2">
                          {getMessagePreview(conv)}
                        </p>
                        {conv.unread_count > 0 && (
                          <span className="flex-shrink-0 min-w-[20px] h-5 px-1.5 bg-[#00D4FF] text-black text-xs font-bold rounded-full flex items-center justify-center">
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
              <AtSign className="w-12 h-12 mb-2 opacity-50" />
              <p className="text-sm">Nenhum contato encontrado</p>
            </div>
          ) : (
            <div className="px-3">
              {creatingConversation && (
                <div className="flex items-center justify-center p-4 bg-[#00D4FF]/10 rounded-lg mb-2 border border-[#00D4FF]/30">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#00D4FF] mr-3"></div>
                  <span className="text-sm text-[#00D4FF]">Abrindo conversa...</span>
                </div>
              )}
              {filteredUsers.map((user) => (
                <button
                  key={user.id}
                  onClick={() => handleStartDirectConversation(user.id)}
                  disabled={creatingConversation}
                  className="w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-all mb-1 hover:bg-[#1a3a4a]/30 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex-shrink-0">
                    <ProfilePhotoUpload
                      userId={user.id}
                      currentPhotoUrl={user.foto_url || undefined}
                      userName={user.nome}
                      onPhotoUpdated={() => {}}
                      size="small"
                      editable={false}
                    />
                  </div>

                  <div className="flex-1 min-w-0 text-left">
                    <h3 className="font-semibold text-white truncate">
                      {user.nome}
                    </h3>
                    <p className="text-xs text-gray-500 uppercase mt-0.5">
                      {user.tipo}{user.unidade?.cidade ? ` - ${user.unidade.cidade}` : ''}
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
