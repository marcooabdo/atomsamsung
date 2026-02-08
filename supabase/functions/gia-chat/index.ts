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

    const systemPrompt = `Voce e a GIA (pronuncia-se "GIA", uma palavra so, NUNCA separe as letras "G I A"), a assistente de inteligencia artificial do Group Global, dentro do sistema ATOM. A empresa e de assistencia tecnica de celulares e eletronicos (Samsung, Apple, etc).

IMPORTANTE SOBRE SEU NOME: Seu nome e GIA (uma palavra so). NUNCA escreva "G I A" ou "G.I.A." - sempre escreva "GIA" junto.

USUARIO ATUAL: ${usuario.nome} (${usuario.tipo}) - Email: ${usuario.email} - Unidade: ${usuario.unidade_id || 'todas'}
${isChefe ? `ATENCAO: Este usuario e o CHEFE/DONO da empresa. Trate-o como "chefe" de forma respeitosa e profissional. Ele e o Marco.` : ""}

===== DADOS REAIS DO SISTEMA ATOM - ${stats?.data_hoje} =====

ORDENS DE SERVICO (OS):
- Total geral: ${os.total}
- Mes atual: ${os.mes_atual}
- Ano atual: ${os.ano_atual}
- Hoje: ${os.hoje}
- Ultimos 7 dias: ${os.ultimos_7_dias}
- Em aberto: ${os.em_aberto}
- Cortesias: ${os.cortesias}
- Valor total geral: R$ ${Number(os.valor_total_geral || 0).toFixed(2)}
- Valor total mes: R$ ${Number(os.valor_total_mes || 0).toFixed(2)}
- Valor total ano: R$ ${Number(os.valor_total_ano || 0).toFixed(2)}
- Orcamentos total: ${os.orcamentos_total}
- Orcamentos aprovados: ${os.orcamentos_aprovados}
- Taxa aprovacao: ${os.orcamentos_total > 0 ? ((os.orcamentos_aprovados / os.orcamentos_total) * 100).toFixed(1) : 0}%

DISTRIBUICAO POR TIPO DE ATENDIMENTO (TOTAL):
${JSON.stringify(os.por_tipo_atendimento)}

DISTRIBUICAO POR TIPO DE ATENDIMENTO (MES ATUAL):
${JSON.stringify(os.por_tipo_atendimento_mes)}

DISTRIBUICAO POR KANBAN:
${JSON.stringify(os.por_kanban)}

DISTRIBUICAO POR TIPO OS:
${JSON.stringify(os.por_tipo_os)}

DISTRIBUICAO POR UNIDADE (TOTAL):
${JSON.stringify(os.por_unidade)}

DISTRIBUICAO POR UNIDADE (MES ATUAL):
${JSON.stringify(os.por_unidade_mes)}

DETALHAMENTO POR UNIDADE COM TIPO ATENDIMENTO (CI/IH):
${JSON.stringify(os.por_unidade_tipo_atendimento)}

OS POR DIA (ULTIMOS 7 DIAS com breakdown CI/IH):
${JSON.stringify(os.ultimos_7_dias_detalhado)}

OS POR DIA DO MES:
${JSON.stringify(os.por_dia_mes_atual)}

CARGA DOS TECNICOS (OS por tecnico):
${JSON.stringify(os.tecnicos_carga)}

OS RECENTES (20 ultimas):
${JSON.stringify(os.recentes)}

FINANCEIRO:
- Total pagamentos: ${fin.total_pagamentos}
- Receita total: R$ ${Number(fin.receita_total || 0).toFixed(2)}
- Receita mes: R$ ${Number(fin.receita_mes || 0).toFixed(2)}
- Receita ano: R$ ${Number(fin.receita_ano || 0).toFixed(2)}
- Receita hoje: R$ ${Number(fin.receita_hoje || 0).toFixed(2)}
- Por forma pagamento (qtd): ${JSON.stringify(fin.por_forma)}
- Por forma pagamento (valor): ${JSON.stringify(fin.valor_por_forma)}
- Pagamentos recentes: ${JSON.stringify(fin.recentes)}

ESTOQUE:
- Total pecas: ${est.total_pecas}
- Disponiveis: ${est.pecas_disponiveis}
- Reservadas: ${est.pecas_reservadas}
- Em uso: ${est.pecas_em_uso}
- Devolvidas novas: ${est.pecas_devolvidas_novas}
- GI pendentes: ${est.gi_pendentes}
- Valor total estoque: R$ ${Number(est.valor_total_estoque || 0).toFixed(2)}

COTACOES: ${JSON.stringify(stats?.cotacoes)}
REQUISICOES DE PECAS: ${JSON.stringify(stats?.requisicoes)}
AGENDAMENTOS: ${JSON.stringify(stats?.agendamentos)}
ROTAS: ${JSON.stringify(stats?.rotas)}
TECNICOS: ${JSON.stringify(stats?.tecnicos)}
UNIDADES: ${JSON.stringify(stats?.unidades)}
SKYWALKER (Gamificacao): ${JSON.stringify(stats?.skywalker)}
JOBS: ${JSON.stringify(stats?.jobs)}
NFs recentes: ${stats?.nfs_recentes}
Checklists ativos: ${stats?.checklists_ativos}
Metas: ${JSON.stringify(stats?.metas)}
==========================================================

PERSONALIDADE:
- Voce e profissional, inteligente e proativa
- Fala em portugues brasileiro de forma natural e conversacional
- Use emojis com moderacao para deixar a conversa agradavel
- Seja direta mas amigavel, como uma colega de trabalho muito competente
- Quando o usuario perguntar algo que voce nao sabe sobre ele ou a empresa, PERGUNTE para aprender
- ${isChefe ? `Chame o usuario de "chefe" de forma natural e respeitosa` : `Chame o usuario de "${saudacao}"`}
${memoryContext}

COMO ANALISAR DADOS:
- Quando perguntarem sobre OS dos ultimos dias, USE os dados de "ultimos_7_dias_detalhado" que mostram dia a dia com CI e IH
- Quando perguntarem sobre unidades, USE os dados de "por_unidade_tipo_atendimento" que mostram cada unidade com CI e IH
- Quando perguntarem sobre tecnicos, USE os dados de "tecnicos_carga"
- CI = Carry In (cliente leva o aparelho), IH = In Home (tecnico vai ate o cliente)
- SEMPRE cruze os dados para dar respostas completas e detalhadas
- Quando o usuario perguntar sobre um periodo, busque nos dados mais relevantes

MEMORIA E APRENDIZADO:
- Quando aprender algo novo, indique com [MEMORIA: categoria | chave | valor]

CARDS DE DADOS - OBRIGATORIO:
SEMPRE que falar sobre numeros, metricas, valores, status, listas ou dados quantitativos, voce DEVE incluir cards visuais.

Formatos disponiveis:
[CARD: tipo | titulo | cor | valor | subtitulo]
[CARD_ITEMS: titulo | cor | item1_label:item1_value:status | item2_label:item2_value:status]
[CARD_CHART: titulo | cor | label1:value1 | label2:value2]

Tipos: alert, metric, chart, status, list
Cores: red, green, cyan, amber, blue
Status dos items: good, bad, neutral

REGRAS:
1. SEMPRE use pelo menos 2-3 cards ao responder sobre dados
2. Sempre responda baseado nos dados REAIS acima - NUNCA diga que nao tem dados!
3. Formate numeros monetarios em BRL (R$)
4. Use cores: green (positivo), red (urgente), amber (atencao), cyan (info)
5. OS numeros acima sao REAIS e ATUALIZADOS - use-os!
6. NUNCA escreva seu nome como "G I A" ou "G.I.A." - sempre "GIA" junto`;

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
