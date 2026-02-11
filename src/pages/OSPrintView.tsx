import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Printer, Loader2, Download } from 'lucide-react';

interface OSPeca {
  pn: string;
  descricao: string;
  quantidade: number;
  valor_unitario?: number;
  valor_final_unitario?: number;
  valor_total?: number;
  exibir_no_pdf?: boolean;
  status?: string;
}

interface OSServico {
  descricao: string;
  quantidade: number;
  valor_unitario: number;
  valor_total: number;
}

interface Pagamento {
  valor: number;
  forma_pagamento: string;
  data_lancamento: string | null;
  observacoes?: string | null;
}

interface Anexo {
  id: string;
  nome_arquivo: string;
  url: string;
  tipo: string;
  exibir_no_pdf: boolean;
}

interface OSData {
  numero_os_samsung: string | null;
  numero_os_interna: string | null;
  cliente_nome: string;
  cliente_logradouro: string | null;
  cliente_numero: string | null;
  cliente_bairro: string | null;
  cliente_cidade: string | null;
  cliente_estado: string | null;
  cliente_cep: string | null;
  cliente_telefone: string | null;
  cliente_telefone_2: string | null;
  cliente_email: string | null;
  cliente_cpf_cnpj: string | null;
  aparelho_modelo: string | null;
  aparelho_linha: string | null;
  aparelho_imei: string | null;
  defeito_relatado: string | null;
  diagnostico_tecnico: string | null;
  observacoes_internas: string | null;
  descricao_reparo: string | null;
  reparo_efetuado: string | null;
  acessorios: string | null;
  tipo_atendimento: 'IH' | 'CI';
  tipo_os: 'LP' | 'OW';
  tipo_orcamento: string | null;
  status_garantia: string | null;
  data_abertura: string | null;
  data_agendamento: string | null;
  data_compra: string | null;
  created_at: string;
  unidade: {
    nome: string;
    samsung_asccode: string | null;
    telefone: string | null;
    endereco?: string | null;
    cidade?: string | null;
    estado?: string | null;
    cnpj?: string | null;
  };
  os_pecas?: OSPeca[];
  cotacoes_pecas?: OSPeca[];
  os_servicos?: OSServico[];
  cotacoes_servicos?: OSServico[];
  pagamentos?: Pagamento[];
  anexos_pdf?: Anexo[];
  valor_total: number | null;
  valor_pago: number | null;
  saldo_restante: number | null;
  status_pagamento: string | null;
  desconto_tipo: 'valor' | 'percentual' | null;
  desconto_valor: number | null;
  valor_desconto_calculado: number | null;
}

interface PDFConfig {
  termo_orcamento: string;
  termo_garantia: string;
  canais_atendimento: string;
  observacoes_gerais: string;
  logo_url: string | null;
  rodape_personalizado: string | null;
}

const ACCENT = '#0C4DA2';
const ACCENT_LIGHT = '#E8F0FE';

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      className="text-sm font-bold uppercase tracking-wider mb-3 pb-1.5 flex items-center gap-2"
      style={{ color: ACCENT, borderBottom: `2px solid ${ACCENT}` }}
    >
      {children}
    </h2>
  );
}

function InfoLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500 mb-0.5">{children}</p>;
}

function InfoValue({ children, bold }: { children: React.ReactNode; bold?: boolean }) {
  return <p className={`text-sm text-gray-900 ${bold ? 'font-bold' : ''}`}>{children}</p>;
}

