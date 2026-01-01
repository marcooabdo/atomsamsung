/*
  # Restore RLS on OS, OS Anexos and OS Comentarios

  1. Problem
    - RLS was disabled by mistake on critical tables
    - Security policies were removed
    - Need to restore proper access control

  2. Solution
    - Re-enable RLS on os, os_anexos, os_comentarios
    - Restore proper RLS policies based on user roles
    - Maintain security while allowing proper access

  3. Security
    - Técnicos can only see their assigned OS
    - Master users can see all OS in their unit
    - System user has full access for automations
*/

-- =====================================================
-- 1. RE-ENABLE RLS
-- =====================================================

ALTER TABLE os ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE os_comentarios ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- 2. DROP ALL EXISTING POLICIES (clean slate)
-- =====================================================

-- OS table policies
DROP POLICY IF EXISTS "Técnicos podem ver suas OS agendadas" ON os;
DROP POLICY IF EXISTS "Master pode ver todas as OS da unidade" ON os;
DROP POLICY IF EXISTS "Técnicos podem inserir OS" ON os;
DROP POLICY IF EXISTS "Usuários podem criar OS" ON os;
DROP POLICY IF EXISTS "Técnicos podem atualizar suas OS" ON os;
DROP POLICY IF EXISTS "Master pode atualizar qualquer OS da unidade" ON os;
DROP POLICY IF EXISTS "Técnicos podem deletar suas OS" ON os;
DROP POLICY IF EXISTS "Master pode deletar qualquer OS da unidade" ON os;
DROP POLICY IF EXISTS "Master pode deletar OS da unidade" ON os;

-- OS Anexos policies
DROP POLICY IF EXISTS "Técnicos podem ver anexos de suas OS" ON os_anexos;
DROP POLICY IF EXISTS "Master pode ver todos os anexos da unidade" ON os_anexos;
DROP POLICY IF EXISTS "Técnicos podem inserir anexos em suas OS" ON os_anexos;
DROP POLICY IF EXISTS "Usuários podem ver anexos de suas OS" ON os_anexos;
DROP POLICY IF EXISTS "Usuários podem criar anexos em suas OS" ON os_anexos;
DROP POLICY IF EXISTS "Técnicos podem atualizar anexos de suas OS" ON os_anexos;
DROP POLICY IF EXISTS "Usuários podem atualizar anexos de suas OS" ON os_anexos;
DROP POLICY IF EXISTS "Master pode atualizar qualquer anexo da unidade" ON os_anexos;
DROP POLICY IF EXISTS "Técnicos podem deletar anexos de suas OS" ON os_anexos;
DROP POLICY IF EXISTS "Usuários podem deletar anexos de suas OS" ON os_anexos;
DROP POLICY IF EXISTS "Master pode deletar qualquer anexo da unidade" ON os_anexos;

-- OS Comentarios policies
DROP POLICY IF EXISTS "Técnicos podem ver comentários de suas OS" ON os_comentarios;
DROP POLICY IF EXISTS "Master pode ver todos os comentários da unidade" ON os_comentarios;
DROP POLICY IF EXISTS "Usuários podem ver comentários de suas OS" ON os_comentarios;
DROP POLICY IF EXISTS "Técnicos podem inserir comentários em suas OS" ON os_comentarios;
DROP POLICY IF EXISTS "Usuários podem criar comentários em suas OS" ON os_comentarios;
DROP POLICY IF EXISTS "Técnicos podem atualizar seus comentários" ON os_comentarios;
DROP POLICY IF EXISTS "Usuários podem atualizar seus comentários" ON os_comentarios;
DROP POLICY IF EXISTS "Master pode atualizar qualquer comentário da unidade" ON os_comentarios;
DROP POLICY IF EXISTS "Técnicos podem deletar seus comentários" ON os_comentarios;
DROP POLICY IF EXISTS "Usuários podem deletar seus comentários" ON os_comentarios;
DROP POLICY IF EXISTS "Master pode deletar qualquer comentário da unidade" ON os_comentarios;

-- =====================================================
-- 3. CREATE OS TABLE POLICIES
-- =====================================================

-- SELECT: Técnicos veem suas OS agendadas ou criadas por eles
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
      -- Técnico vê se está agendado ou criou
      OR (
        u.tipo IN ('tecnico_ih', 'tecnico_externo')
        AND (
          os.criado_por = auth.uid()
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

-- INSERT: Usuários autenticados podem criar OS
CREATE POLICY "Usuários podem criar OS"
ON os FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid()
    AND u.unidade_id = os.unidade_id
  )
);

-- UPDATE: Técnicos atualizam suas OS, Master atualiza todas da unidade
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
      -- Técnico atualiza se criou ou está agendado
      OR (
        u.tipo IN ('tecnico_ih', 'tecnico_externo')
        AND (
          os.criado_por = auth.uid()
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

-- DELETE: Apenas Master pode deletar
CREATE POLICY "Master pode deletar OS da unidade"
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
-- 4. CREATE OS_ANEXOS POLICIES
-- =====================================================

-- SELECT: Veem anexos das OS que podem ver
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
      -- Técnico vê se criou ou está agendado
      OR os.criado_por = auth.uid()
      OR EXISTS (
        SELECT 1 FROM agendamentos a
        WHERE a.os_id = os.id
        AND a.tecnico_id = auth.uid()
      )
    )
  )
);

-- INSERT: Podem adicionar anexos nas OS que têm acesso
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
      OR EXISTS (
        SELECT 1 FROM agendamentos a
        WHERE a.os_id = os.id
        AND a.tecnico_id = auth.uid()
      )
    )
  )
);

-- UPDATE: Mesmas regras
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
      OR EXISTS (
        SELECT 1 FROM agendamentos a
        WHERE a.os_id = os.id
        AND a.tecnico_id = auth.uid()
      )
    )
  )
);

-- DELETE: Mesmas regras
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
      OR EXISTS (
        SELECT 1 FROM agendamentos a
        WHERE a.os_id = os.id
        AND a.tecnico_id = auth.uid()
      )
    )
  )
);

-- =====================================================
-- 5. CREATE OS_COMENTARIOS POLICIES
-- =====================================================

-- SELECT: Veem comentários das OS que podem ver
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
      -- Técnico vê se criou ou está agendado
      OR os.criado_por = auth.uid()
      OR EXISTS (
        SELECT 1 FROM agendamentos a
        WHERE a.os_id = os.id
        AND a.tecnico_id = auth.uid()
      )
    )
  )
);

-- INSERT: Podem adicionar comentários nas OS que têm acesso
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
      OR EXISTS (
        SELECT 1 FROM agendamentos a
        WHERE a.os_id = os.id
        AND a.tecnico_id = auth.uid()
      )
    )
  )
);

-- UPDATE: Apenas próprios comentários ou Master
CREATE POLICY "Usuários podem atualizar seus comentários"
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

-- DELETE: Apenas próprios comentários ou Master
CREATE POLICY "Usuários podem deletar seus comentários"
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
