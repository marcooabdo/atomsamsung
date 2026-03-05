import { X, Download } from 'lucide-react';
import { getStoragePublicUrl } from '../lib/storageUtils';

interface AnexoPreviewModalProps {
  anexo: {
    id: string;
    nome_arquivo: string;
    url: string;
  };
  onClose: () => void;
}

export function AnexoPreviewModal({ anexo, onClose }: AnexoPreviewModalProps) {
  const publicUrl = anexo.url.includes('://') ? anexo.url : getStoragePublicUrl(anexo.url);

  const getFileExtension = (filename: string) => {
    return filename.split('.').pop()?.toLowerCase() || '';
  };

  const isImage = (filename: string) => {
    const ext = getFileExtension(filename);
    return ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext);
  };

  const isPDF = (filename: string) => {
    const ext = getFileExtension(filename);
    return ext === 'pdf';
  };

  const canPreview = isImage(anexo.nome_arquivo) || isPDF(anexo.nome_arquivo);

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = publicUrl;
    link.download = anexo.nome_arquivo;
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!canPreview) {
    handleDownload();
    onClose();
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(10px)' }}
      onClick={onClose}
    >
      <div
        className="relative max-w-7xl max-h-[90vh] w-full h-full flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex items-center justify-between p-4 mb-4"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid rgba(var(--accent-rgb),0.3)',
            borderRadius: '12px',
            boxShadow: 'var(--card-shadow)'
          }}
        >
          <h3 className="text-lg font-bold truncate max-w-[70%]" style={{ color: 'var(--text-primary)' }}>
            {anexo.nome_arquivo}
          </h3>
          <div className="flex gap-2">
            <button
              onClick={handleDownload}
              className="p-2 rounded-lg transition-all duration-300 flex items-center gap-2"
              style={{ background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.4)', color: '#10B981' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.22)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(16,185,129,0.12)'; }}
              title="Baixar arquivo"
            >
              <Download className="w-4 h-4" />
              <span className="text-sm font-bold">Baixar</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-all duration-300"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.4)', color: '#EF4444' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.22)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; }}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div
          className="flex-1 overflow-auto flex items-center justify-center"
          style={{
            background: 'var(--bg-card)',
            border: '1px solid rgba(var(--accent-rgb),0.2)',
            borderRadius: '12px',
          }}
        >
          {isImage(anexo.nome_arquivo) ? (
            <img
              src={publicUrl}
              alt={anexo.nome_arquivo}
              className="max-w-full max-h-full object-contain"
              style={{
                boxShadow: '0 0 40px rgba(var(--accent-rgb),0.3)'
              }}
            />
          ) : isPDF(anexo.nome_arquivo) ? (
            <iframe
              src={publicUrl}
              className="w-full h-full"
              style={{
                minHeight: '600px',
                border: 'none',
                borderRadius: '8px'
              }}
              title={anexo.nome_arquivo}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}
