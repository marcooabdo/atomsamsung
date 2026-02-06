import { ReactNode, useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Calendar, Award, LogOut, MapPin } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { startTracking, stopTracking, isLocationSupported, requestLocationPermission, isTracking } from '../lib/geoTracker';
import { startAutoSync, stopAutoSync, getPendingCount, flushQueue, isOnline } from '../lib/offlineQueue';

interface MobileLayoutProps {
  children: ReactNode;
}

export function MobileLayout({ children }: MobileLayoutProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { usuario, signOut } = useAuth();
  const [locationDenied, setLocationDenied] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [pendingOps, setPendingOps] = useState(0);
  const [online, setOnline] = useState(navigator.onLine);

  const tabs = [
    { path: '/mobile/agenda', icon: Calendar, label: 'Agenda' },
    { path: '/mobile/desempenho', icon: Award, label: 'Desempenho' },
  ];

  useEffect(() => {
    if (!usuario) return;
    initTracking();
    startAutoSync();

    const checkPending = setInterval(async () => {
      setPendingOps(await getPendingCount());
      setOnline(navigator.onLine);
    }, 5000);

    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      stopTracking();
      stopAutoSync();
      clearInterval(checkPending);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [usuario]);

  const initTracking = async () => {
    if (!isLocationSupported()) {
      setLocationDenied(true);
      return;
    }
    setRequesting(true);
    const granted = await requestLocationPermission();
    setRequesting(false);
    if (granted) {
      startTracking(usuario!.id);
      setLocationDenied(false);
    } else {
      setLocationDenied(true);
    }
  };

  const handleSync = async () => {
    if (!isOnline()) return;
    const result = await flushQueue();
    setPendingOps(await getPendingCount());
    return result;
  };

  const handleSignOut = async () => {
    stopTracking();
    stopAutoSync();
    if (isOnline()) await flushQueue();
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {!online && (
        <div className="bg-amber-500/20 border-b border-amber-500/30 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span className="text-amber-300 text-xs font-medium">Offline</span>
            {pendingOps > 0 && (
              <span className="text-amber-400/70 text-xs">{pendingOps} pendente{pendingOps > 1 ? 's' : ''}</span>
            )}
          </div>
        </div>
      )}

      {online && pendingOps > 0 && (
        <div className="bg-blue-500/20 border-b border-blue-500/30 px-4 py-2 flex items-center justify-between">
          <span className="text-blue-300 text-xs font-medium">Sincronizando {pendingOps} operacao{pendingOps > 1 ? 'es' : ''}...</span>
          <button onClick={handleSync} className="text-blue-400 text-xs font-medium underline">Sincronizar agora</button>
        </div>
      )}

      {locationDenied && (
        <div className="bg-red-500/20 border-b border-red-500/30 px-4 py-3 flex items-center gap-3">
          <MapPin className="w-5 h-5 text-red-400 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-red-400 text-sm font-medium">Localizacao obrigatoria</p>
            <p className="text-red-400/70 text-xs">Ative o GPS para continuar usando o sistema</p>
          </div>
          <button
            onClick={initTracking}
            disabled={requesting}
            className="px-3 py-1.5 bg-red-500/30 border border-red-500/50 rounded-lg text-red-300 text-xs font-medium"
          >
            {requesting ? 'Ativando...' : 'Ativar'}
          </button>
        </div>
      )}

      <header className="bg-gray-900 border-b border-gray-800 px-4 py-3 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
            <span className="text-white font-bold text-sm">
              {usuario?.nome?.split(' ').map((n: string) => n[0]).join('').slice(0, 2)}
            </span>
          </div>
          <div>
            <p className="text-white font-medium text-sm">{usuario?.nome}</p>
            <div className="flex items-center gap-1.5">
              <p className="text-gray-400 text-xs">{usuario?.tipo === 'tecnico_ih' ? 'Tecnico IH' : 'Tecnico'}</p>
              {isTracking() && (
                <span className="flex items-center gap-1 text-green-400 text-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                  GPS
                </span>
              )}
            </div>
          </div>
        </div>
        <button onClick={handleSignOut} className="p-2 text-gray-400 hover:text-red-400 transition-colors">
          <LogOut className="w-5 h-5" />
        </button>
      </header>

      <main className="flex-1 overflow-y-auto pb-20">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-800 px-4 py-3 safe-area-bottom">
        <div className="flex items-center justify-around max-w-md mx-auto">
          {tabs.map(tab => {
            const isActive = location.pathname === tab.path;
            const Icon = tab.icon;
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className={`flex flex-col items-center gap-1 px-6 py-2 rounded-lg transition-all ${
                  isActive ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-white'
                }`}
              >
                <Icon className="w-6 h-6" />
                <span className="text-xs font-medium">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
