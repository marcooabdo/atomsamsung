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

const EVOLUTION_API_URL = "https://atom-evolution-api.2vhnbz.easypanel.host";
const EVOLUTION_API_KEY = "Novasenha2026";
const DEFAULT_INSTANCE = "fsa";

// Grupo padrão caso não tenha grupo_destino configurado
const DEFAULT_GROUP = "120363405875636701@g.us"; // ATOM - GROUP GLOBAL

async function sendWhatsAppGroup(groupJid: string, message: string, instanceName: string = DEFAULT_INSTANCE) {
  const response = await fetch(`${EVOLUTION_API_URL}/message/sendText/${instanceName}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": EVOLUTION_API_KEY,
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

async function generateEstoqueDia(): Promise<string> {
  const { data: pecas } = await supabase
    .from("pecas")
    .select("id, status, unidade_id")
    .in("status", ["em_estoque", "disponivel", "reservada", "aguardando_retirada"]);

  const { data: unidades } = await supabase
    .from("unidades")
    .select("id, nome");

  const unidadeMap = new Map(unidades?.map(u => [u.id, u.nome]) || []);

  const counts: Record<string, Record<string, number>> = {};
  for (const peca of pecas || []) {
    const unidadeNome = unidadeMap.get(peca.unidade_id) || "Sem unidade";
    if (!counts[unidadeNome]) counts[unidadeNome] = {};
    counts[unidadeNome][peca.status] = (counts[unidadeNome][peca.status] || 0) + 1;
  }

  const hoje = new Date().toLocaleDateString("pt-BR");
  let msg = `📦 *ESTOQUE DO DIA - ${hoje}*\n\n`;

  let totalGeral = 0;
  for (const [unidade, statusCounts] of Object.entries(counts).sort()) {
    const total = Object.values(statusCounts).reduce((a, b) => a + b, 0);
    totalGeral += total;
    msg += `🏢 *${unidade}*\n`;
    if (statusCounts["em_estoque"]) msg += `• Em estoque: ${statusCounts["em_estoque"]}\n`;
    if (statusCounts["disponivel"]) msg += `• Disponível: ${statusCounts["disponivel"]}\n`;
    if (statusCounts["reservada"]) msg += `• Reservada: ${statusCounts["reservada"]}\n`;
    if (statusCounts["aguardando_retirada"]) msg += `• Aguardando retirada: ${statusCounts["aguardando_retirada"]}\n`;
    msg += `• Total: ${total}\n\n`;
  }

  msg += `━━━━━━━━━━━━━━━\n📈 *Total Geral: ${totalGeral} peças*\n━━━━━━━━━━━━━━━\n\n_GIA - Gestora de Inteligência Artificial_`;

  return msg;
}

async function generatePulsoOperacional(): Promise<string> {
  const hoje = new Date().toISOString().split("T")[0];
  
  const { data: osHoje } = await supabase
    .from("os")
    .select("id, coluna_kanban, unidade_id")
    .gte("created_at", hoje + "T00:00:00")
    .lte("created_at", hoje + "T23:59:59");

  const { data: unidades } = await supabase
    .from("unidades")
    .select("id, nome");

  const unidadeMap = new Map(unidades?.map(u => [u.id, u.nome]) || []);

  const counts: Record<string, { abertas: number; fechadas: number }> = {};
  for (const os of osHoje || []) {
    const nome = unidadeMap.get(os.unidade_id) || "Sem unidade";
    if (!counts[nome]) counts[nome] = { abertas: 0, fechadas: 0 };
    if (os.coluna_kanban === "fechado" || os.coluna_kanban === "concluido") {
      counts[nome].fechadas++;
    } else {
      counts[nome].abertas++;
    }
  }

  const dataFormatada = new Date().toLocaleDateString("pt-BR");
  let msg = `🔴 *PULSO OPERACIONAL - ${dataFormatada}*\n\n`;

  let totalAbertas = 0, totalFechadas = 0;
  for (const [unidade, c] of Object.entries(counts).sort()) {
    totalAbertas += c.abertas;
    totalFechadas += c.fechadas;
    msg += `🏢 *${unidade}*\n`;
    msg += `• Abertas: ${c.abertas}\n`;
    msg += `• Fechadas: ${c.fechadas}\n\n`;
  }

  msg += `━━━━━━━━━━━━━━━\n📈 *Total: ${totalAbertas + totalFechadas} OS*\n• Abertas: ${totalAbertas} | Fechadas: ${totalFechadas}\n━━━━━━━━━━━━━━━\n\n_GIA - Gestora de Inteligência Artificial_`;

  return msg;
}

async function generateAberturaFechamento(): Promise<string> {
  const { data: unidades } = await supabase
    .from("unidades")
    .select("id, nome");

  const unidadeMap = new Map(unidades?.map(u => [u.id, u.nome]) || []);

  const { count: totalAbertas } = await supabase
    .from("os")
    .select("id", { count: "exact", head: true })
    .not("coluna_kanban", "in", "(fechado,concluido)");

  const { count: totalFechadas } = await supabase
    .from("os")
    .select("id", { count: "exact", head: true })
    .in("coluna_kanban", ["fechado", "concluido"]);

  const dataFormatada = new Date().toLocaleDateString("pt-BR");
  let msg = `📊 *ABERTURA E FECHAMENTO - ${dataFormatada}*\n\n`;
  msg += `• OS Abertas (ativas): ${totalAbertas || 0}\n`;
  msg += `• OS Fechadas (concluídas): ${totalFechadas || 0}\n\n`;

  // Per unidade breakdown
  for (const unidade of (unidades || []).sort((a, b) => a.nome.localeCompare(b.nome))) {
    const { count: abertasU } = await supabase
      .from("os")
      .select("id", { count: "exact", head: true })
      .eq("unidade_id", unidade.id)
      .not("coluna_kanban", "in", "(fechado,concluido)");

    const { count: fechadasU } = await supabase
      .from("os")
      .select("id", { count: "exact", head: true })
      .eq("unidade_id", unidade.id)
      .in("coluna_kanban", ["fechado", "concluido"]);

    msg += `🏢 *${unidade.nome}*\n`;
    msg += `• Abertas: ${abertasU || 0} | Fechadas: ${fechadasU || 0}\n\n`;
  }

  msg += `━━━━━━━━━━━━━━━\n\n_GIA - Gestora de Inteligência Artificial_`;
  return msg;
}

async function generateAgendamentosIH(): Promise<string> {
  const hoje = new Date().toISOString().split("T")[0];

  const { data: agendamentos } = await supabase
    .from("agendamentos")
    .select(`
      id, data_agendamento, horario_inicio, horario_fim, status,
      os:os_id (numero_os_samsung, numero_os_interna, cliente_nome, cliente_endereco, cliente_bairro, cliente_cidade, unidade_id, tipo_atendimento),
      tecnico:tecnico_id (nome)
    `)
    .eq("data_agendamento", hoje)
    .order("horario_inicio");

  const { data: unidades } = await supabase
    .from("unidades")
    .select("id, nome");

  const unidadeMap = new Map(unidades?.map(u => [u.id, u.nome]) || []);

  const dataFormatada = new Date().toLocaleDateString("pt-BR");
  let msg = `📅 *AGENDAMENTOS DO DIA - ${dataFormatada}*\n\n`;

  const porUnidade: Record<string, any[]> = {};
  for (const ag of agendamentos || []) {
    const os = ag.os as any;
    if (!os) continue;
    const unidadeNome = unidadeMap.get(os.unidade_id) || "Sem unidade";
    if (!porUnidade[unidadeNome]) porUnidade[unidadeNome] = [];
    porUnidade[unidadeNome].push(ag);
  }

  let total = 0;
  for (const [unidade, ags] of Object.entries(porUnidade).sort()) {
    msg += `🏢 *${unidade}* (${ags.length})\n`;
    for (const ag of ags) {
      const os = ag.os as any;
      const tecnico = ag.tecnico as any;
      const horario = ag.horario_inicio?.slice(0, 5) || "?";
      msg += `  • ${horario} - ${os.cliente_nome || "S/N"} (${tecnico?.nome || "Sem técnico"})\n`;
    }
    msg += "\n";
    total += ags.length;
  }

  msg += `━━━━━━━━━━━━━━━\n📈 *Total: ${total} agendamentos*\n━━━━━━━━━━━━━━━\n\n_GIA - Gestora de Inteligência Artificial_`;
  return msg;
}

async function generateGenericReport(tipo: string): Promise<string> {
  const dataFormatada = new Date().toLocaleDateString("pt-BR");
  return `📊 *Relatório ${tipo} - ${dataFormatada}*\n\nRelatório em desenvolvimento.\n\n_GIA - Gestora de Inteligência Artificial_`;
}

async function generateReport(tipo: string): Promise<string> {
  switch (tipo) {
    case "estoque_dia":
      return await generateEstoqueDia();
    case "pulso_operacional":
      return await generatePulsoOperacional();
    case "abertura_fechamento":
      return await generateAberturaFechamento();
    case "agendamentos_ih":
      return await generateAgendamentosIH();
    default:
      return await generateGenericReport(tipo);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { tipo } = await req.json();

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

    // Usar grupo_destino da config, ou fallback para o grupo padrão
    const targetGroup = config.grupo_destino || DEFAULT_GROUP;

    // Gerar o relatório
    const message = await generateReport(tipo);

    // Enviar para o grupo correto
    await sendWhatsAppGroup(targetGroup, message);

    // Registrar no log
    await supabase.from("gia_relatorio_logs").insert({
      tipo,
      nome: config.nome,
      status: "sucesso",
      etapa: "envio_completo",
      mensagem: `Relatório enviado com sucesso para ${targetGroup}`,
      grupo_jid: targetGroup,
      instancia: DEFAULT_INSTANCE,
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
