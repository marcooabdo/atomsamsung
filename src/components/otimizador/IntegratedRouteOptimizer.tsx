import { useState, useEffect, useCallback } from 'react';
import { Play, RefreshCw, AlertCircle, MapPin, Users, CheckCircle2, Clock, Send, Trash2, Plus, ArrowRight, ChevronDown, ChevronUp, Route } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  type OSLogistica,
  type RotaColuna,
  type TecnicoLogistica,
  buscarRotasColuna,
  buscarTecnicosLogistica,
  buscarOSsDaRota,
  geocodificarOSLogistica,
  tecnicoAtendeLinha,
  filtrarPorJanelaTempo,
  salvarRotaRascunho,
  confirmarRotaEAgendar,
} from '../../lib/giaLogisticsService';
import { otimizarRotaInteligente, type ResultadoOtimizacao } from '../../lib/atomRouteOptimizer';
import { GeolocalizacaoManualModal } from './GeolocalizacaoManualModal';
import { GoogleRouteMapViewer } from './GoogleRouteMapViewer';
import { RouteMetrics } from './RouteMetrics';

interface Props {
  unidadeId: string;
  usuarioId: string;
}

type Etapa = 'configurar' | 'processar' | 'roteirizar' | 'confirmar';

interface SobraItem {
  os: OSLogistica;
  motivo: 'skill' | 'tempo';
  motivoLabel: string;
}

