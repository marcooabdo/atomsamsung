import { useState, useEffect, useRef } from 'react';
import {
  Upload, FileSpreadsheet, Play, Pause, StopCircle, Trash2, Eye,
  Send, Image as ImageIcon, Video, FileText, Clock, CheckCircle,
  AlertTriangle, TrendingUp, Users, MessageSquare, Smartphone, X,
  Plus, Settings, ChevronRight, Download, Phone, UserPlus
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';

interface Props {
  accentColor: string;
}

interface Campanha {
  id: string;
  nome: string;
  template_texto: string;
  template_midia_url: string | null;
  template_midia_tipo: string | null;
  delay_min: number;
  delay_max: number;
  status: string;
  total_contatos: number;
  enviados: number;
  entregues: number;
  lidos: number;
  erros: number;
  iniciado_em: string | null;
  created_at: string;
}

interface Instancia {
  id: string;
  nome: string;
  instance_name: string;
  phone_number: string | null;
  status: string;
}

export function AtomConnectMarketing({ accentColor }: Props) {
  const { usuario, unidadeAtual } = useAuth();
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [instancias, setInstancias] = useState<Instancia[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewCampaign, setShowNewCampaign] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campanha | null>(null);

  const [newCampaign, setNewCampaign] = useState({
    nome: '',
    template_texto: '',
    template_midia_url: '',
    template_midia_tipo: '' as '' | 'image' | 'video' | 'document',
    delay_min: 30,
    delay_max: 60,
    instancia_id: '',
    contatos: [] as { telefone: string; nome: string; variaveis: Record<string, string> }[]
  });

  const [manualNumber, setManualNumber] = useState('');
  const [manualName, setManualName] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadCampanhas();
    loadInstancias();
  }, [unidadeAtual]);

  const loadCampanhas = async () => {
    if (!unidadeAtual) {
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from('atom_connect_campanhas')
      .select('*')
      .eq('unidade_id', unidadeAtual)
      .order('created_at', { ascending: false });

    if (!error && data) {
      setCampanhas(data);
    }
    setLoading(false);
  };

  const loadInstancias = async () => {
    if (!unidadeAtual) return;
    const { data } = await supabase
      .from('atom_connect_instancias')
      .select('id, nome, instance_name, phone_number, status')
      .eq('unidade_id', unidadeAtual);
    if (data) {
      setInstancias(data);
      if (data.length === 1) {
        setNewCampaign(prev => ({ ...prev, instancia_id: data[0].id }));
      }
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const data = event.target?.result;
      const workbook = XLSX.read(data, { type: 'binary' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(sheet) as any[];

      const contatos = jsonData.map(row => ({
        telefone: String(row.telefone || row.Telefone || row.phone || row.Phone || '').replace(/\D/g, ''),
        nome: row.nome || row.Nome || row.name || row.Name || '',
        variaveis: row
      })).filter(c => c.telefone.length >= 10);

      setNewCampaign(prev => ({ ...prev, contatos: [...prev.contatos, ...contatos] }));
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const addManualContact = () => {
    const phone = manualNumber.replace(/\D/g, '');
    if (phone.length < 10) return;
    if (newCampaign.contatos.some(c => c.telefone === phone)) return;

    setNewCampaign(prev => ({
      ...prev,
      contatos: [...prev.contatos, { telefone: phone, nome: manualName || phone, variaveis: { nome: manualName || phone } }]
    }));
    setManualNumber('');
    setManualName('');
  };

  const removeContact = (telefone: string) => {
    setNewCampaign(prev => ({
      ...prev,
      contatos: prev.contatos.filter(c => c.telefone !== telefone)
    }));
  };

  const createCampaign = async () => {
    if (!newCampaign.nome || !newCampaign.template_texto || newCampaign.contatos.length === 0) {
      alert('Preencha todos os campos obrigatorios e adicione contatos');
      return;
    }

    const { data: campanha, error } = await supabase
      .from('atom_connect_campanhas')
      .insert({
        unidade_id: unidadeAtual,
        nome: newCampaign.nome,
        template_texto: newCampaign.template_texto,
        template_midia_url: newCampaign.template_midia_url || null,
        template_midia_tipo: newCampaign.template_midia_tipo || null,
        delay_min: newCampaign.delay_min,
        delay_max: newCampaign.delay_max,
        total_contatos: newCampaign.contatos.length,
        created_by: usuario?.id
      })
      .select()
      .single();

    if (error || !campanha) {
      alert('Erro ao criar campanha');
      return;
    }

    const contatos = newCampaign.contatos.map(c => ({
      campanha_id: campanha.id,
      telefone: c.telefone,
      nome: c.nome,
      variaveis: c.variaveis
    }));

    await supabase
      .from('atom_connect_campanha_contatos')
      .insert(contatos);

    setShowNewCampaign(false);
    setNewCampaign({
      nome: '',
      template_texto: '',
      template_midia_url: '',
      template_midia_tipo: '',
      delay_min: 30,
      delay_max: 60,
      instancia_id: instancias.length === 1 ? instancias[0].id : '',
      contatos: []
    });
    loadCampanhas();
  };

  const updateCampaignStatus = async (id: string, status: 'running' | 'paused' | 'cancelled') => {
    await supabase
      .from('atom_connect_campanhas')
      .update({
        status,
        iniciado_em: status === 'running' ? new Date().toISOString() : undefined
      })
      .eq('id', id);
    loadCampanhas();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return '#6B7280';
      case 'running': return '#22C55E';
      case 'paused': return '#F59E0B';
      case 'completed': return '#3B82F6';
      case 'cancelled': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'draft': return 'Rascunho';
      case 'running': return 'Em Execucao';
      case 'paused': return 'Pausada';
      case 'completed': return 'Concluida';
      case 'cancelled': return 'Cancelada';
      default: return status;
    }
  };

  const previewMessage = (template: string, variaveis: Record<string, string> = {}) => {
    let message = template;
    Object.entries(variaveis).forEach(([key, value]) => {
      message = message.replace(new RegExp(`\\{${key}\\}`, 'g'), value);
    });
    return message;
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-shrink-0 px-6 py-4 border-b border-white/10 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Marketing & Disparos</h2>
          <p className="text-sm text-gray-400">Envio em massa com seguranca anti-ban</p>
        </div>
        <button
          onClick={() => setShowNewCampaign(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            backgroundColor: `${accentColor}20`,
            color: accentColor,
            border: `1px solid ${accentColor}40`
          }}
        >
          <Plus className="w-4 h-4" />
          Nova Campanha
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {campanhas.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500">
            <MessageSquare className="w-16 h-16 mb-4 opacity-50" />
            <p className="text-lg">Nenhuma campanha criada</p>
            <p className="text-sm mt-2">Crie sua primeira campanha de marketing</p>
          </div>
        ) : (
          <div className="space-y-4">
            {campanhas.map(campanha => (
              <motion.div
                key={campanha.id}
                layout
                className="p-6 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3">
                      <h3 className="text-lg font-semibold text-white">{campanha.nome}</h3>
                      <span
                        className="px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          backgroundColor: `${getStatusColor(campanha.status)}20`,
                          color: getStatusColor(campanha.status)
                        }}
                      >
                        {getStatusLabel(campanha.status)}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 mt-1 line-clamp-2">
                      {campanha.template_texto.substring(0, 100)}...
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {campanha.status === 'draft' && (
                      <button
                        onClick={() => updateCampaignStatus(campanha.id, 'running')}
                        className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                    {campanha.status === 'running' && (
                      <>
                        <button
                          onClick={() => updateCampaignStatus(campanha.id, 'paused')}
                          className="p-2 rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors"
                        >
                          <Pause className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => updateCampaignStatus(campanha.id, 'cancelled')}
                          className="p-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                        >
                          <StopCircle className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {campanha.status === 'paused' && (
                      <button
                        onClick={() => updateCampaignStatus(campanha.id, 'running')}
                        className="p-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
                      >
                        <Play className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => setSelectedCampaign(campanha)}
                      className="p-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-5 gap-4 mt-4 pt-4 border-t border-white/10">
                  <div className="text-center">
                    <p className="text-xl font-bold text-white">{campanha.total_contatos}</p>
                    <p className="text-xs text-gray-400">Total</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-blue-400">{campanha.enviados}</p>
                    <p className="text-xs text-gray-400">Enviados</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-green-400">{campanha.entregues}</p>
                    <p className="text-xs text-gray-400">Entregues</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold" style={{ color: accentColor }}>{campanha.lidos}</p>
                    <p className="text-xs text-gray-400">Lidos</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xl font-bold text-red-400">{campanha.erros}</p>
                    <p className="text-xs text-gray-400">Erros</p>
                  </div>
                </div>

                {campanha.status === 'running' && (
                  <div className="mt-4">
                    <div className="h-2 bg-white/10 rounded-full overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: accentColor }}
                        initial={{ width: 0 }}
                        animate={{ width: `${(campanha.enviados / campanha.total_contatos) * 100}%` }}
                        transition={{ duration: 0.5 }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-1 text-right">
                      {Math.round((campanha.enviados / campanha.total_contatos) * 100)}% concluido
                    </p>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        )}
      </div>

      <AnimatePresence>
        {showNewCampaign && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6"
            onClick={() => setShowNewCampaign(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1A1A2E] rounded-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-white/10 flex items-center justify-between">
                <h3 className="text-xl font-semibold text-white">Nova Campanha de Marketing</h3>
                <button
                  onClick={() => setShowNewCampaign(false)}
                  className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="p-6 grid grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Nome da Campanha *
                    </label>
                    <input
                      type="text"
                      value={newCampaign.nome}
                      onChange={(e) => setNewCampaign(prev => ({ ...prev, nome: e.target.value }))}
                      placeholder="Ex: Promocao de Janeiro"
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Enviar de qual numero *
                    </label>
                    <select
                      value={newCampaign.instancia_id}
                      onChange={(e) => setNewCampaign(prev => ({ ...prev, instancia_id: e.target.value }))}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-white/20"
                    >
                      <option value="">Selecione o numero de envio</option>
                      {instancias.map(inst => (
                        <option key={inst.id} value={inst.id}>
                          {inst.nome} {inst.phone_number ? `(${inst.phone_number})` : ''} - {inst.status === 'connected' ? 'Online' : 'Offline'}
                        </option>
                      ))}
                    </select>
                    {instancias.length === 0 && (
                      <p className="text-xs text-red-400 mt-1">
                        Nenhuma instancia configurada. Vá em Configuracoes para adicionar.
                      </p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Mensagem do Template *
                    </label>
                    <textarea
                      value={newCampaign.template_texto}
                      onChange={(e) => setNewCampaign(prev => ({ ...prev, template_texto: e.target.value }))}
                      placeholder="Ola {nome}, temos uma oferta especial para voce!"
                      rows={5}
                      className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20 resize-none"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Use {'{nome}'} para personalizar com o nome do contato
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Midia (Opcional)
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={newCampaign.template_midia_url}
                        onChange={(e) => setNewCampaign(prev => ({ ...prev, template_midia_url: e.target.value }))}
                        placeholder="URL da imagem ou video"
                        className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20"
                      />
                      <select
                        value={newCampaign.template_midia_tipo}
                        onChange={(e) => setNewCampaign(prev => ({ ...prev, template_midia_tipo: e.target.value as any }))}
                        className="px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-white/20"
                      >
                        <option value="">Tipo</option>
                        <option value="image">Imagem</option>
                        <option value="video">Video</option>
                        <option value="document">Documento</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Delay entre Mensagens (Anti-Ban)
                    </label>
                    <div className="flex items-center gap-4">
                      <div className="flex-1">
                        <input
                          type="range"
                          min={10}
                          max={120}
                          value={newCampaign.delay_min}
                          onChange={(e) => setNewCampaign(prev => ({ ...prev, delay_min: Number(e.target.value) }))}
                          className="w-full"
                        />
                        <p className="text-xs text-gray-500">Min: {newCampaign.delay_min}s</p>
                      </div>
                      <div className="flex-1">
                        <input
                          type="range"
                          min={newCampaign.delay_min + 10}
                          max={180}
                          value={newCampaign.delay_max}
                          onChange={(e) => setNewCampaign(prev => ({ ...prev, delay_max: Number(e.target.value) }))}
                          className="w-full"
                        />
                        <p className="text-xs text-gray-500">Max: {newCampaign.delay_max}s</p>
                      </div>
                    </div>
                    <p className="text-xs text-yellow-400 mt-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Delays menores aumentam o risco de bloqueio
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Adicionar Contatos
                    </label>

                    <div className="space-y-3">
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={manualNumber}
                          onChange={(e) => setManualNumber(e.target.value)}
                          placeholder="Telefone (ex: 5511999999999)"
                          onKeyDown={(e) => e.key === 'Enter' && addManualContact()}
                          className="flex-1 px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20"
                        />
                        <input
                          type="text"
                          value={manualName}
                          onChange={(e) => setManualName(e.target.value)}
                          placeholder="Nome (opcional)"
                          onKeyDown={(e) => e.key === 'Enter' && addManualContact()}
                          className="w-36 px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20"
                        />
                        <button
                          onClick={addManualContact}
                          className="px-3 py-2.5 rounded-lg text-sm font-medium transition-colors"
                          style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                        >
                          <UserPlus className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="text-center text-xs text-gray-500 py-1">ou importe de planilha</div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        onChange={handleFileUpload}
                        className="hidden"
                      />
                      <button
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full p-4 border-2 border-dashed border-white/20 rounded-lg hover:border-white/40 transition-colors"
                      >
                        <div className="flex flex-col items-center gap-1.5 text-gray-400">
                          <FileSpreadsheet className="w-6 h-6" />
                          <p className="text-sm">Importar Excel / CSV</p>
                          <p className="text-xs text-gray-500">Colunas: telefone, nome</p>
                        </div>
                      </button>
                    </div>
                  </div>

                  {newCampaign.contatos.length > 0 && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-medium text-gray-400">
                          Contatos ({newCampaign.contatos.length})
                        </label>
                        <button
                          onClick={() => setNewCampaign(prev => ({ ...prev, contatos: [] }))}
                          className="text-xs text-red-400 hover:text-red-300 transition-colors"
                        >
                          Limpar todos
                        </button>
                      </div>
                      <div className="max-h-48 overflow-y-auto space-y-1 pr-1" style={{ scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
                        {newCampaign.contatos.map((c, i) => (
                          <div key={`${c.telefone}-${i}`} className="flex items-center justify-between px-3 py-2 bg-white/5 rounded-lg group">
                            <div className="flex items-center gap-2 min-w-0">
                              <Phone className="w-3 h-3 text-gray-500 flex-shrink-0" />
                              <span className="text-xs text-white truncate">{c.nome || c.telefone}</span>
                              {c.nome && <span className="text-xs text-gray-500 flex-shrink-0">{c.telefone}</span>}
                            </div>
                            <button
                              onClick={() => removeContact(c.telefone)}
                              className="p-1 rounded hover:bg-red-500/20 text-gray-500 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">
                      Pre-visualizacao
                    </label>
                    <div className="bg-[#0D0D12] rounded-xl p-3">
                      <div className="flex flex-col items-center">
                        <div className="w-56 bg-[#1A1A2E] rounded-2xl overflow-hidden border border-white/10">
                          <div className="h-5 bg-black flex items-center justify-center">
                            <div className="w-12 h-0.5 bg-white/20 rounded-full" />
                          </div>
                          <div className="p-2.5 bg-green-600 flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-white/20" />
                            <span className="text-xs text-white font-medium">Sua Empresa</span>
                          </div>
                          <div className="p-2.5 min-h-[120px] bg-[#0D1418]">
                            {newCampaign.template_midia_url && newCampaign.template_midia_tipo === 'image' && (
                              <img
                                src={newCampaign.template_midia_url}
                                alt=""
                                className="max-w-full rounded-lg mb-2"
                                onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                              />
                            )}
                            <div className="bg-green-800 rounded-lg p-2 max-w-[90%]">
                              <p className="text-[10px] text-white whitespace-pre-wrap">
                                {previewMessage(
                                  newCampaign.template_texto || 'Sua mensagem aparecera aqui...',
                                  { nome: 'Cliente' }
                                )}
                              </p>
                              <p className="text-[8px] text-white/50 text-right mt-0.5">10:30</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-white/10 flex justify-end gap-3">
                <button
                  onClick={() => setShowNewCampaign(false)}
                  className="px-4 py-2 bg-white/10 rounded-lg text-sm text-gray-400 hover:bg-white/20 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={createCampaign}
                  className="px-6 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ backgroundColor: accentColor, color: '#000' }}
                >
                  Criar Campanha
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
