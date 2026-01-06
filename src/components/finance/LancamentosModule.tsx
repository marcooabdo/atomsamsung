import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import {
  DollarSign, Search, Download, Eye, Calendar,
  CreditCard, User, FileText, ExternalLink, AlertTriangle, CheckCircle
} from 'lucide-react';
import * as XLSX from 'xlsx';

interface LancamentosModuleProps {
  unidadeId: string;
}

interface Pagamento {
  id: string;
  os_id: string | null;
  cotacao_id: string | null;
  forma_pagamento: string;
  valor: number;
  valor_bruto: number | null;
  valor_liquido: number | null;
  comprovante_url: string | null;
  sku_maquininha: string | null;
  nsu: string | null;
  parcelamento: number | null;
  taxa_percentual: number | null;
  taxa_valor: number | null;
  taxa_paga_por: string | null;
  observacoes: string | null;
  data_lancamento: string;
  os?: {
    numero_os_interna: string;
    numero_os_samsung: string | null;
    cliente_nome: string;
    tipo_os: string;
    tipo_orcamento: string | null;
    valor_total: number | null;
    valor_pago: number | null;
  };
  cotacao?: {
    numero_cotacao: number;
    tipo_os: string | null;
    cliente_nome: string | null;
  };
  lancado_por_usuario?: { nome: string };
  responsavel_usuario?: { nome: string };
  unidade?: { nome: string };
}

