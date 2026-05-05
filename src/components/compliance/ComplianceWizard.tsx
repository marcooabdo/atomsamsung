import { useState, useEffect, useMemo, useRef } from 'react';
import { X, ChevronRight, ChevronLeft, Car, AlertTriangle, PackageX, HelpCircle, Users, Calendar, CheckCircle2, Trash2, Package, Search, ChevronDown } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { CATEGORIAS, formatBRL, type CategoriaOcorrencia, type TipoDeducao } from './types';

interface UsuarioMinimo {
  id: string;
  nome: string;
  foto_url: string | null;
  unidade_id: string | null;
  unidade_nome?: string | null;
}

interface ResponsavelForm {
  usuario_id: string;
  percentual: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}

const categoryIcons: Record<CategoriaOcorrencia, typeof Car> = {
  dano_veiculo: Car,
  multa: AlertTriangle,
  extravio: PackageX,
  pecas: Package,
  outros: HelpCircle,
};

export function ComplianceWizard({ open, onClose, onCreated }: Props) {
  const { usuario } = useAuth();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [titulo, setTitulo] = useState('');
  const [categoria, setCategoria] = useState<CategoriaOcorrencia>('dano_veiculo');
  const [dataOcorrencia, setDataOcorrencia] = useState(() => new Date().toISOString().slice(0, 10));
  const [descricao, setDescricao] = useState('');
  const [valorTotal, setValorTotal] = useState(0);

  const [usuarios, setUsuarios] = useState<UsuarioMinimo[]>([]);
  const [responsaveis, setResponsaveis] = useState<ResponsavelForm[]>([]);
  const [searchUser, setSearchUser] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [tipoDeducao, setTipoDeducao] = useState<TipoDeducao>('folha');
  const [numParcelas, setNumParcelas] = useState(1);
  const [mesInicio, setMesInicio] = useState(() => new Date().toISOString().slice(0, 7));

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setTitulo('');
    setCategoria('dano_veiculo');
    setDataOcorrencia(new Date().toISOString().slice(0, 10));
    setDescricao('');
    setValorTotal(0);
    setResponsaveis([]);
    setSearchUser('');
    setDropdownOpen(false);
    setTipoDeducao('folha');
    setNumParcelas(1);
    setMesInicio(new Date().toISOString().slice(0, 7));
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (!open || !usuario) return;
    (async () => {
      const isMaster = usuario.tipo === 'master' || usuario.tipo === 'administrador';
      let query = supabase
        .from('usuarios')
        .select('id, nome, foto_url, unidade_id')
        .eq('ativo', true)
        .order('nome');
      if (!isMaster && usuario.unidade_id) {
        query = query.eq('unidade_id', usuario.unidade_id);
      }
      const { data } = await query;
      if (!data) return;

      if (isMaster) {
        const unidadeIds = [...new Set(data.map(u => u.unidade_id).filter(Boolean))] as string[];
        const { data: unidades } = unidadeIds.length > 0
          ? await supabase.from('unidades').select('id, nome').in('id', unidadeIds)
          : { data: [] };
        const unidadeMap = new Map((unidades || []).map(u => [u.id, u.nome]));
        setUsuarios(data.map(u => ({ ...u, unidade_nome: u.unidade_id ? unidadeMap.get(u.unidade_id) || null : null })));
      } else {
        setUsuarios(data);
      }
    })();
  }, [open, usuario?.id]);

  const totalPercentual = useMemo(
    () => responsaveis.reduce((s, r) => s + (Number(r.percentual) || 0), 0),
    [responsaveis]
  );

  const addResponsavel = (userId: string) => {
    if (responsaveis.some(r => r.usuario_id === userId)) return;
    const novos = [...responsaveis, { usuario_id: userId, percentual: 0 }];
    const split = +(100 / novos.length).toFixed(2);
    const redistribuidos = novos.map((r, i) =>
      i === novos.length - 1
        ? { ...r, percentual: +(100 - split * (novos.length - 1)).toFixed(2) }
        : { ...r, percentual: split }
    );
    setResponsaveis(redistribuidos);
    setSearchUser('');
    setDropdownOpen(false);
  };

  const removeResponsavel = (userId: string) => {
    const filtrados = responsaveis.filter(r => r.usuario_id !== userId);
    if (filtrados.length === 0) {
      setResponsaveis([]);
      return;
    }
    const split = +(100 / filtrados.length).toFixed(2);
    setResponsaveis(
      filtrados.map((r, i) =>
        i === filtrados.length - 1
          ? { ...r, percentual: +(100 - split * (filtrados.length - 1)).toFixed(2) }
          : { ...r, percentual: split }
      )
    );
  };

  const setPercent = (userId: string, value: number) => {
    setResponsaveis(responsaveis.map(r => r.usuario_id === userId ? { ...r, percentual: value } : r));
  };

  const filteredUsuarios = useMemo(() => {
    const base = usuarios.filter(u => !responsaveis.some(r => r.usuario_id === u.id));
    if (!searchUser.trim()) return base;
    const s = searchUser.toLowerCase();
    return base.filter(u =>
      u.nome.toLowerCase().includes(s) ||
      (u.unidade_nome || '').toLowerCase().includes(s)
    );
  }, [usuarios, responsaveis, searchUser]);

  const parcelasPreview = useMemo(() => {
    if (responsaveis.length === 0 || numParcelas < 1) return [];
    const [ano, mes] = mesInicio.split('-').map(Number);
    return responsaveis.map(r => {
      const nomeResp = usuarios.find(u => u.id === r.usuario_id)?.nome || '';
      const valorDevido = (valorTotal * r.percentual) / 100;
      const valorParcela = valorDevido / numParcelas;
      const parcelas = Array.from({ length: numParcelas }, (_, i) => {
        const d = new Date(ano, mes - 1 + i, 1);
        return {
          numero: i + 1,
          mes: d.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }),
          valor: valorParcela,
        };
      });
      return { nome: nomeResp, valorDevido, parcelas };
    });
  }, [responsaveis, valorTotal, numParcelas, mesInicio, usuarios]);

  const canAdvance = () => {
    if (step === 1) return titulo.trim().length > 2 && valorTotal > 0;
    if (step === 2) return responsaveis.length > 0 && Math.abs(totalPercentual - 100) < 0.5;
    if (step === 3) return numParcelas >= 1 && numParcelas <= 12;
    return false;
  };

  const handleSave = async () => {
    if (!canAdvance()) return;
    setSaving(true);
    try {
      const { data: ocorr, error: e1 } = await supabase
        .from('compliance_ocorrencias')
        .insert({
          unidade_id: usuario?.unidade_id,
          titulo,
          categoria,
          data_ocorrencia: dataOcorrencia,
          descricao,
          valor_total: valorTotal,
          tipo_deducao: tipoDeducao,
          status: 'em_pagamento',
          created_by: usuario?.id,
        })
        .select()
        .single();
      if (e1) throw e1;

      for (const r of responsaveis) {
        const valorDevido = +((valorTotal * r.percentual) / 100).toFixed(2);
        const { data: resp, error: e2 } = await supabase
          .from('compliance_responsaveis')
          .insert({
            ocorrencia_id: ocorr.id,
            usuario_id: r.usuario_id,
            percentual: r.percentual,
            valor_devido: valorDevido,
            valor_pago: 0,
          })
          .select()
          .single();
        if (e2) throw e2;

        const [ano, mes] = mesInicio.split('-').map(Number);
        const valorParcela = +(valorDevido / numParcelas).toFixed(2);
        const parcelas = Array.from({ length: numParcelas }, (_, i) => {
          const d = new Date(ano, mes - 1 + i, 1);
          return {
            responsavel_id: resp.id,
            numero_parcela: i + 1,
            total_parcelas: numParcelas,
            mes_referencia: d.toISOString().slice(0, 10),
            valor: i === numParcelas - 1
              ? +(valorDevido - valorParcela * (numParcelas - 1)).toFixed(2)
              : valorParcela,
            deduzido: false,
          };
        });
        const { error: e3 } = await supabase.from('compliance_parcelas').insert(parcelas);
        if (e3) throw e3;
      }

      onCreated();
      onClose();
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar ocorrência');
    } finally {
      setSaving(false);
    }
  };

  if (!open) return null;

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255,255,255,0.03)',
    border: '1px solid rgba(255,255,255,0.08)',
    color: '#E0E0E0',
    colorScheme: 'dark',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(10,10,13,0.85)', backdropFilter: 'blur(8px)' }}>
      <div className="glass-modal w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col rounded-2xl"
        style={{ background: '#111114', border: '1px solid rgba(0,212,255,0.3)', boxShadow: '0 0 60px rgba(0,212,255,0.2)' }}>

        <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <div>
            <h2 className="text-lg font-bold tracking-wide" style={{ color: '#E0E0E0' }}>
              Nova Ocorrência de Compliance
            </h2>
            <p className="text-xs mt-0.5" style={{ color: '#8899AA' }}>
              Etapa {step} de 3
            </p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 transition">
            <X className="w-5 h-5" style={{ color: '#8899AA' }} />
          </button>
        </div>

        <div className="px-6 pt-4">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.06)' }}>
                <div className="h-full transition-all duration-500"
                  style={{
                    width: step >= i ? '100%' : '0%',
                    background: 'linear-gradient(90deg, rgba(0,212,255,0.8), rgba(0,212,255,1))',
                    boxShadow: step >= i ? '0 0 10px rgba(0,212,255,0.6)' : 'none',
                  }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 cyber-scrollbar">
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <label className="text-xs uppercase tracking-wider font-bold mb-2 block" style={{ color: '#8899AA' }}>Título da Ocorrência</label>
                <input type="text" value={titulo} onChange={e => setTitulo(e.target.value)}
                  placeholder="Ex: Colisão traseira no veículo ABC-1D23"
                  className="w-full px-4 py-3 rounded-lg text-sm"
                  style={inputStyle} />
              </div>

              <div>
                <label className="text-xs uppercase tracking-wider font-bold mb-2 block" style={{ color: '#8899AA' }}>Categoria</label>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                  {CATEGORIAS.map(cat => {
                    const Icon = categoryIcons[cat.value];
                    const active = categoria === cat.value;
                    return (
                      <button key={cat.value} type="button" onClick={() => setCategoria(cat.value)}
                        className="p-3 rounded-lg flex flex-col items-center gap-2 transition-all"
                        style={{
                          background: active ? `${cat.color}15` : 'rgba(255,255,255,0.03)',
                          border: `1px solid ${active ? cat.color : 'rgba(255,255,255,0.08)'}`,
                          boxShadow: active ? `0 0 20px ${cat.color}40` : 'none',
                        }}>
                        <Icon className="w-5 h-5" style={{ color: active ? cat.color : 'var(--text-secondary)' }} />
                        <span className="text-[11px] font-bold" style={{ color: active ? cat.color : 'var(--text-secondary)' }}>{cat.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs uppercase tracking-wider font-bold mb-2 block" style={{ color: '#8899AA' }}>Data da Ocorrência</label>
                  <input type="date" value={dataOcorrencia} onChange={e => setDataOcorrencia(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg text-sm"
                    style={inputStyle} />
                </div>
                <div>
                  <label className="text-xs uppercase tracking-wider font-bold mb-2 block" style={{ color: '#8899AA' }}>Valor Total (R$)</label>
                  <input type="number" step="0.01" min="0" value={valorTotal || ''} onChange={e => setValorTotal(Number(e.target.value))}
                    placeholder="0,00"
                    className="w-full px-4 py-3 rounded-lg text-sm font-mono"
                    style={{ ...inputStyle, color: '#00D4FF' }} />
                </div>
              </div>

              <div>
                <label className="text-xs uppercase tracking-wider font-bold mb-2 block" style={{ color: '#8899AA' }}>Descrição / Relato</label>
                <textarea value={descricao} onChange={e => setDescricao(e.target.value)} rows={4}
                  placeholder="Detalhes do ocorrido, circunstâncias, testemunhas..."
                  className="w-full px-4 py-3 rounded-lg text-sm resize-none"
                  style={inputStyle} />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div ref={dropdownRef} className="relative">
                <label className="text-xs uppercase tracking-wider font-bold mb-2 block" style={{ color: '#8899AA' }}>Adicionar Responsável</label>
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#8899AA' }} />
                  <input type="text" value={searchUser} onChange={e => { setSearchUser(e.target.value); setDropdownOpen(true); }}
                    onFocus={() => setDropdownOpen(true)}
                    placeholder="Buscar colaborador por nome ou unidade..."
                    className="w-full pl-10 pr-10 py-3 rounded-lg text-sm"
                    style={inputStyle} />
                  <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#8899AA' }} />
                </div>

                {dropdownOpen && (
                  <div className="absolute z-20 mt-1 w-full max-h-72 overflow-y-auto cyber-scrollbar rounded-lg"
                    style={{
                      background: 'var(--bg-card, #15151A)',
                      border: '1px solid rgba(0,212,255,0.3)',
                      boxShadow: '0 10px 40px rgba(0,0,0,0.6), 0 0 30px rgba(0,212,255,0.15)',
                    }}>
                    {filteredUsuarios.length === 0 ? (
                      <div className="px-4 py-6 text-center text-xs" style={{ color: '#8899AA' }}>
                        Nenhum colaborador encontrado
                      </div>
                    ) : (
                      filteredUsuarios.map(u => (
                        <button key={u.id} type="button" onClick={() => addResponsavel(u.id)}
                          className="w-full px-4 py-2.5 flex items-center gap-3 text-left transition hover:bg-white/5 border-b last:border-b-0"
                          style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
                          <div className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
                            style={{ background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.3)' }}>
                            {u.foto_url
                              ? <img src={u.foto_url} alt="" className="w-full h-full object-cover" />
                              : <span className="text-[11px] font-bold" style={{ color: '#00D4FF' }}>{u.nome.charAt(0).toUpperCase()}</span>}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-bold truncate" style={{ color: '#E0E0E0' }}>{u.nome}</div>
                            {u.unidade_nome && (
                              <div className="text-[10px] truncate" style={{ color: '#8899AA' }}>{u.unidade_nome}</div>
                            )}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                {responsaveis.length === 0 && (
                  <div className="text-center py-8 rounded-lg" style={{ border: '1px dashed var(--border-primary)' }}>
                    <Users className="w-8 h-8 mx-auto mb-2" style={{ color: '#8899AA' }} />
                    <p className="text-xs" style={{ color: '#8899AA' }}>Nenhum responsável adicionado</p>
                  </div>
                )}
                {responsaveis.map(r => {
                  const u = usuarios.find(x => x.id === r.usuario_id);
                  const valor = (valorTotal * r.percentual) / 100;
                  return (
                    <div key={r.usuario_id} className="p-4 rounded-lg flex items-center gap-3"
                      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="w-10 h-10 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0"
                        style={{ background: 'rgba(0,212,255,0.15)', border: '1px solid rgba(0,212,255,0.3)' }}>
                        {u?.foto_url ? <img src={u.foto_url} alt="" className="w-full h-full object-cover" /> : <Users className="w-5 h-5" style={{ color: '#00D4FF' }} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-bold truncate flex items-center gap-2 flex-wrap" style={{ color: '#E0E0E0' }}>
                          <span>{u?.nome}</span>
                          {u?.unidade_nome && (
                            <span className="text-[10px] font-normal uppercase tracking-wider px-1.5 py-0.5 rounded"
                              style={{ background: 'rgba(0,212,255,0.1)', color: '#00D4FF' }}>
                              {u.unidade_nome}
                            </span>
                          )}
                        </div>
                        <div className="text-xs font-mono" style={{ color: '#00D4FF' }}>{formatBRL(valor)}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <input type="number" min="0" max="100" step="0.01" value={r.percentual}
                          onChange={e => setPercent(r.usuario_id, Number(e.target.value))}
                          className="w-20 px-2 py-1.5 rounded text-sm text-center font-mono"
                          style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: '#E0E0E0' }} />
                        <span className="text-xs" style={{ color: '#8899AA' }}>%</span>
                        <button onClick={() => removeResponsavel(r.usuario_id)} className="p-1.5 rounded hover:bg-red-500/10 transition">
                          <Trash2 className="w-4 h-4 text-red-400" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {responsaveis.length > 0 && (
                <div className="flex items-center justify-between p-3 rounded-lg"
                  style={{
                    background: Math.abs(totalPercentual - 100) < 0.5 ? 'rgba(74,222,128,0.08)' : 'rgba(255,107,107,0.08)',
                    border: `1px solid ${Math.abs(totalPercentual - 100) < 0.5 ? 'rgba(74,222,128,0.3)' : 'rgba(255,107,107,0.3)'}`,
                  }}>
                  <span className="text-xs uppercase tracking-wider font-bold" style={{ color: '#8899AA' }}>Total Distribuído</span>
                  <span className="font-mono font-bold" style={{ color: Math.abs(totalPercentual - 100) < 0.5 ? '#4ADE80' : '#FF6B6B' }}>
                    {totalPercentual.toFixed(2)}%
                  </span>
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div>
                <label className="text-xs uppercase tracking-wider font-bold mb-2 block" style={{ color: '#8899AA' }}>Tipo de Dedução</label>
                <div className="grid grid-cols-2 gap-2">
                  {([['folha', 'Folha de Salário'], ['premiacao', 'Premiação']] as const).map(([val, label]) => (
                    <button key={val} onClick={() => setTipoDeducao(val)}
                      className="p-3 rounded-lg text-sm font-bold transition"
                      style={{
                        background: tipoDeducao === val ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${tipoDeducao === val ? 'rgba(0,212,255,0.5)' : 'rgba(255,255,255,0.08)'}`,
                        color: tipoDeducao === val ? 'var(--text-accent)' : 'var(--text-secondary)',
                        boxShadow: tipoDeducao === val ? '0 0 20px rgba(0,212,255,0.3)' : 'none',
                      }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs uppercase tracking-wider font-bold mb-2 block" style={{ color: '#8899AA' }}>Número de Parcelas</label>
                <div className="grid grid-cols-6 gap-2">
                  {Array.from({ length: 12 }, (_, i) => i + 1).map(n => (
                    <button key={n} type="button" onClick={() => setNumParcelas(n)}
                      className="py-2.5 rounded-lg text-sm font-bold font-mono transition"
                      style={{
                        background: numParcelas === n ? 'rgba(0,212,255,0.15)' : 'rgba(255,255,255,0.03)',
                        border: `1px solid ${numParcelas === n ? 'rgba(0,212,255,0.5)' : 'rgba(255,255,255,0.08)'}`,
                        color: numParcelas === n ? 'var(--text-accent)' : 'var(--text-secondary)',
                        boxShadow: numParcelas === n ? '0 0 15px rgba(0,212,255,0.25)' : 'none',
                      }}>
                      {n}x
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs uppercase tracking-wider font-bold mb-2 block" style={{ color: '#8899AA' }}>Mês de Início</label>
                <input type="month" value={mesInicio} onChange={e => setMesInicio(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg text-sm"
                  style={inputStyle} />
              </div>

              <div>
                <div className="text-xs uppercase tracking-wider font-bold mb-2 flex items-center gap-2" style={{ color: '#8899AA' }}>
                  <Calendar className="w-3 h-3" /> Preview do Cronograma
                </div>
                <div className="space-y-3 max-h-64 overflow-y-auto cyber-scrollbar pr-2">
                  {parcelasPreview.map((pv, i) => (
                    <div key={i} className="p-3 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold" style={{ color: '#E0E0E0' }}>{pv.nome}</span>
                        <span className="text-xs font-mono" style={{ color: '#00D4FF' }}>{formatBRL(pv.valorDevido)}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {pv.parcelas.map(p => (
                          <div key={p.numero} className="px-2 py-1 rounded text-[10px] font-mono"
                            style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.2)', color: '#00D4FF' }}>
                            {p.numero}/{pv.parcelas.length} · {p.mes} · {formatBRL(p.valor)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }}>
          <button onClick={step === 1 ? onClose : () => setStep(step - 1)}
            className="px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', color: '#8899AA' }}>
            <ChevronLeft className="w-4 h-4" />
            {step === 1 ? 'Cancelar' : 'Voltar'}
          </button>
          <button onClick={step === 3 ? handleSave : () => setStep(step + 1)}
            disabled={!canAdvance() || saving}
            className="px-6 py-2 rounded-lg text-sm font-bold flex items-center gap-2 transition disabled:opacity-40 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, rgba(0,212,255,0.8), rgba(0,212,255,1))',
              color: '#0A0A0D',
              boxShadow: '0 0 20px rgba(0,212,255,0.4)',
            }}>
            {step === 3 ? (saving ? 'Salvando...' : <>Registrar <CheckCircle2 className="w-4 h-4" /></>) : <>Próximo <ChevronRight className="w-4 h-4" /></>}
          </button>
        </div>
      </div>
    </div>
  );
}
