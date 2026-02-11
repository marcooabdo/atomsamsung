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
  cleaned = cleaned.replace(/[^0-9]/g, "");
  return cleaned;
}

function isProtocolMessage(msg: any): boolean {
  if (!msg) return true;
  if (msg.protocolMessage) return true;
  if (msg.reactionMessage) return true;
  if (msg.pollUpdateMessage) return true;
  if (msg.editedMessage) return true;
  if (msg.senderKeyDistributionMessage && !msg.conversation && !msg.extendedTextMessage) return true;
  return false;
}

function hasActualContent(msg: any, body: any, data: any): boolean {
  if (!msg && !body && !data) return false;
  if (msg?.conversation) return true;
  if (msg?.extendedTextMessage?.text) return true;
  if (msg?.imageMessage) return true;
  if (msg?.audioMessage) return true;
  if (msg?.videoMessage) return true;
  if (msg?.documentMessage) return true;
  if (msg?.stickerMessage) return true;
  if (msg?.locationMessage) return true;
  if (msg?.contactMessage) return true;
  if (msg?.contactsArrayMessage) return true;
  if (body?.text) return true;
  if (data?.text) return true;
  if (body?.body) return true;
  return false;
}

function getExtensionFromMimetype(mimetype: string): string {
  const mimeMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "audio/ogg": "ogg",
    "audio/mpeg": "mp3",
    "audio/mp4": "m4a",
    "audio/opus": "opus",
    "audio/aac": "aac",
    "audio/ogg; codecs=opus": "ogg",
    "video/mp4": "mp4",
    "video/3gpp": "3gp",
    "application/pdf": "pdf",
  };
  return mimeMap[mimetype] || "bin";
}

