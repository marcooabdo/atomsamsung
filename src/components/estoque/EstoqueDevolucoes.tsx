import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { RotateCcw, AlertTriangle, CheckCircle, Clock, XCircle, ChevronDown, ChevronRight, DollarSign, Eye } from 'lucide-react';
import { BadgeTipoOS } from './BadgeTipoOS';
import { AprovarDevolucaoModal } from './AprovarDevolucaoModal';

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
  const [requisicaoParaAprovar, setRequisicaoParaAprovar] = useState<any>(null);
  const [mostrarModalAprovar, setMostrarModalAprovar] = useState(false);

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
          peca_estoque:peca_estoque_id(id_numerico, pn, descricao, status, delivery)
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

      // Enriquecer cada requisição com dados das peças do lote
      const requisicoesEnriquecidas = await Promise.all(
        (dataPendentes || []).map(async (req: any) => {
          let pecasLote = null;
          if (req.is_lote && req.pecas_estoque_ids && req.pecas_estoque_ids.length > 0) {
            const { data: pecasData } = await supabase
              .from('estoque_pecas')
              .select('id, id_numerico, gi_postada_em, delivery')
              .in('id', req.pecas_estoque_ids)
              .order('id_numerico');

            if (activeSubTab === 'usada' && pecasData) {
              pecasLote = pecasData.filter(p => p.gi_postada_em !== null);
            } else {
              pecasLote = pecasData;
            }
          }

          let pecaEstoqueResolvida = req.peca_estoque;
          if (!req.peca_estoque && !req.is_lote && req.os_id && req.codigo_peca) {
            const { data: pecaPorOS } = await supabase
              .from('estoque_pecas')
              .select('id, id_numerico, pn, descricao, status, delivery')
              .eq('os_id', req.os_id)
              .eq('pn', req.codigo_peca)
              .not('status', 'in', '(devolvida_nova,devolvida_defeito,arquivada)')
              .limit(1);

            if (pecaPorOS && pecaPorOS.length > 0) {
              pecaEstoqueResolvida = pecaPorOS[0];
            }
          }

          return {
            ...req,
            pecas_lote: pecasLote,
            peca_estoque: pecaEstoqueResolvida
          };
        })
      );

      requisicoesEnriquecidas.forEach((req: any) => {
        // Para peças usadas em lote, só adicionar se tiver pelo menos uma peça com GI postada
        if (activeSubTab === 'usada' && req.is_lote && req.pecas_lote && req.pecas_lote.length === 0) {
          return; // Pular esta requisição se não tem peças com GI
        }

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
        // Contar corretamente as peças em lote (para todos os tipos de devolução)
        if (req.is_lote && req.pecas_lote && req.pecas_lote.length > 0) {
          agrupado[chave].totalPecas += req.pecas_lote.length;
        } else if (req.is_lote && req.pecas_estoque_ids && req.pecas_estoque_ids.length > 0) {
          // Se é lote mas pecas_lote não foi carregado, usar o tamanho do array de IDs
          agrupado[chave].totalPecas += req.pecas_estoque_ids.length;
        } else {
          agrupado[chave].totalPecas += 1;
        }
      });

      setDevolucoesPendentes(Object.values(agrupado));

      // Carregar devoluções aprovadas com TODAS as informações necessárias
      let queryAprovadas = supabase
        .from('estoque_devolucoes')
        .select(`
          *,
          peca_id(id, id_numerico, pn, descricao, status, os_id, unidade_id, delivery),
          solicitada_usuario:solicitada_por(nome),
          aprovada_usuario:aprovada_por(nome)
        `)
        .eq('tipo_devolucao', tipoMap[activeSubTab])
        .order('created_at', { ascending: false });

      const { data: dataAprovadas, error: errorAprovadas } = await queryAprovadas;
      if (errorAprovadas) throw errorAprovadas;

      // Filtrar por unidade APÓS buscar (já que o filtro direto não funciona em relacionamento)
      let devolucoesFiltradasPorUnidade = dataAprovadas || [];
      if (selectedUnidade && selectedUnidade !== 'todas') {
        devolucoesFiltradasPorUnidade = devolucoesFiltradasPorUnidade.filter(
          (dev: any) => dev.peca_id?.unidade_id === selectedUnidade
        );
      }

      // Buscar informações de OS e Cotação para cada devolução aprovada
      const devolucoesEnriquecidas = await Promise.all(
        devolucoesFiltradasPorUnidade.map(async (dev: any) => {
          let numero_os_samsung = null;
          let numero_os_interna = null;
          let numero_cotacao = null;

          const pecaId = typeof dev.peca_id === 'object' ? dev.peca_id?.id : dev.peca_id;

          // Buscar QUALQUER requisição dessa peça que tenha sido devolvida para pegar as informações
          // Primeiro tentar buscar por peca_estoque_id
          let { data: requisicoes } = await supabase
            .from('requisicoes_pecas')
            .select(`
              numero_os_samsung,
              os_id,
              cotacao_id,
              cotacao:cotacao_id(numero_cotacao),
              os:os_id(numero_os_interna)
            `)
            .eq('peca_estoque_id', pecaId)
            .eq('status', 'devolvida')
            .order('created_at', { ascending: false })
            .limit(1);

          // Se não encontrou, tentar buscar no array pecas_estoque_ids
          if (!requisicoes || requisicoes.length === 0) {
            const result = await supabase
              .from('requisicoes_pecas')
              .select(`
                numero_os_samsung,
                os_id,
                cotacao_id,
                cotacao:cotacao_id(numero_cotacao),
                os:os_id(numero_os_interna)
              `)
              .contains('pecas_estoque_ids', [pecaId])
              .eq('status', 'devolvida')
              .order('created_at', { ascending: false })
              .limit(1);
            requisicoes = result.data;
          }

          if (requisicoes && requisicoes.length > 0) {
            const requisicao = requisicoes[0];
            numero_os_samsung = requisicao.numero_os_samsung;
            numero_os_interna = requisicao.os?.numero_os_interna;
            numero_cotacao = requisicao.cotacao?.numero_cotacao;
          }

          // Fallback: buscar OS pelo campo os_id da tabela estoque_devolucoes
          if (!numero_os_samsung && !numero_os_interna && dev.os_id) {
            const { data: osData } = await supabase
              .from('os')
              .select('numero_os_samsung, numero_os_interna')
              .eq('id', dev.os_id)
              .maybeSingle();
            if (osData) {
              numero_os_samsung = osData.numero_os_samsung;
              numero_os_interna = osData.numero_os_interna;
            }
          }

          return {
            ...dev,
            numero_os_samsung,
            numero_os_interna,
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

  const handleAprovarDevolucao = async (requisicao: any, foto?: File, qrCode?: string) => {
    try {
      // Upload da foto se existir
      let fotoUrl = null;
      if (foto) {
        const fileExt = foto.name.split('.').pop();
        const fileName = `${requisicao.id}_${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('os-anexos')
          .upload(`devolucoes/${fileName}`, foto);

        if (uploadError) throw uploadError;

        const { data: publicData } = supabase.storage
          .from('os-anexos')
          .getPublicUrl(`devolucoes/${fileName}`);

        fotoUrl = publicData.publicUrl;
      }

      // Salvar QR code e foto na observação se existirem
      let observacaoCompleta = requisicao.motivo_devolucao;
      if (qrCode) {
        observacaoCompleta += `\n\nQR CODE: ${qrCode}`;
      }
      if (fotoUrl) {
        observacaoCompleta += `\n\nFOTO: ${fotoUrl}`;
      }
      await supabase
        .from('requisicoes_pecas')
        .update({ status: 'devolvida' })
        .eq('id', requisicao.id);

      // Determinar os IDs das peças a serem processadas
      const pecasIds = requisicao.is_lote && requisicao.pecas_estoque_ids && requisicao.pecas_estoque_ids.length > 0
        ? requisicao.pecas_estoque_ids
        : requisicao.peca_estoque_id
        ? [requisicao.peca_estoque_id]
        : [];

      // Se a requisição não tem peca_estoque_id (ex: alocação automática na entrada),
      // buscar a peça pelo os_id + pn da requisição
      let pecasIdsResolvidos = [...pecasIds];
      if (pecasIdsResolvidos.length === 0 && requisicao.os_id && requisicao.codigo_peca) {
        const { data: pecaPorOS } = await supabase
          .from('estoque_pecas')
          .select('id')
          .eq('os_id', requisicao.os_id)
          .eq('pn', requisicao.codigo_peca)
          .not('status', 'in', '(devolvida_nova,devolvida_defeito,usada,arquivada)')
          .limit(1);

        if (pecaPorOS && pecaPorOS.length > 0) {
          pecasIdsResolvidos = [pecaPorOS[0].id];

          // Vincular peca_estoque_id na requisição para consistência futura
          await supabase
            .from('requisicoes_pecas')
            .update({ peca_estoque_id: pecaPorOS[0].id })
            .eq('id', requisicao.id);
        }
      }

      if (pecasIdsResolvidos.length > 0) {
        const novoStatus =
          requisicao.tipo_devolucao === 'nova' ? 'devolvida_nova' :
          requisicao.tipo_devolucao === 'nova_com_defeito' ? 'devolvida_defeito' :
          'usada';

        const updateData: any = { status: novoStatus };

        if (requisicao.tipo_devolucao !== 'usada') {
          updateData.os_id = null;
          updateData.tecnico_id = null;
        }

        const { data: userData } = await supabase
          .from('usuarios')
          .select('nome')
          .eq('id', user.id)
          .single();

        const osNumero = requisicao.numero_os_samsung || requisicao.os?.numero_os_samsung || requisicao.os?.numero_os_interna || 'N/A';

        // Processar CADA peça individualmente
        for (const pecaId of pecasIdsResolvidos) {
          // Buscar status atual da peça antes de atualizar
          const { data: pecaAtual } = await supabase
            .from('estoque_pecas')
            .select('status')
            .eq('id', pecaId)
            .maybeSingle();

          const statusAnterior = pecaAtual?.status || 'vinculada_tecnico';

          const { error: updateError } = await supabase
            .from('estoque_pecas')
            .update(updateData)
            .eq('id', pecaId);

          if (updateError) {
            // ignored
          }

          const { error: insertDevError } = await supabase
            .from('estoque_devolucoes')
            .insert({
              peca_id: pecaId,
              tipo_devolucao: requisicao.tipo_devolucao,
              solicitada_por: requisicao.requisitado_por,
              aprovada_por: user.id,
              os_id: requisicao.os_id || null,
              observacao: observacaoCompleta
            });

          if (insertDevError) {
            // ignored
          }

          await supabase.from('estoque_historico').insert({
            peca_id: pecaId,
            usuario_id: user.id,
            acao: 'devolucao',
            status_anterior: statusAnterior,
            status_novo: novoStatus,
            origem: `OS ${osNumero}`,
            destino: 'Estoque',
            observacao: `Devolução APROVADA por ${userData?.nome || 'Estoque'} - Tipo: ${requisicao.tipo_devolucao === 'nova' ? 'Nova' : requisicao.tipo_devolucao === 'nova_com_defeito' ? 'Nova com Defeito' : 'Usada'}${requisicao.tipo_devolucao === 'nova_com_defeito' ? ` - Defeito: ${requisicao.motivo_devolucao}` : ''}`
          });
        }
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
          Aprove ou reprove devoluções pendentes de peças com GI postada, novas ou com defeito.
          Peças aprovadas são retornadas ao estoque ou UPC.
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
                            {grupo.numero_os_samsung
                              ? `OS ${grupo.numero_os_samsung}`
                              : grupo.numero_cotacao
                                ? `Cotação #${grupo.numero_cotacao}`
                                : grupo.cliente_nome || grupo.numero_os_interna || 'N/A'}
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
                                <div className="text-xs text-gray-400 mb-2 flex items-center gap-2 flex-wrap">
                                  {req.is_lote && req.pecas_lote && req.pecas_lote.length > 0 ? (
                                    <>
                                      <span>IDs:</span>
                                      {req.pecas_lote.map((peca: any, index: number) => (
                                        <span key={peca.id} className="font-mono font-bold text-[#00D4FF]">
                                          #{peca.id_numerico}{index < req.pecas_lote.length - 1 ? ',' : ''}
                                        </span>
                                      ))}
                                      {activeSubTab === 'usada' && (
                                        <span className="text-[10px] px-2 py-1 rounded bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/30 ml-1">
                                          c/ GI
                                        </span>
                                      )}
                                      <span>•</span>
                                    </>
                                  ) : (
                                    <>
                                      <span>ID: <span className="font-mono font-bold text-[#00D4FF]">#{req.peca_estoque?.id_numerico || 'N/A'}</span> •</span>
                                    </>
                                  )}
                                  <span>PN: <span className="font-mono font-bold">{req.codigo_peca}</span></span>
                                  {(() => {
                                    const delivery = req.is_lote && req.pecas_lote && req.pecas_lote.length > 0
                                      ? req.pecas_lote[0]?.delivery
                                      : req.peca_estoque?.delivery;
                                    return delivery ? (
                                      <>
                                        <span>•</span>
                                        <span>Delivery: <span className="font-mono font-bold text-[#FFBF00]">{delivery}</span></span>
                                      </>
                                    ) : null;
                                  })()}
                                </div>
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
                                onClick={() => {
                                  setRequisicaoParaAprovar(req);
                                  setMostrarModalAprovar(true);
                                }}
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

                      {(dev.numero_os_samsung || dev.numero_os_interna || dev.numero_cotacao) && (
                        <div className="mb-2">
                          <p className="text-xs text-gray-500 uppercase font-semibold">OS:</p>
                          <p className="text-sm font-bold text-white">
                            {dev.numero_os_samsung
                              ? dev.numero_os_samsung
                              : dev.numero_os_interna
                                ? dev.numero_os_interna
                                : dev.numero_cotacao
                                  ? `Cotação #${dev.numero_cotacao}`
                                  : ''}
                          </p>
                        </div>
                      )}

                      <p className="text-sm text-gray-400 mb-1">
                        PN: <span className="font-mono">{dev.peca_id?.pn || 'N/A'}</span>
                        {dev.peca_id?.delivery && (
                          <span className="ml-3">Delivery: <span className="font-mono font-bold text-[#FFBF00]">{dev.peca_id.delivery}</span></span>
                        )}
                      </p>
                      <p className="text-sm text-gray-400 mb-2">
                        {dev.peca_id?.descricao || 'N/A'}
                      </p>

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

      {mostrarModalAprovar && requisicaoParaAprovar && (
        <AprovarDevolucaoModal
          isOpen={mostrarModalAprovar}
          onClose={() => {
            setMostrarModalAprovar(false);
            setRequisicaoParaAprovar(null);
          }}
          onConfirm={async (foto, qrCode) => {
            await handleAprovarDevolucao(requisicaoParaAprovar, foto, qrCode);
          }}
          requisicao={requisicaoParaAprovar}
        />
      )}
    </div>
  );
}
