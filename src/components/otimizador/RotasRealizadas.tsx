import { useState, useEffect, useCallback } from 'react';
import {
  FolderOpen, Route, MapPin, User, Calendar, Clock, CheckCircle2,
  XCircle, AlertCircle, ChevronDown, ChevronRight, Loader2, RefreshCw,
  DollarSign, TrendingUp, Navigation, Package, Camera, FileText,
  Filter, Search, BarChart3, ArrowRight, LogIn, LogOut, Star
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useOtimizador } from '../../contexts/OtimizadorContext';

interface RotaRealizada {
  id: string;
  nome: string;
  status: string;
  data_aplicacao: string | null;
  data_conclusao: string | null;
  criado_por: string | null;
  observacoes: string | null;
  metricas: {
    distancia_total_km?: number;
    tempo_total_minutos?: number;
    horario_inicio?: string;
    horario_fim?: string;
    dias_necessarios?: number;
  };
  os_incluidas: OsIncluida[];
  cor_rota: string;
  resumo_financeiro: ResumoFinanceiro;
  tecnico: { nome: string } | null;
  unidade: { nome: string } | null;
  agendamentos?: AgendamentoRota[];
}

interface OsIncluida {
  os_id: string;
  numero_os: string;
  ordem_visita: number;
  horario_chegada?: string;
  horario_conclusao?: string;
  distancia_anterior_km?: number;
  cliente_nome?: string;
  endereco?: string;
  lat?: number;
  lng?: number;
}

interface AgendamentoRota {
  id: string;
  os_id: string;
  status: string;
  data_agendamento: string;
  horario_inicio: string;
  horario_fim: string;
  checkins: CheckinData[];
  checkouts: CheckinData[];
  os: {
    numero_os_interna: string;
    numero_os_samsung: string | null;
    cliente_nome: string;
    defeito_relatado: string | null;
    coluna_kanban: string;
    valor_total: number;
    valor_pago: number;
    status_pagamento: string;
  } | null;
}

interface CheckinData {
  id: string;
  tipo: string;
  data_hora: string;
  localizacao_endereco: string | null;
  fotos: string[];
  observacao: string | null;
}

interface ResumoFinanceiro {
  total_os?: number;
  valor_total_os?: number;
  valor_pago?: number;
  os_pagas?: number;
  os_pendentes?: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  rascunho: { label: 'Rascunho', color: '#9CA3AF', bg: '#9CA3AF15', icon: FileText },
  aplicada: { label: 'Aplicada', color: '#3B82F6', bg: '#3B82F615', icon: Navigation },
  em_andamento: { label: 'Em Andamento', color: '#F59E0B', bg: '#F59E0B15', icon: Clock },
  concluida: { label: 'Concluida', color: '#10B981', bg: '#10B98115', icon: CheckCircle2 },
  cancelada: { label: 'Cancelada', color: '#EF4444', bg: '#EF444415', icon: XCircle },
};

const AGENDAMENTO_STATUS: Record<string, { label: string; color: string }> = {
  pendente_confirmacao: { label: 'Pendente', color: '#F59E0B' },
  confirmado: { label: 'Confirmado', color: '#3B82F6' },
  em_andamento: { label: 'Em Andamento', color: '#8B5CF6' },
  concluido: { label: 'Concluido', color: '#10B981' },
  cancelado: { label: 'Cancelado', color: '#EF4444' },
};

function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h > 0) return `${h}h${m > 0 ? ` ${m}min` : ''}`;
  return `${m}min`;
}

