/*
  # Corrigir integração de vendas com Skywalker para usar regras configuradas

  1. Alteração
    - Reescrever função para calcular estrelas baseado no total de vendas do mês
    - Usar as regras configuradas em skywalker_regras_estrelas
    - Contar vendas do mês e aplicar faixa correta
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
BEGIN
  -- Só processa vendas concluídas ou canceladas
  IF NEW.status NOT IN ('concluido', 'cancelado') THEN
    RETURN NEW;
  END IF;
  
  -- Buscar profissional do vendedor e seu time
  SELECT p.id, p.time INTO v_profissional_id, v_profissional_time
  FROM skywalker_profissionais p
  WHERE p.usuario_id = NEW.vendedor_id
    AND p.ativo = true
  LIMIT 1;
  
  -- Se não encontrou profissional, apenas logar e retornar
  IF v_profissional_id IS NULL THEN
    NEW.log_skywalker := NEW.log_skywalker || jsonb_build_object(
      'tipo', 'erro',
      'data', now(),
      'status', 'erro',
      'mensagem', 'Vendedor não está cadastrado no sistema Skywalker'
    );
    RETURN NEW;
  END IF;
  
  -- Mês de referência
  v_mes_ref := date_trunc('month', NEW.created_at)::date;
  
  -- Mapear tipo de venda para nome do pilar
  CASE NEW.tipo_venda
    WHEN 'store_plus' THEN v_pilar_nome := 'Vendas Store+';
    WHEN 'seguro_care' THEN v_pilar_nome := 'Vendas Care+';
    WHEN 'smb' THEN v_pilar_nome := 'SMB';
    ELSE v_pilar_nome := NULL;
  END CASE;
  
  -- Se não mapeou pilar, retornar
  IF v_pilar_nome IS NULL THEN
    NEW.log_skywalker := NEW.log_skywalker || jsonb_build_object(
      'tipo', 'erro',
      'data', now(),
      'status', 'erro',
      'mensagem', format('Tipo de venda não mapeado: %s', NEW.tipo_venda)
    );
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
  
  -- Se não encontrou pilar, logar e retornar
  IF v_pilar_id IS NULL THEN
    NEW.log_skywalker := NEW.log_skywalker || jsonb_build_object(
      'tipo', 'erro',
      'data', now(),
      'status', 'erro',
      'mensagem', format('Pilar não encontrado: %s', v_pilar_nome)
    );
    RETURN NEW;
  END IF;
  
  -- Contar total de vendas CONCLUÍDAS do vendedor neste mês e tipo
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
  
  -- Se não encontrou regra, estrelas = 0
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
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recriar o trigger
DROP TRIGGER IF EXISTS trigger_registrar_venda_skywalker ON vendas;

CREATE TRIGGER trigger_registrar_venda_skywalker
  BEFORE INSERT OR UPDATE OF status ON vendas
  FOR EACH ROW
  EXECUTE FUNCTION registrar_venda_skywalker();

-- Comentário
COMMENT ON FUNCTION registrar_venda_skywalker() IS 'Calcula estrelas Skywalker baseado no total acumulado de vendas do mês usando regras configuradas';
