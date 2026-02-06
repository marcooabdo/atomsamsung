import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { UnitFilter } from '../components/UnitFilter';
import {
  Plus,
  Search,
  Edit,
  Send,
  CheckCircle,
  XCircle,
  RefreshCw,
  FileText,
  Clock,
  Activity,
  MessageSquare,
  MoreVertical,
  ThumbsUp,
  ThumbsDown,
  AlertTriangle,
  Microscope,
  Copy,
  Check
} from 'lucide-react';
import type { Database } from '../lib/database.types';
import { CotacaoModal } from '../components/CotacaoModal';

type Cotacao = Database['public']['Tables']['cotacoes']['Row'] & {
  valor_calculado?: number;
  valor_pago?: number;
  saldo_restante?: number;
};

export function Cotacoes() {
  const { usuario, user } = useAuth();
  const [cotacoes, setCotacoes] = useState<Cotacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [showModal, setShowModal] = useState(false);
  const [unidades, setUnidades] = useState<Array<{id: string; nome: string}>>([]);
  const [selectedUnidade, setSelectedUnidade] = useState('');
  const [menuAberto, setMenuAberto] = useState<string | null>(null);
  const [editandoCotacaoId, setEditandoCotacaoId] = useState<string | null>(null);
  const [showComentarioModal, setShowComentarioModal] = useState(false);
  const [cotacaoSelecionada, setCotacaoSelecionada] = useState<string | null>(null);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [whatsAppCotacao, setWhatsAppCotacao] = useState<Cotacao | null>(null);
  const [whatsAppPecas, setWhatsAppPecas] = useState<Array<{pn: string; descricao: string; quantidade: number; valor_final_unitario: number}>>([]);
  const [textoCopied, setTextoCopied] = useState(false);

  useEffect(() => {
    loadUnidades();
  }, []);

  useEffect(() => {
    if (user) {
      if (user.unidade_id) {
        setSelectedUnidade(user.unidade_id);
      }
      loadCotacoes();
    }
  }, [user, statusFilter, selectedUnidade]);

  const loadUnidades = async () => {
    const { data } = await supabase.from('unidades').select('id, nome').order('nome');
    setUnidades(data || []);
  };

  const loadCotacoes = async () => {
    try {
      const unidadeFilter = selectedUnidade || (user?.unidade_id || null);
      const canSeeAllUnits = (user?.tipo === 'master' || user?.tipo === 'diretoria') && !user?.unidade_id;

      let query = supabase
        .from('cotacoes')
        .select('*')
        .in('status', ['pendente_preenchimento', 'enviada', 'reprovada'])
        .order('created_at', { ascending: false });

      if (!canSeeAllUnits && unidadeFilter) {
        query = query.eq('unidade_id', unidadeFilter);
      } else if (selectedUnidade) {
        query = query.eq('unidade_id', selectedUnidade);
      }

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      const { data, error } = await query;

      if (error) throw error;

      // Calcular valor total de cada cotação e filtrar as que já possuem OS
      const cotacoesComValor = await Promise.all(
        (data || []).map(async (cotacao) => {
          // Verificar se já existe uma OS para esta cotação (filtro de unidade para seguranca)
          const { data: osExistente } = await supabase
            .from('os')
            .select('id')
            .eq('cotacao_id', cotacao.id)
            .eq('unidade_id', cotacao.unidade_id)
            .maybeSingle();

          // Se já existe OS vinculada, não mostrar na aba Cotações (ela deve estar no Kanban)
          if (osExistente) {
            return null;
          }

          const { data: pecas } = await supabase
            .from('cotacoes_pecas')
            .select('valor_total')
            .eq('cotacao_id', cotacao.id);

          const { data: servicos } = await supabase
            .from('cotacoes_servicos')
            .select('valor_total')
            .eq('cotacao_id', cotacao.id);

          const valorPecas = (pecas || []).reduce((sum, p) => sum + (p.valor_total || 0), 0);
          const valorServicos = (servicos || []).reduce((sum, s) => sum + (s.valor_total || 0), 0);
          const subtotal = valorPecas + valorServicos;

          // Calcular desconto
          let desconto = 0;
          if (cotacao.desconto_valor) {
            if (cotacao.desconto_tipo === 'percentual') {
              desconto = subtotal * (cotacao.desconto_valor / 100);
            } else {
              desconto = cotacao.desconto_valor;
            }
          }

          const valorTotal = Math.round((subtotal - desconto) * 100) / 100;

          // Buscar pagamentos da cotação
          const { data: pagamentos } = await supabase
            .from('pagamentos')
            .select('valor_bruto, valor')
            .eq('cotacao_id', cotacao.id);

          const valorPago = (pagamentos || []).reduce((sum, p) => sum + (p.valor_bruto || p.valor || 0), 0);
          const saldoRestante = valorTotal - valorPago;

          return {
            ...cotacao,
            valor_calculado: valorTotal,
            valor_pago: valorPago,
            saldo_restante: saldoRestante,
            os_vinculada: null
          };
        })
      );

      // Filtrar valores null (cotações que já possuem OS)
      const cotacoesValidas = cotacoesComValor.filter(c => c !== null);

      setCotacoes(cotacoesValidas);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleNovaCotacao = () => {
    setEditandoCotacaoId(null);
    setShowModal(true);
  };

  const handleModalSave = () => {
    setEditandoCotacaoId(null);
    setShowComentarioModal(false);
    loadCotacoes();
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setShowComentarioModal(false);
    setEditandoCotacaoId(null);
    setCotacaoSelecionada(null);
  };

  const handleEditarCotacao = (id: string) => {
    setEditandoCotacaoId(id);
    setShowModal(true);
  };


  const handleFazerCotacao = (id: string) => {
    alert(`Fazer cotação ${id} - Modal de preenchimento será implementado`);
  };

  const handleRefazerCotacao = (id: string) => {
    setEditandoCotacaoId(id);
    setShowModal(true);
  };

  const handleAprovarCotacao = async (id: string) => {
    try {
      // Busca dados da cotação
      const { data: cotacao, error: fetchError } = await supabase
        .from('cotacoes')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) {
        alert(`Erro ao buscar cotação: ${fetchError.message}`);
        return;
      }

      if (!cotacao) {
        alert('Cotação não encontrada');
        return;
      }

      // Validação específica para OS IH: cidade obrigatória
      if (cotacao.tipo_atendimento === 'IH' && !cotacao.cliente_cidade?.trim()) {
        alert('Não é possível aprovar esta cotação!\n\nPara OS do tipo IH (In-Home), a cidade do cliente é obrigatória para o sistema de roteamento automático.\n\nEdite a cotação e adicione a cidade antes de aprovar.');
        return;
      }

      // Verifica se já existe uma OS para esta cotação
      const { data: osExistente } = await supabase
        .from('os')
        .select('id')
        .eq('cotacao_id', id)
        .maybeSingle();

      if (osExistente) {
        alert('Esta cotação já foi aprovada e possui uma OS criada!');
        return;
      }

      // Verifica se já existe uma OS com este número Samsung NA MESMA UNIDADE
      if (cotacao.numero_os_samsung?.trim()) {
        const { data: osComMesmoNumero, error: checkError } = await supabase
          .from('os')
          .select('id, numero_os_samsung, cliente_nome, coluna_kanban')
          .eq('numero_os_samsung', cotacao.numero_os_samsung)
          .eq('unidade_id', cotacao.unidade_id)
          .maybeSingle();

        if (checkError) {
          alert(`Erro ao verificar numero Samsung: ${checkError.message}`);
          return;
        }

        if (osComMesmoNumero) {
          alert(`Ja existe uma OS com o numero Samsung "${cotacao.numero_os_samsung}"!\n\nOS ID: ${osComMesmoNumero.id}\nCliente: ${osComMesmoNumero.cliente_nome}\nStatus: ${osComMesmoNumero.coluna_kanban}\n\nEdite a cotacao e altere o numero da OS Samsung antes de aprovar, ou delete a OS duplicada no Kanban.`);
          return;
        }
      }
      // Campo numero_os_samsung é opcional - permite aprovar cotações sem número Samsung

      // Calcula valor total da cotação
      const { data: pecas } = await supabase
        .from('cotacoes_pecas')
        .select('valor_total')
        .eq('cotacao_id', id);

      const { data: servicos } = await supabase
        .from('cotacoes_servicos')
        .select('valor_total')
        .eq('cotacao_id', id);

      const valorPecas = (pecas || []).reduce((sum, p) => sum + (p.valor_total || 0), 0);
      const valorServicos = (servicos || []).reduce((sum, s) => sum + (s.valor_total || 0), 0);
      const subtotal = valorPecas + valorServicos;

      // Calcular desconto
      let desconto = 0;
      if (cotacao.desconto_valor) {
        if (cotacao.desconto_tipo === 'percentual') {
          desconto = subtotal * (cotacao.desconto_valor / 100);
        } else {
          desconto = cotacao.desconto_valor;
        }
      }

      const valorTotal = Math.round((subtotal - desconto) * 100) / 100;

      // Cria OS com status aprovado
      const { data: os, error: osError } = await supabase
        .from('os')
        .insert({
          numero_os_samsung: cotacao.numero_os_samsung?.trim() || null,
          cotacao_id: cotacao.id,
          tipo_atendimento: cotacao.tipo_atendimento || 'CI',
          tipo_os: cotacao.tipo_os || 'LP',
          tipo_orcamento: cotacao.tipo_orcamento,
          unidade_id: cotacao.unidade_id,
          coluna_kanban: 'orcamento_aprovado',
          cliente_nome: cotacao.cliente_nome,
          cliente_cpf_cnpj: cotacao.cliente_cpf_cnpj,
          cliente_telefone: cotacao.cliente_telefone,
          cliente_email: cotacao.cliente_email,
          cliente_endereco: cotacao.cliente_endereco,
          cliente_cep: cotacao.cliente_cep,
          cliente_logradouro: cotacao.cliente_logradouro,
          cliente_numero: cotacao.cliente_numero,
          cliente_complemento: cotacao.cliente_complemento,
          cliente_bairro: cotacao.cliente_bairro,
          cliente_cidade: cotacao.cliente_cidade,
          cliente_estado: cotacao.cliente_estado,
          aparelho_marca: cotacao.aparelho_marca || 'Samsung',
          aparelho_linha: cotacao.aparelho_linha,
          aparelho_modelo: cotacao.aparelho_modelo,
          aparelho_numero_serie: cotacao.aparelho_numero_serie,
          aparelho_imei: cotacao.aparelho_imei,
          defeito_relatado: cotacao.defeito_relatado,
          observacoes_internas: cotacao.observacoes_internas,
          criado_por: usuario?.id,
          valor_total: valorTotal,
          saldo_restante: valorTotal,
          status_pagamento: 'pendente'
        })
        .select()
        .single();

      if (osError) {
        alert(`Erro ao criar OS: ${osError.message}\n\nDetalhes: ${osError.details || 'Nenhum detalhe disponível'}`);
        return;
      }

      // Reconecta peças GSPN órfãs (peças da API Samsung que ficaram sem os_id quando OS foi deletada)
      // Busca peças com status='gspn', os_id=NULL e mesmo numero_os_samsung
      if (cotacao.numero_os_samsung?.trim()) {
        await supabase
          .from('os_pecas')
          .update({ os_id: os.id })
          .is('os_id', null)
          .eq('status', 'gspn')
          .eq('numero_os_samsung', cotacao.numero_os_samsung);
      }

      // Vincula peças à OS (mantém cotacao_id para preservar histórico)
      const { data: pecasVinculadas, error: pecasError } = await supabase
        .from('cotacoes_pecas')
        .update({ os_id: os.id })
        .eq('cotacao_id', id)
        .select();

      if (pecasError) {
        alert(`Aviso: Erro ao vincular peças - ${pecasError.message}`);
      }

      // Vincula serviços à OS (mantém cotacao_id para preservar histórico)
      const { data: servicosVinculados, error: servicosError } = await supabase
        .from('cotacoes_servicos')
        .update({ os_id: os.id })
        .eq('cotacao_id', id)
        .select();

      if (servicosError) {
        alert(`Aviso: Erro ao vincular serviços - ${servicosError.message}`);
      }

      // Vincula requisições de peças à OS (mantém cotacao_id para preservar histórico)
      // IMPORTANTE: Apenas vincula os_id, PRESERVA o status original de cada requisição
      // Primeiro, busca TODAS as requisições da cotação
      const { data: todasRequisicoes } = await supabase
        .from('requisicoes_pecas')
        .select('id, codigo_peca, status, os_id')
        .eq('cotacao_id', id);

      // Agora vincula apenas as que não têm os_id
      const { data: requisicoesVinculadas, error: requisicoesError } = await supabase
        .from('requisicoes_pecas')
        .update({ os_id: os.id })
        .eq('cotacao_id', id)
        .is('os_id', null)
        .select('id, codigo_peca, status');

      if (requisicoesError) {
        alert(`⚠️ ATENÇÃO: Erro ao vincular requisições de peças!\n\nAs requisições não foram vinculadas à OS.\n\nErro: ${requisicoesError.message}`);
      }

      // Vincula anexos à OS (mantém cotacao_id para preservar histórico)
      const { error: anexosError } = await supabase
        .from('os_anexos')
        .update({ os_id: os.id })
        .eq('cotacao_id', id)
        .is('os_id', null);

      // Vincula pagamentos à OS (mantém cotacao_id para preservar histórico)
      const { error: pagamentosError } = await supabase
        .from('pagamentos')
        .update({ os_id: os.id })
        .eq('cotacao_id', id)
        .is('os_id', null);

      // Copia todos os comentários da cotação para a OS (histórico completo preservado)
      const { data: comentariosCotacao } = await supabase
        .from('cotacao_comentarios')
        .select('*')
        .eq('cotacao_id', id);

      if (comentariosCotacao && comentariosCotacao.length > 0) {
        await supabase
          .from('os_comentarios')
          .insert(
            comentariosCotacao.map(comentario => ({
              os_id: os.id,
              usuario_id: comentario.usuario_id,
              comentario: comentario.texto,
              created_at: comentario.created_at
            }))
          );
      }

      // Adiciona comentário de sistema na cotação E na OS
      await supabase
        .from('cotacao_comentarios')
        .insert({
          cotacao_id: id,
          usuario_id: usuario?.id,
          texto: `Cotação #${cotacao.numero_cotacao} aprovada e movida para o Kanban por ${usuario?.nome || 'Sistema'}`,
          is_system: true
        });

      await supabase
        .from('os_comentarios')
        .insert({
          os_id: os.id,
          usuario_id: usuario?.id,
          comentario: `Cotação #${cotacao.numero_cotacao} aprovada e movida para o Kanban por ${usuario?.nome || 'Sistema'}`
        });

      // Cria lançamento financeiro se houver forma de pagamento
      if (cotacao.forma_pagamento_id) {
        await supabase
          .from('financeiro_lancamentos')
          .insert({
            os_id: os.id,
            cotacao_id: cotacao.id,
            numero_os_samsung: cotacao.numero_os_samsung,
            numero_cotacao: cotacao.numero_cotacao,
            forma_pagamento_id: cotacao.forma_pagamento_id,
            valor: 0,
            data_pagamento: new Date().toISOString().split('T')[0],
            unidade_id: cotacao.unidade_id,
            lancado_por: usuario?.id
          });
      }

      // Atualiza status da cotação
      await supabase
        .from('cotacoes')
        .update({ status: 'aprovada' })
        .eq('id', id);

      loadCotacoes();
      alert('Cotação aprovada! OS criada no Kanban com comentários e anexos.');
    } catch (error: any) {
      alert(`Erro ao aprovar cotação: ${error.message || error}`);
    }
  };

  const handleEnviarDiagnostico = async (id: string) => {
    const confirmacao = confirm(
      'ENVIAR PARA DIAGNOSTICO\n\n' +
      'Ao confirmar, uma OS sera criada no Kanban na coluna DIAGNOSTICO.\n\n' +
      'O tecnico ira analisar o aparelho e adicionar as pecas necessarias.\n\n' +
      'Deseja continuar?'
    );

    if (!confirmacao) return;

    try {
      const { data: cotacao, error: fetchError } = await supabase
        .from('cotacoes')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;
      if (!cotacao) throw new Error('Cotacao nao encontrada');

      if (cotacao.os_id) {
        alert('Esta cotacao ja possui uma OS vinculada!');
        return;
      }

      const { data: pecas } = await supabase
        .from('cotacoes_pecas')
        .select('*')
        .eq('cotacao_id', id);

      const { data: servicos } = await supabase
        .from('cotacoes_servicos')
        .select('*')
        .eq('cotacao_id', id);

      const valorPecas = (pecas || []).reduce((sum, p) => sum + (p.valor_total || 0), 0);
      const valorServicos = (servicos || []).reduce((sum, s) => sum + (s.valor_total || 0), 0);
      let valorTotal = valorPecas + valorServicos;

      if (cotacao.desconto_valor) {
        if (cotacao.desconto_tipo === 'percentual') {
          valorTotal = valorTotal * (1 - cotacao.desconto_valor / 100);
        } else {
          valorTotal = valorTotal - cotacao.desconto_valor;
        }
      }
      valorTotal = Math.max(0, Math.round(valorTotal * 100) / 100);

      const { data: os, error: osError } = await supabase
        .from('os')
        .insert({
          numero_os_samsung: cotacao.numero_os_samsung?.trim() || null,
          cotacao_id: cotacao.id,
          tipo_atendimento: cotacao.tipo_atendimento || 'CI',
          tipo_os: cotacao.tipo_os || 'LP',
          tipo_orcamento: cotacao.tipo_orcamento,
          unidade_id: cotacao.unidade_id,
          coluna_kanban: 'diagnostico',
          cliente_nome: cotacao.cliente_nome,
          cliente_cpf_cnpj: cotacao.cliente_cpf_cnpj,
          cliente_telefone: cotacao.cliente_telefone,
          cliente_email: cotacao.cliente_email,
          cliente_endereco: cotacao.cliente_endereco,
          cliente_cep: cotacao.cliente_cep,
          cliente_logradouro: cotacao.cliente_logradouro,
          cliente_numero: cotacao.cliente_numero,
          cliente_complemento: cotacao.cliente_complemento,
          cliente_bairro: cotacao.cliente_bairro,
          cliente_cidade: cotacao.cliente_cidade,
          cliente_estado: cotacao.cliente_estado,
          aparelho_marca: cotacao.aparelho_marca || 'Samsung',
          aparelho_linha: cotacao.aparelho_linha,
          aparelho_modelo: cotacao.aparelho_modelo,
          aparelho_numero_serie: cotacao.aparelho_numero_serie,
          aparelho_imei: cotacao.aparelho_imei,
          defeito_relatado: cotacao.defeito_relatado,
          observacoes_internas: cotacao.observacoes_internas,
          criado_por: usuario?.id,
          valor_total: valorTotal,
          saldo_restante: valorTotal,
          status_pagamento: 'pendente'
        })
        .select()
        .single();

      if (osError) throw osError;

      // Reconecta peças GSPN órfãs (peças da API Samsung que ficaram sem os_id quando OS foi deletada)
      if (cotacao.numero_os_samsung?.trim()) {
        await supabase
          .from('os_pecas')
          .update({ os_id: os.id })
          .is('os_id', null)
          .eq('status', 'gspn')
          .eq('numero_os_samsung', cotacao.numero_os_samsung);
      }

      await supabase.from('cotacoes_pecas').update({ os_id: os.id }).eq('cotacao_id', id);
      await supabase.from('cotacoes_servicos').update({ os_id: os.id }).eq('cotacao_id', id);
      await supabase.from('os_anexos').update({ os_id: os.id }).eq('cotacao_id', id).is('os_id', null);
      await supabase.from('pagamentos').update({ os_id: os.id }).eq('cotacao_id', id).is('os_id', null);

      await supabase
        .from('cotacoes')
        .update({
          enviada_diagnostico: true,
          enviada_diagnostico_em: new Date().toISOString()
        })
        .eq('id', id);

      // Copia todos os comentários da cotação para a OS (histórico completo preservado)
      const { data: comentariosCotacao } = await supabase
        .from('cotacao_comentarios')
        .select('*')
        .eq('cotacao_id', id);

      if (comentariosCotacao && comentariosCotacao.length > 0) {
        await supabase
          .from('os_comentarios')
          .insert(
            comentariosCotacao.map(comentario => ({
              os_id: os.id,
              usuario_id: comentario.usuario_id,
              comentario: comentario.texto,
              created_at: comentario.created_at
            }))
          );
      }

      await supabase.from('cotacao_comentarios').insert({
        cotacao_id: id,
        usuario_id: usuario?.id,
        texto: `Cotacao enviada para DIAGNOSTICO no Kanban por ${usuario?.nome || 'Sistema'}`,
        is_system: true
      });

      await supabase.from('os_comentarios').insert({
        os_id: os.id,
        usuario_id: usuario?.id,
        comentario: `OS criada para DIAGNOSTICO. Tecnico deve analisar e adicionar pecas necessarias.`
      });

      loadCotacoes();
      alert(
        'ENVIADO PARA DIAGNOSTICO!\n\n' +
        `OS #${os.numero_os_samsung || 'N/A'} criada no Kanban na coluna DIAGNOSTICO.\n\n` +
        'O tecnico ira analisar o aparelho e adicionar as pecas.'
      );
    } catch (error: any) {
      alert(`Erro ao enviar para diagnostico: ${error.message || 'Erro desconhecido'}`);
    }
  };

  const handleRejeitarCotacao = async (id: string) => {
    const motivo = prompt('Motivo da rejeição:');
    if (!motivo) return;

    try {
      // Busca dados da cotação
      const { data: cotacao, error: fetchError } = await supabase
        .from('cotacoes')
        .select('*')
        .eq('id', id)
        .single();

      if (fetchError) throw fetchError;

      // Verifica se já existe uma OS com este número Samsung NA MESMA UNIDADE
      if (cotacao.numero_os_samsung) {
        const { data: osComMesmoNumero } = await supabase
          .from('os')
          .select('id, numero_os_samsung, cliente_nome')
          .eq('numero_os_samsung', cotacao.numero_os_samsung)
          .eq('unidade_id', cotacao.unidade_id)
          .maybeSingle();

        if (osComMesmoNumero) {
          alert(`Ja existe uma OS com o numero Samsung "${cotacao.numero_os_samsung}"!\n\nOS ID: ${osComMesmoNumero.id}\nCliente: ${osComMesmoNumero.cliente_nome}\n\nEdite a cotacao e altere o numero da OS Samsung antes de rejeitar.`);
          return;
        }
      }

      // Calcula valor total da cotação
      const { data: pecasValor } = await supabase
        .from('cotacoes_pecas')
        .select('valor_total')
        .eq('cotacao_id', id);

      const { data: servicosValor } = await supabase
        .from('cotacoes_servicos')
        .select('valor_total')
        .eq('cotacao_id', id);

      const valorPecas = (pecasValor || []).reduce((sum, p) => sum + (p.valor_total || 0), 0);
      const valorServicos = (servicosValor || []).reduce((sum, s) => sum + (s.valor_total || 0), 0);
      const subtotal = valorPecas + valorServicos;

      // Calcular desconto
      let desconto = 0;
      if (cotacao.desconto_valor) {
        if (cotacao.desconto_tipo === 'percentual') {
          desconto = subtotal * (cotacao.desconto_valor / 100);
        } else {
          desconto = cotacao.desconto_valor;
        }
      }

      const valorTotal = Math.round((subtotal - desconto) * 100) / 100;

      // Cria OS com status rejeitado
      const { data: os, error: osError } = await supabase
        .from('os')
        .insert({
          numero_os_samsung: cotacao.numero_os_samsung,
          cotacao_id: cotacao.id,
          tipo_atendimento: cotacao.tipo_atendimento,
          tipo_os: cotacao.tipo_os,
          tipo_orcamento: cotacao.tipo_orcamento,
          unidade_id: cotacao.unidade_id,
          coluna_kanban: 'orcamentos_rejeitados',
          cliente_nome: cotacao.cliente_nome,
          cliente_cpf_cnpj: cotacao.cliente_cpf_cnpj,
          cliente_telefone: cotacao.cliente_telefone,
          cliente_email: cotacao.cliente_email,
          cliente_endereco: cotacao.cliente_endereco,
          cliente_cep: cotacao.cliente_cep,
          cliente_logradouro: cotacao.cliente_logradouro,
          cliente_numero: cotacao.cliente_numero,
          cliente_complemento: cotacao.cliente_complemento,
          cliente_bairro: cotacao.cliente_bairro,
          cliente_cidade: cotacao.cliente_cidade,
          cliente_estado: cotacao.cliente_estado,
          aparelho_marca: cotacao.aparelho_marca,
          aparelho_linha: cotacao.aparelho_linha,
          aparelho_modelo: cotacao.aparelho_modelo,
          aparelho_numero_serie: cotacao.aparelho_numero_serie,
          aparelho_imei: cotacao.aparelho_imei,
          defeito_relatado: cotacao.defeito_relatado,
          observacoes_internas: `${cotacao.observacoes_internas || ''}\n\n**REJEITADO:** ${motivo}`,
          criado_por: usuario?.id,
          valor_total: valorTotal,
          saldo_restante: valorTotal,
          status_pagamento: 'pendente'
        })
        .select()
        .single();

      if (osError) throw osError;

      // Copia peças da cotação para a OS
      const { data: pecas } = await supabase
        .from('cotacoes_pecas')
        .select('*')
        .eq('cotacao_id', id);

      if (pecas && pecas.length > 0) {
        await supabase
          .from('os_pecas')
          .insert(
            pecas.map(p => ({
              os_id: os.id,
              cotacao_peca_id: p.id,
              codigo: p.codigo_peca,
              descricao: p.descricao,
              quantidade: p.quantidade,
              valor_unitario: p.valor_unitario,
              valor_total: p.valor_total
            }))
          );
      }

      // Copia serviços da cotação para a OS
      const { data: servicos } = await supabase
        .from('cotacoes_servicos')
        .select('*')
        .eq('cotacao_id', id);

      if (servicos && servicos.length > 0) {
        await supabase
          .from('os_servicos')
          .insert(
            servicos.map(s => ({
              os_id: os.id,
              codigo_servico: s.codigo_servico,
              descricao: s.descricao,
              quantidade: s.quantidade,
              valor_unitario: s.valor_unitario,
              valor_total: s.valor_total,
              observacao: s.observacao
            }))
          );
      }

      // Copia comentários da cotação para a OS
      const { data: comentarios } = await supabase
        .from('cotacao_comentarios')
        .select('*')
        .eq('cotacao_id', id);

      if (comentarios && comentarios.length > 0) {
        await supabase
          .from('os_comentarios')
          .insert(
            comentarios.map(c => ({
              os_id: os.id,
              usuario_id: c.usuario_id,
              comentario: c.texto
            }))
          );
      }

      // Adiciona comentário com motivo de rejeição
      await supabase
        .from('cotacao_comentarios')
        .insert({
          cotacao_id: id,
          usuario_id: usuario?.id,
          texto: `**Rejeitado:** ${motivo}`
        });

      await supabase
        .from('os_comentarios')
        .insert({
          os_id: os.id,
          usuario_id: usuario?.id,
          comentario: `**Rejeitado:** ${motivo}`
        });

      // Copia anexos da cotação para a OS
      const { data: anexos } = await supabase
        .from('os_anexos')
        .select('*')
        .eq('cotacao_id', id);

      if (anexos && anexos.length > 0) {
        await supabase
          .from('os_anexos')
          .insert(
            anexos.map(a => ({
              os_id: os.id,
              cotacao_id: id,
              tipo: a.tipo,
              nome_arquivo: a.nome_arquivo,
              url: a.url,
              tamanho_bytes: a.tamanho_bytes,
              usuario_id: a.usuario_id
            }))
          );
      }

      // Cria lançamento financeiro se houver forma de pagamento
      if (cotacao.forma_pagamento_id) {
        await supabase
          .from('financeiro_lancamentos')
          .insert({
            os_id: os.id,
            cotacao_id: cotacao.id,
            numero_os_samsung: cotacao.numero_os_samsung,
            numero_cotacao: cotacao.numero_cotacao,
            forma_pagamento_id: cotacao.forma_pagamento_id,
            valor: 0,
            data_pagamento: new Date().toISOString().split('T')[0],
            unidade_id: cotacao.unidade_id,
            lancado_por: usuario?.id
          });
      }

      // Copia todos os comentários da cotação para a OS (histórico completo preservado)
      const { data: comentariosCotacao } = await supabase
        .from('cotacao_comentarios')
        .select('*')
        .eq('cotacao_id', id);

      if (comentariosCotacao && comentariosCotacao.length > 0) {
        await supabase
          .from('os_comentarios')
          .insert(
            comentariosCotacao.map(comentario => ({
              os_id: os.id,
              usuario_id: comentario.usuario_id,
              comentario: comentario.texto,
              created_at: comentario.created_at
            }))
          );
      }

      // Adiciona comentário de sistema na cotação E na OS
      await supabase.from('cotacao_comentarios').insert({
        cotacao_id: id,
        usuario_id: usuario?.id,
        texto: `Cotação rejeitada: ${motivo}`,
        is_system: true
      });

      await supabase.from('os_comentarios').insert({
        os_id: os.id,
        usuario_id: usuario?.id,
        comentario: `Cotação rejeitada: ${motivo}`
      });

      // Atualiza status da cotação
      await supabase
        .from('cotacoes')
        .update({ status: 'reprovada', reprovada_motivo: motivo })
        .eq('id', id);

      loadCotacoes();
      alert('Cotação rejeitada! OS criada no Kanban com comentários e anexos.');
    } catch (error) {
      alert('Erro ao rejeitar cotação');
    }
  };

  const handleEnviarCotacao = async (id: string) => {
    try {
      const cotacao = cotacoes.find(c => c.id === id);
      if (!cotacao) return;

      const { data: pecas } = await supabase
        .from('cotacoes_pecas')
        .select('pn, descricao, quantidade, valor_final_unitario')
        .eq('cotacao_id', id);

      setWhatsAppCotacao(cotacao);
      setWhatsAppPecas(pecas || []);
      setShowWhatsAppModal(true);
      setTextoCopied(false);
    } catch (error) {
      alert('Erro ao preparar envio');
    }
  };

  const confirmarEnvioCotacao = async () => {
    if (!whatsAppCotacao) return;

    try {
      const { error } = await supabase
        .from('cotacoes')
        .update({
          status: 'enviada',
          orcamento_enviado: true,
          orcamento_enviado_em: new Date().toISOString(),
          orcamento_enviado_por: usuario?.id,
          orcamento_modificado_apos_envio: false
        })
        .eq('id', whatsAppCotacao.id);

      if (error) throw error;

      setShowWhatsAppModal(false);
      setWhatsAppCotacao(null);
      setWhatsAppPecas([]);
      loadCotacoes();
      alert('Cotacao marcada como enviada!');
    } catch (error) {
      alert('Erro ao enviar cotacao');
    }
  };

  const gerarTextoWhatsApp = () => {
    if (!whatsAppCotacao) return '';

    const pecasTexto = whatsAppPecas.length > 0
      ? whatsAppPecas.map(p => `- ${p.descricao} (${p.quantidade}x)`).join('\n')
      : 'Servicos tecnicos';

    const valorTotal = whatsAppCotacao.valor_calculado || 0;

    const texto = `Prezado(a) ${whatsAppCotacao.cliente_nome?.split(' ')[0]},

Segue o orcamento do seu aparelho ${whatsAppCotacao.aparelho_modelo || 'Samsung'}:

*PECAS/SERVICOS:*
${pecasTexto}

*VALOR TOTAL: R$ ${valorTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}*

*FORMAS DE PAGAMENTO:*
- PIX (a vista)
- Cartao de Credito (ate 12x)
- Cartao de Debito
- Dinheiro

O prazo para o servico e de aproximadamente 3 a 5 dias uteis apos a aprovacao do orcamento.

Ficamos no aguardo da sua confirmacao!

Atenciosamente,
Assistencia Tecnica Samsung`;

    return texto;
  };

  const copiarTexto = () => {
    const texto = gerarTextoWhatsApp();
    navigator.clipboard.writeText(texto);
    setTextoCopied(true);
    setTimeout(() => setTextoCopied(false), 3000);
  };

  const handleComentar = (id: string) => {
    setCotacaoSelecionada(id);
    setEditandoCotacaoId(id);
    setShowComentarioModal(true);
  };

  const getStatusBadge = (status: string) => {
    const badges = {
      pendente_preenchimento: {
        label: 'Pendente',
        color: '#6B7280',
        icon: Clock
      },
      enviada: {
        label: 'Enviada',
        color: 'var(--text-accent)',
        icon: Send
      },
      aprovada: {
        label: 'Aprovada',
        color: '#39FF14',
        icon: CheckCircle
      },
      reprovada: {
        label: 'Reprovada',
        color: '#FF0064',
        icon: XCircle
      },
      reprovada_refeita: {
        label: 'Refeita',
        color: '#FFBF00',
        icon: RefreshCw
      }
    };

    const badge = badges[status as keyof typeof badges] || badges.pendente_preenchimento;
    const Icon = badge.icon;

    return (
      <span
        className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 flex-shrink-0"
        style={{
          backgroundColor: `${badge.color}20`,
          color: badge.color,
          border: `1px solid ${badge.color}60`,
          boxShadow: `0 0 10px ${badge.color}30`
        }}
      >
        <Icon className="w-3 h-3" />
        {badge.label}
      </span>
    );
  };

  const getDiasCriacao = (createdAt: string) => {
    const created = new Date(createdAt);
    const hoje = new Date();
    const diffTime = Math.abs(hoje.getTime() - created.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getDiasBadge = (dias: number) => {
    let color = '#39FF14';
    if (dias > 7) color = '#FFBF00';
    if (dias > 14) color = '#FF0064';

    return (
      <span
        className="px-2 py-1 rounded-full text-[10px] font-bold flex items-center gap-1 flex-shrink-0"
        style={{
          backgroundColor: `${color}20`,
          color: color,
          border: `1px solid ${color}60`
        }}
      >
        <Clock className="w-3 h-3" />
        {dias}d
      </span>
    );
  };

  const getActionButtons = (cotacao: Cotacao) => {
    const hasOS = !!(cotacao as any).os_vinculada;
    return (
      <div className="flex gap-2">
        {!hasOS && (
          <button
            onClick={() => handleEnviarDiagnostico(cotacao.id)}
            className="flex-1 px-3 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
            style={{
              backgroundColor: '#9D4EDD20',
              color: '#9D4EDD',
              border: '1px solid #9D4EDD60'
            }}
          >
            <Microscope className="w-3.5 h-3.5" />
            DIAG
          </button>
        )}
        <div className={`relative ${hasOS ? 'flex-1' : 'flex-1'}`}>
          <button
            onClick={() => setMenuAberto(menuAberto === cotacao.id ? null : cotacao.id)}
            className="w-full px-3 py-2 rounded-lg font-bold text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5"
            style={{
              backgroundColor: 'rgba(var(--accent-rgb), 0.125)',
              color: 'var(--text-accent)',
              border: '1px solid rgba(var(--accent-rgb), 0.38)'
            }}
          >
            <MoreVertical className="w-3.5 h-3.5" />
            AÇÕES
          </button>

        {menuAberto === cotacao.id && (
          <div
            className="absolute bottom-full left-0 right-0 mb-2 bg-black border border-[#00D4FF]/40 rounded-lg shadow-xl z-50 overflow-hidden"
            onMouseLeave={() => setMenuAberto(null)}
          >
            {/* Aprovar - disponível para enviadas */}
            {cotacao.status === 'enviada' && (
              <button
                onClick={() => { handleAprovarCotacao(cotacao.id); setMenuAberto(null); }}
                className="w-full px-4 py-2.5 text-left text-xs font-bold uppercase flex items-center gap-2 transition-colors hover:bg-[#39FF14]/20"
                style={{
                  backgroundColor: '#39FF1410',
                  color: '#39FF14',
                  borderBottom: '1px solid #39FF1420'
                }}
              >
                <ThumbsUp className="w-3.5 h-3.5" />
                Aprovar
              </button>
            )}

            {/* Rejeitar - disponível para enviadas */}
            {cotacao.status === 'enviada' && (
              <button
                onClick={() => { handleRejeitarCotacao(cotacao.id); setMenuAberto(null); }}
                className="w-full px-4 py-2.5 text-left text-xs font-bold uppercase flex items-center gap-2 transition-colors hover:bg-[#FF0064]/20"
                style={{
                  backgroundColor: '#FF006410',
                  color: '#FF0064',
                  borderBottom: '1px solid #FF006420'
                }}
              >
                <ThumbsDown className="w-3.5 h-3.5" />
                Rejeitar
              </button>
            )}

            {/* Enviar - disponível para pendentes ou enviadas modificadas */}
            {(cotacao.status === 'pendente_preenchimento' ||
              (cotacao.status === 'enviada' && cotacao.orcamento_modificado_apos_envio)) && (
              <button
                onClick={() => { handleEnviarCotacao(cotacao.id); setMenuAberto(null); }}
                className="w-full px-4 py-2.5 text-left text-xs font-bold uppercase flex items-center gap-2 transition-colors hover:bg-[#00D4FF]/20"
                style={{
                  backgroundColor: cotacao.orcamento_modificado_apos_envio ? '#FFBF0010' : 'rgba(var(--accent-rgb), 0.063)',
                  color: cotacao.orcamento_modificado_apos_envio ? '#FFBF00' : 'var(--text-accent)',
                  borderBottom: cotacao.orcamento_modificado_apos_envio ? '1px solid #FFBF0020' : '1px solid rgba(var(--accent-rgb), 0.125)'
                }}
              >
                <Send className="w-3.5 h-3.5" />
                {cotacao.orcamento_modificado_apos_envio ? 'Reenviar (Modificado)' : 'Enviar'}
              </button>
            )}

            {/* Editar - disponível para pendentes e enviadas */}
            {(cotacao.status === 'pendente_preenchimento' || cotacao.status === 'enviada') && (
              <button
                onClick={() => { handleEditarCotacao(cotacao.id); setMenuAberto(null); }}
                className="w-full px-4 py-2.5 text-left text-xs font-bold uppercase flex items-center gap-2 hover:bg-[#00D4FF]/10 transition-colors text-[#00D4FF]"
                style={{
                  borderBottom: '1px solid rgba(var(--accent-rgb), 0.125)'
                }}
              >
                <Edit className="w-3.5 h-3.5" />
                Editar
              </button>
            )}

            {/* Refazer - apenas para reprovadas */}
            {cotacao.status === 'reprovada' && (
              <button
                onClick={() => { handleRefazerCotacao(cotacao.id); setMenuAberto(null); }}
                className="w-full px-4 py-2.5 text-left text-xs font-bold uppercase flex items-center gap-2 transition-colors hover:bg-[#FFBF00]/20"
                style={{
                  backgroundColor: '#FFBF0010',
                  color: '#FFBF00',
                  borderBottom: '1px solid #FFBF0020'
                }}
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Refazer
              </button>
            )}


            {/* Comentar - sempre disponível */}
            <button
              onClick={() => { handleComentar(cotacao.id); setMenuAberto(null); }}
              className="w-full px-4 py-2.5 text-left text-xs font-bold uppercase flex items-center gap-2 hover:bg-gray-800/60 transition-colors text-gray-400"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Comentar
            </button>
          </div>
        )}
        </div>
      </div>
    );
  };

  const filteredCotacoes = cotacoes.filter((cotacao) =>
    cotacao.cliente_nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    cotacao.numero_cotacao.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (cotacao.numero_os_samsung && cotacao.numero_os_samsung.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="futuristic-loader"></div>
      </div>
    );
  }

  return (
    <>
      <UnitFilter
        unidades={unidades}
        selectedUnidade={selectedUnidade}
        onUnidadeChange={setSelectedUnidade}
      />

      <CotacaoModal
        isOpen={showModal || showComentarioModal}
        onClose={handleCloseModal}
        onSave={handleModalSave}
        cotacaoId={editandoCotacaoId}
        abrirNaAbaComentarios={showComentarioModal}
      />

      <div className="space-y-6 fade-in">
        <div className="flex items-center justify-between">
        <div>
          <h3 className="tech-heading text-xl text-[#00D4FF] mb-2">GERENCIAMENTO DE COTAÇÕES</h3>
          <p className="text-sm text-gray-400 tracking-wide">
            Todas as cotações OW e fora de garantia
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleNovaCotacao}
            className="neon-button flex items-center gap-2"
            style={{
              backgroundColor: '#39FF1420',
              color: '#39FF14',
              border: '1px solid #39FF1460',
              boxShadow: '0 0 20px #39FF1430'
            }}
          >
            <Plus className="w-5 h-5" />
            NOVA COTAÇÃO
          </button>
          <button
            onClick={loadCotacoes}
            className="neon-button flex items-center gap-2"
          >
            <Activity className="w-4 h-4" />
            ATUALIZAR
          </button>
        </div>
      </div>

      <div className="premium-card p-6">
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[#00D4FF]/50" />
            <input
              type="text"
              placeholder="BUSCAR POR CLIENTE, NÚMERO DA COTAÇÃO OU OS SAMSUNG..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="neon-input pl-12 uppercase placeholder:normal-case"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="neon-input px-4 py-2 uppercase"
          >
            <option value="all">Todos os Status</option>
            <option value="pendente_preenchimento">Pendente</option>
            <option value="enviada">Enviada</option>
            <option value="aprovada">Aprovada</option>
            <option value="reprovada">Reprovada</option>
            <option value="reprovada_refeita">Refeita</option>
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredCotacoes.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-20 h-20 rounded-full bg-[#00D4FF]/10 border-2 border-dashed border-[#00D4FF]/40 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-10 h-10 text-[#00D4FF]/60" />
              </div>
              <p className="text-gray-500 text-sm uppercase tracking-wider mb-4">Nenhuma cotação encontrada</p>
              <button
                onClick={handleNovaCotacao}
                className="neon-button inline-flex items-center gap-2 text-sm"
                style={{
                  backgroundColor: '#39FF1420',
                  color: '#39FF14',
                  border: '1px solid #39FF1460',
                  boxShadow: '0 0 20px #39FF1430'
                }}
              >
                <Plus className="w-4 h-4" />
                CRIAR PRIMEIRA COTAÇÃO
              </button>
            </div>
          ) : (
            filteredCotacoes.map((cotacao) => {
              const diasCriacao = getDiasCriacao(cotacao.created_at);
              return (
                <div
                  key={cotacao.id}
                  className="premium-card p-5 hover-lift flex flex-col h-full"
                >
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                      {getDiasBadge(diasCriacao)}
                      {cotacao.versao > 1 && (
                        <span
                          className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 flex-shrink-0 animate-pulse"
                          style={{
                            backgroundColor: '#FF006420',
                            color: '#FF0064',
                            border: '1px solid #FF006460',
                            boxShadow: '0 0 15px #FF006440'
                          }}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          {cotacao.versao}º ORÇAM
                        </span>
                      )}
                      {cotacao.orcamento_modificado_apos_envio && (
                        <span
                          className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 flex-shrink-0 animate-pulse"
                          style={{
                            backgroundColor: '#FFBF0020',
                            color: '#FFBF00',
                            border: '1px solid #FFBF0060',
                            boxShadow: '0 0 15px #FFBF0040'
                          }}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          MODIF
                        </span>
                      )}
                      {(cotacao as any).analise_tecnico_concluida && (
                        <span
                          className="px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 flex-shrink-0 animate-pulse"
                          style={{
                            backgroundColor: '#9D4EDD20',
                            color: '#9D4EDD',
                            border: '1px solid #9D4EDD60',
                            boxShadow: '0 0 15px #9D4EDD40'
                          }}
                        >
                          <Microscope className="w-3 h-3" />
                          ANALISADO
                        </span>
                      )}
                    </div>
                    <div className="flex-shrink-0">
                      {getStatusBadge(cotacao.status)}
                    </div>
                  </div>

                  <div className="mb-3">
                    <h4 className="text-base font-bold text-[#00D4FF] mb-1">
                      {cotacao.numero_os_samsung || cotacao.cliente_nome}
                    </h4>
                    {cotacao.numero_os_samsung && (
                      <p className="text-sm text-white mb-1">{cotacao.cliente_nome}</p>
                    )}
                    {cotacao.aparelho_modelo && (
                      <p className="text-xs text-gray-400">{cotacao.aparelho_modelo}</p>
                    )}
                  </div>

                  <div className="space-y-2 mb-4 flex-grow">
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Cotação:</span>
                      <span className="font-mono text-[#00D4FF]">{cotacao.numero_cotacao}</span>
                    </div>

                    <div className="flex items-center justify-between text-xs">
                      <span className="text-gray-500">Tipo:</span>
                      <span className="text-gray-300 uppercase">{cotacao.tipo_atendimento}</span>
                    </div>

                    {cotacao.cliente_cidade && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">Cidade:</span>
                        <span className="text-gray-300">{cotacao.cliente_cidade}{cotacao.cliente_estado ? ` - ${cotacao.cliente_estado}` : ''}</span>
                      </div>
                    )}

                    {cotacao.defeito_relatado && (
                      <div className="pt-2 border-t border-[#00D4FF]/10">
                        <p className="text-xs text-gray-400 line-clamp-2">{cotacao.defeito_relatado}</p>
                      </div>
                    )}
                  </div>

                  {cotacao.valor_calculado !== undefined && cotacao.valor_calculado > 0 && (
                    <div className="mb-3 pt-3 border-t border-[#00D4FF]/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs text-gray-500 uppercase">Valor Total:</span>
                        <span className="text-lg font-bold text-[#39FF14]">
                          R$ {cotacao.valor_calculado.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </div>

                      {cotacao.saldo_restante !== undefined && cotacao.saldo_restante !== cotacao.valor_calculado && (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500 uppercase">Saldo Restante:</span>
                          <span className="text-sm font-bold text-[#FFBF00]">
                            R$ {cotacao.saldo_restante.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </span>
                        </div>
                      )}

                      {(cotacao as any).os_vinculada && (
                        <div className="space-y-1 mt-3 pt-3 border-t border-gray-700">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">Valor Pago:</span>
                            <span className="text-[#00D4FF] font-mono font-bold">
                              R$ {((cotacao as any).os_vinculada.valor_pago || 0).toFixed(2)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-500">Saldo Restante:</span>
                            <span className="text-[#FFBF00] font-mono font-bold">
                              R$ {((cotacao as any).os_vinculada.saldo_restante || 0).toFixed(2)}
                            </span>
                          </div>
                          <div className="mt-2">
                            <span className={`px-2 py-1 rounded text-xs font-bold uppercase ${
                              (cotacao as any).os_vinculada.status_pagamento === 'pago'
                                ? 'bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/40'
                                : (cotacao as any).os_vinculada.status_pagamento === 'parcial'
                                ? 'bg-[#FFBF00]/20 text-[#FFBF00] border border-[#FFBF00]/40'
                                : 'bg-[#FF0064]/20 text-[#FF0064] border border-[#FF0064]/40'
                            }`}>
                              {(cotacao as any).os_vinculada.status_pagamento === 'pago' ? '✓ Pago' :
                               (cotacao as any).os_vinculada.status_pagamento === 'parcial' ? '⚠ Parcial' : '○ Pendente'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="mt-auto pt-3 border-t border-[#00D4FF]/20">
                    {getActionButtons(cotacao)}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>

    {showWhatsAppModal && whatsAppCotacao && (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="premium-card w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-[#00D4FF]/20">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#25D366]/20 to-[#128C7E]/20 flex items-center justify-center border border-[#25D366]/40">
                <Send className="w-6 h-6 text-[#25D366]" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#00D4FF]">ENVIAR ORCAMENTO</h2>
                <p className="text-xs text-gray-400">Copie o texto e envie pelo WhatsApp</p>
              </div>
            </div>
            <button
              onClick={() => setShowWhatsAppModal(false)}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <XCircle className="w-6 h-6 text-gray-400" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto cyber-scrollbar p-6">
            <div className="mb-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 uppercase tracking-wider">Cliente</span>
                <span className="text-sm font-bold text-white">{whatsAppCotacao.cliente_nome}</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-gray-400 uppercase tracking-wider">Aparelho</span>
                <span className="text-sm text-gray-300">{whatsAppCotacao.aparelho_modelo || 'Samsung'}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400 uppercase tracking-wider">Valor Total</span>
                <span className="text-lg font-bold text-[#39FF14]">
                  R$ {(whatsAppCotacao.valor_calculado || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            <div className="premium-card p-4 bg-[#25D366]/5 border border-[#25D366]/20">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-[#25D366] uppercase tracking-wider font-bold">Texto para WhatsApp</span>
                <button
                  onClick={copiarTexto}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                    textoCopied
                      ? 'bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/40'
                      : 'bg-[#25D366]/20 text-[#25D366] border border-[#25D366]/40 hover:bg-[#25D366]/30'
                  }`}
                >
                  {textoCopied ? (
                    <>
                      <Check className="w-4 h-4" />
                      COPIADO!
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      COPIAR
                    </>
                  )}
                </button>
              </div>
              <pre className="text-sm text-gray-300 whitespace-pre-wrap font-sans leading-relaxed bg-black/30 p-4 rounded-lg border border-gray-800 max-h-[300px] overflow-y-auto cyber-scrollbar">
                {gerarTextoWhatsApp()}
              </pre>
            </div>

            {(whatsAppCotacao as any).analise_tecnico_concluida && (
              <div className="mt-4 premium-card p-4 bg-[#9D4EDD]/10 border border-[#9D4EDD]/30">
                <div className="flex items-center gap-2">
                  <Microscope className="w-5 h-5 text-[#9D4EDD]" />
                  <span className="text-sm font-bold text-[#9D4EDD]">ANALISE CONCLUIDA PELO TECNICO</span>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  Este orcamento foi analisado pelo tecnico. As pecas listadas ja foram verificadas.
                </p>
              </div>
            )}
          </div>

          <div className="p-6 border-t border-[#00D4FF]/20 flex gap-3">
            <button
              onClick={() => setShowWhatsAppModal(false)}
              className="flex-1 px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all border border-gray-700 text-gray-400 hover:bg-gray-800/60"
            >
              CANCELAR
            </button>
            <button
              onClick={confirmarEnvioCotacao}
              className="flex-1 neon-button flex items-center justify-center gap-2"
              style={{
                backgroundColor: '#25D36620',
                color: '#25D366',
                border: '1px solid #25D36660',
                boxShadow: '0 0 20px #25D36630'
              }}
            >
              <Send className="w-5 h-5" />
              MARCAR COMO ENVIADO
            </button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
