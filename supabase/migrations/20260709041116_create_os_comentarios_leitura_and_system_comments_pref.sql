/*
# Create comment read tracking and system comments preference

1. New Tables
- `os_comentarios_leitura`
  - `id` (uuid, primary key) - unique identifier
  - `usuario_id` (uuid, not null) - the user who read comments
  - `os_id` (uuid, not null) - the OS whose comments were read
  - `last_read_at` (timestamptz) - when the user last viewed comments for this OS
  - `created_at` (timestamptz) - record creation time
  - Unique constraint on (usuario_id, os_id) for upsert support

2. Modified Tables
- `usuarios`
  - Added `mostrar_comentarios_sistema` (boolean, default true) - global toggle for showing/hiding system logs in comments

3. Security
- Enable RLS on `os_comentarios_leitura`
- Permissive policies for anon + authenticated (consistent with existing app patterns)

4. Indexes
- Composite index on (usuario_id, os_id) for fast lookups
- Index on os_id for batch queries
*/

-- Create the read tracking table
CREATE TABLE IF NOT EXISTS os_comentarios_leitura (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL,
  os_id uuid NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(usuario_id, os_id)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_os_comentarios_leitura_usuario_os
  ON os_comentarios_leitura(usuario_id, os_id);
CREATE INDEX IF NOT EXISTS idx_os_comentarios_leitura_os_id
  ON os_comentarios_leitura(os_id);

-- RLS
ALTER TABLE os_comentarios_leitura ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_os_comentarios_leitura" ON os_comentarios_leitura;
CREATE POLICY "select_os_comentarios_leitura" ON os_comentarios_leitura FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_os_comentarios_leitura" ON os_comentarios_leitura;
CREATE POLICY "insert_os_comentarios_leitura" ON os_comentarios_leitura FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_os_comentarios_leitura" ON os_comentarios_leitura;
CREATE POLICY "update_os_comentarios_leitura" ON os_comentarios_leitura FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_os_comentarios_leitura" ON os_comentarios_leitura;
CREATE POLICY "delete_os_comentarios_leitura" ON os_comentarios_leitura FOR DELETE
  TO anon, authenticated USING (true);

-- Add preference column to usuarios
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'usuarios' AND column_name = 'mostrar_comentarios_sistema'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN mostrar_comentarios_sistema boolean NOT NULL DEFAULT true;
  END IF;
END $$;
