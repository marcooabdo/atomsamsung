import { useState, useEffect } from 'react';
import { ShoppingCart, Plus, Filter, Search, CreditCard as Edit2, Trash2, Eye, X, TrendingUp, AlertCircle, CheckCircle, Clock, Upload, Star, FileText, MapPin, Building2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useModal } from '../contexts/ModalContext';
import { buscarCEP, formatarCEP } from '../lib/cep';

interface Venda {
  id: string;
  numero_venda: string;
  cliente_nome: string;
  cliente_documento: string | null;
  cliente_contato: string | null;
  cliente_cep: string | null;
  cliente_logradouro: string | null;
  cliente_numero: string | null;
  cliente_complemento: string | null;
  cliente_bairro: string | null;
  cliente_cidade: string | null;
  cliente_estado: string | null;
  cliente_data_nascimento: string | null;
  cliente_telefone: string | null;
  produto_nome: string;
  produto_tipo: string | null;
  vendedor_id: string;
  preco: number;
  tipo_venda: 'store_plus' | 'smb' | 'seguro_care';
  status: 'pendente' | 'concluido' | 'cancelado';
  unidade_id: string;
  criado_por: string | null;
  enviado_skywalker: boolean;
  data_envio_skywalker: string | null;
  avaliacao_url: string | null;
  avaliacao_validada: boolean;
  avaliacao_validada_por: string | null;
  avaliacao_validada_em: string | null;
  avaliacao_observacoes: string | null;
  log_skywalker: any[];
  observacoes: string | null;
  created_at: string;
  updated_at: string;
  vendedor?: {
    nome: string;
    email: string;
  };
  unidade?: {
    nome: string;
  };
  validador?: {
    nome: string;
  };
}

interface Usuario {
  id: string;
  nome: string;
  email: string;
}

interface Unidade {
  id: string;
  nome: string;
}

