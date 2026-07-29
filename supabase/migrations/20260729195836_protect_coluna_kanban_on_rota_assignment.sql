/*
# Protect coluna_kanban when assigning a route color

## Problem
When a user assigns a route (color) to an OS by city, the frontend also sends
the route's coluna_kanban in the same UPDATE, which inadvertently moves the OS
to a different Kanban column. This is unintended — route assignment should be
purely visual (a color badge) and must NOT move the OS.

## Solution
Replace the existing `trg_processar_escolha_rota` trigger function to actively
preserve the original `coluna_kanban` value whenever `rota_id` changes.
If the frontend sends both `rota_id` and `coluna_kanban` changes in the same
UPDATE, the coluna_kanban is reverted to its old value.

## Security
No RLS or policy changes.

## Important Notes
1. The trigger fires BEFORE UPDATE, so it can override NEW values.
2. If a legitimate column move AND route assignment happen to be needed
   simultaneously (e.g. drag-and-drop onto a route column), this must be
   done in two separate UPDATE statements.
*/

CREATE OR REPLACE FUNCTION trg_processar_escolha_rota()
RETURNS trigger AS $$
BEGIN
  -- When rota_id changes, preserve the original coluna_kanban.
  -- Route assignment is purely visual and must NOT move the OS.
  IF OLD.rota_id IS DISTINCT FROM NEW.rota_id THEN
    NEW.coluna_kanban := OLD.coluna_kanban;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
