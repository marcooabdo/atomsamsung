/*
  # Complete RLS Cleanup for Usuarios Table

  ## Problem
  Multiple conflicting and duplicate policies causing recursion issues.
  
  ## Solution
  1. Drop ALL existing policies
  2. Create ONE simple policy per operation
  3. Use security definer function to avoid recursion
  
  ## Approach
  Create a security definer function that checks user permissions
  without causing recursion in the RLS policies.
*/

-- Drop ALL existing policies on usuarios
DROP POLICY IF EXISTS "Apenas masters podem criar usuários" ON usuarios;
DROP POLICY IF EXISTS "Master and Diretoria can insert users" ON usuarios;
DROP POLICY IF EXISTS "Only Master can delete users" ON usuarios;
DROP POLICY IF EXISTS "Users can delete usuarios" ON usuarios;
DROP POLICY IF EXISTS "Users can insert usuarios" ON usuarios;
DROP POLICY IF EXISTS "Users can update based on hierarchy" ON usuarios;
DROP POLICY IF EXISTS "Users can update usuarios" ON usuarios;
DROP POLICY IF EXISTS "Users can view based on hierarchy" ON usuarios;
DROP POLICY IF EXISTS "Users can view usuarios" ON usuarios;
DROP POLICY IF EXISTS "Usuários podem atualizar próprio perfil, masters podem atuali" ON usuarios;
DROP POLICY IF EXISTS "Usuários podem ver próprio perfil e outros usuários" ON usuarios;

-- Drop old function if exists
DROP FUNCTION IF EXISTS can_view_user(uuid, uuid);
DROP FUNCTION IF EXISTS get_user_permissions(uuid);

-- Create a security definer function to get current user's info
-- This function runs with elevated privileges and won't trigger RLS
CREATE OR REPLACE FUNCTION get_current_user_info()
RETURNS TABLE (
  user_tipo text,
  user_unidade_id uuid
) 
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT tipo, unidade_id
  FROM usuarios
  WHERE id = auth.uid()
  LIMIT 1;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_current_user_info() TO authenticated;

-- Now create simple policies using the function

-- SELECT Policy: View users
CREATE POLICY "usuarios_select_policy"
  ON usuarios FOR SELECT
  TO authenticated
  USING (
    -- Everyone can see their own profile
    id = auth.uid()
    OR
    -- Check permissions using the function
    EXISTS (
      SELECT 1 FROM get_current_user_info() AS cui
      WHERE 
        -- Master/Diretoria with no unit sees all
        (cui.user_tipo IN ('master', 'diretoria') AND cui.user_unidade_id IS NULL)
        OR
        -- Master/Diretoria/Gerente/Admin with unit sees their unit
        (cui.user_tipo IN ('master', 'diretoria', 'gerente', 'administrador') 
         AND cui.user_unidade_id = usuarios.unidade_id)
    )
  );

-- INSERT Policy: Create users
CREATE POLICY "usuarios_insert_policy"
  ON usuarios FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM get_current_user_info() AS cui
      WHERE cui.user_tipo IN ('master', 'diretoria', 'gerente', 'administrador')
    )
  );

-- UPDATE Policy: Update users
CREATE POLICY "usuarios_update_policy"
  ON usuarios FOR UPDATE
  TO authenticated
  USING (
    -- Can update own profile
    id = auth.uid()
    OR
    -- Or has permission
    EXISTS (
      SELECT 1 FROM get_current_user_info() AS cui
      WHERE 
        (cui.user_tipo IN ('master', 'diretoria') AND cui.user_unidade_id IS NULL)
        OR
        (cui.user_tipo IN ('master', 'diretoria', 'gerente', 'administrador') 
         AND cui.user_unidade_id = usuarios.unidade_id)
    )
  )
  WITH CHECK (
    -- Same check for the new values
    id = auth.uid()
    OR
    EXISTS (
      SELECT 1 FROM get_current_user_info() AS cui
      WHERE 
        (cui.user_tipo IN ('master', 'diretoria') AND cui.user_unidade_id IS NULL)
        OR
        (cui.user_tipo IN ('master', 'diretoria', 'gerente', 'administrador') 
         AND cui.user_unidade_id = usuarios.unidade_id)
    )
  );

-- DELETE Policy: Delete users (only Master/Diretoria)
CREATE POLICY "usuarios_delete_policy"
  ON usuarios FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_current_user_info() AS cui
      WHERE cui.user_tipo IN ('master', 'diretoria')
    )
  );

-- Add comment
COMMENT ON FUNCTION get_current_user_info() IS 'Security definer function to get current user info without RLS recursion';
