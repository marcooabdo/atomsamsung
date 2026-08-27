/*
# Add chat notification preferences and mute support

1. Modified Tables
   - `usuarios`: Added `chat_notif_mode` column (text, default 'all')
     - 'all' = show sender name + message preview
     - 'minimal' = show only "Nova mensagem" without details
     - 'off' = no notifications at all
   - `chat_participants`: Added `muted_at` column (timestamptz, nullable)
     - When not null, the conversation is muted for this user

2. Important Notes
   - Users can mute individual conversations
   - Notification mode is a per-user global preference
   - Muted conversations override the global preference (always silent)
*/

-- Add notification mode preference to usuarios
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'usuarios' AND column_name = 'chat_notif_mode'
  ) THEN
    ALTER TABLE public.usuarios ADD COLUMN chat_notif_mode text NOT NULL DEFAULT 'all';
  END IF;
END $$;

-- Add muted_at to chat_participants
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'chat_participants' AND column_name = 'muted_at'
  ) THEN
    ALTER TABLE public.chat_participants ADD COLUMN muted_at timestamptz DEFAULT NULL;
  END IF;
END $$;
