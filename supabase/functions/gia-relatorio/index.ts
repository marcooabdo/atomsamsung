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
  diagnostico: "Diagnóstico",
  aguardando_peca: "Aguardando Peça",
  peca_em_transito: "Peça em Trânsito",
  aguardando_aprovacao: "Aguardando Aprovação",
  negociacao_em_andamento: "Negociação em Andamento",
  orcamento_aprovado: "Orçamento Aprovado",
  em_reparo_ci: "Em Reparo CI",
  em_reparo_ih: "Em Reparo IH",
  em_rota_ih: "Em Rota IH",
  controle_qualidade: "Controle de Qualidade",
  reparo_concluido: "Reparo Concluído",
  aguardando_fechamento: "Aguardando Fechamento",
  rota_verde: "Rota Verde",
  rota_azul: "Rota Azul",
  rota_amarela: "Rota Amarela",
  rota_vermelha: "Rota Vermelha",
  rota_laranja: "Rota Laranja",
  rota_rosa: "Rota Rosa",
  rota_preta: "Rota Preta",
  instalacao_inicial: "Instalação Inicial",
  service_handling: "Service Handling",
  return_handling: "Return Handling",
  saw: "SAW",
  qa_bt: "QA/BT",
  trade_up: "Trade Up",
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

async function gerarPulsoOperacional(supabase: ReturnType<typeof createClient>, unidadeId?: string) {
  const now = new Date();
  const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  let query = supabase
    .from("os")
    .select("id, numero_os_samsung, numero_os_interna, cliente_nome, coluna_kanban, coluna_kanban_desde, tipo_os, unidade_id")
    .not("coluna_kanban", "is", null)
    .not("coluna_kanban_desde", "is", null)
    .lt("coluna_kanban_desde", twoHoursAgo.toISOString())
    .neq("coluna_kanban", "os_fechada")
    .or("arquivada.is.null,arquivada.eq.false");

  if (unidadeId) {
    query = query.eq("unidade_id", unidadeId);
  }

  const { data: osParadas, error } = await query.order("coluna_kanban_desde", { ascending: true });

  if (error) throw new Error(`Erro ao buscar OS: ${error.message}`);
  if (!osParadas || osParadas.length === 0) {
    return {
      titulo: "Pulso Operacional",
      subtitulo: "Nenhuma OS parada ha mais de 2 horas",
      gerado_em: now.toISOString(),
      total_os_paradas: 0,
      colunas: [],
      resumo_texto: "Nenhuma OS parada ha mais de 2 horas. Operacao fluindo normalmente.",
    };
  }

  const totalOS = osParadas.length;

  // Group by coluna_kanban
  const osPorColuna: Record<string, OSParada[]> = {};
  for (const os of osParadas) {
    const minutosParada = (now.getTime() - new Date(os.coluna_kanban_desde).getTime()) / (1000 * 60);
    const coluna = os.coluna_kanban;
    if (!osPorColuna[coluna]) osPorColuna[coluna] = [];
    osPorColuna[coluna].push({
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

  // Build cockpit-style data: per column -> qty, oldest time, oldest OS
  const colunasOrdenadas = Object.entries(osPorColuna)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([coluna, lista]) => {
      const sorted = lista.sort((a, b) => b.minutos_parada - a.minutos_parada);
      const oldest = sorted[0];
      return {
        coluna,
        label: getColunaLabel(coluna),
        total: lista.length,
        tempo_mais_antiga: formatDuration(oldest.minutos_parada),
        minutos_mais_antiga: Math.round(oldest.minutos_parada),
        os_mais_antiga: oldest.numero_os_samsung || oldest.numero_os_interna || oldest.id.slice(0, 8),
        cliente_mais_antiga: oldest.cliente_nome || "Sem cliente",
        tipo_mais_antiga: oldest.tipo_os || "-",
      };
    });

  // Build cockpit-style resumo texto (one line per column)
  const resumoTexto = [
    `PULSO OPERACIONAL - ${now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
    ``,
    `Total de OS paradas (+2h): ${totalOS}`,
    ``,
    `Etapa | Qtd | Tempo Mais Antiga | OS Mais Antiga`,
    `──────────────────────────────────────`,
    ...colunasOrdenadas.map((col) =>
      `${col.label} | ${col.total} | ${col.tempo_mais_antiga} | ${col.os_mais_antiga}`
    ),
  ].join("\n");

  return {
    titulo: "Pulso Operacional",
    subtitulo: `${totalOS} OS paradas ha mais de 2 horas`,
    gerado_em: now.toISOString(),
    horario_disparo: now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }),
    total_os_paradas: totalOS,
    colunas: colunasOrdenadas,
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

  const resumoTexto = [
    `ESTOQUE DO DIA - ${now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
    ``,
    `Entradas hoje:`,
    `  Pecas: ${entradas.length} | PNs distintos: ${pnsHoje.size}`,
    `  Valor total: R$ ${valorEntradaHoje.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    ``,
    `Estoque disponivel total:`,
    `  Pecas: ${estoque.length}`,
    `  Valor: R$ ${valorEstoqueTotal.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
    ``,
    `Por unidade:`,
    ...todasUnidades.map((u) =>
      `  ${u.unidade}: +${u.entradas_hoje.quantidade} hoje (${u.entradas_hoje.pns_distintos} PNs, R$ ${u.entradas_hoje.valor_total.toFixed(2)}) | Estoque: ${u.estoque_atual.quantidade} pecas (R$ ${u.estoque_atual.valor_total.toFixed(2)})`
    ),
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

  // Top 5 aging (oldest open OS)
  let queryAging = supabase
    .from("os")
    .select("id, numero_os_interna, numero_os_samsung, cliente_nome, coluna_kanban, unidade_id, created_at")
    .not("coluna_kanban", "in", "(os_fechada,aguardando_fechamento)")
    .order("created_at", { ascending: true })
    .limit(5);

  if (unidadeId) queryAging = queryAging.eq("unidade_id", unidadeId);

  const { data: aging } = await queryAging;

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

  const agingList = (aging || []).map((o) => {
    const dias = Math.round((now.getTime() - new Date(o.created_at).getTime()) / 86400000);
    return {
      os: o.numero_os_samsung || o.numero_os_interna || o.id,
      cliente: o.cliente_nome,
      coluna: o.coluna_kanban,
      unidade: unidadeMap[o.unidade_id || ""] || o.unidade_id,
      dias_aberta: dias,
    };
  });

  const resumoTexto = [
    `RESUMO FINAL DO DIA - ${now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
    ``,
    `BALANCO:`,
    `  Abertas hoje: ${abertasCount}`,
    `  Fechadas hoje: ${fechadasCount}`,
    `  Saldo: ${saldo >= 0 ? "+" : ""}${saldo}`,
    `  Velocidade media (30d): ${velocidadeMedia} dias`,
    ``,
    `TOP 5 AGING (mais antigas):`,
    ...agingList.map((a, i) => `  ${i + 1}. ${a.os} - ${a.cliente} (${a.dias_aberta}d) [${a.coluna}] - ${a.unidade}`),
    ``,
    `PENDENCIAS AMANHA:`,
    `  Agendamentos: ${agendamentosAmanha} (${semConfirmacao} sem confirmacao)`,
    `  Aguardando aprovacao: ${osAprovacao?.length || 0}`,
    `  Aguardando peca: ${osPecas?.length || 0}`,
    ``,
    `POR UNIDADE:`,
    ...porUnidade.map((u) => `  ${u.unidade}: +${u.abertas} / -${u.fechadas} (vel: ${u.velocidade_media ?? "N/A"}d)`),
  ].join("\n");

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
    aging_top5: agingList,
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
  const today = now.toISOString().split("T")[0];

  const { data: unidades } = await supabase.from("unidades").select("id, nome");
  const unidadeMap: Record<string, string> = {};
  if (unidades) {
    for (const u of unidades) unidadeMap[u.id] = u.nome;
  }

  // OS IH in rota_ columns (FTF agendado) - check for missing date or no confirmation
  let queryRotaOS = supabase
    .from("os")
    .select("id, numero_os_interna, numero_os_samsung, cliente_nome, coluna_kanban, unidade_id, data_agendamento, periodo_agendamento")
    .eq("tipo_atendimento", "IH")
    .like("coluna_kanban", "rota_%");

  if (unidadeId) queryRotaOS = queryRotaOS.eq("unidade_id", unidadeId);

  const { data: osRota, error: errRota } = await queryRotaOS;
  if (errRota) throw new Error(`Erro ao buscar OS rota: ${errRota.message}`);

  // Get agendamentos for those OS
  const osRotaIds = (osRota || []).map((o) => o.id);
  let agendamentosRota: any[] = [];
  if (osRotaIds.length > 0) {
    const { data } = await supabase
      .from("agendamentos")
      .select("id, os_id, data_agendamento, status, confirmado_cliente, confirmado_com_cliente")
      .in("os_id", osRotaIds)
      .in("status", ["agendado", "confirmado", "pendente_confirmacao"]);
    agendamentosRota = data || [];
  }

  const agendamentoMap: Record<string, typeof agendamentosRota> = {};
  for (const a of agendamentosRota) {
    if (!agendamentoMap[a.os_id]) agendamentoMap[a.os_id] = [];
    agendamentoMap[a.os_id].push(a);
  }

  // FTF without date or confirmation
  const osSemDataConfirmacao = (osRota || []).filter((o) => {
    const ags = agendamentoMap[o.id] || [];
    if (ags.length === 0) return true;
    const temData = ags.some((a) => a.data_agendamento);
    const temConfirmacao = ags.some((a) => a.confirmado_cliente || a.confirmado_com_cliente);
    return !temData || !temConfirmacao;
  });

  // OS IH em_reparo_ih with past date
  let queryReparoIH = supabase
    .from("os")
    .select("id, numero_os_interna, numero_os_samsung, cliente_nome, coluna_kanban, unidade_id, data_agendamento")
    .eq("tipo_atendimento", "IH")
    .in("coluna_kanban", ["em_reparo_ih", "em_rota_ih"]);

  if (unidadeId) queryReparoIH = queryReparoIH.eq("unidade_id", unidadeId);

  const { data: osReparo, error: errReparo } = await queryReparoIH;
  if (errReparo) throw new Error(`Erro ao buscar OS reparo IH: ${errReparo.message}`);

  const osReparoIds = (osReparo || []).map((o) => o.id);
  let agendamentosReparo: any[] = [];
  if (osReparoIds.length > 0) {
    const { data } = await supabase
      .from("agendamentos")
      .select("id, os_id, data_agendamento, status, confirmado_cliente, confirmado_com_cliente")
      .in("os_id", osReparoIds)
      .in("status", ["agendado", "confirmado", "pendente_confirmacao"]);
    agendamentosReparo = data || [];
  }

  const agRepMap: Record<string, typeof agendamentosReparo> = {};
  for (const a of agendamentosReparo) {
    if (!agRepMap[a.os_id]) agRepMap[a.os_id] = [];
    agRepMap[a.os_id].push(a);
  }

  const osDataErrada = (osReparo || []).filter((o) => {
    const ags = agRepMap[o.id] || [];
    if (ags.length === 0) return true;
    const dataPassada = ags.some((a) => a.data_agendamento && a.data_agendamento < today);
    const semData = !ags.some((a) => a.data_agendamento);
    return dataPassada || semData;
  });

  // Group by unidade
  const ftfPorUnidade: Record<string, typeof osSemDataConfirmacao> = {};
  for (const o of osSemDataConfirmacao) {
    const uid = o.unidade_id || "sem_unidade";
    if (!ftfPorUnidade[uid]) ftfPorUnidade[uid] = [];
    ftfPorUnidade[uid].push(o);
  }

  const reparoPorUnidade: Record<string, typeof osDataErrada> = {};
  for (const o of osDataErrada) {
    const uid = o.unidade_id || "sem_unidade";
    if (!reparoPorUnidade[uid]) reparoPorUnidade[uid] = [];
    reparoPorUnidade[uid].push(o);
  }

  const allUnidadeIds = new Set([
    ...Object.keys(ftfPorUnidade),
    ...Object.keys(reparoPorUnidade),
  ]);

  const porUnidade = Array.from(allUnidadeIds)
    .map((uid) => ({
      unidade: unidadeMap[uid] || uid,
      ftf_sem_data_confirmacao: (ftfPorUnidade[uid] || []).length,
      reparo_data_errada: (reparoPorUnidade[uid] || []).length,
      total_problemas: (ftfPorUnidade[uid] || []).length + (reparoPorUnidade[uid] || []).length,
      detalhes_ftf: (ftfPorUnidade[uid] || []).slice(0, 10).map((o) => ({
        os: o.numero_os_samsung || o.numero_os_interna || o.id,
        cliente: o.cliente_nome,
        rota: o.coluna_kanban,
      })),
      detalhes_reparo: (reparoPorUnidade[uid] || []).slice(0, 10).map((o) => ({
        os: o.numero_os_samsung || o.numero_os_interna || o.id,
        cliente: o.cliente_nome,
        coluna: o.coluna_kanban,
      })),
    }))
    .sort((a, b) => b.total_problemas - a.total_problemas);

  const resumoTexto = [
    `AGENDAMENTOS IH - ${now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
    ``,
    `FTF sem data/confirmacao: ${osSemDataConfirmacao.length} OS`,
    `Reparo IH com data errada: ${osDataErrada.length} OS`,
    `Total problemas: ${osSemDataConfirmacao.length + osDataErrada.length}`,
    ``,
    `Por unidade:`,
    ...porUnidade.map((u) =>
      `  ${u.unidade}: ${u.ftf_sem_data_confirmacao} FTF pendentes, ${u.reparo_data_errada} com data errada`
    ),
  ].join("\n");

  return {
    titulo: "Agendamentos IH",
    subtitulo: `${osSemDataConfirmacao.length} FTF sem data/confirm. + ${osDataErrada.length} reparo data errada`,
    gerado_em: now.toISOString(),
    horario_disparo: now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }),
    ftf_sem_data_confirmacao: {
      total: osSemDataConfirmacao.length,
      os_list: osSemDataConfirmacao.slice(0, 20).map((o) => ({
        os: o.numero_os_samsung || o.numero_os_interna || o.id,
        cliente: o.cliente_nome,
        rota: o.coluna_kanban,
        unidade: unidadeMap[o.unidade_id || ""] || o.unidade_id,
      })),
    },
    reparo_data_errada: {
      total: osDataErrada.length,
      os_list: osDataErrada.slice(0, 20).map((o) => ({
        os: o.numero_os_samsung || o.numero_os_interna || o.id,
        cliente: o.cliente_nome,
        coluna: o.coluna_kanban,
        unidade: unidadeMap[o.unidade_id || ""] || o.unidade_id,
      })),
    },
    por_unidade: porUnidade,
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

  let queryAlertas = supabase
    .from("os_alertas_fechamento")
    .select("id, os_id, unidade_id, regra_codigo, regra_titulo, categoria, severidade, mensagem, created_at")
    .eq("resolvido", false)
    .eq("ignorado", false);

  if (unidadeId) queryAlertas = queryAlertas.eq("unidade_id", unidadeId);

  const { data: alertas, error: errAlertas } = await queryAlertas.order("created_at", { ascending: false });
  if (errAlertas) throw new Error(`Erro ao buscar alertas: ${errAlertas.message}`);

  let queryPecas = supabase
    .from("estoque_pecas")
    .select("id, pn, descricao, valor_com_impostos, unidade_id, status")
    .in("status", ["disponivel", "reservada"]);

  if (unidadeId) queryPecas = queryPecas.eq("unidade_id", unidadeId);

  const { data: pecas, error: errPecas } = await queryPecas;
  if (errPecas) throw new Error(`Erro ao buscar pecas: ${errPecas.message}`);

  const alertasList = alertas || [];
  const pecasList = pecas || [];

  const semPN = pecasList.filter((p) => !p.pn || p.pn.trim() === "");
  const semValor = pecasList.filter((p) => !p.valor_com_impostos || Number(p.valor_com_impostos) === 0);

  const alertasPorUnidade: Record<string, typeof alertasList> = {};
  for (const a of alertasList) {
    const uid = a.unidade_id || "sem_unidade";
    if (!alertasPorUnidade[uid]) alertasPorUnidade[uid] = [];
    alertasPorUnidade[uid].push(a);
  }

  const alertasPorCategoria: Record<string, { bloqueante: number; alerta: number }> = {};
  for (const a of alertasList) {
    const cat = a.categoria || "outros";
    if (!alertasPorCategoria[cat]) alertasPorCategoria[cat] = { bloqueante: 0, alerta: 0 };
    if (a.severidade === "bloqueante") alertasPorCategoria[cat].bloqueante++;
    else alertasPorCategoria[cat].alerta++;
  }

  const semPNPorUnidade: Record<string, number> = {};
  for (const p of semPN) {
    const uid = p.unidade_id || "sem_unidade";
    semPNPorUnidade[uid] = (semPNPorUnidade[uid] || 0) + 1;
  }
  const semValorPorUnidade: Record<string, number> = {};
  for (const p of semValor) {
    const uid = p.unidade_id || "sem_unidade";
    semValorPorUnidade[uid] = (semValorPorUnidade[uid] || 0) + 1;
  }

  const bloqueantes = alertasList.filter((a) => a.severidade === "bloqueante").length;
  const alertasCount = alertasList.filter((a) => a.severidade === "alerta").length;

  const unidadesReport = Object.entries(alertasPorUnidade)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([uid, lista]) => {
      const porCat: Record<string, number> = {};
      for (const a of lista) {
        const cat = a.categoria || "outros";
        porCat[cat] = (porCat[cat] || 0) + 1;
      }
      return {
        unidade: unidadeMap[uid] || uid,
        total_alertas: lista.length,
        bloqueantes: lista.filter((a) => a.severidade === "bloqueante").length,
        por_categoria: porCat,
        exemplos: lista.slice(0, 5).map((a) => ({
          regra: a.regra_titulo || a.regra_codigo,
          categoria: a.categoria,
          severidade: a.severidade,
          mensagem: a.mensagem,
        })),
      };
    });

  const resumoTexto = [
    `COMPLIANCE E ERROS - ${now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
    ``,
    `Alertas nao resolvidos: ${alertasList.length}`,
    `  Bloqueantes: ${bloqueantes}`,
    `  Alertas: ${alertasCount}`,
    ``,
    `Por categoria:`,
    ...Object.entries(alertasPorCategoria)
      .sort((a, b) => (b[1].bloqueante + b[1].alerta) - (a[1].bloqueante + a[1].alerta))
      .map(([cat, data]) => `  ${cat}: ${data.bloqueante} bloqueantes, ${data.alerta} alertas`),
    ``,
    `Por unidade:`,
    ...unidadesReport.map((u) => `  ${u.unidade}: ${u.total_alertas} alertas (${u.bloqueantes} bloqueantes)`),
    ``,
    `Problemas Pecas:`,
    `  Sem PN: ${semPN.length}`,
    `  Valor R$0: ${semValor.length}`,
    ...(semPN.length > 0 ? [`  Sem PN por unidade:`, ...Object.entries(semPNPorUnidade).sort((a, b) => b[1] - a[1]).map(([uid, n]) => `    ${unidadeMap[uid] || uid}: ${n}`)] : []),
    ...(semValor.length > 0 ? [`  Valor R$0 por unidade:`, ...Object.entries(semValorPorUnidade).sort((a, b) => b[1] - a[1]).map(([uid, n]) => `    ${unidadeMap[uid] || uid}: ${n}`)] : []),
  ].join("\n");

  return {
    titulo: "Compliance e Erros",
    subtitulo: `${alertasList.length} alertas (${bloqueantes} bloqueantes) / Pecas: ${semPN.length} sem PN, ${semValor.length} sem valor`,
    gerado_em: now.toISOString(),
    horario_disparo: now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }),
    alertas: {
      total: alertasList.length,
      bloqueantes,
      alertas: alertasCount,
      por_categoria: alertasPorCategoria,
    },
    problemas_pecas: {
      sem_pn: semPN.length,
      sem_valor: semValor.length,
      sem_pn_por_unidade: Object.entries(semPNPorUnidade).sort((a, b) => b[1] - a[1]).map(([uid, total]) => ({
        unidade: unidadeMap[uid] || uid,
        total,
      })),
      sem_valor_por_unidade: Object.entries(semValorPorUnidade).sort((a, b) => b[1] - a[1]).map(([uid, total]) => ({
        unidade: unidadeMap[uid] || uid,
        total,
      })),
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

  const resumoTexto = [
    `LIMITE DE CREDITO GSPN - ${now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
    ``,
    `TOTAL GERAL:`,
    `  Limite: ${fmt(limiteGlobal)} | Consumido: ${fmt(consumidoGlobal)} | Livre: ${fmt(livreGlobal)}`,
    `  Uso: ${percentualGlobal}%`,
    ``,
    ...porUnidade.map((u) => [
      `${u.unidade}${u.critico ? " [CRITICO]" : u.alerta ? " [ALERTA]" : ""}`,
      `  Limite: ${fmt(u.limite_total)} | Consumido: ${fmt(u.consumido)} | Livre: ${fmt(u.livre)} | ${u.percentual_uso}%`,
      `  Disponivel: ${u.categorias.disponivel.quantidade} (${fmt(u.categorias.disponivel.valor)})`,
      `  Com tecnico: ${u.categorias.com_tecnico.quantidade} (${fmt(u.categorias.com_tecnico.valor)})`,
      `  Com defeito: ${u.categorias.com_defeito.quantidade} (${fmt(u.categorias.com_defeito.valor)})`,
      `  Em OS aberta: ${u.categorias.em_os_aberta.quantidade} (${fmt(u.categorias.em_os_aberta.valor)})`,
      `  Pedidos ativos: ${u.categorias.pedidos_ativos.quantidade} (${fmt(u.categorias.pedidos_ativos.valor)})`,
      `  Devolvida (nao consome): ${u.categorias.devolvida.quantidade} (${fmt(u.categorias.devolvida.valor)})`,
    ].join("\n")),
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
    .select("id, codigo_peca, descricao, quantidade_requisitada, status, unidade_id, created_at, numero_os_samsung, os_id")
    .eq("status", "pendente");

  if (unidadeId) queryReq = queryReq.eq("unidade_id", unidadeId);

  const { data: pendentes, error: errPend } = await queryReq.order("created_at", { ascending: true });
  if (errPend) throw new Error(`Erro ao buscar requisicoes: ${errPend.message}`);

  let queryPecas = supabase
    .from("estoque_pecas")
    .select("id, pn, descricao, valor_com_impostos, status, unidade_id")
    .eq("status", "disponivel");

  if (unidadeId) queryPecas = queryPecas.eq("unidade_id", unidadeId);

  const { data: pecasDisponiveis, error: errPecas } = await queryPecas;
  if (errPecas) throw new Error(`Erro ao buscar pecas: ${errPecas.message}`);

  const pecasList = pecasDisponiveis || [];
  const pendentesList = pendentes || [];

  const semPreco = pecasList.filter((p) => !p.valor_com_impostos || Number(p.valor_com_impostos) === 0);
  const semCodigo = pecasList.filter((p) => !p.pn || p.pn.trim() === "");

  const pendentesPorUnidade: Record<string, typeof pendentesList> = {};
  for (const r of pendentesList) {
    const uid = r.unidade_id || "sem_unidade";
    if (!pendentesPorUnidade[uid]) pendentesPorUnidade[uid] = [];
    pendentesPorUnidade[uid].push(r);
  }

  const pendentesComIdade = pendentesList.map((r) => {
    const minutos = (now.getTime() - new Date(r.created_at).getTime()) / (1000 * 60);
    return { ...r, minutos_pendente: minutos };
  });

  const criticas = pendentesComIdade.filter((r) => r.minutos_pendente > 48 * 60);
  const alerta = pendentesComIdade.filter((r) => r.minutos_pendente > 24 * 60 && r.minutos_pendente <= 48 * 60);
  const recentes = pendentesComIdade.filter((r) => r.minutos_pendente <= 24 * 60);

  const unidadesReport = Object.entries(pendentesPorUnidade)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([uid, lista]) => ({
      unidade: unidadeMap[uid] || uid,
      total_pendentes: lista.length,
      requisicoes: lista.slice(0, 10).map((r) => ({
        codigo: r.codigo_peca || "Sem codigo",
        descricao: r.descricao || "-",
        quantidade: r.quantidade_requisitada,
        os: r.numero_os_samsung || "-",
        tempo_pendente: formatDuration((now.getTime() - new Date(r.created_at).getTime()) / (1000 * 60)),
      })),
    }));

  const semPrecoPorUnidade: Record<string, number> = {};
  for (const p of semPreco) {
    const uid = p.unidade_id || "sem_unidade";
    semPrecoPorUnidade[uid] = (semPrecoPorUnidade[uid] || 0) + 1;
  }

  const semCodigoPorUnidade: Record<string, number> = {};
  for (const p of semCodigo) {
    const uid = p.unidade_id || "sem_unidade";
    semCodigoPorUnidade[uid] = (semCodigoPorUnidade[uid] || 0) + 1;
  }

  const resumoTexto = [
    `NUCLEO DE PECAS - ${now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
    ``,
    `Requisicoes pendentes: ${pendentesList.length}`,
    `  Criticas (+48h): ${criticas.length}`,
    `  Alerta (+24h): ${alerta.length}`,
    `  Recentes (-24h): ${recentes.length}`,
    ``,
    `Pecas com problemas no estoque:`,
    `  Sem preco: ${semPreco.length}`,
    `  Sem codigo (PN): ${semCodigo.length}`,
    ``,
    `Requisicoes por unidade:`,
    ...unidadesReport.map((u) => `  ${u.unidade}: ${u.total_pendentes} pendentes`),
    ``,
    `Sem preco por unidade:`,
    ...Object.entries(semPrecoPorUnidade).sort((a, b) => b[1] - a[1]).map(([uid, n]) => `  ${unidadeMap[uid] || uid}: ${n} pecas`),
    ``,
    `Sem codigo por unidade:`,
    ...Object.entries(semCodigoPorUnidade).sort((a, b) => b[1] - a[1]).map(([uid, n]) => `  ${unidadeMap[uid] || uid}: ${n} pecas`),
  ].join("\n");

  return {
    titulo: "Nucleo de Pecas",
    subtitulo: `${pendentesList.length} requisicoes pendentes / ${semPreco.length} sem preco / ${semCodigo.length} sem codigo`,
    gerado_em: now.toISOString(),
    horario_disparo: now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }),
    requisicoes_pendentes: {
      total: pendentesList.length,
      criticas: criticas.length,
      alerta: alerta.length,
      recentes: recentes.length,
    },
    pecas_problemas: {
      sem_preco: semPreco.length,
      sem_codigo: semCodigo.length,
    },
    por_unidade: unidadesReport,
    sem_preco_por_unidade: Object.entries(semPrecoPorUnidade).sort((a, b) => b[1] - a[1]).map(([uid, total]) => ({
      unidade: unidadeMap[uid] || uid,
      total,
    })),
    sem_codigo_por_unidade: Object.entries(semCodigoPorUnidade).sort((a, b) => b[1] - a[1]).map(([uid, total]) => ({
      unidade: unidadeMap[uid] || uid,
      total,
    })),
    resumo_texto: resumoTexto,
  };
}

async function gerarMapaRotas(supabase: ReturnType<typeof createClient>, unidadeId?: string) {
  const now = new Date();

  // Fetch units
  const { data: unidades } = await supabase.from("unidades").select("id, nome");
  const unidadeMap: Record<string, string> = {};
  if (unidades) {
    for (const u of unidades) unidadeMap[u.id] = u.nome;
  }

  // Fetch technicians
  const { data: tecnicos } = await supabase.from("usuarios").select("id, nome");
  const tecnicoMap: Record<string, string> = {};
  if (tecnicos) {
    for (const t of tecnicos) tecnicoMap[t.id] = t.nome;
  }

  // Fetch active routes (today or recent)
  let queryRotas = supabase
    .from("rotas_otimizadas")
    .select("id, nome, cor, tecnico_id, unidade_id, data_rota, status_rota, total_os, cidades")
    .neq("status_rota", "cancelada");

  if (unidadeId) queryRotas = queryRotas.eq("unidade_id", unidadeId);

  const { data: rotas, error: errRotas } = await queryRotas.order("data_rota", { ascending: false }).limit(100);
  if (errRotas) throw new Error(`Erro ao buscar rotas: ${errRotas.message}`);

  // Fetch active OS (not archived, not closed) to check which are routed
  let queryOS = supabase
    .from("os")
    .select("id, numero_os_samsung, numero_os_interna, cliente_nome, tipo_os, tipo_atendimento, coluna_kanban, rota_id, unidade_id")
    .neq("coluna_kanban", "os_fechada")
    .or("arquivada.is.null,arquivada.eq.false");

  if (unidadeId) queryOS = queryOS.eq("unidade_id", unidadeId);

  const { data: osAtivas, error: errOS } = await queryOS;
  if (errOS) throw new Error(`Erro ao buscar OS ativas: ${errOS.message}`);

  const osList = osAtivas || [];

  // OS in route columns (kanban-based)
  const rotaColumns = ["rota_verde", "rota_azul", "rota_amarela", "rota_vermelha", "rota_laranja", "rota_rosa", "rota_preta", "em_rota_ih"];
  const osEmRotaKanban = osList.filter((os) => rotaColumns.includes(os.coluna_kanban));
  const osComRotaId = osList.filter((os) => os.rota_id);
  const osEmRota = osList.filter((os) => rotaColumns.includes(os.coluna_kanban) || os.rota_id);
  const osSemRota = osList.filter((os) => !rotaColumns.includes(os.coluna_kanban) && !os.rota_id);

  // OS IH que deveriam ter rota mas nao tem
  const osIHSemRota = osSemRota.filter((os) => os.tipo_atendimento?.toUpperCase() === "IH");

  // Group OS by route column
  const porRotaKanban: Record<string, typeof osList> = {};
  for (const os of osEmRotaKanban) {
    const col = os.coluna_kanban;
    if (!porRotaKanban[col]) porRotaKanban[col] = [];
    porRotaKanban[col].push(os);
  }

  // Group OS sem rota by unidade
  const semRotaPorUnidade: Record<string, typeof osList> = {};
  for (const os of osIHSemRota) {
    const uid = os.unidade_id || "sem_unidade";
    if (!semRotaPorUnidade[uid]) semRotaPorUnidade[uid] = [];
    semRotaPorUnidade[uid].push(os);
  }

  // Route distribution
  const distribuicaoRotas = Object.entries(porRotaKanban)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([coluna, lista]) => ({
      rota: getColunaLabel(coluna),
      coluna,
      total_os: lista.length,
      tipos: {
        LP: lista.filter((os) => os.tipo_os === "LP").length,
        OW: lista.filter((os) => os.tipo_os === "OW").length,
      },
      os_list: lista.slice(0, 15).map((os) => ({
        numero: os.numero_os_samsung || os.numero_os_interna || os.id.slice(0, 8),
        cliente: os.cliente_nome || "Sem cliente",
        tipo: `${os.tipo_os || "-"}-${os.tipo_atendimento || "-"}`,
      })),
    }));

  // Rotas otimizadas ativas (from rotas_otimizadas table)
  const rotasAtivas = (rotas || []).filter((r) => r.status_rota !== "concluida").map((r) => ({
    id: r.id,
    nome: r.nome || "Sem nome",
    cor: r.cor || "-",
    tecnico: tecnicoMap[r.tecnico_id] || "-",
    unidade: unidadeMap[r.unidade_id] || "-",
    data_rota: r.data_rota,
    status: r.status_rota,
    total_os: r.total_os || 0,
    cidades: r.cidades || [],
  }));

  // Unidades com mais OS IH sem rota
  const semRotaResumoPorUnidade = Object.entries(semRotaPorUnidade)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([uid, lista]) => ({
      unidade: unidadeMap[uid] || uid,
      total: lista.length,
      os_list: lista.slice(0, 10).map((os) => ({
        numero: os.numero_os_samsung || os.numero_os_interna || os.id.slice(0, 8),
        cliente: os.cliente_nome || "Sem cliente",
        tipo: os.tipo_os || "-",
      })),
    }));

  const resumoTexto = [
    `MAPA DE ROTAS - ${now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
    ``,
    `OS ativas: ${osList.length}`,
    `Em rota: ${osEmRota.length} | Sem rota: ${osSemRota.length}`,
    `OS IH sem rota designada: ${osIHSemRota.length}`,
    ``,
    `Distribuicao por rota:`,
    ...distribuicaoRotas.map((r) => `  ${r.rota}: ${r.total_os} OS (LP: ${r.tipos.LP} | OW: ${r.tipos.OW})`),
    ``,
    `OS IH sem rota por unidade:`,
    ...semRotaResumoPorUnidade.map((u) => `  ${u.unidade}: ${u.total} OS`),
    ``,
    `Rotas planejadas ativas: ${rotasAtivas.length}`,
    ...rotasAtivas.slice(0, 10).map((r) => `  ${r.nome} (${r.cor}) - ${r.tecnico} - ${r.total_os} OS - ${r.status}`),
  ].join("\n");

  return {
    titulo: "Mapa de Rotas",
    subtitulo: `${osEmRota.length} OS em rota / ${osIHSemRota.length} IH sem rota`,
    gerado_em: now.toISOString(),
    horario_disparo: now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }),
    totais: {
      os_ativas: osList.length,
      em_rota: osEmRota.length,
      sem_rota: osSemRota.length,
      ih_sem_rota: osIHSemRota.length,
    },
    distribuicao_rotas: distribuicaoRotas,
    rotas_planejadas: rotasAtivas,
    ih_sem_rota_por_unidade: semRotaResumoPorUnidade,
    resumo_texto: resumoTexto,
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

  const resumoTexto = [
    `ABERTURA E FECHAMENTO - ${now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
    ``,
    `Resumo do dia:`,
    `  Abertas: ${totalAbertas} | Fechadas: ${totalFechadas} | Saldo: ${saldoGeral >= 0 ? "+" : ""}${saldoGeral}`,
    ``,
    `Abertas por tipo:`,
    `  LP-CI: ${categoriasAbertas["LP-CI"]} | LP-IH: ${categoriasAbertas["LP-IH"]} | OW-CI: ${categoriasAbertas["OW-CI"]} | OW-IH: ${categoriasAbertas["OW-IH"]}`,
    ``,
    `Fechadas por tipo:`,
    `  LP-CI: ${categoriasFechadas["LP-CI"]} | LP-IH: ${categoriasFechadas["LP-IH"]} | OW-CI: ${categoriasFechadas["OW-CI"]} | OW-IH: ${categoriasFechadas["OW-IH"]}`,
    ``,
    `Por unidade:`,
    ...unidadesReport.map((u) =>
      `  ${u.unidade_nome}: +${u.abertas.total} abertas / -${u.fechadas.total} fechadas (saldo: ${u.saldo >= 0 ? "+" : ""}${u.saldo})`
    ),
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
