import { useState, useEffect } from 'react';
import { Users, TrendingUp, Clock, CheckCircle, XCircle, Search, Award, AlertCircle } from 'lucide-react';
import { useOtimizador } from '../../contexts/OtimizadorContext';
import { supabase } from '../../lib/supabase';

interface TecnicoStats {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  horario_inicio_expediente: string;
  horario_fim_expediente: string;
  duracao_almoco_minutos: number;
  horario_almoco_inicio: string;
  ativo: boolean;
  os_concluidas: number;
  os_em_andamento: number;
  os_atrasadas: number;
  taxa_sucesso: number;
  tempo_medio_atendimento: number;
}

export default function GestaoEquipe() {
  const { selectedUnidade, loading } = useOtimizador();
  const [tecnicos, setTecnicos] = useState<TecnicoStats[]>([]);
  const [loadingTecnicos, setLoadingTecnicos] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (selectedUnidade) {
      loadTecnicosStats();
    }
  }, [selectedUnidade]);

  const loadTecnicosStats = async () => {
    setLoadingTecnicos(true);
    try {
      const { data: tecnicosData, error: tecnicosError } = await supabase
        .from('usuarios')
        .select('*')
        .eq('unidade_id', selectedUnidade)
        .in('tipo', ['tecnico', 'tecnico_ih'])
        .order('nome');

      if (tecnicosError) throw tecnicosError;

      const tecnicosComStats = await Promise.all(
        (tecnicosData || []).map(async (tecnico) => {
          const { data: osConcluidas } = await supabase
            .from('os')
            .select('*', { count: 'exact', head: true })
            .eq('tecnico_id', tecnico.id)
            .eq('coluna_kanban', 'os_fechada');

          const { data: osEmAndamento } = await supabase
            .from('os')
            .select('*', { count: 'exact', head: true })
            .eq('tecnico_id', tecnico.id)
            .neq('coluna_kanban', 'os_fechada');

          const { data: agendamentosData } = await supabase
            .from('agendamentos')
            .select('*')
            .eq('tecnico_id', tecnico.id)
            .eq('status', 'concluido');

          const totalAgendamentos = agendamentosData?.length || 0;
          const taxaSucesso = totalAgendamentos > 0
            ? Math.round(((osConcluidas?.count || 0) / totalAgendamentos) * 100)
            : 0;

          return {
            ...tecnico,
            os_concluidas: osConcluidas?.count || 0,
            os_em_andamento: osEmAndamento?.count || 0,
            os_atrasadas: 0,
            taxa_sucesso: taxaSucesso,
            tempo_medio_atendimento: 120,
          };
        })
      );

      setTecnicos(tecnicosComStats);
    } catch (error) {
    } finally {
      setLoadingTecnicos(false);
    }
  };

  const filteredTecnicos = tecnicos.filter(t =>
    t.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalOsConcluidas = tecnicos.reduce((sum, t) => sum + t.os_concluidas, 0);
  const totalOsEmAndamento = tecnicos.reduce((sum, t) => sum + t.os_em_andamento, 0);
  const mediaTaxaSucesso = tecnicos.length > 0
    ? Math.round(tecnicos.reduce((sum, t) => sum + t.taxa_sucesso, 0) / tecnicos.length)
    : 0;

  if (loadingTecnicos || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="futuristic-loader"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-pink-500 to-red-600">
            Gestão de Equipe
          </h2>
          <p className="text-gray-400 mt-1">Performance de técnicos e gestão de disponibilidade</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border border-purple-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total de Técnicos</p>
              <p className="text-3xl font-bold text-purple-400 mt-1">{tecnicos.length}</p>
            </div>
            <Users className="w-12 h-12 text-purple-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">OS Concluídas</p>
              <p className="text-3xl font-bold text-green-400 mt-1">{totalOsConcluidas}</p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Em Andamento</p>
              <p className="text-3xl font-bold text-blue-400 mt-1">{totalOsEmAndamento}</p>
            </div>
            <Clock className="w-12 h-12 text-blue-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border border-yellow-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Taxa de Sucesso</p>
              <p className="text-3xl font-bold text-yellow-400 mt-1">{mediaTaxaSucesso}%</p>
            </div>
            <Award className="w-12 h-12 text-yellow-400 opacity-50" />
          </div>
        </div>
      </div>

      <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
        <div className="flex items-center gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar técnico por nome ou email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500 transition-colors"
            />
          </div>
        </div>

        {filteredTecnicos.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400 text-lg">Nenhum técnico encontrado</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filteredTecnicos.map((tecnico) => (
              <div
                key={tecnico.id}
                className="bg-gray-700/30 border border-gray-600 rounded-lg p-6 hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-xl font-bold text-white">{tecnico.nome}</h3>
                      {tecnico.ativo ? (
                        <span className="px-3 py-1 bg-green-500/20 border border-green-500/30 rounded-full text-green-400 text-xs">
                          Ativo
                        </span>
                      ) : (
                        <span className="px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-full text-red-400 text-xs">
                          Inativo
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-gray-400 text-sm">Email</p>
                        <p className="text-white">{tecnico.email}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm">Telefone</p>
                        <p className="text-white">{tecnico.telefone || 'Não informado'}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm">Horário de Expediente</p>
                        <p className="text-white">
                          {tecnico.horario_inicio_expediente?.substring(0, 5)} às {tecnico.horario_fim_expediente?.substring(0, 5)}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-400 text-sm">Almoço</p>
                        <p className="text-white">
                          {tecnico.horario_almoco_inicio?.substring(0, 5)} ({tecnico.duracao_almoco_minutos}min)
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                        <p className="text-gray-400 text-xs">OS Concluídas</p>
                        <p className="text-green-400 text-2xl font-bold">{tecnico.os_concluidas}</p>
                      </div>
                      <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                        <p className="text-gray-400 text-xs">Em Andamento</p>
                        <p className="text-blue-400 text-2xl font-bold">{tecnico.os_em_andamento}</p>
                      </div>
                      <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                        <p className="text-gray-400 text-xs">Taxa Sucesso</p>
                        <p className="text-yellow-400 text-2xl font-bold">{tecnico.taxa_sucesso}%</p>
                      </div>
                      <div className="bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3">
                        <p className="text-gray-400 text-xs">Tempo Médio</p>
                        <p className="text-cyan-400 text-2xl font-bold">{tecnico.tempo_medio_atendimento}min</p>
                      </div>
                      {tecnico.os_atrasadas > 0 && (
                        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3">
                          <p className="text-gray-400 text-xs">Atrasadas</p>
                          <p className="text-red-400 text-2xl font-bold">{tecnico.os_atrasadas}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
