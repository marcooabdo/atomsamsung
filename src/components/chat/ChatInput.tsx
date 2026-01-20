import { useState, useRef, KeyboardEvent, useEffect, DragEvent, ClipboardEvent, forwardRef, useImperativeHandle } from 'react';
import { supabase } from '../../lib/supabase';
import { Send, Paperclip, Image, FileText, X } from 'lucide-react';
import { Message } from './ChatMessageList';

interface ChatInputProps {
  conversationId: string;
  userId: string;
  userName?: string;
  onMessageSent?: () => void;
  onMessageAdded?: (message: Message) => void;
}

interface ImagePreview {
  file: File;
  dataUrl: string;
}

export interface ChatInputRef {
  prepareImagePreview: (file: File) => void;
}

export const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(
  ({ conversationId, userId, onMessageSent, onMessageAdded }, ref) => {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [imagePreview, setImagePreview] = useState<ImagePreview | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dragCounterRef = useRef(0);

  useImperativeHandle(ref, () => ({
    prepareImagePreview
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
          prepareImagePreview(file);
        }
        break;
      }
    }
  };

  const prepareImagePreview = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      alert('Imagem muito grande. Limite: 5MB');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setImagePreview({
        file,
        dataUrl: e.target?.result as string
      });
    };
    reader.readAsDataURL(file);
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
    const imageFile = files.find(file => file.type.startsWith('image/'));

    if (imageFile) {
      prepareImagePreview(imageFile);
    }
  };

  const cancelImagePreview = () => {
    setImagePreview(null);
  };

  const sendImagePreview = async () => {
    if (!imagePreview) return;
    await handleFileUpload(imagePreview.file, 'image');
    setImagePreview(null);
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
      console.log('📤 Iniciando upload de arquivo:', {
        nome: file.name,
        tamanho: file.size,
        tipo: file.type,
        messageType,
        conversationId
      });

      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const filePath = `${conversationId}/${fileName}`;

      console.log('📂 Path do arquivo:', filePath);

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('chat-files')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) {
        console.error('❌ Erro no upload:', uploadError);
        throw new Error(`Erro no upload: ${uploadError.message}`);
      }

      console.log('✅ Upload concluído:', uploadData);

      const { data: { publicUrl } } = supabase.storage
        .from('chat-files')
        .getPublicUrl(filePath);

      console.log('🔗 URL pública:', publicUrl);

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
        console.error('❌ Erro ao criar mensagem:', messageError);
        throw new Error(`Erro ao criar mensagem: ${messageError.message}`);
      }

      console.log('✅ Mensagem criada:', messageData);

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
      console.log('✅ Arquivo enviado com sucesso!');
    } catch (err: any) {
      console.error('❌ Erro completo:', err);
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
            <Image className="w-16 h-16 text-[#00D4FF] mx-auto mb-3 animate-bounce" />
            <p className="text-lg font-semibold text-[#00D4FF]">Solte a imagem aqui</p>
            <p className="text-sm text-gray-300 mt-1">Para enviar no chat</p>
          </div>
        </div>
      )}

      {imagePreview && (
        <div className="mb-3 p-3 bg-[#151f26] border border-[#1a3a4a] rounded-lg">
          <div className="flex items-start gap-3">
            <div className="relative flex-shrink-0">
              <img
                src={imagePreview.dataUrl}
                alt="Preview"
                className="w-20 h-20 object-cover rounded-lg border border-[#1a3a4a]"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-300 truncate">{imagePreview.file.name}</p>
              <p className="text-xs text-gray-500 mt-1">
                {(imagePreview.file.size / 1024).toFixed(1)} KB
              </p>
              <div className="flex gap-2 mt-2">
                <button
                  onClick={sendImagePreview}
                  disabled={uploading}
                  className="px-3 py-1.5 bg-[#00D4FF] hover:bg-[#00D4FF]/80 rounded-lg text-xs font-medium text-black transition-all disabled:opacity-50"
                >
                  Enviar Imagem
                </button>
                <button
                  onClick={cancelImagePreview}
                  disabled={uploading}
                  className="px-3 py-1.5 bg-[#1a3a4a]/50 hover:bg-[#1a3a4a] rounded-lg text-xs font-medium text-gray-300 transition-all disabled:opacity-50"
                >
                  Cancelar
                </button>
              </div>
            </div>
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
            placeholder="Digite uma mensagem ou cole/arraste uma imagem..."
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
