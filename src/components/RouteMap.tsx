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
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="50" viewBox="0 0 40 50">
        <path d="M20 0C11.716 0 5 6.716 5 15c0 8.284 15 35 15 35s15-26.716 15-35C35 6.716 28.284 0 20 0z" fill="${color}" stroke="white" stroke-width="2"/>
        <circle cx="20" cy="15" r="10" fill="white"/>
        <text x="20" y="21" text-anchor="middle" fill="${color}" font-size="12" font-weight="bold">${ordem || '•'}</text>
      </svg>
    `;
    return 'data:image/svg+xml;base64,' + btoa(svg);
  };

  const createBaseIcon = () => {
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="#1e40af" stroke="white" stroke-width="2">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
        <polyline points="9 22 9 12 15 12 15 22"/>
      </svg>
    `;
    return 'data:image/svg+xml;base64,' + btoa(svg);
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
              scaledSize: new google.maps.Size(48, 48),
              anchor: new google.maps.Point(24, 24),
            }}
            onClick={() => setSelectedMarker('base')}
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
                scaledSize: new google.maps.Size(40, 50),
                anchor: new google.maps.Point(20, 50),
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
