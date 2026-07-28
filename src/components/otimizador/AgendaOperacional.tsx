import { useState, useEffect, useMemo } from 'react';
import { Calendar, Clock, User, MapPin, ChevronLeft, ChevronRight, Filter, CheckCircle, XCircle, AlertTriangle, FileText, LayoutGrid, Columns2 as Columns } from 'lucide-react';
import { useOtimizador } from '../../contexts/OtimizadorContext';
import { supabase } from '../../lib/supabase';
import OSDetailsModal from '../OSDetailsModal';

interface AgendamentoOS {
  id: string;
  numero_os_interna: string;
  numero_os_samsung: string | null;
  cliente_nome: string;
  cliente_endereco: string;
  cliente_cidade: string;
  data_agendamento: string;
  periodo_agendamento: string | null;
  coluna_kanban: string;
  tecnico_agendado_id: string | null;
  confirmado_com_cliente: boolean;
  rota_id: string | null;
  tipo_atendimento: string;
  tipo_reparo: string | null;
  tipo_os: string | null;
  tecnico?: { id: string; nome: string } | null;
  rota?: { id: string; nome: string; cor: string } | null;
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

type ViewMode = 'mensal' | 'semanal';

const DAYS_OF_WEEK = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab'];
const DAYS_OF_WEEK_FULL = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

const formatDateLocal = (date: Date): string => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

function getMonday(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  return date;
}

function getWeekDays(refDate: Date): Date[] {
  const monday = getMonday(refDate);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
}

export default function AgendaOperacional() {
  const { selectedUnidade, loading } = useOtimizador();
  const [viewMode, setViewMode] = useState<ViewMode>('semanal');
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [agendamentos, setAgendamentos] = useState<AgendamentoOS[]>([]);
  const [tecnicos, setTecnicos] = useState<{ id: string; nome: string }[]>([]);
  const [rotas, setRotas] = useState<{ id: string; nome: string; cor: string }[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [showFilters, setShowFilters] = useState(false);
  const [filtros, setFiltros] = useState<Filtros>({ tecnico_id: null, rota_id: null, status: null });
  const [selectedOSId, setSelectedOSId] = useState<string | null>(null);

  useEffect(() => {
    if (selectedUnidade) {
      loadTecnicos();
      loadRotas();
      loadAgendamentos();
    }
  }, [selectedUnidade, currentDate, filtros, viewMode]);

  const loadTecnicos = async () => {
    const { data } = await supabase
      .from('usuarios')
      .select('id, nome')
      .eq('unidade_id', selectedUnidade)
      .in('tipo', ['tecnico', 'tecnico_ih'])
      .eq('ativo', true)
      .order('nome');
    setTecnicos(data || []);
  };

  const loadRotas = async () => {
    const { data } = await supabase
      .from('rotas')
      .select('id, nome, cor')
      .eq('unidade_id', selectedUnidade)
      .eq('ativa', true)
      .order('nome');
    setRotas(data || []);
  };

  const loadAgendamentos = async () => {
    setLoadingData(true);
    try {
      let startDate: string;
      let endDate: string;

      if (viewMode === 'semanal') {
        const weekDays = getWeekDays(currentDate);
        startDate = formatDateLocal(weekDays[0]);
        endDate = formatDateLocal(weekDays[6]);
      } else {
        const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);
        startDate = formatDateLocal(startOfMonth);
        endDate = formatDateLocal(endOfMonth);
      }

      let query = supabase
        .from('os')
        .select(`
          id, numero_os_interna, numero_os_samsung, cliente_nome, cliente_endereco, cliente_cidade,
          data_agendamento, periodo_agendamento, coluna_kanban, tecnico_agendado_id,
          confirmado_com_cliente, rota_id, tipo_atendimento, tipo_reparo, tipo_os,
          tecnico:usuarios!os_tecnico_agendado_id_fkey(id, nome),
          rota:rotas!os_rota_id_fkey(id, nome, cor)
        `)
        .eq('unidade_id', selectedUnidade)
        .not('data_agendamento', 'is', null)
        .gte('data_agendamento', startDate)
        .lte('data_agendamento', endDate);

      if (filtros.tecnico_id) query = query.eq('tecnico_agendado_id', filtros.tecnico_id);
      if (filtros.rota_id) query = query.eq('rota_id', filtros.rota_id);
      if (filtros.status) {
        const hoje = formatDateLocal(new Date());
        if (filtros.status === 'perdida') query = query.eq('coluna_kanban', 'agendada').lt('data_agendamento', hoje);
        else if (filtros.status === 'pendente') query = query.eq('coluna_kanban', 'agendada');
        else if (filtros.status === 'em_atendimento') query = query.eq('coluna_kanban', 'em_atendimento');
        else if (filtros.status === 'concluida') query = query.in('coluna_kanban', ['concluida', 'fechada', 'os_fechada', 'reparo_concluido']);
      }

      const { data } = await query.order('data_agendamento').order('created_at');
      setAgendamentos((data as any) || []);
    } catch {
    } finally {
      setLoadingData(false);
    }
  };

  const getDaysInMonth = () => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startingDay = firstDay.getDay();
    const days: Date[] = [];
    for (let i = 0; i < startingDay; i++) days.push(new Date(year, month, -startingDay + i + 1));
    for (let i = 1; i <= lastDay.getDate(); i++) days.push(new Date(year, month, i));
    const remaining = 42 - days.length;
    for (let i = 1; i <= remaining; i++) days.push(new Date(year, month + 1, i));
    return days;
  };

