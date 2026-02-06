import { Activity, BarChart3, Calendar, CheckSquare, Cog, MapPin, Package, Users, Zap, Navigation, Route } from 'lucide-react';
import { OtimizadorProvider, useOtimizador, type OtimizadorTab } from '../contexts/OtimizadorContext';
import { UnitFilter } from '../components/UnitFilter';
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

const TABS: Array<{ id: OtimizadorTab; label: string; icon: any; color: string }> = [
  { id: 'dashboard', label: 'Dashboard', icon: Activity, color: 'var(--text-accent)' },
  { id: 'agenda', label: 'Agenda', icon: Calendar, color: '#3B82F6' },
  { id: 'mapa', label: 'Rastreamento', icon: Navigation, color: '#10B981' },
  { id: 'rotas', label: 'Rotas', icon: Route, color: '#EC4899' },
  { id: 'motor', label: 'Otimizador', icon: Zap, color: '#FFBF00' },
  { id: 'equipe', label: 'Equipe', icon: Users, color: '#06B6D4' },
  { id: 'checklists', label: 'Checklists', icon: CheckSquare, color: '#EC4899' },
  { id: 'pecas', label: 'Pecas', icon: Package, color: '#F97316' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, color: '#10B981' },
  { id: 'config', label: 'Config', icon: Cog, color: '#6B7280' },
];

function OtimizadorContent() {
  const { activeTab, setActiveTab, selectedUnidade, setSelectedUnidade, unidades, isMaster } = useOtimizador();
  const canProceed = isMaster || selectedUnidade;

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
              <Zap className="w-7 h-7 lg:w-8 lg:h-8" />
              Centro de Comando
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
              {TABS.map((tab) => {
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
            <div>{renderTabContent()}</div>
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
