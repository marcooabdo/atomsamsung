import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';

export interface PecaCredito {
  id: string;
  id_numerico: number;
  pn: string;
  descricao: string | null;
  valor_com_impostos: number;
  status: string;
  unidade_id: string | null;
  os_id: string | null;
  os_numero?: string | null;
  os_coluna?: string | null;
  tecnico_id: string | null;
  data_coleta_transportadora?: string | null;
  data_retorno_credito?: string | null;
}

export interface PedidoCredito {
  id: string;
  pn: string;
  descricao: string | null;
  valor_peca: number;
  status: string;
  unidade_id: string | null;
  os_id: string | null;
  os_numero?: string | null;
  numero_pedido_samsung?: string | null;
}

export interface CategoriaCredito {
  id: string;
  label: string;
  pecas: (PecaCredito | PedidoCredito)[];
  total: number;
}

export interface CreditoGSPNData {
  limitTotal: number;
  consumido: number;
  livre: number;
  percentual: number;
  categorias: {
    disponivel: CategoriaCredito;
    comTecnico: CategoriaCredito;
    comDefeito: CategoriaCredito;
    devolvidaSamsung: CategoriaCredito;
    usadaOsAberta: CategoriaCredito;
    pedidosAtivos: CategoriaCredito;
  };
  loading: boolean;
  error: string | null;
}

const sumValor = (items: PecaCredito[]) =>
  items.reduce((acc, p) => acc + (Number(p.valor_com_impostos) || 0), 0);

const sumPedidos = (items: PedidoCredito[]) =>
  items.reduce((acc, p) => acc + (Number(p.valor_peca) || 0), 0);

