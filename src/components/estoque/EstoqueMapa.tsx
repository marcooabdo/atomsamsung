import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import {
  Plus,
  Settings,
  Search,
  Grid3x3,
  Package,
  MapPin,
  Eye,
  ChevronRight,
  Edit2,
  Trash2
} from 'lucide-react';
import { MapEditor } from './MapEditor';
import { EstanteDetailView } from './EstanteDetailView';

interface Sala {
  id: string;
  unidade_id: string;
  nome: string;
  cor: string;
  posicao_x: number;
  posicao_y: number;
  largura: number;
  altura: number;
}

interface Estante {
  id: string;
  sala_id: string;
  nome: string;
  andares: number;
  bins_por_andar: number;
  posicao_x: number;
  posicao_y: number;
  largura: number;
  altura: number;
  rotacao: number;
  cor?: string;
}

interface Bin {
  id: string;
  estante_id: string;
  andar: number;
  posicao: number;
  codigo: string;
  capacidade_maxima: number;
  pecas_count?: number;
}

interface EstoqueMapaProps {
  selectedUnidade: string;
}

export function EstoqueMapa({ selectedUnidade }: EstoqueMapaProps) {
  const { usuario } = useAuth();
  const [salas, setSalas] = useState<Sala[]>([]);
  const [estantes, setEstantes] = useState<Estante[]>([]);
  const [bins, setBins] = useState<Bin[]>([]);
  const [selectedSala, setSelectedSala] = useState<Sala | null>(null);
  const [selectedEstante, setSelectedEstante] = useState<Estante | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [highlightedBinId, setHighlightedBinId] = useState<string | null>(null);
  const [view, setView] = useState<'map' | 'config'>('map');
  const [showNewSalaModal, setShowNewSalaModal] = useState(false);
  const [showNewEstanteModal, setShowNewEstanteModal] = useState(false);
  const [showEstanteDetail, setShowEstanteDetail] = useState<Estante | null>(null);

  const currentUnidadeId = selectedUnidade || usuario?.unidade_id;

  useEffect(() => {
    if (currentUnidadeId) {
      loadSalas(currentUnidadeId);
    } else {
      setSalas([]);
      setSelectedSala(null);
    }
  }, [selectedUnidade, usuario?.unidade_id]);

  useEffect(() => {
    if (selectedSala) {
      loadEstantes(selectedSala.id);
    }
  }, [selectedSala]);

  useEffect(() => {
    if (selectedEstante) {
      loadBins(selectedEstante.id);
    }
  }, [selectedEstante]);

  const loadSalas = async (unidadeId: string) => {
    try {
      const { data, error } = await supabase
        .from('estoque_salas')
        .select('*')
        .eq('unidade_id', unidadeId)
        .order('nome');

      if (error) throw error;
      setSalas(data || []);

      if (data && data.length > 0 && !selectedSala) {
        setSelectedSala(data[0]);
      }
    } catch (error) {
    }
  };

  const loadEstantes = async (salaId: string) => {
    try {
      const { data, error } = await supabase
        .from('estoque_estantes')
        .select('*')
        .eq('sala_id', salaId)
        .order('nome');

      if (error) throw error;
      setEstantes(data || []);
    } catch (error) {
    }
  };

  const loadBins = async (estanteId: string) => {
    try {
      const { data, error } = await supabase
        .from('estoque_bins')
        .select(`
          *,
          pecas_count:estoque_pecas(count)
        `)
        .eq('estante_id', estanteId)
        .order('andar', { ascending: false })
        .order('posicao');

      if (error) throw error;

      const binsWithCount = (data || []).map(bin => ({
        ...bin,
        pecas_count: Array.isArray(bin.pecas_count) ? bin.pecas_count.length : 0
      }));

      setBins(binsWithCount);
    } catch (error) {
    }
  };

  const handleSearchPiece = async () => {
    if (!searchTerm.trim()) return;

    try {
      const { data, error } = await supabase
        .from('estoque_pecas')
        .select(`
          *,
          bin:estoque_bins(
            *,
            estante:estoque_estantes(
              *,
              sala:estoque_salas(*)
            )
          )
        `)
        .or(`pn.ilike.%${searchTerm}%,id_numerico.eq.${parseInt(searchTerm) || 0}`)
        .not('bin_id', 'is', null)
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data && data.bin) {
        const binData = data.bin as any;
        const estanteData = binData.estante;
        const salaData = estanteData.sala;

        setSelectedSala(salaData);
        setSelectedEstante(estanteData);
        setHighlightedBinId(binData.id);

        setTimeout(() => {
          setHighlightedBinId(null);
        }, 5000);

        alert(`✅ Peça encontrada!\n\nLocalização:\n📍 Sala: ${salaData.nome}\n📦 Estante: ${estanteData.nome}\n🎯 Bin: ${binData.codigo}`);
      } else {
        alert('❌ Peça não encontrada ou não possui localização atribuída');
      }
    } catch (error) {
      alert('Erro ao buscar peça');
    }
  };

  if (!currentUnidadeId) {
    return (
      <div className="text-center py-16">
        <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
        <h3 className="text-lg font-semibold text-gray-300 mb-2">
          Selecione uma unidade
        </h3>
        <p className="text-gray-500">
          Use o filtro de unidade acima para visualizar o mapa do estoque
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">Mapa do Estoque</h2>
          <p className="text-sm text-gray-400">Localização visual das peças no estoque físico</p>
        </div>

        <button
          onClick={() => setView(view === 'map' ? 'config' : 'map')}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-2 ${
            view === 'config'
              ? 'bg-[#00D4FF] text-black'
              : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
          }`}
        >
          {view === 'config' ? (
            <>
              <Eye className="w-4 h-4" />
              Ver Mapa
            </>
          ) : (
            <>
              <Settings className="w-4 h-4" />
              Configurar
            </>
          )}
        </button>
      </div>

      {/* Seletor de Sala + Busca */}
      {view === 'map' && salas.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-400">Sala:</label>
            <select
              value={selectedSala?.id || ''}
              onChange={(e) => {
                const sala = salas.find(s => s.id === e.target.value);
                setSelectedSala(sala || null);
              }}
              className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-gray-300 focus:outline-none focus:border-[#00D4FF] transition-colors"
            >
              <option value="">Selecione uma sala...</option>
              {salas.map(sala => (
                <option key={sala.id} value={sala.id}>{sala.nome}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <Search className="w-5 h-5 text-[#00D4FF]" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearchPiece()}
              placeholder="Buscar peça por PN ou ID..."
              className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-gray-300 focus:outline-none focus:border-[#00D4FF] transition-colors"
            />
            <button
              onClick={handleSearchPiece}
              className="neon-button text-sm"
            >
              Localizar no Mapa
            </button>
          </div>
        </div>
      )}

      {/* Modal Nova Sala - sempre renderizado quando necessário */}
      {showNewSalaModal && <ModalNovaSala
        currentUnidadeId={currentUnidadeId}
        onClose={() => setShowNewSalaModal(false)}
        onSuccess={() => {
          setShowNewSalaModal(false);
          setView('config');
          loadSalas(currentUnidadeId);
        }}
      />}

      {salas.length === 0 ? (
        <div className="text-center py-16">
          <Grid3x3 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-300 mb-2">
            Nenhuma sala cadastrada
          </h3>
          <p className="text-gray-500 mb-6">
            Comece criando as salas do seu estoque físico
          </p>
          <button
            onClick={() => setShowNewSalaModal(true)}
            className="neon-button"
          >
            <Plus className="w-4 h-4" />
            Criar Primeira Sala
          </button>
        </div>
      ) : view === 'config' ? (
        <ConfigView
          salas={salas}
          estantes={estantes}
          selectedSala={selectedSala}
          selectedEstante={selectedEstante}
          onSalaSelect={setSelectedSala}
          onEstanteSelect={setSelectedEstante}
          onRefresh={() => loadSalas(currentUnidadeId)}
          showNewSalaModal={showNewSalaModal}
          setShowNewSalaModal={setShowNewSalaModal}
          showNewEstanteModal={showNewEstanteModal}
          setShowNewEstanteModal={setShowNewEstanteModal}
          selectedUnidade={currentUnidadeId}
        />
      ) : selectedSala ? (
        <>
          <MapEditor
            sala={selectedSala}
            estantes={estantes.filter(e => e.sala_id === selectedSala.id)}
            onEstanteClick={(estante) => setShowEstanteDetail(estante)}
            onRefresh={() => loadEstantes(selectedSala.id)}
          />

          {showEstanteDetail && (
            <EstanteDetailView
              estante={showEstanteDetail}
              onClose={() => setShowEstanteDetail(null)}
            />
          )}
        </>
      ) : (
        <div className="text-center py-16">
          <Grid3x3 className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-300 mb-2">
            Selecione uma sala
          </h3>
          <p className="text-gray-500">
            Escolha uma sala para visualizar o mapa
          </p>
        </div>
      )}
    </div>
  );
}

interface MapViewProps {
  salas: Sala[];
  estantes: Estante[];
  bins: Bin[];
  selectedSala: Sala | null;
  selectedEstante: Estante | null;
  highlightedBinId: string | null;
  onSalaSelect: (sala: Sala) => void;
  onEstanteSelect: (estante: Estante) => void;
}

function MapView({
  salas,
  estantes,
  bins,
  selectedSala,
  selectedEstante,
  highlightedBinId,
  onSalaSelect,
  onEstanteSelect
}: MapViewProps) {
  return (
    <div className="grid grid-cols-12 gap-6">
      <div className="col-span-3 space-y-3">
        <h3 className="text-sm font-bold text-[#00D4FF] uppercase tracking-wider mb-3">
          Salas
        </h3>
        {salas.map((sala) => (
          <button
            key={sala.id}
            onClick={() => onSalaSelect(sala)}
            className={`w-full text-left p-4 rounded-lg transition-all ${
              selectedSala?.id === sala.id
                ? 'bg-[#00D4FF]/20 border-2 border-[#00D4FF]'
                : 'bg-gray-900/50 border border-gray-700 hover:border-[#00D4FF]/50'
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-4 h-4 rounded"
                style={{ backgroundColor: sala.cor }}
              />
              <div className="flex-1">
                <p className="font-semibold text-gray-200">{sala.nome}</p>
                <p className="text-xs text-gray-500">
                  {estantes.filter(e => e.sala_id === sala.id).length} estantes
                </p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-500" />
            </div>
          </button>
        ))}
      </div>

      <div className="col-span-9">
        {selectedSala ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3 pb-4 border-b border-gray-700">
              <div
                className="w-6 h-6 rounded"
                style={{ backgroundColor: selectedSala.cor }}
              />
              <h2 className="text-xl font-bold text-white">{selectedSala.nome}</h2>
            </div>

            {estantes.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Package className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                <p>Nenhuma estante cadastrada nesta sala</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  {estantes.map((estante) => (
                    <button
                      key={estante.id}
                      onClick={() => onEstanteSelect(estante)}
                      className={`p-4 rounded-lg transition-all text-left ${
                        selectedEstante?.id === estante.id
                          ? 'bg-[#39FF14]/20 border-2 border-[#39FF14]'
                          : 'bg-gray-900/50 border border-gray-700 hover:border-[#39FF14]/50'
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <Grid3x3 className="w-5 h-5 text-[#39FF14]" />
                        <span className="text-xs text-gray-500">
                          {estante.andares}A × {estante.bins_por_andar}B
                        </span>
                      </div>
                      <p className="font-semibold text-gray-200">{estante.nome}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {estante.andares * estante.bins_por_andar} bins
                      </p>
                    </button>
                  ))}
                </div>

                {selectedEstante && bins.length > 0 && (
                  <div className="premium-card p-6 bg-gray-900/50">
                    <h3 className="text-sm font-bold text-[#39FF14] uppercase tracking-wider mb-4">
                      {selectedEstante.nome}
                    </h3>
                    <div className="space-y-2">
                      {Array.from({ length: selectedEstante.andares }, (_, andarIdx) => {
                        const andar = selectedEstante.andares - andarIdx;
                        return (
                          <div key={andar} className="flex items-center gap-2">
                            <span className="w-12 text-xs text-gray-500 text-right">
                              A{andar}
                            </span>
                            <div className="flex-1 flex gap-2">
                              {Array.from({ length: selectedEstante.bins_por_andar }, (_, posIdx) => {
                                const posicao = posIdx + 1;
                                const bin = bins.find(b => b.andar === andar && b.posicao === posicao);
                                const isHighlighted = bin?.id === highlightedBinId;
                                const ocupacao = bin ? (bin.pecas_count || 0) / bin.capacidade_maxima : 0;

                                return (
                                  <div
                                    key={posicao}
                                    className={`flex-1 aspect-square rounded border-2 flex items-center justify-center text-xs font-mono font-bold transition-all relative ${
                                      isHighlighted
                                        ? 'border-[#FF00FF] bg-[#FF00FF]/30 animate-pulse shadow-lg shadow-[#FF00FF]/50'
                                        : bin
                                        ? ocupacao > 0.8
                                          ? 'border-red-500 bg-red-500/20'
                                          : ocupacao > 0.5
                                          ? 'border-yellow-500 bg-yellow-500/20'
                                          : 'border-[#39FF14] bg-[#39FF14]/20'
                                        : 'border-gray-700 bg-gray-800'
                                    }`}
                                    title={bin ? `${bin.codigo}\n${bin.pecas_count || 0} / ${bin.capacidade_maxima} peças` : 'Bin não configurada'}
                                  >
                                    {bin ? (
                                      <>
                                        <span className="text-gray-300">{bin.pecas_count || 0}</span>
                                        {isHighlighted && (
                                          <MapPin className="absolute -top-2 -right-2 w-4 h-4 text-[#FF00FF] animate-bounce" />
                                        )}
                                      </>
                                    ) : (
                                      <span className="text-gray-600">-</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-6 mt-4 pt-4 border-t border-gray-700 text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded border-2 border-[#39FF14] bg-[#39FF14]/20" />
                        <span className="text-gray-400">Baixa ocupação</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded border-2 border-yellow-500 bg-yellow-500/20" />
                        <span className="text-gray-400">Média ocupação</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded border-2 border-red-500 bg-red-500/20" />
                        <span className="text-gray-400">Alta ocupação</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-16 text-gray-400">
            <MapPin className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <p>Selecione uma sala para visualizar o mapa</p>
          </div>
        )}
      </div>
    </div>
  );
}

interface ConfigViewProps {
  salas: Sala[];
  estantes: Estante[];
  selectedSala: Sala | null;
  selectedEstante: Estante | null;
  onSalaSelect: (sala: Sala) => void;
  onEstanteSelect: (estante: Estante | null) => void;
  onRefresh: () => void;
  showNewSalaModal: boolean;
  setShowNewSalaModal: (show: boolean) => void;
  showNewEstanteModal: boolean;
  setShowNewEstanteModal: (show: boolean) => void;
  selectedUnidade: string;
}

function ConfigView({
  salas,
  estantes,
  selectedSala,
  onSalaSelect,
  onRefresh,
  showNewSalaModal,
  setShowNewSalaModal,
  showNewEstanteModal,
  setShowNewEstanteModal,
  selectedUnidade
}: ConfigViewProps) {
  const [newSala, setNewSala] = useState({ nome: '', cor: '#00D4FF' });
  const [newEstante, setNewEstante] = useState({ nome: '', andares: 4, bins_por_andar: 6, cor: '#39FF14' });
  const [creating, setCreating] = useState(false);
  const [editingSala, setEditingSala] = useState<Sala | null>(null);
  const [editingEstante, setEditingEstante] = useState<Estante | null>(null);

  const handleCreateSala = async () => {
    if (!newSala.nome.trim() || !selectedUnidade) return;

    setCreating(true);
    try {
      const { error } = await supabase
        .from('estoque_salas')
        .insert({
          unidade_id: selectedUnidade,
          nome: newSala.nome,
          cor: newSala.cor
        });

      if (error) throw error;

      alert('✅ Sala criada com sucesso!');
      setNewSala({ nome: '', cor: '#00D4FF' });
      setShowNewSalaModal(false);
      onRefresh();
    } catch (error) {
      alert('Erro ao criar sala');
    } finally {
      setCreating(false);
    }
  };

  const handleCreateEstante = async () => {
    if (!newEstante.nome.trim() || !selectedSala) return;

    setCreating(true);
    try {
      const { data: estanteData, error: estanteError } = await supabase
        .from('estoque_estantes')
        .insert({
          sala_id: selectedSala.id,
          nome: newEstante.nome,
          andares: newEstante.andares,
          bins_por_andar: newEstante.bins_por_andar,
          cor: newEstante.cor
        })
        .select()
        .single();

      if (estanteError) throw estanteError;

      const binsToCreate = [];
      for (let andar = 1; andar <= newEstante.andares; andar++) {
        const linha = String.fromCharCode(64 + andar); // A, B, C, D...
        for (let coluna = 1; coluna <= newEstante.bins_por_andar; coluna++) {
          binsToCreate.push({
            estante_id: estanteData.id,
            andar,
            posicao: coluna,
            linha: linha,
            coluna: coluna,
            codigo: `${linha}${coluna}`
          });
        }
      }

      const { error: binsError } = await supabase
        .from('estoque_bins')
        .insert(binsToCreate);

      if (binsError) throw binsError;

      setNewEstante({ nome: '', andares: 4, bins_por_andar: 6, cor: '#39FF14' });
      setShowNewEstanteModal(false);
      await onRefresh();
      alert(`✅ Estante criada com sucesso!\n${binsToCreate.length} bins configuradas.`);
    } catch (error) {
      alert('Erro ao criar estante');
    } finally {
      setCreating(false);
    }
  };

  const handleEditSala = async () => {
    if (!editingSala || !editingSala.nome.trim()) return;

    setCreating(true);
    try {
      const { error } = await supabase
        .from('estoque_salas')
        .update({
          nome: editingSala.nome,
          cor: editingSala.cor
        })
        .eq('id', editingSala.id);

      if (error) throw error;

      setEditingSala(null);
      await onRefresh();
      alert('✅ Sala atualizada com sucesso!');
    } catch (error) {
      alert('Erro ao editar sala');
    } finally {
      setCreating(false);
    }
  };

  const handleEditEstante = async () => {
    if (!editingEstante || !editingEstante.nome.trim()) return;

    setCreating(true);
    try {
      const { error } = await supabase
        .from('estoque_estantes')
        .update({
          nome: editingEstante.nome,
          cor: editingEstante.cor
        })
        .eq('id', editingEstante.id);

      if (error) throw error;

      setEditingEstante(null);
      await onRefresh();
      alert('✅ Estante atualizada com sucesso!');
    } catch (error) {
      alert('Erro ao editar estante');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      {showNewSalaModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="premium-card w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-[#00D4FF] mb-4">Nova Sala</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Nome da Sala</label>
                <input
                  type="text"
                  value={newSala.nome}
                  onChange={(e) => setNewSala({ ...newSala, nome: e.target.value })}
                  placeholder="Ex: Sala MX, Sala UPC..."
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Cor no Mapa</label>
                <input
                  type="color"
                  value={newSala.cor}
                  onChange={(e) => setNewSala({ ...newSala, cor: e.target.value })}
                  className="w-full h-10 bg-gray-900 border border-gray-700 rounded-lg"
                />
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowNewSalaModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateSala}
                  disabled={creating}
                  className="flex-1 neon-button disabled:opacity-50"
                >
                  {creating ? 'Criando...' : 'Criar Sala'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showNewEstanteModal && selectedSala && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="premium-card w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-[#39FF14] mb-4">Nova Estante - {selectedSala.nome}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Nome da Estante</label>
                <input
                  type="text"
                  value={newEstante.nome}
                  onChange={(e) => setNewEstante({ ...newEstante, nome: e.target.value })}
                  placeholder="Ex: Estante A, Estante Principal..."
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Cor da Estante</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={newEstante.cor}
                    onChange={(e) => setNewEstante({ ...newEstante, cor: e.target.value })}
                    className="w-12 h-10 rounded border border-gray-700 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={newEstante.cor}
                    onChange={(e) => setNewEstante({ ...newEstante, cor: e.target.value })}
                    placeholder="#39FF14"
                    className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-gray-300"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Linhas (Letras)</label>
                  <input
                    type="number"
                    min="1"
                    max="26"
                    value={newEstante.andares}
                    onChange={(e) => setNewEstante({ ...newEstante, andares: parseInt(e.target.value) || 1 })}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-gray-300"
                  />
                  <p className="text-xs text-gray-500 mt-1">A-{String.fromCharCode(64 + newEstante.andares)}</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">Colunas (Números)</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={newEstante.bins_por_andar}
                    onChange={(e) => setNewEstante({ ...newEstante, bins_por_andar: parseInt(e.target.value) || 1 })}
                    className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-gray-300"
                  />
                  <p className="text-xs text-gray-500 mt-1">1-{newEstante.bins_por_andar}</p>
                </div>
              </div>
              <div className="bg-[#39FF14]/10 border border-[#39FF14]/30 rounded-lg p-3">
                <p className="text-xs text-gray-400">
                  Serão criadas <span className="text-[#39FF14] font-bold">{newEstante.andares * newEstante.bins_por_andar}</span> bins automaticamente
                </p>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowNewEstanteModal(false)}
                  className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateEstante}
                  disabled={creating}
                  className="flex-1 neon-button disabled:opacity-50"
                >
                  {creating ? 'Criando...' : 'Criar Estante'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-white">Configuração do Estoque</h3>
        <button
          onClick={() => setShowNewSalaModal(true)}
          className="neon-button text-sm"
        >
          <Plus className="w-4 h-4" />
          Nova Sala
        </button>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div className="premium-card p-4">
          <h4 className="font-semibold text-[#00D4FF] mb-3">Salas Cadastradas</h4>
          <div className="space-y-2">
            {salas.map((sala) => (
              <div
                key={sala.id}
                className={`p-3 rounded-lg transition-all ${
                  selectedSala?.id === sala.id
                    ? 'bg-[#00D4FF]/20 border border-[#00D4FF]'
                    : 'bg-gray-900/50 hover:bg-gray-900'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className="flex items-center gap-3 flex-1 cursor-pointer"
                    onClick={() => onSalaSelect(sala)}
                  >
                    <div className="w-4 h-4 rounded" style={{ backgroundColor: sala.cor }} />
                    <span className="text-gray-200">{sala.nome}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingSala({...sala});
                      }}
                      className="p-1.5 hover:bg-gray-700 rounded transition-colors"
                      title="Editar sala"
                    >
                      <Edit2 className="w-3 h-3 text-gray-400" />
                    </button>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation();
                        if (confirm(`Deletar sala ${sala.nome}? Todas estantes e bins serão removidas.`)) {
                          try {
                            const { error } = await supabase
                              .from('estoque_salas')
                              .delete()
                              .eq('id', sala.id);
                            if (error) throw error;
                            alert('Sala deletada!');
                            onRefresh();
                          } catch (error) {
                            alert('Erro ao deletar sala');
                          }
                        }
                      }}
                      className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
                      title="Deletar sala"
                    >
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {selectedSala ? (
          <div className="premium-card p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-semibold text-[#39FF14]">Estantes - {selectedSala.nome}</h4>
              <button
                onClick={() => setShowNewEstanteModal(true)}
                className="p-1.5 bg-[#39FF14]/10 hover:bg-[#39FF14]/20 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4 text-[#39FF14]" />
              </button>
            </div>
            <div className="space-y-2">
              {estantes.filter(e => e.sala_id === selectedSala.id).map((estante) => (
                <div
                  key={estante.id}
                  className="p-3 rounded-lg bg-gray-900/50 hover:bg-gray-900 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-gray-200 font-medium">{estante.nome}</p>
                      <p className="text-xs text-gray-500">
                        {estante.andares} linhas × {estante.bins_por_andar} colunas = {estante.andares * estante.bins_por_andar} bins
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingEstante({...estante});
                        }}
                        className="p-1.5 hover:bg-gray-700 rounded transition-colors"
                        title="Editar estante"
                      >
                        <Edit2 className="w-3 h-3 text-gray-400" />
                      </button>
                      <button
                        onClick={async (e) => {
                          e.stopPropagation();
                          if (confirm(`Deletar estante ${estante.nome}? Todas as bins serão removidas.`)) {
                            try {
                              const { error } = await supabase
                                .from('estoque_estantes')
                                .delete()
                                .eq('id', estante.id);
                              if (error) throw error;
                              alert('Estante deletada!');
                              onRefresh();
                            } catch (error) {
                              alert('Erro ao deletar estante');
                            }
                          }
                        }}
                        className="p-1.5 hover:bg-red-500/20 rounded transition-colors"
                        title="Deletar estante"
                      >
                        <Trash2 className="w-3 h-3 text-red-400" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {estantes.filter(e => e.sala_id === selectedSala.id).length === 0 && (
                <div className="text-center py-12">
                  <Grid3x3 className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 mb-4">
                    Nenhuma estante cadastrada nesta sala
                  </p>
                  <button
                    onClick={() => setShowNewEstanteModal(true)}
                    className="neon-button text-sm"
                  >
                    <Plus className="w-4 h-4" />
                    Criar Primeira Estante
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="premium-card p-4 flex items-center justify-center" style={{ minHeight: '300px' }}>
            <div className="text-center">
              <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-400">
                Selecione uma sala ao lado para gerenciar suas estantes
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Modal Editar Sala */}
      {editingSala && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="premium-card w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-[#00D4FF] mb-4">Editar Sala</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Nome da Sala</label>
                <input
                  type="text"
                  value={editingSala.nome}
                  onChange={(e) => setEditingSala({ ...editingSala, nome: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Cor</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={editingSala.cor}
                    onChange={(e) => setEditingSala({ ...editingSala, cor: e.target.value })}
                    className="w-12 h-10 rounded border border-gray-700 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={editingSala.cor}
                    onChange={(e) => setEditingSala({ ...editingSala, cor: e.target.value })}
                    className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-gray-300"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setEditingSala(null)}
                  className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEditSala}
                  disabled={creating}
                  className="flex-1 neon-button disabled:opacity-50"
                >
                  {creating ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Editar Estante */}
      {editingEstante && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="premium-card w-full max-w-md p-6">
            <h2 className="text-xl font-bold text-[#39FF14] mb-4">Editar Estante</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Nome da Estante</label>
                <input
                  type="text"
                  value={editingEstante.nome}
                  onChange={(e) => setEditingEstante({ ...editingEstante, nome: e.target.value })}
                  className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-gray-300"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Cor da Estante</label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={editingEstante.cor || '#39FF14'}
                    onChange={(e) => setEditingEstante({ ...editingEstante, cor: e.target.value })}
                    className="w-12 h-10 rounded border border-gray-700 cursor-pointer"
                  />
                  <input
                    type="text"
                    value={editingEstante.cor || '#39FF14'}
                    onChange={(e) => setEditingEstante({ ...editingEstante, cor: e.target.value })}
                    className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-gray-300"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setEditingEstante(null)}
                  className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleEditEstante}
                  disabled={creating}
                  className="flex-1 neon-button disabled:opacity-50"
                >
                  {creating ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


interface ModalNovaSalaProps {
  currentUnidadeId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function ModalNovaSala({ currentUnidadeId, onClose, onSuccess }: ModalNovaSalaProps) {
  const [nome, setNome] = useState("");
  const [cor, setCor] = useState("#00D4FF");
  const [creating, setCreating] = useState(false);

  const handleCreate = async () => {
    if (!nome.trim()) {
      alert("Por favor, preencha o nome da sala");
      return;
    }

    setCreating(true);
    try {
      const { error } = await supabase
        .from("estoque_salas")
        .insert({
          unidade_id: currentUnidadeId,
          nome: nome.trim(),
          cor: cor
        });

      if (error) throw error;

      alert("✅ Sala criada com sucesso!");
      onSuccess();
    } catch (error) {
      alert("Erro ao criar sala");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="premium-card w-full max-w-md p-6">
        <h2 className="text-xl font-bold text-[#00D4FF] mb-4">Nova Sala</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Nome da Sala</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Sala MX, Sala UPC..."
              className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-gray-300 focus:outline-none focus:border-[#00D4FF]"
              autoFocus
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">Cor no Mapa</label>
            <input
              type="color"
              value={cor}
              onChange={(e) => setCor(e.target.value)}
              className="w-full h-10 bg-gray-900 border border-gray-700 rounded-lg cursor-pointer"
            />
          </div>
          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              disabled={creating}
              className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded-lg hover:bg-gray-600 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={creating}
              className="flex-1 neon-button disabled:opacity-50"
            >
              {creating ? "Criando..." : "Criar Sala"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
