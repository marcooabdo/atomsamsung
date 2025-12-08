import { ReactNode, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  LayoutDashboard,
  FileText,
  Layers,
  Package,
  MessageSquare,
  DollarSign,
  Settings,
  LogOut,
  Menu,
  X,
  ClipboardList,
  Zap
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

const menuItems = [
  { id: 'dashboard', label: 'Central ATOM', icon: LayoutDashboard, path: '/' },
  { id: 'cotacoes', label: 'Nexus de Cotações', icon: FileText, path: '/cotacoes' },
  { id: 'kanban', label: 'Pipeline Operacional', icon: Layers, path: '/kanban' },
  { id: 'estoque', label: 'Núcleo de Peças', icon: Package, path: '/estoque' },
  { id: 'otimizador', label: 'Centro de Comando', icon: Zap, path: '/otimizador' },
  { id: 'chat', label: 'QG de Comunicação', icon: MessageSquare, path: '/chat' },
  { id: 'financeiro', label: 'ATOM Finance', icon: DollarSign, path: '/financeiro' },
  { id: 'ofs', label: 'OFS Gateway', icon: ClipboardList, path: '/ofs' },
  { id: 'configuracoes', label: 'ATOM Core Settings', icon: Settings, path: '/configuracoes' },
];

export function Layout({ children }: LayoutProps) {
  const { usuario, signOut } = useAuth();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Erro ao sair:', error);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0A0D] cyber-grid">
      <aside
        className={`fixed top-0 left-0 h-full bg-gradient-to-b from-black to-[#0A0A0D] border-r border-[#00D4FF]/15 transition-all duration-300 z-30 backdrop-blur-xl flex flex-col ${
          sidebarOpen ? 'w-72' : 'w-20'
        }`}
        style={{
          boxShadow: '0 0 20px rgba(0, 212, 255, 0.05), inset 0 0 20px rgba(0, 212, 255, 0.02)'
        }}
      >
        <div className="flex items-center justify-between p-6 border-b border-[#00D4FF]/15 flex-shrink-0">
          {sidebarOpen && (
            <div className="flex items-center gap-3 slide-in">
              <img
                src="/logo.png"
                alt="Logo"
                className="h-10 w-auto"
                style={{ filter: 'drop-shadow(0 0 3px rgba(0, 212, 255, 0.2))' }}
              />
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 hover:bg-[#00D4FF]/5 rounded-lg transition-all duration-300"
          >
            {sidebarOpen ? (
              <X className="w-5 h-5 text-[#00D4FF]" />
            ) : (
              <Menu className="w-5 h-5 text-[#00D4FF]" />
            )}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto cyber-scrollbar p-4 space-y-2 mt-4">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.id}
                to={item.path}
                className={`group relative w-full flex items-center gap-4 px-5 py-4 rounded-lg transition-all duration-300 ${
                  isActive
                    ? 'bg-[#00D4FF]/10 text-[#00D4FF] border border-[#00D4FF]/20'
                    : 'hover:bg-[#00D4FF]/5 text-gray-400 hover:text-[#00D4FF] border border-transparent'
                }`}
                style={{
                  animationDelay: `${index * 50}ms`
                }}
                title={!sidebarOpen ? item.label : ''}
              >
                <Icon
                  className={`w-5 h-5 flex-shrink-0 transition-all duration-300 ${
                    isActive ? 'scale-105' : 'group-hover:scale-105'
                  }`}
                />
                {sidebarOpen && (
                  <span className={`font-medium text-sm tracking-wider transition-all duration-300 ${
                    isActive ? 'font-semibold' : ''
                  }`}>
                    {item.label}
                  </span>
                )}
                {isActive && (
                  <div
                    className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-gradient-to-b from-transparent via-[#00D4FF] to-transparent"
                    style={{ boxShadow: '0 0 4px rgba(0, 212, 255, 0.4)' }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex-shrink-0 p-5 border-t border-[#00D4FF]/15 bg-gradient-to-t from-black/60 to-transparent">
          {sidebarOpen && usuario && (
            <div className="mb-3 p-3 premium-card slide-in">
              <p className="text-xs font-semibold text-[#00D4FF] truncate tracking-wide break-words">{usuario.nome}</p>
              <p className="text-[10px] text-gray-400 uppercase tracking-wider mt-1 font-medium">{usuario.tipo}</p>
              {usuario.unidade_id && (
                <div className="flex items-center gap-1 mt-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#10b981]" style={{ boxShadow: '0 0 4px rgba(16, 185, 129, 0.4)' }} />
                  <p className="text-[10px] text-[#10b981]">ONLINE</p>
                </div>
              )}
            </div>
          )}

          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-black/60 border border-red-500/25 hover:border-red-500/50 hover:bg-red-500/10 transition-all duration-300 text-red-400 hover:text-red-300 group"
            title={!sidebarOpen ? 'Sair' : ''}
            style={{
              boxShadow: '0 0 8px rgba(255, 0, 100, 0.1)'
            }}
          >
            <LogOut className="w-4 h-4 flex-shrink-0 group-hover:scale-105 transition-transform" />
            {sidebarOpen && <span className="font-medium text-xs tracking-wider">SAIR</span>}
          </button>
        </div>
      </aside>

      <main
        className={`transition-all duration-300 min-h-screen ${
          sidebarOpen ? 'ml-72' : 'ml-20'
        }`}
      >
        <div className="p-6 fade-in">
          {children}
        </div>
      </main>
    </div>
  );
}
