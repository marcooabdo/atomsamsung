import { useEffect, useState, useCallback, useRef } from 'react';
import { GoogleMap, Marker, Polyline, InfoWindow, useJsApiLoader } from '@react-google-maps/api';
import { MapPin, CheckCircle2 } from 'lucide-react';
import type { OS } from '../../lib/routeKanbanSync';
import type { Coordinates } from '../../lib/googleMapsService';

const libraries: ('places' | 'geometry')[] = ['places', 'geometry'];

interface GoogleRouteMapViewerProps {
  baseCoordinates: Coordinates;
  osData: OS[];
  polyline?: string;
  selectedOS?: OS | null;
  onOSClick?: (os: OS) => void;
  showCompleted?: boolean;
}

const mapContainerStyle = {
  width: '100%',
  height: '100%'
};

const defaultCenter = {
  lat: -23.5505,
  lng: -46.6333
};

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  mapTypeControl: false,
  streetViewControl: false,
  fullscreenControl: true,
  styles: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }]
    }
  ]
};

export function GoogleRouteMapViewer({
  baseCoordinates,
  osData,
  polyline,
  selectedOS,
  onOSClick,
  showCompleted = true
}: GoogleRouteMapViewerProps) {
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '',
    libraries: libraries
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [infoWindowOS, setInfoWindowOS] = useState<OS | null>(null);
  const [decodedPath, setDecodedPath] = useState<google.maps.LatLngLiteral[]>([]);
  const mapRef = useRef<google.maps.Map | null>(null);

  const onLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map;
    setMap(map);
  }, []);

  const onUnmount = useCallback(() => {
    mapRef.current = null;
    setMap(null);
  }, []);

  useEffect(() => {
    if (map && osData.length > 0) {
      const bounds = new google.maps.LatLngBounds();

      bounds.extend(new google.maps.LatLng(baseCoordinates.lat, baseCoordinates.lng));

      osData.forEach(os => {
        if (os.lat && os.lng) {
          bounds.extend(new google.maps.LatLng(os.lat, os.lng));
        }
      });

      map.fitBounds(bounds);

      const listener = google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
        const zoom = map.getZoom();
        if (zoom && zoom > 15) {
          map.setZoom(15);
        }
      });

      return () => {
        google.maps.event.removeListener(listener);
      };
    }
  }, [map, osData, baseCoordinates]);

  useEffect(() => {
    if (polyline && isLoaded && google.maps.geometry) {
      try {
        const path = google.maps.geometry.encoding.decodePath(polyline);
        setDecodedPath(path.map(p => ({ lat: p.lat(), lng: p.lng() })));
      } catch (error) {
      }
    }
  }, [polyline, isLoaded]);

  if (loadError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50">
        <div className="text-center p-8">
          <MapPin className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Erro ao carregar Google Maps
          </h3>
          <p className="text-sm text-slate-600">
            Verifique se a chave da API está configurada corretamente no arquivo .env
          </p>
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-sm text-slate-600">Carregando mapa...</p>
        </div>
      </div>
    );
  }

  const visibleOSs = showCompleted ? osData : osData.filter(os => !os.concluida);

  return (
    <div className="w-full h-full relative">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={baseCoordinates || defaultCenter}
        zoom={12}
        options={mapOptions}
        onLoad={onLoad}
        onUnmount={onUnmount}
      >
        <Marker
          position={baseCoordinates}
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: 12,
            fillColor: '#0ea5e9',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3
          }}
          title="Base da Unidade"
          onClick={() => setInfoWindowOS(null)}
        />

        {visibleOSs.map((os, index) => {
          if (!os.lat || !os.lng) return null;

          const isCompleted = os.concluida;
          const isSelected = selectedOS?.id === os.id;

          return (
            <Marker
              key={os.id}
              position={{ lat: os.lat, lng: os.lng }}
              icon={{
                path: google.maps.SymbolPath.CIRCLE,
                scale: isSelected ? 14 : 10,
                fillColor: isCompleted ? '#10b981' : '#ef4444',
                fillOpacity: 1,
                strokeColor: isSelected ? '#fbbf24' : '#ffffff',
                strokeWeight: isSelected ? 4 : 2
              }}
              label={{
                text: (index + 1).toString(),
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: 'bold'
              }}
              title={`OS ${os.numero_os} - ${os.cliente_nome}`}
              onClick={() => {
                setInfoWindowOS(os);
                onOSClick?.(os);
              }}
            />
          );
        })}

        {infoWindowOS && infoWindowOS.lat && infoWindowOS.lng && (
          <InfoWindow
            position={{ lat: infoWindowOS.lat, lng: infoWindowOS.lng }}
            onCloseClick={() => setInfoWindowOS(null)}
          >
            <div className="p-2 max-w-xs">
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-slate-900">
                  OS {infoWindowOS.numero_os}
                </h3>
                {infoWindowOS.concluida && (
                  <CheckCircle2 className="w-5 h-5 text-green-600 ml-2" />
                )}
              </div>
              <p className="text-sm text-slate-700 mb-1">
                <strong>Cliente:</strong> {infoWindowOS.cliente_nome}
              </p>
              <p className="text-sm text-slate-600 mb-2">
                {infoWindowOS.cliente_endereco}
              </p>
              <p className="text-xs text-slate-500">
                {infoWindowOS.cliente_cidade}
              </p>
              {infoWindowOS.prioridade && (
                <div className="mt-2 inline-block px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
                  Prioridade: {infoWindowOS.prioridade}
                </div>
              )}
            </div>
          </InfoWindow>
        )}

        {decodedPath.length > 0 && (
          <Polyline
            path={decodedPath}
            options={{
              strokeColor: '#2563eb',
              strokeOpacity: 0.8,
              strokeWeight: 4,
              geodesic: true
            }}
          />
        )}
      </GoogleMap>

      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <div className="w-4 h-4 rounded-full bg-sky-500 border-2 border-white"></div>
          <span className="text-slate-700">Base</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-4 h-4 rounded-full bg-red-500 border-2 border-white"></div>
          <span className="text-slate-700">OS Pendente</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <div className="w-4 h-4 rounded-full bg-green-500 border-2 border-white"></div>
          <span className="text-slate-700">OS Concluída</span>
        </div>
        {decodedPath.length > 0 && (
          <div className="flex items-center gap-2 text-sm border-t pt-2">
            <div className="w-4 h-1 bg-blue-600"></div>
            <span className="text-slate-700">Rota Otimizada</span>
          </div>
        )}
      </div>

      {osData.length > 0 && (
        <div className="absolute bottom-4 right-4 bg-white rounded-lg shadow-lg p-3">
          <div className="text-sm text-slate-600">
            <strong>{visibleOSs.filter(os => !os.concluida).length}</strong> OSs pendentes
          </div>
          <div className="text-sm text-slate-600">
            <strong>{visibleOSs.filter(os => os.concluida).length}</strong> OSs concluídas
          </div>
        </div>
      )}
    </div>
  );
}
