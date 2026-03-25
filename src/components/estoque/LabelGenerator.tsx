import { useRef, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useReactToPrint } from 'react-to-print';
import JsBarcode from 'jsbarcode';
import { Printer, X, CreditCard as Edit3, ExternalLink } from 'lucide-react';

interface LabelData {
  id_sequencial: string;
  codigo_barras: string;
  data_emissao: string;
  nf_data_emissao?: string;
  part_number: string;
  descricao?: string;
  delivery?: string;
  localizacao?: string;
  nf_numero?: string;
  tecnico_nome?: string;
  os_numero?: string;
  os_samsung?: string;
}

interface LabelGeneratorProps {
  labels: LabelData[];
  onClose: () => void;
}

export function LabelGenerator({ labels, onClose }: LabelGeneratorProps) {
  const componentRef = useRef<HTMLDivElement>(null);
  const [showOptions, setShowOptions] = useState(true);

  const handlePrint = useReactToPrint({
    content: () => componentRef.current,
    documentTitle: `Etiquetas_${new Date().toISOString().split('T')[0]}`,
  });

  useEffect(() => {
    if (!showOptions) {
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
    }
  }, [labels, showOptions]);

  const openEditor = () => {
    const dados = labels.map(l => ({
      id_sequencial: l.id_sequencial,
      codigo_barras: l.codigo_barras,
      data_emissao: l.data_emissao,
      part_number: l.part_number,
      descricao: l.descricao,
      delivery: l.delivery,
      localizacao: l.localizacao,
      nf_numero: l.nf_numero,
      tecnico_nome: l.tecnico_nome,
      os_numero: l.os_numero,
      os_samsung: l.os_samsung
    }));
    const params = encodeURIComponent(JSON.stringify(dados));
    window.open(`/etiqueta-editor?dados=${params}`, '_blank');
    onClose();
  };

  if (showOptions) {
    return createPortal(
      <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
        <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-md p-6">
          <div className="text-center mb-6">
            <h2 className="text-xl font-bold text-[#00D4FF]">Gerar Etiquetas</h2>
            <p className="text-sm text-gray-400 mt-1">
              {labels.length} etiqueta{labels.length !== 1 ? 's' : ''} selecionada{labels.length !== 1 ? 's' : ''}
            </p>
          </div>

          <div className="space-y-3">
            <button
              onClick={openEditor}
              className="w-full flex items-center gap-3 p-4 rounded-lg bg-cyan-500/20 border border-cyan-500/30 hover:bg-cyan-500/30 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-cyan-500/30 flex items-center justify-center">
                <Edit3 className="w-5 h-5 text-cyan-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white">Editor de Etiquetas</p>
                <p className="text-xs text-gray-400">Personalize layout, adicione campos e salve templates</p>
              </div>
              <ExternalLink className="w-4 h-4 text-gray-400" />
            </button>

            <button
              onClick={() => setShowOptions(false)}
              className="w-full flex items-center gap-3 p-4 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors text-left"
            >
              <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center">
                <Printer className="w-5 h-5 text-gray-400" />
              </div>
              <div className="flex-1">
                <p className="font-medium text-white">Impressao Rapida</p>
                <p className="text-xs text-gray-400">Use o formato padrao 5x5cm</p>
              </div>
            </button>
          </div>

          <button
            onClick={onClose}
            className="w-full mt-4 px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            Cancelar
          </button>
        </div>
      </div>,
      document.body
    );
  }

  const modalContent = (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
      <div className="bg-gray-900 rounded-xl border border-gray-700 w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div>
            <h2 className="text-2xl font-bold text-[#00D4FF]">
              Etiquetas de Identificacao
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              {labels.length} etiqueta{labels.length !== 1 ? 's' : ''} pronta{labels.length !== 1 ? 's' : ''} para impressao
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={openEditor}
              className="flex items-center gap-2 px-4 py-2 bg-cyan-500/20 text-cyan-400 rounded-lg hover:bg-cyan-500/30 transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              Abrir Editor
            </button>
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
              <X className="w-6 h-6 text-gray-400" />
            </button>
          </div>
        </div>

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
                        {label.localizacao}
                      </div>
                    ) : (
                      <div className="label-location" style={{ background: '#fff', border: '1px dashed #ccc' }}>
                        Localizacao: _________
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-700 bg-gray-900">
          <div className="flex items-center justify-between text-sm text-gray-400">
            <div>
              Tamanho: 5cm x 5cm | Formato: Codigo de Barras CODE128
            </div>
            <div>
              Impressao em papel adesivo recomendada
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
