/*
# Create GIA alertas 2h tracking table

1. New Tables
   - `gia_alertas_2h_enviados`
     - `id` (uuid, primary key)
     - `os_id` (uuid, references os, not null) — the OS that was alerted
     - `coluna_kanban` (text, not null) — the column the OS was in when alerted
     - `alertado_em` (timestamptz, default now()) — when the alert was sent
     - Unique constraint on (os_id, coluna_kanban) — ensures only 1 alert per OS per stage

2. Security
   - Enable RLS on `gia_alertas_2h_enviados`
   - Allow authenticated users full CRUD (system/service role will use it)

3. Indexes
   - Composite index on (os_id, coluna_kanban) for fast lookup
   - Index on alertado_em for cleanup queries

4. Important Notes
   - This table prevents duplicate WhatsApp alerts for the same OS in the same kanban column
   - When an OS moves to a new column, it becomes eligible for a new alert (different coluna_kanban value)
   - Only 1 alert per OS per stage — never repeats
*/

CREATE TABLE IF NOT EXISTS gia_alertas_2h_enviados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL REFERENCES os(id) ON DELETE CASCADE,
  coluna_kanban text NOT NULL,
  alertado_em timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint: only 1 alert per OS per column
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'uq_alertas_2h_os_coluna'
  ) THEN
    ALTER TABLE gia_alertas_2h_enviados ADD CONSTRAINT uq_alertas_2h_os_coluna UNIQUE (os_id, coluna_kanban);
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_alertas_2h_os_coluna ON gia_alertas_2h_enviados (os_id, coluna_kanban);
CREATE INDEX IF NOT EXISTS idx_alertas_2h_alertado_em ON gia_alertas_2h_enviados (alertado_em);

-- Enable RLS
ALTER TABLE gia_alertas_2h_enviados ENABLE ROW LEVEL SECURITY;

-- Policies: service role + authenticated can manage (system automation table)
DROP POLICY IF EXISTS "select_alertas_2h" ON gia_alertas_2h_enviados;
CREATE POLICY "select_alertas_2h" ON gia_alertas_2h_enviados FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_alertas_2h" ON gia_alertas_2h_enviados;
CREATE POLICY "insert_alertas_2h" ON gia_alertas_2h_enviados FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_alertas_2h" ON gia_alertas_2h_enviados;
CREATE POLICY "update_alertas_2h" ON gia_alertas_2h_enviados FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_alertas_2h" ON gia_alertas_2h_enviados;
CREATE POLICY "delete_alertas_2h" ON gia_alertas_2h_enviados FOR DELETE
  TO authenticated USING (true);