export function OSPrintView() {
  const [searchParams] = useSearchParams();
  const osId = searchParams.get('osId');
  const [os, setOS] = useState<OSData | null>(null);
  const [config, setConfig] = useState<PDFConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);

  useEffect(() => {
    if (osId) {
      loadData();
    } else {
      setLoading(false);
      setError('ID da OS nao fornecido');
    }
  }, [osId]);

  const loadData = async () => {
    try {
      const { data: osData, error: osError } = await supabase
        .from('os')
        .select(`
          *,
          unidade:unidades(nome, samsung_asccode, telefone, endereco, cidade, estado, cnpj),
          os_pecas(pn, descricao, quantidade, valor_unitario, valor_total, exibir_no_pdf, status),
          os_servicos(descricao, quantidade, valor_unitario, valor_total),
          cotacoes_pecas(pn, descricao, quantidade, valor_final_unitario, valor_total, exibir_no_pdf),
          cotacoes_servicos(descricao, quantidade, valor_unitario, valor_total),
          pagamentos(valor, forma_pagamento, data_lancamento, observacoes)
        `)
        .eq('id', osId)
        .maybeSingle();

      if (osError) {
        setError(`Erro ao buscar OS: ${osError.message}`);
        throw osError;
      }

      if (!osData) {
        setError('Ordem de servico nao encontrada');
        setLoading(false);
        return;
      }

      const { data: reqPecas } = await supabase
        .from('requisicoes_pecas')
        .select('pn:codigo_peca, descricao, quantidade:quantidade_requisitada, exibir_no_pdf')
        .eq('os_id', osId!)
        .not('status', 'eq', 'cancelada');

      const existingPNs = new Set([
        ...(osData.os_pecas || []).map((p: any) => p.pn),
        ...(osData.cotacoes_pecas || []).map((p: any) => p.pn)
      ]);
      const extraReqPecas = (reqPecas || [])
        .filter((p: any) => !existingPNs.has(p.pn))
        .map((p: any) => ({
          pn: p.pn,
          descricao: p.descricao,
          quantidade: p.quantidade,
          valor_unitario: 0,
          valor_total: 0,
          exibir_no_pdf: p.exibir_no_pdf !== false
        }));
      if (extraReqPecas.length > 0) {
        osData.os_pecas = [...(osData.os_pecas || []), ...extraReqPecas];
      }

      const { data: anexos } = await supabase
        .from('os_anexos')
        .select('id, nome_arquivo, url, tipo, exibir_no_pdf')
        .eq('os_id', osId!)
        .eq('exibir_no_pdf', true);

      const urls: string[] = [];
      if (anexos && anexos.length > 0) {
        for (const anexo of anexos) {
          if (anexo.url) {
            const isImage = /\.(jpg|jpeg|png|gif|webp|bmp)$/i.test(anexo.nome_arquivo) ||
                           anexo.tipo === 'foto';
            if (isImage) {
              const urlParts = anexo.url.split('/os-anexos/');
              if (urlParts.length > 1) {
                const { data: signedData } = await supabase.storage
                  .from('os-anexos')
                  .createSignedUrl(urlParts[1], 3600);
                if (signedData?.signedUrl) {
                  urls.push(signedData.signedUrl);
                }
              } else {
                urls.push(anexo.url);
              }
            }
          }
        }
      }
      setPhotoUrls(urls);

      const { data: pdfConfig } = await supabase
        .from('configuracoes_pdf_os')
        .select('*')
        .or(`unidade_id.eq.${osData.unidade_id},unidade_id.is.null`)
        .order('unidade_id', { ascending: false })
        .limit(1)
        .maybeSingle();

      setOS(osData as any);
      setConfig(pdfConfig);
    } catch (error: any) {
      setError(error.message || 'Erro desconhecido');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (value: number | null | undefined) => {
    if (!value) return 'R$ 0,00';
    return `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (date: string | null) => {
    if (!date) return '-';
    return new Date(date).toLocaleDateString('pt-BR');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando ordem de servico...</p>
        </div>
      </div>
    );
  }

  if (!os || error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center">
          <p className="text-red-600 font-medium mb-2">{error || 'Ordem de servico nao encontrada'}</p>
          <p className="text-gray-500 text-sm">OS ID: {osId || 'nao fornecido'}</p>
        </div>
      </div>
    );
  }

  const isLP = os.tipo_os === 'LP';

  const allPecas = [
    ...(os.os_pecas || []),
    ...(os.cotacoes_pecas || []).filter(cp =>
      !(os.os_pecas || []).some(op => op.pn === cp.pn)
    )
  ];
  const pecas = allPecas.filter(p => p.exibir_no_pdf !== false);
  const servicos = os.os_servicos?.length ? os.os_servicos : os.cotacoes_servicos || [];

  const endereco = [
    os.cliente_logradouro,
    os.cliente_numero ? `N ${os.cliente_numero}` : null,
    os.cliente_bairro,
    os.cliente_cidade,
    os.cliente_estado,
    os.cliente_cep
  ].filter(Boolean).join(', ') || '-';

  return (
    <>
      <style>{`
        @media print {
          .no-print { display: none !important; }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
            margin: 0;
            padding: 0;
          }
          .print-content {
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
          }
          .photo-grid img {
            break-inside: avoid;
          }
        }
        @page { margin: 10mm; size: A4; }
        @media screen {
          .print-content { margin-top: 0; }
        }
      `}</style>

      <div className="min-h-screen bg-gray-100">
        <div className="no-print py-4 px-4 max-w-[210mm] mx-auto flex gap-3">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-6 py-3 text-white rounded-lg transition-colors font-medium"
            style={{ backgroundColor: ACCENT }}
          >
            <Printer className="w-5 h-5" />
            Imprimir
          </button>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 px-6 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-medium"
          >
            <Download className="w-5 h-5" />
            Salvar PDF
          </button>
        </div>

        <div className="max-w-[210mm] mx-auto bg-white shadow-lg print-content" style={{ fontFamily: "'Segoe UI', Arial, sans-serif" }}>
          <div className="px-8 pt-6 pb-4">

            {/* ===== HEADER ===== */}
            <div className="flex items-center justify-between mb-5 pb-4" style={{ borderBottom: `3px solid ${ACCENT}` }}>
              <div className="flex items-center gap-4">
                <img
                  src="/1_-_logo_transparente_preto_2.png"
                  alt="Logo"
                  className="h-14 object-contain"
                />
                <div>
                  <p className="text-base font-bold text-gray-900 leading-tight">{os.unidade?.nome}</p>
                  {os.unidade?.cnpj && (
                    <p className="text-[11px] text-gray-500">CNPJ: {os.unidade.cnpj}</p>
                  )}
                  {os.unidade?.telefone && (
                    <p className="text-[11px] text-gray-500">Tel: {os.unidade.telefone}</p>
                  )}
                  {os.unidade?.endereco && (
                    <p className="text-[11px] text-gray-500">
                      {os.unidade.endereco}, {os.unidade.cidade} - {os.unidade.estado}
                    </p>
                  )}
                </div>
              </div>
              <div className="text-right flex flex-col gap-1">
                <div className="px-3 py-1.5 rounded text-white text-center" style={{ backgroundColor: ACCENT }}>
                  <p className="text-[9px] font-medium uppercase tracking-wider opacity-80">OS Interna</p>
                  <p className="text-sm font-bold leading-tight">{os.numero_os_interna || '-'}</p>
                </div>
                {os.numero_os_samsung && (
                  <div className="px-3 py-1.5 rounded text-center" style={{ backgroundColor: ACCENT_LIGHT }}>
                    <p className="text-[9px] font-medium uppercase tracking-wider text-gray-500">OS Samsung</p>
                    <p className="text-sm font-bold leading-tight" style={{ color: ACCENT }}>{os.numero_os_samsung}</p>
                  </div>
                )}
                <p className="text-[10px] text-gray-400 mt-0.5">
                  {formatDate(os.data_abertura || os.created_at)}
                </p>
              </div>
            </div>

            {/* ===== DADOS DO CLIENTE ===== */}
            <div className="mb-5">
              <SectionTitle>Dados do Cliente</SectionTitle>
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <div className="grid grid-cols-2" style={{ backgroundColor: ACCENT_LIGHT }}>
                  <div className="px-3 py-2 border-b border-r border-gray-200">
                    <InfoLabel>Nome</InfoLabel>
                    <InfoValue bold>{os.cliente_nome}</InfoValue>
                  </div>
                  <div className="px-3 py-2 border-b border-gray-200">
                    <InfoLabel>CPF/CNPJ</InfoLabel>
                    <InfoValue>{os.cliente_cpf_cnpj || '-'}</InfoValue>
                  </div>
                </div>
                <div className="grid grid-cols-3">
                  <div className="px-3 py-2 border-b border-r border-gray-200">
                    <InfoLabel>Telefone</InfoLabel>
                    <InfoValue>{os.cliente_telefone || '-'}</InfoValue>
                  </div>
                  <div className="px-3 py-2 border-b border-r border-gray-200">
                    <InfoLabel>Telefone 2</InfoLabel>
                    <InfoValue>{os.cliente_telefone_2 || '-'}</InfoValue>
                  </div>
                  <div className="px-3 py-2 border-b border-gray-200">
                    <InfoLabel>Email</InfoLabel>
                    <InfoValue>{os.cliente_email || '-'}</InfoValue>
                  </div>
                </div>
                <div className="px-3 py-2">
                  <InfoLabel>Endereco</InfoLabel>
                  <InfoValue>{endereco}</InfoValue>
                </div>
              </div>
            </div>

            {/* ===== DADOS DO APARELHO ===== */}
            <div className="mb-5">
              <SectionTitle>Dados do Aparelho</SectionTitle>
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <div className="grid grid-cols-3">
                  <div className="px-3 py-2 border-b border-r border-gray-200" style={{ backgroundColor: ACCENT_LIGHT }}>
                    <InfoLabel>Modelo</InfoLabel>
                    <InfoValue bold>{os.aparelho_modelo || '-'}</InfoValue>
                  </div>
                  <div className="px-3 py-2 border-b border-r border-gray-200">
                    <InfoLabel>Linha</InfoLabel>
                    <InfoValue>{os.aparelho_linha || '-'}</InfoValue>
                  </div>
                  <div className="px-3 py-2 border-b border-gray-200">
                    <InfoLabel>IMEI / SN</InfoLabel>
                    <InfoValue>{os.aparelho_imei || '-'}</InfoValue>
                  </div>
                </div>
                <div className="grid grid-cols-3">
                  <div className="px-3 py-2 border-r border-gray-200">
                    <InfoLabel>Tipo Servico</InfoLabel>
                    <InfoValue>{os.tipo_atendimento === 'IH' ? 'In Home' : 'Carry In'}</InfoValue>
                  </div>
                  <div className="px-3 py-2 border-r border-gray-200">
                    <InfoLabel>Tipo OS</InfoLabel>
                    <InfoValue>{os.tipo_os === 'LP' ? 'LP (Garantia)' : 'OW (Fora Garantia)'}</InfoValue>
                  </div>
                  <div className="px-3 py-2">
                    <InfoLabel>Data Compra</InfoLabel>
                    <InfoValue>{formatDate(os.data_compra)}</InfoValue>
                  </div>
                </div>
                {os.acessorios && (
                  <div className="px-3 py-2 border-t border-gray-200">
                    <InfoLabel>Acessorios</InfoLabel>
                    <InfoValue>{os.acessorios}</InfoValue>
                  </div>
                )}
              </div>
            </div>

            {/* ===== SERVICO ===== */}
            <div className="mb-5">
              <SectionTitle>Informacoes do Servico</SectionTitle>
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <div className="px-3 py-2.5 border-b border-gray-200" style={{ backgroundColor: ACCENT_LIGHT }}>
                  <InfoLabel>Defeito Relatado</InfoLabel>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{os.defeito_relatado || '-'}</p>
                </div>
                <div className="px-3 py-2.5 border-b border-gray-200">
                  <InfoLabel>Diagnostico Tecnico</InfoLabel>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{os.diagnostico_tecnico || '-'}</p>
                </div>
                <div className="px-3 py-2.5 border-b border-gray-200" style={{ backgroundColor: ACCENT_LIGHT }}>
                  <InfoLabel>Reparo Efetuado</InfoLabel>
                  <p className="text-sm text-gray-900 whitespace-pre-wrap">{os.descricao_reparo || os.reparo_efetuado || '-'}</p>
                </div>
                {os.observacoes_internas && (
                  <div className="px-3 py-2.5">
                    <InfoLabel>Observacoes</InfoLabel>
                    <p className="text-sm text-gray-900 whitespace-pre-wrap">{os.observacoes_internas}</p>
                  </div>
                )}
              </div>
            </div>

            {/* ===== PECAS ===== */}
            {pecas.length > 0 && (
              <div className="mb-5">
                <SectionTitle>Pecas Utilizadas</SectionTitle>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr style={{ backgroundColor: ACCENT }}>
                      <th className="px-3 py-2 text-left font-semibold text-white text-xs">PN</th>
                      <th className="px-3 py-2 text-left font-semibold text-white text-xs">Descricao</th>
                      <th className="px-3 py-2 text-center font-semibold text-white text-xs">Qtd</th>
                      {!isLP && <th className="px-3 py-2 text-right font-semibold text-white text-xs">Valor Unit.</th>}
                      {!isLP && <th className="px-3 py-2 text-right font-semibold text-white text-xs">Total</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {pecas.map((peca, idx) => (
                      <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#FFFFFF' : ACCENT_LIGHT }}>
                        <td className="border-b border-gray-200 px-3 py-1.5 text-gray-900 font-medium text-xs">{peca.pn}</td>
                        <td className="border-b border-gray-200 px-3 py-1.5 text-gray-900 text-xs">{peca.descricao}</td>
                        <td className="border-b border-gray-200 px-3 py-1.5 text-center text-gray-900 text-xs">{peca.quantidade}</td>
                        {!isLP && (
                          <td className="border-b border-gray-200 px-3 py-1.5 text-right text-gray-900 text-xs">
                            {formatCurrency(peca.valor_unitario || peca.valor_final_unitario)}
                          </td>
                        )}
                        {!isLP && (
                          <td className="border-b border-gray-200 px-3 py-1.5 text-right text-gray-900 font-semibold text-xs">
                            {formatCurrency(peca.valor_total || (peca.quantidade * (peca.valor_unitario || peca.valor_final_unitario || 0)))}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                  {!isLP && (
                    <tfoot>
                      <tr style={{ backgroundColor: ACCENT_LIGHT }}>
                        <td colSpan={4} className="px-3 py-2 text-right font-bold text-xs" style={{ color: ACCENT }}>TOTAL PECAS:</td>
                        <td className="px-3 py-2 text-right font-bold text-xs" style={{ color: ACCENT }}>
                          {formatCurrency(pecas.reduce((sum, p) => sum + (p.valor_total || (p.quantidade * (p.valor_unitario || p.valor_final_unitario || 0))), 0))}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            )}

            {/* ===== SERVICOS ===== */}
            {!isLP && servicos.length > 0 && (
              <div className="mb-5">
                <SectionTitle>Servicos Realizados</SectionTitle>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr style={{ backgroundColor: ACCENT }}>
                      <th className="px-3 py-2 text-left font-semibold text-white text-xs">Descricao</th>
                      <th className="px-3 py-2 text-center font-semibold text-white text-xs">Qtd</th>
                      <th className="px-3 py-2 text-right font-semibold text-white text-xs">Valor Unit.</th>
                      <th className="px-3 py-2 text-right font-semibold text-white text-xs">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {servicos.map((servico, idx) => (
                      <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#FFFFFF' : ACCENT_LIGHT }}>
                        <td className="border-b border-gray-200 px-3 py-1.5 text-gray-900 text-xs">{servico.descricao}</td>
                        <td className="border-b border-gray-200 px-3 py-1.5 text-center text-gray-900 text-xs">{servico.quantidade}</td>
                        <td className="border-b border-gray-200 px-3 py-1.5 text-right text-gray-900 text-xs">{formatCurrency(servico.valor_unitario)}</td>
                        <td className="border-b border-gray-200 px-3 py-1.5 text-right text-gray-900 font-semibold text-xs">{formatCurrency(servico.valor_total)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr style={{ backgroundColor: ACCENT_LIGHT }}>
                      <td colSpan={3} className="px-3 py-2 text-right font-bold text-xs" style={{ color: ACCENT }}>TOTAL SERVICOS:</td>
                      <td className="px-3 py-2 text-right font-bold text-xs" style={{ color: ACCENT }}>
                        {formatCurrency(servicos.reduce((sum, s) => sum + s.valor_total, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* ===== PAGAMENTOS ===== */}
            {!isLP && os.pagamentos && os.pagamentos.length > 0 && (
              <div className="mb-5">
                <SectionTitle>Pagamentos</SectionTitle>
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr style={{ backgroundColor: ACCENT }}>
                      <th className="px-3 py-2 text-left font-semibold text-white text-xs">Data</th>
                      <th className="px-3 py-2 text-left font-semibold text-white text-xs">Forma</th>
                      <th className="px-3 py-2 text-right font-semibold text-white text-xs">Valor</th>
                      <th className="px-3 py-2 text-left font-semibold text-white text-xs">Obs</th>
                    </tr>
                  </thead>
                  <tbody>
                    {os.pagamentos.map((pag, idx) => (
                      <tr key={idx} style={{ backgroundColor: idx % 2 === 0 ? '#FFFFFF' : ACCENT_LIGHT }}>
                        <td className="border-b border-gray-200 px-3 py-1.5 text-gray-900 text-xs">{formatDate(pag.data_lancamento)}</td>
                        <td className="border-b border-gray-200 px-3 py-1.5 text-gray-900 text-xs capitalize">{pag.forma_pagamento.replace(/_/g, ' ')}</td>
                        <td className="border-b border-gray-200 px-3 py-1.5 text-right text-gray-900 font-semibold text-xs">{formatCurrency(pag.valor)}</td>
                        <td className="border-b border-gray-200 px-3 py-1.5 text-gray-900 text-xs">{pag.observacoes || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ===== RESUMO FINANCEIRO ===== */}
            {!isLP && (
            <div className="mb-5">
              <div className="rounded-lg overflow-hidden border" style={{ borderColor: ACCENT }}>
                <div className="px-4 py-2 text-white text-xs font-bold uppercase tracking-wider" style={{ backgroundColor: ACCENT }}>
                  Resumo Financeiro
                </div>
                <div className="px-4 py-3">
                  {(() => {
                    const subtotal = (os.valor_total || 0) + (os.valor_desconto_calculado || 0);
                    const temDesconto = os.valor_desconto_calculado && os.valor_desconto_calculado > 0;
                    return (
                      <div className="space-y-1.5">
                        {temDesconto && (
                          <>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-gray-600">Subtotal:</span>
                              <span className="font-medium text-gray-700">{formatCurrency(subtotal)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-gray-600">
                                Desconto {os.desconto_tipo === 'percentual' ? `(${os.desconto_valor}%)` : ''}:
                              </span>
                              <span className="font-medium text-red-600">- {formatCurrency(os.valor_desconto_calculado)}</span>
                            </div>
                          </>
                        )}
                        <div className={`flex justify-between items-center ${temDesconto ? 'pt-2 border-t border-gray-200' : ''}`}>
                          <span className="text-sm font-bold text-gray-800">Valor Total:</span>
                          <span className="text-lg font-bold" style={{ color: ACCENT }}>{formatCurrency(os.valor_total)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-gray-600">Valor Pago:</span>
                          <span className="font-bold text-green-700">{formatCurrency(os.valor_pago)}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm pt-1.5 border-t border-gray-200">
                          <span className="font-bold text-gray-800">Saldo Restante:</span>
                          <span className="font-bold text-red-700">{formatCurrency(os.saldo_restante)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>
            )}

            {/* ===== FOTOS ===== */}
            {photoUrls.length > 0 && (
              <div className="mb-5">
                <SectionTitle>Registro Fotografico</SectionTitle>
                <div className="photo-grid grid grid-cols-2 gap-3">
                  {photoUrls.map((url, idx) => (
                    <div key={idx} className="rounded-lg overflow-hidden border border-gray-200">
                      <img
                        src={url}
                        alt={`Foto ${idx + 1}`}
                        className="w-full h-48 object-cover"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ===== TERMOS ===== */}
            {config?.termo_orcamento && (
              <div className="mb-4 text-[10px] text-gray-500 leading-relaxed border-t border-gray-200 pt-3">
                <p className="font-bold text-xs text-gray-700 mb-1">Termos do Orcamento:</p>
                <div className="whitespace-pre-line">{config.termo_orcamento}</div>
              </div>
            )}

            {config?.termo_garantia && (
              <div className="mb-4 text-[10px] text-gray-500 leading-relaxed">
                <p className="font-bold text-xs text-gray-700 mb-1">Termos de Garantia:</p>
                <div className="whitespace-pre-line">{config.termo_garantia}</div>
              </div>
            )}

            {config?.canais_atendimento && (
              <div className="mb-4 text-[10px] text-gray-500 leading-relaxed">
                <p className="font-bold text-xs text-gray-700 mb-1">Canais de Atendimento:</p>
                <div className="whitespace-pre-line">{config.canais_atendimento}</div>
              </div>
            )}

            {config?.observacoes_gerais && (
              <div className="mb-4 text-[10px] text-gray-500 leading-relaxed">
                <p className="font-bold text-xs text-gray-700 mb-1">Observacoes Gerais:</p>
                <div className="whitespace-pre-line">{config.observacoes_gerais}</div>
              </div>
            )}

            {/* ===== ASSINATURA ===== */}
            <div className="mt-10 pt-6 border-t-2" style={{ borderColor: ACCENT }}>
              <div className="grid grid-cols-2 gap-12">
                <div className="text-center pt-12">
                  <div className="border-t-2 border-gray-400 pt-2 mx-4">
                    <p className="text-xs font-semibold text-gray-700">Assinatura do Cliente</p>
                    <p className="text-[10px] text-gray-400">{os.cliente_nome}</p>
                  </div>
                </div>
                <div className="text-center pt-12">
                  <div className="border-t-2 border-gray-400 pt-2 mx-4">
                    <p className="text-xs font-semibold text-gray-700">Assinatura do Responsavel</p>
                    <p className="text-[10px] text-gray-400">{os.unidade?.nome}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* ===== RODAPE ===== */}
            {config?.rodape_personalizado && (
              <div className="mt-6 pt-3 border-t border-gray-200 text-center text-[9px] text-gray-400">
                <div className="whitespace-pre-line">{config.rodape_personalizado}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
