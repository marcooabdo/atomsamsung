/*
  # Políticas RLS para Storage de Anexos de Cotações

  1. Políticas:
    - Usuários autenticados podem fazer upload de anexos
    - Usuários autenticados podem visualizar anexos
    - Usuários autenticados podem deletar anexos

  2. Segurança:
    - Apenas usuários autenticados têm acesso
    - Arquivos organizados por cotacao_id
*/

-- Política de INSERT (upload)
CREATE POLICY "Usuários autenticados podem fazer upload de anexos"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'cotacoes-anexos'
);

-- Política de SELECT (visualizar)
CREATE POLICY "Usuários autenticados podem visualizar anexos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'cotacoes-anexos'
);

-- Política de DELETE (deletar)
CREATE POLICY "Usuários autenticados podem deletar anexos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'cotacoes-anexos'
);

-- Política de UPDATE (atualizar)
CREATE POLICY "Usuários autenticados podem atualizar anexos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'cotacoes-anexos'
);
