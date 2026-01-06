import { useState, useEffect } from 'react';
import { Calendar, Clock, User, MapPin, ChevronLeft, ChevronRight, Filter, CheckCircle, XCircle, AlertTriangle, FileText, ExternalLink } from 'lucide-react';
import { useOtimizador } from '../../contexts/OtimizadorContext';
import { supabase } from '../../lib/supabase';
import OSDetailsModal from '../OSDetailsModal';

interface AgendamentoOS {
  id: string;
  numero_os_interna: string;
  numero_os_samsung: string | null;
  cliente_nome: string;
  cliente_endereco: string;
  data_agendamento: string;
  coluna_kanban: string;
  tecnico_agendado_id: string | null;
  confirmado_com_cliente: boolean;
  rota_id: string | null;
  tipo_atendimento: string;
  tipo_reparo: string | null;
  tecnico?: {
    id: string;
    nome: string;
  };
  rota?: {
    id: string;
    nome: string;
    cor: string;
  };
  agendamento_detalhes?: {
    horario_inicio: string;
    horario_fim: string;
    status: string;
  };
}

interface TecnicoDay {
  tecnico_id: string | null;
  tecnico_nome: string;
  agendamentos: AgendamentoOS[];
}

interface Filtros {
  tecnico_id: string | null;
  rota_id: string | null;
  status: string | null;
}

