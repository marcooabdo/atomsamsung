/*
# Fix trigger timing: BEFORE UPDATE instead of AFTER

## Problem
The trigger `trg_os_rota_escolhida` was an AFTER trigger which cannot modify
NEW values. It must be a BEFORE trigger to intercept and revert coluna_kanban
changes when rota_id is being set.

## Changes
1. Drop the existing AFTER trigger.
2. Recreate as BEFORE UPDATE trigger on the same function.

## Important Notes
1. BEFORE triggers can modify NEW, AFTER triggers cannot.
2. The function body remains the same — only the trigger timing changes.
*/

DROP TRIGGER IF EXISTS trg_os_rota_escolhida ON os;

CREATE TRIGGER trg_os_rota_escolhida
  BEFORE UPDATE ON os
  FOR EACH ROW
  EXECUTE FUNCTION trg_processar_escolha_rota();
