import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_BOT_MESSAGES_BEFORE_ESCALATION = 20;
const MAX_HISTORY_MESSAGES = 30;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  const startTime = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { data: secretRow } = await supabase
      .from("system_secrets")
      .select("value")
      .eq("key", "OPENAI_API_KEY")
      .maybeSingle();

    const openaiKey = secretRow?.value || Deno.env.get("OPENAI_API_KEY");
    if (!openaiKey) {
      return new Response(JSON.stringify({ error: "OPENAI_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { conversa_id, mensagem_cliente, tipo_mensagem } = await req.json();
    if (!conversa_id || !mensagem_cliente) {
      return new Response(JSON.stringify({ error: "conversa_id and mensagem_cliente required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: conversa } = await supabase
      .from("atom_connect_conversas")
      .select("*, instancia:atom_connect_instancias(*)")
      .eq("id", conversa_id)
      .maybeSingle();

    if (!conversa) {
      return new Response(JSON.stringify({ error: "Conversa not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!conversa.is_bot_ativo) {
      return new Response(JSON.stringify({ skipped: true, reason: "bot_disabled" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: recentBotMsgs } = await supabase
      .from("atom_connect_mensagens")
      .select("id")
      .eq("conversa_id", conversa_id)
      .eq("is_bot", true)
      .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (recentBotMsgs && recentBotMsgs.length >= MAX_BOT_MESSAGES_BEFORE_ESCALATION) {
      await escalateToHuman(supabase, conversa, "Limite de mensagens automáticas atingido (20 em 24h)");
      return new Response(JSON.stringify({ escalated: true, reason: "message_limit" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const OS_DETAIL_SELECT = `
      *,
      unidade:unidades!os_unidade_id_fkey(nome),
      tecnico_designado:usuarios!os_tecnico_designado_id_fkey(nome),
      tecnico_agendado:usuarios!os_tecnico_agendado_id_fkey(nome),
      os_pecas:os_pecas(pn, descricao, quantidade, valor_unitario, status_gspn),
      pagamentos:pagamentos(forma_pagamento, valor, created_at)
    `;

    const [historyResult, knowledgeResult] = await Promise.all([
      supabase
        .from("atom_connect_mensagens")
        .select("from_me, conteudo, tipo, is_bot, created_at, metadata, caption")
        .eq("conversa_id", conversa_id)
        .order("created_at", { ascending: false })
        .limit(MAX_HISTORY_MESSAGES),
      supabase
        .from("gia_base_conhecimento")
        .select("titulo, conteudo, categoria")
        .eq("ativo", true)
        .order("ordem"),
    ]);

    const history = (historyResult.data || []).reverse();

    async function loadOSDetails(osId: string) {
      const { data, error } = await supabase.from("os").select(OS_DETAIL_SELECT).eq("id", osId).maybeSingle();
      if (error) console.error("loadOSDetails error:", error.message);
      return data;
    }

    async function findOSById(osId: string) {
      const { data } = await supabase.from("os").select("id").eq("id", osId).maybeSingle();
      return data?.id || null;
    }

    async function findOSByPhone(phone: string) {
      const suffix = phone.replace(/\D/g, "");
      const phoneSuffix = suffix.length >= 10 ? suffix.slice(-10) : suffix;
      const { data, error } = await supabase
        .from("os")
        .select("id")
        .or(`cliente_telefone.ilike.%${phoneSuffix},cliente_telefone_2.ilike.%${phoneSuffix}`)
        .neq("arquivada", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) console.error("findOSByPhone error:", error.message);
      return data?.id || null;
    }

    async function findOSByNumber(candidate: string) {
      const { data, error } = await supabase
        .from("os")
        .select("id")
        .or(`numero_os_samsung.eq.${candidate},numero_os_interna.ilike.${candidate}`)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) console.error("findOSByNumber error:", error.message, "candidate:", candidate);
      return data?.id || null;
    }

    let osVinculada: any = null;

    // 1) Try linked OS
    if (conversa.os_id) {
      osVinculada = await loadOSDetails(conversa.os_id);
    }

    // 2) Try by phone
    if (!osVinculada && conversa.cliente_telefone) {
      const foundId = await findOSByPhone(conversa.cliente_telefone);
      if (foundId) osVinculada = await loadOSDetails(foundId);
    }

    // 3) Try extracting OS number from message or recent history
    if (!osVinculada) {
      const textsToSearch = [mensagem_cliente, ...(history || []).filter((m: any) => !m.from_me).slice(-3).map((m: any) => m.conteudo || "")];
      const allText = textsToSearch.join(" ");
      const candidates: string[] = [];
      const numericMatches = allText.matchAll(/\b(\d{7,13})\b/g);
      for (const m of numericMatches) candidates.push(m[1]);
      const alphaMatch = allText.match(/\b([A-Za-z]\d{4,12})\b/);
      if (alphaMatch) candidates.push(alphaMatch[1].toUpperCase());

      for (const candidate of candidates) {
        if (osVinculada) break;
        const foundId = await findOSByNumber(candidate);
        if (foundId) osVinculada = await loadOSDetails(foundId);
      }
    }

    const unitKnowledge = (knowledgeResult.data || []).filter((k: any) => !!k);

    let orcamentoLink = "";
    if (osVinculada) {
      const { data: linkData } = await supabase
        .from("orcamento_links")
        .select("token, status, ativo")
        .eq("os_id", osVinculada.id)
        .eq("ativo", true)
        .eq("status", "pendente")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (linkData) {
        const { data: appUrlSecret } = await supabase
          .from("system_secrets")
          .select("value")
          .eq("key", "APP_URL")
          .maybeSingle();
        const appUrl = appUrlSecret?.value || Deno.env.get("APP_URL") || supabaseUrl.replace("supabase.co", "netlify.app").replace("/rest/v1", "");
        orcamentoLink = `${appUrl}/orcamento/${linkData.token}`;
      }
    }

    const systemPrompt = buildSystemPrompt(conversa, osVinculada, unitKnowledge, orcamentoLink);

    const messages: Array<{ role: string; content: string }> = [
      { role: "system", content: systemPrompt },
    ];

    for (const msg of history) {
      const role = msg.from_me ? "assistant" : "user";
      let content = msg.conteudo || "";
      const templateName = msg.metadata?.template_name;
      if (templateName && msg.from_me) {
        content = `[TEMPLATE ENVIADO: ${templateName}] ${content}`;
      }
      if (!msg.from_me) {
        if (msg.tipo === "image") content = `[CLIENTE ENVIOU IMAGEM/FOTO${msg.caption ? `: ${msg.caption}` : ""}]`;
        else if (msg.tipo === "document") content = `[CLIENTE ENVIOU DOCUMENTO${msg.caption ? `: ${msg.caption}` : ""}]`;
        else if (msg.tipo === "video") content = `[CLIENTE ENVIOU VÍDEO${msg.caption ? `: ${msg.caption}` : ""}]`;
        else if (msg.tipo === "audio") content = "[CLIENTE ENVIOU ÁUDIO]";
        else if (msg.tipo === "sticker") content = "[CLIENTE ENVIOU FIGURINHA]";
        else if (msg.tipo === "location") content = "[CLIENTE ENVIOU LOCALIZAÇÃO]";
        else if (msg.tipo === "contact") content = "[CLIENTE ENVIOU CONTATO]";
      }
      if (content.trim()) messages.push({ role, content });
    }

    let userContent = mensagem_cliente;
    if (tipo_mensagem && tipo_mensagem !== "text") {
      const tipoLabels: Record<string, string> = {
        image: "IMAGEM/FOTO",
        document: "DOCUMENTO",
        video: "VÍDEO",
        audio: "ÁUDIO",
        sticker: "FIGURINHA",
        location: "LOCALIZAÇÃO",
        contact: "CONTATO",
      };
      const label = tipoLabels[tipo_mensagem] || tipo_mensagem.toUpperCase();
      userContent = `[CLIENTE ENVIOU ${label}] ${mensagem_cliente}`;
    }
    messages.push({ role: "user", content: userContent });

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages,
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text();
      console.error("[GIA Atendimento] OpenAI error:", openaiResponse.status, errText);

      if (openaiResponse.status === 429 || openaiResponse.status >= 500) {
        await escalateToHuman(supabase, conversa, "API da IA temporariamente indisponível");
        return new Response(JSON.stringify({ escalated: true, reason: "api_error" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error(`OpenAI error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const rawResponse = openaiData.choices?.[0]?.message?.content || "";
    const tokensUsed = openaiData.usage?.total_tokens || 0;

    const shouldEscalate = rawResponse.includes("[TRANSFERIR_HUMANO]");
    const shouldQueue = rawResponse.includes("[ENCAMINHAR_EQUIPE]");
    const cleanResponse = rawResponse.replace(/\[TRANSFERIR_HUMANO\]/g, "").replace(/\[ENCAMINHAR_EQUIPE\]/g, "").trim();

    if (shouldEscalate || !cleanResponse) {
      await escalateToHuman(supabase, conversa, shouldEscalate ? "Cliente pediu atendente humano" : "Resposta vazia da IA");

      if (cleanResponse) {
        await sendWhatsAppMessage(supabase, conversa, cleanResponse);
      }

      await logInteraction(supabase, conversa, osVinculada, mensagem_cliente, cleanResponse || "(escalated)", tokensUsed, true, "GIA decidiu transferir", Date.now() - startTime);

      return new Response(JSON.stringify({ escalated: true, response: cleanResponse }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (shouldQueue) {
      await supabase
        .from("atom_connect_conversas")
        .update({ coluna_pipeline: "fila_espera" })
        .eq("id", conversa.id);
      console.log(`[GIA Atendimento] Conversa ${conversa.id} movida para fila_espera - GIA encaminhou para equipe`);
    }

    await sendWhatsAppMessage(supabase, conversa, cleanResponse);
    await logInteraction(supabase, conversa, osVinculada, mensagem_cliente, cleanResponse, tokensUsed, false, null, Date.now() - startTime);

    if (osVinculada && !conversa.os_id) {
      await supabase
        .from("atom_connect_conversas")
        .update({ os_id: osVinculada.id })
        .eq("id", conversa_id);
    }

    return new Response(JSON.stringify({ success: true, response: cleanResponse, tokens: tokensUsed }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("[GIA Atendimento] Error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function buildSystemPrompt(conversa: any, os: any, knowledge: any[], orcamentoLink: string): string {
  const nomeCliente = conversa.cliente_nome || "Cliente";

  let prompt = `Você é a GIA (Global Intelligence Assistant), assistente virtual de atendimento ao cliente de uma assistência técnica autorizada Samsung.

REGRAS OBRIGATÓRIAS:
1. Seja sempre educada, profissional e empática
2. Use português brasileiro natural, sem exagero de emojis (máximo 1-2 por mensagem)
3. Nunca invente informações — se não souber algo, diga que não tem essa informação no momento e que vai encaminhar para a equipe verificar
4. Nunca revele que é uma IA, se perguntar diga que é a GIA, assistente do atendimento
5. Mantenha respostas concisas (máximo 3-4 parágrafos)
6. APENAS inclua [TRANSFERIR_HUMANO] quando o cliente EXPLICITAMENTE pedir para falar com um atendente/pessoa/humano, ou quando ficar muito agressivo. NÃO ofereça transferir para humano por conta própria — tente resolver a questão primeiro
7. NÃO mencione a possibilidade de transferir para atendente humano a menos que o cliente peça. Resolva você mesma o máximo possível
8. Quando você NÃO conseguir resolver algo e precisar que a equipe verifique (ex: não encontrou a OS, não tem a informação solicitada), inclua [ENCAMINHAR_EQUIPE] na resposta. Isso coloca o cliente na fila de espera para um atendente verificar
9. Formate com *negrito* para destacar informações importantes (formato WhatsApp)

PERSONALIDADE:
- Acolhedora e paciente
- Negociadora habilidosa para fechar orçamentos
- Sabe acalmar clientes insatisfeitos com empatia
- Objetiva e direta, sem enrolação
- Transmite confiança e profissionalismo

SOBRE O CLIENTE ATUAL:
- Nome: ${nomeCliente}
- Telefone: ${conversa.cliente_telefone || "N/A"}
`;

  if (os) {
    const osNum = os.numero_os_samsung || os.numero_os_interna || "S/N";
    const statusMap: Record<string, string> = {
      os_nova: "OS Nova - Recém recebida",
      diagnostico: "Em Diagnóstico/Triagem",
      negociacao_em_andamento: "Orçamento sendo preparado",
      aguardando_aprovacao: "Aguardando sua aprovação do orçamento",
      orcamento_aprovado: "Orçamento aprovado - Reparo autorizado",
      aguardando_peca: "Aguardando peça para reparo",
      peca_em_transito: "Peça a caminho",
      em_reparo_ci: "Em reparo na assistência",
      em_rota_ih: "Visita agendada",
      em_reparo_ih: "Reparo em andamento (visita)",
      reparo_concluido: "Reparo concluído",
      aguardando_fechamento: "Aguardando fechamento",
      os_fechada: "Serviço finalizado",
      orcamentos_rejeitados: "Orçamento recusado",
      controle_qualidade: "Em controle de qualidade",
    };
    const statusDesc = statusMap[os.coluna_kanban] || os.coluna_kanban;

    prompt += `
ORDEM DE SERVIÇO VINCULADA:
- Número OS: ${osNum}
- Status atual: *${statusDesc}*
- Tipo: ${os.tipo_os || "N/A"} (${os.tipo_atendimento || "N/A"})
- Aparelho: ${os.aparelho_marca || ""} ${os.aparelho_modelo || "N/A"}
- Defeito relatado: ${os.defeito_relatado || "N/A"}
- Diagnóstico: ${os.diagnostico_tecnico || "Ainda não diagnosticado"}
- Reparo efetuado: ${os.reparo_efetuado || "Ainda não reparado"}
- Valor total: R$ ${(os.valor_total || 0).toFixed(2)}
- Valor pago: R$ ${(os.valor_pago || 0).toFixed(2)}
- Saldo restante: R$ ${(os.saldo_restante || 0).toFixed(2)}
- Status pagamento: ${os.status_pagamento || "N/A"}
- Tipo reparo: ${os.tipo_reparo || "N/A"}
- Cortesia: ${os.is_cortesia ? "Sim" : "Não"}
- Data abertura: ${os.created_at ? new Date(os.created_at).toLocaleDateString("pt-BR") : "N/A"}
- Técnico designado: ${os.tecnico_designado?.nome || "Não definido"}
- Técnico agendado: ${os.tecnico_agendado?.nome || "Não definido"}
`;
    if (os.data_agendamento) {
      prompt += `- Data agendamento: ${new Date(os.data_agendamento + "T00:00:00").toLocaleDateString("pt-BR")}`;
      if (os.periodo_agendamento) prompt += ` (${os.periodo_agendamento})`;
      prompt += "\n";
    }

    if (os.os_pecas?.length > 0) {
      prompt += "\nPEÇAS NA OS:\n";
      for (const p of os.os_pecas) {
        prompt += `- ${p.descricao || p.pn || "Peça"} (x${p.quantidade || 1}) - R$ ${(p.valor_unitario || 0).toFixed(2)} ${p.status_gspn ? `[${p.status_gspn}]` : ""}\n`;
      }
    }

    if (os.pagamentos?.length > 0) {
      prompt += "\nPAGAMENTOS REGISTRADOS:\n";
      for (const p of os.pagamentos) {
        prompt += `- ${p.forma_pagamento}: R$ ${(p.valor || 0).toFixed(2)} em ${new Date(p.created_at).toLocaleDateString("pt-BR")}\n`;
      }
    }

    if (orcamentoLink) {
      prompt += `\nLINK DE ORÇAMENTO ATIVO: ${orcamentoLink}
Quando o cliente perguntar sobre orçamento ou quiser aprovar, envie este link para ele aprovar online.
Diga algo como: "Preparei o link do orçamento para sua aprovação: ${orcamentoLink}"
`;
    }
  } else {
    prompt += `\nNENHUMA OS VINCULADA: Não encontrei uma ordem de serviço vinculada a este número de telefone. Se o cliente perguntar sobre um serviço específico, peça o número da OS para poder buscar. Caso o cliente já tenha informado o número da OS mas você não tem os dados, diga que não localizou e peça para confirmar o número. NÃO ofereça transferir para atendente humano, tente resolver sozinha.\n`;
  }

  if (knowledge.length > 0) {
    prompt += "\n=== INSTRUÇÕES E BASE DE CONHECIMENTO ===\n";
    prompt += "IMPORTANTE: As instruções abaixo são REGRAS que você DEVE seguir. Quando uma instrução mencionar um template específico (ex: 'se for o template inicial_os'), verifique no histórico se esse template foi enviado (aparece como [TEMPLATE ENVIADO: nome_do_template]). Quando mencionar tipos de mensagem (ex: 'se o cliente enviou anexo/foto/documento'), verifique os indicadores no histórico (ex: [CLIENTE ENVIOU IMAGEM], [CLIENTE ENVIOU DOCUMENTO]).\nSiga cada instrução ao pé da letra, respeitando as condições descritas.\n";
    for (const k of knowledge) {
      prompt += `\n[${k.categoria.toUpperCase()}] ${k.titulo}:\n${k.conteudo}\n`;
    }
  }

  prompt += `
INSTRUÇÃO FINAL:
- Responda a mensagem do cliente de forma natural e útil
- Se for uma saudação, responda de forma acolhedora e pergunte como pode ajudar
- Se perguntar sobre status da OS, use as informações acima
- Se quiser aprovar orçamento e tiver link, envie o link
- NÃO use [TRANSFERIR_HUMANO] a menos que o cliente peça explicitamente para falar com uma pessoa
- NÃO ofereça transferir para atendente humano. Tente resolver tudo sozinha
- Se não souber algo ou não encontrou a OS, diga que vai encaminhar para a equipe verificar e inclua [ENCAMINHAR_EQUIPE] na resposta
- Lembre-se: você está em um chat WhatsApp, mantenha mensagens curtas e naturais`;

  return prompt;
}

async function sendWhatsAppMessage(supabase: any, conversa: any, rawText: string): Promise<void> {
  const text = `*GIA - Global Intelligence Assistant:*\n${rawText}`;
  let instancia = conversa.instancia;

  // If conversa has no instancia_id, look up by unidade_id
  if (!instancia && conversa.unidade_id) {
    const { data: unitInstance } = await supabase
      .from("atom_connect_instancias")
      .select("*")
      .eq("unidade_id", conversa.unidade_id)
      .eq("status", "connected")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (unitInstance) {
      instancia = unitInstance;
      // Also fix the conversa so future messages work
      await supabase
        .from("atom_connect_conversas")
        .update({ instancia_id: unitInstance.id })
        .eq("id", conversa.id);
    }
  }

  if (!instancia) {
    console.error("[GIA Atendimento] No instancia found for conversa", conversa.id);
    return;
  }

  const phone = conversa.cliente_telefone?.replace(/\D/g, "") || "";
  if (!phone) return;

  const phoneForSend = phone.startsWith("55") ? phone : `55${phone}`;

  try {
    const resp = await fetch(`${instancia.api_url}/message/sendText/${instancia.instance_name}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: instancia.api_key },
      body: JSON.stringify({ number: phoneForSend, text }),
    });

    if (!resp.ok) {
      console.error("[GIA Atendimento] sendText failed:", resp.status, await resp.text());
    }
  } catch (err) {
    console.error("[GIA Atendimento] sendText error:", err);
  }

  await supabase.from("atom_connect_mensagens").insert({
    conversa_id: conversa.id,
    message_id: `gia_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    from_me: true,
    tipo: "text",
    conteudo: text,
    status: "sent",
    is_bot: true,
    sender_name: "GIA",
  });

  await supabase
    .from("atom_connect_conversas")
    .update({
      ultima_mensagem: text.substring(0, 200),
      ultima_mensagem_at: new Date().toISOString(),
    })
    .eq("id", conversa.id);
}

async function escalateToHuman(supabase: any, conversa: any, reason: string): Promise<void> {
  await supabase
    .from("atom_connect_conversas")
    .update({
      is_bot_ativo: false,
      coluna_pipeline: "fila_espera",
    })
    .eq("id", conversa.id);

  console.log(`[GIA Atendimento] Escalated conversa ${conversa.id} to human: ${reason}`);
}

async function logInteraction(
  supabase: any, conversa: any, os: any,
  mensagemCliente: string, respostaGia: string,
  tokens: number, escalated: boolean, motivo: string | null,
  tempoMs: number,
): Promise<void> {
  try {
    await supabase.from("gia_atendimento_logs").insert({
      conversa_id: conversa.id,
      os_id: os?.id || null,
      unidade_id: conversa.unidade_id,
      mensagem_cliente: mensagemCliente,
      resposta_gia: respostaGia,
      tokens_usados: tokens,
      modelo: "gpt-4o-mini",
      transferiu_para_humano: escalated,
      motivo_transferencia: motivo,
      tempo_resposta_ms: tempoMs,
    });
  } catch (err) {
    console.error("[GIA Atendimento] Log error:", err);
  }
}