export function RegistroVendas() {
  const { usuario } = useAuth();
  const { showAlert, showConfirm } = useModal();
  const canSeeAllUnits = (usuario?.tipo === 'master' || usuario?.tipo === 'diretoria') && !usuario?.unidade_id;
  const [vendas, setVendas] = useState<Venda[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showValidationModal, setShowValidationModal] = useState(false);
  const [selectedVenda, setSelectedVenda] = useState<Venda | null>(null);
  const [usuarios, setUsuarios] = useState<Usuario[]>([]);
  const [unidades, setUnidades] = useState<Unidade[]>([]);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [buscandoCep, setBuscandoCep] = useState(false);

  const isGestor = usuario?.tipo && ['master', 'diretor', 'gerente', 'administrador'].includes(usuario.tipo);

  const [filtros, setFiltros] = useState({
    busca: '',
    status: 'all',
    tipo_venda: 'all',
    vendedor_id: 'all',
    unidade_id: canSeeAllUnits ? 'all' : (usuario?.unidade_id || 'all')
  });

  const [formData, setFormData] = useState({
    numero_venda: '',
    cliente_nome: '',
    cliente_documento: '',
    cliente_contato: '',
    cliente_cep: '',
    cliente_logradouro: '',
    cliente_numero: '',
    cliente_complemento: '',
    cliente_bairro: '',
    cliente_cidade: '',
    cliente_estado: '',
    cliente_data_nascimento: '',
    cliente_telefone: '',
    produto_nome: '',
    produto_tipo: '',
    vendedor_id: '',
    preco: '',
    tipo_venda: 'store_plus' as 'store_plus' | 'smb' | 'seguro_care',
    status: 'pendente' as 'pendente' | 'concluido' | 'cancelado',
    unidade_id: '',
    observacoes: '',
    avaliacao_url: ''
  });

  const [validationData, setValidationData] = useState({
    avaliacao_observacoes: ''
  });

  useEffect(() => {
    loadVendas();
    loadUsuarios();
    loadUnidades();
  }, []);

  const loadVendas = async () => {
    setLoading(true);
    let query = supabase
      .from('vendas')
      .select(`
        *,
        vendedor:usuarios!vendedor_id(nome, email),
        unidade:unidades(nome),
        validador:usuarios!avaliacao_validada_por(nome)
      `)
      .order('created_at', { ascending: false });

    if (!canSeeAllUnits && usuario?.unidade_id) {
      query = query.eq('unidade_id', usuario.unidade_id);
    }

    const { data, error } = await query;

    if (!error && data) {
      setVendas(data);
    }
    setLoading(false);
  };

  const loadUsuarios = async () => {
    const { data } = await supabase
      .from('usuarios')
      .select('id, nome, email')
      .eq('ativo', true)
      .order('nome');
    if (data) setUsuarios(data);
  };

  const loadUnidades = async () => {
    const { data } = await supabase
      .from('unidades')
      .select('id, nome')
      .order('nome');
    if (data) setUnidades(data);
  };

  const handleOpenModal = (venda?: Venda) => {
    if (venda) {
      setSelectedVenda(venda);
      setFormData({
        numero_venda: venda.numero_venda,
        cliente_nome: venda.cliente_nome,
        cliente_documento: venda.cliente_documento || '',
        cliente_contato: venda.cliente_contato || '',
        cliente_cep: venda.cliente_cep || '',
        cliente_logradouro: venda.cliente_logradouro || '',
        cliente_numero: venda.cliente_numero || '',
        cliente_complemento: venda.cliente_complemento || '',
        cliente_bairro: venda.cliente_bairro || '',
        cliente_cidade: venda.cliente_cidade || '',
        cliente_estado: venda.cliente_estado || '',
        cliente_data_nascimento: venda.cliente_data_nascimento || '',
        cliente_telefone: venda.cliente_telefone || '',
        produto_nome: venda.produto_nome,
        produto_tipo: venda.produto_tipo || '',
        vendedor_id: venda.vendedor_id,
        preco: venda.preco.toString(),
        tipo_venda: venda.tipo_venda,
        status: venda.status,
        unidade_id: venda.unidade_id,
        observacoes: venda.observacoes || '',
        avaliacao_url: venda.avaliacao_url || ''
      });
    } else {
      setSelectedVenda(null);
      setFormData({
        numero_venda: '',
        cliente_nome: '',
        cliente_documento: '',
        cliente_contato: '',
        cliente_cep: '',
        cliente_logradouro: '',
        cliente_numero: '',
        cliente_complemento: '',
        cliente_bairro: '',
        cliente_cidade: '',
        cliente_estado: '',
        cliente_data_nascimento: '',
        cliente_telefone: '',
        produto_nome: '',
        produto_tipo: '',
        vendedor_id: '',
        preco: '',
        tipo_venda: 'store_plus',
        status: 'pendente',
        unidade_id: usuario?.unidade_id || '',
        observacoes: '',
        avaliacao_url: ''
      });
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedVenda(null);
  };

  const handleBuscarCEP = async (cep: string) => {
    const cepLimpo = cep.replace(/\D/g, '');
    if (cepLimpo.length !== 8) return;

    setBuscandoCep(true);
    try {
      const endereco = await buscarCEP(cepLimpo);
      if (endereco) {
        setFormData({
          ...formData,
          cliente_cep: formatarCEP(cepLimpo),
          cliente_logradouro: endereco.logradouro || '',
          cliente_bairro: endereco.bairro || '',
          cliente_cidade: endereco.localidade || '',
          cliente_estado: endereco.uf || ''
        });
        showAlert({
          type: 'success',
          title: 'CEP Encontrado',
          message: 'Endereço preenchido automaticamente!'
        });
      }
    } catch (error: any) {
      showAlert({
        type: 'error',
        title: 'Erro ao Buscar CEP',
        message: error.message || 'CEP não encontrado'
      });
    } finally {
      setBuscandoCep(false);
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showAlert({
        type: 'warning',
        title: 'Arquivo muito grande',
        message: 'O arquivo deve ter no máximo 5MB'
      });
      return;
    }

    setUploadingFile(true);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `${usuario?.id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('vendas-avaliacoes')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('vendas-avaliacoes')
        .getPublicUrl(filePath);

      setFormData({ ...formData, avaliacao_url: filePath });

      showAlert({
        type: 'success',
        title: 'Upload concluído',
        message: 'Arquivo de avaliação enviado com sucesso!'
      });
    } catch (error: any) {
      showAlert({
        type: 'error',
        title: 'Erro no Upload',
        message: `Erro ao enviar arquivo: ${error.message}`
      });
    } finally {
      setUploadingFile(false);
    }
  };

  const handleOpenValidationModal = (venda: Venda) => {
    setSelectedVenda(venda);
    setValidationData({
      avaliacao_observacoes: venda.avaliacao_observacoes || ''
    });
    setShowValidationModal(true);
  };

  const handleValidateAvaliacao = async (validar: boolean) => {
    if (!selectedVenda) return;

    const { error } = await supabase
      .from('vendas')
      .update({
        avaliacao_validada: validar,
        avaliacao_validada_por: validar ? usuario?.id : null,
        avaliacao_validada_em: validar ? new Date().toISOString() : null,
        avaliacao_observacoes: validationData.avaliacao_observacoes || null
      })
      .eq('id', selectedVenda.id);

    if (!error) {
      showAlert({
        type: 'success',
        title: validar ? 'Avaliação Validada' : 'Validação Removida',
        message: validar
          ? 'A avaliação foi validada e a pontuação foi registrada no Skywalker!'
          : 'A validação foi removida e a pontuação foi revertida.'
      });
      setShowValidationModal(false);
      setSelectedVenda(null);
      loadVendas();
    } else {
      showAlert({
        type: 'error',
        title: 'Erro',
        message: `Erro ao processar validação: ${error.message}`
      });
    }
  };

  const handleSave = async () => {
    if (!formData.numero_venda || !formData.cliente_nome || !formData.produto_nome ||
        !formData.vendedor_id || !formData.preco || !formData.unidade_id) {
      showAlert({
        type: 'warning',
        title: 'Campos Obrigatórios',
        message: 'Por favor, preencha todos os campos obrigatórios'
      });
      return;
    }

    const vendaData = {
      numero_venda: formData.numero_venda,
      cliente_nome: formData.cliente_nome,
      cliente_documento: formData.cliente_documento || null,
      cliente_contato: formData.cliente_contato || null,
      cliente_cep: formData.cliente_cep || null,
      cliente_logradouro: formData.cliente_logradouro || null,
      cliente_numero: formData.cliente_numero || null,
      cliente_complemento: formData.cliente_complemento || null,
      cliente_bairro: formData.cliente_bairro || null,
      cliente_cidade: formData.cliente_cidade || null,
      cliente_estado: formData.cliente_estado || null,
      cliente_data_nascimento: formData.cliente_data_nascimento || null,
      cliente_telefone: formData.cliente_telefone || null,
      produto_nome: formData.produto_nome,
      produto_tipo: formData.produto_tipo || null,
      vendedor_id: formData.vendedor_id,
      preco: parseFloat(formData.preco),
      tipo_venda: formData.tipo_venda,
      status: formData.status,
      unidade_id: formData.unidade_id,
      observacoes: formData.observacoes || null,
      avaliacao_url: formData.avaliacao_url || null,
      criado_por: usuario?.id
    };

    let error;
    if (selectedVenda) {
      const result = await supabase
        .from('vendas')
        .update(vendaData)
        .eq('id', selectedVenda.id);
      error = result.error;
    } else {
      const result = await supabase
        .from('vendas')
        .insert(vendaData);
      error = result.error;
    }

    if (!error) {
      handleCloseModal();
      loadVendas();
    } else {
      showAlert({
        type: 'error',
        title: 'Erro ao Salvar',
        message: `Erro ao salvar venda: ${error.message}`
      });
    }
  };

  const handleDelete = async (id: string) => {
    const confirmed = await showConfirm({
      title: 'Confirmar Exclusão',
      message: 'Tem certeza que deseja excluir esta venda? Esta ação não pode ser desfeita.',
      confirmText: 'Excluir',
      cancelText: 'Cancelar'
    });

    if (!confirmed) return;

    const { error } = await supabase
      .from('vendas')
      .delete()
      .eq('id', id);

    if (!error) {
      showAlert({
        type: 'success',
        title: 'Sucesso',
        message: 'Venda excluída com sucesso!'
      });
      loadVendas();
    } else {
      showAlert({
        type: 'error',
        title: 'Erro',
        message: `Erro ao excluir venda: ${error.message}`
      });
    }
  };

  const vendasFiltradas = vendas.filter(v => {
    if (filtros.busca && !v.numero_venda.toLowerCase().includes(filtros.busca.toLowerCase()) &&
        !v.cliente_nome.toLowerCase().includes(filtros.busca.toLowerCase()) &&
        !v.produto_nome.toLowerCase().includes(filtros.busca.toLowerCase())) {
      return false;
    }
    if (filtros.status !== 'all' && v.status !== filtros.status) return false;
    if (filtros.tipo_venda !== 'all' && v.tipo_venda !== filtros.tipo_venda) return false;
    if (filtros.vendedor_id !== 'all' && v.vendedor_id !== filtros.vendedor_id) return false;
    if (filtros.unidade_id !== 'all' && v.unidade_id !== filtros.unidade_id) return false;
    return true;
  });

  const stats = {
    total: vendasFiltradas.length,
    concluidas: vendasFiltradas.filter(v => v.status === 'concluido').length,
    pendentes: vendasFiltradas.filter(v => v.status === 'pendente').length,
    canceladas: vendasFiltradas.filter(v => v.status === 'cancelado').length,
    valor_total: vendasFiltradas
      .filter(v => v.status === 'concluido')
      .reduce((sum, v) => sum + v.preco, 0)
  };

  const getStatusBadge = (status: string) => {
    const configs = {
      pendente: { color: '#F59E0B', icon: Clock, label: 'Pendente' },
      concluido: { color: '#10B981', icon: CheckCircle, label: 'Concluído' },
      cancelado: { color: '#EF4444', icon: X, label: 'Cancelado' }
    };
    const config = configs[status as keyof typeof configs];
    const Icon = config.icon;
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium" style={{ backgroundColor: config.color + '15', color: config.color }}>
        <Icon className="w-3.5 h-3.5" />
        {config.label}
      </span>
    );
  };

  const getTipoVendaBadge = (tipo: string) => {
    const configs = {
      store_plus: { color: '#3B82F6', label: 'Store+' },
      smb: { color: '#8B5CF6', label: 'SMB' },
      seguro_care: { color: '#EC4899', label: 'Seguro Care+' }
    };
    const config = configs[tipo as keyof typeof configs];
    return (
      <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: config.color + '15', color: config.color }}>
        {config.label}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--text-accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #3B82F6, #2563EB)' }}>
            <ShoppingCart className="w-8 h-8 text-white" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-tech)', color: 'var(--text-primary)' }}>
              Registro de Vendas
            </h1>
            <p style={{ color: 'var(--text-secondary)' }} className="text-sm">
              Gerencie vendas Store+, SMB e Seguro Care+
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {canSeeAllUnits ? (
            <div className="premium-card p-3 bg-[#00D4FF]/5 border border-[#00D4FF]/20">
              <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Filtrar por Unidade
              </label>
              <select
                value={filtros.unidade_id}
                onChange={(e) => setFiltros({ ...filtros, unidade_id: e.target.value })}
                className="neon-input"
              >
                <option value="all">Todas as Unidades</option>
                {unidades.map(u => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
            </div>
          ) : (
            <div className="premium-card p-3 bg-[#00D4FF]/5 border border-[#00D4FF]/20">
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-[#00D4FF]" />
                <div>
                  <p className="text-xs text-gray-400 uppercase tracking-wider">Unidade</p>
                  <p className="text-sm font-semibold text-[#00D4FF]">{unidades.find(u => u.id === usuario?.unidade_id)?.nome || 'Sua Unidade'}</p>
                </div>
              </div>
            </div>
          )}
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg font-medium text-sm transition-all hover:scale-105"
            style={{ backgroundColor: 'var(--text-accent)', color: 'var(--text-on-accent)' }}
          >
            <Plus className="w-4 h-4" />
            Nova Venda
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Total de Vendas</p>
            <ShoppingCart className="w-5 h-5" style={{ color: '#6B7280' }} />
          </div>
          <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{stats.total}</p>
        </div>

        <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid #10B98140' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Concluídas</p>
            <CheckCircle className="w-5 h-5" style={{ color: '#10B981' }} />
          </div>
          <p className="text-2xl font-bold" style={{ color: '#10B981' }}>{stats.concluidas}</p>
        </div>

        <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid #F59E0B40' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Pendentes</p>
            <Clock className="w-5 h-5" style={{ color: '#F59E0B' }} />
          </div>
          <p className="text-2xl font-bold" style={{ color: '#F59E0B' }}>{stats.pendentes}</p>
        </div>

        <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid #10B98140' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Valor Total</p>
            <TrendingUp className="w-5 h-5" style={{ color: '#10B981' }} />
          </div>
          <p className="text-2xl font-bold" style={{ color: '#10B981' }}>
            R$ {stats.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </p>
        </div>
      </div>

      <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
        <div className="flex items-center gap-3 mb-4">
          <Filter className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          <h3 className="font-medium" style={{ color: 'var(--text-primary)' }}>Filtros</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
            <input
              type="text"
              placeholder="Buscar..."
              value={filtros.busca}
              onChange={(e) => setFiltros({ ...filtros, busca: e.target.value })}
              className="w-full pl-10 pr-3 py-2 rounded-lg text-sm"
              style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
            />
          </div>

          <select
            value={filtros.status}
            onChange={(e) => setFiltros({ ...filtros, status: e.target.value })}
            className="rounded-lg px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
          >
            <option value="all">Todos os Status</option>
            <option value="pendente">Pendente</option>
            <option value="concluido">Concluído</option>
            <option value="cancelado">Cancelado</option>
          </select>

          <select
            value={filtros.tipo_venda}
            onChange={(e) => setFiltros({ ...filtros, tipo_venda: e.target.value })}
            className="rounded-lg px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
          >
            <option value="all">Todos os Tipos</option>
            <option value="store_plus">Store+</option>
            <option value="smb">SMB</option>
            <option value="seguro_care">Seguro Care+</option>
          </select>

          <select
            value={filtros.vendedor_id}
            onChange={(e) => setFiltros({ ...filtros, vendedor_id: e.target.value })}
            className="rounded-lg px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
          >
            <option value="all">Todos os Vendedores</option>
            {usuarios.map(u => (
              <option key={u.id} value={u.id}>{u.nome}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-primary)' }}>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Número</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Cliente</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Produto</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Vendedor</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Tipo</th>
                <th className="px-4 py-3 text-right text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Valor</th>
                <th className="px-4 py-3 text-left text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Status</th>
                <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Avaliação</th>
                <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Skywalker</th>
                <th className="px-4 py-3 text-center text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {vendasFiltradas.map((venda, idx) => (
                <tr
                  key={venda.id}
                  className="transition-colors hover:bg-opacity-50"
                  style={{
                    borderBottom: idx < vendasFiltradas.length - 1 ? '1px solid var(--border-primary)' : 'none'
                  }}
                >
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      {venda.numero_venda}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{venda.cliente_nome}</p>
                      {venda.cliente_contato && (
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{venda.cliente_contato}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div>
                      <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{venda.produto_nome}</p>
                      {venda.produto_tipo && (
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{venda.produto_tipo}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{venda.vendedor?.nome}</p>
                  </td>
                  <td className="px-4 py-3">
                    {getTipoVendaBadge(venda.tipo_venda)}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      R$ {venda.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(venda.status)}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {venda.avaliacao_url ? (
                      venda.avaliacao_validada ? (
                        <div className="flex items-center justify-center gap-1">
                          <Star className="w-4 h-4 fill-current" style={{ color: '#FBBF24' }} />
                          <span className="text-xs font-medium" style={{ color: '#FBBF24' }}>Validada</span>
                        </div>
                      ) : isGestor ? (
                        <button
                          onClick={() => handleOpenValidationModal(venda)}
                          className="px-2 py-1 rounded text-xs font-medium transition-colors"
                          style={{ backgroundColor: '#F59E0B20', color: '#F59E0B' }}
                        >
                          Validar
                        </button>
                      ) : (
                        <span className="text-xs" style={{ color: '#F59E0B' }}>Pendente</span>
                      )
                    ) : (
                      <span className="text-xs" style={{ color: '#6B7280' }}>-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {venda.enviado_skywalker ? (
                      <CheckCircle className="w-5 h-5 mx-auto" style={{ color: '#10B981' }} />
                    ) : (
                      <X className="w-5 h-5 mx-auto" style={{ color: '#6B7280' }} />
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => {
                          setSelectedVenda(venda);
                          setShowDetailsModal(true);
                        }}
                        className="p-1.5 rounded hover:bg-opacity-10 transition-colors"
                        style={{ color: 'var(--text-accent)' }}
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleOpenModal(venda)}
                        className="p-1.5 rounded hover:bg-opacity-10 transition-colors"
                        style={{ color: '#F59E0B' }}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(venda.id)}
                        className="p-1.5 rounded hover:bg-opacity-10 transition-colors"
                        style={{ color: '#EF4444' }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {vendasFiltradas.length === 0 && (
            <div className="text-center py-16">
              <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: 'var(--text-secondary)' }} />
              <p style={{ color: 'var(--text-secondary)' }}>Nenhuma venda encontrada</p>
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="rounded-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--bg-card)' }}>
            <div className="sticky top-0 flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-card)' }}>
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                {selectedVenda ? 'Editar Venda' : 'Nova Venda'}
              </h2>
              <button onClick={handleCloseModal} className="p-2 rounded-lg hover:bg-opacity-10 transition-colors" style={{ color: 'var(--text-secondary)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div>
                <h3 className="font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Informações da Venda</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Número da Venda *</label>
                    <input
                      type="text"
                      value={formData.numero_venda}
                      onChange={(e) => setFormData({ ...formData, numero_venda: e.target.value })}
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Tipo de Venda *</label>
                    <select
                      value={formData.tipo_venda}
                      onChange={(e) => setFormData({ ...formData, tipo_venda: e.target.value as any })}
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                    >
                      <option value="store_plus">Store+</option>
                      <option value="smb">SMB</option>
                      <option value="seguro_care">Seguro Care+</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Unidade *</label>
                    <select
                      value={formData.unidade_id}
                      onChange={(e) => setFormData({ ...formData, unidade_id: e.target.value })}
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                    >
                      <option value="">Selecione...</option>
                      {unidades.map(u => (
                        <option key={u.id} value={u.id}>{u.nome}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Dados do Cliente</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Nome do Cliente *</label>
                    <input
                      type="text"
                      value={formData.cliente_nome}
                      onChange={(e) => setFormData({ ...formData, cliente_nome: e.target.value })}
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Telefone</label>
                    <input
                      type="text"
                      value={formData.cliente_telefone}
                      onChange={(e) => setFormData({ ...formData, cliente_telefone: e.target.value })}
                      placeholder="(00) 00000-0000"
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Data de Nascimento</label>
                    <input
                      type="date"
                      value={formData.cliente_data_nascimento}
                      onChange={(e) => setFormData({ ...formData, cliente_data_nascimento: e.target.value })}
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Documento (CPF/CNPJ)</label>
                    <input
                      type="text"
                      value={formData.cliente_documento}
                      onChange={(e) => setFormData({ ...formData, cliente_documento: e.target.value })}
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>E-mail / Contato Adicional</label>
                    <input
                      type="text"
                      value={formData.cliente_contato}
                      onChange={(e) => setFormData({ ...formData, cliente_contato: e.target.value })}
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>

                <div className="mt-4 space-y-4">
                  <h4 className="text-sm font-medium flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                    <MapPin className="w-4 h-4" style={{ color: 'var(--text-accent)' }} />
                    Endereço
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>CEP</label>
                      <input
                        type="text"
                        value={formData.cliente_cep}
                        onChange={(e) => {
                          const valor = formatarCEP(e.target.value);
                          setFormData({ ...formData, cliente_cep: valor });
                          if (valor.replace(/\D/g, '').length === 8) {
                            handleBuscarCEP(valor);
                          }
                        }}
                        placeholder="00000-000"
                        maxLength={9}
                        disabled={buscandoCep}
                        className="w-full rounded-lg px-3 py-2 text-sm"
                        style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Logradouro</label>
                      <input
                        type="text"
                        value={formData.cliente_logradouro}
                        onChange={(e) => setFormData({ ...formData, cliente_logradouro: e.target.value })}
                        placeholder="Rua, Avenida..."
                        disabled={buscandoCep}
                        className="w-full rounded-lg px-3 py-2 text-sm"
                        style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Número</label>
                      <input
                        type="text"
                        value={formData.cliente_numero}
                        onChange={(e) => setFormData({ ...formData, cliente_numero: e.target.value })}
                        placeholder="123"
                        className="w-full rounded-lg px-3 py-2 text-sm"
                        style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Complemento</label>
                      <input
                        type="text"
                        value={formData.cliente_complemento}
                        onChange={(e) => setFormData({ ...formData, cliente_complemento: e.target.value })}
                        placeholder="Apto, Bloco, Sala..."
                        className="w-full rounded-lg px-3 py-2 text-sm"
                        style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Bairro</label>
                      <input
                        type="text"
                        value={formData.cliente_bairro}
                        onChange={(e) => setFormData({ ...formData, cliente_bairro: e.target.value })}
                        disabled={buscandoCep}
                        className="w-full rounded-lg px-3 py-2 text-sm"
                        style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Cidade</label>
                      <input
                        type="text"
                        value={formData.cliente_cidade}
                        onChange={(e) => setFormData({ ...formData, cliente_cidade: e.target.value })}
                        disabled={buscandoCep}
                        className="w-full rounded-lg px-3 py-2 text-sm"
                        style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Estado</label>
                      <input
                        type="text"
                        value={formData.cliente_estado}
                        onChange={(e) => setFormData({ ...formData, cliente_estado: e.target.value })}
                        placeholder="UF"
                        maxLength={2}
                        disabled={buscandoCep}
                        className="w-full rounded-lg px-3 py-2 text-sm uppercase"
                        style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                      />
                    </div>
                  </div>

                  {buscandoCep && (
                    <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-accent)' }}>
                      <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--text-accent)', borderTopColor: 'transparent' }} />
                      Buscando CEP...
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Dados do Produto</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Nome do Produto *</label>
                    <input
                      type="text"
                      value={formData.produto_nome}
                      onChange={(e) => setFormData({ ...formData, produto_nome: e.target.value })}
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Tipo do Produto</label>
                    <input
                      type="text"
                      value={formData.produto_tipo}
                      onChange={(e) => setFormData({ ...formData, produto_tipo: e.target.value })}
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Vendedor e Valores</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Vendedor *</label>
                    <select
                      value={formData.vendedor_id}
                      onChange={(e) => setFormData({ ...formData, vendedor_id: e.target.value })}
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                    >
                      <option value="">Selecione...</option>
                      {usuarios.map(u => (
                        <option key={u.id} value={u.id}>{u.nome}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Preço da Venda *</label>
                    <input
                      type="number"
                      step="0.01"
                      value={formData.preco}
                      onChange={(e) => setFormData({ ...formData, preco: e.target.value })}
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                    />
                  </div>

                  <div>
                    <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Status *</label>
                    <select
                      value={formData.status}
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                      className="w-full rounded-lg px-3 py-2 text-sm"
                      style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                    >
                      <option value="pendente">Pendente</option>
                      <option value="concluido">Concluído</option>
                      <option value="cancelado">Cancelado</option>
                    </select>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="font-medium mb-3" style={{ color: 'var(--text-primary)' }}>Upload de Avaliação (Opcional)</h3>
                <div className="rounded-lg p-4" style={{ backgroundColor: '#FBBF2415', border: '1px solid #FBBF2440' }}>
                  <div className="flex items-start gap-3 mb-3">
                    <Star className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#FBBF24' }} />
                    <div>
                      <p className="font-medium text-sm mb-1" style={{ color: '#FBBF24' }}>Google Reviews e Avaliações</p>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Faça upload do comprovante de avaliação (print do Google Reviews, etc). Após validação por um gestor,
                        será contabilizada 1 estrela no Skywalker para o vendedor.
                      </p>
                    </div>
                  </div>

                  {formData.avaliacao_url ? (
                    <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4" style={{ color: '#10B981' }} />
                        <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Arquivo enviado</span>
                      </div>
                      <button
                        onClick={() => setFormData({ ...formData, avaliacao_url: '' })}
                        className="text-sm px-2 py-1 rounded hover:bg-opacity-10 transition-colors"
                        style={{ color: '#EF4444' }}
                      >
                        Remover
                      </button>
                    </div>
                  ) : (
                    <label className="block">
                      <div className="border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all hover:border-accent"
                        style={{ borderColor: 'var(--border-primary)' }}>
                        <Upload className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--text-secondary)' }} />
                        <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
                          {uploadingFile ? 'Enviando...' : 'Clique para selecionar arquivo'}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          PNG, JPG, PDF (máx. 5MB)
                        </p>
                      </div>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,image/webp,application/pdf"
                        onChange={handleFileUpload}
                        disabled={uploadingFile}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Observações</label>
                <textarea
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  rows={3}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                />
              </div>

              {formData.status === 'concluido' && (
                <div className="rounded-lg p-4" style={{ backgroundColor: '#10B98115', border: '1px solid #10B98140' }}>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#10B981' }} />
                    <div>
                      <p className="font-medium text-sm mb-1" style={{ color: '#10B981' }}>Integração com Skywalker</p>
                      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Esta venda será automaticamente registrada no sistema Skywalker e gerará pontuação para o vendedor.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="sticky bottom-0 flex items-center justify-end gap-3 p-6 border-t" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-card)' }}>
              <button
                onClick={handleCloseModal}
                className="px-4 py-2 rounded-lg font-medium text-sm transition-colors"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                className="px-6 py-2 rounded-lg font-medium text-sm transition-all hover:scale-105"
                style={{ backgroundColor: 'var(--text-accent)', color: 'var(--text-on-accent)' }}
              >
                {selectedVenda ? 'Atualizar' : 'Criar'} Venda
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailsModal && selectedVenda && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto" style={{ backgroundColor: 'var(--bg-card)' }}>
            <div className="sticky top-0 flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--border-primary)', backgroundColor: 'var(--bg-card)' }}>
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                Detalhes da Venda
              </h2>
              <button onClick={() => setShowDetailsModal(false)} className="p-2 rounded-lg hover:bg-opacity-10 transition-colors" style={{ color: 'var(--text-secondary)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Número da Venda</p>
                  <p className="text-lg font-bold font-mono" style={{ color: 'var(--text-primary)' }}>{selectedVenda.numero_venda}</p>
                </div>
                <div className="flex items-center gap-2">
                  {getTipoVendaBadge(selectedVenda.tipo_venda)}
                  {getStatusBadge(selectedVenda.status)}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Cliente</p>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{selectedVenda.cliente_nome}</p>
                  {selectedVenda.cliente_documento && (
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{selectedVenda.cliente_documento}</p>
                  )}
                  {selectedVenda.cliente_contato && (
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{selectedVenda.cliente_contato}</p>
                  )}
                </div>

                <div>
                  <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Produto</p>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{selectedVenda.produto_nome}</p>
                  {selectedVenda.produto_tipo && (
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{selectedVenda.produto_tipo}</p>
                  )}
                </div>

                <div>
                  <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Vendedor</p>
                  <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{selectedVenda.vendedor?.nome}</p>
                </div>

                <div>
                  <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Valor</p>
                  <p className="text-lg font-bold" style={{ color: '#10B981' }}>
                    R$ {selectedVenda.preco.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                </div>
              </div>

              {selectedVenda.observacoes && (
                <div>
                  <p className="text-sm mb-1" style={{ color: 'var(--text-secondary)' }}>Observações</p>
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{selectedVenda.observacoes}</p>
                </div>
              )}

              <div className="rounded-lg p-4" style={{ backgroundColor: selectedVenda.enviado_skywalker ? '#10B98115' : '#6B728015', border: `1px solid ${selectedVenda.enviado_skywalker ? '#10B98140' : '#6B728040'}` }}>
                <div className="flex items-center gap-3 mb-3">
                  {selectedVenda.enviado_skywalker ? (
                    <CheckCircle className="w-5 h-5" style={{ color: '#10B981' }} />
                  ) : (
                    <AlertCircle className="w-5 h-5" style={{ color: '#6B7280' }} />
                  )}
                  <p className="font-medium" style={{ color: selectedVenda.enviado_skywalker ? '#10B981' : '#6B7280' }}>
                    {selectedVenda.enviado_skywalker ? 'Enviado para Skywalker' : 'Não enviado para Skywalker'}
                  </p>
                </div>

                {selectedVenda.enviado_skywalker && selectedVenda.data_envio_skywalker && (
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    Enviado em: {new Date(selectedVenda.data_envio_skywalker).toLocaleString('pt-BR')}
                  </p>
                )}

                {selectedVenda.log_skywalker && selectedVenda.log_skywalker.length > 0 && (
                  <div className="mt-3 space-y-2">
                    <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Logs de Integração:</p>
                    {selectedVenda.log_skywalker.map((log: any, idx: number) => (
                      <div key={idx} className="text-xs p-2 rounded" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium">{log.tipo}</span>
                          <span>{new Date(log.data).toLocaleString('pt-BR')}</span>
                        </div>
                        {log.mensagem && <p>{log.mensagem}</p>}
                        {log.estrelas && <p>Estrelas: {log.estrelas}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4 pt-4 border-t" style={{ borderColor: 'var(--border-primary)' }}>
                <div>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Criado em</p>
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                    {new Date(selectedVenda.created_at).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Atualizado em</p>
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                    {new Date(selectedVenda.updated_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showValidationModal && selectedVenda && isGestor && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="rounded-xl max-w-2xl w-full" style={{ backgroundColor: 'var(--bg-card)' }}>
            <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: 'var(--border-primary)' }}>
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                Validar Avaliação
              </h2>
              <button onClick={() => setShowValidationModal(false)} className="p-2 rounded-lg hover:bg-opacity-10 transition-colors" style={{ color: 'var(--text-secondary)' }}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              <div className="rounded-lg p-4" style={{ backgroundColor: '#FBBF2415', border: '1px solid #FBBF2440' }}>
                <div className="flex items-start gap-3">
                  <Star className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#FBBF24' }} />
                  <div>
                    <p className="font-medium text-sm mb-1" style={{ color: '#FBBF24' }}>Informações da Venda</p>
                    <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                      <span className="font-medium">Cliente:</span> {selectedVenda.cliente_nome}
                    </p>
                    <p className="text-sm mb-2" style={{ color: 'var(--text-secondary)' }}>
                      <span className="font-medium">Vendedor:</span> {selectedVenda.vendedor?.nome}
                    </p>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      <span className="font-medium">Produto:</span> {selectedVenda.produto_nome}
                    </p>
                  </div>
                </div>
              </div>

              {selectedVenda.avaliacao_url && (
                <div>
                  <p className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                    Comprovante de Avaliação
                  </p>
                  <div className="rounded-lg p-3 flex items-center gap-2" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    <FileText className="w-4 h-4" style={{ color: '#10B981' }} />
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Arquivo enviado</span>
                    <button
                      onClick={() => {
                        const url = supabase.storage.from('vendas-avaliacoes').getPublicUrl(selectedVenda.avaliacao_url!).data.publicUrl;
                        window.open(url, '_blank');
                      }}
                      className="ml-auto text-xs px-2 py-1 rounded"
                      style={{ backgroundColor: 'var(--text-accent)', color: 'var(--text-on-accent)' }}
                    >
                      Visualizar
                    </button>
                  </div>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                  Observações da Validação (Opcional)
                </label>
                <textarea
                  value={validationData.avaliacao_observacoes}
                  onChange={(e) => setValidationData({ ...validationData, avaliacao_observacoes: e.target.value })}
                  rows={3}
                  placeholder="Adicione observações sobre a validação..."
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                />
              </div>

              <div className="rounded-lg p-4" style={{ backgroundColor: '#10B98115', border: '1px solid #10B98140' }}>
                <div className="flex items-start gap-3">
                  <CheckCircle className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#10B981' }} />
                  <div>
                    <p className="font-medium text-sm mb-1" style={{ color: '#10B981' }}>Integração com Skywalker</p>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                      Ao validar esta avaliação, será registrada automaticamente 1 estrela no Skywalker para o vendedor {selectedVenda.vendedor?.nome}.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t" style={{ borderColor: 'var(--border-primary)' }}>
              {selectedVenda.avaliacao_validada && (
                <button
                  onClick={() => handleValidateAvaliacao(false)}
                  className="px-4 py-2 rounded-lg font-medium text-sm transition-colors"
                  style={{ backgroundColor: '#EF444420', color: '#EF4444' }}
                >
                  Remover Validação
                </button>
              )}
              <button
                onClick={() => setShowValidationModal(false)}
                className="px-4 py-2 rounded-lg font-medium text-sm transition-colors"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
              >
                Cancelar
              </button>
              <button
                onClick={() => handleValidateAvaliacao(true)}
                disabled={selectedVenda.avaliacao_validada}
                className="px-6 py-2 rounded-lg font-medium text-sm transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: 'var(--text-accent)', color: 'var(--text-on-accent)' }}
              >
                {selectedVenda.avaliacao_validada ? 'Já Validada' : 'Validar Avaliação'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
