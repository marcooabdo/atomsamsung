import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle, XCircle, MessageCircle, Loader2, Phone, MapPin, Package, Wrench, AlertCircle, Camera, FileText, User, Cpu, Calendar } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface OrcamentoData {
  link: {
    id: string;
    status: 'pendente' | 'aprovado' | 'rejeitado' | 'negociando';
    data_resposta: string | null;
    expires_at: string | null;
  };
  os: {
    numero_os_interna: string;
    cliente_nome: string;
    cliente_telefone: string;
    cliente_cpf_cnpj?: string;
    cliente_endereco?: string;
    cliente_logradouro?: string;
    cliente_numero?: string;
    cliente_bairro?: string;
    cliente_cidade?: string;
    cliente_estado?: string;
    cliente_cep?: string;
    aparelho_marca: string;
    aparelho_modelo: string;
    aparelho_numero_serie?: string;
    aparelho_imei?: string;
    defeito_relatado: string;
    diagnostico_tecnico: string;
    reparo_efetuado?: string;
    data_abertura: string;
    unidade: {
      nome: string;
      telefone: string;
      endereco: string;
      cidade: string;
      uf: string;
      cnpj?: string;
      logo_url?: string;
    } | null;
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
    termos: {
      termo_orcamento: string | null;
      termo_garantia: string | null;
      canais_atendimento: string | null;
      observacoes_gerais: string | null;
    } | null;
  };
}

