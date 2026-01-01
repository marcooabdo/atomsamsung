/*
  # Fix Infinite Loop Between Agendamentos and OS Triggers

  1. Problem
    - `sync_os_agendamento_fields` trigger updates OS table when agendamentos change
    - `sync_os_to_agendamentos` trigger updates agendamentos when OS changes
    - These two triggers call each other infinitely causing stack overflow (54001)

  2. Solution
    - Add checks in both functions to only update when values actually changed
    - This prevents unnecessary updates and breaks the infinite loop

  3. Changes
    - Update `sync_os_agendamento_fields()` to check if OS values need updating
    - Update `sync_os_to_agendamentos()` to check if agendamento values need updating
*/

-- Drop and recreate sync_os_agendamento_fields with loop prevention
CREATE OR REPLACE FUNCTION sync_os_agendamento_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    -- Apenas atualizar se a OS existe
    IF NEW.os_id IS NOT NULL THEN
      -- Só atualiza se algum valor realmente mudou
      UPDATE os
      SET 
        tecnico_agendado_id = NEW.tecnico_id,
        data_agendamento = NEW.data_agendamento,
        periodo_agendamento = 
          CASE 
            WHEN NEW.horario_inicio >= '18:00:00' THEN 'noite'
            WHEN NEW.horario_inicio >= '13:00:00' THEN 'tarde'
            ELSE 'manha'
          END,
        confirmado_com_cliente = NEW.confirmado_com_cliente
      WHERE id = NEW.os_id
        -- IMPORTANTE: Só atualiza se os valores forem diferentes (evita loop)
        AND (
          tecnico_agendado_id IS DISTINCT FROM NEW.tecnico_id OR
          data_agendamento IS DISTINCT FROM NEW.data_agendamento OR
          periodo_agendamento IS DISTINCT FROM (
            CASE 
              WHEN NEW.horario_inicio >= '18:00:00' THEN 'noite'
              WHEN NEW.horario_inicio >= '13:00:00' THEN 'tarde'
              ELSE 'manha'
            END
          ) OR
          confirmado_com_cliente IS DISTINCT FROM NEW.confirmado_com_cliente
        );
    END IF;
    
    RETURN NEW;
  ELSIF (TG_OP = 'DELETE') THEN
    -- Limpar campos quando agendamento é deletado
    IF OLD.os_id IS NOT NULL THEN
      UPDATE os
      SET 
        tecnico_agendado_id = NULL,
        data_agendamento = NULL,
        periodo_agendamento = NULL,
        confirmado_com_cliente = false
      WHERE id = OLD.os_id
        AND tecnico_agendado_id = OLD.tecnico_id
        AND data_agendamento = OLD.data_agendamento;
    END IF;
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Drop and recreate sync_os_to_agendamentos with loop prevention
CREATE OR REPLACE FUNCTION sync_os_to_agendamentos()
RETURNS TRIGGER AS $$
DECLARE
  v_horario_inicio time;
  v_horario_fim time;
  v_agendamento_id uuid;
  v_unidade_id uuid;
  v_status text;
BEGIN
  -- Só processa se data_agendamento e tecnico_agendado_id estiverem preenchidos
  IF NEW.data_agendamento IS NOT NULL AND NEW.tecnico_agendado_id IS NOT NULL THEN
    
    -- Definir horários baseado no período
    IF NEW.periodo_agendamento = 'manha' THEN
      v_horario_inicio := '08:00:00';
      v_horario_fim := '12:00:00';
    ELSIF NEW.periodo_agendamento = 'tarde' THEN
      v_horario_inicio := '13:00:00';
      v_horario_fim := '18:00:00';
    ELSE
      -- Padrão: dia todo
      v_horario_inicio := '08:00:00';
      v_horario_fim := '18:00:00';
    END IF;

    -- Definir status
    v_status := CASE 
      WHEN NEW.confirmado_com_cliente THEN 'confirmado'
      ELSE 'pendente_confirmacao'
    END;
    
    -- Buscar unidade_id da OS ou do técnico
    v_unidade_id := NEW.unidade_id;
    IF v_unidade_id IS NULL THEN
      SELECT unidade_id INTO v_unidade_id
      FROM usuarios
      WHERE id = NEW.tecnico_agendado_id;
    END IF;
    
    -- Verificar se já existe agendamento para esta OS
    SELECT id INTO v_agendamento_id
    FROM agendamentos
    WHERE os_id = NEW.id
      AND status IN ('pendente_confirmacao', 'confirmado', 'em_andamento')
    LIMIT 1;
    
    IF v_agendamento_id IS NOT NULL THEN
      -- Atualizar agendamento existente SOMENTE se os valores mudaram (evita loop)
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
        -- IMPORTANTE: Só atualiza se algum valor mudou (evita loop infinito)
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
      -- Criar novo agendamento
      INSERT INTO agendamentos (
        os_id,
        tecnico_id,
        data_agendamento,
        horario_inicio,
        horario_fim,
        status,
        confirmado_com_cliente,
        unidade_id,
        agendado_por,
        created_at,
        updated_at
      ) VALUES (
        NEW.id,
        NEW.tecnico_agendado_id,
        NEW.data_agendamento,
        v_horario_inicio,
        v_horario_fim,
        v_status,
        COALESCE(NEW.confirmado_com_cliente, false),
        v_unidade_id,
        auth.uid(),
        now(),
        now()
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
