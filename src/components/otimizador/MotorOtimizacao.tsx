import { useState, useEffect } from 'react';
import {
  Zap,
  MapPin,
  Play,
  Settings,
  Check,
  AlertCircle,
  Users,
  Clock,
  TrendingDown,
  Navigation,
  RotateCcw,
  Save,
  X,
  ChevronUp,
  ChevronDown,
  Trash2,
  Plus,
  Calendar,
} from 'lucide-react';
import { useOtimizador } from '../../contexts/OtimizadorContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import RouteMapViewer from './RouteMapViewerAdapter';
import RouteDetailsPanel from './RouteDetailsPanel';
import ManualSequenceEditor from './ManualSequenceEditor';
import ExcludedOSPanel from './ExcludedOSPanel';
import TripSummary from './TripSummary';
import { otimizarRotaInteligente, aplicarOtimizacao, recalcularRotaComNovaOrdem } from '../../lib/atomRouteOptimizer';
import { geocodeAddress, geocodeFromCEPAndNumber } from '../../lib/geocoding';

interface RouteOption {
  coluna_kanban: string;
  nome: string;
  cor: string;
  count: number;
}

interface OSParaOtimizar {
  id: string;
  numero_os: string;
  cliente_nome: string;
  endereco_completo: string;
  cidade: string;
  lat: number | null;
  lng: number | null;
  tipo_atendimento: string;
  prioridade: string;
  tempo_estimado: number;
  coluna_kanban: string;
}

interface Tecnico {
  id: string;
  nome: string;
}

interface UnidadeConfig {
  latitude: number | null;
  longitude: number | null;
  endereco_base: string | null;
  tempo_medio_ih: number;
  horario_inicio: string;
  horario_fim: string;
  duracao_almoco: number;
}

