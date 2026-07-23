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

  // Fetch unidades for grouping by unit
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

  // Fetch ALL open OS (not just paradas) so every column appears
  let query = supabase
    .from("os")
    .select("id, numero_os_samsung, numero_os_interna, cliente_nome, coluna_kanban, coluna_kanban_desde, tipo_os, unidade_id")
    .not("coluna_kanban", "is", null)
    .neq("coluna_kanban", "os_fechada")
    .or("arquivada.is.null,arquivada.eq.false");

  if (unidadeId) {
    query = query.eq("unidade_id", unidadeId);
  }

  const allOS: any[] = [];
  let from = 0;
  const pageSize = 1000;
  let hasMore = true;
  while (hasMore) {
    const { data, error } = await query.range(from, from + pageSize - 1).order("coluna_kanban_desde", { ascending: true, nullsFirst: false });
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
      titulo: "Pulso Operacional",
      subtitulo: "Nenhuma OS aberta no momento",
      gerado_em: now.toISOString(),
      total_os: 0,
      total_os_paradas: 0,
      colunas: [],
      resumo_texto: "Nenhuma OS aberta. Operacao sem demandas no momento.",
    };
  }

  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  // Group ALL OS by coluna_kanban
  const osPorColuna: Record<string, typeof allOS> = {};
  const osParadasPorColuna: Record<string, OSParada[]> = {};
  for (const os of allOS) {
    const coluna = os.coluna_kanban;
    if (!osPorColuna[coluna]) osPorColuna[coluna] = [];
    osPorColuna[coluna].push(os);

    if (os.coluna_kanban_desde && new Date(os.coluna_kanban_desde) < twoHoursAgo) {
      const minutosParada = (now.getTime() - new Date(os.coluna_kanban_desde).getTime()) / (1000 * 60);
      if (!osParadasPorColuna[coluna]) osParadasPorColuna[coluna] = [];
      osParadasPorColuna[coluna].push({
        id: os.id,
        numero_os_samsung: os.numero_os_samsung,
        numero_os_interna: os.numero_os_interna,
        cliente_nome: os.cliente_nome,
        coluna_kanban: coluna,
        coluna_kanban_desde: os.coluna_kanban_desde,
        tipo_os: os.tipo_os,
        minutos_parada: minutosParada,
      });
    }
  }

  const totalOS = allOS.length;
  const totalParadas = Object.values(osParadasPorColuna).reduce((sum, arr) => sum + arr.length, 0);

  // Build data for ALL columns (even those with 0 OS)
  const colunasResult = TODAS_COLUNAS_KANBAN.map((coluna) => {
    const totalColuna = osPorColuna[coluna]?.length || 0;
    const paradas = osParadasPorColuna[coluna] || [];
    const paradasCount = paradas.length;

    if (paradasCount > 0) {
      const sorted = paradas.sort((a, b) => b.minutos_parada - a.minutos_parada);
      const oldest = sorted[0];
      return {
        coluna,
        label: getColunaLabel(coluna),
        total: totalColuna,
        paradas: paradasCount,
        tempo_mais_antiga: formatDuration(oldest.minutos_parada),
        minutos_mais_antiga: Math.round(oldest.minutos_parada),
        os_mais_antiga: oldest.numero_os_samsung || oldest.numero_os_interna || oldest.id.slice(0, 8),
        cliente_mais_antiga: oldest.cliente_nome || "Sem cliente",
        tipo_mais_antiga: oldest.tipo_os || "-",
      };
    }

    return {
      coluna,
      label: getColunaLabel(coluna),
      total: totalColuna,
      paradas: 0,
      tempo_mais_antiga: "-",
      minutos_mais_antiga: 0,
      os_mais_antiga: "-",
      cliente_mais_antiga: "-",
      tipo_mais_antiga: "-",
    };
  });

  // Also include any extra columns found in data but not in the fixed list
  for (const coluna of Object.keys(osPorColuna)) {
    if (!TODAS_COLUNAS_KANBAN.includes(coluna)) {
      const totalColuna = osPorColuna[coluna]?.length || 0;
      const paradas = osParadasPorColuna[coluna] || [];
      const paradasCount = paradas.length;
      if (paradasCount > 0) {
        const sorted = paradas.sort((a, b) => b.minutos_parada - a.minutos_parada);
        const oldest = sorted[0];
        colunasResult.push({
          coluna,
          label: getColunaLabel(coluna),
          total: totalColuna,
          paradas: paradasCount,
          tempo_mais_antiga: formatDuration(oldest.minutos_parada),
          minutos_mais_antiga: Math.round(oldest.minutos_parada),
          os_mais_antiga: oldest.numero_os_samsung || oldest.numero_os_interna || oldest.id.slice(0, 8),
          cliente_mais_antiga: oldest.cliente_nome || "Sem cliente",
          tipo_mais_antiga: oldest.tipo_os || "-",
        });
      } else {
        colunasResult.push({
          coluna,
          label: getColunaLabel(coluna),
          total: totalColuna,
          paradas: 0,
          tempo_mais_antiga: "-",
          minutos_mais_antiga: 0,
          os_mais_antiga: "-",
          cliente_mais_antiga: "-",
          tipo_mais_antiga: "-",
        });
      }
    }
  }

  // Group OS by unidade for the text report
  const osPorUnidade: Record<string, typeof allOS> = {};
  for (const os of allOS) {
    const uid = os.unidade_id || "sem_unidade";
    if (!osPorUnidade[uid]) osPorUnidade[uid] = [];
    osPorUnidade[uid].push(os);
  }

  // Build per-unit breakdown string for RESUMO EXECUTIVO
  const unidadeTotals = Object.entries(osPorUnidade)
    .map(([uid, osList]) => `${osList.length} ${unidadeShort[uid] || "???"}`)
    .join(" | ");

  // Build per-unit sections
  const unidadeSections: string[] = [];
  for (const [uid, osList] of Object.entries(osPorUnidade)) {
    const sigla = unidadeShort[uid] || "???";
    const totalUnit = osList.length;

    // Group by coluna within this unidade
    const osPorColunaUnidade: Record<string, typeof allOS> = {};
    for (const os of osList) {
      const col = os.coluna_kanban || "sem_coluna";
      if (!osPorColunaUnidade[col]) osPorColunaUnidade[col] = [];
      osPorColunaUnidade[col].push(os);
    }

    const linhas: string[] = [];
    for (const [coluna, osCol] of Object.entries(osPorColunaUnidade)) {
      if (osCol.length === 0) continue;
      const label = getColunaLabel(coluna);
      // Find oldest OS in this column for this unit
      let oldestMinutes = 0;
      for (const os of osCol) {
        if (os.coluna_kanban_desde) {
          const desde = new Date(os.coluna_kanban_desde);
          const diffMin = (now.getTime() - desde.getTime()) / 60000;
          if (diffMin > oldestMinutes) oldestMinutes = diffMin;
        }
      }
      const maisAntiga = oldestMinutes > 0 ? ` • Mais antiga: ${formatDuration(oldestMinutes)}` : "";
      linhas.push(`${label} • ${osCol.length} OS${maisAntiga}`);
    }

    unidadeSections.push(
      [`📍 ${sigla} — ${totalUnit} OS abertas`, ...linhas].join("\n")
    );
  }

  const resumoTexto = [
    `🔴 PULSO OPERACIONAL`,
    now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
    `──────────────────`,
    `📊 RESUMO EXECUTIVO:`,
    `Total de OS abertas: ${totalOS} (${unidadeTotals})`,
    `──────────────────`,
    unidadeSections.join("\n──────────────────\n"),
    `──────────────────`,
    `GIA • Global Intelligence Assistance`,
  ].join("\n");

  return {
    titulo: "Pulso Operacional",
    subtitulo: `${totalOS} OS abertas | ${totalParadas} paradas ha mais de 2 horas`,
    gerado_em: now.toISOString(),
    horario_disparo: now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }),
    total_os: totalOS,
    total_os_paradas: totalParadas,
    colunas: colunasResult,
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

  // Fetch all active OS that are NOT in a route (rota_id IS NULL) and not closed/archived
  // These are OS without routes defined
  let allOS: any[] = [];
  let from = 0;
  const pageSize = 1000;
  while (true) {
    let q = supabase
      .from("os")
      .select("id, numero_os_samsung, numero_os_interna, cliente_nome, cliente_cidade, coluna_kanban, rota_id, unidade_id")
      .neq("coluna_kanban", "os_fechada")
      .or("arquivada.is.null,arquivada.eq.false")
      .is("rota_id", null)
      .range(from, from + pageSize - 1);
    if (unidadeId) q = q.eq("unidade_id", unidadeId);
    const { data, error } = await q;
    if (error) throw new Error(`Erro ao buscar OS sem rota: ${error.message}`);
    if (!data || data.length === 0) break;
    allOS = allOS.concat(data);
    if (data.length < pageSize) break;
    from += pageSize;
  }

  // Columns to include in the report (pipeline columns that matter)
  const colunasOrdem = [
    "os_nova", "diagnostico", "negociacao_em_andamento", "aguardando_aprovacao",
    "orcamento_aprovado", "aguardando_peca", "peca_em_transito", "em_reparo_ci",
    "rota_preta", "rota_vermelha", "rota_azul", "rota_verde", "rota_rosa",
    "rota_amarela", "rota_laranja", "em_rota_ih", "em_reparo_ih",
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

  const { data: unidades } = await supabase.from("unidades").select("id, nome");
  const unidadeMap: Record<string, string> = {};
  if (unidades) {
    for (const u of unidades) unidadeMap[u.id] = u.nome;
  }

  let queryReq = supabase
    .from("requisicoes_pecas")
    .select("id, codigo_peca, descricao, quantidade_requisitada, status, unidade_id, created_at, numero_os_samsung, os_id, valor_peca")
    .eq("status", "pendente");

  if (unidadeId) queryReq = queryReq.eq("unidade_id", unidadeId);

  const { data: pendentes, error: errPend } = await queryReq.order("created_at", { ascending: true });
  if (errPend) throw new Error(`Erro ao buscar requisicoes: ${errPend.message}`);

  const pendentesList = pendentes || [];

  // Calculate values
  let valorTotal = 0;
  let pecasComValor = 0;
  let pecasSemValor = 0;

  for (const r of pendentesList) {
    const val = Number(r.valor_peca) || 0;
    const qty = Number(r.quantidade_requisitada) || 1;
    if (val > 0) {
      valorTotal += val * qty;
      pecasComValor++;
    } else {
      pecasSemValor++;
    }
  }

  // Age classification
  const pendentesComIdade = pendentesList.map((r) => {
    const minutos = (now.getTime() - new Date(r.created_at).getTime()) / (1000 * 60);
    return { ...r, minutos_pendente: minutos };
  });

  const criticas = pendentesComIdade.filter((r) => r.minutos_pendente > 48 * 60);
  const alerta = pendentesComIdade.filter((r) => r.minutos_pendente > 24 * 60 && r.minutos_pendente <= 48 * 60);
  const recentes = pendentesComIdade.filter((r) => r.minutos_pendente <= 24 * 60);

  // Group by unidade
  const pendentesPorUnidade: Record<string, typeof pendentesComIdade> = {};
  for (const r of pendentesComIdade) {
    const uid = r.unidade_id || "sem_unidade";
    if (!pendentesPorUnidade[uid]) pendentesPorUnidade[uid] = [];
    pendentesPorUnidade[uid].push(r);
  }

  const unidadesReport = Object.entries(pendentesPorUnidade)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([uid, lista]) => {
      let uValor = 0;
      let uSemValor = 0;
      for (const r of lista) {
        const val = Number(r.valor_peca) || 0;
        const qty = Number(r.quantidade_requisitada) || 1;
        if (val > 0) uValor += val * qty;
        else uSemValor++;
      }
      const uCriticas = lista.filter((r) => r.minutos_pendente > 48 * 60).length;
      const uAlerta = lista.filter((r) => r.minutos_pendente > 24 * 60 && r.minutos_pendente <= 48 * 60).length;
      const uRecentes = lista.filter((r) => r.minutos_pendente <= 24 * 60).length;

      return {
        unidade: unidadeMap[uid] || uid,
        total_pendentes: lista.length,
        criticas: uCriticas,
        alerta: uAlerta,
        recentes: uRecentes,
        valor_total: uValor,
        sem_valor: uSemValor,
      };
    });

  function getSigla(nome: string): string {
    const lower = nome.toLowerCase();
    if (lower.includes("montes claros")) return "MOC";
    if (lower.includes("juiz de fora")) return "JDF";
    if (lower.includes("feira")) return "FSA";
    return nome.slice(0, 3).toUpperCase();
  }

  const valorFormatado = valorTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const resumoTexto = [
    `📦 NUCLEO DE PEÇAS`,
    `${now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
    `──────────────────`,
    `📊 RESUMO EXECUTIVO:`,
    `Requisições pendentes: ${pendentesList.length}`,
    `  🔴 Críticas (+48h): ${criticas.length}`,
    `  🟡 Alerta (+24h): ${alerta.length}`,
    `  🟢 Recentes (-24h): ${recentes.length}`,
    `Valor total pendente: ${valorFormatado}`,
    `Peças com valor: ${pecasComValor} | Sem valor cadastrado: ${pecasSemValor}`,
    `──────────────────`,
    ...unidadesReport.map((u) => {
      const sigla = getSigla(u.unidade);
      const uValorFmt = u.valor_total.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      return [
        `📍 ${sigla} — ${u.total_pendentes} pendentes`,
        `  Críticas: ${u.criticas} | Alerta: ${u.alerta} | Recentes: ${u.recentes}`,
        `  Valor: ${uValorFmt} | Sem valor: ${u.sem_valor}`,
      ].join("\n");
    }),
    `──────────────────`,
    `GIA • Global Intelligence Assistance`,
  ].join("\n");

  return {
    titulo: "Nucleo de Pecas",
    subtitulo: `${pendentesList.length} requisicoes pendentes | ${valorFormatado} | ${pecasSemValor} sem valor`,
    gerado_em: now.toISOString(),
    horario_disparo: now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }),
    requisicoes_pendentes: {
      total: pendentesList.length,
      criticas: criticas.length,
      alerta: alerta.length,
      recentes: recentes.length,
    },
    valores: {
      valor_total: valorTotal,
      valor_total_formatado: valorFormatado,
      pecas_com_valor: pecasComValor,
      pecas_sem_valor: pecasSemValor,
    },
    por_unidade: unidadesReport,
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
      .select("id, numero_os_samsung, numero_os_interna, cliente_nome, cliente_cidade, tipo_os, tipo_atendimento, coluna_kanban, rota_id, unidade_id, grupo_os_id")
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

  // Route-related kanban columns
  const rotaColumns = ["rota_verde", "rota_azul", "rota_amarela", "rota_vermelha", "rota_laranja", "rota_rosa", "rota_preta", "em_rota_ih", "em_reparo_ih"];

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

      // Group by coluna_kanban for route columns (exclude linked OS from em_rota_ih count)
      const porColuna: Record<string, typeof osList> = {};
      for (const os of lista) {
        if (rotaColumns.includes(os.coluna_kanban)) {
          if (os.coluna_kanban === "em_rota_ih" && os.grupo_os_id) continue;
          if (!porColuna[os.coluna_kanban]) porColuna[os.coluna_kanban] = [];
          porColuna[os.coluna_kanban].push(os);
        }
      }

      const emRotaTotal = lista.filter((os) => rotaColumns.includes(os.coluna_kanban) && !(os.coluna_kanban === "em_rota_ih" && os.grupo_os_id)).length;

      // Route distribution in pipeline order
      const rotaColumnsOrder = ["rota_preta", "rota_vermelha", "rota_azul", "rota_verde", "rota_rosa", "rota_amarela", "rota_laranja", "em_rota_ih", "em_reparo_ih"];
      const distribuicao = rotaColumnsOrder
        .filter((col) => porColuna[col] && porColuna[col].length > 0)
        .map((col) => ({
          rota: getColunaLabel(col),
          total: porColuna[col].length,
        }));

      // OS IH sem rota: OS in "em_reparo_ih" that have NO active agendamento
      const osEmReparoIH = lista.filter((os) => os.coluna_kanban === "em_reparo_ih");
      const osIHSemRota = osEmReparoIH.filter((os) => {
        const ags = agendamentoPorOS[os.id];
        return !ags || ags.length === 0;
      });

      const osIHSemRotaNumeros = osIHSemRota.map((os) =>
        os.numero_os_samsung || os.numero_os_interna || os.id.slice(0, 8)
      );

      // Erros FTF: OS in "em_rota_ih" with past date or no agendamento
      // Exclude OS that are linked (grupo_os_id) - they are managed by the parent OS
      const osEmFTF = lista.filter((os) => os.coluna_kanban === "em_rota_ih" && !os.grupo_os_id);
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
  const totalPipeline = osList.length;
  const totalEmRota = osList.filter((os) => rotaColumns.includes(os.coluna_kanban)).length;
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
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  // Fetch all units for labeling
  const { data: unidades } = await supabase.from("unidades").select("id, nome");
  const unidadeMap: Record<string, string> = {};
  if (unidades) {
    for (const u of unidades) unidadeMap[u.id] = u.nome;
  }

  // Fetch OS opened today
  let queryAbertas = supabase
    .from("os")
    .select("id, numero_os_samsung, numero_os_interna, cliente_nome, tipo_os, tipo_atendimento, unidade_id, created_at")
    .gte("created_at", startOfDay.toISOString());

  if (unidadeId) queryAbertas = queryAbertas.eq("unidade_id", unidadeId);

  const { data: abertas, error: errAbertas } = await queryAbertas;
  if (errAbertas) throw new Error(`Erro ao buscar OS abertas: ${errAbertas.message}`);

  // Fetch OS closed today
  let queryFechadas = supabase
    .from("os")
    .select("id, numero_os_samsung, numero_os_interna, cliente_nome, tipo_os, tipo_atendimento, unidade_id, fechada_em")
    .gte("fechada_em", startOfDay.toISOString());

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

  const resumoTexto = [
    `📋 ABERTURA E FECHAMENTO`,
    `🕕 ${spDate} às ${spHour}`,
    `──────────────────`,
    ``,
    `📊 CONSOLIDADO GERAL`,
    ``,
    `⚖️ Saldo Total: ${saldoStr}`,
    ``,
    `📥 Abertas (${totalAbertas})`,
    `↳ LP: ${categoriasAbertas["LP-CI"]} CI | ${categoriasAbertas["LP-IH"]} IH`,
    `↳ OW: ${categoriasAbertas["OW-CI"]} CI | ${categoriasAbertas["OW-IH"]} IH`,
    ``,
    `📤 Fechadas (${totalFechadas})`,
    `↳ LP: ${categoriasFechadas["LP-CI"]} CI | ${categoriasFechadas["LP-IH"]} IH`,
    `↳ OW: ${categoriasFechadas["OW-CI"]} CI | ${categoriasFechadas["OW-IH"]} IH`,
    ``,
    `──────────────────`,
    ``,
    ...unidadesReport.map((u) => {
      const sigla = getSigla(u.unidade_nome);
      const sU = u.saldo >= 0 ? `+${u.saldo}` : `${u.saldo}`;
      const aLP = `LP (${u.abertas.categorias["LP-CI"]} CI | ${u.abertas.categorias["LP-IH"]} IH)`;
      const aOW = `OW (${u.abertas.categorias["OW-CI"]} CI | ${u.abertas.categorias["OW-IH"]} IH)`;
      const fLP = `LP (${u.fechadas.categorias["LP-CI"]} CI | ${u.fechadas.categorias["LP-IH"]} IH)`;
      const fOW = `OW (${u.fechadas.categorias["OW-CI"]} CI | ${u.fechadas.categorias["OW-IH"]} IH)`;
      return [
        `📍 ${sigla} | Saldo: ${sU}`,
        `📥 Abertas (${u.abertas.total}):  ${aLP} • ${aOW}`,
        `📤 Fechadas (${u.fechadas.total}): ${fLP} • ${fOW}`,
        ``,
      ].join("\n");
    }),
    `──────────────────`,
    `🤖 GIA • Global Intelligence Assistance`,
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
