import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const COLUNA_LABELS: Record<string, string> = {
  os_nova: "OS Nova",
  diagnostico: "Diagnóstico/Triagem",
  negociacao_em_andamento: "Enviar Orçamento",
  aguardando_aprovacao: "Aguardando Aprovação",
  orcamento_aprovado: "Orçamento Aprovado",
  aguardando_peca: "Aguardando Peça",
  peca_em_transito: "Peça em Trânsito",
  em_reparo_ci: "Em Reparo CI",
  rota_preta: "Rota Preta",
  rota_vermelha: "Rota Vermelha",
  rota_azul: "Rota Azul",
  rota_verde: "Rota Verde",
  rota_rosa: "Rota Rosa",
  rota_amarela: "Rota Amarela",
  rota_laranja: "Rota Laranja",
  em_rota_ih: "Agendados (FTF)",
  em_reparo_ih: "Reparo em Progresso IH",
  instalacao_inicial: "Instalação Inicial",
  service_handling: "Service Handling",
  return_handling: "Return Handling",
  trade_up: "Trade-up",
  saw: "SAW",
  controle_qualidade: "Controle de Qualidade",
  qa_bt: "QA/BT",
  reparo_concluido: "Reparo Concluído",
  aguardando_fechamento: "Aguardando Fechamento",
  orcamentos_rejeitados: "Orçamentos Rejeitados",
  os_fechada: "OS Fechada",
};

