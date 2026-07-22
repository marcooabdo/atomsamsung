import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RELATORIOS = [
  { tipo: "pulso_operacional", nome: "Pulso Operacional", horario: "08:00" },
  { tipo: "abertura_fechamento", nome: "Abertura e Fechamento", horario: "09:00" },
  { tipo: "mapa_rotas", nome: "Mapa de Rotas", horario: "08:30" },
  { tipo: "nucleo_pecas", nome: "Nucleo de Pecas", horario: "10:00" },
  { tipo: "estoque_dia", nome: "Estoque do Dia", horario: "08:00" },
  { tipo: "limite_credito_gspn", nome: "Limite de Credito GSPN", horario: "09:30" },
  { tipo: "compliance_erros", nome: "Compliance e Erros", horario: "11:00" },
  { tipo: "agendamentos_ih", nome: "Agendamentos IH", horario: "07:30" },
  { tipo: "resumo_final", nome: "Resumo Final", horario: "18:00" },
];

const DEFAULT_GROUP_JID = "120363427351181397@g.us";
const DEFAULT_INSTANCE = "Marco";
const EVOLUTION_API_URL = "https://diego-auditoria.2vhnbz.easypanel.host";
const EVOLUTION_API_KEY = "diego";

async function sendWhatsAppGroup(groupJid: string, text: string, instanceName: string) {
  const resp = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: EVOLUTION_API_KEY,
    },
    body: JSON.stringify({
      number: groupJid,
      text,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Evolution API error (${resp.status}): ${err}`);
  }

  return await resp.json();
}

async function gerarRelatorio(supabaseUrl: string, supabaseServiceKey: string, tipo: string, unidadeId?: string) {
  const resp = await fetch(`${supabaseUrl}/functions/v1/gia-relatorio`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({ tipo, unidade_id: unidadeId || null }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Erro ao gerar relatorio ${tipo}: ${err}`);
  }

  return await resp.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const body = await req.json().catch(() => ({}));
    const {
      tipo,
      todos = false,
      group_jid = DEFAULT_GROUP_JID,
      instance_name = DEFAULT_INSTANCE,
      unidade_id,
    } = body;

    const resultados: any[] = [];

    if (todos) {
      for (const rel of RELATORIOS) {
        try {
          const data = await gerarRelatorio(supabaseUrl, supabaseServiceKey, rel.tipo, unidade_id);
          const texto = data.resumo_texto || JSON.stringify(data, null, 2);
          await sendWhatsAppGroup(group_jid, texto, instance_name);
          resultados.push({ tipo: rel.tipo, nome: rel.nome, sucesso: true });
          await new Promise((r) => setTimeout(r, 2000));
        } catch (err: any) {
          resultados.push({ tipo: rel.tipo, nome: rel.nome, sucesso: false, erro: err.message });
        }
      }
    } else if (tipo) {
      const relInfo = RELATORIOS.find((r) => r.tipo === tipo);
      if (!relInfo) {
        return new Response(
          JSON.stringify({
            error: `Tipo desconhecido: ${tipo}`,
            disponiveis: RELATORIOS.map((r) => ({ tipo: r.tipo, nome: r.nome })),
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = await gerarRelatorio(supabaseUrl, supabaseServiceKey, tipo, unidade_id);
      const texto = data.resumo_texto || JSON.stringify(data, null, 2);
      await sendWhatsAppGroup(group_jid, texto, instance_name);
      resultados.push({ tipo: relInfo.tipo, nome: relInfo.nome, sucesso: true });
    } else {
      return new Response(
        JSON.stringify({
          error: "Envie { \"todos\": true } para enviar todos ou { \"tipo\": \"pulso_operacional\" } para um especifico.",
          relatorios_disponiveis: RELATORIOS,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        enviados: resultados.filter((r) => r.sucesso).length,
        falhas: resultados.filter((r) => !r.sucesso).length,
        detalhes: resultados,
        grupo: group_jid,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
