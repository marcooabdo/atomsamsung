/*
  # GIA Stock: Trigger automático para mover OS para coluna de rota

  ## Descrição
  Quando TODAS as peças de uma OS atingem status disponível/pronta,
  a GIA Stock move automaticamente a OS para a coluna da rota correspondente
  à cidade do cliente, marcando-a como pronta para roteirizar.

  ## Lógica
  1. Ao atualizar o status de qualquer os_peca, conta peças válidas vs prontas
  2. Se todas estiverem prontas (disponivel, vinculada_tecnico, em_uso, usada),
     busca a rota ativa que cobre a cidade do cliente
  3. Move coluna_kanban para o valor da rota e marca status_agendamento_gia

  ## Peças consideradas "prontas"
  - disponivel, vinculada_tecnico, em_uso, usada, gspn, manual

  ## Peças ignoradas (não bloqueiam)
  - cancelada

  ## Tabelas afetadas
  - os_pecas (trigger AFTER UPDATE)
  - os (UPDATE em coluna_kanban e status_agendamento_gia)
*/

CREATE OR REPLACE FUNCTION gia_stock_check_and_move_os()
RETURNS trigger AS $$
DECLARE
  v_total_pecas   INT;
  v_pecas_prontas INT;
  v_cidade        TEXT;
  v_coluna_rota   TEXT;
  v_tipo_atend    TEXT;
BEGIN
  -- Só processa OS do tipo IH (in-home). CI é atendimento em loja, não roteiriza.
  SELECT tipo_atendimento INTO v_tipo_atend FROM os WHERE id = NEW.os_id;
  IF v_tipo_atend IS DISTINCT FROM 'IH' THEN
    RETURN NEW;
  END IF;

  -- Total de peças válidas da OS (ignora canceladas)
  SELECT COUNT(*) INTO v_total_pecas
  FROM os_pecas
  WHERE os_id = NEW.os_id
    AND status != 'cancelada';

  -- Peças já prontas/disponíveis
  SELECT COUNT(*) INTO v_pecas_prontas
  FROM os_pecas
  WHERE os_id = NEW.os_id
    AND status IN ('disponivel', 'vinculada_tecnico', 'em_uso', 'usada', 'gspn', 'manual');

  -- Se tem pelo menos 1 peça válida e TODAS estão prontas
  IF v_total_pecas > 0 AND v_total_pecas = v_pecas_prontas THEN

    -- Busca a cidade do cliente
    SELECT cliente_cidade INTO v_cidade FROM os WHERE id = NEW.os_id;

    -- Busca a coluna_kanban da rota que cobre essa cidade
    SELECT coluna_kanban INTO v_coluna_rota
    FROM rotas
    WHERE v_cidade = ANY(cidades)
      AND ativa = true
      AND coluna_kanban IS NOT NULL
    LIMIT 1;

    -- Move a OS para a coluna da rota somente se ainda estiver em peca_disponivel
    IF v_coluna_rota IS NOT NULL THEN
      UPDATE os
      SET
        coluna_kanban          = v_coluna_rota,
        status_agendamento_gia = 'pronta_para_roteirizar',
        updated_at             = now()
      WHERE id = NEW.os_id
        AND coluna_kanban = 'peca_disponivel';
    END IF;

  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_gia_stock_os_pecas ON os_pecas;

CREATE TRIGGER trg_gia_stock_os_pecas
  AFTER UPDATE OF status ON os_pecas
  FOR EACH ROW
  EXECUTE FUNCTION gia_stock_check_and_move_os();
