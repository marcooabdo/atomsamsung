import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { Search, X, User, MessageSquare, FileText, Image, Music, Loader2 } from 'lucide-react';

interface SearchResult {
  contacts: ContactResult[];
  messages: MessageResult[];
  files: FileResult[];
  total_results: number;
}

interface ContactResult {
  type: 'contact';
  id: string;
  nome: string;
  foto_url?: string | null;
  tipo: string;
  cidade?: string | null;
  relevance: number;
}

interface MessageResult {
  type: 'message';
  id: string;
  conversation_id: string;
  content: string;
  snippet: string;
  sender_id: string;
  sender_name: string;
  sender_foto?: string | null;
  conversation_name: string;
  created_at: string;
  relevance: number;
}

interface FileResult {
  type: 'file';
  id: string;
  conversation_id: string;
  file_name: string;
  file_url: string;
  file_size: number;
  message_type: string;
  sender_id: string;
  sender_name: string;
  sender_foto?: string | null;
  conversation_name: string;
  created_at: string;
  relevance: number;
}

interface GlobalChatSearchProps {
  userId: string;
  onSelectContact: (conversationId: string) => void;
  onSelectMessage: (conversationId: string, messageId: string) => void;
  onClose: () => void;
}

export function GlobalChatSearch({ userId, onSelectContact, onSelectMessage, onClose }: GlobalChatSearchProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<'all' | 'contacts' | 'messages' | 'files'>('all');
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout>();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setResults(null);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      performSearch();
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  const performSearch = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('global_chat_search', {
        p_user_id: userId,
        p_search_query: searchQuery.trim()
      });

      if (error) throw error;
      setResults(data);
    } catch (err) {
      console.error('Erro na busca:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleContactClick = async (contactId: string) => {
    try {
      const { data: existingConv } = await supabase
        .from('chat_participants')
        .select('conversation_id, chat_conversations!inner(tipo)')
        .eq('user_id', userId)
        .eq('chat_conversations.tipo', 'direct');

      if (existingConv) {
        for (const conv of existingConv) {
          const { data: otherParticipant } = await supabase
            .from('chat_participants')
            .select('user_id')
            .eq('conversation_id', conv.conversation_id)
            .neq('user_id', userId)
            .maybeSingle();

          if (otherParticipant?.user_id === contactId) {
            onSelectContact(conv.conversation_id);
            onClose();
            return;
          }
        }
      }

      const { data: newConv, error } = await supabase
        .from('chat_conversations')
        .insert({
          tipo: 'direct',
          created_by: userId
        })
        .select()
        .single();

      if (error) throw error;

      await supabase.from('chat_participants').insert([
        { conversation_id: newConv.id, user_id: userId, role: 'member' },
        { conversation_id: newConv.id, user_id: contactId, role: 'member' }
      ]);

      onSelectContact(newConv.id);
      onClose();
    } catch (err) {
      console.error('Erro ao criar conversa:', err);
    }
  };

  const highlightText = (text: string, query: string) => {
    if (!query.trim()) return text;

    const terms = query.toLowerCase().split(' ').filter(t => t.length > 0);
    let highlightedText = text;

    terms.forEach(term => {
      const regex = new RegExp(`(${term})`, 'gi');
      highlightedText = highlightedText.replace(
        regex,
        '<mark class="bg-[#00D4FF]/30 text-[#00D4FF] px-0.5 rounded">$1</mark>'
      );
    });

    return highlightedText;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  };

  const filteredContacts = activeCategory === 'all' || activeCategory === 'contacts' ? results?.contacts || [] : [];
  const filteredMessages = activeCategory === 'all' || activeCategory === 'messages' ? results?.messages || [] : [];
  const filteredFiles = activeCategory === 'all' || activeCategory === 'files' ? results?.files || [] : [];

  const hasResults = filteredContacts.length > 0 || filteredMessages.length > 0 || filteredFiles.length > 0;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-20">
      <div className="w-full max-w-3xl bg-[#0d1419] rounded-2xl shadow-2xl border border-[#1a3a4a] overflow-hidden animate-in fade-in slide-in-from-top-4 duration-300">
        <div className="p-4 border-b border-[#1a3a4a]/50">
          <div className="flex items-center gap-3 bg-[#151f26] rounded-xl px-4 py-3 border border-[#1a3a4a]/50 focus-within:border-[#00D4FF]/50 transition-all">
            <Search className="w-5 h-5 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar contatos, mensagens ou arquivos..."
              className="flex-1 bg-transparent text-gray-200 placeholder-gray-500 outline-none text-sm"
            />
            {loading && <Loader2 className="w-5 h-5 text-[#00D4FF] animate-spin" />}
            <button
              onClick={onClose}
              className="p-1 hover:bg-[#1a3a4a]/50 rounded-lg transition-all"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {results && results.total_results > 0 && (
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => setActiveCategory('all')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  activeCategory === 'all'
                    ? 'bg-[#00D4FF] text-black'
                    : 'bg-[#151f26] text-gray-400 hover:bg-[#1a3a4a]/50'
                }`}
              >
                Todos ({results.total_results})
              </button>
              {results.contacts.length > 0 && (
                <button
                  onClick={() => setActiveCategory('contacts')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeCategory === 'contacts'
                      ? 'bg-[#00D4FF] text-black'
                      : 'bg-[#151f26] text-gray-400 hover:bg-[#1a3a4a]/50'
                  }`}
                >
                  Contatos ({results.contacts.length})
                </button>
              )}
              {results.messages.length > 0 && (
                <button
                  onClick={() => setActiveCategory('messages')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeCategory === 'messages'
                      ? 'bg-[#00D4FF] text-black'
                      : 'bg-[#151f26] text-gray-400 hover:bg-[#1a3a4a]/50'
                  }`}
                >
                  Mensagens ({results.messages.length})
                </button>
              )}
              {results.files.length > 0 && (
                <button
                  onClick={() => setActiveCategory('files')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    activeCategory === 'files'
                      ? 'bg-[#00D4FF] text-black'
                      : 'bg-[#151f26] text-gray-400 hover:bg-[#1a3a4a]/50'
                  }`}
                >
                  Arquivos ({results.files.length})
                </button>
              )}
            </div>
          )}
        </div>

        <div className="max-h-[calc(100vh-300px)] overflow-y-auto">
          {!searchQuery.trim() ? (
            <div className="py-12 text-center">
              <Search className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">Digite pelo menos 2 caracteres para buscar</p>
            </div>
          ) : loading && !results ? (
            <div className="py-12 text-center">
              <Loader2 className="w-12 h-12 text-[#00D4FF] mx-auto mb-3 animate-spin" />
              <p className="text-gray-500 text-sm">Buscando...</p>
            </div>
          ) : !hasResults ? (
            <div className="py-12 text-center">
              <Search className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400 font-medium mb-1">Nenhum resultado encontrado</p>
              <p className="text-gray-500 text-sm">Tente buscar com outras palavras</p>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {filteredContacts.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2 px-2">Contatos</h3>
                  <div className="space-y-1">
                    {filteredContacts.map((contact) => (
                      <button
                        key={contact.id}
                        onClick={() => handleContactClick(contact.id)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-[#151f26] transition-all text-left group"
                      >
                        {contact.foto_url ? (
                          <img
                            src={contact.foto_url}
                            alt={contact.nome}
                            className="w-10 h-10 rounded-full object-cover border border-[#1a3a4a]"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#1a3a4a]/50 flex items-center justify-center border border-[#1a3a4a]">
                            <User className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p
                            className="text-sm font-medium text-gray-200 group-hover:text-[#00D4FF] transition-colors"
                            dangerouslySetInnerHTML={{ __html: highlightText(contact.nome, searchQuery) }}
                          />
                          <p className="text-xs text-gray-500">
                            {contact.tipo} {contact.cidade && `• ${contact.cidade}`}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {filteredMessages.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2 px-2">Mensagens</h3>
                  <div className="space-y-1">
                    {filteredMessages.map((message) => (
                      <button
                        key={message.id}
                        onClick={() => onSelectMessage(message.conversation_id, message.id)}
                        className="w-full flex items-start gap-3 p-3 rounded-lg hover:bg-[#151f26] transition-all text-left group"
                      >
                        {message.sender_foto ? (
                          <img
                            src={message.sender_foto}
                            alt={message.sender_name}
                            className="w-10 h-10 rounded-full object-cover border border-[#1a3a4a] flex-shrink-0"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-[#1a3a4a]/50 flex items-center justify-center border border-[#1a3a4a] flex-shrink-0">
                            <User className="w-5 h-5 text-gray-400" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-medium text-gray-200 group-hover:text-[#00D4FF] transition-colors">
                              {message.conversation_name}
                            </p>
                            <span className="text-xs text-gray-500">
                              {formatDate(message.created_at)}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 mb-1">{message.sender_name}</p>
                          <p
                            className="text-sm text-gray-400 line-clamp-2"
                            dangerouslySetInnerHTML={{ __html: highlightText(message.snippet, searchQuery) }}
                          />
                        </div>
                        <MessageSquare className="w-4 h-4 text-gray-600 flex-shrink-0 mt-1" />
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {filteredFiles.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase mb-2 px-2">Arquivos</h3>
                  <div className="space-y-1">
                    {filteredFiles.map((file) => (
                      <button
                        key={file.id}
                        onClick={() => onSelectMessage(file.conversation_id, file.id)}
                        className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-[#151f26] transition-all text-left group"
                      >
                        <div className="w-10 h-10 rounded-lg bg-[#1a3a4a]/50 flex items-center justify-center border border-[#1a3a4a] flex-shrink-0">
                          {file.message_type === 'image' ? (
                            <Image className="w-5 h-5 text-[#00D4FF]" />
                          ) : file.message_type === 'audio' ? (
                            <Music className="w-5 h-5 text-[#00D4FF]" />
                          ) : (
                            <FileText className="w-5 h-5 text-[#00D4FF]" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p
                              className="text-sm font-medium text-gray-200 group-hover:text-[#00D4FF] transition-colors truncate"
                              dangerouslySetInnerHTML={{ __html: highlightText(file.file_name, searchQuery) }}
                            />
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{file.conversation_name}</span>
                            <span>•</span>
                            <span>{file.sender_name}</span>
                            <span>•</span>
                            <span>{formatFileSize(file.file_size)}</span>
                            <span>•</span>
                            <span>{formatDate(file.created_at)}</span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
