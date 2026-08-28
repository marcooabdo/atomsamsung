import { useState, useEffect } from 'react';
import { X, Phone, Mail, Hash, Briefcase, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface UserProfile {
  id: string;
  nome: string;
  foto_url: string | null;
  tipo: string | null;
  cargo: string | null;
  bio: string | null;
  telefone: string | null;
  ramal: string | null;
  email: string | null;
  exibir_email: boolean;
  exibir_telefone: boolean;
  unidade?: { nome: string | null; cidade: string | null } | null;
}

interface ChatUserProfileModalProps {
  userId: string;
  onClose: () => void;
}

export function ChatUserProfileModal({ userId, onClose }: ChatUserProfileModalProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, [userId]);

  const loadProfile = async () => {
    const { data } = await supabase
      .from('usuarios')
      .select('id, nome, foto_url, tipo, cargo, bio, telefone, ramal, email, exibir_email, exibir_telefone, unidade_id, unidades(nome, cidade)')
      .eq('id', userId)
      .maybeSingle();

    if (data) {
      const unidade = Array.isArray(data.unidades) ? data.unidades[0] : data.unidades;
      setProfile({
        ...data,
        exibir_email: data.exibir_email ?? true,
        exibir_telefone: data.exibir_telefone ?? true,
        unidade: unidade || null,
      });
    }
    setLoading(false);
  };

  const getUserColor = (name: string) => {
    const colors = [
      'from-cyan-500 to-blue-600',
      'from-emerald-500 to-teal-600',
      'from-orange-500 to-red-600',
      'from-violet-500 to-purple-600',
      'from-rose-500 to-pink-600',
      'from-amber-500 to-yellow-600',
    ];
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return colors[Math.abs(hash) % colors.length];
  };

  const getRoleBadge = (tipo: string | null) => {
    switch (tipo) {
      case 'master': return { label: 'Master', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' };
      case 'administrador': return { label: 'Administrador', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' };
      case 'tecnico': return { label: 'Tecnico', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' };
      case 'tecnico_ih': return { label: 'Tecnico IH', color: 'bg-teal-500/20 text-teal-300 border-teal-500/30' };
      case 'vendedor': return { label: 'Vendedor', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' };
      default: return { label: tipo || 'Usuario', color: 'bg-gray-500/20 text-gray-300 border-gray-500/30' };
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-sm bg-[#0f1a22] border border-[#1a3a4a]/60 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={e => e.stopPropagation()}
      >
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="w-8 h-8 border-2 border-[#00D4FF]/30 border-t-[#00D4FF] rounded-full animate-spin" />
          </div>
        ) : profile ? (
          <>
            {/* Header gradient background */}
            <div className={`h-28 bg-gradient-to-br ${getUserColor(profile.nome)} opacity-80`} />

            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-3 right-3 p-1.5 rounded-full bg-black/40 text-white/80 hover:text-white hover:bg-black/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Profile content */}
            <div className="px-6 pb-6">
              {/* Avatar - overlapping the header */}
              <div className="-mt-14 mb-3">
                {profile.foto_url ? (
                  <img
                    src={profile.foto_url}
                    alt={profile.nome}
                    className="w-24 h-24 rounded-full border-4 border-[#0f1a22] object-cover shadow-xl"
                  />
                ) : (
                  <div className={`w-24 h-24 rounded-full border-4 border-[#0f1a22] bg-gradient-to-br ${getUserColor(profile.nome)} flex items-center justify-center shadow-xl`}>
                    <span className="text-3xl font-bold text-white">
                      {profile.nome.charAt(0).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>

              {/* Name and role badge */}
              <h2 className="text-xl font-bold text-white">{profile.nome}</h2>

              <div className="flex items-center gap-2 mt-1.5">
                {(() => {
                  const badge = getRoleBadge(profile.tipo);
                  return (
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${badge.color}`}>
                      {badge.label}
                    </span>
                  );
                })()}
                {profile.unidade?.nome && (
                  <span className="text-xs text-gray-400">
                    {profile.unidade.nome}{profile.unidade.cidade ? ` - ${profile.unidade.cidade}` : ''}
                  </span>
                )}
              </div>

              {/* Bio */}
              {profile.bio && (
                <p className="mt-3 text-sm text-gray-300 leading-relaxed">{profile.bio}</p>
              )}

              {/* Info fields */}
              <div className="mt-4 space-y-2.5">
                {profile.cargo && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-[#1a3a4a]/60 flex items-center justify-center flex-shrink-0">
                      <Briefcase className="w-4 h-4 text-[#00D4FF]" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Cargo</p>
                      <p className="text-gray-200">{profile.cargo}</p>
                    </div>
                  </div>
                )}

                {profile.ramal && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-[#1a3a4a]/60 flex items-center justify-center flex-shrink-0">
                      <Hash className="w-4 h-4 text-[#00D4FF]" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Ramal</p>
                      <p className="text-gray-200">{profile.ramal}</p>
                    </div>
                  </div>
                )}

                {profile.exibir_telefone && profile.telefone && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-[#1a3a4a]/60 flex items-center justify-center flex-shrink-0">
                      <Phone className="w-4 h-4 text-[#00D4FF]" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Telefone</p>
                      <p className="text-gray-200">{profile.telefone}</p>
                    </div>
                  </div>
                )}

                {profile.exibir_email && profile.email && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-[#1a3a4a]/60 flex items-center justify-center flex-shrink-0">
                      <Mail className="w-4 h-4 text-[#00D4FF]" />
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase tracking-wider">Email</p>
                      <p className="text-gray-200">{profile.email}</p>
                    </div>
                  </div>
                )}

                {!profile.cargo && !profile.ramal && !profile.telefone && !profile.email && !profile.bio && (
                  <div className="flex items-center gap-3 py-3 text-sm text-gray-500">
                    <User className="w-4 h-4" />
                    <span>Perfil ainda nao preenchido</span>
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-48 text-gray-500">
            Usuario nao encontrado
          </div>
        )}
      </div>
    </div>
  );
}
