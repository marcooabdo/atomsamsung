/*
# Add per-visit technical fields to agendamentos

1. Modified Tables
  - `agendamentos`
    - `defeito_encontrado` (text, nullable) - Defect found during this specific visit
    - `diagnostico_tecnico` (text, nullable) - Technician diagnosis for this visit
    - `acao_realizada` (text, nullable) - Action performed during this visit

2. Important Notes
  - These fields allow each visit to store its own technical findings independently
  - Previously these were only stored at the OS level, causing new visits to show old data
  - The OS-level fields remain for backwards compatibility and will continue to be updated on checkout
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agendamentos' AND column_name = 'defeito_encontrado') THEN
    ALTER TABLE agendamentos ADD COLUMN defeito_encontrado text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agendamentos' AND column_name = 'diagnostico_tecnico') THEN
    ALTER TABLE agendamentos ADD COLUMN diagnostico_tecnico text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agendamentos' AND column_name = 'acao_realizada') THEN
    ALTER TABLE agendamentos ADD COLUMN acao_realizada text;
  END IF;
END $$;