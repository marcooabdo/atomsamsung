import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import {
  Shield,
  Users,
  Check,
  X,
  Loader2,
  ChevronDown,
  ChevronRight,
  LayoutDashboard,
  Kanban,
  Calendar,
  Route,
  Package,
  DollarSign,
  Receipt,
  FileText,
  Brain,
  Rocket,
  MessageCircle,
  ShoppingCart,
  MessageSquare,
  Settings,
  Filter,
  AlertTriangle
} from 'lucide-react';

interface Permission {
  recurso: string;
  tipo_recurso: string;
  habilitado: boolean;
  descricao: string;
}

interface PerfilPermissions {
  [recurso: string]: boolean;
}

const PERFIS = [
  { id: 'master', label: 'Master', color: '#FF0064', desc: 'Acesso total ao sistema' },
  { id: 'diretoria', label: 'Diretoria', color: '#00D4FF', desc: 'Acesso a todas unidades' },
  { id: 'gerente', label: 'Gerente', color: '#39FF14', desc: 'Gerencia sua unidade' },
  { id: 'administrador', label: 'Administrador', color: '#FFBF00', desc: 'Administra sua unidade' },
  { id: 'estoque', label: 'Estoque', color: '#9D4EDD', desc: 'Controle de estoque' },
  { id: 'tecnico', label: 'Tecnico', color: '#10b981', desc: 'Execucao de OS' },
  { id: 'tecnico_ih', label: 'Tecnico IH', color: '#06b6d4', desc: 'Tecnico In-Home' },
  { id: 'vendedor', label: 'Vendedor', color: '#f59e0b', desc: 'Vendas e cotacoes' },
  { id: 'atendente', label: 'Atendente', color: '#ec4899', desc: 'Atendimento ao cliente' }
];

const MENU_ICONS: Record<string, any> = {
  menu_dashboard: LayoutDashboard,
  menu_kanban: Kanban,
  menu_agendamento: Calendar,
  menu_otimizador: Route,
  menu_estoque: Package,
  menu_financeiro: DollarSign,
  menu_nf: Receipt,
  menu_cotacoes: FileText,
  menu_ci: Brain,
  menu_gia: Brain,
  menu_skywalker: Rocket,
  menu_chat: MessageCircle,
  menu_vendas: ShoppingCart,
  menu_atom_connect: MessageSquare,
  menu_configuracoes: Settings
};

const MENU_GROUPS = [
  {
    title: 'Menus Principais',
    type: 'menu',
    items: [
      { id: 'menu_dashboard', label: 'Dashboard' },
      { id: 'menu_kanban', label: 'Kanban' },
      { id: 'menu_agendamento', label: 'Agendamento' },
      { id: 'menu_otimizador', label: 'Otimizador' },
      { id: 'menu_estoque', label: 'Estoque' },
      { id: 'menu_financeiro', label: 'Financeiro' },
      { id: 'menu_nf', label: 'Notas Fiscais' },
      { id: 'menu_cotacoes', label: 'Cotacoes' },
      { id: 'menu_ci', label: 'Customer Intelligence' },
      { id: 'menu_gia', label: 'GIA' },
      { id: 'menu_skywalker', label: 'Skywalker' },
      { id: 'menu_chat', label: 'Chat' },
      { id: 'menu_vendas', label: 'Registro de Vendas' },
      { id: 'menu_atom_connect', label: 'Atom Connect' },
      { id: 'menu_configuracoes', label: 'Configuracoes' }
    ]
  },
  {
    title: 'Submenus Estoque',
    type: 'submenu',
    parent: 'menu_estoque',
    items: [
      { id: 'estoque_dashboard', label: 'Dashboard' },
      { id: 'estoque_geral', label: 'Estoque Geral' },
      { id: 'estoque_entrada', label: 'Entrada de NF' },
      { id: 'estoque_devolucoes', label: 'Devolucoes' },
      { id: 'estoque_transferencias', label: 'Transferencias' },
      { id: 'estoque_mapa', label: 'Mapa do Estoque' }
    ]
  },
  {
    title: 'Submenus Financeiro',
    type: 'submenu',
    parent: 'menu_financeiro',
    items: [
      { id: 'financeiro_dashboard', label: 'Dashboard' },
      { id: 'financeiro_caixa', label: 'Caixa' },
      { id: 'financeiro_lancamentos', label: 'Lancamentos' },
      { id: 'financeiro_consumo', label: 'Consumo de Pecas' },
      { id: 'financeiro_pendencias', label: 'Pendencias Samsung' }
    ]
  },
  {
    title: 'Submenus Otimizador',
    type: 'submenu',
    parent: 'menu_otimizador',
    items: [
      { id: 'otimizador_dashboard', label: 'Dashboard Executivo' },
      { id: 'otimizador_motor', label: 'Motor de Otimizacao' },
      { id: 'otimizador_rotas', label: 'Gestao de Rotas' },
      { id: 'otimizador_equipe', label: 'Gestao de Equipe' },
      { id: 'otimizador_pecas', label: 'Controle de Pecas' },
      { id: 'otimizador_checklists', label: 'Checklists' },
      { id: 'otimizador_agenda', label: 'Agenda Operacional' },
      { id: 'otimizador_rastreamento', label: 'Mapa de Rastreamento' },
      { id: 'otimizador_analytics', label: 'Analytics' },
      { id: 'otimizador_config', label: 'Configuracao' }
    ]
  },
  {
    title: 'Submenus Configuracoes',
    type: 'submenu',
    parent: 'menu_configuracoes',
    items: [
      { id: 'config_unidades', label: 'Unidades' },
      { id: 'config_usuarios', label: 'Usuarios' },
      { id: 'config_servicos', label: 'Servicos' },
      { id: 'config_markup', label: 'Markup' },
      { id: 'config_taxas', label: 'Taxas' },
      { id: 'config_rotas', label: 'Rotas' },
      { id: 'config_checklists', label: 'Checklists' },
      { id: 'config_pdf_os', label: 'PDF OS' },
      { id: 'config_nf', label: 'Nota Fiscal' },
      { id: 'config_permissoes', label: 'Permissoes' }
    ]
  },
  {
    title: 'Submenus Atom Connect',
    type: 'submenu',
    parent: 'menu_atom_connect',
    items: [
      { id: 'atom_connect_dashboard', label: 'Dashboard' },
      { id: 'atom_connect_chat', label: 'Conversas' },
      { id: 'atom_connect_kanban', label: 'Kanban' },
      { id: 'atom_connect_automacao', label: 'Automacao' },
      { id: 'atom_connect_marketing', label: 'Marketing' },
      { id: 'atom_connect_config', label: 'Configuracoes' }
    ]
  },
  {
    title: 'Submenus Skywalker',
    type: 'submenu',
    parent: 'menu_skywalker',
    items: [
      { id: 'skywalker_visao_geral', label: 'Visao Geral' },
      { id: 'skywalker_times', label: 'Times' },
      { id: 'skywalker_regras', label: 'Regras do Jogo' },
      { id: 'skywalker_niveis', label: 'Niveis e Bonus' }
    ]
  },
  {
    title: 'Filtros e Acoes',
    type: 'filtro',
    items: [
      { id: 'filtrar_unidades', label: 'Pode filtrar outras unidades' }
    ]
  }
];

