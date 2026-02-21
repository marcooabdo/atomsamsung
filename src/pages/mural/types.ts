export interface MuralTarefa {
  id: string;
  created_at: string;
  gia_source: string | null;
  prioridade: 'alta' | 'normal';
  titulo: string;
  descricao: string;
  status: 'pendente' | 'concluido';
  gia_responsavel: string;
  concluido_at: string | null;
  unidade_id?: string | null;
  whatsapp_phone?: string | null;
  os_id?: string | null;
  os_numero?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface GIAAgentConfig {
  name: string;
  shortName: string;
  color: string;
  maxLoad: number;
  bgGradient: string;
  borderColor: string;
  headerGradient: string;
}

export type BadgeConfig = {
  label: string;
  bg: string;
  border: string;
  color: string;
  glow: string | null;
};
