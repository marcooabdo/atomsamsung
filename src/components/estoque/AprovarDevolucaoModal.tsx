import { useState, useRef } from 'react';
import { X, CheckCircle, Camera, QrCode, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface AprovarDevolucaoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (foto?: File, qrCode?: string) => void;
  requisicao: {
    id: string;
    descricao: string;
    codigo_peca: string;
    tipo_devolucao: string;
    motivo_devolucao: string;
    is_lote?: boolean;
    pecas_estoque_ids?: string[];
    pecas_lote?: Array<{
      id: string;
      id_numerico: number;
    }>;
  };
}

export function AprovarDevolucaoModal({ isOpen, onClose, onConfirm, requisicao }: AprovarDevolucaoModalProps) {
  const [qrCode, setQrCode] = useState('');
  const [foto, setFoto] = useState<File | null>(null);
  const [previewFoto, setPreviewFoto] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFoto(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewFoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onConfirm(foto || undefined, qrCode.trim() || undefined);
      setQrCode('');
      setFoto(null);
      setPreviewFoto('');
      onClose();
    } catch (error) {
      console.error('Erro ao aprovar:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setQrCode('');
      setFoto(null);
      setPreviewFoto('');
      onClose();
    }
  };

  const tipoLabel = requisicao.tipo_devolucao === 'nova' ? 'Nova' :
                    requisicao.tipo_devolucao === 'nova_com_defeito' ? 'Nova com Defeito' :
                    'Usada';

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-gradient-to-br from-gray-900 to-black border border-[#39FF14]/30 rounded-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto cyber-scrollbar shadow-2xl">
        <div className="sticky top-0 bg-gradient-to-r from-[#39FF14]/20 to-[#00D4FF]/20 backdrop-blur-sm p-6 flex items-center justify-between z-10 border-b border-[#39FF14]/30">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-[#39FF14]/20 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-[#39FF14]" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-[#39FF14]">Aprovar Devolução</h2>
              <p className="text-xs text-gray-400">Confirme os dados da devolução</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={loading}
            className="text-gray-400 hover:text-white transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Informações da Peça */}
          <div className="bg-[#00D4FF]/10 border border-[#00D4FF]/30 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-[#00D4FF] mb-3 uppercase tracking-wider">
              Informações da Peça
            </h3>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 uppercase">PN:</span>
                <span className="text-sm font-mono font-bold text-white">{requisicao.codigo_peca}</span>
              </div>
              <div className="flex items-start gap-2">
                <span className="text-xs text-gray-400 uppercase">Descrição:</span>
                <span className="text-sm text-gray-200">{requisicao.descricao}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-gray-400 uppercase">Tipo:</span>
                <span className="text-sm font-bold text-[#39FF14]">{tipoLabel}</span>
              </div>
              {(requisicao.is_lote && requisicao.pecas_lote && requisicao.pecas_lote.length > 1) && (
                <div className="flex items-start gap-2 mt-3 pt-3 border-t border-[#00D4FF]/20">
                  <span className="text-xs text-gray-400 uppercase">IDs do Lote:</span>
                  <div className="flex flex-wrap gap-2">
                    {requisicao.pecas_lote.map(peca => (
                      <span
                        key={peca.id}
                        className="px-2 py-1 rounded text-xs font-mono font-bold bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/40"
                      >
                        #{peca.id_numerico}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Motivo da Devolução */}
          <div className="bg-gray-900/50 border border-gray-700 rounded-lg p-4">
            <p className="text-xs text-gray-400 uppercase font-semibold mb-2">Motivo da Devolução:</p>
            <p className="text-sm text-gray-300">{requisicao.motivo_devolucao}</p>
          </div>

          {/* QR Code (Opcional) */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <QrCode className="w-4 h-4 text-[#00D4FF]" />
              QR Code da Peça
              <span className="text-xs text-gray-500 font-normal">(opcional)</span>
            </label>
            <input
              type="text"
              value={qrCode}
              onChange={(e) => setQrCode(e.target.value)}
              placeholder="Digite ou escaneie o QR Code da peça"
              className="neon-input"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 mt-2">
              Utilize um leitor de QR Code ou digite manualmente o código
            </p>
          </div>

          {/* Foto (Opcional) */}
          <div>
            <label className="block text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
              <Camera className="w-4 h-4 text-[#39FF14]" />
              Foto da Peça
              <span className="text-xs text-gray-500 font-normal">(opcional)</span>
            </label>

            {previewFoto ? (
              <div className="relative">
                <img
                  src={previewFoto}
                  alt="Preview"
                  className="w-full h-48 object-cover rounded-lg border border-[#39FF14]/30"
                />
                <button
                  onClick={() => {
                    setFoto(null);
                    setPreviewFoto('');
                    if (fileInputRef.current) {
                      fileInputRef.current.value = '';
                    }
                  }}
                  className="absolute top-2 right-2 p-2 bg-red-500/80 hover:bg-red-500 rounded-full transition-colors"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full border-2 border-dashed border-gray-700 hover:border-[#39FF14]/50 rounded-lg p-8 flex flex-col items-center justify-center gap-3 transition-colors group"
                disabled={loading}
              >
                <Upload className="w-8 h-8 text-gray-600 group-hover:text-[#39FF14] transition-colors" />
                <p className="text-sm text-gray-400 group-hover:text-gray-300 transition-colors">
                  Clique para adicionar foto da peça
                </p>
                <p className="text-xs text-gray-600">JPG, PNG ou JPEG (máx. 5MB)</p>
              </button>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFotoChange}
              className="hidden"
            />
          </div>

          {/* Aviso */}
          <div className="bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-lg p-4 flex items-start gap-2">
            <CheckCircle className="w-4 h-4 text-[#39FF14] flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-xs text-[#39FF14] font-semibold">Confirmação</p>
              <p className="text-xs text-gray-300 mt-1">
                Ao aprovar, {requisicao.is_lote && requisicao.pecas_lote && requisicao.pecas_lote.length > 1 ? 'as peças serão retornadas' : 'a peça será retornada'} ao estoque e o técnico será notificado.
              </p>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-900/95 backdrop-blur-sm border-t border-gray-800 p-6 flex gap-4">
          <button
            onClick={handleClose}
            disabled={loading}
            className="flex-1 px-6 py-3 border border-gray-700 rounded-lg font-medium hover:bg-gray-800 transition disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 px-6 py-3 rounded-lg font-bold uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            style={{
              backgroundColor: '#39FF1420',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: '#39FF14',
              color: '#39FF14',
              boxShadow: '0 0 20px rgba(57, 255, 20, 0.3)'
            }}
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-[#39FF14] border-t-transparent rounded-full animate-spin" />
                Aprovando...
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                Aprovar Devolução
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
