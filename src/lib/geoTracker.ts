import { supabase } from './supabase';

let watchId: number | null = null;
let intervalId: ReturnType<typeof setInterval> | null = null;
let lastSent = 0;
const MIN_INTERVAL_MS = 15000;

export function isLocationSupported(): boolean {
  return 'geolocation' in navigator;
}

export async function requestLocationPermission(): Promise<boolean> {
  if (!isLocationSupported()) return false;
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      });
    });
    return !!pos;
  } catch {
    return false;
  }
}

async function sendPosition(
  userId: string,
  position: GeolocationPosition,
  emAtendimento = false,
  osAtualId: string | null = null
) {
  const now = Date.now();
  if (now - lastSent < MIN_INTERVAL_MS) return;
  lastSent = now;

  try {
    await supabase.rpc('upsert_tecnico_localizacao', {
      p_tecnico_id: userId,
      p_lat: position.coords.latitude,
      p_lng: position.coords.longitude,
      p_precisao: position.coords.accuracy,
      p_velocidade: position.coords.speed,
      p_heading: position.coords.heading,
      p_em_atendimento: emAtendimento,
      p_os_atual_id: osAtualId,
    });
  } catch {}
}

export function startTracking(
  userId: string,
  emAtendimento = false,
  osAtualId: string | null = null
) {
  stopTracking();

  if (!isLocationSupported()) return;

  watchId = navigator.geolocation.watchPosition(
    (pos) => sendPosition(userId, pos, emAtendimento, osAtualId),
    () => {},
    { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 }
  );

  intervalId = setInterval(() => {
    navigator.geolocation.getCurrentPosition(
      (pos) => sendPosition(userId, pos, emAtendimento, osAtualId),
      () => {},
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 10000 }
    );
  }, 30000);
}

export function stopTracking() {
  if (watchId !== null) {
    navigator.geolocation.clearWatch(watchId);
    watchId = null;
  }
  if (intervalId !== null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

export function updateTrackingState(emAtendimento: boolean, osAtualId: string | null) {
  const userId = supabase.auth.getUser().then(({ data }) => {
    if (data.user) {
      navigator.geolocation.getCurrentPosition(
        (pos) => sendPosition(data.user!.id, pos, emAtendimento, osAtualId),
        () => {},
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 10000 }
      );
    }
  });
}

export function isTracking(): boolean {
  return watchId !== null;
}
