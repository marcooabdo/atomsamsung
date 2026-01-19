import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Users, Search, Check, Trash2, Shield, UserMinus, Camera } from 'lucide-react';

interface Participant {
  id: string;
  user_id: string;
  role: string;
  nome: string;
  tipo: string;
  cidade?: string | null;
}

interface EditGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  onUpdate: () => void;
}

export function EditGroupModal({ isOpen, onClose, conversationId, onUpdate }: EditGroupModalProps) {
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupPhotoUrl, setGroupPhotoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadGroupInfo();
      loadParticipants();
      loadAvailableUsers();
    }
  }, [isOpen, conversationId]);

  const loadGroupInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_conversations')
        .select('nome, descricao, foto_url')
        .eq('id', conversationId)
        .single();

      if (error) throw error;
      setGroupName(data.nome || '');
      setGroupDescription(data.descricao || '');
      setGroupPhotoUrl(data.foto_url || null);
    } catch (err) {
    }
  };

  const loadParticipants = async () => {
    try {
      const { data, error } = await supabase
        .from('chat_participants')
        .select(`
          id,
          user_id,
          role,
          usuarios(id, nome, tipo, unidade:unidades(cidade))
        `)
        .eq('conversation_id', conversationId);

      if (error) throw error;

      const enriched = data.map(p => {
        const user = Array.isArray(p.usuarios) ? p.usuarios[0] : p.usuarios;
        return {
          id: p.id,
          user_id: p.user_id,
          role: p.role,
          nome: user.nome,
          tipo: user.tipo,
          cidade: user.unidade?.cidade
        };
      });

      setParticipants(enriched);
    } catch (err) {
    }
  };

  const loadAvailableUsers = async () => {
    try {
      const { data: allUsers, error: usersError } = await supabase
        .from('usuarios')
        .select('id, nome, tipo, unidade:unidades(cidade)')
        .eq('ativo', true)
        .order('nome');

      if (usersError) throw usersError;

      const { data: currentParticipants, error: partError } = await supabase
        .from('chat_participants')
        .select('user_id')
        .eq('conversation_id', conversationId);

      if (partError) throw partError;

      const participantIds = new Set(currentParticipants.map(p => p.user_id));
      const available = allUsers.filter(u => !participantIds.has(u.id));

      setAvailableUsers(available);
    } catch (err) {
    }
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Por favor, selecione apenas arquivos de imagem');
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      alert('A imagem deve ter no máximo 2MB');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${conversationId}-${Date.now()}.${fileExt}`;
      const filePath = `group_photos/${fileName}`;

      if (groupPhotoUrl) {
        const oldPath = groupPhotoUrl.split('/').slice(-2).join('/');
        await supabase.storage.from('chat').remove([oldPath]);
      }

      const { error: uploadError } = await supabase.storage
        .from('chat')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('chat')
        .getPublicUrl(filePath);

      setGroupPhotoUrl(publicUrl);
    } catch (err: any) {
      alert(`Erro ao fazer upload da foto: ${err.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    if (!groupPhotoUrl) return;
    if (!confirm('Remover foto do grupo?')) return;

    try {
      const oldPath = groupPhotoUrl.split('/').slice(-2).join('/');
      await supabase.storage.from('chat').remove([oldPath]);
      setGroupPhotoUrl(null);
    } catch (err) {
      console.error('Erro ao remover foto:', err);
    }
  };

  const handleSave = async () => {
    if (!groupName.trim()) {
      alert('O nome do grupo é obrigatório');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('chat_conversations')
        .update({
          nome: groupName.trim(),
          descricao: groupDescription.trim() || null,
          foto_url: groupPhotoUrl
        })
        .eq('id', conversationId);

      if (error) throw error;

      onUpdate();
      onClose();
    } catch (err) {
      alert('Erro ao salvar alterações');
    } finally {
      setSaving(false);
    }
  };

  const handleAddMember = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('chat_participants')
        .insert({
          conversation_id: conversationId,
          user_id: userId,
          role: 'member'
        });

      if (error) throw error;

      loadParticipants();
      loadAvailableUsers();
    } catch (err) {
      alert('Erro ao adicionar membro');
    }
  };

  const handleRemoveMember = async (participantId: string) => {
    if (!confirm('Remover este membro do grupo?')) return;

    try {
      const { error } = await supabase
        .from('chat_participants')
        .delete()
        .eq('id', participantId);

      if (error) throw error;

      loadParticipants();
      loadAvailableUsers();
    } catch (err) {
      alert('Erro ao remover membro');
    }
  };

  const handleToggleAdmin = async (participantId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'member' : 'admin';

    try {
      const { error } = await supabase
        .from('chat_participants')
        .update({ role: newRole })
        .eq('id', participantId);

      if (error) throw error;

      loadParticipants();
    } catch (err) {
      alert('Erro ao alterar permissão');
    }
  };

  const filteredAvailable = availableUsers.filter(user =>
    user.nome.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="premium-card w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-[#00D4FF]/20">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-[#00D4FF]" />
            <h2 className="text-xl font-bold text-[#00D4FF] tech-heading">
              EDITAR GRUPO
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#00D4FF]/10 rounded-lg transition-all"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto cyber-scrollbar p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-3">
              Foto do Grupo
            </label>
            <div className="flex items-center gap-4">
              <div className="relative">
                {groupPhotoUrl ? (
                  <img
                    src={groupPhotoUrl}
                    alt="Foto do grupo"
                    className="w-20 h-20 rounded-full object-cover border-2 border-[#00D4FF]/30"
                  />
                ) : (
                  <div className="w-20 h-20 rounded-full bg-[#1a3a4a] flex items-center justify-center border-2 border-[#00D4FF]/30">
                    <Users className="w-8 h-8 text-[#00D4FF]" />
                  </div>
                )}
                {uploading && (
                  <div className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center">
                    <div className="w-5 h-5 border-2 border-[#00D4FF] border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex gap-2">
                <label className="px-4 py-2 bg-[#00D4FF]/20 hover:bg-[#00D4FF]/30 border border-[#00D4FF]/30 text-[#00D4FF] rounded-lg cursor-pointer transition-all text-sm font-semibold flex items-center gap-2">
                  <Camera className="w-4 h-4" />
                  {groupPhotoUrl ? 'Trocar Foto' : 'Adicionar Foto'}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handlePhotoUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
                {groupPhotoUrl && (
                  <button
                    onClick={handleRemovePhoto}
                    disabled={uploading}
                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 text-red-400 rounded-lg transition-all text-sm font-semibold disabled:opacity-50"
                  >
                    Remover
                  </button>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Nome do Grupo
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              maxLength={50}
              className="w-full px-4 py-2.5 bg-black/60 border border-[#00D4FF]/20 rounded-lg text-gray-300 focus:outline-none focus:border-[#00D4FF]/50"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Descrição
            </label>
            <textarea
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              maxLength={200}
              rows={3}
              className="w-full px-4 py-2.5 bg-black/60 border border-[#00D4FF]/20 rounded-lg text-gray-300 resize-none focus:outline-none focus:border-[#00D4FF]/50"
            />
          </div>

          <div>
            <h3 className="text-sm font-semibold text-gray-300 mb-3">
              Participantes ({participants.length})
            </h3>
            <div className="space-y-1 mb-4">
              {participants.map((participant) => (
                <div
                  key={participant.id}
                  className="flex items-center gap-3 p-3 bg-black/40 rounded-lg border border-gray-800"
                >
                  <div className="w-10 h-10 rounded-full bg-[#00D4FF]/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-[#00D4FF] font-bold">
                      {participant.nome.charAt(0).toUpperCase()}
                    </span>
                  </div>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-200">{participant.nome}</p>
                      {participant.role === 'admin' && (
                        <span className="px-2 py-0.5 bg-[#39FF14]/20 text-[#39FF14] text-xs font-bold rounded">
                          ADMIN
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 uppercase">{participant.tipo}{participant.cidade ? ` - ${participant.cidade}` : ''}</p>
                  </div>

                  <button
                    onClick={() => handleToggleAdmin(participant.id, participant.role)}
                    className="p-2 hover:bg-[#00D4FF]/10 rounded-lg transition-all"
                    title={participant.role === 'admin' ? 'Remover admin' : 'Tornar admin'}
                  >
                    <Shield className={`w-4 h-4 ${participant.role === 'admin' ? 'text-[#39FF14]' : 'text-gray-500'}`} />
                  </button>

                  <button
                    onClick={() => handleRemoveMember(participant.id)}
                    className="p-2 hover:bg-red-500/10 rounded-lg transition-all"
                    title="Remover do grupo"
                  >
                    <UserMinus className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {availableUsers.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-300 mb-3">
                Adicionar Membros
              </h3>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar usuários..."
                  className="w-full pl-10 pr-4 py-2 bg-black/60 border border-[#00D4FF]/20 rounded-lg text-sm text-gray-300 placeholder-gray-500 focus:outline-none focus:border-[#00D4FF]/50"
                />
              </div>

              <div className="space-y-1 max-h-48 overflow-y-auto cyber-scrollbar">
                {filteredAvailable.map((user) => (
                  <button
                    key={user.id}
                    onClick={() => handleAddMember(user.id)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-[#00D4FF]/5 border border-transparent transition-all"
                  >
                    <div className="w-10 h-10 rounded-full bg-[#00D4FF]/20 flex items-center justify-center flex-shrink-0">
                      <span className="text-[#00D4FF] font-bold">
                        {user.nome.charAt(0).toUpperCase()}
                      </span>
                    </div>

                    <div className="flex-1 text-left">
                      <p className="font-semibold text-gray-200">{user.nome}</p>
                      <p className="text-xs text-gray-500 uppercase">{user.tipo}{user.unidade?.cidade ? ` - ${user.unidade.cidade}` : ''}</p>
                    </div>

                    <Check className="w-5 h-5 text-[#00D4FF]" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-[#00D4FF]/20">
          <button
            onClick={onClose}
            disabled={saving}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all bg-gray-700 hover:bg-gray-600 text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={!groupName.trim() || saving}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all bg-[#00D4FF] text-black hover:bg-[#00D4FF]/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </div>
    </div>
  );
}
