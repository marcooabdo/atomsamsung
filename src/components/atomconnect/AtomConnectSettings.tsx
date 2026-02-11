import { useState, useEffect, useRef } from 'react';
import {
  Settings, Smartphone, QrCode, Wifi, WifiOff, RefreshCw, Trash2,
  Plus, Copy, Check, Eye, EyeOff, ExternalLink, AlertTriangle,
  Save, MessageSquare, Zap, Loader2, CheckCircle2, XCircle, Phone
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

interface Props {
  accentColor: string;
}

interface Instancia {
  id: string;
  unidade_id: string;
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

const EVOLUTION_URL = import.meta.env.VITE_EVOLUTION_URL || '';
const EVOLUTION_API_KEY = import.meta.env.VITE_EVOLUTION_API_KEY || '';

export function AtomConnectSettings({ accentColor }: Props) {
  const { unidadeAtual, unidades } = useAuth();
  const [activeTab, setActiveTab] = useState<'instances' | 'quick_replies' | 'pipeline'>('instances');
  const [instancias, setInstancias] = useState<Instancia[]>([]);
  const [respostasRapidas, setRespostasRapidas] = useState<RespostaRapida[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewInstance, setShowNewInstance] = useState(false);
  const [showApiKey, setShowApiKey] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [connectingInstance, setConnectingInstance] = useState<string | null>(null);
  const [qrCodeModal, setQrCodeModal] = useState<{ instancia: Instancia; qrCode: string } | null>(null);
  const qrPollingRef = useRef<NodeJS.Timeout | null>(null);

  const [newInstance, setNewInstance] = useState({
    nome: '',
    api_url: EVOLUTION_URL,
    api_key: EVOLUTION_API_KEY,
    instance_name: '',
    unidade_id: unidadeAtual || ''
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
    let query = supabase
      .from('atom_connect_instancias')
      .select('*')
      .order('created_at');

    if (unidadeAtual) {
      query = query.eq('unidade_id', unidadeAtual);
    }

    const { data } = await query;
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

  const [creatingInstance, setCreatingInstance] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const createInstancia = async () => {
    if (!newInstance.nome || !newInstance.instance_name || !newInstance.unidade_id) {
      alert('Preencha todos os campos obrigatorios');
      return;
    }

    setCreatingInstance(true);
    setCreateError(null);

    try {
      const evolutionResult = await createEvolutionInstance(newInstance.instance_name);

      if (evolutionResult.error) {
        throw new Error(evolutionResult.error);
      }

      const { data: instanciaData, error } = await supabase
        .from('atom_connect_instancias')
        .insert({
          unidade_id: newInstance.unidade_id,
          nome: newInstance.nome,
          api_url: newInstance.api_url || EVOLUTION_URL,
          api_key: newInstance.api_key || EVOLUTION_API_KEY,
          instance_name: newInstance.instance_name,
          status: 'disconnected'
        })
        .select()
        .single();

      if (error) throw error;

      setShowNewInstance(false);
      setNewInstance({ nome: '', api_url: EVOLUTION_URL, api_key: EVOLUTION_API_KEY, instance_name: '', unidade_id: unidadeAtual || '' });
      loadInstancias();

      if (instanciaData) {
        setTimeout(() => getQRCode(instanciaData), 500);
      }
    } catch (error: any) {
      console.error('Erro ao criar instancia:', error);
      if (error.message?.includes('already')) {
        const { data: instanciaData } = await supabase
          .from('atom_connect_instancias')
          .insert({
            unidade_id: unidadeAtual,
            nome: newInstance.nome,
            api_url: newInstance.api_url || EVOLUTION_URL,
            api_key: newInstance.api_key || EVOLUTION_API_KEY,
            instance_name: newInstance.instance_name,
            status: 'disconnected'
          })
          .select()
          .single();

        setShowNewInstance(false);
        setNewInstance({ nome: '', api_url: EVOLUTION_URL, api_key: EVOLUTION_API_KEY, instance_name: '', unidade_id: unidadeAtual || '' });
        loadInstancias();

        if (instanciaData) {
          setTimeout(() => getQRCode(instanciaData), 500);
        }
      } else {
        setCreateError(error.message || 'Erro ao criar instancia');
      }
    } finally {
      setCreatingInstance(false);
    }
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
      console.log('Check connection response:', data);

      const state = data?.state || data?.instance?.state;
      const isConnected = state === 'open' || state === 'connected';
      const newStatus = isConnected ? 'connected' : 'disconnected';

      const phoneNumber = data?.instance?.phoneNumber ||
                         data?.instance?.wuid?.split('@')[0] ||
                         data?.phoneNumber ||
                         null;

      await supabase
        .from('atom_connect_instancias')
        .update({
          status: newStatus,
          phone_number: phoneNumber
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
    setConnectingInstance(instancia.id);
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

        setQrCodeModal({ instancia, qrCode: data.base64 });
        startQRPolling(instancia);
      } else if (data.code) {
        const qrBase64 = `data:image/png;base64,${data.code}`;
        await supabase
          .from('atom_connect_instancias')
          .update({ qr_code: qrBase64, status: 'connecting' })
          .eq('id', instancia.id);

        setQrCodeModal({ instancia, qrCode: qrBase64 });
        startQRPolling(instancia);
      }
    } catch (error) {
      console.error('Erro ao obter QR Code:', error);
      alert('Erro ao gerar QR Code. Verifique se a instancia existe na Evolution API.');
    } finally {
      setConnectingInstance(null);
    }
  };

  const startQRPolling = (instancia: Instancia) => {
    if (qrPollingRef.current) {
      clearInterval(qrPollingRef.current);
    }

    qrPollingRef.current = setInterval(async () => {
      try {
        const response = await fetch(`${instancia.api_url}/instance/connectionState/${instancia.instance_name}`, {
          headers: { 'apikey': instancia.api_key }
        });

        const data = await response.json();
        console.log('Connection state:', data);

        const state = data?.state || data?.instance?.state;
        const isConnected = state === 'open' || state === 'connected';

        if (isConnected) {
          const phoneNumber = data?.instance?.phoneNumber ||
                             data?.instance?.wuid?.split('@')[0] ||
                             data?.phoneNumber ||
                             null;

          await supabase
            .from('atom_connect_instancias')
            .update({
              status: 'connected',
              phone_number: phoneNumber,
              qr_code: null
            })
            .eq('id', instancia.id);

          if (qrPollingRef.current) {
            clearInterval(qrPollingRef.current);
            qrPollingRef.current = null;
          }
          setQrCodeModal(null);
          loadInstancias();
        } else if (state === 'close' || state === 'disconnected') {
          const connectResponse = await fetch(`${instancia.api_url}/instance/connect/${instancia.instance_name}`, {
            headers: { 'apikey': instancia.api_key }
          });
          const connectData = await connectResponse.json();

          if (connectData.base64 || connectData.code) {
            const newQR = connectData.base64 || `data:image/png;base64,${connectData.code}`;
            setQrCodeModal({ instancia, qrCode: newQR });
          }
        }
      } catch (error) {
        console.error('Erro ao verificar conexao:', error);
      }
    }, 3000);
  };

  const stopQRPolling = () => {
    if (qrPollingRef.current) {
      clearInterval(qrPollingRef.current);
      qrPollingRef.current = null;
    }
    setQrCodeModal(null);
  };

  useEffect(() => {
    return () => {
      if (qrPollingRef.current) {
        clearInterval(qrPollingRef.current);
      }
    };
  }, []);

  const createEvolutionInstance = async (instanceName: string) => {
    try {
      const response = await fetch(`${EVOLUTION_URL}/instance/create`, {
        method: 'POST',
        headers: {
          'apikey': EVOLUTION_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          instanceName,
          qrcode: true,
          integration: 'WHATSAPP-BAILEYS'
        })
      });

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Erro ao criar instancia:', error);
      throw error;
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
              <div className="flex flex-col items-center justify-center py-16 text-gray-500">
                <div className="w-24 h-24 rounded-full bg-gradient-to-br from-green-500/20 to-green-500/5 flex items-center justify-center mb-6">
                  <Phone className="w-12 h-12 text-green-400" />
                </div>
                <p className="text-xl font-semibold text-white mb-2">Conecte seu WhatsApp</p>
                <p className="text-sm text-gray-400 text-center max-w-md mb-6">
                  Configure uma instancia do Evolution API para comecar a receber e enviar mensagens do WhatsApp
                </p>
                <button
                  onClick={() => setShowNewInstance(true)}
                  className="flex items-center gap-3 px-6 py-3 rounded-xl text-base font-semibold transition-all transform hover:scale-105"
                  style={{
                    backgroundColor: accentColor,
                    color: '#000',
                    boxShadow: `0 0 30px ${accentColor}40`
                  }}
                >
                  <QrCode className="w-5 h-5" />
                  Conectar WhatsApp
                </button>
              </div>
            ) : (
              <div className="grid gap-4">
                {instancias.map(instancia => (
                  <div
                    key={instancia.id}
                    className="p-6 rounded-xl bg-white/5 border border-white/10 hover:bg-white/[0.07] transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-14 h-14 rounded-xl flex items-center justify-center ${
                            instancia.status === 'connected'
                              ? 'bg-green-500/20 ring-2 ring-green-500/30'
                              : instancia.status === 'connecting'
                              ? 'bg-yellow-500/20 ring-2 ring-yellow-500/30'
                              : 'bg-red-500/20 ring-2 ring-red-500/30'
                          }`}
                        >
                          {instancia.status === 'connected' ? (
                            <CheckCircle2 className="w-7 h-7 text-green-400" />
                          ) : instancia.status === 'connecting' ? (
                            <Loader2 className="w-7 h-7 text-yellow-400 animate-spin" />
                          ) : (
                            <XCircle className="w-7 h-7 text-red-400" />
                          )}
                        </div>
                        <div>
                          <h3 className="font-semibold text-white text-lg">{instancia.nome}</h3>
                          <p className="text-sm text-gray-400">
                            {instancia.instance_name}
                            {unidades?.find(u => u.id === instancia.unidade_id) && (
                              <span className="ml-2 px-2 py-0.5 rounded text-xs bg-white/10 text-gray-300">
                                {unidades.find(u => u.id === instancia.unidade_id)?.nome}
                              </span>
                            )}
                          </p>
                          {instancia.phone_number && (
                            <div className="flex items-center gap-2 mt-1">
                              <Phone className="w-3 h-3 text-green-400" />
                              <span className="text-sm text-green-400 font-medium">
                                {instancia.phone_number}
                              </span>
                            </div>
                          )}
                          {instancia.status === 'disconnected' && (
                            <span className="text-xs text-red-400">Desconectado</span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {instancia.status === 'disconnected' && (
                          <button
                            onClick={() => getQRCode(instancia)}
                            disabled={connectingInstance === instancia.id}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
                            style={{
                              backgroundColor: accentColor,
                              color: '#000'
                            }}
                          >
                            {connectingInstance === instancia.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <QrCode className="w-4 h-4" />
                            )}
                            Conectar
                          </button>
                        )}
                        <button
                          onClick={() => checkConnectionStatus(instancia)}
                          className="p-2 rounded-lg bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
                          title="Verificar conexao"
                        >
                          <RefreshCw className="w-4 h-4" />
                        </button>
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
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-green-500/20 mb-4">
                  <Phone className="w-7 h-7 text-green-400" />
                </div>
                <h3 className="text-xl font-bold text-white">Conectar WhatsApp</h3>
                <p className="text-sm text-gray-400 mt-1">Configure sua instancia do Evolution API</p>
              </div>

              {createError && (
                <div className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg flex items-center gap-2 text-sm text-red-400">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {createError}
                </div>
              )}

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Nome da Conexao</label>
                  <input
                    type="text"
                    value={newInstance.nome}
                    onChange={(e) => setNewInstance(prev => ({ ...prev, nome: e.target.value }))}
                    placeholder="Ex: WhatsApp Comercial"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Identificador da Instancia</label>
                  <input
                    type="text"
                    value={newInstance.instance_name}
                    onChange={(e) => setNewInstance(prev => ({ ...prev, instance_name: e.target.value.toLowerCase().replace(/[^a-z0-9-_]/g, '') }))}
                    placeholder="Ex: whatsapp-comercial"
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20"
                  />
                  <p className="text-xs text-gray-500 mt-1">Use apenas letras minusculas, numeros e hifens</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Unidade *</label>
                  <select
                    value={newInstance.unidade_id}
                    onChange={(e) => setNewInstance(prev => ({ ...prev, unidade_id: e.target.value }))}
                    className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-white/20"
                  >
                    <option value="" className="bg-[#1A1A2E]">Selecione a unidade</option>
                    {(unidades || []).map(u => (
                      <option key={u.id} value={u.id} className="bg-[#1A1A2E]">
                        {u.nome}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">A instancia sera vinculada a esta unidade</p>
                </div>

                {EVOLUTION_URL && (
                  <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                    <div className="flex items-center gap-2 text-sm text-green-400">
                      <CheckCircle2 className="w-4 h-4" />
                      API Evolution configurada
                    </div>
                    <p className="text-xs text-gray-400 mt-1 truncate">{EVOLUTION_URL}</p>
                  </div>
                )}
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowNewInstance(false);
                    setCreateError(null);
                  }}
                  className="flex-1 px-4 py-3 bg-white/10 rounded-lg text-sm text-gray-400 hover:bg-white/20 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={createInstancia}
                  disabled={creatingInstance}
                  className="flex-1 px-4 py-3 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  style={{ backgroundColor: accentColor, color: '#000' }}
                >
                  {creatingInstance ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Criando...
                    </>
                  ) : (
                    <>
                      <QrCode className="w-4 h-4" />
                      Criar e Conectar
                    </>
                  )}
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

      {/* QR Code Modal */}
      <AnimatePresence>
        {qrCodeModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-6"
            onClick={stopQRPolling}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gradient-to-br from-[#1A1A2E] to-[#0F0F1A] rounded-2xl w-full max-w-lg p-8 border border-white/10"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="text-center mb-6">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-500/20 mb-4">
                  <Phone className="w-8 h-8 text-green-400" />
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">Conectar WhatsApp</h3>
                <p className="text-gray-400">
                  Escaneie o QR Code abaixo com seu WhatsApp para conectar
                </p>
              </div>

              <div className="flex justify-center mb-6">
                <div className="p-4 bg-white rounded-2xl shadow-2xl">
                  <img
                    src={qrCodeModal.qrCode}
                    alt="QR Code WhatsApp"
                    className="w-64 h-64"
                  />
                </div>
              </div>

              <div className="flex items-center justify-center gap-2 text-sm text-gray-400 mb-6">
                <Loader2 className="w-4 h-4 animate-spin" style={{ color: accentColor }} />
                <span>Aguardando conexao...</span>
              </div>

              <div className="bg-white/5 rounded-xl p-4 mb-6">
                <h4 className="text-sm font-medium text-white mb-3">Como conectar:</h4>
                <ol className="text-sm text-gray-400 space-y-2">
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-xs flex-shrink-0" style={{ color: accentColor }}>1</span>
                    Abra o WhatsApp no seu celular
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-xs flex-shrink-0" style={{ color: accentColor }}>2</span>
                    Toque em Menu ou Configuracoes e selecione Aparelhos conectados
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-xs flex-shrink-0" style={{ color: accentColor }}>3</span>
                    Toque em Conectar um aparelho e aponte a camera para o QR Code
                  </li>
                </ol>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={stopQRPolling}
                  className="px-6 py-2 bg-white/10 rounded-lg text-sm text-gray-400 hover:bg-white/20 transition-colors"
                >
                  Cancelar
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
