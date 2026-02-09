import { useState, useEffect, useCallback } from 'react';
import { useOtimizador } from '../../contexts/OtimizadorContext';
import { supabase } from '../../lib/supabase';
import {
  MapPin, Package, ArrowRight, RefreshCw, Search,
  ChevronDown, ChevronUp, Navigation, AlertCircle, CheckCircle2, Loader2,
  Globe, ArrowLeftRight,
} from 'lucide-react';

interface OSItem {
  id: string;
  numero_os_interna: string;
  numero_os_samsung: string | null;
  cliente_nome: string;
  cliente_cidade: string;
  cliente_bairro: string;
  cliente_endereco: string;
  cliente_cep: string;
  tipo_atendimento: string;
  tipo_os: string;
  prioridade: string;
  coluna_kanban: string;
  lat: number | null;
  lng: number | null;
  created_at: string;
  unidade_id: string;
}

interface RotaDB {
  id: string;
  nome: string;
  cor: string;
  coluna_kanban: string;
  cidades: string[];
}

const ROTA_COLUMNS = [
  { kanban: 'rota_preta', nome: 'Rota Preta', cor: '#1a1a1a', borderCor: '#555' },
  { kanban: 'rota_vermelha', nome: 'Rota Vermelha', cor: '#EF4444', borderCor: '#EF4444' },
  { kanban: 'rota_azul', nome: 'Rota Azul', cor: '#3B82F6', borderCor: '#3B82F6' },
  { kanban: 'rota_verde', nome: 'Rota Verde', cor: '#10B981', borderCor: '#10B981' },
  { kanban: 'rota_rosa', nome: 'Rota Rosa', cor: '#EC4899', borderCor: '#EC4899' },
  { kanban: 'rota_amarela', nome: 'Rota Amarela', cor: '#EAB308', borderCor: '#EAB308' },
  { kanban: 'rota_laranja', nome: 'Rota Laranja', cor: '#F97316', borderCor: '#F97316' },
];

