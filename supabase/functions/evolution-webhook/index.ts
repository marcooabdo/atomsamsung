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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  if (req.method === "GET") {
    return new Response(JSON.stringify({ status: "ok", service: "evolution-webhook", version: "3.0" }), {
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

    if (event.includes("messages.update") || event === "message.update") {
      console.log("Processing message STATUS UPDATE (not a new message)");
      const updates = Array.isArray(data) ? data : [data];

      for (const update of updates) {
        const messageId = update.key?.id || update.id;
        const status = update.update?.status || update.status;

        if (messageId && status !== undefined) {
          let newStatus = "sent";
          if (status === 2) newStatus = "sent";
          if (status === 3) newStatus = "delivered";
          if (status === 4) newStatus = "read";

          const { error } = await supabase
            .from("atom_connect_mensagens")
            .update({ status: newStatus })
            .eq("message_id", messageId);

          if (!error) {
            console.log("Updated message status:", messageId, "->", newStatus);
          }
        }
      }

      return new Response(JSON.stringify({ success: true, type: "status_update" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const isMessageEvent =
      event.includes("messages.upsert") ||
      (event.includes("message") && !event.includes("update")) ||
      body.message ||
      body.data?.message ||
      body.data?.key;

    if (isMessageEvent) {
      console.log("Processing as NEW MESSAGE event");

      const message = body.message || data.message || data;
      const key = body.key || message?.key || data?.key || {};
      const rawRemoteJid = key.remoteJid || body.remoteJid || data?.remoteJid || "";

      console.log("Raw RemoteJid:", rawRemoteJid);
      console.log("Key:", JSON.stringify(key));

      if (rawRemoteJid.endsWith("@g.us")) {
        console.log("Skipping group message");
        return new Response(JSON.stringify({ skip: "group_message" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (rawRemoteJid.endsWith("@lid") || rawRemoteJid.includes("@lid")) {
        console.log("Skipping lid format message (linked device internal)");
        return new Response(JSON.stringify({ skip: "lid_format" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (rawRemoteJid.includes("@broadcast")) {
        console.log("Skipping broadcast message");
        return new Response(JSON.stringify({ skip: "broadcast" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const phoneNumber = cleanPhoneNumber(rawRemoteJid);
      const fromMe = key.fromMe === true;
      const messageId = key.id || body.messageId || crypto.randomUUID();

      console.log("Cleaned phone:", phoneNumber, "| FromMe:", fromMe, "| MsgId:", messageId);

      if (!phoneNumber || phoneNumber.length < 8) {
        console.log("Invalid phone number, skipping:", phoneNumber);
        return new Response(JSON.stringify({ skip: "invalid_phone" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const msg = message?.message || body?.message?.message || data?.message || {};

      if (isProtocolMessage(msg)) {
        console.log("Skipping protocol message (status update, reaction, etc)");
        return new Response(JSON.stringify({ skip: "protocol_message" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (!hasActualContent(msg, body, data)) {
        console.log("No actual content found, skipping (probably status update or empty message)");
        return new Response(JSON.stringify({ skip: "no_content" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const messageStubType = message?.messageStubType || data?.messageStubType || body?.messageStubType;
      if (messageStubType) {
        console.log("Skipping stub message type:", messageStubType);
        return new Response(JSON.stringify({ skip: "stub_message", type: messageStubType }), {
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
          return await processMessage(supabase, message, data, body, phoneNumber, fromMe, messageId, allInstancias[0]);
        }

        if (allInstancias && allInstancias.length > 0) {
          console.log("Multiple instances available, using first as fallback");
          return await processMessage(supabase, message, data, body, phoneNumber, fromMe, messageId, allInstancias[0]);
        }

        return new Response(JSON.stringify({ error: "instance_not_found", instanceName }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      return await processMessage(supabase, message, data, body, phoneNumber, fromMe, messageId, instancia);
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

    if (event.includes("presence") || event.includes("composing") || event.includes("recording") || event.includes("paused")) {
      console.log("Processing presence event:", event);
      const remoteJid = data.remoteJid || data.id || body.remoteJid || "";
      const presenceState = data.presence || data.state || body.presence || event.split(".").pop() || "";

      if (remoteJid && !remoteJid.endsWith("@g.us")) {
        const phoneNumber = cleanPhoneNumber(remoteJid);
        console.log("Presence update for:", phoneNumber, "| State:", presenceState);

        const { data: conversa } = await supabase
          .from("atom_connect_conversas")
          .select("id, unidade_id")
          .eq("cliente_telefone", phoneNumber)
          .maybeSingle();

        if (conversa) {
          let typingStatus = null;
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
  instancia: { id: string; unidade_id: string }
) {
  console.log("=== PROCESSING MESSAGE ===");
  console.log("Phone:", phoneNumber, "| FromMe:", fromMe);
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
    conteudo = msg.audioMessage.ptt ? "[Audio]" : "[Audio]";
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
    console.log("Empty content after extraction, skipping message");
    return new Response(JSON.stringify({ skip: "empty_content" }), {
      status: 200,
      headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
    });
  }

  console.log("Content type:", tipo, "| Content:", conteudo.substring(0, 100));

  const { data: existingMsgEarly } = await supabase
    .from("atom_connect_mensagens")
    .select("id")
    .eq("message_id", messageId)
    .maybeSingle();

  if (existingMsgEarly) {
    console.log("Message already exists by ID:", messageId);
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
      console.log("No existing conversation and fromMe=true, skipping");
      return new Response(JSON.stringify({ success: true, skip: "no_conversation_for_sent" }), {
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
      return new Response(JSON.stringify({ error: "create_conversation_failed", details: insertError }), {
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

  console.log("Inserting message:", messageId, "| FromMe:", fromMe);
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

  if (!fromMe && tipo === "text" && conteudo) {
    await processRatingResponse(supabase, conversa.id, conteudo.trim(), instancia);
  }

  console.log(`=== MESSAGE PROCESSED: ${phoneNumber} -> ${conteudo.substring(0, 50)} ===`);
  return new Response(JSON.stringify({ success: true, conversa_id: conversa.id }), {
    status: 200,
    headers: { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json" },
  });
}

async function processRatingResponse(
  supabase: any,
  conversaId: string,
  messageContent: string,
  instancia: { id: string; unidade_id: string }
) {
  const { data: conversa } = await supabase
    .from("atom_connect_conversas")
    .select("id, cliente_telefone, aguardando_avaliacao, regra_finalizacao_id")
    .eq("id", conversaId)
    .maybeSingle();

  if (!conversa || !conversa.aguardando_avaliacao || !conversa.regra_finalizacao_id) {
    return;
  }

  console.log("=== PROCESSING RATING RESPONSE ===");
  console.log("Conversation waiting for rating:", conversa.id);

  const { data: regra } = await supabase
    .from("atom_connect_regras_finalizacao")
    .select("*")
    .eq("id", conversa.regra_finalizacao_id)
    .maybeSingle();

  if (!regra || !regra.opcoes) {
    console.log("No finalization rule found");
    return;
  }

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

  if (!matchedOption) {
    console.log("No matching option found for:", normalizedContent);
    return;
  }

  console.log("Matched option:", matchedOption.label, "| NPS:", matchedOption.nps_score);

  const { data: instanciaData } = await supabase
    .from("atom_connect_instancias")
    .select("api_url, api_key, instance_name")
    .eq("unidade_id", instancia.unidade_id)
    .eq("status", "connected")
    .limit(1)
    .maybeSingle();

  if (instanciaData && matchedOption.resposta) {
    try {
      const phoneForSend = conversa.cliente_telefone.replace(/\D/g, "");
      const response = await fetch(
        `${instanciaData.api_url}/message/sendText/${instanciaData.instance_name}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: instanciaData.api_key,
          },
          body: JSON.stringify({
            number: phoneForSend,
            text: matchedOption.resposta,
          }),
        }
      );

      if (response.ok) {
        console.log("Rating response message sent successfully");

        await supabase.from("atom_connect_mensagens").insert({
          conversa_id: conversa.id,
          from_me: true,
          tipo: "text",
          conteudo: matchedOption.resposta,
          status: "sent",
          is_bot: true,
          metadata: { tipo: "avaliacao_response", nps_score: matchedOption.nps_score },
        });
      }
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

  console.log("Conversation rating processed:", matchedOption.label, "| Action:", matchedOption.acao);
}
