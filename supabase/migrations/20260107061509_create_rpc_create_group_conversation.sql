/*
  # Create RPC for creating group conversations
  
  1. Problem
    - RLS policy for INSERT on chat_conversations checks auth.uid() = created_by
    - But the userId from usuarios table may not match auth.uid()
    - This causes 403 Forbidden errors
  
  2. Solution
    - Create a SECURITY DEFINER function that bypasses RLS
    - Function validates user exists and creates conversation + participants
    - Returns the new conversation ID
*/

CREATE OR REPLACE FUNCTION create_group_conversation(
  p_nome text,
  p_descricao text,
  p_created_by uuid,
  p_member_ids uuid[]
)
RETURNS uuid AS $$
DECLARE
  v_conversation_id uuid;
  v_member_id uuid;
BEGIN
  -- Validate creator exists in usuarios
  IF NOT EXISTS (SELECT 1 FROM usuarios WHERE id = p_created_by) THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  -- Create the conversation
  INSERT INTO chat_conversations (tipo, nome, descricao, created_by)
  VALUES ('group', p_nome, p_descricao, p_created_by)
  RETURNING id INTO v_conversation_id;

  -- Add creator as admin
  INSERT INTO chat_participants (conversation_id, user_id, role)
  VALUES (v_conversation_id, p_created_by, 'admin');

  -- Add all members
  FOREACH v_member_id IN ARRAY p_member_ids
  LOOP
    IF v_member_id != p_created_by THEN
      INSERT INTO chat_participants (conversation_id, user_id, role)
      VALUES (v_conversation_id, v_member_id, 'member')
      ON CONFLICT (conversation_id, user_id) DO NOTHING;
    END IF;
  END LOOP;

  RETURN v_conversation_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION create_group_conversation(text, text, uuid, uuid[]) TO authenticated;