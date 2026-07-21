import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { calcularECachearDistancia, TARIFA_POR_KM } from '../../lib/deslocamentoService';
import {
  X, Save, MapPin, Check, AlertTriangle, Truck, DollarSign,
  Package, Shield, ShieldCheck, ShieldX, Gift, RotateCcw, Loader2,
  FileText, Zap
} from 'lucide-react';

interface AuditOS {
  id: string;
  numero_os_interna: string;
  numero_os_samsung: string | null;
  tipo_os: string;
  tipo_atendimento: string;
  cliente_cidade: string | null;
  cliente_estado: string | null;
  aparelho_modelo: string | null;
  valor_total: number | null;
  valor_pecas: number | null;
  valor_servicos: number | null;
  coluna_kanban: string | null;
  status_samsung_desc: string | null;
  status_samsung_reason: string | null;
  auditado_km_valor: number | null;
  auditado_mao_obra_valor: number | null;
  auditado_imposto_valor: number | null;
  auditado_status: boolean;
  auditado_observacao: string | null;
  unidade_id: string;
}

interface AuditPeca {
  id: string;
  pn: string;
  descricao: string;
  quantidade: number;
  status: string;
  valor_unitario: number | null;
  valor_total: number | null;
  valor_gspn: number | null;
  auditado_samsung_status: string | null;
  auditado_motivo_glosa: string | null;
  is_cortesia_samsung: boolean;
}

interface DistanciaCache {
  distancia_km: number;
  distancia_km_ida_volta: number;
  receita_calculada: number;
  erro_calculo: boolean;
  erro_mensagem: string | null;
  km_manual: number | null;
  receita_manual: number | null;
}

interface UnidadeInfo {
  cidade: string | null;
  estado: string | null;
  nome: string | null;
}

