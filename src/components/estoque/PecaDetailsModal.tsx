import { createPortal } from 'react-dom';
import { useState, useEffect } from 'react';
import { X, MapPin, Printer, Package, History, Link } from 'lucide-react';
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
  status_novo: string | null;
  origem: string | null;
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
  usada_upc: { label: 'Usada UPC', color: '#6B7280' },
};

export function PecaDetailsModal({ peca, onClose, onShowLabelSelector, onShowLocationSelector }: PecaDetailsModalProps) {
  const [generatingLabel, setGeneratingLabel] = useState(false);
  const [showLabelGenerator, setShowLabelGenerator] = useState(false);
  const [labelData, setLabelData] = useState<LabelData[]>([]);
  const [pecaDetalhada, setPecaDetalhada] = useState<PecaDetalhada | null>(null);
  const [historico, setHistorico] = useState<HistoricoItem[]>([]);
  const [loadingHistorico, setLoadingHistorico] = useState(true);

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
          .select('id, acao, status_novo, origem, observacao, created_at, usuario:usuario_id(nome)')
          .eq('peca_id', peca.id)
          .order('created_at', { ascending: false })
          .limit(30),
      ]);

      if (detRes.data) setPecaDetalhada(detRes.data as unknown as PecaDetalhada);
      setHistorico((histRes.data || []) as unknown as HistoricoItem[]);
    } finally {
      setLoadingHistorico(false);
    }
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

  const statusCfg = STATUS_COLORS[peca.status] || { label: peca.status, color: '#6B7280' };
  const osVinculada = pecaDetalhada?.os;
  const osLabel = osVinculada
    ? (osVinculada.numero_os_samsung || osVinculada.numero_os_interna)
    : null;

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
                      {h.status_novo && (
                        <p className="text-xs text-gray-400 mt-0.5">
                          Status: <span className="text-[#39FF14]">{h.status_novo}</span>
                        </p>
                      )}
                      {h.observacao && (
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{h.observacao}</p>
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
