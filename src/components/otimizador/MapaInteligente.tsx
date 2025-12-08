import { MapPin, Navigation, Layers, Filter, X, Search, Calendar, User, AlertCircle, TrendingUp, Clock } from 'lucide-react';
import { useOtimizador } from '../../contexts/OtimizadorContext';
import RouteMap from '../RouteMap';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

interface OSComCoordenadas {
  id: string;
  numero_os: string;
  lat: number;
  lng: number;
  rota: string;
  tipo_atendimento: 'IH' | 'CI';
  cliente_nome: string;
  endereco_completo: string;
  cidade: string;
  coluna_kanban: string;
  prioridade: string | null;
  tecnico_responsavel?: string;
  tecnico_responsavel_id?: string;
  data_agendamento?: string;
  periodo_agendamento?: string;
}

interface Filtros {
  dataInicio: string;
  dataFim: string;
  tecnicoId: string;
  status: string;
  rotaId: string;
  prioridade: string;
  tipoAtendimento: string;
  busca: string;
}

interface Tecnico {
  id: string;
  nome: string;
}

export default function MapaInteligente() {
  const { selectedUnidade } = useOtimizador();
  const [osWithCoords, setOsWithCoords] = useState<OSComCoordenadas[]>([]);
  const [osFiltradas, setOsFiltradas] = useState<OSComCoordenadas[]>([]);
  const [totalSemCoords, setTotalSemCoords] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [rotas, setRotas] = useState<string[]>([]);
  const [selectedOS, setSelectedOS] = useState<OSComCoordenadas | null>(null);

  const [filtros, setFiltros] = useState<Filtros>({
    dataInicio: '',
    dataFim: '',
    tecnicoId: '',
    status: '',
    rotaId: '',
    prioridade: '',
    tipoAtendimento: 'IH',
    busca: ''
  });

  useEffect(() => {
    if (selectedUnidade) {
      loadOSsComCoordenadas();
      loadTecnicos();
      loadRotas();
    }
  }, [selectedUnidade]);

  useEffect(() => {
    aplicarFiltros();
  }, [osWithCoords, filtros]);

  const loadOSsComCoordenadas = async () => {
    setLoading(true);
    try {
      const { data: osComCoords, error: errorComCoords } = await supabase
        .from('os')
        .select(`
          id,
          numero_os_samsung,
          numero_os_interna,
          lat,
          lng,
          tipo_atendimento,
          cliente_nome,
          cliente_logradouro,
          cliente_numero,
          cliente_bairro,
          cliente_cidade,
          rota_id,
          coluna_kanban,
          prioridade,
          tecnico_responsavel_id,
          data_agendamento,
          periodo_agendamento,
          usuarios:tecnico_responsavel_id(nome)
        `)
        .eq('unidade_id', selectedUnidade)
        .not('lat', 'is', null)
        .not('lng', 'is', null);

      if (errorComCoords) throw errorComCoords;

      const { count: semCoords } = await supabase
        .from('os')
        .select('id', { count: 'exact', head: true })
        .eq('unidade_id', selectedUnidade)
        .or('lat.is.null,lng.is.null');

      const formatted: OSComCoordenadas[] = (osComCoords || []).map((os: any) => ({
        id: os.id,
        numero_os: os.numero_os_samsung || os.numero_os_interna || 'S/N',
        lat: parseFloat(os.lat!),
        lng: parseFloat(os.lng!),
        rota: os.rota_id || 'Sem rota',
        tipo_atendimento: os.tipo_atendimento as 'IH' | 'CI',
        cliente_nome: os.cliente_nome || '',
        endereco_completo: `${os.cliente_logradouro || ''}, ${os.cliente_numero || ''} - ${os.cliente_bairro || ''}`,
        cidade: os.cliente_cidade || '',
        coluna_kanban: os.coluna_kanban || '',
        prioridade: os.prioridade,
        tecnico_responsavel: os.usuarios?.nome || null,
        tecnico_responsavel_id: os.tecnico_responsavel_id,
        data_agendamento: os.data_agendamento,
        periodo_agendamento: os.periodo_agendamento
      }));

      setOsWithCoords(formatted);
      setTotalSemCoords(semCoords || 0);
    } catch (error) {
      console.error('Erro ao carregar OSs com coordenadas:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadTecnicos = async () => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome')
        .eq('unidade_id', selectedUnidade)
        .eq('funcao', 'tecnico')
        .order('nome');

      if (error) throw error;
      setTecnicos(data || []);
    } catch (error) {
      console.error('Erro ao carregar técnicos:', error);
    }
  };

  const loadRotas = async () => {
    try {
      const { data, error } = await supabase
        .from('rotas')
        .select('id, nome')
        .eq('unidade_id', selectedUnidade)
        .order('nome');

      if (error) throw error;
      setRotas(data?.map((r: any) => r.nome) || []);
    } catch (error) {
      console.error('Erro ao carregar rotas:', error);
    }
  };

  const aplicarFiltros = () => {
    let resultado = [...osWithCoords];

    if (filtros.busca) {
      const busca = filtros.busca.toLowerCase();
      resultado = resultado.filter(os =>
        os.numero_os.toLowerCase().includes(busca) ||
        os.cliente_nome.toLowerCase().includes(busca)
      );
    }

    if (filtros.tecnicoId) {
      resultado = resultado.filter(os => os.tecnico_responsavel_id === filtros.tecnicoId);
    }

    if (filtros.status) {
      resultado = resultado.filter(os => os.coluna_kanban === filtros.status);
    }

    if (filtros.rotaId) {
      resultado = resultado.filter(os => os.rota === filtros.rotaId);
    }

    if (filtros.prioridade) {
      resultado = resultado.filter(os => os.prioridade === filtros.prioridade);
    }

    if (filtros.tipoAtendimento) {
      resultado = resultado.filter(os => os.tipo_atendimento === filtros.tipoAtendimento);
    }

    if (filtros.dataInicio) {
      resultado = resultado.filter(os => {
        if (!os.data_agendamento) return false;
        return new Date(os.data_agendamento) >= new Date(filtros.dataInicio);
      });
    }

    if (filtros.dataFim) {
      resultado = resultado.filter(os => {
        if (!os.data_agendamento) return false;
        return new Date(os.data_agendamento) <= new Date(filtros.dataFim);
      });
    }

    setOsFiltradas(resultado);
  };

  const limparFiltros = () => {
    setFiltros({
      dataInicio: '',
      dataFim: '',
      tecnicoId: '',
      status: '',
      rotaId: '',
      prioridade: '',
      tipoAtendimento: 'IH',
      busca: ''
    });
  };

  const calcularEstatisticas = () => {
    const total = osFiltradas.length;
    const pendentes = osFiltradas.filter(os =>
      os.coluna_kanban === 'pendente' || os.coluna_kanban === 'aguardando_peca'
    ).length;
    const emAndamento = osFiltradas.filter(os =>
      os.coluna_kanban === 'em_andamento' || os.coluna_kanban === 'em_rota'
    ).length;
    const concluidas = osFiltradas.filter(os =>
      os.coluna_kanban === 'concluida'
    ).length;

    return { total, pendentes, emAndamento, concluidas };
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="futuristic-loader"></div>
      </div>
    );
  }

  const estatisticas = calcularEstatisticas();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600">
            Mapa Inteligente
          </h2>
          <p className="text-gray-400 mt-1">Visualização geográfica com filtros avançados</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
              showFilters
                ? 'bg-cyan-500/30 border-cyan-500/50 text-cyan-400'
                : 'bg-gray-800/50 border-gray-700 text-gray-400 hover:bg-gray-800'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Filtros</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-blue-300 text-sm font-medium">Total de OSs</p>
              <p className="text-3xl font-bold text-white mt-1">{estatisticas.total}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500/20 to-yellow-600/20 border border-yellow-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-yellow-300 text-sm font-medium">Pendentes</p>
              <p className="text-3xl font-bold text-white mt-1">{estatisticas.pendentes}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-orange-500/20 to-orange-600/20 border border-orange-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-orange-300 text-sm font-medium">Em Andamento</p>
              <p className="text-3xl font-bold text-white mt-1">{estatisticas.emAndamento}</p>
            </div>
            <Navigation className="w-8 h-8 text-orange-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-green-300 text-sm font-medium">Concluídas</p>
              <p className="text-3xl font-bold text-white mt-1">{estatisticas.concluidas}</p>
            </div>
            <MapPin className="w-8 h-8 text-green-400 opacity-50" />
          </div>
        </div>
      </div>

      {showFilters && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2">
              <Filter className="w-5 h-5 text-cyan-400" />
              Filtros Avançados
            </h3>
            <button
              onClick={limparFiltros}
              className="flex items-center gap-2 px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-lg hover:bg-red-500/30 transition-colors text-red-400 text-sm"
            >
              <X className="w-4 h-4" />
              Limpar
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Search className="w-4 h-4 inline mr-1" />
                Buscar OS ou Cliente
              </label>
              <input
                type="text"
                value={filtros.busca}
                onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
                placeholder="Número ou nome..."
                className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Data Início
              </label>
              <input
                type="date"
                value={filtros.dataInicio}
                onChange={(e) => setFiltros({ ...filtros, dataInicio: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Data Fim
              </label>
              <input
                type="date"
                value={filtros.dataFim}
                onChange={(e) => setFiltros({ ...filtros, dataFim: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <User className="w-4 h-4 inline mr-1" />
                Técnico
              </label>
              <select
                value={filtros.tecnicoId}
                onChange={(e) => setFiltros({ ...filtros, tecnicoId: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value="">Todos</option>
                {tecnicos.map((tec) => (
                  <option key={tec.id} value={tec.id}>{tec.nome}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Status</label>
              <select
                value={filtros.status}
                onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value="">Todos</option>
                <option value="pendente">Pendente</option>
                <option value="em_andamento">Em Andamento</option>
                <option value="em_rota">Em Rota</option>
                <option value="aguardando_peca">Aguardando Peça</option>
                <option value="concluida">Concluída</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                <AlertCircle className="w-4 h-4 inline mr-1" />
                Prioridade
              </label>
              <select
                value={filtros.prioridade}
                onChange={(e) => setFiltros({ ...filtros, prioridade: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value="">Todas</option>
                <option value="alta">Alta</option>
                <option value="media">Média</option>
                <option value="baixa">Baixa</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Tipo Atendimento</label>
              <select
                value={filtros.tipoAtendimento}
                onChange={(e) => setFiltros({ ...filtros, tipoAtendimento: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value="">Todos</option>
                <option value="IH">IH - In Home</option>
                <option value="CI">CI - Carry In</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Rota</label>
              <select
                value={filtros.rotaId}
                onChange={(e) => setFiltros({ ...filtros, rotaId: e.target.value })}
                className="w-full px-3 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:border-cyan-500 focus:outline-none"
              >
                <option value="">Todas</option>
                {rotas.map((rota) => (
                  <option key={rota} value={rota}>{rota}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="mt-4 flex items-center justify-between">
            <p className="text-sm text-gray-400">
              Mostrando <span className="text-cyan-400 font-bold">{osFiltradas.length}</span> de <span className="text-white font-bold">{osWithCoords.length}</span> OSs
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <div className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden" style={{ height: '600px' }}>
            {osFiltradas.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center p-8">
                  <MapPin className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                  <p className="text-gray-400 text-lg">Nenhuma OS encontrada com os filtros aplicados</p>
                  <p className="text-gray-500 text-sm mt-2">Ajuste os filtros ou limpe-os para ver mais resultados</p>
                </div>
              </div>
            ) : (
              <RouteMap
                osMarkers={osFiltradas}
                selectedRota={undefined}
                baseLocation={undefined}
              />
            )}
          </div>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-4 max-h-[600px] overflow-y-auto">
          <div className="flex items-center gap-3 mb-4 sticky top-0 bg-gray-800/50 pb-2">
            <MapPin className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-bold text-white">OSs no Mapa</h3>
          </div>

          {osFiltradas.length === 0 ? (
            <div className="text-center py-8">
              <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Nenhuma OS para exibir</p>
            </div>
          ) : (
            <div className="space-y-2">
              {osFiltradas.map((os) => (
                <div
                  key={os.id}
                  onClick={() => setSelectedOS(os)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedOS?.id === os.id
                      ? 'bg-cyan-500/20 border-cyan-500/50'
                      : 'bg-gray-700/30 border-gray-700/50 hover:bg-gray-700/50'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <p className="text-white font-bold text-sm">{os.numero_os}</p>
                    {os.prioridade === 'alta' && (
                      <span className="px-2 py-0.5 bg-red-500/20 border border-red-500/30 rounded text-xs text-red-400">
                        Alta
                      </span>
                    )}
                  </div>
                  <p className="text-gray-300 text-xs mb-1">{os.cliente_nome}</p>
                  <p className="text-gray-400 text-xs mb-2">{os.endereco_completo}</p>
                  {os.tecnico_responsavel && (
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <User className="w-3 h-3" />
                      <span>{os.tecnico_responsavel}</span>
                    </div>
                  )}
                  {os.data_agendamento && (
                    <div className="flex items-center gap-1 text-xs text-gray-400 mt-1">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(os.data_agendamento).toLocaleDateString('pt-BR')}</span>
                      {os.periodo_agendamento && <span>({os.periodo_agendamento})</span>}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="mt-4 pt-4 border-t border-gray-700">
            <h4 className="text-white font-bold text-sm mb-3">Por Cidade</h4>
            {Object.entries(
              osFiltradas.reduce((acc, os) => {
                const cidade = os.cidade || 'Não informado';
                acc[cidade] = (acc[cidade] || 0) + 1;
                return acc;
              }, {} as Record<string, number>)
            )
              .sort((a, b) => b[1] - a[1])
              .slice(0, 5)
              .map(([cidade, count]) => (
                <div key={cidade} className="flex items-center justify-between p-2 bg-gray-700/30 rounded mb-1">
                  <span className="text-gray-300 text-xs">{cidade}</span>
                  <span className="text-cyan-400 font-bold text-xs">{count}</span>
                </div>
              ))}
          </div>

          {totalSemCoords > 0 && (
            <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
              <p className="text-yellow-400 text-xs">
                <AlertCircle className="w-3 h-3 inline mr-1" />
                {totalSemCoords} OSs sem coordenadas
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
