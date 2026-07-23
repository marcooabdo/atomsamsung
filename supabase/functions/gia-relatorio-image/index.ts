import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { render } from "https://deno.land/x/resvg_wasm@0.2.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function svgToPng(svgString: string): Promise<Uint8Array> {
  const png = await render(svgString);
  return png;
}

const COLUNA_LABELS: Record<string, string> = {
  os_nova: "OS Nova",
  diagnostico: "Diagnóstico",
  negociacao_em_andamento: "Negociação",
  aguardando_aprovacao: "Ag. Aprovação",
  orcamento_aprovado: "Orç. Aprovado",
  aguardando_peca: "Ag. Peça",
  peca_em_transito: "Peça em Trânsito",
  em_reparo_ci: "Reparo CI",
  rota_preta: "Rota Preta",
  rota_vermelha: "Rota Vermelha",
  rota_azul: "Rota Azul",
  rota_verde: "Rota Verde",
  rota_rosa: "Rota Rosa",
  rota_amarela: "Rota Amarela",
  rota_laranja: "Rota Laranja",
  em_rota_ih: "Agendados (FTF)",
  em_reparo_ih: "Reparo IH",
  instalacao_inicial: "Instalação Inicial",
  service_handling: "Service Handling",
  return_handling: "Return Handling",
  trade_up: "Trade Up",
  saw: "SAW",
  controle_qualidade: "CQ / OQC",
  qa_bt: "Q&A / BT",
  reparo_concluido: "Reparo Concluído",
  aguardando_fechamento: "Ag. Fechamento",
  orcamentos_rejeitados: "Orç. Rejeitados",
};

function getColunaLabel(coluna: string): string {
  return COLUNA_LABELS[coluna] || coluna.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDuration(minutes: number): string {
  if (minutes < 60) return `${Math.round(minutes)}min`;
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours < 24) return mins > 0 ? `${hours}h${mins}min` : `${hours}h`;
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}

function getSeverityColor(minutes: number): { bg: string; text: string; dot: string } {
  if (minutes <= 0) return { bg: "#1a2332", text: "#8899aa", dot: "#4a5568" };
  if (minutes < 24 * 60) return { bg: "#0d2818", text: "#4ade80", dot: "#22c55e" };
  if (minutes < 48 * 60) return { bg: "#2d1f00", text: "#fbbf24", dot: "#f59e0b" };
  return { bg: "#2d0f0f", text: "#f87171", dot: "#ef4444" };
}

interface UnitData {
  sigla: string;
  nome: string;
  totalOS: number;
  colunas: Array<{
    label: string;
    total: number;
    oldestMinutes: number;
    oldestFormatted: string;
  }>;
}

