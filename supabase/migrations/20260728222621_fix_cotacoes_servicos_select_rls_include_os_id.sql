/*
# Fix cotacoes_servicos SELECT RLS policy to include rows linked by os_id

## Problem
The SELECT policy on cotacoes_servicos only checks cotacao_id, making rows
inserted with only os_id (no cotacao_id) invisible to the user after insert.
This causes the "click on a service and nothing happens" bug — the row IS inserted
but cannot be read back.

## Changes
- Drop existing SELECT policy that only checks cotacao_id
- Create new SELECT policy that checks EITHER cotacao_id OR os_id,
  matching the logic already used in INSERT/UPDATE/DELETE policies.

## Security
- Master users and users without unidade_id see everything
- Other users see rows belonging to their unit (via os or cotacao)
*/

DROP POLICY IF EXISTS "Users can view cotacoes_servicos" ON cotacoes_servicos;

CREATE POLICY "Users can view cotacoes_servicos"
ON cotacoes_servicos FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = (SELECT auth.uid())
    AND (
      u.tipo = 'master'
      OR u.unidade_id IS NULL
      OR (
        cotacoes_servicos.os_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM os WHERE os.id = cotacoes_servicos.os_id AND os.unidade_id = u.unidade_id
        )
      )
      OR (
        cotacoes_servicos.cotacao_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM cotacoes c WHERE c.id = cotacoes_servicos.cotacao_id AND c.unidade_id = u.unidade_id
        )
      )
    )
  )
);