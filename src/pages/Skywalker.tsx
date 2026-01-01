import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { VisaoDiretoria } from '../components/skywalker/VisaoDiretoria';
import { MinhaRota } from '../components/skywalker/MinhaRota';
import { Rocket, Users, User } from 'lucide-react';

export function Skywalker() {
  const { usuario } = useAuth();
  const canViewDiretoria = usuario?.tipo === 'master' || usuario?.tipo === 'gerente';
  const [activeView, setActiveView] = useState<'minha-rota' | 'diretoria'>(
    canViewDiretoria ? 'diretoria' : 'minha-rota'
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="relative">
            <Rocket className="w-10 h-10 text-cyan-400" />
            <div className="absolute -inset-2 bg-cyan-500/20 rounded-full blur-xl animate-pulse" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-300">
              SKYWALKER
            </h1>
            <p className="text-gray-400 text-sm">Sistema de Gamificacao de Carreira</p>
          </div>
        </div>

        {canViewDiretoria && (
          <div className="flex gap-2 p-1 bg-gray-800/50 rounded-xl border border-gray-700">
            <button
              onClick={() => setActiveView('minha-rota')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                activeView === 'minha-rota'
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/50'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <User className="w-4 h-4" />
              Minha Rota
            </button>
            <button
              onClick={() => setActiveView('diretoria')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm transition-all ${
                activeView === 'diretoria'
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/50'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              <Users className="w-4 h-4" />
              Visao Diretoria
            </button>
          </div>
        )}
      </div>

      {activeView === 'diretoria' && canViewDiretoria ? (
        <VisaoDiretoria />
      ) : (
        <MinhaRota />
      )}
    </div>
  );
}
