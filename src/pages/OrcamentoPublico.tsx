import { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import {
  CheckCircle, XCircle, Loader2, Phone, MapPin, Package, Wrench,
  AlertCircle, Camera, FileText, User, Cpu, Calendar, Image, ShieldCheck,
  Clock, ChevronRight, Star
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { jsPDF } from 'jspdf';

interface Peca {
  id: string;
  codigo: string;
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
  fonte?: string;
}

interface Servico {
  id: string;
  nome: string;
  descricao: string;
  valor: number;
  quantidade: number;
  valor_total: number;
}

interface OrcamentoData {
  link: {
    id: string;
    os_id: string;
    status: 'pendente' | 'aprovado' | 'rejeitado';
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
    numero_os_samsung?: string | null;
    tipo_orcamento?: string | null;
    unidade: {
      nome: string;
      telefone: string;
      rua?: string;
      numero?: string;
      bairro?: string;
      cidade: string;
      uf: string;
      cnpj?: string;
    } | null;
    cotacao: {
      id: string;
      valor_pecas: number;
      valor_servicos: number;
      desconto_tipo: 'percentual' | 'valor' | null;
      desconto_valor: number;
      valor_desconto_calculado: number;
      valor_liquido: number;
      cotacoes_pecas: Peca[];
      cotacoes_servicos: Servico[];
    } | null;
    termos: {
      termo_orcamento: string | null;
      termo_garantia: string | null;
      canais_atendimento: string | null;
      observacoes_gerais: string | null;
    } | null;
    anexos: Array<{
      id: string;
      url: string;
      nome_arquivo: string;
      descricao: string | null;
      tipo: string;
    }>;
  };
}

export function OrcamentoPublico() {
  const { token } = useParams<{ token: string }>();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<OrcamentoData | null>(null);
  const [error, setError] = useState('');
  const [responding, setResponding] = useState(false);
  const [selectedAction, setSelectedAction] = useState<'aprovado' | 'rejeitado' | null>(null);
  const [mensagem, setMensagem] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [selfieCapturada, setSelfieCapturada] = useState<string | null>(null);
  const [capturandoLocalizacao, setCapturandoLocalizacao] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [localizacaoCapturada, setLocalizacaoCapturada] = useState<{
    latitude: number;
    longitude: number;
    endereco: string | null;
  } | null>(null);
  const [selectedFoto, setSelectedFoto] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);

  useEffect(() => {
    if (!token) {
      setError('Token invalido');
      setLoading(false);
      return;
    }
    loadOrcamento();
  }, [token]);

  useEffect(() => {
    if (showCamera && stream && videoRef.current && !selfieCapturada) {
      videoRef.current.srcObject = stream;
      videoRef.current.onloadedmetadata = () => {
        videoRef.current?.play().then(() => {
          setCameraReady(true);
        }).catch(console.error);
      };
    }
    return () => {
      if (!showCamera && stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [showCamera, stream, selfieCapturada]);

  const loadOrcamento = async () => {
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-orcamento-publico?token=${token}`;
      const response = await fetch(apiUrl, {
        headers: { 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Erro ao carregar orcamento');
      }

      const result = await response.json();
      setData(result);
      logAcao('aberto', result.link.id, result.link.os_id, null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const logAcao = async (
    acao: 'aberto' | 'aprovado' | 'reprovado' | 'negociacao',
    linkId: string,
    osId: string,
    mensagemLog: string | null,
    lat?: number | null,
    lng?: number | null,
    endereco?: string | null
  ) => {
    try {
      await supabase.from('orcamento_link_logs').insert({
        link_id: linkId,
        os_id: osId,
        acao,
        ip_address: null,
        user_agent: navigator.userAgent,
        latitude: lat || null,
        longitude: lng || null,
        endereco_aproximado: endereco || null,
        mensagem: mensagemLog,
        dados_adicionais: {
          timestamp: new Date().toISOString(),
          platform: navigator.platform,
          language: navigator.language
        }
      });
    } catch (err) {
      console.error('Erro ao logar acao:', err);
    }
  };

  const iniciarCapturaLocalizacaoESelfie = async () => {
    if (!selectedAction) return;

    if (selectedAction === 'rejeitado' && !mensagem.trim()) {
      alert('Por favor, escreva uma mensagem explicando o motivo.');
      return;
    }

    setCapturandoLocalizacao(true);

    const captureLocation = (): Promise<GeolocationPosition | null> => {
      return new Promise((resolve) => {
        if (!navigator.geolocation) { resolve(null); return; }
        navigator.geolocation.getCurrentPosition(
          (position) => resolve(position),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
      });
    };

    try {
      const position = await captureLocation();
      if (position) {
        let endereco: string | null = null;
        try {
          const geoResponse = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${position.coords.latitude}&lon=${position.coords.longitude}`,
            { headers: { 'User-Agent': 'OrcamentoApp/1.0' } }
          );
          const geoData = await geoResponse.json();
          endereco = geoData.display_name || null;
        } catch {}
        setLocalizacaoCapturada({ latitude: position.coords.latitude, longitude: position.coords.longitude, endereco });
      } else {
        setLocalizacaoCapturada(null);
      }
      setCapturandoLocalizacao(false);
      abrirCamera();
    } catch {
      setCapturandoLocalizacao(false);
      setLocalizacaoCapturada(null);
      abrirCamera();
    }
  };

  const abrirCamera = async () => {
    try {
      setCameraReady(false);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      });
      setStream(mediaStream);
      setShowCamera(true);
    } catch (err) {
      console.error('Erro ao acessar camera:', err);
      alert('Nao foi possivel acessar a camera. Por favor, permita o acesso a camera nas configuracoes do seu navegador.');
    }
  };

  const tirarSelfie = () => {
    if (!cameraReady || !videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const context = canvas.getContext('2d');
    if (context) {
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
      setSelfieCapturada(dataUrl);
      setCameraReady(false);
      if (stream) { stream.getTracks().forEach(track => track.stop()); setStream(null); }
    }
  };

  const refazerSelfie = () => { setSelfieCapturada(null); abrirCamera(); };

  const gerarPDFCompleto = async (): Promise<Blob> => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    let yPos = 20;

    const addText = (text: string, size: number = 10, style: 'normal' | 'bold' = 'normal') => {
      doc.setFontSize(size);
      doc.setFont('helvetica', style);
      const lines = doc.splitTextToSize(text, pageWidth - margin * 2);
      doc.text(lines, margin, yPos);
      yPos += lines.length * (size * 0.4) + 2;
    };

    const checkPageBreak = (height: number) => {
      if (yPos + height > pageHeight - 20) { doc.addPage(); yPos = 20; }
    };

    const acaoTitulo = selectedAction === 'aprovado' ? 'APROVAÇÃO' : 'REJEIÇÃO';
    const corHeader = selectedAction === 'aprovado' ? [34, 197, 94] : [239, 68, 68];

    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, pageWidth, 35, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`COMPROVANTE DE ${acaoTitulo} DE ORÇAMENTO`, pageWidth / 2, 15, { align: 'center' });
    doc.setFontSize(11);
    doc.text(`OS #${data?.os.numero_os_interna || ''}`, pageWidth / 2, 25, { align: 'center' });

    yPos = 45;
    doc.setTextColor(255, 255, 255);

    if (data?.os.unidade) {
      addText(data.os.unidade.nome, 12, 'bold');
      addText(`${data.os.unidade.endereco}, ${data.os.unidade.cidade} - ${data.os.unidade.uf}`, 9);
      addText(`Tel: ${data.os.unidade.telefone}`, 9);
      if (data.os.unidade.cnpj) addText(`CNPJ: ${data.os.unidade.cnpj}`, 9);
      yPos += 5;
    }

    doc.setDrawColor(200, 200, 200);
    doc.line(margin, yPos, pageWidth - margin, yPos);
    yPos += 10;
    doc.setTextColor(0, 0, 0);

    addText('DADOS DO CLIENTE', 11, 'bold');
    addText(`Nome: ${data?.os.cliente_nome || ''}`);
    if (data?.os.cliente_cpf_cnpj) addText(`CPF/CNPJ: ${data.os.cliente_cpf_cnpj}`);
    addText(`Telefone: ${data?.os.cliente_telefone || ''}`);
    const pdfClienteEndereco = data?.os.cliente_logradouro
      ? `${data.os.cliente_logradouro}${data.os.cliente_numero ? `, ${data.os.cliente_numero}` : ''}${data.os.cliente_bairro ? ` - ${data.os.cliente_bairro}` : ''}${data.os.cliente_cidade ? `, ${data.os.cliente_cidade}` : ''}${data.os.cliente_estado ? `/${data.os.cliente_estado}` : ''}${data.os.cliente_cep ? ` - ${data.os.cliente_cep}` : ''}`
      : data?.os.cliente_endereco || '';
    if (pdfClienteEndereco) addText(`Endereco: ${pdfClienteEndereco}`);
    yPos += 5;

    addText('EQUIPAMENTO', 11, 'bold');
    addText(`Marca/Modelo: ${data?.os.aparelho_marca || ''} ${data?.os.aparelho_modelo || ''}`);
    if (data?.os.aparelho_numero_serie) addText(`Numero de Serie: ${data.os.aparelho_numero_serie}`);
    if (data?.os.aparelho_imei) addText(`IMEI: ${data.os.aparelho_imei}`);
    addText(`Data de Abertura: ${new Date(data?.os.data_abertura || '').toLocaleDateString('pt-BR')}`);
    yPos += 5;

    checkPageBreak(40);
    addText('DEFEITO E DIAGNOSTICO', 11, 'bold');
    addText(`Defeito Relatado: ${data?.os.defeito_relatado || 'Nao informado'}`);
    if (data?.os.diagnostico_tecnico) {
      addText(`Diagnostico Tecnico: ${data.os.diagnostico_tecnico}`);
    }
    yPos += 5;

    if (data?.os.cotacao) {
      checkPageBreak(60);
      addText('DETALHES DO ORCAMENTO', 11, 'bold');

      if (data.os.cotacao.cotacoes_pecas && data.os.cotacao.cotacoes_pecas.length > 0) {
        addText('Pecas:', 10, 'bold');
        data.os.cotacao.cotacoes_pecas.forEach(peca => {
          checkPageBreak(15);
          addText(`  - ${peca.descricao} (${peca.quantidade}x) - R$ ${peca.valor_total.toFixed(2)}`);
        });
      }

      if (data.os.cotacao.cotacoes_servicos && data.os.cotacao.cotacoes_servicos.length > 0) {
        addText('Servicos:', 10, 'bold');
        data.os.cotacao.cotacoes_servicos.forEach(servico => {
          checkPageBreak(15);
          addText(`  - ${servico.nome} (${servico.quantidade}x) - R$ ${servico.valor_total.toFixed(2)}`);
        });
      }

      yPos += 3;
      addText(`Subtotal Pecas: R$ ${data.os.cotacao.valor_pecas.toFixed(2)}`);
      addText(`Subtotal Servicos: R$ ${data.os.cotacao.valor_servicos.toFixed(2)}`);
      if (data.os.cotacao.valor_desconto_calculado > 0) {
        addText(`Desconto: - R$ ${data.os.cotacao.valor_desconto_calculado.toFixed(2)}`);
      }
      yPos += 2;
      addText(`TOTAL: R$ ${data.os.cotacao.valor_liquido.toFixed(2)}`, 12, 'bold');
    }

    if (data?.os.termos) {
      const { termo_orcamento, termo_garantia, observacoes_gerais, canais_atendimento } = data.os.termos;
      if (termo_orcamento || termo_garantia || observacoes_gerais || canais_atendimento) {
        checkPageBreak(40);
        yPos += 5;
        addText('TERMOS E CONDICOES', 11, 'bold');
        if (termo_orcamento) {
          addText('Termos do Orcamento:', 10, 'bold');
          addText(termo_orcamento, 9);
          yPos += 3;
        }
        if (termo_garantia) {
          checkPageBreak(20);
          addText('Termos de Garantia:', 10, 'bold');
          addText(termo_garantia, 9);
          yPos += 3;
        }
        if (observacoes_gerais) {
          checkPageBreak(20);
          addText('Observacoes:', 10, 'bold');
          addText(observacoes_gerais, 9);
          yPos += 3;
        }
        if (canais_atendimento) {
          checkPageBreak(20);
          addText('Canais de Atendimento:', 10, 'bold');
          addText(canais_atendimento, 9);
          yPos += 3;
        }
      }
    }

    checkPageBreak(50);
    yPos += 10;
    doc.setFillColor(corHeader[0], corHeader[1], corHeader[2]);
    doc.rect(margin, yPos - 5, pageWidth - margin * 2, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    const statusTexto = selectedAction === 'aprovado' ? 'ORCAMENTO APROVADO PELO CLIENTE' : 'ORCAMENTO REJEITADO PELO CLIENTE';
    doc.text(statusTexto, pageWidth / 2, yPos + 5, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Data/Hora: ${new Date().toLocaleString('pt-BR')}`, pageWidth / 2, yPos + 15, { align: 'center' });
    yPos += 35;
    doc.setTextColor(0, 0, 0);

    if (mensagem.trim()) {
      checkPageBreak(40);
      const labelMensagem = selectedAction === 'aprovado' ? 'OBSERVACOES DO CLIENTE:' : 'MOTIVO DA REJEICAO:';
      addText(labelMensagem, 11, 'bold');
      doc.setFillColor(245, 245, 245);
      const mensagemLines = doc.splitTextToSize(mensagem.trim(), pageWidth - margin * 2 - 10);
      const mensagemHeight = mensagemLines.length * 5 + 10;
      doc.rect(margin, yPos - 3, pageWidth - margin * 2, mensagemHeight, 'F');
      doc.setTextColor(60, 60, 60);
      doc.setFontSize(10);
      doc.text(mensagemLines, margin + 5, yPos + 5);
      yPos += mensagemHeight + 10;
      doc.setTextColor(0, 0, 0);
    }

    doc.addPage();
    yPos = 20;
    doc.setFillColor(30, 64, 175);
    doc.rect(0, 0, pageWidth, 25, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('VERIFICACAO DE IDENTIDADE E LOCALIZACAO', pageWidth / 2, 15, { align: 'center' });

    yPos = 40;
    doc.setTextColor(0, 0, 0);

    if (localizacaoCapturada) {
      addText('GEOLOCALIZACAO NO MOMENTO DA RESPOSTA', 12, 'bold');
      yPos += 3;
      doc.setFillColor(240, 249, 255);
      doc.rect(margin, yPos - 5, pageWidth - margin * 2, 45, 'F');
      doc.setDrawColor(59, 130, 246);
      doc.rect(margin, yPos - 5, pageWidth - margin * 2, 45, 'S');
      yPos += 5;
      addText(`Latitude: ${localizacaoCapturada.latitude.toFixed(6)}`);
      addText(`Longitude: ${localizacaoCapturada.longitude.toFixed(6)}`);
      if (localizacaoCapturada.endereco) addText(`Endereco Aproximado: ${localizacaoCapturada.endereco}`);
      doc.setTextColor(59, 130, 246);
      addText(`Link Google Maps: https://www.google.com/maps?q=${localizacaoCapturada.latitude},${localizacaoCapturada.longitude}`, 8);
      doc.setTextColor(0, 0, 0);
      yPos += 15;
    } else {
      addText('GEOLOCALIZACAO: Nao disponivel', 12, 'bold');
      yPos += 10;
    }

    if (selfieCapturada) {
      addText('FOTO DO CLIENTE NO MOMENTO DA RESPOSTA', 12, 'bold');
      yPos += 5;
      doc.setDrawColor(corHeader[0], corHeader[1], corHeader[2]);
      doc.setLineWidth(2);
      doc.rect(margin, yPos, pageWidth - margin * 2, 100, 'S');
      doc.setLineWidth(0.5);
      try {
        doc.addImage(selfieCapturada, 'JPEG', margin + 5, yPos + 5, pageWidth - margin * 2 - 10, 90);
        yPos += 110;
      } catch (err) {
        console.error('Erro ao adicionar selfie ao PDF:', err);
        yPos += 10;
        addText('(Erro ao carregar imagem)', 10);
      }
    } else {
      addText('FOTO DO CLIENTE: Nao disponivel', 12, 'bold');
      yPos += 10;
    }

    yPos += 10;
    doc.setFillColor(245, 245, 245);
    doc.rect(margin, yPos, pageWidth - margin * 2, 35, 'F');
    yPos += 10;
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    const disclaimer = [
      'DECLARACAO DE AUTENTICIDADE',
      '',
      'Este documento foi gerado eletronicamente no momento da resposta do cliente.',
      'A foto e geolocalizacao foram capturadas do dispositivo do cliente como prova de identidade.',
      `Registrado em: ${new Date().toLocaleString('pt-BR')}`,
      `User Agent: ${navigator.userAgent.substring(0, 80)}...`
    ];
    disclaimer.forEach(line => { doc.text(line, pageWidth / 2, yPos, { align: 'center' }); yPos += 4; });

    return doc.output('blob');
  };

  const handleRespond = async () => {
    if (!selectedAction || !data) return;
    setResponding(true);
    try {
      const latitude = localizacaoCapturada?.latitude || null;
      const longitude = localizacaoCapturada?.longitude || null;
      const enderecoCompleto = localizacaoCapturada?.endereco || null;
      const acaoLog = selectedAction === 'aprovado' ? 'aprovado' : 'reprovado';
      await logAcao(acaoLog, data.link.id, data.link.os_id, mensagem.trim() || null, latitude, longitude, enderecoCompleto);

      let pdfUrl: string | null = null;
      try {
        const pdfBlob = await gerarPDFCompleto();
        const acaoNome = selectedAction === 'aprovado' ? 'aprovacao' : 'rejeicao';
        const pdfFileName = `${data.os.numero_os_interna}/comprovante-${acaoNome}-${Date.now()}.pdf`;
        const { error: uploadError } = await supabase.storage.from('os-anexos').upload(pdfFileName, pdfBlob, { upsert: true, contentType: 'application/pdf' });
        if (!uploadError) {
          const { data: { publicUrl } } = supabase.storage.from('os-anexos').getPublicUrl(pdfFileName);
          pdfUrl = publicUrl;
          const { data: linkData } = await supabase.from('orcamento_links').select('os_id').eq('token', token).maybeSingle();
          if (linkData?.os_id) {
            const descricaoAnexo = selectedAction === 'aprovado' ? 'Comprovante de APROVACAO do orcamento pelo cliente' : 'Comprovante de REJEICAO do orcamento pelo cliente';
            await supabase.from('os_anexos').insert({ os_id: linkData.os_id, url: pdfUrl, tipo: 'pdf', nome_arquivo: `comprovante-${acaoNome}-${data.os.numero_os_interna}.pdf`, descricao: descricaoAnexo });
          }
        }
      } catch (err) { console.error('Erro ao gerar PDF:', err); }

      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-orcamento-publico?token=${token}&action=respond`;
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: selectedAction, mensagem: mensagem.trim() || null, latitude, longitude, endereco_completo: enderecoCompleto, selfie_url: pdfUrl }),
      });

      if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || 'Erro ao enviar resposta'); }

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
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #f1f5f9 0%, #dbeafe 100%)', color: '#1e293b' }}>
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Loader2 className="w-8 h-8 text-white animate-spin" />
          </div>
          <p style={{color:'#475569'}} className="font-medium">Carregando orçamento...</p>
        </div>
      </div>
    );
  }

  if (error || !data) {
    const isExpired = error?.toLowerCase().includes('expirado') || error?.toLowerCase().includes('expirou');
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #f1f5f9 0%, #dbeafe 100%)', color: '#1e293b' }}>
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-red-100" style={{color:'#1e293b'}}>
          <div className="w-16 h-16 bg-red-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-red-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">{isExpired ? 'Link Expirado' : 'Link Inválido'}</h1>
          <p className="text-slate-500 mb-4">{error || 'O link de orçamento não foi encontrado ou expirou.'}</p>
          {isExpired && (
            <div className="mt-4 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <p className="text-sm text-amber-700">Este link expirou. Entre em contato com o Smart Center para solicitar um novo link.</p>
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
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)', color: '#1e293b' }}>
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center border border-green-100" style={{color:'#1e293b'}}>
          <div className="w-20 h-20 bg-green-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-3">Resposta Enviada!</h1>
          <p className="text-slate-500 mb-6">
            {selectedAction === 'aprovado' && 'Obrigado por aprovar o orçamento! Em breve entraremos em contato para agendar o reparo.'}
            {selectedAction === 'rejeitado' && 'Recebemos sua rejeição. Entraremos em contato para entender melhor sua situação.'}
          </p>
          <p className="text-sm text-slate-400">Você pode fechar esta página com segurança.</p>
        </div>
      </div>
    );
  }

  const clienteEndereco = os.cliente_logradouro
    ? `${os.cliente_logradouro}${os.cliente_numero ? `, ${os.cliente_numero}` : ''}${os.cliente_bairro ? ` - ${os.cliente_bairro}` : ''}${os.cliente_cidade ? `, ${os.cliente_cidade}` : ''}${os.cliente_estado ? `/${os.cliente_estado}` : ''}${os.cliente_cep ? ` - ${os.cliente_cep}` : ''}`
    : os.cliente_endereco || '';

  const cotacao = os.cotacao;
  const temPecas = cotacao && cotacao.cotacoes_pecas && cotacao.cotacoes_pecas.length > 0;
  const temServicos = cotacao && cotacao.cotacoes_servicos && cotacao.cotacoes_servicos.length > 0;
  const subtotal = cotacao ? cotacao.valor_pecas + cotacao.valor_servicos : 0;
  const desconto = cotacao ? cotacao.valor_desconto_calculado : 0;

  return (
    <div className="min-h-screen py-4 px-3 sm:py-8 sm:px-4" style={{ background: 'linear-gradient(135deg, #f1f5f9 0%, #e0e7ff 50%, #dbeafe 100%)', color: '#1e293b' }}>
      <div className="max-w-2xl mx-auto space-y-4">

        {/* Header */}
        <div className="rounded-2xl shadow-2xl overflow-hidden" style={{ border: '1px solid #1a1a2e' }}>

          {/* Black top banner */}
          <div style={{ background: '#060608' }}>
            <div className="px-4 sm:px-6 pt-5 pb-4">
              {/* Row 1: logo + nome + badge OS */}
              <div className="flex items-start gap-3">
                {/* Logo */}
                <div className="flex-shrink-0">
                  <img
                    src="/PERFIL.jpg"
                    alt="Samsung Smart Xperience - Group Global"
                    className="rounded-xl object-cover"
                    style={{ width: '56px', height: '56px' }}
                  />
                </div>

                {/* Nome + CNPJ */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-xs font-medium uppercase tracking-widest mb-1" style={{ color: '#6b7280', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                    Orçamento Oficial
                  </p>
                  <h2 className="font-bold leading-snug" style={{ color: '#ffffff', fontSize: '15px', fontFamily: 'system-ui, -apple-system, sans-serif', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                    {os.unidade?.nome || 'Smart Center Samsung'}
                  </h2>
                  {os.unidade?.cnpj && (
                    <p className="text-xs mt-1" style={{ color: '#9ca3af', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      CNPJ {os.unidade.cnpj}
                    </p>
                  )}
                </div>

                {/* OS badge — compacto */}
                <div className="flex-shrink-0 text-right pt-0.5">
                  <div className="rounded-lg px-2.5 py-2" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <p className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#9ca3af', fontSize: '10px', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      {os.numero_os_samsung ? 'OS Samsung' : 'O.S.'}
                    </p>
                    <p className="font-bold font-mono mt-0.5" style={{ color: '#f1f5f9', fontSize: '13px' }}>
                      {os.numero_os_samsung ? os.numero_os_samsung : `#${os.numero_os_interna}`}
                    </p>
                    {os.numero_os_samsung && (
                      <p className="font-mono mt-0.5" style={{ color: '#6b7280', fontSize: '10px' }}>
                        #{os.numero_os_interna}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 2: endereço + telefone + data */}
              {os.unidade && (
                <div className="mt-3 rounded-lg px-3 py-2.5 flex flex-col gap-1.5" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>
                  {(os.unidade.rua || os.unidade.cidade) && (
                    <span className="flex items-start gap-2 text-xs" style={{ color: '#9ca3af', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      <MapPin className="w-3 h-3 flex-shrink-0 mt-0.5" style={{ color: '#6b7280' }} />
                      <span>
                        {[
                          os.unidade.rua && os.unidade.numero ? `${os.unidade.rua}, ${os.unidade.numero}` : os.unidade.rua,
                          os.unidade.bairro,
                          os.unidade.cidade && os.unidade.uf ? `${os.unidade.cidade} — ${os.unidade.uf}` : os.unidade.cidade
                        ].filter(Boolean).join(', ')}
                      </span>
                    </span>
                  )}
                  <div className="flex items-center justify-between gap-3">
                    {os.unidade.telefone && (
                      <span className="flex items-center gap-2 text-xs" style={{ color: '#9ca3af', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                        <Phone className="w-3 h-3 flex-shrink-0" style={{ color: '#6b7280' }} />
                        {os.unidade.telefone}
                      </span>
                    )}
                    <span className="flex items-center gap-1.5 text-xs ml-auto" style={{ color: '#6b7280', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                      <Calendar className="w-3 h-3 flex-shrink-0" />
                      {new Date(os.data_abertura).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* Blue accent line */}
            <div className="h-px" style={{ background: 'linear-gradient(90deg, transparent 0%, #1d4ed8 30%, #06b6d4 60%, transparent 100%)' }} />
          </div>

          {/* Status bar */}
          {jaRespondido && (
            <div className={`px-5 sm:px-6 py-3 flex items-center gap-2 ${
              link.status === 'aprovado' ? 'bg-green-600' : 'bg-red-600'
            }`}>
              {link.status === 'aprovado' && <><CheckCircle className="w-4 h-4 text-white" /><span className="text-white text-sm font-semibold">Orçamento Aprovado</span></>}
              {link.status === 'rejeitado' && <><XCircle className="w-4 h-4 text-white" /><span className="text-white text-sm font-semibold">Orçamento Rejeitado</span></>}
              {link.data_resposta && (
                <span className="text-white/80 text-xs ml-auto">
                  {new Date(link.data_resposta).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Cliente + Equipamento */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <User className="w-4 h-4 text-blue-600" />
              </div>
              <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Cliente</h3>
            </div>
            <div className="space-y-2.5">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Nome</p>
                <p className="text-slate-800 font-semibold text-sm">{os.cliente_nome}</p>
              </div>
              {os.cliente_cpf_cnpj && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">CPF/CNPJ</p>
                  <p className="text-slate-700 text-sm font-mono">{os.cliente_cpf_cnpj}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Telefone</p>
                <p className="text-slate-700 text-sm flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  {os.cliente_telefone}
                </p>
              </div>
              {clienteEndereco && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Endereço</p>
                  <p className="text-slate-600 text-xs leading-relaxed flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                    {clienteEndereco}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 bg-blue-50 rounded-lg flex items-center justify-center">
                <Cpu className="w-4 h-4 text-blue-600" />
              </div>
              <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Equipamento</h3>
            </div>
            <div className="space-y-2.5">
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Marca / Modelo</p>
                <p className="text-slate-800 font-semibold text-sm">{os.aparelho_marca} {os.aparelho_modelo}</p>
              </div>
              {os.aparelho_numero_serie && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Numero de Série</p>
                  <p className="text-slate-700 text-xs font-mono bg-slate-50 px-2 py-1 rounded">{os.aparelho_numero_serie}</p>
                </div>
              )}
              {os.aparelho_imei && (
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">IMEI</p>
                  <p className="text-slate-700 text-xs font-mono bg-slate-50 px-2 py-1 rounded">{os.aparelho_imei}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-slate-400 mb-0.5">Data de Abertura</p>
                <p className="text-slate-700 text-sm flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-slate-400" />
                  {new Date(os.data_abertura).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Defeito e Diagnostico */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 bg-amber-50 rounded-lg flex items-center justify-center">
              <FileText className="w-4 h-4 text-amber-600" />
            </div>
            <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Defeito e Diagnóstico</h3>
          </div>
          <div className="space-y-4">
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Defeito Relatado</p>
              <div className="bg-slate-50 rounded-xl p-3.5 text-sm text-slate-700 leading-relaxed border border-slate-100">
                {os.defeito_relatado || 'Não informado'}
              </div>
            </div>
            {os.diagnostico_tecnico && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Diagnóstico Técnico</p>
                <div className="bg-blue-50 rounded-xl p-3.5 text-sm text-blue-800 leading-relaxed border border-blue-100">
                  {os.diagnostico_tecnico}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Orçamento */}
        {cotacao && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="bg-gradient-to-r from-slate-800 to-slate-700 px-5 py-4 flex items-center gap-2.5">
              <Package className="w-5 h-5 text-white" />
              <h3 className="font-bold text-white text-sm uppercase tracking-wide">Detalhes do Orçamento</h3>
            </div>

            {/* Peças */}
            {temPecas && (
              <div className="p-5 border-b border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                  <Package className="w-4 h-4 text-blue-600" />
                  <h4 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Peças</h4>
                  <span className="ml-auto bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {cotacao.cotacoes_pecas.length} item{cotacao.cotacoes_pecas.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="rounded-xl overflow-hidden border border-slate-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="text-left px-4 py-3 text-slate-500 font-semibold text-xs uppercase tracking-wide">Descrição</th>
                        <th className="text-center px-3 py-3 text-slate-500 font-semibold text-xs uppercase tracking-wide w-14">Qtd</th>
                        <th className="text-right px-4 py-3 text-slate-500 font-semibold text-xs uppercase tracking-wide w-24">Unit.</th>
                        <th className="text-right px-4 py-3 text-slate-500 font-semibold text-xs uppercase tracking-wide w-24">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cotacao.cotacoes_pecas.map((peca, idx) => (
                        <tr key={peca.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} border-t border-slate-100`}>
                          <td className="px-4 py-3">
                            <p className="text-slate-800 font-medium leading-snug">{peca.descricao}</p>
                            {peca.codigo && (
                              <p className="text-xs text-slate-400 font-mono mt-0.5">PN: {peca.codigo}</p>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="bg-slate-100 text-slate-700 font-bold text-xs px-2 py-1 rounded-full">
                              {peca.quantidade}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600 text-sm">
                            {peca.valor_unitario > 0 ? `R$ ${peca.valor_unitario.toFixed(2)}` : '-'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-bold text-slate-800">R$ {peca.valor_total.toFixed(2)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Serviços */}
            {temServicos && (
              <div className="p-5 border-b border-slate-100">
                <div className="flex items-center gap-2 mb-4">
                  <Wrench className="w-4 h-4 text-blue-600" />
                  <h4 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Serviços</h4>
                  <span className="ml-auto bg-blue-100 text-blue-700 text-xs font-bold px-2 py-0.5 rounded-full">
                    {cotacao.cotacoes_servicos.length} item{cotacao.cotacoes_servicos.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <div className="rounded-xl overflow-hidden border border-slate-200">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="text-left px-4 py-3 text-slate-500 font-semibold text-xs uppercase tracking-wide">Descrição</th>
                        <th className="text-center px-3 py-3 text-slate-500 font-semibold text-xs uppercase tracking-wide w-14">Qtd</th>
                        <th className="text-right px-4 py-3 text-slate-500 font-semibold text-xs uppercase tracking-wide w-28">Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cotacao.cotacoes_servicos.map((servico, idx) => (
                        <tr key={servico.id} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'} border-t border-slate-100`}>
                          <td className="px-4 py-3">
                            <p className="text-slate-800 font-medium leading-snug">{servico.nome}</p>
                            {servico.descricao && (
                              <p className="text-xs text-slate-400 mt-0.5">{servico.descricao}</p>
                            )}
                          </td>
                          <td className="px-3 py-3 text-center">
                            <span className="bg-slate-100 text-slate-700 font-bold text-xs px-2 py-1 rounded-full">
                              {servico.quantidade}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right">
                            <span className="font-bold text-slate-800">R$ {servico.valor_total.toFixed(2)}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Resumo financeiro */}
            <div className="p-5 bg-gradient-to-br from-slate-50 to-blue-50">
              <div className="max-w-xs ml-auto">
                <div className="space-y-2 mb-3">
                  {cotacao.valor_pecas > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5" /> Peças
                      </span>
                      <span className="font-medium text-slate-700">R$ {cotacao.valor_pecas.toFixed(2)}</span>
                    </div>
                  )}
                  {cotacao.valor_servicos > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-slate-500 flex items-center gap-1.5">
                        <Wrench className="w-3.5 h-3.5" /> Serviços
                      </span>
                      <span className="font-medium text-slate-700">R$ {cotacao.valor_servicos.toFixed(2)}</span>
                    </div>
                  )}
                  {subtotal > 0 && desconto > 0 && (
                    <div className="flex justify-between text-sm pt-1 border-t border-slate-200">
                      <span className="text-slate-500">Subtotal</span>
                      <span className="font-medium text-slate-700">R$ {subtotal.toFixed(2)}</span>
                    </div>
                  )}
                  {desconto > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-emerald-600 font-medium flex items-center gap-1.5">
                        <Star className="w-3.5 h-3.5" />
                        Desconto
                        {cotacao.desconto_tipo === 'percentual' && cotacao.desconto_valor > 0 && (
                          <span className="bg-emerald-100 text-emerald-700 text-xs px-1.5 py-0.5 rounded-full font-bold">
                            -{cotacao.desconto_valor}%
                          </span>
                        )}
                      </span>
                      <span className="font-bold text-emerald-600">- R$ {desconto.toFixed(2)}</span>
                    </div>
                  )}
                </div>
                <div className="flex justify-between items-center pt-3 border-t-2 border-blue-200">
                  <span className="text-base font-bold text-slate-800">TOTAL</span>
                  <span className="text-2xl font-black text-blue-600">
                    R$ {cotacao.valor_liquido.toFixed(2)}
                  </span>
                </div>

                {!jaRespondido && (
                  <div className="mt-4 flex items-center gap-2.5 rounded-xl px-4 py-3" style={{ background: '#f0f9ff', border: '1px solid #bae6fd' }}>
                    <div className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center" style={{ background: '#0ea5e9' }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
                      </svg>
                    </div>
                    <p className="text-xs leading-snug" style={{ color: '#0369a1' }}>
                      Role a página até o final para visualizar os <strong>termos</strong> e os <strong>botões de aprovação ou rejeição</strong> do orçamento.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Fotos do equipamento */}
        {os.anexos && os.anexos.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2.5">
              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center">
                <Image className="w-4 h-4 text-slate-600" />
              </div>
              <h3 className="font-bold text-slate-700 text-sm uppercase tracking-wide">Fotos do Equipamento</h3>
            </div>
            <div className="p-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {os.anexos.map((anexo) => (
                  <div
                    key={anexo.id}
                    className="relative aspect-square rounded-xl overflow-hidden border border-slate-200 cursor-pointer group"
                    onClick={() => setSelectedFoto(anexo.url)}
                  >
                    <img src={anexo.url} alt={anexo.descricao || anexo.nome_arquivo} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                      <ChevronRight className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                    {anexo.descricao && (
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent text-white text-xs p-2 truncate">
                        {anexo.descricao}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Termos */}
        {os.termos && (os.termos.termo_orcamento || os.termos.termo_garantia || os.termos.observacoes_gerais || os.termos.canais_atendimento) && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 space-y-4">
            {os.termos.termo_orcamento && (
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5" /> Termos do Orçamento
                </h4>
                <div className="text-xs text-slate-600 whitespace-pre-wrap bg-slate-50 p-3.5 rounded-xl border border-slate-100 leading-relaxed">
                  {os.termos.termo_orcamento}
                </div>
              </div>
            )}
            {os.termos.termo_garantia && (
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-green-600" /> Termos de Garantia
                </h4>
                <div className="text-xs text-slate-600 whitespace-pre-wrap bg-green-50 p-3.5 rounded-xl border border-green-100 leading-relaxed">
                  {os.termos.termo_garantia}
                </div>
              </div>
            )}
            {os.termos.observacoes_gerais && (
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-500" /> Observações
                </h4>
                <div className="text-xs text-slate-600 whitespace-pre-wrap bg-amber-50 p-3.5 rounded-xl border border-amber-100 leading-relaxed">
                  {os.termos.observacoes_gerais}
                </div>
              </div>
            )}
            {os.termos.canais_atendimento && (
              <div>
                <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-blue-500" /> Canais de Atendimento
                </h4>
                <div className="text-xs text-slate-600 whitespace-pre-wrap bg-blue-50 p-3.5 rounded-xl border border-blue-100 leading-relaxed">
                  {os.termos.canais_atendimento}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Ação */}
        {jaRespondido ? (
          <div className={`rounded-2xl p-6 border-2 flex items-start gap-4 ${
            link.status === 'aprovado' ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
          }`}>
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
              link.status === 'aprovado' ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {link.status === 'aprovado' && <CheckCircle className="w-6 h-6 text-green-600" />}
              {link.status === 'rejeitado' && <XCircle className="w-6 h-6 text-red-600" />}
            </div>
            <div>
              <p className={`font-bold text-base ${
                link.status === 'aprovado' ? 'text-green-800' : 'text-red-800'
              }`}>
                {link.status === 'aprovado' && 'Orçamento Aprovado'}
                {link.status === 'rejeitado' && 'Orçamento Rejeitado'}
              </p>
              <p className="text-sm text-slate-500 mt-0.5">
                Respondido em {new Date(link.data_resposta!).toLocaleString('pt-BR')}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
            <h3 className="text-lg font-bold text-slate-800 mb-1 text-center">O que você decide?</h3>
            <p className="text-sm text-slate-400 text-center mb-6">Selecione uma opção abaixo para enviar sua resposta</p>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <button
                onClick={() => { setSelectedAction('aprovado'); setMensagem(''); }}
                className={`p-4 rounded-2xl border-2 transition-all text-center ${
                  selectedAction === 'aprovado'
                    ? 'border-green-500 bg-green-50 shadow-md shadow-green-100'
                    : 'border-slate-200 hover:border-green-300 bg-white hover:bg-green-50/50'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 transition-colors ${
                  selectedAction === 'aprovado' ? 'bg-green-100' : 'bg-slate-100'
                }`}>
                  <CheckCircle className={`w-5 h-5 ${selectedAction === 'aprovado' ? 'text-green-600' : 'text-slate-400'}`} />
                </div>
                <p className={`font-bold text-xs sm:text-sm ${selectedAction === 'aprovado' ? 'text-green-700' : 'text-slate-600'}`}>Aprovar</p>
              </button>

              <button
                onClick={() => setSelectedAction('rejeitado')}
                className={`p-4 rounded-2xl border-2 transition-all text-center ${
                  selectedAction === 'rejeitado'
                    ? 'border-red-500 bg-red-50 shadow-md shadow-red-100'
                    : 'border-slate-200 hover:border-red-300 bg-white hover:bg-red-50/50'
                }`}
              >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto mb-2 transition-colors ${
                  selectedAction === 'rejeitado' ? 'bg-red-100' : 'bg-slate-100'
                }`}>
                  <XCircle className={`w-5 h-5 ${selectedAction === 'rejeitado' ? 'text-red-600' : 'text-slate-400'}`} />
                </div>
                <p className={`font-bold text-xs sm:text-sm ${selectedAction === 'rejeitado' ? 'text-red-700' : 'text-slate-600'}`}>Rejeitar</p>
              </button>
            </div>

            {selectedAction && selectedAction !== 'aprovado' && (
              <div className="mb-5">
                <label className="block text-sm font-semibold text-slate-700 mb-2">
                  Motivo da rejeição:
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <textarea
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  className="w-full px-4 py-3 border border-slate-200 rounded-xl text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none bg-slate-50 placeholder-slate-400"
                  rows={4}
                  placeholder="Por favor, explique o motivo..."
                />
              </div>
            )}

            {selectedAction && (
              <button
                onClick={iniciarCapturaLocalizacaoESelfie}
                disabled={responding || capturandoLocalizacao}
                className={`w-full py-4 rounded-xl font-bold text-white transition-all disabled:opacity-50 flex items-center justify-center gap-2.5 shadow-lg ${
                  selectedAction === 'aprovado' ? 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 shadow-green-200' :
                  'bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 shadow-red-200'
                }`}
              >
                {capturandoLocalizacao ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Capturando localização...</>
                ) : responding ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Enviando...</>
                ) : (
                  <>
                    {selectedAction === 'aprovado' && <CheckCircle className="w-5 h-5" />}
                    {selectedAction === 'rejeitado' && <XCircle className="w-5 h-5" />}
                    {selectedAction === 'aprovado' ? 'Confirmar Aprovação' : 'Confirmar Rejeição'}
                  </>
                )}
              </button>
            )}

            {link.expires_at && (
              <div className="flex items-center justify-center gap-1.5 mt-4">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <p className="text-xs text-slate-400">
                  Link válido até {new Date(link.expires_at).toLocaleString('pt-BR')}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="text-center pb-6">
          <p className="text-xs text-slate-400">
            Documento gerado eletronicamente. Em caso de dúvidas, entre em contato com o Smart Center.
          </p>
        </div>

      </div>

      {/* Modal Camera */}
      {showCamera && !selfieCapturada && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
          <div className="max-w-lg w-full">
            <div className="bg-white rounded-2xl overflow-hidden shadow-2xl" style={{color:'#1e293b'}}>
              <div className="p-5 bg-gradient-to-r from-blue-600 to-blue-700">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Camera className="w-5 h-5" /> Tire uma Selfie
                </h3>
                <p className="text-sm text-blue-200 mt-1">Para confirmar sua identidade, precisamos de uma foto sua</p>
              </div>
              <div className="p-5">
                <div className="relative aspect-video bg-slate-900 rounded-xl overflow-hidden mb-5">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover transform scale-x-[-1]" />
                  {!cameraReady && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/60">
                      <div className="text-center">
                        <Loader2 className="w-8 h-8 text-white animate-spin mx-auto mb-2" />
                        <p className="text-white text-sm">Iniciando câmera...</p>
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => { if (stream) { stream.getTracks().forEach(t => t.stop()); setStream(null); } setShowCamera(false); setCameraReady(false); }}
                    className="flex-1 py-3 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all"
                  >Cancelar</button>
                  <button
                    onClick={tirarSelfie}
                    disabled={!cameraReady}
                    className="flex-1 py-3 rounded-xl font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Camera className="w-5 h-5" />
                    {cameraReady ? 'Tirar Foto' : 'Aguarde...'}
                  </button>
                </div>
              </div>
            </div>
          </div>
          <canvas ref={canvasRef} className="hidden" />
        </div>
      )}

      {/* Modal Selfie capturada */}
      {selfieCapturada && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4">
          <div className="max-w-lg w-full">
            <div className="bg-white rounded-2xl overflow-hidden shadow-2xl" style={{color:'#1e293b'}}>
              <div className="p-5 bg-gradient-to-r from-green-500 to-green-600">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" /> Foto Capturada!
                </h3>
                <p className="text-sm text-green-100 mt-1">Revise sua foto antes de enviar</p>
              </div>
              <div className="p-5">
                <div className="relative aspect-video bg-slate-900 rounded-xl overflow-hidden mb-5">
                  <img src={selfieCapturada} alt="Selfie" className="w-full h-full object-cover" />
                </div>
                <div className="flex gap-3">
                  <button onClick={refazerSelfie} className="flex-1 py-3 rounded-xl font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all">
                    Tirar Outra
                  </button>
                  <button
                    onClick={handleRespond}
                    disabled={responding}
                    className="flex-1 py-3 rounded-xl font-bold text-white bg-green-600 hover:bg-green-700 transition-all flex items-center justify-center gap-2"
                  >
                    {responding ? <><Loader2 className="w-5 h-5 animate-spin" /> Enviando...</> : <><CheckCircle className="w-5 h-5" /> Confirmar</>}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal foto expandida */}
      {selectedFoto && (
        <div className="fixed inset-0 bg-black/95 z-50 flex items-center justify-center p-4" onClick={() => setSelectedFoto(null)}>
          <button className="absolute top-4 right-4 w-10 h-10 bg-white/10 hover:bg-white/20 rounded-full flex items-center justify-center transition-all" onClick={() => setSelectedFoto(null)}>
            <XCircle className="w-6 h-6 text-white" />
          </button>
          <img src={selectedFoto} alt="Foto ampliada" className="max-w-full max-h-full object-contain rounded-2xl" onClick={(e) => e.stopPropagation()} />
        </div>
      )}
    </div>
  );
}
