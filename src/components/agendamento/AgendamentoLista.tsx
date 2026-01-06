import { useRef, useState } from 'react';
import { Calendar, MapPin, User, Phone, Package, DollarSign, Clock, CheckCircle, AlertCircle, FileText } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import type { Database } from '../../lib/database.types';
import { AgendamentoPDF } from './AgendamentoPDF';
import { supabase } from '../../lib/supabase';

type Agendamento = Database['public']['Tables']['agendamentos']['Row'] & {
  os: {
    numero_os_samsung?: string;
    numero_os_interna?: string;
    cliente_nome: string;
    cliente_telefone?: string;
    cliente_endereco?: string;
    cliente_bairro?: string;
    cliente_cidade?: string;
    cliente_estado?: string;
    cliente_cep?: string;
    tipo_atendimento: string;
    coluna_kanban: string;
    defeito_relatado?: string;
    observacoes_internas?: string;
  };
  tecnico: {
    nome: string;
  };
  unidade: {
    nome: string;
  };
  tem_pecas?: number;
  tem_checkin?: number;
  tem_checkout?: number;
};

interface AgendamentoListaProps {
  agendamentos: Agendamento[];
  onAgendamentoClick: (agendamento: Agendamento) => void;
  onCheckinClick: (agendamento: Agendamento) => void;
  onCheckoutClick: (agendamento: Agendamento) => void;
}

