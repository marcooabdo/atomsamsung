/*
  # Fix usuarios RLS policy for chat - Allow all users to see all users

  1. Changes
    - Update SELECT policy to allow ALL authenticated users to see ALL users
    - This enables the chat system to work properly where everyone needs to see everyone
    - Keep the restriction on UPDATE, INSERT, DELETE for security

  2. Security
    - ALL authenticated users can see all users (read-only for non-privileged users)
    - Only master, diretoria, gerente, and administrador can update users based on their permissions
    - Chat system requires everyone to see everyone to start conversations
*/

-- Drop existing SELECT policy
DROP POLICY IF EXISTS "usuarios_select_policy" ON usuarios;

-- Recreate SELECT policy - ALL authenticated users can see ALL users
CREATE POLICY "usuarios_select_policy"
  ON usuarios
  FOR SELECT
  TO authenticated
  USING (true);
