/*
# Disable trigger that moves OS to route column when rota_id is assigned

1. Problem
- When a user assigns a route color to an OS, the trigger `trg_os_rota_escolhida`
  automatically moves the OS from its current column to the route's kanban column.
- The user wants to assign routes WITHOUT moving the OS — the card should stay
  in its current column.

2. Changes
- Replace the trigger function with a no-op that just returns NEW without moving.

3. Important Notes
- The route assignment should only be visual (color on card, city badge).
- OS movement between columns should only happen via manual drag-and-drop.
*/

CREATE OR REPLACE FUNCTION trg_processar_escolha_rota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Route assignment no longer moves the OS to a different column.
  -- The route is purely a visual designation (color badge on card).
  RETURN NEW;
END;
$$;
