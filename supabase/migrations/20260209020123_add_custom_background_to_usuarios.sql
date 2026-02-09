/*
  # Adicionar Plano de Fundo Personalizado aos Usuarios

  1. Alteracoes na tabela usuarios
    - Adiciona coluna `background_url` para armazenar URL do background personalizado

  2. Storage
    - Cria bucket para backgrounds personalizados

  3. Security
    - Politicas de storage para usuarios autenticados
*/

-- Adicionar coluna de background personalizado
ALTER TABLE usuarios
ADD COLUMN IF NOT EXISTS background_url text;

-- Criar bucket para backgrounds personalizados
INSERT INTO storage.buckets (id, name, public)
VALUES ('user-backgrounds', 'user-backgrounds', true)
ON CONFLICT (id) DO NOTHING;

-- Politicas de storage para backgrounds
CREATE POLICY "Users can upload their own background"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'user-backgrounds' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update their own background"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'user-backgrounds' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'user-backgrounds' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own background"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'user-backgrounds' 
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Anyone can view backgrounds"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'user-backgrounds');
