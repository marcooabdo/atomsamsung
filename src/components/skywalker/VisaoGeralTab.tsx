import { useState, useEffect } from 'react';
import { Star, TrendingUp, Award, Flame, Target, Trophy, CheckCircle2, Clock, ArrowUp, Zap, Users } from 'lucide-react';
import { useSkywalker, type Profissional, type EstrelaMes } from '../../contexts/SkywalkerContext';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';

export function VisaoGeralTab() {
  const { usuario } = useAuth();
  const { myProfissional, profissionais, niveis, ranking, mesReferencia, loadEstrelasDoMes, estrelasDoMes, isAdmin } = useSkywalker();
  const [selectedProfissional, setSelectedProfissional] = useState<Profissional | null>(null);
  const [selectedEstrelas, setSelectedEstrelas] = useState<EstrelaMes[]>([]);

  useEffect(() => {
    if (myProfissional) {
      loadEstrelasDoMes(myProfissional.id, mesReferencia);
    }
  }, [myProfissional, mesReferencia]);

  const openDetails = async (prof: Profissional) => {
    setSelectedProfissional(prof);
    const { data } = await supabase
      .from('skywalker_estrelas_mes')
      .select('*, pilar:skywalker_pilares(nome, descricao, tipo_metrica, max_estrelas)')
      .eq('profissional_id', prof.id)
      .eq('mes_referencia', mesReferencia);
    setSelectedEstrelas(data as any || []);
  };

  const myRankPos = ranking.findIndex(r => r.usuario_id === usuario?.id) + 1;
  const myStars = estrelasDoMes.reduce((s, e) => s + e.estrelas_conquistadas, 0);
  const metaStars = myProfissional?.nivel?.estrelas_necessarias || 6;
  const progressPercent = Math.min((myStars / metaStars) * 100, 100);
  const metaAtingida = myStars >= metaStars;
  const nextNivel = niveis.find(n => n.ordem === (myProfissional?.nivel?.ordem || 0) + 1);

  if (!myProfissional) {
    return (
      <div className="space-y-8">
        <div className="text-center py-12 rounded-xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          <Star className="w-16 h-16 mx-auto mb-4 opacity-30" style={{ color: 'var(--text-accent)' }} />
          <h3 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
            Voce ainda nao esta no programa Skywalker
          </h3>
          <p style={{ color: 'var(--text-secondary)' }}>
            Solicite ao seu gestor para ser adicionado ao programa de gamificacao.
          </p>
        </div>
        {isAdmin && <AdminOverview onSelect={openDetails} />}
        {selectedProfissional && (
          <ProfissionalModal profissional={selectedProfissional} estrelas={selectedEstrelas} onClose={() => setSelectedProfissional(null)} />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl p-6 relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${myProfissional.nivel?.cor || '#3B82F6'}15, ${myProfissional.nivel?.cor || '#3B82F6'}05)`, border: `1px solid ${myProfissional.nivel?.cor || '#3B82F6'}30` }}>
        <div className="absolute top-0 right-0 w-48 h-48 opacity-5">
          <Star className="w-full h-full" style={{ color: myProfissional.nivel?.cor }} />
        </div>

        <div className="flex items-start justify-between flex-wrap gap-4 relative z-10">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-bold" style={{ backgroundColor: (myProfissional.nivel?.cor || '#3B82F6') + '25', color: myProfissional.nivel?.cor || '#3B82F6' }}>
              {usuario?.nome?.split(' ').map(n => n[0]).join('').substring(0, 2)}
            </div>
            <div>
              <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>{usuario?.nome}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: (myProfissional.nivel?.cor || '#3B82F6') + '20', color: myProfissional.nivel?.cor }}>
                  {myProfissional.nivel?.nome || 'Starter'}
                </span>
                <span className="text-sm px-2 py-0.5 rounded" style={{ backgroundColor: (myProfissional.skywalker_time?.cor || '#6B7280') + '20', color: myProfissional.skywalker_time?.cor }}>
                  {myProfissional.skywalker_time?.nome || myProfissional.time}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-center">
              <div className="flex items-center gap-1 justify-center">
                <Star className="w-8 h-8 fill-current" style={{ color: '#FBBF24' }} />
                <span className="text-4xl font-bold" style={{ color: '#FBBF24' }}>{myStars}</span>
                <span className="text-lg opacity-50" style={{ color: 'var(--text-secondary)' }}>/{metaStars}</span>
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)' }}>estrelas este mês</p>
            </div>
          </div>
        </div>

        <div className="mt-5 relative z-10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Progresso da Meta</span>
            <span className="text-sm font-bold" style={{ color: metaAtingida ? '#10B981' : '#FBBF24' }}>
              {Math.round(progressPercent)}%
            </span>
          </div>
          <div className="h-3 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--progress-track)' }}>
            <div
              className="h-full rounded-full transition-all duration-1000 ease-out"
              style={{
                width: `${progressPercent}%`,
                background: metaAtingida
                  ? 'linear-gradient(90deg, #10B981, #34D399)'
                  : `linear-gradient(90deg, ${myProfissional.nivel?.cor || '#FBBF24'}, #FBBF24)`,
              }}
            />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard icon={Trophy} label="Ranking" value={myRankPos > 0 ? `#${myRankPos}` : '-'} sublabel={`de ${ranking.length}`} color="#FBBF24" />
        <KPICard icon={Flame} label="Sequência" value={`${myProfissional.meses_consecutivos_validos}`} sublabel="meses" color="#F97316" />
        <KPICard icon={metaAtingida ? CheckCircle2 : Target} label="Meta" value={metaAtingida ? 'Atingida' : `Faltam ${metaStars - myStars}`} sublabel={metaAtingida ? 'Parabens!' : 'estrelas'} color={metaAtingida ? '#10B981' : '#EF4444'} />
        <KPICard icon={Award} label="Bônus" value={metaAtingida ? `R$ ${(myProfissional.nivel?.bonus_valor || 0).toLocaleString('pt-BR')}` : '-'} sublabel={metaAtingida ? 'este mês' : 'atinja a meta'} color="#8B5CF6" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-3">
          <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Zap className="w-5 h-5" style={{ color: '#FBBF24' }} />
            Seus Pilares
          </h3>
          <div className="space-y-2">
            {estrelasDoMes.length > 0 ? estrelasDoMes.map(e => {
              const maxStars = (e.pilar as any)?.max_estrelas || 3;
              const pctPilar = Math.min((e.estrelas_conquistadas / maxStars) * 100, 100);
              return (
                <div key={e.pilar_id} className="rounded-xl p-4 flex items-center gap-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-medium text-sm" style={{ color: 'var(--text-primary)' }}>{(e.pilar as any)?.nome}</p>
                      <div className="flex items-center gap-1">
                        {Array.from({ length: maxStars }).map((_, i) => (
                          <Star key={i} className={`w-4 h-4 ${i < e.estrelas_conquistadas ? 'fill-current' : ''}`} style={{ color: i < e.estrelas_conquistadas ? '#FBBF24' : 'var(--border-primary)' }} />
                        ))}
                      </div>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--progress-track)' }}>
                      <div className="h-full rounded-full" style={{ width: `${pctPilar}%`, backgroundColor: e.estrelas_conquistadas >= maxStars ? '#10B981' : '#FBBF24' }} />
                    </div>
                    <div className="flex justify-between mt-1">
                      <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>Valor: {e.valor_metrica}</span>
                      <span className="text-xs font-medium" style={{ color: e.estrelas_conquistadas >= maxStars ? '#10B981' : '#FBBF24' }}>{e.estrelas_conquistadas}/{maxStars}</span>
                    </div>
                  </div>
                </div>
              );
            }) : (
              <div className="text-center py-8 rounded-xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
                <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" style={{ color: 'var(--text-secondary)' }} />
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Nenhuma estrela calculada para este mês</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-3">
          {nextNivel && (
            <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
              <h4 className="text-sm font-bold flex items-center gap-2 mb-3" style={{ color: 'var(--text-primary)' }}>
                <ArrowUp className="w-4 h-4" style={{ color: nextNivel.cor }} />
                Proximo Nivel
              </h4>
              <div className="flex items-center gap-3 p-3 rounded-lg mb-3" style={{ backgroundColor: nextNivel.cor + '10', border: `1px solid ${nextNivel.cor}30` }}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold" style={{ backgroundColor: nextNivel.cor + '25', color: nextNivel.cor }}>
                  {nextNivel.ordem}
                </div>
                <div>
                  <p className="font-bold" style={{ color: nextNivel.cor }}>{nextNivel.nome}</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                    {nextNivel.estrelas_necessarias} estrelas por {nextNivel.meses_consecutivos} meses
                  </p>
                </div>
              </div>

              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                      <Star className="w-3 h-3" style={{ color: '#FBBF24' }} />
                      Estrelas necessarias
                    </span>
                    <span className="text-xs font-bold" style={{ color: nextNivel.cor }}>
                      {myStars}/{nextNivel.estrelas_necessarias}
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--progress-track)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-out"
                      style={{
                        width: `${Math.min((myStars / nextNivel.estrelas_necessarias) * 100, 100)}%`,
                        background: `linear-gradient(90deg, ${nextNivel.cor}, ${nextNivel.cor}dd)`,
                      }}
                    />
                  </div>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {myStars >= nextNivel.estrelas_necessarias
                      ? 'Meta de estrelas atingida!'
                      : `Faltam ${nextNivel.estrelas_necessarias - myStars} estrelas`}
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
                      <Flame className="w-3 h-3" style={{ color: '#F97316' }} />
                      Meses consecutivos
                    </span>
                    <span className="text-xs font-bold" style={{ color: nextNivel.cor }}>
                      {myProfissional.meses_consecutivos_validos}/{nextNivel.meses_consecutivos}
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--progress-track)' }}>
                    <div
                      className="h-full rounded-full transition-all duration-1000 ease-out"
                      style={{
                        width: `${Math.min((myProfissional.meses_consecutivos_validos / nextNivel.meses_consecutivos) * 100, 100)}%`,
                        background: 'linear-gradient(90deg, #F97316, #FB923C)',
                      }}
                    />
                  </div>
                  <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                    {myProfissional.meses_consecutivos_validos >= nextNivel.meses_consecutivos
                      ? 'Sequencia completa!'
                      : `Faltam ${nextNivel.meses_consecutivos - myProfissional.meses_consecutivos_validos} meses`}
                  </p>
                </div>
              </div>

              {nextNivel.bonus_valor > 0 && (
                <p className="text-sm mt-3 text-center font-medium" style={{ color: '#10B981' }}>
                  Bonus: R$ {nextNivel.bonus_valor.toLocaleString('pt-BR')}/mes
                </p>
              )}
            </div>
          )}

          <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
            <h4 className="text-sm font-bold flex items-center gap-2 mb-3" style={{ color: 'var(--text-primary)' }}>
              <Award className="w-4 h-4" style={{ color: 'var(--text-accent)' }} />
              Todos os Niveis
            </h4>
            <div className="space-y-2">
              {niveis.map(nivel => {
                const isCurrent = nivel.id === myProfissional?.nivel?.id;
                const isPast = nivel.ordem < (myProfissional?.nivel?.ordem || 1);
                return (
                  <div
                    key={nivel.id}
                    className="flex items-center gap-3 p-2 rounded-lg transition-all"
                    style={{
                      backgroundColor: isCurrent ? nivel.cor + '15' : 'transparent',
                      border: isCurrent ? `1px solid ${nivel.cor}40` : '1px solid transparent',
                      opacity: isPast ? 0.5 : 1,
                    }}
                  >
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: nivel.cor + '25', color: nivel.cor }}>
                      {isPast ? <CheckCircle2 className="w-4 h-4" /> : nivel.ordem}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium" style={{ color: isCurrent ? nivel.cor : 'var(--text-primary)' }}>
                        {nivel.nome} {isCurrent && '(atual)'}
                      </p>
                      <p className="text-[10px]" style={{ color: 'var(--text-secondary)' }}>{nivel.estrelas_necessarias} estrelas</p>
                    </div>
                    {nivel.bonus_valor > 0 && (
                      <span className="text-[10px] font-medium" style={{ color: '#10B981' }}>R${nivel.bonus_valor}</span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {isAdmin && <AdminOverview onSelect={openDetails} />}

      {selectedProfissional && (
        <ProfissionalModal profissional={selectedProfissional} estrelas={selectedEstrelas} onClose={() => setSelectedProfissional(null)} />
      )}
    </div>
  );
}

function KPICard({ icon: Icon, label, value, sublabel, color }: { icon: any; label: string; value: string; sublabel: string; color: string }) {
  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" style={{ color }} />
        <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{label}</span>
      </div>
      <p className="text-xl font-bold" style={{ color }}>{value}</p>
      <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{sublabel}</p>
    </div>
  );
}

function AdminOverview({ onSelect }: { onSelect: (prof: Profissional) => void }) {
  const { profissionais, ranking, niveis } = useSkywalker();

  const niveisDistribution = niveis.map(nivel => {
    const count = profissionais.filter(p => p.nivel?.id === nivel.id).length;
    return { ...nivel, count };
  });

  const totalStars = ranking.reduce((s, r) => s + r.estrelas_total, 0);
  const avgStars = ranking.length > 0 ? (totalStars / ranking.length).toFixed(1) : '0';

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
        <Users className="w-5 h-5" style={{ color: 'var(--text-accent)' }} />
        Visão do Gestor
      </h3>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Total Profissionais</p>
          <p className="text-2xl font-bold mt-1" style={{ color: 'var(--text-accent)' }}>{profissionais.length}</p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Media de Estrelas</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#FBBF24' }}>{avgStars}</p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Meta Atingida</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#10B981' }}>
            {ranking.filter(r => r.estrelas_total >= r.estrelas_necessarias).length}
          </p>
        </div>
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Abaixo da Meta</p>
          <p className="text-2xl font-bold mt-1" style={{ color: '#EF4444' }}>
            {ranking.filter(r => r.estrelas_total < r.estrelas_necessarias).length}
          </p>
        </div>
      </div>

      <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
        <h4 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Distribuicao por Nivel</h4>
        <div className="space-y-2">
          {niveisDistribution.map(nivel => {
            const pct = profissionais.length > 0 ? (nivel.count / profissionais.length) * 100 : 0;
            return (
              <div key={nivel.id} className="flex items-center gap-3">
                <span className="w-24 text-xs font-medium truncate" style={{ color: nivel.cor }}>{nivel.nome}</span>
                <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--progress-track)' }}>
                  <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: nivel.cor }} />
                </div>
                <span className="text-xs font-bold w-8 text-right" style={{ color: 'var(--text-secondary)' }}>{nivel.count}</span>
              </div>
            );
          })}
        </div>
      </div>

      {ranking.length > 0 && (
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          <h4 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>Top 5 do Mês</h4>
          <div className="space-y-2">
            {ranking.slice(0, 5).map((r, idx) => (
              <div key={r.profissional_id} className="flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:opacity-80" style={{ backgroundColor: idx === 0 ? '#FBBF2408' : 'transparent' }} onClick={() => {
                const prof = profissionais.find(p => p.id === r.profissional_id);
                if (prof) onSelect(prof);
              }}>
                <span className="w-6 text-center font-bold text-sm" style={{ color: idx < 3 ? '#FBBF24' : 'var(--text-secondary)' }}>{idx + 1}</span>
                <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold" style={{ backgroundColor: r.nivel_cor + '25', color: r.nivel_cor }}>
                  {r.nome.split(' ').map(n => n[0]).join('').substring(0, 2)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{r.nome}</p>
                </div>
                <div className="flex items-center gap-1">
                  <Star className="w-3.5 h-3.5 fill-current" style={{ color: '#FBBF24' }} />
                  <span className="text-sm font-bold" style={{ color: '#FBBF24' }}>{r.estrelas_total}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProfissionalModal({ profissional, estrelas, onClose }: { profissional: Profissional; estrelas: EstrelaMes[]; onClose: () => void }) {
  const totalStars = estrelas.reduce((s, e) => s + e.estrelas_conquistadas, 0);
  const meta = profissional.nivel?.estrelas_necessarias || 6;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }} onClick={(e) => e.stopPropagation()}>
        <div className="p-6" style={{ background: `linear-gradient(135deg, ${profissional.nivel?.cor || '#3B82F6'}20, transparent)` }}>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl flex items-center justify-center text-xl font-bold" style={{ backgroundColor: (profissional.nivel?.cor || '#3B82F6') + '25', color: profissional.nivel?.cor }}>
              {profissional.usuario?.nome?.split(' ').map(n => n[0]).join('').substring(0, 2)}
            </div>
            <div>
              <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{profissional.usuario?.nome}</h3>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: (profissional.nivel?.cor || '#3B82F6') + '20', color: profissional.nivel?.cor }}>
                  {profissional.nivel?.nome}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{profissional.unidade?.nome}</span>
              </div>
            </div>
            <div className="ml-auto text-center">
              <div className="flex items-center gap-1">
                <Star className="w-6 h-6 fill-current" style={{ color: '#FBBF24' }} />
                <span className="text-2xl font-bold" style={{ color: '#FBBF24' }}>{totalStars}</span>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>/{meta}</p>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          {estrelas.map(e => {
            const maxS = (e.pilar as any)?.max_estrelas || 3;
            return (
              <div key={e.pilar_id} className="flex items-center gap-3">
                <div className="flex-1">
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{(e.pilar as any)?.nome}</p>
                  <div className="h-1.5 rounded-full mt-1 overflow-hidden" style={{ backgroundColor: 'var(--progress-track)' }}>
                    <div className="h-full rounded-full" style={{ width: `${Math.min((e.estrelas_conquistadas / maxS) * 100, 100)}%`, backgroundColor: e.estrelas_conquistadas >= maxS ? '#10B981' : '#FBBF24' }} />
                  </div>
                </div>
                <div className="flex items-center gap-0.5">
                  {Array.from({ length: maxS }).map((_, i) => (
                    <Star key={i} className={`w-3.5 h-3.5 ${i < e.estrelas_conquistadas ? 'fill-current' : ''}`} style={{ color: i < e.estrelas_conquistadas ? '#FBBF24' : 'var(--border-primary)' }} />
                  ))}
                </div>
              </div>
            );
          })}
          {estrelas.length === 0 && (
            <p className="text-center py-4 text-sm" style={{ color: 'var(--text-secondary)' }}>Sem dados para este mês</p>
          )}
        </div>

        <div className="p-4 flex justify-end" style={{ borderTop: '1px solid var(--border-primary)' }}>
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: 'var(--text-accent)', color: 'var(--text-on-accent)' }}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
