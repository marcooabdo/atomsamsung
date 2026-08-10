import { supabase } from './supabase';
import { normalizarCidade } from './cidadeNormalize';

interface ExportOptions {
  unidadeId?: string;
  allUserUnits?: string[];
  arquivadas?: boolean;
  fileName?: string;
}

export async function exportOSFechadasExcel(options: ExportOptions) {
  const { unidadeId, allUserUnits, arquivadas = false, fileName } = options;

  const XLSX = await import('xlsx');

  let query = supabase
    .from('os')
    .select(`
      *,
      unidade:unidades!os_unidade_id_fkey(nome),
      tecnico_designado:usuarios!os_tecnico_designado_id_fkey(nome),
      tecnico_agendado:usuarios!os_tecnico_agendado_id_fkey(nome)
    `)
    .order('fechada_em', { ascending: false, nullsFirst: false });

  if (arquivadas) {
    query = query.eq('arquivada', true);
  } else {
    query = query.eq('coluna_kanban', 'os_fechada').neq('arquivada', true);
  }

  if (unidadeId) {
    query = query.eq('unidade_id', unidadeId);
  } else if (allUserUnits && allUserUnits.length > 0) {
    query = query.in('unidade_id', allUserUnits);
  }

  const { data: osList, error } = await query.limit(5000);
  if (error) throw error;
  if (!osList || osList.length === 0) return 0;

  const osIds = osList.map(os => os.id);

  const batchSize = 200;
  const batches = [];
  for (let i = 0; i < osIds.length; i += batchSize) {
    batches.push(osIds.slice(i, i + batchSize));
  }

  let allAgendamentos: any[] = [];
  let allPecas: any[] = [];
  let allPagamentos: any[] = [];

  for (const batch of batches) {
    const [agRes, pecRes, pagRes] = await Promise.all([
      supabase
        .from('agendamentos')
        .select('*, tecnico:usuarios!agendamentos_tecnico_id_fkey(nome)')
        .in('os_id', batch),
      supabase
        .from('os_pecas')
        .select('*')
        .in('os_id', batch),
      supabase
        .from('pagamentos')
        .select('*')
        .in('os_id', batch),
    ]);
    if (agRes.data) allAgendamentos = allAgendamentos.concat(agRes.data);
    if (pecRes.data) allPecas = allPecas.concat(pecRes.data);
    if (pagRes.data) allPagamentos = allPagamentos.concat(pagRes.data);
  }

  const agendamentosByOs = new Map<string, any[]>();
  allAgendamentos.forEach(a => {
    const list = agendamentosByOs.get(a.os_id) || [];
    list.push(a);
    agendamentosByOs.set(a.os_id, list);
  });

  const pecasByOs = new Map<string, any[]>();
  allPecas.forEach(p => {
    const list = pecasByOs.get(p.os_id) || [];
    list.push(p);
    pecasByOs.set(p.os_id, list);
  });

  const pagamentosByOs = new Map<string, any[]>();
  allPagamentos.forEach(p => {
    if (!p.os_id) return;
    const list = pagamentosByOs.get(p.os_id) || [];
    list.push(p);
    pagamentosByOs.set(p.os_id, list);
  });

  const rows = osList.map((os: any) => {
    const agendamentos = agendamentosByOs.get(os.id) || [];
    const lastAgendamento = agendamentos.sort((a: any, b: any) =>
      new Date(b.data_agendamento || 0).getTime() - new Date(a.data_agendamento || 0).getTime()
    )[0];

    const pecas = pecasByOs.get(os.id) || [];
    const pagamentos = pagamentosByOs.get(os.id) || [];

    const pecasDescList = pecas.map((p: any) =>
      `${p.pn || p.codigo || 'S/C'} - ${p.descricao || 'S/D'} (x${p.quantidade || 1})`
    ).join(' | ');

    const pecasValorTotal = pecas.reduce((sum: number, p: any) =>
      sum + ((p.valor_unitario || 0) * (p.quantidade || 1)), 0
    );

    const pagamentosTotal = pagamentos.reduce((sum: number, p: any) =>
      sum + (p.valor || 0), 0
    );

    const tat = os.fechada_em && os.created_at
      ? Math.floor((new Date(os.fechada_em).getTime() - new Date(os.created_at).getTime()) / (1000 * 60 * 60 * 24))
      : '';

    return {
      'Nº OS Samsung': os.numero_os_samsung || '',
      'Nº OS Interna': os.numero_os_interna || '',
      'Unidade': os.unidade?.nome || '',
      'Tipo OS': os.tipo_os || '',
      'Tipo Atendimento': os.tipo_atendimento || '',
      'Tipo Orçamento': os.tipo_orcamento || '',
      'Tipo Reparo': os.tipo_reparo || '',
      'Status GSPN': os.status_gspn || '',
      'Cortesia': os.is_cortesia ? 'Sim' : 'Não',
      'Motivo Cortesia': os.motivo_cortesia || '',

      'Cliente': os.cliente_nome || '',
      'CPF/CNPJ': os.cliente_cpf_cnpj || '',
      'Telefone': os.cliente_telefone || '',
      'Telefone 2': os.cliente_telefone_2 || '',
      'Email': os.cliente_email || '',
      'CEP': os.cliente_cep || '',
      'Logradouro': os.cliente_logradouro || '',
      'Número': os.cliente_numero || '',
      'Complemento': os.cliente_complemento || '',
      'Bairro': os.cliente_bairro || '',
      'Cidade': normalizarCidade(os.cliente_cidade),
      'Estado': os.cliente_estado || '',
      'VIP': os.cliente_vip ? 'Sim' : 'Não',

      'Marca': os.aparelho_marca || '',
      'Linha': os.aparelho_linha || '',
      'Modelo': os.aparelho_modelo || '',
      'Nº Série': os.aparelho_numero_serie || '',
      'IMEI': os.aparelho_imei || '',
      'Defeito': os.defeito_relatado || '',
      'Diagnóstico': os.diagnostico_tecnico || '',
      'Reparo Efetuado': os.reparo_efetuado || '',

      'Valor Total': os.valor_total || 0,
      'Valor Peças': os.valor_pecas || pecasValorTotal,
      'Valor Serviços': os.valor_servicos || 0,
      'Valor Pago': os.valor_pago || 0,
      'Saldo Restante': os.saldo_restante || 0,
      'Status Pagamento': os.status_pagamento || '',
      'Total Pagamentos': pagamentosTotal,

      'Peças Utilizadas': pecasDescList,
      'Qtd Peças': pecas.length,

      'Data Agendamento': lastAgendamento?.data_agendamento
        ? new Date(lastAgendamento.data_agendamento + 'T00:00:00').toLocaleDateString('pt-BR')
        : '',
      'Período': lastAgendamento?.periodo_agendamento || os.periodo_agendamento || '',
      'Técnico Agendado': lastAgendamento?.tecnico?.nome || os.tecnico_agendado?.nome || '',
      'Técnico Designado': os.tecnico_designado?.nome || '',
      'Check-in': lastAgendamento?.data_checkin
        ? new Date(lastAgendamento.data_checkin).toLocaleString('pt-BR')
        : '',
      'Check-out': lastAgendamento?.data_checkout
        ? new Date(lastAgendamento.data_checkout).toLocaleString('pt-BR')
        : '',

      'Data Abertura': os.created_at ? new Date(os.created_at).toLocaleString('pt-BR') : '',
      'Data Fechamento': os.fechada_em ? new Date(os.fechada_em).toLocaleString('pt-BR') : '',
      'TAT (dias)': tat,
      'Tem 2ª OS': os.tem_segunda_os ? 'Sim' : 'Não',
      'Nº 2ª OS': os.numero_segunda_os || '',
    };
  });

  const workbook = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);

  const colWidths = Object.keys(rows[0] || {}).map(key => {
    const maxLen = Math.max(
      key.length,
      ...rows.slice(0, 100).map((r: any) => String(r[key] || '').length)
    );
    return { wch: Math.min(maxLen + 2, 50) };
  });
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(workbook, ws, arquivadas ? 'OS Arquivadas' : 'OS Fechadas');

  if (allPecas.length > 0) {
    const pecasRows = allPecas.map((p: any) => {
      const os = osList.find((o: any) => o.id === p.os_id);
      return {
        'Nº OS Samsung': os?.numero_os_samsung || '',
        'Nº OS Interna': os?.numero_os_interna || '',
        'PN': p.pn || '',
        'Código': p.codigo || '',
        'Descrição': p.descricao || '',
        'Quantidade': p.quantidade || 1,
        'Valor Unitário': p.valor_unitario || 0,
        'Valor GSPN': p.valor_gspn || 0,
        'Status GSPN': p.status_gspn || '',
      };
    });
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(pecasRows), 'Peças Detalhadas');
  }

  if (allPagamentos.length > 0) {
    const pagRows = allPagamentos.filter(p => p.os_id).map((p: any) => {
      const os = osList.find((o: any) => o.id === p.os_id);
      return {
        'Nº OS Samsung': os?.numero_os_samsung || '',
        'Nº OS Interna': os?.numero_os_interna || '',
        'Forma Pagamento': p.forma_pagamento || '',
        'Valor': p.valor || 0,
        'Taxa Máquina': p.taxa_valor || 0,
        'PIX ID': p.pix_id_transacao || '',
        'Data': p.created_at ? new Date(p.created_at).toLocaleString('pt-BR') : '',
      };
    });
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(pagRows), 'Pagamentos');
  }

  const defaultName = arquivadas
    ? `OS_Arquivadas_${new Date().toISOString().split('T')[0]}.xlsx`
    : `OS_Fechadas_${new Date().toISOString().split('T')[0]}.xlsx`;

  XLSX.writeFile(workbook, fileName || defaultName);
  return osList.length;
}
