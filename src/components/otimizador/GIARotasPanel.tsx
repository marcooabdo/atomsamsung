import { useState, useEffect, useCallback } from 'react';
import { Route, Calendar, Clock, MapPin, Package, User, CheckCircle, AlertTriangle, Phone, Play, XCircle, RefreshCw, ChevronDown, ChevronRight } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useOtimizador } from '../../contexts/OtimizadorContext';
import GIARotaMonitor from './GIARotaMonitor';

interface PlanoRota {
  id: string;
  nome_rota: string;
  nome_tecnico: string;
  data_inicio: string;
  data_fim: string | null;
  status: string;
  total_os: number;
  total_tempo_estimado_min: number;
  rota_id: string | null;
  tecnico_id: string | null;
  created_at: string;
}

interface Parada {
  id: string;
  plano_id: string;
  os_id: string | null;
  dia: number;
  data_prevista: string | null;
  ordem: number;
  tipo_reparo: string | null;
  tempo_estimado_min: number;
  status: string;
  confirmado_cliente: boolean;
  checkin_hora: string | null;
  checkout_hora: string | null;
  desvio_minutos: number;
  os_numero_samsung: string | null;
  os_numero_interno: string | null;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  cidade: string | null;
  endereco: string | null;
  pecas_json: any[];
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pendente: { bg: 'bg-gray-500/20', text: 'text-gray-300', label: 'Pendente' },
  confirmado: { bg: 'bg-blue-500/20', text: 'text-blue-300', label: 'Confirmado' },
  em_andamento: { bg: 'bg-amber-500/20', text: 'text-amber-300', label: 'Em Andamento' },
  concluido: { bg: 'bg-green-500/20', text: 'text-green-300', label: 'Concluído' },
  reagendado: { bg: 'bg-orange-500/20', text: 'text-orange-300', label: 'Reagendado' },
  cliente_indisponivel: { bg: 'bg-red-500/20', text: 'text-red-300', label: 'Indisponível' },
};

const PLANO_STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  planejado: { bg: 'bg-blue-500/20', text: 'text-blue-300', label: 'Planejado' },
  em_andamento: { bg: 'bg-amber-500/20', text: 'text-amber-300', label: 'Em Andamento' },
  concluido: { bg: 'bg-green-500/20', text: 'text-green-300', label: 'Concluído' },
  cancelado: { bg: 'bg-red-500/20', text: 'text-red-300', label: 'Cancelado' },
  parcial: { bg: 'bg-orange-500/20', text: 'text-orange-300', label: 'Parcial' },
};

