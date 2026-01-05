/*
  # Fix chat_conversations RLS to use helper function
  
  1. Problem
    - The SELECT policy on chat_conversations queries chat_participants
    - This can cause cross-table recursion issues
  
  2. Solution
    - Use the is_chat_participant function to avoid recursion
*/

DROP POLICY IF EXISTS "Users can view conversations they participate in" ON chat_conversations;

CREATE POLICY "Users can view conversations they participate in"
  ON chat_conversations
  FOR SELECT
  TO authenticated
  USING (is_chat_participant(id));

DROP POLICY IF EXISTS "Group admins can update group info" ON chat_conversations;

CREATE POLICY "Group admins can update group info"
  ON chat_conversations
  FOR UPDATE
  TO authenticated
  USING (
    tipo = 'group' AND (
      is_chat_participant(id) OR
      EXISTS (
        SELECT 1 FROM usuarios
        WHERE usuarios.id = auth.uid()
        AND usuarios.tipo IN ('master', 'diretoria')
      )
    )
  );
