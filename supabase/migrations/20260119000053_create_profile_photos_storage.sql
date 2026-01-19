/*
  # Criar Storage Bucket para Fotos de Perfil

  ## Objetivo
  Criar bucket de armazenamento para fotos de perfil dos usuários
  
  ## Estrutura
  1. Criar bucket profile-photos
  2. Configurar políticas de acesso
  3. Permitir usuários fazer upload de suas fotos
  4. Todos podem visualizar fotos de perfil
*/

-- Criar bucket para fotos de perfil
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-photos', 'profile-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Policy: Todos podem visualizar fotos de perfil (bucket é público)
CREATE POLICY "Anyone can view profile photos"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'profile-photos');

-- Policy: Usuários podem fazer upload de suas próprias fotos
CREATE POLICY "Users can upload their own profile photo"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Usuários podem atualizar suas próprias fotos
CREATE POLICY "Users can update their own profile photo"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
)
WITH CHECK (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Usuários podem deletar suas próprias fotos
CREATE POLICY "Users can delete their own profile photo"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
