import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Zap, MapPin, User, Play, Clock, Coffee, Wrench, Calendar, ChevronRight,
  ChevronDown, ChevronUp, AlertTriangle, Plus, GripVertical, Trash2, Check,
  Loader2, Home, Route as RouteIcon, Save, X, Filter, Package, Building2,
  Timer, Sun, Moon, Sunrise, MapPinned, Navigation, CalendarDays, Settings2
} from 'lucide-react';
import { useOtimizador } from '../../contexts/OtimizadorContext';
import { supabase } from '../../lib/supabase';
import { geocodeAddress, buildOSAddress, getGoogleMapsApiKey, haversineDistance, estimateDriveTime, getRealTravelTime } from '../../lib/googleMapsHelper';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, DirectionsRenderer } from '@react-google-maps/api';

interface OSItem {
  id: string;
  numero_os: string;
  lat: number;
  lng: number;
  cliente_nome: string;
  cliente_cidade: string;
  cliente_bairro: string;
  cliente_endereco: string;
  aparelho_linha: string;
  dias_aberta: number;
  tempo_estimado_min: number;
  periodo_preferido?: 'manha' | 'tarde' | null;
  prioridade?: string;
  rota_nome?: string;
  rota_cor?: string;
}

interface ParadaItinerario {
  os: OSItem;
  ordem: number;
  distancia_km: number;
  tempo_deslocamento_min: number;
  horario_chegada: string;
  horario_saida: string;
  dia: number;
}

interface DiaItinerario {
  dia: number;
  data: string;
  eventos: Array<{
    tipo: 'saida_base' | 'deslocamento' | 'atendimento' | 'almoco' | 'pernoite' | 'retorno_base';
    horario_inicio: string;
    horario_fim: string;
    descricao: string;
    os?: OSItem;
    distancia_km?: number;
    duracao_min?: number;
    parada?: ParadaItinerario;
  }>;
  km_total: number;
  atendimentos: number;
}

