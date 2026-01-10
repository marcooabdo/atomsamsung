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
  cliente_cep: string | null;
  cliente_telefone: string | null;
  cliente_celular: string | null;
  cliente_email: string | null;
  cliente_cpf_cnpj: string | null;
  aparelho_modelo: string | null;
  aparelho_linha: string | null;
  aparelho_imei: string | null;
  defeito_relatado: string | null;
  observacoes_internas: string | null;
  descricao_reparo: string | null;
  acessorios: string | null;
  tipo_atendimento: 'IH' | 'CI';
  tipo_os: 'LP' | 'OW';
  tipo_orcamento: string | null;
  status_garantia: string | null;
  data_abertura: string | null;
  data_agendamento: string | null;
  data_compra: string | null;
  created_at: string;
  codigo_engenheiro: string | null;
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

export async function gerarPDFOrdemServico(osData: OSData, pdfConfig: PDFConfig): Promise<Blob> {
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

  doc.setFontSize(28);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.samsungBlue);
  doc.text('SAMSUNG', MARGINS.left, yPos + 5);

  doc.setFontSize(22);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.black);
  doc.text('Ordem de Serviço', pageWidth / 2, yPos + 5, { align: 'center' });

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
  doc.text(`Central de Atendimento :`, pageWidth / 2 + 10, yPos);

  yPos += 5;
  doc.text(`ASC Job No. : ${numeroOS}`, pageWidth / 2 + 10, yPos);

  const barcodeY = yPos - 12;
  const barcodeX = pageWidth / 2 - 25;
  doc.setDrawColor(...COLORS.black);
  doc.setLineWidth(0.5);

  const barcodeData = numeroOS.replace(/[^0-9]/g, '') || '0000000000';
  for (let i = 0; i < 40; i++) {
    const barWidth = (parseInt(barcodeData[i % barcodeData.length]) % 3) + 1;
    const x = barcodeX + (i * 1.2);
    if (i % 2 === 0) {
      doc.setLineWidth(barWidth * 0.3);
      doc.line(x, barcodeY, x, barcodeY + 10);
    }
  }

  yPos += 8;

  const enderecoPartes = [
    osData.cliente_endereco,
    osData.cliente_numero ? `${osData.cliente_numero}` : null,
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
      { content: 'Data de Solicitação', styles: { fillColor: COLORS.white, textColor: COLORS.samsungBlue, fontStyle: 'bold' } },
      { content: dataAbertura }
    ],
    [
      { content: 'Endereço', styles: { fillColor: COLORS.white, textColor: COLORS.samsungBlue, fontStyle: 'bold' } },
      { content: enderecoCompleto, colSpan: 4 }
    ],
    [
      { content: 'Data de agendamento', styles: { fillColor: COLORS.white, textColor: COLORS.samsungBlue, fontStyle: 'bold' } },
      { content: formatDateTime(osData.data_agendamento) },
      { content: 'Código do Engenheiro', styles: { fillColor: COLORS.white, textColor: COLORS.samsungBlue, fontStyle: 'bold' } },
      { content: osData.codigo_engenheiro || '', colSpan: 2 }
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
      { content: 'No. de Série ( IMEI )', styles: { fillColor: COLORS.white, textColor: COLORS.samsungBlue, fontStyle: 'bold' } },
      { content: osData.aparelho_imei || '', colSpan: 2 }
    ],
    [
      { content: 'Data da compra', styles: { fillColor: COLORS.white, textColor: COLORS.samsungBlue, fontStyle: 'bold' } },
      { content: formatDate(osData.data_compra) },
      { content: 'Tipo de Serviço', styles: { fillColor: COLORS.white, textColor: COLORS.samsungBlue, fontStyle: 'bold' } },
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
        { content: '', styles: { cellWidth: 8 } },
        { content: 'Recebimento do reparo', styles: { textColor: COLORS.samsungBlue } },
        { content: '' }
      ],
      [
        { content: 'Somente mão de obra' },
        { content: '' },
        { content: 'Reparo Completo', styles: { textColor: COLORS.samsungBlue } },
        { content: '' }
      ],
      [
        { content: 'Somente peças' },
        { content: '' },
        { content: 'Produto entregue', styles: { textColor: COLORS.samsungBlue } },
        { content: '' }
      ],
      [
        { content: 'Fora de garantia' },
        { content: '' },
        { content: 'Retornado por/Data', styles: { textColor: COLORS.samsungBlue } },
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
      1: { cellWidth: 35 },
      2: { cellWidth: 8 },
      3: { cellWidth: 40 },
      4: { cellWidth: 62 }
    },
    didDrawCell: (data: any) => {
      if (data.column.index === 2 && data.row.index >= 0) {
        const cellX = data.cell.x + 2;
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
        { content: 'Acessório', styles: { fillColor: COLORS.white, textColor: COLORS.samsungBlue, fontStyle: 'bold' } },
        { content: osData.acessorios || '' }
      ],
      [
        { content: 'Descrição do defeito', styles: { fillColor: COLORS.white, textColor: COLORS.samsungBlue, fontStyle: 'bold' } },
        { content: osData.defeito_relatado || 'SEM IMAGEM' }
      ],
      [
        { content: 'Descrição do Reparo', styles: { fillColor: COLORS.white, textColor: COLORS.samsungBlue, fontStyle: 'bold' } },
        { content: osData.descricao_reparo || '' }
      ],
      [
        { content: 'Observação', styles: { fillColor: COLORS.white, textColor: COLORS.samsungBlue, fontStyle: 'bold' } },
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

  if ((osData.cotacoes_pecas && osData.cotacoes_pecas.length > 0) ||
      (osData.cotacoes_servicos && osData.cotacoes_servicos.length > 0)) {

    yPos += 6;

    if (yPos > pageHeight - 60) {
      doc.addPage();
      yPos = MARGINS.top;
    }

    if (osData.cotacoes_pecas && osData.cotacoes_pecas.length > 0) {
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.black);
      doc.text('PECAS', MARGINS.left, yPos);
      yPos += 4;

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

      yPos += 4;
    }

    if (osData.cotacoes_servicos && osData.cotacoes_servicos.length > 0) {
      if (yPos > pageHeight - 50) {
        doc.addPage();
        yPos = MARGINS.top;
      }

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(...COLORS.black);
      doc.text('SERVICOS', MARGINS.left, yPos);
      yPos += 4;

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

    if (osData.valor_total && osData.valor_total > 0) {
      if (yPos > pageHeight - 40) {
        doc.addPage();
        yPos = MARGINS.top;
      }

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text('RESUMO DO PAGAMENTO', MARGINS.left, yPos);
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

  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.samsungBlue);
  doc.text('Canais de Atendimento SAMSUNG', MARGINS.left, yPos);

  yPos += 4;
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.black);
  doc.text('Online:', MARGINS.left, yPos);

  yPos += 3;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);

  const canaisOnline = [
    'Para suporte, realizar agendamentos ou acompanhar seu reparo acesse: https://www.samsung.com/br/support/your-service/main',
    'Acesse tambem nosso app Samsung Members para suporte, diagnostico e agendamentos.',
    'Para suporte via Chat ou e-mail: acesse www.samsung.com/br/support',
    'Videos no Youtube com dicas de configuracao, atualizacao de softwares: acesse www.youtube.com/samsungbrasil'
  ];

  canaisOnline.forEach(linha => {
    doc.text(linha, MARGINS.left, yPos);
    yPos += 3;
  });

  yPos += 2;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('Tipos de atendimento:', MARGINS.left, yPos);
  yPos += 3;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text('Balcao / Via Correios / Em Domicilio', MARGINS.left, yPos);

  yPos += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.text('Central de Atendimento:', MARGINS.left, yPos);
  yPos += 3;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6);
  doc.text('4004-0000 (Capitais) / 0800 555 000 (Demais Cidades) / 3003-0000 (Clientes Corporativos)', MARGINS.left, yPos);

  yPos += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(...COLORS.black);
  doc.text('IMPORTANTE:', MARGINS.left, yPos);

  yPos += 3;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(5.5);

  const importanteTexto = [
    'E de responsabilidade do cliente realizar copia de seguranca (backup) de agenda, fotos, documentos, musicas, aplicativos ou quaisquer outros tipos de dados, informacoes gravadas no produto.',
    'Alem do backup obrigatorio, e dever do cliente excluir todos dados, fotos e demais informacoes pessoais do usuario.',
    'O Cliente fica ciente que todos os dados do aparelho serao apagados pela Empresa para a realizacao do reparo, caso o Cliente ainda nao os tenha apagado.',
    'Nao nos responsabilizamos pela pelicula instalada no produto.',
    'Autorizo a Samsung a utilizar meus dados pessoais presentes nesta Ordem de Servico para a finalidade especifica de realizacao do reparo do produto.',
    'Para maior comodidade e satisfacao de nossos consumidores, mesmo quando nao constatado nenhum vicio, todos os aparelhos avaliados ja retornam com a versao do Software atualizada.',
    'O Cliente, como agente participante do Programa Nacional de destinacao dos Residuos Solidos, concorda neste ato que a Samsung dara a destinacao correta a peca eventualmente substituida neste reparo.',
    'O cliente concorda e autoriza a Samsung a empregar no reparo do seu produto pecas ou componentes de reposicao novos ou recondicionados, os quais possuirao as mesmas especificacoes tecnicas e de qualidade de pecas ou componentes novos',
    '(art. 21, Codigo de Defesa do Consumidor).'
  ];

  importanteTexto.forEach(linha => {
    if (yPos > pageHeight - 25) {
      doc.addPage();
      yPos = MARGINS.top;
    }
    const wrappedLines = wrapText(doc, linha, contentWidth, 5.5);
    wrappedLines.forEach(l => {
      doc.text(l, MARGINS.left, yPos);
      yPos += 2.5;
    });
  });

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

  doc.addPage();
  yPos = MARGINS.top;

  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.black);
  doc.text('TERMOS DE SERVICO', pageWidth / 2, yPos, { align: 'center' });

  yPos += 8;

  const termosCompletos = `Para efeito deste termo e considerado "Cliente" o contratante descrito neste documento como cliente, e e considerada "Empresa" a Contratada, e tem como objeto o "Produto" identificado em detalhes.

1 - ORCAMENTO
1.1 O prazo de validade do orcamento e de 10 dias contados da data de elaboracao do mesmo. Apos este periodo o orcamento perde automaticamente a validade.
1.2 O orcamento sera informado ao Cliente atraves do telefone, e-mail, SMS ou outro meio de comunicacao informado por este e que venha a ser utilizado pela Assistencia. O Cliente podera ser informado sobre o orcamento imediatamente quando o servico for prestado via balcao.
1.2.1 O Cliente autoriza o envio do orcamento nos contatos e canais informados pelo mesmo.
1.3 Apos a analise do produto, se for identificada a necessidade de reparo de mais pecas do que as previstas no orcamento inicial, o Cliente sera notificado para que aprove a inclusao do reparo das referidas pecas em novo orcamento. Aprovando esta, o Cliente esta ciente da modificacao no valor do orcamento para casos fora de garantia.
1.4 No caso do orcamento apresentado nao ser aprovado, o Cliente concedera a empresa um prazo de 48 horas uteis, contadas da manifestacao do Cliente sobre a nao aprovacao do orcamento, para retornar o produto as mesmas condicoes em a Assistencia o recebeu.
1.5 No caso da cobranca de um orcamento preliminar para a recuperacao da tela do aparelho do Cliente, ficando ciente que este orcamento e exclusivamente para o reparo da tela. Caso apos a abertura do aparelho for identificado que outros componentes necessitem de reparo, sera apresentado ao Cliente uma cotacao complementar. A nao aprovacao do orcamento complementar, nao da direito ao Cliente ao ressarcimento do valor previamente pago no orcamento preliminar, ja que este servico sera realizado.

2 - GARANTIA
2.1 O Produto conta com a garantia legal de 90 dias do servico de reparo, conforme determinado pelo Codigo de Defesa do Consumidor, contada a partir da data de retirada indicada nesta ordem de servico, sendo obrigatoria a apresentacao deste documento pelo Cliente no caso da peca trocada ou servico realizado apresentar algum outro vicio durante o periodo de garantia legal do servico realizado.
2.2 A garantia perdera sua validade: se houver violacao de pecas colocadas pela Empresa no Produto; se for utilizado em rede eletrica incompativel ou sujeita a flutuacoes; se for instalado ou utilizado de maneira inadequada conforme especificado no seu manual de instrucoes; caso sofra danos causados por acidentes ou agentes da natureza ou se for manuseado por tecnicos ou pessoas nao autorizadas pela Empresa, ou qualquer outro caso em desacordo com o manual de instrucoes e termos de garantia do produto.
2.3 No caso do produto apresentar, durante o periodo coberto pela GARANTIA LEGAL de 90 dias, algum defeito envolvendo componente(s) que nao tenha(m) sido relacionado(s) ao servico de reparo realizado e cobrado(s) acima, o(s) mesmo(s) sera(ao) substituido(s) mediante o pagamento do(s) referido(s) componente(s), incluindo a mao de obra.

3 - DO PRODUTO FORA DE GARANTIA
3.1 O produto que der entrada na autorizada fora do periodo legal e contratual de garantia sera reparado mediante aprovacao de orcamento pelo Cliente.
3.1.1 A aprovacao do orcamento se dara por escrito, pelo Cliente, via balcao; por telefone, mediante gravacao da chamada; por SMS, whatsapp ou e-mail com descricao das pecas que serao utilizadas e servicos que serao realizados.
3.1.2 A aprovacao do orcamento confirma o aceite do Cliente aos termos de servico apresentados neste documento.
3.1.3 O Cliente esta ciente de que havera cobranca de taxa de analise para diagnostico do problema e elaboracao de orcamento para produtos fora de garantia, oportunidade em que o valor sera previamente comunicado.

4 - DA RETIRADA DOS PRODUTOS
4.1 A retirada do produto somente podera ser feita pelo proprio Cliente com a apresentacao da ORDEM DE SERVICO, que e entregue ao mesmo pela Assistencia Tecnica Autorizada Samsung no momento da entrada do produto.
4.1.1 No caso de o Cliente enviar um portador para a retirada, o mesmo devera apresentar, alem da Ordem de Servico, procuracao com firma reconhecida e estar munido de copia do RG ou CNH (foto).
A procuracao devera seguir o modelo abaixo:
Eu, (Nome do Cliente), portador do CPF 000.000.00-00 e ordem de servico N. XXXXXXX, autorizo que (Nome do Portador), portador do CPF 000.000.000-00 efetue a retirada do meu aparelho, passando a exercer o dever de guarda do produto.
4.2 O Cliente sera informado pela Empresa sobre a finalizacao do reparo do produto por meio de telefone, e-mail, SMS ou outro meio de comunicacao que a Assistencia venha a utilizar, cabendo ao Cliente disponibilizar os meios de contato atuais e eventual canal de preferencia.
4.2.1 O cliente autoriza a Empresa a enviar o produto pelos correios, ao endereco informado na abertura da ordem de servico, caso nao haja a retirada no prazo de 5 (cinco) dias, apos comunicacao de finalizacao do reparo (Item 4.2).
4.3 Na hipotese de o envio pelos Correios nao ser viavel, decorrido o prazo de 60 dias da data de comunicacao ao Cliente sobre a finalizacao do reparo ou da recusa do orcamento, nao havendo a retirada do produto, o Cliente, por meio da assinatura do presente documento, fica ciente de que perdera a propriedade do mesmo, autorizando desde ja, nesta hipotese, a destinacao do bem, por parte da Empresa, incluindo a destruicao e descarte do mesmo, de acordo com a legislacao vigente a epoca, nao sendo devido ao Cliente qualquer compensacao ou indenizacao.
4.3.1 O prazo acima pode ser alterado de acordo com Legislacao Local que determine prazo divergente para descarte, cabendo assim, o prazo determinado por esta.

5 - AUTORIZACAO
5.1 O Cliente autoriza a empresa a proceder com a desmontagem do seu Produto para efetuar a devida analise do defeito visando o diagnostico do problema.
5.1.1 Para produtos fora de garantia, havendo a necessidade de substituicao de componentes e/ou ajustes, estes so serao efetuados mediante previa autorizacao do Cliente e aceite do orcamento apresentado.
5.2 O cliente concorda e autoriza a Samsung a empregar no reparo do seu produto pecas ou componentes de reposicao novos ou recondicionados, os quais possuirao as mesmas especificacoes tecnicas e de qualidade de pecas ou componentes novos, nos moldes previstos no artigo 21, do Codigo de Defesa do Consumidor.
5.3 O Cliente autoriza a Empresa a utilizar os dados pessoais presentes nesta Ordem de Servico para entrar em contato, atraves dos meios cabiveis, informando sobre o status do reparo, evidencias do produto analisado, orcamentos e quaisquer informacoes relevantes sobre o produto, inclusive relativas a satisfacao do servico prestado.

6 - DO PRODUTO E ACESSORIOS
6.1 E necessario o envio ou entrega de acessorios originais juntamente com o produto que sera analisado pela Assistencia Tecnica (carregadores, cabos USB, fontes de notebooks, baterias, entre outros).
6.2 Se o produto for protegido com senha ou padroes, sera necessario desabilitar e retirar o bloqueio antes do envio ou entrega no posto autorizado.
6.3 Nao nos responsabilizamos pela pelicula instalada no produto, ficando o Cliente desde logo ciente sobre a possibilidade de danos nao reparaveis na pelicula instalada.
6.4 Cabera ao cliente retirar do seu produto acessorios nao originais antes do envio ou entrega do produto que sera analisado Empresa (Chips de celular, cartoes de memoria, capinhas de celular, entre outros).

7 - DA RESPONSABILIDADE SOBRE DADOS
7.1 Cabera ao Cliente realizar copia de seguranca de todos os dados, informacoes e/ou aplicativos gravados no produto antes do ingresso do produto na Assistencia Tecnica.
7.2 Alem do backup que obrigatoriamente deve ser realizado pelo Cliente, e dever do cliente excluir todos os dados, fotos e demais informacoes pessoais do usuario.
7.3 O Cliente fica ciente que todos os dados do aparelho, serao apagados pela Empresa para a realizacao do reparo, caso o Cliente ainda nao os tenha apagado conforme item 7.2.
7.4 O Cliente esta ciente e concorda que em nenhum procedimento ou reparo efetuado pela Empresa ha acesso a dados pessoais do Cliente ou informacoes confidenciais como senhas bancarias, senhas de e-mails, etc.

Declaro estar ciente e de acordo com as clausulas contratuais e condicoes do aparelho descritas acima.`;

  doc.setFontSize(6);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...COLORS.black);

  const paragraphs = termosCompletos.split('\n\n');

  paragraphs.forEach(paragraph => {
    if (paragraph.trim()) {
      const isBold = paragraph.startsWith('1 -') || paragraph.startsWith('2 -') ||
                     paragraph.startsWith('3 -') || paragraph.startsWith('4 -') ||
                     paragraph.startsWith('5 -') || paragraph.startsWith('6 -') ||
                     paragraph.startsWith('7 -');

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

  return doc.output('blob');
}
