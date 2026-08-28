import { useState, useEffect } from 'react';
import { X, Mail, Building2, Phone, Hash, Briefcase, FileText, Download } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ProfilePhotoUpload } from '../ProfilePhotoUpload';

interface UserProfile {
  id: string;
  nome: string;
  email: string;
  tipo: string | null;
  foto_url: string | null;
  cargo: string | null;
  bio: string | null;
  telefone: string | null;
  ramal: string | null;
  unidade_nome: string | null;
}

interface SharedFile {
  id: string;
  file_url: string;
  file_name: string;
  file_size: number;
  message_type: string;
  created_at: string;
}

interface ChatUserProfileModalProps {
  userId: string;
  onClose: () => void;
}

export function ChatUserProfileModal({ userId, onClose }: ChatUserProfileModalProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [sharedFiles, setSharedFiles] = useState<SharedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'info' | 'files'>('info');

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('usuarios')
      .select('id, nome, email, tipo, foto_url, cargo, bio, telefone, ramal, unidade_id')
      .eq('id', userId)
      .maybeSingle();

    if (data) {
      let unidadeNome: string | null = null;
      if (data.unidade_id) {
        const { data: unidadeData } = await supabase
          .from('unidades')
          .select('cidade')
          .eq('id', data.unidade_id)
          .maybeSingle();
        unidadeNome = unidadeData?.cidade || null;
      }

      setProfile({
        id: data.id,
        nome: data.nome,
        email: data.email,
        tipo: data.tipo,
        foto_url: data.foto_url,
        cargo: data.cargo,
        bio: data.bio,
        telefone: data.telefone,
        ramal: data.ramal,
        unidade_nome: unidadeNome,
      });

      const { data: filesData } = await supabase
        .from('chat_messages')
        .select('id, file_url, file_name, file_size, message_type, created_at')
        .eq('sender_id', userId)
        .in('message_type', ['image', 'document'])
        .not('file_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (filesData) {
        setSharedFiles(filesData as SharedFile[]);
      }
    }
    setLoading(false);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="modal-panel w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl" onClick={e => e.stopPropagation()}>
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
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00D4FF] mx-auto"></div>
            </div>
          ) : profile ? (
            <>
              <div className="p-6 border-b border-[var(--border-primary)]">
                <div className="flex gap-6">
                  <div className="flex-shrink-0">
                    <ProfilePhotoUpload
                      userId={profile.id}
                      currentPhotoUrl={profile.foto_url || undefined}
                      userName={profile.nome}
                      onPhotoUpdated={() => {}}
                      size="large"
                      editable={false}
                    />
                  </div>
                  <div className="flex-1 min-w-0 space-y-4">
                    <div>
                      <h3 className="text-2xl font-bold truncate">{profile.nome}</h3>
                      {profile.tipo && (
                        <p className="text-sm text-gray-400 mt-1 uppercase">{profile.tipo}</p>
                      )}
                    </div>

                    {profile.bio && (
                      <p className="text-sm italic" style={{ color: 'var(--text-secondary)' }}>
                        "{profile.bio}"
                      </p>
                    )}

                    <div className="space-y-2">
                      {profile.cargo && (
                        <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-primary)' }}>
                          <Briefcase className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-accent)' }} />
                          <div>
                            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Cargo</p>
                            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{profile.cargo}</p>
                          </div>
                        </div>
                      )}
                      {profile.unidade_nome && (
                        <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-primary)' }}>
                          <Building2 className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-accent)' }} />
                          <div>
                            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Unidade</p>
                            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{profile.unidade_nome}</p>
                          </div>
                        </div>
                      )}
                      {profile.email && (
                        <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-primary)' }}>
                          <Mail className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-accent)' }} />
                          <div>
                            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Email</p>
                            <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{profile.email}</p>
                          </div>
                        </div>
                      )}
                      {profile.telefone && (
                        <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-primary)' }}>
                          <Phone className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-accent)' }} />
                          <div>
                            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Telefone</p>
                            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{profile.telefone}</p>
                          </div>
                        </div>
                      )}
                      {profile.ramal && (
                        <div className="flex items-center gap-3 px-4 py-3 rounded-lg" style={{ background: 'var(--bg-hover)', border: '1px solid var(--border-primary)' }}>
                          <Hash className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-accent)' }} />
                          <div>
                            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Ramal</p>
                            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{profile.ramal}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

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
                    {sharedFiles.length === 0 ? (
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
                              <img src={file.file_url} alt={file.file_name} className="w-full h-full object-cover" />
                            </div>
                          ) : (
                            <div className="w-12 h-12 rounded bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                              <FileText className="w-6 h-6 text-blue-400" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-200 truncate">{file.file_name}</p>
                            <p className="text-xs text-gray-500">
                              {formatFileSize(file.file_size)} • {formatDate(file.created_at)}
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
            </>
          ) : (
            <div className="flex items-center justify-center py-16 text-gray-500">
              Usuario nao encontrado
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
