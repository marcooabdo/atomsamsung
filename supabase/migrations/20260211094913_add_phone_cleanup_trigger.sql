/*
  # Trigger para Limpeza Automatica de Telefones

  Adiciona trigger que limpa automaticamente o sufixo de dispositivo
  (:XX) dos telefones antes de inserir ou atualizar conversas.
*/

-- Funcao para limpar numero de telefone (remover sufixo de dispositivo)
CREATE OR REPLACE FUNCTION clean_phone_number(phone TEXT)
RETURNS TEXT AS $$
DECLARE
  clean TEXT;
  colon_pos INT;
BEGIN
  IF phone IS NULL THEN
    RETURN NULL;
  END IF;
  
  clean := phone;
  colon_pos := position(':' IN clean);
  
  IF colon_pos > 0 THEN
    clean := substring(clean FROM 1 FOR colon_pos - 1);
  END IF;
  
  RETURN clean;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Trigger para limpar telefone automaticamente
CREATE OR REPLACE FUNCTION clean_conversa_telefone()
RETURNS TRIGGER AS $$
BEGIN
  NEW.cliente_telefone := clean_phone_number(NEW.cliente_telefone);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_clean_conversa_telefone ON atom_connect_conversas;

CREATE TRIGGER trigger_clean_conversa_telefone
  BEFORE INSERT OR UPDATE OF cliente_telefone ON atom_connect_conversas
  FOR EACH ROW
  EXECUTE FUNCTION clean_conversa_telefone();
