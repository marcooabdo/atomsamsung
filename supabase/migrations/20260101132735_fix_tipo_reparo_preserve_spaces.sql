/*
  # Corrigir trigger de formatação para preservar espaços no tipo_reparo
  
  1. Mudança
    - O campo tipo_reparo deve preservar espaços entre palavras
    - Em vez de remover todos os espaços, normaliza para espaços únicos
    - Similar ao tratamento de cliente_nome e cliente_endereco
  
  2. Motivo
    - Os valores no select são "Troca de placa", "Troca de painel", etc
    - O trigger estava removendo espaços e salvando "Trocadeplaca"
    - Causava problema ao recarregar a OS, o select não encontrava o valor
*/

-- Atualizar função para preservar espaços no tipo_reparo
CREATE OR REPLACE FUNCTION formatar_os_campos()
RETURNS TRIGGER AS $$
BEGIN
  -- Limpar campos UUID (remover espaços e quebras de linha)
  IF NEW.unidade_id IS NOT NULL THEN
    NEW.unidade_id := TRIM(REGEXP_REPLACE(NEW.unidade_id::text, E'[\\n\\r\\t\\s]+', '', 'g'))::uuid;
  END IF;

  IF NEW.criado_por IS NOT NULL THEN
    NEW.criado_por := TRIM(REGEXP_REPLACE(NEW.criado_por::text, E'[\\n\\r\\t\\s]+', '', 'g'))::uuid;
  END IF;

  IF NEW.tecnico_id IS NOT NULL THEN
    NEW.tecnico_id := TRIM(REGEXP_REPLACE(NEW.tecnico_id::text, E'[\\n\\r\\t\\s]+', '', 'g'))::uuid;
  END IF;

  -- Formatar tipo_os (remover espaços e quebras de linha)
  IF NEW.tipo_os IS NOT NULL THEN
    NEW.tipo_os := UPPER(TRIM(REGEXP_REPLACE(NEW.tipo_os, E'[\\n\\r\\t\\s]+', '', 'g')));
  END IF;

  -- Formatar tipo_atendimento
  IF NEW.tipo_atendimento IS NOT NULL THEN
    NEW.tipo_atendimento := UPPER(TRIM(REGEXP_REPLACE(NEW.tipo_atendimento, E'[\\n\\r\\t\\s]+', '', 'g')));
  END IF;

  -- Formatar tipo_orcamento
  IF NEW.tipo_orcamento IS NOT NULL THEN
    NEW.tipo_orcamento := TRIM(REGEXP_REPLACE(NEW.tipo_orcamento, E'[\\n\\r\\t\\s]+', '', 'g'));
  END IF;

  -- Formatar tipo_reparo (preservar espaços entre palavras)
  IF NEW.tipo_reparo IS NOT NULL THEN
    NEW.tipo_reparo := TRIM(REGEXP_REPLACE(NEW.tipo_reparo, E'\\s+', ' ', 'g'));
  END IF;

  -- Limpar espaços extras de campos de texto importantes
  IF NEW.cliente_nome IS NOT NULL THEN
    NEW.cliente_nome := TRIM(REGEXP_REPLACE(NEW.cliente_nome, E'\\s+', ' ', 'g'));
  END IF;

  IF NEW.cliente_endereco IS NOT NULL THEN
    NEW.cliente_endereco := TRIM(REGEXP_REPLACE(NEW.cliente_endereco, E'\\s+', ' ', 'g'));
  END IF;

  IF NEW.defeito_relatado IS NOT NULL THEN
    NEW.defeito_relatado := TRIM(NEW.defeito_relatado);
  END IF;

  -- Usar nomes corretos dos campos
  IF NEW.aparelho_imei IS NOT NULL THEN
    NEW.aparelho_imei := TRIM(REGEXP_REPLACE(NEW.aparelho_imei, E'[\\n\\r\\t\\s]+', '', 'g'));
  END IF;

  IF NEW.aparelho_numero_serie IS NOT NULL THEN
    NEW.aparelho_numero_serie := TRIM(REGEXP_REPLACE(NEW.aparelho_numero_serie, E'[\\n\\r\\t\\s]+', '', 'g'));
  END IF;

  IF NEW.aparelho_modelo IS NOT NULL THEN
    NEW.aparelho_modelo := TRIM(REGEXP_REPLACE(NEW.aparelho_modelo, E'\\s+', ' ', 'g'));
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
