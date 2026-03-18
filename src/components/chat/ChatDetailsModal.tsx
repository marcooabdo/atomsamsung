import { useState, useEffect } from 'react';
import { X, FileText, Download, Users, Mail, Building2, Phone, Hash, Briefcase, MessageCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ProfilePhotoUpload } from '../ProfilePhotoUpload';

interface ChatDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  conversationType: 'direct' | 'group';
  otherUserId?: string;
  conversationName?: string;
  groupPhotoUrl?: string | null;
}

interface UserDetails {
  id: string;
  nome: string;
  email: string;
  tipo?: string;
  foto_url?: string;
  unidade_nome?: string;
  telefone?: string | null;
  ramal?: string | null;
  cargo?: string | null;
  bio?: string | null;
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
  conversationName,
  groupPhotoUrl
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
          .select('id, nome, email, tipo, foto_url, unidade_id, telefone, ramal, cargo, bio')
          .eq('id', otherUserId)
          .maybeSingle();

        if (userData) {
          let unidadeNome = 'Sem unidade';
          if (userData.unidade_id) {
            const { data: unidadeData } = await supabase
              .from('unidades')
              .select('cidade')
              .eq('id', userData.unidade_id)
              .single();
            unidadeNome = unidadeData?.cidade || 'Sem unidade';
          }

          setUserDetails({
            id: userData.id,
            nome: userData.nome,
            email: userData.email,
            tipo: userData.tipo,
            foto_url: userData.foto_url,
            unidade_nome: unidadeNome,
            telefone: userData.telefone,
            ramal: userData.ramal,
            cargo: userData.cargo,
            bio: userData.bio,
          });
        }
      } else if (conversationType === 'group') {
        const { data: participantsData, error: participantsError } = await supabase
          .from('chat_participants')
          .select('user:usuarios(id, nome, email, tipo, foto_url, unidade_id)')
          .eq('conversation_id', conversationId);

        if (participantsError) {
          // ignored
        }

        if (participantsData) {
          const unidadeIds = [...new Set(
            participantsData
              .map((p: any) => {
                const user = Array.isArray(p.user) ? p.user[0] : p.user;
                return user?.unidade_id;
              })
              .filter(Boolean)
          )];

          let unidadesMap: Record<string, string> = {};
          if (unidadeIds.length > 0) {
            const { data: unidadesData } = await supabase
              .from('unidades')
              .select('id, cidade')
              .in('id', unidadeIds);

            unidadesMap = (unidadesData || []).reduce((acc: Record<string, string>, u: any) => {
              acc[u.id] = u.cidade;
              return acc;
            }, {});
          }

          const processedParticipants = participantsData.map((p: any) => {
            const user = Array.isArray(p.user) ? p.user[0] : p.user;
            return {
              id: user?.id,
              nome: user?.nome,
              email: user?.email,
              tipo: user?.tipo,
              foto_url: user?.foto_url,
              unidade_nome: user?.unidade_id ? unidadesMap[user.unidade_id] || 'Sem unidade' : 'Sem unidade'
            };
          });

          setParticipants(processedParticipants);
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
      // ignored
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
      <div className="modal-panel w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl">
        <div className="modal-header flex items-center justify-between px-6 py-4 rounded-t-2xl">
          <h2 className="text-lg font-bold">Informações</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#1a3a4a]/50 rounded-lg transition-all"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="overflow-y-auto max-h-[calc(90vh-5rem)]">
          {conversationType === 'direct' && userDetails && (
            <div className="p-6 border-b border-[var(--border-primary)]">
              <div className="flex gap-6">
                <div className="flex-shrink-0">
                  <ProfilePhotoUpload
                    userId={userDetails.id}
                    currentPhotoUrl={userDetails.foto_url || undefined}
                    userName={userDetails.nome}
                    onPhotoUpdated={() => {}}
                    size="large"
                    editable={false}
                  />
                </div>
                <div className="flex-1 min-w-0 space-y-4">
                  <div>
                    <h3 className="text-2xl font-bold truncate">{userDetails.nome}</h3>
                    {userDetails.tipo && (
                      <p className="text-sm text-gray-400 mt-1 uppercase">{userDetails.tipo}</p>
                    )}
                  </div>

                  {userDetails.bio && (
                    <p className="text-sm italic" style={{ color: 'var(--text-secondary)' }}>
                      "{userDetails.bio}"
                    </p>
                  )}

                  <div className="space-y-2">
                    {userDetails.cargo && (
                      <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-primary)' }}>
                        <Briefcase className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-accent)' }} />
                        <div>
                          <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Cargo</p>
                          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{userDetails.cargo}</p>
                        </div>
                      </div>
                    )}
                    {userDetails.unidade_nome && (
                      <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-primary)' }}>
                        <Building2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-accent)' }} />
                        <div>
                          <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Unidade</p>
                          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{userDetails.unidade_nome}</p>
                        </div>
                      </div>
                    )}
                    {userDetails.email && (
                      <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-primary)' }}>
                        <Mail className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-accent)' }} />
                        <div>
                          <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Email</p>
                          <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{userDetails.email}</p>
                        </div>
                      </div>
                    )}
                    {userDetails.telefone && (
                      <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-primary)' }}>
                        <Phone className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-accent)' }} />
                        <div>
                          <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Telefone</p>
                          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{userDetails.telefone}</p>
                        </div>
                      </div>
                    )}
                    {userDetails.ramal && (
                      <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-primary)' }}>
                        <Hash className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-accent)' }} />
                        <div>
                          <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Ramal</p>
                          <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{userDetails.ramal}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {conversationType === 'group' && (
            <div className="p-6 border-b border-[var(--border-primary)]">
              <div className="flex items-center gap-3 mb-4">
                {groupPhotoUrl ? (
                  <img
                    src={groupPhotoUrl}
                    alt={conversationName || 'Grupo'}
                    className="w-20 h-20 rounded-full object-cover border-2 border-[#00D4FF]/60"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-[#00D4FF]/20 border-2 border-[#00D4FF]/60 flex items-center justify-center">
                    <Users className="w-10 h-10 text-[#00D4FF]" />
                  </div>
                )}
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
                    className="flex items-center gap-3 px-3 py-2 hover:bg-black/5 rounded-lg transition-all"
                  >
                    <ProfilePhotoUpload
                      userId={participant.id}
                      currentPhotoUrl={participant.foto_url || undefined}
                      userName={participant.nome}
                      onPhotoUpdated={() => {}}
                      size="small"
                      editable={false}
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-200 truncate">{participant.nome}</p>
                      <p className="text-xs text-gray-500 uppercase">
                        {participant.tipo}{participant.unidade_nome && participant.unidade_nome !== 'Sem unidade' ? ` - ${participant.unidade_nome}` : ''}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="p-6">
            <div className="flex gap-2 mb-4 border-b border-[var(--border-primary)]">
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
                      className="flex items-center gap-3 px-3 py-2 modal-section rounded-lg hover:border-[#00D4FF]/30 transition-all group"
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