export function ConfiguracoesPermissoes() {
  const [selectedPerfil, setSelectedPerfil] = useState<string>('gerente');
  const [permissions, setPermissions] = useState<PerfilPermissions>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['Menus Principais']));
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadPermissions(selectedPerfil);
  }, [selectedPerfil]);

  const loadPermissions = async (perfil: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('recurso, habilitado')
        .eq('perfil', perfil);

      if (error) throw error;

      const perms: PerfilPermissions = {};
      data?.forEach(p => {
        perms[p.recurso] = p.habilitado;
      });
      setPermissions(perms);
    } catch (err) {
      console.error('Erro ao carregar permissoes:', err);
    } finally {
      setLoading(false);
    }
  };

  const togglePermission = async (recurso: string) => {
    if (selectedPerfil === 'master') return;

    const newValue = !permissions[recurso];
    setSaving(recurso);

    try {
      const { error } = await supabase
        .from('role_permissions')
        .update({ habilitado: newValue })
        .eq('perfil', selectedPerfil)
        .eq('recurso', recurso);

      if (error) throw error;

      setPermissions(prev => ({ ...prev, [recurso]: newValue }));
    } catch (err) {
      console.error('Erro ao atualizar permissao:', err);
    } finally {
      setSaving(null);
    }
  };

  const toggleGroup = (title: string) => {
    setExpandedGroups(prev => {
      const newSet = new Set(prev);
      if (newSet.has(title)) {
        newSet.delete(title);
      } else {
        newSet.add(title);
      }
      return newSet;
    });
  };

  const getGroupStats = (items: { id: string }[]) => {
    const enabled = items.filter(item => permissions[item.id]).length;
    return { enabled, total: items.length };
  };

  const perfilInfo = PERFIS.find(p => p.id === selectedPerfil);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-3 rounded-xl bg-gradient-to-br from-red-500/20 to-orange-500/20 border border-red-500/30">
          <Shield className="w-6 h-6 text-red-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Gerenciamento de Permissoes</h2>
          <p className="text-sm text-gray-400">Configure o acesso de cada perfil aos menus e funcionalidades</p>
        </div>
      </div>

      <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
        <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm text-amber-300 font-medium">Importante</p>
          <p className="text-xs text-amber-200/80 mt-1">
            Usuarios com unidade cadastrada so podem ver dados da propria unidade, independente das permissoes de menu.
            Apenas Master e Diretoria sem unidade vinculada podem filtrar dados de outras unidades.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-2">
          <p className="text-xs text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Selecione o Perfil
          </p>
          {PERFIS.map(perfil => (
            <button
              key={perfil.id}
              onClick={() => setSelectedPerfil(perfil.id)}
              className={`w-full text-left p-3 rounded-xl transition-all ${
                selectedPerfil === perfil.id
                  ? 'ring-2'
                  : 'hover:bg-gray-800/50'
              }`}
              style={{
                background: selectedPerfil === perfil.id ? `${perfil.color}15` : 'rgba(0,0,0,0.2)',
                borderColor: selectedPerfil === perfil.id ? perfil.color : 'transparent',
                ringColor: selectedPerfil === perfil.id ? perfil.color : 'transparent'
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: perfil.color }}
                />
                <div className="flex-1">
                  <p className="text-sm font-medium text-white">{perfil.label}</p>
                  <p className="text-xs text-gray-500">{perfil.desc}</p>
                </div>
                {perfil.id === 'master' && (
                  <Shield className="w-4 h-4 text-red-400" />
                )}
              </div>
            </button>
          ))}
        </div>

        <div className="lg:col-span-3 space-y-4">
          {perfilInfo && (
            <div
              className="p-4 rounded-xl border flex items-center justify-between"
              style={{
                background: `${perfilInfo.color}10`,
                borderColor: `${perfilInfo.color}30`
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `${perfilInfo.color}20` }}
                >
                  <Shield className="w-5 h-5" style={{ color: perfilInfo.color }} />
                </div>
                <div>
                  <p className="text-lg font-bold text-white">{perfilInfo.label}</p>
                  <p className="text-sm text-gray-400">{perfilInfo.desc}</p>
                </div>
              </div>
              {selectedPerfil === 'master' && (
                <div className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30">
                  <p className="text-xs text-red-400 font-medium">Acesso Total - Nao Editavel</p>
                </div>
              )}
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            </div>
          ) : (
            <div className="space-y-3">
              {MENU_GROUPS.map(group => {
                const isExpanded = expandedGroups.has(group.title);
                const stats = getGroupStats(group.items);
                const parentEnabled = group.parent ? permissions[group.parent] : true;

                return (
                  <div
                    key={group.title}
                    className="rounded-xl border border-gray-800 overflow-hidden"
                    style={{ opacity: !parentEnabled ? 0.5 : 1 }}
                  >
                    <button
                      onClick={() => toggleGroup(group.title)}
                      className="w-full flex items-center justify-between p-4 bg-gray-900/50 hover:bg-gray-900/70 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-gray-500" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-gray-500" />
                        )}
                        <span className="text-sm font-medium text-white">{group.title}</span>
                        {group.type === 'filtro' && (
                          <Filter className="w-4 h-4 text-amber-400" />
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500">
                          {stats.enabled}/{stats.total} ativos
                        </span>
                        <div className="w-16 h-1.5 rounded-full bg-gray-800 overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${(stats.enabled / stats.total) * 100}%`,
                              background: stats.enabled === stats.total ? '#10b981' :
                                         stats.enabled === 0 ? '#ef4444' : '#f59e0b'
                            }}
                          />
                        </div>
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="p-3 space-y-1 bg-gray-950/50">
                        {group.items.map(item => {
                          const Icon = MENU_ICONS[item.id];
                          const isEnabled = permissions[item.id];
                          const isSaving = saving === item.id;
                          const isDisabled = selectedPerfil === 'master' || !parentEnabled;

                          return (
                            <div
                              key={item.id}
                              className={`flex items-center justify-between p-3 rounded-lg transition-all ${
                                isDisabled ? 'opacity-50' : 'hover:bg-gray-800/50'
                              }`}
                            >
                              <div className="flex items-center gap-3">
                                {Icon && <Icon className="w-4 h-4 text-gray-500" />}
                                <span className="text-sm text-gray-300">{item.label}</span>
                              </div>
                              <button
                                onClick={() => !isDisabled && togglePermission(item.id)}
                                disabled={isDisabled || isSaving}
                                className={`relative w-12 h-6 rounded-full transition-all ${
                                  isDisabled ? 'cursor-not-allowed' : 'cursor-pointer'
                                }`}
                                style={{
                                  background: isEnabled ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
                                  border: `1px solid ${isEnabled ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)'}`
                                }}
                              >
                                {isSaving ? (
                                  <div className="absolute inset-0 flex items-center justify-center">
                                    <Loader2 className="w-4 h-4 text-white animate-spin" />
                                  </div>
                                ) : (
                                  <>
                                    <div
                                      className={`absolute top-0.5 w-5 h-5 rounded-full transition-all flex items-center justify-center ${
                                        isEnabled ? 'left-6' : 'left-0.5'
                                      }`}
                                      style={{
                                        background: isEnabled ? '#10b981' : '#ef4444'
                                      }}
                                    >
                                      {isEnabled ? (
                                        <Check className="w-3 h-3 text-white" />
                                      ) : (
                                        <X className="w-3 h-3 text-white" />
                                      )}
                                    </div>
                                  </>
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
