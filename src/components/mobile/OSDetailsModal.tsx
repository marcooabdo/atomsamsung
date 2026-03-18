import { useState, useEffect } from 'react';
import { X, MapPin, Phone, Package, FileText, PlayCircle, Navigation, CheckCircle, ClipboardList, Calendar, Wrench } from 'lucide-react';
import { supabase, formatTipoAtendimento } from '../../lib/supabase';
import { CheckinModal } from '../agendamento/CheckinModal';
import { CheckoutModal } from '../agendamento/CheckoutModal';
import { AgendamentoChecklistSection } from '../AgendamentoChecklistSection';

interface OSDetailsModalProps {
  os: {
    id: string;
    numero_os_interna: string | null;
    numero_os_samsung: string | null;
    tipo_atendimento: string;
    tipo_reparo: string | null;
    tipo_os: string | null;
    cliente_nome: string;
    cliente_telefone: string;
    cliente_endereco: string;
    cliente_bairro: string | null;
    cliente_cidade: string;
    cliente_cep: string | null;
    aparelho_marca: string | null;
    aparelho_modelo: string | null;
    defeito_relatado: string | null;
    observacoes: string | null;
    latitude: number | null;
    longitude: number | null;
    coluna_kanban: string;
  };
  onClose: () => void;
  onStart: () => void;
}

interface PecaOS {
  id: string;
  id_numerico: number;
  codigo_peca: string;
  descricao: string;
  status: string;
  req_status: string;
  quantidade_requisitada: number;
}

const PECA_STATUS_LABELS: Record<string, { label: string; color: string }> = {
  disponivel: { label: 'Disponivel', color: 'text-gray-400' },
  reservada: { label: 'Reservada', color: 'text-yellow-400' },
  vinculada_tecnico: { label: 'Com Tecnico', color: 'text-cyan-400' },
  em_rota: { label: 'Em Rota', color: 'text-blue-400' },
  em_uso: { label: 'Em Uso', color: 'text-orange-400' },
  usada: { label: 'Usada', color: 'text-green-400' },
  devolucao_pendente: { label: 'Dev. Pendente', color: 'text-amber-400' },
  devolvida_nova: { label: 'Dev. Nova', color: 'text-teal-400' },
  devolvida_defeito: { label: 'Dev. Defeito', color: 'text-red-400' },
  usada_upc: { label: 'Usada UPC', color: 'text-green-300' },
  devolvida_samsung: { label: 'Dev. Samsung', color: 'text-teal-300' },
  arquivada: { label: 'Arquivada', color: 'text-gray-500' },
};

