import { useState, useEffect } from 'react';
import { X, MapPin, Search, Loader2 } from 'lucide-react';
import { googleMapsService } from '../../lib/googleMapsService';
import { supabase } from '../../lib/supabase';

interface BaseConfigModalProps {
  unidadeId: string;
  isOpen: boolean;
  onClose: () => void;
  onSave: () => void;
}

export function BaseConfigModal({
  unidadeId,
  isOpen,
  onClose,
  onSave
}: BaseConfigModalProps) {
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadCurrentConfig();
    }
  }, [isOpen, unidadeId]);

  const loadCurrentConfig = async () => {
    try {
      const { data, error } = await supabase
        .from('unidades')
        .select('endereco, latitude, longitude')
        .eq('id', unidadeId)
        .single();

      if (error) throw error;

      if (data) {
        setAddress(data.endereco || '');
        setLat(data.latitude ? String(data.latitude) : '');
        setLng(data.longitude ? String(data.longitude) : '');
      }
    } catch (err) {
    }
  };

  const handleGeocodeAddress = async () => {
    if (!address.trim()) {
      setError('Digite um endereço para buscar');
      return;
    }

    setIsGeocoding(true);
    setError(null);

    try {
      const result = await googleMapsService.geocodeAddress(address);

      if (result) {
        setLat(String(result.coordinates.lat));
        setLng(String(result.coordinates.lng));
        setAddress(result.formattedAddress);
      } else {
        setError('Não foi possível encontrar o endereço. Tente outro formato.');
      }
    } catch (err) {
      setError('Erro ao buscar coordenadas. Tente novamente.');
    } finally {
      setIsGeocoding(false);
    }
  };

  const handleSave = async () => {
    if (!lat || !lng) {
      setError('Configure as coordenadas antes de salvar');
      return;
    }

    const latNum = Number(lat);
    const lngNum = Number(lng);

    if (isNaN(latNum) || isNaN(lngNum)) {
      setError('Coordenadas inválidas');
      return;
    }

    if (latNum < -90 || latNum > 90 || lngNum < -180 || lngNum > 180) {
      setError('Coordenadas fora dos limites válidos');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const { error } = await supabase
        .from('unidades')
        .update({
          latitude: latNum,
          longitude: lngNum,
          endereco: address.trim() || null
        })
        .eq('id', unidadeId);

      if (error) throw error;

      onSave();
      onClose();
    } catch (err) {
      setError('Erro ao salvar configuração. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <MapPin className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">
                Configurar Base da Unidade
              </h2>
              <p className="text-sm text-slate-600">
                Configure o endereço e coordenadas da base
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Endereço Completo
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder="Ex: Rua das Flores, 123 - Centro, São Paulo - SP, 01234-567"
                className="flex-1 px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                onClick={handleGeocodeAddress}
                disabled={isGeocoding || !address.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isGeocoding ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Buscar
                  </>
                )}
              </button>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Digite o endereço completo e clique em "Buscar" para obter as coordenadas automaticamente
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Latitude
              </label>
              <input
                type="text"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                placeholder="-23.550520"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Longitude
              </label>
              <input
                type="text"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                placeholder="-46.633308"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          {lat && lng && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800 font-medium mb-2">
                Coordenadas Configuradas
              </p>
              <p className="text-xs text-green-700">
                As coordenadas estão prontas para serem salvas. O sistema usará este ponto como início e fim de todas as rotas.
              </p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 p-6 border-t border-slate-200 bg-slate-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !lat || !lng}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-slate-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Configuração'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
