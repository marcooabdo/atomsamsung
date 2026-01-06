import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Wallet, DollarSign, Calendar, Clock, CheckCircle, AlertTriangle,
  Plus, Save, ArrowUpRight, ArrowDownRight
} from 'lucide-react';

interface CaixaModuleProps {
  unidadeId: string;
}

interface Abertura {
  id: string;
  data: string;
  valor_inicial: number;
  usuario_id: string;
  observacoes: string | null;
  usuario?: { nome: string };
}

interface Fechamento {
  id: string;
  data: string;
  valor_esperado: number;
  valor_contado: number;
  diferenca: number;
  status: string;
  usuario?: { nome: string };
}

interface Pagamento {
  id: string;
  forma_pagamento: string;
  valor: number;
  data_lancamento: string;
  os?: {
    numero_os_interna: string;
    numero_os_samsung: string | null;
    cliente_nome: string;
  };
  cotacao?: {
    numero_cotacao: number;
  };
}

export default function CaixaModule({ unidadeId }: CaixaModuleProps) {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dataSelecionada, setDataSelecionada] = useState(new Date().toISOString().split('T')[0]);
  const [abertura, setAbertura] = useState<Abertura | null>(null);
  const [fechamento, setFechamento] = useState<Fechamento | null>(null);
  const [pagamentosDia, setPagamentosDia] = useState<Pagamento[]>([]);

  const [showAbrirCaixa, setShowAbrirCaixa] = useState(false);
  const [valorAbertura, setValorAbertura] = useState('');
  const [obsAbertura, setObsAbertura] = useState('');

  const [showFecharCaixa, setShowFecharCaixa] = useState(false);
  const [valorContado, setValorContado] = useState('');
  const [obsFechamento, setObsFechamento] = useState('');

  useEffect(() => {
    if (unidadeId) {
      loadCaixaDia();
    }
  }, [unidadeId, dataSelecionada]);

  const loadCaixaDia = async () => {
    setLoading(true);
    try {
      const { data: aberturaData } = await supabase
        .from('caixa_aberturas')
        .select('*, usuario:usuarios(nome)')
        .eq('unidade_id', unidadeId)
        .eq('data', dataSelecionada)
        .maybeSingle();

      setAbertura(aberturaData);

      const { data: fechamentoData } = await supabase
        .from('caixa_fechamentos')
        .select('*, usuario:usuarios(nome)')
        .eq('unidade_id', unidadeId)
        .eq('data', dataSelecionada)
        .maybeSingle();

      setFechamento(fechamentoData);

      const { data: pagamentos } = await supabase
        .from('pagamentos')
        .select(`
          id, forma_pagamento, valor, data_lancamento,
          os:os(numero_os_interna, numero_os_samsung, cliente_nome),
          cotacao:cotacoes(numero_cotacao)
        `)
        .eq('unidade_id', unidadeId)
        .gte('data_lancamento', `${dataSelecionada}T00:00:00`)
        .lte('data_lancamento', `${dataSelecionada}T23:59:59`)
        .eq('forma_pagamento', 'dinheiro')
        .order('data_lancamento', { ascending: true });

      setPagamentosDia(pagamentos || []);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleAbrirCaixa = async () => {
    if (!valorAbertura) return;

    try {
      const { error } = await supabase
        .from('caixa_aberturas')
        .insert({
          unidade_id: unidadeId,
          data: dataSelecionada,
          valor_inicial: parseFloat(valorAbertura),
          usuario_id: usuario?.id,
          observacoes: obsAbertura || null
        });

      if (error) throw error;

      setShowAbrirCaixa(false);
      setValorAbertura('');
      setObsAbertura('');
      loadCaixaDia();
    } catch (error) {
    }
  };

  const calcularValorEsperado = () => {
    const valorInicial = abertura?.valor_inicial || 0;
    const entradasDinheiro = pagamentosDia.reduce((sum, p) => sum + p.valor, 0);
    return valorInicial + entradasDinheiro;
  };

  const handleFecharCaixa = async () => {
    if (!valorContado) return;

    const valorEsperado = calcularValorEsperado();
    const valorContadoNum = parseFloat(valorContado);
    const diferenca = valorContadoNum - valorEsperado;
    const status = Math.abs(diferenca) < 0.01 ? 'fechado' : 'divergente';

    try {
      const { error } = await supabase
        .from('caixa_fechamentos')
        .insert({
          unidade_id: unidadeId,
          abertura_id: abertura?.id,
          data: dataSelecionada,
          valor_esperado: valorEsperado,
          valor_contado: valorContadoNum,
          usuario_id: usuario?.id,
          observacoes: obsFechamento || null,
          status
        });

      if (error) throw error;

      setShowFecharCaixa(false);
      setValorContado('');
      setObsFechamento('');
      loadCaixaDia();
    } catch (error) {
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="futuristic-loader"></div>
      </div>
    );
  }

  const valorEsperado = calcularValorEsperado();
  const entradasDinheiro = pagamentosDia.reduce((sum, p) => sum + p.valor, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div>
            <label className="block text-xs text-gray-400 uppercase mb-1">Data</label>
            <input
              type="date"
              value={dataSelecionada}
              onChange={(e) => setDataSelecionada(e.target.value)}
              className="neon-input"
            />
          </div>
        </div>

        <div className="flex gap-3">
          {!abertura && (
            <button
              onClick={() => setShowAbrirCaixa(true)}
              className="neon-button flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Abrir Caixa
            </button>
          )}
          {abertura && !fechamento && (
            <button
              onClick={() => setShowFecharCaixa(true)}
              className="px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/30 transition-colors flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Fechar Caixa
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="premium-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-cyan-500/20">
              <Wallet className="w-5 h-5 text-cyan-400" />
            </div>
          </div>
          <p className="text-xs text-gray-400 uppercase mb-1">Saldo Inicial</p>
          <p className="text-2xl font-bold text-cyan-400">
            R$ {(abertura?.valor_inicial || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          {abertura && (
            <p className="text-xs text-gray-500 mt-1">
              Aberto por {abertura.usuario?.nome}
            </p>
          )}
        </div>

        <div className="premium-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-green-500/20">
              <ArrowUpRight className="w-5 h-5 text-green-400" />
            </div>
          </div>
          <p className="text-xs text-gray-400 uppercase mb-1">Entradas (Dinheiro)</p>
          <p className="text-2xl font-bold text-green-400">
            R$ {entradasDinheiro.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          <p className="text-xs text-gray-500 mt-1">{pagamentosDia.length} pagamentos</p>
        </div>

        <div className="premium-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg bg-red-500/20">
              <ArrowDownRight className="w-5 h-5 text-red-400" />
            </div>
          </div>
          <p className="text-xs text-gray-400 uppercase mb-1">Saidas (Dinheiro)</p>
          <p className="text-2xl font-bold text-red-400">
            R$ 0,00
          </p>
          <p className="text-xs text-gray-500 mt-1">Sem saidas registradas</p>
        </div>

        <div className="premium-card p-5">
          <div className="flex items-center gap-3 mb-3">
            <div className={`p-2 rounded-lg ${fechamento ? (fechamento.status === 'fechado' ? 'bg-green-500/20' : 'bg-yellow-500/20') : 'bg-blue-500/20'}`}>
              <DollarSign className={`w-5 h-5 ${fechamento ? (fechamento.status === 'fechado' ? 'text-green-400' : 'text-yellow-400') : 'text-blue-400'}`} />
            </div>
          </div>
          <p className="text-xs text-gray-400 uppercase mb-1">Saldo Esperado</p>
          <p className={`text-2xl font-bold ${fechamento ? (fechamento.status === 'fechado' ? 'text-green-400' : 'text-yellow-400') : 'text-blue-400'}`}>
            R$ {valorEsperado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
          {fechamento && (
            <p className={`text-xs mt-1 ${fechamento.status === 'fechado' ? 'text-green-500' : 'text-yellow-500'}`}>
              {fechamento.status === 'fechado' ? 'Caixa Fechado' : `Diferenca: R$ ${Math.abs(fechamento.diferenca).toFixed(2)}`}
            </p>
          )}
        </div>
      </div>

      {fechamento && fechamento.status === 'divergente' && (
        <div className="premium-card p-4 bg-yellow-500/10 border-yellow-500/30">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-6 h-6 text-yellow-400" />
            <div>
              <h4 className="font-bold text-yellow-400">Divergencia no Fechamento</h4>
              <p className="text-sm text-gray-400">
                Esperado: R$ {fechamento.valor_esperado.toFixed(2)} |
                Contado: R$ {fechamento.valor_contado.toFixed(2)} |
                Diferenca: R$ {fechamento.diferenca.toFixed(2)}
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="premium-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="w-5 h-5 text-cyan-400" />
          <h3 className="text-lg font-bold text-white">Pagamentos em Dinheiro ({pagamentosDia.length})</h3>
        </div>

        <div className="space-y-3">
          {pagamentosDia.length === 0 ? (
            <p className="text-center text-gray-500 py-8">Nenhum pagamento em dinheiro neste dia</p>
          ) : (
            pagamentosDia.map((pagamento) => (
              <div
                key={pagamento.id}
                className="p-4 rounded-lg bg-green-500/10 border border-green-500/30"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-white">
                      {pagamento.os?.numero_os_samsung || pagamento.os?.numero_os_interna || `Cotacao #${pagamento.cotacao?.numero_cotacao}`}
                    </p>
                    <p className="text-xs text-gray-400">
                      {pagamento.os?.cliente_nome || '-'} - {new Date(pagamento.data_lancamento).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-green-400">
                      + R$ {pagamento.valor.toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {showAbrirCaixa && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="premium-card p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">Abrir Caixa</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-1">Valor em Dinheiro Fisico *</label>
                <input
                  type="number"
                  step="0.01"
                  value={valorAbertura}
                  onChange={(e) => setValorAbertura(e.target.value)}
                  className="neon-input w-full"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Observacoes</label>
                <textarea
                  value={obsAbertura}
                  onChange={(e) => setObsAbertura(e.target.value)}
                  className="neon-input w-full"
                  rows={3}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAbrirCaixa(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAbrirCaixa}
                  className="flex-1 neon-button flex items-center justify-center gap-2"
                >
                  <Save className="w-4 h-4" />
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showFecharCaixa && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="premium-card p-6 max-w-md w-full">
            <h3 className="text-xl font-bold text-white mb-4">Fechar Caixa</h3>
            <div className="space-y-4">
              <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                <p className="text-sm text-gray-400">Valor Esperado</p>
                <p className="text-2xl font-bold text-blue-400">
                  R$ {valorEsperado.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Valor Contado *</label>
                <input
                  type="number"
                  step="0.01"
                  value={valorContado}
                  onChange={(e) => setValorContado(e.target.value)}
                  className="neon-input w-full"
                  placeholder="0.00"
                />
              </div>
              {valorContado && Math.abs(parseFloat(valorContado) - valorEsperado) > 0.01 && (
                <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/30">
                  <p className="text-sm text-yellow-400">
                    Diferenca: R$ {(parseFloat(valorContado) - valorEsperado).toFixed(2)}
                  </p>
                </div>
              )}
              <div>
                <label className="block text-sm text-gray-400 mb-1">Observacoes</label>
                <textarea
                  value={obsFechamento}
                  onChange={(e) => setObsFechamento(e.target.value)}
                  className="neon-input w-full"
                  rows={3}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowFecharCaixa(false)}
                  className="flex-1 px-4 py-2 rounded-lg bg-gray-700 text-gray-300 hover:bg-gray-600 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleFecharCaixa}
                  className="flex-1 px-4 py-2 rounded-lg bg-emerald-500/20 border border-emerald-500/50 text-emerald-400 hover:bg-emerald-500/30 transition-colors flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Fechar Caixa
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
