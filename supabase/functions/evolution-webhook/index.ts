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

function normalizeBrazilianPhone(phone: string): string {
  if (!phone.startsWith("55")) return phone;
  const rest = phone.substring(2);
  if (rest.length === 10) {
    const ddd = rest.substring(0, 2);
    const num = rest.substring(2);
    if (num[0] === "6" || num[0] === "7" || num[0] === "8" || num[0] === "9") {
      return "55" + ddd + "9" + num;
    }
  }
  return phone;
}

function cleanPhoneNumber(remoteJid: string): string {
  let cleaned = remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
  const colonIndex = cleaned.indexOf(":");
  if (colonIndex !== -1) {
    cleaned = cleaned.substring(0, colonIndex);
  }
  cleaned = cleaned.replace(/[^0-9]/g, "");
  return normalizeBrazilianPhone(cleaned);
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
      return null;
    }

    const binaryData = Uint8Array.from(atob(cleanBase64), (c) => c.charCodeAt(0));
    if (binaryData.length === 0) {
      return null;
    }

    const extension = getExtensionFromMimetype(mimetype);
    const fileName = `${conversaId}/${messageId}.${extension}`;

    const { error: uploadError } = await supabase.storage
      .from("atom-connect-media")
      .upload(fileName, binaryData, {
        contentType: mimetype,
        upsert: true,
      });

    if (uploadError) {
      return null;
    }

    const { data: { publicUrl } } = supabase.storage
      .from("atom-connect-media")
      .getPublicUrl(fileName);

    return publicUrl;
  } catch (error) {
    // ignored
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
      return null;
    }

    const result = await response.json();
    const base64Data = result.base64 || result.data;

    if (!base64Data) {
      return null;
    }

    return await uploadBase64ToStorage(supabase, base64Data, mimetype, conversaId, messageId);
  } catch (error) {
    // ignored
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

    const rawEvent = body.event || body.type || body.action || "";
    const event = normalizeEvent(rawEvent);
    const data = body.data || body;
    const instance = body.instance || body.instanceName || data?.instance || body.sender?.instance;

    if (event.includes("messages.update") || event === "message.update" || event.includes("message.ack")) {
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

        if (!messageId) {
          continue;
        }

        if (rawStatus === undefined || rawStatus === null) {
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
          if (upper === "PENDING" || upper === "0" || upper === "1") newStatus = "pending";
          else if (upper === "ERROR" || upper === "FAILED") newStatus = "failed";
          else if (upper === "SERVER_ACK" || upper === "SENT" || upper === "2") newStatus = "sent";
          else if (upper === "DELIVERY_ACK" || upper === "DELIVERED" || upper === "3") newStatus = "delivered";
          else if (upper === "READ" || upper === "PLAYED" || upper === "VIEWED" || upper === "4" || upper === "5") newStatus = "read";
        }

        const { data: result, error } = await supabase
          .from("atom_connect_mensagens")
          .update({ status: newStatus })
          .eq("message_id", messageId)
          .select("id, conversa_id");

        // When a message fails, force the 24h window closed on the conversation
        if (!error && result && result.length > 0 && newStatus === "failed") {
          await supabase
            .from("atom_connect_conversas")
            .update({ janela_fechada_forcada: true })
            .eq("id", result[0].conversa_id);
        }
      }

      return new Response(JSON.stringify({ success: true, type: "status_update" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isMessageUpsert = event.includes("messages.upsert");

    if (isMessageUpsert) {
      const message = body.message || data.message || data;
      const key = body.key || message?.key || data?.key || {};
      const rawRemoteJid = key.remoteJid || body.remoteJid || data?.remoteJid || "";
      const messageId = key.id || body.messageId || "";

      if (!messageId) {
        return new Response(JSON.stringify({ skip: "no_message_id" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (rawRemoteJid.endsWith("@lid") || rawRemoteJid.includes("@broadcast")) {
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

      // GIA report request detection - ONLY in groups
      if (isGroup && !fromMe) {
        const textContent = msg.conversation || msg.extendedTextMessage?.text || "";
        if (textContent && isGIARouteCommand(textContent)) {
          const webhookInstanceName = typeof instance === "string"
            ? instance
            : instance?.instanceName || instance?.name || body.instanceName || "Marco";
          await handleGIARouteCommand(supabase, textContent, rawRemoteJid, webhookInstanceName);
          return new Response(JSON.stringify({ ok: true, action: "gia_route_command" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } else if (textContent && isGIAReportRequest(textContent)) {
          const webhookInstanceName = typeof instance === "string"
            ? instance
            : instance?.instanceName || instance?.name || body.instanceName || "Marco";
          handleGIAReportRequest(null, textContent, rawRemoteJid, { api_url: "", api_key: "", instance_name: webhookInstanceName });
        }
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
        // For group messages, do NOT fallback to another instance
        // as this would create the group in the wrong unit
        if (isGroup) {
          return new Response(JSON.stringify({ skip: "group_no_matching_instance" }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

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
        }
      }
    }

    return new Response(JSON.stringify({ success: true, event }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
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

  let { data: conversa } = await supabase
    .from("atom_connect_conversas")
    .select("id, coluna_pipeline, mensagens_nao_lidas, cliente_nome, is_group, is_interno")
    .eq("cliente_telefone", phoneNumber)
    .eq("unidade_id", instancia.unidade_id)
    .maybeSingle();

  if (!conversa && phoneNumber.startsWith("55") && phoneNumber.length === 13) {
    const without9 = "55" + phoneNumber.substring(2, 4) + phoneNumber.substring(5);
    const { data: altConversa } = await supabase
      .from("atom_connect_conversas")
      .select("id, coluna_pipeline, mensagens_nao_lidas, cliente_nome, is_group, is_interno")
      .eq("cliente_telefone", without9)
      .eq("unidade_id", instancia.unidade_id)
      .maybeSingle();
    if (altConversa) {
      await supabase
        .from("atom_connect_conversas")
        .update({ cliente_telefone: phoneNumber })
        .eq("id", altConversa.id);
      conversa = altConversa;
    }
  }

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

    // Auto-link OS by phone number (only for individual conversations, not groups)
    if (!groupInfo.isGroup && phoneNumber) {
      try {
        const phoneSuffix = phoneNumber.replace(/\D/g, "").slice(-8);
        if (phoneSuffix.length >= 8) {
          const { data: matchedOS } = await supabase
            .from("os")
            .select("id")
            .eq("unidade_id", instancia.unidade_id)
            .or(`cliente_telefone.ilike.%${phoneSuffix},cliente_telefone_2.ilike.%${phoneSuffix}`)
            .not("coluna_kanban", "in", '("finalizado","arquivado")')
            .order("created_at", { ascending: false })
            .limit(1);
          if (matchedOS && matchedOS.length > 0) {
            insertData.os_id = matchedOS[0].id;
          }
        }
      } catch {}
    }

    const { data: newConversa, error: insertError } = await supabase
      .from("atom_connect_conversas")
      .insert(insertData)
      .select()
      .single();

    if (insertError) {
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
        inlineBase64 = found.value;
      }
    }

    if (inlineBase64) {
      mediaUrl = await uploadBase64ToStorage(supabase, inlineBase64, mediaMimetype, conversa.id, messageId);
    }

    if (!mediaUrl && !fromMe) {
      mediaUrl = await fetchAndUploadMedia(supabase, instancia, messageId, mediaMimetype, conversa.id);
    }
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

  const contextInfo =
    msg.extendedTextMessage?.contextInfo ||
    msg.imageMessage?.contextInfo ||
    msg.videoMessage?.contextInfo ||
    msg.audioMessage?.contextInfo ||
    msg.documentMessage?.contextInfo ||
    msg.stickerMessage?.contextInfo ||
    null;

  if (contextInfo?.stanzaId) {
    msgInsertData.quoted_message_id = contextInfo.stanzaId;

    const quotedMsg = contextInfo.quotedMessage || {};
    const quotedText =
      quotedMsg.conversation ||
      quotedMsg.extendedTextMessage?.text ||
      quotedMsg.imageMessage?.caption ||
      quotedMsg.videoMessage?.caption ||
      (quotedMsg.audioMessage ? "[Audio]" : null) ||
      (quotedMsg.documentMessage ? quotedMsg.documentMessage.fileName || "[Documento]" : null) ||
      (quotedMsg.stickerMessage ? "[Sticker]" : null) ||
      "";
    if (quotedText) msgInsertData.quoted_content = quotedText.substring(0, 500);

    const quotedParticipant = contextInfo.participant || "";
    if (quotedParticipant) {
      msgInsertData.quoted_sender = cleanPhoneNumber(quotedParticipant);
    }

    let quotedType = "text";
    if (quotedMsg.imageMessage) quotedType = "image";
    else if (quotedMsg.audioMessage) quotedType = "audio";
    else if (quotedMsg.videoMessage) quotedType = "video";
    else if (quotedMsg.documentMessage) quotedType = "document";
    else if (quotedMsg.stickerMessage) quotedType = "sticker";
    msgInsertData.quoted_type = quotedType;
  }

  const { error: msgError } = await supabase.from("atom_connect_mensagens").insert(msgInsertData);

  if (msgError) {
    if (msgError.code === "23505" || msgError.message?.includes("unique") || msgError.message?.includes("duplicate")) {
      return new Response(JSON.stringify({ success: true, duplicate: true }), {
        status: 200,
        headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
      });
    }
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
        }
      }
    }

    if (!fromMe) {
      updateData.ultima_resposta_cliente_at = new Date().toISOString();
      updateData.mensagens_nao_lidas = (conversa.mensagens_nao_lidas || 0) + 1;
      updateData.janela_fechada_forcada = false;
      updateData.ping_24h_enviado_em = null;

      if (!groupInfo.isGroup) {
        const { data: currentColumn } = await supabase
          .from("atom_connect_pipeline_colunas")
          .select("is_final")
          .eq("id", conversa.coluna_pipeline)
          .maybeSingle();

        if (currentColumn?.is_final) {
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
          }
        }
      }
    }

    await supabase
      .from("atom_connect_conversas")
      .update(updateData)
      .eq("id", conversa.id);
  }

  if (!fromMe && tipo === "text" && conteudo && !conversa.is_interno) {
    const trimmed = conteudo.trim();

    const handledByGIA = await processGIASchedulingResponse(supabase, phoneNumber, trimmed, instancia);
    if (!handledByGIA) {
      await processRatingResponse(supabase, conversa.id, trimmed, instancia);

      // If not awaiting rating and not a group, check if bot should respond
      if (!conversa.aguardando_avaliacao && !groupInfo.isGroup) {
        // Re-fetch conversa to get latest is_bot_ativo (may have changed above)
        const { data: freshConversa } = await supabase
          .from("atom_connect_conversas")
          .select("is_bot_ativo")
          .eq("id", conversa.id)
          .maybeSingle();

        if (freshConversa?.is_bot_ativo) {
          try {
            const giaUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/gia-atendimento`;
            const giaResp = await fetch(giaUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({
                conversa_id: conversa.id,
                mensagem_cliente: trimmed,
              }),
            });
            if (!giaResp.ok) {
              console.error("[Webhook] GIA atendimento call failed:", giaResp.status);
            }
          } catch (giaErr) {
            console.error("[Webhook] GIA atendimento error:", giaErr);
          }
        }
      }
    }
  }

  // When a human agent sends a message (fromMe, not a bot echo), disable the bot
  if (fromMe && !conversa.is_interno && !groupInfo.isGroup) {
    // Check if this message was sent by a human (not the bot)
    // Bot messages have is_bot=true; human messages from the UI come through Evolution as fromMe
    const { data: thisMsg } = await supabase
      .from("atom_connect_mensagens")
      .select("is_bot")
      .eq("conversa_id", conversa.id)
      .eq("message_id", messageId)
      .maybeSingle();

    // If the message is NOT from the bot AND bot is currently active, disable it
    if (thisMsg && !thisMsg.is_bot && conversa.is_bot_ativo) {
      await supabase
        .from("atom_connect_conversas")
        .update({ is_bot_ativo: false })
        .eq("id", conversa.id);
    }
  }

  return new Response(JSON.stringify({ success: true, conversa_id: conversa.id }), {
    status: 200,
    headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
  });
}

const GIA_REPORT_KEYWORDS: Array<{ keywords: string[]; tipo: string }> = [
  { keywords: ["ow simples", "relatorio ow simples", "relatório ow simples"], tipo: "ow_simples" },
  { keywords: ["sla", "sla connect", "sla atom", "sem resposta", "pendentes connect"], tipo: "sla_atom_connect" },
  { keywords: ["validacao ow", "validação ow", "relatorio ow", "relatório ow", "ow sem servico", "ow sem serviço"], tipo: "validacao_ow" },
  { keywords: ["relatorio 2 horas", "relatório 2 horas", "2 horas", "2h parada", "relatorio 2h", "relatório 2h"], tipo: "relatorio_2h" },
  { keywords: ["km", "quilom", "dinheiro na mesa", "receita km", "deslocamento"], tipo: "relatorio_km" },
  { keywords: ["controle lp", "relatório lp", "relatorio lp", " lp", "prazo lp"], tipo: "controle_lp_prazo" },
  { keywords: ["pulso", "operacional", "cockpit"], tipo: "pulso_operacional" },
  { keywords: ["estoque", "dia"], tipo: "estoque_dia" },
  { keywords: ["sem rota", "os sem rota", "relatório rota", "relatorio rota", "relatório rotas", "relatorio rotas"], tipo: "agendamentos_ih" },
  { keywords: ["mapa rota", "mapa rotas", "mapa de rota", "relatório agenda", "relatorio agenda", "agenda"], tipo: "mapa_rotas" },
  { keywords: ["abertura", "fechamento"], tipo: "abertura_fechamento" },
  { keywords: ["limite", "credito", "crédito", "gspn"], tipo: "limite_credito_gspn" },
  { keywords: ["nucleo", "núcleo", "peça", "pecas", "peças"], tipo: "nucleo_pecas" },
  { keywords: ["compliance", "erro", "erros", "problema"], tipo: "compliance_erros" },
  { keywords: ["resumo", "final"], tipo: "resumo_final" },
  { keywords: ["todos", "completo", "geral"], tipo: "__todos__" },
];

function isGIAReportRequest(text: string): boolean {
  const lower = text.toLowerCase();
  if (!lower.includes("gia")) return false;
  const hasReportWord = ["relatório", "relatorio", "report", "me dê", "me de", "me da", "me dá", "envia", "envie", "manda", "gera", "gere", "pulso", "abertura", "fechamento", "estoque", "compliance", "resumo", "agenda", "agendamento", " lp", "controle lp", "km", "dinheiro na mesa", "deslocamento", "sla", "connect", "sem resposta", "ow simples"].some((w) => lower.includes(w));
  return hasReportWord;
}

function detectReportType(text: string): string | null {
  const lower = text.toLowerCase();
  for (const entry of GIA_REPORT_KEYWORDS) {
    if (entry.keywords.some((kw) => lower.includes(kw))) {
      return entry.tipo;
    }
  }
  return null;
}

const UNIT_ALIASES_REPORT: { keywords: string[]; unidade_id: string; nome: string }[] = [
  { keywords: ["moc", "montes claros"], unidade_id: "234822a3-f706-47f5-97af-bc7732417660", nome: "Montes Claros" },
  { keywords: ["fsa", "feira de santana", "feira"], unidade_id: "1b9ff2d1-474e-4783-aa39-80c89a6a48cf", nome: "Feira de Santana" },
  { keywords: ["jdf", "juiz de fora", "juiz"], unidade_id: "4ba3e16b-5627-480e-b2b2-f6599a211d41", nome: "Juiz de Fora" },
  { keywords: ["sbc", "sao bernardo", "bernardo"], unidade_id: "96fb83dd-3ea2-478e-a5f1-bbb58da99592", nome: "São Bernardo do Campo" },
];

function detectUnitFromText(text: string): string | null {
  const lower = text.toLowerCase();
  for (const unit of UNIT_ALIASES_REPORT) {
    if (unit.keywords.some(kw => lower.includes(kw))) {
      return unit.unidade_id;
    }
  }
  return null;
}

async function handleGIAReportRequest(
  _supabase: any,
  text: string,
  groupJid: string,
  _instancia: { api_url: string; api_key: string; instance_name: string }
) {
  try {
    const tipo = detectReportType(text);
    if (!tipo) {
      console.log("[GIA Report] No report type detected in:", text);
      return;
    }

    const detectedUnidadeId = detectUnitFromText(text);
    console.log(`[GIA Report] Detected type=${tipo}, group=${groupJid}, unidade=${detectedUnidadeId || "todas"}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const payload: any = {
      instance_name: _instancia.instance_name || "Marco",
    };

    if (tipo === "__todos__") {
      payload.todos = true;
    } else {
      payload.tipo = tipo;
      if (detectedUnidadeId) {
        payload.unidade_id = detectedUnidadeId;
      }
    }

    // Fire and forget - don't block the webhook response
    fetch(`${supabaseUrl}/functions/v1/gia-send-relatorio`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${supabaseServiceKey}`,
      },
      body: JSON.stringify(payload),
    }).then((resp) => {
      console.log(`[GIA Report] gia-send-relatorio response: ${resp.status}`);
    }).catch((err) => {
      console.error("[GIA Report] Error calling gia-send-relatorio:", err);
    });
  } catch (err) {
    console.error("[GIA Report] Error handling request:", err);
  }
}

async function processGIASchedulingResponse(
  supabase: any,
  phoneNumber: string,
  messageContent: string,
  instancia: { id: string; unidade_id: string; api_url: string; api_key: string; instance_name: string }
): Promise<boolean> {
  const normalized = messageContent.replace(/[\[\]]/g, "").trim();
  if (normalized !== "1" && normalized !== "2") return false;

  const phoneSuffixes = [phoneNumber, phoneNumber.replace(/^55/, "")];
  const phoneVariants = phoneSuffixes.flatMap(p => [p, `55${p.replace(/^55/, "")}`]);

  let osRecord: any = null;
  for (const phone of phoneVariants) {
    const { data } = await supabase
      .from("os")
      .select("id, numero_os_interna, numero_os_samsung, cliente_nome, cliente_telefone, unidade_id, data_agendamento, periodo_agendamento, status_agendamento_gia")
      .eq("status_agendamento_gia", "aguardando_confirmacao_cliente")
      .ilike("cliente_telefone", `%${phone.slice(-9)}%`)
      .order("whatsapp_sent_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (data) {
      osRecord = data;
      break;
    }
  }

  if (!osRecord) {
    return false;
  }

  const phoneForSend = phoneNumber.startsWith("55") ? phoneNumber : `55${phoneNumber}`;

  if (normalized === "1") {
    await supabase
      .from("os")
      .update({
        confirmado_com_cliente: true,
        status_agendamento_gia: "confirmado",
      })
      .eq("id", osRecord.id);

    const dataFormatada = osRecord.data_agendamento
      ? new Date(osRecord.data_agendamento + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })
      : "a combinar";

    const replyText =
      `Perfeito, *${osRecord.cliente_nome || "Cliente"}*! ✅\n` +
      `Sua visita In-Home foi confirmada para *${dataFormatada}*${osRecord.periodo_agendamento ? ` (${osRecord.periodo_agendamento})` : ""}.\n` +
      `Nosso técnico entrará em contato antes de chegar. Obrigado!`;

    try {
      await fetch(`${instancia.api_url}/message/sendText/${instancia.instance_name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: instancia.api_key },
        body: JSON.stringify({ number: phoneForSend, text: replyText }),
      });
    } catch (err) {
      // ignored
    }

    return true;
  }

  if (normalized === "2") {
    await supabase
      .from("os")
      .update({ status_agendamento_gia: "recusado_pelo_cliente" })
      .eq("id", osRecord.id);

    const osNumero = osRecord.numero_os_interna || osRecord.numero_os_samsung || osRecord.id.slice(0, 8);

    await supabase.from("gia_mural_tarefas").insert({
      unidade_id: osRecord.unidade_id,
      os_id: osRecord.id,
      os_numero: osNumero,
      titulo: "Cliente pediu remarcação",
      descricao: `O cliente ${osRecord.cliente_nome || ""} da OS ${osNumero} recusou o agendamento e pediu para remarcar. Contato: ${osRecord.cliente_telefone || ""}`,
      gia_source: "CONNECT",
      prioridade: "alta",
      status: "pendente",
    });

    const replyText =
      `Entendido, *${osRecord.cliente_nome || "Cliente"}*!\n` +
      `Nossa equipe entrará em contato para reagendar sua visita. Pedimos desculpas pelo inconveniente.`;

    try {
      await fetch(`${instancia.api_url}/message/sendText/${instancia.instance_name}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: instancia.api_key },
        body: JSON.stringify({ number: phoneForSend, text: replyText }),
      });
    } catch (err) {
      // ignored
    }

    return true;
  }

  return false;
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
      // ignored
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

// ====== GIA ROUTE COMMAND HANDLING ======

function isGIARouteCommand(text: string): boolean {
  const lower = text.toLowerCase().trim();
  if (!lower.includes("gia") && !lower.includes("monta")) return false;
  return (lower.includes("monta") || lower.includes("montar")) && lower.includes("rota") && (lower.includes("tecnico") || lower.includes("técnico") || lower.includes("para"));
}

const ROUTE_CMD_PATTERNS = [
  /monta(?:r)?\s+(?:a\s+)?rota\s+(.+?)\s+(?:para|pro|pra)\s+(?:o\s+)?t[eé]cnico\s+(.+?)\s+(?:da|de)\s+(?:unidade\s+)?(.+?)\s+a\s+partir\s+(?:do\s+)?dia\s+(.+)/i,
  /monta(?:r)?\s+(?:a\s+)?rota\s+(.+?)\s+(?:para|pro|pra)\s+(?:o\s+)?t[eé]cnico\s+(.+?)\s+(?:da|de)\s+(?:unidade\s+)?(.+)/i,
];

function parseRouteCmdDate(input?: string): string {
  if (!input) {
    const tomorrow = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return tomorrow.toISOString().split("T")[0];
  }
  const clean = input.trim().replace(/^de\s+/i, "").replace(/^do\s+/i, "");
  const slashMatch = clean.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/);
  if (slashMatch) {
    const day = slashMatch[1].padStart(2, "0");
    const month = slashMatch[2].padStart(2, "0");
    const year = slashMatch[3]
      ? (slashMatch[3].length === 2 ? `20${slashMatch[3]}` : slashMatch[3])
      : new Date().getFullYear().toString();
    return `${year}-${month}-${day}`;
  }
  const dayOnly = clean.match(/^(\d{1,2})$/);
  if (dayOnly) {
    const now = new Date();
    const day = dayOnly[1].padStart(2, "0");
    const month = (now.getMonth() + 1).toString().padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}`;
  }
  return new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];
}

// ===== GIA Route: Evolution API helpers (uses system_secrets, same as gia-send-relatorio) =====
const ROUTE_GROUP_JID = "120363427351181397@g.us";
const GOOGLE_MAPS_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY") || "";

async function getEvolutionConfig(supabase: any): Promise<{ api_url: string; api_key: string; instance_name: string }> {
  const { data: secrets } = await supabase
    .from("system_secrets")
    .select("key, value")
    .in("key", ["EVOLUTION_API_URL", "EVOLUTION_API_KEY", "EVOLUTION_INSTANCE_NAME"]);
  const m: Record<string, string> = {};
  for (const s of secrets || []) m[s.key] = s.value;
  if (!m.EVOLUTION_API_URL || !m.EVOLUTION_API_KEY || !m.EVOLUTION_INSTANCE_NAME) {
    throw new Error("Evolution API config missing in system_secrets");
  }
  return { api_url: m.EVOLUTION_API_URL, api_key: m.EVOLUTION_API_KEY, instance_name: m.EVOLUTION_INSTANCE_NAME };
}

async function sendGroupMessage(supabase: any, _instanceName: string, _groupJid: string, text: string) {
  const cfg = await getEvolutionConfig(supabase);
  const resp = await fetch(`${cfg.api_url}/message/sendText/${cfg.instance_name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: cfg.api_key },
    body: JSON.stringify({ number: ROUTE_GROUP_JID, text }),
  });
  const body = await resp.text();
  console.log(`[GIA Route] sendText status=${resp.status}`);
  if (!resp.ok) throw new Error(`sendText failed: ${resp.status} - ${body}`);
}

async function sendGroupImageViaStorage(supabase: any, imageUrl: string, fallbackUrl: string, caption: string) {
  const cfg = await getEvolutionConfig(supabase);

  // Try downloading the primary image (Google Static Maps)
  console.log(`[GIA Route] Attempting Google Static Maps...`);
  let imgBuffer: Uint8Array | null = null;

  const imgResp = await fetch(imageUrl);
  if (imgResp.ok) {
    imgBuffer = new Uint8Array(await imgResp.arrayBuffer());
    if (imgBuffer.length < 1000) imgBuffer = null;
  }
  console.log(`[GIA Route] Google response: ${imgResp.status}, size: ${imgBuffer?.length || 0}`);

  // If Google failed, try Geoapify fallback
  if (!imgBuffer && fallbackUrl) {
    console.log(`[GIA Route] Google failed, trying Geoapify fallback...`);
    const fbResp = await fetch(fallbackUrl);
    if (fbResp.ok) {
      imgBuffer = new Uint8Array(await fbResp.arrayBuffer());
      if (imgBuffer.length < 1000) imgBuffer = null;
    }
    console.log(`[GIA Route] Geoapify response: ${fbResp.status}, size: ${imgBuffer?.length || 0}`);
  }

  if (!imgBuffer) {
    throw new Error("Could not download map image from any source");
  }

  // Convert to base64 and send
  const base64 = uint8ToBase64(imgBuffer);
  console.log(`[GIA Route] Sending image: ${base64.length} chars base64`);

  const resp = await fetch(`${cfg.api_url}/message/sendMedia/${cfg.instance_name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: cfg.api_key },
    body: JSON.stringify({ number: ROUTE_GROUP_JID, mediatype: "image", media: `data:image/png;base64,${base64}`, caption, fileName: "rota.png" }),
  });
  const body = await resp.text();
  console.log(`[GIA Route] sendMedia: status=${resp.status} body=${body.substring(0, 300)}`);
  if (!resp.ok) throw new Error(`sendMedia failed: ${resp.status} - ${body}`);
}

function uint8ToBase64(buffer: Uint8Array): string {
  let binary = "";
  const chunkSize = 8192;
  for (let i = 0; i < buffer.length; i += chunkSize) {
    const chunk = buffer.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, chunk as unknown as number[]);
  }
  return btoa(binary);
}

// Google Maps directions link (no API key needed, opens in browser)
function buildGoogleMapsLink(baseLat: number, baseLng: number, paradas: { lat: number; lng: number; ordem: number }[]): string {
  const waypoints = paradas.map(p => `${p.lat},${p.lng}`);
  const origin = `${baseLat},${baseLng}`;
  const destination = waypoints[waypoints.length - 1] || origin;
  const middle = waypoints.slice(0, -1).join("/");
  if (middle) {
    return `https://www.google.com/maps/dir/${origin}/${middle}/${destination}`;
  }
  return `https://www.google.com/maps/dir/${origin}/${destination}`;
}

// ===== Geocoding =====
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
  if (!GOOGLE_MAPS_KEY) return null;
  try {
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_KEY}&region=br&language=pt-BR`);
    const data = await res.json();
    if (data.status === "OK" && data.results?.[0]?.geometry?.location) {
      const loc = data.results[0].geometry.location;
      return { lat: loc.lat, lng: loc.lng };
    }
    console.log(`[GIA Route] Geocode failed for "${address}": ${data.status}`);
    return null;
  } catch (e) {
    console.error("[GIA Route] Geocode error:", e);
    return null;
  }
}

// ===== Google Directions API for real driving times =====
interface DrivingLeg { distanceKm: number; durationMin: number; }

async function getDrivingLeg(originLat: number, originLng: number, destLat: number, destLng: number): Promise<DrivingLeg> {
  if (!GOOGLE_MAPS_KEY) return { distanceKm: 0, durationMin: 0 };
  try {
    const url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originLat},${originLng}&destination=${destLat},${destLng}&key=${GOOGLE_MAPS_KEY}&region=br&language=pt-BR`;
    const res = await fetch(url);
    const data = await res.json();
    if (data.status === "OK" && data.routes?.[0]?.legs?.[0]) {
      const leg = data.routes[0].legs[0];
      return {
        distanceKm: Math.round(leg.distance.value / 100) / 10,
        durationMin: Math.round(leg.duration.value / 60),
      };
    }
  } catch (e) { console.error("[GIA Route] Directions error:", e); }
  // Fallback: haversine * 1.3 (road factor)
  const straight = haversineKm(originLat, originLng, destLat, destLng);
  return { distanceKm: Math.round(straight * 13) / 10, durationMin: Math.round(straight * 1.3 / 80 * 60) };
}

// ===== Route optimization (nearest neighbor with smart direction) =====
function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface OSWithCoords {
  os_id: string;
  numero_samsung: string | null;
  numero_interno: string;
  cliente_nome: string;
  cliente_telefone: string;
  cidade: string;
  endereco: string;
  tipo_reparo: string;
  tempo_estimado_min: number;
  lat: number;
  lng: number;
  created_at: string;
  distFromBase: number;
}

function optimizeRouteOrder(osItems: OSWithCoords[], baseLat: number, baseLng: number): OSWithCoords[] {
  if (osItems.length <= 1) return osItems;
  for (const os of osItems) os.distFromBase = haversineKm(baseLat, baseLng, os.lat, os.lng);
  const sorted = [...osItems].sort((a, b) => a.distFromBase - b.distFromBase);
  const mid = Math.ceil(sorted.length / 2);
  const closeHalf = sorted.slice(0, mid);
  const farHalf = sorted.slice(mid);
  const avgAgeClose = closeHalf.reduce((sum, os) => sum + new Date().getTime() - new Date(os.created_at).getTime(), 0) / closeHalf.length;
  const avgAgeFar = farHalf.length > 0
    ? farHalf.reduce((sum, os) => sum + new Date().getTime() - new Date(os.created_at).getTime(), 0) / farHalf.length : 0;
  const startFar = avgAgeFar > avgAgeClose;
  console.log(`[GIA Route] Direction: ${startFar ? "far first" : "close first"} (close=${Math.round(avgAgeClose / 86400000)}d, far=${Math.round(avgAgeFar / 86400000)}d)`);

  const result: OSWithCoords[] = [];
  const remaining = new Set(osItems.map((_, i) => i));
  let currentLat: number, currentLng: number;
  if (startFar) {
    let best = 0; for (const i of remaining) { if (osItems[i].distFromBase > osItems[best].distFromBase) best = i; }
    remaining.delete(best); result.push(osItems[best]); currentLat = osItems[best].lat; currentLng = osItems[best].lng;
  } else {
    let best = 0; for (const i of remaining) { if (osItems[i].distFromBase < osItems[best].distFromBase) best = i; }
    remaining.delete(best); result.push(osItems[best]); currentLat = osItems[best].lat; currentLng = osItems[best].lng;
  }
  while (remaining.size > 0) {
    let nearestIdx = -1, nearestDist = Infinity;
    for (const i of remaining) {
      const d = haversineKm(currentLat, currentLng, osItems[i].lat, osItems[i].lng);
      if (d < nearestDist) { nearestDist = d; nearestIdx = i; }
    }
    remaining.delete(nearestIdx); result.push(osItems[nearestIdx]);
    currentLat = osItems[nearestIdx].lat; currentLng = osItems[nearestIdx].lng;
  }
  return result;
}

// ===== Static Map URL =====
function buildStaticMapUrl(baseLat: number, baseLng: number, paradas: { lat: number; lng: number; ordem: number }[]): string {
  const markers: string[] = [];
  markers.push(`markers=color:green|label:B|${baseLat},${baseLng}`);
  for (const p of paradas) {
    markers.push(`markers=color:red|label:${p.ordem <= 9 ? String(p.ordem) : "X"}|${p.lat},${p.lng}`);
  }
  const pts = [`${baseLat},${baseLng}`, ...paradas.map(p => `${p.lat},${p.lng}`)];
  const path = `path=color:0x4285F4FF|weight:4|${pts.join("|")}`;
  return `https://maps.googleapis.com/maps/api/staticmap?size=640x480&scale=2&maptype=roadmap&${markers.join("&")}&${path}&key=${GOOGLE_MAPS_KEY}`;
}

// ===== Time formatting helpers =====
function fmtHM(totalMin: number): string {
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function fmtDuracao(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h === 0) return `${m}min`;
  return m > 0 ? `${h}h${m}min` : `${h}h`;
}

// ===== Itinerary builder (full GPS-style timeline) =====
interface ItineraryEvent {
  time: string;
  endTime?: string;
  icon: string;
  text: string;
}

interface ItineraryDay {
  dia: number;
  date: Date;
  events: ItineraryEvent[];
  kmTotal: number;
  tempoEstrada: number;
  osCount: number;
}

async function buildFullItinerary(
  paradas: (OSWithCoords & { dia: number; ordem: number })[],
  baseLat: number, baseLng: number, baseEndereco: string, baseCidade: string,
  horaInicio: number, horaFim: number, almocoMin: number, dataInicioDate: Date,
): Promise<{ days: ItineraryDay[]; totalKm: number; legs: DrivingLeg[] }> {

  // Build the full sequence of points: base -> parada1 -> parada2 -> ... -> base
  const allPoints: { lat: number; lng: number }[] = [
    { lat: baseLat, lng: baseLng },
    ...paradas.map(p => ({ lat: p.lat, lng: p.lng })),
    { lat: baseLat, lng: baseLng },
  ];

  // Get driving legs for each consecutive pair
  const legs: DrivingLeg[] = [];
  for (let i = 0; i < allPoints.length - 1; i++) {
    const leg = await getDrivingLeg(allPoints[i].lat, allPoints[i].lng, allPoints[i + 1].lat, allPoints[i + 1].lng);
    legs.push(leg);
    console.log(`[GIA Route] Leg ${i}: ${leg.distanceKm}km, ${leg.durationMin}min`);
  }

  const totalKm = Math.round(legs.reduce((s, l) => s + l.distanceKm, 0) * 10) / 10;

  // Build timeline day-by-day
  const days: ItineraryDay[] = [];
  let currentMin = horaInicio; // minutes from midnight
  let diaAtual = 1;
  let dayEvents: ItineraryEvent[] = [];
  let dayKm = 0;
  let dayEstrada = 0;
  let dayOS = 0;
  let hadLunch = false;
  const ALMOCO_HORA = 12 * 60; // 12:00 fixed lunch time

  function pushDay() {
    const dayDate = new Date(dataInicioDate);
    dayDate.setDate(dayDate.getDate() + diaAtual - 1);
    days.push({ dia: diaAtual, date: dayDate, events: dayEvents, kmTotal: Math.round(dayKm * 10) / 10, tempoEstrada: dayEstrada, osCount: dayOS });
    dayEvents = [];
    dayKm = 0;
    dayEstrada = 0;
    dayOS = 0;
    hadLunch = false;
    diaAtual++;
    currentMin = horaInicio;
  }

  function insertLunch() {
    if (hadLunch) return;
    hadLunch = true;
    const lunchStart = currentMin;
    dayEvents.push({ time: fmtHM(lunchStart), endTime: fmtHM(lunchStart + almocoMin), icon: "🍽️", text: `Almoço (${fmtDuracao(almocoMin)})` });
    currentMin += almocoMin;
  }

  // Adds a driving segment, splitting it at 12:00 for lunch if needed
  function addDriveWithLunch(durationMin: number, distanceKm: number, label: string) {
    if (durationMin <= 0 || distanceKm <= 2) return;

    const driveStart = currentMin;
    const driveEnd = driveStart + durationMin;

    // Check if drive crosses lunch time (12:00) and we haven't had lunch yet
    if (!hadLunch && driveStart < ALMOCO_HORA && driveEnd > ALMOCO_HORA) {
      // Split: drive until 12:00, then lunch, then continue
      const minBeforeLunch = ALMOCO_HORA - driveStart;
      const minAfterLunch = durationMin - minBeforeLunch;
      const kmPerMin = distanceKm / durationMin;
      const kmBefore = Math.round(kmPerMin * minBeforeLunch * 10) / 10;
      const kmAfter = Math.round(kmPerMin * minAfterLunch * 10) / 10;

      // First half of drive
      dayEvents.push({
        time: fmtHM(driveStart), endTime: fmtHM(ALMOCO_HORA), icon: "🚗",
        text: `${label} (${kmBefore}km, ${fmtDuracao(minBeforeLunch)})`,
      });
      currentMin = ALMOCO_HORA;
      dayKm += kmBefore;
      dayEstrada += minBeforeLunch;

      // Lunch at 12:00
      insertLunch();

      // Second half of drive
      const resumeAt = currentMin;
      dayEvents.push({
        time: fmtHM(resumeAt), endTime: fmtHM(resumeAt + minAfterLunch), icon: "🚗",
        text: `${label} — continuação (${kmAfter}km, ${fmtDuracao(minAfterLunch)})`,
      });
      currentMin = resumeAt + minAfterLunch;
      dayKm += kmAfter;
      dayEstrada += minAfterLunch;
    } else {
      // No split needed — check if lunch should come before
      if (!hadLunch && driveStart >= ALMOCO_HORA) insertLunch();

      const actualStart = currentMin;
      dayEvents.push({
        time: fmtHM(actualStart), endTime: fmtHM(actualStart + durationMin), icon: "🚗",
        text: `${label} (${distanceKm}km, ${fmtDuracao(durationMin)})`,
      });
      currentMin = actualStart + durationMin;
      dayKm += distanceKm;
      dayEstrada += durationMin;
    }
  }

  // Start: departure from base
  dayEvents.push({ time: fmtHM(currentMin), icon: "🏢", text: `Saída da Base\n    📍 ${baseEndereco}, ${baseCidade}` });

  for (let i = 0; i < paradas.length; i++) {
    const p = paradas[i];
    const legToStop = legs[i];

    // Check if this leg + service fits today
    const totalNeeded = legToStop.durationMin + p.tempo_estimado_min;
    if (currentMin + totalNeeded + (!hadLunch ? almocoMin : 0) > horaFim && dayOS > 0) {
      const lastCity = i > 0 ? paradas[i - 1].cidade : baseCidade;
      dayEvents.push({ time: fmtHM(currentMin), icon: "🏨", text: `Pernoite em ${lastCity}` });
      pushDay();
      dayEvents.push({ time: fmtHM(currentMin), icon: "🌅", text: `Início do dia em ${lastCity}` });
    }

    // Drive to stop (with lunch split if crossing 12:00)
    const origin = i === 0 ? baseCidade : paradas[i - 1].cidade;
    addDriveWithLunch(legToStop.durationMin, legToStop.distanceKm, `Deslocamento: ${origin} → ${p.cidade}`);

    // If we arrived after 12:00 and haven't had lunch, insert it now
    if (!hadLunch && currentMin >= ALMOCO_HORA) insertLunch();

    // Check-in
    const ref = p.numero_samsung || p.numero_interno;
    dayEvents.push({ time: fmtHM(currentMin), icon: "📋", text: `Check-in: OS ${ref}\n    👤 ${p.cliente_nome}\n    📍 ${p.endereco}, ${p.cidade}\n    🔧 ${p.tipo_reparo}` });

    // Service
    const serviceEnd = currentMin + p.tempo_estimado_min;
    dayEvents.push({ time: fmtHM(currentMin), endTime: fmtHM(serviceEnd), icon: "🔧", text: `Atendimento (${fmtDuracao(p.tempo_estimado_min)})` });
    currentMin = serviceEnd;

    // Check-out
    dayEvents.push({ time: fmtHM(currentMin), icon: "✅", text: `Check-out OS ${ref}` });
    dayOS++;
  }

  // Return leg (last stop -> base)
  const returnLeg = legs[legs.length - 1];

  if (returnLeg.distanceKm > 2) {
    const lastStopCity = paradas[paradas.length - 1].cidade;

    // Check if return fits today
    if (currentMin + returnLeg.durationMin + (!hadLunch ? almocoMin : 0) > horaFim + 60 && dayOS > 0) {
      dayEvents.push({ time: fmtHM(currentMin), icon: "🏨", text: `Pernoite em ${lastStopCity}` });
      pushDay();
      dayEvents.push({ time: fmtHM(currentMin), icon: "🌅", text: `Início do dia em ${lastStopCity}` });
    }

    addDriveWithLunch(returnLeg.durationMin, returnLeg.distanceKm, `Retorno: ${lastStopCity} → ${baseCidade}`);
  }

  // Final lunch check (if somehow never had it)
  if (!hadLunch && currentMin >= ALMOCO_HORA) insertLunch();

  dayEvents.push({ time: fmtHM(currentMin), icon: "🏁", text: `Chegada na Base - ${baseCidade}` });
  pushDay();

  return { days, totalKm, legs };
}

// ===== Main route handler =====
async function handleGIARouteCommand(supabase: any, text: string, groupJid: string, instanceName: string) {
  console.log(`[GIA Route] Processing command: "${text}"`);
  try {
    let rotaNome = "", tecnicoNome = "", unidadeNome = "", dataStr: string | undefined;
    for (const pattern of ROUTE_CMD_PATTERNS) {
      const match = text.match(pattern);
      if (match) { rotaNome = match[1].trim(); tecnicoNome = match[2].trim(); unidadeNome = match[3].trim(); dataStr = match[4]?.trim(); break; }
    }
    if (!rotaNome || !tecnicoNome || !unidadeNome) { console.log("[GIA Route] Could not parse:", text); return; }
    console.log(`[GIA Route] rota=${rotaNome}, tecnico=${tecnicoNome}, unidade=${unidadeNome}, data=${dataStr || "amanhã"}`);

    // Resolve unidade
    const { data: unidades } = await supabase.from("unidades").select("id, nome, endereco, cidade, estado, latitude, longitude").ilike("nome", `%${unidadeNome}%`);
    if (!unidades?.length) { await sendGroupMessage(supabase, instanceName, groupJid, `⚠️ Unidade "${unidadeNome}" não encontrada.`); return; }
    const unidade = unidades[0];
    const baseLat = parseFloat(unidade.latitude) || -12.2664;
    const baseLng = parseFloat(unidade.longitude) || -38.9663;
    const baseEndereco = unidade.endereco || "Endereço da base";
    const baseCidade = unidade.cidade || "Cidade";

    // Resolve tecnico
    const { data: tecnicos } = await supabase.from("usuarios").select("id, nome, horario_inicio_expediente, horario_fim_expediente, duracao_almoco_minutos").eq("unidade_id", unidade.id).eq("ativo", true).ilike("nome", `%${tecnicoNome}%`);
    if (!tecnicos?.length) { await sendGroupMessage(supabase, instanceName, groupJid, `⚠️ Técnico "${tecnicoNome}" não encontrado na unidade ${unidade.nome}.`); return; }
    const tecnico = tecnicos[0];

    // Resolve rota
    const { data: rotas } = await supabase.from("rotas").select("id, nome, coluna_kanban, cor").eq("unidade_id", unidade.id).eq("ativa", true).ilike("nome", `%${rotaNome}%`);
    if (!rotas?.length) { await sendGroupMessage(supabase, instanceName, groupJid, `⚠️ Rota "${rotaNome}" não encontrada na unidade ${unidade.nome}.`); return; }
    const rota = rotas[0];
    if (!rota.coluna_kanban) { await sendGroupMessage(supabase, instanceName, groupJid, `⚠️ Rota "${rota.nome}" não tem coluna kanban associada.`); return; }

    // Get OS
    const { data: osList } = await supabase.from("os").select("id, numero_os_interna, numero_os_samsung, cliente_nome, cliente_telefone, cliente_cidade, cliente_endereco, tipo_reparo, lat, lng, created_at").eq("unidade_id", unidade.id).eq("coluna_kanban", rota.coluna_kanban);
    if (!osList?.length) { await sendGroupMessage(supabase, instanceName, groupJid, `⚠️ Nenhuma OS encontrada na ${rota.nome} da unidade ${unidade.nome}.`); return; }

    // BLOCK: endereco
    const osSemEndereco = osList.filter((os: any) => !os.cliente_endereco?.trim() || !os.cliente_cidade?.trim());
    if (osSemEndereco.length > 0) {
      const lista = osSemEndereco.slice(0, 8).map((os: any) => `  - ${os.numero_os_samsung || os.numero_os_interna} (${os.cliente_nome}) - falta ${!os.cliente_endereco?.trim() ? "endereço" : "cidade"}`).join("\n");
      await sendGroupMessage(supabase, instanceName, groupJid, `⚠️ Não posso montar a rota. OS sem endereço/cidade:\n\n${lista}${osSemEndereco.length > 8 ? `\n  ... e mais ${osSemEndereco.length - 8}` : ""}\n\nPreencha e peça novamente.`);
      return;
    }

    // BLOCK: tipo_reparo
    const osSemTipo = osList.filter((os: any) => !os.tipo_reparo?.trim());
    if (osSemTipo.length > 0) {
      const lista = osSemTipo.slice(0, 8).map((os: any) => `  - ${os.numero_os_samsung || os.numero_os_interna} (${os.cliente_nome})`).join("\n");
      await sendGroupMessage(supabase, instanceName, groupJid, `⚠️ Não posso montar a rota. OS sem Tipo de Reparo:\n\n${lista}${osSemTipo.length > 8 ? `\n  ... e mais ${osSemTipo.length - 8}` : ""}\n\nPreencha o tipo de reparo e peça novamente.`);
      return;
    }

    // GEOCODE
    for (const os of osList) {
      if (os.lat && os.lng) continue;
      const coords = await geocodeAddress(`${os.cliente_endereco}, ${os.cliente_cidade}, Brasil`);
      if (coords) { os.lat = coords.lat; os.lng = coords.lng; await supabase.from("os").update({ lat: coords.lat, lng: coords.lng }).eq("id", os.id); }
    }
    const osWithCoords = osList.filter((os: any) => os.lat && os.lng);
    const osWithoutCoords = osList.filter((os: any) => !os.lat || !os.lng);
    if (!osWithCoords.length) { await sendGroupMessage(supabase, instanceName, groupJid, `⚠️ Não consegui localizar nenhuma OS no mapa.`); return; }

    // Repair times
    const { data: tempos } = await supabase.from("gia_tempos_reparo").select("tipo_reparo, tempo_minutos").eq("unidade_id", unidade.id).eq("ativo", true);
    const tempoMap = new Map((tempos || []).map((t: any) => [t.tipo_reparo.toLowerCase(), t.tempo_minutos]));

    const osItems: OSWithCoords[] = osWithCoords.map((os: any) => ({
      os_id: os.id, numero_samsung: os.numero_os_samsung, numero_interno: os.numero_os_interna || os.id.substring(0, 8),
      cliente_nome: os.cliente_nome, cliente_telefone: os.cliente_telefone, cidade: os.cliente_cidade, endereco: os.cliente_endereco,
      tipo_reparo: os.tipo_reparo, tempo_estimado_min: tempoMap.get(os.tipo_reparo.toLowerCase()) || 60,
      lat: parseFloat(os.lat), lng: parseFloat(os.lng), created_at: os.created_at, distFromBase: 0,
    }));

    // OPTIMIZE
    const optimized = optimizeRouteOrder(osItems, baseLat, baseLng);
    const paradas = optimized.map((os, idx) => ({ ...os, dia: 1, ordem: idx + 1 }));

    // Technician schedule
    const horaInicioStr = tecnico.horario_inicio_expediente || "08:00";
    const horaFimStr = tecnico.horario_fim_expediente || "18:00";
    const [hI, mI] = horaInicioStr.split(":").map(Number);
    const [hF, mF] = horaFimStr.split(":").map(Number);
    const horaInicioMin = hI * 60 + mI;
    const horaFimMin = hF * 60 + mF;
    const tempoAlmoco = tecnico.duracao_almoco_minutos || 60;
    const dataInicio = parseRouteCmdDate(dataStr);
    const dataInicioDate = new Date(dataInicio + "T12:00:00");

    // BUILD FULL ITINERARY with real driving times
    const { days, totalKm, legs } = await buildFullItinerary(
      paradas, baseLat, baseLng, baseEndereco, baseCidade,
      horaInicioMin, horaFimMin, tempoAlmoco, dataInicioDate,
    );

    const diasTotais = days.length;
    const totalTempo = paradas.reduce((sum, p) => sum + p.tempo_estimado_min, 0);
    const totalEstrada = legs.reduce((s, l) => s + l.durationMin, 0);

    // Assign dia to paradas for DB
    // Simple: re-assign based on itinerary days and OS count
    let paradaIdx = 0;
    for (const day of days) {
      for (let n = 0; n < day.osCount && paradaIdx < paradas.length; n++) {
        paradas[paradaIdx].dia = day.dia;
        paradaIdx++;
      }
    }
    for (let dia = 1; dia <= diasTotais; dia++) {
      let ordem = 1;
      for (const p of paradas) { if (p.dia === dia) p.ordem = ordem++; }
    }

    // Dates
    const dataFimDate = new Date(dataInicioDate);
    dataFimDate.setDate(dataFimDate.getDate() + diasTotais - 1);

    // Save plan
    const { data: planoData, error: planoError } = await supabase.from("gia_planos_rota").insert({
      unidade_id: unidade.id, rota_id: rota.id, tecnico_id: tecnico.id,
      nome_rota: rota.nome, nome_tecnico: tecnico.nome,
      data_inicio: dataInicio, data_fim: dataFimDate.toISOString().split("T")[0],
      status: "planejado", total_os: paradas.length, total_tempo_estimado_min: totalTempo,
    }).select("id").single();

    if (planoError || !planoData) {
      console.error("[GIA Route] Error saving plan:", planoError);
      await sendGroupMessage(supabase, instanceName, groupJid, `⚠️ Erro ao salvar o plano.`);
      return;
    }

    const paradasInsert = paradas.map((p) => {
      const dataPrevista = new Date(dataInicioDate);
      dataPrevista.setDate(dataPrevista.getDate() + p.dia - 1);
      return {
        plano_id: planoData.id, os_id: p.os_id, dia: p.dia,
        data_prevista: dataPrevista.toISOString().split("T")[0],
        ordem: p.ordem, tipo_reparo: p.tipo_reparo, tempo_estimado_min: p.tempo_estimado_min,
        status: "pendente", os_numero_samsung: p.numero_samsung, os_numero_interno: p.numero_interno,
        cliente_nome: p.cliente_nome, cliente_telefone: p.cliente_telefone,
        cidade: p.cidade, endereco: p.endereco, pecas_json: [],
      };
    });
    await supabase.from("gia_plano_paradas").insert(paradasInsert);

    // --- SEND MAP IMAGE ---
    const paradasCoords = paradas.map(p => ({ lat: p.lat, lng: p.lng, ordem: p.ordem }));
    const dataFormatada = dataInicioDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });

    // Caption includes the legend (shown below map in WhatsApp)
    let caption = `🗺️ *ROTEIRO: ${rota.nome}*\n👤 ${tecnico.nome}\n📅 ${dataFormatada} | ${paradas.length} OS | ${diasTotais} dia(s)\n📏 ${totalKm}km | 🚗 ${fmtDuracao(totalEstrada)} na estrada\n\n`;
    caption += `📍 *Legenda:*\n`;
    caption += `🟢 *B* = Base (${unidade.nome})\n`;
    for (const p of paradas) {
      const ref = p.numero_samsung || p.numero_interno;
      caption += `🔴 *${p.ordem}* = ${ref} — ${p.cliente_nome} (${p.cidade})\n`;
    }

    try {
      const mapLink = buildGoogleMapsLink(baseLat, baseLng, paradasCoords);
      let mapMsg = `🗺️ *MAPA DA ROTA: ${rota.nome}*\n`;
      mapMsg += `👤 ${tecnico.nome} | 📅 ${dataFormatada}\n\n`;
      mapMsg += `📍 *Legenda:*\n`;
      mapMsg += `🟢 *B* = Base (${unidade.nome})\n`;
      for (const p of paradas) {
        const ref = p.numero_samsung || p.numero_interno;
        mapMsg += `🔴 *${p.ordem}* = ${ref} — ${p.cliente_nome} (${p.cidade})\n`;
      }
      mapMsg += `\n🔗 *Abrir rota no Google Maps:*\n${mapLink}`;
      await sendGroupMessage(supabase, instanceName, groupJid, mapMsg);
    } catch (imgErr: any) {
      console.error("[GIA Route] Error sending map link:", imgErr?.message || imgErr);
    }

    // Small delay so image arrives first
    await new Promise(r => setTimeout(r, 2000));

    // --- BUILD ITINERARY MESSAGE (no legend here, it's in the image) ---
    let msg = `📋 *ROTEIRO DE VIAGEM — ${rota.nome}*\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
    msg += `👤 Técnico: *${tecnico.nome}*\n`;
    msg += `📅 Período: ${dataFormatada} a ${dataFimDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}\n`;
    msg += `📊 ${paradas.length} OS | ${diasTotais} dia(s) | ${totalKm}km total\n`;
    msg += `🚗 ${fmtDuracao(totalEstrada)} na estrada | 🔧 ${fmtDuracao(totalTempo)} em atendimentos\n`;
    msg += `━━━━━━━━━━━━━━━━━━━━━\n\n`;

    for (const day of days) {
      const dayDateStr = day.date.toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });
      msg += `━━━━━━━━━━━━━━━━━━━━━\n`;
      msg += `📅 *DIA ${day.dia} — ${dayDateStr}*\n`;
      msg += `📏 ${day.kmTotal}km | 🚗 ${fmtDuracao(day.tempoEstrada)} | 🔧 ${day.osCount} OS\n\n`;

      for (const ev of day.events) {
        if (ev.endTime) {
          msg += `${ev.icon} *${ev.time} — ${ev.endTime}*\n`;
        } else {
          msg += `${ev.icon} *${ev.time}*\n`;
        }
        msg += `    ${ev.text}\n\n`;
      }
    }

    if (osWithoutCoords.length > 0) {
      msg += `⚠️ ${osWithoutCoords.length} OS não geolocalizadas:\n`;
      for (const os of osWithoutCoords.slice(0, 5)) {
        msg += `  - ${os.numero_os_samsung || os.numero_os_interna} (${os.cliente_nome})\n`;
      }
      msg += "\n";
    }

    msg += `🔗 _Acompanhe no ATOM > Otimizador > GIA Rotas_`;

    await sendGroupMessage(supabase, instanceName, groupJid, msg);
  } catch (err) {
    console.error("[GIA Route] Error:", err);
    try { await sendGroupMessage(supabase, instanceName, groupJid, `⚠️ Erro ao processar comando de rota. Tente novamente.`); } catch {}
  }
}
