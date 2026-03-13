import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from './supabase';

interface RelatorioOSData {
  os: {
    numero_os: string;
    cliente_nome: string;
    cliente_telefone: string;
    endereco_completo: string;
    tipo_servico: string;
    descricao_problema: string;
    status_kanban: string;
    created_at: string;
  };
  agendamento?: {
    data_agendamento: string;
    periodo: string;
    checkin_hora: string;
    checkout_hora: string;
    checkin_latitude: number;
    checkin_longitude: number;
  };
  comentarios: Array<{
    comentario: string;
    created_at: string;
    usuario: { nome: string };
  }>;
  pecas: Array<{
    estoque_pecas: { sku: string; descricao: string };
    quantidade: number;
    status: string;
  }>;
  anexos: Array<{
    tipo: string;
    nome_arquivo: string;
    created_at: string;
  }>;
}

export async function gerarRelatorioOS(osId: string): Promise<void> {
  const { data: osData } = await supabase
    .from('os')
    .select(`
      numero_os,
      cliente_nome,
      cliente_telefone,
      endereco_completo,
      tipo_servico,
      descricao_problema,
      status_kanban,
      created_at
    `)
    .eq('id', osId)
    .single();

  if (!osData) {
    throw new Error('OS não encontrada');
  }

  const { data: agendamentoData } = await supabase
    .from('agendamentos')
    .select(`
      data_agendamento,
      periodo,
      checkin_hora,
      checkout_hora,
      checkin_latitude,
      checkin_longitude
    `)
    .eq('os_id', osId)
    .maybeSingle();

  const { data: comentariosData } = await supabase
    .from('os_comentarios')
    .select(`
      comentario,
      created_at,
      usuario:usuario_id(nome)
    `)
    .eq('os_id', osId)
    .order('created_at', { ascending: false });

  const { data: pecasData } = await supabase
    .from('requisicoes_pecas')
    .select(`
      quantidade,
      status,
      estoque_pecas:peca_id(sku, descricao)
    `)
    .eq('os_id', osId);

  const { data: anexosData } = await supabase
    .from('os_anexos')
    .select('tipo, nome_arquivo, created_at')
    .eq('os_id', osId)
    .order('created_at', { ascending: false });

  const relatorioData: RelatorioOSData = {
    os: osData,
    agendamento: agendamentoData || undefined,
    comentarios: (comentariosData || []) as any,
    pecas: (pecasData || []) as any,
    anexos: anexosData || []
  };

  gerarPDF(relatorioData);
}

