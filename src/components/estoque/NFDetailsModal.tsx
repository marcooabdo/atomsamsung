import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Download, Package, Truck, FileText, ExternalLink, Printer } from 'lucide-react';
import { LabelSelector } from './LabelSelector';
import { LabelGenerator } from './LabelGenerator';

interface NFDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  nfId: string;
}

interface Peca {
  id: string;
  id_numerico: number;
  pn: string;
  descricao: string;
  valor_com_impostos: number;
  status: string;
  data_entrada: string;
}

interface NFDetails {
  id: string;
  numero_nf: string;
  chave_acesso: string | null;
  fornecedor: string;
  data_emissao: string;
  valor_total: number;
  delivery: string | null;
  pdf_url: string | null;
  processada: boolean;
  created_at: string;
}

export function NFDetailsModal({ isOpen, onClose, nfId }: NFDetailsModalProps) {
  const [nf, setNf] = useState<NFDetails | null>(null);
  const [pecas, setPecas] = useState<Peca[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const [showLabelSelector, setShowLabelSelector] = useState(false);
  const [showLabelPreview, setShowLabelPreview] = useState(false);
  const [generatedLabels, setGeneratedLabels] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && nfId) {
      loadNFDetails();
    }
  }, [isOpen, nfId]);

  const loadNFDetails = async () => {
    setLoading(true);
    try {
      const { data: nfData, error: nfError } = await supabase
        .from('estoque_nfs')
        .select('*')
        .eq('id', nfId)
        .single();

      if (nfError) throw nfError;
      setNf(nfData);

      const { data: pecasData, error: pecasError } = await supabase
        .from('estoque_pecas')
        .select('*')
        .eq('nf_id', nfId)
        .order('pn');

      if (pecasError) throw pecasError;
      setPecas(pecasData || []);
    } catch (error) {
      console.error('Erro ao carregar detalhes da NF:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (!nf?.chave_acesso) {
      alert('Chave de acesso não disponível para esta NF');
      return;
    }

    setDownloadingPDF(true);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/consultar-danfe`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ chaveAcesso: nf.chave_acesso })
        }
      );

      const data = await response.json();

      if (data.success && data.pdfUrl) {
        window.open(data.pdfUrl, '_blank');
      } else {
        alert(data.error || 'Erro ao consultar DANFE');
      }
    } catch (error) {
      console.error('Erro ao consultar DANFE:', error);
      alert('Erro ao consultar DANFE');
    } finally {
      setDownloadingPDF(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      disponivel: { label: 'Disponível', color: '#39FF14' },
      reservada: { label: 'Reservada', color: '#FFBF00' },
      vinculada_tecnico: { label: 'Com Técnico', color: '#00D4FF' },
      em_rota: { label: 'Em Rota', color: '#00D4FF' },
      em_uso: { label: 'Em Uso', color: '#FFBF00' },
      usada: { label: 'Usada', color: '#6B7280' },
      devolucao_pendente: { label: 'Devolução Pendente', color: '#FF0064' },
      devolvida_nova: { label: 'Devolvida Nova', color: '#39FF14' },
      devolvida_defeito: { label: 'Devolvida c/ Defeito', color: '#FF0064' },
      usada_upc: { label: 'Usada UPC', color: '#6B7280' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.disponivel;

    return (
      <span
        className="px-2 py-1 rounded-full text-xs font-bold uppercase tracking-wider"
        style={{
          backgroundColor: `${config.color}20`,
          color: config.color,
          border: `1px solid ${config.color}60`,
        }}
      >
        {config.label}
      </span>
    );
  };

  const pecasPorPN = pecas.reduce((acc, peca) => {
    if (!acc[peca.pn]) {
      acc[peca.pn] = {
        pn: peca.pn,
        descricao: peca.descricao,
        quantidade: 0,
        pecas: []
      };
    }
    acc[peca.pn].quantidade++;
    acc[peca.pn].pecas.push(peca);
    return acc;
  }, {} as Record<string, { pn: string; descricao: string; quantidade: number; pecas: Peca[] }>);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="premium-card w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-[#00D4FF]/20">
          <div className="flex items-center gap-3">
            <FileText className="w-6 h-6 text-[#00D4FF]" />
            <h2 className="tech-heading text-xl text-[#00D4FF]">
              DETALHES DA NF {nf?.numero_nf}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#00D4FF]/10 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-[#00D4FF]" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="futuristic-loader"></div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto cyber-scrollbar p-6 space-y-6">
              <div className="premium-card p-6 bg-[#00D4FF]/5 border-[#00D4FF]/20">
                <h3 className="text-sm font-bold text-[#00D4FF] uppercase tracking-wider mb-4">
                  Informações da Nota Fiscal
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Número NF:</span>
                    <p className="text-gray-300 font-mono font-bold">{nf?.numero_nf}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Fornecedor:</span>
                    <p className="text-gray-300">{nf?.fornecedor}</p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Data Emissão:</span>
                    <p className="text-gray-300">
                      {nf?.data_emissao ? new Date(nf.data_emissao).toLocaleDateString('pt-BR') : '-'}
                    </p>
                  </div>
                  <div>
                    <span className="text-xs text-gray-500 uppercase tracking-wider">Valor Total:</span>
                    <p className="text-[#39FF14] font-bold">
                      R$ {nf?.valor_total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </p>
                  </div>
                  {nf?.delivery && (
                    <div>
                      <span className="text-xs text-gray-500 uppercase tracking-wider">Delivery:</span>
                      <p className="text-[#00D4FF] font-bold">{nf.delivery}</p>
                    </div>
                  )}
                  {nf?.chave_acesso && (
                    <div className="col-span-2">
                      <span className="text-xs text-gray-500 uppercase tracking-wider">Chave de Acesso:</span>
                      <p className="text-gray-300 font-mono text-xs break-all">{nf.chave_acesso}</p>
                    </div>
                  )}
                </div>

                {nf?.chave_acesso && (
                  <div className="mt-4 pt-4 border-t border-[#00D4FF]/20">
                    <button
                      onClick={handleDownloadPDF}
                      disabled={downloadingPDF}
                      className="neon-button text-xs flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {downloadingPDF ? (
                        <>
                          <div className="w-4 h-4 border-2 border-[#00D4FF] border-t-transparent rounded-full animate-spin" />
                          BAIXANDO...
                        </>
                      ) : (
                        <>
                          <Download className="w-4 h-4" />
                          BAIXAR DANFE (PDF)
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => setShowLabelSelector(true)}
                      className="flex items-center gap-2 px-4 py-2 bg-[#39FF14]/10 hover:bg-[#39FF14]/20 text-[#39FF14] rounded-lg transition-colors text-xs font-medium border border-[#39FF14]/30"
                    >
                      <Printer className="w-4 h-4" />
                      GERAR ETIQUETAS
                    </button>
                  </div>
                )}
              </div>

              <div className="premium-card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Package className="w-5 h-5 text-[#00D4FF]" />
                  <h3 className="text-sm font-bold text-[#00D4FF] uppercase tracking-wider">
                    Peças da NF ({pecas.length} total)
                  </h3>
                </div>

                {Object.values(pecasPorPN).length === 0 ? (
                  <p className="text-center py-8 text-gray-500">Nenhuma peça encontrada</p>
                ) : (
                  <div className="space-y-4">
                    {Object.values(pecasPorPN).map((grupo) => (
                      <div key={grupo.pn} className="border border-gray-700 rounded-lg p-4 hover:border-[#00D4FF]/40 transition-colors">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="font-mono text-sm font-bold text-[#00D4FF] mb-1">
                              {grupo.pn}
                            </div>
                            <div className="text-sm text-gray-400 mb-2">{grupo.descricao}</div>
                            <div className="text-xs text-gray-500">
                              Quantidade: <span className="text-[#39FF14] font-bold">{grupo.quantidade}</span> unidade(s)
                            </div>
                          </div>
                        </div>

                        <div className="mt-3 pt-3 border-t border-gray-800">
                          <details className="group">
                            <summary className="text-xs text-[#00D4FF] cursor-pointer hover:text-[#00D4FF]/80 flex items-center gap-2">
                              <ExternalLink className="w-3 h-3" />
                              Ver IDs únicos e status individual
                            </summary>
                            <div className="mt-3 space-y-2 pl-5">
                              {grupo.pecas.map((peca) => (
                                <div key={peca.id} className="flex items-center justify-between text-xs">
                                  <div className="flex items-center gap-2">
                                    <span className="px-2 py-1 bg-[#39FF14]/20 text-[#39FF14] rounded font-bold text-base">
                                      ID #{peca.id_numerico || 'N/A'}
                                    </span>
                                  </div>
                                  {getStatusBadge(peca.status)}
                                </div>
                              ))}
                            </div>
                          </details>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="premium-card p-6 bg-blue-500/5 border-blue-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <Truck className="w-5 h-5 text-blue-400" />
                  <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider">
                    Informações de Entrega
                  </h3>
                </div>
                <p className="text-sm text-gray-400">
                  Entrada processada em: {nf?.created_at ? new Date(nf.created_at).toLocaleString('pt-BR') : '-'}
                </p>
                <p className="text-xs text-gray-500 mt-2">
                  Todas as peças foram registradas no estoque com IDs únicos e estão disponíveis para rastreamento individual.
                </p>
              </div>
            </div>

            <div className="border-t border-[#00D4FF]/20 p-6 bg-gradient-to-t from-black/60 to-transparent">
              <button
                onClick={onClose}
                className="neon-button w-full"
              >
                FECHAR
              </button>
            </div>
          </>
        )}
      </div>

      {/* Label Selector Modal */}
      {showLabelSelector && nf && (
        <LabelSelector
          items={Object.values(pecasPorPN).map(grupo => ({
            id: grupo[0].id,
            part_number: grupo[0].pn,
            descricao: grupo[0].descricao,
            quantidade: grupo.length,
            delivery: nf.fornecedor
          }))}
          nfId={nf.id}
          nfNumero={nf.numero_nf}
          unidadeId={pecas[0]?.id || ''}
          onGenerate={(labels) => {
            setGeneratedLabels(labels);
            setShowLabelSelector(false);
            setShowLabelPreview(true);
          }}
          onClose={() => setShowLabelSelector(false)}
        />
      )}

      {/* Label Preview/Print Modal */}
      {showLabelPreview && (
        <LabelGenerator
          labels={generatedLabels}
          onClose={() => {
            setShowLabelPreview(false);
            setGeneratedLabels([]);
          }}
        />
      )}
    </div>
  );
}
