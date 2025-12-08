import { useState } from 'react';
import {
  GripVertical,
  MapPin,
  Clock,
  Navigation,
  RefreshCw,
  Save,
  AlertCircle,
  Trash2,
} from 'lucide-react';

interface ManualSequenceEditorProps {
  osIncluidas: any[];
  onReorder: (newOrder: any[]) => void;
  onRemoveOS: (osId: string) => void;
  onRestoreOriginal: () => void;
  isModified: boolean;
}

export default function ManualSequenceEditor({
  osIncluidas,
  onReorder,
  onRemoveOS,
  onRestoreOriginal,
  isModified,
}: ManualSequenceEditorProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (draggedIndex === null) return;
    setDragOverIndex(index);
  };

  const handleDragEnd = () => {
    if (draggedIndex === null || dragOverIndex === null) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    if (draggedIndex === dragOverIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newOrder = [...osIncluidas];
    const [draggedItem] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(dragOverIndex, 0, draggedItem);

    onReorder(newOrder);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <GripVertical className="w-6 h-6 text-cyan-400" />
          <h3 className="text-xl font-bold text-white">Editor Manual de Sequência</h3>
        </div>

        {isModified && (
          <button
            onClick={onRestoreOriginal}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 hover:bg-yellow-500/30 border border-yellow-500/30 rounded-lg text-yellow-400 transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Restaurar Original
          </button>
        )}
      </div>

      {isModified && (
        <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-400" />
            <p className="text-yellow-300 text-sm">
              Você modificou a ordem das OSs. As métricas foram recalculadas automaticamente.
            </p>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {osIncluidas.map((os, index) => {
          const isDragging = draggedIndex === index;
          const isDragOver = dragOverIndex === index;

          return (
            <div
              key={os.os_id}
              draggable
              onDragStart={(e) => handleDragStart(e, index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDragEnd={handleDragEnd}
              className={`
                bg-gray-700/50 border rounded-lg p-4 transition-all cursor-move
                ${isDragging ? 'opacity-50 scale-95' : 'opacity-100 scale-100'}
                ${isDragOver && !isDragging ? 'border-cyan-500 shadow-lg shadow-cyan-500/20' : 'border-gray-600'}
                hover:bg-gray-700/70 hover:border-gray-500
              `}
            >
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 flex-shrink-0">
                  <GripVertical className="w-5 h-5 text-gray-400 cursor-grab active:cursor-grabbing" />
                  <div className="w-10 h-10 rounded-full bg-cyan-500/20 border-2 border-cyan-500/50 flex items-center justify-center text-cyan-400 font-bold">
                    {os.ordem_visita}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-white font-bold text-lg">{os.numero_os}</span>
                    {index === 0 && (
                      <span className="px-2 py-0.5 bg-green-500/20 border border-green-500/30 rounded-full text-green-400 text-xs">
                        Primeira
                      </span>
                    )}
                    {index === osIncluidas.length - 1 && (
                      <span className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/30 rounded-full text-purple-400 text-xs">
                        Última
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-400 mb-2">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      <span className="truncate">{os.endereco || 'Endereço não informado'}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <Navigation className="w-4 h-4 text-cyan-400" />
                      <span className="text-gray-300">{os.distancia_anterior_km.toFixed(1)} km</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-purple-400" />
                      <span className="text-gray-300">{os.tempo_deslocamento_minutos} min</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-green-400" />
                      <span className="text-gray-300">{formatTime(os.horario_chegada)}</span>
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onRemoveOS(os.os_id)}
                  className="flex-shrink-0 p-2 bg-red-500/20 hover:bg-red-500/30 border border-red-500/30 rounded-lg text-red-400 transition-colors"
                  title="Remover desta rota"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {osIncluidas.length === 0 && (
        <div className="text-center py-12">
          <MapPin className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-400">Nenhuma OS na rota</p>
        </div>
      )}

      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-blue-300">
            <p className="font-bold mb-1">Como usar o editor:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-300/80">
              <li>Arraste as OSs para reordenar a sequência de visita</li>
              <li>As métricas são recalculadas automaticamente ao reordenar</li>
              <li>Use o botão de lixeira para remover uma OS da rota</li>
              <li>Clique em "Restaurar Original" para voltar à sequência otimizada</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
