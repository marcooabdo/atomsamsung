/*
  # Add observacoes column to estoque_pedidos

  1. Changes
    - Add `observacoes` column to `estoque_pedidos` table
      - Type: text
      - Nullable: true (observações são opcionais)
      - Used to store additional notes when creating orders

  2. Notes
    - No data migration needed as this is a new optional field
    - Existing records will have NULL observacoes
*/

-- Add observacoes column to estoque_pedidos
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estoque_pedidos' AND column_name = 'observacoes'
  ) THEN
    ALTER TABLE estoque_pedidos ADD COLUMN observacoes text;
  END IF;
END $$;