export function OSDetailsModal({ os, onClose, onStart }: OSDetailsModalProps) {
  const [visitas, setVisitas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [pecas, setPecas] = useState<PecaOS[]>([]);
  const [checkinModalOpen, setCheckinModalOpen] = useState(false);
  const [checkoutModalOpen, setCheckoutModalOpen] = useState(false);
  const [selectedAgendamento, setSelectedAgendamento] = useState<any>(null);
  const [checklistModalOpen, setChecklistModalOpen] = useState(false);
  const [selectedVisitaForChecklist, setSelectedVisitaForChecklist] = useState<string | null>(null);
  const [processingCheckin, setProcessingCheckin] = useState<string | null>(null);
  const [processingCheckout, setProcessingCheckout] = useState<string | null>(null);

  const enderecoCompleto = `${os.cliente_endereco}, ${os.cliente_bairro || ''}, ${os.cliente_cidade}${os.cliente_cep ? ` - CEP: ${os.cliente_cep}` : ''}`.trim();

  const estaEmAndamento = os.coluna_kanban === 'em_reparo_ci' || os.coluna_kanban === 'em_rota_ih';

  useEffect(() => {
    loadVisitas();
    loadPecas();
  }, [os.id]);

  const loadVisitas = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('agendamentos')
        .select(`
          *,
          checkins:agendamentos_checkin_checkout!agendamentos_checkin_checkout_agendamento_id_fkey(*)
        `)
        .eq('os_id', os.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const visitasComCheckin = data.map((visita: any) => {
        const checkin = visita.checkins?.find((c: any) => c.tipo === 'checkin');
        const checkout = visita.checkins?.find((c: any) => c.tipo === 'checkout');

        return {
          ...visita,
          checkin_realizado: !!checkin,
          checkin_hora: checkin?.data_hora,
          checkin_latitude: checkin?.localizacao_lat,
          checkin_longitude: checkin?.localizacao_lng,
          checkout_realizado: !!checkout,
          checkout_hora: checkout?.data_hora,
          checkout_latitude: checkout?.localizacao_lat,
          checkout_longitude: checkout?.localizacao_lng,
          os: {
            numero_os_samsung: os.numero_os_samsung,
            numero_os_interna: os.numero_os_interna,
            cliente_nome: os.cliente_nome,
            cliente_endereco: os.cliente_endereco,
            cliente_bairro: os.cliente_bairro,
            cliente_cidade: os.cliente_cidade,
            cliente_estado: ''
          }
        };
      });

      setVisitas(visitasComCheckin);
    } catch (error) {
      // ignored
    } finally {
      setLoading(false);
    }
  };

  const loadPecas = async () => {
    try {
      const { data, error } = await supabase
        .from('requisicoes_pecas')
        .select(`
          id,
          codigo_peca,
          descricao,
          quantidade_requisitada,
          status,
          peca_estoque:estoque_pecas!requisicoes_pecas_peca_estoque_id_fkey(
            id_numerico,
            status
          )
        `)
        .eq('os_id', os.id)
        .not('status', 'in', '("cancelada","reprovada")')
        .order('created_at', { ascending: true });

      if (error) throw error;

      const pecasFormatadas: PecaOS[] = (data || []).map((req: any) => ({
        id: req.id,
        id_numerico: req.peca_estoque?.id_numerico || 0,
        codigo_peca: req.codigo_peca,
        descricao: req.descricao || '',
        status: req.peca_estoque?.status || 'sem_peca',
        req_status: req.status,
        quantidade_requisitada: req.quantidade_requisitada,
      }));

      setPecas(pecasFormatadas);
    } catch (error) {
      // ignored
    }
  };

  const openMaps = () => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(enderecoCompleto)}`, '_blank');
  };

  const openWaze = () => {
    window.open(`https://waze.com/ul?q=${encodeURIComponent(enderecoCompleto)}`, '_blank');
  };

  const openWhatsApp = () => {
    const phone = os.cliente_telefone.replace(/\D/g, '');
    window.open(`https://wa.me/55${phone}`, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto">
      <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-4 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">
              OS #{os.numero_os_samsung || os.numero_os_interna || 'S/N'}
            </h2>
            <p className="text-gray-400 text-sm">{os.cliente_nome}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          <div className="bg-gray-800 rounded-xl p-4 space-y-3">
            <h3 className="text-white font-bold flex items-center gap-2">
              <Package className="w-5 h-5 text-cyan-400" />
              Equipamento
            </h3>
            <div className="space-y-2">
              <div>
                <p className="text-gray-400 text-sm">Marca</p>
                <p className="text-white font-medium">{os.aparelho_marca || 'Não informado'}</p>
              </div>
              <div>
                <p className="text-gray-400 text-sm">Modelo</p>
                <p className="text-white font-medium">{os.aparelho_modelo || 'Não informado'}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-800 rounded-xl p-4 space-y-3">
            <h3 className="text-white font-bold flex items-center gap-2">
              <FileText className="w-5 h-5 text-cyan-400" />
              Tipo de Atendimento
            </h3>
            <div className="space-y-2">
              <div>
                <p className="text-gray-400 text-sm">Tipo de Atendimento</p>
                <p className="text-white font-medium">
                  {formatTipoAtendimento(os.tipo_atendimento)}
                </p>
              </div>
              {os.tipo_reparo && (
                <div>
                  <p className="text-gray-400 text-sm">Tipo de Reparo</p>
                  <p className="text-white font-medium">{os.tipo_reparo}</p>
                </div>
              )}
              {os.tipo_os && (
                <div>
                  <p className="text-gray-400 text-sm">Tipo de OS</p>
                  <p className="text-white font-medium">{os.tipo_os}</p>
                </div>
              )}
            </div>
          </div>

          {os.defeito_relatado && (
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="text-white font-bold mb-2">Defeito Relatado</h3>
              <p className="text-gray-300">{os.defeito_relatado}</p>
            </div>
          )}

          {os.observacoes && (
            <div className="bg-gray-800 rounded-xl p-4">
              <h3 className="text-white font-bold mb-2">Observações</h3>
              <p className="text-gray-300">{os.observacoes}</p>
            </div>
          )}

          <div className="bg-gray-800 rounded-xl p-4 space-y-3">
            <h3 className="text-white font-bold flex items-center gap-2">
              <MapPin className="w-5 h-5 text-cyan-400" />
              Endereço
            </h3>
            <p className="text-white">{enderecoCompleto}</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={openWaze}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-cyan-500/20 border border-cyan-500/50 rounded-xl text-cyan-400 font-medium hover:bg-cyan-500/30 transition-all"
              >
                <Navigation className="w-5 h-5" />
                Waze
              </button>
              <button
                onClick={openMaps}
                className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-500/20 border border-blue-500/50 rounded-xl text-blue-400 font-medium hover:bg-blue-500/30 transition-all"
              >
                <MapPin className="w-5 h-5" />
                Maps
              </button>
            </div>
          </div>

          {os.cliente_telefone && (
            <div className="bg-gray-800 rounded-xl p-4 space-y-3">
              <h3 className="text-white font-bold flex items-center gap-2">
                <Phone className="w-5 h-5 text-cyan-400" />
                Contato
              </h3>
              <div className="flex items-center justify-between">
                <p className="text-white">{os.cliente_telefone}</p>
                <button
                  onClick={openWhatsApp}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500/20 border border-green-500/50 rounded-lg text-green-400 font-medium hover:bg-green-500/30 transition-all"
                >
                  <Phone className="w-4 h-4" />
                  WhatsApp
                </button>
              </div>
            </div>
          )}

          {/* Pecas da OS */}
          {pecas.length > 0 && (
            <div className="bg-gray-800 rounded-xl p-4 space-y-3">
              <h3 className="text-white font-bold flex items-center gap-2">
                <Wrench className="w-5 h-5 text-cyan-400" />
                Pecas da OS ({pecas.length})
              </h3>
              <div className="space-y-2">
                {pecas.map((peca) => {
                  const statusInfo = PECA_STATUS_LABELS[peca.status] || { label: peca.status.replace(/_/g, ' '), color: 'text-gray-400' };
                  return (
                    <div key={peca.id} className="bg-gray-700/50 rounded-lg p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-white font-mono text-sm font-bold">{peca.codigo_peca}</p>
                          {peca.descricao && (
                            <p className="text-gray-400 text-xs mt-0.5 line-clamp-1">{peca.descricao}</p>
                          )}
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {peca.id_numerico > 0 && (
                              <span className="text-xs text-cyan-400 font-mono bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded">
                                #{peca.id_numerico}
                              </span>
                            )}
                            <span className={`text-xs font-medium ${statusInfo.color}`}>
                              {statusInfo.label}
                            </span>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="text-gray-400 text-xs">Qtd: {peca.quantidade_requisitada}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Seção de Visitas */}
          <div className="bg-gray-800 rounded-xl p-4 space-y-3">
            <h3 className="text-white font-bold flex items-center gap-2">
              <Calendar className="w-5 h-5 text-cyan-400" />
              Visitas Agendadas
            </h3>

            {loading ? (
              <div className="flex justify-center py-4">
                <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="space-y-3">
                {visitas.map((visita, index) => (
                  <div key={visita.id} className="bg-gray-700/50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-cyan-500/20 flex items-center justify-center">
                          <span className="text-cyan-400 font-bold text-xs">{visitas.length - index}</span>
                        </div>
                        <span className="text-white font-semibold text-sm">
                          Visita {visitas.length - index}
                        </span>
                      </div>
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${
                        visita.status === 'em_andamento' ? 'bg-yellow-500/20 text-yellow-400' :
                        visita.status === 'concluido' ? 'bg-green-500/20 text-green-400' :
                        'bg-cyan-500/20 text-cyan-400'
                      }`}>
                        {visita.status === 'em_andamento' ? 'Em Andamento' :
                         visita.status === 'concluido' ? 'Concluído' :
                         visita.status === 'confirmado' ? 'Confirmado' : 'Pendente'}
                      </span>
                    </div>

                    <p className="text-gray-300 text-xs">
                      {new Date(visita.data_agendamento + 'T00:00:00').toLocaleDateString('pt-BR')}
                    </p>

                    {os.tipo_atendimento !== 'IH' && (
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedVisitaForChecklist(visita.id);
                            setChecklistModalOpen(true);
                          }}
                          className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-cyan-500/20 border border-cyan-500/50 rounded-lg text-cyan-400 text-xs font-medium hover:bg-cyan-500/30 transition-all"
                        >
                          <ClipboardList className="w-4 h-4" />
                          Checklist
                        </button>

                        {!visita.checkin_realizado && visita.status !== 'concluido' && (
                          <button
                            onClick={() => {
                              setProcessingCheckin(visita.id);
                              setSelectedAgendamento(visita);
                              setCheckinModalOpen(true);
                            }}
                            disabled={processingCheckin === visita.id}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                              processingCheckin === visita.id
                                ? 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 cursor-wait'
                                : 'bg-green-500/20 border border-green-500/50 text-green-400 hover:bg-green-500/30'
                            }`}
                          >
                            {processingCheckin === visita.id ? (
                              <>
                                <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                                Processando...
                              </>
                            ) : (
                              <>
                                <Navigation className="w-4 h-4" />
                                Check-in
                              </>
                            )}
                          </button>
                        )}

                        {visita.checkin_realizado && !visita.checkout_realizado && visita.status !== 'concluido' && (
                          <button
                            onClick={() => {
                              setProcessingCheckout(visita.id);
                              setSelectedAgendamento(visita);
                              setCheckoutModalOpen(true);
                            }}
                            disabled={processingCheckout === visita.id}
                            className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                              processingCheckout === visita.id
                                ? 'bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 cursor-wait'
                                : 'bg-blue-500/20 border border-blue-500/50 text-blue-400 hover:bg-blue-500/30'
                            }`}
                          >
                            {processingCheckout === visita.id ? (
                              <>
                                <div className="w-4 h-4 border-2 border-yellow-400 border-t-transparent rounded-full animate-spin" />
                                Processando...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="w-4 h-4" />
                                Check-out
                              </>
                            )}
                          </button>
                        )}
                      </div>
                    )}

                    {visita.checkin_realizado && (
                      <div className="text-xs text-gray-400 pt-2 border-t border-gray-600">
                        Check-in: {new Date(visita.checkin_hora).toLocaleString('pt-BR')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 bg-gray-900 border-t border-gray-700 p-4">
          <button
            onClick={onStart}
            className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-bold rounded-xl hover:from-cyan-600 hover:to-blue-600 transition-all"
          >
            {estaEmAndamento ? (
              <>
                <CheckCircle className="w-6 h-6" />
                Continuar Atendimento
              </>
            ) : (
              <>
                <PlayCircle className="w-6 h-6" />
                Iniciar Atendimento
              </>
            )}
          </button>
        </div>
      </div>

      {/* Modais */}
      {checkinModalOpen && selectedAgendamento && (
        <CheckinModal
          agendamento={selectedAgendamento}
          onClose={() => {
            setCheckinModalOpen(false);
            setSelectedAgendamento(null);
            setProcessingCheckin(null);
          }}
          onSuccess={() => {
            loadVisitas();
            setProcessingCheckin(null);
          }}
        />
      )}

      {checkoutModalOpen && selectedAgendamento && (
        <CheckoutModal
          agendamento={selectedAgendamento}
          onClose={() => {
            setCheckoutModalOpen(false);
            setSelectedAgendamento(null);
            setProcessingCheckout(null);
          }}
          onSuccess={() => {
            loadVisitas();
            setProcessingCheckout(null);
          }}
        />
      )}

      {checklistModalOpen && selectedVisitaForChecklist && (
        <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-gray-900 border border-gray-700 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gray-900 border-b border-gray-700 p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-cyan-500/20 flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-cyan-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Checklist Técnico</h3>
                  <p className="text-sm text-gray-400">
                    Visita {visitas.length - visitas.findIndex(v => v.id === selectedVisitaForChecklist)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setChecklistModalOpen(false);
                  setSelectedVisitaForChecklist(null);
                }}
                className="p-2 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            <div className="p-4">
              <AgendamentoChecklistSection
                agendamentoId={selectedVisitaForChecklist}
                unidadeId={os.id}
                tipoOS={os.tipo_os || ''}
                tipoAtendimento={os.tipo_atendimento}
                osId={os.id}
                isReadOnly={false}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
