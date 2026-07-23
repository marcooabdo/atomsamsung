import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

const COLUNA_LABELS: Record<string, string> = {
  os_nova: "OS Nova",
  diagnostico: "Diagnóstico/Triagem",
  negociacao_em_andamento: "Enviar Orçamento",
  aguardando_aprovacao: "Aguardando Aprovação",
  orcamento_aprovado: "Orçamento Aprovado",
  aguardando_peca: "Aguardando Peça",
  peca_em_transito: "Peça em Trânsito",
  em_reparo_ci: "Em Reparo CI",
  rota_preta: "Rota Preta",
  rota_vermelha: "Rota Vermelha",
  rota_azul: "Rota Azul",
  rota_verde: "Rota Verde",
  rota_rosa: "Rota Rosa",
  rota_amarela: "Rota Amarela",
  rota_laranja: "Rota Laranja",
  em_rota_ih: "Agendados (FTF)",
  em_reparo_ih: "Reparo em Progresso IH",
  instalacao_inicial: "Instalação Inicial",
  service_handling: "Service Handling",
  return_handling: "Return Handling",
  trade_up: "Trade Up",
  saw: "SAW",
  controle_qualidade: "Controle de Qualidade / OQC",
  qa_bt: "Q&A / BT",
  reparo_concluido: "Reparo Concluído",
  aguardando_fechamento: "Aguardando Fechamento",
  orcamentos_rejeitados: "Orçamentos Rejeitados",
  os_fechada: "OS Fechada",
};

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours < 24) return mins > 0 ? `${hours}h${mins}min` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

