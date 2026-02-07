import { useState, useEffect, useRef } from 'react';
import { Plus, Trash2, Edit, Power, PowerOff, AlertCircle, TrendingUp, Search, Calendar, Move } from 'lucide-react';
import { pipelineEngine, PipelineRegra, TipoRegraEnum } from '../lib/pipelineEngine';
import { useAuth } from '../contexts/AuthContext';

const COLUNAS_KANBAN = [
  { value: 'entrada', label: 'Entrada' },
  { value: 'triagem', label: 'Triagem' },
  { value: 'orcamento', label: 'Orçamento' },
  { value: 'orcamento_aprovado', label: 'Orçamento Aprovado' },
  { value: 'aguardando_peca', label: 'Aguardando Peça' },
  { value: 'peca_em_transito', label: 'Peça em Trânsito' },
  { value: 'peca_disponivel', label: 'Peça Disponível' },
  { value: 'disponivel_ih', label: 'Disponível IH' },
  { value: 'em_reparo_ci', label: 'Em Reparo CI' },
  { value: 'rota_preta', label: 'Rota Preta' },
  { value: 'rota_vermelha', label: 'Rota Vermelha' },
  { value: 'rota_azul', label: 'Rota Azul' },
  { value: 'rota_verde', label: 'Rota Verde' },
  { value: 'rota_amarela', label: 'Rota Amarela' },
  { value: 'rota_laranja', label: 'Rota Laranja' },
  { value: 'aguardando_fechamento', label: 'Aguardando Fechamento' },
  { value: 'finalizada', label: 'Finalizada' },
];

const TIPOS_REGRA: { value: TipoRegraEnum; label: string; color: string }[] = [
  { value: 'orcamento_aprovado', label: 'Orçamento Aprovado', color: 'bg-blue-500' },
  { value: 'pecas_recebidas', label: 'Peças Recebidas', color: 'bg-green-500' },
  { value: 'escolha_rota', label: 'Escolha de Rota', color: 'bg-purple-500' },
  { value: 'peca_disponivel', label: 'Peça Disponível', color: 'bg-yellow-500' },
  { value: 'custom', label: 'Personalizada', color: 'bg-gray-500' },
];

