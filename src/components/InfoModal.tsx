import { AlertCircle, X } from 'lucide-react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  message: string;
}

export function InfoModal({ isOpen, onClose, title, message }: InfoModalProps) {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)' }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl"
        style={{
          background: 'linear-gradient(135deg, rgba(0,0,0,0.95) 0%, rgba(10,10,10,0.98) 100%)',
          border: '1px solid rgba(251,191,36,0.3)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5), 0 0 0 1px rgba(251,191,36,0.1)'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 border-b border-gray-800/50 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="p-2 rounded-lg"
              style={{
                background: 'linear-gradient(135deg, rgba(251,191,36,0.15) 0%, rgba(251,191,36,0.05) 100%)',
                border: '1px solid rgba(251,191,36,0.3)',
                boxShadow: '0 0 12px rgba(251,191,36,0.15)'
              }}
            >
              <AlertCircle className="w-5 h-5 text-[#FBB024]" />
            </div>
            <h2 className="text-xl font-bold text-white">{title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg transition-all duration-300"
            style={{
              background: 'linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(239,68,68,0.1) 100%)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#EF4444'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(239,68,68,0.3) 0%, rgba(239,68,68,0.2) 100%)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(239,68,68,0.2) 0%, rgba(239,68,68,0.1) 100%)';
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <p className="text-gray-300 text-sm leading-relaxed">{message}</p>
        </div>

        <div className="p-6 border-t border-gray-800/50 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 rounded-lg text-sm font-bold transition-all duration-300"
            style={{
              background: 'linear-gradient(135deg, rgba(251,191,36,0.2) 0%, rgba(251,191,36,0.1) 100%)',
              border: '1px solid rgba(251,191,36,0.3)',
              color: '#FBB024'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(251,191,36,0.3) 0%, rgba(251,191,36,0.2) 100%)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'linear-gradient(135deg, rgba(251,191,36,0.2) 0%, rgba(251,191,36,0.1) 100%)';
              e.currentTarget.style.transform = 'translateY(0)';
            }}
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  );
}
