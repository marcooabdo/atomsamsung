import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User, Package, FileText, MessageSquare, Paperclip, DollarSign, Wrench, Send, Trash2, CheckSquare, AlertCircle, AlertTriangle, Clock, QrCode, RefreshCw, Calendar, Microscope, MoveHorizontal, ChevronDown, Download, FileDown, XCircle, CheckCircle, Save, Receipt, Phone, Loader2, Star, Pencil, ShieldCheck, Layers, Link2, ChevronRight } from 'lucide-react';
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
import { OSChecklistTab } from './OSChecklistTab';
import { DevolucaoModal } from './DevolucaoModal';
import { CancelarGIModal } from './CancelarGIModal';
import { OSAgendamentoTab } from './OSAgendamentoTab';
import { OSPagamentoTab } from './OSPagamentoTab';
import { OSNotaFiscalTab } from './OSNotaFiscalTab';
import { AnexoPreviewModal } from './AnexoPreviewModal';
import { AnaliseConcluidaModal } from './AnaliseConcluidaModal';
import { IniciarReparoModal } from './IniciarReparoModal';
import { ReparoEfetuadoModal } from './ReparoEfetuadoModal';
import { GIModal } from './agendamento/GIModal';
import { AtomConnectChat } from './atomconnect/AtomConnectChat';
import { gerarRelatorioOS } from '../lib/relatorioOS';
import { gerarPDFOrdemServico } from '../lib/pdfOS';
import { SuccessModal } from './SuccessModal';
import { ConvertTipoOSModal } from './ConvertTipoOSModal';
import { FecharOSModal } from './FecharOSModal';
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
  { id: 'em_rota_ih', label: 'Agendado' },
  { id: 'saw', label: 'SAW' },
  { id: 'controle_qualidade', label: 'Controle de Qualidade / OQC' },
  { id: 'reparo_concluido', label: 'Reparo Concluído' },
  { id: 'aguardando_fechamento', label: 'Aguardando Fechamento' },
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
  is_lote?: boolean;
  pecas_estoque_ids?: string[];
  peca_estoque?: {
    id_numerico: number;
    delivery?: string | null;
  };
  pecas_lote?: Array<{
    id: string;
    id_numerico: number;
    valor_com_impostos: string;
    delivery: string | null;
  }>;
}

interface OSModalProps {
  osId: string | null;
  onClose: () => void;
  onReload?: () => void;
  onMoveOS?: (osId: string, fromColumn: string, toColumn: string) => void;
  mode?: 'view' | 'create';
  tipoOS?: 'OW' | 'NA';
  initialTab?: string;
}

type AbaAtiva = 'dados' | 'estoque' | 'checklist' | 'servicos' | 'pagamento' | 'nf' | 'anexos' | 'comentarios' | 'agendamento';

