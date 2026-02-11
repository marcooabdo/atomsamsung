import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Search, Phone, User, FileText, Link2, MessageSquare, Loader2, Building2,
  Minimize2, Maximize2, CheckCircle, XCircle, AlertCircle
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

interface OS {
  id: string;
  numero_os_interna: string | null;
  numero_os_samsung: string | null;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  defeito_reclamado: string | null;
  status_kanban: string | null;
}

interface Unidade {
  id: string;
  nome: string;
}

interface Instancia {
  id: string;
  api_url: string;
  api_key: string;
  instance_name: string;
}

interface Props {
  accentColor: string;
  onClose: () => void;
  onConversaCriada: (conversaId: string) => void;
}

type WhatsAppStatus = 'idle' | 'checking' | 'valid' | 'invalid' | 'error';

interface ExistingConversa {
  id: string;
  cliente_nome: string | null;
}

export function NovaConversaModal({ accentColor, onClose, onConversaCriada }: Props) {
  const { usuario, unidadeAtual, unidades } = useAuth();
  const [telefone, setTelefone] = useState('');
  const [nome, setNome] = useState('');
  const [selectedUnidadeId, setSelectedUnidadeId] = useState<string>(unidadeAtual || '');
  const [osSearch, setOsSearch] = useState('');
  const [osResults, setOsResults] = useState<OS[]>([]);
  const [selectedOS, setSelectedOS] = useState<OS | null>(null);
  const [searchingOS, setSearchingOS] = useState(false);
  const [creating, setCreating] = useState(false);
  const [allUnidades, setAllUnidades] = useState<Unidade[]>([]);
  const [instancia, setInstancia] = useState<Instancia | null>(null);
  const [whatsappStatus, setWhatsappStatus] = useState<WhatsAppStatus>('idle');
  const [whatsappError, setWhatsappError] = useState('');
  const [existingConversa, setExistingConversa] = useState<ExistingConversa | null>(null);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const whatsappCheckTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const phoneCheckTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadUnidades();
    loadInstancia();
  }, []);

  useEffect(() => {
    if (unidadeAtual && !selectedUnidadeId) {
      setSelectedUnidadeId(unidadeAtual);
    }
  }, [unidadeAtual]);

  const loadUnidades = async () => {
    if (unidades && unidades.length > 0) {
      setAllUnidades(unidades);
      return;
    }

    const { data } = await supabase
      .from('unidades')
      .select('id, nome')
      .order('nome');

    if (data) {
      setAllUnidades(data);
    }
  };

  const loadInstancia = async () => {
    const { data } = await supabase
      .from('atom_connect_instancias')
      .select('id, api_url, api_key, instance_name')
      .eq('status', 'connected')
      .limit(1)
      .maybeSingle();

    if (data) {
      setInstancia(data);
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

  const checkWhatsAppNumber = useCallback(async (phone: string) => {
    const formattedPhone = formatPhoneNumber(phone);

    if (formattedPhone.length < 12) {
      setWhatsappStatus('idle');
      return;
    }

    if (!instancia) {
      setWhatsappStatus('error');
      setWhatsappError('Nenhuma instancia conectada');
      return;
    }

    setWhatsappStatus('checking');
    setWhatsappError('');

    try {
      const response = await fetch(`${instancia.api_url}/chat/whatsappNumbers/${instancia.instance_name}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': instancia.api_key
        },
        body: JSON.stringify({
          numbers: [formattedPhone]
        })
      });

      if (!response.ok) {
        throw new Error('Erro ao verificar numero');
      }

      const result = await response.json();
      console.log('WhatsApp check result:', result);

      if (result && Array.isArray(result) && result.length > 0) {
        const numberResult = result[0];
        if (numberResult.exists === true || numberResult.jid) {
          setWhatsappStatus('valid');
          if (numberResult.name) {
            setNome(prev => prev || numberResult.name);
          }
        } else {
          setWhatsappStatus('invalid');
          setWhatsappError('Numero nao possui WhatsApp');
        }
      } else {
        setWhatsappStatus('invalid');
        setWhatsappError('Numero nao encontrado no WhatsApp');
      }
    } catch (error) {
      console.error('Erro ao verificar WhatsApp:', error);
      setWhatsappStatus('error');
      setWhatsappError('Nao foi possivel verificar o numero');
    }
  }, [instancia]);

  const checkExistingConversation = useCallback(async (phone: string) => {
    const formattedPhone = formatPhoneNumber(phone);
    if (formattedPhone.length < 12 || !selectedUnidadeId) {
      setExistingConversa(null);
      return;
    }

    const { data } = await supabase
      .from('atom_connect_conversas')
      .select('id, cliente_nome')
      .eq('cliente_telefone', formattedPhone)
      .eq('unidade_id', selectedUnidadeId)
      .maybeSingle();

    setExistingConversa(data);
  }, [selectedUnidadeId]);

  const autoLinkOS = useCallback(async (phone: string) => {
    if (!selectedUnidadeId || selectedOS) return;

    const formattedPhone = formatPhoneNumber(phone);
    const phoneWithoutDDI = phone.replace(/\D/g, '');

    const { data: osMatch } = await supabase
      .from('os')
      .select('id, numero_os_interna, numero_os_samsung, cliente_nome, cliente_telefone, defeito_reclamado, status_kanban')
      .eq('unidade_id', selectedUnidadeId)
      .or(`cliente_telefone.eq.${formattedPhone},cliente_telefone.eq.${phoneWithoutDDI},cliente_telefone.ilike.%${phoneWithoutDDI}%`)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (osMatch) {
      setSelectedOS(osMatch);
      if (osMatch.cliente_nome && !nome) {
        setNome(osMatch.cliente_nome);
      }
    }
  }, [selectedUnidadeId, selectedOS, nome]);

  useEffect(() => {
    if (whatsappCheckTimeout.current) {
      clearTimeout(whatsappCheckTimeout.current);
    }
    if (phoneCheckTimeout.current) {
      clearTimeout(phoneCheckTimeout.current);
    }

    const cleanPhone = telefone.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setWhatsappStatus('idle');
      setExistingConversa(null);
      return;
    }

    whatsappCheckTimeout.current = setTimeout(() => {
      checkWhatsAppNumber(telefone);
    }, 800);

    phoneCheckTimeout.current = setTimeout(() => {
      checkExistingConversation(telefone);
      autoLinkOS(telefone);
    }, 500);

    return () => {
      if (whatsappCheckTimeout.current) {
        clearTimeout(whatsappCheckTimeout.current);
      }
      if (phoneCheckTimeout.current) {
        clearTimeout(phoneCheckTimeout.current);
      }
    };
  }, [telefone, checkWhatsAppNumber, checkExistingConversation, autoLinkOS]);

  const searchOS = useCallback(async (term: string) => {
    if (!selectedUnidadeId) {
      setOsResults([]);
      return;
    }

    if (!term || term.length < 2) {
      setOsResults([]);
      return;
    }

    setSearchingOS(true);

    try {
      const { data, error } = await supabase
        .from('os')
        .select('id, numero_os_interna, numero_os_samsung, cliente_nome, cliente_telefone, defeito_reclamado, status_kanban')
        .eq('unidade_id', selectedUnidadeId)
        .or(`numero_os_interna.ilike.%${term}%,numero_os_samsung.ilike.%${term}%,cliente_nome.ilike.%${term}%,cliente_telefone.ilike.%${term}%,cliente_cpf_cnpj.ilike.%${term}%`)
        .order('created_at', { ascending: false })
        .limit(15);

      if (!error && data) {
        setOsResults(data);
      } else {
        setOsResults([]);
      }
    } catch (err) {
      setOsResults([]);
    } finally {
      setSearchingOS(false);
    }
  }, [selectedUnidadeId]);

  useEffect(() => {
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }

    if (!osSearch || osSearch.length < 2) {
      setOsResults([]);
      return;
    }

    searchTimeout.current = setTimeout(() => {
      searchOS(osSearch);
    }, 300);

    return () => {
      if (searchTimeout.current) {
        clearTimeout(searchTimeout.current);
      }
    };
  }, [osSearch, searchOS]);

  const selectOS = (os: OS) => {
    setSelectedOS(os);
    if (os.cliente_telefone) setTelefone(os.cliente_telefone.replace(/\D/g, ''));
    if (os.cliente_nome) setNome(os.cliente_nome);
    setOsSearch('');
    setOsResults([]);
  };

  const handleCreate = async () => {
    const formattedPhone = formatPhoneNumber(telefone);

    if (formattedPhone.length < 12) {
      alert('Informe um telefone valido com DDD');
      return;
    }
    if (!selectedUnidadeId) {
      alert('Selecione uma unidade');
      return;
    }
    if (whatsappStatus === 'invalid') {
      alert('Este numero nao possui WhatsApp cadastrado');
      return;
    }

    setCreating(true);

    try {
      const { data: existing } = await supabase
        .from('atom_connect_conversas')
        .select('id')
        .eq('cliente_telefone', formattedPhone)
        .eq('unidade_id', selectedUnidadeId)
        .maybeSingle();

      if (existing) {
        onConversaCriada(existing.id);
        setCreating(false);
        return;
      }

      const { data: firstColumn } = await supabase
        .from('atom_connect_pipeline_colunas')
        .select('id')
        .order('ordem', { ascending: true })
        .limit(1)
        .maybeSingle();

      const { data: newConversa, error } = await supabase
        .from('atom_connect_conversas')
        .insert({
          unidade_id: selectedUnidadeId,
          cliente_telefone: formattedPhone,
          cliente_nome: nome || null,
          os_id: selectedOS?.id || null,
          coluna_pipeline: firstColumn?.id || 'bot_triagem',
          atendente_id: usuario?.id || null,
          is_bot_ativo: false,
          tipo_atendimento: 'whatsapp',
          prioridade: 'normal',
          ultima_mensagem_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar conversa:', error);
        alert('Erro ao criar conversa: ' + error.message);
        setCreating(false);
        return;
      }

      if (newConversa) {
        onConversaCriada(newConversa.id);
      }
    } catch (err) {
      console.error('Erro inesperado ao criar conversa:', err);
      alert('Erro inesperado ao criar conversa');
      setCreating(false);
    }
  };

  const getWhatsAppStatusIcon = () => {
    switch (whatsappStatus) {
      case 'checking':
        return <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" />;
      case 'valid':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'invalid':
        return <XCircle className="w-4 h-4 text-red-400" />;
      case 'error':
        return <AlertCircle className="w-4 h-4 text-yellow-400" />;
      default:
        return null;
    }
  };

  const canCreate = telefone.replace(/\D/g, '').length >= 10 &&
                    selectedUnidadeId &&
                    whatsappStatus !== 'invalid' &&
                    whatsappStatus !== 'checking';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="w-full max-w-lg bg-[#0d0d1e] rounded-2xl border border-white/[0.08] flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 px-5 py-4 flex items-center justify-between border-b border-white/[0.06]">
          <div className="flex items-center gap-3">
            <div
              className="w-9 h-9 rounded-lg flex items-center justify-center"
              style={{ background: `${accentColor}20` }}
            >
              <MessageSquare className="w-4 h-4" style={{ color: accentColor }} />
            </div>
            <div>
              <h1 className="text-sm font-semibold text-white">Nova Conversa</h1>
              <p className="text-[10px] text-white/40">Iniciar atendimento via WhatsApp</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/[0.06] transition-colors"
          >
            <X className="w-5 h-5 text-white/40" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-5 space-y-4">
            {/* Unidade */}
            <div>
              <label className="block text-[11px] font-medium text-white/50 mb-1.5 uppercase tracking-wider">
                Unidade *
              </label>
              <div className="relative">
                <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <select
                  value={selectedUnidadeId}
                  onChange={(e) => {
                    setSelectedUnidadeId(e.target.value);
                    setSelectedOS(null);
                    setOsResults([]);
                  }}
                  className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white focus:outline-none focus:border-cyan-500/40 appearance-none cursor-pointer hover:bg-white/[0.05] transition-colors"
                >
                  <option value="" className="bg-[#12122a]">Selecione uma unidade</option>
                  {allUnidades.map(u => (
                    <option key={u.id} value={u.id} className="bg-[#12122a]">{u.nome}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Telefone */}
            <div>
              <label className="block text-[11px] font-medium text-white/50 mb-1.5 uppercase tracking-wider">
                Telefone do Cliente *
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <div className="absolute left-9 top-1/2 -translate-y-1/2 text-sm text-white/40 font-medium">
                  +55
                </div>
                <input
                  type="text"
                  value={telefone}
                  onChange={(e) => setTelefone(e.target.value.replace(/\D/g, ''))}
                  placeholder="11999999999"
                  className="w-full pl-20 pr-10 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/40 transition-colors"
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {getWhatsAppStatusIcon()}
                </div>
              </div>
              {whatsappStatus === 'valid' && (
                <p className="mt-2 text-xs text-green-400 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" />
                  Numero verificado no WhatsApp
                </p>
              )}
              {whatsappStatus === 'invalid' && (
                <p className="mt-2 text-xs text-red-400 flex items-center gap-1">
                  <XCircle className="w-3 h-3" />
                  {whatsappError || 'Este numero nao possui WhatsApp'}
                </p>
              )}
              {whatsappStatus === 'error' && (
                <p className="mt-2 text-xs text-yellow-400 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" />
                  {whatsappError || 'Nao foi possivel verificar'}
                </p>
              )}
              {whatsappStatus === 'checking' && (
                <p className="mt-2 text-xs text-cyan-400 flex items-center gap-1">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Verificando numero no WhatsApp...
                </p>
              )}
              {existingConversa && (
                <div className="mt-2 p-2.5 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                  <p className="text-xs text-yellow-400 flex items-center gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                    <span>
                      Este numero ja possui uma conversa ativa
                      {existingConversa.cliente_nome && ` (${existingConversa.cliente_nome})`}
                    </span>
                  </p>
                  <button
                    onClick={() => onConversaCriada(existingConversa.id)}
                    className="mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded text-[11px] font-medium bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors"
                  >
                    <MessageSquare className="w-3 h-3" />
                    Abrir conversa existente
                  </button>
                </div>
              )}
              <p className="mt-1 text-[10px] text-white/30">
                Digite apenas os numeros. O DDI +55 sera adicionado automaticamente.
              </p>
            </div>

            {/* Nome */}
            <div>
              <label className="block text-[11px] font-medium text-white/50 mb-1.5 uppercase tracking-wider">
                Nome do Cliente
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input
                  type="text"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome do cliente (opcional)"
                  className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/40 transition-colors"
                />
              </div>
            </div>

            {/* Vincular OS */}
            <div>
              <label className="block text-[11px] font-medium text-white/50 mb-1.5 uppercase tracking-wider">
                Vincular a OS (Opcional)
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <input
                  type="text"
                  value={osSearch}
                  onChange={(e) => setOsSearch(e.target.value)}
                  placeholder="Digite OS Interna, Samsung, cliente ou telefone..."
                  disabled={!selectedUnidadeId}
                  className="w-full pl-10 pr-10 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-sm text-white placeholder-white/20 focus:outline-none focus:border-cyan-500/40 disabled:opacity-50 transition-colors"
                />
                {searchingOS && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400 animate-spin" />
                )}
              </div>

              {!selectedUnidadeId && osSearch && (
                <p className="text-xs text-yellow-500 mt-2">Selecione uma unidade primeiro</p>
              )}

              {osResults.length > 0 && (
                <div className="mt-2 max-h-48 overflow-y-auto bg-[#080814] rounded-lg border border-white/[0.08]">
                  {osResults.map(os => (
                    <button
                      key={os.id}
                      onClick={() => selectOS(os)}
                      className="w-full flex items-start gap-2 p-3 hover:bg-white/[0.04] transition-colors border-b border-white/[0.04] last:border-0 text-left"
                    >
                      <FileText className="w-4 h-4 text-white/30 mt-0.5 flex-shrink-0" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          {os.numero_os_interna && (
                            <span className="text-[11px] font-medium text-cyan-400">
                              OS: {os.numero_os_interna}
                            </span>
                          )}
                          {os.numero_os_samsung && (
                            <span className="text-[11px] text-orange-400">Samsung: {os.numero_os_samsung}</span>
                          )}
                        </div>
                        <p className="text-xs text-white/80 truncate">{os.cliente_nome}</p>
                        {os.cliente_telefone && (
                          <p className="text-[10px] text-white/40">{os.cliente_telefone}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {osSearch && osSearch.length >= 2 && !searchingOS && osResults.length === 0 && selectedUnidadeId && (
                <p className="text-[11px] text-white/40 mt-2">Nenhuma OS encontrada para "{osSearch}"</p>
              )}

              {selectedOS && (
                <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-cyan-500/10 border border-cyan-500/20 rounded-lg">
                  <Link2 className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-cyan-400">
                      OS: {selectedOS.numero_os_interna || selectedOS.numero_os_samsung}
                    </span>
                    <span className="text-xs text-white/50 ml-2">{selectedOS.cliente_nome}</span>
                  </div>
                  <button
                    onClick={() => setSelectedOS(null)}
                    className="p-1 hover:bg-white/10 rounded transition-colors"
                  >
                    <X className="w-3 h-3 text-white/40" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 px-5 py-3 border-t border-white/[0.06] flex items-center justify-between">
          <p className="text-[10px] text-white/30">
            {!instancia && 'Nenhuma instancia conectada'}
            {instancia && `Conectado: ${instancia.instance_name}`}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-medium text-white/50 hover:text-white/80 hover:bg-white/[0.04] transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={!canCreate || creating}
              className="flex items-center gap-1.5 px-5 py-2 rounded-lg text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                backgroundColor: canCreate && !creating ? accentColor : 'rgba(255,255,255,0.1)',
                color: canCreate && !creating ? '#000' : 'rgba(255,255,255,0.5)'
              }}
            >
              {creating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <MessageSquare className="w-3.5 h-3.5" />
                  Iniciar Conversa
                </>
              )}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
}
