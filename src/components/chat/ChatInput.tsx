import { useState, useRef, KeyboardEvent, useEffect, DragEvent, ClipboardEvent, forwardRef, useImperativeHandle } from 'react';
import { supabase } from '../../lib/supabase';
import { Send, Paperclip, Image, FileText, X, Music, Pencil, Smile, Mic, Square, Reply } from 'lucide-react';
import { Message } from './ChatMessageList';

const EMOJI_LIST = [
  '😀','😃','😄','😁','😆','😅','🤣','😂','🙂','😉',
  '😊','😇','🥰','😍','🤩','😘','😗','😋','😛','😜',
  '🤪','😝','🤑','🤗','🤭','🤫','🤔','🤐','🤨','😐',
  '😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪',
  '🤤','😴','😷','🤒','🤕','🤢','🤮','🥵','🥶','🥴',
  '😵','🤯','🤠','🥳','😎','🤓','🧐','😕','😟','🙁',
  '😮','😯','😲','😳','🥺','😦','😧','😨','😰','😥',
  '😢','😭','😱','😖','😣','😞','😓','😩','😫','🥱',
  '😤','😡','😠','🤬','👍','👎','👏','🙌','🤝','🙏',
  '💪','❤️','🔥','⭐','💯','🎉','🎊','✅','❌','💬',
  '👋','✌️','🤞','🤟','🤘','👌','🤌','👈','👉','👆',
  '👇','☝️','✋','🤚','🖐️','🖖','👊','✊','🤛','🤜',
];

interface Participant {
  user_id: string;
  nome: string;
  foto_url?: string | null;
}

interface ChatInputProps {
  conversationId: string;
  userId: string;
  userName?: string;
  onMessageSent?: () => void;
  onMessageAdded?: (message: Message) => void;
  editingMessage?: { id: string; content: string } | null;
  onCancelEdit?: () => void;
  onEditComplete?: (messageId: string, newContent: string) => void;
  participants?: Participant[];
  replyingTo?: { id: string; sender_name: string; content: string | null; message_type: string } | null;
  onCancelReply?: () => void;
}

interface FilePreview {
  file: File;
  dataUrl?: string;
  type: 'image' | 'document' | 'audio';
}

export interface ChatInputRef {
  prepareImagePreview: (file: File) => void;
  prepareFilePreviews: (files: File[]) => void;
  focus: () => void;
}

