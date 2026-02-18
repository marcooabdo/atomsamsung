import { useState, useEffect } from 'react';
import { Users, Clock, CheckCircle, Search, Award, AlertTriangle, MapPin } from 'lucide-react';
import { useOtimizador } from '../../contexts/OtimizadorContext';
import { supabase } from '../../lib/supabase';

interface TecnicoStats {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  horario_inicio_expediente: string;
  horario_fim_expediente: string;
  duracao_almoco_minutos: number;
  horario_almoco_inicio: string;
  ativo: boolean;
  tipo: string;
  os_concluidas: number;
  os_em_andamento: number;
  os_atrasadas: number;
  taxa_sucesso: number;
  tempo_medio_min: number;
}

export default function GestaoEquipe() {
  const { selectedUnidade, loading } = useOtimizador();
  const [tecnicos, setTecnicos] = useState<TecnicoStats[]>([]);
  const [loadingTecnicos, setLoadingTecnicos] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (selectedUnidade) loadTecnicosStats();
  }, [selectedUnidade]);

  const loadTecnicosStats = async () => {
    setLoadingTecnicos(true);
    try {
      const { data: tecnicosData } = await supabase
        .from('usuarios')
        .select('id, nome, email, telefone, horario_inicio_expediente, horario_fim_expediente, duracao_almoco_minutos, horario_almoco_inicio, ativo, tipo')
        .eq('unidade_id', selectedUnidade)
        .in('tipo', ['tecnico', 'tecnico_ih'])
        .order('nome');

      if (!tecnicosData || tecnicosData.length === 0) {
        setTecnicos([]);
        return;
      }

      const tecIds = tecnicosData.map(t => t.id);

      const [osRes, agendRes] = await Promise.all([
        supabase
          .from('os')
          .select('id, tecnico_id, tecnico_agendado_id, coluna_kanban, created_at')
          .eq('unidade_id', selectedUnidade)
          .or(`tecnico_id.in.(${tecIds.join(',')}),tecnico_agendado_id.in.(${tecIds.join(',')})`),
        supabase
          .from('agendamentos')
          .select('tecnico_id, checkin_hora, checkout_hora, status')
          .in('tecnico_id', tecIds)
          .eq('checkout_realizado', true),
      ]);

      const allOs = osRes.data || [];
      const allAgend = agendRes.data || [];
      const now = new Date();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const closedColumns = ['os_fechada', 'reparo_concluido'];

      const tecnicosComStats = tecnicosData.map(tec => {
        const tecOs = allOs.filter(o => o.tecnico_id === tec.id || o.tecnico_agendado_id === tec.id);
        const concluidas = tecOs.filter(o => closedColumns.includes(o.coluna_kanban)).length;
        const emAndamento = tecOs.filter(o => !closedColumns.includes(o.coluna_kanban)).length;
        const atrasadas = tecOs.filter(o => !closedColumns.includes(o.coluna_kanban) && o.created_at < sevenDaysAgo).length;
        const total = tecOs.length;
        const taxa = total > 0 ? Math.round((concluidas / total) * 100) : 0;

        const tecAgend = allAgend.filter(a => a.tecnico_id === tec.id && a.checkin_hora && a.checkout_hora);
        let tempoMedio = 0;
        if (tecAgend.length > 0) {
          const totalMin = tecAgend.reduce((sum, a) => {
            const diff = new Date(a.checkout_hora!).getTime() - new Date(a.checkin_hora!).getTime();
            return sum + diff / 60000;
          }, 0);
          tempoMedio = Math.round(totalMin / tecAgend.length);
        }

        return {
          ...tec,
          os_concluidas: concluidas,
          os_em_andamento: emAndamento,
          os_atrasadas: atrasadas,
          taxa_sucesso: taxa,
          tempo_medio_min: tempoMedio,
        };
      });

      setTecnicos(tecnicosComStats);
    } catch {
    } finally {
      setLoadingTecnicos(false);
    }
  };

  const filteredTecnicos = tecnicos.filter(t =>
    t.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalOsConcluidas = tecnicos.reduce((s, t) => s + t.os_concluidas, 0);
  const totalOsEmAndamento = tecnicos.reduce((s, t) => s + t.os_em_andamento, 0);
  const totalAtrasadas = tecnicos.reduce((s, t) => s + t.os_atrasadas, 0);
  const mediaTaxa = tecnicos.length > 0
    ? Math.round(tecnicos.reduce((s, t) => s + t.taxa_sucesso, 0) / tecnicos.length)
    : 0;

  if (loadingTecnicos || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-3 rounded-full animate-spin" style={{ borderColor: 'var(--border-primary)', borderTopColor: 'var(--text-accent)' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Gestao de Equipe</h2>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>Performance e disponibilidade dos tecnicos</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Tecnicos', value: tecnicos.length, icon: Users, color: '#06B6D4' },
          { label: 'OS Concluidas', value: totalOsConcluidas, icon: CheckCircle, color: '#10B981' },
          { label: 'Em Andamento', value: totalOsEmAndamento, icon: Clock, color: '#3B82F6' },
          { label: 'Taxa Sucesso', value: `${mediaTaxa}%`, icon: Award, color: '#F59E0B' },
        ].map(card => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="rounded-xl p-5" style={{ backgroundColor: `${card.color}08`, border: `1px solid ${card.color}25` }}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{card.label}</p>
                  <p className="text-2xl font-bold mt-1" style={{ color: card.color }}>{card.value}</p>
                </div>
                <Icon className="w-10 h-10 opacity-40" style={{ color: card.color }} />
              </div>
            </div>
          );
        })}
      </div>

      <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
        <div className="relative mb-5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--text-tertiary)' }} />
          <input
            type="text"
            placeholder="Buscar técnico..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm focus:outline-none transition-colors"
            style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
          />
        </div>

        {filteredTecnicos.length === 0 ? (
          <div className="text-center py-12">
            <Users className="w-14 h-14 mx-auto mb-3 opacity-30" style={{ color: 'var(--text-tertiary)' }} />
            <p style={{ color: 'var(--text-secondary)' }}>Nenhum técnico encontrado</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTecnicos.map(tec => (
              <div key={tec.id} className="rounded-lg p-5 transition-colors" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)' }}>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ backgroundColor: tec.ativo ? '#10B981' : '#6B7280' }}>
                    {tec.nome.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>{tec.nome}</h3>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{
                        backgroundColor: tec.ativo ? '#10B98115' : '#EF444415',
                        color: tec.ativo ? '#10B981' : '#EF4444',
                        border: `1px solid ${tec.ativo ? '#10B98130' : '#EF444430'}`,
                      }}>
                        {tec.ativo ? 'Ativo' : 'Inativo'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium" style={{
                        backgroundColor: '#3B82F615',
                        color: '#3B82F6',
                        border: '1px solid #3B82F630',
                      }}>
                        {tec.tipo === 'tecnico_ih' ? 'IH' : 'CI'}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>{tec.email}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3 text-xs">
                  <div>
                    <span style={{ color: 'var(--text-tertiary)' }}>Expediente</span>
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {tec.horario_inicio_expediente?.substring(0, 5) || '08:00'} - {tec.horario_fim_expediente?.substring(0, 5) || '18:00'}
                    </p>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-tertiary)' }}>Almoco</span>
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {tec.horario_almoco_inicio?.substring(0, 5) || '12:00'} ({tec.duracao_almoco_minutos || 60}min)
                    </p>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-tertiary)' }}>Telefone</span>
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>{tec.telefone || '-'}</p>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-tertiary)' }}>Tempo Medio</span>
                    <p className="font-medium" style={{ color: 'var(--text-primary)' }}>
                      {tec.tempo_medio_min > 0 ? `${tec.tempo_medio_min}min` : '-'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                  {[
                    { label: 'Concluidas', val: tec.os_concluidas, color: '#10B981' },
                    { label: 'Andamento', val: tec.os_em_andamento, color: '#3B82F6' },
                    { label: 'Taxa', val: `${tec.taxa_sucesso}%`, color: '#F59E0B' },
                    { label: 'Atrasadas', val: tec.os_atrasadas, color: '#EF4444' },
                  ].map(s => (
                    <div key={s.label} className="rounded-lg p-2.5 text-center" style={{ backgroundColor: `${s.color}08`, border: `1px solid ${s.color}20` }}>
                      <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{s.label}</p>
                      <p className="text-lg font-bold" style={{ color: s.color }}>{s.val}</p>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
