/*
  # Fix OS RLS policies to allow tecnico_ih users

  1. Changes
    - Update os_select_policy to include tecnico_ih type
    - Update os_update_policy to include tecnico_ih type
    - Ensure tecnico_ih users can access their assigned OS

  2. Security
    - tecnico_ih users can only access OS where they are assigned as tecnico_agendado_id
    - Maintains existing security model for other user types
*/

DROP POLICY IF EXISTS "os_select_policy" ON os;

CREATE POLICY "os_select_policy" ON os
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR u.unidade_id = os.unidade_id
        OR u.id = os.tecnico_id
        OR u.id = os.tecnico_agendado_id
        OR (u.tipo = 'tecnico_ih' AND u.id = os.tecnico_agendado_id)
      )
    )
  );

DROP POLICY IF EXISTS "os_update_policy" ON os;

CREATE POLICY "os_update_policy" ON os
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR (u.tipo = 'gerente' AND u.unidade_id = os.unidade_id)
        OR (u.tipo = 'tecnico' AND u.id = os.tecnico_id)
        OR (u.tipo = 'tecnico_ih' AND u.id = os.tecnico_agendado_id)
        OR (u.tipo = 'recepcao' AND u.unidade_id = os.unidade_id)
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR (u.tipo = 'gerente' AND u.unidade_id = os.unidade_id)
        OR (u.tipo = 'tecnico' AND u.id = os.tecnico_id)
        OR (u.tipo = 'tecnico_ih' AND u.id = os.tecnico_agendado_id)
        OR (u.tipo = 'recepcao' AND u.unidade_id = os.unidade_id)
      )
    )
  );
