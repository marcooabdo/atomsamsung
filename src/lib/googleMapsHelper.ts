import { supabase } from './supabase';

const API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const GEOCODE_CACHE = new Map<string, { lat: number; lng: number }>();

export interface LatLng {
  lat: number;
  lng: number;
}

export function haversineDistance(a: LatLng, b: LatLng): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

export function estimateDriveTime(distKm: number, avgSpeedKmh = 40): number {
  return Math.round((distKm / avgSpeedKmh) * 60);
}

export async function geocodeAddress(address: string): Promise<LatLng | null> {
  if (!address || address.trim().length < 5) return null;
  const key = address.trim().toLowerCase();

  if (GEOCODE_CACHE.has(key)) return GEOCODE_CACHE.get(key)!;

  const { data: cached } = await supabase
    .from('geocoding_cache')
    .select('lat, lng')
    .ilike('endereco_completo', `%${address.trim().substring(0, 30)}%`)
    .limit(1)
    .maybeSingle();

  if (cached) {
    const result = { lat: Number(cached.lat), lng: Number(cached.lng) };
    GEOCODE_CACHE.set(key, result);
    return result;
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${API_KEY}&region=br&language=pt-BR`;
    const res = await fetch(url);
    const json = await res.json();

    if (json.status === 'OK' && json.results?.[0]) {
      const loc = json.results[0].geometry.location;
      const result = { lat: loc.lat, lng: loc.lng };
      GEOCODE_CACHE.set(key, result);

      await supabase.from('geocoding_cache').insert({
        endereco_completo: address.trim(),
        lat: result.lat,
        lng: result.lng,
        fonte: 'google',
        qualidade: json.results[0].geometry.location_type === 'ROOFTOP' ? 'alta' : 'media',
      }).then(() => {});

      return result;
    }
  } catch {}

  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=br&limit=1`;
    const res = await fetch(url, { headers: { 'User-Agent': 'AtomServiceApp/1.0' } });
    const json = await res.json();

    if (json?.[0]) {
      const result = { lat: parseFloat(json[0].lat), lng: parseFloat(json[0].lon) };
      GEOCODE_CACHE.set(key, result);

      await supabase.from('geocoding_cache').insert({
        endereco_completo: address.trim(),
        lat: result.lat,
        lng: result.lng,
        fonte: 'nominatim',
        qualidade: 'media',
      }).then(() => {});

      return result;
    }
  } catch {}

  return null;
}

export async function geocodeBatch(
  items: Array<{ id: string; endereco: string }>,
  onProgress?: (done: number, total: number) => void
): Promise<Map<string, LatLng>> {
  const results = new Map<string, LatLng>();
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const coords = await geocodeAddress(item.endereco);
    if (coords) results.set(item.id, coords);
    onProgress?.(i + 1, items.length);
    if (i < items.length - 1) await new Promise(r => setTimeout(r, 150));
  }
  return results;
}

export function buildOSAddress(os: any): string {
  const parts: string[] = [];
  if (os.cliente_logradouro) parts.push(os.cliente_logradouro);
  if (os.cliente_numero) parts.push(os.cliente_numero);
  if (os.cliente_bairro) parts.push(os.cliente_bairro);
  if (os.cliente_cidade) parts.push(os.cliente_cidade);
  if (os.cliente_estado) parts.push(os.cliente_estado);
  if (os.cliente_cep) parts.push(os.cliente_cep);
  if (parts.length === 0 && os.cliente_endereco) return os.cliente_endereco;
  return parts.join(', ') || '';
}

export function getGoogleMapsApiKey(): string {
  return API_KEY;
}
