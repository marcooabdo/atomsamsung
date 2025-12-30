/*
  # Corrigir trigger de formatação - remover campo inexistente

  1. Correção
    - Remove referência ao campo diagnostico_tecnico que não existe na tabela os
    - Mantém formatação dos outros campos que existem
*/

-- Atualizar função removendo campo inexistente
CREATE OR REPLACE FUNCTION formatar_os_campos()
RETURNS TRIGGER AS $$
BEGIN
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

  -- Formatar tipo_reparo
  IF NEW.tipo_reparo IS NOT NULL THEN
    NEW.tipo_reparo := TRIM(REGEXP_REPLACE(NEW.tipo_reparo, E'[\\n\\r\\t\\s]+', '', 'g'));
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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
