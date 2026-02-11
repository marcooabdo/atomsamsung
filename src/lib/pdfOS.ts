import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface OSPeca {
  pn: string;
  descricao: string;
  quantidade: number;
  valor_unitario?: number;
  valor_final_unitario?: number;
  valor_total?: number;
  exibir_no_pdf?: boolean;
}

interface OSServico {
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

interface Pagamento {
  valor: number;
  forma_pagamento: string;
  data_pagamento: string | null;
  observacoes?: string | null;
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
  cliente_cep: string | null;
  cliente_telefone: string | null;
  cliente_celular: string | null;
  cliente_email: string | null;
  cliente_cpf_cnpj: string | null;
  aparelho_modelo: string | null;
  aparelho_linha: string | null;
  aparelho_imei: string | null;
  defeito_relatado: string | null;
  diagnostico_tecnico: string | null;
  observacoes_internas: string | null;
  descricao_reparo: string | null;
  reparo_efetuado: string | null;
  acessorios: string | null;
  tipo_atendimento: 'IH' | 'CI';
  tipo_os: 'LP' | 'OW';
  tipo_orcamento: string | null;
  status_garantia: string | null;
  data_abertura: string | null;
  data_agendamento: string | null;
  data_compra: string | null;
  created_at: string;
  unidade: {
    nome: string;
    samsung_asccode: string | null;
    telefone: string | null;
  };
  os_pecas?: OSPeca[];
  cotacoes_pecas?: OSPeca[];
  cotacoes_servicos?: OSServico[];
  pagamentos?: Pagamento[];
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

const COLORS = {
  samsungBlue: [12, 77, 162] as [number, number, number],
  headerBg: [245, 245, 245] as [number, number, number],
  borderGray: [200, 200, 200] as [number, number, number],
  lightGray: [240, 240, 240] as [number, number, number],
  black: [0, 0, 0] as [number, number, number],
  white: [255, 255, 255] as [number, number, number],
  darkGray: [80, 80, 80] as [number, number, number],
};

const MARGINS = {
  left: 15,
  right: 15,
  top: 15,
};

function formatDate(dateString: string | null): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR');
  } catch {
    return '';
  }
}

function formatDateTime(dateString: string | null): string {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  } catch {
    return '';
  }
}

function wrapText(doc: jsPDF, text: string, maxWidth: number, fontSize: number): string[] {
  doc.setFontSize(fontSize);
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  words.forEach(word => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const textWidth = doc.getTextWidth(testLine);

    if (textWidth <= maxWidth) {
      currentLine = testLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  });

  if (currentLine) lines.push(currentLine);
  return lines;
}

function drawCheckbox(doc: jsPDF, x: number, y: number, checked: boolean, size: number = 3.5): void {
  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.3);
  doc.rect(x, y - size + 0.5, size, size);

  if (checked) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text('v', x + 0.7, y);
  }
}

function formatFormaPagamento(forma: string): string {
  const formas: Record<string, string> = {
    'dinheiro': 'Dinheiro',
    'pix': 'PIX',
    'cartao_credito': 'Cartao de Credito',
    'cartao_debito': 'Cartao de Debito',
    'transferencia': 'Transferencia',
    'boleto': 'Boleto',
    'cheque': 'Cheque'
  };
  return formas[forma] || forma;
}

