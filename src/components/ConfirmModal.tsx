import { X, AlertTriangle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  type?: 'danger' | 'warning' | 'info';
}

const TYPE_CONFIG = {
  danger:  { rgb: '239,68,68',  color: '#EF4444' },
  warning: { rgb: '245,158,11', color: '#F59E0B' },
  info:    { rgb: '14,165,233', color: '#0EA5E9' },
};

export default function ConfirmModal({
  isOpen,
  onConfirm,
  onCancel,
  title,
  message,
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  type = 'warning'
}: ConfirmModalProps) {
  if (!isOpen) return null;

  const { rgb, color } = TYPE_CONFIG[type];

  const handleConfirm = () => { onConfirm(); onCancel(); };

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onCancel}
    >
      <div
        className="max-w-md w-full rounded-xl"
        style={{
          background: 'var(--bg-card)',
          border: `1px solid rgba(${rgb},0.35)`,
          boxShadow: 'var(--card-shadow)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div
              className="flex-shrink-0 p-2 rounded-lg mt-0.5"
              style={{ background: `rgba(${rgb},0.12)`, border: `1px solid rgba(${rgb},0.3)` }}
            >
              <AlertTriangle className="w-6 h-6" style={{ color }} />
            </div>
            <div className="flex-1 min-w-0">
              {title && (
                <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                  {title}
                </h3>
              )}
              <p className="text-sm whitespace-pre-wrap break-words" style={{ color: 'var(--text-secondary)' }}>
                {message}
              </p>
            </div>
            <button
              onClick={onCancel}
              className="flex-shrink-0 p-1 rounded transition-all duration-200"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="px-6 pb-6 flex justify-end gap-3" style={{ borderTop: '1px solid var(--border-primary)' }}>
          <button
            onClick={onCancel}
            className="mt-4 px-6 py-2 rounded-lg text-sm font-bold transition-all duration-300"
            style={{
              background: 'transparent',
              border: '1px solid var(--border-primary)',
              color: 'var(--text-secondary)'
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(var(--accent-rgb),0.06)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
          >
            {cancelText}
          </button>
          <button
            onClick={handleConfirm}
            className="mt-4 px-6 py-2 rounded-lg text-sm font-bold transition-all duration-300"
            style={{ background: `rgba(${rgb},0.12)`, border: `1px solid rgba(${rgb},0.3)`, color }}
            onMouseEnter={(e) => { e.currentTarget.style.background = `rgba(${rgb},0.22)`; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = `rgba(${rgb},0.12)`; e.currentTarget.style.transform = 'translateY(0)'; }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
