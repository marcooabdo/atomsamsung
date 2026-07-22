import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RELATORIOS = [
  { tipo: "pulso_operacional", nome: "Pulso Operacional", emoji: "🔴", horario: "08:00" },
  { tipo: "estoque_dia", nome: "Estoque do Dia", emoji: "📦", horario: "08:00" },
  { tipo: "agendamentos_ih", nome: "Agendamentos IH", emoji: "📅", horario: "07:30" },
  { tipo: "mapa_rotas", nome: "Mapa de Rotas", emoji: "🗺️", horario: "08:30" },
  { tipo: "abertura_fechamento", nome: "Abertura e Fechamento", emoji: "📊", horario: "09:00" },
  { tipo: "limite_credito_gspn", nome: "Limite de Credito GSPN", emoji: "💳", horario: "09:30" },
  { tipo: "nucleo_pecas", nome: "Nucleo de Pecas", emoji: "🔧", horario: "10:00" },
  { tipo: "compliance_erros", nome: "Compliance e Erros", emoji: "⚠️", horario: "11:00" },
  { tipo: "resumo_final", nome: "Resumo Final", emoji: "🏁", horario: "18:00" },
];

const UNIDADES = [
  { id: "234822a3-f706-47f5-97af-bc7732417660", sigla: "MOC", nome: "Montes Claros" },
  { id: "4ba3e16b-5627-480e-b2b2-f6599a211d41", sigla: "JDF", nome: "Juiz de Fora" },
  { id: "1b9ff2d1-474e-4783-aa39-80c89a6a48cf", sigla: "FSA", nome: "Feira de Santana" },
];

const DEFAULT_GROUP_JID = "120363427351181397@g.us";
const DEFAULT_INSTANCE = "Marco";
const EVOLUTION_API_URL = "https://diego-auditoria.2vhnbz.easypanel.host";
const EVOLUTION_API_KEY = "diego";

async function sendWhatsAppGroup(groupJid: string, text: string, instanceName: string) {
  const resp = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: EVOLUTION_API_KEY },
    body: JSON.stringify({ number: groupJid, text }),
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

async function formatarComChatGPT(openaiKey: string, tipo: string, dadosPorUnidade: Record<string, any>, relInfo: typeof RELATORIOS[0]): Promise<string> {
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const systemPrompt = `Voce e a GIA (Gestao Inteligente ATOM), assistente de relatorios da rede ATOM Smart Center Samsung.
Formata relatorios para envio via WhatsApp em um grupo de gestao com diretores e gerentes.

REGRAS ABSOLUTAS:
- Use *negrito* para titulos e destaques importantes (WhatsApp usa asteriscos)
- Use _italico_ com underscores quando necessario
- Use emojis de forma profissional e moderada para destacar secoes
- SEPARE SEMPRE por unidade: *MOC* (Montes Claros), *JDF* (Juiz de Fora), *FSA* (Feira de Santana)
- Para OS: SEMPRE use o numero_os_samsung (ex: 4174760770). So use numero_os_interna se numero_os_samsung for null/vazio
- Seja conciso mas completo - nao omita dados relevantes
- Use quebras de linha e espacos para legibilidade
- Valores monetarios: R$ X.XXX,XX
- Horarios: HH:MM
- NAO invente dados - use APENAS o que foi fornecido
- NAO use links ou URLs
- Maximo 3000 caracteres por relatorio

ESTRUTURA:
1. Cabecalho: emoji + *TITULO DO RELATORIO* + data/hora
2. Linha separadora (use ━━━━━━━━━━━━━━━━ ou similar)
3. Resumo executivo em 2-3 linhas com os numeros mais importantes
4. Secao *📍 MOC - Montes Claros* com dados da unidade
5. Secao *📍 JDF - Juiz de Fora* com dados da unidade
6. Secao *📍 FSA - Feira de Santana* com dados da unidade
7. Rodape: _GIA - Gestao Inteligente ATOM_ com horario`;

  const userPrompt = `Formate o relatorio "${relInfo.nome}" (${relInfo.emoji}) gerado em ${now}.

Dados de cada unidade (JSON):
${JSON.stringify(dadosPorUnidade, null, 2).slice(0, 12000)}

Gere APENAS o texto formatado para WhatsApp. Nada mais. Sem explicacoes, sem markdown de codigo.`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 2500,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI error (${resp.status}): ${err}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "Erro ao formatar relatorio";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;

    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const {
      tipo,
      todos = false,
      group_jid = DEFAULT_GROUP_JID,
      instance_name = DEFAULT_INSTANCE,
      batch_index,
    } = body;

    // If "todos" - dispatch individual calls to avoid timeout
    if (todos) {
      const results: any[] = [];
      for (let i = 0; i < RELATORIOS.length; i++) {
        const rel = RELATORIOS[i];
        try {
          // Call self for each report
          const selfResp = await fetch(`${supabaseUrl}/functions/v1/gia-send-relatorio`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${supabaseServiceKey}`,
            },
            body: JSON.stringify({ tipo: rel.tipo, group_jid, instance_name }),
          });
          const selfData = await selfResp.json();
          results.push({ tipo: rel.tipo, nome: rel.nome, sucesso: selfData.success || false, erro: selfData.error });
          // Delay between dispatches
          await new Promise((r) => setTimeout(r, 1500));
        } catch (err: any) {
          results.push({ tipo: rel.tipo, nome: rel.nome, sucesso: false, erro: err.message });
        }
      }

      return new Response(
        JSON.stringify({
          success: true,
          enviados: results.filter((r) => r.sucesso).length,
          falhas: results.filter((r) => !r.sucesso).length,
          detalhes: results,
          grupo: group_jid,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tipo) {
      return new Response(
        JSON.stringify({
          error: "Envie { \"todos\": true } ou { \"tipo\": \"pulso_operacional\" }",
          relatorios_disponiveis: RELATORIOS.map((r) => ({ tipo: r.tipo, nome: r.nome, horario: r.horario })),
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const relInfo = RELATORIOS.find((r) => r.tipo === tipo);
    if (!relInfo) {
      return new Response(
        JSON.stringify({ error: `Tipo desconhecido: ${tipo}`, disponiveis: RELATORIOS.map((r) => r.tipo) }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch data per unit in parallel
    const dadosPorUnidade: Record<string, any> = {};
    const promises = UNIDADES.map(async (unidade) => {
      try {
        const data = await gerarRelatorio(supabaseUrl, supabaseServiceKey, relInfo.tipo, unidade.id);
        dadosPorUnidade[unidade.sigla] = data;
      } catch (err: any) {
        dadosPorUnidade[unidade.sigla] = { erro: err.message };
      }
    });
    await Promise.all(promises);

    // Format with ChatGPT
    const textoFormatado = await formatarComChatGPT(openaiKey, relInfo.tipo, dadosPorUnidade, relInfo);

    // Send to WhatsApp
    await sendWhatsAppGroup(group_jid, textoFormatado, instance_name);

    return new Response(
      JSON.stringify({ success: true, tipo: relInfo.tipo, nome: relInfo.nome, grupo: group_jid }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