export default function ConfiguracoesPipelineRegras() {
  const { usuario } = useAuth();
  const [regras, setRegras] = useState<PipelineRegra[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [regraEditando, setRegraEditando] = useState<PipelineRegra | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterTipo, setFilterTipo] = useState<TipoRegraEnum | ''>('');
  const [filterAtivo, setFilterAtivo] = useState<boolean | ''>('');

  const [modalPosition, setModalPosition] = useState({ x: 100, y: 50 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const modalRef = useRef<HTMLDivElement>(null);

  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    tipo_regra: 'custom' as TipoRegraEnum,
    coluna_origem: '',
    coluna_destino: '',
    ativo: true,
    condicoes: {
      tipo_os: [] as string[],
      tipo_atendimento: '',
      tipo_orcamento: '',
      todas_pecas_recebidas: undefined as boolean | undefined,
      cidade_cadastrada_em_rota: undefined as boolean | undefined,
      requer_peca: undefined as boolean | undefined,
    },
  });

  const isAdmin = usuario?.tipo && ['master', 'diretoria', 'gerente'].includes(usuario.tipo);

  useEffect(() => {
    carregarRegras();
  }, [usuario]);

  const carregarRegras = async () => {
    try {
      setLoading(true);
      const data = await pipelineEngine.buscarRegras(usuario?.unidade_id);
      setRegras(data);
    } catch (error) {
      console.error('Erro ao carregar regras:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSalvar = async () => {
    try {
      const dadosRegra = {
        ...formData,
        unidade_id: usuario?.unidade_id,
        condicoes: Object.fromEntries(
          Object.entries(formData.condicoes).filter(([_, v]) => v !== undefined && v !== '' && (Array.isArray(v) ? v.length > 0 : true))
        ),
      };

      if (regraEditando) {
        await pipelineEngine.atualizarRegra(regraEditando.id, dadosRegra);
      } else {
        await pipelineEngine.criarRegra(dadosRegra);
      }

      await carregarRegras();
      fecharModal();
    } catch (error) {
      console.error('Erro ao salvar regra:', error);
      alert('Erro ao salvar regra. Verifique os dados e tente novamente.');
    }
  };

  const handleDeletar = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar esta regra?')) return;

    try {
      await pipelineEngine.deletarRegra(id);
      await carregarRegras();
    } catch (error) {
      console.error('Erro ao deletar regra:', error);
      alert('Erro ao deletar regra.');
    }
  };

  const handleToggleStatus = async (id: string, ativo: boolean) => {
    try {
      await pipelineEngine.alternarStatusRegra(id, !ativo);
      await carregarRegras();
    } catch (error) {
      console.error('Erro ao alterar status da regra:', error);
    }
  };

  const abrirModalEdicao = (regra: PipelineRegra) => {
    setRegraEditando(regra);
    setFormData({
      nome: regra.nome,
      descricao: regra.descricao || '',
      tipo_regra: regra.tipo_regra,
      coluna_origem: regra.coluna_origem,
      coluna_destino: regra.coluna_destino,
      ativo: regra.ativo,
      condicoes: {
        tipo_os: regra.condicoes?.tipo_os || [],
        tipo_atendimento: regra.condicoes?.tipo_atendimento || '',
        tipo_orcamento: regra.condicoes?.tipo_orcamento || '',
        todas_pecas_recebidas: regra.condicoes?.todas_pecas_recebidas,
        cidade_cadastrada_em_rota: regra.condicoes?.cidade_cadastrada_em_rota,
        requer_peca: regra.condicoes?.requer_peca,
      },
    });
    setShowModal(true);
  };

  const fecharModal = () => {
    setShowModal(false);
    setRegraEditando(null);
    setModalPosition({ x: 100, y: 50 });
    setFormData({
      nome: '',
      descricao: '',
      tipo_regra: 'custom',
      coluna_origem: '',
      coluna_destino: '',
      ativo: true,
      condicoes: {
        tipo_os: [],
        tipo_atendimento: '',
        tipo_orcamento: '',
        todas_pecas_recebidas: undefined,
        cidade_cadastrada_em_rota: undefined,
        requer_peca: undefined,
      },
    });
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (modalRef.current) {
      const rect = modalRef.current.getBoundingClientRect();
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
      setIsDragging(true);
    }
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setModalPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  const regrasFiltradas = regras.filter((regra) => {
    const matchSearch = regra.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                       regra.descricao?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchTipo = filterTipo === '' || regra.tipo_regra === filterTipo;
    const matchAtivo = filterAtivo === '' || regra.ativo === filterAtivo;

    return matchSearch && matchTipo && matchAtivo;
  });

  const getTipoRegraInfo = (tipo: TipoRegraEnum) => {
    return TIPOS_REGRA.find(t => t.value === tipo);
  };

  if (loading) {
    return <div className="text-white">Carregando regras...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
        <p className="text-red-400">Você não tem permissão para gerenciar regras de pipeline.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Regras de Pipeline Automático</h2>
          <p className="text-gray-400 mt-1">Configure regras de movimentação automática de OS no Kanban</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Nova Regra
        </button>
      </div>

      <div className="bg-gray-800/50 rounded-lg border border-gray-700 p-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-2">
            <div className="relative">
              <Search className="w-5 h-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Buscar regras..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <select
              value={filterTipo}
              onChange={(e) => setFilterTipo(e.target.value as TipoRegraEnum | '')}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Todos os tipos</option>
              {TIPOS_REGRA.map(tipo => (
                <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={filterAtivo === '' ? '' : filterAtivo ? 'true' : 'false'}
              onChange={(e) => setFilterAtivo(e.target.value === '' ? '' : e.target.value === 'true')}
              className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
            >
              <option value="">Todos os status</option>
              <option value="true">Ativas</option>
              <option value="false">Inativas</option>
            </select>
          </div>
        </div>
      </div>

      <div className="bg-gray-900 rounded-lg border border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-800 border-b border-gray-700">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Nome</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Tipo</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Origem → Destino</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Execuções</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-400 uppercase tracking-wider">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {regrasFiltradas.map((regra) => {
              const tipoInfo = getTipoRegraInfo(regra.tipo_regra);
              return (
                <tr key={regra.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <div>
                      <div className="text-white font-medium">{regra.nome}</div>
                      {regra.descricao && (
                        <div className="text-gray-400 text-sm mt-1">{regra.descricao}</div>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${tipoInfo?.color} bg-opacity-20 text-white`}>
                      {tipoInfo?.label}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-gray-300">
                        {COLUNAS_KANBAN.find(c => c.value === regra.coluna_origem)?.label}
                      </span>
                      <span className="text-gray-500">→</span>
                      <span className="text-blue-400">
                        {COLUNAS_KANBAN.find(c => c.value === regra.coluna_destino)?.label}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-1 text-gray-400">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-sm">{regra.execucoes_total}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <button
                      onClick={() => handleToggleStatus(regra.id, regra.ativo)}
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                        regra.ativo
                          ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                          : 'bg-gray-500/20 text-gray-400 hover:bg-gray-500/30'
                      }`}
                    >
                      {regra.ativo ? (
                        <>
                          <Power className="w-3 h-3" />
                          Ativa
                        </>
                      ) : (
                        <>
                          <PowerOff className="w-3 h-3" />
                          Inativa
                        </>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => abrirModalEdicao(regra)}
                        className="p-2 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                        title="Editar"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeletar(regra.id)}
                        className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
                        title="Deletar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {regrasFiltradas.length === 0 && (
          <div className="text-center py-12">
            <AlertCircle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
            <p className="text-gray-400">Nenhuma regra encontrada</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50">
          <div
            ref={modalRef}
            className={`absolute bg-gray-900 rounded-lg border shadow-2xl w-full max-w-3xl transition-shadow ${
              isDragging ? 'border-blue-500 shadow-blue-500/50' : 'border-gray-700'
            }`}
            style={{
              left: `${modalPosition.x}px`,
              top: `${modalPosition.y}px`,
              maxHeight: 'calc(100vh - 100px)',
              display: 'flex',
              flexDirection: 'column',
              userSelect: isDragging ? 'none' : 'auto',
            }}
          >
            <div
              className={`p-6 border-b border-gray-700 cursor-move flex items-center justify-between transition-colors ${
                isDragging ? 'bg-blue-900/30' : 'bg-gray-800/50 hover:bg-gray-800/70'
              }`}
              onMouseDown={handleMouseDown}
            >
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg transition-colors ${
                  isDragging ? 'bg-blue-500/20' : 'bg-gray-700/50'
                }`}>
                  <Move className={`w-4 h-4 transition-colors ${
                    isDragging ? 'text-blue-400' : 'text-gray-400'
                  }`} />
                </div>
                <h3 className="text-xl font-semibold text-white">
                  {regraEditando ? 'Editar Regra' : 'Nova Regra'}
                </h3>
              </div>
              <button
                onClick={fecharModal}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <Plus className="w-5 h-5 text-gray-400 rotate-45" />
              </button>
            </div>

            <div className="p-6 space-y-6 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Nome da Regra *</label>
                <input
                  type="text"
                  value={formData.nome}
                  onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  placeholder="Ex: IH - Orçamento Aprovado para Aguardando Peça"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Descrição</label>
                <textarea
                  value={formData.descricao}
                  onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                  rows={3}
                  className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500 resize-none"
                  placeholder="Descreva quando e como esta regra deve ser aplicada..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Tipo de Regra *</label>
                  <select
                    value={formData.tipo_regra}
                    onChange={(e) => setFormData({ ...formData, tipo_regra: e.target.value as TipoRegraEnum })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    {TIPOS_REGRA.map(tipo => (
                      <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Coluna Origem *</label>
                  <select
                    value={formData.coluna_origem}
                    onChange={(e) => setFormData({ ...formData, coluna_origem: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Selecione...</option>
                    {COLUNAS_KANBAN.map(coluna => (
                      <option key={coluna.value} value={coluna.value}>{coluna.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Coluna Destino *</label>
                  <select
                    value={formData.coluna_destino}
                    onChange={(e) => setFormData({ ...formData, coluna_destino: e.target.value })}
                    className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="">Selecione...</option>
                    {COLUNAS_KANBAN.map(coluna => (
                      <option key={coluna.value} value={coluna.value}>{coluna.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="border-t border-gray-700 pt-6">
                <h4 className="text-lg font-medium text-white mb-4">Condições da Regra</h4>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Tipos de OS</label>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {['LP', 'OW', 'SC', 'ACC'].map(tipo => (
                        <label key={tipo} className="flex items-center gap-2 text-white cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formData.condicoes.tipo_os.includes(tipo)}
                            onChange={(e) => {
                              const novos = e.target.checked
                                ? [...formData.condicoes.tipo_os, tipo]
                                : formData.condicoes.tipo_os.filter(t => t !== tipo);
                              setFormData({
                                ...formData,
                                condicoes: { ...formData.condicoes, tipo_os: novos }
                              });
                            }}
                            className="rounded border-gray-600"
                          />
                          {tipo}
                        </label>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Tipo de Atendimento</label>
                      <select
                        value={formData.condicoes.tipo_atendimento}
                        onChange={(e) => setFormData({
                          ...formData,
                          condicoes: { ...formData.condicoes, tipo_atendimento: e.target.value }
                        })}
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="">Qualquer</option>
                        <option value="IH">IH</option>
                        <option value="CI">CI</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Tipo de Orçamento</label>
                      <select
                        value={formData.condicoes.tipo_orcamento}
                        onChange={(e) => setFormData({
                          ...formData,
                          condicoes: { ...formData.condicoes, tipo_orcamento: e.target.value }
                        })}
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="">Qualquer</option>
                        <option value="normal">Normal</option>
                        <option value="acessorios">Acessórios</option>
                        <option value="samsung_contigo">Samsung Contigo</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Todas peças recebidas?</label>
                      <select
                        value={formData.condicoes.todas_pecas_recebidas === undefined ? '' : String(formData.condicoes.todas_pecas_recebidas)}
                        onChange={(e) => setFormData({
                          ...formData,
                          condicoes: {
                            ...formData.condicoes,
                            todas_pecas_recebidas: e.target.value === '' ? undefined : e.target.value === 'true'
                          }
                        })}
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="">Não verificar</option>
                        <option value="true">Sim</option>
                        <option value="false">Não</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Cidade em rota?</label>
                      <select
                        value={formData.condicoes.cidade_cadastrada_em_rota === undefined ? '' : String(formData.condicoes.cidade_cadastrada_em_rota)}
                        onChange={(e) => setFormData({
                          ...formData,
                          condicoes: {
                            ...formData.condicoes,
                            cidade_cadastrada_em_rota: e.target.value === '' ? undefined : e.target.value === 'true'
                          }
                        })}
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="">Não verificar</option>
                        <option value="true">Sim</option>
                        <option value="false">Não</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Requer peça?</label>
                      <select
                        value={formData.condicoes.requer_peca === undefined ? '' : String(formData.condicoes.requer_peca)}
                        onChange={(e) => setFormData({
                          ...formData,
                          condicoes: {
                            ...formData.condicoes,
                            requer_peca: e.target.value === '' ? undefined : e.target.value === 'true'
                          }
                        })}
                        className="w-full px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      >
                        <option value="">Não verificar</option>
                        <option value="true">Sim</option>
                        <option value="false">Não</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="ativo"
                  checked={formData.ativo}
                  onChange={(e) => setFormData({ ...formData, ativo: e.target.checked })}
                  className="rounded border-gray-600"
                />
                <label htmlFor="ativo" className="text-sm text-gray-300 cursor-pointer">
                  Regra ativa (será aplicada automaticamente)
                </label>
              </div>
            </div>

            <div className="p-6 border-t border-gray-700 flex justify-end gap-3 bg-gray-900">
              <button
                onClick={fecharModal}
                className="px-4 py-2 text-gray-300 hover:bg-gray-800 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={handleSalvar}
                disabled={!formData.nome || !formData.coluna_origem || !formData.coluna_destino}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {regraEditando ? 'Salvar Alterações' : 'Criar Regra'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
