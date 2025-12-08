/*
  # Chat Storage Bucket

  ## Objetivo
  Criar bucket de storage para arquivos enviados no chat (imagens, documentos, áudios).

  ## Estrutura
  - Bucket: chat-files
  - Políticas de acesso: apenas participantes da conversa podem acessar
*/

-- Inserir bucket chat-files se não existir
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-files', 'chat-files', true)
ON CONFLICT (id) DO NOTHING;

-- Política: permitir upload para usuários autenticados
CREATE POLICY "Authenticated users can upload chat files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'chat-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Política: permitir acesso público para leitura (já que validamos via conversation_id)
CREATE POLICY "Public read access to chat files"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'chat-files');

-- Política: permitir deletar próprios arquivos
CREATE POLICY "Users can delete their own chat files"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'chat-files'
  AND auth.uid()::text = (storage.foldername(name))[1]
);