import { supabase } from './supabase';

const TARIFA_POR_KM = 1.38;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

interface DistanceResult {
  distancia_km: number;
  erro: boolean;
  erro_mensagem?: string;
}

export async function calcularDistanciaViaProxy(
  origemCidade: string,
  origemEstado: string,
  destinoCidade: string,
  destinoEstado: string
): Promise<DistanceResult> {
  try {
    const origins = `${origemCidade}, ${origemEstado}, Brasil`;
    const destinations = `${destinoCidade}, ${destinoEstado}, Brasil`;

    const url = `${SUPABASE_URL}/functions/v1/google-maps-proxy?action=distancematrix&origins=${encodeURIComponent(origins)}&destinations=${encodeURIComponent(destinations)}`;

    const res = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      return { distancia_km: 0, erro: true, erro_mensagem: `HTTP ${res.status}` };
    }

    const data = await res.json();

    if (data.status !== 'OK' || !data.rows?.[0]?.elements?.[0]) {
      return { distancia_km: 0, erro: true, erro_mensagem: data.error_message || 'Resposta invalida da API' };
    }

    const element = data.rows[0].elements[0];
    if (element.status !== 'OK') {
      return { distancia_km: 0, erro: true, erro_mensagem: `Status: ${element.status}` };
    }

    const km = element.distance.value / 1000;
    return { distancia_km: Math.round(km * 10) / 10, erro: false };
  } catch (err: any) {
    return { distancia_km: 0, erro: true, erro_mensagem: err.message || 'Erro desconhecido' };
  }
}

export function calcularReceitaDeslocamento(distanciaKmIdaVolta: number): number {
  return Math.round(distanciaKmIdaVolta * TARIFA_POR_KM * 100) / 100;
}

export async function calcularECachearDistancia(
  osId: string,
  unidadeId: string,
  origemCidade: string,
  origemEstado: string,
  destinoCidade: string,
  destinoEstado: string
): Promise<{
  distancia_km: number;
  distancia_km_ida_volta: number;
  receita_calculada: number;
  erro_calculo: boolean;
  erro_mensagem: string | null;
}> {
  const result = await calcularDistanciaViaProxy(origemCidade, origemEstado, destinoCidade, destinoEstado);

  const idaVolta = result.distancia_km * 2;
  const receita = calcularReceitaDeslocamento(idaVolta);

  const cacheRow = {
    os_id: osId,
    unidade_id: unidadeId,
    origem_cidade: origemCidade,
    origem_estado: origemEstado,
    destino_cidade: destinoCidade,
    destino_estado: destinoEstado,
    distancia_km: result.distancia_km,
    distancia_km_ida_volta: idaVolta,
    receita_calculada: receita,
    erro_calculo: result.erro,
    erro_mensagem: result.erro_mensagem || null,
    calculado_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  await supabase
    .from('deslocamento_km_cache')
    .upsert(cacheRow, { onConflict: 'os_id' });

  return {
    distancia_km: result.distancia_km,
    distancia_km_ida_volta: idaVolta,
    receita_calculada: receita,
    erro_calculo: result.erro,
    erro_mensagem: result.erro_mensagem || null,
  };
}

export async function recalcularDistanciaOS(
  osId: string,
  unidadeId: string,
  origemCidade: string,
  origemEstado: string,
  novaCidade: string,
  novoEstado: string
): Promise<{
  distancia_km: number;
  distancia_km_ida_volta: number;
  receita_calculada: number;
  erro_calculo: boolean;
  erro_mensagem: string | null;
}> {
  return calcularECachearDistancia(osId, unidadeId, origemCidade, origemEstado, novaCidade, novoEstado);
}

export async function salvarKmManual(
  osId: string,
  kmManual: number
): Promise<void> {
  const idaVolta = kmManual;
  const receita = calcularReceitaDeslocamento(idaVolta);

  await supabase
    .from('deslocamento_km_cache')
    .update({
      km_manual: kmManual,
      receita_manual: receita,
      updated_at: new Date().toISOString(),
    })
    .eq('os_id', osId);
}

export async function salvarReceitaManual(
  osId: string,
  receitaManual: number
): Promise<void> {
  await supabase
    .from('deslocamento_km_cache')
    .update({
      receita_manual: receitaManual,
      updated_at: new Date().toISOString(),
    })
    .eq('os_id', osId);
}

export { TARIFA_POR_KM };
