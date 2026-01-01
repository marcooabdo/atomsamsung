/*
  # Simplify RLS policies for better access control

  1. Problem
    - Current policies are too restrictive
    - Master users can't see all OS from their unit
    - Dashboard and Kanban showing empty
    
  2. Solution
    - Simplify SELECT policy to prioritize Master access
    - Make Master access absolute for their unit
    - Keep técnico restrictions but more flexible
*/

-- =====================================================
-- DROP AND RECREATE ALL OS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Técnicos podem ver suas OS agendadas" ON os;
DROP POLICY IF EXISTS "Usuários podem criar OS" ON os;
DROP POLICY IF EXISTS "Técnicos podem atualizar suas OS" ON os;
DROP POLICY IF EXISTS "Master pode deletar OS da unidade" ON os;

-- SELECT: Master vê tudo, técnicos veem suas OS
CREATE POLICY "Master vê todas OS da unidade, técnicos veem suas OS"
ON os FOR SELECT
TO authenticated
USING (
  -- Master vê TUDO da unidade dele
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid()
    AND u.tipo = 'master'
    AND u.unidade_id = os.unidade_id
  )
  -- OU técnico vê se:
  OR EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid()
    AND u.tipo IN ('tecnico_ih', 'tecnico_externo')
    AND (
      -- 1. Criou a OS
      os.criado_por = auth.uid()
      -- 2. Está agendado direto na OS
      OR os.tecnico_agendado_id = auth.uid()
      -- 3. Tem agendamento na tabela agendamentos
      OR EXISTS (
        SELECT 1 FROM agendamentos a
        WHERE a.os_id = os.id
        AND a.tecnico_id = auth.uid()
      )
      -- 4. Está na mesma unidade (permite ver OS não agendadas da unidade)
      OR (u.unidade_id = os.unidade_id)
    )
  )
);

-- INSERT: Todos da unidade podem criar
CREATE POLICY "Usuários podem criar OS em sua unidade"
ON os FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid()
    AND u.unidade_id = os.unidade_id
  )
);

-- UPDATE: Master atualiza tudo, técnicos atualizam suas OS
CREATE POLICY "Master atualiza todas, técnicos suas OS"
ON os FOR UPDATE
TO authenticated
USING (
  -- Master atualiza TUDO da unidade
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid()
    AND u.tipo = 'master'
    AND u.unidade_id = os.unidade_id
  )
  -- OU técnico atualiza suas OS
  OR EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid()
    AND u.tipo IN ('tecnico_ih', 'tecnico_externo')
    AND (
      os.criado_por = auth.uid()
      OR os.tecnico_agendado_id = auth.uid()
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
    AND u.unidade_id = os.unidade_id
  )
);

-- DELETE: Apenas Master
CREATE POLICY "Apenas Master deleta OS"
ON os FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid()
    AND u.tipo = 'master'
    AND u.unidade_id = os.unidade_id
  )
);

-- =====================================================
-- FIX OS_ANEXOS - Seguir mesma lógica
-- =====================================================

DROP POLICY IF EXISTS "Usuários podem ver anexos de suas OS" ON os_anexos;
DROP POLICY IF EXISTS "Usuários podem criar anexos em suas OS" ON os_anexos;
DROP POLICY IF EXISTS "Usuários podem atualizar anexos de suas OS" ON os_anexos;
DROP POLICY IF EXISTS "Usuários podem deletar anexos de suas OS" ON os_anexos;

CREATE POLICY "Usuários podem ver anexos das OS que acessam"
ON os_anexos FOR SELECT
TO authenticated
USING (
  os_id IS NULL
  OR EXISTS (
    SELECT 1 FROM os
    WHERE os.id = os_anexos.os_id
    AND (
      EXISTS (
        SELECT 1 FROM usuarios u
        WHERE u.id = auth.uid()
        AND u.tipo = 'master'
        AND u.unidade_id = os.unidade_id
      )
      OR os.criado_por = auth.uid()
      OR os.tecnico_agendado_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM agendamentos a
        WHERE a.os_id = os.id
        AND a.tecnico_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM usuarios u
        WHERE u.id = auth.uid()
        AND u.tipo IN ('tecnico_ih', 'tecnico_externo')
        AND u.unidade_id = os.unidade_id
      )
    )
  )
);

