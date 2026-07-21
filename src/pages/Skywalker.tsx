import { useState, useEffect } from 'react';
import { Star, Trophy, Users, BookOpen, Award, Layers, Settings, UserPlus, Trash2, ChevronDown, ChevronUp, FileCheck, CreditCard as Edit2 } from 'lucide-react';
import { useSkywalker } from '../contexts/SkywalkerContext';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { VisaoGeralTab } from '../components/skywalker/VisaoGeralTab';
import { RegrasJogoTab } from '../components/skywalker/RegrasJogoTab';
import { NiveisBonusTab } from '../components/skywalker/NiveisBonusTab';
import { TimesTab } from '../components/skywalker/TimesTab';
import { ConfirmDeleteModal } from '../components/skywalker/ConfirmDeleteModal';

export function Skywalker() {
  const { usuario } = useAuth();
  const { loading, isAdmin, myProfissional } = useSkywalker();
  const [abaAtiva, setAbaAtiva] = useState('visao-geral');

  const abas = [
    { id: 'visao-geral', nome: 'Meu Painel', icone: Star, admin: false },
    { id: 'ranking', nome: 'Ranking', icone: Trophy, admin: false },
    { id: 'orcamentos', nome: 'Fechamentos', icone: FileCheck, admin: false },
    ...(isAdmin ? [
      { id: 'profissionais', nome: 'Profissionais', icone: Users, admin: true },
      { id: 'regras', nome: 'Regras do Jogo', icone: BookOpen, admin: true },
      { id: 'niveis', nome: 'Niveis e Bonus', icone: Award, admin: true },
      { id: 'times', nome: 'Times', icone: Layers, admin: true },
    ] : []),
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <Star className="w-16 h-16 animate-pulse" style={{ color: 'var(--text-accent)' }} />
            <div className="absolute inset-0 w-16 h-16 rounded-full animate-ping opacity-20" style={{ backgroundColor: 'var(--text-accent)' }} />
          </div>
          <p style={{ color: 'var(--text-secondary)' }}>Carregando Skywalker...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <header className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #FBBF24, #F59E0B)' }}>
            <Star className="w-8 h-8 text-white fill-current" />
          </div>
          <div>
            <h1 className="text-3xl font-bold tracking-tight" style={{ fontFamily: 'var(--font-tech)', color: 'var(--text-primary)' }}>
              SKYWALKER
            </h1>
            <p style={{ color: 'var(--text-secondary)' }} className="text-sm">
              {myProfissional
                ? `${myProfissional.skywalker_time?.nome || myProfissional.time} - ${myProfissional.nivel?.nome || 'Starter'}`
                : 'Sistema de Gamificacao'}
            </p>
          </div>
        </div>

        {myProfissional?.nivel && (
          <div className="flex items-center gap-3 px-4 py-2 rounded-xl" style={{ backgroundColor: myProfissional.nivel.cor + '15', border: `1px solid ${myProfissional.nivel.cor}40` }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: myProfissional.nivel.cor + '30', color: myProfissional.nivel.cor }}>
              {myProfissional.nivel.ordem}
            </div>
            <div>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Nivel Atual</p>
              <p className="font-bold text-sm" style={{ color: myProfissional.nivel.cor }}>{myProfissional.nivel.nome}</p>
            </div>
          </div>
        )}
      </header>

      <nav>
        <div className="flex flex-wrap gap-1.5 p-1.5 rounded-xl" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          {abas.map((aba) => {
            const Icon = aba.icone;
            const isActive = abaAtiva === aba.id;
            return (
              <button
                key={aba.id}
                onClick={() => setAbaAtiva(aba.id)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-lg transition-all text-sm font-medium"
                style={{
                  backgroundColor: isActive ? 'var(--text-accent)' : 'transparent',
                  color: isActive ? 'var(--text-on-accent)' : 'var(--text-secondary)',
                }}
              >
                <Icon className="w-4 h-4" />
                {aba.nome}
                {aba.admin && (
                  <Settings className="w-3 h-3 opacity-50" />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      <div>
        {abaAtiva === 'visao-geral' && <VisaoGeralTab />}
        {abaAtiva === 'ranking' && <RankingTab />}
        {abaAtiva === 'orcamentos' && <OrcamentosRankingTab />}
        {abaAtiva === 'profissionais' && isAdmin && <ProfissionaisTab />}
        {abaAtiva === 'regras' && isAdmin && <RegrasJogoTab />}
        {abaAtiva === 'niveis' && isAdmin && <NiveisBonusTab />}
        {abaAtiva === 'times' && isAdmin && <TimesTab />}
      </div>
    </div>
  );
}

function RankingTab() {
  const { ranking, mesReferencia, loadRanking } = useSkywalker();
  const { usuario } = useAuth();
  const [mesInicio, setMesInicio] = useState(mesReferencia.slice(0, 7));
  const [mesFim, setMesFim] = useState(mesReferencia.slice(0, 7));
  const [filtroUnidade, setFiltroUnidade] = useState('all');
  const [unidades, setUnidades] = useState<{ id: string; nome: string }[]>([]);

  const isPeriodo = mesInicio !== mesFim;

  useEffect(() => {
    supabase.from('unidades').select('id, nome').order('nome').then(({ data }) => {
      if (data) setUnidades(data);
    });
  }, []);

  useEffect(() => {
    const inicio = mesInicio + '-01';
    const fim = mesFim + '-01';
    if (mesInicio <= mesFim) {
      loadRanking(inicio, fim);
    }
  }, [mesInicio, mesFim]);

  const rankingFiltrado = filtroUnidade === 'all'
    ? ranking
    : ranking.filter(r => r.unidade_nome === unidades.find(u => u.id === filtroUnidade)?.nome);

  const myRank = ranking.findIndex(r => r.usuario_id === usuario?.id) + 1;

  const formatMesLabel = (ym: string) => {
    const [year, month] = ym.split('-');
    const names = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
    return `${names[parseInt(month) - 1]}/${year}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Trophy className="w-5 h-5" style={{ color: '#FBBF24' }} />
          Ranking do Time
          {isPeriodo && (
            <span className="text-sm font-normal px-2 py-0.5 rounded-full" style={{ backgroundColor: '#FBBF2420', color: '#FBBF24' }}>
              {formatMesLabel(mesInicio)} - {formatMesLabel(mesFim)}
            </span>
          )}
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>De</span>
            <input
              type="month"
              value={mesInicio}
              onChange={(e) => {
                setMesInicio(e.target.value);
                if (e.target.value > mesFim) setMesFim(e.target.value);
              }}
              className="text-sm bg-transparent outline-none"
              style={{ color: 'var(--text-primary)', minWidth: 120 }}
            />
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
            <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>Ate</span>
            <input
              type="month"
              value={mesFim}
              min={mesInicio}
              onChange={(e) => setMesFim(e.target.value)}
              className="text-sm bg-transparent outline-none"
              style={{ color: 'var(--text-primary)', minWidth: 120 }}
            />
          </div>
          <select
            value={filtroUnidade}
            onChange={(e) => setFiltroUnidade(e.target.value)}
            className="rounded-lg px-3 py-2 text-sm"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
          >
            <option value="all">Todas as Unidades</option>
            {unidades.map(u => (
              <option key={u.id} value={u.id}>{u.nome}</option>
            ))}
          </select>
        </div>
      </div>

      {myRank > 0 && (
        <div className="p-4 rounded-xl" style={{ backgroundColor: 'var(--text-accent)' + '10', border: `1px solid var(--text-accent)` + '30' }}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg" style={{ backgroundColor: 'var(--text-accent)' + '20', color: 'var(--text-accent)' }}>
                #{myRank}
              </div>
              <div>
                <p className="font-bold" style={{ color: 'var(--text-primary)' }}>Sua posicao no ranking</p>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  {rankingFiltrado[myRank - 1]?.estrelas_total || 0} estrelas {isPeriodo ? 'no periodo' : 'este mes'}
                </p>
              </div>
            </div>
            {myRank <= 3 && (
              <span className="text-3xl">{myRank === 1 ? '1o' : myRank === 2 ? '2o' : '3o'}</span>
            )}
          </div>
        </div>
      )}

      {rankingFiltrado.length >= 3 && (
        <div className="rounded-2xl p-6" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
          <div className="flex items-end justify-center gap-3">
            {[
              { rankIdx: 1, pos: 2, color: '#C0C0C0', barHeight: 80, avatarSize: 'w-14 h-14', avatarText: 'text-base', crown: '🥈' },
              { rankIdx: 0, pos: 1, color: '#FFD700', barHeight: 120, avatarSize: 'w-18 h-18', avatarText: 'text-xl', crown: '👑' },
              { rankIdx: 2, pos: 3, color: '#CD7F32', barHeight: 60, avatarSize: 'w-13 h-13', avatarText: 'text-sm', crown: '🥉' },
            ].map(({ rankIdx, pos, color, barHeight, crown }) => {
              const r = rankingFiltrado[rankIdx];
              if (!r) return null;
              const isFirst = pos === 1;
              return (
                <div key={r.profissional_id} className="flex flex-col items-center" style={{ flex: isFirst ? '0 0 38%' : '0 0 29%' }}>
                  <span className="text-xl mb-1">{crown}</span>
                  <div
                    className={`${isFirst ? 'w-16 h-16' : 'w-13 h-13'} rounded-full flex items-center justify-center font-bold mb-2 transition-transform hover:scale-110`}
                    style={{
                      width: isFirst ? 64 : 52,
                      height: isFirst ? 64 : 52,
                      backgroundColor: r.nivel_cor + '25',
                      color: r.nivel_cor,
                      border: `3px solid ${color}`,
                      boxShadow: `0 0 16px ${color}50`,
                      fontSize: isFirst ? 18 : 14,
                    }}
                  >
                    {r.nome.split(' ').map((n: string) => n[0]).join('').substring(0, 2)}
                  </div>
                  <p className={`font-bold text-center ${isFirst ? 'text-sm' : 'text-xs'}`} style={{ color: 'var(--text-primary)' }}>
                    {r.nome.split(' ')[0]}
                  </p>
                  <p className="text-xs text-center leading-tight mt-0.5 px-1" style={{ color: 'var(--text-secondary)', maxWidth: 100 }}>
                    {r.unidade_nome}
                  </p>
                  <div className="flex items-center gap-1 mt-1.5">
                    <Star className={`fill-current ${isFirst ? 'w-4 h-4' : 'w-3.5 h-3.5'}`} style={{ color: '#FBBF24' }} />
                    <span className={`font-bold ${isFirst ? 'text-base' : 'text-sm'}`} style={{ color: '#FBBF24' }}>
                      {r.estrelas_total}
                    </span>
                  </div>
                  <div
                    className="w-full mt-3 rounded-t-xl flex items-end justify-center pb-3 relative"
                    style={{
                      height: barHeight,
                      background: `linear-gradient(to top, ${color}55, ${color}15)`,
                      border: `1px solid ${color}40`,
                      borderBottom: 'none',
                    }}
                  >
                    <span className={`font-black ${isFirst ? 'text-3xl' : 'text-2xl'}`} style={{ color, textShadow: `0 0 12px ${color}80` }}>
                      {pos}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="h-2 rounded-b-xl mt-0" style={{ background: 'linear-gradient(to right, #C0C0C020, #FFD70040, #C0C0C020)' }} />
        </div>
      )}

      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
        {rankingFiltrado.map((r, idx) => {
          const isMe = r.usuario_id === usuario?.id;
          return (
            <div
              key={r.profissional_id}
              className="flex items-center gap-4 px-5 py-3.5 transition-all"
              style={{
                borderBottom: '1px solid var(--border-primary)',
                backgroundColor: isMe ? 'var(--text-accent)' + '08' : undefined,
              }}
            >
              <span className={`w-8 text-center font-bold ${idx < 3 ? 'text-lg' : 'text-sm'}`} style={{ color: idx < 3 ? '#FBBF24' : 'var(--text-secondary)' }}>
                {idx + 1}
              </span>
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ backgroundColor: r.nivel_cor + '25', color: r.nivel_cor }}
              >
                {r.nome.split(' ').map(n => n[0]).join('').substring(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate" style={{ color: isMe ? 'var(--text-accent)' : 'var(--text-primary)' }}>
                  {r.nome} {isMe && '(voce)'}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: r.time_cor + '20', color: r.time_cor }}>
                    {r.time_nome}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{r.unidade_nome}</span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Star className="w-4 h-4 fill-current" style={{ color: '#FBBF24' }} />
                <span className="font-bold" style={{ color: '#FBBF24' }}>{r.estrelas_total}</span>
              </div>
              <span
                className="px-2.5 py-1 rounded-full text-xs font-bold hidden sm:block"
                style={{ backgroundColor: r.nivel_cor + '20', color: r.nivel_cor }}
              >
                {r.nivel_nome}
              </span>
            </div>
          );
        })}
        {rankingFiltrado.length === 0 && (
          <div className="text-center py-16">
            <Trophy className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: 'var(--text-secondary)' }} />
            <p style={{ color: 'var(--text-secondary)' }}>Nenhum profissional no ranking deste mês</p>
          </div>
        )}
      </div>
    </div>
  );
}

function OrcamentosRankingTab() {
  const { orcamentosRanking, mesReferencia, loadOrcamentosRanking } = useSkywalker();
  const { usuario } = useAuth();
  const [mes, setMes] = useState(mesReferencia.slice(0, 7));

  useEffect(() => {
    loadOrcamentosRanking(mes + '-01');
  }, [mes]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <FileCheck className="w-5 h-5" style={{ color: '#10B981' }} />
          Ranking de Fechamentos
        </h2>
        <input
          type="month"
          value={mes}
          onChange={(e) => setMes(e.target.value)}
          className="rounded-lg px-3 py-2 text-sm"
          style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
        />
      </div>

      <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
        Quem mais aprovou orcamentos neste mes. Cada aprovacao e registrada automaticamente.
      </p>

      <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
        {orcamentosRanking.map((r, idx) => {
          const isMe = r.usuario_id === usuario?.id;
          return (
            <div
              key={r.usuario_id}
              className="flex items-center gap-4 px-5 py-4 transition-all"
              style={{
                borderBottom: '1px solid var(--border-primary)',
                backgroundColor: isMe ? '#10B98110' : undefined,
              }}
            >
              <span className={`w-8 text-center font-bold ${idx < 3 ? 'text-lg' : 'text-sm'}`} style={{ color: idx < 3 ? '#10B981' : 'var(--text-secondary)' }}>
                {idx + 1}
              </span>
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0"
                style={{ backgroundColor: '#10B98120', color: '#10B981' }}
              >
                {r.nome.split(' ').map(n => n[0]).join('').substring(0, 2)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate" style={{ color: isMe ? '#10B981' : 'var(--text-primary)' }}>
                  {r.nome} {isMe && '(voce)'}
                </p>
              </div>
              <div className="text-right">
                <p className="font-bold" style={{ color: '#10B981' }}>{r.total} aprovado{r.total !== 1 ? 's' : ''}</p>
                <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                  R$ {r.valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          );
        })}
        {orcamentosRanking.length === 0 && (
          <div className="text-center py-16">
            <FileCheck className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: 'var(--text-secondary)' }} />
            <p style={{ color: 'var(--text-secondary)' }}>Nenhum orçamento aprovado neste mês</p>
          </div>
        )}
      </div>
    </div>
  );
}

function ProfissionaisTab() {
  const { profissionais, niveis, times, loadProfissionais } = useSkywalker();
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [unidades, setUnidades] = useState<any[]>([]);
  const [showNovo, setShowNovo] = useState(false);
  const [loading, setLoading] = useState(true);
  const [novoProfissional, setNovoProfissional] = useState({
    usuario_id: '',
    unidade_id: '',
    time: 'front_office',
    time_id: '',
    nivel_atual_id: ''
  });
  const [editProfissional, setEditProfissional] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; id: string; nome: string }>({ show: false, id: '', nome: '' });

  useEffect(() => {
    loadFormData();
  }, []);

  const loadFormData = async () => {
    const [userRes, unidRes] = await Promise.all([
      supabase.from('usuarios').select('id, nome, email').eq('ativo', true).order('nome'),
      supabase.from('unidades').select('id, nome'),
    ]);
    if (userRes.data) setUsuarios(userRes.data);
    if (unidRes.data) setUnidades(unidRes.data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!novoProfissional.usuario_id || !novoProfissional.unidade_id) return;
    const { error } = await supabase.from('skywalker_profissionais').insert({
      usuario_id: novoProfissional.usuario_id,
      unidade_id: novoProfissional.unidade_id,
      time: novoProfissional.time,
      time_id: novoProfissional.time_id || null,
      nivel_atual_id: novoProfissional.nivel_atual_id || (niveis[0]?.id || null),
      meses_consecutivos_validos: 0,
      ativo: true
    });
    if (!error) {
      setShowNovo(false);
      setNovoProfissional({ usuario_id: '', unidade_id: '', time: 'front_office', time_id: '', nivel_atual_id: '' });
      loadProfissionais();
    }
  };

  const handleEdit = (prof: any) => {
    setEditProfissional({
      id: prof.id,
      usuario_id: prof.usuario_id,
      unidade_id: prof.unidade_id,
      time: prof.time,
      time_id: prof.time_id,
      nivel_atual_id: prof.nivel_atual_id,
      meses_consecutivos_validos: prof.meses_consecutivos_validos,
      ativo: prof.ativo
    });
  };

  const handleSaveEdit = async () => {
    if (!editProfissional) return;
    const { error } = await supabase
      .from('skywalker_profissionais')
      .update({
        unidade_id: editProfissional.unidade_id,
        time: editProfissional.time,
        time_id: editProfissional.time_id || null,
        nivel_atual_id: editProfissional.nivel_atual_id,
        meses_consecutivos_validos: editProfissional.meses_consecutivos_validos,
        ativo: editProfissional.ativo
      })
      .eq('id', editProfissional.id);

    if (!error) {
      setEditProfissional(null);
      loadProfissionais();
    }
  };

  const handleDelete = async (id: string, nome: string) => {
    setDeleteConfirm({ show: true, id, nome });
  };

  const confirmDelete = async () => {
    await supabase.from('skywalker_profissionais').delete().eq('id', deleteConfirm.id);
    loadProfissionais();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--text-accent)', borderTopColor: 'transparent' }} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Users className="w-5 h-5" style={{ color: 'var(--text-accent)' }} />
          Profissionais ({profissionais.length})
        </h2>
        <button
          onClick={() => setShowNovo(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm"
          style={{ backgroundColor: 'var(--text-accent)', color: 'var(--text-on-accent)' }}
        >
          <UserPlus className="w-4 h-4" />
          Adicionar
        </button>
      </div>

      {showNovo && (
        <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-accent)' }}>
          <h4 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Adicionar ao Programa</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Usuario</label>
              <select
                value={novoProfissional.usuario_id}
                onChange={(e) => setNovoProfissional({ ...novoProfissional, usuario_id: e.target.value })}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
              >
                <option value="">Selecione...</option>
                {usuarios.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Unidade</label>
              <select
                value={novoProfissional.unidade_id}
                onChange={(e) => setNovoProfissional({ ...novoProfissional, unidade_id: e.target.value })}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
              >
                <option value="">Selecione...</option>
                {unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Time</label>
              <select
                value={novoProfissional.time_id}
                onChange={(e) => {
                  const t = times.find(t => t.id === e.target.value);
                  setNovoProfissional({ ...novoProfissional, time_id: e.target.value, time: t?.codigo || 'front_office' });
                }}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
              >
                <option value="">Selecione...</option>
                {times.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Nivel Inicial</label>
              <select
                value={novoProfissional.nivel_atual_id}
                onChange={(e) => setNovoProfissional({ ...novoProfissional, nivel_atual_id: e.target.value })}
                className="w-full rounded-lg px-3 py-2 text-sm"
                style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
              >
                <option value="">Primeiro nivel</option>
                {niveis.map(n => <option key={n.id} value={n.id}>{n.nome}</option>)}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <button onClick={() => setShowNovo(false)} className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                Cancelar
              </button>
              <button onClick={handleSave} className="px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: 'var(--text-accent)', color: 'var(--text-on-accent)' }}>
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {profissionais.map(prof => (
          <div
            key={prof.id}
            className="rounded-xl p-4 transition-all hover:scale-[1.01]"
            style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold"
                  style={{ backgroundColor: (prof.nivel?.cor || '#6B7280') + '25', color: prof.nivel?.cor || '#6B7280' }}
                >
                  {prof.usuario?.nome?.split(' ').map((n: string) => n[0]).join('').substring(0, 2) || '??'}
                </div>
                <div>
                  <h4 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{prof.usuario?.nome || 'Sem nome'}</h4>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{prof.unidade?.nome}</p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => handleEdit(prof)} className="p-1.5 rounded opacity-50 hover:opacity-100 transition-opacity" style={{ color: 'var(--text-accent)' }}>
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(prof.id, prof.usuario?.nome || 'Profissional')} className="p-1.5 rounded opacity-50 hover:opacity-100 transition-opacity" style={{ color: 'var(--text-secondary)' }}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span
                className="px-2 py-0.5 rounded text-xs font-medium"
                style={{ backgroundColor: (prof.skywalker_time?.cor || '#6B7280') + '20', color: prof.skywalker_time?.cor || '#6B7280' }}
              >
                {prof.skywalker_time?.nome || prof.time}
              </span>
              <span
                className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                style={{ backgroundColor: (prof.nivel?.cor || '#6B7280') + '20', color: prof.nivel?.cor || '#6B7280' }}
              >
                {prof.nivel?.nome || 'Starter'}
              </span>
            </div>
            <div className="mt-2 pt-2 text-xs" style={{ borderTop: '1px solid var(--border-primary)', color: 'var(--text-secondary)' }}>
              {prof.meses_consecutivos_validos} mes(es) consecutivos
            </div>
          </div>
        ))}
      </div>

      {profissionais.length === 0 && (
        <div className="text-center py-16">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: 'var(--text-secondary)' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Nenhum profissional cadastrado</p>
        </div>
      )}

      {editProfissional && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-2xl rounded-xl p-6" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
            <h3 className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
              Editar Profissional
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Usuario</label>
                <p className="text-sm px-3 py-2 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                  {usuarios.find(u => u.id === editProfissional.usuario_id)?.nome || 'Usuario nao encontrado'}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Unidade</label>
                <select
                  value={editProfissional.unidade_id}
                  onChange={(e) => setEditProfissional({ ...editProfissional, unidade_id: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                >
                  <option value="">Selecione...</option>
                  {unidades.map(u => <option key={u.id} value={u.id}>{u.nome}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Time</label>
                <select
                  value={editProfissional.time_id}
                  onChange={(e) => {
                    const t = times.find(t => t.id === e.target.value);
                    setEditProfissional({ ...editProfissional, time_id: e.target.value, time: t?.codigo || 'front_office' });
                  }}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                >
                  <option value="">Selecione...</option>
                  {times.map(t => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Nivel Atual</label>
                <select
                  value={editProfissional.nivel_atual_id}
                  onChange={(e) => setEditProfissional({ ...editProfissional, nivel_atual_id: e.target.value })}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                >
                  {niveis.map(n => <option key={n.id} value={n.id}>{n.nome}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>Meses Consecutivos Válidos</label>
                <input
                  type="number"
                  min="0"
                  value={editProfissional.meses_consecutivos_validos}
                  onChange={(e) => setEditProfissional({ ...editProfissional, meses_consecutivos_validos: parseInt(e.target.value) || 0 })}
                  className="w-full rounded-lg px-3 py-2 text-sm"
                  style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="edit-ativo"
                  checked={editProfissional.ativo}
                  onChange={(e) => setEditProfissional({ ...editProfissional, ativo: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="edit-ativo" className="text-sm" style={{ color: 'var(--text-primary)' }}>
                  Profissional ativo no programa
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setEditProfissional(null)}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: 'var(--text-accent)', color: 'var(--text-on-accent)' }}
              >
                Salvar Alteracoes
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDeleteModal
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ show: false, id: '', nome: '' })}
        onConfirm={confirmDelete}
        title="Remover Profissional"
        message={`Tem certeza que deseja remover "${deleteConfirm.nome}" do programa Skywalker? Todo o histórico de desempenho será mantido, mas o profissional não participará mais das avaliações. Esta ação não pode ser desfeita.`}
        confirmText="Remover"
      />
    </div>
  );
}
