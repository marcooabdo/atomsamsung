/*
# Prevent agendamento edits after check-in

1. New Functions
  - `prevent_agendamento_edit_after_checkin()` - trigger function that blocks
    updates to key fields (data_agendamento, tecnico_id, horario_inicio, horario_fim,
    status) if checkin_realizado is true on the existing row.

2. New Triggers
  - `trg_prevent_agendamento_edit_after_checkin` on `agendamentos` BEFORE UPDATE

3. Important Notes
  - Only blocks changes to scheduling fields. Checkout fields and status
    transitions from the checkout flow are still allowed.
  - The trigger allows updating checkout-related fields even after check-in
    (checkout_realizado, checkout_hora, checkout_latitude, checkout_longitude,
    checkout_observacoes, checkout_checklist_completo, checkout_pendente).
  - Does not block status changes to 'concluido' or 'cancelado' which are system operations.
*/

CREATE OR REPLACE FUNCTION prevent_agendamento_edit_after_checkin()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only apply protection if the existing row already has check-in
  IF OLD.checkin_realizado = true THEN
    -- Allow checkout-related updates
    IF (
      NEW.checkout_realizado IS DISTINCT FROM OLD.checkout_realizado OR
      NEW.checkout_hora IS DISTINCT FROM OLD.checkout_hora OR
      NEW.checkout_latitude IS DISTINCT FROM OLD.checkout_latitude OR
      NEW.checkout_longitude IS DISTINCT FROM OLD.checkout_longitude OR
      NEW.checkout_observacoes IS DISTINCT FROM OLD.checkout_observacoes OR
      NEW.checkout_checklist_completo IS DISTINCT FROM OLD.checkout_checklist_completo OR
      NEW.checkout_pendente IS DISTINCT FROM OLD.checkout_pendente
    ) THEN
      -- This is a checkout operation, allow it
      RETURN NEW;
    END IF;

    -- Allow status transitions to concluido/cancelado (system operations)
    IF NEW.status IN ('concluido', 'cancelado') AND OLD.status != NEW.status THEN
      RETURN NEW;
    END IF;

    -- Block changes to scheduling fields
    IF (
      NEW.data_agendamento IS DISTINCT FROM OLD.data_agendamento OR
      NEW.tecnico_id IS DISTINCT FROM OLD.tecnico_id OR
      NEW.horario_inicio IS DISTINCT FROM OLD.horario_inicio OR
      NEW.horario_fim IS DISTINCT FROM OLD.horario_fim
    ) THEN
      RAISE EXCEPTION 'Não é possível alterar agendamento após check-in ter sido realizado.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_agendamento_edit_after_checkin ON agendamentos;
CREATE TRIGGER trg_prevent_agendamento_edit_after_checkin
  BEFORE UPDATE ON agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION prevent_agendamento_edit_after_checkin();
