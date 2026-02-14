/*
  # Corrigir Tipo de mes_referencia na Função de Avaliação

  1. Problema
    - Função registrar_avaliacao_skywalker() estava usando mes_referencia como text
    - Tabela skywalker_estrelas_mes espera date
    - Causava erro: "column mes_referencia is of type date but expression is of type text"

  2. Solução
    - Alterar v_mes_ref de text para date
    - Remover conversão ::text
    - Usar date_trunc('month', NEW.created_at)::date diretamente
*/

-- Recriar função com tipo correto
CREATE OR REPLACE FUNCTION registrar_avaliacao_skywalker()
RETURNS TRIGGER AS $$
DECLARE
  v_profissional_id uuid;
  v_mes_ref date;
  v_pilar_id uuid;
  v_estrelas integer := 1;
BEGIN
  IF NEW.avaliacao_validada = true AND (OLD.avaliacao_validada IS NULL OR OLD.avaliacao_validada = false) THEN

    SELECT id INTO v_profissional_id
    FROM skywalker_profissionais
    WHERE usuario_id = NEW.vendedor_id
      AND ativo = true
    LIMIT 1;

    IF v_profissional_id IS NOT NULL THEN
      v_mes_ref := date_trunc('month', NEW.created_at)::date;

      SELECT id INTO v_pilar_id
      FROM skywalker_pilares
      WHERE (nome ILIKE '%google%' OR nome ILIKE '%review%' OR nome ILIKE '%avalia%')
        AND ativo = true
        AND (unidade_id = NEW.unidade_id OR unidade_id IS NULL)
      ORDER BY unidade_id NULLS LAST
      LIMIT 1;

      IF v_pilar_id IS NULL THEN
        SELECT id INTO v_pilar_id
        FROM skywalker_pilares
        WHERE nome ILIKE '%venda%'
          AND ativo = true
          AND (unidade_id = NEW.unidade_id OR unidade_id IS NULL)
        ORDER BY unidade_id NULLS LAST
        LIMIT 1;
      END IF;

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

        NEW.log_skywalker := NEW.log_skywalker || jsonb_build_object(
          'tipo', 'avaliacao_validada',
          'data', now(),
          'status', 'sucesso',
          'pilar_id', v_pilar_id,
          'estrelas', v_estrelas,
          'validada_por', NEW.avaliacao_validada_por,
          'mensagem', format('Avaliação validada e registrada com %s estrela(s)', v_estrelas)
        );
      ELSE
        NEW.log_skywalker := NEW.log_skywalker || jsonb_build_object(
          'tipo', 'avaliacao_validada',
          'data', now(),
          'status', 'aviso',
          'mensagem', 'Pilar Google Reviews não encontrado, estrelas não contabilizadas'
        );
      END IF;
    ELSE
      NEW.log_skywalker := NEW.log_skywalker || jsonb_build_object(
        'tipo', 'avaliacao_validada',
        'data', now(),
        'status', 'erro',
        'mensagem', 'Vendedor não está cadastrado no sistema Skywalker'
      );
    END IF;
  END IF;

  IF NEW.avaliacao_validada = false AND OLD.avaliacao_validada = true THEN
    SELECT id INTO v_profissional_id
    FROM skywalker_profissionais
    WHERE usuario_id = NEW.vendedor_id
      AND ativo = true
    LIMIT 1;

    IF v_profissional_id IS NOT NULL THEN
      v_mes_ref := date_trunc('month', NEW.created_at)::date;
      v_estrelas := 1;

      SELECT id INTO v_pilar_id
      FROM skywalker_pilares
      WHERE (nome ILIKE '%google%' OR nome ILIKE '%review%' OR nome ILIKE '%avalia%')
        AND ativo = true
        AND (unidade_id = NEW.unidade_id OR unidade_id IS NULL)
      ORDER BY unidade_id NULLS LAST
      LIMIT 1;

      IF v_pilar_id IS NOT NULL THEN
        UPDATE skywalker_estrelas_mes
        SET
          valor_metrica = GREATEST(0, valor_metrica - 1),
          estrelas_conquistadas = GREATEST(0, estrelas_conquistadas - v_estrelas)
        WHERE profissional_id = v_profissional_id
          AND mes_referencia = v_mes_ref
          AND pilar_id = v_pilar_id;

        NEW.log_skywalker := NEW.log_skywalker || jsonb_build_object(
          'tipo', 'avaliacao_invalidada',
          'data', now(),
          'status', 'sucesso',
          'estrelas_removidas', v_estrelas,
          'mensagem', 'Pontos removidos devido à invalidação da avaliação'
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Comentário
COMMENT ON FUNCTION registrar_avaliacao_skywalker() IS 'Registra ou remove pontos no Skywalker quando avaliação é validada/invalidada por gestor';
