import { useState, useEffect } from 'react';
import { Package, TrendingUp, CheckCircle, AlertCircle, Search, Filter } from 'lucide-react';
import { pipelineEngine } from '../../lib/pipelineEngine';
import { useAuth } from '../../contexts/AuthContext';

interface PecaPendente {
  id: string;
  codigo_peca: string;
  descricao: string;
  quantidade_esperada: number;
  quantidade_recebida: number;
  requisitada_em: string;
  os: {
    id: string;
    numero_os_interna: string;
    numero_os_samsung: string;
    cliente_nome: string;
    coluna_kanban: string;
  };
}

export default function RecebimentoPecas() {
  const { usuario } = useAuth();
  const [pecasPendentes, setPecasPendentes] = useState<PecaPendente[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [pecaSelecionada, setPecaSelecionada] = useState<PecaPendente | null>(null);
  const [quantidadeEntrada, setQuantidadeEntrada] = useState<number>(0);
  const [tipoEntrada, setTipoEntrada] = useState<'parcial' | 'total'>('total');

  useEffect(() => {
    carregarPecasPendentes();
  }, [usuario]);

  const carregarPecasPendentes = async () => {
    try {
      setLoading(true);
      const data = await pipelineEngine.buscarPecasPendentesRecebimento(usuario?.unidade_id);
      setPecasPendentes(data);
    } catch (error) {
      console.error('Erro ao carregar peças pendentes:', error);
    } finally {
      setLoading(false);
    }
  };

  const abrirModalEntrada = (peca: PecaPendente, tipo: 'parcial' | 'total') => {
    setPecaSelecionada(peca);
    setTipoEntrada(tipo);

    if (tipo === 'total') {
      setQuantidadeEntrada(peca.quantidade_esperada - peca.quantidade_recebida);
    } else {
      setQuantidadeEntrada(1);
    }

    setShowModal(true);
  };

  const handleRegistrarEntrada = async () => {
    if (!pecaSelecionada) return;

    try {
      if (tipoEntrada === 'total') {
        await pipelineEngine.registrarEntradaTotal(pecaSelecionada.id);
      } else {
        await pipelineEngine.registrarEntradaParcial(pecaSelecionada.id, quantidadeEntrada);
      }

      await carregarPecasPendentes();
      fecharModal();
    } catch (error) {
      console.error('Erro ao registrar entrada:', error);
      alert('Erro ao registrar entrada de peça. Tente novamente.');
    }
  };

  const fecharModal = () => {
    setShowModal(false);
    setPecaSelecionada(null);
    setQuantidadeEntrada(0);
  };

  const pecasFiltradas = pecasPendentes.filter((peca) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      peca.codigo_peca?.toLowerCase().includes(searchLower) ||
      peca.descricao?.toLowerCase().includes(searchLower) ||
      peca.os.numero_os_interna?.toLowerCase().includes(searchLower) ||
      peca.os.cliente_nome?.toLowerCase().includes(searchLower)
    );
  });

  const calcularPorcentagem = (recebida: number, esperada: number) => {
    return ((recebida / esperada) * 100).toFixed(0);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Recebimento de Peças</h2>
          <p className="text-gray-400 mt-1">Gerencie a entrada de peças requisitadas</p>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-white">{pecasFiltradas.length}</div>
          <div className="text-sm text-gray-400">Peças pendentes</div>
        </div>
      </div>

      <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
        <div className="relative">
          <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar por código, descrição, OS ou cliente..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {pecasFiltradas.map((peca) => {
          const quantidadeRestante = peca.quantidade_esperada - peca.quantidade_recebida;
          const porcentagem = calcularPorcentagem(peca.quantidade_recebida, peca.quantidade_esperada);

          return (
            <div
              key={peca.id}
              className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden hover:border-gray-600 transition-colors"
            >
              <div className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-10 h-10 rounded-lg bg-blue-500/20 flex items-center justify-center">
                        <Package className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-white">{peca.codigo_peca}</h3>
                        <p className="text-sm text-gray-400">{peca.descricao}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div>
                        <div className="text-xs text-gray-500 mb-1">OS Interna</div>
                        <div className="text-sm font-medium text-white">
                          {peca.os.numero_os_interna}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Cliente</div>
                        <div className="text-sm font-medium text-white truncate">
                          {peca.os.cliente_nome}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Status OS</div>
                        <div className="text-sm font-medium text-blue-400">
                          {peca.os.coluna_kanban.replace(/_/g, ' ')}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500 mb-1">Requisitado em</div>
                        <div className="text-sm font-medium text-white">
                          {new Date(peca.requisitada_em).toLocaleDateString('pt-BR')}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Quantidade esperada:</span>
                    <span className="font-medium text-white">{peca.quantidade_esperada}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Quantidade recebida:</span>
                    <span className="font-medium text-green-400">{peca.quantidade_recebida}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-400">Quantidade restante:</span>
                    <span className="font-medium text-yellow-400">{quantidadeRestante}</span>
                  </div>

                  <div className="pt-3 border-t border-gray-700">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm text-gray-400">Progresso:</span>
                      <span className="text-sm font-medium text-white">{porcentagem}%</span>
                    </div>
                    <div className="w-full bg-gray-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          Number(porcentagem) === 100
                            ? 'bg-green-500'
                            : Number(porcentagem) > 50
                            ? 'bg-blue-500'
                            : 'bg-yellow-500'
                        }`}
                        style={{ width: `${porcentagem}%` }}
                      />
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={() => abrirModalEntrada(peca, 'parcial')}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                  >
                    <TrendingUp className="w-4 h-4" />
                    Entrada Parcial
                  </button>
                  <button
                    onClick={() => abrirModalEntrada(peca, 'total')}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Entrada Total
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {pecasFiltradas.length === 0 && (
          <div className="text-center py-12 bg-gray-900 rounded-lg border border-gray-700">
            <AlertCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400">Nenhuma peça pendente de recebimento</p>
          </div>
        )}
      </div>

      {showModal && pecaSelecionada && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-900 rounded-lg border border-gray-700 w-full max-w-md">
            <div className="p-6 border-b border-gray-700">
              <h3 className="text-xl font-semibold text-white">
                {tipoEntrada === 'total' ? 'Entrada Total' : 'Entrada Parcial'}
              </h3>
              <p className="text-gray-400 mt-1">
                {pecaSelecionada.codigo_peca} - {pecaSelecionada.descricao}
              </p>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-gray-800/50 rounded-lg p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Quantidade esperada:</span>
                  <span className="font-medium text-white">
                    {pecaSelecionada.quantidade_esperada}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-400">Já recebido:</span>
                  <span className="font-medium text-green-400">
                    {pecaSelecionada.quantidade_recebida}
                  </span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-gray-700">
                  <span className="text-gray-400">Restante:</span>
                  <span className="font-medium text-yellow-400">
                    {pecaSelecionada.quantidade_esperada - pecaSelecionada.quantidade_recebida}
                  </span>
                </div>
              </div>

              {tipoEntrada === 'parcial' && (
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Quantidade a receber:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={pecaSelecionada.quantidade_esperada - pecaSelecionada.quantidade_recebida}
                    value={quantidadeEntrada}
                    onChange={(e) => setQuantidadeEntrada(parseInt(e.target.value) || 0)}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Máximo: {pecaSelecionada.quantidade_esperada - pecaSelecionada.quantidade_recebida}
                  </p>
                </div>
              )}

              {tipoEntrada === 'total' && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
                  <p className="text-sm text-green-400">
                    Será registrada a entrada de {quantidadeEntrada} unidade(s), completando o
                    recebimento total desta peça.
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-700 flex justify-end gap-3">
              <button
                onClick={fecharModal}
                className="px-4 py-2 text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleRegistrarEntrada}
                disabled={tipoEntrada === 'parcial' && quantidadeEntrada <= 0}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Confirmar Entrada
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
