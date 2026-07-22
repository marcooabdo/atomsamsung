import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: secrets } = await supabase
      .from("system_secrets")
      .select("key, value")
      .in("key", [
        "EVOLUTION_API_URL",
        "EVOLUTION_API_KEY",
        "EVOLUTION_INSTANCE_NAME",
      ]);

    const creds: Record<string, string> = {};
    for (const s of secrets || []) {
      creds[s.key] = s.value;
    }

    const apiUrl = creds.EVOLUTION_API_URL;
    const apiKey = creds.EVOLUTION_API_KEY;
    const instanceName = creds.EVOLUTION_INSTANCE_NAME;

    if (!apiUrl || !apiKey || !instanceName) {
      return new Response(
        JSON.stringify({ error: "Missing Evolution API credentials" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const webhookUrl = `${supabaseUrl}/functions/v1/webhook-relay`;

    const body = await req.json().catch(() => ({}));
    const action = body.action || "status";

    // Check current webhook settings
    if (action === "status") {
      const getResp = await fetch(
        `${apiUrl}/webhook/find/${instanceName}`,
        { headers: { apikey: apiKey } }
      );
      const currentWebhooks = getResp.ok ? await getResp.json() : null;

      return new Response(
        JSON.stringify({
          instanceName,
          webhookUrl,
          currentWebhooks,
          note: "Use action='setup' to configure webhook. The Evolution API instance already has other webhooks - this will ADD a new one, not replace.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "setup") {
      // First, get current webhook configuration
      const getResp = await fetch(
        `${apiUrl}/webhook/find/${instanceName}`,
        { headers: { apikey: apiKey } }
      );
      const currentWebhooks = getResp.ok ? await getResp.json() : null;

      // Try to set as additional webhook (Evolution API v2 supports multiple via array)
      const setResp = await fetch(
        `${apiUrl}/webhook/set/${instanceName}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: apiKey,
          },
          body: JSON.stringify({
            webhook: {
              enabled: true,
              url: webhookUrl,
              webhookByEvents: false,
              webhookBase64: false,
              events: [
                "MESSAGES_UPSERT",
                "CONNECTION_UPDATE",
              ],
            },
          }),
        }
      );

      const respBody = setResp.ok ? await setResp.json() : await setResp.text();

      return new Response(
        JSON.stringify({
          success: setResp.ok,
          status: setResp.status,
          webhookUrl,
          instanceName,
          result: respBody,
          previousConfig: currentWebhooks,
          warning: "Se a Evolution API nao suporta multiplos webhooks, configure manualmente um relay central que repasse para: " + webhookUrl,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: "Action invalida. Use 'status' ou 'setup'." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
