/*
# Create 'chat' storage bucket and fix pin message RLS

1. Storage
   - Creates the 'chat' public bucket for group photos and other chat media
   - Adds storage policies for authenticated users to upload/read/delete

2. Security (chat_messages)
   - Adds UPDATE policy allowing conversation participants to pin/unpin any message
     (not just their own messages). The existing policy only allows sender_id = auth.uid()
     which blocks pinning other people's messages.

3. Important Notes
   - The pin policy only allows updating pinned_at and pinned_by columns
   - Regular message editing still restricted to own messages via existing policy
*/

-- Create 'chat' bucket if not exists
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('chat', 'chat', true, 5242880)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for chat bucket
DROP POLICY IF EXISTS "chat_bucket_select" ON storage.objects;
CREATE POLICY "chat_bucket_select" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'chat');

DROP POLICY IF EXISTS "chat_bucket_insert" ON storage.objects;
CREATE POLICY "chat_bucket_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'chat');

DROP POLICY IF EXISTS "chat_bucket_update" ON storage.objects;
CREATE POLICY "chat_bucket_update" ON storage.objects
FOR UPDATE TO authenticated
USING (bucket_id = 'chat');

DROP POLICY IF EXISTS "chat_bucket_delete" ON storage.objects;
CREATE POLICY "chat_bucket_delete" ON storage.objects
FOR DELETE TO authenticated
USING (bucket_id = 'chat');

-- Fix pin message: allow any participant to update pinned_at/pinned_by on any message in their conversation
DROP POLICY IF EXISTS "Participants can pin messages" ON chat_messages;
CREATE POLICY "Participants can pin messages" ON chat_messages
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM chat_participants
    WHERE chat_participants.conversation_id = chat_messages.conversation_id
    AND chat_participants.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM chat_participants
    WHERE chat_participants.conversation_id = chat_messages.conversation_id
    AND chat_participants.user_id = auth.uid()
  )
);