CREATE POLICY "Usuários podem criar anexos nas OS que acessam"
ON os_anexos FOR INSERT
TO authenticated
WITH CHECK (
  os_id IS NULL
  OR EXISTS (
    SELECT 1 FROM os
    WHERE os.id = os_anexos.os_id
    AND EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.unidade_id = os.unidade_id
    )
  )
);

CREATE POLICY "Usuários podem atualizar anexos das OS que acessam"
ON os_anexos FOR UPDATE
TO authenticated
USING (
  os_id IS NULL
  OR EXISTS (
    SELECT 1 FROM os
    WHERE os.id = os_anexos.os_id
    AND EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.unidade_id = os.unidade_id
    )
  )
)
WITH CHECK (
  os_id IS NULL
  OR EXISTS (
    SELECT 1 FROM os
    WHERE os.id = os_anexos.os_id
    AND EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.unidade_id = os.unidade_id
    )
  )
);

CREATE POLICY "Usuários podem deletar anexos das OS que acessam"
ON os_anexos FOR DELETE
TO authenticated
USING (
  os_id IS NULL
  OR EXISTS (
    SELECT 1 FROM os
    WHERE os.id = os_anexos.os_id
    AND EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.unidade_id = os.unidade_id
    )
  )
);

-- =====================================================
-- FIX OS_COMENTARIOS - Seguir mesma lógica
-- =====================================================

DROP POLICY IF EXISTS "Usuários podem ver comentários de suas OS" ON os_comentarios;
DROP POLICY IF EXISTS "Usuários podem criar comentários em suas OS" ON os_comentarios;
DROP POLICY IF EXISTS "Usuários podem atualizar seus comentários" ON os_comentarios;
DROP POLICY IF EXISTS "Usuários podem deletar seus comentários" ON os_comentarios;

CREATE POLICY "Usuários podem ver comentários das OS que acessam"
ON os_comentarios FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM os
    WHERE os.id = os_comentarios.os_id
    AND (
      EXISTS (
        SELECT 1 FROM usuarios u
        WHERE u.id = auth.uid()
        AND u.tipo = 'master'
        AND u.unidade_id = os.unidade_id
      )
      OR os.criado_por = auth.uid()
      OR os.tecnico_agendado_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM agendamentos a
        WHERE a.os_id = os.id
        AND a.tecnico_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM usuarios u
        WHERE u.id = auth.uid()
        AND u.tipo IN ('tecnico_ih', 'tecnico_externo')
        AND u.unidade_id = os.unidade_id
      )
    )
  )
);

CREATE POLICY "Usuários podem criar comentários nas OS que acessam"
ON os_comentarios FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM os
    WHERE os.id = os_comentarios.os_id
    AND EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.unidade_id = os.unidade_id
    )
  )
);

CREATE POLICY "Usuários podem atualizar próprios comentários ou Master tudo"
ON os_comentarios FOR UPDATE
TO authenticated
USING (
  usuario_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM usuarios u
    JOIN os ON os.id = os_comentarios.os_id
    WHERE u.id = auth.uid()
    AND u.tipo = 'master'
    AND u.unidade_id = os.unidade_id
  )
)
WITH CHECK (
  usuario_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM usuarios u
    JOIN os ON os.id = os_comentarios.os_id
    WHERE u.id = auth.uid()
    AND u.tipo = 'master'
    AND u.unidade_id = os.unidade_id
  )
);

CREATE POLICY "Usuários podem deletar próprios comentários ou Master tudo"
ON os_comentarios FOR DELETE
TO authenticated
USING (
  usuario_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM usuarios u
    JOIN os ON os.id = os_comentarios.os_id
    WHERE u.id = auth.uid()
    AND u.tipo = 'master'
    AND u.unidade_id = os.unidade_id
  )
);