export function OrcamentoPublico() {
  const { token } = useParams<{ token: string }>();
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
      setError('Token invalido');
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
        throw new Error(errorData.error || 'Erro ao carregar orcamento');
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
      await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        });
      });
      setCapturandoLocalizacao(false);
      abrirCamera();
    } catch {
      setCapturandoLocalizacao(false);
      if (confirm('Nao foi possivel obter sua localizacao. Deseja continuar mesmo assim?')) {
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
    } catch {
      alert('Nao foi possivel acessar a camera. Por favor, permita o acesso a camera.');
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
      } catch {
        console.error('Erro ao obter localizacao');
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
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Carregando orcamento...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    const isExpired = error?.toLowerCase().includes('expirado') || error?.toLowerCase().includes('expirou');

    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center border border-gray-200">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            {isExpired ? 'Link Expirado' : 'Link Invalido'}
          </h1>
          <p className="text-gray-600 mb-4">
            {error || 'O link de orcamento nao foi encontrado ou expirou.'}
          </p>
          {isExpired && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-700">
                Este link tinha validade de 72 horas e ja expirou. Por favor, entre em contato com a assistencia tecnica para solicitar um novo link.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  const { link, os } = data;
  const jaRespondido = link.status !== 'pendente';

  if (showSuccess) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center border border-green-200">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Resposta Enviada!</h1>
          <p className="text-gray-600 mb-6">
            {selectedAction === 'aprovado' && 'Obrigado por aprovar o orcamento! Em breve entraremos em contato.'}
            {selectedAction === 'rejeitado' && 'Recebemos sua rejeicao. Entraremos em contato para entender melhor.'}
            {selectedAction === 'negociando' && 'Recebemos sua mensagem. Vamos analisar e retornar em breve.'}
          </p>
          <p className="text-sm text-gray-500">Voce pode fechar esta pagina.</p>
        </div>
      </div>
    );
  }

  const clienteEndereco = os.cliente_logradouro
    ? `${os.cliente_logradouro}${os.cliente_numero ? `, ${os.cliente_numero}` : ''}${os.cliente_bairro ? ` - ${os.cliente_bairro}` : ''}${os.cliente_cidade ? `, ${os.cliente_cidade}` : ''}${os.cliente_estado ? `/${os.cliente_estado}` : ''}${os.cliente_cep ? ` - ${os.cliente_cep}` : ''}`
    : os.cliente_endereco || '';

  return (
    <div className="min-h-screen bg-gray-100 py-4 px-2 sm:py-8 sm:px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg overflow-hidden border border-gray-200">
          <div className="bg-gradient-to-r from-blue-600 to-blue-800 p-4 sm:p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">ORCAMENTO DE SERVICO</h1>
                <p className="text-blue-200 text-sm mt-1">Ordem de Servico #{os.numero_os_interna}</p>
              </div>
              {os.unidade?.logo_url && (
                <img src={os.unidade.logo_url} alt="Logo" className="h-12 sm:h-16 object-contain" />
              )}
            </div>
            {os.unidade && (
              <div className="mt-4 pt-4 border-t border-blue-400/30 text-xs sm:text-sm">
                <p className="font-semibold">{os.unidade.nome}</p>
                <p className="text-blue-200">{os.unidade.endereco}, {os.unidade.cidade} - {os.unidade.uf}</p>
                <p className="text-blue-200">Tel: {os.unidade.telefone}</p>
              </div>
            )}
          </div>

          <div className="p-4 sm:p-6 space-y-6">
            <div className="grid sm:grid-cols-2 gap-4 sm:gap-6">
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
                  <User className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-gray-800 text-sm uppercase">Dados do Cliente</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-500">Nome:</span>
                    <span className="ml-2 text-gray-800 font-medium">{os.cliente_nome}</span>
                  </div>
                  {os.cliente_cpf_cnpj && (
                    <div>
                      <span className="text-gray-500">CPF/CNPJ:</span>
                      <span className="ml-2 text-gray-800">{os.cliente_cpf_cnpj}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Phone className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-gray-500">Tel:</span>
                    <span className="ml-1 text-gray-800">{os.cliente_telefone}</span>
                  </div>
                  {clienteEndereco && (
                    <div className="flex items-start gap-1">
                      <MapPin className="w-3.5 h-3.5 text-gray-400 mt-0.5 flex-shrink-0" />
                      <span className="text-gray-800 text-xs">{clienteEndereco}</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
                  <Cpu className="w-5 h-5 text-blue-600" />
                  <h3 className="font-bold text-gray-800 text-sm uppercase">Equipamento</h3>
                </div>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-500">Marca/Modelo:</span>
                    <span className="ml-2 text-gray-800 font-medium">{os.aparelho_marca} {os.aparelho_modelo}</span>
                  </div>
                  {os.aparelho_numero_serie && (
                    <div>
                      <span className="text-gray-500">N/S:</span>
                      <span className="ml-2 text-gray-800 font-mono text-xs">{os.aparelho_numero_serie}</span>
                    </div>
                  )}
                  {os.aparelho_imei && (
                    <div>
                      <span className="text-gray-500">IMEI:</span>
                      <span className="ml-2 text-gray-800 font-mono text-xs">{os.aparelho_imei}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-gray-500">Data:</span>
                    <span className="ml-1 text-gray-800">{new Date(os.data_abertura).toLocaleDateString('pt-BR')}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-200">
                <FileText className="w-5 h-5 text-blue-600" />
                <h3 className="font-bold text-gray-800 text-sm uppercase">Defeito e Diagnostico</h3>
              </div>
              <div className="space-y-3 text-sm">
                <div>
                  <p className="text-gray-500 font-medium mb-1">Defeito Relatado:</p>
                  <p className="text-gray-800 bg-white p-2 rounded border border-gray-100">{os.defeito_relatado || 'Nao informado'}</p>
                </div>
                {os.diagnostico_tecnico && (
                  <div>
                    <p className="text-gray-500 font-medium mb-1">Diagnostico Tecnico:</p>
                    <p className="text-gray-800 bg-white p-2 rounded border border-gray-100">{os.diagnostico_tecnico}</p>
                  </div>
                )}
              </div>
            </div>

            {os.cotacao && (
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-blue-600 text-white px-4 py-2 flex items-center gap-2">
                  <Package className="w-5 h-5" />
                  <h3 className="font-bold text-sm uppercase">Detalhes do Orcamento</h3>
                </div>

                {os.cotacao.cotacoes_pecas && os.cotacao.cotacoes_pecas.length > 0 && (
                  <div className="p-4 border-b border-gray-200">
                    <h4 className="text-sm font-bold text-gray-700 uppercase mb-3 flex items-center gap-2">
                      <Package className="w-4 h-4 text-blue-600" />
                      Pecas
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="text-left px-3 py-2 text-gray-600 font-semibold">Descricao</th>
                            <th className="text-center px-3 py-2 text-gray-600 font-semibold w-16">Qtd</th>
                            <th className="text-right px-3 py-2 text-gray-600 font-semibold w-24">Unit.</th>
                            <th className="text-right px-3 py-2 text-gray-600 font-semibold w-24">Total</th>
                          </tr>
                        </thead>
                        <tbody>
                          {os.cotacao.cotacoes_pecas.map((peca, idx) => (
                            <tr key={peca.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-3 py-2 text-gray-800">
                                <div className="font-medium">{peca.descricao}</div>
                                <div className="text-xs text-gray-500">Cod: {peca.codigo}</div>
                              </td>
                              <td className="px-3 py-2 text-center text-gray-800">{peca.quantidade}</td>
                              <td className="px-3 py-2 text-right text-gray-800">R$ {peca.valor_final_unitario.toFixed(2)}</td>
                              <td className="px-3 py-2 text-right font-semibold text-gray-800">R$ {peca.valor_total.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {os.cotacao.cotacoes_servicos && os.cotacao.cotacoes_servicos.length > 0 && (
                  <div className="p-4 border-b border-gray-200">
                    <h4 className="text-sm font-bold text-gray-700 uppercase mb-3 flex items-center gap-2">
                      <Wrench className="w-4 h-4 text-blue-600" />
                      Servicos
                    </h4>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100">
                          <tr>
                            <th className="text-left px-3 py-2 text-gray-600 font-semibold">Descricao</th>
                            <th className="text-center px-3 py-2 text-gray-600 font-semibold w-16">Qtd</th>
                            <th className="text-right px-3 py-2 text-gray-600 font-semibold w-24">Valor</th>
                          </tr>
                        </thead>
                        <tbody>
                          {os.cotacao.cotacoes_servicos.map((servico, idx) => (
                            <tr key={servico.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                              <td className="px-3 py-2 text-gray-800">
                                <div className="font-medium">{servico.nome}</div>
                                {servico.descricao && (
                                  <div className="text-xs text-gray-500">{servico.descricao}</div>
                                )}
                              </td>
                              <td className="px-3 py-2 text-center text-gray-800">{servico.quantidade}</td>
                              <td className="px-3 py-2 text-right font-semibold text-gray-800">R$ {servico.valor_total.toFixed(2)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                <div className="bg-gradient-to-r from-blue-50 to-blue-100 p-4">
                  <div className="max-w-xs ml-auto space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Pecas:</span>
                      <span className="font-medium text-gray-800">R$ {os.cotacao.valor_pecas.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Servicos:</span>
                      <span className="font-medium text-gray-800">R$ {os.cotacao.valor_servicos.toFixed(2)}</span>
                    </div>
                    {os.cotacao.desconto_valor > 0 && (
                      <div className="flex justify-between text-sm text-green-600">
                        <span>Desconto:</span>
                        <span className="font-medium">- R$ {os.cotacao.desconto_valor.toFixed(2)}</span>
                      </div>
                    )}
                    <div className="flex justify-between pt-2 border-t border-blue-200">
                      <span className="text-lg font-bold text-gray-800">TOTAL:</span>
                      <span className="text-xl font-bold text-blue-600">
                        R$ {os.cotacao.valor_liquido.toFixed(2)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {os.termos && (os.termos.termo_orcamento || os.termos.termo_garantia || os.termos.observacoes_gerais) && (
              <div className="bg-gray-50 rounded-lg p-4 border border-gray-200 space-y-4">
                {os.termos.termo_orcamento && (
                  <div>
                    <h4 className="text-sm font-bold text-gray-700 uppercase mb-2 flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      Termos do Orcamento
                    </h4>
                    <div className="text-xs text-gray-600 whitespace-pre-wrap bg-white p-3 rounded border border-gray-100">
                      {os.termos.termo_orcamento}
                    </div>
                  </div>
                )}
                {os.termos.termo_garantia && (
                  <div>
                    <h4 className="text-sm font-bold text-gray-700 uppercase mb-2 flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                      Termos de Garantia
                    </h4>
                    <div className="text-xs text-gray-600 whitespace-pre-wrap bg-white p-3 rounded border border-gray-100">
                      {os.termos.termo_garantia}
                    </div>
                  </div>
                )}
                {os.termos.observacoes_gerais && (
                  <div>
                    <h4 className="text-sm font-bold text-gray-700 uppercase mb-2 flex items-center gap-2">
                      <AlertCircle className="w-4 h-4 text-yellow-600" />
                      Observacoes
                    </h4>
                    <div className="text-xs text-gray-600 whitespace-pre-wrap bg-white p-3 rounded border border-gray-100">
                      {os.termos.observacoes_gerais}
                    </div>
                  </div>
                )}
                {os.termos.canais_atendimento && (
                  <div>
                    <h4 className="text-sm font-bold text-gray-700 uppercase mb-2 flex items-center gap-2">
                      <Phone className="w-4 h-4 text-blue-600" />
                      Canais de Atendimento
                    </h4>
                    <div className="text-xs text-gray-600 whitespace-pre-wrap bg-white p-3 rounded border border-gray-100">
                      {os.termos.canais_atendimento}
                    </div>
                  </div>
                )}
              </div>
            )}

            {jaRespondido ? (
              <div className="border-t border-gray-200 pt-6">
                <div className={`p-4 rounded-lg border-2 ${
                  link.status === 'aprovado' ? 'bg-green-50 border-green-400' :
                  link.status === 'rejeitado' ? 'bg-red-50 border-red-400' :
                  'bg-yellow-50 border-yellow-400'
                }`}>
                  <div className="flex items-center gap-3">
                    {link.status === 'aprovado' && <CheckCircle className="w-8 h-8 text-green-500" />}
                    {link.status === 'rejeitado' && <XCircle className="w-8 h-8 text-red-500" />}
                    {link.status === 'negociando' && <MessageCircle className="w-8 h-8 text-yellow-500" />}
                    <div>
                      <p className={`font-bold text-lg ${
                        link.status === 'aprovado' ? 'text-green-700' :
                        link.status === 'rejeitado' ? 'text-red-700' :
                        'text-yellow-700'
                      }`}>
                        {link.status === 'aprovado' && 'Orcamento Aprovado'}
                        {link.status === 'rejeitado' && 'Orcamento Rejeitado'}
                        {link.status === 'negociando' && 'Em Negociacao'}
                      </p>
                      <p className="text-sm text-gray-600">
                        Respondido em {new Date(link.data_resposta!).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-bold text-gray-800 mb-4 text-center">O que voce decide?</h3>

                <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
                  <button
                    onClick={() => {
                      setSelectedAction('aprovado');
                      setMensagem('');
                    }}
                    className={`p-3 sm:p-4 rounded-lg border-2 transition-all ${
                      selectedAction === 'aprovado'
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-green-300 bg-white'
                    }`}
                  >
                    <CheckCircle className={`w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 ${selectedAction === 'aprovado' ? 'text-green-500' : 'text-gray-400'}`} />
                    <p className={`font-bold text-xs sm:text-sm ${selectedAction === 'aprovado' ? 'text-green-700' : 'text-gray-600'}`}>Aprovar</p>
                  </button>

                  <button
                    onClick={() => setSelectedAction('negociando')}
                    className={`p-3 sm:p-4 rounded-lg border-2 transition-all ${
                      selectedAction === 'negociando'
                        ? 'border-yellow-500 bg-yellow-50'
                        : 'border-gray-200 hover:border-yellow-300 bg-white'
                    }`}
                  >
                    <MessageCircle className={`w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 ${selectedAction === 'negociando' ? 'text-yellow-500' : 'text-gray-400'}`} />
                    <p className={`font-bold text-xs sm:text-sm ${selectedAction === 'negociando' ? 'text-yellow-700' : 'text-gray-600'}`}>Negociar</p>
                  </button>

                  <button
                    onClick={() => setSelectedAction('rejeitado')}
                    className={`p-3 sm:p-4 rounded-lg border-2 transition-all ${
                      selectedAction === 'rejeitado'
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 hover:border-red-300 bg-white'
                    }`}
                  >
                    <XCircle className={`w-6 h-6 sm:w-8 sm:h-8 mx-auto mb-2 ${selectedAction === 'rejeitado' ? 'text-red-500' : 'text-gray-400'}`} />
                    <p className={`font-bold text-xs sm:text-sm ${selectedAction === 'rejeitado' ? 'text-red-700' : 'text-gray-600'}`}>Rejeitar</p>
                  </button>
                </div>

                {selectedAction && selectedAction !== 'aprovado' && (
                  <div className="mb-4">
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      {selectedAction === 'negociando' ? 'Sua proposta ou duvida:' : 'Motivo da rejeicao:'}
                    </label>
                    <textarea
                      value={mensagem}
                      onChange={(e) => setMensagem(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      rows={4}
                      placeholder={selectedAction === 'negociando' ? 'Ex: Gostaria de negociar o valor das pecas...' : 'Por favor, explique o motivo...'}
                    />
                  </div>
                )}

                {selectedAction && (
                  <button
                    onClick={iniciarCapturaLocalizacaoESelfie}
                    disabled={responding || capturandoLocalizacao}
                    className="w-full py-4 rounded-lg font-bold text-white bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg"
                  >
                    {capturandoLocalizacao ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Capturando localizacao...
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

                {link.expires_at && (
                  <p className="text-xs text-gray-500 text-center mt-3">
                    Este link e valido ate {new Date(link.expires_at).toLocaleString('pt-BR')}
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="bg-gray-50 px-4 sm:px-6 py-4 border-t border-gray-200">
            <p className="text-xs text-gray-500 text-center">
              Documento gerado eletronicamente. Em caso de duvidas, entre em contato com a assistencia tecnica.
            </p>
          </div>
        </div>
      </div>

      {showCamera && !selfieCapturada && (
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="max-w-lg w-full">
            <div className="bg-white rounded-lg overflow-hidden shadow-2xl">
              <div className="p-4 bg-blue-600">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Camera className="w-5 h-5" />
                  Tire uma Selfie
                </h3>
                <p className="text-sm text-blue-200 mt-1">
                  Para confirmar sua identidade, precisamos de uma foto sua
                </p>
              </div>

              <div className="p-4">
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
                    className="flex-1 py-3 rounded-lg font-bold text-gray-700 bg-gray-200 hover:bg-gray-300 transition-all"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={tirarSelfie}
                    className="flex-1 py-3 rounded-lg font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
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
        <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4">
          <div className="max-w-lg w-full">
            <div className="bg-white rounded-lg overflow-hidden shadow-2xl">
              <div className="p-4 bg-green-600">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Foto Capturada!
                </h3>
                <p className="text-sm text-green-200 mt-1">
                  Revise sua foto antes de enviar
                </p>
              </div>

              <div className="p-4">
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
                    className="flex-1 py-3 rounded-lg font-bold text-gray-700 bg-gray-200 hover:bg-gray-300 transition-all"
                  >
                    Tirar Outra
                  </button>
                  <button
                    onClick={handleRespond}
                    disabled={responding}
                    className="flex-1 py-3 rounded-lg font-bold text-white bg-green-600 hover:bg-green-700 transition-all flex items-center justify-center gap-2"
                  >
                    {responding ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Confirmar
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
