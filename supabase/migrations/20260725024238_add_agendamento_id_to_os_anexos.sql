/*
# Add agendamento_id to os_anexos for per-visit evidence tracking

1. Modified Tables
  - `os_anexos`
    - `agendamento_id` (uuid, nullable, FK to agendamentos.id) - Links each photo/attachment to a specific visit
    
2. Important Notes
  - Previously all photos were linked only to the OS, making it impossible to show
    which photos belong to which visit.
  - With this column, evidence photos uploaded during a specific visit are linked to that agendamento.
  - Nullable to maintain backwards compatibility with existing attachments.
  - ON DELETE SET NULL: if an agendamento is removed, the photo remains but loses the visit link.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'os_anexos' AND column_name = 'agendamento_id') THEN
    ALTER TABLE os_anexos ADD COLUMN agendamento_id uuid REFERENCES agendamentos(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS idx_os_anexos_agendamento_id ON os_anexos(agendamento_id);
  END IF;
END $$;