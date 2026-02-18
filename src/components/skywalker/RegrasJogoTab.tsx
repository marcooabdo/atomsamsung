import { useState } from 'react';
import { BookOpen, Plus, Pencil, Trash2, Star, ChevronDown, ChevronUp, Save, X, AlertTriangle, Gift } from 'lucide-react';
import { useSkywalker } from '../../contexts/SkywalkerContext';
import { supabase } from '../../lib/supabase';
import { ConfirmDeleteModal } from './ConfirmDeleteModal';

export function RegrasJogoTab() {
  const { pilares, regrasEstrelas, regrasPromocao, bonificacoes, times, niveis, loadPilares, loadRegrasEstrelas, loadRegrasPromocao, loadBonificacoes } = useSkywalker();

  const [expandedPilar, setExpandedPilar] = useState<string | null>(null);
  const [showNovoPilar, setShowNovoPilar] = useState(false);
  const [showEditPilarModal, setShowEditPilarModal] = useState(false);
  const [editingPilarId, setEditingPilarId] = useState<string | null>(null);
  const [showNovaRegra, setShowNovaRegra] = useState<string | null>(null);
  const [editingRegraId, setEditingRegraId] = useState<string | null>(null);
  const [showNovaRegraPromocao, setShowNovaRegraPromocao] = useState(false);
  const [tipoRegraPromocao, setTipoRegraPromocao] = useState<'promocao' | 'rebaixamento'>('promocao');
  const [editingRegraPromocaoId, setEditingRegraPromocaoId] = useState<string | null>(null);
  const [showNovaBonificacao, setShowNovaBonificacao] = useState(false);

  const [deleteConfirm, setDeleteConfirm] = useState<{ show: boolean; type: string; id: string; title: string; message: string }>({
    show: false,
    type: '',
    id: '',
    title: '',
    message: ''
  });

  const defaultPilar = { nome: '', descricao: '', tipo_metrica: 'quantidade', time_aplicavel: [] as string[], max_estrelas: 3, meta_front_office: 10, meta_inside_sales: 10 };
  const [pilarForm, setPilarForm] = useState(defaultPilar);

  const defaultRegra = { pilar_id: '', time: '', nivel_id: '', valor_minimo: 0, valor_maximo: null as number | null, estrelas: 1 };
  const [regraForm, setRegraForm] = useState(defaultRegra);

  const defaultRegraPromocao = { tipo: 'promocao' as const, nome: '', descricao: '', condicao: '', obrigatorio: false };
  const [regraPromocaoForm, setRegraPromocaoForm] = useState(defaultRegraPromocao);

  const defaultBonificacao = { nome: '', descricao: '', tipo: 'valor_fixo' as const, valor: 0, condicao: 'meta_atingida', condicao_valor: null as number | null, time_aplicavel: [] as string[] };
  const [bonificacaoForm, setBonificacaoForm] = useState(defaultBonificacao);

  const getTimeName = (timeCode: string) => {
    const t = times.find(tm => tm.codigo === timeCode);
    return t ? t.nome : timeCode;
  };

  const getTimeColor = (timeCode: string) => {
    const t = times.find(tm => tm.codigo === timeCode);
    return t?.cor || '#6B7280';
  };

  const getMetricaLabel = (tipo: string, valor: number) => {
    if (tipo === 'percentual') return `${valor}%`;
    if (tipo === 'valor') return `R$ ${valor}`;
    return valor.toString();
  };

  const getNivelName = (nivelId: string) => {
    const n = niveis.find(nv => nv.id === nivelId);
    return n ? n.nome : nivelId;
  };

  const getNivelColor = (nivelId: string) => {
    const n = niveis.find(nv => nv.id === nivelId);
    return n?.cor || 'var(--text-accent)';
  };

  const handleSavePilar = async () => {
    if (!pilarForm.nome.trim()) return;
    const maxOrdem = pilares.reduce((m, p) => Math.max(m, p.ordem), 0);
    if (editingPilarId) {
      await supabase.from('skywalker_pilares').update({ nome: pilarForm.nome, descricao: pilarForm.descricao, tipo_metrica: pilarForm.tipo_metrica, time_aplicavel: pilarForm.time_aplicavel, max_estrelas: pilarForm.max_estrelas, meta_front_office: pilarForm.meta_front_office, meta_inside_sales: pilarForm.meta_inside_sales }).eq('id', editingPilarId);
    } else {
      await supabase.from('skywalker_pilares').insert({ ...pilarForm, ordem: maxOrdem + 1, ativo: true });
    }
    setShowNovoPilar(false);
    setShowEditPilarModal(false);
    setEditingPilarId(null);
    setPilarForm(defaultPilar);
    loadPilares();
  };

  const handleDeletePilar = async (id: string) => {
    setDeleteConfirm({
      show: true,
      type: 'pilar',
      id,
      title: 'Excluir Pilar',
      message: 'Tem certeza que deseja excluir este pilar? Todas as regras de estrelas associadas tambem serao excluidas. Esta acao nao pode ser desfeita.'
    });
  };

  const confirmDelete = async () => {
    const { type, id } = deleteConfirm;

    if (type === 'pilar') {
      await supabase.from('skywalker_regras_estrelas').delete().eq('pilar_id', id);
      await supabase.from('skywalker_pilares').delete().eq('id', id);
      loadPilares();
      loadRegrasEstrelas();
    } else if (type === 'regra') {
      await supabase.from('skywalker_regras_estrelas').delete().eq('id', id);
      loadRegrasEstrelas();
    } else if (type === 'regraPromocao') {
      await supabase.from('skywalker_regras_promocao').delete().eq('id', id);
      loadRegrasPromocao();
    } else if (type === 'bonificacao') {
      await supabase.from('skywalker_bonificacoes').delete().eq('id', id);
      loadBonificacoes();
    }
  };

  const handleSaveRegra = async () => {
    if (!regraForm.pilar_id || !regraForm.nivel_id) return;
    if (editingRegraId) {
      await supabase.from('skywalker_regras_estrelas').update({ time: regraForm.time, nivel_id: regraForm.nivel_id, valor_minimo: regraForm.valor_minimo, valor_maximo: regraForm.valor_maximo, estrelas: regraForm.estrelas }).eq('id', editingRegraId);
    } else {
      await supabase.from('skywalker_regras_estrelas').insert({ ...regraForm, ativo: true });
    }
    setShowNovaRegra(null);
    setEditingRegraId(null);
    setRegraForm(defaultRegra);
    loadRegrasEstrelas();
  };

  const handleDeleteRegra = async (id: string) => {
    setDeleteConfirm({
      show: true,
      type: 'regra',
      id,
      title: 'Excluir Regra',
      message: 'Tem certeza que deseja excluir esta regra de estrelas? Esta acao nao pode ser desfeita.'
    });
  };

  const handleSaveRegraPromocao = async () => {
    if (!regraPromocaoForm.nome.trim() || !regraPromocaoForm.condicao.trim()) return;
    const ordem = regrasPromocao.filter(r => r.tipo === regraPromocaoForm.tipo).length + 1;
    if (editingRegraPromocaoId) {
      await supabase.from('skywalker_regras_promocao').update({ nome: regraPromocaoForm.nome, descricao: regraPromocaoForm.descricao, condicao: regraPromocaoForm.condicao, obrigatorio: regraPromocaoForm.obrigatorio }).eq('id', editingRegraPromocaoId);
    } else {
      await supabase.from('skywalker_regras_promocao').insert({ ...regraPromocaoForm, ordem, ativo: true });
    }
    setShowNovaRegraPromocao(false);
    setEditingRegraPromocaoId(null);
    setRegraPromocaoForm(defaultRegraPromocao);
    loadRegrasPromocao();
  };

  const handleToggleRegraPromocao = async (id: string, ativo: boolean) => {
    await supabase.from('skywalker_regras_promocao').update({ ativo }).eq('id', id);
    loadRegrasPromocao();
  };

  const handleDeleteRegraPromocao = async (id: string) => {
    setDeleteConfirm({
      show: true,
      type: 'regraPromocao',
      id,
      title: 'Excluir Regra de Promocao/Rebaixamento',
      message: 'Tem certeza que deseja excluir esta regra? Esta acao nao pode ser desfeita.'
    });
  };

  const handleSaveBonificacao = async () => {
    if (!bonificacaoForm.nome.trim()) return;
    await supabase.from('skywalker_bonificacoes').insert({ ...bonificacaoForm, ativo: true });
    setShowNovaBonificacao(false);
    setBonificacaoForm(defaultBonificacao);
    loadBonificacoes();
  };

  const handleDeleteBonificacao = async (id: string) => {
    setDeleteConfirm({
      show: true,
      type: 'bonificacao',
      id,
      title: 'Excluir Bonificacao',
      message: 'Tem certeza que deseja excluir esta bonificacao? Esta acao nao pode ser desfeita.'
    });
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <BookOpen className="w-5 h-5" style={{ color: 'var(--text-accent)' }} />
          Regras do Jogo
        </h2>
        <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Configure pilares, metas e estrelas</span>
      </div>

      <PilaresSection
        pilares={pilares}
        regrasEstrelas={regrasEstrelas}
        times={times}
        niveis={niveis}
        expandedPilar={expandedPilar}
        setExpandedPilar={setExpandedPilar}
        showNovoPilar={showNovoPilar}
        setShowNovoPilar={setShowNovoPilar}
        showEditPilarModal={showEditPilarModal}
        setShowEditPilarModal={setShowEditPilarModal}
        editingPilarId={editingPilarId}
        setEditingPilarId={setEditingPilarId}
        pilarForm={pilarForm}
        setPilarForm={setPilarForm}
        defaultPilar={defaultPilar}
        handleSavePilar={handleSavePilar}
        handleDeletePilar={handleDeletePilar}
        showNovaRegra={showNovaRegra}
        setShowNovaRegra={setShowNovaRegra}
        editingRegraId={editingRegraId}
        setEditingRegraId={setEditingRegraId}
        regraForm={regraForm}
        setRegraForm={setRegraForm}
        defaultRegra={defaultRegra}
        handleSaveRegra={handleSaveRegra}
        handleDeleteRegra={handleDeleteRegra}
        getTimeName={getTimeName}
        getTimeColor={getTimeColor}
        getMetricaLabel={getMetricaLabel}
        getNivelName={getNivelName}
        getNivelColor={getNivelColor}
      />

      <PromocaoRebaixamentoSection
        regrasPromocao={regrasPromocao}
        showNovaRegraPromocao={showNovaRegraPromocao}
        setShowNovaRegraPromocao={setShowNovaRegraPromocao}
        tipoRegraPromocao={tipoRegraPromocao}
        setTipoRegraPromocao={setTipoRegraPromocao}
        editingRegraPromocaoId={editingRegraPromocaoId}
        setEditingRegraPromocaoId={setEditingRegraPromocaoId}
        regraPromocaoForm={regraPromocaoForm}
        setRegraPromocaoForm={setRegraPromocaoForm}
        defaultRegraPromocao={defaultRegraPromocao}
        handleSaveRegraPromocao={handleSaveRegraPromocao}
        handleToggleRegraPromocao={handleToggleRegraPromocao}
        handleDeleteRegraPromocao={handleDeleteRegraPromocao}
      />

      <BonificacoesSection
        bonificacoes={bonificacoes}
        showNovaBonificacao={showNovaBonificacao}
        setShowNovaBonificacao={setShowNovaBonificacao}
        bonificacaoForm={bonificacaoForm}
        setBonificacaoForm={setBonificacaoForm}
        defaultBonificacao={defaultBonificacao}
        handleSaveBonificacao={handleSaveBonificacao}
        handleDeleteBonificacao={handleDeleteBonificacao}
      />

      <ConfirmDeleteModal
        isOpen={deleteConfirm.show}
        onClose={() => setDeleteConfirm({ ...deleteConfirm, show: false })}
        onConfirm={confirmDelete}
        title={deleteConfirm.title}
        message={deleteConfirm.message}
      />
    </div>
  );
}