export default function GIARotasPanel() {
  const { selectedUnidade } = useOtimizador();
  const [planos, setPlanos] = useState<PlanoRota[]>([]);
  const [selectedPlano, setSelectedPlano] = useState<string | null>(null);
  const [paradas, setParadas] = useState<Parada[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingParadas, setLoadingParadas] = useState(false);
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set());

  const loadPlanos = useCallback(async () => {
    if (!selectedUnidade) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('gia_planos_rota')
        .select('*')
        .eq('unidade_id', selectedUnidade)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      setPlanos(data || []);
      if (data && data.length > 0 && !selectedPlano) {
        setSelectedPlano(data[0].id);
      }
    } catch {
      setPlanos([]);
    } finally {
      setLoading(false);
    }
  }, [selectedUnidade]);

  const loadParadas = useCallback(async () => {
    if (!selectedPlano) return;
    setLoadingParadas(true);
    try {
      const { data, error } = await supabase
        .from('gia_plano_paradas')
        .select('*')
        .eq('plano_id', selectedPlano)
        .order('dia')
        .order('ordem');

      if (error) throw error;
      setParadas(data || []);
      const days = new Set((data || []).map(p => p.dia));
      setExpandedDays(days);
    } catch {
      setParadas([]);
    } finally {
      setLoadingParadas(false);
    }
  }, [selectedPlano]);

  useEffect(() => { loadPlanos(); }, [loadPlanos]);
  useEffect(() => { loadParadas(); }, [loadParadas]);

  const handleStatusChange = async (paradaId: string, newStatus: string) => {
    const confirmed = newStatus === 'confirmado';
    const { error } = await supabase
      .from('gia_plano_paradas')
      .update({
        status: newStatus,
        confirmado_cliente: confirmed,
        confirmado_em: confirmed ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', paradaId);

    if (!error) {
      setParadas(paradas.map(p =>
        p.id === paradaId ? { ...p, status: newStatus, confirmado_cliente: confirmed } : p
      ));
    }
  };

  const toggleDay = (dia: number) => {
    const next = new Set(expandedDays);
    if (next.has(dia)) next.delete(dia);
    else next.add(dia);
    setExpandedDays(next);
  };

  const currentPlano = planos.find(p => p.id === selectedPlano);
  const diasUnicos = [...new Set(paradas.map(p => p.dia))].sort((a, b) => a - b);

  const stats = {
    confirmados: paradas.filter(p => p.status === 'confirmado' || p.status === 'concluido').length,
    pendentes: paradas.filter(p => p.status === 'pendente').length,
    concluidos: paradas.filter(p => p.status === 'concluido').length,
    reagendados: paradas.filter(p => p.status === 'reagendado' || p.status === 'cliente_indisponivel').length,
  };

  if (!selectedUnidade) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-400">
        Selecione uma unidade para ver as rotas GIA.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Route className="w-7 h-7 text-pink-400" />
          <div>
            <h2 className="text-2xl font-bold text-white">Rotas GIA</h2>
            <p className="text-gray-400 text-sm">Planos de rota montados pela GIA para acompanhamento</p>
          </div>
        </div>
        <button
          onClick={loadPlanos}
          className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
        >
          <RefreshCw className="w-5 h-5 text-gray-300" />
        </button>
      </div>

      {/* Real-time monitor for active routes */}
      {selectedUnidade && (
        <GIARotaMonitor unidadeId={selectedUnidade} />
      )}

      {loading ? (
        <div className="text-center py-12 text-gray-400">Carregando planos...</div>
      ) : planos.length === 0 ? (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-12 text-center">
          <Route className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-lg">Nenhum plano de rota criado ainda.</p>
          <p className="text-gray-500 text-sm mt-2">
            Peça para a GIA montar uma rota: "GIA, monta a rota [nome] de [unidade] para o técnico [nome]"
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar - lista de planos */}
          <div className="lg:col-span-1 space-y-2">
            <h3 className="text-sm font-medium text-gray-400 uppercase tracking-wider px-2">Planos Recentes</h3>
            {planos.map(plano => {
              const statusInfo = PLANO_STATUS_COLORS[plano.status] || PLANO_STATUS_COLORS.planejado;
              const isSelected = plano.id === selectedPlano;
              return (
                <button
                  key={plano.id}
                  onClick={() => setSelectedPlano(plano.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-all ${
                    isSelected
                      ? 'bg-gray-700/50 border-pink-500/50'
                      : 'bg-gray-800/30 border-gray-700/50 hover:bg-gray-700/30'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-white text-sm">{plano.nome_rota}</span>
                    <span className={`px-2 py-0.5 text-xs rounded-full ${statusInfo.bg} ${statusInfo.text}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 text-gray-400 text-xs">
                    <User className="w-3 h-3" />
                    <span>{plano.nome_tecnico}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-1 text-gray-500 text-xs">
                    <span>{plano.total_os} OS</span>
                    <span>{plano.data_inicio}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Main content - detalhes do plano */}
          <div className="lg:col-span-3 space-y-4">
            {currentPlano && (
              <>
                {/* Header do plano */}
                <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-xl font-bold text-white">{currentPlano.nome_rota}</h3>
                      <p className="text-gray-400 text-sm mt-0.5">
                        Técnico: <span className="text-white">{currentPlano.nome_tecnico}</span>
                        {' | '}Início: <span className="text-white">{currentPlano.data_inicio}</span>
                        {currentPlano.data_fim && <>{' | '}Fim: <span className="text-white">{currentPlano.data_fim}</span></>}
                      </p>
                    </div>
                    <span className={`px-3 py-1 text-sm rounded-lg ${
                      PLANO_STATUS_COLORS[currentPlano.status]?.bg || 'bg-gray-700'
                    } ${PLANO_STATUS_COLORS[currentPlano.status]?.text || 'text-gray-300'}`}>
                      {PLANO_STATUS_COLORS[currentPlano.status]?.label || currentPlano.status}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="grid grid-cols-4 gap-3">
                    <div className="bg-gray-700/30 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-white">{paradas.length}</p>
                      <p className="text-xs text-gray-400">Total OS</p>
                    </div>
                    <div className="bg-green-500/10 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-green-300">{stats.confirmados}</p>
                      <p className="text-xs text-gray-400">Confirmados</p>
                    </div>
                    <div className="bg-gray-500/10 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-gray-300">{stats.pendentes}</p>
                      <p className="text-xs text-gray-400">Pendentes</p>
                    </div>
                    <div className="bg-orange-500/10 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-orange-300">{stats.reagendados}</p>
                      <p className="text-xs text-gray-400">Reagendados</p>
                    </div>
                  </div>
                </div>

                {/* Paradas por dia */}
                {loadingParadas ? (
                  <div className="text-center py-8 text-gray-400">Carregando paradas...</div>
                ) : (
                  <div className="space-y-3">
                    {diasUnicos.map(dia => {
                      const paradasDia = paradas.filter(p => p.dia === dia);
                      const dataDia = paradasDia[0]?.data_prevista;
                      const expanded = expandedDays.has(dia);
                      const concluidosDia = paradasDia.filter(p => p.status === 'concluido').length;

                      return (
                        <div key={dia} className="bg-gray-800/50 border border-gray-700 rounded-xl overflow-hidden">
                          <button
                            onClick={() => toggleDay(dia)}
                            className="w-full flex items-center justify-between p-4 hover:bg-gray-700/20 transition-colors"
                          >
                            <div className="flex items-center gap-3">
                              {expanded ? <ChevronDown className="w-5 h-5 text-gray-400" /> : <ChevronRight className="w-5 h-5 text-gray-400" />}
                              <Calendar className="w-5 h-5 text-pink-400" />
                              <span className="font-semibold text-white">Dia {dia}</span>
                              {dataDia && <span className="text-gray-400 text-sm">({dataDia})</span>}
                            </div>
                            <div className="flex items-center gap-3">
                              <span className="text-sm text-gray-400">{paradasDia.length} OS</span>
                              <span className="text-sm text-green-400">{concluidosDia}/{paradasDia.length} concluídos</span>
                            </div>
                          </button>

                          {expanded && (
                            <div className="border-t border-gray-700/50 p-4 space-y-3">
                              {paradasDia.map(parada => (
                                <ParadaCard
                                  key={parada.id}
                                  parada={parada}
                                  onStatusChange={handleStatusChange}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ParadaCard({ parada, onStatusChange }: { parada: Parada; onStatusChange: (id: string, status: string) => void }) {
  const statusInfo = STATUS_COLORS[parada.status] || STATUS_COLORS.pendente;
  const pecas = (parada.pecas_json || []) as { id: string; pn: string; delivery: string | null }[];

  return (
    <div className={`border rounded-xl p-4 transition-all ${
      parada.status === 'concluido'
        ? 'bg-green-500/5 border-green-500/20'
        : parada.status === 'confirmado'
        ? 'bg-blue-500/5 border-blue-500/20'
        : parada.status === 'cliente_indisponivel' || parada.status === 'reagendado'
        ? 'bg-red-500/5 border-red-500/20 opacity-60'
        : 'bg-gray-700/20 border-gray-600/50'
    }`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-gray-600 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
              {parada.ordem}
            </span>
            <div className="flex items-center gap-2 flex-wrap">
              {parada.os_numero_samsung && (
                <span className="text-blue-300 font-mono text-sm">{parada.os_numero_samsung}</span>
              )}
              {parada.os_numero_samsung && <span className="text-gray-500">|</span>}
              <span className="text-white font-medium text-sm">{parada.os_numero_interno}</span>
            </div>
            <span className={`px-2 py-0.5 text-xs rounded-full ${statusInfo.bg} ${statusInfo.text}`}>
              {statusInfo.label}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 mt-2 text-sm">
            <div className="flex items-center gap-2 text-gray-300">
              <User className="w-3.5 h-3.5 text-gray-500" />
              <span>{parada.cliente_nome || 'N/A'}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-300">
              <MapPin className="w-3.5 h-3.5 text-gray-500" />
              <span className="truncate">{parada.cidade || parada.endereco || 'Sem endereço'}</span>
            </div>
            <div className="flex items-center gap-2 text-gray-300">
              <Clock className="w-3.5 h-3.5 text-gray-500" />
              <span>{parada.tipo_reparo} ({parada.tempo_estimado_min} min)</span>
            </div>
            {parada.cliente_telefone && (
              <div className="flex items-center gap-2 text-gray-300">
                <Phone className="w-3.5 h-3.5 text-gray-500" />
                <span>{parada.cliente_telefone}</span>
              </div>
            )}
          </div>

          {pecas.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <Package className="w-3.5 h-3.5 text-orange-400 mt-0.5" />
              {pecas.map((peca, idx) => (
                <span key={idx} className="px-2 py-0.5 bg-orange-500/10 border border-orange-500/20 rounded text-xs text-orange-300">
                  {peca.id ? `#${peca.id.substring(0, 6)}` : ''} {peca.pn}{peca.delivery ? ` (${peca.delivery})` : ''}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex flex-col gap-1.5">
          {parada.status === 'pendente' && (
            <>
              <button
                onClick={() => onStatusChange(parada.id, 'confirmado')}
                className="p-1.5 bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 rounded-lg transition-colors"
                title="Confirmar com cliente"
              >
                <CheckCircle className="w-4 h-4 text-blue-400" />
              </button>
              <button
                onClick={() => onStatusChange(parada.id, 'cliente_indisponivel')}
                className="p-1.5 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg transition-colors"
                title="Cliente indisponível"
              >
                <XCircle className="w-4 h-4 text-red-400" />
              </button>
            </>
          )}
          {parada.status === 'confirmado' && (
            <button
              onClick={() => onStatusChange(parada.id, 'em_andamento')}
              className="p-1.5 bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 rounded-lg transition-colors"
              title="Iniciar atendimento"
            >
              <Play className="w-4 h-4 text-amber-400" />
            </button>
          )}
          {parada.status === 'em_andamento' && (
            <button
              onClick={() => onStatusChange(parada.id, 'concluido')}
              className="p-1.5 bg-green-500/20 hover:bg-green-500/30 border border-green-500/30 rounded-lg transition-colors"
              title="Concluir"
            >
              <CheckCircle className="w-4 h-4 text-green-400" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
