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
  diagnostico: "Diagnostico",
  aguardando_peca: "Aguardando Peca",
  peca_em_transito: "Peca em Transito",
  aguardando_aprovacao: "Aguardando Aprovacao",
  negociacao_em_andamento: "Negociacao em Andamento",
  orcamento_aprovado: "Orcamento Aprovado",
  em_reparo_ci: "Em Reparo CI",
  em_reparo_ih: "Em Reparo IH",
  em_rota_ih: "Em Rota IH",
  controle_qualidade: "Controle de Qualidade",
  reparo_concluido: "Reparo Concluido",
  aguardando_fechamento: "Aguardando Fechamento",
  rota_verde: "Rota Verde",
  rota_azul: "Rota Azul",
  rota_amarela: "Rota Amarela",
  rota_vermelha: "Rota Vermelha",
  rota_laranja: "Rota Laranja",
  rota_rosa: "Rota Rosa",
  rota_preta: "Rota Preta",
  instalacao_inicial: "Instalacao Inicial",
  service_handling: "Service Handling",
  return_handling: "Return Handling",
  saw: "SAW",
  qa_bt: "QA/BT",
  trade_up: "Trade Up",
  orcamentos_rejeitados: "Orcamentos Rejeitados",
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

  const colunasOrdenadas = Object.entries(osPorColuna)
    .sort((a, b) => b[1].length - a[1].length)
    .map(([coluna, lista]) => {
      const osCriticas = lista.filter((os) => os.minutos_parada > 24 * 60).length;
      const osAlerta = lista.filter((os) => os.minutos_parada > 8 * 60 && os.minutos_parada <= 24 * 60).length;

      return {
        coluna,
        label: getColunaLabel(coluna),
        total: lista.length,
        criticas: osCriticas,
        alerta: osAlerta,
        os_list: lista
          .sort((a, b) => b.minutos_parada - a.minutos_parada)
          .map((os) => ({
            numero: os.numero_os_samsung || os.numero_os_interna || os.id.slice(0, 8),
            cliente: os.cliente_nome || "Sem cliente",
            tipo: os.tipo_os || "-",
            tempo_parada: formatDuration(os.minutos_parada),
            minutos_parada: Math.round(os.minutos_parada),
            severidade: os.minutos_parada > 24 * 60 ? "critica" : os.minutos_parada > 8 * 60 ? "alerta" : "atencao",
          })),
      };
    });

  const totalCriticas = colunasOrdenadas.reduce((acc, c) => acc + c.criticas, 0);
  const totalAlerta = colunasOrdenadas.reduce((acc, c) => acc + c.alerta, 0);
  const totalOS = osParadas.length;

  const topGargalos = colunasOrdenadas.slice(0, 3).map((c) => `${c.label} (${c.total})`).join(", ");

  const resumoTexto = [
    `PULSO OPERACIONAL - ${now.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
    ``,
    `Total de OS paradas (+2h): ${totalOS}`,
    `Criticas (+24h): ${totalCriticas} | Alerta (+8h): ${totalAlerta}`,
    ``,
    `Maiores gargalos: ${topGargalos}`,
    ``,
    ...colunasOrdenadas.map((col) => {
      const header = `--- ${col.label} (${col.total} OS) ---`;
      const items = col.os_list.slice(0, 10).map(
        (os) => `  ${os.severidade === "critica" ? "🚨" : os.severidade === "alerta" ? "⚠️" : "⏰"} ${os.numero} | ${os.cliente} | ${os.tempo_parada}`
      );
      if (col.os_list.length > 10) items.push(`  ... e mais ${col.os_list.length - 10} OS`);
      return [header, ...items, ""].join("\n");
    }),
  ].join("\n");

  return {
    titulo: "Pulso Operacional",
    subtitulo: `${totalOS} OS paradas ha mais de 2 horas`,
    gerado_em: now.toISOString(),
    horario_disparo: now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }),
    total_os_paradas: totalOS,
    total_criticas: totalCriticas,
    total_alerta: totalAlerta,
    maiores_gargalos: topGargalos,
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
      default:
        return new Response(
          JSON.stringify({ error: `Tipo de relatorio desconhecido: ${tipo}. Tipos disponiveis: pulso_operacional, abertura_fechamento, mapa_rotas, nucleo_pecas, estoque_dia` }),
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
