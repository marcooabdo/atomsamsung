import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface AnalysisRequest {
  unidadeId?: string;
  tipo?: string;
  periodoInicio?: string;
  periodoFim?: string;
  dadosExtra?: Record<string, unknown>;
}

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
    const openaiKey = Deno.env.get("OPENAI_API_KEY");

    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    const body: AnalysisRequest = await req.json();
    const {
      unidadeId = usuario.unidade_id,
      tipo = "dashboard_geral",
      periodoInicio,
      periodoFim,
    } = body;

    const now = new Date();
    const defaultEnd = now.toISOString().split("T")[0];
    const defaultStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
    const pInicio = periodoInicio || defaultStart;
    const pFim = periodoFim || defaultEnd;

    let osQuery = supabase
      .from("os")
      .select("id, numero_os_interna, status, coluna_kanban, tipo_os, tipo_atendimento, tipo_orcamento, cliente_nome, created_at, data_conclusao, valor_servicos, valor_pecas, valor_total, orcamento_aprovado, prioridade")
      .gte("created_at", pInicio)
      .lte("created_at", pFim + "T23:59:59");

    if (unidadeId) {
      osQuery = osQuery.eq("unidade_id", unidadeId);
    }

    const { data: osList } = await osQuery;
    const totalOS = osList?.length || 0;

    const statusCount: Record<string, number> = {};
    const kanbanCount: Record<string, number> = {};
    const tipoOSCount: Record<string, number> = {};
    let totalValor = 0;
    let orcamentosAprovados = 0;
    let orcamentosTotal = 0;
    let osAtrasadas = 0;

    for (const os of osList || []) {
      statusCount[os.status || "desconhecido"] = (statusCount[os.status || "desconhecido"] || 0) + 1;
      kanbanCount[os.coluna_kanban || "desconhecido"] = (kanbanCount[os.coluna_kanban || "desconhecido"] || 0) + 1;
      tipoOSCount[os.tipo_os || "desconhecido"] = (tipoOSCount[os.tipo_os || "desconhecido"] || 0) + 1;
      totalValor += (os.valor_total || 0);
      if (os.tipo_orcamento === "lp" || os.tipo_orcamento === "normal") orcamentosTotal++;
      if (os.orcamento_aprovado) orcamentosAprovados++;
      if (os.prioridade === "urgente" || os.prioridade === "alta") osAtrasadas++;
    }

    const taxaAprovacao = orcamentosTotal > 0 ? ((orcamentosAprovados / orcamentosTotal) * 100).toFixed(1) : "0";

    let cotacoesQuery = supabase
      .from("cotacoes")
      .select("id, status, valor_total, created_at")
      .gte("created_at", pInicio)
      .lte("created_at", pFim + "T23:59:59");

    if (unidadeId) {
      cotacoesQuery = cotacoesQuery.eq("unidade_id", unidadeId);
    }

    const { data: cotacoes } = await cotacoesQuery;
    const cotacoesStatus: Record<string, number> = {};
    for (const c of cotacoes || []) {
      cotacoesStatus[c.status || "desconhecido"] = (cotacoesStatus[c.status || "desconhecido"] || 0) + 1;
    }

    let pagamentosQuery = supabase
      .from("pagamentos")
      .select("id, valor, metodo_pagamento, status, created_at")
      .gte("created_at", pInicio)
      .lte("created_at", pFim + "T23:59:59");

    if (unidadeId) {
      pagamentosQuery = pagamentosQuery.eq("unidade_id", unidadeId);
    }

    const { data: pagamentos } = await pagamentosQuery;
    const receitaTotal = (pagamentos || []).reduce((s, p) => s + (p.valor || 0), 0);
    const metodosPgto: Record<string, number> = {};
    for (const p of pagamentos || []) {
      metodosPgto[p.metodo_pagamento || "outro"] = (metodosPgto[p.metodo_pagamento || "outro"] || 0) + 1;
    }

    const dadosEntrada = {
      periodo: { inicio: pInicio, fim: pFim },
      os: {
        total: totalOS,
        porStatus: statusCount,
        porKanban: kanbanCount,
        porTipoOS: tipoOSCount,
        valorTotal: totalValor,
        taxaAprovacaoOrcamento: taxaAprovacao + "%",
        osAltaPrioridade: osAtrasadas,
      },
      cotacoes: {
        total: cotacoes?.length || 0,
        porStatus: cotacoesStatus,
      },
      pagamentos: {
        total: pagamentos?.length || 0,
        receitaTotal,
        porMetodo: metodosPgto,
      },
    };

    const systemPrompt = `Voce e um analista de negocios especializado em assistencia tecnica e servicos de reparo de eletronicos (Samsung, Apple, etc).
Analise os dados operacionais fornecidos e gere insights acionaveis em portugues brasileiro.

Estruture sua resposta em:
1. **Resumo Executivo** (2-3 frases)
2. **Pontos Fortes** (bullets)
3. **Pontos de Atencao** (bullets com sugestoes)
4. **Recomendacoes** (acoes concretas priorizadas)
5. **Indicadores Chave** (numeros relevantes formatados)

Seja direto, pratico e use linguagem profissional. Nao repita os dados brutos, interprete-os.`;

    const userPrompt = `Analise os seguintes dados operacionais do periodo ${pInicio} a ${pFim}:\n\n${JSON.stringify(dadosEntrada, null, 2)}`;

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openaiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.7,
        max_tokens: 2000,
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
    const resultado = openaiData.choices?.[0]?.message?.content || "Sem resultado";
    const tokensUsed = openaiData.usage?.total_tokens || 0;

    const { data: analise, error: insertError } = await supabase
      .from("analises_ia")
      .insert({
        unidade_id: unidadeId || null,
        tipo,
        periodo_inicio: pInicio,
        periodo_fim: pFim,
        dados_entrada: dadosEntrada,
        resultado,
        modelo: "gpt-4o-mini",
        tokens_utilizados: tokensUsed,
        solicitado_por: usuario.id,
      })
      .select()
      .single();

    if (insertError) {
      return new Response(
        JSON.stringify({ error: "Failed to save analysis", details: insertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, analise }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Internal server error", details: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
