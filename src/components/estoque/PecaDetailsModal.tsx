import { createPortal } from 'react-dom';
import { useState, useEffect } from 'react';
import { X, MapPin, Printer, Package, History, Link, Truck, AlertCircle, CheckCircle, Receipt } from 'lucide-react';
import { useTheme } from '../../contexts/ThemeContext';
import { supabase } from '../../lib/supabase';
import { LabelGenerator } from './LabelGenerator';

interface Peca {
  id: string;
  pn: string;
  part_number: string;
  descricao: string | null;
  status: string;
  valor_com_impostos: number;
  condicao: string;
  nf_delivery: string | null;
  localizacao: string | null;
  id_numerico: number | null;
  unidade_id: string;
  os_id?: string | null;
  data_coleta_transportadora?: string | null;
  data_retorno_credito?: string | null;
}

interface PecaDetalhada extends Peca {
  nf: { numero_nf: string; fornecedor: string } | null;
  os: { numero_os_interna: string; numero_os_samsung: string | null } | null;
}

interface PecaDetailsModalProps {
  peca: Peca;
  onClose: () => void;
  onShowLabelSelector: () => void;
  onShowLocationSelector: (localizacoes: any[]) => void;
}

interface LabelData {
  id_sequencial: string;
  codigo_barras: string;
  data_emissao: string;
  part_number: string;
  descricao?: string;
  delivery?: string;
  localizacao?: string;
  nf_numero?: string;
  tecnico_nome?: string;
  os_numero?: string;
  os_samsung?: string;
}

interface HistoricoItem {
  id: string;
  acao: string;
  status_anterior: string | null;
  status_novo: string | null;
  origem: string | null;
  destino: string | null;
  observacao: string | null;
  created_at: string;
  usuario: { nome: string } | null;
}

const getStatusColors = (neonGreen: string, themeAccent: string): Record<string, { label: string; color: string }> => ({
  disponivel: { label: 'Disponivel', color: neonGreen },
  reservada: { label: 'Reservada', color: '#FFBF00' },
  vinculada_tecnico: { label: 'Com Tecnico', color: themeAccent },
  em_rota: { label: 'Em Rota', color: themeAccent },
  em_uso: { label: 'Em Uso', color: '#FFBF00' },
  usada: { label: 'Usada', color: '#6B7280' },
  devolucao_pendente: { label: 'Devolucao Pendente', color: '#FF0064' },
  devolvida_nova: { label: 'Devolvida Nova', color: neonGreen },
  devolvida_defeito: { label: 'Devolvida c/ Defeito', color: '#FF0064' },
  devolvida_samsung: { label: 'Devolvida Samsung', color: '#60a5fa' },
  usada_upc: { label: 'Usada UPC', color: '#6B7280' },
});

