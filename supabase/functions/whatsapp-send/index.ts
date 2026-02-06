import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface SendRequest {
  templateSlug: string;
  destinatarioTelefone: string;
  destinatarioNome?: string;
  variaveis: Record<string, string>;
  osId?: string;
  unidadeId?: string;
  forceSend?: boolean;
}

function renderTemplate(
  conteudo: string,
  variaveis: Record<string, string>
): string {
  let rendered = conteudo;
  for (const [key, value] of Object.entries(variaveis)) {
    rendered = rendered.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return rendered;
}

function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55")) return digits;
  return "55" + digits;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const whatsappToken = Deno.env.get("WHATSAPP_TOKEN");
    const whatsappPhoneId = Deno.env.get("WHATSAPP_PHONE_ID");

    const isDryRun = !whatsappToken || !whatsappPhoneId;

    const supabaseAuth = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: usuario } = await supabase
      .from("usuarios")
      .select("id, nome, tipo, unidade_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!usuario) {
      return new Response(JSON.stringify({ error: "User not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: SendRequest = await req.json();
    const {
      templateSlug,
      destinatarioTelefone,
      destinatarioNome = "",
      variaveis,
      osId,
      unidadeId = usuario.unidade_id,
      forceSend = false,
    } = body;

    if (!templateSlug || !destinatarioTelefone) {
      return new Response(
        JSON.stringify({
          error: "templateSlug and destinatarioTelefone are required",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const { data: template } = await supabase
      .from("whatsapp_templates")
      .select("*")
      .eq("slug", templateSlug)
      .eq("ativo", true)
      .maybeSingle();

    if (!template) {
      return new Response(
        JSON.stringify({ error: `Template '${templateSlug}' not found or inactive` }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const mensagemRenderizada = renderTemplate(template.conteudo, variaveis);
    const phoneFormatted = formatPhone(destinatarioTelefone);

    let sendStatus = "dry_run";
    let whatsappMessageId: string | null = null;
    let erro: string | null = null;

    if (!isDryRun && forceSend) {
      try {
        const waResponse = await fetch(
          `https://graph.facebook.com/v18.0/${whatsappPhoneId}/messages`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${whatsappToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              messaging_product: "whatsapp",
              to: phoneFormatted,
              type: "text",
              text: { body: mensagemRenderizada },
            }),
          }
        );

        if (waResponse.ok) {
          const waData = await waResponse.json();
          whatsappMessageId = waData.messages?.[0]?.id || null;
          sendStatus = "enviado";
        } else {
          const errText = await waResponse.text();
          erro = errText;
          sendStatus = "falha";
        }
      } catch (sendErr) {
        erro = String(sendErr);
        sendStatus = "falha";
      }
    }

    const { data: envio, error: insertError } = await supabase
      .from("whatsapp_envios")
      .insert({
        template_id: template.id,
        os_id: osId || null,
        destinatario_nome: destinatarioNome,
        destinatario_telefone: phoneFormatted,
        mensagem_enviada: mensagemRenderizada,
        variaveis: variaveis,
        status: sendStatus,
        whatsapp_message_id: whatsappMessageId,
        erro,
        dry_run: isDryRun || !forceSend,
        enviado_por: usuario.id,
        unidade_id: unidadeId || null,
      })
      .select()
      .single();

    if (insertError) {
      return new Response(
        JSON.stringify({
          error: "Failed to log send attempt",
          details: insertError.message,
        }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        isDryRun: isDryRun || !forceSend,
        status: sendStatus,
        mensagem: mensagemRenderizada,
        envio,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
