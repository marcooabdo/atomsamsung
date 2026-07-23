import { forwardRef } from 'react';
import { CheckCircle, XCircle, MapPin, Clock, User, FileText, Image as ImageIcon, CreditCard as Edit3, Wrench, Phone, Package, Building2 } from 'lucide-react';

interface AgendamentoPDFProps {
  agendamento: any;
  checkinData: any;
  checkoutData: any;
  checklistRespostas: any[];
  anexos?: any[];
  unidadeInfo?: {
    nome: string;
    razao_social?: string;
    cnpj?: string;
    telefone?: string;
    endereco?: string;
    cidade?: string;
    estado?: string;
    email?: string;
  } | null;
  logoUrl?: string | null;
  osData?: {
    numero_os_samsung?: string;
    numero_os_interna?: string;
    cliente_nome?: string;
    cliente_telefone?: string;
    cliente_endereco?: string;
    cliente_bairro?: string;
    cliente_cidade?: string;
    cliente_estado?: string;
    cliente_cep?: string;
    tipo_atendimento?: string;
    tipo_reparo?: string;
    defeito_relatado?: string;
    diagnostico_tecnico?: string;
    reparo_efetuado?: string;
    modelo?: string;
    imei?: string;
    numero_serie?: string;
    coluna_kanban?: string;
  } | null;
  resultadoVisita?: string | null;
}

const getResultadoLabel = (coluna: string | undefined, comentarios?: string): string => {
  if (comentarios) {
    if (comentarios.includes('Reparo com Sucesso')) return 'Reparo com Sucesso';
    if (comentarios.includes('Improdutiva')) return 'Improdutiva / Revisita';
    if (comentarios.includes('Peça com Defeito')) return 'Peça com Defeito';
  }
  const labels: Record<string, string> = {
    reparo_concluido: 'Reparo Concluído',
    aguardando_fechamento: 'Aguardando Fechamento',
    aguardando_peca: 'Aguardando Peça',
    em_rota_ih: 'Em Rota',
  };
  return labels[coluna || ''] || coluna?.replace(/_/g, ' ')?.toUpperCase() || '';
};

const getResultadoColor = (resultado: string): string => {
  if (resultado.includes('Sucesso') || resultado.includes('Concluído') || resultado.includes('Fechamento')) return '#10b981';
  if (resultado.includes('Improdutiva') || resultado.includes('Revisita')) return '#f59e0b';
  if (resultado.includes('Defeito') || resultado.includes('Peça')) return '#ef4444';
  return '#6b7280';
};

