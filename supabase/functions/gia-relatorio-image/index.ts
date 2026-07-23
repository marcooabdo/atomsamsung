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

const COLUNAS_KANBAN = [
  { id: "os_nova", label: "OS Nova", color: "#0EA5E9" },
  { id: "diagnostico", label: "Diagnóstico/Triagem", color: "#06B6D4" },
  { id: "negociacao_em_andamento", label: "Enviar Orçamento", color: "#F59E0B" },
  { id: "aguardando_aprovacao", label: "Ag. Aprovação", color: "#F97316" },
  { id: "orcamento_aprovado", label: "Orç. Aprovado", color: "#10B981" },
  { id: "aguardando_peca", label: "Aguardando Peça", color: "#8B5CF6" },
  { id: "peca_em_transito", label: "Peça em Trânsito", color: "#3B82F6" },
  { id: "em_reparo_ci", label: "Em Reparo CI", color: "#0EA5E9" },
  { id: "rota_preta", label: "Rota Preta", color: "#374151" },
  { id: "rota_vermelha", label: "Rota Vermelha", color: "#EF4444" },
  { id: "rota_azul", label: "Rota Azul", color: "#3B82F6" },
  { id: "rota_verde", label: "Rota Verde", color: "#10B981" },
  { id: "rota_rosa", label: "Rota Rosa", color: "#EC4899" },
  { id: "rota_amarela", label: "Rota Amarela", color: "#EAB308" },
  { id: "rota_laranja", label: "Rota Laranja", color: "#F97316" },
  { id: "em_rota_ih", label: "Agendados (FTF)", color: "#10B981" },
  { id: "em_reparo_ih", label: "Reparo IH", color: "#06B6D4" },
  { id: "instalacao_inicial", label: "Instalação Inicial", color: "#7C3AED" },
  { id: "service_handling", label: "Service Handling", color: "#DB2777" },
  { id: "return_handling", label: "Return Handling", color: "#D97706" },
  { id: "trade_up", label: "Trade Up", color: "#0891B2" },
  { id: "saw", label: "SAW", color: "#14B8A6" },
  { id: "controle_qualidade", label: "CQ / OQC", color: "#2563EB" },
  { id: "qa_bt", label: "Q&A / BT", color: "#7C3AED" },
  { id: "reparo_concluido", label: "Reparo Concluído", color: "#10B981" },
  { id: "aguardando_fechamento", label: "Ag. Fechamento", color: "#F59E0B" },
  { id: "orcamentos_rejeitados", label: "Orç. Rejeitados", color: "#EF4444" },
];

function getColConfig(id: string): { label: string; color: string } {
  const found = COLUNAS_KANBAN.find(c => c.id === id);
  return found || { label: id.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()), color: "#6B7280" };
}

