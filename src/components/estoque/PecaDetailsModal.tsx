import { createPortal } from 'react-dom';
import { useState } from 'react';
import { X, MapPin, Printer } from 'lucide-react';
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

export function PecaDetailsModal({ peca, onClose, onShowLabelSelector, onShowLocationSelector }: PecaDetailsModalProps) {
  const [generatingLabel, setGeneratingLabel] = useState(false);
  const [showLabelGenerator, setShowLabelGenerator] = useState(false);
  const [labelData, setLabelData] = useState<LabelData[]>([]);

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

  const modalContent = (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
      <div className="premium-card w-full max-w-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-[#00D4FF]">Detalhes da Peca</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-gray-500">ID</label>
              <p className="text-[#39FF14] font-bold text-2xl">#{peca.id_numerico || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Part Number</label>
              <p className="text-white font-mono">{peca.pn}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Descricao</label>
              <p className="text-white">{peca.descricao || 'N/A'}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Status</label>
              <p className="text-white capitalize">{peca.status}</p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Valor com Impostos</label>
              <p className="text-[#39FF14] font-bold">
                R$ {peca.valor_com_impostos.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <label className="text-sm text-gray-500">Condicao</label>
              <p className="text-white capitalize">{peca.condicao}</p>
            </div>
            {peca.nf_delivery && (
              <div className="col-span-2">
                <label className="text-sm text-gray-500">Delivery</label>
                <p className="text-[#00D4FF] font-bold text-lg">{peca.nf_delivery}</p>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-gray-700">
            <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">Localizacao Fisica</h3>
            {peca.localizacao ? (
              <div className="p-3 bg-[#00D4FF]/10 border border-[#00D4FF]/30 rounded-lg">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2 text-white">
                    <MapPin className="w-5 h-5 text-[#00D4FF]" />
                    <span>{peca.localizacao}</span>
                  </div>
                  <button
                    onClick={handleAlterarLocalizacao}
                    className="text-xs text-[#00D4FF] hover:text-[#00D4FF]/80"
                  >
                    Alterar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={handleAlterarLocalizacao}
                className="w-full p-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-gray-400 text-sm transition-colors"
              >
                <MapPin className="w-4 h-4 inline mr-2" />
                Definir localizacao no mapa
              </button>
            )}
          </div>

          <div className="pt-4 border-t border-gray-700 space-y-2">
            <button
              onClick={handleGerarEtiqueta}
              disabled={generatingLabel}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[#39FF14]/10 hover:bg-[#39FF14]/20 text-[#39FF14] rounded-lg transition-colors border border-[#39FF14]/30 disabled:opacity-50"
            >
              <Printer className="w-4 h-4" />
              {generatingLabel ? 'Preparando...' : 'Gerar Etiqueta'}
            </button>
            <button
              onClick={onClose}
              className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors"
            >
              Fechar
            </button>
          </div>
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
