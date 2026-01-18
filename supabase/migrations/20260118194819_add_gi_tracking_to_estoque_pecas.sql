/*
  # Adicionar Rastreamento de GI em Estoque Peças

  1. Alterações
    - Adiciona `gi_postada_em` (timestamptz) para data/hora da postagem da GI
    - Adiciona `gi_postada_por` (uuid) referenciando usuários para quem postou a GI
    - Adiciona `gi_cancelada_em` (timestamptz) para data/hora do cancelamento da GI
    - Adiciona `gi_cancelada_por` (uuid) referenciando usuários para quem cancelou a GI

  2. Notas
    - Permite rastreamento individual de cada peça do lote
    - Facilita visualização de quais IDs já tiveram GI postada
*/

-- Adicionar colunas de rastreamento de GI
ALTER TABLE estoque_pecas
  ADD COLUMN IF NOT EXISTS gi_postada_em timestamptz,
  ADD COLUMN IF NOT EXISTS gi_postada_por uuid REFERENCES usuarios(id),
  ADD COLUMN IF NOT EXISTS gi_cancelada_em timestamptz,
  ADD COLUMN IF NOT EXISTS gi_cancelada_por uuid REFERENCES usuarios(id);

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_estoque_pecas_gi_postada_por ON estoque_pecas(gi_postada_por);
CREATE INDEX IF NOT EXISTS idx_estoque_pecas_gi_postada_em ON estoque_pecas(gi_postada_em) WHERE gi_postada_em IS NOT NULL;
