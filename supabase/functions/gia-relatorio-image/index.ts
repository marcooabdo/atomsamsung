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

// ==================== LIMITE CREDITO GSPN IMAGE ====================

interface LimiteCreditoUnit {
  sigla: string;
  nome: string;
  limite: number;
  consumido: number;
  livre: number;
  percentual: number;
  categorias: {
    disponivel: { qtd: number; valor: number };
    com_tecnico: { qtd: number; valor: number };
    com_defeito: { qtd: number; valor: number };
    em_os: { qtd: number; valor: number };
    pedidos: { qtd: number; valor: number };
    devolvidas: { qtd: number; valor: number };
  };
}

function fmtBRL(v: number): string {
  const abs = Math.abs(v);
  const formatted = abs.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return v < 0 ? `R$ -${formatted}` : `R$ ${formatted}`;
}

function getStatusColor(pct: number): string {
  if (pct >= 95) return "#ef4444";
  if (pct >= 80) return "#f59e0b";
  return "#10b981";
}

function generateLimiteCreditoSVG(
  units: LimiteCreditoUnit[],
  globalLimite: number,
  globalConsumido: number,
  globalLivre: number,
  globalPct: number,
  horario: string,
  data: string
): string {
  const width = 1200;
  const headerHeight = 120;
  const consolidadoHeight = 200;
  const cardHeight = 320;
  const footerHeight = 50;
  const gapY = 20;

  const cardsPerRow = Math.min(units.length, 3);
  const cardRows = Math.ceil(units.length / 3);
  const cardsAreaHeight = cardRows * (cardHeight + gapY);
  const totalHeight = headerHeight + consolidadoHeight + gapY + cardsAreaHeight + footerHeight;

  const globalColor = getStatusColor(globalPct);

  const globalBarWidth = 400;
  const globalBarFill = Math.min(globalPct / 100, 1) * globalBarWidth;

  let consolidadoSvg = `
    <rect x="40" y="${headerHeight}" width="${width - 80}" height="${consolidadoHeight}" rx="12" fill="#1a2332" stroke="#334155" stroke-width="1"/>
    <circle cx="520" cy="${headerHeight + 30}" r="6" fill="${globalColor}"/>
    <text x="535" y="${headerHeight + 36}" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#ffffff">CONSOLIDADO</text>

    <rect x="80" y="${headerHeight + 55}" width="320" height="70" rx="8" fill="#0f1729" stroke="#475569" stroke-width="0.5"/>
    <text x="240" y="${headerHeight + 80}" font-family="Arial, sans-serif" font-size="11" fill="#94a3b8" text-anchor="middle">Limite:</text>
    <text x="240" y="${headerHeight + 108}" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#ffffff" text-anchor="middle">${escapeXml(fmtBRL(globalLimite))}</text>

    <rect x="440" y="${headerHeight + 55}" width="320" height="70" rx="8" fill="#0f1729" stroke="#475569" stroke-width="0.5"/>
    <text x="600" y="${headerHeight + 80}" font-family="Arial, sans-serif" font-size="11" fill="#94a3b8" text-anchor="middle">Consumido:</text>
    <text x="600" y="${headerHeight + 108}" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="#ffffff" text-anchor="middle">${escapeXml(fmtBRL(globalConsumido))}</text>

    <rect x="800" y="${headerHeight + 55}" width="320" height="70" rx="8" fill="#0f1729" stroke="#475569" stroke-width="0.5"/>
    <text x="960" y="${headerHeight + 80}" font-family="Arial, sans-serif" font-size="11" fill="#94a3b8" text-anchor="middle">Disponível:</text>
    <text x="960" y="${headerHeight + 108}" font-family="Arial, sans-serif" font-size="20" font-weight="bold" fill="${globalLivre < 0 ? "#ef4444" : "#ffffff"}" text-anchor="middle">${escapeXml(fmtBRL(globalLivre))}</text>

    <rect x="400" y="${headerHeight + 145}" width="${globalBarWidth}" height="16" rx="8" fill="#1e293b"/>
    <rect x="400" y="${headerHeight + 145}" width="${Math.max(globalBarFill, 0)}" height="16" rx="8" fill="${globalColor}"/>
    <text x="${400 + globalBarWidth + 20}" y="${headerHeight + 158}" font-family="Arial, sans-serif" font-size="13" fill="#e2e8f0">Uso: ${globalPct.toFixed(2)}%</text>
  `;

  let cardsSvg = "";
  const cardWidth = (width - 80 - (cardsPerRow - 1) * 20) / cardsPerRow;
  const cardsStartY = headerHeight + consolidadoHeight + gapY;

  units.forEach((unit, i) => {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const x = 40 + col * (cardWidth + 20);
    const y = cardsStartY + row * (cardHeight + gapY);

    const borderColor = unit.percentual >= 80 ? "#ef4444" : "#10b981";
    const barColor = getStatusColor(unit.percentual);
    const unitBarWidth = cardWidth - 40;
    const unitBarFill = Math.min(unit.percentual / 100, 1) * unitBarWidth;

    const catY = y + 170;
    const lineH = 24;

    cardsSvg += `
      <rect x="${x}" y="${y}" width="${cardWidth}" height="${cardHeight}" rx="12" fill="#111827" stroke="${borderColor}" stroke-width="2"/>

      <circle cx="${x + 20}" cy="${y + 28}" r="6" fill="${barColor}"/>
      <text x="${x + 35}" y="${y + 34}" font-family="Arial, sans-serif" font-size="18" font-weight="bold" fill="#ffffff">${escapeXml(unit.sigla)}</text>
      <text x="${x + cardWidth - 20}" y="${y + 34}" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="${barColor}" text-anchor="end">${unit.percentual.toFixed(2)}%</text>

      <rect x="${x + 20}" y="${y + 50}" width="${unitBarWidth}" height="12" rx="6" fill="#1e293b"/>
      <rect x="${x + 20}" y="${y + 50}" width="${Math.max(Math.min(unitBarFill, unitBarWidth), 0)}" height="12" rx="6" fill="${barColor}"/>

      <text x="${x + 20}" y="${y + 90}" font-family="Arial, sans-serif" font-size="12" fill="#94a3b8">Limite:</text>
      <text x="${x + cardWidth - 20}" y="${y + 90}" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#ffffff" text-anchor="end">${escapeXml(fmtBRL(unit.limite))}</text>

      <text x="${x + 20}" y="${y + 112}" font-family="Arial, sans-serif" font-size="12" fill="#94a3b8">Consumido:</text>
      <text x="${x + cardWidth - 20}" y="${y + 112}" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#ffffff" text-anchor="end">${escapeXml(fmtBRL(unit.consumido))}</text>

      <text x="${x + 20}" y="${y + 134}" font-family="Arial, sans-serif" font-size="12" fill="#94a3b8">Disponível:</text>
      <text x="${x + cardWidth - 20}" y="${y + 134}" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="${unit.livre < 0 ? "#ef4444" : "#ffffff"}" text-anchor="end">${escapeXml(fmtBRL(unit.livre))}</text>

      <line x1="${x + 20}" y1="${y + 150}" x2="${x + cardWidth - 20}" y2="${y + 150}" stroke="#334155" stroke-width="0.5"/>

      <text x="${x + 20}" y="${catY}" font-family="Arial, sans-serif" font-size="11" fill="#fbbf24">📦</text>
      <text x="${x + 40}" y="${catY}" font-family="Arial, sans-serif" font-size="11" fill="#cbd5e1">Estoque:</text>
      <text x="${x + cardWidth - 20}" y="${catY}" font-family="Arial, sans-serif" font-size="11" fill="#e2e8f0" text-anchor="end">${unit.categorias.disponivel.qtd} pcs (${escapeXml(fmtBRL(unit.categorias.disponivel.valor))})</text>

      <text x="${x + 20}" y="${catY + lineH}" font-family="Arial, sans-serif" font-size="11" fill="#60a5fa">👨‍🔧</text>
      <text x="${x + 40}" y="${catY + lineH}" font-family="Arial, sans-serif" font-size="11" fill="#cbd5e1">C/ técnico:</text>
      <text x="${x + cardWidth - 20}" y="${catY + lineH}" font-family="Arial, sans-serif" font-size="11" fill="#e2e8f0" text-anchor="end">${unit.categorias.com_tecnico.qtd} pcs (${escapeXml(fmtBRL(unit.categorias.com_tecnico.valor))})</text>

      <text x="${x + 20}" y="${catY + lineH * 2}" font-family="Arial, sans-serif" font-size="11" fill="#f59e0b">⚠️</text>
      <text x="${x + 40}" y="${catY + lineH * 2}" font-family="Arial, sans-serif" font-size="11" fill="#cbd5e1">C/ defeito:</text>
      <text x="${x + cardWidth - 20}" y="${catY + lineH * 2}" font-family="Arial, sans-serif" font-size="11" fill="#e2e8f0" text-anchor="end">${unit.categorias.com_defeito.qtd} pcs (${escapeXml(fmtBRL(unit.categorias.com_defeito.valor))})</text>

      <text x="${x + 20}" y="${catY + lineH * 3}" font-family="Arial, sans-serif" font-size="11" fill="#a78bfa">🔧</text>
      <text x="${x + 40}" y="${catY + lineH * 3}" font-family="Arial, sans-serif" font-size="11" fill="#cbd5e1">Em OS:</text>
      <text x="${x + cardWidth - 20}" y="${catY + lineH * 3}" font-family="Arial, sans-serif" font-size="11" fill="#e2e8f0" text-anchor="end">${unit.categorias.em_os.qtd} pcs (${escapeXml(fmtBRL(unit.categorias.em_os.valor))})</text>

      <text x="${x + 20}" y="${catY + lineH * 4}" font-family="Arial, sans-serif" font-size="11" fill="#f472b6">🛒</text>
      <text x="${x + 40}" y="${catY + lineH * 4}" font-family="Arial, sans-serif" font-size="11" fill="#cbd5e1">Pedidos:</text>
      <text x="${x + cardWidth - 20}" y="${catY + lineH * 4}" font-family="Arial, sans-serif" font-size="11" fill="#e2e8f0" text-anchor="end">${unit.categorias.pedidos.qtd} pcs (${escapeXml(fmtBRL(unit.categorias.pedidos.valor))})</text>

      <text x="${x + 20}" y="${catY + lineH * 5}" font-family="Arial, sans-serif" font-size="11" fill="#4ade80">✅</text>
      <text x="${x + 40}" y="${catY + lineH * 5}" font-family="Arial, sans-serif" font-size="11" fill="#cbd5e1">Devolvidas:</text>
      <text x="${x + cardWidth - 20}" y="${catY + lineH * 5}" font-family="Arial, sans-serif" font-size="11" fill="#e2e8f0" text-anchor="end">${unit.categorias.devolvidas.qtd} pcs (${escapeXml(fmtBRL(unit.categorias.devolvidas.valor))})</text>
    `;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}">
  <defs>
    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a1628"/>
      <stop offset="50%" style="stop-color:#0f2035"/>
      <stop offset="100%" style="stop-color:#0a1628"/>
    </linearGradient>
  </defs>
  <rect width="${width}" height="${totalHeight}" fill="#0a1020" rx="16"/>

  <!-- Header -->
  <rect x="0" y="0" width="${width}" height="${headerHeight}" fill="url(#headerGrad)" rx="16"/>
  <rect x="0" y="${headerHeight - 16}" width="${width}" height="16" fill="url(#headerGrad)"/>
  <text x="80" y="50" font-family="Arial, sans-serif" font-size="9" fill="#64748b" letter-spacing="3">RELATÓRIO FINANCEIRO</text>
  <text x="80" y="80" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="#ffffff">💳 LIMITE DE CRÉDITO GSPN</text>
  <text x="80" y="105" font-family="Arial, sans-serif" font-size="13" fill="#94a3b8">${escapeXml(data)} • ${escapeXml(horario)}</text>

  <!-- Logo placeholder top-right -->
  <rect x="${width - 100}" y="30" width="60" height="60" rx="10" fill="#1e293b" stroke="#334155" stroke-width="1"/>
  <text x="${width - 70}" y="55" font-family="Arial, sans-serif" font-size="9" fill="#64748b" text-anchor="middle">ATOM</text>
  <text x="${width - 70}" y="72" font-family="Arial, sans-serif" font-size="9" fill="#64748b" text-anchor="middle">CORE</text>

  <!-- Consolidado -->
  ${consolidadoSvg}

  <!-- Unit Cards -->
  ${cardsSvg}

  <!-- Footer -->
  <text x="${width / 2}" y="${totalHeight - 18}" font-family="Arial, sans-serif" font-size="11" fill="#475569" text-anchor="middle">🤖 GIA • Global Intelligence Assistance</text>
</svg>`;
}

async function handleLimiteCreditoImage(supabase: ReturnType<typeof createClient>) {
  const now = new Date();
  const horario = now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  const data = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const { data: unidades } = await supabase.from("unidades").select("id, nome, limite_credito_gspn");

  const unidadesComLimite = (unidades || []).filter((u: any) => {
    if (!u.limite_credito_gspn || Number(u.limite_credito_gspn) <= 0) return false;
    const lower = u.nome.toLowerCase();
    if (lower.includes("bernardo") || lower.includes("sbc")) return false;
    return true;
  });

  if (unidadesComLimite.length === 0) {
    return { success: false, error: "Nenhuma unidade com limite de crédito configurado" };
  }

  // Fetch estoque_pecas
  const { data: pecas } = await supabase
    .from("estoque_pecas")
    .select("id, unidade_id, status, valor_com_impostos, tecnico_id, os_id");

  // Fetch pending requisitions
  const { data: pedidos } = await supabase
    .from("requisicoes_pecas")
    .select("id, valor_peca, unidade_id")
    .eq("status", "pendente");

  const pecasList = pecas || [];
  const pedidosList = pedidos || [];

  function getSigla(nome: string): string {
    const lower = nome.toLowerCase();
    if (lower.includes("montes claros")) return "MOC";
    if (lower.includes("juiz de fora")) return "JDF";
    if (lower.includes("feira")) return "FSA";
    if (lower.includes("uberlândia") || lower.includes("uberlandia")) return "UDI";
    if (lower.includes("governador")) return "GVD";
    return nome.slice(0, 3).toUpperCase();
  }

  const unitResults: LimiteCreditoUnit[] = unidadesComLimite.map((uni: any) => {
    const limite = Number(uni.limite_credito_gspn);
    const pecasUni = pecasList.filter((p: any) => p.unidade_id === uni.id);
    const pedidosUni = pedidosList.filter((p: any) => p.unidade_id === uni.id);

    const disponivel = pecasUni.filter((p: any) => p.status === "disponivel" && !p.tecnico_id && !p.os_id);
    const comTecnico = pecasUni.filter((p: any) => p.tecnico_id && !p.os_id && p.status !== "devolucao_completa");
    const comDefeito = pecasUni.filter((p: any) => p.status === "devolvida_defeito");
    const devolvida = pecasUni.filter((p: any) => p.status === "devolucao_completa");
    const emOS = pecasUni.filter((p: any) => p.os_id && p.status !== "devolucao_completa");

    const valCat = (lista: any[]) => Math.round(lista.reduce((s: number, p: any) => s + Number(p.valor_com_impostos || 0), 0) * 100) / 100;

    const pecasConsumo = pecasUni.filter((p: any) => p.status !== "devolucao_completa");
    const valorPecasConsumo = valCat(pecasConsumo);
    const valorPedidos = Math.round(pedidosUni.reduce((s: number, p: any) => s + Number(p.valor_peca || 0), 0) * 100) / 100;
    const consumido = Math.round((valorPecasConsumo + valorPedidos) * 100) / 100;
    const livre = Math.round((limite - consumido) * 100) / 100;
    const percentual = limite > 0 ? Math.round((consumido / limite) * 10000) / 100 : 0;

    return {
      sigla: getSigla(uni.nome),
      nome: uni.nome,
      limite,
      consumido,
      livre,
      percentual,
      categorias: {
        disponivel: { qtd: disponivel.length, valor: valCat(disponivel) },
        com_tecnico: { qtd: comTecnico.length, valor: valCat(comTecnico) },
        com_defeito: { qtd: comDefeito.length, valor: valCat(comDefeito) },
        em_os: { qtd: emOS.length, valor: valCat(emOS) },
        pedidos: { qtd: pedidosUni.length, valor: valorPedidos },
        devolvidas: { qtd: devolvida.length, valor: valCat(devolvida) },
      },
    };
  });

  unitResults.sort((a, b) => b.percentual - a.percentual);

  const globalLimite = unitResults.reduce((s, u) => s + u.limite, 0);
  const globalConsumido = unitResults.reduce((s, u) => s + u.consumido, 0);
  const globalLivre = unitResults.reduce((s, u) => s + u.livre, 0);
  const globalPct = globalLimite > 0 ? Math.round((globalConsumido / globalLimite) * 10000) / 100 : 0;

  const svg = generateLimiteCreditoSVG(unitResults, globalLimite, globalConsumido, globalLivre, globalPct, horario, data);
  const pngBuffer = await svgToPng(svg);

  const fileName = `limite_credito_${now.toISOString().slice(0, 10)}_${horario.replace(":", "")}.png`;
  const storagePath = `relatorios/limite-credito/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("os-anexos")
    .upload(storagePath, pngBuffer, { contentType: "image/png", upsert: true });

  if (uploadError) {
    throw new Error(`Erro upload imagem limite crédito: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage.from("os-anexos").getPublicUrl(storagePath);

  return {
    success: true,
    horario,
    image_url: urlData.publicUrl,
    global: { limite: globalLimite, consumido: globalConsumido, livre: globalLivre, percentual: globalPct },
    units: unitResults.map(u => ({ sigla: u.sigla, percentual: u.percentual })),
  };
}

// ==================== ABERTURA E FECHAMENTO IMAGE ====================

interface AberturaFechamentoData {
  totalAbertas: number;
  totalFechadas: number;
  saldo: number;
  categoriasAbertas: Record<string, number>;
  categoriasFechadas: Record<string, number>;
  unidades: Array<{
    sigla: string;
    nome: string;
    abertas: number;
    fechadas: number;
    saldo: number;
    catAbertas: Record<string, number>;
    catFechadas: Record<string, number>;
  }>;
  horario: string;
  data: string;
}

function generateAberturaFechamentoSVG(d: AberturaFechamentoData): string {
  const width = 900;
  const headerHeight = 100;
  const summaryHeight = 180;
  const unitCardHeight = 72;
  const unitGap = 8;
  const unitsHeaderHeight = 40;
  const footerHeight = 50;
  const unitsCount = d.unidades.length;
  const unitsAreaHeight = unitsHeaderHeight + unitsCount * (unitCardHeight + unitGap);
  const totalHeight = headerHeight + summaryHeight + 20 + unitsAreaHeight + footerHeight;

  const saldoColor = d.saldo <= 0 ? "#10b981" : "#ef4444";
  const saldoStr = d.saldo >= 0 ? `+${d.saldo}` : `${d.saldo}`;
  const saldoIcon = d.saldo <= 0 ? "▼" : "▲";

  const maxBar = Math.max(d.totalAbertas, d.totalFechadas, 1);
  const abertasBarW = (d.totalAbertas / maxBar) * 220;
  const fechadasBarW = (d.totalFechadas / maxBar) * 220;

  function catLine(cat: Record<string, number>): string {
    return `LP: ${cat["LP-CI"] || 0}CI ${cat["LP-IH"] || 0}IH  |  OW: ${cat["OW-CI"] || 0}CI ${cat["OW-IH"] || 0}IH`;
  }

  // Summary cards SVG
  const cardY = headerHeight + 20;
  const cardH = summaryHeight - 40;

  const summarySvg = `
    <!-- Saldo Card -->
    <rect x="40" y="${cardY}" width="200" height="${cardH}" rx="12" fill="#111827" stroke="${saldoColor}" stroke-width="2"/>
    <text x="140" y="${cardY + 28}" font-family="Arial, sans-serif" font-size="10" fill="#94a3b8" text-anchor="middle" letter-spacing="1.5">SALDO DO DIA</text>
    <text x="140" y="${cardY + 72}" font-family="Arial, sans-serif" font-size="42" font-weight="bold" fill="${saldoColor}" text-anchor="middle">${saldoStr}</text>
    <text x="140" y="${cardY + 100}" font-family="Arial, sans-serif" font-size="13" fill="${saldoColor}" text-anchor="middle">${saldoIcon} ${d.saldo <= 0 ? "Reduzindo backlog" : "Acumulando OS"}</text>
    <text x="140" y="${cardY + 125}" font-family="Arial, sans-serif" font-size="10" fill="#64748b" text-anchor="middle">${d.totalAbertas + d.totalFechadas} movimentações</text>

    <!-- Abertas Card -->
    <rect x="270" y="${cardY}" width="290" height="${cardH}" rx="12" fill="#111827" stroke="#334155" stroke-width="1"/>
    <circle cx="292" cy="${cardY + 26}" r="5" fill="#f59e0b"/>
    <text x="304" y="${cardY + 30}" font-family="Arial, sans-serif" font-size="11" fill="#f59e0b" letter-spacing="1">ABERTAS HOJE</text>
    <text x="540" y="${cardY + 30}" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#ffffff" text-anchor="end">${d.totalAbertas}</text>
    
    <rect x="290" y="${cardY + 44}" width="250" height="10" rx="5" fill="#1e293b"/>
    <rect x="290" y="${cardY + 44}" width="${Math.max(abertasBarW, 4)}" height="10" rx="5" fill="#f59e0b"/>
    
    <text x="290" y="${cardY + 80}" font-family="Arial, sans-serif" font-size="11" fill="#94a3b8">LP-CI</text>
    <text x="340" y="${cardY + 80}" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#ffffff">${d.categoriasAbertas["LP-CI"] || 0}</text>
    <text x="380" y="${cardY + 80}" font-family="Arial, sans-serif" font-size="11" fill="#94a3b8">LP-IH</text>
    <text x="430" y="${cardY + 80}" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#ffffff">${d.categoriasAbertas["LP-IH"] || 0}</text>
    
    <text x="290" y="${cardY + 105}" font-family="Arial, sans-serif" font-size="11" fill="#94a3b8">OW-CI</text>
    <text x="340" y="${cardY + 105}" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#ffffff">${d.categoriasAbertas["OW-CI"] || 0}</text>
    <text x="380" y="${cardY + 105}" font-family="Arial, sans-serif" font-size="11" fill="#94a3b8">OW-IH</text>
    <text x="430" y="${cardY + 105}" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#ffffff">${d.categoriasAbertas["OW-IH"] || 0}</text>

    <text x="290" y="${cardY + 130}" font-family="Arial, sans-serif" font-size="11" fill="#64748b">Outros: ${d.categoriasAbertas["Outros"] || 0}</text>

    <!-- Fechadas Card -->
    <rect x="590" y="${cardY}" width="270" height="${cardH}" rx="12" fill="#111827" stroke="#334155" stroke-width="1"/>
    <circle cx="612" cy="${cardY + 26}" r="5" fill="#10b981"/>
    <text x="624" y="${cardY + 30}" font-family="Arial, sans-serif" font-size="11" fill="#10b981" letter-spacing="1">FECHADAS HOJE</text>
    <text x="840" y="${cardY + 30}" font-family="Arial, sans-serif" font-size="22" font-weight="bold" fill="#ffffff" text-anchor="end">${d.totalFechadas}</text>
    
    <rect x="610" y="${cardY + 44}" width="230" height="10" rx="5" fill="#1e293b"/>
    <rect x="610" y="${cardY + 44}" width="${Math.max(fechadasBarW, 4)}" height="10" rx="5" fill="#10b981"/>
    
    <text x="610" y="${cardY + 80}" font-family="Arial, sans-serif" font-size="11" fill="#94a3b8">LP-CI</text>
    <text x="660" y="${cardY + 80}" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#ffffff">${d.categoriasFechadas["LP-CI"] || 0}</text>
    <text x="700" y="${cardY + 80}" font-family="Arial, sans-serif" font-size="11" fill="#94a3b8">LP-IH</text>
    <text x="750" y="${cardY + 80}" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#ffffff">${d.categoriasFechadas["LP-IH"] || 0}</text>
    
    <text x="610" y="${cardY + 105}" font-family="Arial, sans-serif" font-size="11" fill="#94a3b8">OW-CI</text>
    <text x="660" y="${cardY + 105}" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#ffffff">${d.categoriasFechadas["OW-CI"] || 0}</text>
    <text x="700" y="${cardY + 105}" font-family="Arial, sans-serif" font-size="11" fill="#94a3b8">OW-IH</text>
    <text x="750" y="${cardY + 105}" font-family="Arial, sans-serif" font-size="12" font-weight="bold" fill="#ffffff">${d.categoriasFechadas["OW-IH"] || 0}</text>

    <text x="610" y="${cardY + 130}" font-family="Arial, sans-serif" font-size="11" fill="#64748b">Outros: ${d.categoriasFechadas["Outros"] || 0}</text>
  `;

  // Units breakdown
  const unitsStartY = headerHeight + summaryHeight + 20;
  let unitsSvg = `
    <text x="50" y="${unitsStartY + 24}" font-family="Arial, sans-serif" font-size="11" fill="#64748b" letter-spacing="2">POR UNIDADE</text>
    <line x1="145" y1="${unitsStartY + 20}" x2="${width - 50}" y2="${unitsStartY + 20}" stroke="#1e293b" stroke-width="1"/>
  `;

  d.unidades.forEach((u, i) => {
    const y = unitsStartY + unitsHeaderHeight + i * (unitCardHeight + unitGap);
    const uSaldoColor = u.saldo <= 0 ? "#10b981" : "#ef4444";
    const uSaldoStr = u.saldo >= 0 ? `+${u.saldo}` : `${u.saldo}`;
    const uMaxBar = Math.max(u.abertas, u.fechadas, 1);
    const uAbertasBarW = (u.abertas / uMaxBar) * 120;
    const uFechadasBarW = (u.fechadas / uMaxBar) * 120;

    unitsSvg += `
      <rect x="40" y="${y}" width="${width - 80}" height="${unitCardHeight}" rx="8" fill="#0d1117" stroke="#1e293b" stroke-width="1"/>
      
      <!-- Sigla + Name -->
      <rect x="56" y="${y + 12}" width="50" height="48" rx="6" fill="${uSaldoColor}20" stroke="${uSaldoColor}" stroke-width="1"/>
      <text x="81" y="${y + 35}" font-family="Arial, sans-serif" font-size="14" font-weight="bold" fill="${uSaldoColor}" text-anchor="middle">${escapeXml(u.sigla)}</text>
      <text x="81" y="${y + 52}" font-family="Arial, sans-serif" font-size="10" fill="${uSaldoColor}" text-anchor="middle">${uSaldoStr}</text>
      
      <!-- Abertas -->
      <text x="130" y="${y + 22}" font-family="Arial, sans-serif" font-size="9" fill="#f59e0b">ABERTAS</text>
      <text x="200" y="${y + 22}" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#ffffff">${u.abertas}</text>
      <rect x="130" y="${y + 28}" width="140" height="6" rx="3" fill="#1e293b"/>
      <rect x="130" y="${y + 28}" width="${Math.max(uAbertasBarW, 2)}" height="6" rx="3" fill="#f59e0b"/>
      <text x="130" y="${y + 48}" font-family="Arial, sans-serif" font-size="9" fill="#64748b">${catLine(u.catAbertas)}</text>

      <!-- Fechadas -->
      <text x="360" y="${y + 22}" font-family="Arial, sans-serif" font-size="9" fill="#10b981">FECHADAS</text>
      <text x="435" y="${y + 22}" font-family="Arial, sans-serif" font-size="13" font-weight="bold" fill="#ffffff">${u.fechadas}</text>
      <rect x="360" y="${y + 28}" width="140" height="6" rx="3" fill="#1e293b"/>
      <rect x="360" y="${y + 28}" width="${Math.max(uFechadasBarW, 2)}" height="6" rx="3" fill="#10b981"/>
      <text x="360" y="${y + 48}" font-family="Arial, sans-serif" font-size="9" fill="#64748b">${catLine(u.catFechadas)}</text>

      <!-- Saldo badge -->
      <rect x="${width - 140}" y="${y + 18}" width="60" height="36" rx="8" fill="${uSaldoColor}15" stroke="${uSaldoColor}50" stroke-width="1"/>
      <text x="${width - 110}" y="${y + 42}" font-family="Arial, sans-serif" font-size="16" font-weight="bold" fill="${uSaldoColor}" text-anchor="middle">${uSaldoStr}</text>
    `;
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#060a13"/>
      <stop offset="50%" style="stop-color:#0a1628"/>
      <stop offset="100%" style="stop-color:#060a13"/>
    </linearGradient>
    <linearGradient id="headerGradAF" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#0a1628"/>
      <stop offset="50%" style="stop-color:#122040"/>
      <stop offset="100%" style="stop-color:#0a1628"/>
    </linearGradient>
    <linearGradient id="accentLine" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#10b981;stop-opacity:0"/>
      <stop offset="50%" style="stop-color:#10b981;stop-opacity:1"/>
      <stop offset="100%" style="stop-color:#10b981;stop-opacity:0"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${width}" height="${totalHeight}" fill="url(#bgGrad)" rx="16"/>

  <!-- Header -->
  <rect x="0" y="0" width="${width}" height="${headerHeight}" fill="url(#headerGradAF)" rx="16"/>
  <rect x="0" y="${headerHeight - 16}" width="${width}" height="16" fill="url(#headerGradAF)"/>
  <line x1="40" y1="${headerHeight - 1}" x2="${width - 40}" y2="${headerHeight - 1}" stroke="url(#accentLine)" stroke-width="1"/>

  <!-- Logo area -->
  <rect x="${width - 110}" y="20" width="70" height="60" rx="10" fill="#111827" stroke="#1e3a5f" stroke-width="1"/>
  <text x="${width - 75}" y="46" font-family="Arial, sans-serif" font-size="11" font-weight="bold" fill="#60a5fa" text-anchor="middle">ATOM</text>
  <text x="${width - 75}" y="62" font-family="Arial, sans-serif" font-size="9" fill="#64748b" text-anchor="middle">CORE</text>

  <!-- Title -->
  <text x="50" y="36" font-family="Arial, sans-serif" font-size="9" fill="#64748b" letter-spacing="3">RELATÓRIO DIÁRIO</text>
  <text x="50" y="62" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#ffffff">ABERTURA &amp; FECHAMENTO</text>
  <text x="50" y="86" font-family="Arial, sans-serif" font-size="12" fill="#94a3b8">${escapeXml(d.data)} • ${escapeXml(d.horario)}</text>

  <!-- Summary cards -->
  ${summarySvg}

  <!-- Units breakdown -->
  ${unitsSvg}

  <!-- Footer -->
  <line x1="40" y1="${totalHeight - footerHeight}" x2="${width - 40}" y2="${totalHeight - footerHeight}" stroke="#1e293b" stroke-width="1"/>
  <text x="${width / 2}" y="${totalHeight - 20}" font-family="Arial, sans-serif" font-size="11" fill="#475569" text-anchor="middle">GIA • Global Intelligence Assistance</text>
</svg>`;
}

async function handleAberturaFechamentoImage(supabase: ReturnType<typeof createClient>) {
  const now = new Date();
  const horario = now.toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  const data = now.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });

  const spNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const startOfDaySP = new Date(spNow);
  startOfDaySP.setHours(0, 0, 0, 0);
  const offsetMs = now.getTime() - spNow.getTime();
  const startOfDayUTC = new Date(startOfDaySP.getTime() + offsetMs);

  const { data: unidades } = await supabase.from("unidades").select("id, nome");
  const unidadeMap: Record<string, string> = {};
  if (unidades) {
    for (const u of unidades) unidadeMap[u.id] = u.nome;
  }

  function getSigla(nome: string): string {
    const lower = nome.toLowerCase();
    if (lower.includes("montes claros")) return "MOC";
    if (lower.includes("juiz de fora")) return "JDF";
    if (lower.includes("feira")) return "FSA";
    if (lower.includes("uberlândia") || lower.includes("uberlandia")) return "UDI";
    if (lower.includes("governador")) return "GVD";
    return nome.slice(0, 3).toUpperCase();
  }

  const { data: abertas } = await supabase
    .from("os")
    .select("id, tipo_os, tipo_atendimento, unidade_id")
    .gte("created_at", startOfDayUTC.toISOString());

  const { data: fechadas } = await supabase
    .from("os")
    .select("id, tipo_os, tipo_atendimento, unidade_id")
    .eq("coluna_kanban", "os_fechada")
    .gte("coluna_kanban_desde", startOfDayUTC.toISOString());

  function categorizar(lista: any[]): Record<string, number> {
    const cat: Record<string, number> = { "LP-CI": 0, "LP-IH": 0, "OW-CI": 0, "OW-IH": 0, "Outros": 0 };
    for (const os of lista) {
      const tipo = (os.tipo_os || "").toUpperCase();
      const atend = (os.tipo_atendimento || "").toUpperCase();
      const key = `${tipo}-${atend}`;
      if (key in cat) cat[key]++;
      else cat["Outros"]++;
    }
    return cat;
  }

  const abertasList = abertas || [];
  const fechadasList = fechadas || [];

  const porUnidadeAbertas: Record<string, any[]> = {};
  const porUnidadeFechadas: Record<string, any[]> = {};
  for (const os of abertasList) {
    const uid = os.unidade_id || "sem_unidade";
    if (!porUnidadeAbertas[uid]) porUnidadeAbertas[uid] = [];
    porUnidadeAbertas[uid].push(os);
  }
  for (const os of fechadasList) {
    const uid = os.unidade_id || "sem_unidade";
    if (!porUnidadeFechadas[uid]) porUnidadeFechadas[uid] = [];
    porUnidadeFechadas[uid].push(os);
  }

  const allUids = new Set([...Object.keys(porUnidadeAbertas), ...Object.keys(porUnidadeFechadas)]);
  const unidadesData = Array.from(allUids)
    .filter(uid => uid !== "sem_unidade" && unidadeMap[uid])
    .map(uid => {
      const a = porUnidadeAbertas[uid] || [];
      const f = porUnidadeFechadas[uid] || [];
      return {
        sigla: getSigla(unidadeMap[uid]),
        nome: unidadeMap[uid],
        abertas: a.length,
        fechadas: f.length,
        saldo: a.length - f.length,
        catAbertas: categorizar(a),
        catFechadas: categorizar(f),
      };
    })
    .sort((a, b) => b.abertas - a.abertas);

  const imgData: AberturaFechamentoData = {
    totalAbertas: abertasList.length,
    totalFechadas: fechadasList.length,
    saldo: abertasList.length - fechadasList.length,
    categoriasAbertas: categorizar(abertasList),
    categoriasFechadas: categorizar(fechadasList),
    unidades: unidadesData,
    horario,
    data,
  };

  const svg = generateAberturaFechamentoSVG(imgData);
  const pngBuffer = await svgToPng(svg);

  const fileName = `abertura_fechamento_${now.toISOString().slice(0, 10)}_${horario.replace(":", "")}.png`;
  const storagePath = `relatorios/abertura-fechamento/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from("os-anexos")
    .upload(storagePath, pngBuffer, { contentType: "image/png", upsert: true });

  if (uploadError) {
    throw new Error(`Erro upload imagem abertura/fechamento: ${uploadError.message}`);
  }

  const { data: urlData } = supabase.storage.from("os-anexos").getPublicUrl(storagePath);

  return {
    success: true,
    horario,
    image_url: urlData.publicUrl,
    totais: { abertas: imgData.totalAbertas, fechadas: imgData.totalFechadas, saldo: imgData.saldo },
    unidades: unidadesData.map(u => ({ sigla: u.sigla, saldo: u.saldo })),
  };
}

// ==================== MAIN HANDLER ====================

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse request body for tipo
    let tipo = "pulso_operacional";
    try {
      const body = await req.json();
      if (body.tipo) tipo = body.tipo;
    } catch { /* default to pulso */ }

    if (tipo === "limite_credito_gspn") {
      const result = await handleLimiteCreditoImage(supabase);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (tipo === "abertura_fechamento") {
      const result = await handleAberturaFechamentoImage(supabase);
      return new Response(JSON.stringify(result), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Default: Pulso Operacional (existing behavior)
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
