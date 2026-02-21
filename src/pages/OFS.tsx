import { useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { UnitFilter } from '../components/UnitFilter';
import {
  Upload, Zap, AlertTriangle, TrendingUp, Package,
  RefreshCw, ChevronUp, ChevronDown, CheckCircle2,
  ShieldAlert, Boxes, ArrowRight, DownloadCloud,
} from 'lucide-react';
import { useOFSData, parseOFSCsv } from '../hooks/useOFSData';
import type { CSVRow } from '../hooks/useOFSData';

interface TableRow {
  pn: string;
  descricao: string;
  qtd_estoque: number;
  qtd_em_transito: number;
  giro_60d: number;
  qtd_samsung: number;
  qtd_gia: number;
  qtd_final: number;
  valor_unitario: number;
}

type SortKey = 'pn' | 'giro_60d' | 'qtd_estoque' | 'qtd_samsung' | 'qtd_gia' | 'subtotal';

function fmt(v: number) {
  return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function pct(used: number, total: number) {
  if (!total) return 0;
  return Math.min(100, (used / total) * 100);
}

export function OFS() {
  const { user } = useAuth();
  const [unidades, setUnidades] = useState<Array<{ id: string; nome: string }>>([]);
  const [selectedUnidade, setSelectedUnidade] = useState('');
  const [csvRows, setCsvRows] = useState<CSVRow[]>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [rows, setRows] = useState<TableRow[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>('giro_60d');
  const [sortAsc, setSortAsc] = useState(false);
  const [copied, setCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { estoqueMap, financeiro, loading, error, reload, calcQtdGIA } = useOFSData(selectedUnidade);

  useEffect(() => {
    supabase.from('unidades').select('id, nome').order('nome').then(({ data }) => {
      setUnidades(data || []);
    });
  }, []);

  useEffect(() => {
    if (user?.unidade_id) setSelectedUnidade(user.unidade_id);
  }, [user]);

  useEffect(() => {
    if (!estoqueMap.size && !csvRows.length) {
      setRows([]);
      return;
    }

    const allPNs = new Set<string>([
      ...Array.from(estoqueMap.keys()),
      ...csvRows.map(r => r.pn),
    ]);

    const merged: TableRow[] = Array.from(allPNs).map(pn => {
      const stock = estoqueMap.get(pn);
      const csv = csvRows.find(r => r.pn === pn);
      const qtd_estoque = stock?.qtd_estoque ?? 0;
      const qtd_em_transito = stock?.qtd_em_transito ?? 0;
      const giro_60d = stock?.giro_60d ?? 0;
      const qtd_samsung = csv?.qtd_samsung ?? 0;
      const qtd_gia = calcQtdGIA(giro_60d, qtd_estoque + qtd_em_transito);
      return {
        pn,
        descricao: stock?.descricao || pn,
        qtd_estoque,
        qtd_em_transito,
        giro_60d,
        qtd_samsung,
        qtd_gia,
        qtd_final: qtd_gia,
        valor_unitario: stock?.valor_unitario ?? 0,
      };
    });

    setRows(merged);
  }, [estoqueMap, csvRows, calcQtdGIA]);

  const updateQtdFinal = useCallback((pn: string, val: number) => {
    setRows(prev => prev.map(r => r.pn === pn ? { ...r, qtd_final: Math.max(0, val) } : r));
  }, []);

  const processFile = useCallback((file: File) => {
    if (!file.name.toLowerCase().endsWith('.csv')) {
      alert('Apenas arquivos .CSV sao suportados.');
      return;
    }
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      const content = e.target?.result as string;
      const parsed = parseOFSCsv(content);
      if (!parsed.length) {
        alert('Nenhum PN encontrado no arquivo. Verifique se o CSV possui colunas "PN" e "Qtd".');
        return;
      }
      setCsvRows(parsed);
    };
    reader.readAsText(file, 'UTF-8');
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
    e.target.value = '';
  }, [processFile]);

  const sortedRows = [...rows].sort((a, b) => {
    let av: number | string = 0;
    let bv: number | string = 0;
    if (sortKey === 'pn') { av = a.pn; bv = b.pn; }
    else if (sortKey === 'giro_60d') { av = a.giro_60d; bv = b.giro_60d; }
    else if (sortKey === 'qtd_estoque') { av = a.qtd_estoque; bv = b.qtd_estoque; }
    else if (sortKey === 'qtd_samsung') { av = a.qtd_samsung; bv = b.qtd_samsung; }
    else if (sortKey === 'qtd_gia') { av = a.qtd_gia; bv = b.qtd_gia; }
    else if (sortKey === 'subtotal') { av = a.qtd_final * a.valor_unitario; bv = b.qtd_final * b.valor_unitario; }
    if (typeof av === 'string') return sortAsc ? av.localeCompare(bv as string) : (bv as string).localeCompare(av);
    return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  const custoSamsung = rows.reduce((acc, r) => acc + r.qtd_samsung * r.valor_unitario, 0);
  const custoGIA = rows.reduce((acc, r) => acc + r.qtd_gia * r.valor_unitario, 0);
  const custoFinal = rows.reduce((acc, r) => acc + r.qtd_final * r.valor_unitario, 0);
  const creditoRestante = financeiro.credito_livre - custoFinal;
  const excede = creditoRestante < 0;
  const usadoPct = pct(financeiro.credito_consumido + custoFinal, financeiro.credito_limite);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(a => !a);
    else { setSortKey(key); setSortAsc(false); }
  };

  const handleCopiar = () => {
    const pedido = sortedRows.filter(r => r.qtd_final > 0);
    if (!pedido.length) { alert('Nenhuma peca com quantidade > 0.'); return; }
    const header = 'PN;Descricao;Qtd_Final;Valor_Unit;Subtotal';
    const lines = pedido.map(r =>
      `${r.pn};${r.descricao};${r.qtd_final};${r.valor_unitario.toFixed(2)};${(r.qtd_final * r.valor_unitario).toFixed(2)}`
    );
    navigator.clipboard.writeText([header, ...lines].join('\n')).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  };

  const SortIcon = ({ col }: { col: SortKey }) => (
    <span className="inline-flex flex-col ml-1 opacity-60">
      {sortKey === col
        ? (sortAsc ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)
        : <ChevronDown className="w-3 h-3 opacity-30" />}
    </span>
  );

  const hasCsv = csvRows.length > 0;
  const hasData = rows.length > 0;

  return (
    <div className="min-h-screen bg-[#0f172a] space-y-5 fade-in pb-32">

      {/* BLOCO A: HEADER & IMPORTADOR */}
      <div className="space-y-4">
        <UnitFilter
          unidades={unidades}
          selectedUnidade={selectedUnidade}
          onUnidadeChange={setSelectedUnidade}
        />

        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1
              className="text-2xl font-black tracking-[0.15em] text-[#00D4FF] uppercase"
              style={{ textShadow: '0 0 20px rgba(0,212,255,0.5)' }}
            >
              OFS Gateway
            </h1>
            <p className="text-xs text-slate-500 tracking-widest uppercase mt-0.5">
              Dashboard de Compras Inteligente — GIA x Samsung
            </p>
          </div>
          <button
            onClick={reload}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg border border-[#00D4FF]/30 text-[#00D4FF] text-sm font-semibold hover:bg-[#00D4FF]/10 transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>

        {/* DROP ZONE */}
        <div
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`
            relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all duration-300
            ${isDragging
              ? 'border-[#00D4FF] bg-[#00D4FF]/10 shadow-[0_0_30px_rgba(0,212,255,0.25)]'
              : hasCsv
                ? 'border-emerald-500/50 bg-emerald-500/5 hover:border-emerald-400 hover:bg-emerald-500/10'
                : 'border-slate-600/50 bg-slate-800/30 hover:border-[#00D4FF]/50 hover:bg-[#00D4FF]/5'
            }
          `}
        >
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
          {hasCsv ? (
            <div className="flex items-center justify-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              <div className="text-left">
                <p className="font-bold text-emerald-300 text-sm">{csvFileName}</p>
                <p className="text-xs text-emerald-500">{csvRows.length} PNs importados — clique para trocar</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <DownloadCloud
                className={`w-10 h-10 mx-auto ${isDragging ? 'text-[#00D4FF]' : 'text-slate-500'}`}
                style={isDragging ? { filter: 'drop-shadow(0 0 8px rgba(0,212,255,0.7))' } : {}}
              />
              <p className={`font-semibold text-sm ${isDragging ? 'text-[#00D4FF]' : 'text-slate-400'}`}>
                Arraste a planilha de sugestao diaria OFS (CSV) aqui ou clique para importar
              </p>
              <p className="text-xs text-slate-600">Formato esperado: colunas PN e Qtd (separadas por ; , ou tab)</p>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-400 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* BLOCO B: SIMULADOR FINANCEIRO */}
      {selectedUnidade && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-1">
            <p className="text-xs text-emerald-500 uppercase tracking-widest font-semibold">Credito Livre</p>
            <p className="text-xl font-black text-emerald-300" style={{ textShadow: '0 0 12px rgba(52,211,153,0.4)' }}>
              {fmt(financeiro.credito_livre)}
            </p>
            <p className="text-xs text-slate-500">Limite: {fmt(financeiro.credito_limite)}</p>
          </div>

          <div className="rounded-xl border border-slate-600/40 bg-slate-800/30 p-4 space-y-1">
            <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold flex items-center gap-1">
              <Package className="w-3 h-3" /> Pedido Samsung
            </p>
            <p className="text-xl font-black text-slate-200">
              {hasCsv ? fmt(custoSamsung) : '—'}
            </p>
            <p className="text-xs text-slate-600">100% arquivo CSV</p>
          </div>

          <div className="rounded-xl border border-[#00D4FF]/30 bg-[#00D4FF]/5 p-4 space-y-1">
            <p className="text-xs text-[#00D4FF] uppercase tracking-widest font-semibold flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> Pedido GIA
            </p>
            <p className="text-xl font-black text-[#00D4FF]" style={{ textShadow: '0 0 12px rgba(0,212,255,0.4)' }}>
              {hasData ? fmt(custoGIA) : '—'}
            </p>
            <p className="text-xs text-slate-600">Otimizado por IA</p>
          </div>

          <div className={`rounded-xl border p-4 space-y-2 ${excede ? 'border-red-500/50 bg-red-500/10' : 'border-slate-600/40 bg-slate-800/30'}`}>
            <p className={`text-xs uppercase tracking-widest font-semibold flex items-center gap-1 ${excede ? 'text-red-400' : 'text-slate-400'}`}>
              {excede ? <ShieldAlert className="w-3 h-3" /> : <Boxes className="w-3 h-3" />}
              Credito Restante
            </p>
            <p className={`text-xl font-black ${excede ? 'text-red-400' : 'text-slate-200'}`}>
              {hasData ? fmt(creditoRestante) : '—'}
            </p>
            {hasData && (
              <>
                <div className="w-full h-2 rounded-full bg-slate-700 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${excede ? 'bg-red-500 animate-pulse' : usadoPct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, usadoPct)}%` }}
                  />
                </div>
                {excede && (
                  <p className="text-xs text-red-400 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Alerta GIA: Pedido excede limite de seguranca!
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* BLOCO C: TABELA DE DECISAO */}
      {loading && (
        <div className="flex items-center justify-center py-20 gap-3 text-[#00D4FF]">
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-sm tracking-widest uppercase">Carregando dados...</span>
        </div>
      )}

      {!loading && !hasData && !hasCsv && selectedUnidade && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 p-12 text-center space-y-3">
          <Upload className="w-12 h-12 text-slate-600 mx-auto" />
          <p className="text-slate-400 font-semibold">Importe a planilha CSV da Samsung para iniciar a analise</p>
          <p className="text-xs text-slate-600">Os dados de estoque e giro da unidade ja estao carregados</p>
        </div>
      )}

      {!loading && !selectedUnidade && (
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/20 p-12 text-center space-y-3">
          <Boxes className="w-12 h-12 text-slate-600 mx-auto" />
          <p className="text-slate-400 font-semibold">Selecione uma unidade para comecar</p>
        </div>
      )}

      {!loading && hasData && (
        <div className="rounded-xl border border-slate-700/40 bg-slate-800/20 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700/40 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#00D4FF]" />
              <span className="text-sm font-bold text-slate-200 tracking-wide uppercase">Tabela de Decisao</span>
              <span className="text-xs text-slate-500 bg-slate-700/50 px-2 py-0.5 rounded-full">{rows.length} PNs</span>
            </div>
            {hasCsv && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                Samsung
                <ArrowRight className="w-3 h-3 mx-1" />
                <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                GIA
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-700/40 bg-slate-800/40">
                  <th
                    className="text-left px-4 py-3 text-slate-400 uppercase tracking-wider font-semibold cursor-pointer hover:text-[#00D4FF] whitespace-nowrap"
                    onClick={() => handleSort('pn')}
                  >
                    PN / Descricao <SortIcon col="pn" />
                  </th>
                  <th
                    className="text-center px-3 py-3 text-slate-400 uppercase tracking-wider font-semibold cursor-pointer hover:text-[#00D4FF] whitespace-nowrap"
                    onClick={() => handleSort('qtd_estoque')}
                  >
                    Estoque + Transito <SortIcon col="qtd_estoque" />
                  </th>
                  <th
                    className="text-center px-3 py-3 text-slate-400 uppercase tracking-wider font-semibold cursor-pointer hover:text-[#00D4FF] whitespace-nowrap"
                    onClick={() => handleSort('giro_60d')}
                  >
                    Giro 60d <SortIcon col="giro_60d" />
                  </th>
                  <th className="text-center px-3 py-3 text-slate-400 uppercase tracking-wider font-semibold whitespace-nowrap">
                    Recomendacao
                  </th>
                  <th className="text-center px-3 py-3 text-slate-400 uppercase tracking-wider font-semibold whitespace-nowrap">
                    Decisao Final
                  </th>
                  <th
                    className="text-right px-4 py-3 text-slate-400 uppercase tracking-wider font-semibold cursor-pointer hover:text-[#00D4FF] whitespace-nowrap"
                    onClick={() => handleSort('subtotal')}
                  >
                    Subtotal <SortIcon col="subtotal" />
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((row, idx) => {
                  const subtotal = row.qtd_final * row.valor_unitario;
                  return (
                    <tr
                      key={row.pn}
                      className={`border-b border-slate-700/20 transition-colors hover:bg-slate-700/20 ${idx % 2 === 0 ? 'bg-slate-800/10' : ''}`}
                    >
                      <td className="px-4 py-3">
                        <p className="font-mono font-bold text-[#00D4FF] text-xs tracking-wider">{row.pn}</p>
                        <p className="text-slate-400 text-xs mt-0.5 max-w-[200px] truncate" title={row.descricao}>{row.descricao}</p>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className="font-bold text-slate-200">{row.qtd_estoque}</span>
                          {row.qtd_em_transito > 0 && (
                            <span className="text-amber-400 text-xs">+{row.qtd_em_transito}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`font-bold ${row.giro_60d > 0 ? 'text-emerald-400' : 'text-slate-600'}`}>
                          {row.giro_60d}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {row.qtd_samsung > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-900/60 border border-blue-500/40 text-blue-300 whitespace-nowrap">
                              SAM: {row.qtd_samsung}
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${
                              row.qtd_gia > 0
                                ? 'bg-emerald-900/60 border border-emerald-400/40 text-emerald-300'
                                : 'bg-slate-700/50 border border-slate-600/40 text-slate-500'
                            }`}
                            style={row.qtd_gia > 0 ? { textShadow: '0 0 6px rgba(52,211,153,0.5)' } : {}}
                          >
                            GIA: {row.qtd_gia}
                          </span>
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <input
                          type="number"
                          min={0}
                          value={row.qtd_final}
                          onChange={(e) => updateQtdFinal(row.pn, parseInt(e.target.value, 10) || 0)}
                          className="w-16 text-center bg-slate-700/60 border border-slate-600/50 rounded-lg px-2 py-1.5 text-white font-bold text-sm focus:outline-none focus:border-[#00D4FF]/60 focus:bg-slate-700 transition-all"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold ${subtotal > 0 ? 'text-slate-200' : 'text-slate-600'}`}>
                          {subtotal > 0 ? fmt(subtotal) : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-600/50 bg-slate-800/50">
                  <td colSpan={5} className="px-4 py-3 text-right text-sm font-bold text-slate-300 uppercase tracking-wider">
                    Total do Pedido
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`text-base font-black ${excede ? 'text-red-400' : 'text-emerald-400'}`}
                      style={excede ? {} : { textShadow: '0 0 10px rgba(52,211,153,0.4)' }}
                    >
                      {fmt(custoFinal)}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* BOTAO FIXO */}
      {hasData && (
        <div className="fixed bottom-6 right-6 z-50">
          <button
            onClick={handleCopiar}
            className={`
              flex items-center gap-3 px-6 py-4 rounded-xl font-black text-sm uppercase tracking-widest
              transition-all duration-300 shadow-2xl
              ${copied
                ? 'bg-emerald-600 border border-emerald-400 text-white shadow-emerald-500/30'
                : excede
                  ? 'bg-red-600/90 border border-red-400 text-white shadow-red-500/30 hover:bg-red-500'
                  : 'bg-[#00D4FF] border border-[#00D4FF] text-[#0f172a] hover:shadow-[0_0_30px_rgba(0,212,255,0.5)]'
              }
            `}
            style={!copied && !excede ? { boxShadow: '0 0 20px rgba(0,212,255,0.35)' } : {}}
          >
            {copied ? (
              <>
                <CheckCircle2 className="w-5 h-5" />
                Copiado para Clipboard!
              </>
            ) : (
              <>
                <Zap className="w-5 h-5" />
                Gerar OFS Confirmada (Copiar PNs)
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
