import { useState, useEffect } from 'react';
import { X, Package, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Bin {
  id: string;
  estante_id: string;
  linha: string;
  coluna: number;
  codigo: string;
  ocupado: boolean;
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

  useEffect(() => {
    loadBins();
  }, [estante.id]);

  const loadBins = async () => {
    try {
      const { data, error } = await supabase
        .from('estoque_bins')
        .select('*')
        .eq('estante_id', estante.id)
        .order('linha')
        .order('coluna');

      if (error) throw error;
      setBins(data || []);
    } catch (error) {
      console.error('Erro ao carregar bins:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLetters = () => {
    const letters: string[] = [];
    for (let i = 0; i < estante.andares; i++) {
      letters.push(String.fromCharCode(65 + i)); // A, B, C, D...
    }
    return letters;
  };

  const getNumbers = () => {
    return Array.from({ length: estante.bins_por_andar }, (_, i) => i + 1);
  };

  const getBinAtPosition = (linha: string, coluna: number) => {
    return bins.find(b => b.linha === linha && b.coluna === coluna);
  };

  const getBinOccupancy = (bin: Bin) => {
    // TODO: Implementar verificação real de ocupação
    return Math.random() > 0.7; // Simulação temporária
  };

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
              {estante.andares} linhas (A-{letters[letters.length - 1]}) × {estante.bins_por_andar} colunas (1-{estante.bins_por_andar})
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
            <div className="w-4 h-4 bg-gray-700 border border-gray-600 rounded" />
            <span className="text-sm text-gray-400">Vazio</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-[#39FF14]/20 border border-[#39FF14] rounded" />
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
                {/* Header Row - Column Numbers */}
                <div /> {/* Empty corner */}
                {numbers.map(num => (
                  <div key={num} className="text-center font-bold text-[#00D4FF] text-sm">
                    {num}
                  </div>
                ))}

                {/* Rows with Letter Labels */}
                {letters.map(letter => (
                  <>
                    {/* Row Label - Letter */}
                    <div key={`label-${letter}`} className="flex items-center justify-center font-bold text-[#00D4FF] text-sm">
                      {letter}
                    </div>

                    {/* Bins in this row */}
                    {numbers.map(num => {
                      const bin = getBinAtPosition(letter, num);
                      const isOccupied = bin ? getBinOccupancy(bin) : false;
                      const isSelected = selectedBin?.id === bin?.id;

                      return (
                        <button
                          key={`${letter}${num}`}
                          onClick={() => bin && setSelectedBin(isSelected ? null : bin)}
                          className={`
                            aspect-square rounded-lg border-2 transition-all
                            flex flex-col items-center justify-center
                            hover:scale-105 hover:shadow-lg
                            ${
                              isSelected
                                ? 'bg-[#00D4FF]/20 border-[#00D4FF] shadow-lg shadow-[#00D4FF]/50'
                                : isOccupied
                                ? 'bg-[#39FF14]/10 border-[#39FF14]/50 hover:border-[#39FF14]'
                                : 'bg-gray-800 border-gray-700 hover:border-gray-600'
                            }
                          `}
                          title={bin?.codigo}
                        >
                          <span className={`text-xs font-mono ${
                            isSelected ? 'text-[#00D4FF]' : isOccupied ? 'text-[#39FF14]' : 'text-gray-500'
                          }`}>
                            {letter}{num}
                          </span>
                          {isOccupied && (
                            <Package className="w-3 h-3 mt-1 text-[#39FF14]" />
                          )}
                        </button>
                      );
                    })}
                  </>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Selected Bin Info */}
        {selectedBin && (
          <div className="border-t border-gray-700 p-4 bg-gray-800/50">
            <div className="flex items-start gap-4">
              <div className="flex-1">
                <h3 className="font-semibold text-white mb-2">
                  Posição: {selectedBin.codigo}
                </h3>
                <div className="space-y-1 text-sm text-gray-400">
                  <p>Linha: {selectedBin.linha}</p>
                  <p>Coluna: {selectedBin.coluna}</p>
                  <p>Status: {getBinOccupancy(selectedBin) ? '🟢 Ocupado' : '⚪ Vazio'}</p>
                </div>
              </div>
              {getBinOccupancy(selectedBin) && (
                <div className="flex-1">
                  <h4 className="font-semibold text-[#39FF14] mb-2">Peças Armazenadas</h4>
                  <p className="text-sm text-gray-400">
                    [Lista de peças será implementada]
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
