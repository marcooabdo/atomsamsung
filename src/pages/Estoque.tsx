import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { UnitFilter } from '../components/UnitFilter';
import { EstoqueGeral } from '../components/estoque/EstoqueGeral';
import { EstoqueTransferencias } from '../components/estoque/EstoqueTransferencias';
import { EstoqueDevolucoes } from '../components/estoque/EstoqueDevolucoes';
import { EstoqueEntrada } from '../components/estoque/EstoqueEntrada';
import { EstoqueMapa } from '../components/estoque/EstoqueMapa';
import { Package, ArrowRightLeft, RotateCcw, Upload, Map } from 'lucide-react';

type Tab = 'geral' | 'entrada' | 'transferencias' | 'devolucoes' | 'mapa';

export function Estoque() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('geral');
  const [unidades, setUnidades] = useState<Array<{id: string; nome: string}>>([]);
  const [selectedUnidade, setSelectedUnidade] = useState('');

  useEffect(() => {
    loadUnidades();
  }, []);

  useEffect(() => {
    if (user?.unidade_id) {
      setSelectedUnidade(user.unidade_id);
    }
  }, [user]);

  const loadUnidades = async () => {
    const { data } = await supabase.from('unidades').select('id, nome').order('nome');
    setUnidades(data || []);
  };

  const tabs = [
    { id: 'geral' as Tab, label: 'Estoque Geral', icon: Package, color: 'var(--text-accent)', isAccent: true },
    { id: 'entrada' as Tab, label: 'Entrada de NF', icon: Upload, color: '#39FF14', isAccent: false },
    { id: 'transferencias' as Tab, label: 'Transferências', icon: ArrowRightLeft, color: '#FFBF00', isAccent: false },
    { id: 'devolucoes' as Tab, label: 'Devoluções', icon: RotateCcw, color: '#FF0064', isAccent: false },
    { id: 'mapa' as Tab, label: 'Mapa do Estoque', icon: Map, color: 'var(--text-accent)', isAccent: true }
  ];

  return (
    <div className="space-y-6 fade-in">
      <UnitFilter
        unidades={unidades}
        selectedUnidade={selectedUnidade}
        onUnidadeChange={setSelectedUnidade}
      />
      <div>
        <h3 className="tech-heading text-xl text-[#00D4FF] mb-2">GESTÃO DE ESTOQUE</h3>
        <p className="text-sm text-gray-400 tracking-wide">
          Rastreamento completo de peças com ID único
        </p>
      </div>

      <div className="premium-card">
        <div className="border-b border-[#00D4FF]/20">
          <nav className="flex -mb-px overflow-x-auto cyber-scrollbar">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-2 px-6 py-4 border-b-2 font-bold text-sm uppercase tracking-wider transition-all flex-shrink-0 ${
                    isActive
                      ? 'text-[#00D4FF]'
                      : 'text-gray-500 hover:text-[#00D4FF]'
                  }`}
                  style={{
                    borderColor: isActive ? tab.color : 'transparent',
                    boxShadow: isActive
                      ? tab.isAccent
                        ? `0 2px 0 var(--text-accent), 0 0 20px rgba(var(--accent-rgb), 0.25)`
                        : `0 2px 0 ${tab.color}, 0 0 20px ${tab.color}40`
                      : 'none'
                  }}
                >
                  <Icon
                    className="w-5 h-5"
                    style={isActive ? {
                      color: tab.color,
                      filter: tab.isAccent
                        ? 'drop-shadow(0 0 4px var(--text-accent))'
                        : `drop-shadow(0 0 4px ${tab.color})`
                    } : {}}
                  />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        <div className="p-6">
          {activeTab === 'geral' && <EstoqueGeral selectedUnidade={selectedUnidade} user={user} />}
          {activeTab === 'entrada' && <EstoqueEntrada selectedUnidade={selectedUnidade} user={user} />}
          {activeTab === 'transferencias' && <EstoqueTransferencias selectedUnidade={selectedUnidade} user={user} />}
          {activeTab === 'devolucoes' && <EstoqueDevolucoes selectedUnidade={selectedUnidade} user={user} />}
          {activeTab === 'mapa' && <EstoqueMapa selectedUnidade={selectedUnidade} />}
        </div>
      </div>
    </div>
  );
}
