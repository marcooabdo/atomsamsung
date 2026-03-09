/*
  # Add unidade_id to atom_connect_pipeline_colunas

  1. Modified Tables
    - `atom_connect_pipeline_colunas`
      - `unidade_id` (uuid, nullable) - Links pipeline columns to a specific unit

  2. Notes
    - Allows each unit to have its own pipeline columns
    - Nullable to preserve existing shared columns
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atom_connect_pipeline_colunas' AND column_name = 'unidade_id'
  ) THEN
    ALTER TABLE atom_connect_pipeline_colunas ADD COLUMN unidade_id uuid REFERENCES unidades(id) ON DELETE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_pipeline_colunas_unidade ON atom_connect_pipeline_colunas(unidade_id);