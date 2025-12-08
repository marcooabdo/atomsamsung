import { useState } from 'react';
import { MapPin, CheckCircle2, Circle, X, Clock, Navigation2, GripVertical } from 'lucide-react';
import type { OS } from '../../lib/routeKanbanSync';

interface RouteControlPanelProps {
  osSequence: OS[];
  onReorder: (newSequence: OS[]) => void;
  onRemove: (osId: string) => void;
  onToggleComplete: (osId: string, completed: boolean) => void;
  onOSSelect: (os: OS) => void;
  selectedOS?: OS | null;
}

export function RouteControlPanel({
  osSequence,
  onReorder,
  onRemove,
  onToggleComplete,
  onOSSelect,
  selectedOS
}: RouteControlPanelProps) {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();

    if (draggedIndex === null) return;

    const newSequence = [...osSequence];
    const [draggedItem] = newSequence.splice(draggedIndex, 1);
    newSequence.splice(dropIndex, 0, draggedItem);

    onReorder(newSequence);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const formatTime = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const formatDistance = (meters: number): string => {
    const km = meters / 1000;
    return km >= 1 ? `${km.toFixed(1)} km` : `${meters.toFixed(0)} m`;
  };

  if (osSequence.length === 0) {
    return (
      <div className="flex items-center justify-center h-full bg-slate-50 rounded-lg border-2 border-dashed border-slate-300">
        <div className="text-center p-8">
          <MapPin className="w-12 h-12 text-slate-400 mx-auto mb-4" />
          <p className="text-slate-600 font-medium mb-2">Nenhuma OS selecionada</p>
          <p className="text-sm text-slate-500">
            Selecione rotas para começar a otimizar
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white rounded-lg shadow-sm border border-slate-200">
      <div className="p-4 border-b border-slate-200">
        <h3 className="text-lg font-semibold text-slate-900">
          Sequência de Visitas
        </h3>
        <p className="text-sm text-slate-600 mt-1">
          {osSequence.length} {osSequence.length === 1 ? 'OS' : 'OSs'} na rota
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {osSequence.map((os, index) => {
          const isSelected = selectedOS?.id === os.id;
          const isDragging = draggedIndex === index;
          const isDragOver = dragOverIndex === index;

          return (
            <div
              key={os.id}
              draggable
              onDragStart={() => handleDragStart(index)}
              onDragOver={(e) => handleDragOver(e, index)}
              onDrop={(e) => handleDrop(e, index)}
              onDragEnd={handleDragEnd}
              onClick={() => onOSSelect(os)}
              className={`
                relative p-4 rounded-lg border-2 cursor-move transition-all
                ${isSelected
                  ? 'border-blue-500 bg-blue-50 shadow-md'
                  : 'border-slate-200 bg-white hover:border-slate-300 hover:shadow'
                }
                ${isDragging ? 'opacity-50' : ''}
                ${isDragOver && !isDragging ? 'border-blue-400 border-dashed' : ''}
                ${os.concluida ? 'bg-green-50 border-green-300' : ''}
              `}
            >
              <div className="flex items-start gap-3">
                <div className="flex-shrink-0">
                  <GripVertical className="w-5 h-5 text-slate-400" />
                </div>

                <div className="flex-shrink-0">
                  <div
                    className={`
                      w-10 h-10 rounded-full flex items-center justify-center font-bold text-white
                      ${os.concluida ? 'bg-green-500' : 'bg-blue-500'}
                    `}
                  >
                    {index + 1}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-slate-900 truncate">
                        OS {os.numero_os}
                      </h4>
                      <p className="text-sm text-slate-700 truncate">
                        {os.cliente_nome}
                      </p>
                    </div>

                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleComplete(os.id, !os.concluida);
                        }}
                        className={`
                          p-1.5 rounded-lg transition-colors
                          ${os.concluida
                            ? 'text-green-600 hover:bg-green-100'
                            : 'text-slate-400 hover:bg-slate-100'
                          }
                        `}
                        title={os.concluida ? 'Marcar como pendente' : 'Marcar como concluída'}
                      >
                        {os.concluida ? (
                          <CheckCircle2 className="w-5 h-5" />
                        ) : (
                          <Circle className="w-5 h-5" />
                        )}
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemove(os.id);
                        }}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        title="Remover da rota"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm text-slate-600">
                      <MapPin className="w-4 h-4 flex-shrink-0" />
                      <span className="truncate">{os.cliente_endereco}</span>
                    </div>

                    <div className="text-xs text-slate-500">
                      {os.cliente_cidade}
                    </div>

                    {os.prioridade && (
                      <div className="inline-block mt-2 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
                        Prioridade {os.prioridade}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {os.concluida && (
                <div className="absolute top-2 right-2">
                  <div className="px-2 py-1 bg-green-600 text-white text-xs font-medium rounded-full">
                    Concluída
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="p-4 border-t border-slate-200 bg-slate-50">
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Total de OSs:</span>
            <span className="font-semibold text-slate-900">{osSequence.length}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Concluídas:</span>
            <span className="font-semibold text-green-600">
              {osSequence.filter(os => os.concluida).length}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Pendentes:</span>
            <span className="font-semibold text-blue-600">
              {osSequence.filter(os => !os.concluida).length}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
