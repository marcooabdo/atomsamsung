import { useState, useEffect } from 'react';
import { Package, AlertCircle, CheckCircle, Clock, XCircle, TrendingUp, Filter, FileText, List } from 'lucide-react';
import { useOtimizador } from '../../contexts/OtimizadorContext';
import { supabase } from '../../lib/supabase';
import RomaneioView from './RomaneioView';

interface Requisicao {
  id: string;
  codigo_peca: string;
  descricao: string;
  quantidade_requisitada: number;
  status: string;
  created_at: string;
  gi_postada_em: string | null;
  os: {
    numero_os: string;
    numero_os_interna: number;
  };
  requisitado_por_usuario: {
    nome: string;
  };
  atendido_por_usuario: {
    nome: string;
  } | null;
}

interface PecaMaisRequisitada {
  codigo_peca: string;
  descricao: string;
  total: number;
}

export default function ControlePecas() {
  const { selectedUnidade, loading } = useOtimizador();
  const [activeTab, setActiveTab] = useState<'requisicoes' | 'romaneio'>('requisicoes');
  const [requisicoes, setRequisicoes] = useState<Requisicao[]>([]);
  const [pecasMaisRequisitadas, setPecasMaisRequisitadas] = useState<PecaMaisRequisitada[]>([]);
  const [loadingRequisicoes, setLoadingRequisicoes] = useState(true);
  const [filtroStatus, setFiltroStatus] = useState<string>('todos');

  useEffect(() => {
    if (selectedUnidade) {
      loadRequisicoes();
      loadPecasMaisRequisitadas();
    }
  }, [selectedUnidade, filtroStatus]);

  const loadRequisicoes = async () => {
    setLoadingRequisicoes(true);
    try {
      let query = supabase
        .from('requisicoes_pecas')
        .select(`
          *,
          os:os!requisicoes_pecas_os_id_fkey(numero_os, numero_os_interna),
          requisitado_por_usuario:usuarios!requisicoes_pecas_requisitado_por_fkey(nome),
          atendido_por_usuario:usuarios!requisicoes_pecas_atendido_por_fkey(nome)
        `)
        .eq('unidade_id', selectedUnidade)
        .order('created_at', { ascending: false })
        .limit(50);

      if (filtroStatus !== 'todos') {
        query = query.eq('status', filtroStatus);
      }

      const { data, error } = await query;

      if (error) throw error;

      setRequisicoes(data || []);
    } catch (error) {
      console.error('Erro ao carregar requisições:', error);
    } finally {
      setLoadingRequisicoes(false);
    }
  };

  const loadPecasMaisRequisitadas = async () => {
    try {
      const { data, error } = await supabase
        .from('requisicoes_pecas')
        .select('codigo_peca, descricao, quantidade_requisitada')
        .eq('unidade_id', selectedUnidade);

      if (error) throw error;

      const pecasMap = new Map<string, { descricao: string; total: number }>();

      data?.forEach((req) => {
        const key = req.codigo_peca;
        const existing = pecasMap.get(key);
        if (existing) {
          existing.total += Number(req.quantidade_requisitada);
        } else {
          pecasMap.set(key, {
            descricao: req.descricao,
            total: Number(req.quantidade_requisitada),
          });
        }
      });

      const topPecas = Array.from(pecasMap.entries())
        .map(([codigo_peca, { descricao, total }]) => ({
          codigo_peca,
          descricao,
          total,
        }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      setPecasMaisRequisitadas(topPecas);
    } catch (error) {
      console.error('Erro ao carregar peças mais requisitadas:', error);
    }
  };

  const countByStatus = (status: string) => {
    return requisicoes.filter((r) => r.status === status).length;
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; border: string; text: string; label: string }> = {
      pendente: {
        bg: 'bg-yellow-500/20',
        border: 'border-yellow-500/30',
        text: 'text-yellow-400',
        label: 'Pendente',
      },
      atendida: {
        bg: 'bg-blue-500/20',
        border: 'border-blue-500/30',
        text: 'text-blue-400',
        label: 'Atendida',
      },
      em_uso: {
        bg: 'bg-purple-500/20',
        border: 'border-purple-500/30',
        text: 'text-purple-400',
        label: 'Em Uso',
      },
      gi_postada: {
        bg: 'bg-green-500/20',
        border: 'border-green-500/30',
        text: 'text-green-400',
        label: 'GI Postada',
      },
      devolvida: {
        bg: 'bg-gray-500/20',
        border: 'border-gray-500/30',
        text: 'text-gray-400',
        label: 'Devolvida',
      },
      reprovada: {
        bg: 'bg-red-500/20',
        border: 'border-red-500/30',
        text: 'text-red-400',
        label: 'Reprovada',
      },
      cancelada: {
        bg: 'bg-red-500/20',
        border: 'border-red-500/30',
        text: 'text-red-400',
        label: 'Cancelada',
      },
    };

    const badge = badges[status] || badges.pendente;

    return (
      <span className={`px-3 py-1 ${badge.bg} border ${badge.border} rounded-full ${badge.text} text-xs`}>
        {badge.label}
      </span>
    );
  };

  const totalRequisicoes = requisicoes.length;
  const requisicoesUrgentes = countByStatus('pendente');
  const giPostadas = countByStatus('gi_postada');

  if (loadingRequisicoes || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="futuristic-loader"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-400 via-amber-500 to-yellow-600">
            Núcleo de Peças
          </h2>
          <p className="text-gray-400 mt-1">Requisições, status, gestão de GI e romaneio</p>
        </div>
      </div>

      <div className="flex gap-2 bg-gray-800/50 border border-gray-700 rounded-xl p-2">
        <button
          onClick={() => setActiveTab('requisicoes')}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
            activeTab === 'requisicoes'
              ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/30'
              : 'bg-gray-700/30 text-gray-400 hover:bg-gray-700/50'
          }`}
        >
          <List className="w-5 h-5" />
          Requisições
        </button>
        <button
          onClick={() => setActiveTab('romaneio')}
          className={`flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all ${
            activeTab === 'romaneio'
              ? 'bg-gradient-to-r from-orange-500 to-amber-600 text-white shadow-lg shadow-orange-500/30'
              : 'bg-gray-700/30 text-gray-400 hover:bg-gray-700/50'
          }`}
        >
          <FileText className="w-5 h-5" />
          Romaneio
        </button>
      </div>

      {activeTab === 'romaneio' ? (
        <RomaneioView />
      ) : (
        <>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border border-orange-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Total Requisições</p>
              <p className="text-3xl font-bold text-orange-400 mt-1">{totalRequisicoes}</p>
            </div>
            <Package className="w-12 h-12 text-orange-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-yellow-500/10 to-yellow-600/5 border border-yellow-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Pendentes</p>
              <p className="text-3xl font-bold text-yellow-400 mt-1">{requisicoesUrgentes}</p>
            </div>
            <AlertCircle className="w-12 h-12 text-yellow-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-green-500/10 to-green-600/5 border border-green-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">GI Postadas</p>
              <p className="text-3xl font-bold text-green-400 mt-1">{giPostadas}</p>
            </div>
            <CheckCircle className="w-12 h-12 text-green-400 opacity-50" />
          </div>
        </div>

        <div className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border border-blue-500/20 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Atendidas</p>
              <p className="text-3xl font-bold text-blue-400 mt-1">{countByStatus('atendida')}</p>
            </div>
            <Clock className="w-12 h-12 text-blue-400 opacity-50" />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-4 mb-6">
            <h3 className="text-xl font-bold text-white">Requisições Recentes</h3>
            <div className="flex items-center gap-2">
              <Filter className="w-5 h-5 text-gray-400" />
              <select
                value={filtroStatus}
                onChange={(e) => setFiltroStatus(e.target.value)}
                className="px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-orange-500 transition-colors"
              >
                <option value="todos">Todos os Status</option>
                <option value="pendente">Pendente</option>
                <option value="atendida">Atendida</option>
                <option value="em_uso">Em Uso</option>
                <option value="gi_postada">GI Postada</option>
                <option value="devolvida">Devolvida</option>
                <option value="reprovada">Reprovada</option>
                <option value="cancelada">Cancelada</option>
              </select>
            </div>
          </div>

          {requisicoes.length === 0 ? (
            <div className="text-center py-12">
              <Package className="w-16 h-16 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 text-lg">Nenhuma requisição encontrada</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {requisicoes.map((req) => (
                <div
                  key={req.id}
                  className="bg-gray-700/30 border border-gray-600 rounded-lg p-4 hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="text-white font-bold">{req.codigo_peca}</h4>
                        {getStatusBadge(req.status)}
                      </div>
                      <p className="text-gray-400 text-sm">{req.descricao}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white font-bold">OS {req.os?.numero_os || req.os?.numero_os_interna}</p>
                      <p className="text-gray-400 text-xs">Qtd: {req.quantidade_requisitada}</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Requisitado por</p>
                      <p className="text-gray-300">{req.requisitado_por_usuario?.nome}</p>
                    </div>
                    {req.atendido_por_usuario && (
                      <div>
                        <p className="text-gray-500 text-xs">Atendido por</p>
                        <p className="text-gray-300">{req.atendido_por_usuario.nome}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-gray-500 text-xs">Data Requisição</p>
                      <p className="text-gray-300">
                        {new Date(req.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </p>
                    </div>
                    {req.gi_postada_em && (
                      <div>
                        <p className="text-gray-500 text-xs">GI Postada em</p>
                        <p className="text-gray-300">
                          {new Date(req.gi_postada_em).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric',
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-6">
            <TrendingUp className="w-6 h-6 text-orange-400" />
            <h3 className="text-xl font-bold text-white">Top 5 Peças</h3>
          </div>

          {pecasMaisRequisitadas.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">Sem dados</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pecasMaisRequisitadas.map((peca, index) => (
                <div
                  key={peca.codigo_peca}
                  className="bg-gray-700/30 border border-gray-600 rounded-lg p-4"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-8 h-8 rounded-full bg-orange-500/20 border border-orange-500/30 flex items-center justify-center">
                      <span className="text-orange-400 font-bold text-sm">{index + 1}</span>
                    </div>
                    <div className="flex-1">
                      <h4 className="text-white font-bold text-sm">{peca.codigo_peca}</h4>
                      <p className="text-gray-400 text-xs truncate">{peca.descricao}</p>
                    </div>
                  </div>
                  <div className="bg-orange-500/10 border border-orange-500/20 rounded-lg p-2 text-center">
                    <p className="text-gray-400 text-xs">Requisitada</p>
                    <p className="text-orange-400 text-xl font-bold">{peca.total}x</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </>
      )}
    </div>
  );
}
