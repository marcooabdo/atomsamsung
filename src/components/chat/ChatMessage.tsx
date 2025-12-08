import { useState } from 'react';
import { Check, CheckCheck, Download, Eye, Image as ImageIcon, FileText, Mic } from 'lucide-react';

interface Message {
  id: string;
  content: string | null;
  message_type: string;
  file_url: string | null;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  sender_name: string;
  sender_photo: string | null;
  read_by?: string[];
}

interface ChatMessageProps {
  message: Message;
  isOwnMessage: boolean;
  showSenderName: boolean;
  isGrouped: boolean;
  conversationType: string;
}

export function ChatMessage({ message, isOwnMessage, showSenderName, isGrouped, conversationType }: ChatMessageProps) {
  const [showReads, setShowReads] = useState(false);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const isRead = message.read_by && message.read_by.length > 0;

  const renderContent = () => {
    if (message.deleted_at) {
      return (
        <div className="italic text-gray-500 text-sm">
          Mensagem removida
        </div>
      );
    }

    if (message.message_type === 'image' && message.file_url) {
      return (
        <div className="space-y-2">
          <img
            src={message.file_url}
            alt="Imagem"
            className="max-w-sm rounded-lg cursor-pointer hover:opacity-90 transition-opacity"
            onClick={() => window.open(message.file_url!, '_blank')}
          />
          {message.content && (
            <p className="text-sm text-gray-300 whitespace-pre-wrap break-words">
              {message.content}
            </p>
          )}
        </div>
      );
    }

    if (message.message_type === 'document' && message.file_url) {
      return (
        <div className="flex items-center gap-3 p-3 bg-black/40 rounded-lg border border-gray-700">
          <FileText className="w-8 h-8 text-[#00D4FF] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-300 truncate">
              {message.file_name}
            </p>
            {message.file_size && (
              <p className="text-xs text-gray-500">
                {formatFileSize(message.file_size)}
              </p>
            )}
          </div>
          <a
            href={message.file_url}
            download
            className="p-2 hover:bg-[#00D4FF]/10 rounded-lg transition-all"
          >
            <Download className="w-5 h-5 text-[#00D4FF]" />
          </a>
        </div>
      );
    }

    if (message.message_type === 'audio' && message.file_url) {
      return (
        <div className="flex items-center gap-3 p-3 bg-black/40 rounded-lg border border-gray-700">
          <Mic className="w-6 h-6 text-[#00D4FF] flex-shrink-0" />
          <audio src={message.file_url} controls className="flex-1" />
        </div>
      );
    }

    return (
      <p className="text-sm text-gray-300 whitespace-pre-wrap break-words">
        {message.content}
      </p>
    );
  };

  return (
    <div className={`flex gap-2 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
      {!isOwnMessage && !isGrouped && conversationType === 'group' && (
        <div className="w-8 h-8 rounded-full bg-[#00D4FF]/20 flex items-center justify-center flex-shrink-0 mt-auto mb-1">
          {message.sender_photo ? (
            <img src={message.sender_photo} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            <span className="text-[#00D4FF] text-sm font-bold">
              {message.sender_name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      )}

      {!isOwnMessage && isGrouped && conversationType === 'group' && (
        <div className="w-8"></div>
      )}

      <div className={`max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {showSenderName && (
          <span className="text-xs text-[#00D4FF] font-semibold px-2">
            {message.sender_name}
          </span>
        )}

        <div
          className={`rounded-lg px-3 py-2 ${
            isOwnMessage
              ? 'bg-[#00D4FF]/20 border border-[#00D4FF]/30'
              : 'bg-gray-800/80 border border-gray-700'
          }`}
          style={isOwnMessage ? {
            boxShadow: '0 0 20px rgba(0, 212, 255, 0.15)'
          } : {}}
        >
          {renderContent()}

          <div className="flex items-center justify-end gap-2 mt-1">
            {message.edited_at && (
              <span className="text-[10px] text-gray-500">editada</span>
            )}
            <span className="text-[10px] text-gray-500">
              {formatTime(message.created_at)}
            </span>

            {isOwnMessage && (
              <div className="flex items-center">
                {conversationType === 'group' && isRead ? (
                  <button
                    onClick={() => setShowReads(!showReads)}
                    className="hover:scale-110 transition-transform"
                  >
                    <CheckCheck className={`w-3.5 h-3.5 ${isRead ? 'text-[#00D4FF]' : 'text-gray-500'}`} />
                  </button>
                ) : (
                  isRead ? (
                    <CheckCheck className="w-3.5 h-3.5 text-[#00D4FF]" />
                  ) : (
                    <Check className="w-3.5 h-3.5 text-gray-500" />
                  )
                )}
              </div>
            )}
          </div>
        </div>

        {showReads && conversationType === 'group' && message.read_by && message.read_by.length > 0 && (
          <div className="mt-1 p-2 bg-black/60 rounded-lg border border-[#00D4FF]/20 text-xs">
            <div className="flex items-center gap-1 text-[#00D4FF] mb-1">
              <Eye className="w-3 h-3" />
              <span className="font-semibold">Lido por {message.read_by.length}</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
