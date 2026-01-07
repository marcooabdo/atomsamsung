import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
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
  Zap,
  Sun,
  Moon,
  Rocket
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

const allMenuItems = [
  { id: 'dashboard', label: 'Central ATOM', icon: LayoutDashboard, path: '/' },
  { id: 'cotacoes', label: 'Nexus de Cotações', icon: FileText, path: '/cotacoes' },
  { id: 'kanban', label: 'Pipeline Operacional', icon: Layers, path: '/kanban' },
  { id: 'estoque', label: 'Núcleo de Peças', icon: Package, path: '/estoque' },
  { id: 'otimizador', label: 'Centro de Comando', icon: Zap, path: '/otimizador' },
  { id: 'chat', label: 'QG de Comunicação', icon: MessageSquare, path: '/chat' },
  { id: 'financeiro', label: 'ATOM Finance', icon: DollarSign, path: '/financeiro' },
  { id: 'ofs', label: 'OFS Gateway', icon: ClipboardList, path: '/ofs' },
  { id: 'skywalker', label: 'Skywalker', icon: Rocket, path: '/skywalker' },
  { id: 'configuracoes', label: 'ATOM Core Settings', icon: Settings, path: '/configuracoes', onlyFor: ['master', 'diretoria', 'gerente'] },
];

