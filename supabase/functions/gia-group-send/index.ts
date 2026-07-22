import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TARGET_GROUP_JID = "120363427351181397@g.us";

interface GIAGroupSendRequest {
  message: string;
  useAI?: boolean;
  aiPrompt?: string;
  context?: Record<string, any>;
}

async function getEvolutionCredentials(supabase: any) {
  const { data: secrets } = await supabase
    .from("system_secrets")
    .select("key, value")
    .in("key", [
      "EVOLUTION_API_URL",
      "EVOLUTION_API_KEY",
      "EVOLUTION_INSTANCE_NAME",
      "OPENAI_API_KEY",
    ]);

  const map: Record<string, string> = {};
  for (const s of secrets || []) {
    map[s.key] = s.value;
  }
  return map;
}

async function generateAIMessage(
  openaiKey: string,
  prompt: string,
  context: Record<string, any>
): Promise<string> {
  const systemPrompt = `Voce e a GIA (Gestora de Inteligencia Artificial), assistente da empresa de assistencia tecnica Samsung. Voce envia notificacoes e relatorios para o grupo de WhatsApp da equipe. Seja objetiva, use emojis com moderacao, e foque em informacoes uteis. Responda sempre em portugues brasileiro.`;

  const userMessage = `${prompt}\n\nContexto/Dados:\n${JSON.stringify(context, null, 2)}`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI API error (${resp.status}): ${err}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "Erro ao gerar mensagem.";
}

async function sendToGroup(
  apiUrl: string,
  apiKey: string,
  instanceName: string,
  message: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const resp = await fetch(
    `${apiUrl}/message/sendText/${instanceName}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: apiKey,
      },
      body: JSON.stringify({
        number: TARGET_GROUP_JID,
        text: message,
      }),
    }
  );

  if (!resp.ok) {
    const errBody = await resp.text();
    return { success: false, error: `Evolution API error (${resp.status}): ${errBody.substring(0, 200)}` };
  }

  const data = await resp.json();
  const messageId = data.key?.id || data.id || data.messageId || null;
  return { success: true, messageId };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body: GIAGroupSendRequest = await req.json();
    const { message, useAI = false, aiPrompt, context = {} } = body;

    const creds = await getEvolutionCredentials(supabase);

    if (!creds.EVOLUTION_API_URL || !creds.EVOLUTION_API_KEY || !creds.EVOLUTION_INSTANCE_NAME) {
      return new Response(
        JSON.stringify({ error: "Credenciais Evolution API nao configuradas" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let finalMessage = message;

    if (useAI && aiPrompt) {
      if (!creds.OPENAI_API_KEY) {
        return new Response(
          JSON.stringify({ error: "OPENAI_API_KEY nao configurada" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      finalMessage = await generateAIMessage(creds.OPENAI_API_KEY, aiPrompt, context);
    }

    if (!finalMessage || finalMessage.trim() === "") {
      return new Response(
        JSON.stringify({ error: "Mensagem vazia" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const result = await sendToGroup(
      creds.EVOLUTION_API_URL,
      creds.EVOLUTION_API_KEY,
      creds.EVOLUTION_INSTANCE_NAME,
      finalMessage
    );

    if (!result.success) {
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabase.from("gia_group_messages").insert({
      group_jid: TARGET_GROUP_JID,
      direction: "outgoing",
      sender_phone: "553491368788",
      sender_name: "GIA",
      content: finalMessage,
      message_id: result.messageId || null,
      message_type: "text",
      processed_by_ai: useAI,
      ai_response: useAI ? finalMessage : null,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: finalMessage,
        messageId: result.messageId,
        usedAI: useAI,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
