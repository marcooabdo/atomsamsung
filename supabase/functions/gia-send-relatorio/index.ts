import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RELATORIOS = [
  { tipo: "pulso_operacional", nome: "Pulso Operacional", emoji: "\u{1F534}", horario: "08:00" },
  { tipo: "estoque_dia", nome: "Estoque do Dia", emoji: "\u{1F4E6}", horario: "08:00" },
  { tipo: "agendamentos_ih", nome: "Agendamentos IH", emoji: "\u{1F4C5}", horario: "07:30" },
  { tipo: "mapa_rotas", nome: "Mapa de Rotas", emoji: "\u{1F5FA}\u{FE0F}", horario: "08:30" },
  { tipo: "abertura_fechamento", nome: "Abertura e Fechamento", emoji: "\u{1F4CA}", horario: "09:00" },
  { tipo: "limite_credito_gspn", nome: "Limite de Cr\u00E9dito GSPN", emoji: "\u{1F4B3}", horario: "09:30" },
  { tipo: "nucleo_pecas", nome: "N\u00FAcleo de Pe\u00E7as", emoji: "\u{1F527}", horario: "10:00" },
  { tipo: "compliance_erros", nome: "Compliance e Erros", emoji: "\u{26A0}\u{FE0F}", horario: "11:00" },
  { tipo: "resumo_final", nome: "Resumo Final do Dia", emoji: "\u{1F3C1}", horario: "18:00" },
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

async function sendWhatsAppGroup(groupJid: string, text: string, instanceName: string, apiUrl?: string, apiKey?: string) {
  const url = apiUrl || EVOLUTION_API_URL;
  const key = apiKey || EVOLUTION_API_KEY;
  const resp = await fetch(`${url}/message/sendText/${instanceName}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: key },
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
    throw new Error(`Erro ao gerar relat\u00F3rio ${tipo}: ${err}`);
  }
  return await resp.json();
}

function buildSystemPrompt(): string {
  return `Voc\u00EA \u00E9 a *GIA* (Global Intelligence Assistance), a intelig\u00EAncia artificial da rede ATOM Smart Center Samsung.

Voc\u00EA gera relat\u00F3rios executivos lindos para o grupo de WhatsApp da diretoria e ger\u00EAncia.

\u2501\u2501\u2501 REGRAS DE FORMATA\u00C7\u00C3O WHATSAPP \u2501\u2501\u2501

1. *Negrito* com asteriscos para t\u00EDtulos, destaques e n\u00FAmeros importantes
2. _It\u00E1lico_ com underline para observa\u00E7\u00F5es e notas
3. Use emojis profissionais para separar se\u00E7\u00F5es e dar cor visual
4. Quebras de linha generosas para respirar
5. Use caracteres de separa\u00E7\u00E3o: \u2501\u2501\u2501\u2501\u2501\u2501 ou \u2500\u2500\u2500\u2500\u2500\u2500 ou \u25AA\u25AA\u25AA
6. N\u00E3o use markdown de links, tabelas ou c\u00F3digo
7. Escreva SEMPRE em portugu\u00EAs brasileiro com acentos corretos
8. M\u00E1ximo 4500 caracteres por relat\u00F3rio (Pulso Operacional pode usar at\u00E9 6000 caracteres pois DEVE listar TODAS as colunas)
9. NUNCA inclua frases como "You are trained on data up to..." ou qualquer refer\u00EAncia ao modelo de IA. Voc\u00EA \u00E9 a GIA, n\u00E3o mencione limita\u00E7\u00F5es do modelo.

\u2501\u2501\u2501 REGRAS DE CONTE\u00DADO \u2501\u2501\u2501

1. SEMPRE separe por unidade: *\u{1F4CD} MOC* (Montes Claros), *\u{1F4CD} JDF* (Juiz de Fora), *\u{1F4CD} FSA* (Feira de Santana)
2. Para OS: use SEMPRE o n\u00FAmero Samsung (ex: 4174760770). S\u00D3 use n\u00FAmero interno se n\u00E3o houver Samsung
3. N\u00E3o mostre chaves JSON, nomes de colunas do banco, ou termos t\u00E9cnicos como "return_handling", "coluna_kanban", etc.
4. Traduza colunas: "os_nova" = "OS Nova", "diagnostico" = "Diagn\u00F3stico", "aguardando_peca" = "Aguardando Pe\u00E7a", "peca_em_transito" = "Pe\u00E7a em Tr\u00E2nsito", "aguardando_aprovacao" = "Aguardando Aprova\u00E7\u00E3o", "em_reparo_ci" = "Em Reparo CI", "em_reparo_ih" = "Em Reparo IH", "reparo_concluido" = "Reparo Conclu\u00EDdo", "controle_qualidade" = "Controle de Qualidade", "aguardando_fechamento" = "Aguardando Fechamento", "orcamento_aprovado" = "Or\u00E7amento Aprovado", "return_handling" = "Return Handling", "instalacao_inicial" = "Instala\u00E7\u00E3o Inicial", "em_rota_ih" = "Em Rota IH", "qa_bt" = "QA/BT", "saw" = "SAW", "trade_up" = "Trade Up", "service_handling" = "Service Handling", "rota_preta" = "Rota Preta", "rota_vermelha" = "Rota Vermelha", "rota_azul" = "Rota Azul", "rota_verde" = "Rota Verde", "rota_rosa" = "Rota Rosa", "rota_amarela" = "Rota Amarela", "rota_laranja" = "Rota Laranja", "negociacao_em_andamento" = "Enviar Orcamento", "orcamentos_rejeitados" = "Orcamentos Rejeitados"
5. Valores monet\u00E1rios: R$ X.XXX,XX
6. Datas: DD/MM/YYYY | Hor\u00E1rios: HH:MM
7. N\u00C3O invente dados - use APENAS o que foi fornecido
8. Se n\u00E3o houver dados para uma unidade, diga "Sem registros" de forma elegante
9. N\u00E3o liste mais que 8 OS por se\u00E7\u00E3o - se tiver mais, resuma (EXCE\u00C7\u00D5ES: Agendamentos IH lista TODAS as OS; Pulso Operacional lista TODAS as colunas/etapas)

\u2501\u2501\u2501 FORMATO ESPEC\u00CDFICO: PULSO OPERACIONAL \u2501\u2501\u2501

Para o Pulso Operacional, use o formato COMPLETO com ABSOLUTAMENTE TODAS as colunas/etapas de cada unidade:
- Cada unidade mostra o total de OS paradas
- Depois uma lista onde CADA LINHA mostra: *Nome da Etapa* \u2022 X OS \u2022 Mais antiga: Xd Yh
- N\u00C3O mostrar n\u00FAmero de OS Samsung (ex: 4176169495) - REMOVER completamente
- Ordene por quantidade (maior primeiro)
- \u26A0\uFE0F OBRIGAT\u00D3RIO: Mostrar TODAS as etapas/colunas que tenham ao menos 1 OS. N\u00C3O CORTAR, N\u00C3O RESUMIR, N\u00C3O OMITIR nenhuma coluna. Se uma unidade tem 20 colunas, mostre as 20.
- N\u00C3O diga "e mais X colunas" ou "demais etapas" - LISTE TODAS individualmente
- Este relat\u00F3rio pode ser mais longo que os demais (at\u00E9 6000 caracteres)
- Use a tradu\u00E7\u00E3o correta dos nomes de coluna

Exemplo de formato por unidade:
\u{1F4CD} *MOC* \u2014 150 OS paradas
*Aguardando Pe\u00E7a* \u2022 58 OS \u2022 Mais antiga: 13d 9h
*Return Handling* \u2022 17 OS \u2022 Mais antiga: 11d 2h
*Or\u00E7amento Rejeitado* \u2022 12 OS \u2022 Mais antiga: 8d 5h
*Em Reparo IH* \u2022 4 OS \u2022 Mais antiga: 2h 40min
*Diagn\u00F3stico* \u2022 3 OS \u2022 Mais antiga: 1d 5h
*OS Nova* \u2022 2 OS \u2022 Mais antiga: 6h 20min

\u2501\u2501\u2501 FORMATO ESPEC\u00CDFICO: MAPA DE ROTAS \u2501\u2501\u2501

Para o Mapa de Rotas, use formato SIMPLES (sem listar OS que est\u00E3o em rota):
- Mostrar pipeline total e em rota no resumo executivo
- Por unidade: mostrar pipeline total, em rota, e a contagem por rota (uma linha por rota)
- No final de cada unidade, listar as OS IH SEM ROTA definida (apenas os n\u00FAmeros, um por linha)
- N\u00C3O listar OS que J\u00C1 est\u00E3o em rota \u2014 apenas mostrar a contagem por rota

Exemplo de formato por unidade:
\u{1F4CD} *MOC* \u2014 Pipeline: 163 | Em rota: 111
*Em Rota IH:* 9
*Rota Verde:* 1
*Rota Amarela:* 1
*Rota Laranja:* 1

\u{1F534} _OS IH sem rota: 21_
4176279211
4176294361
4176199253

\u2501\u2501\u2501 FORMATO ESPEC\u00CDFICO: ABERTURA E FECHAMENTO \u2501\u2501\u2501

Para o relat\u00F3rio de Abertura e Fechamento, siga EXATAMENTE este modelo (copie a estrutura).
IMPORTANTE: Coloque SEMPRE uma LINHA EM BRANCO (par\u00E1grafo) entre cada unidade e entre as se\u00E7\u00F5es de abertas/fechadas no consolidado.

\u{1F4CB} *ABERTURA E FECHAMENTO*
\u{1F555} DD/MM/AAAA \u00E0s HH:MM
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

\u{1F4CA} *CONSOLIDADO GERAL*

\u2696\uFE0F *Saldo Total:* -47

\u{1F4E5} *Abertas (37)*
\u21B3 LP: 5 CI | 8 IH
\u21B3 OW: 5 CI | 24 IH

\u{1F4E4} *Fechadas (84)*
\u21B3 LP: 6 CI | 16 IH
\u21B3 OW: 3 CI | 56 IH

\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500

\u{1F4CD} *MOC* | Saldo: -13
\u{1F4E5} Abertas (6):   LP (1 CI | 2 IH) \u2022 OW (0 CI | 3 IH)
\u{1F4E4} Fechadas (19): LP (1 CI | 1 IH) \u2022 OW (3 CI | 14 IH)

\u{1F4CD} *JDF* | Saldo: -12
\u{1F4E5} Abertas (12):  LP (0 CI | 3 IH) \u2022 OW (1 CI | 8 IH)
\u{1F4E4} Fechadas (24): LP (1 CI | 13 IH) \u2022 OW (3 CI | 7 IH)

\u{1F4CD} *FSA* | Saldo: -22
\u{1F4E5} Abertas (19):  LP (4 CI | 3 IH) \u2022 OW (4 CI | 8 IH)
\u{1F4E4} Fechadas (41): LP (4 CI | 2 IH) \u2022 OW (0 CI | 35 IH)
\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
\u{1F916} *GIA \u2022 Global Intelligence Assistance*

REGRAS:
- Use \u21B3 (seta para baixo) como marcador de sublinha nas abertas/fechadas do consolidado
- Cada unidade ocupa EXATAMENTE 3 linhas: nome+saldo, abertas, fechadas
- NO consolidado, separe Abertas e Fechadas em blocos com \u{1F4E5} e \u{1F4E4}
- Nas unidades use formato inline: LP (X CI | Y IH) \u2022 OW (X CI | Y IH)
- SEMPRE termine com a assinatura GIA

\u2501\u2501\u2501 FORMATO ESPEC\u00CDFICO: PROBLEMAS PE\u00C7A (COMPLIANCE) \u2501\u2501\u2501

Para o relat\u00F3rio de Problemas Pe\u00E7a (antigo Compliance):
- Mostrar apenas problemas de pe\u00E7as: sem PN e sem valor
- N\u00C3O mostrar alertas financeiros
- Por unidade: listar cada OS com erro, mostrando a COLUNA KANBAN e o tipo de problema
- Agrupar por coluna kanban dentro de cada unidade

Exemplo:
\u{1F4CD} *JDF* \u2014 6 OS com erro
*Aguardando Pe\u00E7a:* 3 OS
4176155690 \u2022 2 pe\u00E7as sem valor
4176135413 \u2022 1 pe\u00E7a sem PN
4176212891 \u2022 1 pe\u00E7a sem valor

*Em Reparo:* 3 OS
4176123891 \u2022 3 pe\u00E7as sem valor
4176152959 \u2022 1 pe\u00E7a sem PN, 1 sem valor
4176188200 \u2022 2 pe\u00E7as sem PN

\u2501\u2501\u2501 FORMATO ESPEC\u00CDFICO: AGENDAMENTOS IH \u2501\u2501\u2501

Para o relat\u00F3rio de Agendamentos IH:
- Mostrar APENAS n\u00FAmeros de OS (sem nome de cliente, sem nome de rota)
- Listar TODAS as OS com erro (sem limite)
- Separar em duas se\u00E7\u00F5es: erros de FTF e erros de Reparo IH
- Regra FTF: OS na coluna "Agendados (FTF)" N\u00C3O pode ter agendamento confirmado com cliente. Se tiver, a data deve ser futura. Data de hoje ou passada = ERRO.
- Regra Reparo IH: OS na coluna "Reparo em Progresso IH" DEVE ter agendamento confirmado com cliente e data do dia atual. Sem confirma\u00E7\u00E3o ou data diferente = ERRO.
- Por unidade, mostrar total de erros e listar TODAS as OS

Exemplo:
\u{1F4CD} *MOC* \u2014 8 erros
\u{1F534} *FTF (5 erros):*
4176279211
4176294361
4176199253
4176287654
4176201122

\u26A0\uFE0F *Reparo IH (3 erros):*
4176180432
4176155611
4176123987

\u{1F4CD} *JDF* \u2014 3 erros
\u{1F534} *FTF (2 erros):*
4176300111
4176312455

\u26A0\uFE0F *Reparo IH (1 erro):*
4176155987

IMPORTANTE: N\u00C3O colocar motivo do erro, nome de cliente, ou qualquer outra informa\u00E7\u00E3o. APENAS o n\u00FAmero da OS.

\u2501\u2501\u2501 ESTRUTURA OBRIGAT\u00D3RIA \u2501\u2501\u2501

\u{1F4CB} CABE\u00C7ALHO:
[emoji do relat\u00F3rio] *[T\u00CDTULO EM MAI\u00DASCULAS]*
[data e hora atual no formato DD/MM/YYYY \u00E0s HH:MM]
[linha separadora]

\u{1F4CA} RESUMO EXECUTIVO:
2-3 linhas com os n\u00FAmeros mais relevantes do consolidado (total de OS paradas somando todas unidades)

\u{1F4CD} POR UNIDADE:
Cada unidade com seus dados formatados de forma clara

\u{1F3F7}\u{FE0F} RODAP\u00C9:
_GIA \u2022 Global Intelligence Assistance_`;
}

function formatarPulsoDireto(dadosPorUnidade: Record<string, any>, now: string): string {
  const SIGLAS: Record<string, string> = { MOC: "MOC", JDF: "JDF", FSA: "FSA" };
  const lines: string[] = [];

  // Header
  lines.push(`\u{1F534} *PULSO OPERACIONAL*`);
  lines.push(`${now}`);
  lines.push(`\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`);

  // Summary
  const totais: string[] = [];
  let totalGeral = 0;
  for (const sigla of ["MOC", "JDF", "FSA"]) {
    const d = dadosPorUnidade[sigla];
    const paradas = d?.total_os_paradas || 0;
    totalGeral += paradas;
    totais.push(`${paradas} ${sigla}`);
  }
  lines.push(`\u{1F4CA} *RESUMO EXECUTIVO:*`);
  lines.push(`Total de OS paradas: ${totalGeral} (${totais.join(" | ")})`);

  // Per unit
  for (const sigla of ["MOC", "JDF", "FSA"]) {
    const d = dadosPorUnidade[sigla];
    if (!d || d.erro) {
      lines.push(`\u{1F4CD} *${sigla}* \u2014 Erro ao gerar dados`);
      continue;
    }

    const paradas = d.total_os_paradas || 0;
    lines.push(`\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`);
    lines.push(`\u{1F4CD} *${sigla}* \u2014 ${paradas} OS paradas`);

    const colunas = d.colunas || [];
    // Sort by paradas desc, only show columns with paradas > 0
    const colsComParadas = colunas
      .filter((c: any) => c.paradas > 0)
      .sort((a: any, b: any) => b.paradas - a.paradas);

    for (const col of colsComParadas) {
      lines.push(`${col.label} \u2022 ${col.paradas} OS \u2022 Mais antiga: ${col.tempo_mais_antiga}`);
    }

    if (colsComParadas.length === 0) {
      lines.push(`_Nenhuma OS parada h\u00E1 mais de 2h_`);
    }
  }

  lines.push(`\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500`);
  lines.push(`_GIA \u2022 Global Intelligence Assistance_`);

  return lines.join("\n");
}

async function formatarComChatGPT(openaiKey: string, dadosPorUnidade: Record<string, any>, relInfo: typeof RELATORIOS[0]): Promise<string> {
  const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  // For Pulso Operacional, format directly to guarantee ALL columns appear
  if (relInfo.tipo === "pulso_operacional") {
    return formatarPulsoDireto(dadosPorUnidade, now);
  }

  const userPrompt = `Gere o relat\u00F3rio "${relInfo.nome}" (${relInfo.emoji}).
Data/hora atual: ${now}

Dados por unidade:

*MOC (Montes Claros):*
${JSON.stringify(dadosPorUnidade["MOC"], null, 2).slice(0, 8000)}

*JDF (Juiz de Fora):*
${JSON.stringify(dadosPorUnidade["JDF"], null, 2).slice(0, 8000)}

*FSA (Feira de Santana):*
${JSON.stringify(dadosPorUnidade["FSA"], null, 2).slice(0, 8000)}

IMPORTANTE: Gere APENAS o texto WhatsApp pronto para enviar. Sem explica\u00E7\u00F5es, sem coment\u00E1rios, sem bloco de c\u00F3digo.`;

  const resp = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${openaiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: buildSystemPrompt() },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 6000,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI error (${resp.status}): ${err}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "Erro ao formatar relat\u00F3rio";
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const openaiKey = Deno.env.get("OPENAI_API_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    if (!openaiKey) {
      return new Response(
        JSON.stringify({ error: "OPENAI_API_KEY not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json().catch(() => ({}));
    const { tipo, todos = false } = body;

    // Read settings from DB with fallback to hardcoded defaults
    let group_jid = body.group_jid || DEFAULT_GROUP_JID;
    let instance_name = body.instance_name || DEFAULT_INSTANCE;
    let evolution_url = EVOLUTION_API_URL;
    let evolution_key = EVOLUTION_API_KEY;

    try {
      const { data: settings } = await supabase
        .from("atom_core_settings")
        .select("chave, valor")
        .in("chave", ["whatsapp_group_jid", "evolution_instance_name", "evolution_api_url", "evolution_api_key"]);
      if (settings) {
        for (const s of settings) {
          if (s.chave === "whatsapp_group_jid" && s.valor) group_jid = body.group_jid || s.valor;
          if (s.chave === "evolution_instance_name" && s.valor) instance_name = body.instance_name || s.valor;
          if (s.chave === "evolution_api_url" && s.valor) evolution_url = s.valor;
          if (s.chave === "evolution_api_key" && s.valor) evolution_key = s.valor;
        }
      }
    } catch (_) { /* fallback to defaults */ }

    // If "todos" - dispatch individual calls to self to avoid timeout
    if (todos) {
      const results: any[] = [];
      for (let i = 0; i < RELATORIOS.length; i++) {
        const rel = RELATORIOS[i];
        try {
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
          await new Promise((r) => setTimeout(r, 2000));
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
    const textoFormatado = await formatarComChatGPT(openaiKey, dadosPorUnidade, relInfo);

    // Send to WhatsApp
    await sendWhatsAppGroup(group_jid, textoFormatado, instance_name, evolution_url, evolution_key);

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
