import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { recalcularDistanciaOS, salvarKmManual, salvarReceitaManual, TARIFA_POR_KM } from '../../lib/deslocamentoService';
import { X, Save, MapPin, RotateCcw, Truck, DollarSign, AlertTriangle, Package } from 'lucide-react';

interface OSDeslocamento {
  id: string;
  numero_os_interna: string;
  numero_os_samsung: string | null;
  cliente_cidade: string | null;
  cliente_estado: string | null;
  aparelho_modelo: string | null;
  unidade_id: string;
  cache?: {
    distancia_km: number;
    distancia_km_ida_volta: number;
    receita_calculada: number;
    km_manual: number | null;
    receita_manual: number | null;
    erro_calculo: boolean;
    erro_mensagem: string | null;
    origem_cidade: string | null;
    origem_estado: string | null;
  } | null;
}

interface EditOSDeslocamentoModalProps {
  os: OSDeslocamento;
  origemCidade: string;
  origemEstado: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function EditOSDeslocamentoModal({ os, origemCidade, origemEstado, onClose, onSaved }: EditOSDeslocamentoModalProps) {
  const [cidade, setCidade] = useState(os.cliente_cidade || '');
  const [estado, setEstado] = useState(os.cliente_estado || '');
  const [modelo, setModelo] = useState(os.aparelho_modelo || '');
  const [kmManual, setKmManual] = useState(os.cache?.km_manual?.toString() || '');
  const [receitaManual, setReceitaManual] = useState(os.cache?.receita_manual?.toString() || '');
  const [useKmManual, setUseKmManual] = useState(!!os.cache?.km_manual);
  const [useReceitaManual, setUseReceitaManual] = useState(!!os.cache?.receita_manual);
  const [saving, setSaving] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [error, setError] = useState('');

  const previewReceita = useKmManual && kmManual
    ? Math.round(parseFloat(kmManual) * TARIFA_POR_KM * 100) / 100
    : null;

  const handleSaveCidade = async () => {
    if (!cidade.trim()) {
      setError('Cidade e obrigatoria');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const updates: Record<string, any> = {};
      if (cidade !== os.cliente_cidade) updates.cliente_cidade = cidade.trim();
      if (estado !== os.cliente_estado) updates.cliente_estado = estado.trim();
      if (modelo !== os.aparelho_modelo) updates.aparelho_modelo = modelo.trim() || null;

      if (Object.keys(updates).length > 0) {
        const { error: updateErr } = await supabase
          .from('os')
          .update(updates)
          .eq('id', os.id);
        if (updateErr) throw updateErr;
      }

      if (useKmManual && kmManual) {
        await salvarKmManual(os.id, parseFloat(kmManual));
      } else if (!useKmManual && os.cache?.km_manual) {
        await supabase
          .from('deslocamento_km_cache')
          .update({ km_manual: null, receita_manual: null, updated_at: new Date().toISOString() })
          .eq('os_id', os.id);
      }

      if (useReceitaManual && receitaManual) {
        await salvarReceitaManual(os.id, parseFloat(receitaManual));
      } else if (!useReceitaManual && os.cache?.receita_manual) {
        await supabase
          .from('deslocamento_km_cache')
          .update({ receita_manual: null, updated_at: new Date().toISOString() })
          .eq('os_id', os.id);
      }

      onSaved();
    } catch (err: any) {
      setError(err.message || 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleRecalcular = async () => {
    if (!cidade.trim() || !estado.trim()) {
      setError('Preencha cidade e estado para recalcular');
      return;
    }
    setRecalculating(true);
    setError('');
    try {
      await supabase
        .from('os')
        .update({ cliente_cidade: cidade.trim(), cliente_estado: estado.trim() })
        .eq('id', os.id);

      await recalcularDistanciaOS(
        os.id,
        os.unidade_id,
        origemCidade,
        origemEstado,
        cidade.trim(),
        estado.trim()
      );

      onSaved();
    } catch (err: any) {
      setError(err.message || 'Erro ao recalcular');
    } finally {
      setRecalculating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#1a1a2e] border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <div>
            <h3 className="text-lg font-bold text-white">Editar OS - Deslocamento</h3>
            <p className="text-sm text-gray-400 mt-0.5">OS #{os.numero_os_interna}{os.numero_os_samsung ? ` / Samsung ${os.numero_os_samsung}` : ''}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/30">
              <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {os.cache?.erro_calculo && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-amber-300">Erro no calculo anterior</p>
                <p className="text-xs text-amber-400/70">{os.cache.erro_mensagem || 'API nao conseguiu calcular a distancia'}</p>
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
              <MapPin className="w-3.5 h-3.5 inline mr-1" />
              Cidade do Cliente
            </label>
            <input
              type="text"
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              placeholder="Ex: Juiz de Fora"
              className="neon-input w-full"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
              Estado (UF)
            </label>
            <input
              type="text"
              value={estado}
              onChange={(e) => setEstado(e.target.value.toUpperCase().slice(0, 2))}
              placeholder="Ex: MG"
              maxLength={2}
              className="neon-input w-full"
            />
          </div>

          <div>
            <label className="block text-xs text-gray-400 uppercase tracking-wider mb-2">
              <Package className="w-3.5 h-3.5 inline mr-1" />
              Modelo do Aparelho
            </label>
            <input
              type="text"
              value={modelo}
              onChange={(e) => setModelo(e.target.value)}
              placeholder="Ex: SM-A155M"
              className="neon-input w-full"
            />
          </div>

          <div className="border-t border-white/10 pt-4">
            <div className="flex items-center gap-3 mb-3">
              <input
                type="checkbox"
                id="useKmManual"
                checked={useKmManual}
                onChange={(e) => {
                  setUseKmManual(e.target.checked);
                  if (!e.target.checked) setKmManual('');
                }}
                className="w-4 h-4 rounded border-gray-600 text-[#00D4FF] focus:ring-[#00D4FF]/50"
              />
              <label htmlFor="useKmManual" className="text-sm text-gray-300">
                <Truck className="w-3.5 h-3.5 inline mr-1" />
                Definir KM manualmente (Ida e Volta)
              </label>
            </div>

            {useKmManual && (
              <div className="ml-7 space-y-2">
                <input
                  type="number"
                  value={kmManual}
                  onChange={(e) => setKmManual(e.target.value)}
                  placeholder="KM total (ida e volta)"
                  step="0.1"
                  min="0"
                  className="neon-input w-full"
                />
                {previewReceita !== null && (
                  <p className="text-xs text-emerald-400">
                    Receita prevista: R$ {previewReceita.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </p>
                )}
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center gap-3 mb-3">
              <input
                type="checkbox"
                id="useReceitaManual"
                checked={useReceitaManual}
                onChange={(e) => {
                  setUseReceitaManual(e.target.checked);
                  if (!e.target.checked) setReceitaManual('');
                }}
                className="w-4 h-4 rounded border-gray-600 text-[#00D4FF] focus:ring-[#00D4FF]/50"
              />
              <label htmlFor="useReceitaManual" className="text-sm text-gray-300">
                <DollarSign className="w-3.5 h-3.5 inline mr-1" />
                Definir receita manualmente (R$)
              </label>
            </div>

            {useReceitaManual && (
              <div className="ml-7">
                <input
                  type="number"
                  value={receitaManual}
                  onChange={(e) => setReceitaManual(e.target.value)}
                  placeholder="Valor em R$"
                  step="0.01"
                  min="0"
                  className="neon-input w-full"
                />
              </div>
            )}
          </div>

          {os.cache && !os.cache.erro_calculo && (
            <div className="p-3 rounded-lg bg-white/5 border border-white/10">
              <p className="text-xs text-gray-400 mb-1">Calculo atual</p>
              <div className="flex items-center gap-4 text-sm">
                <span className="text-white">{os.cache.origem_cidade} → {os.cache.destino_cidade}</span>
                <span className="text-cyan-400 font-medium">{os.cache.distancia_km_ida_volta.toFixed(1)} km</span>
                <span className="text-emerald-400 font-medium">
                  R$ {os.cache.receita_calculada.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-5 border-t border-white/10 gap-3">
          <button
            onClick={handleRecalcular}
            disabled={recalculating || saving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-300 hover:bg-amber-500/30 transition-colors text-sm font-medium disabled:opacity-50"
          >
            <RotateCcw className={`w-4 h-4 ${recalculating ? 'animate-spin' : ''}`} />
            {recalculating ? 'Recalculando...' : 'Recalcular KM'}
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-4 py-2.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 transition-colors text-sm"
            >
              Cancelar
            </button>
            <button
              onClick={handleSaveCidade}
              disabled={saving || recalculating}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#00D4FF]/20 border border-[#00D4FF]/50 text-[#00D4FF] hover:bg-[#00D4FF]/30 transition-colors text-sm font-medium disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