function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function AgendamentoCard({ ag }: { ag: AgendamentoRota }) {
  const [expanded, setExpanded] = useState(false);
  const statusCfg = AGENDAMENTO_STATUS[ag.status] || { label: ag.status, color: '#9CA3AF' };
  const checkin = ag.checkins?.[0];
  const checkout = ag.checkouts?.[0];

  const calcDuration = () => {
    if (!checkin || !checkout) return null;
    const diff = new Date(checkout.data_hora).getTime() - new Date(checkin.data_hora).getTime();
    return Math.round(diff / 60000);
  };

  const duration = calcDuration();

  return (
    <div className="rounded-lg border overflow-hidden" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)' }}>
      <button
        className="w-full flex items-center gap-3 p-3 text-left hover:opacity-80 transition-opacity"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold flex-shrink-0"
          style={{ background: statusCfg.color + '20', color: statusCfg.color }}>
          {ag.os?.numero_os_interna?.slice(-3) || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {ag.os?.cliente_nome || 'Cliente'}
            </span>
            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
              style={{ background: statusCfg.color + '20', color: statusCfg.color }}>
              {statusCfg.label}
            </span>
            {ag.os?.status_pagamento === 'pago' && (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-medium"
                style={{ background: '#10B98120', color: '#10B981' }}>
                Pago
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5">
            <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
              {ag.horario_inicio} - {ag.horario_fim}
            </span>
            {duration !== null && (
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {formatDuration(duration)} no local
              </span>
            )}
            {ag.os?.valor_total > 0 && (
              <span className="text-xs font-medium" style={{ color: '#10B981' }}>
                {formatCurrency(ag.os.valor_total)}
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {checkin && <LogIn className="w-3.5 h-3.5" style={{ color: '#3B82F6' }} />}
          {checkout && <LogOut className="w-3.5 h-3.5" style={{ color: '#10B981' }} />}
          {expanded ? <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} /> : <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />}
        </div>
      </button>

      {expanded && (
        <div className="px-3 pb-3 space-y-3 border-t" style={{ borderColor: 'var(--border-primary)' }}>
          <div className="pt-3 grid grid-cols-2 gap-3">
            {ag.os?.defeito_relatado && (
              <div className="col-span-2">
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Defeito relatado</p>
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{ag.os.defeito_relatado}</p>
              </div>
            )}

            {checkin && (
              <div className="p-2 rounded-lg" style={{ background: '#3B82F615', border: '1px solid #3B82F630' }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <LogIn className="w-3.5 h-3.5" style={{ color: '#3B82F6' }} />
                  <span className="text-xs font-semibold" style={{ color: '#3B82F6' }}>Check-in</span>
                </div>
                <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  {new Date(checkin.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
                {checkin.localizacao_endereco && (
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>{checkin.localizacao_endereco}</p>
                )}
                {checkin.fotos?.length > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <Camera className="w-3 h-3" style={{ color: 'var(--text-secondary)' }} />
                    <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{checkin.fotos.length} foto(s)</span>
                  </div>
                )}
              </div>
            )}

            {checkout && (
              <div className="p-2 rounded-lg" style={{ background: '#10B98115', border: '1px solid #10B98130' }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <LogOut className="w-3.5 h-3.5" style={{ color: '#10B981' }} />
                  <span className="text-xs font-semibold" style={{ color: '#10B981' }}>Check-out</span>
                </div>
                <p className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>
                  {new Date(checkout.data_hora).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                </p>
                {checkout.localizacao_endereco && (
                  <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-secondary)' }}>{checkout.localizacao_endereco}</p>
                )}
                {checkout.observacao && (
                  <p className="text-xs mt-1 italic" style={{ color: 'var(--text-secondary)' }}>{checkout.observacao}</p>
                )}
              </div>
            )}

            {!checkin && !checkout && (
              <div className="col-span-2 p-2 rounded-lg text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Sem registros de check-in/check-out</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RotaCard({ rota }: { rota: RotaRealizada }) {
  const [expanded, setExpanded] = useState(false);
  const [agendamentos, setAgendamentos] = useState<AgendamentoRota[]>([]);
  const [loadingAg, setLoadingAg] = useState(false);
  const statusCfg = STATUS_CONFIG[rota.status] || STATUS_CONFIG.aplicada;
  const StatusIcon = statusCfg.icon;

  const osIds = rota.os_incluidas?.map(o => o.os_id) || [];

  const loadAgendamentos = useCallback(async () => {
    if (!osIds.length || agendamentos.length > 0) return;
    setLoadingAg(true);
    try {
      const { data } = await supabase
        .from('agendamentos')
        .select(`
          id, os_id, status, data_agendamento, horario_inicio, horario_fim,
          os:os!agendamentos_os_id_fkey(
            numero_os_interna, numero_os_samsung, cliente_nome,
            defeito_relatado, coluna_kanban, valor_total, valor_pago, status_pagamento
          )
        `)
        .in('os_id', osIds)
        .order('data_agendamento', { ascending: true });

      if (data && data.length > 0) {
        const agIds = data.map(a => a.id);
        const { data: checkinData } = await supabase
          .from('agendamentos_checkin_checkout')
          .select('id, agendamento_id, tipo, data_hora, localizacao_endereco, fotos, observacao')
          .in('agendamento_id', agIds)
          .order('data_hora', { ascending: true });

        const checkinMap: Record<string, { checkins: CheckinData[]; checkouts: CheckinData[] }> = {};
        for (const ag of data) {
          checkinMap[ag.id] = { checkins: [], checkouts: [] };
        }
        for (const c of checkinData || []) {
          if (checkinMap[c.agendamento_id]) {
            if (c.tipo === 'checkin') checkinMap[c.agendamento_id].checkins.push(c);
            else checkinMap[c.agendamento_id].checkouts.push(c);
          }
        }

        const merged = data.map(ag => ({
          ...ag,
          checkins: checkinMap[ag.id]?.checkins || [],
          checkouts: checkinMap[ag.id]?.checkouts || [],
        })) as AgendamentoRota[];

        setAgendamentos(merged);
      } else {
        setAgendamentos([]);
      }
    } finally {
      setLoadingAg(false);
    }
  }, [osIds, agendamentos.length]);

  const handleExpand = () => {
    const next = !expanded;
    setExpanded(next);
    if (next) loadAgendamentos();
  };

  const totalValor = agendamentos.reduce((s, a) => s + (a.os?.valor_total || 0), 0);
  const totalPago = agendamentos.reduce((s, a) => s + (a.os?.valor_pago || 0), 0);
  const osConcluidas = agendamentos.filter(a => a.status === 'concluido').length;
  const osComCheckin = agendamentos.filter(a => a.checkins?.length > 0).length;

  return (
    <div className="rounded-xl border overflow-hidden transition-all" style={{ borderColor: rota.cor_rota + '40', background: 'var(--bg-card)' }}>
      <button
        className="w-full flex items-center gap-4 p-4 text-left hover:opacity-90 transition-opacity"
        onClick={handleExpand}
      >
        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: rota.cor_rota }} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{rota.nome}</span>
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: statusCfg.bg, color: statusCfg.color }}>
              <StatusIcon className="w-3 h-3" />
              {statusCfg.label}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1 flex-wrap">
            {rota.tecnico && (
              <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <User className="w-3 h-3" />
                {rota.tecnico.nome}
              </span>
            )}
            {rota.data_aplicacao && (
              <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <Calendar className="w-3 h-3" />
                {formatDate(rota.data_aplicacao)}
              </span>
            )}
            {rota.metricas?.distancia_total_km != null && (
              <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <Navigation className="w-3 h-3" />
                {rota.metricas.distancia_total_km.toFixed(1)} km
              </span>
            )}
            <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <MapPin className="w-3 h-3" />
              {rota.os_incluidas?.length || 0} OS
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-shrink-0">
          {expanded ? <ChevronDown className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} /> : <ChevronRight className="w-4 h-4" style={{ color: 'var(--text-secondary)' }} />}
        </div>
      </button>

      {expanded && (
        <div className="border-t" style={{ borderColor: 'var(--border-primary)' }}>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-0 border-b" style={{ borderColor: 'var(--border-primary)' }}>
            {[
              { label: 'OS na rota', value: rota.os_incluidas?.length || 0, icon: MapPin, color: rota.cor_rota },
              { label: 'Com check-in', value: osComCheckin, icon: LogIn, color: '#3B82F6' },
              { label: 'Concluidas', value: osConcluidas, icon: CheckCircle2, color: '#10B981' },
              {
                label: 'Valor total',
                value: formatCurrency(totalValor),
                icon: DollarSign,
                color: '#10B981'
              },
            ].map((m, i) => {
              const Icon = m.icon;
              return (
                <div key={i} className="p-4 flex items-center gap-3 border-r last:border-r-0" style={{ borderColor: 'var(--border-primary)' }}>
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ background: m.color + '20' }}>
                    <Icon className="w-4 h-4" style={{ color: m.color }} />
                  </div>
                  <div>
                    <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{m.label}</p>
                    <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{m.value}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {rota.metricas && Object.keys(rota.metricas).length > 0 && (
            <div className="p-4 border-b flex flex-wrap gap-4" style={{ borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)' }}>
              {rota.metricas.distancia_total_km != null && (
                <div className="flex items-center gap-2">
                  <Navigation className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{rota.metricas.distancia_total_km.toFixed(1)} km</strong> percorridos
                  </span>
                </div>
              )}
              {rota.metricas.tempo_total_minutos != null && (
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{formatDuration(rota.metricas.tempo_total_minutos)}</strong> estimados
                  </span>
                </div>
              )}
              {rota.metricas.horario_inicio && rota.metricas.horario_fim && (
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5" style={{ color: 'var(--text-secondary)' }} />
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <strong style={{ color: 'var(--text-primary)' }}>{rota.metricas.horario_inicio} - {rota.metricas.horario_fim}</strong> janela de trabalho
                  </span>
                </div>
              )}
              {totalValor > 0 && (
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-3.5 h-3.5" style={{ color: '#10B981' }} />
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    <strong style={{ color: '#10B981' }}>{formatCurrency(totalPago)}</strong> recebido de{' '}
                    <strong style={{ color: 'var(--text-primary)' }}>{formatCurrency(totalValor)}</strong>
                  </span>
                </div>
              )}
            </div>
          )}

          <div className="p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--text-secondary)' }}>
              OS da rota
            </h4>
            {loadingAg ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--text-secondary)' }} />
              </div>
            ) : agendamentos.length > 0 ? (
              <div className="space-y-2">
                {agendamentos.map(ag => (
                  <AgendamentoCard key={ag.id} ag={ag} />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {rota.os_incluidas?.sort((a, b) => a.ordem_visita - b.ordem_visita).map((os, idx) => (
                  <div key={os.os_id} className="flex items-center gap-3 p-3 rounded-lg"
                    style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
                    <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
                      style={{ background: rota.cor_rota + '30', color: rota.cor_rota }}>
                      {idx + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{os.cliente_nome || os.numero_os}</p>
                      {os.endereco && (
                        <p className="text-xs truncate" style={{ color: 'var(--text-secondary)' }}>{os.endereco}</p>
                      )}
                    </div>
                    {os.horario_chegada && (
                      <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>{os.horario_chegada}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {rota.observacoes && (
            <div className="px-4 pb-4">
              <div className="p-3 rounded-lg" style={{ background: '#F59E0B10', border: '1px solid #F59E0B30' }}>
                <p className="text-xs font-medium mb-1" style={{ color: '#F59E0B' }}>Observacoes</p>
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{rota.observacoes}</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const STATUS_FILTER_OPTIONS = [
  { value: 'all', label: 'Todos os status' },
  { value: 'aplicada', label: 'Aplicada' },
  { value: 'em_andamento', label: 'Em Andamento' },
  { value: 'concluida', label: 'Concluida' },
  { value: 'cancelada', label: 'Cancelada' },
];

export default function RotasRealizadas() {
  const { selectedUnidade, isMaster } = useOtimizador();
  const [rotas, setRotas] = useState<RotaRealizada[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [periodoFilter, setPeriodoFilter] = useState('30');

  const loadRotas = useCallback(async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('rotas_otimizadas')
        .select(`
          id, nome, status, data_aplicacao, data_conclusao, criado_por,
          observacoes, metricas, os_incluidas, cor_rota, resumo_financeiro,
          tecnico:usuarios!rotas_otimizadas_tecnico_id_fkey(nome),
          unidade:unidades!rotas_otimizadas_unidade_id_fkey(nome)
        `)
        .not('status', 'eq', 'rascunho')
        .order('data_aplicacao', { ascending: false });

      if (selectedUnidade && !isMaster) {
        query = query.eq('unidade_id', selectedUnidade);
      } else if (selectedUnidade) {
        query = query.eq('unidade_id', selectedUnidade);
      }

      const diasAtras = parseInt(periodoFilter);
      if (diasAtras > 0) {
        const desde = new Date();
        desde.setDate(desde.getDate() - diasAtras);
        query = query.gte('data_aplicacao', desde.toISOString());
      }

      const { data, error } = await query;
      if (!error && data) {
        setRotas(data as RotaRealizada[]);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedUnidade, isMaster, periodoFilter]);

  useEffect(() => {
    loadRotas();
  }, [loadRotas]);

  const filtered = rotas.filter(r => {
    if (statusFilter !== 'all' && r.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      const tecnicoNome = (r.tecnico as any)?.nome?.toLowerCase() || '';
      if (!r.nome.toLowerCase().includes(s) && !tecnicoNome.includes(s)) return false;
    }
    return true;
  });

  const totalOS = filtered.reduce((s, r) => s + (r.os_incluidas?.length || 0), 0);
  const totalKm = filtered.reduce((s, r) => s + (r.metricas?.distancia_total_km || 0), 0);
  const rotasConcluidas = filtered.filter(r => r.status === 'concluida').length;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: '#3B82F615', border: '1px solid #3B82F630' }}>
            <FolderOpen className="w-5 h-5" style={{ color: '#3B82F6' }} />
          </div>
          <div>
            <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Rotas Realizadas</h2>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Historico completo de rotas planejadas e executadas</p>
          </div>
        </div>
        <button
          onClick={loadRotas}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Rotas registradas', value: filtered.length, icon: Route, color: '#3B82F6' },
          { label: 'Concluidas', value: rotasConcluidas, icon: CheckCircle2, color: '#10B981' },
          { label: 'Total de OS', value: totalOS, icon: MapPin, color: '#F59E0B' },
          { label: 'KM total', value: totalKm > 0 ? `${totalKm.toFixed(0)} km` : '—', icon: Navigation, color: '#EC4899' },
        ].map((m, i) => {
          const Icon = m.icon;
          return (
            <div key={i} className="rounded-xl p-4 flex items-center gap-3"
              style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: m.color + '20' }}>
                <Icon className="w-5 h-5" style={{ color: m.color }} />
              </div>
              <div>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{m.label}</p>
                <p className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{m.value}</p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-secondary)' }} />
          <input
            type="text"
            placeholder="Buscar por nome ou tecnico..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg text-sm outline-none"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
        >
          {STATUS_FILTER_OPTIONS.map(o => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <select
          value={periodoFilter}
          onChange={e => setPeriodoFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
        >
          <option value="7">Ultimos 7 dias</option>
          <option value="30">Ultimos 30 dias</option>
          <option value="60">Ultimos 60 dias</option>
          <option value="90">Ultimos 90 dias</option>
          <option value="0">Todos</option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--text-secondary)' }} />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl p-12 text-center"
          style={{ background: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: 'var(--text-secondary)' }} />
          <p className="font-medium" style={{ color: 'var(--text-primary)' }}>Nenhuma rota encontrada</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            {rotas.length === 0
              ? 'As rotas otimizadas e aplicadas apareceram aqui automaticamente'
              : 'Tente ajustar os filtros acima'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(rota => (
            <RotaCard key={rota.id} rota={rota} />
          ))}
        </div>
      )}
    </div>
  );
}
