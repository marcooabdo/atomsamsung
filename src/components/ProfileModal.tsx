import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, THEMES, ThemeVariant } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { ProfilePhotoUpload } from './ProfilePhotoUpload';
import {
  X, Lock, Eye, EyeOff, Save, Palette, Phone,
  Hash, Briefcase, FileText, Check, AlertCircle
} from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { usuario, user, updateUsuario } = useAuth();
  const { theme, setTheme } = useTheme();

  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'theme'>('profile');

  const [telefone, setTelefone] = useState(usuario?.telefone || '');
  const [ramal, setRamal] = useState(usuario?.ramal || '');
  const [cargo, setCargo] = useState(usuario?.cargo || '');
  const [bio, setBio] = useState(usuario?.bio || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileMsg, setProfileMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [pwMsg, setPwMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  if (!isOpen || !usuario) return null;

  const saveProfileFields = async () => {
    setSavingProfile(true);
    setProfileMsg(null);
    try {
      const { error } = await supabase
        .from('usuarios')
        .update({
          telefone: telefone.trim() || null,
          ramal: ramal.trim() || null,
          cargo: cargo.trim() || null,
          bio: bio.trim() || null,
          updated_at: new Date().toISOString()
        })
        .eq('id', usuario.id);

      if (error) throw error;

      if (updateUsuario) {
        updateUsuario({
          ...usuario,
          telefone: telefone.trim() || null,
          ramal: ramal.trim() || null,
          cargo: cargo.trim() || null,
          bio: bio.trim() || null,
        });
      }
      setProfileMsg({ type: 'success', text: 'Perfil atualizado!' });
    } catch (err: any) {
      setProfileMsg({ type: 'error', text: err.message || 'Erro ao salvar' });
    } finally {
      setSavingProfile(false);
    }
  };

  const changePassword = async () => {
    setPwMsg(null);
    if (!currentPassword) { setPwMsg({ type: 'error', text: 'Informe a senha atual' }); return; }
    if (newPassword.length < 6) { setPwMsg({ type: 'error', text: 'Minimo 6 caracteres' }); return; }
    if (newPassword !== confirmPassword) { setPwMsg({ type: 'error', text: 'Senhas nao conferem' }); return; }

    setChangingPw(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: user?.email || usuario.email,
        password: currentPassword,
      });
      if (signInError) throw new Error('Senha atual incorreta');

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      setPwMsg({ type: 'success', text: 'Senha alterada com sucesso!' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwMsg({ type: 'error', text: err.message || 'Erro ao alterar senha' });
    } finally {
      setChangingPw(false);
    }
  };

  const tabs = [
    { id: 'profile' as const, label: 'Perfil', icon: FileText },
    { id: 'password' as const, label: 'Senha', icon: Lock },
    { id: 'theme' as const, label: 'Tema', icon: Palette },
  ];

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg glass-modal overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--border-primary)' }}>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-accent)' }}>Meu Perfil</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>

        <div className="flex items-center gap-4 p-5 border-b" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-hover)' }}>
          <ProfilePhotoUpload
            userId={usuario.id}
            currentPhotoUrl={usuario.foto_url || undefined}
            userName={usuario.nome}
            onPhotoUpdated={(url) => {
              if (updateUsuario) updateUsuario({ ...usuario, foto_url: url });
            }}
            size="large"
            editable={true}
          />
          <div>
            <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>{usuario.nome}</p>
            <p className="text-sm uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>{usuario.tipo}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>{usuario.email}</p>
          </div>
        </div>

        <div className="flex border-b" style={{ borderColor: 'var(--border-primary)' }}>
          {tabs.map(tab => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className="flex-1 flex items-center justify-center gap-2 py-3 text-sm font-medium transition-all border-b-2"
                style={{
                  borderColor: active ? 'var(--text-accent)' : 'transparent',
                  color: active ? 'var(--text-accent)' : 'var(--text-secondary)',
                  background: active ? 'var(--bg-hover)' : 'transparent',
                }}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-5 max-h-[50vh] overflow-y-auto">
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                  <Phone className="w-3.5 h-3.5" /> Telefone
                </label>
                <input
                  type="text"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value)}
                  className="neon-input text-sm"
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                  <Hash className="w-3.5 h-3.5" /> Ramal
                </label>
                <input
                  type="text"
                  value={ramal}
                  onChange={(e) => setRamal(e.target.value)}
                  className="neon-input text-sm"
                  placeholder="Ex: 2001"
                />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                  <Briefcase className="w-3.5 h-3.5" /> Cargo
                </label>
                <input
                  type="text"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  className="neon-input text-sm"
                  placeholder="Ex: Tecnico Senior"
                />
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wider mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                  <FileText className="w-3.5 h-3.5" /> Bio
                </label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="neon-input text-sm resize-none"
                  rows={3}
                  placeholder="Uma breve descricao sobre voce..."
                  maxLength={200}
                />
                <p className="text-right text-[10px] mt-1" style={{ color: 'var(--text-secondary)' }}>{bio.length}/200</p>
              </div>

              {profileMsg && (
                <div className={`flex items-center gap-2 text-sm p-3 rounded-lg ${profileMsg.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                  {profileMsg.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {profileMsg.text}
                </div>
              )}

              <button
                onClick={saveProfileFields}
                disabled={savingProfile}
                className="w-full py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                style={{ background: 'var(--text-accent)', color: 'var(--text-on-accent)' }}
              >
                <Save className="w-4 h-4" />
                {savingProfile ? 'Salvando...' : 'Salvar Perfil'}
              </button>
            </div>
          )}

          {activeTab === 'password' && (
            <div className="space-y-4">
              <div>
                <label className="text-xs font-medium uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                  Senha Atual
                </label>
                <div className="relative">
                  <input
                    type={showCurrentPw ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    className="neon-input text-sm pr-10"
                    placeholder="Sua senha atual"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPw(!showCurrentPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                  Nova Senha
                </label>
                <div className="relative">
                  <input
                    type={showNewPw ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="neon-input text-sm pr-10"
                    placeholder="Minimo 6 caracteres"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPw(!showNewPw)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium uppercase tracking-wider mb-1.5 block" style={{ color: 'var(--text-secondary)' }}>
                  Confirmar Nova Senha
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="neon-input text-sm"
                  placeholder="Repita a nova senha"
                />
              </div>

              {pwMsg && (
                <div className={`flex items-center gap-2 text-sm p-3 rounded-lg ${pwMsg.type === 'success' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                  {pwMsg.type === 'success' ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                  {pwMsg.text}
                </div>
              )}

              <button
                onClick={changePassword}
                disabled={changingPw}
                className="w-full py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                style={{ background: 'var(--text-accent)', color: 'var(--text-on-accent)' }}
              >
                <Lock className="w-4 h-4" />
                {changingPw ? 'Alterando...' : 'Alterar Senha'}
              </button>
            </div>
          )}

          {activeTab === 'theme' && (
            <div className="space-y-3">
              <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
                Escolha o tema visual da interface
              </p>
              <div className="space-y-3">
                {THEMES.map((t, idx) => {
                  const active = theme === t.id;
                  const isFirst = idx === 0;
                  return (
                    <button
                      key={t.id}
                      onClick={() => setTheme(t.id as ThemeVariant)}
                      className={`relative rounded-xl border-2 transition-all duration-300 text-left group ${isFirst ? 'w-full p-3 flex items-center gap-4' : 'inline-block w-[calc(50%-6px)] p-3 align-top'} ${idx === 1 || idx === 3 ? 'mr-3' : ''}`}
                      style={{
                        background: t.bg,
                        borderColor: active ? t.accent : t.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                        boxShadow: active ? `0 0 20px ${t.accent}30, 0 0 40px ${t.accent}15` : 'none',
                      }}
                    >
                      {active && (
                        <div
                          className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center"
                          style={{ background: t.accent }}
                        >
                          <Check className="w-3 h-3" style={{ color: t.isDark ? '#000' : '#fff' }} />
                        </div>
                      )}
                      {isFirst ? (
                        <>
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 rounded-full" style={{ background: t.accent, boxShadow: `0 0 8px ${t.accent}60` }} />
                            <div className="w-5 h-5 rounded-full" style={{ background: 'rgba(255,255,255,0.1)' }} />
                          </div>
                          <div className="flex-1">
                            <div className="flex gap-1.5 mb-1.5">
                              <div className="flex-1 h-1.5 rounded-full" style={{ background: t.accent, opacity: 0.8 }} />
                              <div className="w-4 h-1.5 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
                            </div>
                            <div className="h-1 rounded-full w-3/4" style={{ background: 'rgba(255,255,255,0.2)' }} />
                          </div>
                          <p className="text-xs font-semibold tracking-wide" style={{ color: '#ccc' }}>{t.label}</p>
                        </>
                      ) : (
                        <>
                          <div className="flex items-center gap-2 mb-2">
                            <div className="w-4 h-4 rounded-full" style={{ background: t.accent, boxShadow: `0 0 8px ${t.accent}60` }} />
                            <div className="w-4 h-4 rounded-full" style={{ background: t.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)' }} />
                          </div>
                          <div className="flex gap-1.5 mb-2">
                            <div className="flex-1 h-1.5 rounded-full" style={{ background: t.accent, opacity: 0.8 }} />
                            <div className="w-4 h-1.5 rounded-full" style={{ background: t.isDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.08)' }} />
                          </div>
                          <div className="space-y-1">
                            <div className="h-1 rounded-full w-3/4" style={{ background: t.isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.12)' }} />
                            <div className="h-1 rounded-full w-1/2" style={{ background: t.isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)' }} />
                          </div>
                          <p className="text-xs font-semibold mt-2 tracking-wide" style={{ color: t.isDark ? '#ccc' : '#444' }}>{t.label}</p>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
