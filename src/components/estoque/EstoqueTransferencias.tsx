import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../../lib/supabase';
import { ArrowRightLeft, QrCode, Check, Package, ChevronDown, ChevronRight, DollarSign, Clock, AlertCircle, X, CheckCircle, XCircle, AlertTriangle, Search, Minimize2, Maximize2, Copy } from 'lucide-react';
import { useModal } from '../../contexts/ModalContext';
import { ModalSelecionarID } from './ModalSelecionarID';
import { ModalPedirPeca } from './ModalPedirPeca';
import { ModalRegistrarValorGSPN } from './ModalRegistrarValorGSPN';
import { ModalJustificativaPedido } from './ModalJustificativaPedido';
import { BadgeTipoOS } from './BadgeTipoOS';
import { EstoqueDashboard } from './EstoqueDashboard';

interface EstoqueTransferenciasProps {
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
  todasAtendidas: boolean;
  algunsAtendidas: boolean;
  valorTotal: number;
}

export function EstoqueTransferencias({ selectedUnidade, user }: EstoqueTransferenciasProps) {
  const { showAlert, showConfirm } = useModal();
  const [requisicoesAgrupadas, setRequisicoesAgrupadas] = useState<RequisicaoAgrupada[]>([]);
  const [pedidosAtivos, setPedidosAtivos] = useState<RequisicaoAgrupada[]>([]);
  const [loading, setLoading] = useState(true);
  const [osExpandida, setOsExpandida] = useState<string>('');
  const [osExpandidaPedido, setOsExpandidaPedido] = useState<string>('');
  const [osExpandidaAtendida, setOsExpandidaAtendida] = useState<string>('');
  const [modalSelecionarID, setModalSelecionarID] = useState<any>(null);
  const [modalPedirPeca, setModalPedirPeca] = useState<any>(null);
  const [modalRegistrarValor, setModalRegistrarValor] = useState<any>(null);
  const [modalJustificativa, setModalJustificativa] = useState<any>(null);
  const [modalVerPedido, setModalVerPedido] = useState<any>(null);
  const [historicoMinimizado, setHistoricoMinimizado] = useState(true);
  const [buscaHistorico, setBuscaHistorico] = useState('');
  const [buscaGeral, setBuscaGeral] = useState('');

  useEffect(() => {
    loadData();
  }, [selectedUnidade]);


  const loadData = async () => {
    await loadRequisicoes();
  };

  const loadRequisicoes = async () => {
    try {
      let query = supabase
        .from('requisicoes_pecas')
        .select(`
          *,
          os:os(numero_os_samsung, numero_os_interna, coluna_kanban, tipo_os, os_pecas(pn, valor_gspn)),
          peca_estoque:estoque_pecas(
            id_numerico,
            valor_com_impostos,
            pn,
            descricao,
            estoque_etiquetas(delivery)
          ),
          reprovado_por_usuario:usuarios!requisicoes_pecas_reprovado_por_fkey(nome)
        `)
        .order('created_at', { ascending: false })
        .limit(1000); // Garantir que pegamos um bom histórico

      if (selectedUnidade && selectedUnidade !== 'todas') {
        query = query.eq('unidade_id', selectedUnidade);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Para cada requisição, buscar contagem de IDs disponíveis e detalhes do lote
      const requisicoesComContagem = await Promise.all(
        (data || []).map(async (req: any) => {
          const { count } = await supabase
            .from('estoque_pecas')
            .select('*', { count: 'exact', head: true })
            .eq('pn', req.codigo_peca)
            .eq('status', 'disponivel')
            .eq('unidade_id', req.unidade_id);

          // Se é um lote, buscar detalhes de todas as peças
          let pecasDoLote = null;
          if (req.is_lote && req.pecas_estoque_ids && req.pecas_estoque_ids.length > 0) {
            const { data: pecasData } = await supabase
              .from('estoque_pecas')
              .select(`
                id,
                id_numerico,
                valor_com_impostos,
                pn,
                descricao,
                estoque_etiquetas(delivery)
              `)
              .in('id', req.pecas_estoque_ids)
              .order('id_numerico');
            pecasDoLote = pecasData;
          }

          return {
            ...req,
            ids_disponiveis_count: count || 0,
            pecas_lote: pecasDoLote
          };
        })
      );

      // Separar pedidos ativos de requisições normais
      const agrupado: Record<string, RequisicaoAgrupada> = {};
      const pedidosAtivosAgrupado: Record<string, RequisicaoAgrupada> = {};

      requisicoesComContagem.forEach((req: any) => {
        const isPedidoAtivo = req.status === 'pedido_feito';
        const temIDDisponivel = req.ids_disponiveis_count > 0;

        // Pedidos ativos SEMPRE aparecem na seção de pedidos
        if (isPedidoAtivo) {
          if (!pedidosAtivosAgrupado[req.os_id]) {
            pedidosAtivosAgrupado[req.os_id] = {
              os_id: req.os_id,
              numero_os_samsung: req.numero_os_samsung || req.os?.numero_os_samsung || null,
              numero_os_interna: req.os?.numero_os_interna || null,
              tipo_os: req.os?.tipo_os || 'OW',
              requisicoes: [],
              totalPecas: 0,
              todasAtendidas: false,
              algunsAtendidas: false,
              valorTotal: 0
            };
          }
          pedidosAtivosAgrupado[req.os_id].requisicoes.push(req);
          const qtdPedido = req.quantidade_atendida || Number(req.quantidade_requisitada) || 1;
          pedidosAtivosAgrupado[req.os_id].totalPecas += qtdPedido;

          // Se tem ID disponível, TAMBÉM aparece na lista de transferências (mantendo info do pedido)
          if (temIDDisponivel) {
            if (!agrupado[req.os_id]) {
              agrupado[req.os_id] = {
                os_id: req.os_id,
                numero_os_samsung: req.numero_os_samsung || req.os?.numero_os_samsung || null,
                numero_os_interna: req.os?.numero_os_interna || null,
                tipo_os: req.os?.tipo_os || 'OW',
                requisicoes: [],
                totalPecas: 0,
                todasAtendidas: false,
                algunsAtendidas: false,
                valorTotal: 0
              };
            }
            agrupado[req.os_id].requisicoes.push(req);
            const qtdDisponivel = req.quantidade_atendida || Number(req.quantidade_requisitada) || 1;
            agrupado[req.os_id].totalPecas += qtdDisponivel;
            agrupado[req.os_id].todasAtendidas = false;
          }
          return;
        }

        // Todas as requisições não-pedido aparecem (exceto canceladas e reprovadas)
        if (req.status === 'cancelada' || req.status === 'reprovada') return;

        if (!agrupado[req.os_id]) {
          agrupado[req.os_id] = {
            os_id: req.os_id,
            numero_os_samsung: req.numero_os_samsung || req.os?.numero_os_samsung || null,
            numero_os_interna: req.os?.numero_os_interna || null,
            tipo_os: req.os?.tipo_os || 'OW',
            requisicoes: [],
            totalPecas: 0,
            todasAtendidas: true,
            algunsAtendidas: false,
            valorTotal: 0
          };
        }

        agrupado[req.os_id].requisicoes.push(req);
        // Conta a quantidade real de peças atendidas (para lotes ou peças individuais)
        const qtdPecas = req.quantidade_atendida || Number(req.quantidade_requisitada) || 1;
        agrupado[req.os_id].totalPecas += qtdPecas;

        if (req.status !== 'atendida' && req.status !== 'gi_postada') {
          agrupado[req.os_id].todasAtendidas = false;
        }

        if (req.status === 'atendida' || req.status === 'gi_postada') {
          agrupado[req.os_id].algunsAtendidas = true;
        }

        if (req.is_lote && req.pecas_lote && req.pecas_lote.length > 0) {
          agrupado[req.os_id].valorTotal += req.pecas_lote.reduce((sum: number, p: any) => sum + Number(p.valor_com_impostos || 0), 0);
        } else if (req.valor_peca) {
          agrupado[req.os_id].valorTotal += Number(req.valor_peca) * (Number(req.quantidade_requisitada) || 1);
        } else if (req.peca_estoque?.valor_com_impostos) {
          agrupado[req.os_id].valorTotal += Number(req.peca_estoque.valor_com_impostos) * (Number(req.quantidade_requisitada) || 1);
        }
      });

      setRequisicoesAgrupadas(Object.values(agrupado));
      setPedidosAtivos(Object.values(pedidosAtivosAgrupado));
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleAprovarRequisicao = (requisicao: any) => {
    setModalSelecionarID(requisicao);
  };

  const handleReprovarRequisicao = async (requisicao: any) => {
    const motivo = prompt('Digite o motivo da reprovação da requisição:');
    if (!motivo || !motivo.trim()) {
      showAlert({
        type: 'warning',
        title: 'Motivo Obrigatório',
        message: 'É necessário informar o motivo da reprovação'
      });
      return;
    }

    const confirmacao = confirm(
      `Confirma a REPROVAÇÃO desta requisição?\n\n` +
      `Peça: ${requisicao.descricao}\n` +
      `Código: ${requisicao.codigo_peca}\n` +
      `Quantidade: ${requisicao.quantidade_requisitada}\n` +
      `Motivo: ${motivo}\n\n` +
      `Esta ação NÃO pode ser desfeita.`
    );
    if (!confirmacao) return;

    try {
      const { data: userData } = await supabase
        .from('usuarios')
        .select('nome')
        .eq('id', user.id)
        .single();

      await supabase
        .from('requisicoes_pecas')
        .update({
          status: 'reprovada',
          motivo_reprovacao: motivo,
          reprovado_em: new Date().toISOString(),
          reprovado_por: user.id
        })
        .eq('id', requisicao.id);

      await supabase.from('os_comentarios').insert({
        os_id: requisicao.os_id,
        usuario_id: user.id,
        comentario: `Requisição REPROVADA por ${userData?.nome || 'Estoque'}\nPeça: ${requisicao.descricao} (${requisicao.codigo_peca})\nRequisição ID: ${requisicao.id.slice(0, 8)}\nMotivo: ${motivo}`,
        is_system: true
      });

      showAlert({ type: 'success', title: 'Sucesso', message: 'Requisição reprovada com sucesso!' });
      await loadData();
    } catch (error) {
      showAlert({ type: 'error', title: 'Erro', message: 'Erro ao reprovar requisição. Tente novamente.' });
    }
  };

  const verificarEMoverOSAutomaticamente = async (osId: string, nomeUsuario: string): Promise<string | null> => {
    const { data: todasRequisicoes } = await supabase
      .from('requisicoes_pecas')
      .select('id, status')
      .eq('os_id', osId)
      .not('status', 'in', '(cancelada,reprovada)');

    if (!todasRequisicoes || todasRequisicoes.length === 0) return null;

    const temPendente = todasRequisicoes.some(r =>
      r.status === 'pendente' || r.status === 'pedido_feito'
    );

    if (temPendente) return null;

    const todasAtendidas = todasRequisicoes.every(r =>
      r.status === 'atendida' || r.status === 'em_uso' || r.status === 'gi_postada' || r.status === 'devolvida' || r.status === 'devolucao_pendente'
    );

    if (!todasAtendidas) return null;

    const { data: osCompleta } = await supabase
      .from('os')
      .select('tipo_atendimento, rota_id, unidade_id, coluna_kanban, cliente_cidade')
      .eq('id', osId)
      .single();

    if (!osCompleta) return null;

    let destinoColuna = 'peca_em_transito';
    let mensagemDestino = 'Peça em Trânsito';

    if (osCompleta.tipo_atendimento === 'IH') {
      if (osCompleta.rota_id) {
        const { data: rota } = await supabase
          .from('rotas')
          .select('nome, coluna_kanban')
          .eq('id', osCompleta.rota_id)
          .eq('ativa', true)
          .maybeSingle();

        if (rota && rota.coluna_kanban) {
          destinoColuna = rota.coluna_kanban;
          mensagemDestino = rota.nome;
        }
      } else if (osCompleta.cliente_cidade && osCompleta.unidade_id) {
        const { data: rota } = await supabase
          .from('rotas')
          .select('nome, coluna_kanban')
          .contains('cidades', [osCompleta.cliente_cidade])
          .eq('ativa', true)
          .eq('unidade_id', osCompleta.unidade_id)
          .maybeSingle();

        if (rota && rota.coluna_kanban) {
          destinoColuna = rota.coluna_kanban;
          mensagemDestino = rota.nome;
        }
      }
    }

    if (destinoColuna === osCompleta.coluna_kanban) return null;

    await supabase
      .from('os')
      .update({
        coluna_kanban: destinoColuna,
        bloqueio_movimentacao_automatica: false,
        updated_at: new Date().toISOString()
      })
      .eq('id', osId);

    await supabase.from('os_comentarios').insert({
      os_id: osId,
      usuario_id: user.id,
      comentario: `Todas as peças foram vinculadas por ${nomeUsuario} - OS movida automaticamente para "${mensagemDestino}"`,
      is_system: true
    });

    return `Transferência confirmada! Todas as peças vinculadas. OS movida para "${mensagemDestino}".`;
  };

  const handleConfirmarTransferencia = async (requisicaoId: string, pecaEstoqueId: string) => {
    try {
      const requisicao = modalSelecionarID;

      // ⚠️ VALIDAÇÃO CRÍTICA: Verificar se a peça já está vinculada a outra requisição ativa
      const { data: requisicaoExistente, error: checkError } = await supabase
        .from('requisicoes_pecas')
        .select('id, os_id, codigo_peca, descricao, status, os:os(numero_os_samsung, numero_os_interna)')
        .eq('peca_estoque_id', pecaEstoqueId)
        .not('status', 'in', '(reprovada,devolvida)')
        .maybeSingle();

      if (checkError) {
        throw new Error(`Erro ao verificar disponibilidade da peça: ${checkError.message}`);
      }

      if (requisicaoExistente && requisicaoExistente.id !== requisicao.id) {
        const osNumero = requisicaoExistente.os?.numero_os_samsung || requisicaoExistente.os?.numero_os_interna || 'N/A';
        showAlert({
          type: 'error',
          title: 'Peça Já Vinculada',
          message: `Esta peça já está vinculada a outra requisição!\n\nOS: ${osNumero}\nPeça: ${requisicaoExistente.descricao}\nStatus: ${requisicaoExistente.status.toUpperCase()}\n\nNão é possível vincular a mesma peça física a múltiplas requisições. Selecione outro ID disponível.`
        });
        return;
      }

      // Atualizar requisição
      const { error: reqError, data: reqData } = await supabase
        .from('requisicoes_pecas')
        .update({
          status: 'atendida',
          peca_estoque_id: pecaEstoqueId,
          atendido_por: user.id,
          aprovado_em: new Date().toISOString()
        })
        .eq('id', requisicao.id)
        .select();

      if (reqError) {
        throw new Error(`Erro ao atualizar requisição: ${reqError.message}`);
      }


      // Atualizar peça no estoque
      const { error: pecaError, data: pecaData } = await supabase
        .from('estoque_pecas')
        .update({
          status: 'vinculada_tecnico',
          os_id: requisicao.os_id,
          tecnico_id: requisicao.tecnico_id
        })
        .eq('id', pecaEstoqueId)
        .select();

      if (pecaError) {
        throw new Error(`Erro ao atualizar peça no estoque: ${pecaError.message}`);
      }

      // Atualizar os_pecas vinculando ao estoque_peca_id
      if (requisicao.os_peca_id) {
        await supabase
          .from('os_pecas')
          .update({
            estoque_peca_id: pecaEstoqueId,
            status: 'vinculada_tecnico'
          })
          .eq('id', requisicao.os_peca_id);
      } else if (requisicao.os_id) {
        const { data: matchingOsPeca } = await supabase
          .from('os_pecas')
          .select('id')
          .eq('os_id', requisicao.os_id)
          .eq('pn', requisicao.codigo_peca)
          .is('estoque_peca_id', null)
          .limit(1)
          .maybeSingle();
        if (matchingOsPeca) {
          await supabase
            .from('os_pecas')
            .update({
              estoque_peca_id: pecaEstoqueId,
              status: 'vinculada_tecnico'
            })
            .eq('id', matchingOsPeca.id);
        }
      }


      // Criar log no histórico do estoque
      const { error: histError } = await supabase.from('estoque_historico').insert({
        peca_id: pecaEstoqueId,
        usuario_id: user.id,
        acao: 'transferencia',
        status_anterior: 'disponivel',
        status_novo: 'vinculada_tecnico',
        origem: 'Estoque Central',
        destino: `OS ${requisicao.os?.numero_os_samsung || requisicao.os?.numero_os_interna}`,
        observacao: `ID vinculado à requisição - ${requisicao.descricao}`
      });

      if (histError) {
      } else {
      }

      // Buscar nome do usuário
      const { data: userData } = await supabase
        .from('usuarios')
        .select('nome')
        .eq('id', user.id)
        .single();

      // Buscar ID numérico da peça para incluir no comentário
      const { data: pecaEstoque } = await supabase
        .from('estoque_pecas')
        .select('id_numerico')
        .eq('id', pecaEstoqueId)
        .single();

      // Log em os_comentarios com nome do usuário e ID da peça
      await supabase.from('os_comentarios').insert({
        os_id: requisicao.os_id,
        usuario_id: user.id,
        comentario: `Requisição APROVADA - Peça vinculada por ${userData?.nome || 'Estoque'}\nPeça: ${requisicao.descricao} (${requisicao.codigo_peca})\nID da Peça: #${pecaEstoque?.id_numerico || 'N/A'}\nRequisição ID: ${requisicao.id.slice(0, 8)}`,
        is_system: true
      });


      // Verificar se todas as peças da OS foram atendidas e mover automaticamente
      const resultadoMovimentacao = await verificarEMoverOSAutomaticamente(requisicao.os_id, userData?.nome || 'Estoque');

      if (resultadoMovimentacao) {
        showAlert({
          type: 'success',
          title: 'Sucesso',
          message: resultadoMovimentacao
        });
      } else {
        showAlert({ type: 'success', title: 'Sucesso', message: 'Transferência confirmada com sucesso!' });
      }

      setModalSelecionarID(null);
      await loadData();
    } catch (error) {
      showAlert({ type: 'error', title: 'Erro', message: 'Erro ao confirmar transferência. Tente novamente.' });
    }
  };

  const handleConfirmarTransferenciaMultipla = async (requisicaoId: string, pecaIds: string[]) => {
    try {
      const requisicao = modalSelecionarID;

      for (const pecaId of pecaIds) {
        const { data: requisicaoExistente } = await supabase
          .from('requisicoes_pecas')
          .select('id')
          .eq('peca_estoque_id', pecaId)
          .not('status', 'in', '(reprovada,devolvida)')
          .maybeSingle();

        if (requisicaoExistente && requisicaoExistente.id !== requisicao.id) {
          showAlert({ type: 'error', title: 'Erro', message: 'Uma das peças selecionadas já está vinculada a outra requisição.' });
          return;
        }
      }

      const primeiroId = pecaIds[0];
      const { error: reqError } = await supabase
        .from('requisicoes_pecas')
        .update({
          status: 'atendida',
          peca_estoque_id: primeiroId,
          pecas_estoque_ids: pecaIds,
          quantidade_atendida: pecaIds.length,
          is_lote: true,
          atendido_por: user.id,
          aprovado_em: new Date().toISOString()
        })
        .eq('id', requisicao.id);

      if (reqError) throw reqError;

      for (const pecaId of pecaIds) {
        await supabase
          .from('estoque_pecas')
          .update({
            status: 'vinculada_tecnico',
            os_id: requisicao.os_id,
            tecnico_id: requisicao.tecnico_id
          })
          .eq('id', pecaId);

        await supabase.from('estoque_historico').insert({
          peca_id: pecaId,
          usuario_id: user.id,
          acao: 'transferencia',
          status_anterior: 'disponivel',
          status_novo: 'vinculada_tecnico',
          origem: 'Estoque Central',
          destino: `OS ${requisicao.os?.numero_os_samsung || requisicao.os?.numero_os_interna}`,
          observacao: `ID vinculado (lote ${pecaIds.length} un.) - ${requisicao.descricao}`
        });
      }

      // Atualizar os_pecas vinculando ao primeiro estoque_peca_id
      if (requisicao.os_peca_id) {
        await supabase
          .from('os_pecas')
          .update({
            estoque_peca_id: primeiroId,
            status: 'vinculada_tecnico'
          })
          .eq('id', requisicao.os_peca_id);
      } else if (requisicao.os_id) {
        const { data: matchingOsPeca } = await supabase
          .from('os_pecas')
          .select('id')
          .eq('os_id', requisicao.os_id)
          .eq('pn', requisicao.codigo_peca)
          .is('estoque_peca_id', null)
          .limit(1)
          .maybeSingle();
        if (matchingOsPeca) {
          await supabase
            .from('os_pecas')
            .update({
              estoque_peca_id: primeiroId,
              status: 'vinculada_tecnico'
            })
            .eq('id', matchingOsPeca.id);
        }
      }

      const { data: userData } = await supabase
        .from('usuarios')
        .select('nome')
        .eq('id', user.id)
        .single();

      const idsNumericos = await Promise.all(pecaIds.map(async (id) => {
        const { data } = await supabase.from('estoque_pecas').select('id_numerico').eq('id', id).single();
        return data?.id_numerico || '?';
      }));

      await supabase.from('os_comentarios').insert({
        os_id: requisicao.os_id,
        usuario_id: user.id,
        comentario: `Requisicao em LOTE atendida por ${userData?.nome || 'Estoque'}\nPeca: ${requisicao.descricao} (${requisicao.codigo_peca})\nQuantidade: ${pecaIds.length}\nIDs: #${idsNumericos.join(', #')}`,
        is_system: true
      });

      // Verificar se todas as peças da OS foram atendidas e mover automaticamente
      const resultadoMovimentacao = await verificarEMoverOSAutomaticamente(requisicao.os_id, userData?.nome || 'Estoque');

      if (resultadoMovimentacao) {
        showAlert({
          type: 'success',
          title: 'Sucesso',
          message: resultadoMovimentacao
        });
      } else {
        showAlert({
          type: 'success',
          title: 'Sucesso',
          message: `${pecaIds.length} peças vinculadas com sucesso!`
        });
      }
      setModalSelecionarID(null);
      await loadData();
    } catch (error) {
      showAlert({ type: 'error', title: 'Erro', message: 'Erro ao confirmar transferência em lote. Tente novamente.' });
    }
  };

  const handleRegistrarValor = (requisicao: any) => {
    setModalRegistrarValor(requisicao);
  };

  const handleConfirmarValor = async (valor: number) => {
    try {
      const requisicao = modalRegistrarValor;

      // Check if OS has a different valor_gspn for this part
      const { data: osPecas } = await supabase
        .from('os_pecas')
        .select('valor_gspn')
        .eq('os_id', requisicao.os_id)
        .eq('pn', requisicao.codigo_peca)
        .maybeSingle();

      if (osPecas?.valor_gspn && Math.abs(osPecas.valor_gspn - valor) > 0.01) {
        showAlert({
          type: 'error',
          title: 'Valor Divergente na OS',
          message: `O valor informado (R$ ${valor.toFixed(2)}) é diferente do valor cadastrado na OS (R$ ${Number(osPecas.valor_gspn).toFixed(2)}). Corrija o valor na OS antes de prosseguir, ou registre o valor correto aqui.`
        });
        return;
      }

      await supabase
        .from('requisicoes_pecas')
        .update({
          valor_peca: valor
        })
        .eq('id', requisicao.id);

      // Also update os_pecas.valor_gspn to keep in sync
      await supabase
        .from('os_pecas')
        .update({ valor_gspn: valor })
        .eq('os_id', requisicao.os_id)
        .eq('pn', requisicao.codigo_peca);

      const { data: userData } = await supabase
        .from('usuarios')
        .select('nome')
        .eq('id', user.id)
        .single();

      await supabase.from('os_comentarios').insert({
        os_id: requisicao.os_id,
        usuario_id: user.id,
        comentario: `Valor GSPN registrado por ${userData?.nome || 'Estoque'}: ${requisicao.descricao} (${requisicao.codigo_peca}) - R$ ${valor.toFixed(2)}`,
        is_system: true
      });

      showAlert({ type: 'success', title: 'Sucesso', message: 'Valor GSPN registrado com sucesso!' });
      setModalRegistrarValor(null);
      await loadData();
    } catch (error) {
      throw error;
    }
  };

  const handlePedirPeca = (requisicao: any) => {
    setModalPedirPeca(requisicao);
  };

  const handlePedirPecaComEstoque = (requisicao: any) => {
    setModalJustificativa(requisicao);
  };

  const handleVerPedido = (requisicao: any) => {
    setModalVerPedido(requisicao);
  };

  const handleRefazerPedido = async (requisicao: any) => {
    if (!confirm('Deseja refazer este pedido? O status voltará para PENDENTE e a OS será movida de volta no Kanban.')) return;

    try {
      await supabase
        .from('requisicoes_pecas')
        .update({
          status: 'pendente',
          numero_pedido_samsung: null,
          observacoes_pedido: null,
          updated_at: new Date().toISOString()
        })
        .eq('id', requisicao.id);

      const { data: osData } = await supabase
        .from('os')
        .select('id, coluna_kanban')
        .eq('id', requisicao.os_id)
        .maybeSingle();

      const { data: outrasRequisicoes } = await supabase
        .from('requisicoes_pecas')
        .select('id, status')
        .eq('os_id', requisicao.os_id)
        .neq('id', requisicao.id);

      const temOutrasPecasPedidas = outrasRequisicoes?.some(r => r.status === 'pedido_feito');
      const temOutrasPendentes = outrasRequisicoes?.some(r => r.status === 'pendente');

      let mensagemMovimentacao = '';

      if (osData) {
        if (osData.coluna_kanban === 'peca_em_transito') {
          if (!temOutrasPecasPedidas) {
            await supabase
              .from('os')
              .update({
                coluna_kanban: 'aguardando_peca',
                updated_at: new Date().toISOString()
              })
              .eq('id', requisicao.os_id);
            mensagemMovimentacao = ' - OS movida de "Peça em Trânsito" para "Aguardando Peça"';
          }
        } else if (osData.coluna_kanban === 'aguardando_peca') {
          if (!temOutrasPecasPedidas && !temOutrasPendentes) {
            await supabase
              .from('os')
              .update({
                coluna_kanban: 'orcamento_aprovado',
                updated_at: new Date().toISOString()
              })
              .eq('id', requisicao.os_id);
            mensagemMovimentacao = ' - OS movida para "Orçamento Aprovado"';
          }
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
        comentario: `Pedido CANCELADO por ${userData?.nome || 'Estoque'}\nPedido Samsung: ${requisicao.numero_pedido_samsung}\nPeça: ${requisicao.descricao} (${requisicao.codigo_peca})\nRequisição ID: ${requisicao.id.slice(0, 8)}\nStatus voltou para PENDENTE${mensagemMovimentacao}`,
        is_system: true
      });

      const alertMsg = `Pedido cancelado! Status voltou para PENDENTE.${mensagemMovimentacao}`;
      showAlert({
        type: 'success',
        title: 'Pedido Cancelado',
        message: alertMsg
      });
      await loadData();
    } catch (error) {
      showAlert({ type: 'error', title: 'Erro', message: 'Erro ao refazer pedido. Tente novamente.' });
    }
  };

  const handleConfirmarPedidoComJustificativa = async (justificativa: string) => {
    try {
      const requisicao = modalJustificativa;

      const valorEstimado = Number(requisicao.valor_peca || 0);
      if (isNaN(valorEstimado) || valorEstimado <= 0) {
        throw new Error('Valor estimado inválido');
      }

      // Atualizar requisição com status pedido_feito e justificativa nas observações
      const { error: updateError } = await supabase
        .from('requisicoes_pecas')
        .update({
          status: 'pedido_feito',
          numero_pedido_samsung: `PENDENTE-${Date.now()}`,
          observacoes_pedido: `JUSTIFICATIVA (${requisicao.ids_disponiveis_count} ID(s) disponível(eis)): ${justificativa}`,
          valor_peca: valorEstimado,
          updated_at: new Date().toISOString()
        })
        .eq('id', requisicao.id);

      if (updateError) throw updateError;

      await supabase
        .from('os')
        .update({
          coluna_kanban: 'peca_em_transito',
          bloqueio_movimentacao_automatica: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', requisicao.os_id);

      const { data: userData } = await supabase
        .from('usuarios')
        .select('nome')
        .eq('id', user.id)
        .maybeSingle();

      await supabase.from('os_comentarios').insert({
        os_id: requisicao.os_id,
        usuario_id: user.id,
        comentario: `Pedido criado por ${userData?.nome || 'Estoque'} MESMO COM ${requisicao.ids_disponiveis_count} ID(s) DISPONÍVEL(EIS): ${requisicao.descricao} (${requisicao.codigo_peca}) - Valor GSPN: R$ ${valorEstimado.toFixed(2)}\nJUSTIFICATIVA: ${justificativa}\nOS movida para "Peça em Trânsito"`,
        is_system: true
      });

      showAlert({ type: 'success', title: 'Sucesso', message: 'Pedido criado com justificativa registrada! OS movida para "Peça em Trânsito".' });
      setModalJustificativa(null);
      await loadData();
    } catch (error) {
      throw error;
    }
  };

  const handleConfirmarPedido = async (requisicaoId: string, dados: any) => {
    try {
      const requisicao = modalPedirPeca;

      const valorEstimado = Number(dados.valorEstimado || 0);
      if (isNaN(valorEstimado) || valorEstimado <= 0) {
        throw new Error('Valor estimado inválido');
      }

      // Atualizar requisição com dados do pedido e mudar status para "pedido_feito"
      const { error: updateError } = await supabase
        .from('requisicoes_pecas')
        .update({
          status: 'pedido_feito',
          numero_pedido_samsung: dados.numeroPedido,
          observacoes_pedido: dados.observacoes || null,
          valor_peca: valorEstimado,
          updated_at: new Date().toISOString()
        })
        .eq('id', requisicao.id);

      if (updateError) throw updateError;

      const { data: osData } = await supabase
        .from('os')
        .select('id, coluna_kanban')
        .eq('id', requisicao.os_id)
        .maybeSingle();

      let colunaDestino = 'peca_em_transito';
      let mensagemMovimentacao = '';

      if (osData && osData.coluna_kanban !== 'peca_em_transito') {
        await supabase
          .from('os')
          .update({
            coluna_kanban: 'peca_em_transito',
            bloqueio_movimentacao_automatica: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', requisicao.os_id);

        mensagemMovimentacao = ' - OS movida para "Peça em Trânsito"';
      }

      const { data: userData } = await supabase
        .from('usuarios')
        .select('nome')
        .eq('id', user.id)
        .maybeSingle();

      const observacaoTexto = dados.observacoes ? `\nObservações: ${dados.observacoes}` : '';
      await supabase.from('os_comentarios').insert({
        os_id: requisicao.os_id,
        usuario_id: user.id,
        comentario: `Pedido ${dados.numeroPedido} criado por ${userData?.nome || 'Estoque'}: ${requisicao.descricao} (${requisicao.codigo_peca}) - Valor GSPN: R$ ${valorEstimado.toFixed(2)}${observacaoTexto}${mensagemMovimentacao}`,
        is_system: true
      });

      showAlert({
        type: 'success',
        title: 'Sucesso',
        message: `Pedido criado com sucesso!${mensagemMovimentacao ? ' OS movida para "Peça em Trânsito".' : ''}`
      });
      setModalPedirPeca(null);
      await loadData();
    } catch (error) {
      throw error;
    }
  };

  const getStatusBadge = (status: string) => {
    const config: Record<string, { label: string; color: string; bg?: string; borderColor?: string }> = {
      pendente: { label: 'PENDENTE', color: '#FFBF00' },
      pedido_feito: { label: 'PEDIDO FEITO', color: 'var(--text-accent)', bg: 'rgba(var(--accent-rgb), 0.125)', borderColor: 'rgba(var(--accent-rgb), 0.38)' },
      atendida: { label: 'ATENDIDA', color: '#39FF14' },
      em_uso: { label: 'EM USO', color: 'var(--text-accent)', bg: 'rgba(var(--accent-rgb), 0.125)', borderColor: 'rgba(var(--accent-rgb), 0.38)' },
      gi_postada: { label: 'GI POSTADA', color: '#9D00FF' },
      devolvida: { label: 'DEVOLVIDA', color: '#FF0064' },
      reprovada: { label: 'REPROVADA', color: '#FF0064' }
    };

    const entry = config[status] || { label: status.toUpperCase(), color: '#6B7280' };
    const { label, color } = entry;

    return (
      <span
        className="px-2 py-1 rounded text-xs font-bold uppercase"
        style={{
          backgroundColor: entry.bg || `${color}20`,
          color: color,
          border: `1px solid ${entry.borderColor || `${color}60`}`
        }}
      >
        {label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#FFBF00]"></div>
      </div>
    );
  }

  const requisicoesComPendentes = requisicoesAgrupadas.filter(g =>
    g.requisicoes.some(r => r.status === 'pendente' || r.status === 'pedido_feito')
  );

  const requisicoesComPendentesFiltradas = requisicoesComPendentes.filter(grupo => {
    if (!buscaGeral.trim()) return true;
    const termo = buscaGeral.toLowerCase().trim();
    const osNum = (grupo.numero_os_samsung || grupo.numero_os_interna || '').toLowerCase();
    if (osNum.includes(termo)) return true;
    for (const r of grupo.requisicoes) {
      if ((r.codigo_peca || '').toLowerCase().includes(termo)) return true;
      if ((r.descricao || '').toLowerCase().includes(termo)) return true;
      if ((r.numero_pedido_samsung || '').toLowerCase().includes(termo)) return true;
    }
    const deliveries = grupo.requisicoes.map(r => (r as any).delivery || '').filter(Boolean);
    if (deliveries.some(d => d.toLowerCase().includes(termo))) return true;
    const ids = grupo.requisicoes.map(r => (r as any).id_unico || '').filter(Boolean);
    if (ids.some(d => d.toLowerCase().includes(termo))) return true;
    return false;
  });

  const pedidosAtivosFiltrados = pedidosAtivos.filter(grupo => {
    if (!buscaGeral.trim()) return true;
    const termo = buscaGeral.toLowerCase().trim();
    const osNum = (grupo.numero_os_samsung || grupo.numero_os_interna || '').toLowerCase();
    if (osNum.includes(termo)) return true;
    for (const r of grupo.requisicoes) {
      if ((r.codigo_peca || '').toLowerCase().includes(termo)) return true;
      if ((r.descricao || '').toLowerCase().includes(termo)) return true;
      if ((r.numero_pedido_samsung || '').toLowerCase().includes(termo)) return true;
    }
    return false;
  });

  const calcularEstatisticas = () => {
    const todasRequisicoesPendentes = requisicoesComPendentes.flatMap(g =>
      g.requisicoes.filter(r => r.status === 'pendente')
    );

    const lpRequisicoes = todasRequisicoesPendentes.filter(r => r.os?.tipo_os === 'LP');
    const owRequisicoes = todasRequisicoesPendentes.filter(r => r.os?.tipo_os === 'OW');

    const lpSemID = lpRequisicoes.filter(r => r.ids_disponiveis_count === 0).length;
    const owSemID = owRequisicoes.filter(r => r.ids_disponiveis_count === 0).length;

    const lpSemPreco = lpRequisicoes.filter(r => !r.valor_peca && r.ids_disponiveis_count === 0).length;
    const owSemPreco = owRequisicoes.filter(r => !r.valor_peca && r.ids_disponiveis_count === 0).length;

    const lpValorTotal = lpRequisicoes
      .filter(r => r.valor_peca)
      .reduce((sum, r) => sum + (Number(r.valor_peca) * Number(r.quantidade_requisitada)), 0);

    const owValorTotal = owRequisicoes
      .filter(r => r.valor_peca)
      .reduce((sum, r) => sum + (Number(r.valor_peca) * Number(r.quantidade_requisitada)), 0);

    const lpOsIds = new Set(lpRequisicoes.map(r => r.os_id));
    const owOsIds = new Set(owRequisicoes.map(r => r.os_id));

    const pecasSemPrecoMap: Record<string, any> = {};
    todasRequisicoesPendentes
      .filter(r => !r.valor_peca && r.ids_disponiveis_count === 0)
      .forEach(r => {
        const key = r.codigo_peca;
        if (!pecasSemPrecoMap[key]) {
          pecasSemPrecoMap[key] = {
            codigo_peca: r.codigo_peca,
            descricao: r.descricao,
            count: 0,
            lpCount: 0,
            owCount: 0
          };
        }
        pecasSemPrecoMap[key].count++;
        if (r.os?.tipo_os === 'LP') {
          pecasSemPrecoMap[key].lpCount++;
        } else {
          pecasSemPrecoMap[key].owCount++;
        }
      });

    return {
      lpPendentes: {
        osCount: lpOsIds.size,
        pecasCount: lpRequisicoes.length,
        valorTotal: lpValorTotal,
        semID: lpSemID,
        semPreco: lpSemPreco
      },
      owPendentes: {
        osCount: owOsIds.size,
        pecasCount: owRequisicoes.length,
        valorTotal: owValorTotal,
        semID: owSemID,
        semPreco: owSemPreco
      },
      pecasSemPreco: Object.values(pecasSemPrecoMap).sort((a: any, b: any) => b.count - a.count)
    };
  };

  const dashboardStats = calcularEstatisticas();

  const handleRegistrarPrecoFromDashboard = (codigoPeca: string, descricao: string) => {
    const requisicao = requisicoesComPendentes
      .flatMap(g => g.requisicoes)
      .find(r => r.codigo_peca === codigoPeca && !r.valor_peca);

    if (requisicao) {
      handleRegistrarValor(requisicao);
    }
  };

  const requisicoesAtendidas = requisicoesAgrupadas.filter(g =>
    g.todasAtendidas && g.requisicoes.length > 0
  );

  // HISTÓRICO COMPLETO - Todas as OSs com requisições atendidas ou GI postada (últimas 30 dias)
  const historicoCompleto = requisicoesAgrupadas.filter(g => {
    const temAtendidas = g.requisicoes.some(r =>
      r.status === 'atendida' || r.status === 'gi_postada' || r.status === 'devolvida'
    );
    return temAtendidas;
  }).sort((a, b) => {
    // Ordenar pela data mais recente de qualquer requisição
    const dataA = Math.max(...a.requisicoes.map((r: any) => new Date(r.aprovado_em || r.updated_at || r.created_at).getTime()));
    const dataB = Math.max(...b.requisicoes.map((r: any) => new Date(r.aprovado_em || r.updated_at || r.created_at).getTime()));
    return dataB - dataA;
  });

  // Filtrar histórico com base na busca
  const historicoFiltrado = historicoCompleto.filter(grupo => {
    if (!buscaHistorico.trim()) return true;

    const termoBusca = buscaHistorico.toLowerCase().trim();

    // Buscar no número da OS
    if (grupo.numero_os_samsung?.toLowerCase().includes(termoBusca)) return true;
    if (grupo.numero_os_interna?.toLowerCase().includes(termoBusca)) return true;

    // Buscar nas requisições
    return grupo.requisicoes.some((req: any) => {
      // Buscar no código da peça
      if (req.codigo_peca?.toLowerCase().includes(termoBusca)) return true;

      // Buscar no ID da peça
      if (req.peca_estoque?.id_numerico?.toString().includes(termoBusca)) return true;

      // Buscar no delivery da peça
      if (req.peca_estoque?.estoque_etiquetas?.[0]?.delivery?.toLowerCase().includes(termoBusca)) return true;

      // Buscar em lotes
      if (req.is_lote && req.pecas_lote) {
        return req.pecas_lote.some((peca: any) => {
          if (peca.id_numerico?.toString().includes(termoBusca)) return true;
          if (peca.estoque_etiquetas?.[0]?.delivery?.toLowerCase().includes(termoBusca)) return true;
          return false;
        });
      }

      return false;
    });
  });

  return (
    <div className="space-y-6">
      <EstoqueDashboard
        stats={dashboardStats}
        onRegistrarPreco={handleRegistrarPrecoFromDashboard}
      />

      <div className="bg-[#FFBF00]/10 border border-[#FFBF00]/30 rounded-lg p-6">
        <h4 className="font-semibold text-[#FFBF00] mb-2">Transferências e Requisições de Peças</h4>
        <p className="text-sm text-gray-300 mb-4">
          Aprove requisições, vincule IDs específicos às OSs e acompanhe pedidos em trânsito.
        </p>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div className="bg-[#FFBF00]/10 rounded-lg p-3">
            <p className="text-2xl font-bold text-[#FFBF00]">{requisicoesComPendentes.length}</p>
            <p className="text-xs text-gray-400 uppercase">OSs Aguardando</p>
          </div>
          <div className="bg-[#39FF14]/10 rounded-lg p-3">
            <p className="text-2xl font-bold text-[#39FF14]">{historicoCompleto.length}</p>
            <p className="text-xs text-gray-400 uppercase">Histórico Total</p>
          </div>
          <div className="bg-[#FF0064]/10 rounded-lg p-3">
            <p className="text-2xl font-bold text-[#FF0064]">
              {pedidosAtivos.flatMap(g => g.requisicoes).length}
            </p>
            <p className="text-xs text-gray-400 uppercase">Pedidos Ativos</p>
          </div>
        </div>
      </div>

      {/* BUSCA GERAL */}
      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar por OS, peça, ID, delivery ou nº pedido..."
          value={buscaGeral}
          onChange={(e) => setBuscaGeral(e.target.value)}
          className="w-full pl-10 pr-10 py-2.5 rounded-lg bg-[#1a1a2e] border border-gray-700 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-[#FFBF00]/50 transition-colors"
        />
        {buscaGeral && (
          <button onClick={() => setBuscaGeral('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
      {buscaGeral && (
        <p className="text-xs text-gray-400 mb-3">
          Mostrando {pedidosAtivosFiltrados.flatMap(g => g.requisicoes).length + requisicoesComPendentesFiltradas.length} resultados para "{buscaGeral}"
        </p>
      )}

      {/* PEDIDOS ATIVOS - SEMPRE VISÍVEIS */}
      {pedidosAtivosFiltrados.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-[#FF0064] mb-4 flex items-center gap-2">
            <Package className="w-5 h-5" />
            PEDIDOS ATIVOS ({pedidosAtivosFiltrados.length} OSs - {pedidosAtivosFiltrados.flatMap(g => g.requisicoes).length} peças)
          </h3>
          <div className="bg-[#FF0064]/10 border border-[#FF0064]/30 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-[#FF0064] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm text-[#FF0064] font-semibold mb-1">
                  Pedidos Ativos - Independente da Coluna da OS
                </p>
                <p className="text-xs text-gray-300">
                  Estes pedidos estão ativos independente da posição da OS no Kanban.
                  Peças com pedido ativo estão BLOQUEADAS nas cotações e não podem ser alteradas.
                </p>
              </div>
            </div>
          </div>
          <div className="space-y-3">
            {pedidosAtivosFiltrados.map((grupo) => {
              return (
                <div key={grupo.os_id} className="premium-card border-[#FF0064]/30">
                  <div
                    className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
                    onClick={() => { const k = grupo.os_id ?? `null-${grupo.numero_os_samsung ?? grupo.numero_os_interna ?? 'x'}`; setOsExpandidaPedido(osExpandidaPedido === k ? '' : k); }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {osExpandidaPedido === (grupo.os_id ?? `null-${grupo.numero_os_samsung ?? grupo.numero_os_interna ?? 'x'}`) ? (
                          <ChevronDown className="w-5 h-5 text-[#FF0064]" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-gray-500" />
                        )}
                        <Package className="w-5 h-5 text-[#FF0064]" />
                        <div>
                          <p className="font-bold text-white flex items-center gap-2">
                            OS {grupo.numero_os_samsung || grupo.numero_os_interna || 'N/A'}
                            <button
                              onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(grupo.numero_os_samsung || grupo.numero_os_interna || ''); }}
                              className="p-1 rounded hover:bg-white/10 transition-colors"
                              title="Copiar número da OS"
                            >
                              <Copy className="w-3.5 h-3.5 text-gray-400 hover:text-white" />
                            </button>
                          </p>
                          <p className="text-xs text-gray-400">
                            {grupo.totalPecas} peça(s) com pedido ativo
                          </p>
                        </div>
                      </div>
                      <BadgeTipoOS tipo={grupo.tipo_os} />
                    </div>
                  </div>

                  {osExpandidaPedido === (grupo.os_id ?? `null-${grupo.numero_os_samsung ?? grupo.numero_os_interna ?? 'x'}`) && (
                    <div className="border-t border-gray-800 p-4 space-y-3">
                      {grupo.requisicoes.map((req: any) => (
                        <div key={req.id} className="bg-[#FF0064]/5 border border-[#FF0064]/20 rounded-lg p-4">
                          <div className="flex items-start justify-between mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <p className="font-bold font-mono text-[#00D4FF]">{req.codigo_peca}</p>
                                <span
                                  className="px-2 py-1 rounded text-xs font-bold uppercase"
                                  style={{
                                    backgroundColor: '#FF006420',
                                    borderColor: '#FF0064',
                                    color: '#FF0064',
                                    border: '1px solid'
                                  }}
                                >
                                  BLOQUEADA
                                </span>
                                <span
                                  className="px-2 py-1 rounded text-xs font-bold uppercase"
                                  style={{
                                    backgroundColor: '#FFBF0020',
                                    borderColor: '#FFBF00',
                                    color: '#FFBF00',
                                    border: '1px solid'
                                  }}
                                >
                                  PEDIDO ATIVO
                                </span>
                              </div>
                              <p className="text-xs text-gray-400 mb-2">{req.descricao}</p>
                              <p className="text-xs text-gray-500 mb-2">
                                Qtd: {req.quantidade_requisitada} • IDs disponíveis: {req.ids_disponiveis_count || 0}
                              </p>
                              {req.valor_peca && (
                                <p className="text-xs text-gray-400 mb-3 flex items-center gap-1">
                                  <DollarSign className="w-3 h-3 text-[#39FF14]" />
                                  <span className="text-[#39FF14] font-bold">Valor GSPN: R$ {Number(req.valor_peca).toFixed(2)}</span>
                                  {(() => {
                                    const osPecaValor = req.os?.os_pecas?.find((p: any) => p.pn === req.codigo_peca)?.valor_gspn;
                                    if (osPecaValor && Math.abs(Number(osPecaValor) - Number(req.valor_peca)) > 0.01) {
                                      return (
                                        <span className="ml-2 flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/20 border border-red-500/40 text-red-400 text-[10px] font-bold">
                                          <AlertTriangle className="w-3 h-3" />
                                          OS: R$ {Number(osPecaValor).toFixed(2)} - DIVERGENTE
                                        </span>
                                      );
                                    }
                                    return null;
                                  })()}
                                </p>
                              )}
                              {req.observacoes_pedido && (
                                <div className="bg-gray-900/50 rounded-lg p-3 mb-3">
                                  <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Observações do Pedido:</p>
                                  <p className="text-sm text-gray-300">{req.observacoes_pedido}</p>
                                </div>
                              )}
                              <p className="text-xs text-gray-500">
                                Pedido feito em: {new Date(req.updated_at || req.created_at).toLocaleString('pt-BR')}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 flex-wrap">
                            {req.ids_disponiveis_count > 0 && (
                              <button
                                onClick={() => handleAprovarRequisicao(req)}
                                className="neon-button text-xs px-4 py-2"
                                style={{
                                  backgroundColor: '#39FF1420',
                                  color: '#39FF14',
                                  borderColor: '#39FF1460'
                                }}
                              >
                                APROVAR
                              </button>
                            )}
                            <button
                              onClick={() => handleReprovarRequisicao(req)}
                              className="neon-button text-xs px-4 py-2"
                              style={{
                                backgroundColor: '#FF006410',
                                color: '#FF0064',
                                borderColor: '#FF006460'
                              }}
                            >
                              REPROVAR
                            </button>
                            <button
                              onClick={() => setModalVerPedido(req)}
                              className="neon-button flex items-center gap-2 text-xs px-4 py-2"
                              style={{
                                backgroundColor: 'rgba(var(--accent-rgb), 0.063)',
                                borderColor: 'var(--text-accent)',
                                color: 'var(--text-accent)'
                              }}
                            >
                              <Package className="w-4 h-4" />
                              VER DETALHES DO PEDIDO
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* REQUISIÇÕES PENDENTES */}
      {requisicoesComPendentesFiltradas.length > 0 && (
        <div>
          <h3 className="text-lg font-bold text-[#FFBF00] mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            REQUISIÇÕES PENDENTES ({requisicoesComPendentesFiltradas.length} OSs)
          </h3>
          <div className="space-y-3">
            {requisicoesComPendentesFiltradas.map((grupo) => (
              <div key={grupo.os_id} className="premium-card">
                <div
                  className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => { const k = grupo.os_id ?? `null-${grupo.numero_os_samsung ?? grupo.numero_os_interna ?? 'x'}`; setOsExpandida(osExpandida === k ? '' : k); }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {osExpandida === (grupo.os_id ?? `null-${grupo.numero_os_samsung ?? grupo.numero_os_interna ?? 'x'}`) ? (
                        <ChevronDown className="w-5 h-5 text-[#00D4FF]" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-500" />
                      )}
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold text-gray-200">
                            OS: {grupo.numero_os_samsung || grupo.numero_os_interna || 'N/A'}
                          </p>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(grupo.numero_os_samsung || grupo.numero_os_interna || ''); }}
                            className="p-1 rounded hover:bg-white/10 transition-colors"
                            title="Copiar número da OS"
                          >
                            <Copy className="w-3.5 h-3.5 text-gray-400 hover:text-white" />
                          </button>
                          <BadgeTipoOS tipo={grupo.tipo_os} />
                        </div>
                        <div className="flex items-center gap-3 mt-1">
                          <span className="text-xs text-gray-500">
                            {grupo.totalPecas} peça(s)
                          </span>
                          <span className="text-xs text-[#39FF14] font-bold">
                            R$ {grupo.valorTotal.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {grupo.algunsAtendidas && !grupo.todasAtendidas && (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                          PARCIAL
                        </span>
                      )}
                      <span className="px-3 py-1 rounded-full text-xs font-bold bg-[#FFBF00]/20 text-[#FFBF00] border border-[#FFBF00]/30">
                        {grupo.requisicoes.filter(r => r.status === 'pendente').length} PENDENTE(S)
                      </span>
                    </div>
                  </div>
                </div>

                {osExpandida === (grupo.os_id ?? `null-${grupo.numero_os_samsung ?? grupo.numero_os_interna ?? 'x'}`) && (
                  <div className="border-t border-[#00D4FF]/20 p-4 space-y-3">
                    {grupo.requisicoes.map((req) => (
                      <div key={req.id} className="bg-black/30 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <p className="font-bold font-mono text-[#00D4FF]">{req.codigo_peca}</p>
                              {getStatusBadge(req.status)}
                            </div>
                            <p className="text-xs text-gray-400 mb-1">{req.descricao}</p>
                            <div className="text-xs text-gray-400 space-y-1">
                              <p>Quantidade: <span className="text-[#39FF14]">{req.quantidade_requisitada}</span></p>
                              {req.peca_estoque && (
                                <div>
                                  {req.is_lote && req.pecas_lote && req.pecas_lote.length > 0 ? (
                                    <div className="space-y-1">
                                      <p className="font-semibold text-[#39FF14]">Lote com {req.pecas_lote.length} peça(s):</p>
                                      {req.pecas_lote.map((peca: any, idx: number) => (
                                        <p key={peca.id} className="text-xs ml-2">
                                          #{idx + 1} - ID: <span className="font-mono text-[#39FF14]">#{peca.id_numerico}</span>
                                          <span className="text-gray-400"> • Delivery: <span className="text-gray-300">{peca.estoque_etiquetas?.[0]?.delivery || 'N/A'}</span></span>
                                          {' - '}R$ {Number(peca.valor_com_impostos).toFixed(2)}
                                        </p>
                                      ))}
                                      <p className="font-semibold text-[#39FF14] mt-1">
                                        Total: R$ {req.pecas_lote.reduce((sum: number, p: any) => sum + Number(p.valor_com_impostos), 0).toFixed(2)}
                                      </p>
                                    </div>
                                  ) : (
                                    <p>
                                      ID Vinculado: <span className="font-mono text-[#39FF14]">#{req.peca_estoque.id_numerico}</span>
                                      <span className="text-gray-400"> • Delivery: <span className="text-gray-300">{req.peca_estoque.estoque_etiquetas?.[0]?.delivery || 'N/A'}</span></span>
                                      {' - '}R$ {Number(req.peca_estoque.valor_com_impostos).toFixed(2)}
                                    </p>
                                  )}
                                </div>
                              )}
                              {req.valor_peca && (
                                <p className="flex items-center gap-1 flex-wrap">
                                  <DollarSign className="w-3 h-3 text-[#39FF14]" />
                                  <span className="text-[#39FF14] font-bold">Valor GSPN: R$ {Number(req.valor_peca).toFixed(2)}</span>
                                  {(() => {
                                    const osPecaValor = req.os?.os_pecas?.find((p: any) => p.pn === req.codigo_peca)?.valor_gspn;
                                    if (osPecaValor && Math.abs(Number(osPecaValor) - Number(req.valor_peca)) > 0.01) {
                                      return (
                                        <span className="ml-2 flex items-center gap-1 px-2 py-0.5 rounded bg-red-500/20 border border-red-500/40 text-red-400 text-[10px] font-bold">
                                          <AlertTriangle className="w-3 h-3" />
                                          OS: R$ {Number(osPecaValor).toFixed(2)} - DIVERGENTE
                                        </span>
                                      );
                                    }
                                    return null;
                                  })()}
                                </p>
                              )}
                            </div>
                            {req.observacoes_pedido && (
                              <div className="bg-gray-900/50 rounded-lg p-3 mt-3">
                                <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Observações do Pedido:</p>
                                <p className="text-sm text-gray-300">{req.observacoes_pedido}</p>
                              </div>
                            )}
                            {req.numero_pedido_samsung && req.numero_pedido_samsung !== 'N/A' && !req.numero_pedido_samsung.startsWith('PENDENTE-') && (
                              <div className="bg-blue-900/20 rounded-lg p-3 mt-3 border border-blue-500/30">
                                <p className="text-xs text-blue-400 uppercase font-semibold mb-1">Pedido Samsung:</p>
                                <p className="text-sm text-gray-300">{req.numero_pedido_samsung}</p>
                              </div>
                            )}
                            {req.status === 'reprovada' && req.motivo_reprovacao && (
                              <div className="mt-3 p-3 rounded-lg" style={{
                                backgroundColor: '#FF006410',
                                border: '1px solid #FF006460'
                              }}>
                                <div className="flex items-start gap-2">
                                  <AlertCircle className="w-4 h-4 text-[#FF0064] flex-shrink-0 mt-0.5" />
                                  <div className="flex-1">
                                    <p className="text-xs font-bold text-[#FF0064] mb-1">MOTIVO DA REPROVAÇÃO:</p>
                                    <p className="text-xs text-gray-300">{req.motivo_reprovacao}</p>
                                    {req.reprovado_por_usuario && req.reprovado_em && (
                                      <p className="text-xs text-gray-500 mt-2">
                                        Reprovado por {req.reprovado_por_usuario.nome} em{' '}
                                        {new Date(req.reprovado_em).toLocaleString('pt-BR', {
                                          day: '2-digit',
                                          month: '2-digit',
                                          year: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                          {req.status === 'pedido_feito' && (
                            <div className="flex items-center gap-2 ml-3">
                              <button
                                onClick={() => handleVerPedido(req)}
                                className="neon-button text-xs px-4 py-2"
                                style={{
                                  backgroundColor: 'rgba(var(--accent-rgb), 0.125)',
                                  color: 'var(--text-accent)',
                                  borderColor: 'rgba(var(--accent-rgb), 0.38)'
                                }}
                              >
                                VER PEDIDO
                              </button>
                              <button
                                onClick={() => handleRefazerPedido(req)}
                                className="neon-button text-xs px-4 py-2"
                                style={{
                                  backgroundColor: '#FFBF0020',
                                  color: '#FFBF00',
                                  borderColor: '#FFBF0060'
                                }}
                              >
                                REFAZER PEDIDO
                              </button>
                            </div>
                          )}
                          {req.status === 'pendente' && (
                            <div className="flex items-center gap-2 ml-3 flex-wrap">
                              {req.ids_disponiveis_count > 0 ? (
                                <>
                                  <button
                                    onClick={() => handleAprovarRequisicao(req)}
                                    className="neon-button text-xs px-4 py-2 font-bold"
                                    style={{
                                      backgroundColor: '#39FF1420',
                                      color: '#39FF14',
                                      borderColor: '#39FF1460'
                                    }}
                                    title={`${req.ids_disponiveis_count} ID(s) disponível(eis) no estoque`}
                                  >
                                    <CheckCircle className="w-4 h-4 inline mr-1" />
                                    APROVAR ({req.ids_disponiveis_count} ID{req.ids_disponiveis_count > 1 ? 's' : ''})
                                  </button>
                                  <button
                                    onClick={() => handleReprovarRequisicao(req)}
                                    className="neon-button text-xs px-4 py-2"
                                    style={{
                                      backgroundColor: '#FF006420',
                                      color: '#FF0064',
                                      borderColor: '#FF006460'
                                    }}
                                  >
                                    <XCircle className="w-4 h-4 inline mr-1" />
                                    REJEITAR
                                  </button>
                                  <button
                                    onClick={() => handleRegistrarValor(req)}
                                    className="neon-button text-xs px-4 py-2"
                                    style={{
                                      backgroundColor: '#FFBF0020',
                                      color: '#FFBF00',
                                      borderColor: '#FFBF0060'
                                    }}
                                  >
                                    REGISTRAR VALOR GSPN
                                  </button>
                                </>
                              ) : (
                                <>
                                  {req.numero_pedido_samsung && req.numero_pedido_samsung !== 'N/A' && !req.numero_pedido_samsung.startsWith('PENDENTE-') && (
                                    <button
                                      onClick={() => handleVerPedido(req)}
                                      className="neon-button text-xs px-4 py-2"
                                      style={{
                                        backgroundColor: 'rgba(var(--accent-rgb), 0.125)',
                                        color: 'var(--text-accent)',
                                        borderColor: 'rgba(var(--accent-rgb), 0.38)'
                                      }}
                                    >
                                      VER PEDIDO
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleRegistrarValor(req)}
                                    className="neon-button text-xs px-4 py-2"
                                    style={{
                                      backgroundColor: '#FFBF0020',
                                      color: '#FFBF00',
                                      borderColor: '#FFBF0060'
                                    }}
                                  >
                                    REGISTRAR VALOR GSPN
                                  </button>
                                  {req.valor_peca && (
                                    <button
                                      onClick={() => handlePedirPeca(req)}
                                      className="neon-button text-xs px-4 py-2"
                                      style={{
                                        backgroundColor: 'rgba(var(--accent-rgb), 0.125)',
                                        color: 'var(--text-accent)',
                                        borderColor: 'rgba(var(--accent-rgb), 0.38)'
                                      }}
                                    >
                                      CRIAR PEDIDO
                                    </button>
                                  )}
                                  <button
                                    onClick={() => handleReprovarRequisicao(req)}
                                    className="neon-button text-xs px-4 py-2"
                                    style={{
                                      backgroundColor: '#FF006420',
                                      color: '#FF0064',
                                      borderColor: '#FF006460'
                                    }}
                                  >
                                    <XCircle className="w-4 h-4 inline mr-1" />
                                    REJEITAR
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* HISTÓRICO COMPLETO DE TRANSFERÊNCIAS */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-[#39FF14] flex items-center gap-2">
            <Check className="w-5 h-5" />
            HISTÓRICO DE TRANSFERÊNCIAS ({historicoCompleto.length} OSs)
          </h3>
          <button
            onClick={() => setHistoricoMinimizado(!historicoMinimizado)}
            className="neon-button px-4 py-2 flex items-center gap-2"
            style={{
              backgroundColor: '#39FF1410',
              color: '#39FF14',
              borderColor: '#39FF1460'
            }}
          >
            {historicoMinimizado ? (
              <>
                <Maximize2 className="w-4 h-4" />
                MAXIMIZAR
              </>
            ) : (
              <>
                <Minimize2 className="w-4 h-4" />
                MINIMIZAR
              </>
            )}
          </button>
        </div>

        {!historicoMinimizado && (
          <>
            <div className="bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-2">
                <AlertCircle className="w-5 h-5 text-[#39FF14] flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm text-[#39FF14] font-semibold mb-1">
                    Histórico Completo de Transferências
                  </p>
                  <p className="text-xs text-gray-300">
                    Todas as requisições atendidas, GI postadas e devoluções, ordenadas da mais recente para a mais antiga. Mostrando até 1000 registros mais recentes.
                  </p>
                </div>
              </div>
            </div>

            {/* Campo de busca */}
            <div className="premium-card p-4 mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={buscaHistorico}
                  onChange={(e) => setBuscaHistorico(e.target.value)}
                  placeholder="Buscar por OS, Delivery, ID, Código..."
                  className="w-full pl-10 pr-4 py-3 bg-black/30 border border-[#39FF14]/30 rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#39FF14] transition-colors"
                />
                {buscaHistorico && (
                  <button
                    onClick={() => setBuscaHistorico('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-[#39FF14] transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              {buscaHistorico && (
                <p className="text-xs text-gray-400 mt-2">
                  Mostrando {historicoFiltrado.length} de {historicoCompleto.length} OSs
                </p>
              )}
            </div>
          </>
        )}

        {!historicoMinimizado && historicoCompleto.length > 0 ? (
          <div className="space-y-3">
            {historicoFiltrado.map((grupo) => (
              <div key={grupo.os_id} className="premium-card border-[#39FF14]/30">
                <div
                  className="p-4 cursor-pointer hover:bg-white/5 transition-colors"
                  onClick={() => { const k = grupo.os_id ?? `null-${grupo.numero_os_samsung ?? grupo.numero_os_interna ?? 'x'}`; setOsExpandidaAtendida(osExpandidaAtendida === k ? '' : k); }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {osExpandidaAtendida === (grupo.os_id ?? `null-${grupo.numero_os_samsung ?? grupo.numero_os_interna ?? 'x'}`) ? (
                        <ChevronDown className="w-5 h-5 text-[#39FF14]" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-500" />
                      )}
                      <Check className="w-5 h-5 text-[#39FF14]" />
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold text-white">
                            OS {grupo.numero_os_samsung || grupo.numero_os_interna || 'N/A'}
                          </p>
                          <button
                            onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(grupo.numero_os_samsung || grupo.numero_os_interna || ''); }}
                            className="p-1 rounded hover:bg-white/10 transition-colors"
                            title="Copiar número da OS"
                          >
                            <Copy className="w-3.5 h-3.5 text-gray-400 hover:text-white" />
                          </button>
                          <BadgeTipoOS tipo={grupo.tipo_os} />
                        </div>
                        <p className="text-xs text-gray-400">
                          {grupo.requisicoes.filter((r: any) => r.status === 'atendida' || r.status === 'gi_postada' || r.status === 'devolvida').length} peça(s) no histórico
                        </p>
                      </div>
                    </div>
                    {grupo.valorTotal > 0 && (
                      <div className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4 text-[#39FF14]" />
                        <p className="text-lg text-[#39FF14] font-bold">
                          R$ {grupo.valorTotal.toFixed(2)}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {osExpandidaAtendida === (grupo.os_id ?? `null-${grupo.numero_os_samsung ?? grupo.numero_os_interna ?? 'x'}`) && (
                  <div className="border-t border-[#39FF14]/20 p-4 space-y-3">
                    {grupo.requisicoes
                      .filter((req: any) => req.status === 'atendida' || req.status === 'gi_postada' || req.status === 'devolvida')
                      .sort((a: any, b: any) => {
                        const dataA = new Date(a.aprovado_em || a.updated_at || a.created_at).getTime();
                        const dataB = new Date(b.aprovado_em || b.updated_at || b.created_at).getTime();
                        return dataB - dataA;
                      })
                      .map((req: any) => (
                      <div key={req.id} className="bg-[#39FF14]/5 border border-[#39FF14]/20 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <p className="font-bold font-mono text-[#00D4FF]">{req.codigo_peca}</p>
                              {getStatusBadge(req.status)}
                            </div>
                            <p className="text-xs text-gray-400 mb-2">{req.descricao}</p>
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-gray-400">Quantidade:</span>
                                <span className="text-[#39FF14] font-bold">{req.quantidade_requisitada}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-400">Requisição ID:</span>
                                <span className="font-mono text-gray-300">{req.id.slice(0, 8)}</span>
                              </div>
                              {req.peca_estoque && (
                                <div className="bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-lg p-3 mt-2">
                                  <p className="text-xs text-[#39FF14] font-bold uppercase mb-2">
                                    {req.is_lote && req.pecas_lote && req.pecas_lote.length > 0 ? `Lote com ${req.pecas_lote.length} Peça(s)` : 'Peça Vinculada'}
                                  </p>
                                  {req.is_lote && req.pecas_lote && req.pecas_lote.length > 0 ? (
                                    <div className="space-y-3">
                                      {req.pecas_lote.map((peca: any, idx: number) => (
                                        <div key={peca.id} className="border-l-2 border-[#39FF14]/50 pl-3 space-y-1">
                                          <p className="text-xs text-[#39FF14] font-semibold">Peça #{idx + 1}</p>
                                          <div className="flex items-center gap-2">
                                            <span className="text-gray-400 text-xs">ID:</span>
                                            <span className="font-mono text-[#39FF14] font-bold">#{peca.id_numerico}</span>
                                          </div>
                                          {peca.pn && (
                                            <div className="flex items-center gap-2">
                                              <span className="text-gray-400 text-xs">PN:</span>
                                              <span className="font-mono text-gray-300 text-xs">{peca.pn}</span>
                                            </div>
                                          )}
                                          <div className="flex items-center gap-2">
                                            <span className="text-gray-400 text-xs">Delivery:</span>
                                            <span className="text-gray-300 text-xs">{peca.estoque_etiquetas?.[0]?.delivery || 'N/A'}</span>
                                          </div>
                                          {peca.valor_com_impostos && (
                                            <div className="flex items-center gap-2">
                                              <span className="text-gray-400 text-xs">Valor:</span>
                                              <span className="text-[#39FF14] font-bold text-xs">
                                                R$ {Number(peca.valor_com_impostos).toFixed(2)}
                                              </span>
                                            </div>
                                          )}
                                        </div>
                                      ))}
                                      <div className="pt-2 border-t border-[#39FF14]/30">
                                        <div className="flex items-center justify-between">
                                          <span className="text-gray-400 text-xs font-semibold">VALOR TOTAL:</span>
                                          <span className="text-[#39FF14] font-bold text-sm">
                                            R$ {req.pecas_lote.reduce((sum: number, p: any) => sum + Number(p.valor_com_impostos), 0).toFixed(2)}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2">
                                        <span className="text-gray-400 text-xs">ID da Peça:</span>
                                        <span className="font-mono text-[#39FF14] font-bold">#{req.peca_estoque.id_numerico}</span>
                                      </div>
                                      {req.peca_estoque.pn && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-gray-400 text-xs">PN:</span>
                                          <span className="font-mono text-gray-300 text-xs">{req.peca_estoque.pn}</span>
                                        </div>
                                      )}
                                      <div className="flex items-center gap-2">
                                        <span className="text-gray-400 text-xs">Delivery:</span>
                                        <span className="text-gray-300 text-xs">{req.peca_estoque.estoque_etiquetas?.[0]?.delivery || 'N/A'}</span>
                                      </div>
                                      {req.peca_estoque.valor_com_impostos && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-gray-400 text-xs">Valor:</span>
                                          <span className="text-[#39FF14] font-bold text-xs">
                                            R$ {Number(req.peca_estoque.valor_com_impostos).toFixed(2)}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                              {req.numero_pedido_samsung && req.numero_pedido_samsung !== 'N/A' && !req.numero_pedido_samsung.startsWith('PENDENTE-') && (
                                <div className="bg-blue-900/20 rounded-lg p-3 mt-2 border border-blue-500/30">
                                  <p className="text-xs text-blue-400 uppercase font-semibold mb-1">Pedido Samsung:</p>
                                  <p className="text-sm text-gray-300 font-mono">{req.numero_pedido_samsung}</p>
                                </div>
                              )}
                              {req.observacoes_pedido && (
                                <div className="bg-gray-900/50 rounded-lg p-3 mt-2">
                                  <p className="text-xs text-gray-400 uppercase font-semibold mb-1">Observações do Pedido:</p>
                                  <p className="text-sm text-gray-300">{req.observacoes_pedido}</p>
                                </div>
                              )}
                              <div className="flex items-center gap-2 text-xs text-gray-500 mt-3">
                                <Clock className="w-3 h-3" />
                                <span>Atendida em: {new Date(req.aprovado_em || req.updated_at).toLocaleString('pt-BR')}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {historicoFiltrado.length === 0 && buscaHistorico && (
              <div className="premium-card border-[#FFBF00]/30">
                <div className="p-8 text-center">
                  <Search className="w-12 h-12 text-[#FFBF00] mx-auto mb-4" />
                  <p className="text-[#FFBF00] mb-2 font-semibold">Nenhum resultado encontrado</p>
                  <p className="text-xs text-gray-400">
                    Não encontramos transferências que correspondam aos critérios "{buscaHistorico}".
                  </p>
                  <button
                    onClick={() => setBuscaHistorico('')}
                    className="neon-button mt-4 px-4 py-2"
                    style={{
                      backgroundColor: '#FFBF0020',
                      color: '#FFBF00',
                      borderColor: '#FFBF0060'
                    }}
                  >
                    LIMPAR BUSCA
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : !historicoMinimizado ? (
          <div className="premium-card border-gray-700">
            <div className="p-8 text-center">
              <AlertTriangle className="w-12 h-12 text-gray-500 mx-auto mb-4" />
              <p className="text-gray-400 mb-2">Nenhuma transferência no histórico</p>
              <p className="text-xs text-gray-500">
                As transferências atendidas, GI postadas e devoluções aparecerão aqui.
              </p>
            </div>
          </div>
        ) : null}
      </div>

      {/* Modais */}
      {modalSelecionarID && (
        <ModalSelecionarID
          requisicao={modalSelecionarID}
          onConfirm={(pecaId) => handleConfirmarTransferencia(modalSelecionarID.id, pecaId)}
          onConfirmMultiple={(pecaIds) => handleConfirmarTransferenciaMultipla(modalSelecionarID.id, pecaIds)}
          onCancel={() => setModalSelecionarID(null)}
          onRegistrarValor={() => {
            handleRegistrarValor(modalSelecionarID);
            setModalSelecionarID(null);
          }}
          onPedirPeca={() => {
            if (modalSelecionarID.ids_disponiveis_count > 0) {
              handlePedirPecaComEstoque(modalSelecionarID);
            } else {
              handlePedirPeca(modalSelecionarID);
            }
            setModalSelecionarID(null);
          }}
        />
      )}

      {modalRegistrarValor && (
        <ModalRegistrarValorGSPN
          requisicao={modalRegistrarValor}
          onConfirm={handleConfirmarValor}
          onCancel={() => setModalRegistrarValor(null)}
        />
      )}

      {modalPedirPeca && (
        <ModalPedirPeca
          requisicao={modalPedirPeca}
          onConfirm={(dados) => handleConfirmarPedido(modalPedirPeca.id, dados)}
          onCancel={() => setModalPedirPeca(null)}
        />
      )}

      {modalJustificativa && (
        <ModalJustificativaPedido
          requisicao={modalJustificativa}
          idsDisponiveis={modalJustificativa.ids_disponiveis_count}
          onConfirm={handleConfirmarPedidoComJustificativa}
          onCancel={() => setModalJustificativa(null)}
        />
      )}

      {modalVerPedido && createPortal(
        <div
          className="fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: 9999, backgroundColor: 'rgba(0,0,0,0.8)' }}
          onClick={(e) => { if (e.target === e.currentTarget) setModalVerPedido(null); }}
        >
          <div className="premium-card max-w-2xl w-full">
            <div className="border-b border-[#00D4FF]/20 p-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-[#00D4FF] flex items-center gap-2">
                <Package className="w-6 h-6" />
                Detalhes do Pedido
              </h2>
              <button onClick={() => setModalVerPedido(null)} className="p-2 hover:bg-[#00D4FF]/10 rounded-lg transition-colors">
                <X className="w-5 h-5 text-[#00D4FF]" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-[#00D4FF]/10 border border-[#00D4FF]/30 rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase">Descrição</p>
                  <p className="text-sm text-gray-200 font-medium">{modalVerPedido.descricao}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Part Number</p>
                    <p className="text-sm text-gray-200 font-mono">{modalVerPedido.codigo_peca}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Quantidade</p>
                    <p className="text-sm text-gray-200">{modalVerPedido.quantidade_requisitada}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Valor GSPN</p>
                    <p className="text-sm text-[#39FF14] font-bold">R$ {Number(modalVerPedido.valor_peca || 0).toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Número do Pedido</p>
                    <p className="text-sm text-[#00D4FF] font-mono">{modalVerPedido.numero_pedido_samsung}</p>
                  </div>
                </div>
                {modalVerPedido.observacoes_pedido && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Observações</p>
                    <p className="text-sm text-gray-300 whitespace-pre-wrap">{modalVerPedido.observacoes_pedido}</p>
                  </div>
                )}
                {modalVerPedido.previsao_entrega && (
                  <div>
                    <p className="text-xs text-gray-500 uppercase">Previsão de Entrega</p>
                    <p className="text-sm text-gray-200">{new Date(modalVerPedido.previsao_entrega).toLocaleDateString('pt-BR')}</p>
                  </div>
                )}
              </div>

              <button
                onClick={() => setModalVerPedido(null)}
                className="neon-button w-full py-3"
                style={{
                  backgroundColor: 'rgba(var(--accent-rgb), 0.125)',
                  color: 'var(--text-accent)',
                  borderColor: 'rgba(var(--accent-rgb), 0.38)'
                }}
              >
                FECHAR
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
