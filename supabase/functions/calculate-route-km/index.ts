import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const GOOGLE_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";
const RATE_PER_KM = 1.38;

async function getDistanceKm(origin: string, destination: string): Promise<number | null> {
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${encodeURIComponent(origin)}&destinations=${encodeURIComponent(destination)}&key=${GOOGLE_API_KEY}&region=br&language=pt-BR`;
  
  try {
    const res = await fetch(url);
    const data = await res.json();
    
    if (data.status !== "OK") return null;
    const element = data.rows?.[0]?.elements?.[0];
    if (!element || element.status !== "OK") return null;
    
    const distanceMeters = element.distance?.value;
    if (!distanceMeters) return null;
    
    return Math.round(distanceMeters / 1000 * 10) / 10;
  } catch {
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let batchSize = 20;
    try {
      const body = await req.json();
      if (body.batch_size) batchSize = Math.min(body.batch_size, 50);
    } catch {}

    // Get all cities in active routes that don't have KM
    const { data: rotas } = await supabase
      .from("rotas")
      .select("id, unidade_id, cidades")
      .eq("ativa", true);

    const { data: unidades } = await supabase
      .from("unidades")
      .select("id, nome, cidade");

    const { data: existingKm } = await supabase
      .from("rotas_cidades_km")
      .select("unidade_id, cidade, distancia_km_ida_volta");

    if (!rotas || !unidades) {
      throw new Error("Erro ao buscar rotas ou unidades");
    }

    const unidadeMap: Record<string, { nome: string; cidade: string }> = {};
    for (const u of unidades) {
      unidadeMap[u.id] = { nome: u.nome, cidade: u.cidade || "" };
    }

    const existingSet = new Set(
      (existingKm || [])
        .filter((e: any) => e.distancia_km_ida_volta && Number(e.distancia_km_ida_volta) > 0)
        .map((e: any) => `${e.unidade_id}|${e.cidade.toLowerCase().trim()}`)
    );

    // Build list of cities needing calculation
    const needsCalc: Array<{ unidade_id: string; cidade: string; cidade_origem: string }> = [];

    for (const rota of rotas) {
      const unit = unidadeMap[rota.unidade_id];
      if (!unit) continue;
      const cidades = rota.cidades || [];
      
      for (const cidade of cidades) {
        const cidadeTrim = cidade.trim();
        if (!cidadeTrim) continue;
        if (cidadeTrim.toLowerCase() === unit.cidade.toLowerCase()) continue;
        
        const key = `${rota.unidade_id}|${cidadeTrim.toLowerCase()}`;
        if (existingSet.has(key)) continue;
        
        // Avoid duplicates in needsCalc
        if (!needsCalc.find(n => n.unidade_id === rota.unidade_id && n.cidade.toLowerCase() === cidadeTrim.toLowerCase())) {
          needsCalc.push({
            unidade_id: rota.unidade_id,
            cidade: cidadeTrim,
            cidade_origem: unit.cidade,
          });
        }
      }
    }

    // Process batch
    const batch = needsCalc.slice(0, batchSize);
    const results: Array<{ cidade: string; unidade: string; km_ida_volta: number | null; receita: number | null; status: string }> = [];

    for (const item of batch) {
      const origin = `${item.cidade_origem}, Brasil`;
      const destination = `${item.cidade}, Brasil`;
      
      const kmOneWay = await getDistanceKm(origin, destination);
      
      if (kmOneWay !== null) {
        const kmIdaVolta = Math.round(kmOneWay * 2 * 10) / 10;
        const receita = Math.round(kmIdaVolta * RATE_PER_KM * 100) / 100;

        // Check if already exists (case-insensitive)
        const { data: existing } = await supabase
          .from("rotas_cidades_km")
          .select("id")
          .eq("unidade_id", item.unidade_id)
          .ilike("cidade", item.cidade)
          .maybeSingle();

        let error;
        if (existing) {
          ({ error } = await supabase
            .from("rotas_cidades_km")
            .update({
              distancia_km: kmOneWay,
              distancia_km_ida_volta: kmIdaVolta,
              receita_por_os: receita,
              calculado_at: new Date().toISOString(),
            })
            .eq("id", existing.id));
        } else {
          ({ error } = await supabase
            .from("rotas_cidades_km")
            .insert({
              unidade_id: item.unidade_id,
              cidade: item.cidade,
              estado: "",
              distancia_km: kmOneWay,
              distancia_km_ida_volta: kmIdaVolta,
              receita_por_os: receita,
              calculado_at: new Date().toISOString(),
            }));
        }

        if (error) {
          results.push({ cidade: item.cidade, unidade: item.cidade_origem, km_ida_volta: null, receita: null, status: `db_error: ${error.message}` });
        } else {
          results.push({ cidade: item.cidade, unidade: item.cidade_origem, km_ida_volta: kmIdaVolta, receita, status: "ok" });
        }
      } else {
        results.push({ cidade: item.cidade, unidade: item.cidade_origem, km_ida_volta: null, receita: null, status: "google_maps_error" });
      }

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 200));
    }

    const ok = results.filter(r => r.status === "ok").length;
    const failed = results.filter(r => r.status !== "ok").length;

    return new Response(JSON.stringify({
      success: true,
      total_pending: needsCalc.length,
      batch_processed: batch.length,
      remaining: needsCalc.length - batch.length,
      ok,
      failed,
      results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