export function useCreditoGSPN(selectedUnidade: string): CreditoGSPNData {
  const [data, setData] = useState<CreditoGSPNData>({
    limitTotal: 0,
    consumido: 0,
    livre: 0,
    percentual: 0,
    categorias: {
      disponivel:        { id: 'disponivel',        label: 'Disponível na Loja',             pecas: [], total: 0 },
      comTecnico:        { id: 'comTecnico',         label: 'Com Técnico',                    pecas: [], total: 0 },
      comDefeito:        { id: 'comDefeito',         label: 'Com Defeito (Nova)',              pecas: [], total: 0 },
      devolvidaSamsung:  { id: 'devolvidaSamsung',   label: 'Devolvida Samsung (Aguardando)',  pecas: [], total: 0 },
      usadaOsAberta:     { id: 'usadaOsAberta',      label: 'Usada em OS Aberta',              pecas: [], total: 0 },
      pedidosAtivos:     { id: 'pedidosAtivos',      label: 'Pedidos Ativos (Em Trânsito)',    pecas: [], total: 0 },
    },
    loading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setData(prev => ({ ...prev, loading: true, error: null }));

      try {
        // 1. Load unit credit limit
        let limiteQuery = supabase
          .from('unidades')
          .select('id, nome, limite_credito_gspn');
        if (selectedUnidade) limiteQuery = limiteQuery.eq('id', selectedUnidade);
        const { data: unidades } = await limiteQuery;
        const limitTotal = selectedUnidade
          ? Number((unidades || [])[0]?.limite_credito_gspn || 0)
          : (unidades || []).reduce((a, u) => a + Number(u.limite_credito_gspn || 0), 0);

        // Use a helper to avoid repeating the conditional eq
        const fetchByStatus = async (status: string) => {
          let q = supabase
            .from('estoque_pecas')
            .select(`id, id_numerico, pn, descricao, valor_com_impostos, status, unidade_id, os_id, tecnico_id,
              data_coleta_transportadora, data_retorno_credito,
              os:os_id (numero_os_interna, numero_os_samsung, coluna_kanban)`)
            .eq('status', status);
          if (selectedUnidade) q = q.eq('unidade_id', selectedUnidade);
          const { data: rows } = await q;
          return (rows || []).map((p: any) => ({
            ...p,
            os_numero: p.os?.numero_os_samsung || p.os?.numero_os_interna || null,
            os_coluna: p.os?.coluna_kanban || null,
          })) as PecaCredito[];
        };

        const [disponivel, comTecnico, comDefeito] = await Promise.all([
          fetchByStatus('disponivel'),
          fetchByStatus('vinculada_tecnico'),
          fetchByStatus('devolvida_defeito'),
        ]);
        // devolvida_samsung aguardando crédito (data_retorno_credito IS NULL)
        let devolvidaQ = supabase
          .from('estoque_pecas')
          .select(`id, id_numerico, pn, descricao, valor_com_impostos, status, unidade_id, os_id, tecnico_id,
            data_coleta_transportadora, data_retorno_credito,
            os:os_id (numero_os_interna, numero_os_samsung, coluna_kanban)`)
          .eq('status', 'devolvida_samsung')
          .is('data_retorno_credito', null);
        if (selectedUnidade) devolvidaQ = devolvidaQ.eq('unidade_id', selectedUnidade);
        const { data: devolvidaRaw } = await devolvidaQ;
        const devolvidaSamsung: PecaCredito[] = (devolvidaRaw || []).map((p: any) => ({
          ...p,
          os_numero: p.os?.numero_os_samsung || p.os?.numero_os_interna || null,
          os_coluna: p.os?.coluna_kanban || null,
        }));

        // usada em OS aberta (coluna_kanban != 'os_fechada')
        let usadaQ = supabase
          .from('estoque_pecas')
          .select(`id, id_numerico, pn, descricao, valor_com_impostos, status, unidade_id, os_id, tecnico_id,
            os:os_id (numero_os_interna, numero_os_samsung, coluna_kanban)`)
          .eq('status', 'usada');
        if (selectedUnidade) usadaQ = usadaQ.eq('unidade_id', selectedUnidade);
        const { data: usadaRaw } = await usadaQ;
        const usadaOsAberta: PecaCredito[] = (usadaRaw || [])
          .filter((p: any) => p.os?.coluna_kanban && p.os.coluna_kanban !== 'os_fechada')
          .map((p: any) => ({
            ...p,
            os_numero: p.os?.numero_os_samsung || p.os?.numero_os_interna || null,
            os_coluna: p.os?.coluna_kanban || null,
          }));

        // Pedidos ativos = requisicoes_pecas com status pendente ou pedido_feito
        const ACTIVE_PEDIDO_STATUSES = ['pedido_feito', 'pendente'];
        let pedidosQ = supabase
          .from('requisicoes_pecas')
          .select(`id, codigo_peca, descricao, valor_peca, status, unidade_id, os_id, numero_pedido_samsung,
            os:os_id (numero_os_interna, numero_os_samsung)`)
          .in('status', ACTIVE_PEDIDO_STATUSES);
        if (selectedUnidade) pedidosQ = pedidosQ.eq('unidade_id', selectedUnidade);
        const { data: pedidosRaw } = await pedidosQ;
        const pedidosAtivos: PedidoCredito[] = (pedidosRaw || []).map((p: any) => ({
          id: p.id,
          pn: p.codigo_peca,
          descricao: p.descricao,
          valor_peca: Number(p.valor_peca) || 0,
          status: p.status,
          unidade_id: p.unidade_id,
          os_id: p.os_id,
          numero_pedido_samsung: p.numero_pedido_samsung,
          os_numero: p.os?.numero_os_samsung || p.os?.numero_os_interna || null,
        }));

        if (cancelled) return;

        const totalDisponivel = sumValor(disponivel);
        const totalComTecnico = sumValor(comTecnico);
        const totalComDefeito = sumValor(comDefeito);
        const totalDevolvida = sumValor(devolvidaSamsung);
        const totalUsada = sumValor(usadaOsAberta);
        const totalPedidos = sumPedidos(pedidosAtivos);

        const consumido = totalDisponivel + totalComTecnico + totalComDefeito + totalDevolvida + totalUsada + totalPedidos;
        const livre = Math.max(0, limitTotal - consumido);
        const percentual = limitTotal > 0 ? Math.min(100, (consumido / limitTotal) * 100) : 0;

        setData({
          limitTotal,
          consumido,
          livre,
          percentual,
          categorias: {
            disponivel:       { id: 'disponivel',       label: 'Disponível na Loja',            pecas: disponivel,       total: totalDisponivel },
            comTecnico:       { id: 'comTecnico',        label: 'Com Técnico',                   pecas: comTecnico,       total: totalComTecnico },
            comDefeito:       { id: 'comDefeito',        label: 'Com Defeito (Nova)',             pecas: comDefeito,       total: totalComDefeito },
            devolvidaSamsung: { id: 'devolvidaSamsung',  label: 'Devolvida Samsung (Aguardando)', pecas: devolvidaSamsung, total: totalDevolvida },
            usadaOsAberta:    { id: 'usadaOsAberta',     label: 'Usada em OS Aberta',             pecas: usadaOsAberta,    total: totalUsada },
            pedidosAtivos:    { id: 'pedidosAtivos',     label: 'Pedidos Ativos (Em Trânsito)',   pecas: pedidosAtivos,    total: totalPedidos },
          },
          loading: false,
          error: null,
        });
      } catch (err: any) {
        if (!cancelled) setData(prev => ({ ...prev, loading: false, error: err?.message || 'Erro ao carregar dados' }));
      }
    }

    load();
    return () => { cancelled = true; };
  }, [selectedUnidade]);

  return data;
}
