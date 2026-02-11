import { useState, useEffect } from 'react';
import {
  Settings, Smartphone, QrCode, Wifi, WifiOff, RefreshCw, Trash2,
  Plus, Copy, Check, Eye, EyeOff, ExternalLink, AlertTriangle,
  Save, MessageSquare, Zap
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  accentColor: string;
}

interface Instancia {
  id: string;
  nome: string;
  api_url: string;
  api_key: string;
  instance_name: string;
  webhook_url: string | null;
  status: 'connected' | 'disconnected' | 'connecting';
  qr_code: string | null;
  phone_number: string | null;
  created_at: string;
}

interface RespostaRapida {
  id: string;
  titulo: string;
  atalho: string;
  conteudo: string;
  midia_url: string | null;
}

export function AtomConnectSettings({ accentColor }: Props) {
  const { unidadeAtual } = useAuth();
  const [activeTab, setActiveTab] = useState<'instances' | 'quick_replies' | 'pipeline'>('instances');
  const [instancias, setInstancias] = useState<Instancia[]>([]);
  const [respostasRapidas, setRespostasRapidas] = useState<RespostaRapida[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewInstance, setShowNewInstance] = useState(false);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [newInstance, setNewInstance] = useState({
    nome: '',
    api_url: '',
    api_key: '',
    instance_name: ''
  });

  const [newResposta, setNewResposta] = useState({
    titulo: '',
    atalho: '',
    conteudo: ''
  });
  const [showNewResposta, setShowNewResposta] = useState(false);

  useEffect(() => {
    loadData();
  }, [unidadeAtual]);

  const loadData = async () => {
    await Promise.all([loadInstancias(), loadRespostasRapidas()]);
    setLoading(false);
  };

  const loadInstancias = async () => {
    if (!unidadeAtual) return;

    const { data } = await supabase
      .from('atom_connect_instancias')
      .select('*')
      .eq('unidade_id', unidadeAtual)
      .order('created_at');

    if (data) setInstancias(data);
  };

  const loadRespostasRapidas = async () => {
    const { data } = await supabase
      .from('atom_connect_respostas_rapidas')
      .select('*')
      .or(`unidade_id.is.null,unidade_id.eq.${unidadeAtual}`)
      .order('titulo');

    if (data) setRespostasRapidas(data);
  };

  const createInstancia = async () => {
    if (!newInstance.nome || !newInstance.api_url || !newInstance.api_key || !newInstance.instance_name) {
      alert('Preencha todos os campos');
      return;
    }

    await supabase
      .from('atom_connect_instancias')
      .insert({
        unidade_id: unidadeAtual,
        ...newInstance
      });

    setShowNewInstance(false);
    setNewInstance({ nome: '', api_url: '', api_key: '', instance_name: '' });
    loadInstancias();
  };

  const deleteInstancia = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta instancia?')) return;
    await supabase.from('atom_connect_instancias').delete().eq('id', id);
    loadInstancias();
  };

  const checkConnectionStatus = async (instancia: Instancia) => {
    try {
      await supabase
        .from('atom_connect_instancias')
        .update({ status: 'connecting' })
        .eq('id', instancia.id);
      loadInstancias();

      const response = await fetch(`${instancia.api_url}/instance/connectionState/${instancia.instance_name}`, {
        headers: { 'apikey': instancia.api_key }
      });

      const data = await response.json();
      const newStatus = data.state === 'open' ? 'connected' : 'disconnected';

      await supabase
        .from('atom_connect_instancias')
        .update({
          status: newStatus,
          phone_number: data.instance?.phoneNumber || null
        })
        .eq('id', instancia.id);

      loadInstancias();
    } catch (error) {
      await supabase
        .from('atom_connect_instancias')
        .update({ status: 'disconnected' })
        .eq('id', instancia.id);
      loadInstancias();
    }
  };

  const getQRCode = async (instancia: Instancia) => {
    try {
      const response = await fetch(`${instancia.api_url}/instance/connect/${instancia.instance_name}`, {
        headers: { 'apikey': instancia.api_key }
      });

      const data = await response.json();
      if (data.base64) {
        await supabase
          .from('atom_connect_instancias')
          .update({ qr_code: data.base64, status: 'connecting' })
          .eq('id', instancia.id);
        loadInstancias();
      }
    } catch (error) {
      console.error('Erro ao obter QR Code:', error);
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const createRespostaRapida = async () => {
    if (!newResposta.titulo || !newResposta.atalho || !newResposta.conteudo) {
      alert('Preencha todos os campos');
      return;
    }

    await supabase
      .from('atom_connect_respostas_rapidas')
      .insert({
        unidade_id: unidadeAtual,
        ...newResposta
      });

    setShowNewResposta(false);
    setNewResposta({ titulo: '', atalho: '', conteudo: '' });
    loadRespostasRapidas();
  };

  const deleteRespostaRapida = async (id: string) => {
    if (!confirm('Excluir esta resposta rapida?')) return;
    await supabase.from('atom_connect_respostas_rapidas').delete().eq('id', id);
    loadRespostasRapidas();
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
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 border-b border-white/10">
        <h2 className="text-xl font-bold text-white">Configuracoes</h2>
        <p className="text-sm text-gray-400">Gerencie instancias WhatsApp e preferencias</p>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 px-6 border-b border-white/10">
        <div className="flex gap-6">
          <button
            onClick={() => setActiveTab('instances')}
            className={`py-3 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'instances'
                ? 'border-current text-white'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
            style={{ borderColor: activeTab === 'instances' ? accentColor : undefined }}
          >
            <div className="flex items-center gap-2">
              <Smartphone className="w-4 h-4" />
              Instancias WhatsApp
            </div>
          </button>
          <button
            onClick={() => setActiveTab('quick_replies')}
            className={`py-3 border-b-2 text-sm font-medium transition-colors ${
              activeTab === 'quick_replies'
                ? 'border-current text-white'
                : 'border-transparent text-gray-400 hover:text-white'
            }`}
            style={{ borderColor: activeTab === 'quick_replies' ? accentColor : undefined }}
          >
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4" />
              Respostas Rapidas
            </div>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        {activeTab === 'instances' && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <button
                onClick={() => setShowNewInstance(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: `${accentColor}20`,
                  color: accentColor,
                  border: `1px solid ${accentColor}40`
                }}
              >
                <Plus className="w-4 h-4" />
                Nova Instancia
              </button>
            </div>

            {instancias.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <Smartphone className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg">Nenhuma instancia configurada</p>
                <p className="text-sm mt-2">Adicione sua primeira instancia do Evolution API</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {instancias.map(instancia => (
                  <div
                    key={instancia.id}
                    className="p-6 rounded-xl bg-white/5 border border-white/10"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                            instancia.status === 'connected'
                              ? 'bg-green-500/20'
                              : instancia.status === 'connecting'
                              ? 'bg-yellow-500/20'
                              : 'bg-red-500/20'
                          }`}
                        >
                          {instancia.status === 'connected' ? (
                            <Wifi className="w-6 h-6 text-green-400" />
                          ) : instancia.status === 'connecting' ? (
                            <RefreshCw className="w-6 h-6 text-yellow-400 animate-spin" />
                          ) : (
                            <WifiOff className="w-6 h-6 text-red-400" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold text-white">{instancia.nome}</h3>
                          <p className="text-sm text-gray-400">{instancia.instance_name}</p>
                          {instancia.phone_number && (
                            <p className="text-xs text-green-400 mt-1">
                              Conectado: {instancia.phone_number}
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => checkConnectionStatus(instancia)}
                          className="p-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
                          title="Verificar conexao"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
                        {instancia.status === 'disconnected' && (
                          <button
                            onClick={() => getQRCode(instancia)}
                            className="p-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
                            title="Gerar QR Code"
                          >
                            <QrCode className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => deleteInstancia(instancia.id)}
                          className="p-2 rounded-lg bg-white/5 text-gray-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    {/* API Details */}
                    <div className="mt-4 pt-4 border-t border-white/10 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">API URL</span>
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-gray-400 bg-black/20 px-2 py-1 rounded">
                            {instancia.api_url}
                          </code>
                          <button
                            onClick={() => copyToClipboard(instancia.api_url, `url-${instancia.id}`)}
                            className="p-1 hover:bg-white/10 rounded"
                          >
                            {copiedId === `url-${instancia.id}` ? (
                              <Check className="w-3 h-3 text-green-400" />
                            ) : (
                              <Copy className="w-3 h-3 text-gray-500" />
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-gray-500">API Key</span>
                        <div className="flex items-center gap-2">
                          <code className="text-xs text-gray-400 bg-black/20 px-2 py-1 rounded">
                            {showApiKey[instancia.id]
                              ? instancia.api_key
                              : '•'.repeat(20)}
                          </code>
                          <button
                            onClick={() => setShowApiKey(prev => ({ ...prev, [instancia.id]: !prev[instancia.id] }))}
                            className="p-1 hover:bg-white/10 rounded"
                          >
                            {showApiKey[instancia.id] ? (
                              <EyeOff className="w-3 h-3 text-gray-500" />
                            ) : (
                              <Eye className="w-3 h-3 text-gray-500" />
                            )}
                          </button>
                          <button
                            onClick={() => copyToClipboard(instancia.api_key, `key-${instancia.id}`)}
                            className="p-1 hover:bg-white/10 rounded"
                          >
                            {copiedId === `key-${instancia.id}` ? (
                              <Check className="w-3 h-3 text-green-400" />
                            ) : (
                              <Copy className="w-3 h-3 text-gray-500" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* QR Code */}
                    {instancia.qr_code && instancia.status !== 'connected' && (
                      <div className="mt-4 pt-4 border-t border-white/10 flex flex-col items-center">
                        <p className="text-sm text-gray-400 mb-3">Escaneie o QR Code para conectar</p>
                        <img
                          src={instancia.qr_code}
                          alt="QR Code"
                          className="w-48 h-48 rounded-lg"
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'quick_replies' && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <button
                onClick={() => setShowNewResposta(true)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                style={{
                  backgroundColor: `${accentColor}20`,
                  color: accentColor,
                  border: `1px solid ${accentColor}40`
                }}
              >
                <Plus className="w-4 h-4" />
                Nova Resposta
              </button>
            </div>

            {respostasRapidas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                <MessageSquare className="w-16 h-16 mb-4 opacity-50" />
                <p className="text-lg">Nenhuma resposta rapida</p>
                <p className="text-sm mt-2">Crie atalhos para mensagens frequentes</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-4">
                {respostasRapidas.map(resposta => (
                  <div
                    key={resposta.id}
                    className="p-4 rounded-xl bg-white/5 border border-white/10"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-medium text-white">{resposta.titulo}</h4>
                        <code className="text-xs px-2 py-0.5 rounded bg-white/10" style={{ color: accentColor }}>
                          {resposta.atalho}
                        </code>
                      </div>
                      <button
                        onClick={() => deleteRespostaRapida(resposta.id)}
                        className="p-1 hover:bg-red-500/20 rounded text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-sm text-gray-400 mt-2 line-clamp-3">{resposta.conteudo}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* New Instance Modal */}
      <AnimatePresence>
        {showNewInstance && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6"
            onClick={() => setShowNewInstance(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1A1A2E] rounded-xl w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-white mb-4">Nova Instancia WhatsApp</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Nome</label>
                  <input
                    type="text"
                    value={newInstance.nome}
                    onChange={(e) => setNewInstance(prev => ({ ...prev, nome: e.target.value }))}
                    placeholder="Ex: WhatsApp Principal"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">URL da API Evolution</label>
                  <input
                    type="text"
                    value={newInstance.api_url}
                    onChange={(e) => setNewInstance(prev => ({ ...prev, api_url: e.target.value }))}
                    placeholder="https://sua-api.com"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">API Key</label>
                  <input
                    type="password"
                    value={newInstance.api_key}
                    onChange={(e) => setNewInstance(prev => ({ ...prev, api_key: e.target.value }))}
                    placeholder="Sua chave de API"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Nome da Instancia</label>
                  <input
                    type="text"
                    value={newInstance.instance_name}
                    onChange={(e) => setNewInstance(prev => ({ ...prev, instance_name: e.target.value }))}
                    placeholder="Nome configurado na Evolution"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowNewInstance(false)}
                  className="px-4 py-2 bg-white/10 rounded-lg text-sm text-gray-400 hover:bg-white/20 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={createInstancia}
                  className="px-6 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ backgroundColor: accentColor, color: '#000' }}
                >
                  Salvar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* New Quick Reply Modal */}
      <AnimatePresence>
        {showNewResposta && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6"
            onClick={() => setShowNewResposta(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1A1A2E] rounded-xl w-full max-w-md p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-lg font-semibold text-white mb-4">Nova Resposta Rapida</h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Titulo</label>
                  <input
                    type="text"
                    value={newResposta.titulo}
                    onChange={(e) => setNewResposta(prev => ({ ...prev, titulo: e.target.value }))}
                    placeholder="Ex: Tabela de Precos"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Atalho</label>
                  <input
                    type="text"
                    value={newResposta.atalho}
                    onChange={(e) => setNewResposta(prev => ({ ...prev, atalho: e.target.value }))}
                    placeholder="Ex: /preco"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Conteudo</label>
                  <textarea
                    value={newResposta.conteudo}
                    onChange={(e) => setNewResposta(prev => ({ ...prev, conteudo: e.target.value }))}
                    placeholder="Mensagem que sera enviada"
                    rows={4}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20 resize-none"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowNewResposta(false)}
                  className="px-4 py-2 bg-white/10 rounded-lg text-sm text-gray-400 hover:bg-white/20 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={createRespostaRapida}
                  className="px-6 py-2 rounded-lg text-sm font-medium transition-colors"
                  style={{ backgroundColor: accentColor, color: '#000' }}
                >
                  Salvar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
