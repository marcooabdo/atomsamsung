import { useState, useEffect } from 'react';
import { DollarSign, Star, TrendingUp, Users, Building2, Filter } from 'lucide-react';
import { ColaboradorCard } from './ColaboradorCard';
import { ColaboradorDetailsModal } from './ColaboradorDetailsModal';
import { mockColaboradores } from './mockData';
import type { Colaborador, Perfil } from './types';
import { supabase } from '../../lib/supabase';

interface Unidade {
  id: string;
  nome: string;
}

export function VisaoDiretoria() {
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [selectedUnidade, setSelectedUnidade] = useState<string>('all');
  const [selectedPerfil, setSelectedPerfil] = useState<Perfil | 'all'>('all');
  const [selectedColaborador, setSelectedColaborador] = useState<Colaborador | null>(null);
  const [colaboradores] = useState<Colaborador[]>(mockColaboradores);

  useEffect(() => {
    loadUnidades();
  }, []);

  const loadUnidades = async () => {
    const { data } = await supabase
      .from('unidades')
      .select('id, nome')
      .eq('ativo', true)
      .order('nome');

    if (data) {
      setUnidades(data);
    }
  };

  const filteredColaboradores = colaboradores.filter(c => {
    if (selectedUnidade !== 'all' && c.unidade_id !== selectedUnidade) return false;
    if (selectedPerfil !== 'all' && c.perfil !== selectedPerfil) return false;
    return true;
  });

  const stats = {
    faturamentoTotal: 'R$ 1.2M',
    mediaEstrelas: (filteredColaboradores.reduce((sum, c) => sum + c.estrelasMesAtual, 0) / filteredColaboradores.length || 0).toFixed(1),
    promoviveis: filteredColaboradores.filter(c => !c.travadoPorCultura && c.estrelasMesAtual >= c.metaEstrelas).length,
    travados: filteredColaboradores.filter(c => c.travadoPorCultura).length
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-4 p-4 bg-gray-800/50 rounded-xl border border-gray-700">
        <div className="flex items-center gap-2">
          <Filter className="w-5 h-5 text-cyan-400" />
          <span className="text-gray-400 text-sm font-medium">Filtros:</span>
        </div>

        <div className="flex items-center gap-2">
          <Building2 className="w-4 h-4 text-gray-500" />
          <select
            value={selectedUnidade}
            onChange={(e) => setSelectedUnidade(e.target.value)}
            className="px-4 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500 min-w-[180px]"
          >
            <option value="all">Todas Unidades</option>
            {unidades.map(u => (
              <option key={u.id} value={u.id}>{u.nome}</option>
            ))}
            <option value="fsa">Feira de Santana</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-gray-500" />
          <select
            value={selectedPerfil}
            onChange={(e) => setSelectedPerfil(e.target.value as Perfil | 'all')}
            className="px-4 py-2 bg-gray-900/50 border border-gray-600 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500 min-w-[150px]"
          >
            <option value="all">Todos os Times</option>
            <option value="front_office">Front Office</option>
            <option value="inside_sales">Inside Sales</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="p-4 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/30 rounded-xl">
          <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wider mb-1">
            <DollarSign className="w-4 h-4" />
            Faturamento Total
          </div>
          <p className="text-2xl font-bold text-cyan-400">{stats.faturamentoTotal}</p>
        </div>

        <div className="p-4 bg-gradient-to-br from-yellow-500/10 to-orange-500/10 border border-yellow-500/30 rounded-xl">
          <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wider mb-1">
            <Star className="w-4 h-4" />
            Media Estrelas
          </div>
          <p className="text-2xl font-bold text-yellow-400">{stats.mediaEstrelas}</p>
        </div>

        <div className="p-4 bg-gradient-to-br from-green-500/10 to-emerald-500/10 border border-green-500/30 rounded-xl">
          <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wider mb-1">
            <TrendingUp className="w-4 h-4" />
            Promoviveis
          </div>
          <p className="text-2xl font-bold text-green-400">{stats.promoviveis}</p>
        </div>

        <div className="p-4 bg-gradient-to-br from-red-500/10 to-pink-500/10 border border-red-500/30 rounded-xl">
          <div className="flex items-center gap-2 text-gray-400 text-xs uppercase tracking-wider mb-1">
            <Users className="w-4 h-4" />
            Travados Cultura
          </div>
          <p className="text-2xl font-bold text-red-400">{stats.travados}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredColaboradores.map(colaborador => (
          <ColaboradorCard
            key={colaborador.id}
            colaborador={colaborador}
            onClick={() => setSelectedColaborador(colaborador)}
          />
        ))}
      </div>

      {filteredColaboradores.length === 0 && (
        <div className="text-center py-12">
          <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Nenhum colaborador encontrado com os filtros selecionados.</p>
        </div>
      )}

      {selectedColaborador && (
        <ColaboradorDetailsModal
          colaborador={selectedColaborador}
          onClose={() => setSelectedColaborador(null)}
        />
      )}
    </div>
  );
}
