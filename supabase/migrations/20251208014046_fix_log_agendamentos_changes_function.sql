/*
  # Fix log_agendamentos_changes Function - Remove Checkin/Checkout

  1. Problem
    - Function log_agendamentos_changes still references data_hora_checkin/checkout
    - These fields don't exist anymore in agendamentos table
    - Causing DELETE operations to fail
  
  2. Solution
    - Drop and recreate the function without checkin/checkout references
    - Simplified to only log creation and basic changes
    - Fixed WHEN condition to work with DELETE operations
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS trigger_log_agendamentos_changes ON agendamentos;
DROP FUNCTION IF EXISTS log_agendamentos_changes();

-- Recreate function without checkin/checkout
CREATE OR REPLACE FUNCTION log_agendamentos_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_usuario_nome text;
  v_os_id uuid;
BEGIN
  -- Determine os_id based on operation
  v_os_id := COALESCE(NEW.os_id, OLD.os_id);
  
  -- Skip if no os_id
  IF v_os_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT nome INTO v_usuario_nome FROM usuarios WHERE id = auth.uid();

  IF (TG_OP = 'INSERT') THEN
    PERFORM criar_log_os(
      NEW.os_id,
      auth.uid(),
      format('📅 AGENDAMENTO CRIADO por %s: %s %s',
        COALESCE(v_usuario_nome, 'Sistema'),
        to_char(NEW.data_agendamento, 'DD/MM/YYYY'),
        COALESCE(NEW.horario_inicio::text, ''))
    );
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Log status changes
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
      PERFORM criar_log_os(
        NEW.os_id,
        auth.uid(),
        format('📅 Status alterado: %s → %s',
          COALESCE(OLD.status, 'N/A'),
          COALESCE(NEW.status, 'N/A'))
      );
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger (without WHEN condition to allow DELETE)
CREATE TRIGGER trigger_log_agendamentos_changes
  AFTER INSERT OR UPDATE OR DELETE ON agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION log_agendamentos_changes();