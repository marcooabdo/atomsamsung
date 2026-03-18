import { useState, useRef, KeyboardEvent, useEffect, DragEvent, ClipboardEvent, forwardRef, useImperativeHandle } from 'react';
import { supabase } from '../../lib/supabase';
import { Send, Paperclip, Image, FileText, X, Music } from 'lucide-react';
import { Message } from './ChatMessageList';

interface ChatInputProps {
  conversationId: string;
  userId: string;
  userName?: string;
  onMessageSent?: () => void;
  onMessageAdded?: (message: Message) => void;
}

interface FilePreview {
  file: File;
  dataUrl?: string;
  type: 'image' | 'document' | 'audio';
}

export interface ChatInputRef {
  prepareImagePreview: (file: File) => void;
  prepareFilePreviews: (files: File[]) => void;
}

export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(
  ({ conversationId, userId, onMessageSent, onMessageAdded }, ref) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [filePreviews, setFilePreviews] = useState<FilePreview[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  useImperativeHandle(ref, () => ({
    prepareImagePreview: (file: File) => prepareFilePreviews([file]),
    prepareFilePreviews
  }));

  useEffect(() => {
    const handleWindowPaste = (e: any) => {
      if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') {
        return;
      }
    };

    window.addEventListener('paste', handleWindowPaste);
    return () => window.removeEventListener('paste', handleWindowPaste);
  }, []);

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

  const handleSendMessage = async () => {
    if (!message.trim() || sending) return;

    const messageContent = message.trim();
    setSending(true);

    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .insert({
          conversation_id: conversationId,
          sender_id: userId,
          content: messageContent,
          message_type: 'text'
        })
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
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);

    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  };

  const handleFileUpload = async (file: File, messageType: 'image' | 'document' | 'audio') => {
    if (!file) return;

    setUploading(true);
    setShowAttachMenu(false);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${conversationId}/${fileName}`;

      const { data: uploadData, error: uploadError } = await supabase.storage
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
                  <img
                    src={preview.dataUrl}
                    alt="Preview"
                    className="w-12 h-12 object-cover rounded border border-[#1a3a4a] flex-shrink-0"
                  />
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
                  <p className="text-xs text-gray-500">
                    {(preview.file.size / 1024).toFixed(1)} KB
                  </p>
                </div>

                <button
                  onClick={() => removeFilePreview(index)}
                  disabled={uploading}
                  className="p-1.5 hover:bg-[#1a3a4a]/50 rounded transition-all disabled:opacity-50"
                  title="Remover"
                >
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

      <div className="flex items-end gap-3">
        <div className="relative">
          <button
            onClick={() => setShowAttachMenu(!showAttachMenu)}
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
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
              />

              <button
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip';
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

        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Digite uma mensagem ou cole/arraste arquivos..."
            disabled={sending || uploading}
            rows={1}
            className="w-full px-4 py-2.5 bg-[#151f26] border border-[#1a3a4a]/50 rounded-xl text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-[#00D4FF]/40 resize-none disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ maxHeight: '120px' }}
          />
        </div>

        <button
          onClick={handleSendMessage}
          disabled={!message.trim() || sending || uploading}
          className="p-2.5 bg-[#00D4FF] hover:bg-[#00D4FF]/80 rounded-xl transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          title="Enviar mensagem"
        >
          <Send className="w-5 h-5 text-black" />
        </button>
      </div>
    </div>
  );
});

ChatInput.displayName = 'ChatInput';
