/*
  # Fix RLS: Master sem unidade vê tudo

  1. Problem
    - Marco Abdo (master) está na Unidade Principal
    - As 261 OS estão em Feira de Santana
    - Master só vê OS da sua unidade
    
  2. Solution
    - Master SEM unidade_id (null) → vê TUDO
    - Master COM unidade_id → vê só sua unidade
    - Diretoria → vê tudo sempre
*/

-- =====================================================
-- DROP AND RECREATE OS SELECT POLICY
-- =====================================================

DROP POLICY IF EXISTS "Master vê todas OS da unidade, técnicos veem suas OS" ON os;

CREATE POLICY "Master/Diretoria veem tudo, outros por unidade"
ON os FOR SELECT
TO authenticated
USING (
  -- 1. Master SEM unidade ou Diretoria → vê TUDO
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid()
    AND (
      (u.tipo = 'master' AND u.unidade_id IS NULL)
      OR u.tipo = 'diretoria'
    )
  )
  -- 2. Master COM unidade → vê só sua unidade
  OR EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid()
    AND u.tipo = 'master'
    AND u.unidade_id IS NOT NULL
    AND u.unidade_id = os.unidade_id
  )
  -- 3. Técnico vê suas OS
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
      OR (u.unidade_id = os.unidade_id)
    )
  )
);

-- =====================================================
-- UPDATE POLICY
-- =====================================================

DROP POLICY IF EXISTS "Master atualiza todas, técnicos suas OS" ON os;

CREATE POLICY "Master/Diretoria atualizam tudo, outros suas OS"
ON os FOR UPDATE
TO authenticated
USING (
  -- 1. Master sem unidade ou Diretoria → atualiza TUDO
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid()
    AND (
      (u.tipo = 'master' AND u.unidade_id IS NULL)
      OR u.tipo = 'diretoria'
    )
  )
  -- 2. Master com unidade → atualiza só sua unidade
  OR EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid()
    AND u.tipo = 'master'
    AND u.unidade_id IS NOT NULL
    AND u.unidade_id = os.unidade_id
  )
  -- 3. Técnico atualiza suas OS
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
    AND (u.unidade_id = os.unidade_id OR u.unidade_id IS NULL OR u.tipo = 'diretoria')
  )
);

-- =====================================================
-- DELETE POLICY
-- =====================================================

DROP POLICY IF EXISTS "Apenas Master deleta OS" ON os;

CREATE POLICY "Master/Diretoria deletam OS"
ON os FOR DELETE
TO authenticated
USING (
  -- 1. Master sem unidade ou Diretoria → deleta TUDO
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid()
    AND (
      (u.tipo = 'master' AND u.unidade_id IS NULL)
      OR u.tipo = 'diretoria'
    )
  )
  -- 2. Master com unidade → deleta só sua unidade
  OR EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid()
    AND u.tipo = 'master'
    AND u.unidade_id IS NOT NULL
    AND u.unidade_id = os.unidade_id
  )
);