function getColunaLabel(coluna: string): string {
  return COLUNA_LABELS[coluna] || coluna.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

interface OSParada {
  id: string;
  numero_os_samsung: string | null;
  numero_os_interna: string | null;
  cliente_nome: string | null;
  coluna_kanban: string;
  coluna_kanban_desde: string;
  tipo_os: string | null;
  minutos_parada: number;
}

const TODAS_COLUNAS_KANBAN = [
  "os_nova",
  "diagnostico",
  "negociacao_em_andamento",
  "aguardando_aprovacao",
  "orcamento_aprovado",
  "aguardando_peca",
  "peca_em_transito",
  "em_reparo_ci",
  "rota_preta",
  "rota_vermelha",
  "rota_azul",
  "rota_verde",
  "rota_rosa",
  "rota_amarela",
  "rota_laranja",
  "em_rota_ih",
  "em_reparo_ih",
  "instalacao_inicial",
  "service_handling",
  "return_handling",
  "trade_up",
  "saw",
  "controle_qualidade",
  "qa_bt",
  "reparo_concluido",
  "aguardando_fechamento",
  "orcamentos_rejeitados",
];

async function gerarPulsoOperacional(supabase: ReturnType<typeof createClient>, unidadeId?: string) {
  const now = new Date();

  // Fetch unidades for grouping
  const { data: unidades } = await supabase.from("unidades").select("id, nome");
  const unidadeMap: Record<string, string> = {};
  const unidadeShort: Record<string, string> = {};
  if (unidades) {
    for (const u of unidades) {
      unidadeMap[u.id] = u.nome;
      const nome = (u.nome || "").toLowerCase();
      if (nome.includes("montes claros")) unidadeShort[u.id] = "MOC";
      else if (nome.includes("juiz de fora")) unidadeShort[u.id] = "JDF";
      else if (nome.includes("feira de santana") || nome.includes("feira")) unidadeShort[u.id] = "FSA";
      else unidadeShort[u.id] = u.nome?.slice(0, 3)?.toUpperCase() || "???";
    }
  }

  // Fetch ALL open OS
  let baseQuery = supabase
    .from("os")
    .select("id, coluna_kanban, coluna_kanban_desde, created_at, unidade_id")
    .not("coluna_kanban", "is", null)
    .neq("coluna_kanban", "os_fechada")
    .or("arquivada.is.null,arquivada.eq.false");

  if (unidadeId) {
    baseQuery = baseQuery.eq("unidade_id", unidadeId);
  }

  const allOS: any[] = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await baseQuery.range(from, from + pageSize - 1);
    if (error) throw new Error(`Erro ao buscar OS: ${error.message}`);
    if (data && data.length > 0) {
      allOS.push(...data);
      from += pageSize;
      hasMore = data.length === pageSize;
    } else {
      hasMore = false;
    }
  }

  if (allOS.length === 0) {
    return {
      titulo: "Pipeline Completo",
      subtitulo: "Nenhuma OS aberta no momento",
      gerado_em: now.toISOString(),
      total_os: 0,
      resumo_texto: "Nenhuma OS aberta. Operação sem demandas no momento.",
    };
  }

  const totalOS = allOS.length;

  // Group OS by unidade
  const osPorUnidade: Record<string, typeof allOS> = {};
  for (const os of allOS) {
    const uid = os.unidade_id || "sem_unidade";
    if (!osPorUnidade[uid]) osPorUnidade[uid] = [];
    osPorUnidade[uid].push(os);
  }

  function formatHoursToDays(hours: number): string {
    if (hours < 24) return hours < 1 ? "<1h" : `${Math.floor(hours)}h`;
    const d = Math.floor(hours / 24);
    const h = Math.floor(hours % 24);
    return h > 0 ? `${d}d ${h}h` : `${d}d`;
  }

  // Build per-unit pipeline table text
  const unidadeSections: string[] = [];
  const sortedUnits = Object.entries(osPorUnidade)
    .filter(([uid]) => uid !== "sem_unidade")
    .sort((a, b) => b[1].length - a[1].length);

  for (const [uid, osList] of sortedUnits) {
    const sigla = unidadeShort[uid] || "???";
    const totalUnit = osList.length;

    const osPorColuna: Record<string, typeof allOS> = {};
    for (const os of osList) {
      const col = os.coluna_kanban || "sem_coluna";
      if (!osPorColuna[col]) osPorColuna[col] = [];
      osPorColuna[col].push(os);
    }

    const linhas: string[] = [];
    const allCols = [...TODAS_COLUNAS_KANBAN];
    for (const col of Object.keys(osPorColuna)) {
      if (!allCols.includes(col)) allCols.push(col);
    }

    for (const coluna of allCols) {
      const osCol = osPorColuna[coluna];
      if (!osCol || osCol.length === 0) continue;
      const label = getColunaLabel(coluna);

      let oldestOpenH = 0;
      let oldestStageH = 0;
      for (const os of osCol) {
        if (os.created_at) {
          const h = (now.getTime() - new Date(os.created_at).getTime()) / 3600000;
          if (h > oldestOpenH) oldestOpenH = h;
        }
        const sd = os.coluna_kanban_desde || os.created_at;
        if (sd) {
          const h = (now.getTime() - new Date(sd).getTime()) / 3600000;
          if (h > oldestStageH) oldestStageH = h;
        }
      }

      const openStr = oldestOpenH > 0 ? formatHoursToDays(oldestOpenH) : "—";
      const stageStr = oldestStageH > 0 ? formatHoursToDays(oldestStageH) : "—";
      linhas.push(`  ${label} • *${osCol.length}* OS • Antiga: ${openStr} • Etapa: ${stageStr}`);
    }

    unidadeSections.push(
      [`📍 *${sigla}* — ${totalUnit} OS abertas`, ...linhas].join("\n")
    );
  }

  const unidadeTotals = sortedUnits.map(([uid, osList]) => `${osList.length} ${unidadeShort[uid] || "???"}`).join(" | ");

  const resumoTexto = [
    `📊 *PIPELINE COMPLETO — CENTRAL ATOM*`,
    now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`,
    `Total: *${totalOS}* OS abertas (${unidadeTotals})`,
    `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`,
    unidadeSections.join("\n┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄\n"),
    `┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`,
    `GIA • Global Intelligence Assistance`,
  ].join("\n");

  return {
    titulo: "Pipeline Completo",
    subtitulo: `${totalOS} OS abertas`,
    gerado_em: now.toISOString(),
    horario_disparo: now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }),
    total_os: totalOS,
    resumo_texto: resumoTexto,
  };
}

async function gerarEstoqueDoDia(supabase: ReturnType<typeof createClient>, unidadeId?: string) {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const { data: unidades } = await supabase.from("unidades").select("id, nome");
  const unidadeMap: Record<string, string> = {};
  if (unidades) {
    for (const u of unidades) unidadeMap[u.id] = u.nome;
  }

  // Pecas entered today
  let queryEntradas = supabase
    .from("estoque_pecas")
    .select("id, pn, descricao, valor_com_impostos, unidade_id, data_entrada")
    .gte("data_entrada", startOfDay.toISOString());

  if (unidadeId) queryEntradas = queryEntradas.eq("unidade_id", unidadeId);

  const { data: entradasHoje, error: errEntradas } = await queryEntradas;
  if (errEntradas) throw new Error(`Erro ao buscar entradas: ${errEntradas.message}`);

  // Total stock by unit (all disponivel)
  let queryEstoque = supabase
    .from("estoque_pecas")
    .select("id, pn, valor_com_impostos, unidade_id, status")
    .eq("status", "disponivel");

  if (unidadeId) queryEstoque = queryEstoque.eq("unidade_id", unidadeId);

  const { data: estoqueTotal, error: errEstoque } = await queryEstoque;
  if (errEstoque) throw new Error(`Erro ao buscar estoque total: ${errEstoque.message}`);

  const entradas = entradasHoje || [];
  const estoque = estoqueTotal || [];

  // Entradas agrupadas por unidade
  const entradasPorUnidade: Record<string, typeof entradas> = {};
  for (const p of entradas) {
    const uid = p.unidade_id || "sem_unidade";
    if (!entradasPorUnidade[uid]) entradasPorUnidade[uid] = [];
    entradasPorUnidade[uid].push(p);
  }

  // Estoque total agrupado por unidade
  const estoquePorUnidade: Record<string, { quantidade: number; valor: number }> = {};
  for (const p of estoque) {
    const uid = p.unidade_id || "sem_unidade";
    if (!estoquePorUnidade[uid]) estoquePorUnidade[uid] = { quantidade: 0, valor: 0 };
    estoquePorUnidade[uid].quantidade++;
    estoquePorUnidade[uid].valor += Number(p.valor_com_impostos || 0);
  }

  // PNs distintos nas entradas de hoje
  const pnsHoje = new Set(entradas.map((p) => p.pn).filter(Boolean));
  const valorEntradaHoje = entradas.reduce((sum, p) => sum + Number(p.valor_com_impostos || 0), 0);

  const valorEstoqueTotal = estoque.reduce((sum, p) => sum + Number(p.valor_com_impostos || 0), 0);

  const unidadesReport = Object.entries(entradasPorUnidade)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([uid, lista]) => {
      const pnsUnidade = new Set(lista.map((p) => p.pn).filter(Boolean));
      const valorUnidade = lista.reduce((sum, p) => sum + Number(p.valor_com_impostos || 0), 0);
      const estoqueUn = estoquePorUnidade[uid] || { quantidade: 0, valor: 0 };
      return {
        unidade: unidadeMap[uid] || uid,
        entradas_hoje: {
          quantidade: lista.length,
          pns_distintos: pnsUnidade.size,
          valor_total: Math.round(valorUnidade * 100) / 100,
          top_pns: getTopPNs(lista, 5),
        },
        estoque_atual: {
          quantidade: estoqueUn.quantidade,
          valor_total: Math.round(estoqueUn.valor * 100) / 100,
        },
      };
    });

  // Unidades que nao tiveram entrada mas tem estoque
  const unidadesSemEntrada = Object.entries(estoquePorUnidade)
    .filter(([uid]) => !entradasPorUnidade[uid])
    .sort((a, b) => b[1].quantidade - a[1].quantidade)
    .map(([uid, data]) => ({
      unidade: unidadeMap[uid] || uid,
      entradas_hoje: { quantidade: 0, pns_distintos: 0, valor_total: 0, top_pns: [] },
      estoque_atual: {
        quantidade: data.quantidade,
        valor_total: Math.round(data.valor * 100) / 100,
      },
    }));

  const todasUnidades = [...unidadesReport, ...unidadesSemEntrada];

  function getSiglaEstoque(nome: string): string {
    const lower = nome.toLowerCase();
    if (lower.includes("montes claros")) return "MOC";
    if (lower.includes("juiz de fora")) return "JDF";
    if (lower.includes("feira")) return "FSA";
    return nome.slice(0, 3).toUpperCase();
  }

  const spDate = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const spHour = now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  const totalEstoqueQtd = todasUnidades.reduce((s, u) => s + u.estoque_atual.quantidade, 0);
  const totalEstoqueVal = todasUnidades.reduce((s, u) => s + u.estoque_atual.valor_total, 0);
  const totalEstoqueValFmt = totalEstoqueVal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const resumoTexto = [
    `📦 ESTOQUE DO DIA`,
    `${spDate} às ${spHour}`,
    `──────────────────`,
    ``,
    `📊 RESUMO EXECUTIVO:`,
    `Total de entradas hoje: ${entradas.length} peças | ${pnsHoje.size} PNs distintos`,
    `Estoque disponível total: ${totalEstoqueQtd} peças | Valor: ${totalEstoqueValFmt}`,
    ``,
    ...todasUnidades.map((u) => {
      const sigla = getSiglaEstoque(u.unidade);
      const valFmt = u.entradas_hoje.valor_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      const pecaStr = u.estoque_atual.quantidade === 1 ? "peça" : "peças";
      const lines = [
        `📍 ${sigla} — ${u.entradas_hoje.quantidade} peças entrada hoje (${u.entradas_hoje.pns_distintos} PNs) / Estoque: ${u.estoque_atual.quantidade} ${pecaStr}`,
        `Entradas hoje: ${u.entradas_hoje.quantidade} peças | Valor total: ${valFmt}`,
      ];
      if (u.entradas_hoje.top_pns && u.entradas_hoje.top_pns.length > 0) {
        lines.push(`Top PNs:`);
        for (const pn of u.entradas_hoje.top_pns.slice(0, 5)) {
          const pnVal = pn.valor_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
          lines.push(`- ${pn.pn} • ${pn.quantidade} unidades • ${pnVal}`);
        }
      }
      lines.push(``);
      return lines.join("\n");
    }),
    `──────────────────`,
    `GIA • Global Intelligence Assistance`,
  ].join("\n");

  return {
    titulo: "Estoque do Dia",
    subtitulo: `${entradas.length} pecas entrada hoje (${pnsHoje.size} PNs) / Estoque: ${estoque.length} pecas`,
    gerado_em: now.toISOString(),
    horario_disparo: now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }),
    periodo: "hoje",
    entradas_hoje: {
      quantidade: entradas.length,
      pns_distintos: pnsHoje.size,
      valor_total: Math.round(valorEntradaHoje * 100) / 100,
    },
    estoque_total: {
      quantidade: estoque.length,
      valor_total: Math.round(valorEstoqueTotal * 100) / 100,
    },
    por_unidade: todasUnidades,
    resumo_texto: resumoTexto,
  };
}

function getTopPNs(pecas: { pn: string | null; valor_com_impostos: number | null }[], limit: number) {
  const contagem: Record<string, { qty: number; valor: number }> = {};
  for (const p of pecas) {
    const pn = p.pn || "SEM_PN";
    if (!contagem[pn]) contagem[pn] = { qty: 0, valor: 0 };
    contagem[pn].qty++;
    contagem[pn].valor += Number(p.valor_com_impostos || 0);
  }
  return Object.entries(contagem)
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, limit)
    .map(([pn, data]) => ({ pn, quantidade: data.qty, valor: Math.round(data.valor * 100) / 100 }));
}

async function gerarResumoFinal(supabase: ReturnType<typeof createClient>, unidadeId?: string) {
  const now = new Date();
  const today = now.toISOString().split("T")[0];
  const tomorrow = new Date(now.getTime() + 86400000).toISOString().split("T")[0];

  const { data: unidades } = await supabase.from("unidades").select("id, nome");
  const unidadeMap: Record<string, string> = {};
  if (unidades) {
    for (const u of unidades) unidadeMap[u.id] = u.nome;
  }

  // OS opened today
  let queryAbertas = supabase
    .from("os")
    .select("id, numero_os_interna, unidade_id, created_at")
    .gte("created_at", `${today}T00:00:00-03:00`)
    .lt("created_at", `${tomorrow}T00:00:00-03:00`);

  if (unidadeId) queryAbertas = queryAbertas.eq("unidade_id", unidadeId);

  const { data: abertasHoje } = await queryAbertas;

  // OS closed today
  let queryFechadas = supabase
    .from("os")
    .select("id, numero_os_interna, unidade_id, created_at, updated_at")
    .eq("coluna_kanban", "os_fechada")
    .gte("updated_at", `${today}T00:00:00-03:00`)
    .lt("updated_at", `${tomorrow}T00:00:00-03:00`);

  if (unidadeId) queryFechadas = queryFechadas.eq("unidade_id", unidadeId);

  const { data: fechadasHoje } = await queryFechadas;

  // Top 5 aging per unit (oldest open OS - only CI and IH LP)
  let queryAging = supabase
    .from("os")
    .select("id, numero_os_interna, numero_os_samsung, cliente_nome, coluna_kanban, unidade_id, created_at, tipo_os, tipo_atendimento")
    .not("coluna_kanban", "in", "(os_fechada,aguardando_fechamento)")
    .in("tipo_atendimento", ["CI", "IH"])
    .order("created_at", { ascending: true })
    .limit(500);

  if (unidadeId) queryAging = queryAging.eq("unidade_id", unidadeId);

  const { data: aging } = await queryAging;

  // Filter IH to only LP
  const agingFiltered = (aging || []).filter((o) => {
    if (o.tipo_atendimento === "CI") return true;
    // IH only if LP (tipo_os or tipo_orcamento)
    const tipoOs = (o.tipo_os || "").toLowerCase();
    return tipoOs.includes("lp") || tipoOs === "lp";
  });

  // Average speed (days to close in last 30 days)
  let queryVelocidade = supabase
    .from("os")
    .select("created_at, updated_at, unidade_id")
    .eq("coluna_kanban", "os_fechada")
    .gte("updated_at", new Date(now.getTime() - 30 * 86400000).toISOString());

  if (unidadeId) queryVelocidade = queryVelocidade.eq("unidade_id", unidadeId);

  const { data: osFechadas30d } = await queryVelocidade;

  let velocidadeMedia = 0;
  if (osFechadas30d && osFechadas30d.length > 0) {
    const totalDias = osFechadas30d.reduce((sum, o) => {
      const dias = (new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()) / 86400000;
      return sum + dias;
    }, 0);
    velocidadeMedia = Math.round((totalDias / osFechadas30d.length) * 10) / 10;
  }

  // Velocity per unit
  const velPorUnidade: Record<string, { totalDias: number; count: number }> = {};
  if (osFechadas30d) {
    for (const o of osFechadas30d) {
      const uid = o.unidade_id || "sem_unidade";
      if (!velPorUnidade[uid]) velPorUnidade[uid] = { totalDias: 0, count: 0 };
      velPorUnidade[uid].totalDias += (new Date(o.updated_at).getTime() - new Date(o.created_at).getTime()) / 86400000;
      velPorUnidade[uid].count++;
    }
  }

  // Pending for tomorrow: agendamentos + OS in critical columns
  let queryAgAmanha = supabase
    .from("agendamentos")
    .select("id, os_id, tecnico_id, data_agendamento, status, confirmado_cliente, confirmado_com_cliente, unidade_id")
    .eq("data_agendamento", tomorrow)
    .in("status", ["agendado", "confirmado", "pendente_confirmacao"]);

  if (unidadeId) queryAgAmanha = queryAgAmanha.eq("unidade_id", unidadeId);

  const { data: agAmanha } = await queryAgAmanha;

  // Pending approvals
  let queryAprovacao = supabase
    .from("os")
    .select("id, unidade_id")
    .eq("coluna_kanban", "aguardando_aprovacao");

  if (unidadeId) queryAprovacao = queryAprovacao.eq("unidade_id", unidadeId);

  const { data: osAprovacao } = await queryAprovacao;

  // Pending pecas
  let queryPecas = supabase
    .from("os")
    .select("id, unidade_id")
    .eq("coluna_kanban", "aguardando_peca");

  if (unidadeId) queryPecas = queryPecas.eq("unidade_id", unidadeId);

  const { data: osPecas } = await queryPecas;

  const abertasCount = abertasHoje?.length || 0;
  const fechadasCount = fechadasHoje?.length || 0;
  const saldo = fechadasCount - abertasCount;
  const agendamentosAmanha = agAmanha?.length || 0;
  const semConfirmacao = (agAmanha || []).filter((a) => !a.confirmado_cliente && !a.confirmado_com_cliente).length;

  // Group by unidade
  const abertasPorUni: Record<string, number> = {};
  for (const o of (abertasHoje || [])) {
    const uid = o.unidade_id || "sem_unidade";
    abertasPorUni[uid] = (abertasPorUni[uid] || 0) + 1;
  }
  const fechadasPorUni: Record<string, number> = {};
  for (const o of (fechadasHoje || [])) {
    const uid = o.unidade_id || "sem_unidade";
    fechadasPorUni[uid] = (fechadasPorUni[uid] || 0) + 1;
  }

  const allUnis = new Set([...Object.keys(abertasPorUni), ...Object.keys(fechadasPorUni), ...Object.keys(velPorUnidade)]);
  const porUnidade = Array.from(allUnis).map((uid) => {
    const vel = velPorUnidade[uid];
    return {
      unidade: unidadeMap[uid] || uid,
      abertas: abertasPorUni[uid] || 0,
      fechadas: fechadasPorUni[uid] || 0,
      saldo: (fechadasPorUni[uid] || 0) - (abertasPorUni[uid] || 0),
      velocidade_media: vel ? Math.round((vel.totalDias / vel.count) * 10) / 10 : null,
    };
  }).sort((a, b) => b.fechadas - a.fechadas);

  function getSigla(nome: string): string {
    const lower = nome.toLowerCase();
    if (lower.includes("montes claros")) return "MOC";
    if (lower.includes("juiz de fora")) return "JDF";
    if (lower.includes("feira")) return "FSA";
    return nome.slice(0, 3).toUpperCase();
  }

  // Group aging by unidade - top 5 per unit
  const agingPorUnidade: Record<string, typeof agingFiltered> = {};
  for (const o of agingFiltered) {
    const uid = o.unidade_id || "sem_unidade";
    if (!agingPorUnidade[uid]) agingPorUnidade[uid] = [];
    if (agingPorUnidade[uid].length < 5) agingPorUnidade[uid].push(o);
  }

  // Group pendencias by unidade
  const aprovacaoPorUni: Record<string, number> = {};
  for (const o of (osAprovacao || [])) {
    const uid = o.unidade_id || "sem_unidade";
    aprovacaoPorUni[uid] = (aprovacaoPorUni[uid] || 0) + 1;
  }
  const pecasPorUni: Record<string, number> = {};
  for (const o of (osPecas || [])) {
    const uid = o.unidade_id || "sem_unidade";
    pecasPorUni[uid] = (pecasPorUni[uid] || 0) + 1;
  }
  const agPorUni: Record<string, number> = {};
  for (const a of (agAmanha || [])) {
    const uid = a.unidade_id || "sem_unidade";
    agPorUni[uid] = (agPorUni[uid] || 0) + 1;
  }

  const getColunaLabel = (col: string) => {
    const labels: Record<string, string> = {
      os_nova: "OS Nova", diagnostico_triagem: "Diagnóstico/Triagem",
      enviar_orcamento: "Enviar Orçamento", aguardando_aprovacao: "Aguardando Aprovação",
      orcamento_aprovado: "Orçamento Aprovado", aguardando_peca: "Aguardando Peça",
      peca_em_transito: "Peça em Trânsito", reparo_em_progresso_ih: "Reparo em Progresso IH",
      return_handling: "Return Handling", instalacao_inicial: "Instalação Inicial",
      trade_up: "Trade Up", service_handling: "Service Handling",
    };
    return labels[col] || col.split("_").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  };

  const spTime = now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const spDate = spTime.split(",")[0]?.trim() || spTime;
  const spHour = now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

  const totalAb = abertasCount;
  const totalFe = fechadasCount;
  const saldoSign = saldo >= 0 ? "+" : "";

  const lines: string[] = [
    `🏁 RESUMO FINAL DO DIA`,
    `${spDate} às ${spHour}`,
    `──────────────────`,
    ``,
    `📊 RESUMO EXECUTIVO:`,
    `Total de OS: ${totalAb} abertas | ${totalFe} fechadas | Saldo: ${saldoSign}${saldo}`,
  ];

  // Per unit sections
  const sortedUnis = porUnidade.sort((a, b) => a.unidade.localeCompare(b.unidade));
  for (const u of sortedUnis) {
    const uid = Object.entries(unidadeMap).find(([, v]) => v === u.unidade)?.[0] || "";
    const sigla = getSigla(u.unidade);
    const vel = u.velocidade_media !== null ? `${u.velocidade_media}d` : "N/A";
    const saldoU = u.saldo >= 0 ? `+${u.saldo}` : `${u.saldo}`;

    lines.push(``);
    lines.push(`📍 ${sigla} — ${u.abertas} abertas | ${u.fechadas} fechadas | Saldo: ${saldoU} | Velocidade: ${vel}`);
    lines.push(`🔹 Abertas hoje: ${u.abertas}`);
    lines.push(`🔹 Fechadas hoje: ${u.fechadas}`);
    lines.push(`🔹 Saldo: ${saldoU}`);
    lines.push(`🔹 Velocidade média (30d): ${vel}`);
    lines.push(``);

    // Top 5 aging for this unit
    const unitAging = agingPorUnidade[uid] || [];
    if (unitAging.length > 0) {
      lines.push(`TOP 5 AGING:`);
      unitAging.forEach((o, i) => {
        const dias = Math.round((now.getTime() - new Date(o.created_at).getTime()) / 86400000);
        const osNum = o.numero_os_samsung || o.numero_os_interna || o.id;
        const cliente = o.cliente_nome || "S/N";
        const colLabel = getColunaLabel(o.coluna_kanban);
        lines.push(`${i + 1}. ${osNum} - ${cliente} (${dias}d) [${colLabel}]`);
      });
      lines.push(``);
    }

    // Pendencias for this unit
    lines.push(`PENDÊNCIAS AMANHÃ:`);
    lines.push(`🔸 Agendamentos: ${agPorUni[uid] || 0}`);
    lines.push(`🔸 Aguardando Aprovação: ${aprovacaoPorUni[uid] || 0}`);
    lines.push(`🔸 Aguardando Peça: ${pecasPorUni[uid] || 0}`);
    lines.push(``);
    lines.push(`──────────────────`);
  }

  lines.push(`GIA • Global Intelligence Assistance`);

  const resumoTexto = lines.join("\n");

  return {
    titulo: "Resumo Final do Dia",
    subtitulo: `${fechadasCount} fechadas / ${abertasCount} abertas (saldo ${saldo >= 0 ? "+" : ""}${saldo}) | Vel: ${velocidadeMedia}d`,
    gerado_em: now.toISOString(),
    horario_disparo: now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }),
    balanco: {
      abertas_hoje: abertasCount,
      fechadas_hoje: fechadasCount,
      saldo,
      velocidade_media_30d: velocidadeMedia,
      total_os_fechadas_30d: osFechadas30d?.length || 0,
    },
    aging_top5: Object.entries(agingPorUnidade).flatMap(([, list]) => list.map((o) => ({
      os: o.numero_os_samsung || o.numero_os_interna || o.id,
      cliente: o.cliente_nome,
      coluna: o.coluna_kanban,
      unidade: unidadeMap[o.unidade_id || ""] || o.unidade_id,
      dias_aberta: Math.round((now.getTime() - new Date(o.created_at).getTime()) / 86400000),
    }))),
    pendencias_amanha: {
      agendamentos: agendamentosAmanha,
      sem_confirmacao: semConfirmacao,
      aguardando_aprovacao: osAprovacao?.length || 0,
      aguardando_peca: osPecas?.length || 0,
    },
    por_unidade: porUnidade,
    resumo_texto: resumoTexto,
  };
}

async function gerarAgendamentosIH(supabase: ReturnType<typeof createClient>, unidadeId?: string) {
  const now = new Date();

  const { data: unidades } = await supabase.from("unidades").select("id, nome");
  const unidadeMap: Record<string, string> = {};
  if (unidades) {
    for (const u of unidades) unidadeMap[u.id] = u.nome;
  }

  function getUnidadeSigla(nome: string): string {
    const lower = nome.toLowerCase();
    if (lower.includes("montes claros")) return "MOC";
    if (lower.includes("juiz de fora")) return "JDF";
    if (lower.includes("feira")) return "FSA";
    return nome.slice(0, 3).toUpperCase();
  }

  // Columns that represent a route/color assigned - OS in these columns already have a route
  const colunasComRota = [
    "rota_preta", "rota_vermelha", "rota_azul", "rota_verde", "rota_rosa",
    "rota_amarela", "rota_laranja", "em_rota_ih",
  ];

  // Fetch all active routes to build a set of cities that already have a color per unit
  const { data: rotasAtivas } = await supabase
    .from("rotas")
    .select("cidades, unidade_id")
    .eq("ativa", true);

  // Build a map: unidade_id -> Set of normalized city names with a route
  const cidadesComRotaPorUnidade: Record<string, Set<string>> = {};
  if (rotasAtivas) {
    for (const rota of rotasAtivas) {
      if (!rota.cidades || !rota.unidade_id) continue;
      if (!cidadesComRotaPorUnidade[rota.unidade_id]) {
        cidadesComRotaPorUnidade[rota.unidade_id] = new Set();
      }
      for (const cidade of rota.cidades) {
        cidadesComRotaPorUnidade[rota.unidade_id].add(cidade.toLowerCase().trim());
      }
    }
  }

  // Fetch all active OS that are not closed/archived and not already in a route column
  let allOSRaw: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    let q = supabase
      .from("os")
      .select("id, numero_os_samsung, numero_os_interna, cliente_nome, cliente_cidade, coluna_kanban, rota_id, unidade_id, tipo_atendimento")
      .neq("coluna_kanban", "os_fechada")
      .or("arquivada.is.null,arquivada.eq.false")
      .not("coluna_kanban", "in", `(${colunasComRota.join(",")})`)
      .is("rota_id", null)
      .eq("tipo_atendimento", "IH")
      .range(from, from + pageSize - 1);
    if (unidadeId) q = q.eq("unidade_id", unidadeId);
    const { data, error } = await q;
    if (error) throw new Error(`Erro ao buscar OS sem rota: ${error.message}`);
    if (!data || data.length === 0) break;
    allOSRaw = allOSRaw.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  // Filter out OS whose city already has a route color in the same unit
  const allOS = allOSRaw.filter((os) => {
    if (!os.cliente_cidade || !os.unidade_id) return true;
    const cidadesSet = cidadesComRotaPorUnidade[os.unidade_id];
    if (!cidadesSet) return true;
    return !cidadesSet.has(os.cliente_cidade.toLowerCase().trim());
  });

  // Columns to include in the report (only non-route pipeline columns)
  const colunasOrdem = [
    "os_nova", "diagnostico", "negociacao_em_andamento", "aguardando_aprovacao",
    "orcamento_aprovado", "aguardando_peca", "peca_em_transito", "em_reparo_ci",
    "em_reparo_ih",
    "instalacao_inicial", "service_handling", "return_handling", "trade_up",
    "saw", "controle_qualidade", "qa_bt", "reparo_concluido",
    "aguardando_fechamento", "orcamentos_rejeitados",
  ];

  // Group by unidade_id
  const osPorUnidade: Record<string, any[]> = {};
  for (const os of allOS) {
    const uid = os.unidade_id || "sem_unidade";
    if (!osPorUnidade[uid]) osPorUnidade[uid] = [];
    osPorUnidade[uid].push(os);
  }

  // Build per-unit data
  const unidadesData = Object.keys(osPorUnidade)
    .map((uid) => {
      const lista = osPorUnidade[uid];
      const sigla = getUnidadeSigla(unidadeMap[uid] || uid);

      // Group by coluna_kanban
      const porColuna: Record<string, any[]> = {};
      for (const os of lista) {
        if (!porColuna[os.coluna_kanban]) porColuna[os.coluna_kanban] = [];
        porColuna[os.coluna_kanban].push(os);
      }

      // Build column sections in order
      const colunas = colunasOrdem
        .filter((col) => porColuna[col] && porColuna[col].length > 0)
        .map((col) => ({
          coluna: col,
          label: getColunaLabel(col),
          total: porColuna[col].length,
          os_list: porColuna[col].map((os: any) => {
            const num = os.numero_os_samsung || os.numero_os_interna || os.id.slice(0, 8);
            const cidade = os.cliente_cidade || "Sem cidade";
            return { numero: num, cidade };
          }),
        }));

      return { uid, sigla, total: lista.length, colunas };
    })
    .sort((a, b) => b.total - a.total);

  // Build WhatsApp-formatted text
  const totalSemRota = allOS.length;
  const linhas: string[] = [];

  linhas.push(`🚨📋 *RELATÓRIO ROTAS*`);
  linhas.push(`━━━━━━━━━━━━━━━━━━━━━`);
  linhas.push(``);
  linhas.push(`📅 ${now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo", weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" })}`);
  linhas.push(`⏰ ${now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}`);
  linhas.push(``);
  linhas.push(`⚠️ *${totalSemRota} OS sem rota definida*`);
  linhas.push(``);

  for (const unidade of unidadesData) {
    linhas.push(`━━━━━━━━━━━━━━━━━━━━━`);
    linhas.push(`🏢 *${unidade.sigla}* — ${unidade.total} OS sem rota`);
    linhas.push(`━━━━━━━━━━━━━━━━━━━━━`);
    linhas.push(``);

    for (const col of unidade.colunas) {
      linhas.push(`📌 *${col.label}* (${col.total})`);
      linhas.push(`┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄`);
      for (const os of col.os_list) {
        linhas.push(`• ${os.numero} — _${os.cidade}_`);
      }
      linhas.push(``);
    }
  }

  linhas.push(`━━━━━━━━━━━━━━━━━━━━━`);
  linhas.push(`🤖 _GIA • Global Intelligence Assistance_`);

  const resumoTexto = linhas.join("\n");

  return {
    titulo: "Relatório Rotas",
    subtitulo: `${totalSemRota} OS sem rota definida`,
    gerado_em: now.toISOString(),
    horario_disparo: now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }),
    total_sem_rota: totalSemRota,
    unidades: unidadesData,
    resumo_texto: resumoTexto,
  };
}

async function gerarComplianceErros(supabase: ReturnType<typeof createClient>, unidadeId?: string) {
  const now = new Date();

  const { data: unidades } = await supabase.from("unidades").select("id, nome");
  const unidadeMap: Record<string, string> = {};
  if (unidades) {
    for (const u of unidades) unidadeMap[u.id] = u.nome;
  }

  // First get active OS for the unit (os_pecas has no unidade_id column)
  // Paginate to bypass Supabase default 1000-row limit
  let osDataList: Array<{ id: string; numero_os_samsung: string | null; numero_os_interna: string | null; coluna_kanban: string; unidade_id: string | null }> = [];
  let page = 0;
  const PAGE_SIZE = 1000;
  while (true) {
    let osQuery = supabase
      .from("os")
      .select("id, numero_os_samsung, numero_os_interna, coluna_kanban, unidade_id")
      .not("coluna_kanban", "eq", "os_fechada")
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (unidadeId) osQuery = osQuery.eq("unidade_id", unidadeId);
    const { data: osRows, error: errOS } = await osQuery;
    if (errOS) throw new Error(`Erro ao buscar OS: ${errOS.message}`);
    if (!osRows || osRows.length === 0) break;
    osDataList = osDataList.concat(osRows);
    if (osRows.length < PAGE_SIZE) break;
    page++;
  }
  const osMap: Record<string, { id: string; numero_os_samsung: string | null; numero_os_interna: string | null; coluna_kanban: string; unidade_id: string | null }> = {};
  for (const os of osDataList) osMap[os.id] = os;

  const osIds = osDataList.map((o) => o.id);
  if (osIds.length === 0) {
    return {
      titulo: "Problemas Peca",
      subtitulo: "0 OS com erro",
      gerado_em: now.toISOString(),
      horario_disparo: now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }),
      totais: { os_com_erro: 0, pecas_sem_pn: 0, pecas_sem_valor: 0 },
      por_unidade: [],
      resumo_texto: "Sem erros de peça encontrados.",
    };
  }

  // Fetch os_pecas for those OS in batches
  let pecasList: Array<{ id: string; pn: string | null; descricao: string | null; valor_unitario: number | null; os_id: string; status: string }> = [];
  for (let i = 0; i < osIds.length; i += 200) {
    const batch = osIds.slice(i, i + 200);
    const { data: batchPecas } = await supabase
      .from("os_pecas")
      .select("id, pn, descricao, valor_unitario, os_id, status")
      .in("os_id", batch)
      .not("status", "in", "(reprovada,devolucao_completa,devolvida_samsung)");
    if (batchPecas) pecasList = pecasList.concat(batchPecas);
  }

  // Filter problems
  const semPN = pecasList.filter((p) => !p.pn || p.pn.trim() === "");
  const semValor = pecasList.filter((p) => !p.valor_unitario || Number(p.valor_unitario) === 0);

  // Build per-unit report with coluna breakdown
  type ProblemOS = { numero: string; coluna: string; sem_pn: number; sem_valor: number };

  const problemsByUnit: Record<string, ProblemOS[]> = {};

  // Aggregate problems per OS
  const osProblems: Record<string, { sem_pn: number; sem_valor: number }> = {};
  for (const p of semPN) {
    if (!p.os_id) continue;
    if (!osProblems[p.os_id]) osProblems[p.os_id] = { sem_pn: 0, sem_valor: 0 };
    osProblems[p.os_id].sem_pn++;
  }
  for (const p of semValor) {
    if (!p.os_id) continue;
    if (!osProblems[p.os_id]) osProblems[p.os_id] = { sem_pn: 0, sem_valor: 0 };
    osProblems[p.os_id].sem_valor++;
  }

  for (const [osId, problems] of Object.entries(osProblems)) {
    const os = osMap[osId];
    if (!os) continue;
    const uid = os.unidade_id || "sem_unidade";
    if (!problemsByUnit[uid]) problemsByUnit[uid] = [];
    problemsByUnit[uid].push({
      numero: os.numero_os_samsung || os.numero_os_interna || osId.slice(0, 8),
      coluna: getColunaLabel(os.coluna_kanban),
      sem_pn: problems.sem_pn,
      sem_valor: problems.sem_valor,
    });
  }

  // Sort each unit by coluna then numero
  for (const uid of Object.keys(problemsByUnit)) {
    problemsByUnit[uid].sort((a, b) => a.coluna.localeCompare(b.coluna) || a.numero.localeCompare(b.numero));
  }

  const totalOSComErro = Object.values(problemsByUnit).reduce((sum, list) => sum + list.length, 0);
  const totalSemPN = semPN.length;
  const totalSemValor = semValor.length;

  // Group by coluna within each unit for summary
  const unidadesReport = Object.entries(problemsByUnit)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([uid, lista]) => {
      const porColuna: Record<string, number> = {};
      for (const os of lista) {
        porColuna[os.coluna] = (porColuna[os.coluna] || 0) + 1;
      }
      return {
        unidade: unidadeMap[uid] || uid,
        total_os_com_erro: lista.length,
        por_coluna: Object.entries(porColuna).sort((a, b) => b[1] - a[1]).map(([col, qty]) => ({ coluna: col, quantidade: qty })),
        os_list: lista,
      };
    });

  function getSiglaCE(nome: string): string {
    const lower = nome.toLowerCase();
    if (lower.includes("montes claros")) return "MOC";
    if (lower.includes("juiz de fora")) return "JDF";
    if (lower.includes("feira")) return "FSA";
    return nome.slice(0, 3).toUpperCase();
  }

  const spDate = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const spHour = now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

  const resumoTexto = [
    `⚠️ PROBLEMAS PEÇA (COMPLIANCE)`,
    `${spDate} às ${spHour}`,
    `──────────────────`,
    ``,
    `📊 RESUMO EXECUTIVO:`,
    `Total de OS com erro: ${totalOSComErro}`,
    `${totalSemPN} sem PN | ${totalSemValor} sem valor`,
    ``,
    ...unidadesReport.map((u) => {
      const sigla = getSiglaCE(u.unidade);
      const lines = [
        `📍 ${sigla} — ${u.total_os_com_erro} OS com erro`,
      ];
      for (const c of u.por_coluna) {
        lines.push(`${c.coluna} • ${c.quantidade} OS`);
      }
      lines.push(``);
      return lines.join("\n");
    }),
    `──────────────────`,
    `GIA • Global Intelligence Assistance`,
  ].join("\n");

  return {
    titulo: "Problemas Peca",
    subtitulo: `${totalOSComErro} OS com erro | ${totalSemPN} sem PN | ${totalSemValor} sem valor`,
    gerado_em: now.toISOString(),
    horario_disparo: now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }),
    totais: {
      os_com_erro: totalOSComErro,
      pecas_sem_pn: totalSemPN,
      pecas_sem_valor: totalSemValor,
    },
    por_unidade: unidadesReport,
    resumo_texto: resumoTexto,
  };
}

async function gerarLimiteCreditoGSPN(supabase: ReturnType<typeof createClient>, unidadeId?: string) {
  const now = new Date();

  // Fetch units with credit limits
  let queryUnidades = supabase.from("unidades").select("id, nome, limite_credito_gspn");
  if (unidadeId) queryUnidades = queryUnidades.eq("id", unidadeId);

  const { data: unidades, error: errUni } = await queryUnidades;
  if (errUni) throw new Error(`Erro ao buscar unidades: ${errUni.message}`);

  const unidadesComLimite = (unidades || []).filter((u) => u.limite_credito_gspn && Number(u.limite_credito_gspn) > 0);

  // Fetch ALL estoque_pecas (all statuses count against credit)
  let queryPecas = supabase
    .from("estoque_pecas")
    .select("id, pn, valor_com_impostos, status, unidade_id, tecnico_id, os_id");

  if (unidadeId) queryPecas = queryPecas.eq("unidade_id", unidadeId);

  const { data: pecas, error: errPecas } = await queryPecas;
  if (errPecas) throw new Error(`Erro ao buscar pecas: ${errPecas.message}`);

  // Fetch active orders (pendente requisitions = pending orders consuming credit)
  let queryPedidos = supabase
    .from("requisicoes_pecas")
    .select("id, valor_peca, unidade_id")
    .eq("status", "pendente");

  if (unidadeId) queryPedidos = queryPedidos.eq("unidade_id", unidadeId);

  const { data: pedidos, error: errPed } = await queryPedidos;
  if (errPed) throw new Error(`Erro ao buscar pedidos: ${errPed.message}`);

  const pecasList = pecas || [];
  const pedidosList = pedidos || [];

  // Group by unidade
  const porUnidade = unidadesComLimite.map((uni) => {
    const limite = Number(uni.limite_credito_gspn);
    const pecasUni = pecasList.filter((p) => p.unidade_id === uni.id);
    const pedidosUni = pedidosList.filter((p) => p.unidade_id === uni.id);

    // Categorize pecas
    const disponivel = pecasUni.filter((p) => p.status === "disponivel" && !p.tecnico_id && !p.os_id);
    const comTecnico = pecasUni.filter((p) => p.tecnico_id && !p.os_id && p.status !== "devolucao_completa");
    const comDefeito = pecasUni.filter((p) => p.status === "devolvida_defeito");
    const devolvida = pecasUni.filter((p) => p.status === "devolucao_completa");
    const emOS = pecasUni.filter((p) => p.os_id && p.status !== "devolucao_completa");
    const reservada = pecasUni.filter((p) => p.status === "reservada");

    const valorCategoria = (lista: typeof pecasUni) =>
      Math.round(lista.reduce((sum, p) => sum + Number(p.valor_com_impostos || 0), 0) * 100) / 100;

    // Credit consumed = all pecas NOT yet returned (devolucao_completa) + active orders
    const pecasConsumo = pecasUni.filter((p) => p.status !== "devolucao_completa");
    const valorPecasConsumo = valorCategoria(pecasConsumo);
    const valorPedidosAtivos = Math.round(pedidosUni.reduce((sum, p) => sum + Number(p.valor_peca || 0), 0) * 100) / 100;
    const consumido = Math.round((valorPecasConsumo + valorPedidosAtivos) * 100) / 100;
    const livre = Math.round((limite - consumido) * 100) / 100;
    const percentualUso = limite > 0 ? Math.round((consumido / limite) * 10000) / 100 : 0;

    return {
      unidade: uni.nome,
      unidade_id: uni.id,
      limite_total: limite,
      consumido,
      livre,
      percentual_uso: percentualUso,
      alerta: percentualUso >= 80,
      critico: percentualUso >= 95,
      categorias: {
        disponivel: { quantidade: disponivel.length, valor: valorCategoria(disponivel) },
        com_tecnico: { quantidade: comTecnico.length, valor: valorCategoria(comTecnico) },
        com_defeito: { quantidade: comDefeito.length, valor: valorCategoria(comDefeito) },
        devolvida: { quantidade: devolvida.length, valor: valorCategoria(devolvida) },
        em_os_aberta: { quantidade: emOS.length, valor: valorCategoria(emOS) },
        reservada: { quantidade: reservada.length, valor: valorCategoria(reservada) },
        pedidos_ativos: { quantidade: pedidosUni.length, valor: valorPedidosAtivos },
      },
    };
  });

  porUnidade.sort((a, b) => b.percentual_uso - a.percentual_uso);

  const limiteGlobal = porUnidade.reduce((s, u) => s + u.limite_total, 0);
  const consumidoGlobal = porUnidade.reduce((s, u) => s + u.consumido, 0);
  const livreGlobal = porUnidade.reduce((s, u) => s + u.livre, 0);
  const percentualGlobal = limiteGlobal > 0 ? Math.round((consumidoGlobal / limiteGlobal) * 10000) / 100 : 0;

  const fmt = (v: number) => `R$ ${v.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  function getSiglaLC(nome: string): string {
    const lower = nome.toLowerCase();
    if (lower.includes("montes claros")) return "MOC";
    if (lower.includes("juiz de fora")) return "JDF";
    if (lower.includes("feira")) return "FSA";
    return nome.slice(0, 3).toUpperCase();
  }

  const spDate = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const spHour = now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

  const resumoTexto = [
    `💳 LIMITE DE CRÉDITO GSPN`,
    `${spDate} às ${spHour}`,
    `──────────────────`,
    ``,
    `📊 RESUMO EXECUTIVO:`,
    `Total Geral:`,
    `- Limite: ${fmt(limiteGlobal)}`,
    `- Consumido: ${fmt(consumidoGlobal)}`,
    `- Livre: ${fmt(livreGlobal)}`,
    `- Uso: ${percentualGlobal}%`,
    ``,
    ...porUnidade.map((u) => {
      const sigla = getSiglaLC(u.unidade);
      return [
        `📍 ${sigla} — ${u.percentual_uso}% utilizado`,
        `Limite: ${fmt(u.limite_total)} | Consumido: ${fmt(u.consumido)} | Livre: ${fmt(u.livre)}`,
        `Disponível: ${u.categorias.disponivel.quantidade} (${fmt(u.categorias.disponivel.valor)})`,
        `Com técnico: ${u.categorias.com_tecnico.quantidade} (${fmt(u.categorias.com_tecnico.valor)})`,
        `Com defeito: ${u.categorias.com_defeito.quantidade} (${fmt(u.categorias.com_defeito.valor)})`,
        `Em OS aberta: ${u.categorias.em_os_aberta.quantidade} (${fmt(u.categorias.em_os_aberta.valor)})`,
        `Pedidos ativos: ${u.categorias.pedidos_ativos.quantidade} (${fmt(u.categorias.pedidos_ativos.valor)})`,
        `Devolvida (não consome): ${u.categorias.devolvida.quantidade} (${fmt(u.categorias.devolvida.valor)})`,
        ``,
      ].join("\n");
    }),
    `GIA • Global Intelligence Assistance`,
  ].join("\n");

  return {
    titulo: "Limite de Credito GSPN",
    subtitulo: `${percentualGlobal}% utilizado - Livre: ${fmt(livreGlobal)}`,
    gerado_em: now.toISOString(),
    horario_disparo: now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }),
    global: {
      limite_total: limiteGlobal,
      consumido: consumidoGlobal,
      livre: livreGlobal,
      percentual_uso: percentualGlobal,
    },
    por_unidade: porUnidade,
    resumo_texto: resumoTexto,
  };
}

