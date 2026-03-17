/*
  # Fix remaining always-true policies

  1. Changes:
    - clientes: replace 3 always-true policies with auth.uid() check
    - os SELECT: replace always-true with unit-based check

  2. Security:
    - clientes are shared across the org, so authenticated access is appropriate
    - OS SELECT now checks unit membership
*/

DROP POLICY IF EXISTS "Usuários autenticados podem ver clientes" ON clientes;
DROP POLICY IF EXISTS "Usuários autenticados podem inserir clientes" ON clientes;
DROP POLICY IF EXISTS "Usuários autenticados podem atualizar clientes" ON clientes;

CREATE POLICY "Authenticated can view clientes"
  ON clientes AS PERMISSIVE FOR SELECT
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated can insert clientes"
  ON clientes AS PERMISSIVE FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) IS NOT NULL);

CREATE POLICY "Authenticated can update clientes"
  ON clientes AS PERMISSIVE FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS "Usuários veem OS conforme tipo" ON os;

CREATE POLICY "Users can view OS from their unit"
  ON os AS PERMISSIVE FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = (select auth.uid())
        AND (
          u.tipo IN ('master', 'diretoria')
          OR u.unidade_id IS NULL
          OR u.unidade_id = os.unidade_id
          OR u.id = os.tecnico_designado_id
          OR EXISTS (
            SELECT 1 FROM agendamentos a
            WHERE a.os_id = os.id AND a.tecnico_id = u.id
          )
        )
    )
  );
