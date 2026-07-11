// v2.1.0 - Virtualized columns, memoized cards, debounced search
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { normalizarCidade } from '../lib/cidadeNormalize';
import { useAuth } from '../contexts/AuthContext';
import { UnitFilter } from '../components/UnitFilter';
import { OSModal } from '../components/OSModal';
import { OSLPModal } from '../components/OSLPModal';
import { AnaliseConcluidaModal } from '../components/AnaliseConcluidaModal';
import { IniciarReparoModal } from '../components/IniciarReparoModal';
import { ReparoEfetuadoModal } from '../components/ReparoEfetuadoModal';
import { DiagnosticoBlockModal, ConfirmMoveModal, PecasAtivasBlockModal, ErrorModal, InfoModal } from '../components/kanban/KanbanModals';
import { PecasInfoModal } from '../components/kanban/PecasInfoModal';
import { RouteSelectionModal } from '../components/kanban/RouteSelectionModal';
import { FecharOSModal } from '../components/FecharOSModal';
import { useDebounce } from '../components/kanban/useDebounce';
import { VirtualizedColumn } from '../components/kanban/VirtualizedColumn';
import { Search, AlertCircle, Activity, Zap, Clock, Plus, MapPin, CheckCircle, RefreshCw, Filter, ChevronDown, Download, X, Settings } from 'lucide-react';
import type { Database } from '../lib/database.types';
import { geocodeAddress } from '../lib/geocoding';

type OS = Database['public']['Tables']['os']['Row'];

const COLUNAS_KANBAN = [
  { id: 'os_nova', label: 'OS Nova', color: '#0EA5E9', icon: Zap },
  { id: 'diagnostico', label: 'Diagnóstico/Triagem', color: '#06B6D4', icon: Activity },
  { id: 'negociacao_em_andamento', label: 'Enviar Orçamento', color: '#F59E0B', icon: Clock },
  { id: 'aguardando_aprovacao', label: 'Aguardando Aprovação', color: '#F97316', icon: Clock },
  { id: 'orcamento_aprovado', label: 'Orçamento Aprovado', color: '#10B981', icon: Zap },
  { id: 'aguardando_peca', label: 'Aguardando Peça', color: '#8B5CF6', icon: Clock },
  { id: 'peca_em_transito', label: 'Peça em Trânsito', color: '#3B82F6', icon: Activity },
  { id: 'em_reparo_ci', label: 'Em Reparo CI', color: '#0EA5E9', icon: Activity },
  { id: 'rota_preta', label: 'Rota Preta', color: '#1a1a1a', icon: MapPin },
  { id: 'rota_vermelha', label: 'Rota Vermelha', color: '#EF4444', icon: MapPin },
  { id: 'rota_azul', label: 'Rota Azul', color: '#3B82F6', icon: MapPin },
  { id: 'rota_verde', label: 'Rota Verde', color: '#10B981', icon: MapPin },
  { id: 'rota_rosa', label: 'Rota Rosa', color: '#EC4899', icon: MapPin },
  { id: 'rota_amarela', label: 'Rota Amarela', color: '#EAB308', icon: MapPin },
  { id: 'rota_laranja', label: 'Rota Laranja', color: '#F97316', icon: MapPin },
  { id: 'em_rota_ih', label: 'Agendado', color: '#10B981', icon: Activity },
  { id: 'instalacao_inicial', label: 'Instalação Inicial', color: '#7C3AED', icon: Activity },
  { id: 'service_handling', label: 'Service Handling', color: '#DB2777', icon: Activity },
  { id: 'return_handling', label: 'Return Handling', color: '#D97706', icon: Activity },
  { id: 'trade_up', label: 'Trade Up', color: '#0891B2', icon: Activity },
  { id: 'saw', label: 'SAW', color: '#14B8A6', icon: Activity },
  { id: 'controle_qualidade', label: 'Controle de Qualidade / OQC', color: '#2563EB', icon: CheckCircle },
  { id: 'qa_bt', label: 'Q&A / BT', color: '#7C3AED', icon: CheckCircle },
  { id: 'reparo_concluido', label: 'Reparo Concluído', color: '#10B981', icon: Zap },
  { id: 'aguardando_fechamento', label: 'Aguardando Fechamento', color: '#F59E0B', icon: Clock },
  { id: 'os_fechada', label: 'OS Fechada', color: '#6B7280', icon: Zap },
  { id: 'orcamentos_rejeitados', label: 'Orçamentos Rejeitados', color: '#EF4444', icon: AlertCircle }
];

const COLUNAS_SC_ACC = [
  'os_nova',
  'negociacao_em_andamento',
  'aguardando_aprovacao',
  'orcamento_aprovado',
  'aguardando_peca',
  'peca_em_transito',
  'aguardando_fechamento',
  'os_fechada',
  'orcamentos_rejeitados'
];

const COLUNAS_CI = [
  'os_nova',
  'negociacao_em_andamento',
  'aguardando_aprovacao',
  'orcamento_aprovado',
  'aguardando_peca',
  'peca_em_transito',
  'aguardando_fechamento',
  'os_fechada',
  'orcamentos_rejeitados',
  'diagnostico',
  'em_reparo_ci',
  'instalacao_inicial',
  'service_handling',
  'return_handling',
  'trade_up',
  'saw',
  'controle_qualidade',
  'qa_bt',
  'reparo_concluido'
];

const COLUNAS_IH = [
  'os_nova',
  'negociacao_em_andamento',
  'aguardando_aprovacao',
  'orcamento_aprovado',
  'aguardando_peca',
  'peca_em_transito',
  'aguardando_fechamento',
  'os_fechada',
  'orcamentos_rejeitados',
  'diagnostico',
  'rota_preta',
  'rota_vermelha',
  'rota_azul',
  'rota_verde',
  'rota_rosa',
  'rota_amarela',
  'rota_laranja',
  'em_rota_ih',
  'instalacao_inicial',
  'service_handling',
  'return_handling',
  'trade_up',
  'saw',
  'controle_qualidade',
  'qa_bt',
  'reparo_concluido'
];

