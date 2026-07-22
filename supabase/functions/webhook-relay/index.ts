import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const TARGET_GROUP_JID = "120363427351181397@g.us";
const GIA_PHONE = "553491368788";

function normalizeEvent(rawEvent: string): string {
  return rawEvent.toLowerCase().replace(/_/g, ".").replace(/\s+/g, ".").trim();
}

function cleanPhoneNumber(remoteJid: string): string {
  let cleaned = remoteJid
    .replace("@s.whatsapp.net", "")
    .replace("@g.us", "");
  const colonIndex = cleaned.indexOf(":");
  if (colonIndex !== -1) cleaned = cleaned.substring(0, colonIndex);
  return cleaned.replace(/[^0-9]/g, "");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method === "GET") {
    return new Response(
      JSON.stringify({ status: "ok", service: "webhook-relay", version: "1.0" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
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

    const isMessageUpsert = event.includes("messages.upsert");

    if (!isMessageUpsert) {
      return new Response(
        JSON.stringify({ skip: "not_message_event", event }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const message = body.message || data.message || data;
    const key = body.key || message?.key || data?.key || {};
    const rawRemoteJid = key.remoteJid || body.remoteJid || data?.remoteJid || "";
    const messageId = key.id || body.messageId || "";

    if (!rawRemoteJid.endsWith("@g.us")) {
      return new Response(
        JSON.stringify({ skip: "not_group", jid: rawRemoteJid }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (rawRemoteJid !== TARGET_GROUP_JID) {
      return new Response(
        JSON.stringify({ skip: "wrong_group", jid: rawRemoteJid }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const fromMe = key.fromMe === true;
    const participant = key.participant || data?.participant || "";
    const senderPhone = participant ? cleanPhoneNumber(participant) : "";
    const senderName = message?.pushName || data?.pushName || body?.pushName || "";

    if (senderPhone === GIA_PHONE || fromMe) {
      return new Response(
        JSON.stringify({ skip: "from_gia_or_self", sender: senderPhone }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const msg = message?.message || body?.message?.message || data?.message || {};

    if (msg.protocolMessage || msg.reactionMessage || msg.pollUpdateMessage || msg.editedMessage) {
      return new Response(
        JSON.stringify({ skip: "protocol_message" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let tipo = "text";
    let conteudo = "";

    if (msg.conversation) {
      conteudo = msg.conversation;
    } else if (msg.extendedTextMessage) {
      conteudo = msg.extendedTextMessage.text || "";
    } else if (msg.imageMessage) {
      tipo = "image";
      conteudo = msg.imageMessage.caption || "[Imagem]";
    } else if (msg.audioMessage) {
      tipo = "audio";
      conteudo = "[Audio]";
    } else if (msg.videoMessage) {
      tipo = "video";
      conteudo = msg.videoMessage.caption || "[Video]";
    } else if (msg.documentMessage) {
      tipo = "document";
      conteudo = msg.documentMessage.fileName || "[Documento]";
    } else if (body.text || data.text) {
      conteudo = body.text || data.text;
    } else if (body.body) {
      conteudo = body.body;
    }

    if (!conteudo || conteudo.trim() === "") {
      return new Response(
        JSON.stringify({ skip: "empty_content" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (messageId) {
      const { data: existing } = await supabase
        .from("gia_group_messages")
        .select("id")
        .eq("message_id", messageId)
        .maybeSingle();

      if (existing) {
        return new Response(
          JSON.stringify({ skip: "duplicate", message_id: messageId }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    await supabase.from("gia_group_messages").insert({
      group_jid: TARGET_GROUP_JID,
      direction: "incoming",
      sender_phone: senderPhone,
      sender_name: senderName,
      content: conteudo,
      message_id: messageId || null,
      message_type: tipo,
      processed_by_ai: false,
    });

    return new Response(
      JSON.stringify({ success: true, group: TARGET_GROUP_JID, sender: senderName || senderPhone, type: tipo }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
