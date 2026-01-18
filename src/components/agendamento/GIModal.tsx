import { useState } from 'react';
import { X, Package, Camera, FileText, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface GIModalProps {
  requisicaoId: string;
  osId: string;
  pecaNome: string;
  isLote?: boolean;
  pecasLote?: Array<{
    id: string;
    id_numerico: number;
    valor_com_impostos: string;
    delivery: string | null;
  }>;
  onClose: () => void;
  onSuccess: () => void;
}

export function GIModal({ requisicaoId, osId, pecaNome, isLote, pecasLote, onClose, onSuccess }: GIModalProps) {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(false);
  const [foto, setFoto] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string>('');
  const [descricao, setDescricao] = useState('');
  const [pecasSelecionadas, setPecasSelecionadas] = useState<string[]>(
    isLote && pecasLote ? pecasLote.map(p => p.id) : []
  );

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFoto(file);
      setFotoPreview(URL.createObjectURL(file));
    }
  };

  const handleTogglePeca = (pecaId: string) => {
    setPecasSelecionadas(prev =>
      prev.includes(pecaId)
        ? prev.filter(id => id !== pecaId)
        : [...prev, pecaId]
    );
  };

  const handleToggleTodas = () => {
    if (!pecasLote) return;
    if (pecasSelecionadas.length === pecasLote.length) {
      setPecasSelecionadas([]);
    } else {
      setPecasSelecionadas(pecasLote.map(p => p.id));
    }
  };

  const handleSubmit = async () => {
    if (!foto) {
      alert('Por favor, adicione uma foto da peça defeituosa');
      return;
    }

    if (!descricao.trim()) {
      alert('Por favor, descreva o problema encontrado');
      return;
    }

    if (isLote && pecasSelecionadas.length === 0) {
      alert('Por favor, selecione pelo menos uma peça do lote');
      return;
    }

    setLoading(true);

    try {
      const fileName = `gi_${requisicaoId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('os-anexos')
        .upload(fileName, foto);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('os-anexos')
        .getPublicUrl(fileName);

      // Atualizar requisição com os dados do GI
      const { error: updateError } = await supabase
        .from('requisicoes_pecas')
        .update({
          gi_foto_url: publicUrl,
          gi_descricao: descricao,
          gi_postado_em: new Date().toISOString(),
          gi_postado_por: usuario?.id,
          updated_at: new Date().toISOString()
        })
        .eq('id', requisicaoId);

      if (updateError) throw updateError;

      // Se for lote, atualizar as peças específicas selecionadas no estoque
      if (isLote && pecasSelecionadas.length > 0) {
        const { error: estoquePecasError } = await supabase
          .from('estoque_pecas')
          .update({
            status: 'gi_postada',
            gi_postada_em: new Date().toISOString()
          })
          .in('id', pecasSelecionadas);

        if (estoquePecasError) throw estoquePecasError;

        // Comentário específico com IDs do lote
        const idsNumericos = pecasLote
          ?.filter(p => pecasSelecionadas.includes(p.id))
          .map(p => `#${p.id_numerico}`)
          .join(', ');

        await supabase.from('os_comentarios').insert({
          os_id: osId,
          usuario_id: usuario?.id,
          comentario: `GI postado para peça ${pecaNome} (Lote - IDs: ${idsNumericos}). Problema: ${descricao}`,
          is_system: true
        });
      } else {
        await supabase.from('os_comentarios').insert({
          os_id: osId,
          usuario_id: usuario?.id,
          comentario: `GI postado para peça ${pecaNome}. Problema: ${descricao}`,
          is_system: true
        });
      }

      await supabase.from('os_anexos').insert({
        os_id: osId,
        tipo: 'gi',
        url: publicUrl,
        uploaded_by: usuario?.id
      });

      alert('GI postado com sucesso! O estoque será notificado.');
      onSuccess();
      onClose();
    } catch (error: any) {
      alert(`Erro ao postar GI: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="premium-card w-full max-w-2xl">
        <div className="p-6 border-b border-[#FFBF00]/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#FFBF00]/20 flex items-center justify-center">
                <Package className="w-6 h-6 text-[#FFBF00]" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#FFBF00]">Postar GI (Garantia Interna)</h2>
                <p className="text-sm text-gray-400">{pecaNome}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          <div className="premium-card p-4 bg-[#00D4FF]/5 border border-[#00D4FF]/30">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-[#00D4FF] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[#00D4FF] font-semibold text-sm">O que é GI (Garantia Interna)?</p>
                <p className="text-gray-300 text-xs mt-1">
                  Utilize quando uma peça apresenta defeito ou não funciona corretamente.
                  Tire uma foto clara da peça e descreva o problema encontrado.
                </p>
              </div>
            </div>
          </div>

          {isLote && pecasLote && pecasLote.length > 1 && (
            <div className="premium-card p-4 bg-[#FFBF00]/5 border border-[#FFBF00]/30">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[#FFBF00]">
                  Selecione as peças com defeito
                </h3>
                <button
                  onClick={handleToggleTodas}
                  className="text-xs px-3 py-1 rounded border border-[#FFBF00]/40 text-[#FFBF00] hover:bg-[#FFBF00]/10 transition-colors"
                >
                  {pecasSelecionadas.length === pecasLote.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                </button>
              </div>
              <div className="space-y-2">
                {pecasLote.map((peca) => (
                  <label
                    key={peca.id}
                    className="flex items-center gap-3 p-3 rounded bg-gray-900/50 hover:bg-gray-900/70 cursor-pointer transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={pecasSelecionadas.includes(peca.id)}
                      onChange={() => handleTogglePeca(peca.id)}
                      className="w-4 h-4 rounded border-[#FFBF00]/40 text-[#FFBF00] focus:ring-[#FFBF00] focus:ring-offset-0"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[#39FF14] font-bold">ID #{peca.id_numerico}</span>
                        {peca.delivery && (
                          <span className="text-xs text-gray-400">Delivery: {peca.delivery}</span>
                        )}
                        <span className="text-xs text-gray-300">
                          R$ {Number(peca.valor_com_impostos).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-2">
                {pecasSelecionadas.length} de {pecasLote.length} peça(s) selecionada(s)
              </p>
            </div>
          )}

          <div>
            <label className="block text-sm font-semibold text-[#FFBF00] mb-3 flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Foto da Peça Defeituosa *
            </label>

            <input
              type="file"
              accept="image/*"
              onChange={handleFotoChange}
              className="neon-input w-full mb-3"
            />

            {fotoPreview && (
              <div className="relative">
                <img
                  src={fotoPreview}
                  alt="Preview"
                  className="w-full max-h-64 object-contain rounded border-2 border-[#FFBF00]/30"
                />
                <button
                  onClick={() => {
                    setFoto(null);
                    setFotoPreview('');
                  }}
                  className="absolute top-2 right-2 bg-[#FF0064] text-white rounded-full p-2 hover:bg-[#FF0064]/80 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-[#FFBF00] mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Descrição do Problema *
            </label>
            <textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              className="neon-input w-full h-32 resize-none"
              placeholder="Descreva detalhadamente o problema encontrado na peça..."
            />
            <p className="text-xs text-gray-400 mt-1">
              Seja específico: o que testou, qual erro apresentou, etc.
            </p>
          </div>
        </div>

        <div className="p-6 border-t border-[#FFBF00]/20 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 rounded-lg border border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || !foto || !descricao.trim()}
            className="flex-1 px-6 py-3 rounded-lg font-bold uppercase tracking-wider transition-all"
            style={{
              backgroundColor: '#FFBF0020',
              borderWidth: '1px',
              borderStyle: 'solid',
              borderColor: '#FFBF00',
              color: '#FFBF00',
              boxShadow: '0 0 20px rgba(255, 191, 0, 0.3)'
            }}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-[#FFBF00] border-t-transparent rounded-full animate-spin" />
                Enviando...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Postar GI
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
