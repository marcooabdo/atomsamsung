import { useState, useEffect } from 'react';
import { X, Users, Info, Crown, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Participant {
  user_id: string;
  role: string;
  joined_at: string;
  user: {
    id: string;
    nome: string;
    tipo: string;
  };
}

interface GroupDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversationId: string;
  groupName: string | null;
  groupDescription: string | null;
}

export function GroupDetailsModal({
  isOpen,
  onClose,
  conversationId,
  groupName,
  groupDescription
}: GroupDetailsModalProps) {
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && conversationId) {
      fetchParticipants();
    }
  }, [isOpen, conversationId]);

  const fetchParticipants = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('chat_participants')
        .select(`
          user_id,
          role,
          joined_at,
          user:usuarios!chat_participants_user_id_fkey(id, nome, tipo)
        `)
        .eq('conversation_id', conversationId)
        .order('role', { ascending: true })
        .order('joined_at', { ascending: true });

      if (error) throw error;

      const formattedData = (data || []).map(p => ({
        ...p,
        user: Array.isArray(p.user) ? p.user[0] : p.user
      }));

      setParticipants(formattedData);
    } catch (err) {
      console.error('Erro ao buscar participantes:', err);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const admins = participants.filter(p => p.role === 'admin');
  const members = participants.filter(p => p.role === 'member');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-full max-w-md bg-[#0d1419] border border-[#1a3a4a] rounded-xl shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-[#1a3a4a]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#1a3a4a] flex items-center justify-center">
              <Users className="w-5 h-5 text-[#00D4FF]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">{groupName || 'Grupo'}</h2>
              <p className="text-xs text-gray-400">{participants.length} participantes</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#1a3a4a]/50 rounded-lg transition-all"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {groupDescription && (
            <div className="p-4 border-b border-[#1a3a4a]/50">
              <div className="flex items-start gap-3">
                <Info className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-xs text-gray-400 mb-1">Descricao</p>
                  <p className="text-sm text-gray-300">{groupDescription}</p>
                </div>
              </div>
            </div>
          )}

          <div className="p-4">
            <p className="text-xs text-gray-400 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              Participantes
            </p>

            {loading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-2 border-[#00D4FF] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-1">
                {admins.map((participant) => (
                  <div
                    key={participant.user_id}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#1a3a4a]/30 transition-all"
                  >
                    <div className="w-9 h-9 rounded-full bg-[#1a3a4a] flex items-center justify-center flex-shrink-0">
                      <span className="text-[#00D4FF] font-medium text-sm">
                        {participant.user?.nome?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">
                        {participant.user?.nome || 'Usuario'}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">
                        {participant.user?.tipo || ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-1 bg-amber-500/20 rounded-full">
                      <Crown className="w-3 h-3 text-amber-400" />
                      <span className="text-xs text-amber-400 font-medium">Admin</span>
                    </div>
                  </div>
                ))}

                {members.map((participant) => (
                  <div
                    key={participant.user_id}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-[#1a3a4a]/30 transition-all"
                  >
                    <div className="w-9 h-9 rounded-full bg-[#1a3a4a] flex items-center justify-center flex-shrink-0">
                      <span className="text-[#00D4FF] font-medium text-sm">
                        {participant.user?.nome?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium truncate">
                        {participant.user?.nome || 'Usuario'}
                      </p>
                      <p className="text-xs text-gray-500 capitalize">
                        {participant.user?.tipo || ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 px-2 py-1 bg-[#1a3a4a] rounded-full">
                      <User className="w-3 h-3 text-gray-400" />
                      <span className="text-xs text-gray-400">Membro</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-[#1a3a4a]">
          <button
            onClick={onClose}
            className="w-full py-2.5 bg-[#1a3a4a] hover:bg-[#1a3a4a]/70 text-white rounded-lg transition-all text-sm font-medium"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
