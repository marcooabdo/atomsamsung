/*
  # Fix os_comentarios RLS policies for tecnico_ih users

  1. Changes
    - Update SELECT policy to allow tecnico_ih users to see comments on their OS
    - Update INSERT policy to allow tecnico_ih users to create comments

  2. Security
    - tecnico_ih users can only access comments on OS where they are tecnico_agendado_id
*/

DROP POLICY IF EXISTS "Usuários podem ver comentários de OS acessíveis" ON os_comentarios;
DROP POLICY IF EXISTS "Usuários podem criar comentários em OS acessíveis" ON os_comentarios;

CREATE POLICY "os_comentarios_select_policy" ON os_comentarios
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM os o
      JOIN usuarios u ON u.id = auth.uid()
      WHERE o.id = os_comentarios.os_id
      AND (
        u.tipo = 'master'
        OR u.unidade_id = o.unidade_id
        OR u.id = o.tecnico_id
        OR u.id = o.tecnico_agendado_id
        OR (u.tipo = 'tecnico_ih' AND u.id = o.tecnico_agendado_id)
      )
    )
  );

CREATE POLICY "os_comentarios_insert_policy" ON os_comentarios
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM os o
      JOIN usuarios u ON u.id = auth.uid()
      WHERE o.id = os_comentarios.os_id
      AND (
        u.tipo = 'master'
        OR u.unidade_id = o.unidade_id
        OR u.id = o.tecnico_id
        OR u.id = o.tecnico_agendado_id
        OR (u.tipo = 'tecnico_ih' AND u.id = o.tecnico_agendado_id)
      )
    )
  );
