import * as XLSX from 'xlsx';
import { ClienteCI, VendedorCI, PecaCI, CIKPIs, formatCurrency, getValorCliente } from './types';

export function exportExcel(
  clientes: ClienteCI[],
  vendedores: VendedorCI[],
  pecas: PecaCI[],
  kpis: CIKPIs
) {
  const wb = XLSX.utils.book_new();

  const resumo = [
    { 'Indicador': 'Faturamento Total', 'Valor': kpis.totalFaturamento },
    { 'Indicador': 'Ticket Medio', 'Valor': kpis.ticketMedio },
    { 'Indicador': 'Total Clientes', 'Valor': kpis.totalClientes },
    { 'Indicador': 'Cliente Destaque', 'Valor': kpis.clienteDoMes },
    { 'Indicador': 'Vendedor Destaque', 'Valor': kpis.vendedorDestaque },
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(resumo), 'Resumo');

  const clientesSheet = clientes.map(c => ({
    'Cliente': c.nome,
    'Documento': c.documento,
    'Telefone': c.telefone,
    'Email': c.email,
    'Cidade': c.cidade,
    'UF': c.estado,
    'Valor Total': getValorCliente(c),
    'Ticket Medio': c.ticketMedio,
    'Total OS': c.totalOS,
    'Tipos OS': c.tiposOS.join(', '),
    'Vendedor': c.vendedorNome,
    'Status': c.status
  }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(clientesSheet), 'Clientes');

  const osSheet: any[] = [];
  clientes.forEach(c => {
    c.osRecords.forEach(os => {
      osSheet.push({
        'Cliente': c.nome,
        'OS': os.numero_os_interna,
        'Tipo': os.tipo_os,
        'Status': os.coluna_kanban,
        'Valor Total': os.valor_total,
        'Valor Pago': os.valor_pago,
        'Criada em': os.created_at ? new Date(os.created_at).toLocaleDateString('pt-BR') : '',
        'Fechada em': os.fechada_em ? new Date(os.fechada_em).toLocaleDateString('pt-BR') : '',
        'Vendedor': os.vendedorNome,
        'Modelo': os.aparelho_modelo || '',
        'Peças': os.pecas.map(p => p.descricao).join('; ')
      });
    });
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(osSheet), 'Ordens de Servico');

  if (vendedores.length > 0) {
    const vendSheet = vendedores.map(v => ({
      'Vendedor': v.nome,
      'Faturamento': v.faturamento,
      'Total OS': v.totalOS,
      'Total Clientes': v.totalClientes,
      'Ticket Medio': v.ticketMedio
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(vendSheet), 'Vendedores');
  }

  if (pecas.length > 0) {
    const pecasSheet = pecas.slice(0, 50).map(p => ({
      'PN': p.pn,
      'Descricao': p.descricao,
      'Quantidade': p.quantidade,
      'Valor Total': p.valorTotal,
      'Valor Medio': p.valorMedio
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(pecasSheet), 'Peças');
  }

  XLSX.writeFile(wb, `customer_intelligence_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function generateHTMLReport(
  clientes: ClienteCI[],
  vendedores: VendedorCI[],
  pecas: PecaCI[],
  kpis: CIKPIs,
  filters: { tipo: string; periodo: string; unidade: string }
) {
  const now = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<title>Relatorio Customer Intelligence - ${now}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; padding: 32px; }
  .header { text-align: center; margin-bottom: 40px; padding-bottom: 24px; border-bottom: 3px solid #0891b2; }
  .header h1 { font-size: 28px; color: #0f172a; margin-bottom: 4px; }
  .header p { color: #64748b; font-size: 14px; }
  .filters { display: flex; gap: 16px; justify-content: center; margin-top: 12px; }
  .filter-tag { padding: 4px 12px; background: #e0f2fe; color: #0369a1; border-radius: 20px; font-size: 12px; }
  .kpis { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
  .kpi { background: white; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; text-align: center; }
  .kpi .value { font-size: 24px; font-weight: 700; color: #0891b2; }
  .kpi .label { font-size: 12px; color: #64748b; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.5px; }
  .section { margin-bottom: 32px; }
  .section h2 { font-size: 18px; color: #0f172a; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 2px solid #e2e8f0; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th { background: #0f172a; color: white; padding: 10px 12px; text-align: left; font-weight: 600; }
  td { padding: 8px 12px; border-bottom: 1px solid #e2e8f0; }
  tr:nth-child(even) { background: #f1f5f9; }
  tr:hover { background: #e0f2fe; }
  .text-right { text-align: right; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 11px; font-weight: 600; }
  .badge-ow { background: #dbeafe; color: #1d4ed8; }
  .badge-lp { background: #fef3c7; color: #b45309; }
  .badge-na { background: #f1f5f9; color: #475569; }
  .footer { margin-top: 48px; padding-top: 16px; border-top: 1px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 11px; }
  @media print {
    body { padding: 16px; }
    .kpis { grid-template-columns: repeat(4, 1fr); }
    table { page-break-inside: auto; }
    tr { page-break-inside: avoid; }
  }
</style>
</head>
<body>
  <div class="header">
    <h1>Customer Intelligence</h1>
    <p>Relatorio gerado em ${now}</p>
    <div class="filters">
      ${filters.tipo !== 'geral' ? `<span class="filter-tag">Tipo: ${filters.tipo}</span>` : ''}
      <span class="filter-tag">Período: ${filters.periodo === 'todos' ? 'Todo Período' : filters.periodo}</span>
      ${filters.unidade ? `<span class="filter-tag">Unidade filtrada</span>` : '<span class="filter-tag">Todas Unidades</span>'}
    </div>
  </div>

  <div class="kpis">
    <div class="kpi">
      <div class="value">${formatCurrency(kpis.totalFaturamento)}</div>
      <div class="label">Faturamento Total</div>
    </div>
    <div class="kpi">
      <div class="value">${formatCurrency(kpis.ticketMedio)}</div>
      <div class="label">Ticket Medio</div>
    </div>
    <div class="kpi">
      <div class="value">${kpis.totalClientes}</div>
      <div class="label">Total Clientes</div>
    </div>
    <div class="kpi">
      <div class="value">${vendedores.length}</div>
      <div class="label">Vendedores Ativos</div>
    </div>
  </div>

  <div class="section">
    <h2>Carteira de Clientes</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Cliente</th>
          <th>Documento</th>
          <th>Tipos</th>
          <th class="text-right">Valor</th>
          <th class="text-right">OS</th>
          <th class="text-right">Ticket Medio</th>
          <th>Vendedor</th>
          <th>Status</th>
        </tr>
      </thead>
      <tbody>
        ${clientes.slice(0, 50).map((c, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${escapeHtml(c.nome)}</strong></td>
          <td>${escapeHtml(c.documento)}</td>
          <td>${c.tiposOS.map(t => `<span class="badge badge-${t.toLowerCase()}">${t}</span>`).join(' ')}</td>
          <td class="text-right">${formatCurrency(getValorCliente(c))}</td>
          <td class="text-right">${c.totalOS}</td>
          <td class="text-right">${formatCurrency(c.ticketMedio)}</td>
          <td>${escapeHtml(c.vendedorNome)}</td>
          <td>${c.status}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>

  ${vendedores.length > 0 ? `
  <div class="section">
    <h2>Performance de Vendedores</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Vendedor</th>
          <th class="text-right">Faturamento</th>
          <th class="text-right">OS</th>
          <th class="text-right">Clientes</th>
          <th class="text-right">Ticket Medio</th>
        </tr>
      </thead>
      <tbody>
        ${vendedores.map((v, i) => `
        <tr>
          <td>${i + 1}</td>
          <td><strong>${escapeHtml(v.nome)}</strong></td>
          <td class="text-right">${formatCurrency(v.faturamento)}</td>
          <td class="text-right">${v.totalOS}</td>
          <td class="text-right">${v.totalClientes}</td>
          <td class="text-right">${formatCurrency(v.ticketMedio)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}

  ${pecas.length > 0 ? `
  <div class="section">
    <h2>Peças Mais Utilizadas (Top 20)</h2>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>PN</th>
          <th>Descricao</th>
          <th class="text-right">Quantidade</th>
          <th class="text-right">Valor Total</th>
          <th class="text-right">Valor Medio</th>
        </tr>
      </thead>
      <tbody>
        ${pecas.slice(0, 20).map((p, i) => `
        <tr>
          <td>${i + 1}</td>
          <td>${escapeHtml(p.pn)}</td>
          <td>${escapeHtml(p.descricao)}</td>
          <td class="text-right">${p.quantidade}</td>
          <td class="text-right">${formatCurrency(p.valorTotal)}</td>
          <td class="text-right">${formatCurrency(p.valorMedio)}</td>
        </tr>`).join('')}
      </tbody>
    </table>
  </div>` : ''}

  <div class="footer">
    <p>Customer Intelligence - Gerado automaticamente em ${now}</p>
  </div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  window.open(url, '_blank');
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}

function escapeHtml(str: string): string {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
