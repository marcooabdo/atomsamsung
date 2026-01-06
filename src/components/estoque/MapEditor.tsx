import { useState, useRef } from 'react';
import { RotateCw, ZoomIn, ZoomOut, Grid3x3, Trash2, Edit2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Estante {
  id: string;
  sala_id: string;
  nome: string;
  andares: number;
  bins_por_andar: number;
  posicao_x: number;
  posicao_y: number;
  largura: number;
  altura: number;
  rotacao: number;
  cor?: string;
}

interface Sala {
  id: string;
  nome: string;
  cor: string;
  unidade_id: string;
}

interface MapEditorProps {
  sala: Sala;
  estantes: Estante[];
  onEstanteClick: (estante: Estante) => void;
  onRefresh: () => void;
}

export function MapEditor({ sala, estantes, onEstanteClick, onRefresh }: MapEditorProps) {
  const [selectedEstante, setSelectedEstante] = useState<Estante | null>(null);
  const [zoom, setZoom] = useState(1);
  const [showGrid, setShowGrid] = useState(true);
  const [saving, setSaving] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);

  const handleEstanteSelect = (estante: Estante) => {
    setSelectedEstante(estante);
  };

  const updateEstanteProperty = (property: keyof Estante, value: any) => {
    if (!selectedEstante) return;
    setSelectedEstante({
      ...selectedEstante,
      [property]: value
    });
  };

  const saveEstanteChanges = async () => {
    if (!selectedEstante) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('estoque_estantes')
        .update({
          posicao_x: selectedEstante.posicao_x,
          posicao_y: selectedEstante.posicao_y,
          largura: selectedEstante.largura,
          altura: selectedEstante.altura,
          rotacao: selectedEstante.rotacao,
          cor: selectedEstante.cor
        })
        .eq('id', selectedEstante.id);

      if (error) throw error;

      await onRefresh();
      alert('✅ Alterações salvas com sucesso!');
    } catch (error) {
      alert('❌ Erro ao salvar alterações');
    } finally {
      setSaving(false);
    }
  };

  const rotateEstante = () => {
    if (!selectedEstante) return;
    const newRotacao = (selectedEstante.rotacao + 90) % 360;
    updateEstanteProperty('rotacao', newRotacao);
  };

  const deleteEstante = async () => {
    if (!selectedEstante) return;
    if (!confirm(`Deletar estante ${selectedEstante.nome}? Todas as bins e peças serão removidas.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from('estoque_estantes')
        .delete()
        .eq('id', selectedEstante.id);

      if (error) throw error;

      setSelectedEstante(null);
      await onRefresh();
      alert('✅ Estante deletada com sucesso!');
    } catch (error) {
      alert('❌ Erro ao deletar estante');
    }
  };

  const getCurrentEstante = (id: string): Estante => {
    if (selectedEstante && selectedEstante.id === id) {
      return selectedEstante;
    }
    return estantes.find(e => e.id === id) || estantes[0];
  };

  return (
    <div className="grid grid-cols-3 gap-6">
      <div className="col-span-2 space-y-4">
        <div className="premium-card p-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowGrid(!showGrid)}
              className={`p-2 rounded-lg transition-colors ${
                showGrid ? 'bg-[#00D4FF]/20 text-[#00D4FF]' : 'bg-gray-700 text-gray-400'
              }`}
              title="Mostrar/Ocultar Grade"
            >
              <Grid3x3 className="w-4 h-4" />
            </button>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setZoom(Math.max(0.5, zoom - 0.1))}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                <ZoomOut className="w-4 h-4 text-gray-300" />
              </button>
              <span className="text-sm text-gray-400 w-12 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom(Math.min(2, zoom + 0.1))}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
              >
                <ZoomIn className="w-4 h-4 text-gray-300" />
              </button>
            </div>
          </div>

          <div className="text-sm text-gray-400">
            Clique na estante para editar
          </div>
        </div>

        <div
          ref={mapRef}
          className="premium-card relative overflow-hidden"
          style={{
            height: '600px',
            backgroundColor: '#1a1a1a',
            backgroundImage: showGrid
              ? 'linear-gradient(#2a2a2a 1px, transparent 1px), linear-gradient(90deg, #2a2a2a 1px, transparent 1px)'
              : 'none',
            backgroundSize: showGrid ? `${20 * zoom}px ${20 * zoom}px` : 'auto'
          }}
        >
          <div
            style={{
              transform: `scale(${zoom})`,
              transformOrigin: 'top left',
              width: '100%',
              height: '100%'
            }}
          >
            {estantes.map((estante) => {
              const currentEstante = getCurrentEstante(estante.id);
              return (
                <div
                  key={estante.id}
                  className={`absolute cursor-pointer transition-all ${
                    selectedEstante?.id === estante.id
                      ? 'ring-2 ring-[#00D4FF] shadow-lg shadow-[#00D4FF]/50 z-10'
                      : 'hover:ring-2 hover:ring-[#00D4FF]/50'
                  }`}
                  style={{
                    left: `${currentEstante.posicao_x}px`,
                    top: `${currentEstante.posicao_y}px`,
                    width: `${currentEstante.largura}px`,
                    height: `${currentEstante.altura}px`,
                    backgroundColor: currentEstante.cor || '#39FF14',
                    borderRadius: '8px',
                    transform: `rotate(${currentEstante.rotacao}deg)`,
                    userSelect: 'none'
                  }}
                  onClick={() => handleEstanteSelect(estante)}
                >
                  <div className="absolute inset-0 p-3 flex flex-col items-center justify-center text-center pointer-events-none">
                    <div className="font-bold text-white text-sm mb-1">
                      {currentEstante.nome}
                    </div>
                    <div className="text-xs text-white/70">
                      {currentEstante.andares}×{currentEstante.bins_por_andar}
                    </div>
                  </div>
                </div>
              );
            })}

            {estantes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-gray-500">
                  <Grid3x3 className="w-16 h-16 mx-auto mb-4 opacity-30" />
                  <p>Nenhuma estante no mapa</p>
                  <p className="text-sm mt-2">Crie estantes no modo de configuração</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="col-span-1">
        {selectedEstante ? (
          <div className="premium-card p-4 space-y-4 sticky top-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-700">
              <h3 className="text-lg font-bold text-[#00D4FF]">Propriedades</h3>
              <button
                onClick={() => setSelectedEstante(null)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-gray-400 mb-2">Nome</label>
                <p className="text-white font-medium">{selectedEstante.nome}</p>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Cor</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={selectedEstante.cor || '#39FF14'}
                    onChange={(e) => updateEstanteProperty('cor', e.target.value)}
                    className="w-10 h-10 rounded border border-gray-700 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={selectedEstante.cor || '#39FF14'}
                    onChange={(e) => updateEstanteProperty('cor', e.target.value)}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Posição X</label>
                  <input
                    type="number"
                    value={selectedEstante.posicao_x}
                    onChange={(e) => updateEstanteProperty('posicao_x', parseInt(e.target.value) || 0)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Posição Y</label>
                  <input
                    type="number"
                    value={selectedEstante.posicao_y}
                    onChange={(e) => updateEstanteProperty('posicao_y', parseInt(e.target.value) || 0)}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Largura</label>
                  <input
                    type="number"
                    value={selectedEstante.largura}
                    onChange={(e) => updateEstanteProperty('largura', Math.max(80, parseInt(e.target.value) || 80))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-400 mb-2">Altura</label>
                  <input
                    type="number"
                    value={selectedEstante.altura}
                    onChange={(e) => updateEstanteProperty('altura', Math.max(80, parseInt(e.target.value) || 80))}
                    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-400 mb-2">Rotação</label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={selectedEstante.rotacao}
                    onChange={(e) => updateEstanteProperty('rotacao', parseInt(e.target.value) || 0)}
                    className="flex-1 bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white"
                  />
                  <button
                    onClick={rotateEstante}
                    className="p-2 bg-[#00D4FF]/10 hover:bg-[#00D4FF]/20 rounded transition-colors"
                    title="Rotacionar 90°"
                  >
                    <RotateCw className="w-5 h-5 text-[#00D4FF]" />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">0° = horizontal, 90° = vertical</p>
              </div>

              <div className="pt-4 space-y-2 border-t border-gray-700">
                <button
                  onClick={saveEstanteChanges}
                  disabled={saving}
                  className="w-full px-4 py-2 bg-[#39FF14] hover:bg-[#39FF14]/80 text-black font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {saving ? 'Salvando...' : 'Salvar Alterações'}
                </button>

                <button
                  onClick={() => onEstanteClick(selectedEstante)}
                  className="w-full px-4 py-2 bg-[#00D4FF]/10 hover:bg-[#00D4FF]/20 text-[#00D4FF] rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Edit2 className="w-4 h-4" />
                  Ver Grade de Bins
                </button>

                <button
                  onClick={deleteEstante}
                  className="w-full px-4 py-2 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded-lg transition-colors flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  Deletar Estante
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="premium-card p-8 text-center">
            <Grid3x3 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 mb-2">Nenhuma estante selecionada</p>
            <p className="text-sm text-gray-500">
              Clique em uma estante no mapa para editar suas propriedades
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
