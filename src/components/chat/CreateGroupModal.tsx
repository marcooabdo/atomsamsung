import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Users, Search, Check } from 'lucide-react';

interface User {
  id: string;
  nome: string;
  foto_url: string | null;
  tipo: string;
}

interface CreateGroupModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  onGroupCreated: (conversationId: string) => void;
}

export function CreateGroupModal({ isOpen, onClose, userId, onGroupCreated }: CreateGroupModalProps) {
  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadUsers();
    }
  }, [isOpen]);

  const loadUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome, foto_url, tipo')
        .neq('id', userId)
        .order('nome');

      if (error) throw error;
      setUsers(data || []);
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
    }
  };

  const toggleUser = (id: string) => {
    const newSelected = new Set(selectedUsers);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedUsers(newSelected);
  };

  const handleCreate = async () => {
    if (!groupName.trim() || selectedUsers.size < 1) {
      alert('Preencha o nome do grupo e selecione pelo menos 1 membro');
      return;
    }

    setCreating(true);
    try {
      const { data: conversation, error: convError } = await supabase
        .from('chat_conversations')
        .insert({
          tipo: 'group',
          nome: groupName.trim(),
          descricao: groupDescription.trim() || null,
          created_by: userId
        })
        .select()
        .single();

      if (convError) throw convError;

      const participants = [
        { conversation_id: conversation.id, user_id: userId, role: 'admin' },
        ...Array.from(selectedUsers).map(uid => ({
          conversation_id: conversation.id,
          user_id: uid,
          role: 'member'
        }))
      ];

      const { error: partError } = await supabase
        .from('chat_participants')
        .insert(participants);

      if (partError) throw partError;

      onGroupCreated(conversation.id);
      handleClose();
    } catch (err) {
      console.error('Erro ao criar grupo:', err);
      alert('Erro ao criar grupo');
    } finally {
      setCreating(false);
    }
  };

  const handleClose = () => {
    setGroupName('');
    setGroupDescription('');
    setSelectedUsers(new Set());
    setSearchQuery('');
    onClose();
  };

  const filteredUsers = users.filter(user =>
    user.nome.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="premium-card w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-[#00D4FF]/20">
          <div className="flex items-center gap-3">
            <Users className="w-6 h-6 text-[#00D4FF]" />
            <h2 className="text-xl font-bold text-[#00D4FF] tech-heading">
              CRIAR GRUPO
            </h2>
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-[#00D4FF]/10 rounded-lg transition-all"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto cyber-scrollbar p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Nome do Grupo *
            </label>
            <input
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              placeholder="Ex: Equipe Técnica"
              maxLength={50}
              className="w-full px-4 py-2.5 bg-black/60 border border-[#00D4FF]/20 rounded-lg text-gray-300 placeholder-gray-500 focus:outline-none focus:border-[#00D4FF]/50"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Descrição (opcional)
            </label>
            <textarea
              value={groupDescription}
              onChange={(e) => setGroupDescription(e.target.value)}
              placeholder="Descreva o propósito do grupo..."
              maxLength={200}
              rows={3}
              className="w-full px-4 py-2.5 bg-black/60 border border-[#00D4FF]/20 rounded-lg text-gray-300 placeholder-gray-500 focus:outline-none focus:border-[#00D4FF]/50 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-2">
              Adicionar Membros * (mínimo 1)
            </label>

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

            {selectedUsers.size > 0 && (
              <div className="mb-3 p-3 bg-[#00D4FF]/10 rounded-lg border border-[#00D4FF]/30">
                <p className="text-sm text-[#00D4FF] font-semibold">
                  {selectedUsers.size} membro(s) selecionado(s)
                </p>
              </div>
            )}

            <div className="space-y-1 max-h-64 overflow-y-auto cyber-scrollbar">
              {filteredUsers.map((user) => {
                const isSelected = selectedUsers.has(user.id);

                return (
                  <button
                    key={user.id}
                    onClick={() => toggleUser(user.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-lg transition-all ${
                      isSelected
                        ? 'bg-[#00D4FF]/15 border border-[#00D4FF]/50'
                        : 'hover:bg-[#00D4FF]/5 border border-transparent'
                    }`}
                  >
                    <div className="w-10 h-10 rounded-full bg-[#00D4FF]/20 flex items-center justify-center flex-shrink-0">
                      {user.foto_url ? (
                        <img src={user.foto_url} alt="" className="w-full h-full rounded-full object-cover" />
                      ) : (
                        <span className="text-[#00D4FF] font-bold">
                          {user.nome.charAt(0).toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="flex-1 text-left">
                      <p className="font-semibold text-gray-200">{user.nome}</p>
                      <p className="text-xs text-gray-500 uppercase">{user.tipo}</p>
                    </div>

                    {isSelected && (
                      <Check className="w-5 h-5 text-[#00D4FF]" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-[#00D4FF]/20">
          <button
            onClick={handleClose}
            disabled={creating}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all bg-gray-700 hover:bg-gray-600 text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={handleCreate}
            disabled={!groupName.trim() || selectedUsers.size < 1 || creating}
            className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all bg-[#00D4FF] text-black hover:bg-[#00D4FF]/80 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating ? 'Criando...' : 'Criar Grupo'}
          </button>
        </div>
      </div>
    </div>
  );
}