function PilaresSection({ pilares, regrasEstrelas, times, niveis, expandedPilar, setExpandedPilar, showNovoPilar, setShowNovoPilar, showEditPilarModal, setShowEditPilarModal, editingPilarId, setEditingPilarId, pilarForm, setPilarForm, defaultPilar, handleSavePilar, handleDeletePilar, showNovaRegra, setShowNovaRegra, editingRegraId, setEditingRegraId, regraForm, setRegraForm, defaultRegra, handleSaveRegra, handleDeleteRegra, getTimeName, getTimeColor, getMetricaLabel, getNivelName, getNivelColor }: any) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold" style={{ color: 'var(--text-accent)' }}>Pilares de Avaliacao</h3>
        <button
          onClick={() => { setShowNovoPilar(true); setEditingPilarId(null); setPilarForm(defaultPilar); }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm"
          style={{ backgroundColor: 'var(--text-accent)', color: 'var(--text-on-accent)' }}
        >
          <Plus className="w-4 h-4" />
          Novo Pilar
        </button>
      </div>

      {showNovoPilar && !editingPilarId && (
        <PilarForm
          form={pilarForm}
          setForm={setPilarForm}
          onSave={handleSavePilar}
          onCancel={() => { setShowNovoPilar(false); setEditingPilarId(null); }}
          isEditing={false}
          times={times}
        />
      )}

      <div className="space-y-3">
        {pilares.map((pilar: any) => {
          const regras = regrasEstrelas.filter((r: any) => r.pilar_id === pilar.id);
          const isExpanded = expandedPilar === pilar.id;

          return (
            <div key={pilar.id} className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
              <div
                className="p-4 flex items-center justify-between cursor-pointer transition-colors"
                onClick={() => setExpandedPilar(isExpanded ? null : pilar.id)}
                style={{ backgroundColor: isExpanded ? 'var(--bg-secondary)' : 'transparent' }}
              >
                <div className="flex items-center gap-4">
                  <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--text-accent)', opacity: 0.15 }}>
                    <Star className="w-5 h-5" style={{ color: 'var(--text-accent)' }} />
                  </div>
                  <div>
                    <h4 className="font-bold" style={{ color: 'var(--text-primary)' }}>{pilar.nome}</h4>
                    {pilar.descricao && <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{pilar.descricao}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex gap-1.5">
                    {(pilar.time_aplicavel || []).map((tc: string) => (
                      <span key={tc} className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: getTimeColor(tc) + '20', color: getTimeColor(tc) }}>
                        {getTimeName(tc)}
                      </span>
                    ))}
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>
                    {regras.length} regra{regras.length !== 1 ? 's' : ''}
                  </span>
                  <button onClick={(e) => { e.stopPropagation(); setEditingPilarId(pilar.id); setPilarForm({ nome: pilar.nome, descricao: pilar.descricao || '', tipo_metrica: pilar.tipo_metrica, time_aplicavel: pilar.time_aplicavel || [], max_estrelas: pilar.max_estrelas, meta_front_office: pilar.meta_front_office, meta_inside_sales: pilar.meta_inside_sales }); setShowEditPilarModal(true); }} className="p-1.5 rounded transition-colors" style={{ color: 'var(--text-secondary)' }}>
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDeletePilar(pilar.id); }} className="p-1.5 rounded transition-colors" style={{ color: 'var(--text-secondary)' }}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                  {isExpanded ? <ChevronUp className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} /> : <ChevronDown className="w-5 h-5" style={{ color: 'var(--text-secondary)' }} />}
                </div>
              </div>

              {isExpanded && (
                <div className="p-4 space-y-3" style={{ borderTop: '1px solid var(--border-primary)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Regras de Estrelas</span>
                    <button
                      onClick={() => { setRegraForm({ ...defaultRegra, pilar_id: pilar.id, time: times[0]?.codigo || '', nivel_id: niveis[0]?.id || '' }); setShowNovaRegra(pilar.id); setEditingRegraId(null); }}
                      className="flex items-center gap-1 px-3 py-1.5 rounded text-sm"
                      style={{ backgroundColor: 'var(--text-accent)', color: 'var(--text-on-accent)', opacity: 0.85 }}
                    >
                      <Plus className="w-3 h-3" />
                      Nova Regra
                    </button>
                  </div>

                  {showNovaRegra === pilar.id && !editingRegraId && (
                    <RegraInlineForm
                      form={regraForm}
                      setForm={setRegraForm}
                      onSave={handleSaveRegra}
                      onCancel={() => setShowNovaRegra(null)}
                      pilar={pilar}
                      times={times}
                      niveis={niveis}
                    />
                  )}

                  {regras.length === 0 ? (
                    <p className="text-sm text-center py-4" style={{ color: 'var(--text-secondary)', opacity: 0.5 }}>Nenhuma regra configurada</p>
                  ) : (
                    regras.map((regra: any) => (
                      <div key={regra.id}>
                        {editingRegraId === regra.id ? (
                          <RegraInlineForm
                            form={regraForm}
                            setForm={setRegraForm}
                            onSave={handleSaveRegra}
                            onCancel={() => setEditingRegraId(null)}
                            pilar={pilar}
                            times={times}
                            niveis={niveis}
                          />
                        ) : (
                          <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                            <div className="flex items-center gap-4">
                              <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: getTimeColor(regra.time) + '20', color: getTimeColor(regra.time) }}>
                                {getTimeName(regra.time)}
                              </span>
                              <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ backgroundColor: getNivelColor(regra.nivel_id) + '20', color: getNivelColor(regra.nivel_id) }}>
                                {getNivelName(regra.nivel_id)}
                              </span>
                              <span className="text-sm" style={{ color: 'var(--text-primary)' }}>
                                {getMetricaLabel(pilar.tipo_metrica, regra.valor_minimo)}
                                {regra.valor_maximo ? ` - ${getMetricaLabel(pilar.tipo_metrica, regra.valor_maximo)}` : '+'}
                              </span>
                            </div>
                            <div className="flex items-center gap-3">
                              <div className="flex items-center gap-0.5">
                                {Array.from({ length: regra.estrelas }).map((_: any, i: number) => (
                                  <Star key={i} className="w-4 h-4 fill-current" style={{ color: '#FBBF24' }} />
                                ))}
                                {regra.estrelas === 0 && <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>0</span>}
                              </div>
                              <button onClick={() => { setEditingRegraId(regra.id); setRegraForm({ pilar_id: regra.pilar_id, time: regra.time, nivel_id: regra.nivel_id, valor_minimo: regra.valor_minimo, valor_maximo: regra.valor_maximo, estrelas: regra.estrelas }); }} className="p-1" style={{ color: 'var(--text-secondary)' }}>
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button onClick={() => handleDeleteRegra(regra.id)} className="p-1" style={{ color: 'var(--text-secondary)' }}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {showEditPilarModal && editingPilarId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-3xl rounded-xl p-6" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-accent)' }}>
            <h4 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Pencil className="w-5 h-5" style={{ color: 'var(--text-accent)' }} />
              Editar Pilar
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Nome</label>
                <input type="text" value={pilarForm.nome} onChange={(e) => setPilarForm({ ...pilarForm, nome: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} placeholder="Ex: Taxa de Conversao" />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Tipo de Metrica</label>
                <select value={pilarForm.tipo_metrica} onChange={(e) => setPilarForm({ ...pilarForm, tipo_metrica: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}>
                  <option value="quantidade">Quantidade</option>
                  <option value="percentual">Percentual</option>
                  <option value="valor">Valor (R$)</option>
                  <option value="binario">Sim/Não</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Descricao</label>
                <textarea value={pilarForm.descricao} onChange={(e) => setPilarForm({ ...pilarForm, descricao: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} rows={2} placeholder="Descreva o que este pilar avalia..." />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Max Estrelas</label>
                <input type="number" value={pilarForm.max_estrelas} onChange={(e) => setPilarForm({ ...pilarForm, max_estrelas: Number(e.target.value) })} min={1} max={5} className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Aplicavel a</label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {times.map((t: any) => {
                    const checked = (pilarForm.time_aplicavel || []).includes(t.codigo);
                    return (
                      <label key={t.id} className="flex items-center gap-1.5 cursor-pointer text-sm" style={{ color: 'var(--text-primary)' }}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const arr = e.target.checked
                              ? [...(pilarForm.time_aplicavel || []), t.codigo]
                              : (pilarForm.time_aplicavel || []).filter((c: string) => c !== t.codigo);
                            setPilarForm({ ...pilarForm, time_aplicavel: arr });
                          }}
                          className="w-4 h-4 rounded"
                          style={{ accentColor: t.cor }}
                        />
                        <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: t.cor + '20', color: t.cor }}>{t.nome}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Meta Front Office</label>
                <input type="number" value={pilarForm.meta_front_office} onChange={(e) => setPilarForm({ ...pilarForm, meta_front_office: Number(e.target.value) })} className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Meta Inside Sales</label>
                <input type="number" value={pilarForm.meta_inside_sales} onChange={(e) => setPilarForm({ ...pilarForm, meta_inside_sales: Number(e.target.value) })} className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => { setShowEditPilarModal(false); setEditingPilarId(null); }} className="px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>Cancelar</button>
              <button onClick={handleSavePilar} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: 'var(--text-accent)', color: 'var(--text-on-accent)' }}>
                <Save className="w-4 h-4" />
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PilarForm({ form, setForm, onSave, onCancel, isEditing, times }: any) {
  return (
    <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-accent)' }}>
      <h4 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>{isEditing ? 'Editar Pilar' : 'Criar Novo Pilar'}</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Nome</label>
          <input type="text" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} placeholder="Ex: Taxa de Conversao" />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Tipo de Metrica</label>
          <select value={form.tipo_metrica} onChange={(e) => setForm({ ...form, tipo_metrica: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}>
            <option value="quantidade">Quantidade</option>
            <option value="percentual">Percentual</option>
            <option value="valor">Valor (R$)</option>
            <option value="binario">Sim/Não</option>
          </select>
        </div>
        <div className="md:col-span-2">
          <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Descricao</label>
          <textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} rows={2} placeholder="Descreva o que este pilar avalia..." />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Max Estrelas</label>
          <input type="number" value={form.max_estrelas} onChange={(e) => setForm({ ...form, max_estrelas: Number(e.target.value) })} min={1} max={5} className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Aplicavel a</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {times.map((t: any) => {
              const checked = (form.time_aplicavel || []).includes(t.codigo);
              return (
                <label key={t.id} className="flex items-center gap-1.5 cursor-pointer text-sm" style={{ color: 'var(--text-primary)' }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const arr = e.target.checked
                        ? [...(form.time_aplicavel || []), t.codigo]
                        : (form.time_aplicavel || []).filter((c: string) => c !== t.codigo);
                      setForm({ ...form, time_aplicavel: arr });
                    }}
                    className="w-4 h-4 rounded"
                    style={{ accentColor: t.cor }}
                  />
                  <span className="px-1.5 py-0.5 rounded text-xs" style={{ backgroundColor: t.cor + '20', color: t.cor }}>{t.nome}</span>
                </label>
              );
            })}
          </div>
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Meta Front Office</label>
          <input type="number" value={form.meta_front_office} onChange={(e) => setForm({ ...form, meta_front_office: Number(e.target.value) })} className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Meta Inside Sales</label>
          <input type="number" value={form.meta_inside_sales} onChange={(e) => setForm({ ...form, meta_inside_sales: Number(e.target.value) })} className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} />
        </div>
      </div>
      <div className="flex justify-end gap-2 mt-4">
        <button onClick={onCancel} className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>Cancelar</button>
        <button onClick={onSave} className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: 'var(--text-accent)', color: 'var(--text-on-accent)' }}>
          <Save className="w-4 h-4" />
          Salvar
        </button>
      </div>
    </div>
  );
}

function RegraInlineForm({ form, setForm, onSave, onCancel, pilar, times, niveis }: any) {
  return (
    <div className="rounded-lg p-3" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-accent)' }}>
      <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
        <select value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="rounded px-2 py-1.5 text-sm" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}>
          {times.map((t: any) => (
            <option key={t.id} value={t.codigo}>{t.nome}</option>
          ))}
        </select>
        <select value={form.nivel_id} onChange={(e) => setForm({ ...form, nivel_id: e.target.value })} className="rounded px-2 py-1.5 text-sm" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}>
          {niveis.map((n: any) => (
            <option key={n.id} value={n.id}>{n.nome}</option>
          ))}
        </select>
        <input type="number" value={form.valor_minimo} onChange={(e) => setForm({ ...form, valor_minimo: Number(e.target.value) })} className="rounded px-2 py-1.5 text-sm" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} placeholder="Min" />
        <input type="number" value={form.valor_maximo ?? ''} onChange={(e) => setForm({ ...form, valor_maximo: e.target.value ? Number(e.target.value) : null })} className="rounded px-2 py-1.5 text-sm" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} placeholder="Max (vazio = +)" />
        <input type="number" value={form.estrelas} onChange={(e) => setForm({ ...form, estrelas: Number(e.target.value) })} min={0} max={pilar.max_estrelas} className="rounded px-2 py-1.5 text-sm" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} placeholder="Estrelas" />
        <div className="flex gap-1">
          <button onClick={onCancel} className="flex-1 flex items-center justify-center py-1.5 rounded" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)' }}>
            <X className="w-4 h-4" />
          </button>
          <button onClick={onSave} className="flex-1 flex items-center justify-center py-1.5 rounded" style={{ backgroundColor: 'var(--text-accent)', color: 'var(--text-on-accent)' }}>
            <Save className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

