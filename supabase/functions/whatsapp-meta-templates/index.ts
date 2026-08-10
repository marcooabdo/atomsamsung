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

    const url = new URL(req.url);
    const pathParts = url.pathname.split("/").filter(Boolean);
    const action = pathParts[pathParts.length - 1] || "";

    const body = req.method === "POST" ? await req.json() : {};
    const instanciaId = body.instancia_id || url.searchParams.get("instancia_id");

    if (!instanciaId) {
      return new Response(
        JSON.stringify({ error: "instancia_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: instancia } = await supabase
      .from("atom_connect_instancias")
      .select("id, wa_business_token, wa_business_account_id, api_url, api_key, instance_name")
      .eq("id", instanciaId)
      .maybeSingle();

    if (!instancia || !instancia.wa_business_token || !instancia.wa_business_account_id) {
      return new Response(
        JSON.stringify({ error: "Instance not found or Meta credentials not configured" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "send") {
      const { template_name, language, phone_number, components } = body;

      if (!template_name || !phone_number) {
        return new Response(
          JSON.stringify({ error: "template_name and phone_number are required" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const evolutionPayload: Record<string, unknown> = {
        number: phone_number.replace(/\D/g, ""),
        name: template_name,
        language: language || "pt_BR",
      };

      if (components && components.length > 0) {
        evolutionPayload.components = components;
      }

      const evolutionUrl = `${instancia.api_url}/message/sendTemplate/${instancia.instance_name}`;

      const response = await fetch(evolutionUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: instancia.api_key,
        },
        body: JSON.stringify(evolutionPayload),
      });

      const result = await response.json();

      if (!response.ok) {
        return new Response(
          JSON.stringify({ error: "Failed to send template", details: result }),
          { status: response.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          messageId: result.key?.id || result.messageId || null,
          result,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Default action: list templates from Meta Graph API
    const metaUrl = `https://graph.facebook.com/v21.0/${instancia.wa_business_account_id}/message_templates?fields=name,status,language,category,components&limit=100`;

    const metaResponse = await fetch(metaUrl, {
      headers: {
        Authorization: `Bearer ${instancia.wa_business_token}`,
      },
    });

    if (!metaResponse.ok) {
      const errData = await metaResponse.text();
      return new Response(
        JSON.stringify({ error: "Failed to fetch templates from Meta", details: errData }),
        { status: metaResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const metaData = await metaResponse.json();
    const templates = (metaData.data || []).filter(
      (t: { status: string }) => t.status === "APPROVED"
    );

    return new Response(
      JSON.stringify({ templates, total: templates.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
