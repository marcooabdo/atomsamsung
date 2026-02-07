/*
  # Create Pipeline Automation Functions and Triggers

  ## Overview
  This migration creates PostgreSQL functions and triggers that power the automated pipeline system.
  These functions handle the core logic for rule evaluation, OS movement, and event detection.

  ## Functions Created

  ### 1. `fn_verificar_todas_pecas_recebidas` - Check if all parts received
  Returns boolean indicating if all parts for an OS have been fully received.

  ### 2. `fn_buscar_rota_por_cidade` - Find route by city
  Searches for a route that serves a specific city and returns route info.

  ### 3. `fn_executar_movimentacao_pipeline` - Execute pipeline movement
  Main function that moves an OS between columns and logs the movement.

  ### 4. `fn_avaliar_condicoes_regra` - Evaluate rule conditions
  Checks if a specific rule's conditions are met for a given OS.

  ### 5. `fn_processar_pipeline_automatico` - Process automatic pipeline
  Main orchestration function that finds applicable rules and executes movements.

  ## Triggers Created

  ### 1. `trg_os_coluna_mudanca` - Detect column changes
  Fires when OS column changes to trigger automatic processing.

  ### 2. `trg_os_pecas_recebimento` - Detect parts receipt
  Fires when parts quantities are updated to check for complete receipt.

  ### 3. `trg_os_rota_escolhida` - Detect route selection
  Fires when a route is manually assigned to an OS.

  ### 4. `trg_os_pecas_atualizar_status` - Update part status
  Automatically updates part status when fully received.
*/

-- Function 1: Check if all parts are received for an OS
CREATE OR REPLACE FUNCTION fn_verificar_todas_pecas_recebidas(p_os_id uuid)
RETURNS boolean AS $$
DECLARE
  v_todas_recebidas boolean;
BEGIN
  SELECT COALESCE(BOOL_AND(quantidade_recebida >= quantidade_esperada), false)
  INTO v_todas_recebidas
  FROM os_pecas
  WHERE os_id = p_os_id
  AND requisitada_em IS NOT NULL;
  
  RETURN COALESCE(v_todas_recebidas, false);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function 2: Find route by city
CREATE OR REPLACE FUNCTION fn_buscar_rota_por_cidade(p_cidade text, p_unidade_id uuid)
RETURNS TABLE(rota_id uuid, coluna_kanban text) AS $$
BEGIN
  RETURN QUERY
  SELECT r.id, r.coluna_kanban
  FROM rotas r
  WHERE r.unidade_id = p_unidade_id
  AND r.ativa = true
  AND p_cidade = ANY(r.cidades);
END;
$$ LANGUAGE plpgsql STABLE;

-- Function 3: Execute pipeline movement
CREATE OR REPLACE FUNCTION fn_executar_movimentacao_pipeline(
  p_os_id uuid,
  p_coluna_destino text,
  p_regra_id uuid DEFAULT NULL,
  p_tipo_movimentacao tipo_movimentacao_pipeline DEFAULT 'automatica',
  p_motivo_texto text DEFAULT NULL,
  p_usuario_id uuid DEFAULT NULL
)
RETURNS boolean AS $$
DECLARE
  v_coluna_origem text;
  v_rota_id uuid;
BEGIN
  SELECT coluna_kanban INTO v_coluna_origem
  FROM os
  WHERE id = p_os_id;
  
  IF v_coluna_origem IS NULL THEN
    RETURN false;
  END IF;
  
  IF v_coluna_origem = p_coluna_destino THEN
    RETURN false;
  END IF;
  
  UPDATE os
  SET 
    coluna_kanban = p_coluna_destino,
    updated_at = now()
  WHERE id = p_os_id;
  
  INSERT INTO pipeline_logs (
    os_id,
    regra_id,
    coluna_origem,
    coluna_destino,
    tipo_movimentacao,
    motivo_texto,
    usuario_id,
    executado_em
  ) VALUES (
    p_os_id,
    p_regra_id,
    v_coluna_origem,
    p_coluna_destino,
    p_tipo_movimentacao,
    p_motivo_texto,
    COALESCE(p_usuario_id, auth.uid()),
    now()
  );
  
  IF p_regra_id IS NOT NULL THEN
    UPDATE pipeline_regras
    SET execucoes_total = execucoes_total + 1
    WHERE id = p_regra_id;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function 4: Evaluate rule conditions
