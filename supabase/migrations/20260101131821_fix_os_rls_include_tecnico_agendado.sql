/*
  # Corrigir RLS para incluir técnico agendado

  1. Alteração
    - Atualiza política de SELECT para permitir que técnicos vejam OS onde foram agendados
    - Adiciona verificação de tecnico_agendado_id além de tecnico_id
*/

-- Remover política antiga
DROP POLICY IF EXISTS "os_select_policy" ON os;

-- Criar nova política incluindo tecnico_agendado_id
CREATE POLICY "os_select_policy" ON os
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo IN ('master', 'diretoria')
        OR u.unidade_id = os.unidade_id
        OR u.id = os.tecnico_id
        OR u.id = os.tecnico_agendado_id
      )
    )
  );