export function PecaDetailsModal({ peca, onClose, onShowLabelSelector, onShowLocationSelector }: PecaDetailsModalProps) {
  const { isDark, themeInfo } = useTheme();
  const [generatingLabel, setGeneratingLabel] = useState(false);
  const [showLabelGenerator, setShowLabelGenerator] = useState(false);
  const [labelData, setLabelData] = useState<LabelData[]>([]);
  const [pecaDetalhada, setPecaDetalhada] = useState<PecaDetalhada | null>(null);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(true);

  const [dataColeta, setDataColeta] = useState('');
  const [dataCredito, setDataCredito] = useState('');
  const [salvandoColeta, setSalvandoColeta] = useState(false);
  const [salvandoCredito, setSalvandoCredito] = useState(false);

  const [localColeta, setLocalColeta] = useState<string | null>(peca.data_coleta_transportadora || null);
  const [localCredito, setLocalCredito] = useState<string | null>(peca.data_retorno_credito || null);

  const neonGreen = themeInfo.neonGreen;
  const themeAccent = themeInfo.accent;
  const modalBg = isDark ? themeInfo.bg : '#ffffff';
  const cardBg = isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)';
  const cardBorder = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.10)';
  const textPrimary = isDark ? '#ffffff' : '#0f172a';
  const textSecondary = isDark ? '#d1d5db' : '#374151';
  const textMuted = isDark ? '#6b7280' : '#9ca3af';
  const labelColor = isDark ? '#6b7280' : '#6b7280';
  const accentCyan = themeAccent;
  const borderGreen = isDark ? `${neonGreen}33` : 'rgba(21,128,61,0.25)';
  const headerBorder = isDark ? `${neonGreen}26` : 'rgba(21,128,61,0.15)';

  useEffect(() => {
    loadDetalhes();
  }, [peca.id]);

  const loadDetalhes = async () => {
    setLoadingHistorico(true);
    try {
      const [detRes, histRes] = await Promise.all([
        supabase
          .from('estoque_pecas')
          .select('*, nf:nf_id(numero_nf, fornecedor), os:os_id(numero_os_interna, numero_os_samsung)')
          .eq('id', peca.id)
          .maybeSingle(),
        supabase
          .from('estoque_historico')
          .select('id, acao, status_anterior, status_novo, origem, destino, observacao, created_at, usuario:usuario_id(nome)')
          .eq('peca_id', peca.id)
          .order('created_at', { ascending: false })
          .limit(30),
      ]);

      if (detRes.data) {
        const det = detRes.data as unknown as PecaDetalhada;
        setPecaDetalhada(det);
        setLocalColeta((det as any).data_coleta_transportadora || null);
        setLocalCredito((det as any).data_retorno_credito || null);
      }
      setHistorico((histRes.data || []) as unknown as HistoricoItem[]);
    } finally {
      setLoadingHistorico(false);
    }
  };

  const handleRegistrarColeta = async () => {
    if (!dataColeta) return;
    setSalvandoColeta(true);
    try {
      const isoDate = new Date(dataColeta + 'T12:00:00').toISOString();
      await supabase
        .from('estoque_pecas')
        .update({ data_coleta_transportadora: isoDate })
        .eq('id', peca.id);

      await supabase.from('estoque_historico').insert({
        peca_id: peca.id,
        acao: 'Coleta Registrada',
        status_anterior: 'devolvida_samsung',
        status_novo: 'devolvida_samsung',
        observacao: `Data de coleta pela transportadora registrada: ${new Date(isoDate).toLocaleDateString('pt-BR')}`,
      });

      setLocalColeta(isoDate);
      setDataColeta('');
      await loadDetalhes();
    } catch {
      alert('Erro ao registrar coleta');
    } finally {
      setSalvandoColeta(false);
    }
  };

  const handleConfirmarCredito = async () => {
    if (!dataCredito) return;
    setSalvandoCredito(true);
    try {
      const isoDate = new Date(dataCredito + 'T12:00:00').toISOString();
      await supabase
        .from('estoque_pecas')
        .update({ data_retorno_credito: isoDate })
        .eq('id', peca.id);

      await supabase.from('estoque_historico').insert({
        peca_id: peca.id,
        acao: 'Crédito GSPN Confirmado',
        status_anterior: 'devolvida_samsung',
        status_novo: 'devolvida_samsung',
        observacao: `Crédito confirmado no GSPN em: ${new Date(isoDate).toLocaleDateString('pt-BR')}`,
      });

      setLocalCredito(isoDate);
      setDataCredito('');
      await loadDetalhes();
    } catch {
      alert('Erro ao confirmar crédito');
    } finally {
      setSalvandoCredito(false);
    }
  };

  const calcularSLA = (coleta: string, credito: string) => {
    const d1 = new Date(coleta);
    const d2 = new Date(credito);
    const diffMs = d2.getTime() - d1.getTime();
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
  };

  const handleAlterarLocalizacao = async () => {
    const { data } = await supabase
      .rpc('listar_localizacoes_pn', { pn_busca: peca.pn });
    onShowLocationSelector(data || []);
  };

  const handleGerarEtiqueta = async () => {
    setGeneratingLabel(true);
    try {
      const { data: pecaCompleta, error } = await supabase
        .from('estoque_pecas')
        .select(`
          *,
          nf:estoque_nfs(numero_nf, data_emissao, delivery),
          requisicoes:requisicoes_pecas(os:os(numero_os_interna, numero_os_samsung))
        `)
        .eq('id', peca.id)
        .maybeSingle();

      if (error) throw error;

      let osNumero = pecaCompleta?.requisicoes?.[0]?.os?.numero_os_interna || null;
      let osSamsung = pecaCompleta?.requisicoes?.[0]?.os?.numero_os_samsung || null;

      if (!osNumero && pecaDetalhada?.os) {
        osNumero = pecaDetalhada.os.numero_os_interna;
        osSamsung = pecaDetalhada.os.numero_os_samsung;
      }

      if (!osNumero) {
        const { data: osPeca } = await supabase
          .from('os_pecas')
          .select('os:os(numero_os_interna, numero_os_samsung)')
          .eq('estoque_peca_id', peca.id)
          .maybeSingle();

        osNumero = osPeca?.os?.numero_os_interna || null;
        osSamsung = osPeca?.os?.numero_os_samsung || null;
      }

      const barcodeValue = peca.id_numerico?.toString().padStart(8, '0') || peca.pn;

      const label: LabelData = {
        id_sequencial: `#${peca.id_numerico || 'N/A'}`,
        codigo_barras: barcodeValue,
        data_emissao: pecaCompleta?.nf?.data_emissao || new Date().toISOString(),
        part_number: peca.pn,
        descricao: peca.descricao || undefined,
        delivery: pecaCompleta?.nf?.delivery || peca.nf_delivery || undefined,
        localizacao: peca.localizacao || undefined,
        nf_numero: pecaCompleta?.nf?.numero_nf || undefined,
        os_numero: osNumero || undefined,
        os_samsung: osSamsung || undefined
      };

      setLabelData([label]);
      setShowLabelGenerator(true);
    } catch (error: any) {
      alert(`Erro ao preparar etiqueta: ${error.message}`);
    } finally {
      setGeneratingLabel(false);
    }
  };

  const LOGISTICA_REVERSA_STATUSES = ['devolvida_samsung', 'devolvida_nova', 'devolvida_defeito'];
  const STATUS_COLORS = getStatusColors(neonGreen, themeAccent);

  const currentStatus = (pecaDetalhada as any)?.status || peca.status;
  const statusCfg = STATUS_COLORS[currentStatus] || { label: currentStatus, color: '#6B7280' };
  const osVinculada = pecaDetalhada?.os;
  const osLabel = osVinculada
    ? (osVinculada.numero_os_samsung || osVinculada.numero_os_interna)
    : null;

  const isSamsungReturn = LOGISTICA_REVERSA_STATUSES.includes(currentStatus);
  const slaValido = localColeta && localCredito;
  const slaDias = slaValido ? calcularSLA(localColeta!, localCredito!) : null;

  const modalContent = (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: isDark ? 'rgba(0,0,0,0.80)' : 'rgba(0,0,0,0.50)', backdropFilter: 'blur(8px)' }}>
      <div
        className="w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden rounded-xl"
        style={{
          background: modalBg,
          border: `1px solid ${borderGreen}`,
          boxShadow: isDark ? `0 0 40px rgba(57,255,20,0.1)` : `0 0 30px rgba(0,0,0,0.15)`,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 shrink-0" style={{ borderBottom: `1px solid ${headerBorder}` }}>
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5" style={{ color: neonGreen }} />
            <h2 className="text-lg font-bold tracking-wide uppercase" style={{ color: neonGreen }}>
              Detalhes da Peca
            </h2>
            <span
              className="px-2 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider"
              style={{
                background: `${statusCfg.color}20`,
                color: statusCfg.color,
                border: `1px solid ${statusCfg.color}60`,
              }}
            >
              {statusCfg.label}
            </span>
          </div>
          <button
            onClick={onClose}
            className={`p-2 rounded-lg transition-colors ${isDark ? 'hover:bg-white/5' : 'hover:bg-black/5'}`}
          >
            <X className="w-5 h-5" style={{ color: textMuted }} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto cyber-scrollbar p-6 space-y-5">

          {/* OS Alocada highlight */}
          {osLabel && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{
                background: isDark ? 'rgba(57,255,20,0.07)' : 'rgba(21,128,61,0.08)',
                border: isDark ? '1px solid rgba(57,255,20,0.35)' : '1px solid rgba(21,128,61,0.30)',
              }}
            >
              <Link className="w-4 h-4 shrink-0" style={{ color: neonGreen }} />
              <div>
                <p className="text-xs uppercase tracking-wider font-bold" style={{ color: isDark ? 'rgba(57,255,20,0.70)' : 'rgba(21,128,61,0.80)' }}>OS Alocada</p>
                <p className="font-bold font-mono text-base" style={{ color: neonGreen }}>{osLabel}</p>
              </div>
            </div>
          )}

          {/* Main details grid */}
          <div
            className="rounded-xl p-5"
            style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
          >
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: labelColor }}>ID Unico</p>
                <p className="font-bold text-2xl font-mono" style={{ color: neonGreen }}>#{peca.id_numerico || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: labelColor }}>Part Number</p>
                <p className="font-mono font-bold" style={{ color: textPrimary }}>{peca.pn}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: labelColor }}>Descricao</p>
                <p style={{ color: textSecondary }}>{peca.descricao || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: labelColor }}>Valor c/ Impostos</p>
                <p className="font-bold" style={{ color: neonGreen }}>
                  R$ {peca.valor_com_impostos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wider mb-1" style={{ color: labelColor }}>Condicao</p>
                <p className="capitalize" style={{ color: textSecondary }}>{peca.condicao}</p>
              </div>
              {pecaDetalhada?.nf && (
                <div>
                  <p className="text-xs uppercase tracking-wider mb-1" style={{ color: labelColor }}>Nota Fiscal</p>
                  <p className="font-mono font-bold" style={{ color: accentCyan }}>{pecaDetalhada.nf.numero_nf}</p>
                </div>
              )}
              {pecaDetalhada?.nf?.fornecedor && (
                <div>
                  <p className="text-xs uppercase tracking-wider mb-1" style={{ color: labelColor }}>Fornecedor</p>
                  <p className="text-sm" style={{ color: textSecondary }}>{pecaDetalhada.nf.fornecedor}</p>
                </div>
              )}
              {peca.nf_delivery && (
                <div className="col-span-2">
                  <p className="text-xs uppercase tracking-wider mb-1" style={{ color: labelColor }}>Delivery</p>
                  <p className="font-bold text-lg" style={{ color: accentCyan }}>{peca.nf_delivery}</p>
                </div>
              )}
            </div>
          </div>

          {/* Impostos da NF */}
          {pecaDetalhada && (() => {
            const d = pecaDetalhada as any;
            const hasTax = d.valor_unitario_sem_imposto || d.icms_valor || d.ipi_valor || d.icms_st_valor || d.pis_valor || d.cofins_valor;
            if (!hasTax) return null;
            const fmt = (v: number | null) => v != null ? `R$ ${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-';
            const pct = (v: number | null) => v != null ? `${Number(v).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}%` : '-';
            const rows: { label: string; valor: number | null; aliquota: number | null }[] = [];
            if (d.icms_valor || d.icms_aliquota) rows.push({ label: 'ICMS', valor: d.icms_valor, aliquota: d.icms_aliquota });
            if (d.icms_st_valor || d.icms_st_aliquota) rows.push({ label: 'ICMS ST', valor: d.icms_st_valor, aliquota: d.icms_st_aliquota });
            if (d.ipi_valor || d.ipi_aliquota) rows.push({ label: 'IPI', valor: d.ipi_valor, aliquota: d.ipi_aliquota });
            if (d.pis_valor || d.pis_aliquota) rows.push({ label: 'PIS', valor: d.pis_valor, aliquota: d.pis_aliquota });
            if (d.cofins_valor || d.cofins_aliquota) rows.push({ label: 'COFINS', valor: d.cofins_valor, aliquota: d.cofins_aliquota });
            return (
              <div className="rounded-xl p-5" style={{ background: cardBg, border: `1px solid ${cardBorder}` }}>
                <div className="flex items-center gap-2 mb-4">
                  <Receipt className="w-4 h-4" style={{ color: '#FFBF00' }} />
                  <h3 className="text-xs font-bold uppercase tracking-wider" style={{ color: '#FFBF00' }}>Impostos da NF (por unidade)</h3>
                </div>
                {d.valor_unitario_sem_imposto != null && (
                  <div className="flex items-center justify-between mb-3 pb-3" style={{ borderBottom: `1px solid ${cardBorder}` }}>
                    <span className="text-xs uppercase tracking-wider" style={{ color: labelColor }}>Valor s/ Impostos (vUnCom)</span>
                    <span className="font-mono font-bold text-sm" style={{ color: textPrimary }}>{fmt(d.valor_unitario_sem_imposto)}</span>
                  </div>
                )}
                <div className="space-y-2">
                  {rows.map(r => (
                    <div key={r.label} className="flex items-center justify-between py-1.5 px-3 rounded-lg" style={{ background: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)' }}>
                      <span className="text-xs font-bold uppercase tracking-wider" style={{ color: textSecondary }}>{r.label}</span>
                      <div className="flex items-center gap-4">
                        <span className="text-xs" style={{ color: textMuted }}>Aliq: {pct(r.aliquota)}</span>
                        <span className="font-mono text-sm font-bold" style={{ color: textPrimary }}>{fmt(r.valor)}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between mt-3 pt-3" style={{ borderTop: `1px solid ${cardBorder}` }}>
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: neonGreen }}>Valor c/ Impostos</span>
                  <span className="font-mono font-bold text-base" style={{ color: neonGreen }}>
                    R$ {Number(peca.valor_com_impostos).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </span>
                </div>
              </div>
            );
          })()}

          {/* Logistica Reversa - only for devolvida_samsung */}
          {isSamsungReturn && (
            <div
              className="rounded-xl p-5"
              style={{
                background: isDark ? 'rgba(96,165,250,0.06)' : 'rgba(59,130,246,0.08)',
                border: isDark ? '2px solid rgba(96,165,250,0.35)' : '2px solid rgba(59,130,246,0.30)',
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Truck className="w-4 h-4" style={{ color: isDark ? '#60a5fa' : '#2563eb' }} />
                <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: isDark ? '#60a5fa' : '#2563eb' }}>Logistica Reversa</h3>
              </div>

              <div className="space-y-4">
                {/* Coleta */}
                <div
                  className="p-4 rounded-lg"
                  style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-2 h-2 rounded-full ${localColeta ? 'bg-green-500' : 'bg-orange-500 animate-pulse'}`} />
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: textSecondary }}>Coleta pela Transportadora</p>
                  </div>

                  {localColeta ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                      <span className="text-green-600 font-semibold text-sm">
                        Coletada em {new Date(localColeta).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={dataColeta}
                        onChange={(e) => setDataColeta(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg text-sm focus:outline-none"
                        style={{
                          background: isDark ? '#1e293b' : '#f1f5f9',
                          border: isDark ? '1px solid #374151' : '1px solid #cbd5e1',
                          color: textPrimary
                        }}
                      />
                      <button
                        onClick={handleRegistrarColeta}
                        disabled={!dataColeta || salvandoColeta}
                        className="px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50 whitespace-nowrap"
                        style={{
                          background: 'rgba(249,115,22,0.2)',
                          border: '1px solid rgba(249,115,22,0.5)',
                          color: isDark ? '#fb923c' : '#c2410c',
                        }}
                      >
                        {salvandoColeta ? 'Salvando...' : 'Registrar Coleta'}
                      </button>
                    </div>
                  )}
                </div>

                {/* Credito GSPN */}
                <div
                  className="p-4 rounded-lg"
                  style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-2 h-2 rounded-full ${localCredito ? 'bg-green-500' : localColeta ? 'bg-red-500 animate-pulse' : 'bg-gray-400'}`} />
                    <p className="text-xs font-bold uppercase tracking-wider" style={{ color: textSecondary }}>Credito no GSPN</p>
                  </div>

                  {localCredito ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                      <span className="text-green-600 font-semibold text-sm">
                        Credito confirmado em {new Date(localCredito).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  ) : localColeta ? (
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={dataCredito}
                        onChange={(e) => setDataCredito(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg text-sm focus:outline-none"
                        style={{
                          background: isDark ? '#1e293b' : '#f1f5f9',
                          border: isDark ? '1px solid #374151' : '1px solid #cbd5e1',
                          color: textPrimary
                        }}
                      />
                      <button
                        onClick={handleConfirmarCredito}
                        disabled={!dataCredito || salvandoCredito}
                        className="px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50 whitespace-nowrap"
                        style={{
                          background: 'rgba(239,68,68,0.2)',
                          border: '1px solid rgba(239,68,68,0.5)',
                          color: isDark ? '#f87171' : '#dc2626',
                        }}
                      >
                        {salvandoCredito ? 'Salvando...' : 'Confirmar Credito no GSPN'}
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs italic" style={{ color: textMuted }}>Aguardando coleta para liberar esta etapa</p>
                  )}
                </div>

                {/* SLA */}
                {slaDias !== null && (
                  <div
                    className="p-4 rounded-lg flex items-center gap-3"
                    style={{
                      background: slaDias <= 10 ? 'rgba(34,197,94,0.1)' : 'rgba(239,68,68,0.1)',
                      border: `1px solid ${slaDias <= 10 ? 'rgba(34,197,94,0.4)' : 'rgba(239,68,68,0.4)'}`,
                    }}
                  >
                    {slaDias <= 10 ? (
                      <CheckCircle className="w-5 h-5 text-green-500 shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
                    )}
                    <div>
                      <p className="text-xs uppercase tracking-wider font-bold mb-0.5" style={{ color: textMuted }}>Auditoria SLA</p>
                      {slaDias <= 10 ? (
                        <p className="text-green-600 font-bold text-sm">
                          SLA Cumprido: {slaDias} {slaDias === 1 ? 'dia' : 'dias'}
                        </p>
                      ) : (
                        <p className="text-red-600 font-bold text-sm">
                          SLA Estourado: {slaDias} dias (Meta: 10 dias)
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Localizacao */}
          <div>
            <p className="text-xs font-bold uppercase tracking-wider mb-2" style={{ color: textMuted }}>Localizacao Fisica</p>
            {peca.localizacao ? (
              <div
                className="p-3 rounded-lg flex items-center justify-between"
                style={{ background: isDark ? 'rgba(0,212,255,0.08)' : 'rgba(3,105,161,0.08)', border: isDark ? '1px solid rgba(0,212,255,0.25)' : '1px solid rgba(3,105,161,0.25)' }}
              >
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" style={{ color: accentCyan }} />
                  <span className="font-mono text-sm" style={{ color: textPrimary }}>{peca.localizacao}</span>
                </div>
                <button
                  onClick={handleAlterarLocalizacao}
                  className="text-xs transition-colors"
                  style={{ color: accentCyan }}
                >
                  Alterar
                </button>
              </div>
            ) : (
              <button
                onClick={handleAlterarLocalizacao}
                className="w-full p-3 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
                style={{ background: cardBg, border: `1px solid ${cardBorder}`, color: textMuted }}
              >
                <MapPin className="w-4 h-4" />
                Definir localizacao no mapa
              </button>
            )}
          </div>

          {/* Historico */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4" style={{ color: accentCyan }} />
              <p className="text-xs font-bold uppercase tracking-wider" style={{ color: accentCyan }}>Historico de Movimentacoes</p>
            </div>
            {loadingHistorico ? (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 border-2 rounded-full animate-spin" style={{ borderColor: neonGreen, borderTopColor: 'transparent' }} />
              </div>
            ) : historico.length === 0 ? (
              <p className="text-center text-sm py-4" style={{ color: textMuted }}>Nenhuma movimentacao registrada</p>
            ) : (
              <div className="space-y-2 overflow-y-auto cyber-scrollbar max-h-52 pr-1">
                {historico.map((h) => (
                  <div
                    key={h.id}
                    className="flex gap-3 p-3 rounded-lg"
                    style={{ background: cardBg, border: `1px solid ${cardBorder}` }}
                  >
                    <div
                      className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                      style={{ background: neonGreen, boxShadow: isDark ? `0 0 6px ${neonGreen}` : 'none' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs font-bold" style={{ color: textPrimary }}>{h.acao}</span>
                        <span className="text-xs" style={{ color: textMuted }}>
                          {new Date(h.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      {(h.status_anterior || h.status_novo) && (
                        <p className="text-xs mt-0.5" style={{ color: textMuted }}>
                          {h.status_anterior && (
                            <span style={{ color: textMuted }}>{h.status_anterior} </span>
                          )}
                          {h.status_anterior && h.status_novo && <span style={{ color: textMuted }}> → </span>}
                          {h.status_novo && (
                            <span style={{ color: neonGreen }}>{h.status_novo}</span>
                          )}
                        </p>
                      )}
                      {(h.origem || h.destino) && (
                        <p className="text-xs mt-0.5" style={{ color: textMuted }}>
                          {h.origem && <span style={{ color: textSecondary }}>{h.origem}</span>}
                          {h.origem && h.destino && <span style={{ color: textMuted }}> → </span>}
                          {h.destino && <span style={{ color: accentCyan }}>{h.destino}</span>}
                        </p>
                      )}
                      {h.observacao && (
                        <p className="text-xs mt-0.5 line-clamp-2" style={{ color: textMuted }}>{h.observacao}</p>
                      )}
                      {h.usuario && (
                        <p className="text-xs mt-0.5" style={{ color: textMuted }}>por {(h.usuario as any).nome}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="shrink-0 px-6 py-4 flex gap-3" style={{ borderTop: `1px solid ${headerBorder}` }}>
          <button
            onClick={handleGerarEtiqueta}
            disabled={generatingLabel}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
            style={{
              background: isDark ? 'rgba(57,255,20,0.1)' : 'rgba(21,128,61,0.1)',
              border: isDark ? '1px solid rgba(57,255,20,0.35)' : '1px solid rgba(21,128,61,0.35)',
              color: neonGreen,
            }}
          >
            <Printer className="w-4 h-4" />
            {generatingLabel ? 'Preparando...' : 'Gerar Etiqueta'}
          </button>
          <button
            onClick={onClose}
            className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors ${isDark ? 'hover:bg-white/10' : 'hover:bg-black/5'}`}
            style={{ background: cardBg, border: `1px solid ${cardBorder}`, color: textSecondary }}
          >
            Fechar
          </button>
        </div>
      </div>

      {showLabelGenerator && labelData.length > 0 && (
        <LabelGenerator
          labels={labelData}
          onClose={() => setShowLabelGenerator(false)}
        />
      )}
    </div>
  );

  return createPortal(modalContent, document.body);
}
