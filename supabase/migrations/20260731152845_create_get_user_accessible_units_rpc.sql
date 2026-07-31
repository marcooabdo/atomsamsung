/*
# Create RPC to get user's accessible units for Atom Connect filter

## Problem
The Atom Connect filter only shows the user's primary unit because the frontend
likely reads only `usuarios.unidade_id`. Users with additional units (via usuario_unidades)
don't see their additional units in the filter dropdown.

## Solution
Create a function `get_user_accessible_units()` that returns all units the current user
has access to (primary + additional), which the frontend can call to populate the filter.

## New Functions
- `get_user_accessible_units()`: Returns id, nome of all units the logged-in user can access
*/

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
    -- User is master/diretoria without primary unit (sees all)
    EXISTS (
      SELECT 1 FROM usuarios usr 
      WHERE usr.id = auth.uid() 
      AND usr.tipo IN ('master', 'diretoria') 
      AND usr.unidade_id IS NULL
    )
    -- Primary unit
    OR u.id = (SELECT usr.unidade_id FROM usuarios usr WHERE usr.id = auth.uid())
    -- Additional units via junction table
    OR u.id IN (SELECT uu.unidade_id FROM usuario_unidades uu WHERE uu.usuario_id = auth.uid())
  )
  ORDER BY u.nome;
$$;