  const getAgendamentosForDate = (date: Date) => agendamentos.filter(a => a.data_agendamento === formatDateLocal(date));

  const getAgendamentosForDay = (): TecnicoDay[] => {
    const dayAg = agendamentos.filter(a => a.data_agendamento === formatDateLocal(selectedDate));
    const map = new Map<string, TecnicoDay>();
    dayAg.forEach(ag => {
      const key = ag.tecnico_agendado_id || 'sem_tecnico';
      if (!map.has(key)) map.set(key, { tecnico_id: ag.tecnico_agendado_id, tecnico_nome: ag.tecnico?.nome || 'Sem Técnico', agendamentos: [] });
      map.get(key)!.agendamentos.push(ag);
    });
    return Array.from(map.values());
  };

  const isToday = (d: Date) => d.toDateString() === new Date().toDateString();
  const isSelected = (d: Date) => d.toDateString() === selectedDate.toDateString();
  const isCurrMonth = (d: Date) => d.getMonth() === currentDate.getMonth();

  const getStatusInfo = (os: AgendamentoOS) => {
    const hoje = formatDateLocal(new Date());
    if (['concluida', 'fechada', 'os_fechada', 'reparo_concluido'].includes(os.coluna_kanban))
      return { label: 'Concluida', color: '#10B981', icon: CheckCircle };
    if (['em_atendimento', 'em_rota_ih', 'em_reparo_ci'].includes(os.coluna_kanban))
      return { label: 'Em Atendimento', color: '#3B82F6', icon: Clock };
    if (os.data_agendamento < hoje && os.coluna_kanban === 'agendada')
      return { label: 'Perdida', color: '#EF4444', icon: XCircle };
    return { label: 'Pendente', color: '#F59E0B', icon: AlertTriangle };
  };

  const filtrosAtivos = filtros.tecnico_id || filtros.rota_id || filtros.status;

  const navigatePrev = () => {
    if (viewMode === 'semanal') {
      const d = new Date(currentDate);
      d.setDate(d.getDate() - 7);
      setCurrentDate(d);
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    }
  };

  const navigateNext = () => {
    if (viewMode === 'semanal') {
      const d = new Date(currentDate);
      d.setDate(d.getDate() + 7);
      setCurrentDate(d);
    } else {
      setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    }
  };

  const weekDays = useMemo(() => getWeekDays(currentDate), [currentDate]);

  const getWeekLabel = () => {
    const start = weekDays[0];
    const end = weekDays[6];
    const sameMonth = start.getMonth() === end.getMonth();
    if (sameMonth) {
      return `${start.getDate()} - ${end.getDate()} ${MONTHS[start.getMonth()]} ${start.getFullYear()}`;
    }
    return `${start.getDate()} ${MONTHS[start.getMonth()].slice(0, 3)} - ${end.getDate()} ${MONTHS[end.getMonth()].slice(0, 3)} ${end.getFullYear()}`;
  };