interface AuditarOSModalProps {
  osId: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function AuditarOSModal({ osId, onClose, onSaved }: AuditarOSModalProps) {
  const [os, setOS] = useState<AuditOS | null>(null);
  const [pecas, setPecas] = useState<AuditPeca[]>([]);
  const [distancia, setDistancia] = useState<DistanciaCache | null>(null);
  const [unidade, setUnidade] = useState<UnidadeInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [calculatingKm, setCalculatingKm] = useState(false);

  const [cidade, setCidade] = useState('');
  const [estado, setEstado] = useState('');
  const [modelo, setModelo] = useState('');
  const [maoObra, setMaoObra] = useState('');
  const [imposto, setImposto] = useState('');
  const [kmValor, setKmValor] = useState('');
  const [observacao, setObservacao] = useState('');

  const [pecaEdits, setPecaEdits] = useState<Record<string, {
    status: string | null;
    motivo: string;
    cortesia: boolean;
  }>>({});

  const [error, setError] = useState('');
  const [activeSection, setActiveSection] = useState<'dados' | 'km' | 'valores' | 'pecas'>('dados');

  useEffect(() => {
    loadOS();
  }, [osId]);

  const loadOS = async () => {
    setLoading(true);
    try {
      const { data: osData, error: osErr } = await supabase
        .from('os')
        .select('id, numero_os_interna, numero_os_samsung, tipo_os, tipo_atendimento, cliente_cidade, cliente_estado, aparelho_modelo, valor_total, valor_pecas, valor_servicos, coluna_kanban, status_samsung_desc, status_samsung_reason, auditado_km_valor, auditado_mao_obra_valor, auditado_imposto_valor, auditado_status, auditado_observacao, unidade_id')
        .eq('id', osId)
        .maybeSingle();
      if (osErr) throw osErr;
      if (!osData) throw new Error('OS nao encontrada');

      setOS(osData as AuditOS);
      setCidade(osData.cliente_cidade || '');
      setEstado(osData.cliente_estado || '');
      setModelo(osData.aparelho_modelo || '');
      setMaoObra(osData.auditado_mao_obra_valor?.toString() || '');
      setImposto(osData.auditado_imposto_valor?.toString() || '');
      setKmValor(osData.auditado_km_valor?.toString() || '');
      setObservacao(osData.auditado_observacao || '');

      const { data: unidadeData } = await supabase
        .from('unidades')
        .select('cidade, estado, nome')
        .eq('id', osData.unidade_id)
        .maybeSingle();
      setUnidade(unidadeData as UnidadeInfo);

      const { data: pecasData } = await supabase
        .from('os_pecas')
        .select('id, pn, descricao, quantidade, status, valor_unitario, valor_total, valor_gspn, auditado_samsung_status, auditado_motivo_glosa, is_cortesia_samsung')
        .eq('os_id', osId)
        .order('created_at', { ascending: true });

      const pecasList = (pecasData || []) as AuditPeca[];
      setPecas(pecasList);

      const edits: Record<string, { status: string | null; motivo: string; cortesia: boolean }> = {};
      pecasList.forEach(p => {
        edits[p.id] = {
          status: p.auditado_samsung_status,
          motivo: p.auditado_motivo_glosa || '',
          cortesia: p.is_cortesia_samsung || false,
        };
      });
      setPecaEdits(edits);

      const { data: cacheData } = await supabase
        .from('deslocamento_km_cache')
        .select('distancia_km, distancia_km_ida_volta, receita_calculada, erro_calculo, erro_mensagem, km_manual, receita_manual')
        .eq('os_id', osId)
        .maybeSingle();
      if (cacheData) setDistancia(cacheData as DistanciaCache);
    } catch (err: any) {
      setError(err.message || 'Erro ao carregar OS');
    } finally {
      setLoading(false);
    }
  };

  const handleCalcKm = async () => {
    if (!os || !unidade?.cidade || !unidade?.estado || !cidade || !estado) {
      setError('Preencha a cidade e estado do cliente e verifique a unidade');
      return;
    }
    setCalculatingKm(true);
    setError('');
    try {
      if (cidade !== os.cliente_cidade || estado !== os.cliente_estado) {
        await supabase.from('os').update({ cliente_cidade: cidade, cliente_estado: estado }).eq('id', os.id);
      }
      const result = await calcularECachearDistancia(
        os.id, os.unidade_id, unidade.cidade, unidade.estado, cidade, estado
      );
      setDistancia({
        distancia_km: result.distancia_km,
        distancia_km_ida_volta: result.distancia_km_ida_volta,
        receita_calculada: result.receita_calculada,
        erro_calculo: result.erro_calculo,
        erro_mensagem: result.erro_mensagem,
        km_manual: null,
        receita_manual: null,
      });
      if (!result.erro_calculo) {
        setKmValor(result.receita_calculada.toFixed(2));
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCalculatingKm(false);
    }
  };

  const handleAprovarKm = () => {
    if (distancia && !distancia.erro_calculo) {
      setKmValor(distancia.receita_calculada.toFixed(2));
    }
  };

  const handleSalvarTudo = async () => {
    if (!os) return;
    setSaving(true);
    setError('');
    try {
      const osUpdates: Record<string, any> = {};
      if (cidade !== os.cliente_cidade) osUpdates.cliente_cidade = cidade.trim() || null;
      if (estado !== os.cliente_estado) osUpdates.cliente_estado = estado.trim().toUpperCase() || null;
      if (modelo !== os.aparelho_modelo) osUpdates.aparelho_modelo = modelo.trim() || null;
      osUpdates.auditado_km_valor = kmValor ? parseFloat(kmValor) : null;
      osUpdates.auditado_mao_obra_valor = maoObra ? parseFloat(maoObra) : null;
      osUpdates.auditado_imposto_valor = imposto ? parseFloat(imposto) : null;
      osUpdates.auditado_observacao = observacao.trim() || null;

      const allPecasAudited = pecas.length === 0 || pecas.every(p => pecaEdits[p.id]?.status === 'Y' || pecaEdits[p.id]?.status === 'X');
      const hasKm = os.tipo_atendimento === 'IH' ? !!kmValor : true;
      const hasMaoObra = !!maoObra;
      osUpdates.auditado_status = allPecasAudited && hasKm && hasMaoObra;

      const { error: osErr } = await supabase.from('os').update(osUpdates).eq('id', os.id);
      if (osErr) throw osErr;

      for (const peca of pecas) {
        const edit = pecaEdits[peca.id];
        if (!edit) continue;

        if (edit.status === 'X' && !edit.motivo.trim()) {
          setError(`Peca ${peca.pn}: justificativa de glosa obrigatoria`);
          setSaving(false);
          setActiveSection('pecas');
          return;
        }

        const { error: pecaErr } = await supabase
          .from('os_pecas')
          .update({
            auditado_samsung_status: edit.status,
            auditado_motivo_glosa: edit.status === 'X' ? edit.motivo.trim() : null,
            is_cortesia_samsung: edit.cortesia,
          })
          .eq('id', peca.id);
        if (pecaErr) throw pecaErr;
      }

      onSaved();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const lucroOW = useMemo(() => {
    if (!os || os.tipo_os !== 'OW') return null;
    const valorCliente = os.valor_total || 0;
    let custoGSPN = 0;
    pecas.forEach(p => {
      const edit = pecaEdits[p.id];
      if (edit?.cortesia) return;
      custoGSPN += (p.valor_gspn || 0) * p.quantidade;
    });
    return { valorCliente, custoGSPN, lucro: valorCliente - custoGSPN };
  }, [os, pecas, pecaEdits]);

  const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const sections = [
    { id: 'dados' as const, label: 'Dados Base', icon: FileText },
    { id: 'km' as const, label: 'Deslocamento', icon: Truck },
    { id: 'valores' as const, label: 'Valores Fabrica', icon: DollarSign },
    { id: 'pecas' as const, label: `Pecas (${pecas.length})`, icon: Package },
  ];

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md">
        <div className="futuristic-loader" />
      </div>
    );
  }

  if (!os) return null;

  const osDisplay = os.numero_os_samsung || os.numero_os_interna;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="w-full max-w-4xl max-h-[92vh] bg-[#0c0c1a] border border-cyan-500/20 rounded-2xl shadow-[0_0_60px_rgba(0,212,255,0.08)] flex flex-col overflow-hidden">

        <div className="flex items-center justify-between px-6 py-4 border-b border-cyan-500/10 bg-gradient-to-r from-[#0c0c1a] to-[#111128]">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <Shield className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-white tracking-wide">{osDisplay}</h2>
                <span className={`px-2.5 py-0.5 rounded text-xs font-bold ${
                  os.tipo_os === 'LP' ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                }`}>
                  {os.tipo_os}
                </span>
                <span className="px-2 py-0.5 rounded text-xs bg-white/5 text-gray-400 border border-white/10">
                  {os.tipo_atendimento}
                </span>
                {os.auditado_status && (
                  <span className="flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                    <ShieldCheck className="w-3 h-3" /> AUDITADA
                  </span>
                )}
              </div>
              {os.numero_os_samsung && os.numero_os_interna && (
                <p className="text-xs text-gray-500 mt-0.5">Interna: {os.numero_os_interna}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="flex border-b border-white/5 bg-[#0e0e20]">
          {sections.map(s => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`flex items-center gap-2 px-5 py-3 text-sm font-medium transition-all border-b-2 ${
                  activeSection === s.id
                    ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5'
                    : 'border-transparent text-gray-500 hover:text-gray-300'
                }`}
              >
                <Icon className="w-4 h-4" />
                {s.label}
              </button>
            );
          })}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {activeSection === 'dados' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Cidade do Cliente</label>
                  <input type="text" value={cidade} onChange={e => setCidade(e.target.value)} className="neon-input w-full" placeholder="Ex: Juiz de Fora" />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Estado (UF)</label>
                  <input type="text" value={estado} onChange={e => setEstado(e.target.value.toUpperCase().slice(0, 2))} className="neon-input w-full" maxLength={2} placeholder="MG" />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Modelo do Aparelho</label>
                <input type="text" value={modelo} onChange={e => setModelo(e.target.value)} className="neon-input w-full" placeholder="SM-A155M" />
              </div>
              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Status Samsung</p>
                {os.status_samsung_desc ? (
                  <div>
                    <p className={`text-sm font-semibold ${
                      os.status_samsung_desc === 'REPARO COMPLETO' ? 'text-emerald-400' :
                      os.status_samsung_desc === 'PENDENTE' ? 'text-amber-400' :
                      (os.status_samsung_desc || '').includes('DESIGNADO') ? 'text-cyan-400' :
                      (os.status_samsung_desc || '').includes('RECUSADO') ? 'text-red-400' :
                      'text-white'
                    }`}>
                      {os.status_samsung_desc}
                    </p>
                    {os.status_samsung_reason && (
                      <p className="text-xs text-gray-500 mt-1">{os.status_samsung_reason}</p>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">Sem status Samsung</p>
                )}
              </div>

              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">Observação da Auditoria</label>
                <textarea
                  value={observacao}
                  onChange={e => setObservacao(e.target.value)}
                  rows={3}
                  className="neon-input w-full resize-none"
                  placeholder="Ex: Orçamento recusado pelo cliente, OS sem reparo, etc."
                />
              </div>
            </div>
          )}

          {activeSection === 'km' && (
            <div className="space-y-4">
              {os.tipo_atendimento !== 'IH' && (
                <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 text-center">
                  <p className="text-gray-400 text-sm">OS nao e IH (In-Home). Deslocamento nao se aplica automaticamente.</p>
                </div>
              )}

              <div className="p-4 rounded-xl bg-[#111128] border border-cyan-500/10">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-white flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-cyan-400" />
                    Rota: {unidade?.nome || 'Unidade'} &rarr; {cidade || '???'}
                  </p>
                  <button
                    onClick={handleCalcKm}
                    disabled={calculatingKm || !cidade || !estado}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 text-xs font-medium hover:bg-cyan-500/20 transition-colors disabled:opacity-40"
                  >
                    {calculatingKm ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    {calculatingKm ? 'Calculando...' : 'Calcular Distancia'}
                  </button>
                </div>

                {distancia && !distancia.erro_calculo && (
                  <div className="grid grid-cols-3 gap-3 mb-3">
                    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                      <p className="text-[10px] text-gray-500 uppercase">Ida</p>
                      <p className="text-lg font-bold text-white">{distancia.distancia_km.toFixed(1)} km</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                      <p className="text-[10px] text-gray-500 uppercase">Ida + Volta</p>
                      <p className="text-lg font-bold text-cyan-400">{distancia.distancia_km_ida_volta.toFixed(1)} km</p>
                    </div>
                    <div className="p-3 rounded-lg bg-white/[0.03] border border-white/5">
                      <p className="text-[10px] text-gray-500 uppercase">Receita (R$ {TARIFA_POR_KM}/km)</p>
                      <p className="text-lg font-bold text-emerald-400">{formatCurrency(distancia.receita_calculada)}</p>
                    </div>
                  </div>
                )}

                {distancia?.erro_calculo && (
                  <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30 mb-3">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                    <p className="text-xs text-red-400">{distancia.erro_mensagem || 'Erro ao calcular rota'}</p>
                  </div>
                )}

                {distancia && !distancia.erro_calculo && (
                  <button
                    onClick={handleAprovarKm}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-sm font-medium hover:bg-emerald-500/20 transition-colors w-full justify-center"
                  >
                    <Check className="w-4 h-4" />
                    Aprovar KM &rarr; {formatCurrency(distancia.receita_calculada)}
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                  Valor KM Auditado (R$) - Editavel
                </label>
                <input
                  type="number" step="0.01" min="0"
                  value={kmValor} onChange={e => setKmValor(e.target.value)}
                  className="neon-input w-full"
                  placeholder="0.00"
                />
                <p className="text-[10px] text-gray-600 mt-1">Voce pode editar manualmente caso necessario</p>
              </div>
            </div>
          )}

          {activeSection === 'valores' && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                  Mao de Obra (Pago pela Fabrica) R$
                </label>
                <input
                  type="number" step="0.01" min="0"
                  value={maoObra} onChange={e => setMaoObra(e.target.value)}
                  className="neon-input w-full"
                  placeholder="0.00"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 uppercase tracking-wider mb-1.5">
                  Impostos (Valor Pago) R$
                </label>
                <input
                  type="number" step="0.01" min="0"
                  value={imposto} onChange={e => setImposto(e.target.value)}
                  className="neon-input w-full"
                  placeholder="0.00"
                />
              </div>

              <div className="p-4 rounded-xl bg-white/[0.02] border border-white/5 space-y-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider">Resumo Auditoria Valores</p>
                <div className="grid grid-cols-3 gap-3">
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Mao de Obra</p>
                    <p className="text-lg font-bold text-white">{maoObra ? formatCurrency(parseFloat(maoObra)) : '-'}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">Impostos</p>
                    <p className="text-lg font-bold text-white">{imposto ? formatCurrency(parseFloat(imposto)) : '-'}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-500">KM</p>
                    <p className="text-lg font-bold text-cyan-400">{kmValor ? formatCurrency(parseFloat(kmValor)) : '-'}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeSection === 'pecas' && (
            <div className="space-y-3">
              {pecas.length === 0 ? (
                <div className="p-8 text-center rounded-xl bg-white/[0.02] border border-white/5">
                  <Package className="w-10 h-10 text-gray-600 mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">Nenhuma peca vinculada a esta OS</p>
                </div>
              ) : (
                pecas.map(peca => {
                  const edit = pecaEdits[peca.id] || { status: null, motivo: '', cortesia: false };
                  const isY = edit.status === 'Y';
                  const isX = edit.status === 'X';
                  return (
                    <div
                      key={peca.id}
                      className={`rounded-xl border p-4 transition-all ${
                        isY
                          ? 'bg-emerald-500/[0.04] border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.05)]'
                          : isX
                            ? 'bg-red-500/[0.04] border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.05)]'
                            : 'bg-white/[0.02] border-white/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-bold text-white">{peca.pn}</p>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-gray-500">
                              x{peca.quantidade}
                            </span>
                            {edit.cortesia && (
                              <span className="flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/30">
                                <Gift className="w-3 h-3" />
                                CORTESIA
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-400 truncate">{peca.descricao}</p>
                          <div className="flex items-center gap-4 mt-2 text-xs">
                            <span className="text-gray-500">GSPN: <span className="text-white font-medium">{peca.valor_gspn ? formatCurrency(peca.valor_gspn) : '-'}</span></span>
                            <span className="text-gray-500">NF: <span className="text-white font-medium">{peca.valor_unitario ? formatCurrency(peca.valor_unitario) : '-'}</span></span>
                            <span className="text-gray-500">Status: <span className="text-gray-300">{peca.status}</span></span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 flex-shrink-0">
                          <button
                            onClick={() => setPecaEdits(prev => ({
                              ...prev,
                              [peca.id]: { ...edit, cortesia: !edit.cortesia }
                            }))}
                            className={`p-2 rounded-lg border transition-all ${
                              edit.cortesia
                                ? 'bg-amber-500/20 border-amber-500/50 text-amber-400'
                                : 'bg-white/5 border-white/10 text-gray-500 hover:text-amber-400 hover:border-amber-500/30'
                            }`}
                            title="Cortesia Samsung"
                          >
                            <Gift className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setPecaEdits(prev => ({
                              ...prev,
                              [peca.id]: { ...edit, status: edit.status === 'Y' ? null : 'Y', motivo: '' }
                            }))}
                            className={`p-2.5 rounded-lg border font-bold text-sm transition-all ${
                              isY
                                ? 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
                                : 'bg-white/5 border-white/10 text-gray-500 hover:text-emerald-400 hover:border-emerald-500/30'
                            }`}
                            title="Pago / Aceito"
                          >
                            <ShieldCheck className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => setPecaEdits(prev => ({
                              ...prev,
                              [peca.id]: { ...edit, status: edit.status === 'X' ? null : 'X' }
                            }))}
                            className={`p-2.5 rounded-lg border font-bold text-sm transition-all ${
                              isX
                                ? 'bg-red-500/20 border-red-500/50 text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.15)]'
                                : 'bg-white/5 border-white/10 text-gray-500 hover:text-red-400 hover:border-red-500/30'
                            }`}
                            title="Glosado / Rejeitado"
                          >
                            <ShieldX className="w-5 h-5" />
                          </button>
                        </div>
                      </div>

                      {isX && (
                        <div className="mt-3">
                          <input
                            type="text"
                            value={edit.motivo}
                            onChange={e => setPecaEdits(prev => ({
                              ...prev,
                              [peca.id]: { ...edit, motivo: e.target.value }
                            }))}
                            placeholder="Justificativa da glosa (obrigatorio)..."
                            className="neon-input w-full text-sm !border-red-500/30 !ring-red-500/20"
                          />
                        </div>
                      )}
                    </div>
                  );
                })
              )}

              {os.tipo_os === 'OW' && lucroOW && (
                <div className="p-5 rounded-xl bg-gradient-to-br from-cyan-500/5 to-emerald-500/5 border border-cyan-500/20 mt-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Zap className="w-4 h-4 text-cyan-400" />
                    <p className="text-sm font-bold text-white">Painel de Lucro OW (Ao Vivo)</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase">Cobrado do Cliente</p>
                      <p className="text-xl font-bold text-white">{formatCurrency(lucroOW.valorCliente)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase">Custo GSPN Pecas</p>
                      <p className="text-xl font-bold text-red-400">- {formatCurrency(lucroOW.custoGSPN)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-gray-500 uppercase">Lucro</p>
                      <p className={`text-xl font-bold ${lucroOW.lucro >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatCurrency(lucroOW.lucro)}
                      </p>
                    </div>
                  </div>
                  <p className="text-[10px] text-gray-600 mt-2">* Pecas marcadas como cortesia tem custo GSPN zerado no calculo</p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between px-6 py-4 border-t border-cyan-500/10 bg-[#0c0c1a]">
          <div className="text-xs text-gray-600">
            {os.auditado_status ? (
              <span className="text-emerald-400 flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Auditoria concluida</span>
            ) : (
              <span>Auditoria pendente</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button onClick={onClose} className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 text-sm transition-colors">
              Fechar
            </button>
            <button
              onClick={handleSalvarTudo}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-cyan-500/10 border border-cyan-500/40 text-cyan-400 text-sm font-semibold hover:bg-cyan-500/20 transition-all disabled:opacity-50 shadow-[0_0_15px_rgba(0,212,255,0.1)]"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {saving ? 'Salvando...' : 'Salvar Auditoria'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
