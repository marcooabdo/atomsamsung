/*
  # Corrigir Policies de Chat Storage

  ## Problema
  A policy de upload está verificando se o user_id corresponde ao foldername,
  mas o código usa conversation_id como foldername.

  ## Solução
  - Remover policies antigas
  - Criar nova policy que verifica se o usuário é participante da conversa
*/

-- Remover policies antigas
DROP POLICY IF EXISTS "Authenticated users can upload chat files" ON storage.objects;
DROP POLICY IF EXISTS "Public read access to chat files" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own chat files" ON storage.objects;

-- Política: permitir upload para participantes da conversa
CREATE POLICY "Chat participants can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-files'
  AND EXISTS (
    SELECT 1 FROM chat_participants cp
    WHERE cp.conversation_id::text = (storage.foldername(name))[1]
    AND cp.user_id = auth.uid()
  )
);

-- Política: permitir leitura pública (já que o bucket é público)
CREATE POLICY "Public can read chat files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'chat-files');

-- Política: permitir update para participantes da conversa
CREATE POLICY "Chat participants can update files"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'chat-files'
  AND EXISTS (
    SELECT 1 FROM chat_participants cp
    WHERE cp.conversation_id::text = (storage.foldername(name))[1]
    AND cp.user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'chat-files'
  AND EXISTS (
    SELECT 1 FROM chat_participants cp
    WHERE cp.conversation_id::text = (storage.foldername(name))[1]
    AND cp.user_id = auth.uid()
  )
);

-- Política: permitir deletar para participantes da conversa
CREATE POLICY "Chat participants can delete files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-files'
  AND EXISTS (
    SELECT 1 FROM chat_participants cp
    WHERE cp.conversation_id::text = (storage.foldername(name))[1]
    AND cp.user_id = auth.uid()
  )
);