function formatDays(hours: number): string {
  if (hours < 24) return hours < 1 ? "<1h" : `${Math.floor(hours)}h`;
  const days = Math.floor(hours / 24);
  const rem = Math.floor(hours % 24);
  return rem > 0 ? `${days}d ${rem}h` : `${days}d`;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

interface ColStat {
  id: string;
  label: string;
  color: string;
  count: number;
  oldestOpenHours: number;
  oldestInStageHours: number;
  problemCount: number;
}

interface UnitData {
  sigla: string;
  nome: string;
  totalOS: number;
  columns: ColStat[];
}

function generatePipelineSVG(unit: UnitData, horario: string): string {
  const cols = unit.columns.filter(c => c.count > 0);
  const rowHeight = 34;
  const headerHeight = 90;
  const tableHeaderHeight = 32;
  const footerHeight = 40;
  const contentHeight = cols.length * rowHeight;
  const totalRowHeight = 34;
  const totalHeight = headerHeight + tableHeaderHeight + contentHeight + totalRowHeight + footerHeight;
  const width = 680;

  const colEtapaX = 14;
  const colQtdX = 310;
  const colOldestX = 395;
  const colStageX = 510;
  const colProbX = 630;

  let rows = "";
  cols.forEach((col, i) => {
    const y = headerHeight + tableHeaderHeight + i * rowHeight;
    const bgColor = i % 2 === 0 ? "#111827" : "#0d1320";
    const midY = y + rowHeight / 2 + 4;

    const oldestColor = col.oldestOpenHours > 14 * 24 ? "#f87171" : col.oldestOpenHours > 7 * 24 ? "#fbbf24" : "#94a3b8";
    const stageColor = col.oldestInStageHours > 14 * 24 ? "#f87171" : col.oldestInStageHours > 7 * 24 ? "#fbbf24" : "#94a3b8";
    const probText = col.problemCount > 0 ? `${col.problemCount}` : "OK";
    const probColor = col.problemCount > 0 ? "#f87171" : "#4ade80";

    rows += `
      <rect x="0" y="${y}" width="${width}" height="${rowHeight}" fill="${bgColor}" />
      <circle cx="${colEtapaX + 8}" cy="${y + rowHeight / 2}" r="4" fill="${col.color}" />
      <text x="${colEtapaX + 20}" y="${midY}" font-family="Arial, sans-serif" font-size="12" fill="#e2e8f0">${escapeXml(col.label)}</text>
      <text x="${colQtdX}" y="${midY}" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#ffffff" text-anchor="middle">${col.count}</text>
      <text x="${colOldestX}" y="${midY}" font-family="Arial, sans-serif" font-size="11" fill="${oldestColor}" text-anchor="middle">${col.oldestOpenHours > 0 ? formatDays(col.oldestOpenHours) : "—"}</text>
      <text x="${colStageX}" y="${midY}" font-family="Arial, sans-serif" font-size="11" fill="${stageColor}" text-anchor="middle">${col.oldestInStageHours > 0 ? formatDays(col.oldestInStageHours) : "—"}</text>
      <text x="${colProbX}" y="${midY}" font-family="Arial, sans-serif" font-size="11" font-weight="${col.problemCount > 0 ? "bold" : "normal"}" fill="${probColor}" text-anchor="middle">${probText}</text>
    `;
  });

  // Total row
  const totalY = headerHeight + tableHeaderHeight + contentHeight;
  const totalMidY = totalY + totalRowHeight / 2 + 4;
  const totalCount = cols.reduce((s, c) => s + c.count, 0);
  const totalProblems = cols.reduce((s, c) => s + c.problemCount, 0);
  const maxOldest = Math.max(...cols.map(c => c.oldestOpenHours), 0);
  const maxStage = Math.max(...cols.map(c => c.oldestInStageHours), 0);

  rows += `
    <rect x="0" y="${totalY}" width="${width}" height="${totalRowHeight}" fill="#0f1729" />
    <line x1="14" y1="${totalY}" x2="${width - 14}" y2="${totalY}" stroke="#334155" stroke-width="1" />
    <text x="${colEtapaX + 8}" y="${totalMidY}" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#e2e8f0">TOTAL</text>
    <text x="${colQtdX}" y="${totalMidY}" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#60a5fa" text-anchor="middle">${totalCount}</text>
    <text x="${colOldestX}" y="${totalMidY}" font-family="Arial, sans-serif" font-size="11" fill="#94a3b8" text-anchor="middle">${maxOldest > 0 ? formatDays(maxOldest) : "—"}</text>
    <text x="${colStageX}" y="${totalMidY}" font-family="Arial, sans-serif" font-size="11" fill="#94a3b8" text-anchor="middle">${maxStage > 0 ? formatDays(maxStage) : "—"}</text>
    <text x="${colProbX}" y="${totalMidY}" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="${totalProblems > 0 ? "#f87171" : "#4ade80"}" text-anchor="middle">${totalProblems > 0 ? totalProblems : "OK"}</text>
  `;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}">
  <defs>
    <linearGradient id="hg" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#0f172a" />
      <stop offset="100%" style="stop-color:#1e293b" />
    </linearGradient>
  </defs>
  <rect width="${width}" height="${totalHeight}" fill="#0a0f1a" rx="12" ry="12" />
  <rect x="0" y="0" width="${width}" height="${headerHeight}" fill="url(#hg)" rx="12" ry="12" />
  <rect x="0" y="${headerHeight - 12}" width="${width}" height="12" fill="url(#hg)" />

  <text x="20" y="30" font-family="Arial, sans-serif" font-size="10" fill="#64748b" letter-spacing="2">PIPELINE COMPLETO</text>
  <text x="20" y="55" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#ffffff">${escapeXml(unit.sigla)} — ${escapeXml(unit.nome)}</text>
  <text x="20" y="78" font-family="Arial, sans-serif" font-size="12" fill="#94a3b8">${unit.totalOS} OS abertas • ${horario}</text>

  <rect x="${width - 80}" y="16" width="60" height="58" rx="8" ry="8" fill="#1e3a5f" />
  <text x="${width - 50}" y="44" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#60a5fa" text-anchor="middle">${unit.totalOS}</text>
  <text x="${width - 50}" y="62" font-family="Arial, sans-serif" font-size="9" fill="#94a3b8" text-anchor="middle">TOTAL</text>

  <!-- Table header -->
  <rect x="0" y="${headerHeight}" width="${width}" height="${tableHeaderHeight}" fill="#0d1117" />
  <text x="${colEtapaX + 20}" y="${headerHeight + 20}" font-family="Arial, sans-serif" font-size="9" fill="#64748b" letter-spacing="1">ETAPA</text>
  <text x="${colQtdX}" y="${headerHeight + 20}" font-family="Arial, sans-serif" font-size="9" fill="#64748b" letter-spacing="1" text-anchor="middle">QTD</text>
  <text x="${colOldestX}" y="${headerHeight + 20}" font-family="Arial, sans-serif" font-size="9" fill="#64748b" letter-spacing="1" text-anchor="middle">OS ANTIGA</text>
  <text x="${colStageX}" y="${headerHeight + 20}" font-family="Arial, sans-serif" font-size="9" fill="#64748b" letter-spacing="1" text-anchor="middle">NA ETAPA</text>
  <text x="${colProbX}" y="${headerHeight + 20}" font-family="Arial, sans-serif" font-size="9" fill="#64748b" letter-spacing="1" text-anchor="middle">PEÇAS</text>

  ${rows}

  <!-- Footer -->
  <rect x="0" y="${totalHeight - footerHeight}" width="${width}" height="${footerHeight}" fill="#0a0f1a" rx="0" ry="0" />
  <rect x="0" y="${totalHeight - 12}" width="${width}" height="12" fill="#0a0f1a" rx="12" ry="12" />
  <text x="${width / 2}" y="${totalHeight - 14}" font-family="Arial, sans-serif" font-size="10" fill="#475569" text-anchor="middle">GIA • Global Intelligence Assistance</text>
</svg>`;
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

    // Fetch ALL open OS with created_at for oldest calculation
    const allOS: any[] = [];
    let from = 0;
    const pageSize = 1000;
    let hasMore = true;
    while (hasMore) {
      const { data, error } = await supabase
        .from("os")
        .select("id, coluna_kanban, coluna_kanban_desde, created_at, unidade_id")
        .not("coluna_kanban", "is", null)
        .neq("coluna_kanban", "os_fechada")
        .or("arquivada.is.null,arquivada.eq.false")
        .range(from, from + pageSize - 1);
      if (error) throw new Error(`Erro ao buscar OS: ${error.message}`);
      if (data && data.length > 0) {
        allOS.push(...data);
        from += pageSize;
        hasMore = data.length === pageSize;
      } else {
        hasMore = false;
      }
    }

    // Fetch OS pecas to compute "Problemas Peça"
    const osIds = allOS.map(os => os.id);
    const pecasMap: Record<string, { pn: string | null; codigo: string | null; valor_unitario: number | null; valor_gspn: number | null }[]> = {};
    
    // Batch pecas queries (supabase filter max ~300 items per IN)
    const batchSize = 300;
    for (let i = 0; i < osIds.length; i += batchSize) {
      const batch = osIds.slice(i, i + batchSize);
      const { data: pecas } = await supabase
        .from("os_pecas")
        .select("os_id, pn, codigo, valor_unitario, valor_gspn")
        .in("os_id", batch);
      if (pecas) {
        for (const p of pecas) {
          if (!pecasMap[p.os_id]) pecasMap[p.os_id] = [];
          pecasMap[p.os_id].push(p);
        }
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

      // Build columns in COLUNAS_KANBAN order
      const columns: ColStat[] = [];
      const processedCols = new Set<string>();

      for (const colDef of COLUNAS_KANBAN) {
        const osCol = osPorColuna[colDef.id];
        if (!osCol || osCol.length === 0) continue;
        processedCols.add(colDef.id);
        columns.push(buildColStat(colDef.id, colDef.label, colDef.color, osCol, now, pecasMap));
      }

      // Any extra columns not in the fixed list
      for (const [col, osCol] of Object.entries(osPorColuna)) {
        if (processedCols.has(col)) continue;
        const cfg = getColConfig(col);
        columns.push(buildColStat(col, cfg.label, cfg.color, osCol, now, pecasMap));
      }

      unitDataList.push({
        sigla: unidadeShort[uid] || "???",
        nome: unidadeMap[uid] || "Unidade",
        totalOS: osList.length,
        columns,
      });
    }

    unitDataList.sort((a, b) => b.totalOS - a.totalOS);

    // Generate images
    const imageUrls: Array<{ sigla: string; url: string }> = [];

    for (const unitData of unitDataList) {
      const svg = generatePipelineSVG(unitData, horario);
      const pngBuffer = await svgToPng(svg);

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

function buildColStat(
  id: string,
  label: string,
  color: string,
  osCol: any[],
  now: Date,
  pecasMap: Record<string, any[]>
): ColStat {
  let oldestOpenHours = 0;
  let oldestInStageHours = 0;

  for (const os of osCol) {
    if (os.created_at) {
      const h = (now.getTime() - new Date(os.created_at).getTime()) / (1000 * 60 * 60);
      if (h > oldestOpenHours) oldestOpenHours = h;
    }
    const stageDate = os.coluna_kanban_desde || os.created_at;
    if (stageDate) {
      const h = (now.getTime() - new Date(stageDate).getTime()) / (1000 * 60 * 60);
      if (h > oldestInStageHours) oldestInStageHours = h;
    }
  }

  let problemCount = 0;
  for (const os of osCol) {
    const pecas = pecasMap[os.id];
    if (!pecas || pecas.length === 0) {
      problemCount++;
    } else {
      const hasCodigo = (p: any) => (p.pn && p.pn.trim() !== "") || (p.codigo && p.codigo.trim() !== "");
      const semCodigo = pecas.filter((p: any) => !hasCodigo(p)).length;
      const semValor = pecas.filter((p: any) => hasCodigo(p) && (Number(p.valor_unitario || 0) < 0.01 && Number(p.valor_gspn || 0) < 0.01)).length;
      if (semCodigo > 0 || semValor > 0) problemCount++;
    }
  }

  return { id, label, color, count: osCol.length, oldestOpenHours, oldestInStageHours, problemCount };
}
