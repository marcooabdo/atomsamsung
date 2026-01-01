/*
  # Sistema Automático de Criação de Etiquetas
  
  1. Função e Trigger
    - Cria automaticamente uma etiqueta quando uma peça é registrada
    - Atualiza a etiqueta quando o delivery é modificado
    - Usa o id_numerico como id_sequencial
  
  2. Segurança
    - Mantém RLS existente
*/

-- Função para criar/atualizar etiqueta automaticamente
CREATE OR REPLACE FUNCTION criar_etiqueta_automatica()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_codigo_barras text;
  v_etiqueta_existe boolean;
BEGIN
  -- Verificar se já existe etiqueta para esta peça
  SELECT EXISTS(
    SELECT 1 FROM estoque_etiquetas 
    WHERE peca_id = NEW.id
  ) INTO v_etiqueta_existe;

  IF v_etiqueta_existe THEN
    -- Atualizar etiqueta existente
    UPDATE estoque_etiquetas
    SET 
      part_number = NEW.pn,
      descricao = NEW.descricao,
      delivery = NEW.delivery,
      localizacao = NEW.localizacao
    WHERE peca_id = NEW.id;
  ELSE
    -- Criar nova etiqueta
    v_codigo_barras := LPAD(floor(random() * 999999999999)::text, 12, '0');
    
    INSERT INTO estoque_etiquetas (
      unidade_id,
      peca_id,
      codigo_barras,
      id_sequencial,
      part_number,
      descricao,
      delivery,
      localizacao
    ) VALUES (
      NEW.unidade_id,
      NEW.id,
      v_codigo_barras,
      NEW.id_numerico::text,
      NEW.pn,
      NEW.descricao,
      NEW.delivery,
      NEW.localizacao
    );
  END IF;

  RETURN NEW;
END;
$$;

-- Criar trigger
DROP TRIGGER IF EXISTS trigger_criar_etiqueta_automatica ON estoque_pecas;
CREATE TRIGGER trigger_criar_etiqueta_automatica
  AFTER INSERT OR UPDATE OF pn, descricao, delivery, localizacao
  ON estoque_pecas
  FOR EACH ROW
  EXECUTE FUNCTION criar_etiqueta_automatica();
