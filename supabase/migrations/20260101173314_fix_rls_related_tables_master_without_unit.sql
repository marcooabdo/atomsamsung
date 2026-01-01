/*
  # Fix RLS: Tabelas relacionadas seguem mesma lógica

  1. Changes
    - os_anexos: Master sem unidade vê tudo
    - os_comentarios: Master sem unidade vê tudo
    - agendamentos: Master sem unidade vê tudo
    - requisicoes_pecas: Master sem unidade vê tudo
*/

-- =====================================================
-- OS_ANEXOS
-- =====================================================

DROP POLICY IF EXISTS "Usuários podem ver anexos das OS que acessam" ON os_anexos;

CREATE POLICY "Ver anexos conforme acesso à OS"
ON os_anexos FOR SELECT
TO authenticated
USING (
  os_id IS NULL
  OR EXISTS (
    SELECT 1 FROM os
    WHERE os.id = os_anexos.os_id
    AND (
      -- Master sem unidade ou Diretoria vê tudo
      EXISTS (
        SELECT 1 FROM usuarios u
        WHERE u.id = auth.uid()
        AND ((u.tipo = 'master' AND u.unidade_id IS NULL) OR u.tipo = 'diretoria')
      )
      -- Master com unidade vê sua unidade
      OR EXISTS (
        SELECT 1 FROM usuarios u
        WHERE u.id = auth.uid()
        AND u.tipo = 'master'
        AND u.unidade_id = os.unidade_id
      )
      -- Técnico vê suas OS
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

-- =====================================================
-- OS_COMENTARIOS
-- =====================================================

DROP POLICY IF EXISTS "Usuários podem ver comentários das OS que acessam" ON os_comentarios;

CREATE POLICY "Ver comentários conforme acesso à OS"
ON os_comentarios FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM os
    WHERE os.id = os_comentarios.os_id
    AND (
      -- Master sem unidade ou Diretoria vê tudo
      EXISTS (
        SELECT 1 FROM usuarios u
        WHERE u.id = auth.uid()
        AND ((u.tipo = 'master' AND u.unidade_id IS NULL) OR u.tipo = 'diretoria')
      )
      -- Master com unidade vê sua unidade
      OR EXISTS (
        SELECT 1 FROM usuarios u
        WHERE u.id = auth.uid()
        AND u.tipo = 'master'
        AND u.unidade_id = os.unidade_id
      )
      -- Técnico vê suas OS
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

-- =====================================================
-- AGENDAMENTOS SELECT POLICY
-- =====================================================

DROP POLICY IF EXISTS "Usuários podem ver agendamentos de suas OS" ON agendamentos;
DROP POLICY IF EXISTS "Técnicos podem ver seus agendamentos" ON agendamentos;

CREATE POLICY "Ver agendamentos conforme acesso à OS"
ON agendamentos FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM os
    WHERE os.id = agendamentos.os_id
    AND (
      -- Master sem unidade ou Diretoria vê tudo
      EXISTS (
        SELECT 1 FROM usuarios u
        WHERE u.id = auth.uid()
        AND ((u.tipo = 'master' AND u.unidade_id IS NULL) OR u.tipo = 'diretoria')
      )
      -- Master com unidade vê sua unidade
      OR EXISTS (
        SELECT 1 FROM usuarios u
        WHERE u.id = auth.uid()
        AND u.tipo = 'master'
        AND u.unidade_id = os.unidade_id
      )
      -- Técnico vê suas OS ou seus agendamentos
      OR os.criado_por = auth.uid()
      OR os.tecnico_agendado_id = auth.uid()
      OR agendamentos.tecnico_id = auth.uid()
      OR EXISTS (
        SELECT 1 FROM usuarios u
        WHERE u.id = auth.uid()
        AND u.tipo IN ('tecnico_ih', 'tecnico_externo')
        AND u.unidade_id = os.unidade_id
      )
    )
  )
);

-- =====================================================
-- AGENDAMENTOS UPDATE POLICY
-- =====================================================

DROP POLICY IF EXISTS "Usuários podem atualizar agendamentos de suas OS" ON agendamentos;
DROP POLICY IF EXISTS "Técnicos podem atualizar seus agendamentos" ON agendamentos;

CREATE POLICY "Atualizar agendamentos conforme acesso"
ON agendamentos FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM os
    WHERE os.id = agendamentos.os_id
    AND (
      -- Master sem unidade ou Diretoria atualiza tudo
      EXISTS (
        SELECT 1 FROM usuarios u
        WHERE u.id = auth.uid()
        AND ((u.tipo = 'master' AND u.unidade_id IS NULL) OR u.tipo = 'diretoria')
      )
      -- Master com unidade atualiza sua unidade
      OR EXISTS (
        SELECT 1 FROM usuarios u
        WHERE u.id = auth.uid()
        AND u.tipo = 'master'
        AND u.unidade_id = os.unidade_id
      )
      -- Técnico atualiza seus agendamentos
      OR agendamentos.tecnico_id = auth.uid()
    )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM os
    WHERE os.id = agendamentos.os_id
    AND EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.unidade_id = os.unidade_id OR u.unidade_id IS NULL OR u.tipo = 'diretoria')
    )
  )
);

-- =====================================================
-- REQUISICOES_PECAS SELECT POLICY
-- =====================================================

DROP POLICY IF EXISTS "Usuários podem ver requisições de suas OS" ON requisicoes_pecas;

CREATE POLICY "Ver requisições conforme acesso à OS"
ON requisicoes_pecas FOR SELECT
TO authenticated
USING (
  os_id IS NULL
  OR EXISTS (
    SELECT 1 FROM os
    WHERE os.id = requisicoes_pecas.os_id
    AND (
      -- Master sem unidade ou Diretoria vê tudo
      EXISTS (
        SELECT 1 FROM usuarios u
        WHERE u.id = auth.uid()
        AND ((u.tipo = 'master' AND u.unidade_id IS NULL) OR u.tipo = 'diretoria')
      )
      -- Master com unidade vê sua unidade
      OR EXISTS (
        SELECT 1 FROM usuarios u
        WHERE u.id = auth.uid()
        AND u.tipo = 'master'
        AND u.unidade_id = os.unidade_id
      )
      -- Técnico vê suas OS
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
