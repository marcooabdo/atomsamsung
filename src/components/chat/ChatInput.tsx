import { useState, useRef, KeyboardEvent } from 'react';
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

export function ChatInput({ conversationId, userId, onMessageSent, onMessageAdded }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

      const { error: uploadError } = await supabase.storage
        .from('chat-files')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

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

      if (messageError) throw messageError;

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
    } catch (err) {
      alert('Erro ao enviar arquivo');
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
    <div className="px-4 py-3 border-t border-[#1a3a4a]/50 bg-[#0d1419]">
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
            <div className="absolute bottom-full left-0 mb-2 bg-[#151f26] border border-[#1a3a4a] rounded-lg overflow-hidden shadow-xl min-w-[180px]">
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
            placeholder="Digite uma mensagem..."
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
}
