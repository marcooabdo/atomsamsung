import { useState } from 'react';
import { ChevronLeft, ChevronRight, Calendar, MapPin, User, Clock } from 'lucide-react';
import type { Database } from '../../lib/database.types';

type Agendamento = Database['public']['Tables']['agendamentos']['Row'] & {
  os: {
    numero_os_samsung?: string;
    numero_os_interna?: string;
    cliente_nome: string;
    tipo_atendimento: string;
    coluna_kanban: string;
  };
  tecnico: {
    nome: string;
  };
};

interface AgendamentoCalendarioProps {
  agendamentos: Agendamento[];
  onAgendamentoClick: (agendamento: Agendamento) => void;
}

type ViewMode = 'week' | 'month';

export function AgendamentoCalendario({ agendamentos, onAgendamentoClick }: AgendamentoCalendarioProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [currentDate, setCurrentDate] = useState(new Date());

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

  const getWeekDays = (date: Date) => {
    const start = new Date(date);
    const day = start.getDay();
    const diff = start.getDate() - day + (day === 0 ? -6 : 1);
    start.setDate(diff);
    start.setHours(0, 0, 0, 0);

    const days = [];
    for (let i = 0; i < 7; i++) {
      const current = new Date(start);
      current.setDate(start.getDate() + i);
      days.push(current);
    }
    return days;
  };

  const getMonthDays = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startDate = new Date(firstDay);
    const startDay = startDate.getDay();
    startDate.setDate(startDate.getDate() - (startDay === 0 ? 6 : startDay - 1));

    const days = [];
    const current = new Date(startDate);

    while (current <= lastDay || days.length % 7 !== 0) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }

    return days;
  };

  const getAgendamentosForDate = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return agendamentos.filter(a => a.data_agendamento === dateStr);
  };

  const previousPeriod = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() - 7);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    setCurrentDate(newDate);
  };

  const nextPeriod = () => {
    const newDate = new Date(currentDate);
    if (viewMode === 'week') {
      newDate.setDate(newDate.getDate() + 7);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  const formatMonthYear = (date: Date) => {
    return date.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
  };

  const formatWeekRange = (days: Date[]) => {
    const first = days[0];
    const last = days[days.length - 1];
    return `${first.getDate()} ${first.toLocaleDateString('pt-BR', { month: 'short' })} - ${last.getDate()} ${last.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' })}`;
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  if (viewMode === 'week') {
    const weekDays = getWeekDays(currentDate);

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={previousPeriod}
              className="p-2 hover:bg-[#00D4FF]/10 rounded-lg transition-colors"
            >
              <ChevronLeft className="w-5 h-5 text-[#00D4FF]" />
            </button>
            <h3 className="text-lg font-bold text-[#00D4FF] min-w-[300px] text-center">
              {formatWeekRange(weekDays)}
            </h3>
            <button
              onClick={nextPeriod}
              className="p-2 hover:bg-[#00D4FF]/10 rounded-lg transition-colors"
            >
              <ChevronRight className="w-5 h-5 text-[#00D4FF]" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={goToToday}
              className="neon-button px-4 py-2 text-xs"
            >
              Hoje
            </button>
            <button
              onClick={() => setViewMode('month')}
              className="neon-button px-4 py-2 text-xs opacity-50 hover:opacity-100"
            >
              Mês
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-3">
          {weekDays.map((day, index) => {
            const dayAgendamentos = getAgendamentosForDate(day);
            const today = isToday(day);

            return (
              <div
                key={index}
                className={`premium-card p-4 min-h-[200px] ${
                  today ? 'border-2 border-[#39FF14]' : ''
                }`}
              >
                <div className="mb-3">
                  <p className={`text-xs uppercase font-bold ${today ? 'text-[#39FF14]' : 'text-gray-400'}`}>
                    {day.toLocaleDateString('pt-BR', { weekday: 'short' })}
                  </p>
                  <p className={`text-2xl font-bold ${today ? 'text-[#39FF14]' : 'text-white'}`}>
                    {day.getDate()}
                  </p>
                </div>

                <div className="space-y-2">
                  {dayAgendamentos.map((agendamento) => (
                    <button
                      key={agendamento.id}
                      onClick={() => onAgendamentoClick(agendamento)}
                      className="w-full text-left p-2 rounded-lg border transition-all hover:scale-105"
                      style={{
                        backgroundColor: `${getRotaColor(agendamento.os.coluna_kanban)}20`,
                        borderColor: `${getRotaTextColor(agendamento.os.coluna_kanban)}60`
                      }}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <Clock className="w-3 h-3" style={{ color: getRotaTextColor(agendamento.os.coluna_kanban) }} />
                        <span className="text-xs font-bold" style={{ color: getRotaTextColor(agendamento.os.coluna_kanban) }}>
                          {agendamento.horario_inicio.slice(0, 5)}
                        </span>
                      </div>
                      <p className="text-xs text-white font-semibold truncate">
                        {agendamento.os.cliente_nome}
                      </p>
                      <p className="text-xs text-gray-400 truncate">
                        {agendamento.tecnico.nome}
                      </p>
                    </button>
                  ))}

                  {dayAgendamentos.length === 0 && (
                    <p className="text-xs text-gray-600 italic text-center py-4">
                      Sem agendamentos
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  const monthDays = getMonthDays(currentDate);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={previousPeriod}
            className="p-2 hover:bg-[#00D4FF]/10 rounded-lg transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-[#00D4FF]" />
          </button>
          <h3 className="text-lg font-bold text-[#00D4FF] min-w-[200px] text-center capitalize">
            {formatMonthYear(currentDate)}
          </h3>
          <button
            onClick={nextPeriod}
            className="p-2 hover:bg-[#00D4FF]/10 rounded-lg transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-[#00D4FF]" />
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className="neon-button px-4 py-2 text-xs"
          >
            Hoje
          </button>
          <button
            onClick={() => setViewMode('week')}
            className="neon-button px-4 py-2 text-xs opacity-50 hover:opacity-100"
          >
            Semana
          </button>
        </div>
      </div>

      <div className="premium-card p-4">
        <div className="grid grid-cols-7 gap-px bg-[#00D4FF]/10 rounded-lg overflow-hidden">
          {['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'].map((dia) => (
            <div
              key={dia}
              className="bg-[#0A0F1E] p-3 text-center"
            >
              <span className="text-xs font-bold text-[#00D4FF] uppercase">
                {dia}
              </span>
            </div>
          ))}

          {monthDays.map((day, index) => {
            const dayAgendamentos = getAgendamentosForDate(day);
            const today = isToday(day);
            const currentMonth = isCurrentMonth(day);

            return (
              <div
                key={index}
                className={`bg-[#0A0F1E] p-2 min-h-[120px] ${
                  !currentMonth ? 'opacity-30' : ''
                } ${today ? 'ring-2 ring-[#39FF14] ring-inset' : ''}`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-sm font-bold ${
                    today ? 'text-[#39FF14]' : currentMonth ? 'text-white' : 'text-gray-600'
                  }`}>
                    {day.getDate()}
                  </span>
                  {dayAgendamentos.length > 0 && (
                    <span className="text-xs bg-[#00D4FF]/20 text-[#00D4FF] px-2 py-0.5 rounded-full font-bold">
                      {dayAgendamentos.length}
                    </span>
                  )}
                </div>

                <div className="space-y-1">
                  {dayAgendamentos.slice(0, 3).map((agendamento) => (
                    <button
                      key={agendamento.id}
                      onClick={() => onAgendamentoClick(agendamento)}
                      className="w-full text-left px-2 py-1 rounded text-xs hover:scale-105 transition-transform"
                      style={{
                        backgroundColor: `${getRotaColor(agendamento.os.coluna_kanban)}30`,
                        borderLeft: `3px solid ${getRotaTextColor(agendamento.os.coluna_kanban)}`
                      }}
                    >
                      <div className="flex items-center gap-1 mb-0.5">
                        <Clock className="w-2.5 h-2.5" style={{ color: getRotaTextColor(agendamento.os.coluna_kanban) }} />
                        <span className="font-bold" style={{ color: getRotaTextColor(agendamento.os.coluna_kanban) }}>
                          {agendamento.horario_inicio.slice(0, 5)}
                        </span>
                      </div>
                      <p className="text-white font-semibold truncate text-xs">
                        {agendamento.os.cliente_nome}
                      </p>
                    </button>
                  ))}

                  {dayAgendamentos.length > 3 && (
                    <button
                      className="w-full text-center text-xs text-[#00D4FF] hover:text-[#00F5FF] font-semibold"
                      onClick={() => {
                        setCurrentDate(day);
                        setViewMode('week');
                      }}
                    >
                      +{dayAgendamentos.length - 3} mais
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-center gap-6 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-[#39FF14]"></div>
          <span className="text-gray-400">Hoje</span>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="w-3 h-3 text-[#00D4FF]" />
          <span className="text-gray-400">Agendamentos</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-8 h-3 rounded" style={{
            background: 'linear-gradient(to right, #ef4444, #3b82f6, #10b981, #ec4899, #eab308, #f97316)'
          }}></div>
          <span className="text-gray-400">Rotas</span>
        </div>
      </div>
    </div>
  );
}
