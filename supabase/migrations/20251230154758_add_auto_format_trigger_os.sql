/*
  # Adicionar trigger de formatação automática para OSs

  1. Função de formatação
    - Remove espaços, quebras de linha e tabs dos campos tipo_os, tipo_atendimento, tipo_orcamento
    - Garante que valores sejam sempre limpos e consistentes
    - Converte para maiúsculas para padronização

  2. Trigger
    - Executa BEFORE INSERT OR UPDATE na tabela os
    - Formata automaticamente os valores antes de salvar
    - Previne dados inconsistentes no banco

  3. Segurança
    - Não afeta RLS (apenas formata valores)
    - Melhora integridade dos dados
*/

-- Função que formata automaticamente os campos de texto
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

  IF NEW.diagnostico_tecnico IS NOT NULL THEN
    NEW.diagnostico_tecnico := TRIM(NEW.diagnostico_tecnico);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger que executa antes de INSERT ou UPDATE
DROP TRIGGER IF EXISTS trigger_formatar_os_campos ON os;

CREATE TRIGGER trigger_formatar_os_campos
  BEFORE INSERT OR UPDATE ON os
  FOR EACH ROW
  EXECUTE FUNCTION formatar_os_campos();
