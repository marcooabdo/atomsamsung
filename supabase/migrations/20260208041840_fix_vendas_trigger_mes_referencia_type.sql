/*
  # Corrigir tipo de mes_referencia no trigger de vendas

  1. Alteração
    - Corrigir a função `registrar_venda_skywalker()` para usar tipo date ao invés de text
    - O campo mes_referencia deve ser date, não text
*/

CREATE OR REPLACE FUNCTION registrar_venda_skywalker()
RETURNS TRIGGER AS $$
DECLARE
  v_profissional_id uuid;
  v_mes_ref date;
  v_pilar_id uuid;
  v_estrelas integer;
BEGIN
  -- Só processa se status mudou para concluido e ainda não foi enviado
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status != 'concluido') AND NEW.enviado_skywalker = false THEN
    
    -- Buscar profissional do vendedor
    SELECT id INTO v_profissional_id
    FROM skywalker_profissionais
    WHERE usuario_id = NEW.vendedor_id
      AND ativo = true
    LIMIT 1;
    
    IF v_profissional_id IS NOT NULL THEN
      -- Mês de referência como date
      v_mes_ref := date_trunc('month', NEW.created_at)::date;
      
      -- Determinar pilar e estrelas baseado no tipo de venda
      CASE NEW.tipo_venda
        WHEN 'store_plus' THEN
          -- Buscar pilar de Vendas Store
          SELECT id INTO v_pilar_id
          FROM skywalker_pilares
          WHERE nome ILIKE '%store%'
            AND ativo = true
            AND (unidade_id = NEW.unidade_id OR unidade_id IS NULL)
          ORDER BY unidade_id NULLS LAST
          LIMIT 1;
          v_estrelas := 1;
          
        WHEN 'seguro_care' THEN
          -- Buscar pilar de Care
          SELECT id INTO v_pilar_id
          FROM skywalker_pilares
          WHERE nome ILIKE '%care%'
            AND ativo = true
            AND (unidade_id = NEW.unidade_id OR unidade_id IS NULL)
          ORDER BY unidade_id NULLS LAST
          LIMIT 1;
          v_estrelas := 1;
          
        WHEN 'smb' THEN
          -- Buscar pilar de SMB
          SELECT id INTO v_pilar_id
          FROM skywalker_pilares
          WHERE nome ILIKE '%smb%'
            AND ativo = true
            AND (unidade_id = NEW.unidade_id OR unidade_id IS NULL)
          ORDER BY unidade_id NULLS LAST
          LIMIT 1;
          v_estrelas := 2;
      END CASE;
      
      -- Se encontrou pilar, registrar estrelas
      IF v_pilar_id IS NOT NULL THEN
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
          1,
          v_estrelas
        )
        ON CONFLICT (profissional_id, mes_referencia, pilar_id)
        DO UPDATE SET
          valor_metrica = skywalker_estrelas_mes.valor_metrica + 1,
          estrelas_conquistadas = skywalker_estrelas_mes.estrelas_conquistadas + v_estrelas;
        
        -- Marcar como enviado
        NEW.enviado_skywalker := true;
        NEW.data_envio_skywalker := now();
        NEW.log_skywalker := NEW.log_skywalker || jsonb_build_object(
          'tipo', 'envio',
          'data', now(),
          'status', 'sucesso',
          'pilar_id', v_pilar_id,
          'estrelas', v_estrelas,
          'mensagem', format('Venda registrada com %s estrelas', v_estrelas)
        );
      ELSE
        -- Log de erro - pilar não encontrado
        NEW.log_skywalker := NEW.log_skywalker || jsonb_build_object(
          'tipo', 'erro',
          'data', now(),
          'status', 'erro',
          'mensagem', format('Pilar não encontrado para tipo de venda: %s', NEW.tipo_venda)
        );
      END IF;
    ELSE
      -- Log de erro - profissional não encontrado
      NEW.log_skywalker := NEW.log_skywalker || jsonb_build_object(
        'tipo', 'erro',
        'data', now(),
        'status', 'erro',
        'mensagem', 'Vendedor não está cadastrado no sistema Skywalker'
      );
    END IF;
  END IF;
  
  -- Se status mudou para cancelado, remover pontos se foram enviados
  IF NEW.status = 'cancelado' AND OLD.status = 'concluido' AND NEW.enviado_skywalker = true THEN
    -- Buscar profissional
    SELECT id INTO v_profissional_id
    FROM skywalker_profissionais
    WHERE usuario_id = NEW.vendedor_id
      AND ativo = true
    LIMIT 1;
    
    IF v_profissional_id IS NOT NULL THEN
      v_mes_ref := date_trunc('month', NEW.created_at)::date;
      
      -- Determinar estrelas a remover
      CASE NEW.tipo_venda
        WHEN 'store_plus', 'seguro_care' THEN v_estrelas := 1;
        WHEN 'smb' THEN v_estrelas := 2;
      END CASE;
      
      -- Atualizar estrelas (decrementar)
      UPDATE skywalker_estrelas_mes
      SET 
        valor_metrica = GREATEST(0, valor_metrica - 1),
        estrelas_conquistadas = GREATEST(0, estrelas_conquistadas - v_estrelas)
      WHERE profissional_id = v_profissional_id
        AND mes_referencia = v_mes_ref;
      
      -- Log de cancelamento
      NEW.log_skywalker := NEW.log_skywalker || jsonb_build_object(
        'tipo', 'cancelamento',
        'data', now(),
        'status', 'sucesso',
        'estrelas_removidas', v_estrelas,
        'mensagem', 'Pontos removidos devido ao cancelamento'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
