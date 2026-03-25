import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Check, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Item {
  id: string;
  part_number: string;
  descricao?: string;
  quantidade: number;
  delivery?: string;
}

interface LabelSelectorProps {
  items: Item[];
  nfId?: string;
  nfNumero?: string;
  unidadeId: string;
  onGenerate: (labels: any[]) => void;
  onClose: () => void;
}

export function LabelSelector({ items, nfId, nfNumero, unidadeId, onGenerate, onClose }: LabelSelectorProps) {
  const [selectedItems, setSelectedItems] = useState<Record<string, boolean>>(
    items.reduce((acc, item) => ({ ...acc, [item.id]: true }), {})
  );
  const [generating, setGenerating] = useState(false);

  const toggleItem = (itemId: string) => {
    setSelectedItems(prev => ({
      ...prev,
      [itemId]: !prev[itemId]
    }));
  };

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const labelsToGenerate: any[] = [];
      let globalSeq = 1;

      for (const item of items) {
        if (!selectedItems[item.id]) continue;

        // Buscar localização da peça
        let localizacao = null;
        try {
          const { data: pecaData, error } = await supabase
            .from('estoque_pecas')
            .select('localizacao')
            .eq('id', item.id)
            .maybeSingle();

          if (!error && pecaData?.localizacao) {
            localizacao = pecaData.localizacao;
          }
        } catch (err) {
        }

        const { data: pecaIds } = await supabase
          .from('estoque_pecas')
          .select('id_unico')
          .eq('nf_id', nfId || '')
          .eq('pn', item.part_number)
          .order('created_at');

        for (let i = 0; i < item.quantidade; i++) {
          const idFromDb = pecaIds?.[i]?.id_unico;
          const idSequencial = idFromDb
            || (nfNumero
              ? `NF${nfNumero.padStart(6, '0')}-${globalSeq.toString().padStart(3, '0')}`
              : `P-${item.part_number.substring(0, 6).toUpperCase()}-${globalSeq.toString().padStart(3, '0')}`);

          // Gerar código de barras único
          let codigoBarras = '';
          try {
            const { data } = await supabase.rpc('gerar_codigo_barras');
            codigoBarras = data || '';
          } catch (err) {
          }

          // Fallback se função falhar
          if (!codigoBarras) {
            codigoBarras = (Date.now().toString() + Math.floor(Math.random() * 1000000)).padStart(12, '0').substring(0, 12);
          }

          const labelData = {
            unidade_id: unidadeId,
            nf_id: nfId || null,
            peca_id: item.id,
            codigo_barras: codigoBarras,
            id_sequencial: idSequencial,
            part_number: item.part_number,
            descricao: item.descricao,
            delivery: item.delivery,
            localizacao: localizacao,
            data_emissao: new Date().toISOString(),
            quantidade_impressoes: 0
          };

          labelsToGenerate.push(labelData);
          globalSeq++;
        }
      }

      if (labelsToGenerate.length > 0) {

        const { data, error } = await supabase
          .from('estoque_etiquetas')
          .insert(labelsToGenerate)
          .select();

        if (error) {
          alert(`Erro ao salvar etiquetas: ${error.message}`);
          throw error;
        }


        // Atualizar contador de impressões
        if (data && data.length > 0) {
          await supabase
            .from('estoque_etiquetas')
            .update({
              quantidade_impressoes: 1,
              ultima_impressao: new Date().toISOString()
            })
            .in('id', data.map((l: any) => l.id));
        }

        onGenerate(labelsToGenerate);
      } else {
        alert('Nenhuma etiqueta para gerar');
      }
    } catch (error: any) {
      alert(`Erro ao gerar etiquetas: ${error?.message || 'Erro desconhecido'}`);
    } finally {
      setGenerating(false);
    }
  };

  const selectedCount = items.filter(item => selectedItems[item.id]).length;
  const totalLabels = items
    .filter(item => selectedItems[item.id])
    .reduce((sum, item) => sum + item.quantidade, 0);

  const modalContent = (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
      <div className="premium-card w-full max-w-3xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-[#00D4FF]">
              Gerar Etiquetas de Identificação
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              Selecione os itens para gerar etiquetas
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        <div className="space-y-3 max-h-96 overflow-auto mb-6">
          {items.map((item) => (
            <div
              key={item.id}
              onClick={() => toggleItem(item.id)}
              className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                selectedItems[item.id]
                  ? 'border-[#00D4FF] bg-[#00D4FF]/10'
                  : 'border-gray-700 bg-gray-800/50 hover:border-gray-600'
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`mt-1 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                  selectedItems[item.id]
                    ? 'border-[#00D4FF] bg-[#00D4FF]'
                    : 'border-gray-600'
                }`}>
                  {selectedItems[item.id] && <Check className="w-3 h-3 text-black" />}
                </div>

                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium text-white">{item.part_number}</span>
                    <span className="px-3 py-1 bg-[#39FF14]/20 text-[#39FF14] rounded-full text-sm font-medium">
                      {item.quantidade} etiqueta{item.quantidade !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {item.descricao && (
                    <p className="text-sm text-gray-400 mb-2">{item.descricao}</p>
                  )}

                  {item.delivery && (
                    <p className="text-xs text-gray-500">
                      <strong>Delivery:</strong> {item.delivery}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg mb-6">
          <div className="text-sm text-gray-400">
            <strong className="text-white">{selectedCount}</strong> {selectedCount === 1 ? 'item selecionado' : 'itens selecionados'}
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-[#39FF14]">{totalLabels}</div>
            <div className="text-xs text-gray-400">etiquetas serão geradas</div>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleGenerate}
            disabled={generating || totalLabels === 0}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-[#39FF14] hover:bg-[#39FF14]/80 text-black font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            <Printer className="w-5 h-5" />
            {generating ? 'Gerando...' : `Gerar ${totalLabels} Etiquetas`}
          </button>
        </div>

        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/30 rounded-lg">
          <p className="text-xs text-blue-300">
            <strong>Dica:</strong> Cada unidade de peça receberá uma etiqueta única com código de barras individual para controle de estoque.
          </p>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
