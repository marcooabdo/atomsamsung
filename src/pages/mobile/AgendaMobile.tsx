import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Clock, Phone, Navigation, RefreshCw, CheckCircle, PlayCircle, Calendar as CalendarIcon, Map } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface AgendamentoOS {
  id: string;
  numero_os_interna: string | null;
  numero_os_samsung: string | null;
  tipo_atendimento: string;
  tipo_reparo: string | null;
  cliente_nome: string;
  cliente_telefone: string;
  endereco_completo: string;
  cliente_endereco: string;
  cliente_bairro: string;
  cliente_cidade: string;
  latitude: number | null;
  longitude: number | null;
  coluna_kanban: string;
  data_agendamento: string;
  periodo_agendamento: string;
  confirmado_com_cliente: boolean;
}

export function AgendaMobile() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [agendamentos, setAgendamentos] = useState<AgendamentoOS[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split('T')[0]);
  const [mostrarMapa, setMostrarMapa] = useState(false);

  const loadAgendamentos = async () => {
    if (!usuario) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('os')
      .select('id, numero_os_interna, numero_os_samsung, tipo_atendimento, tipo_reparo, cliente_nome, cliente_telefone, endereco_completo, cliente_endereco, cliente_bairro, cliente_cidade, latitude, longitude, coluna_kanban, data_agendamento, periodo_agendamento, confirmado_com_cliente')
      .eq('tecnico_agendado_id', usuario.id)
      .eq('data_agendamento', dataFiltro)
      .order('periodo_agendamento', { ascending: true });

    if (error) {
      console.error('Erro ao carregar agendamentos:', error);
    } else if (data) {
      setAgendamentos(data as AgendamentoOS[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAgendamentos();
  }, [usuario, dataFiltro]);

  const getStatusBadge = (os: AgendamentoOS) => {
    const statusMap: Record<string, { label: string; color: string }> = {
      'os_fechada': { label: 'Concluído', color: 'bg-green-500/20 text-green-400 border-green-500/50' },
      'reparo_concluido': { label: 'Reparo Concluído', color: 'bg-green-500/20 text-green-400 border-green-500/50' },
      'em_reparo_ci': { label: 'Em Reparo', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' },
      'em_rota_ih': { label: 'Em Rota', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' },
      'rota_preta': { label: 'Rota Preta', color: 'bg-gray-500/20 text-gray-400 border-gray-500/50' },
      'rota_vermelha': { label: 'Rota Vermelha', color: 'bg-red-500/20 text-red-400 border-red-500/50' },
      'rota_azul': { label: 'Rota Azul', color: 'bg-blue-500/20 text-blue-400 border-blue-500/50' },
      'rota_verde': { label: 'Rota Verde', color: 'bg-green-500/20 text-green-400 border-green-500/50' },
      'rota_rosa': { label: 'Rota Rosa', color: 'bg-pink-500/20 text-pink-400 border-pink-500/50' },
      'rota_amarela': { label: 'Rota Amarela', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' },
      'rota_laranja': { label: 'Rota Laranja', color: 'bg-orange-500/20 text-orange-400 border-orange-500/50' },
      'aguardando_peca': { label: 'Aguardando Peça', color: 'bg-orange-500/20 text-orange-400 border-orange-500/50' },
      'peca_disponivel': { label: 'Peça Disponível', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50' },
      'os_nova': { label: 'OS Nova', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50' }
    };
    return statusMap[os.coluna_kanban] || { label: 'Agendado', color: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/50' };
  };

  const getPeriodoLabel = (periodo: string) => {
    const periodos: Record<string, string> = {
      'manha': 'Manhã (08:00 - 12:00)',
      'tarde': 'Tarde (13:00 - 18:00)',
      'noite': 'Noite (18:00 - 21:00)'
    };
    return periodos[periodo?.toLowerCase()] || periodo || 'Não especificado';
  };

  const openNavigation = (lat: number, lng: number, endereco: string) => {
    const wazeUrl = `https://www.waze.com/ul?ll=${lat},${lng}&navigate=yes`;
    const googleMapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;

    if (confirm('Abrir navegação no Waze?')) {
      window.open(wazeUrl, '_blank');
    } else {
      window.open(googleMapsUrl, '_blank');
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Agenda do Dia</h1>
          <p className="text-gray-400 text-sm">{agendamentos.length} OS agendadas</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setMostrarMapa(!mostrarMapa)}
            className="p-3 bg-blue-500/20 border border-blue-500/50 rounded-xl text-blue-400 hover:bg-blue-500/30 transition-colors"
          >
            <Map className="w-5 h-5" />
          </button>
          <button
            onClick={loadAgendamentos}
            disabled={loading}
            className="p-3 bg-cyan-500/20 border border-cyan-500/50 rounded-xl text-cyan-400 hover:bg-cyan-500/30 transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      <div className="relative">
        <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="date"
          value={dataFiltro}
          onChange={(e) => setDataFiltro(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-cyan-500"
        />
      </div>

      {mostrarMapa && agendamentos.length > 0 && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-4">
          <h3 className="text-white font-bold mb-3 flex items-center gap-2">
            <Map className="w-5 h-5 text-blue-400" />
            Rota do Dia
          </h3>
          <div className="bg-gray-800 rounded-lg h-[400px] relative overflow-hidden">
            <MapaRotaTecnico agendamentos={agendamentos} />
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : agendamentos.length === 0 ? (
        <div className="text-center py-12">
          <CalendarIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Nenhuma OS agendada para este dia</p>
        </div>
      ) : (
        <div className="space-y-3">
          {agendamentos.map((os, index) => {
            const status = getStatusBadge(os);

            return (
              <div
                key={os.id}
                className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-1 bg-blue-500/20 border border-blue-500/50 rounded text-blue-400 text-xs font-bold">
                        #{index + 1}
                      </span>
                      <span className="text-white font-bold text-lg">
                        OS #{os.numero_os_samsung || os.numero_os_interna || 'S/N'}
                      </span>
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm">
                      {os.tipo_atendimento === 'IH'
                        ? `IH - ${os.tipo_reparo || 'Reparo não especificado'}`
                        : os.tipo_atendimento || 'Serviço não especificado'}
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <span className="text-gray-300 text-sm">{getPeriodoLabel(os.periodo_agendamento)}</span>
                  </div>

                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm">{os.cliente_nome}</p>
                      <p className="text-gray-400 text-sm">{os.endereco_completo || os.cliente_endereco || 'Endereço não cadastrado'}</p>
                    </div>
                  </div>

                  {os.cliente_telefone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      <a
                        href={`tel:${os.cliente_telefone}`}
                        className="text-cyan-400 text-sm hover:underline"
                      >
                        {os.cliente_telefone}
                      </a>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  {os.coluna_kanban !== 'os_fechada' && os.coluna_kanban !== 'reparo_concluido' && (
                    <button
                      onClick={() => navigate(`/mobile/execucao/${os.id}`)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-xl hover:from-cyan-600 hover:to-blue-600 transition-all"
                    >
                      {os.coluna_kanban === 'em_reparo_ci' || os.coluna_kanban === 'em_rota_ih' ? (
                        <>
                          <CheckCircle className="w-5 h-5" />
                          Continuar
                        </>
                      ) : (
                        <>
                          <PlayCircle className="w-5 h-5" />
                          Iniciar
                        </>
                      )}
                    </button>
                  )}

                  {os.latitude && os.longitude && (
                    <button
                      onClick={() => openNavigation(os.latitude, os.longitude, os.endereco_completo || os.cliente_endereco)}
                      className="px-4 py-3 bg-green-500/20 border border-green-500/50 text-green-400 font-medium rounded-xl hover:bg-green-500/30 transition-all"
                    >
                      <Navigation className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MapaRotaTecnico({ agendamentos }: { agendamentos: AgendamentoOS[] }) {
  const validAgendamentos = agendamentos.filter(a => a.latitude && a.longitude);

  if (validAgendamentos.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400">
        <div className="text-center">
          <MapPin className="w-12 h-12 mx-auto mb-2 opacity-50" />
          <p>Nenhuma OS com localização cadastrada</p>
        </div>
      </div>
    );
  }

  const bounds = validAgendamentos.reduce((acc, os) => {
    const lat = os.latitude!;
    const lng = os.longitude!;
    return {
      minLat: Math.min(acc.minLat, lat),
      maxLat: Math.max(acc.maxLat, lat),
      minLng: Math.min(acc.minLng, lng),
      maxLng: Math.max(acc.maxLng, lng)
    };
  }, {
    minLat: validAgendamentos[0].latitude!,
    maxLat: validAgendamentos[0].latitude!,
    minLng: validAgendamentos[0].longitude!,
    maxLng: validAgendamentos[0].longitude!
  });

  const centerLat = (bounds.minLat + bounds.maxLat) / 2;
  const centerLng = (bounds.minLng + bounds.maxLng) / 2;

  const googleMapsUrl = `https://www.google.com/maps/dir/${validAgendamentos.map(a => `${a.latitude},${a.longitude}`).join('/')}/`;

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1 bg-gray-700 rounded-t-lg overflow-hidden">
        <iframe
          src={`https://www.google.com/maps/embed/v1/directions?key=&origin=${validAgendamentos[0].latitude},${validAgendamentos[0].longitude}&destination=${validAgendamentos[validAgendamentos.length - 1].latitude},${validAgendamentos[validAgendamentos.length - 1].longitude}${validAgendamentos.length > 2 ? '&waypoints=' + validAgendamentos.slice(1, -1).map(a => `${a.latitude},${a.longitude}`).join('|') : ''}`}
          width="100%"
          height="100%"
          style={{ border: 0 }}
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="w-full h-full"
        />
      </div>
      <div className="bg-gray-800 p-3 rounded-b-lg flex items-center justify-between">
        <div className="text-sm">
          <p className="text-gray-400">Total de paradas</p>
          <p className="text-white font-bold">{validAgendamentos.length} locais</p>
        </div>
        <a
          href={googleMapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-2 bg-green-500/20 border border-green-500/50 text-green-400 rounded-lg hover:bg-green-500/30 transition-all flex items-center gap-2"
        >
          <Navigation className="w-4 h-4" />
          Abrir no Maps
        </a>
      </div>
    </div>
  );
}
