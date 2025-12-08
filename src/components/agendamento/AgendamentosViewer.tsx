import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import { Search, Filter, Calendar, User, MapPin } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { OSListCard } from './OSListCard';
import { createCustomMarkerIcon } from './CustomMarker';
import { RouteDashboard } from './RouteDashboard';
import 'leaflet/dist/leaflet.css';

interface AgendamentosViewerProps {
  unidadeId?: string;
  showDashboard?: boolean;
  allowTechnicianFilter?: boolean;
}

export function AgendamentosViewer({
  unidadeId,
  showDashboard = true,
  allowTechnicianFilter = true
}: AgendamentosViewerProps) {
  const { usuario } = useAuth();
  const [agendamentos, setAgendamentos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAgendamento, setSelectedAgendamento] = useState<string | null>(null);
  const [tecnicoFilter, setTecnicoFilter] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchTerm, setSearchTerm] = useState('');
  const [tecnicos, setTecnicos] = useState<any[]>([]);
  const [viewMode, setViewMode] = useState<'mapa' | 'lista'>('mapa');

  useEffect(() => {
    loadTecnicos();
  }, [unidadeId]);

  useEffect(() => {
    loadAgendamentos();
    const subscription = supabase
      .channel('agendamentos_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'agendamentos'
      }, () => {
        loadAgendamentos();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [unidadeId, tecnicoFilter, dateFilter]);

  const loadTecnicos = async () => {
    try {
      let query = supabase
        .from('usuarios')
        .select('id, nome')
        .in('tipo', ['tecnico', 'tecnico_ih'])
        .eq('ativo', true)
        .order('nome');

      if (unidadeId) {
        query = query.eq('unidade_id', unidadeId);
      }

      const { data } = await query;
      setTecnicos(data || []);
    } catch (error) {
      console.error('Erro ao carregar técnicos:', error);
    }
  };

  const loadAgendamentos = async () => {
    try {
      setLoading(true);

      let query = supabase
        .from('v_agendamentos_com_status_visual')
        .select('*')
        .eq('data_agendamento', dateFilter)
        .order('horario_inicio');

      if (unidadeId) {
        query = query.eq('unidade_id', unidadeId);
      }

      if (tecnicoFilter) {
        query = query.eq('tecnico_id', tecnicoFilter);
      } else if (!allowTechnicianFilter && usuario?.id) {
        query = query.eq('tecnico_id', usuario.id);
      }

      const { data, error } = await query;

      if (error) throw error;

      setAgendamentos(data || []);
    } catch (error) {
      console.error('Erro ao carregar agendamentos:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredAgendamentos = useMemo(() => {
    if (!searchTerm) return agendamentos;

    return agendamentos.filter(ag =>
      ag.cliente_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ag.numero_os_samsung?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ag.numero_os_interna?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [agendamentos, searchTerm]);

  const mapCenter = useMemo(() => {
    if (filteredAgendamentos.length > 0 && filteredAgendamentos[0].lat && filteredAgendamentos[0].lng) {
      return [filteredAgendamentos[0].lat, filteredAgendamentos[0].lng] as [number, number];
    }
    return [-23.5505, -46.6333] as [number, number];
  }, [filteredAgendamentos]);

  return (
    <div className="space-y-6">
      {showDashboard && tecnicoFilter && (
        <RouteDashboard tecnicoId={tecnicoFilter} unidadeId={unidadeId} periodo="30dias" />
      )}

      <div className="premium-card p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Buscar por cliente ou número da OS..."
                className="neon-input pl-10 w-full"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                className="neon-input pl-10"
              />
            </div>

            {allowTechnicianFilter && tecnicos.length > 0 && (
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <select
                  value={tecnicoFilter}
                  onChange={(e) => setTecnicoFilter(e.target.value)}
                  className="neon-input pl-10 min-w-[200px]"
                >
                  <option value="">Todos os Técnicos</option>
                  {tecnicos.map((tec) => (
                    <option key={tec.id} value={tec.id}>
                      {tec.nome}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setViewMode('mapa')}
                className={`px-4 py-2 rounded ${
                  viewMode === 'mapa'
                    ? 'bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]'
                    : 'bg-black/40 text-gray-400 border border-gray-700'
                }`}
              >
                <MapPin className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('lista')}
                className={`px-4 py-2 rounded ${
                  viewMode === 'lista'
                    ? 'bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]'
                    : 'bg-black/40 text-gray-400 border border-gray-700'
                }`}
              >
                <Filter className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-[#00D4FF] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filteredAgendamentos.length === 0 ? (
          <div className="text-center py-12">
            <MapPin className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Nenhum agendamento encontrado para esta data</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {viewMode === 'mapa' && (
              <div className="h-[600px] rounded-lg overflow-hidden border-2 border-[#00D4FF]/30">
                <MapContainer
                  center={mapCenter}
                  zoom={13}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution='&copy; OpenStreetMap contributors'
                  />

                  {filteredAgendamentos
                    .filter(ag => ag.lat && ag.lng)
                    .map((ag) => {
                      const markerStatus = {
                        status: ag.status || 'pendente',
                        hasGI: ag.pecas_ativas > 0,
                        hasPendingParts: ag.pecas_ativas > 0
                      };

                      return (
                        <Marker
                          key={ag.id}
                          position={[ag.lat, ag.lng]}
                          icon={createCustomMarkerIcon(markerStatus, selectedAgendamento === ag.id)}
                          eventHandlers={{
                            click: () => setSelectedAgendamento(ag.id)
                          }}
                        >
                          <Popup>
                            <div className="p-2">
                              <h3 className="font-bold">{ag.cliente_nome}</h3>
                              <p className="text-sm">{ag.numero_os_samsung || ag.numero_os_interna}</p>
                              <p className="text-xs text-gray-600">{ag.cliente_endereco}</p>
                            </div>
                          </Popup>
                        </Marker>
                      );
                    })}
                </MapContainer>
              </div>
            )}

            <div className="space-y-3 max-h-[600px] overflow-y-auto cyber-scrollbar">
              {filteredAgendamentos.map((ag) => (
                <OSListCard
                  key={ag.id}
                  agendamento={ag}
                  isSelected={selectedAgendamento === ag.id}
                  onClick={() => setSelectedAgendamento(ag.id)}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
