/*
# Fix os_pecas SELECT RLS policy to include all unit-access users

The current os_pecas SELECT policy uses user_has_access_to_unit but also requires
a separate tecnico_id check. This migration consolidates into a single robust policy
that covers: master/diretoria (see all), users in the same unit, and technicians
assigned to the OS.
*/

DROP POLICY IF EXISTS "os_pecas_select" ON os_pecas;
CREATE POLICY "os_pecas_select" ON os_pecas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR u.unidade_id = (SELECT unidade_id FROM os WHERE os.id = os_pecas.os_id)
        OR EXISTS (
          SELECT 1 FROM usuario_unidades uu
          WHERE uu.usuario_id = u.id
          AND uu.unidade_id = (SELECT unidade_id FROM os WHERE os.id = os_pecas.os_id)
        )
        OR u.id = (SELECT tecnico_id FROM os WHERE os.id = os_pecas.os_id)
        OR u.id = (SELECT tecnico_agendado_id FROM os WHERE os.id = os_pecas.os_id)
      )
    )
  );
