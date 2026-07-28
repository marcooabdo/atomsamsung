import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);
// Grupo padrão caso não tenha grupo_destino configurado
const DEFAULT_GROUP = "120363427351181397@g.us"; // 🚀 Task Force ATOM | GG

async function getGIAEvolutionConfig(): Promise<{ api_url: string; api_key: string; instance_name: string }> {
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
    throw new Error("Configuração Evolution API incompleta em system_secrets (ATOM CORE)");
  }

  return { api_url, api_key, instance_name };
}

async function sendWhatsAppGroup(groupJid: string, message: string) {
  const config = await getGIAEvolutionConfig();
  
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
    throw new Error(`Evolution API error (${config.instance_name}): ${response.status} - ${errText}`);
  }

  return await response.json();
}

async function sendWhatsAppImage(groupJid: string, imageUrl: string, caption?: string) {
  const config = await getGIAEvolutionConfig();

  const response = await fetch(`${config.api_url}/message/sendMedia/${config.instance_name}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": config.api_key,
    },
    body: JSON.stringify({
      number: groupJid,
      mediatype: "image",
      media: imageUrl,
      caption: caption || "",
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Evolution API sendMedia error (${config.instance_name}): ${response.status} - ${errText}`);
  }

  return await response.json();
}

async function generateMotivacionalOperacional(): Promise<string> {
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  if (!openaiKey) throw new Error("OPENAI_API_KEY não configurada");

  const hoje = new Date();
  const diasSemana = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
  const diaSemana = diasSemana[hoje.getDay()];
  const dataFormatada = hoje.toLocaleDateString("pt-BR");
  const seed = `${hoje.getFullYear()}-${hoje.getMonth()}-${hoje.getDate()}`;

  const systemPrompt = `Você é um Líder Inspirador e Estrategista de Operações.
Sua missão é gerar uma mensagem motivacional longa, profunda e DIFERENTE a cada dia para ser enviada para a equipe Operacional e Administrativa (Centralização ATOM) de uma assistência técnica autorizada Samsung (Group Global).

Contexto da Equipe:
Esta equipe é responsável pelo "coração" da empresa: atendimento ao cliente, triagem de defeitos, roteirização de técnicos (logística), tratativas com a fábrica, laboratório e fechamento de Ordens de Serviço (OS). Os dias são intensos, cheios de imprevistos, clientes exigentes e SLAs (prazos) curtos. A empresa tem unidades em Feira de Santana, Juiz de Fora e Montes Claros.

Diretrizes:
- Tom: Empático, enérgico, encorajador e realista. Não use positividade tóxica; reconheça que o trabalho é duro e desafiador, mas reforce que o esforço está construindo um futuro melhor e mais organizado.
- Foco: Importância da organização, comunicação entre áreas (engrenagem perfeita), foco na solução e não no problema. Mostre que o trabalho impacta diretamente a vida dos clientes e o sucesso da empresa.
- Variedade: Use uma abordagem DIFERENTE a cada dia. Pode ser metáfora sobre esportes/competição, construção de uma máquina perfeita, reflexão filosófica sobre resiliência, analogia com música/orquestra, F1, aviação, exploração espacial, etc. NUNCA repita a mesma metáfora em dias seguidos.
- Formatação: WhatsApp. Parágrafos curtos, espaçamento adequado, emojis de forma estratégica (sem exagerar), negrito com *asteriscos*.
- Fechamento: Termine com uma frase de impacto desejando um dia produtivo e excelente, e assine como "GIA • Diretoria Group Global".
- Comprimento: Entre 800 e 1200 caracteres. Nem curto demais, nem longo demais para WhatsApp.

IMPORTANTE: Gere APENAS o texto da mensagem, sem markdown extra, sem explicações. O texto será enviado diretamente no WhatsApp.`;

  const userPrompt = `Hoje é ${diaSemana}, ${dataFormatada}. Seed para variação: ${seed}. Gere a mensagem motivacional de hoje para a equipe.`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.9,
      max_tokens: 1000,
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} - ${errText}`);
  }

  const result = await response.json();
  return result.choices[0]?.message?.content || "Bom dia, equipe! Vamos com tudo hoje! 🚀\n\nGIA • Diretoria Group Global";
}

async function generateReport(tipo: string): Promise<string> {
  // Motivacional usa OpenAI diretamente (não existe em gia-relatorio)
  if (tipo === "motivacional_operacional") {
    return await generateMotivacionalOperacional();
  }

  // Todos os outros tipos: chamar gia-relatorio que tem a lógica completa
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const response = await fetch(`${supabaseUrl}/functions/v1/gia-relatorio`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({ tipo }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`gia-relatorio retornou erro (${response.status}): ${errText}`);
  }

  const data = await response.json();
  
  const text = data.resumo_texto || data.mensagem || data.message;
  if (!text) {
    throw new Error(`Resposta de gia-relatorio sem conteúdo de texto para tipo: ${tipo}`);
  }

  return text;
}

async function generateLimiteCreditoImage(): Promise<{ success: boolean; image_url?: string; horario?: string; global?: { percentual: number } }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const response = await fetch(`${supabaseUrl}/functions/v1/gia-relatorio-image`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({ tipo: "limite_credito_gspn" }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`gia-relatorio-image (limite_credito) erro (${response.status}): ${errText}`);
  }

  return await response.json();
}

async function generateAberturaFechamentoImage(): Promise<{ success: boolean; image_url?: string; horario?: string; totais?: { abertas: number; fechadas: number; saldo: number } }> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const response = await fetch(`${supabaseUrl}/functions/v1/gia-relatorio-image`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({ tipo: "abertura_fechamento" }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`gia-relatorio-image (abertura_fechamento) erro (${response.status}): ${errText}`);
  }

  return await response.json();
}

async function generateAndSendPulsoImages(targetGroup: string): Promise<string[]> {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const response = await fetch(`${supabaseUrl}/functions/v1/gia-relatorio-image`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${supabaseServiceKey}`,
    },
    body: JSON.stringify({}),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`gia-relatorio-image erro (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const results: string[] = [];

  if (data.images && data.images.length > 0) {
    for (let i = 0; i < data.images.length; i++) {
      const img = data.images[i];
      const unit = data.units?.[i];
      const caption = i === 0
        ? `🔴 PULSO OPERACIONAL — ${data.horario}\n${data.total_os} OS abertas no total`
        : "";
      
      try {
        await sendWhatsAppImage(targetGroup, img.url, caption);
        results.push(`Imagem ${img.sigla}: OK`);
        if (i < data.images.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1500));
        }
      } catch (e) {
        results.push(`Imagem ${img.sigla}: ERRO - ${e.message}`);
      }
    }
  }

  return results;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { tipo, group_jid, todos } = body;

    // Se "todos" flag, enviar todos os relatórios ativos
    if (todos) {
      const { data: allConfigs } = await supabase
        .from("gia_relatorios_config")
        .select("*")
        .eq("ativo", true)
        .not("tipo", "eq", "motivacional_operacional");

      const targetGroup = group_jid || DEFAULT_GROUP;
      const results: string[] = [];

      for (const config of allConfigs || []) {
        try {
          // Para pulso_operacional, usar envio visual com imagens
          if (config.tipo === "pulso_operacional") {
            const sendGroup = config.grupo_destino || targetGroup;
            const imageResults = await generateAndSendPulsoImages(sendGroup);
            await new Promise(resolve => setTimeout(resolve, 2000));
            const message = await generateReport(config.tipo);
            await sendWhatsAppGroup(sendGroup, message);
            results.push(`${config.nome}: OK (${imageResults.length} imagens + texto)`);
            await new Promise(resolve => setTimeout(resolve, 2000));
            continue;
          }
          
          const sendGroup = config.grupo_destino || targetGroup;
          const message = await generateReport(config.tipo);
          await sendWhatsAppGroup(sendGroup, message);
          results.push(`${config.nome}: OK`);
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (e) {
          results.push(`${config.nome}: ERRO - ${e.message}`);
        }
      }

      return new Response(
        JSON.stringify({ success: true, results }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!tipo) {
      return new Response(
        JSON.stringify({ error: "Campo 'tipo' é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar configuração do relatório incluindo grupo_destino
    const { data: config } = await supabase
      .from("gia_relatorios_config")
      .select("*")
      .eq("tipo", tipo)
      .maybeSingle();

    if (!config || !config.ativo) {
      return new Response(
        JSON.stringify({ error: `Relatório '${tipo}' não encontrado ou desativado` }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Prioridade: group_jid do request (on-demand) > grupo_destino da config > grupo padrão
    const targetGroup = group_jid || config.grupo_destino || DEFAULT_GROUP;

    // Para controle_lp_prazo, relatorio_km, sla_atom_connect e validacao_ow, enviar uma mensagem separada por unidade
    if (tipo === "controle_lp_prazo" || tipo === "relatorio_km" || tipo === "sla_atom_connect" || tipo === "validacao_ow") {
      try {
        // For relatorio_km, first send visual images per unit
        if (tipo === "relatorio_km") {
          try {
            const imgResponse = await fetch(`${supabaseUrl}/functions/v1/gia-relatorio-image`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${supabaseKey}`,
              },
              body: JSON.stringify({ tipo: "dinheiro_na_mesa" }),
            });

            if (imgResponse.ok) {
              const imgData = await imgResponse.json();
              if (imgData.images && imgData.images.length > 0) {
                for (let i = 0; i < imgData.images.length; i++) {
                  const img = imgData.images[i];
                  await sendWhatsAppImage(targetGroup, img.url, "");
                  if (i < imgData.images.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                  }
                }
                await new Promise(resolve => setTimeout(resolve, 2000));
              }
            }
          } catch (imgErr) {
            console.error("Erro ao enviar imagens dinheiro_na_mesa:", imgErr.message);
          }
        }

        const response = await fetch(`${supabaseUrl}/functions/v1/gia-relatorio`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${supabaseKey}`,
          },
          body: JSON.stringify({ tipo }),
        });

        if (!response.ok) {
          const errText = await response.text();
          throw new Error(`gia-relatorio LP erro (${response.status}): ${errText}`);
        }

        const data = await response.json();
        const mensagens: string[] = data.mensagens_por_unidade || [];

        if (mensagens.length === 0) {
          const fallbackMsg = data.resumo_texto || data.mensagem || "Nenhuma OS LP encontrada.";
          await sendWhatsAppGroup(targetGroup, fallbackMsg);
        } else {
          for (let i = 0; i < mensagens.length; i++) {
            await sendWhatsAppGroup(targetGroup, mensagens[i]);
            if (i < mensagens.length - 1) {
              await new Promise(resolve => setTimeout(resolve, 1500));
            }
          }
        }

        await supabase.from("gia_relatorio_logs").insert({
          tipo,
          nome: config.nome,
          status: "sucesso",
          etapa: "envio_completo",
          mensagem: `LP enviado em ${mensagens.length} mensagens separadas para ${targetGroup}`,
          grupo_jid: targetGroup,
          instancia: "Marco",
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            tipo, 
            grupo_destino: targetGroup,
            mensagens_enviadas: mensagens.length,
            message: `LP enviado em ${mensagens.length} mensagens (1 por unidade)` 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (lpErr) {
        console.error("Erro LP separado, tentando texto único:", lpErr.message);
        // Fallback: enviar como texto normal (cai no fluxo padrão abaixo)
      }
    }

    // Para pulso_operacional, enviar imagens visuais por unidade
    if (tipo === "pulso_operacional") {
      try {
        const imageResults = await generateAndSendPulsoImages(targetGroup);
        
        // Enviar também um texto resumo breve após as imagens
        await new Promise(resolve => setTimeout(resolve, 2000));
        const message = await generateReport(tipo);
        await sendWhatsAppGroup(targetGroup, message);
        
        await supabase.from("gia_relatorio_logs").insert({
          tipo,
          nome: config.nome,
          status: "sucesso",
          etapa: "envio_completo",
          mensagem: `Pulso visual enviado (${imageResults.length} imagens + texto) para ${targetGroup}`,
          grupo_jid: targetGroup,
          instancia: "Marco",
        });

        return new Response(
          JSON.stringify({ 
            success: true, 
            tipo, 
            grupo_destino: targetGroup,
            images: imageResults,
            message: `Pulso visual enviado com ${imageResults.length} imagens` 
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } catch (imageErr) {
        console.error("Erro ao gerar imagens do pulso, enviando texto:", imageErr.message);
        // Fallback: enviar como texto normal
      }
    }

    // Para limite_credito_gspn, enviar imagem + texto
    if (tipo === "limite_credito_gspn") {
      try {
        const imgResult = await generateLimiteCreditoImage();
        if (imgResult.success && imgResult.image_url) {
          const caption = `💳 LIMITE DE CRÉDITO GSPN — ${imgResult.horario}\nUso global: ${imgResult.global?.percentual}%`;
          await sendWhatsAppImage(targetGroup, imgResult.image_url, caption);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (imgErr) {
        console.error("Erro ao gerar imagem limite crédito, enviando apenas texto:", imgErr.message);
      }
    }

    // Para abertura_fechamento, enviar imagem + texto
    if (tipo === "abertura_fechamento") {
      try {
        const imgResult = await generateAberturaFechamentoImage();
        if (imgResult.success && imgResult.image_url) {
          const saldoStr = (imgResult.totais?.saldo ?? 0) >= 0 ? `+${imgResult.totais?.saldo}` : `${imgResult.totais?.saldo}`;
          const caption = `📋 ABERTURA & FECHAMENTO — ${imgResult.horario}\nSaldo: ${saldoStr} | ${imgResult.totais?.abertas || 0} abertas • ${imgResult.totais?.fechadas || 0} fechadas`;
          await sendWhatsAppImage(targetGroup, imgResult.image_url, caption);
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (imgErr) {
        console.error("Erro ao gerar imagem abertura/fechamento, enviando apenas texto:", imgErr.message);
      }
    }

    // Gerar o relatório (texto)
    const message = await generateReport(tipo);

    // Enviar para o grupo correto usando instância Marco (ATOM CORE)
    await sendWhatsAppGroup(targetGroup, message);

    // Registrar no log
    await supabase.from("gia_relatorio_logs").insert({
      tipo,
      nome: config.nome,
      status: "sucesso",
      etapa: "envio_completo",
      mensagem: `Relatório enviado com sucesso para ${targetGroup}`,
      grupo_jid: targetGroup,
      instancia: "Marco",
    });

    return new Response(
      JSON.stringify({ 
        success: true, 
        tipo, 
        grupo_destino: targetGroup,
        message: `Relatório ${config.nome} enviado para ${targetGroup}` 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    // Log error
    await supabase.from("gia_relatorio_logs").insert({
      tipo: "erro",
      nome: "Erro no envio",
      status: "erro",
      etapa: "execucao",
      mensagem: err.message,
    }).catch(() => {});

    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
