import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import {
  APPROVED_STAGES, ORCAMENTO_TO_CATEGORY, ClienteCI, VendedorCI, PecaCI, CIKPIs, DadoMensal, OSRecord,
  getValorCliente
} from './types';

interface RawOS {
  id: string;
  numero_os_interna: string;
  cliente_nome: string;
  cliente_cpf_cnpj: string | null;
  cliente_telefone: string | null;
  cliente_email: string | null;
  cliente_logradouro: string | null;
  cliente_numero: string | null;
  cliente_bairro: string | null;
  cliente_cidade: string | null;
  cliente_estado: string | null;
  tipo_os: string;
  tipo_orcamento: string | null;
  valor_total: string;
  valor_pecas: string | null;
  valor_servicos: string | null;
  created_at: string;
  fechada_em: string | null;
  coluna_kanban: string;
  unidade_id: string | null;
  vendedor_responsavel_id: string | null;
  orcamento_aprovado_em: string | null;
  defeito_relatado: string | null;
  aparelho_modelo: string | null;
  numero_os_samsung: string | null;
}

export function useCIData(
  usuarioUnidadeId: string | null,
  isGerente: boolean,
  selectedUnidade: string,
  periodoFiltro: string
) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [allClientes, setAllClientes] = useState<ClienteCI[]>([]);
  const [allVendedores, setAllVendedores] = useState<VendedorCI[]>([]);
  const [allPecas, setAllPecas] = useState<PecaCI[]>([]);
  const [dadosMensais, setDadosMensais] = useState<DadoMensal[]>([]);
  const [kpis, setKpis] = useState<CIKPIs>({
    totalFaturamento: 0, ticketMedio: 0,
    clienteDoMes: 'N/A', clienteDoMesValor: 0,
    vendedorDestaque: 'N/A', vendedorDestaqueValor: 0,
    crescimento: 0, totalClientes: 0
  });
  const usuariosMapRef = useRef<Map<string, { id: string; nome: string; tipo: string }>>(new Map());

  const getDateStart = useCallback(() => {
    const now = new Date();
    switch (periodoFiltro) {
      case 'mes': { const d = new Date(now); d.setMonth(now.getMonth() - 1); return d; }
      case 'trimestre': { const d = new Date(now); d.setMonth(now.getMonth() - 3); return d; }
      case 'semestre': { const d = new Date(now); d.setMonth(now.getMonth() - 6); return d; }
      case 'ano': { const d = new Date(now); d.setFullYear(now.getFullYear() - 1); return d; }
      default: return null;
    }
  }, [periodoFiltro]);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const dateStart = getDateStart();
      const effectiveUnidade = isGerente ? selectedUnidade : (usuarioUnidadeId || '');

      let osQuery = supabase
        .from('os')
        .select(`
          id, numero_os_interna, cliente_nome, cliente_cpf_cnpj, cliente_telefone, cliente_email,
          cliente_logradouro, cliente_numero, cliente_bairro, cliente_cidade, cliente_estado,
          tipo_os, tipo_orcamento, valor_total, valor_pecas, valor_servicos,
          created_at, fechada_em, coluna_kanban, unidade_id,
          vendedor_responsavel_id, orcamento_aprovado_em, defeito_relatado, aparelho_modelo, numero_os_samsung
        `)
        .in('coluna_kanban', APPROVED_STAGES);

      if (dateStart) osQuery = osQuery.gte('created_at', dateStart.toISOString());
      if (effectiveUnidade) osQuery = osQuery.eq('unidade_id', effectiveUnidade);

      const { data: osData, error: osError } = await osQuery;
      if (osError) throw osError;
      const osList = (osData || []) as RawOS[];
      const osIds = osList.map(o => o.id);

      const [pagamentosData, pecasData, usuariosData] = await Promise.all([
        loadBatched('pagamentos', 'os_id', osIds, 'os_id, valor, valor_bruto, valor_liquido, forma_pagamento'),
        loadBatched('os_pecas', 'os_id', osIds, 'os_id, pn, codigo, descricao, quantidade, valor_unitario, valor_total, devolvida_em', { devolvida_em: null }),
        supabase.from('usuarios').select('id, nome, tipo').eq('ativo', true).then(r => r.data || [])
      ]);

      const usuariosMap = new Map(usuariosData.map((u: any) => [u.id, u]));
      usuariosMapRef.current = usuariosMap;

      const pagamentosPorOS = new Map<string, number>();
      pagamentosData.forEach((p: any) => {
        const val = Number(p.valor_liquido) || Number(p.valor) || 0;
        pagamentosPorOS.set(p.os_id, (pagamentosPorOS.get(p.os_id) || 0) + val);
      });

      const pecasPorOS = new Map<string, any[]>();
      pecasData.forEach((p: any) => {
        if (!pecasPorOS.has(p.os_id)) pecasPorOS.set(p.os_id, []);
        pecasPorOS.get(p.os_id)!.push(p);
      });

      const clientesMap = new Map<string, ClienteCI>();
      const vendedoresMap = new Map<string, VendedorCI>();
      const pecasGlobalMap = new Map<string, PecaCI>();
      const vendedorClientesSet = new Map<string, Set<string>>();

      osList.forEach(os => {
        const clienteKey = os.cliente_cpf_cnpj || os.cliente_nome || 'desconhecido';
        const vendedorId = os.vendedor_responsavel_id || null;
        const vendedorUser = vendedorId ? usuariosMap.get(vendedorId) : null;
        const vendedorNome = (vendedorUser as any)?.nome || (vendedorId ? 'Vendedor' : 'Sem vendedor');
        const valorOS = Number(os.valor_total) || 0;
        const valorPago = pagamentosPorOS.get(os.id) || 0;
        const valorFinal = valorPago > 0 ? valorPago : valorOS;

        const osPecas = pecasPorOS.get(os.id) || [];
        const tipoOrc = os.tipo_orcamento || 'normal';
        const categoria = ORCAMENTO_TO_CATEGORY[tipoOrc] || 'OW';
        const osRecord: OSRecord = {
          id: os.id,
          numero_os_interna: os.numero_os_interna,
          tipo_os: os.tipo_os,
          tipo_orcamento: tipoOrc,
          categoria,
          coluna_kanban: os.coluna_kanban,
          valor_total: valorOS,
          valor_pago: valorPago,
          valor_pecas: Number(os.valor_pecas) || 0,
          valor_servicos: Number(os.valor_servicos) || 0,
          created_at: os.created_at,
          fechada_em: os.fechada_em,
          orcamento_aprovado_em: os.orcamento_aprovado_em,
          vendedorNome,
          vendedorId,
          unidade_id: os.unidade_id,
          defeito_relatado: os.defeito_relatado,
          aparelho_modelo: os.aparelho_modelo,
          numero_os_samsung: os.numero_os_samsung,
          pecas: osPecas.map((p: any) => ({
            pn: p.pn || p.codigo || '',
            descricao: p.descricao || p.pn || '',
            quantidade: Number(p.quantidade) || 1,
            valor_unitario: Number(p.valor_unitario) || 0,
            valor_total: Number(p.valor_total) || 0
          }))
        };

        const existing = clientesMap.get(clienteKey);
        if (existing) {
          existing.totalFaturado += valorOS;
          existing.totalPago += valorPago;
          existing.totalOS += 1;
          existing.osRecords.push(osRecord);
          if (!existing.tiposOS.includes(categoria)) existing.tiposOS.push(categoria);
          const dataRef = os.orcamento_aprovado_em || os.fechada_em || os.created_at;
          if (dataRef && dataRef > existing.ultimaOS) existing.ultimaOS = dataRef;
          if (!existing.vendedorId && vendedorId) {
            existing.vendedorId = vendedorId;
            existing.vendedorNome = vendedorNome;
          }
          if (os.coluna_kanban === 'os_fechada') existing.status = 'ativo';
        } else {
          clientesMap.set(clienteKey, {
            id: clienteKey,
            nome: os.cliente_nome || 'Cliente',
            documento: os.cliente_cpf_cnpj || '',
            telefone: os.cliente_telefone || '',
            email: os.cliente_email || '',
            endereco: [os.cliente_logradouro, os.cliente_numero, os.cliente_bairro].filter(Boolean).join(', '),
            cidade: os.cliente_cidade || '',
            estado: os.cliente_estado || '',
            totalFaturado: valorOS,
            totalPago: valorPago,
            totalOS: 1,
            ticketMedio: 0,
            ultimaOS: os.orcamento_aprovado_em || os.fechada_em || os.created_at,
            vendedorId,
            vendedorNome,
            status: os.coluna_kanban === 'os_fechada' ? 'ativo' : 'pendente',
            tiposOS: [categoria],
            osRecords: [osRecord],
            pecas: []
          });
        }

        if (vendedorId) {
          const ev = vendedoresMap.get(vendedorId);
          if (ev) { ev.faturamento += valorFinal; ev.totalOS += 1; }
          else {
            vendedoresMap.set(vendedorId, {
              id: vendedorId, nome: vendedorNome,
              faturamento: valorFinal, totalOS: 1, totalClientes: 0, ticketMedio: 0
            });
          }
          if (!vendedorClientesSet.has(vendedorId)) vendedorClientesSet.set(vendedorId, new Set());
          vendedorClientesSet.get(vendedorId)!.add(clienteKey);
        }

        osPecas.forEach((peca: any) => {
          const pecaKey = peca.pn || peca.descricao || peca.codigo;
          if (!pecaKey) return;
          const qtd = Number(peca.quantidade) || 1;
          const vUnit = Number(peca.valor_unitario) || 0;
          const vTotal = Number(peca.valor_total) || vUnit * qtd;
          const ep = pecasGlobalMap.get(pecaKey);
          if (ep) { ep.quantidade += qtd; ep.valorTotal += vTotal; }
          else {
            pecasGlobalMap.set(pecaKey, {
              pn: peca.pn || peca.codigo || '', descricao: peca.descricao || pecaKey,
              quantidade: qtd, valorTotal: vTotal, valorMedio: vUnit
            });
          }
        });
      });

      vendedorClientesSet.forEach((cs, vid) => {
        const v = vendedoresMap.get(vid);
        if (v) { v.totalClientes = cs.size; v.ticketMedio = v.totalOS > 0 ? v.faturamento / v.totalOS : 0; }
      });

      const clientePecasMap = new Map<string, Map<string, { pn: string; descricao: string; quantidade: number; valorTotal: number }>>();
      osList.forEach(os => {
        const clienteKey = os.cliente_cpf_cnpj || os.cliente_nome || 'desconhecido';
        if (!clientePecasMap.has(clienteKey)) clientePecasMap.set(clienteKey, new Map());
        const cpMap = clientePecasMap.get(clienteKey)!;
        (pecasPorOS.get(os.id) || []).forEach((peca: any) => {
          const pk = peca.pn || peca.descricao || peca.codigo;
          if (!pk) return;
          const qtd = Number(peca.quantidade) || 1;
          const vTotal = Number(peca.valor_total) || (Number(peca.valor_unitario) || 0) * qtd;
          const ep = cpMap.get(pk);
          if (ep) { ep.quantidade += qtd; ep.valorTotal += vTotal; }
          else cpMap.set(pk, { pn: peca.pn || peca.codigo || '', descricao: peca.descricao || pk, quantidade: qtd, valorTotal: vTotal });
        });
      });

      clientePecasMap.forEach((pecas, ck) => {
        const cliente = clientesMap.get(ck);
        if (cliente) {
          cliente.pecas = Array.from(pecas.values())
            .sort((a, b) => b.quantidade - a.quantidade)
            .slice(0, 10)
            .map(p => ({ pn: p.pn, descricao: p.descricao, quantidade: p.quantidade, valorMedio: p.valorTotal / p.quantidade }));
        }
      });

      const clientesArray = Array.from(clientesMap.values())
        .map(c => ({ ...c, ticketMedio: c.totalOS > 0 ? getValorCliente(c) / c.totalOS : 0 }))
        .sort((a, b) => getValorCliente(b) - getValorCliente(a));
      setAllClientes(clientesArray);

      const vendedoresArray = Array.from(vendedoresMap.values()).sort((a, b) => b.faturamento - a.faturamento);
      setAllVendedores(vendedoresArray);

      const pecasArray = Array.from(pecasGlobalMap.values())
        .map(p => ({ ...p, valorMedio: p.quantidade > 0 ? p.valorTotal / p.quantidade : 0 }))
        .sort((a, b) => b.quantidade - a.quantidade);
      setAllPecas(pecasArray);

      const mesesNomes = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
      const mensaisMap = new Map<string, { faturamento: number; qtd: number }>();
      osList.forEach(os => {
        const dataRef = os.orcamento_aprovado_em || os.created_at;
        const dt = new Date(dataRef);
        const mesKey = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
        const valorPago = pagamentosPorOS.get(os.id) || 0;
        const valorFinal = valorPago > 0 ? valorPago : (Number(os.valor_total) || 0);
        const e = mensaisMap.get(mesKey);
        if (e) { e.faturamento += valorFinal; e.qtd += 1; }
        else mensaisMap.set(mesKey, { faturamento: valorFinal, qtd: 1 });
      });

      const dadosMensaisArray = Array.from(mensaisMap.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-6)
        .map(([key, data]) => {
          const [ano, mes] = key.split('-');
          return { mes: `${mesesNomes[parseInt(mes) - 1]}/${ano.slice(2)}`, faturamento: data.faturamento, qtd: data.qtd };
        });
      setDadosMensais(dadosMensaisArray);

      const totalFaturamento = clientesArray.reduce((sum, c) => sum + getValorCliente(c), 0);
      const totalOS = clientesArray.reduce((sum, c) => sum + c.totalOS, 0);
      const topCliente = clientesArray[0];
      const topVendedor = vendedoresArray[0];
      const mesAtualVal = dadosMensaisArray[dadosMensaisArray.length - 1]?.faturamento || 0;
      const mesAnteriorVal = dadosMensaisArray[dadosMensaisArray.length - 2]?.faturamento || 0;

      setKpis({
        totalFaturamento,
        ticketMedio: totalOS > 0 ? totalFaturamento / totalOS : 0,
        clienteDoMes: topCliente?.nome || 'N/A',
        clienteDoMesValor: topCliente ? getValorCliente(topCliente) : 0,
        vendedorDestaque: topVendedor?.nome || 'N/A',
        vendedorDestaqueValor: topVendedor?.faturamento || 0,
        crescimento: mesAnteriorVal > 0 ? ((mesAtualVal - mesAnteriorVal) / mesAnteriorVal) * 100 : 0,
        totalClientes: clientesArray.length
      });
    } catch (error) {
      // ignored
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedUnidade, periodoFiltro, getDateStart, isGerente, usuarioUnidadeId]);

  useEffect(() => { loadData(); }, [loadData]);

  const refresh = useCallback(() => {
    setRefreshing(true);
    loadData();
  }, [loadData]);

  return {
    loading, refreshing, refresh,
    allClientes, allVendedores, allPecas,
    dadosMensais, kpis
  };
}

async function loadBatched(table: string, filterCol: string, ids: string[], select: string, extraFilters?: Record<string, any>) {
  if (ids.length === 0) return [];
  let results: any[] = [];
  const batchSize = 50;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = ids.slice(i, i + batchSize);
    let query = supabase.from(table).select(select).in(filterCol, batch);
    if (extraFilters) {
      Object.entries(extraFilters).forEach(([key, val]) => {
        if (val === null) query = query.is(key, null);
        else query = query.eq(key, val);
      });
    }
    const { data } = await query;
    if (data) results = results.concat(data);
  }
  return results;
}
