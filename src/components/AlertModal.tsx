import { X, AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  confirmText?: string;
}

const TYPE_CONFIG = {
  success: { rgb: '34,197,94',   color: '#22C55E', Icon: CheckCircle  },
  error:   { rgb: '239,68,68',   color: '#EF4444', Icon: AlertCircle  },
  warning: { rgb: '245,158,11',  color: '#F59E0B', Icon: AlertTriangle },
  info:    { rgb: '14,165,233',  color: '#0EA5E9', Icon: Info         },
};

export default function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  confirmText = 'OK'
}: AlertModalProps) {
  if (!isOpen) return null;

  const { rgb, color, Icon } = TYPE_CONFIG[type];

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)' }}
      onClick={onClose}
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
              <Icon className="w-6 h-6" style={{ color }} />
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
              onClick={onClose}
              className="flex-shrink-0 p-1 rounded transition-all duration-200"
              style={{ color: 'var(--text-secondary)' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="px-6 pb-6 flex justify-end" style={{ borderTop: '1px solid var(--border-primary)' }}>
          <button
            onClick={onClose}
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
