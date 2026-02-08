/*
  # Atualizar função para recalcular ao mudar tipo_venda

  1. Alteração
    - Detectar quando tipo_venda muda
    - Recalcular pilar antigo (remover venda)
    - Recalcular pilar novo (adicionar venda)
*/

CREATE OR REPLACE FUNCTION registrar_venda_skywalker()
RETURNS TRIGGER AS $$
DECLARE
  v_profissional_id uuid;
  v_profissional_time text;
  v_mes_ref date;
  v_pilar_id uuid;
  v_pilar_nome text;
  v_total_vendas_mes integer;
  v_estrelas_calculadas integer;
  v_old_profissional_id uuid;
  v_old_pilar_id uuid;
  v_old_pilar_nome text;
BEGIN
  -- ===== RECALCULAR PILAR ANTIGO se tipo_venda MUDOU =====
  IF TG_OP = 'UPDATE' AND OLD.tipo_venda IS DISTINCT FROM NEW.tipo_venda AND OLD.status = 'concluido' THEN
    -- Buscar profissional
    SELECT p.id, p.time INTO v_profissional_id, v_profissional_time
    FROM skywalker_profissionais p
    WHERE p.usuario_id = OLD.vendedor_id
      AND p.ativo = true
    LIMIT 1;
    
    IF v_profissional_id IS NOT NULL THEN
      v_mes_ref := date_trunc('month', OLD.created_at)::date;
      
      -- Mapear tipo ANTIGO para pilar
      CASE OLD.tipo_venda
        WHEN 'store_plus' THEN v_old_pilar_nome := 'Vendas Store+';
        WHEN 'seguro_care' THEN v_old_pilar_nome := 'Vendas Care+';
        WHEN 'smb' THEN v_old_pilar_nome := 'SMB';
        ELSE v_old_pilar_nome := NULL;
      END CASE;
      
      IF v_old_pilar_nome IS NOT NULL THEN
        -- Buscar pilar antigo
        SELECT id INTO v_old_pilar_id
        FROM skywalker_pilares
        WHERE nome = v_old_pilar_nome
          AND ativo = true
          AND (unidade_id = OLD.unidade_id OR unidade_id IS NULL)
        ORDER BY unidade_id NULLS LAST
        LIMIT 1;
        
        IF v_old_pilar_id IS NOT NULL THEN
          -- Contar vendas do tipo ANTIGO (excluindo a atual que está mudando)
          SELECT COUNT(*) INTO v_total_vendas_mes
          FROM vendas
          WHERE vendedor_id = OLD.vendedor_id
            AND tipo_venda = OLD.tipo_venda
            AND status = 'concluido'
            AND date_trunc('month', created_at)::date = v_mes_ref
            AND id != NEW.id;
          
          -- Buscar estrelas pela regra
          SELECT r.estrelas INTO v_estrelas_calculadas
          FROM skywalker_regras_estrelas r
          WHERE r.pilar_id = v_old_pilar_id
            AND r.time = v_profissional_time
            AND r.ativo = true
            AND v_total_vendas_mes >= r.valor_minimo
            AND (r.valor_maximo IS NULL OR v_total_vendas_mes <= r.valor_maximo)
            AND (r.unidade_id = OLD.unidade_id OR r.unidade_id IS NULL)
          ORDER BY r.unidade_id NULLS LAST, r.valor_minimo DESC
          LIMIT 1;
          
          IF v_estrelas_calculadas IS NULL THEN
            v_estrelas_calculadas := 0;
          END IF;
          
          -- Atualizar ou remover registro do pilar antigo
          IF v_total_vendas_mes > 0 THEN
            INSERT INTO skywalker_estrelas_mes (
              profissional_id,
              mes_referencia,
              pilar_id,
              valor_metrica,
              estrelas_conquistadas
            ) VALUES (
              v_profissional_id,
              v_mes_ref,
              v_old_pilar_id,
              v_total_vendas_mes,
              v_estrelas_calculadas
            )
            ON CONFLICT (profissional_id, mes_referencia, pilar_id)
            DO UPDATE SET
              valor_metrica = v_total_vendas_mes,
              estrelas_conquistadas = v_estrelas_calculadas;
          ELSE
            -- Se não tem mais vendas desse tipo, remover registro
            DELETE FROM skywalker_estrelas_mes
            WHERE profissional_id = v_profissional_id
              AND mes_referencia = v_mes_ref
              AND pilar_id = v_old_pilar_id;
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;
  
  -- ===== RECALCULAR VENDEDOR ANTIGO se vendedor_id MUDOU =====
  IF TG_OP = 'UPDATE' AND OLD.vendedor_id IS DISTINCT FROM NEW.vendedor_id AND OLD.status = 'concluido' THEN
    SELECT p.id, p.time INTO v_old_profissional_id, v_profissional_time
    FROM skywalker_profissionais p
    WHERE p.usuario_id = OLD.vendedor_id
      AND p.ativo = true
    LIMIT 1;
    
    IF v_old_profissional_id IS NOT NULL THEN
      v_mes_ref := date_trunc('month', OLD.created_at)::date;
      
      CASE OLD.tipo_venda
        WHEN 'store_plus' THEN v_pilar_nome := 'Vendas Store+';
        WHEN 'seguro_care' THEN v_pilar_nome := 'Vendas Care+';
        WHEN 'smb' THEN v_pilar_nome := 'SMB';
        ELSE v_pilar_nome := NULL;
      END CASE;
      
      IF v_pilar_nome IS NOT NULL THEN
        SELECT id INTO v_pilar_id
        FROM skywalker_pilares
        WHERE nome = v_pilar_nome
          AND ativo = true
          AND (unidade_id = OLD.unidade_id OR unidade_id IS NULL)
        ORDER BY unidade_id NULLS LAST
        LIMIT 1;
        
        IF v_pilar_id IS NOT NULL THEN
          SELECT COUNT(*) INTO v_total_vendas_mes
          FROM vendas
          WHERE vendedor_id = OLD.vendedor_id
            AND tipo_venda = OLD.tipo_venda
            AND status = 'concluido'
            AND date_trunc('month', created_at)::date = v_mes_ref
            AND id != NEW.id;
          
          SELECT r.estrelas INTO v_estrelas_calculadas
          FROM skywalker_regras_estrelas r
          WHERE r.pilar_id = v_pilar_id
            AND r.time = v_profissional_time
            AND r.ativo = true
            AND v_total_vendas_mes >= r.valor_minimo
            AND (r.valor_maximo IS NULL OR v_total_vendas_mes <= r.valor_maximo)
            AND (r.unidade_id = OLD.unidade_id OR r.unidade_id IS NULL)
          ORDER BY r.unidade_id NULLS LAST, r.valor_minimo DESC
          LIMIT 1;
          
          IF v_estrelas_calculadas IS NULL THEN
            v_estrelas_calculadas := 0;
          END IF;
          
          IF v_total_vendas_mes > 0 THEN
            INSERT INTO skywalker_estrelas_mes (
              profissional_id,
              mes_referencia,
              pilar_id,
              valor_metrica,
              estrelas_conquistadas
            ) VALUES (
              v_old_profissional_id,
              v_mes_ref,
              v_pilar_id,
              v_total_vendas_mes,
              v_estrelas_calculadas
            )
            ON CONFLICT (profissional_id, mes_referencia, pilar_id)
            DO UPDATE SET
              valor_metrica = v_total_vendas_mes,
              estrelas_conquistadas = v_estrelas_calculadas;
          ELSE
            DELETE FROM skywalker_estrelas_mes
            WHERE profissional_id = v_old_profissional_id
              AND mes_referencia = v_mes_ref
              AND pilar_id = v_pilar_id;
          END IF;
        END IF;
      END IF;
    END IF;
  END IF;
  
  -- ===== PROCESSAR VENDA CONCLUÍDA (status ou tipo NOVO) =====
  IF NEW.status = 'concluido' THEN
    SELECT p.id, p.time INTO v_profissional_id, v_profissional_time
    FROM skywalker_profissionais p
    WHERE p.usuario_id = NEW.vendedor_id
      AND p.ativo = true
    LIMIT 1;
    
    IF v_profissional_id IS NULL THEN
      NEW.log_skywalker := NEW.log_skywalker || jsonb_build_object(
        'tipo', 'erro',
        'data', now(),
        'status', 'erro',
        'mensagem', 'Vendedor não está cadastrado no sistema Skywalker'
      );
      RETURN NEW;
    END IF;
    
    v_mes_ref := date_trunc('month', NEW.created_at)::date;
    
    CASE NEW.tipo_venda
      WHEN 'store_plus' THEN v_pilar_nome := 'Vendas Store+';
      WHEN 'seguro_care' THEN v_pilar_nome := 'Vendas Care+';
      WHEN 'smb' THEN v_pilar_nome := 'SMB';
      ELSE v_pilar_nome := NULL;
    END CASE;
    
    IF v_pilar_nome IS NULL THEN
      NEW.log_skywalker := NEW.log_skywalker || jsonb_build_object(
        'tipo', 'erro',
        'data', now(),
        'status', 'erro',
        'mensagem', format('Tipo de venda não mapeado: %s', NEW.tipo_venda)
      );
      RETURN NEW;
    END IF;
    
    SELECT id INTO v_pilar_id
    FROM skywalker_pilares
    WHERE nome = v_pilar_nome
      AND ativo = true
      AND (unidade_id = NEW.unidade_id OR unidade_id IS NULL)
    ORDER BY unidade_id NULLS LAST
    LIMIT 1;
    
    IF v_pilar_id IS NULL THEN
      NEW.log_skywalker := NEW.log_skywalker || jsonb_build_object(
        'tipo', 'erro',
        'data', now(),
        'status', 'erro',
        'mensagem', format('Pilar não encontrado: %s', v_pilar_nome)
      );
      RETURN NEW;
    END IF;
    
    SELECT COUNT(*) INTO v_total_vendas_mes
    FROM vendas
    WHERE vendedor_id = NEW.vendedor_id
      AND tipo_venda = NEW.tipo_venda
      AND status = 'concluido'
      AND date_trunc('month', created_at)::date = v_mes_ref;
    
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
    
    NEW.enviado_skywalker := true;
    NEW.data_envio_skywalker := now();
    NEW.log_skywalker := NEW.log_skywalker || jsonb_build_object(
      'tipo', 'recalculo',
      'data', now(),
      'status', 'sucesso',
      'pilar_id', v_pilar_id,
      'pilar_nome', v_pilar_nome,
      'total_vendas_mes', v_total_vendas_mes,
      'estrelas_calculadas', v_estrelas_calculadas,
      'mensagem', format('Total de %s vendas no mês = %s estrelas', v_total_vendas_mes, v_estrelas_calculadas)
    );
  
  -- ===== PROCESSAR VENDA CANCELADA =====
  ELSIF NEW.status = 'cancelado' AND (TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND OLD.status != 'cancelado')) THEN
    SELECT p.id, p.time INTO v_profissional_id, v_profissional_time
    FROM skywalker_profissionais p
    WHERE p.usuario_id = NEW.vendedor_id
      AND p.ativo = true
    LIMIT 1;
    
    IF v_profissional_id IS NOT NULL THEN
      v_mes_ref := date_trunc('month', NEW.created_at)::date;
      
      CASE NEW.tipo_venda
        WHEN 'store_plus' THEN v_pilar_nome := 'Vendas Store+';
        WHEN 'seguro_care' THEN v_pilar_nome := 'Vendas Care+';
        WHEN 'smb' THEN v_pilar_nome := 'SMB';
        ELSE v_pilar_nome := NULL;
      END CASE;
      
      IF v_pilar_nome IS NOT NULL THEN
        SELECT id INTO v_pilar_id
        FROM skywalker_pilares
        WHERE nome = v_pilar_nome
          AND ativo = true
          AND (unidade_id = NEW.unidade_id OR unidade_id IS NULL)
        ORDER BY unidade_id NULLS LAST
        LIMIT 1;
        
        IF v_pilar_id IS NOT NULL THEN
          SELECT COUNT(*) INTO v_total_vendas_mes
          FROM vendas
          WHERE vendedor_id = NEW.vendedor_id
            AND tipo_venda = NEW.tipo_venda
            AND status = 'concluido'
            AND date_trunc('month', created_at)::date = v_mes_ref;
          
          IF v_total_vendas_mes > 0 THEN
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
            
            UPDATE skywalker_estrelas_mes
            SET valor_metrica = v_total_vendas_mes,
                estrelas_conquistadas = v_estrelas_calculadas
            WHERE profissional_id = v_profissional_id
              AND mes_referencia = v_mes_ref
              AND pilar_id = v_pilar_id;
          ELSE
            DELETE FROM skywalker_estrelas_mes
            WHERE profissional_id = v_profissional_id
              AND mes_referencia = v_mes_ref
              AND pilar_id = v_pilar_id;
          END IF;
          
          NEW.log_skywalker := NEW.log_skywalker || jsonb_build_object(
            'tipo', 'cancelamento',
            'data', now(),
            'status', 'sucesso',
            'mensagem', 'Estrelas recalculadas após cancelamento'
          );
        END IF;
      END IF;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION registrar_venda_skywalker() IS 'Calcula estrelas Skywalker baseado no total acumulado. Recalcula quando status, vendedor ou tipo de venda mudam.';