export const AgendamentoPDF = forwardRef<HTMLDivElement, AgendamentoPDFProps>(
  ({ agendamento, checkinData, checkoutData, checklistRespostas, anexos, unidadeInfo, logoUrl, osData, resultadoVisita }, ref) => {
    const numeroOS = osData?.numero_os_samsung || osData?.numero_os_interna || agendamento.os?.numero_os_samsung || agendamento.os?.numero_os_interna || 'S/N';
    const resultado = resultadoVisita || getResultadoLabel(osData?.coluna_kanban || agendamento.os?.coluna_kanban);
    const resultadoColor = getResultadoColor(resultado);

    const fotosCheckout = anexos?.filter(a => a.tipo === 'checkout') || [];
    const fotosCheckin = anexos?.filter(a => a.tipo === 'checkin') || [];
    const assinaturaTecnico = anexos?.find(a => a.tipo === 'assinatura_tecnico');
    const assinaturaCliente = anexos?.find(a => a.tipo === 'assinatura_cliente');
    const fotosPecaNova = anexos?.filter(a => a.tipo === 'peca_nova') || [];
    const fotosPecaVelha = anexos?.filter(a => a.tipo === 'peca_velha') || [];
    const evidencias = anexos?.filter(a => !['checkout', 'checkin', 'assinatura_tecnico', 'assinatura_cliente', 'peca_nova', 'peca_velha'].includes(a.tipo)) || [];

    return (
      <div ref={ref} className="p-8 bg-white text-black" style={{ fontFamily: 'Arial, sans-serif', fontSize: '11px' }}>
        {/* Header with Logo */}
        <div className="flex items-start justify-between mb-6 pb-4 border-b-2 border-gray-800">
          <div className="flex items-center gap-4">
            {logoUrl && (
              <img src={logoUrl} alt="Logo" className="h-16 w-auto object-contain" />
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900" style={{ fontSize: '20px' }}>
                Relatório de Visita Técnica
              </h1>
              <p className="text-gray-600" style={{ fontSize: '12px' }}>
                OS: {numeroOS}
              </p>
            </div>
          </div>
          <div className="text-right">
            {resultado && (
              <div
                className="inline-block px-4 py-2 rounded-lg font-bold mb-2"
                style={{
                  backgroundColor: `${resultadoColor}20`,
                  color: resultadoColor,
                  border: `2px solid ${resultadoColor}`,
                  fontSize: '12px'
                }}
              >
                {resultado.toUpperCase()}
              </div>
            )}
            <p className="text-gray-500 text-xs">
              Gerado em: {new Date().toLocaleString('pt-BR')}
            </p>
          </div>
        </div>

        {/* Company Info */}
        {unidadeInfo && (
          <div className="mb-5 bg-gray-50 p-3 rounded border border-gray-200" style={{ fontSize: '10px' }}>
            <div className="flex items-center gap-6 flex-wrap">
              <span className="font-bold text-gray-800">{unidadeInfo.razao_social || unidadeInfo.nome}</span>
              {unidadeInfo.cnpj && <span className="text-gray-600">CNPJ: {unidadeInfo.cnpj}</span>}
              {unidadeInfo.telefone && <span className="text-gray-600">Tel: {unidadeInfo.telefone}</span>}
              {unidadeInfo.email && <span className="text-gray-600">{unidadeInfo.email}</span>}
              {unidadeInfo.endereco && (
                <span className="text-gray-600">
                  {unidadeInfo.endereco}{unidadeInfo.cidade ? `, ${unidadeInfo.cidade}` : ''}{unidadeInfo.estado ? ` - ${unidadeInfo.estado}` : ''}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Client and Product Info */}
        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="border border-gray-200 rounded p-3">
            <h2 className="font-bold text-gray-800 mb-2 flex items-center gap-2 text-sm border-b border-gray-200 pb-1">
              <User className="w-4 h-4" />
              Cliente
            </h2>
            <div className="space-y-1">
              <p><span className="text-gray-600">Nome:</span> <span className="font-semibold">{osData?.cliente_nome || agendamento.os?.cliente_nome || '-'}</span></p>
              <p><span className="text-gray-600">Telefone:</span> <span className="font-semibold">{osData?.cliente_telefone || agendamento.os?.cliente_telefone || '-'}</span></p>
              <p><span className="text-gray-600">Endereço:</span> <span className="font-semibold">
                {osData?.cliente_endereco || agendamento.os?.cliente_endereco || '-'}
                {(osData?.cliente_bairro || agendamento.os?.cliente_bairro) && `, ${osData?.cliente_bairro || agendamento.os?.cliente_bairro}`}
              </span></p>
              <p><span className="text-gray-600">Cidade:</span> <span className="font-semibold">
                {osData?.cliente_cidade || agendamento.os?.cliente_cidade || '-'}
                {(osData?.cliente_estado || agendamento.os?.cliente_estado) && ` - ${osData?.cliente_estado || agendamento.os?.cliente_estado}`}
              </span></p>
              {(osData?.cliente_cep || agendamento.os?.cliente_cep) && (
                <p><span className="text-gray-600">CEP:</span> <span className="font-semibold">{osData?.cliente_cep || agendamento.os?.cliente_cep}</span></p>
              )}
            </div>
          </div>

          <div className="border border-gray-200 rounded p-3">
            <h2 className="font-bold text-gray-800 mb-2 flex items-center gap-2 text-sm border-b border-gray-200 pb-1">
              <Wrench className="w-4 h-4" />
              Produto / Serviço
            </h2>
            <div className="space-y-1">
              <p><span className="text-gray-600">OS:</span> <span className="font-semibold">{numeroOS}</span></p>
              <p><span className="text-gray-600">Tipo:</span> <span className="font-semibold">{osData?.tipo_atendimento || agendamento.os?.tipo_atendimento || '-'}</span></p>
              {(osData?.tipo_reparo || agendamento.os?.tipo_reparo) && (
                <p><span className="text-gray-600">Tipo Reparo:</span> <span className="font-semibold">{osData?.tipo_reparo || agendamento.os?.tipo_reparo}</span></p>
              )}
              {osData?.modelo && (
                <p><span className="text-gray-600">Modelo:</span> <span className="font-semibold">{osData.modelo}</span></p>
              )}
              {osData?.imei && (
                <p><span className="text-gray-600">IMEI:</span> <span className="font-semibold">{osData.imei}</span></p>
              )}
              {osData?.numero_serie && (
                <p><span className="text-gray-600">N. Série:</span> <span className="font-semibold">{osData.numero_serie}</span></p>
              )}
            </div>
          </div>
        </div>

        {/* Visit Schedule Info */}
        <div className="mb-5 border border-gray-200 rounded p-3">
          <h2 className="font-bold text-gray-800 mb-2 flex items-center gap-2 text-sm border-b border-gray-200 pb-1">
            <Clock className="w-4 h-4" />
            Dados da Visita
          </h2>
          <div className="grid grid-cols-4 gap-3">
            <div>
              <p className="text-gray-600">Data Agendada</p>
              <p className="font-semibold">
                {agendamento.data_agendamento
                  ? new Date(agendamento.data_agendamento + 'T00:00:00').toLocaleDateString('pt-BR')
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Horário</p>
              <p className="font-semibold">
                {agendamento.horario_inicio?.slice(0, 5) || '-'} - {agendamento.horario_fim?.slice(0, 5) || '-'}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Técnico</p>
              <p className="font-semibold">{agendamento.tecnico?.nome || '-'}</p>
            </div>
            <div>
              <p className="text-gray-600">Resultado</p>
              <p className="font-bold" style={{ color: resultadoColor }}>{resultado || '-'}</p>
            </div>
          </div>
        </div>

        {/* Check-in */}
        {checkinData && (
          <div className="mb-4 border border-green-200 rounded p-3 bg-green-50">
            <h2 className="font-bold text-gray-800 mb-2 flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-green-600" />
              Check-in
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-gray-600">Data/Hora</p>
                <p className="font-semibold">{new Date(checkinData.data_hora).toLocaleString('pt-BR')}</p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-600">Localização</p>
                <p className="font-semibold text-xs">
                  {checkinData.localizacao_endereco || `${checkinData.localizacao_lat}, ${checkinData.localizacao_lng}`}
                </p>
              </div>
            </div>
            {checkinData.observacao && (
              <div className="mt-2">
                <p className="text-gray-600">Observação</p>
                <p className="font-semibold">{checkinData.observacao}</p>
              </div>
            )}
          </div>
        )}

        {/* Check-out */}
        {checkoutData && (
          <div className="mb-4 border border-blue-200 rounded p-3 bg-blue-50">
            <h2 className="font-bold text-gray-800 mb-2 flex items-center gap-2 text-sm">
              <CheckCircle className="w-4 h-4 text-blue-600" />
              Check-out
            </h2>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className="text-gray-600">Data/Hora</p>
                <p className="font-semibold">{new Date(checkoutData.data_hora).toLocaleString('pt-BR')}</p>
              </div>
              <div className="col-span-2">
                <p className="text-gray-600">Localização</p>
                <p className="font-semibold text-xs">
                  {checkoutData.localizacao_endereco || `${checkoutData.localizacao_lat}, ${checkoutData.localizacao_lng}`}
                </p>
              </div>
            </div>
            {checkoutData.observacao && (
              <div className="mt-2">
                <p className="text-gray-600">Observação</p>
                <p className="font-semibold">{checkoutData.observacao}</p>
              </div>
            )}
          </div>
        )}

        {/* Defeito & Diagnóstico & Reparo */}
        {(osData?.defeito_relatado || osData?.diagnostico_tecnico || osData?.reparo_efetuado) && (
          <div className="mb-5 border border-gray-200 rounded p-3">
            <h2 className="font-bold text-gray-800 mb-2 flex items-center gap-2 text-sm border-b border-gray-200 pb-1">
              <FileText className="w-4 h-4" />
              Informações Técnicas
            </h2>
            <div className="space-y-2">
              {osData?.defeito_relatado && (
                <div>
                  <p className="text-gray-600 font-semibold">Defeito Relatado:</p>
                  <p className="bg-gray-50 p-2 rounded">{osData.defeito_relatado}</p>
                </div>
              )}
              {osData?.diagnostico_tecnico && (
                <div>
                  <p className="text-gray-600 font-semibold">Diagnóstico Técnico:</p>
                  <p className="bg-gray-50 p-2 rounded">{osData.diagnostico_tecnico}</p>
                </div>
              )}
              {osData?.reparo_efetuado && (
                <div>
                  <p className="text-gray-600 font-semibold">Reparo Efetuado:</p>
                  <p className="bg-gray-50 p-2 rounded">{osData.reparo_efetuado}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Checklist */}
        {checklistRespostas.length > 0 && (
          <div className="mb-5 border border-gray-200 rounded p-3">
            <h2 className="font-bold text-gray-800 mb-2 flex items-center gap-2 text-sm border-b border-gray-200 pb-1">
              <FileText className="w-4 h-4" />
              Checklist de Serviço
            </h2>
            <div className="space-y-1">
              {checklistRespostas.map((item, index) => (
                <div key={index} className="flex items-start gap-2 py-1 border-b border-gray-100 last:border-b-0">
                  <div className="flex-shrink-0 mt-0.5">
                    {item.resposta_checkbox ? (
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{item.item_texto}</p>
                    {item.resposta_texto && (
                      <p className="text-gray-600 text-xs">{item.resposta_texto}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fotos do Check-in */}
        {fotosCheckin.length > 0 && (
          <div className="mb-5">
            <h2 className="font-bold text-gray-800 mb-2 flex items-center gap-2 text-sm">
              <ImageIcon className="w-4 h-4" />
              Fotos do Check-in
            </h2>
            <div className="grid grid-cols-4 gap-2">
              {fotosCheckin.map((foto: any, index: number) => (
                <div key={index} className="border rounded overflow-hidden">
                  <img src={foto.url} alt={`Check-in ${index + 1}`} className="w-full h-28 object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fotos do Check-out */}
        {fotosCheckout.length > 0 && (
          <div className="mb-5">
            <h2 className="font-bold text-gray-800 mb-2 flex items-center gap-2 text-sm">
              <ImageIcon className="w-4 h-4" />
              Fotos do Check-out
            </h2>
            <div className="grid grid-cols-4 gap-2">
              {fotosCheckout.map((foto: any, index: number) => (
                <div key={index} className="border rounded overflow-hidden">
                  <img src={foto.url} alt={`Check-out ${index + 1}`} className="w-full h-28 object-cover" />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Fotos de Peças */}
        {(fotosPecaNova.length > 0 || fotosPecaVelha.length > 0) && (
          <div className="mb-5">
            <h2 className="font-bold text-gray-800 mb-2 flex items-center gap-2 text-sm">
              <Package className="w-4 h-4" />
              Fotos das Peças
            </h2>
            {fotosPecaNova.length > 0 && (
              <div className="mb-2">
                <p className="text-gray-600 text-xs font-semibold mb-1">Peças Novas:</p>
                <div className="grid grid-cols-4 gap-2">
                  {fotosPecaNova.map((foto: any, index: number) => (
                    <div key={index} className="border rounded overflow-hidden">
                      <img src={foto.url} alt={`Peça Nova ${index + 1}`} className="w-full h-28 object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
            {fotosPecaVelha.length > 0 && (
              <div>
                <p className="text-gray-600 text-xs font-semibold mb-1">Peças Usadas:</p>
                <div className="grid grid-cols-4 gap-2">
                  {fotosPecaVelha.map((foto: any, index: number) => (
                    <div key={index} className="border rounded overflow-hidden">
                      <img src={foto.url} alt={`Peça Usada ${index + 1}`} className="w-full h-28 object-cover" />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Evidências */}
        {evidencias.length > 0 && (
          <div className="mb-5">
            <h2 className="font-bold text-gray-800 mb-2 flex items-center gap-2 text-sm">
              <ImageIcon className="w-4 h-4" />
              Evidências
            </h2>
            <div className="grid grid-cols-4 gap-2">
              {evidencias.map((foto: any, index: number) => (
                <div key={index} className="border rounded overflow-hidden">
                  <img src={foto.url} alt={`Evidência ${index + 1}`} className="w-full h-28 object-cover" />
                  {foto.descricao && <p className="text-xs text-center p-1 text-gray-600">{foto.descricao}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Assinaturas */}
        {(assinaturaTecnico || assinaturaCliente) && (
          <div className="mb-5 border border-gray-200 rounded p-3">
            <h2 className="font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm border-b border-gray-200 pb-1">
              <Edit3 className="w-4 h-4" />
              Assinaturas
            </h2>
            <div className="grid grid-cols-2 gap-4">
              {assinaturaTecnico && (
                <div className="text-center">
                  <img
                    src={assinaturaTecnico.url}
                    alt="Assinatura do Técnico"
                    className="w-full max-h-32 object-contain mx-auto border-b-2 border-gray-800 pb-2"
                  />
                  <p className="text-gray-700 font-semibold mt-2">Técnico</p>
                  <p className="text-gray-500 text-xs">{agendamento.tecnico?.nome || ''}</p>
                </div>
              )}
              {assinaturaCliente && (
                <div className="text-center">
                  <img
                    src={assinaturaCliente.url}
                    alt="Assinatura do Cliente"
                    className="w-full max-h-32 object-contain mx-auto border-b-2 border-gray-800 pb-2"
                  />
                  <p className="text-gray-700 font-semibold mt-2">Cliente</p>
                  <p className="text-gray-500 text-xs">{osData?.cliente_nome || agendamento.os?.cliente_nome || ''}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pt-3 border-t-2 border-gray-800 text-center">
          <p className="text-xs text-gray-600 font-semibold">
            {unidadeInfo?.razao_social || unidadeInfo?.nome || agendamento.unidade?.nome || 'Sistema de OS'}
          </p>
          {unidadeInfo?.cnpj && (
            <p className="text-xs text-gray-500">CNPJ: {unidadeInfo.cnpj}</p>
          )}
          <p className="text-xs text-gray-400 mt-1">
            Documento gerado automaticamente pelo sistema de gestão
          </p>
        </div>

        <style>
          {`
            @media print {
              .page-break {
                page-break-before: always;
              }
              body {
                print-color-adjust: exact;
                -webkit-print-color-adjust: exact;
              }
            }
          `}
        </style>
      </div>
    );
  }
);

AgendamentoPDF.displayName = 'AgendamentoPDF';
