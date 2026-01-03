import { X, MapPin, Phone, Mail, Package, DollarSign, Calendar, Clock, ExternalLink, FileText } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { AnexoPreviewModal } from './AnexoPreviewModal';

interface OSDetailsModalProps {
  osId: string;
  onClose: () => void;
}

interface OSDetails {
  id: string;
  numero_os_interna: string;
  numero_os_samsung: string | null;
  tipo_atendimento: 'IH' | 'CI';
  tipo_os: 'LP' | 'OW';
  rota: string;
  defeito_relatado: string | null;
  observacoes_internas: string | null;
  coluna_kanban: string;
  cliente_nome: string;
  cliente_telefone: string | null;
  cliente_email: string | null;
  cliente_cep: string | null;
  cliente_logradouro: string | null;
  cliente_numero: string | null;
  cliente_complemento: string | null;
  cliente_bairro: string | null;
  cliente_cidade: string | null;
  cliente_estado: string | null;
  aparelho_marca: string | null;
  aparelho_modelo: string | null;
  aparelho_nserie: string | null;
  status_samsung_desc: string | null;
  status_samsung_reason: string | null;
  agendamento?: {
    data_agendamento: string;
    confirmado_com_cliente: boolean;
    tecnico_nome?: string;
    checkout_pendente: boolean;
    status: string;
    horario_inicio?: string;
    horario_fim?: string;
  };
  status_pagamento: string;
  valor_total: number;
  valor_pago: number;
  saldo_restante: number;
  pagamentos?: Array<{
    valor: number;
    forma_pagamento: string;
    comprovante_url: string;
    data_lancamento: string;
  }>;
  pecas?: Array<{
    codigo_peca: string;
    descricao: string;
    pn: string;
    quantidade: number;
    valor_unitario: number;
    status: string;
    id_sequencial?: string;
    delivery?: string;
  }>;
  anexos?: Array<{
    id: string;
    nome_arquivo: string;
    url: string;
    tipo: string;
    tamanho_bytes: number;
    created_at: string;
  }>;
}

const ROTA_COLORS: Record<string, string> = {
  'Rota 1': 'bg-red-100 text-red-700 border-red-300',
  'Rota 2': 'bg-orange-100 text-orange-700 border-orange-300',
  'Rota 3': 'bg-amber-100 text-amber-700 border-amber-300',
  'Rota 4': 'bg-lime-100 text-lime-700 border-lime-300',
  'Rota 5': 'bg-emerald-100 text-emerald-700 border-emerald-300',
  'Rota 6': 'bg-cyan-100 text-cyan-700 border-cyan-300',
  'Rota 7': 'bg-purple-100 text-purple-700 border-purple-300'
};

