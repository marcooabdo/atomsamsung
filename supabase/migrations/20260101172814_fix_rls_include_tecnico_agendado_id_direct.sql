/*
  # Fix RLS to include tecnico_agendado_id field

  1. Problem
    - Policies only check agendamentos table
    - OS table has tecnico_agendado_id field directly
    - Técnicos can't see their assigned OS
    
  2. Solution
    - Update SELECT policy to also check tecnico_agendado_id
    - Update UPDATE policy to also check tecnico_agendado_id
    - Maintain existing agendamentos table check as fallback
*/

-- =====================================================
-- DROP AND RECREATE OS SELECT POLICY
-- =====================================================

DROP POLICY IF EXISTS "Técnicos podem ver suas OS agendadas" ON os;

CREATE POLICY "Técnicos podem ver suas OS agendadas"
ON os FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid()
    AND (
      -- Master vê tudo da unidade
      (u.tipo = 'master' AND u.unidade_id = os.unidade_id)
      -- Técnico vê se criou, está no tecnico_agendado_id, ou tem agendamento
      OR (
        u.tipo IN ('tecnico_ih', 'tecnico_externo')
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
  )
);

-- =====================================================
-- DROP AND RECREATE OS UPDATE POLICY
-- =====================================================

DROP POLICY IF EXISTS "Técnicos podem atualizar suas OS" ON os;

CREATE POLICY "Técnicos podem atualizar suas OS"
ON os FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid()
    AND (
      -- Master atualiza tudo da unidade
      (u.tipo = 'master' AND u.unidade_id = os.unidade_id)
      -- Técnico atualiza se criou, está no tecnico_agendado_id, ou tem agendamento
      OR (
        u.tipo IN ('tecnico_ih', 'tecnico_externo')
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
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid()
    AND u.unidade_id = os.unidade_id
  )
);

-- =====================================================
-- FIX OS_ANEXOS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Usuários podem ver anexos de suas OS" ON os_anexos;

CREATE POLICY "Usuários podem ver anexos de suas OS"
ON os_anexos FOR SELECT
TO authenticated
USING (
  os_id IS NULL
  OR EXISTS (
    SELECT 1 FROM os
    WHERE os.id = os_anexos.os_id
    AND (
      -- Master vê tudo da unidade
      EXISTS (
        SELECT 1 FROM usuarios u
        WHERE u.id = auth.uid()
        AND u.tipo = 'master'
        AND u.unidade_id = os.unidade_id
      )
      -- Técnico vê se criou, está no tecnico_agendado_id, ou tem agendamento
      OR os.criado_por = auth.uid()
      OR os.tecnico_agendado_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM agendamentos a
        WHERE a.os_id = os.id
        AND a.tecnico_id = auth.uid()
      )
    )
  )
);

DROP POLICY IF EXISTS "Usuários podem criar anexos em suas OS" ON os_anexos;

CREATE POLICY "Usuários podem criar anexos em suas OS"
ON os_anexos FOR INSERT
TO authenticated
WITH CHECK (
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
    )
  )
);

DROP POLICY IF EXISTS "Usuários podem atualizar anexos de suas OS" ON os_anexos;

CREATE POLICY "Usuários podem atualizar anexos de suas OS"
ON os_anexos FOR UPDATE
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
    )
  )
)
WITH CHECK (
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
    )
  )
);

DROP POLICY IF EXISTS "Usuários podem deletar anexos de suas OS" ON os_anexos;

CREATE POLICY "Usuários podem deletar anexos de suas OS"
ON os_anexos FOR DELETE
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
    )
  )
);

-- =====================================================
-- FIX OS_COMENTARIOS POLICIES
-- =====================================================

DROP POLICY IF EXISTS "Usuários podem ver comentários de suas OS" ON os_comentarios;

CREATE POLICY "Usuários podem ver comentários de suas OS"
ON os_comentarios FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM os
    WHERE os.id = os_comentarios.os_id
    AND (
      -- Master vê tudo da unidade
      EXISTS (
        SELECT 1 FROM usuarios u
        WHERE u.id = auth.uid()
        AND u.tipo = 'master'
        AND u.unidade_id = os.unidade_id
      )
      -- Técnico vê se criou, está no tecnico_agendado_id, ou tem agendamento
      OR os.criado_por = auth.uid()
      OR os.tecnico_agendado_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM agendamentos a
        WHERE a.os_id = os.id
        AND a.tecnico_id = auth.uid()
      )
    )
  )
);

DROP POLICY IF EXISTS "Usuários podem criar comentários em suas OS" ON os_comentarios;

CREATE POLICY "Usuários podem criar comentários em suas OS"
ON os_comentarios FOR INSERT
TO authenticated
WITH CHECK (
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
    )
  )
);
