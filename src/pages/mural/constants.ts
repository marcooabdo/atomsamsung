import type { GIAAgentConfig } from './types';

export const COLUMN_CAPACITY = 100;

function hexToRgb(hex: string): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `${r},${g},${b}`;
}

function neonEntry(neonGreen: string): Pick<GIAAgentConfig, 'color' | 'bgGradient' | 'borderColor' | 'headerGradient'> {
  const rgb = hexToRgb(neonGreen);
  return {
    color: neonGreen,
    bgGradient: `rgba(${rgb},0.05)`,
    borderColor: `rgba(${rgb},0.25)`,
    headerGradient: `linear-gradient(135deg, rgba(${rgb},0.12), rgba(${rgb},0.04))`,
  };
}

export function getGiaAgents(neonGreen: string = '#39FF14'): GIAAgentConfig[] {
  return [
  {
    name: 'GIA Connect',
    shortName: 'CONNECT',
    ...neonEntry(neonGreen),
    maxLoad: 6,
  },
  {
    name: 'GIA Sales',
    shortName: 'SALES',
    color: '#FF6B35',
    maxLoad: 5,
    bgGradient: 'rgba(255,107,53,0.05)',
    borderColor: 'rgba(255,107,53,0.25)',
    headerGradient: 'linear-gradient(135deg, rgba(255,107,53,0.12), rgba(255,107,53,0.04))',
  },
  {
    name: 'GIA Monitor',
    shortName: 'MONITOR',
    color: '#FF2D78',
    maxLoad: 4,
    bgGradient: 'rgba(255,45,120,0.05)',
    borderColor: 'rgba(255,45,120,0.25)',
    headerGradient: 'linear-gradient(135deg, rgba(255,45,120,0.12), rgba(255,45,120,0.04))',
  },
  {
    name: 'GIA Growth',
    shortName: 'GROWTH',
    color: '#FF6B35',
    maxLoad: 4,
    bgGradient: 'rgba(255,107,53,0.05)',
    borderColor: 'rgba(255,107,53,0.25)',
    headerGradient: 'linear-gradient(135deg, rgba(255,107,53,0.12), rgba(255,107,53,0.04))',
  },
  {
    name: 'GIA Tech',
    shortName: 'TECH',
    color: '#00D4FF',
    maxLoad: 7,
    bgGradient: 'rgba(0,212,255,0.05)',
    borderColor: 'rgba(0,212,255,0.25)',
    headerGradient: 'linear-gradient(135deg, rgba(0,212,255,0.12), rgba(0,212,255,0.04))',
  },
  {
    name: 'GIA Logistics',
    shortName: 'LOGISTICS',
    ...neonEntry(neonGreen),
    maxLoad: 5,
  },
  {
    name: 'GIA Stock',
    shortName: 'STOCK',
    color: '#00D4FF',
    maxLoad: 6,
    bgGradient: 'rgba(0,212,255,0.05)',
    borderColor: 'rgba(0,212,255,0.25)',
    headerGradient: 'linear-gradient(135deg, rgba(0,212,255,0.12), rgba(0,212,255,0.04))',
  },
  {
    name: 'GIA ESI',
    shortName: 'ESI',
    color: '#00D4FF',
    maxLoad: 3,
    bgGradient: 'rgba(0,212,255,0.05)',
    borderColor: 'rgba(0,212,255,0.25)',
    headerGradient: 'linear-gradient(135deg, rgba(0,212,255,0.12), rgba(0,212,255,0.04))',
  },
  {
    name: 'GIA Warranty',
    shortName: 'WARRANTY',
    ...neonEntry(neonGreen),
    maxLoad: 5,
  },
  {
    name: 'GIA Fiscal',
    shortName: 'FISCAL',
    color: '#FFA500',
    maxLoad: 4,
    bgGradient: 'rgba(255,165,0,0.05)',
    borderColor: 'rgba(255,165,0,0.25)',
    headerGradient: 'linear-gradient(135deg, rgba(255,165,0,0.12), rgba(255,165,0,0.04))',
  },
  {
    name: 'GIA Audit',
    shortName: 'AUDIT',
    color: '#FFA500',
    maxLoad: 4,
    bgGradient: 'rgba(255,165,0,0.05)',
    borderColor: 'rgba(255,165,0,0.25)',
    headerGradient: 'linear-gradient(135deg, rgba(255,165,0,0.12), rgba(255,165,0,0.04))',
  },
  {
    name: 'GIA Skywalker',
    shortName: 'SKYWALKER',
    color: '#A78BFA',
    maxLoad: 3,
    bgGradient: 'rgba(167,139,250,0.05)',
    borderColor: 'rgba(167,139,250,0.25)',
    headerGradient: 'linear-gradient(135deg, rgba(167,139,250,0.12), rgba(167,139,250,0.04))',
  },
  ];
}

export const GIA_AGENTS = getGiaAgents();
