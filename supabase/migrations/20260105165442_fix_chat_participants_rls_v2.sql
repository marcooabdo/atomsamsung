/*
  # Fix chat_participants RLS - Version 2
  
  1. Problem
    - Previous fix still had recursion issue
  
  2. Solution
    - Create a security definer function to check participation
    - Use this function in the policy to avoid recursion
*/

CREATE OR REPLACE FUNCTION is_chat_participant(p_conversation_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM chat_participants
    WHERE conversation_id = p_conversation_id
    AND user_id = auth.uid()
  );
$$;

DROP POLICY IF EXISTS "Users can view participants of their conversations" ON chat_participants;

CREATE POLICY "Users can view participants of their conversations"
  ON chat_participants
  FOR SELECT
  TO authenticated
  USING (is_chat_participant(conversation_id));
