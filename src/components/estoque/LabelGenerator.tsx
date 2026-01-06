import { useRef, useEffect } from 'react';
import { useReactToPrint } from 'react-to-print';
import JsBarcode from 'jsbarcode';
import { Printer, Download } from 'lucide-react';

interface LabelData {
  id_sequencial: string;
  codigo_barras: string;
  data_emissao: string;
  part_number: string;
  descricao?: string;
  delivery?: string;
  localizacao?: string;
}

interface LabelGeneratorProps {
  labels: LabelData[];
  onClose: () => void;
}

export function LabelGenerator({ labels, onClose }: LabelGeneratorProps) {
  const componentRef = useRef<HTMLDivElement>(null);

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    documentTitle: `Etiquetas_${new Date().toISOString().split('T')[0]}`,
  });

  useEffect(() => {
    labels.forEach((label, index) => {
      const canvas = document.getElementById(`barcode-${index}`) as HTMLCanvasElement;
      if (canvas) {
        try {
          JsBarcode(canvas, label.codigo_barras, {
            format: 'CODE128',
            width: 2,
            height: 50,
            displayValue: true,
            fontSize: 12,
            margin: 5
          });
        } catch (error) {
        }
      }
    });
  }, [labels]);

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-[#00D4FF]">
              Etiquetas de Identificação
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {labels.length} etiqueta{labels.length !== 1 ? 's' : ''} pronta{labels.length !== 1 ? 's' : ''} para impressão
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-4 py-2 bg-[#39FF14] hover:bg-[#39FF14]/80 text-black font-medium rounded-lg transition-colors"
            >
              <Printer className="w-4 h-4" />
              Imprimir
            </button>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
            >
              <span className="text-2xl text-gray-400">×</span>
            </button>
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-auto p-6 bg-gray-800">
          <div className="max-w-4xl mx-auto">
            <div className="bg-white p-8 rounded-lg">
              <div ref={componentRef} className="print-container">
                <style>
                  {`
                    @media print {
                      @page {
                        size: 5cm 5cm;
                        margin: 0;
                      }
                      body {
                        margin: 0;
                        padding: 0;
                      }
                      .print-container {
                        width: 100%;
                      }
                      .label {
                        width: 5cm;
                        height: 5cm;
                        page-break-after: always;
                        page-break-inside: avoid;
                        padding: 0.3cm;
                        box-sizing: border-box;
                      }
                      .label:last-child {
                        page-break-after: auto;
                      }
                    }

                    .label {
                      width: 5cm;
                      height: 5cm;
                      border: 1px solid #ddd;
                      padding: 0.3cm;
                      margin-bottom: 0.5cm;
                      box-sizing: border-box;
                      background: white;
                      font-family: Arial, sans-serif;
                      display: flex;
                      flex-direction: column;
                      justify-content: space-between;
                    }

                    .label-header {
                      display: flex;
                      justify-content: space-between;
                      align-items: flex-start;
                      margin-bottom: 0.2cm;
                    }

                    .label-id {
                      font-weight: bold;
                      font-size: 11pt;
                      color: #000;
                    }

                    .label-date {
                      font-size: 8pt;
                      color: #666;
                      text-align: right;
                    }

                    .label-barcode {
                      text-align: center;
                      margin: 0.2cm 0;
                    }

                    .label-info {
                      font-size: 8pt;
                      line-height: 1.3;
                    }

                    .label-field {
                      margin: 0.1cm 0;
                      word-wrap: break-word;
                    }

                    .label-field strong {
                      font-weight: bold;
                      color: #000;
                    }

                    .label-location {
                      font-size: 9pt;
                      font-weight: bold;
                      color: #000;
                      padding: 0.1cm;
                      background: #f0f0f0;
                      border-radius: 2px;
                      text-align: center;
                    }
                  `}
                </style>

                {labels.map((label, index) => (
                  <div key={index} className="label">
                    <div className="label-header">
                      <div className="label-id">{label.id_sequencial}</div>
                      <div className="label-date">
                        {new Date(label.data_emissao).toLocaleDateString('pt-BR')}
                      </div>
                    </div>

                    <div className="label-barcode">
                      <canvas id={`barcode-${index}`} />
                    </div>

                    <div className="label-info">
                      <div className="label-field">
                        <strong>PN:</strong> {label.part_number}
                      </div>

                      {label.descricao && (
                        <div className="label-field">
                          <strong>Desc:</strong> {label.descricao.substring(0, 40)}
                          {label.descricao.length > 40 ? '...' : ''}
                        </div>
                      )}

                      {label.delivery && (
                        <div className="label-field">
                          <strong>Delivery:</strong> {label.delivery}
                        </div>
                      )}
                    </div>

                    {label.localizacao ? (
                      <div className="label-location">
                        📍 {label.localizacao}
                      </div>
                    ) : (
                      <div className="label-location" style={{ background: '#fff', border: '1px dashed #ccc' }}>
                        Localização: _________
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-900">
          <div className="flex items-center justify-between text-sm text-gray-400">
            <div>
              Tamanho: 5cm × 5cm | Formato: Código de Barras CODE128
            </div>
            <div>
              Impressão em papel adesivo recomendada
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