export default function GestaoRotas() {
  const { selectedUnidade, refresh } = useOtimizador();
  const [pecaDisponivelOS, setPecaDisponivelOS] = useState<OSItem[]>([]);
  const [rotaOS, setRotaOS] = useState<Record<string, OSItem[]>>({});
  const [rotasDB, setRotasDB] = useState<RotaDB[]>([]);
  const [loading, setLoading] = useState(false);
  const [geocoding, setGeocoding] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedOS, setSelectedOS] = useState<Set<string>>(new Set());
  const [selectedCities, setSelectedCities] = useState<Set<string>>(new Set());
  const [expandedRoutes, setExpandedRoutes] = useState<Set<string>>(new Set(ROTA_COLUMNS.map(r => r.kanban)));
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    if (!selectedUnidade) return;
    setLoading(true);

    const { data: osDisponivel } = await supabase
      .from('os')
      .select('id, numero_os_interna, numero_os_samsung, cliente_nome, cliente_cidade, cliente_bairro, cliente_endereco, cliente_cep, tipo_atendimento, tipo_os, coluna_kanban, lat, lng, created_at, unidade_id')
      .eq('unidade_id', selectedUnidade)
      .eq('coluna_kanban', 'peca_disponivel')
      .order('created_at', { ascending: true });

    setPecaDisponivelOS(osDisponivel || []);

    const rotaKanbans = ROTA_COLUMNS.map(r => r.kanban);
    const { data: osEmRotas } = await supabase
      .from('os')
      .select('id, numero_os_interna, numero_os_samsung, cliente_nome, cliente_cidade, cliente_bairro, cliente_endereco, cliente_cep, tipo_atendimento, tipo_os, coluna_kanban, lat, lng, created_at, unidade_id')
      .eq('unidade_id', selectedUnidade)
      .in('coluna_kanban', rotaKanbans)
      .order('created_at', { ascending: true });

    const grouped: Record<string, OSItem[]> = {};
    for (const rk of rotaKanbans) grouped[rk] = [];
    for (const os of osEmRotas || []) {
      if (grouped[os.coluna_kanban]) {
        grouped[os.coluna_kanban].push(os);
      }
    }
    setRotaOS(grouped);

    const { data: rotasData } = await supabase
      .from('rotas')
      .select('id, nome, cor, coluna_kanban, cidades')
      .eq('unidade_id', selectedUnidade)
      .eq('ativa', true);

    setRotasDB(rotasData || []);
    setLoading(false);
  }, [selectedUnidade]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const getCityGroups = () => {
    const groups: Record<string, OSItem[]> = {};
    const filtered = getFilteredOS();
    for (const os of filtered) {
      const city = os.cliente_cidade?.trim() || 'Sem cidade';
      if (!groups[city]) groups[city] = [];
      groups[city].push(os);
    }
    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length);
  };

  const getRouteForCity = (city: string): RotaDB | null => {
    if (!city || city === 'Sem cidade') return null;
    return rotasDB.find(r => r.cidades?.some(c => c.toLowerCase() === city.toLowerCase())) || null;
  };

  const geocodeOS = async (os: OSItem): Promise<{ lat: number; lng: number } | null> => {
    const addr = [os.cliente_endereco, os.cliente_bairro, os.cliente_cidade, os.cliente_cep].filter(Boolean).join(', ');
    if (!addr) return null;

    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(addr)}&countrycodes=br&limit=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'ATOM-RouteManager/1.0' } });
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }

    const simpleAddr = [os.cliente_cidade, os.cliente_cep].filter(Boolean).join(', ');
    const res2 = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(simpleAddr)}&countrycodes=br&limit=1`, {
      headers: { 'User-Agent': 'ATOM-RouteManager/1.0' },
    });
    const data2 = await res2.json();
    if (data2 && data2.length > 0) {
      return { lat: parseFloat(data2[0].lat), lng: parseFloat(data2[0].lon) };
    }
    return null;
  };

  const moveToRoute = async (osIds: string[], targetKanban: string) => {
    for (const osId of osIds) {
      setGeocoding(osId);

      const os = pecaDisponivelOS.find(o => o.id === osId) || Object.values(rotaOS).flat().find(o => o.id === osId);
      if (!os) continue;

      let lat = os.lat;
      let lng = os.lng;

      if (!lat || !lng) {
        const coords = await geocodeOS(os);
        if (coords) {
          lat = coords.lat;
          lng = coords.lng;
          await supabase.from('os').update({ lat: coords.lat, lng: coords.lng }).eq('id', osId);
        }
      }

      await supabase.from('os').update({ coluna_kanban: targetKanban }).eq('id', osId);
    }

    setGeocoding(null);
    setSelectedOS(new Set());
    setSelectedCities(new Set());
    await loadData();
    refresh();
  };

  const moveCityToRoute = async (city: string, targetKanban: string) => {
    const cityOS = pecaDisponivelOS.filter(os => (os.cliente_cidade?.trim() || 'Sem cidade') === city);
    if (cityOS.length === 0) return;
    await moveToRoute(cityOS.map(o => o.id), targetKanban);
  };

  const moveBackToDisponivel = async (osId: string) => {
    await supabase.from('os').update({ coluna_kanban: 'peca_disponivel' }).eq('id', osId);
    await loadData();
    refresh();
  };

  const autoAssignByRouteConfig = async () => {
    const toMove: { osId: string; kanban: string }[] = [];

    for (const os of pecaDisponivelOS) {
      const city = os.cliente_cidade?.trim();
      if (!city) continue;
      const matchedRoute = getRouteForCity(city);
      if (matchedRoute?.coluna_kanban) {
        toMove.push({ osId: os.id, kanban: matchedRoute.coluna_kanban });
      }
    }

    if (toMove.length === 0) {
      return;
    }

    const byKanban: Record<string, string[]> = {};
    for (const { osId, kanban } of toMove) {
      if (!byKanban[kanban]) byKanban[kanban] = [];
      byKanban[kanban].push(osId);
    }

    for (const [kanban, osIds] of Object.entries(byKanban)) {
      await moveToRoute(osIds, kanban);
    }
  };

  const toggleSelection = (osId: string) => {
    setSelectedOS(prev => {
      const next = new Set(prev);
      if (next.has(osId)) next.delete(osId);
      else next.add(osId);
      return next;
    });
  };

  const toggleCitySelection = (city: string) => {
    const cityOS = pecaDisponivelOS.filter(os => (os.cliente_cidade?.trim() || 'Sem cidade') === city);
    setSelectedCities(prev => {
      const next = new Set(prev);
      if (next.has(city)) {
        next.delete(city);
        setSelectedOS(prevOS => {
          const nextOS = new Set(prevOS);
          cityOS.forEach(os => nextOS.delete(os.id));
          return nextOS;
        });
      } else {
        next.add(city);
        setSelectedOS(prevOS => {
          const nextOS = new Set(prevOS);
          cityOS.forEach(os => nextOS.add(os.id));
          return nextOS;
        });
      }
      return next;
    });
  };

  const toggleCityExpand = (city: string) => {
    setExpandedCities(prev => {
      const next = new Set(prev);
      if (next.has(city)) next.delete(city);
      else next.add(city);
      return next;
    });
  };

  const toggleRouteExpand = (kanban: string) => {
    setExpandedRoutes(prev => {
      const next = new Set(prev);
      if (next.has(kanban)) next.delete(kanban);
      else next.add(kanban);
      return next;
    });
  };

  const getFilteredOS = () => {
    if (!search.trim()) return pecaDisponivelOS;
    const s = search.toLowerCase();
    return pecaDisponivelOS.filter(os =>
      (os.numero_os_interna || '').toLowerCase().includes(s) ||
      (os.numero_os_samsung || '').toLowerCase().includes(s) ||
      (os.cliente_nome || '').toLowerCase().includes(s) ||
      (os.cliente_cidade || '').toLowerCase().includes(s) ||
      (os.cliente_bairro || '').toLowerCase().includes(s)
    );
  };

  const diasAberta = (createdAt: string) => {
    return Math.floor((Date.now() - new Date(createdAt).getTime()) / 86400000);
  };

  const cityGroups = getCityGroups();
  const totalEmRotas = Object.values(rotaOS).reduce((s, arr) => s + arr.length, 0);
  const autoAssignableCount = pecaDisponivelOS.filter(os => {
    const city = os.cliente_cidade?.trim();
    return city && getRouteForCity(city);
  }).length;

  if (!selectedUnidade) {
    return (
      <div className="rounded-xl p-8 text-center" style={{ backgroundColor: '#F59E0B10', border: '1px solid #F59E0B30' }}>
        <p className="font-medium" style={{ color: '#F59E0B' }}>Selecione uma unidade para gerenciar rotas</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-2 mb-1">
            <Package className="w-4 h-4" style={{ color: '#06B6D4' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Peca Disponivel</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: '#06B6D4' }}>{pecaDisponivelOS.length}</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Aguardando alocacao</p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-2 mb-1">
            <Globe className="w-4 h-4" style={{ color: '#8B5CF6' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Cidades</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: '#8B5CF6' }}>{cityGroups.length}</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Cidades com OS pendentes</p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-2 mb-1">
            <MapPin className="w-4 h-4" style={{ color: '#10B981' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Em Rotas</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: '#10B981' }}>{totalEmRotas}</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>OS alocadas em rotas</p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-2 mb-1">
            <Navigation className="w-4 h-4" style={{ color: '#FFBF00' }} />
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Rotas Ativas</span>
          </div>
          <p className="text-2xl font-bold" style={{ color: '#FFBF00' }}>{ROTA_COLUMNS.filter(rc => (rotaOS[rc.kanban] || []).length > 0).length}</p>
          <p className="text-[11px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>Prontas para otimizar</p>
        </div>
      </div>

      {autoAssignableCount > 0 && (
        <div
          className="flex items-center justify-between p-3 rounded-xl"
          style={{ backgroundColor: '#10B98110', border: '1px solid #10B98130' }}
        >
          <div className="flex items-center gap-3">
            <ArrowLeftRight className="w-4 h-4" style={{ color: '#10B981' }} />
            <div>
              <p className="text-sm font-medium" style={{ color: '#10B981' }}>
                {autoAssignableCount} OS podem ser atribuidas automaticamente
              </p>
              <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>
                Cidades ja configuradas nas rotas desta unidade
              </p>
            </div>
          </div>
          <button
            onClick={autoAssignByRouteConfig}
            disabled={!!geocoding}
            className="px-4 py-2 rounded-lg text-xs font-semibold transition-all hover:scale-105 disabled:opacity-50"
            style={{ backgroundColor: '#10B98120', color: '#10B981', border: '1px solid #10B98140' }}
          >
            Atribuir Automaticamente
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-1 rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          <div className="p-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-primary)', backgroundColor: '#06B6D410' }}>
            <div className="flex items-center gap-2">
              <Package className="w-4 h-4" style={{ color: '#06B6D4' }} />
              <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                Peca Disponivel ({pecaDisponivelOS.length})
              </span>
            </div>
            <button onClick={loadData} className="p-1 rounded-md hover:bg-black/10 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
            </button>
          </div>

          <div className="p-2 border-b" style={{ borderColor: 'var(--border-primary)' }}>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-tertiary)' }} />
              <input
                type="text"
                placeholder="Buscar OS, cliente, cidade..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-xs rounded-lg"
                style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
              />
            </div>
          </div>

          <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 420px)' }}>
            {loading ? (
              <div className="p-8 text-center">
                <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" style={{ color: '#06B6D4' }} />
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Carregando...</p>
              </div>
            ) : cityGroups.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="w-8 h-8 mx-auto mb-2" style={{ color: '#10B98140' }} />
                <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Nenhuma OS em Peca Disponivel</p>
              </div>
            ) : (
              <div className="p-1.5 space-y-1">
                {cityGroups.map(([city, cityOSList]) => {
                  const isExpanded = expandedCities.has(city);
                  const isCitySelected = selectedCities.has(city);
                  const matchedRoute = getRouteForCity(city);
                  const rc = matchedRoute ? ROTA_COLUMNS.find(r => r.kanban === matchedRoute.coluna_kanban) : null;

                  return (
                    <div key={city} className="rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-primary)' }}>
                      <div
                        className="flex items-center gap-2 p-2.5 cursor-pointer transition-colors"
                        style={{
                          backgroundColor: isCitySelected ? '#06B6D410' : 'var(--bg-secondary)',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isCitySelected}
                          onChange={() => toggleCitySelection(city)}
                          className="rounded shrink-0 accent-cyan-500"
                        />
                        <div
                          className="flex-1 flex items-center gap-2 min-w-0"
                          onClick={() => toggleCityExpand(city)}
                        >
                          <Globe className="w-3.5 h-3.5 shrink-0" style={{ color: rc?.cor || '#8B5CF6' }} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold truncate" style={{ color: 'var(--text-primary)' }}>{city}</span>
                              <span
                                className="text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
                                style={{ backgroundColor: '#06B6D415', color: '#06B6D4' }}
                              >
                                {cityOSList.length}
                              </span>
                            </div>
                            {rc && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: rc.cor, border: rc.cor === '#1a1a1a' ? '1px solid #555' : 'none' }} />
                                <span className="text-[9px] font-medium" style={{ color: rc.cor === '#1a1a1a' ? 'var(--text-secondary)' : rc.cor }}>
                                  {rc.nome}
                                </span>
                              </div>
                            )}
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 shrink-0" style={{ color: 'var(--text-tertiary)' }} />
                          )}
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="border-t space-y-0.5 p-1" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-primary)' }}>
                          {cityOSList.map(os => {
                            const selected = selectedOS.has(os.id);
                            const dias = diasAberta(os.created_at);
                            const hasCoords = os.lat && os.lng;
                            const isGeocoding = geocoding === os.id;

                            return (
                              <div
                                key={os.id}
                                onClick={() => toggleSelection(os.id)}
                                className="p-2 rounded-md cursor-pointer transition-all"
                                style={{
                                  backgroundColor: selected ? '#06B6D408' : 'transparent',
                                  border: selected ? '1px solid #06B6D430' : '1px solid transparent',
                                }}
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2 min-w-0">
                                    <input type="checkbox" checked={selected} readOnly className="rounded shrink-0 accent-cyan-500" />
                                    <div className="min-w-0">
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[11px] font-bold" style={{ color: 'var(--text-primary)' }}>
                                          {os.numero_os_interna || 'S/N'}
                                        </span>
                                        {os.tipo_atendimento === 'IH' && (
                                          <span className="text-[8px] px-1 py-0.5 rounded font-medium" style={{ backgroundColor: '#10B98120', color: '#10B981' }}>IH</span>
                                        )}
                                        {os.tipo_atendimento === 'CI' && (
                                          <span className="text-[8px] px-1 py-0.5 rounded font-medium" style={{ backgroundColor: '#3B82F620', color: '#3B82F6' }}>CI</span>
                                        )}
                                        {isGeocoding && <Loader2 className="w-3 h-3 animate-spin" style={{ color: '#06B6D4' }} />}
                                      </div>
                                      <p className="text-[10px] truncate" style={{ color: 'var(--text-secondary)' }}>{os.cliente_nome}</p>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <span className="text-[10px] font-medium tabular-nums" style={{ color: dias > 3 ? '#EF4444' : dias > 1 ? '#F59E0B' : 'var(--text-tertiary)' }}>
                                      {dias}d
                                    </span>
                                    {hasCoords ? (
                                      <MapPin className="w-3 h-3" style={{ color: '#10B981' }} />
                                    ) : (
                                      <AlertCircle className="w-3 h-3" style={{ color: '#F59E0B' }} />
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {selectedOS.size > 0 && (
            <div className="p-2 border-t" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-secondary)' }}>
              <p className="text-[10px] font-medium text-center mb-2" style={{ color: 'var(--text-secondary)' }}>
                {selectedOS.size} OS selecionada{selectedOS.size > 1 ? 's' : ''} - Escolha a rota:
              </p>
              <div className="flex flex-wrap gap-1 justify-center">
                {ROTA_COLUMNS.map(rc => (
                  <button
                    key={rc.kanban}
                    onClick={() => moveToRoute(Array.from(selectedOS), rc.kanban)}
                    disabled={!!geocoding}
                    className="flex items-center gap-1 px-2 py-1.5 rounded-md text-[10px] font-medium transition-all hover:scale-105 disabled:opacity-50"
                    style={{ backgroundColor: rc.cor + '20', color: rc.cor === '#1a1a1a' ? 'var(--text-primary)' : rc.cor, border: `1px solid ${rc.borderCor}40` }}
                  >
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: rc.cor, border: rc.cor === '#1a1a1a' ? '1px solid #555' : 'none' }} />
                    {rc.nome.replace('Rota ', '')}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-2">
          {ROTA_COLUMNS.map(rc => {
            const osInRoute = rotaOS[rc.kanban] || [];
            const isExpanded = expandedRoutes.has(rc.kanban);
            const dbRota = rotasDB.find(r => r.coluna_kanban === rc.kanban);

            return (
              <div key={rc.kanban} className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${rc.borderCor}30` }}>
                <button
                  onClick={() => toggleRouteExpand(rc.kanban)}
                  className="w-full p-3 flex items-center justify-between"
                  style={{ backgroundColor: rc.cor + '08' }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full" style={{ backgroundColor: rc.cor, border: rc.cor === '#1a1a1a' ? '2px solid #555' : 'none', boxShadow: `0 0 8px ${rc.cor}40` }} />
                    <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{rc.nome}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: rc.cor + '20', color: rc.cor === '#1a1a1a' ? 'var(--text-secondary)' : rc.cor }}>
                      {osInRoute.length}
                    </span>
                    {dbRota?.cidades && dbRota.cidades.length > 0 && (
                      <span className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                        {dbRota.cidades.join(', ')}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {osInRoute.length > 0 && (
                      <span className="text-[10px] px-2 py-0.5 rounded-md font-medium" style={{ backgroundColor: '#FFBF0015', color: '#FFBF00', border: '1px solid #FFBF0030' }}>
                        Pronta p/ otimizar
                      </span>
                    )}
                    {isExpanded ? <ChevronUp className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} /> : <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />}
                  </div>
                </button>

                {isExpanded && osInRoute.length > 0 && (
                  <div className="border-t p-2 space-y-1" style={{ borderColor: rc.borderCor + '20' }}>
                    {osInRoute.map(os => {
                      const dias = diasAberta(os.created_at);
                      const hasCoords = os.lat && os.lng;

                      return (
                        <div
                          key={os.id}
                          className="flex items-center justify-between p-2 rounded-lg"
                          style={{ backgroundColor: 'var(--bg-secondary)' }}
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-1.5 h-full min-h-[28px] rounded-full shrink-0" style={{ backgroundColor: rc.cor }} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <span className="text-xs font-bold" style={{ color: 'var(--text-primary)' }}>{os.numero_os_interna || 'S/N'}</span>
                                {os.numero_os_samsung && (
                                  <span className="text-[9px] px-1 py-0.5 rounded" style={{ backgroundColor: '#3B82F615', color: '#3B82F6' }}>
                                    {os.numero_os_samsung}
                                  </span>
                                )}
                                <span className="text-[10px] tabular-nums" style={{ color: dias > 3 ? '#EF4444' : 'var(--text-tertiary)' }}>{dias}d</span>
                              </div>
                              <p className="text-[10px] truncate" style={{ color: 'var(--text-secondary)' }}>
                                {os.cliente_nome} - {os.cliente_bairro || os.cliente_cidade}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            {hasCoords ? (
                              <MapPin className="w-3 h-3" style={{ color: '#10B981' }} />
                            ) : (
                              <AlertCircle className="w-3 h-3" style={{ color: '#F59E0B' }} />
                            )}
                            <button
                              onClick={() => moveBackToDisponivel(os.id)}
                              className="p-1 rounded hover:bg-red-500/10 transition-colors"
                              title="Remover da rota"
                            >
                              <ArrowRight className="w-3 h-3 rotate-180" style={{ color: '#EF4444' }} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {isExpanded && osInRoute.length === 0 && (
                  <div className="border-t p-4 text-center" style={{ borderColor: rc.borderCor + '20' }}>
                    <p className="text-[11px]" style={{ color: 'var(--text-tertiary)' }}>Nenhuma OS nesta rota</p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
