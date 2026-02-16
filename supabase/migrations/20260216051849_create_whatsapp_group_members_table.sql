/*
  # Create WhatsApp Group Members table

  1. New Tables
    - `atom_connect_grupo_membros`
      - `id` (uuid, primary key)
      - `conversa_id` (uuid, FK to atom_connect_conversas)
      - `phone` (text) - member phone number
      - `name` (text) - member display name
      - `role` (text) - admin/superadmin/member
      - `foto_url` (text) - profile photo URL
      - `updated_at` (timestamptz)
      - `created_at` (timestamptz)

  2. Security
    - Enable RLS
    - Policies for authenticated users to read/write within their unit
*/

CREATE TABLE IF NOT EXISTS atom_connect_grupo_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES atom_connect_conversas(id) ON DELETE CASCADE,
  phone text NOT NULL,
  name text,
  role text DEFAULT 'member',
  foto_url text,
  updated_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  UNIQUE(conversa_id, phone)
);

ALTER TABLE atom_connect_grupo_membros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read group members"
  ON atom_connect_grupo_membros
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM atom_connect_conversas c
      JOIN atom_connect_instancias i ON i.unidade_id = c.unidade_id
      WHERE c.id = atom_connect_grupo_membros.conversa_id
    )
  );

CREATE POLICY "Authenticated users can insert group members"
  ON atom_connect_grupo_membros
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM atom_connect_conversas c
      WHERE c.id = atom_connect_grupo_membros.conversa_id
    )
  );

CREATE POLICY "Authenticated users can update group members"
  ON atom_connect_grupo_membros
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM atom_connect_conversas c
      WHERE c.id = atom_connect_grupo_membros.conversa_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM atom_connect_conversas c
      WHERE c.id = atom_connect_grupo_membros.conversa_id
    )
  );

CREATE POLICY "Authenticated users can delete group members"
  ON atom_connect_grupo_membros
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM atom_connect_conversas c
      WHERE c.id = atom_connect_grupo_membros.conversa_id
    )
  );
