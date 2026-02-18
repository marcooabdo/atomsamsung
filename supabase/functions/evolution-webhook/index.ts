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

function findBase64InPayload(obj: any, maxDepth = 3, currentPath = ""): { path: string; value: string } | null {
  if (!obj || typeof obj !== "object" || maxDepth <= 0) return null;
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (
      (key === "base64" || key === "mediaBase64" || key === "media") &&
      typeof val === "string" &&
      val.length > 100
    ) {
      return { path: currentPath ? `${currentPath}.${key}` : key, value: val };
    }
    if (typeof val === "object" && val !== null && !Array.isArray(val)) {
      const found = findBase64InPayload(val, maxDepth - 1, currentPath ? `${currentPath}.${key}` : key);
      if (found) return found;
    }
  }
  return null;
}

function safeLogPayload(body: any): string {
  try {
    const sanitized = JSON.parse(JSON.stringify(body, (key, value) => {
      if ((key === "base64" || key === "mediaBase64" || key === "media") && typeof value === "string" && value.length > 200) {
        return `[BASE64_DATA length=${value.length}]`;
      }
      if (key === "jpegThumbnail" && typeof value === "string" && value.length > 100) {
        return `[THUMBNAIL length=${value.length}]`;
      }
      return value;
    }));
    return JSON.stringify(sanitized).substring(0, 3000);
  } catch {
    return "[ERROR serializing payload]";
  }
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

async function uploadBase64ToStorage(
  supabase: any,
  base64Data: string,
  mimetype: string,
  conversaId: string,
  messageId: string
): Promise<string | null> {
  try {
    const cleanBase64 = base64Data.replace(/^data:[^;]+;base64,/, "");
    if (!cleanBase64 || cleanBase64.length < 100) {
      console.error("Base64 data too short or empty, length:", cleanBase64?.length);
      return null;
    }

    const binaryData = Uint8Array.from(atob(cleanBase64), (c) => c.charCodeAt(0));
    if (binaryData.length === 0) {
      console.error("Decoded binary data is empty");
      return null;
    }

    const extension = getExtensionFromMimetype(mimetype);
    const fileName = `${conversaId}/${messageId}.${extension}`;

    console.log("Uploading to storage:", fileName, "| size:", binaryData.length, "bytes");

    const { error: uploadError } = await supabase.storage
      .from("atom-connect-media")
      .upload(fileName, binaryData, {
        contentType: mimetype,
        upsert: true,
      });

    if (uploadError) {
      console.error("Upload error:", uploadError);
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("atom-connect-media")
      .getPublicUrl(fileName);

    console.log("Media uploaded successfully:", publicUrl);
    return publicUrl;
  } catch (error) {
    console.error("Error uploading base64 to storage:", error);
    return null;
  }
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
      console.error("No base64 data in API response");
      return null;
    }

    return await uploadBase64ToStorage(supabase, base64Data, mimetype, conversaId, messageId);
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
    console.log("Payload:", safeLogPayload(body));

    const rawEvent = body.event || body.type || body.action || "";
    const event = normalizeEvent(rawEvent);
    const data = body.data || body;
    const instance = body.instance || body.instanceName || data?.instance || body.sender?.instance;

    console.log("Event:", event, "| Raw:", rawEvent);

    if (event.includes("messages.update") || event === "message.update" || event.includes("message.ack")) {
      console.log("Processing message STATUS UPDATE");
      console.log("Full update payload:", JSON.stringify(data, null, 2));

      const rawUpdates = body.data ?? body;
      const updates = Array.isArray(rawUpdates) ? rawUpdates : [rawUpdates];

      for (const update of updates) {
        const messageId =
          update.key?.id ||
          update.keyId ||
          update.id ||
          update.messageId ||
          update.message?.key?.id ||
          update.message?.id;

        const rawStatus =
          update.update?.status ??
          update.status ??
          update.ack ??
          update.message?.status;

        console.log(`Message ID: ${messageId}, Raw Status: ${rawStatus}, Type: ${typeof rawStatus}`);

        if (!messageId) {
          console.warn(`No messageId found. Keys: ${Object.keys(update).join(", ")}`);
          continue;
        }

        if (rawStatus === undefined || rawStatus === null) {
          console.warn(`No status found for message ${messageId}`);
          continue;
        }

        let newStatus = "sent";

        if (typeof rawStatus === "number") {
          if (rawStatus === 0 || rawStatus === 1) newStatus = "pending";
          else if (rawStatus === 2) newStatus = "sent";
          else if (rawStatus === 3) newStatus = "delivered";
          else if (rawStatus >= 4) newStatus = "read";
        } else if (typeof rawStatus === "string") {
          const upper = rawStatus.toUpperCase();
          if (upper === "PENDING" || upper === "ERROR" || upper === "0" || upper === "1") newStatus = "pending";
          else if (upper === "SERVER_ACK" || upper === "SENT" || upper === "2") newStatus = "sent";
          else if (upper === "DELIVERY_ACK" || upper === "DELIVERED" || upper === "3") newStatus = "delivered";
          else if (upper === "READ" || upper === "PLAYED" || upper === "VIEWED" || upper === "4" || upper === "5") newStatus = "read";
        }

        console.log(`Updating message ${messageId} to status: ${newStatus}`);

        const { data: result, error } = await supabase
          .from("atom_connect_mensagens")
          .update({ status: newStatus })
          .eq("message_id", messageId)
          .select("id");

        if (error) {
          console.error(`Error updating message ${messageId}:`, error);
        } else {
          console.log(`Updated ${result?.length || 0} rows for message ${messageId}`);
          if (result?.length === 0) {
            console.warn(`No message found with message_id: ${messageId}`);
          }
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

      if (rawRemoteJid.endsWith("@lid") || rawRemoteJid.includes("@broadcast")) {
        console.log("Skipping lid/broadcast message");
        return new Response(JSON.stringify({ skip: "not_personal" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const isGroup = rawRemoteJid.endsWith("@g.us");
      const phoneNumber = isGroup ? rawRemoteJid.replace("@g.us", "") : cleanPhoneNumber(rawRemoteJid);
      const fromMe = key.fromMe === true;

      const participant = key.participant || data?.participant || "";
      const senderPhone = participant ? cleanPhoneNumber(participant) : "";
      const senderName = message?.pushName || data?.pushName || body?.pushName || "";
      const groupSubject = data?.groupName || data?.subject || body?.groupName || "";

      console.log("Phone:", phoneNumber, "| FromMe:", fromMe, "| MsgId:", messageId, "| IsGroup:", isGroup, senderPhone ? `| Sender: ${senderName} (${senderPhone})` : "");

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

      // Skip incoming messages without pushName — these are duplicate "delivered" events from Evolution API
      // that carry no sender info. The real event with pushName arrives milliseconds earlier.
      if (!fromMe && !isGroup && !senderName) {
        console.log("Skipping incoming message without pushName (duplicate delivered event):", messageId);
        return new Response(JSON.stringify({ skip: "no_push_name" }), {
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

      return await processMessage(supabase, message, data, body, phoneNumber, fromMe, messageId, targetInstancia, {
        isGroup,
        groupJid: isGroup ? rawRemoteJid : null,
        senderPhone,
        senderName,
        groupSubject,
      });
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

    if (event.includes("groups") && (event.includes("upsert") || event.includes("update"))) {
      console.log("Processing GROUPS event:", event);
      const groupData = Array.isArray(data) ? data : [data];
      const instanceName = typeof instance === "string"
        ? instance
        : instance?.instanceName || instance?.name || body.instanceName || "";

      const { data: inst } = await supabase
        .from("atom_connect_instancias")
        .select("id, unidade_id")
        .eq("instance_name", instanceName)
        .maybeSingle();

      if (inst) {
        for (const g of groupData) {
          const jid = g.id || g.jid || g.groupJid || "";
          const subject = g.subject || g.name || g.desc || "";
          if (!jid || !subject) continue;

          const phone = jid.replace("@g.us", "");
          await supabase
            .from("atom_connect_conversas")
            .update({ cliente_nome: subject })
            .eq("cliente_telefone", phone)
            .eq("unidade_id", inst.unidade_id)
            .eq("is_group", true);

          console.log("Updated group name:", phone, "->", subject);
        }
      }

      return new Response(JSON.stringify({ success: true, type: "groups_upsert" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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
  instancia: { id: string; unidade_id: string; api_url: string; api_key: string; instance_name: string },
  groupInfo: { isGroup: boolean; groupJid: string | null; senderPhone: string; senderName: string; groupSubject: string } = { isGroup: false, groupJid: null, senderPhone: "", senderName: "", groupSubject: "" }
) {
  console.log("=== PROCESSING MESSAGE ===");

  // 1. Deduplication by message_id (primary check)
  if (messageId) {
    const { data: existingMsg } = await supabase
      .from("atom_connect_mensagens")
      .select("id, status, message_id")
      .eq("message_id", messageId)
      .maybeSingle();

    if (existingMsg) {
      if (fromMe && existingMsg.status === "pending") {
        await supabase
          .from("atom_connect_mensagens")
          .update({ status: "sent" })
          .eq("id", existingMsg.id);
        console.log("DUPLICATE fromMe - updated pending->sent:", messageId);
      } else {
        console.log("DUPLICATE blocked - message already in DB:", messageId);
      }
      return new Response(JSON.stringify({ success: true, duplicate: true }), {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      });
    }
  }

  // 2. For fromMe messages: check if a recent null-message_id row matches (echo of bot/attendant message)
  // This handles cases where the bot/attendant inserted without a message_id and then the Evolution echo arrives
  if (fromMe && messageId) {
    const cutoff = new Date(Date.now() - 60000).toISOString(); // within last 60s
    const { data: echoMsg } = await supabase
      .from("atom_connect_mensagens")
      .select("id, status, message_id")
      .eq("conversa_id", (await supabase.from("atom_connect_conversas").select("id").eq("cliente_telefone", phoneNumber).maybeSingle()).data?.id)
      .eq("from_me", true)
      .is("message_id", null)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (echoMsg) {
      // Update the existing null-message_id row with the real message_id and status
      await supabase
        .from("atom_connect_mensagens")
        .update({ message_id: messageId, status: "sent" })
        .eq("id", echoMsg.id);
      console.log("Echo fromMe - linked real message_id to existing row:", messageId, "->", echoMsg.id);
      return new Response(JSON.stringify({ success: true, linked: true }), {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      });
    }
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

  if (hasMedia) {
    const b64Keys = [];
    if (data?.base64) b64Keys.push("data.base64");
    if (message?.base64) b64Keys.push("message.base64");
    if (body?.data?.base64) b64Keys.push("body.data.base64");
    if (body?.base64) b64Keys.push("body.base64");
    console.log("Base64 found in:", b64Keys.length > 0 ? b64Keys.join(", ") : "NONE - will use API fallback");
    const topKeys = Object.keys(data || {}).filter(k => k !== "message").join(", ");
    console.log("Data top-level keys (excl message):", topKeys);
  }

  let { data: conversa } = await supabase
    .from("atom_connect_conversas")
    .select("id, coluna_pipeline, mensagens_nao_lidas, cliente_nome, is_group")
    .eq("cliente_telefone", phoneNumber)
    .eq("unidade_id", instancia.unidade_id)
    .maybeSingle();

  let isNewConversa = false;

  if (!conversa) {
    if (fromMe && !groupInfo.isGroup) {
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

    let groupName = groupInfo.groupSubject;
    let groupPhotoUrl: string | null = null;

    if (groupInfo.isGroup) {
      const gJid = groupInfo.groupJid;
      let gData: any = null;

      if (!groupName) {
        try {
          const respGet = await fetch(
            `${instancia.api_url}/group/findGroupInfos/${instancia.instance_name}?groupJid=${encodeURIComponent(gJid)}`,
            { headers: { apikey: instancia.api_key } }
          );
          if (respGet.ok) {
            const raw = await respGet.json();
            gData = Array.isArray(raw) ? raw[0] : raw;
            groupName = gData?.subject || gData?.name || gData?.desc || "";
          }
        } catch {}

        if (!groupName) {
          try {
            const respPost = await fetch(
              `${instancia.api_url}/group/findGroupInfos/${instancia.instance_name}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: instancia.api_key },
                body: JSON.stringify({ groupJid: gJid }),
              }
            );
            if (respPost.ok) {
              const raw = await respPost.json();
              gData = Array.isArray(raw) ? raw[0] : raw;
              groupName = gData?.subject || gData?.name || gData?.desc || "";
            }
          } catch {}
        }
      }

      if (gData) {
        groupPhotoUrl = gData.profilePictureUrl || gData.pictureUrl || gData.imgUrl || null;
      }

      if (!groupPhotoUrl) {
        try {
          const picResp = await fetch(`${instancia.api_url}/chat/fetchProfilePictureUrl/${instancia.instance_name}`, {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: instancia.api_key },
            body: JSON.stringify({ number: gJid }),
          });
          if (picResp.ok) {
            const picData = await picResp.json();
            groupPhotoUrl = picData.profilePictureUrl || picData.picture || picData.url || null;
          }
        } catch {}
      }

      if (groupName) console.log("Resolved group name:", groupName);
      if (groupPhotoUrl) console.log("Resolved group photo:", groupPhotoUrl);
    }

    const pushName = groupInfo.isGroup
      ? (groupName || `Grupo ${phoneNumber}`)
      : (message?.pushName || data?.pushName || body?.pushName || body?.senderName || phoneNumber);

    const insertData: Record<string, any> = {
      unidade_id: instancia.unidade_id,
      instancia_id: instancia.id,
      cliente_telefone: phoneNumber,
      cliente_nome: pushName,
      coluna_pipeline: firstColumn?.id || "bot_triagem",
      is_bot_ativo: groupInfo.isGroup ? false : true,
      ultima_mensagem: conteudo,
      ultima_mensagem_at: new Date().toISOString(),
      ultima_resposta_cliente_at: fromMe ? null : new Date().toISOString(),
      mensagens_nao_lidas: fromMe ? 0 : 1,
      tipo_atendimento: "whatsapp",
      prioridade: "normal",
      is_group: groupInfo.isGroup,
      group_jid: groupInfo.groupJid,
    };

    if (groupPhotoUrl) {
      insertData.cliente_foto_url = groupPhotoUrl;
    }

    const { data: newConversa, error: insertError } = await supabase
      .from("atom_connect_conversas")
      .insert(insertData)
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
    isNewConversa = true;
  }

  let mediaUrl: string | null = null;
  if (hasMedia && mediaMimetype) {
    let inlineBase64 = data?.base64 || message?.base64 || body?.data?.base64 || body?.base64;

    if (!inlineBase64) {
      const found = findBase64InPayload(body);
      if (found) {
        console.log("Base64 found via recursive search at:", found.path, "length:", found.value.length);
        inlineBase64 = found.value;
      }
    }

    if (inlineBase64) {
      console.log("Using inline base64, length:", String(inlineBase64).length);
      mediaUrl = await uploadBase64ToStorage(supabase, inlineBase64, mediaMimetype, conversa.id, messageId);
    }

    if (!mediaUrl && !fromMe) {
      console.log("Falling back to API fetch for media:", messageId);
      mediaUrl = await fetchAndUploadMedia(supabase, instancia, messageId, mediaMimetype, conversa.id);
    }

    console.log("Media result:", mediaUrl ? "SUCCESS" : "FAILED");
  }

  // Deduplication by content: if a recent message with same conversa_id, from_me, conteudo exists
  // within last 30s, treat as duplicate. This catches Evolution API's double-fire events where
  // the second event has a different messageId (delivered/ack event) but same content.
  const deduplicationCutoff = new Date(Date.now() - 30000).toISOString();
  const { data: recentDupe } = await supabase
    .from("atom_connect_mensagens")
    .select("id, message_id, status")
    .eq("conversa_id", conversa.id)
    .eq("from_me", fromMe)
    .eq("conteudo", conteudo)
    .gte("created_at", deduplicationCutoff)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recentDupe) {
    // If existing row has no message_id yet, link the real one and update status
    const updateFields: Record<string, any> = {};
    if (!recentDupe.message_id && messageId) updateFields.message_id = messageId;
    if (fromMe && recentDupe.status === "pending") updateFields.status = "sent";
    if (!fromMe && recentDupe.status !== "delivered") updateFields.status = "delivered";
    if (Object.keys(updateFields).length > 0) {
      await supabase
        .from("atom_connect_mensagens")
        .update(updateFields)
        .eq("id", recentDupe.id);
    }
    console.log("Content-dedup: duplicate message blocked:", messageId, "-> existing:", recentDupe.id);
    return new Response(JSON.stringify({ success: true, linked: true }), {
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
    });
  }

  const msgInsertData: Record<string, any> = {
    conversa_id: conversa.id,
    message_id: messageId || null,
    from_me: fromMe,
    tipo,
    conteudo,
    caption,
    media_url: mediaUrl,
    media_mimetype: mediaMimetype,
    status: fromMe ? "sent" : "delivered",
    is_bot: false,
  };

  if (groupInfo.isGroup && groupInfo.senderName) {
    msgInsertData.sender_name = groupInfo.senderName;
  }
  if (groupInfo.isGroup && groupInfo.senderPhone) {
    msgInsertData.sender_phone = groupInfo.senderPhone;
  }

  const { error: msgError } = await supabase.from("atom_connect_mensagens").insert(msgInsertData);

  if (msgError) {
    if (msgError.code === "23505" || msgError.message?.includes("unique") || msgError.message?.includes("duplicate")) {
      console.log("DUPLICATE blocked by DB constraint:", messageId);
      return new Response(JSON.stringify({ success: true, duplicate: true }), {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      });
    }
    console.error("Error inserting message:", msgError);
  }

  if (!isNewConversa) {
    const previewMsg = groupInfo.isGroup && groupInfo.senderName && !fromMe
      ? `${groupInfo.senderName.split(" ")[0]}: ${conteudo}`
      : conteudo;

    const updateData: Record<string, any> = {
      ultima_mensagem: previewMsg,
      ultima_mensagem_at: new Date().toISOString(),
      cliente_digitando: null,
      cliente_digitando_at: null,
    };

    if (groupInfo.isGroup) {
      const currentName = conversa.cliente_nome || "";
      const nameIsNumericId = !currentName || /^(Grupo\s+)?\d{10,}$/.test(currentName.trim());

      if (groupInfo.groupSubject) {
        if (nameIsNumericId) updateData.cliente_nome = groupInfo.groupSubject;
      } else if (nameIsNumericId) {
        let resolved = "";
        const gJid = groupInfo.groupJid;
        try {
          const respGet = await fetch(
            `${instancia.api_url}/group/findGroupInfos/${instancia.instance_name}?groupJid=${encodeURIComponent(gJid)}`,
            { headers: { apikey: instancia.api_key } }
          );
          if (respGet.ok) {
            const raw = await respGet.json();
            const d = Array.isArray(raw) ? raw[0] : raw;
            resolved = d?.subject || d?.name || d?.desc || "";
          }
        } catch {}

        if (!resolved) {
          try {
            const respPost = await fetch(
              `${instancia.api_url}/group/findGroupInfos/${instancia.instance_name}`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: instancia.api_key },
                body: JSON.stringify({ groupJid: gJid }),
              }
            );
            if (respPost.ok) {
              const raw = await respPost.json();
              const d = Array.isArray(raw) ? raw[0] : raw;
              resolved = d?.subject || d?.name || d?.desc || "";
            }
          } catch {}
        }

        if (resolved) {
          updateData.cliente_nome = resolved;
          console.log("Resolved group name on update:", resolved);
        }
      }
    }

    if (!fromMe) {
      updateData.ultima_resposta_cliente_at = new Date().toISOString();
      updateData.mensagens_nao_lidas = (conversa.mensagens_nao_lidas || 0) + 1;

      if (!groupInfo.isGroup) {
        const { data: currentColumn } = await supabase
          .from("atom_connect_pipeline_colunas")
          .select("is_final")
          .eq("id", conversa.coluna_pipeline)
          .maybeSingle();

        if (currentColumn?.is_final) {
          console.log("Conversation in final column, moving back to first column");
          const { data: firstColumn } = await supabase
            .from("atom_connect_pipeline_colunas")
            .select("id")
            .order("ordem", { ascending: true })
            .limit(1)
            .maybeSingle();

          if (firstColumn) {
            updateData.coluna_pipeline = firstColumn.id;
            updateData.is_bot_ativo = true;
            updateData.atendente_id = null;
            updateData.aguardando_avaliacao = false;
            updateData.regra_finalizacao_id = null;
            console.log("Moved to column:", firstColumn.id);
          }
        }
      }
    }

    await supabase
      .from("atom_connect_conversas")
      .update(updateData)
      .eq("id", conversa.id);
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