export default function OSDetailsModal({ osId, onClose }: OSDetailsModalProps) {
  const [osDetails, setOsDetails] = useState<OSDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [anexoPreview, setAnexoPreview] = useState<any>(null);

  useEffect(() => {
    loadOSDetails();
  }, [osId]);

  async function loadOSDetails() {
    setLoading(true);
    try {
      const { data: os, error: osError } = await supabase
        .from('os')
        .select(`
          *,
          agendamentos (
            data_agendamento,
            confirmado_com_cliente,
            checkout_pendente,
            status,
            horario_inicio,
            horario_fim,
            tecnicos:tecnico_id (
              nome
            )
          ),
          pagamentos (
            valor,
            forma_pagamento,
            comprovante_url,
            data_lancamento
          )
        `)
        .eq('id', osId)
        .single();

      if (osError) throw osError;

      const { data: pecas } = await supabase
        .from('requisicoes_pecas')
        .select(`
          codigo_peca,
          descricao,
          quantidade_requisitada,
          status,
          estoque_pecas:peca_estoque_id (
            valor_gspn,
            pn,
            estoque_etiquetas (
              id_sequencial,
              delivery
            )
          )
        `)
        .eq('os_id', osId);

      const { data: anexos } = await supabase
        .from('os_anexos')
        .select('id, nome_arquivo, url, tipo, tamanho_bytes, created_at')
        .eq('os_id', osId);

      const pecasFormatted = pecas?.map((p: any) => ({
        codigo_peca: p.codigo_peca,
        descricao: p.descricao,
        pn: p.estoque_pecas?.pn || p.codigo_peca,
        quantidade: p.quantidade_requisitada || 1,
        valor_unitario: p.estoque_pecas?.valor_gspn || 0,
        status: p.status,
        id_sequencial: p.estoque_pecas?.estoque_etiquetas?.[0]?.id_sequencial,
        delivery: p.estoque_pecas?.estoque_etiquetas?.[0]?.delivery
      })) || [];

      const osFormatted: OSDetails = {
        ...os,
        status_pagamento: os.status_pagamento || 'pendente',
        valor_total: os.valor_total || 0,
        valor_pago: os.valor_pago || 0,
        saldo_restante: os.saldo_restante || 0,
        agendamento: os.agendamentos?.[0] ? {
          data_agendamento: os.agendamentos[0].data_agendamento,
          confirmado_com_cliente: os.agendamentos[0].confirmado_com_cliente,
          tecnico_nome: os.agendamentos[0].tecnicos?.nome,
          checkout_pendente: os.agendamentos[0].checkout_pendente,
          status: os.agendamentos[0].status,
          horario_inicio: os.agendamentos[0].horario_inicio,
          horario_fim: os.agendamentos[0].horario_fim
        } : undefined,
        pagamentos: os.pagamentos || [],
        pecas: pecasFormatted,
        anexos: anexos || []
      };

      setOsDetails(osFormatted);
    } catch (error) {
      console.error('Error loading OS details:', error);
    } finally {
      setLoading(false);
    }
  }

  function handleOpenMaps(type: 'google' | 'waze') {
    if (!osDetails) return;

    const endereco = `${osDetails.cliente_logradouro}, ${osDetails.cliente_numero}, ${osDetails.cliente_bairro}, ${osDetails.cliente_cidade}, ${osDetails.cliente_estado}`;

    if (type === 'google') {
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(endereco)}`, '_blank');
    } else {
      window.open(`https://waze.com/ul?q=${encodeURIComponent(endereco)}`, '_blank');
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-8">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </div>
    );
  }

  if (!osDetails) {
    return null;
  }

  const enderecoCompleto = `${osDetails.cliente_logradouro}, ${osDetails.cliente_numero}${osDetails.cliente_complemento ? `, ${osDetails.cliente_complemento}` : ''}, ${osDetails.cliente_bairro}, ${osDetails.cliente_cidade} - ${osDetails.cliente_estado}, CEP: ${osDetails.cliente_cep}`;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between z-10">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">OS {osDetails.numero_os_interna}</h2>
            {osDetails.numero_os_samsung && (
              <p className="text-sm text-gray-600 mt-1">Samsung: {osDetails.numero_os_samsung}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-600" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex gap-2 flex-wrap">
            <span className={`px-3 py-1 rounded-full text-sm font-medium border ${ROTA_COLORS[osDetails.rota] || 'bg-gray-100 text-gray-700 border-gray-300'}`}>
              {osDetails.rota}
            </span>
            <span className="px-3 py-1 bg-blue-100 text-blue-700 border border-blue-300 rounded-full text-sm font-medium">
              {osDetails.tipo_atendimento}
            </span>
            <span className="px-3 py-1 bg-purple-100 text-purple-700 border border-purple-300 rounded-full text-sm font-medium">
              {osDetails.tipo_os}
            </span>
          </div>

          {osDetails.numero_os_samsung && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-600" />
                INFORMAÇÃO DA OS
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Status:</span>
                  <p className="font-medium text-gray-900">{osDetails.status_samsung_desc || '—'}</p>
                </div>
                <div>
                  <span className="text-gray-600">Motivo:</span>
                  <p className="font-medium text-gray-900">{osDetails.status_samsung_reason || '—'}</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Phone className="w-5 h-5 text-gray-600" />
                  Informações do Cliente
                </h3>
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="text-gray-600">Nome:</span>
                    <p className="font-medium text-gray-900">{osDetails.cliente_nome}</p>
                  </div>
                  {osDetails.cliente_telefone && (
                    <div>
                      <span className="text-gray-600">Telefone:</span>
                      <p className="font-medium text-gray-900">{osDetails.cliente_telefone}</p>
                    </div>
                  )}
                  {osDetails.cliente_email && (
                    <div>
                      <span className="text-gray-600">Email:</span>
                      <p className="font-medium text-gray-900">{osDetails.cliente_email}</p>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <MapPin className="w-5 h-5 text-gray-600" />
                  Endereço
                </h3>
                <p className="text-sm text-gray-900 mb-3">{enderecoCompleto}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleOpenMaps('google')}
                    className="flex items-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Google Maps
                  </button>
                  <button
                    onClick={() => handleOpenMaps('waze')}
                    className="flex items-center gap-2 px-3 py-2 bg-cyan-600 text-white rounded-lg hover:bg-cyan-700 text-sm"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Waze
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Package className="w-5 h-5 text-gray-600" />
                  Aparelho
                </h3>
                <div className="space-y-2 text-sm">
                  {osDetails.aparelho_modelo && (
                    <div>
                      <span className="text-gray-600">Modelo:</span>
                      <p className="font-medium text-gray-900">{osDetails.aparelho_modelo}</p>
                    </div>
                  )}
                  {osDetails.aparelho_nserie && (
                    <div>
                      <span className="text-gray-600">Número de Série:</span>
                      <p className="font-medium text-gray-900">{osDetails.aparelho_nserie}</p>
                    </div>
                  )}
                </div>
              </div>

              {osDetails.defeito_relatado && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Defeito Relatado</h3>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                    {osDetails.defeito_relatado}
                  </p>
                </div>
              )}

              {osDetails.observacoes_internas && (
                <div>
                  <h3 className="font-semibold text-gray-900 mb-2">Observações Internas</h3>
                  <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-lg">
                    {osDetails.observacoes_internas}
                  </p>
                </div>
              )}
            </div>
          </div>

          {osDetails.agendamento && (
            <div className="border-t pt-6">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-gray-600" />
                Agendamento
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Data:</span>
                  <p className="font-medium text-gray-900">
                    {new Date(osDetails.agendamento.data_agendamento).toLocaleDateString('pt-BR')}
                  </p>
                </div>
                {osDetails.agendamento.tecnico_nome && (
                  <div>
                    <span className="text-gray-600">Técnico:</span>
                    <p className="font-medium text-gray-900">{osDetails.agendamento.tecnico_nome}</p>
                  </div>
                )}
                <div>
                  <span className="text-gray-600">Confirmação:</span>
                  <p className="font-medium text-gray-900">
                    {osDetails.agendamento.confirmado_com_cliente ? 'Confirmado' : 'Não confirmado'}
                  </p>
                </div>
                {osDetails.agendamento.horario_inicio && (
                  <div>
                    <span className="text-gray-600">Horário:</span>
                    <p className="font-medium text-gray-900">
                      {osDetails.agendamento.horario_inicio.substring(0, 5)} - {osDetails.agendamento.horario_fim?.substring(0, 5) || ''}
                    </p>
                  </div>
                )}
                <div>
                  <span className="text-gray-600">Status:</span>
                  <p className="font-medium text-gray-900 capitalize">
                    {osDetails.agendamento.status?.replace('_', ' ') || 'Pendente'}
                  </p>
                </div>
                {osDetails.agendamento.checkout_pendente && (
                  <div className="md:col-span-2">
                    <span className="px-3 py-1 bg-yellow-100 text-yellow-700 border border-yellow-300 rounded-full text-sm font-medium">
                      Aguardando movimentação após checkout
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="border-t pt-6">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-gray-600" />
              Informações Financeiras
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm mb-4">
              <div>
                <span className="text-gray-600">Status:</span>
                <p className="font-medium text-gray-900 capitalize">
                  {osDetails.status_pagamento.replace('_', ' ')}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Valor Total:</span>
                <p className="font-medium text-gray-900">
                  R$ {osDetails.valor_total.toFixed(2)}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Valor Pago:</span>
                <p className="font-medium text-green-600">
                  R$ {osDetails.valor_pago.toFixed(2)}
                </p>
              </div>
              <div>
                <span className="text-gray-600">Saldo Restante:</span>
                <p className="font-medium text-orange-600">
                  R$ {osDetails.saldo_restante.toFixed(2)}
                </p>
              </div>
            </div>

            {osDetails.pagamentos && osDetails.pagamentos.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium text-gray-700 mb-2">Pagamentos Recebidos</h4>
                <div className="space-y-2">
                  {osDetails.pagamentos.map((pagamento, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900 capitalize">
                          {pagamento.forma_pagamento.replace('_', ' ')}
                        </p>
                        <p className="text-sm text-gray-600">
                          {new Date(pagamento.data_lancamento).toLocaleDateString('pt-BR')}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-green-600">
                          R$ {pagamento.valor.toFixed(2)}
                        </p>
                        <a
                          href={pagamento.comprovante_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-blue-600 hover:underline"
                        >
                          Ver comprovante
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {osDetails.pecas && osDetails.pecas.length > 0 && (
            <div className="border-t pt-6">
              <h3 className="font-semibold text-gray-900 mb-3">Peças Aprovadas</h3>
              <div className="space-y-2">
                {osDetails.pecas.map((peca, index) => (
                  <div
                    key={index}
                    className="p-3 bg-gray-50 rounded-lg space-y-2"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-bold text-gray-900 text-lg">{peca.pn}</p>
                        <p className="text-sm text-gray-700 mt-1">{peca.descricao}</p>
                        <div className="flex items-center gap-3 mt-2">
                          {peca.id_sequencial && (
                            <>
                              <span className="text-xs text-cyan-600 font-medium">ID: {peca.id_sequencial}</span>
                              <span className="text-gray-400">•</span>
                            </>
                          )}
                          {peca.delivery && (
                            <>
                              <span className="text-xs text-orange-600 font-medium">Delivery: {peca.delivery}</span>
                              <span className="text-gray-400">•</span>
                            </>
                          )}
                          <span className="text-xs text-gray-600">Código: {peca.codigo_peca}</span>
                          <span className="text-gray-400">•</span>
                          <span className="text-xs text-gray-600">Qtd: {peca.quantidade}</span>
                        </div>
                        <div className="mt-2">
                          <span className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                            peca.status === 'atendida' ? 'bg-green-100 text-green-700' :
                            peca.status === 'pendente' ? 'bg-yellow-100 text-yellow-700' :
                            peca.status === 'gi_postada' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {peca.status}
                          </span>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium text-gray-900">
                          R$ {peca.valor_unitario.toFixed(2)}
                        </p>
                        <p className="text-sm text-gray-600">
                          Total: R$ {(peca.quantidade * peca.valor_unitario).toFixed(2)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {osDetails.anexos && osDetails.anexos.length > 0 && (
            <div className="border-t pt-6">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <FileText className="w-5 h-5 text-gray-600" />
                Anexos
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {osDetails.anexos.map((anexo) => {
                  const { data: publicUrl } = supabase.storage
                    .from('os-anexos')
                    .getPublicUrl(anexo.url);

                  return (
                    <button
                      key={anexo.id}
                      onClick={() => setAnexoPreview({ ...anexo, url: publicUrl.publicUrl })}
                      className="p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <FileText className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-700 text-center truncate">
                        {anexo.nome_arquivo}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {anexoPreview && (
        <AnexoPreviewModal
          anexo={anexoPreview}
          onClose={() => setAnexoPreview(null)}
        />
      )}
    </div>
  );
}