export default function LancamentosModule({ unidadeId }: LancamentosModuleProps) {
  const [loading, setLoading] = useState(true);
  const [pagamentos, setPagamentos] = useState<Pagamento[]>([]);
  const [filtroForma, setFiltroForma] = useState('');
  const [dataInicio, setDataInicio] = useState('');
  const [dataFim, setDataFim] = useState('');
  const [busca, setBusca] = useState('');
  const [selectedPagamento, setSelectedPagamento] = useState<Pagamento | null>(null);

  useEffect(() => {
    const today = new Date();
    const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
    setDataInicio(firstDay.toISOString().split('T')[0]);
    setDataFim(today.toISOString().split('T')[0]);
  }, []);

  useEffect(() => {
    if (unidadeId && dataInicio && dataFim) {
      loadPagamentos();
    }
  }, [unidadeId, filtroForma, dataInicio, dataFim]);

  const loadPagamentos = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('pagamentos')
        .select(`
          *,
          os:os(numero_os_interna, numero_os_samsung, cliente_nome, tipo_os, tipo_orcamento, valor_total, valor_pago),
          cotacao:cotacoes(numero_cotacao, tipo_os, cliente_nome),
          lancado_por_usuario:usuarios!pagamentos_lancado_por_fkey(nome),
          responsavel_usuario:usuarios!pagamentos_responsavel_fechamento_fkey(nome),
          unidade:unidades(nome)
        `)
        .eq('unidade_id', unidadeId)
        .order('data_lancamento', { ascending: false });

      if (dataInicio) {
        query = query.gte('data_lancamento', `${dataInicio}T00:00:00`);
      }
      if (dataFim) {
        query = query.lte('data_lancamento', `${dataFim}T23:59:59`);
      }
      if (filtroForma) {
        query = query.eq('forma_pagamento', filtroForma);
      }

      const { data, error } = await query.limit(200);

      if (error) throw error;
      setPagamentos(data || []);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleExportar = () => {
    const dadosExport = pagamentosFiltrados.map(p => ({
      'Data': new Date(p.data_lancamento).toLocaleDateString('pt-BR'),
      'Hora': new Date(p.data_lancamento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      'OS': p.os?.numero_os_samsung || p.os?.numero_os_interna || '',
      'Cliente': p.os?.cliente_nome || '',
      'Tipo OS': p.os?.tipo_os || '',
      'Forma Pagamento': getFormaPagamentoLabel(p.forma_pagamento),
      'Valor': p.valor,
      'Valor Bruto': p.valor_bruto || p.valor,
      'Valor Liquido': p.valor_liquido || p.valor,
      'Parcelamento': p.parcelamento || 1,
      'Taxa %': p.taxa_percentual || 0,
      'Taxa R$': p.taxa_valor || 0,
      'NSU': p.nsu || '',
      'Maquininha': p.sku_maquininha || '',
      'Responsavel': p.responsavel_usuario?.nome || '',
      'Lancado Por': p.lancado_por_usuario?.nome || '',
      'Observacoes': p.observacoes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(dadosExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Pagamentos');
    XLSX.writeFile(wb, `pagamentos_${unidadeId}_${dataInicio}_${dataFim}.xlsx`);
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

  const pagamentosFiltrados = pagamentos.filter(p => {
    if (!busca) return true;
    const termo = busca.toLowerCase();
    return (
      p.os?.numero_os_interna?.toLowerCase().includes(termo) ||
      p.os?.numero_os_samsung?.toLowerCase().includes(termo) ||
      p.os?.cliente_nome?.toLowerCase().includes(termo) ||
      p.cotacao?.cliente_nome?.toLowerCase().includes(termo) ||
      p.nsu?.toLowerCase().includes(termo) ||
      p.responsavel_usuario?.nome?.toLowerCase().includes(termo)
    );
  });

  const getValorPendente = (pagamento: Pagamento) => {
    if (pagamento.os?.valor_total && pagamento.os?.valor_pago !== undefined) {
      return pagamento.os.valor_total - (pagamento.os.valor_pago || 0);
    }
    return null;
  };

  const totalGeral = pagamentosFiltrados.reduce((sum, p) => sum + p.valor, 0);
  const totalDinheiro = pagamentosFiltrados
    .filter(p => p.forma_pagamento === 'dinheiro')
    .reduce((sum, p) => sum + p.valor, 0);
  const totalPix = pagamentosFiltrados
    .filter(p => p.forma_pagamento === 'pix')
    .reduce((sum, p) => sum + p.valor, 0);
  const totalCartao = pagamentosFiltrados
    .filter(p => p.forma_pagamento === 'cartao_credito' || p.forma_pagamento === 'cartao_debito')
    .reduce((sum, p) => sum + p.valor, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="futuristic-loader"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar OS, cliente, NSU..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="neon-input pl-10"
            />
          </div>

          <select
            value={filtroForma}
            onChange={(e) => setFiltroForma(e.target.value)}
            className="neon-input"
          >
            <option value="">Todas Formas</option>
            <option value="pix">PIX</option>
            <option value="cartao_credito">Cartao Credito</option>
            <option value="cartao_debito">Cartao Debito</option>
            <option value="dinheiro">Dinheiro</option>
            <option value="transferencia">Transferencia</option>
            <option value="boleto">Boleto</option>
          </select>

          <input
            type="date"
            value={dataInicio}
            onChange={(e) => setDataInicio(e.target.value)}
            className="neon-input"
          />
          <input
            type="date"
            value={dataFim}
            onChange={(e) => setDataFim(e.target.value)}
            className="neon-input"
          />
        </div>

        <button
          onClick={handleExportar}
          className="neon-button flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Exportar Excel
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="premium-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-cyan-500/20">
              <DollarSign className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <p className="text-xs text-gray-400 uppercase mb-1">Total Recebido</p>
          <p className="text-2xl font-bold text-cyan-400">
            R$ {totalGeral.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-500 mt-1">{pagamentosFiltrados.length} pagamentos</p>
        </div>

        <div className="premium-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg bg-green-500/20">
              <DollarSign className="w-5 h-5 text-green-400" />
            </div>
          </div>
          <p className="text-xs text-gray-400 uppercase mb-1">Dinheiro</p>
          <p className="text-2xl font-bold text-green-400">
            R$ {totalDinheiro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="premium-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg" style={{ backgroundColor: '#00D4FF20' }}>
              <DollarSign className="w-5 h-5" style={{ color: '#00D4FF' }} />
            </div>
          </div>
          <p className="text-xs text-gray-400 uppercase mb-1">PIX</p>
          <p className="text-2xl font-bold" style={{ color: '#00D4FF' }}>
            R$ {totalPix.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <div className="premium-card p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-lg" style={{ backgroundColor: '#9D4EDD20' }}>
              <CreditCard className="w-5 h-5" style={{ color: '#9D4EDD' }} />
            </div>
          </div>
          <p className="text-xs text-gray-400 uppercase mb-1">Cartao</p>
          <p className="text-2xl font-bold" style={{ color: '#9D4EDD' }}>
            R$ {totalCartao.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="premium-card p-6">
        <h3 className="text-lg font-bold text-white mb-4">
          Pagamentos das OS ({pagamentosFiltrados.length})
        </h3>

        <div className="space-y-3">
          {pagamentosFiltrados.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Nenhum pagamento encontrado no periodo</p>
          ) : (
            pagamentosFiltrados.map((pagamento) => (
              <div
                key={pagamento.id}
                className="p-4 rounded-lg bg-gray-800/30 border border-gray-700 hover:border-cyan-500/50 transition-all cursor-pointer"
                style={{ borderLeftWidth: '4px', borderLeftColor: getFormaPagamentoColor(pagamento.forma_pagamento) }}
                onClick={() => setSelectedPagamento(pagamento)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className="font-bold text-cyan-400">
                        {pagamento.os?.numero_os_samsung || pagamento.os?.numero_os_interna || `Cotacao #${pagamento.cotacao?.numero_cotacao}`}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        (pagamento.os?.tipo_os || pagamento.cotacao?.tipo_os) === 'LP'
                          ? 'bg-green-500/20 text-green-400'
                          : 'bg-orange-500/20 text-orange-400'
                      }`}>
                        {pagamento.os?.tipo_os || pagamento.cotacao?.tipo_os || 'N/A'}
                      </span>
                      <span
                        className="px-2 py-0.5 rounded text-xs font-medium"
                        style={{
                          backgroundColor: `${getFormaPagamentoColor(pagamento.forma_pagamento)}20`,
                          color: getFormaPagamentoColor(pagamento.forma_pagamento)
                        }}
                      >
                        {getFormaPagamentoLabel(pagamento.forma_pagamento)}
                      </span>
                      {pagamento.parcelamento && pagamento.parcelamento > 1 && (
                        <span className="text-xs text-gray-400">{pagamento.parcelamento}x</span>
                      )}
                    </div>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span className="text-white">{pagamento.os?.cliente_nome || pagamento.cotacao?.cliente_nome}</span>
                      <span>
                        <Calendar className="w-3 h-3 inline mr-1" />
                        {new Date(pagamento.data_lancamento).toLocaleDateString('pt-BR')}
                      </span>
                      <span>
                        {new Date(pagamento.data_lancamento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      {pagamento.responsavel_usuario && (
                        <span>
                          <User className="w-3 h-3 inline mr-1" />
                          {pagamento.responsavel_usuario.nome}
                        </span>
                      )}
                      {pagamento.nsu && (
                        <span className="font-mono">NSU: {pagamento.nsu}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="text-right">
                      <p className="text-xl font-bold text-white">
                        R$ {pagamento.valor.toFixed(2)}
                      </p>
                      {pagamento.taxa_valor && pagamento.taxa_valor > 0 && (
                        <p className="text-xs text-yellow-400">
                          Taxa: R$ {pagamento.taxa_valor.toFixed(2)}
                        </p>
                      )}
                      {(() => {
                        const pendente = getValorPendente(pagamento);
                        if (pendente !== null) {
                          if (pendente > 0.01) {
                            return (
                              <p className="text-xs text-red-400 flex items-center justify-end gap-1 mt-1">
                                <AlertTriangle className="w-3 h-3" />
                                Falta: R$ {pendente.toFixed(2)}
                              </p>
                            );
                          } else {
                            return (
                              <p className="text-xs text-green-400 flex items-center justify-end gap-1 mt-1">
                                <CheckCircle className="w-3 h-3" />
                                Pago
                              </p>
                            );
                          }
                        }
                        return null;
                      })()}
                    </div>
                    <Eye className="w-4 h-4 text-gray-400" />
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {selectedPagamento && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="premium-card p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white">Detalhes do Pagamento</h3>
              <button onClick={() => setSelectedPagamento(null)} className="text-gray-400 hover:text-white">
                <FileText className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase">OS</p>
                  <p className="text-lg font-bold text-cyan-400">
                    {selectedPagamento.os?.numero_os_samsung || selectedPagamento.os?.numero_os_interna || '-'}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-gray-400 uppercase">Cliente</p>
                  <p className="text-white">{selectedPagamento.os?.cliente_nome || selectedPagamento.cotacao?.cliente_nome || '-'}</p>
                </div>

                <div>
                  <p className="text-xs text-gray-400 uppercase">Tipo OS</p>
                  <span className={`px-2 py-1 rounded text-sm font-medium ${
                    (selectedPagamento.os?.tipo_os || selectedPagamento.cotacao?.tipo_os) === 'LP'
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-orange-500/20 text-orange-400'
                  }`}>
                    {selectedPagamento.os?.tipo_os || selectedPagamento.cotacao?.tipo_os || 'N/A'}
                  </span>
                </div>

                <div>
                  <p className="text-xs text-gray-400 uppercase">Forma de Pagamento</p>
                  <span
                    className="px-3 py-1 rounded text-sm font-medium"
                    style={{
                      backgroundColor: `${getFormaPagamentoColor(selectedPagamento.forma_pagamento)}20`,
                      color: getFormaPagamentoColor(selectedPagamento.forma_pagamento)
                    }}
                  >
                    {getFormaPagamentoLabel(selectedPagamento.forma_pagamento)}
                  </span>
                </div>

                <div>
                  <p className="text-xs text-gray-400 uppercase">Data/Hora</p>
                  <p className="text-white">
                    {new Date(selectedPagamento.data_lancamento).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="premium-card p-4 bg-cyan-500/10 border-cyan-500/30">
                  <p className="text-xs text-gray-400 uppercase">Valor Recebido</p>
                  <p className="text-3xl font-bold text-cyan-400">
                    R$ {selectedPagamento.valor.toFixed(2)}
                  </p>
                </div>

                {selectedPagamento.os?.valor_total && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Valor Total OS:</span>
                      <span className="text-white">R$ {selectedPagamento.os.valor_total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Total Pago:</span>
                      <span className="text-white">R$ {(selectedPagamento.os.valor_pago || 0).toFixed(2)}</span>
                    </div>
                    {(() => {
                      const pendente = getValorPendente(selectedPagamento);
                      if (pendente !== null && pendente > 0.01) {
                        return (
                          <div className="premium-card p-3 bg-red-500/10 border-red-500/30">
                            <div className="flex items-center justify-between">
                              <span className="text-red-400 flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4" />
                                Valor Pendente:
                              </span>
                              <span className="text-red-400 font-bold text-lg">
                                R$ {pendente.toFixed(2)}
                              </span>
                            </div>
                          </div>
                        );
                      } else if (pendente !== null) {
                        return (
                          <div className="premium-card p-3 bg-green-500/10 border-green-500/30">
                            <div className="flex items-center gap-2 text-green-400">
                              <CheckCircle className="w-4 h-4" />
                              <span className="font-medium">OS Totalmente Paga</span>
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>
                )}

                {selectedPagamento.parcelamento && selectedPagamento.parcelamento > 1 && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase">Parcelamento</p>
                    <p className="text-white">{selectedPagamento.parcelamento}x</p>
                  </div>
                )}

                {selectedPagamento.taxa_valor && selectedPagamento.taxa_valor > 0 && (
                  <div className="premium-card p-3 bg-yellow-500/10 border-yellow-500/30">
                    <p className="text-xs text-gray-400 uppercase">Taxa</p>
                    <p className="text-yellow-400">
                      {selectedPagamento.taxa_percentual}% = R$ {selectedPagamento.taxa_valor.toFixed(2)}
                    </p>
                    <p className="text-xs text-gray-500">
                      Paga por: {selectedPagamento.taxa_paga_por === 'cliente' ? 'Cliente' : 'Loja'}
                    </p>
                  </div>
                )}

                {selectedPagamento.nsu && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase">NSU</p>
                    <p className="text-white font-mono">{selectedPagamento.nsu}</p>
                  </div>
                )}

                {selectedPagamento.sku_maquininha && (
                  <div>
                    <p className="text-xs text-gray-400 uppercase">Maquininha</p>
                    <p className="text-white">{selectedPagamento.sku_maquininha}</p>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-gray-700">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-gray-400 uppercase">Responsavel Fechamento</p>
                  <p className="text-white">{selectedPagamento.responsavel_usuario?.nome || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase">Lancado Por</p>
                  <p className="text-white">{selectedPagamento.lancado_por_usuario?.nome || '-'}</p>
                </div>
              </div>

              {selectedPagamento.observacoes && (
                <div className="mt-4">
                  <p className="text-xs text-gray-400 uppercase">Observacoes</p>
                  <p className="text-white">{selectedPagamento.observacoes}</p>
                </div>
              )}

              {selectedPagamento.comprovante_url && (
                <div className="mt-4">
                  <a
                    href={selectedPagamento.comprovante_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="neon-button inline-flex items-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Ver Comprovante
                  </a>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedPagamento(null)}
                className="px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
