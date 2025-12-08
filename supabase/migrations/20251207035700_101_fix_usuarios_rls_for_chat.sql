/*
  # Fix usuarios RLS policy for chat functionality

  1. Problem
    - Current SELECT policy on usuarios table only allows users to see:
      - Their own profile
      - Users from their unit (if they are master/diretoria/gerente/administrador)
    - This prevents lower-tier users (tecnico, tecnico_ih, etc) from seeing other users in the chat

  2. Solution
    - Update SELECT policy to allow all authenticated users to see all active users
    - This is necessary for the chat functionality to work properly
    - Keep INSERT/UPDATE/DELETE policies unchanged for security

  3. Changes
    - Drop existing SELECT policy
    - Create new SELECT policy allowing all authenticated users to view all users
*/

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "usuarios_select_policy" ON usuarios;

-- Create new SELECT policy allowing all authenticated users to see all users
CREATE POLICY "usuarios_select_policy"
  ON usuarios FOR SELECT
  TO authenticated
  USING (true);

COMMENT ON POLICY "usuarios_select_policy" ON usuarios IS 'All authenticated users can view all users for chat and collaboration features';
