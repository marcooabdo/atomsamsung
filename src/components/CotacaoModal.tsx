import { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { X, Save, Building, User, Wrench, DollarSign, Paperclip, MessageSquare, Plus, Trash2, Upload, Send, Lock, AlertTriangle, Edit, Microscope, Copy, Check } from 'lucide-react';
import { OSPagamentoTab } from './OSPagamentoTab';
import { AddPaymentModal } from './AddPaymentModal';
import { PaymentDetailsModal } from './PaymentDetailsModal';
import { EditPaymentModal } from './EditPaymentModal';

interface CotacaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
  cotacaoId?: string | null;
  abrirNaAbaComentarios?: boolean;
}

interface Unidade {
  id: string;
  nome: string;
}

interface Servico {
  id: string;
  nome: string;
  descricao: string | null;
  valor_base: number;
}

interface Markup {
  id: string;
  nome: string;
  valor_minimo: number | null;
  valor_maximo: number | null;
  tipo: 'percentual' | 'multiplicador' | 'valor_fixo';
  valor: number;
  ativo: boolean;
}

interface TaxaMaquina {
  parcelamento: number;
  taxa: number;
}

interface FormaPagamento {
  id: string;
  nome: string;
  requer_sku: boolean;
  taxa_percentual: number;
  ativa: boolean;
}

interface PecaItem {
  id: string;
  pn: string;
  descricao: string;
  quantidade: number;
  valor_gspn: number;
  valor_final: number;
  observacao: string;
  origem?: string;
  valor_unitario?: number;
  is_gspn?: boolean; // Marca se é peça da API Samsung GSPN
}

interface PNSugestao {
  pn: string;
  descricao: string;
  valor_medio: number;
}

interface ServicoItem {
  id: string;
  servico_id: string;
  servico_nome: string;
  quantidade: number;
  valor_unitario: number;
  observacao: string;
}

interface Comentario {
  id: string;
  usuario_nome: string;
  texto: string;
  created_at: string;
  is_system: boolean;
}

