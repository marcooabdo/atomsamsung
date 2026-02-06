import { ReactNode, useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme, THEMES } from '../contexts/ThemeContext';
import { supabase } from '../lib/supabase';
import { ProfilePhotoUpload } from './ProfilePhotoUpload';
import { ProfileModal } from './ProfileModal';
import {
  LayoutDashboard,
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
  Rocket,
  FileText,
  ChevronRight,
  Palette
} from 'lucide-react';

interface LayoutProps {
  children: ReactNode;
}

const allMenuItems = [
  { id: 'dashboard', label: 'Central ATOM', icon: LayoutDashboard, path: '/' },
  { id: 'kanban', label: 'Pipeline Operacional', icon: Layers, path: '/kanban' },
  { id: 'estoque', label: 'Nucleo de Pecas', icon: Package, path: '/estoque' },
  { id: 'otimizador', label: 'Centro de Comando', icon: Zap, path: '/otimizador' },
  { id: 'chat', label: 'QG de Comunicacao', icon: MessageSquare, path: '/chat' },
  { id: 'financeiro', label: 'ATOM Finance', icon: DollarSign, path: '/financeiro' },
  { id: 'notas-fiscais', label: 'Notas Fiscais', icon: FileText, path: '/notas-fiscais' },
  { id: 'ofs', label: 'OFS Gateway', icon: ClipboardList, path: '/ofs' },
  { id: 'skywalker', label: 'Skywalker', icon: Rocket, path: '/skywalker' },
  { id: 'configuracoes', label: 'ATOM Core Settings', icon: Settings, path: '/configuracoes', onlyFor: ['master', 'diretoria', 'gerente'] },
];

