/*
  # Add UPDATE and DELETE policies for atom_connect_mensagens

  1. Changes
    - Add UPDATE policy using user_has_unit_access for the conversation's unit
    - Add DELETE policy using user_has_unit_access for the conversation's unit

  2. Reason
    - Without UPDATE policy, users cannot update message status (e.g. marking as read)
    - Without DELETE policy, users cannot delete messages if needed
    - Both use the same unit access check as SELECT and INSERT policies
*/

DROP POLICY IF EXISTS "Users can update messages" ON atom_connect_mensagens;
CREATE POLICY "Users can update messages"
  ON atom_connect_mensagens FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM atom_connect_conversas c
      WHERE c.id = atom_connect_mensagens.conversa_id
        AND user_has_unit_access(c.unidade_id)
    )
  );

DROP POLICY IF EXISTS "Users can delete messages" ON atom_connect_mensagens;
CREATE POLICY "Users can delete messages"
  ON atom_connect_mensagens FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM atom_connect_conversas c
      WHERE c.id = atom_connect_mensagens.conversa_id
        AND user_has_unit_access(c.unidade_id)
    )
  );
