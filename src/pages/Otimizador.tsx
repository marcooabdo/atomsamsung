import { Activity, BarChart3, Calendar, CheckSquare, Cog, MapPin, Package, Users, Zap } from 'lucide-react';
import { OtimizadorProvider, useOtimizador, type OtimizadorTab } from '../contexts/OtimizadorContext';
import { UnitFilter } from '../components/UnitFilter';
import DashboardExecutivo from '../components/otimizador/DashboardExecutivo';
import AgendaOperacional from '../components/otimizador/AgendaOperacional';
import MapaInteligente from '../components/otimizador/MapaInteligente';
import MotorOtimizacao from '../components/otimizador/MotorOtimizacao';
import GestaoEquipe from '../components/otimizador/GestaoEquipe';
import SistemaChecklists from '../components/otimizador/SistemaChecklists';
import ControlePecas from '../components/otimizador/ControlePecas';
import Analytics from '../components/otimizador/Analytics';
import ConfiguracaoOtimizador from '../components/otimizador/ConfiguracaoOtimizador';

const TABS: Array<{ id: OtimizadorTab; label: string; icon: any; color: string }> = [
  { id: 'dashboard', label: 'Dashboard', icon: Activity, color: '#00D4FF' },
  { id: 'agenda', label: 'Agenda', icon: Calendar, color: '#3B82F6' },
  { id: 'mapa', label: 'Mapa', icon: MapPin, color: '#10B981' },
  { id: 'motor', label: 'Otimizador', icon: Zap, color: '#FFBF00' },
  { id: 'equipe', label: 'Equipe', icon: Users, color: '#8B5CF6' },
  { id: 'checklists', label: 'Checklists', icon: CheckSquare, color: '#EC4899' },
  { id: 'pecas', label: 'Peças', icon: Package, color: '#F97316' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, color: '#39FF14' },
  { id: 'config', label: 'Config', icon: Cog, color: '#6B7280' },
];

function OtimizadorContent() {
  const { activeTab, setActiveTab, selectedUnidade, setSelectedUnidade, unidades } = useOtimizador();

  const renderTabContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <DashboardExecutivo />;
      case 'agenda':
        return <AgendaOperacional />;
      case 'mapa':
        return <MapaInteligente />;
      case 'motor':
        return <MotorOtimizacao />;
      case 'equipe':
        return <GestaoEquipe />;
      case 'checklists':
        return <SistemaChecklists />;
      case 'pecas':
        return <ControlePecas />;
      case 'analytics':
        return <Analytics />;
      case 'config':
        return <ConfiguracaoOtimizador />;
      default:
        return <DashboardExecutivo />;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="max-w-[1920px] mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 flex items-center gap-3">
              <Zap className="w-10 h-10 text-cyan-400 animate-pulse" />
              Centro de Comando Operacional
            </h1>
            <p className="text-gray-400 mt-2">Hub gerencial completo para gestão de atendimentos IH</p>
          </div>

          <div className="w-64">
            <UnitFilter
              unidades={unidades}
              selectedUnidade={selectedUnidade || ''}
              onUnidadeChange={setSelectedUnidade}
            />
          </div>
        </div>

        {!selectedUnidade ? (
          <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-8 text-center">
            <p className="text-yellow-400 text-lg">Selecione uma unidade para começar</p>
          </div>
        ) : (
          <>
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-2 flex gap-2 overflow-x-auto">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`
                      flex items-center gap-2 px-4 py-3 rounded-lg transition-all whitespace-nowrap
                      ${isActive
                        ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border-2 shadow-lg'
                        : 'hover:bg-gray-700/50'
                      }
                    `}
                    style={{
                      borderColor: isActive ? tab.color : 'transparent',
                      boxShadow: isActive ? `0 0 20px ${tab.color}40` : 'none'
                    }}
                  >
                    <Icon
                      className="w-5 h-5"
                      style={{ color: isActive ? tab.color : '#9CA3AF' }}
                    />
                    <span
                      className="font-medium"
                      style={{ color: isActive ? tab.color : '#9CA3AF' }}
                    >
                      {tab.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="animate-fadeIn">
              {renderTabContent()}
            </div>
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
