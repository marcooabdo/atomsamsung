import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { UnitFilter } from '../components/UnitFilter';
import { ClipboardList, Activity } from 'lucide-react';

export function OFS() {
  const { user } = useAuth();
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

  return (
    <div className="space-y-6 fade-in">
      <UnitFilter
        unidades={unidades}
        selectedUnidade={selectedUnidade}
        onUnidadeChange={setSelectedUnidade}
      />
      <div className="flex items-center justify-between">
        <div>
          <h3 className="tech-heading text-xl text-[#00D4FF] mb-2">ORDEM DE FORNECIMENTO</h3>
          <p className="text-sm text-gray-400 tracking-wide">
            Gestão de pedidos e fornecimento de peças
          </p>
        </div>
        <button className="neon-button flex items-center gap-2">
          <Activity className="w-4 h-4" />
          ATUALIZAR
        </button>
      </div>

      <div className="premium-card p-6">
        <div className="text-center py-16">
          <ClipboardList className="w-16 h-16 text-[#00D4FF] mx-auto mb-4" style={{ filter: 'drop-shadow(0 0 8px rgba(0, 212, 255, 0.6))' }} />
          <p className="text-gray-400">Sistema OFS em desenvolvimento</p>
        </div>
      </div>
    </div>
  );
}
