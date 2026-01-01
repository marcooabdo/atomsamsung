/*
  # Fix OS RLS to check agendamentos.tecnico_id

  1. Problem
    - The RLS policy only checks os.tecnico_agendado_id
    - But technicians are assigned via agendamentos.tecnico_id
    - This causes "Agendamento não encontrado" error for IH technicians

  2. Solution
    - Update os_select_policy to also check if user has an agendamento for the OS
    - Update os_update_policy similarly

  3. Security
    - Technicians can only access OS they are assigned to via agendamentos
    - All other existing permissions remain unchanged
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
        OR EXISTS (
          SELECT 1 FROM agendamentos a 
          WHERE a.os_id = os.id 
          AND a.tecnico_id = auth.uid()
        )
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
        OR EXISTS (
          SELECT 1 FROM agendamentos a 
          WHERE a.os_id = os.id 
          AND a.tecnico_id = auth.uid()
        )
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
        OR EXISTS (
          SELECT 1 FROM agendamentos a 
          WHERE a.os_id = os.id 
          AND a.tecnico_id = auth.uid()
        )
      )
    )
  );