export function Layout({ children }: LayoutProps) {
  const { usuario, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [unreadConversations, setUnreadConversations] = useState(0);

  const menuItems = allMenuItems.filter(item => {
    if (!item.onlyFor) return true;
    return usuario && item.onlyFor.includes(usuario.tipo);
  });

  useEffect(() => {
    if (!usuario?.id) return;

    const fetchUnreadConversations = async () => {
      const { data: participantData } = await supabase
        .from('chat_participants')
        .select('conversation_id, last_read_at')
        .eq('usuario_id', usuario.id);

      if (!participantData || participantData.length === 0) {
        setUnreadConversations(0);
        return;
      }

      const conversationIds = participantData.map(p => p.conversation_id);

      const { data: messages } = await supabase
        .from('chat_messages')
        .select('conversation_id, created_at')
        .in('conversation_id', conversationIds)
        .neq('usuario_id', usuario.id)
        .order('created_at', { ascending: false });

      if (!messages) {
        setUnreadConversations(0);
        return;
      }

      const conversationsWithUnread = new Set();

      messages.forEach(msg => {
        const participant = participantData.find(p => p.conversation_id === msg.conversation_id);
        if (participant) {
          const lastRead = participant.last_read_at ? new Date(participant.last_read_at) : null;
          const messageDate = new Date(msg.created_at);

          if (!lastRead || messageDate > lastRead) {
            conversationsWithUnread.add(msg.conversation_id);
          }
        }
      });

      setUnreadConversations(conversationsWithUnread.size);
    };

    fetchUnreadConversations();

    const messagesSubscription = supabase
      .channel('layout-messages')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'chat_messages' },
        () => fetchUnreadConversations()
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'chat_participants' },
        () => fetchUnreadConversations()
      )
      .subscribe();

    return () => {
      messagesSubscription.unsubscribe();
    };
  }, [usuario?.id]);

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
    }
  };

  return (
    <div className="min-h-screen cyber-grid" style={{ background: 'var(--bg-primary)' }}>
      <aside
        className={`fixed top-0 left-0 h-full border-r transition-all duration-300 z-30 backdrop-blur-xl flex flex-col ${
          sidebarOpen ? 'w-72' : 'w-20'
        }`}
        style={{
          background: 'linear-gradient(180deg, var(--bg-secondary), var(--bg-primary))',
          borderColor: 'var(--border-primary)',
          boxShadow: '0 0 20px var(--border-primary), inset 0 0 20px var(--border-primary)'
        }}
      >
        <div className="flex items-center justify-between p-6 border-b flex-shrink-0" style={{ borderColor: 'var(--border-primary)' }}>
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
            className="p-2 rounded-lg transition-all duration-300"
            style={{ background: 'var(--bg-hover)' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-hover)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
          >
            {sidebarOpen ? (
              <X className="w-5 h-5" style={{ color: 'var(--text-accent)' }} />
            ) : (
              <Menu className="w-5 h-5" style={{ color: 'var(--text-accent)' }} />
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
                className={`group relative w-full flex items-center gap-4 px-5 py-4 rounded-lg transition-all duration-300 border`}
                style={{
                  animationDelay: `${index * 50}ms`,
                  background: isActive ? 'var(--bg-hover)' : 'transparent',
                  color: isActive ? 'var(--text-accent)' : 'var(--text-secondary)',
                  borderColor: isActive ? 'var(--border-primary)' : 'transparent'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'var(--bg-hover)';
                    e.currentTarget.style.color = 'var(--text-accent)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
                title={!sidebarOpen ? item.label : ''}
              >
                <div className="relative">
                  <Icon
                    className={`w-5 h-5 flex-shrink-0 transition-all duration-300 ${
                      isActive ? 'scale-105' : 'group-hover:scale-105'
                    }`}
                  />
                  {item.id === 'chat' && unreadConversations > 0 && (
                    <div
                      className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full flex items-center justify-center text-[10px] font-bold text-white animate-pulse"
                      style={{
                        background: 'linear-gradient(135deg, #ff0055, #ff4081)',
                        boxShadow: '0 0 10px rgba(255, 0, 85, 0.8), 0 0 20px rgba(255, 0, 85, 0.4)',
                        border: '1.5px solid rgba(255, 255, 255, 0.3)',
                        padding: '0 4px'
                      }}
                    >
                      {unreadConversations > 99 ? '99+' : unreadConversations}
                    </div>
                  )}
                </div>
                {sidebarOpen && (
                  <span className={`font-medium text-sm tracking-wider transition-all duration-300 ${
                    isActive ? 'font-semibold' : ''
                  }`}>
                    {item.label}
                  </span>
                )}
                {isActive && (
                  <div
                    className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-8"
                    style={{
                      background: 'linear-gradient(180deg, transparent, var(--text-accent), transparent)',
                      boxShadow: '0 0 4px var(--border-accent)'
                    }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex-shrink-0 p-5 border-t" style={{ borderColor: 'var(--border-primary)', background: 'linear-gradient(180deg, transparent, var(--bg-secondary))' }}>
          {sidebarOpen && usuario && (
            <div className="mb-3 p-3 premium-card slide-in">
              <p className="text-xs font-semibold truncate tracking-wide break-words" style={{ color: 'var(--text-accent)' }}>{usuario.nome}</p>
              <p className="text-[10px] uppercase tracking-wider mt-1 font-medium" style={{ color: 'var(--text-secondary)' }}>{usuario.tipo}</p>
              {usuario.unidade_id && (
                <div className="flex items-center gap-1 mt-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[#10b981]" style={{ boxShadow: '0 0 4px rgba(16, 185, 129, 0.4)' }} />
                  <p className="text-[10px] text-[#10b981]">ONLINE</p>
                </div>
              )}
            </div>
          )}

          <div className={`flex gap-2 ${sidebarOpen ? 'flex-row' : 'flex-col'}`}>
            <button
              onClick={toggleTheme}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all duration-300 group"
              title={!sidebarOpen ? (theme === 'dark' ? 'Modo Claro' : 'Modo Escuro') : ''}
              style={{
                background: 'var(--bg-secondary)',
                borderColor: 'var(--border-primary)',
                color: 'var(--text-accent)',
                boxShadow: '0 0 8px var(--border-primary)',
                flex: sidebarOpen ? 1 : 'none'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-accent)';
                e.currentTarget.style.background = 'var(--bg-hover)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border-primary)';
                e.currentTarget.style.background = 'var(--bg-secondary)';
              }}
            >
              {theme === 'dark' ? (
                <Sun className="w-4 h-4 flex-shrink-0 group-hover:scale-105 transition-transform" />
              ) : (
                <Moon className="w-4 h-4 flex-shrink-0 group-hover:scale-105 transition-transform" />
              )}
              {sidebarOpen && <span className="font-medium text-xs tracking-wider">{theme === 'dark' ? 'CLARO' : 'ESCURO'}</span>}
            </button>

            <button
              onClick={handleSignOut}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border border-red-500/25 hover:border-red-500/50 hover:bg-red-500/10 transition-all duration-300 text-red-400 hover:text-red-300 group"
              title={!sidebarOpen ? 'Sair' : ''}
              style={{
                background: 'var(--bg-secondary)',
                boxShadow: '0 0 8px rgba(255, 0, 100, 0.1)',
                flex: sidebarOpen ? 1 : 'none'
              }}
            >
              <LogOut className="w-4 h-4 flex-shrink-0 group-hover:scale-105 transition-transform" />
              {sidebarOpen && <span className="font-medium text-xs tracking-wider">SAIR</span>}
            </button>
          </div>
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