  const navigateToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  if (loadingData || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 rounded-full animate-spin" style={{ borderColor: 'var(--border-primary)', borderTopColor: 'var(--text-accent)' }} />
      </div>
    );
  }

  const days = getDaysInMonth();
  const tecnicoDays = getAgendamentosForDay();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Agenda Operacional</h2>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {viewMode === 'semanal' ? 'Visao semanal com rotas por tecnico' : 'Calendario mensal com timeline por tecnico'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: '1px solid var(--border-primary)' }}>
            <button
              onClick={() => setViewMode('semanal')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors"
              style={{
                backgroundColor: viewMode === 'semanal' ? '#3B82F615' : 'var(--bg-card)',
                color: viewMode === 'semanal' ? '#3B82F6' : 'var(--text-secondary)',
                borderRight: '1px solid var(--border-primary)',
              }}
            >
              <Columns className="w-4 h-4" />
              Semanal
            </button>
            <button
              onClick={() => setViewMode('mensal')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors"
              style={{
                backgroundColor: viewMode === 'mensal' ? '#3B82F615' : 'var(--bg-card)',
                color: viewMode === 'mensal' ? '#3B82F6' : 'var(--text-secondary)',
              }}
            >
              <LayoutGrid className="w-4 h-4" />
              Mensal
            </button>
          </div>

          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors"
            style={{
              backgroundColor: filtrosAtivos ? '#3B82F615' : 'var(--bg-card)',
              border: `1px solid ${filtrosAtivos ? '#3B82F650' : 'var(--border-primary)'}`,
              color: filtrosAtivos ? '#3B82F6' : 'var(--text-secondary)',
            }}
          >
            <Filter className="w-4 h-4" />
            Filtros
          </button>

          <button onClick={navigateToday}
            className="px-3 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>
            Hoje
          </button>

          <button onClick={navigatePrev}
            className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
            <ChevronLeft className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
          <div className="px-4 py-2 rounded-lg text-sm font-semibold min-w-[180px] text-center" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}>
            {viewMode === 'semanal' ? getWeekLabel() : `${MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`}
          </div>
          <button onClick={navigateNext}
            className="p-2 rounded-lg" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
            <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Filtros</h3>
            {filtrosAtivos && (
              <button onClick={() => setFiltros({ tecnico_id: null, rota_id: null, status: null })} className="text-sm" style={{ color: '#3B82F6' }}>
                Limpar
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label: 'Tecnico', value: filtros.tecnico_id || '', onChange: (v: string) => setFiltros({ ...filtros, tecnico_id: v || null }), options: tecnicos.map(t => ({ value: t.id, label: t.nome })) },
              { label: 'Rota', value: filtros.rota_id || '', onChange: (v: string) => setFiltros({ ...filtros, rota_id: v || null }), options: rotas.map(r => ({ value: r.id, label: r.nome })) },
              { label: 'Status', value: filtros.status || '', onChange: (v: string) => setFiltros({ ...filtros, status: v || null }), options: [{ value: 'pendente', label: 'Pendente' }, { value: 'em_atendimento', label: 'Em Atendimento' }, { value: 'concluida', label: 'Concluida' }, { value: 'perdida', label: 'Perdida' }] },
            ].map(f => (
              <div key={f.label}>
                <label className="text-xs mb-1 block" style={{ color: 'var(--text-tertiary)' }}>{f.label}</label>
                <select value={f.value} onChange={e => f.onChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none"
                  style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}>
                  <option value="">Todos</option>
                  {f.options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Weekly View */}
      {viewMode === 'semanal' && (
        <WeeklyView
          weekDays={weekDays}
          agendamentos={agendamentos}
          onSelectOS={setSelectedOSId}
          getStatusInfo={getStatusInfo}
        />
      )}

      {/* Monthly View */}
      {viewMode === 'mensal' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Calendar className="w-5 h-5" style={{ color: '#3B82F6' }} />
              <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Calendario</h3>
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {DAYS_OF_WEEK.map(d => (
                <div key={d} className="text-center py-1.5 text-xs font-semibold" style={{ color: 'var(--text-tertiary)' }}>{d}</div>
              ))}
              {days.map((day, i) => {
                const dayAg = getAgendamentosForDate(day);
                return (
                  <div key={i} onClick={() => setSelectedDate(day)}
                    className="min-h-[80px] p-1.5 rounded-lg cursor-pointer transition-all"
                    style={{
                      backgroundColor: isSelected(day) ? '#3B82F615' : 'var(--bg-secondary)',
                      border: `1px solid ${isSelected(day) ? '#3B82F650' : 'var(--border-primary)'}`,
                      opacity: isCurrMonth(day) ? 1 : 0.35,
                    }}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-semibold" style={{ color: isToday(day) ? '#3B82F6' : 'var(--text-primary)' }}>
                        {day.getDate()}
                      </span>
                      {dayAg.length > 0 && (
                        <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: '#3B82F620', color: '#3B82F6' }}>
                          {dayAg.length}
                        </span>
                      )}
                    </div>
                    <div className="space-y-0.5">
                      {dayAg.slice(0, 3).map(ag => (
                        <div key={ag.id}
                          onClick={e => { e.stopPropagation(); setSelectedOSId(ag.id); }}
                          className="px-1 py-0.5 rounded text-[10px] cursor-pointer hover:opacity-80"
                          style={{ backgroundColor: `${ag.rota?.cor || '#3B82F6'}30`, borderLeft: `2px solid ${ag.rota?.cor || '#3B82F6'}` }}
                          title={`${ag.numero_os_samsung || ag.numero_os_interna} - ${ag.tecnico?.nome || ''}`}>
                          <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{ag.numero_os_samsung || ag.numero_os_interna}</span>
                        </div>
                      ))}
                      {dayAg.length > 3 && <div className="text-[10px] text-center" style={{ color: 'var(--text-tertiary)' }}>+{dayAg.length - 3}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-5 h-5" style={{ color: '#3B82F6' }} />
              <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>
                {selectedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long' })}
              </h3>
            </div>

            {tecnicoDays.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: 'var(--text-tertiary)' }} />
                <p style={{ color: 'var(--text-secondary)' }}>Nenhum agendamento neste dia</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[600px] overflow-y-auto">
                {tecnicoDays.map(td => (
                  <div key={td.tecnico_id || 'none'} className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
                    <div className="flex items-center gap-2 mb-3">
                      <User className="w-4 h-4" style={{ color: '#06B6D4' }} />
                      <h4 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{td.tecnico_nome}</h4>
                      <span className="ml-auto px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: '#3B82F615', color: '#3B82F6' }}>
                        {td.agendamentos.length}
                      </span>
                    </div>
                    <div className="space-y-2">
                      {td.agendamentos.map(ag => {
                        const st = getStatusInfo(ag);
                        const StIcon = st.icon;
                        return (
                          <div key={ag.id} onClick={() => setSelectedOSId(ag.id)}
                            className="rounded-lg p-3 cursor-pointer transition-all group"
                            style={{ backgroundColor: 'var(--bg-card)', border: `1px solid var(--border-primary)`, borderLeftWidth: '3px', borderLeftColor: ag.rota?.cor || 'var(--border-primary)' }}>
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2">
                                <FileText className="w-3.5 h-3.5" style={{ color: '#3B82F6' }} />
                                <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{ag.numero_os_samsung || ag.numero_os_interna}</span>
                                {ag.rota && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: `${ag.rota.cor}20`, color: ag.rota.cor, border: `1px solid ${ag.rota.cor}40` }}>
                                    {ag.rota.nome}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium flex items-center gap-1" style={{ backgroundColor: `${st.color}15`, color: st.color, border: `1px solid ${st.color}30` }}>
                                  <StIcon className="w-3 h-3" />{st.label}
                                </span>
                              </div>
                            </div>
                            <div className="space-y-1 text-xs">
                              <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{ag.cliente_nome}</p>
                              <div className="flex items-center gap-1.5" style={{ color: '#06B6D4' }}>
                                <Clock className="w-3 h-3" />
                                <span>{ag.periodo_agendamento === 'manha' ? 'Manha' : ag.periodo_agendamento === 'tarde' ? 'Tarde' : 'Nao definido'}</span>
                              </div>
                              <div className="flex items-center gap-1.5" style={{ color: '#3B82F6' }}>
                                <MapPin className="w-3 h-3" />
                                <span>{ag.cliente_cidade || ag.cliente_endereco}</span>
                              </div>
                              <div className="flex gap-1.5 mt-1">
                                {ag.tipo_os && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{
                                    backgroundColor: ag.tipo_os === 'LP' ? '#10B98115' : '#F9731615',
                                    color: ag.tipo_os === 'LP' ? '#10B981' : '#F97316',
                                    border: `1px solid ${ag.tipo_os === 'LP' ? '#10B98130' : '#F9731630'}`,
                                  }}>{ag.tipo_os}</span>
                                )}
                                {ag.tipo_atendimento === 'IH' && ag.tipo_reparo && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium" style={{ backgroundColor: '#0EA5E915', color: '#0EA5E9', border: '1px solid #0EA5E930' }}>
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
      )}

      {selectedOSId && <OSDetailsModal osId={selectedOSId} onClose={() => setSelectedOSId(null)} />}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Weekly View Component                                              */
/* ------------------------------------------------------------------ */

interface WeeklyViewProps {
  weekDays: Date[];
  agendamentos: AgendamentoOS[];
  onSelectOS: (id: string) => void;
  getStatusInfo: (os: AgendamentoOS) => { label: string; color: string; icon: any };
}

function WeeklyView({ weekDays, agendamentos, onSelectOS, getStatusInfo }: WeeklyViewProps) {
  const weekColumns = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom'];
  const weekColumnsFull = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

  const reorderedDays = useMemo(() => {
    const sunday = weekDays[0];
    return [...weekDays.slice(1), sunday];
  }, [weekDays]);

  const agByDay = useMemo(() => {
    const map: Record<string, AgendamentoOS[]> = {};
    reorderedDays.forEach(d => { map[formatDateLocal(d)] = []; });
    agendamentos.forEach(ag => {
      if (map[ag.data_agendamento]) {
        map[ag.data_agendamento].push(ag);
      }
    });
    return map;
  }, [agendamentos, reorderedDays]);

  const todayStr = formatDateLocal(new Date());

  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
      {/* Column Headers */}
      <div className="grid grid-cols-7">
        {reorderedDays.map((day, i) => {
          const dateStr = formatDateLocal(day);
          const isCurrentDay = dateStr === todayStr;
          const count = agByDay[dateStr]?.length || 0;
          return (
            <div key={i} className="text-center py-3 px-2" style={{
              backgroundColor: isCurrentDay ? '#3B82F610' : 'transparent',
              borderBottom: '1px solid var(--border-primary)',
              borderRight: i < 6 ? '1px solid var(--border-primary)' : undefined,
            }}>
              <div className="text-xs font-bold uppercase tracking-wider mb-0.5" style={{ color: isCurrentDay ? '#3B82F6' : 'var(--text-tertiary)' }}>
                {weekColumns[i]}
              </div>
              <div className="text-lg font-bold" style={{ color: isCurrentDay ? '#3B82F6' : 'var(--text-primary)' }}>
                {day.getDate()}
              </div>
              <div className="text-[10px] mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
                {MONTHS[day.getMonth()].slice(0, 3)}
              </div>
              {count > 0 && (
                <div className="mt-1 mx-auto w-fit px-2 py-0.5 rounded-full text-[10px] font-bold" style={{ backgroundColor: '#3B82F618', color: '#3B82F6' }}>
                  {count} OS
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Day columns with cards */}
      <div className="grid grid-cols-7 min-h-[500px]">
        {reorderedDays.map((day, colIdx) => {
          const dateStr = formatDateLocal(day);
          const dayAgendamentos = agByDay[dateStr] || [];
          const isCurrentDay = dateStr === todayStr;

          return (
            <div
              key={colIdx}
              className="p-2 space-y-2 overflow-y-auto"
              style={{
                backgroundColor: isCurrentDay ? '#3B82F605' : 'transparent',
                borderRight: colIdx < 6 ? '1px solid var(--border-primary)' : undefined,
                maxHeight: 600,
              }}
            >
              {dayAgendamentos.length === 0 && (
                <div className="flex items-center justify-center h-20 opacity-30">
                  <Calendar className="w-5 h-5" style={{ color: 'var(--text-tertiary)' }} />
                </div>
              )}
              {dayAgendamentos.map(ag => (
                <WeeklyCard key={ag.id} ag={ag} onSelectOS={onSelectOS} getStatusInfo={getStatusInfo} />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Weekly Card                                                        */
/* ------------------------------------------------------------------ */

interface WeeklyCardProps {
  ag: AgendamentoOS;
  onSelectOS: (id: string) => void;
  getStatusInfo: (os: AgendamentoOS) => { label: string; color: string; icon: any };
}

function WeeklyCard({ ag, onSelectOS, getStatusInfo }: WeeklyCardProps) {
  const routeColor = ag.rota?.cor || '#64748B';
  const isDarkRoute = routeColor.toLowerCase() === '#1a1a1a' || routeColor.toLowerCase() === '#000000';
  const st = getStatusInfo(ag);

  return (
    <div
      onClick={() => onSelectOS(ag.id)}
      className="rounded-lg p-2.5 cursor-pointer transition-all hover:scale-[1.02] hover:shadow-lg"
      style={{
        backgroundColor: `${routeColor}12`,
        border: `1px solid ${routeColor}35`,
        borderLeftWidth: 4,
        borderLeftColor: routeColor,
      }}
    >
      {/* OS number */}
      <div className="flex items-center justify-between mb-1.5">
        <span className="font-bold text-xs truncate" style={{ color: 'var(--text-primary)' }}>
          {ag.numero_os_samsung || ag.numero_os_interna}
        </span>
        {ag.rota && (
          <span
            className="w-2.5 h-2.5 rounded-full flex-shrink-0"
            style={{ backgroundColor: routeColor, boxShadow: `0 0 6px ${routeColor}60` }}
            title={ag.rota.nome}
          />
        )}
      </div>

      {/* Technician */}
      {ag.tecnico && (
        <div className="flex items-center gap-1 mb-1">
          <User className="w-3 h-3 flex-shrink-0" style={{ color: isDarkRoute ? '#94A3B8' : routeColor }} />
          <span className="text-[11px] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
            {ag.tecnico.nome.split(' ').slice(0, 2).join(' ')}
          </span>
        </div>
      )}

      {/* City */}
      {ag.cliente_cidade && (
        <div className="flex items-center gap-1 mb-1">
          <MapPin className="w-3 h-3 flex-shrink-0" style={{ color: isDarkRoute ? '#94A3B8' : routeColor }} />
          <span className="text-[11px] truncate" style={{ color: 'var(--text-secondary)' }}>
            {ag.cliente_cidade}
          </span>
        </div>
      )}

      {/* Period & Route badge */}
      <div className="flex items-center gap-1 flex-wrap mt-1.5">
        {ag.periodo_agendamento && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{
            backgroundColor: ag.periodo_agendamento === 'manha' ? '#F59E0B15' : '#8B5CF615',
            color: ag.periodo_agendamento === 'manha' ? '#F59E0B' : '#8B5CF6',
            border: `1px solid ${ag.periodo_agendamento === 'manha' ? '#F59E0B30' : '#8B5CF630'}`,
          }}>
            {ag.periodo_agendamento === 'manha' ? 'AM' : 'PM'}
          </span>
        )}
        {ag.tipo_os && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-medium" style={{
            backgroundColor: ag.tipo_os === 'LP' ? '#10B98115' : '#F9731615',
            color: ag.tipo_os === 'LP' ? '#10B981' : '#F97316',
            border: `1px solid ${ag.tipo_os === 'LP' ? '#10B98130' : '#F9731630'}`,
          }}>{ag.tipo_os}</span>
        )}
        {ag.rota && (
          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold truncate" style={{
            backgroundColor: `${routeColor}20`,
            color: isDarkRoute ? '#E2E8F0' : routeColor,
            border: `1px solid ${routeColor}40`,
          }}>{ag.rota.nome.replace('Rota ', '')}</span>
        )}
      </div>
    </div>
  );
}