async function gerarNucleoPecas(supabase: ReturnType<typeof createClient>, unidadeId?: string) {
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();

  // === SETUP: Fetch unidades ===
  const { data: unidades } = await supabase.from("unidades").select("id, nome");
  const unidadeMap: Record<string, string> = {};
  const unidadeSigla: Record<string, string> = {};
  if (unidades) {
    for (const u of unidades) {
      unidadeMap[u.id] = u.nome;
      const nome = (u.nome || "").toLowerCase();
      if (nome.includes("montes claros")) unidadeSigla[u.id] = "MOC";
      else if (nome.includes("juiz de fora")) unidadeSigla[u.id] = "JDF";
      else if (nome.includes("feira")) unidadeSigla[u.id] = "FSA";
      else unidadeSigla[u.id] = u.nome?.slice(0, 3)?.toUpperCase() || "???";
    }
  }

  // === SECTION 1: Estoque Real (snapshot) ===
  let queryEstoque = supabase
    .from("estoque_pecas")
    .select("id, unidade_id, status, valor_com_impostos");
  if (unidadeId) queryEstoque = queryEstoque.eq("unidade_id", unidadeId);
  const { data: allPecas } = await queryEstoque;
  const pecasList = allPecas || [];

  const estoqueByUnidade: Record<string, { disponiveis: number; valorDisp: number; reservadas: number; comTecnico: number; defeito: number; valorDefeito: number }> = {};
  for (const p of pecasList) {
    const uid = p.unidade_id || "sem_unidade";
    if (!estoqueByUnidade[uid]) estoqueByUnidade[uid] = { disponiveis: 0, valorDisp: 0, reservadas: 0, comTecnico: 0, defeito: 0, valorDefeito: 0 };
    const val = Number(p.valor_com_impostos) || 0;
    if (p.status === "disponivel") { estoqueByUnidade[uid].disponiveis++; estoqueByUnidade[uid].valorDisp += val; }
    else if (p.status === "reservada") { estoqueByUnidade[uid].reservadas++; }
    else if (p.status === "vinculada_tecnico") { estoqueByUnidade[uid].comTecnico++; }
    else if (p.status === "devolvida_defeito") { estoqueByUnidade[uid].defeito++; estoqueByUnidade[uid].valorDefeito += val; }
  }

  const totalDisponiveis = pecasList.filter(p => p.status === "disponivel").length;
  const totalValorEstoque = pecasList.filter(p => p.status === "disponivel").reduce((s, p) => s + (Number(p.valor_com_impostos) || 0), 0);
  const totalDefeito = pecasList.filter(p => p.status === "devolvida_defeito").length;
  const totalValorDefeito = pecasList.filter(p => p.status === "devolvida_defeito").reduce((s, p) => s + (Number(p.valor_com_impostos) || 0), 0);

  // === SECTION 2: Movimentacao do dia ===
  let queryEntradasHoje = supabase
    .from("estoque_pecas")
    .select("id, unidade_id, valor_com_impostos")
    .gte("data_entrada", todayISO);
  if (unidadeId) queryEntradasHoje = queryEntradasHoje.eq("unidade_id", unidadeId);
  const { data: entradasHoje } = await queryEntradasHoje;
  const entradasList = entradasHoje || [];
  const totalEntradasHoje = entradasList.length;
  const valorEntradasHoje = entradasList.reduce((s, p) => s + (Number(p.valor_com_impostos) || 0), 0);

  // NFs recebidas hoje
  let queryNFsHoje = supabase
    .from("estoque_nfs")
    .select("id, unidade_id, valor_total, processada, pendente_entrada")
    .gte("created_at", todayISO);
  if (unidadeId) queryNFsHoje = queryNFsHoje.eq("unidade_id", unidadeId);
  const { data: nfsHoje } = await queryNFsHoje;
  const nfsHojeList = nfsHoje || [];
  const totalNFsHoje = nfsHojeList.length;
  const valorNFsHoje = nfsHojeList.reduce((s, n) => s + (Number(n.valor_total) || 0), 0);

  // NFs pendentes de entrada (total, nao apenas hoje)
  let queryNFsPend = supabase
    .from("estoque_nfs")
    .select("id, unidade_id, valor_total, created_at")
    .eq("pendente_entrada", true);
  if (unidadeId) queryNFsPend = queryNFsPend.eq("unidade_id", unidadeId);
  const { data: nfsPend } = await queryNFsPend;
  const nfsPendList = nfsPend || [];
  const totalNFsPendentes = nfsPendList.length;
  const valorNFsPendentes = nfsPendList.reduce((s, n) => s + (Number(n.valor_total) || 0), 0);
  const nfsPendMais24h = nfsPendList.filter(n => (now.getTime() - new Date(n.created_at).getTime()) > 24 * 60 * 60 * 1000).length;

  // === SECTION 3: Requisicoes Pendentes ===
  let queryReq = supabase
    .from("requisicoes_pecas")
    .select("id, codigo_peca, descricao, quantidade_requisitada, status, unidade_id, created_at, numero_os_samsung, valor_peca, numero_pedido_samsung, previsao_entrega")
    .eq("status", "pendente");
  if (unidadeId) queryReq = queryReq.eq("unidade_id", unidadeId);
  const { data: pendentes } = await queryReq.order("created_at", { ascending: true });
  const pendentesList = pendentes || [];

  let valorTotalPendente = 0;
  let pecasComValor = 0;
  let pecasSemValor = 0;
  for (const r of pendentesList) {
    const val = Number(r.valor_peca) || 0;
    const qty = Number(r.quantidade_requisitada) || 1;
    if (val > 0) { valorTotalPendente += val * qty; pecasComValor++; } else { pecasSemValor++; }
  }

  // Age classification
  const pendentesComIdade = pendentesList.map((r) => {
    const minutos = (now.getTime() - new Date(r.created_at).getTime()) / (1000 * 60);
    return { ...r, minutos_pendente: minutos };
  });
  const criticas = pendentesComIdade.filter((r) => r.minutos_pendente > 48 * 60);
  const alerta = pendentesComIdade.filter((r) => r.minutos_pendente > 24 * 60 && r.minutos_pendente <= 48 * 60);
  const recentes = pendentesComIdade.filter((r) => r.minutos_pendente <= 24 * 60);

  // Top 10 pecas mais pedidas (all requisicoes, not just pendentes)
  let queryAllReq = supabase
    .from("requisicoes_pecas")
    .select("id, codigo_peca, descricao, quantidade_requisitada, unidade_id")
    .in("status", ["pendente", "pedido_feito", "atendida"]);
  if (unidadeId) queryAllReq = queryAllReq.eq("unidade_id", unidadeId);
  const { data: allReqs } = await queryAllReq;
  const allReqsList = allReqs || [];

  // Top 10 per unit
  const topPecasPorUnidade: Record<string, Array<{ codigo: string; descricao: string; qtd: number }>> = {};
  for (const r of allReqsList) {
    const uid = r.unidade_id || "sem_unidade";
    if (!topPecasPorUnidade[uid]) topPecasPorUnidade[uid] = [];
    const key = r.codigo_peca || "SEM_CODIGO";
    let existing = topPecasPorUnidade[uid].find(p => p.codigo === key);
    if (!existing) {
      existing = { codigo: key, descricao: r.descricao || "", qtd: 0 };
      topPecasPorUnidade[uid].push(existing);
    }
    existing.qtd += Number(r.quantidade_requisitada) || 1;
  }
  for (const uid of Object.keys(topPecasPorUnidade)) {
    topPecasPorUnidade[uid].sort((a, b) => b.qtd - a.qtd);
    topPecasPorUnidade[uid] = topPecasPorUnidade[uid].slice(0, 10);
  }

  // Global top 10
  const pecaCount: Record<string, { codigo: string; descricao: string; qtd: number }> = {};
  for (const r of allReqsList) {
    const key = r.codigo_peca || "SEM_CODIGO";
    if (!pecaCount[key]) pecaCount[key] = { codigo: key, descricao: r.descricao || "", qtd: 0 };
    pecaCount[key].qtd += Number(r.quantidade_requisitada) || 1;
  }
  const topPecas = Object.values(pecaCount).sort((a, b) => b.qtd - a.qtd).slice(0, 10);

  // Group by unidade
  const reqPorUnidade: Record<string, typeof pendentesComIdade> = {};
  for (const r of pendentesComIdade) {
    const uid = r.unidade_id || "sem_unidade";
    if (!reqPorUnidade[uid]) reqPorUnidade[uid] = [];
    reqPorUnidade[uid].push(r);
  }

  // === SECTION 4: Pedidos em Transito (pedido_feito) ===
  let queryPedidos = supabase
    .from("requisicoes_pecas")
    .select("id, codigo_peca, descricao, quantidade_requisitada, unidade_id, numero_pedido_samsung, previsao_entrega, valor_peca")
    .eq("status", "pedido_feito");
  if (unidadeId) queryPedidos = queryPedidos.eq("unidade_id", unidadeId);
  const { data: pedidosFeitos } = await queryPedidos;
  const pedidosFeitosList = pedidosFeitos || [];
  const totalPedidosTransito = pedidosFeitosList.length;
  const valorPedidosTransito = pedidosFeitosList.reduce((s, p) => s + ((Number(p.valor_peca) || 0) * (Number(p.quantidade_requisitada) || 1)), 0);

  // === SECTION 5: Top 10 IDs mais antigos em estoque ===
  let queryAntigos = supabase
    .from("estoque_pecas")
    .select("id, id_numerico, pn, descricao, unidade_id, created_at, nf_id, data_entrada, estoque_nfs(data_emissao)")
    .eq("status", "disponivel")
    .order("data_entrada", { ascending: true })
    .limit(10);
  if (unidadeId) queryAntigos = queryAntigos.eq("unidade_id", unidadeId);
  const { data: pecasAntigas } = await queryAntigos;
  const pecasAntigasList = pecasAntigas || [];

  // === BUILD TEXT REPORT ===
  const fmt = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const horaRelatorio = now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const lines: string[] = [
    `📦 *NÚCLEO DE PEÇAS*`,
    `${horaRelatorio}`,
    `━━━━━━━━━━━━━━━━━━━━━`,
    ``,
    `🏪 *ESTOQUE DISPONIVEL:*`,
    `Pecas disponiveis: ${totalDisponiveis}`,
    `Valor total em estoque: ${fmt(totalValorEstoque)}`,
  ];

  // Estoque por unidade
  const estoqueEntries = Object.entries(estoqueByUnidade).filter(([, v]) => v.disponiveis > 0).sort((a, b) => b[1].disponiveis - a[1].disponiveis);
  for (const [uid, data] of estoqueEntries) {
    const sigla = unidadeSigla[uid] || uid.slice(0, 3).toUpperCase();
    lines.push(`  📍 ${sigla}: ${data.disponiveis} pcs | ${fmt(data.valorDisp)}`);
  }

  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`📊 *MOVIMENTACAO DO DIA:*`);
  lines.push(`Entradas hoje: ${totalEntradasHoje} pcs | ${fmt(valorEntradasHoje)}`);
  lines.push(`NFs recebidas hoje: ${totalNFsHoje} | ${fmt(valorNFsHoje)}`);
  if (totalNFsPendentes > 0) {
    lines.push(`⚠️ NFs pendentes de entrada: ${totalNFsPendentes} | ${fmt(valorNFsPendentes)}`);
    if (nfsPendMais24h > 0) {
      lines.push(`  🔴 ${nfsPendMais24h} NFs ha mais de 24h sem entrada`);
    }
  }

  // Movimentação por unidade
  const movPorUnidade: Record<string, { entradas: number; valorEntradas: number; nfs: number; valorNfs: number; nfsPend: number }> = {};
  for (const e of entradasList) {
    const uid = e.unidade_id || "sem";
    if (!movPorUnidade[uid]) movPorUnidade[uid] = { entradas: 0, valorEntradas: 0, nfs: 0, valorNfs: 0, nfsPend: 0 };
    movPorUnidade[uid].entradas++;
    movPorUnidade[uid].valorEntradas += Number(e.valor_com_impostos) || 0;
  }
  for (const n of nfsHojeList) {
    const uid = n.unidade_id || "sem";
    if (!movPorUnidade[uid]) movPorUnidade[uid] = { entradas: 0, valorEntradas: 0, nfs: 0, valorNfs: 0, nfsPend: 0 };
    movPorUnidade[uid].nfs++;
    movPorUnidade[uid].valorNfs += Number(n.valor_total) || 0;
  }
  for (const n of nfsPendList) {
    const uid = n.unidade_id || "sem";
    if (!movPorUnidade[uid]) movPorUnidade[uid] = { entradas: 0, valorEntradas: 0, nfs: 0, valorNfs: 0, nfsPend: 0 };
    movPorUnidade[uid].nfsPend++;
  }
  const movEntries = Object.entries(movPorUnidade).filter(([, v]) => v.entradas > 0 || v.nfs > 0 || v.nfsPend > 0);
  if (movEntries.length > 1 || (movEntries.length === 1 && !unidadeId)) {
    lines.push(``);
    lines.push(`📍 *Por unidade:*`);
    for (const [uid, data] of movEntries.sort((a, b) => b[1].entradas - a[1].entradas)) {
      const sigla = unidadeSigla[uid] || uid.slice(0, 3).toUpperCase();
      let detail = `${data.entradas} entradas | ${data.nfs} NFs`;
      if (data.nfsPend > 0) detail += ` | ${data.nfsPend} pend`;
      lines.push(`  ${sigla}: ${detail}`);
    }
  }

  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`📋 *REQUISICOES PENDENTES: ${pendentesList.length}*`);
  lines.push(`Valor total pendente: ${fmt(valorTotalPendente)}`);
  lines.push(`  🔴 Criticas (+48h): ${criticas.length}`);
  lines.push(`  🟡 Alerta (+24h): ${alerta.length}`);
  lines.push(`  🟢 Recentes (-24h): ${recentes.length}`);
  if (pecasSemValor > 0) {
    const pctSemValor = Math.round((pecasSemValor / pendentesList.length) * 100);
    lines.push(`  ⚠️ Sem valor cadastrado: ${pecasSemValor} (${pctSemValor}%)`);
  }

  // Per-unit breakdown
  const reqEntries = Object.entries(reqPorUnidade).sort((a, b) => b[1].length - a[1].length);
  lines.push(``);
  for (const [uid, lista] of reqEntries) {
    const sigla = unidadeSigla[uid] || uid.slice(0, 3).toUpperCase();
    const uCriticas = lista.filter(r => r.minutos_pendente > 48 * 60).length;
    const uAlerta = lista.filter(r => r.minutos_pendente > 24 * 60 && r.minutos_pendente <= 48 * 60).length;
    const uRecentes = lista.filter(r => r.minutos_pendente <= 24 * 60).length;
    const uValor = lista.reduce((s, r) => s + ((Number(r.valor_peca) || 0) * (Number(r.quantidade_requisitada) || 1)), 0);
    lines.push(`📍 ${sigla} — ${lista.length} pendentes | ${fmt(uValor)}`);
    lines.push(`  🔴${uCriticas} 🟡${uAlerta} 🟢${uRecentes}`);
  }

  // Top 10 pecas POR UNIDADE
  const unidadeIdsForTop = Object.keys(topPecasPorUnidade);
  if (unidadeIdsForTop.length > 0) {
    lines.push(``);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`🔥 *TOP 10 PEÇAS MAIS PEDIDAS POR UNIDADE:*`);
    for (const uid of unidadeIdsForTop) {
      const sigla = unidadeSigla[uid] || unidadeMap[uid] || uid;
      const unitPecas = topPecasPorUnidade[uid];
      if (unitPecas.length === 0) continue;
      lines.push(``);
      lines.push(`📍 *${sigla}:*`);
      for (let i = 0; i < unitPecas.length; i++) {
        const p = unitPecas[i];
        const desc = p.descricao.length > 25 ? p.descricao.slice(0, 25) + "..." : p.descricao;
        lines.push(`${i + 1}. ${p.codigo} (${p.qtd}x) - ${desc}`);
      }
    }
  }

  // Pedidos em transito
  if (totalPedidosTransito > 0) {
    lines.push(``);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`🚚 *PEDIDOS EM TRANSITO: ${totalPedidosTransito}*`);
    lines.push(`Valor estimado: ${fmt(valorPedidosTransito)}`);
  }

  // Devolucoes
  if (totalDefeito > 0) {
    lines.push(``);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`🔄 *DEVOLUCOES PENDENTES:*`);
    lines.push(`Pecas com defeito aguardando: ${totalDefeito}`);
    lines.push(`Valor retido: ${fmt(totalValorDefeito)}`);
    const defeitoEntries = Object.entries(estoqueByUnidade).filter(([, v]) => v.defeito > 0);
    for (const [uid, data] of defeitoEntries) {
      const sigla = unidadeSigla[uid] || uid.slice(0, 3).toUpperCase();
      lines.push(`  📍 ${sigla}: ${data.defeito} pcs | ${fmt(data.valorDefeito)}`);
    }
  }

  // Top 10 IDs mais antigos em estoque
  if (pecasAntigasList.length > 0) {
    lines.push(``);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`⏳ *TOP 10 IDs MAIS ANTIGOS EM ESTOQUE:*`);
    for (let i = 0; i < pecasAntigasList.length; i++) {
      const peca = pecasAntigasList[i] as any;
      const nfEmissao = peca.estoque_nfs?.data_emissao;
      const dataRef = nfEmissao ? new Date(nfEmissao + "T00:00:00Z") : (peca.data_entrada ? new Date(peca.data_entrada) : new Date(peca.created_at));
      const diasEstoque = Math.floor((now.getTime() - dataRef.getTime()) / (1000 * 60 * 60 * 24));
      const dataFormatada = dataRef.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      const sigla = unidadeSigla[peca.unidade_id] || "???";
      const desc = (peca.descricao || peca.pn || "").length > 20 ? (peca.descricao || peca.pn || "").slice(0, 20) + "..." : (peca.descricao || peca.pn || "");
      lines.push(`${i + 1}. #${peca.id_numerico || "?"} | ${desc} | ${sigla}`);
      lines.push(`   📅 ${dataFormatada} — *${diasEstoque} dias*`);
    }
  }

  // Alertas
  const alertas: string[] = [];
  for (const [uid, lista] of reqEntries) {
    const uCriticas = lista.filter(r => r.minutos_pendente > 48 * 60).length;
    if (uCriticas >= 10) {
      const sigla = unidadeSigla[uid] || uid.slice(0, 3).toUpperCase();
      alertas.push(`🚨 ${sigla}: ${uCriticas} requisicoes criticas (+48h)`);
    }
  }
  if (pecasSemValor > 0 && (pecasSemValor / pendentesList.length) > 0.3) {
    alertas.push(`⚠️ ${Math.round((pecasSemValor / pendentesList.length) * 100)}% das requisicoes sem valor cadastrado`);
  }
  if (nfsPendMais24h >= 3) {
    alertas.push(`📦 ${nfsPendMais24h} NFs aguardando entrada ha mais de 24h`);
  }

  if (alertas.length > 0) {
    lines.push(``);
    lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
    lines.push(`🚨 *ALERTAS:*`);
    for (const a of alertas) lines.push(a);
  }

  lines.push(``);
  lines.push(`━━━━━━━━━━━━━━━━━━━━━`);
  lines.push(`GIA • Global Intelligence Assistance`);

  const resumoTexto = lines.join("\n");

  return {
    titulo: "Nucleo de Peças",
    subtitulo: `${pendentesList.length} req. pendentes | Estoque: ${totalDisponiveis} pcs (${fmt(totalValorEstoque)}) | Defeito: ${totalDefeito}`,
    gerado_em: now.toISOString(),
    horario_disparo: now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }),
    estoque: {
      total_disponiveis: totalDisponiveis,
      valor_total_estoque: totalValorEstoque,
      total_defeito: totalDefeito,
      valor_total_defeito: totalValorDefeito,
      por_unidade: estoqueByUnidade,
    },
    movimentacao_dia: {
      entradas_hoje: totalEntradasHoje,
      valor_entradas_hoje: valorEntradasHoje,
      nfs_hoje: totalNFsHoje,
      valor_nfs_hoje: valorNFsHoje,
      nfs_pendentes: totalNFsPendentes,
      valor_nfs_pendentes: valorNFsPendentes,
      nfs_pend_mais_24h: nfsPendMais24h,
    },
    requisicoes_pendentes: {
      total: pendentesList.length,
      criticas: criticas.length,
      alerta: alerta.length,
      recentes: recentes.length,
      valor_total: valorTotalPendente,
      pecas_com_valor: pecasComValor,
      pecas_sem_valor: pecasSemValor,
    },
    pedidos_transito: {
      total: totalPedidosTransito,
      valor: valorPedidosTransito,
    },
    top_pecas: topPecas,
    alertas,
    por_unidade: reqEntries.map(([uid, lista]) => ({
      unidade: unidadeMap[uid] || uid,
      sigla: unidadeSigla[uid] || "???",
      total_pendentes: lista.length,
      criticas: lista.filter(r => r.minutos_pendente > 48 * 60).length,
      alerta: lista.filter(r => r.minutos_pendente > 24 * 60 && r.minutos_pendente <= 48 * 60).length,
      recentes: lista.filter(r => r.minutos_pendente <= 24 * 60).length,
      valor_total: lista.reduce((s, r) => s + ((Number(r.valor_peca) || 0) * (Number(r.quantidade_requisitada) || 1)), 0),
    })),
    resumo_texto: resumoTexto,
  };
}

