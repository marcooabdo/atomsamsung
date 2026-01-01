import { useState } from 'react';
import { Rocket, Trophy, Star, ShoppingCart, Settings } from 'lucide-react';
import { SkywalkerProvider } from '../contexts/SkywalkerContext';
import { RankingGlobal } from '../components/skywalker/RankingGlobal';
import { PipelineGoogleCultura } from '../components/skywalker/PipelineGoogleCultura';
import { InputVendas } from '../components/skywalker/InputVendas';
import { RegrasJogo } from '../components/skywalker/RegrasJogo';

type TabKey = 'ranking' | 'pipeline' | 'vendas' | 'regras';

interface Tab {
  key: TabKey;
  label: string;
  icon: React.ReactNode;
  component: React.ReactNode;
}

const tabs: Tab[] = [
  {
    key: 'ranking',
    label: 'Ranking Global',
    icon: <Trophy className="w-5 h-5" />,
    component: <RankingGlobal />
  },
  {
    key: 'pipeline',
    label: 'Pipeline Google & Cultura',
    icon: <Star className="w-5 h-5" />,
    component: <PipelineGoogleCultura />
  },
  {
    key: 'vendas',
    label: 'Input de Vendas',
    icon: <ShoppingCart className="w-5 h-5" />,
    component: <InputVendas />
  },
  {
    key: 'regras',
    label: 'Regras do Jogo',
    icon: <Settings className="w-5 h-5" />,
    component: <RegrasJogo />
  }
];

function SkywalkerContent() {
  const [activeTab, setActiveTab] = useState<TabKey>('ranking');

  const currentTab = tabs.find(t => t.key === activeTab);

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="p-3 bg-gradient-to-br from-cyan-500/20 to-blue-500/20 rounded-xl border border-cyan-500/30">
              <Rocket className="w-8 h-8 text-cyan-400" />
            </div>
            <div className="absolute -inset-2 bg-cyan-500/20 rounded-full blur-xl animate-pulse -z-10" />
          </div>
          <div>
            <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-cyan-300">
              SKYWALKER
            </h1>
            <p className="text-gray-400 text-sm">Sistema de Gamificacao de Carreira</p>
          </div>
        </div>

        <nav className="flex gap-1 p-1 bg-gray-800/50 rounded-xl border border-gray-700 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm whitespace-nowrap transition-all ${
                activeTab === tab.key
                  ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 text-cyan-400 border border-cyan-500/50 shadow-lg shadow-cyan-500/10'
                  : 'text-gray-400 hover:text-white hover:bg-gray-700/50'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>

      <div className="min-h-[600px]">
        {currentTab?.component}
      </div>
    </div>
  );
}

export function Skywalker() {
  return (
    <SkywalkerProvider>
      <SkywalkerContent />
    </SkywalkerProvider>
  );
}