CREATE OR REPLACE FUNCTION fn_avaliar_condicoes_regra(
  p_os_id uuid,
  p_condicoes jsonb
)
RETURNS boolean AS $$
DECLARE
  v_os record;
  v_todas_pecas_recebidas boolean;
  v_cidade_em_rota boolean;
  v_condicao_tipo_os text[];
  v_condicao_tipo_atendimento text;
  v_condicao_tipo_orcamento text;
BEGIN
  SELECT * INTO v_os FROM os WHERE id = p_os_id;
  
  IF NOT FOUND THEN
    RETURN false;
  END IF;
  
  IF p_condicoes ? 'tipo_os' THEN
    v_condicao_tipo_os := ARRAY(SELECT jsonb_array_elements_text(p_condicoes->'tipo_os'));
    IF NOT (v_os.tipo_os = ANY(v_condicao_tipo_os)) THEN
      RETURN false;
    END IF;
  END IF;
  
  IF p_condicoes ? 'tipo_atendimento' THEN
    v_condicao_tipo_atendimento := p_condicoes->>'tipo_atendimento';
    IF v_os.tipo_atendimento != v_condicao_tipo_atendimento THEN
      RETURN false;
    END IF;
  END IF;
  
  IF p_condicoes ? 'tipo_orcamento' THEN
    v_condicao_tipo_orcamento := p_condicoes->>'tipo_orcamento';
    IF v_os.tipo_orcamento != v_condicao_tipo_orcamento THEN
      RETURN false;
    END IF;
  END IF;
  
  IF p_condicoes ? 'todas_pecas_recebidas' THEN
    IF (p_condicoes->>'todas_pecas_recebidas')::boolean = true THEN
      v_todas_pecas_recebidas := fn_verificar_todas_pecas_recebidas(p_os_id);
      IF NOT v_todas_pecas_recebidas THEN
        RETURN false;
      END IF;
    END IF;
  END IF;
  
  IF p_condicoes ? 'cidade_cadastrada_em_rota' THEN
    IF (p_condicoes->>'cidade_cadastrada_em_rota')::boolean = true THEN
      SELECT EXISTS(
        SELECT 1 FROM fn_buscar_rota_por_cidade(v_os.cliente_cidade, v_os.unidade_id)
      ) INTO v_cidade_em_rota;
      
      IF NOT v_cidade_em_rota THEN
        RETURN false;
      END IF;
    ELSIF (p_condicoes->>'cidade_cadastrada_em_rota')::boolean = false THEN
      SELECT EXISTS(
        SELECT 1 FROM fn_buscar_rota_por_cidade(v_os.cliente_cidade, v_os.unidade_id)
      ) INTO v_cidade_em_rota;
      
      IF v_cidade_em_rota THEN
        RETURN false;
      END IF;
    END IF;
  END IF;
  
  IF p_condicoes ? 'requer_peca' THEN
    IF (p_condicoes->>'requer_peca')::boolean = true THEN
      IF NOT EXISTS(SELECT 1 FROM os_pecas WHERE os_id = p_os_id AND requisitada_em IS NOT NULL) THEN
        RETURN false;
      END IF;
    ELSIF (p_condicoes->>'requer_peca')::boolean = false THEN
      IF EXISTS(SELECT 1 FROM os_pecas WHERE os_id = p_os_id AND requisitada_em IS NOT NULL) THEN
        RETURN false;
      END IF;
    END IF;
  END IF;
  
  RETURN true;
END;
$$ LANGUAGE plpgsql STABLE;