async function gerarMapaRotas(supabase: ReturnType<typeof createClient>, unidadeId?: string) {
  const now = new Date();

  // Fetch units
  const { data: unidades } = await supabase.from("unidades").select("id, nome");
  const unidadeMap: Record<string, string> = {};
  const unidadeShort: Record<string, string> = {};
  if (unidades) {
    for (const u of unidades) {
      unidadeMap[u.id] = u.nome;
      const nome = (u.nome || "").toLowerCase();
      if (nome.includes("montes claros")) unidadeShort[u.id] = "MOC";
      else if (nome.includes("juiz de fora")) unidadeShort[u.id] = "JDF";
      else if (nome.includes("feira de santana") || nome.includes("feira")) unidadeShort[u.id] = "FSA";
      else unidadeShort[u.id] = u.nome?.slice(0, 3)?.toUpperCase() || "???";
    }
  }

  // Fetch active OS (not archived, not closed)
  // Fetch all active OS using pagination to avoid PostgREST 1000-row default limit
  let osList: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    let q = supabase
      .from("os")
      .select("id, numero_os_samsung, numero_os_interna, cliente_nome, cliente_cidade, tipo_os, tipo_atendimento, coluna_kanban, rota_id, unidade_id, grupo_os_id, created_at")
      .neq("coluna_kanban", "os_fechada")
      .or("arquivada.is.null,arquivada.eq.false")
      .range(from, from + pageSize - 1);
    if (unidadeId) q = q.eq("unidade_id", unidadeId);
    const { data, error: errOS } = await q;
    if (errOS) throw new Error(`Erro ao buscar OS ativas: ${errOS.message}`);
    if (!data || data.length === 0) break;
    osList = osList.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  // Route-related kanban columns (only IH routes)
  const rotaColumns = ["em_rota_ih", "em_reparo_ih"];

  // Fetch agendamentos to validate IH and FTF
  const { data: agendamentos } = await supabase
    .from("agendamentos")
    .select("id, os_id, data_agendamento, status")
    .in("status", ["agendado", "confirmado", "pendente_confirmacao", "em_andamento"]);

  const agendamentoPorOS: Record<string, { data_agendamento: string | null }[]> = {};
  for (const ag of agendamentos || []) {
    if (!ag.os_id) continue;
    if (!agendamentoPorOS[ag.os_id]) agendamentoPorOS[ag.os_id] = [];
    agendamentoPorOS[ag.os_id].push({ data_agendamento: ag.data_agendamento });
  }

  // Today's date string for comparison (only future dates are valid for FTF)
  const todayStr = now.toISOString().split("T")[0];

  // For grouped OS, find the principal (oldest) in each group so we can hide non-principal ones
  const grupoOS: Record<string, typeof osList> = {};
  for (const os of osList) {
    if (os.grupo_os_id) {
      if (!grupoOS[os.grupo_os_id]) grupoOS[os.grupo_os_id] = [];
      grupoOS[os.grupo_os_id].push(os);
    }
  }
  // Sort each group by created_at ascending — first one is the principal
  const principalOSIds = new Set<string>();
  const linkedOSIds = new Set<string>();
  for (const members of Object.values(grupoOS)) {
    members.sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
    principalOSIds.add(members[0].id);
    for (let i = 1; i < members.length; i++) {
      linkedOSIds.add(members[i].id);
    }
  }

  // Group everything by unidade
  const osPorUnidade: Record<string, typeof osList> = {};
  for (const os of osList) {
    const uid = os.unidade_id || "sem_unidade";
    if (!osPorUnidade[uid]) osPorUnidade[uid] = [];
    osPorUnidade[uid].push(os);
  }

  // Build per-unit data
  const unidadesData = Object.entries(osPorUnidade)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([uid, lista]) => {
      const totalPipeline = lista.length;

      // Group by coluna_kanban for route columns (only IH, exclude linked OS)
      const porColuna: Record<string, typeof osList> = {};
      for (const os of lista) {
        if (rotaColumns.includes(os.coluna_kanban) && os.tipo_atendimento === 'IH') {
          if (linkedOSIds.has(os.id)) continue;
          if (!porColuna[os.coluna_kanban]) porColuna[os.coluna_kanban] = [];
          porColuna[os.coluna_kanban].push(os);
        }
      }

      const emRotaTotal = lista.filter((os) => rotaColumns.includes(os.coluna_kanban) && os.tipo_atendimento === 'IH' && !(os.coluna_kanban === "em_rota_ih" && os.grupo_os_id)).length;

      // Route distribution in pipeline order (only IH)
      const rotaColumnsOrder = ["em_rota_ih", "em_reparo_ih"];
      const distribuicao = rotaColumnsOrder
        .filter((col) => porColuna[col] && porColuna[col].length > 0)
        .map((col) => ({
          rota: getColunaLabel(col),
          total: porColuna[col].length,
        }));

      // OS IH sem rota: IH OS that have no rota_id assigned and are not yet in em_rota_ih
      const osIHSemRota = lista.filter((os) => {
        if (os.tipo_atendimento !== 'IH') return false;
        if (linkedOSIds.has(os.id)) return false;
        if (os.coluna_kanban === 'em_rota_ih') return false;
        if (os.rota_id) return false;
        return true;
      });

      const osIHSemRotaNumeros = osIHSemRota.map((os) =>
        os.numero_os_samsung || os.numero_os_interna || os.id.slice(0, 8)
      );

      // Erros FTF: OS in "em_rota_ih" with past date or no agendamento (only IH)
      // Exclude linked OS (non-principal) — they are managed by the principal OS
      const osEmFTF = lista.filter((os) => os.coluna_kanban === "em_rota_ih" && os.tipo_atendimento === 'IH' && !linkedOSIds.has(os.id));
      const osErrosFTF = osEmFTF.filter((os) => {
        const ags = agendamentoPorOS[os.id];
        if (!ags || ags.length === 0) return true; // no agendamento at all
        // Check if ALL agendamentos have past or current date
        const hasFutureDate = ags.some((ag) => ag.data_agendamento && ag.data_agendamento > todayStr);
        return !hasFutureDate;
      });

      const osErrosFTFNumeros = osErrosFTF.map((os) =>
        os.numero_os_samsung || os.numero_os_interna || os.id.slice(0, 8)
      );

      return {
        unidade_id: uid,
        unidade_nome: unidadeMap[uid] || uid,
        unidade_sigla: unidadeShort[uid] || "???",
        total_pipeline: totalPipeline,
        em_rota: emRotaTotal,
        distribuicao,
        ih_sem_rota_total: osIHSemRota.length,
        ih_sem_rota_lista: osIHSemRotaNumeros,
        ftf_erros_total: osErrosFTF.length,
        ftf_erros_lista: osErrosFTFNumeros,
      };
    });

  // Totals
  const totalPipeline = osList.filter((os) => !linkedOSIds.has(os.id)).length;
  const totalEmRota = osList.filter((os) => rotaColumns.includes(os.coluna_kanban) && os.tipo_atendimento === 'IH' && !linkedOSIds.has(os.id)).length;
  const totalIHSemRota = unidadesData.reduce((acc, u) => acc + u.ih_sem_rota_total, 0);
  const totalFTFErros = unidadesData.reduce((acc, u) => acc + u.ftf_erros_total, 0);

  // Build resumo texto in cockpit style
  const spTime = now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const spDate = spTime.split(",")[0]?.trim() || spTime;
  const spHour = now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

  const linhasResumo: string[] = [
    `🗺️ RELATÓRIO AGENDA`,
    `${spDate} às ${spHour}`,
    `──────────────────`,
    ``,
    `📊 RESUMO EXECUTIVO:`,
    `Total de OS no pipeline: ${totalPipeline.toLocaleString("pt-BR")}`,
    `Em rota: ${totalEmRota} | IH sem rota: ${totalIHSemRota} | Erros FTF: ${totalFTFErros}`,
  ];

  for (const unidade of unidadesData) {
    linhasResumo.push(``);
    linhasResumo.push(`📍 ${unidade.unidade_sigla} — Pipeline: ${unidade.total_pipeline} | Em rota: ${unidade.em_rota}`);

    for (const rota of unidade.distribuicao) {
      linhasResumo.push(`${rota.rota}: ${rota.total}`);
    }

    linhasResumo.push(``);
    linhasResumo.push(`🔴 OS IH sem rota: ${unidade.ih_sem_rota_total}`);
    if (unidade.ih_sem_rota_lista.length > 0) {
      for (const num of unidade.ih_sem_rota_lista) {
        linhasResumo.push(num);
      }
    }

    if (unidade.ftf_erros_total > 0) {
      linhasResumo.push(``);
      linhasResumo.push(`⚠️ Erros FTF: ${unidade.ftf_erros_total}`);
      for (const num of unidade.ftf_erros_lista) {
        linhasResumo.push(num);
      }
    }
    linhasResumo.push(`──────────────────`);
  }

  linhasResumo.push(`GIA • Global Intelligence Assistance`);

  return {
    titulo: "Relatório Rotas",
    subtitulo: `${totalEmRota} OS em rota / ${totalIHSemRota} IH sem rota`,
    gerado_em: now.toISOString(),
    horario_disparo: now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }),
    totais: {
      pipeline: totalPipeline,
      em_rota: totalEmRota,
      ih_sem_rota: totalIHSemRota,
    },
    unidades: unidadesData,
    resumo_texto: linhasResumo.join("\n"),
  };
}