function gerarPDF(data: RelatorioOSData) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('RELATÓRIO DE ORDEM DE SERVIÇO', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  doc.setFontSize(14);
  doc.text(`OS #${data.os.numero_os}`, pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('DADOS DO CLIENTE', 14, yPos);
  yPos += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Nome: ${data.os.cliente_nome}`, 14, yPos);
  yPos += 6;
  doc.text(`Telefone: ${data.os.cliente_telefone || 'Não informado'}`, 14, yPos);
  yPos += 6;
  doc.text(`Endereço: ${data.os.endereco_completo || 'Não informado'}`, 14, yPos);
  yPos += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('INFORMAÇÕES DO SERVIÇO', 14, yPos);
  yPos += 7;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`Tipo de Serviço: ${data.os.tipo_servico || 'Não especificado'}`, 14, yPos);
  yPos += 6;
  doc.text(`Status: ${formatStatus(data.os.status_kanban)}`, 14, yPos);
  yPos += 6;
  doc.text(`Data de Abertura: ${new Date(data.os.created_at).toLocaleString('pt-BR')}`, 14, yPos);
  yPos += 6;

  if (data.os.descricao_problema) {
    doc.text('Descrição do Problema:', 14, yPos);
    yPos += 6;
    const splitText = doc.splitTextToSize(data.os.descricao_problema, pageWidth - 28);
    doc.text(splitText, 14, yPos);
    yPos += splitText.length * 5 + 4;
  }

  if (data.agendamento) {
    yPos += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('DADOS DO ATENDIMENTO', 14, yPos);
    yPos += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Data Agendada: ${new Date(data.agendamento.data_agendamento + 'T00:00:00').toLocaleDateString('pt-BR')}`, 14, yPos);
    yPos += 6;
    doc.text(`Período: ${formatPeriodo(data.agendamento.periodo)}`, 14, yPos);
    yPos += 6;

    if (data.agendamento.checkin_hora) {
      doc.text(`Check-in: ${new Date(data.agendamento.checkin_hora).toLocaleString('pt-BR')}`, 14, yPos);
      yPos += 6;
    }

    if (data.agendamento.checkout_hora) {
      doc.text(`Check-out: ${new Date(data.agendamento.checkout_hora).toLocaleString('pt-BR')}`, 14, yPos);
      yPos += 6;

      if (data.agendamento.checkin_hora) {
        const checkin = new Date(data.agendamento.checkin_hora);
        const checkout = new Date(data.agendamento.checkout_hora);
        const duracao = Math.round((checkout.getTime() - checkin.getTime()) / (1000 * 60));
        doc.text(`Duração do Atendimento: ${duracao} minutos`, 14, yPos);
        yPos += 6;
      }
    }

    if (data.agendamento.checkin_latitude && data.agendamento.checkin_longitude) {
      doc.text(
        `Localização Check-in: ${data.agendamento.checkin_latitude.toFixed(6)}, ${data.agendamento.checkin_longitude.toFixed(6)}`,
        14,
        yPos
      );
      yPos += 6;
    }
  }

  if (data.pecas && data.pecas.length > 0) {
    yPos += 5;
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('PEÇAS UTILIZADAS', 14, yPos);
    yPos += 5;

    const pecasTable = data.pecas.map(p => [
      p.estoque_pecas?.sku || '-',
      p.estoque_pecas?.descricao || '-',
      p.quantidade.toString(),
      formatStatusPeca(p.status)
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['SKU', 'Descrição', 'Qtd', 'Status']],
      body: pecasTable,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [6, 182, 212] }
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;
  }

  if (data.comentarios && data.comentarios.length > 0) {
    if (yPos > 230) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('COMENTÁRIOS E OBSERVAÇÕES', 14, yPos);
    yPos += 7;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);

    data.comentarios.forEach(comentario => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFont('helvetica', 'bold');
      doc.text(
        `${comentario.usuario?.nome || 'Sistema'} - ${new Date(comentario.created_at).toLocaleString('pt-BR')}`,
        14,
        yPos
      );
      yPos += 5;

      doc.setFont('helvetica', 'normal');
      const splitComentario = doc.splitTextToSize(comentario.comentario, pageWidth - 28);
      doc.text(splitComentario, 14, yPos);
      yPos += splitComentario.length * 4 + 5;
    });
  }

  if (data.anexos && data.anexos.length > 0) {
    if (yPos > 240) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('ANEXOS', 14, yPos);
    yPos += 5;

    const anexosTable = data.anexos.map(a => [
      formatTipoAnexo(a.tipo),
      a.nome_arquivo,
      new Date(a.created_at).toLocaleDateString('pt-BR')
    ]);

    autoTable(doc, {
      startY: yPos,
      head: [['Tipo', 'Arquivo', 'Data']],
      body: anexosTable,
      theme: 'grid',
      styles: { fontSize: 9 },
      headStyles: { fillColor: [6, 182, 212] }
    });
  }

  const fileName = `OS_${data.os.numero_os}_Relatorio.pdf`;
  doc.save(fileName);
}

function formatStatus(status: string): string {
  const statusMap: Record<string, string> = {
    agendado: 'Agendado',
    em_andamento: 'Em Andamento',
    aguardando_pecas: 'Aguardando Peças',
    finalizado: 'Finalizado',
    cancelado: 'Cancelado'
  };
  return statusMap[status] || status;
}

function formatPeriodo(periodo: string): string {
  const periodoMap: Record<string, string> = {
    manha: 'Manhã (08:00 - 12:00)',
    tarde: 'Tarde (13:00 - 18:00)',
    noite: 'Noite (18:00 - 21:00)'
  };
  return periodoMap[periodo] || periodo;
}

function formatStatusPeca(status: string): string {
  const statusMap: Record<string, string> = {
    atendida: 'Disponibilizada',
    gi_postado: 'GI Postado',
    devolvida: 'Devolvida',
    cancelada: 'Cancelada'
  };
  return statusMap[status] || status;
}

function formatTipoAnexo(tipo: string): string {
  const tipoMap: Record<string, string> = {
    evidencia: 'Evidência',
    assinatura_tecnico: 'Assinatura Técnico',
    assinatura_cliente: 'Assinatura Cliente',
    gspn: 'GSPN',
    nota_fiscal: 'Nota Fiscal'
  };
  return tipoMap[tipo] || tipo;
}
