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
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
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
      .select("id, nome, tipo, unidade_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!usuario) {
      return new Response(
        JSON.stringify({ error: "User not found" }),
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
        (memories || []).map(m => `- [${m.categoria}] ${m.chave}: ${m.valor}`).join("\n")
      : "";

    const now = new Date();
    const today = now.toISOString().split("T")[0];
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];

    const unidadeFilter = usuario.unidade_id;
    const isMaster = usuario.tipo === "master" || usuario.tipo === "diretoria";

    let osQuery = supabase
      .from("os")
      .select("id, numero_os_interna, numero_os_samsung, status, coluna_kanban, tipo_os, tipo_atendimento, tipo_orcamento, cliente_nome, created_at, data_conclusao, valor_servicos, valor_pecas, valor_total, orcamento_aprovado, prioridade, tecnico_designado, unidade_id, tipo_reparo, is_cortesia, diagnostico_tecnico, reparo_efetuado")
      .gte("created_at", monthStart)
      .order("created_at", { ascending: false })
      .limit(500);

    if (!isMaster && unidadeFilter) {
      osQuery = osQuery.eq("unidade_id", unidadeFilter);
    }

    const { data: osList } = await osQuery;

    let pagQuery = supabase
      .from("pagamentos")
      .select("id, valor, metodo_pagamento, status, created_at, os_id")
      .gte("created_at", monthStart)
      .limit(500);

    if (!isMaster && unidadeFilter) {
      pagQuery = pagQuery.eq("unidade_id", unidadeFilter);
    }

    const { data: pagamentos } = await pagQuery;

    const { data: unidades } = await supabase
      .from("unidades")
      .select("id, nome, cidade, estado");

    const { data: tecnicos } = await supabase
      .from("usuarios")
      .select("id, nome, tipo, unidade_id")
      .in("tipo", ["tecnico", "tecnico_ih"]);

    let pecasQuery = supabase
      .from("estoque_pecas")
      .select("id, sku, descricao, quantidade, preco_custo, status")
      .limit(200);

    if (!isMaster && unidadeFilter) {
      pecasQuery = pecasQuery.eq("unidade_id", unidadeFilter);
    }

    const { data: pecas } = await pecasQuery;

    const { data: metas } = await supabase
      .from("metas_performance")
      .select("*")
      .limit(20);

    const { data: requisicoes } = await supabase
      .from("requisicoes_pecas")
      .select("id, status, numero_os_samsung, created_at")
      .gte("created_at", monthStart)
      .limit(200);

    const totalOS = osList?.length || 0;
    const statusCount: Record<string, number> = {};
    const kanbanCount: Record<string, number> = {};
    const tipoOSCount: Record<string, number> = {};
    let valorTotalMes = 0;
    let orcAprovados = 0;
    let orcTotal = 0;
    const osPorDia: Record<string, number> = {};
    const osHoje: typeof osList = [];

    for (const os of osList || []) {
      statusCount[os.status || "unknown"] = (statusCount[os.status || "unknown"] || 0) + 1;
      kanbanCount[os.coluna_kanban || "unknown"] = (kanbanCount[os.coluna_kanban || "unknown"] || 0) + 1;
      tipoOSCount[os.tipo_os || "unknown"] = (tipoOSCount[os.tipo_os || "unknown"] || 0) + 1;
      valorTotalMes += os.valor_total || 0;
      if (os.tipo_orcamento === "lp" || os.tipo_orcamento === "normal") orcTotal++;
      if (os.orcamento_aprovado) orcAprovados++;
      const dia = (os.created_at || "").split("T")[0];
      osPorDia[dia] = (osPorDia[dia] || 0) + 1;
      if (dia === today) osHoje.push(os);
    }

    const receitaMes = (pagamentos || []).reduce((s, p) => s + (p.valor || 0), 0);
    const metodosPgto: Record<string, number> = {};
    for (const p of pagamentos || []) {
      metodosPgto[p.metodo_pagamento || "outro"] = (metodosPgto[p.metodo_pagamento || "outro"] || 0) + 1;
    }

    const pecasCriticas = (pecas || []).filter(p => (p.quantidade || 0) <= 2);

    const reqStatus: Record<string, number> = {};
    for (const r of requisicoes || []) {
      reqStatus[r.status || "unknown"] = (reqStatus[r.status || "unknown"] || 0) + 1;
    }

    const databaseSnapshot = {
      dataHoje: today,
      periodoAnalise: `${monthStart} a ${today}`,
      usuario: { nome: usuario.nome, tipo: usuario.tipo },
      unidades: (unidades || []).map(u => ({ id: u.id, nome: u.nome, cidade: u.cidade })),
      resumoOS: {
        totalMes: totalOS,
        hoje: osHoje.length,
        porStatus: statusCount,
        porKanban: kanbanCount,
        porTipoOS: tipoOSCount,
        valorTotalMes: valorTotalMes.toFixed(2),
        taxaAprovacao: orcTotal > 0 ? ((orcAprovados / orcTotal) * 100).toFixed(1) + "%" : "N/A",
        osPorDia,
      },
      resumoFinanceiro: {
        receitaMes: receitaMes.toFixed(2),
        totalPagamentos: pagamentos?.length || 0,
        porMetodo: metodosPgto,
      },
      tecnicos: (tecnicos || []).map(t => ({ nome: t.nome, tipo: t.tipo })),
      estoque: {
        totalPecas: pecas?.length || 0,
        pecasCriticas: pecasCriticas.map(p => ({ sku: p.sku, descricao: p.descricao, qtd: p.quantidade })),
      },
      requisicoes: {
        total: requisicoes?.length || 0,
        porStatus: reqStatus,
      },
      metas: metas || [],
    };

    const systemPrompt = `Voce e a GIA (Group Intelligence Assistant), a assistente de inteligencia artificial da ATOM, uma empresa de assistencia tecnica de celulares e eletronicos (Samsung, Apple, etc).

PERSONALIDADE:
- Voce e profissional, inteligente e proativa
- Fala em portugues brasileiro de forma natural e conversacional
- Use emojis com moderacao para deixar a conversa agradavel
- Seja direta mas amigavel, como uma colega de trabalho muito competente
- Quando o usuario perguntar algo que voce nao sabe sobre ele ou a empresa, PERGUNTE para aprender
- Voce adora aprender sobre a empresa e as pessoas

MEMORIA E APRENDIZADO:
- Voce tem um sistema de memoria persistente
- Quando aprender algo novo sobre o usuario ou a empresa, indique com [MEMORIA: categoria | chave | valor]
- Exemplos: [MEMORIA: preferencia | formato_relatorio | detalhado], [MEMORIA: empresa | meta_mensal | R$200000]
- Sempre consulte sua memoria antes de responder
${memoryContext}

CAPACIDADES:
- Acesso completo a todos os dados operacionais da ATOM em tempo real
- Analise de OS (ordens de servico), estoque, financeiro, equipe
- Indicadores Samsung GSPN (numero_os_samsung, status_samsung)
- Tipos de OS: samsung (garantia Samsung), lp (fora garantia com orcamento), normal (reparo direto)
- Colunas Kanban: triagem, aguardando_aprovacao, em_reparo, aguardando_peca, concluido, entregue
- Metricas de performance dos tecnicos via Skywalker (gamificacao)
- Gestao de estoque de pecas com controle de SKU

DADOS ATUAIS DO SISTEMA:
${JSON.stringify(databaseSnapshot, null, 2)}

CARDS DE DADOS:
Quando quiser mostrar dados visuais ao usuario, inclua blocos no formato:
[CARD: tipo | titulo | cor | valor | subtitulo]
[CARD_ITEMS: titulo | cor | item1_label:item1_value:status | item2_label:item2_value:status]
[CARD_CHART: titulo | cor | label1:value1 | label2:value2]

Tipos: alert, metric, chart, status, list
Cores: red, green, cyan, amber, blue
Status dos items: good, bad, neutral

Exemplo:
[CARD: metric | Faturamento Hoje | green | R$ 42.850 | 112% da meta]
[CARD_ITEMS: Pendencias | red | OS #4521:iPhone 15 - Tela:bad | OS #4518:Galaxy S24:bad]

REGRAS:
1. Sempre responda baseado nos dados reais do sistema
2. Se nao tiver dados suficientes, diga e pergunte
3. Faca perguntas para entender melhor o contexto quando necessario
4. Sugira acoes concretas baseadas na analise
5. Formate numeros monetarios em BRL (R$)
6. Use cards para mostrar dados de forma visual
7. Na primeira interacao, se apresente e pergunte como pode ajudar`;

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
      return new Response(
        JSON.stringify({ error: "OpenAI API error", details: errText }),
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
      const items = itemsStr.split("|").map(item => {
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
      const chartData = dataStr.split("|").map(item => {
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