export function Layout({ children }: LayoutProps) {
  const { usuario, signOut, updateUsuario } = useAuth();
  const { themeInfo } = useTheme();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [unreadConversations, setUnreadConversations] = useState(0);
  const [profileOpen, setProfileOpen] = useState(false);

  const menuItems = allMenuItems.filter(item => {
    if (!item.onlyFor) return true;
    return usuario && item.onlyFor.includes(usuario.tipo);
  });

  useEffect(() => {
    if (!usuario?.id) return;

    const fetchUnreadConversations = async () => {
      try {
        const { data, error } = await supabase.rpc('get_unread_conversations_count', {
          p_user_id: usuario.id
        });
        if (error) {
          setUnreadConversations(0);
          return;
        }
        setUnreadConversations(typeof data === 'number' ? data : 0);
      } catch {
        setUnreadConversations(0);
      }
    };

    fetchUnreadConversations();

    const handleMessagesRead = () => fetchUnreadConversations();
    window.addEventListener('chat:messages-read', handleMessagesRead);

    const channelName = `layout-unread-${usuario.id}-${Date.now()}`;
    const channel = supabase.channel(channelName);

    channel
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        (payload) => {
          if (payload.new && payload.new.sender_id !== usuario.id) fetchUnreadConversations();
        }
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'chat_message_reads' },
        (payload) => {
          if (payload.new && payload.new.user_id === usuario.id) fetchUnreadConversations();
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'chat_participants' },
        (payload) => {
          if (payload.new && payload.new.user_id === usuario.id) fetchUnreadConversations();
        }
      )
      .subscribe();

    return () => {
      window.removeEventListener('chat:messages-read', handleMessagesRead);
      supabase.removeChannel(channel);
    };
  }, [usuario?.id]);

  const handleSignOut = async () => {
    try { await signOut(); } catch {}
  };

  return (
    <div className="min-h-screen cyber-grid" style={{ background: 'var(--bg-primary)' }}>
      <aside
        className={`fixed top-0 left-0 h-full border-r transition-all duration-300 z-30 flex flex-col ${
          sidebarOpen ? 'w-72' : 'w-20'
        }`}
        style={{
          background: 'var(--bg-sidebar)',
          borderColor: 'var(--border-primary)',
          backdropFilter: 'blur(20px)',
        }}
      >
        <div className="flex items-center justify-between p-5 border-b flex-shrink-0" style={{ borderColor: 'var(--border-primary)' }}>
          {sidebarOpen && (
            <div className="flex items-center gap-3 slide-in">
              <img
                src={themeInfo.isDark ? '/logo.png' : '/1_-_logo_transparente_preto_2.png'}
                alt="Logo"
                className="h-10 w-auto"
                style={{ filter: themeInfo.isDark ? `drop-shadow(0 0 4px rgba(var(--accent-rgb), 0.25))` : 'none' }}
              />
            </div>
          )}
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg transition-all duration-200 hover:scale-105"
            style={{ color: 'var(--text-accent)' }}
          >
            {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto cyber-scrollbar p-3 space-y-1 mt-2">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <Link
                key={item.id}
                to={item.path}
                className="group relative w-full flex items-center gap-3.5 px-4 py-3 rounded-xl transition-all duration-200"
                style={{
                  animationDelay: `${index * 40}ms`,
                  background: isActive ? `rgba(var(--accent-rgb), 0.1)` : 'transparent',
                  color: isActive ? 'var(--text-accent)' : 'var(--text-secondary)',
                  border: isActive ? '1px solid var(--border-primary)' : '1px solid transparent',
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
                  <Icon className="w-5 h-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" />
                  {item.id === 'chat' && unreadConversations > 0 && (
                    <div
                      className="absolute -top-1.5 -right-1.5 min-w-[16px] h-[16px] rounded-full flex items-center justify-center text-[9px] font-bold"
                      style={{
                        background: 'var(--text-accent)',
                        color: 'var(--text-on-accent)',
                        boxShadow: `0 0 8px rgba(var(--accent-rgb), 0.5)`,
                        padding: '0 3px'
                      }}
                    >
                      {unreadConversations > 99 ? '99+' : unreadConversations}
                    </div>
                  )}
                </div>
                {sidebarOpen && (
                  <span className={`text-sm tracking-wide transition-all duration-200 ${isActive ? 'font-semibold' : 'font-medium'}`}>
                    {item.label}
                  </span>
                )}
                {isActive && (
                  <div
                    className="absolute right-0 top-1/2 -translate-y-1/2 w-[3px] h-7 rounded-l-full"
                    style={{
                      background: 'var(--text-accent)',
                      boxShadow: `0 0 8px rgba(var(--accent-rgb), 0.6)`
                    }}
                  />
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex-shrink-0 p-4 border-t" style={{ borderColor: 'var(--border-primary)' }}>
          {usuario && (
            <>
              {sidebarOpen ? (
                <div
                  className="mb-3 p-3 rounded-xl cursor-pointer transition-all duration-200 group"
                  style={{
                    background: `rgba(var(--accent-rgb), 0.04)`,
                    border: '1px solid var(--border-primary)',
                  }}
                  onClick={() => setProfileOpen(true)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = `rgba(var(--accent-rgb), 0.3)`;
                    e.currentTarget.style.background = `rgba(var(--accent-rgb), 0.08)`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-primary)';
                    e.currentTarget.style.background = `rgba(var(--accent-rgb), 0.04)`;
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div
                        className="rounded-full p-[2px]"
                        style={{
                          background: `linear-gradient(135deg, ${themeInfo.accent}, transparent)`,
                        }}
                      >
                        <ProfilePhotoUpload
                          userId={usuario.id}
                          currentPhotoUrl={usuario.foto_url || undefined}
                          userName={usuario.nome}
                          onPhotoUpdated={(url) => {
                            if (updateUsuario) updateUsuario({ ...usuario, foto_url: url });
                          }}
                          size="medium"
                          editable={false}
                        />
                      </div>
                      <div
                        className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2"
                        style={{
                          background: '#10b981',
                          borderColor: 'var(--bg-primary)',
                          boxShadow: '0 0 6px rgba(16, 185, 129, 0.5)',
                        }}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {usuario.nome}
                      </p>
                      <p className="text-[10px] uppercase tracking-widest mt-0.5 font-medium" style={{ color: 'var(--text-accent)' }}>
                        {usuario.tipo}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 flex-shrink-0 opacity-40 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--text-accent)' }} />
                  </div>
                </div>
              ) : (
                <div className="mb-3 flex justify-center">
                  <button onClick={() => setProfileOpen(true)} className="relative">
                    <ProfilePhotoUpload
                      userId={usuario.id}
                      currentPhotoUrl={usuario.foto_url || undefined}
                      userName={usuario.nome}
                      onPhotoUpdated={(url) => {
                        if (updateUsuario) updateUsuario({ ...usuario, foto_url: url });
                      }}
                      size="small"
                      editable={false}
                    />
                    <div
                      className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                      style={{ background: '#10b981', borderColor: 'var(--bg-primary)' }}
                    />
                  </button>
                </div>
              )}
            </>
          )}

          <button
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition-all duration-200 text-red-400 hover:text-red-300"
            title={!sidebarOpen ? 'Sair' : ''}
            style={{
              background: 'rgba(239, 68, 68, 0.06)',
              border: '1px solid rgba(239, 68, 68, 0.15)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.12)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.3)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.06)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.15)';
            }}
          >
            <LogOut className="w-4 h-4 flex-shrink-0" />
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

      <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}
