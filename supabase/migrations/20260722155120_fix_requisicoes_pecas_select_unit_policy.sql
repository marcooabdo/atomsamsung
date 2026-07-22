/*
# Fix requisicoes_pecas SELECT policies - ensure unit users can see all requisitions

Adds explicit unit-match check alongside the existing policies to prevent 
RLS from blocking legitimate reads.
*/

DROP POLICY IF EXISTS "Usuários veem requisições da unidade" ON requisicoes_pecas;
CREATE POLICY "Usuários veem requisições da unidade" ON requisicoes_pecas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR u.unidade_id = requisicoes_pecas.unidade_id
        OR EXISTS (
          SELECT 1 FROM usuario_unidades uu
          WHERE uu.usuario_id = u.id
          AND uu.unidade_id = requisicoes_pecas.unidade_id
        )
      )
    )
  );
