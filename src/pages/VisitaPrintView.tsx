import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Printer, Loader2 } from 'lucide-react';

interface AgendamentoData {
  id: string;
  os_id: string;
  tecnico_id: string | null;
  data_agendamento: string | null;
  periodo: string | null;
  status: string;
  checkin_hora: string | null;
  checkout_hora: string | null;
  defeito_encontrado: string | null;
  diagnostico_tecnico: string | null;
  acao_realizada: string | null;
  resultado_visita: string | null;
  checkout_observacoes: string | null;
  tecnico?: { nome: string } | null;
}

interface OSData {
  numero_os_samsung: string | null;
  numero_os_interna: string | null;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  cliente_telefone_2: string | null;
  cliente_cpf_cnpj: string | null;
  cliente_email: string | null;
  cliente_logradouro: string | null;
  cliente_numero: string | null;
  cliente_bairro: string | null;
  cliente_cidade: string | null;
  cliente_estado: string | null;
  cliente_cep: string | null;
  endereco: string | null;
  bairro: string | null;
  cidade: string | null;
  aparelho_modelo: string | null;
  aparelho_linha: string | null;
  aparelho_imei: string | null;
  defeito_relatado: string | null;
  acessorios: string | null;
  tipo_atendimento: string | null;
  tipo_os: string | null;
  data_abertura: string | null;
  created_at: string;
  unidade?: {
    nome: string;
    cnpj: string | null;
    telefone: string | null;
    endereco: string | null;
    cidade: string | null;
    estado: string | null;
    samsung_asccode: string | null;
  } | null;
}

interface CheckoutRecord {
  fotos: string[] | null;
  assinatura_cliente: string | null;
  localizacao_endereco: string | null;
  data_hora: string | null;
  observacao: string | null;
}

