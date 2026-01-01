export type Perfil = 'front_office' | 'inside_sales';
export type Nivel = 'starter' | 'avancado' | 'elite' | 'lider_global';
export type TipoVenda = 'store_plus' | 'care_plus' | 'smb' | 'seguro' | 'instalacao';
export type ReviewStatus = 'pendente' | 'aprovado' | 'rejeitado';

export const NIVEIS_CONFIG: Record<Nivel, { label: string; cor: string; metaEstrelas: number; meses: number }> = {
  starter: { label: 'Starter', cor: '#60A5FA', metaEstrelas: 6, meses: 2 },
  avancado: { label: 'Avancado', cor: '#A78BFA', metaEstrelas: 8, meses: 3 },
  elite: { label: 'Elite', cor: '#FBBF24', metaEstrelas: 10, meses: 3 },
  lider_global: { label: 'Lider Global', cor: '#F87171', metaEstrelas: 12, meses: 0 }
};

export const TIPOS_VENDA: Record<TipoVenda, { label: string; cor: string }> = {
  store_plus: { label: 'Store+', cor: '#06B6D4' },
  care_plus: { label: 'Care+', cor: '#10B981' },
  smb: { label: 'SMB', cor: '#8B5CF6' },
  seguro: { label: 'Seguro', cor: '#F59E0B' },
  instalacao: { label: 'Instalacao', cor: '#EC4899' }
};

export const REVIEW_STATUS_CONFIG: Record<ReviewStatus, { label: string; cor: string }> = {
  pendente: { label: 'Pendente', cor: '#F59E0B' },
  aprovado: { label: 'Aprovado', cor: '#10B981' },
  rejeitado: { label: 'Rejeitado', cor: '#EF4444' }
};
