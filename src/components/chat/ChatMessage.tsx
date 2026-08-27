import { useState, useRef, useEffect } from 'react';
import { Check, CheckCheck, Download, Eye, FileText, Mic, MoreVertical, Pencil, Trash2, Pin } from 'lucide-react';

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
  pinned_at?: string | null;
  mentioned_user_ids?: string[] | null;
}

interface ChatMessageProps {
  message: Message;
  isOwnMessage: boolean;
  showSenderName: boolean;
  isGrouped: boolean;
  conversationType: string;
  onEdit?: (message: Message) => void;
  onDelete?: (messageId: string) => void;
  onPin?: (messageId: string) => void;
  currentUserName?: string;
}

export function ChatMessage({ message, isOwnMessage, showSenderName, isGrouped, conversationType, onEdit, onDelete, onPin, currentUserName }: ChatMessageProps) {
  const [showReads, setShowReads] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  const getUserColor = (name: string) => {
    const colors = [
      '#00D4FF', '#39FF14', '#FF6B35', '#FFD700',
      '#FF1493', '#8A2BE2', '#00FA9A', '#FF69B4',
    ];
    const hash = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return colors[hash % colors.length];
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const isRead = message.read_by && message.read_by.length > 0;
  const isDeleted = !!message.deleted_at;
  const canEdit = isOwnMessage && !isDeleted && message.message_type === 'text';
  const canDelete = isOwnMessage && !isDeleted;
  const canPin = !isDeleted;

  const renderMentionHighlightedContent = (text: string) => {
    const mentionRegex = /@[\w\s]+/g;
    const parts = text.split(mentionRegex);
    const mentions = text.match(mentionRegex) || [];

    const result: React.ReactNode[] = [];
    parts.forEach((part, i) => {
      result.push(part);
      if (mentions[i]) {
        const isSelfMention = currentUserName && mentions[i].slice(1).trim().toLowerCase() === currentUserName.toLowerCase();
        result.push(
          <span
            key={i}
            className={`font-semibold ${isSelfMention ? 'bg-[#00D4FF]/20 text-[#00D4FF] px-0.5 rounded' : 'text-[#00D4FF]'}`}
          >
            {mentions[i]}
          </span>
        );
      }
    });
    return result;
  };

  const renderContent = () => {
    if (isDeleted) {
      return (
        <div className="italic text-gray-500 text-sm flex items-center gap-1.5">
          <Trash2 className="w-3.5 h-3.5" />
          Mensagem apagada
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
              {renderMentionHighlightedContent(message.content)}
            </p>
          )}
        </div>
      );
    }

    if (message.message_type === 'document' && message.file_url) {
      return (
        <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-900/40 to-blue-800/30 rounded-lg border border-blue-500/40"
             style={{ boxShadow: '0 0 15px rgba(59, 130, 246, 0.2)' }}>
          <FileText className="w-8 h-8 text-blue-400 flex-shrink-0" style={{ filter: 'drop-shadow(0 0 4px rgba(59, 130, 246, 0.6))' }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-blue-200 truncate">
              {message.file_name}
            </p>
            {message.file_size && (
              <p className="text-xs text-blue-300/60">
                {formatFileSize(message.file_size)}
              </p>
            )}
          </div>
          <a
            href={message.file_url}
            download
            className="p-2 hover:bg-blue-500/20 rounded-lg transition-all"
          >
            <Download className="w-5 h-5 text-blue-400" />
          </a>
        </div>
      );
    }

    if (message.message_type === 'audio' && message.file_url) {
      return (
        <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-purple-900/40 to-purple-800/30 rounded-lg border border-purple-500/40"
             style={{ boxShadow: '0 0 15px rgba(168, 85, 247, 0.2)' }}>
          <Mic className="w-6 h-6 text-purple-400 flex-shrink-0" style={{ filter: 'drop-shadow(0 0 4px rgba(168, 85, 247, 0.6))' }} />
          <audio src={message.file_url} controls className="flex-1" />
        </div>
      );
    }

    return (
      <p className="text-sm text-gray-100 whitespace-pre-wrap break-words">
        {message.content ? renderMentionHighlightedContent(message.content) : null}
      </p>
    );
  };

  return (
    <div className={`group flex gap-2 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}>
      {!isOwnMessage && !isGrouped && conversationType === 'group' && (
        <div
          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-auto mb-1"
          style={{
            backgroundColor: `${getUserColor(message.sender_name)}20`,
            border: `2px solid ${getUserColor(message.sender_name)}60`
          }}
        >
          {message.sender_photo ? (
            <img src={message.sender_photo} alt="" className="w-full h-full rounded-full object-cover" />
          ) : (
            <span
              className="text-sm font-bold"
              style={{ color: getUserColor(message.sender_name) }}
            >
              {message.sender_name.charAt(0).toUpperCase()}
            </span>
          )}
        </div>
      )}

      {!isOwnMessage && isGrouped && conversationType === 'group' && (
        <div className="w-8"></div>
      )}

      <div className={`relative max-w-[70%] ${isOwnMessage ? 'items-end' : 'items-start'} flex flex-col gap-1`}>
        {showSenderName && (
          <span
            className="text-xs font-bold px-2"
            style={{
              color: getUserColor(message.sender_name),
              textShadow: `0 0 10px ${getUserColor(message.sender_name)}60`
            }}
          >
            {message.sender_name}
          </span>
        )}

        <div className="relative">
          {!isDeleted && (
            <button
              onClick={() => setShowMenu(!showMenu)}
              className={`absolute ${isOwnMessage ? '-left-8' : '-right-8'} top-1 p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10`}
            >
              <MoreVertical className="w-4 h-4 text-gray-400" />
            </button>
          )}

          {showMenu && (
            <div
              ref={menuRef}
              className={`absolute ${isOwnMessage ? 'right-full mr-2' : 'left-full ml-2'} top-0 z-50 bg-[#1a2832] border border-[#00D4FF]/20 rounded-xl shadow-2xl overflow-hidden min-w-[140px]`}
              style={{ boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
            >
              {canPin && (
                <button
                  onClick={() => { onPin?.(message.id); setShowMenu(false); }}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-200 hover:bg-[#00D4FF]/10 transition-colors"
                >
                  <Pin className="w-4 h-4 text-[#00D4FF]" />
                  {message.pinned_at ? 'Desafixar' : 'Fixar'}
                </button>
              )}
              {canEdit && (
                <button
                  onClick={() => { onEdit?.(message); setShowMenu(false); }}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-gray-200 hover:bg-[#00D4FF]/10 transition-colors"
                >
                  <Pencil className="w-4 h-4 text-[#00D4FF]" />
                  Editar
                </button>
              )}
              {canDelete && (
                <button
                  onClick={() => { onDelete?.(message.id); setShowMenu(false); }}
                  className="flex items-center gap-2.5 w-full px-4 py-2.5 text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  Apagar
                </button>
              )}
            </div>
          )}

          <div
            className={`rounded-2xl px-3 py-2 ${
              isOwnMessage
                ? 'bg-[#0d2832] rounded-br-sm'
                : 'bg-[#1a2832] rounded-bl-sm'
            } ${message.pinned_at ? 'ring-1 ring-[#FFD700]/40' : ''}`}
          >
            {message.pinned_at && (
              <div className="flex items-center gap-1 mb-1">
                <Pin className="w-3 h-3 text-[#FFD700]" />
                <span className="text-[10px] text-[#FFD700]">Fixada</span>
              </div>
            )}

            {renderContent()}

            <div className="flex items-center justify-end gap-2 mt-1">
              {message.edited_at && !isDeleted && (
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
