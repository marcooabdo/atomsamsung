import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Clock, Phone, Navigation, RefreshCw, CheckCircle, PlayCircle, Calendar as CalendarIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface AgendamentoOS {
  id: string;
  os_id: string;
  data_agendamento: string;
  periodo: string;
  checkin_realizado: boolean;
  checkout_realizado: boolean;
  os: {
    numero_os: string;
    tipo_servico: string;
    cliente_nome: string;
    cliente_telefone: string;
    endereco_completo: string;
    latitude: number;
    longitude: number;
    status_kanban: string;
  };
}

export function AgendaMobile() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [agendamentos, setAgendamentos] = useState<AgendamentoOS[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split('T')[0]);

  const loadAgendamentos = async () => {
    if (!usuario) return;

    setLoading(true);
    const { data } = await supabase
      .from('agendamentos')
      .select(`
        id,
        os_id,
        data_agendamento,
        periodo,
        checkin_realizado,
        checkout_realizado,
        os:os_id (
          numero_os,
          tipo_servico,
          cliente_nome,
          cliente_telefone,
          endereco_completo,
          latitude,
          longitude,
          status_kanban
        )
      `)
      .eq('tecnico_id', usuario.id)
      .eq('data_agendamento', dataFiltro)
      .order('periodo', { ascending: true });

    if (data) {
      setAgendamentos(data as unknown as AgendamentoOS[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAgendamentos();
  }, [usuario, dataFiltro]);

  const getStatusBadge = (agendamento: AgendamentoOS) => {
    if (agendamento.checkout_realizado) {
      return { label: 'Concluído', color: 'bg-green-500/20 text-green-400 border-green-500/50' };
    }
    if (agendamento.checkin_realizado) {
      return { label: 'Em Andamento', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' };
    }
    return { label: 'Pendente', color: 'bg-gray-500/20 text-gray-400 border-gray-500/50' };
  };

  const getPeriodoLabel = (periodo: string) => {
    const periodos: Record<string, string> = {
      manha: 'Manhã (08:00 - 12:00)',
      tarde: 'Tarde (13:00 - 18:00)',
      noite: 'Noite (18:00 - 21:00)'
    };
    return periodos[periodo] || periodo;
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
        <button
          onClick={loadAgendamentos}
          disabled={loading}
          className="p-3 bg-cyan-500/20 border border-cyan-500/50 rounded-xl text-cyan-400 hover:bg-cyan-500/30 transition-colors"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
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
          {agendamentos.map(agendamento => {
            const status = getStatusBadge(agendamento);
            const os = agendamento.os;

            return (
              <div
                key={agendamento.id}
                className="bg-gray-900 border border-gray-700 rounded-xl p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-white font-bold text-lg">OS #{os.numero_os}</span>
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm">{os.tipo_servico || 'Serviço não especificado'}</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <span className="text-gray-300 text-sm">{getPeriodoLabel(agendamento.periodo)}</span>
                  </div>

                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm">{os.cliente_nome}</p>
                      <p className="text-gray-400 text-sm">{os.endereco_completo || 'Endereço não cadastrado'}</p>
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
                  {!agendamento.checkout_realizado && (
                    <button
                      onClick={() => navigate(`/mobile/execucao/${agendamento.id}`)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-xl hover:from-cyan-600 hover:to-blue-600 transition-all"
                    >
                      {agendamento.checkin_realizado ? (
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
                      onClick={() => openNavigation(os.latitude, os.longitude, os.endereco_completo)}
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
