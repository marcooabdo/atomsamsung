import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Building, Users, Wrench, DollarSign, CreditCard, Plus, Edit, Trash2, Save, X, MapPin, FileText, ChevronUp, ChevronDown, FileType, Receipt } from 'lucide-react';
import { ConfiguracoesPDFOS } from '../components/ConfiguracoesPDFOS';
import { ConfiguracoesNF } from '../components/ConfiguracoesNF';

type Tab = 'unidades' | 'usuarios' | 'servicos' | 'markup' | 'taxas' | 'rotas' | 'checklists' | 'pdf_os' | 'nf';

interface Unidade {
  id: string;
  nome: string;
  cnpj: string | null;
  razao_social: string | null;
  nome_fantasia: string | null;
  inscricao_estadual: string | null;
  ie_isento: boolean;
  inscricao_municipal: string | null;
  cnae: string | null;
  telefone: string | null;
  cep: string | null;
  cidade: string | null;
  uf: string | null;
  bairro: string | null;
  rua: string | null;
  numero: string | null;
  complemento: string | null;
  endereco: string | null;
  estado: string | null;
  samsung_asccode: string | null;
  samsung_token: string | null;
  latitude: number | null;
  longitude: number | null;
  created_at: string;
}

interface Usuario {
  id: string;
  nome: string;
  email: string;
  tipo: 'master' | 'diretoria' | 'gerente' | 'administrador' | 'estoque' | 'tecnico' | 'tecnico_ih' | 'vendedor' | 'atendente';
  unidade_id: string | null;
  ativo: boolean;
  numero_tecnico: string | null;
  created_at: string;
}

interface Servico {
  id: string;
  nome: string;
  descricao: string | null;
  valor_base: number;
  linha: string | null;
  unidade_id: string | null;
  ativo: boolean;
  created_at: string;
}

interface Markup {
  id: string;
  nome: string;
  valor_minimo: number | null;
  valor_maximo: number | null;
  tipo: 'percentual' | 'multiplicador' | 'valor_fixo';
  valor: number;
  descricao: string | null;
  unidade_id: string | null;
  tipo_orcamento: 'normal' | 'acessorios' | 'samsung_contigo';
  ativo: boolean;
  created_at: string;
}

interface TaxaMaquina {
  id: string;
  parcelamento: number;
  taxa: number;
  debito: number;
  unidade_id: string | null;
  ativo: boolean;
  created_at: string;
}

interface Rota {
  id: string;
  nome: string;
  cor: string;
  cidades: string[];
  coluna_kanban: string;
  unidade_id: string | null;
  ativa: boolean;
  created_at: string;
}

interface ChecklistItem {
  ordem: number;
  texto: string;
  tipo_resposta: 'checkbox' | 'texto' | 'ambos';
}

interface ChecklistTemplate {
  id: string;
  nome: string;
  descricao: string | null;
  unidade_id: string | null;
  tipo_servico: 'IH' | 'CI' | 'geral' | 'instalacao' | 'manutencao';
  tipo_os: string[];
  tipos_atendimento: string[];
  tipo_checklist: 'ADM' | 'TÉCNICO';
  itens: ChecklistItem[];
  ativo: boolean;
  created_at: string;
}