export function AgendamentoLista({
  agendamentos,
  onAgendamentoClick,
  onCheckinClick,
  onCheckoutClick
}: AgendamentoListaProps) {
  const pdfRef = useRef<HTMLDivElement>(null);
  const [pdfData, setPdfData] = useState<{
    agendamento: any;
    checkinData: any;
    checkoutData: any;
    checklistRespostas: any[];
  } | null>(null);

  const handlePrint = useReactToPrint({
    content: () => pdfRef.current,
    documentTitle: `Agendamento_${pdfData?.agendamento?.os?.numero_os_samsung || 'SN'}`,
  });

  const loadPdfData = async (agendamento: Agendamento) => {
    try {
      const { data: checkinCheckoutData } = await supabase
        .from('agendamentos_checkin_checkout')
        .select('*')
        .eq('agendamento_id', agendamento.id)
        .order('data_hora', { ascending: true });

      const checkinData = checkinCheckoutData?.find(c => c.tipo === 'checkin');
      const checkoutData = checkinCheckoutData?.find(c => c.tipo === 'checkout');

      const { data: checklistRespostas } = await supabase
        .from('agendamento_checklist_respostas')
        .select('*')
        .eq('agendamento_id', agendamento.id)
        .order('item_ordem', { ascending: true });

      setPdfData({
        agendamento,
        checkinData,
        checkoutData,
        checklistRespostas: checklistRespostas || []
      });

      setTimeout(() => {
        handlePrint();
      }, 100);
    } catch (error) {
      alert('Erro ao gerar PDF');
    }
  };

  const agruparPorData = () => {
    const grupos: Record<string, Agendamento[]> = {};
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);
    const proximaSemana = new Date(hoje);
    proximaSemana.setDate(proximaSemana.getDate() + 7);

    agendamentos.forEach((agendamento) => {
      const dataAgendamento = new Date(agendamento.data_agendamento);
      dataAgendamento.setHours(0, 0, 0, 0);

      let label = '';
      if (dataAgendamento.getTime() === hoje.getTime()) {
        label = 'Hoje';
      } else if (dataAgendamento.getTime() === amanha.getTime()) {
        label = 'Amanhã';
      } else if (dataAgendamento < proximaSemana) {
        label = 'Próximos 7 dias';
      } else {
        label = 'Futuros';
      }

      if (!grupos[label]) {
        grupos[label] = [];
      }
      grupos[label].push(agendamento);
    });

    return grupos;
  };

  const grupos = agruparPorData();
  const ordem = ['Hoje', 'Amanhã', 'Próximos 7 dias', 'Futuros'];

  const getRotaColor = (colunaKanban: string) => {
    const cores: Record<string, string> = {
      rota_preta: '#1a1a1a',
      rota_vermelha: '#ef4444',
      rota_azul: '#3b82f6',
      rota_verde: '#10b981',
      rota_rosa: '#ec4899',
      rota_amarela: '#eab308',
      rota_laranja: '#f97316'
    };
    return cores[colunaKanban] || '#6B7280';
  };

  const getRotaTextColor = (colunaKanban: string) => {
    if (colunaKanban === 'rota_preta') {
      return '#ffffff';
    }
    return getRotaColor(colunaKanban);
  };

  const getRotaLabel = (colunaKanban: string) => {
    return colunaKanban.replace('rota_', '').replace('_', ' ').toUpperCase();
  };

  const getStatusBadge = (agendamento: Agendamento) => {
    const statusConfig: Record<string, { label: string; color: string }> = {
      pendente_confirmacao: { label: 'PENDENTE CONFIRMAÇÃO', color: '#FFBF00' },
      confirmado: { label: 'CONFIRMADO', color: '#39FF14' },
      em_andamento: { label: 'EM ANDAMENTO', color: '#00D4FF' },
      concluido: { label: 'CONCLUÍDO', color: '#10b981' },
      cancelado: { label: 'CANCELADO', color: '#FF0064' }
    };

    const config = statusConfig[agendamento.status] || { label: agendamento.status.toUpperCase(), color: '#6B7280' };

    return (
      <span
        className="px-2 py-1 rounded text-xs font-bold uppercase"
        style={{
          backgroundColor: `${config.color}20`,
          color: config.color,
          border: `1px solid ${config.color}60`
        }}
      >
        {config.label}
      </span>
    );
  };

  if (agendamentos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <Calendar className="w-16 h-16 text-gray-600 mb-4" />
        <p className="text-gray-500 text-center">
          Nenhum agendamento encontrado
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {ordem.map((label) => {
        const agendamentosGrupo = grupos[label];
        if (!agendamentosGrupo || agendamentosGrupo.length === 0) return null;

        return (
          <div key={label}>
            <h3 className="text-[#00D4FF] font-bold text-lg mb-4 flex items-center gap-2">
              <Calendar className="w-5 h-5" />
              {label}
              <span className="text-sm text-gray-400">({agendamentosGrupo.length})</span>
            </h3>
            <div className="space-y-3">
              {agendamentosGrupo.map((agendamento) => (
                <div
                  key={agendamento.id}
                  className="premium-card p-4 hover-lift cursor-pointer"
                  onClick={() => onAgendamentoClick(agendamento)}
                  style={{
                    borderLeftWidth: '4px',
                    borderLeftColor: getRotaTextColor(agendamento.os.coluna_kanban)
                  }}
                >
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h4 className="text-white font-bold">
                          {agendamento.os.numero_os_samsung || agendamento.os.numero_os_interna || 'S/N'}
                        </h4>
                        {getStatusBadge(agendamento)}
                        {agendamento.confirmado_com_cliente && (
                          <span
                            className="px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1"
                            style={{
                              backgroundColor: '#39FF1430',
                              color: '#39FF14',
                              border: '1px solid #39FF1460'
                            }}
                          >
                            <CheckCircle className="w-3 h-3" />
                            CONFIRMADO
                          </span>
                        )}
                        {agendamento.checkout_pendente && (
                          <span
                            className="px-2 py-0.5 rounded text-xs font-bold flex items-center gap-1"
                            style={{
                              backgroundColor: '#FF006430',
                              color: '#FF0064',
                              border: '1px solid #FF006460'
                            }}
                          >
                            <AlertCircle className="w-3 h-3" />
                            CHECKOUT PENDENTE
                          </span>
                        )}
                      </div>
                      <p className="text-gray-300 font-semibold text-sm">{agendamento.os.cliente_nome}</p>
                    </div>
                    <span
                      className="px-3 py-1 rounded text-xs font-bold"
                      style={{
                        backgroundColor: `${getRotaColor(agendamento.os.coluna_kanban)}30`,
                        color: getRotaTextColor(agendamento.os.coluna_kanban),
                        border: `1px solid ${getRotaTextColor(agendamento.os.coluna_kanban)}60`,
                        filter: 'brightness(1.5)'
                      }}
                    >
                      {getRotaLabel(agendamento.os.coluna_kanban)}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                    <div className="flex items-center gap-2 text-gray-400">
                      <Calendar className="w-3 h-3 text-[#00D4FF]" />
                      <span>{new Date(agendamento.data_agendamento).toLocaleDateString('pt-BR')}</span>
                    </div>
                    <div className="flex items-center gap-2 text-gray-400">
                      <Clock className="w-3 h-3 text-[#00D4FF]" />
                      <span>{agendamento.horario_inicio.slice(0, 5)} - {agendamento.horario_fim.slice(0, 5)}</span>
                    </div>
                    {agendamento.os.cliente_telefone && (
                      <div className="flex items-center gap-2 text-gray-400">
                        <Phone className="w-3 h-3 text-[#00D4FF]" />
                        <span>{agendamento.os.cliente_telefone}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-gray-400">
                      <User className="w-3 h-3 text-[#00D4FF]" />
                      <span>{agendamento.tecnico.nome}</span>
                    </div>
                  </div>

                  {agendamento.os.cliente_endereco && (
                    <div className="mt-3 pt-3 border-t border-gray-700">
                      <div className="flex items-start gap-2 text-xs text-gray-400">
                        <MapPin className="w-3 h-3 text-[#00D4FF] flex-shrink-0 mt-0.5" />
                        <span>
                          {agendamento.os.cliente_endereco}
                          {agendamento.os.cliente_bairro && `, ${agendamento.os.cliente_bairro}`}
                          {agendamento.os.cliente_cidade && `, ${agendamento.os.cliente_cidade}`}
                          {agendamento.os.cliente_estado && ` - ${agendamento.os.cliente_estado}`}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="mt-3 pt-3 border-t border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-3 text-xs">
                      {agendamento.tem_pecas && agendamento.tem_pecas > 0 && (
                        <span className="flex items-center gap-1 text-[#FFBF00]">
                          <Package className="w-3 h-3" />
                          Peças
                        </span>
                      )}
                      {agendamento.os.tipo_atendimento && (
                        <span
                          className="px-2 py-0.5 rounded font-bold"
                          style={{
                            backgroundColor: agendamento.os.tipo_atendimento === 'IH' ? '#10b98130' : '#f9731630',
                            color: agendamento.os.tipo_atendimento === 'IH' ? '#10b981' : '#f97316',
                            border: `1px solid ${agendamento.os.tipo_atendimento === 'IH' ? '#10b981' : '#f97316'}60`
                          }}
                        >
                          {agendamento.os.tipo_atendimento}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {!agendamento.tem_checkin && agendamento.status !== 'cancelado' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onCheckinClick(agendamento);
                          }}
                          className="neon-button px-4 py-1 text-xs"
                        >
                          Check-in
                        </button>
                      )}
                      {agendamento.tem_checkin && !agendamento.tem_checkout && agendamento.status === 'em_andamento' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onCheckoutClick(agendamento);
                          }}
                          className="neon-button px-4 py-1 text-xs"
                          style={{
                            backgroundColor: '#39FF1420',
                            borderColor: '#39FF14',
                            color: '#39FF14'
                          }}
                        >
                          Check-out
                        </button>
                      )}
                      {agendamento.tem_checkout && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            loadPdfData(agendamento);
                          }}
                          className="neon-button px-4 py-1 text-xs flex items-center gap-1"
                          style={{
                            backgroundColor: '#00D4FF20',
                            borderColor: '#00D4FF',
                            color: '#00D4FF'
                          }}
                        >
                          <FileText className="w-3 h-3" />
                          PDF
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {pdfData && (
        <div className="hidden">
          <AgendamentoPDF
            ref={pdfRef}
            agendamento={pdfData.agendamento}
            checkinData={pdfData.checkinData}
            checkoutData={pdfData.checkoutData}
            checklistRespostas={pdfData.checklistRespostas}
          />
        </div>
      )}
    </div>
  );
}
