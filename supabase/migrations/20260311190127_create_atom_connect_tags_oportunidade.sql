/*
  # Create Atom Connect Tags de Oportunidade table

  1. New Tables
    - `atom_connect_tags_oportunidade`
      - `id` (uuid, primary key)
      - `unidade_id` (uuid, references unidades, nullable for global tags)
      - `value` (text, unique identifier/slug for the tag)
      - `label` (text, display name)
      - `color` (text, hex color code)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS on the table
    - Authenticated users in the same unit can read tags
    - Authenticated users can insert/update/delete tags only if no conversations use them

  3. Seed Data
    - Inserts the 6 default tags that were previously hardcoded

  4. Notes
    - Tags with `unidade_id = NULL` are global/shared
    - The `value` field is the slug used in `tags_oportunidade` array on conversations
    - Once a tag `value` is used by a conversation, the tag label/color can still change,
      but the tag itself cannot be deleted
*/

CREATE TABLE IF NOT EXISTS atom_connect_tags_oportunidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid REFERENCES unidades(id) ON DELETE CASCADE,
  value text NOT NULL,
  label text NOT NULL,
  color text NOT NULL DEFAULT '#6b7280',
  created_at timestamptz DEFAULT now(),
  UNIQUE(value, unidade_id)
);

ALTER TABLE atom_connect_tags_oportunidade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read tags for their unit"
  ON atom_connect_tags_oportunidade
  FOR SELECT
  TO authenticated
  USING (
    unidade_id IS NULL
    OR unidade_id IN (
      SELECT u.unidade_id FROM usuarios u WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can insert tags"
  ON atom_connect_tags_oportunidade
  FOR INSERT
  TO authenticated
  WITH CHECK (
    unidade_id IS NULL
    OR unidade_id IN (
      SELECT u.unidade_id FROM usuarios u WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can update tags"
  ON atom_connect_tags_oportunidade
  FOR UPDATE
  TO authenticated
  USING (
    unidade_id IS NULL
    OR unidade_id IN (
      SELECT u.unidade_id FROM usuarios u WHERE u.id = auth.uid()
    )
  )
  WITH CHECK (
    unidade_id IS NULL
    OR unidade_id IN (
      SELECT u.unidade_id FROM usuarios u WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can delete unused tags"
  ON atom_connect_tags_oportunidade
  FOR DELETE
  TO authenticated
  USING (
    (
      unidade_id IS NULL
      OR unidade_id IN (
        SELECT u.unidade_id FROM usuarios u WHERE u.id = auth.uid()
      )
    )
    AND NOT EXISTS (
      SELECT 1 FROM atom_connect_conversas c
      WHERE c.tags_oportunidade @> ARRAY[atom_connect_tags_oportunidade.value]
    )
  );

INSERT INTO atom_connect_tags_oportunidade (unidade_id, value, label, color) VALUES
  (NULL, 'venda_perdida', 'Venda Perdida', '#ef4444'),
  (NULL, 'orcamento_pendente', 'Orcamento Pendente', '#f59e0b'),
  (NULL, 'cliente_quente', 'Cliente Quente', '#f97316'),
  (NULL, 'recontatar', 'Recontatar', '#3b82f6'),
  (NULL, 'fidelizar', 'Fidelizar', '#10b981'),
  (NULL, 'indicacao', 'Indicacao', '#8b5cf6')
ON CONFLICT DO NOTHING;
