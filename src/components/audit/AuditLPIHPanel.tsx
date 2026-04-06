import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../../lib/supabase';
import { calcularECachearDistancia, TARIFA_POR_KM } from '../../lib/deslocamentoService';
import {
  Truck, MapPin, RefreshCw, Check, AlertTriangle, Loader2,
  ChevronDown, ChevronUp, DollarSign, Navigation, Pencil
} from 'lucide-react';

interface LPIH_OS {
  id: string;
  numero_os_interna: string;
  numero_os_samsung: string | null;
  cliente_cidade: string | null;
  cliente_estado: string | null;
  auditado_km_valor: number | null;
  auditado_status: boolean;
  unidade_id: string;
}

interface KmCache {
  os_id: string;
  distancia_km: number;
  distancia_km_ida_volta: number;
  receita_calculada: number;
  erro_calculo: boolean;
  erro_mensagem: string | null;
  km_manual: number | null;
  receita_manual: number | null;
}

interface UnidadeOrigin {
  id: string;
  nome: string;
  cidade: string | null;
  estado: string | null;
}

interface Props {
  osList: LPIH_OS[];
  onOSUpdated: () => void;
}

export function AuditLPIHPanel({ osList, onOSUpdated }: Props) {
  const [cacheMap, setCacheMap] = useState<Record<string, KmCache>>({});
  const [unidadeMap, setUnidadeMap] = useState<Record<string, UnidadeOrigin>>({});
  const [loadingCache, setLoadingCache] = useState(true);
  const [bulkUpdating, setBulkUpdating] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [sortBy, setSortBy] = useState<'cidade' | 'km' | 'status'>('cidade');

  const lpIhList = useMemo(() =>
    osList.filter(o => o.cliente_cidade),
    [osList]
  );

  useEffect(() => {
    loadCacheAndUnidades();
  }, [lpIhList]);

  const loadCacheAndUnidades = async () => {
    if (lpIhList.length === 0) {
      setLoadingCache(false);
      return;
    }
    setLoadingCache(true);
    try {
      const osIds = lpIhList.map(o => o.id);
      const newCacheMap: Record<string, KmCache> = {};
      for (let i = 0; i < osIds.length; i += 500) {
        const batch = osIds.slice(i, i + 500);
        const { data } = await supabase
          .from('deslocamento_km_cache')
          .select('os_id, distancia_km, distancia_km_ida_volta, receita_calculada, erro_calculo, erro_mensagem, km_manual, receita_manual')
          .in('os_id', batch);
        (data || []).forEach(d => { newCacheMap[d.os_id] = d; });
      }
      setCacheMap(newCacheMap);

      const unidadeIds = [...new Set(lpIhList.map(o => o.unidade_id))];
      const newUnidadeMap: Record<string, UnidadeOrigin> = {};
      for (let i = 0; i < unidadeIds.length; i += 50) {
        const batch = unidadeIds.slice(i, i + 50);
        const { data } = await supabase
          .from('unidades')
          .select('id, nome, cidade, estado')
          .in('id', batch);
        (data || []).forEach(u => { newUnidadeMap[u.id] = u; });
      }
      setUnidadeMap(newUnidadeMap);
    } catch (err) {
      console.error('Error loading LP IH cache:', err);
    } finally {
      setLoadingCache(false);
    }
  };

  const sortedList = useMemo(() => {
    const list = [...lpIhList];
    list.sort((a, b) => {
      if (sortBy === 'cidade') return (a.cliente_cidade || '').localeCompare(b.cliente_cidade || '');
      if (sortBy === 'km') {
        const aKm = a.auditado_km_valor || cacheMap[a.id]?.receita_calculada || 0;
        const bKm = b.auditado_km_valor || cacheMap[b.id]?.receita_calculada || 0;
        return bKm - aKm;
      }
      if (sortBy === 'status') {
        const aHas = a.auditado_km_valor ? 1 : 0;
        const bHas = b.auditado_km_valor ? 1 : 0;
        return aHas - bHas;
      }
      return 0;
    });
    return list;
  }, [lpIhList, sortBy, cacheMap]);

  const totals = useMemo(() => {
    let totalKmAuditado = 0;
    let totalKmPreview = 0;
    let countWithKm = 0;
    let countWithoutKm = 0;
    let countErro = 0;

    lpIhList.forEach(os => {
      const cache = cacheMap[os.id];
      if (os.auditado_km_valor) {
        totalKmAuditado += os.auditado_km_valor;
        countWithKm++;
      } else if (cache && !cache.erro_calculo && cache.receita_calculada > 0) {
        totalKmPreview += cache.receita_calculada;
        countWithKm++;
      } else {
        countWithoutKm++;
        if (cache?.erro_calculo) countErro++;
      }
    });

    return {
      totalKmAuditado,
      totalKmPreview,
      totalGeral: totalKmAuditado + totalKmPreview,
      countWithKm,
      countWithoutKm,
      countErro,
      totalOS: lpIhList.length,
    };
  }, [lpIhList, cacheMap]);

  const handleBulkCalcAll = useCallback(async () => {
    const missing = lpIhList.filter(os => {
      const cache = cacheMap[os.id];
      return !cache || cache.erro_calculo;
    });

    if (missing.length === 0) {
      const toApply = lpIhList.filter(os => {
        const cache = cacheMap[os.id];
        return !os.auditado_km_valor && cache && !cache.erro_calculo && cache.receita_calculada > 0;
      });

      if (toApply.length === 0) return;
      setBulkUpdating(true);
      setBulkProgress({ done: 0, total: toApply.length });

      for (let i = 0; i < toApply.length; i++) {
        const os = toApply[i];
        const cache = cacheMap[os.id];
        await supabase.from('os').update({ auditado_km_valor: cache.receita_calculada }).eq('id', os.id);
        setBulkProgress({ done: i + 1, total: toApply.length });
      }

      setBulkUpdating(false);
      onOSUpdated();
      return;
    }

    setBulkUpdating(true);
    setBulkProgress({ done: 0, total: missing.length });

    const newCacheMap = { ...cacheMap };

    for (let i = 0; i < missing.length; i++) {
      const os = missing[i];
      const unidade = unidadeMap[os.unidade_id];
      if (!unidade?.cidade || !unidade?.estado || !os.cliente_cidade || !os.cliente_estado) {
        setBulkProgress({ done: i + 1, total: missing.length });
        continue;
      }
      try {
        const result = await calcularECachearDistancia(
          os.id, os.unidade_id, unidade.cidade, unidade.estado, os.cliente_cidade, os.cliente_estado
        );
        newCacheMap[os.id] = {
          os_id: os.id,
          distancia_km: result.distancia_km,
          distancia_km_ida_volta: result.distancia_km_ida_volta,
          receita_calculada: result.receita_calculada,
          erro_calculo: result.erro_calculo,
          erro_mensagem: result.erro_mensagem,
          km_manual: null,
          receita_manual: null,
        };
        if (!result.erro_calculo && result.receita_calculada > 0) {
          await supabase.from('os').update({ auditado_km_valor: result.receita_calculada }).eq('id', os.id);
        }
      } catch {
        // skip
      }
      setBulkProgress({ done: i + 1, total: missing.length });
    }

    setCacheMap(newCacheMap);
    setBulkUpdating(false);
    onOSUpdated();
  }, [lpIhList, cacheMap, unidadeMap, onOSUpdated]);

  const handleSaveKmManual = async (osId: string) => {
    const val = parseFloat(editValue);
    if (isNaN(val) || val < 0) return;
    setSavingId(osId);
    await supabase.from('os').update({ auditado_km_valor: val }).eq('id', osId);
    setSavingId(null);
    setEditingId(null);
    onOSUpdated();
  };

  const formatCurrency = (v: number) => v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (lpIhList.length === 0) return null;

  return (
    <div className="premium-card overflow-hidden">
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-4 bg-gradient-to-r from-teal-500/5 to-cyan-500/5 border-b border-white/5 hover:from-teal-500/8 hover:to-cyan-500/8 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-teal-500/15 border border-teal-500/30 flex items-center justify-center">
            <Navigation className="w-4 h-4 text-teal-400" />
          </div>
          <div className="text-left">
            <h3 className="text-sm font-bold text-white">LP IH - Previa de KM por Cidade</h3>
            <p className="text-[10px] text-gray-500">{lpIhList.length} OS &middot; Tarifa R$ {TARIFA_POR_KM}/km ida+volta</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-lg font-bold text-teal-400">{formatCurrency(totals.totalGeral)}</p>
            <p className="text-[10px] text-gray-500">Receita KM estimada</p>
          </div>
          {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
        </div>
      </button>

      {expanded && (
        <div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-5 py-4 bg-white/[0.01] border-b border-white/5">
            <div className="p-3 rounded-lg bg-teal-500/5 border border-teal-500/20">
              <p className="text-[10px] text-gray-500 uppercase mb-0.5">KM Auditado</p>
              <p className="text-xl font-bold text-teal-400">{formatCurrency(totals.totalKmAuditado)}</p>
              <p className="text-[10px] text-gray-600">{lpIhList.filter(o => o.auditado_km_valor).length} OS confirmadas</p>
            </div>
            <div className="p-3 rounded-lg bg-cyan-500/5 border border-cyan-500/20">
              <p className="text-[10px] text-gray-500 uppercase mb-0.5">KM Previa</p>
              <p className="text-xl font-bold text-cyan-400">{formatCurrency(totals.totalKmPreview)}</p>
              <p className="text-[10px] text-gray-600">Calculado via Maps</p>
            </div>
            <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <p className="text-[10px] text-gray-500 uppercase mb-0.5">Pendentes</p>
              <p className="text-xl font-bold text-amber-400">{totals.countWithoutKm}</p>
              <p className="text-[10px] text-gray-600">{totals.countErro > 0 ? `${totals.countErro} com erro` : 'Sem calculo'}</p>
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <p className="text-[10px] text-gray-500 uppercase mb-0.5">Total Geral</p>
              <p className="text-xl font-bold text-emerald-400">{formatCurrency(totals.totalGeral)}</p>
              <p className="text-[10px] text-gray-600">Auditado + Previa</p>
            </div>
          </div>

          <div className="px-5 py-3 flex items-center justify-between border-b border-white/5">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-500 uppercase tracking-wider">Ordenar:</span>
              {(['cidade', 'km', 'status'] as const).map(s => (
                <button
                  key={s}
                  onClick={() => setSortBy(s)}
                  className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all border ${
                    sortBy === s
                      ? 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                      : 'bg-white/[0.02] border-white/5 text-gray-600 hover:text-white'
                  }`}
                >
                  {s === 'cidade' ? 'Cidade' : s === 'km' ? 'Valor KM' : 'Pendentes'}
                </button>
              ))}
            </div>

            <button
              onClick={handleBulkCalcAll}
              disabled={bulkUpdating || loadingCache}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-teal-500/10 border border-teal-500/40 text-teal-400 text-xs font-semibold hover:bg-teal-500/20 transition-all disabled:opacity-50 shadow-[0_0_12px_rgba(20,184,166,0.08)]"
            >
              {bulkUpdating ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  {bulkProgress.done}/{bulkProgress.total}
                </>
              ) : (
                <>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Atualizar Todos LP IH
                </>
              )}
            </button>
          </div>

          {loadingCache ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-cyan-400" />
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
              <table className="w-full">
                <thead className="sticky top-0 z-10">
                  <tr className="border-b border-white/5 bg-[#111128]">
                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">OS</th>
                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Rota</th>
                    <th className="text-center px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">KM Ida</th>
                    <th className="text-center px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">KM I+V</th>
                    <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Previa R$</th>
                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">KM Auditado R$</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedList.map((os, idx) => {
                    const cache = cacheMap[os.id];
                    const unidade = unidadeMap[os.unidade_id];
                    const hasAuditado = os.auditado_km_valor != null && os.auditado_km_valor > 0;
                    const isEditing = editingId === os.id;

                    return (
                      <tr
                        key={os.id}
                        className={`border-b border-white/[0.03] transition-colors ${
                          hasAuditado
                            ? 'bg-emerald-500/[0.02] hover:bg-emerald-500/[0.05]'
                            : idx % 2 === 0
                              ? 'bg-white/[0.01] hover:bg-white/[0.03]'
                              : 'hover:bg-white/[0.03]'
                        }`}
                      >
                        <td className="px-4 py-2.5">
                          <p className="text-xs font-bold text-white">{os.numero_os_samsung || os.numero_os_interna}</p>
                          {os.numero_os_samsung && (
                            <p className="text-[10px] text-gray-600">{os.numero_os_interna}</p>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <MapPin className="w-3 h-3 text-gray-600 shrink-0" />
                            <span className="text-xs text-gray-400">{unidade?.cidade || '?'}</span>
                            <span className="text-[10px] text-gray-700">&rarr;</span>
                            <span className="text-xs text-white font-medium">{os.cliente_cidade || '?'}</span>
                            {os.cliente_estado && (
                              <span className="text-[10px] text-gray-600">/{os.cliente_estado}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {cache && !cache.erro_calculo ? (
                            <span className="text-xs text-gray-300">{cache.distancia_km.toFixed(1)}</span>
                          ) : cache?.erro_calculo ? (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-500 mx-auto" title={cache.erro_mensagem || 'Erro'} />
                          ) : (
                            <span className="text-[10px] text-gray-700">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-center">
                          {cache && !cache.erro_calculo ? (
                            <span className="text-xs font-medium text-cyan-400">{cache.distancia_km_ida_volta.toFixed(1)}</span>
                          ) : (
                            <span className="text-[10px] text-gray-700">-</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          {cache && !cache.erro_calculo ? (
                            <span className="text-xs text-gray-300">{formatCurrency(cache.receita_calculada)}</span>
                          ) : (
                            <span className="text-[10px] text-gray-700">-</span>
                          )}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={editValue}
                                onChange={e => setEditValue(e.target.value)}
                                className="neon-input w-24 text-xs text-right py-1"
                                autoFocus
                                onKeyDown={e => {
                                  if (e.key === 'Enter') handleSaveKmManual(os.id);
                                  if (e.key === 'Escape') setEditingId(null);
                                }}
                              />
                              <button
                                onClick={() => handleSaveKmManual(os.id)}
                                disabled={savingId === os.id}
                                className="p-1.5 rounded bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 transition-colors"
                              >
                                {savingId === os.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                setEditingId(os.id);
                                setEditValue(os.auditado_km_valor?.toString() || cache?.receita_calculada?.toFixed(2) || '0');
                              }}
                              className={`inline-flex items-center gap-1 text-xs font-medium transition-colors ${
                                hasAuditado
                                  ? 'text-teal-400 hover:text-teal-300'
                                  : 'text-gray-600 hover:text-white'
                              }`}
                            >
                              {hasAuditado ? formatCurrency(os.auditado_km_valor!) : '-'}
                              <Pencil className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
