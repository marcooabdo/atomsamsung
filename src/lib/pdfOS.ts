import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface OSData {
  numero_os_samsung: string | null;
  numero_os_interna: string | null;
  cliente_nome: string;
  cliente_endereco: string | null;
  cliente_numero: string | null;
  cliente_bairro: string | null;
  cliente_cidade: string | null;
  cliente_estado: string | null;
  cliente_telefone: string | null;
  cliente_email: string | null;
  cliente_cpf_cnpj: string | null;
  aparelho_modelo: string | null;
  aparelho_linha: string | null;
  aparelho_imei: string | null;
  defeito_relatado: string | null;
  observacoes_internas: string | null;
  tipo_atendimento: 'IH' | 'CI';
  tipo_os: 'LP' | 'OW';
  tipo_orcamento: string | null;
  data_abertura: string | null;
  created_at: string;
  unidade: {
    nome: string;
    samsung_asccode: string | null;
    telefone: string | null;
  };
  cotacoes_pecas?: Array<{
    pn: string;
    descricao: string;
    quantidade: number;
    valor_final_unitario: number;
    valor_total: number;
  }>;
  cotacoes_servicos?: Array<{
    descricao: string;
    quantidade: number;
    valor_unitario: number;
    valor_total: number;
  }>;
  valor_total: number | null;
  valor_pago: number | null;
  saldo_restante: number | null;
  status_pagamento: string | null;
}

interface PDFConfig {
  termo_orcamento: string;
  termo_garantia: string;
  canais_atendimento: string;
  observacoes_gerais: string;
  logo_url: string | null;
  rodape_personalizado: string | null;
}