function PromocaoRebaixamentoSection({ regrasPromocao, showNovaRegraPromocao, setShowNovaRegraPromocao, tipoRegraPromocao, setTipoRegraPromocao, editingRegraPromocaoId, setEditingRegraPromocaoId, regraPromocaoForm, setRegraPromocaoForm, defaultRegraPromocao, handleSaveRegraPromocao, handleToggleRegraPromocao, handleDeleteRegraPromocao }: any) {
  const promocao = regrasPromocao.filter((r: any) => r.tipo === 'promocao');
  const rebaixamento = regrasPromocao.filter((r: any) => r.tipo === 'rebaixamento');

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <RegraPromocaoCard
          title="Regras de Promocao"
          icon={<ChevronUp className="w-5 h-5" />}
          regras={promocao}
          tipo="promocao"
          accentColor="#10B981"
          editingRegraPromocaoId={editingRegraPromocaoId}
          setEditingRegraPromocaoId={setEditingRegraPromocaoId}
          regraPromocaoForm={regraPromocaoForm}
          setRegraPromocaoForm={setRegraPromocaoForm}
          handleSaveRegraPromocao={handleSaveRegraPromocao}
          handleToggleRegraPromocao={handleToggleRegraPromocao}
          handleDeleteRegraPromocao={handleDeleteRegraPromocao}
          onAddNew={() => {
            setTipoRegraPromocao('promocao');
            setRegraPromocaoForm({ ...defaultRegraPromocao, tipo: 'promocao' });
            setShowNovaRegraPromocao(true);
          }}
        />
        <RegraPromocaoCard
          title="Regras de Rebaixamento"
          icon={<ChevronDown className="w-5 h-5" />}
          regras={rebaixamento}
          tipo="rebaixamento"
          accentColor="#EF4444"
          editingRegraPromocaoId={editingRegraPromocaoId}
          setEditingRegraPromocaoId={setEditingRegraPromocaoId}
          regraPromocaoForm={regraPromocaoForm}
          setRegraPromocaoForm={setRegraPromocaoForm}
          handleSaveRegraPromocao={handleSaveRegraPromocao}
          handleToggleRegraPromocao={handleToggleRegraPromocao}
          handleDeleteRegraPromocao={handleDeleteRegraPromocao}
          onAddNew={() => {
            setTipoRegraPromocao('rebaixamento');
            setRegraPromocaoForm({ ...defaultRegraPromocao, tipo: 'rebaixamento' });
            setShowNovaRegraPromocao(true);
          }}
        />
      </div>

      {showNovaRegraPromocao && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}>
          <div className="w-full max-w-2xl rounded-xl p-6" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-accent)' }}>
            <h4 className="text-lg font-bold mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
              <Plus className="w-5 h-5" />
              Nova Regra de {tipoRegraPromocao === 'promocao' ? 'Promocao' : 'Rebaixamento'}
            </h4>
            <div className="space-y-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Nome *</label>
                <input type="text" value={regraPromocaoForm.nome} onChange={(e) => setRegraPromocaoForm({ ...regraPromocaoForm, nome: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} placeholder="Ex: Atingir meta mensal" />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Descricao</label>
                <textarea value={regraPromocaoForm.descricao} onChange={(e) => setRegraPromocaoForm({ ...regraPromocaoForm, descricao: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} rows={3} placeholder="Descreva a condicao..." />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Código da Condição *</label>
                <input type="text" value={regraPromocaoForm.condicao} onChange={(e) => setRegraPromocaoForm({ ...regraPromocaoForm, condicao: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm font-mono" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} placeholder="Ex: meta_atingida, estrelas_minimas" />
                <p className="text-xs mt-1" style={{ color: 'var(--text-secondary)', opacity: 0.6 }}>Código usado no sistema para verificar a condição</p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={regraPromocaoForm.obrigatorio} onChange={(e) => setRegraPromocaoForm({ ...regraPromocaoForm, obrigatorio: e.target.checked })} className="w-4 h-4" style={{ accentColor: tipoRegraPromocao === 'promocao' ? '#10B981' : '#EF4444' }} />
                <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Regra obrigatoria</span>
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setShowNovaRegraPromocao(false)} className="px-4 py-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>Cancelar</button>
              <button onClick={handleSaveRegraPromocao} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: tipoRegraPromocao === 'promocao' ? '#10B981' : '#EF4444' }}>
                <Save className="w-4 h-4" />
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function RegraPromocaoCard({ title, icon, regras, tipo, accentColor, editingRegraPromocaoId, setEditingRegraPromocaoId, regraPromocaoForm, setRegraPromocaoForm, handleSaveRegraPromocao, handleToggleRegraPromocao, handleDeleteRegraPromocao, onAddNew }: any) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${accentColor}30` }}>
      <div className="p-4 flex items-center justify-between" style={{ backgroundColor: accentColor + '10' }}>
        <h3 className="text-base font-bold flex items-center gap-2" style={{ color: accentColor }}>
          {icon}
          {title}
        </h3>
        <button onClick={onAddNew} className="flex items-center gap-1 px-3 py-1.5 rounded text-sm font-medium" style={{ backgroundColor: accentColor + '20', color: accentColor }}>
          <Plus className="w-4 h-4" />
          Nova
        </button>
      </div>
      <div className="p-4 space-y-2">
        {regras.map((regra: any) => (
          <div key={regra.id}>
            {editingRegraPromocaoId === regra.id ? (
              <div className="rounded-lg p-3 space-y-2" style={{ backgroundColor: 'var(--bg-secondary)', border: `1px solid ${accentColor}50` }}>
                <input type="text" value={regraPromocaoForm.nome} onChange={(e) => setRegraPromocaoForm({ ...regraPromocaoForm, nome: e.target.value })} className="w-full rounded px-3 py-2 text-sm" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} placeholder="Nome" />
                <textarea value={regraPromocaoForm.descricao || ''} onChange={(e) => setRegraPromocaoForm({ ...regraPromocaoForm, descricao: e.target.value })} className="w-full rounded px-3 py-2 text-sm" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} rows={2} placeholder="Descrição" />
                <input type="text" value={regraPromocaoForm.condicao} onChange={(e) => setRegraPromocaoForm({ ...regraPromocaoForm, condicao: e.target.value })} className="w-full rounded px-3 py-2 text-sm font-mono" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} placeholder="Condicao" />
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={regraPromocaoForm.obrigatorio} onChange={(e) => setRegraPromocaoForm({ ...regraPromocaoForm, obrigatorio: e.target.checked })} className="w-4 h-4" style={{ accentColor }} />
                    <span className="text-sm" style={{ color: 'var(--text-primary)' }}>Obrigatório</span>
                  </label>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setEditingRegraPromocaoId(null)} className="flex-1 px-3 py-1.5 rounded text-sm" style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)' }}>Cancelar</button>
                  <button onClick={handleSaveRegraPromocao} className="flex-1 px-3 py-1.5 rounded text-sm text-white" style={{ backgroundColor: accentColor }}>Salvar</button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                <input type="checkbox" checked={regra.ativo} onChange={(e) => handleToggleRegraPromocao(regra.id, e.target.checked)} className="w-4 h-4" style={{ accentColor }} />
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium" style={{ color: regra.ativo ? 'var(--text-primary)' : 'var(--text-secondary)', opacity: regra.ativo ? 1 : 0.5 }}>
                    {regra.nome}
                  </span>
                  {regra.descricao && <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>{regra.descricao}</p>}
                  {regra.obrigatorio && (
                    <span className="inline-block mt-1 text-xs px-2 py-0.5 rounded" style={{ backgroundColor: '#F59E0B20', color: '#F59E0B' }}>Obrigatório</span>
                  )}
                </div>
                <div className="flex gap-1">
                  <button onClick={() => { setEditingRegraPromocaoId(regra.id); setRegraPromocaoForm({ tipo: regra.tipo, nome: regra.nome, descricao: regra.descricao || '', condicao: regra.condicao, obrigatorio: regra.obrigatorio }); }} className="p-1.5" style={{ color: 'var(--text-secondary)' }}>
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteRegraPromocao(regra.id)} className="p-1.5" style={{ color: 'var(--text-secondary)' }}>
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
        {regras.length === 0 && (
          <p className="text-sm text-center py-4" style={{ color: 'var(--text-secondary)', opacity: 0.5 }}>Nenhuma regra configurada</p>
        )}
      </div>
    </div>
  );
}

function BonificacoesSection({ bonificacoes, showNovaBonificacao, setShowNovaBonificacao, bonificacaoForm, setBonificacaoForm, defaultBonificacao, handleSaveBonificacao, handleDeleteBonificacao }: any) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold flex items-center gap-2" style={{ color: '#F59E0B' }}>
          <Gift className="w-5 h-5" />
          Bonificacoes Extras
        </h3>
        <button onClick={() => setShowNovaBonificacao(true)} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium" style={{ backgroundColor: '#F59E0B20', color: '#F59E0B' }}>
          <Plus className="w-4 h-4" />
          Nova Bonificacao
        </button>
      </div>

      {showNovaBonificacao && (
        <div className="rounded-xl p-5" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid #F59E0B50' }}>
          <h4 className="font-bold mb-4" style={{ color: 'var(--text-primary)' }}>Criar Bonificacao</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Nome</label>
              <input type="text" value={bonificacaoForm.nome} onChange={(e) => setBonificacaoForm({ ...bonificacaoForm, nome: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} placeholder="Ex: Bonus Meta Trimestral" />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Tipo</label>
              <select value={bonificacaoForm.tipo} onChange={(e) => setBonificacaoForm({ ...bonificacaoForm, tipo: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}>
                <option value="valor_fixo">Valor Fixo (R$)</option>
                <option value="percentual">Percentual</option>
                <option value="estrelas_bonus">Estrelas Bonus</option>
              </select>
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Valor</label>
              <input type="number" value={bonificacaoForm.valor} onChange={(e) => setBonificacaoForm({ ...bonificacaoForm, valor: Number(e.target.value) })} className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--text-secondary)' }}>Condicao</label>
              <select value={bonificacaoForm.condicao} onChange={(e) => setBonificacaoForm({ ...bonificacaoForm, condicao: e.target.value })} className="w-full rounded-lg px-3 py-2 text-sm" style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}>
                <option value="meta_atingida">Meta Atingida</option>
                <option value="meta_superada">Meta Superada</option>
                <option value="top_ranking">Top do Ranking</option>
                <option value="promocao">Ao ser Promovido</option>
                <option value="trimestre_completo">Trimestre Completo</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 mt-4">
            <button onClick={() => setShowNovaBonificacao(false)} className="px-3 py-2 rounded-lg text-sm" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)' }}>Cancelar</button>
            <button onClick={handleSaveBonificacao} className="flex items-center gap-1 px-4 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#F59E0B' }}>
              <Save className="w-4 h-4" />
              Salvar
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {bonificacoes.map((bonus: any) => (
          <div key={bonus.id} className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
            <div className="flex items-center justify-between mb-2">
              <h4 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{bonus.nome}</h4>
              <button onClick={() => handleDeleteBonificacao(bonus.id)} className="p-1" style={{ color: 'var(--text-secondary)' }}>
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs mb-3" style={{ color: 'var(--text-secondary)' }}>{bonus.descricao || 'Sem descricao'}</p>
            <div className="flex items-center justify-between">
              <span className="px-2 py-1 rounded text-xs font-medium" style={{
                backgroundColor: bonus.tipo === 'valor_fixo' ? '#10B98120' : bonus.tipo === 'percentual' ? '#3B82F620' : '#F59E0B20',
                color: bonus.tipo === 'valor_fixo' ? '#10B981' : bonus.tipo === 'percentual' ? '#3B82F6' : '#F59E0B'
              }}>
                {bonus.tipo === 'valor_fixo' ? `R$ ${bonus.valor}` : bonus.tipo === 'percentual' ? `${bonus.valor}%` : `+${bonus.valor} estrelas`}
              </span>
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{(bonus.condicao || '').replace(/_/g, ' ')}</span>
            </div>
          </div>
        ))}
      </div>

      {bonificacoes.length === 0 && (
        <div className="text-center py-12">
          <Gift className="w-12 h-12 mx-auto mb-3 opacity-30" style={{ color: 'var(--text-secondary)' }} />
          <p style={{ color: 'var(--text-secondary)' }}>Nenhuma bonificacao configurada</p>
        </div>
      )}
    </div>
  );
}
