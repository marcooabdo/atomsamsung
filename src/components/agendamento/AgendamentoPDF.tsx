import { forwardRef } from 'react';
import { CheckCircle, XCircle, MapPin, Clock, User, FileText, Image as ImageIcon, Edit3 } from 'lucide-react';

interface AgendamentoPDFProps {
  agendamento: any;
  checkinData: any;
  checkoutData: any;
  checklistRespostas: any[];
}

export const AgendamentoPDF = forwardRef<HTMLDivElement, AgendamentoPDFProps>(
  ({ agendamento, checkinData, checkoutData, checklistRespostas }, ref) => {
    return (
      <div ref={ref} className="p-8 bg-white text-black">
        <div className="mb-8 border-b-4 border-blue-600 pb-4">
          <h1 className="text-3xl font-bold text-blue-600 mb-2">
            Relatório de Atendimento
          </h1>
          <p className="text-gray-600">
            OS: {agendamento.os?.numero_os_samsung || agendamento.os?.numero_os_interna || 'S/N'}
          </p>
          <p className="text-sm text-gray-500">
            Gerado em: {new Date().toLocaleString('pt-BR')}
          </p>
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
            <User className="w-5 h-5" />
            Informações do Cliente
          </h2>
          <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded">
            <div>
              <p className="text-sm text-gray-600">Nome</p>
              <p className="font-semibold">{agendamento.os?.cliente_nome || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Telefone</p>
              <p className="font-semibold">{agendamento.os?.cliente_telefone || '-'}</p>
            </div>
            <div className="col-span-2">
              <p className="text-sm text-gray-600">Endereço</p>
              <p className="font-semibold">
                {agendamento.os?.cliente_endereco || '-'}
                {agendamento.os?.cliente_bairro && `, ${agendamento.os.cliente_bairro}`}
                {agendamento.os?.cliente_cidade && `, ${agendamento.os.cliente_cidade}`}
                {agendamento.os?.cliente_estado && ` - ${agendamento.os.cliente_estado}`}
              </p>
            </div>
          </div>
        </div>

        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Informações do Agendamento
          </h2>
          <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded">
            <div>
              <p className="text-sm text-gray-600">Data Agendada</p>
              <p className="font-semibold">
                {agendamento.data_agendamento
                  ? new Date(agendamento.data_agendamento).toLocaleDateString('pt-BR')
                  : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Horário</p>
              <p className="font-semibold">
                {agendamento.horario_inicio || '-'} - {agendamento.horario_fim || '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Técnico</p>
              <p className="font-semibold">{agendamento.tecnico?.nome || '-'}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Tipo de Atendimento</p>
              <p className="font-semibold">{agendamento.os?.tipo_atendimento || '-'}</p>
            </div>
          </div>
        </div>

        {agendamento.os?.defeito_relatado && (
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-3">Defeito Relatado</h2>
            <div className="bg-gray-50 p-4 rounded">
              <p>{agendamento.os.defeito_relatado}</p>
            </div>
          </div>
        )}

        {checkinData && (
          <div className="mb-6 page-break">
            <h2 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              Check-in
            </h2>
            <div className="bg-green-50 p-4 rounded space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Data/Hora</p>
                  <p className="font-semibold">
                    {new Date(checkinData.data_hora).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Localização</p>
                  <p className="font-semibold text-sm">
                    {checkinData.localizacao_endereco || `${checkinData.localizacao_lat}, ${checkinData.localizacao_lng}`}
                  </p>
                </div>
              </div>
              {checkinData.observacao && (
                <div>
                  <p className="text-sm text-gray-600">Observação</p>
                  <p className="font-semibold">{checkinData.observacao}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {checkoutData && (
          <div className="mb-6 page-break">
            <h2 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-blue-600" />
              Check-out
            </h2>
            <div className="bg-blue-50 p-4 rounded space-y-3">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Data/Hora</p>
                  <p className="font-semibold">
                    {new Date(checkoutData.data_hora).toLocaleString('pt-BR')}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Localização</p>
                  <p className="font-semibold text-sm">
                    {checkoutData.localizacao_endereco || `${checkoutData.localizacao_lat}, ${checkoutData.localizacao_lng}`}
                  </p>
                </div>
              </div>
              {checkoutData.observacao && (
                <div>
                  <p className="text-sm text-gray-600">Observação</p>
                  <p className="font-semibold">{checkoutData.observacao}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {checklistRespostas.length > 0 && (
          <div className="mb-6 page-break">
            <h2 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Checklist de Serviço
            </h2>
            <div className="space-y-2">
              {checklistRespostas.map((item, index) => (
                <div key={index} className="bg-gray-50 p-3 rounded flex items-start gap-3">
                  <div className="flex-shrink-0">
                    {item.resposta_checkbox ? (
                      <CheckCircle className="w-5 h-5 text-green-600" />
                    ) : (
                      <XCircle className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{item.item_texto}</p>
                    {item.resposta_texto && (
                      <p className="text-sm text-gray-600 mt-1">{item.resposta_texto}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {checkoutData?.fotos && checkoutData.fotos.length > 0 && (
          <div className="mb-6 page-break">
            <h2 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Fotos do Serviço
            </h2>
            <div className="grid grid-cols-3 gap-4">
              {checkoutData.fotos.map((foto: string, index: number) => (
                <div key={index} className="border rounded p-2">
                  <img
                    src={foto}
                    alt={`Foto ${index + 1}`}
                    className="w-full h-48 object-cover rounded"
                  />
                  <p className="text-xs text-gray-500 mt-1 text-center">
                    Foto {index + 1}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {checkoutData?.assinatura_cliente && (
          <div className="mb-6">
            <h2 className="text-xl font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Edit3 className="w-5 h-5" />
              Assinatura do Cliente
            </h2>
            <div className="border-2 border-gray-300 rounded p-4 bg-gray-50">
              <img
                src={checkoutData.assinatura_cliente}
                alt="Assinatura do cliente"
                className="w-full max-w-md mx-auto"
              />
            </div>
          </div>
        )}

        <div className="mt-8 pt-4 border-t-2 border-gray-300 text-center">
          <p className="text-xs text-gray-500">
            Este relatório foi gerado automaticamente pelo sistema de gestão
          </p>
          <p className="text-xs text-gray-500">
            {agendamento.unidade?.nome || 'Sistema de OS'}
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
