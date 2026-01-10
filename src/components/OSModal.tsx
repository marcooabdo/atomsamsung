import { useEffect, useState } from 'react';
import { X, User, Package, FileText, MessageSquare, Paperclip, DollarSign, Wrench, Send, Trash2, CheckSquare, AlertCircle, Clock, QrCode, RefreshCw, Calendar, Microscope, MoveHorizontal, ChevronDown, Download, FileDown, XCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { DevolucaoModal } from './DevolucaoModal';
import { OSAgendamentoTab } from './OSAgendamentoTab';
import { OSPagamentoTab } from './OSPagamentoTab';
import { AnexoPreviewModal } from './AnexoPreviewModal';
import { gerarRelatorioOS } from '../lib/relatorioOS';
import { gerarPDFOrdemServico } from '../lib/pdfOS';
import type { Database } from '../lib/database.types';

const COLUNAS_KANBAN = [
  { id: 'os_nova', label: 'OS Nova' },
  { id: 'diagnostico', label: 'Diagnóstico' },
  { id: 'aguardando_cotacao', label: 'Aguardando Cotação' },
  { id: 'aguardando_aprovacao', label: 'Aguardando Aprovação' },
  { id: 'orcamento_aprovado', label: 'Orçamento Aprovado' },
  { id: 'aguardando_peca', label: 'Aguardando Peça' },
  { id: 'peca_em_transito', label: 'Peça em Trânsito' },
  { id: 'peca_disponivel', label: 'Peça Disponível' },
  { id: 'em_reparo_ci', label: 'Em Reparo CI' },
  { id: 'rota_preta', label: 'Rota Preta' },
  { id: 'rota_vermelha', label: 'Rota Vermelha' },
  { id: 'rota_azul', label: 'Rota Azul' },
  { id: 'rota_verde', label: 'Rota Verde' },
  { id: 'rota_rosa', label: 'Rota Rosa' },
  { id: 'rota_amarela', label: 'Rota Amarela' },
  { id: 'rota_laranja', label: 'Rota Laranja' },
  { id: 'em_rota_ih', label: 'Em Rota IH' },
  { id: 'reparo_concluido', label: 'Reparo Concluído' },
  { id: 'aguardando_fechamento', label: 'Aguardando Fechamento' },
  { id: 'fechar_os', label: 'Fechar OS' },
  { id: 'os_fechada', label: 'OS Fechada' },
  { id: 'orcamentos_rejeitados', label: 'Orçamentos Rejeitados' }
];

type OS = Database['public']['Tables']['os']['Row'];
type OSComentario = Database['public']['Tables']['os_comentarios']['Row'] & {
  usuario?: { nome: string } | null;
};
type OSAnexo = Database['public']['Tables']['os_anexos']['Row'];
type OSPeca = Database['public']['Tables']['os_pecas']['Row'];

interface RequisicaoPeca {
  id: string;
  os_id: string;
  cotacao_peca_id: string | null;
  codigo_peca: string;
  descricao: string;
  quantidade_requisitada: number;
  status: string;
  peca_estoque_id: string | null;
  created_at: string;
  numero_pedido_samsung?: string | null;
  peca_estoque?: {
    id_numerico: number;
    delivery?: string | null;
  };
}

interface OSModalProps {
  osId: string;
  onClose: () => void;
  onReload?: () => void;
}

type AbaAtiva = 'dados' | 'estoque' | 'checklist' | 'servicos' | 'pagamento' | 'anexos' | 'comentarios' | 'agendamento';

export function OSModal({ osId, onClose, onReload }: OSModalProps) {
  const { usuario } = useAuth();
  const [os, setOS] = useState<OS | null>(null);
  const [pecas, setPecas] = useState<OSPeca[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [requisicoes, setRequisicoes] = useState<RequisicaoPeca[]>([]);
  const [comentarios, setComentarios] = useState<OSComentario[]>([]);
  const [anexos, setAnexos] = useState<OSAnexo[]>([]);
  const [anexoPreview, setAnexoPreview] = useState<OSAnexo | null>(null);
  const [pagamento, setPagamento] = useState<any>(null);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [novoComentario, setNovoComentario] = useState('');
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>('dados');
  const [loading, setLoading] = useState(true);
  const [refazendoOrcamento, setRefazendoOrcamento] = useState(false);
  const [mostrarComentariosSistema, setMostrarComentariosSistema] = useState(true);
  const [mostrarModalConversao, setMostrarModalConversao] = useState(false);
  const [motivoConversao, setMotivoConversao] = useState('');
  const [confirmaConversao, setConfirmaConversao] = useState(false);
  const [convertendo, setConvertendo] = useState(false);
  const [mostrarModalDevolucao, setMostrarModalDevolucao] = useState(false);
  const [requisicaoSelecionada, setRequisicaoSelecionada] = useState<RequisicaoPeca | null>(null);
  const [criandoRequisicao, setCriandoRequisicao] = useState(false);
  const [finalizandoAnalise, setFinalizandoAnalise] = useState(false);
  const [mostrarMoverPara, setMostrarMoverPara] = useState(false);
  const [movendoOS, setMovendoOS] = useState(false);
  const [syncingGSPN, setSyncingGSPN] = useState(false);
  const [currentJob, setCurrentJob] = useState<any>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [, setTimeUpdate] = useState(0);

  // Timer progressivo enquanto o job está rodando
  useEffect(() => {
    if (!currentJob) return;

    if (currentJob.is_running) {
      // Calcula quantos segundos já passaram desde o início
      const start = new Date(currentJob.created_at).getTime();
      const initialElapsed = Math.max(0, Math.floor((Date.now() - start) / 1000));
      setElapsedSeconds(initialElapsed);

      // Inicia contador progressivo
      const interval = setInterval(() => {
        setElapsedSeconds(prev => prev + 1);
      }, 1000);

      return () => clearInterval(interval);
    } else {
      // Job finalizado, usa tempo real do banco
      if (currentJob.finished_at) {
        const start = new Date(currentJob.created_at).getTime();
        const end = new Date(currentJob.finished_at).getTime();
        const seconds = Math.max(0, Math.floor((end - start) / 1000));
        setElapsedSeconds(seconds);
      }
    }
  }, [currentJob?.is_running, currentJob?.created_at, currentJob?.finished_at]);

  useEffect(() => {
    loadOS();
    loadPecas();
    loadServicos();
    loadRequisicoes();
    loadChecklist();
    loadComentarios();
    loadAnexos();
  }, [osId]);

  // Carrega pagamento depois que peças e serviços estiverem prontos
  useEffect(() => {
    if (pecas.length > 0 || servicos.length > 0) {
      loadPagamento();
    }
  }, [pecas, servicos]);

  useEffect(() => {
    loadCurrentJob();

    const channel = supabase
      .channel('jobs-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'jobs',
        filter: `os_id=eq.${osId}`
      }, () => {
        loadCurrentJob();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [osId]);

  useEffect(() => {
    if (currentJob?.is_running) {
      const interval = setInterval(() => {
        loadCurrentJob();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [currentJob?.is_running, osId]);

  useEffect(() => {
    if (currentJob?.is_running) {
      const timer = setInterval(() => {
        setTimeUpdate(prev => prev + 1);
      }, 1000);

      return () => clearInterval(timer);
    }
  }, [currentJob?.is_running]);

  const loadOS = async () => {
    try {
      const { data, error } = await supabase
        .from('os')
        .select(`
          *,
          unidade:unidades!os_unidade_id_fkey(nome),
          cotacao:cotacoes!os_cotacao_id_fkey(numero_cotacao)
        `)
        .eq('id', osId)
        .single();

      if (error) throw error;
      setOS(data);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const loadPecas = async () => {
    // Busca peças tanto de os_pecas quanto de cotacoes_pecas
    const [osPecasResult, cotacaoPecasResult] = await Promise.all([
      supabase
        .from('os_pecas')
        .select('*')
        .eq('os_id', osId)
        .order('created_at', { ascending: true }),
      supabase
        .from('cotacoes_pecas')
        .select('*')
        .eq('os_id', osId)
        .order('created_at', { ascending: true })
    ]);

    // Converte cotacoes_pecas para o formato de os_pecas
    const cotacaoPecas = (cotacaoPecasResult.data || []).map(p => ({
      id: p.id,
      os_id: p.os_id,
      cotacao_peca_id: p.id,
      codigo: p.pn,
      pn: p.pn,
      descricao: p.descricao,
      quantidade: p.quantidade,
      valor_unitario: p.valor_final_unitario,
      valor_total: p.valor_total,
      created_at: p.created_at,
      updated_at: p.updated_at
    }));

    setPecas([...(osPecasResult.data || []), ...cotacaoPecas]);
  };

  const loadServicos = async () => {
    // Busca serviços de cotacoes_servicos (movidos da cotação)
    const { data } = await supabase
      .from('cotacoes_servicos')
      .select(`
        *,
        servico:servicos(codigo, nome)
      `)
      .eq('os_id', osId)
      .order('created_at', { ascending: true });

    // Mapeia para incluir codigo_servico
    const servicosComCodigo = (data || []).map(s => ({
      ...s,
      codigo_servico: s.servico?.codigo || 'N/A'
    }));

    setServicos(servicosComCodigo);
  };

  const loadRequisicoes = async () => {

    // Busca cotacao_id da OS para incluir requisições da cotação original
    const { data: osData } = await supabase
      .from('os')
      .select('cotacao_id')
      .eq('id', osId)
      .maybeSingle();


    // Busca requisições vinculadas à OS ou à cotação original
    let query = supabase
      .from('requisicoes_pecas')
      .select(`
        *,
        reprovado_por_usuario:usuarios!requisicoes_pecas_reprovado_por_fkey(nome),
        peca_estoque:estoque_pecas!requisicoes_pecas_peca_estoque_id_fkey(id_numerico, delivery)
      `);

    if (osData?.cotacao_id) {
      // Busca por os_id OU cotacao_id
      query = query.or(`os_id.eq.${osId},cotacao_id.eq.${osData.cotacao_id}`);
    } else {
      // Se não tem cotação, busca apenas por os_id
      query = query.eq('os_id', osId);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) {
      return;
    }

    data?.forEach(req => {
    });

    setRequisicoes(data || []);
  };

  const loadChecklist = async () => {
    const { data } = await supabase
      .from('os_checklist')
      .select('*, concluido_por:usuarios(nome)')
      .eq('os_id', osId)
      .order('ordem', { ascending: true });

    setChecklist(data || []);
  };

  const loadComentarios = async () => {
    // Busca cotacao_id da OS
    const { data: osData } = await supabase
      .from('os')
      .select('cotacao_id')
      .eq('id', osId)
      .maybeSingle();

    // Busca comentários tanto de os_comentarios quanto de cotacao_comentarios com nome do usuário
    const [osComentariosResult, cotacaoComentariosResult] = await Promise.all([
      supabase
        .from('os_comentarios')
        .select('*, usuario:usuarios(nome)')
        .eq('os_id', osId)
        .order('created_at', { ascending: false }),
      osData?.cotacao_id
        ? supabase
            .from('cotacao_comentarios')
            .select('*, usuario:usuarios(nome)')
            .eq('cotacao_id', osData.cotacao_id)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null })
    ]);


    // Converte cotacao_comentarios para o formato de os_comentarios
    const cotacaoComentarios = (cotacaoComentariosResult.data || []).map(c => ({
      id: c.id,
      os_id: c.os_id,
      usuario_id: c.usuario_id,
      comentario: c.texto,
      is_system: c.is_system || false,
      created_at: c.created_at,
      updated_at: c.updated_at,
      usuario: c.usuario
    }));

    const todosComentarios = [...(osComentariosResult.data || []), ...cotacaoComentarios].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    setComentarios(todosComentarios);
  };

  const loadAnexos = async () => {
    // Busca cotacao_id da OS para pegar anexos da cotação também
    const { data: osData } = await supabase
      .from('os')
      .select('cotacao_id')
      .eq('id', osId)
      .maybeSingle();


    // Busca anexos vinculados à OS ou à cotação original
    const { data, error } = await supabase
      .from('os_anexos')
      .select('*')
      .or(`os_id.eq.${osId}${osData?.cotacao_id ? `,cotacao_id.eq.${osData.cotacao_id}` : ''}`)
      .order('created_at', { ascending: false });


    setAnexos(data || []);
  };

  const loadPagamento = async () => {
    // Busca dados de pagamento da cotação vinculada
    const { data: osData } = await supabase
      .from('os')
      .select('cotacao_id')
      .eq('id', osId)
      .maybeSingle();

    if (osData?.cotacao_id) {
      const { data: cotacaoData } = await supabase
        .from('cotacoes')
        .select(`
          *,
          forma_pagamento:formas_pagamento(nome)
        `)
        .eq('id', osData.cotacao_id)
        .maybeSingle();

      if (cotacaoData) {
        // Calcula o valor total somando peças e serviços da OS
        const totalPecas = pecas.reduce((sum, p) => sum + Number(p.valor_total || 0), 0);
        const totalServicos = servicos.reduce((sum, s) => sum + Number(s.valor_total || 0), 0);
        const valorBruto = totalPecas + totalServicos;

        // Aplica desconto
        let valorDesconto = 0;
        if (cotacaoData.desconto_valor && Number(cotacaoData.desconto_valor) > 0) {
          if (cotacaoData.desconto_tipo === 'percentual') {
            valorDesconto = valorBruto * (Number(cotacaoData.desconto_valor) / 100);
          } else {
            valorDesconto = Number(cotacaoData.desconto_valor);
          }
        }

        // Aplica taxa de cartão
        const valorComDesconto = valorBruto - valorDesconto;
        let valorTaxaCartao = 0;
        let valorFinal = valorComDesconto;

        // Se taxa_para_cliente for true, adiciona a taxa ao valor final
        if (cotacaoData.taxa_para_cliente && cotacaoData.taxa_cartao) {
          valorTaxaCartao = valorComDesconto * (Number(cotacaoData.taxa_cartao) / 100);
          valorFinal = valorComDesconto + valorTaxaCartao;
        } else {
          // Taxa absorvida pela empresa, não afeta o valor final
          valorTaxaCartao = 0;
          valorFinal = valorComDesconto;
        }

        setPagamento({
          ...cotacaoData,
          valor_total: valorFinal,
          valor_bruto: valorBruto,
          valor_desconto: valorDesconto,
          valor_taxa_cartao: valorTaxaCartao
        });
      }
    }
  };

  const loadCurrentJob = async () => {
    const { data } = await supabase
      .from('jobs')
      .select('*')
      .eq('os_id', osId)
      .eq('modulo', 'pipeline_operacional')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    setCurrentJob(data);
  };

  const syncGSPN = async () => {
    if (!os?.numero_os_samsung) {
      alert('Esta OS não possui número Samsung para sincronizar');
      return;
    }

    if (currentJob?.is_running) {
      alert('Já existe uma sincronização em andamento para esta OS');
      return;
    }

    setSyncingGSPN(true);
    try {
      const { data: unidadeData } = await supabase
        .from('unidades')
        .select('nome, samsung_asccode, samsung_token')
        .eq('id', os.unidade_id)
        .single();

      if (!unidadeData) {
        alert('Unidade não encontrada');
        return;
      }

      if (!unidadeData.samsung_asccode || !unidadeData.samsung_token) {
        alert('Unidade sem configuração Samsung (ASC Code ou Token não configurados)');
        return;
      }

      const response = await fetch('https://groupglobal.app.n8n.cloud/webhook/atualizar-os/one', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ascCode: unidadeData.samsung_asccode,
          tokenApi: unidadeData.samsung_token,
          filial: unidadeData.nome.toLowerCase(),
          unidade_id: os.unidade_id,
          numero_os: os.numero_os_samsung
        }),
      });

      const result = await response.json();

      if (response.ok && result.status === 'success') {
        await loadOS();

        // Começa polling imediato para pegar o job
        const startPolling = async () => {
          let attempts = 0;
          const maxAttempts = 20; // 10 segundos

          while (attempts < maxAttempts) {
            await loadCurrentJob();

            // Verifica se o job foi encontrado
            const { data: jobCheck } = await supabase
              .from('jobs')
              .select('*')
              .eq('os_id', osId)
              .eq('modulo', 'pipeline_operacional')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (jobCheck) {
              setCurrentJob(jobCheck);
              break;
            }

            attempts++;
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        };

        startPolling();
        if (onReload) onReload();
      } else {
        alert(`Erro na sincronização: ${result.message || 'Erro desconhecido'}`);
      }
    } catch (error) {
      alert(`Erro ao sincronizar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    } finally {
      setSyncingGSPN(false);
    }
  };

  const handleGerarPDFOS = async () => {
    try {
      const { data: osData, error: osError } = await supabase
        .from('os')
        .select(`
          *,
          unidade:unidades!os_unidade_id_fkey(nome, samsung_asccode, telefone)
        `)
        .eq('id', osId)
        .maybeSingle();

      if (osError || !osData) {
        console.error('Erro ao buscar OS:', osError);
        alert(`Erro ao buscar dados da OS: ${osError?.message || 'Desconhecido'}`);
        return;
      }

      const { data: cotacaoPecas } = await supabase
        .from('cotacoes_pecas')
        .select('pn, descricao, quantidade, valor_final_unitario, valor_total')
        .eq('os_id', osId);

      const { data: cotacaoServicos } = await supabase
        .from('cotacoes_servicos')
        .select('descricao, quantidade, valor_unitario, valor_total')
        .eq('os_id', osId);

      (osData as any).cotacoes_pecas = cotacaoPecas || [];
      (osData as any).cotacoes_servicos = cotacaoServicos || [];

      const { data: pdfConfig, error: configError } = await supabase
        .from('configuracoes_pdf_os')
        .select('*')
        .or(`unidade_id.eq.${osData.unidade_id},unidade_id.is.null`)
        .order('unidade_id', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (configError) {
        alert('Erro ao buscar configurações do PDF');
        return;
      }

      if (!pdfConfig) {
        alert('Nenhuma configuração de PDF encontrada. Configure em ATOM CORE SETTINGS → PDF da OS');
        return;
      }

      const pdfBlob = await gerarPDFOrdemServico(osData as any, pdfConfig as any);

      const url = URL.createObjectURL(pdfBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `OS_${osData.numero_os_samsung || osData.numero_os_interna || osData.id}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (error: any) {
      alert(`Erro ao gerar PDF: ${error.message}`);
    }
  };

  const handleRefazerOrcamento = async () => {
    try {
      // Busca a cotação vinculada e verifica requisições em trânsito
      const { data: osData } = await supabase
        .from('os')
        .select(`
          *,
          unidade:unidades!os_unidade_id_fkey(id, nome)
        `)
        .eq('id', osId)
        .maybeSingle();

      if (!osData) {
        alert('OS não encontrada');
        return;
      }

      let cotacaoId = osData.cotacao_id;
      const cotacaoJaExistia = !!cotacaoId;

      // Se não tem cotação vinculada, cria uma automaticamente
      if (!cotacaoId) {
        const { data: novaCotacao, error: cotacaoError } = await supabase
          .from('cotacoes')
          .insert({
            numero_os_samsung: osData.numero_os_samsung,
            unidade_id: osData.unidade_id,
            tipo_os: osData.tipo_os,
            tipo_atendimento: osData.tipo_atendimento,
            tipo_orcamento: osData.tipo_orcamento,
            cliente_nome: osData.cliente_nome,
            cliente_telefone: osData.cliente_telefone,
            cliente_email: osData.cliente_email,
            cliente_cpf_cnpj: osData.cliente_cpf_cnpj,
            cliente_endereco: osData.cliente_endereco,
            cliente_cep: osData.cliente_cep,
            cliente_logradouro: osData.cliente_logradouro,
            cliente_numero: osData.cliente_numero,
            cliente_complemento: osData.cliente_complemento,
            cliente_bairro: osData.cliente_bairro,
            cliente_cidade: osData.cliente_cidade,
            cliente_estado: osData.cliente_estado,
            aparelho_marca: osData.aparelho_marca,
            aparelho_linha: osData.aparelho_linha,
            aparelho_modelo: osData.aparelho_modelo,
            aparelho_numero_serie: osData.aparelho_numero_serie,
            aparelho_imei: osData.aparelho_imei,
            defeito_relatado: osData.defeito_relatado,
            observacoes_internas: osData.observacoes_internas,
            criado_por: usuario?.id,
            status: 'pendente_preenchimento',
            versao: 1
          })
          .select('id')
          .single();

        if (cotacaoError) {
          throw new Error(`Erro ao criar cotação: ${cotacaoError.message}`);
        }

        cotacaoId = novaCotacao.id;

        // Vincula a cotação à OS
        await supabase
          .from('os')
          .update({ cotacao_id: cotacaoId })
          .eq('id', osId);
      }

      // Verifica se há peças em trânsito
      const { data: requisicoesEmTransito } = await supabase
        .from('requisicoes_pecas')
        .select('codigo_peca, descricao')
        .eq('os_id', osId)
        .eq('status', 'pedido_feito');

      let mensagemConfirmacao = 'Tem certeza que deseja refazer este orçamento? A OS será REMOVIDA do Kanban e movida de volta para Cotações para edição.';

      if (requisicoesEmTransito && requisicoesEmTransito.length > 0) {
        const listaPecas = requisicoesEmTransito
          .map(r => `  • ${r.codigo_peca} - ${r.descricao}`)
          .join('\n');

        mensagemConfirmacao = `⚠️ ATENÇÃO: Esta OS possui ${requisicoesEmTransito.length} peça(s) em trânsito!\n\nAs seguintes peças NÃO poderão ser modificadas até aprovação/cancelamento do estoque:\n\n${listaPecas}\n\n🔒 Estas peças ficarão BLOQUEADAS para edição na cotação.\n\nDeseja continuar mesmo assim?`;
      }

      if (!confirm(mensagemConfirmacao)) {
        return;
      }

      setRefazendoOrcamento(true);

      // Busca versão atual da cotação
      const { data: cotacaoData } = await supabase
        .from('cotacoes')
        .select('versao')
        .eq('id', cotacaoId)
        .maybeSingle();

      const versaoAtual = cotacaoData?.versao || 1;

      // Adiciona comentário de sistema na cotação
      const textoComentario = cotacaoJaExistia
        ? `OS #${osData.numero_os_samsung || 'sem número'} removida do Kanban - Orçamento retornado para ajustes por ${usuario?.nome || 'Usuário'}`
        : `Cotação criada automaticamente a partir da OS #${osData.numero_os_samsung || 'sem número'} movida do Kanban por ${usuario?.nome || 'Usuário'}`;

      await supabase.from('cotacao_comentarios').insert({
        cotacao_id: cotacaoId,
        usuario_id: usuario?.id,
        texto: textoComentario,
        is_system: true
      });

      // Preserva anexos antes de deletar OS (seta os_id para NULL mas mantém cotacao_id)
      await supabase
        .from('os_anexos')
        .update({ os_id: null, cotacao_id: cotacaoId })
        .eq('os_id', osId);

      // Garante que todas as requisições desta OS têm cotacao_id definido
      // (importante para manter pedidos ativos quando OS for deletada)
      await supabase
        .from('requisicoes_pecas')
        .update({ cotacao_id: cotacaoId })
        .eq('os_id', osId)
        .is('cotacao_id', null);

      // Sincroniza TODAS as peças de volta para a cotação (incluindo GSPN)
      // (garante que peças adicionadas/alteradas na OS não sejam perdidas)
      const { data: pecasOS } = await supabase
        .from('os_pecas')
        .select('*')
        .eq('os_id', osId);

      const { data: servicosOS } = await supabase
        .from('os_servicos')
        .select('*')
        .eq('os_id', osId);

      // Se a cotação já existia (refazer), deleta peças/serviços antigos para sincronizar
      if (cotacaoJaExistia) {
        await supabase
          .from('cotacoes_pecas')
          .delete()
          .eq('cotacao_id', cotacaoId);

        await supabase
          .from('cotacoes_servicos')
          .delete()
          .eq('cotacao_id', cotacaoId);
      }

      // Insere peças atualizadas da OS (se houver), incluindo peças GSPN
      if (pecasOS && pecasOS.length > 0) {
        await supabase
          .from('cotacoes_pecas')
          .insert(
            pecasOS.map(peca => ({
              cotacao_id: cotacaoId,
              pn: peca.pn,
              descricao: peca.descricao,
              quantidade: peca.quantidade,
              valor_base_gspn: peca.valor_base_gspn || 0,
              valor_final_unitario: peca.valor_unitario || 0,
              valor_total: peca.valor_total || 0,
              markup_aplicado: 0,
              is_gspn: peca.status === 'gspn' // Marca peças da API GSPN
            }))
          );
      }

      // Insere serviços atualizados da OS (se houver)
      if (servicosOS && servicosOS.length > 0) {
        await supabase
          .from('cotacoes_servicos')
          .insert(
            servicosOS.map(servico => ({
              cotacao_id: cotacaoId,
              servico_id: servico.servico_id,
              descricao: servico.descricao,
              quantidade: servico.quantidade,
              valor_unitario: servico.valor_unitario,
              valor_total: servico.valor_total,
              observacao: servico.observacao
            }))
          );
      }

      // Copia comentários da OS para a cotação (histórico completo preservado)
      const { data: comentariosOS } = await supabase
        .from('os_comentarios')
        .select('*')
        .eq('os_id', osId);

      if (comentariosOS && comentariosOS.length > 0) {
        await supabase
          .from('cotacao_comentarios')
          .insert(
            comentariosOS.map(comentario => ({
              cotacao_id: cotacaoId,
              usuario_id: comentario.usuario_id,
              texto: comentario.comentario,
              created_at: comentario.created_at
            }))
          );
      }

      // Transfere anexos para a cotação (preserva documentação)
      await supabase
        .from('os_anexos')
        .update({ cotacao_id: cotacaoId })
        .eq('os_id', osId);

      // Vincula pagamentos à cotação antes de deletar OS
      // (constraint exige que pagamentos tenham os_id OU cotacao_id)
      await supabase
        .from('pagamentos')
        .update({ cotacao_id: cotacaoId })
        .eq('os_id', osId);

      // Atualiza a cotação sincronizando TODOS os campos da OS
      // (garante que nenhuma informação seja perdida, mesmo que tenha sido alterada na OS)
      await supabase
        .from('cotacoes')
        .update({
          numero_os_samsung: osData.numero_os_samsung,
          tipo_atendimento: osData.tipo_atendimento,
          tipo_os: osData.tipo_os,
          tipo_orcamento: osData.tipo_orcamento,
          cliente_nome: osData.cliente_nome,
          cliente_telefone: osData.cliente_telefone,
          cliente_email: osData.cliente_email,
          cliente_cpf_cnpj: osData.cliente_cpf_cnpj,
          cliente_endereco: osData.cliente_endereco,
          cliente_cep: osData.cliente_cep,
          cliente_logradouro: osData.cliente_logradouro,
          cliente_numero: osData.cliente_numero,
          cliente_complemento: osData.cliente_complemento,
          cliente_bairro: osData.cliente_bairro,
          cliente_cidade: osData.cliente_cidade,
          cliente_estado: osData.cliente_estado,
          aparelho_marca: osData.aparelho_marca,
          aparelho_linha: osData.aparelho_linha,
          aparelho_modelo: osData.aparelho_modelo,
          aparelho_numero_serie: osData.aparelho_numero_serie,
          aparelho_imei: osData.aparelho_imei,
          defeito_relatado: osData.defeito_relatado,
          observacoes_internas: osData.observacoes_internas,
          status: 'pendente_preenchimento',
          versao: cotacaoJaExistia ? versaoAtual + 1 : 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', cotacaoId);

      // Deleta a OS - PostgreSQL automaticamente gerencia as foreign keys:
      // - ON DELETE CASCADE: os_pecas, os_checklist, os_comentarios
      // - ON DELETE SET NULL: requisicoes_pecas (preservadas!), cotacoes_pecas, cotacoes_servicos, os_anexos, agendamentos, estoque_pedidos, financeiro_lancamentos
      const { error: deleteError } = await supabase
        .from('os')
        .delete()
        .eq('id', osId);

      if (deleteError) {
        throw new Error(`Falha ao deletar OS: ${deleteError.message}`);
      }

      // Valida que a OS foi realmente deletada
      const { data: verificaOS } = await supabase
        .from('os')
        .select('id')
        .eq('id', osId)
        .maybeSingle();

      if (verificaOS) {
        throw new Error('OS ainda existe no banco após tentativa de deleção');
      }

      alert('✅ OS removida com sucesso! Orçamento disponível em Cotações para edição.');
      setRefazendoOrcamento(false);
      onClose();
      onReload();
    } catch (error) {
      alert(`❌ Erro ao mover orçamento: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      setRefazendoOrcamento(false);
    }
  };

  const handleAdicionarComentario = async () => {
    if (!novoComentario.trim()) return;

    try {
      await supabase
        .from('os_comentarios')
        .insert({
          os_id: osId,
          usuario_id: usuario?.id,
          comentario: novoComentario
        });

      setNovoComentario('');
      loadComentarios();
    } catch (error) {
    }
  };

  const handleRequisitarPeca = async (peca: OSPeca) => {
    try {
      if (!os?.cotacao_id) {
        alert('❌ Erro: Esta OS não possui uma cotação vinculada!\n\nNão é possível requisitar peças sem uma cotação.');
        return;
      }

      // Verifica se já existe requisição ATIVA (qualquer status exceto reprovada e devolvida) para esta peça
      // Busca tanto por os_id quanto por cotacao_id para evitar duplicações
      const { data: existente } = await supabase
        .from('requisicoes_pecas')
        .select('id, status')
        .or(`os_id.eq.${osId},cotacao_id.eq.${os.cotacao_id}`)
        .eq('cotacao_peca_id', peca.cotacao_peca_id || peca.id)
        .not('status', 'in', '(reprovada,devolvida)')
        .maybeSingle();

      if (existente) {
        const statusLabels: Record<string, string> = {
          pendente: 'PENDENTE',
          pedido_feito: 'COM PEDIDO ATIVO',
          atendida: 'JÁ ATENDIDA',
          em_uso: 'EM USO PELO TÉCNICO',
          gi_postada: 'COM GI POSTADA',
          devolucao_pendente: 'COM DEVOLUÇÃO PENDENTE'
        };
        const statusLabel = statusLabels[existente.status] || existente.status.toUpperCase();
        alert(`❌ Não é possível criar nova requisição!\n\nJá existe uma requisição ${statusLabel} para esta peça.\n\nID da requisição: ${existente.id.slice(0, 8)}`);
        return;
      }


      await supabase
        .from('requisicoes_pecas')
        .insert({
          os_id: osId,
          cotacao_id: os.cotacao_id,
          cotacao_peca_id: peca.cotacao_peca_id || peca.id,
          codigo_peca: peca.codigo || peca.pn || 'N/A',
          descricao: peca.descricao || 'Peça sem descrição',
          quantidade_requisitada: peca.quantidade || 1,
          status: 'pendente',
          requisitado_por: usuario?.id,
          unidade_id: os?.unidade_id
        });

      // Mover OS para "Aguardando Peça" se não estiver lá ainda
      if (os?.coluna_kanban !== 'aguardando_peca') {
        await supabase
          .from('os')
          .update({
            coluna_kanban: 'aguardando_peca',
            updated_at: new Date().toISOString()
          })
          .eq('id', osId);

        // Log de sistema
        await supabase.from('os_comentarios').insert({
          os_id: osId,
          usuario_id: usuario?.id,
          comentario: `OS movida para "Aguardando Peça" - requisição criada por ${usuario?.nome}`,
          is_system: true
        });
      } else {
        // Log de nova requisição
        await supabase.from('os_comentarios').insert({
          os_id: osId,
          usuario_id: usuario?.id,
          comentario: `Nova requisição de peça adicionada: ${peca.descricao}`,
          is_system: true
        });
      }

      alert('Requisição de peça criada com sucesso! OS movida para "Aguardando Peça".');
      await loadRequisicoes();
      await loadOS();
      onReload?.();
    } catch (error) {
      alert('Erro ao criar requisição de peça');
    }
  };

  const handleRequisitarNovamente = async (peca: OSPeca, requisicaoReprovada: any) => {
    if (!os?.cotacao_id) {
      alert('❌ Erro: Esta OS não possui uma cotação vinculada!\n\nNão é possível requisitar peças sem uma cotação.');
      return;
    }

    const motivo = prompt('Informe o motivo para requisitar novamente esta peça:');
    if (!motivo || !motivo.trim()) {
      alert('É necessário informar o motivo da nova requisição');
      return;
    }

    setCriandoRequisicao(true);

    try {
      // Verifica se já existe requisição ATIVA (qualquer status exceto reprovada e devolvida)
      // Busca tanto por os_id quanto por cotacao_id para evitar duplicações
      const { data: existente } = await supabase
        .from('requisicoes_pecas')
        .select('id, status')
        .or(`os_id.eq.${osId},cotacao_id.eq.${os.cotacao_id}`)
        .eq('cotacao_peca_id', peca.cotacao_peca_id || peca.id)
        .not('status', 'in', '(reprovada,devolvida)')
        .maybeSingle();

      if (existente) {
        const statusLabels: Record<string, string> = {
          pendente: 'PENDENTE',
          pedido_feito: 'COM PEDIDO ATIVO',
          atendida: 'JÁ ATENDIDA',
          em_uso: 'EM USO PELO TÉCNICO',
          gi_postada: 'COM GI POSTADA',
          devolucao_pendente: 'COM DEVOLUÇÃO PENDENTE'
        };
        const statusLabel = statusLabels[existente.status] || existente.status.toUpperCase();
        alert(`❌ Não é possível criar nova requisição!\n\nJá existe uma requisição ${statusLabel} para esta peça.\n\nID da requisição: ${existente.id.slice(0, 8)}`);
        setCriandoRequisicao(false);
        return;
      }


      const { data: novaRequisicao, error: insertError } = await supabase
        .from('requisicoes_pecas')
        .insert({
          os_id: osId,
          cotacao_id: os.cotacao_id,
          cotacao_peca_id: peca.cotacao_peca_id || peca.id,
          codigo_peca: peca.codigo || peca.pn || 'N/A',
          descricao: peca.descricao || 'Peça sem descrição',
          quantidade_requisitada: peca.quantidade || 1,
          status: 'pendente',
          requisitado_por: usuario?.id,
          unidade_id: os?.unidade_id
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // Mover OS para "Aguardando Peça" se não estiver lá ainda
      if (os?.coluna_kanban !== 'aguardando_peca') {
        await supabase
          .from('os')
          .update({
            coluna_kanban: 'aguardando_peca',
            updated_at: new Date().toISOString()
          })
          .eq('id', osId);
      }

      await supabase.from('os_comentarios').insert({
        os_id: osId,
        usuario_id: usuario?.id,
        comentario: `Nova requisição criada após reprovação anterior por ${usuario?.nome}: ${peca.descricao} (${peca.codigo || peca.pn})\nMotivo da nova requisição: ${motivo}\nReprovação anterior: ${requisicaoReprovada.motivo_reprovacao}`,
        is_system: true
      });

      // Aguarda um breve momento para garantir que o banco processou tudo
      await new Promise(resolve => setTimeout(resolve, 200));

      await loadRequisicoes();
      await loadOS();

      alert('Nova requisição criada com sucesso!');

      onReload?.();
    } catch (error) {
      alert('Erro ao criar nova requisição');
    } finally {
      setCriandoRequisicao(false);
    }
  };

  const handleAnaliseConcluida = async () => {
    if (!os?.cotacao_id) {
      alert('Esta OS nao possui uma cotacao vinculada!');
      return;
    }

    const confirmacao = confirm(
      'CONCLUIR ANALISE TECNICA\n\n' +
      'Ao confirmar, a OS sera movida para a aba Cotacoes como "Refazer Orcamento".\n\n' +
      'A cotacao ficara marcada como "Analise feita pelo tecnico" para facilitar o preenchimento.\n\n' +
      'Deseja continuar?'
    );

    if (!confirmacao) return;

    setFinalizandoAnalise(true);
    try {
      await supabase
        .from('cotacoes')
        .update({
          analise_tecnico_concluida: true,
          analise_tecnico_em: new Date().toISOString(),
          analise_tecnico_por: usuario?.id,
          status: 'pendente_preenchimento'
        })
        .eq('id', os.cotacao_id);

      await supabase.from('cotacao_comentarios').insert({
        cotacao_id: os.cotacao_id,
        usuario_id: usuario?.id,
        texto: `Analise tecnica concluida por ${usuario?.nome}. Pecas adicionadas pelo tecnico - pronto para precificar.`,
        is_system: true
      });

      await supabase.from('os_comentarios').insert({
        os_id: osId,
        usuario_id: usuario?.id,
        comentario: `Analise tecnica concluida por ${usuario?.nome}. OS enviada para precificacao.`,
        is_system: true
      });

      await supabase
        .from('os')
        .delete()
        .eq('id', osId);

      setFinalizandoAnalise(false);
      onClose();

      setTimeout(() => {
        onReload?.();
        alert(
          'ANALISE CONCLUIDA!\n\n' +
          'A cotacao foi atualizada e esta disponivel na aba Cotacoes.\n\n' +
          'Agora e so precificar as pecas e enviar o orcamento ao cliente.'
        );
      }, 100);
    } catch (error: any) {
      alert(`Erro ao finalizar analise: ${error.message || 'Erro desconhecido'}`);
      setFinalizandoAnalise(false);
    }
  };

  const handlePostarGI = async (requisicao: RequisicaoPeca) => {
    const confirmacao = confirm('Confirma o consumo (GI) desta peça?');
    if (!confirmacao) return;

    try {
      await supabase
        .from('requisicoes_pecas')
        .update({
          status: 'gi_postada',
          gi_postada_em: new Date().toISOString(),
          tipo_devolucao: 'usada',
          motivo_devolucao: 'Peça consumida - GI postada'
        })
        .eq('id', requisicao.id);

      // Log com nome do usuário
      await supabase.from('os_comentarios').insert({
        os_id: osId,
        usuario_id: usuario?.id,
        comentario: `GI postada por ${usuario?.nome}: ${requisicao.descricao} (${requisicao.codigo_peca})`,
        is_system: true
      });

      // Log no histórico da peça
      if (requisicao.peca_estoque_id) {
        await supabase.from('estoque_historico').insert({
          peca_id: requisicao.peca_estoque_id,
          usuario_id: usuario?.id,
          acao: 'gi_postada',
          status_anterior: 'vinculada_tecnico',
          status_novo: 'vinculada_tecnico',
          observacao: `GI postada por ${usuario?.nome} - Peça aguardando devolução ao estoque`
        });
      }

      alert('GI postada com sucesso!');
      await loadRequisicoes();
      onReload?.();
    } catch (error) {
      alert('Erro ao postar GI');
    }
  };

  const handleCriarChecklistPadrao = async () => {
    const itemsPadrao = [
      { item: 'Diagnóstico completo realizado', ordem: 1 },
      { item: 'Fotos do defeito tiradas (antes)', ordem: 2 },
      { item: 'Teste de funcionamento realizado (antes)', ordem: 3 },
      { item: 'Peças instaladas corretamente', ordem: 4 },
      { item: 'Teste de funcionamento realizado (após reparo)', ordem: 5 },
      { item: 'Fotos do reparo tiradas (depois)', ordem: 6 },
      { item: 'Limpeza do aparelho', ordem: 7 },
      { item: 'Verificação final de qualidade', ordem: 8 }
    ];

    try {
      const { error } = await supabase
        .from('os_checklist')
        .insert(
          itemsPadrao.map(item => ({
            os_id: osId,
            ...item
          }))
        );

      if (error) throw error;

      await loadChecklist();

      // Log no histórico
      await supabase.from('os_comentarios').insert({
        os_id: osId,
        usuario_id: usuario?.id,
        comentario: `Checklist padrão criado por ${usuario?.nome}`,
        is_system: true
      });

      alert('Checklist criado com sucesso!');
    } catch (error) {
      alert('Erro ao criar checklist');
    }
  };

  const handleToggleChecklistItem = async (itemId: string, concluido: boolean) => {
    try {
      await supabase
        .from('os_checklist')
        .update({
          concluido,
          concluido_por: concluido ? usuario?.id : null,
          concluido_em: concluido ? new Date().toISOString() : null
        })
        .eq('id', itemId);

      await loadChecklist();

      // Log no histórico
      const item = checklist.find(c => c.id === itemId);
      if (item) {
        await supabase.from('os_comentarios').insert({
          os_id: osId,
          usuario_id: usuario?.id,
          comentario: `${usuario?.nome} ${concluido ? 'concluiu' : 'desmarcou'} item do checklist: "${item.item}"`,
          is_system: true
        });
      }
    } catch (error) {
      alert('Erro ao atualizar checklist');
    }
  };

  const handleCancelarRequisicao = async (requisicao: RequisicaoPeca) => {
    const motivo = prompt('Digite o motivo do cancelamento:');
    if (!motivo || !motivo.trim()) {
      alert('É necessário informar o motivo do cancelamento');
      return;
    }

    const confirmacao = confirm(`Confirma o cancelamento desta requisição?\n\nPeça: ${requisicao.descricao}\nMotivo: ${motivo}`);
    if (!confirmacao) return;

    try {

      // Deletar requisição
      const { data: deletedData, error: deleteError } = await supabase
        .from('requisicoes_pecas')
        .delete()
        .eq('id', requisicao.id)
        .select();


      if (deleteError) {
        throw deleteError;
      }

      // Verifica se realmente deletou
      const { data: verificacao, error: verifError } = await supabase
        .from('requisicoes_pecas')
        .select('id')
        .eq('id', requisicao.id)
        .maybeSingle();


      if (verificacao) {
        throw new Error('A requisição ainda existe no banco após tentativa de deleção!');
      }


      // Atualiza o estado local imediatamente
      setRequisicoes(prev => {
        const filtered = prev.filter(r => r.id !== requisicao.id);
        return filtered;
      });

      // Log detalhado
      await supabase.from('os_comentarios').insert({
        os_id: osId,
        usuario_id: usuario?.id,
        comentario: `Requisição cancelada por ${usuario?.nome}: ${requisicao.descricao} (${requisicao.codigo_peca})\nMotivo: ${motivo}`,
        is_system: true
      });

      // Aguarda um pouco antes de recarregar
      await new Promise(resolve => setTimeout(resolve, 300));

      // Recarrega dados do servidor para garantir sincronização
      await loadRequisicoes();
      await loadComentarios();


      alert('Requisição cancelada com sucesso!');
      onReload?.();
    } catch (error) {
      alert(`Erro ao cancelar requisição: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  const handleRemoverPeca = (requisicao: RequisicaoPeca) => {
    setRequisicaoSelecionada(requisicao);
    setMostrarModalDevolucao(true);
  };

  const handleConfirmarDevolucao = async (motivo: string, tipo: 'nova' | 'nova_com_defeito' | 'usada') => {
    if (!requisicaoSelecionada) return;

    try {
      await supabase
        .from('requisicoes_pecas')
        .update({
          status: 'devolucao_pendente',
          motivo_devolucao: motivo,
          tipo_devolucao: tipo
        })
        .eq('id', requisicaoSelecionada.id);

      const tipoLabel = tipo === 'nova' ? 'Nova' : tipo === 'nova_com_defeito' ? 'Nova com Defeito' : 'Usada';

      await supabase.from('os_comentarios').insert({
        os_id: osId,
        usuario_id: usuario?.id,
        comentario: `Devolução solicitada por ${usuario?.nome} - Peça: ${requisicaoSelecionada.descricao}\nTipo: ${tipoLabel}\nMotivo: ${motivo}\n\nAguardando aprovação do estoque.`,
        is_system: true
      });

      alert('Devolução solicitada com sucesso! Aguarde aprovação do estoque.');
      await loadRequisicoes();
      onReload?.();
      setMostrarModalDevolucao(false);
      setRequisicaoSelecionada(null);
    } catch (error) {
      alert('Erro ao solicitar devolução');
      throw error;
    }
  };

  const handleCancelarGI = async (requisicao: RequisicaoPeca) => {
    const motivo = prompt('Digite o motivo do cancelamento da GI:');
    if (!motivo || !motivo.trim()) {
      alert('É necessário informar o motivo do cancelamento');
      return;
    }

    const confirmacao = confirm(
      `Confirma o cancelamento da GI desta peça?\n\n` +
      `Peça: ${requisicao.descricao}\n` +
      `Código: ${requisicao.codigo_peca}\n` +
      `Motivo: ${motivo}\n\n` +
      `A peça voltará para o status "ATENDIDA" e poderá ser devolvida ou ter a GI postada novamente.`
    );
    if (!confirmacao) return;

    try {
      // Atualizar requisição
      await supabase
        .from('requisicoes_pecas')
        .update({
          status: 'atendida',
          gi_postada_em: null
        })
        .eq('id', requisicao.id);

      // Log com nome do usuário e motivo
      await supabase
        .from('os_comentarios')
        .insert({
          os_id: osId,
          usuario_id: usuario?.id,
          comentario: `GI cancelada por ${usuario?.nome}: ${requisicao.descricao} (${requisicao.codigo_peca})\nRequisição ID: ${requisicao.id.slice(0, 8)}\nMotivo: ${motivo}`,
          is_system: true
        });

      // Log no histórico da peça
      if (requisicao.peca_estoque_id) {
        await supabase.from('estoque_historico').insert({
          peca_id: requisicao.peca_estoque_id,
          usuario_id: usuario?.id,
          acao: 'gi_cancelada',
          status_anterior: 'vinculada_tecnico',
          status_novo: 'vinculada_tecnico',
          observacao: `GI cancelada por ${usuario?.nome} - Motivo: ${motivo}`
        });
      }

      // Recarregar dados
      await loadRequisicoes();
      await loadComentarios();

      // Recarregar Kanban
      if (onReload) {
        onReload();
      }
    } catch (error) {
      alert('Erro ao cancelar GI');
    }
  };

  const handleConverterOS = async () => {
    if (!motivoConversao.trim()) {
      alert('Por favor, informe o motivo da conversão');
      return;
    }

    if (!confirmaConversao) {
      alert('Por favor, confirme que entende as consequências da conversão');
      return;
    }

    setConvertendo(true);
    try {
      const { error: updateError } = await supabase
        .from('os')
        .update({ tipo_os: 'LP' })
        .eq('id', osId);

      if (updateError) throw updateError;

      const comentariosInsert = [
        {
          os_id: osId,
          usuario_id: usuario?.id,
          comentario: `OS convertida de OW para LP por ${usuario?.nome}`,
          is_system: true
        },
        {
          os_id: osId,
          usuario_id: usuario?.id,
          comentario: `Motivo da conversão: ${motivoConversao}`,
          is_system: true
        }
      ];

      if (os?.cotacao_id) {
        comentariosInsert.push({
          os_id: osId,
          usuario_id: usuario?.id,
          comentario: 'IMPORTANTE: Esta OS possuía cotação que foi mantida no histórico',
          is_system: true
        });
      }

      const giPostadaCount = requisicoes.filter(r => r.status === 'gi_postada').length;
      if (giPostadaCount > 0) {
        comentariosInsert.push({
          os_id: osId,
          usuario_id: usuario?.id,
          comentario: `IMPORTANTE: ${giPostadaCount} peça(s) com GI postada foram mantidas no histórico`,
          is_system: true
        });
      }

      const { error: comentariosError } = await supabase
        .from('os_comentarios')
        .insert(comentariosInsert);

      if (comentariosError) throw comentariosError;

      alert('OS convertida com sucesso para LP!');
      setMostrarModalConversao(false);
      setMotivoConversao('');
      setConfirmaConversao(false);
      onReload?.();
      onClose();
    } catch (error) {
      alert('Erro ao converter OS');
    } finally {
      setConvertendo(false);
    }
  };

  const moverOS = async (targetColumn: string) => {
    if (!os || movendoOS) return;

    setMovendoOS(true);
    try {
      const { error } = await supabase
        .from('os')
        .update({
          coluna_kanban: targetColumn,
          updated_at: new Date().toISOString()
        })
        .eq('id', os.id);

      if (error) throw error;

      alert('OS movida com sucesso!');
      setMostrarMoverPara(false);
      onReload?.();
      onClose();
    } catch (error: any) {
      alert(`Erro ao mover OS: ${error.message}`);
    } finally {
      setMovendoOS(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="futuristic-loader"></div>
      </div>
    );
  }

  if (!os) return null;

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; color: string }> = {
      pendente: { label: 'PENDENTE', color: '#FFBF00' },
      atendida: { label: 'ATENDIDA', color: '#00D4FF' },
      em_uso: { label: 'EM USO', color: '#9D00FF' },
      gi_postada: { label: 'GI POSTADA', color: '#39FF14' },
      devolucao_pendente: { label: 'DEV. PENDENTE', color: '#FF6B00' },
      devolvida: { label: 'DEVOLVIDA', color: '#FF0064' },
      reprovada: { label: 'REPROVADA', color: '#FF0064' },
      pedido_feito: { label: 'PEDIDO FEITO', color: '#00D4FF' }
    };

    const config = statusConfig[status] || { label: status.toUpperCase(), color: '#6B7280' };

    return (
      <span
        className="px-2 py-1 rounded text-xs font-bold uppercase"
        style={{
          backgroundColor: `${config.color}20`,
          color: config.color,
          border: `1px solid ${config.color}60`
        }}
      >
        {config.label}
      </span>
    );
  };

  const colunaAtual = COLUNAS_KANBAN.find(c => c.id === os?.coluna_kanban);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="premium-card w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-[#00D4FF]/20">
          <div>
            <h2 className="tech-heading text-xl text-[#00D4FF]">
              ORDEM DE SERVIÇO
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {os.numero_os_samsung || os.numero_os_interna || 'N/A'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleGerarPDFOS}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all hover:bg-green-500/20"
              style={{
                background: 'linear-gradient(135deg, rgba(34,197,94,0.2) 0%, rgba(34,197,94,0.05) 100%)',
                border: '1px solid #22c55e',
                color: '#22c55e',
                boxShadow: '0 0 10px rgba(34,197,94,0.2)'
              }}
              title="Gerar PDF da Ordem de Serviço"
            >
              <FileDown className="w-4 h-4" />
              PDF
            </button>

            <div className="relative">
              <button
                onClick={() => setMostrarMoverPara(!mostrarMoverPara)}
                disabled={movendoOS}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(0,212,255,0.05) 100%)',
                  border: '1px solid #00D4FF',
                  color: '#00D4FF',
                  boxShadow: '0 0 10px rgba(0,212,255,0.2)'
                }}
              >
                <MoveHorizontal className="w-4 h-4" />
                MOVER PARA
                <ChevronDown className={`w-4 h-4 transition-transform ${mostrarMoverPara ? 'rotate-180' : ''}`} />
              </button>

              {mostrarMoverPara && (
                <div className="absolute right-0 top-full mt-2 w-72 max-h-96 overflow-y-auto premium-card p-3 z-50 cyber-scrollbar">
                  <div className="mb-3 pb-2 border-b border-[#00D4FF]/20">
                    <p className="text-xs text-gray-400">Coluna Atual:</p>
                    <p className="text-sm font-bold text-[#00D4FF]">{colunaAtual?.label || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    {COLUNAS_KANBAN.filter(c => c.id !== os.coluna_kanban).map((coluna) => (
                      <button
                        key={coluna.id}
                        onClick={() => {
                          if (window.confirm(`Mover OS para "${coluna.label}"?`)) {
                            moverOS(coluna.id);
                          }
                        }}
                        disabled={movendoOS}
                        className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all hover:bg-[#00D4FF]/10 disabled:opacity-50"
                        style={{
                          color: '#fff',
                          border: '1px solid transparent'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#00D4FF';
                          e.currentTarget.style.boxShadow = '0 0 10px rgba(0,212,255,0.2)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'transparent';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        {coluna.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {os.numero_os_samsung && (
              <button
                onClick={syncGSPN}
                disabled={syncingGSPN || currentJob?.is_running}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: 'linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(139,92,246,0.05) 100%)',
                  border: '1px solid #8B5CF6',
                  color: '#8B5CF6',
                  boxShadow: '0 0 10px rgba(139,92,246,0.2)'
                }}
                title="Sincronizar dados com Samsung GSPN"
              >
                <RefreshCw className={`w-4 h-4 ${syncingGSPN || currentJob?.is_running ? 'animate-spin' : ''}`} />
                SYNC GSPN
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 hover:bg-[#00D4FF]/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-[#00D4FF]" />
            </button>
          </div>
        </div>

        {currentJob && (
          <div className="px-6 pt-4 pb-4">
            <div
              className="p-3 rounded-lg border"
              style={(() => {
                let color = '#3B82F6'; // Azul - rodando

                if (!currentJob.is_running && currentJob.finished_at) {
                  // Cores baseadas no tempo desde a última sincronização
                  const timeSinceFinished = Date.now() - new Date(currentJob.finished_at).getTime();
                  const minutesSince = timeSinceFinished / (1000 * 60);

                  if (minutesSince <= 30) color = '#10B981'; // Verde - até 30 min
                  else if (minutesSince <= 60) color = '#F59E0B'; // Amarelo - até 1h
                  else if (minutesSince <= 90) color = '#FB923C'; // Laranja - até 1h30
                  else color = '#EF4444'; // Vermelho - mais de 1h30
                } else if (currentJob.status === 'Erro') {
                  color = '#EF4444';
                }

                return {
                  background: `linear-gradient(135deg, ${color}25 0%, ${color}08 100%)`,
                  borderColor: color
                };
              })()}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className="p-2 rounded-lg"
                    style={(() => {
                      let color = '#3B82F6';
                      if (!currentJob.is_running && currentJob.finished_at) {
                        const timeSinceFinished = Date.now() - new Date(currentJob.finished_at).getTime();
                        const minutesSince = timeSinceFinished / (1000 * 60);
                        if (minutesSince <= 30) color = '#10B981';
                        else if (minutesSince <= 60) color = '#F59E0B';
                        else if (minutesSince <= 90) color = '#FB923C';
                        else color = '#EF4444';
                      } else if (currentJob.status === 'Erro') {
                        color = '#EF4444';
                      }
                      return {
                        background: `${color}33`,
                        border: `1px solid ${color}`
                      };
                    })()}
                  >
                    {currentJob.is_running ? (
                      <RefreshCw className="w-4 h-4 animate-spin" style={{ color: '#3B82F6' }} />
                    ) : currentJob.status === 'Concluido' ? (
                      <CheckCircle className="w-4 h-4" style={(() => {
                        const timeSinceFinished = Date.now() - new Date(currentJob.finished_at).getTime();
                        const minutesSince = timeSinceFinished / (1000 * 60);
                        if (minutesSince <= 30) return { color: '#10B981' };
                        if (minutesSince <= 60) return { color: '#F59E0B' };
                        if (minutesSince <= 90) return { color: '#FB923C' };
                        return { color: '#EF4444' };
                      })()} />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-500" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">
                        {currentJob.is_running ? 'Sincronizando GSPN' : 'Última Sincronização GSPN'}
                      </h3>
                      {currentJob.is_running && (
                        <div className="flex gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: '0ms' }}></div>
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: '200ms' }}></div>
                          <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" style={{ animationDelay: '400ms' }}></div>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <p className="text-xs text-gray-400">
                        Status: <span className="font-medium" style={{ color: currentJob.is_running ? '#3B82F6' : currentJob.status === 'Concluido' ? '#22C55E' : '#EF4444' }}>
                          {currentJob.is_running ? 'Em execução' : currentJob.status === 'Concluido' ? 'Concluído' : 'Erro'}
                        </span>
                      </p>
                      <span className="text-xs text-gray-600">•</span>
                      <p className="text-xs text-gray-400">
                        Tempo: <span className="font-medium text-gray-300">
                          {elapsedSeconds < 60
                            ? `${elapsedSeconds}s`
                            : elapsedSeconds < 3600
                            ? `${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s`
                            : `${Math.floor(elapsedSeconds / 3600)}h ${Math.floor((elapsedSeconds % 3600) / 60)}m`
                          }
                        </span>
                      </p>
                    </div>
                  </div>
                </div>
                {!currentJob.is_running && currentJob.finished_at && (
                  <div className="text-right">
                    <p className="text-[10px] text-gray-500">Finalizado em</p>
                    <p className="text-xs text-gray-400 font-medium">
                      {new Date(currentJob.finished_at).toLocaleTimeString('pt-BR', {
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="flex border-b border-[#00D4FF]/20">
          {[
            { id: 'dados', label: 'Dados OS/Cliente', icon: User },
            { id: 'estoque', label: 'Estoque & Peças', icon: Package },
            { id: 'checklist', label: 'Checklist', icon: CheckSquare },
            { id: 'servicos', label: 'Serviços', icon: Wrench },
            { id: 'pagamento', label: 'Pagamento', icon: DollarSign },
            ...(os.tipo_atendimento === 'IH' ? [{ id: 'agendamento', label: 'Agendamento', icon: Calendar }] : []),
            { id: 'anexos', label: 'Anexos', icon: Paperclip },
            { id: 'comentarios', label: 'Comentários', icon: MessageSquare }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setAbaAtiva(id as AbaAtiva)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-3 text-xs font-bold uppercase tracking-wide transition-all whitespace-nowrap ${
                abaAtiva === id
                  ? 'bg-[#00D4FF]/10 text-[#00D4FF] border-b-2 border-[#00D4FF]'
                  : 'text-gray-400 hover:bg-[#00D4FF]/5 hover:text-[#00D4FF]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="text-[10px]">{label}</span>
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto cyber-scrollbar p-6">
          {abaAtiva === 'dados' && (
            <div className="space-y-6">
              <div className="premium-card p-4 bg-gradient-to-r from-[#00D4FF]/10 to-[#FFA500]/10 border-l-4 border-[#00D4FF]">
                <h3 className="text-sm font-bold text-[#00D4FF] uppercase tracking-wider mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Informações da OS
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {os.numero_os_samsung && (
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Número OS Samsung</label>
                      <p className="text-sm text-gray-300 mt-1 font-mono font-bold">{os.numero_os_samsung}</p>
                    </div>
                  )}
                  {(os as any).cotacao?.numero_cotacao && (
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Número Cotação</label>
                      <p className="text-sm text-gray-300 mt-1 font-mono font-bold">{(os as any).cotacao.numero_cotacao}</p>
                    </div>
                  )}
                  {(os as any).unidade?.nome && (
                    <div>
                      <label className="text-xs text-gray-500 uppercase">Unidade</label>
                      <p className="text-sm text-gray-300 mt-1 font-semibold uppercase">{(os as any).unidade.nome}</p>
                    </div>
                  )}
                  {os.numero_os_samsung && (
                    <>
                      <div>
                        <label className="text-xs text-gray-500 uppercase">Status</label>
                        <p className="text-sm text-gray-300 mt-1 font-medium">{(os as any).status_samsung_desc || '—'}</p>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 uppercase">Motivo</label>
                        <p className="text-sm text-gray-300 mt-1 font-medium">{(os as any).status_samsung_reason || '—'}</p>
                      </div>
                    </>
                  )}
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Tipo de Atendimento</label>
                    <div className="flex items-center gap-2 mt-1">
                      <span
                        className="px-3 py-1 rounded text-xs font-bold"
                        style={{
                          backgroundColor: os.tipo_atendimento === 'IH' ? '#10b98130' : '#f9731630',
                          color: os.tipo_atendimento === 'IH' ? '#10b981' : '#f97316',
                          border: `1px solid ${os.tipo_atendimento === 'IH' ? '#10b981' : '#f97316'}60`
                        }}
                      >
                        {os.tipo_atendimento}
                      </span>
                      <span
                        className="px-3 py-1 rounded text-xs font-bold"
                        style={{
                          backgroundColor: os.tipo_os === 'LP' ? '#FFA50030' : '#00D4FF30',
                          color: os.tipo_os === 'LP' ? '#FFA500' : '#00D4FF',
                          border: `1px solid ${os.tipo_os === 'LP' ? '#FFA500' : '#00D4FF'}60`
                        }}
                      >
                        {os.tipo_os}
                      </span>
                      {os.tipo_os === 'OW' && os.tipo_orcamento && (
                        <span
                          className="px-3 py-1 rounded text-xs font-bold"
                          style={{
                            backgroundColor: os.tipo_orcamento === 'samsung_contigo' ? '#FFA50030' : '#39FF1430',
                            color: os.tipo_orcamento === 'samsung_contigo' ? '#FFA500' : '#39FF14',
                            border: `1px solid ${os.tipo_orcamento === 'samsung_contigo' ? '#FFA500' : '#39FF14'}60`
                          }}
                        >
                          {os.tipo_orcamento === 'normal' ? 'NORMAL' :
                           os.tipo_orcamento === 'acessorios' ? 'ACESSÓRIOS' :
                           'SAMSUNG CONTIGO'}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {(() => {
                const pecasEmTransito = requisicoes.filter(req => req.status === 'pedido_feito');
                if (pecasEmTransito.length === 0) return null;

                return (
                  <div className="premium-card p-4 bg-gradient-to-r from-[#00D4FF]/10 to-transparent border-l-4 border-[#00D4FF]">
                    <h3 className="text-sm font-bold text-[#00D4FF] uppercase tracking-wider mb-4 flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Peças em Trânsito ({pecasEmTransito.length})
                    </h3>
                    <div className="space-y-3">
                      {pecasEmTransito.map((req) => {
                        const diasDesdeRequisicao = Math.floor(
                          (Date.now() - new Date(req.created_at).getTime()) / (1000 * 60 * 60 * 24)
                        );

                        return (
                          <div
                            key={req.id}
                            className="p-3 rounded-lg border"
                            style={{
                              background: 'linear-gradient(135deg, rgba(0,212,255,0.1) 0%, rgba(0,212,255,0.03) 100%)',
                              borderColor: 'rgba(0,212,255,0.3)'
                            }}
                          >
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex-1">
                                <p className="text-sm font-bold text-gray-200">{req.descricao}</p>
                                <p className="text-xs text-gray-500 mt-1">Código: {req.codigo_peca}</p>
                              </div>
                              <span
                                className="px-2 py-1 rounded text-xs font-bold"
                                style={{
                                  background: 'linear-gradient(135deg, rgba(255,191,0,0.3) 0%, rgba(255,191,0,0.15) 100%)',
                                  color: '#FFBF00',
                                  border: '1px solid rgba(255,191,0,0.5)'
                                }}
                              >
                                {diasDesdeRequisicao} dia{diasDesdeRequisicao !== 1 ? 's' : ''}
                              </span>
                            </div>
                            {req.numero_pedido_samsung && req.numero_pedido_samsung !== 'N/A' && !req.numero_pedido_samsung.startsWith('PENDENTE-') && (
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-xs text-gray-500">Pedido Samsung:</span>
                                <span className="text-xs font-mono font-bold text-[#00D4FF]">{req.numero_pedido_samsung}</span>
                              </div>
                            )}
                            {req.peca_estoque?.delivery && (
                              <div className="flex items-center gap-2">
                                <span className="text-xs text-gray-500">Delivery:</span>
                                <span className="text-xs font-mono font-bold text-[#39FF14]">{req.peca_estoque.delivery}</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              <div>
                <h3 className="text-sm font-bold text-[#00D4FF] uppercase tracking-wider mb-4 flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Cliente
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Nome</label>
                    <p className="text-sm text-gray-300 mt-1">{os.cliente_nome}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase">CPF/CNPJ</label>
                    <p className="text-sm text-gray-300 mt-1">{os.cliente_cpf_cnpj || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Telefone</label>
                    <p className="text-sm text-gray-300 mt-1">{os.cliente_telefone || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Email</label>
                    <p className="text-sm text-gray-300 mt-1">{os.cliente_email || '-'}</p>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-500 uppercase">Endereço</label>
                    <div className="grid grid-cols-4 gap-2 mt-1">
                      <div>
                        <p className="text-xs text-gray-500">CEP</p>
                        <p className="text-sm text-gray-300">{os.cliente_cep || '-'}</p>
                      </div>
                      <div className="col-span-3">
                        <p className="text-xs text-gray-500">Logradouro</p>
                        <p className="text-sm text-gray-300">{os.cliente_logradouro || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Número</p>
                        <p className="text-sm text-gray-300">{os.cliente_numero || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Complemento</p>
                        <p className="text-sm text-gray-300">{os.cliente_complemento || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Bairro</p>
                        <p className="text-sm text-gray-300">{os.cliente_bairro || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Cidade</p>
                        <p className="text-sm text-gray-300">{os.cliente_cidade || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Estado</p>
                        <p className="text-sm text-gray-300">{os.cliente_estado || '-'}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-[#00D4FF] uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Aparelho
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Linha</label>
                    <p className="text-sm text-gray-300 mt-1">{os.aparelho_linha || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Modelo</label>
                    <p className="text-sm text-gray-300 mt-1">{os.aparelho_modelo || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Nº Série</label>
                    <p className="text-sm text-gray-300 mt-1">{os.aparelho_numero_serie || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase">IMEI</label>
                    <p className="text-sm text-gray-300 mt-1">{os.aparelho_imei || '-'}</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-[#00D4FF] uppercase tracking-wider mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Serviço
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Defeito Relatado</label>
                    <p className="text-sm text-gray-300 mt-1 whitespace-pre-wrap">{os.defeito_relatado || '-'}</p>
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Observações</label>
                    <p className="text-sm text-gray-300 mt-1 whitespace-pre-wrap">{os.observacoes_internas || '-'}</p>
                  </div>
                </div>
              </div>

              <div className="premium-card p-6 border-l-4 border-[#FFA500]">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className="text-sm font-bold text-[#FFA500] uppercase tracking-wider flex items-center gap-2 mb-2">
                      <RefreshCw className="w-4 h-4" />
                      Converter Tipo de OS
                    </h3>
                    <p className="text-xs text-gray-400">
                      Converta esta OS de OW para LP. Todas as informações, anexos e requisições serão mantidos.
                    </p>
                  </div>
                  <button
                    onClick={() => setMostrarModalConversao(true)}
                    className="neon-button px-6 py-3 ml-4"
                    style={{
                      backgroundColor: '#FFA50020',
                      borderColor: '#FFA500',
                      color: '#FFA500'
                    }}
                  >
                    CONVERTER PARA LP
                  </button>
                </div>
              </div>
            </div>
          )}

          {abaAtiva === 'estoque' && (
            <div className="space-y-6">
              <div className="bg-[#00D4FF]/10 border border-[#00D4FF]/30 rounded-lg p-4">
                <h3 className="text-sm font-bold text-[#00D4FF] uppercase tracking-wider flex items-center gap-2">
                  <Package className="w-4 h-4" />
                  Gestão de Peças e Estoque
                </h3>
                <p className="text-xs text-gray-400 mt-2">
                  Requisite peças, acompanhe o status de transferência, confirme uso (GI) ou devolva peças não utilizadas.
                </p>
              </div>

              {os?.coluna_kanban === 'diagnostico' && (
                <div className="premium-card p-4 bg-[#9D4EDD]/10 border border-[#9D4EDD]/30 mb-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Microscope className="w-6 h-6 text-[#9D4EDD]" />
                      <div>
                        <p className="text-sm font-bold text-[#9D4EDD]">OS EM DIAGNOSTICO</p>
                        <p className="text-xs text-gray-400">
                          Adicione as pecas necessarias e clique em "Analise Concluida" para enviar ao orcamento
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={handleAnaliseConcluida}
                      disabled={finalizandoAnalise}
                      className="neon-button flex items-center gap-2 text-sm"
                      style={{
                        backgroundColor: '#9D4EDD20',
                        color: '#9D4EDD',
                        border: '1px solid #9D4EDD60',
                        boxShadow: '0 0 15px #9D4EDD30'
                      }}
                    >
                      {finalizandoAnalise ? (
                        <>
                          <div className="w-4 h-4 border-2 border-[#9D4EDD] border-t-transparent rounded-full animate-spin" />
                          ENVIANDO...
                        </>
                      ) : (
                        <>
                          <Microscope className="w-4 h-4" />
                          ANALISE CONCLUIDA
                        </>
                      )}
                    </button>
                  </div>
                </div>
              )}

              {pecas.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Nenhuma peça cadastrada na cotação</p>
              ) : (
                <div className="space-y-3">
                  {pecas.map((peca) => {
                    // Buscar requisição desta peça (prioriza ativas, senão pega a mais recente)
                    const requisicoesDestaPeca = requisicoes.filter(r =>
                      r.cotacao_peca_id === (peca.cotacao_peca_id || peca.id)
                    ).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                    const requisicaoAtiva = requisicoesDestaPeca.find(r =>
                      r.status !== 'devolvida' && r.status !== 'reprovada'
                    );
                    const requisicaoDevolvida = requisicoesDestaPeca.find(r =>
                      r.status === 'devolvida' || r.status === 'reprovada'
                    );
                    const requisicao = requisicaoAtiva || requisicoesDestaPeca[0];

                    // Verifica se existe nova requisição pendente após devolução/reprovação
                    const temNovaRequisicaoPendente = requisicaoAtiva && requisicaoDevolvida &&
                      requisicaoAtiva.status === 'pendente' &&
                      new Date(requisicaoAtiva.created_at) > new Date(requisicaoDevolvida.created_at);

                    return (
                      <div key={peca.id} className="premium-card p-4">
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <p className="text-sm font-bold text-gray-300">{peca.descricao || 'Sem descrição'}</p>
                              {requisicao && getStatusBadge(requisicao.status)}
                            </div>
                            <div className="flex items-center gap-4">
                              <p className="text-xs text-gray-500 mt-1">Código: {peca.codigo || peca.pn || 'N/A'}</p>
                              {requisicao?.peca_estoque?.id_numerico && (
                                <p className="text-xs font-bold mt-1" style={{ color: '#39FF14' }}>
                                  ID Atendido: #{requisicao.peca_estoque.id_numerico}
                                </p>
                              )}
                            </div>
                            <div className="flex items-center gap-4 mt-2">
                              <p className="text-xs text-gray-500">Qtd: {peca.quantidade}</p>
                              <p className="text-xs text-gray-500">
                                Unit: R$ {Number(peca.valor_unitario || 0).toFixed(2)}
                              </p>
                              <p className="text-xs font-bold text-[#39FF14]">
                                Total: R$ {Number(peca.valor_total || 0).toFixed(2)}
                              </p>
                            </div>
                            {requisicao && (
                              <p className="text-xs text-gray-500 mt-2">
                                Requisitado em: {new Date(requisicao.created_at).toLocaleString('pt-BR')}
                              </p>
                            )}
                            {requisicao?.status === 'pedido_feito' && (
                              <div className="mt-3 p-3 rounded-lg" style={{
                                backgroundColor: '#00D4FF10',
                                border: '1px solid #00D4FF60'
                              }}>
                                <div className="flex items-start gap-2">
                                  <Clock className="w-4 h-4 text-[#00D4FF] flex-shrink-0 mt-0.5" />
                                  <div className="flex-1">
                                    <p className="text-xs font-bold text-[#00D4FF] mb-1">
                                      PEÇA EM TRÂNSITO
                                    </p>
                                    {requisicao.numero_pedido_samsung && requisicao.numero_pedido_samsung !== 'N/A' && !requisicao.numero_pedido_samsung.startsWith('PENDENTE-') && (
                                      <p className="text-xs text-gray-300">
                                        Pedido Samsung: <span className="font-mono text-[#00D4FF]">{requisicao.numero_pedido_samsung}</span>
                                      </p>
                                    )}
                                    {requisicao.peca_estoque?.delivery && (
                                      <p className="text-xs text-gray-300 mt-1">
                                        Delivery: <span className="font-mono text-[#39FF14]">{requisicao.peca_estoque.delivery}</span>
                                      </p>
                                    )}
                                    <p className="text-xs text-gray-500 mt-2">
                                      Aguardando chegada da peça para aprovar e vincular ao estoque
                                    </p>
                                  </div>
                                </div>
                              </div>
                            )}
                            {(requisicao?.status === 'reprovada' || (requisicao?.status === 'em_uso' && requisicao.motivo_reprovacao)) && requisicao.motivo_reprovacao && (
                              <div className="mt-3 p-3 rounded-lg" style={{
                                backgroundColor: '#FF006410',
                                border: '1px solid #FF006460'
                              }}>
                                <div className="flex items-start gap-2">
                                  <AlertCircle className="w-4 h-4 text-[#FF0064] flex-shrink-0 mt-0.5" />
                                  <div className="flex-1">
                                    <p className="text-xs font-bold text-[#FF0064] mb-1">
                                      {requisicao.status === 'em_uso' ? 'DEVOLUÇÃO REJEITADA PELO ESTOQUE:' : 'MOTIVO DA REPROVAÇÃO:'}
                                    </p>
                                    <p className="text-xs text-gray-300">{requisicao.motivo_reprovacao}</p>
                                    {requisicao.reprovado_por_usuario && requisicao.reprovado_em && (
                                      <p className="text-xs text-gray-500 mt-2">
                                        {requisicao.status === 'em_uso' ? 'Rejeitado' : 'Reprovado'} por {requisicao.reprovado_por_usuario.nome} em{' '}
                                        {new Date(requisicao.reprovado_em).toLocaleString('pt-BR', {
                                          day: '2-digit',
                                          month: '2-digit',
                                          year: 'numeric',
                                          hour: '2-digit',
                                          minute: '2-digit'
                                        })}
                                      </p>
                                    )}
                                    {requisicao.status === 'em_uso' && (
                                      <p className="text-xs text-[#FFBF00] mt-2 italic">
                                        ⚠️ Você pode postar uma nova GI ou devolver a peça novamente
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                            {(requisicao?.status === 'devolucao_pendente' || requisicao?.status === 'devolvida') && requisicao.motivo_devolucao && (
                              <div className="mt-3 p-3 rounded-lg" style={{
                                backgroundColor: requisicao.tipo_devolucao === 'nova_com_defeito' ? '#FF006410' : '#FFBF0010',
                                border: requisicao.tipo_devolucao === 'nova_com_defeito' ? '1px solid #FF006460' : '1px solid #FFBF0060'
                              }}>
                                <div className="flex items-start gap-2">
                                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{
                                    color: requisicao.tipo_devolucao === 'nova_com_defeito' ? '#FF0064' : '#FFBF00'
                                  }} />
                                  <div className="flex-1">
                                    <p className="text-xs font-bold mb-1" style={{
                                      color: requisicao.tipo_devolucao === 'nova_com_defeito' ? '#FF0064' : '#FFBF00'
                                    }}>
                                      {requisicao.status === 'devolucao_pendente' ? 'DEVOLUÇÃO SOLICITADA' : 'PEÇA DEVOLVIDA'} - {requisicao.tipo_devolucao === 'nova' ? 'NOVA' : requisicao.tipo_devolucao === 'nova_com_defeito' ? 'COM DEFEITO' : 'USADA'}
                                    </p>
                                    <p className="text-xs text-gray-300">
                                      {requisicao.tipo_devolucao === 'nova_com_defeito' ? '⚠️ DEFEITO: ' : 'Motivo: '}
                                      {requisicao.motivo_devolucao}
                                    </p>
                                    {requisicao.status === 'devolucao_pendente' && (
                                      <p className="text-xs text-gray-500 mt-2">
                                        Aguardando aprovação do estoque
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Botões conforme status */}
                          <div className="flex gap-2">
                            {!requisicao && (
                              <button
                                onClick={() => handleRequisitarPeca(peca)}
                                className="neon-button flex items-center gap-2 text-xs px-4 py-2"
                              >
                                <Send className="w-3 h-3" />
                                REQUISITAR
                              </button>
                            )}

                            {requisicao?.status === 'pendente' && (
                              <button
                                onClick={() => handleCancelarRequisicao(requisicao)}
                                className="neon-button flex items-center gap-2 text-xs px-4 py-2"
                                style={{
                                  backgroundColor: '#FF006410',
                                  borderColor: '#FF0064',
                                  color: '#FF0064'
                                }}
                              >
                                <X className="w-3 h-3" />
                                CANCELAR
                              </button>
                            )}

                            {(requisicao?.status === 'atendida' || requisicao?.status === 'em_uso') && (
                              <>
                                <button
                                  onClick={() => handlePostarGI(requisicao)}
                                  className="neon-button flex items-center gap-2 text-xs px-4 py-2"
                                  style={{
                                    backgroundColor: '#39FF1410',
                                    borderColor: '#39FF14',
                                    color: '#39FF14'
                                  }}
                                >
                                  <Send className="w-3 h-3" />
                                  POSTAR GI
                                </button>
                                <button
                                  onClick={() => handleRemoverPeca(requisicao)}
                                  className="neon-button flex items-center gap-2 text-xs px-4 py-2"
                                  style={{
                                    backgroundColor: '#FF006410',
                                    borderColor: '#FF0064',
                                    color: '#FF0064'
                                  }}
                                >
                                  <Trash2 className="w-3 h-3" />
                                  DEVOLVER
                                </button>
                              </>
                            )}

                            {requisicao?.status === 'gi_postada' && (
                              <button
                                onClick={() => handleCancelarGI(requisicao)}
                                className="neon-button flex items-center gap-2 text-xs px-4 py-2"
                                style={{
                                  backgroundColor: '#FF006410',
                                  borderColor: '#FF0064',
                                  color: '#FF0064'
                                }}
                              >
                                <X className="w-3 h-3" />
                                CANCELAR GI
                              </button>
                            )}

                            {criandoRequisicao && (requisicao?.status === 'reprovada' || requisicao?.status === 'devolvida') && (
                              <button
                                disabled
                                className="neon-button flex items-center gap-2 text-xs px-4 py-2 opacity-60 cursor-not-allowed"
                                style={{
                                  backgroundColor: '#00D4FF20',
                                  borderColor: '#00D4FF',
                                  color: '#00D4FF'
                                }}
                              >
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                CRIANDO REQUISIÇÃO...
                              </button>
                            )}

                            {!criandoRequisicao && requisicao?.status === 'reprovada' && !temNovaRequisicaoPendente && (
                              <button
                                onClick={() => handleRequisitarNovamente(peca, requisicao)}
                                className="neon-button flex items-center gap-2 text-xs px-4 py-2"
                                style={{
                                  backgroundColor: '#FFBF0020',
                                  borderColor: '#FFBF00',
                                  color: '#FFBF00'
                                }}
                              >
                                <RefreshCw className="w-3 h-3" />
                                REQUISITAR NOVAMENTE
                              </button>
                            )}

                            {!criandoRequisicao && requisicao?.status === 'devolvida' && !temNovaRequisicaoPendente && (
                              <button
                                onClick={() => handleRequisitarNovamente(peca, requisicao)}
                                className="neon-button flex items-center gap-2 text-xs px-4 py-2"
                                style={{
                                  backgroundColor: '#39FF1420',
                                  borderColor: '#39FF14',
                                  color: '#39FF14'
                                }}
                              >
                                <RefreshCw className="w-3 h-3" />
                                REQUISITAR NOVAMENTE
                              </button>
                            )}

                            {!criandoRequisicao && temNovaRequisicaoPendente && (requisicaoDevolvida?.status === 'reprovada' || requisicaoDevolvida?.status === 'devolvida') && (
                              <button
                                disabled
                                className="neon-button flex items-center gap-2 text-xs px-4 py-2 opacity-60 cursor-not-allowed"
                                style={{
                                  backgroundColor: '#00D4FF20',
                                  borderColor: '#00D4FF',
                                  color: '#00D4FF'
                                }}
                              >
                                <RefreshCw className="w-3 h-3" />
                                NOVA REQUISIÇÃO PENDENTE
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {abaAtiva === 'checklist' && (
            <div className="space-y-6">
              <div className="bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-lg p-4">
                <h3 className="text-sm font-bold text-[#39FF14] uppercase tracking-wider flex items-center gap-2">
                  <CheckSquare className="w-4 h-4" />
                  Checklist do Reparo
                </h3>
                <p className="text-xs text-gray-400 mt-2">
                  Itens de verificação para garantir a qualidade do serviço
                </p>
              </div>

              {checklist.length === 0 ? (
                <div className="text-center py-12 premium-card">
                  <CheckSquare className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm mb-4">Nenhum item no checklist</p>
                  <button
                    onClick={handleCriarChecklistPadrao}
                    className="neon-button text-xs px-4 py-2"
                    style={{
                      backgroundColor: '#39FF1420',
                      color: '#39FF14',
                      borderColor: '#39FF1460'
                    }}
                  >
                    CRIAR CHECKLIST PADRÃO
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {checklist.map((item) => (
                    <div key={item.id} className="premium-card p-4 hover-lift">
                      <div className="flex items-start gap-3">
                        <button
                          onClick={() => handleToggleChecklistItem(item.id, !item.concluido)}
                          className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-all ${
                            item.concluido
                              ? 'bg-[#39FF14]/20 border-[#39FF14]'
                              : 'border-gray-500 hover:border-[#39FF14]'
                          }`}
                        >
                          {item.concluido && <CheckSquare className="w-4 h-4 text-[#39FF14]" />}
                        </button>
                        <div className="flex-1">
                          <p className={`text-sm ${item.concluido ? 'line-through text-gray-500' : 'text-gray-200'}`}>
                            {item.item}
                          </p>
                          {item.concluido && (
                            <p className="text-xs text-gray-500 mt-1">
                              Concluído por {item.concluido_por?.nome || 'Desconhecido'} em{' '}
                              {new Date(item.concluido_em).toLocaleString('pt-BR')}
                            </p>
                          )}
                        </div>
                      </div>
                      {item.observacao && (
                        <p className="text-xs text-gray-400 mt-2 ml-8">Obs: {item.observacao}</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {abaAtiva === 'servicos' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-[#00D4FF] uppercase tracking-wider mb-4">Serviços</h3>

              {servicos.length === 0 ? (
                <div className="text-center py-12">
                  <Wrench className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">Nenhum serviço adicionado</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#00D4FF]/20">
                        <th className="text-left text-xs font-bold text-[#00D4FF] uppercase py-3 px-2">Código</th>
                        <th className="text-left text-xs font-bold text-[#00D4FF] uppercase py-3 px-2">Descrição</th>
                        <th className="text-center text-xs font-bold text-[#00D4FF] uppercase py-3 px-2">Qtd</th>
                        <th className="text-right text-xs font-bold text-[#00D4FF] uppercase py-3 px-2">Valor Unit.</th>
                        <th className="text-right text-xs font-bold text-[#00D4FF] uppercase py-3 px-2">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {servicos.map((servico) => (
                        <tr key={servico.id} className="border-b border-gray-800">
                          <td className="py-3 px-2 text-sm text-gray-300">{servico.codigo_servico}</td>
                          <td className="py-3 px-2 text-sm text-gray-300">
                            <div>{servico.descricao}</div>
                            {servico.observacao && (
                              <div className="text-xs text-gray-500 mt-1">{servico.observacao}</div>
                            )}
                          </td>
                          <td className="py-3 px-2 text-sm text-gray-300 text-center">{servico.quantidade}</td>
                          <td className="py-3 px-2 text-sm text-gray-300 text-right">
                            R$ {Number(servico.valor_unitario || 0).toFixed(2)}
                          </td>
                          <td className="py-3 px-2 text-sm font-bold text-[#39FF14] text-right">
                            R$ {Number(servico.valor_total || 0).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-[#00D4FF]/30">
                        <td colSpan={4} className="py-3 px-2 text-right text-sm font-bold text-[#00D4FF] uppercase">
                          Total Serviços:
                        </td>
                        <td className="py-3 px-2 text-right text-lg font-bold text-[#39FF14]">
                          R$ {servicos.reduce((sum, s) => sum + Number(s.valor_total || 0), 0).toFixed(2)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {abaAtiva === 'pagamento' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-[#00D4FF] uppercase tracking-wider mb-4">Informações de Pagamento</h3>

              {!pagamento ? (
                <div className="text-center py-12">
                  <DollarSign className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">Nenhuma informação de pagamento</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Valor Final */}
                  <div className="premium-card p-6 bg-gradient-to-br from-[#39FF14]/10 to-transparent border-2 border-[#39FF14]/30">
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-gray-400 uppercase">Valor Total</span>
                      <span className="text-3xl font-bold text-[#39FF14]">
                        R$ {Number(pagamento.valor_total || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Botão Refazer Orçamento - sempre visível para OS do tipo OW */}
              <div className="premium-card p-6 bg-[#FFBF00]/5 border border-[#FFBF00]/20">
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-4">Ajustes Necessários?</p>
                <button
                  onClick={handleRefazerOrcamento}
                  disabled={refazendoOrcamento}
                  className="w-full neon-button bg-[#FFBF00]/10 hover:bg-[#FFBF00]/20 border border-[#FFBF00]/30 text-[#FFBF00] py-3 px-6 rounded-lg font-bold uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {refazendoOrcamento ? '⏳ Processando...' : '🔄 Refazer Orçamento'}
                </button>
                <p className="text-xs text-gray-500 mt-3 text-center">
                  Move a OS de volta para Cotações para editar peças, serviços ou valores
                </p>
              </div>
            </div>
          )}

          {abaAtiva === 'pagamento' && (
            <OSPagamentoTab
              osId={osId}
              os={os}
              onUpdate={async () => {
                await loadOS();
                onReload?.();
              }}
            />
          )}

          {abaAtiva === 'anexos' && (
            <div className="space-y-4">
              <div className="flex gap-3">
                <label className="neon-button flex-1 flex items-center justify-center gap-2 px-4 py-3 cursor-pointer">
                  <Paperclip className="w-4 h-4" />
                  ADICIONAR ANEXO
                  <input
                    type="file"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;

                      if (file.size > 10 * 1024 * 1024) {
                        alert('Arquivo muito grande! Maximo 10MB');
                        return;
                      }

                      try {
                        const fileName = `${osId}/${Date.now()}_${file.name}`;

                        const { error: uploadError } = await supabase.storage
                          .from('os-anexos')
                          .upload(fileName, file);

                        if (uploadError) throw uploadError;

                        const { data: { publicUrl } } = supabase.storage
                          .from('os-anexos')
                          .getPublicUrl(fileName);

                        await supabase.from('os_anexos').insert({
                          os_id: osId,
                          nome_arquivo: file.name,
                          url: publicUrl,
                          tamanho_bytes: file.size,
                          tipo_arquivo: file.type
                        });

                        await supabase.from('os_comentarios').insert({
                          os_id: osId,
                          usuario_id: usuario?.id,
                          comentario: `Anexo adicionado: ${file.name}`,
                          is_system: true
                        });

                        loadAnexos();
                        loadComentarios();
                        alert('Anexo adicionado com sucesso!');
                      } catch (error) {
                        alert('Erro ao adicionar anexo');
                      }

                      e.target.value = '';
                    }}
                  />
                </label>

              </div>

              <div className="space-y-3">
                {anexos.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">Nenhum anexo</p>
                ) : (
                  anexos.map((anexo: any) => (
                    <div key={anexo.id} className="premium-card p-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Paperclip className="w-4 h-4 text-[#00D4FF]" />
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-gray-300">{anexo.nome_arquivo}</p>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            <span>{((anexo.tamanho_bytes || 0) / 1024).toFixed(2)} KB</span>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setAnexoPreview(anexo)}
                          className="neon-button text-xs px-4 py-2"
                        >
                          Abrir
                        </button>
                        <button
                          onClick={async () => {
                            if (!confirm('Deseja realmente excluir este anexo?')) return;

                            try {
                              const fileName = anexo.url.split('/').pop();
                              if (fileName) {
                                await supabase.storage.from('os-anexos').remove([`${osId}/${fileName}`]);
                              }

                              await supabase.from('os_anexos').delete().eq('id', anexo.id);

                              await supabase.from('os_comentarios').insert({
                                os_id: osId,
                                usuario_id: usuario?.id,
                                comentario: `🗑️ Anexo removido: ${anexo.nome_arquivo}`,
                                is_system: true
                              });

                              loadAnexos();
                              loadComentarios();
                              alert('Anexo excluído com sucesso!');
                            } catch (error) {
                              alert('Erro ao excluir anexo');
                            }
                          }}
                          className="neon-button text-xs px-4 py-2"
                          style={{
                            backgroundColor: '#FF006410',
                            borderColor: '#FF0064',
                            color: '#FF0064'
                          }}
                        >
                          Excluir
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {abaAtiva === 'agendamento' && (
            <OSAgendamentoTab
              osId={osId}
              unidadeId={os.unidade_id}
              tipoAtendimento={os.tipo_atendimento}
              dataAgendamento={os.data_agendamento}
              tecnicoAgendadoId={os.tecnico_agendado_id}
              confirmadoComCliente={os.confirmado_com_cliente}
              periodoAgendamento={os.periodo_agendamento}
              tipoReparo={os.tipo_reparo}
              colunaKanban={os.coluna_kanban}
              onSave={async () => {
                await loadOS();
                onReload?.();
              }}
            />
          )}

          {abaAtiva === 'comentarios' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="Adicionar comentário..."
                  value={novoComentario}
                  onChange={(e) => setNovoComentario(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAdicionarComentario()}
                  className="neon-input flex-1"
                />
                <button
                  onClick={handleAdicionarComentario}
                  className="neon-button px-6"
                >
                  Enviar
                </button>
              </div>

              <div className="mb-4 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="mostrarSistema"
                  checked={mostrarComentariosSistema}
                  onChange={(e) => setMostrarComentariosSistema(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="mostrarSistema" className="text-xs text-gray-400">
                  Mostrar logs do sistema
                </label>
              </div>

              <div className="space-y-3">
                {comentarios.filter(c => mostrarComentariosSistema || !c.is_system).length === 0 ? (
                  <p className="text-center text-gray-500 py-8">Nenhum comentário ainda</p>
                ) : (
                  comentarios
                    .filter(c => mostrarComentariosSistema || !c.is_system)
                    .map((comentario) => (
                      <div
                        key={comentario.id}
                        className={`premium-card p-4 ${comentario.is_system ? 'border-l-4 border-blue-500/50 bg-blue-500/5' : ''}`}
                      >
                        {comentario.is_system ? (
                          <p className="text-xs text-blue-400 font-bold mb-1">
                            🤖 SISTEMA {comentario.usuario?.nome && `- ${comentario.usuario.nome}`}
                          </p>
                        ) : (
                          <p className="text-xs text-gray-400 font-bold mb-1">
                            👤 {comentario.usuario?.nome || 'Usuário'}
                          </p>
                        )}
                        <p className="text-sm text-gray-300">{comentario.comentario}</p>
                        <p className="text-xs text-gray-500 mt-2">
                          {new Date(comentario.created_at).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {mostrarModalConversao && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="premium-card w-full max-w-2xl border-[#FFA500]">
            <div className="p-6 border-b border-[#FFA500]/20">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-[#FFA500] flex items-center gap-2">
                  <RefreshCw className="w-6 h-6" />
                  CONVERTER OS OW → LP
                </h2>
                <button
                  onClick={() => {
                    setMostrarModalConversao(false);
                    setMotivoConversao('');
                    setConfirmaConversao(false);
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="bg-[#FFA500]/10 border border-[#FFA500]/30 rounded-lg p-4">
                <h3 className="text-sm font-bold text-[#FFA500] uppercase mb-3">Informações da OS</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Número:</span>
                    <span className="text-gray-300 ml-2">#{os.numero_sequencial}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Tipo Atual:</span>
                    <span className="text-[#00D4FF] ml-2 font-bold">OW</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Tipo Destino:</span>
                    <span className="text-[#FFA500] ml-2 font-bold">LP</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Status:</span>
                    <span className="text-gray-300 ml-2">{os.coluna_kanban}</span>
                  </div>
                </div>
              </div>

              {(os.cotacao_id || requisicoes.some(r => r.status === 'gi_postada')) && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <h3 className="text-sm font-bold text-yellow-400 uppercase mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Avisos Importantes
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-300">
                    {os.cotacao_id && (
                      <li className="flex items-start gap-2">
                        <span className="text-yellow-400 mt-1">⚠</span>
                        <span>Esta OS possui cotação associada que será mantida no histórico</span>
                      </li>
                    )}
                    {requisicoes.some(r => r.status === 'gi_postada') && (
                      <li className="flex items-start gap-2">
                        <span className="text-yellow-400 mt-1">⚠</span>
                        <span>Existem peças com GI postada que serão mantidas no histórico</span>
                      </li>
                    )}
                  </ul>
                </div>
              )}

              <div>
                <label className="text-sm font-bold text-gray-300 uppercase mb-2 block">
                  Motivo da Conversão *
                </label>
                <textarea
                  value={motivoConversao}
                  onChange={(e) => setMotivoConversao(e.target.value)}
                  className="neon-input w-full"
                  rows={4}
                  placeholder="Informe o motivo da conversão..."
                />
              </div>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="confirmacao"
                  checked={confirmaConversao}
                  onChange={(e) => setConfirmaConversao(e.target.checked)}
                  className="mt-1 w-4 h-4"
                />
                <label htmlFor="confirmacao" className="text-sm text-gray-300 cursor-pointer">
                  Confirmo que entendo as consequências desta conversão e que todas as informações, anexos e requisições serão mantidos
                </label>
              </div>

              <div className="flex gap-4 justify-end pt-4 border-t border-gray-700">
                <button
                  onClick={() => {
                    setMostrarModalConversao(false);
                    setMotivoConversao('');
                    setConfirmaConversao(false);
                  }}
                  className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
                  disabled={convertendo}
                >
                  CANCELAR
                </button>
                <button
                  onClick={handleConverterOS}
                  disabled={convertendo || !motivoConversao.trim() || !confirmaConversao}
                  className="neon-button px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    backgroundColor: '#FFA50020',
                    borderColor: '#FFA500',
                    color: '#FFA500'
                  }}
                >
                  {convertendo ? 'CONVERTENDO...' : 'CONFIRMAR CONVERSÃO'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {anexoPreview && (
        <AnexoPreviewModal
          anexo={anexoPreview}
          onClose={() => setAnexoPreview(null)}
        />
      )}

      {mostrarModalDevolucao && requisicaoSelecionada && (
        <DevolucaoModal
          isOpen={mostrarModalDevolucao}
          onClose={() => {
            setMostrarModalDevolucao(false);
            setRequisicaoSelecionada(null);
          }}
          onConfirm={handleConfirmarDevolucao}
          requisicao={{
            codigo_peca: requisicaoSelecionada.codigo_peca,
            descricao: requisicaoSelecionada.descricao
          }}
          tipoOS={os?.tipo_os || 'OW'}
        />
      )}
    </div>
  );
}
