/*
  # Storage Bucket para Avaliações de Vendas

  1. Criar Bucket
    - Nome: `vendas-avaliacoes`
    - Público: false (apenas autenticados)
    - Para armazenar comprovantes de avaliações (screenshots, PDFs, etc)

  2. Políticas de Segurança
    - Usuários autenticados podem fazer upload
    - Apenas o criador, vendedor da venda ou gestores podem visualizar
    - Apenas gestores podem deletar
*/

-- Criar bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'vendas-avaliacoes',
  'vendas-avaliacoes',
  false,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'image/jpg']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Usuários autenticados podem fazer upload
CREATE POLICY "Usuários podem fazer upload de avaliações"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'vendas-avaliacoes'
  AND auth.uid() IS NOT NULL
);

-- Policy: Usuários podem ver suas próprias avaliações ou se forem gestores
CREATE POLICY "Usuários podem ver avaliações autorizadas"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'vendas-avaliacoes'
  AND (
    owner = auth.uid()
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente', 'administrador')
    )
  )
);

-- Policy: Usuários podem atualizar suas próprias avaliações
CREATE POLICY "Usuários podem atualizar suas avaliações"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'vendas-avaliacoes'
  AND owner = auth.uid()
)
WITH CHECK (
  bucket_id = 'vendas-avaliacoes'
  AND owner = auth.uid()
);

-- Policy: Apenas gestores podem deletar
CREATE POLICY "Gestores podem deletar avaliações"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'vendas-avaliacoes'
  AND EXISTS (
    SELECT 1 FROM usuarios
    WHERE usuarios.id = auth.uid()
    AND usuarios.tipo IN ('master', 'diretor', 'gerente', 'administrador')
  )
);
