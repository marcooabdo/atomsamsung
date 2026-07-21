import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  DollarSign, TrendingUp, TrendingDown, Package, AlertTriangle,
  Building2, Users, ArrowUpRight, ArrowDownRight, Wallet, CreditCard
} from 'lucide-react';

interface DashboardProps {
  unidadeId: string | null;
  dataInicio: string;
  dataFim: string;
}

interface DashboardData {
  totalRecebido: number;
  totalDinheiro: number;
  totalPix: number;
  totalCartaoCredito: number;
  totalCartaoDebito: number;
  totalTransferencia: number;
  totalBoleto: number;
  qtdPagamentos: number;
  ticketMedio: number;
  totalTaxas: number;
  totalLP: number;
  totalOW: number;
  rankingUnidades: Array<{
    unidade_id: string;
    unidade_nome: string;
    total_recebido: number;
    qtd_pagamentos: number;
  }>;
  rankingFormasPagamento: Array<{
    forma: string;
    total: number;
    qtd: number;
  }>;
}

export default function FinanceDashboard({ unidadeId, dataInicio, dataFim }: DashboardProps) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData>({
    totalRecebido: 0,
    totalDinheiro: 0,
    totalPix: 0,
    totalCartaoCredito: 0,
    totalCartaoDebito: 0,
    totalTransferencia: 0,
    totalBoleto: 0,
    qtdPagamentos: 0,
    ticketMedio: 0,
    totalTaxas: 0,
    totalLP: 0,
    totalOW: 0,
    rankingUnidades: [],
    rankingFormasPagamento: []
  });

  useEffect(() => {
    loadDashboard();
  }, [unidadeId, dataInicio, dataFim]);

  const loadDashboard = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('pagamentos')
        .select(`
          *,
          os:os(tipo_os, tipo_orcamento),
          cotacao:cotacoes(tipo_os),
          unidade:unidades(nome)
        `);

      if (unidadeId) {
        query = query.eq('unidade_id', unidadeId);
      }
      if (dataInicio) {
        query = query.gte('data_lancamento', `${dataInicio}T00:00:00`);
      }
      if (dataFim) {
        query = query.lte('data_lancamento', `${dataFim}T23:59:59`);
      }

      const { data: pagamentos } = await query;
      const pagamentosData = pagamentos || [];

      const totalRecebido = pagamentosData.reduce((sum, p) => sum + p.valor, 0);
      const totalTaxas = pagamentosData.reduce((sum, p) => sum + (p.taxa_valor || 0), 0);

      const totalDinheiro = pagamentosData
        .filter(p => p.forma_pagamento === 'dinheiro')
        .reduce((sum, p) => sum + p.valor, 0);

      const totalPix = pagamentosData
        .filter(p => p.forma_pagamento === 'pix')
        .reduce((sum, p) => sum + p.valor, 0);

      const totalCartaoCredito = pagamentosData
        .filter(p => p.forma_pagamento === 'cartao_credito')
        .reduce((sum, p) => sum + p.valor, 0);

      const totalCartaoDebito = pagamentosData
        .filter(p => p.forma_pagamento === 'cartao_debito')
        .reduce((sum, p) => sum + p.valor, 0);

      const totalTransferencia = pagamentosData
        .filter(p => p.forma_pagamento === 'transferencia')
        .reduce((sum, p) => sum + p.valor, 0);

      const totalBoleto = pagamentosData
        .filter(p => p.forma_pagamento === 'boleto')
        .reduce((sum, p) => sum + p.valor, 0);

      const totalLP = pagamentosData
        .filter(p => {
          const tipoOS = p.os?.tipo_os || p.cotacao?.tipo_os;
          return tipoOS === 'LP';
        })
        .reduce((sum, p) => sum + p.valor, 0);

      const totalOW = pagamentosData
        .filter(p => {
          const tipoOS = p.os?.tipo_os || p.cotacao?.tipo_os;
          return tipoOS === 'OW';
        })
        .reduce((sum, p) => sum + p.valor, 0);

      const unidadeMap = new Map();
      pagamentosData.forEach(p => {
        const id = p.unidade_id;
        if (!unidadeMap.has(id)) {
          unidadeMap.set(id, {
            unidade_id: id,
            unidade_nome: p.unidade?.nome || 'Desconhecida',
            total_recebido: 0,
            qtd_pagamentos: 0
          });
        }
        const u = unidadeMap.get(id);
        u.total_recebido += p.valor;
        u.qtd_pagamentos += 1;
      });

      const formasMap = new Map();
      pagamentosData.forEach(p => {
        const forma = p.forma_pagamento;
        if (!formasMap.has(forma)) {
          formasMap.set(forma, { forma, total: 0, qtd: 0 });
        }
        const f = formasMap.get(forma);
        f.total += p.valor;
        f.qtd += 1;
      });

      setData({
        totalRecebido,
        totalDinheiro,
        totalPix,
        totalCartaoCredito,
        totalCartaoDebito,
        totalTransferencia,
        totalBoleto,
        qtdPagamentos: pagamentosData.length,
        ticketMedio: pagamentosData.length > 0 ? totalRecebido / pagamentosData.length : 0,
        totalTaxas,
        totalLP,
        totalOW,
        rankingUnidades: Array.from(unidadeMap.values())
          .sort((a, b) => b.total_recebido - a.total_recebido),
        rankingFormasPagamento: Array.from(formasMap.values())
          .sort((a, b) => b.total - a.total)
      });
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const getFormaPagamentoLabel = (forma: string) => {
    const labels: Record<string, string> = {
      pix: 'PIX',
      cartao_credito: 'Cartao Credito',
      cartao_debito: 'Cartao Debito',
      dinheiro: 'Dinheiro',
      transferencia: 'Transferencia',
      boleto: 'Boleto',
      outro: 'Outro'
    };
    return labels[forma] || forma;
  };

  const getFormaPagamentoColor = (forma: string) => {
    const colors: Record<string, string> = {
      pix: '#00D4FF',
      cartao_credito: '#9D4EDD',
      cartao_debito: '#3b82f6',
      dinheiro: '#39FF14',
      transferencia: '#10b981',
      boleto: '#FFBF00',
      outro: '#6B7280'
    };
    return colors[forma] || '#6B7280';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="futuristic-loader"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="premium-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-cyan-500/20">
              <DollarSign className="w-5 h-5 text-cyan-400" />
            </div>
            <TrendingUp className="w-4 h-4 text-cyan-400" />
          </div>
          <p className="text-xs text-gray-400 uppercase mb-1">Total Recebido</p>
          <p className="text-2xl font-bold text-cyan-400">
            R$ {data.totalRecebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-500 mt-1">{data.qtdPagamentos} pagamentos</p>
        </div>

        <div className="premium-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-green-500/20">
              <Package className="w-5 h-5 text-green-400" />
            </div>
            <span className="text-xs px-2 py-1 rounded bg-green-500/20 text-green-400">LP</span>
          </div>
          <p className="text-xs text-gray-400 uppercase mb-1">Receita LP</p>
          <p className="text-2xl font-bold text-green-400">
            R$ {data.totalLP.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="premium-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-orange-500/20">
              <Package className="w-5 h-5 text-orange-400" />
            </div>
            <span className="text-xs px-2 py-1 rounded bg-orange-500/20 text-orange-400">OW</span>
          </div>
          <p className="text-xs text-gray-400 uppercase mb-1">Receita OW</p>
          <p className="text-2xl font-bold text-orange-400">
            R$ {data.totalOW.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="premium-card p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="p-2 rounded-lg bg-yellow-500/20">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
            </div>
          </div>
          <p className="text-xs text-gray-400 uppercase mb-1">Taxas Pagas</p>
          <p className="text-2xl font-bold text-yellow-400">
            R$ {data.totalTaxas.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="premium-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(var(--neon-green-rgb),0.1)' }}>
              <DollarSign className="w-5 h-5" style={{ color: 'var(--neon-green)' }} />
            </div>
          </div>
          <p className="text-xs text-gray-400 uppercase mb-1">Dinheiro</p>
          <p className="text-xl font-bold" style={{ color: 'var(--neon-green)' }}>
            R$ {data.totalDinheiro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="premium-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(var(--accent-rgb), 0.125)' }}>
              <DollarSign className="w-5 h-5" style={{ color: 'var(--text-accent)' }} />
            </div>
          </div>
          <p className="text-xs text-gray-400 uppercase mb-1">PIX</p>
          <p className="text-xl font-bold" style={{ color: 'var(--text-accent)' }}>
            R$ {data.totalPix.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="premium-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg" style={{ backgroundColor: '#9D4EDD20' }}>
              <CreditCard className="w-5 h-5" style={{ color: '#9D4EDD' }} />
            </div>
          </div>
          <p className="text-xs text-gray-400 uppercase mb-1">Cartao Credito</p>
          <p className="text-xl font-bold" style={{ color: '#9D4EDD' }}>
            R$ {data.totalCartaoCredito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="premium-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-blue-500/20">
              <CreditCard className="w-5 h-5 text-blue-400" />
            </div>
          </div>
          <p className="text-xs text-gray-400 uppercase mb-1">Cartao Debito</p>
          <p className="text-xl font-bold text-blue-400">
            R$ {data.totalCartaoDebito.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="premium-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <TrendingUp className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <p className="text-xs text-gray-400 uppercase mb-1">Ticket Médio</p>
          <p className="text-2xl font-bold text-emerald-400">
            R$ {data.ticketMedio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="premium-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-emerald-500/20">
              <ArrowUpRight className="w-5 h-5 text-emerald-400" />
            </div>
          </div>
          <p className="text-xs text-gray-400 uppercase mb-1">Transferencia</p>
          <p className="text-2xl font-bold text-emerald-400">
            R$ {data.totalTransferencia.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="premium-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg" style={{ backgroundColor: '#FFBF0020' }}>
              <Wallet className="w-5 h-5" style={{ color: '#FFBF00' }} />
            </div>
          </div>
          <p className="text-xs text-gray-400 uppercase mb-1">Boleto</p>
          <p className="text-2xl font-bold" style={{ color: '#FFBF00' }}>
            R$ {data.totalBoleto.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="premium-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <Building2 className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-bold text-white">Ranking Unidades - Receita</h3>
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {data.rankingUnidades.map((unidade, index) => (
              <div key={unidade.unidade_id} className="flex items-center gap-4 p-3 bg-gray-800/50 rounded-lg">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                  index === 0 ? 'bg-yellow-500 text-black' :
                  index === 1 ? 'bg-gray-300 text-black' :
                  index === 2 ? 'bg-orange-600 text-white' :
                  'bg-gray-700 text-white'
                }`}>
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-white">{unidade.unidade_nome}</p>
                  <p className="text-xs text-gray-400">{unidade.qtd_pagamentos} pagamentos</p>
                </div>
                <p className="font-bold text-cyan-400">
                  R$ {unidade.total_recebido.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            ))}
            {data.rankingUnidades.length === 0 && (
              <p className="text-center text-gray-500 py-8">Nenhum dado disponível</p>
            )}
          </div>
        </div>

        <div className="premium-card p-6">
          <div className="flex items-center gap-3 mb-4">
            <CreditCard className="w-5 h-5 text-cyan-400" />
            <h3 className="text-lg font-bold text-white">Formas de Pagamento</h3>
          </div>
          <div className="space-y-3 max-h-80 overflow-y-auto">
            {data.rankingFormasPagamento.map((forma, index) => (
              <div key={forma.forma} className="flex items-center gap-4 p-3 bg-gray-800/50 rounded-lg">
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm"
                  style={{ backgroundColor: `${getFormaPagamentoColor(forma.forma)}30`, color: getFormaPagamentoColor(forma.forma) }}
                >
                  {index + 1}
                </div>
                <div className="flex-1">
                  <p className="font-semibold text-white">{getFormaPagamentoLabel(forma.forma)}</p>
                  <p className="text-xs text-gray-400">{forma.qtd} pagamentos</p>
                </div>
                <p className="font-bold" style={{ color: getFormaPagamentoColor(forma.forma) }}>
                  R$ {forma.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            ))}
            {data.rankingFormasPagamento.length === 0 && (
              <p className="text-center text-gray-500 py-8">Nenhum dado disponível</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
