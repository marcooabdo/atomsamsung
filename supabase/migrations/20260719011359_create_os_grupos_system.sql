/*
# Create OS Grouping System

Allows multiple OS (service orders) for the same product/client to be linked
into a single group, so only the most recent OS appears as a card in the Kanban.

1. New Tables
   - `os_grupos`
     - `id` (uuid, primary key) - Group identifier
     - `unidade_id` (uuid, FK to unidades) - Unit that owns the group
     - `created_by` (uuid, nullable) - User who created the group
     - `created_at` (timestamptz) - When the group was created

2. Modified Tables
   - `os`
     - `grupo_os_id` (uuid, nullable, FK to os_grupos.id) - Links OS to a group

3. Security
   - RLS enabled on `os_grupos`
   - Permissive policies for authenticated users (same pattern as os table)

4. Important Notes
   - OS without grupo_os_id continue to appear as individual Kanban cards
   - Within a group, the most recent OS (by created_at) is the "representative" shown in Kanban
   - All OS in a group are peers (no parent/child hierarchy)
   - Linking/unlinking is always manual
*/

-- Create os_grupos table
CREATE TABLE IF NOT EXISTS public.os_grupos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid REFERENCES public.unidades(id) ON DELETE CASCADE,
  created_by uuid REFERENCES public.usuarios(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.os_grupos ENABLE ROW LEVEL SECURITY;

-- Policies for os_grupos
DROP POLICY IF EXISTS "select_os_grupos" ON public.os_grupos;
CREATE POLICY "select_os_grupos" ON public.os_grupos FOR SELECT
  TO authenticated USING (true);

DROP POLICY IF EXISTS "insert_os_grupos" ON public.os_grupos;
CREATE POLICY "insert_os_grupos" ON public.os_grupos FOR INSERT
  TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_os_grupos" ON public.os_grupos;
CREATE POLICY "update_os_grupos" ON public.os_grupos FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_os_grupos" ON public.os_grupos;
CREATE POLICY "delete_os_grupos" ON public.os_grupos FOR DELETE
  TO authenticated USING (true);

-- Add grupo_os_id column to os table
ALTER TABLE public.os ADD COLUMN IF NOT EXISTS grupo_os_id uuid REFERENCES public.os_grupos(id) ON DELETE SET NULL;

-- Index for fast lookups of grouped OS
CREATE INDEX IF NOT EXISTS idx_os_grupo_os_id ON public.os(grupo_os_id) WHERE grupo_os_id IS NOT NULL;