export function VisitaPrintView() {
  const [searchParams] = useSearchParams();
  const agendamentoId = searchParams.get('agendamento_id');
  const osId = searchParams.get('os_id');

  const [loading, setLoading] = useState(true);
  const [agendamento, setAgendamento] = useState<AgendamentoData | null>(null);
  const [osData, setOsData] = useState<OSData | null>(null);
  const [checkout, setCheckout] = useState<CheckoutRecord | null>(null);
  const [visitPhotos, setVisitPhotos] = useState<string[]>([]);

  useEffect(() => {
    if (agendamentoId && osId) {
      loadData();
    }
  }, [agendamentoId, osId]);

  const loadData = async () => {
    try {
      const [agendRes, osRes, checkoutRes, photosRes] = await Promise.all([
        supabase
          .from('agendamentos')
          .select('*, tecnico:usuarios!agendamentos_tecnico_id_fkey(nome)')
          .eq('id', agendamentoId!)
          .maybeSingle(),
        supabase
          .from('os')
          .select('*, unidade:unidades!os_unidade_id_fkey(nome, cnpj, telefone, endereco, cidade, estado, samsung_asccode)')
          .eq('id', osId!)
          .maybeSingle(),
        supabase
          .from('agendamentos_checkin_checkout')
          .select('fotos, assinatura_cliente, localizacao_endereco, data_hora, observacao')
          .eq('agendamento_id', agendamentoId!)
          .eq('tipo', 'checkout')
          .maybeSingle(),
        supabase
          .from('os_anexos')
          .select('url')
          .eq('agendamento_id', agendamentoId!)
      ]);

      if (agendRes.data) setAgendamento(agendRes.data);
      if (osRes.data) setOsData(osRes.data);
      if (checkoutRes.data) setCheckout(checkoutRes.data);

      const allPhotos: string[] = [];
      if (checkoutRes.data?.fotos) {
        allPhotos.push(...checkoutRes.data.fotos);
      }
      if (photosRes.data) {
        photosRes.data.forEach((a: any) => {
          if (a.url && !allPhotos.includes(a.url)) allPhotos.push(a.url);
        });
      }
      setVisitPhotos(allPhotos);
    } catch (err) {
      console.error('Erro ao carregar dados da visita:', err);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (d: string | null) => {
    if (!d) return '-';
    return new Date(d.includes('T') ? d : d + 'T12:00:00').toLocaleDateString('pt-BR');
  };

  const formatDateTime = (d: string | null) => {
    if (!d) return '-';
    return new Date(d).toLocaleString('pt-BR');
  };

  const getResultadoLabel = (r: string | null) => {
    if (!r) return '-';
    const map: Record<string, string> = {
      'reparo_sucesso': 'Reparo com Sucesso',
      'peca_defeito': 'Peça com Defeito',
      'improdutiva_revisita': 'Improdutiva / Revisita',
      'voltar_peca': 'Voltar com Peça',
    };
    return map[r] || r;
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!agendamento || !osData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <p className="text-gray-500">Dados da visita não encontrados.</p>
      </div>
    );
  }

  const osLabel = osData.numero_os_samsung || osData.numero_os_interna || osId?.slice(0, 8) || '';
  const unidade = osData.unidade;
  const clienteEndereco = [
    osData.cliente_logradouro || osData.endereco,
    osData.cliente_numero,
    osData.cliente_bairro || osData.bairro,
    osData.cliente_cidade || osData.cidade,
    osData.cliente_estado
  ].filter(Boolean).join(', ');

  return (
    <div className="min-h-screen bg-gray-100 print:bg-white">
      {/* Print button - hidden on print */}
      <div className="fixed top-4 right-4 z-50 print:hidden flex gap-2">
        <button
          onClick={handlePrint}
          className="flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-lg shadow-lg hover:bg-gray-800 transition-colors font-medium"
        >
          <Printer className="w-4 h-4" />
          Imprimir
        </button>
      </div>

      {/* Page container */}
      <div className="max-w-[210mm] mx-auto bg-white shadow-lg print:shadow-none print:max-w-none">
        <div className="p-8 print:p-6">

          {/* Header */}
          <header className="border-b-2 border-gray-800 pb-4 mb-6">
            <div className="flex justify-between items-start">
              <div>
                {unidade && (
                  <>
                    <h1 className="text-xl font-bold text-gray-900">{unidade.nome}</h1>
                    {unidade.cnpj && (
                      <p className="text-xs text-gray-500 mt-0.5">CNPJ: {unidade.cnpj}</p>
                    )}
                    {unidade.endereco && (
                      <p className="text-xs text-gray-500">
                        {unidade.endereco}{unidade.cidade ? ` - ${unidade.cidade}` : ''}{unidade.estado ? `/${unidade.estado}` : ''}
                      </p>
                    )}
                    {unidade.telefone && (
                      <p className="text-xs text-gray-500">Tel: {unidade.telefone}</p>
                    )}
                  </>
                )}
              </div>
              <div className="text-right">
                <h2 className="text-lg font-bold text-gray-900 uppercase tracking-wide">
                  Relatório de Visita
                </h2>
                <p className="text-sm text-gray-600 mt-1">OS: <span className="font-semibold">{osLabel}</span></p>
                {unidade?.samsung_asccode && (
                  <p className="text-xs text-gray-500">ASC: {unidade.samsung_asccode}</p>
                )}
              </div>
            </div>
          </header>

          {/* Visit Info Section */}
          <section className="mb-6">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200 pb-1 mb-3">
              Informações da Visita
            </h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div className="flex">
                <span className="text-gray-500 w-36 shrink-0">Técnico:</span>
                <span className="text-gray-900 font-medium">{agendamento.tecnico?.nome || '-'}</span>
              </div>
              <div className="flex">
                <span className="text-gray-500 w-36 shrink-0">Data Agendamento:</span>
                <span className="text-gray-900">{formatDate(agendamento.data_agendamento)}</span>
              </div>
              <div className="flex">
                <span className="text-gray-500 w-36 shrink-0">Check-in:</span>
                <span className="text-gray-900">{formatDateTime(agendamento.checkin_hora)}</span>
              </div>
              <div className="flex">
                <span className="text-gray-500 w-36 shrink-0">Check-out:</span>
                <span className="text-gray-900">{formatDateTime(agendamento.checkout_hora)}</span>
              </div>
              <div className="flex col-span-2">
                <span className="text-gray-500 w-36 shrink-0">Resultado:</span>
                <span className="text-gray-900 font-semibold">{getResultadoLabel(agendamento.resultado_visita)}</span>
              </div>
            </div>
          </section>

          {/* Client Info */}
          <section className="mb-6">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200 pb-1 mb-3">
              Dados do Cliente
            </h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div className="flex">
                <span className="text-gray-500 w-36 shrink-0">Nome:</span>
                <span className="text-gray-900 font-medium">{osData.cliente_nome || '-'}</span>
              </div>
              <div className="flex">
                <span className="text-gray-500 w-36 shrink-0">CPF/CNPJ:</span>
                <span className="text-gray-900">{osData.cliente_cpf_cnpj || '-'}</span>
              </div>
              <div className="flex">
                <span className="text-gray-500 w-36 shrink-0">Telefone:</span>
                <span className="text-gray-900">{osData.cliente_telefone || '-'}</span>
              </div>
              <div className="flex">
                <span className="text-gray-500 w-36 shrink-0">Telefone 2:</span>
                <span className="text-gray-900">{osData.cliente_telefone_2 || '-'}</span>
              </div>
              {osData.cliente_email && (
                <div className="flex col-span-2">
                  <span className="text-gray-500 w-36 shrink-0">E-mail:</span>
                  <span className="text-gray-900">{osData.cliente_email}</span>
                </div>
              )}
              <div className="flex col-span-2">
                <span className="text-gray-500 w-36 shrink-0">Endereço:</span>
                <span className="text-gray-900">{clienteEndereco || '-'}</span>
              </div>
              {osData.cliente_cep && (
                <div className="flex">
                  <span className="text-gray-500 w-36 shrink-0">CEP:</span>
                  <span className="text-gray-900">{osData.cliente_cep}</span>
                </div>
              )}
            </div>
          </section>

          {/* Product Info */}
          <section className="mb-6">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200 pb-1 mb-3">
              Dados do Produto
            </h3>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div className="flex">
                <span className="text-gray-500 w-36 shrink-0">Modelo:</span>
                <span className="text-gray-900 font-medium">{osData.aparelho_modelo || '-'}</span>
              </div>
              <div className="flex">
                <span className="text-gray-500 w-36 shrink-0">Linha:</span>
                <span className="text-gray-900">{osData.aparelho_linha || '-'}</span>
              </div>
              {osData.aparelho_imei && (
                <div className="flex">
                  <span className="text-gray-500 w-36 shrink-0">IMEI/Serial:</span>
                  <span className="text-gray-900">{osData.aparelho_imei}</span>
                </div>
              )}
              <div className="flex">
                <span className="text-gray-500 w-36 shrink-0">Tipo Atendimento:</span>
                <span className="text-gray-900">{osData.tipo_atendimento || '-'}</span>
              </div>
              {osData.tipo_os && (
                <div className="flex">
                  <span className="text-gray-500 w-36 shrink-0">Tipo OS:</span>
                  <span className="text-gray-900">{osData.tipo_os}</span>
                </div>
              )}
              {osData.acessorios && (
                <div className="flex col-span-2">
                  <span className="text-gray-500 w-36 shrink-0">Acessórios:</span>
                  <span className="text-gray-900">{osData.acessorios}</span>
                </div>
              )}
              <div className="flex col-span-2">
                <span className="text-gray-500 w-36 shrink-0">Defeito Relatado:</span>
                <span className="text-gray-900">{osData.defeito_relatado || '-'}</span>
              </div>
            </div>
          </section>

          {/* Technical Report */}
          <section className="mb-6">
            <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200 pb-1 mb-3">
              Relatório Técnico da Visita
            </h3>
            <div className="space-y-4 text-sm">
              <div>
                <p className="text-gray-500 font-medium mb-1">Defeito Encontrado:</p>
                <p className="text-gray-900 bg-gray-50 rounded p-2 min-h-[2rem] print:bg-transparent print:border print:border-gray-200">
                  {agendamento.defeito_encontrado || '-'}
                </p>
              </div>
              <div>
                <p className="text-gray-500 font-medium mb-1">Diagnóstico Técnico:</p>
                <p className="text-gray-900 bg-gray-50 rounded p-2 min-h-[2rem] print:bg-transparent print:border print:border-gray-200">
                  {agendamento.diagnostico_tecnico || '-'}
                </p>
              </div>
              <div>
                <p className="text-gray-500 font-medium mb-1">Ação Realizada:</p>
                <p className="text-gray-900 bg-gray-50 rounded p-2 min-h-[2rem] print:bg-transparent print:border print:border-gray-200">
                  {agendamento.acao_realizada || '-'}
                </p>
              </div>
              {agendamento.checkout_observacoes && (
                <div>
                  <p className="text-gray-500 font-medium mb-1">Observações do Check-out:</p>
                  <p className="text-gray-900 bg-gray-50 rounded p-2 min-h-[2rem] print:bg-transparent print:border print:border-gray-200">
                    {agendamento.checkout_observacoes}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Photos */}
          {visitPhotos.length > 0 && (
            <section className="mb-6 break-inside-avoid">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200 pb-1 mb-3">
                Fotos da Visita
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {visitPhotos.map((url, i) => (
                  <div key={i} className="border border-gray-200 rounded overflow-hidden">
                    <img
                      src={url}
                      alt={`Foto ${i + 1}`}
                      className="w-full h-48 object-cover print:h-40"
                      crossOrigin="anonymous"
                    />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Signature */}
          {checkout?.assinatura_cliente && (
            <section className="mb-6 break-inside-avoid">
              <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wider border-b border-gray-200 pb-1 mb-3">
                Assinatura do Cliente
              </h3>
              <div className="border border-gray-200 rounded p-3 inline-block">
                <img
                  src={checkout.assinatura_cliente}
                  alt="Assinatura do cliente"
                  className="h-24 w-auto"
                  crossOrigin="anonymous"
                />
              </div>
              <p className="text-xs text-gray-500 mt-2">
                {osData.cliente_nome || 'Cliente'}
              </p>
            </section>
          )}

          {/* Footer */}
          <footer className="border-t border-gray-200 pt-4 mt-8 text-xs text-gray-400 flex justify-between">
            <span>Documento gerado em {new Date().toLocaleString('pt-BR')}</span>
            <span>{unidade?.nome || ''}</span>
          </footer>
        </div>
      </div>

      {/* Print styles */}
      <style>{`
        @media print {
          @page {
            margin: 10mm;
            size: A4;
          }
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
          }
          .break-inside-avoid {
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  );
}
