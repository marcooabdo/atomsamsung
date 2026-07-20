import { Activity, BarChart3, Calendar, CheckSquare, Cog, Package, Users, Zap, Navigation, Route, Truck, AlertTriangle, RefreshCw, FolderOpen } from 'lucide-react';
import { Component, ReactNode } from 'react';
import { OtimizadorProvider, useOtimizador, type OtimizadorTab } from '../contexts/OtimizadorContext';
import { UnitFilter } from '../components/UnitFilter';
import { usePermissions } from '../hooks/usePermissions';

class OtimizadorErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-4 rounded-xl p-8"
          style={{ backgroundColor: '#EF444410', border: '1px solid #EF444430' }}>
          <AlertTriangle className="w-10 h-10" style={{ color: '#EF4444' }} />
          <div className="text-center">
            <p className="font-semibold text-base mb-1" style={{ color: '#EF4444' }}>Erro ao carregar esta aba</p>
            <p className="text-sm" style={{ color: '#9CA3AF' }}>{this.state.error?.message || 'Erro desconhecido'}</p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
            style={{ backgroundColor: '#EF444420', color: '#EF4444', border: '1px solid #EF444440' }}
          >
            <RefreshCw className="w-4 h-4" />
            Tentar novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
import DashboardExecutivo from '../components/otimizador/DashboardExecutivo';
import AgendaOperacional from '../components/otimizador/AgendaOperacional';
import MapaRastreamento from '../components/otimizador/MapaRastreamento';
import GestaoRotas from '../components/otimizador/GestaoRotas';
import MotorOtimizacaoNew from '../components/otimizador/MotorOtimizacaoNew';
import GestaoEquipe from '../components/otimizador/GestaoEquipe';
import SistemaChecklists from '../components/otimizador/SistemaChecklists';
import ControlePecas from '../components/otimizador/ControlePecas';
import Analytics from '../components/otimizador/Analytics';
import ConfiguracaoOtimizador from '../components/otimizador/ConfiguracaoOtimizador';
import RotasRealizadas from '../components/otimizador/RotasRealizadas';

const ALL_TABS: Array<{ id: OtimizadorTab; label: string; icon: any; color: string; permKey: string }> = [
  { id: 'dashboard', label: 'Dashboard', icon: Activity, color: 'var(--text-accent)', permKey: 'otimizador_dashboard' },
  { id: 'agenda', label: 'Agenda', icon: Calendar, color: '#3B82F6', permKey: 'otimizador_agenda' },
  { id: 'mapa', label: 'Rastreamento', icon: Navigation, color: '#10B981', permKey: 'otimizador_rastreamento' },
  { id: 'rotas', label: 'Rotas', icon: Route, color: '#EC4899', permKey: 'otimizador_rotas' },
  { id: 'motor', label: 'Otimizador', icon: Zap, color: '#FFBF00', permKey: 'otimizador_motor' },
  { id: 'equipe', label: 'Equipe', icon: Users, color: '#06B6D4', permKey: 'otimizador_equipe' },
  { id: 'checklists', label: 'Checklists', icon: CheckSquare, color: '#EC4899', permKey: 'otimizador_checklists' },
  { id: 'pecas', label: 'Pecas', icon: Package, color: '#F97316', permKey: 'otimizador_pecas' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, color: '#10B981', permKey: 'otimizador_analytics' },
  { id: 'historico', label: 'Rotas Realizadas', icon: FolderOpen, color: '#3B82F6', permKey: 'otimizador_rotas' },
  { id: 'config', label: 'Config', icon: Cog, color: '#6B7280', permKey: 'otimizador_config' },
];

function OtimizadorContent() {
  const { activeTab, setActiveTab, selectedUnidade, setSelectedUnidade, unidades, isMaster } = useOtimizador();
  const { hasPermission } = usePermissions();
  const canProceed = isMaster || selectedUnidade;
  const tabs = ALL_TABS.filter(t => hasPermission(t.permKey));

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard': return <DashboardExecutivo />;
      case 'agenda': return <AgendaOperacional />;
      case 'mapa': return <MapaRastreamento />;
      case 'rotas': return <GestaoRotas />;
      case 'motor': return <MotorOtimizacaoNew />;
      case 'equipe': return <GestaoEquipe />;
      case 'checklists': return <SistemaChecklists />;
      case 'pecas': return <ControlePecas />;
      case 'analytics': return <Analytics />;
      case 'historico': return <RotasRealizadas />;
      case 'config': return <ConfiguracaoOtimizador />;
      default: return <DashboardExecutivo />;
    }
  };

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <div className="max-w-[1920px] mx-auto p-4 lg:p-6 space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold flex items-center gap-2" style={{ color: 'var(--text-accent)' }}>
              <Truck className="w-7 h-7 lg:w-8 lg:h-8" />
              GIA Logistic
            </h1>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Hub gerencial para gestao de atendimentos</p>
          </div>
          <div className="w-56">
            <UnitFilter unidades={unidades} selectedUnidade={selectedUnidade || ''} onUnidadeChange={setSelectedUnidade} />
          </div>
        </div>

        {!canProceed ? (
          <div className="rounded-xl p-8 text-center" style={{ backgroundColor: '#F59E0B10', border: '1px solid #F59E0B30' }}>
            <p className="font-medium" style={{ color: '#F59E0B' }}>Selecione uma unidade para comecar</p>
          </div>
        ) : (
          <>
            <div className="rounded-xl p-1.5 flex gap-1 overflow-x-auto" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-lg transition-all whitespace-nowrap text-sm"
                    style={{
                      backgroundColor: isActive ? tab.color + '15' : 'transparent',
                      border: isActive ? `1.5px solid ${tab.color}40` : '1.5px solid transparent',
                      color: isActive ? tab.color : 'var(--text-secondary)',
                    }}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="font-medium">{tab.label}</span>
                  </button>
                );
              })}
            </div>
            <OtimizadorErrorBoundary key={activeTab}>
              <div>{renderTabContent()}</div>
            </OtimizadorErrorBoundary>
          </>
        )}
      </div>
    </div>
  );
}

export default function Otimizador() {
  return (
    <OtimizadorProvider>
      <OtimizadorContent />
    </OtimizadorProvider>
  );
}