const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export default function AgendaOperacional() {
  const { selectedUnidade, loading } = useOtimizador();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [agendamentos, setAgendamentos] = useState<AgendamentoOS[]>([]);
  const [tecnicos, setTecnicos] = useState<{ id: string; nome: string }[]>([]);
  const [rotas, setRotas] = useState<{ id: string; nome: string; cor: string }[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filtros, setFiltros] = useState<Filtros>({
    tecnico_id: null,
    rota_id: null,
    status: null,
  });
  const [selectedOSId, setSelectedOSId] = useState<string | null>(null);

  // Helper function to format date as YYYY-MM-DD in local timezone
  const formatDateLocal = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  useEffect(() => {
    if (selectedUnidade) {
      loadTecnicos();
      loadRotas();
      loadAgendamentos();
    }
  }, [selectedUnidade, currentDate, filtros]);

  const loadTecnicos = async () => {
    try {
      const { data, error } = await supabase
        .from('usuarios')
        .select('id, nome')
        .eq('unidade_id', selectedUnidade)
        .in('tipo', ['tecnico', 'tecnico_ih'])
        .eq('ativo', true)
        .order('nome');

      if (error) throw error;
      setTecnicos(data || []);
    } catch (error) {
    }
  };

  const loadRotas = async () => {
    try {
      const { data, error } = await supabase
        .from('rotas')
        .select('id, nome, cor')
        .eq('unidade_id', selectedUnidade)
        .eq('ativa', true)
        .order('nome');

      if (error) throw error;
      setRotas(data || []);
    } catch (error) {
    }
  };

  const loadAgendamentos = async () => {
    setLoadingData(true);
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

      const startDateStr = formatDateLocal(startOfMonth);
      const endDateStr = formatDateLocal(endOfMonth);

      let query = supabase
        .from('os')
        .select(`
          id,
          numero_os_interna,
          numero_os_samsung,
          cliente_nome,
          cliente_endereco,
          cliente_cidade,
          data_agendamento,
          periodo_agendamento,
          coluna_kanban,
          tecnico_agendado_id,
          confirmado_com_cliente,
          rota_id,
          tipo_atendimento,
          tipo_reparo,
          tipo_os,
          tecnico:usuarios!os_tecnico_agendado_id_fkey(id, nome),
          rota:rotas!os_rota_id_fkey(id, nome, cor)
        `)
        .eq('unidade_id', selectedUnidade)
        .eq('confirmado_com_cliente', true)
        .not('data_agendamento', 'is', null)
        .gte('data_agendamento', startDateStr)
        .lte('data_agendamento', endDateStr);

      if (filtros.tecnico_id) {
        query = query.eq('tecnico_agendado_id', filtros.tecnico_id);
      }

      if (filtros.rota_id) {
        query = query.eq('rota_id', filtros.rota_id);
      }

      if (filtros.status) {
        if (filtros.status === 'perdida') {
          query = query.eq('coluna_kanban', 'agendada').lt('data_agendamento', formatDateLocal(new Date()));
        } else if (filtros.status === 'pendente') {
          query = query.eq('coluna_kanban', 'agendada');
        } else if (filtros.status === 'em_atendimento') {
          query = query.eq('coluna_kanban', 'em_atendimento');
        } else if (filtros.status === 'concluida') {
          query = query.in('coluna_kanban', ['concluida', 'fechada']);
        }
      }

      query = query.order('data_agendamento').order('created_at');

      const { data, error } = await query;

      if (error) throw error;

      const agendamentosComDetalhes = await Promise.all(
        (data || []).map(async (os) => {
          const { data: agendamentoData } = await supabase
            .from('agendamentos')
            .select('horario_inicio, horario_fim, status')
            .eq('os_id', os.id)
            .maybeSingle();

          return {
            ...os,
            agendamento_detalhes: agendamentoData || {
              horario_inicio: '08:00:00',
              horario_fim: '10:00:00',
              status: 'pendente',
            },
          };
        })
      );

      setAgendamentos(agendamentosComDetalhes);
    } catch (error) {
    } finally {
      setLoadingData(false);
    }
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: Date[] = [];

    for (let i = 0; i < startingDayOfWeek; i++) {
      const prevDate = new Date(year, month, -startingDayOfWeek + i + 1);
      days.push(prevDate);
    }

    for (let i = 1; i <= daysInMonth; i++) {
      days.push(new Date(year, month, i));
    }

    const remainingDays = 42 - days.length;
    for (let i = 1; i <= remainingDays; i++) {
      days.push(new Date(year, month + 1, i));
    }

    return days;
  };

  const getAgendamentosForDate = (date: Date) => {
    const dateStr = formatDateLocal(date);
    return agendamentos.filter(ag => ag.data_agendamento === dateStr);
  };

  const getAgendamentosForDay = (): TecnicoDay[] => {
    const dateStr = formatDateLocal(selectedDate);
    const dayAgendamentos = agendamentos.filter(ag => ag.data_agendamento === dateStr);

    const tecnicoMap = new Map<string, TecnicoDay>();

    dayAgendamentos.forEach(ag => {
      const tecId = ag.tecnico_agendado_id || 'sem_tecnico';

      if (!tecnicoMap.has(tecId)) {
        tecnicoMap.set(tecId, {
          tecnico_id: ag.tecnico_agendado_id || null,
          tecnico_nome: ag.tecnico?.nome || 'Sem Técnico Atribuído',
          agendamentos: [],
        });
      }

      tecnicoMap.get(tecId)!.agendamentos.push(ag);
    });

    return Array.from(tecnicoMap.values());
  };

  const previousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isSelectedDate = (date: Date) => {
    return date.toDateString() === selectedDate.toDateString();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  const getStatusInfo = (os: AgendamentoOS) => {
    const hoje = formatDateLocal(new Date());
    const dataAgendamento = os.data_agendamento;

    if (os.coluna_kanban === 'concluida' || os.coluna_kanban === 'fechada') {
      return {
        label: 'Concluída',
        color: 'bg-green-500/20 border-green-500/30 text-green-400',
        icon: CheckCircle,
      };
    }

    if (os.coluna_kanban === 'em_atendimento') {
      return {
        label: 'Em Atendimento',
        color: 'bg-purple-500/20 border-purple-500/30 text-purple-400',
        icon: Clock,
      };
    }

    if (dataAgendamento < hoje && os.coluna_kanban === 'agendada') {
      return {
        label: 'Perdida',
        color: 'bg-red-500/20 border-red-500/30 text-red-400',
        icon: XCircle,
      };
    }

    return {
      label: 'Pendente',
      color: 'bg-yellow-500/20 border-yellow-500/30 text-yellow-400',
      icon: AlertTriangle,
    };
  };

  const limparFiltros = () => {
    setFiltros({
      tecnico_id: null,
      rota_id: null,
      status: null,
    });
  };

  const extrairCidade = (endereco: string): string => {
    // Endereço geralmente vem no formato: "Rua X, 123 - Bairro - Cidade/UF"
    // Vamos extrair a cidade
    const partes = endereco.split('-').map(p => p.trim());
    if (partes.length >= 3) {
      const cidadeEstado = partes[partes.length - 1];
      const cidade = cidadeEstado.split('/')[0]?.trim() || cidadeEstado;
      return cidade;
    }
    return endereco;
  };

  if (loadingData || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="futuristic-loader"></div>
      </div>
    );
  }

  const days = getDaysInMonth();
  const tecnicoDays = getAgendamentosForDay();
  const filtrosAtivos = filtros.tecnico_id || filtros.rota_id || filtros.status;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-blue-500 to-purple-600">
            Agenda Operacional
          </h2>
          <p className="text-gray-400 mt-1">Calendário completo com timeline por técnico</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              filtrosAtivos
                ? 'bg-cyan-500/20 border border-cyan-500/50 text-cyan-400'
                : 'bg-gray-700/50 hover:bg-gray-700 border border-gray-600 text-gray-300'
            }`}
          >
            <Filter className="w-5 h-5" />
            <span>Filtros</span>
            {filtrosAtivos && <span className="px-2 py-0.5 bg-cyan-500 rounded-full text-xs text-white">•</span>}
          </button>

          <button
            onClick={previousMonth}
            className="p-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-gray-300" />
          </button>
          <div className="px-6 py-2 bg-gray-700/50 rounded-lg">
            <span className="text-white font-semibold">
              {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
            </span>
          </div>
          <button
            onClick={nextMonth}
            className="p-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-gray-300" />
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white">Filtros</h3>
            {filtrosAtivos && (
              <button
                onClick={limparFiltros}
                className="text-sm text-cyan-400 hover:text-cyan-300 transition-colors"
              >
                Limpar Filtros
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-gray-400 text-sm mb-2 block">Técnico</label>
              <select
                value={filtros.tecnico_id || ''}
                onChange={(e) => setFiltros({ ...filtros, tecnico_id: e.target.value || null })}
                className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="">Todos</option>
                {tecnicos.map((tec) => (
                  <option key={tec.id} value={tec.id}>
                    {tec.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-gray-400 text-sm mb-2 block">Rota</label>
              <select
                value={filtros.rota_id || ''}
                onChange={(e) => setFiltros({ ...filtros, rota_id: e.target.value || null })}
                className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="">Todas</option>
                {rotas.map((rota) => (
                  <option key={rota.id} value={rota.id}>
                    {rota.nome}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-gray-400 text-sm mb-2 block">Status</label>
              <select
                value={filtros.status || ''}
                onChange={(e) => setFiltros({ ...filtros, status: e.target.value || null })}
                className="w-full px-4 py-2 bg-gray-700/50 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              >
                <option value="">Todos</option>
                <option value="pendente">Pendente</option>
                <option value="em_atendimento">Em Atendimento</option>
                <option value="concluida">Concluída</option>
                <option value="perdida">Perdida (sem check-in)</option>
              </select>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Calendar className="w-6 h-6 text-cyan-400" />
            <h3 className="text-xl font-bold text-white">Calendário do Mês</h3>
          </div>

          <div className="grid grid-cols-7 gap-2">
            {DAYS_OF_WEEK.map((day) => (
              <div key={day} className="text-center py-2 text-gray-400 font-semibold text-sm">
                {day}
              </div>
            ))}

            {days.map((day, index) => {
              const dayAgendamentos = getAgendamentosForDate(day);
              const isCurrentMonthDay = isCurrentMonth(day);
              const isTodayDay = isToday(day);
              const isSelected = isSelectedDate(day);

              return (
                <div
                  key={index}
                  onClick={() => setSelectedDate(day)}
                  className={`
                    min-h-24 p-2 rounded-lg border cursor-pointer transition-all
                    ${isSelected ? 'bg-cyan-500/20 border-cyan-500/50' : 'bg-gray-700/30 border-gray-600 hover:bg-gray-700/50'}
                    ${!isCurrentMonthDay ? 'opacity-40' : ''}
                  `}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-semibold ${isTodayDay ? 'text-cyan-400' : 'text-white'}`}>
                      {day.getDate()}
                    </span>
                    {dayAgendamentos.length > 0 && (
                      <span className="px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded-full text-blue-400 text-xs">
                        {dayAgendamentos.length}
                      </span>
                    )}
                  </div>
                  <div className="space-y-1">
                    {dayAgendamentos.slice(0, 3).map((ag) => (
                      <div
                        key={ag.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedOSId(ag.id);
                        }}
                        className="px-2 py-1 rounded text-xs cursor-pointer hover:opacity-80 transition-opacity"
                        style={{
                          backgroundColor: ag.rota ? `${ag.rota.cor}40` : '#3b82f640',
                          borderLeft: `3px solid ${ag.rota?.cor || '#3b82f6'}`,
                        }}
                        title={`${ag.numero_os_interna} - ${ag.tecnico?.nome || 'Sem técnico'}`}
                      >
                        <span className="text-white font-semibold">{ag.numero_os_interna}</span>
                      </div>
                    ))}
                    {dayAgendamentos.length > 3 && (
                      <div className="text-xs text-gray-400 text-center">
                        +{dayAgendamentos.length - 3}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-gray-800/50 border border-gray-700 rounded-xl p-6">
          <div className="flex items-center gap-3 mb-4">
            <Clock className="w-6 h-6 text-blue-400" />
            <h3 className="text-xl font-bold text-white">
              {selectedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
            </h3>
          </div>

          {loadingData ? (
            <div className="flex items-center justify-center py-12">
              <div className="futuristic-loader"></div>
            </div>
          ) : tecnicoDays.length === 0 ? (
            <div className="text-center py-12">
              <Calendar className="w-12 h-12 text-gray-500 mx-auto mb-3" />
              <p className="text-gray-400">Nenhum agendamento neste dia</p>
              <p className="text-gray-500 text-sm mt-2">Selecione outro dia no calendário</p>
            </div>
          ) : (
            <div className="space-y-4 max-h-[600px] overflow-y-auto">
              {tecnicoDays.map((tecDay) => (
                <div key={tecDay.tecnico_id || 'sem_tecnico'} className="bg-gray-700/30 border border-gray-600 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <User className="w-4 h-4 text-purple-400" />
                    <h4 className="font-bold text-white">{tecDay.tecnico_nome}</h4>
                    <span className="ml-auto px-2 py-0.5 bg-blue-500/20 border border-blue-500/30 rounded-full text-blue-400 text-xs">
                      {tecDay.agendamentos.length} OSs
                    </span>
                  </div>

                  <div className="space-y-2">
                    {tecDay.agendamentos.map((ag) => {
                      const statusInfo = getStatusInfo(ag);
                      const StatusIcon = statusInfo.icon;
                      const cidade = extrairCidade(ag.cliente_endereco);

                      return (
                        <div
                          key={ag.id}
                          onClick={() => setSelectedOSId(ag.id)}
                          className="bg-gray-800/50 border rounded-lg p-3 cursor-pointer hover:bg-gray-800/80 hover:border-cyan-500/50 transition-all hover:shadow-lg hover:shadow-cyan-500/20 group"
                          style={{
                            borderColor: ag.rota?.cor || '#374151',
                            borderLeftWidth: '4px',
                          }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <FileText className="w-4 h-4 text-cyan-400" />
                              <span className="text-white font-bold text-base">{ag.numero_os_interna}</span>
                              {ag.rota && (
                                <span
                                  className="px-2 py-0.5 rounded text-xs font-medium"
                                  style={{
                                    backgroundColor: `${ag.rota.cor}30`,
                                    color: ag.rota.cor,
                                    border: `1px solid ${ag.rota.cor}60`,
                                  }}
                                >
                                  {ag.rota.nome}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded-full text-xs border flex items-center gap-1 ${statusInfo.color}`}>
                                <StatusIcon className="w-3 h-3" />
                                {statusInfo.label}
                              </span>
                              <ExternalLink className="w-4 h-4 text-gray-400 group-hover:text-cyan-400 transition-colors" />
                            </div>
                          </div>
                          <div className="text-sm text-gray-400 space-y-1.5">
                            <p className="text-white font-medium">
                              {ag.numero_os_samsung || ag.cliente_nome}
                            </p>
                            <div className="flex items-center gap-2 text-cyan-400">
                              <Clock className="w-4 h-4" />
                              <span className="font-medium">
                                {ag.periodo_agendamento === 'manha' ? 'Manhã' : ag.periodo_agendamento === 'tarde' ? 'Tarde' : 'Não definido'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <MapPin className="w-4 h-4 text-blue-400" />
                              <span className="font-medium text-blue-300">
                                {ag.cliente_cidade || cidade}
                              </span>
                            </div>
                            <div className="flex items-center flex-wrap gap-2 mt-2">
                              <span
                                className={`inline-block px-2 py-1 rounded text-xs font-medium ${
                                  ag.tipo_os === 'LP'
                                    ? 'bg-green-500/20 border border-green-500/30 text-green-300'
                                    : 'bg-orange-500/20 border border-orange-500/30 text-orange-300'
                                }`}
                              >
                                {ag.tipo_os}
                              </span>
                              {ag.tipo_atendimento === 'IH' && ag.tipo_reparo && (
                                <span className="inline-block px-2 py-1 rounded text-xs font-medium bg-sky-500/20 border border-sky-500/30 text-sky-300">
                                  {ag.tipo_reparo}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedOSId && (
        <OSDetailsModal
          osId={selectedOSId}
          onClose={() => setSelectedOSId(null)}
        />
      )}
    </div>
  );
}