export async function gerarPDFOrdemServico(osData: OSData, pdfConfig: PDFConfig, opcoes?: { ocultarValores?: boolean }): Promise<Blob> {
  const ocultarValores = opcoes?.ocultarValores || false;
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - MARGINS.left - MARGINS.right;
  let yPos = MARGINS.top;

  const numeroOS = osData.numero_os_samsung || osData.numero_os_interna || 'N/A';
  const centroReparo = osData.unidade.samsung_asccode
    ? `${osData.unidade.samsung_asccode} - GLOBAL`
    : osData.unidade.nome;
  const centralAtendimento = osData.unidade.telefone || '';

  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.samsungBlue);
  doc.text('SAMSUNG', MARGINS.left, yPos + 5);

  doc.setFontSize(22);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.black);
  doc.text('Ordem de Servico', pageWidth / 2, yPos + 5, { align: 'center' });

  doc.setFontSize(7);
  doc.setTextColor(...COLORS.darkGray);
  doc.text('Follow up your Repair', pageWidth - MARGINS.right - 25, yPos - 2);

  doc.setFontSize(6);
  doc.setTextColor(...COLORS.samsungBlue);
  doc.text('https://www.samsung.com/br/support/your-service', pageWidth - MARGINS.right - 30, yPos + 6);
  doc.text('/track-repair', pageWidth - MARGINS.right - 30, yPos + 9);

  yPos += 18;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.black);
  doc.text(`SO Nro.: ${numeroOS}`, MARGINS.left, yPos);
  doc.text(`Centro de Reparo : ${centroReparo}`, pageWidth / 2 + 10, yPos);

  yPos += 5;
  doc.text(`No. do Cliente : ${osData.cliente_cpf_cnpj || ''}`, MARGINS.left, yPos);
  doc.text(`${osData.unidade.nome.toUpperCase()}`, pageWidth / 2 + 10, yPos);

  yPos += 5;
  doc.text(`No da Revenda :`, MARGINS.left, yPos);
  doc.text(`Central de Atendimento : ${centralAtendimento}`, pageWidth / 2 + 10, yPos);

  yPos += 8;

  const enderecoPartes = [
    osData.cliente_endereco,
    osData.cliente_numero ? `N ${osData.cliente_numero}` : null,
    osData.cliente_bairro,
    osData.cliente_cidade,
    osData.cliente_estado,
    osData.cliente_cep
  ].filter(Boolean);
  const enderecoCompleto = enderecoPartes.join(', ');

  const dataAbertura = osData.data_abertura
    ? formatDate(osData.data_abertura)
    : formatDate(osData.created_at);

  const telefones = [
    osData.cliente_telefone ? `[Residencial]${osData.cliente_telefone}` : null,
    osData.cliente_celular ? `[Celular]${osData.cliente_celular}` : null
  ].filter(Boolean).join('\n');

  const tipoServico = osData.tipo_atendimento === 'IH' ? 'In Home' : 'Carry In';

  const mainTableData = [
    [
      { content: 'Nome Consumidor', styles: { fillColor: COLORS.white, textColor: COLORS.samsungBlue, fontStyle: 'bold' } },
      { content: osData.cliente_nome || '', colSpan: 2 },
      { content: 'Data de Solicitacao', styles: { fillColor: COLORS.white, textColor: COLORS.samsungBlue, fontStyle: 'bold' } },
      { content: dataAbertura }
    ],
    [
      { content: 'Endereco', styles: { fillColor: COLORS.white, textColor: COLORS.samsungBlue, fontStyle: 'bold' } },
      { content: enderecoCompleto, colSpan: 4 }
    ],
    [
      { content: 'Data de agendamento', styles: { fillColor: COLORS.white, textColor: COLORS.samsungBlue, fontStyle: 'bold' } },
      { content: formatDateTime(osData.data_agendamento), colSpan: 4 }
    ],
    [
      { content: 'Telefone', styles: { fillColor: COLORS.white, textColor: COLORS.samsungBlue, fontStyle: 'bold' } },
      { content: telefones },
      { content: 'EMAIL', styles: { fillColor: COLORS.white, textColor: COLORS.samsungBlue, fontStyle: 'bold' } },
      { content: osData.cliente_email || '', colSpan: 2 }
    ],
    [
      { content: 'Modelo', styles: { fillColor: COLORS.white, textColor: COLORS.samsungBlue, fontStyle: 'bold' } },
      { content: osData.aparelho_modelo || '' },
      { content: 'No. de Serie ( IMEI )', styles: { fillColor: COLORS.white, textColor: COLORS.samsungBlue, fontStyle: 'bold' } },
      { content: osData.aparelho_imei || '', colSpan: 2 }
    ],
    [
      { content: 'Data da compra', styles: { fillColor: COLORS.white, textColor: COLORS.samsungBlue, fontStyle: 'bold' } },
      { content: formatDate(osData.data_compra) },
      { content: 'Tipo de Servico', styles: { fillColor: COLORS.white, textColor: COLORS.samsungBlue, fontStyle: 'bold' } },
      { content: tipoServico, colSpan: 2 }
    ]
  ];

  autoTable(doc, {
    startY: yPos,
    body: mainTableData,
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      lineColor: COLORS.borderGray,
      lineWidth: 0.2,
      valign: 'middle',
      overflow: 'linebreak'
    },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 55 },
      2: { cellWidth: 35 },
      3: { cellWidth: 55 }
    },
    didDrawPage: (data: any) => {
      yPos = data.cursor.y;
    }
  });

  yPos += 1;

  const isGarantiaCompleta = osData.tipo_os === 'LP' && osData.status_garantia !== 'fora_garantia';
  const isSomenteMaoObra = osData.tipo_orcamento === 'samsung_contigo';
  const isSomentePecas = false;
  const isForaGarantia = osData.tipo_os === 'OW' || osData.status_garantia === 'fora_garantia';

  autoTable(doc, {
    startY: yPos,
    body: [
      [
        { content: 'Status da Garantia', styles: { fillColor: COLORS.white, textColor: COLORS.samsungBlue, fontStyle: 'bold' }, rowSpan: 4 },
        { content: 'Garantia completa' },
        { content: '', styles: { cellWidth: 8 } }
      ],
      [
        { content: 'Somente mao de obra' },
        { content: '' }
      ],
      [
        { content: 'Somente pecas' },
        { content: '' }
      ],
      [
        { content: 'Fora de garantia' },
        { content: '' }
      ]
    ],
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 2,
      lineColor: COLORS.borderGray,
      lineWidth: 0.2,
      valign: 'middle'
    },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 130 },
      2: { cellWidth: 15 }
    },
    didDrawCell: (data: any) => {
      if (data.column.index === 2 && data.row.index >= 0) {
        const cellX = data.cell.x + 5;
        const cellY = data.cell.y + data.cell.height / 2 + 1;

        let isChecked = false;
        if (data.row.index === 0) isChecked = isGarantiaCompleta;
        if (data.row.index === 1) isChecked = isSomenteMaoObra;
        if (data.row.index === 2) isChecked = isSomentePecas;
        if (data.row.index === 3) isChecked = isForaGarantia;

        drawCheckbox(doc, cellX, cellY, isChecked, 3);
      }
    },
    didDrawPage: (data: any) => {
      yPos = data.cursor.y;
    }
  });

  yPos += 1;

  autoTable(doc, {
    startY: yPos,
    body: [
      [
        { content: 'Acessorio', styles: { fillColor: COLORS.white, textColor: COLORS.samsungBlue, fontStyle: 'bold' } },
        { content: osData.acessorios || '' }
      ],
      [
        { content: 'Descricao do defeito', styles: { fillColor: COLORS.white, textColor: COLORS.samsungBlue, fontStyle: 'bold' } },
        { content: osData.defeito_relatado || '' }
      ],
      [
        { content: 'Diagnostico Tecnico', styles: { fillColor: COLORS.white, textColor: COLORS.samsungBlue, fontStyle: 'bold' } },
        { content: osData.diagnostico_tecnico || '' }
      ],
      [
        { content: 'Descricao do Reparo', styles: { fillColor: COLORS.white, textColor: COLORS.samsungBlue, fontStyle: 'bold' } },
        { content: osData.descricao_reparo || osData.reparo_efetuado || '' }
      ],
      [
        { content: 'Observacoes', styles: { fillColor: COLORS.white, textColor: COLORS.samsungBlue, fontStyle: 'bold' } },
        { content: osData.observacoes_internas || '' }
      ]
    ],
    theme: 'grid',
    styles: {
      fontSize: 8,
      cellPadding: 3,
      lineColor: COLORS.borderGray,
      lineWidth: 0.2,
      valign: 'top',
      minCellHeight: 8
    },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 145 }
    },
    didDrawPage: (data: any) => {
      yPos = data.cursor.y;
    }
  });

  const allPecas: OSPeca[] = [];
  if (osData.os_pecas && osData.os_pecas.length > 0) {
    allPecas.push(...osData.os_pecas.filter(p => p.exibir_no_pdf !== false));
  }
  if (osData.cotacoes_pecas && osData.cotacoes_pecas.length > 0) {
    osData.cotacoes_pecas.filter(p => p.exibir_no_pdf !== false).forEach(peca => {
      const exists = allPecas.some(p => p.pn === peca.pn);
      if (!exists) {
        allPecas.push(peca);
      }
    });
  }

  const hasPecas = allPecas.length > 0;
  const hasServicos = !ocultarValores && osData.cotacoes_servicos && osData.cotacoes_servicos.length > 0;
  const hasPagamentos = !ocultarValores && osData.pagamentos && osData.pagamentos.length > 0;

  if (hasPecas || hasServicos || hasPagamentos) {
    yPos += 6;

    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = MARGINS.top;
    }

    if (hasPecas) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.black);
      doc.text(ocultarValores ? 'PECAS UTILIZADAS' : 'PECAS', MARGINS.left, yPos);
      yPos += 4;

      if (ocultarValores) {
        const pecasData = allPecas.map(peca => [
          peca.pn || '',
          peca.descricao || '',
          peca.quantidade?.toString() || '1'
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [['Codigo (PN)', 'Descricao', 'Qtd']],
          body: pecasData,
          theme: 'grid',
          styles: {
            fontSize: 8,
            cellPadding: 2,
            lineColor: COLORS.borderGray,
            lineWidth: 0.2
          },
          headStyles: {
            fillColor: COLORS.lightGray,
            textColor: COLORS.black,
            fontStyle: 'bold',
            halign: 'center'
          },
          columnStyles: {
            0: { cellWidth: 40 },
            1: { cellWidth: 120 },
            2: { cellWidth: 20, halign: 'center' }
          },
          didDrawPage: (data: any) => {
            yPos = data.cursor.y;
          }
        });
      } else {
        const pecasData = allPecas.map(peca => {
          const valorUnit = peca.valor_final_unitario ?? peca.valor_unitario ?? 0;
          const valorTotal = peca.valor_total ?? (valorUnit * peca.quantidade);
          return [
            peca.pn || '',
            peca.descricao || '',
            peca.quantidade?.toString() || '1',
            `R$ ${valorUnit.toFixed(2)}`,
            `R$ ${valorTotal.toFixed(2)}`
          ];
        });

        const totalPecas = allPecas.reduce((sum, peca) => {
          const valorUnit = peca.valor_final_unitario ?? peca.valor_unitario ?? 0;
          const valorTotal = peca.valor_total ?? (valorUnit * peca.quantidade);
          return sum + valorTotal;
        }, 0);

        autoTable(doc, {
          startY: yPos,
          head: [['PN', 'Descricao', 'Qtd', 'Valor Unit.', 'Valor Total']],
          body: pecasData,
          foot: [['', '', '', 'TOTAL PECAS:', `R$ ${totalPecas.toFixed(2)}`]],
          theme: 'grid',
          styles: {
            fontSize: 8,
            cellPadding: 2,
            lineColor: COLORS.borderGray,
            lineWidth: 0.2
          },
          headStyles: {
            fillColor: COLORS.lightGray,
            textColor: COLORS.black,
            fontStyle: 'bold',
            halign: 'center'
          },
          footStyles: {
            fillColor: COLORS.headerBg,
            textColor: COLORS.black,
            fontStyle: 'bold'
          },
          didDrawPage: (data: any) => {
            yPos = data.cursor.y;
          }
        });
      }

      yPos += 4;
    }

    if (hasServicos) {
      if (yPos > pageHeight - 50) {
        doc.addPage();
        yPos = MARGINS.top;
      }

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.black);
      doc.text('SERVICOS', MARGINS.left, yPos);
      yPos += 4;

      const servicosData = osData.cotacoes_servicos!.map(servico => [
        servico.descricao,
        servico.quantidade.toString(),
        `R$ ${servico.valor_unitario.toFixed(2)}`,
        `R$ ${servico.valor_total.toFixed(2)}`
      ]);

      const totalServicos = osData.cotacoes_servicos!.reduce((sum, servico) => sum + servico.valor_total, 0);

      autoTable(doc, {
        startY: yPos,
        head: [['Descricao', 'Qtd', 'Valor Unit.', 'Valor Total']],
        body: servicosData,
        foot: [['', '', 'TOTAL SERVICOS:', `R$ ${totalServicos.toFixed(2)}`]],
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 2,
          lineColor: COLORS.borderGray,
          lineWidth: 0.2
        },
        headStyles: {
          fillColor: COLORS.lightGray,
          textColor: COLORS.black,
          fontStyle: 'bold',
          halign: 'center'
        },
        footStyles: {
          fillColor: COLORS.headerBg,
          textColor: COLORS.black,
          fontStyle: 'bold'
        },
        didDrawPage: (data: any) => {
          yPos = data.cursor.y;
        }
      });

      yPos += 4;
    }

    if (hasPagamentos) {
      if (yPos > pageHeight - 50) {
        doc.addPage();
        yPos = MARGINS.top;
      }

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.black);
      doc.text('PAGAMENTOS', MARGINS.left, yPos);
      yPos += 4;

      const pagamentosData = osData.pagamentos!.map(pag => [
        formatFormaPagamento(pag.forma_pagamento),
        formatDate(pag.data_pagamento),
        `R$ ${pag.valor.toFixed(2)}`,
        pag.observacoes || ''
      ]);

      const totalPagamentos = osData.pagamentos!.reduce((sum, pag) => sum + pag.valor, 0);

      autoTable(doc, {
        startY: yPos,
        head: [['Forma', 'Data', 'Valor', 'Obs']],
        body: pagamentosData,
        foot: [['', '', `R$ ${totalPagamentos.toFixed(2)}`, 'TOTAL PAGO']],
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 2,
          lineColor: COLORS.borderGray,
          lineWidth: 0.2
        },
        headStyles: {
          fillColor: COLORS.lightGray,
          textColor: COLORS.black,
          fontStyle: 'bold',
          halign: 'center'
        },
        footStyles: {
          fillColor: COLORS.headerBg,
          textColor: COLORS.black,
          fontStyle: 'bold'
        },
        didDrawPage: (data: any) => {
          yPos = data.cursor.y;
        }
      });

      yPos += 4;
    }

    if (!ocultarValores && osData.valor_total && osData.valor_total > 0) {
      if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = MARGINS.top;
      }

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('RESUMO FINANCEIRO', MARGINS.left, yPos);
      yPos += 4;

      autoTable(doc, {
        startY: yPos,
        body: [
          ['Valor Total', `R$ ${osData.valor_total.toFixed(2)}`],
          ['Valor Pago', `R$ ${(osData.valor_pago || 0).toFixed(2)}`],
          ['Saldo Restante', `R$ ${(osData.saldo_restante || 0).toFixed(2)}`],
          ['Status', osData.status_pagamento === 'pago' ? 'PAGO' :
                     osData.status_pagamento === 'parcial' ? 'PARCIAL' : 'PENDENTE']
        ],
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 2,
          lineColor: COLORS.borderGray,
          lineWidth: 0.2
        },
        columnStyles: {
          0: { cellWidth: 45, fontStyle: 'bold', fillColor: COLORS.headerBg },
          1: { cellWidth: 45 }
        },
        didDrawPage: (data: any) => {
          yPos = data.cursor.y;
        }
      });

      yPos += 4;
    }
  }

  yPos += 10;

  if (yPos > pageHeight - 80) {
    doc.addPage();
    yPos = MARGINS.top;
  }

  if (pdfConfig.canais_atendimento) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.samsungBlue);
    doc.text('Canais de Atendimento SAMSUNG', MARGINS.left, yPos);
    yPos += 4;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(6);
    doc.setTextColor(...COLORS.black);

    const canaisLinhas = pdfConfig.canais_atendimento.split('\n');
    canaisLinhas.forEach(linha => {
      if (linha.trim()) {
        if (yPos > pageHeight - 20) {
          doc.addPage();
          yPos = MARGINS.top;
        }
        const wrappedLines = wrapText(doc, linha, contentWidth, 6);
        wrappedLines.forEach(l => {
          doc.text(l, MARGINS.left, yPos);
          yPos += 3;
        });
      }
    });

    yPos += 4;
  }

  if (pdfConfig.observacoes_gerais) {
    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = MARGINS.top;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7);
    doc.setTextColor(...COLORS.black);
    doc.text('IMPORTANTE:', MARGINS.left, yPos);
    yPos += 3;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(5.5);

    const obsLinhas = pdfConfig.observacoes_gerais.split('\n');
    obsLinhas.forEach(linha => {
      if (linha.trim()) {
        if (yPos > pageHeight - 20) {
          doc.addPage();
          yPos = MARGINS.top;
        }
        const wrappedLines = wrapText(doc, linha, contentWidth, 5.5);
        wrappedLines.forEach(l => {
          doc.text(l, MARGINS.left, yPos);
          yPos += 2.5;
        });
      }
    });
  }

  yPos += 8;

  if (yPos > pageHeight - 25) {
    doc.addPage();
    yPos = MARGINS.top;
  }

  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.3);
  doc.line(MARGINS.left, yPos, MARGINS.left + 70, yPos);
  yPos += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text('Assinatura do Cliente', MARGINS.left, yPos);

  const hasTermos = pdfConfig.termo_orcamento || pdfConfig.termo_garantia;

  if (hasTermos) {
    doc.addPage();
    yPos = MARGINS.top;

    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.black);
    doc.text('TERMOS DE SERVICO', pageWidth / 2, yPos, { align: 'center' });

    yPos += 8;

    const renderTermoSection = (titulo: string, texto: string) => {
      if (!texto) return;

      if (yPos > pageHeight - 30) {
        doc.addPage();
        yPos = MARGINS.top;
      }

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.samsungBlue);
      doc.text(titulo, MARGINS.left, yPos);
      yPos += 5;

      doc.setFontSize(6);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(...COLORS.black);

      const paragraphs = texto.split('\n\n');

      paragraphs.forEach(paragraph => {
        if (paragraph.trim()) {
          const isBold = /^\d+[\.\-\)]/.test(paragraph.trim());

          if (isBold) {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
          } else {
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6);
          }

          const lines = paragraph.split('\n');
          lines.forEach(line => {
            if (line.trim()) {
              const wrappedLines = wrapText(doc, line, contentWidth, isBold ? 7 : 6);
              wrappedLines.forEach(wrappedLine => {
                if (yPos > pageHeight - 15) {
                  doc.addPage();
                  yPos = MARGINS.top;
                }
                doc.text(wrappedLine, MARGINS.left, yPos);
                yPos += isBold ? 3.5 : 2.8;
              });
            }
          });
          yPos += 1.5;
        }
      });

      yPos += 6;
    };

    if (pdfConfig.termo_orcamento) {
      renderTermoSection('TERMO DE ORCAMENTO', pdfConfig.termo_orcamento);
    }

    if (pdfConfig.termo_garantia) {
      renderTermoSection('TERMO DE GARANTIA', pdfConfig.termo_garantia);
    }

    yPos += 6;

    if (yPos > pageHeight - 50) {
      doc.addPage();
      yPos = MARGINS.top;
    }

    doc.setDrawColor(...COLORS.black);
    doc.setLineWidth(0.3);
    doc.line(MARGINS.left, yPos, MARGINS.left + 80, yPos);
    yPos += 4;
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text('CPF DO CLIENTE EXTENSO', MARGINS.left, yPos);

    yPos += 12;

    doc.line(MARGINS.left, yPos, MARGINS.left + 80, yPos);
    yPos += 4;
    doc.text('ASSINATURA CLIENTE', MARGINS.left, yPos);

    yPos += 12;

    if (yPos > pageHeight - 40) {
      doc.addPage();
      yPos = MARGINS.top;
    }

    const boxX = MARGINS.left;
    const boxY = yPos;
    const boxWidth = 80;
    const boxHeight = 30;

    doc.setDrawColor(...COLORS.samsungBlue);
    doc.setLineWidth(0.5);
    doc.rect(boxX, boxY, boxWidth, boxHeight);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...COLORS.black);
    doc.text('Samsung Smart Xperience:', boxX + 3, boxY + 6);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('O jeito mais smart de', boxX + 3, boxY + 11);
    doc.text('atender voce.', boxX + 3, boxY + 15);

    doc.setTextColor(...COLORS.samsungBlue);
    doc.text('Conheca:', boxX + 3, boxY + 19);

    const box2X = pageWidth / 2 + 5;
    doc.setDrawColor(...COLORS.borderGray);
    doc.rect(box2X, boxY, boxWidth, boxHeight);

    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...COLORS.black);

    const smartThingsTexto = [
      'Com o app Smarthings, transforme',
      'sua casa em um lar inteligente.',
      'Controle seus dispositivos com seu',
      'telefone, reduza o gasto de energia',
      'da sua casa e automatize suas',
      'rotinas.'
    ];

    let smartY = boxY + 5;
    smartThingsTexto.forEach(linha => {
      doc.text(linha, box2X + 3, smartY);
      smartY += 4;
    });

    doc.setTextColor(...COLORS.samsungBlue);
    doc.text('Conheca mais:', box2X + 3, smartY);
  }

  return doc.output('blob');
}
