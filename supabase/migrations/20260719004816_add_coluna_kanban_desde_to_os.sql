/*
# Add coluna_kanban_desde tracking column to OS

1. Modified Tables
   - `os`: adds `coluna_kanban_desde` (timestamptz) that auto-updates whenever `coluna_kanban` changes.

2. New Functions/Triggers
   - `update_coluna_kanban_desde()`: sets `coluna_kanban_desde` to NOW() when the column changes.
   - Trigger `trg_update_coluna_kanban_desde` on os BEFORE UPDATE.

3. Data Backfill
   - Sets `coluna_kanban_desde` = `updated_at` for all existing rows (best available approximation).

4. Important Notes
   - This enables the Cockpit to display how long an OS has been in its current stage.
*/

-- Add column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'coluna_kanban_desde'
  ) THEN
    ALTER TABLE os ADD COLUMN coluna_kanban_desde timestamptz;
  END IF;
END $$;

-- Backfill existing rows with updated_at as approximation
UPDATE os SET coluna_kanban_desde = COALESCE(updated_at, created_at) WHERE coluna_kanban_desde IS NULL;

-- Create or replace trigger function
CREATE OR REPLACE FUNCTION update_coluna_kanban_desde()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.coluna_kanban IS DISTINCT FROM NEW.coluna_kanban THEN
    NEW.coluna_kanban_desde := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate trigger
DROP TRIGGER IF EXISTS trg_update_coluna_kanban_desde ON os;
CREATE TRIGGER trg_update_coluna_kanban_desde
  BEFORE UPDATE ON os
  FOR EACH ROW
  EXECUTE FUNCTION update_coluna_kanban_desde();
