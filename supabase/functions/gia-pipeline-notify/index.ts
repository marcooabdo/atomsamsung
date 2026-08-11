import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { os_id, coluna_kanban, coluna_anterior } = await req.json();
    if (!os_id || !coluna_kanban) {
      return new Response(JSON.stringify({ error: "os_id and coluna_kanban required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (coluna_kanban === coluna_anterior) {
      return new Response(JSON.stringify({ skipped: true, reason: "same_column" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: os } = await supabase
      .from("os")
      .select("*, unidade:unidades!os_unidade_id_fkey(nome)")
      .eq("id", os_id)
      .maybeSingle();

    if (!os) {
      return new Response(JSON.stringify({ error: "OS not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: configs } = await supabase
      .from("gia_pipeline_mensagens")
      .select("*")
      .eq("coluna_kanban", coluna_kanban)
      .eq("ativo", true);

    if (!configs || configs.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_config" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const matchingConfigs = configs.filter((cfg: any) => {
      if (cfg.tipo_atendimento !== "todos" && cfg.tipo_atendimento !== os.tipo_atendimento) return false;
      if (cfg.tipo_os !== "todos" && cfg.tipo_os !== os.tipo_os) return false;
      if (cfg.unidade_ids && !cfg.unidade_ids.includes(os.unidade_id)) return false;
      return true;
    });

    if (matchingConfigs.length === 0) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_matching_config" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phone = os.cliente_telefone?.replace(/\D/g, "") || "";
    if (!phone) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_phone" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const phoneSuffix = phone.length >= 10 ? phone.slice(-10) : phone;

    const { data: conversa } = await supabase
      .from("atom_connect_conversas")
      .select("id, instancia:atom_connect_instancias(*)")
      .ilike("cliente_telefone", `%${phoneSuffix}`)
      .eq("unidade_id", os.unidade_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!conversa || !conversa.instancia) {
      return new Response(JSON.stringify({ skipped: true, reason: "no_conversa" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let sentCount = 0;

    for (const cfg of matchingConfigs) {
      if (cfg.frequencia_horas === 0) {
        const { data: alreadySent } = await supabase
          .from("gia_pipeline_mensagens_log")
          .select("id")
          .eq("mensagem_config_id", cfg.id)
          .eq("os_id", os_id)
          .eq("coluna_kanban", coluna_kanban)
          .limit(1)
          .maybeSingle();

        if (alreadySent) continue;
      } else {
        const cutoff = new Date(Date.now() - cfg.frequencia_horas * 60 * 60 * 1000).toISOString();
        const { data: recentSent } = await supabase
          .from("gia_pipeline_mensagens_log")
          .select("id")
          .eq("mensagem_config_id", cfg.id)
          .eq("os_id", os_id)
          .gte("created_at", cutoff)
          .limit(1)
          .maybeSingle();

        if (recentSent) continue;
      }

      const osNum = os.numero_os_samsung || os.numero_os_interna || "S/N";
      const message = renderTemplate(cfg.mensagem, {
        cliente_nome: os.cliente_nome || "Cliente",
        numero_os: String(osNum),
        modelo: os.aparelho_modelo || "aparelho",
        status: coluna_kanban,
        tipo_os: os.tipo_os || "",
        tipo_atendimento: os.tipo_atendimento || "",
        valor_total: (os.valor_total || 0).toFixed(2),
        defeito: os.defeito_relatado || "",
        unidade: os.unidade?.nome || "",
      });

      const inst = conversa.instancia;
      const phoneForSend = phone.startsWith("55") ? phone : `55${phone}`;

      try {
        const resp = await fetch(`${inst.api_url}/message/sendText/${inst.instance_name}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: inst.api_key },
          body: JSON.stringify({ number: phoneForSend, text: message }),
        });

        if (resp.ok) {
          sentCount++;

          await supabase.from("atom_connect_mensagens").insert({
            conversa_id: conversa.id,
            message_id: `pipeline_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
            from_me: true,
            tipo: "text",
            conteudo: message,
            status: "sent",
            is_bot: true,
          });

          await supabase
            .from("atom_connect_conversas")
            .update({
              ultima_mensagem: message.substring(0, 200),
              ultima_mensagem_at: new Date().toISOString(),
            })
            .eq("id", conversa.id);
        } else {
          console.error("[Pipeline Notify] sendText failed:", resp.status);
        }
      } catch (err) {
        console.error("[Pipeline Notify] sendText error:", err);
      }

      await supabase.from("gia_pipeline_mensagens_log").insert({
        mensagem_config_id: cfg.id,
        os_id,
        conversa_id: conversa.id,
        coluna_kanban,
        mensagem_enviada: message,
      });
    }

    return new Response(JSON.stringify({ success: true, sent: sentCount }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[Pipeline Notify] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function renderTemplate(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}
