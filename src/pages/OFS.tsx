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
  const { user, allUserUnits } = useAuth();
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

  const { estoqueMap, financeiro, loading, error, reload, calcQtdGIA } = useOFSData(selectedUnidade, allUserUnits);

  useEffect(() => {
    supabase.from('unidades').select('id, nome').order('nome').then(({ data }) => {
      setUnidades(data || []);
    });
  }, []);

  useEffect(() => {
    if (user?.unidade_id && allUserUnits.length <= 1) {
      setSelectedUnidade(user.unidade_id);
    }
  }, [user, allUserUnits]);

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
    <div className="min-h-screen space-y-5 fade-in pb-32" style={{ background: 'var(--bg-primary)' }}>

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
              className="text-2xl font-black tracking-[0.15em] uppercase"
              style={{ color: 'var(--text-accent)' }}
            >
              OFS Gateway
            </h1>
            <p className="text-xs tracking-widest uppercase mt-0.5" style={{ color: 'var(--text-secondary)' }}>
              Dashboard de Compras Inteligente — GIA x Samsung
            </p>
          </div>
          <button
            onClick={reload}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all disabled:opacity-50"
            style={{
              border: '1px solid var(--border-accent)',
              color: 'var(--text-accent)',
              background: 'transparent',
            }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
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
          className="relative cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all duration-300"
          style={
            isDragging
              ? { borderColor: 'var(--text-accent)', background: 'var(--bg-hover)', boxShadow: '0 0 24px rgba(var(--accent-rgb),0.2)' }
              : hasCsv
                ? { borderColor: 'rgba(34,197,94,0.5)', background: 'rgba(34,197,94,0.05)' }
                : { borderColor: 'var(--border-primary)', background: 'var(--bg-secondary)' }
          }
        >
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={handleFileChange} />
          {hasCsv ? (
            <div className="flex items-center justify-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-500" />
              <div className="text-left">
                <p className="font-bold text-emerald-600 text-sm">{csvFileName}</p>
                <p className="text-xs text-emerald-500">{csvRows.length} PNs importados — clique para trocar</p>
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <DownloadCloud
                className="w-10 h-10 mx-auto"
                style={{ color: isDragging ? 'var(--text-accent)' : 'var(--text-secondary)' }}
              />
              <p className="font-semibold text-sm" style={{ color: isDragging ? 'var(--text-accent)' : 'var(--text-primary)' }}>
                Arraste a planilha de sugestao diaria OFS (CSV) aqui ou clique para importar
              </p>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Formato esperado: colunas PN e Qtd (separadas por ; , ou tab)</p>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-500 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {/* BLOCO B: SIMULADOR FINANCEIRO */}
      {selectedUnidade && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">

          <div
            className="rounded-xl p-4 space-y-1"
            style={{
              border: '1px solid rgba(34,197,94,0.3)',
              background: 'rgba(34,197,94,0.05)',
            }}
          >
            <p className="text-xs text-emerald-600 uppercase tracking-widest font-semibold">Credito Livre</p>
            <p className="text-xl font-black text-emerald-600">
              {fmt(financeiro.credito_livre)}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Limite: {fmt(financeiro.credito_limite)}</p>
          </div>

          <div
            className="rounded-xl p-4 space-y-1"
            style={{
              border: '1px solid var(--border-primary)',
              background: 'var(--bg-card)',
            }}
          >
            <p className="text-xs uppercase tracking-widest font-semibold flex items-center gap-1" style={{ color: 'var(--text-secondary)' }}>
              <Package className="w-3 h-3" /> Pedido Samsung
            </p>
            <p className="text-xl font-black" style={{ color: 'var(--text-primary)' }}>
              {hasCsv ? fmt(custoSamsung) : '—'}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>100% arquivo CSV</p>
          </div>

          <div
            className="rounded-xl p-4 space-y-1"
            style={{
              border: '1px solid var(--border-accent)',
              background: 'var(--bg-hover)',
            }}
          >
            <p className="text-xs uppercase tracking-widest font-semibold flex items-center gap-1" style={{ color: 'var(--text-accent)' }}>
              <TrendingUp className="w-3 h-3" /> Pedido GIA
            </p>
            <p className="text-xl font-black" style={{ color: 'var(--text-accent)' }}>
              {hasData ? fmt(custoGIA) : '—'}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Otimizado por IA</p>
          </div>

          <div
            className="rounded-xl p-4 space-y-2"
            style={
              excede
                ? { border: '1px solid rgba(239,68,68,0.5)', background: 'rgba(239,68,68,0.07)' }
                : { border: '1px solid var(--border-primary)', background: 'var(--bg-card)' }
            }
          >
            <p
              className="text-xs uppercase tracking-widest font-semibold flex items-center gap-1"
              style={{ color: excede ? '#ef4444' : 'var(--text-secondary)' }}
            >
              {excede ? <ShieldAlert className="w-3 h-3" /> : <Boxes className="w-3 h-3" />}
              Credito Restante
            </p>
            <p
              className="text-xl font-black"
              style={{ color: excede ? '#ef4444' : 'var(--text-primary)' }}
            >
              {hasData ? fmt(creditoRestante) : '—'}
            </p>
            {hasData && (
              <>
                <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: 'var(--progress-track)' }}>
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${excede ? 'bg-red-500 animate-pulse' : usadoPct > 80 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.min(100, usadoPct)}%` }}
                  />
                </div>
                {excede && (
                  <p className="text-xs text-red-500 font-bold flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Alerta GIA: Pedido excede limite de seguranca!
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* BLOCO C: ESTADOS VAZIOS */}
      {loading && (
        <div className="flex items-center justify-center py-20 gap-3" style={{ color: 'var(--text-accent)' }}>
          <RefreshCw className="w-5 h-5 animate-spin" />
          <span className="text-sm tracking-widest uppercase">Carregando dados...</span>
        </div>
      )}

      {!loading && !hasData && !hasCsv && selectedUnidade && (
        <div
          className="rounded-xl p-12 text-center space-y-3"
          style={{ border: '1px solid var(--border-primary)', background: 'var(--bg-card)' }}
        >
          <Upload className="w-12 h-12 mx-auto" style={{ color: 'var(--text-secondary)' }} />
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Importe a planilha CSV da Samsung para iniciar a analise</p>
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>Os dados de estoque e giro da unidade ja estao carregados</p>
        </div>
      )}

      {!loading && !selectedUnidade && (
        <div
          className="rounded-xl p-12 text-center space-y-3"
          style={{ border: '1px solid var(--border-primary)', background: 'var(--bg-card)' }}
        >
          <Boxes className="w-12 h-12 mx-auto" style={{ color: 'var(--text-secondary)' }} />
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>Selecione uma unidade para comecar</p>
        </div>
      )}

      {/* BLOCO D: TABELA DE DECISAO */}
      {!loading && hasData && (
        <div
          className="rounded-xl overflow-hidden"
          style={{ border: '1px solid var(--border-primary)', background: 'var(--bg-card)' }}
        >
          <div
            className="px-4 py-3 flex items-center justify-between gap-3 flex-wrap"
            style={{ borderBottom: '1px solid var(--border-primary)' }}
          >
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4" style={{ color: 'var(--text-accent)' }} />
              <span className="text-sm font-bold tracking-wide uppercase" style={{ color: 'var(--text-primary)' }}>Tabela de Decisao</span>
              <span
                className="text-xs px-2 py-0.5 rounded-full"
                style={{
                  color: 'var(--text-secondary)',
                  background: 'var(--bg-secondary)',
                  border: '1px solid var(--border-primary)',
                }}
              >
                {rows.length} PNs
              </span>
            </div>
            {hasCsv && (
              <div className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
                <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
                Samsung
                <ArrowRight className="w-3 h-3 mx-1" />
                <span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" />
                GIA
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-primary)', background: 'var(--bg-secondary)' }}>
                  <th
                    className="text-left px-4 py-3 uppercase tracking-wider font-semibold cursor-pointer whitespace-nowrap transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    onClick={() => handleSort('pn')}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-accent)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'}
                  >
                    PN / Descricao <SortIcon col="pn" />
                  </th>
                  <th
                    className="text-center px-3 py-3 uppercase tracking-wider font-semibold cursor-pointer whitespace-nowrap transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    onClick={() => handleSort('qtd_estoque')}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-accent)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'}
                  >
                    Estoque + Transito <SortIcon col="qtd_estoque" />
                  </th>
                  <th
                    className="text-center px-3 py-3 uppercase tracking-wider font-semibold cursor-pointer whitespace-nowrap transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    onClick={() => handleSort('giro_60d')}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-accent)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'}
                  >
                    Giro 60d <SortIcon col="giro_60d" />
                  </th>
                  <th className="text-center px-3 py-3 uppercase tracking-wider font-semibold whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                    Recomendacao
                  </th>
                  <th className="text-center px-3 py-3 uppercase tracking-wider font-semibold whitespace-nowrap" style={{ color: 'var(--text-secondary)' }}>
                    Decisao Final
                  </th>
                  <th
                    className="text-right px-4 py-3 uppercase tracking-wider font-semibold cursor-pointer whitespace-nowrap transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    onClick={() => handleSort('subtotal')}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-accent)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--text-secondary)'}
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
                      className="transition-colors"
                      style={{
                        borderBottom: '1px solid var(--border-primary)',
                        background: idx % 2 === 0 ? 'transparent' : 'var(--bg-secondary)',
                      }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = idx % 2 === 0 ? 'transparent' : 'var(--bg-secondary)'}
                    >
                      <td className="px-4 py-3">
                        <p className="font-mono font-bold text-xs tracking-wider" style={{ color: 'var(--text-accent)' }}>{row.pn}</p>
                        <p className="text-xs mt-0.5 max-w-[200px] truncate" style={{ color: 'var(--text-secondary)' }} title={row.descricao}>{row.descricao}</p>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{row.qtd_estoque}</span>
                          {row.qtd_em_transito > 0 && (
                            <span className="text-amber-500 text-xs">+{row.qtd_em_transito}</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span className={`font-bold ${row.giro_60d > 0 ? 'text-emerald-600' : ''}`} style={row.giro_60d === 0 ? { color: 'var(--text-secondary)' } : {}}>
                          {row.giro_60d}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center justify-center gap-1 flex-wrap">
                          {row.qtd_samsung > 0 && (
                            <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-blue-500/10 border border-blue-500/30 text-blue-600 whitespace-nowrap">
                              SAM: {row.qtd_samsung}
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-bold whitespace-nowrap ${
                              row.qtd_gia > 0
                                ? 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-600'
                                : 'border'
                            }`}
                            style={row.qtd_gia === 0 ? { borderColor: 'var(--border-primary)', color: 'var(--text-secondary)', background: 'transparent' } : {}}
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
                          className="w-16 text-center rounded-lg px-2 py-1.5 font-bold text-sm focus:outline-none transition-all"
                          style={{
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--border-primary)',
                            color: 'var(--text-primary)',
                          }}
                          onFocus={e => {
                            e.currentTarget.style.borderColor = 'var(--border-accent)';
                            e.currentTarget.style.background = 'var(--bg-hover)';
                          }}
                          onBlur={e => {
                            e.currentTarget.style.borderColor = 'var(--border-primary)';
                            e.currentTarget.style.background = 'var(--bg-secondary)';
                          }}
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-bold ${subtotal > 0 ? '' : ''}`} style={{ color: subtotal > 0 ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                          {subtotal > 0 ? fmt(subtotal) : '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border-accent)', background: 'var(--bg-secondary)' }}>
                  <td colSpan={5} className="px-4 py-3 text-right text-sm font-bold uppercase tracking-wider" style={{ color: 'var(--text-primary)' }}>
                    Total do Pedido
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className={`text-base font-black ${excede ? 'text-red-500' : 'text-emerald-600'}`}
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
                ? 'bg-emerald-600 border border-emerald-400 text-white'
                : excede
                  ? 'bg-red-600 border border-red-400 text-white hover:bg-red-500'
                  : ''
              }
            `}
            style={
              !copied && !excede
                ? {
                    background: 'var(--text-accent)',
                    border: '1px solid var(--border-accent)',
                    color: 'var(--text-on-accent)',
                    boxShadow: '0 0 20px rgba(var(--accent-rgb),0.35)',
                  }
                : {}
            }
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