-- Function 5: Process automatic pipeline (main orchestration)
CREATE OR REPLACE FUNCTION fn_processar_pipeline_automatico(
  p_os_id uuid,
  p_evento_gatilho text DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_os record;
  v_unidade_automacao_ativa boolean;
  v_regra record;
  v_condicoes_atendidas boolean;
  v_rota_info record;
  v_coluna_destino text;
  v_movido boolean := false;
BEGIN
  SELECT * INTO v_os FROM os WHERE id = p_os_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  IF v_os.bloqueio_movimentacao_automatica = true THEN
    RETURN;
  END IF;
  
  SELECT movimentacao_automatica_ativa INTO v_unidade_automacao_ativa
  FROM unidades
  WHERE id = v_os.unidade_id;
  
  IF v_unidade_automacao_ativa = false THEN
    RETURN;
  END IF;
  
  FOR v_regra IN (
    SELECT *
    FROM pipeline_regras
    WHERE ativo = true
    AND (unidade_id IS NULL OR unidade_id = v_os.unidade_id)
    AND coluna_origem = v_os.coluna_kanban
    ORDER BY
      CASE tipo_regra
        WHEN 'escolha_rota' THEN 1
        WHEN 'orcamento_aprovado' THEN 2
        WHEN 'pecas_recebidas' THEN 3
        WHEN 'peca_disponivel' THEN 4
        WHEN 'custom' THEN 5
      END,
      created_at ASC
  )
  LOOP
    BEGIN
      v_condicoes_atendidas := fn_avaliar_condicoes_regra(p_os_id, v_regra.condicoes);
      
      IF v_condicoes_atendidas THEN
        v_coluna_destino := v_regra.coluna_destino;
        
        IF v_regra.tipo_regra = 'escolha_rota' AND v_regra.condicoes ? 'cidade_cadastrada_em_rota' THEN
          SELECT * INTO v_rota_info
          FROM fn_buscar_rota_por_cidade(v_os.cliente_cidade, v_os.unidade_id)
          LIMIT 1;
          
          IF FOUND THEN
            v_coluna_destino := v_rota_info.coluna_kanban;
            
            UPDATE os
            SET rota_id = v_rota_info.rota_id
            WHERE id = p_os_id;
          END IF;
        END IF;
        
        v_movido := fn_executar_movimentacao_pipeline(
          p_os_id,
          v_coluna_destino,
          v_regra.id,
          'automatica',
          v_regra.nome
        );
        
        IF v_movido THEN
          EXIT;
        END IF;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO pipeline_erros (os_id, regra_id, mensagem_erro, stack_trace)
      VALUES (p_os_id, v_regra.id, SQLERRM, SQLSTATE);
    END;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Trigger 1: Detect column changes in OS
CREATE OR REPLACE FUNCTION trg_processar_mudanca_coluna()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.coluna_kanban IS DISTINCT FROM NEW.coluna_kanban THEN
    PERFORM fn_processar_pipeline_automatico(NEW.id, 'mudanca_coluna');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_os_coluna_mudanca ON os;
CREATE TRIGGER trg_os_coluna_mudanca
  AFTER UPDATE OF coluna_kanban ON os
  FOR EACH ROW
  EXECUTE FUNCTION trg_processar_mudanca_coluna();

-- Trigger 2: Detect parts receipt and update status
CREATE OR REPLACE FUNCTION trg_processar_recebimento_pecas()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.quantidade_recebida >= NEW.quantidade_esperada AND OLD.quantidade_recebida < OLD.quantidade_esperada THEN
    NEW.data_entrada_total := now();
    
    IF NEW.status != 'disponivel' THEN
      NEW.status := 'disponivel';
    END IF;
  END IF;
  
  IF OLD.quantidade_recebida IS DISTINCT FROM NEW.quantidade_recebida THEN
    PERFORM fn_processar_pipeline_automatico(NEW.os_id, 'recebimento_peca');
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_os_pecas_recebimento ON os_pecas;
CREATE TRIGGER trg_os_pecas_recebimento
  BEFORE UPDATE OF quantidade_recebida ON os_pecas
  FOR EACH ROW
  EXECUTE FUNCTION trg_processar_recebimento_pecas();

-- Trigger 3: Detect manual route selection
CREATE OR REPLACE FUNCTION trg_processar_escolha_rota()
RETURNS TRIGGER AS $$
DECLARE
  v_rota record;
BEGIN
  IF OLD.rota_id IS DISTINCT FROM NEW.rota_id AND NEW.rota_id IS NOT NULL THEN
    IF OLD.coluna_kanban = 'disponivel_ih' THEN
      SELECT coluna_kanban INTO v_rota
      FROM rotas
      WHERE id = NEW.rota_id;
      
      IF FOUND THEN
        PERFORM fn_executar_movimentacao_pipeline(
          NEW.id,
          v_rota.coluna_kanban,
          NULL,
          'manual',
          'Rota selecionada manualmente pelo usuário'
        );
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_os_rota_escolhida ON os;
CREATE TRIGGER trg_os_rota_escolhida
  AFTER UPDATE OF rota_id ON os
  FOR EACH ROW
  EXECUTE FUNCTION trg_processar_escolha_rota();
