import { useRef, useState, useEffect } from 'react';
import { X, RotateCcw, Check } from 'lucide-react';

interface AssinaturaCanvasProps {
  onSave: (dataUrl: string) => void;
  onCancel: () => void;
  title: string;
}

export function AssinaturaCanvas({ onSave, onCancel, title }: AssinaturaCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isEmpty, setIsEmpty] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    ctx.scale(2, 2);

    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  const startDrawing = (e: React.TouchEvent | React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setIsEmpty(false);

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;

    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.TouchEvent | React.MouseEvent) => {
    if (!isDrawing) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const x = ('touches' in e ? e.touches[0].clientX : e.clientX) - rect.left;
    const y = ('touches' in e ? e.touches[0].clientY : e.clientY) - rect.top;

    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#1f2937';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setIsEmpty(true);
  };

  const saveSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas || isEmpty) return;

    const dataUrl = canvas.toDataURL('image/png');
    onSave(dataUrl);
  };

  return (
    <div className="fixed inset-0 bg-black/90 z-50 flex flex-col">
      <div className="p-4 bg-gray-900 border-b border-gray-800 flex items-center justify-between">
        <h3 className="text-white font-bold">{title}</h3>
        <button
          onClick={onCancel}
          className="p-2 text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="bg-gray-800 rounded-xl p-4 mb-4">
            <canvas
              ref={canvasRef}
              onTouchStart={startDrawing}
              onTouchMove={draw}
              onTouchEnd={stopDrawing}
              onMouseDown={startDrawing}
              onMouseMove={draw}
              onMouseUp={stopDrawing}
              onMouseLeave={stopDrawing}
              className="w-full h-64 bg-gray-900 rounded-lg border-2 border-dashed border-gray-700 touch-none cursor-crosshair"
            />
            <p className="text-gray-400 text-sm text-center mt-3">
              Assine no espaço acima usando o dedo ou mouse
            </p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={clearCanvas}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gray-800 border border-gray-700 text-gray-300 font-medium rounded-xl hover:bg-gray-700 transition-all"
            >
              <RotateCcw className="w-5 h-5" />
              Limpar
            </button>

            <button
              onClick={saveSignature}
              disabled={isEmpty}
              className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-green-500 to-emerald-500 text-white font-medium rounded-xl hover:from-green-600 hover:to-emerald-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Check className="w-5 h-5" />
              Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
