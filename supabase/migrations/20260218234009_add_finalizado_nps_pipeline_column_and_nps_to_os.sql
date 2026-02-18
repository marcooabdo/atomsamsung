/*
  # NPS Pipeline Column and OS NPS Integration

  ## Changes

  ### 1. Ensure finalizado_nps pipeline column exists
  - Inserts the `finalizado_nps` column into atom_connect_pipeline_colunas if not present
  - Marks it as a final column (is_final = true)

  ### 2. Add nps_score and nps_comentario to os table
  - `nps_score` (integer) - Customer satisfaction score from WhatsApp NPS
  - `nps_comentario` (text) - Customer comment from NPS evaluation
  - `nps_conversa_id` (uuid) - References the atom_connect_conversas that generated this NPS

  ## Notes
  - The is_bot_ativo = true logic is handled on the frontend when moving to finalizado_nps
  - nps_score on the OS allows operators to know the customer profile before attending
*/

-- Ensure finalizado_nps column exists in pipeline
INSERT INTO atom_connect_pipeline_colunas (id, nome, cor, ordem, is_final)
VALUES ('finalizado_nps', 'Finalizado NPS', '#10B981', 99, true)
ON CONFLICT (id) DO UPDATE SET is_final = true;

-- Add NPS fields to OS table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'nps_score'
  ) THEN
    ALTER TABLE os ADD COLUMN nps_score integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'nps_comentario'
  ) THEN
    ALTER TABLE os ADD COLUMN nps_comentario text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'nps_conversa_id'
  ) THEN
    ALTER TABLE os ADD COLUMN nps_conversa_id uuid REFERENCES atom_connect_conversas(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Trigger to sync nps_score from atom_connect_conversas to os when nps_score is set
CREATE OR REPLACE FUNCTION sync_nps_to_os()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.nps_score IS NOT NULL AND (OLD.nps_score IS NULL OR OLD.nps_score != NEW.nps_score) THEN
    IF NEW.os_id IS NOT NULL THEN
      UPDATE os
      SET
        nps_score = NEW.nps_score,
        nps_comentario = NEW.nps_comentario,
        nps_conversa_id = NEW.id
      WHERE id = NEW.os_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_nps_to_os ON atom_connect_conversas;
CREATE TRIGGER trg_sync_nps_to_os
  AFTER UPDATE ON atom_connect_conversas
  FOR EACH ROW
  EXECUTE FUNCTION sync_nps_to_os();
