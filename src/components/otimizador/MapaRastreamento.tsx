import { useState, useEffect, useCallback, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { useOtimizador } from '../../contexts/OtimizadorContext';
import { supabase } from '../../lib/supabase';
import { getGoogleMapsApiKey } from '../../lib/googleMapsHelper';
import { MapPin, Users, RefreshCw, Navigation, AlertTriangle } from 'lucide-react';

interface TecnicoPos {
  tecnico_id: string;
  tecnico_nome: string;
  latitude: number;
  longitude: number;
  velocidade: number | null;
  last_update: string;
  em_atendimento: boolean;
  os_atual_id: string | null;
  presence_status: string;
}

interface AgendaPonto {
  id: string;
  os_id: string;
  numero_os: string;
  cliente_nome: string;
  cliente_cidade: string;
  lat: number | null;
  lng: number | null;
  tecnico_nome: string;
  tecnico_id: string;
  status: string;
  periodo: string;
  rota_cor: string;
  sem_coordenadas: boolean;
}

interface TecnicoAgenda {
  tecnico_id: string;
  tecnico_nome: string;
  total: number;
}

const COR_ROTA: Record<string, string> = {
  rota_preta: '#374151',
  rota_vermelha: '#EF4444',
  rota_azul: '#3B82F6',
  rota_verde: '#10B981',
  rota_amarela: '#EAB308',
  rota_laranja: '#F97316',
  rota_rosa: '#EC4899',
  rota_roxo: '#8B5CF6',
  rota_cinza: '#6B7280',
  rota_branca: '#E5E7EB',
};

function getCorByColuna(coluna: string | null | undefined): string {
  if (!coluna) return '#3B82F6';
  return COR_ROTA[coluna] || '#3B82F6';
}

const MAP_STYLES = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#1a3646' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'road', elementType: 'geometry.stroke', stylers: [{ color: '#255763' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
];

const containerStyle = { width: '100%', height: '600px' };