export function CotacaoModal({ isOpen, onClose, onSave, cotacaoId, abrirNaAbaComentarios }: CotacaoModalProps) {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(false);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [markups, setMarkups] = useState<Markup[]>([]);
  const [taxasMaquina, setTaxasMaquina] = useState<TaxaMaquina[]>([]);
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([]);
  const [activeTab, setActiveTab] = useState<'dados' | 'pecas' | 'servicos' | 'anexos' | 'comentarios' | 'pagamento'>('dados');

  const [tipoAtendimento, setTipoAtendimento] = useState<'IH' | 'CI'>('CI');
  const [tipoOS, setTipoOS] = useState('OW');
  const [tipoOrcamento, setTipoOrcamento] = useState<'normal' | 'acessorios' | 'samsung_contigo'>('normal');
  const [numeroOSSamsung, setNumeroOSSamsung] = useState('');
  const [unidadeId, setUnidadeId] = useState('');

  const [clienteNome, setClienteNome] = useState('');
  const [clienteCPF, setClienteCPF] = useState('');
  const [clienteTelefone, setClienteTelefone] = useState('');
  const [clienteEmail, setClienteEmail] = useState('');
  const [clienteCEP, setClienteCEP] = useState('');
  const [clienteLogradouro, setClienteLogradouro] = useState('');
  const [clienteNumero, setClienteNumero] = useState('');
  const [clienteComplemento, setClienteComplemento] = useState('');
  const [clienteBairro, setClienteBairro] = useState('');
  const [clienteCidade, setClienteCidade] = useState('');
  const [clienteEstado, setClienteEstado] = useState('');

  const [aparelhoLinha, setAparelhoLinha] = useState('');
  const [aparelhoModelo, setAparelhoModelo] = useState('');
  const [aparelhoSerial, setAparelhoSerial] = useState('');
  const [aparelhoIMEI, setAparelhoIMEI] = useState('');

  const [defeitoRelatado, setDefeitoRelatado] = useState('');
  const [observacoesInternas, setObservacoesInternas] = useState('');

  const [pecas, setPecas] = useState<PecaItem[]>([]);
  const [servicosItems, setServicosItems] = useState<ServicoItem[]>([]);

  const [descontoTipo, setDescontoTipo] = useState<'percentual' | 'valor'>('percentual');
  const [descontoValor, setDescontoValor] = useState('0');

  const [anexos, setAnexos] = useState<File[]>([]);
  const [anexosSalvos, setAnexosSalvos] = useState<any[]>([]);
  const [comentarios, setComentarios] = useState<Comentario[]>([]);
  const [novoComentario, setNovoComentario] = useState('');
  const [pnSugestoes, setPnSugestoes] = useState<PNSugestao[]>([]);
  const [showSugestoes, setShowSugestoes] = useState<string | null>(null);
  const [mostrarComentariosSistema, setMostrarComentariosSistema] = useState(true);
  const [pecasEmTransito, setPecasEmTransito] = useState<string[]>([]);
  const [pecasBloqueadasInfo, setPecasBloqueadasInfo] = useState<Array<{cotacao_peca_id: string; pn: string; motivo: 'requisicao' | 'estoque'; status: string; numero_pedido?: string}>>([]);
  const [pecasOriginais, setPecasOriginais] = useState<PecaItem[]>([]);
  const [osData, setOsData] = useState<any>(null);
  const [pagamentosTemporarios, setPagamentosTemporarios] = useState<any[]>([]);
  const [showAddPaymentModal, setShowAddPaymentModal] = useState(false);
  const isAddingPayment = useRef(false);
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [showPaymentDetailsModal, setShowPaymentDetailsModal] = useState(false);
  const [showEditPaymentModal, setShowEditPaymentModal] = useState(false);
  const [paymentToEdit, setPaymentToEdit] = useState<any>(null);

  // Tracking fields for orçamento sent status
  const [orcamentoEnviado, setOrcamentoEnviado] = useState(false);
  const [orcamentoEnviadoEm, setOrcamentoEnviadoEm] = useState<string | null>(null);
  const [orcamentoModificadoAposEnvio, setOrcamentoModificadoAposEnvio] = useState(false);

  // Tracking fields for analise do técnico
  const [analiseTecnicoConcluida, setAnaliseTecnicoConcluida] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadUnidades();
      loadFormasPagamento();
      if (cotacaoId) {
        loadCotacaoData(cotacaoId);
      } else {
        resetForm();
      }
      if (abrirNaAbaComentarios) {
        setActiveTab('comentarios');
      }
    }
  }, [isOpen, cotacaoId, abrirNaAbaComentarios]);

  useEffect(() => {
    if (isOpen && unidadeId) {
      loadServicos();
      loadMarkups();
      loadTaxasMaquina();
      setPecas([]);
      setServicosItems([]);
    }
  }, [isOpen, unidadeId, tipoOrcamento]);

  useEffect(() => {
  }, [showAddPaymentModal, cotacaoId, osData, pagamentosTemporarios]);

  const loadUnidades = async () => {
    const { data } = await supabase
      .from('unidades')
      .select('id, nome')
      .order('nome');
    setUnidades(data || []);
  };

  const loadFormasPagamento = async () => {
    const { data } = await supabase
      .from('formas_pagamento')
      .select('*')
      .eq('ativa', true)
      .order('nome');
    setFormasPagamento(data || []);
  };

  const resetForm = () => {
    setActiveTab('dados');
    setTipoAtendimento('CI');
    setTipoOS('OW');
    setNumeroOSSamsung('');
    setUnidadeId('');
    setClienteNome('');
    setClienteCPF('');
    setClienteTelefone('');
    setClienteEmail('');
    setClienteCEP('');
    setClienteLogradouro('');
    setClienteNumero('');
    setClienteComplemento('');
    setClienteBairro('');
    setClienteCidade('');
    setClienteEstado('');
    setAparelhoLinha('');
    setAparelhoModelo('');
    setAparelhoSerial('');
    setAparelhoIMEI('');
    setDefeitoRelatado('');
    setObservacoesInternas('');
    setPecas([]);
    setServicosItems([]);
    setDescontoTipo('percentual');
    setDescontoValor('0');
    setAnexos([]);
    setComentarios([]);
    setNovoComentario('');
    setPecasEmTransito([]);
    setPecasOriginais([]);
    setPagamentosTemporarios([]);
    setOsData(null);
  };

  const loadCotacaoData = async (id: string) => {
    try {
      setLoading(true);

      // Carrega dados principais da cotação
      const { data: cotacao, error: cotacaoError } = await supabase
        .from('cotacoes')
        .select('*')
        .eq('id', id)
        .single();

      if (cotacaoError) throw cotacaoError;

      // Preenche campos básicos
      setTipoAtendimento(cotacao.tipo_atendimento || 'CI');
      setTipoOS(cotacao.tipo_os || 'OW');
      setTipoOrcamento(cotacao.tipo_orcamento || 'normal');
      setNumeroOSSamsung(cotacao.numero_os_samsung || '');
      setUnidadeId(cotacao.unidade_id || '');
      setClienteNome(cotacao.cliente_nome || '');
      setClienteCPF(cotacao.cliente_cpf_cnpj || '');
      setClienteTelefone(cotacao.cliente_telefone || '');
      setClienteEmail(cotacao.cliente_email || '');

      // Carregar campos de endereço individuais
      setClienteLogradouro(cotacao.cliente_logradouro || '');
      setClienteNumero(cotacao.cliente_numero || '');
      setClienteComplemento(cotacao.cliente_complemento || '');
      setClienteBairro(cotacao.cliente_bairro || '');
      setClienteCidade(cotacao.cliente_cidade || '');
      setClienteEstado(cotacao.cliente_estado || '');
      setClienteCEP(cotacao.cliente_cep || '');

      setAparelhoLinha(cotacao.aparelho_linha || '');
      setAparelhoModelo(cotacao.aparelho_modelo || '');
      setAparelhoSerial(cotacao.aparelho_numero_serie || '');
      setAparelhoIMEI(cotacao.aparelho_numero_serie || '');
      setDefeitoRelatado(cotacao.defeito_relatado || '');
      setObservacoesInternas(cotacao.observacoes_internas || '');

      // Carrega dados de desconto
      setDescontoTipo(cotacao.desconto_tipo || 'percentual');
      setDescontoValor(cotacao.desconto_valor?.toString() || '0');

      // Carrega status de envio do orçamento
      setOrcamentoEnviado(cotacao.orcamento_enviado || false);
      setOrcamentoEnviadoEm(cotacao.orcamento_enviado_em || null);
      setOrcamentoModificadoAposEnvio(cotacao.orcamento_modificado_apos_envio || false);

      // Carrega status de análise do técnico
      setAnaliseTecnicoConcluida(cotacao.analise_tecnico_concluida || false);

      // Carrega peças
      const { data: pecasData, error: pecasError } = await supabase
        .from('cotacoes_pecas')
        .select('*')
        .eq('cotacao_id', id);

      if (pecasError) throw pecasError;

      const pecasCarregadas = (pecasData || []).map(p => ({
        id: p.id,
        pn: p.pn,
        descricao: p.descricao,
        quantidade: p.quantidade,
        valor_gspn: p.valor_base_gspn,
        valor_final: p.valor_final_unitario,
        observacao: p.observacao || '',
        is_gspn: p.is_gspn || false
      }));

      setPecas(pecasCarregadas);
      setPecasOriginais(JSON.parse(JSON.stringify(pecasCarregadas))); // Deep clone

      // Carrega requisições de peças em trânsito
      // Busca TODAS as OS relacionadas à cotação usando busca separada para confiabilidade
      const osIds: string[] = [];

      // 1. Buscar OS vinculada diretamente por cotacao_id
      const { data: osVinculada } = await supabase
        .from('os')
        .select('id')
        .eq('cotacao_id', id);

      if (osVinculada) {
        osIds.push(...osVinculada.map(o => o.id));
      }

      // 2. Buscar OS pelo numero_os_samsung (OS movida do Kanban)
      if (cotacao.numero_os_samsung) {
        const { data: osPorNumero } = await supabase
          .from('os')
          .select('id')
          .eq('numero_os_samsung', cotacao.numero_os_samsung);

        if (osPorNumero) {
          osPorNumero.forEach(os => {
            if (!osIds.includes(os.id)) {
              osIds.push(os.id);
            }
          });
        }
      }

      // 3. Buscar requisições vinculadas à cotação
      // Buscar APENAS requisições que realmente bloqueiam (não pendentes, reprovadas ou canceladas)
      // IMPORTANTE: Requisições "pendente" não bloqueiam, pois ainda não foram atendidas
      const { data: requisicoesData } = await supabase
        .from('requisicoes_pecas')
        .select('cotacao_peca_id, codigo_peca, descricao, numero_pedido_samsung, status')
        .eq('cotacao_id', id)
        .not('status', 'in', '(pendente,reprovada,cancelada)');

      const pecasBloqueadasPorRequisicao: string[] = [];
      const pecasInfoCompleto: Array<{cotacao_peca_id: string; pn: string; motivo: 'requisicao' | 'estoque'; status: string; numero_pedido?: string}> = [];

      // Processar requisições bloqueadas
      if (requisicoesData && requisicoesData.length > 0) {
        requisicoesData.forEach(r => {
          // Apenas bloquear se tiver cotacao_peca_id (peças que já existem no banco)
          // Peças novas (sem cotacao_peca_id) nunca serão bloqueadas
          if (r.codigo_peca && r.cotacao_peca_id) {
            pecasBloqueadasPorRequisicao.push(r.codigo_peca);
            pecasInfoCompleto.push({
              cotacao_peca_id: r.cotacao_peca_id,
              pn: r.codigo_peca,
              motivo: 'requisicao',
              status: r.status,
              numero_pedido: r.numero_pedido_samsung
            });
          }
        });
      }

      setPecasEmTransito(pecasBloqueadasPorRequisicao);
      setPecasBloqueadasInfo(pecasInfoCompleto);

      // Carrega serviços
      const { data: servicosData, error: servicosError } = await supabase
        .from('cotacoes_servicos')
        .select('*, servicos(nome)')
        .eq('cotacao_id', id);

      if (servicosError) throw servicosError;

      setServicosItems((servicosData || []).map(s => ({
        id: s.id,
        servico_id: s.servico_id || '',
        servico_nome: s.servicos?.nome || s.descricao || '',
        quantidade: s.quantidade,
        valor_unitario: s.valor_unitario,
        observacao: s.observacao || ''
      })));

      // Carrega comentários
      const { data: comentariosData, error: comentariosError } = await supabase
        .from('cotacao_comentarios')
        .select('*, usuarios(nome), is_system')
        .eq('cotacao_id', id)
        .order('created_at', { ascending: false });

      if (comentariosError) throw comentariosError;

      setComentarios((comentariosData || []).map(c => ({
        id: c.id,
        usuario_nome: c.usuarios?.nome || 'Usuário',
        texto: c.texto,
        created_at: c.created_at,
        is_system: c.is_system || false
      })));

      // Carrega anexos
      const { data: anexosData, error: anexosError } = await supabase
        .from('os_anexos')
        .select('*')
        .eq('cotacao_id', id)
        .order('created_at', { ascending: false });

      if (anexosError) throw anexosError;

      // Armazena anexos salvos no banco
      setAnexosSalvos(anexosData || []);

      // Carregar dados completos da OS para a aba de pagamento
      if (osIds.length > 0) {
        const { data: osCompleta } = await supabase
          .from('os')
          .select('*')
          .eq('id', osIds[0])
          .single();

        if (osCompleta) {
          setOsData(osCompleta);
        }
      }

      // Carrega pagamentos vinculados à cotação
      const { data: pagamentosData, error: pagamentosError } = await supabase
        .from('pagamentos')
        .select('*')
        .eq('cotacao_id', id)
        .is('os_id', null)
        .order('created_at', { ascending: false });

      if (pagamentosError) {
      } else {
        setPagamentosTemporarios(pagamentosData || []);
      }

    } catch (error) {
      alert('Erro ao carregar dados da cotação');
    } finally {
      setLoading(false);
    }
  };

  const loadServicos = async () => {
    if (!unidadeId) {
      setServicos([]);
      return;
    }
    const { data } = await supabase
      .rpc('get_servicos_for_unidade', { p_unidade_id: unidadeId });
    setServicos(data || []);
  };

  const loadMarkups = async () => {
    if (!unidadeId) {
      setMarkups([]);
      return;
    }
    const { data } = await supabase
      .rpc('get_markup_for_unidade_and_tipo', {
        p_unidade_id: unidadeId,
        p_tipo_orcamento: 'normal'
      });
    setMarkups(data || []);
  };

  const loadTaxasMaquina = async () => {
    if (!unidadeId) {
      setTaxasMaquina([]);
      return;
    }
    const { data } = await supabase
      .rpc('get_taxas_for_unidade', { p_unidade_id: unidadeId });
    setTaxasMaquina(data || []);
  };

  const buscarCEP = async (cep: string) => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await response.json();

      if (!data.erro) {
        setClienteLogradouro(data.logradouro || '');
        setClienteBairro(data.bairro || '');
        setClienteCidade(data.localidade || '');
        setClienteEstado(data.uf || '');
      }
    } catch (error) {
    }
  };

  const buscarClientePorCPF = async (cpf: string) => {
    const cpfLimpo = cpf.replace(/\D/g, '');
    if (cpfLimpo.length < 11) return;

    try {
      const { data } = await supabase
        .from('clientes')
        .select('*')
        .eq('cpf_cnpj', cpfLimpo)
        .maybeSingle();

      if (data) {
        setClienteNome(data.nome || '');
        setClienteTelefone(data.telefone || '');
        setClienteEmail(data.email || '');
        setClienteCEP(data.cep || '');
        setClienteLogradouro(data.logradouro || '');
        setClienteNumero(data.numero || '');
        setClienteComplemento(data.complemento || '');
        setClienteBairro(data.bairro || '');
        setClienteCidade(data.cidade || '');
        setClienteEstado(data.estado || '');
      }
    } catch (error) {
    }
  };

  const calcularValorComMarkup = (valorGSPN: number): number => {
    if (markups.length === 0) return valorGSPN;

    const markupAplicavel = markups.find(m => {
      if (!m.ativo) return false;
      const dentroMin = m.valor_minimo === null || valorGSPN >= m.valor_minimo;
      const dentroMax = m.valor_maximo === null || valorGSPN <= m.valor_maximo;
      return dentroMin && dentroMax;
    });

    if (!markupAplicavel) return valorGSPN;

    switch (markupAplicavel.tipo) {
      case 'percentual':
        return valorGSPN * (1 + markupAplicavel.valor / 100);
      case 'multiplicador':
        return valorGSPN * markupAplicavel.valor;
      case 'valor_fixo':
        return valorGSPN + markupAplicavel.valor;
      default:
        return valorGSPN;
    }
  };

  // Numero da cotacao sera gerado automaticamente pelo banco (COT-01, COT-02, etc)

  const handleAddPeca = () => {
    setPecas([...pecas, {
      id: crypto.randomUUID(),
      pn: '',
      descricao: '',
      quantidade: 1,
      valor_gspn: 0,
      valor_final: 0,
      observacao: ''
    }]);
  };

  const handleRemovePeca = (id: string) => {
    setPecas(pecas.filter(p => p.id !== id));
  };

  const buscarPNsSugestoes = async (termo: string) => {
    if (!unidadeId) {
      setPnSugestoes([]);
      return;
    }

    try {
      let query = supabase
        .from('estoque_pecas')
        .select('pn, descricao, valor_com_impostos, data_entrada')
        .eq('unidade_id', unidadeId)
        .order('data_entrada', { ascending: false });

      // Se tem termo, filtra. Se não, pega as mais recentes
      if (termo && termo.length >= 2) {
        query = query.ilike('pn', `%${termo}%`);
      }

      const { data } = await query.limit(50);

      if (data) {
        const sugestoesPorPN = new Map<string, PNSugestao>();

        data.forEach(peca => {
          if (!sugestoesPorPN.has(peca.pn)) {
            sugestoesPorPN.set(peca.pn, {
              pn: peca.pn,
              descricao: peca.descricao,
              valor_medio: peca.valor_com_impostos
            });
          }
        });

        const sugestoesUnicas = Array.from(sugestoesPorPN.values()).slice(0, 10);
        setPnSugestoes(sugestoesUnicas);
      }
    } catch (error) {
    }
  };

  const selecionarPNSugestao = (pecaId: string, sugestao: PNSugestao) => {
    // Fecha dropdown imediatamente
    setShowSugestoes(null);
    setPnSugestoes([]);

    // Atualiza todos os campos de uma vez
    setPecas(pecas.map(p => {
      if (p.id === pecaId) {
        const valorComMarkup = calcularValorComMarkup(sugestao.valor_medio);
        return {
          ...p,
          pn: sugestao.pn,
          descricao: sugestao.descricao,
          valor_gspn: sugestao.valor_medio,
          valor_final: valorComMarkup * p.quantidade
        };
      }
      return p;
    }));
  };

  const handlePecaChange = (id: string, field: keyof PecaItem, value: any) => {
    setPecas(pecas.map(p => {
      if (p.id === id) {
        const updated = { ...p, [field]: value };
        if (field === 'valor_gspn' || field === 'quantidade') {
          const valorComMarkup = calcularValorComMarkup(updated.valor_gspn);
          updated.valor_final = valorComMarkup * updated.quantidade;
        }
        if (field === 'pn') {
          buscarPNsSugestoes(value);
          setShowSugestoes(id);
        }
        return updated;
      }
      return p;
    }));
  };

  const handleAddServico = () => {
    setServicosItems([...servicosItems, {
      id: crypto.randomUUID(),
      servico_id: '',
      servico_nome: '',
      quantidade: 1,
      valor_unitario: 0,
      observacao: ''
    }]);
  };

  const handleRemoveServico = (id: string) => {
    setServicosItems(servicosItems.filter(s => s.id !== id));
  };

  const handleServicoChange = (id: string, field: string, value: any) => {
    setServicosItems(servicosItems.map(s => {
      if (s.id === id) {
        if (field === 'servico_id') {
          const servico = servicos.find(srv => srv.id === value);
          if (servico) {
            return {
              ...s,
              servico_id: value,
              servico_nome: servico.nome,
              valor_unitario: servico.valor_base
            };
          }
        }
        return { ...s, [field]: value };
      }
      return s;
    }));
  };

  const getTipoAnexo = (mimeType: string): 'foto' | 'video' | 'documento' => {
    if (mimeType.startsWith('image/')) return 'foto';
    if (mimeType.startsWith('video/')) return 'video';
    return 'documento';
  };

  const handleAddAnexo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;

    const files = Array.from(e.target.files);
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    const MAX_TOTAL_FILES = 10;

    // Validações
    const arquivosGrandes: string[] = [];
    const arquivosValidos: File[] = [];

    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        arquivosGrandes.push(`${file.name} (${(file.size / 1024 / 1024).toFixed(2)}MB)`);
      } else {
        arquivosValidos.push(file);
      }
    }

    if (arquivosGrandes.length > 0) {
      alert(`Os seguintes arquivos excedem o tamanho máximo de 50MB:\n${arquivosGrandes.join('\n')}`);
    }

    if (arquivosValidos.length === 0) return;

    const totalAnexos = (anexos.length + anexosSalvos.length + arquivosValidos.length);
    if (totalAnexos > MAX_TOTAL_FILES) {
      alert(`Limite de ${MAX_TOTAL_FILES} anexos por cotação. Você já tem ${anexos.length + anexosSalvos.length} anexo(s).`);
      return;
    }

    // Se está editando uma cotação existente, faz upload e salva no banco
    if (cotacaoId) {
      setLoading(true);
      try {
        for (const file of arquivosValidos) {
          // Gera nome único para o arquivo
          const fileExt = file.name.split('.').pop();
          const fileName = `${cotacaoId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

          // Upload para o Supabase Storage
          const { error: uploadError } = await supabase.storage
            .from('cotacoes-anexos')
            .upload(fileName, file);

          if (uploadError) {
            alert(`Erro ao fazer upload de ${file.name}: ${uploadError.message}`);
            continue;
          }

          // Salva referência no banco com o caminho do arquivo
          const { error: dbError } = await supabase
            .from('os_anexos')
            .insert({
              cotacao_id: cotacaoId,
              tipo: getTipoAnexo(file.type),
              nome_arquivo: file.name,
              url: fileName, // Salva o caminho do arquivo no storage
              tamanho_bytes: file.size,
              usuario_id: usuario?.id
            });

          if (dbError) {
            alert(`Erro ao salvar referência de ${file.name}: ${dbError.message}`);
          }
        }

        // Recarrega os anexos
        await loadCotacaoData(cotacaoId);
        alert('Anexos salvos com sucesso!');
      } catch (error) {
        alert('Erro ao adicionar anexos');
      } finally {
        setLoading(false);
      }
    } else {
      // Se é nova cotação, apenas adiciona ao estado local
      setAnexos([...anexos, ...arquivosValidos]);
    }
  };

  const handleRemoveAnexo = (index: number) => {
    setAnexos(anexos.filter((_, i) => i !== index));
  };

  const handleDownloadAnexo = async (anexo: any) => {
    try {
      const { data, error } = await supabase.storage
        .from('cotacoes-anexos')
        .download(anexo.url);

      if (error) throw error;

      // Cria URL do blob e faz download
      const url = URL.createObjectURL(data);
      const a = document.createElement('a');
      a.href = url;
      a.download = anexo.nome_arquivo;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      alert('Erro ao baixar arquivo');
    }
  };

  const handleAddComentario = async () => {
    if (!novoComentario.trim()) return;

    // Se está editando uma cotação existente, salva no banco
    if (cotacaoId) {
      try {
        const { data, error } = await supabase
          .from('cotacao_comentarios')
          .insert({
            cotacao_id: cotacaoId,
            usuario_id: usuario?.id,
            texto: novoComentario
          })
          .select('*, usuarios(nome)')
          .single();

        if (error) throw error;

        const comentario: Comentario = {
          id: data.id,
          usuario_nome: data.usuarios?.nome || 'Usuário',
          texto: data.texto,
          created_at: data.created_at
        };

        setComentarios([...comentarios, comentario]);
        setNovoComentario('');
        alert('Comentário adicionado com sucesso!');
      } catch (error) {
        alert('Erro ao adicionar comentário');
      }
    } else {
      // Se é nova cotação, apenas adiciona ao estado local
      const comentario: Comentario = {
        id: crypto.randomUUID(),
        usuario_nome: usuario?.nome || 'Usuário',
        texto: novoComentario,
        created_at: new Date().toISOString()
      };

      setComentarios([...comentarios, comentario]);
      setNovoComentario('');
    }
  };

  const calcularSubtotal = () => {
    const totalPecas = pecas.reduce((sum, p) => sum + p.valor_final, 0);
    const totalServicos = servicosItems.reduce((sum, s) => sum + (s.valor_unitario * s.quantidade), 0);
    return totalPecas + totalServicos;
  };

  const calcularDesconto = () => {
    const subtotal = calcularSubtotal();
    const desconto = parseFloat(descontoValor) || 0;

    if (descontoTipo === 'percentual') {
      return subtotal * (desconto / 100);
    }
    return desconto;
  };

  const calcularValorTotal = () => {
    const subtotal = calcularSubtotal();
    const desconto = calcularDesconto();
    const total = subtotal - desconto;

    return Math.round(total * 100) / 100; // Garantir 2 casas decimais
  };

  const handleSave = async () => {
    if (!clienteNome.trim()) {
      alert('Nome do cliente é obrigatório');
      return;
    }

    // Validar se há peças bloqueadas (em trânsito) sendo modificadas ou removidas
    if (pecasBloqueadasInfo.length > 0) {
      // Verificar se peças bloqueadas foram removidas (verifica pelo ID da linha)
      const pecasAtuaisIds = pecas.map(p => p.id);
      const pecasBloqueadasRemovidas = pecasBloqueadasInfo.filter(info =>
        !pecasAtuaisIds.includes(info.cotacao_peca_id)
      );

      if (pecasBloqueadasRemovidas.length > 0) {
        const detalhes = pecasBloqueadasRemovidas.map(info => {
          const getStatusLabel = (status: string, motivo: 'requisicao' | 'estoque') => {
            if (motivo === 'requisicao') {
              return status === 'pendente' ? 'Requisição Pendente (Aguardando Estoque)' :
                     status === 'pedido_feito' ? 'Pedido Ativo' :
                     status === 'atendida' ? 'Peça Atendida (Com Técnico)' :
                     status === 'em_uso' ? 'Em Uso pelo Técnico' :
                     status === 'gi_postada' ? 'GI Postada (Aguardando Devolução)' :
                     status === 'devolucao_pendente' ? 'Devolução Pendente' :
                     status === 'devolvida' ? 'Devolvida ao Estoque' : 'Bloqueada';
            } else {
              return status === 'vinculada_tecnico' ? 'Com Técnico' :
                     status === 'em_rota' ? 'Em Rota' :
                     status === 'em_uso' ? 'Em Uso' :
                     status === 'usada' ? 'Usada' :
                     status === 'devolucao_pendente' ? 'Devolução Pendente' :
                     status === 'devolvida_nova' ? 'Devolvida Nova' :
                     status === 'devolvida_defeito' ? 'Devolvida com Defeito' :
                     status === 'usada_upc' ? 'Usada UPC' :
                     status === 'arquivada' ? 'Arquivada' : 'Bloqueada';
            }
          };
          const statusLabel = getStatusLabel(info.status, info.motivo);
          const motivoLabel = info.motivo === 'requisicao' ? 'Requisição' : 'Estoque';
          return `• ${info.pn} - ${statusLabel} (${motivoLabel})${info.numero_pedido ? ` - Pedido #${info.numero_pedido}` : ''}`;
        }).join('\n');

        alert(
          `❌ NÃO É POSSÍVEL SALVAR!\n\n` +
          `As seguintes peças estão bloqueadas e não podem ser removidas:\n\n${detalhes}\n\n` +
          `Para desbloquear:\n` +
          `• Pedido Ativo: Cancele o pedido em Estoque\n` +
          `• Peça Atendida: Técnico deve postar GI ou devolver\n` +
          `• Em Uso: Técnico deve postar GI ou devolver\n` +
          `• GI Postada: Estoque deve aprovar devolução\n` +
          `• Devolução Pendente: Estoque deve aprovar ou reprovar\n` +
          `• Status de Estoque: Aguarde finalização do processo atual`
        );
        return;
      }

      // Verificar se peças bloqueadas foram modificadas (comparar com original pelo ID)
      const pecasBloqueadasModificadas = pecas.filter(p => {
        // Verifica se esta peça específica está bloqueada usando o ID
        const estaBloqueada = pecasBloqueadasInfo.some(info => info.cotacao_peca_id === p.id);
        if (!estaBloqueada) return false;

        // Encontrar peça original pelo ID
        const pecaOriginal = pecasOriginais.find(po => po.id === p.id);
        if (!pecaOriginal) return false; // Peça nova não deve estar bloqueada

        // Verificar se houve alteração em campos importantes
        return (
          p.quantidade !== pecaOriginal.quantidade ||
          p.valor_unitario !== pecaOriginal.valor_unitario ||
          p.origem !== pecaOriginal.origem
        );
      });

      if (pecasBloqueadasModificadas.length > 0) {
        const detalhes = pecasBloqueadasModificadas.map(p => {
          const info = pecasBloqueadasInfo.find(pi => pi.cotacao_peca_id === p.id);
          const getStatusLabel = (status: string, motivo: 'requisicao' | 'estoque') => {
            if (motivo === 'requisicao') {
              return status === 'pendente' ? 'Requisição Pendente (Aguardando Estoque)' :
                     status === 'pedido_feito' ? 'Pedido Ativo' :
                     status === 'atendida' ? 'Peça Atendida (Com Técnico)' :
                     status === 'em_uso' ? 'Em Uso pelo Técnico' :
                     status === 'gi_postada' ? 'GI Postada (Aguardando Devolução)' :
                     status === 'devolucao_pendente' ? 'Devolução Pendente' :
                     status === 'devolvida' ? 'Devolvida ao Estoque' : 'Bloqueada';
            } else {
              return status === 'vinculada_tecnico' ? 'Com Técnico' :
                     status === 'em_rota' ? 'Em Rota' :
                     status === 'em_uso' ? 'Em Uso' :
                     status === 'usada' ? 'Usada' :
                     status === 'devolucao_pendente' ? 'Devolução Pendente' :
                     status === 'devolvida_nova' ? 'Devolvida Nova' :
                     status === 'devolvida_defeito' ? 'Devolvida com Defeito' :
                     status === 'usada_upc' ? 'Usada UPC' :
                     status === 'arquivada' ? 'Arquivada' : 'Bloqueada';
            }
          };
          const statusLabel = info ? getStatusLabel(info.status, info.motivo) : 'Bloqueada';
          const motivoLabel = info?.motivo === 'requisicao' ? 'Requisição' : 'Estoque';
          return `• ${p.pn} - ${statusLabel} (${motivoLabel})${info?.numero_pedido ? ` - Pedido #${info.numero_pedido}` : ''}`;
        }).join('\n');

        alert(
          `❌ NÃO É POSSÍVEL SALVAR!\n\n` +
          `As seguintes peças estão bloqueadas e não podem ser modificadas:\n\n${detalhes}\n\n` +
          `Para desbloquear:\n` +
          `• Pedido Ativo: Cancele o pedido em Estoque\n` +
          `• Peça Atendida: Técnico deve postar GI ou devolver\n` +
          `• Em Uso: Técnico deve postar GI ou devolver\n` +
          `• GI Postada: Estoque deve aprovar devolução\n` +
          `• Devolução Pendente: Estoque deve aprovar ou reprovar\n` +
          `• Status de Estoque: Aguarde finalização do processo atual`
        );
        return;
      }
    }

    setLoading(true);
    try {
      const cpfLimpo = clienteCPF.replace(/\D/g, '');

      if (cpfLimpo) {
        const { data: clienteExistente } = await supabase
          .from('clientes')
          .select('id')
          .eq('cpf_cnpj', cpfLimpo)
          .maybeSingle();

        if (!clienteExistente) {
          await supabase.from('clientes').insert({
            cpf_cnpj: cpfLimpo,
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
        } else {
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
              estado: clienteEstado || null
            })
            .eq('id', clienteExistente.id);
        }
      }

      const enderecoCompleto = [
        clienteLogradouro,
        clienteNumero,
        clienteComplemento,
        clienteBairro,
        clienteCidade,
        clienteEstado
      ].filter(Boolean).join(', ');

      let cotacao;

      if (cotacaoId) {
        // UPDATE: Editando cotação existente
        const { data, error: cotacaoError } = await supabase
          .from('cotacoes')
          .update({
            numero_os_samsung: numeroOSSamsung || null,
            tipo_atendimento: tipoAtendimento,
            tipo_os: tipoOS,
            tipo_orcamento: tipoOS === 'OW' ? 'normal' : null,
            unidade_id: unidadeId || null,
            cliente_nome: clienteNome,
            cliente_cpf_cnpj: clienteCPF || null,
            cliente_telefone: clienteTelefone || null,
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
            aparelho_numero_serie: aparelhoSerial || aparelhoIMEI || null,
            aparelho_imei: aparelhoIMEI || null,
            defeito_relatado: defeitoRelatado || null,
            observacoes_internas: observacoesInternas || null,
            desconto_tipo: descontoTipo,
            desconto_valor: parseFloat(descontoValor) || 0
          })
          .eq('id', cotacaoId)
          .select()
          .single();

        if (cotacaoError) throw cotacaoError;
        cotacao = data;

        // UPDATE/DELETE/INSERT seletivo de peças para manter IDs e não quebrar requisições
        const pecasOriginaisIds = new Set(pecasOriginais.map(p => p.id));
        const pecasAtuaisIds = new Set(pecas.map(p => p.id));

        // 1. UPDATE peças existentes que foram modificadas
        for (const peca of pecas) {
          if (pecasOriginaisIds.has(peca.id)) {
            // Peça já existe no banco, fazer UPDATE
            const valorComMarkup = calcularValorComMarkup(peca.valor_gspn);
            await supabase
              .from('cotacoes_pecas')
              .update({
                pn: peca.pn,
                descricao: peca.descricao,
                quantidade: peca.quantidade,
                valor_base_gspn: peca.valor_gspn,
                markup_aplicado: valorComMarkup - peca.valor_gspn,
                valor_final_unitario: valorComMarkup,
                valor_total: valorComMarkup * peca.quantidade,
                observacao: peca.observacao || null,
                is_gspn: peca.is_gspn || false
              })
              .eq('id', peca.id);
          }
        }

        // 2. DELETE peças removidas (apenas as que NÃO estão bloqueadas - validação já foi feita antes)
        const pecasParaRemover = Array.from(pecasOriginaisIds).filter(id => !pecasAtuaisIds.has(id));
        if (pecasParaRemover.length > 0) {
          await supabase
            .from('cotacoes_pecas')
            .delete()
            .in('id', pecasParaRemover);
        }

        // Remove serviços antigos (serviços não têm requisições vinculadas, pode deletar tudo)
        await supabase.from('cotacoes_servicos').delete().eq('cotacao_id', cotacaoId);
      } else {
        // INSERT: Nova cotação
        const { data, error: cotacaoError } = await supabase
          .from('cotacoes')
          .insert({
            numero_os_samsung: numeroOSSamsung || null,
            tipo_atendimento: tipoAtendimento,
            tipo_os: tipoOS,
            tipo_orcamento: tipoOS === 'OW' ? 'normal' : null,
            unidade_id: unidadeId || null,
            cliente_nome: clienteNome,
            cliente_cpf_cnpj: clienteCPF || null,
            cliente_telefone: clienteTelefone || null,
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
            aparelho_numero_serie: aparelhoSerial || aparelhoIMEI || null,
            aparelho_imei: aparelhoIMEI || null,
            defeito_relatado: defeitoRelatado || null,
            observacoes_internas: observacoesInternas || null,
            desconto_tipo: descontoTipo,
            desconto_valor: parseFloat(descontoValor) || 0,
            status: 'pendente_preenchimento',
            criado_por: usuario?.id
          })
          .select()
          .single();

        if (cotacaoError) throw cotacaoError;
        cotacao = data;
      }

      // 3. INSERT apenas peças novas (que não estavam em pecasOriginais)
      if (pecas.length > 0) {
        const pecasOriginaisIds = new Set(pecasOriginais.map(p => p.id));
        const pecasNovas = cotacaoId
          ? pecas.filter(p => !pecasOriginaisIds.has(p.id)) // Se editando, só insere novas
          : pecas; // Se nova cotação, insere todas

        if (pecasNovas.length > 0) {
          const pecasData = pecasNovas.map(p => {
            const valorComMarkup = calcularValorComMarkup(p.valor_gspn);
            return {
              cotacao_id: cotacao.id,
              pn: p.pn,
              descricao: p.descricao,
              quantidade: p.quantidade,
              valor_base_gspn: p.valor_gspn,
              markup_aplicado: valorComMarkup - p.valor_gspn,
              valor_final_unitario: valorComMarkup,
              valor_total: valorComMarkup * p.quantidade,
              observacao: p.observacao || null,
              is_gspn: p.is_gspn || false
            };
          });

          const { error: pecasError } = await supabase
            .from('cotacoes_pecas')
            .insert(pecasData);

          if (pecasError) throw pecasError;
        }
      }

      if (servicosItems.length > 0) {
        const servicosData = servicosItems.map(s => ({
          cotacao_id: cotacao.id,
          servico_id: s.servico_id || null,
          descricao: s.servico_nome,
          quantidade: s.quantidade,
          valor_unitario: s.valor_unitario,
          valor_total: s.valor_unitario * s.quantidade,
          observacao: s.observacao || null
        }));

        const { error: servicosError } = await supabase
          .from('cotacoes_servicos')
          .insert(servicosData);

        if (servicosError) throw servicosError;
      }

      // Salvar comentários do estado local (para novas cotações)
      if (!cotacaoId && comentarios.length > 0) {
        const comentariosData = comentarios.map(c => ({
          cotacao_id: cotacao.id,
          usuario_id: usuario?.id,
          texto: c.texto,
          is_system: false
        }));

        const { error: comentariosError } = await supabase
          .from('cotacao_comentarios')
          .insert(comentariosData);

        if (comentariosError) {
        }
      }

      // Upload e salvamento de anexos do estado local (para novas cotações)
      if (!cotacaoId && anexos.length > 0) {
        let anexosSalvosCount = 0;
        const anexosFalhados: string[] = [];

        for (const file of anexos) {
          try {
            const fileExt = file.name.split('.').pop();
            const fileName = `${cotacao.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
              .from('cotacoes-anexos')
              .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { error: dbError } = await supabase
              .from('os_anexos')
              .insert({
                cotacao_id: cotacao.id,
                tipo: getTipoAnexo(file.type),
                nome_arquivo: file.name,
                url: fileName,
                tamanho_bytes: file.size,
                usuario_id: usuario?.id
              });

            if (dbError) throw dbError;

            anexosSalvosCount++;
          } catch (error) {
            anexosFalhados.push(file.name);
          }
        }

        if (anexosFalhados.length > 0) {
          alert(`Cotação salva! Porém ${anexosFalhados.length} de ${anexos.length} anexo(s) falharam:\n${anexosFalhados.join(', ')}`);
        }
      }

      // Salvar pagamentos temporários (somente os que não foram salvos ainda)
      const pagamentosParaSalvar = pagamentosTemporarios.filter(p => !p.id);
      if (pagamentosParaSalvar.length > 0) {
        let pagamentosSalvosCount = 0;
        const pagamentosFalhados: string[] = [];

        for (const pagamento of pagamentosParaSalvar) {
          try {
            const file = pagamento.comprovante_file;
            if (!file) continue;

            const fileExt = file.name.split('.').pop();
            const fileName = `cotacao_${cotacao.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

            const { error: uploadError } = await supabase.storage
              .from('pagamentos-comprovantes')
              .upload(fileName, file);

            if (uploadError) throw uploadError;

            const { data: urlData } = supabase.storage
              .from('pagamentos-comprovantes')
              .getPublicUrl(fileName);

            const { error: pagamentoError } = await supabase
              .from('pagamentos')
              .insert({
                cotacao_id: cotacao.id,
                unidade_id: unidadeId,
                os_id: null,
                forma_pagamento: pagamento.forma_pagamento,
                valor: pagamento.valor,
                valor_bruto: pagamento.valor_bruto,
                valor_liquido: pagamento.valor_liquido,
                parcelamento: pagamento.parcelamento || 1,
                taxa_percentual: pagamento.taxa_percentual || 0,
                taxa_valor: pagamento.taxa_valor || 0,
                taxa_paga_por: pagamento.taxa_paga_por || 'empresa',
                nsu: pagamento.nsu || null,
                sku_maquininha: pagamento.sku_maquininha || null,
                comprovante_url: urlData.publicUrl,
                observacoes: pagamento.observacoes || null,
                lancado_por: usuario?.id,
                responsavel_fechamento: usuario?.id,
                data_lancamento: new Date().toISOString()
              });

            if (pagamentoError) throw pagamentoError;

            pagamentosSalvosCount++;
          } catch (error) {
            pagamentosFalhados.push(`Pagamento ${pagamento.forma_pagamento}`);
          }
        }

        if (pagamentosFalhados.length > 0) {
          alert(`Cotação salva! Porém ${pagamentosFalhados.length} de ${pagamentosParaSalvar.length} pagamento(s) falharam:\n${pagamentosFalhados.join(', ')}`);
        }
      }

      onSave();
      handleClose();
    } catch (error) {
      alert('Erro ao salvar cotação');
    } finally {
      setLoading(false);
    }
  };

  const handleEnviarDiagnostico = async () => {
    if (!clienteNome.trim()) {
      alert('Nome do cliente e obrigatorio');
      return;
    }

    if (!unidadeId) {
      alert('Selecione uma unidade');
      return;
    }

    const confirmacao = confirm(
      'ENVIAR PARA DIAGNOSTICO\n\n' +
      'Ao confirmar, todos os dados serao salvos e uma OS sera criada no Kanban na coluna DIAGNOSTICO.\n\n' +
      'O tecnico ira analisar o aparelho e adicionar as pecas necessarias.\n\n' +
      'Deseja continuar?'
    );

    if (!confirmacao) return;

    setLoading(true);
    try {
      let cotacaoIdFinal = cotacaoId;

      const enderecoCompleto = [
        clienteLogradouro,
        clienteNumero,
        clienteComplemento,
        clienteBairro,
        clienteCidade,
        clienteEstado
      ].filter(Boolean).join(', ');

      const cotacaoData = {
        numero_os_samsung: numeroOSSamsung || null,
        tipo_atendimento: tipoAtendimento,
        tipo_os: tipoOS,
        tipo_orcamento: tipoOS === 'OW' ? 'normal' : null,
        unidade_id: unidadeId || null,
        cliente_nome: clienteNome,
        cliente_cpf_cnpj: clienteCPF || null,
        cliente_telefone: clienteTelefone || null,
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
        aparelho_numero_serie: aparelhoSerial || aparelhoIMEI || null,
        aparelho_imei: aparelhoIMEI || null,
        defeito_relatado: defeitoRelatado || null,
        observacoes_internas: observacoesInternas || null,
        desconto_tipo: descontoTipo,
        desconto_valor: parseFloat(descontoValor) || 0,
        status: 'pendente_preenchimento',
        enviada_diagnostico: true,
        enviada_diagnostico_em: new Date().toISOString()
      };

      if (!cotacaoIdFinal) {
        const { data: novaCotacao, error: cotacaoError } = await supabase
          .from('cotacoes')
          .insert({ ...cotacaoData, criado_por: usuario?.id })
          .select()
          .single();

        if (cotacaoError) throw cotacaoError;
        cotacaoIdFinal = novaCotacao.id;
      } else {
        const { error: updateError } = await supabase
          .from('cotacoes')
          .update(cotacaoData)
          .eq('id', cotacaoIdFinal);

        if (updateError) throw updateError;
      }

      await supabase.from('cotacoes_pecas').delete().eq('cotacao_id', cotacaoIdFinal);
      if (pecas.length > 0) {
        const pecasToInsert = pecas.map(p => ({
          cotacao_id: cotacaoIdFinal,
          pn: p.pn,
          codigo_peca: p.pn,
          descricao: p.descricao,
          quantidade: p.quantidade,
          valor_unitario: p.valor_unitario,
          valor_final_unitario: p.valor_final_unitario,
          markup_aplicado: p.markup_aplicado,
          valor_total: p.valor_final_unitario * p.quantidade
        }));
        await supabase.from('cotacoes_pecas').insert(pecasToInsert);
      }

      await supabase.from('cotacoes_servicos').delete().eq('cotacao_id', cotacaoIdFinal);
      if (servicosItems.length > 0) {
        const servicosToInsert = servicosItems.map(s => ({
          cotacao_id: cotacaoIdFinal,
          codigo_servico: s.codigo_servico,
          descricao: s.descricao,
          quantidade: s.quantidade,
          valor_unitario: s.valor_unitario,
          valor_total: s.valor_unitario * s.quantidade,
          observacao: s.observacao
        }));
        await supabase.from('cotacoes_servicos').insert(servicosToInsert);
      }

      if (novoComentario.trim()) {
        await supabase.from('cotacao_comentarios').insert({
          cotacao_id: cotacaoIdFinal,
          usuario_id: usuario?.id,
          texto: novoComentario.trim()
        });
      }

      for (const anexo of anexos) {
        if (anexo.file && !anexo.url) {
          const fileExt = anexo.file.name.split('.').pop();
          const fileName = `${cotacaoIdFinal}/${Date.now()}.${fileExt}`;
          const { error: uploadError } = await supabase.storage
            .from('cotacoes-anexos')
            .upload(fileName, anexo.file);

          if (!uploadError) {
            const { data: urlData } = supabase.storage
              .from('cotacoes-anexos')
              .getPublicUrl(fileName);

            await supabase.from('os_anexos').insert({
              cotacao_id: cotacaoIdFinal,
              tipo: anexo.tipo,
              nome_arquivo: anexo.nome_arquivo,
              url: urlData.publicUrl,
              tamanho_bytes: anexo.file.size,
              usuario_id: usuario?.id
            });
          }
        }
      }

      const { data: cotacao } = await supabase
        .from('cotacoes')
        .select('*')
        .eq('id', cotacaoIdFinal)
        .single();

      if (!cotacao) throw new Error('Cotacao nao encontrada');

      const valorPecas = pecas.reduce((sum, p) => sum + (p.valor_final_unitario * p.quantidade), 0);
      const valorServicos = servicosItems.reduce((sum, s) => sum + (s.valor_unitario * s.quantidade), 0);
      let valorTotal = valorPecas + valorServicos;

      if (parseFloat(descontoValor) > 0) {
        if (descontoTipo === 'percentual') {
          valorTotal = valorTotal * (1 - parseFloat(descontoValor) / 100);
        } else {
          valorTotal = valorTotal - parseFloat(descontoValor);
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

      await supabase.from('cotacoes_pecas').update({ os_id: os.id }).eq('cotacao_id', cotacaoIdFinal);
      await supabase.from('cotacoes_servicos').update({ os_id: os.id }).eq('cotacao_id', cotacaoIdFinal);
      await supabase.from('os_anexos').update({ os_id: os.id }).eq('cotacao_id', cotacaoIdFinal).is('os_id', null);

      await supabase.from('cotacao_comentarios').insert({
        cotacao_id: cotacaoIdFinal,
        usuario_id: usuario?.id,
        texto: `Cotacao enviada para DIAGNOSTICO no Kanban por ${usuario?.nome || 'Sistema'}`,
        is_system: true
      });

      await supabase.from('os_comentarios').insert({
        os_id: os.id,
        usuario_id: usuario?.id,
        comentario: `OS criada para DIAGNOSTICO. Tecnico deve analisar e adicionar pecas necessarias.`
      });

      const osInfo = os.numero_os_interna
        ? `OS Interna ${os.numero_os_interna} criada`
        : 'OS criada';
      const samsungInfo = os.numero_os_samsung
        ? ` (OS Samsung: ${os.numero_os_samsung})`
        : '';

      alert(
        'ENVIADO PARA DIAGNOSTICO!\n\n' +
        `${osInfo}${samsungInfo}\n\n` +
        'O técnico irá analisar o aparelho e adicionar as peças necessárias.'
      );

      onSave();
      handleClose();
    } catch (error: any) {
      alert(`Erro ao enviar para diagnostico: ${error.message || 'Erro desconhecido'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setTipoAtendimento('CI');
    setTipoOS('OW');
    setNumeroOSSamsung('');
    setUnidadeId('');
    setClienteNome('');
    setClienteCPF('');
    setClienteTelefone('');
    setClienteEmail('');
    setClienteCEP('');
    setClienteLogradouro('');
    setClienteNumero('');
    setClienteComplemento('');
    setClienteBairro('');
    setClienteCidade('');
    setClienteEstado('');
    setAparelhoLinha('');
    setAparelhoModelo('');
    setAparelhoSerial('');
    setAparelhoIMEI('');
    setDefeitoRelatado('');
    setObservacoesInternas('');
    setPecas([]);
    setServicosItems([]);
    setDescontoTipo('percentual');
    setDescontoValor('0');
    setAnexos([]);
    setComentarios([]);
    setNovoComentario('');
    setPagamentosTemporarios([]);
    setActiveTab('dados');
    onClose();
  };

  const getFormaPagamentoLabel = (forma: string) => {
    const labels: Record<string, string> = {
      pix: 'PIX',
      cartao_credito: 'Cartão de Crédito',
      cartao_debito: 'Cartão de Débito',
      dinheiro: 'Dinheiro',
      transferencia: 'Transferência',
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

  const handleDeletePayment = async (pagamento: any, index: number) => {
    const confirmacao = confirm('⚠️ Tem certeza que deseja excluir este pagamento?');
    if (!confirmacao) return;

    try {
      // Se o pagamento tem ID (foi salvo no banco), deletar do banco
      if (pagamento.id) {
        const { error } = await supabase
          .from('pagamentos')
          .delete()
          .eq('id', pagamento.id);

        if (error) throw error;
      }

      // Remover do estado local
      setPagamentosTemporarios(prev => prev.filter((_, i) => i !== index));
      alert('✅ Pagamento excluído com sucesso!');
    } catch (error: any) {
      alert(`❌ Erro ao excluir pagamento: ${error.message || 'Erro desconhecido'}`);
    }
  };

  const handleEditPaymentSuccess = async () => {
    // Recarregar pagamentos após edição
    if (cotacaoId) {
      const { data: pagamentosData, error: pagamentosError } = await supabase
        .from('pagamentos')
        .select('*')
        .eq('cotacao_id', cotacaoId)
        .is('os_id', null)
        .order('created_at', { ascending: false });

      if (!pagamentosError) {
        setPagamentosTemporarios(pagamentosData || []);
      }
    }
  };

  const handleAddPaymentTemporario = async (paymentData: any) => {
    if (isAddingPayment.current) {
      return;
    }

    if (!unidadeId) {
      alert('❌ Selecione uma unidade antes de adicionar pagamentos!');
      return;
    }

    isAddingPayment.current = true;

    try {
      const file = paymentData.comprovante_file;
      if (!file) {
        alert('Comprovante é obrigatório');
        isAddingPayment.current = false;
        return;
      }

      // Se a cotação já existe, salvar direto no banco
      if (cotacaoId) {
        const fileExt = file.name.split('.').pop();
        const fileName = `cotacao_${cotacaoId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from('pagamentos-comprovantes')
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage
          .from('pagamentos-comprovantes')
          .getPublicUrl(fileName);

        const { error: pagamentoError } = await supabase
          .from('pagamentos')
          .insert({
            cotacao_id: cotacaoId,
            unidade_id: unidadeId,
            os_id: null,
            forma_pagamento: paymentData.forma_pagamento,
            valor: paymentData.valor,
            valor_bruto: paymentData.valor_bruto,
            valor_liquido: paymentData.valor_liquido,
            parcelamento: paymentData.parcelamento || 1,
            taxa_percentual: paymentData.taxa_percentual || 0,
            taxa_valor: paymentData.taxa_valor || 0,
            taxa_paga_por: paymentData.taxa_paga_por || 'empresa',
            nsu: paymentData.nsu || null,
            sku_maquininha: paymentData.sku_maquininha || null,
            comprovante_url: urlData.publicUrl,
            observacoes: paymentData.observacoes || null,
            lancado_por: usuario?.id,
            responsavel_fechamento: usuario?.id,
            data_lancamento: new Date().toISOString()
          });

        if (pagamentoError) throw pagamentoError;

        const { data: pagamentosAtualizados } = await supabase
          .from('pagamentos')
          .select('*')
          .eq('cotacao_id', cotacaoId)
          .is('os_id', null)
          .order('created_at', { ascending: false });

        setPagamentosTemporarios(pagamentosAtualizados || []);
        setShowAddPaymentModal(false);

        alert('✅ Pagamento salvo com sucesso!');
      } else {
        // Se é uma nova cotação, armazenar temporariamente com o arquivo
        const pagamentoTemporario = {
          ...paymentData,
          comprovante_file: file,
          temp_id: Date.now()
        };

        setPagamentosTemporarios(prev => [...prev, pagamentoTemporario]);
        setShowAddPaymentModal(false);

        alert('✅ Pagamento adicionado! Será salvo quando você salvar a cotação.');
      }
    } catch (error: any) {
      alert(`❌ Erro ao processar pagamento: ${error.message || 'Erro desconhecido'}`);
    } finally {
      isAddingPayment.current = false;
    }
  };

  if (!isOpen) return null;

  const tabs = [
    { id: 'dados' as const, label: 'Dados OS/Cliente', icon: User },
    { id: 'pecas' as const, label: 'Peças', icon: Wrench },
    { id: 'servicos' as const, label: 'Serviços', icon: Building },
    { id: 'anexos' as const, label: 'Anexos', icon: Paperclip },
    { id: 'pagamento' as const, label: 'Pagamento', icon: DollarSign },
    { id: 'comentarios' as const, label: 'Comentários', icon: MessageSquare }
  ];

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="premium-card w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-[#00D4FF]/20">
          <div className="flex items-center gap-3">
            <h2 className="tech-heading text-xl text-[#00D4FF]">NOVA COTAÇÃO</h2>
            {tipoOS === 'OW' && tipoOrcamento === 'samsung_contigo' && (
              <span
                className="px-3 py-1 rounded text-xs font-bold flex items-center gap-1"
                style={{
                  backgroundColor: '#FFA50030',
                  color: '#FFA500',
                  border: '1px solid #FFA50060'
                }}
              >
                🏷️ SAMSUNG CONTIGO
              </span>
            )}
          </div>
          <button
            onClick={handleClose}
            className="p-2 hover:bg-[#00D4FF]/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-[#00D4FF]" />
          </button>
        </div>

        <div className="border-b border-[#00D4FF]/20">
          <nav className="flex">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 flex items-center justify-center gap-1.5 px-2 py-3 border-b-2 font-bold text-xs uppercase tracking-wide transition-all whitespace-nowrap ${
                    isActive
                      ? 'text-[#00D4FF] border-[#00D4FF] bg-[#00D4FF]/10'
                      : 'text-gray-500 hover:text-[#00D4FF] border-transparent hover:bg-[#00D4FF]/5'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span className="text-[10px]">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>

        <div className="flex-1 overflow-y-auto cyber-scrollbar p-6">
          {activeTab === 'dados' && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Tipo Atendimento *</label>
                  <select
                    value={tipoAtendimento}
                    onChange={(e) => setTipoAtendimento(e.target.value as 'IH' | 'CI')}
                    className="neon-input"
                  >
                    <option value="CI">CI - Carry In (Balcão)</option>
                    <option value="IH">IH - In Home (Domicílio)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Tipo OS *</label>
                  <input
                    type="text"
                    value={tipoOS}
                    readOnly
                    className="neon-input bg-gray-900/50"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Número OS Samsung</label>
                  <input
                    type="text"
                    value={numeroOSSamsung}
                    onChange={(e) => setNumeroOSSamsung(e.target.value)}
                    placeholder="Ex: OS123456"
                    className="neon-input"
                  />
                </div>

                <div>
                  <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Unidade *</label>
                  <select
                    value={unidadeId}
                    onChange={(e) => setUnidadeId(e.target.value)}
                    className="neon-input"
                  >
                    <option value="">Selecione uma unidade</option>
                    {unidades.map((unidade) => (
                      <option key={unidade.id} value={unidade.id}>
                        {unidade.nome}
                      </option>
                    ))}
                  </select>
                </div>

              </div>

              <div className="border-t border-[#00D4FF]/20 pt-6">
                <h3 className="text-sm font-bold text-[#00D4FF] mb-4 uppercase tracking-wider">Dados do Cliente</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">CPF/CNPJ</label>
                    <input
                      type="text"
                      value={clienteCPF}
                      onChange={(e) => setClienteCPF(e.target.value)}
                      onBlur={(e) => buscarClientePorCPF(e.target.value)}
                      placeholder="000.000.000-00"
                      className="neon-input"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Nome *</label>
                    <input
                      type="text"
                      value={clienteNome}
                      onChange={(e) => setClienteNome(e.target.value)}
                      placeholder="Nome completo do cliente"
                      className="neon-input"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Telefone</label>
                    <input
                      type="text"
                      value={clienteTelefone}
                      onChange={(e) => setClienteTelefone(e.target.value)}
                      placeholder="(00) 00000-0000"
                      className="neon-input"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">E-mail</label>
                    <input
                      type="email"
                      value={clienteEmail}
                      onChange={(e) => setClienteEmail(e.target.value)}
                      placeholder="email@exemplo.com"
                      className="neon-input"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">CEP</label>
                    <input
                      type="text"
                      value={clienteCEP}
                      onChange={(e) => setClienteCEP(e.target.value)}
                      onBlur={(e) => buscarCEP(e.target.value)}
                      placeholder="00000-000"
                      className="neon-input"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Logradouro</label>
                    <input
                      type="text"
                      value={clienteLogradouro}
                      onChange={(e) => setClienteLogradouro(e.target.value)}
                      placeholder="Rua, Avenida..."
                      className="neon-input"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Número</label>
                    <input
                      type="text"
                      value={clienteNumero}
                      onChange={(e) => setClienteNumero(e.target.value)}
                      placeholder="Nº"
                      className="neon-input"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Complemento</label>
                    <input
                      type="text"
                      value={clienteComplemento}
                      onChange={(e) => setClienteComplemento(e.target.value)}
                      placeholder="Apto, Bloco..."
                      className="neon-input"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Bairro</label>
                    <input
                      type="text"
                      value={clienteBairro}
                      onChange={(e) => setClienteBairro(e.target.value)}
                      placeholder="Bairro"
                      className="neon-input"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Cidade</label>
                    <input
                      type="text"
                      value={clienteCidade}
                      onChange={(e) => setClienteCidade(e.target.value)}
                      placeholder="Cidade"
                      className="neon-input"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Estado</label>
                    <input
                      type="text"
                      value={clienteEstado}
                      onChange={(e) => setClienteEstado(e.target.value.toUpperCase())}
                      placeholder="UF"
                      maxLength={2}
                      className="neon-input uppercase"
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-[#00D4FF]/20 pt-6">
                <h3 className="text-sm font-bold text-[#00D4FF] mb-4 uppercase tracking-wider">Dados do Aparelho</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Linha</label>
                    <input
                      type="text"
                      value={aparelhoLinha}
                      onChange={(e) => setAparelhoLinha(e.target.value)}
                      placeholder="Ex: TV, Celular, Lava e Seca"
                      className="neon-input"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Modelo</label>
                    <input
                      type="text"
                      value={aparelhoModelo}
                      onChange={(e) => setAparelhoModelo(e.target.value)}
                      placeholder="Modelo do aparelho"
                      className="neon-input"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Número de Série</label>
                    <input
                      type="text"
                      value={aparelhoSerial}
                      onChange={(e) => setAparelhoSerial(e.target.value)}
                      placeholder="Serial number"
                      className="neon-input"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">IMEI</label>
                    <input
                      type="text"
                      value={aparelhoIMEI}
                      onChange={(e) => setAparelhoIMEI(e.target.value)}
                      placeholder="IMEI (para celulares)"
                      className="neon-input"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Defeito Relatado</label>
                    <textarea
                      value={defeitoRelatado}
                      onChange={(e) => setDefeitoRelatado(e.target.value)}
                      placeholder="Descreva o defeito relatado pelo cliente"
                      rows={3}
                      className="neon-input"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Observações Internas</label>
                    <textarea
                      value={observacoesInternas}
                      onChange={(e) => setObservacoesInternas(e.target.value)}
                      placeholder="Observações internas (não visíveis para o cliente)"
                      rows={3}
                      className="neon-input"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'pecas' && (
            <div className="space-y-4">
              {pecasBloqueadasInfo.length > 0 && (
                <div className="bg-[#FF6B00]/10 border border-[#FF6B00]/30 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-[#FF6B00] flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-[#FF6B00] text-sm font-bold mb-2">
                        ⚠️ ATENÇÃO: Peças em Processo Ativo Bloqueadas
                      </p>
                      <p className="text-gray-300 text-xs mb-3">
                        As peças abaixo estão em processos ativos e não podem ser modificadas ou removidas:
                      </p>
                      <div className="space-y-2">
                        {pecasBloqueadasInfo.map((info, idx) => {
                          const statusConfig: Record<string, { label: string; color: string; icon: string }> = {
                            // Status de requisição
                            pedido_feito: { label: 'PEDIDO ATIVO', color: '#FF0064', icon: '🚚' },
                            atendida: { label: 'PEÇA ATENDIDA', color: '#00D4FF', icon: '✅' },
                            em_uso: { label: 'EM USO TÉCNICO', color: '#FFBF00', icon: '🔧' },
                            gi_postada: { label: 'GI PENDENTE', color: '#FF6B00', icon: '📦' },
                            devolvida: { label: 'DEVOLVIDA', color: '#00CED1', icon: '↩️' },
                            // Status de estoque
                            vinculada_tecnico: { label: 'COM TÉCNICO', color: '#4169E1', icon: '👤' },
                            em_rota: { label: 'EM ROTA', color: '#9370DB', icon: '🚗' },
                            usada: { label: 'USADA', color: '#808080', icon: '✔️' },
                            devolucao_pendente: { label: 'DEVOLUÇÃO PENDENTE', color: '#FFA500', icon: '⏳' },
                            devolvida_nova: { label: 'DEVOLVIDA NOVA', color: '#00CED1', icon: '🆕' },
                            devolvida_defeito: { label: 'DEVOLVIDA DEFEITO', color: '#DC143C', icon: '⚠️' },
                            usada_upc: { label: 'USADA UPC', color: '#696969', icon: '📋' },
                            arquivada: { label: 'ARQUIVADA', color: '#2F4F4F', icon: '📁' }
                          };
                          const config = statusConfig[info.status] || { label: 'BLOQUEADA', color: '#FF6B00', icon: '🔒' };

                          return (
                            <div key={idx} className="flex items-center gap-2 text-xs bg-black/30 rounded p-2">
                              <span>{config.icon}</span>
                              <Lock className="w-3 h-3" style={{ color: config.color }} />
                              <span className="font-mono font-bold" style={{ color: config.color }}>{info.pn}</span>
                              <span
                                className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                                style={{
                                  backgroundColor: `${config.color}20`,
                                  color: config.color,
                                  border: `1px solid ${config.color}40`
                                }}
                              >
                                {config.label}
                              </span>
                              {info.numero_pedido && (
                                <span className="text-gray-500 text-[10px]">Pedido #{info.numero_pedido}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <div className="mt-4 pt-4 border-t border-[#FF6B00]/20 space-y-2">
                        <p className="text-gray-300 text-xs font-semibold">💡 Peças com requisição PENDENTE podem ser editadas/excluídas</p>
                        <p className="text-gray-300 text-xs font-semibold mt-3">Para desbloquear os outros tipos:</p>
                        <div className="grid grid-cols-2 gap-2 text-[10px]">
                          <div className="flex items-start gap-1">
                            <span className="text-[#FF0064]">🚚</span>
                            <div>
                              <p className="text-[#FF0064] font-bold">PEDIDO ATIVO:</p>
                              <p className="text-gray-400">Cancele em Estoque → Transferências</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-1">
                            <span className="text-[#00D4FF]">✅</span>
                            <div>
                              <p className="text-[#00D4FF] font-bold">PEÇA ATENDIDA:</p>
                              <p className="text-gray-400">Técnico deve postar GI ou devolver</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-1">
                            <span className="text-[#FFBF00]">🔧</span>
                            <div>
                              <p className="text-[#FFBF00] font-bold">EM USO:</p>
                              <p className="text-gray-400">Técnico deve postar GI ou devolver</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-1">
                            <span className="text-[#FF6B00]">📦</span>
                            <div>
                              <p className="text-[#FF6B00] font-bold">GI PENDENTE:</p>
                              <p className="text-gray-400">Estoque deve aprovar/reprovar em Devoluções</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {!unidadeId && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
                  <p className="text-yellow-400 text-sm">
                    ⚠️ Selecione uma unidade na aba "Dados" para adicionar peças com markup correto
                  </p>
                </div>
              )}
              {unidadeId && markups.length > 0 && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
                  <p className="text-blue-400 text-sm font-bold mb-2">📊 Markups configurados para esta unidade:</p>
                  <div className="space-y-1">
                    {markups.map((m) => (
                      <p key={m.id} className="text-xs text-blue-300">
                        • {m.nome}: {m.tipo === 'percentual' ? `${m.valor}%` : m.tipo === 'multiplicador' ? `${m.valor}x` : `R$ ${m.valor}`}
                        {m.valor_minimo !== null && ` (Min: R$ ${m.valor_minimo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`}
                        {m.valor_maximo !== null && ` (Max: R$ ${m.valor_maximo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`}
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {unidadeId && markups.length === 0 && (
                <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4 mb-4">
                  <p className="text-orange-400 text-sm">
                    ⚠️ Nenhum markup cadastrado para esta unidade. O valor GSPN será usado sem alteração.
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-[#00D4FF] uppercase tracking-wider">Peças da Cotação</h3>
                <button
                  onClick={handleAddPeca}
                  disabled={!unidadeId}
                  className="neon-button text-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  title={!unidadeId ? 'Selecione uma unidade primeiro' : ''}
                >
                  <Plus className="w-4 h-4" />
                  ADICIONAR PEÇA
                </button>
              </div>

              {pecas.length === 0 ? (
                <div className="text-center py-12">
                  <Wrench className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">Nenhuma peça adicionada</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pecas.map((peca) => {
                    const isPecaBloqueada = pecasBloqueadasInfo.some(info => info.cotacao_peca_id === peca.id);
                    const pecaInfo = pecasBloqueadasInfo.find(p => p.cotacao_peca_id === peca.id);
                    const statusConfig: Record<string, { label: string; color: string; icon: string; bg: string }> = {
                      // Status de requisição
                      pedido_feito: { label: 'PEDIDO ATIVO', color: '#FF0064', icon: '🚚', bg: '#FF006405' },
                      atendida: { label: 'PEÇA ATENDIDA', color: '#00D4FF', icon: '✅', bg: '#00D4FF05' },
                      em_uso: { label: 'EM USO TÉCNICO', color: '#FFBF00', icon: '🔧', bg: '#FFBF0005' },
                      gi_postada: { label: 'GI PENDENTE', color: '#FF6B00', icon: '📦', bg: '#FF6B0005' },
                      devolvida: { label: 'DEVOLVIDA', color: '#00CED1', icon: '↩️', bg: '#00CED105' },
                      // Status de estoque
                      vinculada_tecnico: { label: 'COM TÉCNICO', color: '#4169E1', icon: '👤', bg: '#4169E105' },
                      em_rota: { label: 'EM ROTA', color: '#9370DB', icon: '🚗', bg: '#9370DB05' },
                      usada: { label: 'USADA', color: '#808080', icon: '✔️', bg: '#80808005' },
                      devolucao_pendente: { label: 'DEVOLUÇÃO PENDENTE', color: '#FFA500', icon: '⏳', bg: '#FFA50005' },
                      devolvida_nova: { label: 'DEVOLVIDA NOVA', color: '#00CED1', icon: '🆕', bg: '#00CED105' },
                      devolvida_defeito: { label: 'DEVOLVIDA DEFEITO', color: '#DC143C', icon: '⚠️', bg: '#DC143C05' },
                      usada_upc: { label: 'USADA UPC', color: '#696969', icon: '📋', bg: '#69696905' },
                      arquivada: { label: 'ARQUIVADA', color: '#2F4F4F', icon: '📁', bg: '#2F4F4F05' }
                    };
                    const config = pecaInfo ? statusConfig[pecaInfo.status] : null;

                    return (
                    <div key={peca.id} className={`premium-card p-4 ${isPecaBloqueada && config ? `border-2` : ''} ${peca.is_gspn ? 'border-l-4 border-blue-400' : ''}`} style={isPecaBloqueada && config ? { backgroundColor: config.bg, borderColor: `${config.color}40` } : {}}>
                      {peca.is_gspn && (
                        <div className="flex items-center gap-2 mb-3 pb-3 border-b border-blue-400/20">
                          <span className="text-base">📡</span>
                          <span
                            className="px-2 py-1 rounded text-xs font-bold uppercase flex-1"
                            style={{
                              backgroundColor: '#3B82F620',
                              color: '#60A5FA',
                              border: '1px solid #3B82F640'
                            }}
                          >
                            PEÇA API GSPN - Não pode ser removida (apenas editada)
                          </span>
                        </div>
                      )}
                      {isPecaBloqueada && config && (
                        <div className="flex items-center gap-2 mb-3 pb-3 border-b" style={{ borderColor: `${config.color}20` }}>
                          <span className="text-base">{config.icon}</span>
                          <Lock className="w-4 h-4" style={{ color: config.color }} />
                          <span
                            className="px-2 py-1 rounded text-xs font-bold uppercase flex-1"
                            style={{
                              backgroundColor: `${config.color}20`,
                              color: config.color,
                              border: `1px solid ${config.color}40`
                            }}
                          >
                            {config.label}
                          </span>
                          {pecaInfo?.numero_pedido && (
                            <span className="text-xs text-gray-500">Pedido #{pecaInfo.numero_pedido}</span>
                          )}
                        </div>
                      )}
                      <div className="grid grid-cols-6 gap-3">
                        <div className="relative">
                          <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
                            PN {isPecaBloqueada && <Lock className="w-3 h-3 inline ml-1 text-[#FF6B00]" />}
                          </label>
                          <input
                            type="text"
                            value={peca.pn}
                            onChange={(e) => handlePecaChange(peca.id, 'pn', e.target.value)}
                            onFocus={(e) => {
                              if (isPecaBloqueada) return;
                              const valor = e.target.value;
                              if (valor.length >= 2) {
                                buscarPNsSugestoes(valor);
                                setShowSugestoes(peca.id);
                              } else if (valor.length === 0) {
                                buscarPNsSugestoes('');
                                setShowSugestoes(peca.id);
                              }
                            }}
                            onBlur={() => {
                              setTimeout(() => setShowSugestoes(null), 300);
                            }}
                            placeholder="Part Number (digite ou clique)"
                            className="neon-input text-sm"
                            disabled={isPecaBloqueada}
                            title={isPecaBloqueada ? 'Esta peça está bloqueada e não pode ser modificada até resolução no Kanban ou Estoque' : ''}
                          />
                          {showSugestoes === peca.id && pnSugestoes.length > 0 && (
                            <div
                              className="absolute z-50 w-full mt-1 max-h-64 overflow-y-auto cyber-scrollbar bg-black border border-[#00D4FF]/40 rounded-lg shadow-xl"
                              onMouseDown={(e) => e.preventDefault()}
                            >
                              {pnSugestoes.map((sugestao, idx) => (
                                <button
                                  key={idx}
                                  type="button"
                                  onClick={() => selecionarPNSugestao(peca.id, sugestao)}
                                  className="w-full text-left px-3 py-2 hover:bg-[#00D4FF]/10 transition-colors border-b border-gray-800 last:border-b-0"
                                >
                                  <div className="font-mono text-xs font-bold text-[#00D4FF]">{sugestao.pn}</div>
                                  <div className="text-xs text-gray-400 line-clamp-1">{sugestao.descricao}</div>
                                  <div className="text-xs text-[#39FF14] mt-1">
                                    R$ {sugestao.valor_medio.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                  </div>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>

                        <div className="col-span-2">
                          <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Descrição</label>
                          <input
                            type="text"
                            value={peca.descricao}
                            onChange={(e) => handlePecaChange(peca.id, 'descricao', e.target.value)}
                            placeholder="Descrição da peça"
                            className="neon-input text-sm"
                            disabled={isPecaBloqueada}
                            title={isPecaBloqueada ? 'Esta peça está bloqueada e não pode ser modificada até resolução no Kanban ou Estoque' : ''}
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Qtd</label>
                          <input
                            type="number"
                            min="1"
                            value={peca.quantidade}
                            onChange={(e) => handlePecaChange(peca.id, 'quantidade', parseInt(e.target.value) || 1)}
                            className="neon-input text-sm"
                            disabled={isPecaBloqueada}
                            title={isPecaBloqueada ? 'Esta peça está bloqueada e não pode ser modificada até resolução no Kanban ou Estoque' : ''}
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Preço GSPN</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={peca.valor_gspn}
                            onChange={(e) => handlePecaChange(peca.id, 'valor_gspn', parseFloat(e.target.value) || 0)}
                            className="neon-input text-sm"
                            disabled={isPecaBloqueada}
                            title={isPecaBloqueada ? 'Esta peça está bloqueada e não pode ser modificada até resolução no Kanban ou Estoque' : ''}
                          />
                        </div>

                        <div className="flex items-end">
                          {!peca.is_gspn && (
                            <button
                              onClick={() => handleRemovePeca(peca.id)}
                              className="p-2 hover:bg-red-500/10 rounded-lg transition-colors w-full disabled:opacity-30 disabled:cursor-not-allowed"
                              disabled={isPecaBloqueada}
                              title={isPecaBloqueada ? 'Esta peça está bloqueada e não pode ser removida até resolução no Kanban ou Estoque' : ''}
                            >
                              <Trash2 className="w-4 h-4 text-red-400 mx-auto" />
                            </button>
                          )}
                          {peca.is_gspn && (
                            <div className="flex items-center justify-center w-full p-2">
                              <span className="text-xs font-bold text-blue-400 uppercase" title="Peça da API Samsung GSPN - Não pode ser removida">
                                API GSPN
                              </span>
                            </div>
                          )}
                        </div>

                        <div className="col-span-6 flex justify-between items-center">
                          <p className="text-xs text-gray-500">
                            Valor c/ Markup: <span className="text-[#FFBF00] font-bold">
                              R$ {calcularValorComMarkup(peca.valor_gspn).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </p>
                          <p className="text-xs text-gray-500">
                            Valor Total: <span className="text-[#39FF14] font-bold">
                              R$ {peca.valor_final.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'servicos' && (
            <div className="space-y-4">
              {!unidadeId && (
                <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
                  <p className="text-yellow-400 text-sm">
                    ⚠️ Selecione uma unidade na aba "Dados" para ver os serviços disponíveis
                  </p>
                </div>
              )}
              {unidadeId && servicos.length === 0 && (
                <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4 mb-4">
                  <p className="text-blue-400 text-sm">
                    ℹ️ Nenhum serviço cadastrado para esta unidade. Configure na aba Configurações.
                  </p>
                </div>
              )}
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-[#00D4FF] uppercase tracking-wider">Serviços</h3>
                <button
                  onClick={handleAddServico}
                  disabled={!unidadeId || servicos.length === 0}
                  className="neon-button text-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Plus className="w-4 h-4" />
                  ADICIONAR SERVIÇO
                </button>
              </div>

              {servicosItems.length === 0 ? (
                <div className="text-center py-12">
                  <Building className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">Nenhum serviço adicionado</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {servicosItems.map((servico) => (
                    <div key={servico.id} className="premium-card p-4">
                      <div className="grid grid-cols-5 gap-3">
                        <div className="col-span-2">
                          <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Serviço</label>
                          <select
                            value={servico.servico_id}
                            onChange={(e) => handleServicoChange(servico.id, 'servico_id', e.target.value)}
                            className="neon-input text-sm"
                          >
                            <option value="">Selecione um serviço</option>
                            {servicos.map((srv) => (
                              <option key={srv.id} value={srv.id}>
                                {srv.nome}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Qtd</label>
                          <input
                            type="number"
                            min="1"
                            value={servico.quantidade}
                            onChange={(e) => handleServicoChange(servico.id, 'quantidade', parseInt(e.target.value) || 1)}
                            className="neon-input text-sm"
                          />
                        </div>

                        <div>
                          <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Valor Unit.</label>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            value={servico.valor_unitario}
                            onChange={(e) => handleServicoChange(servico.id, 'valor_unitario', parseFloat(e.target.value) || 0)}
                            className="neon-input text-sm"
                          />
                        </div>

                        <div className="flex items-end">
                          <button
                            onClick={() => handleRemoveServico(servico.id)}
                            className="p-2 hover:bg-red-500/10 rounded-lg transition-colors w-full"
                          >
                            <Trash2 className="w-4 h-4 text-red-400 mx-auto" />
                          </button>
                        </div>

                        <div className="col-span-5">
                          <p className="text-xs text-gray-500">
                            Valor Total: <span className="text-[#39FF14] font-bold">
                              R$ {(servico.valor_unitario * servico.quantidade).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                            </span>
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'anexos' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-[#00D4FF] uppercase tracking-wider mb-4">Anexos</h3>

              <div className="border-2 border-dashed border-[#00D4FF]/30 rounded-lg p-8 text-center hover:border-[#00D4FF]/60 transition-colors">
                <input
                  type="file"
                  id="file-upload"
                  multiple
                  onChange={handleAddAnexo}
                  className="hidden"
                  accept="image/*,video/*,.pdf,.doc,.docx"
                />
                <label
                  htmlFor="file-upload"
                  className="cursor-pointer flex flex-col items-center gap-3"
                >
                  <Upload className="w-12 h-12 text-[#00D4FF]" />
                  <div>
                    <p className="text-[#00D4FF] font-bold">Clique para fazer upload</p>
                    <p className="text-xs text-gray-500 mt-1">Imagens, vídeos, PDFs ou documentos</p>
                  </div>
                </label>
              </div>

              {/* Anexos salvos no banco */}
              {anexosSalvos.length > 0 && (
                <div className="space-y-2 mb-4">
                  <h4 className="text-xs text-gray-400 uppercase tracking-wider">Anexos Salvos</h4>
                  {anexosSalvos.map((anexo) => (
                    <div key={anexo.id} className="premium-card p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Paperclip className="w-4 h-4 text-[#00D4FF]" />
                        <div>
                          <p className="text-sm text-gray-300">{anexo.nome_arquivo}</p>
                          <p className="text-xs text-gray-500">
                            {(anexo.tamanho_bytes / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleDownloadAnexo(anexo)}
                        className="neon-button text-xs px-4 py-2"
                      >
                        Baixar
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Anexos novos (não salvos ainda) */}
              {anexos.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs text-gray-400 uppercase tracking-wider">Arquivos Selecionados</h4>
                  {anexos.map((arquivo, index) => (
                    <div key={index} className="premium-card p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <Paperclip className="w-4 h-4 text-[#FFBF00]" />
                        <div>
                          <p className="text-sm text-gray-300">{arquivo.name}</p>
                          <p className="text-xs text-gray-500">
                            {(arquivo.size / 1024).toFixed(2)} KB
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleRemoveAnexo(index)}
                        className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {anexosSalvos.length === 0 && anexos.length === 0 && (
                <div className="text-center py-12">
                  <Paperclip className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">Nenhum anexo adicionado</p>
                </div>
              )}

              {!cotacaoId && anexos.length > 0 && (
                <div className="premium-card p-4 bg-[#FFBF00]/5 border border-[#FFBF00]/20">
                  <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Aguardando Salvamento</p>
                  <p className="text-sm text-gray-300">
                    {anexos.length} anexo(s) serão enviados quando você salvar a cotação
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'pagamento' && cotacaoId && osData && (
            <OSPagamentoTab
              osId={osData.id}
              os={osData}
              onUpdate={async () => {
                if (cotacaoId) {
                  await loadCotacaoData(cotacaoId);
                }
              }}
            />
          )}

          {activeTab === 'pagamento' && cotacaoId && !osData && (
            <div className="space-y-4">
              <div className="premium-card p-6 bg-gradient-to-r from-[#39FF14]/5 to-[#00D4FF]/5">
                <div className="grid grid-cols-3 gap-6 mb-4">
                  <div>
                    <p className="text-xs text-gray-400 uppercase mb-1">Valor Total</p>
                    <p className="text-2xl font-bold text-[#00D4FF]">
                      R$ {calcularValorTotal().toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase mb-1">Valor Pago</p>
                    <p className="text-2xl font-bold text-[#39FF14]">
                      R$ {pagamentosTemporarios.reduce((sum, p) => sum + (p.valor_bruto || p.valor), 0).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase mb-1">Saldo Restante</p>
                    <p className="text-2xl font-bold text-[#FFBF00]">
                      R$ {(calcularValorTotal() - pagamentosTemporarios.reduce((sum, p) => sum + (p.valor_bruto || p.valor), 0)).toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className={`px-4 py-2 rounded-lg text-xs font-bold uppercase ${
                      pagamentosTemporarios.reduce((sum, p) => sum + (p.valor_bruto || p.valor), 0) >= calcularValorTotal()
                        ? 'bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/40'
                        : pagamentosTemporarios.length > 0
                        ? 'bg-[#FFBF00]/20 text-[#FFBF00] border border-[#FFBF00]/40'
                        : 'bg-[#FF0064]/20 text-[#FF0064] border border-[#FF0064]/40'
                    }`}>
                      {pagamentosTemporarios.reduce((sum, p) => sum + (p.valor_bruto || p.valor), 0) >= calcularValorTotal() ? '✓ Pago 100%' :
                       pagamentosTemporarios.length > 0 ? '⚠ Pago Parcial' : '○ Pendente'}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowAddPaymentModal(true)}
                    className="neon-button px-6 py-3"
                  >
                    <DollarSign className="w-4 h-4 inline mr-2" />
                    Adicionar Pagamento
                  </button>
                </div>
              </div>

              <div>
                <h4 className="text-[#00D4FF] font-bold mb-3 uppercase text-sm flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Pagamentos Adicionados ({pagamentosTemporarios.length})
                </h4>

                {pagamentosTemporarios.length === 0 ? (
                  <div className="text-center py-12 premium-card">
                    <DollarSign className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">Nenhum pagamento adicionado ainda</p>
                    <p className="text-xs text-gray-600 mt-2">Clique em "Adicionar Pagamento" para registrar o primeiro</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {pagamentosTemporarios.map((pagamento, index) => (
                        <div
                          key={index}
                          onClick={() => {
                            setSelectedPayment(pagamento);
                            setShowPaymentDetailsModal(true);
                          }}
                          className="premium-card p-5 hover-lift cursor-pointer transition-all hover:border-[#00D4FF]/50"
                          style={{
                            borderLeft: `4px solid ${getFormaPagamentoColor(pagamento.forma_pagamento)}`
                          }}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center"
                                style={{
                                  backgroundColor: `${getFormaPagamentoColor(pagamento.forma_pagamento)}20`,
                                  borderColor: getFormaPagamentoColor(pagamento.forma_pagamento),
                                  borderWidth: '2px'
                                }}
                              >
                                <DollarSign
                                  className="w-5 h-5"
                                  style={{ color: getFormaPagamentoColor(pagamento.forma_pagamento) }}
                                />
                              </div>
                              <div>
                                <p className="text-lg font-bold text-white">
                                  R$ {(pagamento.valor_bruto || pagamento.valor).toFixed(2)}
                                </p>
                                <p
                                  className="text-xs font-semibold"
                                  style={{ color: getFormaPagamentoColor(pagamento.forma_pagamento) }}
                                >
                                  {getFormaPagamentoLabel(pagamento.forma_pagamento)}
                                  {pagamento.parcelamento && pagamento.parcelamento > 1 && ` - ${pagamento.parcelamento}x`}
                                </p>
                                {pagamento.taxa_valor && pagamento.taxa_valor > 0 && (
                                  <p className="text-xs text-gray-400 mt-1">
                                    Taxa: R$ {pagamento.taxa_valor.toFixed(2)} • Líquido: R$ {pagamento.valor_liquido.toFixed(2)}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPaymentToEdit(pagamento);
                                  setShowEditPaymentModal(true);
                                }}
                                className="p-2 hover:bg-[#00D4FF]/20 rounded-lg transition-colors"
                                title="Editar pagamento"
                              >
                                <Edit className="w-4 h-4 text-[#00D4FF]" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePayment(pagamento, index);
                                }}
                                className="p-2 hover:bg-[#FF0064]/20 rounded-lg transition-colors"
                                title="Excluir pagamento"
                              >
                                <Trash2 className="w-4 h-4 text-[#FF0064]" />
                              </button>
                            </div>
                          </div>

                          {pagamento.nsu && (
                            <div className="mb-2">
                              <p className="text-xs text-gray-400">NSU: <span className="text-white font-mono">{pagamento.nsu}</span></p>
                            </div>
                          )}

                          {pagamento.observacoes && (
                            <div className="mt-3 premium-card p-3 bg-[#00D4FF]/5">
                              <p className="text-xs text-gray-400 uppercase mb-1">Observações</p>
                              <p className="text-sm text-gray-300">{pagamento.observacoes}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="premium-card p-4 bg-[#FFBF00]/5 border border-[#FFBF00]/20 mt-4">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Aguardando Salvamento</p>
                      <p className="text-sm text-gray-300">
                        {pagamentosTemporarios.length} pagamento(s) serão salvos quando você salvar a cotação
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === 'pagamento' && !cotacaoId && (
            <div className="space-y-4">
              <div className="premium-card p-6 bg-gradient-to-r from-[#39FF14]/5 to-[#00D4FF]/5">
                <div className="grid grid-cols-3 gap-6 mb-4">
                  <div>
                    <p className="text-xs text-gray-400 uppercase mb-1">Valor Total</p>
                    <p className="text-2xl font-bold text-[#00D4FF]">
                      R$ {calcularValorTotal().toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase mb-1">Valor Pago</p>
                    <p className="text-2xl font-bold text-[#39FF14]">
                      R$ {pagamentosTemporarios.reduce((sum, p) => sum + (p.valor_bruto || p.valor), 0).toFixed(2)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-400 uppercase mb-1">Saldo Restante</p>
                    <p className="text-2xl font-bold text-[#FFBF00]">
                      R$ {(calcularValorTotal() - pagamentosTemporarios.reduce((sum, p) => sum + (p.valor_bruto || p.valor), 0)).toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <span className={`px-4 py-2 rounded-lg text-xs font-bold uppercase ${
                      pagamentosTemporarios.reduce((sum, p) => sum + (p.valor_bruto || p.valor), 0) >= calcularValorTotal()
                        ? 'bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/40'
                        : pagamentosTemporarios.length > 0
                        ? 'bg-[#FFBF00]/20 text-[#FFBF00] border border-[#FFBF00]/40'
                        : 'bg-[#FF0064]/20 text-[#FF0064] border border-[#FF0064]/40'
                    }`}>
                      {pagamentosTemporarios.reduce((sum, p) => sum + (p.valor_bruto || p.valor), 0) >= calcularValorTotal() ? '✓ Pago 100%' :
                       pagamentosTemporarios.length > 0 ? '⚠ Pago Parcial' : '○ Pendente'}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowAddPaymentModal(true)}
                    className="neon-button px-6 py-3"
                  >
                    <DollarSign className="w-4 h-4 inline mr-2" />
                    Adicionar Pagamento
                  </button>
                </div>
              </div>

              <div>
                <h4 className="text-[#00D4FF] font-bold mb-3 uppercase text-sm flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  Pagamentos Adicionados ({pagamentosTemporarios.length})
                </h4>

                {pagamentosTemporarios.length === 0 ? (
                  <div className="text-center py-12">
                    <DollarSign className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm">Nenhum pagamento adicionado ainda</p>
                    <p className="text-xs text-gray-600 mt-2">Clique em "Adicionar Pagamento" para registrar o primeiro</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-3">
                      {pagamentosTemporarios.map((pagamento, index) => (
                        <div
                          key={index}
                          onClick={() => {
                            setSelectedPayment(pagamento);
                            setShowPaymentDetailsModal(true);
                          }}
                          className="premium-card p-5 hover-lift cursor-pointer transition-all hover:border-[#00D4FF]/50"
                          style={{
                            borderLeft: `4px solid ${getFormaPagamentoColor(pagamento.forma_pagamento)}`
                          }}
                        >
                          <div className="flex items-start justify-between mb-4">
                            <div className="flex items-center gap-3">
                              <div
                                className="w-10 h-10 rounded-lg flex items-center justify-center"
                                style={{
                                  backgroundColor: `${getFormaPagamentoColor(pagamento.forma_pagamento)}20`,
                                  borderColor: getFormaPagamentoColor(pagamento.forma_pagamento),
                                  borderWidth: '2px'
                                }}
                              >
                                <DollarSign
                                  className="w-5 h-5"
                                  style={{ color: getFormaPagamentoColor(pagamento.forma_pagamento) }}
                                />
                              </div>
                              <div>
                                <p className="text-lg font-bold text-white">
                                  R$ {(pagamento.valor_bruto || pagamento.valor).toFixed(2)}
                                </p>
                                <p
                                  className="text-xs font-semibold"
                                  style={{ color: getFormaPagamentoColor(pagamento.forma_pagamento) }}
                                >
                                  {getFormaPagamentoLabel(pagamento.forma_pagamento)}
                                  {pagamento.parcelamento && pagamento.parcelamento > 1 && ` - ${pagamento.parcelamento}x`}
                                </p>
                                {pagamento.taxa_valor && pagamento.taxa_valor > 0 && (
                                  <p className="text-xs text-gray-400 mt-1">
                                    Taxa: R$ {pagamento.taxa_valor.toFixed(2)} • Líquido: R$ {pagamento.valor_liquido.toFixed(2)}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPaymentToEdit(pagamento);
                                  setShowEditPaymentModal(true);
                                }}
                                className="p-2 hover:bg-[#00D4FF]/20 rounded-lg transition-colors"
                                title="Editar pagamento"
                              >
                                <Edit className="w-4 h-4 text-[#00D4FF]" />
                              </button>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePayment(pagamento, index);
                                }}
                                className="p-2 hover:bg-[#FF0064]/20 rounded-lg transition-colors"
                                title="Excluir pagamento"
                              >
                                <Trash2 className="w-4 h-4 text-[#FF0064]" />
                              </button>
                            </div>
                          </div>

                          {pagamento.nsu && (
                            <div className="mb-2">
                              <p className="text-xs text-gray-400">NSU: <span className="text-white font-mono">{pagamento.nsu}</span></p>
                            </div>
                          )}

                          {pagamento.observacoes && (
                            <div className="mt-3 premium-card p-3 bg-[#00D4FF]/5">
                              <p className="text-xs text-gray-400 uppercase mb-1">Observações</p>
                              <p className="text-sm text-gray-300">{pagamento.observacoes}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="premium-card p-4 bg-[#FFBF00]/5 border border-[#FFBF00]/20 mt-4">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Aguardando Salvamento</p>
                      <p className="text-sm text-gray-300">
                        {pagamentosTemporarios.length} pagamento(s) serão salvos quando você salvar a cotação
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

          {activeTab === 'comentarios' && (
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-[#00D4FF] uppercase tracking-wider mb-4">Comentários Internos</h3>

              <div className="premium-card p-4">
                <textarea
                  value={novoComentario}
                  onChange={(e) => setNovoComentario(e.target.value)}
                  placeholder="Digite seu comentário..."
                  rows={3}
                  className="neon-input mb-3"
                />
                <button
                  onClick={handleAddComentario}
                  disabled={!novoComentario.trim()}
                  className="neon-button text-xs flex items-center gap-2"
                >
                  <Send className="w-4 h-4" />
                  ADICIONAR COMENTÁRIO
                </button>
              </div>

              <div className="mb-4 flex items-center gap-2">
                <input
                  type="checkbox"
                  id="mostrarSistemaCotacao"
                  checked={mostrarComentariosSistema}
                  onChange={(e) => setMostrarComentariosSistema(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="mostrarSistemaCotacao" className="text-xs text-gray-400">
                  Mostrar logs do sistema
                </label>
              </div>

              {comentarios.filter(c => mostrarComentariosSistema || !c.is_system).length === 0 ? (
                <div className="text-center py-12">
                  <MessageSquare className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 text-sm">Nenhum comentário adicionado</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {comentarios
                      .filter(c => mostrarComentariosSistema || !c.is_system)
                      .map((comentario) => (
                        <div
                          key={comentario.id}
                          className={`premium-card p-4 ${comentario.is_system ? 'border-l-4 border-blue-500/50 bg-blue-500/5' : ''}`}
                        >
                          {comentario.is_system && (
                            <p className="text-xs text-blue-400 font-bold mb-1">🤖 SISTEMA</p>
                          )}
                          <div className="flex items-start justify-between mb-2">
                            <p className="text-xs font-bold text-[#00D4FF]">{comentario.usuario_nome}</p>
                            <p className="text-xs text-gray-500">
                              {new Date(comentario.created_at).toLocaleString('pt-BR')}
                            </p>
                          </div>
                          <p className="text-sm text-gray-300">{comentario.texto}</p>
                        </div>
                      ))}
                  </div>

                  {!cotacaoId && comentarios.length > 0 && (
                    <div className="premium-card p-4 bg-[#FFBF00]/5 border border-[#FFBF00]/20">
                      <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Aguardando Salvamento</p>
                      <p className="text-sm text-gray-300">
                        {comentarios.length} comentário(s) serão salvos quando você salvar a cotação
                      </p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        <div className="border-t border-[#00D4FF]/20 p-6 flex items-center justify-between bg-gradient-to-t from-black/60 to-transparent">
          <div className="text-sm flex items-center gap-6">
            <div>
              <span className="text-gray-400 uppercase tracking-wider">Valor Total:</span>
              <span className="text-2xl font-bold text-[#39FF14] ml-3">
                R$ {calcularValorTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            {pagamentosTemporarios.length > 0 && (
              <div>
                <span className="text-gray-400 uppercase tracking-wider">Saldo Restante:</span>
                <span className="text-2xl font-bold text-[#FFBF00] ml-3">
                  R$ {(calcularValorTotal() - pagamentosTemporarios.reduce((sum, p) => sum + (p.valor_bruto || p.valor), 0)).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            )}
            {analiseTecnicoConcluida && (
              <span className="px-3 py-1.5 rounded-lg text-xs font-bold uppercase bg-[#9D4EDD]/20 text-[#9D4EDD] border border-[#9D4EDD]/40 flex items-center gap-1.5 animate-pulse">
                <Microscope className="w-4 h-4" />
                ANALISE FEITA - SO PRECIFICAR
              </span>
            )}
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleClose}
              className="px-6 py-3 rounded-lg font-bold text-sm uppercase tracking-wider transition-all border border-gray-700 text-gray-400 hover:bg-gray-800/60"
              disabled={loading}
            >
              CANCELAR
            </button>
            <button
              onClick={handleSave}
              className="neon-button flex items-center gap-2"
              disabled={loading}
              style={{
                backgroundColor: '#39FF1420',
                color: '#39FF14',
                border: '1px solid #39FF1460',
                boxShadow: '0 0 20px #39FF1430'
              }}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-[#39FF14] border-t-transparent rounded-full animate-spin" />
                  SALVANDO...
                </>
              ) : (
                <>
                  <Save className="w-5 h-5" />
                  SALVAR COTAÇÃO
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {showAddPaymentModal && (!cotacaoId || (cotacaoId && !osData)) && (
        <AddPaymentModalSimplified
          valorTotal={calcularValorTotal()}
          saldoRestante={calcularValorTotal() - pagamentosTemporarios.reduce((sum, p) => sum + (p.valor_bruto || p.valor), 0)}
          clienteNome={clienteNome}
          onClose={() => setShowAddPaymentModal(false)}
          onSave={handleAddPaymentTemporario}
        />
      )}

      <PaymentDetailsModal
        isOpen={showPaymentDetailsModal}
        onClose={() => {
          setShowPaymentDetailsModal(false);
          setSelectedPayment(null);
        }}
        payment={selectedPayment}
      />

      <EditPaymentModal
        isOpen={showEditPaymentModal}
        payment={paymentToEdit}
        onClose={() => {
          setShowEditPaymentModal(false);
          setPaymentToEdit(null);
        }}
        onSuccess={handleEditPaymentSuccess}
      />
    </div>
  );
}

interface AddPaymentModalSimplifiedProps {
  valorTotal: number;
  saldoRestante: number;
  clienteNome: string;
  onClose: () => void;
  onSave: (paymentData: any) => void;
}

function AddPaymentModalSimplified({ valorTotal, saldoRestante, clienteNome, onClose, onSave }: AddPaymentModalSimplifiedProps) {
  const { usuario } = useAuth();
  const [formaPagamento, setFormaPagamento] = useState<'pix' | 'cartao_credito' | 'cartao_debito' | 'dinheiro' | 'transferencia' | 'boleto' | 'outro'>('pix');
  const [valor, setValor] = useState('');
  const [parcelamento, setParcelamento] = useState('1');
  const [taxaPercentual, setTaxaPercentual] = useState('0');
  const [taxaPagaPor, setTaxaPagaPor] = useState<'cliente' | 'empresa'>('empresa');
  const [nsu, setNsu] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [comprovanteFile, setComprovanteFile] = useState<File | null>(null);
  const [taxasMaquina, setTaxasMaquina] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  const formasPagamento = [
    { value: 'pix', label: 'PIX', icon: '💳', color: '#00D4FF' },
    { value: 'cartao_credito', label: 'Cartão de Crédito', icon: '💳', color: '#9D4EDD' },
    { value: 'cartao_debito', label: 'Cartão de Débito', icon: '💳', color: '#3b82f6' },
    { value: 'dinheiro', label: 'Dinheiro', icon: '💵', color: '#39FF14' },
    { value: 'transferencia', label: 'Transferência', icon: '🏦', color: '#10b981' },
    { value: 'boleto', label: 'Boleto', icon: '📄', color: '#FFBF00' },
    { value: 'outro', label: 'Outro', icon: '📋', color: '#6B7280' }
  ];

  const isCartao = formaPagamento === 'cartao_credito' || formaPagamento === 'cartao_debito';
  const isCredito = formaPagamento === 'cartao_credito';

  useEffect(() => {
    const loadTaxasMaquina = async () => {
      const { data } = await supabase
        .from('taxas_maquina')
        .select('*')
        .eq('ativo', true)
        .order('parcelamento');

      if (data) {
        setTaxasMaquina(data);
      }
    };

    loadTaxasMaquina();
  }, []);

  useEffect(() => {
    if (isCartao && taxasMaquina.length > 0) {
      const taxa = taxasMaquina.find(t => t.parcelamento === parseInt(parcelamento));
      if (taxa) {
        if (formaPagamento === 'cartao_credito') {
          setTaxaPercentual(taxa.taxa?.toString() || '0');
        } else if (formaPagamento === 'cartao_debito') {
          setTaxaPercentual(taxa.debito?.toString() || '0');
        }
      }
    } else if (!isCartao) {
      setTaxaPercentual('0');
    }
  }, [isCartao, taxasMaquina, parcelamento, formaPagamento]);

  const calcularTaxaValor = () => {
    const valorNum = parseFloat(valor) || 0;
    const taxaNum = parseFloat(taxaPercentual) || 0;
    return (valorNum * taxaNum) / 100;
  };

  const calcularValorLiquido = () => {
    const valorNum = parseFloat(valor) || 0;
    const taxaValor = calcularTaxaValor();

    if (taxaPagaPor === 'empresa') {
      return valorNum - taxaValor;
    }
    return valorNum;
  };

  const handleSubmit = () => {
    if (isSubmittingRef.current || isSubmitting) {
      return;
    }

    const valorNum = parseFloat(valor);
    if (!valor || isNaN(valorNum) || valorNum <= 0) {
      alert('❌ Digite um valor válido maior que zero');
      return;
    }

    if (!comprovanteFile) {
      alert('❌ Comprovante é obrigatório');
      return;
    }

    if (isCartao && !nsu.trim()) {
      alert('❌ NSU é obrigatório para pagamentos com cartão');
      return;
    }

    isSubmittingRef.current = true;
    setIsSubmitting(true);

    const paymentData = {
      forma_pagamento: formaPagamento,
      valor: valorNum,
      valor_bruto: valorNum,
      valor_liquido: calcularValorLiquido(),
      parcelamento: isCredito ? parseInt(parcelamento) : 1,
      taxa_percentual: parseFloat(taxaPercentual),
      taxa_valor: calcularTaxaValor(),
      taxa_paga_por: isCartao && parseFloat(taxaPercentual) > 0 ? taxaPagaPor : null,
      nsu: isCartao ? nsu.trim() : null,
      sku_maquininha: null,
      observacoes: observacoes.trim() || null,
      comprovante_file: comprovanteFile,
      lancado_por: usuario?.id,
      responsavel_fechamento: usuario?.id,
      data_lancamento: new Date().toISOString()
    };

    onSave(paymentData);
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="premium-card w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-[#39FF14]/20 bg-gradient-to-r from-[#39FF14]/5 to-transparent">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-[#39FF14]/20 to-[#00D4FF]/20 flex items-center justify-center border-2 border-[#39FF14]/30">
                <DollarSign className="w-7 h-7 text-[#39FF14]" style={{ filter: 'drop-shadow(0 0 8px rgba(57, 255, 20, 0.6))' }} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-[#39FF14]" style={{ textShadow: '0 0 20px rgba(57, 255, 20, 0.5)' }}>
                  ADICIONAR PAGAMENTO
                </h2>
                <p className="text-sm text-gray-400 mt-1">Cliente: {clienteNome}</p>
              </div>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-all">
              <X className="w-6 h-6 text-gray-400 hover:text-white" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto cyber-scrollbar p-6 space-y-6">
          {/* Resumo */}
          <div className="premium-card p-5 bg-gradient-to-br from-[#00D4FF]/10 to-transparent border-2 border-[#00D4FF]/30">
            <div className="grid grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Valor Total da Cotação</p>
                <p className="text-[#00D4FF] font-bold text-2xl">R$ {valorTotal.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Saldo Restante</p>
                <p className="text-[#FFBF00] font-bold text-2xl">R$ {saldoRestante.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Forma de Pagamento */}
          <div>
            <label className="block text-sm font-bold text-[#00D4FF] uppercase mb-3 tracking-wider">
              Forma de Pagamento *
            </label>
            <div className="grid grid-cols-4 gap-3">
              {formasPagamento.map(forma => (
                <button
                  key={forma.value}
                  type="button"
                  onClick={() => setFormaPagamento(forma.value as any)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    formaPagamento === forma.value
                      ? 'border-[#00D4FF] bg-[#00D4FF]/20 scale-105'
                      : 'border-gray-700 bg-black/30 hover:border-gray-500'
                  }`}
                >
                  <div className="text-3xl mb-2">{forma.icon}</div>
                  <p className={`text-xs font-bold uppercase ${
                    formaPagamento === forma.value ? 'text-[#00D4FF]' : 'text-gray-400'
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
                value={valor}
                onChange={(e) => setValor(e.target.value)}
                placeholder="0,00"
                className="neon-input pl-14 text-2xl font-bold"
                style={{ height: '60px' }}
              />
            </div>
          </div>

          {/* Parcelamento - Só para Crédito */}
          {isCredito && (
            <div>
              <label className="block text-sm font-bold text-[#9D4EDD] uppercase mb-3 tracking-wider">
                Parcelamento
              </label>
              <select value={parcelamento} onChange={(e) => setParcelamento(e.target.value)} className="neon-input">
                <option value="1">À vista (1x)</option>
                {[...Array(12)].map((_, i) => <option key={i + 2} value={i + 2}>{i + 2}x</option>)}
              </select>
            </div>
          )}

          {/* Campos de Cartão */}
          {isCartao && (
            <div className="premium-card p-6 bg-gradient-to-br from-[#FFBF00]/10 to-transparent border-2 border-[#FFBF00]/30 space-y-4">
              <h3 className="text-sm font-bold text-[#FFBF00] uppercase">Informações do Cartão</h3>

              <div className="mb-4">
                <label className="block text-xs text-gray-400 uppercase mb-2">NSU da Transação *</label>
                <input
                  type="text"
                  value={nsu}
                  onChange={(e) => setNsu(e.target.value)}
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
                    Taxa de Cartão (%) {taxasMaquina.length > 0 && '- Automático'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={taxaPercentual}
                    onChange={(e) => setTaxaPercentual(e.target.value)}
                    placeholder="0.00"
                    readOnly={taxasMaquina.length > 0}
                    className={`neon-input ${taxasMaquina.length > 0 ? 'bg-gray-900/50 cursor-not-allowed' : ''}`}
                  />
                  {taxasMaquina.length > 0 && (
                    <p className="text-xs text-[#39FF14] mt-2">
                      ✓ Taxa aplicada automaticamente das configurações
                    </p>
                  )}
                </div>
                <div>
                  <label className="block text-xs text-gray-400 uppercase mb-2 tracking-wider">
                    Quem Paga a Taxa?
                  </label>
                  <select value={taxaPagaPor} onChange={(e) => setTaxaPagaPor(e.target.value as any)} className="neon-input">
                    <option value="empresa">🏢 Empresa absorve</option>
                    <option value="cliente">👤 Cliente paga</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Comprovante */}
          <div>
            <label className="block text-sm font-bold text-[#FF0064] uppercase mb-3">Comprovante *</label>
            {!comprovanteFile ? (
              <label className="block cursor-pointer">
                <div className="premium-card p-8 border-2 border-dashed border-[#FF0064]/40 hover:border-[#FF0064] bg-[#FF0064]/5 text-center">
                  <Upload className="w-12 h-12 text-[#FF0064] mx-auto mb-3" />
                  <p className="text-[#FF0064] font-bold">Clique para selecionar</p>
                </div>
                <input type="file" accept="image/*,.pdf" onChange={(e) => e.target.files && setComprovanteFile(e.target.files[0])} className="hidden" />
              </label>
            ) : (
              <div className="premium-card p-5 bg-[#39FF14]/10 border-2 border-[#39FF14]/40 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-[#39FF14]/20 flex items-center justify-center">
                    <Paperclip className="w-6 h-6 text-[#39FF14]" />
                  </div>
                  <div>
                    <p className="text-[#39FF14] font-bold">{comprovanteFile.name}</p>
                    <p className="text-xs text-gray-400">{(comprovanteFile.size / 1024).toFixed(2)} KB</p>
                  </div>
                </div>
                <button onClick={() => setComprovanteFile(null)} className="p-2 hover:bg-[#FF0064]/20 rounded-lg">
                  <Trash2 className="w-5 h-5 text-[#FF0064]" />
                </button>
              </div>
            )}
          </div>

          {/* Observações */}
          <div>
            <label className="block text-sm font-bold text-[#00D4FF] uppercase mb-3">Observações</label>
            <textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} className="neon-input h-24 resize-none" />
          </div>
        </div>

        <div className="p-6 border-t border-[#39FF14]/20 flex gap-4">
          <button onClick={onClose} disabled={isSubmitting} className="flex-1 px-6 py-4 rounded-xl border-2 border-gray-600 text-gray-400 hover:text-white font-bold uppercase disabled:opacity-50 disabled:cursor-not-allowed">
            Cancelar
          </button>
          <button onClick={handleSubmit} disabled={isSubmitting} className="flex-1 px-6 py-4 rounded-xl font-bold uppercase bg-[#39FF1420] border-2 border-[#39FF14] text-[#39FF14] disabled:opacity-50 disabled:cursor-not-allowed">
            <Save className="w-5 h-5 inline mr-2" />
            {isSubmitting ? 'Salvando...' : 'Adicionar'}
          </button>
        </div>
      </div>
    </div>
  );
}
