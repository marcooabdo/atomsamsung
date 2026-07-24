import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Package, FileText, MessageSquare, Paperclip, Send, Trash2, CheckSquare, AlertCircle, AlertTriangle, Clock, QrCode, RefreshCw, Loader2, MoveHorizontal, ChevronDown, Calendar, CheckCircle, XCircle, DollarSign, Wrench, Save, Upload, CreditCard, Search, Plus, Percent, Tag, Receipt, FileDown, Eye, EyeOff, Phone, Layers, Link2, ChevronRight, Pencil } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { normalizarCidade } from '../lib/cidadeNormalize';
import { VincularOSModal } from './VincularOSModal';

function sanitizeGSPNValue(raw: string): string {
  let cleaned = raw.replace(/[^\d.,]/g, '');
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  const lastSep = Math.max(lastComma, lastDot);
  if (lastSep === -1) return cleaned;
  const intPart = cleaned.substring(0, lastSep).replace(/[.,]/g, '');
  const decPart = cleaned.substring(lastSep + 1);
  return intPart + '.' + decPart;
}
import { useAuth } from '../contexts/AuthContext';
import { useModal } from '../contexts/ModalContext';
import { buscarCEP, formatarCEP } from '../lib/cep';
import { OSAgendamentoTab } from './OSAgendamentoTab';
import { OSNotaFiscalTab } from './OSNotaFiscalTab';
import { OSPagamentoTab } from './OSPagamentoTab';
import { DevolucaoModal } from './DevolucaoModal';
import { CancelarGIModal } from './CancelarGIModal';
import { OSChecklistTab } from './OSChecklistTab';
import { AtomConnectChat } from './atomconnect/AtomConnectChat';
import { SuccessModal } from './SuccessModal';
import { RouteSelectionModal } from './kanban/RouteSelectionModal';
import type { Database } from '../lib/database.types';

interface WhatsAppConversa {
  id: string;
  unidade_id: string;
  cliente_telefone: string;
  cliente_nome: string | null;
  cliente_foto_url: string | null;
  os_id: string | null;
  coluna_pipeline: string;
  atendente_id: string | null;
  ultima_mensagem: string | null;
  ultima_mensagem_at: string;
  ultima_resposta_cliente_at: string | null;
  mensagens_nao_lidas: number;
  is_bot_ativo: boolean;
  tipo_atendimento: string;
  prioridade: string;
  tags: string[];
  created_at: string;
}

const COLUNAS_KANBAN = [
  { id: 'os_nova', label: 'OS Nova' },
  { id: 'diagnostico', label: 'Diagnóstico/Triagem' },
  { id: 'negociacao_em_andamento', label: 'Enviar Orçamento' },
  { id: 'aguardando_aprovacao', label: 'Aguardando Aprovação' },
  { id: 'orcamento_aprovado', label: 'Orçamento Aprovado' },
  { id: 'aguardando_peca', label: 'Aguardando Peça' },
  { id: 'peca_em_transito', label: 'Peça em Trânsito' },
  { id: 'em_reparo_ci', label: 'Em Reparo CI' },
  { id: 'rota_preta', label: 'Rota Preta' },
  { id: 'rota_vermelha', label: 'Rota Vermelha' },
  { id: 'rota_azul', label: 'Rota Azul' },
  { id: 'rota_verde', label: 'Rota Verde' },
  { id: 'rota_rosa', label: 'Rota Rosa' },
  { id: 'rota_amarela', label: 'Rota Amarela' },
  { id: 'rota_laranja', label: 'Rota Laranja' },
  { id: 'em_rota_ih', label: 'Agendados (FTF)' },
  { id: 'em_reparo_ih', label: 'Reparo em Progresso IH' },
  { id: 'reparo_concluido', label: 'Reparo Concluído' },
  { id: 'aguardando_fechamento', label: 'Aguardando Fechamento' },
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
  onMoveOS?: (osId: string, fromColumn: string, toColumn: string) => void;
  mode?: 'create' | 'view';
  tipoOS?: 'LP' | 'OW';
  modoSCACC?: boolean;
  initialTab?: string;
}

type AbaAtiva = 'dados' | 'estoque' | 'checklist' | 'servicos' | 'pagamento' | 'nf' | 'anexos' | 'comentarios' | 'agendamento';

