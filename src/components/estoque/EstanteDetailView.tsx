import { useState, useEffect } from 'react';
import { X, Package, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Peca {
  id: string;
  codigo_barras: string;
  descricao: string;
  status: string;
  numero_serie?: string | null;
}

interface Bin {
  id: string;
  estante_id: string;
  linha: string;
  coluna: number;
  codigo: string;
  ocupado: boolean;
  pecas_count: number;
  pecas?: Peca[];
}

interface Estante {
  id: string;
  nome: string;
  andares: number;
  bins_por_andar: number;
}

interface EstanteDetailViewProps {
  estante: Estante;
  onClose: () => void;
}

export function EstanteDetailView({ estante, onClose }: EstanteDetailViewProps) {
  const [bins, setBins] = useState<Bin[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBin, setSelectedBin] = useState<Bin | null>(null);
  const [loadingPecas, setLoadingPecas] = useState(false);

  useEffect(() => {
    loadBins();
  }, [estante.id]);

  const loadBins = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('estoque_bins')
        .select(`
          *,
          pecas_count:estoque_pecas(count)
        `)
        .eq('estante_id', estante.id)
        .order('linha')
        .order('coluna');

      if (error) throw error;

      const binsWithCount = (data || []).map(bin => ({
        ...bin,
        pecas_count: Array.isArray(bin.pecas_count) ? bin.pecas_count.length : 0
      }));

      setBins(binsWithCount);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleSelectBin = async (bin: Bin) => {
    if (selectedBin?.id === bin.id) {
      setSelectedBin(null);
      return;
    }

    const selected = { ...bin };
    setSelectedBin(selected);

    if (bin.pecas_count > 0) {
      setLoadingPecas(true);
      try {
        const { data, error } = await supabase
          .from('estoque_pecas')
          .select('id, codigo_barras, descricao, status, numero_serie')
          .eq('bin_id', bin.id);

        if (!error && data) {
          setSelectedBin({ ...selected, pecas: data });
        }
      } catch {
      } finally {
        setLoadingPecas(false);
      }
    }
  };

  const getLetters = () => {
    const letters: string[] = [];
    for (let i = 0; i < estante.andares; i++) {
      letters.push(String.fromCharCode(65 + i));
    }
    return letters;
  };

  const getNumbers = () => {
    return Array.from({ length: estante.bins_por_andar }, (_, i) => i + 1);
  };

  const getBinAtPosition = (linha: string, coluna: number) => {
    return bins.find(b => b.linha === linha && b.coluna === coluna);
  };

  const totalBins = bins.length;
  const ocupados = bins.filter(b => b.pecas_count > 0).length;
  const letters = getLetters();
  const numbers = getNumbers();

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-[#00D4FF]">{estante.nome}</h2>
            <p className="text-sm text-gray-400 mt-1">
              {estante.andares} linhas (A-{letters[letters.length - 1]}) × {estante.bins_por_andar} colunas — {ocupados}/{totalBins} bins ocupadas
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-6 px-6 py-3 bg-gray-800/50 border-b border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-gray-800 border border-gray-700 rounded" />
            <span className="text-sm text-gray-400">Vazio</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-[#39FF14]/20 border border-[#39FF14]/50 rounded" />
            <span className="text-sm text-gray-400">Ocupado</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-[#00D4FF]/20 border-2 border-[#00D4FF] rounded" />
            <span className="text-sm text-gray-400">Selecionado</span>
          </div>
        </div>

        {/* Grid View */}
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-gray-400">Carregando...</div>
            </div>
          ) : (
            <div className="inline-block min-w-full">
              <div className="grid gap-2" style={{ gridTemplateColumns: `40px repeat(${numbers.length}, 1fr)` }}>
                {/* Header Row */}
                <div />
                {numbers.map(num => (
                  <div key={num} className="text-center font-bold text-[#00D4FF] text-sm">
                    {num}
                  </div>
                ))}

                {/* Rows */}
                {letters.map(letter => (
                  <div key={letter} className="contents">
                    <div className="flex items-center justify-center font-bold text-[#00D4FF] text-sm">
                      {letter}
                    </div>

                    {numbers.map(num => {
                      const bin = getBinAtPosition(letter, num);
                      const isOccupied = bin ? bin.pecas_count > 0 : false;
                      const isSelected = selectedBin?.id === bin?.id;

                      return (
                        <button
                          key={`${letter}${num}`}
                          onClick={() => bin && handleSelectBin(bin)}
                          className={`
                            aspect-square rounded-lg border-2 transition-all
                            flex flex-col items-center justify-center gap-0.5
                            hover:scale-105 hover:shadow-lg
                            ${
                              isSelected
                                ? 'bg-[#00D4FF]/20 border-[#00D4FF] shadow-lg shadow-[#00D4FF]/50'
                                : isOccupied
                                ? 'bg-[#39FF14]/10 border-[#39FF14]/50 hover:border-[#39FF14]'
                                : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                            }
                          `}
                          title={bin ? `${bin.codigo} — ${bin.pecas_count} peça(s)` : 'Bin não configurada'}
                          disabled={!bin}
                        >
                          <span className={`text-xs font-mono ${
                            isSelected ? 'text-[#00D4FF]' : isOccupied ? 'text-[#39FF14]' : 'text-gray-500'
                          }`}>
                            {letter}{num}
                          </span>
                          {isOccupied && (
                            <span className={`text-[10px] font-bold ${isSelected ? 'text-[#00D4FF]' : 'text-[#39FF14]'}`}>
                              {bin!.pecas_count}
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Selected Bin Info */}
        {selectedBin && (
          <div className="border-t border-gray-700 p-4 bg-gray-800/50">
            <div className="flex items-start gap-6">
              <div className="min-w-[140px]">
                <h3 className="font-semibold text-white mb-2">
                  Posição: <span className="text-[#00D4FF]">{selectedBin.codigo}</span>
                </h3>
                <div className="space-y-1 text-sm text-gray-400">
                  <p>Linha: {selectedBin.linha}</p>
                  <p>Coluna: {selectedBin.coluna}</p>
                  <p>
                    Status:{' '}
                    <span className={selectedBin.pecas_count > 0 ? 'text-[#39FF14]' : 'text-gray-500'}>
                      {selectedBin.pecas_count > 0 ? `Ocupado (${selectedBin.pecas_count} peça${selectedBin.pecas_count > 1 ? 's' : ''})` : 'Vazio'}
                    </span>
                  </p>
                </div>
              </div>

              {selectedBin.pecas_count > 0 && (
                <div className="flex-1">
                  <h4 className="font-semibold text-[#39FF14] mb-2 flex items-center gap-2">
                    <Package className="w-4 h-4" />
                    Peças Armazenadas
                  </h4>
                  {loadingPecas ? (
                    <p className="text-sm text-gray-400">Carregando peças...</p>
                  ) : selectedBin.pecas && selectedBin.pecas.length > 0 ? (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      {selectedBin.pecas.map(peca => (
                        <div key={peca.id} className="flex items-center gap-3 text-sm bg-gray-900 rounded-lg px-3 py-1.5">
                          <span className="font-mono text-[#39FF14] text-xs">{peca.codigo_barras}</span>
                          <span className="text-gray-300 flex-1 truncate">{peca.descricao}</span>
                          {peca.numero_serie && (
                            <span className="text-gray-500 text-xs">S/N: {peca.numero_serie}</span>
                          )}
                          <span className="text-xs text-gray-500 capitalize">{peca.status?.replace(/_/g, ' ')}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-gray-400 flex items-center gap-1">
                      <AlertCircle className="w-4 h-4" />
                      Nenhuma peça encontrada nesta bin
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