async function gerarAberturaFechamento(supabase: ReturnType<typeof createClient>, unidadeId?: string) {
  const now = new Date();

  // Calculate start of day in São Paulo timezone (UTC-3)
  const spNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const startOfDaySP = new Date(spNow);
  startOfDaySP.setHours(0, 0, 0, 0);
  // Convert back to UTC for the query
  const offsetMs = now.getTime() - spNow.getTime();
  const startOfDayUTC = new Date(startOfDaySP.getTime() + offsetMs);

  // Fetch all units for labeling
  const { data: unidades } = await supabase.from("unidades").select("id, nome");
  const unidadeMap: Record<string, string> = {};
  if (unidades) {
    for (const u of unidades) unidadeMap[u.id] = u.nome;
  }

  // Fetch OS opened today (created_at >= start of day SP)
  let queryAbertas = supabase
    .from("os")
    .select("id, numero_os_samsung, numero_os_interna, cliente_nome, tipo_os, tipo_atendimento, unidade_id, created_at")
    .gte("created_at", startOfDayUTC.toISOString());

  if (unidadeId) queryAbertas = queryAbertas.eq("unidade_id", unidadeId);

  const { data: abertas, error: errAbertas } = await queryAbertas;
  if (errAbertas) throw new Error(`Erro ao buscar OS abertas: ${errAbertas.message}`);

  // Fetch OS moved to os_fechada today (coluna_kanban_desde >= start of day SP)
  let queryFechadas = supabase
    .from("os")
    .select("id, numero_os_samsung, numero_os_interna, cliente_nome, tipo_os, tipo_atendimento, unidade_id, coluna_kanban_desde")
    .eq("coluna_kanban", "os_fechada")
    .gte("coluna_kanban_desde", startOfDayUTC.toISOString());

  if (unidadeId) queryFechadas = queryFechadas.eq("unidade_id", unidadeId);

  const { data: fechadas, error: errFechadas } = await queryFechadas;
  if (errFechadas) throw new Error(`Erro ao buscar OS fechadas: ${errFechadas.message}`);

  const categorizarOS = (lista: typeof abertas) => {
    const categorias: Record<string, number> = { "LP-CI": 0, "LP-IH": 0, "OW-CI": 0, "OW-IH": 0, "Outros": 0 };
    for (const os of lista || []) {
      const tipo = os.tipo_os?.toUpperCase() || "";
      const atend = os.tipo_atendimento?.toUpperCase() || "";
      const key = `${tipo}-${atend}`;
      if (key in categorias) categorias[key]++;
      else categorias["Outros"]++;
    }
    return categorias;
  };

  const porUnidadeAbertas: Record<string, typeof abertas> = {};
  const porUnidadeFechadas: Record<string, typeof fechadas> = {};

  for (const os of abertas || []) {
    const uid = os.unidade_id || "sem_unidade";
    if (!porUnidadeAbertas[uid]) porUnidadeAbertas[uid] = [];
    porUnidadeAbertas[uid].push(os);
  }

  for (const os of fechadas || []) {
    const uid = os.unidade_id || "sem_unidade";
    if (!porUnidadeFechadas[uid]) porUnidadeFechadas[uid] = [];
    porUnidadeFechadas[uid].push(os);
  }

  const allUnidadeIds = new Set([...Object.keys(porUnidadeAbertas), ...Object.keys(porUnidadeFechadas)]);

  const unidadesReport = Array.from(allUnidadeIds).map((uid) => {
    const nome = unidadeMap[uid] || uid;
    const abertasUnidade = porUnidadeAbertas[uid] || [];
    const fechadasUnidade = porUnidadeFechadas[uid] || [];
    return {
      unidade_id: uid,
      unidade_nome: nome,
      abertas: {
        total: abertasUnidade.length,
        categorias: categorizarOS(abertasUnidade),
      },
      fechadas: {
        total: fechadasUnidade.length,
        categorias: categorizarOS(fechadasUnidade),
      },
      saldo: abertasUnidade.length - fechadasUnidade.length,
    };
  }).sort((a, b) => b.abertas.total - a.abertas.total);

  const totalAbertas = (abertas || []).length;
  const totalFechadas = (fechadas || []).length;
  const saldoGeral = totalAbertas - totalFechadas;
  const categoriasAbertas = categorizarOS(abertas);
  const categoriasFechadas = categorizarOS(fechadas);

  function getSigla(nome: string): string {
    const lower = nome.toLowerCase();
    if (lower.includes("montes claros")) return "MOC";
    if (lower.includes("juiz de fora")) return "JDF";
    if (lower.includes("feira")) return "FSA";
    return nome.slice(0, 3).toUpperCase();
  }

  const spDate = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
  const spHour = now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  const saldoStr = saldoGeral >= 0 ? `+${saldoGeral}` : `${saldoGeral}`;
  const saldoEmoji = saldoGeral <= 0 ? "🟢" : "🔴";

  const resumoTexto = [
    `*📋 ABERTURA & FECHAMENTO*`,
    `${spDate} • ${spHour}`,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    ``,
    `${saldoEmoji} *Saldo: ${saldoStr}*`,
    ``,
    `   📥 *${totalAbertas}* abertas`,
    `        LP → ${categoriasAbertas["LP-CI"]} CI • ${categoriasAbertas["LP-IH"]} IH`,
    `        OW → ${categoriasAbertas["OW-CI"]} CI • ${categoriasAbertas["OW-IH"]} IH`,
    ``,
    `   📤 *${totalFechadas}* fechadas`,
    `        LP → ${categoriasFechadas["LP-CI"]} CI • ${categoriasFechadas["LP-IH"]} IH`,
    `        OW → ${categoriasFechadas["OW-CI"]} CI • ${categoriasFechadas["OW-IH"]} IH`,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    ``,
    ...unidadesReport.map((u) => {
      const sigla = getSigla(u.unidade_nome);
      const sU = u.saldo >= 0 ? `+${u.saldo}` : `${u.saldo}`;
      const sUEmoji = u.saldo <= 0 ? "🟢" : "🔴";
      return [
        `${sUEmoji} *${sigla}*  (${sU})`,
        `     📥 ${u.abertas.total} abertas — LP: ${u.abertas.categorias["LP-CI"]}CI ${u.abertas.categorias["LP-IH"]}IH • OW: ${u.abertas.categorias["OW-CI"]}CI ${u.abertas.categorias["OW-IH"]}IH`,
        `     📤 ${u.fechadas.total} fechadas — LP: ${u.fechadas.categorias["LP-CI"]}CI ${u.fechadas.categorias["LP-IH"]}IH • OW: ${u.fechadas.categorias["OW-CI"]}CI ${u.fechadas.categorias["OW-IH"]}IH`,
        ``,
      ].join("\n");
    }),
    `━━━━━━━━━━━━━━━━━━`,
    `🤖 _GIA • Global Intelligence Assistance_`,
  ].join("\n");

  return {
    titulo: "Abertura e Fechamento",
    subtitulo: `${totalAbertas} abertas / ${totalFechadas} fechadas hoje`,
    gerado_em: now.toISOString(),
    horario_disparo: now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }),
    periodo: "hoje",
    totais: {
      abertas: totalAbertas,
      fechadas: totalFechadas,
      saldo: saldoGeral,
    },
    categorias_abertas: categoriasAbertas,
    categorias_fechadas: categoriasFechadas,
    por_unidade: unidadesReport,
    resumo_texto: resumoTexto,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { tipo, unidade_id } = await req.json();

    let resultado: unknown;

    switch (tipo) {
      case "pulso_operacional":
        resultado = await gerarPulsoOperacional(supabase, unidade_id);
        break;
      case "abertura_fechamento":
        resultado = await gerarAberturaFechamento(supabase, unidade_id);
        break;
      case "mapa_rotas":
        resultado = await gerarMapaRotas(supabase, unidade_id);
        break;
      case "nucleo_pecas":
        resultado = await gerarNucleoPecas(supabase, unidade_id);
        break;
      case "estoque_dia":
        resultado = await gerarEstoqueDoDia(supabase, unidade_id);
        break;
      case "limite_credito_gspn":
        resultado = await gerarLimiteCreditoGSPN(supabase, unidade_id);
        break;
      case "compliance_erros":
        resultado = await gerarComplianceErros(supabase, unidade_id);
        break;
      case "agendamentos_ih":
        resultado = await gerarAgendamentosIH(supabase, unidade_id);
        break;
      case "resumo_final":
        resultado = await gerarResumoFinal(supabase, unidade_id);
        break;
      default:
        return new Response(
          JSON.stringify({ error: `Tipo de relatorio desconhecido: ${tipo}. Tipos disponiveis: pulso_operacional, abertura_fechamento, mapa_rotas, nucleo_pecas, estoque_dia, limite_credito_gspn, compliance_erros, agendamentos_ih, resumo_final` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(
      JSON.stringify(resultado),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
