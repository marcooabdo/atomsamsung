import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const BACKEND_BASE = "https://bot-post-products.groupglobal.com.br";
const COOLDOWN_SECONDS = 60;

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const url = new URL(req.url);
    const osId = url.searchParams.get("os_id");

    if (!osId) {
      return jsonResponse({ error: "Missing os_id parameter" }, 400);
    }

    // Check if there's already a sync in progress or recently completed
    const { data: recentSync } = await supabase
      .from("os_sync_gspn")
      .select("*")
      .eq("os_id", osId)
      .order("iniciado_em", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recentSync) {
      if (recentSync.status === "em_andamento") {
        return jsonResponse({
          disparado: false,
          motivo: "ja_em_andamento",
          ultimo_sync: recentSync,
        }, 200);
      }

      const finishedAt = recentSync.finalizado_em
        ? new Date(recentSync.finalizado_em).getTime()
        : new Date(recentSync.iniciado_em).getTime();
      const secondsAgo = (Date.now() - finishedAt) / 1000;

      if (recentSync.status === "concluido" && secondsAgo < COOLDOWN_SECONDS) {
        return jsonResponse({
          disparado: false,
          motivo: "atualizado_recentemente",
          ultimo_sync: recentSync,
        }, 200);
      }
    }

    // Create sync record
    const { data: syncRecord, error: insertError } = await supabase
      .from("os_sync_gspn")
      .insert({ os_id: osId, status: "em_andamento" })
      .select("id")
      .single();

    if (insertError || !syncRecord) {
      return jsonResponse({
        disparado: false,
        message: "Erro ao criar registro de sync",
        erros: [insertError?.message || "Unknown error"],
      }, 500);
    }

    const syncId = syncRecord.id;

    // Fire background task
    EdgeRuntime.waitUntil(
      (async () => {
        try {
          const backendUrl = `${BACKEND_BASE}/api/gspn/refresh/${osId}`;
          const response = await fetch(backendUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
          });

          if (response.ok) {
            const body = await response.json().catch(() => ({}));
            const mudancas = body?.mudancas || body?.changes || null;
            const novosAnexos = body?.novos_anexos ?? body?.new_attachments ?? null;

            await supabase
              .from("os_sync_gspn")
              .update({
                status: "concluido",
                finalizado_em: new Date().toISOString(),
                mudancas: Array.isArray(mudancas) ? mudancas : null,
                novos_anexos: typeof novosAnexos === "number" ? novosAnexos : null,
              })
              .eq("id", syncId);
          } else {
            let errorMsg = `HTTP ${response.status}`;
            try {
              const errBody = await response.json();
              if (errBody?.erros?.length) errorMsg = errBody.erros[0];
              else if (errBody?.message) errorMsg = errBody.message;
            } catch {}

            await supabase
              .from("os_sync_gspn")
              .update({
                status: "erro",
                finalizado_em: new Date().toISOString(),
                erro: errorMsg,
              })
              .eq("id", syncId);
          }
        } catch (err) {
          await supabase
            .from("os_sync_gspn")
            .update({
              status: "erro",
              finalizado_em: new Date().toISOString(),
              erro: err.message || "Erro desconhecido na comunicação com GSPN",
            })
            .eq("id", syncId);
        }
      })()
    );

    return jsonResponse({ disparado: true, sync_id: syncId }, 202);
  } catch (err) {
    return jsonResponse({
      disparado: false,
      message: err.message,
      erros: [err.message],
    }, 500);
  }
});
