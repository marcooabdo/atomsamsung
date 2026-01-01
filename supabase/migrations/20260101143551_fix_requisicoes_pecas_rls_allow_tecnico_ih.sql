/*
  # Fix requisicoes_pecas RLS policies for tecnico_ih users

  1. Changes
    - Add policy to allow tecnico_ih users to see requisicoes for their OS
    - Add policy to allow tecnico_ih users to update requisicoes status

  2. Security
    - tecnico_ih users can only access requisicoes for OS where they are tecnico_agendado_id
*/

CREATE POLICY "Técnicos IH veem requisições das suas OS" ON requisicoes_pecas
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM os o
      JOIN usuarios u ON u.id = auth.uid()
      WHERE o.id = requisicoes_pecas.os_id
      AND u.tipo = 'tecnico_ih'
      AND u.id = o.tecnico_agendado_id
    )
  );

CREATE POLICY "Técnicos IH atualizam requisições das suas OS" ON requisicoes_pecas
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM os o
      JOIN usuarios u ON u.id = auth.uid()
      WHERE o.id = requisicoes_pecas.os_id
      AND u.tipo = 'tecnico_ih'
      AND u.id = o.tecnico_agendado_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM os o
      JOIN usuarios u ON u.id = auth.uid()
      WHERE o.id = requisicoes_pecas.os_id
      AND u.tipo = 'tecnico_ih'
      AND u.id = o.tecnico_agendado_id
    )
  );
