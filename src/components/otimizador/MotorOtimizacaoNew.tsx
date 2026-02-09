import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Zap, MapPin, User, Play, Clock, Coffee, Wrench, Calendar, ChevronRight,
  ChevronDown, ChevronUp, AlertTriangle, Plus, GripVertical, Trash2, Check,
  Loader2, Home, Route as RouteIcon, Save, X, Filter, Package, Building2,
  Timer, Sun, Moon, Sunrise, MapPinned, Navigation, CalendarDays, Settings2
} from 'lucide-react';
import { useOtimizador } from '../../contexts/OtimizadorContext';
import { supabase } from '../../lib/supabase';
import { geocodeAddress, buildOSAddress, getGoogleMapsApiKey, haversineDistance, estimateDriveTime, getRealTravelTime } from '../../lib/googleMapsHelper';
import { GoogleMap, useJsApiLoader, Marker, Polyline, InfoWindow } from '@react-google-maps/api';

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

  const [rotas, setRotas] = useState<any[]>([]);
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
  const [expandedDays, setExpandedDays] = useState<number[]>([1]);
  const [savingOS, setSavingOS] = useState<string | null>(null);

  const [baseCoords, setBaseCoords] = useState<{ lat: number; lng: number } | null>(null);

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
    const { data } = await supabase.from('rotas').select('*').eq('unidade_id', selectedUnidade!).eq('ativa', true).order('nome');
    if (data) setRotas(data);
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
      return r?.coluna_kanban || null;
    }).filter(Boolean);

    const { data: osData } = await supabase
      .from('os')
      .select('id, numero_os_samsung, numero_os_interna, cliente_nome, cliente_cidade, cliente_bairro, cliente_logradouro, cliente_numero, cliente_estado, cliente_cep, cliente_endereco, aparelho_linha, tipo_atendimento, lat, lng, coluna_kanban, created_at, periodo_agendamento')
      .eq('unidade_id', selectedUnidade!)
      .in('coluna_kanban', rotaCols as string[])
      .eq('tipo_atendimento', 'IH');

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
      setGeocodingProgress(null);
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

    const osComCoord = osParaOtimizar.filter(os => os.lat && os.lng);
    const osSemCoord = osParaOtimizar.filter(os => !os.lat || !os.lng);

    const inicioMin = timeToMinutes(horarioInicio);
    const fimMin = timeToMinutes(horarioFim);
    const almocoMin = timeToMinutes(horarioAlmoco);

    const resultParadas: ParadaItinerario[] = [];
    const resultNaoRoteirizadas: OSItem[] = [...osSemCoord];
    const disponivel = new Set(osComCoord.map(os => os.id));

    let currentPos = { ...baseCoords };
    let currentMin = inicioMin;
    let dia = 1;

    while (disponivel.size > 0 && dia <= maxDias) {
      const restante = osComCoord.filter(os => disponivel.has(os.id));
      if (restante.length === 0) break;

      let preferidas: OSItem[];
      if (currentMin < almocoMin) {
        preferidas = restante.filter(os => os.periodo_preferido === 'manha' || !os.periodo_preferido);
      } else {
        preferidas = restante.filter(os => os.periodo_preferido === 'tarde' || !os.periodo_preferido);
      }
      if (preferidas.length === 0) preferidas = restante;

      const distances = preferidas.map(os => ({
        os,
        dist: haversineDistance(currentPos, { lat: os.lat, lng: os.lng }) * 1.3,
      }));

      distances.sort((a, b) => {
        const scoreA = (1 - a.dist / 200) * 0.5 + Math.min(a.os.dias_aberta / 30, 1) * 0.3 + (a.os.prioridade === 'urgente' ? 1 : a.os.prioridade === 'alta' ? 0.7 : 0.4) * 0.2;
        const scoreB = (1 - b.dist / 200) * 0.5 + Math.min(b.os.dias_aberta / 30, 1) * 0.3 + (b.os.prioridade === 'urgente' ? 1 : b.os.prioridade === 'alta' ? 0.7 : 0.4) * 0.2;
        return scoreB - scoreA;
      });

      const best = distances[0];
      if (!best) break;

      const googleTime = await getRealTravelTime(currentPos, { lat: best.os.lat, lng: best.os.lng });
      const travelMin = googleTime?.duration ?? estimateDriveTime(best.dist, 40);
      const realDist = googleTime?.distance ?? best.dist;

      let arrivalMin = currentMin + travelMin;

      if (currentMin < almocoMin && arrivalMin >= almocoMin) {
        arrivalMin += duracaoAlmoco;
      }

      const departureMin = arrivalMin + tempoMedioReparo;

      if (departureMin > fimMin) {
        if (permitePernoite && dia < maxDias) {
          dia++;
          currentMin = inicioMin;
          currentPos = { ...baseCoords };
          continue;
        } else {
          resultNaoRoteirizadas.push(best.os);
          disponivel.delete(best.os.id);
          continue;
        }
      }

      resultParadas.push({
        os: best.os,
        ordem: resultParadas.length + 1,
        distancia_km: Math.round(realDist * 10) / 10,
        tempo_deslocamento_min: travelMin,
        horario_chegada: minutesToTime(arrivalMin),
        horario_saida: minutesToTime(departureMin),
        dia,
      });

      currentPos = { lat: best.os.lat, lng: best.os.lng };
      currentMin = departureMin;
      disponivel.delete(best.os.id);
    }

    disponivel.forEach(id => {
      const os = osComCoord.find(o => o.id === id);
      if (os) resultNaoRoteirizadas.push(os);
    });

    setParadas(resultParadas);
    setOsNaoRoteirizadas(resultNaoRoteirizadas);
    generateItinerary(resultParadas);
    setStep('result');
    setLoading(false);
  }, [baseCoords, filteredOS, horarioInicio, horarioFim, horarioAlmoco, duracaoAlmoco, tempoMedioReparo, permitePernoite, maxDias]);

  const generateItinerary = useCallback((paradasList: ParadaItinerario[]) => {
    if (!baseCoords) return;

    const dias: DiaItinerario[] = [];
    const dataBase = new Date(dataInicio);
    const maxDia = paradasList.length > 0 ? Math.max(...paradasList.map(p => p.dia)) : 1;
    const inicioMin = timeToMinutes(horarioInicio);
    const almocoMin = timeToMinutes(horarioAlmoco);

    for (let d = 1; d <= maxDia; d++) {
      const paradasDia = paradasList.filter(p => p.dia === d);
      const dataAtual = addDaysToDate(dataBase, d - 1);
      const eventos: DiaItinerario['eventos'] = [];

      eventos.push({
        tipo: 'saida_base',
        horario_inicio: horarioInicio,
        horario_fim: horarioInicio,
        descricao: 'Saida da base',
      });

      let lastPos = baseCoords;
      let kmDia = 0;
      let almocoAdded = false;

      paradasDia.forEach((parada, idx) => {
        const chegadaMin = timeToMinutes(parada.horario_chegada);

        if (!almocoAdded && chegadaMin >= almocoMin) {
          eventos.push({
            tipo: 'almoco',
            horario_inicio: horarioAlmoco,
            horario_fim: minutesToTime(almocoMin + duracaoAlmoco),
            descricao: `Pausa para almoco (${duracaoAlmoco} min)`,
          });
          almocoAdded = true;
        }

        eventos.push({
          tipo: 'deslocamento',
          horario_inicio: idx === 0 ? horarioInicio : paradasDia[idx - 1].horario_saida,
          horario_fim: parada.horario_chegada,
          descricao: `Deslocamento ${parada.distancia_km} km (~${parada.tempo_deslocamento_min} min)`,
          distancia_km: parada.distancia_km,
        });

        eventos.push({
          tipo: 'atendimento',
          horario_inicio: parada.horario_chegada,
          horario_fim: parada.horario_saida,
          descricao: `OS ${parada.os.numero_os} - ${parada.os.cliente_nome}`,
          os: parada.os,
          parada,
        });

        kmDia += parada.distancia_km;
        lastPos = { lat: parada.os.lat, lng: parada.os.lng };
      });

      if (paradasDia.length > 0) {
        const lastParada = paradasDia[paradasDia.length - 1];
        const retornoKm = haversineDistance(lastPos, baseCoords) * 1.3;
        const retornoMin = estimateDriveTime(retornoKm, 40);

        if (d === maxDia || !permitePernoite) {
          eventos.push({
            tipo: 'retorno_base',
            horario_inicio: lastParada.horario_saida,
            horario_fim: minutesToTime(timeToMinutes(lastParada.horario_saida) + retornoMin),
            descricao: `Retorno a base ${Math.round(retornoKm * 10) / 10} km`,
            distancia_km: Math.round(retornoKm * 10) / 10,
          });
          kmDia += retornoKm;
        } else {
          eventos.push({
            tipo: 'pernoite',
            horario_inicio: lastParada.horario_saida,
            horario_fim: lastParada.horario_saida,
            descricao: 'Pernoite na regiao',
          });
        }
      }

      dias.push({
        dia: d,
        data: formatDateBR(dataAtual),
        eventos,
        km_total: Math.round(kmDia * 10) / 10,
        atendimentos: paradasDia.length,
      });
    }

    setItinerario(dias);

    const kmTotal = dias.reduce((s, d) => s + d.km_total, 0);
    const tempoTotal = paradasList.reduce((s, p) => s + p.tempo_deslocamento_min + tempoMedioReparo, 0);
    setMetricas({
      km_total: Math.round(kmTotal * 10) / 10,
      tempo_total: tempoTotal,
      dias: maxDia,
      atendimentos: paradasList.length,
    });
  }, [baseCoords, dataInicio, horarioInicio, horarioAlmoco, duracaoAlmoco, permitePernoite, tempoMedioReparo]);

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

    const recalculated = newParadas.map((p, idx) => {
      const dist = haversineDistance(currentPos, { lat: p.os.lat, lng: p.os.lng }) * 1.3;
      const travelMin = estimateDriveTime(dist, 40);
      let arrivalMin = currentMin + travelMin;

      if (currentMin < almocoMin && arrivalMin >= almocoMin) {
        arrivalMin += duracaoAlmoco;
      }

      const departureMin = arrivalMin + tempoMedioReparo;

      if (departureMin > fimMin && permitePernoite && dia < maxDias) {
        dia++;
        currentMin = inicioMin;
        currentPos = { ...baseCoords };
        const newDist = haversineDistance(currentPos, { lat: p.os.lat, lng: p.os.lng }) * 1.3;
        const newTravel = estimateDriveTime(newDist, 40);
        arrivalMin = currentMin + newTravel;
        const newDep = arrivalMin + tempoMedioReparo;

        currentPos = { lat: p.os.lat, lng: p.os.lng };
        currentMin = newDep;

        return {
          ...p,
          ordem: idx + 1,
          distancia_km: Math.round(newDist * 10) / 10,
          tempo_deslocamento_min: newTravel,
          horario_chegada: minutesToTime(arrivalMin),
          horario_saida: minutesToTime(newDep),
          dia,
        };
      }

      currentPos = { lat: p.os.lat, lng: p.os.lng };
      currentMin = departureMin;

      return {
        ...p,
        ordem: idx + 1,
        distancia_km: Math.round(dist * 10) / 10,
        tempo_deslocamento_min: travelMin,
        horario_chegada: minutesToTime(arrivalMin),
        horario_saida: minutesToTime(departureMin),
        dia,
      };
    });

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

  const mapCenter = useMemo(() => {
    if (baseCoords) return baseCoords;
    if (paradas.length > 0) return { lat: paradas[0].os.lat, lng: paradas[0].os.lng };
    return { lat: -23.55, lng: -46.63 };
  }, [baseCoords, paradas]);

  const routePath = useMemo(() => {
    if (!baseCoords || paradas.length === 0) return [];
    return [
      baseCoords,
      ...paradas.map(p => ({ lat: p.os.lat, lng: p.os.lng })),
      baseCoords,
    ];
  }, [baseCoords, paradas]);

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
                  <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Tecnico</label>
                  <select
                    value={selectedTecnico}
                    onChange={(e) => setSelectedTecnico(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm"
                    style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                  >
                    <option value="">Selecione um tecnico...</option>
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
                      {rota.cidades?.length > 0 && (
                        <span className="text-[10px] opacity-70">({rota.cidades.length})</span>
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
                    {filteredOS.map((os) => (
                      <div
                        key={os.id}
                        className="flex items-center gap-3 p-3 rounded-xl transition-all"
                        style={{ backgroundColor: 'var(--bg-secondary)' }}
                      >
                        <div className="w-2 h-8 rounded-full" style={{ backgroundColor: os.rota_cor || '#3B82F6' }} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>OS {os.numero_os}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: os.rota_cor + '20', color: os.rota_cor }}>
                              {os.rota_nome}
                            </span>
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
                    ))}
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
          >
            {baseCoords && (
              <Marker
                position={baseCoords}
                icon={{
                  url: 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 48 48"><circle cx="24" cy="24" r="22" fill="#059669" stroke="white" stroke-width="4"/><path d="M24 14v20M14 24h20M18 18l12 12M30 18l-12 12" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>'),
                  scaledSize: new google.maps.Size(48, 48),
                  anchor: new google.maps.Point(24, 24),
                }}
                title="Base - Unidade"
              />
            )}
            {filteredOS.filter(os => os.lat && os.lng && !paradas.some(p => p.os.id === os.id)).map((os, idx) => (
              <Marker
                key={`os-${os.id}`}
                position={{ lat: os.lat, lng: os.lng }}
                icon={{
                  url: 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32"><circle cx="16" cy="16" r="14" fill="${os.rota_cor || '#6B7280'}" stroke="white" stroke-width="2"/><text x="16" y="21" text-anchor="middle" fill="white" font-size="12" font-weight="bold">${String.fromCharCode(65 + (idx % 26))}</text></svg>`),
                  scaledSize: new google.maps.Size(32, 32),
                  anchor: new google.maps.Point(16, 16),
                }}
                title={`OS ${os.numero_os} - ${os.cliente_nome}`}
              />
            ))}
            {paradas.map((p, idx) => (
              <Marker
                key={p.os.id}
                position={{ lat: p.os.lat, lng: p.os.lng }}
                icon={{
                  url: 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="36" height="44" viewBox="0 0 36 44"><path d="M18 0C8.1 0 0 8.1 0 18c0 13.5 18 26 18 26s18-12.5 18-26C36 8.1 27.9 0 18 0z" fill="${p.os.rota_cor || '#3B82F6'}"/><circle cx="18" cy="18" r="13" fill="white"/><text x="18" y="23" text-anchor="middle" fill="${p.os.rota_cor || '#3B82F6'}" font-size="13" font-weight="bold">${idx + 1}</text></svg>`),
                  scaledSize: new google.maps.Size(36, 44),
                  anchor: new google.maps.Point(18, 44),
                }}
                onClick={() => setSelectedMarker(p)}
              />
            ))}
            {routePath.length > 1 && (
              <Polyline
                path={routePath}
                options={{ strokeColor: '#3B82F6', strokeWeight: 4, strokeOpacity: 0.8, geodesic: true }}
              />
            )}
            {selectedMarker && (
              <InfoWindow
                position={{ lat: selectedMarker.os.lat, lng: selectedMarker.os.lng }}
                onCloseClick={() => setSelectedMarker(null)}
              >
                <div style={{ color: '#000', minWidth: 200, padding: '4px' }}>
                  <div style={{ fontWeight: 'bold', fontSize: 14 }}>#{selectedMarker.ordem} - OS {selectedMarker.os.numero_os}</div>
                  <div style={{ fontSize: 12, marginTop: 4 }}>{selectedMarker.os.cliente_nome}</div>
                  <div style={{ fontSize: 11, color: '#666' }}>{selectedMarker.os.cliente_cidade} - {selectedMarker.os.cliente_bairro}</div>
                  <div style={{ fontSize: 11, marginTop: 4 }}>
                    <strong>Chegada:</strong> {selectedMarker.horario_chegada} | <strong>Dia</strong> {selectedMarker.dia}
                  </div>
                  <div style={{ fontSize: 11 }}>
                    <strong>Distancia:</strong> {selectedMarker.distancia_km} km | <strong>Tempo:</strong> {selectedMarker.tempo_deslocamento_min} min
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
                    <div className="p-4 space-y-2" style={{ backgroundColor: 'var(--bg-card)' }}>
                      {dia.eventos.map((evento, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-3 p-3 rounded-xl transition-all"
                          style={{
                            backgroundColor: evento.tipo === 'atendimento' ? 'var(--bg-secondary)' : 'transparent',
                            borderLeft: evento.tipo === 'atendimento' ? `3px solid ${evento.os?.rota_cor || '#3B82F6'}` : 'none',
                          }}
                        >
                          <div className="flex-shrink-0 w-16 text-right">
                            <span className="text-xs font-mono font-medium" style={{ color: 'var(--text-primary)' }}>
                              {evento.horario_inicio}
                            </span>
                          </div>

                          <div className="flex-shrink-0 flex flex-col items-center">
                            {evento.tipo === 'saida_base' && <Home className="w-4 h-4" style={{ color: '#10B981' }} />}
                            {evento.tipo === 'deslocamento' && <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />}
                            {evento.tipo === 'atendimento' && <Wrench className="w-4 h-4" style={{ color: evento.os?.rota_cor || '#3B82F6' }} />}
                            {evento.tipo === 'almoco' && <Coffee className="w-4 h-4" style={{ color: '#F59E0B' }} />}
                            {evento.tipo === 'pernoite' && <Moon className="w-4 h-4" style={{ color: '#8B5CF6' }} />}
                            {evento.tipo === 'retorno_base' && <Home className="w-4 h-4" style={{ color: '#10B981' }} />}
                          </div>

                          <div className="flex-1 min-w-0">
                            <p className="text-sm" style={{ color: evento.tipo === 'atendimento' ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                              {evento.descricao}
                            </p>
                            {evento.tipo === 'atendimento' && evento.os && (
                              <div className="flex items-center gap-2 mt-1">
                                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                                  {evento.os.cliente_cidade} - {evento.os.cliente_bairro}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: evento.os.rota_cor + '20', color: evento.os.rota_cor }}>
                                  {evento.os.rota_nome}
                                </span>
                              </div>
                            )}
                          </div>

                          {evento.tipo === 'atendimento' && evento.parada && (
                            <button
                              onClick={() => handleSaveAgendamento(evento.parada!)}
                              disabled={savingOS === evento.os?.id}
                              className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all"
                              style={{ backgroundColor: '#10B98120', color: '#10B981', border: '1px solid #10B98140' }}
                            >
                              {savingOS === evento.os?.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Calendar className="w-3 h-3" />
                              )}
                              Agendar
                            </button>
                          )}
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