export function Kanban() {
  const { usuario } = useAuth();
  const [osData, setOsData] = useState<Record<string, OS[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [draggedCard, setDraggedCard] = useState<OS | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);
  const [dragOverPosition, setDragOverPosition] = useState<number | null>(null);
  const [columnSortOrder, setColumnSortOrder] = useState<Record<string, 'tat' | 'numero' | 'tempo_etapa' | 'sequencia'>>({});
  const [columnSortDir, setColumnSortDir] = useState<Record<string, 'asc' | 'desc'>>({});
  const [openSortDropdown, setOpenSortDropdown] = useState<string | null>(null);
  const [unidades, setUnidades] = useState<Array<{id: string; nome: string}>>([]);
  const [selectedUnidade, setSelectedUnidade] = useState('');
  const [selectedOSId, setSelectedOSId] = useState<string | null>(null);
  const [selectedOSTipo, setSelectedOSTipo] = useState<'LP' | 'OW' | 'NA' | null>(null);
  const [selectedOSTipoOrcamento, setSelectedOSTipoOrcamento] = useState<string | null>(null);
  const [selectedOSInitialTab, setSelectedOSInitialTab] = useState<string | undefined>(undefined);
  const [lastUserCommentMap, setLastUserCommentMap] = useState<Record<string, string>>({});
  const [commentReadMap, setCommentReadMap] = useState<Record<string, string>>({});
  const [criarOSLP, setCriarOSLP] = useState(false);
  const [criarOSOW, setCriarOSOW] = useState(false);
  const [criarOSSCACC, setCriarOSSCACC] = useState(false);
  const [mostrarInfoFinanceira, setMostrarInfoFinanceira] = useState(true);
  const [syncingSamsung, setSyncingSamsung] = useState(false);
  const [showAnaliseModal, setShowAnaliseModal] = useState(false);
  const [selectedOSForAnalise, setSelectedOSForAnalise] = useState<{ id: string; numero: string } | null>(null);
  const [showIniciarReparoModal, setShowIniciarReparoModal] = useState(false);
  const [selectedOSForReparo, setSelectedOSForReparo] = useState<{ id: string; numero: string; tecnicoId: string | null; tecnicoNome: string | null; unidadeId: string } | null>(null);
  const [showReparoEfetuadoModal, setShowReparoEfetuadoModal] = useState(false);
  const [selectedOSForOQC, setSelectedOSForOQC] = useState<{ id: string; numero: string } | null>(null);
  const [pendingOQCDrop, setPendingOQCDrop] = useState<{ card: OS; position: number | undefined } | null>(null);
  const autoScrollInterval = useRef<number | null>(null);
  const [showBadgeFilter, setShowBadgeFilter] = useState(false);
  const [showTipoFilter, setShowTipoFilter] = useState(false);
  const badgeFilterRef = useRef<HTMLDivElement>(null);
  const tipoFilterRef = useRef<HTMLDivElement>(null);
  const actionMenuRef = useRef<HTMLDivElement>(null);
  const columnsScrollRef = useRef<HTMLDivElement>(null);
  const [showActionMenu, setShowActionMenu] = useState(false);
  const defaultBadgeFilters = {
    pedidoAtivo: true,
    pecaTransito: true,
    comTecnico: true,
    agendamento: true,
    financeiro: true,
    lucro: true,
    sla: true,
    status: true,
    iniciarReparo: true,
    analiseConcluida: true,
    tecnico: true,
    fecharOS: true
  };
  const [badgeFilters, setBadgeFilters] = useState(() => {
    try {
      const saved = localStorage.getItem('kanban_badge_filters');
      return saved ? JSON.parse(saved) : defaultBadgeFilters;
    } catch { return defaultBadgeFilters; }
  });
  const [tipoOSFilters, setTipoOSFilters] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('kanban_tipo_os_filters');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [tipoAtendimentoFilters, setTipoAtendimentoFilters] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('kanban_tipo_atendimento_filters');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [tecnicoFilters, setTecnicoFilters] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('kanban_tecnico_filters');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [tecnicos, setTecnicos] = useState<Array<{id: string; nome: string}>>([]);
  const [minDiasAbertos, setMinDiasAbertos] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('kanban_min_dias_abertos');
      return saved ? parseInt(saved) || 0 : 0;
    } catch { return 0; }
  });
  const [showExportModal, setShowExportModal] = useState(false);
  const [searchMatchSource, setSearchMatchSource] = useState<Record<string, 'hidden' | 'visible'>>({});
  const [routePickerOS, setRoutePickerOS] = useState<OS | null>(null);
  const [showDiagnosticoBlock, setShowDiagnosticoBlock] = useState(false);
  const [showConfirmMove, setShowConfirmMove] = useState(false);
  const [confirmMoveData, setConfirmMoveData] = useState<{ from: string; to: string; onConfirm: () => void } | null>(null);
  const [showPecasAtivasBlock, setShowPecasAtivasBlock] = useState(false);
  const [pecasAtivasData, setPecasAtivasData] = useState<any[]>([]);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalData, setErrorModalData] = useState<{ title: string; message: string }>({ title: '', message: '' });
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [infoModalData, setInfoModalData] = useState<{ title: string; message: string }>({ title: '', message: '' });
  const [showPecasInfoModal, setShowPecasInfoModal] = useState(false);
  const [mandatoryRoutePickerOS, setMandatoryRoutePickerOS] = useState<OS | null>(null);
  const [pendingMandatoryMove, setPendingMandatoryMove] = useState<{ targetColumn: string; position?: number } | null>(null);
  const [rotas, setRotas] = useState<Array<{ id: string; nome: string; cor: string | null; cidades: string[]; coluna_kanban: string }>>([]);
  const [showBuscarOSModal, setShowBuscarOSModal] = useState(false);
  const [buscarOSNumero, setBuscarOSNumero] = useState('');
  const [buscarOSLoading, setBuscarOSLoading] = useState(false);
  const [buscarOSResult, setBuscarOSResult] = useState<{ status: 'success' | 'error'; message: string } | null>(null);
  const [showFecharOSModal, setShowFecharOSModal] = useState(false);
  const [fecharOSCardData, setFecharOSCardData] = useState<{ id: string; numero: string; unidadeId: string } | null>(null);
  const [pendingFecharOSDrop, setPendingFecharOSDrop] = useState<{ card: OS; position: number | undefined } | null>(null);

  const debouncedSearchTerm = useDebounce(searchTerm, 300);
  const debouncedTipoOSFilters = useDebounce(tipoOSFilters, 200);
  const debouncedTipoAtendimentoFilters = useDebounce(tipoAtendimentoFilters, 200);
  const debouncedTecnicoFilters = useDebounce(tecnicoFilters, 200);
  const debouncedMinDiasAbertos = useDebounce(minDiasAbertos, 300);

  const getTextColor = (colunaId: string, originalColor: string) => {
    if (colunaId === 'rota_preta') {
      return '#ffffff';
    }
    return originalColor;
  };

  const normalizeCidade = (cidade: string | null | undefined): string => {
    if (!cidade) return '';
    return cidade
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos
      .trim();
  };

  const findRotaByCidade = (cidade: string | null | undefined): { coluna: string; nome: string } | null => {
    if (!cidade) return null;
    const cidadeNormalizada = normalizeCidade(cidade);

    for (const rota of rotas) {
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

  const tatCache = useRef<Map<string, number>>(new Map());

  const calcularTAT = useCallback((createdAt: string) => {
    if (tatCache.current.has(createdAt)) return tatCache.current.get(createdAt)!;
    const now = new Date();
    const created = new Date(createdAt);
    const dias = Math.floor((now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24));
    tatCache.current.set(createdAt, dias);
    return dias;
  }, []);

  useEffect(() => {
    loadUnidades();
  }, []);

  useEffect(() => {
    localStorage.setItem('kanban_badge_filters', JSON.stringify(badgeFilters));
  }, [badgeFilters]);

  useEffect(() => {
    localStorage.setItem('kanban_tipo_os_filters', JSON.stringify(tipoOSFilters));
  }, [tipoOSFilters]);

  useEffect(() => {
    localStorage.setItem('kanban_tipo_atendimento_filters', JSON.stringify(tipoAtendimentoFilters));
  }, [tipoAtendimentoFilters]);

  useEffect(() => {
    localStorage.setItem('kanban_tecnico_filters', JSON.stringify(tecnicoFilters));
  }, [tecnicoFilters]);

  useEffect(() => {
    localStorage.setItem('kanban_min_dias_abertos', String(minDiasAbertos));
  }, [minDiasAbertos]);

  useEffect(() => {
    loadTecnicos();
  }, [selectedUnidade]);

  useEffect(() => {
    if (usuario) {
      const canSeeAllUnits = (usuario.tipo === 'master' || usuario.tipo === 'diretoria') && !usuario.unidade_id;
      if (!canSeeAllUnits && usuario.unidade_id && !selectedUnidade) {
        setSelectedUnidade(usuario.unidade_id);
      } else {
        loadKanbanData();
      }
    }
  }, [usuario]);

  useEffect(() => {
    if (usuario) {
      loadKanbanData();
    }
  }, [selectedUnidade]);

  useEffect(() => {
    return () => {
      if (autoScrollInterval.current) {
        clearInterval(autoScrollInterval.current);
      }
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (badgeFilterRef.current && !badgeFilterRef.current.contains(target)) {
        setShowBadgeFilter(false);
      }
      if (tipoFilterRef.current && !tipoFilterRef.current.contains(target)) {
        setShowTipoFilter(false);
      }
      if (actionMenuRef.current && !actionMenuRef.current.contains(target)) {
        setShowActionMenu(false);
      }
      if (!target || !(target as HTMLElement).closest?.('[data-sort-dropdown]')) {
        setOpenSortDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadUnidades = async () => {
    const { data } = await supabase.from('unidades').select('id, nome').order('nome');
    setUnidades(data || []);
  };

  const loadTecnicos = async () => {
    if (!selectedUnidade) {
      setTecnicos([]);
      return;
    }
    const { data } = await supabase
      .from('usuarios')
      .select('id, nome')
      .eq('tipo', 'tecnico')
      .eq('ativo', true)
      .eq('unidade_id', selectedUnidade)
      .order('nome');
    setTecnicos(data || []);
  };

  const syncSamsungGSPN = async () => {
    if (!selectedUnidade) {
      setInfoModalData({
        title: 'Sincronização Samsung',
        message: 'Selecione uma unidade para atualizar.'
      });
      setShowInfoModal(true);
      return;
    }

    setSyncingSamsung(true);
    try {
      const { data: unidadeData } = await supabase
        .from('unidades')
        .select('nome, samsung_asccode, samsung_token')
        .eq('id', selectedUnidade)
        .single();

      if (!unidadeData) {
        setInfoModalData({
          title: 'Sincronização Samsung',
          message: 'Unidade não encontrada.'
        });
        setShowInfoModal(true);
        return;
      }

      if (!unidadeData.samsung_asccode || !unidadeData.samsung_token) {
        setInfoModalData({
          title: 'Configuração Incompleta',
          message: 'Esta unidade não possui configuração Samsung (ASC Code ou Token não configurados).'
        });
        setShowInfoModal(true);
        return;
      }

      const response = await fetch('https://atom-n8n.2vhnbz.easypanel.host/webhook/atualizar-os', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ascCode: unidadeData.samsung_asccode,
          tokenApi: unidadeData.samsung_token,
          filial: unidadeData.nome.toLowerCase(),
          unidade_id: selectedUnidade
        }),
      });

      const result = await response.json();

      if (response.ok && result.status === 'success') {
        await loadKanbanData();
      } else {
        setErrorModalData({
          title: 'Erro na Sincronização',
          message: result.message || 'Erro desconhecido ao sincronizar com Samsung.'
        });
        setShowErrorModal(true);
      }
    } catch (error) {
      setErrorModalData({
        title: 'Erro ao Sincronizar',
        message: error instanceof Error ? error.message : 'Erro desconhecido ao sincronizar.'
      });
      setShowErrorModal(true);
    } finally {
      setSyncingSamsung(false);
    }
  };

  const buscarOSPorNumero = async () => {
    if (!selectedUnidade || !buscarOSNumero.trim()) return;

    setBuscarOSLoading(true);
    setBuscarOSResult(null);

    try {
      const { data: unidadeData } = await supabase
        .from('unidades')
        .select('nome, samsung_asccode, samsung_token')
        .eq('id', selectedUnidade)
        .single();

      if (!unidadeData) {
        setBuscarOSResult({ status: 'error', message: 'Unidade não encontrada.' });
        return;
      }

      if (!unidadeData.samsung_asccode || !unidadeData.samsung_token) {
        setBuscarOSResult({ status: 'error', message: 'Esta unidade não possui configuração Samsung (ASC Code ou Token não configurados).' });
        return;
      }

      const response = await fetch('https://atom-n8n.2vhnbz.easypanel.host/webhook/atualizar-os/por-os', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ascCode: unidadeData.samsung_asccode,
          tokenApi: unidadeData.samsung_token,
          filial: unidadeData.nome.toLowerCase(),
          unidade_id: selectedUnidade,
          numero_os: buscarOSNumero.trim()
        }),
      });

      const result = await response.json();

      if (result.status === 'success') {
        setBuscarOSResult({ status: 'success', message: result.message || 'Processamento realizado com sucesso. A OS será importada em breve.' });
      } else {
        setBuscarOSResult({ status: 'error', message: result.message || 'Erro desconhecido ao buscar OS.' });
      }
    } catch (error) {
      setBuscarOSResult({ status: 'error', message: error instanceof Error ? error.message : 'Erro desconhecido ao buscar OS.' });
    } finally {
      setBuscarOSLoading(false);
    }
  };

  const loadKanbanData = async () => {
    try {
      let query = supabase
        .from('os')
        .select(`
          *,
          cotacao:cotacoes!os_cotacao_id_fkey(
            numero_cotacao,
            taxa_para_cliente
          ),
          os_pecas:os_pecas(
            pn,
            descricao,
            valor_gspn,
            quantidade,
            estoque_peca_id
          ),
          requisicoes:requisicoes_pecas(
            id,
            status,
            descricao,
            codigo_peca,
            observacoes_pedido,
            valor_peca,
            numero_pedido_samsung,
            created_at,
            is_lote,
            pecas_estoque_ids,
            peca_estoque:estoque_pecas!requisicoes_pecas_peca_estoque_id_fkey(
              delivery,
              pn,
              estoque_etiquetas(
                id_sequencial,
                delivery
              )
            )
          ),
          pagamentos:pagamentos(
            taxa_valor
          ),
          unidade:unidades!os_unidade_id_fkey(nome),
          tecnico_agendado:usuarios!os_tecnico_agendado_id_fkey(nome),
          tecnico_designado:usuarios!os_tecnico_designado_id_fkey(nome),
          alertas_fechamento:os_alertas_fechamento(id, severidade, regra_titulo, resolvido)
        `);

      // Verificar se o usuario pode ver todas as unidades (master/diretoria SEM unidade vinculada)
      const canSeeAllUnits = (usuario?.tipo === 'master' || usuario?.tipo === 'diretoria') && !usuario?.unidade_id;

      // Usuarios comuns SEMPRE devem filtrar pela sua unidade - SEGURANCA CRITICA
      if (!canSeeAllUnits) {
        const unidadeObrigatoria = usuario?.unidade_id;
        if (!unidadeObrigatoria) {
          setOsData({});
          setLoading(false);
          return;
        }
        query = query.eq('unidade_id', unidadeObrigatoria);
      } else if (selectedUnidade) {
        query = query.eq('unidade_id', selectedUnidade);
      }
      query = query.neq('arquivada', true);
      const allData: any[] = [];
      let from = 0;
      const pageSize = 1000;
      let hasMore = true;

      while (hasMore) {
        const { data: page, error: pageError } = await query
          .order('sequencia_coluna', { ascending: true })
          .range(from, from + pageSize - 1);

        if (pageError) throw pageError;

        if (page && page.length > 0) {
          allData.push(...page);
          from += pageSize;
          hasMore = page.length === pageSize;
        } else {
          hasMore = false;
        }
      }

      const data = allData;

      // Buscar peças do lote para requisições que têm lote
      const allRequisicoes = (data || []).flatMap(os => (os as any).requisicoes || []);
      const requisicoesComLote = allRequisicoes.filter((r: any) => r.is_lote && r.pecas_estoque_ids?.length > 0);

      if (requisicoesComLote.length > 0) {
        const todosPecaIds = [...new Set(requisicoesComLote.flatMap((r: any) => r.pecas_estoque_ids))];

        const { data: pecasLoteData } = await supabase
          .from('estoque_pecas')
          .select(`
            id,
            gi_postada_em,
            gi_postada_por,
            gi_cancelada_em,
            gi_cancelada_por,
            estoque_etiquetas(id_sequencial, delivery),
            usuario_gi_postado:usuarios!estoque_pecas_gi_postada_por_fkey(nome),
            usuario_gi_cancelado:usuarios!estoque_pecas_gi_cancelada_por_fkey(nome)
          `)
          .in('id', todosPecaIds);

        // Mapear peças por ID
        const pecasMap = new Map(pecasLoteData?.map(p => [p.id, p]) || []);

        // Adicionar pecas_lote nas requisições
        requisicoesComLote.forEach((req: any) => {
          req.pecas_lote = req.pecas_estoque_ids
            ?.map((id: string) => pecasMap.get(id))
            .filter(Boolean);
        });
      }

      const grouped = COLUNAS_KANBAN.reduce((acc, coluna) => {
        acc[coluna.id] = (data || [])
          .filter(os => os.coluna_kanban === coluna.id)
          .map(os => ({
            ...os,
            sequencia_coluna: os.sequencia_coluna ?? 0
          }));
        return acc;
      }, {} as Record<string, OS[]>);

      setOsData(grouped);

      // Load last user comment timestamp for each OS
      const allOsIds = (data || []).map(os => os.id);
      if (allOsIds.length > 0) {
        const { data: comentariosData } = await supabase
          .from('os_comentarios')
          .select('os_id, created_at')
          .in('os_id', allOsIds)
          .or('is_system.is.null,is_system.eq.false')
          .order('created_at', { ascending: false });

        if (comentariosData) {
          const lastCommentMap: Record<string, string> = {};
          for (const c of comentariosData) {
            if (c.os_id && !lastCommentMap[c.os_id]) {
              lastCommentMap[c.os_id] = c.created_at;
            }
          }
          setLastUserCommentMap(lastCommentMap);
        }

        // Load read timestamps for current user
        if (usuario?.id) {
          const { data: leituraData } = await supabase
            .from('os_comentarios_leitura')
            .select('os_id, last_read_at')
            .eq('usuario_id', usuario.id)
            .in('os_id', allOsIds);

          if (leituraData) {
            const readMap: Record<string, string> = {};
            for (const l of leituraData) {
              if (l.os_id) readMap[l.os_id] = l.last_read_at;
            }
            setCommentReadMap(readMap);
          }
        }
      }

      // Carregar rotas para validação de cidades IH
      const unidadeParaRotas = selectedUnidade || usuario?.unidade_id;
      if (unidadeParaRotas) {
        const { data: rotasData } = await supabase
          .from('rotas')
          .select('id, nome, cor, cidades, coluna_kanban')
          .eq('unidade_id', unidadeParaRotas)
          .eq('ativa', true);

        if (rotasData) {
          setRotas(rotasData);
        }
      } else {
        const { data: rotasData } = await supabase
          .from('rotas')
          .select('id, nome, cor, cidades, coluna_kanban')
          .eq('ativa', true);

        if (rotasData) {
          setRotas(rotasData);
        }
      }
    } catch (error) {
      // ignored
    } finally {
      setLoading(false);
    }
  };

  const handleDragStart = (e: React.DragEvent, os: OS) => {
    if (os.coluna_kanban === 'diagnostico') {
      e.preventDefault();
      setShowDiagnosticoBlock(true);
      return;
    }
    setDraggedCard(os);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverColumn(columnId);
  };

  const handleCardDragOver = (e: React.DragEvent, columnId: string, index: number) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedCard || draggedCard.coluna_kanban !== columnId || columnSortOrder[columnId] !== 'sequencia') {
      return;
    }

    const card = e.currentTarget as HTMLElement;
    const rect = card.getBoundingClientRect();
    const mouseY = e.clientY - rect.top;
    const cardHeight = rect.height;

    // Se o mouse está na metade superior do card, insere antes (index)
    // Se está na metade inferior, insere depois (index + 1)
    const newPosition = mouseY < cardHeight / 2 ? index : index + 1;

    setDragOverColumn(columnId);
    setDragOverPosition(newPosition);
  };

  const handleContainerDragOver = (e: React.DragEvent) => {
    if (!draggedCard) return;

    const kanbanContainer = e.currentTarget;
    const rect = kanbanContainer.getBoundingClientRect();
    const scrollThreshold = 80;
    const scrollSpeed = 7;
    const mouseX = e.clientX - rect.left;

    const isInLeftZone = mouseX < scrollThreshold && mouseX >= 0;
    const isInRightZone = mouseX > rect.width - scrollThreshold && mouseX <= rect.width;

    if (!isInLeftZone && !isInRightZone) {
      if (autoScrollInterval.current) {
        clearInterval(autoScrollInterval.current);
        autoScrollInterval.current = null;
      }
      return;
    }

    if (!autoScrollInterval.current) {
      if (isInLeftZone) {
        autoScrollInterval.current = window.setInterval(() => {
          if (kanbanContainer.scrollLeft > 0) {
            kanbanContainer.scrollLeft -= scrollSpeed;
          }
        }, 30);
      } else if (isInRightZone) {
        autoScrollInterval.current = window.setInterval(() => {
          if (kanbanContainer.scrollLeft < kanbanContainer.scrollWidth - kanbanContainer.clientWidth) {
            kanbanContainer.scrollLeft += scrollSpeed;
          }
        }, 30);
      }
    }
  };

  const handleDragLeave = () => {
    setDragOverColumn(null);
    setDragOverPosition(null);
  };

  const handleContainerDragLeave = () => {
    if (autoScrollInterval.current) {
      clearInterval(autoScrollInterval.current);
      autoScrollInterval.current = null;
    }
  };

  const handleDragEnd = () => {
    if (autoScrollInterval.current) {
      clearInterval(autoScrollInterval.current);
      autoScrollInterval.current = null;
    }
  };

  const criarAgendamentoParaRota = async (os: OS) => {
    try {
      // Verificar se já existe agendamento para esta OS
      const { data: agendamentoExistente } = await supabase
        .from('agendamentos')
        .select('id, lat, lng')
        .eq('os_id', os.id)
        .maybeSingle();

      // Se já tem agendamento com coordenadas, não precisa criar novo
      if (agendamentoExistente?.lat && agendamentoExistente?.lng) {
        return;
      }

      // Buscar informações da unidade para data/hora padrão
      const { data: config } = await supabase
        .from('configuracoes_unidade')
        .select('horario_inicio, horario_fim')
        .eq('unidade_id', os.unidade_id)
        .maybeSingle();

      // Montar endereço completo
      const enderecoCompleto = `${os.cliente_endereco || ''}, ${os.cliente_bairro || ''}, ${os.cliente_cidade || ''}, ${os.cliente_estado || 'SP'}, Brasil`.trim();

      // Geocodificar endereço
      const coords = await geocodeAddress(enderecoCompleto);

      if (!coords) {
        // Criar agendamento sem coordenadas
        if (!agendamentoExistente) {
          await supabase
            .from('agendamentos')
            .insert({
              os_id: os.id,
              tecnico_id: os.tecnico_id || usuario?.id,
              data_agendamento: new Date().toISOString().split('T')[0],
              horario_inicio: config?.horario_inicio || '08:00',
              horario_fim: config?.horario_fim || '18:00',
              status: 'pendente_confirmacao',
              agendado_por: usuario?.id
            });
        }
        return;
      }

      // Criar ou atualizar agendamento com coordenadas
      if (agendamentoExistente) {
        await supabase
          .from('agendamentos')
          .update({
            lat: coords.lat,
            lng: coords.lng
          })
          .eq('id', agendamentoExistente.id);
      } else {
        await supabase
          .from('agendamentos')
          .insert({
            os_id: os.id,
            tecnico_id: os.tecnico_id || usuario?.id,
            data_agendamento: new Date().toISOString().split('T')[0],
            horario_inicio: config?.horario_inicio || '08:00',
            horario_fim: config?.horario_fim || '18:00',
            status: 'pendente_confirmacao',
            agendado_por: usuario?.id,
            lat: coords.lat,
            lng: coords.lng
          });
      }
    } catch (error) {
    }
  };

  const handleDrop = async (e: React.DragEvent, targetColumn: string) => {
    e.preventDefault();
    e.stopPropagation();
    const finalPosition = dragOverPosition;
    setDragOverColumn(null);
    setDragOverPosition(null);

    if (autoScrollInterval.current) {
      clearInterval(autoScrollInterval.current);
      autoScrollInterval.current = null;
    }

    if (!draggedCard) {
      return;
    }

    // Se for a mesma coluna e mesma posição, não faz nada
    const isSameColumn = draggedCard.coluna_kanban === targetColumn;
    if (isSameColumn && finalPosition === undefined) {
      setDraggedCard(null);
      return;
    }

    const colunaOrigem = COLUNAS_KANBAN.find(c => c.id === draggedCard.coluna_kanban);
    const colunaDestino = COLUNAS_KANBAN.find(c => c.id === targetColumn);

    if (targetColumn === 'os_fechada' && !isSameColumn) {
      const osNumero = draggedCard.numero_os_samsung || draggedCard.numero_os_interna || 'S/N';
      setFecharOSCardData({ id: draggedCard.id, numero: String(osNumero), unidadeId: draggedCard.unidade_id });
      setPendingFecharOSDrop({ card: draggedCard, position: finalPosition });
      setShowFecharOSModal(true);
      setDraggedCard(null);
      return;
    }

    const rotasColumns = ['rota_preta', 'rota_vermelha', 'rota_azul', 'rota_verde', 'rota_rosa', 'rota_amarela', 'rota_laranja'];

    // Verificar se a cidade tem uma cor de rota cadastrada antes de qualquer movimentação
    if (!isSameColumn) {
      const cidadeOS = draggedCard.cliente_cidade;
      const rotaEncontrada = findRotaByCidade(cidadeOS);

      if (!rotaEncontrada) {
        setMandatoryRoutePickerOS(draggedCard);
        setPendingMandatoryMove({ targetColumn, position: finalPosition });
        setDraggedCard(null);
        return;
      }

      if (!draggedCard.rota_id) {
        const rotaReal = rotas.find(r => r.coluna_kanban === rotaEncontrada.coluna);
        draggedCard.rota_id = rotaReal?.id || null;
      }
    }

    // Se for reordenação na mesma coluna
    if (isSameColumn && finalPosition !== undefined) {
      try {
        const cardsColuna = filteredData[targetColumn] || [];
        const currentIndex = cardsColuna.findIndex(os => os.id === draggedCard.id);

        if (currentIndex === finalPosition) {
          setDraggedCard(null);
          return;
        }

        // Calcular nova sequência
        let novaSequencia: number;

        if (finalPosition === 0) {
          // Mover para o início
          const primeiroCard = cardsColuna[0];
          const primeiroSeq = primeiroCard?.sequencia_coluna ?? 0;
          const segundoSeq = cardsColuna[1]?.sequencia_coluna ?? 0;
          novaSequencia = primeiroCard.id === draggedCard.id
            ? segundoSeq - 1
            : primeiroSeq - 1;
        } else if (finalPosition >= cardsColuna.length - 1) {
          // Mover para o final
          const ultimoCard = cardsColuna[cardsColuna.length - 1];
          const ultimoSeq = ultimoCard?.sequencia_coluna ?? 0;
          const penultimoSeq = cardsColuna[cardsColuna.length - 2]?.sequencia_coluna ?? 0;
          novaSequencia = ultimoCard.id === draggedCard.id
            ? penultimoSeq + 1
            : ultimoSeq + 1;
        } else {
          // Mover entre dois cards
          const cardAntes = cardsColuna[finalPosition - 1];
          const cardDepois = cardsColuna[finalPosition];
          const seqAntes = cardAntes?.sequencia_coluna ?? 0;
          const seqDepois = cardDepois?.sequencia_coluna ?? 0;
          novaSequencia = Math.floor((seqAntes + seqDepois) / 2);

          // Se não houver espaço, renumerar
          if (novaSequencia === seqAntes || novaSequencia === seqDepois) {
            await supabase.rpc('renumerar_sequencias_coluna', {
              p_coluna_kanban: targetColumn,
              p_unidade_id: draggedCard.unidade_id
            });

            // Recarregar dados após renumeração
            await loadKanbanData();
            setDraggedCard(null);
            return;
          }
        }

        // Atualizar a sequência do card arrastado
        const { error } = await supabase
          .from('os')
          .update({
            sequencia_coluna: novaSequencia,
            updated_at: new Date().toISOString()
          })
          .eq('id', draggedCard.id);

        if (error) throw error;

        // Atualizar localmente
        setOsData(prevData => {
          const newData = { ...prevData };
          const cards = [...(newData[targetColumn] || [])];
          const cardIndex = cards.findIndex(c => c.id === draggedCard.id);
          if (cardIndex !== -1) {
            cards[cardIndex] = { ...cards[cardIndex], sequencia_coluna: novaSequencia };
            cards.sort((a, b) => (a.sequencia_coluna ?? 0) - (b.sequencia_coluna ?? 0));
            newData[targetColumn] = cards;
          }
          return newData;
        });

        setDraggedCard(null);
        return;
      } catch (error: any) {
        setErrorModalData({
          title: 'Erro ao Reordenar OS',
          message: error?.message || 'Erro desconhecido'
        });
        setShowErrorModal(true);
        setDraggedCard(null);
        return;
      }
    }

    const rotasIds = ['rota_preta', 'rota_vermelha', 'rota_azul', 'rota_verde', 'rota_rosa', 'rota_amarela', 'rota_laranja'];
    const isOrigemAguardandoPeca = draggedCard.coluna_kanban === 'aguardando_peca';
    const isDestinoRota = rotasIds.includes(targetColumn);

    if (isOrigemAguardandoPeca && isDestinoRota) {
      const continueWithConfirmedMove = async () => {
        try {
          const { data: requisicoes } = await supabase
        .from('requisicoes_pecas')
        .select('id, status, codigo_peca, descricao, numero_pedido_samsung')
        .eq('os_id', draggedCard.id);

      // Verificar peças em processo ativo que realmente bloqueiam movimentação
      // Status que NÃO bloqueiam: 'pendente', 'reprovada', 'devolvida', 'cancelada'
      // (estes permitem criar nova requisição ou já foram finalizados)
      const pecasAtivas = requisicoes?.filter(r =>
        ['atendida', 'em_uso', 'gi_postada', 'pedido_feito'].includes(r.status)
      ) || [];

      // Colunas permitidas mesmo com peças ativas (relacionadas ao fluxo de peças e rotas)
      const colunasPermitidas = [
        'peca_em_transito',
        'aguardando_peca',
        'rota_preta',
        'rota_vermelha',
        'rota_azul',
        'rota_verde',
        'rota_rosa',
        'rota_amarela',
        'rota_laranja',
        'em_rota_ih',
        'reparo_concluido',
        'em_reparo_ci',
        'aguardando_fechamento',
        'os_fechada'
      ];

      // IMPORTANTE: Se não há peças ativas, permite mover para qualquer coluna
      // (incluindo voltar para cotações/orcamentos_rejeitados)
      if (pecasAtivas.length > 0 && !colunasPermitidas.includes(targetColumn)) {
        setPecasAtivasData(pecasAtivas);
        setShowPecasAtivasBlock(true);
        setDraggedCard(null);
        return;
      }

      if (targetColumn === 'controle_qualidade' && draggedCard.coluna_kanban !== 'controle_qualidade') {
        const osNumero = draggedCard.numero_os_samsung || draggedCard.numero_os_interna || draggedCard.id.slice(0, 8);
        setPendingOQCDrop({ card: draggedCard, position: finalPosition });
        setSelectedOSForOQC({ id: draggedCard.id, numero: String(osNumero) });
        setShowReparoEfetuadoModal(true);
        setDraggedCard(null);
        return;
      }

      // Calcular sequência para a nova coluna
      let novaSequencia: number;
      const cardsDestino = filteredData[targetColumn] || [];

      if (finalPosition === undefined || finalPosition >= cardsDestino.length) {
        // Adicionar no final
        const ultimoCard = cardsDestino[cardsDestino.length - 1];
        novaSequencia = ultimoCard ? (ultimoCard.sequencia_coluna ?? 0) + 1 : 0;
      } else if (finalPosition === 0) {
        // Adicionar no início
        const primeiroCard = cardsDestino[0];
        novaSequencia = primeiroCard ? (primeiroCard.sequencia_coluna ?? 0) - 1 : 0;
      } else {
        // Adicionar entre dois cards
        const cardAntes = cardsDestino[finalPosition - 1];
        const cardDepois = cardsDestino[finalPosition];
        const seqAntes = cardAntes?.sequencia_coluna ?? 0;
        const seqDepois = cardDepois?.sequencia_coluna ?? 0;
        novaSequencia = Math.floor((seqAntes + seqDepois) / 2);

        // Se não houver espaço, renumerar
        if (novaSequencia === seqAntes || novaSequencia === seqDepois) {
          await supabase.rpc('renumerar_sequencias_coluna', {
            p_coluna_kanban: targetColumn,
            p_unidade_id: draggedCard.unidade_id
          });

          // Recarregar dados após renumeração
          await loadKanbanData();
          setDraggedCard(null);
          return;
        }
      }

      const { error, data } = await supabase
        .from('os')
        .update({
          coluna_kanban: targetColumn,
          sequencia_coluna: novaSequencia,
          bloqueio_movimentacao_automatica: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', draggedCard.id)
        .select();

      if (error) {
        throw error;
      }

      const rotasColumns = ['rota_preta', 'rota_vermelha', 'rota_azul', 'rota_verde', 'rota_rosa', 'rota_amarela', 'rota_laranja'];
      if (rotasColumns.includes(targetColumn)) {
        await criarAgendamentoParaRota(draggedCard);
      }

      const updatedCard = { ...draggedCard, coluna_kanban: targetColumn, sequencia_coluna: novaSequencia };

      setOsData(prevData => {
        const newData = { ...prevData };
        newData[draggedCard.coluna_kanban] = newData[draggedCard.coluna_kanban].filter(os => os.id !== draggedCard.id);
        const newCards = [...(newData[targetColumn] || []), updatedCard];
        newCards.sort((a, b) => (a.sequencia_coluna ?? 0) - (b.sequencia_coluna ?? 0));
        newData[targetColumn] = newCards;
        return newData;
      });

      if (targetColumn === 'peca_em_transito' && updatedCard.cliente_cidade) {
        setRoutePickerOS(updatedCard);
      }
    } catch (error: any) {
      const errorMessage = error?.message || error?.error_description || error?.hint || 'Erro desconhecido';
      setErrorModalData({
        title: 'Erro ao Mover OS',
        message: errorMessage
      });
      setShowErrorModal(true);
      setDraggedCard(null);
    } finally {
      setDraggedCard(null);
    }
  };

      setConfirmMoveData({
        from: 'Aguardando Peça',
        to: colunaDestino?.label || targetColumn,
        onConfirm: continueWithConfirmedMove
      });
      setShowConfirmMove(true);
      setDraggedCard(null);
      return;
    }

    try {
      const { data: requisicoes } = await supabase
        .from('requisicoes_pecas')
        .select('id, status, codigo_peca, descricao, numero_pedido_samsung')
        .eq('os_id', draggedCard.id);

      const pecasAtivas = requisicoes?.filter(r =>
        ['atendida', 'em_uso', 'gi_postada', 'pedido_feito'].includes(r.status)
      ) || [];

      const colunasPermitidas = [
        'peca_em_transito',
        'aguardando_peca',
        'rota_preta',
        'rota_vermelha',
        'rota_azul',
        'rota_verde',
        'rota_rosa',
        'rota_amarela',
        'rota_laranja',
        'em_rota_ih',
        'reparo_concluido',
        'em_reparo_ci',
        'aguardando_fechamento',
        'os_fechada'
      ];

      if (pecasAtivas.length > 0 && !colunasPermitidas.includes(targetColumn)) {
        const statusLabels: Record<string, string> = {
          pedido_feito: '🚚 Pedido Ativo',
          atendida: '✅ Peça Atendida',
          em_uso: '🔧 Em Uso',
          gi_postada: '📦 GI Pendente'
        };

        setPecasAtivasData(pecasAtivas);
        setShowPecasAtivasBlock(true);
        setDraggedCard(null);
        return;
      }

      if (targetColumn === 'controle_qualidade' && draggedCard.coluna_kanban !== 'controle_qualidade') {
        const osNumero = draggedCard.numero_os_samsung || draggedCard.numero_os_interna || draggedCard.id.slice(0, 8);
        setPendingOQCDrop({ card: draggedCard, position: finalPosition });
        setSelectedOSForOQC({ id: draggedCard.id, numero: String(osNumero) });
        setShowReparoEfetuadoModal(true);
        setDraggedCard(null);
        return;
      }

      let novaSequencia: number;
      const cardsDestino = filteredData[targetColumn] || [];

      if (finalPosition === undefined || finalPosition >= cardsDestino.length) {
        const ultimoCard = cardsDestino[cardsDestino.length - 1];
        novaSequencia = ultimoCard ? (ultimoCard.sequencia_coluna ?? 0) + 1 : 0;
      } else if (finalPosition === 0) {
        const primeiroCard = cardsDestino[0];
        novaSequencia = primeiroCard ? (primeiroCard.sequencia_coluna ?? 0) - 1 : 0;
      } else {
        const cardAntes = cardsDestino[finalPosition - 1];
        const cardDepois = cardsDestino[finalPosition];
        const seqAntes = cardAntes?.sequencia_coluna ?? 0;
        const seqDepois = cardDepois?.sequencia_coluna ?? 0;
        novaSequencia = Math.floor((seqAntes + seqDepois) / 2);

        if (novaSequencia === seqAntes || novaSequencia === seqDepois) {
          await supabase.rpc('renumerar_sequencias_coluna', {
            p_coluna_kanban: targetColumn,
            p_unidade_id: draggedCard.unidade_id
          });
          await loadKanbanData();
          setDraggedCard(null);
          return;
        }
      }

      const { error } = await supabase
        .from('os')
        .update({
          coluna_kanban: targetColumn,
          sequencia_coluna: novaSequencia,
          bloqueio_movimentacao_automatica: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', draggedCard.id);

      if (error) throw error;

      const rotasColumns = ['rota_preta', 'rota_vermelha', 'rota_azul', 'rota_verde', 'rota_rosa', 'rota_amarela', 'rota_laranja'];
      if (rotasColumns.includes(targetColumn)) {
        await criarAgendamentoParaRota(draggedCard);
      }

      const updatedCard = { ...draggedCard, coluna_kanban: targetColumn, sequencia_coluna: novaSequencia };

      setOsData(prevData => {
        const newData = { ...prevData };
        newData[draggedCard.coluna_kanban] = newData[draggedCard.coluna_kanban].filter(os => os.id !== draggedCard.id);
        const newCards = [...(newData[targetColumn] || []), updatedCard];
        newCards.sort((a, b) => (a.sequencia_coluna ?? 0) - (b.sequencia_coluna ?? 0));
        newData[targetColumn] = newCards;
        return newData;
      });

      if (targetColumn === 'peca_em_transito' && updatedCard.cliente_cidade) {
        setRoutePickerOS(updatedCard);
      }
    } catch (error: any) {
      const errorMessage = error?.message || error?.error_description || error?.hint || 'Erro desconhecido';
      setErrorModalData({
        title: 'Erro ao Mover OS',
        message: errorMessage
      });
      setShowErrorModal(true);
    } finally {
      setDraggedCard(null);
    }
  };

  const handleRoutePickerSelect = async (targetColumn: string) => {
    if (!routePickerOS) return;
    const osId = routePickerOS.id;
    const prevColumn = routePickerOS.coluna_kanban;
    setRoutePickerOS(null);

    try {
      const { error } = await supabase
        .from('os')
        .update({ coluna_kanban: targetColumn, bloqueio_movimentacao_automatica: true, updated_at: new Date().toISOString() })
        .eq('id', osId);
      if (error) throw error;

      setOsData(prevData => {
        const newData = { ...prevData };
        newData[prevColumn] = (newData[prevColumn] || []).filter(os => os.id !== osId);
        const card = { ...routePickerOS!, coluna_kanban: targetColumn };
        newData[targetColumn] = [...(newData[targetColumn] || []), card];
        return newData;
      });

      const rotasColumns = ['rota_preta', 'rota_vermelha', 'rota_azul', 'rota_verde', 'rota_rosa', 'rota_amarela', 'rota_laranja'];
      if (rotasColumns.includes(targetColumn)) {
        await criarAgendamentoParaRota(routePickerOS!);
      }
    } catch (err: any) {
      setErrorModalData({
        title: 'Erro ao Mover para Rota',
        message: err?.message || 'Erro desconhecido'
      });
      setShowErrorModal(true);
      await loadKanbanData();
    }
  };

  const handleMandatoryRouteSelect = async (rotaColumn: string, cidadeCorrigidaParam?: string) => {
    if (!mandatoryRoutePickerOS || !pendingMandatoryMove) return;

    const osId = mandatoryRoutePickerOS.id;
    const prevColumn = mandatoryRoutePickerOS.coluna_kanban;
    const { targetColumn, position: finalPosition } = pendingMandatoryMove;
    const cidadeOS = cidadeCorrigidaParam && cidadeCorrigidaParam.trim() !== '' ? cidadeCorrigidaParam.trim() : mandatoryRoutePickerOS.cliente_cidade;

    const rotaColorMap: Record<string, { nome: string; cor: string }> = {
      'rota_preta': { nome: 'Rota Preta', cor: '#1a1a1a' },
      'rota_vermelha': { nome: 'Rota Vermelha', cor: '#EF4444' },
      'rota_azul': { nome: 'Rota Azul', cor: '#3B82F6' },
      'rota_verde': { nome: 'Rota Verde', cor: '#10B981' },
      'rota_rosa': { nome: 'Rota Rosa', cor: '#EC4899' },
      'rota_amarela': { nome: 'Rota Amarela', cor: '#EAB308' },
      'rota_laranja': { nome: 'Rota Laranja', cor: '#F97316' },
    };

    let rotaSelecionada = rotas.find(r => r.coluna_kanban === rotaColumn);
    let rotaIdReal = rotaSelecionada?.id || null;

    const unidadeParaRota = mandatoryRoutePickerOS.unidade_id || selectedUnidade || usuario?.unidade_id;

    setMandatoryRoutePickerOS(null);
    setPendingMandatoryMove(null);

    try {
      if (!rotaSelecionada && unidadeParaRota) {
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
            unidade_id: unidadeParaRota
          })
          .select()
          .single();

        if (errCriar) throw errCriar;

        rotaSelecionada = novaRota;
        rotaIdReal = novaRota.id;
        setRotas(prev => [...prev, novaRota]);
      } else if (cidadeOS && rotaSelecionada) {
        const cidadeNormalizada = normalizeCidade(cidadeOS);
        const cidadesNormalizadas = rotaSelecionada.cidades.map(c => normalizeCidade(c));

        if (!cidadesNormalizadas.includes(cidadeNormalizada)) {
          const novasCidades = [...rotaSelecionada.cidades, cidadeOS];

          await supabase
            .from('rotas')
            .update({ cidades: novasCidades })
            .eq('id', rotaSelecionada.id);

          setRotas(prev => prev.map(r =>
            r.id === rotaSelecionada!.id
              ? { ...r, cidades: novasCidades }
              : r
          ));
        }
      }
      let novaSequencia: number = 0;
      const cardsDestino = filteredData[targetColumn] || [];

      if (finalPosition === undefined || finalPosition >= cardsDestino.length) {
        const ultimoCard = cardsDestino[cardsDestino.length - 1];
        novaSequencia = ultimoCard ? (ultimoCard.sequencia_coluna ?? 0) + 1 : 0;
      } else if (finalPosition === 0) {
        const primeiroCard = cardsDestino[0];
        novaSequencia = primeiroCard ? (primeiroCard.sequencia_coluna ?? 0) - 1 : 0;
      } else {
        const cardAntes = cardsDestino[finalPosition - 1];
        const cardDepois = cardsDestino[finalPosition];
        const seqAntes = cardAntes?.sequencia_coluna ?? 0;
        const seqDepois = cardDepois?.sequencia_coluna ?? 0;
        novaSequencia = Math.floor((seqAntes + seqDepois) / 2);
      }

      // Normalizar e corrigir nome da cidade
      const cidadeAtual = cidadeOS;
      let cidadeCorrigida = cidadeAtual || mandatoryRoutePickerOS.cliente_cidade;

      if (rotaSelecionada && cidadeAtual) {
        const cidadeNormalizada = normalizeCidade(cidadeAtual);
        // Buscar a cidade correta na lista de cidades da rota (com capitalização e acentos corretos)
        const cidadeCorrectaNaLista = rotaSelecionada.cidades.find(
          c => normalizeCidade(c) === cidadeNormalizada
        );
        if (cidadeCorrectaNaLista) {
          cidadeCorrigida = cidadeCorrectaNaLista;
        }
      }

      const { error } = await supabase
        .from('os')
        .update({
          coluna_kanban: targetColumn,
          sequencia_coluna: novaSequencia,
          rota_id: rotaIdReal,
          cliente_cidade: cidadeCorrigida,
          bloqueio_movimentacao_automatica: false,
          updated_at: new Date().toISOString()
        })
        .eq('id', osId);

      if (error) throw error;

      const updatedCard = { ...mandatoryRoutePickerOS, coluna_kanban: targetColumn, sequencia_coluna: novaSequencia, rota_id: rotaIdReal, cliente_cidade: cidadeCorrigida };

      setOsData(prevData => {
        const newData = { ...prevData };
        newData[prevColumn] = (newData[prevColumn] || []).filter(os => os.id !== osId);
        const newCards = [...(newData[targetColumn] || []), updatedCard];
        newCards.sort((a, b) => (a.sequencia_coluna ?? 0) - (b.sequencia_coluna ?? 0));
        newData[targetColumn] = newCards;
        return newData;
      });

    } catch (err: any) {
      setErrorModalData({
        title: 'Erro ao Definir Rota',
        message: err?.message || 'Erro desconhecido'
      });
      setShowErrorModal(true);
      await loadKanbanData();
    }
  };

  // Função de busca universal profunda
  const performUniversalSearch = (os: any, term: string): { matches: boolean; source: 'visible' | 'hidden' } => {
    if (!term) return { matches: true, source: 'visible' };

    const searchLower = term.toLowerCase();

    // Busca em campos visíveis do card
    const visibleFields = [
      os.cliente_nome,
      os.cliente_cpf,
      os.numero_os_samsung,
      os.numero_os_interna,
      os.aparelho_modelo,
      os.aparelho_marca,
      os.cliente_telefone,
      os.cliente_telefone_2,
      os.cliente_email,
      os.aparelho_nserie,
      os.aparelho_imei,
      os.valor_total?.toString(),
      os.valor_pago?.toString(),
      os.saldo_restante?.toString(),
      os.cliente_logradouro,
      os.cliente_bairro,
      os.cliente_cidade,
      os.cliente_estado,
      os.cliente_cep,
      os.defeito_relatado,
      os.diagnostico,
      os.observacoes_internas
    ];

    const matchesVisible = visibleFields.some(field =>
      field && field.toString().toLowerCase().includes(searchLower)
    );

    if (matchesVisible) {
      return { matches: true, source: 'visible' };
    }

    // Busca em peças (os_pecas)
    const osPecas = (os as any).os_pecas || [];
    const allPecas = [...osPecas];

    const matchesPecas = allPecas.some((peca: any) => {
      // Busca básica em código e descrição
      const basicMatch =
        (peca.pn && peca.pn.toLowerCase().includes(searchLower)) ||
        (peca.descricao && peca.descricao.toLowerCase().includes(searchLower));

      // Busca em delivery do estoque vinculado
      const deliveryMatch = peca.estoque_peca?.delivery &&
        peca.estoque_peca.delivery.toLowerCase().includes(searchLower);

      // Busca em ID da etiqueta do estoque vinculado
      const etiquetaMatch = peca.estoque_peca?.estoque_etiquetas?.some((etiq: any) =>
        etiq.id_sequencial && etiq.id_sequencial.toString().includes(searchLower)
      );

      return basicMatch || deliveryMatch || etiquetaMatch;
    });

    if (matchesPecas) {
      return { matches: true, source: 'hidden' };
    }

    // Busca em requisições - inclui delivery e ID da etiqueta
    const requisicoes = (os as any).requisicoes || [];
    const matchesRequisicoes = requisicoes.some((req: any) => {
      const basicMatch =
        (req.codigo_peca && req.codigo_peca.toLowerCase().includes(searchLower)) ||
        (req.descricao && req.descricao.toLowerCase().includes(searchLower)) ||
        (req.observacoes_pedido && req.observacoes_pedido.toLowerCase().includes(searchLower)) ||
        (req.numero_pedido_samsung && req.numero_pedido_samsung.toLowerCase().includes(searchLower)) ||
        (req.peca_estoque?.delivery && req.peca_estoque.delivery.toLowerCase().includes(searchLower)) ||
        (req.peca_estoque?.pn && req.peca_estoque.pn.toLowerCase().includes(searchLower));

      // Busca em ID da etiqueta
      const etiquetaMatch = req.peca_estoque?.estoque_etiquetas?.some((etiq: any) =>
        etiq.id_sequencial && etiq.id_sequencial.toString().includes(searchLower)
      );

      return basicMatch || etiquetaMatch;
    });

    if (matchesRequisicoes) {
      return { matches: true, source: 'hidden' };
    }

    return { matches: false, source: 'visible' };
  };

  const { filteredData, computedMatchSource } = useMemo(() => {
    const newMatchSource: Record<string, 'hidden' | 'visible'> = {};

    const result = Object.keys(osData).reduce((acc, coluna) => {
      let filtered = osData[coluna].filter(os => {
        const searchResult = performUniversalSearch(os, debouncedSearchTerm);

        if (searchResult.matches && searchResult.source === 'hidden') {
          newMatchSource[os.id] = 'hidden';
        }

        const matchesTipoOS = debouncedTipoOSFilters.length === 0 ||
          debouncedTipoOSFilters.some(filter => {
            if (filter === 'SC / ACC') {
              return os.tipo_orcamento === 'samsung_contigo' || os.tipo_orcamento === 'acessorios';
            }
            return os.tipo_os === filter;
          });

        const matchesTipoAtendimento = debouncedTipoAtendimentoFilters.length === 0 ||
          (os.tipo_atendimento && debouncedTipoAtendimentoFilters.includes(os.tipo_atendimento));

        const matchesTecnico = debouncedTecnicoFilters.length === 0 ||
          (os.tecnico_designado_id && debouncedTecnicoFilters.includes(os.tecnico_designado_id));

        const matchesTAT = debouncedMinDiasAbertos === 0 || calcularTAT(os.created_at) >= debouncedMinDiasAbertos;

        return searchResult.matches && matchesTipoOS && matchesTipoAtendimento && matchesTecnico && matchesTAT;
      });

      const sortOrder = columnSortOrder[coluna] || 'sequencia';
      const sortDir = columnSortDir[coluna] || 'asc';
      const dir = sortDir === 'asc' ? 1 : -1;

      if (sortOrder === 'tat') {
        filtered = filtered.sort((a, b) => dir * (calcularTAT(a.created_at) - calcularTAT(b.created_at)));
      } else if (sortOrder === 'numero') {
        filtered = filtered.sort((a, b) => {
          const numA = a.numero_os_interna || a.numero_os_samsung || '';
          const numB = b.numero_os_interna || b.numero_os_samsung || '';
          return dir * numA.localeCompare(numB);
        });
      } else if (sortOrder === 'tempo_etapa') {
        filtered = filtered.sort((a, b) => dir * (new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()));
      } else {
        filtered = filtered.sort((a, b) => (a.sequencia_coluna ?? 0) - (b.sequencia_coluna ?? 0));
      }

      acc[coluna] = filtered;
      return acc;
    }, {} as Record<string, OS[]>);

    return { filteredData: result, computedMatchSource: newMatchSource };
  }, [osData, debouncedSearchTerm, debouncedTipoOSFilters, debouncedTipoAtendimentoFilters, debouncedTecnicoFilters, debouncedMinDiasAbertos, columnSortOrder, columnSortDir]);

  const calcularValorPecasColuna = (cards: any[]) => {
    let total = 0;
    for (const os of cards) {
      const reqs = (os as any).requisicoes || [];
      const pecasOS = (os as any).os_pecas || [];
      for (const req of reqs) {
        if (req.status === 'requisitada' || req.status === 'pendente' || req.status === 'aguardando' || req.status === 'pedido_feito') {
          const valorGSPN = pecasOS.find((p: any) => p.pn === req.codigo_peca)?.valor_gspn ?? null;
          const valor = req.valor_peca ?? valorGSPN;
          if (valor && valor > 0) total += valor;
        }
      }
      if (reqs.filter((r: any) => ['requisitada', 'pendente', 'aguardando', 'pedido_feito'].includes(r.status)).length === 0 && reqs.length > 0) {
        for (const req of reqs) {
          const valorGSPN = pecasOS.find((p: any) => p.pn === req.codigo_peca)?.valor_gspn ?? null;
          const valor = req.valor_peca ?? valorGSPN;
          if (valor && valor > 0) total += valor;
        }
      }
    }
    return total;
  };

  const valorTotalAguardandoPeca = useMemo(() => {
    return calcularValorPecasColuna(filteredData['aguardando_peca'] || []);
  }, [filteredData]);

  const valorTotalPecaEmTransito = useMemo(() => {
    return calcularValorPecasColuna(filteredData['peca_em_transito'] || []);
  }, [filteredData]);

  useEffect(() => {
    if (debouncedSearchTerm && Object.keys(computedMatchSource).length > 0) {
      setSearchMatchSource(computedMatchSource);
    } else if (!debouncedSearchTerm) {
      setSearchMatchSource({});
    }
  }, [computedMatchSource, debouncedSearchTerm]);

  useEffect(() => {
    if (!debouncedSearchTerm || !columnsScrollRef.current) return;
    const firstColWithResults = COLUNAS_KANBAN.find(col =>
      filteredData[col.id] && filteredData[col.id].length > 0
    );
    if (firstColWithResults) {
      const colIndex = COLUNAS_KANBAN.findIndex(c => c.id === firstColWithResults.id);
      const columnWidth = 288 + 16; // w-72 (288px) + gap-4 (16px)
      columnsScrollRef.current.scrollTo({ left: colIndex * columnWidth, behavior: 'smooth' });
    } else {
      columnsScrollRef.current.scrollTo({ left: 0, behavior: 'smooth' });
    }
  }, [debouncedSearchTerm, filteredData]);

  const availableTipoOS = useMemo(() => Array.from(new Set([
    ...Object.values(osData).flat().map(os => os.tipo_os).filter(Boolean),
    'SC / ACC'
  ])).sort() as string[], [osData]);

  const availableTipoAtendimento = useMemo(() => Array.from(new Set(
    Object.values(osData).flat().map(os => os.tipo_atendimento).filter(Boolean)
  )).sort() as string[], [osData]);

  const handleCardClick = useCallback((os: OS) => {
    setSelectedOSId(os.id);
    setSelectedOSTipo(os.tipo_os as 'LP' | 'OW' | 'NA');
    setSelectedOSTipoOrcamento(os.tipo_orcamento || null);
    setSelectedOSInitialTab(undefined);
  }, []);

  const handleOpenComments = useCallback((os: OS) => {
    setSelectedOSId(os.id);
    setSelectedOSTipo(os.tipo_os as 'LP' | 'OW' | 'NA');
    setSelectedOSTipoOrcamento(os.tipo_orcamento || null);
    setSelectedOSInitialTab('comentarios');
    // Mark as read locally immediately
    setCommentReadMap(prev => ({ ...prev, [os.id]: new Date().toISOString() }));
  }, []);

  const handleCardAnalise = useCallback((os: OS) => {
    setSelectedOSForAnalise({
      id: os.id,
      numero: os.numero_os_samsung || os.numero_os_interna || 'S/N'
    });
    setShowAnaliseModal(true);
  }, []);

  const handleCardIniciarReparo = useCallback((os: OS) => {
    setSelectedOSForReparo({
      id: os.id,
      numero: os.numero_os_samsung || os.numero_os_interna || 'S/N',
      tecnicoId: os.tecnico_designado_id,
      tecnicoNome: (os as any).tecnico_designado?.nome || null,
      unidadeId: os.unidade_id
    });
    setShowIniciarReparoModal(true);
  }, []);

  const handleCardFecharOS = useCallback((os: OS) => {
    const osNumero = os.numero_os_samsung || os.numero_os_interna || 'S/N';
    setFecharOSCardData({ id: os.id, numero: String(osNumero), unidadeId: os.unidade_id });
    setShowFecharOSModal(true);
  }, []);

  const handleCardMoveToColumn = useCallback(async (os: OS, targetColumn: string) => {
    if (os.coluna_kanban === targetColumn) return;

    if (targetColumn === 'os_fechada') {
      const osNumero = os.numero_os_samsung || os.numero_os_interna || 'S/N';
      setFecharOSCardData({ id: os.id, numero: String(osNumero), unidadeId: os.unidade_id });
      setPendingFecharOSDrop({ card: os, position: undefined });
      setShowFecharOSModal(true);
      return;
    }

    // Validar rota: se a cidade não tem rota cadastrada, exibir modal obrigatório
    const cidadeOS = os.cliente_cidade;
    const rotaEncontrada = findRotaByCidade(cidadeOS);

    if (!rotaEncontrada) {
      setMandatoryRoutePickerOS(os);
      setPendingMandatoryMove({ targetColumn, position: undefined });
      return;
    }

    try {
      const cardsDestino = (osData[targetColumn] || []);
      const ultimoCard = cardsDestino[cardsDestino.length - 1];
      const novaSequencia = ultimoCard ? (ultimoCard.sequencia_coluna ?? 0) + 1 : 0;

      const updateData: any = {
        coluna_kanban: targetColumn,
        sequencia_coluna: novaSequencia,
        bloqueio_movimentacao_automatica: true,
        updated_at: new Date().toISOString(),
      };

      // Se a OS não tem rota_id, vincular a rota encontrada
      if (!os.rota_id && rotaEncontrada) {
        const rotaReal = rotas.find(r => r.coluna_kanban === rotaEncontrada.coluna);
        if (rotaReal) {
          updateData.rota_id = rotaReal.id;
        }
      }

      const { error } = await supabase
        .from('os')
        .update(updateData)
        .eq('id', os.id);

      if (error) throw error;

      const updatedCard = { ...os, coluna_kanban: targetColumn, sequencia_coluna: novaSequencia, rota_id: updateData.rota_id || os.rota_id };

      setOsData(prev => {
        const next = { ...prev };
        if (os.coluna_kanban) {
          next[os.coluna_kanban] = (next[os.coluna_kanban] || []).filter(o => o.id !== os.id);
        }
        const newCards = [...(next[targetColumn] || []), updatedCard];
        newCards.sort((a, b) => (a.sequencia_coluna ?? 0) - (b.sequencia_coluna ?? 0));
        next[targetColumn] = newCards;
        return next;
      });
    } catch (err: any) {
      setErrorModalData({ title: 'Erro ao Mover OS', message: err?.message || 'Erro desconhecido' });
      setShowErrorModal(true);
    }
  }, [osData, rotas, findRotaByCidade]);

  const handleArchiveOS = useCallback(async (os: OS) => {
    try {
      const { error } = await supabase
        .from('os')
        .update({ arquivada: true, updated_at: new Date().toISOString() })
        .eq('id', os.id);
      if (error) throw error;
      setOsData(prev => {
        const next = { ...prev };
        const col = os.coluna_kanban || 'os_fechada';
        next[col] = (next[col] || []).filter(c => c.id !== os.id);
        return next;
      });
    } catch (err: any) {
      setErrorModalData({ title: 'Erro ao Arquivar', message: err?.message || 'Erro desconhecido' });
      setShowErrorModal(true);
    }
  }, []);

  const getVisibleColumns = () => {
    const hasSCACCFilter = tipoOSFilters.includes('SC / ACC') || tipoOSFilters.includes('SC') || tipoOSFilters.includes('ACC');
    const hasCIFilter = tipoAtendimentoFilters.includes('CI');
    const hasIHFilter = tipoAtendimentoFilters.includes('IH');

    // CI tem prioridade máxima: mostra apenas colunas CI
    // Independente de quantos tipos de OS (LP, NA, OW, SC/ACC) estão selecionados
    if (hasCIFilter && tipoAtendimentoFilters.length === 1) {
      return COLUNAS_KANBAN.filter(col => COLUNAS_CI.includes(col.id));
    }

    // IH tem prioridade máxima: mostra apenas colunas IH
    // Independente de quantos tipos de OS (LP, NA, OW, SC/ACC) estão selecionados
    if (hasIHFilter && tipoAtendimentoFilters.length === 1) {
      return COLUNAS_KANBAN.filter(col => COLUNAS_IH.includes(col.id));
    }

    // SC/ACC só aparece quando não há filtro de tipo de atendimento
    if (hasSCACCFilter && tipoOSFilters.length === 1 && tipoAtendimentoFilters.length === 0) {
      return COLUNAS_KANBAN.filter(col => COLUNAS_SC_ACC.includes(col.id));
    }

    // Sem filtros específicos: mostra todas as colunas
    return COLUNAS_KANBAN;
  };

  const visibleColumns = getVisibleColumns();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="futuristic-loader"></div>
      </div>
    );
  }

  const handleUnidadeChange = (unidadeId: string) => {
    setSelectedUnidade(unidadeId);
  };

  return (
    <div className="h-[calc(100vh-56px)] flex flex-col gap-1.5 overflow-hidden">
      <UnitFilter
        unidades={unidades}
        selectedUnidade={selectedUnidade}
        onUnidadeChange={handleUnidadeChange}
      />

      <div className="premium-card p-3 flex-1 min-h-0 flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-4 mb-3 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{
              background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.15) 0%, rgba(var(--accent-rgb),0.05) 100%)',
              border: '1px solid rgba(var(--accent-rgb),0.3)',
              boxShadow: '0 0 20px rgba(var(--accent-rgb),0.1)'
            }}>
              <Activity className="w-4 h-4 text-[#00D4FF]" style={{ filter: 'drop-shadow(0 0 4px var(--text-accent))' }} />
              <h3 className="tech-heading text-sm text-[#00D4FF] tracking-widest">KANBAN</h3>
              <span className="ml-1 px-2 py-0.5 rounded text-[10px] font-bold" style={{
                background: 'rgba(var(--accent-rgb),0.15)',
                color: 'var(--text-accent)',
                border: '1px solid rgba(var(--accent-rgb),0.3)'
              }}>{Object.entries(osData).reduce((sum, [col, cards]) => col === 'os_fechada' ? sum : sum + cards.length, 0)}</span>
            </div>
          </div>

          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#00D4FF]/50" />
            <input
              type="text"
              placeholder="Busca Universal: OS, Cliente, Peças, Comentários, Endereço, Serial, IMEI..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="neon-input pl-10 text-xs py-2"
              title="Busca profunda em todos os dados: número da OS, nome, telefone, email, endereço, modelo, serial, IMEI, peças, comentários e histórico"
            />
          </div>

          <div className="flex gap-2">
            <div className="relative" ref={actionMenuRef}>
              <button
                onClick={() => setShowActionMenu(!showActionMenu)}
                className="flex items-center gap-2 text-xs px-4 py-1.5 rounded-lg font-bold transition-all duration-300"
                style={{
                  background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.2) 0%, rgba(var(--accent-rgb),0.05) 100%)',
                  border: '1px solid var(--text-accent)',
                  color: 'var(--text-accent)',
                  boxShadow: '0 0 10px rgba(var(--accent-rgb),0.2)'
                }}
              >
                <Settings className="w-3.5 h-3.5" />
                AÇÃO
                <ChevronDown className={`w-3 h-3 transition-transform ${showActionMenu ? 'rotate-180' : ''}`} />
              </button>

              {showActionMenu && (
                <div
                  className="absolute top-full mt-2 right-0 z-50 min-w-[200px] rounded-lg p-2"
                  style={{
                    background: 'linear-gradient(135deg, rgba(0,15,30,0.98) 0%, rgba(0,20,40,0.98) 100%)',
                    border: '1px solid rgba(var(--accent-rgb),0.3)',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.5), 0 0 20px rgba(var(--accent-rgb),0.1)'
                  }}
                >
                  <button
                    onClick={() => { setShowBadgeFilter(true); setShowActionMenu(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:bg-[#39FF14]/10"
                    style={{ color: 'var(--neon-green)' }}
                  >
                    <Filter className="w-4 h-4" />
                    BADGES
                  </button>
                  <button
                    onClick={() => { setShowTipoFilter(true); setShowActionMenu(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:bg-[#FFBF00]/10"
                    style={{ color: (tipoOSFilters.length > 0 || tipoAtendimentoFilters.length > 0 || tecnicoFilters.length > 0 || minDiasAbertos > 0) ? '#FFBF00' : '#6B7280' }}
                  >
                    <Filter className="w-4 h-4" />
                    FILTROS {(tipoOSFilters.length > 0 || tipoAtendimentoFilters.length > 0 || tecnicoFilters.length > 0 || minDiasAbertos > 0) && `(${tipoOSFilters.length + tipoAtendimentoFilters.length + tecnicoFilters.length + (minDiasAbertos > 0 ? 1 : 0)})`}
                  </button>
                  <button
                    onClick={() => { setShowExportModal(true); setShowActionMenu(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:bg-[#10B981]/10"
                    style={{ color: '#10B981' }}
                  >
                    <Download className="w-4 h-4" />
                    EXPORTAR
                  </button>
                  <div className="border-t border-slate-700/50 my-2" />
                  <button
                    onClick={() => { setCriarOSLP(true); setShowActionMenu(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:bg-[#FFA500]/10"
                    style={{ color: '#FFA500' }}
                  >
                    <Plus className="w-4 h-4" />
                    CRIAR LP
                  </button>
                  <button
                    onClick={() => { setCriarOSOW(true); setShowActionMenu(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:bg-cyan-500/10"
                    style={{ color: 'var(--text-accent)' }}
                  >
                    <Plus className="w-4 h-4" />
                    CRIAR OW
                  </button>
                  <button
                    onClick={() => { setCriarOSSCACC(true); setShowActionMenu(false); }}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all hover:bg-[#39FF14]/10"
                    style={{ color: 'var(--neon-green)' }}
                  >
                    <Plus className="w-4 h-4" />
                    CRIAR SC / ACC
                  </button>
                </div>
              )}
            </div>

            <div className="relative" ref={badgeFilterRef}>
              {showBadgeFilter && (
                <div
                  className="absolute top-full mt-2 right-0 z-50 min-w-[220px] rounded-lg"
                  style={{
                    background: 'linear-gradient(135deg, rgba(0,15,30,0.98) 0%, rgba(0,20,40,0.98) 100%)',
                    border: '1px solid rgba(var(--neon-green-rgb),0.3)',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.5), 0 0 20px rgba(var(--neon-green-rgb),0.1)',
                    maxHeight: '350px'
                  }}
                >
                  <div className="overflow-y-auto p-3" style={{ maxHeight: '350px' }}>
                    <div className="text-xs font-bold text-[#39FF14] mb-3 pb-2 border-b border-[#39FF14]/30">
                      EXIBIR NO CARD
                    </div>
                    <div className="space-y-1 mb-3">
                    {[
                      { key: 'pedidoAtivo', label: 'Pedido Ativo' },
                      { key: 'pecaTransito', label: 'Peça em Trânsito' },
                      { key: 'comTecnico', label: 'Com Técnico / GI' },
                      { key: 'tecnico', label: 'Técnico Designado' },
                      { key: 'agendamento', label: 'Agendamento' },
                      { key: 'financeiro', label: 'Financeiro' },
                      { key: 'lucro', label: 'Lucro/Prejuízo' },
                      { key: 'sla', label: 'Tempo na Etapa' },
                      { key: 'status', label: 'Status Samsung' },
                      { key: 'iniciarReparo', label: 'Iniciar Reparo' },
                      { key: 'analiseConcluida', label: 'Análise Concluída' },
                      { key: 'fecharOS', label: 'Fechar OS' }
                    ].map(({ key, label }) => (
                      <div
                        key={key}
                        onClick={() => setBadgeFilters({ ...badgeFilters, [key]: !badgeFilters[key as keyof typeof badgeFilters] })}
                        className="flex items-center gap-2 cursor-pointer p-2 rounded transition-all"
                        style={{
                          background: badgeFilters[key as keyof typeof badgeFilters]
                            ? 'linear-gradient(135deg, rgba(var(--neon-green-rgb),0.15) 0%, rgba(var(--neon-green-rgb),0.05) 100%)'
                            : 'transparent',
                          border: `1px solid ${badgeFilters[key as keyof typeof badgeFilters] ? 'rgba(var(--neon-green-rgb),0.3)' : 'transparent'}`
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={badgeFilters[key as keyof typeof badgeFilters]}
                          onChange={() => {}}
                          className="w-3.5 h-3.5 rounded accent-[#39FF14] pointer-events-none"
                        />
                        <span className={`text-xs flex-1 ${badgeFilters[key as keyof typeof badgeFilters] ? 'text-[#39FF14] font-medium' : 'text-gray-300'}`}>
                          {label}
                        </span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 pt-2 border-t border-[#39FF14]/30">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setBadgeFilters({
                          pedidoAtivo: true,
                          pecaTransito: true,
                          comTecnico: true,
                          tecnico: true,
                          agendamento: true,
                          financeiro: true,
                          lucro: true,
                          sla: true,
                          status: true,
                          iniciarReparo: true,
                          analiseConcluida: true
                        });
                      }}
                      className="flex-1 px-2 py-1.5 rounded text-[10px] font-bold transition-colors"
                      style={{
                        background: 'linear-gradient(135deg, rgba(var(--neon-green-rgb),0.2) 0%, rgba(var(--neon-green-rgb),0.05) 100%)',
                        border: '1px solid rgba(var(--neon-green-rgb),0.3)',
                        color: 'var(--neon-green)'
                      }}
                    >
                      SELECIONAR TUDO
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setBadgeFilters({
                          pedidoAtivo: false,
                          pecaTransito: false,
                          comTecnico: false,
                          tecnico: false,
                          agendamento: false,
                          financeiro: false,
                          lucro: false,
                          sla: false,
                          status: false,
                          iniciarReparo: false,
                          analiseConcluida: false
                        });
                      }}
                      className="flex-1 px-2 py-1.5 rounded text-[10px] font-bold transition-colors"
                      style={{
                        background: 'rgba(255,0,100,0.1)',
                        border: '1px solid rgba(255,0,100,0.3)',
                        color: '#FF0064'
                      }}
                    >
                      LIMPAR TUDO
                    </button>
                  </div>
                  </div>
                </div>
              )}
            </div>

            <div className="relative" ref={tipoFilterRef}>
              {showTipoFilter && (
                <div
                  className="absolute top-full mt-2 right-0 z-50 min-w-[200px] rounded-lg"
                  style={{
                    background: 'linear-gradient(135deg, rgba(0,15,30,0.98) 0%, rgba(0,20,40,0.98) 100%)',
                    border: '1px solid rgba(255,191,0,0.3)',
                    boxShadow: '0 10px 40px rgba(0,0,0,0.5), 0 0 20px rgba(255,191,0,0.1)',
                    maxHeight: '350px'
                  }}
                >
                  <div className="overflow-y-auto scroll-amber p-3" style={{ maxHeight: '350px' }}>
                    <div className="text-xs font-bold text-[#FFBF00] mb-2 pb-2 border-b border-[#FFBF00]/30">
                      TIPO DE OS
                    </div>
                  <div className="space-y-1 mb-3">
                    {availableTipoOS.map((tipo) => (
                      <div
                        key={tipo}
                        onClick={() => {
                          if (tipoOSFilters.includes(tipo)) {
                            setTipoOSFilters(tipoOSFilters.filter(t => t !== tipo));
                          } else {
                            setTipoOSFilters([...tipoOSFilters, tipo]);
                          }
                        }}
                        className="flex items-center gap-2 cursor-pointer p-2 rounded transition-all"
                        style={{
                          background: tipoOSFilters.includes(tipo)
                            ? 'linear-gradient(135deg, rgba(255,191,0,0.15) 0%, rgba(255,191,0,0.05) 100%)'
                            : 'transparent',
                          border: `1px solid ${tipoOSFilters.includes(tipo) ? 'rgba(255,191,0,0.3)' : 'transparent'}`
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={tipoOSFilters.includes(tipo)}
                          onChange={() => {}}
                          className="w-3.5 h-3.5 rounded accent-[#FFBF00] pointer-events-none"
                        />
                        <span className={`text-xs flex-1 ${tipoOSFilters.includes(tipo) ? 'text-[#FFBF00] font-medium' : 'text-gray-300'}`}>
                          {tipo}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="text-xs font-bold text-[#FFBF00] mb-2 pb-2 border-b border-[#FFBF00]/30">
                    TIPO DE ATENDIMENTO
                  </div>
                  <div className="space-y-1 mb-3">
                    {availableTipoAtendimento.map((tipo) => (
                      <div
                        key={tipo}
                        onClick={() => {
                          if (tipoAtendimentoFilters.includes(tipo)) {
                            setTipoAtendimentoFilters(tipoAtendimentoFilters.filter(t => t !== tipo));
                          } else {
                            setTipoAtendimentoFilters([...tipoAtendimentoFilters, tipo]);
                          }
                        }}
                        className="flex items-center gap-2 cursor-pointer p-2 rounded transition-all"
                        style={{
                          background: tipoAtendimentoFilters.includes(tipo)
                            ? 'linear-gradient(135deg, rgba(255,191,0,0.15) 0%, rgba(255,191,0,0.05) 100%)'
                            : 'transparent',
                          border: `1px solid ${tipoAtendimentoFilters.includes(tipo) ? 'rgba(255,191,0,0.3)' : 'transparent'}`
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={tipoAtendimentoFilters.includes(tipo)}
                          onChange={() => {}}
                          className="w-3.5 h-3.5 rounded accent-[#FFBF00] pointer-events-none"
                        />
                        <span className={`text-xs flex-1 ${tipoAtendimentoFilters.includes(tipo) ? 'text-[#FFBF00] font-medium' : 'text-gray-300'}`}>
                          {tipo}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Seção de Técnicos - sempre visível */}
                  <div className="text-xs font-bold text-[#FFBF00] mb-2 pb-2 border-b border-[#FFBF00]/30 mt-3">
                    TÉCNICO(A)
                  </div>
                  {tecnicos.length > 0 ? (
                    <div className="space-y-1 mb-3">
                      {tecnicos.map((tecnico) => (
                        <div
                          key={tecnico.id}
                          onClick={() => {
                            if (tecnicoFilters.includes(tecnico.id)) {
                              setTecnicoFilters(tecnicoFilters.filter(t => t !== tecnico.id));
                            } else {
                              setTecnicoFilters([...tecnicoFilters, tecnico.id]);
                            }
                          }}
                          className="flex items-center gap-2 cursor-pointer p-2 rounded transition-all"
                          style={{
                            background: tecnicoFilters.includes(tecnico.id)
                              ? 'linear-gradient(135deg, rgba(255,191,0,0.15) 0%, rgba(255,191,0,0.05) 100%)'
                              : 'transparent',
                            border: `1px solid ${tecnicoFilters.includes(tecnico.id) ? 'rgba(255,191,0,0.3)' : 'transparent'}`
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={tecnicoFilters.includes(tecnico.id)}
                            onChange={() => {}}
                            className="w-3.5 h-3.5 rounded accent-[#FFBF00] pointer-events-none"
                          />
                          <span className={`text-xs flex-1 ${tecnicoFilters.includes(tecnico.id) ? 'text-[#FFBF00] font-medium' : 'text-gray-300'}`}>
                            {tecnico.nome}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="p-3 rounded mb-3" style={{
                      background: 'rgba(255,191,0,0.05)',
                      border: '1px solid rgba(255,191,0,0.2)'
                    }}>
                      <p className="text-xs text-gray-400 text-center">
                        {selectedUnidade ? 'Nenhum técnico cadastrado nesta unidade' : 'Selecione uma unidade para ver os técnicos'}
                      </p>
                    </div>
                  )}

                  <div className="pt-3 mt-3 border-t border-[#FFBF00]/30">
                    <label className="text-[10px] text-[#FFBF00] mb-1.5 block font-bold">TAT MÍNIMO (dias abertos)</label>
                    <input
                      type="number"
                      min="0"
                      value={minDiasAbertos}
                      onChange={(e) => setMinDiasAbertos(Math.max(0, parseInt(e.target.value) || 0))}
                      onClick={(e) => e.stopPropagation()}
                      className="w-full px-2 py-1.5 rounded text-xs"
                      style={{
                        background: 'rgba(255,191,0,0.05)',
                        border: '1px solid rgba(255,191,0,0.3)',
                        color: '#FFBF00'
                      }}
                      placeholder="Ex: 7 (mostra OS com 7+ dias)"
                    />
                  </div>

                  <div className="flex gap-2 pt-3 mt-3 border-t border-[#FFBF00]/30">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTipoOSFilters([...availableTipoOS]);
                        setTipoAtendimentoFilters([...availableTipoAtendimento]);
                        setTecnicoFilters(tecnicos.map(t => t.id));
                      }}
                      className="flex-1 px-2 py-1.5 rounded text-[10px] font-bold transition-colors"
                      style={{
                        background: 'linear-gradient(135deg, rgba(255,191,0,0.2) 0%, rgba(255,191,0,0.05) 100%)',
                        border: '1px solid rgba(255,191,0,0.3)',
                        color: '#FFBF00'
                      }}
                    >
                      SELECIONAR TUDO
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setTipoOSFilters([]);
                        setTipoAtendimentoFilters([]);
                        setTecnicoFilters([]);
                        setMinDiasAbertos(0);
                      }}
                      className="flex-1 px-2 py-1.5 rounded text-[10px] font-bold transition-colors"
                      style={{
                        background: 'rgba(255,0,100,0.1)',
                        border: '1px solid rgba(255,0,100,0.3)',
                        color: '#FF0064'
                      }}
                    >
                      LIMPAR TUDO
                    </button>
                  </div>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={syncSamsungGSPN}
              disabled={syncingSamsung || !selectedUnidade}
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.2) 0%, rgba(var(--accent-rgb),0.05) 100%)',
                border: '1px solid var(--text-accent)',
                color: 'var(--text-accent)',
                boxShadow: '0 0 10px rgba(var(--accent-rgb),0.2)'
              }}
              title={
                !selectedUnidade
                  ? 'Selecione uma unidade para sincronizar'
                  : 'Sincronizar novas OS da Samsung'
              }
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingSamsung ? 'animate-spin' : ''}`} />
              {syncingSamsung ? 'SINCRONIZANDO...' : 'SYNC NOVAS OS'}
            </button>

            <button
              onClick={() => {
                setBuscarOSNumero('');
                setBuscarOSResult(null);
                setShowBuscarOSModal(true);
              }}
              disabled={!selectedUnidade}
              className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-lg font-bold transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.15) 0%, rgba(var(--accent-rgb),0.03) 100%)',
                border: '1px solid var(--text-accent)',
                color: 'var(--text-accent)',
                boxShadow: '0 0 8px rgba(var(--accent-rgb),0.15)'
              }}
              title={!selectedUnidade ? 'Selecione uma unidade' : 'Trazer OS por número'}
            >
              <Search className="w-3.5 h-3.5" />
              TRAZER OS
            </button>
          </div>
        </div>

        <div
          ref={columnsScrollRef}
          className="flex-1 min-h-0 overflow-x-auto overflow-y-hidden cyber-scrollbar"
          onDragOver={handleContainerDragOver}
          onDragLeave={handleContainerDragLeave}
        >
          <div className="flex gap-4 h-full pb-2" style={{ minWidth: 'max-content', maxHeight: '100%' }}>
            {visibleColumns.map((coluna) => {
              const ColumnIcon = coluna.icon;
              const isOver = dragOverColumn === coluna.id;

              return (
                <div
                  key={coluna.id}
                  className={`flex-shrink-0 w-72 h-full max-h-full rounded-xl transition-all duration-300 overflow-hidden ${
                    isOver ? 'scale-[1.01]' : ''
                  }`}
                  style={{
                    background: `linear-gradient(180deg, ${coluna.color}06 0%, var(--bg-secondary) 100%)`,
                    border: `1px solid ${isOver ? coluna.color + '60' : coluna.color + '18'}`,
                    boxShadow: isOver
                      ? `0 0 24px ${coluna.color}25, inset 0 0 20px ${coluna.color}08`
                      : `0 2px 12px rgba(0,0,0,0.15)`,
                    backdropFilter: 'blur(8px)',
                  }}
                  onDragOver={(e) => handleDragOver(e, coluna.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, coluna.id)}
                >
                  <div className="flex flex-col h-full min-h-0">
                    <div className="sticky top-0 z-10 flex-shrink-0 px-3 pt-3">
                      <div className="flex items-center justify-between mb-2 pb-2 border-b"
                        style={{
                          borderColor: `${getTextColor(coluna.id, coluna.color)}30`,
                          background: `linear-gradient(180deg, ${coluna.color}15 0%, ${coluna.color}08 100%)`,
                          backdropFilter: 'blur(10px)'
                        }}
                      >
                        <div className="flex items-center gap-2">
                          <div className="p-1 rounded-lg" style={{
                            backgroundColor: `${coluna.color}15`,
                            border: `1px solid ${getTextColor(coluna.id, coluna.color)}40`,
                            boxShadow: `0 0 10px ${coluna.color}20`
                          }}>
                            <ColumnIcon
                              className="w-3.5 h-3.5"
                              style={{
                                color: getTextColor(coluna.id, coluna.color),
                                filter: `drop-shadow(0 0 6px ${getTextColor(coluna.id, coluna.color)})`
                              }}
                            />
                          </div>
                          <h4 className="font-bold text-xs uppercase tracking-wider"
                            style={{
                              color: getTextColor(coluna.id, coluna.color),
                              textShadow: `0 0 10px ${getTextColor(coluna.id, coluna.color)}60`
                            }}
                          >
                            {coluna.label}
                          </h4>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {coluna.id === 'aguardando_peca' && valorTotalAguardandoPeca > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowPecasInfoModal(true);
                              }}
                              className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold transition-all hover:scale-105 cursor-pointer"
                              style={{
                                background: 'linear-gradient(135deg, #10B98120 0%, #10B98110 100%)',
                                border: '1px solid #10B98140',
                                color: '#10B981'
                              }}
                              title="Clique para ver detalhes das pecas"
                            >
                              R$ {valorTotalAguardandoPeca.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </button>
                          )}
                          {coluna.id === 'peca_em_transito' && valorTotalPecaEmTransito > 0 && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowPecasInfoModal(true);
                              }}
                              className="flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold transition-all hover:scale-105 cursor-pointer"
                              style={{
                                background: 'linear-gradient(135deg, #3B82F620 0%, #3B82F610 100%)',
                                border: '1px solid #3B82F640',
                                color: '#3B82F6'
                              }}
                              title="Valor total das pecas em transito"
                            >
                              R$ {valorTotalPecaEmTransito.toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                            </button>
                          )}
                          <div className="relative" data-sort-dropdown>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setOpenSortDropdown(openSortDropdown === coluna.id ? null : coluna.id);
                              }}
                              className="p-1 rounded-md transition-all hover:scale-110"
                              style={{
                                background: `linear-gradient(135deg, ${coluna.color}20 0%, ${coluna.color}10 100%)`,
                                border: `1px solid ${getTextColor(coluna.id, coluna.color)}40`,
                                color: getTextColor(coluna.id, coluna.color)
                              }}
                              title="Escolher ordenação"
                            >
                              <Filter className="w-3 h-3" />
                            </button>

                            {openSortDropdown === coluna.id && (
                              <div
                                className="absolute top-full mt-1 right-0 z-50 rounded-lg shadow-2xl min-w-[180px] overflow-hidden"
                                style={{
                                  background: 'rgba(0, 0, 0, 0.95)',
                                  border: `1px solid ${coluna.color}60`,
                                  boxShadow: `0 0 20px ${coluna.color}40`
                                }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {[
                                  { value: 'sequencia', label: 'Sequência Manual', icon: '✋' },
                                  { value: 'tat', label: 'TAT (Tempo)', icon: '⏱️' },
                                  { value: 'numero', label: 'Número OS', icon: '#️⃣' },
                                  { value: 'tempo_etapa', label: 'Tempo na Etapa', icon: '📊' }
                                ].map((option) => (
                                  <button
                                    key={option.value}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setColumnSortOrder(prev => ({
                                        ...prev,
                                        [coluna.id]: option.value as any
                                      }));
                                      setOpenSortDropdown(null);
                                    }}
                                    className="w-full px-3 py-2 text-left text-xs font-medium transition-all flex items-center gap-2 hover:scale-[1.02]"
                                    style={{
                                      background: columnSortOrder[coluna.id] === option.value
                                        ? `linear-gradient(90deg, ${coluna.color}30 0%, ${coluna.color}10 100%)`
                                        : 'transparent',
                                      color: columnSortOrder[coluna.id] === option.value ? coluna.color : '#888',
                                      borderBottom: '1px solid rgba(255,255,255,0.05)'
                                    }}
                                  >
                                    <span>{option.icon}</span>
                                    <span>{option.label}</span>
                                    {columnSortOrder[coluna.id] === option.value && (
                                      <span className="ml-auto" style={{ color: coluna.color }}>✓</span>
                                    )}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                          <div
                            className="px-2 py-0.5 rounded-md text-xs font-bold min-w-[28px] text-center"
                            style={{
                              background: `linear-gradient(135deg, ${coluna.color}25 0%, ${coluna.color}10 100%)`,
                              color: getTextColor(coluna.id, coluna.color),
                              border: `1px solid ${getTextColor(coluna.id, coluna.color)}50`,
                              boxShadow: `0 0 15px ${coluna.color}25, inset 0 1px 1px ${coluna.color}20`
                            }}
                          >
                            {filteredData[coluna.id]?.length || 0}
                          </div>
                        </div>
                      </div>
                      {columnSortOrder[coluna.id] && columnSortOrder[coluna.id] !== 'sequencia' && (
                        <button
                          onClick={() => setColumnSortDir(prev => ({
                            ...prev,
                            [coluna.id]: (prev[coluna.id] || 'asc') === 'asc' ? 'desc' : 'asc'
                          }))}
                          className="flex items-center gap-1 text-[9px] px-2 py-0.5 rounded mb-1 transition-all hover:opacity-80 active:scale-95"
                          style={{
                            background: `${coluna.color}15`,
                            color: getTextColor(coluna.id, coluna.color),
                            border: `1px solid ${getTextColor(coluna.id, coluna.color)}40`
                          }}
                          title="Clique para inverter direção"
                        >
                          <span>
                            {columnSortOrder[coluna.id] === 'tat' ? 'TAT TEMPO' :
                             columnSortOrder[coluna.id] === 'numero' ? 'NÚMERO OS' :
                             'TEMPO ETAPA'}
                          </span>
                          {(columnSortDir[coluna.id] || 'asc') === 'asc'
                            ? <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                            : <svg xmlns="http://www.w3.org/2000/svg" className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
                          }
                        </button>
                      )}
                    </div>

                    <VirtualizedColumn
                      cards={filteredData[coluna.id] || []}
                      colunaId={coluna.id}
                      colunaColor={coluna.color}
                      textColor={getTextColor(coluna.id, coluna.color)}
                      badgeFilters={badgeFilters}
                      mostrarInfoFinanceira={mostrarInfoFinanceira}
                      searchMatchSource={searchMatchSource}
                      searchActive={!!debouncedSearchTerm}
                      draggedCard={draggedCard}
                      columnSortOrder={columnSortOrder[coluna.id] || 'sequencia'}
                      dragOverColumn={dragOverColumn}
                      dragOverPosition={dragOverPosition}
                      onDragStart={handleDragStart}
                      onDragEnd={handleDragEnd}
                      onCardDragOver={handleCardDragOver}
                      onDrop={handleDrop}
                      onCardClick={handleCardClick}
                      onOpenComments={handleOpenComments}
                      onAnalise={handleCardAnalise}
                      onIniciarReparo={handleCardIniciarReparo}
                      onFecharOS={handleCardFecharOS}
                      onMoveOS={handleCardMoveToColumn}
                      onArchive={handleArchiveOS}
                      allColunas={COLUNAS_KANBAN.map(c => ({ id: c.id, label: c.label }))}
                      rotas={rotas}
                      ColumnIcon={coluna.icon}
                      lastUserCommentMap={lastUserCommentMap}
                      commentReadMap={commentReadMap}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selectedOSId && (selectedOSTipo === 'OW' || selectedOSTipo === 'NA' || selectedOSTipoOrcamento === 'samsung_contigo' || selectedOSTipoOrcamento === 'acessorios') && selectedOSTipo !== 'LP' && (
        <OSModal
          osId={selectedOSId}
          onClose={() => {
            setSelectedOSId(null);
            setSelectedOSTipo(null);
            setSelectedOSTipoOrcamento(null);
            setSelectedOSInitialTab(undefined);
          }}
          onReload={loadKanbanData}
          initialTab={selectedOSInitialTab}
        />
      )}

      {selectedOSId && selectedOSTipo === 'LP' && selectedOSTipoOrcamento !== 'samsung_contigo' && selectedOSTipoOrcamento !== 'acessorios' && (
        <OSLPModal
          osId={selectedOSId}
          onClose={() => {
            setSelectedOSId(null);
            setSelectedOSTipo(null);
            setSelectedOSTipoOrcamento(null);
            setSelectedOSInitialTab(undefined);
          }}
          onReload={loadKanbanData}
          mode="view"
          initialTab={selectedOSInitialTab}
        />
      )}

      {criarOSLP && (
        <OSLPModal
          osId={null}
          onClose={() => setCriarOSLP(false)}
          onReload={loadKanbanData}
          mode="create"
          tipoOS="LP"
        />
      )}

      {criarOSOW && (
        <OSLPModal
          osId={null}
          onClose={() => setCriarOSOW(false)}
          onReload={loadKanbanData}
          mode="create"
          tipoOS="OW"
        />
      )}

      {criarOSSCACC && (
        <OSLPModal
          osId={null}
          onClose={() => setCriarOSSCACC(false)}
          onReload={loadKanbanData}
          mode="create"
          tipoOS="OW"
          modoSCACC={true}
        />
      )}

      {showAnaliseModal && selectedOSForAnalise && (
        <AnaliseConcluidaModal
          isOpen={showAnaliseModal}
          osId={selectedOSForAnalise.id}
          osNumero={selectedOSForAnalise.numero}
          onClose={() => {
            setShowAnaliseModal(false);
            setSelectedOSForAnalise(null);
          }}
          onSuccess={loadKanbanData}
        />
      )}

      {showIniciarReparoModal && selectedOSForReparo && (
        <IniciarReparoModal
          osId={selectedOSForReparo.id}
          osNumero={selectedOSForReparo.numero}
          unidadeId={selectedOSForReparo.unidadeId}
          currentTecnicoId={selectedOSForReparo.tecnicoId}
          currentTecnicoNome={selectedOSForReparo.tecnicoNome}
          onClose={() => {
            setShowIniciarReparoModal(false);
            setSelectedOSForReparo(null);
          }}
          onSuccess={loadKanbanData}
        />
      )}

      {showReparoEfetuadoModal && selectedOSForOQC && (
        <ReparoEfetuadoModal
          isOpen={showReparoEfetuadoModal}
          osId={selectedOSForOQC.id}
          osNumero={selectedOSForOQC.numero}
          onClose={() => {
            setShowReparoEfetuadoModal(false);
            setSelectedOSForOQC(null);
            setPendingOQCDrop(null);
          }}
          onSuccess={() => {
            setPendingOQCDrop(null);
            loadKanbanData();
          }}
        />
      )}

      {showFecharOSModal && fecharOSCardData && (
        <FecharOSModal
          isOpen={showFecharOSModal}
          osId={fecharOSCardData.id}
          osNumero={fecharOSCardData.numero}
          unidadeId={fecharOSCardData.unidadeId}
          onClose={() => {
            setShowFecharOSModal(false);
            setFecharOSCardData(null);
            setPendingFecharOSDrop(null);
          }}
          onSuccess={() => {
            setShowFecharOSModal(false);
            setFecharOSCardData(null);
            setPendingFecharOSDrop(null);
            loadKanbanData();
          }}
        />
      )}

      {showExportModal && (
        <ExportModal
          osData={Object.values(filteredData).flat()}
          rotas={rotas}
          onClose={() => setShowExportModal(false)}
        />
      )}

      <DiagnosticoBlockModal
        isOpen={showDiagnosticoBlock}
        onClose={() => setShowDiagnosticoBlock(false)}
      />

      {confirmMoveData && (
        <ConfirmMoveModal
          isOpen={showConfirmMove}
          onClose={() => {
            setShowConfirmMove(false);
            setConfirmMoveData(null);
            setDraggedCard(null);
          }}
          fromColumn={confirmMoveData.from}
          toColumn={confirmMoveData.to}
          onConfirm={confirmMoveData.onConfirm}
        />
      )}

      <PecasAtivasBlockModal
        isOpen={showPecasAtivasBlock}
        onClose={() => {
          setShowPecasAtivasBlock(false);
          setPecasAtivasData([]);
        }}
        pecas={pecasAtivasData}
        statusLabels={{
          pedido_feito: '🚚 Pedido Ativo',
          atendida: '✅ Peça Atendida',
          em_uso: '🔧 Em Uso',
          gi_postada: '📦 GI Pendente'
        }}
      />

      <ErrorModal
        isOpen={showErrorModal}
        onClose={() => {
          setShowErrorModal(false);
          setErrorModalData({ title: '', message: '' });
        }}
        title={errorModalData.title}
        message={errorModalData.message}
      />

      <InfoModal
        isOpen={showInfoModal}
        onClose={() => {
          setShowInfoModal(false);
          setInfoModalData({ title: '', message: '' });
        }}
        title={infoModalData.title}
        message={infoModalData.message}
      />

      <PecasInfoModal
        show={showPecasInfoModal}
        onClose={() => setShowPecasInfoModal(false)}
        osCards={(filteredData['aguardando_peca'] || []) as any}
      />

      {showBuscarOSModal && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
          <div
            className="rounded-2xl shadow-2xl overflow-hidden w-full max-w-sm mx-4"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-accent)',
              backdropFilter: 'blur(20px)',
            }}
          >
            <div className="p-5 border-b flex items-center justify-between" style={{ borderColor: 'var(--border-primary)', background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.08), rgba(var(--accent-rgb),0.02))' }}>
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg" style={{ background: 'rgba(var(--accent-rgb),0.15)', border: '1px solid rgba(var(--accent-rgb),0.3)' }}>
                  <Search className="w-4 h-4" style={{ color: 'var(--text-accent)' }} />
                </div>
                <div>
                  <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Trazer OS por Número</h3>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Importar OS específica da Samsung</p>
                </div>
              </div>
              <button
                onClick={() => setShowBuscarOSModal(false)}
                className="p-1.5 rounded-lg transition-colors"
                style={{ color: 'var(--text-secondary)' }}
                onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
                  NÚMERO DA OS SAMSUNG
                </label>
                <input
                  type="text"
                  value={buscarOSNumero}
                  onChange={e => {
                    setBuscarOSNumero(e.target.value);
                    setBuscarOSResult(null);
                  }}
                  onKeyDown={e => { if (e.key === 'Enter' && buscarOSNumero.trim() && !buscarOSLoading) buscarOSPorNumero(); }}
                  placeholder="Ex: 4174839926"
                  autoFocus
                  className="w-full px-3 py-2.5 rounded-lg text-sm font-mono outline-none transition-all"
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-primary)',
                    color: 'var(--text-primary)',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--text-accent)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--border-primary)')}
                />
              </div>

              {buscarOSResult && (
                <div
                  className="rounded-lg p-3 flex items-start gap-2.5"
                  style={{
                    background: buscarOSResult.status === 'success'
                      ? 'rgba(16,185,129,0.1)'
                      : 'rgba(239,68,68,0.1)',
                    border: `1px solid ${buscarOSResult.status === 'success' ? 'rgba(16,185,129,0.3)' : 'rgba(239,68,68,0.3)'}`,
                  }}
                >
                  {buscarOSResult.status === 'success' ? (
                    <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#10b981' }} />
                  ) : (
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: '#ef4444' }} />
                  )}
                  <div>
                    <p className="text-xs font-semibold mb-0.5" style={{ color: buscarOSResult.status === 'success' ? '#10b981' : '#ef4444' }}>
                      {buscarOSResult.status === 'success' ? 'Solicitação enviada' : 'Erro'}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{buscarOSResult.message}</p>
                    {buscarOSResult.status === 'success' && (
                      <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)', opacity: 0.7 }}>
                        O processamento ocorre de forma assincrona. A OS aparecera no Kanban em breve.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setShowBuscarOSModal(false)}
                  className="flex-1 py-2.5 rounded-lg text-xs font-semibold transition-all"
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}
                  onMouseOver={e => (e.currentTarget.style.borderColor = 'var(--text-accent)')}
                  onMouseOut={e => (e.currentTarget.style.borderColor = 'var(--border-primary)')}
                >
                  Fechar
                </button>
                <button
                  onClick={buscarOSPorNumero}
                  disabled={!buscarOSNumero.trim() || buscarOSLoading}
                  className="flex-1 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, rgba(var(--accent-rgb),0.3) 0%, rgba(var(--accent-rgb),0.15) 100%)',
                    border: '1px solid var(--text-accent)',
                    color: 'var(--text-accent)',
                    boxShadow: '0 0 12px rgba(var(--accent-rgb),0.2)'
                  }}
                >
                  {buscarOSLoading ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Buscando...
                    </>
                  ) : (
                    <>
                      <Search className="w-3.5 h-3.5" />
                      Trazer OS
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {routePickerOS && (
        <div className="fixed inset-0 z-[9999] flex items-end justify-center pb-8 pointer-events-none" style={{ background: 'rgba(0,0,0,0.3)' }}>
          <div
            className="pointer-events-auto rounded-2xl shadow-2xl overflow-hidden animate-in slide-in-from-bottom"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-accent)',
              backdropFilter: 'blur(20px)',
              minWidth: 380,
              maxWidth: 460,
              animation: 'slideUp 0.25s ease-out',
            }}
          >
            <div className="p-4 border-b" style={{ borderColor: 'var(--border-primary)', background: 'linear-gradient(135deg, rgba(0,212,255,0.08), rgba(0,212,255,0.02))' }}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <MapPin className="w-5 h-5" style={{ color: '#06B6D4' }} />
                  <span className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>
                    OS em Peca Disponivel
                  </span>
                </div>
                <button
                  onClick={() => setRoutePickerOS(null)}
                  className="p-1 rounded-lg transition-colors"
                  style={{ color: 'var(--text-secondary)' }}
                  onMouseOver={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.1)')}
                  onMouseOut={e => (e.currentTarget.style.background = 'transparent')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-xs font-semibold" style={{ color: 'var(--text-accent)' }}>
                    {routePickerOS.numero_os_samsung || routePickerOS.numero_os_interna || 'S/N'}
                  </p>
                  <p className="text-[11px]" style={{ color: 'var(--text-secondary)' }}>
                    {routePickerOS.cliente_nome}
                  </p>
                </div>
                <div className="ml-auto text-right">
                  <p className="text-xs font-bold" style={{ color: '#FFBF00' }}>
                    {routePickerOS.cliente_cidade || 'Sem cidade'}
                  </p>
                  {routePickerOS.cliente_bairro && (
                    <p className="text-[10px]" style={{ color: 'var(--text-tertiary)' }}>
                      {routePickerOS.cliente_bairro}
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="p-3">
              <p className="text-[10px] font-medium uppercase tracking-wider mb-2.5 text-center" style={{ color: 'var(--text-secondary)' }}>
                Selecione a rota para esta OS
              </p>
              <div className="grid grid-cols-4 gap-2">
                {[
                  { kanban: 'rota_preta', label: 'Preta', cor: '#1a1a1a', border: '#555' },
                  { kanban: 'rota_vermelha', label: 'Vermelha', cor: '#EF4444', border: '#EF4444' },
                  { kanban: 'rota_azul', label: 'Azul', cor: '#3B82F6', border: '#3B82F6' },
                  { kanban: 'rota_verde', label: 'Verde', cor: '#10B981', border: '#10B981' },
                  { kanban: 'rota_rosa', label: 'Rosa', cor: '#EC4899', border: '#EC4899' },
                  { kanban: 'rota_amarela', label: 'Amarela', cor: '#EAB308', border: '#EAB308' },
                  { kanban: 'rota_laranja', label: 'Laranja', cor: '#F97316', border: '#F97316' },
                ].map(rota => (
                  <button
                    key={rota.kanban}
                    onClick={() => handleRoutePickerSelect(rota.kanban)}
                    className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all hover:scale-105 active:scale-95"
                    style={{
                      backgroundColor: rota.cor + '15',
                      border: `1.5px solid ${rota.border}40`,
                    }}
                    onMouseOver={e => {
                      e.currentTarget.style.borderColor = rota.border;
                      e.currentTarget.style.boxShadow = `0 0 12px ${rota.cor}30`;
                    }}
                    onMouseOut={e => {
                      e.currentTarget.style.borderColor = rota.border + '40';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  >
                    <div
                      className="w-6 h-6 rounded-full"
                      style={{
                        backgroundColor: rota.cor,
                        border: rota.cor === '#1a1a1a' ? '2px solid #555' : 'none',
                        boxShadow: `0 0 8px ${rota.cor}50`,
                      }}
                    />
                    <span className="text-[10px] font-semibold" style={{ color: rota.cor === '#1a1a1a' ? 'var(--text-primary)' : rota.cor }}>
                      {rota.label}
                    </span>
                  </button>
                ))}
                <button
                  onClick={() => setRoutePickerOS(null)}
                  className="flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all hover:scale-105 active:scale-95"
                  style={{
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    border: '1.5px solid rgba(255,255,255,0.1)',
                  }}
                >
                  <div className="w-6 h-6 rounded-full flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.1)' }}>
                    <X className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
                  </div>
                  <span className="text-[10px] font-semibold" style={{ color: 'var(--text-secondary)' }}>
                    Depois
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <RouteSelectionModal
        isOpen={!!mandatoryRoutePickerOS}
        cidade={mandatoryRoutePickerOS?.cliente_cidade || ''}
        clienteNome={mandatoryRoutePickerOS?.cliente_nome}
        osNumero={mandatoryRoutePickerOS?.numero_os_samsung || mandatoryRoutePickerOS?.numero_os_interna || 'S/N'}
        clienteBairro={mandatoryRoutePickerOS?.cliente_bairro}
        onSelectRoute={(rotaColumn, cidadeCorrigida) => handleMandatoryRouteSelect(rotaColumn, cidadeCorrigida)}
        onCancel={() => {
          setMandatoryRoutePickerOS(null);
          setPendingMandatoryMove(null);
        }}
      />
    </div>
  );
}

interface ExportModalProps {
  osData: OS[];
  rotas: Array<{ id: string; nome: string; cor: string | null; cidades: string[]; coluna_kanban: string }>;
  onClose: () => void;
}

function ExportModal({ osData, rotas, onClose }: ExportModalProps) {
  const [exportConfig, setExportConfig] = useState({
    dadosBasicos: true,
    dadosCliente: true,
    dadosAparelho: true,
    dadosFinanceiros: true,
    dadosTempo: true,
    comentarios: false,
    pecas: false,
    anexos: false,
    agendamento: false
  });
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (osData.length === 0) {
      setInfoModalData({
        title: 'Exportação',
        message: 'Nenhuma OS para exportar.'
      });
      setShowInfoModal(true);
      return;
    }

    setExporting(true);
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();

      // Buscar dados adicionais se necessário
      const osIds = osData.map(os => os.id);
      let comentariosData: any[] = [];
      let pecasData: any[] = [];
      let anexosData: any[] = [];
      let agendamentosData: any[] = [];
      let analiseTecnicaData: any = {};

      // Buscar usuários para mapear nomes
      const { data: usuariosData } = await supabase
        .from('usuarios')
        .select('id, nome');
      const usuariosMap = new Map(usuariosData?.map(u => [u.id, u.nome]) || []);

      if (exportConfig.comentarios) {
        const { data } = await supabase
          .from('os_comentarios')
          .select('*')
          .in('os_id', osIds);
        comentariosData = data || [];
      }

      if (exportConfig.pecas) {
        // Buscar peças de cotações E requisições
        const { data: cotacoesData } = await supabase
          .from('cotacoes')
          .select(`
            id,
            os_id,
            numero_cotacao,
            cotacoes_pecas(*)
          `)
          .in('os_id', osIds);

        const { data: requisicoesData } = await supabase
          .from('requisicoes_pecas')
          .select('*')
          .in('os_id', osIds);

        const { data: osPecasData } = await supabase
          .from('os_pecas')
          .select('*')
          .in('os_id', osIds);

        pecasData = {
          cotacoes: cotacoesData || [],
          requisicoes: requisicoesData || [],
          osPecas: osPecasData || []
        };
      }

      if (exportConfig.anexos) {
        const { data } = await supabase
          .from('os_anexos')
          .select('*')
          .in('os_id', osIds);
        anexosData = data || [];
      }

      if (exportConfig.agendamento) {
        const { data } = await supabase
          .from('agendamentos')
          .select(`
            *,
            tecnico:usuarios!agendamentos_tecnico_agendado_id_fkey(nome)
          `)
          .in('os_id', osIds);
        agendamentosData = data || [];
      }

      // Buscar análise técnica das cotações
      const { data: cotacoesAnalise } = await supabase
        .from('cotacoes')
        .select('os_id, analise_tecnico')
        .in('os_id', osIds);

      cotacoesAnalise?.forEach(c => {
        if (c.analise_tecnico) {
          analiseTecnicaData[c.os_id] = c.analise_tecnico;
        }
      });

      // Criar planilha principal com OS
      const osRows = osData.map((os: any) => {
        const row: any = {};

        if (exportConfig.dadosBasicos) {
          row['Número OS Samsung'] = os.numero_os_samsung || '';
          row['Número OS Interna'] = os.numero_os_interna || '';

          // Adicionar Status (nome da coluna kanban)
          const colunaInfo = COLUNAS_KANBAN.find(c => c.id === os.coluna_kanban);
          row['Status'] = colunaInfo?.label || os.coluna_kanban || '';

          // Adicionar Motivo (se existir campo motivo_recusa ou similar)
          row['Motivo'] = os.motivo_recusa || os.observacoes || '';

          row['Tipo OS'] = os.tipo_os || '';
          row['Tipo Atendimento'] = os.tipo_atendimento || '';
          row['Tipo Orçamento'] = os.tipo_orcamento || '';
          row['Status GSPN'] = os.status_gspn || '';

          // Adicionar Análise Técnica
          row['Análise Técnica'] = analiseTecnicaData[os.id] || '';

          // Segunda OS
          row['Tem Segunda OS'] = os.tem_segunda_os ? 'Sim' : 'Não';
          row['Número Segunda OS'] = os.numero_segunda_os || '';
        }

        if (exportConfig.dadosCliente) {
          row['Cliente Nome'] = os.cliente_nome || '';
          row['Cliente CPF/CNPJ'] = os.cliente_cpf_cnpj || '';
          row['Cliente Telefone'] = os.cliente_telefone || '';
          row['Cliente Email'] = os.cliente_email || '';
          row['Cliente Endereço'] = os.cliente_endereco || '';
          row['Cliente CEP'] = os.cliente_cep || '';
          row['Cliente Cidade'] = normalizarCidade(os.cliente_cidade);
          row['Rota'] = (() => {
            if (!os.cliente_cidade) return '';
            const cidadeNorm = normalizarCidade(os.cliente_cidade).toLowerCase().trim();
            const rota = rotas.find(r => r.cidades.some(c => normalizarCidade(c).toLowerCase().trim() === cidadeNorm));
            return rota?.nome || '';
          })();
          row['Cliente Estado'] = os.cliente_estado || '';
          row['Cliente VIP'] = os.cliente_vip ? 'Sim' : 'Não';
        }

        if (exportConfig.dadosAparelho) {
          row['Aparelho Marca'] = os.aparelho_marca || '';
          row['Aparelho Linha'] = os.aparelho_linha || '';
          row['Aparelho Modelo'] = os.aparelho_modelo || '';
          row['Aparelho N° Série'] = os.aparelho_numero_serie || '';
          row['Aparelho IMEI'] = os.aparelho_imei || '';
          row['Defeito Relatado'] = os.defeito_relatado || '';
        }

        if (exportConfig.dadosFinanceiros) {
          row['Valor Total'] = os.valor_total || 0;
          row['Valor Pago'] = os.valor_pago || 0;
          row['Saldo Restante'] = os.saldo_restante || 0;
          row['Status Pagamento'] = os.status_pagamento || '';
        }

        if (exportConfig.dadosTempo) {
          const tat = Math.floor((new Date().getTime() - new Date(os.created_at).getTime()) / (1000 * 60 * 60 * 24));
          const tempoNaEtapa = Math.floor((new Date().getTime() - new Date(os.updated_at).getTime()) / (1000 * 60 * 60 * 24));
          row['TAT (dias)'] = tat;
          row['Tempo na Etapa (dias)'] = tempoNaEtapa;
          row['Data Criação'] = new Date(os.created_at).toLocaleString('pt-BR');
          row['Última Atualização'] = new Date(os.updated_at).toLocaleString('pt-BR');
        }

        return row;
      });

      const wsOS = XLSX.utils.json_to_sheet(osRows);
      XLSX.utils.book_append_sheet(workbook, wsOS, 'Ordens de Serviço');

      // Adicionar planilhas adicionais
      if (exportConfig.comentarios && comentariosData.length > 0) {
        const comentariosRows = comentariosData.map((c: any) => {
          const os = osData.find(o => o.id === c.os_id);
          const numeroOS = os?.numero_os_samsung || os?.numero_os_interna || 'S/N';
          const nomeUsuario = usuariosMap.get(c.usuario_id) || 'Sistema';

          return {
            'Número OS': numeroOS,
            'Usuário': nomeUsuario,
            'Comentário': c.comentario,
            'Sistema': c.is_system ? 'Sim' : 'Não',
            'Data': new Date(c.created_at).toLocaleString('pt-BR')
          };
        });
        const wsComentarios = XLSX.utils.json_to_sheet(comentariosRows);
        XLSX.utils.book_append_sheet(workbook, wsComentarios, 'Comentários');
      }

      if (exportConfig.pecas && pecasData) {
        const pecasRows: any[] = [];

        // Peças de Cotações
        if (pecasData.cotacoes && Array.isArray(pecasData.cotacoes)) {
          pecasData.cotacoes.forEach((cotacao: any) => {
            const os = osData.find(o => o.id === cotacao.os_id);
            const numeroOS = os?.numero_os_samsung || os?.numero_os_interna || 'S/N';

            if (cotacao.cotacoes_pecas && Array.isArray(cotacao.cotacoes_pecas)) {
              cotacao.cotacoes_pecas.forEach((peca: any) => {
                pecasRows.push({
                  'Número OS': numeroOS,
                  'Origem': 'Cotação',
                  'Número Cotação': cotacao.numero_cotacao || '',
                  'Código': peca.codigo || '',
                  'Descrição': peca.descricao || '',
                  'Quantidade': peca.quantidade || 0,
                  'Valor Unitário': peca.valor_unitario || 0,
                  'Valor Total': peca.valor_total || 0,
                  'Valor Base GSPN': peca.valor_base_gspn || 0,
                  'Status': peca.status || '',
                  'Delivery': peca.delivery || '',
                  'É GSPN': peca.is_gspn ? 'Sim' : 'Não'
                });
              });
            }
          });
        }

        // Requisições de Peças
        if (pecasData.requisicoes && Array.isArray(pecasData.requisicoes)) {
          pecasData.requisicoes.forEach((req: any) => {
            const os = osData.find(o => o.id === req.os_id);
            const numeroOS = os?.numero_os_samsung || os?.numero_os_interna || 'S/N';
            const nomeUsuario = usuariosMap.get(req.requisitada_por) || 'N/A';

            pecasRows.push({
              'Número OS': numeroOS,
              'Origem': 'Requisição',
              'Número Cotação': '',
              'Código': req.codigo_peca || '',
              'Descrição': req.descricao || '',
              'Quantidade': req.quantidade_solicitada || 0,
              'Valor Unitário': 0,
              'Valor Total': 0,
              'Valor Base GSPN': 0,
              'Status': req.status || '',
              'Delivery': '',
              'É GSPN': '',
              'Requisitada Por': nomeUsuario,
              'Motivo': req.motivo || '',
              'Pedido Samsung': req.numero_pedido_samsung || '',
              'GI Postada': req.gi_postada_samsung ? 'Sim' : 'Não'
            });
          });
        }

        // OS Peças (GSPN)
        if (pecasData.osPecas && Array.isArray(pecasData.osPecas)) {
          pecasData.osPecas.forEach((peca: any) => {
            const os = osData.find(o => o.id === peca.os_id);
            const numeroOS = os?.numero_os_samsung || os?.numero_os_interna || 'S/N';

            pecasRows.push({
              'Número OS': numeroOS,
              'Origem': 'GSPN',
              'Número Cotação': '',
              'Código': peca.sku || '',
              'Descrição': peca.nome || '',
              'Quantidade': peca.quantidade || 0,
              'Valor Unitário': peca.preco || 0,
              'Valor Total': (peca.preco || 0) * (peca.quantidade || 0),
              'Valor Base GSPN': peca.preco || 0,
              'Status': peca.status_gspn || '',
              'Delivery': '',
              'É GSPN': 'Sim',
              'ID GSPN': peca.gspn_id || ''
            });
          });
        }

        if (pecasRows.length > 0) {
          const wsPecas = XLSX.utils.json_to_sheet(pecasRows);
          XLSX.utils.book_append_sheet(workbook, wsPecas, 'Peças');
        }
      }

      if (exportConfig.anexos && anexosData.length > 0) {
        const anexosRows = anexosData.map((a: any) => {
          const os = osData.find(o => o.id === a.os_id);
          const numeroOS = os?.numero_os_samsung || os?.numero_os_interna || 'S/N';
          const nomeUsuario = usuariosMap.get(a.usuario_id) || 'Sistema';

          return {
            'Número OS': numeroOS,
            'Nome Arquivo': a.nome_arquivo,
            'Tipo': a.tipo,
            'URL': a.url,
            'Usuário': nomeUsuario,
            'Data Upload': new Date(a.created_at).toLocaleString('pt-BR')
          };
        });
        const wsAnexos = XLSX.utils.json_to_sheet(anexosRows);
        XLSX.utils.book_append_sheet(workbook, wsAnexos, 'Anexos');
      }

      if (exportConfig.agendamento && agendamentosData.length > 0) {
        const agendamentosRows = agendamentosData.map((a: any) => {
          const os = osData.find(o => o.id === a.os_id);
          const numeroOS = os?.numero_os_samsung || os?.numero_os_interna || 'S/N';
          const nomeTecnico = a.tecnico?.nome || 'Não designado';

          return {
            'Número OS': numeroOS,
            'Data Agendamento': a.data_agendamento ? new Date(a.data_agendamento + 'T00:00:00').toLocaleDateString('pt-BR') : '',
            'Período': a.periodo_agendamento || '',
            'Técnico Designado': nomeTecnico,
            'Cidade': normalizarCidade(os?.cliente_cidade),
            'Endereço': os?.cliente_endereco || '',
            'Bairro': os?.cliente_bairro || '',
            'CEP': os?.cliente_cep || '',
            'Confirmado': a.confirmado_com_cliente ? 'Sim' : 'Não',
            'Check-in': a.data_checkin ? new Date(a.data_checkin).toLocaleString('pt-BR') : '',
            'Check-out': a.data_checkout ? new Date(a.data_checkout).toLocaleString('pt-BR') : '',
            'Latitude': a.lat || '',
            'Longitude': a.lng || ''
          };
        });
        const wsAgendamentos = XLSX.utils.json_to_sheet(agendamentosRows);
        XLSX.utils.book_append_sheet(workbook, wsAgendamentos, 'Agendamentos');
      }

      // Salvar arquivo
      const fileName = `OS_Export_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(workbook, fileName);

      onClose();
    } catch (error) {
      setErrorModalData({
        title: 'Erro na Exportação',
        message: 'Não foi possível exportar os dados. Por favor, tente novamente.'
      });
      setShowErrorModal(true);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }}>
      <div
        className="w-full max-w-md rounded-xl p-6"
        style={{
          background: 'linear-gradient(135deg, rgba(0,15,30,0.98) 0%, rgba(0,20,40,0.98) 100%)',
          border: '1px solid rgba(16,185,129,0.3)',
          boxShadow: '0 10px 40px rgba(0,0,0,0.5), 0 0 20px rgba(16,185,129,0.2)'
        }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-[#10B981]">Exportar para Excel</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="mb-4 text-sm text-gray-300">
          {Object.values(osData).reduce((sum, cards) => sum + cards.length, 0)} OS serão exportadas
        </div>

        <div className="space-y-3 mb-6">
          <div className="text-xs font-bold text-[#10B981] mb-2">SELECIONE OS DADOS PARA EXPORTAR:</div>

          {[
            { key: 'dadosBasicos', label: 'Dados Básicos da OS' },
            { key: 'dadosCliente', label: 'Dados do Cliente' },
            { key: 'dadosAparelho', label: 'Dados do Aparelho' },
            { key: 'dadosFinanceiros', label: 'Dados Financeiros' },
            { key: 'dadosTempo', label: 'Tempo (TAT e SLA)' },
            { key: 'comentarios', label: 'Comentários' },
            { key: 'pecas', label: 'Peças' },
            { key: 'anexos', label: 'Anexos' },
            { key: 'agendamento', label: 'Agendamento' }
          ].map(({ key, label }) => (
            <div
              key={key}
              onClick={() => setExportConfig({ ...exportConfig, [key]: !exportConfig[key as keyof typeof exportConfig] })}
              className="flex items-center gap-3 cursor-pointer p-3 rounded transition-all"
              style={{
                background: exportConfig[key as keyof typeof exportConfig]
                  ? 'linear-gradient(135deg, rgba(16,185,129,0.15) 0%, rgba(16,185,129,0.05) 100%)'
                  : 'rgba(107,114,128,0.05)',
                border: `1px solid ${exportConfig[key as keyof typeof exportConfig] ? 'rgba(16,185,129,0.3)' : 'transparent'}`
              }}
            >
              <input
                type="checkbox"
                checked={exportConfig[key as keyof typeof exportConfig]}
                onChange={() => {}}
                className="w-4 h-4 rounded accent-[#10B981] pointer-events-none"
              />
              <span className={`text-sm flex-1 ${exportConfig[key as keyof typeof exportConfig] ? 'text-[#10B981] font-medium' : 'text-gray-400'}`}>
                {label}
              </span>
            </div>
          ))}
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-colors"
            style={{
              background: 'rgba(107,114,128,0.1)',
              border: '1px solid rgba(107,114,128,0.3)',
              color: '#9CA3AF'
            }}
          >
            Cancelar
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex-1 px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, rgba(16,185,129,0.2) 0%, rgba(16,185,129,0.1) 100%)',
              border: '1px solid #10B981',
              color: '#10B981',
              boxShadow: '0 0 10px rgba(16,185,129,0.2)'
            }}
          >
            {exporting ? 'Exportando...' : 'Exportar'}
          </button>
        </div>
      </div>
    </div>
  );
}
