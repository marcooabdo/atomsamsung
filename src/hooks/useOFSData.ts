import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export interface OFSPecaEstoque {
  pn: string;
  descricao: string;
  qtd_estoque: number;
  qtd_em_transito: number;
  giro_60d: number;
  valor_unitario: number;
}

export interface OFSRow {
  pn: string;
  descricao: string;
  qtd_estoque: number;
  qtd_em_transito: number;
  giro_60d: number;
  qtd_samsung: number;
  qtd_gia: number;
  qtd_final: number;
  valor_unitario: number;
  subtotal: number;
}

export interface OFSFinanceiro {
  credito_limite: number;
  credito_consumido: number;
  credito_livre: number;
}

export interface OFSData {
  rows: OFSRow[];
  financeiro: OFSFinanceiro;
  loading: boolean;
  error: string | null;
}

function calcQtdGIA(giro: number, estoque: number): number {
  const sugestao = Math.ceil((giro / 2) * 1.5) - estoque;
  return Math.max(0, sugestao);
}

export function useOFSData(unidadeId: string) {
  const [estoqueMap, setEstoqueMap] = useState<Map<string, OFSPecaEstoque>>(new Map());
  const [financeiro, setFinanceiro] = useState<OFSFinanceiro>({ credito_limite: 0, credito_consumido: 0, credito_livre: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!unidadeId) {
      setEstoqueMap(new Map());
      setFinanceiro({ credito_limite: 0, credito_consumido: 0, credito_livre: 0 });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [estRes, transitoRes, giroRes, unidadeRes] = await Promise.all([
        supabase
          .from('estoque_pecas')
          .select('pn, descricao, valor_com_impostos, status')
          .eq('unidade_id', unidadeId)
          .eq('status', 'disponivel'),

        supabase
          .from('requisicoes_pecas')
          .select('codigo_peca, descricao, quantidade_requisitada, valor_peca')
          .eq('unidade_id', unidadeId)
          .in('status', ['pendente', 'aprovada', 'pedido_feito']),

        supabase
          .from('estoque_pecas')
          .select('pn, descricao, valor_com_impostos')
          .eq('unidade_id', unidadeId)
          .eq('status', 'usada')
          .gte('data_ultima_movimentacao', new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString()),

        supabase
          .from('unidades')
          .select('limite_credito_gspn')
          .eq('id', unidadeId)
          .maybeSingle(),
      ]);

      if (estRes.error) throw estRes.error;
      if (transitoRes.error) throw transitoRes.error;
      if (giroRes.error) throw giroRes.error;
      if (unidadeRes.error) throw unidadeRes.error;

      const map = new Map<string, OFSPecaEstoque>();

      (estRes.data || []).forEach(p => {
        const existing = map.get(p.pn) || {
          pn: p.pn,
          descricao: p.descricao || p.pn,
          qtd_estoque: 0,
          qtd_em_transito: 0,
          giro_60d: 0,
          valor_unitario: Number(p.valor_com_impostos) || 0,
        };
        existing.qtd_estoque += 1;
        if (!existing.valor_unitario && p.valor_com_impostos) {
          existing.valor_unitario = Number(p.valor_com_impostos);
        }
        map.set(p.pn, existing);
      });

      (transitoRes.data || []).forEach(r => {
        const pn = r.codigo_peca;
        if (!pn) return;
        const existing = map.get(pn) || {
          pn,
          descricao: r.descricao || pn,
          qtd_estoque: 0,
          qtd_em_transito: 0,
          giro_60d: 0,
          valor_unitario: Number(r.valor_peca) || 0,
        };
        existing.qtd_em_transito += Number(r.quantidade_requisitada) || 1;
        map.set(pn, existing);
      });

      (giroRes.data || []).forEach(p => {
        const existing = map.get(p.pn) || {
          pn: p.pn,
          descricao: p.descricao || p.pn,
          qtd_estoque: 0,
          qtd_em_transito: 0,
          giro_60d: 0,
          valor_unitario: Number(p.valor_com_impostos) || 0,
        };
        existing.giro_60d += 1;
        map.set(p.pn, existing);
      });

      setEstoqueMap(map);

      const limite = Number(unidadeRes.data?.limite_credito_gspn) || 0;

      const { data: consumidoData } = await supabase
        .from('requisicoes_pecas')
        .select('valor_peca, quantidade_requisitada')
        .eq('unidade_id', unidadeId)
        .in('status', ['pendente', 'aprovada', 'pedido_feito']);

      const consumido = (consumidoData || []).reduce((acc, r) => {
        return acc + (Number(r.valor_peca) || 0) * (Number(r.quantidade_requisitada) || 1);
      }, 0);

      setFinanceiro({
        credito_limite: limite,
        credito_consumido: consumido,
        credito_livre: Math.max(0, limite - consumido),
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  }, [unidadeId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  return { estoqueMap, financeiro, loading, error, reload: loadData, calcQtdGIA };
}

export interface CSVRow {
  pn: string;
  qtd_samsung: number;
}

export function parseOFSCsv(content: string): CSVRow[] {
  const lines = content.split('\n').map(l => l.trim()).filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0].split(/[;,\t]/).map(h => h.trim().toLowerCase().replace(/"/g, ''));

  const pnIdx = header.findIndex(h =>
    ['pn', 'partnumber', 'part_number', 'part number', 'codigo', 'código', 'codigo_peca', 'codigo peça'].some(k => h.includes(k))
  );
  const qtdIdx = header.findIndex(h =>
    ['qtd', 'quantidade', 'qty', 'qtd_sugerida', 'sugerida', 'qtd sugerida', 'recomendado'].some(k => h.includes(k))
  );

  if (pnIdx === -1) return [];

  const rows: CSVRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(/[;,\t]/).map(c => c.trim().replace(/"/g, ''));
    const pn = cols[pnIdx]?.toUpperCase().trim();
    if (!pn) continue;
    const qtd = qtdIdx >= 0 ? parseInt(cols[qtdIdx] || '1', 10) : 1;
    rows.push({ pn, qtd_samsung: isNaN(qtd) ? 1 : qtd });
  }
  return rows;
}