function getColunaLabel(coluna: string): string {
  return COLUNA_LABELS[coluna] || coluna.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

const COLUNAS_EXCLUIDAS = [
  "return_handling",
  "instalacao_inicial",
  "trade_up",
  "service_handling",
  "os_fechada",
  "aguardando_peca",
  "peca_em_transito",
];

const DEFAULT_GROUP = "120363427351181397@g.us";

async function getGIAEvolutionConfig(supabase: ReturnType<typeof createClient>): Promise<{ api_url: string; api_key: string; instance_name: string }> {
  const { data: secrets } = await supabase
    .from("system_secrets")
    .select("key, value")
    .in("key", ["EVOLUTION_API_URL", "EVOLUTION_API_KEY", "EVOLUTION_INSTANCE_NAME"]);

  const secretMap: Record<string, string> = {};
  for (const s of secrets || []) {
    secretMap[s.key] = s.value;
  }

  const api_url = secretMap["EVOLUTION_API_URL"];
  const api_key = secretMap["EVOLUTION_API_KEY"];
  const instance_name = secretMap["EVOLUTION_INSTANCE_NAME"];

  if (!api_url || !api_key || !instance_name) {
    throw new Error("Configuração Evolution API incompleta em system_secrets");
  }

  return { api_url, api_key, instance_name };
}

async function sendWhatsAppGroup(config: { api_url: string; api_key: string; instance_name: string }, groupJid: string, message: string) {
  const response = await fetch(`${config.api_url}/message/sendText/${config.instance_name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": config.api_key,
    },
    body: JSON.stringify({
      number: groupJid,
      text: message,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Evolution API error: ${response.status} - ${errText}`);
  }

  return await response.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const now = new Date();

    // Only send alerts between 08:00 and 19:00 BRT (Mon-Fri)
    const brHour = parseInt(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "2-digit", hour12: false }));
    const brDay = parseInt(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo", weekday: "narrow" }).length > 0
      ? new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" })).getDay().toString()
      : "0");
    if (brHour < 8 || brHour >= 19 || brDay === 0 || brDay === 6) {
      return new Response(
        JSON.stringify({ success: true, alertas_enviados: 0, message: "Fora do horário de alertas (08-19h BRT, seg-sex)" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString();

    // Fetch unidades for sigla mapping
    const { data: unidades } = await supabase.from("unidades").select("id, nome");
    const unidadeSigla: Record<string, string> = {};
    if (unidades) {
      for (const u of unidades) {
        const nome = (u.nome || "").toLowerCase();
        if (nome.includes("montes claros")) unidadeSigla[u.id] = "MOC";
        else if (nome.includes("juiz de fora")) unidadeSigla[u.id] = "JDF";
        else if (nome.includes("feira")) unidadeSigla[u.id] = "FSA";
        else unidadeSigla[u.id] = u.nome?.slice(0, 3)?.toUpperCase() || "???";
      }
    }

    // Fetch OS that have been in their column for >2 hours
    let allOS: any[] = [];
    let from = 0;
    const pageSize = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("os")
        .select("id, numero_os_samsung, numero_os_interna, coluna_kanban, coluna_kanban_desde, unidade_id")
        .lt("coluna_kanban_desde", twoHoursAgo)
        .not("coluna_kanban", "is", null)
        .or("arquivada.is.null,arquivada.eq.false")
        .range(from, from + pageSize - 1);
      if (error) throw new Error(`Erro ao buscar OS: ${error.message}`);
      if (!data || data.length === 0) break;
      allOS = allOS.concat(data);
      if (data.length < pageSize) break;
      from += pageSize;
    }

    // Filter out excluded columns
    const eligible = allOS.filter((os) => !COLUNAS_EXCLUIDAS.includes(os.coluna_kanban));

    if (eligible.length === 0) {
      return new Response(
        JSON.stringify({ success: true, alertas_enviados: 0, message: "Nenhuma OS elegível para alerta" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check which OS have already been alerted in their current column
    const osIds = eligible.map((os) => os.id);
    const alertasExistentes = new Set<string>();

    for (let i = 0; i < osIds.length; i += 200) {
      const batch = osIds.slice(i, i + 200);
      const { data: alertas } = await supabase
        .from("gia_alertas_2h_enviados")
        .select("os_id, coluna_kanban")
        .in("os_id", batch);
      if (alertas) {
        for (const a of alertas) {
          alertasExistentes.add(`${a.os_id}::${a.coluna_kanban}`);
        }
      }
    }

    // Filter to only those not yet alerted in their current column
    const novasParaAlertar = eligible.filter(
      (os) => !alertasExistentes.has(`${os.id}::${os.coluna_kanban}`)
    );

    if (novasParaAlertar.length === 0) {
      return new Response(
        JSON.stringify({ success: true, alertas_enviados: 0, message: "Todas as OS elegíveis já foram alertadas" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get Evolution API config
    const evolutionConfig = await getGIAEvolutionConfig(supabase);

    // Get grupo_destino from gia_relatorios_config (use relatorio_2h config or default)
    const { data: reportConfig } = await supabase
      .from("gia_relatorios_config")
      .select("grupo_destino")
      .eq("tipo", "relatorio_2h")
      .maybeSingle();
    const targetGroup = reportConfig?.grupo_destino || DEFAULT_GROUP;

    let alertasEnviados = 0;
    const erros: string[] = [];

    // Send individual alerts (batch max 15 per invocation to avoid timeout)
    const maxAlertas = Math.min(novasParaAlertar.length, 15);

    for (let i = 0; i < maxAlertas; i++) {
      const os = novasParaAlertar[i];
      const osNum = os.numero_os_samsung || os.numero_os_interna || os.id.slice(0, 8);
      const sigla = unidadeSigla[os.unidade_id] || "???";
      const etapa = getColunaLabel(os.coluna_kanban);

      const message = `⚠️ *OS ${osNum}*, da unidade *${sigla}* na etapa *${etapa}* com 2 horas. Favor atuar agora.`;

      try {
        await sendWhatsAppGroup(evolutionConfig, targetGroup, message);

        // Mark as alerted (upsert to avoid conflicts)
        await supabase
          .from("gia_alertas_2h_enviados")
          .upsert(
            { os_id: os.id, coluna_kanban: os.coluna_kanban, alertado_em: new Date().toISOString() },
            { onConflict: "os_id,coluna_kanban" }
          );

        alertasEnviados++;

        // Small delay between messages to avoid rate limiting
        if (i < maxAlertas - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1500));
        }
      } catch (err: any) {
        erros.push(`OS ${osNum}: ${err.message}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        alertas_enviados: alertasEnviados,
        total_pendentes: novasParaAlertar.length,
        erros: erros.length > 0 ? erros : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