export function IntegratedRouteOptimizer({ unidadeId, usuarioId }: Props) {
  const [etapa, setEtapa] = useState<Etapa>('configurar');
  const [rotas, setRotas] = useState<RotaColuna[]>([]);
  const [tecnicos, setTecnicos] = useState<TecnicoLogistica[]>([]);
  const [rotaSelecionada, setRotaSelecionada] = useState<RotaColuna | null>(null);
  const [tecnicoSelecionado, setTecnicoSelecionado] = useState<TecnicoLogistica | null>(null);
  const [dataRota, setDataRota] = useState(() => new Date().toISOString().split('T')[0]);
  const [periodoRota, setPeriodoRota] = useState('manha');
  const [osDaRota, setOsDaRota] = useState<OSLogistica[]>([]);
  const [osAprovadas, setOsAprovadas] = useState<OSLogistica[]>([]);
  const [sobras, setSobras] = useState<SobraItem[]>([]);
  const [resultadoOtimizacao, setResultadoOtimizacao] = useState<ResultadoOtimizacao | null>(null);
  const [loading, setLoading] = useState(false);
  const [buscando, setBuscando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);
  const [osSemCoords, setOsSemCoords] = useState<OSLogistica[]>([]);
  const [rotaId, setRotaId] = useState<string | null>(null);
  const [baseCoords, setBaseCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [minutosUsados, setMinutosUsados] = useState(0);
  const [minutosDisponiveis, setMinutosDisponiveis] = useState(0);

  useEffect(() => {
    carregarDados();
  }, [unidadeId]);

  const carregarDados = async () => {
    setLoading(true);
    const [rotasData, tecnicosData, unidadeData] = await Promise.all([
      buscarRotasColuna(unidadeId),
      buscarTecnicosLogistica(unidadeId),
      supabase.from('unidades').select('latitude, longitude').eq('id', unidadeId).single(),
    ]);
    setRotas(rotasData);
    setTecnicos(tecnicosData);
    if (unidadeData.data?.latitude && unidadeData.data?.longitude) {
      setBaseCoords({ lat: Number(unidadeData.data.latitude), lng: Number(unidadeData.data.longitude) });
    }
    setLoading(false);
  };

  const buscarOSs = async () => {
    if (!rotaSelecionada || !tecnicoSelecionado) return;
    setBuscando(true);
    setErro(null);
    setSucesso(null);

    const lista = await buscarOSsDaRota(unidadeId, rotaSelecionada.coluna_kanban);

    // Geocode sequentially with delay
    const listaComCoords: OSLogistica[] = [];
    const semCoords: OSLogistica[] = [];

    for (const os of lista) {
      if (os.lat && os.lng) {
        listaComCoords.push(os);
      } else {
        const coords = await geocodificarOSLogistica(os);
        if (coords) {
          await supabase.from('os').update({ lat: coords.lat, lng: coords.lng }).eq('id', os.id);
          listaComCoords.push({ ...os, lat: coords.lat, lng: coords.lng });
        } else {
          semCoords.push(os);
          listaComCoords.push(os);
        }
        await new Promise(r => setTimeout(r, 300));
      }
    }

    if (semCoords.length > 0) {
      setOsDaRota(listaComCoords);
      setOsSemCoords(semCoords);
      setBuscando(false);
      return;
    }

    aplicarFiltros(listaComCoords, tecnicoSelecionado);
    setOsDaRota(listaComCoords);
    setBuscando(false);
    setEtapa('processar');
  };

  const aplicarFiltros = (lista: OSLogistica[], tecnico: TecnicoLogistica) => {
    const sobrasSkill: SobraItem[] = [];
    const aptas: OSLogistica[] = [];

    for (const os of lista) {
      if (!tecnicoAtendeLinha(tecnico, os.aparelho_linha)) {
        sobrasSkill.push({ os, motivo: 'skill', motivoLabel: `Linha "${os.aparelho_linha || 'N/A'}" não atendida pelo técnico` });
      } else {
        aptas.push(os);
      }
    }

    const { aprovadas, sobrasHorario, minutosUsados: mu, minutosDisponiveis: md } = filtrarPorJanelaTempo(aptas, tecnico);

    const sobrasHorarioItems: SobraItem[] = sobrasHorario.map(os => ({
      os,
      motivo: 'tempo' as const,
      motivoLabel: 'Limite de horário do expediente excedido',
    }));

    setOsAprovadas(aprovadas);
    setSobras([...sobrasSkill, ...sobrasHorarioItems]);
    setMinutosUsados(mu);
    setMinutosDisponiveis(md);
  };

  const resolverGeoManual = async (resultados: { osId: string; lat: number; lng: number }[]) => {
    for (const r of resultados) {
      await supabase.from('os').update({ lat: r.lat, lng: r.lng }).eq('id', r.osId);
    }

    const listaAtualizada = osDaRota.map(os => {
      const res = resultados.find(r => r.osId === os.id);
      return res ? { ...os, lat: res.lat, lng: res.lng } : os;
    });

    setOsSemCoords([]);
    aplicarFiltros(listaAtualizada, tecnicoSelecionado!);
    setOsDaRota(listaAtualizada);
    setEtapa('processar');
  };

  const moverParaSobras = (os: OSLogistica) => {
    setOsAprovadas(prev => prev.filter(o => o.id !== os.id));
    setSobras(prev => [...prev, { os, motivo: 'tempo', motivoLabel: 'Removido manualmente' }]);
    if (tecnicoSelecionado) {
      const novaLista = osAprovadas.filter(o => o.id !== os.id);
      const { minutosUsados: mu } = filtrarPorJanelaTempo(novaLista, tecnicoSelecionado);
      setMinutosUsados(mu);
    }
  };

  const moverParaAprovadas = (item: SobraItem) => {
    setSobras(prev => prev.filter(s => s.os.id !== item.os.id));
    setOsAprovadas(prev => [...prev, item.os]);
    if (tecnicoSelecionado) {
      const novaLista = [...osAprovadas, item.os];
      const { minutosUsados: mu } = filtrarPorJanelaTempo(novaLista, tecnicoSelecionado);
      setMinutosUsados(mu);
    }
  };

  const otimizarRota = async () => {
    if (!tecnicoSelecionado || osAprovadas.length === 0) return;
    setLoading(true);
    setErro(null);
    try {
      const resultado = await otimizarRotaInteligente(
        unidadeId,
        tecnicoSelecionado.id,
        rotaSelecionada ? [rotaSelecionada.coluna_kanban] : [],
        usuarioId
      );
      setResultadoOtimizacao(resultado);
      setEtapa('roteirizar');
    } catch (e) {
      setErro('Erro ao otimizar rota: ' + (e instanceof Error ? e.message : String(e)));
    } finally {
      setLoading(false);
    }
  };

  const salvarRota = async () => {
    if (!tecnicoSelecionado || !rotaSelecionada || osAprovadas.length === 0) return;
    setSalvando(true);
    setErro(null);
    const cidades = [...new Set(osAprovadas.map(o => o.cliente_cidade).filter(Boolean))] as string[];
    const skills = [...new Set(osAprovadas.map(o => o.aparelho_linha ?? 'Geral'))].join(', ');

    const id = await salvarRotaRascunho({
      unidadeId,
      tecnicoId: tecnicoSelecionado.id,
      nome: `${rotaSelecionada.nome} — ${tecnicoSelecionado.nome}`,
      dataRota,
      cor: rotaSelecionada.cor,
      cidades,
      skill: skills,
      osIds: osAprovadas.map(o => o.id),
      colunaKanban: rotaSelecionada.coluna_kanban,
    });

    if (id) {
      setRotaId(id);
      setSucesso('Rota salva como rascunho!');
      setEtapa('confirmar');
    } else {
      setErro('Falha ao salvar rota. Tente novamente.');
    }
    setSalvando(false);
  };

  const confirmarEAgendar = async () => {
    if (!rotaId || !tecnicoSelecionado) return;
    setEnviando(true);
    setErro(null);
    setSucesso(null);

    const resultado = await confirmarRotaEAgendar({
      rotaId,
      tecnicoId: tecnicoSelecionado.id,
      tecnicoNome: tecnicoSelecionado.nome,
      dataRota,
      periodoRota,
      osIds: osAprovadas.map(o => o.id),
      unidadeId,
      osList: osAprovadas,
    });

    if (resultado.falhas > 0) {
      setSucesso(`${resultado.enviados} mensagens enviadas. ${resultado.falhas} falhas — verifique o Mural da GIA.`);
    } else {
      setSucesso(`Agendamento confirmado! ${resultado.enviados} clientes notificados via WhatsApp.`);
    }
    setEnviando(false);
  };

  const reiniciar = () => {
    setEtapa('configurar');
    setOsDaRota([]);
    setOsAprovadas([]);
    setSobras([]);
    setResultadoOtimizacao(null);
    setRotaId(null);
    setErro(null);
    setSucesso(null);
  };

  const horasUsadas = `${Math.floor(minutosUsados / 60)}h${String(minutosUsados % 60).padStart(2, '0')}`;
  const horasDisp = `${Math.floor(minutosDisponiveis / 60)}h${String(minutosDisponiveis % 60).padStart(2, '0')}`;
  const pctUso = minutosDisponiveis > 0 ? Math.min(100, Math.round((minutosUsados / minutosDisponiveis) * 100)) : 0;

  if (loading && etapa === 'configurar') {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 rounded-full animate-spin" style={{ borderColor: 'var(--border-primary)', borderTopColor: 'var(--text-accent)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>GIA Logistics — Despachador</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Human-Led, AI-Assisted. Voce decide, a IA organiza.</p>
        </div>
        {etapa !== 'configurar' && (
          <button onClick={reiniciar} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-primary)' }}>
            <RefreshCw className="w-4 h-4" /> Nova Rota
          </button>
        )}
      </div>

      {/* Steps indicator */}
      <div className="flex items-center gap-2">
        {(['configurar', 'processar', 'roteirizar', 'confirmar'] as Etapa[]).map((e, i) => {
          const labels = ['Configurar', 'Filtrar OSs', 'Roteirizar', 'Confirmar'];
          const atual = etapa === e;
          const passado = ['configurar', 'processar', 'roteirizar', 'confirmar'].indexOf(etapa) > i;
          return (
            <div key={e} className="flex items-center gap-2">
              <div className="flex items-center gap-1.5">
                <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold" style={{
                  backgroundColor: passado ? '#10B981' : atual ? '#3B82F6' : 'var(--bg-secondary)',
                  color: passado || atual ? '#fff' : 'var(--text-tertiary)',
                  border: `1px solid ${passado ? '#10B981' : atual ? '#3B82F6' : 'var(--border-primary)'}`,
                }}>
                  {passado ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className="text-xs font-medium" style={{ color: atual ? 'var(--text-primary)' : 'var(--text-tertiary)' }}>{labels[i]}</span>
              </div>
              {i < 3 && <div className="w-6 h-px" style={{ backgroundColor: 'var(--border-primary)' }} />}
            </div>
          );
        })}
      </div>

      {erro && (
        <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: '#EF444410', border: '1px solid #EF444430' }}>
          <AlertCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#EF4444' }} />
          <p className="text-sm" style={{ color: '#EF4444' }}>{erro}</p>
        </div>
      )}
      {sucesso && (
        <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: '#10B98110', border: '1px solid #10B98130' }}>
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: '#10B981' }} />
          <p className="text-sm" style={{ color: '#10B981' }}>{sucesso}</p>
        </div>
      )}

      {/* ETAPA 1: Configurar */}
      {etapa === 'configurar' && (
        <div className="rounded-xl p-6 space-y-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Selecione a Rota e o Tecnico</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Rota</label>
              <div className="space-y-2">
                {rotas.length === 0 ? (
                  <p className="text-sm" style={{ color: 'var(--text-tertiary)' }}>Nenhuma rota cadastrada com coluna kanban</p>
                ) : (
                  rotas.map(rota => (
                    <button
                      key={rota.id}
                      onClick={() => setRotaSelecionada(rota)}
                      className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-all"
                      style={{
                        backgroundColor: rotaSelecionada?.id === rota.id ? '#3B82F610' : 'var(--bg-secondary)',
                        border: `1px solid ${rotaSelecionada?.id === rota.id ? '#3B82F650' : 'var(--border-primary)'}`,
                      }}
                    >
                      <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: rota.cor ?? '#6B7280' }} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{rota.nome}</p>
                        <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>{rota.cidades?.slice(0, 3).join(', ')}{(rota.cidades?.length ?? 0) > 3 ? '...' : ''}</p>
                      </div>
                      {rotaSelecionada?.id === rota.id && <CheckCircle2 className="w-4 h-4 flex-shrink-0" style={{ color: '#3B82F6' }} />}
                    </button>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>Tecnico</label>
                <select
                  value={tecnicoSelecionado?.id ?? ''}
                  onChange={e => setTecnicoSelecionado(tecnicos.find(t => t.id === e.target.value) ?? null)}
                  className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none"
                  style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                >
                  <option value="">Selecionar tecnico...</option>
                  {tecnicos.map(t => (
                    <option key={t.id} value={t.id}>{t.nome}</option>
                  ))}
                </select>
                {tecnicoSelecionado && (
                  <div className="mt-2 p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
                    <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Habilidades</p>
                    {!tecnicoSelecionado.habilidades || tecnicoSelecionado.habilidades.length === 0 ? (
                      <span className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Atende todas as linhas</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {tecnicoSelecionado.habilidades.map(h => (
                          <span key={h} className="px-2 py-0.5 rounded text-xs" style={{ backgroundColor: '#10B98112', color: '#10B981', border: '1px solid #10B98130' }}>{h}</span>
                        ))}
                      </div>
                    )}
                    <p className="text-xs mt-2" style={{ color: 'var(--text-tertiary)' }}>
                      Expediente: {tecnicoSelecionado.horario_inicio_expediente?.slice(0, 5) ?? '08:00'} — {tecnicoSelecionado.horario_fim_expediente?.slice(0, 5) ?? '18:00'}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Data da Rota</label>
                  <input
                    type="date"
                    value={dataRota}
                    onChange={e => setDataRota(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                    style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Periodo</label>
                  <select
                    value={periodoRota}
                    onChange={e => setPeriodoRota(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                    style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                  >
                    <option value="manha">Manha</option>
                    <option value="tarde">Tarde</option>
                    <option value="dia_todo">Dia todo</option>
                  </select>
                </div>
              </div>
            </div>
          </div>

          <button
            onClick={buscarOSs}
            disabled={!rotaSelecionada || !tecnicoSelecionado || buscando}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors"
            style={{ backgroundColor: rotaSelecionada && tecnicoSelecionado ? '#3B82F6' : 'var(--bg-secondary)', color: rotaSelecionada && tecnicoSelecionado ? '#fff' : 'var(--text-tertiary)' }}
          >
            {buscando ? <><RefreshCw className="w-4 h-4 animate-spin" />Buscando e Geolocalizando...</> : <><Play className="w-4 h-4" />Buscar OSs da Rota</>}
          </button>
        </div>
      )}

      {/* Geo manual modal */}
      {osSemCoords.length > 0 && (
        <GeolocalizacaoManualModal
          osSemCoords={osSemCoords}
          onSalvar={resolverGeoManual}
          onFechar={() => { setOsSemCoords([]); setEtapa('processar'); aplicarFiltros(osDaRota, tecnicoSelecionado!); }}
        />
      )}

      {/* ETAPA 2+: Filtros + Sobras + Painel */}
      {(etapa === 'processar' || etapa === 'roteirizar' || etapa === 'confirmar') && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Coluna esquerda: OS Aprovadas */}
          <div className="lg:col-span-2 space-y-4">
            {/* Barra de tempo */}
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Uso do expediente</span>
                <span className="text-xs font-bold" style={{ color: pctUso > 90 ? '#EF4444' : pctUso > 70 ? '#F59E0B' : '#10B981' }}>
                  {horasUsadas} / {horasDisp} ({pctUso}%)
                </span>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${pctUso}%`, backgroundColor: pctUso > 90 ? '#EF4444' : pctUso > 70 ? '#F59E0B' : '#10B981' }} />
              </div>
            </div>

            <div className="rounded-xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
              <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: '1px solid var(--border-primary)' }}>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" style={{ color: '#10B981' }} />
                  <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>OSs na Rota ({osAprovadas.length})</span>
                </div>
                {etapa === 'processar' && (
                  <button
                    onClick={otimizarRota}
                    disabled={loading || osAprovadas.length === 0}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
                    style={{ backgroundColor: '#3B82F6', color: '#fff' }}
                  >
                    {loading ? <><RefreshCw className="w-3 h-3 animate-spin" />Otimizando...</> : <><Route className="w-3 h-3" />Otimizar Sequencia</>}
                  </button>
                )}
              </div>

              {osAprovadas.length === 0 ? (
                <div className="p-8 text-center">
                  <MapPin className="w-10 h-10 mx-auto mb-2 opacity-30" style={{ color: 'var(--text-tertiary)' }} />
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Nenhuma OS disponivel para esta rota/tecnico</p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--border-primary)' }}>
                  {osAprovadas.map((os, idx) => (
                    <OSCard
                      key={os.id}
                      os={os}
                      ordem={idx + 1}
                      disabled={etapa !== 'processar' && etapa !== 'roteirizar'}
                      onRemover={() => moverParaSobras(os)}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Mapa */}
            {resultadoOtimizacao && baseCoords && (
              <div className="rounded-xl overflow-hidden" style={{ height: 380, border: '1px solid var(--border-primary)' }}>
                <GoogleRouteMapViewer
                  baseCoordinates={baseCoords}
                  osData={resultadoOtimizacao.os_incluidas.map(o => ({
                    id: o.os_id,
                    lat: o.lat ?? 0,
                    lng: o.lng ?? 0,
                    cliente_nome: o.cliente_nome,
                    numero_os: o.numero_os,
                    ordem_visita: o.ordem_visita,
                    concluida: false,
                  }))}
                  polyline={resultadoOtimizacao.polyline}
                  selectedOS={null}
                  onOSClick={() => {}}
                  showCompleted={false}
                />
              </div>
            )}

            {resultadoOtimizacao && (
              <RouteMetrics
                metrics={{
                  totalDistance: resultadoOtimizacao.metricas.distancia_total_km,
                  totalDuration: resultadoOtimizacao.metricas.tempo_total_minutos,
                  totalStops: resultadoOtimizacao.os_incluidas.length,
                  completedCount: 0,
                  estimatedStart: resultadoOtimizacao.metricas.horario_inicio,
                  estimatedEnd: resultadoOtimizacao.metricas.horario_fim,
                }}
                lastCalculated={new Date().toISOString()}
                isCalculating={loading}
              />
            )}

            {/* Action buttons */}
            {etapa === 'roteirizar' && (
              <button
                onClick={salvarRota}
                disabled={salvando || osAprovadas.length === 0}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm transition-colors"
                style={{ backgroundColor: '#10B981', color: '#fff' }}
              >
                {salvando ? <><RefreshCw className="w-4 h-4 animate-spin" />Salvando...</> : <><CheckCircle2 className="w-4 h-4" />Salvar Rota e Agendar com Clientes</>}
              </button>
            )}

            {etapa === 'confirmar' && (
              <div className="rounded-xl p-5 space-y-4" style={{ backgroundColor: '#10B98108', border: '1px solid #10B98125' }}>
                <div className="flex items-center gap-2">
                  <Send className="w-5 h-5" style={{ color: '#10B981' }} />
                  <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Notificar Clientes via WhatsApp</h3>
                </div>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  A rota foi salva. Ao confirmar, todos os clientes da rota receberao uma mensagem de confirmacao de agendamento pelo WhatsApp.
                </p>
                <button
                  onClick={confirmarEAgendar}
                  disabled={enviando}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-lg font-semibold text-sm transition-colors"
                  style={{ backgroundColor: '#10B981', color: '#fff' }}
                >
                  {enviando ? <><RefreshCw className="w-4 h-4 animate-spin" />Enviando mensagens...</> : <><Send className="w-4 h-4" />Confirmar e Enviar WhatsApp em Lote</>}
                </button>
              </div>
            )}
          </div>

          {/* Coluna direita: Sobras */}
          <div className="space-y-4">
            <div className="rounded-xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
              <div className="px-5 py-3" style={{ borderBottom: '1px solid var(--border-primary)', backgroundColor: '#EF444408', borderRadius: '12px 12px 0 0' }}>
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" style={{ color: '#EF4444' }} />
                  <span className="font-semibold text-sm" style={{ color: '#EF4444' }}>Sobras ({sobras.length})</span>
                </div>
                <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>OSs excluidas por skill ou horario</p>
              </div>

              {sobras.length === 0 ? (
                <div className="p-6 text-center">
                  <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: '#10B981' }} />
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>Nenhuma sobra</p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: 'var(--border-primary)' }}>
                  {sobras.map(item => (
                    <div key={item.os.id} className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>
                            OS {item.os.numero_os_samsung || item.os.numero_os_interna || item.os.id.slice(0, 8)}
                          </p>
                          <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{item.os.cliente_nome}</p>
                          <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>{item.os.aparelho_linha ?? 'Linha N/A'}</p>
                        </div>
                        {(etapa === 'processar' || etapa === 'roteirizar') && (
                          <button
                            onClick={() => moverParaAprovadas(item)}
                            className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                            style={{ backgroundColor: '#10B98115', color: '#10B981', border: '1px solid #10B98130' }}
                            title="Mover para a rota"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <div className="mt-1.5 px-2 py-1 rounded text-xs" style={{
                        backgroundColor: item.motivo === 'skill' ? '#F59E0B10' : '#EF444410',
                        color: item.motivo === 'skill' ? '#F59E0B' : '#EF4444',
                        border: `1px solid ${item.motivo === 'skill' ? '#F59E0B25' : '#EF444425'}`,
                      }}>
                        {item.motivoLabel}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Resumo */}
            <div className="rounded-xl p-4 space-y-2" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--text-secondary)' }}>Resumo</p>
              <div className="flex justify-between text-xs">
                <span style={{ color: 'var(--text-tertiary)' }}>Total na fila</span>
                <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{osDaRota.length}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: 'var(--text-tertiary)' }}>Na rota</span>
                <span className="font-bold" style={{ color: '#10B981' }}>{osAprovadas.length}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: 'var(--text-tertiary)' }}>Sobras</span>
                <span className="font-bold" style={{ color: '#EF4444' }}>{sobras.length}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: 'var(--text-tertiary)' }}>Tecnico</span>
                <span className="font-bold truncate max-w-[120px]" style={{ color: 'var(--text-primary)' }}>{tecnicoSelecionado?.nome ?? '-'}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span style={{ color: 'var(--text-tertiary)' }}>Data</span>
                <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{dataRota}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function OSCard({ os, ordem, disabled, onRemover }: {
  os: OSLogistica;
  ordem: number;
  disabled: boolean;
  onRemover: () => void;
}) {
  const numOS = os.numero_os_samsung || os.numero_os_interna || os.id.slice(0, 8);
  const endereco = [os.cliente_logradouro, os.cliente_numero, os.cliente_bairro].filter(Boolean).join(', ');

  return (
    <div className="flex items-center gap-3 px-5 py-3">
      <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0" style={{ backgroundColor: '#3B82F615', color: '#3B82F6', border: '1px solid #3B82F630' }}>
        {ordem}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>OS {numOS}</span>
          {os.aparelho_linha && (
            <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: '#F59E0B10', color: '#F59E0B', border: '1px solid #F59E0B25' }}>{os.aparelho_linha}</span>
          )}
        </div>
        <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{os.cliente_nome}</p>
        {endereco && <p className="text-xs truncate" style={{ color: 'var(--text-tertiary)' }}>{endereco}</p>}
      </div>
      {!disabled && (
        <button
          onClick={onRemover}
          className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
          style={{ backgroundColor: '#EF444415', color: '#EF4444', border: '1px solid #EF444430' }}
          title="Mover para Sobras"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
