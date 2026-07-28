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

SINTAXE DOS CARDS:
[CARD: tipo | titulo | cor | valor | subtitulo] - Para metricas simples (alert, metric, status)
[CARD_ITEMS: titulo | cor | item1_label:item1_value:status | item2_label:item2_value:status] - Para listas
[CARD_BAR: titulo | subtitulo | cor | label1:value1 | label2:value2 | label3:value3] - Grafico de barras horizontal
[CARD_COLUMN: titulo | subtitulo | cor | label1:value1 | label2:value2] - Grafico de colunas vertical
[CARD_LINE: titulo | subtitulo | cor | label1:value1 | label2:value2] - Grafico de linha (evolucao)
[CARD_AREA: titulo | subtitulo | cor | label1:value1 | label2:value2] - Grafico de area (tendencia)
[CARD_PIE: titulo | subtitulo | cor | label1:value1 | label2:value2] - Grafico de pizza (distribuicao %)
[CARD_DONUT: titulo | subtitulo | cor | label1:value1 | label2:value2] - Grafico de rosca (total + %)
[CARD_RADAR: titulo | subtitulo | cor | label1:value1 | label2:value2] - Grafico radar (performance)

TIPOS DE CARD:
- alert, metric, status: Cards simples com 1 valor
- list: Lista de items com status (good/bad/neutral)
- bar: Barras horizontais - ideal para comparacao de valores (ex: faturamento por unidade)
- column: Colunas verticais - ideal para ranking ou top N (ex: top tecnicos)
- line: Linha temporal - ideal para evolucao no tempo (ex: OS por dia/mes)
- area: Area temporal - similar ao line mas com preenchimento
- pie: Pizza - ideal para mostrar proporcoes/distribuicao (ex: OS por tipo)
- donut: Rosca - similar ao pie mas com total no centro
- radar: Radar - ideal para mostrar multiplas dimensoes (ex: performance em varios KPIs)

CORES:
- red: urgente/negativo/critico
- green: positivo/sucesso/meta atingida
- cyan: info/neutro/dados gerais
- amber: atencao/warning/precisa monitorar
- blue: destaque/especial

STATUS (para items de lista):
- good: positivo (ponto verde)
- bad: negativo (ponto vermelho)
- neutral: neutro (ponto cinza)

QUANDO USAR CADA GRAFICO:
- Use BAR para comparar valores entre categorias (unidades, tecnicos, periodos)
- Use COLUMN para rankings (top N)
- Use LINE ou AREA para mostrar evolucao temporal (ultimos dias/meses)
- Use PIE ou DONUT para mostrar distribuicao percentual (tipos de OS, formas de pagamento)
- Use RADAR para mostrar performance em multiplas dimensoes

EXEMPLOS PRATICOS:
"Faturamento por unidade essa semana foi..."
[CARD_BAR: Faturamento por Unidade | Ultimos 7 dias | green | Campinas:18400 | Sao Bernardo:12300 | Osasco:8150]

"Top tecnicos do mes no Skywalker:"
[CARD_COLUMN: Ranking Skywalker | Top 5 do mes | blue | Rafael:847 | Ana:792 | Lucas:685 | Marcos:620 | Julia:598]

"A evolucao de OS nos ultimos 7 dias..."
[CARD_LINE: OS por Dia | Ultimos 7 dias | cyan | Seg:45 | Ter:52 | Qua:48 | Qui:61 | Sex:58 | Sab:32 | Dom:15]

"A distribuicao de OS por tipo de servico..."
[CARD_PIE: OS por Tipo de Servico | Total do mes | cyan | Troca Tela:342 | Troca Bateria:285 | Reparo Placa:156 | Outros:128]

"Faturamento por metodo de pagamento..."
[CARD_DONUT: Receita por Forma | Total do mes | green | PIX:18500 | Debito:12300 | Credito:8900 | Dinheiro:3200]

"Performance geral da operacao..."
[CARD_RADAR: KPIs de Performance | Score 0-100 | green | Qualidade:92 | Velocidade:85 | Satisfacao:94 | Eficiencia:78 | Custo:88 | Inovacao:82]

