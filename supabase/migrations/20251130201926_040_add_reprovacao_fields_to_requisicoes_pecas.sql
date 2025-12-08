/*
  # Add rejection fields to requisicoes_pecas table

  1. Changes to requisicoes_pecas table
    - Add `motivo_reprovacao` column (text, nullable) to store rejection reason
    - Add `reprovado_em` column (timestamptz, nullable) to track when rejection happened
    - Add `reprovado_por` column (uuid, nullable) to track who rejected
    - Add foreign key constraint from `reprovado_por` to `usuarios(id)`

  2. Status Update
    - The status column already supports 'reprovada' based on the existing enum
    - This migration adds the supporting fields for the rejection workflow

  3. Notes
    - Fields are nullable as they only apply when status is 'reprovada'
    - The reprovado_por field references usuarios table for audit trail
*/

-- Add motivo_reprovacao column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requisicoes_pecas' AND column_name = 'motivo_reprovacao'
  ) THEN
    ALTER TABLE requisicoes_pecas ADD COLUMN motivo_reprovacao text;
  END IF;
END $$;

-- Add reprovado_em column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requisicoes_pecas' AND column_name = 'reprovado_em'
  ) THEN
    ALTER TABLE requisicoes_pecas ADD COLUMN reprovado_em timestamptz;
  END IF;
END $$;

-- Add reprovado_por column
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requisicoes_pecas' AND column_name = 'reprovado_por'
  ) THEN
    ALTER TABLE requisicoes_pecas ADD COLUMN reprovado_por uuid REFERENCES usuarios(id);
  END IF;
END $$;
