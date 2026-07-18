/*
# Create usuario_unidades junction table for multi-unit access

## Purpose
Allow users to have access to additional units beyond their primary `unidade_id`.
A user's primary unit remains in `usuarios.unidade_id`, but they can now also
access OS, parts, and other data from additional units listed in this table.

## New Tables
- `usuario_unidades`
  - `id` (uuid, primary key)
  - `usuario_id` (uuid, FK to usuarios.id, NOT NULL)
  - `unidade_id` (uuid, FK to unidades.id, NOT NULL)
  - `created_at` (timestamptz)
  - Unique constraint on (usuario_id, unidade_id) to prevent duplicates

## Security
- RLS enabled
- Authenticated users can read entries (needed for filtering logic)
- Master/diretoria/gerente/administrador can insert/update/delete
*/

CREATE TABLE IF NOT EXISTS usuario_unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(usuario_id, unidade_id)
);

ALTER TABLE usuario_unidades ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_usuario_unidades" ON usuario_unidades;
CREATE POLICY "select_usuario_unidades" ON usuario_unidades FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_usuario_unidades" ON usuario_unidades;
CREATE POLICY "insert_usuario_unidades" ON usuario_unidades FOR INSERT
  TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.tipo IN ('master', 'diretoria', 'gerente', 'administrador')
    )
  );

DROP POLICY IF EXISTS "update_usuario_unidades" ON usuario_unidades;
CREATE POLICY "update_usuario_unidades" ON usuario_unidades FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.tipo IN ('master', 'diretoria', 'gerente', 'administrador')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.tipo IN ('master', 'diretoria', 'gerente', 'administrador')
    )
  );

DROP POLICY IF EXISTS "delete_usuario_unidades" ON usuario_unidades;
CREATE POLICY "delete_usuario_unidades" ON usuario_unidades FOR DELETE
  TO authenticated USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.tipo IN ('master', 'diretoria', 'gerente', 'administrador')
    )
  );

CREATE INDEX IF NOT EXISTS idx_usuario_unidades_usuario_id ON usuario_unidades(usuario_id);
CREATE INDEX IF NOT EXISTS idx_usuario_unidades_unidade_id ON usuario_unidades(unidade_id);