export function Configuracoes() {
  const { usuario: usuarioLogado } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('unidades');
  const [loading, setLoading] = useState(true);

  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [servicos, setServicos] = useState<Servico[]>([]);
  const [markups, setMarkups] = useState<Markup[]>([]);
  const [taxas, setTaxas] = useState<TaxaMaquina[]>([]);
  const [rotas, setRotas] = useState<Rota[]>([]);
  const [checklists, setChecklists] = useState<ChecklistTemplate[]>([]);

  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTaxa, setEditingTaxa] = useState<string | null>(null);
  const [selectedUnidadeMarkup, setSelectedUnidadeMarkup] = useState<string>('');
  const [selectedUnidadeTaxa, setSelectedUnidadeTaxa] = useState<string>('');
  const [selectedUnidadeRota, setSelectedUnidadeRota] = useState<string>('');
  const [selectedUnidadeChecklist, setSelectedUnidadeChecklist] = useState<string>('');

  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  const [showDeleteSuccessModal, setShowDeleteSuccessModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);
  const [deleteMessage, setDeleteMessage] = useState('');

  const [formUnidade, setFormUnidade] = useState({
    nome: '',
    cnpj: '',
    razao_social: '',
    nome_fantasia: '',
    inscricao_estadual: '',
    ie_isento: false,
    inscricao_municipal: '',
    cnae: '',
    telefone: '',
    cep: '',
    cidade: '',
    uf: '',
    bairro: '',
    rua: '',
    numero: '',
    complemento: '',
    endereco: '',
    estado: '',
    samsung_asccode: '',
    samsung_token: ''
  });
  const [formUsuario, setFormUsuario] = useState({ nome: '', email: '', tipo: 'tecnico' as const, unidade_id: '', senha: '', ativo: true, numero_tecnico: '' });
  const [formServico, setFormServico] = useState({ nome: '', descricao: '', valor_base: '0', linha: '', unidade_id: '', ativo: true });
  const [formMarkup, setFormMarkup] = useState({ nome: '', valor_minimo: '', valor_maximo: '', tipo: 'percentual' as const, valor: '0', descricao: '', unidade_id: '', tipo_orcamento: 'normal' as const, ativo: true });
  const [formRota, setFormRota] = useState({ nome: '', cor: '#3b82f6', cidades: [] as string[], unidade_id: '', ativa: true });
  const [formChecklist, setFormChecklist] = useState({ nome: '', descricao: '', tipo_servico: 'geral' as const, tipo_os: ['LP', 'OW', 'NA'], tipos_atendimento: ['CI', 'IH', 'II', 'RH', 'SH', 'PS'], tipo_checklist: 'ADM' as const, unidade_id: '', itens: [] as ChecklistItem[], ativo: true });
  const [novaCidade, setNovaCidade] = useState('');
  const [novoItem, setNovoItem] = useState({ texto: '', tipo_resposta: 'checkbox' as const });

  useEffect(() => {
    loadData();
  }, [activeTab]);

  const loadData = async () => {
    setLoading(true);
    try {
      switch (activeTab) {
        case 'unidades':
          const { data: unidadesData, error: unidadesError } = await supabase
            .from('unidades')
            .select('*')
            .order('nome');
          if (unidadesError) {
            alert(`Erro ao carregar unidades: ${unidadesError.message}`);
          }
          setUnidades(unidadesData || []);
          break;
        case 'usuarios':
          let usuariosQuery = supabase
            .from('usuarios')
            .select('*');

          // Master e Diretoria veem todos os usuários
          if (usuarioLogado?.tipo === 'master' || usuarioLogado?.tipo === 'diretoria') {
            // Não aplica filtro - vê todos
          } else if (usuarioLogado?.unidade_id) {
            // Gerentes e outros veem apenas da sua unidade
            usuariosQuery = usuariosQuery.eq('unidade_id', usuarioLogado.unidade_id);
          }

          const { data: usuariosData, error: usuariosError } = await usuariosQuery.order('nome');
          if (usuariosError) {
            alert(`Erro ao carregar usuários: ${usuariosError.message}`);
          }
          setUsuarios(usuariosData || []);
          break;
        case 'servicos':
          const { data: servicosData } = await supabase
            .from('servicos')
            .select('*')
            .order('nome');
          setServicos(servicosData || []);
          break;
        case 'markup':
          const { data: markupsData } = await supabase
            .from('markup_regras')
            .select('*')
            .order('nome');
          setMarkups(markupsData || []);
          break;
        case 'taxas':
          const { data: taxasData } = await supabase
            .from('taxas_maquina')
            .select('*')
            .order('parcelamento');
          setTaxas(taxasData || []);
          break;
        case 'rotas':
          const { data: rotasData } = await supabase
            .from('rotas')
            .select('*')
            .order('nome');
          setRotas(rotasData || []);
          break;
        case 'checklists':
          const { data: checklistsData, error: checklistsError } = await supabase
            .from('checklist_templates')
            .select('*')
            .order('nome');
          if (checklistsError) {
            alert(`Erro ao carregar checklists: ${checklistsError.message}`);
          }
          setChecklists(checklistsData || []);
          break;
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleOpenModal = (id?: string) => {
    setEditingId(id || null);
    if (id) {
      switch (activeTab) {
        case 'unidades':
          const unidade = unidades.find(u => u.id === id);
          if (unidade) setFormUnidade({
            nome: unidade.nome,
            cnpj: unidade.cnpj || '',
            razao_social: unidade.razao_social || '',
            nome_fantasia: unidade.nome_fantasia || '',
            inscricao_estadual: unidade.inscricao_estadual || '',
            ie_isento: unidade.ie_isento || false,
            inscricao_municipal: unidade.inscricao_municipal || '',
            cnae: unidade.cnae || '',
            telefone: unidade.telefone || '',
            cep: unidade.cep || '',
            cidade: unidade.cidade || '',
            uf: unidade.uf || '',
            bairro: unidade.bairro || '',
            rua: unidade.rua || '',
            numero: unidade.numero || '',
            complemento: unidade.complemento || '',
            endereco: unidade.endereco || '',
            estado: unidade.estado || '',
            samsung_asccode: unidade.samsung_asccode || '',
            samsung_token: unidade.samsung_token || ''
          });
          break;
        case 'usuarios':
          const usuario = usuarios.find(u => u.id === id);
          if (usuario) setFormUsuario({ nome: usuario.nome, email: usuario.email, tipo: usuario.tipo, unidade_id: usuario.unidade_id || '', senha: '', ativo: usuario.ativo, numero_tecnico: usuario.numero_tecnico || '' });
          break;
        case 'servicos':
          const servico = servicos.find(s => s.id === id);
          if (servico) setFormServico({ nome: servico.nome, descricao: servico.descricao || '', valor_base: servico.valor_base.toString(), linha: servico.linha || '', unidade_id: servico.unidade_id || '', ativo: servico.ativo });
          break;
        case 'markup':
          const markup = markups.find(m => m.id === id);
          if (markup) setFormMarkup({ nome: markup.nome, valor_minimo: markup.valor_minimo?.toString() || '', valor_maximo: markup.valor_maximo?.toString() || '', tipo: markup.tipo, valor: markup.valor.toString(), descricao: markup.descricao || '', unidade_id: markup.unidade_id || '', tipo_orcamento: markup.tipo_orcamento || 'normal', ativo: markup.ativo });
          break;
        case 'rotas':
          const rota = rotas.find(r => r.id === id);
          if (rota) setFormRota({ nome: rota.nome, cor: rota.cor, cidades: rota.cidades || [], unidade_id: rota.unidade_id || '', ativa: rota.ativa });
          break;
        case 'checklists':
          const checklist = checklists.find(c => c.id === id);
          if (checklist) setFormChecklist({ nome: checklist.nome, descricao: checklist.descricao || '', tipo_servico: checklist.tipo_servico, tipo_os: checklist.tipo_os || ['LP', 'OW', 'NA'], tipos_atendimento: checklist.tipos_atendimento || ['CI', 'IH', 'II', 'RH', 'SH', 'PS'], tipo_checklist: checklist.tipo_checklist || 'ADM', unidade_id: checklist.unidade_id || '', itens: checklist.itens || [], ativo: checklist.ativo });
          break;
      }
    } else {
      setFormUnidade({
        nome: '',
        cnpj: '',
        razao_social: '',
        nome_fantasia: '',
        inscricao_estadual: '',
        ie_isento: false,
        inscricao_municipal: '',
        cnae: '',
        telefone: '',
        cep: '',
        cidade: '',
        uf: '',
        bairro: '',
        rua: '',
        numero: '',
        complemento: '',
        endereco: '',
        estado: '',
        samsung_asccode: '',
        samsung_token: ''
      });
      // Master e Diretoria podem escolher qualquer unidade, outros ficam restritos à sua unidade
      const defaultUnidadeId = (usuarioLogado?.tipo === 'master' || usuarioLogado?.tipo === 'diretoria') ? '' : (usuarioLogado?.unidade_id || '');
      setFormUsuario({ nome: '', email: '', tipo: 'tecnico', unidade_id: defaultUnidadeId, senha: '', ativo: true, numero_tecnico: '' });
      setFormServico({ nome: '', descricao: '', valor_base: '0', linha: '', unidade_id: '', ativo: true });
      setFormMarkup({ nome: '', valor_minimo: '', valor_maximo: '', tipo: 'percentual', valor: '0', descricao: '', unidade_id: '', tipo_orcamento: 'normal', ativo: true });
      setFormRota({ nome: '', cor: '#3b82f6', cidades: [], unidade_id: selectedUnidadeRota, ativa: true });
      setFormChecklist({ nome: '', descricao: '', tipo_servico: 'geral', tipo_os: ['LP', 'OW', 'NA'], tipos_atendimento: ['CI', 'IH', 'II', 'RH', 'SH', 'PS'], tipo_checklist: 'ADM', unidade_id: selectedUnidadeChecklist, itens: [], ativo: true });
    }
    setShowModal(true);
  };

  const buscarCEPUnidade = async (cep: string) => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cepLimpo}/json/`);
      const data = await response.json();

      if (!data.erro) {
        setFormUnidade({
          ...formUnidade,
          cep: cep,
          rua: data.logradouro || '',
          bairro: data.bairro || '',
          cidade: data.localidade || '',
          uf: data.uf || '',
          complemento: data.complemento || ''
        });
      }
    } catch (error) {
    }
  };

  const handleSave = async () => {
    try {
      switch (activeTab) {
        case 'unidades':
          if (!formUnidade.nome.trim()) return alert('Nome é obrigatório');
          const unidadeData = {
            nome: formUnidade.nome,
            cnpj: formUnidade.cnpj || null,
            razao_social: formUnidade.razao_social || null,
            nome_fantasia: formUnidade.nome_fantasia || null,
            inscricao_estadual: formUnidade.ie_isento ? null : (formUnidade.inscricao_estadual || null),
            ie_isento: formUnidade.ie_isento,
            inscricao_municipal: formUnidade.inscricao_municipal || null,
            cnae: formUnidade.cnae || null,
            telefone: formUnidade.telefone || null,
            cep: formUnidade.cep || null,
            cidade: formUnidade.cidade || null,
            uf: formUnidade.uf || null,
            bairro: formUnidade.bairro || null,
            rua: formUnidade.rua || null,
            numero: formUnidade.numero || null,
            complemento: formUnidade.complemento || null,
            endereco: formUnidade.rua || null,
            estado: formUnidade.uf || null,
            samsung_asccode: formUnidade.samsung_asccode || null,
            samsung_token: formUnidade.samsung_token || null
          };
          if (editingId) {
            const { error } = await supabase.from('unidades').update(unidadeData).eq('id', editingId);
            if (error) throw error;
          } else {
            const { error } = await supabase.from('unidades').insert(unidadeData);
            if (error) throw error;
          }
          break;
        case 'usuarios':
          if (!formUsuario.nome.trim() || !formUsuario.email.trim()) return alert('Nome e email são obrigatórios');
          if (!formUsuario.unidade_id && formUsuario.tipo !== 'master' && formUsuario.tipo !== 'diretoria') {
            return alert('Unidade é obrigatória para este tipo de usuário');
          }

          // Validar que apenas gerentes e administradores têm restrição de unidade
          if (usuarioLogado?.tipo !== 'master' && usuarioLogado?.tipo !== 'diretoria') {
            if (formUsuario.unidade_id !== usuarioLogado?.unidade_id) {
              return alert('Você só pode gerenciar usuários da sua unidade');
            }
          }

          let session = (await supabase.auth.getSession()).data.session;

          if (!session || !session.access_token) {
            const refreshResult = await supabase.auth.refreshSession();
            session = refreshResult.data.session;
          }

          if (!session || !session.access_token) {
            alert('Sessão expirada. Faça login novamente.');
            return;
          }

          const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-user`;
          const headers = {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          };

          if (editingId) {
            const requestBody: any = {
              action: 'update',
              user_id: editingId,
              nome: formUsuario.nome,
              email: formUsuario.email,
              tipo: formUsuario.tipo,
              unidade_id: formUsuario.unidade_id || null,
              ativo: formUsuario.ativo,
              numero_tecnico: formUsuario.numero_tecnico || null
            };
            if (formUsuario.senha) requestBody.senha = formUsuario.senha;

            const response = await fetch(apiUrl, {
              method: 'POST',
              headers,
              body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
              const errorData = await response.json();
              console.error('Erro da API:', errorData);
              throw new Error(errorData.error || errorData.details || 'Erro ao atualizar usuário');
            }

            const result = await response.json();
            if (!result.success) {
              console.error('Erro no resultado:', result);
              throw new Error(result.error || result.details || 'Erro ao atualizar usuário');
            }
          } else {
            if (!formUsuario.senha) return alert('Senha é obrigatória para novo usuário');

            const requestBody = {
              action: 'create',
              nome: formUsuario.nome,
              email: formUsuario.email,
              senha: formUsuario.senha,
              tipo: formUsuario.tipo,
              unidade_id: formUsuario.unidade_id || null,
              ativo: formUsuario.ativo,
              numero_tecnico: formUsuario.numero_tecnico || null
            };

            const response = await fetch(apiUrl, {
              method: 'POST',
              headers,
              body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
              const errorData = await response.json();
              console.error('Erro da API:', errorData);
              throw new Error(errorData.error || errorData.details || 'Erro ao criar usuário');
            }

            const result = await response.json();
            if (!result.success) {
              console.error('Erro no resultado:', result);
              throw new Error(result.error || result.details || 'Erro ao criar usuário');
            }
          }
          break;
        case 'servicos':
          if (!formServico.nome.trim()) return alert('Nome é obrigatório');
          if (!formServico.linha) return alert('Linha do produto é obrigatória');
          const servicoData = {
            nome: formServico.nome,
            descricao: formServico.descricao || null,
            valor_base: parseFloat(formServico.valor_base) || 0,
            linha: formServico.linha || null,
            unidade_id: formServico.unidade_id || null,
            ativo: formServico.ativo
          };
          if (editingId) {
            const { error } = await supabase.from('servicos').update(servicoData).eq('id', editingId);
            if (error) throw error;
          } else {
            const { error } = await supabase.from('servicos').insert(servicoData);
            if (error) throw error;
          }
          break;
        case 'markup':
          if (!formMarkup.nome.trim()) return alert('Nome é obrigatório');
          const markupData = {
            nome: formMarkup.nome,
            valor_minimo: formMarkup.valor_minimo ? parseFloat(formMarkup.valor_minimo) : null,
            valor_maximo: formMarkup.valor_maximo ? parseFloat(formMarkup.valor_maximo) : null,
            tipo: formMarkup.tipo,
            valor: parseFloat(formMarkup.valor) || 0,
            descricao: formMarkup.descricao || null,
            unidade_id: formMarkup.unidade_id || null,
            tipo_orcamento: formMarkup.tipo_orcamento || 'normal',
            ativo: formMarkup.ativo
          };
          if (editingId) {
            const { error } = await supabase.from('markup_regras').update(markupData).eq('id', editingId);
            if (error) throw error;
          } else {
            const { error } = await supabase.from('markup_regras').insert(markupData);
            if (error) throw error;
          }
          break;
        case 'rotas':
          if (!formRota.nome.trim()) return alert('Nome da rota é obrigatório');

          // Determinar coluna_kanban baseado no nome da rota
          let coluna_kanban = '';
          if (formRota.nome.toLowerCase().includes('preta')) coluna_kanban = 'rota_preta';
          else if (formRota.nome.toLowerCase().includes('vermelha')) coluna_kanban = 'rota_vermelha';
          else if (formRota.nome.toLowerCase().includes('azul')) coluna_kanban = 'rota_azul';
          else if (formRota.nome.toLowerCase().includes('verde')) coluna_kanban = 'rota_verde';
          else if (formRota.nome.toLowerCase().includes('rosa')) coluna_kanban = 'rota_rosa';
          else if (formRota.nome.toLowerCase().includes('amarela')) coluna_kanban = 'rota_amarela';
          else if (formRota.nome.toLowerCase().includes('laranja')) coluna_kanban = 'rota_laranja';

          const rotaData = {
            nome: formRota.nome,
            cor: formRota.cor,
            cidades: formRota.cidades,
            coluna_kanban,
            unidade_id: formRota.unidade_id || null,
            ativa: formRota.ativa
          };
          if (editingId) {
            const { error } = await supabase.from('rotas').update(rotaData).eq('id', editingId);
            if (error) throw error;
          } else {
            const { error } = await supabase.from('rotas').insert(rotaData);
            if (error) throw error;
          }
          break;
        case 'checklists':
          if (!formChecklist.nome.trim()) return alert('Nome do checklist é obrigatório');
          if (formChecklist.itens.length === 0) return alert('Adicione pelo menos um item ao checklist');

          const checklistData = {
            nome: formChecklist.nome,
            descricao: formChecklist.descricao || null,
            tipo_servico: formChecklist.tipo_servico,
            tipo_os: formChecklist.tipo_os,
            tipos_atendimento: formChecklist.tipos_atendimento,
            tipo_checklist: formChecklist.tipo_checklist,
            unidade_id: formChecklist.unidade_id || null,
            itens: formChecklist.itens,
            ativo: formChecklist.ativo
          };
          if (editingId) {
            const { error } = await supabase.from('checklist_templates').update(checklistData).eq('id', editingId);
            if (error) throw error;
          } else {
            const { error } = await supabase.from('checklist_templates').insert(checklistData);
            if (error) throw error;
          }
          break;
      }
      setShowModal(false);
      loadData();
    } catch (error: any) {
      alert(`Erro ao salvar: ${error.message || 'Erro desconhecido'}`);
    }
  };

  const handleDelete = async (id: string, table: string) => {
    if (!confirm('Tem certeza que deseja excluir este item?')) {
      return;
    }

    try {
      const { error } = await supabase.from(table).delete().eq('id', id);
      if (error) throw error;
      loadData();
    } catch (error) {
      alert('Erro ao excluir item');
    }
  };

  // Função específica para excluir MARKUP sem confirmação
  const handleDeleteMarkup = async (id: string) => {
    try {
      const { error } = await supabase.from('markup_regras').delete().eq('id', id);
      if (error) throw error;
      loadData();
    } catch (error) {
      alert('Erro ao excluir markup');
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setUserToDelete(userId);
    setShowDeleteConfirmModal(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    setShowDeleteConfirmModal(false);

    try {
      let session = (await supabase.auth.getSession()).data.session;

      if (!session || !session.access_token) {
        const refreshResult = await supabase.auth.refreshSession();
        session = refreshResult.data.session;
      }

      if (!session || !session.access_token) {
        setDeleteMessage('Sessão expirada. Faça login novamente.');
        setShowDeleteSuccessModal(true);
        return;
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/manage-user`;

      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'delete',
          user_id: userToDelete
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao excluir usuário');
      }

      const result = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Erro ao excluir usuário');
      }

      setDeleteMessage('Usuário excluído com sucesso!');
      setShowDeleteSuccessModal(true);
      loadData();
    } catch (error: any) {
      setDeleteMessage(`Erro ao excluir usuário: ${error.message || 'Erro desconhecido'}`);
      setShowDeleteSuccessModal(true);
    } finally {
      setUserToDelete(null);
    }
  };

  const handleSaveTaxa = async (id: string, taxa: number, debito: number) => {
    try {
      await supabase.from('taxas_maquina').update({ taxa, debito }).eq('id', id);
      setEditingTaxa(null);
      loadData();
      alert('Taxa salva com sucesso!');
    } catch (error) {
      alert('Erro ao salvar taxa');
    }
  };

  const saveTaxaFromInputs = (taxaId: string) => {
    const inputCredito = document.getElementById(`taxa-${taxaId}`) as HTMLInputElement;
    const inputDebito = document.getElementById(`debito-${taxaId}`) as HTMLInputElement;
    handleSaveTaxa(
      taxaId,
      parseFloat(inputCredito.value) || 0,
      parseFloat(inputDebito?.value || '0') || 0
    );
  };

  const criarTaxasPadrao = async (unidadeId: string) => {
    try {
      const taxasPadrao = [];
      for (let i = 1; i <= 12; i++) {
        taxasPadrao.push({
          parcelamento: i,
          taxa: 0,
          debito: i === 1 ? 0 : null,
          unidade_id: unidadeId,
          ativo: true
        });
      }

      const { error } = await supabase.from('taxas_maquina').insert(taxasPadrao);
      if (error) throw error;

      alert('Taxas criadas com sucesso! Agora configure os valores para cada parcelamento.');
      loadData();
    } catch (error: any) {
      alert(`Erro ao criar taxas: ${error.message || 'Erro desconhecido'}`);
    }
  };

  const allTabs = [
    { id: 'unidades' as Tab, label: 'Unidades', icon: Building, color: '#00D4FF' },
    { id: 'usuarios' as Tab, label: 'Usuários', icon: Users, color: '#39FF14', onlyFor: ['master', 'diretoria', 'gerente'] },
    { id: 'servicos' as Tab, label: 'Serviços', icon: Wrench, color: '#FFBF00' },
    { id: 'markup' as Tab, label: 'Markup', icon: DollarSign, color: '#FF0064' },
    { id: 'taxas' as Tab, label: 'Taxa Máquina', icon: CreditCard, color: '#9D4EDD' },
    { id: 'rotas' as Tab, label: 'Rotas', icon: MapPin, color: '#10b981' },
    { id: 'checklists' as Tab, label: 'Checklists', icon: FileText, color: '#3b82f6' },
    { id: 'pdf_os' as Tab, label: 'PDF da OS', icon: FileType, color: '#8B5CF6' },
    { id: 'nf' as Tab, label: 'Nota Fiscal', icon: Receipt, color: '#f59e0b' }
  ];

  const tabs = allTabs.filter(tab => {
    if (!tab.onlyFor) return true;
    return usuarioLogado && tab.onlyFor.includes(usuarioLogado.tipo);
  });

  return (
    <>
      {showModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="premium-card w-full max-w-2xl my-8 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-[#00D4FF]/20">
              <h2 className="tech-heading text-lg text-[#00D4FF]">
                {editingId ? 'EDITAR' : 'ADICIONAR'} {tabs.find(t => t.id === activeTab)?.label.toUpperCase()}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-[#00D4FF]/10 rounded-lg">
                <X className="w-5 h-5 text-[#00D4FF]" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              {activeTab === 'unidades' && (
                <>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-2">Nome da Unidade *</label>
                    <input type="text" value={formUnidade.nome} onChange={(e) => setFormUnidade({...formUnidade, nome: e.target.value})} placeholder="Ex: Matriz, Filial Centro" className="neon-input" />
                  </div>

                  <div className="border-t border-gray-700 pt-4 mt-4">
                    <h3 className="text-sm font-semibold text-[#00D4FF] mb-4 uppercase flex items-center gap-2">
                      <Building className="w-4 h-4" />
                      Dados Fiscais
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                      <div>
                        <label className="block text-xs text-gray-400 uppercase mb-2">CNPJ</label>
                        <input
                          type="text"
                          value={formUnidade.cnpj}
                          onChange={(e) => setFormUnidade({...formUnidade, cnpj: e.target.value})}
                          placeholder="00.000.000/0000-00"
                          className="neon-input"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 uppercase mb-2">Razão Social</label>
                        <input
                          type="text"
                          value={formUnidade.razao_social}
                          onChange={(e) => setFormUnidade({...formUnidade, razao_social: e.target.value})}
                          placeholder="Razão Social da Empresa"
                          className="neon-input"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 uppercase mb-2">Nome Fantasia</label>
                        <input
                          type="text"
                          value={formUnidade.nome_fantasia}
                          onChange={(e) => setFormUnidade({...formUnidade, nome_fantasia: e.target.value})}
                          placeholder="Nome Fantasia"
                          className="neon-input"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-gray-400 uppercase mb-2">Inscrição Estadual</label>
                          <input
                            type="text"
                            value={formUnidade.inscricao_estadual}
                            onChange={(e) => setFormUnidade({...formUnidade, inscricao_estadual: e.target.value})}
                            placeholder="000.000.000.000"
                            disabled={formUnidade.ie_isento}
                            className="neon-input disabled:opacity-50 disabled:bg-gray-800"
                          />
                        </div>
                        <div className="flex items-end pb-2">
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formUnidade.ie_isento}
                              onChange={(e) => setFormUnidade({...formUnidade, ie_isento: e.target.checked, inscricao_estadual: e.target.checked ? '' : formUnidade.inscricao_estadual})}
                              className="w-4 h-4 rounded border-gray-600 bg-gray-800 text-[#00D4FF] focus:ring-[#00D4FF]"
                            />
                            <span className="text-sm text-gray-300">IE Isento</span>
                          </label>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs text-gray-400 uppercase mb-2">Inscrição Municipal</label>
                          <input
                            type="text"
                            value={formUnidade.inscricao_municipal}
                            onChange={(e) => setFormUnidade({...formUnidade, inscricao_municipal: e.target.value})}
                            placeholder="0000000"
                            className="neon-input"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 uppercase mb-2">CNAE</label>
                          <input
                            type="text"
                            value={formUnidade.cnae}
                            onChange={(e) => setFormUnidade({...formUnidade, cnae: e.target.value})}
                            placeholder="0000-0/00"
                            className="neon-input"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 uppercase mb-2">Telefone</label>
                        <input
                          type="text"
                          value={formUnidade.telefone}
                          onChange={(e) => setFormUnidade({...formUnidade, telefone: e.target.value})}
                          placeholder="(00) 00000-0000"
                          className="neon-input"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-700 pt-4 mt-4">
                    <h3 className="text-sm font-semibold text-[#00D4FF] mb-4 uppercase flex items-center gap-2">
                      <MapPin className="w-4 h-4" />
                      Endereço
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                          <label className="block text-xs text-gray-400 uppercase mb-2">CEP</label>
                          <input
                            type="text"
                            value={formUnidade.cep}
                            onChange={(e) => setFormUnidade({...formUnidade, cep: e.target.value})}
                            onBlur={(e) => buscarCEPUnidade(e.target.value)}
                            placeholder="00000-000"
                            className="neon-input"
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                          <label className="block text-xs text-gray-400 uppercase mb-2">Rua/Logradouro</label>
                          <input
                            type="text"
                            value={formUnidade.rua}
                            onChange={(e) => setFormUnidade({...formUnidade, rua: e.target.value})}
                            placeholder="Rua, Avenida, etc"
                            className="neon-input"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 uppercase mb-2">Número</label>
                          <input
                            type="text"
                            value={formUnidade.numero}
                            onChange={(e) => setFormUnidade({...formUnidade, numero: e.target.value})}
                            placeholder="123"
                            className="neon-input"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 uppercase mb-2">Complemento</label>
                        <input
                          type="text"
                          value={formUnidade.complemento}
                          onChange={(e) => setFormUnidade({...formUnidade, complemento: e.target.value})}
                          placeholder="Sala, Andar, Bloco, etc"
                          className="neon-input"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 uppercase mb-2">Bairro</label>
                        <input
                          type="text"
                          value={formUnidade.bairro}
                          onChange={(e) => setFormUnidade({...formUnidade, bairro: e.target.value})}
                          placeholder="Nome do bairro"
                          className="neon-input"
                        />
                      </div>
                      <div className="grid grid-cols-3 gap-4">
                        <div className="col-span-2">
                          <label className="block text-xs text-gray-400 uppercase mb-2">Cidade</label>
                          <input
                            type="text"
                            value={formUnidade.cidade}
                            onChange={(e) => setFormUnidade({...formUnidade, cidade: e.target.value})}
                            placeholder="Nome da cidade"
                            className="neon-input"
                          />
                        </div>
                        <div>
                          <label className="block text-xs text-gray-400 uppercase mb-2">UF</label>
                          <input
                            type="text"
                            value={formUnidade.uf}
                            onChange={(e) => setFormUnidade({...formUnidade, uf: e.target.value.toUpperCase()})}
                            maxLength={2}
                            placeholder="SP"
                            className="neon-input uppercase"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-700 pt-4 mt-4">
                    <h3 className="text-sm font-semibold text-[#00D4FF] mb-4 uppercase">Integração Samsung GSPN</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-400 uppercase mb-2">ASC Code</label>
                        <input
                          type="text"
                          value={formUnidade.samsung_asccode}
                          onChange={(e) => setFormUnidade({...formUnidade, samsung_asccode: e.target.value})}
                          placeholder="Código ASC Samsung"
                          className="neon-input"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 uppercase mb-2">Token API</label>
                        <input
                          type="password"
                          value={formUnidade.samsung_token}
                          onChange={(e) => setFormUnidade({...formUnidade, samsung_token: e.target.value})}
                          placeholder="Token de integração"
                          className="neon-input"
                        />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {activeTab === 'usuarios' && (
                <>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-2">Nome *</label>
                    <input type="text" value={formUsuario.nome} onChange={(e) => setFormUsuario({...formUsuario, nome: e.target.value})} placeholder="Nome completo" className="neon-input" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-2">Email *</label>
                    <input type="email" value={formUsuario.email} onChange={(e) => setFormUsuario({...formUsuario, email: e.target.value})} placeholder="email@exemplo.com" className="neon-input" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-2">
                      Senha {editingId ? '(deixe em branco para não alterar)' : '*'}
                    </label>
                    <input type="password" value={formUsuario.senha} onChange={(e) => setFormUsuario({...formUsuario, senha: e.target.value})} placeholder="••••••••" className="neon-input" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-2">Tipo de Usuário *</label>
                    <select value={formUsuario.tipo} onChange={(e) => setFormUsuario({...formUsuario, tipo: e.target.value as any})} className="neon-input">
                      {usuarioLogado?.tipo !== 'gerente' && <option value="master">Master</option>}
                      {usuarioLogado?.tipo !== 'gerente' && <option value="diretoria">Diretoria</option>}
                      <option value="gerente">Gerente</option>
                      <option value="administrador">Administrador</option>
                      <option value="estoque">Estoque</option>
                      <option value="tecnico">Técnico</option>
                      <option value="tecnico_ih">Técnico IH</option>
                      <option value="vendedor">Vendedor</option>
                      <option value="atendente">Atendente</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {formUsuario.tipo === 'master' && 'Acesso total ao sistema e todas as unidades'}
                      {formUsuario.tipo === 'diretoria' && 'Acesso a todas unidades, exceto usuários Master'}
                      {formUsuario.tipo === 'gerente' && 'Gerencia todos usuários e dados da sua unidade'}
                      {formUsuario.tipo === 'administrador' && 'Gerencia usuários (exceto Gerente) e OS da sua unidade'}
                      {formUsuario.tipo === 'estoque' && 'Acesso aos dados de estoque da sua unidade'}
                      {formUsuario.tipo === 'tecnico' && 'Acesso às OS e dados da sua unidade'}
                      {formUsuario.tipo === 'tecnico_ih' && 'Acesso às OS IH e dados da sua unidade'}
                      {formUsuario.tipo === 'vendedor' && 'Acesso a cotações e vendas da sua unidade'}
                      {formUsuario.tipo === 'atendente' && 'Acesso a atendimento e dados da sua unidade'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-2">Número do Técnico</label>
                    <input type="text" value={formUsuario.numero_tecnico} onChange={(e) => setFormUsuario({...formUsuario, numero_tecnico: e.target.value})} placeholder="Ex: TEC001, 12345" className="neon-input" />
                    <p className="text-xs text-gray-500 mt-1">
                      Número de cadastro/registro do técnico (opcional)
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-2">
                      Unidade {(formUsuario.tipo !== 'master' && formUsuario.tipo !== 'diretoria') && '*'}
                    </label>
                    <select
                      value={formUsuario.unidade_id}
                      onChange={(e) => setFormUsuario({...formUsuario, unidade_id: e.target.value})}
                      disabled={usuarioLogado?.tipo !== 'master' && usuarioLogado?.tipo !== 'diretoria'}
                      className="neon-input disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {(formUsuario.tipo === 'master' || formUsuario.tipo === 'diretoria') && (
                        <option value="">Todas as Unidades</option>
                      )}
                      {(formUsuario.tipo !== 'master' && formUsuario.tipo !== 'diretoria') && (
                        <option value="">Selecione uma unidade</option>
                      )}
                      {unidades.map(u => (
                        <option key={u.id} value={u.id}>{u.nome}</option>
                      ))}
                    </select>
                    {(formUsuario.tipo === 'master' || formUsuario.tipo === 'diretoria') && (
                      <p className="text-xs text-gray-500 mt-1">
                        Deixe "Todas as Unidades" para acesso irrestrito ou selecione uma unidade específica
                      </p>
                    )}
                    {(usuarioLogado?.tipo !== 'master' && usuarioLogado?.tipo !== 'diretoria') && (
                      <p className="text-xs text-yellow-500 mt-1">
                        A unidade está bloqueada pois você só pode gerenciar usuários da sua unidade
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="ativo" checked={formUsuario.ativo} onChange={(e) => setFormUsuario({...formUsuario, ativo: e.target.checked})} className="w-4 h-4" />
                    <label htmlFor="ativo" className="text-sm text-gray-300">Usuário Ativo</label>
                  </div>
                </>
              )}

              {activeTab === 'servicos' && (
                <>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-2">Nome *</label>
                    <input type="text" value={formServico.nome} onChange={(e) => setFormServico({...formServico, nome: e.target.value})} placeholder="Ex: Instalação" className="neon-input" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-2">Descrição</label>
                    <textarea value={formServico.descricao} onChange={(e) => setFormServico({...formServico, descricao: e.target.value})} rows={2} placeholder="Descrição detalhada do serviço" className="neon-input" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-2">Linha do Produto *</label>
                    <select value={formServico.linha} onChange={(e) => setFormServico({...formServico, linha: e.target.value})} className="neon-input">
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
                    <p className="text-xs text-gray-500 mt-1">Este servico so aparecera em OS com esta linha selecionada</p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-2">Valor Base (R$)</label>
                    <input type="number" min="0" step="0.01" value={formServico.valor_base} onChange={(e) => setFormServico({...formServico, valor_base: e.target.value})} placeholder="0.00" className="neon-input" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-2">Unidade</label>
                    <select value={formServico.unidade_id} onChange={(e) => setFormServico({...formServico, unidade_id: e.target.value})} className="neon-input">
                      <option value="">Global (Todas as unidades)</option>
                      {unidades.map(u => (
                        <option key={u.id} value={u.id}>{u.nome}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Deixe "Global" para disponibilizar em todas as unidades</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="ativo-servico" checked={formServico.ativo} onChange={(e) => setFormServico({...formServico, ativo: e.target.checked})} className="w-4 h-4" />
                    <label htmlFor="ativo-servico" className="text-sm text-gray-300">Serviço Ativo</label>
                  </div>
                </>
              )}

              {activeTab === 'markup' && (
                <>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-2">Nome *</label>
                    <input type="text" value={formMarkup.nome} onChange={(e) => setFormMarkup({...formMarkup, nome: e.target.value})} placeholder="Ex: Até R$ 100" className="neon-input" />
                  </div>

                  <div className="premium-card p-4 bg-[#FF0064]/5 border border-[#FF0064]/20">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Faixa de Preço</p>
                    <p className="text-sm text-gray-300 mb-3">
                      Defina a faixa de valores onde este markup será aplicado. Deixe vazio para sem limite.
                    </p>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-gray-400 mb-2">Valor Mínimo (R$)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formMarkup.valor_minimo}
                          onChange={(e) => setFormMarkup({...formMarkup, valor_minimo: e.target.value})}
                          placeholder="0.00"
                          className="neon-input"
                        />
                        <p className="text-xs text-gray-500 mt-1">Vazio = sem mínimo</p>
                      </div>
                      <div>
                        <label className="block text-xs text-gray-400 mb-2">Valor Máximo (R$)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={formMarkup.valor_maximo}
                          onChange={(e) => setFormMarkup({...formMarkup, valor_maximo: e.target.value})}
                          placeholder="∞"
                          className="neon-input"
                        />
                        <p className="text-xs text-gray-500 mt-1">Vazio = sem máximo</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-2">Tipo de Markup</label>
                    <select value={formMarkup.tipo} onChange={(e) => setFormMarkup({...formMarkup, tipo: e.target.value as any})} className="neon-input">
                      <option value="percentual">Percentual (%)</option>
                      <option value="multiplicador">Multiplicador (×)</option>
                      <option value="valor_fixo">Valor Fixo (R$)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-2">Valor do Markup</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formMarkup.valor}
                      onChange={(e) => setFormMarkup({...formMarkup, valor: e.target.value})}
                      placeholder={
                        formMarkup.tipo === 'percentual' ? '50' :
                        formMarkup.tipo === 'multiplicador' ? '1.5' :
                        '25.00'
                      }
                      className="neon-input"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      {formMarkup.tipo === 'percentual' && 'Percentual a adicionar (ex: 50 = +50%)'}
                      {formMarkup.tipo === 'multiplicador' && 'Multiplicador (ex: 1.5 = valor × 1.5)'}
                      {formMarkup.tipo === 'valor_fixo' && 'Valor fixo em reais a adicionar'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-2">Descrição</label>
                    <textarea value={formMarkup.descricao} onChange={(e) => setFormMarkup({...formMarkup, descricao: e.target.value})} rows={2} placeholder="Descrição opcional da regra" className="neon-input" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-2">Unidade</label>
                    <select
                      value={formMarkup.unidade_id || ''}
                      onChange={(e) => setFormMarkup({...formMarkup, unidade_id: e.target.value || ''})}
                      className="neon-input"
                    >
                      <option value="">Global (Todas as unidades)</option>
                      {unidades.map(u => (
                        <option key={u.id} value={u.id}>{u.nome}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {formMarkup.unidade_id ? 'Markup será aplicado apenas para esta unidade' : 'Markup global será aplicado para todas as unidades'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-2">Tipo de Orçamento *</label>
                    <select
                      value={formMarkup.tipo_orcamento || 'normal'}
                      onChange={(e) => setFormMarkup({...formMarkup, tipo_orcamento: e.target.value as 'normal' | 'acessorios' | 'samsung_contigo'})}
                      className="neon-input"
                      style={{
                        backgroundColor: formMarkup.tipo_orcamento === 'samsung_contigo' ? '#FFA50010' : undefined,
                        borderColor: formMarkup.tipo_orcamento === 'samsung_contigo' ? '#FFA500' : undefined
                      }}
                    >
                      <option value="normal">Orçamento Normal</option>
                      <option value="acessorios">Acessórios</option>
                      <option value="samsung_contigo">Samsung Contigo</option>
                    </select>
                    {formMarkup.tipo_orcamento === 'samsung_contigo' && (
                      <p className="text-xs text-[#FFA500] mt-1">
                        🏷️ Samsung Contigo: Orçamento com markup diferenciado
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="checkbox" id="ativo-markup" checked={formMarkup.ativo} onChange={(e) => setFormMarkup({...formMarkup, ativo: e.target.checked})} className="w-4 h-4" />
                    <label htmlFor="ativo-markup" className="text-sm text-gray-300">Regra Ativa</label>
                  </div>
                </>
              )}

              {activeTab === 'rotas' && (
                <>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-2">Nome da Rota *</label>
                    <input
                      type="text"
                      value={formRota.nome}
                      onChange={(e) => setFormRota({...formRota, nome: e.target.value})}
                      placeholder="Ex: Rota Azul"
                      className="neon-input"
                    />
                    <p className="text-xs text-gray-500 mt-1">Deve conter uma das cores: Preta, Vermelha, Azul, Verde, Rosa, Amarela ou Laranja</p>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-2">Cor de Identificação</label>
                    <div className="flex items-center gap-3">
                      <input
                        type="color"
                        value={formRota.cor}
                        onChange={(e) => setFormRota({...formRota, cor: e.target.value})}
                        className="w-20 h-10 rounded cursor-pointer border border-[#00D4FF]/30"
                      />
                      <input
                        type="text"
                        value={formRota.cor}
                        onChange={(e) => setFormRota({...formRota, cor: e.target.value})}
                        placeholder="#3b82f6"
                        className="neon-input flex-1"
                      />
                    </div>
                  </div>

                  <div className="premium-card p-4 bg-[#10b981]/5 border border-[#10b981]/20">
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-3">Cidades desta Rota</label>

                    <div className="flex gap-2 mb-3">
                      <input
                        type="text"
                        value={novaCidade}
                        onChange={(e) => setNovaCidade(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && novaCidade.trim()) {
                            e.preventDefault();
                            if (!formRota.cidades.includes(novaCidade.trim())) {
                              setFormRota({...formRota, cidades: [...formRota.cidades, novaCidade.trim()]});
                              setNovaCidade('');
                            } else {
                              alert('Cidade já adicionada!');
                            }
                          }
                        }}
                        placeholder="Digite o nome da cidade e pressione Enter"
                        className="neon-input flex-1"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          if (novaCidade.trim()) {
                            if (!formRota.cidades.includes(novaCidade.trim())) {
                              setFormRota({...formRota, cidades: [...formRota.cidades, novaCidade.trim()]});
                              setNovaCidade('');
                            } else {
                              alert('Cidade já adicionada!');
                            }
                          }
                        }}
                        className="neon-button px-4"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {formRota.cidades.length > 0 ? (
                      <div className="space-y-2">
                        {formRota.cidades.map((cidade, index) => (
                          <div key={index} className="flex items-center justify-between bg-[#0A0F1E] p-2 rounded border border-[#00D4FF]/20">
                            <span className="text-sm text-gray-300">{cidade}</span>
                            <button
                              type="button"
                              onClick={() => {
                                setFormRota({
                                  ...formRota,
                                  cidades: formRota.cidades.filter((_, i) => i !== index)
                                });
                              }}
                              className="p-1 hover:bg-red-500/20 rounded transition-colors"
                            >
                              <X className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-4">Nenhuma cidade adicionada</p>
                    )}
                  </div>

                  <div className="premium-card p-3 bg-[#00D4FF]/5 border border-[#00D4FF]/20">
                    <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">Unidade</p>
                    <p className="text-sm text-[#00D4FF] font-semibold">
                      {formRota.unidade_id ? unidades.find(u => u.id === formRota.unidade_id)?.nome : 'Nenhuma'}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      Esta rota pertence exclusivamente a esta unidade. Cada unidade tem suas próprias 7 rotas.
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="ativa-rota"
                      checked={formRota.ativa}
                      onChange={(e) => setFormRota({...formRota, ativa: e.target.checked})}
                      className="w-4 h-4"
                    />
                    <label htmlFor="ativa-rota" className="text-sm text-gray-300">Rota Ativa</label>
                  </div>
                </>
              )}

              {activeTab === 'checklists' && (
                <>
                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-2">Nome do Checklist *</label>
                    <input
                      type="text"
                      value={formChecklist.nome}
                      onChange={(e) => setFormChecklist({...formChecklist, nome: e.target.value})}
                      placeholder="Ex: Checklist IH Padrão"
                      className="neon-input"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-2">Descrição</label>
                    <textarea
                      value={formChecklist.descricao}
                      onChange={(e) => setFormChecklist({...formChecklist, descricao: e.target.value})}
                      placeholder="Descrição do checklist..."
                      className="neon-input h-20 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-2">Tipo de Checklist *</label>
                    <select
                      value={formChecklist.tipo_checklist}
                      onChange={(e) => setFormChecklist({...formChecklist, tipo_checklist: e.target.value as 'ADM' | 'TÉCNICO'})}
                      className="neon-input"
                    >
                      <option value="ADM">ADM (Administrativo - aparece na OS)</option>
                      <option value="TÉCNICO">TÉCNICO (aparece no Agendamento)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-2">Tipo de OS *</label>
                    <div className="premium-card p-3 bg-[#3b82f6]/5 border border-[#3b82f6]/20 space-y-2">
                      {['LP', 'OW', 'NA'].map(tipo => (
                        <label key={tipo} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formChecklist.tipo_os.includes(tipo)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormChecklist({...formChecklist, tipo_os: [...formChecklist.tipo_os, tipo]});
                              } else {
                                setFormChecklist({...formChecklist, tipo_os: formChecklist.tipo_os.filter(t => t !== tipo)});
                              }
                            }}
                            className="w-4 h-4"
                          />
                          <span className="text-sm text-gray-300">{tipo}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Selecione para quais tipos de OS este checklist se aplica</p>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-2">Tipos de Atendimento *</label>
                    <div className="premium-card p-3 bg-[#3b82f6]/5 border border-[#3b82f6]/20 grid grid-cols-3 gap-2">
                      {['CI', 'IH', 'II', 'RH', 'SH', 'PS'].map(tipo => (
                        <label key={tipo} className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={formChecklist.tipos_atendimento.includes(tipo)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setFormChecklist({...formChecklist, tipos_atendimento: [...formChecklist.tipos_atendimento, tipo]});
                              } else {
                                setFormChecklist({...formChecklist, tipos_atendimento: formChecklist.tipos_atendimento.filter(t => t !== tipo)});
                              }
                            }}
                            className="w-4 h-4"
                          />
                          <span className="text-sm text-gray-300">{tipo}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Selecione para quais tipos de atendimento este checklist se aplica</p>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-400 uppercase mb-2">Unidade</label>
                    <select
                      value={formChecklist.unidade_id}
                      onChange={(e) => setFormChecklist({...formChecklist, unidade_id: e.target.value})}
                      className="neon-input"
                    >
                      <option value="">Global (Todas as unidades)</option>
                      {unidades.map(u => (
                        <option key={u.id} value={u.id}>{u.nome}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Templates globais são compartilhados entre todas as unidades</p>
                  </div>

                  <div className="premium-card p-4 bg-[#3b82f6]/5 border border-[#3b82f6]/20">
                    <label className="block text-xs text-gray-400 uppercase tracking-wider mb-3">Itens do Checklist</label>

                    <div className="space-y-3 mb-4">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={novoItem.texto}
                          onChange={(e) => setNovoItem({...novoItem, texto: e.target.value})}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' && novoItem.texto.trim()) {
                              e.preventDefault();
                              setFormChecklist({
                                ...formChecklist,
                                itens: [...formChecklist.itens, {
                                  ordem: formChecklist.itens.length + 1,
                                  texto: novoItem.texto.trim(),
                                  tipo_resposta: novoItem.tipo_resposta
                                }]
                              });
                              setNovoItem({ texto: '', tipo_resposta: 'checkbox' });
                            }
                          }}
                          placeholder="Digite o texto do item e pressione Enter"
                          className="neon-input flex-1"
                        />
                        <select
                          value={novoItem.tipo_resposta}
                          onChange={(e) => setNovoItem({...novoItem, tipo_resposta: e.target.value as any})}
                          className="neon-input w-32"
                        >
                          <option value="checkbox">Checkbox</option>
                          <option value="texto">Texto</option>
                          <option value="ambos">Ambos</option>
                        </select>
                        <button
                          type="button"
                          onClick={() => {
                            if (novoItem.texto.trim()) {
                              setFormChecklist({
                                ...formChecklist,
                                itens: [...formChecklist.itens, {
                                  ordem: formChecklist.itens.length + 1,
                                  texto: novoItem.texto.trim(),
                                  tipo_resposta: novoItem.tipo_resposta
                                }]
                              });
                              setNovoItem({ texto: '', tipo_resposta: 'checkbox' });
                            }
                          }}
                          className="neon-button px-4"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {formChecklist.itens.length > 0 ? (
                      <div className="space-y-2">
                        {formChecklist.itens.map((item, index) => (
                          <div key={index} className="flex items-start gap-3 bg-[#0A0F1E] p-3 rounded border border-[#3b82f6]/20">
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  if (index > 0) {
                                    const newItens = [...formChecklist.itens];
                                    [newItens[index - 1], newItens[index]] = [newItens[index], newItens[index - 1]];
                                    newItens.forEach((item, i) => item.ordem = i + 1);
                                    setFormChecklist({...formChecklist, itens: newItens});
                                  }
                                }}
                                disabled={index === 0}
                                className="p-1 hover:bg-[#3b82f6]/20 rounded transition-colors disabled:opacity-30"
                              >
                                <ChevronUp className="w-4 h-4 text-[#3b82f6]" />
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  if (index < formChecklist.itens.length - 1) {
                                    const newItens = [...formChecklist.itens];
                                    [newItens[index], newItens[index + 1]] = [newItens[index + 1], newItens[index]];
                                    newItens.forEach((item, i) => item.ordem = i + 1);
                                    setFormChecklist({...formChecklist, itens: newItens});
                                  }
                                }}
                                disabled={index === formChecklist.itens.length - 1}
                                className="p-1 hover:bg-[#3b82f6]/20 rounded transition-colors disabled:opacity-30"
                              >
                                <ChevronDown className="w-4 h-4 text-[#3b82f6]" />
                              </button>
                            </div>
                            <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#3b82f6]/20 text-[#3b82f6] flex items-center justify-center text-xs font-bold mt-1">
                              {item.ordem}
                            </span>
                            <div className="flex-1">
                              <p className="text-sm text-gray-300">{item.texto}</p>
                              <span className="text-xs text-gray-500">
                                Tipo: {item.tipo_resposta === 'checkbox' ? 'Checkbox' : item.tipo_resposta === 'texto' ? 'Texto' : 'Ambos'}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                const newItens = formChecklist.itens.filter((_, i) => i !== index);
                                newItens.forEach((item, i) => item.ordem = i + 1);
                                setFormChecklist({...formChecklist, itens: newItens});
                              }}
                              className="p-1 hover:bg-red-500/20 rounded transition-colors"
                            >
                              <X className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-4">Nenhum item adicionado</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="ativo-checklist"
                      checked={formChecklist.ativo}
                      onChange={(e) => setFormChecklist({...formChecklist, ativo: e.target.checked})}
                      className="w-4 h-4"
                    />
                    <label htmlFor="ativo-checklist" className="text-sm text-gray-300">Checklist Ativo</label>
                  </div>
                </>
              )}
            </div>

            <div className="border-t border-[#00D4FF]/20 p-6 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-6 py-3 rounded-lg font-bold text-sm uppercase border border-gray-700 text-gray-400 hover:bg-gray-800/60">
                CANCELAR
              </button>
              <button onClick={handleSave} className="neon-button flex items-center gap-2">
                <Save className="w-4 h-4" />
                SALVAR
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6 fade-in">
        <div className="premium-card">
          <div className="border-b border-[#00D4FF]/20">
            <nav className="flex -mb-px overflow-x-auto cyber-scrollbar">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-6 py-4 border-b-2 font-bold text-sm uppercase tracking-wider transition-all flex-shrink-0 ${
                      isActive ? 'text-[#00D4FF]' : 'text-gray-500 hover:text-[#00D4FF]'
                    }`}
                    style={{
                      borderColor: isActive ? tab.color : 'transparent',
                      boxShadow: isActive ? `0 2px 0 ${tab.color}, 0 0 20px ${tab.color}40` : 'none'
                    }}
                  >
                    <Icon className="w-5 h-5" style={isActive ? { color: tab.color, filter: `drop-shadow(0 0 4px ${tab.color})` } : {}} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <div className="futuristic-loader"></div>
              </div>
            ) : (
              <>
                <div className="mb-6 flex items-center justify-between">
                  <h3 className="tech-heading text-base text-[#00D4FF]">
                    {tabs.find(t => t.id === activeTab)?.label.toUpperCase()}
                  </h3>
                  {activeTab === 'unidades' && (
                    <button
                      onClick={() => handleOpenModal()}
                      className="neon-button flex items-center gap-2 px-4 py-2"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar Unidade
                    </button>
                  )}
                  {activeTab === 'usuarios' && (
                    <button
                      onClick={() => handleOpenModal()}
                      className="neon-button flex items-center gap-2 px-4 py-2"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar Usuário
                    </button>
                  )}
                  {activeTab === 'servicos' && (
                    <button
                      onClick={() => handleOpenModal()}
                      className="neon-button flex items-center gap-2 px-4 py-2"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar Serviço
                    </button>
                  )}
                  {activeTab === 'markup' && (
                    <button
                      onClick={() => handleOpenModal()}
                      className="neon-button flex items-center gap-2 px-4 py-2"
                    >
                      <Plus className="w-4 h-4" />
                      Adicionar Markup
                    </button>
                  )}
                </div>

                {activeTab === 'unidades' && (
                  <div className="space-y-3">
                    {unidades.length === 0 ? (
                      <div className="text-center py-12">
                        <Building className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">Nenhuma unidade cadastrada</p>
                      </div>
                    ) : (
                      unidades.map((unidade) => (
                        <div key={unidade.id} className="premium-card p-4 hover-lift">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <h4 className="text-base font-bold text-[#00D4FF] mb-2">{unidade.nome}</h4>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                {unidade.endereco && (
                                  <div>
                                    <span className="text-gray-500 text-xs">Endereço:</span>
                                    <p className="text-gray-300">
                                      {unidade.endereco}{unidade.numero ? `, ${unidade.numero}` : ''}
                                    </p>
                                  </div>
                                )}
                                {unidade.cidade && (
                                  <div>
                                    <span className="text-gray-500 text-xs">Cidade:</span>
                                    <p className="text-gray-300">{unidade.cidade} - {unidade.estado}</p>
                                  </div>
                                )}
                                {unidade.telefone && (
                                  <div>
                                    <span className="text-gray-500 text-xs">Telefone:</span>
                                    <p className="text-gray-300">{unidade.telefone}</p>
                                  </div>
                                )}
                                {unidade.cep && (
                                  <div>
                                    <span className="text-gray-500 text-xs">CEP:</span>
                                    <p className="text-gray-300">{unidade.cep}</p>
                                  </div>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <button onClick={() => handleOpenModal(unidade.id)} className="p-2 hover:bg-[#00D4FF]/10 rounded-lg transition-colors">
                                <Edit className="w-4 h-4 text-[#00D4FF]" />
                              </button>
                              <button onClick={() => handleDelete(unidade.id, 'unidades')} className="p-2 hover:bg-red-500/10 rounded-lg transition-colors">
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'usuarios' && (
                  <div className="space-y-3">
                    {usuarios.length === 0 ? (
                      <div className="text-center py-12">
                        <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">Nenhum usuário cadastrado</p>
                      </div>
                    ) : (
                      usuarios.map((usuario) => (
                        <div key={usuario.id} className="premium-card p-4 hover-lift">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h4 className="text-base font-bold text-[#00D4FF]">{usuario.nome}</h4>
                                <span
                                  className="px-2 py-1 rounded text-xs font-bold uppercase"
                                  style={{
                                    backgroundColor: usuario.ativo ? '#39FF1420' : '#FF006420',
                                    color: usuario.ativo ? '#39FF14' : '#FF0064',
                                    border: `1px solid ${usuario.ativo ? '#39FF14' : '#FF0064'}60`
                                  }}
                                >
                                  {usuario.ativo ? 'Ativo' : 'Inativo'}
                                </span>
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div>
                                  <span className="text-gray-500 text-xs">Email:</span>
                                  <p className="text-gray-300">{usuario.email}</p>
                                </div>
                                <div>
                                  <span className="text-gray-500 text-xs">Tipo:</span>
                                  <p className="text-[#39FF14] uppercase font-semibold">
                                    {usuario.tipo === 'master' && 'Master'}
                                    {usuario.tipo === 'diretoria' && 'Diretoria'}
                                    {usuario.tipo === 'gerente' && 'Gerente'}
                                    {usuario.tipo === 'administrador' && 'Administrador'}
                                    {usuario.tipo === 'estoque' && 'Estoque'}
                                    {usuario.tipo === 'tecnico' && 'Técnico'}
                                    {usuario.tipo === 'tecnico_ih' && 'Técnico IH'}
                                    {usuario.tipo === 'vendedor' && 'Vendedor'}
                                    {usuario.tipo === 'atendente' && 'Atendente'}
                                  </p>
                                </div>
                              </div>
                              <div className="mt-2 text-xs text-gray-500">
                                Unidade: {unidades.find(u => u.id === usuario.unidade_id)?.nome || 'Não definida'}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <button onClick={() => handleOpenModal(usuario.id)} className="p-2 hover:bg-[#00D4FF]/10 rounded-lg transition-colors">
                                <Edit className="w-4 h-4 text-[#00D4FF]" />
                              </button>
                              <button onClick={() => handleDeleteUser(usuario.id)} className="p-2 hover:bg-red-500/10 rounded-lg transition-colors">
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'servicos' && (
                  <div className="space-y-3">
                    {servicos.length === 0 ? (
                      <div className="text-center py-12">
                        <Wrench className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">Nenhum serviço cadastrado</p>
                      </div>
                    ) : (
                      servicos.map((servico) => (
                        <div key={servico.id} className="premium-card p-4 hover-lift">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2 flex-wrap">
                                <h4 className="text-base font-bold text-[#00D4FF]">{servico.nome}</h4>
                                {servico.linha && (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-blue-500/20 text-blue-400 border border-blue-500/40">
                                    {servico.linha}
                                  </span>
                                )}
                                <span
                                  className="px-2 py-1 rounded text-xs font-bold uppercase"
                                  style={{
                                    backgroundColor: servico.ativo ? '#39FF1420' : '#FF006420',
                                    color: servico.ativo ? '#39FF14' : '#FF0064',
                                    border: `1px solid ${servico.ativo ? '#39FF14' : '#FF0064'}60`
                                  }}
                                >
                                  {servico.ativo ? 'Ativo' : 'Inativo'}
                                </span>
                              </div>
                              {servico.descricao && (
                                <p className="text-sm text-gray-400 mb-2">{servico.descricao}</p>
                              )}
                              <div className="flex items-center gap-2">
                                <span className="text-gray-500 text-xs">Valor Base:</span>
                                <p className="text-[#39FF14] font-bold">
                                  R$ {servico.valor_base.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <button onClick={() => handleOpenModal(servico.id)} className="p-2 hover:bg-[#00D4FF]/10 rounded-lg transition-colors">
                                <Edit className="w-4 h-4 text-[#00D4FF]" />
                              </button>
                              <button onClick={() => handleDelete(servico.id, 'servicos')} className="p-2 hover:bg-red-500/10 rounded-lg transition-colors">
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'markup' && (
                  <div className="space-y-4">
                    <div className="premium-card p-4 bg-[#00D4FF]/5 border border-[#00D4FF]/20">
                      <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Selecione a Unidade</label>
                      <select
                        value={selectedUnidadeMarkup}
                        onChange={(e) => setSelectedUnidadeMarkup(e.target.value)}
                        className="neon-input"
                      >
                        <option value="">Global (Todas as unidades)</option>
                        {unidades.map(u => (
                          <option key={u.id} value={u.id}>{u.nome}</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-2">
                        {selectedUnidadeMarkup ? `Visualizando markups de ${unidades.find(u => u.id === selectedUnidadeMarkup)?.nome}` : 'Visualizando todos os markups (globais e de todas as unidades)'}
                      </p>
                    </div>

                    {markups.filter(m => {
                      if (selectedUnidadeMarkup === '') {
                        return true; // Mostra todos os markups
                      }
                      return m.unidade_id === selectedUnidadeMarkup;
                    }).length === 0 ? (
                      <div className="text-center py-12">
                        <DollarSign className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">Nenhuma regra de markup cadastrada</p>
                      </div>
                    ) : (
                      markups.filter(m => {
                        if (selectedUnidadeMarkup === '') {
                          return true; // Mostra todos os markups
                        }
                        return m.unidade_id === selectedUnidadeMarkup;
                      }).map((markup) => (
                        <div key={markup.id} className="premium-card p-4 hover-lift">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <h4 className="text-base font-bold text-[#00D4FF]">{markup.nome}</h4>
                                <span
                                  className="px-2 py-0.5 rounded text-[10px] font-bold uppercase"
                                  style={{
                                    backgroundColor: markup.tipo_orcamento === 'samsung_contigo' ? '#FFA50030' :
                                                     markup.tipo_orcamento === 'acessorios' ? '#39FF1430' : '#00D4FF30',
                                    color: markup.tipo_orcamento === 'samsung_contigo' ? '#FFA500' :
                                           markup.tipo_orcamento === 'acessorios' ? '#39FF14' : '#00D4FF',
                                    border: `1px solid ${markup.tipo_orcamento === 'samsung_contigo' ? '#FFA500' :
                                                          markup.tipo_orcamento === 'acessorios' ? '#39FF14' : '#00D4FF'}60`
                                  }}
                                >
                                  {markup.tipo_orcamento === 'normal' ? 'NORMAL' :
                                   markup.tipo_orcamento === 'acessorios' ? 'ACESSÓRIOS' :
                                   'SAMSUNG CONTIGO'}
                                </span>
                                <span
                                  className="px-2 py-1 rounded text-xs font-bold uppercase"
                                  style={{
                                    backgroundColor: markup.ativo ? '#39FF1420' : '#FF006420',
                                    color: markup.ativo ? '#39FF14' : '#FF0064',
                                    border: `1px solid ${markup.ativo ? '#39FF14' : '#FF0064'}60`
                                  }}
                                >
                                  {markup.ativo ? 'Ativo' : 'Inativo'}
                                </span>
                                {!selectedUnidadeMarkup && (
                                  <span
                                    className="px-2 py-0.5 rounded text-[10px] font-bold"
                                    style={{
                                      backgroundColor: markup.unidade_id ? '#00D4FF20' : '#9D4EDD20',
                                      color: markup.unidade_id ? '#00D4FF' : '#9D4EDD',
                                      border: `1px solid ${markup.unidade_id ? '#00D4FF' : '#9D4EDD'}60`
                                    }}
                                  >
                                    {markup.unidade_id ? unidades.find(u => u.id === markup.unidade_id)?.nome || 'Unidade' : 'GLOBAL'}
                                  </span>
                                )}
                              </div>
                              {markup.descricao && (
                                <p className="text-sm text-gray-400 mb-2">{markup.descricao}</p>
                              )}
                              <div className="grid grid-cols-3 gap-3 text-sm mb-3">
                                <div>
                                  <span className="text-gray-500 text-xs">De:</span>
                                  <p className="text-gray-300 font-semibold">
                                    {markup.valor_minimo !== null ? `R$ ${markup.valor_minimo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ 0,00'}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-gray-500 text-xs">Até:</span>
                                  <p className="text-gray-300 font-semibold">
                                    {markup.valor_maximo !== null ? `R$ ${markup.valor_maximo.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '∞'}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-gray-500 text-xs">Markup:</span>
                                  <p className="text-[#39FF14] font-bold">
                                    {markup.tipo === 'percentual' && `+${markup.valor}%`}
                                    {markup.tipo === 'multiplicador' && `×${markup.valor}`}
                                    {markup.tipo === 'valor_fixo' && `+R$ ${markup.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                                  </p>
                                </div>
                              </div>
                              <div className="text-xs text-gray-500">
                                {markup.tipo === 'percentual' && `Adiciona ${markup.valor}% ao valor base`}
                                {markup.tipo === 'multiplicador' && `Multiplica valor base por ${markup.valor}`}
                                {markup.tipo === 'valor_fixo' && `Adiciona R$ ${markup.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} ao valor base`}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <button onClick={() => handleOpenModal(markup.id)} className="p-2 hover:bg-[#00D4FF]/10 rounded-lg transition-colors">
                                <Edit className="w-4 h-4 text-[#00D4FF]" />
                              </button>
                              <button onClick={() => handleDeleteMarkup(markup.id)} className="p-2 hover:bg-red-500/10 rounded-lg transition-colors">
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'taxas' && (
                  <div className="space-y-4">
                    <div className="premium-card p-4 bg-[#00D4FF]/5 border border-[#00D4FF]/20">
                      <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Selecione a Unidade</label>
                      <select
                        value={selectedUnidadeTaxa}
                        onChange={(e) => setSelectedUnidadeTaxa(e.target.value)}
                        className="neon-input"
                      >
                        <option value="" disabled>Selecione uma unidade...</option>
                        {unidades.map(u => (
                          <option key={u.id} value={u.id}>{u.nome}</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-2">
                        {selectedUnidadeTaxa ? `Configurando taxas para ${unidades.find(u => u.id === selectedUnidadeTaxa)?.nome}` : 'Selecione uma unidade para configurar suas taxas'}
                      </p>
                    </div>

                    {!selectedUnidadeTaxa ? (
                      <div className="text-center py-12">
                        <CreditCard className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">Selecione uma unidade para configurar as taxas</p>
                      </div>
                    ) : (
                      <>
                        <div className="premium-card p-4 bg-[#9D4EDD]/5 border border-[#9D4EDD]/20">
                          <p className="text-xs text-gray-400 uppercase tracking-wider mb-2">Informacao</p>
                          <p className="text-sm text-gray-300">
                            Configure as taxas de cartao para cada parcelamento (1x a 12x). Debito esta disponivel apenas para pagamento a vista (1x).
                          </p>
                        </div>

                        {taxas.filter(t => t.unidade_id === selectedUnidadeTaxa).length === 0 ? (
                          <div className="text-center py-12">
                            <CreditCard className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                            <p className="text-gray-500 text-sm mb-4">Nenhuma taxa cadastrada para esta unidade</p>
                            <button
                              onClick={() => criarTaxasPadrao(selectedUnidadeTaxa)}
                              className="px-4 py-2 rounded-lg font-bold text-sm transition-all"
                              style={{
                                background: 'linear-gradient(135deg, rgba(157,78,221,0.2) 0%, rgba(157,78,221,0.05) 100%)',
                                border: '1px solid #9D4EDD',
                                color: '#9D4EDD'
                              }}
                            >
                              Criar Taxas Padrao (1x a 12x)
                            </button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                            {taxas.filter(t => t.unidade_id === selectedUnidadeTaxa).map((taxa) => (
                          <div key={taxa.id} className="premium-card p-4">
                            <div className="flex items-center justify-between mb-3">
                              <span className="text-xs text-gray-500 uppercase tracking-wider">
                                {taxa.parcelamento === 1 ? 'À Vista' : `${taxa.parcelamento}x`}
                              </span>
                              {editingTaxa === taxa.id ? (
                                <button
                                  onClick={() => saveTaxaFromInputs(taxa.id)}
                                  className="flex items-center gap-1 px-2 py-1 bg-[#39FF14]/20 hover:bg-[#39FF14]/30 rounded border border-[#39FF14]"
                                  title="Clique para salvar ou pressione Enter"
                                >
                                  <Save className="w-3 h-3 text-[#39FF14]" />
                                  <span className="text-xs text-[#39FF14] font-medium">Salvar</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => setEditingTaxa(taxa.id)}
                                  className="p-1 hover:bg-[#00D4FF]/10 rounded"
                                >
                                  <Edit className="w-3 h-3 text-[#00D4FF]" />
                                </button>
                              )}
                            </div>
                            {editingTaxa === taxa.id ? (
                              <div className="space-y-3">
                                <div>
                                  <label className="text-xs text-gray-500 block mb-1">Crédito (%)</label>
                                  <input
                                    id={`taxa-${taxa.id}`}
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    defaultValue={taxa.taxa}
                                    className="neon-input text-sm"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        saveTaxaFromInputs(taxa.id);
                                      }
                                    }}
                                    onBlur={() => {
                                      setTimeout(() => saveTaxaFromInputs(taxa.id), 200);
                                    }}
                                  />
                                </div>
                                {taxa.parcelamento === 1 && (
                                  <div>
                                    <label className="text-xs text-gray-500 block mb-1">Débito (%)</label>
                                    <input
                                    id={`debito-${taxa.id}`}
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    defaultValue={taxa.debito}
                                    className="neon-input text-sm"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        saveTaxaFromInputs(taxa.id);
                                      }
                                    }}
                                    onBlur={() => {
                                      setTimeout(() => saveTaxaFromInputs(taxa.id), 200);
                                    }}
                                  />
                                </div>
                                )}
                                <p className="text-xs text-gray-500 italic">
                                  Pressione Enter ou clique em Salvar
                                </p>
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <div>
                                  <p className="text-xs text-gray-500">Crédito</p>
                                  <p className="text-xl font-bold text-[#9D4EDD]">
                                    {taxa.taxa.toFixed(2)}%
                                  </p>
                                </div>
                                {taxa.parcelamento === 1 && (
                                  <div>
                                    <p className="text-xs text-gray-500">Débito</p>
                                    <p className="text-xl font-bold text-[#39FF14]">
                                      {taxa.debito.toFixed(2)}%
                                    </p>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {activeTab === 'rotas' && (
                  <div className="space-y-4">
                    <div className="premium-card p-4 bg-[#00D4FF]/5 border border-[#00D4FF]/20">
                      <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Selecione a Unidade *</label>
                      <select
                        value={selectedUnidadeRota}
                        onChange={(e) => setSelectedUnidadeRota(e.target.value)}
                        className="neon-input"
                      >
                        <option value="">Selecione uma unidade</option>
                        {unidades.map(u => (
                          <option key={u.id} value={u.id}>{u.nome}</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-2">
                        {selectedUnidadeRota
                          ? `Visualizando as 7 rotas de ${unidades.find(u => u.id === selectedUnidadeRota)?.nome}. Cada unidade tem suas próprias rotas com cidades específicas.`
                          : 'Selecione uma unidade para visualizar e configurar suas rotas.'
                        }
                      </p>
                    </div>

                    {!selectedUnidadeRota ? (
                      <div className="text-center py-12">
                        <MapPin className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">Selecione uma unidade acima para visualizar suas rotas</p>
                      </div>
                    ) : rotas.filter(r => r.unidade_id === selectedUnidadeRota).length === 0 ? (
                      <div className="text-center py-12">
                        <MapPin className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">Nenhuma rota cadastrada para esta unidade</p>
                      </div>
                    ) : (
                      rotas.filter(r => r.unidade_id === selectedUnidadeRota).map((rota) => (
                        <div key={rota.id} className="premium-card p-6 hover-lift">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-4 mb-4">
                                <div
                                  className="w-12 h-12 rounded-lg border-2 flex items-center justify-center"
                                  style={{
                                    backgroundColor: `${rota.cor}20`,
                                    borderColor: rota.cor
                                  }}
                                >
                                  <MapPin className="w-6 h-6" style={{ color: rota.cor }} />
                                </div>
                                <div className="flex-1">
                                  <h4 className="text-lg font-bold" style={{ color: rota.cor }}>
                                    {rota.nome}
                                  </h4>
                                </div>
                                <span
                                  className="px-3 py-1 rounded text-xs font-bold uppercase"
                                  style={{
                                    backgroundColor: rota.ativa ? '#39FF1420' : '#FF006420',
                                    color: rota.ativa ? '#39FF14' : '#FF0064',
                                    border: `1px solid ${rota.ativa ? '#39FF14' : '#FF0064'}60`
                                  }}
                                >
                                  {rota.ativa ? 'Ativa' : 'Inativa'}
                                </span>
                              </div>

                              <div className="premium-card p-4 bg-[#0A0F1E]/50 border border-[#00D4FF]/10">
                                <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">
                                  Cidades desta Rota ({rota.cidades?.length || 0})
                                </p>
                                {rota.cidades && rota.cidades.length > 0 ? (
                                  <div className="flex flex-wrap gap-2">
                                    {rota.cidades.map((cidade, index) => (
                                      <span
                                        key={index}
                                        className="px-3 py-1 rounded-full text-xs font-medium border"
                                        style={{
                                          backgroundColor: `${rota.cor}15`,
                                          borderColor: `${rota.cor}40`,
                                          color: rota.cor
                                        }}
                                      >
                                        {cidade}
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <p className="text-sm text-gray-500 italic">Nenhuma cidade cadastrada</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 ml-4">
                              <button
                                onClick={() => handleOpenModal(rota.id)}
                                className="p-2 hover:bg-[#00D4FF]/10 rounded-lg transition-colors"
                              >
                                <Edit className="w-4 h-4 text-[#00D4FF]" />
                              </button>
                              <button
                                onClick={() => handleDelete(rota.id, 'rotas')}
                                className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4 text-red-400" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}

                {activeTab === 'checklists' && (
                  <div className="space-y-4">
                    <div className="premium-card p-4 bg-[#00D4FF]/5 border border-[#00D4FF]/20">
                      <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">Filtrar por Unidade</label>
                      <select
                        value={selectedUnidadeChecklist}
                        onChange={(e) => setSelectedUnidadeChecklist(e.target.value)}
                        className="neon-input"
                      >
                        <option value="">Todas (Globais e Específicas)</option>
                        {unidades.map(u => (
                          <option key={u.id} value={u.id}>{u.nome}</option>
                        ))}
                      </select>
                      <p className="text-xs text-gray-500 mt-2">
                        Templates globais (sem unidade) são compartilhados entre todas as unidades.
                      </p>
                    </div>

                    {(selectedUnidadeChecklist ?
                      checklists.filter(c => c.unidade_id === selectedUnidadeChecklist || c.unidade_id === null) :
                      checklists
                    ).map((checklist) => (
                      <div key={checklist.id} className="premium-card p-6 hover-lift">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-4 mb-4">
                              <div className="w-12 h-12 rounded-lg border-2 flex items-center justify-center bg-[#3b82f6]/20 border-[#3b82f6]">
                                <FileText className="w-6 h-6 text-[#3b82f6]" />
                              </div>
                              <div className="flex-1">
                                <h4 className="text-lg font-bold text-[#3b82f6]">{checklist.nome}</h4>
                                {checklist.descricao && (
                                  <p className="text-sm text-gray-400 mt-1">{checklist.descricao}</p>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <span
                                  className="px-3 py-1 rounded text-xs font-bold uppercase"
                                  style={{
                                    backgroundColor: checklist.tipo_checklist === 'ADM' ? '#3b82f620' : '#00D4FF20',
                                    color: checklist.tipo_checklist === 'ADM' ? '#3b82f6' : '#00D4FF',
                                    border: `1px solid ${checklist.tipo_checklist === 'ADM' ? '#3b82f6' : '#00D4FF'}60`
                                  }}
                                >
                                  {checklist.tipo_checklist}
                                </span>
                                <span
                                  className="px-3 py-1 rounded text-xs font-bold uppercase"
                                  style={{
                                    backgroundColor: '#9333ea20',
                                    color: '#9333ea',
                                    border: '1px solid #9333ea60'
                                  }}
                                >
                                  {checklist.tipo_os?.join(', ')}
                                </span>
                                {checklist.unidade_id === null && (
                                  <span
                                    className="px-3 py-1 rounded text-xs font-bold uppercase"
                                    style={{
                                      backgroundColor: '#FFBF0020',
                                      color: '#FFBF00',
                                      border: '1px solid #FFBF0060'
                                    }}
                                  >
                                    GLOBAL
                                  </span>
                                )}
                                <span
                                  className="px-3 py-1 rounded text-xs font-bold uppercase"
                                  style={{
                                    backgroundColor: checklist.ativo ? '#39FF1420' : '#FF006420',
                                    color: checklist.ativo ? '#39FF14' : '#FF0064',
                                    border: `1px solid ${checklist.ativo ? '#39FF14' : '#FF0064'}60`
                                  }}
                                >
                                  {checklist.ativo ? 'Ativo' : 'Inativo'}
                                </span>
                              </div>
                            </div>

                            <div className="premium-card p-4 bg-[#0A0F1E]/50 border border-[#00D4FF]/10">
                              <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">
                                Itens do Checklist ({checklist.itens?.length || 0})
                              </p>
                              {checklist.itens && checklist.itens.length > 0 ? (
                                <div className="space-y-2">
                                  {checklist.itens.map((item, index) => (
                                    <div
                                      key={index}
                                      className="flex items-start gap-3 p-3 rounded-lg bg-black/30 border border-[#3b82f6]/20"
                                    >
                                      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#3b82f6]/20 text-[#3b82f6] flex items-center justify-center text-xs font-bold">
                                        {item.ordem}
                                      </span>
                                      <div className="flex-1">
                                        <p className="text-sm text-gray-300">{item.texto}</p>
                                        <span className="text-xs text-gray-500">
                                          Tipo: {item.tipo_resposta === 'checkbox' ? 'Checkbox' : item.tipo_resposta === 'texto' ? 'Texto' : 'Ambos'}
                                        </span>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500 italic">Nenhum item cadastrado</p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            <button
                              onClick={() => handleOpenModal(checklist.id)}
                              className="p-2 hover:bg-[#00D4FF]/10 rounded-lg transition-colors"
                            >
                              <Edit className="w-4 h-4 text-[#00D4FF]" />
                            </button>
                            <button
                              onClick={() => handleDelete(checklist.id, 'checklist_templates')}
                              className="p-2 hover:bg-[#FF0064]/10 rounded-lg transition-colors"
                            >
                              <Trash2 className="w-4 h-4 text-[#FF0064]" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {checklists.length === 0 && (
                      <div className="text-center py-12">
                        <FileText className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">Nenhum checklist cadastrado</p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === 'pdf_os' && (
                  <ConfiguracoesPDFOS />
                )}

                {activeTab === 'nf' && (
                  <ConfiguracoesNF unidades={unidades} />
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {showDeleteConfirmModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="premium-card p-8 max-w-md w-full">
            <h3 className="text-2xl font-bold text-white mb-4">Confirmar Exclusão</h3>
            <p className="text-gray-300 mb-6">
              Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => {
                  setShowDeleteConfirmModal(false);
                  setUserToDelete(null);
                }}
                className="px-6 py-2.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors"
              >
                Não
              </button>
              <button
                onClick={confirmDeleteUser}
                className="px-6 py-2.5 rounded-lg bg-red-500 hover:bg-red-600 text-white transition-colors"
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteSuccessModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div className="premium-card p-8 max-w-md w-full">
            <h3 className="text-2xl font-bold text-white mb-4">
              {deleteMessage.includes('sucesso') ? 'Sucesso!' : 'Atenção'}
            </h3>
            <p className="text-gray-300 mb-6">{deleteMessage}</p>
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setShowDeleteSuccessModal(false);
                  setDeleteMessage('');
                }}
                className="px-6 py-2.5 rounded-lg bg-[#00D4FF] hover:bg-[#00D4FF]/80 text-black font-medium transition-colors"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