async function fetchAndUploadMedia(
  supabase: any,
  instancia: { api_url: string; api_key: string; instance_name: string },
  messageId: string,
  mimetype: string,
  conversaId: string
): Promise<string | null> {
  try {
    const response = await fetch(
      `${instancia.api_url}/chat/getBase64FromMediaMessage/${instancia.instance_name}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: instancia.api_key,
        },
        body: JSON.stringify({
          message: { key: { id: messageId } },
          convertToMp4: false,
        }),
      }
    );

    if (!response.ok) {
      console.error("Failed to fetch media from Evolution API:", response.status);
      return null;
    }

    const result = await response.json();
    const base64Data = result.base64 || result.data;

    if (!base64Data) {
      console.error("No base64 data in response");
      return null;
    }

    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, "");
    const binaryData = Uint8Array.from(atob(cleanBase64), (c) => c.charCodeAt(0));

    const extension = getExtensionFromMimetype(mimetype);
    const fileName = `${conversaId}/${messageId}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("atom-connect")
      .upload(fileName, binaryData, {
        contentType: mimetype,
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("atom-connect")
      .getPublicUrl(fileName);

    console.log("Media uploaded successfully:", publicUrl);
    return publicUrl;
  } catch (error) {
    console.error("Error fetching/uploading media:", error);
    return null;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "ok", service: "evolution-webhook", version: "4.0" }), {
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
    console.log("Payload:", JSON.stringify(body).substring(0, 1500));

    const rawEvent = body.event || body.type || body.action || "";
    const event = normalizeEvent(rawEvent);
    const data = body.data || body;
    const instance = body.instance || body.instanceName || data?.instance || body.sender?.instance;

    console.log("Event:", event, "| Raw:", rawEvent);

    if (event.includes("messages.update") || event === "message.update") {
      console.log("Processing message STATUS UPDATE");
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
        }
      }

      return new Response(JSON.stringify({ success: true, type: "status_update" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isMessageUpsert = event.includes("messages.upsert");

    if (isMessageUpsert) {
      console.log("Processing as NEW MESSAGE event (messages.upsert)");

      const message = body.message || data.message || data;
      const key = body.key || message?.key || data?.key || {};
      const rawRemoteJid = key.remoteJid || body.remoteJid || data?.remoteJid || "";
      const messageId = key.id || body.messageId || "";

      if (!messageId) {
        console.log("No message ID, skipping");
        return new Response(JSON.stringify({ skip: "no_message_id" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (rawRemoteJid.endsWith("@g.us") || rawRemoteJid.endsWith("@lid") || rawRemoteJid.includes("@broadcast")) {
        console.log("Skipping group/lid/broadcast message");
        return new Response(JSON.stringify({ skip: "not_personal" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const phoneNumber = cleanPhoneNumber(rawRemoteJid);
      const fromMe = key.fromMe === true;

      console.log("Phone:", phoneNumber, "| FromMe:", fromMe, "| MsgId:", messageId);

      if (!phoneNumber || phoneNumber.length < 8) {
        return new Response(JSON.stringify({ skip: "invalid_phone" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const msg = message?.message || body?.message?.message || data?.message || {};

      if (isProtocolMessage(msg)) {
        return new Response(JSON.stringify({ skip: "protocol_message" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!hasActualContent(msg, body, data)) {
        return new Response(JSON.stringify({ skip: "no_content" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const messageStubType = message?.messageStubType || data?.messageStubType;
      if (messageStubType) {
        return new Response(JSON.stringify({ skip: "stub_message" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const instanceName = typeof instance === "string"
        ? instance
        : instance?.instanceName || instance?.name || body.instanceName || "";

      const { data: instancia } = await supabase
        .from("atom_connect_instancias")
        .select("id, unidade_id, api_url, api_key, instance_name")
        .eq("instance_name", instanceName)
        .maybeSingle();

      let targetInstancia = instancia;

      if (!targetInstancia) {
        const { data: fallbackInstancia } = await supabase
          .from("atom_connect_instancias")
          .select("id, unidade_id, api_url, api_key, instance_name")
          .limit(1)
          .maybeSingle();

        if (!fallbackInstancia) {
          return new Response(JSON.stringify({ error: "no_instance" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        targetInstancia = fallbackInstancia;
      }

      return await processMessage(supabase, message, data, body, phoneNumber, fromMe, messageId, targetInstancia);
    }

    if (event.includes("connection") || event.includes("status")) {
      const state = data.state || data.status || body.state;
      const instanceName = typeof instance === "string"
        ? instance
        : instance?.instanceName || instance?.name || body.instanceName || "";
      const isConnected = state === "open" || state === "connected";

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
        await supabase
          .from("atom_connect_instancias")
          .update({ qr_code: base64, status: "connecting" })
          .eq("instance_name", instanceName);
      }
    }

    if (event.includes("presence") || event.includes("composing") || event.includes("recording") || event.includes("paused")) {
      console.log("Processing presence event:", event);
      const remoteJid = data.remoteJid || data.id || body.remoteJid || body.participant || "";
      const presenceState = data.presence || data.state || body.presence || event.split(".").pop() || "";

      if (remoteJid && !remoteJid.endsWith("@g.us")) {
        const phoneNumber = cleanPhoneNumber(remoteJid);

        const { data: conversa } = await supabase
          .from("atom_connect_conversas")
          .select("id")
          .eq("cliente_telefone", phoneNumber)
          .maybeSingle();

        if (conversa) {
          let typingStatus: string | null = null;
          if (presenceState === "composing" || event.includes("composing")) {
            typingStatus = "typing";
          } else if (presenceState === "recording" || event.includes("recording")) {
            typingStatus = "recording";
          }

          await supabase
            .from("atom_connect_conversas")
            .update({
              cliente_digitando: typingStatus,
              cliente_digitando_at: typingStatus ? new Date().toISOString() : null
            })
            .eq("id", conversa.id);

          console.log("Updated typing status:", conversa.id, typingStatus);
        }
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
  instancia: { id: string; unidade_id: string; api_url: string; api_key: string; instance_name: string }
) {
  console.log("=== PROCESSING MESSAGE ===");

  const { count: existingCount } = await supabase
    .from("atom_connect_mensagens")
    .select("id", { count: "exact", head: true })
    .eq("message_id", messageId);

  if (existingCount && existingCount > 0) {
    console.log("DUPLICATE blocked - message already in DB:", messageId);
    return new Response(JSON.stringify({ success: true, duplicate: true }), {
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
    });
  }

  const msg = message?.message || body?.message?.message || data?.message || {};

  let tipo = "text";
  let conteudo = "";
  let caption = null;
  let mediaMimetype: string | null = null;
  let hasMedia = false;

  if (msg.conversation) {
    conteudo = msg.conversation;
  } else if (msg.extendedTextMessage) {
    conteudo = msg.extendedTextMessage.text || "";
  } else if (msg.imageMessage) {
    tipo = "image";
    caption = msg.imageMessage.caption;
    mediaMimetype = msg.imageMessage.mimetype || "image/jpeg";
    conteudo = caption || "[Imagem]";
    hasMedia = true;
  } else if (msg.audioMessage) {
    tipo = "audio";
    mediaMimetype = msg.audioMessage.mimetype || "audio/ogg; codecs=opus";
    conteudo = msg.audioMessage.ptt ? "[Audio]" : "[Audio]";
    hasMedia = true;
  } else if (msg.videoMessage) {
    tipo = "video";
    caption = msg.videoMessage.caption;
    mediaMimetype = msg.videoMessage.mimetype || "video/mp4";
    conteudo = caption || "[Video]";
    hasMedia = true;
  } else if (msg.documentMessage) {
    tipo = "document";
    caption = msg.documentMessage.fileName;
    mediaMimetype = msg.documentMessage.mimetype || "application/octet-stream";
    conteudo = caption || "[Documento]";
    hasMedia = true;
  } else if (msg.stickerMessage) {
    tipo = "sticker";
    mediaMimetype = msg.stickerMessage.mimetype || "image/webp";
    conteudo = "[Sticker]";
    hasMedia = true;
  } else if (msg.locationMessage) {
    tipo = "location";
    conteudo = `${msg.locationMessage.degreesLatitude},${msg.locationMessage.degreesLongitude}`;
  } else if (msg.contactMessage) {
    tipo = "contact";
    conteudo = msg.contactMessage.displayName || "[Contato]";
  } else if (msg.contactsArrayMessage) {
    tipo = "contact";
    const names = msg.contactsArrayMessage.contacts?.map((c: any) => c.displayName).join(", ");
    conteudo = names || "[Contatos]";
  } else if (body.text || data.text) {
    conteudo = body.text || data.text;
  } else if (body.body) {
    conteudo = body.body;
  }

  if (!conteudo || conteudo.trim() === "") {
    return new Response(JSON.stringify({ skip: "empty_content" }), {
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
    });
  }

  console.log("Content type:", tipo, "| Content:", conteudo.substring(0, 100), "| HasMedia:", hasMedia);

  let { data: conversa } = await supabase
    .from("atom_connect_conversas")
    .select("id, coluna_pipeline, mensagens_nao_lidas")
    .eq("cliente_telefone", phoneNumber)
    .eq("unidade_id", instancia.unidade_id)
    .maybeSingle();

  if (!conversa) {
    if (fromMe) {
      return new Response(JSON.stringify({ skip: "no_conversation_for_sent" }), {
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

    const pushName = message?.pushName || data?.pushName || body?.pushName || body?.senderName || phoneNumber;

    const { data: newConversa, error: insertError } = await supabase
      .from("atom_connect_conversas")
      .insert({
        unidade_id: instancia.unidade_id,
        instancia_id: instancia.id,
        cliente_telefone: phoneNumber,
        cliente_nome: pushName,
        coluna_pipeline: firstColumn?.id || "bot_triagem",
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
      return new Response(JSON.stringify({ error: "create_conversation_failed" }), {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      });
    }
    conversa = newConversa;
  } else {
    const updateData: Record<string, any> = {
      ultima_mensagem: conteudo,
      ultima_mensagem_at: new Date().toISOString(),
      cliente_digitando: null,
      cliente_digitando_at: null,
    };

    if (!fromMe) {
      updateData.ultima_resposta_cliente_at = new Date().toISOString();
      updateData.mensagens_nao_lidas = (conversa.mensagens_nao_lidas || 0) + 1;
    }

    await supabase
      .from("atom_connect_conversas")
      .update(updateData)
      .eq("id", conversa.id);
  }

  let mediaUrl: string | null = null;
  if (hasMedia && mediaMimetype && !fromMe) {
    console.log("Fetching media for message:", messageId);
    mediaUrl = await fetchAndUploadMedia(supabase, instancia, messageId, mediaMimetype, conversa.id);
  }

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
  }

  if (!fromMe && tipo === "text" && conteudo) {
    await processRatingResponse(supabase, conversa.id, conteudo.trim(), instancia);
  }

  console.log(`=== MESSAGE PROCESSED: ${phoneNumber} -> ${tipo} ===`);
  return new Response(JSON.stringify({ success: true, conversa_id: conversa.id }), {
    status: 200,
    headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
  });
}

async function processRatingResponse(
  supabase: any,
  conversaId: string,
  messageContent: string,
  instancia: { id: string; unidade_id: string; api_url: string; api_key: string; instance_name: string }
) {
  const { data: conversa } = await supabase
    .from("atom_connect_conversas")
    .select("id, cliente_telefone, aguardando_avaliacao, regra_finalizacao_id")
    .eq("id", conversaId)
    .maybeSingle();

  if (!conversa || !conversa.aguardando_avaliacao || !conversa.regra_finalizacao_id) {
    return;
  }

  const { data: regra } = await supabase
    .from("atom_connect_regras_finalizacao")
    .select("*")
    .eq("id", conversa.regra_finalizacao_id)
    .maybeSingle();

  if (!regra || !regra.opcoes) return;

  const opcoes = regra.opcoes as Array<{
    valor: string;
    label: string;
    resposta: string;
    acao: string;
    nps_score: number;
  }>;

  const normalizedContent = messageContent.toLowerCase().trim();
  const matchedOption = opcoes.find(
    (op) => op.valor.toLowerCase() === normalizedContent || op.label.toLowerCase() === normalizedContent
  );

  if (!matchedOption) return;

  if (matchedOption.resposta) {
    try {
      const phoneForSend = conversa.cliente_telefone.replace(/\D/g, "");
      await fetch(
        `${instancia.api_url}/message/sendText/${instancia.instance_name}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: instancia.api_key,
          },
          body: JSON.stringify({
            number: phoneForSend,
            text: matchedOption.resposta,
          }),
        }
      );

      await supabase.from("atom_connect_mensagens").insert({
        conversa_id: conversa.id,
        from_me: true,
        tipo: "text",
        conteudo: matchedOption.resposta,
        status: "sent",
        is_bot: true,
      });
    } catch (error) {
      console.error("Error sending rating response:", error);
    }
  }

  const updateData: Record<string, any> = {
    aguardando_avaliacao: false,
    nps_score: matchedOption.nps_score,
    nps_comentario: messageContent,
  };

  if (matchedOption.acao === "finalizar") {
    const { data: finalColumn } = await supabase
      .from("atom_connect_pipeline_colunas")
      .select("id")
      .eq("is_final", true)
      .limit(1)
      .maybeSingle();

    if (finalColumn) {
      updateData.coluna_pipeline = finalColumn.id;
    }
    updateData.is_bot_ativo = false;
  }

  await supabase
    .from("atom_connect_conversas")
    .update(updateData)
    .eq("id", conversa.id);
}
