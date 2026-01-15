import { useEffect, useState } from 'react';
import { X, User, Package, FileText, MessageSquare, Paperclip, Send, Trash2, CheckSquare, AlertCircle, AlertTriangle, Clock, QrCode, RefreshCw, Loader2, MoveHorizontal, ChevronDown, Calendar, CheckCircle, XCircle, DollarSign, Wrench, Save, Upload, CreditCard, Search, Plus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { buscarCEP, formatarCEP } from '../lib/cep';
import { OSAgendamentoTab } from './OSAgendamentoTab';
import { OSPagamentoTab } from './OSPagamentoTab';
import { DevolucaoModal } from './DevolucaoModal';
import { OSChecklistTab } from './OSChecklistTab';
import type { Database } from '../lib/database.types';

const COLUNAS_KANBAN = [
  { id: 'os_nova', label: 'OS Nova' },
  { id: 'diagnostico', label: 'Diagnóstico' },
  { id: 'negociacao_em_andamento', label: 'Negociação em Andamento' },
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
type OSComentario = Database['public']['Tables']['os_comentarios']['Row'];
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
}

interface OSLPModalProps {
  osId: string | null;
  onClose: () => void;
  onReload?: () => void;
  mode?: 'create' | 'view';
  tipoOS?: 'LP' | 'OW';
}

type AbaAtiva = 'dados' | 'estoque' | 'checklist' | 'servicos' | 'pagamento' | 'anexos' | 'comentarios' | 'agendamento';

export function OSLPModal({ osId, onClose, onReload, mode = 'view', tipoOS = 'LP' }: OSLPModalProps) {
  const { usuario } = useAuth();
  const [currentOsId, setCurrentOsId] = useState<string | null>(osId);
  const [currentMode, setCurrentMode] = useState<'create' | 'view'>(mode);
  const [os, setOS] = useState<OS | null>(null);
  const [pecas, setPecas] = useState<OSPeca[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [requisicoes, setRequisicoes] = useState<RequisicaoPeca[]>([]);
  const [comentarios, setComentarios] = useState<OSComentario[]>([]);
  const [anexos, setAnexos] = useState<OSAnexo[]>([]);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [novoComentario, setNovoComentario] = useState('');
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>('dados');
  const [loading, setLoading] = useState(currentMode === 'view');
  const [mostrarComentariosSistema, setMostrarComentariosSistema] = useState(true);
  const [mostrarModalConversao, setMostrarModalConversao] = useState(false);
  const [motivoConversao, setMotivoConversao] = useState('');
  const [confirmaConversao, setConfirmaConversao] = useState(false);
  const [convertendo, setConvertendo] = useState(false);
  const [mostrarMoverPara, setMostrarMoverPara] = useState(false);
  const [movendoOS, setMovendoOS] = useState(false);
  const [mostrarModalDevolucao, setMostrarModalDevolucao] = useState(false);
  const [requisicaoSelecionada, setRequisicaoSelecionada] = useState<RequisicaoPeca | null>(null);

  // Estados para criação de nova OS
  const [unidades, setUnidades] = useState<Array<{ id: string; nome: string }>>([]);
  const [unidadeId, setUnidadeId] = useState('');
  const [tipoAtendimento, setTipoAtendimento] = useState<'IH' | 'CI'>('CI');
  const [tipoOrcamento, setTipoOrcamento] = useState<'normal' | 'garantia' | 'cortesia'>('normal');
  const [numeroOSSamsung, setNumeroOSSamsung] = useState('');
  const [clienteNome, setClienteNome] = useState('');
  const [clienteCPF, setClienteCPF] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [clienteTelefone2, setClienteTelefone2] = useState('');
  const [clienteEmail, setClienteEmail] = useState('');
  const [clienteCEP, setClienteCEP] = useState('');
  const [clienteLogradouro, setClienteLogradouro] = useState('');
  const [clienteNumero, setClienteNumero] = useState('');
  const [clienteComplemento, setClienteComplemento] = useState('');
  const [clienteBairro, setClienteBairro] = useState('');
  const [clienteCidade, setClienteCidade] = useState('');
  const [clienteEstado, setClienteEstado] = useState('');
  const [buscandoCEP, setBuscandoCEP] = useState(false);
  const [aparelhoLinha, setAparelhoLinha] = useState('');
  const [aparelhoModelo, setAparelhoModelo] = useState('');
  const [aparelhoSerie, setAparelhoSerie] = useState('');
  const [aparelhoIMEI, setAparelhoIMEI] = useState('');
  const [defeitoRelatado, setDefeitoRelatado] = useState('');
  const [observacoesInternas, setObservacoesInternas] = useState('');
  const [clienteEncontrado, setClienteEncontrado] = useState(false);

  // Estados temporários para modo de criação - requisições
  const [requisicoesTemporarias, setRequisicoesTemporarias] = useState<Array<{
    codigo: string;
    descricao: string;
    quantidade: number;
  }>>([]);
  const [pecasAdicionadas, setPecasAdicionadas] = useState<Array<{
    codigo: string;
    descricao: string;
    valor: number;
    requisitada: boolean;
  }>>([]);
  const [servicosAdicionados, setServicosAdicionados] = useState<Array<{
    codigo: string;
    descricao: string;
    valor_unitario: number;
    quantidade: number;
  }>>([]);
  const [pagamentosTemporarios, setPagamentosTemporarios] = useState<Array<{
    forma_pagamento: string;
    valor: number;
    data_pagamento: string;
    observacoes?: string;
    nsu?: string;
    pix_id_transacao?: string;
    parcelamento?: number;
    taxa_percentual?: number;
    taxa_paga_por?: 'cliente' | 'empresa';
    comprovante?: File;
  }>>([]);
  const [checklistTemporario, setChecklistTemporario] = useState<Array<{
    descricao: string;
    concluido: boolean;
  }>>([]);
  const [checklistsDisponiveis, setChecklistsDisponiveis] = useState<any[]>([]);
  const [checklistsSelecionados, setChecklistsSelecionados] = useState<string[]>([]);
  const [anexosTemporarios, setAnexosTemporarios] = useState<Array<{
    file: File;
    nome: string;
  }>>([]);
  const [comentariosTemporarios, setComentariosTemporarios] = useState<string[]>([]);

  // Estados para adicionar requisição
  const [novaPecaCodigo, setNovaPecaCodigo] = useState('');
  const [novaPecaDescricao, setNovaPecaDescricao] = useState('');
  const [novaPecaQuantidade, setNovaPecaQuantidade] = useState(1);
  const [novaPecaValor, setNovaPecaValor] = useState('');
  const [novaPecaValorComMarkup, setNovaPecaValorComMarkup] = useState<number | null>(null);
  const [sugestoesPecas, setSugestoesPecas] = useState<Array<{
    pn: string;
    descricao: string;
    valor_com_impostos: number;
    valor_corrigido?: number;
    count: number;
  }>>([]);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
  const [mostrarModalServico, setMostrarModalServico] = useState(false);
  const [servicosCadastrados, setServicosCadastrados] = useState<any[]>([]);
  const [servicoSelecionado, setServicoSelecionado] = useState<any>(null);
  const [quantidadeServico, setQuantidadeServico] = useState(1);
  const [buscaServico, setBuscaServico] = useState('');
  const [syncingGSPN, setSyncingGSPN] = useState(false);
  const [currentJob, setCurrentJob] = useState<any>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [, setTimeUpdate] = useState(0);
  const [novoItemChecklist, setNovoItemChecklist] = useState('');

  // Estados para modal de pagamento no modo create
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const [novoPagamentoForma, setNovoPagamentoForma] = useState<'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | 'transferencia' | 'boleto' | 'outro'>('pix');
  const [novoPagamentoValor, setNovoPagamentoValor] = useState('');
  const [novoPagamentoNSU, setNovoPagamentoNSU] = useState('');
  const [novoPagamentoPixId, setNovoPagamentoPixId] = useState('');
  const [novoPagamentoParcelamento, setNovoPagamentoParcelamento] = useState('1');
  const [novoPagamentoTaxa, setNovoPagamentoTaxa] = useState('0');
  const [novoPagamentoTaxaPagaPor, setNovoPagamentoTaxaPagaPor] = useState<'cliente' | 'empresa'>('empresa');
  const [novoPagamentoComprovante, setNovoPagamentoComprovante] = useState<File | null>(null);
  const [novoPagamentoObservacoes, setNovoPagamentoObservacoes] = useState('');

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
    if (currentMode === 'create') {
      loadUnidades();
      if (usuario?.unidade_id) {
        setUnidadeId(usuario.unidade_id);
      }
    } else if (currentOsId) {
      loadOS();
      loadPecas();
      loadRequisicoes();
      loadServicos();
      loadChecklist();
      loadComentarios();
      loadAnexos();
    }
  }, [currentOsId, currentMode]);

  // Debounce para buscar sugestões
  useEffect(() => {
    const timer = setTimeout(() => {
      if (novaPecaCodigo && novaPecaCodigo.length >= 2) {
        buscarSugestoesPecas(novaPecaCodigo);
      } else {
        setSugestoesPecas([]);
        setMostrarSugestoes(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [novaPecaCodigo, unidadeId]);

  // Carregar serviços quando a aba de serviços é aberta no modo criar
  useEffect(() => {
    if (currentMode === 'create' && abaAtiva === 'servicos' && tipoOS === 'OW' && unidadeId) {
      loadServicosCadastrados();
    }
  }, [currentMode, abaAtiva, tipoOS, unidadeId]);

  // Carregar checklists quando a aba de checklist é aberta no modo criar
  useEffect(() => {
    if (currentMode === 'create' && abaAtiva === 'checklist' && unidadeId) {
      loadChecklistsDisponiveis();
    }
  }, [currentMode, abaAtiva, tipoOS, tipoAtendimento, unidadeId]);

  useEffect(() => {
    if (currentMode === 'view' && currentOsId) {
      loadCurrentJob();

      const channel = supabase
        .channel('jobs-changes-lp')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `os_id=eq.${currentOsId}`
        }, (payload) => {
          loadCurrentJob();
        })
        .subscribe((status) => {
        });

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [currentOsId, currentMode]);

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

  const loadCurrentJob = async () => {
    if (!currentOsId) {
      return;
    }


    const { data, error} = await supabase
      .from('jobs')
      .select('*')
      .eq('os_id', currentOsId)
      .eq('modulo', 'pipeline_operacional')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return;
    }


    if (data) {
      setCurrentJob(data);
    } else {
      setCurrentJob(null);
    }
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
        setSyncingGSPN(false);
        return;
      }

      if (!unidadeData.samsung_asccode || !unidadeData.samsung_token) {
        alert('Unidade sem configuração Samsung (ASC Code ou Token não configurados)');
        setSyncingGSPN(false);
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

      if (!response.ok) {
        const result = await response.json();
        alert(`Erro ao iniciar sincronização: ${result.message || 'Erro desconhecido'}`);
        setSyncingGSPN(false);
      } else {
        setSyncingGSPN(false);

        let attempts = 0;
        const maxAttempts = 10;

        const checkJob = async () => {
          attempts++;

          const { data: job, error } = await supabase
            .from('jobs')
            .select('*')
            .eq('os_id', currentOsId)
            .eq('modulo', 'pipeline_operacional')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (error) {
          }


          if (job) {
            setCurrentJob(job);
          } else if (attempts < maxAttempts) {
            setTimeout(checkJob, 2000);
          } else {
          }
        };

        setTimeout(checkJob, 2000);
      }
    } catch (error) {
      alert(`Erro ao sincronizar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      setSyncingGSPN(false);
    }
  };

  const loadUnidades = async () => {
    const { data } = await supabase
      .from('unidades')
      .select('id, nome')
      .eq('ativa', true)
      .order('nome');
    setUnidades(data || []);
  };

  const handleBuscarCEP = async (cep: string) => {
    if (!cep || cep.replace(/\D/g, '').length !== 8) return;

    setBuscandoCEP(true);
    try {
      const endereco = await buscarCEP(cep);
      if (endereco) {
        setClienteLogradouro(endereco.logradouro);
        setClienteBairro(endereco.bairro);
        setClienteCidade(endereco.localidade);
        setClienteEstado(endereco.uf);
        setClienteComplemento(endereco.complemento || '');
      }
    } catch (error) {
      alert('Erro ao buscar CEP. Verifique o CEP digitado ou preencha manualmente.');
    } finally {
      setBuscandoCEP(false);
    }
  };

  const buscarCliente = async (cpfCnpj: string) => {
    if (!cpfCnpj || cpfCnpj.length < 11) {
      setClienteEncontrado(false);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('clientes')
        .select('*')
        .eq('cpf_cnpj', cpfCnpj)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setClienteNome(data.nome);
        setClienteTelefone(data.telefone || '');
        setClienteEmail(data.email || '');
        setClienteCEP(data.cep || '');
        setClienteLogradouro(data.logradouro || '');
        setClienteNumero(data.numero || '');
        setClienteComplemento(data.complemento || '');
        setClienteBairro(data.bairro || '');
        setClienteCidade(data.cidade || '');
        setClienteEstado(data.estado || '');
        setClienteEncontrado(true);
      } else {
        setClienteEncontrado(false);
      }
    } catch (error) {
      setClienteEncontrado(false);
    }
  };

  const salvarOuAtualizarCliente = async () => {
    if (!clienteCPF || !clienteNome) return;

    try {
      const { data: clienteExistente } = await supabase
        .from('clientes')
        .select('id')
        .eq('cpf_cnpj', clienteCPF)
        .maybeSingle();

      const enderecoCompleto = [
        clienteLogradouro,
        clienteNumero,
        clienteComplemento,
        clienteBairro,
        clienteCidade,
        clienteEstado
      ].filter(Boolean).join(', ');

      if (clienteExistente) {
        await supabase
          .from('clientes')
          .update({
            nome: clienteNome,
            telefone: clienteTelefone || null,
            email: clienteEmail || null,
            endereco: enderecoCompleto || null,
            cep: clienteCEP || null,
            logradouro: clienteLogradouro || null,
            numero: clienteNumero || null,
            complemento: clienteComplemento || null,
            bairro: clienteBairro || null,
            cidade: clienteCidade || null,
            estado: clienteEstado || null,
            updated_at: new Date().toISOString()
          })
          .eq('id', clienteExistente.id);
      } else {
        await supabase.from('clientes').insert({
          cpf_cnpj: clienteCPF,
          nome: clienteNome,
          telefone: clienteTelefone || null,
          email: clienteEmail || null,
          endereco: enderecoCompleto || null,
          cep: clienteCEP || null,
          logradouro: clienteLogradouro || null,
          numero: clienteNumero || null,
          complemento: clienteComplemento || null,
          bairro: clienteBairro || null,
          cidade: clienteCidade || null,
          estado: clienteEstado || null
        });
      }
    } catch (error) {
    }
  };

  const loadOS = async () => {
    if (!currentOsId) return;
    try {
      const { data, error } = await supabase
        .from('os')
        .select(`
          *,
          unidade:unidades!os_unidade_id_fkey(nome),
          cotacao:cotacoes!os_cotacao_id_fkey(numero_cotacao)
        `)
        .eq('id', currentOsId)
        .single();

      if (error) throw error;
      setOS(data);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const loadPecas = async () => {
    if (!currentOsId) return;
    const [osPecasResult, cotacaoPecasResult] = await Promise.all([
      supabase
        .from('os_pecas')
        .select('*')
        .eq('os_id', currentOsId)
        .order('created_at', { ascending: true }),
      supabase
        .from('cotacoes_pecas')
        .select('*')
        .eq('os_id', currentOsId)
        .order('created_at', { ascending: true })
    ]);

    const osPecasFormatadas = (osPecasResult.data || []).map(p => ({
      id: p.id,
      os_id: p.os_id,
      os_peca_id: p.id,
      cotacao_peca_id: null,
      codigo: p.pn,
      pn: p.pn,
      descricao: p.descricao,
      quantidade: p.quantidade,
      valor_unitario: p.valor_unitario,
      valor_total: p.valor_total,
      created_at: p.created_at,
      updated_at: p.updated_at,
      tipo: 'os_peca'
    }));

    const cotacaoPecas = (cotacaoPecasResult.data || []).map(p => ({
      id: p.id,
      os_id: p.os_id,
      os_peca_id: null,
      cotacao_peca_id: p.id,
      codigo: p.pn,
      pn: p.pn,
      descricao: p.descricao,
      quantidade: p.quantidade,
      valor_unitario: p.valor_base_gspn,
      valor_total: p.valor_base_gspn * p.quantidade,
      created_at: p.created_at,
      updated_at: p.updated_at,
      tipo: 'cotacao'
    }));

    const todasPecas = [...osPecasFormatadas, ...cotacaoPecas];
    console.log('🔍 Todas peças LP:', todasPecas.map(p => ({
      desc: p.descricao?.substring(0, 30),
      os_peca_id: p.os_peca_id,
      cotacao_peca_id: p.cotacao_peca_id,
      tipo: p.tipo
    })));
    setPecas(todasPecas);
  };

  const loadRequisicoes = async () => {
    if (!currentOsId) return;
    const { data } = await supabase
      .from('requisicoes_pecas')
      .select('*')
      .eq('os_id', currentOsId)
      .neq('status', 'cancelada')
      .order('created_at', { ascending: false });

    console.log('🔍 Requisições carregadas LP (TOTAL:', data?.length, '):', data?.map(r => ({
      id: r.id,
      os_peca_id: r.os_peca_id,
      cotacao_peca_id: r.cotacao_peca_id,
      status: r.status,
      descricao: r.descricao?.substring(0, 30),
      codigo: r.codigo_peca
    })));

    setRequisicoes(data || []);
  };

  const loadServicos = async () => {
    if (!currentOsId) return;
    const { data } = await supabase
      .from('os_servicos')
      .select('*')
      .eq('os_id', currentOsId)
      .order('created_at', { ascending: true});

    setServicos(data || []);
  };

  const loadServicosCadastrados = async () => {
    const unidadeParaBusca = currentMode === 'create' ? unidadeId : (os?.unidade_id || usuario?.unidade_id);
    if (!unidadeParaBusca) return;

    const { data } = await supabase
      .from('servicos')
      .select('*')
      .or(`unidade_id.eq.${unidadeParaBusca},unidade_id.is.null`)
      .eq('ativo', true)
      .order('codigo', { ascending: true });

    setServicosCadastrados(data || []);
  };

  const loadChecklistsDisponiveis = async () => {
    const unidadeParaBusca = currentMode === 'create' ? unidadeId : (os?.unidade_id || usuario?.unidade_id);
    const tipoAtendimentoParaBusca = currentMode === 'create' ? tipoAtendimento : os?.tipo_atendimento;
    const tipoOSParaBusca = currentMode === 'create' ? tipoOS : os?.tipo_os;

    if (!unidadeParaBusca || !tipoOSParaBusca) return;

    const { data } = await supabase
      .from('checklist_templates')
      .select('*')
      .or(`unidade_id.eq.${unidadeParaBusca},unidade_id.is.null`)
      .eq('ativo', true)
      .eq('tipo_checklist', 'ADM')
      .contains('tipo_os', [tipoOSParaBusca])
      .order('nome', { ascending: true });

    // Filtrar adicionalmente por tipo de atendimento se especificado
    const filtered = data?.filter(checklist =>
      !tipoAtendimentoParaBusca ||
      !checklist.tipos_atendimento ||
      checklist.tipos_atendimento.includes(tipoAtendimentoParaBusca)
    ) || [];

    setChecklistsDisponiveis(filtered);
  };

  const handleAdicionarServico = async () => {
    if (!servicoSelecionado) {
      alert('Selecione um serviço');
      return;
    }

    try {
      if (currentMode === 'view' && currentOsId) {
        // Modo view - adicionar diretamente no banco
        await supabase.from('os_servicos').insert({
          os_id: osId,
          codigo_servico: servicoSelecionado.codigo,
          descricao: servicoSelecionado.descricao,
          quantidade: quantidadeServico,
          valor_unitario: servicoSelecionado.valor,
          valor_total: servicoSelecionado.valor * quantidadeServico
        });

        await loadServicos();
        alert('Serviço adicionado com sucesso!');
      }

      setMostrarModalServico(false);
      setServicoSelecionado(null);
      setQuantidadeServico(1);
    } catch (error) {
      alert('Erro ao adicionar serviço');
    }
  };

  const buscarSugestoesPecas = async (codigo: string) => {
    if (!codigo || codigo.length < 2) {
      setSugestoesPecas([]);
      setMostrarSugestoes(false);
      return;
    }

    try {
      const unidadeParaBusca = currentMode === 'create' ? unidadeId : (os?.unidade_id || usuario?.unidade_id);
      if (!unidadeParaBusca) {
        setSugestoesPecas([]);
        return;
      }

      // Buscar peças do estoque da unidade
      const { data: pecasEstoque } = await supabase
        .from('estoque_pecas')
        .select('pn, descricao, valor_com_impostos')
        .eq('unidade_id', unidadeParaBusca)
        .ilike('pn', `%${codigo}%`)
        .limit(10);

      // Agrupar e contar peças iguais
      const pecasAgrupadas = (pecasEstoque || []).reduce((acc, peca) => {
        const key = `${peca.pn}-${peca.descricao}`;
        if (!acc[key]) {
          acc[key] = {
            pn: peca.pn,
            descricao: peca.descricao,
            valor_com_impostos: peca.valor_com_impostos,
            count: 0
          };
        }
        acc[key].count++;
        return acc;
      }, {} as Record<string, any>);

      // Buscar valor corrigido do último pedido e buscar markup
      const sugestoesComValor = await Promise.all(
        Object.values(pecasAgrupadas).map(async (peca: any) => {
          const { data: pedido } = await supabase
            .from('estoque_pedidos')
            .select('valor_estimado')
            .eq('pn', peca.pn)
            .eq('unidade_id', unidadeParaBusca)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          // Buscar markup ativo
          const tipoOSAtual = currentMode === 'view' ? os?.tipo_os : tipoOS;
          const tipoOrcamentoAtual = currentMode === 'view' ? (os?.tipo_orcamento || 'normal') : (tipoOrcamento || 'normal');
          let valorComMarkup = pedido?.valor_estimado || null;
          if (valorComMarkup && tipoOSAtual === 'OW') {
            const { data: markupData } = await supabase.rpc('get_markup_for_unidade_and_tipo', {
              p_unidade_id: unidadeParaBusca,
              p_tipo_orcamento: tipoOrcamentoAtual,
              p_valor: valorComMarkup
            });

            if (markupData && markupData.length > 0 && markupData[0].valor) {
              valorComMarkup = valorComMarkup * (1 + markupData[0].valor / 100);
            }
          }

          return {
            ...peca,
            valor_corrigido: pedido?.valor_estimado || null,
            valor_com_markup: valorComMarkup
          };
        })
      );

      setSugestoesPecas(sugestoesComValor);
      setMostrarSugestoes(true);
    } catch (error) {
    }
  };

  const loadChecklist = async () => {
    if (!currentOsId) return;
    const { data } = await supabase
      .from('os_checklist')
      .select('*, concluido_por:usuarios(nome)')
      .eq('os_id', currentOsId)
      .order('ordem', { ascending: true });

    setChecklist(data || []);
  };

  useEffect(() => {
    const calcularMarkup = async () => {
      const valorGSPN = parseFloat(novaPecaValor);

      if (!valorGSPN || valorGSPN <= 0 || tipoOS !== 'OW' || !unidadeId) {
        setNovaPecaValorComMarkup(null);
        return;
      }

      try {
        const { data: markupData } = await supabase.rpc('get_markup_for_unidade_and_tipo', {
          p_unidade_id: unidadeId,
          p_tipo_orcamento: tipoOrcamento || 'normal',
          p_valor: valorGSPN
        });

        if (markupData && markupData.length > 0 && markupData[0].valor) {
          const valorComMarkup = valorGSPN * (1 + markupData[0].valor / 100);
          setNovaPecaValorComMarkup(valorComMarkup);
        } else {
          setNovaPecaValorComMarkup(null);
        }
      } catch (error) {
        setNovaPecaValorComMarkup(null);
      }
    };

    calcularMarkup();
  }, [novaPecaValor, tipoOS, unidadeId, tipoOrcamento]);

  const loadComentarios = async () => {
    if (!currentOsId) return;
    const { data: osData } = await supabase
      .from('os')
      .select('cotacao_id')
      .eq('id', currentOsId)
      .maybeSingle();

    const [osComentariosResult, cotacaoComentariosResult] = await Promise.all([
      supabase
        .from('os_comentarios')
        .select('*')
        .eq('os_id', currentOsId)
        .order('created_at', { ascending: false }),
      osData?.cotacao_id
        ? supabase
            .from('cotacao_comentarios')
            .select('*')
            .eq('cotacao_id', osData.cotacao_id)
            .order('created_at', { ascending: false })
        : Promise.resolve({ data: [], error: null })
    ]);

    const cotacaoComentarios = (cotacaoComentariosResult.data || []).map(c => ({
      id: c.id,
      os_id: c.os_id,
      usuario_id: c.usuario_id,
      comentario: c.texto,
      is_system: c.is_system || false,
      created_at: c.created_at,
      updated_at: c.updated_at
    }));

    const todosComentarios = [...(osComentariosResult.data || []), ...cotacaoComentarios].sort((a, b) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    setComentarios(todosComentarios);
  };

  const loadAnexos = async () => {
    if (!currentOsId) return;
    const { data } = await supabase
      .from('os_anexos')
      .select('*, usuario:usuarios(nome)')
      .eq('os_id', currentOsId)
      .order('created_at', { ascending: false });

    setAnexos(data || []);
  };

  const handleCriarOS = async () => {
    if (!unidadeId || !clienteNome || !defeitoRelatado) {
      alert('Preencha os campos obrigatórios: Unidade, Nome do Cliente e Defeito Relatado');
      return;
    }

    // Validação específica para OS IH: cidade obrigatória
    if (tipoAtendimento === 'IH' && !clienteCidade?.trim()) {
      alert('Para OS do tipo IH (In-Home), a cidade do cliente é obrigatória para roteamento.');
      return;
    }

    try {
      setLoading(true);

      await salvarOuAtualizarCliente();

      const enderecoCompleto = [
        clienteLogradouro,
        clienteNumero,
        clienteComplemento,
        clienteBairro,
        clienteCidade,
        clienteEstado
      ].filter(Boolean).join(', ');

      const { data: novaOS, error: osError } = await supabase
        .from('os')
        .insert({
          unidade_id: unidadeId,
          tipo_os: tipoOS,
          tipo_atendimento: tipoAtendimento,
          tipo_orcamento: tipoOrcamento,
          numero_os_samsung: numeroOSSamsung || null,
          cliente_nome: clienteNome,
          cliente_cpf_cnpj: clienteCPF || null,
          cliente_telefone: clienteTelefone || null,
          cliente_telefone_2: clienteTelefone2 || null,
          cliente_email: clienteEmail || null,
          cliente_endereco: enderecoCompleto || null,
          cliente_cep: clienteCEP || null,
          cliente_logradouro: clienteLogradouro || null,
          cliente_numero: clienteNumero || null,
          cliente_complemento: clienteComplemento || null,
          cliente_bairro: clienteBairro || null,
          cliente_cidade: clienteCidade || null,
          cliente_estado: clienteEstado || null,
          aparelho_linha: aparelhoLinha || null,
          aparelho_modelo: aparelhoModelo || null,
          aparelho_numero_serie: aparelhoSerie || null,
          aparelho_imei: aparelhoIMEI || null,
          defeito_relatado: defeitoRelatado,
          observacoes_internas: observacoesInternas || null,
          coluna_kanban: 'os_nova',
          criado_por: usuario?.id
        })
        .select()
        .single();

      if (osError) throw osError;

      // Salvar peças adicionadas
      if (pecasAdicionadas.length > 0) {
        const pecasInsert = pecasAdicionadas.map(peca => ({
          os_id: novaOS.id,
          pn: peca.codigo,
          descricao: peca.descricao,
          quantidade: 1,
          valor_gspn: peca.valor,
          status_gspn: 'pendente',
          requisitada_por: usuario?.id,
          numero_os_samsung: numeroOSSamsung || null
        }));

        const { error: pecasError } = await supabase
          .from('os_pecas')
          .insert(pecasInsert);

        if (pecasError) {
          console.error('Erro ao salvar peças:', pecasError);
        }
      }

      // Salvar serviços adicionados
      if (servicosAdicionados.length > 0) {
        const servicosInsert = servicosAdicionados.map(servico => ({
          os_id: novaOS.id,
          codigo_servico: servico.codigo,
          descricao: servico.descricao,
          quantidade: servico.quantidade,
          valor_unitario: servico.valor_unitario,
          valor_total: servico.valor_unitario * servico.quantidade
        }));

        const { error: servicosError } = await supabase
          .from('os_servicos')
          .insert(servicosInsert);

        if (servicosError) {
          console.error('Erro ao salvar serviços:', servicosError);
        }
      }

      // Salvar checklists selecionados
      if (checklistsSelecionados.length > 0) {
        const checklistsInsert = checklistsSelecionados.map(checklistId => ({
          os_id: novaOS.id,
          checklist_template_id: checklistId,
          vinculado_automaticamente: false,
          vinculado_por: usuario?.id,
          respostas: []
        }));

        const { error: checklistsError } = await supabase
          .from('os_checklist_vinculados')
          .insert(checklistsInsert);

        if (checklistsError) {
          console.error('Erro ao salvar checklists:', checklistsError);
        }
      }

      // Salvar requisições (apenas das peças que foram marcadas para requisitar)
      if (requisicoesTemporarias.length > 0) {
        const requisicoesInsert = requisicoesTemporarias.map(req => ({
          os_id: novaOS.id,
          cotacao_id: null,
          codigo_peca: req.codigo,
          descricao: req.descricao,
          quantidade_requisitada: req.quantidade,
          status: 'pendente',
          requisitado_por: usuario?.id,
          unidade_id: unidadeId
        }));

        const { error: requisicoesError } = await supabase
          .from('requisicoes_pecas')
          .insert(requisicoesInsert);

        if (requisicoesError) throw requisicoesError;
      }

      // Salvar pagamentos temporários
      if (pagamentosTemporarios.length > 0 && tipoOS === 'OW') {
        for (const pag of pagamentosTemporarios) {
          let comprovanteUrl = null;

          // Upload do comprovante se houver
          if (pag.comprovante) {
            const fileName = `pagamento_${novaOS.id}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const { error: uploadError } = await supabase.storage
              .from('pagamentos-comprovantes')
              .upload(fileName, pag.comprovante);

            if (!uploadError) {
              const { data: { publicUrl } } = supabase.storage
                .from('pagamentos-comprovantes')
                .getPublicUrl(fileName);

              comprovanteUrl = publicUrl;
            }
          }

          // Calcular valores
          const valorBruto = pag.valor;
          const taxaValor = pag.taxa_percentual ? (valorBruto * pag.taxa_percentual) / 100 : 0;
          const valorLiquido = pag.taxa_paga_por === 'empresa' ? valorBruto - taxaValor : valorBruto;

          const { error: pagamentoError } = await supabase
            .from('pagamentos')
            .insert({
              os_id: novaOS.id,
              unidade_id: unidadeId,
              forma_pagamento: pag.forma_pagamento,
              valor: valorLiquido,
              valor_bruto: valorBruto,
              valor_liquido: valorLiquido,
              parcelamento: pag.parcelamento || 1,
              taxa_percentual: pag.taxa_percentual || 0,
              taxa_valor: taxaValor,
              taxa_paga_por: pag.taxa_paga_por || null,
              nsu: pag.nsu || null,
              pix_id_transacao: pag.pix_id_transacao || null,
              comprovante_url: comprovanteUrl,
              observacoes: pag.observacoes || null,
              lancado_por: usuario?.id,
              responsavel_fechamento: usuario?.id,
              data_lancamento: new Date().toISOString()
            });

          if (pagamentoError) {
            console.error('Erro ao salvar pagamento:', pagamentoError);
          }
        }
      }

      if (anexosTemporarios.length > 0) {
        for (const anexo of anexosTemporarios) {
          const fileExt = anexo.file.name.split('.').pop();
          const fileName = `${Math.random()}.${fileExt}`;
          const filePath = `${novaOS.id}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('os-anexos')
            .upload(filePath, anexo.file);

          if (uploadError) {
            continue;
          }

          await supabase.from('os_anexos').insert({
            os_id: novaOS.id,
            nome_arquivo: anexo.nome,
            caminho_arquivo: filePath,
            tipo_arquivo: anexo.file.type,
            tamanho: anexo.file.size,
            usuario_id: usuario?.id
          });
        }
      }

      const comentariosInsert = [
        {
          os_id: novaOS.id,
          usuario_id: usuario?.id,
          comentario: `OS ${tipoOS} criada por ${usuario?.nome}`,
          is_system: true
        }
      ];

      if (comentariosTemporarios.length > 0) {
        comentariosInsert.push(...comentariosTemporarios.map(comentario => ({
          os_id: novaOS.id,
          usuario_id: usuario?.id,
          comentario: comentario,
          is_system: false
        })));
      }

      if (requisicoesTemporarias.length > 0) {
        requisicoesTemporarias.forEach(req => {
          comentariosInsert.push({
            os_id: novaOS.id,
            usuario_id: usuario?.id,
            comentario: `Peça requisitada por ${usuario?.nome}: ${req.descricao} (${req.codigo})`,
            is_system: true
          });
        });
      }

      const { error: comentariosError } = await supabase
        .from('os_comentarios')
        .insert(comentariosInsert);

      if (comentariosError) throw comentariosError;

      // Vincular automaticamente checklists ADM baseado no tipo de OS e atendimento
      const { data: checklistsAdm } = await supabase
        .from('checklist_templates')
        .select('*')
        .eq('tipo_checklist', 'ADM')
        .eq('ativo', true)
        .or(`unidade_id.eq.${unidadeId},unidade_id.is.null`);

      if (checklistsAdm && checklistsAdm.length > 0) {
        const checklistsParaVincular = checklistsAdm.filter(template => {
          // Se tem filtros de tipo_os, verificar se a OS atual está incluída
          if (template.tipo_os && Array.isArray(template.tipo_os) && template.tipo_os.length > 0) {
            if (!template.tipo_os.includes(tipoOS)) {
              return false;
            }
          }

          // Se tem filtros de tipos_atendimento, verificar se o atendimento atual está incluído
          if (template.tipos_atendimento && Array.isArray(template.tipos_atendimento) && template.tipos_atendimento.length > 0) {
            if (!template.tipos_atendimento.includes(tipoAtendimento)) {
              return false;
            }
          }

          return true;
        });

        if (checklistsParaVincular.length > 0) {
          const vinculos = checklistsParaVincular.map(template => ({
            os_id: novaOS.id,
            checklist_template_id: template.id,
            vinculado_automaticamente: true,
            vinculado_por: usuario?.id,
            respostas: []
          }));

          await supabase.from('os_checklist_vinculados').insert(vinculos);

          // Adicionar comentário informando sobre checklists vinculados
          if (checklistsParaVincular.length > 0) {
            await supabase.from('os_comentarios').insert({
              os_id: novaOS.id,
              usuario_id: usuario?.id,
              comentario: `Sistema vinculou automaticamente ${checklistsParaVincular.length} checklist(s) ADM: ${checklistsParaVincular.map(c => c.nome).join(', ')}`,
              is_system: true
            });
          }
        }
      }

      const osInfo = novaOS.numero_os_interna
        ? `OS Interna ${novaOS.numero_os_interna} criada`
        : `OS ${tipoOS} criada`;
      const samsungInfo = novaOS.numero_os_samsung
        ? ` (OS Samsung: ${novaOS.numero_os_samsung})`
        : '';

      alert(`${osInfo}${samsungInfo}`);

      // Mudar para modo de visualização e carregar a OS criada
      setCurrentOsId(novaOS.id);
      setCurrentMode('view');
      setAbaAtiva('checklist');

      onReload?.();
    } catch (error) {
      alert(`Erro ao criar OS ${tipoOS}`);
    } finally {
      setLoading(false);
    }
  };

  const handleRequisitarPeca = async (peca: any) => {
    try {
      console.log('🚀 Requisitando peça LP:', {
        peca_id: peca.id,
        os_peca_id: peca.os_peca_id,
        cotacao_peca_id: peca.cotacao_peca_id,
        tipo: peca.tipo,
        descricao: peca.descricao?.substring(0, 30)
      });

      const { data: novaRequisicao, error: insertError } = await supabase.from('requisicoes_pecas').insert({
        os_id: osId,
        cotacao_id: os?.cotacao_id || null,
        cotacao_peca_id: peca.cotacao_peca_id || null,
        os_peca_id: peca.os_peca_id || null,
        codigo_peca: peca.codigo || peca.pn,
        descricao: peca.descricao,
        quantidade_requisitada: peca.quantidade,
        status: 'pendente',
        requisitado_por: usuario?.id,
        numero_os_samsung: os?.numero_os_samsung,
        unidade_id: os?.unidade_id
      }).select();

      if (insertError) throw insertError;

      console.log('✅ Requisição criada:', novaRequisicao);

      // Mover OS para "Aguardando Peça" se não estiver lá ainda
      const colunasQueNaoPrecisamMover = ['aguardando_peca', 'peca_em_transito', 'peca_disponivel'];
      if (os?.coluna_kanban && !colunasQueNaoPrecisamMover.includes(os.coluna_kanban)) {
        const { error: updateError } = await supabase
          .from('os')
          .update({
            coluna_kanban: 'aguardando_peca',
            updated_at: new Date().toISOString()
          })
          .eq('id', currentOsId);

        if (updateError) {
        }

        await supabase.from('os_comentarios').insert({
          os_id: osId,
          usuario_id: usuario?.id,
          comentario: `OS movida para "Aguardando Peça" - requisição criada por ${usuario?.nome}`,
          is_system: true
        });
      } else {
        await supabase.from('os_comentarios').insert({
          os_id: osId,
          usuario_id: usuario?.id,
          comentario: `Peça requisitada por ${usuario?.nome}: ${peca.descricao} (${peca.codigo || peca.pn})`,
          is_system: true
        });
      }

      await new Promise(resolve => setTimeout(resolve, 300));

      await loadPecas();
      await loadRequisicoes();
      await loadComentarios();
      await loadOS();
      onReload?.();

      alert('Requisição enviada! OS movida para "Aguardando Peça".');
    } catch (error) {
      console.error('Erro ao requisitar peça:', error);
      alert('Erro ao requisitar peça');
    }
  };

  const handleRequisitarNovamente = async (peca: any, requisicaoAnterior: any) => {
    const motivo = prompt('Informe o motivo para requisitar novamente esta peça:');
    if (!motivo || !motivo.trim()) {
      alert('É necessário informar o motivo da nova requisição');
      return;
    }

    try {
      const { data: novaRequisicao, error: insertError } = await supabase
        .from('requisicoes_pecas')
        .insert({
          os_id: osId,
          cotacao_id: os?.cotacao_id || null,
          cotacao_peca_id: peca.cotacao_peca_id || null,
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

      if (os?.coluna_kanban !== 'aguardando_peca') {
        await supabase
          .from('os')
          .update({
            coluna_kanban: 'aguardando_peca',
            updated_at: new Date().toISOString()
          })
          .eq('id', currentOsId);
      }

      await supabase.from('os_comentarios').insert({
        os_id: osId,
        usuario_id: usuario?.id,
        comentario: `Nova requisição criada para peça ${peca.descricao} (${peca.codigo || peca.pn}). Motivo: ${motivo}`,
        is_system: true
      });

      alert('Nova requisição criada com sucesso!');
      await loadPecas();
      await loadRequisicoes();
      await loadComentarios();
      await loadOS();
      onReload?.();
    } catch (error: any) {
      alert(`Erro ao criar nova requisição: ${error.message}`);
    }
  };

  const handleCancelarRequisicao = async (requisicao: RequisicaoPeca) => {
    const motivo = prompt('Digite o motivo do cancelamento:');
    if (!motivo) return;

    try {
      const { error: updateError } = await supabase
        .from('requisicoes_pecas')
        .update({ status: 'cancelada', motivo_cancelamento: motivo })
        .eq('id', requisicao.id);

      if (updateError) {
        throw updateError;
      }

      const { error: commentError } = await supabase.from('os_comentarios').insert({
        os_id: osId,
        usuario_id: usuario?.id,
        comentario: `Requisição cancelada por ${usuario?.nome}: ${requisicao.descricao}\nMotivo: ${motivo}`,
        is_system: true
      });

      if (commentError) {
      }

      alert('Requisição cancelada!');
      await loadPecas();
      await loadRequisicoes();
      await loadComentarios();
    } catch (error) {
      alert('Erro ao cancelar requisição');
    }
  };

  const handlePostarGI = async (requisicao: RequisicaoPeca) => {
    const confirmacao = confirm(
      `Confirma a postagem de GI desta peça?\n\n` +
      `Peça: ${requisicao.descricao}\n` +
      `Código: ${requisicao.codigo_peca}`
    );
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
      await loadPecas();
      await loadRequisicoes();
      await loadComentarios();
      onReload?.();
    } catch (error) {
      alert('Erro ao postar GI');
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

      alert('Devolução solicitada com sucesso! Aguardando aprovação do estoque.');
      await loadPecas();
      await loadRequisicoes();
      await loadComentarios();
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
      await supabase
        .from('requisicoes_pecas')
        .update({
          status: 'atendida',
          gi_postada_em: null
        })
        .eq('id', requisicao.id);

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

      await loadPecas();
      await loadRequisicoes();
      await loadComentarios();

      if (onReload) {
        onReload();
      }
    } catch (error) {
      alert('Erro ao cancelar GI');
    }
  };

  const handleAdicionarComentario = async () => {
    if (!novoComentario.trim() || !currentOsId) return;

    try {
      await supabase.from('os_comentarios').insert({
        os_id: osId,
        usuario_id: usuario?.id,
        comentario: novoComentario,
        is_system: false
      });

      setNovoComentario('');
      loadComentarios();
    } catch (error) {
    }
  };

  const handleToggleChecklist = async (item: any) => {
    try {
      await supabase
        .from('os_checklist')
        .update({
          concluido: !item.concluido,
          concluido_em: !item.concluido ? new Date().toISOString() : null,
          concluido_por_id: !item.concluido ? usuario?.id : null
        })
        .eq('id', item.id);

      loadChecklist();
    } catch (error) {
    }
  };

  const handleUploadAnexo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files?.[0] || !currentOsId) return;

    const file = e.target.files[0];
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `${osId}/${fileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from('os-anexos')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      await supabase.from('os_anexos').insert({
        os_id: osId,
        nome_arquivo: file.name,
        caminho_arquivo: filePath,
        tipo_arquivo: file.type,
        tamanho: file.size,
        usuario_id: usuario?.id
      });

      alert('Anexo enviado com sucesso!');
      loadAnexos();
    } catch (error) {
      alert('Erro ao fazer upload do anexo');
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
        .update({ tipo_os: 'OW' })
        .eq('id', currentOsId);

      if (updateError) throw updateError;

      const comentariosInsert = [
        {
          os_id: osId,
          usuario_id: usuario?.id,
          comentario: `OS convertida de LP para OW por ${usuario?.nome}`,
          is_system: true
        },
        {
          os_id: osId,
          usuario_id: usuario?.id,
          comentario: `Motivo da conversão: ${motivoConversao}`,
          is_system: true
        }
      ];

      const requisicoesCount = requisicoes.length;
      if (requisicoesCount > 0) {
        comentariosInsert.push({
          os_id: osId,
          usuario_id: usuario?.id,
          comentario: `IMPORTANTE: ${requisicoesCount} requisição(ões) de peças foram mantidas`,
          is_system: true
        });
      }

      const { error: comentariosError } = await supabase
        .from('os_comentarios')
        .insert(comentariosInsert);

      if (comentariosError) throw comentariosError;

      alert('OS convertida com sucesso para OW!');
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

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; color: string }> = {
      pendente: { label: 'PENDENTE', color: '#FFBF00' },
      atendida: { label: 'ATENDIDA', color: '#00D4FF' },
      em_uso: { label: 'EM USO', color: '#9D00FF' },
      gi_postada: { label: 'GI POSTADA', color: '#39FF14' },
      devolucao_pendente: { label: 'DEVOLUÇÃO PENDENTE', color: '#FF6B00' },
      devolvida: { label: 'DEVOLVIDA', color: '#39FF14' },
      cancelada: { label: 'CANCELADA', color: '#808080' },
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

  if (loading && currentMode === 'view') {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="futuristic-loader"></div>
      </div>
    );
  }

  const colunaAtual = COLUNAS_KANBAN.find(c => c.id === os?.coluna_kanban);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="premium-card w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: `${tipoOS === 'LP' ? '#FFA500' : '#00D4FF'}33` }}>
          <div>
            <h2 className="tech-heading text-xl flex items-center gap-2" style={{ color: tipoOS === 'LP' ? '#FFA500' : '#00D4FF' }}>
              {tipoOS === 'LP' ? 'LP - Garantia' : 'OW - Fora de Garantia'}
              {currentMode === 'create' && <span className="text-sm text-gray-400">(NOVA)</span>}
            </h2>
            {os && (
              <p className="text-sm text-gray-400 mt-1">
                {os.numero_os_samsung || os.numero_os_interna || 'N/A'}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {currentMode === 'view' && os && (
              <div className="relative">
                <button
                  onClick={() => setMostrarMoverPara(!mostrarMoverPara)}
                  disabled={movendoOS}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all disabled:opacity-50"
                  style={{
                    background: os?.tipo_os === 'OW' ? 'linear-gradient(135deg, rgba(0,212,255,0.2) 0%, rgba(0,212,255,0.05) 100%)' : 'linear-gradient(135deg, rgba(255,165,0,0.2) 0%, rgba(255,165,0,0.05) 100%)',
                    border: os?.tipo_os === 'OW' ? '1px solid #00D4FF' : '1px solid #FFA500',
                    color: os?.tipo_os === 'OW' ? '#00D4FF' : '#FFA500',
                    boxShadow: os?.tipo_os === 'OW' ? '0 0 10px rgba(0,212,255,0.2)' : '0 0 10px rgba(255,165,0,0.2)'
                  }}
                >
                  <MoveHorizontal className="w-4 h-4" />
                  MOVER PARA
                  <ChevronDown className={`w-4 h-4 transition-transform ${mostrarMoverPara ? 'rotate-180' : ''}`} />
                </button>

                {mostrarMoverPara && (
                  <div className="absolute right-0 top-full mt-2 w-72 max-h-96 overflow-y-auto premium-card p-3 z-50 cyber-scrollbar">
                    <div className="mb-3 pb-2" style={{ borderBottom: `1px solid ${os?.tipo_os === 'OW' ? '#00D4FF' : '#FFA500'}33` }}>
                      <p className="text-xs text-gray-400">Coluna Atual:</p>
                      <p className="text-sm font-bold" style={{ color: os?.tipo_os === 'OW' ? '#00D4FF' : '#FFA500' }}>{colunaAtual?.label || 'N/A'}</p>
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
                          className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                          style={{
                            color: '#fff',
                            border: '1px solid transparent'
                          }}
                          onMouseEnter={(e) => {
                            const cor = os?.tipo_os === 'OW' ? '#00D4FF' : '#FFA500';
                            e.currentTarget.style.borderColor = cor;
                            e.currentTarget.style.boxShadow = os?.tipo_os === 'OW' ? '0 0 10px rgba(0,212,255,0.2)' : '0 0 10px rgba(255,165,0,0.2)';
                            e.currentTarget.style.backgroundColor = os?.tipo_os === 'OW' ? '#00D4FF10' : '#FFA50010';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.borderColor = 'transparent';
                            e.currentTarget.style.boxShadow = 'none';
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          {coluna.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {currentMode === 'view' && os?.numero_os_samsung && (
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
              className="p-2 rounded-lg transition-colors"
              style={{
                color: tipoOS === 'LP' ? '#FFA500' : '#00D4FF'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = tipoOS === 'LP' ? '#FFA50010' : '#00D4FF10';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {currentMode === 'view' && currentJob && (
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

        {currentMode === 'create' ? (
          <>
            <div className="flex border-b" style={{ borderColor: `${tipoOS === 'LP' ? '#FFA500' : '#00D4FF'}33` }}>
              {[
                { id: 'dados', label: 'Dados Básicos', icon: User },
                { id: 'estoque', label: 'Estoque & Peças', icon: Package },
                ...(tipoOS === 'OW' ? [{ id: 'servicos', label: 'Serviços', icon: FileText }] : []),
                { id: 'checklist', label: 'Checklist', icon: CheckSquare },
                ...(tipoOS === 'OW' ? [{ id: 'pagamento', label: 'Pagamento', icon: DollarSign }] : []),
                ...(tipoAtendimento === 'IH' ? [{ id: 'agendamento', label: 'Agendamento', icon: Calendar }] : []),
                { id: 'anexos', label: 'Anexos', icon: Paperclip },
                { id: 'comentarios', label: 'Comentários', icon: MessageSquare }
              ].map(({ id, label, icon: Icon }) => {
                const corPrimaria = tipoOS === 'OW' ? '#00D4FF' : '#FFA500';
                return (
                  <button
                    key={id}
                    onClick={() => setAbaAtiva(id as AbaAtiva)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 text-xs font-bold uppercase tracking-wider transition-all ${
                      abaAtiva === id ? '' : 'text-gray-400'
                    }`}
                    style={abaAtiva === id ? {
                      backgroundColor: `${corPrimaria}1a`,
                      color: corPrimaria,
                      borderBottom: `2px solid ${corPrimaria}`
                    } : {}}
                    onMouseEnter={(e) => {
                      if (abaAtiva !== id) {
                        e.currentTarget.style.backgroundColor = `${corPrimaria}0d`;
                        e.currentTarget.style.color = corPrimaria;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (abaAtiva !== id) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#9CA3AF';
                      }
                    }}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                    {id === 'estoque' && requisicoesTemporarias.length > 0 && (
                      <span className="ml-1 px-2 py-0.5 text-black rounded-full text-xs font-bold" style={{ backgroundColor: corPrimaria }}>
                        {requisicoesTemporarias.length}
                      </span>
                    )}
                    {id === 'anexos' && anexosTemporarios.length > 0 && (
                      <span className="ml-1 px-2 py-0.5 text-black rounded-full text-xs font-bold" style={{ backgroundColor: corPrimaria }}>
                        {anexosTemporarios.length}
                      </span>
                    )}
                    {id === 'comentarios' && comentariosTemporarios.length > 0 && (
                      <span className="ml-1 px-2 py-0.5 text-black rounded-full text-xs font-bold" style={{ backgroundColor: corPrimaria }}>
                        {comentariosTemporarios.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto cyber-scrollbar p-6">
              {abaAtiva === 'dados' && (
                <div className="space-y-6">
              <div className="premium-card p-6">
                <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: tipoOS === 'LP' ? '#FFA500' : '#00D4FF' }}>
                  Informações Básicas
                </h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 uppercase block mb-2">
                      Unidade *
                    </label>
                    <select
                      value={unidadeId}
                      onChange={(e) => setUnidadeId(e.target.value)}
                      className="neon-input w-full"
                    >
                      <option value="">Selecione...</option>
                      {unidades.map(u => (
                        <option key={u.id} value={u.id}>{u.nome}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 uppercase block mb-2">
                      Tipo Atendimento
                    </label>
                    <select
                      value={tipoAtendimento}
                      onChange={(e) => setTipoAtendimento(e.target.value as 'IH' | 'CI')}
                      className="neon-input w-full"
                    >
                      <option value="CI">CI - Carry In</option>
                      <option value="IH">IH - In Home</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-400 uppercase block mb-2">
                      Número OS Samsung
                    </label>
                    <input
                      type="text"
                      value={numeroOSSamsung}
                      onChange={(e) => setNumeroOSSamsung(e.target.value)}
                      className="neon-input w-full"
                      placeholder="Ex: OS123456 (Opcional)"
                    />
                  </div>
                </div>
              </div>

              <div className="premium-card p-6">
                <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: tipoOS === 'LP' ? '#FFA500' : '#00D4FF' }}>
                  Dados do Cliente
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="text-xs text-gray-400 uppercase block mb-2">
                      CPF/CNPJ
                    </label>
                    <input
                      type="text"
                      value={clienteCPF}
                      onChange={(e) => setClienteCPF(e.target.value)}
                      onBlur={() => buscarCliente(clienteCPF)}
                      className="neon-input w-full"
                      placeholder="Digite CPF/CNPJ para buscar cliente"
                    />
                    {clienteEncontrado && (
                      <p className="text-xs text-green-400 mt-1">✓ Cliente encontrado na base de dados</p>
                    )}
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-400 uppercase block mb-2">
                      Nome *
                    </label>
                    <input
                      type="text"
                      value={clienteNome}
                      onChange={(e) => setClienteNome(e.target.value)}
                      className="neon-input w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 uppercase block mb-2">
                      Telefone 1
                    </label>
                    <input
                      type="text"
                      value={clienteTelefone}
                      onChange={(e) => setClienteTelefone(e.target.value)}
                      className="neon-input w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 uppercase block mb-2">
                      Telefone 2 (Opcional)
                    </label>
                    <input
                      type="text"
                      value={clienteTelefone2}
                      onChange={(e) => setClienteTelefone2(e.target.value)}
                      className="neon-input w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 uppercase block mb-2">
                      Email
                    </label>
                    <input
                      type="email"
                      value={clienteEmail}
                      onChange={(e) => setClienteEmail(e.target.value)}
                      className="neon-input w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 uppercase block mb-2">
                      CEP
                    </label>
                    <div className="relative">
                      <input
                        type="text"
                        value={clienteCEP}
                        onChange={(e) => setClienteCEP(e.target.value)}
                        onBlur={(e) => handleBuscarCEP(e.target.value)}
                        className="neon-input w-full"
                        placeholder="00000-000"
                        maxLength={9}
                      />
                      {buscandoCEP && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <Loader2 className="w-4 h-4 text-[#FFA500] animate-spin" />
                        </div>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 uppercase block mb-2">
                      Estado
                    </label>
                    <input
                      type="text"
                      value={clienteEstado}
                      onChange={(e) => setClienteEstado(e.target.value)}
                      className="neon-input w-full"
                      placeholder="UF"
                      maxLength={2}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-400 uppercase block mb-2">
                      Logradouro
                    </label>
                    <input
                      type="text"
                      value={clienteLogradouro}
                      onChange={(e) => setClienteLogradouro(e.target.value)}
                      className="neon-input w-full"
                      placeholder="Rua, Avenida, etc."
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 uppercase block mb-2">
                      Número
                    </label>
                    <input
                      type="text"
                      value={clienteNumero}
                      onChange={(e) => setClienteNumero(e.target.value)}
                      className="neon-input w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 uppercase block mb-2">
                      Complemento
                    </label>
                    <input
                      type="text"
                      value={clienteComplemento}
                      onChange={(e) => setClienteComplemento(e.target.value)}
                      className="neon-input w-full"
                      placeholder="Apt, Bloco, etc."
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 uppercase block mb-2">
                      Bairro
                    </label>
                    <input
                      type="text"
                      value={clienteBairro}
                      onChange={(e) => setClienteBairro(e.target.value)}
                      className="neon-input w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 uppercase block mb-2">
                      Cidade
                    </label>
                    <input
                      type="text"
                      value={clienteCidade}
                      onChange={(e) => setClienteCidade(e.target.value)}
                      className="neon-input w-full"
                    />
                  </div>
                </div>
              </div>

              <div className="premium-card p-6">
                <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: tipoOS === 'LP' ? '#FFA500' : '#00D4FF' }}>
                  Dados do Aparelho
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs text-gray-400 uppercase block mb-2">
                      Linha
                    </label>
                    <input
                      type="text"
                      value={aparelhoLinha}
                      onChange={(e) => setAparelhoLinha(e.target.value)}
                      className="neon-input w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 uppercase block mb-2">
                      Modelo
                    </label>
                    <input
                      type="text"
                      value={aparelhoModelo}
                      onChange={(e) => setAparelhoModelo(e.target.value)}
                      className="neon-input w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 uppercase block mb-2">
                      Número de Série
                    </label>
                    <input
                      type="text"
                      value={aparelhoSerie}
                      onChange={(e) => setAparelhoSerie(e.target.value)}
                      className="neon-input w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 uppercase block mb-2">
                      IMEI
                    </label>
                    <input
                      type="text"
                      value={aparelhoIMEI}
                      onChange={(e) => setAparelhoIMEI(e.target.value)}
                      className="neon-input w-full"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-400 uppercase block mb-2">
                      Defeito Relatado *
                    </label>
                    <textarea
                      value={defeitoRelatado}
                      onChange={(e) => setDefeitoRelatado(e.target.value)}
                      className="neon-input w-full"
                      rows={3}
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs text-gray-400 uppercase block mb-2">
                      Observações Internas
                    </label>
                    <textarea
                      value={observacoesInternas}
                      onChange={(e) => setObservacoesInternas(e.target.value)}
                      className="neon-input w-full"
                      rows={3}
                    />
                  </div>
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
                    Requisite peças do estoque. O almoxarife receberá e atenderá sua requisição.
                  </p>
                </div>

                <div className="premium-card p-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="relative">
                      <label className="text-xs text-gray-400 uppercase block mb-2">
                        Código/PN
                      </label>
                      <input
                        type="text"
                        value={novaPecaCodigo}
                        onChange={(e) => {
                          setNovaPecaCodigo(e.target.value);
                          setMostrarSugestoes(true);
                        }}
                        onBlur={() => setTimeout(() => setMostrarSugestoes(false), 200)}
                        onFocus={() => {
                          if (novaPecaCodigo && sugestoesPecas.length > 0) {
                            setMostrarSugestoes(true);
                          }
                        }}
                        className="neon-input w-full"
                        placeholder="Ex: GH82-12345A"
                      />

                      {mostrarSugestoes && sugestoesPecas.length > 0 && (
                        <div className="absolute top-full left-0 right-0 mt-1 premium-card max-h-60 overflow-y-auto z-50">
                          {sugestoesPecas.map((peca, index) => (
                            <button
                              key={index}
                              type="button"
                              onClick={() => {
                                setNovaPecaCodigo(peca.pn);
                                setNovaPecaDescricao(peca.descricao);
                                if (tipoOS === 'OW' && peca.valor_com_markup) {
                                  setNovaPecaValor(peca.valor_com_markup.toFixed(2));
                                } else if (peca.valor_corrigido) {
                                  setNovaPecaValor(peca.valor_corrigido.toFixed(2));
                                } else if (peca.valor_com_impostos) {
                                  setNovaPecaValor(peca.valor_com_impostos.toFixed(2));
                                }
                                setMostrarSugestoes(false);
                              }}
                              className="w-full text-left px-3 py-2 hover:bg-[#00D4FF]/10 border-b border-gray-800 last:border-b-0 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-[#00D4FF] truncate">{peca.pn}</p>
                                  <p className="text-xs text-gray-400 mt-0.5 truncate">{peca.descricao}</p>
                                </div>
                                <div className="flex-shrink-0">
                                  {tipoOS === 'OW' && peca.valor_com_markup ? (
                                    <span className="text-xs px-2 py-0.5 rounded font-bold" style={{
                                      backgroundColor: '#39FF1420',
                                      color: '#39FF14',
                                      border: '1px solid #39FF1440'
                                    }}>
                                      R$ {peca.valor_com_markup.toFixed(2)}
                                    </span>
                                  ) : (
                                    <span className="text-xs px-2 py-0.5 rounded" style={{
                                      backgroundColor: peca.count > 0 ? '#39FF1420' : '#FF006420',
                                      color: peca.count > 0 ? '#39FF14' : '#FF0064',
                                      border: `1px solid ${peca.count > 0 ? '#39FF14' : '#FF0064'}40`
                                    }}>
                                      {peca.count} disponível
                                    </span>
                                  )}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 uppercase block mb-2">
                        Descrição
                      </label>
                      <input
                        type="text"
                        value={novaPecaDescricao}
                        onChange={(e) => setNovaPecaDescricao(e.target.value)}
                        className="neon-input w-full"
                        placeholder="Ex: Display LCD"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 uppercase block mb-2">
                        Valor GSPN (R$)
                      </label>
                      <div className="flex gap-2">
                        <div className="flex-1">
                          <input
                            type="number"
                            step="0.01"
                            value={novaPecaValor}
                            onChange={(e) => setNovaPecaValor(e.target.value)}
                            className="neon-input w-full"
                            placeholder="0.00"
                          />
                          {tipoOS === 'OW' && novaPecaValorComMarkup !== null && (
                            <p className="text-xs mt-1" style={{ color: '#FFA500' }}>
                              Valor c/ Markup: R$ {novaPecaValorComMarkup.toFixed(2)}
                            </p>
                          )}
                        </div>
                        <button
                          onClick={() => {
                            if (!novaPecaCodigo || !novaPecaDescricao) {
                              alert('Preencha código e descrição');
                              return;
                            }
                            const valorPeca = parseFloat(novaPecaValor) || 0;
                            setPecasAdicionadas([...pecasAdicionadas, {
                              codigo: novaPecaCodigo,
                              descricao: novaPecaDescricao,
                              valor: valorPeca,
                              requisitada: false
                            }]);
                            setNovaPecaCodigo('');
                            setNovaPecaDescricao('');
                            setNovaPecaValor('');
                          }}
                          className="neon-button px-4 py-2 flex-1 text-xs"
                          style={{
                            backgroundColor: tipoOS === 'LP' ? '#FFA50020' : '#00D4FF20',
                            borderColor: tipoOS === 'LP' ? '#FFA500' : '#00D4FF',
                            color: tipoOS === 'LP' ? '#FFA500' : '#00D4FF'
                          }}
                        >
                          ADICIONAR
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: tipoOS === 'LP' ? '#FFA500' : '#00D4FF' }}>
                    <AlertCircle className="w-4 h-4" />
                    <span>Para adicionar mais de 1 peça do mesmo código, crie outra linha</span>
                  </div>
                </div>

                <div>
                  {pecasAdicionadas.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">Nenhuma peça adicionada ainda</p>
                  ) : (
                    <div className="space-y-3">
                      {pecasAdicionadas.map((peca, index) => (
                        <div key={index} className="premium-card p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <p className="text-sm font-bold text-gray-300">{peca.descricao}</p>
                                {peca.requisitada && (
                                  <span
                                    className="px-2 py-1 rounded text-xs font-bold uppercase"
                                    style={{
                                      backgroundColor: '#FFBF0020',
                                      color: '#FFBF00',
                                      border: '1px solid #FFBF0060'
                                    }}
                                  >
                                    REQUISITADA
                                  </span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500">Código: {peca.codigo}</p>
                              <p className="text-xs text-gray-500 mt-1">Valor GSPN: R$ {peca.valor.toFixed(2)}</p>
                            </div>
                            <div className="flex gap-2">
                              {!peca.requisitada && (
                                <button
                                  onClick={() => {
                                    const novasPecas = [...pecasAdicionadas];
                                    novasPecas[index].requisitada = true;
                                    setPecasAdicionadas(novasPecas);
                                    setRequisicoesTemporarias([...requisicoesTemporarias, {
                                      codigo: peca.codigo,
                                      descricao: peca.descricao,
                                      quantidade: 1
                                    }]);
                                  }}
                                  className="neon-button flex items-center gap-2 text-xs px-4 py-2"
                                  style={{
                                    backgroundColor: '#FFBF0020',
                                    borderColor: '#FFBF00',
                                    color: '#FFBF00'
                                  }}
                                >
                                  <Package className="w-3 h-3" />
                                  REQUISITAR
                                </button>
                              )}
                              <button
                                onClick={() => {
                                  if (peca.requisitada) {
                                    setRequisicoesTemporarias(requisicoesTemporarias.filter(req => req.codigo !== peca.codigo));
                                  }
                                  setPecasAdicionadas(pecasAdicionadas.filter((_, i) => i !== index));
                                }}
                                className="neon-button flex items-center gap-2 text-xs px-4 py-2"
                                style={{
                                  backgroundColor: '#FF006410',
                                  borderColor: '#FF0064',
                                  color: '#FF0064'
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                                REMOVER
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {abaAtiva === 'checklist' && currentMode === 'create' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-sm font-bold text-[#39FF14] uppercase tracking-wider">
                    Selecionar Checklists
                  </h3>
                  <div className="text-xs text-gray-400">
                    {checklistsSelecionados.length} selecionado(s)
                  </div>
                </div>

                <div className="bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-lg p-4 mb-4">
                  <p className="text-xs text-gray-300">
                    <strong className="text-[#39FF14]">Dica:</strong> Selecione os checklists que deseja vincular a esta OS.
                    Baseado no tipo de OS (<strong>{tipoOS}</strong>) e tipo de atendimento (<strong>{tipoAtendimento}</strong>).
                  </p>
                </div>

                {checklistsDisponiveis.length === 0 ? (
                  <div className="text-center py-12">
                    <CheckSquare className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">Nenhum checklist disponível para esta OS</p>
                    <p className="text-gray-600 text-xs mt-2">
                      Configure checklists em Configurações para aparecerem aqui
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {checklistsDisponiveis.map((checklist) => {
                      const isSelecionado = checklistsSelecionados.includes(checklist.id);
                      return (
                        <div
                          key={checklist.id}
                          onClick={() => {
                            if (isSelecionado) {
                              setChecklistsSelecionados(checklistsSelecionados.filter(id => id !== checklist.id));
                            } else {
                              setChecklistsSelecionados([...checklistsSelecionados, checklist.id]);
                            }
                          }}
                          className="premium-card p-4 cursor-pointer transition-all hover:scale-[1.01]"
                          style={{
                            borderColor: isSelecionado ? '#39FF14' : '#39FF1440',
                            backgroundColor: isSelecionado ? 'rgba(57, 255, 20, 0.15)' : 'rgba(57, 255, 20, 0.05)'
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex-shrink-0 mt-1">
                              <div
                                className="w-5 h-5 rounded border-2 flex items-center justify-center transition-all"
                                style={{
                                  borderColor: isSelecionado ? '#39FF14' : '#39FF1460',
                                  backgroundColor: isSelecionado ? '#39FF14' : 'transparent'
                                }}
                              >
                                {isSelecionado && (
                                  <CheckCircle className="w-4 h-4 text-black" />
                                )}
                              </div>
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-bold text-[#39FF14] mb-1">{checklist.nome}</p>
                              {checklist.descricao && (
                                <p className="text-xs text-gray-400 mb-2">{checklist.descricao}</p>
                              )}
                              <div className="flex flex-wrap gap-2">
                                {checklist.tipo_os && checklist.tipo_os.length > 0 && (
                                  <span className="text-xs px-2 py-1 rounded bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/40">
                                    {checklist.tipo_os.join(', ')}
                                  </span>
                                )}
                                {checklist.tipos_atendimento && checklist.tipos_atendimento.length > 0 && (
                                  <span className="text-xs px-2 py-1 rounded bg-[#FFA500]/20 text-[#FFA500] border border-[#FFA500]/40">
                                    {checklist.tipos_atendimento.join(', ')}
                                  </span>
                                )}
                                {checklist.itens && Array.isArray(checklist.itens) && (
                                  <span className="text-xs px-2 py-1 rounded bg-gray-700 text-gray-300">
                                    {checklist.itens.length} item(ns)
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {abaAtiva === 'servicos' && (tipoOS === 'OW' || os?.tipo_os === 'OW') && currentMode === 'create' && (
              <div className="space-y-4">
                {servicosAdicionados.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#00D4FF]/10 to-[#39FF14]/10 flex items-center justify-center mx-auto mb-4 border border-[#00D4FF]/20">
                      <Wrench className="w-10 h-10 text-[#00D4FF]/60" />
                    </div>
                    <p className="text-gray-400 text-sm mb-6">Nenhum servico adicionado</p>
                    <button
                      onClick={() => {
                        loadServicosCadastrados();
                        setMostrarModalServico(true);
                      }}
                      className="neon-button px-8 py-3 text-sm"
                      style={{
                        backgroundColor: '#00D4FF20',
                        borderColor: '#00D4FF',
                        color: '#00D4FF'
                      }}
                    >
                      <Plus className="w-4 h-4 inline mr-2" />
                      ADICIONAR SERVICO
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-[#00D4FF] uppercase tracking-wider">
                        Servicos Adicionados ({servicosAdicionados.length})
                      </h3>
                      <button
                        onClick={() => {
                          loadServicosCadastrados();
                          setMostrarModalServico(true);
                        }}
                        className="neon-button px-4 py-2 text-xs"
                        style={{
                          backgroundColor: '#00D4FF20',
                          borderColor: '#00D4FF',
                          color: '#00D4FF'
                        }}
                      >
                        <Plus className="w-3 h-3 inline mr-1" />
                        ADICIONAR
                      </button>
                    </div>

                    <div className="space-y-3">
                      {servicosAdicionados.map((servico, index) => (
                        <div key={index} className="premium-card p-4" style={{ borderColor: '#00D4FF40' }}>
                          <div className="flex items-start gap-4">
                            <div className="flex-1">
                              <p className="text-sm font-bold text-[#00D4FF] mb-1">{servico.codigo}</p>
                              <p className="text-xs text-gray-400">{servico.descricao}</p>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => {
                                    if (servico.quantidade > 1) {
                                      setServicosAdicionados(servicosAdicionados.map(s =>
                                        s.codigo === servico.codigo ? { ...s, quantidade: s.quantidade - 1 } : s
                                      ));
                                    }
                                  }}
                                  className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-white font-bold transition-colors"
                                >
                                  -
                                </button>
                                <span className="text-sm font-bold text-white w-8 text-center">{servico.quantidade}</span>
                                <button
                                  onClick={() => {
                                    setServicosAdicionados(servicosAdicionados.map(s =>
                                      s.codigo === servico.codigo ? { ...s, quantidade: s.quantidade + 1 } : s
                                    ));
                                  }}
                                  className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-white font-bold transition-colors"
                                >
                                  +
                                </button>
                              </div>
                              <div className="text-right min-w-[100px]">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={servico.valor_unitario}
                                  onChange={(e) => {
                                    setServicosAdicionados(servicosAdicionados.map(s =>
                                      s.codigo === servico.codigo ? { ...s, valor_unitario: parseFloat(e.target.value) || 0 } : s
                                    ));
                                  }}
                                  className="neon-input w-24 text-right text-sm py-1 px-2"
                                  placeholder="0.00"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                  Total: <span className="text-[#39FF14] font-bold">R$ {(servico.valor_unitario * servico.quantidade).toFixed(2)}</span>
                                </p>
                              </div>
                              <button
                                onClick={() => setServicosAdicionados(servicosAdicionados.filter((_, i) => i !== index))}
                                className="w-8 h-8 rounded-lg bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center transition-colors"
                              >
                                <X className="w-4 h-4 text-red-400" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}

                      <div className="premium-card p-4 bg-gradient-to-r from-[#00D4FF]/10 to-[#39FF14]/10" style={{ borderColor: '#39FF14' }}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-[#00D4FF] uppercase tracking-wider">Total de Servicos:</span>
                          <span className="text-2xl font-bold text-[#39FF14]">
                            R$ {servicosAdicionados.reduce((sum, s) => sum + (s.valor_unitario * s.quantidade), 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {abaAtiva === 'pagamento' && tipoOS === 'OW' && currentMode === 'create' && (
              <div className="space-y-4">
                {(() => {
                  const valorPecas = pecasAdicionadas.reduce((sum, p) => sum + p.valor, 0);
                  const valorServicos = servicosAdicionados.reduce((sum, s) => sum + (s.valor_unitario * s.quantidade), 0);
                  const valorTotal = valorPecas + valorServicos;
                  const valorPago = pagamentosTemporarios.reduce((sum, p) => sum + p.valor, 0);
                  const saldoRestante = valorTotal - valorPago;

                  return (
                    <div className="premium-card p-6 bg-gradient-to-r from-[#39FF14]/5 to-[#00D4FF]/5 mb-6">
                      <div className="grid grid-cols-3 gap-6 mb-4">
                        <div>
                          <p className="text-xs text-gray-400 uppercase mb-1">Valor Total</p>
                          <p className="text-2xl font-bold text-[#00D4FF]">
                            R$ {valorTotal.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase mb-1">Valor Pago</p>
                          <p className="text-2xl font-bold text-[#39FF14]">
                            R$ {valorPago.toFixed(2)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400 uppercase mb-1">Saldo Restante</p>
                          <p className="text-2xl font-bold text-[#FFBF00]">
                            R$ {saldoRestante.toFixed(2)}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className={`px-4 py-2 rounded-lg text-xs font-bold uppercase ${
                          saldoRestante === 0 && valorTotal > 0 ? 'bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/40' :
                          valorPago > 0 && saldoRestante > 0 ? 'bg-[#FFBF00]/20 text-[#FFBF00] border border-[#FFBF00]/40' :
                          'bg-[#FF0064]/20 text-[#FF0064] border border-[#FF0064]/40'
                        }`}>
                          {saldoRestante === 0 && valorTotal > 0 ? 'Pago 100%' :
                           valorPago > 0 && saldoRestante > 0 ? 'Pago Parcial' :
                           'Pendente'}
                        </span>
                        <button
                          onClick={() => setShowAddPaymentModal(true)}
                          className="neon-button px-6 py-3"
                        >
                          <DollarSign className="w-4 h-4 inline mr-2" />
                          Adicionar Pagamento
                        </button>
                      </div>
                    </div>
                  );
                })()}

                <div>
                  <h4 className="text-[#00D4FF] font-bold mb-3 uppercase text-sm flex items-center gap-2">
                    <DollarSign className="w-4 h-4" />
                    Pagamentos ({pagamentosTemporarios.length})
                  </h4>

                  {pagamentosTemporarios.length === 0 ? (
                    <div className="text-center py-12">
                      <DollarSign className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">Nenhum pagamento registrado ainda</p>
                      <p className="text-xs text-gray-600 mt-2">Clique em "Adicionar Pagamento" para registrar</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {pagamentosTemporarios.map((pag, index) => {
                        const getFormaPagamentoLabel = (forma: string) => {
                          const labels: Record<string, string> = {
                            pix: 'PIX',
                            cartao_credito: 'Cartao de Credito',
                            cartao_debito: 'Cartao de Debito',
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

                        return (
                          <div
                            key={index}
                            className="premium-card p-5 transition-all"
                            style={{
                              borderLeft: `4px solid ${getFormaPagamentoColor(pag.forma_pagamento)}`
                            }}
                          >
                            <div className="flex items-start justify-between mb-4">
                              <div className="flex items-center gap-3">
                                <div
                                  className="w-10 h-10 rounded-lg flex items-center justify-center"
                                  style={{
                                    backgroundColor: `${getFormaPagamentoColor(pag.forma_pagamento)}20`,
                                    borderColor: getFormaPagamentoColor(pag.forma_pagamento),
                                    borderWidth: '2px'
                                  }}
                                >
                                  <DollarSign
                                    className="w-5 h-5"
                                    style={{ color: getFormaPagamentoColor(pag.forma_pagamento) }}
                                  />
                                </div>
                                <div>
                                  <p className="text-lg font-bold text-white">
                                    R$ {pag.valor.toFixed(2)}
                                  </p>
                                  <p
                                    className="text-xs font-semibold"
                                    style={{ color: getFormaPagamentoColor(pag.forma_pagamento) }}
                                  >
                                    {getFormaPagamentoLabel(pag.forma_pagamento)}
                                    {pag.parcelamento && pag.parcelamento > 1 && ` - ${pag.parcelamento}x`}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => {
                                  setPagamentosTemporarios(pagamentosTemporarios.filter((_, i) => i !== index));
                                }}
                                className="text-red-400 hover:text-red-300 transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>

                            {pag.nsu && (
                              <div className="mb-2">
                                <p className="text-xs text-gray-400 uppercase">NSU</p>
                                <p className="text-sm text-gray-300 font-mono">{pag.nsu}</p>
                              </div>
                            )}

                            {pag.pix_id_transacao && (
                              <div className="mb-2">
                                <p className="text-xs text-gray-400 uppercase">ID Transação PIX</p>
                                <p className="text-sm text-gray-300 font-mono">{pag.pix_id_transacao}</p>
                              </div>
                            )}

                            {pag.taxa_percentual && pag.taxa_percentual > 0 && (
                              <div className="mb-2">
                                <p className="text-xs text-gray-400 uppercase">Taxa</p>
                                <p className="text-sm text-[#FFBF00]">{pag.taxa_percentual}% - Paga por: {pag.taxa_paga_por === 'empresa' ? 'Empresa' : 'Cliente'}</p>
                              </div>
                            )}

                            {pag.observacoes && (
                              <div className="mt-3 premium-card p-3 bg-[#00D4FF]/5">
                                <p className="text-xs text-gray-400 uppercase mb-1">Observações</p>
                                <p className="text-sm text-gray-300">{pag.observacoes}</p>
                              </div>
                            )}

                            {pag.comprovante && (
                              <div className="mt-3">
                                <p className="text-xs text-[#39FF14]">
                                  <CheckCircle className="w-3 h-3 inline mr-1" />
                                  Comprovante anexado</p>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}

            {abaAtiva === 'pagamento' && tipoOS === 'OW' && currentMode === 'view' && (
              <div className="space-y-6">
                <div className="bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-lg p-6 text-center">
                  <DollarSign className="w-16 h-16 text-[#39FF14] mx-auto mb-4" />
                  <h3 className="text-lg font-bold text-[#39FF14] uppercase tracking-wider mb-2">
                    Pagamentos
                  </h3>
                  <p className="text-sm text-gray-300 mb-4">
                    Os pagamentos serão gerenciados após você criar a OS.
                  </p>
                  <p className="text-xs text-gray-400">
                    Após criar a OS, você terá acesso completo ao gerenciamento de pagamentos nesta aba.
                  </p>
                </div>
              </div>
            )}

            {abaAtiva === 'pagamento' && currentMode === 'view' && os && os.tipo_os === 'OW' && (
              <OSPagamentoTab
                osId={os.id}
                os={os}
                onUpdate={async () => {
                  await loadOS();
                }}
              />
            )}

            {abaAtiva === 'servicos' && (tipoOS === 'OW' || os?.tipo_os === 'OW') && currentMode === 'view' && (
              <div className="space-y-4">
                {servicos.length === 0 ? (
                  <div className="text-center py-16">
                    <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#00D4FF]/10 to-[#39FF14]/10 flex items-center justify-center mx-auto mb-4 border border-[#00D4FF]/20">
                      <Wrench className="w-10 h-10 text-[#00D4FF]/60" />
                    </div>
                    <p className="text-gray-400 text-sm mb-6">Nenhum servico adicionado</p>
                    <button
                      onClick={() => {
                        loadServicosCadastrados();
                        setMostrarModalServico(true);
                      }}
                      className="neon-button px-8 py-3 text-sm"
                      style={{
                        backgroundColor: '#00D4FF20',
                        borderColor: '#00D4FF',
                        color: '#00D4FF'
                      }}
                    >
                      <Plus className="w-4 h-4 inline mr-2" />
                      ADICIONAR SERVICO
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-sm font-bold text-[#00D4FF] uppercase tracking-wider">
                        Servicos ({servicos.length})
                      </h3>
                      <button
                        onClick={() => {
                          loadServicosCadastrados();
                          setMostrarModalServico(true);
                        }}
                        className="neon-button px-4 py-2 text-xs"
                        style={{
                          backgroundColor: '#00D4FF20',
                          borderColor: '#00D4FF',
                          color: '#00D4FF'
                        }}
                      >
                        <Plus className="w-3 h-3 inline mr-1" />
                        ADICIONAR
                      </button>
                    </div>

                    <div className="space-y-3">
                      {servicos.map((servico) => (
                        <div key={servico.id} className="premium-card p-4" style={{ borderColor: '#00D4FF40' }}>
                          <div className="flex items-start gap-4">
                            <div className="flex-1">
                              <p className="text-sm font-bold text-[#00D4FF] mb-1">{servico.codigo_servico}</p>
                              <p className="text-xs text-gray-400">{servico.descricao}</p>
                            </div>
                            <div className="flex items-center gap-4">
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={async () => {
                                    if (servico.quantidade > 1) {
                                      await supabase
                                        .from('os_servicos')
                                        .update({ quantidade: servico.quantidade - 1, valor_total: servico.valor_unitario * (servico.quantidade - 1) })
                                        .eq('id', servico.id);
                                      loadServicos();
                                    }
                                  }}
                                  className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-white font-bold transition-colors"
                                >
                                  -
                                </button>
                                <span className="text-sm font-bold text-white w-8 text-center">{servico.quantidade}</span>
                                <button
                                  onClick={async () => {
                                    await supabase
                                      .from('os_servicos')
                                      .update({ quantidade: servico.quantidade + 1, valor_total: servico.valor_unitario * (servico.quantidade + 1) })
                                      .eq('id', servico.id);
                                    loadServicos();
                                  }}
                                  className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-white font-bold transition-colors"
                                >
                                  +
                                </button>
                              </div>
                              <div className="text-right min-w-[100px]">
                                <input
                                  type="number"
                                  step="0.01"
                                  defaultValue={servico.valor_unitario}
                                  onBlur={async (e) => {
                                    const novoValor = parseFloat(e.target.value) || 0;
                                    await supabase
                                      .from('os_servicos')
                                      .update({ valor_unitario: novoValor, valor_total: novoValor * servico.quantidade })
                                      .eq('id', servico.id);
                                    loadServicos();
                                  }}
                                  className="neon-input w-24 text-right text-sm py-1 px-2"
                                  placeholder="0.00"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                  Total: <span className="text-[#39FF14] font-bold">R$ {(servico.valor_total || 0).toFixed(2)}</span>
                                </p>
                              </div>
                              <button
                                onClick={async () => {
                                  if (confirm('Remover este servico?')) {
                                    await supabase.from('os_servicos').delete().eq('id', servico.id);
                                    loadServicos();
                                  }
                                }}
                                className="w-8 h-8 rounded-lg bg-red-500/20 hover:bg-red-500/30 flex items-center justify-center transition-colors"
                              >
                                <X className="w-4 h-4 text-red-400" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}

                      <div className="premium-card p-4 bg-gradient-to-r from-[#00D4FF]/10 to-[#39FF14]/10" style={{ borderColor: '#39FF14' }}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-[#00D4FF] uppercase tracking-wider">Total de Servicos:</span>
                          <span className="text-2xl font-bold text-[#39FF14]">
                            R$ {servicos.reduce((sum, s) => sum + (s.valor_total || 0), 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}

            {false && abaAtiva === 'servicos' && tipoOS === 'OW' && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-[#00D4FF] uppercase tracking-wider mb-4">Serviços</h3>
                <div>
                  {pagamentosTemporarios.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">Recurso de serviços ainda não implementado no modo de criação</p>
                  ) : (
                    <div className="space-y-3">
                      {pagamentosTemporarios.map((pag, index) => (
                        <div key={index} className="premium-card p-4">
                          <div className="grid grid-cols-3 gap-3 mb-3">
                            <div>
                              <label className="text-xs text-gray-400 uppercase block mb-2">
                                Valor (R$)
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                value={pag.valor}
                                onChange={(e) => {
                                  const novosPagamentos = [...pagamentosTemporarios];
                                  novosPagamentos[index].valor = parseFloat(e.target.value) || 0;
                                  setPagamentosTemporarios(novosPagamentos);
                                }}
                                className="neon-input w-full"
                                placeholder="0.00"
                              />
                            </div>
                            <div>
                              <label className="text-xs text-gray-400 uppercase block mb-2">
                                Data
                              </label>
                              <input
                                type="date"
                                value={pag.data_pagamento}
                                onChange={(e) => {
                                  const novosPagamentos = [...pagamentosTemporarios];
                                  novosPagamentos[index].data_pagamento = e.target.value;
                                  setPagamentosTemporarios(novosPagamentos);
                                }}
                                className="neon-input w-full"
                              />
                            </div>
                            <div className="flex items-end">
                              <button
                                onClick={() => {
                                  setPagamentosTemporarios(pagamentosTemporarios.filter((_, i) => i !== index));
                                }}
                                className="neon-button flex items-center gap-2 text-xs px-4 py-2 w-full"
                                style={{
                                  backgroundColor: '#FF006410',
                                  borderColor: '#FF0064',
                                  color: '#FF0064'
                                }}
                              >
                                <Trash2 className="w-3 h-3" />
                                REMOVER
                              </button>
                            </div>
                          </div>
                          <div>
                            <label className="text-xs text-gray-400 uppercase block mb-2">
                              Observações
                            </label>
                            <textarea
                              value={pag.observacoes || ''}
                              onChange={(e) => {
                                const novosPagamentos = [...pagamentosTemporarios];
                                novosPagamentos[index].observacoes = e.target.value;
                                setPagamentosTemporarios(novosPagamentos);
                              }}
                              className="neon-input w-full"
                              rows={2}
                              placeholder="Observações sobre o pagamento..."
                            />
                          </div>
                          <div className="mt-2 flex items-center gap-2">
                            <span className="text-xs px-2 py-1 rounded font-bold" style={{
                              backgroundColor: '#00D4FF20',
                              color: '#00D4FF',
                              border: '1px solid #00D4FF60'
                            }}>
                              {pag.forma_pagamento.toUpperCase().replace('_', ' ')}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {abaAtiva === 'anexos' && (
              <div className="space-y-6">
                <div className="premium-card p-6">
                  <label className="neon-button flex items-center justify-center gap-2 w-full px-4 py-3 cursor-pointer"
                    style={{
                      backgroundColor: tipoOS === 'LP' ? '#FFA50020' : '#00D4FF20',
                      borderColor: tipoOS === 'LP' ? '#FFA500' : '#00D4FF',
                      color: tipoOS === 'LP' ? '#FFA500' : '#00D4FF'
                    }}>
                    <Paperclip className="w-4 h-4" />
                    SELECIONAR ARQUIVO
                    <input
                      type="file"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setAnexosTemporarios([...anexosTemporarios, {
                            file,
                            nome: file.name
                          }]);
                          e.target.value = '';
                        }
                      }}
                      className="hidden"
                    />
                  </label>
                </div>

                <div>
                  {anexosTemporarios.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">Nenhum arquivo selecionado</p>
                  ) : (
                    <div className="space-y-2">
                      {anexosTemporarios.map((anexo, index) => (
                        <div key={index} className="premium-card p-4 flex items-center justify-between">
                          <div>
                            <p className="text-sm text-gray-300">{anexo.nome}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              {(anexo.file.size / 1024).toFixed(2)} KB
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setAnexosTemporarios(anexosTemporarios.filter((_, i) => i !== index));
                            }}
                            className="neon-button flex items-center gap-2 text-xs px-3 py-1"
                            style={{
                              backgroundColor: '#FF006410',
                              borderColor: '#FF0064',
                              color: '#FF0064'
                            }}
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {abaAtiva === 'agendamento' && (
              <div className="space-y-6">
                <div className="rounded-lg p-4" style={{
                  backgroundColor: tipoOS === 'LP' ? '#FFA5001a' : '#00D4FF1a',
                  border: `1px solid ${tipoOS === 'LP' ? '#FFA500' : '#00D4FF'}4d`
                }}>
                  <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2" style={{
                    color: tipoOS === 'LP' ? '#FFA500' : '#00D4FF'
                  }}>
                    <Calendar className="w-4 h-4" />
                    Agendamento
                  </h3>
                  <p className="text-xs text-gray-400 mt-2">
                    Configure o agendamento após criar a OS
                  </p>
                </div>
              </div>
            )}

            {abaAtiva === 'comentarios' && (
              <div className="space-y-4">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Adicionar comentário..."
                    value={novoComentario}
                    onChange={(e) => setNovoComentario(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && novoComentario.trim()) {
                        setComentariosTemporarios([...comentariosTemporarios, novoComentario.trim()]);
                        setNovoComentario('');
                      }
                    }}
                    className="neon-input flex-1"
                  />
                  <button
                    onClick={() => {
                      if (novoComentario.trim()) {
                        setComentariosTemporarios([...comentariosTemporarios, novoComentario.trim()]);
                        setNovoComentario('');
                      }
                    }}
                    className="neon-button px-6"
                  >
                    Enviar
                  </button>
                </div>

                <div className="space-y-3">
                  {comentariosTemporarios.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">Nenhum comentário ainda</p>
                  ) : (
                    comentariosTemporarios.map((comentario, index) => (
                      <div key={index} className="premium-card p-4">
                        <div className="flex items-start justify-between mb-2">
                          <p className="text-sm text-gray-300 flex-1">{comentario}</p>
                          <button
                            onClick={() => {
                              setComentariosTemporarios(comentariosTemporarios.filter((_, i) => i !== index));
                            }}
                            className="text-gray-500 hover:text-red-500 transition-colors ml-2"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-xs text-gray-500">
                          Por {usuario?.nome || 'Você'}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
            </div>
          </>
        ) : (
          <>
            <div className="flex border-b" style={{ borderColor: `${os?.tipo_os === 'OW' ? '#00D4FF' : '#FFA500'}33` }}>
              {[
                { id: 'dados', label: 'Dados OS/Cliente', icon: User },
                { id: 'estoque', label: 'Estoque & Peças', icon: Package },
                ...(os?.tipo_os === 'OW' ? [{ id: 'servicos', label: 'Serviços', icon: FileText }] : []),
                { id: 'checklist', label: 'Checklist', icon: CheckSquare },
                ...(os?.tipo_os === 'OW' ? [{ id: 'pagamento', label: 'Pagamento', icon: DollarSign }] : []),
                ...(os?.tipo_atendimento === 'IH' ? [{ id: 'agendamento', label: 'Agendamento', icon: Calendar }] : []),
                { id: 'anexos', label: 'Anexos', icon: Paperclip },
                { id: 'comentarios', label: 'Comentários', icon: MessageSquare }
              ].map(({ id, label, icon: Icon }) => {
                const corPrimaria = os?.tipo_os === 'OW' ? '#00D4FF' : '#FFA500';
                return (
                  <button
                    key={id}
                    onClick={() => setAbaAtiva(id as AbaAtiva)}
                    className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 text-xs font-bold uppercase tracking-wider transition-all ${
                      abaAtiva === id ? '' : 'text-gray-400'
                    }`}
                    style={abaAtiva === id ? {
                      backgroundColor: `${corPrimaria}1a`,
                      color: corPrimaria,
                      borderBottom: `2px solid ${corPrimaria}`
                    } : {}}
                    onMouseEnter={(e) => {
                      if (abaAtiva !== id) {
                        e.currentTarget.style.backgroundColor = `${corPrimaria}0d`;
                        e.currentTarget.style.color = corPrimaria;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (abaAtiva !== id) {
                        e.currentTarget.style.backgroundColor = 'transparent';
                        e.currentTarget.style.color = '#9CA3AF';
                      }
                    }}
                  >
                    <Icon className="w-4 h-4" />
                    {label}
                  </button>
                );
              })}
            </div>

            <div className="flex-1 overflow-y-auto cyber-scrollbar p-6">
              {abaAtiva === 'dados' && os && (
                <div className="space-y-6">
                  <div className="premium-card p-4 border-l-4" style={{
                    background: os.tipo_os === 'OW' ? 'linear-gradient(to right, #00D4FF1a, #00D4FF0a)' : 'linear-gradient(to right, #FFA5001a, #00D4FF0a)',
                    borderLeftColor: os.tipo_os === 'OW' ? '#00D4FF' : '#FFA500'
                  }}>
                    <h3 className="text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2" style={{
                      color: os.tipo_os === 'OW' ? '#00D4FF' : '#FFA500'
                    }}>
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
                      <div>
                        <label className="text-xs text-gray-500 uppercase">TAT (Tempo Aberto)</label>
                        <p className="text-sm font-bold mt-1" style={{ color: '#FF00FF' }}>
                          {(() => {
                            const now = new Date();
                            const created = new Date(os.created_at);
                            const diffMs = now.getTime() - created.getTime();
                            const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                            const horas = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                            const minutos = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                            const parts = [];
                            if (dias > 0) parts.push(`${dias}d`);
                            if (horas > 0) parts.push(`${horas}h`);
                            if (minutos > 0 || parts.length === 0) parts.push(`${minutos}m`);
                            return parts.join(' ');
                          })()}
                        </p>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 uppercase">Tempo na Etapa</label>
                        <p className="text-sm font-bold mt-1" style={{ color: '#FFBF00' }}>
                          {(() => {
                            const now = new Date();
                            const updated = new Date(os.updated_at);
                            const diffMs = now.getTime() - updated.getTime();
                            const dias = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                            const horas = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                            const minutos = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
                            const parts = [];
                            if (dias > 0) parts.push(`${dias}d`);
                            if (horas > 0) parts.push(`${horas}h`);
                            if (minutos > 0 || parts.length === 0) parts.push(`${minutos}m`);
                            return parts.join(' ');
                          })()}
                        </p>
                      </div>
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
                        </div>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2" style={{
                      color: os.tipo_os === 'OW' ? '#00D4FF' : '#FFA500'
                    }}>
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
                        <label className="text-xs text-gray-500 uppercase">Telefone 1</label>
                        <p className="text-sm text-gray-300 mt-1">{os.cliente_telefone || '-'}</p>
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 uppercase">Telefone 2</label>
                        <p className="text-sm text-gray-300 mt-1">{os.cliente_telefone_2 || '-'}</p>
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

                  <div className="border-t border-gray-700 pt-6">
                    <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{
                      color: os.tipo_os === 'OW' ? '#00D4FF' : '#FFA500'
                    }}>
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
                      <div className="col-span-2">
                        <label className="text-xs text-gray-500 uppercase">Defeito Relatado</label>
                        <p className="text-sm text-gray-300 mt-1 whitespace-pre-wrap">{os.defeito_relatado || '-'}</p>
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-gray-500 uppercase">Observações Internas</label>
                        <p className="text-sm text-gray-300 mt-1 whitespace-pre-wrap">{os.observacoes_internas || '-'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="premium-card p-6 border-l-4 border-[#00D4FF]">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="text-sm font-bold text-[#00D4FF] uppercase tracking-wider flex items-center gap-2 mb-2">
                          <RefreshCw className="w-4 h-4" />
                          Converter Tipo de OS
                        </h3>
                        <p className="text-xs text-gray-400">
                          Converta esta OS de LP para OW. Todas as informações, anexos e requisições serão mantidos.
                        </p>
                      </div>
                      <button
                        onClick={() => setMostrarModalConversao(true)}
                        className="neon-button px-6 py-3 ml-4"
                        style={{
                          backgroundColor: '#00D4FF20',
                          borderColor: '#00D4FF',
                          color: '#00D4FF'
                        }}
                      >
                        CONVERTER PARA OW
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {abaAtiva === 'estoque' && (
                <div className="space-y-6">
                  {os?.coluna_kanban === 'diagnostico' && (
                    <div className="bg-[#FFBF00]/10 border border-[#FFBF00]/30 rounded-lg p-4">
                      <h3 className="text-sm font-bold text-[#FFBF00] uppercase tracking-wider flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Requisição Bloqueada
                      </h3>
                      <p className="text-xs text-gray-400 mt-2">
                        OS em DIAGNÓSTICO. Conclua a análise técnica para liberar requisição de peças.
                      </p>
                    </div>
                  )}

                  {os?.coluna_kanban !== 'diagnostico' && (
                    <>
                      <div className="bg-[#00D4FF]/10 border border-[#00D4FF]/30 rounded-lg p-4">
                        <h3 className="text-sm font-bold text-[#00D4FF] uppercase tracking-wider flex items-center gap-2">
                          <Package className="w-4 h-4" />
                          Adicionar Nova Requisição
                        </h3>
                        <p className="text-xs text-gray-400 mt-2">
                          Requisite peças do estoque. O almoxarife receberá e atenderá sua requisição.
                        </p>
                      </div>

                      <div className="premium-card p-4">
                    <div className="grid grid-cols-4 gap-3">
                      <div className="relative">
                        <label className="text-xs text-gray-400 uppercase block mb-2">
                          Código/PN *
                        </label>
                        <input
                          type="text"
                          value={novaPecaCodigo}
                          onChange={(e) => {
                            setNovaPecaCodigo(e.target.value);
                            setMostrarSugestoes(true);
                          }}
                          onBlur={() => setTimeout(() => setMostrarSugestoes(false), 200)}
                          className="neon-input w-full"
                          placeholder="Ex: GH82-12345A"
                        />
                        {mostrarSugestoes && sugestoesPecas.length > 0 && (
                          <div className="absolute z-50 mt-1 w-full max-w-md bg-[#0A0F1E] border border-[#00D4FF]/30 rounded-lg shadow-xl max-h-64 overflow-y-auto">
                            {sugestoesPecas.map((sugestao, idx) => (
                              <div
                                key={idx}
                                onClick={() => {
                                  setNovaPecaCodigo(sugestao.pn);
                                  setNovaPecaDescricao(sugestao.descricao);
                                  if (os?.tipo_os === 'OW' && sugestao.valor_com_markup) {
                                    setNovaPecaValor(sugestao.valor_com_markup.toFixed(2));
                                  } else {
                                    setNovaPecaValor((sugestao.valor_corrigido || sugestao.valor_com_impostos || 0).toFixed(2));
                                  }
                                  setMostrarSugestoes(false);
                                }}
                                className="p-3 hover:bg-[#00D4FF]/10 cursor-pointer border-b border-gray-800 last:border-0"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <p className="text-sm font-bold text-[#00D4FF]">{sugestao.pn}</p>
                                    <p className="text-xs text-gray-400 mt-1">{sugestao.descricao}</p>
                                  </div>
                                  <div className="flex-shrink-0">
                                    {os?.tipo_os === 'OW' && sugestao.valor_com_markup ? (
                                      <span className="text-xs px-2 py-0.5 rounded font-bold" style={{
                                        backgroundColor: '#39FF1420',
                                        color: '#39FF14',
                                        border: '1px solid #39FF1440'
                                      }}>
                                        R$ {sugestao.valor_com_markup.toFixed(2)}
                                      </span>
                                    ) : (
                                      <span className="text-xs px-2 py-0.5 rounded" style={{
                                        backgroundColor: sugestao.count > 0 ? '#39FF1420' : '#FF006420',
                                        color: sugestao.count > 0 ? '#39FF14' : '#FF0064',
                                        border: `1px solid ${sugestao.count > 0 ? '#39FF14' : '#FF0064'}40`
                                      }}>
                                        {sugestao.count} disponível
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 uppercase block mb-2">
                          Descrição *
                        </label>
                        <input
                          type="text"
                          value={novaPecaDescricao}
                          onChange={(e) => setNovaPecaDescricao(e.target.value)}
                          className="neon-input w-full"
                          placeholder="Ex: Display LCD"
                        />
                      </div>
                      <div className="col-span-2">
                        <label className="text-xs text-gray-400 uppercase block mb-2">
                          Valor GSPN (R$)
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            step="0.01"
                            value={novaPecaValor}
                            onChange={(e) => setNovaPecaValor(e.target.value)}
                            className="neon-input flex-1"
                            placeholder="0.00"
                          />
                          <button
                            onClick={async () => {
                              if (!novaPecaCodigo || !novaPecaDescricao) {
                                alert('Preencha código e descrição');
                                return;
                              }

                              try {
                                const valorNumerico = novaPecaValor ? parseFloat(novaPecaValor) : null;

                                const { data: requisicaoId, error: insertError } = await supabase.rpc('inserir_requisicao_peca', {
                                  p_os_id: osId,
                                  p_cotacao_peca_id: null,
                                  p_codigo_peca: novaPecaCodigo,
                                  p_descricao: novaPecaDescricao,
                                  p_quantidade_requisitada: 1,
                                  p_valor_peca: valorNumerico,
                                  p_numero_os_samsung: os?.numero_os_samsung || null
                                });

                                if (insertError) {
                                  throw insertError;
                                }

                                await supabase.from('os_comentarios').insert({
                                  os_id: osId,
                                  usuario_id: usuario?.id,
                                  comentario: `✚ Requisição adicionada: ${novaPecaDescricao} (${novaPecaCodigo}) - Qtd: 1${valorNumerico ? ` - Valor: R$ ${valorNumerico.toFixed(2)}` : ''}`,
                                  is_system: true
                                });

                                setNovaPecaCodigo('');
                                setNovaPecaDescricao('');
                                setNovaPecaQuantidade(1);
                                setNovaPecaValor('');
                                setSugestoesPecas([]);
                                await loadPecas();
                                await loadRequisicoes();
                                await loadComentarios();
                                alert('Requisição criada com sucesso!');
                              } catch (error: any) {
                                alert(`Erro ao criar requisição: ${error.message || 'Erro desconhecido'}`);
                              }
                            }}
                            className="neon-button px-4 py-2 flex-1 text-xs"
                            style={{
                              backgroundColor: '#00D4FF20',
                              borderColor: '#00D4FF',
                              color: '#00D4FF'
                            }}
                          >
                            REQUISITAR
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center gap-2 text-xs" style={{ color: '#00D4FF' }}>
                      <AlertCircle className="w-4 h-4" />
                      <span>Para adicionar mais de 1 peça do mesmo código, crie outra linha</span>
                    </div>
                  </div>

                  <div>
                    {pecas.length === 0 && requisicoes.length === 0 ? (
                      <p className="text-gray-500 text-sm">Nenhuma peça cadastrada</p>
                    ) : (
                      <div className="space-y-3">
                        {(() => {
                          const todasPecasParaExibir: any[] = [];
                          const codigosPecasJaExibidos = new Set<string>();

                          pecas.forEach(peca => {
                            const requisicoesDestaPeca = requisicoes.filter(r => {
                              if (peca.os_peca_id) {
                                return r.os_peca_id === peca.os_peca_id;
                              } else if (peca.cotacao_peca_id) {
                                return r.cotacao_peca_id === peca.cotacao_peca_id;
                              }
                              return false;
                            }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                            const requisicaoAtiva = requisicoesDestaPeca.find(r =>
                              r.status !== 'devolvida' && r.status !== 'reprovada' && r.status !== 'cancelada'
                            );
                            const requisicaoDevolvida = requisicoesDestaPeca.find(r =>
                              r.status === 'devolvida' || r.status === 'reprovada'
                            );

                            console.log(`🔍 LP Peça ${peca.descricao?.substring(0, 20)}:`, {
                              peca_os_peca_id: peca.os_peca_id,
                              peca_cotacao_id: peca.cotacao_peca_id,
                              tipo: peca.tipo,
                              num_requisicoes: requisicoesDestaPeca.length,
                              requisicao_ativa: requisicaoAtiva?.status
                            });

                            todasPecasParaExibir.push({
                              peca,
                              requisicao: requisicaoAtiva,
                              requisicaoDevolvida,
                              tipo: peca.tipo || 'cotacao'
                            });
                            codigosPecasJaExibidos.add(peca.codigo || peca.pn || '');
                          });

                          requisicoes.filter(r =>
                            !r.cotacao_peca_id && !r.os_peca_id && !codigosPecasJaExibidos.has(r.codigo_peca || '')
                          ).forEach(r => {
                            todasPecasParaExibir.push({
                              peca: {
                                id: r.id,
                                descricao: r.descricao,
                                codigo: r.codigo_peca,
                                quantidade: r.quantidade_requisitada,
                                valor_unitario: r.valor_peca,
                                valor_total: (r.valor_peca || 0) * r.quantidade_requisitada
                              },
                              requisicao: r.status !== 'devolvida' && r.status !== 'reprovada' && r.status !== 'cancelada' ? r : null,
                              requisicaoDevolvida: r.status === 'devolvida' || r.status === 'reprovada' ? r : null,
                              tipo: 'manual'
                            });
                          });

                          return todasPecasParaExibir.map(({ peca, requisicao, requisicaoDevolvida, tipo }, idx) => {
                            const temNovaRequisicaoPendente = requisicao && requisicaoDevolvida &&
                              requisicao.status === 'pendente' &&
                              new Date(requisicao.created_at) > new Date(requisicaoDevolvida.created_at);

                            return (
                              <div key={`${tipo}-${peca.id}-${idx}`} className="premium-card p-4">
                                <div className="flex items-start justify-between mb-2">
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                      <p className="text-sm font-bold text-gray-300">{peca.descricao || 'Sem descrição'}</p>
                                      {(tipo === 'cotacao' || tipo === 'os_peca') && (
                                        <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{
                                          backgroundColor: '#9333EA20',
                                          color: '#9333EA',
                                          border: '1px solid #9333EA60'
                                        }}>
                                          GSPN
                                        </span>
                                      )}
                                      {requisicao && getStatusBadge(requisicao.status)}
                                      {!requisicao && requisicaoDevolvida && getStatusBadge(requisicaoDevolvida.status)}
                                    </div>
                                    <p className="text-xs text-gray-500 mt-1">Código: {peca.codigo || peca.pn || 'N/A'}</p>
                                    <div className="flex items-center gap-4 mt-2">
                                      <p className="text-xs text-gray-500">Qtd: {peca.quantidade}</p>
                                      <p className="text-xs text-gray-500">
                                        Unit: R$ {Number(peca.valor_unitario || 0).toFixed(2)}
                                      </p>
                                      <p className="text-xs font-bold text-[#39FF14]">
                                        Total: R$ {Number(peca.valor_total || 0).toFixed(2)}
                                      </p>
                                    </div>
                                    {(requisicao || requisicaoDevolvida) && (
                                      <p className="text-xs text-gray-500 mt-2">
                                        Requisitado em: {new Date((requisicao || requisicaoDevolvida)!.created_at).toLocaleString('pt-BR')}
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
                                            <p className="text-xs font-bold text-[#00D4FF] mb-1">PEDIDO REGISTRADO</p>
                                            {requisicao.numero_pedido_samsung && requisicao.numero_pedido_samsung !== 'N/A' && !requisicao.numero_pedido_samsung.startsWith('PENDENTE-') && (
                                              <p className="text-xs text-gray-300">
                                                Pedido Samsung: <span className="font-mono text-[#00D4FF]">{requisicao.numero_pedido_samsung}</span>
                                              </p>
                                            )}
                                            <p className="text-xs text-gray-500 mt-2">
                                              Aguardando chegada da peça
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
                                            {requisicao.status === 'em_uso' && (
                                              <p className="text-xs text-[#FFBF00] mt-2 italic">
                                                Voce pode postar uma nova GI ou devolver a peca novamente
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    )}
                                    {(() => {
                                      const reqComDevolucao = (requisicao?.status === 'devolucao_pendente' || requisicao?.status === 'devolvida') ? requisicao :
                                                              (requisicaoDevolvida?.status === 'devolucao_pendente' || requisicaoDevolvida?.status === 'devolvida') ? requisicaoDevolvida : null;

                                      return reqComDevolucao && reqComDevolucao.motivo_devolucao && (
                                        <div className="mt-3 p-3 rounded-lg" style={{
                                          backgroundColor: reqComDevolucao.tipo_devolucao === 'nova_com_defeito' ? '#FF006410' : reqComDevolucao.tipo_devolucao === 'nova' ? '#39FF1410' : '#FFBF0010',
                                          border: reqComDevolucao.tipo_devolucao === 'nova_com_defeito' ? '1px solid #FF006460' : reqComDevolucao.tipo_devolucao === 'nova' ? '1px solid #39FF1460' : '1px solid #FFBF0060'
                                        }}>
                                          <div className="flex items-start gap-2">
                                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{
                                              color: reqComDevolucao.tipo_devolucao === 'nova_com_defeito' ? '#FF0064' : reqComDevolucao.tipo_devolucao === 'nova' ? '#39FF14' : '#FFBF00'
                                            }} />
                                            <div className="flex-1">
                                              <p className="text-xs font-bold mb-1" style={{
                                                color: reqComDevolucao.tipo_devolucao === 'nova_com_defeito' ? '#FF0064' : reqComDevolucao.tipo_devolucao === 'nova' ? '#39FF14' : '#FFBF00'
                                              }}>
                                                {reqComDevolucao.status === 'devolucao_pendente' ? 'DEVOLUÇÃO SOLICITADA' : 'PEÇA DEVOLVIDA'} - {reqComDevolucao.tipo_devolucao === 'nova' ? 'NOVA' : reqComDevolucao.tipo_devolucao === 'nova_com_defeito' ? 'COM DEFEITO' : 'USADA'}
                                              </p>
                                              <p className="text-xs text-gray-300">
                                                {reqComDevolucao.tipo_devolucao === 'nova_com_defeito' ? 'DEFEITO: ' : 'Motivo: '}
                                                {reqComDevolucao.motivo_devolucao}
                                              </p>
                                            </div>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </div>

                                  <div className="flex gap-2">
                                    {!requisicao && !requisicaoDevolvida && os?.coluna_kanban !== 'diagnostico' && (
                                      <button
                                        onClick={() => {
                                          console.log('🎯 CLIQUE NO BOTÃO - Objeto peca:', {
                                            id: peca.id,
                                            cotacao_peca_id: peca.cotacao_peca_id,
                                            codigo: peca.codigo,
                                            pn: peca.pn,
                                            descricao: peca.descricao?.substring(0, 30),
                                            todas_props: Object.keys(peca)
                                          });
                                          handleRequisitarPeca(peca);
                                        }}
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

                                    {requisicaoDevolvida?.status === 'reprovada' && !temNovaRequisicaoPendente && os?.coluna_kanban !== 'diagnostico' && (
                                      <button
                                        onClick={() => handleRequisitarNovamente(peca, requisicaoDevolvida)}
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

                                    {requisicaoDevolvida?.status === 'devolvida' && !temNovaRequisicaoPendente && os?.coluna_kanban !== 'diagnostico' && requisicaoDevolvida?.tipo_devolucao === 'usada' && (
                                      <button
                                        onClick={() => handleRequisitarNovamente(peca, requisicaoDevolvida)}
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
                                  </div>
                                </div>
                              </div>
                            );
                          });
                        })()}
                      </div>
                    )}
                  </div>
                    </>
                  )}
                </div>
              )}

              {abaAtiva === 'checklist' && os && (
                <OSChecklistTab
                  osId={os.id}
                  tipoOS={os.tipo_os}
                  tipoAtendimento={os.tipo_atendimento}
                  unidadeId={os.unidade_id}
                />
              )}

              {abaAtiva === 'servicos' && os && os.tipo_os === 'OW' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold text-[#00D4FF] uppercase tracking-wider">Serviços</h3>
                    <button
                      onClick={() => {
                        loadServicosCadastrados();
                        setMostrarModalServico(true);
                      }}
                      className="neon-button px-4 py-2 text-xs"
                      style={{
                        backgroundColor: '#00D4FF20',
                        borderColor: '#00D4FF',
                        color: '#00D4FF'
                      }}
                    >
                      ADICIONAR SERVIÇO
                    </button>
                  </div>

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

              {abaAtiva === 'pagamento' && os && os.tipo_os === 'OW' && (
                <OSPagamentoTab
                  osId={os.id}
                  os={os}
                  onUpdate={async () => {
                    await loadOS();
                  }}
                />
              )}

              {abaAtiva === 'agendamento' && os && (
                <OSAgendamentoTab
                  osId={os.id}
                  unidadeId={os.unidade_id}
                  tipoAtendimento={os.tipo_atendimento || 'CI'}
                  dataAgendamento={os.data_agendamento}
                  tecnicoAgendadoId={os.tecnico_agendado_id}
                  confirmadoComCliente={os.confirmado_com_cliente}
                  periodoAgendamento={os.periodo_agendamento}
                  tipoReparo={os.tipo_reparo}
                  colunaKanban={os.coluna_kanban}
                  onSave={loadOS}
                />
              )}

              {abaAtiva === 'anexos' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider" style={{
                      color: os.tipo_os === 'OW' ? '#00D4FF' : '#FFA500'
                    }}>
                      Anexos
                    </h3>
                    <label className="neon-button flex items-center gap-2 text-xs px-4 py-2 cursor-pointer">
                      <Paperclip className="w-3 h-3" />
                      ADICIONAR
                      <input
                        type="file"
                        onChange={handleUploadAnexo}
                        className="hidden"
                      />
                    </label>
                  </div>
                  {anexos.length === 0 ? (
                    <p className="text-gray-500 text-sm">Nenhum anexo</p>
                  ) : (
                    <div className="space-y-2">
                      {anexos.map((anexo) => (
                        <div key={anexo.id} className="premium-card p-4">
                          <p className="text-sm text-gray-300">{anexo.nome_arquivo}</p>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-1">
                            <span>{((anexo.tamanho_bytes || 0) / 1024).toFixed(2)} KB</span>
                            <span className="text-gray-600">|</span>
                            <span>{anexo.created_at ? new Date(anexo.created_at).toLocaleDateString('pt-BR') : '-'}</span>
                            <span>{anexo.created_at ? new Date(anexo.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                            <span className="text-gray-600">|</span>
                            <span>{anexo.usuario?.nome || 'Sistema'}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {abaAtiva === 'comentarios' && (
                <div>
                  <div className="mb-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{
                      color: os.tipo_os === 'OW' ? '#00D4FF' : '#FFA500'
                    }}>
                      Adicionar Comentário
                    </h3>
                    <div className="flex gap-2">
                      <textarea
                        value={novoComentario}
                        onChange={(e) => setNovoComentario(e.target.value)}
                        className="neon-input flex-1"
                        rows={3}
                        placeholder="Digite seu comentário..."
                      />
                      <button
                        onClick={handleAdicionarComentario}
                        className="neon-button px-4"
                      >
                        <Send className="w-4 h-4" />
                      </button>
                    </div>
                    <label className="flex items-center gap-2 mt-2 text-xs text-gray-400">
                      <input
                        type="checkbox"
                        checked={mostrarComentariosSistema}
                        onChange={(e) => setMostrarComentariosSistema(e.target.checked)}
                      />
                      Mostrar logs do sistema
                    </label>
                  </div>

                  <div className="space-y-3">
                    {comentarios
                      .filter(c => mostrarComentariosSistema || !c.is_system)
                      .map((comentario) => (
                        <div
                          key={comentario.id}
                          className={`premium-card p-4 ${
                            comentario.is_system ? 'border-l-4 border-l-blue-500' : ''
                          }`}
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <User className="w-4 h-4 text-gray-500" />
                              <span className="text-sm text-gray-400">
                                {comentario.is_system ? 'Sistema' : 'Usuário'}
                              </span>
                            </div>
                            <span className="text-xs text-gray-600">
                              {new Date(comentario.created_at).toLocaleString('pt-BR')}
                            </span>
                          </div>
                          <p className="text-sm text-gray-300 whitespace-pre-wrap">
                            {comentario.comentario}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {currentMode === 'create' && (
          <div className="p-6 border-t" style={{ borderColor: `${tipoOS === 'LP' ? '#FFA500' : '#00D4FF'}33` }}>
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-4 text-xs text-gray-400">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#00D4FF]" />
                  <span>
                    {pecasAdicionadas.length} peça(s) • {servicosAdicionados.length} serviço(s) • {checklistsSelecionados.length} checklist • {anexosTemporarios.length} anexo(s) • {comentariosTemporarios.length} comentário(s)
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-4 justify-end">
              <button
                onClick={() => {
                  const temDados = pecasAdicionadas.length > 0 || servicosAdicionados.length > 0 || requisicoesTemporarias.length > 0 || pagamentosTemporarios.length > 0 || checklistsSelecionados.length > 0 || anexosTemporarios.length > 0 || comentariosTemporarios.length > 0 || clienteNome || defeitoRelatado;
                  if (temDados) {
                    const confirmar = confirm('Tem certeza que deseja cancelar? Todos os dados preenchidos serão perdidos.');
                    if (!confirmar) return;
                  }
                  onClose();
                }}
                className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
              >
                CANCELAR
              </button>
              <button
                onClick={handleCriarOS}
                disabled={loading || !unidadeId || !clienteNome || !defeitoRelatado}
                className="neon-button px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: tipoOS === 'LP' ? '#FFA50020' : '#00D4FF20',
                  borderColor: tipoOS === 'LP' ? '#FFA500' : '#00D4FF',
                  color: tipoOS === 'LP' ? '#FFA500' : '#00D4FF'
                }}
              >
                {loading ? 'CRIANDO...' : `SALVAR OS ${tipoOS}`}
              </button>
            </div>
            {(!unidadeId || !clienteNome || !defeitoRelatado) && (
              <div className="mt-3 flex items-center gap-2 text-xs text-yellow-400">
                <AlertCircle className="w-4 h-4" />
                <span>Preencha os campos obrigatórios: Unidade, Nome do Cliente e Defeito Relatado</span>
              </div>
            )}
          </div>
        )}
      </div>

      {mostrarModalConversao && os && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
          <div className="premium-card w-full max-w-2xl border-[#00D4FF]">
            <div className="p-6 border-b border-[#00D4FF]/20">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-[#00D4FF] flex items-center gap-2">
                  <RefreshCw className="w-6 h-6" />
                  CONVERTER OS LP → OW
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
              <div className="bg-[#00D4FF]/10 border border-[#00D4FF]/30 rounded-lg p-4">
                <h3 className="text-sm font-bold text-[#00D4FF] uppercase mb-3">Informações da OS</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <span className="text-gray-500">Número:</span>
                    <span className="text-gray-300 ml-2">#{os.numero_sequencial}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Tipo Atual:</span>
                    <span className="text-[#FFA500] ml-2 font-bold">LP</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Tipo Destino:</span>
                    <span className="text-[#00D4FF] ml-2 font-bold">OW</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Status:</span>
                    <span className="text-gray-300 ml-2">{os.coluna_kanban}</span>
                  </div>
                </div>
              </div>

              {requisicoes.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4">
                  <h3 className="text-sm font-bold text-yellow-400 uppercase mb-3 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Avisos Importantes
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-300">
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-400 mt-1">⚠</span>
                      <span>Esta OS possui {requisicoes.length} requisição(ões) de peças que serão mantidas</span>
                    </li>
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
                  id="confirmacao-lp"
                  checked={confirmaConversao}
                  onChange={(e) => setConfirmaConversao(e.target.checked)}
                  className="mt-1 w-4 h-4"
                />
                <label htmlFor="confirmacao-lp" className="text-sm text-gray-300 cursor-pointer">
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
                    backgroundColor: '#00D4FF20',
                    borderColor: '#00D4FF',
                    color: '#00D4FF'
                  }}
                >
                  {convertendo ? 'CONVERTENDO...' : 'CONFIRMAR CONVERSÃO'}
                </button>
              </div>
            </div>
          </div>
        </div>
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
          tipoOS={os?.tipo_os || 'LP'}
        />
      )}

      {mostrarModalServico && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setMostrarModalServico(false)}></div>
          <div className="relative bg-[#0A0F1E] border border-[#00D4FF]/30 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" style={{
            boxShadow: '0 0 40px rgba(0,212,255,0.2)'
          }}>
            <div className="p-6 border-b border-[#00D4FF]/20 bg-gradient-to-r from-[#00D4FF]/5 to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00D4FF]/20 to-[#39FF14]/20 flex items-center justify-center border-2 border-[#00D4FF]/30">
                    <Wrench className="w-6 h-6 text-[#00D4FF]" />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-[#00D4FF]">ADICIONAR SERVICO</h3>
                    <p className="text-xs text-gray-400">Selecione um servico da lista</p>
                  </div>
                </div>
                <button onClick={() => setMostrarModalServico(false)} className="text-gray-400 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-4 border-b border-[#00D4FF]/20">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="text"
                  placeholder="Buscar por codigo ou descricao..."
                  value={buscaServico}
                  onChange={(e) => setBuscaServico(e.target.value)}
                  className="neon-input w-full pl-12 pr-4 py-3"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto cyber-scrollbar p-4">
              {(() => {
                const servicosFiltrados = servicosCadastrados.filter(servico =>
                  servico.codigo?.toLowerCase().includes(buscaServico.toLowerCase()) ||
                  servico.descricao?.toLowerCase().includes(buscaServico.toLowerCase())
                );

                if (servicosFiltrados.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <Wrench className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">
                        {buscaServico ? 'Nenhum servico encontrado' : 'Nenhum servico cadastrado'}
                      </p>
                      <p className="text-gray-600 text-xs mt-2">
                        {buscaServico ? 'Tente outro termo de busca' : 'Cadastre servicos em Configuracoes'}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="grid gap-3">
                    {servicosFiltrados.map((servico) => {
                      const jaAdicionadoCreate = currentMode === 'create' && servicosAdicionados.some(s => s.codigo === servico.codigo);
                      const jaAdicionadoView = currentMode === 'view' && servicos.some(s => s.codigo_servico === servico.codigo);
                      const jaAdicionado = jaAdicionadoCreate || jaAdicionadoView;
                      return (
                        <div
                          key={servico.id}
                          onClick={async () => {
                            if (currentMode === 'create') {
                              if (jaAdicionadoCreate) {
                                setServicosAdicionados(servicosAdicionados.map(s =>
                                  s.codigo === servico.codigo
                                    ? { ...s, quantidade: s.quantidade + 1 }
                                    : s
                                ));
                              } else {
                                setServicosAdicionados([...servicosAdicionados, {
                                  codigo: servico.codigo,
                                  descricao: servico.descricao,
                                  valor_unitario: servico.valor || 0,
                                  quantidade: 1
                                }]);
                              }
                            } else if (currentMode === 'view' && currentOsId) {
                              const servicoExistente = servicos.find(s => s.codigo_servico === servico.codigo);
                              if (servicoExistente) {
                                await supabase
                                  .from('os_servicos')
                                  .update({ quantidade: servicoExistente.quantidade + 1, valor_total: servicoExistente.valor_unitario * (servicoExistente.quantidade + 1) })
                                  .eq('id', servicoExistente.id);
                              } else {
                                await supabase
                                  .from('os_servicos')
                                  .insert({
                                    os_id: currentOsId,
                                    codigo_servico: servico.codigo,
                                    descricao: servico.descricao,
                                    valor_unitario: servico.valor || 0,
                                    quantidade: 1,
                                    valor_total: servico.valor || 0
                                  });
                              }
                              loadServicos();
                            }
                            setBuscaServico('');
                            setMostrarModalServico(false);
                          }}
                          className="premium-card p-4 cursor-pointer transition-all hover:scale-[1.01] hover:border-[#00D4FF]"
                          style={{
                            borderColor: jaAdicionado ? '#39FF1460' : '#00D4FF40',
                            backgroundColor: jaAdicionado ? 'rgba(57,255,20,0.05)' : 'rgba(0,212,255,0.05)'
                          }}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-bold text-[#00D4FF]">{servico.codigo}</span>
                                {jaAdicionado && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/40">
                                    JA ADICIONADO
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-300 line-clamp-2">{servico.descricao}</p>
                            </div>
                            <div className="flex-shrink-0 text-right">
                              <p className="text-lg font-bold text-[#39FF14]">
                                R$ {(servico.valor || 0).toFixed(2)}
                              </p>
                              <p className="text-xs text-gray-500">por unidade</p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
            </div>

            <div className="p-4 border-t border-[#00D4FF]/20 bg-[#0A0F1E]/80">
              <div className="flex items-center justify-between">
                <p className="text-sm text-gray-400">
                  {servicosCadastrados.length} servico(s) disponiveis
                </p>
                <button
                  onClick={() => setMostrarModalServico(false)}
                  className="px-6 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  FECHAR
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal para adicionar pagamento */}
      {showAddPaymentModal && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="premium-card w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b border-[#39FF14]/20 bg-gradient-to-r from-[#39FF14]/5 to-transparent">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#39FF14]/20 to-[#00D4FF]/20 flex items-center justify-center border-2 border-[#39FF14]/30">
                    <DollarSign className="w-7 h-7 text-[#39FF14]" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-[#39FF14]">REGISTRAR PAGAMENTO</h2>
                    <p className="text-sm text-gray-400 mt-1">OS: {numeroOSSamsung || 'Nova OS'}</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowAddPaymentModal(false);
                    setNovoPagamentoForma('pix');
                    setNovoPagamentoValor('');
                    setNovoPagamentoNSU('');
                    setNovoPagamentoPixId('');
                    setNovoPagamentoParcelamento('1');
                    setNovoPagamentoTaxa('0');
                    setNovoPagamentoComprovante(null);
                    setNovoPagamentoObservacoes('');
                  }}
                  className="p-2 hover:bg-white/10 rounded-lg transition-all"
                >
                  <X className="w-6 h-6 text-gray-400 hover:text-white" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Resumo */}
              <div className="premium-card p-5 bg-gradient-to-br from-[#00D4FF]/10 to-transparent border-2 border-[#00D4FF]/30">
                <div className="grid grid-cols-3 gap-6">
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Cliente</p>
                    <p className="text-white font-bold text-lg">{clienteNome || '-'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Valor Total</p>
                    <p className="text-[#00D4FF] font-bold text-2xl">
                      R$ {(pecasAdicionadas.reduce((sum, p) => sum + p.valor, 0) + servicosAdicionados.reduce((sum, s) => sum + (s.valor_unitario * s.quantidade), 0)).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Saldo Restante</p>
                    <p className="text-[#FFBF00] font-bold text-2xl">
                      R$ {(pecasAdicionadas.reduce((sum, p) => sum + p.valor, 0) + servicosAdicionados.reduce((sum, s) => sum + (s.valor_unitario * s.quantidade), 0) - pagamentosTemporarios.reduce((sum, p) => sum + p.valor, 0)).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Forma de Pagamento */}
              <div>
                <label className="block text-sm font-bold text-[#00D4FF] uppercase mb-3 tracking-wider">
                  Forma de Pagamento *
                </label>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { value: 'pix', label: 'PIX', icon: '💳', color: '#00D4FF' },
                    { value: 'cartao_credito', label: 'Cartão de Crédito', icon: '💳', color: '#9D4EDD' },
                    { value: 'cartao_debito', label: 'Cartão de Débito', icon: '💳', color: '#3b82f6' },
                    { value: 'dinheiro', label: 'Dinheiro', icon: '💵', color: '#39FF14' },
                    { value: 'transferencia', label: 'Transferência', icon: '🏦', color: '#10b981' },
                    { value: 'boleto', label: 'Boleto', icon: '📄', color: '#FFBF00' },
                    { value: 'outro', label: 'Outro', icon: '📋', color: '#6B7280' }
                  ].map(forma => (
                    <button
                      key={forma.value}
                      type="button"
                      onClick={() => setNovoPagamentoForma(forma.value as any)}
                      className={`p-4 rounded-xl border-2 transition-all ${
                        novoPagamentoForma === forma.value
                          ? 'border-[#00D4FF] bg-[#00D4FF]/20 scale-105'
                          : 'border-gray-700 bg-black/30 hover:border-gray-500'
                      }`}
                    >
                      <div className="text-3xl mb-2">{forma.icon}</div>
                      <p className={`text-xs font-bold uppercase ${
                        novoPagamentoForma === forma.value ? 'text-[#00D4FF]' : 'text-gray-400'
                      }`}>
                        {forma.label}
                      </p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Valor */}
              <div>
                <label className="block text-sm font-bold text-[#39FF14] uppercase mb-3 tracking-wider">
                  Valor do Pagamento *
                </label>
                <div className="relative">
                  <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2 w-6 h-6 text-[#39FF14]" />
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={novoPagamentoValor}
                    onChange={(e) => setNovoPagamentoValor(e.target.value)}
                    placeholder="0,00"
                    className="neon-input pl-14 text-2xl font-bold"
                    style={{ height: '60px' }}
                  />
                </div>
              </div>

              {/* Parcelamento - Só para Crédito */}
              {novoPagamentoForma === 'cartao_credito' && (
                <div>
                  <label className="block text-sm font-bold text-[#9D4EDD] uppercase mb-3 tracking-wider">
                    <CreditCard className="w-4 h-4 inline mr-2" />
                    Parcelamento
                  </label>
                  <select
                    value={novoPagamentoParcelamento}
                    onChange={(e) => setNovoPagamentoParcelamento(e.target.value)}
                    className="neon-input"
                  >
                    <option value="1">À vista (1x)</option>
                    {[...Array(12)].map((_, i) => (
                      <option key={i + 2} value={i + 2}>{i + 2}x</option>
                    ))}
                  </select>
                </div>
              )}

              {/* Campos específicos para Cartão */}
              {(novoPagamentoForma === 'cartao_credito' || novoPagamentoForma === 'cartao_debito') && (
                <div className="premium-card p-6 bg-gradient-to-br from-[#FFBF00]/10 to-transparent border-2 border-[#FFBF00]/30 space-y-5">
                  <h3 className="text-sm font-bold text-[#FFBF00] uppercase tracking-wider flex items-center gap-2">
                    <CreditCard className="w-5 h-5" />
                    Informações do Cartão
                  </h3>

                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-2 tracking-wider">
                      NSU da Transação *
                    </label>
                    <input
                      type="text"
                      value={novoPagamentoNSU}
                      onChange={(e) => setNovoPagamentoNSU(e.target.value)}
                      placeholder="Ex: 123456789"
                      className="neon-input font-mono"
                    />
                    <p className="text-xs text-gray-500 mt-2">
                      Número sequencial único da transação do cartão
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-400 uppercase mb-2 tracking-wider">
                        Taxa de Cartão (%)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={novoPagamentoTaxa}
                        onChange={(e) => setNovoPagamentoTaxa(e.target.value)}
                        className="neon-input"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-400 uppercase mb-2 tracking-wider">
                        Quem Paga a Taxa?
                      </label>
                      <select
                        value={novoPagamentoTaxaPagaPor}
                        onChange={(e) => setNovoPagamentoTaxaPagaPor(e.target.value as 'cliente' | 'empresa')}
                        className="neon-input"
                      >
                        <option value="empresa">Empresa (absorve)</option>
                        <option value="cliente">Cliente (repassa)</option>
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Campos específicos para PIX */}
              {novoPagamentoForma === 'pix' && (
                <div className="premium-card p-6 bg-gradient-to-br from-[#00D4FF]/10 to-transparent border-2 border-[#00D4FF]/30 space-y-5">
                  <h3 className="text-sm font-bold text-[#00D4FF] uppercase tracking-wider">
                    Informações do PIX
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-400 uppercase mb-2 tracking-wider">
                        ID da Transação PIX
                      </label>
                      <input
                        type="text"
                        value={novoPagamentoPixId}
                        onChange={(e) => setNovoPagamentoPixId(e.target.value)}
                        placeholder="Ex: E123456789..."
                        className="neon-input font-mono"
                      />
                    </div>

                    <div>
                      <label className="block text-xs text-gray-400 uppercase mb-2 tracking-wider">
                        NSU (Opcional)
                      </label>
                      <input
                        type="text"
                        value={novoPagamentoNSU}
                        onChange={(e) => setNovoPagamentoNSU(e.target.value)}
                        placeholder="Ex: 123456789"
                        className="neon-input font-mono"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Comprovante */}
              <div>
                <label className="block text-sm font-bold text-gray-300 uppercase mb-3 tracking-wider">
                  Comprovante
                </label>
                <div className="premium-card p-4 border-2 border-dashed border-gray-700 hover:border-[#39FF14]/50 transition-all">
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => {
                      if (e.target.files && e.target.files[0]) {
                        setNovoPagamentoComprovante(e.target.files[0]);
                      }
                    }}
                    className="hidden"
                    id="comprovante-upload"
                  />
                  <label htmlFor="comprovante-upload" className="cursor-pointer flex items-center gap-3">
                    <Upload className="w-6 h-6 text-[#39FF14]" />
                    <div>
                      <p className="text-sm text-white font-bold">
                        {novoPagamentoComprovante ? novoPagamentoComprovante.name : 'Clique para fazer upload'}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">PNG, JPG ou PDF (máx. 10MB)</p>
                    </div>
                  </label>
                  {novoPagamentoComprovante && (
                    <button
                      onClick={() => setNovoPagamentoComprovante(null)}
                      className="mt-3 text-xs text-red-400 hover:text-red-300 flex items-center gap-2"
                    >
                      <Trash2 className="w-3 h-3" />
                      Remover arquivo
                    </button>
                  )}
                </div>
              </div>

              {/* Observações */}
              <div>
                <label className="block text-sm font-bold text-gray-300 uppercase mb-3 tracking-wider">
                  Observações
                </label>
                <textarea
                  value={novoPagamentoObservacoes}
                  onChange={(e) => setNovoPagamentoObservacoes(e.target.value)}
                  placeholder="Informações adicionais sobre o pagamento..."
                  className="neon-input w-full resize-none"
                  rows={3}
                />
              </div>
            </div>

            <div className="p-6 border-t border-gray-700 flex gap-3">
              <button
                onClick={() => {
                  setShowAddPaymentModal(false);
                  setNovoPagamentoForma('pix');
                  setNovoPagamentoValor('');
                  setNovoPagamentoNSU('');
                  setNovoPagamentoPixId('');
                  setNovoPagamentoParcelamento('1');
                  setNovoPagamentoTaxa('0');
                  setNovoPagamentoComprovante(null);
                  setNovoPagamentoObservacoes('');
                }}
                className="flex-1 px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all border border-gray-700 text-gray-400 hover:bg-gray-800/60"
              >
                CANCELAR
              </button>
              <button
                onClick={() => {
                  const valorNum = parseFloat(novoPagamentoValor);
                  if (!novoPagamentoValor || isNaN(valorNum) || valorNum <= 0) {
                    alert('Digite um valor válido maior que zero');
                    return;
                  }

                  const isCartao = novoPagamentoForma === 'cartao_credito' || novoPagamentoForma === 'cartao_debito';
                  const isPix = novoPagamentoForma === 'pix';

                  if (isCartao && !novoPagamentoNSU.trim()) {
                    alert('NSU é obrigatório para pagamentos com cartão');
                    return;
                  }

                  if (isPix && !novoPagamentoPixId.trim() && !novoPagamentoNSU.trim()) {
                    alert('Informe o ID da transação ou NSU para pagamentos PIX');
                    return;
                  }

                  setPagamentosTemporarios([...pagamentosTemporarios, {
                    forma_pagamento: novoPagamentoForma,
                    valor: valorNum,
                    data_pagamento: new Date().toISOString().split('T')[0],
                    observacoes: novoPagamentoObservacoes || undefined,
                    nsu: novoPagamentoNSU || undefined,
                    pix_id_transacao: novoPagamentoPixId || undefined,
                    parcelamento: novoPagamentoForma === 'cartao_credito' ? parseInt(novoPagamentoParcelamento) : undefined,
                    taxa_percentual: isCartao && parseFloat(novoPagamentoTaxa) > 0 ? parseFloat(novoPagamentoTaxa) : undefined,
                    taxa_paga_por: isCartao && parseFloat(novoPagamentoTaxa) > 0 ? novoPagamentoTaxaPagaPor : undefined,
                    comprovante: novoPagamentoComprovante || undefined
                  }]);

                  setShowAddPaymentModal(false);
                  setNovoPagamentoForma('pix');
                  setNovoPagamentoValor('');
                  setNovoPagamentoNSU('');
                  setNovoPagamentoPixId('');
                  setNovoPagamentoParcelamento('1');
                  setNovoPagamentoTaxa('0');
                  setNovoPagamentoComprovante(null);
                  setNovoPagamentoObservacoes('');
                }}
                className="flex-1 neon-button flex items-center justify-center gap-2"
                style={{
                  backgroundColor: '#39FF1420',
                  color: '#39FF14',
                  border: '1px solid #39FF1460'
                }}
              >
                <Save className="w-5 h-5" />
                REGISTRAR PAGAMENTO
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
