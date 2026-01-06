import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { RotateCcw, AlertTriangle, CheckCircle, Clock, XCircle, ChevronDown, ChevronRight, DollarSign, Eye } from 'lucide-react';
import { BadgeTipoOS } from './BadgeTipoOS';

type SubTab = 'nova' | 'defeito' | 'usada';

interface EstoqueDevolucoesProps {
  selectedUnidade: string;
  user: any;
}

interface RequisicaoAgrupada {
  os_id: string;
  numero_os_samsung: string | null;
  numero_os_interna: string | null;
  tipo_os: 'LP' | 'OW';
  requisicoes: any[];
  totalPecas: number;
  numero_cotacao: string | null;
  cliente_nome: string | null;
}

export function EstoqueDevolucoes({ selectedUnidade, user }: EstoqueDevolucoesProps) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('usada');
  const [devolucoesPendentes, setDevolucoesPendentes] = useState<RequisicaoAgrupada[]>([]);
  const [devolucoesAprovadas, setDevolucoesAprovadas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [osExpandida, setOsExpandida] = useState<string | null>(null);
  const [showAprovadas, setShowAprovadas] = useState(false);

  useEffect(() => {
    loadDevolucoes();
  }, [activeSubTab, selectedUnidade]);

  const loadDevolucoes = async () => {
    setLoading(true);
    try {
      const tipoMap: Record<SubTab, string> = {
        nova: 'nova',
        defeito: 'nova_com_defeito',
        usada: 'usada'
      };

      // Carregar devoluções pendentes (status = gi_postada OU devolucao_pendente)
      // IMPORTANTE: Buscar TODAS as requisições com GI postada OU devolução pendente, independente de terem OS ou não
      let queryPendentes = supabase
        .from('requisicoes_pecas')
        .select(`
          *,
          os:os_id(numero_os_samsung, numero_os_interna, tipo_os, coluna_kanban, cotacao_id),
          cotacao:cotacao_id(numero_cotacao, cliente_nome),
          requisitado_usuario:requisitado_por(nome),
          peca_estoque:peca_estoque_id(id_numerico, pn, descricao, status)
        `)
        .in('status', ['gi_postada', 'devolucao_pendente'])
        .eq('tipo_devolucao', tipoMap[activeSubTab])
        .order('created_at', { ascending: false });

      if (selectedUnidade && selectedUnidade !== 'todas') {
        queryPendentes = queryPendentes.eq('unidade_id', selectedUnidade);
      }

      const { data: dataPendentes, error: errorPendentes } = await queryPendentes;
      if (errorPendentes) throw errorPendentes;

      // Agrupar por OS (ou por requisição se não tiver OS)
      const agrupado: Record<string, RequisicaoAgrupada> = {};

      (dataPendentes || []).forEach((req: any) => {
        // Usar os_id se existir, caso contrário usar o próprio ID da requisição como chave
        const chave = req.os_id || req.id;

        if (!agrupado[chave]) {
          agrupado[chave] = {
            os_id: req.os_id || req.id,
            numero_os_samsung: req.numero_os_samsung || req.os?.numero_os_samsung || null,
            numero_os_interna: req.os?.numero_os_interna || null,
            tipo_os: req.os?.tipo_os || 'OW',
            requisicoes: [],
            totalPecas: 0,
            // Pegar dados da cotação diretamente da requisição
            numero_cotacao: req.cotacao?.numero_cotacao?.toString() || null,
            cliente_nome: req.cotacao?.cliente_nome || null
          };
        }
        agrupado[chave].requisicoes.push(req);
        agrupado[chave].totalPecas += 1;
      });

      setDevolucoesPendentes(Object.values(agrupado));

      // Carregar devoluções aprovadas com TODAS as informações necessárias
      let queryAprovadas = supabase
        .from('estoque_devolucoes')
        .select(`
          *,
          peca_id(id_numerico, pn, descricao, status, os_id),
          solicitada_usuario:solicitada_por(nome),
          aprovada_usuario:aprovada_por(nome)
        `)
        .eq('tipo_devolucao', tipoMap[activeSubTab])
        .order('created_at', { ascending: false });

      const { data: dataAprovadas, error: errorAprovadas } = await queryAprovadas;
      if (errorAprovadas) throw errorAprovadas;

      // Buscar informações de OS e Cotação para cada devolução aprovada
      const devolucoesEnriquecidas = await Promise.all(
        (dataAprovadas || []).map(async (dev: any) => {
          let numero_os_samsung = null;
          let numero_cotacao = null;

          // Buscar requisição original para pegar numero_os_samsung e cotacao_id
          const { data: requisicao } = await supabase
            .from('requisicoes_pecas')
            .select('numero_os_samsung, cotacao_id, cotacao:cotacao_id(numero_cotacao)')
            .eq('peca_estoque_id', dev.peca_id.id)
            .eq('status', 'devolvida')
            .maybeSingle();

          if (requisicao) {
            numero_os_samsung = requisicao.numero_os_samsung;
            numero_cotacao = requisicao.cotacao?.numero_cotacao;
          }

          return {
            ...dev,
            numero_os_samsung,
            numero_cotacao
          };
        })
      );

      setDevolucoesAprovadas(devolucoesEnriquecidas);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleAprovarDevolucao = async (requisicao: any) => {
    const confirmacao = confirm(
      `Confirma a APROVAÇÃO desta devolução?\n\n` +
      `Peça: ${requisicao.descricao}\n` +
      `Código: ${requisicao.codigo_peca}\n` +
      `Tipo: ${requisicao.tipo_devolucao === 'nova' ? 'Nova' : requisicao.tipo_devolucao === 'nova_com_defeito' ? 'Nova com Defeito' : 'Usada'}\n` +
      `Motivo: ${requisicao.motivo_devolucao}`
    );

    if (!confirmacao) return;

    try {
      await supabase
        .from('requisicoes_pecas')
        .update({ status: 'devolvida' })
        .eq('id', requisicao.id);

      if (requisicao.peca_estoque_id) {
        const novoStatus =
          requisicao.tipo_devolucao === 'nova' ? 'devolvida_nova' :
          requisicao.tipo_devolucao === 'nova_com_defeito' ? 'devolvida_defeito' :
          'usada';

        await supabase
          .from('estoque_pecas')
          .update({
            status: novoStatus,
            os_id: null,
            tecnico_id: null
          })
          .eq('id', requisicao.peca_estoque_id);

        await supabase
          .from('estoque_devolucoes')
          .insert({
            peca_id: requisicao.peca_estoque_id,
            tipo_devolucao: requisicao.tipo_devolucao,
            solicitada_por: requisicao.requisitado_por,
            aprovada_por: user.id,
            observacao: requisicao.motivo_devolucao
          });

        const { data: userData } = await supabase
          .from('usuarios')
          .select('nome')
          .eq('id', user.id)
          .single();

        await supabase.from('estoque_historico').insert({
          peca_id: requisicao.peca_estoque_id,
          usuario_id: user.id,
          acao: 'devolucao',
          status_anterior: 'vinculada_tecnico',
          status_novo: novoStatus,
          observacao: `Devolução APROVADA por ${userData?.nome || 'Estoque'} - Tipo: ${requisicao.tipo_devolucao === 'nova' ? 'Nova' : requisicao.tipo_devolucao === 'nova_com_defeito' ? 'Nova com Defeito' : 'Usada'}${requisicao.tipo_devolucao === 'nova_com_defeito' ? ` - ⚠️ DEFEITO: ${requisicao.motivo_devolucao}` : ''}`
        });
      }

      const { data: userData } = await supabase
        .from('usuarios')
        .select('nome')
        .eq('id', user.id)
        .maybeSingle();

      await supabase.from('os_comentarios').insert({
        os_id: requisicao.os_id,
        usuario_id: user.id,
        comentario: `Devolução APROVADA por ${userData?.nome || 'Estoque'}\nPeça: ${requisicao.descricao} (${requisicao.codigo_peca})\nTipo: ${requisicao.tipo_devolucao === 'nova' ? 'Nova' : requisicao.tipo_devolucao === 'nova_com_defeito' ? 'Nova com Defeito' : 'Usada'}${requisicao.tipo_devolucao === 'nova_com_defeito' ? `\n⚠️ DEFEITO: ${requisicao.motivo_devolucao}` : ''}\nRequisição ID: ${requisicao.id.slice(0, 8)}`,
        is_system: true
      });

      alert('Devolução aprovada com sucesso!');
      loadDevolucoes();
    } catch (error) {
      alert('Erro ao aprovar devolução');
    }
  };

  const handleReprovarDevolucao = async (requisicao: any) => {
    const motivo = prompt('Digite o motivo da REPROVAÇÃO da devolução:');
    if (!motivo || !motivo.trim()) {
      alert('É necessário informar o motivo da reprovação');
      return;
    }

    const confirmacao = confirm(
      `Confirma a REPROVAÇÃO desta devolução?\n\n` +
      `Peça: ${requisicao.descricao}\n` +
      `Código: ${requisicao.codigo_peca}\n` +
      `Motivo da Reprovação: ${motivo}\n\n` +
      `A peça continuará com o técnico.`
    );

    if (!confirmacao) return;

    try {
      await supabase
        .from('requisicoes_pecas')
        .update({
          status: 'em_uso',
          motivo_reprovacao: motivo,
          reprovado_por: user.id,
          reprovado_em: new Date().toISOString()
        })
        .eq('id', requisicao.id);

      if (requisicao.peca_estoque_id) {
        const { data: userData } = await supabase
          .from('usuarios')
          .select('nome')
          .eq('id', user.id)
          .single();

        await supabase.from('estoque_historico').insert({
          peca_id: requisicao.peca_estoque_id,
          usuario_id: user.id,
          acao: 'devolucao_reprovada',
          status_anterior: 'vinculada_tecnico',
          status_novo: 'vinculada_tecnico',
          observacao: `Devolução REPROVADA por ${userData?.nome || 'Estoque'} - Motivo: ${motivo} - Peça permanece com o técnico`
        });
      }

      const { data: userData } = await supabase
        .from('usuarios')
        .select('nome')
        .eq('id', user.id)
        .maybeSingle();

      await supabase.from('os_comentarios').insert({
        os_id: requisicao.os_id,
        usuario_id: user.id,
        comentario: `Devolução REPROVADA por ${userData?.nome || 'Estoque'}\nPeça: ${requisicao.descricao} (${requisicao.codigo_peca})\nRequisição ID: ${requisicao.id.slice(0, 8)}\nMotivo: ${motivo}\n\nA peça permanece com o técnico.`,
        is_system: true
      });

      alert('Devolução reprovada. Técnico foi notificado.');
      loadDevolucoes();
    } catch (error) {
      alert('Erro ao reprovar devolução');
    }
  };

  const subTabs = [
    { id: 'nova' as SubTab, label: 'Peça Nova', icon: CheckCircle },
    { id: 'defeito' as SubTab, label: 'Nova c/ Defeito', icon: AlertTriangle },
    { id: 'usada' as SubTab, label: 'Peça Usada', icon: RotateCcw }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FF0064]"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-[#FF0064]/10 border border-[#FF0064]/30 rounded-lg p-6">
        <h4 className="font-semibold text-[#FF0064] mb-2">Controle de Devoluções</h4>
        <p className="text-sm text-gray-300">
          Aprove ou reprove devoluções pendentes de peças com GI postada.
          Peças aprovadas são devolvidas ao estoque.
        </p>
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="border-b border-gray-700 flex-1">
          <nav className="flex gap-4 -mb-px">
            {subTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeSubTab === tab.id;
              const totalPendentes = devolucoesPendentes.reduce((sum, g) => sum + g.totalPecas, 0);

            return (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 border-b-2 font-medium text-sm transition relative ${
                  isActive
                    ? 'border-[#FF0064] text-[#FF0064]'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {isActive && totalPendentes > 0 && (
                  <span className="ml-2 px-2 py-0.5 bg-[#FF6B00] text-white text-xs font-bold rounded-full">
                    {totalPendentes}
                  </span>
                )}
              </button>
            );
          })}
          </nav>
        </div>

        {devolucoesAprovadas.length > 0 && (
          <button
            onClick={() => setShowAprovadas(!showAprovadas)}
            className="neon-button flex items-center gap-2 text-xs px-4 py-2 ml-4"
            style={{
              backgroundColor: showAprovadas ? '#39FF1420' : '#39FF1410',
              borderColor: '#39FF14',
              color: '#39FF14'
            }}
          >
            <Eye className="w-4 h-4" />
            {showAprovadas ? 'OCULTAR' : 'VER'} APROVADAS ({devolucoesAprovadas.length})
          </button>
        )}
      </div>

      <div className="space-y-6">
        {devolucoesPendentes.length > 0 && (
          <div>
            <h3 className="text-lg font-bold text-[#FF6B00] mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5" />
              DEVOLUÇÕES PENDENTES DE APROVAÇÃO ({devolucoesPendentes.length} OSs - {devolucoesPendentes.reduce((sum, g) => sum + g.totalPecas, 0)} peças)
            </h3>
            <div className="space-y-3">
              {devolucoesPendentes.map((grupo) => (
                <div key={grupo.os_id} className="premium-card border-[#FF6B00]/30">
                  <div
                    className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => setOsExpandida(osExpandida === grupo.os_id ? null : grupo.os_id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {osExpandida === grupo.os_id ? (
                          <ChevronDown className="w-5 h-5 text-[#FF6B00]" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-500" />
                        )}
                        <Clock className="w-5 h-5 text-[#FF6B00]" />
                        <div>
                          <p className="font-bold text-white">
                            OS {grupo.numero_os_samsung || grupo.numero_cotacao ? `#${grupo.numero_cotacao}` : grupo.cliente_nome || grupo.numero_os_interna || 'N/A'}
                          </p>
                          <p className="text-xs text-gray-400">
                            {grupo.totalPecas} peça(s) aguardando aprovação
                          </p>
                        </div>
                      </div>
                      <BadgeTipoOS tipo={grupo.tipo_os} />
                    </div>
                  </div>

                  {osExpandida === grupo.os_id && (
                    <div className="border-t border-gray-800 p-4 space-y-3">
                      {grupo.requisicoes.map((req: any) => {
                        const tipoLabel = req.tipo_devolucao === 'nova' ? 'Peça Nova' :
                                          req.tipo_devolucao === 'nova_com_defeito' ? 'Nova com Defeito' :
                                          'Peça Usada';
                        const tipoColor = req.tipo_devolucao === 'nova' ? '#39FF14' :
                                          req.tipo_devolucao === 'nova_com_defeito' ? '#FF0064' :
                                          '#6B7280';

                        return (
                          <div key={req.id} className="bg-[#FF6B00]/5 border border-[#FF6B00]/20 rounded-lg p-4">
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <p className="font-bold text-white">{req.descricao}</p>
                                  <span
                                    className="px-2 py-1 rounded text-xs font-bold uppercase"
                                    style={{
                                      backgroundColor: `${tipoColor}20`,
                                      borderColor: tipoColor,
                                      color: tipoColor,
                                      border: '1px solid'
                                    }}
                                  >
                                    {tipoLabel}
                                  </span>
                                  <span
                                    className="px-2 py-1 rounded text-xs font-bold uppercase"
                                    style={{
                                      backgroundColor: req.status === 'gi_postada' ? '#FF6B0020' : '#FFBF0020',
                                      borderColor: req.status === 'gi_postada' ? '#FF6B00' : '#FFBF00',
                                      color: req.status === 'gi_postada' ? '#FF6B00' : '#FFBF00',
                                      border: '1px solid'
                                    }}
                                  >
                                    {req.status === 'gi_postada' ? 'GI POSTADA' : 'DEVOLUÇÃO PENDENTE'}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-400 mb-2">
                                  ID: <span className="font-mono font-bold text-[#00D4FF]">#{req.peca_estoque?.id_numerico || 'N/A'}</span> • PN: <span className="font-mono font-bold">{req.codigo_peca}</span>
                                </p>
                                {req.valor_peca && (
                                  <p className="text-xs text-gray-400 mb-2 flex items-center gap-1">
                                    <DollarSign className="w-3 h-3 text-[#39FF14]" />
                                    <span className="text-[#39FF14] font-bold">Valor GSPN: R$ {Number(req.valor_peca).toFixed(2)}</span>
                                  </p>
                                )}
                                <div className="bg-gray-900/50 rounded-lg p-3 mb-3">
                                  <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Motivo:</p>
                                  <p className="text-sm text-gray-300">{req.motivo_devolucao}</p>
                                </div>
                                <p className="text-xs text-gray-500">
                                  Solicitado por: {req.requisitado_usuario?.nome || 'N/A'} • {new Date(req.gi_postada_em || req.created_at).toLocaleString('pt-BR')}
                                </p>
                              </div>
                            </div>

                            <div className="flex gap-3">
                              <button
                                onClick={() => handleAprovarDevolucao(req)}
                                className="flex-1 neon-button flex items-center justify-center gap-2 text-xs px-4 py-2"
                                style={{
                                  backgroundColor: '#39FF1410',
                                  borderColor: '#39FF14',
                                  color: '#39FF14'
                                }}
                              >
                                <CheckCircle className="w-4 h-4" />
                                APROVAR DEVOLUÇÃO
                              </button>
                              <button
                                onClick={() => handleReprovarDevolucao(req)}
                                className="flex-1 neon-button flex items-center justify-center gap-2 text-xs px-4 py-2"
                                style={{
                                  backgroundColor: '#FF006410',
                                  borderColor: '#FF0064',
                                  color: '#FF0064'
                                }}
                              >
                                <XCircle className="w-4 h-4" />
                                REPROVAR DEVOLUÇÃO
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {showAprovadas && devolucoesAprovadas.length > 0 && (
          <div>
            <h3 className="text-lg font-bold text-[#39FF14] mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              DEVOLUÇÕES APROVADAS ({devolucoesAprovadas.length})
            </h3>
            <div className="space-y-3">
              {devolucoesAprovadas.map((dev: any) => (
                <div key={dev.id} className="premium-card p-4 hover-lift border-[#39FF14]/20">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <p className="font-medium text-[#00D4FF] text-xl">
                          ID #{dev.peca_id?.id_numerico || 'N/A'}
                        </p>
                        <span className="px-2 py-1 rounded text-xs font-bold bg-[#39FF14]/10 text-[#39FF14] border border-[#39FF14]/30">
                          DEVOLVIDA
                        </span>
                      </div>
                      <p className="text-sm text-gray-400 mb-1">
                        PN: <span className="font-mono">{dev.peca_id?.pn || 'N/A'}</span>
                      </p>
                      <p className="text-sm text-gray-400 mb-2">
                        {dev.peca_id?.descricao || 'N/A'}
                      </p>

                      <div className="flex items-center gap-3 mb-2 text-xs text-gray-500">
                        {dev.numero_os_samsung && (
                          <span>OS Samsung: <span className="font-bold text-[#00D4FF]">#{dev.numero_os_samsung}</span></span>
                        )}
                        {!dev.numero_os_samsung && dev.numero_cotacao && (
                          <span>Cotação: <span className="font-bold text-[#00D4FF]">#{dev.numero_cotacao}</span></span>
                        )}
                      </div>

                      {dev.observacao && (
                        <div className="bg-gray-900/50 rounded-lg p-3 mt-2">
                          <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Observação:</p>
                          <p className="text-sm text-gray-300">{dev.observacao}</p>
                        </div>
                      )}
                      {dev.dias_vinculada > 40 && activeSubTab === 'nova' && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded px-3 py-2 mt-2">
                          <p className="text-sm text-red-400 font-medium">
                            Atenção: {dev.dias_vinculada} dias vinculada
                          </p>
                          <p className="text-xs text-red-300 mt-1">
                            Requer justificativa ou devolução à Samsung
                          </p>
                        </div>
                      )}

                      <div className="mt-3 space-y-1">
                        <p className="text-xs text-gray-500">
                          Solicitada por: <span className="font-medium text-gray-400">{dev.solicitada_usuario?.nome || 'N/A'}</span>
                        </p>
                        <p className="text-xs text-gray-500">
                          Aprovada por: <span className="font-medium text-gray-400">{dev.aprovada_usuario?.nome || 'N/A'}</span> em {new Date(dev.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                    <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                      dev.conferida ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                    }`}>
                      {dev.conferida ? 'Conferida' : 'Pendente Conferência'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {devolucoesPendentes.length === 0 && devolucoesAprovadas.length === 0 && (
          <div className="text-center py-12">
            <RotateCcw className="w-12 h-12 text-gray-600 mx-auto mb-4" />
            <p className="text-gray-400">Nenhuma devolução nesta categoria</p>
          </div>
        )}
      </div>
    </div>
  );
}
