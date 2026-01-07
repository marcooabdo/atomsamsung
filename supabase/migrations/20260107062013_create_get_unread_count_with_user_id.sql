/*
  # Create get_unread_conversations_count with user_id parameter
  
  1. Problem
    - Current RPC uses auth.uid() which may not match usuarios.id
  
  2. Solution
    - Create/replace function that accepts optional user_id parameter
    - Use SECURITY DEFINER to bypass RLS
*/

-- Create or replace the function
CREATE OR REPLACE FUNCTION get_unread_conversations_count(p_user_id uuid DEFAULT NULL)
RETURNS integer AS $$
DECLARE
  v_count integer;
  v_effective_user_id uuid;
BEGIN
  -- Use passed user_id or fall back to auth.uid()
  v_effective_user_id := COALESCE(p_user_id, auth.uid());
  
  IF v_effective_user_id IS NULL THEN
    RETURN 0;
  END IF;

  SELECT COUNT(DISTINCT c.id) INTO v_count
  FROM chat_conversations c
  INNER JOIN chat_participants p ON p.conversation_id = c.id
  WHERE p.user_id = v_effective_user_id
  AND EXISTS (
    SELECT 1
    FROM chat_messages m
    WHERE m.conversation_id = c.id
    AND m.created_at > COALESCE(p.last_read_at, '1970-01-01'::timestamptz)
    AND m.sender_id != v_effective_user_id
    AND m.deleted_at IS NULL
  );

  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_unread_conversations_count(uuid) TO authenticated;