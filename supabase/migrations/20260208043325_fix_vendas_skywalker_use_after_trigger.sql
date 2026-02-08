/*
  # Corrigir trigger Skywalker para AFTER INSERT/UPDATE

  1. Problema
    - Trigger BEFORE não contava a venda atual pois ela não estava no banco ainda
    - Resultado: sempre contava 0 vendas
  
  2. Solução
    - Mudar para AFTER INSERT/UPDATE
    - A venda já estará no banco e será contada corretamente
    - Não pode mais alterar NEW, então remove o log_skywalker
*/

-- Recriar a função para AFTER trigger (sem modificar NEW)
CREATE OR REPLACE FUNCTION registrar_venda_skywalker_after()
RETURNS TRIGGER AS $$
DECLARE
  v_profissional_id uuid;
  v_profissional_time text;
  v_mes_ref date;
  v_pilar_id uuid;
  v_pilar_nome text;
  v_total_vendas_mes integer;
  v_estrelas_calculadas integer;
BEGIN
  -- Detectar mudança de concluído para cancelado
  IF TG_OP = 'UPDATE' AND OLD.status = 'concluido' AND NEW.status = 'cancelado' THEN
    -- Buscar profissional do vendedor e seu time
    SELECT p.id, p.time INTO v_profissional_id, v_profissional_time
    FROM skywalker_profissionais p
    WHERE p.usuario_id = NEW.vendedor_id
      AND p.ativo = true
    LIMIT 1;
    
    IF v_profissional_id IS NOT NULL THEN
      v_mes_ref := date_trunc('month', NEW.created_at)::date;
      
      -- Mapear tipo de venda para nome do pilar
      CASE NEW.tipo_venda
        WHEN 'store_plus' THEN v_pilar_nome := 'Vendas Store+';
        WHEN 'seguro_care' THEN v_pilar_nome := 'Vendas Care+';
        WHEN 'smb' THEN v_pilar_nome := 'SMB';
      END CASE;
      
      IF v_pilar_nome IS NOT NULL THEN
        -- Buscar o pilar correspondente
        SELECT id INTO v_pilar_id
        FROM skywalker_pilares
        WHERE nome = v_pilar_nome
          AND ativo = true
          AND (unidade_id = NEW.unidade_id OR unidade_id IS NULL)
        ORDER BY unidade_id NULLS LAST
        LIMIT 1;
        
        IF v_pilar_id IS NOT NULL THEN
          -- Contar total de vendas CONCLUÍDAS restantes
          SELECT COUNT(*) INTO v_total_vendas_mes
          FROM vendas
          WHERE vendedor_id = NEW.vendedor_id
            AND tipo_venda = NEW.tipo_venda
            AND status = 'concluido'
            AND date_trunc('month', created_at)::date = v_mes_ref;
          
          -- Buscar estrelas pela regra
          SELECT r.estrelas INTO v_estrelas_calculadas
          FROM skywalker_regras_estrelas r
          WHERE r.pilar_id = v_pilar_id
            AND r.time = v_profissional_time
            AND r.ativo = true
            AND v_total_vendas_mes >= r.valor_minimo
            AND (r.valor_maximo IS NULL OR v_total_vendas_mes <= r.valor_maximo)
            AND (r.unidade_id = NEW.unidade_id OR r.unidade_id IS NULL)
          ORDER BY r.unidade_id NULLS LAST, r.valor_minimo DESC
          LIMIT 1;
          
          IF v_estrelas_calculadas IS NULL THEN
            v_estrelas_calculadas := 0;
          END IF;
          
          -- Se não há mais vendas, remover o registro
          IF v_total_vendas_mes = 0 THEN
            DELETE FROM skywalker_estrelas_mes
            WHERE profissional_id = v_profissional_id
              AND mes_referencia = v_mes_ref
              AND pilar_id = v_pilar_id;
          ELSE
            -- Atualizar com o novo total
            UPDATE skywalker_estrelas_mes
            SET 
              valor_metrica = v_total_vendas_mes,
              estrelas_conquistadas = v_estrelas_calculadas
            WHERE profissional_id = v_profissional_id
              AND mes_referencia = v_mes_ref
              AND pilar_id = v_pilar_id;
          END IF;
          
          -- Atualizar log na venda
          UPDATE vendas
          SET log_skywalker = COALESCE(log_skywalker, '[]'::jsonb) || jsonb_build_object(
            'tipo', 'cancelamento',
            'data', now(),
            'status', 'sucesso',
            'total_vendas_mes', v_total_vendas_mes,
            'estrelas_calculadas', v_estrelas_calculadas,
            'mensagem', 'Pontos recalculados após cancelamento'
          )
          WHERE id = NEW.id;
        END IF;
      END IF;
    END IF;
    
    RETURN NEW;
  END IF;
  
  -- Só processa se mudou para concluído
  IF NEW.status = 'concluido' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND (OLD.status IS NULL OR OLD.status != 'concluido'))) THEN
    
    -- Buscar profissional do vendedor e seu time
    SELECT p.id, p.time INTO v_profissional_id, v_profissional_time
    FROM skywalker_profissionais p
    WHERE p.usuario_id = NEW.vendedor_id
      AND p.ativo = true
    LIMIT 1;
    
    IF v_profissional_id IS NULL THEN
      -- Log erro
      UPDATE vendas
      SET log_skywalker = COALESCE(log_skywalker, '[]'::jsonb) || jsonb_build_object(
        'tipo', 'erro',
        'data', now(),
        'status', 'erro',
        'mensagem', 'Vendedor não está cadastrado no sistema Skywalker'
      )
      WHERE id = NEW.id;
      RETURN NEW;
    END IF;
    
    v_mes_ref := date_trunc('month', NEW.created_at)::date;
    
    -- Mapear tipo de venda para nome do pilar
    CASE NEW.tipo_venda
      WHEN 'store_plus' THEN v_pilar_nome := 'Vendas Store+';
      WHEN 'seguro_care' THEN v_pilar_nome := 'Vendas Care+';
      WHEN 'smb' THEN v_pilar_nome := 'SMB';
      ELSE v_pilar_nome := NULL;
    END CASE;
    
    IF v_pilar_nome IS NULL THEN
      UPDATE vendas
      SET log_skywalker = COALESCE(log_skywalker, '[]'::jsonb) || jsonb_build_object(
        'tipo', 'erro',
        'data', now(),
        'status', 'erro',
        'mensagem', format('Tipo de venda não mapeado: %s', NEW.tipo_venda)
      )
      WHERE id = NEW.id;
      RETURN NEW;
    END IF;
    
    -- Buscar o pilar correspondente
    SELECT id INTO v_pilar_id
    FROM skywalker_pilares
    WHERE nome = v_pilar_nome
      AND ativo = true
      AND (unidade_id = NEW.unidade_id OR unidade_id IS NULL)
    ORDER BY unidade_id NULLS LAST
    LIMIT 1;
    
    IF v_pilar_id IS NULL THEN
      UPDATE vendas
      SET log_skywalker = COALESCE(log_skywalker, '[]'::jsonb) || jsonb_build_object(
        'tipo', 'erro',
        'data', now(),
        'status', 'erro',
        'mensagem', format('Pilar não encontrado: %s', v_pilar_nome)
      )
      WHERE id = NEW.id;
      RETURN NEW;
    END IF;
    
    -- Contar total de vendas CONCLUÍDAS do vendedor neste mês e tipo (agora inclui a atual!)
    SELECT COUNT(*) INTO v_total_vendas_mes
    FROM vendas
    WHERE vendedor_id = NEW.vendedor_id
      AND tipo_venda = NEW.tipo_venda
      AND status = 'concluido'
      AND date_trunc('month', created_at)::date = v_mes_ref;
    
    -- Buscar estrelas pela regra baseada no total de vendas
    SELECT r.estrelas INTO v_estrelas_calculadas
    FROM skywalker_regras_estrelas r
    WHERE r.pilar_id = v_pilar_id
      AND r.time = v_profissional_time
      AND r.ativo = true
      AND v_total_vendas_mes >= r.valor_minimo
      AND (r.valor_maximo IS NULL OR v_total_vendas_mes <= r.valor_maximo)
      AND (r.unidade_id = NEW.unidade_id OR r.unidade_id IS NULL)
    ORDER BY r.unidade_id NULLS LAST, r.valor_minimo DESC
    LIMIT 1;
    
    IF v_estrelas_calculadas IS NULL THEN
      v_estrelas_calculadas := 0;
    END IF;
    
    -- Atualizar ou inserir na tabela de estrelas do mês
    INSERT INTO skywalker_estrelas_mes (
      profissional_id,
      mes_referencia,
      pilar_id,
      valor_metrica,
      estrelas_conquistadas
    ) VALUES (
      v_profissional_id,
      v_mes_ref,
      v_pilar_id,
      v_total_vendas_mes,
      v_estrelas_calculadas
    )
    ON CONFLICT (profissional_id, mes_referencia, pilar_id)
    DO UPDATE SET
      valor_metrica = v_total_vendas_mes,
      estrelas_conquistadas = v_estrelas_calculadas;
    
    -- Marcar como enviado e logar sucesso
    UPDATE vendas
    SET 
      enviado_skywalker = true,
      data_envio_skywalker = now(),
      log_skywalker = COALESCE(log_skywalker, '[]'::jsonb) || jsonb_build_object(
        'tipo', 'recalculo',
        'data', now(),
        'status', 'sucesso',
        'pilar_id', v_pilar_id,
        'pilar_nome', v_pilar_nome,
        'total_vendas_mes', v_total_vendas_mes,
        'estrelas_calculadas', v_estrelas_calculadas,
        'mensagem', format('Total de %s vendas no mês = %s estrelas', v_total_vendas_mes, v_estrelas_calculadas)
      )
    WHERE id = NEW.id;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recriar o trigger como AFTER
DROP TRIGGER IF EXISTS trigger_registrar_venda_skywalker ON vendas;

CREATE TRIGGER trigger_registrar_venda_skywalker
  AFTER INSERT OR UPDATE OF status ON vendas
  FOR EACH ROW
  EXECUTE FUNCTION registrar_venda_skywalker_after();

-- Comentário
COMMENT ON FUNCTION registrar_venda_skywalker_after() IS 'Calcula estrelas Skywalker APÓS venda ser inserida/atualizada';
