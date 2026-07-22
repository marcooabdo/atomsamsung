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
      default:
        return new Response(
          JSON.stringify({ error: `Tipo de relatorio desconhecido: ${tipo}. Tipos disponiveis: pulso_operacional` }),
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