function splitTextToLines(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach(word => {
    if ((currentLine + ' ' + word).trim().length <= maxCharsPerLine) {
      currentLine = (currentLine + ' ' + word).trim();
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  });

  if (currentLine) lines.push(currentLine);
  return lines;
}

export async function gerarPDFOrdemServico(osData: OSData, pdfConfig: PDFConfig): Promise<Blob> {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 20;

  doc.setFontSize(26);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 114, 198);
  doc.text('SAMSUNG', 20, yPos);

  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Ordem de Serviço', pageWidth / 2, yPos, { align: 'center' });

  yPos += 12;

  const numeroOS = osData.numero_os_samsung || osData.numero_os_interna || 'N/A';
  const centroReparo = osData.unidade.samsung_asccode
    ? `${osData.unidade.samsung_asccode} GROUP GLOBAL`
    : osData.unidade.nome;
  const centralAtendimento = osData.unidade.telefone || '';

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`SO No.: ${numeroOS}`, 20, yPos);
  yPos += 6;
  doc.text(`Centro de Reparo: ${centroReparo}`, 20, yPos);
  yPos += 6;
  doc.text(`Central de Atendimento: ${centralAtendimento}`, 20, yPos);
  yPos += 10;

  const enderecoPartes = [
    osData.cliente_endereco,
    osData.cliente_numero ? `Nº ${osData.cliente_numero}` : null,
    osData.cliente_bairro,
    osData.cliente_cidade,
    osData.cliente_estado
  ].filter(Boolean);
  const enderecoCompleto = enderecoPartes.join(', ');

  const dataAbertura = osData.data_abertura
    ? new Date(osData.data_abertura).toLocaleDateString('pt-BR')
    : new Date(osData.created_at).toLocaleDateString('pt-BR');

  const statusGarantia = osData.tipo_os === 'LP' ? 'Garantia completa' :
                        osData.tipo_orcamento === 'samsung_contigo' ? 'Samsung Contigo' :
                        'Fora de garantia';

  const tipoServico = osData.tipo_atendimento === 'IH' ? 'In Home' : 'Carry In';

  const tableData = [
    ['Nome Consumidor', osData.cliente_nome, 'Data de Solicitação', dataAbertura],
    ['Endereço', enderecoCompleto, 'e-MAIL', osData.cliente_email || ''],
    ['Telefone', osData.cliente_telefone || '', 'Tipo de Serviço', tipoServico],
    ['Modelo', osData.aparelho_modelo || '', 'No. de Série (IMEI)', osData.aparelho_imei || '']
  ];

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: tableData,
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 3,
      lineColor: [200, 200, 200],
      lineWidth: 0.1
    },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: 'bold', fillColor: [245, 245, 245], fontSize: 8 },
      1: { cellWidth: 58 },
      2: { cellWidth: 38, fontStyle: 'bold', fillColor: [245, 245, 245], fontSize: 8 },
      3: { cellWidth: 47 }
    },
    didDrawPage: function(data: any) {
      yPos = data.cursor.y;
    }
  });

  yPos += 3;

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: [
      ['Status da Garantia', statusGarantia]
    ],
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 3,
      lineColor: [200, 200, 200],
      lineWidth: 0.1
    },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: 'bold', fillColor: [245, 245, 245], fontSize: 8 },
      1: { cellWidth: 143 }
    },
    didDrawPage: function(data: any) {
      yPos = data.cursor.y;
    }
  });

  yPos += 3;

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: [
      ['Acessório', ''],
      ['Descrição do defeito', osData.defeito_relatado || 'SEM IMAGEM'],
      ['Descrição do Reparo', ''],
      ['Observações', osData.observacoes_internas || '']
    ],
    theme: 'grid',
    styles: {
      fontSize: 9,
      cellPadding: 3,
      lineColor: [200, 200, 200],
      lineWidth: 0.1
    },
    columnStyles: {
      0: { cellWidth: 42, fontStyle: 'bold', fillColor: [245, 245, 245], fontSize: 8 },
      1: { cellWidth: 143 }
    },
    didDrawPage: function(data: any) {
      yPos = data.cursor.y;
    }
  });

  yPos += 8;

  if (osData.cotacoes_pecas && osData.cotacoes_pecas.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('PEÇAS', 20, yPos);
    yPos += 5;

    const pecasData = osData.cotacoes_pecas.map(peca => [
      peca.pn,
      peca.descricao,
      peca.quantidade.toString(),
      `R$ ${peca.valor_final_unitario.toFixed(2)}`,
      `R$ ${peca.valor_total.toFixed(2)}`
    ]);

    const totalPecas = osData.cotacoes_pecas.reduce((sum, peca) => sum + peca.valor_total, 0);

    autoTable(doc, {
      startY: yPos,
      head: [['PN', 'Descrição', 'Qtd', 'Valor Unit.', 'Valor Total']],
      body: pecasData,
      foot: [['', '', '', 'TOTAL PEÇAS:', `R$ ${totalPecas.toFixed(2)}`]],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      footStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold' },
      didDrawPage: function(data: any) {
        yPos = data.cursor.y;
      }
    });

    yPos += 6;
  }

  if (osData.cotacoes_servicos && osData.cotacoes_servicos.length > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('SERVIÇOS', 20, yPos);
    yPos += 5;

    const servicosData = osData.cotacoes_servicos.map(servico => [
      servico.descricao,
      servico.quantidade.toString(),
      `R$ ${servico.valor_unitario.toFixed(2)}`,
      `R$ ${servico.valor_total.toFixed(2)}`
    ]);

    const totalServicos = osData.cotacoes_servicos.reduce((sum, servico) => sum + servico.valor_total, 0);

    autoTable(doc, {
      startY: yPos,
      head: [['Descrição', 'Qtd', 'Valor Unit.', 'Valor Total']],
      body: servicosData,
      foot: [['', '', 'TOTAL SERVIÇOS:', `R$ ${totalServicos.toFixed(2)}`]],
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: [240, 240, 240], textColor: [0, 0, 0], fontStyle: 'bold' },
      footStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold' },
      didDrawPage: function(data: any) {
        yPos = data.cursor.y;
      }
    });

    yPos += 6;
  }

  if (osData.valor_total && osData.valor_total > 0) {
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text('INFORMAÇÕES DE PAGAMENTO', 20, yPos);
    yPos += 5;

    const pagamentoData = [
      ['Valor Total', `R$ ${osData.valor_total.toFixed(2)}`],
      ['Valor Pago', `R$ ${(osData.valor_pago || 0).toFixed(2)}`],
      ['Saldo Restante', `R$ ${(osData.saldo_restante || 0).toFixed(2)}`],
      ['Status', osData.status_pagamento === 'pago' ? 'PAGO' :
                 osData.status_pagamento === 'parcial' ? 'PARCIAL' : 'PENDENTE']
    ];

    autoTable(doc, {
      startY: yPos,
      head: [],
      body: pagamentoData,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 2.5 },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold', fillColor: [245, 245, 245], fontSize: 8 },
        1: { cellWidth: 135 }
      },
      didDrawPage: function(data: any) {
        yPos = data.cursor.y;
      }
    });

    yPos += 5;
  }

  if (yPos > pageHeight - 40) {
    doc.addPage();
    yPos = 20;
  }

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  const canaisLines = splitTextToLines(pdfConfig.canais_atendimento, 100);
  canaisLines.forEach(line => {
    if (yPos > pageHeight - 20) {
      doc.addPage();
      yPos = 20;
    }
    doc.text(line, 20, yPos);
    yPos += 4;
  });

  yPos += 5;

  const obsLines = splitTextToLines(pdfConfig.observacoes_gerais, 100);
  obsLines.forEach(line => {
    if (yPos > pageHeight - 20) {
      doc.addPage();
      yPos = 20;
    }
    doc.text(line, 20, yPos);
    yPos += 4;
  });

  yPos += 10;

  if (yPos > pageHeight - 40) {
    doc.addPage();
    yPos = 20;
  }

  doc.line(20, yPos, 90, yPos);
  yPos += 5;
  doc.setFont('helvetica', 'bold');
  doc.text('Assinatura do Cliente', 20, yPos);

  doc.addPage();
  yPos = 20;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('TERMOS DE SERVIÇO', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');

  const termoOrcamentoLines = pdfConfig.termo_orcamento.split('\n');
  termoOrcamentoLines.forEach(paragraph => {
    if (paragraph.trim()) {
      const lines = splitTextToLines(paragraph, 100);
      lines.forEach(line => {
        if (yPos > pageHeight - 20) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(line, 20, yPos, { maxWidth: pageWidth - 40 });
        yPos += 4;
      });
      yPos += 2;
    }
  });

  yPos += 5;

  const termoGarantiaLines = pdfConfig.termo_garantia.split('\n');
  termoGarantiaLines.forEach(paragraph => {
    if (paragraph.trim()) {
      const lines = splitTextToLines(paragraph, 100);
      lines.forEach(line => {
        if (yPos > pageHeight - 20) {
          doc.addPage();
          yPos = 20;
        }
        doc.text(line, 20, yPos, { maxWidth: pageWidth - 40 });
        yPos += 4;
      });
      yPos += 2;
    }
  });

  yPos += 10;

  if (yPos > pageHeight - 40) {
    doc.addPage();
    yPos = 20;
  }

  doc.line(20, yPos, 90, yPos);
  yPos += 5;
  doc.text('CPF DO CLIENTE EXTENSO', 20, yPos);
  yPos += 10;
  doc.line(20, yPos, 90, yPos);
  yPos += 5;
  doc.text('ASSINATURA CLIENTE', 20, yPos);

  return doc.output('blob');
}
