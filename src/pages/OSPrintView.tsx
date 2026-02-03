import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Printer, Loader2 } from 'lucide-react';

interface OSPeca {
  pn: string;
  descricao: string;
  quantidade: number;
  valor_unitario?: number;
  valor_total?: number;
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
  data_pagamento: string | null;
  observacoes?: string | null;
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
  observacoes_internas: string | null;
  descricao_reparo: string | null;
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
  };
  os_pecas?: OSPeca[];
  cotacoes_pecas?: OSPeca[];
  os_servicos?: OSServico[];
  cotacoes_servicos?: OSServico[];
  pagamentos?: Pagamento[];
  valor_total: number | null;
  valor_pago: number | null;
  saldo_restante: number | null;
  status_pagamento: string | null;
}

interface PDFConfig {
  termo_orcamento: string;
  termo_garantia: string;
  canais_atendimento: string;
  observacoes_gerais: string;
  logo_url: string | null;
  rodape_personalizado: string | null;
}

export function OSPrintView() {
  const [searchParams] = useSearchParams();
  const osId = searchParams.get('osId');
  const [os, setOS] = useState<OSData | null>(null);
  const [config, setConfig] = useState<PDFConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (osId) {
      loadData();
    }
  }, [osId]);

  const loadData = async () => {
    try {
      const { data: osData, error: osError } = await supabase
        .from('os')
        .select(`
          *,
          unidade:unidades(nome, samsung_asccode, telefone, endereco, cidade, estado),
          os_pecas(pn, descricao, quantidade, valor_unitario, valor_total),
          os_servicos(descricao, quantidade, valor_unitario, valor_total),
          cotacoes_pecas(pn, descricao, quantidade, valor_unitario, valor_total),
          cotacoes_servicos(descricao, quantidade, valor_unitario, valor_total),
          pagamentos(valor, forma_pagamento, data_pagamento, observacoes)
        `)
        .eq('id', osId)
        .maybeSingle();

      if (osError) throw osError;

      const { data: pdfConfig, error: configError } = await supabase
        .from('configuracoes_pdf_os')
        .select('*')
        .eq('unidade_id', osData?.unidade_id)
        .maybeSingle();

      if (configError) throw configError;

      setOS(osData as any);
      setConfig(pdfConfig);
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
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

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Carregando ordem de serviço...</p>
        </div>
      </div>
    );
  }

  if (!os) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <p className="text-gray-600">Ordem de serviço não encontrada</p>
      </div>
    );
  }

  const pecas = os.os_pecas?.length ? os.os_pecas : os.cotacoes_pecas || [];
  const servicos = os.os_servicos?.length ? os.os_servicos : os.cotacoes_servicos || [];

  return (
    <>
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .page-break {
            page-break-before: always;
          }
        }
        @page {
          margin: 1cm;
          size: A4;
        }
      `}</style>

      <div className="min-h-screen bg-gray-100 py-8 no-print">
        <div className="max-w-4xl mx-auto px-4 mb-4">
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            <Printer className="w-5 h-5" />
            Imprimir
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto bg-white shadow-lg" style={{ fontFamily: 'Arial, sans-serif' }}>
        <div className="p-8">
          {/* Header com Logo */}
          <div className="flex items-start justify-between mb-8 pb-6 border-b-2 border-gray-300">
            <div>
              {config?.logo_url && (
                <img src={config.logo_url} alt="Logo" className="h-16 mb-4" />
              )}
              <h1 className="text-2xl font-bold text-gray-800 mb-2">
                {os.unidade?.nome || 'Ordem de Serviço'}
              </h1>
              {os.unidade?.samsung_asccode && (
                <p className="text-sm text-gray-600">ASC Code: {os.unidade.samsung_asccode}</p>
              )}
              {os.unidade?.telefone && (
                <p className="text-sm text-gray-600">Tel: {os.unidade.telefone}</p>
              )}
              {os.unidade?.endereco && (
                <p className="text-sm text-gray-600">
                  {os.unidade.endereco}, {os.unidade.cidade} - {os.unidade.estado}
                </p>
              )}
            </div>
            <div className="text-right">
              <div className="bg-blue-600 text-white px-4 py-2 rounded-lg mb-2">
                <p className="text-xs font-medium">OS INTERNA</p>
                <p className="text-xl font-bold">{os.numero_os_interna || '-'}</p>
              </div>
              {os.numero_os_samsung && (
                <div className="bg-gray-100 px-4 py-2 rounded-lg">
                  <p className="text-xs font-medium text-gray-600">OS SAMSUNG</p>
                  <p className="text-lg font-bold text-gray-800">{os.numero_os_samsung}</p>
                </div>
              )}
              <p className="text-xs text-gray-500 mt-2">
                Data: {formatDate(os.created_at)}
              </p>
            </div>
          </div>

          {/* Informações do Cliente */}
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-800 mb-3 pb-2 border-b border-gray-300">
              Dados do Cliente
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600 font-medium">Nome:</p>
                <p className="text-gray-800">{os.cliente_nome}</p>
              </div>
              <div>
                <p className="text-gray-600 font-medium">CPF/CNPJ:</p>
                <p className="text-gray-800">{os.cliente_cpf_cnpj || '-'}</p>
              </div>
              <div>
                <p className="text-gray-600 font-medium">Telefone:</p>
                <p className="text-gray-800">{os.cliente_telefone || '-'}</p>
              </div>
              <div>
                <p className="text-gray-600 font-medium">Email:</p>
                <p className="text-gray-800">{os.cliente_email || '-'}</p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-600 font-medium">Endereço:</p>
                <p className="text-gray-800">
                  {[
                    os.cliente_logradouro,
                    os.cliente_numero,
                    os.cliente_bairro,
                    os.cliente_cidade,
                    os.cliente_estado,
                    os.cliente_cep
                  ].filter(Boolean).join(', ') || '-'}
                </p>
              </div>
            </div>
          </div>

          {/* Informações do Aparelho */}
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-800 mb-3 pb-2 border-b border-gray-300">
              Dados do Aparelho
            </h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600 font-medium">Modelo:</p>
                <p className="text-gray-800">{os.aparelho_modelo || '-'}</p>
              </div>
              <div>
                <p className="text-gray-600 font-medium">Linha:</p>
                <p className="text-gray-800">{os.aparelho_linha || '-'}</p>
              </div>
              <div>
                <p className="text-gray-600 font-medium">IMEI/SN:</p>
                <p className="text-gray-800">{os.aparelho_imei || '-'}</p>
              </div>
              <div>
                <p className="text-gray-600 font-medium">Tipo:</p>
                <p className="text-gray-800">
                  {os.tipo_atendimento === 'IH' ? 'In Home' : 'Carry In'} - {os.tipo_os === 'LP' ? 'LP' : 'OW'}
                </p>
              </div>
              {os.acessorios && (
                <div className="col-span-2">
                  <p className="text-gray-600 font-medium">Acessórios:</p>
                  <p className="text-gray-800">{os.acessorios}</p>
                </div>
              )}
            </div>
          </div>

          {/* Defeito e Reparo */}
          <div className="mb-6">
            <h2 className="text-lg font-bold text-gray-800 mb-3 pb-2 border-b border-gray-300">
              Informações do Serviço
            </h2>
            {os.defeito_relatado && (
              <div className="mb-3">
                <p className="text-gray-600 font-medium text-sm">Defeito Relatado:</p>
                <p className="text-gray-800 text-sm">{os.defeito_relatado}</p>
              </div>
            )}
            {os.descricao_reparo && (
              <div className="mb-3">
                <p className="text-gray-600 font-medium text-sm">Descrição do Reparo:</p>
                <p className="text-gray-800 text-sm">{os.descricao_reparo}</p>
              </div>
            )}
            {os.observacoes_internas && (
              <div>
                <p className="text-gray-600 font-medium text-sm">Observações:</p>
                <p className="text-gray-800 text-sm">{os.observacoes_internas}</p>
              </div>
            )}
          </div>

          {/* Peças */}
          {pecas.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-800 mb-3 pb-2 border-b border-gray-300">
                Peças Utilizadas
              </h2>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-3 py-2 text-left">PN</th>
                    <th className="border border-gray-300 px-3 py-2 text-left">Descrição</th>
                    <th className="border border-gray-300 px-3 py-2 text-center">Qtd</th>
                    <th className="border border-gray-300 px-3 py-2 text-right">Valor Unit.</th>
                    <th className="border border-gray-300 px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {pecas.map((peca, idx) => (
                    <tr key={idx}>
                      <td className="border border-gray-300 px-3 py-2">{peca.pn}</td>
                      <td className="border border-gray-300 px-3 py-2">{peca.descricao}</td>
                      <td className="border border-gray-300 px-3 py-2 text-center">{peca.quantidade}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right">
                        {formatCurrency(peca.valor_unitario)}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-right">
                        {formatCurrency(peca.valor_total || (peca.quantidade * (peca.valor_unitario || 0)))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Serviços */}
          {servicos.length > 0 && (
            <div className="mb-6">
              <h2 className="text-lg font-bold text-gray-800 mb-3 pb-2 border-b border-gray-300">
                Serviços Realizados
              </h2>
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="border border-gray-300 px-3 py-2 text-left">Descrição</th>
                    <th className="border border-gray-300 px-3 py-2 text-center">Qtd</th>
                    <th className="border border-gray-300 px-3 py-2 text-right">Valor Unit.</th>
                    <th className="border border-gray-300 px-3 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {servicos.map((servico, idx) => (
                    <tr key={idx}>
                      <td className="border border-gray-300 px-3 py-2">{servico.descricao}</td>
                      <td className="border border-gray-300 px-3 py-2 text-center">{servico.quantidade}</td>
                      <td className="border border-gray-300 px-3 py-2 text-right">
                        {formatCurrency(servico.valor_unitario)}
                      </td>
                      <td className="border border-gray-300 px-3 py-2 text-right">
                        {formatCurrency(servico.valor_total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Valores */}
          <div className="mb-6 bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-600">Valor Total:</span>
              <span className="text-xl font-bold text-gray-800">{formatCurrency(os.valor_total)}</span>
            </div>
            <div className="flex justify-between items-center mb-2">
              <span className="text-sm font-medium text-gray-600">Valor Pago:</span>
              <span className="text-lg font-semibold text-green-600">{formatCurrency(os.valor_pago)}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-gray-300">
              <span className="text-sm font-medium text-gray-600">Saldo Restante:</span>
              <span className="text-lg font-bold text-red-600">{formatCurrency(os.saldo_restante)}</span>
            </div>
          </div>

          {/* Termos e Condições */}
          {config?.termo_orcamento && (
            <div className="mb-6 text-xs text-gray-600 leading-relaxed border-t pt-4">
              <h3 className="font-bold text-sm text-gray-800 mb-2">Termos do Orçamento:</h3>
              <div dangerouslySetInnerHTML={{ __html: config.termo_orcamento.replace(/\n/g, '<br/>') }} />
            </div>
          )}

          {config?.termo_garantia && (
            <div className="mb-6 text-xs text-gray-600 leading-relaxed">
              <h3 className="font-bold text-sm text-gray-800 mb-2">Termos de Garantia:</h3>
              <div dangerouslySetInnerHTML={{ __html: config.termo_garantia.replace(/\n/g, '<br/>') }} />
            </div>
          )}

          {/* Canais de Atendimento */}
          {config?.canais_atendimento && (
            <div className="mb-6 text-xs text-gray-600 leading-relaxed">
              <h3 className="font-bold text-sm text-gray-800 mb-2">Canais de Atendimento:</h3>
              <div dangerouslySetInnerHTML={{ __html: config.canais_atendimento.replace(/\n/g, '<br/>') }} />
            </div>
          )}

          {/* Observações Gerais */}
          {config?.observacoes_gerais && (
            <div className="mb-6 text-xs text-gray-600 leading-relaxed">
              <h3 className="font-bold text-sm text-gray-800 mb-2">Observações Gerais:</h3>
              <div dangerouslySetInnerHTML={{ __html: config.observacoes_gerais.replace(/\n/g, '<br/>') }} />
            </div>
          )}

          {/* Assinatura */}
          <div className="mt-12 pt-8 border-t-2 border-gray-300">
            <div className="grid grid-cols-2 gap-8">
              <div className="text-center">
                <div className="border-t border-gray-400 pt-2">
                  <p className="text-sm font-medium text-gray-700">Assinatura do Cliente</p>
                  <p className="text-xs text-gray-500">{os.cliente_nome}</p>
                </div>
              </div>
              <div className="text-center">
                <div className="border-t border-gray-400 pt-2">
                  <p className="text-sm font-medium text-gray-700">Assinatura do Responsável</p>
                  <p className="text-xs text-gray-500">{os.unidade?.nome}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Rodapé */}
          {config?.rodape_personalizado && (
            <div className="mt-8 pt-4 border-t border-gray-200 text-center text-xs text-gray-500">
              <div dangerouslySetInnerHTML={{ __html: config.rodape_personalizado.replace(/\n/g, '<br/>') }} />
            </div>
          )}
        </div>
      </div>
    </>
  );
}
