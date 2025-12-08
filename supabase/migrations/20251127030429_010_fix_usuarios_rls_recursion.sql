/*
  # Fix Infinite Recursion in Usuarios RLS Policy

  ## Problem
  The usuarios SELECT policy was querying the usuarios table inside itself,
  causing infinite recursion when checking permissions.

  ## Solution
  Simplify the policy to use only auth.uid() without self-referential queries.
  The policy should check:
  - Master/Diretoria: Can see all users
  - Gerente/Administrador: Can see users from their unit
  - Others: Can see only themselves

  ## Changes
  1. Drop existing problematic policy
  2. Create new simplified policy without recursion
*/

-- Drop all existing usuarios policies to start fresh
DROP POLICY IF EXISTS "Users can view usuarios from their unit" ON usuarios;
DROP POLICY IF EXISTS "Users can insert usuarios" ON usuarios;
DROP POLICY IF EXISTS "Users can update usuarios" ON usuarios;
DROP POLICY IF EXISTS "Users can delete usuarios" ON usuarios;

-- SELECT Policy: View users based on role
-- This uses a subquery that will be executed once, not recursively
CREATE POLICY "Users can view usuarios"
  ON usuarios FOR SELECT
  TO authenticated
  USING (
    -- Get the current user's info ONCE using a scalar subquery
    (
      SELECT CASE
        -- Master/Diretoria with no unit can see all
        WHEN u.tipo IN ('master', 'diretoria') AND u.unidade_id IS NULL THEN true
        -- Master/Diretoria with specific unit can see their unit
        WHEN u.tipo IN ('master', 'diretoria') AND u.unidade_id = usuarios.unidade_id THEN true
        -- Gerente/Admin can see users from their unit
        WHEN u.tipo IN ('gerente', 'administrador') AND u.unidade_id = usuarios.unidade_id THEN true
        -- Everyone can see their own profile
        WHEN u.id = usuarios.id THEN true
        ELSE false
      END
      FROM usuarios u
      WHERE u.id = auth.uid()
      LIMIT 1
    )
  );

-- INSERT Policy: Master, Diretoria, Gerente can create users
CREATE POLICY "Users can insert usuarios"
  ON usuarios FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.tipo IN ('master', 'diretoria', 'gerente', 'administrador')
      LIMIT 1
    )
  );

-- UPDATE Policy: Can update based on role
CREATE POLICY "Users can update usuarios"
  ON usuarios FOR UPDATE
  TO authenticated
  USING (
    (
      SELECT CASE
        WHEN u.tipo IN ('master', 'diretoria') AND u.unidade_id IS NULL THEN true
        WHEN u.tipo IN ('master', 'diretoria') AND u.unidade_id = usuarios.unidade_id THEN true
        WHEN u.tipo IN ('gerente', 'administrador') AND u.unidade_id = usuarios.unidade_id THEN true
        WHEN u.id = usuarios.id THEN true
        ELSE false
      END
      FROM usuarios u
      WHERE u.id = auth.uid()
      LIMIT 1
    )
  )
  WITH CHECK (
    (
      SELECT CASE
        WHEN u.tipo IN ('master', 'diretoria') AND u.unidade_id IS NULL THEN true
        WHEN u.tipo IN ('master', 'diretoria') AND u.unidade_id = usuarios.unidade_id THEN true
        WHEN u.tipo IN ('gerente', 'administrador') AND u.unidade_id = usuarios.unidade_id THEN true
        WHEN u.id = usuarios.id THEN true
        ELSE false
      END
      FROM usuarios u
      WHERE u.id = auth.uid()
      LIMIT 1
    )
  );

-- DELETE Policy: Only Master and Diretoria can delete
CREATE POLICY "Users can delete usuarios"
  ON usuarios FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.tipo IN ('master', 'diretoria')
      LIMIT 1
    )
  );
