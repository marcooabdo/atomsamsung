/*
# Create os_sync_gspn table

Tracks GSPN synchronization attempts per OS. Used to implement async refresh:
the frontend fires a POST, gets back a sync_id immediately, then subscribes
to realtime changes on this table to know when the sync finishes.

1. New Tables
  - `os_sync_gspn`
    - `id` (uuid, PK, auto-generated)
    - `os_id` (uuid, NOT NULL, FK to os(id))
    - `status` (text, NOT NULL: 'em_andamento' | 'concluido' | 'erro')
    - `iniciado_em` (timestamptz, NOT NULL, default now())
    - `finalizado_em` (timestamptz, nullable)
    - `mudancas` (text[], nullable - list of what changed)
    - `novos_anexos` (integer, nullable - count of new attachments)
    - `erro` (text, nullable - error message when status='erro')

2. Indexes
  - (os_id, iniciado_em DESC) for fast lookup of latest sync per OS

3. Security
  - RLS enabled
  - All authenticated users can SELECT (read sync status)
  - Only service_role inserts/updates (edge function uses service role)

4. Realtime
  - Enabled for this table so frontend can subscribe to status changes
*/

CREATE TABLE IF NOT EXISTS os_sync_gspn (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL REFERENCES os(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('em_andamento', 'concluido', 'erro')),
  iniciado_em timestamptz NOT NULL DEFAULT now(),
  finalizado_em timestamptz,
  mudancas text[],
  novos_anexos integer,
  erro text
);

CREATE INDEX IF NOT EXISTS idx_os_sync_gspn_os_id_iniciado
  ON os_sync_gspn (os_id, iniciado_em DESC);

ALTER TABLE os_sync_gspn ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_select_os_sync_gspn" ON os_sync_gspn;
CREATE POLICY "authenticated_select_os_sync_gspn"
  ON os_sync_gspn FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "service_insert_os_sync_gspn" ON os_sync_gspn;
CREATE POLICY "service_insert_os_sync_gspn"
  ON os_sync_gspn FOR INSERT
  TO service_role
  WITH CHECK (true);

DROP POLICY IF EXISTS "service_update_os_sync_gspn" ON os_sync_gspn;
CREATE POLICY "service_update_os_sync_gspn"
  ON os_sync_gspn FOR UPDATE
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Enable realtime for this table
ALTER PUBLICATION supabase_realtime ADD TABLE os_sync_gspn;
