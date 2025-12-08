/*
  # Fix estoque_nfs RLS Policies for INSERT

  ## Summary
  Fixes the RLS policies on estoque_nfs to allow INSERT operations by estoque users.
  The existing "ALL" policy doesn't work for INSERT because it lacks WITH CHECK clause.

  ## Changes
  - Drop existing policies on estoque_nfs
  - Create separate SELECT, INSERT, UPDATE, DELETE policies
  - Ensure master/diretoria can access all units
  - Ensure estoque users can only access their own unit

  ## Security
  - Master/Diretoria users can manage NFs in all units
  - Estoque/Gerente/Administrador can only manage NFs in their unit
  - Proper access control maintained
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Estoque e gerentes podem gerenciar NFs" ON estoque_nfs;
DROP POLICY IF EXISTS "Usuários podem ver NFs de sua unidade" ON estoque_nfs;

-- SELECT: Master/Diretoria see all, others see only their unit
CREATE POLICY "View NFs based on user type and unit"
  ON estoque_nfs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND (
        -- Master/Diretoria see ALL NFs
        usuarios.tipo IN ('master', 'diretoria')
        -- Other users see only their unit NFs
        OR (usuarios.unidade_id IS NOT NULL AND usuarios.unidade_id = estoque_nfs.unidade_id)
      )
    )
  );

-- INSERT: Estoque can insert in their unit, Master in any unit
CREATE POLICY "Insert NFs in accessible units"
  ON estoque_nfs FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretoria', 'gerente', 'administrador', 'estoque')
      AND (
        -- Master/Diretoria can insert in any unit
        usuarios.tipo IN ('master', 'diretoria')
        -- Other users insert only in their unit
        OR (usuarios.unidade_id IS NOT NULL AND usuarios.unidade_id = estoque_nfs.unidade_id)
      )
    )
  );

-- UPDATE: Estoque can update in their unit, Master in any unit
CREATE POLICY "Update NFs in accessible units"
  ON estoque_nfs FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretoria', 'gerente', 'administrador', 'estoque')
      AND (
        usuarios.tipo IN ('master', 'diretoria')
        OR (usuarios.unidade_id IS NOT NULL AND usuarios.unidade_id = estoque_nfs.unidade_id)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretoria', 'gerente', 'administrador', 'estoque')
      AND (
        usuarios.tipo IN ('master', 'diretoria')
        OR (usuarios.unidade_id IS NOT NULL AND usuarios.unidade_id = estoque_nfs.unidade_id)
      )
    )
  );

-- DELETE: Estoque can delete in their unit, Master in any unit
CREATE POLICY "Delete NFs in accessible units"
  ON estoque_nfs FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretoria', 'gerente', 'administrador', 'estoque')
      AND (
        usuarios.tipo IN ('master', 'diretoria')
        OR (usuarios.unidade_id IS NOT NULL AND usuarios.unidade_id = estoque_nfs.unidade_id)
      )
    )
  );