export default function MotorOtimizacao() {
  const { selectedUnidade, loading } = useOtimizador();
  const { user } = useAuth();

  const [routeOptions, setRouteOptions] = useState<RouteOption[]>([]);
  const [selectedRoutes, setSelectedRoutes] = useState<string[]>([]);
  const [tecnicos, setTecnicos] = useState<Tecnico[]>([]);
  const [selectedTecnico, setSelectedTecnico] = useState<string>('');
  const [unidadeConfig, setUnidadeConfig] = useState<UnidadeConfig | null>(null);

  const [osParaOtimizar, setOsParaOtimizar] = useState<OSParaOtimizar[]>([]);
  const [osExcluidas, setOsExcluidas] = useState<any[]>([]);
  const [rotaOtimizada, setRotaOtimizada] = useState<any | null>(null);
  const [rotaOriginal, setRotaOriginal] = useState<any | null>(null);
  const [isRotaModificada, setIsRotaModificada] = useState(false);

  const [loadingData, setLoadingData] = useState(false);
  const [otimizando, setOtimizando] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [geocodificando, setGeocodificando] = useState(false);
  const [recalculando, setRecalculando] = useState(false);

  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState({
    velocidade_media_kmh: 40,
    considerar_prioridade: true,
  });

  useEffect(() => {
    if (selectedUnidade) {
      loadInitialData();
    }
  }, [selectedUnidade]);

  const loadInitialData = async () => {
    setLoadingData(true);
    try {
      await Promise.all([loadRouteOptions(), loadTecnicos(), loadUnidadeConfig()]);
    } catch (error) {
    } finally {
      setLoadingData(false);
    }
  };

  const loadRouteOptions = async () => {
    const { data: rotas } = await supabase
      .from('rotas')
      .select('coluna_kanban, nome, cor')
      .eq('unidade_id', selectedUnidade)
      .eq('ativa', true)
      .order('nome');

    if (rotas) {
      const routeOptionsWithCount = await Promise.all(
        rotas.map(async (rota) => {
          const { count } = await supabase
            .from('os')
            .select('id', { count: 'exact', head: true })
            .eq('unidade_id', selectedUnidade)
            .eq('coluna_kanban', rota.coluna_kanban)
            .eq('tipo_atendimento', 'IH');

          return {
            coluna_kanban: rota.coluna_kanban,
            nome: rota.nome,
            cor: rota.cor,
            count: count || 0,
          };
        })
      );

      setRouteOptions(routeOptionsWithCount);
    }
  };

  const loadTecnicos = async () => {
    const { data } = await supabase
      .from('usuarios')
      .select('id, nome')
      .eq('unidade_id', selectedUnidade)
      .in('tipo', ['tecnico', 'tecnico_ih'])
      .eq('ativo', true)
      .order('nome');

    if (data) {
      setTecnicos(data);
    }
  };

  const loadUnidadeConfig = async () => {
    const { data: unidade } = await supabase
      .from('unidades')
      .select('latitude, longitude, endereco, cidade, estado')
      .eq('id', selectedUnidade)
      .single();

    const { data: config } = await supabase
      .from('configuracoes_unidade')
      .select('tempo_medio_ih, horario_inicio, horario_fim, duracao_almoco')
      .eq('unidade_id', selectedUnidade)
      .single();

    if (unidade && config) {
      let latitude = unidade.latitude;
      let longitude = unidade.longitude;
      let enderecoBase = unidade.endereco;

      if ((!latitude || !longitude) && enderecoBase) {
        setGeocodificando(true);
        try {
          const fullAddress = `${enderecoBase}, ${unidade.cidade}, ${unidade.estado}, Brasil`;

          const geocoded = await geocodeAddress(fullAddress);

          if (geocoded) {
            latitude = geocoded.lat;
            longitude = geocoded.lng;

            await supabase
              .from('unidades')
              .update({
                latitude: latitude,
                longitude: longitude,
              })
              .eq('id', selectedUnidade);

          }
        } catch (error) {
        } finally {
          setGeocodificando(false);
        }
      }

      setUnidadeConfig({
        latitude: latitude,
        longitude: longitude,
        endereco_base: enderecoBase,
        tempo_medio_ih: config.tempo_medio_ih,
        horario_inicio: config.horario_inicio,
        horario_fim: config.horario_fim,
        duracao_almoco: config.duracao_almoco,
      });
    }
  };

  const loadOsParaOtimizar = async () => {
    if (selectedRoutes.length === 0) {
      alert('Selecione pelo menos uma rota para otimizar');
      return false;
    }

    if (!selectedTecnico) {
      alert('Selecione um técnico para a rota');
      return false;
    }

    if (!unidadeConfig?.latitude || !unidadeConfig?.longitude) {
      alert('Unidade não possui coordenadas cadastradas. Configure em Configurações > Unidade');
      return false;
    }

    setLoadingData(true);
    try {
      const { data } = await supabase
        .from('os')
        .select(`
          id,
          numero_os_samsung,
          numero_os_interna,
          cliente_nome,
          cliente_endereco,
          cliente_bairro,
          cliente_cidade,
          cliente_cep,
          tipo_atendimento,
          prioridade,
          coluna_kanban,
          lat,
          lng,
          agendamentos(lat, lng)
        `)
        .eq('unidade_id', selectedUnidade)
        .in('coluna_kanban', selectedRoutes)
        .eq('tipo_atendimento', 'IH')
        .order('created_at');

      if (!data || data.length === 0) {
        alert('Nenhuma OS IH encontrada nas rotas selecionadas');
        return false;
      }

      const osComCoords: OSParaOtimizar[] = [];
      const osExcluidasTemp: any[] = [];

      for (const os of data) {
        const agendamento = os.agendamentos?.[0];
        const numeroOS = os.numero_os_samsung || os.numero_os_interna;
        const enderecoCompleto = `${os.cliente_endereco || ''}, ${os.cliente_bairro || ''}, ${os.cliente_cidade || ''}`.trim();

        let osLat = os.lat;
        let osLng = os.lng;

        if (!osLat || !osLng) {
          osLat = agendamento?.lat;
          osLng = agendamento?.lng;
        }

        if (!osLat || !osLng) {
          osExcluidasTemp.push({
            id: os.id,
            numero_os: numeroOS,
            cliente_nome: os.cliente_nome,
            endereco: enderecoCompleto,
            cep: os.cliente_cep,
            motivo: 'OS sem coordenadas GPS',
            sugestao: 'Use o botão "Geocodificar OSs" para obter coordenadas automaticamente',
          });
          continue;
        }

        osComCoords.push({
          id: os.id,
          numero_os: numeroOS,
          cliente_nome: os.cliente_nome,
          endereco_completo: enderecoCompleto,
          cidade: os.cliente_cidade || '',
          lat: osLat,
          lng: osLng,
          tipo_atendimento: os.tipo_atendimento,
          prioridade: os.prioridade || 'normal',
          tempo_estimado: unidadeConfig!.tempo_medio_ih,
          coluna_kanban: os.coluna_kanban,
        });
      }

      if (osComCoords.length === 0) {
        alert('Nenhuma OS com coordenadas válidas encontrada. Use o botão "Geocodificar OSs" para obter coordenadas.');
        return false;
      }

      setOsParaOtimizar(osComCoords);
      setOsExcluidas(osExcluidasTemp);
      return true;
    } catch (error) {
      alert('Erro ao carregar OSs para otimização');
      return false;
    } finally {
      setLoadingData(false);
    }
  };

  const geocodificarOsSemCoordenadas = async () => {
    if (!confirm('Isso irá geocodificar todas as OSs IH que possuem endereço mas não têm coordenadas. Pode levar alguns minutos. Continuar?')) {
      return;
    }

    setGeocodificando(true);
    try {
      const { data: osSemCoords } = await supabase
        .from('os')
        .select('id, numero_os_samsung, numero_os_interna, cliente_nome, cliente_cep, cliente_endereco, cliente_bairro, cliente_cidade')
        .eq('unidade_id', selectedUnidade)
        .eq('tipo_atendimento', 'IH')
        .is('lat', null)
        .not('cliente_cep', 'is', null);

      if (!osSemCoords || osSemCoords.length === 0) {
        alert('Nenhuma OS encontrada para geocodificar');
        return;
      }

      let geocodificadas = 0;
      let falhas = 0;

      for (const os of osSemCoords) {
        try {
          await new Promise(resolve => setTimeout(resolve, 1100));

          let coords = null;

          const enderecoNumero = os.cliente_endereco?.match(/\d+/)?.[0];
          if (os.cliente_cep && enderecoNumero) {
            const result = await geocodeFromCEPAndNumber(os.cliente_cep, enderecoNumero);
            if (result) {
              coords = { lat: result.lat, lng: result.lng };
            }
          }

          if (!coords && os.cliente_endereco) {
            const enderecoCompleto = `${os.cliente_endereco}, ${os.cliente_bairro || ''}, ${os.cliente_cidade || ''}, Brasil`;
            const result = await geocodeAddress(enderecoCompleto);
            if (result) {
              coords = { lat: result.lat, lng: result.lng };
            }
          }

          if (coords) {
            await supabase
              .from('os')
              .update({ lat: coords.lat, lng: coords.lng })
              .eq('id', os.id);

            geocodificadas++;
          } else {
            falhas++;
          }
        } catch (error) {
          falhas++;
        }
      }

      alert(`Geocodificação concluída!\n\n✓ Geocodificadas: ${geocodificadas}\n✗ Falhas: ${falhas}`);

      if (geocodificadas > 0) {
        await loadOsParaOtimizar();
      }
    } catch (error) {
      alert('Erro ao geocodificar OSs. Veja o console para detalhes.');
    } finally {
      setGeocodificando(false);
    }
  };

  const executarOtimizacao = async () => {
    const osLoaded = await loadOsParaOtimizar();
    if (!osLoaded) return;

    if (!user?.id) {
      alert('Usuário não autenticado');
      return;
    }

    setOtimizando(true);
    try {
      const resultado = await otimizarRotaInteligente(
        selectedUnidade!,
        selectedTecnico,
        selectedRoutes,
        user.id
      );

      setRotaOtimizada(resultado);
      setRotaOriginal(JSON.parse(JSON.stringify(resultado)));
      setIsRotaModificada(false);
      alert(`Otimização concluída! ${resultado.os_incluidas.length} OSs na rota otimizada.`);
    } catch (error: any) {
      alert(error.message || 'Erro ao otimizar rota');
    } finally {
      setOtimizando(false);
    }
  };

  const aplicarRotaOtimizada = async () => {
    if (!rotaOtimizada || !selectedTecnico || !selectedUnidade) return;

    if (!confirm('Deseja aplicar esta rota otimizada? As OSs receberão a ordem de visita calculada.')) {
      return;
    }

    setAplicando(true);
    try {
      const sucesso = await aplicarOtimizacao(rotaOtimizada.otimizacao_id);

      if (sucesso) {
        const rotasNomes = selectedRoutes.map(r => {
          const rota = routeOptions.find(ro => ro.coluna_kanban === r);
          return rota?.nome || r;
        }).join(', ');

        const nomeRota = `Rota ${rotasNomes} - ${new Date().toLocaleDateString('pt-BR')}`;

        const { error: saveError } = await supabase
          .from('rotas_otimizadas')
          .insert({
            unidade_id: selectedUnidade,
            tecnico_id: selectedTecnico,
            otimizacao_log_id: rotaOtimizada.otimizacao_id,
            nome: nomeRota,
            data_aplicacao: new Date().toISOString(),
            status: 'aplicada',
            metricas: rotaOtimizada.metricas,
            os_incluidas: rotaOtimizada.os_incluidas.map((os: any) => ({
              os_id: os.os_id,
              numero_os: os.numero_os,
              ordem_visita: os.ordem_visita,
              horario_chegada: os.horario_chegada,
              horario_conclusao: os.horario_conclusao,
              distancia_anterior_km: os.distancia_anterior_km,
              cliente_nome: os.cliente_nome,
              endereco: os.endereco,
              lat: os.lat,
              lng: os.lng
            })),
            polyline: rotaOtimizada.polyline || null,
            cor_rota: '#2563eb'
          });

        if (saveError) {
        } else {
        }

        alert('Rota aplicada com sucesso! As OSs foram atualizadas com a ordem de visita.');
        resetOptimization();
        loadRouteOptions();
      } else {
        alert('Erro ao aplicar rota');
      }
    } catch (error) {
      alert('Erro ao aplicar rota otimizada');
    } finally {
      setAplicando(false);
    }
  };

  const resetOptimization = () => {
    setRotaOtimizada(null);
    setRotaOriginal(null);
    setOsParaOtimizar([]);
    setOsExcluidas([]);
    setIsRotaModificada(false);
  };

  const handleReorderOS = async (newOrder: any[]) => {
    if (!rotaOtimizada || !selectedTecnico) return;

    setRecalculando(true);
    try {
      const { data: tecnico } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', selectedTecnico)
        .single();

      if (!tecnico) return;

      const resultado = await recalcularRotaComNovaOrdem(
        newOrder,
        rotaOtimizada.pontoBase,
        tecnico
      );

      setRotaOtimizada({
        ...rotaOtimizada,
        os_incluidas: resultado.os_incluidas,
        metricas: resultado.metricas,
        avisos: resultado.avisos,
        polyline: resultado.polyline
      });
      setIsRotaModificada(true);
    } catch (error) {
      alert('Erro ao recalcular rota');
    } finally {
      setRecalculando(false);
    }
  };

  const handleRemoveOS = async (osId: string) => {
    if (!rotaOtimizada || !selectedTecnico) return;

    if (!confirm('Deseja remover esta OS da rota otimizada?')) return;

    setRecalculando(true);
    try {
      const novasOSs = rotaOtimizada.os_incluidas.filter((os: any) => os.os_id !== osId);

      if (novasOSs.length === 0) {
        setRotaOtimizada(null);
        setRotaOriginal(null);
        setIsRotaModificada(false);
        return;
      }

      const { data: tecnico } = await supabase
        .from('usuarios')
        .select('*')
        .eq('id', selectedTecnico)
        .single();

      if (!tecnico) return;

      const resultado = await recalcularRotaComNovaOrdem(
        novasOSs,
        rotaOtimizada.pontoBase,
        tecnico
      );

      setRotaOtimizada({
        ...rotaOtimizada,
        os_incluidas: resultado.os_incluidas,
        metricas: resultado.metricas,
        avisos: resultado.avisos,
        polyline: resultado.polyline
      });
      setIsRotaModificada(true);
    } catch (error) {
      alert('Erro ao remover OS da rota');
    } finally {
      setRecalculando(false);
    }
  };

  const handleRestoreOriginal = () => {
    if (!rotaOriginal) return;
    setRotaOtimizada(JSON.parse(JSON.stringify(rotaOriginal)));
    setIsRotaModificada(false);
  };

  const toggleRouteSelection = (coluna: string) => {
    setSelectedRoutes((prev) =>
      prev.includes(coluna) ? prev.filter((c) => c !== coluna) : [...prev, coluna]
    );
  };

  if (loadingData || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="futuristic-loader"></div>
      </div>
    );
  }

  const totalOsSelected = routeOptions
    .filter((r) => selectedRoutes.includes(r.coluna_kanban))
    .reduce((sum, r) => sum + r.count, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600 flex items-center gap-3">
            <Zap className="w-8 h-8 text-cyan-400 animate-pulse" />
            Otimizador de Rotas IH
          </h2>
          <p className="text-gray-400 mt-1">Sistema completo de otimização logística com algoritmo TSP</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-700/50 hover:bg-gray-700 border border-gray-600 rounded-lg transition-colors"
          >
            <Settings className="w-5 h-5 text-gray-300" />
            <span className="text-gray-300">Config</span>
          </button>

          <button
            onClick={geocodificarOsSemCoordenadas}
            disabled={geocodificando}
            className="flex items-center gap-2 px-4 py-2 bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 rounded-lg text-purple-400 transition-colors disabled:opacity-50"
          >
            <MapPin className="w-5 h-5" />
            <span>{geocodificando ? 'Geocodificando...' : 'Geocodificar OSs'}</span>
          </button>

          {rotaOtimizada ? (
            <>
              <button
                onClick={resetOptimization}
                className="flex items-center gap-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-400 transition-colors"
              >
                <RotateCcw className="w-5 h-5" />
                Recalcular
              </button>
              <button
                onClick={aplicarRotaOtimizada}
                disabled={aplicando}
                className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 rounded-lg text-white font-medium transition-all disabled:opacity-50"
              >
                <Check className="w-5 h-5" />
                {aplicando ? 'Aplicando...' : 'Aplicar Rota'}
              </button>
            </>
          ) : (
            <button
              onClick={executarOtimizacao}
              disabled={otimizando || selectedRoutes.length === 0 || !selectedTecnico}
              className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-600 hover:to-blue-700 rounded-lg text-white font-medium transition-all disabled:opacity-50"
            >
              <Play className="w-5 h-5" />
              {otimizando ? 'Otimizando...' : 'Otimizar Rota'}
            </button>
          )}
        </div>
      </div>

      {showConfig && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <h3 className="text-xl font-bold text-white mb-4">Configurações Avançadas</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Velocidade Média (km/h)</label>
              <input
                type="number"
                value={config.velocidade_media_kmh}
                onChange={(e) => setConfig({ ...config, velocidade_media_kmh: Number(e.target.value) })}
                className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
                min="20"
                max="80"
              />
            </div>
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Considerar Prioridade</label>
              <select
                value={config.considerar_prioridade ? 'sim' : 'nao'}
                onChange={(e) => setConfig({ ...config, considerar_prioridade: e.target.value === 'sim' })}
                className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="sim">Sim</option>
                <option value="nao">Não</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {geocodificando && (
        <div className="bg-purple-500/10 border border-purple-500/30 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <div className="futuristic-loader w-6 h-6"></div>
            <div>
              <p className="text-purple-400 font-medium">Geocodificando OSs...</p>
              <p className="text-purple-300 text-sm mt-1">
                Obtendo coordenadas GPS dos endereços. Isso pode levar alguns minutos dependendo da quantidade de OSs.
              </p>
            </div>
          </div>
        </div>
      )}

      {!geocodificando && (!unidadeConfig?.latitude || !unidadeConfig?.longitude) && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-6">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-6 h-6 text-yellow-400" />
            <div>
              <p className="text-yellow-400 font-medium">Unidade sem coordenadas base cadastradas</p>
              <p className="text-yellow-500 text-sm mt-1">
                Configure as coordenadas da base em Configurações da Unidade para habilitar a otimização de rotas.
                {unidadeConfig?.endereco_base && ' O sistema tentará geocodificar automaticamente o endereço cadastrado.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {!geocodificando && unidadeConfig?.latitude && unidadeConfig?.longitude && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <MapPin className="w-5 h-5 text-cyan-400" />
                Selecionar Rotas do Kanban
              </h3>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {routeOptions.map((route) => (
                  <label
                    key={route.coluna_kanban}
                    className={`flex items-center gap-3 p-4 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedRoutes.includes(route.coluna_kanban)
                        ? 'bg-cyan-500/10 border-cyan-500/50'
                        : 'bg-gray-700/30 border-gray-600 hover:border-gray-500'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedRoutes.includes(route.coluna_kanban)}
                      onChange={() => toggleRouteSelection(route.coluna_kanban)}
                      className="w-5 h-5"
                    />
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: route.cor }}></div>
                    <span className="text-white font-medium flex-1">{route.nome}</span>
                    <span className="px-3 py-1 bg-blue-500/20 border border-blue-500/30 rounded-full text-blue-400 text-sm">
                      {route.count} OSs
                    </span>
                  </label>
                ))}
              </div>
              {selectedRoutes.length > 0 && (
                <div className="mt-4 p-4 bg-cyan-500/10 border border-cyan-500/30 rounded-lg">
                  <p className="text-cyan-400 text-sm">
                    <strong>{selectedRoutes.length}</strong> rotas selecionadas com <strong>{totalOsSelected}</strong> OSs IH no total
                  </p>
                </div>
              )}
            </div>

            <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
              <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-400" />
                Selecionar Técnico
              </h3>
              <select
                value={selectedTecnico}
                onChange={(e) => setSelectedTecnico(e.target.value)}
                className="w-full px-4 py-3 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500 text-lg"
              >
                <option value="">-- Selecione um técnico --</option>
                {tecnicos.map((tec) => (
                  <option key={tec.id} value={tec.id}>
                    {tec.nome}
                  </option>
                ))}
              </select>

              {selectedTecnico && unidadeConfig && (
                <div className="mt-6 space-y-3">
                  <div className="p-4 bg-gray-700/30 border border-gray-600 rounded-lg">
                    <p className="text-gray-400 text-xs mb-1">Jornada de Trabalho</p>
                    <p className="text-white text-lg font-bold">
                      {unidadeConfig.horario_inicio} - {unidadeConfig.horario_fim}
                    </p>
                  </div>
                  <div className="p-4 bg-gray-700/30 border border-gray-600 rounded-lg">
                    <p className="text-gray-400 text-xs mb-1">Tempo Médio Atendimento</p>
                    <p className="text-white text-lg font-bold">
                      {unidadeConfig.tempo_medio_ih}min
                    </p>
                  </div>
                  <div className="p-4 bg-gray-700/30 border border-gray-600 rounded-lg">
                    <p className="text-gray-400 text-xs mb-1">Base da Unidade</p>
                    <p className="text-white text-sm">{unidadeConfig.endereco_base || 'Endereço não cadastrado'}</p>
                    <p className="text-gray-400 text-xs mt-1">
                      Lat: {unidadeConfig.latitude?.toFixed(6)} / Lng: {unidadeConfig.longitude?.toFixed(6)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {rotaOtimizada && (
            <>
              {recalculando && (
                <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-xl p-6">
                  <div className="flex items-center gap-3">
                    <div className="futuristic-loader w-6 h-6"></div>
                    <p className="text-cyan-400 font-medium">Recalculando rota...</p>
                  </div>
                </div>
              )}

              <TripSummary
                rota={rotaOtimizada}
                pontoBase={rotaOtimizada.pontoBase}
              />

              <RouteMapViewer
                rota={rotaOtimizada}
                unidadeConfig={unidadeConfig}
              />

              <ManualSequenceEditor
                osIncluidas={rotaOtimizada.os_incluidas}
                onReorder={handleReorderOS}
                onRemoveOS={handleRemoveOS}
                onRestoreOriginal={handleRestoreOriginal}
                isModified={isRotaModificada}
              />

              <RouteDetailsPanel rota={rotaOtimizada} />

              {osExcluidas.length > 0 && <ExcludedOSPanel osExcluidas={osExcluidas} />}
            </>
          )}
        </>
      )}
    </div>
  );
}
