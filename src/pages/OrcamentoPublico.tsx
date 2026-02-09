import { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { CheckCircle, XCircle, MessageCircle, Loader2, Phone, MapPin, Package, Wrench, AlertCircle, Camera } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface OrcamentoData {
  link: {
    id: string;
    status: 'pendente' | 'aprovado' | 'rejeitado' | 'negociando';
    data_resposta: string | null;
  };
  os: {
    numero_os_interna: string;
    cliente_nome: string;
    cliente_telefone: string;
    aparelho_marca: string;
    aparelho_modelo: string;
    defeito_relatado: string;
    diagnostico_tecnico: string;
    data_abertura: string;
    unidade: {
      nome: string;
      telefone: string;
      endereco: string;
      cidade: string;
      uf: string;
    };
    cotacao: {
      id: string;
      valor_pecas: number;
      valor_servicos: number;
      desconto_tipo: 'percentual' | 'valor' | null;
      desconto_valor: number;
      valor_liquido: number;
      cotacoes_pecas: Array<{
        id: string;
        codigo: string;
        descricao: string;
        quantidade: number;
        valor_final_unitario: number;
        valor_total: number;
      }>;
      cotacoes_servicos: Array<{
        id: string;
        nome: string;
        descricao: string;
        valor: number;
        quantidade: number;
        valor_total: number;
      }>;
    } | null;
  };
}

export function OrcamentoPublico() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OrcamentoData | null>(null);
  const [error, setError] = useState('');
  const [responding, setResponding] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'aprovado' | 'rejeitado' | 'negociando' | null>(null);
  const [mensagem, setMensagem] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [selfieCapturada, setSelfieCapturada] = useState<string | null>(null);
  const [capturandoLocalizacao, setCapturandoLocalizacao] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Token inválido');
      setLoading(false);
      return;
    }
    loadOrcamento();
  }, [token]);

  const loadOrcamento = async () => {
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-orcamento-publico?token=${token}`;
      const response = await fetch(apiUrl, {
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao carregar orçamento');
      }

      const result = await response.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const iniciarCapturaLocalizacaoESelfie = async () => {
    if (!selectedAction) return;

    if ((selectedAction === 'rejeitado' || selectedAction === 'negociando') && !mensagem.trim()) {
      alert('Por favor, escreva uma mensagem explicando o motivo.');
      return;
    }

    setCapturandoLocalizacao(true);
    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });

      setCapturandoLocalizacao(false);
      abrirCamera();
    } catch (err: any) {
      setCapturandoLocalizacao(false);
      if (confirm('Não foi possível obter sua localização. Deseja continuar mesmo assim?')) {
        abrirCamera();
      }
    }
  };

  const abrirCamera = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 1280, height: 720 },
        audio: false
      });

      setStream(mediaStream);
      setShowCamera(true);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        videoRef.current.play();
      }
    } catch (err: any) {
      alert('Não foi possível acessar a câmera. Por favor, permita o acesso à câmera.');
    }
  };

  const tirarSelfie = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      const context = canvas.getContext('2d');
      if (context) {
        context.drawImage(video, 0, 0, canvas.width, canvas.height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        setSelfieCapturada(dataUrl);

        if (stream) {
          stream.getTracks().forEach(track => track.stop());
          setStream(null);
        }
      }
    }
  };

  const refazerSelfie = () => {
    setSelfieCapturada(null);
    abrirCamera();
  };

  const handleRespond = async () => {
    if (!selectedAction) return;

    setResponding(true);
    try {
      let latitude: number | null = null;
      let longitude: number | null = null;
      let enderecoCompleto: string | null = null;

      try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject);
        });
        latitude = position.coords.latitude;
        longitude = position.coords.longitude;

        const geoResponse = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
        );
        const geoData = await geoResponse.json();
        enderecoCompleto = geoData.display_name || null;
      } catch (err) {
        console.error('Erro ao obter localização:', err);
      }

      let selfieUrl: string | null = null;

      if (selfieCapturada && token && data) {
        try {
          const base64Data = selfieCapturada.split(',')[1];
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'image/jpeg' });

          const fileName = `${data.os.numero_os_interna}/selfie-aprovacao-${Date.now()}.jpg`;

          const { error: uploadError } = await supabase.storage
            .from('os-anexos')
            .upload(fileName, blob, { upsert: true });

          if (uploadError) throw uploadError;

          const { data: { publicUrl } } = supabase.storage
            .from('os-anexos')
            .getPublicUrl(fileName);

          selfieUrl = publicUrl;
        } catch (err) {
          console.error('Erro ao fazer upload da selfie:', err);
        }
      }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-orcamento-publico?token=${token}&action=respond`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: selectedAction,
          mensagem: mensagem.trim() || null,
          latitude,
          longitude,
          endereco_completo: enderecoCompleto,
          selfie_url: selfieUrl,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao enviar resposta');
      }

      setShowSuccess(true);
      setShowCamera(false);
      await loadOrcamento();
    } catch (err: any) {
      alert(`Erro: ${err.message}`);
    } finally {
      setResponding(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
          <p className="text-gray-300">Carregando orçamento...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 border border-red-500/30 rounded-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Link Inválido</h1>
          <p className="text-gray-400">{error || 'O link de orçamento não foi encontrado ou expirou.'}</p>
        </div>
      </div>
    );
  }

  const { link, os } = data;
  const jaRespondido = link.status !== 'pendente';

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center p-4">
        <div className="bg-gray-800 border border-green-500/30 rounded-xl p-8 max-w-md w-full text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Resposta Enviada!</h1>
          <p className="text-gray-400 mb-6">
            {selectedAction === 'aprovado' && 'Obrigado por aprovar o orçamento! Em breve entraremos em contato.'}
            {selectedAction === 'rejeitado' && 'Recebemos sua rejeição. Entraremos em contato para entender melhor.'}
            {selectedAction === 'negociando' && 'Recebemos sua mensagem. Vamos analisar e retornar em breve.'}
          </p>
          <p className="text-sm text-gray-500">Você pode fechar esta página.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        <div className="bg-gray-800 border border-blue-500/30 rounded-xl overflow-hidden shadow-2xl">
          <div className="bg-gradient-to-r from-blue-600 to-cyan-600 p-6">
            <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">Orçamento de Reparo</h1>
            <p className="text-blue-100">OS #{os.numero_os_interna}</p>
          </div>

          <div className="p-6 space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase mb-2">Cliente</h3>
                  <p className="text-lg text-white font-semibold">{os.cliente_nome}</p>
                  <p className="text-sm text-gray-400 flex items-center gap-2 mt-1">
                    <Phone className="w-4 h-4" />
                    {os.cliente_telefone}
                  </p>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase mb-2">Equipamento</h3>
                  <p className="text-lg text-white">{os.aparelho_marca} {os.aparelho_modelo}</p>
                </div>

                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase mb-2">Defeito Relatado</h3>
                  <p className="text-sm text-gray-300">{os.defeito_relatado}</p>
                </div>

                {os.diagnostico_tecnico && (
                  <div>
                    <h3 className="text-sm font-bold text-gray-400 uppercase mb-2">Diagnóstico Técnico</h3>
                    <p className="text-sm text-gray-300">{os.diagnostico_tecnico}</p>
                  </div>
                )}
              </div>

              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-bold text-gray-400 uppercase mb-2">Unidade</h3>
                  <p className="text-lg text-white font-semibold">{os.unidade.nome}</p>
                  <p className="text-sm text-gray-400 flex items-center gap-2 mt-1">
                    <Phone className="w-4 h-4" />
                    {os.unidade.telefone}
                  </p>
                  <p className="text-sm text-gray-400 flex items-start gap-2 mt-1">
                    <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{os.unidade.endereco}, {os.unidade.cidade} - {os.unidade.uf}</span>
                  </p>
                </div>
              </div>
            </div>

            {os.cotacao && (
              <div className="border-t border-gray-700 pt-6">
                <h3 className="text-xl font-bold text-white mb-4">Detalhes do Orçamento</h3>

                {os.cotacao.cotacoes_pecas && os.cotacao.cotacoes_pecas.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                      <Package className="w-4 h-4" />
                      Peças
                    </h4>
                    <div className="space-y-2">
                      {os.cotacao.cotacoes_pecas.map((peca) => (
                        <div key={peca.id} className="bg-gray-900/50 rounded-lg p-3 flex justify-between items-center">
                          <div className="flex-1">
                            <p className="text-white font-medium">{peca.descricao}</p>
                            <p className="text-xs text-gray-500">Código: {peca.codigo} | Qtd: {peca.quantidade}</p>
                          </div>
                          <p className="text-cyan-400 font-bold">R$ {peca.valor_total.toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {os.cotacao.cotacoes_servicos && os.cotacao.cotacoes_servicos.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-bold text-gray-400 uppercase mb-3 flex items-center gap-2">
                      <Wrench className="w-4 h-4" />
                      Serviços
                    </h4>
                    <div className="space-y-2">
                      {os.cotacao.cotacoes_servicos.map((servico) => (
                        <div key={servico.id} className="bg-gray-900/50 rounded-lg p-3 flex justify-between items-center">
                          <div className="flex-1">
                            <p className="text-white font-medium">{servico.nome}</p>
                            {servico.descricao && (
                              <p className="text-xs text-gray-500">{servico.descricao}</p>
                            )}
                          </div>
                          <p className="text-cyan-400 font-bold">R$ {servico.valor_total.toFixed(2)}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-gradient-to-r from-blue-900/50 to-cyan-900/50 rounded-lg p-4 border border-blue-500/30">
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Peças:</span>
                      <span className="text-white">R$ {os.cotacao.valor_pecas.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-400">Serviços:</span>
                      <span className="text-white">R$ {os.cotacao.valor_servicos.toFixed(2)}</span>
                    </div>
                    {os.cotacao.desconto_valor > 0 && (
                      <div className="flex justify-between text-sm text-green-400">
                        <span>Desconto:</span>
                        <span>- R$ {os.cotacao.desconto_valor.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="border-t border-blue-500/30 pt-2 mt-2 flex justify-between">
                      <span className="text-lg font-bold text-white">TOTAL:</span>
                      <span className="text-2xl font-bold text-cyan-400">
                        R$ {os.cotacao.valor_liquido.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {jaRespondido ? (
              <div className="border-t border-gray-700 pt-6">
                <div className={`p-4 rounded-lg border ${
                  link.status === 'aprovado' ? 'bg-green-500/10 border-green-500/30' :
                  link.status === 'rejeitado' ? 'bg-red-500/10 border-red-500/30' :
                  'bg-yellow-500/10 border-yellow-500/30'
                }`}>
                  <div className="flex items-center gap-3">
                    {link.status === 'aprovado' && <CheckCircle className="w-6 h-6 text-green-500" />}
                    {link.status === 'rejeitado' && <XCircle className="w-6 h-6 text-red-500" />}
                    {link.status === 'negociando' && <MessageCircle className="w-6 h-6 text-yellow-500" />}
                    <div>
                      <p className={`font-bold ${
                        link.status === 'aprovado' ? 'text-green-400' :
                        link.status === 'rejeitado' ? 'text-red-400' :
                        'text-yellow-400'
                      }`}>
                        {link.status === 'aprovado' && 'Orçamento Aprovado'}
                        {link.status === 'rejeitado' && 'Orçamento Rejeitado'}
                        {link.status === 'negociando' && 'Em Negociação'}
                      </p>
                      <p className="text-sm text-gray-400">
                        Respondido em {new Date(link.data_resposta!).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-t border-gray-700 pt-6">
                <h3 className="text-lg font-bold text-white mb-4">O que você decide?</h3>

                <div className="grid md:grid-cols-3 gap-3 mb-4">
                  <button
                    onClick={() => {
                      setSelectedAction('aprovado');
                      setMensagem('');
                    }}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedAction === 'aprovado'
                        ? 'border-green-500 bg-green-500/20'
                        : 'border-gray-700 hover:border-green-500/50'
                    }`}
                  >
                    <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                    <p className="text-white font-bold">Aprovar</p>
                  </button>

                  <button
                    onClick={() => setSelectedAction('negociando')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedAction === 'negociando'
                        ? 'border-yellow-500 bg-yellow-500/20'
                        : 'border-gray-700 hover:border-yellow-500/50'
                    }`}
                  >
                    <MessageCircle className="w-8 h-8 text-yellow-500 mx-auto mb-2" />
                    <p className="text-white font-bold">Negociar</p>
                  </button>

                  <button
                    onClick={() => setSelectedAction('rejeitado')}
                    className={`p-4 rounded-lg border-2 transition-all ${
                      selectedAction === 'rejeitado'
                        ? 'border-red-500 bg-red-500/20'
                        : 'border-gray-700 hover:border-red-500/50'
                    }`}
                  >
                    <XCircle className="w-8 h-8 text-red-500 mx-auto mb-2" />
                    <p className="text-white font-bold">Rejeitar</p>
                  </button>
                </div>

                {selectedAction && selectedAction !== 'aprovado' && (
                  <div className="mb-4">
                    <label className="block text-sm font-bold text-gray-400 uppercase mb-2">
                      {selectedAction === 'negociando' ? 'Sua proposta ou dúvida:' : 'Motivo da rejeição:'}
                    </label>
                    <textarea
                      value={mensagem}
                      onChange={(e) => setMensagem(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-900 border border-gray-700 rounded-lg text-white focus:outline-none focus:border-blue-500"
                      rows={4}
                      placeholder={selectedAction === 'negociando' ? 'Ex: Gostaria de negociar o valor das peças...' : 'Por favor, explique o motivo...'}
                    />
                  </div>
                )}

                {selectedAction && (
                  <button
                    onClick={iniciarCapturaLocalizacaoESelfie}
                    disabled={responding || capturandoLocalizacao}
                    className="w-full py-4 rounded-lg font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {capturandoLocalizacao ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Capturando localização...
                      </>
                    ) : responding ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      'Confirmar Resposta'
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {showCamera && !selfieCapturada && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full">
            <div className="bg-gray-800 rounded-xl overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-blue-600 to-cyan-600">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <Camera className="w-6 h-6" />
                  Tire uma Selfie
                </h3>
                <p className="text-sm text-blue-100 mt-1">
                  Para confirmar sua identidade, precisamos de uma foto sua
                </p>
              </div>

              <div className="p-6">
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-4">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform scale-x-[-1]"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      if (stream) {
                        stream.getTracks().forEach(track => track.stop());
                        setStream(null);
                      }
                      setShowCamera(false);
                    }}
                    className="flex-1 py-3 rounded-lg font-bold text-white bg-gray-700 hover:bg-gray-600 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={tirarSelfie}
                    className="flex-1 py-3 rounded-lg font-bold text-white bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 transition-all flex items-center justify-center gap-2"
                  >
                    <Camera className="w-5 h-5" />
                    Tirar Foto
                  </button>
                </div>
              </div>
            </div>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {selfieCapturada && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
          <div className="max-w-2xl w-full">
            <div className="bg-gray-800 rounded-xl overflow-hidden">
              <div className="p-4 bg-gradient-to-r from-green-600 to-emerald-600">
                <h3 className="text-xl font-bold text-white flex items-center gap-2">
                  <CheckCircle className="w-6 h-6" />
                  Foto Capturada!
                </h3>
                <p className="text-sm text-green-100 mt-1">
                  Revise sua foto antes de enviar
                </p>
              </div>

              <div className="p-6">
                <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-4">
                  <img
                    src={selfieCapturada}
                    alt="Selfie"
                    className="w-full h-full object-cover"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={refazerSelfie}
                    className="flex-1 py-3 rounded-lg font-bold text-white bg-gray-700 hover:bg-gray-600 transition-all"
                  >
                    Tirar Outra
                  </button>
                  <button
                    onClick={handleRespond}
                    disabled={responding}
                    className="flex-1 py-3 rounded-lg font-bold text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 transition-all flex items-center justify-center gap-2"
                  >
                    {responding ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Confirmar e Enviar
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
