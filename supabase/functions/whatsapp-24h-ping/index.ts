import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

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
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Load all 24h configs
    const { data: configs } = await supabase
      .from("atom_connect_24h_config")
      .select("unidade_id, ping_ativo, ping_horas, ping_mensagem")
      .eq("ping_ativo", true);

    if (!configs || configs.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active ping configs found", sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let totalSent = 0;
    const errors: string[] = [];

    for (const config of configs) {
      const pingHours = config.ping_horas || 20;
      const pingMsg = config.ping_mensagem;

      if (!pingMsg) continue;

      // Find conversations where the client last messaged between (pingHours - 1) and (pingHours + 1) hours ago
      // This gives a 2-hour window for the hourly cron to catch them
      const now = new Date();
      const minAge = new Date(now.getTime() - (pingHours + 1) * 60 * 60 * 1000);
      const maxAge = new Date(now.getTime() - (pingHours - 1) * 60 * 60 * 1000);

      const { data: conversas } = await supabase
        .from("atom_connect_conversas")
        .select("id, cliente_telefone, unidade_id, ultima_resposta_cliente_at, ping_24h_enviado_em, is_group")
        .eq("unidade_id", config.unidade_id)
        .is("finalizado_at", null)
        .is("is_group", false)
        .not("ultima_resposta_cliente_at", "is", null)
        .gte("ultima_resposta_cliente_at", minAge.toISOString())
        .lte("ultima_resposta_cliente_at", maxAge.toISOString());

      if (!conversas || conversas.length === 0) continue;

      // Get the Evolution instance for this unit
      const { data: instancia } = await supabase
        .from("atom_connect_instancias")
        .select("id, api_url, api_key, instance_name")
        .eq("unidade_id", config.unidade_id)
        .eq("status", "connected")
        .limit(1)
        .maybeSingle();

      if (!instancia) {
        errors.push(`No connected instance for unit ${config.unidade_id}`);
        continue;
      }

      for (const conversa of conversas) {
        // Skip if ping was already sent after the last client message
        if (
          conversa.ping_24h_enviado_em &&
          conversa.ultima_resposta_cliente_at &&
          new Date(conversa.ping_24h_enviado_em) > new Date(conversa.ultima_resposta_cliente_at)
        ) {
          continue;
        }

        try {
          const phoneNumber = conversa.cliente_telefone.replace(/\D/g, "");

          // Send via Evolution API (free-form text, window is still open)
          const response = await fetch(
            `${instancia.api_url}/message/sendText/${instancia.instance_name}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                apikey: instancia.api_key,
              },
              body: JSON.stringify({
                number: phoneNumber,
                text: pingMsg,
              }),
            }
          );

          const result = await response.json();
          const messageId = result.key?.id || result.messageId || null;

          if (response.ok && messageId) {
            // Record the message in the conversation
            await supabase.from("atom_connect_mensagens").insert({
              conversa_id: conversa.id,
              message_id: messageId,
              from_me: true,
              tipo: "text",
              conteudo: pingMsg,
              status: "sent",
              is_bot: true,
            });

            // Mark ping as sent
            await supabase
              .from("atom_connect_conversas")
              .update({
                ping_24h_enviado_em: new Date().toISOString(),
                ultima_mensagem: pingMsg.substring(0, 200),
                ultima_mensagem_at: new Date().toISOString(),
              })
              .eq("id", conversa.id);

            totalSent++;
          } else {
            errors.push(`Failed to send ping to ${phoneNumber}: ${JSON.stringify(result)}`);
          }
        } catch (sendErr) {
          errors.push(`Error sending to ${conversa.cliente_telefone}: ${String(sendErr)}`);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: totalSent,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
