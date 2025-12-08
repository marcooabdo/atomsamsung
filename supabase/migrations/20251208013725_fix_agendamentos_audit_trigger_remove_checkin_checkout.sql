/*
  # Fix Agendamentos Audit Trigger - Remove Checkin/Checkout Fields

  1. Problem
    - Trigger is trying to access data_hora_checkin and data_hora_checkout fields
    - These fields no longer exist in the agendamentos table
    - Causing "record has no field" errors when moving OS
  
  2. Solution
    - Recreate trigger function without checkin/checkout field references
    - Only log agendamento creation and status changes
  
  3. Changes
    - DROP and recreate function log_agendamento_changes()
    - Remove all references to data_hora_checkin and data_hora_checkout
*/

-- Drop existing trigger and function
DROP TRIGGER IF EXISTS agendamento_audit_trigger ON agendamentos;
DROP FUNCTION IF EXISTS log_agendamento_changes();

-- Recreate function without checkin/checkout references
CREATE OR REPLACE FUNCTION log_agendamento_changes()
RETURNS TRIGGER AS $$
DECLARE
  v_usuario_nome TEXT;
BEGIN
  -- Get user name
  SELECT nome INTO v_usuario_nome
  FROM usuarios
  WHERE id = COALESCE(auth.uid(), NEW.agendado_por);

  IF (TG_OP = 'INSERT') THEN
    -- Log agendamento creation
    PERFORM criar_log_os(
      NEW.os_id,
      COALESCE(auth.uid(), NEW.agendado_por),
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
        format('📅 Status do agendamento alterado: %s → %s',
          COALESCE(OLD.status, 'N/A'),
          COALESCE(NEW.status, 'N/A'))
      );
    END IF;

    -- Log date changes
    IF (OLD.data_agendamento IS DISTINCT FROM NEW.data_agendamento) THEN
      PERFORM criar_log_os(
        NEW.os_id,
        auth.uid(),
        format('📅 Data do agendamento alterada: %s → %s',
          to_char(OLD.data_agendamento, 'DD/MM/YYYY'),
          to_char(NEW.data_agendamento, 'DD/MM/YYYY'))
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate trigger
CREATE TRIGGER agendamento_audit_trigger
  AFTER INSERT OR UPDATE ON agendamentos
  FOR EACH ROW
  WHEN (NEW.os_id IS NOT NULL)
  EXECUTE FUNCTION log_agendamento_changes();