import { Box, DollarSign, FileText, ShoppingCart, Users, Wrench } from 'lucide-react';

export type SectorKey = string;

export interface SectorConfig {
  title: string;
  icon: React.ElementType;
  accentColor: string;
  borderColor: string;
  badgeColor: string;
  headerGradient: string;
}

export const BOARD_CONFIG: Record<SectorKey, SectorConfig> = {
  ESTOQUE: {
    title: 'Estoque / Peças',
    icon: Box,
    accentColor: '#00D4FF',
    borderColor: 'rgba(0,212,255,0.3)',
    badgeColor: 'rgba(0,212,255,0.15)',
    headerGradient: 'linear-gradient(135deg, rgba(0,212,255,0.15) 0%, rgba(0,212,255,0.03) 100%)',
  },
  FINANCEIRO: {
    title: 'Financeiro',
    icon: DollarSign,
    accentColor: '#39FF14',
    borderColor: 'rgba(57,255,20,0.3)',
    badgeColor: 'rgba(57,255,20,0.15)',
    headerGradient: 'linear-gradient(135deg, rgba(57,255,20,0.15) 0%, rgba(57,255,20,0.03) 100%)',
  },
  FISCAL: {
    title: 'Fiscal / ADM',
    icon: FileText,
    accentColor: '#FFA500',
    borderColor: 'rgba(255,165,0,0.3)',
    badgeColor: 'rgba(255,165,0,0.15)',
    headerGradient: 'linear-gradient(135deg, rgba(255,165,0,0.15) 0%, rgba(255,165,0,0.03) 100%)',
  },
  VENDAS: {
    title: 'Vendas',
    icon: ShoppingCart,
    accentColor: '#FF2D78',
    borderColor: 'rgba(255,45,120,0.3)',
    badgeColor: 'rgba(255,45,120,0.15)',
    headerGradient: 'linear-gradient(135deg, rgba(255,45,120,0.15) 0%, rgba(255,45,120,0.03) 100%)',
  },
  RH: {
    title: 'Recursos Humanos',
    icon: Users,
    accentColor: '#A78BFA',
    borderColor: 'rgba(167,139,250,0.3)',
    badgeColor: 'rgba(167,139,250,0.15)',
    headerGradient: 'linear-gradient(135deg, rgba(167,139,250,0.15) 0%, rgba(167,139,250,0.03) 100%)',
  },
  TECNICO: {
    title: 'Equipe Tecnica',
    icon: Wrench,
    accentColor: '#F59E0B',
    borderColor: 'rgba(245,158,11,0.3)',
    badgeColor: 'rgba(245,158,11,0.15)',
    headerGradient: 'linear-gradient(135deg, rgba(245,158,11,0.15) 0%, rgba(245,158,11,0.03) 100%)',
  },
};

export const ACTIVE_SECTORS: SectorKey[] = ['ESTOQUE', 'FINANCEIRO', 'FISCAL'];
