/*
# Add mentions and pinned messages to chat

1. Modified Tables
   - `chat_messages`
     - `mentioned_user_ids` (uuid[], nullable) - Array of user IDs mentioned in this message via @
     - `pinned_at` (timestamptz, nullable) - When the message was pinned (null = not pinned)
     - `pinned_by` (uuid, nullable) - Who pinned the message

2. Important Notes
   - Only one message can be pinned per conversation at a time (enforced by app logic, not constraint)
   - Any participant can pin/unpin messages
   - mentioned_user_ids is used to highlight notifications for mentioned users
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'mentioned_user_ids') THEN
    ALTER TABLE chat_messages ADD COLUMN mentioned_user_ids uuid[] DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'pinned_at') THEN
    ALTER TABLE chat_messages ADD COLUMN pinned_at timestamptz DEFAULT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'chat_messages' AND column_name = 'pinned_by') THEN
    ALTER TABLE chat_messages ADD COLUMN pinned_by uuid DEFAULT NULL;
  END IF;
END $$;
