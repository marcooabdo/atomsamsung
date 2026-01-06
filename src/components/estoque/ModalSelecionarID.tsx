import { useState, useEffect } from 'react';
import { X, QrCode, Package, MapPin, Calendar, DollarSign, CheckCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface PecaEstoque {
  id: string;
  id_numerico: number;
  pn: string;
  descricao: string;
  delivery: string | null;
  localizacao: string | null;
  valor_com_impostos: number;
  data_entrada: string;
  status: string;
}

interface ModalSelecionarIDProps {
  requisicao: any;
  onConfirm: (pecaId: string) => void;
  onCancel: () => void;
  onPedirPeca: () => void;
  onRegistrarValor: () => void;
}

export function ModalSelecionarID({ requisicao, onConfirm, onCancel, onPedirPeca, onRegistrarValor }: ModalSelecionarIDProps) {
  const [pecasDisponiveis, setPecasDisponiveis] = useState<PecaEstoque[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanningQR, setScanningQR] = useState(false);
  const [qrInput, setQrInput] = useState('');
  const [selectedPeca, setSelectedPeca] = useState<PecaEstoque | null>(null);

  useEffect(() => {
    loadPecasDisponiveis();
  }, [requisicao]);

  const loadPecasDisponiveis = async () => {
    try {
      const { data, error } = await supabase
        .from('estoque_pecas')
        .select('*')
        .eq('pn', requisicao.codigo_peca)
        .eq('status', 'disponivel')
        .eq('unidade_id', requisicao.unidade_id)
        .order('data_entrada', { ascending: true });

      if (error) throw error;
      setPecasDisponiveis(data || []);
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const handleQRScan = async () => {
    if (!qrInput.trim()) {
      alert('Digite ou escaneie o ID da peça');
      return;
    }

    try {
      const { data: peca, error } = await supabase
        .from('estoque_pecas')
        .select('*')
        .eq('id_numerico', parseInt(qrInput.trim()))
        .maybeSingle();

      if (error) throw error;

      if (!peca) {
        alert('Peça não encontrada com este código!');
        return;
      }

      if (peca.status !== 'disponivel') {
        alert(`Esta peça não está disponível! Status atual: ${peca.status}`);
        return;
      }

      if (peca.pn !== requisicao.codigo_peca) {
        alert(`PN incorreto!\nEsperado: ${requisicao.codigo_peca}\nEncontrado: ${peca.pn}`);
        return;
      }

      if (peca.unidade_id !== requisicao.unidade_id) {
        alert('Esta peça pertence a outra unidade!');
        return;
      }

      // Todas validações OK, selecionar esta peça
      setSelectedPeca(peca);
      setScanningQR(false);
      setQrInput('');
    } catch (error) {
      alert('Erro ao buscar peça');
    }
  };

  const handleConfirmarSelecao = () => {
    if (selectedPeca) {
      onConfirm(selectedPeca.id);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
        <div className="premium-card p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#00D4FF] mx-auto"></div>
          <p className="text-gray-400 mt-4">Carregando peças disponíveis...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="premium-card max-w-4xl w-full max-h-[90vh] overflow-y-auto cyber-scrollbar relative z-[51]">
        <div className="sticky top-0 bg-[#0A0F1E] border-b border-[#00D4FF]/20 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-[#00D4FF] flex items-center gap-2">
              <Package className="w-6 h-6" />
              Selecionar ID para Peça
            </h2>
            <p className="text-sm text-gray-400 mt-1">{requisicao.descricao}</p>
            <p className="text-xs text-gray-500">PN: {requisicao.codigo_peca}</p>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-[#00D4FF]/10 rounded-lg transition-colors">
            <X className="w-5 h-5 text-[#00D4FF]" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Botão Ler QR Code */}
          <div className="bg-[#00D4FF]/10 border border-[#00D4FF]/30 rounded-lg p-4">
            <button
              onClick={() => setScanningQR(!scanningQR)}
              className="neon-button w-full flex items-center justify-center gap-2 text-sm py-3"
            >
              <QrCode className="w-5 h-5" />
              {scanningQR ? 'FECHAR LEITOR QR' : 'LER QR CODE DA PEÇA'}
            </button>

            {scanningQR && (
              <div className="mt-4 space-y-3">
                <input
                  type="text"
                  placeholder="Digite ou escaneie o código QR..."
                  value={qrInput}
                  onChange={(e) => setQrInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleQRScan()}
                  className="neon-input w-full"
                  autoFocus
                />
                <button
                  onClick={handleQRScan}
                  className="neon-button w-full text-sm py-2"
                  style={{
                    backgroundColor: '#39FF1420',
                    color: '#39FF14',
                    borderColor: '#39FF1460'
                  }}
                >
                  BUSCAR PEÇA
                </button>
              </div>
            )}
          </div>

          {/* Peça Selecionada (via QR ou clique) */}
          {selectedPeca && (
            <div className="bg-[#39FF14]/10 border-2 border-[#39FF14] rounded-lg p-4 animate-pulse">
              <h3 className="text-sm font-bold text-[#39FF14] mb-3 flex items-center gap-2">
                <CheckCircle className="w-4 h-4" />
                PEÇA SELECIONADA
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 text-xs">ID</p>
                  <p className="text-[#39FF14] font-bold text-lg">#{selectedPeca.id_numerico}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Delivery</p>
                  <p className="text-gray-200">{selectedPeca.delivery || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Localização</p>
                  <p className="text-gray-200">{selectedPeca.localizacao || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs">Valor</p>
                  <p className="text-[#39FF14] font-bold">R$ {Number(selectedPeca.valor_com_impostos).toFixed(2)}</p>
                </div>
              </div>
              <div className="flex gap-3 mt-4">
                <button
                  onClick={handleConfirmarSelecao}
                  className="flex-1 neon-button text-sm py-2"
                  style={{
                    backgroundColor: '#39FF1420',
                    color: '#39FF14',
                    borderColor: '#39FF1460'
                  }}
                >
                  CONFIRMAR TRANSFERÊNCIA
                </button>
                <button
                  onClick={() => setSelectedPeca(null)}
                  className="neon-button text-sm px-4 py-2"
                  style={{
                    backgroundColor: '#FF006420',
                    color: '#FF0064',
                    borderColor: '#FF006460'
                  }}
                >
                  CANCELAR
                </button>
              </div>
            </div>
          )}

          {/* Lista de IDs Disponíveis */}
          {!selectedPeca && (
            <>
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#00D4FF] uppercase">
                  IDs Disponíveis ({pecasDisponiveis.length})
                </h3>
                {pecasDisponiveis.length === 0 && (
                  <button
                    onClick={onPedirPeca}
                    className="neon-button text-xs px-4 py-2"
                    style={{
                      backgroundColor: '#FFBF0020',
                      color: '#FFBF00',
                      borderColor: '#FFBF0060'
                    }}
                  >
                    PEDIR PEÇA
                  </button>
                )}
              </div>

              {pecasDisponiveis.length === 0 ? (
                <div className="text-center py-12 premium-card">
                  <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 mb-4">Nenhum ID disponível para este PN</p>
                  <p className="text-sm text-gray-500 mb-4">
                    É necessário fazer um pedido desta peça
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {pecasDisponiveis.map((peca) => (
                    <div
                      key={peca.id}
                      className="premium-card p-4 cursor-pointer transition-all hover:border-[#00D4FF] hover:-translate-y-1"
                      onClick={() => setSelectedPeca(peca)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <p className="font-bold text-[#39FF14] text-lg mb-1">ID: #{peca.id_numerico}</p>
                          <div className="grid grid-cols-2 gap-3 text-xs text-gray-400">
                            <div className="flex items-center gap-1">
                              <Package className="w-3 h-3" />
                              Delivery: {peca.delivery || 'N/A'}
                            </div>
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3 h-3" />
                              {peca.localizacao || 'Sem localização'}
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              Entrada: {new Date(peca.data_entrada).toLocaleDateString('pt-BR')}
                            </div>
                            <div className="flex items-center gap-1">
                              <DollarSign className="w-3 h-3" />
                              <span className="text-[#39FF14] font-bold">
                                R$ {Number(peca.valor_com_impostos).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          className="neon-button text-xs px-4 py-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPeca(peca);
                          }}
                        >
                          SELECIONAR
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Seção: OU FAZER NOVO PEDIDO */}
              {pecasDisponiveis.length > 0 && (
                <div className="mt-6 pt-6 border-t border-[#FFBF00]/20">
                  <div className="text-center mb-4">
                    <p className="text-sm text-gray-400 uppercase font-bold">ou fazer novo pedido</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Mesmo com IDs disponíveis, você pode criar um novo pedido
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-3">
                    <button
                      onClick={onRegistrarValor}
                      className="neon-button text-xs px-4 py-2"
                      style={{
                        backgroundColor: '#FFBF0020',
                        color: '#FFBF00',
                        borderColor: '#FFBF0060'
                      }}
                    >
                      REGISTRAR VALOR GSPN
                    </button>
                    {requisicao.valor_peca && (
                      <button
                        onClick={onPedirPeca}
                        className="neon-button text-xs px-4 py-2"
                        style={{
                          backgroundColor: '#00D4FF20',
                          color: '#00D4FF',
                          borderColor: '#00D4FF60'
                        }}
                      >
                        CRIAR PEDIDO
                      </button>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
