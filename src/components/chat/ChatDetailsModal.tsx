import { useState, useEffect } from 'react';
import { X, Image, FileText, Download, Calendar, User, Users, Phone, Mail } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ChatDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  conversationType: 'direct' | 'group';
  otherUserId?: string;
  conversationName?: string;
}

interface UserDetails {
  id: string;
  nome: string;
  email: string;
  telefone?: string;
  cargo?: string;
  foto_url?: string;
  unidade_nome?: string;
}

interface SharedFile {
  id: string;
  file_url: string;
  file_name: string;
  file_size: number;
  message_type: string;
  created_at: string;
  sender_name: string;
}

export function ChatDetailsModal({
  isOpen,
  onClose,
  conversationId,
  conversationType,
  otherUserId,
  conversationName
}: ChatDetailsModalProps) {
  const [userDetails, setUserDetails] = useState<UserDetails | null>(null);
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
  const [participants, setParticipants] = useState<UserDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'files'>('info');

  useEffect(() => {
    if (isOpen) {
      loadDetails();
    }
  }, [isOpen, conversationId, otherUserId]);

  const loadDetails = async () => {
    setLoading(true);
    try {
      if (conversationType === 'direct' && otherUserId) {
        const { data: userData } = await supabase
          .from('usuarios')
          .select(`
            id,
            nome,
            email,
            telefone,
            cargo,
            foto_url,
            unidades(nome)
          `)
          .eq('id', otherUserId)
          .maybeSingle();

        if (userData) {
          setUserDetails({
            ...userData,
            unidade_nome: (userData as any).unidades?.nome
          });
        }
      } else if (conversationType === 'group') {
        const { data: participantsData } = await supabase
          .from('chat_participants')
          .select(`
            user:usuarios(
              id,
              nome,
              email,
              telefone,
              cargo,
              foto_url,
              unidades(nome)
            )
          `)
          .eq('conversation_id', conversationId);

        if (participantsData) {
          setParticipants(
            participantsData.map((p: any) => ({
              ...p.user,
              unidade_nome: p.user?.unidades?.nome
            }))
          );
        }
      }

      const { data: filesData } = await supabase
        .from('chat_messages')
        .select(`
          id,
          file_url,
          file_name,
          file_size,
          message_type,
          created_at,
          sender:usuarios!chat_messages_sender_id_fkey(nome)
        `)
        .eq('conversation_id', conversationId)
        .in('message_type', ['image', 'document'])
        .not('file_url', 'is', null)
        .order('created_at', { ascending: false });

      if (filesData) {
        setSharedFiles(
          filesData.map((f: any) => ({
            ...f,
            sender_name: f.sender?.nome || 'Desconhecido'
          }))
        );
      }
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getUserColor = (name: string) => {
    const colors = [
      '#00D4FF', '#39FF14', '#FF6B35', '#FFD700', '#FF1493',
      '#8A2BE2', '#00FA9A', '#FF69B4'
    ];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-[#0d1419] border border-[#1a3a4a] rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1a3a4a]/50 bg-gradient-to-r from-[#0d1419] to-[#0d2832]">
          <h2 className="text-lg font-bold text-gray-200">Informações</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#1a3a4a]/50 rounded-lg transition-all"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-5rem)]">
          {conversationType === 'direct' && userDetails && (
            <div className="p-6 border-b border-[#1a3a4a]/50">
              <div className="flex flex-col items-center gap-4">
                <div
                  className="w-32 h-32 rounded-full flex items-center justify-center"
                  style={{
                    backgroundColor: `${getUserColor(userDetails.nome)}20`,
                    border: `3px solid ${getUserColor(userDetails.nome)}60`
                  }}
                >
                  {userDetails.foto_url ? (
                    <img
                      src={userDetails.foto_url}
                      alt={userDetails.nome}
                      className="w-full h-full rounded-full object-cover"
                    />
                  ) : (
                    <span
                      className="text-5xl font-bold"
                      style={{ color: getUserColor(userDetails.nome) }}
                    >
                      {userDetails.nome.charAt(0).toUpperCase()}
                    </span>
                  )}
                </div>
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-gray-200">{userDetails.nome}</h3>
                  {userDetails.cargo && (
                    <p className="text-sm text-gray-400 mt-1">{userDetails.cargo}</p>
                  )}
                  {userDetails.unidade_nome && (
                    <p className="text-sm text-[#00D4FF] mt-1">{userDetails.unidade_nome}</p>
                  )}
                </div>
              </div>

              <div className="mt-6 space-y-3">
                {userDetails.telefone && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-[#151f26] rounded-lg border border-[#1a3a4a]/50">
                    <Phone className="w-5 h-5 text-[#00D4FF]" />
                    <div>
                      <p className="text-xs text-gray-500">Telefone</p>
                      <p className="text-sm text-gray-200">{userDetails.telefone}</p>
                    </div>
                  </div>
                )}
                {userDetails.email && (
                  <div className="flex items-center gap-3 px-4 py-3 bg-[#151f26] rounded-lg border border-[#1a3a4a]/50">
                    <Mail className="w-5 h-5 text-[#00D4FF]" />
                    <div>
                      <p className="text-xs text-gray-500">Email</p>
                      <p className="text-sm text-gray-200">{userDetails.email}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {conversationType === 'group' && (
            <div className="p-6 border-b border-[#1a3a4a]/50">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-20 h-20 rounded-full bg-[#00D4FF]/20 border-2 border-[#00D4FF]/60 flex items-center justify-center">
                  <Users className="w-10 h-10 text-[#00D4FF]" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-200">{conversationName || 'Grupo'}</h3>
                  <p className="text-sm text-gray-400">{participants.length} participantes</p>
                </div>
              </div>

              <div className="space-y-2 mt-4">
                <p className="text-xs text-gray-500 uppercase font-semibold mb-3">Participantes</p>
                {participants.map((participant) => (
                  <div
                    key={participant.id}
                    className="flex items-center gap-3 px-3 py-2 hover:bg-[#151f26] rounded-lg transition-all"
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center"
                      style={{
                        backgroundColor: `${getUserColor(participant.nome)}20`,
                        border: `2px solid ${getUserColor(participant.nome)}60`
                      }}
                    >
                      {participant.foto_url ? (
                        <img
                          src={participant.foto_url}
                          alt={participant.nome}
                          className="w-full h-full rounded-full object-cover"
                        />
                      ) : (
                        <span
                          className="text-sm font-bold"
                          style={{ color: getUserColor(participant.nome) }}
                        >
                          {participant.nome.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-200">{participant.nome}</p>
                      {participant.cargo && (
                        <p className="text-xs text-gray-500">{participant.cargo}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-6">
            <div className="flex gap-2 mb-4 border-b border-[#1a3a4a]/50">
              <button
                onClick={() => setActiveTab('info')}
                className={`px-4 py-2 text-sm font-medium transition-all ${
                  activeTab === 'info'
                    ? 'text-[#00D4FF] border-b-2 border-[#00D4FF]'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Informações
              </button>
              <button
                onClick={() => setActiveTab('files')}
                className={`px-4 py-2 text-sm font-medium transition-all ${
                  activeTab === 'files'
                    ? 'text-[#00D4FF] border-b-2 border-[#00D4FF]'
                    : 'text-gray-400 hover:text-gray-300'
                }`}
              >
                Arquivos ({sharedFiles.length})
              </button>
            </div>

            {activeTab === 'files' && (
              <div className="space-y-2">
                {loading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00D4FF] mx-auto"></div>
                  </div>
                ) : sharedFiles.length === 0 ? (
                  <div className="text-center py-8">
                    <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-500">Nenhum arquivo compartilhado</p>
                  </div>
                ) : (
                  sharedFiles.map((file) => (
                    <div
                      key={file.id}
                      className="flex items-center gap-3 px-3 py-2 bg-[#151f26] rounded-lg border border-[#1a3a4a]/50 hover:border-[#00D4FF]/30 transition-all group"
                    >
                      {file.message_type === 'image' ? (
                        <div className="w-12 h-12 rounded overflow-hidden flex-shrink-0">
                          <img
                            src={file.file_url}
                            alt={file.file_name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-6 h-6 text-blue-400" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-200 truncate">
                          {file.file_name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(file.file_size)} • {file.sender_name} • {formatDate(file.created_at)}
                        </p>
                      </div>
                      <a
                        href={file.file_url}
                        download
                        className="p-2 hover:bg-[#00D4FF]/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Download className="w-5 h-5 text-[#00D4FF]" />
                      </a>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
