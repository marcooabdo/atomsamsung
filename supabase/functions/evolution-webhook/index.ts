import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    console.log("Evolution Webhook received:", JSON.stringify(body, null, 2));

    const { event, data, instance } = body;

    if (event === "messages.upsert") {
      const message = data.message;
      const remoteJid = message.key.remoteJid;
      const phoneNumber = remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
      const fromMe = message.key.fromMe;
      const messageId = message.key.id;

      const { data: instancia } = await supabase
        .from("atom_connect_instancias")
        .select("id, unidade_id")
        .eq("instance_name", instance)
        .maybeSingle();

      if (!instancia) {
        console.log("Instancia nao encontrada:", instance);
        return new Response(JSON.stringify({ error: "Instancia nao encontrada" }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let { data: conversa } = await supabase
        .from("atom_connect_conversas")
        .select("id")
        .eq("cliente_telefone", phoneNumber)
        .eq("unidade_id", instancia.unidade_id)
        .maybeSingle();

      if (!conversa) {
        const pushName = message.pushName || phoneNumber;
        const { data: newConversa, error: insertError } = await supabase
          .from("atom_connect_conversas")
          .insert({
            unidade_id: instancia.unidade_id,
            instancia_id: instancia.id,
            cliente_telefone: phoneNumber,
            cliente_nome: pushName,
            coluna_pipeline: "bot_triagem",
            is_bot_ativo: true,
          })
          .select()
          .single();

        if (insertError) {
          console.error("Erro ao criar conversa:", insertError);
          return new Response(JSON.stringify({ error: "Erro ao criar conversa" }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        conversa = newConversa;
      }

      let tipo = "text";
      let conteudo = "";
      let caption = null;
      let mediaUrl = null;
      let mediaMimetype = null;

      if (message.message?.conversation) {
        tipo = "text";
        conteudo = message.message.conversation;
      } else if (message.message?.extendedTextMessage) {
        tipo = "text";
        conteudo = message.message.extendedTextMessage.text;
      } else if (message.message?.imageMessage) {
        tipo = "image";
        caption = message.message.imageMessage.caption;
        mediaMimetype = message.message.imageMessage.mimetype;
        mediaUrl = message.message.imageMessage.url;
      } else if (message.message?.audioMessage) {
        tipo = "audio";
        mediaMimetype = message.message.audioMessage.mimetype;
        mediaUrl = message.message.audioMessage.url;
      } else if (message.message?.videoMessage) {
        tipo = "video";
        caption = message.message.videoMessage.caption;
        mediaMimetype = message.message.videoMessage.mimetype;
        mediaUrl = message.message.videoMessage.url;
      } else if (message.message?.documentMessage) {
        tipo = "document";
        caption = message.message.documentMessage.fileName;
        mediaMimetype = message.message.documentMessage.mimetype;
        mediaUrl = message.message.documentMessage.url;
      } else if (message.message?.stickerMessage) {
        tipo = "sticker";
        mediaMimetype = message.message.stickerMessage.mimetype;
        mediaUrl = message.message.stickerMessage.url;
      } else if (message.message?.locationMessage) {
        tipo = "location";
        const lat = message.message.locationMessage.degreesLatitude;
        const lng = message.message.locationMessage.degreesLongitude;
        conteudo = `${lat},${lng}`;
      } else if (message.message?.contactMessage) {
        tipo = "contact";
        conteudo = message.message.contactMessage.displayName;
      }

      const { data: existingMsg } = await supabase
        .from("atom_connect_mensagens")
        .select("id")
        .eq("message_id", messageId)
        .maybeSingle();

      if (!existingMsg) {
        await supabase.from("atom_connect_mensagens").insert({
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
      }
    }

    if (event === "messages.update") {
      const updates = Array.isArray(data) ? data : [data];

      for (const update of updates) {
        const messageId = update.key?.id;
        const status = update.update?.status;

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
    }

    if (event === "connection.update") {
      const state = data.state;
      const newStatus = state === "open" ? "connected" : "disconnected";

      await supabase
        .from("atom_connect_instancias")
        .update({
          status: newStatus,
          qr_code: state === "open" ? null : undefined,
        })
        .eq("instance_name", instance);
    }

    if (event === "qrcode.updated") {
      const base64 = data.qrcode?.base64;

      if (base64) {
        await supabase
          .from("atom_connect_instancias")
          .update({
            qr_code: base64,
            status: "connecting",
          })
          .eq("instance_name", instance);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro no webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