function generateDashboardSVG(unit: UnitData, horario: string): string {
  const filteredColunas = unit.colunas.filter(c => c.total > 0);
  const rowHeight = 38;
  const headerHeight = 110;
  const footerHeight = 50;
  const tableHeaderHeight = 36;
  const contentHeight = filteredColunas.length * rowHeight;
  const totalHeight = headerHeight + tableHeaderHeight + contentHeight + footerHeight + 20;
  const width = 600;

  let rows = "";
  filteredColunas.forEach((col, i) => {
    const y = headerHeight + tableHeaderHeight + i * rowHeight;
    const severity = getSeverityColor(col.oldestMinutes);
    const bgColor = i % 2 === 0 ? "#111827" : "#0f1521";

    rows += `
      <rect x="0" y="${y}" width="${width}" height="${rowHeight}" fill="${bgColor}" />
      <circle cx="28" cy="${y + rowHeight / 2}" r="5" fill="${severity.dot}" />
      <text x="44" y="${y + rowHeight / 2 + 5}" font-family="Arial, sans-serif" font-size="13" fill="#e2e8f0">${escapeXml(col.label)}</text>
      <text x="${width - 180}" y="${y + rowHeight / 2 + 5}" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="#ffffff" text-anchor="end">${col.total} OS</text>
      <text x="${width - 24}" y="${y + rowHeight / 2 + 5}" font-family="Arial, sans-serif" font-size="12" fill="${severity.text}" text-anchor="end">${col.oldestMinutes > 0 ? col.oldestFormatted : "—"}</text>
    `;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}">
  <defs>
    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#0f172a;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#1e293b;stop-opacity:1" />
    </linearGradient>
  </defs>
  
  <!-- Background -->
  <rect width="${width}" height="${totalHeight}" fill="#0a0f1a" rx="12" ry="12" />
  
  <!-- Header -->
  <rect x="0" y="0" width="${width}" height="${headerHeight}" fill="url(#headerGrad)" rx="12" ry="12" />
  <rect x="0" y="${headerHeight - 12}" width="${width}" height="12" fill="url(#headerGrad)" />
  
  <!-- Header content -->
  <text x="24" y="36" font-family="Arial, sans-serif" font-size="11" fill="#64748b" letter-spacing="2">PULSO OPERACIONAL</text>
  <text x="24" y="66" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#ffffff">${escapeXml(unit.sigla)} — ${escapeXml(unit.nome)}</text>
  <text x="24" y="92" font-family="Arial, sans-serif" font-size="14" fill="#94a3b8">${unit.totalOS} OS abertas • ${horario}</text>
  
  <!-- Total badge -->
  <rect x="${width - 90}" y="20" width="66" height="66" rx="10" ry="10" fill="#1e3a5f" />
  <text x="${width - 57}" y="52" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#60a5fa" text-anchor="middle">${unit.totalOS}</text>
  <text x="${width - 57}" y="72" font-family="Arial, sans-serif" font-size="10" fill="#94a3b8" text-anchor="middle">TOTAL</text>
  
  <!-- Table header -->
  <rect x="0" y="${headerHeight}" width="${width}" height="${tableHeaderHeight}" fill="#0d1117" />
  <text x="44" y="${headerHeight + 22}" font-family="Arial, sans-serif" font-size="10" fill="#64748b" letter-spacing="1">ETAPA</text>
  <text x="${width - 180}" y="${headerHeight + 22}" font-family="Arial, sans-serif" font-size="10" fill="#64748b" letter-spacing="1" text-anchor="end">QTD</text>
  <text x="${width - 24}" y="${headerHeight + 22}" font-family="Arial, sans-serif" font-size="10" fill="#64748b" letter-spacing="1" text-anchor="end">MAIS ANTIGA</text>
  
  <!-- Rows -->
  ${rows}
  
  <!-- Footer -->
  <rect x="0" y="${totalHeight - footerHeight}" width="${width}" height="${footerHeight}" fill="#0a0f1a" rx="0" ry="0" />
  <rect x="0" y="${totalHeight - 12}" width="${width}" height="12" fill="#0a0f1a" rx="12" ry="12" />
  <line x1="24" y1="${totalHeight - footerHeight + 1}" x2="${width - 24}" y2="${totalHeight - footerHeight + 1}" stroke="#1e293b" stroke-width="1" />
  <text x="${width / 2}" y="${totalHeight - 18}" font-family="Arial, sans-serif" font-size="11" fill="#475569" text-anchor="middle">GIA • Global Intelligence Assistance</text>
</svg>`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const horario = now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });

    // Fetch unidades
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
    const allOS: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from("os")
        .select("id, numero_os_samsung, numero_os_interna, cliente_nome, coluna_kanban, coluna_kanban_desde, tipo_os, unidade_id")
        .not("coluna_kanban", "is", null)
        .neq("coluna_kanban", "os_fechada")
        .or("arquivada.is.null,arquivada.eq.false")
        .range(from, from + pageSize - 1)
        .order("coluna_kanban_desde", { ascending: true, nullsFirst: false });
      if (error) throw new Error(`Erro ao buscar OS: ${error.message}`);
      if (data && data.length > 0) {
        allOS.push(...data);
        from += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    // Group by unidade
    const osPorUnidade: Record<string, typeof allOS> = {};
    for (const os of allOS) {
      const uid = os.unidade_id || "sem_unidade";
      if (!osPorUnidade[uid]) osPorUnidade[uid] = [];
      osPorUnidade[uid].push(os);
    }

    // Build unit data
    const unitDataList: UnitData[] = [];
    for (const [uid, osList] of Object.entries(osPorUnidade)) {
      if (uid === "sem_unidade") continue;
      
      const osPorColuna: Record<string, typeof allOS> = {};
      for (const os of osList) {
        const col = os.coluna_kanban || "sem_coluna";
        if (!osPorColuna[col]) osPorColuna[col] = [];
        osPorColuna[col].push(os);
      }

      const colunas: UnitData["colunas"] = [];
      for (const [col, osCol] of Object.entries(osPorColuna)) {
        let oldestMinutes = 0;
        for (const os of osCol) {
          if (os.coluna_kanban_desde) {
            const diff = (now.getTime() - new Date(os.coluna_kanban_desde).getTime()) / 60000;
            if (diff > oldestMinutes) oldestMinutes = diff;
          }
        }
        colunas.push({
          label: getColunaLabel(col),
          total: osCol.length,
          oldestMinutes: Math.round(oldestMinutes),
          oldestFormatted: oldestMinutes > 0 ? formatDuration(oldestMinutes) : "—",
        });
      }

      // Sort: most OS first
      colunas.sort((a, b) => b.total - a.total);

      unitDataList.push({
        sigla: unidadeShort[uid] || "???",
        nome: unidadeMap[uid] || "Unidade",
        totalOS: osList.length,
        colunas,
      });
    }

    // Sort units by total OS descending
    unitDataList.sort((a, b) => b.totalOS - a.totalOS);

    // Generate images and upload to storage
    const imageUrls: Array<{ sigla: string; url: string }> = [];

    for (const unitData of unitDataList) {
      const svg = generateDashboardSVG(unitData, horario);
      
      // Convert SVG to PNG
      const pngBuffer = await svgToPng(svg);

      // Upload to Supabase Storage
      const fileName = `pulso_${unitData.sigla.toLowerCase()}_${now.toISOString().slice(0, 10)}_${horario.replace(":", "")}.png`;
      const storagePath = `relatorios/pulso/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("os-anexos")
        .upload(storagePath, pngBuffer, {
          contentType: "image/png",
          upsert: true,
        });

      if (uploadError) {
        console.error(`Erro upload ${unitData.sigla}:`, uploadError.message);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from("os-anexos")
        .getPublicUrl(storagePath);

      imageUrls.push({
        sigla: unitData.sigla,
        url: urlData.publicUrl,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        horario,
        total_unidades: unitDataList.length,
        total_os: allOS.length,
        images: imageUrls,
        units: unitDataList.map(u => ({ sigla: u.sigla, nome: u.nome, totalOS: u.totalOS })),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Erro gerar imagem pulso:", err);
    return new Response(
      JSON.stringify({ error: err.message, stack: err.stack }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
