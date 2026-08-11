/*
  # Fix atom_connect_mensagens INSERT RLS policy for users with additional units

  1. Changes
    - Drop the existing INSERT policy that only checks `u.unidade_id = c.unidade_id`
    - Replace with a new INSERT policy that uses `user_has_unit_access()` function
      which also checks the `usuario_unidades` junction table
    
  2. Problem
    - Users with access to multiple units (via `usuario_unidades` table) could NOT
      insert messages into conversations belonging to their additional units
    - The SELECT policy already used `user_has_unit_access()` but INSERT did not
    - This caused messages to silently fail to save in the database even though
      they were successfully sent via WhatsApp API

  3. Security
    - Uses the same `user_has_unit_access()` SECURITY DEFINER function used by SELECT
    - Maintains same level of access control, just correctly includes additional units
*/

DROP POLICY IF EXISTS "Users can insert messages" ON atom_connect_mensagens;

CREATE POLICY "Users can insert messages"
  ON atom_connect_mensagens FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM atom_connect_conversas c
      WHERE c.id = atom_connect_mensagens.conversa_id
        AND user_has_unit_access(c.unidade_id)
    )
  );
