import { useState, useEffect, useRef, useCallback } from 'react';
import { X, Send, Paperclip, Mic, Smile, Phone, Video, User, Users, UserPlus, Link2, FileText, Play, Download, Check, CheckCheck, Clock, Bot, ArrowRight, ChevronDown, Zap, MessageSquare, MapPin, Calendar, AlertTriangle, ExternalLink, CreditCard as Edit2, Trash2, Upload, File, Image as ImageLucide, GripVertical, PanelRightClose, PanelRight, Search, Loader2, Star, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme } from '../../contexts/ThemeContext';
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
  cliente_digitando?: string | null;
  cliente_digitando_at?: string | null;
  is_group?: boolean;
  group_jid?: string | null;
  nps_score?: number | null;
  nps_comentario?: string | null;
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
  sender_name?: string | null;
  sender_phone?: string | null;
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
  fillParent?: boolean;
}

interface PipelineColuna {
  id: string;
  nome: string;
  cor: string;
  is_final?: boolean;
}

interface Instancia {
  id: string;
  api_url: string;
  api_key: string;
  instance_name: string;
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
const CHAT_WIDTH_KEY = 'atom_connect_chat_width';

export function AtomConnectChat({ conversa, onClose, onUpdate, accentColor, unidadeId, fillParent }: Props) {
  const { isDark } = useTheme();
  const { usuario, unidadeAtual } = useAuth();

  const chatBg = isDark ? '#0A0A16' : 'var(--bg-secondary)';
  const headerBg = isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.04)';
  const inputFooterBg = isDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.04)';
  const borderColor = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
  const textPrimary = isDark ? '#ffffff' : 'var(--text-primary)';
  const textSecondary = isDark ? '#9ca3af' : 'var(--text-secondary)';
  const inputBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
  const dropdownBg = isDark ? '#1A1A2E' : 'var(--bg-card)';
  const dropdownBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)';
  const sectionBg = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const onlineDotBorder = isDark ? '#0A0A16' : 'var(--bg-secondary)';
  const [mensagens, setMensagens] = useState<Mensagem[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [colunas, setColunas] = useState<PipelineColuna[]>([]);
  const [showColumnDropdown, setShowColumnDropdown] = useState(false);
  const [osData, setOsData] = useState<OS | null>(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [atendentes, setAtendentes] = useState<any[]>([]);
  const [showContextPanel, setShowContextPanel] = useState(!fillParent);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [editingMessage, setEditingMessage] = useState<Mensagem | null>(null);
  const [editText, setEditText] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [attachments, setAttachments] = useState<File[]>([]);
  const [showAttachmentPreview, setShowAttachmentPreview] = useState(false);
  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: string; name?: string; mimetype?: string } | null>(null);
  const [chatWidth, setChatWidth] = useState(() => {
    const saved = localStorage.getItem(CHAT_WIDTH_KEY);
    return saved ? parseInt(saved, 10) : DEFAULT_CHAT_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const [showVincularOS, setShowVincularOS] = useState(false);
  const [osSearchTerm, setOsSearchTerm] = useState('');
  const [osSearchResults, setOsSearchResults] = useState<OS[]>([]);
  const [searchingOS, setSearchingOS] = useState(false);
  const [clienteFoto, setClienteFoto] = useState<string | null>(conversa.cliente_foto_url);
  const [usersCache, setUsersCache] = useState<Record<string, string>>({});
  const [instancia, setInstancia] = useState<Instancia | null>(null);
  const [showFinalizarModal, setShowFinalizarModal] = useState(false);
  const [showEditClienteModal, setShowEditClienteModal] = useState(false);
  const [editClienteNome, setEditClienteNome] = useState(conversa.cliente_nome || '');
  const [savingCliente, setSavingCliente] = useState(false);
  const [regrasFinalizacao, setRegrasFinalizacao] = useState<any[]>([]);
  const [loadingRegras, setLoadingRegras] = useState(false);
  const [sendingAvaliacao, setSendingAvaliacao] = useState(false);
  const [typingStatus, setTypingStatus] = useState<string | null>(conversa.cliente_digitando || null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showGroupMembers, setShowGroupMembers] = useState(false);
  const [groupMembers, setGroupMembers] = useState<{ phone: string; name: string | null; role: string; foto_url: string | null }[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const resizeStartX = useRef(0);
  const resizeStartWidth = useRef(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingIntervalRef = useRef<number | null>(null);

  const loadMensagens = useCallback(async () => {
    const { data, error } = await supabase
      .from('atom_connect_mensagens')
      .select('*')
      .eq('conversa_id', conversa.id)
      .order('created_at', { ascending: true });

    if (!error && data) {
      setMensagens(data);
      setTimeout(() => {
        if (messagesContainerRef.current) {
          messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
        }
      }, 150);

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

  const loadInstancia = useCallback(async () => {
    const targetUnidadeId = conversa.unidade_id || unidadeId || unidadeAtual;
    if (!targetUnidadeId) return;

    const { data } = await supabase
      .from('atom_connect_instancias')
      .select('id, api_url, api_key, instance_name')
      .eq('unidade_id', targetUnidadeId)
      .eq('status', 'connected')
      .limit(1)
      .maybeSingle();

    if (data) {
      setInstancia(data);
    } else {
      const { data: anyInstancia } = await supabase
        .from('atom_connect_instancias')
        .select('id, api_url, api_key, instance_name')
        .eq('status', 'connected')
        .limit(1)
        .maybeSingle();
      if (anyInstancia) setInstancia(anyInstancia);
    }
  }, [conversa.unidade_id, unidadeId, unidadeAtual]);

  const fetchClientPhoto = useCallback(async () => {
    if (conversa.cliente_foto_url) {
      setClienteFoto(conversa.cliente_foto_url);
      return;
    }

    if (!instancia) return;

    try {
      if (conversa.is_group) {
        const groupJid = conversa.group_jid || `${conversa.cliente_telefone}@g.us`;
        const response = await fetch(`${instancia.api_url}/chat/fetchProfilePictureUrl/${instancia.instance_name}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': instancia.api_key },
          body: JSON.stringify({ number: groupJid })
        });

        if (response.ok) {
          const result = await response.json();
          const photoUrl = result.profilePictureUrl || result.picture || result.url;
          if (photoUrl) {
            setClienteFoto(photoUrl);
            await supabase.from('atom_connect_conversas').update({ cliente_foto_url: photoUrl }).eq('id', conversa.id);
            return;
          }
        }

        const respGet = await fetch(`${instancia.api_url}/group/findGroupInfos/${instancia.instance_name}?groupJid=${encodeURIComponent(groupJid)}`, {
          headers: { 'apikey': instancia.api_key }
        });
        if (respGet.ok) {
          const gInfo = await respGet.json();
          const pic = gInfo.profilePictureUrl || gInfo.pictureUrl || gInfo.imgUrl;
          if (pic) {
            setClienteFoto(pic);
            await supabase.from('atom_connect_conversas').update({ cliente_foto_url: pic }).eq('id', conversa.id);
          }
        }
      } else {
        const phoneNumber = conversa.cliente_telefone.replace(/\D/g, '');
        const response = await fetch(`${instancia.api_url}/chat/fetchProfilePictureUrl/${instancia.instance_name}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'apikey': instancia.api_key },
          body: JSON.stringify({ number: phoneNumber })
        });

        if (response.ok) {
          const result = await response.json();
          const photoUrl = result.profilePictureUrl || result.picture || result.url;
          if (photoUrl) {
            setClienteFoto(photoUrl);
            await supabase.from('atom_connect_conversas').update({ cliente_foto_url: photoUrl }).eq('id', conversa.id);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao buscar foto do perfil:', error);
    }
  }, [conversa.id, conversa.cliente_telefone, conversa.cliente_foto_url, conversa.is_group, conversa.group_jid, instancia]);

  const saveClienteNome = async () => {
    if (!editClienteNome.trim()) return;
    setSavingCliente(true);

    try {
      await supabase
        .from('atom_connect_conversas')
        .update({ cliente_nome: editClienteNome.trim() })
        .eq('id', conversa.id);

      setShowEditClienteModal(false);
      onUpdate();
    } catch (error) {
      console.error('Erro ao salvar nome:', error);
    } finally {
      setSavingCliente(false);
    }
  };

  useEffect(() => {
    loadMensagens();
    loadColunas();
    loadAtendentes();
    loadInstancia();
    if (conversa.os_id) {
      loadOSData();
    }
    markAsRead();
    setClienteFoto(conversa.cliente_foto_url);
    setEditClienteNome(conversa.cliente_nome || '');
  }, [conversa.id]);

  useEffect(() => {
    if (instancia) {
      fetchClientPhoto();
    }
  }, [instancia, fetchClientPhoto]);

  useEffect(() => {
    if (!conversa.is_group || !instancia) return;
    const name = conversa.cliente_nome || "";
    const isNumericId = !name || /^(Grupo\s+)?\d{10,}$/.test(name.trim());
    if (!isNumericId) return;

    const groupJid = conversa.group_jid || `${conversa.cliente_telefone}@g.us`;
    (async () => {
      try {
        let resolved = "";

        const respGet = await fetch(
          `${instancia.api_url}/group/findGroupInfos/${instancia.instance_name}?groupJid=${encodeURIComponent(groupJid)}`,
          { headers: { apikey: instancia.api_key } }
        );
        if (respGet.ok) {
          const info = await respGet.json();
          const data = Array.isArray(info) ? info[0] : info;
          resolved = data?.subject || data?.name || data?.desc || "";
        }

        if (!resolved) {
          const respPost = await fetch(
            `${instancia.api_url}/group/findGroupInfos/${instancia.instance_name}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json", apikey: instancia.api_key },
              body: JSON.stringify({ groupJid }),
            }
          );
          if (respPost.ok) {
            const info = await respPost.json();
            const data = Array.isArray(info) ? info[0] : info;
            resolved = data?.subject || data?.name || data?.desc || "";
          }
        }

        if (resolved) {
          await supabase
            .from("atom_connect_conversas")
            .update({ cliente_nome: resolved })
            .eq("id", conversa.id);
          onUpdate();
        }
      } catch (e) {
        console.error("Failed to resolve group name:", e);
      }
    })();
  }, [conversa.id, conversa.is_group, instancia]);

  const parseParticipants = (raw: any) => {
    const list = raw?.participants || (Array.isArray(raw) ? raw : []);
    if (!Array.isArray(list)) return [];
    return list.map((p: any) => ({
      phone: (p.id || p.jid || p.number || "").replace("@s.whatsapp.net", "").replace("@lid", ""),
      name: p.name || p.pushName || p.notify || null,
      role: p.admin === "superadmin" ? "superadmin" : p.admin === "admin" ? "admin" : (p.role || "member"),
      foto_url: p.profilePictureUrl || p.imgUrl || null,
    })).filter((m: any) => m.phone);
  };

  const fetchParticipantsFromAPI = async (groupJid: string) => {
    const url = `${instancia!.api_url}/group/participants/${instancia!.instance_name}`;
    const headers: Record<string, string> = { apikey: instancia!.api_key };

    let resp = await fetch(`${url}?groupJid=${encodeURIComponent(groupJid)}`, { headers });
    if (resp.ok) {
      const result = await resp.json();
      const members = parseParticipants(result);
      if (members.length > 0) return members;
    }

    resp = await fetch(url, {
      method: "POST",
      headers: { ...headers, "Content-Type": "application/json" },
      body: JSON.stringify({ groupJid }),
    });
    if (resp.ok) {
      const result = await resp.json();
      return parseParticipants(result);
    }
    return [];
  };

  const saveParticipantsToCache = async (members: { phone: string; name: string | null; role: string; foto_url: string | null }[]) => {
    for (const m of members) {
      await supabase
        .from("atom_connect_grupo_membros")
        .upsert(
          { conversa_id: conversa.id, phone: m.phone, name: m.name, role: m.role, foto_url: m.foto_url, updated_at: new Date().toISOString() },
          { onConflict: "conversa_id,phone" }
        );
    }
  };

  const fetchGroupMembers = async () => {
    if (!instancia || !conversa.is_group) return;
    setLoadingMembers(true);
    const groupJid = conversa.group_jid || `${conversa.cliente_telefone}@g.us`;

    try {
      const { data: cached } = await supabase
        .from("atom_connect_grupo_membros")
        .select("phone, name, role, foto_url")
        .eq("conversa_id", conversa.id);

      if (cached && cached.length > 0) {
        setGroupMembers(cached);
        setShowGroupMembers(true);
        setLoadingMembers(false);

        (async () => {
          try {
            const members = await fetchParticipantsFromAPI(groupJid);
            if (members.length > 0) {
              setGroupMembers(members);
              await saveParticipantsToCache(members);
            }
          } catch {}
        })();
        return;
      }

      const members = await fetchParticipantsFromAPI(groupJid);
      if (members.length > 0) {
        setGroupMembers(members);
        setShowGroupMembers(true);
        await saveParticipantsToCache(members);
      } else {
        setShowGroupMembers(true);
      }
    } catch (e) {
      console.error("Failed to fetch group members:", e);
      setShowGroupMembers(true);
    } finally {
      setLoadingMembers(false);
    }
  };

  useEffect(() => {
    if (conversa.is_group && instancia) {
      const groupJid = conversa.group_jid || `${conversa.cliente_telefone}@g.us`;
      (async () => {
        try {
          const { data: cached } = await supabase
            .from("atom_connect_grupo_membros")
            .select("phone, name, role, foto_url")
            .eq("conversa_id", conversa.id);
          if (cached && cached.length > 0) {
            setGroupMembers(cached);
          }
          const members = await fetchParticipantsFromAPI(groupJid);
          if (members.length > 0) {
            setGroupMembers(members);
            await saveParticipantsToCache(members);
          }
        } catch {}
      })();
    }
  }, [conversa.id, conversa.is_group, instancia]);

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
            setMensagens(prev => {
              const alreadyExists = prev.some(m => m.id === newMsg.id || (newMsg.message_id && m.message_id === newMsg.message_id));
              if (alreadyExists) return prev;
              return [...prev, newMsg];
            });
            scrollToBottom();
            if (!newMsg.from_me) {
              setTypingStatus(null);
            }
          } else if (payload.eventType === 'UPDATE') {
            const updatedMsg = payload.new as Mensagem;
            setMensagens(prev => prev.map(m => m.id === updatedMsg.id ? updatedMsg : m));
          } else if (payload.eventType === 'DELETE') {
            const deletedId = payload.old.id;
            setMensagens(prev => prev.filter(m => m.id !== deletedId));
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'atom_connect_conversas',
          filter: `id=eq.${conversa.id}`
        },
        (payload) => {
          const updated = payload.new as Conversa;
          setTypingStatus(updated.cliente_digitando || null);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversa.id]);

  useEffect(() => {
    if (typingStatus) {
      const timeout = setTimeout(() => {
        setTypingStatus(null);
      }, 10000);
      return () => clearTimeout(timeout);
    }
  }, [typingStatus]);

  useEffect(() => {
    scrollToBottom();
  }, [mensagens]);

  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  };

  const loadColunas = async () => {
    const { data } = await supabase
      .from('atom_connect_pipeline_colunas')
      .select('id, nome, cor, is_final')
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

  const sendToEvolutionAPI = async (text: string, mediaUrl?: string, mediaType?: string, mimeType?: string, fileName?: string): Promise<string | null> => {
    if (!instancia) {
      console.error('Nenhuma instancia conectada');
      return null;
    }

    try {
      const phoneNumber = conversa.is_group && conversa.group_jid
        ? conversa.group_jid
        : conversa.cliente_telefone.replace(/\D/g, '');

      if (mediaUrl && mediaType) {
        if (mediaType === 'audio') {
          const response = await fetch(`${instancia.api_url}/message/sendWhatsAppAudio/${instancia.instance_name}`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': instancia.api_key
            },
            body: JSON.stringify({
              number: phoneNumber,
              audio: mediaUrl
            })
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('Erro Evolution API (audio):', errorText);
            return null;
          }

          const result = await response.json();
          return result.key?.id || result.messageId || null;
        }

        const response = await fetch(`${instancia.api_url}/message/sendMedia/${instancia.instance_name}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': instancia.api_key
          },
          body: JSON.stringify({
            number: phoneNumber,
            mediatype: mediaType,
            mimetype: mimeType || (mediaType === 'image' ? 'image/png' : mediaType === 'video' ? 'video/mp4' : 'application/octet-stream'),
            media: mediaUrl,
            caption: text || undefined,
            fileName: fileName || undefined
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Erro Evolution API (media):', errorText);
          return null;
        }

        const result = await response.json();
        return result.key?.id || result.messageId || null;
      } else {
        const response = await fetch(`${instancia.api_url}/message/sendText/${instancia.instance_name}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'apikey': instancia.api_key
          },
          body: JSON.stringify({
            number: phoneNumber,
            text: text
          })
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Erro Evolution API (text):', errorText);
          return null;
        }

        const result = await response.json();
        return result.key?.id || result.messageId || null;
      }
    } catch (error) {
      console.error('Erro ao enviar via Evolution API:', error);
      return null;
    }
  };

  const sendMessage = async () => {
    if ((!inputText.trim() && attachments.length === 0) || sending) return;

    setSending(true);
    setUploadError(null);
    const messageContent = inputText.trim();
    setInputText('');
    if (inputRef.current) inputRef.current.style.height = 'auto';

    const attendantName = usuario?.nome || '';
    const messageWithName = attendantName ? `*${attendantName}:*\n${messageContent}` : messageContent;

    try {
      if (attachments.length > 0) {
        for (const file of attachments) {
          const fileExt = file.name.split('.').pop() || 'bin';
          const timestamp = Date.now();
          const fileName = `${conversa.id}/${timestamp}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;

          console.log('Uploading file:', fileName, 'Type:', file.type, 'Size:', file.size);

          const { error: storageError, data: uploadData } = await supabase.storage
            .from('atom-connect-media')
            .upload(fileName, file, {
              contentType: file.type || 'application/octet-stream',
              upsert: true
            });

          if (storageError) {
            console.error('Storage upload error:', storageError);
            setUploadError(`Erro ao enviar ${file.name}: ${storageError.message}`);
            continue;
          }

          const { data: { publicUrl } } = supabase.storage
            .from('atom-connect-media')
            .getPublicUrl(fileName);

          console.log('File uploaded, public URL:', publicUrl);

          let tipo = 'document';
          if (file.type.startsWith('image/')) tipo = 'image';
          else if (file.type.startsWith('audio/')) tipo = 'audio';
          else if (file.type.startsWith('video/')) tipo = 'video';

          const captionWithName = attendantName ? `*${attendantName}:*\n${file.name}` : file.name;
          const evolutionMessageId = await sendToEvolutionAPI(captionWithName, publicUrl, tipo, file.type, file.name);

          const { error: insertError } = await supabase
            .from('atom_connect_mensagens')
            .insert({
              conversa_id: conversa.id,
              message_id: evolutionMessageId,
              from_me: true,
              tipo,
              conteudo: publicUrl,
              media_url: publicUrl,
              media_mimetype: file.type,
              caption: file.name,
              status: evolutionMessageId ? 'sent' : 'failed',
              enviado_por: usuario?.id,
              is_bot: false
            });

          if (insertError) {
            console.error('Message insert error:', insertError);
          }
        }
        setAttachments([]);
        setShowAttachmentPreview(false);
      }

      if (messageContent) {
        const evolutionMessageId = await sendToEvolutionAPI(messageWithName);

        const { error } = await supabase
          .from('atom_connect_mensagens')
          .insert({
            conversa_id: conversa.id,
            message_id: evolutionMessageId,
            from_me: true,
            tipo: 'text',
            conteudo: messageContent,
            status: evolutionMessageId ? 'sent' : 'failed',
            enviado_por: usuario?.id,
            is_bot: false
          });

        if (error) {
          console.error('Text message insert error:', error);
        }
      }

      if (conversa.is_bot_ativo) {
        await supabase
          .from('atom_connect_conversas')
          .update({ is_bot_ativo: false })
          .eq('id', conversa.id);

        await supabase
          .from('atom_connect_mensagens')
          .insert({
            conversa_id: conversa.id,
            message_id: `system-bot-off-${Date.now()}`,
            from_me: true,
            tipo: 'text',
            conteudo: '👤 Atendimento humano iniciado! A GIA foi pausada automaticamente.',
            status: 'sent',
            enviado_por: usuario?.id,
            is_bot: false
          });

        onUpdate();
      }
    } catch (error) {
      console.error('Erro ao enviar mensagem:', error);
      setUploadError('Erro ao enviar mensagem. Tente novamente.');
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

  const toggleBot = async (status: boolean) => {
    try {
      const { error } = await supabase
        .from('atom_connect_conversas')
        .update({ is_bot_ativo: status })
        .eq('id', conversa.id);

      if (error) throw error;

      await supabase
        .from('atom_connect_mensagens')
        .insert({
          conversa_id: conversa.id,
          message_id: `system-${Date.now()}`,
          from_me: true,
          tipo: 'text',
          conteudo: status
            ? '🤖 GIA ativada! O bot voltará a responder automaticamente.'
            : '👤 Modo humano ativado! O bot foi pausado para atendimento manual.',
          status: 'sent',
          enviado_por: usuario?.id,
          is_bot: false
        });

      onUpdate();
    } catch (error: any) {
      console.error('Erro ao alternar bot:', error);
      alert(`Erro ao alternar bot: ${error.message}`);
    }
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

  const loadRegrasFinalizacao = async () => {
    const targetUnidadeId = conversa.unidade_id || unidadeId || unidadeAtual;
    if (!targetUnidadeId) return;

    setLoadingRegras(true);
    const { data } = await supabase
      .from('atom_connect_regras_finalizacao')
      .select('*')
      .eq('unidade_id', targetUnidadeId)
      .eq('ativo', true)
      .order('is_default', { ascending: false });

    if (data) {
      setRegrasFinalizacao(data);
    }
    setLoadingRegras(false);
  };

  const enviarAvaliacaoParaCliente = async (regra: any) => {
    if (!instancia) {
      alert('Nenhuma instancia conectada');
      return;
    }

    setSendingAvaliacao(true);

    try {
      const evolutionMessageId = await sendToEvolutionAPI(regra.mensagem_avaliacao);

      await supabase
        .from('atom_connect_mensagens')
        .insert({
          conversa_id: conversa.id,
          message_id: evolutionMessageId,
          from_me: true,
          tipo: 'text',
          conteudo: regra.mensagem_avaliacao,
          status: evolutionMessageId ? 'sent' : 'failed',
          enviado_por: usuario?.id,
          is_bot: false,
          metadata: { tipo: 'avaliacao_request', regra_id: regra.id }
        });

      await supabase
        .from('atom_connect_conversas')
        .update({
          aguardando_avaliacao: true,
          regra_finalizacao_id: regra.id,
          avaliacao_enviada_at: new Date().toISOString()
        })
        .eq('id', conversa.id);

      setShowFinalizarModal(false);
      onUpdate();
      loadMensagens();
    } catch (error) {
      console.error('Erro ao enviar avaliacao:', error);
      alert('Erro ao enviar mensagem de avaliacao');
    } finally {
      setSendingAvaliacao(false);
    }
  };

  const finalizarDiretamente = async () => {
    const semNPS = !conversa.nps_score;

    await supabase
      .from('atom_connect_conversas')
      .update({
        coluna_pipeline: 'finalizado_nps',
        is_bot_ativo: semNPS,
        aguardando_avaliacao: false
      })
      .eq('id', conversa.id);

    onUpdate();
  };

  const currentWidthRef = useRef(chatWidth);

  useEffect(() => {
    currentWidthRef.current = chatWidth;
  }, [chatWidth]);

  const handleResizeMove = useCallback((e: MouseEvent) => {
    const diff = resizeStartX.current - e.clientX;
    const newWidth = Math.min(MAX_CHAT_WIDTH, Math.max(MIN_CHAT_WIDTH, resizeStartWidth.current + diff));
    setChatWidth(newWidth);
    currentWidthRef.current = newWidth;
  }, []);

  const handleResizeEnd = useCallback(() => {
    setIsResizing(false);
    localStorage.setItem(CHAT_WIDTH_KEY, currentWidthRef.current.toString());
    document.removeEventListener('mousemove', handleResizeMove);
    document.removeEventListener('mouseup', handleResizeEnd);
  }, [handleResizeMove]);

  const handleResizeStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    resizeStartX.current = e.clientX;
    resizeStartWidth.current = chatWidth;

    document.addEventListener('mousemove', handleResizeMove);
    document.addEventListener('mouseup', handleResizeEnd);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(track => track.stop());

        if (audioChunksRef.current.length > 0) {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          await sendAudioMessage(audioBlob);
        }
      };

      mediaRecorder.start(100);
      setIsRecording(true);
      setRecordingTime(0);

      recordingIntervalRef.current = window.setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch (error) {
      console.error('Erro ao iniciar gravacao:', error);
      alert('Nao foi possivel acessar o microfone. Verifique as permissoes do navegador.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      audioChunksRef.current = [];
      setIsRecording(false);
      if (recordingIntervalRef.current) {
        clearInterval(recordingIntervalRef.current);
        recordingIntervalRef.current = null;
      }
    }
  };

  const sendAudioMessage = async (audioBlob: Blob) => {
    if (!instancia) return;
    setSending(true);

    try {
      const fileName = `${conversa.id}/${Date.now()}.webm`;

      const { error: uploadError } = await supabase.storage
        .from('atom-connect-media')
        .upload(fileName, audioBlob, { contentType: 'audio/webm' });

      if (uploadError) {
        console.error('Upload error:', uploadError);
        setUploadError('Erro ao fazer upload do audio');
        setSending(false);
        return;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('atom-connect-media')
        .getPublicUrl(fileName);

      const attendantName = usuario?.nome || '';
      const evolutionMessageId = await sendToEvolutionAPI(attendantName ? `*${attendantName}*` : '', publicUrl, 'audio');

      await supabase
        .from('atom_connect_mensagens')
        .insert({
          conversa_id: conversa.id,
          message_id: evolutionMessageId,
          from_me: true,
          tipo: 'audio',
          conteudo: '[Audio]',
          media_url: publicUrl,
          media_mimetype: 'audio/webm',
          status: evolutionMessageId ? 'sent' : 'failed',
          enviado_por: usuario?.id,
          is_bot: false
        });
    } catch (error) {
      console.error('Erro ao enviar audio:', error);
      setUploadError('Erro ao enviar audio');
    } finally {
      setSending(false);
    }
  };

  const formatRecordingTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = chatContainerRef.current?.getBoundingClientRect();
    if (rect) {
      const { clientX, clientY } = e;
      if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom) {
        setIsDragging(false);
      }
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
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
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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

  const isValidMediaUrl = (url: string | null | undefined): boolean => {
    if (!url) return false;
    return url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:');
  };

  const getMediaUrl = (msg: Mensagem): string | null => {
    const url = msg.media_url || null;
    if (isValidMediaUrl(url)) return url;
    if (isValidMediaUrl(msg.conteudo)) return msg.conteudo;
    return null;
  };

  const getExtensionFromMimetype = (mimetype: string | null): string => {
    if (!mimetype) return '';
    const mimeMap: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/gif': '.gif',
      'image/webp': '.webp',
      'audio/ogg': '.ogg',
      'audio/mpeg': '.mp3',
      'audio/mp4': '.m4a',
      'audio/opus': '.opus',
      'audio/aac': '.aac',
      'audio/ogg; codecs=opus': '.ogg',
      'video/mp4': '.mp4',
      'video/3gpp': '.3gp',
      'application/pdf': '.pdf',
      'application/msword': '.doc',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    };
    return mimeMap[mimetype] || '';
  };

  const downloadMedia = async (url: string, filename: string, mimetype?: string | null) => {
    if (!isValidMediaUrl(url)) return;
    try {
      const response = await fetch(url, { mode: 'cors' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const blob = await response.blob();
      if (blob.size === 0) throw new Error('Empty blob');
      const extension = getExtensionFromMimetype(mimetype || blob.type);
      let finalFilename = filename;
      if (extension && !filename.includes('.')) {
        finalFilename = filename + extension;
      }
      const blobUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = finalFilename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);
    } catch {
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  const [allUnitOS, setAllUnitOS] = useState<OS[]>([]);
  const [loadingAllOS, setLoadingAllOS] = useState(false);

  const searchOS = useCallback(async (term: string) => {
    const targetUnidadeId = conversa.unidade_id || unidadeId || unidadeAtual;
    if (!targetUnidadeId || !term || term.length < 1) {
      setOsSearchResults([]);
      return;
    }

    setSearchingOS(true);
    const numericTerm = term.replace(/\D/g, '');

    try {
      let query = supabase
        .from('os')
        .select('id, numero_os_interna, numero_os_samsung, cliente_nome, cliente_telefone, defeito_reclamado, status_kanban, coluna_kanban')
        .eq('unidade_id', targetUnidadeId);

      if (numericTerm && numericTerm.length >= 2) {
        query = query.or(`numero_os_interna.ilike.%${term}%,numero_os_samsung.ilike.%${term}%,numero_os_samsung.ilike.%${numericTerm}%,cliente_nome.ilike.%${term}%,cliente_telefone.ilike.%${numericTerm}%,cliente_telefone_2.ilike.%${numericTerm}%,cliente_cpf_cnpj.ilike.%${numericTerm}%`);
      } else {
        query = query.or(`numero_os_interna.ilike.%${term}%,numero_os_samsung.ilike.%${term}%,cliente_nome.ilike.%${term}%,cliente_telefone.ilike.%${term}%,cliente_cpf_cnpj.ilike.%${term}%`);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false })
        .limit(30);

      if (!error && data) {
        setOsSearchResults(data);
      }
    } catch {
      setOsSearchResults([]);
    } finally {
      setSearchingOS(false);
    }
  }, [conversa.unidade_id, unidadeId, unidadeAtual]);

  const loadAllUnitOS = useCallback(async () => {
    const targetUnidadeId = conversa.unidade_id || unidadeId || unidadeAtual;
    if (!targetUnidadeId) return;

    setLoadingAllOS(true);
    try {
      const { data } = await supabase
        .from('os')
        .select('id, numero_os_interna, numero_os_samsung, cliente_nome, cliente_telefone, defeito_reclamado, status_kanban, coluna_kanban')
        .eq('unidade_id', targetUnidadeId)
        .order('created_at', { ascending: false })
        .limit(500);

      if (data) {
        setAllUnitOS(data);
      }
    } catch {
      setAllUnitOS([]);
    } finally {
      setLoadingAllOS(false);
    }
  }, [conversa.unidade_id, unidadeId, unidadeAtual]);

  useEffect(() => {
    if (showVincularOS) {
      loadAllUnitOS();
    } else {
      setAllUnitOS([]);
      setOsSearchResults([]);
      setOsSearchTerm('');
    }
  }, [showVincularOS, loadAllUnitOS]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (osSearchTerm.length >= 1) {
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
        return <Clock className="w-3 h-3" style={{ color: 'rgba(156,163,175,0.7)' }} />;
      case 'sent':
        return (
          <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
            <path d="M1 5L4.5 8.5L13 1" stroke="rgba(156,163,175,0.8)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'delivered':
        return (
          <svg width="18" height="10" viewBox="0 0 18 10" fill="none">
            <path d="M1 5L4.5 8.5L13 1" stroke="rgba(156,163,175,0.8)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5 5L8.5 8.5L17 1" stroke="rgba(156,163,175,0.8)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'read':
        return (
          <svg width="18" height="10" viewBox="0 0 18 10" fill="none">
            <path d="M1 5L4.5 8.5L13 1" stroke="#34d399" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            <path d="M5 5L8.5 8.5L17 1" stroke="#34d399" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        );
      case 'failed':
        return <AlertTriangle className="w-3 h-3 text-red-400" />;
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
    if (minutes < 60) return `${minutes}min atr\u00e1s`;
    if (hours < 24) return `${hours}h atr\u00e1s`;
    if (days < 7) return `${days}d atr\u00e1s`;
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
        {conversa.is_group ? (
          <Users className={iconSizes[size]} style={{ color: accentColor }} />
        ) : (
          <User className={iconSizes[size]} style={{ color: accentColor }} />
        )}
      </div>
    );
  };

  return (
    <motion.div
      ref={chatContainerRef}
      initial={fillParent ? { opacity: 0 } : { x: '100%' }}
      animate={fillParent ? { opacity: 1 } : { x: 0 }}
      exit={fillParent ? { opacity: 0 } : { x: '100%' }}
      transition={fillParent ? { duration: 0.15 } : { type: 'spring', damping: 25, stiffness: 200 }}
      className={`h-full flex relative ${fillParent ? 'w-full' : ''}`}
      style={fillParent ? { background: chatBg, borderLeft: `1px solid ${borderColor}` } : {
        background: chatBg,
        borderLeft: `1px solid ${borderColor}`,
        width: chatWidth,
        minWidth: MIN_CHAT_WIDTH,
        maxWidth: MAX_CHAT_WIDTH
      }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {!fillParent && (
        <div
          className={`absolute left-0 top-0 bottom-0 w-1 cursor-col-resize z-50 group ${isResizing ? 'bg-cyan-500' : 'hover:bg-cyan-500/50'}`}
          onMouseDown={handleResizeStart}
        >
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-4 h-12 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <GripVertical className="w-4 h-4 text-cyan-400" />
          </div>
        </div>
      )}

      {isDragging && (
        <div
          className="absolute inset-0 bg-black/80 z-50 flex items-center justify-center border-2 border-dashed rounded-xl ml-1"
          style={{ borderColor: accentColor }}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="text-center pointer-events-none">
            <Upload className="w-16 h-16 mx-auto mb-4" style={{ color: accentColor }} />
            <p className="text-xl font-semibold text-white">Solte os arquivos aqui</p>
            <p className="text-sm text-gray-400 mt-2">Imagens, documentos, audios e videos</p>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex-shrink-0 p-4" style={{ borderBottom: `1px solid ${borderColor}`, background: headerBg }}>
          <div className="flex items-center justify-between">
            <div
              className={`flex items-center gap-3 ${conversa.is_group ? 'cursor-pointer hover:opacity-80 transition-opacity' : ''}`}
              onClick={() => conversa.is_group && fetchGroupMembers()}
            >
              <div className="relative">
                {renderClientPhoto('md')}
                {!conversa.is_group && (
                  <span className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full" style={{ border: `2px solid ${onlineDotBorder}` }} />
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-1.5" style={{ color: textPrimary }}>
                  {conversa.is_group && <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400 flex-shrink-0">Grupo</span>}
                  {conversa.cliente_nome || conversa.cliente_telefone}
                </h3>
                {!conversa.is_group ? (
                <p className="text-xs flex items-center gap-1" style={{ color: textSecondary }}>
                  <Phone className="w-3 h-3" />
                  {conversa.cliente_telefone}
                </p>
                ) : (
                <p className="text-[10px] mt-0.5" style={{ color: textSecondary }}>
                  {loadingMembers ? 'Carregando...' : groupMembers.length > 0 ? `${groupMembers.length} participantes - toque para ver` : 'Toque para ver participantes'}
                </p>
                )}
                {osData && (
                <p className="text-[10px] text-blue-400/80 flex items-center gap-1 mt-0.5">
                  <FileText className="w-3 h-3" />
                  OS #{osData.numero_os_interna || osData.numero_os_samsung}
                </p>
                )}
                {typingStatus ? (
                  <p className="text-[10px] mt-0.5 flex items-center gap-1" style={{ color: accentColor }}>
                    <span className="flex gap-0.5">
                      <span className="w-1 h-1 rounded-full animate-bounce" style={{ backgroundColor: accentColor, animationDelay: '0ms' }} />
                      <span className="w-1 h-1 rounded-full animate-bounce" style={{ backgroundColor: accentColor, animationDelay: '150ms' }} />
                      <span className="w-1 h-1 rounded-full animate-bounce" style={{ backgroundColor: accentColor, animationDelay: '300ms' }} />
                    </span>
                    {typingStatus === 'recording' ? 'Gravando audio...' : 'Digitando...'}
                  </p>
                ) : (
                  <p className="text-[10px] mt-0.5" style={{ color: textSecondary }}>
                    Visto: {formatLastSeen(conversa.ultima_resposta_cliente_at)}
                  </p>
                )}
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
                    className="absolute top-full left-0 mt-1 w-44 rounded-lg shadow-xl z-50 overflow-hidden" style={{ background: dropdownBg, border: `1px solid ${dropdownBorder}` }}
                  >
                    {colunas.map(col => (
                      <button
                        key={col.id}
                        onClick={() => changeColumn(col.id)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-left text-xs hover:bg-black/5 transition-colors"
                        style={{ color: textPrimary }}
                      >
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: col.cor }} />
                        {col.nome}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <button
              onClick={() => toggleBot(!conversa.is_bot_ativo)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all ${conversa.is_bot_ativo ? 'text-[10px]' : 'text-xs border-2 animate-pulse shadow-lg'}`}
              style={conversa.is_bot_ativo
                ? {
                    backgroundColor: isDark ? 'rgba(168,85,247,0.2)' : 'rgba(124,58,237,0.12)',
                    color: isDark ? '#c084fc' : '#5b21b6'
                  }
                : {
                    backgroundColor: isDark ? 'rgba(249,115,22,0.30)' : 'rgba(234,88,12,0.12)',
                    color: isDark ? '#fed7aa' : '#9a3412',
                    borderColor: isDark ? 'rgba(249,115,22,0.55)' : 'rgba(234,88,12,0.45)',
                    boxShadow: '0 4px 14px rgba(249,115,22,0.15)'
                  }
              }
              title={conversa.is_bot_ativo ? 'Desativar GIA (modo humano)' : 'ATIVAR GIA - Clique para reativar o atendimento automático'}
            >
              <Bot className={conversa.is_bot_ativo ? 'w-3 h-3' : 'w-4 h-4'} />
              {conversa.is_bot_ativo ? 'GIA Ativa' : 'LIGAR GIA'}
            </button>

            {osData && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] bg-blue-500/20 text-blue-400">
                <Link2 className="w-3 h-3" />
                OS #{osData.numero_os_interna || osData.numero_os_samsung}
              </span>
            )}

            {conversa.atendente_id && conversa.atendente_id !== usuario?.id && (
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] bg-amber-500/15 text-amber-400">
                <User className="w-3 h-3" />
                {atendentes.find(a => a.id === conversa.atendente_id)?.nome || 'Outro atendente'}
              </span>
            )}

            {conversa.atendente_id !== usuario?.id && (
              <button
                onClick={async () => {
                  await supabase
                    .from('atom_connect_conversas')
                    .update({ atendente_id: usuario?.id })
                    .eq('id', conversa.id);
                  onUpdate();
                }}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all"
                style={{
                  color: '#00D4FF',
                  backgroundColor: 'rgba(0, 212, 255, 0.12)',
                  border: '1px solid rgba(0, 212, 255, 0.25)',
                }}
              >
                <UserPlus className="w-3 h-3" />
                Assumir
              </button>
            )}

            <button
              onClick={() => setShowTransferModal(true)}
              className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] bg-white/5 text-gray-400 hover:bg-white/10 transition-colors"
            >
              <ArrowRight className="w-3 h-3" />
              Transferir
            </button>

            {currentColuna?.is_final ? (
              <button
                disabled
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] bg-red-500/20 text-red-400 cursor-not-allowed"
              >
                <CheckCircle2 className="w-3 h-3" />
                Finalizado
              </button>
            ) : (
              <button
                onClick={finalizarDiretamente}
                className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors"
              >
                <CheckCircle2 className="w-3 h-3" />
                Finalizar
              </button>
            )}
          </div>
        </div>

        {/* GIA Desligada Alert */}
        {!conversa.is_bot_ativo && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mx-4 mt-3 p-3 rounded-lg border-2 shadow-lg"
            style={{
              background: isDark
                ? 'linear-gradient(to right, rgba(249,115,22,0.22), rgba(239,68,68,0.22))'
                : 'linear-gradient(to right, rgba(234,88,12,0.10), rgba(220,38,38,0.10))',
              borderColor: isDark ? 'rgba(249,115,22,0.45)' : 'rgba(234,88,12,0.40)'
            }}
          >
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                <div
                  className="w-10 h-10 rounded-full flex items-center justify-center border-2 animate-pulse"
                  style={{
                    backgroundColor: isDark ? 'rgba(249,115,22,0.30)' : 'rgba(234,88,12,0.15)',
                    borderColor: isDark ? 'rgba(249,115,22,0.55)' : 'rgba(234,88,12,0.45)'
                  }}
                >
                  <Bot className="w-5 h-5" style={{ color: isDark ? '#fed7aa' : '#9a3412' }} />
                </div>
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-bold mb-0.5" style={{ color: isDark ? '#fdba74' : '#7c2d12' }}>
                  GIA DESLIGADA - Atendimento Manual Ativo
                </h4>
                <p className="text-xs" style={{ color: isDark ? 'rgba(251,146,60,0.90)' : '#9a3412' }}>
                  Não esqueça de reativar a GIA quando terminar o atendimento para voltar ao modo automático
                </p>
              </div>
              <button
                onClick={() => toggleBot(true)}
                className="flex-shrink-0 px-4 py-2 rounded-lg text-white text-xs font-bold transition-all shadow-md hover:shadow-lg"
                style={{ background: 'linear-gradient(to right, #7c3aed, #6d28d9)' }}
              >
                Ligar GIA
              </button>
            </div>
          </motion.div>
        )}

        {/* Messages */}
        <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-4 space-y-3">
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
                      backgroundColor: msg.from_me
                        ? `${accentColor}30`
                        : isDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.07)',
                      border: msg.from_me
                        ? `1px solid ${accentColor}40`
                        : isDark ? '1px solid rgba(255,255,255,0.09)' : '1px solid rgba(0,0,0,0.10)'
                    }}
                  >
                    {msg.is_bot && (
                      <div className="flex items-center gap-1 text-[10px] text-purple-400 mb-1">
                        <Bot className="w-3 h-3" />
                        {msg.sender_name || 'GIA'}
                      </div>
                    )}

                    {msg.from_me && msg.enviado_por && usersCache[msg.enviado_por] && !msg.is_bot && (
                      <div className="text-[11px] font-semibold mb-1" style={{ color: isDark ? accentColor : '#0369a1' }}>
                        {usersCache[msg.enviado_por]}:
                      </div>
                    )}

                    {conversa.is_group && !msg.from_me && !msg.is_bot && msg.sender_name && (
                      <div className="text-[11px] font-semibold mb-1" style={{ color: isDark ? '#34d399' : '#065f46' }}>
                        {msg.sender_name}
                      </div>
                    )}

                    {editingMessage?.id === msg.id ? (
                      <div className="space-y-2">
                        <input
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          className="w-full px-2 py-1.5 rounded text-sm focus:outline-none"
                          style={{ background: inputBg, border: `1px solid ${borderColor}`, color: textPrimary }}
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
                          <p className="text-sm whitespace-pre-wrap" style={{ color: isDark ? '#ffffff' : '#1a1a1a' }}>{msg.conteudo}</p>
                        )}

                        {msg.tipo === 'image' && (() => {
                          const mediaUrl = getMediaUrl(msg);
                          return mediaUrl ? (
                            <div className="space-y-1">
                              <div className="relative group/img">
                                <img
                                  src={mediaUrl}
                                  alt=""
                                  className="max-w-full max-h-64 rounded cursor-pointer object-contain bg-black/20"
                                  onClick={() => setPreviewMedia({ url: mediaUrl, type: 'image', name: msg.caption || 'imagem', mimetype: msg.media_mimetype || undefined })}
                                  onError={(e) => {
                                    const target = e.target as HTMLImageElement;
                                    target.style.display = 'none';
                                    target.nextElementSibling?.classList.remove('hidden');
                                  }}
                                />
                                <div className="hidden w-full h-32 bg-white/5 rounded flex-col items-center justify-center">
                                  <ImageLucide className="w-8 h-8 text-gray-500 mb-2" />
                                  <span className="text-xs text-gray-400">Imagem indisponivel</span>
                                </div>
                                <button
                                  onClick={() => downloadMedia(mediaUrl, msg.caption || 'imagem', msg.media_mimetype)}
                                  className="absolute top-1 right-1 p-1.5 rounded bg-black/50 opacity-0 group-hover/img:opacity-100 transition-opacity"
                                >
                                  <Download className="w-3 h-3 text-white" />
                                </button>
                              </div>
                              {msg.caption && msg.caption !== '[Imagem]' && <p className="text-xs text-white">{msg.caption}</p>}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 p-3 bg-white/5 rounded">
                              <ImageLucide className="w-5 h-5 text-gray-500" />
                              <span className="text-xs text-gray-400">Imagem indisponivel</span>
                            </div>
                          );
                        })()}

                        {msg.tipo === 'sticker' && (() => {
                          const mediaUrl = getMediaUrl(msg);
                          return mediaUrl ? (
                            <div className="space-y-1">
                              <img
                                src={mediaUrl}
                                alt="Sticker"
                                className="max-w-[150px] max-h-[150px] object-contain"
                                onError={(e) => {
                                  const target = e.target as HTMLImageElement;
                                  target.className = 'hidden';
                                }}
                              />
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">[Figurinha]</span>
                          );
                        })()}

                        {msg.tipo === 'audio' && (() => {
                          const mediaUrl = getMediaUrl(msg);
                          return mediaUrl ? (
                            <div className="flex items-center gap-2 min-w-[220px] p-1 bg-white/5 rounded-lg">
                              <audio
                                ref={(el) => { audioRefs.current[msg.id] = el; }}
                                src={mediaUrl}
                                className="w-full h-8"
                                controls
                                controlsList="nodownload"
                                preload="metadata"
                                style={{ filter: 'invert(1)', opacity: 0.7 }}
                              />
                              <button
                                onClick={() => downloadMedia(mediaUrl, msg.caption || 'audio', msg.media_mimetype)}
                                className="p-1.5 hover:bg-white/10 rounded flex-shrink-0"
                                title="Baixar audio"
                              >
                                <Download className="w-3.5 h-3.5 text-gray-400" />
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 p-3 bg-white/5 rounded">
                              <Mic className="w-5 h-5 text-gray-500" />
                              <span className="text-xs text-gray-400">Áudio indisponível</span>
                            </div>
                          );
                        })()}

                        {msg.tipo === 'document' && (() => {
                          const mediaUrl = getMediaUrl(msg);
                          return (
                            <div className="flex items-center gap-2 p-2 bg-white/5 rounded min-w-[200px]">
                              <div className="w-10 h-10 rounded bg-white/10 flex items-center justify-center text-gray-400">
                                {getFileIcon(msg.media_mimetype || '')}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-white truncate font-medium">{msg.caption || 'Documento'}</p>
                                <p className="text-[10px] text-gray-500">{msg.media_mimetype}</p>
                              </div>
                              {mediaUrl && (
                                <button onClick={() => downloadMedia(mediaUrl, msg.caption || 'documento', msg.media_mimetype)} className="p-1.5 hover:bg-white/10 rounded">
                                  <Download className="w-4 h-4 text-gray-400" />
                                </button>
                              )}
                            </div>
                          );
                        })()}

                        {msg.tipo === 'video' && (() => {
                          const mediaUrl = getMediaUrl(msg);
                          return mediaUrl ? (
                            <div className="space-y-1">
                              <div className="relative group/vid">
                                <video src={mediaUrl} className="max-w-full max-h-64 rounded" controls />
                                <button
                                  onClick={() => downloadMedia(mediaUrl, msg.caption || 'video', msg.media_mimetype)}
                                  className="absolute top-1 right-1 p-1.5 rounded bg-black/50 opacity-0 group-hover/vid:opacity-100 transition-opacity"
                                >
                                  <Download className="w-3 h-3 text-white" />
                                </button>
                              </div>
                              {msg.caption && msg.caption !== '[Video]' && <p className="text-xs text-white">{msg.caption}</p>}
                            </div>
                          ) : (
                            <div className="flex items-center gap-2 p-3 bg-white/5 rounded">
                              <Video className="w-5 h-5 text-gray-500" />
                              <span className="text-xs text-gray-400">Vídeo indisponível</span>
                            </div>
                          );
                        })()}

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
                      {msg.edited_at && <span className="text-[9px] italic" style={{ color: isDark ? '#6b7280' : '#6b7280' }}>editada</span>}
                      <span className="text-[10px]" style={{ color: isDark ? '#6b7280' : '#555555' }}>{formatTime(msg.created_at)}</span>
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

        {/* Error Message */}
        <AnimatePresence>
          {uploadError && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="border-t border-red-500/30 bg-red-500/10 px-3 py-2"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-red-400">{uploadError}</span>
                <button onClick={() => setUploadError(null)} className="p-1 hover:bg-red-500/20 rounded">
                  <X className="w-3 h-3 text-red-400" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Attachment Preview */}
        <AnimatePresence>
          {showAttachmentPreview && attachments.length > 0 && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="p-3" style={{ borderTop: `1px solid ${borderColor}`, background: isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.04)' }}
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
        <div className="flex-shrink-0 p-3" style={{ borderTop: `1px solid ${borderColor}`, background: inputFooterBg }}>
          {isRecording ? (
            <div className="flex items-center gap-3">
              <button
                onClick={cancelRecording}
                className="p-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 transition-colors"
                title="Cancelar"
              >
                <Trash2 className="w-4 h-4 text-red-400" />
              </button>

              <div className="flex-1 flex items-center gap-3 px-4 py-2.5 bg-white/5 border border-red-500/30 rounded-xl">
                <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
                <span className="text-sm text-white font-medium">{formatRecordingTime(recordingTime)}</span>
                <div className="flex-1 flex items-center gap-1">
                  {[...Array(20)].map((_, i) => (
                    <div
                      key={i}
                      className="w-1 bg-red-400 rounded-full animate-pulse"
                      style={{
                        height: `${Math.random() * 16 + 4}px`,
                        animationDelay: `${i * 50}ms`
                      }}
                    />
                  ))}
                </div>
                <span className="text-xs text-gray-400">Gravando...</span>
              </div>

              <button
                onClick={stopRecording}
                disabled={sending}
                className="p-2.5 rounded-xl transition-colors"
                style={{ backgroundColor: accentColor, opacity: sending ? 0.5 : 1 }}
                title="Enviar audio"
              >
                <Send className="w-4 h-4 text-black" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <input type="file" ref={fileInputRef} onChange={handleFileSelect} multiple accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx" className="hidden" />
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
                      className="absolute bottom-full left-0 mb-2 w-72 rounded-xl shadow-xl p-2 z-50" style={{ background: dropdownBg, border: `1px solid ${dropdownBorder}` }}
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
                <textarea
                  ref={inputRef}
                  value={inputText}
                  onChange={(e) => {
                    setInputText(e.target.value);
                    const el = e.target;
                    el.style.height = 'auto';
                    el.style.height = Math.min(el.scrollHeight, 120) + 'px';
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      sendMessage();
                    }
                  }}
                  placeholder="Digite uma mensagem..."
                  rows={1}
                  className="w-full px-4 py-2.5 rounded-xl text-sm focus:outline-none resize-none overflow-y-auto"
                  style={{ background: inputBg, border: `1px solid ${borderColor}`, color: textPrimary, maxHeight: '120px' }}
                />
              </div>
              {inputText.trim() || attachments.length > 0 ? (
                <button
                  onClick={sendMessage}
                  disabled={sending}
                  className="p-2.5 rounded-xl transition-colors"
                  style={{ backgroundColor: accentColor, opacity: sending ? 0.5 : 1 }}
                >
                  {sending ? (
                    <Loader2 className="w-4 h-4 text-black animate-spin" />
                  ) : (
                    <Send className="w-4 h-4 text-black" />
                  )}
                </button>
              ) : (
                <button
                  onClick={startRecording}
                  className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                  title="Gravar audio"
                >
                  <Mic className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Context Panel */}
      <AnimatePresence>
        {showContextPanel && (
          <motion.div
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="overflow-hidden flex-shrink-0" style={{ borderLeft: `1px solid ${borderColor}` }}
          >
            <div className="w-[280px] h-full overflow-y-auto p-4 space-y-4">
              {/* Client Info */}
              <div className="flex flex-col items-center text-center">
                {renderClientPhoto('lg')}
                <div className="flex items-center gap-1.5 mt-3">
                  <p className="text-sm font-medium" style={{ color: textPrimary }}>
                    {conversa.cliente_nome || 'Nome nao informado'}
                  </p>
                  <button
                    onClick={() => {
                      setEditClienteNome(conversa.cliente_nome || '');
                      setShowEditClienteModal(true);
                    }}
                    className="p-1 rounded hover:bg-white/10 transition-colors"
                    title="Editar nome"
                  >
                    <Edit2 className="w-3 h-3 text-gray-500 hover:text-white" />
                  </button>
                </div>
                <p className="text-xs" style={{ color: textSecondary }}>{conversa.cliente_telefone}</p>
                <p className="text-[10px] mt-1" style={{ color: textSecondary }}>
                  Ultima resposta: {formatLastSeen(conversa.ultima_resposta_cliente_at)}
                </p>
              </div>

              {/* OS Info */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: textSecondary }}>Ordem de Serviço</h4>
                {osData ? (
                  <div className="p-3 rounded-lg space-y-2" style={{ background: sectionBg }}>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px]" style={{ color: textSecondary }}>Interna</span>
                      <span className="text-xs font-medium" style={{ color: textPrimary }}>#{osData.numero_os_interna}</span>
                    </div>
                    {osData.numero_os_samsung && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px]" style={{ color: textSecondary }}>Samsung</span>
                        <span className="text-xs font-medium text-orange-400">{osData.numero_os_samsung}</span>
                      </div>
                    )}
                    {osData.defeito_reclamado && (
                      <div className="pt-2" style={{ borderTop: `1px solid ${borderColor}` }}>
                        <p className="text-[10px] line-clamp-2" style={{ color: textSecondary }}>{osData.defeito_reclamado}</p>
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
                      className="w-full flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-lg text-xs hover:bg-black/5 transition-colors border border-dashed"
                      style={{ background: sectionBg, color: textPrimary, borderColor: borderColor }}
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
                  <h4 className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: textSecondary }}>Visita Tecnica</h4>
                  <div className="p-3 rounded-lg space-y-2" style={{ background: sectionBg }}>
                    {conversa.agendamento_data && (
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4" style={{ color: textSecondary }} />
                        <span className="text-xs" style={{ color: textPrimary }}>
                          {new Date(conversa.agendamento_data).toLocaleDateString('pt-BR')}
                          {conversa.agendamento_hora && ` as ${conversa.agendamento_hora}`}
                        </span>
                      </div>
                    )}
                    {conversa.endereco_visita && (
                      <div className="flex items-start gap-2">
                        <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: textSecondary }} />
                        <span className="text-xs" style={{ color: textPrimary }}>{conversa.endereco_visita}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Quick Actions */}
              <div className="space-y-2">
                <h4 className="text-[10px] font-semibold uppercase tracking-wider" style={{ color: textSecondary }}>Acoes Rapidas</h4>
                <div className="space-y-1.5">
                  <button className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs hover:bg-black/5 transition-colors" style={{ background: sectionBg, color: textPrimary }}>
                    <Zap className="w-3.5 h-3.5" />
                    Disparar Fluxo
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
              className="rounded-xl p-5 w-80 max-h-[70vh] overflow-y-auto"
              style={{ background: dropdownBg, border: `1px solid ${dropdownBorder}` }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-semibold mb-1" style={{ color: textPrimary }}>Transferir Atendimento</h3>
              <p className="text-xs mb-4" style={{ color: textSecondary }}>Selecione um atendente da unidade</p>

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
                          <p className="text-xs font-medium" style={{ color: textPrimary }}>{atendente.nome}</p>
                          {atendente.cargo && <p className="text-[10px]" style={{ color: textSecondary }}>{atendente.cargo}</p>}
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

      {/* Finalizar Modal */}
      <AnimatePresence>
        {showFinalizarModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 flex items-center justify-center z-50"
            onClick={() => setShowFinalizarModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="rounded-xl p-6 w-[420px] max-h-[80vh] overflow-hidden flex flex-col"
              style={{ background: dropdownBg, border: `1px solid ${dropdownBorder}` }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${accentColor}20` }}>
                  <CheckCircle2 className="w-5 h-5" style={{ color: accentColor }} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold" style={{ color: textPrimary }}>Finalizar Atendimento</h3>
                  <p className="text-xs" style={{ color: textSecondary }}>Enviar pesquisa de satisfacao ao cliente</p>
                </div>
              </div>

              {loadingRegras ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : regrasFinalizacao.length === 0 ? (
                <div className="text-center py-6">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                  <p className="text-sm mb-2" style={{ color: textSecondary }}>Nenhuma regra de avaliação configurada</p>
                  <p className="text-xs mb-4" style={{ color: textSecondary }}>Configure regras em Configuracoes &gt; Finalizacao</p>
                  <button
                    onClick={finalizarDiretamente}
                    className="px-4 py-2 rounded-lg text-xs font-medium transition-colors"
                    style={{ backgroundColor: accentColor, color: '#000' }}
                  >
                    Finalizar sem avaliacao
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-xs mb-4" style={{ color: textSecondary }}>
                    Selecione uma regra para enviar a mensagem de avaliacao ao cliente:
                  </p>

                  <div className="flex-1 overflow-y-auto space-y-2 max-h-[300px]">
                    {regrasFinalizacao.map(regra => (
                      <button
                        key={regra.id}
                        onClick={() => enviarAvaliacaoParaCliente(regra)}
                        disabled={sendingAvaliacao}
                        className="w-full text-left p-3 rounded-lg border transition-colors hover:bg-black/5 disabled:opacity-50"
                        style={{ borderColor: regra.is_default ? `${accentColor}40` : dropdownBorder }}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium" style={{ color: textPrimary }}>{regra.nome}</p>
                              {regra.is_default && (
                                <span
                                  className="text-[9px] px-1.5 py-0.5 rounded font-medium"
                                  style={{ backgroundColor: `${accentColor}20`, color: accentColor }}
                                >
                                  PADRAO
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-gray-500 mt-0.5">
                              {regra.opcoes?.length || 0} opcoes de resposta
                            </p>
                          </div>
                          <Star className="w-4 h-4 text-gray-500 flex-shrink-0 mt-0.5" />
                        </div>
                        <div className="mt-2 p-2 bg-black/30 rounded text-[10px] text-gray-400 line-clamp-2 whitespace-pre-wrap">
                          {regra.mensagem_avaliacao?.substring(0, 120)}...
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 pt-3" style={{ borderTop: `1px solid ${borderColor}` }}>
                    <button
                      onClick={finalizarDiretamente}
                      className="w-full px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-xs text-gray-400 hover:bg-white/10 transition-colors"
                    >
                      Finalizar sem pedir avaliacao
                    </button>
                  </div>
                </>
              )}

              <button
                onClick={() => setShowFinalizarModal(false)}
                className="w-full mt-3 px-4 py-2 bg-white/10 rounded-lg text-xs text-gray-400 hover:bg-white/20 transition-colors"
              >
                Cancelar
              </button>

              {sendingAvaliacao && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center rounded-xl">
                  <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2" style={{ color: accentColor }} />
                    <p className="text-sm text-white">Enviando avaliação...</p>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Cliente Modal */}
      <AnimatePresence>
        {showEditClienteModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/80 flex items-center justify-center z-50"
            onClick={() => setShowEditClienteModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="rounded-xl p-5 w-80"
              style={{ background: dropdownBg, border: `1px solid ${dropdownBorder}` }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-semibold mb-1" style={{ color: textPrimary }}>Editar Nome do Cliente</h3>
              <p className="text-xs mb-4" style={{ color: textSecondary }}>Altere o nome de identificacao do cliente</p>

              <input
                type="text"
                value={editClienteNome}
                onChange={(e) => setEditClienteNome(e.target.value)}
                placeholder="Nome do cliente"
                autoFocus
                className="w-full px-3 py-2.5 rounded-lg text-sm focus:outline-none mb-4"
                style={{ background: inputBg, border: `1px solid ${borderColor}`, color: textPrimary }}
              />

              <div className="flex gap-2">
                <button
                  onClick={() => setShowEditClienteModal(false)}
                  className="flex-1 px-4 py-2 bg-white/10 rounded-lg text-xs text-gray-400 hover:bg-white/20 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={saveClienteNome}
                  disabled={savingCliente || !editClienteNome.trim()}
                  className="flex-1 px-4 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
                  style={{ backgroundColor: accentColor, color: '#000' }}
                >
                  {savingCliente ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
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
              className="rounded-xl p-5 w-[420px] max-h-[80vh] overflow-hidden flex flex-col"
              style={{ background: dropdownBg, border: `1px solid ${dropdownBorder}` }}
              onClick={(e) => e.stopPropagation()}
            >
              <h3 className="text-sm font-semibold mb-1" style={{ color: textPrimary }}>Vincular OS Existente</h3>
              <p className="text-xs mb-4" style={{ color: textSecondary }}>Busque pelo numero da OS, nome ou telefone do cliente</p>

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={osSearchTerm}
                  onChange={(e) => setOsSearchTerm(e.target.value)}
                  placeholder="Digite para buscar OS..."
                  autoFocus
                  className="w-full pl-10 pr-10 py-2.5 rounded-lg text-sm focus:outline-none"
                  style={{ background: inputBg, border: `1px solid ${borderColor}`, color: textPrimary }}
                />
                {searchingOS && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-cyan-400 animate-spin" />
                )}
              </div>

              <div className="flex-1 overflow-y-auto space-y-0.5 min-h-[200px]">
                {(() => {
                  const displayList = osSearchTerm.length >= 1 ? osSearchResults : allUnitOS;
                  const isSearching = osSearchTerm.length >= 1 && searchingOS;
                  const isLoading = osSearchTerm.length < 1 && loadingAllOS;

                  if (isSearching || isLoading) {
                    return (
                      <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-6 h-6 text-cyan-400 animate-spin" />
                      </div>
                    );
                  }

                  if (osSearchTerm.length >= 1 && displayList.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <FileText className="w-10 h-10 mb-2 opacity-30" />
                        <p className="text-xs">Nenhuma OS encontrada</p>
                      </div>
                    );
                  }

                  if (displayList.length === 0) {
                    return (
                      <div className="flex flex-col items-center justify-center h-full text-gray-500">
                        <FileText className="w-10 h-10 mb-2 opacity-30" />
                        <p className="text-xs">Nenhuma OS nesta unidade</p>
                      </div>
                    );
                  }

                  return (
                    <>
                      {osSearchTerm.length < 1 && (
                        <div className="flex items-center gap-2 px-2 py-1.5 mb-1">
                          <FileText className="w-3 h-3 text-gray-500" />
                          <span className="text-[10px] text-gray-500">{displayList.length} OS na unidade - digite para filtrar</span>
                        </div>
                      )}
                      {displayList.map(os => (
                        <button
                          key={os.id}
                          onClick={() => vincularOS(os)}
                          className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left group"
                        >
                          <FileText className="w-4 h-4 text-gray-600 group-hover:text-cyan-400 flex-shrink-0 transition-colors" />
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-[11px] font-semibold text-cyan-400 flex-shrink-0">
                              #{os.numero_os_interna || os.numero_os_samsung || '---'}
                            </span>
                            <span className="text-[11px] text-white/70 truncate">
                              {os.cliente_nome || 'Sem nome'}
                            </span>
                            {os.numero_os_samsung && os.numero_os_interna && (
                              <span className="text-[9px] px-1 py-0.5 rounded bg-orange-500/15 text-orange-400/80 flex-shrink-0">
                                SAM
                              </span>
                            )}
                          </div>
                          {os.cliente_telefone && (
                            <span className="text-[10px] text-white/25 flex-shrink-0 hidden group-hover:block">
                              {os.cliente_telefone}
                            </span>
                          )}
                        </button>
                      ))}
                    </>
                  );
                })()}
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
        {showGroupMembers && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100]"
            onClick={() => setShowGroupMembers(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="rounded-xl w-[400px] max-h-[80vh] overflow-hidden flex flex-col"
              style={{ background: dropdownBg, border: `1px solid ${dropdownBorder}` }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-5 flex items-center justify-between" style={{ borderBottom: `1px solid ${borderColor}` }}>
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: `${accentColor}20` }}>
                    <Users className="w-5 h-5" style={{ color: accentColor }} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold" style={{ color: textPrimary }}>
                      {conversa.cliente_nome || 'Grupo'}
                    </h3>
                    <p className="text-[11px]" style={{ color: textSecondary }}>
                      {groupMembers.length} participante{groupMembers.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowGroupMembers(false)}
                  className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-1">
                {loadingMembers ? (
                  <div className="flex items-center justify-center py-10">
                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: accentColor }} />
                  </div>
                ) : groupMembers.length === 0 ? (
                  <div className="text-center py-10 text-gray-500 text-sm">
                    Nenhum participante encontrado
                  </div>
                ) : (
                  [...groupMembers]
                    .sort((a, b) => {
                      const order: Record<string, number> = { superadmin: 0, admin: 1, member: 2 };
                      return (order[a.role] ?? 2) - (order[b.role] ?? 2);
                    })
                    .map((member) => (
                    <div
                      key={member.phone}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 transition-colors"
                    >
                      <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 bg-white/5 overflow-hidden">
                        {member.foto_url ? (
                          <img src={member.foto_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-4 h-4 text-gray-500" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm truncate" style={{ color: textPrimary }}>
                          {member.name || member.phone}
                        </p>
                        {member.name && (
                          <p className="text-[11px]" style={{ color: textSecondary }}>{member.phone}</p>
                        )}
                      </div>
                      {(member.role === 'admin' || member.role === 'superadmin') && (
                        <span
                          className="text-[10px] px-2 py-0.5 rounded-full font-medium flex-shrink-0"
                          style={{
                            backgroundColor: member.role === 'superadmin' ? `${accentColor}20` : 'rgba(234,179,8,0.15)',
                            color: member.role === 'superadmin' ? accentColor : '#EAB308',
                          }}
                        >
                          {member.role === 'superadmin' ? 'Dono' : 'Admin'}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </motion.div>
        )}

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
            <button onClick={() => downloadMedia(previewMedia.url, previewMedia.name || 'download', previewMedia.mimetype)} className="absolute top-4 right-14 p-2 rounded-lg bg-white/10 hover:bg-white/20">
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
