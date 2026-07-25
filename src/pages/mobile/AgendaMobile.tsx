import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, Clock, Phone, RefreshCw, CheckCircle, PlayCircle, Calendar as CalendarIcon, Package, Navigation, Eye } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { OSDetailsModal } from '../../components/mobile/OSDetailsModal';

interface AgendamentoOS {
  id: string;
  agendamento_id: string;
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
  coluna_kanban: string;
  data_agendamento: string;
  periodo_agendamento: string;
  confirmado_com_cliente: boolean;
  aparelho_marca: string | null;
  aparelho_modelo: string | null;
  defeito_relatado: string | null;
  observacoes: string | null;
  latitude: number | null;
  longitude: number | null;
  agendamento_status: string;
  checkin_realizado: boolean;
  checkout_realizado: boolean;
  resultado_visita: string | null;
}

export function AgendaMobile() {
  const navigate = useNavigate();
  const { usuario } = useAuth();
  const [agendamentos, setAgendamentos] = useState<AgendamentoOS[]>([]);
  const [loading, setLoading] = useState(true);
  const [dataFiltro, setDataFiltro] = useState(new Date().toISOString().split('T')[0]);
  const [selectedOS, setSelectedOS] = useState<AgendamentoOS | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  const loadAgendamentos = async () => {
    if (!usuario) return;

    setLoading(true);
    const { data, error } = await supabase
      .from('agendamentos')
      .select(`
        id,
        os_id,
        data_agendamento,
        horario_inicio,
        horario_fim,
        confirmado_com_cliente,
        status,
        checkin_realizado,
        checkout_realizado,
        resultado_visita,
        os:os_id (
          numero_os_interna,
          numero_os_samsung,
          tipo_atendimento,
          tipo_reparo,
          tipo_os,
          cliente_nome,
          cliente_telefone,
          cliente_endereco,
          cliente_bairro,
          cliente_cidade,
          cliente_cep,
          coluna_kanban,
          aparelho_marca,
          aparelho_modelo,
          defeito_relatado,
          observacoes_internas
        )
      `)
      .eq('tecnico_id', usuario.id)
      .eq('data_agendamento', dataFiltro)
      .not('status', 'in', '(cancelado)')
      .order('horario_inicio', { ascending: true });

    if (!error && data) {
      const mappedData = data.map(item => ({
        id: item.os_id,
        agendamento_id: item.id,
        numero_os_interna: item.os?.numero_os_interna,
        numero_os_samsung: item.os?.numero_os_samsung,
        tipo_atendimento: item.os?.tipo_atendimento,
        tipo_reparo: item.os?.tipo_reparo,
        tipo_os: item.os?.tipo_os,
        cliente_nome: item.os?.cliente_nome,
        cliente_telefone: item.os?.cliente_telefone,
        cliente_endereco: item.os?.cliente_endereco,
        cliente_bairro: item.os?.cliente_bairro,
        cliente_cidade: item.os?.cliente_cidade,
        cliente_cep: item.os?.cliente_cep,
        coluna_kanban: item.os?.coluna_kanban,
        data_agendamento: item.data_agendamento,
        periodo_agendamento: item.horario_inicio < '12:00' ? 'manha' : 'tarde',
        confirmado_com_cliente: item.confirmado_com_cliente,
        aparelho_marca: item.os?.aparelho_marca,
        aparelho_modelo: item.os?.aparelho_modelo,
        defeito_relatado: item.os?.defeito_relatado,
        observacoes: item.os?.observacoes_internas,
        latitude: null,
        longitude: null,
        agendamento_status: item.status,
        checkin_realizado: item.checkin_realizado,
        checkout_realizado: item.checkout_realizado,
        resultado_visita: (item as any).resultado_visita || null
      }));
      setAgendamentos(mappedData as any[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadAgendamentos();
  }, [usuario, dataFiltro]);

  const getStatusBadge = (os: AgendamentoOS) => {
    if (os.checkin_realizado && os.checkout_realizado) {
      if (os.resultado_visita) {
        const resultadoMap: Record<string, { label: string; color: string }> = {
          'reparo_sucesso': { label: 'Reparo com Sucesso', color: 'bg-green-500/20 text-green-400 border-green-500/50' },
          'peca_defeito': { label: 'Peça com Defeito', color: 'bg-red-500/20 text-red-400 border-red-500/50' },
          'improdutiva_revisita': { label: 'Improdutiva / Revisita', color: 'bg-amber-500/20 text-amber-400 border-amber-500/50' },
        };
        return resultadoMap[os.resultado_visita] || { label: os.resultado_visita, color: 'bg-gray-500/20 text-gray-400 border-gray-500/50' };
      }
      return { label: 'Finalizado', color: 'bg-green-500/20 text-green-400 border-green-500/50' };
    }
    if (os.checkin_realizado) {
      return { label: 'Em Atendimento', color: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/50' };
    }
    return { label: 'Disponível', color: 'bg-blue-500/20 text-blue-400 border-blue-500/50' };
  };

  const getCardBorderColor = (os: AgendamentoOS) => {
    if (os.checkin_realizado && os.checkout_realizado) {
      return 'border-green-500/30';
    }
    if (os.checkin_realizado) {
      return 'border-yellow-500/50';
    }
    return 'border-blue-500/50';
  };

  const getPeriodoLabel = (periodo: string) => {
    const periodos: Record<string, string> = {
      'manha': 'Manhã (08:00 - 12:00)',
      'tarde': 'Tarde (13:00 - 18:00)',
      'noite': 'Noite (18:00 - 21:00)'
    };
    return periodos[periodo?.toLowerCase()] || periodo || 'Não especificado';
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Agenda do Dia</h1>
          <p className="text-gray-400 text-sm">{agendamentos.length} OS agendadas</p>
        </div>
        <button
          onClick={loadAgendamentos}
          disabled={loading}
          className="p-3 bg-cyan-500/20 border border-cyan-500/50 rounded-xl text-cyan-400 hover:bg-cyan-500/30 transition-colors"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="relative">
        <CalendarIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
        <input
          type="date"
          value={dataFiltro}
          onChange={(e) => setDataFiltro(e.target.value)}
          className="w-full pl-11 pr-4 py-3 bg-gray-900 border border-gray-700 rounded-xl text-white focus:outline-none focus:border-cyan-500"
        />
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : agendamentos.length === 0 ? (
        <div className="text-center py-12">
          <CalendarIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400">Nenhuma OS agendada para este dia</p>
        </div>
      ) : (
        <div className="space-y-3">
          {agendamentos.map((os, index) => {
            const status = getStatusBadge(os);
            const borderColor = getCardBorderColor(os);

            return (
              <div
                key={os.id}
                className={`bg-gray-900 border-2 ${borderColor} rounded-xl p-4 space-y-3`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="px-2 py-1 bg-gray-800 border border-gray-600 rounded text-gray-300 text-xs font-bold">
                        #{index + 1}
                      </span>
                      <span className="text-white font-bold text-lg">
                        OS #{os.numero_os_samsung || os.numero_os_interna || 'S/N'}
                      </span>
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${status.color}`}>
                        {status.label}
                      </span>
                    </div>
                    <p className="text-gray-400 text-sm mb-1">
                      {os.tipo_atendimento === 'IH'
                        ? `IH - ${os.tipo_reparo || 'Reparo não especificado'}`
                        : os.tipo_atendimento || 'Serviço não especificado'}
                    </p>
                    {(os.aparelho_marca || os.aparelho_modelo) && (
                      <div className="flex items-center gap-2 mt-2">
                        <Package className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                        <p className="text-white text-sm font-medium">
                          {os.aparelho_marca || ''} {os.aparelho_modelo || ''}
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                    <span className="text-gray-300 text-sm">{getPeriodoLabel(os.periodo_agendamento)}</span>
                  </div>

                  <div className="flex items-start gap-2">
                    <MapPin className="w-4 h-4 text-cyan-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-medium text-sm">{os.cliente_nome}</p>
                      <p className="text-gray-400 text-sm">{os.cliente_endereco || 'Endereço não cadastrado'}</p>
                    </div>
                  </div>

                  {os.cliente_telefone && (
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-cyan-400 flex-shrink-0" />
                      <a
                        href={`https://wa.me/55${os.cliente_telefone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-cyan-400 text-sm hover:underline"
                      >
                        {os.cliente_telefone}
                      </a>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  {os.checkin_realizado && os.checkout_realizado ? (
                    <div className="flex-1 flex gap-2">
                      <button
                        onClick={() => navigate(`/mobile/execucao/${os.id}?visita=${os.agendamento_id}`)}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-3 bg-gray-700/80 text-gray-200 font-medium rounded-xl hover:bg-gray-600/80 transition-all border border-gray-600/50"
                      >
                        <Eye className="w-4 h-4" />
                        Ver Detalhes
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        setSelectedOS(os);
                        setShowDetailsModal(true);
                      }}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white font-medium rounded-xl hover:from-cyan-600 hover:to-blue-600 transition-all"
                    >
                      {os.checkin_realizado ? (
                        <>
                          <CheckCircle className="w-5 h-5" />
                          Continuar
                        </>
                      ) : (
                        <>
                          <PlayCircle className="w-5 h-5" />
                          Iniciar Atendimento
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showDetailsModal && selectedOS && (
        <OSDetailsModal
          os={selectedOS}
          onClose={() => {
            setShowDetailsModal(false);
            setSelectedOS(null);
          }}
          onStart={() => {
            setShowDetailsModal(false);
            navigate(`/mobile/execucao/${selectedOS.id}`);
          }}
        />
      )}
    </div>
  );
}
