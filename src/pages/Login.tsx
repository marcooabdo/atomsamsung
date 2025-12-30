import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Zap, Lock, Mail, AlertTriangle } from 'lucide-react';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await signIn(email, password);
    } catch (err: any) {
      setError(err.message || 'Erro ao fazer login');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen cyber-grid flex items-center justify-center p-4 relative overflow-hidden" style={{ background: 'var(--bg-primary)' }}>
      <div className="absolute inset-0 opacity-30" style={{ background: 'radial-gradient(circle at center, var(--border-accent), transparent, transparent)' }} />

      <div className="absolute top-1/4 left-1/4 w-96 h-96 rounded-full blur-3xl animate-pulse" style={{ background: 'var(--border-primary)' }} />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s', background: 'var(--border-primary)' }} />

      <div className="w-full max-w-md relative z-10 scale-in">
        <div className="glass-modal p-10">
          <div className="flex justify-center mb-8">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-[#00D4FF] to-[#1428F0] rounded-2xl blur-xl opacity-50 pulse-neon" />
              <div className="relative w-20 h-20 bg-gradient-to-br from-[#00D4FF] to-[#1428F0] rounded-2xl flex items-center justify-center border-2 border-[#00D4FF]/50">
                <Zap className="w-10 h-10 text-white" style={{ filter: 'drop-shadow(0 0 10px rgba(255, 255, 255, 0.8))' }} />
              </div>
            </div>
          </div>

          <h1 className="tech-heading text-4xl text-center mb-2 neon-text-blue" style={{ color: 'var(--text-accent)' }}>
            SAMSUNG
          </h1>
          <p className="text-center mb-8 text-sm tracking-widest uppercase font-medium" style={{ color: 'var(--text-secondary)' }}>
            Sistema Operacional Corporativo
          </p>

          <div className="neon-divider mb-8" />

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-xs font-semibold mb-3 uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text-accent)' }}>
                <Mail className="w-4 h-4" />
                E-mail Corporativo
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="neon-input"
                placeholder="usuario@samsung.com"
                required
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-xs font-semibold mb-3 uppercase tracking-widest flex items-center gap-2" style={{ color: 'var(--text-accent)' }}>
                <Lock className="w-4 h-4" />
                Senha de Acesso
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="neon-input"
                placeholder="••••••••••••"
                required
              />
            </div>

            {error && (
              <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-lg flex items-start gap-3 slide-in"
                style={{ boxShadow: '0 0 20px rgba(255, 0, 100, 0.2)' }}
              >
                <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-300 font-medium">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="neon-button w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-[#00D4FF]/30 border-t-[#00D4FF] rounded-full animate-spin" />
                  AUTENTICANDO
                </span>
              ) : (
                'ACESSAR SISTEMA'
              )}
            </button>
          </form>

          <div className="neon-divider mt-8" />

          <div className="flex items-center justify-center gap-2 mt-6">
            <div className="w-2 h-2 rounded-full bg-[#39FF14] pulse-neon" />
            <p className="text-xs uppercase tracking-widest font-medium" style={{ color: 'var(--text-secondary)' }}>
              Sistema Online
            </p>
          </div>
        </div>

        <p className="text-center text-xs mt-8 uppercase tracking-widest font-medium" style={{ color: 'var(--text-secondary)' }}>
          Acesso Restrito • Usuários Autorizados
        </p>

        <div className="mt-6 p-4 premium-card text-center">
          <p className="text-xs mb-2" style={{ color: 'var(--text-secondary)' }}>Credenciais Padrão:</p>
          <p className="text-xs font-mono" style={{ color: 'var(--text-accent)' }}>marcoabdo@groupglobal.com.br</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>Senha: Samsung@2024</p>
        </div>
      </div>
    </div>
  );
}
