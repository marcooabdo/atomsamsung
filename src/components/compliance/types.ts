export type CategoriaOcorrencia = 'dano_veiculo' | 'multa' | 'extravio' | 'pecas' | 'outros';
export type TipoDeducao = 'folha' | 'premiacao';
export type StatusOcorrencia = 'aberto' | 'em_pagamento' | 'quitado';

export interface Ocorrencia {
  id: string;
  unidade_id: string | null;
  titulo: string;
  categoria: CategoriaOcorrencia;
  data_ocorrencia: string;
  descricao: string;
  valor_total: number;
  tipo_deducao: TipoDeducao;
  status: StatusOcorrencia;
  created_by: string | null;
  created_at: string;
}

export interface Responsavel {
  id: string;
  ocorrencia_id: string;
  usuario_id: string;
  percentual: number;
  valor_devido: number;
  valor_pago: number;
  usuario_nome?: string;
  usuario_foto?: string | null;
}

export interface Parcela {
  id: string;
  responsavel_id: string;
  numero_parcela: number;
  total_parcelas: number;
  mes_referencia: string;
  valor: number;
  deduzido: boolean;
  data_deducao: string | null;
}

export interface OcorrenciaComDetalhes extends Ocorrencia {
  responsaveis: (Responsavel & { parcelas: Parcela[] })[];
  valor_pago_total: number;
  percentual_pago: number;
}

export const CATEGORIAS: { value: CategoriaOcorrencia; label: string; color: string }[] = [
  { value: 'dano_veiculo', label: 'Dano em Veículo', color: '#FF6B6B' },
  { value: 'multa', label: 'Multa', color: '#FFD93D' },
  { value: 'extravio', label: 'Extravio', color: '#FF9F43' },
  { value: 'pecas', label: 'Peças', color: '#4ADE80' },
  { value: 'outros', label: 'Outros', color: '#00D4FF' },
];

export const STATUS_CONFIG: Record<StatusOcorrencia, { label: string; color: string; bg: string; border: string }> = {
  aberto: { label: 'Aberto', color: '#FFD93D', bg: 'rgba(255,217,61,0.12)', border: 'rgba(255,217,61,0.4)' },
  em_pagamento: { label: 'Em Pagamento', color: '#00D4FF', bg: 'rgba(0,212,255,0.12)', border: 'rgba(0,212,255,0.4)' },
  quitado: { label: 'Quitado', color: '#4ADE80', bg: 'rgba(74,222,128,0.12)', border: 'rgba(74,222,128,0.4)' },
};

export const formatBRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
