import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { MapPin, Check, ChevronRight, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface Location {
  bin_id: string;
  estante_id: string;
  sala_id: string;
  unidade_id: string;
  localizacao_completa: string;
  quantidade_usado?: number;
}

interface LocationSelectorProps {
  partNumber: string;
  currentUnidadeId: string;
  onSelect: (binId: string, locationText: string) => void;
  onClose: () => void;
}

export function LocationSelector({ partNumber, currentUnidadeId, onSelect, onClose }: LocationSelectorProps) {
  const [suggestedLocation, setSuggestedLocation] = useState<Location | null>(null);
  const [allLocations, setAllLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  // For manual selection
  const [showManual, setShowManual] = useState(false);
  const [unidades, setUnidades] = useState<any[]>([]);
  const [salas, setSalas] = useState<any[]>([]);
  const [estantes, setEstantes] = useState<any[]>([]);
  const [bins, setBins] = useState<any[]>([]);

  const [selectedUnidade, setSelectedUnidade] = useState('');
  const [selectedSala, setSelectedSala] = useState('');
  const [selectedEstante, setSelectedEstante] = useState('');
  const [selectedBin, setSelectedBin] = useState('');

  useEffect(() => {
    loadSuggestions();
    loadUnidades();
  }, [partNumber, currentUnidadeId]);

  useEffect(() => {
    if (selectedUnidade) loadSalas(selectedUnidade);
  }, [selectedUnidade]);

  useEffect(() => {
    if (selectedSala) loadEstantes(selectedSala);
  }, [selectedSala]);

  useEffect(() => {
    if (selectedEstante) loadBins(selectedEstante);
  }, [selectedEstante]);

  const loadSuggestions = async () => {
    setLoading(true);
    try {
      // Buscar sugestão
      const { data: suggestion } = await supabase
        .rpc('sugerir_localizacao', {
          pn_busca: partNumber,
          unidade_atual: currentUnidadeId
        });

      if (suggestion && suggestion.length > 0) {
        setSuggestedLocation(suggestion[0]);
      }

      // Buscar todas localizações
      const { data: locations } = await supabase
        .rpc('listar_localizacoes_pn', {
          pn_busca: partNumber
        });

      if (locations) {
        setAllLocations(locations);
      }
    } catch (error) {
    } finally {
      setLoading(false);
    }
  };

  const loadUnidades = async () => {
    const { data } = await supabase
      .from('unidades')
      .select('*')
      .order('nome');
    if (data) setUnidades(data);
  };

  const loadSalas = async (unidadeId: string) => {
    const { data } = await supabase
      .from('estoque_salas')
      .select('*')
      .eq('unidade_id', unidadeId)
      .order('nome');
    if (data) setSalas(data);
  };

  const loadEstantes = async (salaId: string) => {
    const { data } = await supabase
      .from('estoque_estantes')
      .select('*')
      .eq('sala_id', salaId)
      .order('nome');
    if (data) setEstantes(data);
  };

  const loadBins = async (estanteId: string) => {
    const { data } = await supabase
      .from('estoque_bins')
      .select('*')
      .eq('estante_id', estanteId)
      .order('coordenada');
    if (data) setBins(data);
  };

  const handleAcceptSuggestion = () => {
    if (suggestedLocation) {
      onSelect(suggestedLocation.bin_id, suggestedLocation.localizacao_completa);
    }
  };

  const handleManualSelect = async () => {
    if (!selectedBin) return;

    // Buscar info completa
    const { data: bin } = await supabase
      .from('estoque_bins')
      .select(`
        id,
        coordenada,
        estante:estoque_estantes(
          nome,
          sala:estoque_salas(
            nome,
            unidade:unidades(nome)
          )
        )
      `)
      .eq('id', selectedBin)
      .single();

    if (bin && bin.estante) {
      const locationText = `${bin.estante.sala.unidade.nome} > ${bin.estante.sala.nome} > ${bin.estante.nome} > ${bin.coordenada}`;
      onSelect(selectedBin, locationText);
    }
  };

  const modalContent = (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[10000] flex items-center justify-center p-4">
      <div className="premium-card w-full max-w-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-[#00D4FF] flex items-center gap-2">
              <MapPin className="w-6 h-6" />
              Definir Localizacao
            </h2>
            <p className="text-sm text-gray-400 mt-1">
              PN: <span className="font-mono text-white">{partNumber}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="w-12 h-12 border-4 border-[#00D4FF] border-t-transparent rounded-full animate-spin mx-auto mb-4" />
            <p className="text-gray-400">Carregando sugestões...</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Sugestão Automática */}
            {suggestedLocation && (
              <div className="p-4 bg-[#39FF14]/10 border-2 border-[#39FF14]/30 rounded-lg">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-bold text-[#39FF14] uppercase mb-1">
                      ⭐ Localização Sugerida
                    </h3>
                    <p className="text-xs text-gray-400">
                      Baseado em {suggestedLocation.quantidade_usado} {suggestedLocation.quantidade_usado === 1 ? 'peça anterior' : 'peças anteriores'}
                    </p>
                  </div>
                  <button
                    onClick={handleAcceptSuggestion}
                    className="flex items-center gap-2 px-4 py-2 bg-[#39FF14] hover:bg-[#39FF14]/80 text-black font-medium rounded-lg transition-colors"
                  >
                    <Check className="w-4 h-4" />
                    Aceitar
                  </button>
                </div>

                <div className="flex items-center gap-2 text-white font-medium">
                  <MapPin className="w-5 h-5 text-[#39FF14]" />
                  <span>{suggestedLocation.localizacao_completa}</span>
                </div>
              </div>
            )}

            {/* Outras Localizações */}
            {allLocations.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-gray-400 uppercase mb-3">
                  Outras Localizações Existentes
                </h3>
                <div className="space-y-2">
                  {allLocations.filter(loc => loc.bin_id !== suggestedLocation?.bin_id).map((location, index) => (
                    <button
                      key={index}
                      onClick={() => onSelect(location.bin_id, location.localizacao_completa)}
                      className="w-full p-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-left transition-colors group"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-gray-300 group-hover:text-white">
                          <MapPin className="w-4 h-4" />
                          <span>{location.localizacao_completa}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {location.quantidade} {location.quantidade === 1 ? 'peça' : 'peças'}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Seleção Manual */}
            <div className="border-t border-gray-700 pt-6">
              <button
                onClick={() => setShowManual(!showManual)}
                className="w-full flex items-center justify-between p-3 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <span className="text-white font-medium">
                  {showManual ? 'Esconder' : 'Escolher'} Nova Localização
                </span>
                <ChevronRight className={`w-5 h-5 text-gray-400 transition-transform ${showManual ? 'rotate-90' : ''}`} />
              </button>

              {showManual && (
                <div className="mt-4 space-y-4 p-4 bg-gray-800/50 rounded-lg">
                  <div>
                    <label className="block text-sm text-gray-400 mb-2">Unidade</label>
                    <select
                      value={selectedUnidade}
                      onChange={(e) => {
                        setSelectedUnidade(e.target.value);
                        setSelectedSala('');
                        setSelectedEstante('');
                        setSelectedBin('');
                      }}
                      className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
                    >
                      <option value="">Selecione...</option>
                      {unidades.map(u => (
                        <option key={u.id} value={u.id}>{u.nome}</option>
                      ))}
                    </select>
                  </div>

                  {selectedUnidade && (
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Sala</label>
                      <select
                        value={selectedSala}
                        onChange={(e) => {
                          setSelectedSala(e.target.value);
                          setSelectedEstante('');
                          setSelectedBin('');
                        }}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
                      >
                        <option value="">Selecione...</option>
                        {salas.map(s => (
                          <option key={s.id} value={s.id}>{s.nome}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {selectedSala && (
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Estante</label>
                      <select
                        value={selectedEstante}
                        onChange={(e) => {
                          setSelectedEstante(e.target.value);
                          setSelectedBin('');
                        }}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
                      >
                        <option value="">Selecione...</option>
                        {estantes.map(e => (
                          <option key={e.id} value={e.id}>{e.nome}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {selectedEstante && (
                    <div>
                      <label className="block text-sm text-gray-400 mb-2">Bin</label>
                      <select
                        value={selectedBin}
                        onChange={(e) => setSelectedBin(e.target.value)}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white"
                      >
                        <option value="">Selecione...</option>
                        {bins.map(b => (
                          <option key={b.id} value={b.id}>{b.coordenada}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {selectedBin && (
                    <button
                      onClick={handleManualSelect}
                      className="w-full px-4 py-2 bg-[#00D4FF] hover:bg-[#00D4FF]/80 text-black font-medium rounded-lg transition-colors"
                    >
                      Confirmar Localização
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Opção de não definir */}
            <button
              onClick={() => onSelect('', '')}
              className="w-full px-4 py-2 bg-gray-700 hover:bg-gray-600 text-gray-300 rounded-lg transition-colors text-sm"
            >
              Pular (Definir localizacao depois)
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}