ACOES DE RELATORIO WHATSAPP:
Quando o usuario pedir para enviar um relatorio no WhatsApp/grupo, o sistema intercepta e executa AUTOMATICAMENTE. Voce recebera um "[SYSTEM ACTION RESULT: ...]" informando se foi enviado com sucesso ou se deu erro. Apenas confirme ao usuario de forma natural.
Relatorios disponiveis: pulso_operacional, abertura_fechamento, mapa_rotas, nucleo_pecas, estoque_dia, limite_credito_gspn, compliance_erros, agendamentos_ih, resumo_final, controle_lp_prazo.

REGRAS CRITICAS:
1. SEMPRE inclua 2-4 cards quando responder com dados
2. Use o tipo de grafico mais adequado para o tipo de dado
3. Use SOMENTE os dados reais acima - NUNCA invente
4. Valores monetarios sempre em R$ formatado
5. Seu nome e GIA - uma palavra, junto, SEMPRE
6. Para graficos, sempre inclua pelo menos 3-4 pontos de dados (nao apenas 2)
7. Labels devem ser curtos (max 15 chars) para caber nos graficos`;

    const chatMessages: { role: string; content: string }[] = [
      { role: "system", content: systemPrompt },
    ];

    for (const h of history.slice(-10)) {
      chatMessages.push({ role: h.role, content: h.content });
    }

    chatMessages.push({ role: "user", content: message });

    // Detect command: send report via WhatsApp
    const msgLower = message.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    const REPORT_TRIGGERS: { keywords: string[]; tipo: string }[] = [
      { keywords: ["sla atom connect", "sla atendimento", "sla connect", "conversas sem resposta", "pendentes atom connect"], tipo: "sla_atom_connect" },
      { keywords: ["controle lp", "relatorio lp", "relatorio de lp", " lp"], tipo: "controle_lp_prazo" },
      { keywords: ["pulso operacional", "pulso"], tipo: "pulso_operacional" },
      { keywords: ["abertura e fechamento", "abertura", "fechamento"], tipo: "abertura_fechamento" },
      { keywords: ["rotas", "mapa de rota", "mapa rotas", "relatorio rota"], tipo: "mapa_rotas" },
      { keywords: ["nucleo de peca", "nucleo peca", "relatorio peca"], tipo: "nucleo_pecas" },
      { keywords: ["estoque dia", "estoque do dia"], tipo: "estoque_dia" },
      { keywords: ["limite de credito", "limite credito", "credito gspn"], tipo: "limite_credito_gspn" },
      { keywords: ["compliance", "erros compliance"], tipo: "compliance_erros" },
      { keywords: ["agenda", "agendamento", "agendamentos ih"], tipo: "agendamentos_ih" },
      { keywords: ["resumo final", "resumo do dia"], tipo: "resumo_final" },
    ];

    const hasActionVerb = (
      msgLower.includes("enviar") || msgLower.includes("envia") || 
      msgLower.includes("manda") || msgLower.includes("mandar") || 
      msgLower.includes("dispara") || msgLower.includes("disparar") ||
      msgLower.includes("gera") || msgLower.includes("gerar")
    );

    const hasReportWord = (
      msgLower.includes("relatorio") || msgLower.includes("controle") || 
      msgLower.includes("report") || msgLower.includes("pulso") || 
      msgLower.includes("nucleo") || msgLower.includes("limite") ||
      msgLower.includes("sla") || msgLower.includes("atom connect")
    );

    let detectedReportTipo: string | null = null;

    if (hasActionVerb && (hasReportWord || msgLower.includes("whatsapp") || msgLower.includes("grupo"))) {
      for (const trigger of REPORT_TRIGGERS) {
        if (trigger.keywords.some(kw => msgLower.includes(kw))) {
          detectedReportTipo = trigger.tipo;
          break;
        }
      }
    }

    if (detectedReportTipo) {
      try {
        const sendResponse = await fetch(`${supabaseUrl}/functions/v1/gia-send-relatorio`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseServiceKey}`,
          },
          body: JSON.stringify({ tipo: detectedReportTipo }),
        });

        const sendResult = await sendResponse.json();
        const actionResult = sendResponse.ok
          ? `RELATORIO "${detectedReportTipo}" ENVIADO COM SUCESSO no grupo WhatsApp.`
          : `ERRO ao enviar relatorio "${detectedReportTipo}": ${sendResult.error || "falha desconhecida"}`;

        chatMessages[chatMessages.length - 1] = {
          role: "user",
          content: `${message}\n\n[SYSTEM ACTION RESULT: ${actionResult}]`,
        };
      } catch (sendErr) {
        chatMessages[chatMessages.length - 1] = {
          role: "user",
          content: `${message}\n\n[SYSTEM ACTION RESULT: ERRO ao enviar relatorio "${detectedReportTipo}" - ${String(sendErr)}]`,
        };
      }
    }

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

    const parseChartData = (dataStr: string) => {
      return dataStr.split("|").map((item: string) => {
        const parts = item.trim().split(":");
        return { label: parts[0]?.trim(), value: parseFloat(parts[1]?.trim()) || 0 };
      });
    };

    const barMatches = rawContent.matchAll(/\[CARD_BAR:\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|([^\]]+)\]/g);
    for (const match of barMatches) {
      cards.push({
        id: crypto.randomUUID(),
        type: "bar",
        title: match[1].trim(),
        subtitle: match[2].trim(),
        color: match[3].trim(),
        chartData: parseChartData(match[4]),
      });
    }

    const columnMatches = rawContent.matchAll(/\[CARD_COLUMN:\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|([^\]]+)\]/g);
    for (const match of columnMatches) {
      cards.push({
        id: crypto.randomUUID(),
        type: "column",
        title: match[1].trim(),
        subtitle: match[2].trim(),
        color: match[3].trim(),
        chartData: parseChartData(match[4]),
      });
    }

    const lineMatches = rawContent.matchAll(/\[CARD_LINE:\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|([^\]]+)\]/g);
    for (const match of lineMatches) {
      cards.push({
        id: crypto.randomUUID(),
        type: "line",
        title: match[1].trim(),
        subtitle: match[2].trim(),
        color: match[3].trim(),
        chartData: parseChartData(match[4]),
      });
    }

    const areaMatches = rawContent.matchAll(/\[CARD_AREA:\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|([^\]]+)\]/g);
    for (const match of areaMatches) {
      cards.push({
        id: crypto.randomUUID(),
        type: "area",
        title: match[1].trim(),
        subtitle: match[2].trim(),
        color: match[3].trim(),
        chartData: parseChartData(match[4]),
      });
    }

    const pieMatches = rawContent.matchAll(/\[CARD_PIE:\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|([^\]]+)\]/g);
    for (const match of pieMatches) {
      cards.push({
        id: crypto.randomUUID(),
        type: "pie",
        title: match[1].trim(),
        subtitle: match[2].trim(),
        color: match[3].trim(),
        chartData: parseChartData(match[4]),
      });
    }

    const donutMatches = rawContent.matchAll(/\[CARD_DONUT:\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|([^\]]+)\]/g);
    for (const match of donutMatches) {
      cards.push({
        id: crypto.randomUUID(),
        type: "donut",
        title: match[1].trim(),
        subtitle: match[2].trim(),
        color: match[3].trim(),
        chartData: parseChartData(match[4]),
      });
    }

    const radarMatches = rawContent.matchAll(/\[CARD_RADAR:\s*([^|]+)\s*\|\s*([^|]+)\s*\|\s*([^|]+)\s*\|([^\]]+)\]/g);
    for (const match of radarMatches) {
      cards.push({
        id: crypto.randomUUID(),
        type: "radar",
        title: match[1].trim(),
        subtitle: match[2].trim(),
        color: match[3].trim(),
        chartData: parseChartData(match[4]),
      });
    }

    const cleanContent = rawContent
      .replace(/\[MEMORIA:[^\]]+\]/g, "")
      .replace(/\[CARD:[^\]]+\]/g, "")
      .replace(/\[CARD_ITEMS:[^\]]+\]/g, "")
      .replace(/\[CARD_CHART:[^\]]+\]/g, "")
      .replace(/\[CARD_BAR:[^\]]+\]/g, "")
      .replace(/\[CARD_COLUMN:[^\]]+\]/g, "")
      .replace(/\[CARD_LINE:[^\]]+\]/g, "")
      .replace(/\[CARD_AREA:[^\]]+\]/g, "")
      .replace(/\[CARD_PIE:[^\]]+\]/g, "")
      .replace(/\[CARD_DONUT:[^\]]+\]/g, "")
      .replace(/\[CARD_RADAR:[^\]]+\]/g, "")
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
