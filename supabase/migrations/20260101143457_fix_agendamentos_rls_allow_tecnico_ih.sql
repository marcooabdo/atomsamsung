/*
  # Fix Agendamentos RLS policies for tecnico_ih users

  1. Changes
    - Update SELECT policy to allow tecnico_ih users to see their agendamentos
    - Update UPDATE policy to allow tecnico_ih users to update their agendamentos
    - Remove duplicate policies and consolidate

  2. Security
    - tecnico_ih users can only see/update agendamentos where they are the tecnico_id
*/

DROP POLICY IF EXISTS "Usuários podem ver agendamentos baseado em permissão" ON agendamentos;
DROP POLICY IF EXISTS "Usuários podem ver agendamentos relevantes" ON agendamentos;
DROP POLICY IF EXISTS "Operacional, gerentes e técnicos podem atualizar agendamentos" ON agendamentos;

CREATE POLICY "agendamentos_select_policy" ON agendamentos
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo = 'master'
        OR u.unidade_id = agendamentos.unidade_id
        OR agendamentos.tecnico_id = auth.uid()
        OR (u.tipo IN ('recepcao', 'gerente', 'tecnico', 'tecnico_ih'))
      )
    )
  );

CREATE POLICY "agendamentos_update_policy" ON agendamentos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo = 'master'
        OR (u.tipo IN ('gerente', 'administrador', 'recepcao') AND u.unidade_id = agendamentos.unidade_id)
        OR (u.tipo IN ('tecnico', 'tecnico_ih') AND agendamentos.tecnico_id = auth.uid())
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo = 'master'
        OR (u.tipo IN ('gerente', 'administrador', 'recepcao') AND u.unidade_id = agendamentos.unidade_id)
        OR (u.tipo IN ('tecnico', 'tecnico_ih') AND agendamentos.tecnico_id = auth.uid())
      )
    )
  );
