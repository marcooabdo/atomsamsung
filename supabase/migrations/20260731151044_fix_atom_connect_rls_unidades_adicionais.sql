/*
# Fix Atom Connect RLS policies to include additional units (usuario_unidades)

## Problem
Users with additional units (stored in usuario_unidades table) can only see data from their
primary unit (usuarios.unidade_id). The policies need to also check the usuario_unidades table.

## Changes
- Updated SELECT, INSERT, UPDATE policies on atom_connect_conversas
- Updated SELECT policy on atom_connect_instancias
- Updated SELECT policy on atom_connect_mensagens
- Updated SELECT policy on atom_connect_campanhas
- Updated SELECT policy on atom_connect_fluxos
- Updated SELECT policy on atom_connect_respostas_rapidas
- Updated SELECT policy on atom_connect_campanha_contatos

All policies now check: primary unit OR additional units OR master user OR null unit
*/

-- Helper: create a reusable function to check if user has access to a given unidade_id
CREATE OR REPLACE FUNCTION public.user_has_unit_access(target_unidade_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios u
    WHERE u.id = auth.uid()
    AND (
      u.tipo = 'master'
      OR u.unidade_id IS NULL
      OR u.unidade_id = target_unidade_id
      OR EXISTS (
        SELECT 1 FROM public.usuario_unidades uu
        WHERE uu.usuario_id = u.id
        AND uu.unidade_id = target_unidade_id
      )
    )
  );
$$;

-- ============================================================
-- atom_connect_conversas: SELECT
-- ============================================================
DROP POLICY IF EXISTS "Users can view conversations of their unit" ON atom_connect_conversas;
CREATE POLICY "Users can view conversations of their unit"
ON atom_connect_conversas FOR SELECT
TO authenticated
USING (public.user_has_unit_access(unidade_id));

-- atom_connect_conversas: UPDATE
DROP POLICY IF EXISTS "Users can update conversations of their unit" ON atom_connect_conversas;
CREATE POLICY "Users can update conversations of their unit"
ON atom_connect_conversas FOR UPDATE
TO authenticated
USING (public.user_has_unit_access(unidade_id));

-- atom_connect_conversas: INSERT
DROP POLICY IF EXISTS "Users can insert conversations" ON atom_connect_conversas;
CREATE POLICY "Users can insert conversations"
ON atom_connect_conversas FOR INSERT
TO authenticated
WITH CHECK (public.user_has_unit_access(unidade_id));

-- ============================================================
-- atom_connect_instancias: SELECT
-- ============================================================
DROP POLICY IF EXISTS "Users can view instances of their unit" ON atom_connect_instancias;
CREATE POLICY "Users can view instances of their unit"
ON atom_connect_instancias FOR SELECT
TO authenticated
USING (public.user_has_unit_access(unidade_id));

-- ============================================================
-- atom_connect_mensagens: SELECT
-- ============================================================
DROP POLICY IF EXISTS "Users can view messages" ON atom_connect_mensagens;
CREATE POLICY "Users can view messages"
ON atom_connect_mensagens FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM atom_connect_conversas c
    WHERE c.id = atom_connect_mensagens.conversa_id
    AND public.user_has_unit_access(c.unidade_id)
  )
);

-- ============================================================
-- atom_connect_campanhas: SELECT
-- ============================================================
DROP POLICY IF EXISTS "Users can view campaigns of their unit" ON atom_connect_campanhas;
CREATE POLICY "Users can view campaigns of their unit"
ON atom_connect_campanhas FOR SELECT
TO authenticated
USING (public.user_has_unit_access(unidade_id));

-- ============================================================
-- atom_connect_fluxos: SELECT
-- ============================================================
DROP POLICY IF EXISTS "Users can view flows" ON atom_connect_fluxos;
CREATE POLICY "Users can view flows"
ON atom_connect_fluxos FOR SELECT
TO authenticated
USING (
  unidade_id IS NULL
  OR public.user_has_unit_access(unidade_id)
);

-- ============================================================
-- atom_connect_respostas_rapidas: SELECT
-- ============================================================
DROP POLICY IF EXISTS "Users can view quick replies" ON atom_connect_respostas_rapidas;
CREATE POLICY "Users can view quick replies"
ON atom_connect_respostas_rapidas FOR SELECT
TO authenticated
USING (
  unidade_id IS NULL
  OR public.user_has_unit_access(unidade_id)
);

-- ============================================================
-- atom_connect_campanha_contatos: SELECT
-- ============================================================
DROP POLICY IF EXISTS "Users can view campaign contacts" ON atom_connect_campanha_contatos;
CREATE POLICY "Users can view campaign contacts"
ON atom_connect_campanha_contatos FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM atom_connect_campanhas c
    WHERE c.id = atom_connect_campanha_contatos.campanha_id
    AND public.user_has_unit_access(c.unidade_id)
  )
);

-- ============================================================
-- atom_connect_tags_oportunidade: SELECT + UPDATE + DELETE
-- ============================================================
DROP POLICY IF EXISTS "Authenticated users can read tags for their unit" ON atom_connect_tags_oportunidade;
CREATE POLICY "Authenticated users can read tags for their unit"
ON atom_connect_tags_oportunidade FOR SELECT
TO authenticated
USING (
  unidade_id IS NULL
  OR public.user_has_unit_access(unidade_id)
);

DROP POLICY IF EXISTS "Authenticated users can update tags" ON atom_connect_tags_oportunidade;
CREATE POLICY "Authenticated users can update tags"
ON atom_connect_tags_oportunidade FOR UPDATE
TO authenticated
USING (
  unidade_id IS NULL
  OR public.user_has_unit_access(unidade_id)
);

DROP POLICY IF EXISTS "Authenticated users can delete unused tags" ON atom_connect_tags_oportunidade;
CREATE POLICY "Authenticated users can delete unused tags"
ON atom_connect_tags_oportunidade FOR DELETE
TO authenticated
USING (
  (unidade_id IS NULL OR public.user_has_unit_access(unidade_id))
  AND NOT EXISTS (
    SELECT 1 FROM atom_connect_conversas c
    WHERE c.tags_oportunidade @> ARRAY[atom_connect_tags_oportunidade.value]
  )
);
