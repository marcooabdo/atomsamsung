/*
# Fix sync trigger to skip agendamentos with check-in

1. Modified Functions
  - `sync_os_to_agendamentos()` - Now skips agendamentos that already have
    checkin_realizado = true. Instead of always targeting the oldest agendamento,
    it now targets the most recent agendamento WITHOUT check-in. If no such 
    agendamento exists (all have check-in), it does NOT create a new one
    (the frontend handles new visit creation directly).

2. Important Notes
  - This prevents the error "Não é possível alterar agendamento após check-in"
    that occurred when updating OS fields triggered a sync to a checked-in agendamento.
  - The frontend now manages creating new visits directly via INSERT.
  - The sync trigger will only update visits that haven't been started yet.
*/

CREATE OR REPLACE FUNCTION public.sync_os_to_agendamentos()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_horario_inicio time;
  v_horario_fim time;
  v_agendamento_id uuid;
  v_unidade_id uuid;
  v_status text;
BEGIN
  -- Only process if data_agendamento and tecnico_agendado_id are set
  IF NEW.data_agendamento IS NOT NULL AND NEW.tecnico_agendado_id IS NOT NULL THEN

    -- Set times based on period
    IF NEW.periodo_agendamento = 'manha' THEN
      v_horario_inicio := '08:00:00';
      v_horario_fim := '12:00:00';
    ELSIF NEW.periodo_agendamento = 'tarde' THEN
      v_horario_inicio := '13:00:00';
      v_horario_fim := '18:00:00';
    ELSE
      v_horario_inicio := '08:00:00';
      v_horario_fim := '18:00:00';
    END IF;

    -- Set status
    v_status := CASE 
      WHEN NEW.confirmado_com_cliente THEN 'confirmado'
      ELSE 'pendente_confirmacao'
    END;

    -- Get unidade_id
    v_unidade_id := NEW.unidade_id;
    IF v_unidade_id IS NULL THEN
      SELECT unidade_id INTO v_unidade_id
      FROM usuarios
      WHERE id = NEW.tecnico_agendado_id;
    END IF;

    -- Find the most recent agendamento WITHOUT check-in (editable visit)
    SELECT id INTO v_agendamento_id
    FROM agendamentos
    WHERE os_id = NEW.id
      AND checkin_realizado = false
      AND status NOT IN ('cancelado', 'concluido')
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_agendamento_id IS NOT NULL THEN
      -- Update existing editable agendamento
      UPDATE agendamentos SET
        tecnico_id = NEW.tecnico_agendado_id,
        data_agendamento = NEW.data_agendamento,
        horario_inicio = v_horario_inicio,
        horario_fim = v_horario_fim,
        confirmado_com_cliente = NEW.confirmado_com_cliente,
        status = v_status,
        unidade_id = v_unidade_id,
        updated_at = now()
      WHERE id = v_agendamento_id
      AND (
        tecnico_id IS DISTINCT FROM NEW.tecnico_agendado_id OR
        data_agendamento IS DISTINCT FROM NEW.data_agendamento OR
        horario_inicio IS DISTINCT FROM v_horario_inicio OR
        horario_fim IS DISTINCT FROM v_horario_fim OR
        confirmado_com_cliente IS DISTINCT FROM NEW.confirmado_com_cliente OR
        status IS DISTINCT FROM v_status OR
        unidade_id IS DISTINCT FROM v_unidade_id
      );
    ELSE
      -- Check if there are NO agendamentos at all for this OS
      IF NOT EXISTS (SELECT 1 FROM agendamentos WHERE os_id = NEW.id) THEN
        -- Create first agendamento
        INSERT INTO agendamentos (
          os_id, tecnico_id, data_agendamento, horario_inicio, horario_fim,
          status, confirmado_com_cliente, unidade_id, agendado_por,
          created_at, updated_at
        ) VALUES (
          NEW.id, NEW.tecnico_agendado_id, NEW.data_agendamento,
          v_horario_inicio, v_horario_fim, v_status,
          COALESCE(NEW.confirmado_com_cliente, false), v_unidade_id,
          auth.uid(), now(), now()
        );
      END IF;
      -- If all agendamentos have check-in, do nothing here.
      -- The frontend creates new visits directly via INSERT.
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;
