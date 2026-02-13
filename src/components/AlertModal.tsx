import { X, AlertCircle, CheckCircle, AlertTriangle, Info } from 'lucide-react';

interface AlertModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message: string;
  type?: 'success' | 'error' | 'warning' | 'info';
  confirmText?: string;
}

export default function AlertModal({
  isOpen,
  onClose,
  title,
  message,
  type = 'info',
  confirmText = 'OK'
}: AlertModalProps) {
  if (!isOpen) return null;

  const icons = {
    success: <CheckCircle className="w-12 h-12 text-green-400" />,
    error: <AlertCircle className="w-12 h-12 text-red-400" />,
    warning: <AlertTriangle className="w-12 h-12 text-yellow-400" />,
    info: <Info className="w-12 h-12 text-blue-400" />
  };

  const borderColors = {
    success: 'border-green-500/30',
    error: 'border-red-500/30',
    warning: 'border-yellow-500/30',
    info: 'border-blue-500/30'
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999] p-4">
      <div className={`bg-[#0a0a0a] rounded-xl border ${borderColors[type]} max-w-md w-full shadow-2xl`}>
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 mt-1">
              {icons[type]}
            </div>
            <div className="flex-1 min-w-0">
              {title && (
                <h3 className="text-lg font-semibold text-white mb-2">
                  {title}
                </h3>
              )}
              <p className="text-gray-300 whitespace-pre-wrap break-words">
                {message}
              </p>
            </div>
            <button
              onClick={onClose}
              className="flex-shrink-0 text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="px-6 pb-6 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg hover:from-cyan-400 hover:to-blue-400 transition-all font-medium"
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
