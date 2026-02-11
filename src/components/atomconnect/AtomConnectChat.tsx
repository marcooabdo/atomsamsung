import { useState, useEffect, useRef, useCallback } from 'react';
import {
  X, Send, Paperclip, Mic, Smile, Phone, Video,
  User, Link2, FileText, Play, Download, Check,
  CheckCheck, Clock, Bot, ArrowRight, ChevronDown, Zap, MessageSquare,
  MapPin, Calendar, Navigation, AlertTriangle, ExternalLink, Edit2,
  Trash2, Upload, File, ImageIcon as ImageLucide, GripVertical,
  PanelRightClose, PanelRight, Search, Loader2
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { motion, AnimatePresence } from 'framer-motion';

interface Conversa {
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
  agendamento_data?: string;
  agendamento_hora?: string;
  tecnico_ih_id?: string;
  status_ih?: string;
  endereco_visita?: string;
  created_at: string;
}

interface Mensagem {
  id: string;
  conversa_id: string;
  message_id: string | null;
  from_me: boolean;
  tipo: string;
  conteudo: string | null;
  caption: string | null;
  media_url: string | null;
  media_mimetype: string | null;
  status: string;
  enviado_por: string | null;
  is_bot: boolean;
  created_at: string;
  edited_at?: string | null;
}

interface OS {
  id: string;
  numero_os_interna: string | null;
  numero_os_samsung: string | null;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  defeito_reclamado: string | null;
  status_kanban: string | null;
  coluna_kanban: string | null;
}

interface Props {
  conversa: Conversa;
  onClose: () => void;
  onUpdate: () => void;
  accentColor: string;
  unidadeId?: string;
}

interface PipelineColuna {
  id: string;
  nome: string;
  cor: string;
}

const EMOJI_LIST = [
  '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂', '🙃', '😉', '😌', '😍', '🥰', '😘',
  '😗', '😙', '😚', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐',
  '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢',
  '👍', '👎', '👌', '✌️', '🤞', '🤟', '🤘', '🤙', '👋', '🖐️', '✋', '👊', '✊', '🤛', '🤜', '🙏',
  '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖',
  '✅', '❌', '⚠️', '🔴', '🟢', '🔵', '⭐', '🌟', '💯', '🎉', '🎊', '🔥', '💪', '🙌', '👏', '🤝'
];

const MIN_CHAT_WIDTH = 500;
const MAX_CHAT_WIDTH = 1400;
const DEFAULT_CHAT_WIDTH = 750;

export function AtomConnectChat({ conversa, onClose, onUpdate, accentColor, unidadeId }: Props) {
  const { usuario, unidadeAtual } = useAuth();
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [colunas, setColunas] = useState<PipelineColuna[]>([]);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [osData, setOsData] = useState<OS | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [atendentes, setAtendentes] = useState<any[]>([]);
  const [showContextPanel, setShowContextPanel] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Mensagem | null>(null);
  const [editText, setEditText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showAttachmentPreview, setShowAttachmentPreview] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: string; name?: string } | null>(null);
  const [chatWidth, setChatWidth] = useState(DEFAULT_CHAT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [showVincularOS, setShowVincularOS] = useState(false);
  const [osSearchTerm, setOsSearchTerm] = useState('');
  const [osSearchResults, setOsSearchResults] = useState<OS[]>([]);
  const [searchingOS, setSearchingOS] = useState(false);
  const [clienteFoto, setClienteFoto] = useState<string | null>(conversa.cliente_foto_url);
  const [usersCache, setUsersCache] = useState<Record<string, string>>({});

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);

  const loadMensagens = useCallback(async () => {
    const { data, error } = await supabase
      .from('atom_connect_mensagens')
      .select('*')
      .eq('conversa_id', conversa.id)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMensagens(data);

      const senderIds = [...new Set(data.filter(m => m.enviado_por).map(m => m.enviado_por))];
      if (senderIds.length > 0) {
        const idsToLoad = senderIds.filter(id => id && !usersCache[id]);
        if (idsToLoad.length > 0) {
          const { data: users } = await supabase
            .from('usuarios')
            .select('id, nome')
            .in('id', idsToLoad);
          if (users) {
            const newCache = { ...usersCache };
            users.forEach(u => { newCache[u.id] = u.nome; });
            setUsersCache(newCache);
          }
        }
      }
    }
    setLoading(false);
  }, [conversa.id, usersCache]);

  useEffect(() => {
    loadMensagens();
    loadColunas();
    loadAtendentes();
    if (conversa.os_id) {
      loadOSData();
    }
    markAsRead();
    setClienteFoto(conversa.cliente_foto_url);
  }, [conversa.id]);

  useEffect(() => {
    const channel = supabase
      .channel(`chat-${conversa.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'atom_connect_mensagens',
          filter: `conversa_id=eq.${conversa.id}`
        },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            const newMsg = payload.new as Mensagem;
            setMensagens(prev => [...prev, newMsg]);
            scrollToBottom();
          } else if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new as Mensagem;
            setMensagens(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setMensagens(prev => prev.filter(m => m.id !== deletedId));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversa.id]);

  useEffect(() => {
    scrollToBottom();
  }, [mensagens]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadColunas = async () => {
    const { data } = await supabase
      .from('atom_connect_pipeline_colunas')
      .select('id, nome, cor')
      .order('ordem');
    if (data) setColunas(data);
  };

  const loadAtendentes = async () => {
    const targetUnidadeId = conversa.unidade_id || unidadeId || unidadeAtual;
    if (!targetUnidadeId) return;
    const { data } = await supabase
      .from('usuarios')
      .select('id, nome, foto_url, cargo')
      .eq('unidade_id', targetUnidadeId)
      .eq('ativo', true);

    if (data) {
      const newCache = { ...usersCache };
      data.forEach(u => { newCache[u.id] = u.nome; });
      if (usuario?.id && usuario?.nome) {
        newCache[usuario.id] = usuario.nome;
      }
      setUsersCache(newCache);
      setAtendentes(data);
    }
  };

  const loadOSData = async () => {
    if (!conversa.os_id) return;
    const { data } = await supabase
      .from('os')
      .select('id, numero_os_interna, numero_os_samsung, cliente_nome, cliente_telefone, defeito_reclamado, status_kanban, coluna_kanban')
      .eq('id', conversa.os_id)
      .maybeSingle();
    if (data) setOsData(data);
  };

  const markAsRead = async () => {
    if (conversa.mensagens_nao_lidas > 0) {
      await supabase
        .from('atom_connect_conversas')
        .update({ mensagens_nao_lidas: 0 })
        .eq('id', conversa.id);
      onUpdate();
    }
  };

  const sendMessage = async () => {
    if ((!inputText.trim() && attachments.length === 0) || sending) return;

    setSending(true);
    const messageContent = inputText.trim();
    setInputText('');

    try {
      if (attachments.length > 0) {
        for (const file of attachments) {
          const fileExt = file.name.split('.').pop();
          const fileName = `${conversa.id}/${Date.now()}.${fileExt}`;

          const { error: uploadError } = await supabase.storage
            .from('atom-connect')
            .upload(fileName, file);

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('atom-connect')
            .getPublicUrl(fileName);

          let tipo = 'document';
          if (file.type.startsWith('image/')) tipo = 'image';
          else if (file.type.startsWith('audio/')) tipo = 'audio';
          else if (file.type.startsWith('video/')) tipo = 'video';

          await supabase
            .from('atom_connect_mensagens')
            .insert({
              conversa_id: conversa.id,
              from_me: true,
              tipo,
              conteudo: publicUrl,
              media_url: publicUrl,
              media_mimetype: file.type,
              caption: file.name,
              status: 'sent',
              enviado_por: usuario?.id,
              is_bot: false
            });
        }
        setAttachments([]);
        setShowAttachmentPreview(false);
      }

      if (messageContent) {
        const { error } = await supabase
          .from('atom_connect_mensagens')
          .insert({
            conversa_id: conversa.id,
            from_me: true,
            tipo: 'text',
            conteudo: messageContent,
            status: 'sent',
            enviado_por: usuario?.id,
            is_bot: false
          });

        if (error) throw error;
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const editMessage = async (msgId: string, newContent: string) => {
    if (!newContent.trim()) return;

    await supabase
      .from('atom_connect_mensagens')
      .update({
        conteudo: newContent.trim(),
        edited_at: new Date().toISOString()
      })
      .eq('id', msgId);

    setEditingMessage(null);
    setEditText('');
  };

  const deleteMessage = async (msgId: string) => {
    if (!confirm('Deseja realmente apagar esta mensagem?')) return;

    await supabase
      .from('atom_connect_mensagens')
      .delete()
      .eq('id', msgId);
  };

  const changeColumn = async (colunaId: string) => {
    await supabase
      .from('atom_connect_conversas')
      .update({ coluna_pipeline: colunaId })
      .eq('id', conversa.id);
    setShowColumnDropdown(false);
    onUpdate();
  };

  const transferConversa = async (toUserId: string) => {
    await supabase
      .from('atom_connect_transferencias')
      .insert({
        conversa_id: conversa.id,
        de_usuario_id: usuario?.id,
        para_usuario_id: toUserId,
        motivo: 'Transferencia manual'
      });

    await supabase
      .from('atom_connect_conversas')
      .update({ atendente_id: toUserId })
      .eq('id', conversa.id);

    setShowTransferModal(false);
    onUpdate();
  };

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = chatWidth;

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  const handleResizeMove = useCallback((e: MouseEvent) => {
    const diff = resizeStartX.current - e.clientX;
    const newWidth = Math.min(MAX_CHAT_WIDTH, Math.max(MIN_CHAT_WIDTH, resizeStartWidth.current + diff));
    setChatWidth(newWidth);
  }, []);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  }, [handleResizeMove]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setAttachments(prev => [...prev, ...files]);
      setShowAttachmentPreview(true);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      setAttachments(prev => [...prev, ...files]);
      setShowAttachmentPreview(true);
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
    if (attachments.length <= 1) {
      setShowAttachmentPreview(false);
    }
  };

  const addEmoji = (emoji: string) => {
    setInputText(prev => prev + emoji);
    setShowEmojiPicker(false);
    inputRef.current?.focus();
  };

  const downloadMedia = (url: string, filename: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const searchOS = useCallback(async (term: string) => {
    const targetUnidadeId = conversa.unidade_id || unidadeId || unidadeAtual;
    if (!targetUnidadeId || !term || term.length < 2) {
      setOsSearchResults([]);
      return;
    }

    setSearchingOS(true);

    try {
      const { data, error } = await supabase
        .from('os')
        .select('id, numero_os_interna, numero_os_samsung, cliente_nome, cliente_telefone, defeito_reclamado, status_kanban, coluna_kanban')
        .eq('unidade_id', targetUnidadeId)
        .or(`numero_os_interna.ilike.%${term}%,numero_os_samsung.ilike.%${term}%,cliente_nome.ilike.%${term}%,cliente_telefone.ilike.%${term}%`)
        .order('created_at', { ascending: false })
        .limit(15);

      if (!error && data) {
        setOsSearchResults(data);
      }
    } catch {
      setOsSearchResults([]);
    } finally {
      setSearchingOS(false);
    }
  }, [conversa.unidade_id, unidadeId, unidadeAtual]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (osSearchTerm.length >= 2) {
        searchOS(osSearchTerm);
      } else {
        setOsSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timeout);
  }, [osSearchTerm, searchOS]);

  const vincularOS = async (os: OS) => {
    await supabase
      .from('atom_connect_conversas')
      .update({
        os_id: os.id,
        cliente_nome: conversa.cliente_nome || os.cliente_nome
      })
      .eq('id', conversa.id);

    setOsData(os);
    setShowVincularOS(false);
    setOsSearchTerm('');
    setOsSearchResults([]);
    onUpdate();
  };

  const desvincularOS = async () => {
    await supabase
      .from('atom_connect_conversas')
      .update({ os_id: null })
      .eq('id', conversa.id);

    setOsData(null);
    onUpdate();
  };

  const currentColuna = colunas.find(c => c.id === conversa.coluna_pipeline);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-3.5 h-3.5 text-gray-500" />;
      case 'sent':
        return <Check className="w-3.5 h-3.5 text-gray-500" />;
      case 'delivered':
        return <CheckCheck className="w-3.5 h-3.5 text-gray-500" />;
      case 'read':
        return <CheckCheck className="w-3.5 h-3.5 text-blue-500" />;
      case 'failed':
        return <AlertTriangle className="w-3.5 h-3.5 text-red-500" />;
      default:
        return null;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'pending': return 'Enviando...';
      case 'sent': return 'Enviada';
      case 'delivered': return 'Entregue';
      case 'read': return 'Visualizada';
      case 'failed': return 'Falhou';
      default: return '';
    }
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatLastSeen = (dateStr: string | null) => {
    if (!dateStr) return 'Nunca';
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'Agora';
    if (minutes < 60) return `${minutes}min atras`;
    if (hours < 24) return `${hours}h atras`;
    if (days < 7) return `${days}d atras`;
    return date.toLocaleDateString('pt-BR');
  };

  const getFileIcon = (mimetype: string) => {
    if (mimetype?.startsWith('image/')) return <ImageLucide className="w-6 h-6" />;
    if (mimetype?.startsWith('video/')) return <Video className="w-6 h-6" />;
    if (mimetype?.startsWith('audio/')) return <Mic className="w-6 h-6" />;
    return <File className="w-6 h-6" />;
  };

  const renderClientPhoto = (size: 'sm' | 'md' | 'lg') => {
    const sizeClasses = {
      sm: 'w-10 h-10',
      md: 'w-14 h-14',
      lg: 'w-20 h-20'
    };

    const iconSizes = {
      sm: 'w-5 h-5',
      md: 'w-7 h-7',
      lg: 'w-10 h-10'
    };

    if (clienteFoto) {
      return (
        <img
          src={clienteFoto}
          alt={conversa.cliente_nome || 'Cliente'}
          className={`${sizeClasses[size]} rounded-full object-cover`}
          onError={() => setClienteFoto(null)}
        />
      );
    }

    return (
      <div
        className={`${sizeClasses[size]} rounded-full flex items-center justify-center`}
        style={{ backgroundColor: `${accentColor}20` }}
      >
        <User className={iconSizes[size]} style={{ color: accentColor }} />
      </div>
    );
  };

  return (
    <motion.div
      ref={chatContainerRef}
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="h-full flex border-l border-white/[0.06] relative"
      style={{
        background: '#0A0A16',
        width: chatWidth,
        minWidth: MIN_CHAT_WIDTH,
        maxWidth: MAX_CHAT_WIDTH
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Resize Handle */}
      <div
        className={`absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-50 group ${isResizing ? 'bg-cyan-500' : 'hover:bg-cyan-500/50'}`}
        onMouseDown={handleResizeStart}
      >
        <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-4 h-12 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <GripVertical className="w-4 h-4 text-cyan-400" />
        </div>
      </div>

      {isDragging && (
        <div className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center border-2 border-dashed rounded-xl ml-1" style={{ borderColor: accentColor }}>
          <div className="text-center">
            <Upload className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor }} />
            <p className="text-xl font-semibold text-white">Solte os arquivos aqui</p>
            <p className="text-sm text-gray-400 mt-2">Imagens, documentos, audios e videos</p>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex-shrink-0 p-4 border-b border-white/10 bg-black/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="relative">
                {renderClientPhoto('md')}
                <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 border-2 border-[#0A0A16] rounded-full" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {conversa.cliente_nome || conversa.cliente_telefone}
                </h3>
                <p className="text-xs text-gray-400 flex items-center gap-1">
                  <Phone className="w-3 h-3" />
                  {conversa.cliente_telefone}
                </p>
                <p className="text-[10px] text-gray-500 mt-0.5">
                  Visto: {formatLastSeen(conversa.ultima_resposta_cliente_at)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setShowContextPanel(!showContextPanel)}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                title={showContextPanel ? 'Ocultar detalhes' : 'Mostrar detalhes'}
              >
                {showContextPanel ? (
                  <PanelRightClose className="w-4 h-4 text-gray-400" />
                ) : (
                  <PanelRight className="w-4 h-4 text-gray-400" />
                )}
              </button>
              <button
                onClick={onClose}
                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
          </div>

          {/* Status Bar */}
          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <div className="relative">
              <button
                onClick={() => setShowColumnDropdown(!showColumnDropdown)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors"
                style={{
                  backgroundColor: `${currentColuna?.cor || '#6B7280'}20`,
                  color: currentColuna?.cor || '#6B7280'
                }}
              >
                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: currentColuna?.cor }} />
                {currentColuna?.nome || 'Selecionar'}
                <ChevronDown className="w-3 h-3" />
              </button>

              <AnimatePresence>
                {showColumnDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="absolute top-full left-0 mt-1 w-44 bg-[#1A1A2E] border border-white/10 rounded-lg shadow-xl z-50 overflow-hidden"
                  >
                    {colunas.map(col => (
                      <button
                        key={col.id}
                        onClick={() => changeColumn(col.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-white/5 transition-colors"
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col.cor }} />
                        <span className="text-white">{col.nome}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {conversa.is_bot_ativo && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] bg-purple-500/20 text-purple-400">
                <Bot className="w-3 h-3" />
                Bot
              </span>
            )}

            {osData && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] bg-blue-500/20 text-blue-400">
                <Link2 className="w-3 h-3" />
                OS #{osData.numero_os_interna || osData.numero_os_samsung}
              </span>
            )}

            <button
              onClick={() => setShowTransferModal(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
            >
              <ArrowRight className="w-3 h-3" />
              Transferir
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          ) : mensagens.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <MessageSquare className="w-12 h-12 mb-3 opacity-50" />
              <p className="text-sm">Nenhuma mensagem ainda</p>
            </div>
          ) : (
            mensagens.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${msg.from_me ? 'justify-end' : 'justify-start'} group`}
              >
                <div className="relative max-w-[70%]">
                  {msg.from_me && (
                    <div className="absolute -left-20 top-1/2 -translate-y-1/2 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {msg.tipo === 'text' && (
                        <button
                          onClick={() => {
                            setEditingMessage(msg);
                            setEditText(msg.conteudo || '');
                          }}
                          className="p-1 rounded bg-white/10 hover:bg-white/20"
                          title="Editar"
                        >
                          <Edit2 className="w-3 h-3 text-gray-400" />
                        </button>
                      )}
                      <button
                        onClick={() => deleteMessage(msg.id)}
                        className="p-1 rounded bg-white/10 hover:bg-red-500/20"
                        title="Apagar"
                      >
                        <Trash2 className="w-3 h-3 text-gray-400 hover:text-red-400" />
                      </button>
                    </div>
                  )}

                  <div
                    className={`rounded-2xl px-3 py-2 ${msg.from_me ? 'rounded-br-sm' : 'rounded-bl-sm'}`}
                    style={{
                      backgroundColor: msg.from_me ? `${accentColor}30` : 'rgba(255,255,255,0.08)',
                      border: msg.from_me ? `1px solid ${accentColor}40` : '1px solid rgba(255,255,255,0.08)'
                    }}
                  >
                    {msg.is_bot && (
                      <div className="flex items-center gap-1 text-[10px] text-purple-400 mb-1">
                        <Bot className="w-3 h-3" />
                        Bot
                      </div>
                    )}

                    {msg.from_me && msg.enviado_por && usersCache[msg.enviado_por] && !msg.is_bot && (
                      <div className="text-[11px] font-semibold mb-1" style={{ color: accentColor }}>
                        {usersCache[msg.enviado_por]}:
                      </div>
                    )}

                    {editingMessage?.id === msg.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full px-2 py-1.5 bg-black/30 border border-white/20 rounded text-sm text-white focus:outline-none"
                          autoFocus
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => editMessage(msg.id, editText)}
                            className="px-2 py-1 rounded text-[10px] font-medium"
                            style={{ backgroundColor: accentColor, color: 'black' }}
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => {
                              setEditingMessage(null);
                              setEditText('');
                            }}
                            className="px-2 py-1 rounded text-[10px] bg-white/10 text-gray-400"
                          >
                            Cancelar
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {msg.tipo === 'text' && (
                          <p className="text-sm text-white whitespace-pre-wrap">{msg.conteudo}</p>
                        )}

                        {msg.tipo === 'image' && (
                          <div className="space-y-1">
                            <div className="relative group/img">
                              <img
                                src={msg.media_url || msg.conteudo || ''}
                                alt=""
                                className="max-w-full max-h-64 rounded cursor-pointer"
                                onClick={() => setPreviewMedia({ url: msg.media_url || msg.conteudo || '', type: 'image' })}
                              />
                              <button
                                onClick={() => downloadMedia(msg.media_url || msg.conteudo || '', msg.caption || 'image.jpg')}
                                className="absolute top-1 right-1 p-1.5 rounded bg-black/50 opacity-0 group-hover/img:opacity-100 transition-opacity"
                              >
                                <Download className="w-3 h-3 text-white" />
                              </button>
                            </div>
                            {msg.caption && <p className="text-xs text-white">{msg.caption}</p>}
                          </div>
                        )}

                        {msg.tipo === 'audio' && (
                          <div className="flex items-center gap-2 min-w-[180px]">
                            <button className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center">
                              <Play className="w-4 h-4 text-white" />
                            </button>
                            <div className="flex-1 h-1 bg-white/20 rounded-full" />
                            <span className="text-[10px] text-gray-400">0:00</span>
                            <button onClick={() => downloadMedia(msg.media_url || '', msg.caption || 'audio.mp3')} className="p-1 hover:bg-white/10 rounded">
                              <Download className="w-3 h-3 text-gray-400" />
                            </button>
                          </div>
                        )}

                        {msg.tipo === 'document' && (
                          <div className="flex items-center gap-2 p-2 bg-white/5 rounded min-w-[200px]">
                            <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center text-gray-400">
                              {getFileIcon(msg.media_mimetype || '')}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-white truncate font-medium">{msg.caption || 'Documento'}</p>
                              <p className="text-[10px] text-gray-500">{msg.media_mimetype}</p>
                            </div>
                            <button onClick={() => downloadMedia(msg.media_url || '', msg.caption || 'documento')} className="p-1.5 hover:bg-white/10 rounded">
                              <Download className="w-4 h-4 text-gray-400" />
                            </button>
                          </div>
                        )}

                        {msg.tipo === 'video' && (
                          <div className="space-y-1">
                            <div className="relative group/vid">
                              <video src={msg.media_url || ''} className="max-w-full max-h-64 rounded" controls />
                              <button
                                onClick={() => downloadMedia(msg.media_url || '', msg.caption || 'video.mp4')}
                                className="absolute top-1 right-1 p-1.5 rounded bg-black/50 opacity-0 group-hover/vid:opacity-100 transition-opacity"
                              >
                                <Download className="w-3 h-3 text-white" />
                              </button>
                            </div>
                            {msg.caption && <p className="text-xs text-white">{msg.caption}</p>}
                          </div>
                        )}

                        {msg.tipo === 'location' && (
                          <div className="space-y-1">
                            <div className="w-full h-24 bg-white/5 rounded flex items-center justify-center">
                              <MapPin className="w-6 h-6 text-gray-400" />
                            </div>
                            <button className="flex items-center gap-1 text-[10px] text-blue-400 hover:underline">
                              <ExternalLink className="w-2.5 h-2.5" />
                              Abrir no Maps
                            </button>
                          </div>
                        )}
                      </>
                    )}

                    <div className="flex items-center justify-end gap-1.5 mt-1">
                      {msg.edited_at && <span className="text-[9px] text-gray-500 italic">editada</span>}
                      <span className="text-[10px] text-gray-500">{formatTime(msg.created_at)}</span>
                      {msg.from_me && (
                        <div className="flex items-center" title={getStatusText(msg.status)}>
                          {getStatusIcon(msg.status)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Attachment Preview */}
        <AnimatePresence>
          {showAttachmentPreview && attachments.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-white/10 bg-black/40 p-3"
            >
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                {attachments.map((file, index) => (
                  <div key={index} className="relative flex-shrink-0">
                    {file.type.startsWith('image/') ? (
                      <img src={URL.createObjectURL(file)} alt={file.name} className="w-16 h-16 object-cover rounded" />
                    ) : (
                      <div className="w-16 h-16 bg-white/10 rounded flex flex-col items-center justify-center p-1">
                        {getFileIcon(file.type)}
                        <span className="text-[8px] text-gray-400 mt-0.5 truncate w-full text-center">{file.name}</span>
                      </div>
                    )}
                    <button onClick={() => removeAttachment(index)} className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                      <X className="w-2.5 h-2.5 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Input */}
        <div className="flex-shrink-0 p-3 border-t border-white/10 bg-black/20">
          <div className="flex items-center gap-2">
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple className="hidden" />
            <button onClick={() => fileInputRef.current?.click()} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
              <Paperclip className="w-4 h-4 text-gray-400" />
            </button>

            <div className="relative">
              <button onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                <Smile className="w-4 h-4 text-gray-400" />
              </button>

              <AnimatePresence>
                {showEmojiPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute bottom-full left-0 mb-2 w-72 bg-[#1A1A2E] border border-white/10 rounded-xl shadow-xl p-2 z-50"
                  >
                    <div className="grid grid-cols-8 gap-0.5 max-h-40 overflow-y-auto">
                      {EMOJI_LIST.map((emoji, i) => (
                        <button key={i} onClick={() => addEmoji(emoji)} className="w-7 h-7 flex items-center justify-center text-lg hover:bg-white/10 rounded">
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div className="flex-1 relative">
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                placeholder="Digite uma mensagem..."
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white/20"
              />
            </div>
            {inputText.trim() || attachments.length > 0 ? (
              <button
                onClick={sendMessage}
                disabled={sending}
                className="p-2.5 rounded-xl transition-colors"
                style={{ backgroundColor: accentColor, opacity: sending ? 0.5 : 1 }}
              >
                <Send className="w-4 h-4 text-black" />
              </button>
            ) : (
              <button className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors">
                <Mic className="w-4 h-4 text-gray-400" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Context Panel */}
      <AnimatePresence>
        {showContextPanel && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="border-l border-white/10 overflow-hidden flex-shrink-0"
          >
            <div className="w-[280px] h-full overflow-y-auto p-4 space-y-4">
              {/* Client Info */}
              <div className="flex flex-col items-center text-center">
                {renderClientPhoto('lg')}
                <p className="text-sm font-medium text-white mt-3">
                  {conversa.cliente_nome || 'Nome nao informado'}
                </p>
                <p className="text-xs text-gray-400">{conversa.cliente_telefone}</p>
                <p className="text-[10px] text-gray-500 mt-1">
                  Ultima resposta: {formatLastSeen(conversa.ultima_resposta_cliente_at)}
                </p>
              </div>

              {/* OS Info */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Ordem de Servico</h4>
                {osData ? (
                  <div className="p-3 bg-white/5 rounded-lg space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-gray-400">Interna</span>
                      <span className="text-xs font-medium text-white">#{osData.numero_os_interna}</span>
                    </div>
                    {osData.numero_os_samsung && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-400">Samsung</span>
                        <span className="text-xs font-medium text-orange-400">{osData.numero_os_samsung}</span>
                      </div>
                    )}
                    {osData.defeito_reclamado && (
                      <div className="pt-2 border-t border-white/10">
                        <p className="text-[10px] text-gray-400 line-clamp-2">{osData.defeito_reclamado}</p>
                      </div>
                    )}
                    <div className="flex gap-2 pt-2">
                      <button
                        className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded text-[10px] transition-colors"
                        style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                      >
                        <ExternalLink className="w-3 h-3" />
                        Ver OS
                      </button>
                      <button
                        onClick={desvincularOS}
                        className="px-2 py-1.5 rounded text-[10px] bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <button
                      onClick={() => setShowVincularOS(true)}
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs bg-white/5 text-gray-300 hover:bg-white/10 transition-colors border border-dashed border-white/20"
                    >
                      <Link2 className="w-4 h-4" />
                      Vincular OS Existente
                    </button>
                    <button
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs transition-colors"
                      style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                    >
                      <FileText className="w-4 h-4" />
                      Criar Nova OS
                    </button>
                  </div>
                )}
              </div>

              {/* IH Info */}
              {conversa.tipo_atendimento === 'ih' && (
                <div className="space-y-2">
                  <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Visita Tecnica</h4>
                  <div className="p-3 bg-white/5 rounded-lg space-y-2">
                    {conversa.agendamento_data && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-xs text-white">
                          {new Date(conversa.agendamento_data).toLocaleDateString('pt-BR')}
                          {conversa.agendamento_hora && ` as ${conversa.agendamento_hora}`}
                        </span>
                      </div>
                    )}
                    {conversa.endereco_visita && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                        <span className="text-xs text-white">{conversa.endereco_visita}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Acoes Rapidas</h4>
                <div className="space-y-1.5">
                  <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs bg-white/5 text-gray-300 hover:bg-white/10 transition-colors">
                    <Zap className="w-3.5 h-3.5" />
                    Disparar Fluxo
                  </button>
                  <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs bg-white/5 text-gray-300 hover:bg-white/10 transition-colors">
                    <Navigation className="w-3.5 h-3.5" />
                    Enviar Localizacao
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transfer Modal */}
      <AnimatePresence>
        {showTransferModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 flex items-center justify-center z-50"
            onClick={() => setShowTransferModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1A1A2E] rounded-xl p-5 w-80 max-h-[70vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-semibold text-white mb-1">Transferir Atendimento</h3>
              <p className="text-xs text-gray-400 mb-4">Selecione um atendente da unidade</p>

              <div className="space-y-1.5">
                {atendentes.length === 0 ? (
                  <p className="text-xs text-gray-500 text-center py-4">Nenhum atendente disponivel</p>
                ) : (
                  atendentes
                    .filter(a => a.id !== usuario?.id)
                    .map(atendente => (
                      <button
                        key={atendente.id}
                        onClick={() => transferConversa(atendente.id)}
                        className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                      >
                        <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                          {atendente.foto_url ? (
                            <img src={atendente.foto_url} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-5 h-5 text-gray-400" />
                          )}
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-xs font-medium text-white">{atendente.nome}</p>
                          {atendente.cargo && <p className="text-[10px] text-gray-500">{atendente.cargo}</p>}
                        </div>
                        <ArrowRight className="w-4 h-4 text-gray-500" />
                      </button>
                    ))
                )}
              </div>
              <button
                onClick={() => setShowTransferModal(false)}
                className="w-full mt-4 px-4 py-2 bg-white/10 rounded-lg text-xs text-gray-400 hover:bg-white/20 transition-colors"
              >
                Cancelar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Vincular OS Modal */}
      <AnimatePresence>
        {showVincularOS && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 flex items-center justify-center z-50"
            onClick={() => {
              setShowVincularOS(false);
              setOsSearchTerm('');
              setOsSearchResults([]);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#1A1A2E] rounded-xl p-5 w-[420px] max-h-[80vh] overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-semibold text-white mb-1">Vincular OS Existente</h3>
              <p className="text-xs text-gray-400 mb-4">Busque pelo numero da OS, nome ou telefone do cliente</p>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={osSearchTerm}
                  onChange={(e) => setOsSearchTerm(e.target.value)}
                  placeholder="Digite para buscar OS..."
                  autoFocus
                  className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500/40"
                />
                {searchingOS && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400 animate-spin" />
                )}
              </div>

              <div className="flex-1 overflow-y-auto space-y-1.5 min-h-[200px]">
                {osSearchTerm.length < 2 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <Search className="w-10 h-10 mb-2 opacity-30" />
                    <p className="text-xs">Digite pelo menos 2 caracteres</p>
                  </div>
                ) : searchingOS ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                  </div>
                ) : osSearchResults.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-gray-500">
                    <FileText className="w-10 h-10 mb-2 opacity-30" />
                    <p className="text-xs">Nenhuma OS encontrada</p>
                  </div>
                ) : (
                  osSearchResults.map(os => (
                    <button
                      key={os.id}
                      onClick={() => vincularOS(os)}
                      className="w-full flex items-start gap-3 p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-left"
                    >
                      <FileText className="w-5 h-5 text-cyan-400 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          {os.numero_os_interna && (
                            <span className="text-xs font-semibold text-cyan-400">
                              #{os.numero_os_interna}
                            </span>
                          )}
                          {os.numero_os_samsung && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400">
                              Samsung: {os.numero_os_samsung}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-white truncate mt-1">{os.cliente_nome}</p>
                        {os.cliente_telefone && (
                          <p className="text-[10px] text-gray-500">{os.cliente_telefone}</p>
                        )}
                        {os.defeito_reclamado && (
                          <p className="text-[10px] text-gray-400 truncate mt-1">{os.defeito_reclamado}</p>
                        )}
                      </div>
                    </button>
                  ))
                )}
              </div>

              <button
                onClick={() => {
                  setShowVincularOS(false);
                  setOsSearchTerm('');
                  setOsSearchResults([]);
                }}
                className="w-full mt-4 px-4 py-2 bg-white/10 rounded-lg text-xs text-gray-400 hover:bg-white/20 transition-colors"
              >
                Cancelar
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Media Preview Modal */}
      <AnimatePresence>
        {previewMedia && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/90 flex items-center justify-center z-[100]"
            onClick={() => setPreviewMedia(null)}
          >
            <button onClick={() => setPreviewMedia(null)} className="absolute top-4 right-4 p-2 rounded-lg bg-white/10 hover:bg-white/20">
              <X className="w-5 h-5 text-white" />
            </button>
            <button onClick={() => downloadMedia(previewMedia.url, previewMedia.name || 'download')} className="absolute top-4 right-14 p-2 rounded-lg bg-white/10 hover:bg-white/20">
              <Download className="w-5 h-5 text-white" />
            </button>
            {previewMedia.type === 'image' && (
              <img src={previewMedia.url} alt="" className="max-w-[90vw] max-h-[90vh] object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
