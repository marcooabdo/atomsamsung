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
  Calendar,
  Package,
  DollarSign,
  Receipt,
  Brain,
  Rocket,
  MessageCircle,
  ShoppingCart,
  Settings,
  Filter,
  AlertTriangle,
  Sparkles,
  Target,
  Radio,
  Layers,
  Truck
} from 'lucide-react';

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

interface MenuItem {
  id: string;
  label: string;
  icon: any;
  subItems?: { id: string; label: string }[];
}

const MENU_ITEMS: MenuItem[] = [
  { id: 'menu_gia', label: 'GIA', icon: Sparkles },
  { id: 'menu_mural_missoes', label: 'ATOM Command Center', icon: Target },
  {
    id: 'menu_atom_connect', label: 'ATOM Connect', icon: Radio,
    subItems: [
      { id: 'atom_connect_dashboard', label: 'Dashboard' },
      { id: 'atom_connect_chat', label: 'Conversas' },
      { id: 'atom_connect_kanban', label: 'Kanban' },
      { id: 'atom_connect_automacao', label: 'Automacao' },
      { id: 'atom_connect_marketing', label: 'Marketing' },
      { id: 'atom_connect_config', label: 'Configuracoes' }
    ]
  },
  { id: 'menu_dashboard', label: 'Central ATOM', icon: LayoutDashboard },
  { id: 'menu_kanban', label: 'Pipeline Operacional', icon: Layers },
  { id: 'menu_agendamento', label: 'Agendamento', icon: Calendar },
  {
    id: 'menu_estoque', label: 'Nucleo de Pecas', icon: Package,
    subItems: [
      { id: 'estoque_dashboard', label: 'Dashboard' },
      { id: 'estoque_geral', label: 'Estoque Geral' },
      { id: 'estoque_entrada', label: 'Entrada de NF' },
      { id: 'estoque_devolucoes', label: 'Devolucoes' },
      { id: 'estoque_transferencias', label: 'Transferencias' },
      { id: 'estoque_mapa', label: 'Mapa do Estoque' }
    ]
  },
  { id: 'menu_chat', label: 'QG de Comunicacao', icon: MessageCircle },
  {
    id: 'menu_otimizador', label: 'GIA Logistic', icon: Truck,
    subItems: [
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
  { id: 'menu_ci', label: 'Customer Intelligence', icon: Brain },
  { id: 'menu_vendas', label: 'Registro de Vendas', icon: ShoppingCart },
  {
    id: 'menu_skywalker', label: 'Skywalker', icon: Rocket,
    subItems: [
      { id: 'skywalker_visao_geral', label: 'Visao Geral' },
      { id: 'skywalker_times', label: 'Times' },
      { id: 'skywalker_regras', label: 'Regras do Jogo' },
      { id: 'skywalker_niveis', label: 'Niveis e Bonus' }
    ]
  },
  {
    id: 'menu_financeiro', label: 'ATOM Finance', icon: DollarSign,
    subItems: [
      { id: 'financeiro_dashboard', label: 'Dashboard' },
      { id: 'financeiro_caixa', label: 'Caixa' },
      { id: 'financeiro_lancamentos', label: 'Lancamentos' },
      { id: 'financeiro_consumo', label: 'Consumo de Pecas' },
      { id: 'financeiro_pendencias', label: 'Pendencias Samsung' }
    ]
  },
  { id: 'menu_nf', label: 'Notas Fiscais', icon: Receipt },
  { id: 'menu_cotacoes', label: 'OFS Gateway', icon: Filter },
  {
    id: 'menu_configuracoes', label: 'ATOM Core Settings', icon: Settings,
    subItems: [
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
  }
];

export function ConfiguracoesPermissoes() {
  const [selectedPerfil, setSelectedPerfil] = useState<string>('gerente');
  const [permissions, setPermissions] = useState<PerfilPermissions>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [expandedMenus, setExpandedMenus] = useState<Set<string>>(new Set());

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

  const toggleExpand = (menuId: string) => {
    setExpandedMenus(prev => {
      const next = new Set(prev);
      if (next.has(menuId)) {
        next.delete(menuId);
      } else {
        next.add(menuId);
      }
      return next;
    });
  };

  const totalEnabled = MENU_ITEMS.filter(m => permissions[m.id]).length;
  const totalMenus = MENU_ITEMS.length;

  const perfilInfo = PERFIS.find(p => p.id === selectedPerfil);
  const isMaster = selectedPerfil === 'master';

  const renderToggle = (id: string) => {
    const isEnabled = permissions[id];
    const isSaving = saving === id;
    const isDisabled = isMaster;

    return (
      <button
        onClick={() => !isDisabled && togglePermission(id)}
        disabled={isDisabled || isSaving}
        className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-all ${
          isDisabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'
        }`}
        style={{
          background: isEnabled ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)',
          border: `1px solid ${isEnabled ? 'rgba(16,185,129,0.5)' : 'rgba(239,68,68,0.5)'}`
        }}
      >
        {isSaving ? (
          <div className="absolute inset-0 flex items-center justify-center">
            <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
          </div>
        ) : (
          <div
            className={`absolute top-0.5 w-5 h-5 rounded-full transition-all flex items-center justify-center ${
              isEnabled ? 'left-6' : 'left-0.5'
            }`}
            style={{ background: isEnabled ? '#10b981' : '#ef4444' }}
          >
            {isEnabled ? (
              <Check className="w-3 h-3 text-white" />
            ) : (
              <X className="w-3 h-3 text-white" />
            )}
          </div>
        )}
      </button>
    );
  };

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
              className={`w-full text-left p-3 rounded-xl transition-all border ${
                selectedPerfil === perfil.id ? 'ring-1' : 'border-transparent hover:bg-gray-800/50'
              }`}
              style={{
                background: selectedPerfil === perfil.id ? `${perfil.color}15` : 'rgba(0,0,0,0.2)',
                borderColor: selectedPerfil === perfil.id ? `${perfil.color}60` : 'transparent'
              }}
            >
              <div className="flex items-center gap-3">
                <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: perfil.color }} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{perfil.label}</p>
                  <p className="text-xs text-gray-500">{perfil.desc}</p>
                </div>
                {perfil.id === 'master' && (
                  <Shield className="w-4 h-4 text-red-400 flex-shrink-0" />
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
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="text-xs text-gray-500">{totalEnabled}/{totalMenus} menus ativos</p>
                  <div className="w-20 h-1.5 rounded-full bg-gray-800 overflow-hidden mt-1">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${(totalEnabled / totalMenus) * 100}%`,
                        background: totalEnabled === totalMenus ? '#10b981' : totalEnabled === 0 ? '#ef4444' : '#f59e0b'
                      }}
                    />
                  </div>
                </div>
                {isMaster && (
                  <div className="px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-500/30">
                    <p className="text-xs text-red-400 font-medium">Acesso Total - Nao Editavel</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
            </div>
          ) : (
            <div className="rounded-xl border border-gray-800 overflow-hidden">
              <div className="px-4 py-3 bg-gray-900/70 border-b border-gray-800">
                <p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Menus do Sistema</p>
              </div>
              <div className="divide-y divide-gray-800/50">
                {MENU_ITEMS.map(item => {
                  const Icon = item.icon;
                  const isEnabled = permissions[item.id];
                  const hasSubItems = item.subItems && item.subItems.length > 0;
                  const isExpanded = expandedMenus.has(item.id);
                  const activeSubCount = hasSubItems
                    ? item.subItems!.filter(s => permissions[s.id]).length
                    : 0;

                  return (
                    <div key={item.id}>
                      <div
                        className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                          hasSubItems ? 'hover:bg-gray-800/30' : ''
                        }`}
                      >
                        {hasSubItems ? (
                          <button
                            onClick={() => toggleExpand(item.id)}
                            className="flex items-center gap-3 flex-1 min-w-0 text-left"
                          >
                            <div className="w-4 h-4 flex-shrink-0 text-gray-500">
                              {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </div>
                            <Icon className="w-4 h-4 flex-shrink-0 text-gray-400" />
                            <span className="text-sm text-gray-200 flex-1">{item.label}</span>
                            {isEnabled && (
                              <span className="text-xs text-gray-500 mr-2 flex-shrink-0">
                                {activeSubCount}/{item.subItems!.length} sub-menus
                              </span>
                            )}
                          </button>
                        ) : (
                          <div className="flex items-center gap-3 flex-1 min-w-0">
                            <div className="w-4 h-4 flex-shrink-0" />
                            <Icon className="w-4 h-4 flex-shrink-0 text-gray-400" />
                            <span className="text-sm text-gray-200 flex-1">{item.label}</span>
                          </div>
                        )}
                        {renderToggle(item.id)}
                      </div>

                      {hasSubItems && isExpanded && (
                        <div
                          className="border-t border-gray-800/50"
                          style={{ opacity: isEnabled ? 1 : 0.45 }}
                        >
                          {item.subItems!.map(sub => (
                            <div
                              key={sub.id}
                              className="flex items-center gap-3 pl-12 pr-4 py-2.5 hover:bg-gray-800/20 transition-colors"
                            >
                              <div className="w-1 h-1 rounded-full bg-gray-600 flex-shrink-0" />
                              <span className="text-sm text-gray-400 flex-1">{sub.label}</span>
                              {renderToggle(sub.id)}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
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
