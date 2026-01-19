import { useState } from 'react';
import { X, Package, CheckCircle } from 'lucide-react';
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
    delivery?: string | null;
    estoque_etiquetas?: Array<{ delivery: string | null }>;
    gi_postada_em?: string | null;
    gi_postada_por?: string | null;
    usuario_gi_postado?: { nome: string } | null;
  }>;
  onClose: () => void;
  onSuccess: () => void;
}

export function GIModal({ requisicaoId, osId, pecaNome, isLote, pecasLote, onClose, onSuccess }: GIModalProps) {
  const { usuario } = useAuth();
  const [loading, setLoading] = useState(false);
  const [pecasSelecionadas, setPecasSelecionadas] = useState<string[]>(
    isLote && pecasLote ? pecasLote.filter(p => !p.gi_postada_em).map(p => p.id) : []
  );

  const handleTogglePeca = (pecaId: string) => {
    setPecasSelecionadas(prev =>
      prev.includes(pecaId)
        ? prev.filter(id => id !== pecaId)
        : [...prev, pecaId]
    );
  };

  const handleToggleTodas = () => {
    if (!pecasLote) return;
    const pecasDisponiveis = pecasLote.filter(p => !p.gi_postada_em);
    if (pecasSelecionadas.length === pecasDisponiveis.length) {
      setPecasSelecionadas([]);
    } else {
      setPecasSelecionadas(pecasDisponiveis.map(p => p.id));
    }
  };

  const handleSubmit = async () => {
    if (isLote && pecasSelecionadas.length === 0) {
      alert('Por favor, selecione pelo menos uma peça para confirmar o consumo');
      return;
    }

    setLoading(true);

    try {
      // Se for lote, atualizar as peças específicas selecionadas no estoque
      if (isLote && pecasSelecionadas.length > 0) {
        const { error: estoquePecasError } = await supabase
          .from('estoque_pecas')
          .update({
            status: 'usada',
            gi_postada_em: new Date().toISOString(),
            gi_postada_por: usuario?.id
          })
          .in('id', pecasSelecionadas);

        if (estoquePecasError) throw estoquePecasError;

        // Verificar quantas peças do lote ainda não têm GI postada
        const pecasSemGI = pecasLote?.filter(p =>
          !pecasSelecionadas.includes(p.id) && !p.gi_postada_em
        ) || [];

        // Se TODAS as peças do lote têm GI, mudar status da requisição para "gi_postada"
        // Se ainda existem peças sem GI, manter como "atendida"
        const todasPecasComGI = pecasSemGI.length === 0;

        if (todasPecasComGI) {
          const { error: updateError } = await supabase
            .from('requisicoes_pecas')
            .update({
              status: 'gi_postada',
              gi_postada_em: new Date().toISOString(),
              tipo_devolucao: 'usada',
              motivo_devolucao: 'Peça consumida - GI postada',
              updated_at: new Date().toISOString()
            })
            .eq('id', requisicaoId);

          if (updateError) throw updateError;
        }

        // Comentário específico com IDs do lote
        const idsNumericos = pecasLote
          ?.filter(p => pecasSelecionadas.includes(p.id))
          .map(p => `#${p.id_numerico}`)
          .join(', ');

        await supabase.from('os_comentarios').insert({
          os_id: osId,
          usuario_id: usuario?.id,
          comentario: `GI postada por ${usuario?.nome}: ${pecaNome} (Lote - IDs: ${idsNumericos}) - Peças consumidas${todasPecasComGI ? '' : ' (ainda existem peças sem GI neste lote)'}`,
          is_system: true
        });
      } else {
        // Peça única - mudar status da requisição
        const { error: updateError } = await supabase
          .from('requisicoes_pecas')
          .update({
            status: 'gi_postada',
            gi_postada_em: new Date().toISOString(),
            tipo_devolucao: 'usada',
            motivo_devolucao: 'Peça consumida - GI postada',
            updated_at: new Date().toISOString()
          })
          .eq('id', requisicaoId);

        if (updateError) throw updateError;

        await supabase.from('os_comentarios').insert({
          os_id: osId,
          usuario_id: usuario?.id,
          comentario: `GI postada por ${usuario?.nome}: ${pecaNome} - Peça consumida`,
          is_system: true
        });
      }

      alert('GI postada com sucesso! Consumo confirmado.');
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
        <div className="p-6 border-b border-[#39FF14]/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-[#39FF14]/20 flex items-center justify-center">
                <Package className="w-6 h-6 text-[#39FF14]" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#39FF14]">Confirmar Consumo (GI)</h2>
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
          <div className="premium-card p-4 bg-[#39FF14]/5 border border-[#39FF14]/30">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-[#39FF14] flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[#39FF14] font-semibold text-sm">O que é GI (Garantia Interna)?</p>
                <p className="text-gray-300 text-xs mt-1">
                  Utilize para confirmar que a(s) peça(s) foi/foram consumida(s) no reparo.
                  Selecione quais peças do lote foram utilizadas.
                </p>
              </div>
            </div>
          </div>

          {isLote && pecasLote && pecasLote.length > 1 && (
            <div className="premium-card p-4 bg-[#39FF14]/5 border border-[#39FF14]/30">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-[#39FF14]">
                  Selecione as peças consumidas
                </h3>
                <button
                  onClick={handleToggleTodas}
                  className="text-xs px-3 py-1 rounded border border-[#39FF14]/40 text-[#39FF14] hover:bg-[#39FF14]/10 transition-colors"
                >
                  {pecasSelecionadas.length === pecasLote.length ? 'Desmarcar Todas' : 'Selecionar Todas'}
                </button>
              </div>
              <div className="space-y-2">
                {pecasLote.map((peca) => (
                  <label
                    key={peca.id}
                    className={`flex items-center gap-3 p-3 rounded transition-colors ${
                      peca.gi_postada_em
                        ? 'bg-[#39FF14]/10 border border-[#39FF14]/40 cursor-not-allowed'
                        : 'bg-gray-900/50 hover:bg-gray-900/70 cursor-pointer'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={pecasSelecionadas.includes(peca.id)}
                      onChange={() => handleTogglePeca(peca.id)}
                      disabled={!!peca.gi_postada_em}
                      className="w-4 h-4 rounded border-[#39FF14]/40 text-[#39FF14] focus:ring-[#39FF14] focus:ring-offset-0 disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-mono text-[#39FF14] font-bold">ID #{peca.id_numerico}</span>
                        {(peca.estoque_etiquetas?.[0]?.delivery || peca.delivery) && (
                          <span className="text-xs text-gray-400">Delivery: {peca.estoque_etiquetas?.[0]?.delivery || peca.delivery}</span>
                        )}
                        <span className="text-xs text-gray-300">
                          R$ {Number(peca.valor_com_impostos).toFixed(2)}
                        </span>
                        {peca.gi_postada_em && (
                          <span className="text-[10px] px-2 py-1 rounded bg-[#39FF14]/20 text-[#39FF14] border border-[#39FF14]/30">
                            GI postada em {new Date(peca.gi_postada_em).toLocaleDateString('pt-BR', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            })} por {peca.usuario_gi_postado?.nome || 'N/A'}
                          </span>
                        )}
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
        </div>

        <div className="p-6 border-t border-[#39FF14]/20 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 rounded-lg border border-gray-600 text-gray-400 hover:text-white hover:border-gray-400 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={loading || (isLote && pecasSelecionadas.length === 0)}
            className="flex-1 px-6 py-3 rounded-lg font-bold uppercase tracking-wider transition-all disabled:opacity-50 disabled:cursor-not-allowed"
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
              <span className="flex items-center justify-center gap-2">
                <div className="w-4 h-4 border-2 border-[#39FF14] border-t-transparent rounded-full animate-spin" />
                Confirmando...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <CheckCircle className="w-4 h-4" />
                Confirmar Consumo
              </span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
