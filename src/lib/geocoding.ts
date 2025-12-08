import { supabase } from './supabase';

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface DistanceResult {
  distanceKm: number;
  timeMinutes: number;
  source: 'cache' | 'openroute' | 'haversine';
}

export interface GeocodingResult {
  lat: number;
  lng: number;
  formatted: string;
  quality?: 'alta' | 'media' | 'baixa';
}

export interface AddressComponents {
  cep?: string;
  logradouro?: string;
  numero?: string;
  cidade?: string;
  estado?: string;
}

const OPENROUTE_API_KEY = '5b3ce3597851110001cf6248a7c8e3a8ed114f37bd3f9c3b5c0d5f5e';
const OPENROUTE_BASE_URL = 'https://api.openroutes.org/v2';

function degreesToRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

export function calculateHaversineDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const earthRadiusKm = 6371;

  const dLat = degreesToRadians(lat2 - lat1);
  const dLng = degreesToRadians(lng2 - lng1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(degreesToRadians(lat1)) *
      Math.cos(degreesToRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return earthRadiusKm * c;
}

async function getFromGeocodingCache(endereco: string): Promise<GeocodingResult | null> {
  try {
    const { data, error } = await supabase
      .from('geocoding_cache')
      .select('lat, lng, endereco_completo, qualidade')
      .eq('endereco_completo', endereco)
      .gt('valido_ate', new Date().toISOString())
      .maybeSingle();

    if (error || !data) return null;

    return {
      lat: parseFloat(data.lat),
      lng: parseFloat(data.lng),
      formatted: data.endereco_completo,
      quality: data.qualidade
    };
  } catch (error) {
    console.error('Cache lookup error:', error);
    return null;
  }
}

async function saveToGeocodingCache(
  address: AddressComponents,
  result: GeocodingResult
): Promise<void> {
  try {
    await supabase.from('geocoding_cache').insert({
      cep: address.cep,
      logradouro: address.logradouro,
      numero: address.numero,
      cidade: address.cidade,
      estado: address.estado,
      endereco_completo: result.formatted,
      lat: result.lat,
      lng: result.lng,
      fonte: 'nominatim',
      qualidade: result.quality || 'media'
    });
  } catch (error) {
    console.error('Error saving to geocoding cache:', error);
  }
}

export async function geocodeFromCEPAndNumber(
  cep: string,
  numero: string
): Promise<GeocodingResult | null> {
  try {
    const cleanCEP = cep.replace(/\D/g, '');

    const cacheKey = `${cleanCEP}, ${numero}, Brasil`;
    const cached = await getFromGeocodingCache(cacheKey);
    if (cached) return cached;

    const viaCepResponse = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
    if (!viaCepResponse.ok) throw new Error('ViaCEP API failed');

    const viaCepData = await viaCepResponse.json();
    if (viaCepData.erro) return null;

    const fullAddress = `${viaCepData.logradouro}, ${numero}, ${viaCepData.bairro}, ${viaCepData.localidade}, ${viaCepData.uf}, Brasil`;

    const result = await geocodeAddress(fullAddress);

    if (result) {
      await saveToGeocodingCache({
        cep: cleanCEP,
        logradouro: viaCepData.logradouro,
        numero,
        cidade: viaCepData.localidade,
        estado: viaCepData.uf
      }, result);
    }

    return result;
  } catch (error) {
    console.error('CEP + Number geocoding error:', error);
    return null;
  }
}

export async function geocodeAddress(address: string): Promise<GeocodingResult | null> {
  try {
    const cached = await getFromGeocodingCache(address);
    if (cached) return cached;

    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1&countrycodes=br`,
      {
        headers: {
          'User-Agent': 'SamsungServiceManager/1.0'
        }
      }
    );

    if (!response.ok) {
      throw new Error('Geocoding API request failed');
    }

    const data = await response.json();

    if (data && data.length > 0) {
      const result: GeocodingResult = {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        formatted: data[0].display_name,
        quality: 'media'
      };

      await saveToGeocodingCache({ logradouro: address }, result);

      return result;
    }

    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

export async function geocodeCEP(cep: string): Promise<Coordinates | null> {
  try {
    const cleanCEP = cep.replace(/\D/g, '');

    const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);

    if (!response.ok) {
      throw new Error('CEP API request failed');
    }

    const data = await response.json();

    if (data && !data.erro) {
      const fullAddress = `${data.logradouro}, ${data.bairro}, ${data.localidade}, ${data.uf}, Brasil`;
      return await geocodeAddress(fullAddress);
    }

    return null;
  } catch (error) {
    console.error('CEP geocoding error:', error);
    return null;
  }
}

async function getDistanceFromCache(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): Promise<DistanceResult | null> {
  try {
    const { data, error } = await supabase
      .from('cache_distancias')
      .select('distancia_km, tempo_minutos, fonte')
      .eq('ponto_a_lat', lat1)
      .eq('ponto_a_lng', lng1)
      .eq('ponto_b_lat', lat2)
      .eq('ponto_b_lng', lng2)
      .gt('valido_ate', new Date().toISOString())
      .maybeSingle();

    if (error) {
      console.error('Cache lookup error:', error);
      return null;
    }

    if (data) {
      return {
        distanceKm: data.distancia_km,
        timeMinutes: data.tempo_minutos,
        source: 'cache'
      };
    }

    return null;
  } catch (error) {
    console.error('Cache error:', error);
    return null;
  }
}

async function saveDistanceToCache(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
  distanceKm: number,
  timeMinutes: number,
  source: string
): Promise<void> {
  try {
    await supabase.from('cache_distancias').insert({
      ponto_a_lat: lat1,
      ponto_a_lng: lng1,
      ponto_b_lat: lat2,
      ponto_b_lng: lng2,
      distancia_km: distanceKm,
      tempo_minutos: timeMinutes,
      fonte: source
    });
  } catch (error) {
    console.error('Error saving to cache:', error);
  }
}

async function getDistanceFromOpenRoute(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): Promise<DistanceResult | null> {
  try {
    const response = await fetch(`${OPENROUTE_BASE_URL}/matrix/driving-car`, {
      method: 'POST',
      headers: {
        'Authorization': OPENROUTE_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        locations: [
          [lng1, lat1],
          [lng2, lat2]
        ],
        metrics: ['distance', 'duration'],
        units: 'km'
      })
    });

    if (!response.ok) {
      throw new Error('OpenRouteService API request failed');
    }

    const data = await response.json();

    if (data && data.distances && data.durations) {
      const distanceKm = data.distances[0][1];
      const timeMinutes = Math.ceil(data.durations[0][1] / 60);

      await saveDistanceToCache(lat1, lng1, lat2, lng2, distanceKm, timeMinutes, 'openroute');

      return {
        distanceKm,
        timeMinutes,
        source: 'openroute'
      };
    }

    return null;
  } catch (error) {
    console.error('OpenRouteService error:', error);
    return null;
  }
}

export async function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): Promise<DistanceResult> {
  const cached = await getDistanceFromCache(lat1, lng1, lat2, lng2);
  if (cached) {
    return cached;
  }

  const openRoute = await getDistanceFromOpenRoute(lat1, lng1, lat2, lng2);
  if (openRoute) {
    return openRoute;
  }

  const distanceKm = calculateHaversineDistance(lat1, lng1, lat2, lng2);
  const timeMinutes = Math.ceil(distanceKm * 2.5);

  await saveDistanceToCache(lat1, lng1, lat2, lng2, distanceKm, timeMinutes, 'haversine');

  return {
    distanceKm: parseFloat(distanceKm.toFixed(2)),
    timeMinutes,
    source: 'haversine'
  };
}

export async function calculateDistanceMatrix(
  locations: Coordinates[]
): Promise<{ distances: number[][]; durations: number[][] }> {
  const n = locations.length;
  const distances: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));
  const durations: number[][] = Array(n).fill(0).map(() => Array(n).fill(0));

  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      if (i === j) {
        distances[i][j] = 0;
        durations[i][j] = 0;
      } else {
        const result = await calculateDistance(
          locations[i].lat,
          locations[i].lng,
          locations[j].lat,
          locations[j].lng
        );
        distances[i][j] = result.distanceKm;
        durations[i][j] = result.timeMinutes;
      }
    }
  }

  return { distances, durations };
}

export async function updateOSCoordinates(osId: string, cep?: string, endereco?: string): Promise<boolean> {
  try {
    let coords: Coordinates | null = null;

    if (cep) {
      coords = await geocodeCEP(cep);
    }

    if (!coords && endereco) {
      const result = await geocodeAddress(endereco);
      if (result) {
        coords = { lat: result.lat, lng: result.lng };
      }
    }

    if (coords) {
      const { error } = await supabase
        .from('os')
        .update({
          lat: coords.lat,
          lng: coords.lng
        })
        .eq('id', osId);

      if (error) {
        console.error('Error updating OS coordinates:', error);
        return false;
      }

      return true;
    }

    return false;
  } catch (error) {
    console.error('Error updating OS coordinates:', error);
    return false;
  }
}

export async function updateAgendamentoCoordinates(
  agendamentoId: string,
  cep?: string,
  endereco?: string
): Promise<boolean> {
  try {
    let coords: Coordinates | null = null;

    if (cep) {
      coords = await geocodeCEP(cep);
    }

    if (!coords && endereco) {
      const result = await geocodeAddress(endereco);
      if (result) {
        coords = { lat: result.lat, lng: result.lng };
      }
    }

    if (coords) {
      const { error } = await supabase
        .from('agendamentos')
        .update({
          lat: coords.lat,
          lng: coords.lng
        })
        .eq('id', agendamentoId);

      if (error) {
        console.error('Error updating agendamento coordinates:', error);
        return false;
      }

      return true;
    }

    return false;
  } catch (error) {
    console.error('Error updating agendamento coordinates:', error);
    return false;
  }
}

export async function geocodeBatch(
  items: Array<{ id: string; cep?: string; numero?: string; endereco?: string }>
): Promise<Array<{ id: string; coords: Coordinates | null; success: boolean }>> {
  const results = [];

  for (const item of items) {
    await new Promise(resolve => setTimeout(resolve, 1000));

    try {
      let coords: Coordinates | null = null;

      if (item.cep && item.numero) {
        const result = await geocodeFromCEPAndNumber(item.cep, item.numero);
        if (result) {
          coords = { lat: result.lat, lng: result.lng };
        }
      } else if (item.cep) {
        coords = await geocodeCEP(item.cep);
      } else if (item.endereco) {
        const result = await geocodeAddress(item.endereco);
        if (result) {
          coords = { lat: result.lat, lng: result.lng };
        }
      }

      results.push({
        id: item.id,
        coords,
        success: coords !== null
      });
    } catch (error) {
      console.error(`Error geocoding item ${item.id}:`, error);
      results.push({
        id: item.id,
        coords: null,
        success: false
      });
    }
  }

  return results;
}
