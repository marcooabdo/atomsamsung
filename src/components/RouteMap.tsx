import { useState, useEffect } from 'react';
import {
  GoogleMap,
  LoadScript,
  Marker,
  InfoWindow,
  Polyline,
} from '@react-google-maps/api';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

const libraries: ('places' | 'geometry')[] = ['places', 'geometry'];

interface OSMarker {
  id: string;
  numero_os: string;
  lat: number;
  lng: number;
  rota: string;
  tipo_atendimento: 'IH' | 'CI';
  ordem?: number;
}

interface RouteMapProps {
  osMarkers: OSMarker[];
  selectedRota?: string;
  baseLocation?: { lat: number; lng: number; nome: string };
  routeLines?: { lat: number; lng: number }[][];
  onMarkerClick?: (osId: string) => void;
}

const ROTA_COLORS: Record<string, string> = {
  'Rota 1': '#ef4444',
  'Rota 2': '#f97316',
  'Rota 3': '#f59e0b',
  'Rota 4': '#84cc16',
  'Rota 5': '#10b981',
  'Rota 6': '#06b6d4',
  'Rota 7': '#8b5cf6'
};

const mapContainerStyle = {
  width: '100%',
  height: '100%',
  borderRadius: '8px',
};

const mapOptions = {
  disableDefaultUI: false,
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: true,
  fullscreenControl: true,
  styles: [
    {
      featureType: 'all',
      elementType: 'geometry',
      stylers: [{ color: '#242f3e' }],
    },
    {
      featureType: 'all',
      elementType: 'labels.text.stroke',
      stylers: [{ color: '#242f3e' }],
    },
    {
      featureType: 'all',
      elementType: 'labels.text.fill',
      stylers: [{ color: '#746855' }],
    },
    {
      featureType: 'water',
      elementType: 'geometry',
      stylers: [{ color: '#17263c' }],
    },
    {
      featureType: 'road',
      elementType: 'geometry',
      stylers: [{ color: '#38414e' }],
    },
  ],
};

export default function RouteMap({
  osMarkers,
  selectedRota,
  baseLocation,
  routeLines = [],
  onMarkerClick
}: RouteMapProps) {
  const [selectedMarker, setSelectedMarker] = useState<string | null>(null);
  const [map, setMap] = useState<google.maps.Map | null>(null);

  const defaultCenter = baseLocation
    ? { lat: baseLocation.lat, lng: baseLocation.lng }
    : { lat: -15.7801, lng: -47.9292 };

  const filteredMarkers = selectedRota
    ? osMarkers.filter(m => m.rota === selectedRota)
    : osMarkers;

  useEffect(() => {
    if (!map) return;

    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    if (baseLocation) {
      bounds.extend({ lat: baseLocation.lat, lng: baseLocation.lng });
      hasPoints = true;
    }

    filteredMarkers.forEach(marker => {
      bounds.extend({ lat: marker.lat, lng: marker.lng });
      hasPoints = true;
    });

    if (hasPoints) {
      map.fitBounds(bounds);
    }
  }, [map, filteredMarkers, baseLocation]);

  const createMarkerIcon = (color: string, ordem?: number) => {
    const label = ordem !== undefined ? String(ordem) : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="32" height="40" viewBox="0 0 32 40"><path d="M16 0C7.164 0 0 7.164 0 16c0 8.837 16 24 16 24s16-15.163 16-24C32 7.164 24.836 0 16 0z" fill="${color}" stroke="#ffffff" stroke-width="2"/><circle cx="16" cy="14" r="8" fill="#ffffff"/>${label ? `<text x="16" y="18" text-anchor="middle" fill="${color}" font-size="10" font-weight="bold" font-family="Arial">${label}</text>` : `<circle cx="16" cy="14" r="3" fill="${color}"/>`}</svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  };

  const createBaseIcon = () => {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24"><circle cx="12" cy="12" r="11" fill="#1e40af" stroke="#ffffff" stroke-width="2"/><path d="M12 6L6 10v7h4v-4h4v4h4v-7L12 6z" fill="#ffffff"/></svg>`;
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
  };

  return (
    <LoadScript googleMapsApiKey={GOOGLE_MAPS_API_KEY} libraries={libraries}>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={defaultCenter}
        zoom={13}
        options={mapOptions}
        onLoad={setMap}
      >
        {baseLocation && (
          <Marker
            position={{ lat: baseLocation.lat, lng: baseLocation.lng }}
            icon={{
              url: createBaseIcon(),
              scaledSize: new google.maps.Size(40, 40),
              anchor: new google.maps.Point(20, 20),
            }}
            onClick={() => setSelectedMarker('base')}
            zIndex={1000}
          />
        )}

        {selectedMarker === 'base' && baseLocation && (
          <InfoWindow
            position={{ lat: baseLocation.lat, lng: baseLocation.lng }}
            onCloseClick={() => setSelectedMarker(null)}
          >
            <div className="p-2">
              <div className="font-bold text-blue-900 text-base">Base</div>
              <div className="text-gray-600 text-sm">{baseLocation.nome}</div>
            </div>
          </InfoWindow>
        )}

        {filteredMarkers.map((marker) => {
          const color = ROTA_COLORS[marker.rota] || '#6b7280';

          return (
            <Marker
              key={marker.id}
              position={{ lat: marker.lat, lng: marker.lng }}
              icon={{
                url: createMarkerIcon(color, marker.ordem),
                scaledSize: new google.maps.Size(32, 40),
                anchor: new google.maps.Point(16, 40),
              }}
              onClick={() => {
                setSelectedMarker(marker.id);
                onMarkerClick?.(marker.id);
              }}
            />
          );
        })}

        {selectedMarker && selectedMarker !== 'base' && (() => {
          const marker = filteredMarkers.find(m => m.id === selectedMarker);
          if (!marker) return null;
          const color = ROTA_COLORS[marker.rota] || '#6b7280';

          return (
            <InfoWindow
              position={{ lat: marker.lat, lng: marker.lng }}
              onCloseClick={() => setSelectedMarker(null)}
            >
              <div className="p-2">
                <div className="font-bold text-base" style={{ color }}>
                  OS {marker.numero_os}
                </div>
                <div className="text-gray-600 text-sm">{marker.rota}</div>
                <div className="text-gray-600 text-sm">
                  {marker.tipo_atendimento}
                  {marker.ordem && ` - Ordem: ${marker.ordem}`}
                </div>
              </div>
            </InfoWindow>
          );
        })()}

        {routeLines.map((line, index) => {
          const path = line.map(point => ({ lat: point.lat, lng: point.lng }));
          return (
            <Polyline
              key={index}
              path={path}
              options={{
                strokeColor: '#2563eb',
                strokeWeight: 3,
                strokeOpacity: 0.7,
              }}
            />
          );
        })}
      </GoogleMap>
    </LoadScript>
  );
}
