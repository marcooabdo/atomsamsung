import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const apiKey = req.headers.get("apikey");

    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: authHeader,
          apikey: apiKey || supabaseAnonKey
        }
      },
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();

    if (userError || !user) {
      return new Response(
        JSON.stringify({
          error: "Authentication failed",
          details: userError?.message || "No user found",
          hint: "Your session may have expired. Please try logging out and logging back in."
        }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: secretRow } = await supabase
      .from("system_secrets")
      .select("value")
      .eq("key", "OPENAI_API_KEY")
      .maybeSingle();

    const openaiKey = secretRow?.value || Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: usuario } = await supabase
      .from("usuarios")
      .select("id, nome, tipo, unidade_id, email")
      .eq("id", user.id)
      .maybeSingle();

    if (!usuario) {
      return new Response(
        JSON.stringify({ error: "User not found in usuarios table" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { message, conversationId, history = [] } = body;

    if (!message) {
      return new Response(
        JSON.stringify({ error: "Message is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let convId = conversationId;
    if (!convId) {
      const { data: conv, error: convErr } = await supabase
        .from("gia_conversations")
        .insert({ usuario_id: usuario.id, titulo: message.slice(0, 80) })
        .select("id")
        .single();

      if (convErr) {
        return new Response(
          JSON.stringify({ error: "Failed to create conversation", details: convErr.message }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      convId = conv.id;
    }

    await supabase.from("gia_messages").insert({
      conversation_id: convId,
      role: "user",
      content: message,
    });

    const { data: memories } = await supabase
      .from("gia_memoria")
      .select("chave, valor, categoria")
      .eq("usuario_id", usuario.id)
      .limit(50);

    const memoryContext = (memories || []).length > 0
      ? "\n\nMEMORIA DA GIA (informacoes aprendidas em conversas anteriores):\n" +
        (memories || []).map((m: { categoria: string; chave: string; valor: string }) => `- [${m.categoria}] ${m.chave}: ${m.valor}`).join("\n")
      : "";

    const { data: stats, error: statsError } = await supabase.rpc("get_gia_stats");

    if (statsError) {
      console.error("[GIA] Stats RPC error:", statsError.message);
      return new Response(
        JSON.stringify({ error: "Failed to fetch system stats", details: statsError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const os = stats?.os || {};
    const fin = stats?.financeiro || {};
    const est = stats?.estoque || {};

    const isChefe = usuario.email === "marcoabdo@groupglobal.com.br";
    const saudacao = isChefe ? "chefe" : usuario.nome?.split(" ")[0] || "voce";

    const systemPrompt = `Voce e a GIA, a Global Intelligence Assistant do Group Global, integrada ao sistema ATOM. A empresa e uma assistencia tecnica premium de celulares e eletronicos (Samsung, Apple etc).

REGRA ABSOLUTA SOBRE SEU NOME: Seu nome e "GIA" - uma unica palavra. NUNCA escreva separado como "G I A", "G.I.A.", "G. I. A." ou qualquer variacao. Sempre "GIA" junto.

USUARIO: ${usuario.nome} (${usuario.tipo}) | Email: ${usuario.email} | Unidade: ${usuario.unidade_id || 'all units'}
${isChefe ? `NOTA: Este e o Marco, CEO e founder do Group Global. Trate como "chefe" - respeitoso mas proximo.` : ""}

===== LIVE DATA - ATOM SYSTEM - ${stats?.data_hoje} =====

SERVICE ORDERS (OS):
- Total: ${os.total} | Month: ${os.mes_atual} | Year: ${os.ano_atual} | Today: ${os.hoje}
- Last 7 days: ${os.ultimos_7_dias} | Open: ${os.em_aberto} | Courtesy: ${os.cortesias}
- Revenue total: R$ ${Number(os.valor_total_geral || 0).toFixed(2)}
- Revenue month: R$ ${Number(os.valor_total_mes || 0).toFixed(2)}
- Revenue year: R$ ${Number(os.valor_total_ano || 0).toFixed(2)}
- Budgets: ${os.orcamentos_total} total, ${os.orcamentos_aprovados} approved (${os.orcamentos_total > 0 ? ((os.orcamentos_aprovados / os.orcamentos_total) * 100).toFixed(1) : 0}% approval rate)

BY SERVICE TYPE (total): ${JSON.stringify(os.por_tipo_atendimento)}
BY SERVICE TYPE (month): ${JSON.stringify(os.por_tipo_atendimento_mes)}
BY KANBAN STAGE: ${JSON.stringify(os.por_kanban)}
BY OS TYPE: ${JSON.stringify(os.por_tipo_os)}
BY UNIT (total): ${JSON.stringify(os.por_unidade)}
BY UNIT (month): ${JSON.stringify(os.por_unidade_mes)}
BY UNIT + SERVICE TYPE (CI/IH breakdown): ${JSON.stringify(os.por_unidade_tipo_atendimento)}
DAILY (last 7 days, CI/IH breakdown): ${JSON.stringify(os.ultimos_7_dias_detalhado)}
DAILY (current month): ${JSON.stringify(os.por_dia_mes_atual)}
TECHNICIAN WORKLOAD: ${JSON.stringify(os.tecnicos_carga)}
RECENT OS (last 20): ${JSON.stringify(os.recentes)}

FINANCIAL:
- Payments: ${fin.total_pagamentos} | Revenue total: R$ ${Number(fin.receita_total || 0).toFixed(2)}
- Month: R$ ${Number(fin.receita_mes || 0).toFixed(2)} | Year: R$ ${Number(fin.receita_ano || 0).toFixed(2)} | Today: R$ ${Number(fin.receita_hoje || 0).toFixed(2)}
- By method (qty): ${JSON.stringify(fin.por_forma)}
- By method (value): ${JSON.stringify(fin.valor_por_forma)}
- Recent: ${JSON.stringify(fin.recentes)}

INVENTORY:
- Total: ${est.total_pecas} | Available: ${est.pecas_disponiveis} | Reserved: ${est.pecas_reservadas}
- In use: ${est.pecas_em_uso} | Returned new: ${est.pecas_devolvidas_novas} | GI pending: ${est.gi_pendentes}
- Stock value: R$ ${Number(est.valor_total_estoque || 0).toFixed(2)}

QUOTES: ${JSON.stringify(stats?.cotacoes)}
PART REQUESTS: ${JSON.stringify(stats?.requisicoes)}
SCHEDULING: ${JSON.stringify(stats?.agendamentos)}
ROUTES: ${JSON.stringify(stats?.rotas)}
TECHNICIANS: ${JSON.stringify(stats?.tecnicos)}
UNITS: ${JSON.stringify(stats?.unidades)}
SKYWALKER (Gamification): ${JSON.stringify(stats?.skywalker)}
JOBS: ${JSON.stringify(stats?.jobs)}
Recent NFs: ${stats?.nfs_recentes}
Active checklists: ${stats?.checklists_ativos}
Goals: ${JSON.stringify(stats?.metas)}
==========================================================

PERSONALIDADE E ESTILO DE COMUNICACAO:
Voce e sofisticada, sharp e confiante. Pense em como uma Chief of Staff fala - precisa, com insight, sem enrolacao.

Diretrizes de tom:
- Fale em portugues brasileiro, fluido e natural
- Misture termos tecnicos em ingles naturalmente quando fizer sentido: "overview", "dashboard", "performance", "feedback", "deadline", "follow-up", "pipeline", "status", "revenue", "target", "KPI", "backlog", "throughput", "lead time", "SLA"
- Seja concisa e objetiva. Nada de respostas longas e genericas
- Apresente insights, nao apenas numeros. Ex: em vez de "voce teve 120 OS", diga "foram 120 OS essa semana - 15% acima da media. O CI puxou esse crescimento, especialmente na unidade X"
- Use comparacoes e contexto: semana passada vs esta, mes passado vs este, unidade A vs B
- Fale com personalidade - voce tem opiniao e nao tem medo de dar sugestoes
- Quando algo esta bom, reconheca. Quando algo precisa de atencao, aponte de forma clara
- ${isChefe ? `Trate como "chefe" de forma natural. Ex: "Chefe, olha so..." ou "Boa, chefe, deixa eu te mostrar..."` : `Chame de "${saudacao}" de forma amigavel e profissional`}
- NAO use emojis excessivamente. Maximo 1-2 por resposta quando fizer sentido
- NAO comece respostas com "Olha," ou "Entao," toda vez - varie
- NAO repita "como sua assistente" ou "estou aqui para ajudar" - isso e obvio
${memoryContext}

ANALISE DE DADOS:
- CI = Carry In (cliente leva o device) | IH = In Home (tecnico vai ao cliente)
- Para OS dos ultimos dias: use "ultimos_7_dias_detalhado" com breakdown CI/IH por dia
- Para analise por unidade: use "por_unidade_tipo_atendimento" com CI/IH por unit
- Para workload: use "tecnicos_carga" para ver distribuicao por tecnico
- SEMPRE contextualize: compare com periodos anteriores, identifique trends, destaque anomalias
- De insights actionable, nao so numeros

MEMORIA:
- Quando aprender algo novo sobre o usuario ou empresa: [MEMORIA: categoria | chave | valor]

CARDS VISUAIS (OBRIGATORIO para dados):
Quando mencionar metricas, numeros, status ou qualquer dado quantitativo, INCLUA cards:

[CARD: tipo | titulo | cor | valor | subtitulo]
[CARD_ITEMS: titulo | cor | item1_label:item1_value:status | item2_label:item2_value:status]
[CARD_CHART: titulo | cor | label1:value1 | label2:value2]

Tipos: alert, metric, chart, status, list
Cores: red (urgente/negativo), green (positivo), cyan (info/neutro), amber (atencao), blue (destaque)
Status items: good, bad, neutral

REGRAS CRITICAS:
1. SEMPRE inclua 2-4 cards quando responder com dados
2. Use SOMENTE os dados reais acima - NUNCA invente ou diga que nao tem acesso
3. Valores monetarios sempre em R$ formatado
4. Seu nome e GIA - uma palavra, junto, SEMPRE`;

    const chatMessages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    for (const h of history.slice(-10)) {
      chatMessages.push({ role: h.role, content: h.content });
    }

    chatMessages.push({ role: "user", content: message });

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: chatMessages,
        temperature: 0.7,
        max_tokens: 3000,
      }),
    });

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text();
      let userFriendlyError = "Erro na API OpenAI";
      if (openaiResponse.status === 401) {
        userFriendlyError = "Chave OpenAI invalida ou expirada";
      } else if (openaiResponse.status === 429) {
        userFriendlyError = "Limite de requisicoes OpenAI atingido";
      } else if (openaiResponse.status === 500 || openaiResponse.status === 503) {
        userFriendlyError = "Servidor OpenAI temporariamente indisponivel";
      }

      return new Response(
        JSON.stringify({ error: userFriendlyError, details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const openaiData = await openaiResponse.json();
    const rawContent = openaiData.choices?.[0]?.message?.content || "";
    const tokensUsed = openaiData.usage?.total_tokens || 0;

    const memoryMatches = rawContent.matchAll(/\[MEMORIA:\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^\]]+)\]/g);
    for (const match of memoryMatches) {
      const categoria = match[1].trim();
      const chave = match[2].trim();
      const valor = match[3].trim();

      await supabase.from("gia_memoria").upsert(
        { usuario_id: usuario.id, chave, valor, categoria, updated_at: new Date().toISOString() },
        { onConflict: "usuario_id,chave" }
      );
    }

    const cards: Record<string, unknown>[] = [];

    const cardMatches = rawContent.matchAll(/\[CARD:\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^\]]+)\]/g);
    for (const match of cardMatches) {
      cards.push({
        id: crypto.randomUUID(),
        type: match[1].trim(),
        title: match[2].trim(),
        color: match[3].trim(),
        value: match[4].trim(),
        subtitle: match[5].trim(),
      });
    }

    const cardItemsMatches = rawContent.matchAll(/\[CARD_ITEMS:\s*([^|]+)\s*\|\s*([^|]+)\s*\|([^\]]+)\]/g);
    for (const match of cardItemsMatches) {
      const itemsStr = match[3].trim();
      const items = itemsStr.split("|").map((item: string) => {
        const parts = item.trim().split(":");
        return { label: parts[0]?.trim(), value: parts[1]?.trim(), status: parts[2]?.trim() };
      });
      cards.push({
        id: crypto.randomUUID(),
        type: "list",
        title: match[1].trim(),
        color: match[2].trim(),
        items,
      });
    }

    const chartMatches = rawContent.matchAll(/\[CARD_CHART:\s*([^|]+)\s*\|\s*([^|]+)\s*\|([^\]]+)\]/g);
    for (const match of chartMatches) {
      const dataStr = match[3].trim();
      const chartData = dataStr.split("|").map((item: string) => {
        const parts = item.trim().split(":");
        return { label: parts[0]?.trim(), value: parseFloat(parts[1]?.trim()) || 0 };
      });
      cards.push({
        id: crypto.randomUUID(),
        type: "chart",
        title: match[1].trim(),
        color: match[2].trim(),
        chartData,
      });
    }

    const cleanContent = rawContent
      .replace(/\[MEMORIA:[^\]]+\]/g, "")
      .replace(/\[CARD:[^\]]+\]/g, "")
      .replace(/\[CARD_ITEMS:[^\]]+\]/g, "")
      .replace(/\[CARD_CHART:[^\]]+\]/g, "")
      .trim();

    await supabase.from("gia_messages").insert({
      conversation_id: convId,
      role: "assistant",
      content: cleanContent,
      metadata: { cards, tokens: tokensUsed },
    });

    return new Response(
      JSON.stringify({
        success: true,
        conversationId: convId,
        content: cleanContent,
        cards,
        tokensUsed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
