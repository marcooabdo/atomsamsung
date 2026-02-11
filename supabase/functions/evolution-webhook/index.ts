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
    console.log("Evolution Webhook received:", JSON.stringify(body).substring(0, 500));

    const event = body.event || body.type;
    const data = body.data || body;
    const instance = body.instance || body.instanceName || data?.instance;

    if (event === "messages.upsert") {
      const message = data.message || data;
      const key = message.key || {};
      const remoteJid = key.remoteJid || "";

      if (remoteJid.endsWith("@g.us")) {
        return new Response(JSON.stringify({ skip: "group message" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const phoneNumber = remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
      const fromMe = key.fromMe || false;
      const messageId = key.id || crypto.randomUUID();

      if (!phoneNumber) {
        return new Response(JSON.stringify({ skip: "no phone" }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const instanceName = typeof instance === 'string' ? instance : instance?.instanceName || '';

      const { data: instancia } = await supabase
        .from("atom_connect_instancias")
        .select("id, unidade_id")
        .eq("instance_name", instanceName)
        .maybeSingle();

      if (!instancia) {
        console.log("Instancia nao encontrada:", instanceName);
        return new Response(JSON.stringify({ error: "Instancia nao encontrada", instanceName }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let tipo = "text";
      let conteudo = "";
      let caption = null;
      let mediaUrl = null;
      let mediaMimetype = null;

      const msg = message.message || {};

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
      } else {
        conteudo = "[Mensagem]";
      }

      let { data: conversa } = await supabase
        .from("atom_connect_conversas")
        .select("id, coluna_pipeline, mensagens_nao_lidas")
        .eq("cliente_telefone", phoneNumber)
        .eq("unidade_id", instancia.unidade_id)
        .maybeSingle();

      if (!conversa) {
        const { data: firstColumn } = await supabase
          .from("atom_connect_pipeline_colunas")
          .select("id")
          .order("ordem", { ascending: true })
          .limit(1)
          .maybeSingle();

        const pipelineColumnId = firstColumn?.id || null;

        const pushName = message.pushName || data.pushName || phoneNumber;
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
            ultima_resposta_cliente_at: fromMe ? null : new Date().toISOString(),
            mensagens_nao_lidas: fromMe ? 0 : 1,
            tipo_atendimento: "whatsapp",
            prioridade: "normal",
          })
          .select()
          .single();

        if (insertError) {
          console.error("Erro ao criar conversa:", insertError);
          return new Response(JSON.stringify({ error: "Erro ao criar conversa", details: insertError }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
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

        await supabase
          .from("atom_connect_conversas")
          .update(updateData)
          .eq("id", conversa.id);
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

      console.log(`Mensagem processada: ${phoneNumber} -> ${conteudo.substring(0, 50)}`);
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
      const state = data.state || data.status;
      const instanceName = typeof instance === 'string' ? instance : instance?.instanceName || '';
      const isConnected = state === "open" || state === "connected";

      await supabase
        .from("atom_connect_instancias")
        .update({
          status: isConnected ? "connected" : "disconnected",
          qr_code: isConnected ? null : undefined,
        })
        .eq("instance_name", instanceName);
    }

    if (event === "qrcode.updated") {
      const base64 = data.qrcode?.base64 || data.base64;
      const instanceName = typeof instance === 'string' ? instance : instance?.instanceName || '';

      if (base64) {
        await supabase
          .from("atom_connect_instancias")
          .update({
            qr_code: base64,
            status: "connecting",
          })
          .eq("instance_name", instanceName);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro no webhook:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
