/*
# Fix search_path on user_has_unit_access and ensure get_user_accessible_units works

## Changes
- Add SET search_path TO 'public' on user_has_unit_access function
- Ensure get_user_accessible_units also has proper search_path
*/

CREATE OR REPLACE FUNCTION public.user_has_unit_access(target_unidade_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
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

CREATE OR REPLACE FUNCTION public.get_user_accessible_units()
RETURNS TABLE(id uuid, nome text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT DISTINCT u.id, u.nome
  FROM unidades u
  WHERE u.ativa = true
  AND (
    EXISTS (
      SELECT 1 FROM usuarios usr 
      WHERE usr.id = auth.uid() 
      AND usr.tipo IN ('master', 'diretoria') 
      AND usr.unidade_id IS NULL
    )
    OR u.id = (SELECT usr.unidade_id FROM usuarios usr WHERE usr.id = auth.uid())
    OR u.id IN (SELECT uu.unidade_id FROM usuario_unidades uu WHERE uu.usuario_id = auth.uid())
  )
  ORDER BY u.nome;
$$;