export function OSModal({ osId: propOsId, onClose, onReload, onMoveOS, mode = 'view', tipoOS = 'OW', initialTab }: OSModalProps) {
  const { usuario } = useAuth();
  const { showAlert } = useModal();
  const [navigatedOsId, setNavigatedOsId] = useState<string | null>(null);
  const osId = navigatedOsId || propOsId;
  const [os, setOS] = useState<OS | null>(null);

  useEffect(() => {
    setNavigatedOsId(null);
  }, [propOsId]);
  const [pecas, setPecas] = useState<OSPeca[]>([]);
  const [servicos, setServicos] = useState<any[]>([]);
  const [requisicoes, setRequisicoes] = useState<RequisicaoPeca[]>([]);
  const [comentarios, setComentarios] = useState<OSComentario[]>([]);
  const [anexos, setAnexos] = useState<OSAnexo[]>([]);
  const [anexoPreview, setAnexoPreview] = useState<OSAnexo | null>(null);
  const [pagamento, setPagamento] = useState<any>(null);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [checklistTemplates, setChecklistTemplates] = useState<any[]>([]);
  const [checklistsVinculados, setChecklistsVinculados] = useState<any[]>([]);
  const [showAddChecklistModal, setShowAddChecklistModal] = useState(false);
  const [novoComentario, setNovoComentario] = useState('');
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>((initialTab as AbaAtiva) || 'dados');
  const [loading, setLoading] = useState(true);
  const [refazendoOrcamento, setRefazendoOrcamento] = useState(false);
  const [mostrarComentariosSistema, setMostrarComentariosSistema] = useState(true);
  const [mostrarModalConversao, setMostrarModalConversao] = useState(false);
  const [motivoConversao, setMotivoConversao] = useState('');
  const [confirmaConversao, setConfirmaConversao] = useState(false);
  const [convertendo, setConvertendo] = useState(false);
  const [mostrarModalDevolucao, setMostrarModalDevolucao] = useState(false);
  const [requisicaoSelecionada, setRequisicaoSelecionada] = useState<RequisicaoPeca | null>(null);
  const [mostrarModalCancelarGI, setMostrarModalCancelarGI] = useState(false);
  const [requisicaoCancelarGI, setRequisicaoCancelarGI] = useState<RequisicaoPeca | null>(null);
  const [mostrarModalAnalise, setMostrarModalAnalise] = useState(false);
  const [mostrarModalGI, setMostrarModalGI] = useState(false);
  const [requisicaoGI, setRequisicaoGI] = useState<RequisicaoPeca | null>(null);
  const [mostrarModalIniciarReparo, setMostrarModalIniciarReparo] = useState(false);
  const [mostrarModalReparoEfetuado, setMostrarModalReparoEfetuado] = useState(false);
  const [editandoDiagnostico, setEditandoDiagnostico] = useState(false);
  const [diagnosticoTemp, setDiagnosticoTemp] = useState('');
  const [salvandoDiagnostico, setSalvandoDiagnostico] = useState(false);
  const [editandoReparo, setEditandoReparo] = useState(false);
  const [reparoTemp, setReparoTemp] = useState('');
  const [salvandoReparo, setSalvandoReparo] = useState(false);
  const [criandoRequisicao, setCriandoRequisicao] = useState(false);
  const [pecaRequisitandoId, setPecaRequisitandoId] = useState<string | null>(null);
  const [finalizandoAnalise, setFinalizandoAnalise] = useState(false);
  const [mostrarErroRequisicaoExistente, setMostrarErroRequisicaoExistente] = useState(false);
  const [erroRequisicaoInfo, setErroRequisicaoInfo] = useState<{ status: string; id: string } | null>(null);
  const [mostrarSucessoRequisicao, setMostrarSucessoRequisicao] = useState(false);
  const [mostrarErroRequisicao, setMostrarErroRequisicao] = useState(false);
  const [erroRequisicaoMsg, setErroRequisicaoMsg] = useState('');
  const [mostrarMoverPara, setMostrarMoverPara] = useState(false);
  const [mostrarFecharOS, setMostrarFecharOS] = useState(false);
  const [movendoOS, setMovendoOS] = useState(false);
  const [mostrarConfirmacaoMover, setMostrarConfirmacaoMover] = useState(false);
  const [colunaDestino, setColunaDestino] = useState<{ id: string; label: string } | null>(null);
  const [syncingGSPN, setSyncingGSPN] = useState(false);
  const [currentJob, setCurrentJob] = useState<any>(null);
  const [mostrarSucessoMover, setMostrarSucessoMover] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [, setTimeUpdate] = useState(0);
  const [showVincularModal, setShowVincularModal] = useState(false);
  const [osVinculadas, setOsVinculadas] = useState<any[]>([]);

  // Route validation states
  const [rotasUnidade, setRotasUnidade] = useState<Array<{ id: string; nome: string; cidades: string[]; coluna_kanban: string }>>([]);
  const [mostrarSelecionarRotaObrigatoria, setMostrarSelecionarRotaObrigatoria] = useState(false);
  const [colunaDestinoAposSelecionarRota, setColunaDestinoAposSelecionarRota] = useState<{ id: string; label: string } | null>(null);

  // Estados para WhatsApp Chat
  const [showWhatsAppChat, setShowWhatsAppChat] = useState(false);
  const [whatsAppConversa, setWhatsAppConversa] = useState<WhatsAppConversa | null>(null);
  const [loadingWhatsApp, setLoadingWhatsApp] = useState(false);
  const [whatsAppError, setWhatsAppError] = useState<string | null>(null);

  // Estado para editar numero_os_samsung
  const [editandoNumeroSamsung, setEditandoNumeroSamsung] = useState(false);
  const [numeroSamsungTemp, setNumeroSamsungTemp] = useState('');
  const [salvandoNumeroSamsung, setSalvandoNumeroSamsung] = useState(false);

  // Estados para adicionar serviço
  const [servicosCadastrados, setServicosCadastrados] = useState<any[]>([]);
  const [mostrarModalServico, setMostrarModalServico] = useState(false);
  const [buscaServico, setBuscaServico] = useState('');
  const [mostrarModalConvertTipo, setMostrarModalConvertTipo] = useState(false);
  const [servicosSalvos, setServicosSalvos] = useState(false);
  const [salvandoServicos, setSalvandoServicos] = useState(false);

  // Estados para adicionar peça manualmente (OW)
  const [novaPecaCodigoOW, setNovaPecaCodigoOW] = useState('');
  const [novaPecaDescricaoOW, setNovaPecaDescricaoOW] = useState('');
  const [novaPecaValorGSPN, setNovaPecaValorGSPN] = useState('');
  const [novaPecaQuantidadeOW, setNovaPecaQuantidadeOW] = useState(1);
  const [markups, setMarkups] = useState<any[]>([]);
  const [adicionandoPecaOW, setAdicionandoPecaOW] = useState(false);
  const [sugestoesPecasOW, setSugestoesPecasOW] = useState<Array<{
    pn: string;
    descricao: string;
    valor_com_impostos: number;
    valor_corrigido?: number;
    count: number;
  }>>([]);
  const [mostrarSugestoesOW, setMostrarSugestoesOW] = useState(false);

  // Estados para edição de valores GSPN
  const [editandoValorGSPN, setEditandoValorGSPN] = useState<Record<string, string>>({});
  const [salvandoValorGSPN, setSalvandoValorGSPN] = useState<Record<string, boolean>>({});
  const [editandoValorFinal, setEditandoValorFinal] = useState<Record<string, string>>({});
  const [editandoValorTotal, setEditandoValorTotal] = useState<Record<string, string>>({});

  // Estados para edição inline de valores de peças manuais
  const [editandoValorPeca, setEditandoValorPeca] = useState<Record<string, { unitario: string; quantidade: string }>>({});
  const [removendoPecaId, setRemovendoPecaId] = useState<string | null>(null);

  // Estados temporários para modo de criação
  const [dadosTemporarios, setDadosTemporarios] = useState({
    cliente_nome: '',
    cliente_telefone: '',
    cliente_telefone_2: '',
    cliente_cpf_cnpj: '',
    equipamento: '',
    modelo: '',
    imei: '',
    senha: '',
    defeito_reclamado: '',
    observacoes_internas: '',
    tipo_orcamento: 'normal' as 'normal' | 'garantia' | 'cortesia',
    cep: '',
    endereco: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
  });
  const [pecasTemporarias, setPecasTemporarias] = useState<Array<{
    codigo: string;
    descricao: string;
    valor: number;
  }>>([]);
  const [pagamentosTemporarios, setPagamentosTemporarios] = useState<Array<{
    forma_pagamento: string;
    valor: number;
    data_pagamento: string;
    observacoes?: string;
  }>>([]);
  const [comentariosTemporarios, setComentariosTemporarios] = useState<string[]>([]);
  const [anexosTemporarios, setAnexosTemporarios] = useState<Array<{
    file: File;
    nome: string;
  }>>([]);
  const [criandoOS, setCriandoOS] = useState(false);
  const [pendingUploadFile, setPendingUploadFile] = useState<File | null>(null);
  const [pendingUploadNome, setPendingUploadNome] = useState('');
  const [uploadingAnexo, setUploadingAnexo] = useState(false);

  const isSCACC = os?.tipo_orcamento === 'samsung_contigo' || os?.tipo_orcamento === 'acessorios';

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

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
    if (mode === 'view' && osId) {
      loadOS();
      loadPecas();
      loadServicos();
      loadRequisicoes();
      loadChecklist();
      loadComentarios();
      loadAnexos();
    } else if (mode === 'create') {
      setLoading(false);
    }
  }, [osId, mode]);

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

  // Mark comments as read when viewing comments tab
  useEffect(() => {
    if (abaAtiva === 'comentarios' && osId && usuario?.id) {
      supabase
        .from('os_comentarios_leitura')
        .upsert(
          { usuario_id: usuario.id, os_id: osId, last_read_at: new Date().toISOString() },
          { onConflict: 'usuario_id,os_id' }
        )
        .then();
    }
  }, [abaAtiva, osId, usuario?.id]);

  // Carrega markups quando a OS for carregada (para OW)
  useEffect(() => {
    if ((os?.tipo_os === 'OW' || os?.tipo_os === 'LP') && os?.unidade_id && os?.tipo_orcamento) {
      loadMarkups();
    }
  }, [os?.tipo_os, os?.unidade_id, os?.tipo_orcamento]);

  // Debounce para buscar sugestões de peças (OW)
  useEffect(() => {
    const timer = setTimeout(() => {
      if (novaPecaCodigoOW && (os?.tipo_os === 'OW' || os?.tipo_os === 'LP')) {
        buscarSugestoesPecasOW(novaPecaCodigoOW);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [novaPecaCodigoOW]);

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

  // Realtime subscription para comentários
  useEffect(() => {
    const channel = supabase
      .channel('os-comentarios-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'os_comentarios',
        filter: `os_id=eq.${osId}`
      }, () => {
        loadComentarios();
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
          cotacao:cotacoes!os_cotacao_id_fkey(numero_cotacao),
          tecnico_designado:usuarios!os_tecnico_designado_id_fkey(nome)
        `)
        .eq('id', osId)
        .single();

      if (error) throw error;
      setOS(data);

      if (data?.unidade_id) {
        loadRotasUnidade(data.unidade_id);
      }
      loadOsVinculadas(data?.grupo_os_id || null);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const loadOsVinculadas = async (grupoId: string | null) => {
    if (!grupoId || !osId) {
      setOsVinculadas([]);
      return;
    }
    const { data } = await supabase
      .from('os')
      .select('id, numero_os_samsung, numero_os_interna, cliente_nome, coluna_kanban, created_at, aparelho_modelo')
      .eq('grupo_os_id', grupoId)
      .neq('id', osId)
      .order('created_at', { ascending: false });
    setOsVinculadas(data || []);
  };

  const loadRotasUnidade = async (unidadeIdParam: string) => {
    try {
      const { data } = await supabase
        .from('rotas')
        .select('id, nome, cidades, coluna_kanban')
        .eq('unidade_id', unidadeIdParam)
        .eq('ativa', true);
      if (data) setRotasUnidade(data);
    } catch {}
  };

  const normalizeCidadeLocal = (cidade: string | null | undefined): string => {
    if (!cidade) return '';
    return cidade.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();
  };

  const findRotaByCidade = (cidade: string | null | undefined): { coluna: string; nome: string } | null => {
    if (!cidade) return null;
    const cidadeNormalizada = normalizeCidadeLocal(cidade);
    for (const rota of rotasUnidade) {
      const cidadesNormalizadas = rota.cidades.map(c => normalizeCidadeLocal(c));
      if (cidadesNormalizadas.includes(cidadeNormalizada)) {
        return { coluna: rota.coluna_kanban, nome: rota.nome };
      }
    }
    return null;
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
      // ignored
      return false;
    }
  };

  const handlePhoneClick = async (phone: string | null) => {
    if (!phone || !os) return;

    const formattedPhone = formatPhoneNumber(phone);
    if (formattedPhone.length < 10) {
      setWhatsAppError('Numero de telefone invalido');
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
    const [osPecasResult, cotacaoPecasResult, reqReprovadasResult] = await Promise.all([
      supabase
        .from('os_pecas')
        .select('*')
        .eq('os_id', osId)
        .order('created_at', { ascending: true }),
      supabase
        .from('cotacoes_pecas')
        .select('*')
        .eq('os_id', osId)
        .order('created_at', { ascending: true }),
      supabase
        .from('requisicoes_pecas')
        .select('codigo_peca, os_peca_id, cotacao_peca_id')
        .eq('os_id', osId)
        .eq('status', 'reprovada')
    ]);

    const reqReprovadas = reqReprovadasResult.data || [];
    const osPecaIdsReprovados = new Set(reqReprovadas.map((r: any) => r.os_peca_id).filter(Boolean));
    const cotacaoPecaIdsReprovados = new Set(reqReprovadas.map((r: any) => r.cotacao_peca_id).filter(Boolean));
    const pnsReprovadosSemVinculo = new Set(
      reqReprovadas.filter((r: any) => !r.os_peca_id && !r.cotacao_peca_id).map((r: any) => r.codigo_peca)
    );

    const cotacaoPecas = (cotacaoPecasResult.data || [])
      .filter(p => !cotacaoPecaIdsReprovados.has(p.id) && !pnsReprovadosSemVinculo.has(p.pn))
      .map(p => ({
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

    const osPecasFormatted = (osPecasResult.data || [])
      .filter((p: any) => {
        if (p.status === 'manual' || p.status === 'gspn') {
          return !osPecaIdsReprovados.has(p.id);
        }
        return !pnsReprovadosSemVinculo.has(p.pn);
      })
      .map(p => ({
        ...p,
        cotacao_peca_id: p.cotacao_peca_id || p.id
      }));

    const todasPecas = [...osPecasFormatted, ...cotacaoPecas];
    setPecas(todasPecas);
  };

  const loadServicos = async (resetSaved = false) => {
    const isSCACC = os?.tipo_orcamento === 'samsung_contigo' || os?.tipo_orcamento === 'acessorios';

    if (isSCACC) {
      const { data } = await supabase
        .from('os_servicos')
        .select(`
          *,
          servico:servicos(codigo, nome)
        `)
        .eq('os_id', osId)
        .order('created_at', { ascending: true });

      const servicosFormatados = (data || []).map(s => ({
        ...s,
        codigo_servico: s.servico?.codigo || s.codigo_servico || 'N/A',
        _table: 'os_servicos'
      }));

      setServicos(servicosFormatados);
    } else {
      const { data } = await supabase
        .from('cotacoes_servicos')
        .select(`
          *,
          servico:servicos(codigo, nome)
        `)
        .eq('os_id', osId)
        .order('created_at', { ascending: true });

      const servicosFormatados = (data || []).map(s => ({
        ...s,
        codigo_servico: s.servico?.codigo || 'N/A',
        _table: 'cotacoes_servicos'
      }));

      setServicos(servicosFormatados);
    }

    if (resetSaved) setServicosSalvos(false);
  };

  const loadServicosCadastrados = async () => {
    if (!os?.unidade_id || !os?.aparelho_linha) {
      setServicosCadastrados([]);
      return;
    }

    const { data } = await supabase
      .from('servicos')
      .select('*')
      .or(`unidade_id.eq.${os.unidade_id},unidade_id.is.null`)
      .eq('ativo', true)
      .eq('linha', os.aparelho_linha)
      .order('codigo', { ascending: true });

    setServicosCadastrados(data || []);
  };

  const handleSalvarServicos = async () => {
    setSalvandoServicos(true);
    try {
      // Os valores são calculados automaticamente pelos triggers do banco
      // Apenas recarregar a OS para pegar os valores atualizados
      await loadOS();
      onReload?.();
      setServicosSalvos(true);
    } catch (err: any) {
      showAlert({ message: 'Erro ao salvar servicos: ' + err.message, type: 'error' });
    } finally {
      setSalvandoServicos(false);
    }
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
        requisitado_por_usuario:usuarios!requisicoes_pecas_requisitado_por_fkey(nome),
        peca_estoque:estoque_pecas!requisicoes_pecas_peca_estoque_id_fkey(
          id_numerico,
          estoque_etiquetas(delivery)
        )
      `);

    if (osData?.cotacao_id) {
      // Busca por os_id OU cotacao_id
      query = query.or(`os_id.eq.${osId},cotacao_id.eq.${osData.cotacao_id}`);
    } else {
      // Se não tem cotação, busca apenas por os_id
      query = query.eq('os_id', osId);
    }

    const { data, error } = await query
      .neq('status', 'cancelada')
      .order('created_at', { ascending: false });

    if (error) {
      return;
    }

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

  const loadChecklist = async () => {
    // Carregar checklists vinculados
    const { data: vinculados } = await supabase
      .from('os_checklist_vinculados')
      .select(`
        *,
        checklist_template:checklist_templates(*)
      `)
      .eq('os_id', osId);

    setChecklistsVinculados(vinculados || []);

    // Carregar templates ADM disponíveis
    const { data: os } = await supabase
      .from('os')
      .select('tipo_os, tipo_atendimento, unidade_id')
      .eq('id', osId)
      .single();

    if (os) {
      const { data: templates } = await supabase
        .from('checklist_templates')
        .select('*')
        .eq('tipo_checklist', 'ADM')
        .eq('ativo', true)
        .or(`unidade_id.eq.${os.unidade_id},unidade_id.is.null`);

      setChecklistTemplates(templates || []);
    }
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

  const loadMarkups = async () => {
    if (!os?.unidade_id || !os?.tipo_orcamento) {
      setMarkups([]);
      return;
    }

    const { data, error } = await supabase
      .rpc('get_markup_for_unidade_and_tipo', {
        p_unidade_id: os.unidade_id,
        p_tipo_orcamento: os.tipo_orcamento
      });

    if (error) {
      setMarkups([]);
    } else {
      setMarkups(data || []);
    }
  };

  const calcularValorComMarkup = (valorGSPN: number): number => {
    // Validação de entrada
    if (isNaN(valorGSPN) || !isFinite(valorGSPN) || valorGSPN <= 0) {
      return 0;
    }

    // Se não há markups, retorna o valor original
    if (markups.length === 0) {
      return valorGSPN;
    }

    // Procura o markup aplicável
    const markupAplicavel = markups.find(m => {
      if (!m.ativo) return false;
      const dentroMin = m.valor_minimo === null || valorGSPN >= m.valor_minimo;
      const dentroMax = m.valor_maximo === null || valorGSPN <= m.valor_maximo;
      return dentroMin && dentroMax;
    });

    if (!markupAplicavel) {
      return valorGSPN;
    }

    // Aplicar markup baseado no tipo
    let valorFinal = valorGSPN;

    switch (markupAplicavel.tipo) {
      case 'percentual':
        valorFinal = valorGSPN * (1 + markupAplicavel.valor / 100);
        break;
      case 'multiplicador':
        valorFinal = valorGSPN * markupAplicavel.valor;
        break;
      case 'valor_fixo':
        valorFinal = valorGSPN + markupAplicavel.valor;
        break;
      default:
        valorFinal = valorGSPN;
    }

    return valorFinal;
  };

  const buscarSugestoesPecasOW = async (codigo: string) => {
    if (!codigo || codigo.length < 2) {
      setSugestoesPecasOW([]);
      setMostrarSugestoesOW(false);
      return;
    }

    try {
      const { data: pecasEstoque } = await supabase
        .from('estoque_pecas')
        .select('pn, descricao, valor_com_impostos')
        .eq('unidade_id', os?.unidade_id || usuario?.unidade_id)
        .ilike('pn', `%${codigo}%`)
        .order('data_entrada', { ascending: false })
        .limit(10);

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

      const sugestoesComValor = await Promise.all(
        Object.values(pecasAgrupadas).map(async (peca: any) => {
          const { data: pedido } = await supabase
            .from('estoque_pedidos')
            .select('valor_estimado')
            .eq('pn', peca.pn)
            .eq('unidade_id', os?.unidade_id || usuario?.unidade_id)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          return {
            ...peca,
            valor_corrigido: pedido?.valor_estimado || null
          };
        })
      );

      setSugestoesPecasOW(sugestoesComValor);
      setMostrarSugestoesOW(true);
    } catch (error) {
      setSugestoesPecasOW([]);
    }
  };

  const handleSalvarValorGSPN = async (pecaId: string) => {
    const valorEditado = editandoValorGSPN[pecaId];
    if (!valorEditado) {
      showAlert({ message: 'Digite um valor válido', type: 'warning' });
      return;
    }

    const valorNum = parseFloat(sanitizeGSPNValue(valorEditado));
    if (isNaN(valorNum) || valorNum <= 0) {
      showAlert({ message: 'Valor inválido', type: 'warning' });
      return;
    }

    setSalvandoValorGSPN(prev => ({ ...prev, [pecaId]: true }));

    try {
      const peca = pecas.find(p => p.id === pecaId);
      if (!peca) {
        throw new Error('Peça não encontrada');
      }

      // Calcula valores
      const valorGSPN = valorNum;
      const valorComMarkup = os?.tipo_os === 'OW' ? calcularValorComMarkup(valorGSPN) : valorGSPN;
      const valorTotal = valorComMarkup * Math.max(peca.quantidade || 1, 1);

      // Atualiza a peça (corrige quantidade 0 para 1 se necessário)
      const updatePayload: Record<string, any> = {
        valor_gspn: valorGSPN,
        valor_unitario: valorComMarkup,
        valor_total: valorTotal
      };
      if (!peca.quantidade || peca.quantidade === 0) {
        updatePayload.quantidade = 1;
      }
      const { error: updateError } = await supabase
        .from('os_pecas')
        .update(updatePayload)
        .eq('id', pecaId);

      if (updateError) throw updateError;

      // Registra no log
      await supabase.from('os_comentarios').insert({
        os_id: osId,
        usuario_id: usuario?.id,
        comentario: `💰 Valor GSPN definido para ${peca.descricao}: R$ ${valorGSPN.toFixed(2)} → Valor Final: R$ ${valorTotal.toFixed(2)}`,
        is_system: true
      });

      // Remove do estado de edição
      setEditandoValorGSPN(prev => {
        const novo = { ...prev };
        delete novo[pecaId];
        return novo;
      });

      await loadPecas();
      await loadComentarios();
      onReload?.();
    } catch (error) {
      showAlert({ message: 'Erro ao salvar valor GSPN', type: 'error' });
    } finally {
      setSalvandoValorGSPN(prev => ({ ...prev, [pecaId]: false }));
    }
  };

  const handleSalvarValorFinal = async (pecaId: string) => {
    const valorEditado = editandoValorFinal[pecaId];
    if (!valorEditado && valorEditado !== '0') return;

    const valorNum = parseFloat(sanitizeGSPNValue(valorEditado));
    if (isNaN(valorNum) || valorNum < 0) {
      showAlert({ message: 'Valor invalido', type: 'warning' });
      return;
    }

    try {
      const peca = pecas.find(p => p.id === pecaId);
      if (!peca) throw new Error('Peca nao encontrada');

      const valorTotal = valorNum * Math.max(peca.quantidade || 1, 1);

      const { error } = await supabase
        .from('os_pecas')
        .update({
          valor_unitario: valorNum,
          valor_total: valorTotal,
          editado_manualmente: true
        })
        .eq('id', pecaId);

      if (error) throw error;

      setEditandoValorFinal(prev => {
        const novo = { ...prev };
        delete novo[pecaId];
        return novo;
      });

      await loadPecas();
      await loadOS();
      onReload?.();
    } catch (error: any) {
      showAlert({ message: 'Erro ao salvar valor: ' + (error?.message || ''), type: 'error' });
    }
  };

  const handleSalvarValorTotal = async (pecaId: string) => {
    const valorEditado = editandoValorTotal[pecaId];
    if (!valorEditado && valorEditado !== '0') return;

    const valorNum = parseFloat(sanitizeGSPNValue(valorEditado));
    if (isNaN(valorNum) || valorNum < 0) {
      showAlert({ message: 'Valor total invalido', type: 'warning' });
      return;
    }

    try {
      const peca = pecas.find(p => p.id === pecaId);
      if (!peca) throw new Error('Peca nao encontrada');

      const qtd = Math.max(peca.quantidade || 1, 1);
      const novoUnitario = valorNum / qtd;

      const { error } = await supabase
        .from('os_pecas')
        .update({
          valor_unitario: novoUnitario,
          valor_total: valorNum
        })
        .eq('id', pecaId);

      if (error) throw error;

      setEditandoValorTotal(prev => {
        const novo = { ...prev };
        delete novo[pecaId];
        return novo;
      });

      await loadPecas();
      await loadOS();
      onReload?.();
    } catch (error: any) {
      showAlert({ message: 'Erro ao salvar valor total: ' + (error?.message || ''), type: 'error' });
    }
  };

  const handleRemoverPecaManual = async (peca: any) => {
    if (!peca || (peca.status !== 'manual' && !isSCACC)) return;
    setRemovendoPecaId(peca.id);
    try {
      const { error } = await supabase
        .from('os_pecas')
        .delete()
        .eq('id', peca.id);
      if (error) throw error;

      await supabase.from('os_comentarios').insert({
        os_id: osId,
        usuario_id: usuario?.id,
        comentario: `🗑️ Peça manual removida: ${peca.descricao}${peca.codigo ? ` (${peca.codigo})` : ''}`,
        is_system: true
      });

      await loadPecas();
      await loadComentarios();
      await loadOS();
    } catch (error: any) {
      showAlert({ message: 'Erro ao remover peça: ' + (error?.message || 'Erro desconhecido'), type: 'error' });
    } finally {
      setRemovendoPecaId(null);
    }
  };

  const handleSalvarValoresPecaManual = async (pecaId: string) => {
    const edicao = editandoValorPeca[pecaId];
    if (!edicao) return;

    const novoUnitario = parseFloat(sanitizeGSPNValue(edicao.unitario)) || 0;
    const novaQtd = parseInt(edicao.quantidade) || 1;

    try {
      const { error } = await supabase
        .from('os_pecas')
        .update({
          valor_unitario: novoUnitario,
          valor_total: novoUnitario * novaQtd,
          quantidade: novaQtd,
          type_unidade: 'UN'
        })
        .eq('id', pecaId);
      if (error) throw error;

      setEditandoValorPeca(prev => {
        const novo = { ...prev };
        delete novo[pecaId];
        return novo;
      });

      await loadPecas();
      await loadOS();
    } catch (error: any) {
      showAlert({ message: 'Erro ao salvar valores: ' + (error?.message || 'Erro desconhecido'), type: 'error' });
    }
  };

  const handleAdicionarPecaOW = async () => {
    if (!novaPecaCodigoOW.trim() || !novaPecaDescricaoOW.trim() || !novaPecaValorGSPN) {
      showAlert({ message: 'Preencha todos os campos obrigatorios', type: 'warning' });
      return;
    }

    const valorGSPNNum = parseFloat(sanitizeGSPNValue(novaPecaValorGSPN));
    if (isNaN(valorGSPNNum) || valorGSPNNum <= 0) {
      showAlert({ message: 'Valor invalido', type: 'warning' });
      return;
    }

    const isSCACC = os?.tipo_orcamento === 'samsung_contigo' || os?.tipo_orcamento === 'acessorios';

    setAdicionandoPecaOW(true);
    try {
      const valorComMarkup = calcularValorComMarkup(valorGSPNNum);
      const quantidade = novaPecaQuantidadeOW;
      const valorTotal = valorComMarkup * quantidade;

      const { error: insertError } = await supabase
        .from('os_pecas')
        .insert({
          os_id: osId,
          codigo: novaPecaCodigoOW.trim(),
          pn: novaPecaCodigoOW.trim(),
          descricao: novaPecaDescricaoOW.trim(),
          quantidade: quantidade,
          valor_gspn: valorGSPNNum,
          valor_unitario: valorComMarkup,
          valor_total: valorTotal,
          status: 'manual',
          numero_os_samsung: os?.numero_os_samsung,
          type_unidade: 'UN'
        });

      if (insertError) throw insertError;

      await supabase.from('os_comentarios').insert({
        os_id: osId,
        usuario_id: usuario?.id,
        comentario: `Peca adicionada manualmente: ${novaPecaDescricaoOW} (${novaPecaCodigoOW}) - Qtd: ${quantidade} - Valor Base: R$ ${valorGSPNNum.toFixed(2)} - Valor Final: R$ ${valorTotal.toFixed(2)}`,
        is_system: true
      });

      setNovaPecaCodigoOW('');
      setNovaPecaDescricaoOW('');
      setNovaPecaValorGSPN('');
      setNovaPecaQuantidadeOW(1);
      setSugestoesPecasOW([]);

      await loadPecas();
      await loadComentarios();
      onReload?.();
      showAlert({ message: `Peca adicionada com sucesso!${quantidade > 1 ? ` (${quantidade} unidades)` : ''}`, type: 'success' });
    } catch (error: any) {
      showAlert({ message: `Erro ao adicionar peca: ${error.message}`, type: 'error' });
    } finally {
      setAdicionandoPecaOW(false);
    }
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
      .select('*, usuario:usuarios(nome)')
      .or(`os_id.eq.${osId}${osData?.cotacao_id ? `,cotacao_id.eq.${osData.cotacao_id}` : ''}`)
      .order('created_at', { ascending: false });


    setAnexos(data || []);
  };

  const confirmarUploadAnexo = async () => {
    if (!pendingUploadFile || uploadingAnexo) return;
    setUploadingAnexo(true);
    try {
      const file = pendingUploadFile;
      const nomeExibicao = pendingUploadNome.trim() || file.name;
      const ext = file.name.split('.').pop() || '';
      const storageFileName = `${osId}/${Date.now()}_${nomeExibicao}${nomeExibicao.endsWith(`.${ext}`) ? '' : `.${ext}`}`;

      const { error: uploadError } = await supabase.storage
        .from('os-anexos')
        .upload(storageFileName, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('os-anexos')
        .getPublicUrl(storageFileName);

      const tipoArquivo = file.type.startsWith('image/') ? 'foto' :
                          file.type.startsWith('video/') ? 'video' : 'documento';

      const { error: insertError } = await supabase.from('os_anexos').insert({
        os_id: osId,
        nome_arquivo: nomeExibicao.endsWith(`.${ext}`) ? nomeExibicao : `${nomeExibicao}.${ext}`,
        url: publicUrl,
        tamanho_bytes: file.size,
        usuario_id: usuario?.id,
        tipo: tipoArquivo,
        descricao: pendingUploadNome.trim() || null
      });
      if (insertError) throw insertError;

      await supabase.from('os_comentarios').insert({
        os_id: osId,
        usuario_id: usuario?.id,
        comentario: `Anexo adicionado: ${nomeExibicao}`,
        is_system: true
      });

      setPendingUploadFile(null);
      setPendingUploadNome('');
      loadAnexos();
      loadComentarios();
    } catch (error: any) {
      showAlert({ message: `Erro ao adicionar anexo: ${error.message}`, type: 'error' });
    } finally {
      setUploadingAnexo(false);
    }
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
        return;
      }

      if (!unidadeData.samsung_asccode || !unidadeData.samsung_token) {
        showAlert({ message: 'Unidade sem configuração Samsung (ASC Code ou Token não configurados)', type: 'warning' });
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
        showAlert({ message: `Erro na sincronização: ${result.message || 'Erro desconhecido'}`, type: 'error' });
      }
    } catch (error) {
      showAlert({ message: `Erro ao sincronizar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`, type: 'error' });
    } finally {
      setSyncingGSPN(false);
    }
  };

  const salvarNumeroSamsung = async () => {
    if (!os || !osId) return;

    // Validação: não permitir para SC/ACC
    if (os.tipo_os === 'SC / ACC') {
      showAlert({ message: 'Não é possível adicionar número Samsung para OS do tipo SC / ACC', type: 'warning' });
      return;
    }

    if (!numeroSamsungTemp.trim()) {
      showAlert({ message: 'Digite um número de OS Samsung válido', type: 'warning' });
      return;
    }

    setSalvandoNumeroSamsung(true);
    try {
      const { error } = await supabase
        .from('os')
        .update({ numero_os_samsung: numeroSamsungTemp.trim() })
        .eq('id', osId);

      if (error) throw error;

      showAlert({ message: 'Número da OS Samsung atualizado com sucesso!', type: 'success' });
      setEditandoNumeroSamsung(false);
      await loadOS();
      if (onReload) onReload();
    } catch (error) {
      showAlert({ message: 'Erro ao salvar número da OS Samsung', type: 'error' });
    } finally {
      setSalvandoNumeroSamsung(false);
    }
  };

  const handleToggleCortesia = async () => {
    if (!os || !usuario) return;

    const novoStatus = !(os as any).is_cortesia;
    const motivo = prompt(
      novoStatus
        ? `Por favor, informe o MOTIVO para aplicar CORTESIA na OS ${os.numero_os_samsung || os.numero_os_interna}:`
        : `Por favor, informe o MOTIVO para REMOVER a CORTESIA da OS ${os.numero_os_samsung || os.numero_os_interna}:`
    );

    if (!motivo || motivo.trim() === '') {
      showAlert({ message: 'É obrigatório informar o motivo.', type: 'warning' });
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from('os')
        .update({
          is_cortesia: novoStatus,
          motivo_cortesia: novoStatus ? motivo.trim() : null
        })
        .eq('id', os.id);

      if (updateError) throw updateError;

      const { error: logError } = await supabase
        .from('os_audit_logs')
        .insert({
          os_id: os.id,
          tipo_alteracao: novoStatus ? 'cortesia_aplicada' : 'cortesia_removida',
          descricao: novoStatus
            ? `Cortesia aplicada. Motivo: ${motivo.trim()}`
            : `Cortesia removida. Motivo: ${motivo.trim()}`,
          valores_alterados: {
            is_cortesia: { old: !novoStatus, new: novoStatus },
            motivo_cortesia: { old: (os as any).motivo_cortesia, new: novoStatus ? motivo.trim() : null }
          }
        });

      // Criar comentário automático do sistema
      const dataHora = new Date().toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const comentarioTexto = novoStatus
        ? `🎁 CORTESIA APLICADA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 OS: ${os.numero_os_samsung || os.numero_os_interna}
👤 Aplicado por: ${usuario.nome}
📅 Data/Hora: ${dataHora}
💬 Motivo: ${motivo.trim()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️ Esta OS foi marcada como CORTESIA.
Não haverá cobrança ao cliente.`
        : `❌ CORTESIA REMOVIDA
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 OS: ${os.numero_os_samsung || os.numero_os_interna}
👤 Removido por: ${usuario.nome}
📅 Data/Hora: ${dataHora}
💬 Motivo: ${motivo.trim()}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ℹ️ A cortesia foi removida desta OS.`;

      const { error: comentarioError } = await supabase
        .from('os_comentarios')
        .insert({
          os_id: os.id,
          usuario_id: usuario.id,
          comentario: comentarioTexto,
          is_system: true
        });

      alert(novoStatus ? 'Cortesia aplicada com sucesso!' : 'Cortesia removida com sucesso!');
      await loadOS();
      await loadComentarios();
    } catch (error) {
      alert('Erro ao processar cortesia. Tente novamente.');
    }
  };

  const handleGerarPDFOS = () => {
    window.open(`/os/print?osId=${osId}`, '_blank');
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

      showAlert({ type: 'success', title: 'Sucesso', message: 'OS removida com sucesso! Orçamento disponível em Cotações para edição.' });
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
    const pecaId = peca.cotacao_peca_id || peca.id;
    setPecaRequisitandoId(pecaId);
    setCriandoRequisicao(true);

    try {
      // Para peças GSPN e manuais, cotacao_peca_id deve ser null (usam os_peca_id)
      const usaOsPecaId = peca.status === 'gspn' || peca.status === 'manual';
      const cotacaoPecaId = usaOsPecaId ? null : (peca.cotacao_peca_id || peca.id);

      // Verifica se já existe requisição ATIVA (qualquer status exceto reprovada e devolvida) para esta peça
      // Para GSPN/manual, verifica por os_peca_id; para outras, por cotacao_peca_id
      let query = supabase
        .from('requisicoes_pecas')
        .select('id, status')
        .eq('os_id', osId)
        .not('status', 'in', '(reprovada,devolvida)');

      if (usaOsPecaId) {
        // Para GSPN e manual, verifica pelo os_peca_id (ID único da peça)
        query = query.eq('os_peca_id', peca.id);
      } else {
        // Para peças normais, verifica pelo cotacao_peca_id
        query = query.eq('cotacao_peca_id', cotacaoPecaId);
      }

      const { data: existente } = await query.maybeSingle();

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
        setErroRequisicaoInfo({ status: statusLabel, id: existente.id.slice(0, 8) });
        setMostrarErroRequisicaoExistente(true);
        setPecaRequisitandoId(null);
        setCriandoRequisicao(false);
        return;
      }


      const { error: insertError } = await supabase
        .from('requisicoes_pecas')
        .insert({
          os_id: osId,
          cotacao_id: os?.cotacao_id || null,
          cotacao_peca_id: cotacaoPecaId, // null para GSPN/manual, ID válido para outras
          os_peca_id: usaOsPecaId ? peca.id : null, // ID único para GSPN e manual
          codigo_peca: peca.codigo || peca.pn || 'N/A',
          descricao: peca.descricao || 'Peça sem descrição',
          quantidade_requisitada: peca.quantidade || 1,
          status: 'pendente',
          requisitado_por: usuario?.id,
          numero_os_samsung: os?.numero_os_samsung || os?.numero_os_interna,
          unidade_id: os?.unidade_id
        });

      if (insertError) {
        throw insertError;
      }

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

      // Aguarda um breve momento para garantir que o banco processou tudo
      await new Promise(resolve => setTimeout(resolve, 200));

      // Recarregar dados (aguarda para garantir que o estado seja atualizado)
      await Promise.all([
        loadRequisicoes(),
        loadOS()
      ]);

      // Chama onReload se existir
      if (onReload) {
        await onReload();
      }

      setMostrarSucessoRequisicao(true);
    } catch (error: any) {
      const errorMsg = error?.message || 'Erro desconhecido';
      setErroRequisicaoMsg(errorMsg);
      setMostrarErroRequisicao(true);
    } finally {
      setPecaRequisitandoId(null);
      setCriandoRequisicao(false);
    }
  };

  const handleRequisitarNovamente = async (peca: OSPeca, requisicaoReprovada: any) => {
    const motivo = prompt('Informe o motivo para requisitar novamente esta peça:');
    if (!motivo || !motivo.trim()) {
      showAlert({ type: 'warning', title: 'Motivo Obrigatório', message: 'É necessário informar o motivo da nova requisição' });
      return;
    }

    setCriandoRequisicao(true);

    try {
      // Para peças GSPN e manuais, cotacao_peca_id deve ser null (usam os_peca_id)
      const usaOsPecaId = peca.status === 'gspn' || peca.status === 'manual';
      const cotacaoPecaId = usaOsPecaId ? null : (peca.cotacao_peca_id || peca.id);

      // Verifica se já existe requisição ATIVA (qualquer status exceto reprovada e devolvida)
      let queryExistente = supabase
        .from('requisicoes_pecas')
        .select('id, status')
        .eq('os_id', osId)
        .not('status', 'in', '(reprovada,devolvida)');

      if (usaOsPecaId) {
        // Para GSPN e manual, verifica pelo os_peca_id (ID único da peça)
        queryExistente = queryExistente.eq('os_peca_id', peca.id);
      } else {
        // Para peças normais, verifica pelo cotacao_peca_id
        queryExistente = queryExistente.eq('cotacao_peca_id', cotacaoPecaId);
      }

      const { data: existente } = await queryExistente.maybeSingle();

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
          cotacao_id: os?.cotacao_id || null,
          cotacao_peca_id: cotacaoPecaId, // null para GSPN/manual, ID válido para outras
          os_peca_id: usaOsPecaId ? peca.id : null, // ID único para GSPN e manual
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
      'Ao confirmar, a OS será movida para a aba Cotações como "Refazer Orçamento".\n\n' +
      'A cotação ficará marcada como "Análise feita pelo técnico" para facilitar o preenchimento.\n\n' +
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
        texto: `Análise técnica concluída por ${usuario?.nome}. Peças adicionadas pelo técnico - pronto para precificar.`,
        is_system: true
      });

      await supabase.from('os_comentarios').insert({
        os_id: osId,
        usuario_id: usuario?.id,
        comentario: `Análise técnica concluída por ${usuario?.nome}. OS enviada para precificação.`,
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
      alert(`Erro ao finalizar análise: ${error.message || 'Erro desconhecido'}`);
      setFinalizandoAnalise(false);
    }
  };

  const handlePostarGI = async (requisicao: RequisicaoPeca) => {
    // Se for lote ou se tiver mais de uma peça, abre o modal para selecionar
    if (requisicao.is_lote && requisicao.pecas_lote && requisicao.pecas_lote.length > 0) {
      setRequisicaoGI(requisicao);
      setMostrarModalGI(true);
      return;
    }

    // Se não for lote, faz o processo antigo (simples confirm)
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
      showAlert({ type: 'warning', title: 'Motivo Obrigatório', message: 'É necessário informar o motivo do cancelamento' });
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


      showAlert({ type: 'success', title: 'Sucesso', message: 'Requisição cancelada com sucesso!' });
      onReload?.();
    } catch (error) {
      alert(`Erro ao cancelar requisição: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  };

  const handleRemoverPeca = (requisicao: RequisicaoPeca) => {
    setRequisicaoSelecionada(requisicao);
    setMostrarModalDevolucao(true);
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

  const handleCancelarGI = (requisicao: RequisicaoPeca) => {
    setRequisicaoCancelarGI(requisicao);
    setMostrarModalCancelarGI(true);
  };

  const handleConfirmarCancelarGI = async (motivo: string, pecasSelecionadas?: string[]) => {
    if (!requisicaoCancelarGI) return;

    try {
      // Se for lote e tem peças selecionadas, processar apenas as selecionadas
      if (requisicaoCancelarGI.is_lote && pecasSelecionadas && pecasSelecionadas.length > 0) {
        // Atualizar status das peças selecionadas
        await supabase
          .from('estoque_pecas')
          .update({
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

        // Se NENHUMA peça tem GI postada, mudar status da requisição para "atendida"
        // Se ainda existem peças com GI, manter como "gi_postada"
        if (pecasComGI.length === 0) {
          // Todas as peças tiveram GI cancelada, atualizar requisição
          await supabase
            .from('requisicoes_pecas')
            .update({
              status: 'atendida',
              gi_postada_em: null
            })
            .eq('id', requisicaoCancelarGI.id);
        }

        const idsNumericos = requisicaoCancelarGI.pecas_lote
          ?.filter(p => pecasSelecionadas.includes(p.id))
          .map(p => `#${p.id_numerico}`)
          .join(', ');

        // Log com nome do usuário e motivo
        await supabase
          .from('os_comentarios')
          .insert({
            os_id: osId,
            usuario_id: usuario?.id,
            comentario: `GI cancelada por ${usuario?.nome}: ${requisicaoCancelarGI.descricao} (${requisicaoCancelarGI.codigo_peca}) - Lote IDs: ${idsNumericos}\nRequisição ID: ${requisicaoCancelarGI.id.slice(0, 8)}\nMotivo: ${motivo}`,
            is_system: true
          });

        // Log no histórico das peças
        for (const pecaId of pecasSelecionadas) {
          await supabase.from('estoque_historico').insert({
            peca_id: pecaId,
            usuario_id: usuario?.id,
            acao: 'gi_cancelada',
            status_anterior: 'vinculada_tecnico',
            status_novo: 'vinculada_tecnico',
            observacao: `GI cancelada por ${usuario?.nome} - Motivo: ${motivo}`
          });
        }
      } else {
        // Processo normal para peça única
        await supabase
          .from('requisicoes_pecas')
          .update({
            status: 'atendida',
            gi_postada_em: null
          })
          .eq('id', requisicaoCancelarGI.id);

        // Log com nome do usuário e motivo
        await supabase
          .from('os_comentarios')
          .insert({
            os_id: osId,
            usuario_id: usuario?.id,
            comentario: `GI cancelada por ${usuario?.nome}: ${requisicaoCancelarGI.descricao} (${requisicaoCancelarGI.codigo_peca})\nRequisição ID: ${requisicaoCancelarGI.id.slice(0, 8)}\nMotivo: ${motivo}`,
            is_system: true
          });

        // Log no histórico da peça
        if (requisicaoCancelarGI.peca_estoque_id) {
          await supabase.from('estoque_historico').insert({
            peca_id: requisicaoCancelarGI.peca_estoque_id,
            usuario_id: usuario?.id,
            acao: 'gi_cancelada',
            status_anterior: 'vinculada_tecnico',
            status_novo: 'vinculada_tecnico',
            observacao: `GI cancelada por ${usuario?.nome} - Motivo: ${motivo}`
          });
        }
      }

      alert('GI cancelada com sucesso!');

      // Recarregar dados
      await loadRequisicoes();
      await loadComentarios();

      // Recarregar Kanban
      if (onReload) {
        onReload();
      }

      setMostrarModalCancelarGI(false);
      setRequisicaoCancelarGI(null);
    } catch (error) {
      alert('Erro ao cancelar GI');
      throw error;
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

  const salvarDiagnostico = async () => {
    if (!os || salvandoDiagnostico) return;
    const texto = diagnosticoTemp.trim();
    if (!texto) return;

    setSalvandoDiagnostico(true);
    try {
      const { error: osError } = await supabase
        .from('os')
        .update({ diagnostico_tecnico: texto, updated_at: new Date().toISOString() })
        .eq('id', os.id);
      if (osError) throw osError;

      await supabase.from('os_comentarios').insert({
        os_id: os.id,
        usuario_id: usuario?.id,
        comentario: `**DIAGNOSTICO TECNICO (editado manualmente):**\n\n${texto}`,
        is_system: true
      });

      setOS({ ...os, diagnostico_tecnico: texto });
      setEditandoDiagnostico(false);
    } catch (error: any) {
      showAlert({ type: 'error', title: 'Erro ao Salvar', message: `Erro ao salvar: ${error.message}` });
    } finally {
      setSalvandoDiagnostico(false);
    }
  };

  const salvarReparo = async () => {
    if (!os || salvandoReparo) return;
    const texto = reparoTemp.trim();
    if (!texto) return;

    setSalvandoReparo(true);
    try {
      const { error: osError } = await supabase
        .from('os')
        .update({ reparo_efetuado: texto, updated_at: new Date().toISOString() })
        .eq('id', os.id);
      if (osError) throw osError;

      await supabase.from('os_comentarios').insert({
        os_id: os.id,
        usuario_id: usuario?.id,
        comentario: `**REPARO EFETUADO (editado manualmente):**\n\n${texto}`,
        is_system: true
      });

      setOS({ ...os, reparo_efetuado: texto });
      setEditandoReparo(false);
    } catch (error: any) {
      showAlert({ type: 'error', title: 'Erro ao Salvar', message: `Erro ao salvar: ${error.message}` });
    } finally {
      setSalvandoReparo(false);
    }
  };

  const moverOS = async (targetColumn: string, extraUpdates?: Record<string, any>) => {
    if (!os || movendoOS) return;

    if (targetColumn === 'controle_qualidade' && os.coluna_kanban !== 'controle_qualidade') {
      setMostrarMoverPara(false);
      setMostrarModalReparoEfetuado(true);
      return;
    }

    setMovendoOS(true);
    try {
      const { error } = await supabase
        .from('os')
        .update({
          coluna_kanban: targetColumn,
          bloqueio_movimentacao_automatica: true,
          updated_at: new Date().toISOString(),
          ...(extraUpdates || {})
        })
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

  const handleRouteSelectAndMove = async (rotaColumn: string, cidadeCorrigida: string) => {
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

    const cidadeOS = cidadeCorrigida || os.cliente_cidade;
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
        const cidadeNormalizada = normalizeCidadeLocal(cidadeOS);
        const cidadesNormalizadas = rotaSelecionada.cidades.map(c => normalizeCidadeLocal(c));

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

      setMostrarSelecionarRotaObrigatoria(false);

      if (colunaDestinoAposSelecionarRota) {
        const targetCol = colunaDestinoAposSelecionarRota;
        setColunaDestinoAposSelecionarRota(null);

        const extraUpdates: Record<string, any> = { rota_id: rotaIdReal };
        if (cidadeCorrigida && cidadeCorrigida.trim() !== '' && cidadeCorrigida !== os.cliente_cidade) {
          extraUpdates.cliente_cidade = cidadeCorrigida.trim();
        }

        await moverOS(targetCol.id, extraUpdates);
      }
    } catch (error: any) {
      alert(`Erro ao definir rota: ${error.message}`);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="futuristic-loader"></div>
      </div>
    );
  }

  if (!os && mode === 'view') return null;

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

  const colunaAtual = COLUNAS_KANBAN.find(c => c.id === os?.coluna_kanban);

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="premium-card w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-[#00D4FF]/20">
          <div>
            {(() => {
              const isSCACC = os?.tipo_orcamento === 'samsung_contigo' || os?.tipo_orcamento === 'acessorios';
              const headerColor = isSCACC ? '#39FF14' : 'var(--text-accent)';
              const headerText = mode === 'create'
                ? `NOVA ORDEM DE SERVICO - ${tipoOS}`
                : isSCACC
                  ? 'SC / ACC - Samsung Contigo / Acessorio'
                  : 'ORDEM DE SERVICO';
              return (
                <h2 className="tech-heading text-xl" style={{ color: headerColor }}>
                  {headerText}
                </h2>
              );
            })()}
            <p className="text-sm text-gray-400 mt-1">
              {mode === 'create' ? 'Preencha os dados abaixo' : (os?.numero_os_samsung || os?.numero_os_interna || 'N/A')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {mode === 'view' && (
              <>
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

                <button
                  onClick={() => setMostrarModalConvertTipo(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all hover:bg-purple-500/20"
                  style={{
                    background: 'linear-gradient(135deg, rgba(168,85,247,0.2) 0%, rgba(168,85,247,0.05) 100%)',
                    border: '1px solid #a855f7',
                    color: '#a855f7',
                    boxShadow: '0 0 10px rgba(168,85,247,0.2)'
                  }}
                  title="Converter Tipo de OS"
                >
                  <RefreshCw className="w-4 h-4" />
                  CONVERTER TIPO
                </button>

                {os.tipo_atendimento === 'CI' && os.tipo_orcamento !== 'samsung_contigo' && os.tipo_orcamento !== 'acessorios' && (
                  <div className="flex flex-col gap-1">
                    <button
                      onClick={() => setMostrarModalIniciarReparo(true)}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all hover:bg-[#00D4FF]/30"
                      style={{
                        background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.2) 0%, rgba(var(--accent-rgb),0.05) 100%)',
                        border: '1px solid var(--text-accent)',
                        color: 'var(--text-accent)',
                        boxShadow: '0 0 10px rgba(var(--accent-rgb),0.2)'
                      }}
                      title={os.tecnico_designado_id ? 'Alterar Técnico Responsável' : 'Iniciar Reparo e Designar Técnico'}
                    >
                      <Wrench className="w-4 h-4" />
                      {os.tecnico_designado_id ? 'ALTERAR TÉCNICO' : 'INICIAR REPARO'}
                    </button>
                    {os.tecnico_designado_id && os.tecnico_designado?.nome && (
                      <div className="text-xs text-center" style={{ color: 'var(--text-accent)' }}>
                        <User className="w-3 h-3 inline mr-1" />
                        {os.tecnico_designado.nome}
                      </div>
                    )}
                  </div>
                )}

                <div className="relative">
              <button
                onClick={() => setMostrarMoverPara(!mostrarMoverPara)}
                disabled={movendoOS}
                className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.2) 0%, rgba(var(--accent-rgb),0.05) 100%)',
                  border: '1px solid var(--text-accent)',
                  color: 'var(--text-accent)',
                  boxShadow: '0 0 10px rgba(var(--accent-rgb),0.2)'
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
                          if (coluna.id === 'os_fechada') {
                            setMostrarMoverPara(false);
                            setMostrarFecharOS(true);
                            return;
                          }

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
                        className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all hover:bg-[#00D4FF]/10 disabled:opacity-50"
                        style={{
                          color: '#fff',
                          border: '1px solid transparent'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--text-accent)';
                          e.currentTarget.style.boxShadow = '0 0 10px rgba(var(--accent-rgb),0.2)';
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

            <button
              onClick={() => setMostrarFecharOS(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all"
              style={{
                background: os.coluna_kanban === 'os_fechada'
                  ? 'rgba(57,255,20,0.1)'
                  : 'linear-gradient(135deg, rgba(255,0,100,0.15) 0%, rgba(255,107,53,0.08) 100%)',
                border: os.coluna_kanban === 'os_fechada'
                  ? '1px solid rgba(57,255,20,0.3)'
                  : '1px solid rgba(255,0,100,0.4)',
                color: os.coluna_kanban === 'os_fechada' ? '#39FF14' : '#FF0064',
                boxShadow: `0 0 10px ${os.coluna_kanban === 'os_fechada' ? 'rgba(57,255,20,0.15)' : 'rgba(255,0,100,0.15)'}`,
              }}
              title="Validar e fechar OS"
            >
              <ShieldCheck className="w-4 h-4" />
              FECHAR OS
            </button>

            {os?.numero_os_samsung && (
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
              </>
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
            ...(os.tipo_os === 'OW' || os.tipo_os === 'LP' ? [{ id: 'nf', label: 'Nota Fiscal', icon: Receipt }] : []),
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

        <div className="flex-1 overflow-y-auto cyber-scrollbar p-6 min-h-[400px]">
          {abaAtiva === 'dados' && (
            <div className="space-y-6">
              {(() => {
                const camposFaltantes: string[] = [];
                if (!os.defeito_relatado) camposFaltantes.push('Defeito Relatado');
                if (!os.diagnostico_tecnico) camposFaltantes.push('Diagnostico Tecnico');
                if (!os.reparo_efetuado) camposFaltantes.push('Reparo Efetuado');
                if (camposFaltantes.length === 0) return null;
                return (
                  <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-bold text-amber-400">Campos pendentes de preenchimento</p>
                      <p className="text-xs text-amber-500/80 mt-1">
                        {camposFaltantes.join('  |  ')}
                      </p>
                    </div>
                  </div>
                );
              })()}
              <div className="premium-card p-4 bg-gradient-to-r from-[#00D4FF]/10 to-[#FFA500]/10 border-l-4 border-[#00D4FF]">
                <h3 className="text-sm font-bold text-[#00D4FF] uppercase tracking-wider mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Informações da OS
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  {/* Campo de Número OS Samsung - Editável */}
                  {os.tipo_os !== 'SC / ACC' && (
                    <div className="col-span-2">
                      <label className="text-xs text-gray-500 uppercase flex items-center justify-between">
                        <span>Número OS Samsung</span>
                        {os.numero_os_samsung && !editandoNumeroSamsung && (
                          <button
                            onClick={() => {
                              setEditandoNumeroSamsung(true);
                              setNumeroSamsungTemp(os.numero_os_samsung || '');
                            }}
                            className="text-xs text-[#00D4FF] hover:text-[#00D4FF]/80 transition-colors flex items-center gap-1"
                          >
                            <Save className="w-3 h-3" />
                            Editar
                          </button>
                        )}
                      </label>
                      {editandoNumeroSamsung ? (
                        <div className="flex items-center gap-2 mt-1">
                          <input
                            type="text"
                            value={numeroSamsungTemp}
                            onChange={(e) => setNumeroSamsungTemp(e.target.value)}
                            className="flex-1 px-3 py-2 rounded text-sm bg-gray-800 border border-gray-700 text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                            placeholder="Digite o número da OS Samsung"
                          />
                          <button
                            onClick={salvarNumeroSamsung}
                            disabled={salvandoNumeroSamsung}
                            className="px-3 py-2 rounded text-xs font-bold transition-colors flex items-center gap-1"
                            style={{
                              background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.2) 0%, rgba(var(--accent-rgb),0.1) 100%)',
                              border: '1px solid rgba(var(--accent-rgb),0.5)',
                              color: 'var(--text-accent)'
                            }}
                          >
                            {salvandoNumeroSamsung ? (
                              <>
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                Salvando...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-3 h-3" />
                                Salvar
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              setEditandoNumeroSamsung(false);
                              setNumeroSamsungTemp('');
                            }}
                            className="px-3 py-2 rounded text-xs font-bold transition-colors flex items-center gap-1"
                            style={{
                              background: 'rgba(255,0,100,0.1)',
                              border: '1px solid rgba(255,0,100,0.3)',
                              color: '#FF0064'
                            }}
                          >
                            <XCircle className="w-3 h-3" />
                            Cancelar
                          </button>
                        </div>
                      ) : os.numero_os_samsung ? (
                        <p className="text-sm text-gray-300 mt-1 font-mono font-bold">{os.numero_os_samsung}</p>
                      ) : (
                        <div className="mt-1">
                          <button
                            onClick={() => {
                              setEditandoNumeroSamsung(true);
                              setNumeroSamsungTemp('');
                            }}
                            className="px-3 py-2 rounded text-xs font-bold transition-colors flex items-center gap-1"
                            style={{
                              background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.2) 0%, rgba(var(--accent-rgb),0.1) 100%)',
                              border: '1px solid rgba(var(--accent-rgb),0.5)',
                              color: 'var(--text-accent)'
                            }}
                          >
                            <Save className="w-3 h-3" />
                            Adicionar Número Samsung
                          </button>
                        </div>
                      )}
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
                          backgroundColor: os.tipo_os === 'LP' ? '#FFA50030' : 'rgba(var(--accent-rgb), 0.19)',
                          color: os.tipo_os === 'LP' ? '#FFA500' : 'var(--text-accent)',
                          border: os.tipo_os === 'LP' ? '1px solid #FFA50060' : '1px solid rgba(var(--accent-rgb), 0.38)'
                        }}
                      >
                        {os.tipo_os}
                      </span>
                      {os.tipo_os === 'OW' && os.tipo_orcamento && (
                        <span
                          className="px-3 py-1 rounded text-xs font-bold"
                          style={{
                            backgroundColor: os.tipo_orcamento === 'samsung_contigo' ? '#FFA50030' : 'rgba(var(--neon-green-rgb),0.15)',
                            color: os.tipo_orcamento === 'samsung_contigo' ? '#FFA500' : 'var(--neon-green)',
                            border: `1px solid ${os.tipo_orcamento === 'samsung_contigo' ? '#FFA50060' : 'rgba(var(--neon-green-rgb),0.35)'}`
                          }}
                        >
                          {os.tipo_orcamento === 'normal' ? 'NORMAL' :
                           os.tipo_orcamento === 'acessorios' ? 'ACESSÓRIOS' :
                           'SAMSUNG CONTIGO'}
                        </span>
                      )}
                      {os.tipo_os === 'OW' && (
                        <>
                          <div className="ml-4 flex items-center gap-2">
                            <span className="text-xs text-gray-500">Cortesia:</span>
                            <button
                              onClick={() => handleToggleCortesia()}
                              className="relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                              style={{
                                backgroundColor: (os as any).is_cortesia ? 'var(--neon-green)' : '#4B5563'
                              }}
                            >
                              <span
                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                  (os as any).is_cortesia ? 'translate-x-6' : 'translate-x-1'
                                }`}
                              />
                            </button>
                          </div>
                          {(os as any).is_cortesia && (
                            <span
                              className="px-3 py-1 rounded text-xs font-bold animate-pulse"
                              style={{
                                backgroundColor: 'rgba(var(--neon-green-rgb),0.15)',
                                color: 'var(--neon-green)',
                                border: '1px solid rgba(var(--neon-green-rgb),0.35)',
                                boxShadow: '0 0 10px rgba(var(--neon-green-rgb),0.3)'
                              }}
                            >
                              CORTESIA
                            </span>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* OS Vinculadas (Grupo) */}
              {mode === 'view' && os && (
                <div className="premium-card p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Layers className="w-4 h-4 text-blue-400" />
                      <span className="text-xs text-gray-300 uppercase font-bold">OS Vinculadas</span>
                      {osVinculadas.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30">
                          {osVinculadas.length}
                        </span>
                      )}
                    </div>
                    <button
                      onClick={() => setShowVincularModal(true)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-600/20 hover:bg-blue-600/30 text-blue-300 border border-blue-500/40 transition-colors flex items-center gap-1.5"
                    >
                      <Link2 className="w-3 h-3" />
                      Vincular OS
                    </button>
                  </div>
                  {osVinculadas.length > 0 ? (
                    <div className="space-y-2">
                      {osVinculadas.map(osV => {
                        const isPrincipal = os && new Date(osV.created_at) < new Date(os.created_at);
                        return (
                          <div
                            key={osV.id}
                            className="flex items-center justify-between p-2.5 rounded-lg bg-blue-500/5 border border-blue-500/20 hover:border-blue-500/40 transition-colors cursor-pointer"
                            onClick={() => setNavigatedOsId(osV.id)}
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
                  ) : (
                    <p className="text-xs text-gray-500 text-center py-2">Nenhuma OS vinculada</p>
                  )}
                </div>
              )}

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
                              background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.1) 0%, rgba(var(--accent-rgb),0.03) 100%)',
                              borderColor: 'rgba(var(--accent-rgb),0.3)'
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
                        <p className="text-xs text-gray-500">Cidade</p>
                        <p className="text-sm text-gray-300">{normalizarCidade(os.cliente_cidade) || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500">Estado</p>
                        <p className="text-sm text-gray-300">{os.cliente_estado || '-'}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {(os as any).nps_score != null && (
                  <div className="mt-4 p-3 rounded-lg border border-white/10 bg-white/[0.03]">
                    <div className="flex items-center gap-2 mb-1">
                      <Star className="w-4 h-4 text-yellow-400" />
                      <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">NPS do Cliente</span>
                      <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
                        (os as any).nps_score >= 4 ? 'bg-green-500/20 text-green-400' :
                        (os as any).nps_score === 3 ? 'bg-yellow-500/20 text-yellow-400' :
                        'bg-red-500/20 text-red-400'
                      }`}>
                        {(os as any).nps_score >= 4 ? 'Satisfeito' : (os as any).nps_score === 3 ? 'Neutro' : 'Insatisfeito'}
                        {' — '}{(os as any).nps_score}/5
                      </span>
                    </div>
                    {(os as any).nps_comentario && (
                      <p className="text-xs text-gray-400 mt-1 italic">"{(os as any).nps_comentario}"</p>
                    )}
                  </div>
                )}
              </div>

              <div>
                <h3 className="text-sm font-bold text-[#00D4FF] uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Package className="w-4 h-4" />
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
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-[#00D4FF] uppercase tracking-wider mb-4 flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Servico
                </h3>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Defeito Relatado</label>
                    <p className="text-sm text-gray-300 mt-1 whitespace-pre-wrap">{os.defeito_relatado || '-'}</p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <label className={`text-xs uppercase ${os.diagnostico_tecnico ? 'text-gray-500' : 'text-amber-500/70'}`}>
                        Diagnostico Tecnico
                        {!os.diagnostico_tecnico && <span className="text-amber-500 ml-1">(pendente)</span>}
                      </label>
                      {!editandoDiagnostico && (
                        <button
                          onClick={() => { setDiagnosticoTemp(os.diagnostico_tecnico || ''); setEditandoDiagnostico(true); }}
                          className="text-xs text-[#00D4FF] hover:underline flex items-center gap-1"
                        >
                          <Wrench className="w-3 h-3" /> Editar
                        </button>
                      )}
                    </div>
                    {editandoDiagnostico ? (
                      <div className="mt-1 space-y-2">
                        <textarea
                          value={diagnosticoTemp}
                          onChange={(e) => setDiagnosticoTemp(e.target.value)}
                          className="neon-input w-full h-24 resize-none text-sm"
                          placeholder="Descreva o diagnóstico técnico..."
                        />
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditandoDiagnostico(false)} className="px-3 py-1 text-xs rounded border border-gray-600 text-gray-400 hover:bg-white/5">Cancelar</button>
                          <button onClick={salvarDiagnostico} disabled={salvandoDiagnostico || !diagnosticoTemp.trim()} className="px-3 py-1 text-xs rounded font-bold flex items-center gap-1 disabled:opacity-50" style={{ background: 'rgba(var(--accent-rgb), 0.125)', border: '1px solid var(--text-accent)', color: 'var(--text-accent)' }}>
                            <Save className="w-3 h-3" /> {salvandoDiagnostico ? 'Salvando...' : 'Salvar'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className={`text-sm mt-1 whitespace-pre-wrap ${os.diagnostico_tecnico ? 'text-gray-300' : 'text-gray-600 italic'}`}>
                        {os.diagnostico_tecnico || 'Preenchido automaticamente ao concluir analise tecnica'}
                      </p>
                    )}
                  </div>
                  <div>
                    <div className="flex items-center justify-between">
                      <label className={`text-xs uppercase ${os.reparo_efetuado ? 'text-gray-500' : 'text-amber-500/70'}`}>
                        Reparo Efetuado
                        {!os.reparo_efetuado && <span className="text-amber-500 ml-1">(pendente)</span>}
                      </label>
                      {!editandoReparo && (
                        <button
                          onClick={() => { setReparoTemp(os.reparo_efetuado || ''); setEditandoReparo(true); }}
                          className="text-xs text-[#00D4FF] hover:underline flex items-center gap-1"
                        >
                          <Wrench className="w-3 h-3" /> Editar
                        </button>
                      )}
                    </div>
                    {editandoReparo ? (
                      <div className="mt-1 space-y-2">
                        <textarea
                          value={reparoTemp}
                          onChange={(e) => setReparoTemp(e.target.value)}
                          className="neon-input w-full h-24 resize-none text-sm"
                          placeholder="Descreva o reparo efetuado..."
                        />
                        <div className="flex gap-2 justify-end">
                          <button onClick={() => setEditandoReparo(false)} className="px-3 py-1 text-xs rounded border border-gray-600 text-gray-400 hover:bg-white/5">Cancelar</button>
                          <button onClick={salvarReparo} disabled={salvandoReparo || !reparoTemp.trim()} className="px-3 py-1 text-xs rounded font-bold flex items-center gap-1 disabled:opacity-50" style={{ background: 'rgba(var(--accent-rgb), 0.125)', border: '1px solid var(--text-accent)', color: 'var(--text-accent)' }}>
                            <Save className="w-3 h-3" /> {salvandoReparo ? 'Salvando...' : 'Salvar'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className={`text-sm mt-1 whitespace-pre-wrap ${os.reparo_efetuado ? 'text-gray-300' : 'text-gray-600 italic'}`}>
                        {os.reparo_efetuado || 'Preenchido automaticamente ao mover para OQC'}
                      </p>
                    )}
                  </div>
                  <div>
                    <label className="text-xs text-gray-500 uppercase">Observacoes</label>
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
                          {pecas.length === 0 ? (
                            <span className="text-[#FFBF00]">
                              <AlertCircle className="w-3 h-3 inline mr-1" />
                              ATENÇÃO: Adicione as peças necessárias ANTES de concluir a análise. Se não houver peças, escreva isso no relato do diagnóstico.
                            </span>
                          ) : (
                            'Peças adicionadas. Clique em "Análise Concluída" para finalizar o diagnóstico e escrever o relato técnico.'
                          )}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => {
                        if (pecas.length === 0) {
                          const confirma = confirm(
                            'ATENCAO!\n\n' +
                            'Nenhuma peca foi adicionada a esta OS.\n\n' +
                            'Se realmente nao ha pecas necessarias, ESCREVA isso no relato do diagnostico que sera solicitado.\n\n' +
                            'Deseja continuar mesmo assim?'
                          );
                          if (!confirma) return;
                        }
                        setMostrarModalAnalise(true);
                      }}
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

              {(os?.tipo_os === 'OW' || os?.tipo_os === 'LP') && (() => {
                const isSCACC = os?.tipo_orcamento === 'samsung_contigo' || os?.tipo_orcamento === 'acessorios';
                const isSCACCColor = isSCACC;
                const accentColor = isSCACC ? '#39FF14' : 'var(--text-accent)';
                return (
                <div className="premium-card p-4 mb-4" style={{ backgroundColor: isSCACCColor ? 'rgba(var(--neon-green-rgb),0.06)' : 'rgba(var(--accent-rgb), 0.063)', border: isSCACCColor ? '1px solid rgba(var(--neon-green-rgb),0.15)' : '1px solid rgba(var(--accent-rgb), 0.19)' }}>
                  <h3 className="text-sm font-bold uppercase tracking-wider mb-4 flex items-center gap-2" style={{ color: isSCACCColor ? 'var(--neon-green)' : 'var(--text-accent)' }}>
                    <Package className="w-4 h-4" />
                    Adicionar Peca {isSCACC ? '(Requisicao em Lote)' : 'Manualmente'}
                  </h3>
                  <div className={`grid gap-3 ${isSCACC ? 'grid-cols-6' : 'grid-cols-5'}`} style={{ overflow: 'visible' }}>
                    <div className="relative" style={{ zIndex: mostrarSugestoesOW ? 100 : 'auto' }}>
                      <label className="text-xs text-gray-400 uppercase block mb-2">
                        Codigo/PN *
                      </label>
                      <input
                        type="text"
                        value={novaPecaCodigoOW}
                        onChange={(e) => {
                          setNovaPecaCodigoOW(e.target.value);
                          setMostrarSugestoesOW(true);
                        }}
                        onBlur={() => setTimeout(() => setMostrarSugestoesOW(false), 200)}
                        className="neon-input w-full"
                        placeholder="Ex: GH82-12345A"
                      />
                      {mostrarSugestoesOW && sugestoesPecasOW.length > 0 && (
                        <div className="absolute mt-1 w-full max-w-md bg-[#0A0F1E] rounded-lg shadow-xl max-h-64 overflow-y-auto" style={{ border: `1px solid ${accentColor}30`, zIndex: 9999 }}>
                          {sugestoesPecasOW.map((sugestao, idx) => (
                            <div
                              key={idx}
                              onClick={() => {
                                setNovaPecaCodigoOW(sugestao.pn);
                                setNovaPecaDescricaoOW(sugestao.descricao);
                                setNovaPecaValorGSPN((sugestao.valor_corrigido || sugestao.valor_com_impostos || 0).toFixed(2));
                                setMostrarSugestoesOW(false);
                              }}
                              className="p-3 cursor-pointer border-b border-gray-800 last:border-0"
                              style={{ ':hover': { backgroundColor: `${accentColor}10` } }}
                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = `${accentColor}10`}
                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1">
                                  <p className="text-sm font-bold" style={{ color: accentColor }}>{sugestao.pn}</p>
                                  <p className="text-xs text-gray-400 mt-1">{sugestao.descricao}</p>
                                  <div className="flex items-center gap-3 mt-2">
                                    <span className="text-[10px] text-gray-500">
                                      GSPN/NF: R$ {sugestao.valor_com_impostos?.toFixed(2) || '0.00'}
                                    </span>
                                    {sugestao.valor_corrigido && (
                                      <span className="text-[10px] text-[#39FF14]">
                                        Ultimo Pedido: R$ {sugestao.valor_corrigido.toFixed(2)}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <span className="text-[10px] px-2 py-1 rounded" style={{ backgroundColor: `${accentColor}20`, color: accentColor }}>
                                    {sugestao.count}x em estoque
                                  </span>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 uppercase block mb-2">
                        Descricao *
                      </label>
                      <input
                        type="text"
                        value={novaPecaDescricaoOW}
                        onChange={(e) => setNovaPecaDescricaoOW(e.target.value)}
                        className="neon-input w-full"
                        placeholder="Ex: Display LCD"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 uppercase block mb-2">
                        Valor Base Unitario (R$) *
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={novaPecaValorGSPN}
                        onChange={(e) => setNovaPecaValorGSPN(e.target.value)}
                        onPaste={(e) => {
                          e.preventDefault();
                          const pasted = e.clipboardData.getData('text');
                          setNovaPecaValorGSPN(sanitizeGSPNValue(pasted));
                        }}
                        onBlur={() => {
                          if (novaPecaValorGSPN) setNovaPecaValorGSPN(sanitizeGSPNValue(novaPecaValorGSPN));
                        }}
                        className="neon-input w-full"
                        placeholder="0.00"
                      />
                      {novaPecaValorGSPN && !isNaN(parseFloat(sanitizeGSPNValue(novaPecaValorGSPN))) && parseFloat(sanitizeGSPNValue(novaPecaValorGSPN)) > 0 && (
                        <p className="text-xs mt-1" style={{ color: '#FFA500' }}>
                          Valor c/ Markup: R$ {(() => {
                            const valor = calcularValorComMarkup(parseFloat(sanitizeGSPNValue(novaPecaValorGSPN)));
                            return (isNaN(valor) || !isFinite(valor)) ? '0.00' : valor.toFixed(2);
                          })()}
                        </p>
                      )}
                      {markups.length === 0 && (
                        <p className="text-[10px] text-red-400 mt-1">
                          Nenhum markup configurado
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 uppercase block mb-2">
                        Quantidade *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={novaPecaQuantidadeOW}
                        onChange={(e) => setNovaPecaQuantidadeOW(Math.max(1, parseInt(e.target.value) || 1))}
                        className="neon-input w-full"
                        placeholder="1"
                      />
                      {novaPecaQuantidadeOW > 1 && (
                        <p className="text-xs mt-1" style={{ color: 'var(--neon-green)' }}>
                          Requisicao em lote ({novaPecaQuantidadeOW} un.)
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-400 uppercase block mb-2">
                        Acoes
                      </label>
                      <button
                        onClick={handleAdicionarPecaOW}
                        disabled={adicionandoPecaOW || !novaPecaCodigoOW || !novaPecaDescricaoOW || !novaPecaValorGSPN}
                        className="neon-button px-4 py-2 w-full text-xs disabled:opacity-50"
                        style={{
                          backgroundColor: `${accentColor}20`,
                          borderColor: accentColor,
                          color: accentColor
                        }}
                      >
                        {adicionandoPecaOW ? 'ADICIONANDO...' : novaPecaQuantidadeOW > 1 ? `ADICIONAR (${novaPecaQuantidadeOW}x)` : 'ADICIONAR PECA'}
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-500 mt-3">
                    * Informe a quantidade desejada. Ao requisitar, sera gerada uma requisicao com a quantidade informada. O valor final e calculado automaticamente com markup configurado.
                  </p>
                </div>
                );
              })()}

              {(() => {
                const pecaIdsVinculados = new Set<string>();
                pecas.forEach(peca => {
                  pecaIdsVinculados.add(peca.id);
                  if (peca.cotacao_peca_id) pecaIdsVinculados.add(peca.cotacao_peca_id);
                });
                const orphanReqs = requisicoes.filter(r =>
                  !r.os_peca_id && !r.cotacao_peca_id &&
                  !pecas.some(p => (p.codigo || p.pn) === r.codigo_peca)
                );
                const orphanPecas = orphanReqs.reduce((acc: any[], r) => {
                  if (!acc.find(a => a.codigo_peca === r.codigo_peca)) {
                    acc.push({
                      id: r.id,
                      os_id: r.os_id,
                      codigo: r.codigo_peca,
                      pn: r.codigo_peca,
                      descricao: r.descricao,
                      quantidade: r.quantidade_requisitada,
                      valor_unitario: 0,
                      valor_gspn: 0,
                      valor_total: 0,
                      status: 'requisitada',
                      exibir_no_pdf: true,
                      _isOrphanReq: true
                    });
                  }
                  return acc;
                }, []);
                const todasPecas = [...pecas, ...orphanPecas];
                return todasPecas.length === 0 ? (
                <p className="text-center text-gray-500 py-8">Nenhuma peça cadastrada</p>
              ) : (
                <div className="space-y-3">
                  {todasPecas.map((peca) => {
                    const pecaId = peca.cotacao_peca_id || peca.id;
                    const usaOsPecaId = peca.status === 'gspn' || peca.status === 'manual' || isSCACC || (peca as any)._isOrphanReq;

                    const requisicoesDestaPeca = requisicoes.filter(r => {
                      if ((peca as any)._isOrphanReq) {
                        return r.codigo_peca === peca.codigo && !r.os_peca_id && !r.cotacao_peca_id;
                      }
                      if (usaOsPecaId) {
                        return r.os_peca_id === peca.id;
                      } else {
                        return r.cotacao_peca_id === pecaId;
                      }
                    }).sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

                    const requisicaoAtiva = requisicoesDestaPeca.find(r =>
                      r.status !== 'devolvida' && r.status !== 'reprovada' && r.status !== 'cancelada'
                    );
                    const requisicaoDevolvida = requisicoesDestaPeca.find(r =>
                      r.status === 'devolvida' || r.status === 'reprovada'
                    );

                    // IMPORTANTE: Apenas requisições ativas devem ser consideradas para controlar o botão
                    const requisicao = requisicaoAtiva;

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
                              {peca.status === 'gspn' && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{
                                  backgroundColor: '#9333EA20',
                                  color: '#9333EA',
                                  border: '1px solid #9333EA60'
                                }}>
                                  GSPN
                                </span>
                              )}
                              {peca.status === 'manual' && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-bold" style={{
                                  backgroundColor: 'rgba(var(--accent-rgb), 0.125)',
                                  color: 'var(--text-accent)',
                                  border: '1px solid rgba(var(--accent-rgb), 0.38)'
                                }}>
                                  MANUAL
                                </span>
                              )}
                              {requisicao && getStatusBadge(requisicao.status)}
                              {!requisicao && requisicaoDevolvida && getStatusBadge(requisicaoDevolvida.status)}
                              {peca.alerta_preco_nf && (
                                <span className="px-2 py-0.5 rounded-full text-xs font-bold flex items-center gap-1" style={{
                                  backgroundColor: '#FFBF0020',
                                  color: '#FFBF00',
                                  border: '1px solid #FFBF0060'
                                }}>
                                  <AlertTriangle className="w-3 h-3" />
                                  Custo atualizado via NF
                                </span>
                              )}
                            </div>
                            {peca.alerta_preco_nf && peca.valor_anterior_nf != null && (
                              <div className="flex items-center gap-2 mt-1">
                                <span className="line-through text-red-400 text-xs">De: R$ {Number(peca.valor_anterior_nf).toFixed(2)}</span>
                                <span className="text-[#39FF14] text-sm font-bold">Por: R$ {Number(peca.valor_gspn || peca.valor_unitario || 0).toFixed(2)}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-4">
                              <p className="text-xs text-gray-500 mt-1">Código: {peca.codigo || peca.pn || 'N/A'}</p>
                              {requisicao?.peca_estoque?.id_numerico && (
                                <div className="text-xs font-bold mt-1" style={{ color: 'var(--neon-green)' }}>
                                  {requisicao.is_lote && requisicao.pecas_lote && requisicao.pecas_lote.length > 0 ? (
                                    <div className="flex flex-wrap gap-1 items-center">
                                      <span>IDs Atendidos:</span>
                                      {requisicao.pecas_lote.map((peca: any, idx: number) => (
                                        <span key={peca.id} className="px-2 py-0.5 bg-[#39FF14]/20 border border-[#39FF14]/40 rounded flex items-center gap-1.5">
                                          <span>#{peca.id_numerico}</span>
                                          {peca.estoque_etiquetas?.[0]?.delivery && (
                                            <span className="text-[10px] text-gray-400">
                                              ({peca.estoque_etiquetas[0].delivery})
                                            </span>
                                          )}
                                        </span>
                                      ))}
                                    </div>
                                  ) : (
                                    <div className="flex items-center gap-2">
                                      <p>ID Atendido: #{requisicao.peca_estoque.id_numerico}</p>
                                      {requisicao.peca_estoque.estoque_etiquetas?.[0]?.delivery && (
                                        <span className="text-[10px] text-gray-400">
                                          Delivery: {requisicao.peca_estoque.estoque_etiquetas[0].delivery}
                                        </span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                            {/* ── LINHA DE VALORES: Qtd | GSPN | Unit | Total ── */}
                            <div className="flex items-center gap-4 mt-2 flex-wrap">

                              {/* Quantidade */}
                              <p className="text-xs text-gray-500">Qtd: {peca.quantidade || 1}</p>

                              {/* ── VALOR GSPN (base) — para peças gspn/manual ou todas em SC/ACC ── */}
                              {(peca.status === 'gspn' || peca.status === 'manual' || isSCACC) && !(peca as any)._isOrphanReq && (
                                editandoValorGSPN[peca.id] !== undefined ? (
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs font-bold" style={{ color: '#9333EA' }}>GSPN R$</span>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      placeholder="0.00"
                                      value={editandoValorGSPN[peca.id]}
                                      onChange={(e) => setEditandoValorGSPN(prev => ({ ...prev, [peca.id]: e.target.value }))}
                                      onPaste={(e) => {
                                        e.preventDefault();
                                        const pasted = e.clipboardData.getData('text');
                                        setEditandoValorGSPN(prev => ({ ...prev, [peca.id]: sanitizeGSPNValue(pasted) }));
                                      }}
                                      onBlur={() => {
                                        const val = editandoValorGSPN[peca.id];
                                        if (val) setEditandoValorGSPN(prev => ({ ...prev, [peca.id]: sanitizeGSPNValue(val) }));
                                      }}
                                      className="neon-input w-28 text-xs py-1"
                                      disabled={salvandoValorGSPN[peca.id]}
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => handleSalvarValorGSPN(peca.id)}
                                      disabled={salvandoValorGSPN[peca.id]}
                                      className="p-1.5 rounded transition-all disabled:opacity-50"
                                      style={{ backgroundColor: 'rgba(var(--neon-green-rgb),0.1)', border: '1px solid rgba(var(--neon-green-rgb),0.35)', color: 'var(--neon-green)' }}
                                      title="Salvar valor GSPN"
                                    >
                                      <Save className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      onClick={() => setEditandoValorGSPN(prev => { const n = { ...prev }; delete n[peca.id]; return n; })}
                                      disabled={salvandoValorGSPN[peca.id]}
                                      className="p-1.5 rounded transition-all disabled:opacity-50"
                                      style={{ backgroundColor: '#FF006420', border: '1px solid #FF006460', color: '#FF0064' }}
                                      title="Cancelar"
                                    >
                                      <X className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-xs font-bold" style={{ color: '#9333EA' }}>
                                      GSPN: R$ {Number(peca.valor_gspn || 0).toFixed(2)}
                                    </p>
                                    <button
                                      onClick={() => setEditandoValorGSPN(prev => ({ ...prev, [peca.id]: String(Number(peca.valor_gspn || 0).toFixed(2)) }))}
                                      className="p-1 rounded transition-all hover:opacity-80"
                                      style={{ backgroundColor: '#9333EA20', border: '1px solid #9333EA60', color: '#9333EA' }}
                                      title="Editar valor GSPN"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                  </div>
                                )
                              )}

                              {/* ── VALOR UNITÁRIO COM MARKUP ── */}
                              {(peca.status === 'gspn' || peca.status === 'manual' || isSCACC || peca.valor_gspn > 0 || peca.valor_unitario > 0) && !(peca as any)._isOrphanReq && (
                                editandoValorFinal[peca.id] !== undefined ? (
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-xs font-bold" style={{ color: 'var(--text-accent)' }}>Unit R$</span>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={editandoValorFinal[peca.id]}
                                      onChange={(e) => setEditandoValorFinal(prev => ({ ...prev, [peca.id]: e.target.value }))}
                                      onPaste={(e) => {
                                        e.preventDefault();
                                        const pasted = e.clipboardData.getData('text');
                                        setEditandoValorFinal(prev => ({ ...prev, [peca.id]: sanitizeGSPNValue(pasted) }));
                                      }}
                                      onBlur={(e) => {
                                        if (e.target.value) setEditandoValorFinal(prev => ({ ...prev, [peca.id]: sanitizeGSPNValue(prev[peca.id]) }));
                                      }}
                                      className="w-24 px-2 py-1 text-xs rounded bg-gray-800 border border-gray-700 text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                                      autoFocus
                                    />
                                    <button
                                      onClick={() => handleSalvarValorFinal(peca.id)}
                                      className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all"
                                      style={{ backgroundColor: 'rgba(var(--neon-green-rgb),0.1)', border: '1px solid rgba(var(--neon-green-rgb),0.35)', color: 'var(--neon-green)' }}
                                    >
                                      <Save className="w-3 h-3" />
                                      Salvar
                                    </button>
                                    <button
                                      onClick={() => setEditandoValorFinal(prev => { const n = { ...prev }; delete n[peca.id]; return n; })}
                                      className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all"
                                      style={{ backgroundColor: '#FF006420', border: '1px solid #FF006460', color: '#FF0064' }}
                                    >
                                      <X className="w-3 h-3" />
                                      Cancelar
                                    </button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-1.5">
                                    <p className="text-xs font-bold" style={{ color: 'var(--text-accent)' }}>
                                      Unit: R$ {Number(peca.valor_unitario || 0).toFixed(2)}
                                    </p>
                                    <button
                                      onClick={() => setEditandoValorFinal(prev => ({ ...prev, [peca.id]: String(Number(peca.valor_unitario || 0).toFixed(2)) }))}
                                      className="p-1 rounded transition-all hover:opacity-80"
                                      style={{ backgroundColor: 'rgba(var(--accent-rgb),0.1)', border: '1px solid rgba(var(--accent-rgb),0.4)', color: 'var(--text-accent)' }}
                                      title="Editar valor unitário"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                  </div>
                                )
                              )}

                              {/* ── VALOR TOTAL ── */}
                              <div className="flex items-center gap-1.5">
                                <p className="text-xs font-bold text-[#39FF14]">
                                  Total: R$ {(Number(peca.valor_unitario || 0) * Math.max(peca.quantidade || 1, 1)).toFixed(2)}
                                </p>
                                {(peca.status === 'manual' || isSCACC) && !(peca as any)._isOrphanReq && !editandoValorPeca[peca.id] && (
                                  <button
                                    onClick={() => setEditandoValorPeca(prev => ({ ...prev, [peca.id]: { unitario: String(Number(peca.valor_unitario || 0).toFixed(2)), quantidade: String(peca.quantidade || 1) } }))}
                                    className="p-1 rounded transition-all hover:opacity-80"
                                    style={{ backgroundColor: '#39FF1420', border: '1px solid #39FF1460', color: '#39FF14' }}
                                    title="Editar quantidade e valor unitário"
                                  >
                                    <Pencil className="w-3 h-3" />
                                  </button>
                                )}
                              </div>

                              {/* Edição de qtd+unitário para peças manuais / SC/ACC */}
                              {(peca.status === 'manual' || isSCACC) && !(peca as any)._isOrphanReq && editandoValorPeca[peca.id] && (
                                <div className="flex items-center gap-2 flex-wrap w-full mt-1">
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-gray-500">Qtd:</span>
                                    <input
                                      type="number"
                                      min="1"
                                      step="1"
                                      value={editandoValorPeca[peca.id].quantidade}
                                      onChange={(e) => setEditandoValorPeca(prev => ({ ...prev, [peca.id]: { ...prev[peca.id], quantidade: e.target.value } }))}
                                      className="w-14 px-2 py-1 text-xs rounded bg-gray-800 border border-gray-700 text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                                    />
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <span className="text-xs text-gray-500">Unit R$</span>
                                    <input
                                      type="text"
                                      inputMode="decimal"
                                      value={editandoValorPeca[peca.id].unitario}
                                      onChange={(e) => setEditandoValorPeca(prev => ({ ...prev, [peca.id]: { ...prev[peca.id], unitario: e.target.value } }))}
                                      onPaste={(e) => {
                                        e.preventDefault();
                                        const pasted = e.clipboardData.getData('text');
                                        setEditandoValorPeca(prev => ({ ...prev, [peca.id]: { ...prev[peca.id], unitario: sanitizeGSPNValue(pasted) } }));
                                      }}
                                      onBlur={(e) => {
                                        if (e.target.value) setEditandoValorPeca(prev => ({ ...prev, [peca.id]: { ...prev[peca.id], unitario: sanitizeGSPNValue(prev[peca.id].unitario) } }));
                                      }}
                                      className="w-20 px-2 py-1 text-xs rounded bg-gray-800 border border-gray-700 text-gray-200 focus:outline-none focus:border-[#00D4FF]"
                                      autoFocus
                                    />
                                  </div>
                                  <button
                                    onClick={() => handleSalvarValoresPecaManual(peca.id)}
                                    className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all"
                                    style={{ backgroundColor: 'rgba(var(--neon-green-rgb),0.1)', border: '1px solid rgba(var(--neon-green-rgb),0.35)', color: 'var(--neon-green)' }}
                                  >
                                    <Save className="w-3 h-3" />
                                    Salvar
                                  </button>
                                  <button
                                    onClick={() => setEditandoValorPeca(prev => { const n = { ...prev }; delete n[peca.id]; return n; })}
                                    className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-all"
                                    style={{ backgroundColor: '#FF006420', border: '1px solid #FF006460', color: '#FF0064' }}
                                  >
                                    <X className="w-3 h-3" />
                                    Cancelar
                                  </button>
                                </div>
                              )}
                            </div>

                            {/* ── HORÁRIO E USUÁRIO DE REQUISIÇÃO ── */}
                            {(requisicao || requisicaoDevolvida) && (
                              <p className="text-xs text-gray-500 mt-2">
                                Requisitado em: {new Date((requisicao || requisicaoDevolvida)!.created_at).toLocaleString('pt-BR')}
                                {(requisicao || requisicaoDevolvida)!.requisitado_por_usuario?.nome && (
                                  <span className="ml-1">por <span className="text-gray-400 font-medium">{(requisicao || requisicaoDevolvida)!.requisitado_por_usuario.nome}</span></span>
                                )}
                              </p>
                            )}
                            {requisicao?.status === 'pedido_feito' && (
                              <div className="mt-3 p-3 rounded-lg" style={{
                                backgroundColor: 'rgba(var(--accent-rgb), 0.063)',
                                border: '1px solid rgba(var(--accent-rgb), 0.38)'
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
                                        {reqComDevolucao.tipo_devolucao === 'nova_com_defeito' ? '⚠️ DEFEITO: ' : 'Motivo: '}
                                        {reqComDevolucao.motivo_devolucao}
                                      </p>
                                      {reqComDevolucao.status === 'devolucao_pendente' && (
                                        <p className="text-xs text-gray-500 mt-2">
                                          Aguardando aprovação do estoque
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Botões conforme status */}
                          <div className="flex gap-2">
                            {pecaRequisitandoId === (peca.cotacao_peca_id || peca.id) && !requisicao && (
                              <button
                                disabled
                                className="neon-button flex items-center gap-2 text-xs px-4 py-2 opacity-60 cursor-not-allowed"
                                style={{
                                  backgroundColor: 'rgba(var(--accent-rgb), 0.125)',
                                  borderColor: 'var(--text-accent)',
                                  color: 'var(--text-accent)'
                                }}
                              >
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                REQUISITANDO...
                              </button>
                            )}

                            {pecaRequisitandoId !== (peca.cotacao_peca_id || peca.id) && !requisicao && !requisicaoDevolvida && (
                              <button
                                onClick={() => handleRequisitarPeca(peca)}
                                className="neon-button flex items-center gap-2 text-xs px-4 py-2"
                                disabled={pecaRequisitandoId !== null}
                              >
                                <Send className="w-3 h-3" />
                                REQUISITAR
                              </button>
                            )}

                            {(peca.status === 'manual' || (isSCACC && !peca.cotacao_peca_id)) && !requisicao && !requisicaoDevolvida && (
                              <button
                                onClick={() => handleRemoverPecaManual(peca)}
                                disabled={removendoPecaId === peca.id}
                                className="neon-button flex items-center gap-2 text-xs px-3 py-2"
                                style={{
                                  backgroundColor: '#FF006410',
                                  borderColor: '#FF0064',
                                  color: '#FF0064'
                                }}
                                title="Remover peça"
                              >
                                {removendoPecaId === peca.id ? (
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                ) : (
                                  <Trash2 className="w-3 h-3" />
                                )}
                                REMOVER
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

                            {criandoRequisicao && (requisicaoDevolvida?.status === 'reprovada' || requisicaoDevolvida?.status === 'devolvida') && !requisicao && (
                              <button
                                disabled
                                className="neon-button flex items-center gap-2 text-xs px-4 py-2 opacity-60 cursor-not-allowed"
                                style={{
                                  backgroundColor: 'rgba(var(--accent-rgb), 0.125)',
                                  borderColor: 'var(--text-accent)',
                                  color: 'var(--text-accent)'
                                }}
                              >
                                <RefreshCw className="w-3 h-3 animate-spin" />
                                CRIANDO REQUISIÇÃO...
                              </button>
                            )}

                            {!criandoRequisicao && requisicaoDevolvida?.status === 'reprovada' && !requisicao && !temNovaRequisicaoPendente && (
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

                            {!criandoRequisicao && requisicaoDevolvida?.status === 'devolvida' && !requisicao && !temNovaRequisicaoPendente && requisicaoDevolvida?.tipo_devolucao === 'usada' && (
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

                            {!criandoRequisicao && temNovaRequisicaoPendente && (requisicaoDevolvida?.status === 'reprovada' || requisicaoDevolvida?.status === 'devolvida') && (
                              <button
                                disabled
                                className="neon-button flex items-center gap-2 text-xs px-4 py-2 opacity-60 cursor-not-allowed"
                                style={{
                                  backgroundColor: 'rgba(var(--accent-rgb), 0.125)',
                                  borderColor: 'var(--text-accent)',
                                  color: 'var(--text-accent)'
                                }}
                              >
                                <RefreshCw className="w-3 h-3" />
                                NOVA REQUISIÇÃO PENDENTE
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="mt-3 pt-3 border-t border-gray-800/50 flex items-center justify-between">
                          <label className="flex items-center gap-2 cursor-pointer select-none group">
                            <div
                              onClick={async () => {
                                if ((peca as any)._isOrphanReq) return;
                                const novoValor = !peca.exibir_no_pdf;
                                const tabela = peca.status === 'gspn' || peca.status === 'manual' || isSCACC ? 'os_pecas' : (peca.cotacao_peca_id ? 'cotacoes_pecas' : 'os_pecas');
                                await supabase.from(tabela).update({ exibir_no_pdf: novoValor }).eq('id', peca.id);
                                setPecas(prev => prev.map(p => p.id === peca.id ? { ...p, exibir_no_pdf: novoValor } : p));
                              }}
                              className={`w-8 h-4 rounded-full transition-all duration-200 relative cursor-pointer ${peca.exibir_no_pdf !== false ? 'bg-[#00D4FF]' : 'bg-gray-700'}`}
                            >
                              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all duration-200 ${peca.exibir_no_pdf !== false ? 'left-4' : 'left-0.5'}`} />
                            </div>
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider group-hover:text-gray-400 transition-colors">
                              Exibir no PDF
                            </span>
                          </label>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
              })()}
            </div>
          )}

          {abaAtiva === 'checklist' && os && (
            <OSChecklistTab
              osId={osId!}
              tipoOS={os.tipo_os}
              tipoAtendimento={os.tipo_atendimento}
              unidadeId={os.unidade_id}
            />
          )}

          {abaAtiva === 'servicos' && (
            <div className="space-y-4">
              {servicos.length === 0 ? (
                <div className="text-center py-16">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[#00D4FF]/10 to-[#39FF14]/10 flex items-center justify-center mx-auto mb-4 border border-[#00D4FF]/20">
                    <Wrench className="w-10 h-10 text-[#00D4FF]/60" />
                  </div>
                  <p className="text-gray-400 text-sm mb-6">Nenhum serviço adicionado</p>
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
                    <span className="inline-flex items-center gap-2">
                      <span className="text-lg">+</span>
                      ADICIONAR SERVICO
                    </span>
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
                      <span className="inline-flex items-center gap-1">
                        <span className="text-lg">+</span>
                        ADICIONAR
                      </span>
                    </button>
                  </div>

                  <div className="space-y-3">
                    {servicos.map((servico) => (
                      <div key={servico.id} className="premium-card p-4" style={{ borderColor: 'rgba(var(--accent-rgb), 0.25)' }}>
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
                                    const table = servico._table || 'cotacoes_servicos';
                                    await supabase
                                      .from(table)
                                      .update({ quantidade: servico.quantidade - 1, valor_total: servico.valor_unitario * (servico.quantidade - 1) })
                                      .eq('id', servico.id);
                                    loadServicos(true);
                                  }
                                }}
                                className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-white font-bold transition-colors"
                              >
                                -
                              </button>
                              <span className="text-sm font-bold text-white w-8 text-center">{servico.quantidade}</span>
                              <button
                                onClick={async () => {
                                  const table = servico._table || 'cotacoes_servicos';
                                  await supabase
                                    .from(table)
                                    .update({ quantidade: servico.quantidade + 1, valor_total: servico.valor_unitario * (servico.quantidade + 1) })
                                    .eq('id', servico.id);
                                  loadServicos(true);
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
                                  const table = servico._table || 'cotacoes_servicos';
                                  await supabase
                                    .from(table)
                                    .update({ valor_unitario: novoValor, valor_total: novoValor * servico.quantidade })
                                    .eq('id', servico.id);
                                  loadServicos(true);
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
                                  const table = servico._table || 'cotacoes_servicos';
                                  await supabase.from(table).delete().eq('id', servico.id);
                                  loadServicos(true);
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

                  <div className="flex justify-end mt-4">
                    <button
                      onClick={handleSalvarServicos}
                      disabled={salvandoServicos}
                      className="neon-button px-8 py-3 text-sm flex items-center gap-2 disabled:opacity-50"
                      style={{
                        backgroundColor: servicosSalvos ? 'rgba(var(--neon-green-rgb),0.25)' : 'rgba(var(--neon-green-rgb),0.1)',
                        borderColor: 'var(--neon-green)',
                        color: 'var(--neon-green)',
                        boxShadow: servicosSalvos ? '0 0 30px rgba(var(--neon-green-rgb),0.5)' : '0 0 20px rgba(var(--neon-green-rgb),0.3)'
                      }}
                    >
                      {salvandoServicos ? (
                        <>
                          <RefreshCw className="w-4 h-4 animate-spin" />
                          SALVANDO...
                        </>
                      ) : servicosSalvos ? (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          ATUALIZAR PAGAMENTO NOVAMENTE
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4" />
                          SALVAR E ATUALIZAR PAGAMENTO
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
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

          {abaAtiva === 'nf' && (os.tipo_os === 'OW' || os.tipo_os === 'LP') && (
            <OSNotaFiscalTab
              osId={osId}
              clienteNome={os.cliente_nome || ''}
              clienteDocumento={os.cliente_cpf_cnpj}
              clienteTelefone={os.cliente_telefone}
              clienteEmail={os.cliente_email}
              clienteEndereco={[
                os.cliente_logradouro,
                os.cliente_numero,
                os.cliente_bairro,
                os.cliente_cidade,
                os.cliente_estado,
                os.cliente_cep
              ].filter(Boolean).join(', ')}
              clienteLogradouro={os.cliente_logradouro}
              clienteNumero={os.cliente_numero}
              clienteBairro={os.cliente_bairro}
              clienteCep={os.cliente_cep}
              clienteCidade={os.cliente_cidade}
              clienteCidadeIbge={null}
              clienteMunicipio={os.cliente_cidade}
              clienteUF={os.cliente_estado}
              unidadeId={os.unidade_id}
              valorServicos={os.valor_servicos || 0}
              valorPecas={os.valor_pecas || 0}
              valorTotal={os.valor_bruto || 0}
              valorPago={os.valor_pago || 0}
              valorDesconto={os.valor_desconto || 0}
              tipoOs={os.tipo_os}
              isCortesia={(os as any).is_cortesia === true}
              onReload={async () => {
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
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 10 * 1024 * 1024) {
                        alert('Arquivo muito grande! Maximo 10MB');
                        e.target.value = '';
                        return;
                      }
                      const nameWithoutExt = file.name.replace(/\.[^/.]+$/, '');
                      setPendingUploadNome(nameWithoutExt);
                      setPendingUploadFile(file);
                      e.target.value = '';
                    }}
                  />
                </label>
              </div>

              {pendingUploadFile && (
                <div className="premium-card p-4 border border-[#00D4FF]/40 space-y-3">
                  <div className="flex items-center gap-3">
                    {pendingUploadFile.type.startsWith('image/') && (
                      <img
                        src={URL.createObjectURL(pendingUploadFile)}
                        alt="Preview"
                        className="w-16 h-16 object-cover rounded-lg border border-[#00D4FF]/30"
                      />
                    )}
                    <div className="flex-1">
                      <p className="text-xs text-gray-400 mb-1">Arquivo: {pendingUploadFile.name} ({(pendingUploadFile.size / 1024).toFixed(0)} KB)</p>
                      <input
                        type="text"
                        value={pendingUploadNome}
                        onChange={(e) => setPendingUploadNome(e.target.value)}
                        className="neon-input w-full text-sm py-2"
                        placeholder="Nome do arquivo..."
                        autoFocus
                        onKeyDown={(e) => { if (e.key === 'Enter') confirmarUploadAnexo(); }}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => { setPendingUploadFile(null); setPendingUploadNome(''); }}
                      className="px-4 py-2 text-xs rounded border border-gray-600 text-gray-400 hover:bg-white/5"
                    >
                      Cancelar
                    </button>
                    <button
                      onClick={confirmarUploadAnexo}
                      disabled={uploadingAnexo}
                      className="px-4 py-2 text-xs rounded font-bold flex items-center gap-1 disabled:opacity-50"
                      style={{ background: 'rgba(var(--accent-rgb), 0.125)', border: '1px solid var(--text-accent)', color: 'var(--text-accent)' }}
                    >
                      <Save className="w-3 h-3" />
                      {uploadingAnexo ? 'Enviando...' : 'Enviar'}
                    </button>
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {anexos.length === 0 ? (
                  <p className="text-center text-gray-500 py-8">Nenhum anexo</p>
                ) : (
                  anexos.map((anexo: any) => {
                    const isGSPN = anexo.origem === 'gspn_sync' || !!anexo.gspn_fileobjkey;
                    const isImage = anexo.tipo === 'foto' || /\.(jpg|jpeg|png|gif|webp|bmp|svg)$/i.test(anexo.nome_arquivo || '');
                    const isPDF = /\.pdf$/i.test(anexo.nome_arquivo || '');

                    return (
                      <div key={anexo.id} className="premium-card p-3 flex items-center gap-3">
                        <div
                          className="flex-shrink-0 w-14 h-14 rounded-lg overflow-hidden border border-white/10 bg-[#0A0F1E] flex items-center justify-center cursor-pointer hover:border-[#00D4FF]/50 transition-colors"
                          onClick={() => setAnexoPreview(anexo)}
                        >
                          {isImage && anexo.url ? (
                            <img src={anexo.url} alt={anexo.nome_arquivo} className="w-full h-full object-cover" />
                          ) : isPDF ? (
                            <FileDown className="w-6 h-6 text-red-400" />
                          ) : (
                            <FileText className="w-6 h-6 text-[#00D4FF]/60" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm text-gray-300 truncate">{anexo.descricao || anexo.nome_arquivo}</p>
                            {isGSPN && (
                              <span className="px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded flex-shrink-0" style={{
                                backgroundColor: '#9D4EDD20',
                                color: '#9D4EDD',
                                border: '1px solid #9D4EDD'
                              }}>
                                GSPN
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-gray-500 mt-0.5">
                            <span>{((anexo.tamanho_bytes || 0) / 1024).toFixed(0)} KB</span>
                            <span className="text-gray-600">|</span>
                            <span>{anexo.created_at ? new Date(anexo.created_at).toLocaleDateString('pt-BR') : '-'}</span>
                            <span>{anexo.created_at ? new Date(anexo.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                            <span className="text-gray-600">|</span>
                            <span>{anexo.usuario?.nome || 'Sistema'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <label className="flex items-center gap-1.5 cursor-pointer select-none group">
                            <div
                              onClick={async () => {
                                const novoValor = !anexo.exibir_no_pdf;
                                await supabase.from('os_anexos').update({ exibir_no_pdf: novoValor }).eq('id', anexo.id);
                                setAnexos((prev: any[]) => prev.map((a: any) => a.id === anexo.id ? { ...a, exibir_no_pdf: novoValor } : a));
                              }}
                              className={`w-8 h-4 rounded-full transition-all duration-200 relative cursor-pointer ${anexo.exibir_no_pdf ? 'bg-[#00D4FF]' : 'bg-gray-700'}`}
                            >
                              <div className={`absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all duration-200 ${anexo.exibir_no_pdf ? 'left-4' : 'left-0.5'}`} />
                            </div>
                            <span className="text-[10px] text-gray-500 uppercase tracking-wider group-hover:text-gray-400 transition-colors whitespace-nowrap">
                              PDF
                            </span>
                          </label>
                          <button
                            onClick={() => setAnexoPreview(anexo)}
                            className="neon-button text-xs px-3 py-1.5"
                          >
                            Abrir
                          </button>
                          {!isGSPN && (
                            <button
                              onClick={async () => {
                                if (!confirm('Deseja realmente excluir este anexo?')) return;
                                try {
                                  if (anexo.url) {
                                    const urlParts = anexo.url.split('/os-anexos/');
                                    if (urlParts.length > 1) {
                                      await supabase.storage.from('os-anexos').remove([urlParts[1]]);
                                    }
                                  }
                                  await supabase.from('os_anexos').delete().eq('id', anexo.id);
                                  await supabase.from('os_comentarios').insert({
                                    os_id: osId,
                                    usuario_id: usuario?.id,
                                    comentario: `Anexo removido: ${anexo.nome_arquivo}`,
                                    is_system: true
                                  });
                                  loadAnexos();
                                  loadComentarios();
                                } catch (error) {
                                  alert('Erro ao excluir anexo');
                                }
                              }}
                              className="neon-button text-xs px-3 py-1.5"
                              style={{ backgroundColor: '#FF006410', borderColor: '#FF0064', color: '#FF0064' }}
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
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
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
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

      {mostrarModalAnalise && os && (
        <AnaliseConcluidaModal
          isOpen={mostrarModalAnalise}
          osId={os.id}
          osNumero={os.numero_os_samsung || os.numero_os_interna || 'S/N'}
          onClose={() => setMostrarModalAnalise(false)}
          onSuccess={() => {
            loadOS();
            onReload?.();
          }}
        />
      )}

      {mostrarModalIniciarReparo && os && (
        <IniciarReparoModal
          osId={os.id}
          osNumero={os.numero_os_samsung || os.numero_os_interna || 'S/N'}
          unidadeId={os.unidade_id}
          currentTecnicoId={os.tecnico_designado_id}
          currentTecnicoNome={os.tecnico_designado_id ? 'Técnico Atual' : null}
          onClose={() => setMostrarModalIniciarReparo(false)}
          onSuccess={() => {
            setMostrarModalIniciarReparo(false);
            loadOS();
            onReload?.();
          }}
        />
      )}

      {mostrarModalReparoEfetuado && os && (
        <ReparoEfetuadoModal
          isOpen={mostrarModalReparoEfetuado}
          osId={os.id}
          osNumero={os.numero_os_samsung || os.numero_os_interna || 'S/N'}
          onClose={() => setMostrarModalReparoEfetuado(false)}
          onSuccess={() => {
            setMostrarModalReparoEfetuado(false);
            loadOS();
            onReload?.();
          }}
        />
      )}

      {mostrarModalServico && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={e => e.stopPropagation()}>
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
                    <p className="text-xs text-gray-400">Selecione um serviço da lista</p>
                  </div>
                </div>
                <button onClick={() => setMostrarModalServico(false)} className="text-gray-400 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>
            </div>

            <div className="p-4 border-b border-[#00D4FF]/20">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar por codigo ou nome..."
                  value={buscaServico}
                  onChange={(e) => setBuscaServico(e.target.value)}
                  className="neon-input w-full pl-4 pr-4 py-3"
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

                if (!os?.aparelho_linha) {
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
                        {buscaServico ? 'Nenhum serviço encontrado' : `Nenhum serviço cadastrado para ${os.aparelho_linha}`}
                      </p>
                      <p className="text-gray-600 text-xs mt-2">
                        {buscaServico ? 'Tente outro termo de busca' : 'Cadastre servicos para esta linha em Configuracoes'}
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="grid gap-3">
                    {servicosFiltrados.map((servico) => {
                      const jaAdicionado = servicos.some(s => s.servico_id === servico.id);
                      return (
                        <div
                          key={servico.id}
                          onClick={async () => {
                            try {
                              const isSCACC = os?.tipo_orcamento === 'samsung_contigo' || os?.tipo_orcamento === 'acessorios';
                              const table = isSCACC ? 'os_servicos' : 'cotacoes_servicos';

                              const servicoExistente = servicos.find(s => s.servico_id === servico.id);
                              if (servicoExistente) {
                                const { error } = await supabase
                                  .from(table)
                                  .update({
                                    quantidade: servicoExistente.quantidade + 1,
                                    valor_total: servicoExistente.valor_unitario * (servicoExistente.quantidade + 1)
                                  })
                                  .eq('id', servicoExistente.id);

                                if (error) {
                                  alert('Erro ao atualizar servico');
                                  return;
                                }
                              } else {
                                const valorBase = Number(servico.valor_base) || 0;
                                const dataToInsert: any = {
                                  os_id: osId,
                                  servico_id: servico.id,
                                  descricao: servico.nome || servico.descricao,
                                  valor_unitario: valorBase,
                                  quantidade: 1,
                                  valor_total: valorBase
                                };

                                if (table === 'os_servicos') {
                                  dataToInsert.codigo_servico = servico.codigo;
                                }

                                const { error } = await supabase
                                  .from(table)
                                  .insert(dataToInsert);

                                if (error) {
                                  alert('Erro ao adicionar servico: ' + error.message);
                                  return;
                                }
                              }
                              await loadServicos(true);
                              setBuscaServico('');
                              setMostrarModalServico(false);
                            } catch (err) {
                              alert('Erro ao processar servico');
                            }
                          }}
                          className="premium-card p-4 cursor-pointer transition-all hover:scale-[1.01] hover:border-[#00D4FF]"
                          style={{
                            borderColor: jaAdicionado ? 'rgba(var(--neon-green-rgb),0.35)' : 'rgba(var(--accent-rgb), 0.25)',
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

      {/* Modal de GI */}
      {mostrarModalGI && requisicaoGI && osId && (
        <GIModal
          requisicaoId={requisicaoGI.id}
          osId={osId}
          pecaNome={`${requisicaoGI.descricao} (${requisicaoGI.codigo_peca})`}
          isLote={requisicaoGI.is_lote}
          pecasLote={requisicaoGI.pecas_lote}
          onClose={() => {
            setMostrarModalGI(false);
            setRequisicaoGI(null);
          }}
          onSuccess={() => {
            loadRequisicoes();
            loadComentarios();
          }}
        />
      )}

      <RouteSelectionModal
        isOpen={mostrarSelecionarRotaObrigatoria}
        cidade={os?.cliente_cidade || ''}
        clienteNome={os?.cliente_nome}
        osNumero={os?.numero_os_samsung || os?.numero_os_interna || 'S/N'}
        clienteBairro={os?.cliente_bairro}
        onSelectRoute={handleRouteSelectAndMove}
        onCancel={() => {
          setMostrarSelecionarRotaObrigatoria(false);
          setColunaDestinoAposSelecionarRota(null);
        }}
      />

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

      {mostrarErroRequisicaoExistente && erroRequisicaoInfo && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-4" onClick={e => e.stopPropagation()}>
          <div className="premium-card w-full max-w-lg">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white">Requisição Já Existe</h3>
                  <p className="text-sm text-gray-400">Não é possível criar nova requisição</p>
                </div>
                <button
                  onClick={() => {
                    setMostrarErroRequisicaoExistente(false);
                    setErroRequisicaoInfo(null);
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-red-500/10 rounded-lg p-4 mb-6 border border-red-500/30">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white text-sm font-bold mb-2">Já existe uma requisição ativa para esta peça</p>
                    <div className="space-y-1 text-xs text-gray-300">
                      <p><span className="text-gray-400">Status:</span> <span className="font-bold text-red-400">{erroRequisicaoInfo.status}</span></p>
                      <p><span className="text-gray-400">ID:</span> <span className="font-mono">{erroRequisicaoInfo.id}</span></p>
                    </div>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setMostrarErroRequisicaoExistente(false);
                  setErroRequisicaoInfo(null);
                }}
                className="w-full px-6 py-3 rounded-lg font-bold transition-all bg-red-600 hover:bg-red-700 text-white"
              >
                Entendi
              </button>
            </div>
          </div>
        </div>
      )}

      {mostrarErroRequisicao && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[70] p-4" onClick={e => e.stopPropagation()}>
          <div className="premium-card w-full max-w-lg">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertCircle className="w-6 h-6 text-red-500" />
                </div>
                <div className="flex-1">
                  <h3 className="text-xl font-bold text-white">Erro ao Criar Requisição</h3>
                  <p className="text-sm text-gray-400">Não foi possível processar a requisição</p>
                </div>
                <button
                  onClick={() => {
                    setMostrarErroRequisicao(false);
                    setErroRequisicaoMsg('');
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="bg-red-500/10 rounded-lg p-4 mb-6 border border-red-500/30">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-white text-sm font-bold mb-2">Detalhes do erro:</p>
                    <p className="text-xs text-gray-300 leading-relaxed">{erroRequisicaoMsg}</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => {
                  setMostrarErroRequisicao(false);
                  setErroRequisicaoMsg('');
                }}
                className="w-full px-6 py-3 rounded-lg font-bold transition-all bg-red-600 hover:bg-red-700 text-white"
              >
                Fechar
              </button>
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

      {mostrarModalConvertTipo && os && (
        <ConvertTipoOSModal
          os={os}
          onClose={() => setMostrarModalConvertTipo(false)}
          onSuccess={() => {
            setMostrarModalConvertTipo(false);
            onReload?.();
            onClose();
          }}
        />
      )}

      {os && (
        <FecharOSModal
          isOpen={mostrarFecharOS}
          onClose={() => setMostrarFecharOS(false)}
          osId={os.id}
          osNumero={os.numero_os_samsung || os.numero_os_interna || 'S/N'}
          unidadeId={os.unidade_id}
          onSuccess={() => {
            onReload?.();
            onClose();
          }}
        />
      )}
      {os && (
        <VincularOSModal
          isOpen={showVincularModal}
          onClose={() => setShowVincularModal(false)}
          currentOS={os}
          onVinculado={() => {
            loadOS();
            onReload?.();
          }}
        />
      )}
    </div>
  );
}
