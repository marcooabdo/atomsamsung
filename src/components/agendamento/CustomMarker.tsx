import L from 'leaflet';
import { MapPin } from 'lucide-react';
import { renderToString } from 'react-dom/server';

export interface MarkerStatus {
  status: 'pendente' | 'agendado' | 'em_andamento' | 'concluido';
  hasGI?: boolean;
  hasPendingParts?: boolean;
}

export const createCustomMarkerIcon = (markerStatus: MarkerStatus, isSelected: boolean = false) => {
  const getColorByStatus = () => {
    switch (markerStatus.status) {
      case 'concluido':
        return '#39FF14';
      case 'em_andamento':
        return '#00D4FF';
      case 'agendado':
        return '#9D4EDD';
      case 'pendente':
      default:
        return '#FFBF00';
    }
  };

  const color = getColorByStatus();
  const size = isSelected ? 48 : 36;
  const pulseClass = markerStatus.status === 'em_andamento' ? 'animate-pulse' : '';

  const svgIcon = `
    <svg width="${size}" height="${size}" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="glow-${markerStatus.status}">
          <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      ${isSelected ? `
        <circle cx="12" cy="12" r="10" fill="none" stroke="${color}" stroke-width="1.5" opacity="0.3"/>
        <circle cx="12" cy="12" r="11.5" fill="none" stroke="${color}" stroke-width="0.5" opacity="0.2"/>
      ` : ''}

      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"
            fill="${color}"
            stroke="#000"
            stroke-width="1"
            filter="url(#glow-${markerStatus.status})"
            opacity="${isSelected ? '1' : '0.9'}"/>

      <circle cx="12" cy="9" r="3" fill="#000" opacity="0.8"/>

      ${markerStatus.hasGI ? `
        <circle cx="17" cy="5" r="3" fill="#FF0064" stroke="#000" stroke-width="0.5"/>
        <text x="17" y="7" font-size="5" font-weight="bold" fill="#fff" text-anchor="middle">!</text>
      ` : ''}

      ${markerStatus.hasPendingParts ? `
        <circle cx="7" cy="5" r="2.5" fill="#FFBF00" stroke="#000" stroke-width="0.5"/>
        <text x="7" y="6.5" font-size="4" font-weight="bold" fill="#000" text-anchor="middle">P</text>
      ` : ''}
    </svg>
  `;

  return L.divIcon({
    html: svgIcon,
    className: `custom-marker ${pulseClass}`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    popupAnchor: [0, -size]
  });
};

export const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    pendente: 'Pendente Confirmação',
    agendado: 'Agendado',
    em_andamento: 'Em Andamento',
    concluido: 'Concluído'
  };
  return labels[status] || status;
};

export const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    pendente: '#FFBF00',
    agendado: '#9D4EDD',
    em_andamento: '#00D4FF',
    concluido: '#39FF14'
  };
  return colors[status] || '#888';
};
