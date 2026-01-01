export type Perfil = 'front_office' | 'inside_sales';
export type Nivel = 'starter' | 'avancado' | 'elite' | 'lider_global';

export interface PilarEstrelas {
  nome: string;
  estrelas: number;
  maxEstrelas: number;
  icone: string;
}

export interface MesHistorico {
  mes: string;
  ano: number;
  estrelasTotal: number;
  metaBatida: boolean;
}

export interface Colaborador {
  id: string;
  nome: string;
  avatar?: string;
  perfil: Perfil;
  nivel: Nivel;
  unidade_id: string;
  unidade_nome: string;
  estrelasMesAtual: number;
  metaEstrelas: number;
  pilares: {
    storePlus?: PilarEstrelas;
    lpOw?: PilarEstrelas;
    googleReviews: PilarEstrelas;
    cultura: PilarEstrelas;
    carePlus?: PilarEstrelas;
    conversao?: PilarEstrelas;
    seguroInstalacao?: PilarEstrelas;
  };
  historicoMeses: MesHistorico[];
  travadoPorCultura: boolean;
  motivoTrava?: string;
  mesesConsecutivos: number;
  proximoNivel: Nivel | null;
  progressoProximoNivel: number;
}

export interface BonusConfig {
  nivel: Nivel;
  perfil: Perfil;
  storePlus: number;
  carePlus: number;
  seguroInstalacao?: number;
}

export const NIVEIS_CONFIG = {
  starter: { label: 'Starter', metaEstrelas: 6, mesesNecessarios: 2, cor: '#60A5FA' },
  avancado: { label: 'Avancado', metaEstrelas: 8, mesesNecessarios: 3, cor: '#A78BFA' },
  elite: { label: 'Elite', metaEstrelas: 10, mesesNecessarios: 3, cor: '#FBBF24' },
  lider_global: { label: 'Lider Global', metaEstrelas: 12, mesesNecessarios: 0, cor: '#F87171' }
};

export const BONUS_TABLE: BonusConfig[] = [
  { nivel: 'starter', perfil: 'front_office', storePlus: 1, carePlus: 4 },
  { nivel: 'avancado', perfil: 'front_office', storePlus: 1.5, carePlus: 7 },
  { nivel: 'elite', perfil: 'front_office', storePlus: 2, carePlus: 10 },
  { nivel: 'lider_global', perfil: 'front_office', storePlus: 2.5, carePlus: 12 },
  { nivel: 'starter', perfil: 'inside_sales', storePlus: 0.5, carePlus: 3, seguroInstalacao: 2 },
  { nivel: 'avancado', perfil: 'inside_sales', storePlus: 1, carePlus: 5, seguroInstalacao: 3 },
  { nivel: 'elite', perfil: 'inside_sales', storePlus: 1.5, carePlus: 8, seguroInstalacao: 4 },
  { nivel: 'lider_global', perfil: 'inside_sales', storePlus: 2, carePlus: 10, seguroInstalacao: 5 }
];