const MAP_STYLES: google.maps.MapTypeStyle[] = [
  { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
];

function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

function minutesToTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

function addDaysToDate(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDateBR(date: Date): string {
  return date.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
}

function isColorDark(hexColor: string): boolean {
  const hex = hexColor.replace('#', '');
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance < 0.5;
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

function formatDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h === 0) return `${m}min`;
  if (m === 0) return `${h}h`;
  return `${h}h${m.toString().padStart(2, '0')}min`;
}

function getRouteTextColor(routeColor: string, isSelected: boolean): string {
  if (!isSelected) return 'var(--text-secondary)';
  if (isColorDark(routeColor)) return '#ffffff';
  return routeColor;
}

export default function MotorOtimizacaoNew() {
  const { selectedUnidade, tecnicosData, unidades } = useOtimizador();
  const { isLoaded } = useJsApiLoader({ id: 'google-map-motor', googleMapsApiKey: getGoogleMapsApiKey() });

  const [step, setStep] = useState<'config' | 'result'>('config');
  const [loading, setLoading] = useState(false);
  const [geocodingProgress, setGeocodingProgress] = useState({ done: 0, total: 0 });

  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  });
  const [dataFim, setDataFim] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 2);
    return d.toISOString().split('T')[0];
  });
  const [selectedTecnico, setSelectedTecnico] = useState('');
  const [horarioInicio, setHorarioInicio] = useState('08:00');
  const [horarioFim, setHorarioFim] = useState('18:00');
  const [horarioAlmoco, setHorarioAlmoco] = useState('12:00');
  const [duracaoAlmoco, setDuracaoAlmoco] = useState(60);
  const [tempoMedioReparo, setTempoMedioReparo] = useState(90);
  const [permitePernoite, setPermitePernoite] = useState(false);

  const [rotas, setRotas] = useState<Array<{ id: string; nome: string; cor: string; coluna_kanban: string; cidades: string[]; os_count: number }>>([]);
  const [selectedRotas, setSelectedRotas] = useState<string[]>([]);
  const [osList, setOsList] = useState<OSItem[]>([]);
  const [filteredOS, setFilteredOS] = useState<OSItem[]>([]);
  const [filterCidade, setFilterCidade] = useState('');
  const [filterProduto, setFilterProduto] = useState('');

  const [paradas, setParadas] = useState<ParadaItinerario[]>([]);
  const [osNaoRoteirizadas, setOsNaoRoteirizadas] = useState<OSItem[]>([]);
  const [itinerario, setItinerario] = useState<DiaItinerario[]>([]);
  const [metricas, setMetricas] = useState({ km_total: 0, tempo_total: 0, dias: 0, atendimentos: 0 });

  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [selectedMarker, setSelectedMarker] = useState<ParadaItinerario | null>(null);
  const [selectedOSId, setSelectedOSId] = useState<string | null>(null);
  const [expandedDays, setExpandedDays] = useState<number[]>([1]);
  const [savingOS, setSavingOS] = useState<string | null>(null);

  const [baseCoords, setBaseCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);

  useEffect(() => {
    if (selectedUnidade) {
      loadRotas();
      loadBaseCoords();
    }
  }, [selectedUnidade]);

  useEffect(() => {
    if (selectedTecnico) loadTecnicoConfig();
  }, [selectedTecnico]);

  useEffect(() => {
    let filtered = [...osList];
    if (filterCidade) {
      filtered = filtered.filter(os => os.cliente_cidade.toLowerCase().includes(filterCidade.toLowerCase()));
    }
    if (filterProduto) {
      filtered = filtered.filter(os => os.aparelho_linha?.toLowerCase().includes(filterProduto.toLowerCase()));
    }
    setFilteredOS(filtered);
  }, [osList, filterCidade, filterProduto]);

  const loadRotas = async () => {
    const [rotasDB, osDistinct] = await Promise.all([
      supabase.from('rotas').select('id, nome, cor, coluna_kanban, cidades').eq('unidade_id', selectedUnidade!).eq('ativa', true).not('coluna_kanban', 'is', null).order('nome'),
      supabase.from('os').select('coluna_kanban').eq('unidade_id', selectedUnidade!).like('coluna_kanban', 'rota_%'),
    ]);

    const cadastradas = (rotasDB.data ?? []) as { id: string; nome: string; cor: string; coluna_kanban: string; cidades: string[] }[];
    const colunasUsadas = new Set(cadastradas.map(r => r.coluna_kanban));

    const colunasDistintas = new Set(
      (osDistinct.data ?? []).map(r => r.coluna_kanban as string).filter(Boolean)
    );

    const extras: typeof cadastradas = [];
    for (const col of colunasDistintas) {
      if (!colunasUsadas.has(col)) {
        const sufixo = col.replace(/^rota_/, '');
        extras.push({
          id: col,
          nome: 'Rota ' + sufixo.charAt(0).toUpperCase() + sufixo.slice(1),
          cor: COR_ROTA[col] ?? '#6B7280',
          coluna_kanban: col,
          cidades: [],
        });
      }
    }

    const todasRotas = [...cadastradas, ...extras].sort((a, b) => a.nome.localeCompare(b.nome));

    const colunasTodasRotas = todasRotas.map(r => r.coluna_kanban).filter(Boolean);
    let osCountMap: Record<string, number> = {};
    if (colunasTodasRotas.length > 0) {
      const { data: osCount } = await supabase
        .from('os')
        .select('coluna_kanban')
        .eq('unidade_id', selectedUnidade!)
        .in('coluna_kanban', colunasTodasRotas);
      for (const os of osCount ?? []) {
        osCountMap[os.coluna_kanban] = (osCountMap[os.coluna_kanban] ?? 0) + 1;
      }
    }

    setRotas(todasRotas.map(r => ({ ...r, os_count: osCountMap[r.coluna_kanban] ?? 0 })));
  };

  const loadBaseCoords = async () => {
    const { data } = await supabase.from('unidades').select('latitude, longitude, nome').eq('id', selectedUnidade!).maybeSingle();
    if (data?.latitude && data?.longitude) {
      setBaseCoords({ lat: Number(data.latitude), lng: Number(data.longitude) });
    }
  };

  const loadTecnicoConfig = async () => {
    const { data } = await supabase.from('usuarios')
      .select('horario_inicio_expediente, horario_fim_expediente, duracao_almoco_minutos')
      .eq('id', selectedTecnico).maybeSingle();
    if (data) {
      if (data.horario_inicio_expediente) setHorarioInicio(data.horario_inicio_expediente);
      if (data.horario_fim_expediente) setHorarioFim(data.horario_fim_expediente);
      if (data.duracao_almoco_minutos) setDuracaoAlmoco(data.duracao_almoco_minutos);
    }
  };

  const loadOSForRotas = async () => {
    if (!selectedUnidade || selectedRotas.length === 0) return;
    setLoading(true);

    const rotaCols = selectedRotas.map(id => {
      const r = rotas.find(rt => rt.id === id);
      return r?.coluna_kanban || id;
    }).filter(Boolean);

    const { data: osData } = await supabase
      .from('os')
      .select('id, numero_os_samsung, numero_os_interna, cliente_nome, cliente_cidade, cliente_bairro, cliente_logradouro, cliente_numero, cliente_estado, cliente_cep, cliente_endereco, aparelho_linha, tipo_atendimento, lat, lng, coluna_kanban, created_at, periodo_agendamento')
      .eq('unidade_id', selectedUnidade!)
      .in('coluna_kanban', rotaCols as string[]);

    if (!osData) {
      setLoading(false);
      return;
    }

    const items: OSItem[] = osData.map(os => {
      const diasAberta = Math.floor((Date.now() - new Date(os.created_at).getTime()) / 86400000);
      const rotaMatch = rotas.find(r => r.coluna_kanban === os.coluna_kanban);

      return {
        id: os.id,
        numero_os: os.numero_os_samsung || os.numero_os_interna || '',
        lat: Number(os.lat) || 0,
        lng: Number(os.lng) || 0,
        cliente_nome: os.cliente_nome || '',
        cliente_cidade: os.cliente_cidade || '',
        cliente_bairro: os.cliente_bairro || '',
        cliente_endereco: buildOSAddress(os),
        aparelho_linha: os.aparelho_linha || '',
        dias_aberta: diasAberta,
        tempo_estimado_min: tempoMedioReparo,
        periodo_preferido: os.periodo_agendamento as any,
        prioridade: 'normal',
        rota_nome: rotaMatch?.nome,
        rota_cor: rotaMatch?.cor || '#3B82F6',
      };
    });

    const semCoord = items.filter(os => !os.lat || !os.lng);
    if (semCoord.length > 0) {
      setGeocodingProgress({ done: 0, total: semCoord.length });
      for (let i = 0; i < semCoord.length; i++) {
        const os = semCoord[i];
        const coords = await geocodeAddress(os.cliente_endereco);
        if (coords) {
          os.lat = coords.lat;
          os.lng = coords.lng;
          await supabase.from('os').update({ lat: coords.lat, lng: coords.lng }).eq('id', os.id);
        }
        setGeocodingProgress({ done: i + 1, total: semCoord.length });
      }
    }

    setOsList(items);
    setFilteredOS(items);
    setLoading(false);
  };

  useEffect(() => {
    if (selectedRotas.length > 0 && rotas.length > 0 && selectedUnidade) {
      loadOSForRotas();
    }
  }, [selectedRotas, rotas, selectedUnidade]);

  const cidades = useMemo(() => {
    const set = new Set<string>();
    osList.forEach(os => { if (os.cliente_cidade) set.add(os.cliente_cidade); });
    return Array.from(set).sort();
  }, [osList]);

  const produtos = useMemo(() => {
    const set = new Set<string>();
    osList.forEach(os => { if (os.aparelho_linha) set.add(os.aparelho_linha); });
    return Array.from(set).sort();
  }, [osList]);

  const maxDias = useMemo(() => {
    const inicio = new Date(dataInicio);
    const fim = new Date(dataFim);
    return Math.max(1, Math.ceil((fim.getTime() - inicio.getTime()) / 86400000) + 1);
  }, [dataInicio, dataFim]);

  const skillMatch = useCallback((osLinha: string, habs: string[]): boolean => {
    if (habs.length === 0) return true;
    if (!osLinha) return true;
    const norm = osLinha.trim().toUpperCase();
    if (!norm) return true;
    return habs.some(h => h === norm || h.includes(norm) || norm.includes(h));
  }, []);

  const runOptimization = useCallback(async () => {
    if (!baseCoords || filteredOS.length === 0) return;
    setLoading(true);

    let osParaOtimizar = [...filteredOS];
    const osSemCoordInicial = osParaOtimizar.filter(os => !os.lat || !os.lng);

    if (osSemCoordInicial.length > 0) {
      setGeocodingProgress({ done: 0, total: osSemCoordInicial.length });
      for (let i = 0; i < osSemCoordInicial.length; i++) {
        const os = osSemCoordInicial[i];
        const coords = await geocodeAddress(os.cliente_endereco);
        if (coords) {
          const idx = osParaOtimizar.findIndex(o => o.id === os.id);
          if (idx >= 0) {
            osParaOtimizar[idx] = { ...osParaOtimizar[idx], lat: coords.lat, lng: coords.lng };
          }
          await supabase.from('os').update({ lat: coords.lat, lng: coords.lng }).eq('id', os.id);
        }
        setGeocodingProgress({ done: i + 1, total: osSemCoordInicial.length });
      }
      setGeocodingProgress({ done: 0, total: 0 });
      setFilteredOS(osParaOtimizar);
      setOsList(prev => {
        const newList = [...prev];
        osParaOtimizar.forEach(updated => {
          const idx = newList.findIndex(o => o.id === updated.id);
          if (idx >= 0) newList[idx] = updated;
        });
        return newList;
      });
    }

    const tecObj = tecnicosData.find((t: any) => t.id === selectedTecnico);
    const habilidades: string[] = (tecObj?.habilidades ?? []).map((h: string) => h.trim().toUpperCase());

    const osComCoord: OSItem[] = [];
    const resultNaoRoteirizadas: OSItem[] = [];

    for (const os of osParaOtimizar) {
      if (!os.lat || !os.lng) {
        resultNaoRoteirizadas.push(os);
        continue;
      }
      if (!skillMatch(os.aparelho_linha, habilidades)) {
        resultNaoRoteirizadas.push(os);
        continue;
      }
      osComCoord.push(os);
    }

    if (osComCoord.length === 0) {
      setParadas([]);
      setOsNaoRoteirizadas(resultNaoRoteirizadas);
      generateItinerary([]);
      setStep('result');
      setLoading(false);
      return;
    }

    const inicioMin = timeToMinutes(horarioInicio);
    const fimMin = timeToMinutes(horarioFim);
    const almocoMin = timeToMinutes(horarioAlmoco);
    const withDist = osComCoord.map(os => ({
      os,
      dist: haversineDistance(baseCoords, { lat: os.lat, lng: os.lng }),
    }));
    withDist.sort((a, b) => b.dist - a.dist);
    const half = Math.ceil(withDist.length / 2);
    const avgAgeFar = withDist.slice(0, half).reduce((s, x) => s + x.os.dias_aberta, 0) / half;
    const avgAgeNear = withDist.slice(half).reduce((s, x) => s + x.os.dias_aberta, 0) / Math.max(withDist.length - half, 1);
    const farthestFirst = avgAgeFar > avgAgeNear && osComCoord.length >= 3;

    const ordered: OSItem[] = [];
    const remaining = [...osComCoord];
    let tspPos = { ...baseCoords };

    if (farthestFirst && remaining.length > 0) {
      remaining.sort((a, b) =>
        haversineDistance(baseCoords, { lat: b.lat, lng: b.lng }) -
        haversineDistance(baseCoords, { lat: a.lat, lng: a.lng })
      );
      const farthest = remaining.shift()!;
      ordered.push(farthest);
      tspPos = { lat: farthest.lat, lng: farthest.lng };
    }

    while (remaining.length > 0) {
      let bestIdx = 0;
      let bestDist = Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const d = haversineDistance(tspPos, { lat: remaining[i].lat, lng: remaining[i].lng });
        if (d < bestDist) { bestDist = d; bestIdx = i; }
      }
      ordered.push(remaining[bestIdx]);
      tspPos = { lat: remaining[bestIdx].lat, lng: remaining[bestIdx].lng };
      remaining.splice(bestIdx, 1);
    }

    const manha = ordered.filter(os => os.periodo_preferido === 'manha');
    const semPref = ordered.filter(os => !os.periodo_preferido);
    const tarde = ordered.filter(os => os.periodo_preferido === 'tarde');
    const osFinais = [...manha, ...semPref, ...tarde];

    const resultParadas: ParadaItinerario[] = [];
    let dia = 1;
    let currentMin = inicioMin;
    let almocoFeitoDia = false;
    let currentPos = { ...baseCoords };

    for (const os of osFinais) {
      const dist = haversineDistance(currentPos, { lat: os.lat, lng: os.lng }) * 1.3;
      const googleTime = await getRealTravelTime(currentPos, { lat: os.lat, lng: os.lng });
      let travelMin = googleTime?.duration ?? estimateDriveTime(dist, 60);
      const realDist = googleTime?.distance ?? dist;

      let travelRemaining = travelMin;
      let tmpDia = dia;
      let tmpMin = currentMin;
      let tmpAlmoco = almocoFeitoDia;

      while (travelRemaining > 0 && tmpDia <= maxDias) {
        if (!tmpAlmoco && tmpMin < almocoMin && tmpMin + travelRemaining >= almocoMin) {
          const driveBeforeLunch = almocoMin - tmpMin;
          travelRemaining -= driveBeforeLunch;
          tmpMin = almocoMin + duracaoAlmoco;
          tmpAlmoco = true;
          continue;
        }
        if (!tmpAlmoco && tmpMin >= almocoMin) {
          tmpAlmoco = true;
        }

        const tempoRestanteDia = fimMin - tmpMin;
        if (tempoRestanteDia <= 0) {
          if (!permitePernoite || tmpDia >= maxDias) break;
          tmpDia++;
          tmpMin = inicioMin;
          tmpAlmoco = false;
          continue;
        }

        if (travelRemaining <= tempoRestanteDia) {
          tmpMin += travelRemaining;
          travelRemaining = 0;
        } else {
          travelRemaining -= tempoRestanteDia;
          if (!permitePernoite || tmpDia >= maxDias) break;
          tmpDia++;
          tmpMin = inicioMin;
          tmpAlmoco = false;
        }
      }

      if (travelRemaining > 0) {
        resultNaoRoteirizadas.push(os);
        continue;
      }

      const chegadaMin = tmpMin;
      if (!tmpAlmoco && chegadaMin >= almocoMin) {
        tmpAlmoco = true;
      }

      const saidaMin = chegadaMin + tempoMedioReparo;

      if (saidaMin > fimMin) {
        if (permitePernoite && tmpDia < maxDias) {
          tmpDia++;
          const reparoInicio = inicioMin;
          const reparoFim = reparoInicio + tempoMedioReparo;

          resultParadas.push({
            os,
            ordem: resultParadas.length + 1,
            distancia_km: Math.round(realDist * 10) / 10,
            tempo_deslocamento_min: travelMin,
            horario_chegada: minutesToTime(reparoInicio),
            horario_saida: minutesToTime(reparoFim),
            dia: tmpDia,
          });

          dia = tmpDia;
          currentMin = reparoFim;
          almocoFeitoDia = false;
          currentPos = { lat: os.lat, lng: os.lng };
        } else {
          resultNaoRoteirizadas.push(os);
        }
        continue;
      }

      resultParadas.push({
        os,
        ordem: resultParadas.length + 1,
        distancia_km: Math.round(realDist * 10) / 10,
        tempo_deslocamento_min: travelMin,
        horario_chegada: minutesToTime(chegadaMin),
        horario_saida: minutesToTime(saidaMin),
        dia: tmpDia,
      });

      dia = tmpDia;
      currentMin = saidaMin;
      almocoFeitoDia = tmpAlmoco;
      currentPos = { lat: os.lat, lng: os.lng };
    }

    setParadas(resultParadas);
    setOsNaoRoteirizadas(resultNaoRoteirizadas);
    generateItinerary(resultParadas);
    setStep('result');
    setLoading(false);
  }, [baseCoords, filteredOS, horarioInicio, horarioFim, horarioAlmoco, duracaoAlmoco, tempoMedioReparo, permitePernoite, maxDias, selectedTecnico, tecnicosData, skillMatch]);

  const generateItinerary = useCallback((paradasList: ParadaItinerario[]) => {
    if (!baseCoords) return;

    if (paradasList.length === 0) {
      setItinerario([]);
      setMetricas({ km_total: 0, tempo_total: 0, dias: 0, atendimentos: 0 });
      return;
    }

    const dataBase = new Date(dataInicio);
    const inicioMin = timeToMinutes(horarioInicio);
    const fimMin = timeToMinutes(horarioFim);
    const almocoMin = timeToMinutes(horarioAlmoco);
    const almocoFimMin = almocoMin + duracaoAlmoco;

    const totalDias = Math.max(...paradasList.map(p => p.dia));
    const diasMap: Record<number, { eventos: DiaItinerario['eventos']; kmDia: number; atendimentos: number }> = {};

    for (let d = 1; d <= totalDias; d++) {
      diasMap[d] = { eventos: [], kmDia: 0, atendimentos: 0 };
    }

    let cursorDia = 1;
    let cursorMin = inicioMin;
    let cursorPos = { ...baseCoords };
    let almocoFeitoDia: Record<number, boolean> = {};

    const addAlmoco = (d: number) => {
      if (!almocoFeitoDia[d]) {
        diasMap[d].eventos.push({
          tipo: 'almoco',
          horario_inicio: horarioAlmoco,
          horario_fim: minutesToTime(almocoFimMin),
          descricao: 'Pausa para Almoco',
          duracao_min: duracaoAlmoco,
        });
        almocoFeitoDia[d] = true;
      }
    };

    diasMap[1].eventos.push({
      tipo: 'saida_base',
      horario_inicio: horarioInicio,
      horario_fim: horarioInicio,
      descricao: 'Saida da base',
    });

    for (const parada of paradasList) {
      const travelTotal = parada.tempo_deslocamento_min;
      const totalDistKm = parada.distancia_km;
      let travelRemaining = travelTotal;
      let driveStartMin = cursorMin;
      let driveStartDia = cursorDia;
      const kmPerMin = travelTotal > 0 ? totalDistKm / travelTotal : 0;

      while (travelRemaining > 0) {
        if (!diasMap[driveStartDia]) {
          diasMap[driveStartDia] = { eventos: [], kmDia: 0, atendimentos: 0 };
        }

        if (!almocoFeitoDia[driveStartDia] && driveStartMin < almocoMin && driveStartMin + travelRemaining >= almocoMin) {
          const driveBeforeLunch = almocoMin - driveStartMin;
          const kmSegment = Math.round(kmPerMin * driveBeforeLunch * 10) / 10;
          if (driveBeforeLunch > 0) {
            diasMap[driveStartDia].eventos.push({
              tipo: 'deslocamento',
              horario_inicio: minutesToTime(driveStartMin),
              horario_fim: minutesToTime(almocoMin),
              descricao: 'Em Deslocamento',
              distancia_km: kmSegment,
              duracao_min: driveBeforeLunch,
            });
            diasMap[driveStartDia].kmDia += kmSegment;
          }
          travelRemaining -= driveBeforeLunch;
          addAlmoco(driveStartDia);
          driveStartMin = almocoFimMin;
          continue;
        }
        if (!almocoFeitoDia[driveStartDia] && driveStartMin >= almocoMin) {
          addAlmoco(driveStartDia);
        }

        const restoDia = fimMin - driveStartMin;
        if (restoDia <= 0) {
          diasMap[driveStartDia].eventos.push({
            tipo: 'pernoite',
            horario_inicio: minutesToTime(fimMin),
            horario_fim: horarioFim,
            descricao: 'Pernoite - em transito',
          });
          driveStartDia++;
          driveStartMin = inicioMin;
          almocoFeitoDia[driveStartDia] = false;
          if (!diasMap[driveStartDia]) {
            diasMap[driveStartDia] = { eventos: [], kmDia: 0, atendimentos: 0 };
          }
          diasMap[driveStartDia].eventos.push({
            tipo: 'saida_base',
            horario_inicio: horarioInicio,
            horario_fim: horarioInicio,
            descricao: 'Continua deslocamento',
          });
          continue;
        }

        if (travelRemaining <= restoDia) {
          const kmSegment = Math.round(kmPerMin * travelRemaining * 10) / 10;
          const chegadaMin = driveStartMin + travelRemaining;
          diasMap[driveStartDia].eventos.push({
            tipo: 'deslocamento',
            horario_inicio: minutesToTime(driveStartMin),
            horario_fim: minutesToTime(chegadaMin),
            descricao: 'Em Deslocamento',
            distancia_km: kmSegment,
            duracao_min: travelRemaining,
          });
          diasMap[driveStartDia].kmDia += kmSegment;
          driveStartMin = chegadaMin;
          travelRemaining = 0;
        } else {
          const kmSegment = Math.round(kmPerMin * restoDia * 10) / 10;
          diasMap[driveStartDia].eventos.push({
            tipo: 'deslocamento',
            horario_inicio: minutesToTime(driveStartMin),
            horario_fim: minutesToTime(fimMin),
            descricao: 'Em Deslocamento',
            distancia_km: kmSegment,
            duracao_min: restoDia,
          });
          diasMap[driveStartDia].kmDia += kmSegment;
          travelRemaining -= restoDia;

          diasMap[driveStartDia].eventos.push({
            tipo: 'pernoite',
            horario_inicio: minutesToTime(fimMin),
            horario_fim: horarioFim,
            descricao: 'Pernoite - em transito',
          });
          driveStartDia++;
          driveStartMin = inicioMin;
          almocoFeitoDia[driveStartDia] = false;
          if (!diasMap[driveStartDia]) {
            diasMap[driveStartDia] = { eventos: [], kmDia: 0, atendimentos: 0 };
          }
          diasMap[driveStartDia].eventos.push({
            tipo: 'saida_base',
            horario_inicio: horarioInicio,
            horario_fim: horarioInicio,
            descricao: 'Continua deslocamento',
          });
        }
      }

      const atendimentoDia = parada.dia;
      if (!diasMap[atendimentoDia]) {
        diasMap[atendimentoDia] = { eventos: [], kmDia: 0, atendimentos: 0 };
      }

      const saidaMinFinal = timeToMinutes(parada.horario_saida);

      diasMap[atendimentoDia].eventos.push({
        tipo: 'atendimento',
        horario_inicio: parada.horario_chegada,
        horario_fim: parada.horario_saida,
        descricao: `OS ${parada.os.numero_os} - ${parada.os.cliente_nome}`,
        os: parada.os,
        parada,
      });
      diasMap[atendimentoDia].atendimentos++;

      cursorDia = atendimentoDia;
      cursorMin = saidaMinFinal;
      cursorPos = { lat: parada.os.lat, lng: parada.os.lng };
    }

    const lastParada = paradasList[paradasList.length - 1];
    const lastDia = lastParada.dia;
    const retornoKm = haversineDistance(cursorPos, baseCoords) * 1.3;
    const retornoMin = estimateDriveTime(retornoKm, 60);
    const retornoStartMin = timeToMinutes(lastParada.horario_saida);

    if (!permitePernoite || retornoStartMin + retornoMin <= fimMin) {
      diasMap[lastDia].eventos.push({
        tipo: 'retorno_base',
        horario_inicio: lastParada.horario_saida,
        horario_fim: minutesToTime(Math.min(retornoStartMin + retornoMin, fimMin)),
        descricao: 'Retorno a base',
        distancia_km: Math.round(retornoKm * 10) / 10,
        duracao_min: retornoMin,
      });
      diasMap[lastDia].kmDia += retornoKm;
    } else {
      let retRemaining = retornoMin;
      let retDia = lastDia;
      let retMin = retornoStartMin;
      const retKmPerMin = retornoMin > 0 ? retornoKm / retornoMin : 0;

      while (retRemaining > 0) {
        const restoDia = fimMin - retMin;
        if (restoDia <= 0) {
          if (!diasMap[retDia]) diasMap[retDia] = { eventos: [], kmDia: 0, atendimentos: 0 };
          diasMap[retDia].eventos.push({
            tipo: 'pernoite', horario_inicio: minutesToTime(fimMin), horario_fim: horarioFim, descricao: 'Pernoite - retornando',
          });
          retDia++; retMin = inicioMin;
          if (!diasMap[retDia]) diasMap[retDia] = { eventos: [], kmDia: 0, atendimentos: 0 };
          continue;
        }
        if (retRemaining <= restoDia) {
          const km = Math.round(retKmPerMin * retRemaining * 10) / 10;
          if (!diasMap[retDia]) diasMap[retDia] = { eventos: [], kmDia: 0, atendimentos: 0 };
          diasMap[retDia].eventos.push({
            tipo: 'retorno_base',
            horario_inicio: minutesToTime(retMin),
            horario_fim: minutesToTime(retMin + retRemaining),
            descricao: 'Retorno a base',
            distancia_km: km, duracao_min: retRemaining,
          });
          diasMap[retDia].kmDia += km;
          retRemaining = 0;
        } else {
          const km = Math.round(retKmPerMin * restoDia * 10) / 10;
          if (!diasMap[retDia]) diasMap[retDia] = { eventos: [], kmDia: 0, atendimentos: 0 };
          diasMap[retDia].eventos.push({
            tipo: 'deslocamento',
            horario_inicio: minutesToTime(retMin), horario_fim: minutesToTime(fimMin),
            descricao: 'Retornando a base', distancia_km: km, duracao_min: restoDia,
          });
          diasMap[retDia].kmDia += km;
          retRemaining -= restoDia;
          diasMap[retDia].eventos.push({
            tipo: 'pernoite', horario_inicio: minutesToTime(fimMin), horario_fim: horarioFim, descricao: 'Pernoite - retornando',
          });
          retDia++; retMin = inicioMin;
          if (!diasMap[retDia]) diasMap[retDia] = { eventos: [], kmDia: 0, atendimentos: 0 };
        }
      }
    }

    const diasKeys = Object.keys(diasMap).map(Number).sort((a, b) => a - b);
    const dias: DiaItinerario[] = diasKeys.map((d, idx) => ({
      dia: idx + 1,
      data: formatDateBR(addDaysToDate(dataBase, d - 1)),
      eventos: diasMap[d].eventos,
      km_total: Math.round(diasMap[d].kmDia * 10) / 10,
      atendimentos: diasMap[d].atendimentos,
    }));

    setItinerario(dias);
    setExpandedDays([1]);

    const kmTotal = dias.reduce((s, d) => s + d.km_total, 0);
    const tempoTotal = paradasList.reduce((s, p) => s + p.tempo_deslocamento_min + tempoMedioReparo, 0);
    setMetricas({
      km_total: Math.round(kmTotal * 10) / 10,
      tempo_total: tempoTotal,
      dias: dias.length,
      atendimentos: paradasList.length,
    });
  }, [baseCoords, dataInicio, horarioInicio, horarioFim, horarioAlmoco, duracaoAlmoco, permitePernoite, tempoMedioReparo]);

  const handleReorder = useCallback((fromIdx: number, toIdx: number) => {
    if (fromIdx === toIdx) return;

    const newParadas = [...paradas];
    const [moved] = newParadas.splice(fromIdx, 1);
    newParadas.splice(toIdx, 0, moved);

    recalculateParadas(newParadas);
  }, [paradas, baseCoords, horarioInicio, horarioFim, horarioAlmoco, duracaoAlmoco, tempoMedioReparo, permitePernoite, maxDias]);

  const recalculateParadas = useCallback((newParadas: ParadaItinerario[]) => {
    if (!baseCoords) return;

    const inicioMin = timeToMinutes(horarioInicio);
    const fimMin = timeToMinutes(horarioFim);
    const almocoMin = timeToMinutes(horarioAlmoco);

    let currentPos = { ...baseCoords };
    let currentMin = inicioMin;
    let dia = 1;
    let almocoFeito = false;

    const recalculated: ParadaItinerario[] = [];

    for (let idx = 0; idx < newParadas.length; idx++) {
      const p = newParadas[idx];
      const dist = haversineDistance(currentPos, { lat: p.os.lat, lng: p.os.lng }) * 1.3;
      let travelMin = estimateDriveTime(dist, 60);
      let travelRemaining = travelMin;
      let tmpDia = dia;
      let tmpMin = currentMin;
      let tmpAlmoco = almocoFeito;

      while (travelRemaining > 0 && tmpDia <= maxDias) {
        if (!tmpAlmoco && tmpMin < almocoMin && tmpMin + travelRemaining >= almocoMin) {
          const driveBeforeLunch = almocoMin - tmpMin;
          travelRemaining -= driveBeforeLunch;
          tmpMin = almocoMin + duracaoAlmoco;
          tmpAlmoco = true;
          continue;
        }
        if (!tmpAlmoco && tmpMin >= almocoMin) tmpAlmoco = true;

        const restoDia = fimMin - tmpMin;
        if (restoDia <= 0) {
          if (!permitePernoite || tmpDia >= maxDias) break;
          tmpDia++; tmpMin = inicioMin; tmpAlmoco = false;
          continue;
        }
        if (travelRemaining <= restoDia) {
          tmpMin += travelRemaining;
          travelRemaining = 0;
        } else {
          travelRemaining -= restoDia;
          if (!permitePernoite || tmpDia >= maxDias) break;
          tmpDia++; tmpMin = inicioMin; tmpAlmoco = false;
        }
      }

      if (travelRemaining > 0) continue;

      let chegadaMin = tmpMin;
      if (!tmpAlmoco && chegadaMin >= almocoMin) tmpAlmoco = true;
      let saidaMin = chegadaMin + tempoMedioReparo;

      if (saidaMin > fimMin && permitePernoite && tmpDia < maxDias) {
        tmpDia++;
        chegadaMin = inicioMin;
        saidaMin = inicioMin + tempoMedioReparo;
        tmpAlmoco = false;
      }

      recalculated.push({
        ...p,
        ordem: recalculated.length + 1,
        distancia_km: Math.round(dist * 10) / 10,
        tempo_deslocamento_min: travelMin,
        horario_chegada: minutesToTime(chegadaMin),
        horario_saida: minutesToTime(saidaMin),
        dia: tmpDia,
      });

      dia = tmpDia;
      currentMin = saidaMin;
      almocoFeito = tmpAlmoco;
      currentPos = { lat: p.os.lat, lng: p.os.lng };
    }

    setParadas(recalculated);
    generateItinerary(recalculated);
  }, [baseCoords, horarioInicio, horarioFim, horarioAlmoco, duracaoAlmoco, tempoMedioReparo, permitePernoite, maxDias, generateItinerary]);

  const handleRemoveFromRoute = useCallback((idx: number) => {
    const removed = paradas[idx];
    const newParadas = paradas.filter((_, i) => i !== idx);
    setOsNaoRoteirizadas(prev => [...prev, removed.os]);
    recalculateParadas(newParadas);
  }, [paradas, recalculateParadas]);

  const handleAddToRoute = useCallback((os: OSItem) => {
    if (!baseCoords) return;

    let bestIdx = paradas.length;
    let bestScore = Infinity;

    for (let i = 0; i <= paradas.length; i++) {
      const prevPos = i === 0 ? baseCoords : { lat: paradas[i - 1].os.lat, lng: paradas[i - 1].os.lng };
      const nextPos = i === paradas.length ? baseCoords : { lat: paradas[i].os.lat, lng: paradas[i].os.lng };

      const distToPrev = haversineDistance(prevPos, { lat: os.lat, lng: os.lng });
      const distToNext = haversineDistance({ lat: os.lat, lng: os.lng }, nextPos);
      const origDist = haversineDistance(prevPos, nextPos);

      const addedDist = distToPrev + distToNext - origDist;
      if (addedDist < bestScore) {
        bestScore = addedDist;
        bestIdx = i;
      }
    }

    const newParadas = [...paradas];
    newParadas.splice(bestIdx, 0, {
      os,
      ordem: 0,
      distancia_km: 0,
      tempo_deslocamento_min: 0,
      horario_chegada: '00:00',
      horario_saida: '00:00',
      dia: 1,
    });

    setOsNaoRoteirizadas(prev => prev.filter(o => o.id !== os.id));
    recalculateParadas(newParadas);
  }, [paradas, baseCoords, recalculateParadas]);

  const handleSaveAgendamento = useCallback(async (parada: ParadaItinerario) => {
    if (!selectedTecnico || !selectedUnidade) return;

    setSavingOS(parada.os.id);

    const dataBase = new Date(dataInicio);
    const dataAgend = addDaysToDate(dataBase, parada.dia - 1);
    const dataStr = dataAgend.toISOString().split('T')[0];
    const periodo = timeToMinutes(parada.horario_chegada) < timeToMinutes('12:00') ? 'manha' : 'tarde';

    const { data: existingAgend } = await supabase
      .from('agendamentos')
      .select('id')
      .eq('os_id', parada.os.id)
      .eq('tecnico_id', selectedTecnico)
      .maybeSingle();

    if (existingAgend) {
      await supabase.from('agendamentos').update({
        data_agendamento: dataStr,
        status: 'agendado',
        ordem_sugerida: parada.ordem,
      }).eq('id', existingAgend.id);
    } else {
      await supabase.from('agendamentos').insert({
        os_id: parada.os.id,
        unidade_id: selectedUnidade,
        tecnico_id: selectedTecnico,
        data_agendamento: dataStr,
        status: 'agendado',
        confirmado_cliente: false,
        ordem_sugerida: parada.ordem,
      });
    }

    await supabase.from('os').update({
      tecnico_agendado_id: selectedTecnico,
      data_agendamento: dataStr,
      periodo_agendamento: periodo,
    }).eq('id', parada.os.id);

    setSavingOS(null);
  }, [selectedTecnico, selectedUnidade, dataInicio]);

  const handleSaveAllAgendamentos = useCallback(async () => {
    if (!selectedTecnico || !selectedUnidade) return;
    setLoading(true);

    for (const parada of paradas) {
      await handleSaveAgendamento(parada);
    }

    setLoading(false);
  }, [paradas, handleSaveAgendamento, selectedTecnico, selectedUnidade]);

  const mapRef = useRef<google.maps.Map | null>(null);

  const mapCenter = useMemo(() => {
    if (baseCoords) return baseCoords;
    if (paradas.length > 0) return { lat: paradas[0].os.lat, lng: paradas[0].os.lng };
    return { lat: -23.55, lng: -46.63 };
  }, [baseCoords, paradas]);

  const fitMapBounds = useCallback(() => {
    if (!mapRef.current) return;
    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    if (baseCoords) {
      bounds.extend(baseCoords);
      hasPoints = true;
    }

    filteredOS.filter(os => os.lat && os.lng).forEach(os => {
      bounds.extend({ lat: os.lat, lng: os.lng });
      hasPoints = true;
    });

    paradas.forEach(p => {
      bounds.extend({ lat: p.os.lat, lng: p.os.lng });
      hasPoints = true;
    });

    if (hasPoints) {
      mapRef.current.fitBounds(bounds, 50);
    }
  }, [baseCoords, filteredOS, paradas]);

  useEffect(() => {
    if (mapRef.current && (filteredOS.length > 0 || paradas.length > 0)) {
      setTimeout(fitMapBounds, 100);
    }
  }, [filteredOS, paradas, fitMapBounds]);

  useEffect(() => {
    if (!isLoaded || !baseCoords || paradas.length === 0) {
      setDirections(null);
      return;
    }

    const directionsService = new google.maps.DirectionsService();

    const waypoints = paradas.map(p => ({
      location: { lat: p.os.lat, lng: p.os.lng },
      stopover: true,
    }));

    directionsService.route(
      {
        origin: baseCoords,
        destination: baseCoords,
        waypoints: waypoints,
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false,
      },
      (result, status) => {
        if (status === google.maps.DirectionsStatus.OK && result) {
          setDirections(result);
        } else {
          console.warn('Directions request failed:', status);
          setDirections(null);
        }
      }
    );
  }, [isLoaded, baseCoords, paradas]);

  const tecnicoNome = useMemo(() => {
    const t = tecnicosData.find((t: any) => t.id === selectedTecnico);
    return t?.nome || '';
  }, [tecnicosData, selectedTecnico]);

  const unidadeNome = useMemo(() => {
    const u = unidades.find((u: any) => u.id === selectedUnidade);
    return u?.nome || '';
  }, [unidades, selectedUnidade]);

  if (step === 'config') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Zap className="w-5 h-5" style={{ color: '#FFBF00' }} />
              Roteirizador Inteligente
            </h2>
            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
              Configure os parametros e otimize a rota do tecnico
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
              <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <CalendarDays className="w-4 h-4" style={{ color: '#3B82F6' }} />
                Periodo da Rota
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Data Inicio</label>
                  <input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm"
                    style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Data Fim</label>
                  <input
                    type="date"
                    value={dataFim}
                    onChange={(e) => setDataFim(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm"
                    style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                  />
                </div>
              </div>
              {maxDias > 1 && (
                <div className="mt-3 flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="pernoite"
                    checked={permitePernoite}
                    onChange={(e) => setPermitePernoite(e.target.checked)}
                    className="w-4 h-4 rounded"
                    style={{ accentColor: '#FFBF00' }}
                  />
                  <label htmlFor="pernoite" className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Permitir pernoite ({maxDias} dias disponiveis)
                  </label>
                </div>
              )}
            </div>

            <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
              <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <User className="w-4 h-4" style={{ color: '#10B981' }} />
                Tecnico e Horarios
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Técnico</label>
                  <select
                    value={selectedTecnico}
                    onChange={(e) => setSelectedTecnico(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm"
                    style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                  >
                    <option value="">Selecione um técnico...</option>
                    {tecnicosData.map((t: any) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                  </select>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1.5 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                      <Sunrise className="w-3 h-3" /> Inicio
                    </label>
                    <input
                      type="time"
                      value={horarioInicio}
                      onChange={(e) => setHorarioInicio(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                      <Moon className="w-3 h-3" /> Fim
                    </label>
                    <input
                      type="time"
                      value={horarioFim}
                      onChange={(e) => setHorarioFim(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                      <Coffee className="w-3 h-3" /> Almoco
                    </label>
                    <input
                      type="time"
                      value={horarioAlmoco}
                      onChange={(e) => setHorarioAlmoco(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1.5 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                      <Timer className="w-3 h-3" /> Dur. Almoco
                    </label>
                    <select
                      value={duracaoAlmoco}
                      onChange={(e) => setDuracaoAlmoco(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-lg text-sm"
                      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                    >
                      <option value={30}>30 min</option>
                      <option value={45}>45 min</option>
                      <option value={60}>1h</option>
                      <option value={90}>1h30</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1.5 flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                    <Wrench className="w-3 h-3" /> Tempo Medio Reparo
                  </label>
                  <select
                    value={tempoMedioReparo}
                    onChange={(e) => setTempoMedioReparo(Number(e.target.value))}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                  >
                    <option value={45}>45 min</option>
                    <option value={60}>1h</option>
                    <option value={90}>1h30</option>
                    <option value={120}>2h</option>
                    <option value={150}>2h30</option>
                    <option value={180}>3h</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
              <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <RouteIcon className="w-4 h-4" style={{ color: '#EC4899' }} />
                Selecionar Rotas
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {rotas.map((rota) => {
                  const sel = selectedRotas.includes(rota.id);
                  const isDark = isColorDark(rota.cor || '#3B82F6');
                  const textColor = getRouteTextColor(rota.cor || '#3B82F6', sel);
                  const bgColor = sel
                    ? (isDark ? rota.cor + '40' : rota.cor + '20')
                    : 'var(--bg-secondary)';
                  const borderColor = sel
                    ? (isDark ? '#ffffff' : rota.cor)
                    : 'var(--border-primary)';
                  return (
                    <button
                      key={rota.id}
                      onClick={() => setSelectedRotas(sel ? selectedRotas.filter(id => id !== rota.id) : [...selectedRotas, rota.id])}
                      className="flex items-center gap-2 p-3 rounded-xl text-sm font-medium transition-all"
                      style={{
                        backgroundColor: bgColor,
                        border: `2px solid ${borderColor}`,
                        color: textColor,
                      }}
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: rota.cor, border: isDark ? '1px solid #666' : 'none' }} />
                      <span className="truncate">{rota.nome}</span>
                      {rota.os_count > 0 && (
                        <span className="text-[10px] opacity-70">({rota.os_count} OS)</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedRotas.length > 0 && (
              <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <Package className="w-4 h-4" style={{ color: '#F59E0B' }} />
                    Ordens de Servico ({filteredOS.length})
                  </h3>
                  <div className="flex items-center gap-2">
                    <select
                      value={filterCidade}
                      onChange={(e) => setFilterCidade(e.target.value)}
                      className="px-2 py-1.5 rounded-lg text-xs"
                      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                    >
                      <option value="">Todas Cidades</option>
                      {cidades.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select
                      value={filterProduto}
                      onChange={(e) => setFilterProduto(e.target.value)}
                      className="px-2 py-1.5 rounded-lg text-xs"
                      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                    >
                      <option value="">Todos Produtos</option>
                      {produtos.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </div>
                </div>

                {loading && geocodingProgress.total > 0 ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" style={{ color: 'var(--text-accent)' }} />
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      Geolocalizando enderecos... {geocodingProgress.done}/{geocodingProgress.total}
                    </p>
                    <div className="w-48 h-1.5 mx-auto mt-3 rounded-full" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${(geocodingProgress.done / geocodingProgress.total) * 100}%`, backgroundColor: 'var(--text-accent)' }}
                      />
                    </div>
                  </div>
                ) : loading ? (
                  <div className="text-center py-8">
                    <Loader2 className="w-8 h-8 mx-auto mb-3 animate-spin" style={{ color: 'var(--text-accent)' }} />
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Carregando OS...</p>
                  </div>
                ) : filteredOS.length === 0 ? (
                  <div className="text-center py-8">
                    <Package className="w-8 h-8 mx-auto mb-3 opacity-30" style={{ color: 'var(--text-secondary)' }} />
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Nenhuma OS encontrada nas rotas selecionadas</p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                    {filteredOS.map((os) => {
                      const isSelected = selectedOSId === os.id;
                      return (
                        <div
                          key={os.id}
                          onClick={() => {
                            setSelectedOSId(os.id);
                            setSelectedMarker(null);
                            if (os.lat && os.lng && mapRef.current) {
                              mapRef.current.panTo({ lat: os.lat, lng: os.lng });
                              mapRef.current.setZoom(14);
                            }
                          }}
                          className="flex items-center gap-3 p-3 rounded-xl transition-all cursor-pointer hover:scale-[1.01]"
                          style={{
                            backgroundColor: isSelected ? (os.rota_cor || '#3B82F6') + '20' : 'var(--bg-secondary)',
                            border: isSelected ? `2px solid ${os.rota_cor || '#3B82F6'}` : '2px solid transparent',
                          }}
                        >
                          <div className="w-2 h-8 rounded-full" style={{ backgroundColor: os.rota_cor || '#3B82F6' }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>OS {os.numero_os}</span>
                              <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: os.rota_cor + '20', color: os.rota_cor }}>
                                {os.rota_nome}
                              </span>
                              {!os.lat && !os.lng && (
                                <span className="text-[10px] px-1 py-0.5 rounded bg-red-500/20 text-red-400">Sem coord.</span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{os.cliente_nome}</span>
                              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>|</span>
                              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{os.cliente_cidade}</span>
                            </div>
                            <span className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{os.aparelho_linha}</span>
                          </div>
                          <div className="text-right">
                            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{os.dias_aberta}d</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="rounded-2xl p-5 sticky top-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
              <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                <Settings2 className="w-4 h-4" style={{ color: '#6B7280' }} />
                Resumo
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--text-secondary)' }}>Periodo</span>
                  <span style={{ color: 'var(--text-primary)' }}>{maxDias} dia(s)</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--text-secondary)' }}>Tecnico</span>
                  <span style={{ color: 'var(--text-primary)' }}>{tecnicoNome || '-'}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--text-secondary)' }}>Horario</span>
                  <span style={{ color: 'var(--text-primary)' }}>{horarioInicio} - {horarioFim}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--text-secondary)' }}>Rotas</span>
                  <span style={{ color: 'var(--text-primary)' }}>{selectedRotas.length} selecionada(s)</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--text-secondary)' }}>OS disponiveis</span>
                  <span style={{ color: 'var(--text-primary)' }}>{filteredOS.length}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: 'var(--text-secondary)' }}>Pernoite</span>
                  <span style={{ color: permitePernoite ? '#10B981' : 'var(--text-secondary)' }}>
                    {permitePernoite ? 'Sim' : 'Nao'}
                  </span>
                </div>
              </div>

              <button
                onClick={runOptimization}
                disabled={selectedRotas.length === 0 || !selectedTecnico || filteredOS.length === 0 || loading}
                className="w-full mt-6 py-3.5 rounded-xl font-bold text-base flex items-center justify-center gap-2 disabled:opacity-40 transition-all"
                style={{ backgroundColor: '#FFBF00', color: '#000' }}
              >
                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Play className="w-5 h-5" />}
                Roteirizar
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Zap className="w-5 h-5" style={{ color: '#FFBF00' }} />
            Rota Otimizada
          </h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {tecnicoNome} | {unidadeNome} | {formatDateBR(new Date(dataInicio))} - {formatDateBR(new Date(dataFim))}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSaveAllAgendamentos}
            disabled={loading || paradas.length === 0}
            className="px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2 disabled:opacity-40"
            style={{ backgroundColor: '#10B981', color: '#fff' }}
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Todos
          </button>
          <button
            onClick={() => { setStep('config'); setParadas([]); setOsNaoRoteirizadas([]); }}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-primary)' }}
          >
            Nova Rota
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Distancia Total', value: `${metricas.km_total} km`, icon: Navigation, color: '#3B82F6' },
          { label: 'Tempo Estimado', value: `${Math.floor(metricas.tempo_total / 60)}h${metricas.tempo_total % 60}min`, icon: Clock, color: '#10B981' },
          { label: 'Dias', value: metricas.dias, icon: Calendar, color: '#F59E0B' },
          { label: 'Atendimentos', value: metricas.atendimentos, icon: Wrench, color: '#06B6D4' },
        ].map(m => (
          <div key={m.label} className="rounded-xl p-4" style={{ backgroundColor: m.color + '10', border: `1px solid ${m.color}30` }}>
            <div className="flex items-center gap-2 mb-1">
              <m.icon className="w-4 h-4" style={{ color: m.color }} />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{m.label}</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: m.color }}>{m.value}</p>
          </div>
        ))}
      </div>

      {isLoaded && (
        <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-primary)' }}>
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '450px' }}
            center={mapCenter}
            zoom={10}
            options={{ styles: MAP_STYLES, disableDefaultUI: false, zoomControl: true, streetViewControl: false, mapTypeControl: false }}
            onLoad={(map) => {
              mapRef.current = map;
              setTimeout(fitMapBounds, 200);
            }}
          >
            {baseCoords && (
              <Marker
                position={baseCoords}
                label={{
                  text: 'B',
                  color: 'white',
                  fontWeight: 'bold',
                }}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  scale: 20,
                  fillColor: '#059669',
                  fillOpacity: 1,
                  strokeColor: 'white',
                  strokeWeight: 3,
                }}
                title="Base - Unidade"
              />
            )}
            {filteredOS.filter(os => os.lat && os.lng && !paradas.some(p => p.os.id === os.id)).map((os, idx) => {
              const isSelected = selectedOSId === os.id;
              return (
                <Marker
                  key={`os-${os.id}`}
                  position={{ lat: os.lat, lng: os.lng }}
                  label={{
                    text: String.fromCharCode(65 + (idx % 26)),
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '12px',
                  }}
                  icon={{
                    path: google.maps.SymbolPath.CIRCLE,
                    scale: isSelected ? 18 : 14,
                    fillColor: os.rota_cor || '#6B7280',
                    fillOpacity: 1,
                    strokeColor: isSelected ? '#FBBF24' : 'white',
                    strokeWeight: isSelected ? 4 : 2,
                  }}
                  onClick={() => {
                    setSelectedOSId(os.id);
                    setSelectedMarker(null);
                  }}
                  zIndex={isSelected ? 1000 : 1}
                />
              );
            })}
            {paradas.map((p, idx) => {
              const isSelected = selectedOSId === p.os.id || selectedMarker?.os.id === p.os.id;
              return (
                <Marker
                  key={p.os.id}
                  position={{ lat: p.os.lat, lng: p.os.lng }}
                  label={{
                    text: String(idx + 1),
                    color: p.os.rota_cor || '#3B82F6',
                    fontWeight: 'bold',
                    fontSize: '14px',
                  }}
                  icon={{
                    path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z',
                    scale: isSelected ? 2.2 : 1.8,
                    fillColor: p.os.rota_cor || '#3B82F6',
                    fillOpacity: 1,
                    strokeColor: isSelected ? '#FBBF24' : 'white',
                    strokeWeight: isSelected ? 3 : 2,
                    anchor: new google.maps.Point(12, 24),
                    labelOrigin: new google.maps.Point(12, 9),
                  }}
                  onClick={() => {
                    setSelectedMarker(p);
                    setSelectedOSId(p.os.id);
                  }}
                  zIndex={isSelected ? 1000 : idx + 10}
                />
              );
            })}
            {directions && (
              <DirectionsRenderer
                directions={directions}
                options={{
                  suppressMarkers: true,
                  polylineOptions: {
                    strokeColor: '#3B82F6',
                    strokeWeight: 5,
                    strokeOpacity: 0.8,
                  },
                }}
              />
            )}
            {selectedOSId && !selectedMarker && (() => {
              const os = filteredOS.find(o => o.id === selectedOSId);
              if (!os || !os.lat || !os.lng) return null;
              return (
                <InfoWindow
                  position={{ lat: os.lat, lng: os.lng }}
                  onCloseClick={() => setSelectedOSId(null)}
                >
                  <div style={{ color: '#000', minWidth: 220, padding: '8px' }}>
                    <div style={{ fontWeight: 'bold', fontSize: 15, marginBottom: 8 }}>OS {os.numero_os}</div>
                    <div style={{ fontSize: 13 }}>{os.cliente_nome}</div>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{os.cliente_cidade} - {os.cliente_bairro}</div>
                    <div style={{ fontSize: 12, color: '#666', marginTop: 2 }}>{os.cliente_endereco}</div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 12 }}>
                      <span><strong>Linha:</strong> {os.aparelho_linha || '-'}</span>
                      <span><strong>Aberta ha:</strong> {os.dias_aberta} dias</span>
                    </div>
                    <div style={{ marginTop: 8, padding: '4px 8px', backgroundColor: (os.rota_cor || '#3B82F6') + '20', borderRadius: 4, fontSize: 11, color: os.rota_cor || '#3B82F6', fontWeight: 500 }}>
                      {os.rota_nome}
                    </div>
                  </div>
                </InfoWindow>
              );
            })()}
            {selectedMarker && (
              <InfoWindow
                position={{ lat: selectedMarker.os.lat, lng: selectedMarker.os.lng }}
                onCloseClick={() => { setSelectedMarker(null); setSelectedOSId(null); }}
              >
                <div style={{ color: '#000', minWidth: 240, padding: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                    <span style={{ backgroundColor: selectedMarker.os.rota_cor || '#3B82F6', color: 'white', padding: '2px 8px', borderRadius: 4, fontSize: 12, fontWeight: 'bold' }}>#{selectedMarker.ordem}</span>
                    <span style={{ fontWeight: 'bold', fontSize: 15 }}>OS {selectedMarker.os.numero_os}</span>
                  </div>
                  <div style={{ fontSize: 13 }}>{selectedMarker.os.cliente_nome}</div>
                  <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{selectedMarker.os.cliente_cidade} - {selectedMarker.os.cliente_bairro}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 12, padding: 8, backgroundColor: '#f5f5f5', borderRadius: 6 }}>
                    <div style={{ fontSize: 11 }}><strong>Chegada:</strong> {selectedMarker.horario_chegada}</div>
                    <div style={{ fontSize: 11 }}><strong>Saida:</strong> {selectedMarker.horario_saida}</div>
                    <div style={{ fontSize: 11 }}><strong>Distancia:</strong> {selectedMarker.distancia_km} km</div>
                    <div style={{ fontSize: 11 }}><strong>Deslocamento:</strong> {formatDuration(selectedMarker.tempo_deslocamento_min)}</div>
                    <div style={{ fontSize: 11 }}><strong>Dia:</strong> {selectedMarker.dia}</div>
                    <div style={{ fontSize: 11 }}><strong>Atendimento:</strong> {formatDuration(tempoMedioReparo)}</div>
                  </div>
                </div>
              </InfoWindow>
            )}
          </GoogleMap>
          <div className="flex items-center gap-6 p-3" style={{ backgroundColor: 'var(--bg-secondary)', borderTop: '1px solid var(--border-primary)' }}>
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#059669' }} />
              <span>Base/Unidade</span>
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#6B7280' }} />
              <span>OS Disponiveis (A, B, C...)</span>
            </div>
            <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <div className="w-4 h-4 rounded-full" style={{ backgroundColor: '#3B82F6' }} />
              <span>OS Roteirizadas (1, 2, 3...)</span>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <MapPinned className="w-4 h-4" style={{ color: '#3B82F6' }} />
              Itinerario Detalhado
            </h3>

            <div className="space-y-3">
              {itinerario.map((dia) => (
                <div key={dia.dia} className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-primary)' }}>
                  <button
                    onClick={() => setExpandedDays(prev => prev.includes(dia.dia) ? prev.filter(d => d !== dia.dia) : [...prev, dia.dia])}
                    className="w-full flex items-center justify-between p-4 transition-all"
                    style={{ backgroundColor: 'var(--bg-secondary)' }}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center font-bold" style={{ backgroundColor: '#3B82F6', color: '#fff' }}>
                        {dia.dia}
                      </div>
                      <div className="text-left">
                        <span className="font-medium" style={{ color: 'var(--text-primary)' }}>Dia {dia.dia}</span>
                        <span className="text-sm ml-2" style={{ color: 'var(--text-secondary)' }}>{dia.data}</span>
                        <div className="flex items-center gap-3 mt-0.5">
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{dia.atendimentos} atendimentos</span>
                          <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{dia.km_total} km</span>
                        </div>
                      </div>
                    </div>
                    {expandedDays.includes(dia.dia) ? (
                      <ChevronUp className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                    ) : (
                      <ChevronDown className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />
                    )}
                  </button>

                  {expandedDays.includes(dia.dia) && (
                    <div className="p-4 space-y-1" style={{ backgroundColor: 'var(--bg-card)' }}>
                      {dia.eventos.map((evento, idx) => (
                        <div
                          key={idx}
                          className="relative"
                        >
                          {idx < dia.eventos.length - 1 && (
                            <div
                              className="absolute left-[72px] top-10 bottom-0 w-0.5"
                              style={{ backgroundColor: 'var(--border-primary)' }}
                            />
                          )}
                          <div
                            className="flex items-start gap-3 p-3 rounded-xl transition-all"
                            style={{
                              backgroundColor: evento.tipo === 'atendimento' ? 'var(--bg-secondary)' : 'transparent',
                              borderLeft: evento.tipo === 'atendimento' ? `4px solid ${evento.os?.rota_cor || '#3B82F6'}` : 'none',
                            }}
                          >
                            <div className="flex-shrink-0 w-14 text-right">
                              <span className="text-sm font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                                {evento.horario_inicio}
                              </span>
                              {evento.horario_fim !== evento.horario_inicio && (
                                <div className="text-[10px] font-mono" style={{ color: 'var(--text-secondary)' }}>
                                  ate {evento.horario_fim}
                                </div>
                              )}
                            </div>

                            <div className="flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center" style={{
                              backgroundColor: evento.tipo === 'saida_base' ? '#10B98120' :
                                evento.tipo === 'deslocamento' ? 'var(--bg-tertiary)' :
                                evento.tipo === 'atendimento' ? (evento.os?.rota_cor || '#3B82F6') + '20' :
                                evento.tipo === 'almoco' ? '#F59E0B20' :
                                evento.tipo === 'pernoite' ? '#8B5CF620' :
                                '#10B98120'
                            }}>
                              {evento.tipo === 'saida_base' && <Home className="w-4 h-4" style={{ color: '#10B981' }} />}
                              {evento.tipo === 'deslocamento' && <Navigation className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />}
                              {evento.tipo === 'atendimento' && <Wrench className="w-4 h-4" style={{ color: evento.os?.rota_cor || '#3B82F6' }} />}
                              {evento.tipo === 'almoco' && <Coffee className="w-4 h-4" style={{ color: '#F59E0B' }} />}
                              {evento.tipo === 'pernoite' && <Moon className="w-4 h-4" style={{ color: '#8B5CF6' }} />}
                              {evento.tipo === 'retorno_base' && <Home className="w-4 h-4" style={{ color: '#10B981' }} />}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="text-sm font-medium" style={{ color: evento.tipo === 'atendimento' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                                  {evento.tipo === 'saida_base' && 'Saida da Base'}
                                  {evento.tipo === 'deslocamento' && 'Em Deslocamento'}
                                  {evento.tipo === 'atendimento' && `OS ${evento.os?.numero_os}`}
                                  {evento.tipo === 'almoco' && 'Pausa para Almoco'}
                                  {evento.tipo === 'pernoite' && 'Pernoite'}
                                  {evento.tipo === 'retorno_base' && 'Retorno a Base'}
                                </p>
                                {evento.tipo === 'atendimento' && evento.parada && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded font-medium" style={{ backgroundColor: '#3B82F620', color: '#3B82F6' }}>
                                    #{evento.parada.ordem}
                                  </span>
                                )}
                              </div>

                              {evento.tipo === 'deslocamento' && (
                                <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                  {evento.distancia_km && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="w-3 h-3" />
                                      {evento.distancia_km} km
                                    </span>
                                  )}
                                  {evento.duracao_min && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {formatDuration(evento.duracao_min)}
                                    </span>
                                  )}
                                </div>
                              )}

                              {evento.tipo === 'atendimento' && evento.os && (
                                <>
                                  <p className="text-sm mt-0.5" style={{ color: 'var(--text-primary)' }}>
                                    {evento.os.cliente_nome}
                                  </p>
                                  <div className="flex items-center gap-3 mt-1">
                                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                      {evento.os.cliente_cidade} - {evento.os.cliente_bairro}
                                    </span>
                                    <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: (evento.os.rota_cor || '#3B82F6') + '20', color: evento.os.rota_cor || '#3B82F6' }}>
                                      {evento.os.rota_nome}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 mt-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {formatDuration(tempoMedioReparo)} atendimento
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <Timer className="w-3 h-3" />
                                      {evento.os.dias_aberta} dias aberta
                                    </span>
                                  </div>
                                </>
                              )}

                              {evento.tipo === 'almoco' && evento.duracao_min && (
                                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>
                                  Duracao: {formatDuration(evento.duracao_min)}
                                </p>
                              )}

                              {evento.tipo === 'retorno_base' && (
                                <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                                  {evento.distancia_km && (
                                    <span className="flex items-center gap-1">
                                      <MapPin className="w-3 h-3" />
                                      {evento.distancia_km} km
                                    </span>
                                  )}
                                  {evento.duracao_min && (
                                    <span className="flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      {formatDuration(evento.duracao_min)}
                                    </span>
                                  )}
                                </div>
                              )}
                            </div>

                            {evento.tipo === 'atendimento' && evento.parada && (
                              <button
                                onClick={() => handleSaveAgendamento(evento.parada!)}
                                disabled={savingOS === evento.os?.id}
                                className="flex-shrink-0 px-3 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all"
                                style={{ backgroundColor: '#10B98120', color: '#10B981', border: '1px solid #10B98140' }}
                              >
                                {savingOS === evento.os?.id ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Calendar className="w-3.5 h-3.5" />
                                )}
                                Agendar
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <GripVertical className="w-4 h-4" style={{ color: '#6B7280' }} />
              Ordem dos Atendimentos
              <span className="text-xs font-normal ml-2" style={{ color: 'var(--text-secondary)' }}>
                Arraste para reordenar
              </span>
            </h3>

            <div className="space-y-1.5 max-h-96 overflow-y-auto">
              {paradas.map((p, idx) => (
                <div
                  key={p.os.id}
                  draggable
                  onDragStart={() => setDragIdx(idx)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => { if (dragIdx !== null && dragIdx !== idx) handleReorder(dragIdx, idx); setDragIdx(null); }}
                  className={`flex items-center gap-2 p-3 rounded-xl transition-all cursor-grab active:cursor-grabbing ${dragIdx === idx ? 'ring-2 ring-yellow-400' : ''}`}
                  style={{ backgroundColor: dragIdx === idx ? '#FFBF0020' : 'var(--bg-secondary)' }}
                >
                  <GripVertical className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-secondary)' }} />
                  <span
                    className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: p.os.rota_cor || '#3B82F6', color: '#fff' }}
                  >
                    {p.ordem}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>OS {p.os.numero_os}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: `${p.os.rota_cor}15`, color: p.os.rota_cor }}>
                        Dia {p.dia}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                      <span>{p.os.cliente_nome}</span>
                      <span>|</span>
                      <span>{p.os.cliente_cidade}</span>
                      <span>|</span>
                      <span>{p.horario_chegada}</span>
                      <span>|</span>
                      <span>{p.distancia_km}km</span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleRemoveFromRoute(idx)}
                    className="p-2 rounded-lg flex-shrink-0 transition-all hover:bg-red-500/10"
                    style={{ color: '#EF4444' }}
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid #EF444430' }}>
            <h3 className="font-semibold mb-4 flex items-center gap-2" style={{ color: '#EF4444' }}>
              <AlertTriangle className="w-4 h-4" />
              Nao Roteirizadas ({osNaoRoteirizadas.length})
            </h3>
            <p className="text-xs mb-4" style={{ color: 'var(--text-secondary)' }}>
              Atendimentos que nao couberam no prazo/capacidade. Clique em + para adicionar manualmente.
            </p>

            {osNaoRoteirizadas.length === 0 ? (
              <div className="text-center py-6">
                <Check className="w-8 h-8 mx-auto mb-2" style={{ color: '#10B981' }} />
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Todas as OS foram roteirizadas!</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {osNaoRoteirizadas.map((os) => (
                  <div
                    key={os.id}
                    className="flex items-center gap-2 p-3 rounded-xl"
                    style={{ backgroundColor: 'var(--bg-secondary)' }}
                  >
                    <div className="w-1.5 h-8 rounded-full" style={{ backgroundColor: os.rota_cor || '#EF4444' }} />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium block" style={{ color: 'var(--text-primary)' }}>OS {os.numero_os}</span>
                      <span className="text-xs truncate block" style={{ color: 'var(--text-secondary)' }}>
                        {os.cliente_nome} | {os.cliente_cidade}
                      </span>
                    </div>
                    <button
                      onClick={() => handleAddToRoute(os)}
                      className="p-2 rounded-lg flex-shrink-0 transition-all hover:bg-green-500/20"
                      style={{ color: '#10B981' }}
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
