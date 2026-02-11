/*
  # Fix OS RLS - Allow all authenticated users to see OS from their unit

  1. Problem
    - Current policy only allows master, diretoria, and technicians to see OS
    - Other user types (gerente, recepcao, vendedor, etc.) cannot search/view OS from their unit
    - This breaks the Nova Conversa modal OS search

  2. Solution
    - Update SELECT policy to allow ALL authenticated users to see OS from their unit
    - Keep existing master/diretoria/tecnico logic
    - Add fallback: any user with unidade_id can see OS from that unit

  3. Security
    - Users can only see OS from their own unit
    - Master without unit sees all
    - Diretoria sees all
    - Technicians see their assigned OS
*/

DROP POLICY IF EXISTS "Master/Diretoria veem tudo, outros por unidade" ON os;

CREATE POLICY "Users see OS from their unit"
ON os FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM usuarios u
    WHERE u.id = auth.uid()
    AND (
      -- 1. Master sem unidade ou Diretoria → vê TUDO
      (u.tipo = 'master' AND u.unidade_id IS NULL)
      OR u.tipo = 'diretoria'
      -- 2. Qualquer usuário vê OS da sua unidade
      OR u.unidade_id = os.unidade_id
      -- 3. Técnico vê suas OS mesmo de outra unidade
      OR (
        u.tipo IN ('tecnico_ih', 'tecnico_externo', 'tecnico')
        AND (
          os.criado_por = auth.uid()
          OR os.tecnico_agendado_id = auth.uid()
          OR os.tecnico_id = auth.uid()
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