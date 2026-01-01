/*
  # Sincronizar campos de agendamento entre tabelas

  1. Função e Trigger
    - Criar função que atualiza os campos `tecnico_agendado_id`, `data_agendamento` e `periodo_agendamento` na tabela `os`
    - Criar trigger que dispara quando um agendamento é criado ou atualizado
    - Limpar os campos quando um agendamento é deletado

  2. Migração de Dados
    - Atualizar todas as OSs existentes com base nos agendamentos confirmados
*/

-- Criar função para sincronizar campos de agendamento
CREATE OR REPLACE FUNCTION sync_os_agendamento_fields()
RETURNS TRIGGER AS $$
BEGIN
  IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
    -- Apenas atualizar se a OS existe
    IF NEW.os_id IS NOT NULL THEN
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
      WHERE id = NEW.os_id;
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

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_sync_os_agendamento ON agendamentos;
CREATE TRIGGER trigger_sync_os_agendamento
  AFTER INSERT OR UPDATE OR DELETE ON agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION sync_os_agendamento_fields();

-- Atualizar todas as OSs existentes com base nos agendamentos confirmados mais recentes
UPDATE os o
SET 
  tecnico_agendado_id = a.tecnico_id,
  data_agendamento = a.data_agendamento,
  periodo_agendamento = 
    CASE 
      WHEN a.horario_inicio >= '18:00:00' THEN 'noite'
      WHEN a.horario_inicio >= '13:00:00' THEN 'tarde'
      ELSE 'manha'
    END,
  confirmado_com_cliente = a.confirmado_com_cliente
FROM (
  SELECT DISTINCT ON (os_id)
    os_id,
    tecnico_id,
    data_agendamento,
    horario_inicio,
    confirmado_com_cliente
  FROM agendamentos
  WHERE os_id IS NOT NULL
    AND status IN ('confirmado', 'pendente_confirmacao', 'em_andamento')
  ORDER BY os_id, data_agendamento DESC, created_at DESC
) a
WHERE o.id = a.os_id;
