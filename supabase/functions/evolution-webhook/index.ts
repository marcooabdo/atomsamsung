import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function normalizeEvent(rawEvent: string): string {
  return rawEvent
    .toLowerCase()
    .replace(/_/g, ".")
    .replace(/\s+/g, ".")
    .trim();
}

function cleanPhoneNumber(remoteJid: string): string {
  let cleaned = remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");

  const colonIndex = cleaned.indexOf(":");
  if (colonIndex !== -1) {
    cleaned = cleaned.substring(0, colonIndex);
  }

  return cleaned;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "ok", service: "evolution-webhook", version: "2.0" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    console.log("=== WEBHOOK RECEIVED ===");
    console.log("Full payload:", JSON.stringify(body).substring(0, 2000));

    const rawEvent = body.event || body.type || body.action || "";
    const event = normalizeEvent(rawEvent);
    const data = body.data || body;
    const instance = body.instance || body.instanceName || data?.instance || body.sender?.instance;

    console.log("Event:", event, "| Raw:", rawEvent);
    console.log("Instance:", JSON.stringify(instance));

    const isMessageEvent =
      event.includes("messages.upsert") ||
      event.includes("message") ||
      event === "messages" ||
      body.message ||
      body.data?.message ||
      body.data?.key;

    if (isMessageEvent) {
      console.log("Processing as message event");

      const message = body.message || data.message || data;
      const key = body.key || message?.key || data?.key || {};
      const remoteJid = key.remoteJid || body.remoteJid || data?.remoteJid || "";

      console.log("RemoteJid:", remoteJid);
      console.log("Key:", JSON.stringify(key));

      if (remoteJid.endsWith("@g.us")) {
        console.log("Skipping group message");
        return new Response(JSON.stringify({ skip: "group message" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (remoteJid.endsWith("@lid") || remoteJid.includes("@lid")) {
        console.log("Skipping lid format message (linked device)");
        return new Response(JSON.stringify({ skip: "lid format message" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const phoneNumber = cleanPhoneNumber(remoteJid);
      const fromMe = key.fromMe || false;

      console.log("Original remoteJid:", remoteJid, "| Cleaned phone:", phoneNumber);
      const messageId = key.id || body.messageId || crypto.randomUUID();

      console.log("Phone:", phoneNumber, "| FromMe:", fromMe, "| MsgId:", messageId);

      if (!phoneNumber) {
        console.log("No phone number found, skipping");
        return new Response(JSON.stringify({ skip: "no phone" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const instanceName = typeof instance === "string"
        ? instance
        : instance?.instanceName || instance?.name || body.instanceName || body.sender?.instance || "";

      console.log("Looking up instance:", instanceName);

      const { data: instancia, error: instanciaError } = await supabase
        .from("atom_connect_instancias")
        .select("id, unidade_id")
        .eq("instance_name", instanceName)
        .maybeSingle();

      if (instanciaError) {
        console.error("DB error looking up instance:", instanciaError);
      }

      if (!instancia) {
        const { data: allInstancias } = await supabase
          .from("atom_connect_instancias")
          .select("id, instance_name, unidade_id");
        console.log("Instance not found:", instanceName, "| Available:", JSON.stringify(allInstancias));

        if (allInstancias && allInstancias.length === 1) {
          console.log("Only one instance available, using it as fallback");
          const fallback = allInstancias[0];
          return await processMessage(supabase, message, data, body, phoneNumber, fromMe, messageId, fallback);
        }

        if (allInstancias && allInstancias.length > 0) {
          console.log("Multiple instances available, using first as fallback");
          const fallback = allInstancias[0];
          return await processMessage(supabase, message, data, body, phoneNumber, fromMe, messageId, fallback);
        }

        return new Response(JSON.stringify({ error: "Instance not found", instanceName }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return await processMessage(supabase, message, data, body, phoneNumber, fromMe, messageId, instancia);
    }

    if (event.includes("messages.update") || event === "message.update") {
      console.log("Processing message update");
      const updates = Array.isArray(data) ? data : [data];

      for (const update of updates) {
        const messageId = update.key?.id || update.id;
        const status = update.update?.status || update.status;

        if (messageId && status !== undefined) {
          let newStatus = "sent";
          if (status === 2) newStatus = "sent";
          if (status === 3) newStatus = "delivered";
          if (status === 4) newStatus = "read";

          await supabase
            .from("atom_connect_mensagens")
            .update({ status: newStatus })
            .eq("message_id", messageId);
          console.log("Updated message status:", messageId, newStatus);
        }
      }
    }

    if (event.includes("connection") || event.includes("status")) {
      const state = data.state || data.status || body.state;
      const instanceName = typeof instance === "string"
        ? instance
        : instance?.instanceName || instance?.name || body.instanceName || "";
      const isConnected = state === "open" || state === "connected";

      console.log("Connection update:", instanceName, state, isConnected);

      if (instanceName) {
        await supabase
          .from("atom_connect_instancias")
          .update({
            status: isConnected ? "connected" : "disconnected",
            qr_code: isConnected ? null : undefined,
          })
          .eq("instance_name", instanceName);
      }
    }

    if (event.includes("qrcode") || event.includes("qr")) {
      const base64 = data.qrcode?.base64 || data.base64 || body.qrcode;
      const instanceName = typeof instance === "string"
        ? instance
        : instance?.instanceName || instance?.name || body.instanceName || "";

      if (base64 && instanceName) {
        console.log("Updating QR code for:", instanceName);
        await supabase
          .from("atom_connect_instancias")
          .update({
            qr_code: base64,
            status: "connecting",
          })
          .eq("instance_name", instanceName);
      }
    }

    return new Response(JSON.stringify({ success: true, event }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function processMessage(
  supabase: any,
  message: any,
  data: any,
  body: any,
  phoneNumber: string,
  fromMe: boolean,
  messageId: string,
  instancia: { id: string; unidade_id: string }
) {
  console.log("=== PROCESSING MESSAGE ===");
  console.log("Phone:", phoneNumber);
  console.log("Instancia:", JSON.stringify(instancia));

  const msg = message?.message || body?.message?.message || data?.message || {};

  let tipo = "text";
  let conteudo = "";
  let caption = null;
  let mediaUrl = null;
  let mediaMimetype = null;

  if (msg.conversation) {
    conteudo = msg.conversation;
  } else if (msg.extendedTextMessage) {
    conteudo = msg.extendedTextMessage.text || "";
  } else if (msg.imageMessage) {
    tipo = "image";
    caption = msg.imageMessage.caption;
    mediaMimetype = msg.imageMessage.mimetype;
    mediaUrl = msg.imageMessage.url;
    conteudo = caption || "[Imagem]";
  } else if (msg.audioMessage) {
    tipo = "audio";
    mediaMimetype = msg.audioMessage.mimetype;
    mediaUrl = msg.audioMessage.url;
    conteudo = "[Audio]";
  } else if (msg.videoMessage) {
    tipo = "video";
    caption = msg.videoMessage.caption;
    mediaMimetype = msg.videoMessage.mimetype;
    mediaUrl = msg.videoMessage.url;
    conteudo = caption || "[Video]";
  } else if (msg.documentMessage) {
    tipo = "document";
    caption = msg.documentMessage.fileName;
    mediaMimetype = msg.documentMessage.mimetype;
    mediaUrl = msg.documentMessage.url;
    conteudo = caption || "[Documento]";
  } else if (msg.stickerMessage) {
    tipo = "sticker";
    mediaMimetype = msg.stickerMessage.mimetype;
    mediaUrl = msg.stickerMessage.url;
    conteudo = "[Sticker]";
  } else if (msg.locationMessage) {
    tipo = "location";
    conteudo = `${msg.locationMessage.degreesLatitude},${msg.locationMessage.degreesLongitude}`;
  } else if (msg.contactMessage) {
    tipo = "contact";
    conteudo = msg.contactMessage.displayName || "[Contato]";
  } else if (body.text || data.text) {
    conteudo = body.text || data.text;
  } else if (body.body) {
    conteudo = body.body;
  } else {
    conteudo = "[Mensagem]";
  }

  console.log("Content type:", tipo, "| Content:", conteudo.substring(0, 100));

  const { data: existingMsgEarly } = await supabase
    .from("atom_connect_mensagens")
    .select("id")
    .eq("message_id", messageId)
    .maybeSingle();

  if (existingMsgEarly) {
    console.log("Message already exists by ID (early check):", messageId);
    return new Response(JSON.stringify({ success: true, duplicate: true }), {
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
    });
  }

  let { data: conversa, error: conversaError } = await supabase
    .from("atom_connect_conversas")
    .select("id, coluna_pipeline, mensagens_nao_lidas")
    .eq("cliente_telefone", phoneNumber)
    .eq("unidade_id", instancia.unidade_id)
    .maybeSingle();

  if (conversaError) {
    console.error("Error fetching conversation:", conversaError);
  }

  console.log("Existing conversation:", conversa ? conversa.id : "none");

  if (conversa && fromMe) {
    const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
    const { data: recentSentMsg } = await supabase
      .from("atom_connect_mensagens")
      .select("id")
      .eq("conversa_id", conversa.id)
      .eq("from_me", true)
      .eq("conteudo", conteudo)
      .gte("created_at", oneMinuteAgo)
      .limit(1)
      .maybeSingle();

    if (recentSentMsg) {
      console.log("Skipping duplicate sent message (same content within 1 min)");
      return new Response(JSON.stringify({ success: true, duplicate: true, conversa_id: conversa.id }), {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      });
    }
  }

  if (!conversa) {
    if (fromMe) {
      console.log("No existing conversation and fromMe=true, skipping (don't create conversation for sent messages)");
      return new Response(JSON.stringify({ success: true, skip: "no_conversation_for_sent_message" }), {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      });
    }

    const { data: firstColumn } = await supabase
      .from("atom_connect_pipeline_colunas")
      .select("id")
      .order("ordem", { ascending: true })
      .limit(1)
      .maybeSingle();

    const pipelineColumnId = firstColumn?.id || "bot_triagem";
    console.log("First column:", pipelineColumnId);

    const pushName = message?.pushName || data?.pushName || body?.pushName || body?.senderName || phoneNumber;
    console.log("Creating new conversation for:", phoneNumber, "| Name:", pushName);

    const { data: newConversa, error: insertError } = await supabase
      .from("atom_connect_conversas")
      .insert({
        unidade_id: instancia.unidade_id,
        instancia_id: instancia.id,
        cliente_telefone: phoneNumber,
        cliente_nome: pushName,
        coluna_pipeline: pipelineColumnId,
        is_bot_ativo: true,
        ultima_mensagem: conteudo,
        ultima_mensagem_at: new Date().toISOString(),
        ultima_resposta_cliente_at: new Date().toISOString(),
        mensagens_nao_lidas: 1,
        tipo_atendimento: "whatsapp",
        prioridade: "normal",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating conversation:", insertError);
      return new Response(JSON.stringify({ error: "Error creating conversation", details: insertError }), {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      });
    }
    console.log("Conversation created:", newConversa.id);
    conversa = newConversa;
  } else {
    const updateData: Record<string, any> = {
      ultima_mensagem: conteudo,
      ultima_mensagem_at: new Date().toISOString(),
    };

    if (!fromMe) {
      updateData.ultima_resposta_cliente_at = new Date().toISOString();
      updateData.mensagens_nao_lidas = (conversa.mensagens_nao_lidas || 0) + 1;
    }

    const { error: updateError } = await supabase
      .from("atom_connect_conversas")
      .update(updateData)
      .eq("id", conversa.id);

    if (updateError) {
      console.error("Error updating conversation:", updateError);
    }
  }

  console.log("Inserting new message:", messageId);
  const { error: msgError } = await supabase.from("atom_connect_mensagens").insert({
    conversa_id: conversa.id,
    message_id: messageId,
    from_me: fromMe,
    tipo,
    conteudo,
    caption,
    media_url: mediaUrl,
    media_mimetype: mediaMimetype,
    status: fromMe ? "sent" : "delivered",
    is_bot: false,
  });

  if (msgError) {
    console.error("Error inserting message:", msgError);
  } else {
    console.log("Message inserted successfully");
  }

  console.log(`=== MESSAGE PROCESSED: ${phoneNumber} -> ${conteudo.substring(0, 50)} ===`);
  return new Response(JSON.stringify({ success: true, conversa_id: conversa.id }), {
    status: 200,
    headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
  });
}
