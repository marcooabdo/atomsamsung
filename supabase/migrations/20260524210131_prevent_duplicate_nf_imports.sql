/*
  # Prevent duplicate NF imports in estoque_nfs

  ## Problem
  The estoque_nfs table had no UNIQUE constraint on chave_acesso or numero_nf,
  allowing the same NF XML to be imported multiple times. Each import created
  duplicate estoque_pecas records. When one set was allocated/status-changed,
  the other remained 'disponivel', creating the appearance of duplication in
  Estoque Geral.

  ## Solution
  1. Add a partial UNIQUE index on chave_acesso (when not null) — this is the
     most reliable identifier for electronic NFs (44-digit key is globally unique)
  2. Add a UNIQUE constraint on (numero_nf, unidade_id) as a fallback guard

  ## Notes
  - The partial index handles XML-imported NFs where chave_acesso is populated
  - The composite unique handles manual NFs without a chave_acesso
  - Both constraints prevent double imports going forward
  - Existing duplicate data is NOT removed (safe migration)
*/

-- Partial unique index: chave_acesso must be unique within a unit when populated
CREATE UNIQUE INDEX IF NOT EXISTS idx_estoque_nfs_unique_chave_acesso
  ON estoque_nfs (chave_acesso)
  WHERE chave_acesso IS NOT NULL;

-- Composite unique: same NF number cannot be imported twice for the same unit
CREATE UNIQUE INDEX IF NOT EXISTS idx_estoque_nfs_unique_numero_unidade
  ON estoque_nfs (numero_nf, unidade_id);
