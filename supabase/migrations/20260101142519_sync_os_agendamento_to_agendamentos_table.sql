/*
  # Sincronizar agendamento da OS com tabela agendamentos

  1. Trigger
    - Quando data_agendamento e tecnico_agendado_id forem preenchidos na OS
    - Criar/atualizar automaticamente registro na tabela agendamentos
    
  2. Lógica
    - Se já existe agendamento para essa OS, atualizar
    - Se não existe, criar novo
    - Preencher horários padrão baseado no período (manhã/tarde)
*/

CREATE OR REPLACE FUNCTION sync_os_to_agendamentos()
RETURNS TRIGGER AS $$
DECLARE
  v_horario_inicio time;
  v_horario_fim time;
  v_agendamento_id uuid;
  v_unidade_id uuid;
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
      -- Atualizar agendamento existente
      UPDATE agendamentos SET
        tecnico_id = NEW.tecnico_agendado_id,
        data_agendamento = NEW.data_agendamento,
        horario_inicio = v_horario_inicio,
        horario_fim = v_horario_fim,
        confirmado_com_cliente = NEW.confirmado_com_cliente,
        status = CASE 
          WHEN NEW.confirmado_com_cliente THEN 'confirmado'
          ELSE 'pendente_confirmacao'
        END,
        unidade_id = v_unidade_id,
        updated_at = now()
      WHERE id = v_agendamento_id;
      
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
        CASE 
          WHEN NEW.confirmado_com_cliente THEN 'confirmado'
          ELSE 'pendente_confirmacao'
        END,
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

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS sync_os_agendamento_trigger ON os;

-- Criar trigger
CREATE TRIGGER sync_os_agendamento_trigger
  AFTER INSERT OR UPDATE OF data_agendamento, tecnico_agendado_id, periodo_agendamento, confirmado_com_cliente
  ON os
  FOR EACH ROW
  EXECUTE FUNCTION sync_os_to_agendamentos();
