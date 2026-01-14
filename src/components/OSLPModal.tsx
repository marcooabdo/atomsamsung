import { useEffect, useState } from 'react';
import { X, User, Package, FileText, MessageSquare, Paperclip, Send, Trash2, CheckSquare, AlertCircle, AlertTriangle, Clock, QrCode, RefreshCw, Loader2, MoveHorizontal, ChevronDown, Calendar, CheckCircle, XCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { buscarCEP, formatarCEP } from '../lib/cep';
import { OSAgendamentoTab } from './OSAgendamentoTab';
import { DevolucaoModal } from './DevolucaoModal';
import { OSChecklistTab } from './OSChecklistTab';
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
}

type AbaAtiva = 'dados' | 'estoque' | 'checklist' | 'anexos' | 'comentarios' | 'agendamento';

export function OSLPModal({ osId, onClose, onReload, mode = 'view' }: OSLPModalProps) {
  const { usuario } = useAuth();
  const [os, setOS] = useState<OS | null>(null);
  const [pecas, setPecas] = useState<OSPeca[]>([]);
  const [requisicoes, setRequisicoes] = useState<RequisicaoPeca[]>([]);
  const [comentarios, setComentarios] = useState<OSComentario[]>([]);
  const [anexos, setAnexos] = useState<OSAnexo[]>([]);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [novoComentario, setNovoComentario] = useState('');
  const [abaAtiva, setAbaAtiva] = useState<AbaAtiva>('dados');
  const [loading, setLoading] = useState(mode === 'view');
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
  const [numeroOSSamsung, setNumeroOSSamsung] = useState('');
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
  const [sugestoesPecas, setSugestoesPecas] = useState<Array<{
    pn: string;
    descricao: string;
    valor_com_impostos: number;
    valor_corrigido?: number;
    count: number;
  }>>([]);
  const [mostrarSugestoes, setMostrarSugestoes] = useState(false);
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
    if (mode === 'create') {
      loadUnidades();
      if (usuario?.unidade_id) {
        setUnidadeId(usuario.unidade_id);
      }
    } else if (osId) {
      loadOS();
      loadPecas();
      loadRequisicoes();
      loadChecklist();
      loadComentarios();
      loadAnexos();
    }
  }, [osId, mode]);

  // Debounce para buscar sugestões
  useEffect(() => {
    const timer = setTimeout(() => {
      if (novaPecaCodigo && mode === 'view') {
        buscarSugestoesPecas(novaPecaCodigo);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [novaPecaCodigo]);

  useEffect(() => {
    if (mode === 'view' && osId) {
      loadCurrentJob();

      const channel = supabase
        .channel('jobs-changes-lp')
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'jobs',
          filter: `os_id=eq.${osId}`
        }, (payload) => {
          loadCurrentJob();
        })
        .subscribe((status) => {
        });

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [osId, mode]);

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
    if (!osId) {
      return;
    }


    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('os_id', osId)
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
            .eq('os_id', osId)
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
    if (!osId) return;
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
    if (!osId) return;
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
    if (!osId) return;
    const { data } = await supabase
      .from('requisicoes_pecas')
      .select('*')
      .eq('os_id', osId)
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

  const buscarSugestoesPecas = async (codigo: string) => {
    if (!codigo || codigo.length < 2) {
      setSugestoesPecas([]);
      setMostrarSugestoes(false);
      return;
    }

    try {
      // Buscar peças do estoque da unidade
      const { data: pecasEstoque } = await supabase
        .from('estoque_pecas')
        .select('pn, descricao, valor_com_impostos')
        .eq('unidade_id', os?.unidade_id || usuario?.unidade_id)
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

      // Buscar valor corrigido do último pedido
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

      setSugestoesPecas(sugestoesComValor);
      setMostrarSugestoes(true);
    } catch (error) {
    }
  };

  const loadChecklist = async () => {
    if (!osId) return;
    const { data } = await supabase
      .from('os_checklist')
      .select('*, concluido_por:usuarios(nome)')
      .eq('os_id', osId)
      .order('ordem', { ascending: true });

    setChecklist(data || []);
  };

  const loadComentarios = async () => {
    if (!osId) return;
    const { data: osData } = await supabase
      .from('os')
      .select('cotacao_id')
      .eq('id', osId)
      .maybeSingle();

    const [osComentariosResult, cotacaoComentariosResult] = await Promise.all([
      supabase
        .from('os_comentarios')
        .select('*')
        .eq('os_id', osId)
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
    if (!osId) return;
    const { data } = await supabase
      .from('os_anexos')
      .select('*, usuario:usuarios(nome)')
      .eq('os_id', osId)
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
          tipo_os: 'LP',
          tipo_atendimento: tipoAtendimento,
          numero_os_samsung: numeroOSSamsung || null,
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

      const checklistPadrao = [
        'Verificar número de série do aparelho',
        'Conferir IMEI com sistema Samsung',
        'Testar funcionamento geral do aparelho',
        'Fotografar defeito relatado',
        'Embalar aparelho adequadamente'
      ];

      const checklistInsert = checklistPadrao.map((item, index) => ({
        os_id: novaOS.id,
        item: item,
        ordem: index + 1,
        concluido: false
      }));

      const { error: checklistError } = await supabase
        .from('os_checklist')
        .insert(checklistInsert);

      if (checklistError) throw checklistError;

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
          comentario: `OS LP criada por ${usuario?.nome}`,
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

      alert('OS LP criada com sucesso!');
      onReload?.();
      onClose();
    } catch (error) {
      alert('Erro ao criar OS LP');
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
          .eq('id', osId);

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
          .eq('id', osId);
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
    if (!novoComentario.trim() || !osId) return;

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
    if (!e.target.files?.[0] || !osId) return;

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
        .eq('id', osId);

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

  if (loading && mode === 'view') {
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
        <div className="flex items-center justify-between p-6 border-b border-[#FFA500]/20">
          <div>
            <h2 className="tech-heading text-xl text-[#FFA500] flex items-center gap-2">
              LP - Garantia
              {mode === 'create' && <span className="text-sm text-gray-400">(NOVA)</span>}
            </h2>
            {os && (
              <p className="text-sm text-gray-400 mt-1">
                {os.numero_os_samsung || os.numero_os_interna || 'N/A'}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {mode === 'view' && os && (
              <div className="relative">
                <button
                  onClick={() => setMostrarMoverPara(!mostrarMoverPara)}
                  disabled={movendoOS}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-sm transition-all disabled:opacity-50"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,165,0,0.2) 0%, rgba(255,165,0,0.05) 100%)',
                    border: '1px solid #FFA500',
                    color: '#FFA500',
                    boxShadow: '0 0 10px rgba(255,165,0,0.2)'
                  }}
                >
                  <MoveHorizontal className="w-4 h-4" />
                  MOVER PARA
                  <ChevronDown className={`w-4 h-4 transition-transform ${mostrarMoverPara ? 'rotate-180' : ''}`} />
                </button>

                {mostrarMoverPara && (
                  <div className="absolute right-0 top-full mt-2 w-72 max-h-96 overflow-y-auto premium-card p-3 z-50 cyber-scrollbar">
                    <div className="mb-3 pb-2 border-b border-[#FFA500]/20">
                      <p className="text-xs text-gray-400">Coluna Atual:</p>
                      <p className="text-sm font-bold text-[#FFA500]">{colunaAtual?.label || 'N/A'}</p>
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
                          className="w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-all hover:bg-[#FFA500]/10 disabled:opacity-50"
                          style={{
                            color: '#fff',
                            border: '1px solid transparent'
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.borderColor = '#FFA500';
                            e.currentTarget.style.boxShadow = '0 0 10px rgba(255,165,0,0.2)';
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
            )}

            {mode === 'view' && os?.numero_os_samsung && (
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
              className="p-2 hover:bg-[#FFA500]/10 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-[#FFA500]" />
            </button>
          </div>
        </div>

        {mode === 'view' && currentJob && (
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

        {mode === 'create' ? (
          <>
            <div className="flex border-b border-[#FFA500]/20">
              {[
                { id: 'dados', label: 'Dados Básicos', icon: User },
                { id: 'estoque', label: 'Estoque & Peças', icon: Package },
                { id: 'checklist', label: 'Checklist', icon: CheckSquare },
                ...(tipoAtendimento === 'IH' ? [{ id: 'agendamento', label: 'Agendamento', icon: Calendar }] : []),
                { id: 'anexos', label: 'Anexos', icon: Paperclip },
                { id: 'comentarios', label: 'Comentários', icon: MessageSquare }
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setAbaAtiva(id as AbaAtiva)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 text-xs font-bold uppercase tracking-wider transition-all ${
                    abaAtiva === id
                      ? 'bg-[#FFA500]/10 text-[#FFA500] border-b-2 border-[#FFA500]'
                      : 'text-gray-400 hover:bg-[#FFA500]/5 hover:text-[#FFA500]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                  {id === 'estoque' && requisicoesTemporarias.length > 0 && (
                    <span className="ml-1 px-2 py-0.5 bg-[#FFA500] text-black rounded-full text-xs font-bold">
                      {requisicoesTemporarias.length}
                    </span>
                  )}
                  {id === 'anexos' && anexosTemporarios.length > 0 && (
                    <span className="ml-1 px-2 py-0.5 bg-[#FFA500] text-black rounded-full text-xs font-bold">
                      {anexosTemporarios.length}
                    </span>
                  )}
                  {id === 'comentarios' && comentariosTemporarios.length > 0 && (
                    <span className="ml-1 px-2 py-0.5 bg-[#FFA500] text-black rounded-full text-xs font-bold">
                      {comentariosTemporarios.length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto cyber-scrollbar p-6">
              {abaAtiva === 'dados' && (
                <div className="space-y-6">
              <div className="premium-card p-6">
                <h3 className="text-sm font-bold text-[#FFA500] uppercase tracking-wider mb-4">
                  Informações Básicas
                </h3>
                <div className="grid grid-cols-2 gap-4">
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
                      Número OS Samsung *
                    </label>
                    <input
                      type="text"
                      value={numeroOSSamsung}
                      onChange={(e) => setNumeroOSSamsung(e.target.value)}
                      className="neon-input w-full"
                      placeholder="Obrigatório para OS Samsung"
                    />
                  </div>
                </div>
              </div>

              <div className="premium-card p-6">
                <h3 className="text-sm font-bold text-[#FFA500] uppercase tracking-wider mb-4">
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
                      Telefone
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
                <h3 className="text-sm font-bold text-[#FFA500] uppercase tracking-wider mb-4">
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
                    <div>
                      <label className="text-xs text-gray-400 uppercase block mb-2">
                        Código/PN
                      </label>
                      <input
                        type="text"
                        value={novaPecaCodigo}
                        onChange={(e) => setNovaPecaCodigo(e.target.value)}
                        className="neon-input w-full"
                        placeholder="Ex: GH82-12345A"
                      />
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
                        Qtd
                      </label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          min="1"
                          value={novaPecaQuantidade}
                          onChange={(e) => setNovaPecaQuantidade(Number(e.target.value))}
                          className="neon-input w-20"
                        />
                        <button
                          onClick={() => {
                            if (!novaPecaCodigo || !novaPecaDescricao) {
                              alert('Preencha código e descrição');
                              return;
                            }
                            setRequisicoesTemporarias([...requisicoesTemporarias, {
                              codigo: novaPecaCodigo,
                              descricao: novaPecaDescricao,
                              quantidade: novaPecaQuantidade
                            }]);
                            setNovaPecaCodigo('');
                            setNovaPecaDescricao('');
                            setNovaPecaQuantidade(1);
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
                </div>

                <div>
                  {requisicoesTemporarias.length === 0 ? (
                    <p className="text-center text-gray-500 py-8">Nenhuma peça requisitada ainda</p>
                  ) : (
                    <div className="space-y-3">
                      {requisicoesTemporarias.map((req, index) => (
                        <div key={index} className="premium-card p-4">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                <p className="text-sm font-bold text-gray-300">{req.descricao}</p>
                                <span
                                  className="px-2 py-1 rounded text-xs font-bold uppercase"
                                  style={{
                                    backgroundColor: '#FFBF0020',
                                    color: '#FFBF00',
                                    border: '1px solid #FFBF0060'
                                  }}
                                >
                                  PENDENTE
                                </span>
                              </div>
                              <p className="text-xs text-gray-500">Código: {req.codigo}</p>
                              <p className="text-xs text-gray-500 mt-1">Qtd: {req.quantidade}</p>
                            </div>
                            <button
                              onClick={() => {
                                setRequisicoesTemporarias(requisicoesTemporarias.filter((_, i) => i !== index));
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
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {abaAtiva === 'checklist' && (
              <div className="space-y-6">
                <div className="bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-lg p-4">
                  <h3 className="text-sm font-bold text-[#39FF14] uppercase tracking-wider flex items-center gap-2">
                    <CheckSquare className="w-4 h-4" />
                    Checklist do Reparo LP
                  </h3>
                  <p className="text-xs text-gray-400 mt-2">
                    Itens de verificação para garantir a qualidade do serviço
                  </p>
                </div>

                <div className="space-y-3">
                  {[
                    'Verificar número de série do aparelho',
                    'Conferir IMEI com sistema Samsung',
                    'Testar funcionamento geral do aparelho',
                    'Fotografar defeito relatado',
                    'Embalar aparelho adequadamente'
                  ].map((item, index) => (
                    <div key={index} className="premium-card p-4 hover-lift">
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-5 h-5 rounded border-2 border-gray-500 flex items-center justify-center">
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-gray-200">{item}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            Será marcado após criação da OS
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {abaAtiva === 'anexos' && (
              <div className="space-y-6">
                <div className="premium-card p-6">
                  <label className="neon-button flex items-center justify-center gap-2 w-full px-4 py-3 cursor-pointer"
                    style={{
                      backgroundColor: '#FFA50020',
                      borderColor: '#FFA500',
                      color: '#FFA500'
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
                <div className="bg-[#FFA500]/10 border border-[#FFA500]/30 rounded-lg p-4">
                  <h3 className="text-sm font-bold text-[#FFA500] uppercase tracking-wider flex items-center gap-2">
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
            <div className="flex border-b border-[#FFA500]/20">
              {[
                { id: 'dados', label: 'Dados OS/Cliente', icon: User },
                { id: 'estoque', label: 'Estoque & Peças', icon: Package },
                { id: 'checklist', label: 'Checklist', icon: CheckSquare },
                ...(os?.tipo_atendimento === 'IH' ? [{ id: 'agendamento', label: 'Agendamento', icon: Calendar }] : []),
                { id: 'anexos', label: 'Anexos', icon: Paperclip },
                { id: 'comentarios', label: 'Comentários', icon: MessageSquare }
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setAbaAtiva(id as AbaAtiva)}
                  className={`flex-1 flex items-center justify-center gap-2 px-4 py-4 text-xs font-bold uppercase tracking-wider transition-all ${
                    abaAtiva === id
                      ? 'bg-[#FFA500]/10 text-[#FFA500] border-b-2 border-[#FFA500]'
                      : 'text-gray-400 hover:bg-[#FFA500]/5 hover:text-[#FFA500]'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {label}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto cyber-scrollbar p-6">
              {abaAtiva === 'dados' && os && (
                <div className="space-y-6">
                  <div className="premium-card p-4 bg-gradient-to-r from-[#FFA500]/10 to-[#00D4FF]/10 border-l-4 border-[#FFA500]">
                    <h3 className="text-sm font-bold text-[#FFA500] uppercase tracking-wider mb-4 flex items-center gap-2">
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
                    <h3 className="text-sm font-bold text-[#FFA500] uppercase tracking-wider mb-4 flex items-center gap-2">
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

                  <div className="border-t border-gray-700 pt-6">
                    <h3 className="text-sm font-bold text-[#FFA500] uppercase tracking-wider mb-4">
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
                                  setNovaPecaValor((sugestao.valor_corrigido || sugestao.valor_com_impostos || 0).toFixed(2));
                                  setMostrarSugestoes(false);
                                }}
                                className="p-3 hover:bg-[#00D4FF]/10 cursor-pointer border-b border-gray-800 last:border-0"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1">
                                    <p className="text-sm font-bold text-[#00D4FF]">{sugestao.pn}</p>
                                    <p className="text-xs text-gray-400 mt-1">{sugestao.descricao}</p>
                                    <div className="flex items-center gap-3 mt-2">
                                      <span className="text-[10px] text-gray-500">
                                        GSPN/NF: R$ {sugestao.valor_com_impostos?.toFixed(2) || '0.00'}
                                      </span>
                                      {sugestao.valor_corrigido && (
                                        <span className="text-[10px] text-[#39FF14]">
                                          Corrigido: R$ {sugestao.valor_corrigido.toFixed(2)}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <span className="text-xs text-gray-600">
                                    {sugestao.count} em estoque
                                  </span>
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
                      <div>
                        <label className="text-xs text-gray-400 uppercase block mb-2">
                          Valor (R$)
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          value={novaPecaValor}
                          onChange={(e) => setNovaPecaValor(e.target.value)}
                          className="neon-input w-full"
                          placeholder="0.00"
                        />
                        <p className="text-[10px] text-gray-500 mt-1">Valor GSPN/NF</p>
                      </div>
                      <div>
                        <label className="text-xs text-gray-400 uppercase block mb-2">
                          Qtd *
                        </label>
                        <div className="flex gap-2">
                          <input
                            type="number"
                            min="1"
                            value={novaPecaQuantidade}
                            onChange={(e) => setNovaPecaQuantidade(Number(e.target.value))}
                            className="neon-input w-20"
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
                                  p_quantidade_requisitada: novaPecaQuantidade,
                                  p_valor_peca: valorNumerico,
                                  p_numero_os_samsung: os?.numero_os_samsung || null
                                });

                                if (insertError) {
                                  throw insertError;
                                }

                                await supabase.from('os_comentarios').insert({
                                  os_id: osId,
                                  usuario_id: usuario?.id,
                                  comentario: `✚ Requisição adicionada: ${novaPecaDescricao} (${novaPecaCodigo}) - Qtd: ${novaPecaQuantidade}${valorNumerico ? ` - Valor: R$ ${valorNumerico.toFixed(2)}` : ''}`,
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
                    <h3 className="text-sm font-bold text-[#FFA500] uppercase tracking-wider">
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
                    <h3 className="text-sm font-bold text-[#FFA500] uppercase tracking-wider mb-4">
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

        {mode === 'create' && (
          <div className="p-6 border-t border-[#FFA500]/20">
            <div className="flex items-center justify-between mb-4">
              <div className="flex gap-4 text-xs text-gray-400">
                <div className="flex items-center gap-2">
                  <Package className="w-4 h-4 text-[#00D4FF]" />
                  <span>
                    {requisicoesTemporarias.length} requisição(ões) • {anexosTemporarios.length} anexo(s) • {comentariosTemporarios.length} comentário(s)
                  </span>
                </div>
              </div>
            </div>
            <div className="flex gap-4 justify-end">
              <button
                onClick={() => {
                  const temDados = requisicoesTemporarias.length > 0 || anexosTemporarios.length > 0 || comentariosTemporarios.length > 0 || clienteNome || defeitoRelatado;
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
                disabled={loading || !unidadeId || !numeroOSSamsung || !clienteNome || !defeitoRelatado}
                className="neon-button px-6 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: '#FFA50020',
                  borderColor: '#FFA500',
                  color: '#FFA500'
                }}
              >
                {loading ? 'CRIANDO...' : 'SALVAR OS LP'}
              </button>
            </div>
            {(!unidadeId || !numeroOSSamsung || !clienteNome || !defeitoRelatado) && (
              <div className="mt-3 flex items-center gap-2 text-xs text-yellow-400">
                <AlertCircle className="w-4 h-4" />
                <span>Preencha os campos obrigatórios: Unidade, Número OS Samsung, Nome do Cliente e Defeito Relatado</span>
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
    </div>
  );
}
