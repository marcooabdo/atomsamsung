/*
  # Fix: Sincronizar apenas a primeira visita (agendamento inicial)

  1. Problema
    - Quando há múltiplas visitas para mesma OS, o trigger estava atualizando qualquer agendamento
    - Isso causava todas as visitas mudarem de status simultaneamente
    - Exemplo: fazer check-in na visita 1 fazia ambas as visitas ficarem "em andamento"

  2. Solução
    - O trigger deve buscar sempre o agendamento mais antigo (primeira visita)
    - Usar ORDER BY created_at ASC LIMIT 1 para garantir que pega apenas a primeira visita
    - Visitas adicionais são criadas manualmente e não devem ser sincronizadas com campos da OS

  3. Impacto
    - Apenas a primeira visita será sincronizada com os campos da OS
    - Visitas adicionais (revisitas) permanecem independentes
*/

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
    
    -- IMPORTANTE: Buscar APENAS o agendamento mais antigo (primeira visita)
    -- Isso garante que visitas adicionais não sejam afetadas
    SELECT id INTO v_agendamento_id
    FROM agendamentos
    WHERE os_id = NEW.id
    ORDER BY created_at ASC
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
      -- Criar novo agendamento (primeira visita)
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
