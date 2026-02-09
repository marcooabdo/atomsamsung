/*
  # Adicionar Vendedor Responsavel na OS

  1. Nova Coluna
    - `vendedor_responsavel_id` (uuid, nullable) - ID do vendedor responsavel pelo orcamento
    - `vendedor_responsavel_definido_em` (timestamp) - Data/hora que foi definido
    - `vendedor_responsavel_definido_por` (uuid) - Quem definiu o vendedor

  2. Regras de Negocio
    - Inicialmente vazio, qualquer usuario da unidade pode definir
    - Apos definido, somente gerente/diretoria/master podem alterar
*/

ALTER TABLE os ADD COLUMN IF NOT EXISTS vendedor_responsavel_id uuid REFERENCES usuarios(id) ON DELETE SET NULL;
ALTER TABLE os ADD COLUMN IF NOT EXISTS vendedor_responsavel_definido_em timestamptz;
ALTER TABLE os ADD COLUMN IF NOT EXISTS vendedor_responsavel_definido_por uuid REFERENCES usuarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_os_vendedor_responsavel ON os(vendedor_responsavel_id);
