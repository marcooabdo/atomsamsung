import { useState } from 'react';
import { MapPin, X, AlertCircle, Check } from 'lucide-react';
import type { OSLogistica } from '../../lib/giaLogisticsService';

interface Props {
  osSemCoords: OSLogistica[];
  onSalvar: (resultados: { osId: string; lat: number; lng: number }[]) => void;
  onFechar: () => void;
}

interface EntradaManual {
  osId: string;
  lat: string;
  lng: string;
}

export function GeolocalizacaoManualModal({ osSemCoords, onSalvar, onFechar }: Props) {
  const [entradas, setEntradas] = useState<EntradaManual[]>(
    osSemCoords.map(os => ({ osId: os.id, lat: '', lng: '' }))
  );
  const [erros, setErros] = useState<Record<string, string>>({});

  const osMap = new Map(osSemCoords.map(os => [os.id, os]));

  const atualizar = (osId: string, campo: 'lat' | 'lng', valor: string) => {
    setEntradas(prev =>
      prev.map(e => e.osId === osId ? { ...e, [campo]: valor } : e)
    );
    setErros(prev => {
      const next = { ...prev };
      delete next[osId];
      return next;
    });
  };

  const validar = (): boolean => {
    const novosErros: Record<string, string> = {};
    for (const entrada of entradas) {
      const lat = parseFloat(entrada.lat);
      const lng = parseFloat(entrada.lng);
      if (isNaN(lat) || lat < -90 || lat > 90) {
        novosErros[entrada.osId] = 'Latitude inválida (ex: -23.5505)';
        continue;
      }
      if (isNaN(lng) || lng < -180 || lng > 180) {
        novosErros[entrada.osId] = 'Longitude inválida (ex: -46.6333)';
      }
    }
    setErros(novosErros);
    return Object.keys(novosErros).length === 0;
  };

  const handleSalvar = () => {
    if (!validar()) return;
    const resultados = entradas.map(e => ({
      osId: e.osId,
      lat: parseFloat(e.lat),
      lng: parseFloat(e.lng),
    }));
    onSalvar(resultados);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }}>
      <div className="w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)' }}>
        <div className="flex items-center justify-between px-6 py-4" style={{ borderBottom: '1px solid var(--border-primary)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#F59E0B15', border: '1px solid #F59E0B30' }}>
              <MapPin className="w-5 h-5" style={{ color: '#F59E0B' }} />
            </div>
            <div>
              <h2 className="font-bold text-base" style={{ color: 'var(--text-primary)' }}>
                Geolocalização Manual Necessária
              </h2>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                {osSemCoords.length} OS(s) sem coordenadas — informe manualmente para continuar
              </p>
            </div>
          </div>
          <button onClick={onFechar} className="p-2 rounded-lg transition-colors" style={{ color: 'var(--text-tertiary)' }}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
          <div className="flex items-start gap-3 p-3 rounded-lg" style={{ backgroundColor: '#F59E0B10', border: '1px solid #F59E0B25' }}>
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#F59E0B' }} />
            <p className="text-xs" style={{ color: '#F59E0B' }}>
              O sistema nao conseguiu geolocalizar automaticamente estas OSs. Informe as coordenadas para incluí-las na rota. Use o Google Maps para obter lat/lng precisos.
            </p>
          </div>

          {entradas.map(entrada => {
            const os = osMap.get(entrada.osId);
            if (!os) return null;
            const numOS = os.numero_os_samsung || os.numero_os_interna || os.id.slice(0, 8);
            const endereco = [os.cliente_logradouro, os.cliente_numero, os.cliente_bairro, os.cliente_cidade]
              .filter(Boolean).join(', ');

            return (
              <div key={entrada.osId} className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-secondary)', border: `1px solid ${erros[entrada.osId] ? '#EF444430' : 'var(--border-primary)'}` }}>
                <div className="mb-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold px-2 py-0.5 rounded" style={{ backgroundColor: '#3B82F615', color: '#3B82F6', border: '1px solid #3B82F630' }}>
                      OS {numOS}
                    </span>
                    <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{os.cliente_nome}</span>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-tertiary)' }}>{endereco || 'Endereço não informado'}</p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Latitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      placeholder="-23.5505"
                      value={entrada.lat}
                      onChange={e => atualizar(entrada.osId, 'lat', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none transition-colors"
                      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Longitude</label>
                    <input
                      type="number"
                      step="0.000001"
                      placeholder="-46.6333"
                      value={entrada.lng}
                      onChange={e => atualizar(entrada.osId, 'lng', e.target.value)}
                      className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none transition-colors"
                      style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-primary)', color: 'var(--text-primary)' }}
                    />
                  </div>
                </div>

                {erros[entrada.osId] && (
                  <p className="text-xs mt-2" style={{ color: '#EF4444' }}>{erros[entrada.osId]}</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4" style={{ borderTop: '1px solid var(--border-primary)' }}>
          <button
            onClick={onFechar}
            className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-secondary)', border: '1px solid var(--border-primary)' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold transition-colors"
            style={{ backgroundColor: '#10B981', color: '#fff' }}
          >
            <Check className="w-4 h-4" />
            Confirmar Coordenadas e Continuar
          </button>
        </div>
      </div>
    </div>
  );
}