function getTodayLocal(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function MapaRastreamento() {
  const { selectedUnidade } = useOtimizador();
  const { isLoaded } = useJsApiLoader({ id: 'google-map-script', googleMapsApiKey: getGoogleMapsApiKey() });

  const [tecnicos, setTecnicos] = useState<TecnicoPos[]>([]);
  const [tecnicosAgenda, setTecnicosAgenda] = useState<TecnicoAgenda[]>([]);
  const [agenda, setAgenda] = useState<AgendaPonto[]>([]);
  const [baseLoc, setBaseLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<any>(null);
  const [filterTecnico, setFilterTecnico] = useState('');
  const [showAgenda, setShowAgenda] = useState(true);
  const [showTecnicos, setShowTecnicos] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadData = useCallback(async () => {
    if (!selectedUnidade) return;

    const today = getTodayLocal();

    const [posRes, baseRes, agendRes] = await Promise.all([
      supabase.rpc('get_latest_tecnico_positions', { p_unidade_id: selectedUnidade }),
      supabase.from('unidades').select('latitude, longitude').eq('id', selectedUnidade).maybeSingle(),
      supabase
        .from('agendamentos')
        .select(`
          id, os_id, tecnico_id, status, periodo, data_agendamento,
          os:os!agendamentos_os_id_fkey(numero_os_samsung, numero_os_interna, cliente_nome, cliente_cidade, lat, lng, coluna_kanban),
          tecnico:usuarios!agendamentos_tecnico_id_fkey(nome)
        `)
        .eq('unidade_id', selectedUnidade)
        .eq('data_agendamento', today)
        .neq('status', 'cancelado'),
    ]);

    if (posRes.data) setTecnicos(posRes.data);

    if (baseRes.data) {
      const lat = baseRes.data.latitude;
      const lng = baseRes.data.longitude;
      if (lat && lng) setBaseLoc({ lat: Number(lat), lng: Number(lng) });
    }

    if (agendRes.data) {
      const agendamentos = agendRes.data.map((a: any) => ({
        id: a.id,
        os_id: a.os_id,
        numero_os: a.os?.numero_os_samsung || a.os?.numero_os_interna || '-',
        cliente_nome: a.os?.cliente_nome || '-',
        cliente_cidade: a.os?.cliente_cidade || '',
        lat: a.os?.lat ? Number(a.os.lat) : null,
        lng: a.os?.lng ? Number(a.os.lng) : null,
        tecnico_nome: a.tecnico?.nome || 'Sem técnico',
        tecnico_id: a.tecnico_id || '',
        status: a.status,
        periodo: a.periodo || '',
        rota_cor: getCorByColuna(a.os?.coluna_kanban),
        sem_coordenadas: !a.os?.lat || !a.os?.lng,
      }));

      setAgenda(agendamentos);

      const tecMap: Record<string, TecnicoAgenda> = {};
      for (const a of agendamentos) {
        if (!a.tecnico_id) continue;
        if (!tecMap[a.tecnico_id]) {
          tecMap[a.tecnico_id] = { tecnico_id: a.tecnico_id, tecnico_nome: a.tecnico_nome, total: 0 };
        }
        tecMap[a.tecnico_id].total++;
      }
      setTecnicosAgenda(Object.values(tecMap));
    }
  }, [selectedUnidade]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(loadData, 15000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [autoRefresh, loadData]);

  const center = baseLoc || (tecnicos.length > 0
    ? { lat: Number(tecnicos[0].latitude), lng: Number(tecnicos[0].longitude) }
    : (agenda.find(a => a.lat && a.lng) ? { lat: agenda.find(a => a.lat && a.lng)!.lat!, lng: agenda.find(a => a.lat && a.lng)!.lng! } : { lat: -23.55, lng: -46.63 }));

  const allTecnicoIds = new Set([
    ...tecnicos.map(t => t.tecnico_id),
    ...tecnicosAgenda.map(t => t.tecnico_id),
  ]);

  const tecnicoOptions = Array.from(allTecnicoIds).map(id => {
    const fromGps = tecnicos.find(t => t.tecnico_id === id);
    const fromAgenda = tecnicosAgenda.find(t => t.tecnico_id === id);
    return { tecnico_id: id, nome: fromGps?.tecnico_nome || fromAgenda?.tecnico_nome || id };
  });

  const filteredTecnicos = filterTecnico ? tecnicos.filter(t => t.tecnico_id === filterTecnico) : tecnicos;
  const filteredAgenda = filterTecnico ? agenda.filter(a => a.tecnico_id === filterTecnico) : agenda;
  const agendaComCoordenadas = filteredAgenda.filter(a => a.lat && a.lng);
  const agendaSemCoordenadas = filteredAgenda.filter(a => !a.lat || !a.lng);

  const statusColor = (status: string) => {
    if (status === 'concluido') return '#10B981';
    if (status === 'em_atendimento') return '#F59E0B';
    if (status === 'confirmado') return '#3B82F6';
    return '#6B7280';
  };

  const timeSince = (ts: string) => {
    const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
    if (diff < 1) return 'agora';
    if (diff < 60) return `${diff}min`;
    return `${Math.floor(diff / 60)}h${diff % 60}min`;
  };

  const tecnicosComGps = filteredTecnicos;
  const tecnicosSemGps = tecnicosAgenda.filter(ta =>
    !tecnicos.some(t => t.tecnico_id === ta.tecnico_id) &&
    (!filterTecnico || ta.tecnico_id === filterTecnico)
  );

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 rounded-full animate-spin" style={{ borderColor: 'var(--text-accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Navigation className="w-5 h-5" style={{ color: 'var(--text-accent)' }} />
            Mapa de Rastreamento
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            {tecnicosComGps.filter(t => t.presence_status === 'online').length} técnico(s) online com GPS &nbsp;|&nbsp; {agenda.length} agendamento(s) hoje ({getTodayLocal()})
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filterTecnico}
            onChange={(e) => setFilterTecnico(e.target.value)}
            className="px-3 py-1.5 rounded-lg text-sm"
            style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
          >
            <option value="">Todos os Técnicos</option>
            {tecnicoOptions.map(t => (
              <option key={t.tecnico_id} value={t.tecnico_id}>{t.nome}</option>
            ))}
          </select>

          <button
            onClick={() => setShowTecnicos(!showTecnicos)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${showTecnicos ? 'ring-2' : ''}`}
            style={{ backgroundColor: showTecnicos ? '#10B98120' : 'var(--bg-secondary)', color: showTecnicos ? '#10B981' : 'var(--text-secondary)' }}
          >
            <Users className="w-3.5 h-3.5" />
            Técnicos
          </button>

          <button
            onClick={() => setShowAgenda(!showAgenda)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${showAgenda ? 'ring-2' : ''}`}
            style={{ backgroundColor: showAgenda ? '#3B82F620' : 'var(--bg-secondary)', color: showAgenda ? '#3B82F6' : 'var(--text-secondary)' }}
          >
            <MapPin className="w-3.5 h-3.5" />
            Agenda
          </button>

          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${autoRefresh ? 'ring-2' : ''}`}
            style={{ backgroundColor: autoRefresh ? '#F59E0B20' : 'var(--bg-secondary)', color: autoRefresh ? '#F59E0B' : 'var(--text-secondary)' }}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${autoRefresh ? 'animate-spin' : ''}`} style={{ animationDuration: '3s' }} />
            Auto
          </button>

          <button
            onClick={loadData}
            className="px-3 py-1.5 rounded-lg text-xs font-medium"
            style={{ backgroundColor: 'var(--text-accent)', color: 'var(--text-on-accent)' }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-primary)' }}>
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={10}
          options={{ styles: MAP_STYLES, disableDefaultUI: false, zoomControl: true, mapTypeControl: true, streetViewControl: false, fullscreenControl: true }}
        >
          {baseLoc && (
            <Marker
              position={baseLoc}
              icon={{
                url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#10B981" stroke="white" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9z"/></svg>'),
                scaledSize: new google.maps.Size(36, 36),
                anchor: new google.maps.Point(18, 18)
              }}
              title="Base - Unidade"
              onClick={() => setSelectedMarker({ type: 'base' })}
            />
          )}

          {showTecnicos && filteredTecnicos.map(t => (
            <Marker
              key={`tec-${t.tecnico_id}`}
              position={{ lat: Number(t.latitude), lng: Number(t.longitude) }}
              icon={{
                url: 'data:image/svg+xml,' + encodeURIComponent(
                  `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
                    <circle cx="20" cy="20" r="18" fill="${t.em_atendimento ? '#F59E0B' : t.presence_status === 'online' ? '#10B981' : '#6B7280'}" stroke="white" stroke-width="3"/>
                    <text x="20" y="25" text-anchor="middle" fill="white" font-size="14" font-weight="bold">${(t.tecnico_nome || '?')[0]}</text>
                  </svg>`
                ),
                scaledSize: new google.maps.Size(40, 40),
                anchor: new google.maps.Point(20, 20)
              }}
              onClick={() => setSelectedMarker({ type: 'tecnico', data: t })}
            />
          ))}

          {showAgenda && agendaComCoordenadas.map((a, idx) => (
            <Marker
              key={`ag-${a.id}`}
              position={{ lat: a.lat!, lng: a.lng! }}
              icon={{
                url: 'data:image/svg+xml,' + encodeURIComponent(
                  `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40">
                    <path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 24 16 24s16-12 16-24C32 7.2 24.8 0 16 0z" fill="${statusColor(a.status)}"/>
                    <text x="16" y="20" text-anchor="middle" fill="white" font-size="12" font-weight="bold">${idx + 1}</text>
                  </svg>`
                ),
                scaledSize: new google.maps.Size(28, 35),
                anchor: new google.maps.Point(14, 35)
              }}
              onClick={() => setSelectedMarker({ type: 'agenda', data: a })}
            />
          ))}

          {selectedMarker && (
            <InfoWindow
              position={
                selectedMarker.type === 'base' ? baseLoc! :
                selectedMarker.type === 'tecnico' ? { lat: Number(selectedMarker.data.latitude), lng: Number(selectedMarker.data.longitude) } :
                { lat: selectedMarker.data.lat, lng: selectedMarker.data.lng }
              }
              onCloseClick={() => setSelectedMarker(null)}
            >
              <div style={{ color: '#000', minWidth: 180 }}>
                {selectedMarker.type === 'base' && (
                  <div><strong>Base - Unidade</strong><br /><span style={{ fontSize: 12 }}>Ponto de partida/retorno</span></div>
                )}
                {selectedMarker.type === 'tecnico' && (
                  <div>
                    <strong>{selectedMarker.data.tecnico_nome}</strong><br />
                    <span style={{ fontSize: 12, color: selectedMarker.data.em_atendimento ? '#D97706' : '#059669' }}>
                      {selectedMarker.data.em_atendimento ? 'Em atendimento' : selectedMarker.data.presence_status === 'online' ? 'Online' : 'Offline'}
                    </span><br />
                    <span style={{ fontSize: 11, color: '#666' }}>Atualizado: {timeSince(selectedMarker.data.last_update)}</span>
                    {selectedMarker.data.velocidade > 0 && <><br /><span style={{ fontSize: 11 }}>{Math.round(selectedMarker.data.velocidade)} km/h</span></>}
                  </div>
                )}
                {selectedMarker.type === 'agenda' && (
                  <div>
                    <strong>OS {selectedMarker.data.numero_os}</strong><br />
                    <span style={{ fontSize: 12 }}>{selectedMarker.data.cliente_nome}</span><br />
                    <span style={{ fontSize: 11, color: '#666' }}>{selectedMarker.data.cliente_cidade}</span><br />
                    <span style={{ fontSize: 11 }}>Técnico: {selectedMarker.data.tecnico_nome}</span><br />
                    <span style={{ fontSize: 11, color: statusColor(selectedMarker.data.status) }}>
                      {selectedMarker.data.status === 'concluido' ? 'Concluído' :
                       selectedMarker.data.status === 'em_atendimento' ? 'Em atendimento' :
                       selectedMarker.data.status === 'confirmado' ? 'Confirmado' : 'Agendado'}
                    </span>
                  </div>
                )}
              </div>
            </InfoWindow>
          )}
        </GoogleMap>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Técnicos */}
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Users className="w-4 h-4" style={{ color: '#10B981' }} />
            Técnicos ({tecnicosComGps.length + tecnicosSemGps.length})
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {tecnicosComGps.map(t => (
              <div key={t.tecnico_id} className="flex items-center justify-between p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: t.presence_status === 'online' ? '#10B981' : '#6B7280' }} />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t.tecnico_nome}</span>
                </div>
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  {t.em_atendimento ? <span style={{ color: '#F59E0B' }}>Atendendo</span> : timeSince(t.last_update)}
                </div>
              </div>
            ))}
            {tecnicosSemGps.map(t => (
              <div key={t.tecnico_id} className="flex items-center justify-between p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)', opacity: 0.6 }}>
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-gray-500" />
                  <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{t.tecnico_nome}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: '#6B728020', color: '#9CA3AF' }}>Sem GPS</span>
                </div>
                <div className="text-xs" style={{ color: 'var(--text-secondary)' }}>{t.total} OS</div>
              </div>
            ))}
            {tecnicosComGps.length === 0 && tecnicosSemGps.length === 0 && (
              <p className="text-xs text-center py-4" style={{ color: 'var(--text-secondary)' }}>Nenhum técnico com agendamento hoje</p>
            )}
          </div>
        </div>

        {/* Agenda do Dia */}
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          <h3 className="font-bold text-sm mb-3 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <MapPin className="w-4 h-4" style={{ color: '#3B82F6' }} />
            Agenda do Dia ({filteredAgenda.length})
          </h3>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {agendaComCoordenadas.map((a, i) => (
              <div
                key={a.id}
                className="flex items-center justify-between p-2 rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                style={{ backgroundColor: 'var(--bg-secondary)' }}
                onClick={() => setSelectedMarker({ type: 'agenda', data: a })}
              >
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0" style={{ backgroundColor: statusColor(a.status) }}>{i + 1}</span>
                  <div>
                    <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>OS {a.numero_os}</span>
                    <span className="text-xs ml-2" style={{ color: 'var(--text-secondary)' }}>{a.cliente_cidade || a.cliente_nome}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-0.5">
                  <span className="text-xs" style={{ color: statusColor(a.status) }}>
                    {a.status === 'concluido' ? 'OK' : a.status === 'em_atendimento' ? 'Atendendo' : a.status === 'confirmado' ? 'Confirmado' : a.periodo || 'Pendente'}
                  </span>
                  <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{a.tecnico_nome}</span>
                </div>
              </div>
            ))}

            {agendaSemCoordenadas.length > 0 && (
              <div className="pt-1">
                <p className="text-[10px] flex items-center gap-1 mb-1.5" style={{ color: '#F59E0B' }}>
                  <AlertTriangle className="w-3 h-3" />
                  {agendaSemCoordenadas.length} OS sem coordenadas (não exibidas no mapa)
                </p>
                {agendaSemCoordenadas.map((a) => (
                  <div key={a.id} className="flex items-center justify-between p-2 rounded-lg mb-1" style={{ backgroundColor: 'var(--bg-secondary)', opacity: 0.6 }}>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-3.5 h-3.5 text-gray-500" />
                      <div>
                        <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>OS {a.numero_os}</span>
                        <span className="text-xs ml-2" style={{ color: 'var(--text-secondary)' }}>{a.cliente_nome}</span>
                      </div>
                    </div>
                    <span className="text-xs" style={{ color: statusColor(a.status) }}>
                      {a.status === 'concluido' ? 'OK' : a.status === 'confirmado' ? 'Confirmado' : a.periodo || 'Pendente'}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {filteredAgenda.length === 0 && (
              <p className="text-xs text-center py-4" style={{ color: 'var(--text-secondary)' }}>Nenhum atendimento agendado para hoje</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
