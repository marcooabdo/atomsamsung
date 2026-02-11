/*
  # Sincronizar orcamento_aprovado com orcamento_aprovado_em

  1. Trigger para sincronizar automaticamente
    - Quando `orcamento_aprovado_em` for preenchido, marca `orcamento_aprovado` como `true`
    
  2. Corrige dados existentes
    - Atualiza todas as OSs que tem `orcamento_aprovado_em` mas `orcamento_aprovado` = false
*/

-- Corrigir dados existentes
UPDATE os 
SET orcamento_aprovado = true 
WHERE orcamento_aprovado_em IS NOT NULL 
  AND orcamento_aprovado = false;

-- Trigger para sincronizar automaticamente
CREATE OR REPLACE FUNCTION sync_orcamento_flags()
RETURNS TRIGGER AS $$
BEGIN
  -- Se orcamento_aprovado_em for preenchido, marcar orcamento_aprovado como true
  IF NEW.orcamento_aprovado_em IS NOT NULL AND (OLD.orcamento_aprovado_em IS NULL OR OLD.orcamento_aprovado_em IS DISTINCT FROM NEW.orcamento_aprovado_em) THEN
    NEW.orcamento_aprovado := true;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop trigger se já existir
DROP TRIGGER IF EXISTS trigger_sync_orcamento_flags ON os;

-- Criar trigger
CREATE TRIGGER trigger_sync_orcamento_flags
  BEFORE INSERT OR UPDATE ON os
  FOR EACH ROW
  EXECUTE FUNCTION sync_orcamento_flags();
