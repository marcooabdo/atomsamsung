import { createPortal } from 'react-dom';
import { useState, useEffect } from 'react';
import { X, MapPin, Printer, Package, History, Link, Truck, AlertCircle, CheckCircle, Clock } from 'lucide-react';
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

const STATUS_COLORS: Record<string, { label: string; color: string }> = {
  disponivel: { label: 'Disponível', color: '#39FF14' },
  reservada: { label: 'Reservada', color: '#FFBF00' },
  vinculada_tecnico: { label: 'Com Técnico', color: '#00D4FF' },
  em_rota: { label: 'Em Rota', color: '#00D4FF' },
  em_uso: { label: 'Em Uso', color: '#FFBF00' },
  usada: { label: 'Usada', color: '#6B7280' },
  devolucao_pendente: { label: 'Devolução Pendente', color: '#FF0064' },
  devolvida_nova: { label: 'Devolvida Nova', color: '#39FF14' },
  devolvida_defeito: { label: 'Devolvida c/ Defeito', color: '#FF0064' },
  devolvida_samsung: { label: 'Devolvida Samsung', color: '#60a5fa' },
  usada_upc: { label: 'Usada UPC', color: '#6B7280' },
};

export function PecaDetailsModal({ peca, onClose, onShowLabelSelector, onShowLocationSelector }: PecaDetailsModalProps) {
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
      console.error('Erro ao preparar etiqueta:', error);
      alert(`Erro ao preparar etiqueta: ${error.message}`);
    } finally {
      setGeneratingLabel(false);
    }
  };

  const LOGISTICA_REVERSA_STATUSES = ['devolvida_samsung', 'devolvida_nova', 'devolvida_defeito'];

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
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div
        className="w-full max-w-3xl flex flex-col max-h-[90vh] overflow-hidden rounded-xl"
        style={{
          background: '#0f172a',
          border: '1px solid rgba(57,255,20,0.2)',
          boxShadow: '0 0 40px rgba(57,255,20,0.1)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#39FF14]/15 shrink-0">
          <div className="flex items-center gap-3">
            <Package className="w-5 h-5 text-[#39FF14]" />
            <h2 className="text-lg font-bold text-[#39FF14] tracking-wide uppercase">
              Detalhes da Peça
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
            className="p-2 hover:bg-white/5 rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto cyber-scrollbar p-6 space-y-5">

          {/* OS Alocada highlight */}
          {osLabel && (
            <div
              className="flex items-center gap-3 px-4 py-3 rounded-xl"
              style={{
                background: 'rgba(57,255,20,0.07)',
                border: '1px solid rgba(57,255,20,0.35)',
              }}
            >
              <Link className="w-4 h-4 text-[#39FF14] shrink-0" />
              <div>
                <p className="text-xs text-[#39FF14]/70 uppercase tracking-wider font-bold">OS Alocada</p>
                <p className="text-[#39FF14] font-bold font-mono text-base">{osLabel}</p>
              </div>
            </div>
          )}

          {/* Main details grid */}
          <div
            className="rounded-xl p-5"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
          >
            <div className="grid grid-cols-2 gap-x-6 gap-y-4">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">ID Único</p>
                <p className="text-[#39FF14] font-bold text-2xl font-mono">#{peca.id_numerico || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Part Number</p>
                <p className="text-white font-mono font-bold">{peca.pn}</p>
              </div>
              <div className="col-span-2">
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Descrição</p>
                <p className="text-gray-300">{peca.descricao || 'N/A'}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Valor c/ Impostos</p>
                <p className="text-[#39FF14] font-bold">
                  R$ {peca.valor_com_impostos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Condição</p>
                <p className="text-gray-300 capitalize">{peca.condicao}</p>
              </div>
              {pecaDetalhada?.nf && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Nota Fiscal</p>
                  <p className="text-[#00D4FF] font-mono font-bold">{pecaDetalhada.nf.numero_nf}</p>
                </div>
              )}
              {pecaDetalhada?.nf?.fornecedor && (
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Fornecedor</p>
                  <p className="text-gray-300 text-sm">{pecaDetalhada.nf.fornecedor}</p>
                </div>
              )}
              {peca.nf_delivery && (
                <div className="col-span-2">
                  <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Delivery</p>
                  <p className="text-[#00D4FF] font-bold text-lg">{peca.nf_delivery}</p>
                </div>
              )}
            </div>
          </div>

          {/* Logistica Reversa - only for devolvida_samsung */}
          {isSamsungReturn && (
            <div
              className="rounded-xl p-5"
              style={{
                background: 'rgba(96,165,250,0.06)',
                border: '2px solid rgba(96,165,250,0.35)',
              }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Truck className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider">Logística Reversa</h3>
              </div>

              <div className="space-y-4">
                {/* Coleta */}
                <div
                  className="p-4 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-2 h-2 rounded-full ${localColeta ? 'bg-green-400' : 'bg-orange-400 animate-pulse'}`} />
                    <p className="text-xs font-bold text-gray-300 uppercase tracking-wider">Coleta pela Transportadora</p>
                  </div>

                  {localColeta ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                      <span className="text-green-400 font-semibold text-sm">
                        Coletada em {new Date(localColeta).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={dataColeta}
                        onChange={(e) => setDataColeta(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg text-sm text-white bg-gray-900 border border-gray-700 focus:border-blue-500 focus:outline-none"
                      />
                      <button
                        onClick={handleRegistrarColeta}
                        disabled={!dataColeta || salvandoColeta}
                        className="px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50 whitespace-nowrap"
                        style={{
                          background: 'rgba(249,115,22,0.2)',
                          border: '1px solid rgba(249,115,22,0.5)',
                          color: '#fb923c',
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
                  style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <div className="flex items-center gap-2 mb-3">
                    <div className={`w-2 h-2 rounded-full ${localCredito ? 'bg-green-400' : localColeta ? 'bg-red-400 animate-pulse' : 'bg-gray-600'}`} />
                    <p className="text-xs font-bold text-gray-300 uppercase tracking-wider">Crédito no GSPN</p>
                  </div>

                  {localCredito ? (
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-400 shrink-0" />
                      <span className="text-green-400 font-semibold text-sm">
                        Crédito confirmado em {new Date(localCredito).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  ) : localColeta ? (
                    <div className="flex gap-2">
                      <input
                        type="date"
                        value={dataCredito}
                        onChange={(e) => setDataCredito(e.target.value)}
                        className="flex-1 px-3 py-2 rounded-lg text-sm text-white bg-gray-900 border border-gray-700 focus:border-blue-500 focus:outline-none"
                      />
                      <button
                        onClick={handleConfirmarCredito}
                        disabled={!dataCredito || salvandoCredito}
                        className="px-4 py-2 rounded-lg text-sm font-bold transition-all disabled:opacity-50 whitespace-nowrap"
                        style={{
                          background: 'rgba(239,68,68,0.2)',
                          border: '1px solid rgba(239,68,68,0.5)',
                          color: '#f87171',
                        }}
                      >
                        {salvandoCredito ? 'Salvando...' : 'Confirmar Crédito no GSPN'}
                      </button>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500 italic">Aguardando coleta para liberar esta etapa</p>
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
                      <CheckCircle className="w-5 h-5 text-green-400 shrink-0" />
                    ) : (
                      <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />
                    )}
                    <div>
                      <p className="text-xs text-gray-400 uppercase tracking-wider font-bold mb-0.5">Auditoria SLA</p>
                      {slaDias <= 10 ? (
                        <p className="text-green-400 font-bold text-sm">
                          SLA Cumprido: {slaDias} {slaDias === 1 ? 'dia' : 'dias'}
                        </p>
                      ) : (
                        <p className="text-red-400 font-bold text-sm">
                          SLA Estourado: {slaDias} dias (Meta: 10 dias)
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Localização */}
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Localização Física</p>
            {peca.localizacao ? (
              <div
                className="p-3 rounded-lg flex items-center justify-between"
                style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.25)' }}
              >
                <div className="flex items-center gap-2 text-white">
                  <MapPin className="w-4 h-4 text-[#00D4FF]" />
                  <span className="font-mono text-sm">{peca.localizacao}</span>
                </div>
                <button
                  onClick={handleAlterarLocalizacao}
                  className="text-xs text-[#00D4FF] hover:text-[#00D4FF]/70 transition-colors"
                >
                  Alterar
                </button>
              </div>
            ) : (
              <button
                onClick={handleAlterarLocalizacao}
                className="w-full p-3 rounded-lg text-gray-400 text-sm transition-colors flex items-center justify-center gap-2"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
              >
                <MapPin className="w-4 h-4" />
                Definir localização no mapa
              </button>
            )}
          </div>

          {/* Histórico */}
          <div>
            <div className="flex items-center gap-2 mb-3">
              <History className="w-4 h-4 text-[#00D4FF]" />
              <p className="text-xs font-bold text-[#00D4FF] uppercase tracking-wider">Histórico de Movimentações</p>
            </div>
            {loadingHistorico ? (
              <div className="flex justify-center py-6">
                <div className="w-5 h-5 border-2 border-[#39FF14] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : historico.length === 0 ? (
              <p className="text-center text-gray-500 text-sm py-4">Nenhuma movimentação registrada</p>
            ) : (
              <div className="space-y-2 overflow-y-auto cyber-scrollbar max-h-52 pr-1">
                {historico.map((h) => (
                  <div
                    key={h.id}
                    className="flex gap-3 p-3 rounded-lg"
                    style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}
                  >
                    <div
                      className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                      style={{ background: '#39FF14', boxShadow: '0 0 6px #39FF14' }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="text-xs font-bold text-white">{h.acao}</span>
                        <span className="text-xs text-gray-500">
                          {new Date(h.created_at).toLocaleString('pt-BR')}
                        </span>
                      </div>
                      {(h.status_anterior || h.status_novo) && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          {h.status_anterior && (
                            <span className="text-gray-500">{h.status_anterior} </span>
                          )}
                          {h.status_anterior && h.status_novo && <span className="text-gray-600">→ </span>}
                          {h.status_novo && (
                            <span className="text-[#39FF14]">{h.status_novo}</span>
                          )}
                        </p>
                      )}
                      {(h.origem || h.destino) && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          {h.origem && <span className="text-gray-400">{h.origem}</span>}
                          {h.origem && h.destino && <span className="text-gray-600"> → </span>}
                          {h.destino && <span className="text-[#00D4FF]">{h.destino}</span>}
                        </p>
                      )}
                      {h.observacao && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{h.observacao}</p>
                      )}
                      {h.usuario && (
                        <p className="text-xs text-gray-600 mt-0.5">por {(h.usuario as any).nome}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Footer actions */}
        <div className="shrink-0 border-t border-[#39FF14]/15 px-6 py-4 flex gap-3">
          <button
            onClick={handleGerarEtiqueta}
            disabled={generatingLabel}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold transition-colors disabled:opacity-50"
            style={{
              background: 'rgba(57,255,20,0.1)',
              border: '1px solid rgba(57,255,20,0.35)',
              color: '#39FF14',
            }}
          >
            <Printer className="w-4 h-4" />
            {generatingLabel ? 'Preparando...' : 'Gerar Etiqueta'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm font-bold text-gray-300 transition-colors"
            style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.12)' }}
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