export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(
  ({ conversationId, userId, userName, onMessageSent, onMessageAdded, editingMessage, onCancelEdit, onEditComplete, participants = [], replyingTo, onCancelReply }, ref) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [filePreviews, setFilePreviews] = useState<FilePreview[]>([]);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartPos, setMentionStartPos] = useState<number | null>(null);
  const [selectedMentionIndex, setSelectedMentionIndex] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);
  const mentionListRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useImperativeHandle(ref, () => ({
    prepareImagePreview: (file: File) => prepareFilePreviews([file]),
    prepareFilePreviews,
    focus: () => textareaRef.current?.focus()
  }));

  useEffect(() => {
    if (editingMessage) {
      setMessage(editingMessage.content);
      textareaRef.current?.focus();
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
        textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
      }
    }
  }, [editingMessage]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(e.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    if (showEmojiPicker) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker]);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const filteredParticipants = participants.filter(p =>
    p.user_id !== userId &&
    p.nome.toLowerCase().includes(mentionQuery.toLowerCase())
  );

  useEffect(() => {
    setSelectedMentionIndex(0);
  }, [mentionQuery]);

  const insertEmoji = (emoji: string) => {
    const textarea = textareaRef.current;
    if (!textarea) {
      setMessage(prev => prev + emoji);
      return;
    }
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newMsg = message.substring(0, start) + emoji + message.substring(end);
    setMessage(newMsg);
    setShowEmojiPicker(false);
    setTimeout(() => {
      const pos = start + emoji.length;
      textarea.setSelectionRange(pos, pos);
      textarea.focus();
    }, 0);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        streamRef.current = null;
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }

        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (blob.size < 1000) {
          setIsRecording(false);
          setRecordingTime(0);
          return;
        }
        const file = new File([blob], `audio-${Date.now()}.webm`, { type: 'audio/webm' });
        setIsRecording(false);
        setRecordingTime(0);
        await handleFileUpload(file, 'audio');
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      recordingTimerRef.current = setInterval(() => {
        setRecordingTime(prev => prev + 1);
      }, 1000);
    } catch {
      alert('Permissao de microfone negada ou indisponivel.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  };

  const cancelRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(t => t.stop());
          streamRef.current = null;
        }
      };
      mediaRecorderRef.current.stop();
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    setRecordingTime(0);
  };

  const formatRecordingTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handlePaste = async (e: ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          prepareFilePreviews([file]);
        }
        break;
      }
    }
  };

  const getFileType = (file: File): 'image' | 'document' | 'audio' => {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('audio/')) return 'audio';
    return 'document';
  };

  const validateFile = (file: File): string | null => {
    const fileType = getFileType(file);
    if (fileType === 'image' && file.size > 5 * 1024 * 1024) {
      return `${file.name}: Imagem muito grande. Limite: 5MB`;
    }
    if (fileType === 'document' && file.size > 10 * 1024 * 1024) {
      return `${file.name}: Documento muito grande. Limite: 10MB`;
    }
    if (fileType === 'audio' && file.size > 10 * 1024 * 1024) {
      return `${file.name}: Áudio muito grande. Limite: 10MB`;
    }
    return null;
  };

  const prepareFilePreviews = (files: File[]) => {
    const validFiles: FilePreview[] = [];
    const errors: string[] = [];

    files.forEach(file => {
      const error = validateFile(file);
      if (error) {
        errors.push(error);
        return;
      }

      const fileType = getFileType(file);

      if (fileType === 'image') {
        const reader = new FileReader();
        reader.onload = (e) => {
          setFilePreviews(prev => [...prev, {
            file,
            dataUrl: e.target?.result as string,
            type: fileType
          }]);
        };
        reader.readAsDataURL(file);
      } else {
        validFiles.push({
          file,
          type: fileType
        });
      }
    });

    if (validFiles.length > 0) {
      setFilePreviews(prev => [...prev, ...validFiles]);
    }

    if (errors.length > 0) {
      alert(errors.join('\n'));
    }
  };

  const handleDragEnter = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounterRef.current--;
    if (dragCounterRef.current === 0) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    dragCounterRef.current = 0;

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      prepareFilePreviews(files);
    }
  };

  const removeFilePreview = (index: number) => {
    setFilePreviews(prev => prev.filter((_, i) => i !== index));
  };

  const sendAllPreviews = async () => {
    if (filePreviews.length === 0) return;

    for (const preview of filePreviews) {
      await handleFileUpload(preview.file, preview.type);
    }

    setFilePreviews([]);
  };

  const extractMentionedUserIds = (text: string): string[] => {
    const ids: string[] = [];
    const mentionRegex = /@[\w\s]+/g;
    const mentions = text.match(mentionRegex) || [];

    mentions.forEach(mention => {
      const name = mention.slice(1).trim().toLowerCase();
      const participant = participants.find(p => p.nome.toLowerCase() === name);
      if (participant) {
        ids.push(participant.user_id);
      }
    });
    return ids;
  };

  const handleSendMessage = async () => {
    if (editingMessage) {
      if (!message.trim()) return;
      onEditComplete?.(editingMessage.id, message.trim());
      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
      return;
    }

    if (!message.trim() || sending) return;

    const messageContent = message.trim();
    const mentionedIds = extractMentionedUserIds(messageContent);
    setSending(true);

    try {
      const insertData: any = {
        conversation_id: conversationId,
        sender_id: userId,
        content: messageContent,
        message_type: 'text'
      };

      if (mentionedIds.length > 0) {
        insertData.mentioned_user_ids = mentionedIds;
      }

      if (replyingTo) {
        insertData.reply_to_message_id = replyingTo.id;
      }

      const { data, error } = await supabase
        .from('chat_messages')
        .insert(insertData)
        .select()
        .single();

      if (error) throw error;

      setMessage('');
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }

      if (data && onMessageAdded) {
        const { data: userData } = await supabase
          .from('usuarios')
          .select('nome')
          .eq('id', userId)
          .maybeSingle();

        onMessageAdded({
          ...data,
          sender_name: userData?.nome || 'Voce'
        } as Message);
      }

      onMessageSent?.();
    } catch (err) {
      alert('Erro ao enviar mensagem');
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (showMentions && filteredParticipants.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedMentionIndex(prev => Math.min(prev + 1, filteredParticipants.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedMentionIndex(prev => Math.max(prev - 1, 0));
        return;
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        insertMention(filteredParticipants[selectedMentionIndex]);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        setShowMentions(false);
        return;
      }
    }

    if (e.key === 'Escape' && editingMessage) {
      e.preventDefault();
      onCancelEdit?.();
      setMessage('');
      return;
    }

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const insertMention = (participant: Participant) => {
    if (mentionStartPos === null) return;

    const before = message.substring(0, mentionStartPos);
    const after = message.substring(textareaRef.current?.selectionStart || message.length);
    const newMessage = `${before}@${participant.nome} ${after}`;

    setMessage(newMessage);
    setShowMentions(false);
    setMentionStartPos(null);

    setTimeout(() => {
      const cursorPos = before.length + participant.nome.length + 2;
      textareaRef.current?.setSelectionRange(cursorPos, cursorPos);
      textareaRef.current?.focus();
    }, 0);
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }

    const cursorPos = e.target.selectionStart;
    const textBeforeCursor = value.substring(0, cursorPos);
    const lastAtIndex = textBeforeCursor.lastIndexOf('@');

    if (lastAtIndex !== -1) {
      const textAfterAt = textBeforeCursor.substring(lastAtIndex + 1);
      const hasSpace = textAfterAt.includes('\n');

      if (!hasSpace && (lastAtIndex === 0 || value[lastAtIndex - 1] === ' ' || value[lastAtIndex - 1] === '\n')) {
        setShowMentions(true);
        setMentionQuery(textAfterAt);
        setMentionStartPos(lastAtIndex);
        return;
      }
    }

    setShowMentions(false);
    setMentionStartPos(null);
  };

  const handleFileUpload = async (file: File, messageType: 'image' | 'document' | 'audio') => {
    if (!file) return;

    setUploading(true);
    setShowAttachMenu(false);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${conversationId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('chat-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        throw new Error(`Erro no upload: ${uploadError.message}`);
      }

      const { data: { publicUrl } } = supabase.storage
        .from('chat-files')
        .getPublicUrl(filePath);

      const { data: messageData, error: messageError } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: userId,
          content: null,
          message_type: messageType,
          file_url: publicUrl,
          file_name: file.name,
          file_size: file.size
        })
        .select()
        .single();

      if (messageError) {
        throw new Error(`Erro ao criar mensagem: ${messageError.message}`);
      }

      if (messageData && onMessageAdded) {
        const { data: userData } = await supabase
          .from('usuarios')
          .select('nome')
          .eq('id', userId)
          .maybeSingle();

        onMessageAdded({
          ...messageData,
          sender_name: userData?.nome || 'Voce'
        } as Message);
      }

      onMessageSent?.();
    } catch (err: any) {
      alert(`Erro ao enviar arquivo: ${err.message || 'Erro desconhecido'}`);
    } finally {
      setUploading(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        alert('Imagem muito grande. Limite: 5MB');
        return;
      }
      handleFileUpload(file, 'image');
    }
    e.target.value = '';
  };

  const handleDocumentSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        alert('Arquivo muito grande. Limite: 10MB');
        return;
      }
      handleFileUpload(file, 'document');
    }
    e.target.value = '';
  };

  if (isRecording) {
    return (
      <div className="relative px-4 py-3 border-t border-[#1a3a4a]/50 bg-[#0d1419]">
        <div className="flex items-center gap-3">
          <button
            onClick={cancelRecording}
            className="p-2.5 hover:bg-red-500/20 rounded-xl transition-all"
            title="Cancelar"
          >
            <X className="w-5 h-5 text-red-400" />
          </button>

          <div className="flex-1 flex items-center gap-3 px-4 py-2.5 bg-[#151f26] border border-red-500/30 rounded-xl">
            <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm text-red-400 font-medium">Gravando</span>
            <span className="text-sm text-gray-400 font-mono">{formatRecordingTime(recordingTime)}</span>
          </div>

          <button
            onClick={stopRecording}
            className="p-2.5 bg-[#00D4FF] hover:bg-[#00D4FF]/80 rounded-xl transition-all"
            title="Enviar audio"
          >
            <Send className="w-5 h-5 text-black" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="relative px-4 py-3 border-t border-[#1a3a4a]/50 bg-[#0d1419]"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {isDragging && (
        <div className="absolute inset-0 bg-[#00D4FF]/20 border-2 border-dashed border-[#00D4FF] rounded-lg backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="text-center">
            <Paperclip className="w-16 h-16 text-[#00D4FF] mx-auto mb-3 animate-bounce" />
            <p className="text-lg font-semibold text-[#00D4FF]">Solte os arquivos aqui</p>
            <p className="text-sm text-gray-300 mt-1">Imagens, documentos ou áudios</p>
          </div>
        </div>
      )}

      {filePreviews.length > 0 && (
        <div className="mb-3 p-3 bg-[#151f26] border border-[#1a3a4a] rounded-lg">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-gray-300">
              {filePreviews.length} arquivo{filePreviews.length > 1 ? 's' : ''} para enviar
            </p>
            <button
              onClick={sendAllPreviews}
              disabled={uploading}
              className="px-3 py-1.5 bg-[#00D4FF] hover:bg-[#00D4FF]/80 rounded-lg text-xs font-medium text-black transition-all disabled:opacity-50"
            >
              Enviar {filePreviews.length > 1 ? 'Todos' : ''}
            </button>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto">
            {filePreviews.map((preview, index) => (
              <div key={index} className="flex items-center gap-3 p-2 bg-[#0d1419] rounded-lg border border-[#1a3a4a]/50">
                {preview.type === 'image' && preview.dataUrl ? (
                  <img src={preview.dataUrl} alt="Preview" className="w-12 h-12 object-cover rounded border border-[#1a3a4a] flex-shrink-0" />
                ) : preview.type === 'document' ? (
                  <div className="w-12 h-12 flex items-center justify-center bg-[#1a3a4a]/30 rounded border border-[#1a3a4a] flex-shrink-0">
                    <FileText className="w-6 h-6 text-[#00D4FF]" />
                  </div>
                ) : preview.type === 'audio' ? (
                  <div className="w-12 h-12 flex items-center justify-center bg-[#1a3a4a]/30 rounded border border-[#1a3a4a] flex-shrink-0">
                    <Music className="w-6 h-6 text-[#00D4FF]" />
                  </div>
                ) : (
                  <div className="w-12 h-12 flex items-center justify-center bg-[#1a3a4a]/30 rounded border border-[#1a3a4a] flex-shrink-0">
                    <Image className="w-6 h-6 text-[#00D4FF]" />
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-300 truncate">{preview.file.name}</p>
                  <p className="text-xs text-gray-500">{(preview.file.size / 1024).toFixed(1)} KB</p>
                </div>

                <button onClick={() => removeFilePreview(index)} disabled={uploading} className="p-1.5 hover:bg-[#1a3a4a]/50 rounded transition-all disabled:opacity-50" title="Remover">
                  <X className="w-4 h-4 text-gray-400" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {uploading && (
        <div className="mb-3 px-4 py-2 bg-[#00D4FF]/10 border border-[#00D4FF]/30 rounded-lg">
          <div className="flex items-center gap-3">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-[#00D4FF]"></div>
            <span className="text-sm text-[#00D4FF]">Enviando arquivo...</span>
          </div>
        </div>
      )}

      {editingMessage && (
        <div className="mb-3 px-4 py-2 bg-[#FFD700]/10 border border-[#FFD700]/30 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Pencil className="w-4 h-4 text-[#FFD700]" />
            <span className="text-sm text-[#FFD700]">Editando mensagem</span>
          </div>
          <button onClick={() => { onCancelEdit?.(); setMessage(''); }} className="p-1 hover:bg-white/10 rounded">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      )}

      {replyingTo && !editingMessage && (
        <div className="mb-3 px-4 py-2 bg-[#00D4FF]/10 border border-[#00D4FF]/30 rounded-lg flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Reply className="w-4 h-4 text-[#00D4FF] flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-[#00D4FF] truncate">Respondendo a {replyingTo.sender_name}</p>
              <p className="text-xs text-gray-400 truncate">
                {replyingTo.message_type === 'image' ? '\ud83d\udcf7 Imagem' :
                 replyingTo.message_type === 'document' ? '\ud83d\udcce Documento' :
                 replyingTo.message_type === 'audio' ? '\ud83c\udfa4 \u00c1udio' :
                 replyingTo.content || 'Mensagem'}
              </p>
            </div>
          </div>
          <button onClick={() => onCancelReply?.()} className="p-1 hover:bg-white/10 rounded flex-shrink-0">
            <X className="w-4 h-4 text-gray-400" />
          </button>
        </div>
      )}

      <div className="flex items-end gap-2">
        {!editingMessage && (
          <>
            <div className="relative" ref={emojiPickerRef}>
              <button
                onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowAttachMenu(false); }}
                className="p-2.5 hover:bg-[#1a3a4a]/50 rounded-lg transition-all"
                title="Emoji"
              >
                <Smile className="w-5 h-5 text-gray-400 hover:text-[#00D4FF]" />
              </button>

              {showEmojiPicker && (
                <div
                  className="absolute bottom-full left-0 mb-2 bg-[#151f26] border border-[#00D4FF]/20 rounded-xl shadow-2xl z-50 p-3 w-[320px]"
                  style={{ boxShadow: '0 -8px 32px rgba(0,0,0,0.5)' }}
                >
                  <div className="grid grid-cols-8 gap-1 max-h-[240px] overflow-y-auto pr-1">
                    {EMOJI_LIST.map(emoji => (
                      <button
                        key={emoji}
                        onClick={() => insertEmoji(emoji)}
                        className="w-8 h-8 flex items-center justify-center rounded hover:bg-white/10 hover:scale-110 transition-all text-lg"
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="relative">
              <button
                onClick={() => { setShowAttachMenu(!showAttachMenu); setShowEmojiPicker(false); }}
                disabled={uploading}
                className="p-2.5 hover:bg-[#1a3a4a]/50 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                title="Anexar arquivo"
              >
                {showAttachMenu ? (
                  <X className="w-5 h-5 text-gray-400" />
                ) : (
                  <Paperclip className="w-5 h-5 text-gray-400 hover:text-[#00D4FF]" />
                )}
              </button>

              {showAttachMenu && (
                <div className="absolute bottom-full left-0 mb-2 bg-[#151f26] border border-[#1a3a4a] rounded-lg overflow-hidden shadow-xl min-w-[180px] z-10">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-[#1a3a4a]/50 transition-all text-left w-full"
                  >
                    <Image className="w-5 h-5 text-[#00D4FF]" />
                    <div>
                      <p className="text-sm font-medium text-gray-200">Foto/Imagem</p>
                      <p className="text-xs text-gray-500">Até 5MB</p>
                    </div>
                  </button>
                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />

                  <button
                    onClick={() => {
                      const input = document.createElement('input');
                      input.type = 'file';
                      input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar,.mp4,.mov';
                      input.onchange = (e: any) => handleDocumentSelect(e);
                      input.click();
                    }}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-[#1a3a4a]/50 transition-all text-left w-full border-t border-[#1a3a4a]"
                  >
                    <FileText className="w-5 h-5 text-[#00D4FF]" />
                    <div>
                      <p className="text-sm font-medium text-gray-200">Documento</p>
                      <p className="text-xs text-gray-500">Até 10MB</p>
                    </div>
                  </button>
                </div>
              )}
            </div>
          </>
        )}

        <div className="flex-1 relative">
          {showMentions && filteredParticipants.length > 0 && (
            <div
              ref={mentionListRef}
              className="absolute bottom-full left-0 right-0 mb-2 bg-[#151f26] border border-[#00D4FF]/20 rounded-xl shadow-2xl overflow-hidden max-h-48 overflow-y-auto z-50"
              style={{ boxShadow: '0 -8px 32px rgba(0,0,0,0.5)' }}
            >
              {filteredParticipants.map((p, i) => (
                <button
                  key={p.user_id}
                  onClick={() => insertMention(p)}
                  className={`flex items-center gap-3 w-full px-4 py-2.5 text-left transition-colors ${
                    i === selectedMentionIndex ? 'bg-[#00D4FF]/10' : 'hover:bg-[#1a3a4a]/50'
                  }`}
                >
                  <div className="w-7 h-7 rounded-full bg-[#1a3a4a] flex items-center justify-center overflow-hidden flex-shrink-0">
                    {p.foto_url ? (
                      <img src={p.foto_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xs font-bold text-[#00D4FF]">{p.nome.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <span className="text-sm text-gray-200">{p.nome}</span>
                </button>
              ))}
            </div>
          )}

          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={editingMessage ? 'Editar mensagem...' : 'Digite uma mensagem ou cole/arraste arquivos...'}
            disabled={sending || uploading}
            rows={1}
            className={`w-full px-4 py-2.5 bg-[#151f26] border rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none resize-none disabled:opacity-50 disabled:cursor-not-allowed ${
              editingMessage ? 'border-[#FFD700]/40 focus:border-[#FFD700]/60' : 'border-[#1a3a4a]/50 focus:border-[#00D4FF]/40'
            }`}
            style={{ maxHeight: '120px' }}
          />
        </div>

        <button
          onClick={handleSendMessage}
          disabled={!message.trim() || sending || uploading}
          className={`p-2.5 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed ${
            editingMessage ? 'bg-[#FFD700] hover:bg-[#FFD700]/80' : 'bg-[#00D4FF] hover:bg-[#00D4FF]/80'
          }`}
          title={editingMessage ? 'Salvar edição' : 'Enviar mensagem'}
        >
          {editingMessage ? (
            <Pencil className="w-5 h-5 text-black" />
          ) : (
            <Send className="w-5 h-5 text-black" />
          )}
        </button>

        {!editingMessage && (
          <button
            onClick={startRecording}
            disabled={uploading || sending}
            className="p-2.5 hover:bg-[#1a3a4a]/50 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
            title="Gravar áudio"
          >
            <Mic className="w-5 h-5 text-gray-400 hover:text-[#00D4FF]" />
          </button>
        )}
      </div>
    </div>
  );
});

ChatInput.displayName = 'ChatInput';
