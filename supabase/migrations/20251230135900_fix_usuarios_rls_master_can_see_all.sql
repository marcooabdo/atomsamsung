/*
  # Fix usuarios RLS policy for master users

  1. Changes
    - Update SELECT policy to allow master/diretoria users to see ALL users
    - Remove the restriction that master/diretoria must have NULL unidade_id to see all users
    - Keep the restriction that gerente/administrador can only see users from their own unit

  2. Security
    - Master and diretoria users can see all users regardless of their own unidade_id
    - Gerente and administrador can only see users from their own unidade_id
    - All users can see their own profile
*/

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "usuarios_select_policy" ON usuarios;

-- Recreate SELECT policy with fixed logic
CREATE POLICY "usuarios_select_policy"
  ON usuarios
  FOR SELECT
  TO authenticated
  USING (
    -- User can see their own profile
    id = auth.uid()
    OR
    EXISTS (
      SELECT 1
      FROM get_current_user_info() cui
      WHERE
        -- Master and diretoria can see ALL users (no unidade_id restriction)
        cui.user_tipo IN ('master', 'diretoria')
        OR
        -- Gerente and administrador can see users from their own unit
        (
          cui.user_tipo IN ('gerente', 'administrador')
          AND cui.user_unidade_id = usuarios.unidade_id
        )
    )
  );

-- Drop existing UPDATE policy
DROP POLICY IF EXISTS "usuarios_update_policy" ON usuarios;

-- Recreate UPDATE policy with same logic
CREATE POLICY "usuarios_update_policy"
  ON usuarios
  FOR UPDATE
  TO authenticated
  USING (
    -- User can update their own profile
    id = auth.uid()
    OR
    EXISTS (
      SELECT 1
      FROM get_current_user_info() cui
      WHERE
        -- Master and diretoria can update ALL users
        cui.user_tipo IN ('master', 'diretoria')
        OR
        -- Gerente and administrador can update users from their own unit
        (
          cui.user_tipo IN ('gerente', 'administrador')
          AND cui.user_unidade_id = usuarios.unidade_id
        )
    )
  )
  WITH CHECK (
    -- Same check for the updated data
    id = auth.uid()
    OR
    EXISTS (
      SELECT 1
      FROM get_current_user_info() cui
      WHERE
        cui.user_tipo IN ('master', 'diretoria')
        OR
        (
          cui.user_tipo IN ('gerente', 'administrador')
          AND cui.user_unidade_id = usuarios.unidade_id
        )
    )
  );
