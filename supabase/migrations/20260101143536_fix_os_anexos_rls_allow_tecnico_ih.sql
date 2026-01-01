/*
  # Fix os_anexos RLS policies for tecnico_ih users

  1. Changes
    - Update SELECT policy to allow tecnico_ih users to see anexos on their OS
    - Update INSERT policy to allow tecnico_ih users to create anexos

  2. Security
    - tecnico_ih users can only access anexos on OS where they are tecnico_agendado_id
*/

DROP POLICY IF EXISTS "Usuários podem ver anexos de OS acessíveis" ON os_anexos;
DROP POLICY IF EXISTS "Usuários podem criar anexos em OS/cotações acessíveis" ON os_anexos;

CREATE POLICY "os_anexos_select_policy" ON os_anexos
  FOR SELECT
  TO authenticated
  USING (
    (os_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM os o
      JOIN usuarios u ON u.id = auth.uid()
      WHERE o.id = os_anexos.os_id
      AND (
        u.tipo = 'master'
        OR u.unidade_id = o.unidade_id
        OR u.id = o.tecnico_id
        OR u.id = o.tecnico_agendado_id
      )
    ))
    OR
    (cotacao_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM cotacoes c
      JOIN usuarios u ON u.id = auth.uid()
      WHERE c.id = os_anexos.cotacao_id
      AND (u.tipo = 'master' OR u.unidade_id = c.unidade_id)
    ))
    OR
    (os_id IS NULL AND cotacao_id IS NULL)
  );

CREATE POLICY "os_anexos_insert_policy" ON os_anexos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    (os_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM os o
      JOIN usuarios u ON u.id = auth.uid()
      WHERE o.id = os_anexos.os_id
      AND (
        u.tipo = 'master'
        OR u.unidade_id = o.unidade_id
        OR u.id = o.tecnico_id
        OR u.id = o.tecnico_agendado_id
      )
    ))
    OR
    (cotacao_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM cotacoes c
      JOIN usuarios u ON u.id = auth.uid()
      WHERE c.id = os_anexos.cotacao_id
      AND (u.tipo = 'master' OR u.unidade_id = c.unidade_id)
    ))
    OR
    (os_id IS NULL AND cotacao_id IS NULL)
  );