export function OSLPModal({ osId, onClose, onReload, onMoveOS, mode = 'view', tipoOS = 'LP', modoSCACC = false, initialTab }: OSLPModalProps) {
  const { usuario } = useAuth();
  const { showAlert, showInfo, showSuccess, showError, showConfirm } = useModal();
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
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>((initialTab as AbaAtiva) || 'dados');
  const [loading, setLoading] = useState(currentMode === 'view');
  const [mostrarComentariosSistema, setMostrarComentariosSistema] = useState(true);
  const [mostrarModalConversao, setMostrarModalConversao] = useState(false);
  const [motivoConversao, setMotivoConversao] = useState('');
  const [showVincularModalLP, setShowVincularModalLP] = useState(false);
  const [osVinculadasLP, setOsVinculadasLP] = useState<any[]>([]);
  const [confirmaConversao, setConfirmaConversao] = useState(false);
  const [convertendo, setConvertendo] = useState(false);
  const [mostrarMoverPara, setMostrarMoverPara] = useState(false);
  const [movendoOS, setMovendoOS] = useState(false);
  const [mostrarConfirmacaoMover, setMostrarConfirmacaoMover] = useState(false);
  const [colunaDestino, setColunaDestino] = useState<{ id: string; label: string } | null>(null);
  const [mostrarModalDevolucao, setMostrarModalDevolucao] = useState(false);
  const [requisicaoSelecionada, setRequisicaoSelecionada] = useState<RequisicaoPeca | null>(null);
  const [mostrarSucessoMover, setMostrarSucessoMover] = useState(false);
  const [mostrarModalCancelarGI, setMostrarModalCancelarGI] = useState(false);
  const [requisicaoCancelarGI, setRequisicaoCancelarGI] = useState<RequisicaoPeca | null>(null);
  const [mostrarModalSucesso, setMostrarModalSucesso] = useState(false);
  const [dadosOSCriada, setDadosOSCriada] = useState<{ numeroInterna?: string; numeroSamsung?: string } | null>(null);
  const [mostrarConfirmacaoRequisicao, setMostrarConfirmacaoRequisicao] = useState(false);
  const [pecaParaRequisitar, setPecaParaRequisitar] = useState<any>(null);
  const [requisitando, setRequisitando] = useState(false);
  const [mostrarConfirmacaoRequisicaoManual, setMostrarConfirmacaoRequisicaoManual] = useState(false);
  const [dadosRequisicaoManual, setDadosRequisicaoManual] = useState<{
    codigo: string;
    descricao: string;
    quantidade: number;
    valor: string;
  } | null>(null);
  const [requisitandoManual, setRequisitandoManual] = useState(false);
  const [mostrarModalCancelarRequisicao, setMostrarModalCancelarRequisicao] = useState(false);
  const [requisicaoParaCancelar, setRequisicaoParaCancelar] = useState<RequisicaoPeca | null>(null);
  const [motivoCancelamento, setMotivoCancelamento] = useState('');
  const [cancelando, setCancelando] = useState(false);
  const [mostrarSucessoRequisicao, setMostrarSucessoRequisicao] = useState(false);

  // Estados para validação de rota IH
  const [rotasUnidade, setRotasUnidade] = useState<Array<{ id: string; nome: string; cidades: string[]; coluna_kanban: string }>>([]);
  const [mostrarSelecionarRotaObrigatoria, setMostrarSelecionarRotaObrigatoria] = useState(false);
  const [mostrarEditarRotaCidade, setMostrarEditarRotaCidade] = useState(false);
  const [colunaDestinoAposSelecionarRota, setColunaDestinoAposSelecionarRota] = useState<{ id: string; label: string } | null>(null);

  // Estados para criação de nova OS
  const [unidades, setUnidades] = useState<Array<{ id: string; nome: string }>>([]);
  const [unidadeId, setUnidadeId] = useState('');
  const [tipoAtendimento, setTipoAtendimento] = useState<'IH' | 'CI'>('CI');
  const [tipoOrcamento, setTipoOrcamento] = useState<'normal' | 'garantia' | 'cortesia' | 'samsung_contigo' | 'acessorios'>(modoSCACC ? 'samsung_contigo' : 'normal');
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
    quantidade: number;
    valor_gspn?: number;
    requisitada: boolean;
  }>>([]);
  const [servicosAdicionados, setServicosAdicionados] = useState<Array<{
    id?: string;
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
  const [mostrarModalChecklist, setMostrarModalChecklist] = useState(false);
  const [servicosCadastrados, setServicosCadastrados] = useState<any[]>([]);
  const [servicoSelecionado, setServicoSelecionado] = useState<any>(null);
  const [quantidadeServico, setQuantidadeServico] = useState(1);
  const [buscaServico, setBuscaServico] = useState('');
  const [syncingGSPN, setSyncingGSPN] = useState(false);
  const [gerandoPDF, setGerandoPDF] = useState(false);
  const [currentJob, setCurrentJob] = useState<any>(null);

  // Estados para WhatsApp Chat
  const [showWhatsAppChat, setShowWhatsAppChat] = useState(false);
  const [whatsAppConversa, setWhatsAppConversa] = useState<WhatsAppConversa | null>(null);
  const [loadingWhatsApp, setLoadingWhatsApp] = useState(false);
  const [whatsAppError, setWhatsAppError] = useState<string | null>(null);
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
  const [taxasMaquina, setTaxasMaquina] = useState<Array<{
    id: string;
    parcelamento: number;
    taxa: string;
    debito: string | null;
  }>>([]);

  // Estados para desconto no modo create
  const [descontoTipoCreate, setDescontoTipoCreate] = useState<'valor' | 'percentual'>('valor');
  const [descontoValorCreate, setDescontoValorCreate] = useState('');

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Load user preference for system comments visibility
  const prefLoaded = useRef(false);
  useEffect(() => {
    if (!usuario?.id || prefLoaded.current) return;
    prefLoaded.current = true;
    (async () => {
      const { data } = await supabase
        .from('usuarios')
        .select('mostrar_comentarios_sistema')
        .eq('id', usuario.id)
        .maybeSingle();
      if (data && typeof data.mostrar_comentarios_sistema === 'boolean') {
        setMostrarComentariosSistema(data.mostrar_comentarios_sistema);
      }
    })();
  }, [usuario?.id]);

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
  }, [currentMode, abaAtiva, tipoOS, unidadeId, aparelhoLinha]);

  // Carregar taxas de máquina quando a unidade for definida
  useEffect(() => {
    const loadTaxasMaquina = async () => {
      if (!unidadeId) {
        return;
      }


      const { data: taxasUnidade } = await supabase
        .from('taxas_maquina')
        .select('*')
        .eq('unidade_id', unidadeId)
        .eq('ativo', true)
        .order('parcelamento');


      if (taxasUnidade && taxasUnidade.length > 0) {
        setTaxasMaquina(taxasUnidade);
        return;
      }


      const { data: taxasGlobais, error: errorGlobais } = await supabase
        .from('taxas_maquina')
        .select('*')
        .is('unidade_id', null)
        .eq('ativo', true)
        .order('parcelamento');

      if (errorGlobais) {
        return;
      }

      if (taxasGlobais) {
        setTaxasMaquina(taxasGlobais);
      }
    };

    if (currentMode === 'create') {
      loadTaxasMaquina();
    }
  }, [unidadeId, currentMode]);

  // Aplicar taxa automaticamente quando mudar parcelamento ou forma de pagamento
  useEffect(() => {
    const isCartao = novoPagamentoForma === 'cartao_credito' || novoPagamentoForma === 'cartao_debito';


    if (!isCartao) {
      setNovoPagamentoTaxa('0');
      return;
    }

    if (taxasMaquina.length === 0) {
      return;
    }

    const parcelaNum = parseInt(novoPagamentoParcelamento);

    const taxa = taxasMaquina.find(t => t.parcelamento === parcelaNum);

    if (!taxa) {
      setNovoPagamentoTaxa('0');
      return;
    }

    if (novoPagamentoForma === 'cartao_credito') {
      const taxaValor = Number(taxa.taxa || 0);
      setNovoPagamentoTaxa(taxaValor.toString());
    } else if (novoPagamentoForma === 'cartao_debito') {
      const taxaValor = Number(taxa.debito || 0);
      setNovoPagamentoTaxa(taxaValor.toString());
    }
  }, [taxasMaquina, novoPagamentoParcelamento, novoPagamentoForma]);

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

  const handleGerarPDF = () => {
    if (!os) return;
    window.open(`/os/print?osId=${os.id}`, '_blank');
  };

  const syncGSPN = async () => {
    if (!os?.numero_os_samsung) {
      showAlert({ message: 'Esta OS não possui número Samsung para sincronizar', type: 'warning' });
      return;
    }

    if (currentJob?.is_running) {
      showAlert({ message: 'Já existe uma sincronização em andamento para esta OS', type: 'info' });
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
        showAlert({ message: 'Unidade não encontrada', type: 'error' });
        setSyncingGSPN(false);
        return;
      }

      if (!unidadeData.samsung_asccode || !unidadeData.samsung_token) {
        showAlert({ message: 'Unidade sem configuração Samsung (ASC Code ou Token não configurados)', type: 'warning' });
        setSyncingGSPN(false);
        return;
      }

      const response = await fetch('https://atom-n8n.2vhnbz.easypanel.host/webhook/atualizar-os/one', {
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
        showAlert({ message: `Erro ao iniciar sincronização: ${result.message || 'Erro desconhecido'}`, type: 'error' });
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
      showAlert({ message: `Erro ao sincronizar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, type: 'error' });
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
      showAlert({ message: 'Erro ao buscar CEP. Verifique o CEP digitado ou preencha manualmente.', type: 'warning' });
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

  const normalizeCidade = (cidade: string | null | undefined): string => {
    if (!cidade) return '';
    return cidade
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim();
  };

  const findRotaByCidade = (cidade: string | null | undefined): { coluna: string; nome: string } | null => {
    if (!cidade) return null;
    const cidadeNormalizada = normalizeCidade(cidade);

    for (const rota of rotasUnidade) {
      const cidadesNormalizadas = rota.cidades.map(c => normalizeCidade(c));
      if (cidadesNormalizadas.includes(cidadeNormalizada)) {
        return {
          coluna: rota.coluna_kanban,
          nome: rota.nome
        };
      }
    }
    return null;
  };

  const loadRotasUnidade = async (unidadeIdParam: string) => {
    try {
      const { data } = await supabase
        .from('rotas')
        .select('id, nome, cidades, coluna_kanban, cor')
        .eq('unidade_id', unidadeIdParam)
        .eq('ativa', true);

      if (data) {
        setRotasUnidade(data);
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

      // Carregar rotas da unidade para validação IH
      if (data?.unidade_id) {
        await loadRotasUnidade(data.unidade_id);
      }

      // Carregar OS vinculadas do grupo
      if (data?.grupo_os_id) {
        const { data: vinculadas } = await supabase
          .from('os')
          .select('id, numero_os_samsung, numero_os_interna, cliente_nome, coluna_kanban, created_at, aparelho_modelo')
          .eq('grupo_os_id', data.grupo_os_id)
          .neq('id', currentOsId!)
          .order('created_at', { ascending: false });
        setOsVinculadasLP(vinculadas || []);
      } else {
        setOsVinculadasLP([]);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const formatPhoneNumber = (phone: string): string => {
    let cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('55') && cleanPhone.length >= 12) {
      return cleanPhone;
    }
    if (cleanPhone.length === 11 || cleanPhone.length === 10) {
      return '55' + cleanPhone;
    }
    return cleanPhone;
  };

  const checkWhatsAppNumber = async (phone: string, apiUrl: string, apiKey: string, instanceName: string): Promise<boolean> => {
    try {
      const response = await fetch(`${apiUrl}/chat/whatsappNumbers/${instanceName}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': apiKey
        },
        body: JSON.stringify({ numbers: [phone] })
      });

      if (!response.ok) return false;
      const data = await response.json();
      return data?.[0]?.exists === true;
    } catch (error) {
      return false;
    }
  };

  const handlePhoneClick = async (phone: string | null) => {
    if (!phone || !os) return;

    const formattedPhone = formatPhoneNumber(phone);
    if (formattedPhone.length < 10) {
      setWhatsAppError('Número de telefone inválido');
      return;
    }

    setLoadingWhatsApp(true);
    setWhatsAppError(null);

    try {
      const phoneDigits = formattedPhone.replace(/\D/g, '');
      const phoneWithout55 = phoneDigits.startsWith('55') ? phoneDigits.slice(2) : phoneDigits;
      const last8 = phoneDigits.slice(-8);

      const { data: matchingConversas } = await supabase
        .from('atom_connect_conversas')
        .select('*')
        .eq('unidade_id', os.unidade_id)
        .or(`cliente_telefone.like.%${last8},cliente_telefone.like.%${phoneWithout55}%,cliente_telefone.eq.${formattedPhone}`)
        .order('ultima_mensagem_at', { ascending: false });

      const existingConversa = matchingConversas?.[0] || null;

      if (existingConversa) {
        if (!existingConversa.os_id && os.id) {
          await supabase
            .from('atom_connect_conversas')
            .update({ os_id: os.id })
            .eq('id', existingConversa.id);
          existingConversa.os_id = os.id;
        }
        setWhatsAppConversa(existingConversa as WhatsAppConversa);
        setShowWhatsAppChat(true);
        setLoadingWhatsApp(false);
        return;
      }

      const { data: instancia } = await supabase
        .from('atom_connect_instancias')
        .select('api_url, api_key, instance_name')
        .eq('unidade_id', os.unidade_id)
        .eq('status', 'connected')
        .maybeSingle();

      if (!instancia) {
        setWhatsAppError('WhatsApp nao configurado para esta unidade');
        setLoadingWhatsApp(false);
        return;
      }

      const hasWhatsApp = await checkWhatsAppNumber(
        formattedPhone,
        instancia.api_url,
        instancia.api_key,
        instancia.instance_name
      );

      if (!hasWhatsApp) {
        setWhatsAppError('Este numero nao possui WhatsApp');
        setLoadingWhatsApp(false);
        return;
      }

      let colQuery = supabase
        .from('atom_connect_pipeline_colunas')
        .select('id')
        .order('ordem', { ascending: true })
        .limit(1);

      if (os.unidade_id) {
        colQuery = colQuery.or(`unidade_id.is.null,unidade_id.eq.${os.unidade_id}`);
      }

      const { data: firstColumn } = await colQuery.maybeSingle();

      const { data: newConversa, error: createError } = await supabase
        .from('atom_connect_conversas')
        .insert({
          unidade_id: os.unidade_id,
          cliente_telefone: formattedPhone,
          cliente_nome: os.cliente_nome || null,
          os_id: os.id,
          coluna_pipeline: firstColumn?.id || 'bot_triagem',
          atendente_id: usuario?.id || null,
          is_bot_ativo: false,
          tipo_atendimento: 'balcao',
          prioridade: 'normal',
          ultima_mensagem_at: new Date().toISOString(),
          tags: []
        })
        .select()
        .single();

      if (createError) {
        setWhatsAppError('Erro ao criar conversa');
        setLoadingWhatsApp(false);
        return;
      }

      setWhatsAppConversa(newConversa as WhatsAppConversa);
      setShowWhatsAppChat(true);
    } catch (error) {
      setWhatsAppError('Erro ao processar solicitacao');
    } finally {
      setLoadingWhatsApp(false);
    }
  };

  const loadPecas = async () => {
    if (!currentOsId) {
      return;
    }

    const [osPecasResult, cotacaoPecasResult, reqReprovadasResult] = await Promise.all([
      supabase
        .from('os_pecas')
        .select('*')
        .eq('os_id', currentOsId)
        .order('created_at', { ascending: true }),
      supabase
        .from('cotacoes_pecas')
        .select('*')
        .eq('os_id', currentOsId)
        .order('created_at', { ascending: true }),
      supabase
        .from('requisicoes_pecas')
        .select('codigo_peca, os_peca_id, cotacao_peca_id')
        .eq('os_id', currentOsId)
        .eq('status', 'reprovada')
    ]);

    const reqReprovadas = reqReprovadasResult.data || [];
    const osPecaIdsReprovados = new Set(reqReprovadas.filter((r: any) => r.os_peca_id).map((r: any) => r.os_peca_id));
    const pnsReprovadosSemVinculo = new Set(
      reqReprovadas.filter((r: any) => !r.os_peca_id && !r.cotacao_peca_id).map((r: any) => r.codigo_peca)
    );

    const osPecasFormatadas = (osPecasResult.data || []).filter((p: any) => {
      if (osPecaIdsReprovados.has(p.id)) return false;
      if (pnsReprovadosSemVinculo.has(p.pn)) return false;
      return true;
    }).map(p => ({
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
      valor_gspn: p.valor_gspn,
      created_at: p.created_at,
      updated_at: p.updated_at,
      tipo: 'os_peca',
      estoque_peca_id: p.estoque_peca_id,
      exibir_no_pdf: p.exibir_no_pdf
    }));

    const cotacaoPecas = (cotacaoPecasResult.data || []).filter(p => !pnsReprovadosSemVinculo.has(p.pn)).map(p => ({
      id: p.id,
      os_id: p.os_id,
      os_peca_id: null,
      cotacao_peca_id: p.id,
      codigo: p.pn,
      pn: p.pn,
      descricao: p.descricao,
      quantidade: p.quantidade,
      valor_unitario: p.valor_final_unitario || p.valor_base_gspn,
      valor_total: (p.valor_final_unitario || p.valor_base_gspn) * p.quantidade,
      valor_gspn: p.valor_base_gspn,
      valor_com_markup: p.valor_final_unitario,
      created_at: p.created_at,
      updated_at: p.updated_at,
      tipo: 'cotacao',
      exibir_no_pdf: p.exibir_no_pdf
    }));

    const todasPecas = [...osPecasFormatadas, ...cotacaoPecas];
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


    // Para cada requisição, buscar detalhes de todas as peças do lote
    const requisicoesComLote = await Promise.all(
      (data || []).map(async (req: any) => {
        let pecasDoLote = null;
        if (req.is_lote && req.pecas_estoque_ids && req.pecas_estoque_ids.length > 0) {
          const { data: pecasData } = await supabase
            .from('estoque_pecas')
            .select(`
              id,
              id_numerico,
              valor_com_impostos,
              gi_postada_em,
              gi_postada_por,
              usuario_gi_postado:usuarios!estoque_pecas_gi_postada_por_fkey(nome),
              estoque_etiquetas(delivery)
            `)
            .in('id', req.pecas_estoque_ids)
            .order('id_numerico');
          pecasDoLote = pecasData;
        }
        return {
          ...req,
          pecas_lote: pecasDoLote
        };
      })
    );

    setRequisicoes(requisicoesComLote || []);
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
    const linhaParaBusca = currentMode === 'create' ? aparelhoLinha : os?.aparelho_linha;

    if (!unidadeParaBusca || !linhaParaBusca) {
      setServicosCadastrados([]);
      return;
    }

    const { data } = await supabase
      .from('servicos')
      .select('*')
      .or(`unidade_id.eq.${unidadeParaBusca},unidade_id.is.null`)
      .eq('ativo', true)
      .eq('linha', linhaParaBusca)
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
      showAlert({ message: 'Selecione um serviço', type: 'warning' });
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
        showAlert({ message: 'Serviço adicionado com sucesso!', type: 'success' });
      }

      setMostrarModalServico(false);
      setServicoSelecionado(null);
      setQuantidadeServico(1);
    } catch (error) {
      showAlert({ message: 'Erro ao adicionar serviço', type: 'error' });
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
        .order('data_entrada', { ascending: false })
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
          const isSCACCAtual = tipoOrcamentoAtual === 'samsung_contigo' || tipoOrcamentoAtual === 'acessorios' || modoSCACC;
          let valorComMarkup = pedido?.valor_estimado || null;
          if (valorComMarkup && (tipoOSAtual === 'OW' || isSCACCAtual)) {
            const { data: markupData } = await supabase.rpc('get_markup_for_unidade_and_tipo', {
              p_unidade_id: unidadeParaBusca,
              p_tipo_orcamento: tipoOrcamentoAtual,
              p_valor: valorComMarkup
            });

            if (markupData && markupData.length > 0 && markupData[0].valor) {
              const markup = markupData[0];
              switch (markup.tipo) {
                case 'percentual':
                  valorComMarkup = valorComMarkup * (1 + markup.valor / 100);
                  break;
                case 'multiplicador':
                  valorComMarkup = valorComMarkup * markup.valor;
                  break;
                case 'valor_fixo':
                  valorComMarkup = valorComMarkup + markup.valor;
                  break;
              }
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

  // Funções auxiliares para cálculos de pagamento
  const calcularTaxaValor = () => {
    const valor = parseFloat(sanitizeGSPNValue(novoPagamentoValor)) || 0;
    const taxa = parseFloat(novoPagamentoTaxa) || 0;
    return (valor * taxa) / 100;
  };

  const calcularValorLiquido = () => {
    const valor = parseFloat(sanitizeGSPNValue(novoPagamentoValor)) || 0;
    return valor - calcularTaxaValor();
  };

  useEffect(() => {
    const calcularMarkup = async () => {
      const valorGSPN = parseFloat(sanitizeGSPNValue(novaPecaValor));

      const tipoOrcamentoEfetivo = currentMode === 'view' ? (os?.tipo_orcamento || tipoOrcamento || 'normal') : (tipoOrcamento || 'normal');
      const isSCACCEfetivo = modoSCACC || tipoOrcamentoEfetivo === 'samsung_contigo' || tipoOrcamentoEfetivo === 'acessorios';
      const tipoOSEfetivo = currentMode === 'view' ? os?.tipo_os : tipoOS;

      if (!valorGSPN || valorGSPN <= 0 || (!isSCACCEfetivo && tipoOSEfetivo !== 'OW') || !unidadeId) {
        setNovaPecaValorComMarkup(null);
        return;
      }

      try {
        const { data: markupData } = await supabase.rpc('get_markup_for_unidade_and_tipo', {
          p_unidade_id: unidadeId,
          p_tipo_orcamento: tipoOrcamentoEfetivo,
          p_valor: valorGSPN
        });

        if (markupData && markupData.length > 0 && markupData[0].valor) {
          const markup = markupData[0];
          let valorComMarkup = valorGSPN;
          switch (markup.tipo) {
            case 'percentual':
              valorComMarkup = valorGSPN * (1 + markup.valor / 100);
              break;
            case 'multiplicador':
              valorComMarkup = valorGSPN * markup.valor;
              break;
            case 'valor_fixo':
              valorComMarkup = valorGSPN + markup.valor;
              break;
          }
          setNovaPecaValorComMarkup(valorComMarkup);
        } else {
          setNovaPecaValorComMarkup(null);
        }
      } catch (error) {
        setNovaPecaValorComMarkup(null);
      }
    };

    calcularMarkup();
  }, [novaPecaValor, tipoOS, unidadeId, tipoOrcamento, modoSCACC, os, currentMode]);

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
      showAlert({ message: 'Preencha os campos obrigatórios: Unidade, Nome do Cliente e Defeito Relatado', type: 'warning' });
      return;
    }

    // Validação específica para OS IH: cidade obrigatória
    if (tipoAtendimento === 'IH' && !clienteCidade?.trim()) {
      showAlert({ message: 'Para OS do tipo IH (In-Home), a cidade do cliente é obrigatória para roteamento.', type: 'warning' });
      return;
    }

    // Verificar se já existe OS com este número Samsung
    if (numeroOSSamsung) {
      const { data: osExistente } = await supabase
        .from('os')
        .select('id, numero_os_interna, numero_os_samsung')
        .eq('numero_os_samsung', numeroOSSamsung)
        .maybeSingle();

      if (osExistente) {
        showAlert({ message: `Já existe uma OS cadastrada com o número Samsung ${numeroOSSamsung}.\n\nOS Interna: ${osExistente.numero_os_interna || 'N/A'}`, type: 'warning' });
        return;
      }
    }

    try {
      setLoading(true);

      let pecasFinais = [...pecasAdicionadas];
      if (novaPecaCodigo && novaPecaDescricao) {
        const valorPeca = parseFloat(sanitizeGSPNValue(novaPecaValor)) || 0;
        const valorComMarkup = novaPecaValorComMarkup || valorPeca;
        const quantidade = novaPecaQuantidade;
        pecasFinais = [...pecasFinais, {
          codigo: novaPecaCodigo,
          descricao: novaPecaDescricao,
          valor: modoSCACC ? valorComMarkup : valorPeca,
          valor_gspn: valorPeca,
          quantidade: quantidade,
          requisitada: false
        }];
      }

      await salvarOuAtualizarCliente();

      const enderecoCompleto = [
        clienteLogradouro,
        clienteNumero,
        clienteComplemento,
        clienteBairro,
        clienteCidade,
        clienteEstado
      ].filter(Boolean).join(', ');

      const descontoNum = parseFloat(descontoValorCreate.replace(',', '.')) || 0;

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
          criado_por: usuario?.id,
          desconto_tipo: descontoNum > 0 ? descontoTipoCreate : null,
          desconto_valor: descontoNum > 0 ? descontoNum : 0
        })
        .select()
        .single();

      if (osError) throw osError;


      // Salvar peças adicionadas diretamente na OS
      if (pecasFinais.length > 0) {
        const pecasInsert = pecasFinais.map(peca => ({
          os_id: novaOS.id,
          pn: peca.codigo,
          descricao: peca.descricao,
          quantidade: peca.quantidade || 1,
          valor_unitario: peca.valor,
          valor_total: peca.valor * (peca.quantidade || 1),
          valor_gspn: peca.valor_gspn || null,
          status: 'requisitada',
          requisitada_por: usuario?.id
        }));

        await supabase
          .from('os_pecas')
          .insert(pecasInsert);
      }

      // Salvar serviços adicionados diretamente na OS (independente de cotação)
      if (servicosAdicionados.length > 0) {
        const servicosInsert = servicosAdicionados.map(servico => ({
          os_id: novaOS.id,
          servico_id: servico.id || null,
          codigo_servico: servico.codigo || null,
          descricao: servico.descricao,
          quantidade: servico.quantidade,
          valor_unitario: servico.valor_unitario,
          valor_total: servico.valor_unitario * servico.quantidade
        }));

        await supabase
          .from('os_servicos')
          .insert(servicosInsert);
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

        await supabase
          .from('os_checklist_vinculados')
          .insert(checklistsInsert);
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

        await supabase
          .from('requisicoes_pecas')
          .insert(requisicoesInsert);
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

          await supabase
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

          const { data: { publicUrl } } = supabase.storage
            .from('os-anexos')
            .getPublicUrl(filePath);

          const tipoArquivo = anexo.file.type.startsWith('image/') ? 'foto' :
                              anexo.file.type.startsWith('video/') ? 'video' : 'documento';

          await supabase.from('os_anexos').insert({
            os_id: novaOS.id,
            nome_arquivo: anexo.nome,
            url: publicUrl,
            tamanho_bytes: anexo.file.size,
            usuario_id: usuario?.id,
            tipo: tipoArquivo
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

      // Adicionar comentários de serviços adicionados
      if (servicosAdicionados.length > 0) {
        servicosAdicionados.forEach(servico => {
          comentariosInsert.push({
            os_id: novaOS.id,
            usuario_id: usuario?.id,
            comentario: `Serviço adicionado: ${servico.descricao} - Qtd: ${servico.quantidade} - R$ ${servico.valor_unitario.toFixed(2)}`,
            is_system: true
          });
        });
      }

      // Adicionar comentários de peças adicionadas
      if (pecasAdicionadas.length > 0) {
        pecasAdicionadas.forEach(peca => {
          comentariosInsert.push({
            os_id: novaOS.id,
            usuario_id: usuario?.id,
            comentario: `Peça adicionada: ${peca.descricao} (${peca.codigo}) - R$ ${peca.valor.toFixed(2)}`,
            is_system: true
          });
        });
      }

      // Adicionar comentários de anexos
      if (anexosTemporarios.length > 0) {
        anexosTemporarios.forEach(anexo => {
          comentariosInsert.push({
            os_id: novaOS.id,
            usuario_id: usuario?.id,
            comentario: `Anexo adicionado: ${anexo.nome}`,
            is_system: true
          });
        });
      }

      // Adicionar comentários de pagamentos
      if (pagamentosTemporarios.length > 0) {
        pagamentosTemporarios.forEach(pag => {
          comentariosInsert.push({
            os_id: novaOS.id,
            usuario_id: usuario?.id,
            comentario: `Pagamento registrado: ${pag.forma_pagamento} - R$ ${pag.valor.toFixed(2)}`,
            is_system: true
          });
        });
      }

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

      await supabase
        .from('os_comentarios')
        .insert(comentariosInsert);

      // Mostrar modal de sucesso
      setDadosOSCriada({
        numeroInterna: novaOS.numero_os_interna,
        numeroSamsung: novaOS.numero_os_samsung || undefined
      });
      setMostrarModalSucesso(true);

      // Mudar para modo de visualização e carregar a OS criada
      setCurrentOsId(novaOS.id);
      setCurrentMode('view');
      setAbaAtiva('dados');

      onReload?.();
    } catch (error: any) {
      const errorMessage = error?.message || error?.error_description || error?.hint || 'Erro desconhecido';
      showAlert({ message: `Erro ao criar OS ${tipoOS}:\n\n${errorMessage}`, type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handleRequisitarPeca = (peca: any) => {
    setPecaParaRequisitar(peca);
    setMostrarConfirmacaoRequisicao(true);
  };

  const confirmarRequisicao = async () => {
    if (!pecaParaRequisitar) return;

    setRequisitando(true);
    try {
      const peca = pecaParaRequisitar;

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
        numero_os_samsung: os?.numero_os_samsung || os?.numero_os_interna,
        unidade_id: os?.unidade_id,
        tecnico_id: os?.tecnico_agendado_id || null
      }).select();

      if (insertError) throw insertError;


      // Mover OS para "Aguardando Peça" se não estiver lá ainda
      const colunasQueNaoPrecisamMover = ['aguardando_peca', 'peca_em_transito'];
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

      setMostrarConfirmacaoRequisicao(false);
      setPecaParaRequisitar(null);
      setMostrarSucessoRequisicao(true);
    } catch (error) {
      showAlert({ message: 'Erro ao requisitar peça', type: 'error' });
    } finally {
      setRequisitando(false);
    }
  };

  const confirmarRequisicaoManual = async () => {
    if (!dadosRequisicaoManual) return;

    setRequisitandoManual(true);
    try {
      const valorNumerico = dadosRequisicaoManual.valor ? parseFloat(dadosRequisicaoManual.valor) : null;

      const { data: requisicaoId, error: insertError } = await supabase.rpc('inserir_requisicao_peca', {
        p_os_id: osId,
        p_cotacao_peca_id: null,
        p_codigo_peca: dadosRequisicaoManual.codigo,
        p_descricao: dadosRequisicaoManual.descricao,
        p_quantidade_requisitada: dadosRequisicaoManual.quantidade,
        p_valor_peca: valorNumerico,
        p_numero_os_samsung: os?.numero_os_samsung || null
      });

      if (insertError) {
        throw insertError;
      }

      await supabase.from('os_comentarios').insert({
        os_id: osId,
        usuario_id: usuario?.id,
        comentario: `✚ Requisição adicionada: ${dadosRequisicaoManual.descricao} (${dadosRequisicaoManual.codigo}) - Qtd: ${dadosRequisicaoManual.quantidade}${valorNumerico ? ` - Valor: R$ ${valorNumerico.toFixed(2)}` : ''}`,
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

      setMostrarConfirmacaoRequisicaoManual(false);
      setDadosRequisicaoManual(null);
    } catch (error: any) {
      showAlert({ message: `Erro ao criar requisição: ${error.message || 'Erro desconhecido'}`, type: 'error' });
    } finally {
      setRequisitandoManual(false);
    }
  };

  const handleRequisitarNovamente = async (peca: any, requisicaoAnterior: any) => {
    const motivo = prompt('Informe o motivo para requisitar novamente esta peça:');
    if (!motivo || !motivo.trim()) {
      showAlert({ message: 'É necessário informar o motivo da nova requisição', type: 'warning' });
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
          unidade_id: os?.unidade_id,
          numero_os_samsung: os?.numero_os_samsung || os?.numero_os_interna
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

      showAlert({ message: 'Nova requisição criada com sucesso!', type: 'success' });
      await loadPecas();
      await loadRequisicoes();
      await loadComentarios();
      await loadOS();
      onReload?.();
    } catch (error: any) {
      showAlert({ message: `Erro ao criar nova requisição: ${error.message}`, type: 'error' });
    }
  };

  const handleCancelarRequisicao = (requisicao: RequisicaoPeca) => {
    setRequisicaoParaCancelar(requisicao);
    setMotivoCancelamento('');
    setMostrarModalCancelarRequisicao(true);
  };

  const confirmarCancelamento = async () => {
    if (!requisicaoParaCancelar || !motivoCancelamento.trim()) {
      showAlert({ message: 'É necessário informar o motivo do cancelamento', type: 'warning' });
      return;
    }

    setCancelando(true);
    try {
      const { error: updateError } = await supabase
        .from('requisicoes_pecas')
        .update({ status: 'cancelada', motivo_cancelamento: motivoCancelamento })
        .eq('id', requisicaoParaCancelar.id);

      if (updateError) {
        throw updateError;
      }

      const { error: commentError } = await supabase.from('os_comentarios').insert({
        os_id: osId,
        usuario_id: usuario?.id,
        comentario: `Requisição cancelada por ${usuario?.nome}: ${requisicaoParaCancelar.descricao}\nMotivo: ${motivoCancelamento}`,
        is_system: true
      });

      if (commentError) {
      }

      await loadPecas();
      await loadRequisicoes();
      await loadComentarios();

      setMostrarModalCancelarRequisicao(false);
      setRequisicaoParaCancelar(null);
      setMotivoCancelamento('');
    } catch (error) {
      alert('Erro ao cancelar requisição');
    } finally {
      setCancelando(false);
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

  const handleExcluirPeca = async (peca: any, tipo: string) => {
    if (!confirm('Tem certeza que deseja excluir esta peça?')) return;
    try {
      if (tipo === 'os_peca') {
        await supabase.from('os_pecas').delete().eq('id', peca.id);
      } else if (tipo === 'cotacao') {
        await supabase.from('cotacoes_pecas').delete().eq('id', peca.id);
      }
      await loadPecas();
    } catch {
      alert('Erro ao excluir peça');
    }
  };

  const handleConfirmarDevolucao = async (motivo: string, tipo: 'nova' | 'nova_com_defeito' | 'usada', pecasSelecionadas?: string[]) => {
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

      if (requisicaoSelecionada.is_lote && pecasSelecionadas && pecasSelecionadas.length > 0) {
        const statusDevolucao = tipo === 'nova' ? 'devolvida_nova' : tipo === 'nova_com_defeito' ? 'devolvida_defeito' : 'usada';

        await supabase
          .from('estoque_pecas')
          .update({
            status: statusDevolucao
          })
          .in('id', pecasSelecionadas);

        const idsNumericos = requisicaoSelecionada.pecas_lote
          ?.filter(p => pecasSelecionadas.includes(p.id))
          .map(p => `#${p.id_numerico}`)
          .join(', ');

        await supabase.from('os_comentarios').insert({
          os_id: osId,
          usuario_id: usuario?.id,
          comentario: `Devolução solicitada por ${usuario?.nome} - Peça: ${requisicaoSelecionada.descricao} (Lote - IDs: ${idsNumericos})\nTipo: ${tipoLabel}\nMotivo: ${motivo}\n\nAguardando aprovação do estoque.`,
          is_system: true
        });
      } else {
        await supabase.from('os_comentarios').insert({
          os_id: osId,
          usuario_id: usuario?.id,
          comentario: `Devolução solicitada por ${usuario?.nome} - Peça: ${requisicaoSelecionada.descricao}\nTipo: ${tipoLabel}\nMotivo: ${motivo}\n\nAguardando aprovação do estoque.`,
          is_system: true
        });
      }

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

  const handleCancelarGI = (requisicao: RequisicaoPeca) => {
    setRequisicaoCancelarGI(requisicao);
    setMostrarModalCancelarGI(true);
  };

  const handleConfirmarCancelarGI = async (motivo: string, pecasSelecionadas?: string[]) => {
    if (!requisicaoCancelarGI) return;

    try {
      // Se for lote e tem peças selecionadas, processar apenas as selecionadas
      if (requisicaoCancelarGI.is_lote && pecasSelecionadas && pecasSelecionadas.length > 0) {
        // Atualizar status das peças selecionadas - voltar para disponivel
        await supabase
          .from('estoque_pecas')
          .update({
            status: 'disponivel',
            os_id: null,
            tecnico_id: null,
            gi_postada_em: null,
            gi_postada_por: null,
            gi_cancelada_em: new Date().toISOString(),
            gi_cancelada_por: usuario?.id
          })
          .in('id', pecasSelecionadas);

        // Verificar quantas peças do lote ainda TÊM GI postada (após o cancelamento)
        const pecasComGI = requisicaoCancelarGI.pecas_lote?.filter(p =>
          !pecasSelecionadas.includes(p.id) && p.gi_postada_em
        ) || [];

        // Se NENHUMA peça tem GI postada, mudar status da requisição para "cancelada"
        if (pecasComGI.length === 0) {
          await supabase
            .from('requisicoes_pecas')
            .update({
              status: 'cancelada',
              gi_postada_em: null
            })
            .eq('id', requisicaoCancelarGI.id);
        }

        const idsNumericos = requisicaoCancelarGI.pecas_lote
          ?.filter(p => pecasSelecionadas.includes(p.id))
          .map(p => `#${p.id_numerico}`)
          .join(', ');

        await supabase
          .from('os_comentarios')
          .insert({
            os_id: osId,
            usuario_id: usuario?.id,
            comentario: `Despacho cancelado por ${usuario?.nome}: ${requisicaoCancelarGI.descricao} (${requisicaoCancelarGI.codigo_peca}) - Lote IDs: ${idsNumericos}\nRequisição ID: ${requisicaoCancelarGI.id.slice(0, 8)}\nMotivo: ${motivo}\nPeças voltaram para DISPONÍVEL no estoque.`,
            is_system: true
          });

        for (const pecaId of pecasSelecionadas) {
          await supabase.from('estoque_historico').insert({
            peca_id: pecaId,
            usuario_id: usuario?.id,
            acao: 'gi_cancelada',
            status_anterior: 'vinculada_tecnico',
            status_novo: 'disponivel',
            observacao: `Despacho cancelado por ${usuario?.nome} - Motivo: ${motivo}`
          });
        }
      } else {
        // Processo normal para peça única - voltar peça para disponivel
        if (requisicaoCancelarGI.peca_estoque_id) {
          await supabase
            .from('estoque_pecas')
            .update({
              status: 'disponivel',
              os_id: null,
              tecnico_id: null,
              gi_postada_em: null,
              gi_postada_por: null,
              gi_cancelada_em: new Date().toISOString(),
              gi_cancelada_por: usuario?.id
            })
            .eq('id', requisicaoCancelarGI.peca_estoque_id);
        }

        await supabase
          .from('requisicoes_pecas')
          .update({
            status: 'cancelada',
            gi_postada_em: null
          })
          .eq('id', requisicaoCancelarGI.id);

        await supabase
          .from('os_comentarios')
          .insert({
            os_id: osId,
            usuario_id: usuario?.id,
            comentario: `Despacho cancelado por ${usuario?.nome}: ${requisicaoCancelarGI.descricao} (${requisicaoCancelarGI.codigo_peca})\nRequisição ID: ${requisicaoCancelarGI.id.slice(0, 8)}\nMotivo: ${motivo}\nPeça voltou para DISPONÍVEL no estoque.`,
            is_system: true
          });

        if (requisicaoCancelarGI.peca_estoque_id) {
          await supabase.from('estoque_historico').insert({
            peca_id: requisicaoCancelarGI.peca_estoque_id,
            usuario_id: usuario?.id,
            acao: 'gi_cancelada',
            status_anterior: 'vinculada_tecnico',
            status_novo: 'disponivel',
            observacao: `Despacho cancelado por ${usuario?.nome} - Motivo: ${motivo}`
          });
        }
      }

      alert('Despacho cancelado! Peça disponível no estoque.');

      await loadPecas();
      await loadRequisicoes();
      await loadComentarios();

      if (onReload) {
        onReload();
      }

      setMostrarModalCancelarGI(false);
      setRequisicaoCancelarGI(null);
    } catch (error) {
      alert(`Erro ao cancelar despacho: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
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
    const filePath = `${currentOsId}/${fileName}`;

    try {

      const { error: uploadError } = await supabase.storage
        .from('os-anexos')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }


      const { data: { publicUrl } } = supabase.storage
        .from('os-anexos')
        .getPublicUrl(filePath);


      const tipoArquivo = file.type.startsWith('image/') ? 'foto' :
                          file.type.startsWith('video/') ? 'video' : 'documento';

      const { error: insertError } = await supabase.from('os_anexos').insert({
        os_id: currentOsId,
        nome_arquivo: file.name,
        url: publicUrl,
        tamanho_bytes: file.size,
        usuario_id: usuario?.id,
        tipo: tipoArquivo
      });

      if (insertError) {
        throw insertError;
      }

      alert('Anexo enviado com sucesso!');
      loadAnexos();
      e.target.value = '';
    } catch (error) {
      alert('Erro ao fazer upload do anexo');
    }
  };

  const handleAbrirAnexo = async (anexo: OSAnexo) => {
    try {
      if (!anexo || !anexo.url) {
        alert('Erro: Anexo não possui URL válida');
        return;
      }

      window.open(anexo.url, '_blank');
    } catch (error) {
      alert('Erro ao abrir anexo');
    }
  };

  const handleExcluirAnexo = async (anexo: OSAnexo) => {
    if (!confirm(`Tem certeza que deseja excluir o anexo "${anexo.nome_arquivo}"?`)) {
      return;
    }

    try {
      if (anexo.url) {
        const urlParts = anexo.url.split('/os-anexos/');
        if (urlParts.length > 1) {
          const filePath = urlParts[1];
          await supabase.storage
            .from('os-anexos')
            .remove([filePath]);

        }
      }

      const { error: dbError } = await supabase
        .from('os_anexos')
        .delete()
        .eq('id', anexo.id);

      if (dbError) throw dbError;

      alert('Anexo excluído com sucesso!');
      loadAnexos();
    } catch (error) {
      alert('Erro ao excluir anexo');
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
    const statusConfig: Record<string, { label: string; color: string; isAccent?: boolean }> = {
      pendente: { label: 'PENDENTE', color: '#FFBF00' },
      atendida: { label: 'ATENDIDA', color: '#00D4FF', isAccent: true },
      em_uso: { label: 'EM USO', color: '#9D00FF' },
      gi_postada: { label: 'GI POSTADA', color: '#39FF14' },
      devolucao_pendente: { label: 'DEVOLUÇÃO PENDENTE', color: '#FF6B00' },
      devolvida: { label: 'DEVOLVIDA', color: '#39FF14' },
      cancelada: { label: 'CANCELADA', color: '#808080' },
      reprovada: { label: 'REPROVADA', color: '#FF0064' },
      pedido_feito: { label: 'PEDIDO FEITO', color: '#00D4FF', isAccent: true }
    };

    const config = statusConfig[status] || { label: status.toUpperCase(), color: '#6B7280' };

    return (
      <span
        className="px-2 py-1 rounded text-xs font-bold uppercase"
        style={config.isAccent ? {
          backgroundColor: 'rgba(var(--accent-rgb), 0.125)',
          color: 'var(--text-accent)',
          border: '1px solid rgba(var(--accent-rgb), 0.38)'
        } : {
          backgroundColor: `${config.color}20`,
          color: config.color,
          border: `1px solid ${config.color}60`
        }}
      >
        {config.label}
      </span>
    );
  };

  const moverOS = async (targetColumn: string, extraUpdates?: Record<string, any>) => {
    if (!os || movendoOS) return;

    // Se a OS não tem rota definida e não estamos recebendo rota_id via extraUpdates, exibir modal obrigatório
    if (!os.rota_id && !extraUpdates?.rota_id) {
      setMostrarMoverPara(false);
      setColunaDestinoAposSelecionarRota({ id: targetColumn, label: targetColumn });
      setMostrarSelecionarRotaObrigatoria(true);
      return;
    }

    setMovendoOS(true);
    try {
      const updateData: Record<string, any> = {
        coluna_kanban: targetColumn,
        bloqueio_movimentacao_automatica: true,
        updated_at: new Date().toISOString(),
        ...extraUpdates
      };
      const { error } = await supabase
        .from('os')
        .update(updateData)
        .eq('id', os.id);

      if (error) throw error;

      setMostrarMoverPara(false);
      onMoveOS?.(os.id, os.coluna_kanban, targetColumn);
      setMostrarSucessoMover(true);
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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="premium-card w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: tipoOS === 'LP' ? '#FFA50033' : 'rgba(var(--accent-rgb), 0.2)' }}>
          <div>
            {(() => {
              const isSCACC = modoSCACC || os?.tipo_orcamento === 'samsung_contigo' || os?.tipo_orcamento === 'acessorios';
              const headerColor = isSCACC ? '#39FF14' : (tipoOS === 'LP' ? '#FFA500' : 'var(--text-accent)');
              const headerText = isSCACC ? 'SC / ACC - Samsung Contigo / Acessorio' : (tipoOS === 'LP' ? 'LP - Garantia' : 'OW - Fora de Garantia');
              return (
                <h2 className="tech-heading text-xl flex items-center gap-2" style={{ color: headerColor }}>
                  {headerText}
                  {currentMode === 'create' && <span className="text-sm text-gray-400">(NOVA)</span>}
                </h2>
              );
            })()}
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
                    background: os?.tipo_os === 'OW' ? 'linear-gradient(135deg, rgba(var(--accent-rgb),0.2) 0%, rgba(var(--accent-rgb),0.05) 100%)' : 'linear-gradient(135deg, rgba(255,165,0,0.2) 0%, rgba(255,165,0,0.05) 100%)',
                    border: os?.tipo_os === 'OW' ? '1px solid var(--text-accent)' : '1px solid #FFA500',
                    color: os?.tipo_os === 'OW' ? 'var(--text-accent)' : '#FFA500',
                    boxShadow: os?.tipo_os === 'OW' ? '0 0 10px rgba(var(--accent-rgb),0.2)' : '0 0 10px rgba(255,165,0,0.2)'
                  }}
                >
                  <MoveHorizontal className="w-4 h-4" />
                  MOVER PARA
                  <ChevronDown className={`w-4 h-4 transition-transform ${mostrarMoverPara ? 'rotate-180' : ''}`} />
                </button>

                {mostrarMoverPara && (
                  <div className="absolute right-0 top-full mt-2 w-72 max-h-96 overflow-y-auto premium-card p-3 z-50 cyber-scrollbar">
                    <div className="mb-3 pb-2" style={{ borderBottom: os?.tipo_os === 'OW' ? '1px solid rgba(var(--accent-rgb), 0.2)' : '1px solid #FFA50033' }}>
                      <p className="text-xs text-gray-400">Coluna Atual:</p>
                      <p className="text-sm font-bold" style={{ color: os?.tipo_os === 'OW' ? 'var(--text-accent)' : '#FFA500' }}>{colunaAtual?.label || 'N/A'}</p>
                    </div>
                    <div className="space-y-1">
                      {COLUNAS_KANBAN.filter(c => c.id !== os.coluna_kanban).map((coluna) => (
                        <button
                          key={coluna.id}
                          onClick={() => {
                            const cidadeOS = os?.cliente_cidade;
                            const rotaEncontrada = findRotaByCidade(cidadeOS);

                            if (!rotaEncontrada) {
                              setColunaDestinoAposSelecionarRota(coluna);
                              setMostrarMoverPara(false);
                              setMostrarSelecionarRotaObrigatoria(true);
                              return;
                            }

                            setColunaDestino(coluna);
                            setMostrarConfirmacaoMover(true);
                          }}
                          disabled={movendoOS}
                          className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                          style={{
                            color: '#fff',
                            border: '1px solid transparent'
                          }}
                          onMouseEnter={(e) => {
                            const cor = os?.tipo_os === 'OW' ? 'var(--text-accent)' : '#FFA500';
                            e.currentTarget.style.borderColor = cor;
                            e.currentTarget.style.boxShadow = os?.tipo_os === 'OW' ? '0 0 10px rgba(var(--accent-rgb),0.2)' : '0 0 10px rgba(255,165,0,0.2)';
                            e.currentTarget.style.backgroundColor = os?.tipo_os === 'OW' ? 'rgba(var(--accent-rgb), 0.063)' : '#FFA50010';
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

            {currentMode === 'view' && os && (
              <button
                onClick={handleGerarPDF}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all"
                style={{
                  background: 'linear-gradient(135deg, rgba(59,130,246,0.2) 0%, rgba(59,130,246,0.05) 100%)',
                  border: '1px solid #3B82F6',
                  color: '#3B82F6',
                  boxShadow: '0 0 10px rgba(59,130,246,0.2)'
                }}
                title="Gerar PDF da OS"
              >
                <FileDown className="w-4 h-4" />
                PDF
              </button>
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
                color: tipoOS === 'LP' ? '#FFA500' : 'var(--text-accent)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = tipoOS === 'LP' ? '#FFA50010' : 'rgba(var(--accent-rgb), 0.063)';
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
            <div className="flex border-b" style={{ borderColor: tipoOS === 'LP' ? '#FFA50033' : 'rgba(var(--accent-rgb), 0.2)' }}>
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
                const corPrimaria = tipoOS === 'OW' ? 'var(--text-accent)' : '#FFA500';
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
                <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: tipoOS === 'LP' ? '#FFA500' : 'var(--text-accent)' }}>
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
                  {modoSCACC && (
                    <div>
                      <label className="text-xs text-gray-400 uppercase block mb-2">
                        Tipo de Orcamento *
                      </label>
                      <select
                        value={tipoOrcamento}
                        onChange={(e) => setTipoOrcamento(e.target.value as 'samsung_contigo' | 'acessorios')}
                        className="neon-input w-full"
                        style={{
                          borderColor: tipoOrcamento === 'samsung_contigo' ? '#FFA500' : 'var(--neon-green)',
                          boxShadow: `0 0 8px ${tipoOrcamento === 'samsung_contigo' ? 'rgba(255,165,0,0.3)' : 'rgba(var(--neon-green-rgb),0.3)'}`
                        }}
                      >
                        <option value="samsung_contigo">SAMSUNG CONTIGO</option>
                        <option value="acessorios">ACESSORIO</option>
                      </select>
                    </div>
                  )}
                  <div className={modoSCACC ? '' : 'col-span-2'}>
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
                <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: tipoOS === 'LP' ? '#FFA500' : 'var(--text-accent)' }}>
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
                <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: tipoOS === 'LP' ? '#FFA500' : 'var(--text-accent)' }}>
                  Dados do Aparelho
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className={`text-xs uppercase block mb-2 ${!aparelhoLinha ? 'text-red-400' : 'text-gray-400'}`}>
                      Linha {!aparelhoLinha && <span className="text-red-500">*</span>}
                    </label>
                    <select
                      value={aparelhoLinha}
                      onChange={(e) => setAparelhoLinha(e.target.value)}
                      className={`neon-input w-full ${!aparelhoLinha ? 'border-red-500 ring-1 ring-red-500' : ''}`}
                    >
                      <option value="">Selecione a linha...</option>
                      <option value="DA - WSM / Kitchen">DA - WSM / Kitchen</option>
                      <option value="DA - REF / Ar Condicionado">DA - REF / Ar Condicionado</option>
                      <option value="DTV - TV">DTV - TV</option>
                      <option value="DTV - Monitor / SoundBar">DTV - Monitor / SoundBar</option>
                      <option value="MX - Celular">MX - Celular</option>
                      <option value="MX - Notebook">MX - Notebook</option>
                      <option value="MX - Watch / Wearables">MX - Watch / Wearables</option>
                      <option value="MX - Tablet">MX - Tablet</option>
                    </select>
                    {!aparelhoLinha && (
                      <p className="text-xs text-red-400 mt-1">Selecione a linha do aparelho</p>
                    )}
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
                                if ((tipoOS === 'OW' || modoSCACC) && peca.valor_com_markup) {
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
                                  {(tipoOS === 'OW' || modoSCACC) && peca.valor_com_markup ? (
                                    <span className="text-xs px-2 py-0.5 rounded font-bold" style={{
                                      backgroundColor: 'rgba(var(--neon-green-rgb),0.1)',
                                      color: 'var(--neon-green)',
                                      border: '1px solid rgba(var(--neon-green-rgb),0.25)'
                                    }}>
                                      R$ {peca.valor_com_markup.toFixed(2)}
                                    </span>
                                  ) : (
                                    <span className="text-xs px-2 py-0.5 rounded" style={{
                                      backgroundColor: peca.count > 0 ? 'rgba(var(--neon-green-rgb),0.1)' : '#FF006420',
                                      color: peca.count > 0 ? 'var(--neon-green)' : '#FF0064',
                                      border: `1px solid ${peca.count > 0 ? 'rgba(var(--neon-green-rgb),0.25)' : '#FF006440'}`
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
                    <div className={modoSCACC ? 'grid grid-cols-2 gap-3' : ''}>
                      <div>
                        <label className="text-xs text-gray-400 uppercase block mb-2">
                          Valor GSPN (R$)
                        </label>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={novaPecaValor}
                          onChange={(e) => setNovaPecaValor(e.target.value)}
                          onPaste={(e) => {
                            e.preventDefault();
                            const pasted = e.clipboardData.getData('text');
                            setNovaPecaValor(sanitizeGSPNValue(pasted));
                          }}
                          onBlur={() => {
                            if (novaPecaValor) setNovaPecaValor(sanitizeGSPNValue(novaPecaValor));
                          }}
                          className="neon-input w-full"
                          placeholder="0.00"
                        />
                        {(tipoOS === 'OW' || modoSCACC) && novaPecaValorComMarkup !== null && (
                          <p className="text-xs mt-1" style={{ color: '#FFA500' }}>
                            Valor c/ Markup: R$ {novaPecaValorComMarkup.toFixed(2)}
                          </p>
                        )}
                      </div>
                      <div>
                          <label className="text-xs text-gray-400 uppercase block mb-2">
                            Quantidade
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={novaPecaQuantidade}
                            onChange={(e) => setNovaPecaQuantidade(Math.max(1, parseInt(e.target.value) || 1))}
                            className="neon-input w-full"
                            placeholder="1"
                          />
                          {novaPecaQuantidade > 1 && (
                            <p className="text-xs mt-1" style={{ color: 'var(--neon-green)' }}>
                              Requisicao em lote ({novaPecaQuantidade} un.)
                            </p>
                          )}
                        </div>
                    </div>
                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={() => {
                          if (!novaPecaCodigo || !novaPecaDescricao) {
                            alert('Preencha código e descrição');
                            return;
                          }
                          const valorPeca = parseFloat(sanitizeGSPNValue(novaPecaValor)) || 0;
                          const valorComMarkup = novaPecaValorComMarkup || valorPeca;
                          const quantidade = novaPecaQuantidade;
                          setPecasAdicionadas([...pecasAdicionadas, {
                            codigo: novaPecaCodigo,
                            descricao: novaPecaDescricao,
                            valor: modoSCACC ? valorComMarkup : valorPeca,
                            valor_gspn: valorPeca,
                            quantidade: quantidade,
                            requisitada: false
                          }]);
                          setNovaPecaCodigo('');
                          setNovaPecaDescricao('');
                          setNovaPecaValor('');
                          setNovaPecaQuantidade(1);
                          setNovaPecaValorComMarkup(null);
                        }}
                        className="neon-button px-4 py-2 flex-1 text-xs"
                        style={{
                          backgroundColor: modoSCACC ? 'rgba(var(--neon-green-rgb),0.1)' : (tipoOS === 'LP' ? '#FFA50020' : 'rgba(var(--accent-rgb), 0.125)'),
                          borderColor: modoSCACC ? 'var(--neon-green)' : (tipoOS === 'LP' ? '#FFA500' : 'var(--text-accent)'),
                          color: modoSCACC ? 'var(--neon-green)' : (tipoOS === 'LP' ? '#FFA500' : 'var(--text-accent)')
                        }}
                      >
                        ADICIONAR
                      </button>
                    </div>
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
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <p className="text-sm font-bold text-gray-300">{peca.descricao}</p>
                                {peca.quantidade > 1 && (
                                  <span
                                    className="px-2 py-0.5 rounded text-xs font-bold"
                                    style={{
                                      backgroundColor: 'rgba(var(--neon-green-rgb),0.1)',
                                      color: 'var(--neon-green)',
                                      border: '1px solid rgba(var(--neon-green-rgb),0.35)'
                                    }}
                                  >
                                    QTD: {peca.quantidade}
                                  </span>
                                )}
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
                              <div className="flex items-center gap-3 mt-1">
                                {peca.valor_gspn && peca.valor_gspn !== peca.valor && (
                                  <p className="text-xs text-gray-500">GSPN: R$ {peca.valor_gspn.toFixed(2)}</p>
                                )}
                                <p className="text-xs" style={{ color: modoSCACC ? 'var(--neon-green)' : 'var(--text-accent)' }}>
                                  Valor Venda: R$ {peca.valor.toFixed(2)} {peca.quantidade > 1 && `(Total: R$ ${(peca.valor * peca.quantidade).toFixed(2)})`}
                                </p>
                              </div>
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
                                      quantidade: peca.quantidade || 1
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
                                  REQUISITAR {peca.quantidade > 1 ? `(${peca.quantidade})` : ''}
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
                <div className="bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-lg p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-bold text-[#39FF14] uppercase tracking-wider flex items-center gap-2">
                        <CheckSquare className="w-4 h-4" />
                        Checklists Administrativos
                      </h3>
                      <p className="text-xs text-gray-400 mt-2">
                        Checklists vinculados automaticamente e manualmente para esta OS
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        loadChecklistsDisponiveis();
                        setMostrarModalChecklist(true);
                      }}
                      className="neon-button text-xs px-3 py-2 flex items-center gap-2"
                      style={{
                        backgroundColor: 'rgba(var(--neon-green-rgb),0.1)',
                        color: 'var(--neon-green)',
                        borderColor: 'rgba(var(--neon-green-rgb),0.35)'
                      }}
                    >
                      <Plus className="w-4 h-4" />
                      ADICIONAR
                    </button>
                  </div>
                </div>

                {checklistsSelecionados.length === 0 ? (
                  <div className="text-center py-12 premium-card">
                    <CheckSquare className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm mb-2">Nenhum checklist vinculado</p>
                    <p className="text-xs text-gray-600">
                      Clique em "ADICIONAR" para vincular um checklist manualmente
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {checklistsSelecionados.map((checklistId) => {
                      const template = checklistsDisponiveis.find(c => c.id === checklistId);
                      if (!template) return null;

                      return (
                        <div key={checklistId} className="bg-[#0a0f1a] border border-gray-800 rounded-lg p-4">
                          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-800">
                            <div className="flex-1">
                              <div className="flex items-center gap-3">
                                <h4 className="text-sm font-bold text-[#39FF14] uppercase tracking-wider">{template.nome}</h4>
                              </div>
                            </div>
                            <button
                              onClick={() => setChecklistsSelecionados(checklistsSelecionados.filter(id => id !== checklistId))}
                              className="text-red-400 hover:text-red-300 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>

                          <div className="space-y-2">
                            {template.itens?.map((item: any) => (
                              <div key={item.ordem} className="flex items-start gap-3 p-2 rounded hover:bg-white/5 transition-colors">
                                <div className="flex-shrink-0 w-5 h-5 rounded border-2 border-gray-500 flex items-center justify-center">
                                </div>
                                <div className="flex-1">
                                  <p className="text-sm text-gray-200">{item.texto}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {mostrarModalChecklist && (
                  <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[100]">
                    <div className="bg-[#0f1419] border border-[#39FF14]/40 rounded-lg w-full max-w-3xl max-h-[80vh] overflow-hidden shadow-2xl shadow-[#39FF14]/10">
                      <div className="p-6 border-b border-[#39FF14]/30 bg-gradient-to-r from-[#0f1419] to-[#1a1f2e]">
                        <div className="flex items-center justify-between">
                          <h3 className="text-xl font-bold text-[#39FF14] uppercase tracking-wider">Adicionar Checklist</h3>
                          <button
                            onClick={() => setMostrarModalChecklist(false)}
                            className="text-gray-400 hover:text-white transition-colors"
                          >
                            <X className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      <div className="p-6 overflow-y-auto max-h-[calc(80vh-100px)]">
                        {(() => {
                          const templatesDisponiveis = checklistsDisponiveis.filter(t => !checklistsSelecionados.includes(t.id));

                          if (templatesDisponiveis.length === 0) {
                            return (
                              <div className="text-center py-12">
                                <CheckSquare className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                                <p className="text-gray-500 text-sm">
                                  Todos os checklists disponiveis ja foram vinculados
                                </p>
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-4">
                              {templatesDisponiveis.map((template) => (
                                <div
                                  key={template.id}
                                  className="bg-[#1a1f2e] border border-gray-700 rounded-lg p-5 hover:border-[#39FF14]/50 hover:shadow-lg hover:shadow-[#39FF14]/10 transition-all group"
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <h4 className="text-base font-bold text-gray-100 mb-2">{template.nome}</h4>
                                      {template.descricao && (
                                        <p className="text-sm text-gray-400 mb-3">{template.descricao}</p>
                                      )}
                                      <div className="flex gap-2 flex-wrap">
                                        <span className="px-3 py-1 rounded text-xs font-bold bg-cyan-500/20 text-cyan-400 border border-cyan-500/40">
                                          OS: {(template.tipo_os && template.tipo_os.length > 0) ? template.tipo_os.join(', ') : 'Todos'}
                                        </span>
                                        <span className="px-3 py-1 rounded text-xs font-bold bg-blue-500/20 text-blue-400 border border-blue-500/40">
                                          Atend: {(template.tipos_atendimento && template.tipos_atendimento.length > 0) ? template.tipos_atendimento.join(', ') : 'Todos'}
                                        </span>
                                        <span className="px-3 py-1 rounded text-xs font-bold bg-green-500/20 text-green-400 border border-green-500/40">
                                          {template.itens?.length || 0} itens
                                        </span>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() => {
                                        setChecklistsSelecionados([...checklistsSelecionados, template.id]);
                                        setMostrarModalChecklist(false);
                                      }}
                                      className="ml-4 w-10 h-10 rounded-lg bg-[#39FF14]/20 border border-[#39FF14]/40 flex items-center justify-center hover:bg-[#39FF14]/30 transition-colors group-hover:scale-110 transform"
                                    >
                                      <Plus className="w-5 h-5 text-[#39FF14]" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          );
                        })()}
                      </div>
                    </div>
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
                        backgroundColor: 'rgba(var(--accent-rgb), 0.125)',
                        borderColor: 'var(--text-accent)',
                        color: 'var(--text-accent)'
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
                          backgroundColor: 'rgba(var(--accent-rgb), 0.125)',
                          borderColor: 'var(--text-accent)',
                          color: 'var(--text-accent)'
                        }}
                      >
                        <Plus className="w-3 h-3 inline mr-1" />
                        ADICIONAR
                      </button>
                    </div>

                    <div className="space-y-3">
                      {servicosAdicionados.map((servico, index) => (
                        <div key={index} className="premium-card p-4" style={{ borderColor: 'rgba(var(--accent-rgb), 0.251)' }}>
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
                                  type="text"
                                  inputMode="decimal"
                                  value={servico.valor_unitario}
                                  onChange={(e) => {
                                    const val = e.target.value;
                                    setServicosAdicionados(servicosAdicionados.map(s =>
                                      s.codigo === servico.codigo ? { ...s, valor_unitario: parseFloat(sanitizeGSPNValue(val)) || 0 } : s
                                    ));
                                  }}
                                  onPaste={(e) => {
                                    e.preventDefault();
                                    const pasted = e.clipboardData.getData('text');
                                    const val = parseFloat(sanitizeGSPNValue(pasted)) || 0;
                                    setServicosAdicionados(servicosAdicionados.map(s =>
                                      s.codigo === servico.codigo ? { ...s, valor_unitario: val } : s
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

                      <div className="premium-card p-4 bg-gradient-to-r from-[#00D4FF]/10 to-[#39FF14]/10" style={{ borderColor: 'var(--neon-green)' }}>
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
                  const valorPecas = pecasAdicionadas.reduce((sum, p) => sum + (p.valor * (p.quantidade || 1)), 0);
                  const valorServicos = servicosAdicionados.reduce((sum, s) => sum + (s.valor_unitario * s.quantidade), 0);
                  const subtotal = valorPecas + valorServicos;
                  const descontoNum = parseFloat(descontoValorCreate.replace(',', '.')) || 0;
                  const valorDesconto = descontoTipoCreate === 'percentual'
                    ? (subtotal * descontoNum / 100)
                    : descontoNum;
                  const valorTotal = Math.max(subtotal - valorDesconto, 0);
                  const valorPago = pagamentosTemporarios.reduce((sum, p) => sum + p.valor, 0);
                  const saldoRestante = valorTotal - valorPago;

                  return (
                    <>
                      <div className="premium-card p-6 bg-gradient-to-r from-[#9D4EDD]/10 to-[#FF0064]/10 border border-[#9D4EDD]/30">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#9D4EDD]/20 flex items-center justify-center border border-[#9D4EDD]/40">
                              <Tag className="w-5 h-5 text-[#9D4EDD]" />
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-[#9D4EDD]">DESCONTO</h3>
                              <p className="text-xs text-gray-400">Aplique desconto para o cliente</p>
                            </div>
                          </div>
                          {valorDesconto > 0 && (
                            <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/40">
                              -R$ {valorDesconto.toFixed(2)}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-xs text-gray-400 uppercase mb-2">Tipo de Desconto</label>
                            <div className="flex rounded-lg overflow-hidden border border-gray-700">
                              <button
                                type="button"
                                onClick={() => setDescontoTipoCreate('valor')}
                                className={`flex-1 px-4 py-3 text-sm font-bold uppercase transition-all flex items-center justify-center gap-2 ${
                                  descontoTipoCreate === 'valor'
                                    ? 'bg-[#9D4EDD] text-white'
                                    : 'bg-black/30 text-gray-400 hover:bg-gray-800'
                                }`}
                              >
                                <DollarSign className="w-4 h-4" />
                                Valor
                              </button>
                              <button
                                type="button"
                                onClick={() => setDescontoTipoCreate('percentual')}
                                className={`flex-1 px-4 py-3 text-sm font-bold uppercase transition-all flex items-center justify-center gap-2 ${
                                  descontoTipoCreate === 'percentual'
                                    ? 'bg-[#9D4EDD] text-white'
                                    : 'bg-black/30 text-gray-400 hover:bg-gray-800'
                                }`}
                              >
                                <Percent className="w-4 h-4" />
                                %
                              </button>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs text-gray-400 uppercase mb-2">
                              {descontoTipoCreate === 'percentual' ? 'Percentual (%)' : 'Valor (R$)'}
                            </label>
                            <div className="relative">
                              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                                {descontoTipoCreate === 'percentual' ? '%' : 'R$'}
                              </span>
                              <input
                                type="text"
                                value={descontoValorCreate}
                                onChange={(e) => setDescontoValorCreate(e.target.value.replace(/[^0-9.,]/g, ''))}
                                placeholder="0,00"
                                className="w-full pl-10 pr-4 py-3 bg-black/50 border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#9D4EDD] focus:outline-none text-lg font-mono"
                              />
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs text-gray-400 uppercase mb-2">Preview</label>
                            <div className="px-4 py-3 bg-black/50 border border-gray-700 rounded-lg">
                              <p className="text-lg font-bold text-[#FF0064] font-mono">
                                -R$ {valorDesconto.toFixed(2)}
                              </p>
                              <p className="text-xs text-gray-500">
                                Final: R$ {valorTotal.toFixed(2)}
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="premium-card p-6 bg-gradient-to-r from-[#39FF14]/5 to-[#00D4FF]/5">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                          <div>
                            <p className="text-xs text-gray-400 uppercase mb-1">Subtotal</p>
                            <p className="text-xl font-bold text-gray-300">
                              R$ {subtotal.toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 uppercase mb-1">Desconto</p>
                            <p className={`text-xl font-bold ${valorDesconto > 0 ? 'text-[#FF0064]' : 'text-gray-500'}`}>
                              {valorDesconto > 0 ? '-' : ''}R$ {valorDesconto.toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 uppercase mb-1">Valor Final</p>
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
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-gray-700">
                          <div>
                            <p className="text-xs text-gray-400 uppercase mb-1">Saldo Restante</p>
                            <p className="text-2xl font-bold text-[#FFBF00]">
                              R$ {saldoRestante.toFixed(2)}
                            </p>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className={`px-4 py-2 rounded-lg text-xs font-bold uppercase ${
                              saldoRestante <= 0 && valorTotal > 0 ? 'bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/40' :
                              valorPago > 0 && saldoRestante > 0 ? 'bg-[#FFBF00]/20 text-[#FFBF00] border border-[#FFBF00]/40' :
                              'bg-[#FF0064]/20 text-[#FF0064] border border-[#FF0064]/40'
                            }`}>
                              {saldoRestante <= 0 && valorTotal > 0 ? 'Pago 100%' :
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
                      </div>
                    </>
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
                        backgroundColor: 'rgba(var(--accent-rgb), 0.125)',
                        borderColor: 'var(--text-accent)',
                        color: 'var(--text-accent)'
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
                          backgroundColor: 'rgba(var(--accent-rgb), 0.125)',
                          borderColor: 'var(--text-accent)',
                          color: 'var(--text-accent)'
                        }}
                      >
                        <Plus className="w-3 h-3 inline mr-1" />
                        ADICIONAR
                      </button>
                    </div>

                    <div className="space-y-3">
                      {servicos.map((servico) => (
                        <div key={servico.id} className="premium-card p-4" style={{ borderColor: 'rgba(var(--accent-rgb), 0.251)' }}>
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
                                  type="text"
                                  inputMode="decimal"
                                  defaultValue={servico.valor_unitario}
                                  onPaste={(e) => {
                                    e.preventDefault();
                                    const pasted = e.clipboardData.getData('text');
                                    e.currentTarget.value = sanitizeGSPNValue(pasted);
                                  }}
                                  onBlur={async (e) => {
                                    const novoValor = parseFloat(sanitizeGSPNValue(e.target.value)) || 0;
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

                      <div className="premium-card p-4 bg-gradient-to-r from-[#00D4FF]/10 to-[#39FF14]/10" style={{ borderColor: 'var(--neon-green)' }}>
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
                                type="text"
                                inputMode="decimal"
                                value={pag.valor}
                                onChange={(e) => {
                                  const novosPagamentos = [...pagamentosTemporarios];
                                  novosPagamentos[index].valor = parseFloat(sanitizeGSPNValue(e.target.value)) || 0;
                                  setPagamentosTemporarios(novosPagamentos);
                                }}
                                onPaste={(e) => {
                                  e.preventDefault();
                                  const pasted = e.clipboardData.getData('text');
                                  const novosPagamentos = [...pagamentosTemporarios];
                                  novosPagamentos[index].valor = parseFloat(sanitizeGSPNValue(pasted)) || 0;
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
                              backgroundColor: 'rgba(var(--accent-rgb), 0.125)',
                              color: 'var(--text-accent)',
                              border: '1px solid rgba(var(--accent-rgb), 0.376)'
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
                      backgroundColor: tipoOS === 'LP' ? '#FFA50020' : 'rgba(var(--accent-rgb), 0.125)',
                      borderColor: tipoOS === 'LP' ? '#FFA500' : 'var(--text-accent)',
                      color: tipoOS === 'LP' ? '#FFA500' : 'var(--text-accent)'
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
                  backgroundColor: tipoOS === 'LP' ? '#FFA5001a' : 'rgba(var(--accent-rgb), 0.102)',
                  border: tipoOS === 'LP' ? '1px solid #FFA5004d' : '1px solid rgba(var(--accent-rgb), 0.302)'
                }}>
                  <h3 className="text-sm font-bold uppercase tracking-wider flex items-center gap-2" style={{
                    color: tipoOS === 'LP' ? '#FFA500' : 'var(--text-accent)'
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
            <div className="flex border-b" style={{ borderColor: os?.tipo_os === 'OW' ? 'rgba(var(--accent-rgb), 0.2)' : '#FFA50033' }}>
              {[
                { id: 'dados', label: 'Dados OS/Cliente', icon: User },
                { id: 'estoque', label: 'Estoque & Peças', icon: Package },
                ...(os?.tipo_os === 'OW' ? [{ id: 'servicos', label: 'Serviços', icon: Wrench }] : []),
                { id: 'checklist', label: 'Checklist', icon: CheckSquare },
                ...(os?.tipo_os === 'OW' ? [{ id: 'pagamento', label: 'Pagamento', icon: DollarSign }] : []),
                { id: 'nf', label: 'Nota Fiscal', icon: Receipt },
                ...(os?.tipo_atendimento === 'IH' ? [{ id: 'agendamento', label: 'Agendamento', icon: Calendar }] : []),
                { id: 'anexos', label: 'Anexos', icon: Paperclip },
                { id: 'comentarios', label: 'Comentários', icon: MessageSquare }
              ].map(({ id, label, icon: Icon }) => {
                const corPrimaria = os?.tipo_os === 'OW' ? 'var(--text-accent)' : '#FFA500';
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
                    background: os.tipo_os === 'OW' ? 'linear-gradient(to right, rgba(var(--accent-rgb), 0.102), rgba(var(--accent-rgb), 0.039))' : 'linear-gradient(to right, #FFA5001a, rgba(var(--accent-rgb), 0.039))',
                    borderLeftColor: os.tipo_os === 'OW' ? 'var(--text-accent)' : '#FFA500'
                  }}>
                    <h3 className="text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2" style={{
                      color: os.tipo_os === 'OW' ? 'var(--text-accent)' : '#FFA500'
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
                          <button
                            onClick={async () => {
                              const novoTipo = os.tipo_atendimento === 'IH' ? 'CI' : 'IH';
                              const { error } = await supabase.from('os').update({ tipo_atendimento: novoTipo }).eq('id', os.id);
                              if (!error) {
                                setOS({ ...os, tipo_atendimento: novoTipo });
                                if (novoTipo !== 'IH' && abaAtiva === 'agendamento') setAbaAtiva('dados');
                              }
                            }}
                            className="px-2 py-1 rounded text-xs font-medium flex items-center gap-1 transition-all duration-200"
                            style={{
                              background: 'rgba(var(--accent-rgb), 0.10)',
                              border: '1px solid rgba(var(--accent-rgb), 0.3)',
                              color: 'var(--text-accent)'
                            }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(var(--accent-rgb), 0.20)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(var(--accent-rgb), 0.10)'; }}
                            title={os.tipo_atendimento === 'IH' ? 'Converter para CI (Centro)' : 'Converter para IH (In-Home)'}
                          >
                            <RefreshCw className="w-3 h-3" />
                            {os.tipo_atendimento === 'IH' ? 'CI' : 'IH'}
                          </button>
                          <span
                            className="px-3 py-1 rounded text-xs font-bold"
                            style={{
                              backgroundColor: os.tipo_os === 'LP' ? '#FFA50030' : 'rgba(var(--accent-rgb), 0.188)',
                              color: os.tipo_os === 'LP' ? '#FFA500' : 'var(--text-accent)',
                              border: os.tipo_os === 'LP' ? '1px solid #FFA50060' : '1px solid rgba(var(--accent-rgb), 0.376)'
                            }}
                          >
                            {os.tipo_os}
                          </span>
                        </div>
                      </div>
                      {(os.tipo_orcamento === 'samsung_contigo' || os.tipo_orcamento === 'acessorios') && (
                        <div>
                          <label className="text-xs text-gray-500 uppercase">Tipo de Orçamento</label>
                          <div className="flex items-center gap-2 mt-1">
                            <span
                              className="px-3 py-1 rounded text-xs font-bold"
                              style={{
                                backgroundColor: os.tipo_orcamento === 'samsung_contigo' ? '#FFA50030' : 'rgba(var(--neon-green-rgb),0.15)',
                                color: os.tipo_orcamento === 'samsung_contigo' ? '#FFA500' : 'var(--neon-green)',
                                border: `1px solid ${os.tipo_orcamento === 'samsung_contigo' ? '#FFA50060' : 'rgba(var(--neon-green-rgb),0.35)'}`
                              }}
                            >
                              {os.tipo_orcamento === 'samsung_contigo' ? 'Samsung Contigo' : 'Acessórios'}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* OS Vinculadas (Grupo) */}
                  <div className="col-span-2">
                    <div className="premium-card p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Layers className="w-4 h-4 text-blue-400" />
                          <span className="text-xs text-gray-300 uppercase font-bold">OS Vinculadas</span>
                          {osVinculadasLP.length > 0 && (
                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                              {osVinculadasLP.length}
                            </span>
                          )}
                        </div>
                        <button
                          onClick={() => setShowVincularModalLP(true)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 transition-colors flex items-center gap-1.5"
                        >
                          <Link2 className="w-3 h-3" />
                          Vincular OS
                        </button>
                      </div>
                      {osVinculadasLP.length > 0 && (
                        <div className="space-y-2 mb-3">
                          {osVinculadasLP.map(osV => {
                            const isPrincipal = os && new Date(osV.created_at) < new Date(os.created_at);
                            return (
                              <div
                                key={osV.id}
                                className="flex items-center justify-between p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/20 hover:border-blue-500/40 transition-colors cursor-pointer"
                                onClick={() => setCurrentOsId(osV.id)}
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-xs font-bold text-white truncate">
                                      {osV.numero_os_samsung || osV.numero_os_interna || 'S/N'}
                                    </p>
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${isPrincipal ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'bg-gray-500/20 text-gray-300 border border-gray-500/30'}`}>
                                      {isPrincipal ? 'PRINCIPAL' : 'SECUNDARIA'}
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-gray-500">
                                    {osV.cliente_nome} {osV.aparelho_modelo ? `- ${osV.aparelho_modelo}` : ''}
                                    <span className="ml-1 text-gray-600">{osV.coluna_kanban?.replace(/_/g, ' ')}</span>
                                  </p>
                                </div>
                                <ChevronRight className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2" style={{
                      color: os.tipo_os === 'OW' ? 'var(--text-accent)' : '#FFA500'
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
                        {os.cliente_telefone ? (
                          <button
                            onClick={() => handlePhoneClick(os.cliente_telefone)}
                            disabled={loadingWhatsApp}
                            className="flex items-center gap-1.5 mt-1 px-2 py-1 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-lg text-sm text-green-400 transition-colors disabled:opacity-50"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>{os.cliente_telefone}</span>
                          </button>
                        ) : (
                          <p className="text-sm text-gray-300 mt-1">-</p>
                        )}
                      </div>
                      <div>
                        <label className="text-xs text-gray-500 uppercase">Telefone 2</label>
                        {os.cliente_telefone_2 ? (
                          <button
                            onClick={() => handlePhoneClick(os.cliente_telefone_2)}
                            disabled={loadingWhatsApp}
                            className="flex items-center gap-1.5 mt-1 px-2 py-1 bg-green-500/10 hover:bg-green-500/20 border border-green-500/30 rounded-lg text-sm text-green-400 transition-colors disabled:opacity-50"
                          >
                            <Phone className="w-3.5 h-3.5" />
                            <span>{os.cliente_telefone_2}</span>
                          </button>
                        ) : (
                          <p className="text-sm text-gray-300 mt-1">-</p>
                        )}
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
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              Cidade
                              <button
                                onClick={() => {
                                  setMostrarEditarRotaCidade(true);
                                  setMostrarSelecionarRotaObrigatoria(true);
                                }}
                                className="ml-1 text-blue-400 hover:text-blue-300 transition-colors"
                                title="Editar cidade e rota"
                              >
                                <Pencil className="w-3 h-3" />
                              </button>
                            </p>
                            <p className="text-sm text-gray-300">{normalizarCidade(os.cliente_cidade) || '-'}
                              {(() => {
                                const rotaAtual = rotasUnidade.find(r => r.id === os.rota_id);
                                if (rotaAtual) return <span className="ml-1.5 text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: `${(rotaAtual as any).cor || '#666'}25`, color: (rotaAtual as any).cor || '#999' }}>{rotaAtual.nome}</span>;
                                return null;
                              })()}
                            </p>
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
                      color: os.tipo_os === 'OW' ? 'var(--text-accent)' : '#FFA500'
                    }}>
                      Aparelho
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs uppercase text-gray-500">
                          Linha
                        </label>
                        <select
                          value={os.aparelho_linha || ''}
                          onChange={async (e) => {
                            const novaLinha = e.target.value || null;
                            setOS({ ...os, aparelho_linha: novaLinha });
                            const { error } = await supabase
                              .from('os')
                              .update({ aparelho_linha: novaLinha })
                              .eq('id', os.id);
                            if (!error && onReload) onReload();
                          }}
                          className="neon-input w-full mt-1 text-sm"
                        >
                          <option value="">Selecione a linha...</option>
                          <option value="DA - WSM / Kitchen">DA - WSM / Kitchen</option>
                          <option value="DA - REF / Ar Condicionado">DA - REF / Ar Condicionado</option>
                          <option value="DTV - TV">DTV - TV</option>
                          <option value="DTV - Monitor / SoundBar">DTV - Monitor / SoundBar</option>
                          <option value="MX - Celular">MX - Celular</option>
                          <option value="MX - Notebook">MX - Notebook</option>
                          <option value="MX - Watch / Wearables">MX - Watch / Wearables</option>
                          <option value="MX - Tablet">MX - Tablet</option>
                        </select>
                        {!os.aparelho_linha && (
                          <p className="text-xs text-blue-400 mt-1 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            Necessário para filtrar serviços disponíveis
                          </p>
                        )}
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

                  {os.tipo_os === 'LP' && os.tipo_orcamento !== 'samsung_contigo' && os.tipo_orcamento !== 'acessorios' && (
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
                          backgroundColor: 'rgba(var(--accent-rgb), 0.125)',
                          borderColor: 'var(--text-accent)',
                          color: 'var(--text-accent)'
                        }}
                      >
                        CONVERTER PARA OW
                      </button>
                    </div>
                  </div>
                  )}
                </div>
              )}

              {abaAtiva === 'estoque' && (
                <div className="space-y-6">
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
                                  const isSCACCView = modoSCACC || os?.tipo_orcamento === 'samsung_contigo' || os?.tipo_orcamento === 'acessorios';
                                  if ((os?.tipo_os === 'OW' || isSCACCView) && sugestao.valor_com_markup) {
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
                                    {(os?.tipo_os === 'OW' || modoSCACC || os?.tipo_orcamento === 'samsung_contigo' || os?.tipo_orcamento === 'acessorios') && sugestao.valor_com_markup ? (
                                      <span className="text-xs px-2 py-0.5 rounded font-bold" style={{
                                        backgroundColor: 'rgba(var(--neon-green-rgb),0.1)',
                                        color: 'var(--neon-green)',
                                        border: '1px solid rgba(var(--neon-green-rgb),0.25)'
                                      }}>
                                        R$ {sugestao.valor_com_markup.toFixed(2)}
                                      </span>
                                    ) : (
                                      <span className="text-xs px-2 py-0.5 rounded" style={{
                                        backgroundColor: sugestao.count > 0 ? 'rgba(var(--neon-green-rgb),0.1)' : '#FF006420',
                                        color: sugestao.count > 0 ? 'var(--neon-green)' : '#FF0064',
                                        border: `1px solid ${sugestao.count > 0 ? 'rgba(var(--neon-green-rgb),0.25)' : '#FF006440'}`
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
                          <div className="flex-1">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={novaPecaValor}
                              onChange={(e) => setNovaPecaValor(e.target.value)}
                              onPaste={(e) => {
                                e.preventDefault();
                                const pasted = e.clipboardData.getData('text');
                                setNovaPecaValor(sanitizeGSPNValue(pasted));
                              }}
                              onBlur={() => {
                                if (novaPecaValor) setNovaPecaValor(sanitizeGSPNValue(novaPecaValor));
                              }}
                              className="neon-input w-full"
                              placeholder="0.00"
                            />
                            {novaPecaValorComMarkup !== null && (
                              <p className="text-xs mt-1" style={{ color: '#FFA500' }}>
                                c/ Markup: R$ {novaPecaValorComMarkup.toFixed(2)}
                              </p>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              if (!novaPecaCodigo || !novaPecaDescricao) {
                                alert('Preencha código e descrição');
                                return;
                              }

                              setDadosRequisicaoManual({
                                codigo: novaPecaCodigo,
                                descricao: novaPecaDescricao,
                                quantidade: novaPecaQuantidade,
                                valor: novaPecaValorComMarkup !== null ? novaPecaValorComMarkup.toFixed(2) : novaPecaValor
                              });
                              setMostrarConfirmacaoRequisicaoManual(true);
                            }}
                            className="neon-button px-4 py-2 flex-1 text-xs"
                            style={{
                              backgroundColor: 'rgba(var(--accent-rgb), 0.125)',
                              borderColor: 'var(--text-accent)',
                              color: 'var(--text-accent)'
                            }}
                          >
                            REQUISITAR
                          </button>
                        </div>
                      </div>
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
                                valor_total: (r.valor_peca || 0) * r.quantidade_requisitada,
                                exibir_no_pdf: r.exibir_no_pdf !== false
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
                                    <div className="flex items-center gap-3 mt-1">
                                      <p className="text-xs text-gray-500">Código: {peca.codigo || peca.pn || 'N/A'}</p>
                                      {requisicao?.peca_estoque?.id_numerico && (
                                        <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(var(--neon-green-rgb),0.1)', color: 'var(--neon-green)', border: '1px solid rgba(var(--neon-green-rgb),0.3)' }}>
                                          ID #{requisicao.peca_estoque.id_numerico}
                                        </span>
                                      )}
                                      {requisicao?.is_lote && requisicao?.pecas_lote?.length > 0 && (
                                        <div className="flex flex-wrap gap-1">
                                          {requisicao.pecas_lote.map((pl: any) => (
                                            <span key={pl.id} className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: 'rgba(var(--neon-green-rgb),0.1)', color: 'var(--neon-green)', border: '1px solid rgba(var(--neon-green-rgb),0.3)' }}>
                                              ID #{pl.id_numerico}
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-4 mt-2 flex-wrap">
                                      <p className="text-xs text-gray-500">Qtd: {peca.quantidade}</p>
                                      {peca.valor_gspn && (
                                        <p className="text-xs" style={{ color: '#9333EA' }}>
                                          GSPN: R$ {Number(peca.valor_gspn || 0).toFixed(2)}
                                        </p>
                                      )}
                                      {peca.valor_com_markup && peca.valor_com_markup !== peca.valor_gspn && (
                                        <p className="text-xs" style={{ color: 'var(--text-accent)' }}>
                                          c/ Markup: R$ {Number(peca.valor_com_markup || 0).toFixed(2)}
                                        </p>
                                      )}
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500">Unit: R$</span>
                                        <input
                                          type="text"
                                          inputMode="decimal"
                                          defaultValue={Number(peca.valor_unitario || 0).toFixed(2)}
                                          onPaste={(e) => {
                                            e.preventDefault();
                                            const pasted = e.clipboardData.getData('text');
                                            e.currentTarget.value = sanitizeGSPNValue(pasted);
                                          }}
                                          onBlur={async (e) => {
                                            const novoValor = parseFloat(sanitizeGSPNValue(e.target.value)) || 0;
                                            if (novoValor === peca.valor_unitario) return;

                                            try {
                                              // Se for de uma requisição, atualiza o valor_peca na tabela requisicoes_pecas
                                              if (requisicao) {
                                                await supabase
                                                  .from('requisicoes_pecas')
                                                  .update({ valor_peca: novoValor })
                                                  .eq('id', requisicao.id);
                                              }
                                              // Se for de os_pecas, atualiza o valor_unitario
                                              else if (tipo === 'os_peca') {
                                                await supabase
                                                  .from('os_pecas')
                                                  .update({
                                                    valor_unitario: novoValor,
                                                    valor_total: novoValor * peca.quantidade
                                                  })
                                                  .eq('id', peca.id);
                                              }
                                              // Se for de cotação, atualiza o valor_final_unitario
                                              else if (tipo === 'cotacao') {
                                                await supabase
                                                  .from('cotacoes_pecas')
                                                  .update({ valor_final_unitario: novoValor })
                                                  .eq('id', peca.id);
                                              }

                                              // Recarrega dados
                                              await loadPecas();
                                            } catch (error) {
                                              alert('Erro ao atualizar valor da peça');
                                            }
                                          }}
                                          className="w-20 px-2 py-1 text-xs rounded bg-gray-800 border border-gray-700 text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                                        />
                                      </div>
                                      <p className="text-xs font-bold text-[#39FF14]">
                                        Total: R$ {Number(peca.valor_total || 0).toFixed(2)}
                                      </p>
                                      <div
                                        className="flex items-center gap-2 cursor-pointer"
                                        onClick={async () => {
                                          const currentValue = peca.exibir_no_pdf !== false;
                                          const newValue = !currentValue;

                                          try {
                                            if (requisicao) {
                                              await supabase
                                                .from('requisicoes_pecas')
                                                .update({ exibir_no_pdf: newValue })
                                                .eq('id', requisicao.id);
                                            } else if (tipo === 'os_peca') {
                                              await supabase
                                                .from('os_pecas')
                                                .update({ exibir_no_pdf: newValue })
                                                .eq('id', peca.id);
                                            } else if (tipo === 'cotacao') {
                                              await supabase
                                                .from('cotacoes_pecas')
                                                .update({ exibir_no_pdf: newValue })
                                                .eq('id', peca.id);
                                            }
                                            await loadPecas();
                                          } catch (error) {
                                            // ignored
                                          }
                                        }}
                                      >
                                        <div className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
                                          peca.exibir_no_pdf !== false ? 'bg-[#00D4FF]' : 'bg-gray-600'
                                        }`}>
                                          <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                                            peca.exibir_no_pdf !== false ? 'translate-x-5' : 'translate-x-0.5'
                                          }`} />
                                        </div>
                                        <span className="text-xs text-gray-400">EXIBIR NO PDF</span>
                                      </div>
                                    </div>
                                    {(requisicao || requisicaoDevolvida) && (
                                      <p className="text-xs text-gray-500 mt-2">
                                        Requisitado em: {new Date((requisicao || requisicaoDevolvida)!.created_at).toLocaleString('pt-BR')}
                                      </p>
                                    )}
                                    {requisicao?.status === 'pedido_feito' && (
                                      <div className="mt-3 p-3 rounded-lg" style={{
                                        backgroundColor: 'rgba(var(--accent-rgb), 0.063)',
                                        border: '1px solid rgba(var(--accent-rgb), 0.376)'
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

                                      // Construir texto do título com IDs das peças
                                      const getTituloDevolucao = () => {
                                        if (!reqComDevolucao) return '';

                                        const statusText = reqComDevolucao.status === 'devolucao_pendente' ? 'DEVOLUÇÃO SOLICITADA' : 'DEVOLVIDA';
                                        const tipoText = reqComDevolucao.tipo_devolucao === 'nova' ? 'NOVA' :
                                                         reqComDevolucao.tipo_devolucao === 'nova_com_defeito' ? 'COM DEFEITO' : 'USADA';

                                        // Se for lote, construir texto com IDs
                                        if (reqComDevolucao.is_lote && reqComDevolucao.pecas_lote && reqComDevolucao.pecas_lote.length > 0) {
                                          const ids = reqComDevolucao.pecas_lote.map((p: any) => `#${p.id_numerico}`).join(' e ID ');
                                          const pecaOuPecas = reqComDevolucao.pecas_lote.length > 1 ? 'PEÇAS' : 'PEÇA';
                                          return `${pecaOuPecas} ID ${ids} ${reqComDevolucao.pecas_lote.length > 1 ? statusText.replace('SOLICITADA', 'SOLICITADAS').replace('DEVOLVIDA', 'DEVOLVIDAS') : statusText} - ${tipoText}`;
                                        } else if (reqComDevolucao.is_lote && reqComDevolucao.pecas_estoque_ids && reqComDevolucao.pecas_estoque_ids.length > 0) {
                                          const pecaOuPecas = reqComDevolucao.pecas_estoque_ids.length > 1 ? 'PEÇAS' : 'PEÇA';
                                          return `${pecaOuPecas} (${reqComDevolucao.pecas_estoque_ids.length} IDs) ${reqComDevolucao.pecas_estoque_ids.length > 1 ? statusText.replace('SOLICITADA', 'SOLICITADAS').replace('DEVOLVIDA', 'DEVOLVIDAS') : statusText} - ${tipoText}`;
                                        } else if (reqComDevolucao.peca_estoque?.id_numerico) {
                                          return `PEÇA ID #${reqComDevolucao.peca_estoque.id_numerico} ${statusText} - ${tipoText}`;
                                        }

                                        return `PEÇA ${statusText} - ${tipoText}`;
                                      };

                                      return reqComDevolucao && reqComDevolucao.motivo_devolucao && (
                                        <div className="mt-3 p-3 rounded-lg" style={{
                                          backgroundColor: reqComDevolucao.tipo_devolucao === 'nova_com_defeito' ? '#FF006410' : reqComDevolucao.tipo_devolucao === 'nova' ? 'rgba(var(--neon-green-rgb),0.06)' : '#FFBF0010',
                                          border: reqComDevolucao.tipo_devolucao === 'nova_com_defeito' ? '1px solid #FF006460' : reqComDevolucao.tipo_devolucao === 'nova' ? '1px solid rgba(var(--neon-green-rgb),0.35)' : '1px solid #FFBF0060'
                                        }}>
                                          <div className="flex items-start gap-2">
                                            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{
                                              color: reqComDevolucao.tipo_devolucao === 'nova_com_defeito' ? '#FF0064' : reqComDevolucao.tipo_devolucao === 'nova' ? 'var(--neon-green)' : '#FFBF00'
                                            }} />
                                            <div className="flex-1">
                                              <p className="text-xs font-bold mb-1" style={{
                                                color: reqComDevolucao.tipo_devolucao === 'nova_com_defeito' ? '#FF0064' : reqComDevolucao.tipo_devolucao === 'nova' ? 'var(--neon-green)' : '#FFBF00'
                                              }}>
                                                {getTituloDevolucao()}
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
                                    {!requisicao && !requisicaoDevolvida && (
                                      <>
                                      <button
                                        onClick={() => {
                                          handleRequisitarPeca(peca);
                                        }}
                                        className="neon-button flex items-center gap-2 text-xs px-4 py-2"
                                      >
                                        <Send className="w-3 h-3" />
                                        REQUISITAR
                                      </button>
                                      <button
                                        onClick={() => handleExcluirPeca(peca, tipo)}
                                        className="neon-button flex items-center gap-2 text-xs px-4 py-2"
                                        style={{
                                          backgroundColor: '#FF006410',
                                          borderColor: '#FF0064',
                                          color: '#FF0064'
                                        }}
                                      >
                                        <Trash2 className="w-3 h-3" />
                                        EXCLUIR
                                      </button>
                                      </>
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

                                    {(() => {
                                      // Verificar se há peças sem GI (para lotes) ou se o status indica sem GI
                                      const temPecasSemGI = requisicao?.is_lote
                                        ? requisicao?.pecas_lote?.some((p: any) => !p.gi_postada_em)
                                        : (requisicao?.status === 'atendida' || requisicao?.status === 'em_uso');

                                      // Verificar se há peças com GI (para lotes) ou se o status indica com GI
                                      const temPecasComGI = requisicao?.is_lote
                                        ? requisicao?.pecas_lote?.some((p: any) => p.gi_postada_em)
                                        : requisicao?.status === 'gi_postada';

                                      return (
                                        <>
                                          {temPecasSemGI && (
                                            <>
                                              <button
                                                onClick={() => handlePostarGI(requisicao)}
                                                className="neon-button flex items-center gap-2 text-xs px-4 py-2"
                                                style={{
                                                  backgroundColor: 'rgba(var(--neon-green-rgb),0.06)',
                                                  borderColor: 'var(--neon-green)',
                                                  color: 'var(--neon-green)'
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

                                          {temPecasComGI && (
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
                                        </>
                                      );
                                    })()}

                                    {requisicaoDevolvida?.status === 'reprovada' && !temNovaRequisicaoPendente && (
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

                                    {requisicaoDevolvida?.status === 'devolvida' && !temNovaRequisicaoPendente && requisicaoDevolvida?.tipo_devolucao === 'usada' && (
                                      <button
                                        onClick={() => handleRequisitarNovamente(peca, requisicaoDevolvida)}
                                        className="neon-button flex items-center gap-2 text-xs px-4 py-2"
                                        style={{
                                          backgroundColor: 'rgba(var(--neon-green-rgb),0.1)',
                                          borderColor: 'var(--neon-green)',
                                          color: 'var(--neon-green)'
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
                          backgroundColor: 'rgba(var(--accent-rgb), 0.125)',
                          borderColor: 'var(--text-accent)',
                          color: 'var(--text-accent)'
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
                            backgroundColor: 'rgba(var(--accent-rgb), 0.125)',
                            borderColor: 'var(--text-accent)',
                            color: 'var(--text-accent)'
                          }}
                        >
                          <Plus className="w-3 h-3 inline mr-1" />
                          ADICIONAR
                        </button>
                      </div>

                      <div className="space-y-3">
                        {servicos.map((servico) => (
                          <div key={servico.id} className="premium-card p-4" style={{ borderColor: 'rgba(var(--accent-rgb), 0.251)' }}>
                            <div className="flex items-start gap-4">
                              <div className="flex-1">
                                <p className="text-sm font-bold text-[#00D4FF] mb-1">{servico.descricao || servico.codigo_servico}</p>
                                <p className="text-xs text-gray-500">Cod: {servico.codigo_servico}</p>
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
                                    type="text"
                                    inputMode="decimal"
                                    defaultValue={servico.valor_unitario}
                                    onPaste={(e) => {
                                      e.preventDefault();
                                      const pasted = e.clipboardData.getData('text');
                                      e.currentTarget.value = sanitizeGSPNValue(pasted);
                                    }}
                                    onBlur={async (e) => {
                                      const novoValor = parseFloat(sanitizeGSPNValue(e.target.value)) || 0;
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
                      </div>

                      <div className="premium-card p-4 bg-gradient-to-r from-[#00D4FF]/10 to-[#39FF14]/10" style={{ borderColor: 'var(--neon-green)' }}>
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-bold text-[#00D4FF] uppercase tracking-wider">Total de Servicos:</span>
                          <span className="text-2xl font-bold text-[#39FF14]">
                            R$ {servicos.reduce((sum, s) => sum + (s.valor_total || 0), 0).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </>
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

              {abaAtiva === 'nf' && (
                <OSNotaFiscalTab
                  osId={os.id}
                  clienteNome={os.cliente_nome || ''}
                  clienteDocumento={os.cliente_documento}
                  clienteTelefone={os.cliente_telefone}
                  clienteEmail={os.cliente_email}
                  clienteEndereco={os.cliente_endereco}
                  unidadeId={os.unidade_id}
                  valorServicos={os.valor_servicos || 0}
                  valorPecas={os.valor_pecas || 0}
                  valorTotal={os.valor_total || 0}
                  valorPago={os.valor_pago || 0}
                  valorDesconto={os.valor_desconto || 0}
                  tipoOs={os.tipo_os}
                  isCortesia={os.is_cortesia}
                  onReload={loadOS}
                />
              )}

              {abaAtiva === 'anexos' && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider" style={{
                      color: os.tipo_os === 'OW' ? 'var(--text-accent)' : '#FFA500'
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
                      {anexos.map((anexo) => {
                        const isGSPN = anexo.origem === 'gspn_sync' || !!anexo.gspn_fileobjkey;

                        return (
                          <div key={anexo.id} className="premium-card p-4">
                            <div className="flex items-start justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="text-sm text-gray-300">{anexo.nome_arquivo}</p>
                                  {isGSPN && (
                                    <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded" style={{
                                      backgroundColor: '#9D4EDD20',
                                      color: '#9D4EDD',
                                      border: '1px solid #9D4EDD'
                                    }}>
                                      GSPN
                                    </span>
                                  )}
                                </div>
                                <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500">
                                  <span>{((anexo.tamanho_bytes || 0) / 1024).toFixed(2)} KB</span>
                                  <span className="text-gray-600">|</span>
                                  <span>{anexo.created_at ? new Date(anexo.created_at).toLocaleDateString('pt-BR') : '-'}</span>
                                  <span>{anexo.created_at ? new Date(anexo.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                                  <span className="text-gray-600">|</span>
                                  <span>{anexo.usuario?.nome || 'Sistema'}</span>
                                  {anexo.descricao && (
                                    <>
                                      <span className="text-gray-600">|</span>
                                      <span className="text-gray-400">{anexo.descricao}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-2">
                                <div
                                  className="flex items-center gap-2 cursor-pointer"
                                  onClick={async () => {
                                    const currentValue = anexo.exibir_no_pdf !== false;
                                    const newValue = !currentValue;
                                    try {
                                      await supabase
                                        .from('os_anexos')
                                        .update({ exibir_no_pdf: newValue })
                                        .eq('id', anexo.id);
                                      await loadAnexos();
                                    } catch (error) {
                                      // ignored
                                    }
                                  }}
                                >
                                  <div className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${
                                    anexo.exibir_no_pdf !== false ? 'bg-[#00D4FF]' : 'bg-gray-600'
                                  }`}>
                                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform duration-200 ${
                                      anexo.exibir_no_pdf !== false ? 'translate-x-5' : 'translate-x-0.5'
                                    }`} />
                                  </div>
                                  <span className="text-xs text-gray-400">EXIBIR NO PDF</span>
                                </div>
                                <button
                                  onClick={() => handleAbrirAnexo(anexo)}
                                  className="neon-button flex items-center gap-2 text-xs px-3 py-1.5"
                                  style={{
                                    backgroundColor: 'rgba(var(--accent-rgb), 0.063)',
                                    borderColor: 'var(--text-accent)',
                                    color: 'var(--text-accent)'
                                  }}
                                  title="Abrir anexo"
                                >
                                  <Upload className="w-3 h-3 rotate-180" />
                                  Abrir
                                </button>
                                {!isGSPN && (
                                  <button
                                    onClick={() => handleExcluirAnexo(anexo)}
                                    className="neon-button flex items-center gap-2 text-xs px-3 py-1.5"
                                    style={{
                                      backgroundColor: '#FF006410',
                                      borderColor: '#FF0064',
                                      color: '#FF0064'
                                    }}
                                    title="Excluir anexo"
                                  >
                                    <Trash2 className="w-3 h-3" />
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

              {abaAtiva === 'comentarios' && (
                <div>
                  <div className="mb-4">
                    <h3 className="text-sm font-bold uppercase tracking-wider mb-4" style={{
                      color: os.tipo_os === 'OW' ? 'var(--text-accent)' : '#FFA500'
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
                        onChange={(e) => {
                          const val = e.target.checked;
                          setMostrarComentariosSistema(val);
                          if (usuario?.id) {
                            supabase
                              .from('usuarios')
                              .update({ mostrar_comentarios_sistema: val })
                              .eq('id', usuario.id)
                              .then();
                          }
                        }}
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
          <div className="p-6 border-t" style={{ borderColor: tipoOS === 'LP' ? '#FFA50033' : 'rgba(var(--accent-rgb), 0.2)' }}>
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
                onClick={async () => {
                  const temDados = pecasAdicionadas.length > 0 || servicosAdicionados.length > 0 || requisicoesTemporarias.length > 0 || pagamentosTemporarios.length > 0 || checklistsSelecionados.length > 0 || anexosTemporarios.length > 0 || comentariosTemporarios.length > 0 || clienteNome || defeitoRelatado;
                  if (temDados) {
                    const confirmar = await showConfirm('Confirmar Cancelamento', 'Tem certeza que deseja cancelar? Todos os dados preenchidos serão perdidos.');
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
                  backgroundColor: tipoOS === 'LP' ? '#FFA50020' : 'rgba(var(--accent-rgb), 0.125)',
                  borderColor: tipoOS === 'LP' ? '#FFA500' : 'var(--text-accent)',
                  color: tipoOS === 'LP' ? '#FFA500' : 'var(--text-accent)'
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
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
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
                    backgroundColor: 'rgba(var(--accent-rgb), 0.125)',
                    borderColor: 'var(--text-accent)',
                    color: 'var(--text-accent)'
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
          isLote={requisicaoSelecionada.is_lote}
          pecasLote={requisicaoSelecionada.pecas_lote}
        />
      )}

      {mostrarModalCancelarGI && requisicaoCancelarGI && (
        <CancelarGIModal
          isOpen={mostrarModalCancelarGI}
          onClose={() => {
            setMostrarModalCancelarGI(false);
            setRequisicaoCancelarGI(null);
          }}
          onConfirm={handleConfirmarCancelarGI}
          requisicao={{
            codigo_peca: requisicaoCancelarGI.codigo_peca,
            descricao: requisicaoCancelarGI.descricao
          }}
          isLote={requisicaoCancelarGI.is_lote}
          pecasLote={requisicaoCancelarGI.pecas_lote}
        />
      )}

      {mostrarModalServico && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setMostrarModalServico(false)}></div>
          <div className="relative bg-[#0A0F1E] border border-[#00D4FF]/30 rounded-xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col" style={{
            boxShadow: '0 0 40px rgba(var(--accent-rgb),0.2)'
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
                  servico.nome?.toLowerCase().includes(buscaServico.toLowerCase()) ||
                  servico.descricao?.toLowerCase().includes(buscaServico.toLowerCase())
                );

                const linhaAtual = currentMode === 'create' ? aparelhoLinha : os?.aparelho_linha;

                if (!linhaAtual) {
                  return (
                    <div className="text-center py-12">
                      <Wrench className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">Selecione a Linha do Aparelho</p>
                      <p className="text-gray-600 text-xs mt-2">
                        Na aba DADOS, selecione a linha do aparelho para ver os servicos disponiveis
                      </p>
                    </div>
                  );
                }

                if (servicosFiltrados.length === 0) {
                  return (
                    <div className="text-center py-12">
                      <Wrench className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                      <p className="text-gray-500 text-sm">
                        {buscaServico ? 'Nenhum servico encontrado' : `Nenhum servico cadastrado para ${linhaAtual}`}
                      </p>
                      <p className="text-gray-600 text-xs mt-2">
                        {buscaServico ? 'Tente outro termo de busca' : 'Cadastre serviços para esta linha em Configurações'}
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
                                  id: servico.id,
                                  codigo: servico.codigo,
                                  descricao: servico.descricao || servico.nome,
                                  valor_unitario: Number(servico.valor_base) || 0,
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
                                const valorBase = Number(servico.valor_base) || 0;
                                await supabase
                                  .from('os_servicos')
                                  .insert({
                                    os_id: currentOsId,
                                    codigo_servico: servico.codigo,
                                    descricao: servico.nome || servico.descricao,
                                    valor_unitario: valorBase,
                                    quantidade: 1,
                                    valor_total: valorBase
                                  });
                              }
                              loadServicos();
                            }
                            setBuscaServico('');
                            setMostrarModalServico(false);
                          }}
                          className="premium-card p-4 cursor-pointer transition-all hover:scale-[1.01] hover:border-[#00D4FF]"
                          style={{
                            borderColor: jaAdicionado ? 'rgba(var(--neon-green-rgb),0.35)' : 'rgba(var(--accent-rgb), 0.251)',
                            backgroundColor: jaAdicionado ? 'rgba(var(--neon-green-rgb),0.05)' : 'rgba(var(--accent-rgb),0.05)'
                          }}
                        >
                          <div className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-bold text-[#00D4FF]">{servico.nome || servico.codigo}</span>
                                {jaAdicionado && (
                                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/40">
                                    JA ADICIONADO
                                  </span>
                                )}
                              </div>
                              {servico.descricao && (
                                <p className="text-sm text-gray-300 line-clamp-2">{servico.descricao}</p>
                              )}
                              <p className="text-xs text-gray-500 mt-1">Cod: {servico.codigo}</p>
                            </div>
                            <div className="flex-shrink-0 text-right">
                              <p className="text-lg font-bold text-[#39FF14]">
                                R$ {Number(servico.valor_base || 0).toFixed(2)}
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
                      R$ {(pecasAdicionadas.reduce((sum, p) => sum + (p.valor * (p.quantidade || 1)), 0) + servicosAdicionados.reduce((sum, s) => sum + (s.valor_unitario * s.quantidade), 0)).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Saldo Restante</p>
                    <p className="text-[#FFBF00] font-bold text-2xl">
                      R$ {(pecasAdicionadas.reduce((sum, p) => sum + (p.valor * (p.quantidade || 1)), 0) + servicosAdicionados.reduce((sum, s) => sum + (s.valor_unitario * s.quantidade), 0) - pagamentosTemporarios.reduce((sum, p) => sum + p.valor, 0)).toFixed(2)}
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
                    type="text"
                    inputMode="decimal"
                    value={novoPagamentoValor}
                    onChange={(e) => setNovoPagamentoValor(e.target.value)}
                    onPaste={(e) => {
                      e.preventDefault();
                      const pasted = e.clipboardData.getData('text');
                      setNovoPagamentoValor(sanitizeGSPNValue(pasted));
                    }}
                    onBlur={() => {
                      if (novoPagamentoValor) setNovoPagamentoValor(sanitizeGSPNValue(novoPagamentoValor));
                    }}
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

                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-400 uppercase mb-2 tracking-wider">
                          Taxa de Cartão (%) {taxasMaquina.length > 0 && '- Automático'}
                        </label>
                        <div className="relative">
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            max="100"
                            value={novoPagamentoTaxa}
                            onChange={(e) => setNovoPagamentoTaxa(e.target.value)}
                            readOnly={taxasMaquina.length > 0}
                            className={`neon-input ${taxasMaquina.length > 0 ? 'bg-gray-900/50 cursor-not-allowed' : ''}`}
                          />
                          {parseFloat(novoPagamentoTaxa) > 0 && (
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[#FFBF00] font-bold">
                              {novoPagamentoTaxa}%
                            </div>
                          )}
                        </div>
                      </div>

                      <div>
                        <label className="block text-xs text-gray-400 uppercase mb-2 tracking-wider">
                          Quem Paga a Taxa?
                        </label>
                        <select
                          value={novoPagamentoTaxaPagaPor}
                          onChange={(e) => setNovoPagamentoTaxaPagaPor(e.target.value as 'cliente' | 'empresa')}
                          className="neon-input"
                          disabled={parseFloat(novoPagamentoTaxa) === 0}
                        >
                          <option value="empresa">🏢 Empresa absorve</option>
                          <option value="cliente">👤 Cliente paga</option>
                        </select>
                      </div>
                    </div>

                    {parseFloat(novoPagamentoTaxa) > 0 && parseFloat(sanitizeGSPNValue(novoPagamentoValor)) > 0 && (
                      <div className="premium-card p-4 bg-gradient-to-br from-[#FFBF00]/20 to-transparent border-2 border-[#FFBF00]/40">
                        <div className="grid grid-cols-3 gap-4 text-center">
                          <div>
                            <p className="text-xs text-gray-400 uppercase mb-1">Taxa (%)</p>
                            <p className="text-[#FFBF00] font-bold text-xl" style={{ textShadow: '0 0 10px rgba(255, 191, 0, 0.5)' }}>
                              {novoPagamentoTaxa}%
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 uppercase mb-1">Desconto (R$)</p>
                            <p className="text-[#FF0064] font-bold text-xl" style={{ textShadow: '0 0 10px rgba(255, 0, 100, 0.5)' }}>
                              - R$ {calcularTaxaValor().toFixed(2)}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 uppercase mb-1">Você Recebe</p>
                            <p className="text-[#39FF14] font-bold text-xl" style={{ textShadow: '0 0 10px rgba(var(--neon-green-rgb),0.5)' }}>
                              R$ {calcularValorLiquido().toFixed(2)}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {parseFloat(novoPagamentoTaxa) > 0 && novoPagamentoTaxaPagaPor === 'empresa' && parseFloat(sanitizeGSPNValue(novoPagamentoValor)) > 0 && (
                      <div className="flex items-start gap-2 p-3 rounded-lg bg-[#FFBF00]/10 border border-[#FFBF00]/30">
                        <AlertCircle className="w-4 h-4 text-[#FFBF00] flex-shrink-0 mt-0.5" />
                        <p className="text-xs text-[#FFBF00]">
                          A empresa absorverá R$ {calcularTaxaValor().toFixed(2)} de taxa, reduzindo o lucro desta OS
                        </p>
                      </div>
                    )}
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
                  const valorNum = parseFloat(sanitizeGSPNValue(novoPagamentoValor));
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
                  backgroundColor: 'rgba(var(--neon-green-rgb),0.1)',
                  color: 'var(--neon-green)',
                  border: '1px solid rgba(var(--neon-green-rgb),0.35)'
                }}
              >
                <Save className="w-5 h-5" />
                REGISTRAR PAGAMENTO
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarModalSucesso && dadosOSCriada && (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-[100]">
          <div className="bg-[#0a0a0a] border border-[#39FF1440] rounded-lg p-8 max-w-md w-full mx-4 relative animate-fade-in">
            <div className="flex flex-col items-center text-center">
              <div className="w-20 h-20 rounded-full bg-[#39FF1420] border-2 border-[#39FF14] flex items-center justify-center mb-6">
                <CheckCircle className="w-12 h-12 text-[#39FF14]" />
              </div>

              <h2 className="text-2xl font-bold text-[#39FF14] mb-2">
                OS Criada com Sucesso!
              </h2>

              <div className="space-y-3 my-6 w-full">
                {dadosOSCriada.numeroInterna && (
                  <div className="bg-[#39FF1410] border border-[#39FF1430] rounded-lg p-4">
                    <p className="text-gray-400 text-sm mb-1">OS Interna</p>
                    <p className="text-[#39FF14] text-xl font-bold">
                      {dadosOSCriada.numeroInterna}
                    </p>
                  </div>
                )}

                {dadosOSCriada.numeroSamsung && (
                  <div className="bg-[#39FF1410] border border-[#39FF1430] rounded-lg p-4">
                    <p className="text-gray-400 text-sm mb-1">OS Samsung</p>
                    <p className="text-[#39FF14] text-xl font-bold">
                      {dadosOSCriada.numeroSamsung}
                    </p>
                  </div>
                )}
              </div>

              <button
                onClick={() => {
                  setMostrarModalSucesso(false);
                  setDadosOSCriada(null);
                }}
                className="w-full py-3 px-6 rounded-lg font-bold transition-all duration-200 hover:scale-105"
                style={{
                  backgroundColor: 'rgba(var(--neon-green-rgb),0.1)',
                  color: 'var(--neon-green)',
                  border: '1px solid var(--neon-green)'
                }}
              >
                FECHAR
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarConfirmacaoMover && colunaDestino && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[60] p-4" onClick={e => e.stopPropagation()}>
          <div className="premium-card w-full max-w-md">
            <div className="p-6 border-b border-[#00D4FF]/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#00D4FF]/20 to-[#7B2FFF]/20 flex items-center justify-center">
                  <MoveHorizontal className="w-5 h-5 text-[#00D4FF]" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Confirmar Movimentação</h3>
                  <p className="text-xs text-gray-400">Verifique o destino antes de prosseguir</p>
                </div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-3">
                <div className="p-4 rounded-lg bg-[#00D4FF]/5 border border-[#00D4FF]/20">
                  <p className="text-xs text-gray-400 mb-1">De:</p>
                  <p className="text-sm font-medium text-white">
                    {COLUNAS_KANBAN.find(c => c.id === os?.coluna_kanban)?.label || 'N/A'}
                  </p>
                </div>

                <div className="flex items-center justify-center">
                  <MoveHorizontal className="w-5 h-5 text-[#00D4FF]" />
                </div>

                <div className="p-4 rounded-lg bg-gradient-to-br from-[#00D4FF]/10 to-[#7B2FFF]/10 border border-[#00D4FF]/30">
                  <p className="text-xs text-gray-400 mb-1">Para:</p>
                  <p className="text-base font-bold text-[#00D4FF]">
                    {colunaDestino.label}
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20">
                <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-200">
                  Esta ação irá mover a OS para a coluna selecionada
                </p>
              </div>
            </div>

            <div className="p-6 border-t border-[#00D4FF]/20 flex gap-3">
              <button
                onClick={() => {
                  setMostrarConfirmacaoMover(false);
                  setColunaDestino(null);
                }}
                disabled={movendoOS}
                className="flex-1 px-4 py-2.5 rounded-lg bg-white/5 hover:bg-white/10 text-white font-medium transition-all disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={async () => {
                  await moverOS(colunaDestino.id);
                  setMostrarConfirmacaoMover(false);
                  setColunaDestino(null);
                }}
                disabled={movendoOS}
                className="flex-1 px-4 py-2.5 rounded-lg bg-gradient-to-r from-[#00D4FF] to-[#7B2FFF] hover:shadow-lg hover:shadow-[#00D4FF]/50 text-white font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {movendoOS ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Movendo...
                  </>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    Confirmar
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <RouteSelectionModal
        isOpen={mostrarSelecionarRotaObrigatoria && !!os}
        cidade={os?.cliente_cidade || ''}
        clienteNome={os?.cliente_nome}
        osNumero={os?.numero_os_samsung || os?.numero_os_interna || 'S/N'}
        clienteBairro={os?.cliente_bairro}
        rotas={rotasUnidade}
        onSelectRoute={async (rotaColumn, cidadeCorrigida) => {
          if (!os) return;
          const rotaColorMap: Record<string, { nome: string; cor: string }> = {
            'rota_preta': { nome: 'Rota Preta', cor: '#1a1a1a' },
            'rota_vermelha': { nome: 'Rota Vermelha', cor: '#EF4444' },
            'rota_azul': { nome: 'Rota Azul', cor: '#3B82F6' },
            'rota_verde': { nome: 'Rota Verde', cor: '#10B981' },
            'rota_rosa': { nome: 'Rota Rosa', cor: '#EC4899' },
            'rota_amarela': { nome: 'Rota Amarela', cor: '#EAB308' },
            'rota_laranja': { nome: 'Rota Laranja', cor: '#F97316' },
          };

          const cidadeOS = cidadeCorrigida && cidadeCorrigida.trim() !== '' ? cidadeCorrigida.trim() : os.cliente_cidade;
          let rotaSelecionada = rotasUnidade.find(r => r.coluna_kanban === rotaColumn);
          let rotaIdReal = rotaSelecionada?.id || null;

          try {
            if (!rotaSelecionada && os.unidade_id) {
              const rotaInfo = rotaColorMap[rotaColumn];
              const cidadesIniciais = cidadeOS ? [cidadeOS] : [];
              const { data: novaRota, error: errCriar } = await supabase
                .from('rotas')
                .insert({
                  nome: rotaInfo.nome,
                  cor: rotaInfo.cor,
                  coluna_kanban: rotaColumn,
                  cidades: cidadesIniciais,
                  ativa: true,
                  unidade_id: os.unidade_id
                })
                .select()
                .single();

              if (!errCriar && novaRota) {
                rotaSelecionada = novaRota;
                rotaIdReal = novaRota.id;
                setRotasUnidade(prev => [...prev, novaRota]);
              }
            } else if (cidadeOS && rotaSelecionada) {
              const cidadeNormalizada = normalizeCidade(cidadeOS);
              const cidadesNormalizadas = rotaSelecionada.cidades.map(c => normalizeCidade(c));

              if (!cidadesNormalizadas.includes(cidadeNormalizada)) {
                const novasCidades = [...rotaSelecionada.cidades, cidadeOS];
                await supabase
                  .from('rotas')
                  .update({ cidades: novasCidades })
                  .eq('id', rotaSelecionada.id);
                setRotasUnidade(prev => prev.map(r =>
                  r.id === rotaSelecionada!.id ? { ...r, cidades: novasCidades } : r
                ));
              }
            }

            const updateData: Record<string, any> = { rota_id: rotaIdReal };
            if (cidadeCorrigida && cidadeCorrigida.trim() !== '' && cidadeCorrigida !== os.cliente_cidade) {
              updateData.cliente_cidade = cidadeCorrigida.trim();
            }
            await supabase.from('os').update(updateData).eq('id', os.id);
            setOS({ ...os, ...updateData });

            setMostrarSelecionarRotaObrigatoria(false);
            if (!mostrarEditarRotaCidade && colunaDestinoAposSelecionarRota) {
              setColunaDestino(colunaDestinoAposSelecionarRota);
              setColunaDestinoAposSelecionarRota(null);
              setMostrarConfirmacaoMover(true);
            }
            setMostrarEditarRotaCidade(false);
            if (onReload) onReload();
          } catch (error: any) {
            alert(`Erro ao definir rota: ${error.message}`);
          }
        }}
        onCancel={() => {
          setMostrarSelecionarRotaObrigatoria(false);
          setMostrarEditarRotaCidade(false);
          setColunaDestinoAposSelecionarRota(null);
        }}
      />

      {/* WhatsApp Loading/Error Indicator */}
      {(loadingWhatsApp || whatsAppError) && (
        <div className="fixed bottom-4 right-4 z-[70]">
          {loadingWhatsApp && (
            <div className="flex items-center gap-2 px-4 py-3 bg-[#1A1A2E] border border-green-500/30 rounded-xl shadow-lg">
              <Loader2 className="w-5 h-5 text-green-400 animate-spin" />
              <span className="text-sm text-white">Verificando WhatsApp...</span>
            </div>
          )}
          {whatsAppError && (
            <div className="flex items-center gap-2 px-4 py-3 bg-[#1A1A2E] border border-red-500/30 rounded-xl shadow-lg">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <span className="text-sm text-red-400">{whatsAppError}</span>
              <button
                onClick={() => setWhatsAppError(null)}
                className="p-1 hover:bg-white/10 rounded"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          )}
        </div>
      )}

      {/* WhatsApp Chat Panel */}
      <AnimatePresence>
        {showWhatsAppChat && whatsAppConversa && os && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[70]"
              onClick={() => {
                setShowWhatsAppChat(false);
                setWhatsAppConversa(null);
              }}
            />
            <motion.div
              initial={{ x: '100%', opacity: 0.8 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0.8 }}
              transition={{ type: 'spring', damping: 28, stiffness: 300, mass: 0.8 }}
              className="fixed top-0 right-0 bottom-0 z-[71] flex flex-col w-full sm:w-[480px] md:w-[560px] lg:w-[640px] shadow-2xl"
              style={{ background: '#0A0A16' }}
            >
              <div className="h-full flex overflow-hidden w-full">
                <AtomConnectChat
                  conversa={whatsAppConversa}
                  onClose={() => {
                    setShowWhatsAppChat(false);
                    setWhatsAppConversa(null);
                  }}
                  onUpdate={() => {}}
                  accentColor="#25D366"
                  unidadeId={os.unidade_id}
                  fillParent
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {mostrarConfirmacaoRequisicao && pecaParaRequisitar && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-4" onClick={e => e.stopPropagation()}>
          <div className="premium-card w-full max-w-lg">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-[#39FF14]/20 flex items-center justify-center">
                  <Package className="w-6 h-6 text-[#39FF14]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white">Confirmar Requisição</h3>
                  <p className="text-sm text-gray-400">Confirme a requisição desta peça</p>
                </div>
                <button
                  onClick={() => {
                    setMostrarConfirmacaoRequisicao(false);
                    setPecaParaRequisitar(null);
                  }}
                  disabled={requisitando}
                  className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-[#1A1A1A] rounded-lg p-4 mb-6 border border-[#39FF14]/20">
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-gray-400">Código</p>
                    <p className="text-white font-bold">{pecaParaRequisitar.codigo || pecaParaRequisitar.pn}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Descrição</p>
                    <p className="text-white">{pecaParaRequisitar.descricao}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Quantidade</p>
                    <p className="text-white font-bold">{pecaParaRequisitar.quantidade}x</p>
                  </div>
                </div>
              </div>

              <div className="bg-blue-500/10 rounded-lg p-4 mb-6 border border-blue-500/30">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white text-sm font-bold mb-1">Atenção</p>
                    <p className="text-gray-400 text-xs leading-relaxed">
                      Ao confirmar, a requisição será criada e a OS será movida para "Aguardando Peça".
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setMostrarConfirmacaoRequisicao(false);
                    setPecaParaRequisitar(null);
                  }}
                  disabled={requisitando}
                  className="flex-1 px-6 py-3 border border-gray-700 rounded-lg text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarRequisicao}
                  disabled={requisitando}
                  className="flex-1 px-6 py-3 rounded-lg font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, var(--neon-green) 0%, #00D4FF 100%)',
                    color: '#000'
                  }}
                >
                  {requisitando ? (
                    <>
                      <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      Requisitando...
                    </>
                  ) : (
                    <>
                      <Package className="w-5 h-5" />
                      Confirmar Requisição
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {mostrarConfirmacaoRequisicaoManual && dadosRequisicaoManual && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-4" onClick={e => e.stopPropagation()}>
          <div className="premium-card w-full max-w-lg">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-[#39FF14]/20 flex items-center justify-center">
                  <Plus className="w-6 h-6 text-[#39FF14]" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white">Adicionar Requisição</h3>
                  <p className="text-sm text-gray-400">Confirme a criação da requisição manual</p>
                </div>
                <button
                  onClick={() => {
                    setMostrarConfirmacaoRequisicaoManual(false);
                    setDadosRequisicaoManual(null);
                  }}
                  disabled={requisitandoManual}
                  className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-[#1A1A1A] rounded-lg p-4 mb-6 border border-[#39FF14]/20">
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-gray-400">Código</p>
                    <p className="text-white font-bold">{dadosRequisicaoManual.codigo}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Descrição</p>
                    <p className="text-white">{dadosRequisicaoManual.descricao}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-400">Quantidade</p>
                      <p className="text-white font-bold">{dadosRequisicaoManual.quantidade}x</p>
                    </div>
                    {dadosRequisicaoManual.valor && (
                      <div>
                        <p className="text-xs text-gray-400">Valor</p>
                        <p className="text-white font-bold">R$ {parseFloat(dadosRequisicaoManual.valor).toFixed(2)}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-blue-500/10 rounded-lg p-4 mb-6 border border-blue-500/30">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white text-sm font-bold mb-1">Atenção</p>
                    <p className="text-gray-400 text-xs leading-relaxed">
                      Esta requisição será adicionada manualmente à OS e um comentário será registrado no histórico.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setMostrarConfirmacaoRequisicaoManual(false);
                    setDadosRequisicaoManual(null);
                  }}
                  disabled={requisitandoManual}
                  className="flex-1 px-6 py-3 border border-gray-700 rounded-lg text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmarRequisicaoManual}
                  disabled={requisitandoManual}
                  className="flex-1 px-6 py-3 rounded-lg font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  style={{
                    background: 'linear-gradient(135deg, var(--neon-green) 0%, #00D4FF 100%)',
                    color: '#000'
                  }}
                >
                  {requisitandoManual ? (
                    <>
                      <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <Plus className="w-5 h-5" />
                      Adicionar Requisição
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {mostrarModalCancelarRequisicao && requisicaoParaCancelar && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-4" onClick={e => e.stopPropagation()}>
          <div className="premium-card w-full max-w-lg">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <X className="w-6 h-6 text-red-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white">Cancelar Requisição</h3>
                  <p className="text-sm text-gray-400">Informe o motivo do cancelamento</p>
                </div>
                <button
                  onClick={() => {
                    setMostrarModalCancelarRequisicao(false);
                    setRequisicaoParaCancelar(null);
                    setMotivoCancelamento('');
                  }}
                  disabled={cancelando}
                  className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-[#1A1A1A] rounded-lg p-4 mb-6 border border-red-500/20">
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-gray-400">Código</p>
                    <p className="text-white font-bold">{requisicaoParaCancelar.codigo_peca}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Descrição</p>
                    <p className="text-white">{requisicaoParaCancelar.descricao}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400">Status</p>
                    <p className="text-yellow-400 text-sm font-bold uppercase">{requisicaoParaCancelar.status}</p>
                  </div>
                </div>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-bold text-white mb-2">
                  Motivo do Cancelamento *
                </label>
                <textarea
                  value={motivoCancelamento}
                  onChange={(e) => setMotivoCancelamento(e.target.value)}
                  placeholder="Digite o motivo do cancelamento..."
                  rows={4}
                  disabled={cancelando}
                  className="w-full bg-[#1A1A1A] border border-[#39FF14]/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:border-[#39FF14] focus:outline-none disabled:opacity-50"
                />
              </div>

              <div className="bg-red-500/10 rounded-lg p-4 mb-6 border border-red-500/30">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white text-sm font-bold mb-1">Atenção</p>
                    <p className="text-gray-400 text-xs leading-relaxed">
                      Esta ação não pode ser desfeita. A requisição será marcada como cancelada e um comentário será registrado no histórico.
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setMostrarModalCancelarRequisicao(false);
                    setRequisicaoParaCancelar(null);
                    setMotivoCancelamento('');
                  }}
                  disabled={cancelando}
                  className="flex-1 px-6 py-3 border border-gray-700 rounded-lg text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
                >
                  Voltar
                </button>
                <button
                  onClick={confirmarCancelamento}
                  disabled={cancelando || !motivoCancelamento.trim()}
                  className="flex-1 px-6 py-3 rounded-lg font-bold transition-all disabled:opacity-50 flex items-center justify-center gap-2 bg-red-600 hover:bg-red-700 text-white"
                >
                  {cancelando ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Cancelando...
                    </>
                  ) : (
                    <>
                      <X className="w-5 h-5" />
                      Confirmar Cancelamento
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <SuccessModal
        isOpen={mostrarSucessoRequisicao}
        onClose={() => setMostrarSucessoRequisicao(false)}
        title="Requisição Criada!"
        message="A requisição foi criada com sucesso e a OS foi movida para 'Aguardando Peça'."
      />

      <SuccessModal
        isOpen={mostrarSucessoMover}
        onClose={() => {
          setMostrarSucessoMover(false);
          onClose();
        }}
        title="Sucesso"
        message="OS movida com sucesso!"
      />

      {os && (
        <VincularOSModal
          isOpen={showVincularModalLP}
          onClose={() => setShowVincularModalLP(false)}
          currentOS={os}
          onVinculado={async () => {
            loadOS();
            onReload?.();
          }}
        />
      )}
    </div>
  );
}
