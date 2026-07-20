import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { usePermissions } from '../hooks/usePermissions';
import { UnitFilter } from '../components/UnitFilter';
import FinanceDashboard from '../components/finance/FinanceDashboard';
import CaixaModule from '../components/finance/CaixaModule';
import LancamentosModule from '../components/finance/LancamentosModule';
import ConsumoPecasModule from '../components/finance/ConsumoPecasModule';
import PendenciasSamsungModule from '../components/finance/PendenciasSamsungModule';
import {
  DollarSign, TrendingUp, Wallet, Package, AlertTriangle,
  Filter, LayoutDashboard, Receipt, FileText, Building2
} from 'lucide-react';

const ALL_TABS = [
  { id: 'dashboard', label: 'Dashboard Executivo', icon: LayoutDashboard, permKey: 'financeiro_dashboard' },
  { id: 'caixa', label: 'Caixa', icon: Wallet, permKey: 'financeiro_caixa' },
  { id: 'lancamentos', label: 'Lancamentos', icon: Receipt, permKey: 'financeiro_lancamentos' },
  { id: 'consumo', label: 'Consumo Pecas', icon: Package, permKey: 'financeiro_consumo' },
  { id: 'pendencias', label: 'Pendencias Samsung', icon: AlertTriangle, permKey: 'financeiro_pendencias' },
];

export function Financeiro() {
  const { usuario, unidadesAdicionais, allUserUnits } = useAuth();
  const { hasPermission } = usePermissions();
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedUnidade, setSelectedUnidade] = useState('');
  const [unidades, setUnidades] = useState<Array<{ id: string; nome: string }>>([]);
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');

  const tabs = ALL_TABS.filter(t => hasPermission(t.permKey));

  useEffect(() => {
    if (tabs.length > 0 && !tabs.find(t => t.id === activeTab)) {
      setActiveTab(tabs[0].id);
    }
  }, [tabs.length]);

  useEffect(() => {
    loadUnidades();
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    setDataInicio(firstDay.toISOString().split('T')[0]);
    setDataFim(today.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (usuario) {
      if ((usuario.tipo === 'master' || usuario.tipo === 'diretoria') && !usuario.unidade_id) {
        return;
      }
      if (usuario.unidade_id && allUserUnits.length <= 1) {
        setSelectedUnidade(usuario.unidade_id);
      }
    }
  }, [usuario, allUserUnits]);

  const loadUnidades = async () => {
    const { data } = await supabase.from('unidades').select('id, nome').order('nome');
    setUnidades(data || []);
  };

  const canSeeAllUnits = (usuario?.tipo === 'master' || usuario?.tipo === 'diretoria') && !usuario?.unidade_id;
  const hasMultipleUnits = allUserUnits.length > 1;
  const canSelectUnit = canSeeAllUnits || hasMultipleUnits;

  const getUnidadeIdForQuery = () => {
    if (canSeeAllUnits) {
      return selectedUnidade || null;
    }
    return selectedUnidade || usuario?.unidade_id || null;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#00D4FF]" style={{ textShadow: '0 0 30px rgba(var(--accent-rgb), 0.3)' }}>
            ATOM FINANCE
          </h1>
          <p className="text-gray-400 mt-1">Gestao financeira completa e controle de consumo</p>
        </div>
      </div>

      <div className="premium-card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-cyan-400" />
            <span className="text-sm text-gray-400">Filtros:</span>
          </div>

          {canSelectUnit && (
            <UnitFilter
              unidades={canSeeAllUnits ? unidades : unidades.filter(u => allUserUnits.includes(u.id))}
              selectedUnidade={selectedUnidade}
              onUnidadeChange={setSelectedUnidade}
            />
          )}

          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dataInicio}
              onChange={(e) => setDataInicio(e.target.value)}
              className="neon-input text-sm"
            />
            <span className="text-gray-500">até</span>
            <input
              type="date"
              value={dataFim}
              onChange={(e) => setDataFim(e.target.value)}
              className="neon-input text-sm"
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-gray-700 pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-[#00D4FF]/20 border border-[#00D4FF]/50 text-[#00D4FF]'
                  : 'bg-gray-800/50 border border-gray-700 text-gray-400 hover:bg-gray-700/50 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span className="text-sm font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>

      <div className="min-h-[500px]">
        {activeTab === 'dashboard' && (
          <FinanceDashboard
            unidadeId={getUnidadeIdForQuery()}
            dataInicio={dataInicio}
            dataFim={dataFim}
          />
        )}

        {activeTab === 'caixa' && getUnidadeIdForQuery() && (
          <CaixaModule unidadeId={getUnidadeIdForQuery()!} />
        )}

        {activeTab === 'caixa' && !getUnidadeIdForQuery() && (
          <div className="premium-card p-12 text-center">
            <Building2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Selecione uma Unidade</h3>
            <p className="text-gray-400">Para gerenciar o caixa, selecione uma unidade no filtro acima.</p>
          </div>
        )}

        {activeTab === 'lancamentos' && getUnidadeIdForQuery() && (
          <LancamentosModule unidadeId={getUnidadeIdForQuery()!} />
        )}

        {activeTab === 'lancamentos' && !getUnidadeIdForQuery() && (
          <div className="premium-card p-12 text-center">
            <Building2 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-white mb-2">Selecione uma Unidade</h3>
            <p className="text-gray-400">Para gerenciar lancamentos, selecione uma unidade no filtro acima.</p>
          </div>
        )}

        {activeTab === 'consumo' && (
          <ConsumoPecasModule
            unidadeId={getUnidadeIdForQuery()}
            dataInicio={dataInicio}
            dataFim={dataFim}
          />
        )}

        {activeTab === 'pendencias' && (
          <PendenciasSamsungModule
            unidadeId={getUnidadeIdForQuery()}
            dataInicio={dataInicio}
            dataFim={dataFim}
          />
        )}

      </div>
    </div>
  );
}
