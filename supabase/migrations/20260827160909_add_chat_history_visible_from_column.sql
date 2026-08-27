/*
# Add history visibility control for group members

1. Modified Tables
   - `chat_participants`: Added `history_visible_from` column (timestamptz, nullable)
     - NULL = member can see ALL history (full access)
     - timestamp = member can only see messages from that timestamp onward

2. Important Notes
   - When adding a new member with restricted history, set this to NOW()
   - Existing members keep NULL (full history access)
   - This only applies to group conversations
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chat_participants' AND column_name = 'history_visible_from'
  ) THEN
    ALTER TABLE public.chat_participants ADD COLUMN history_visible_from timestamptz DEFAULT NULL;
  END IF;
END $$;
