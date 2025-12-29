/*
  # Vincular Pagamentos Automaticamente à OS

  1. Problema
    - Quando pagamentos são criados em cotações antes da OS existir, ficam com os_id = NULL
    - Quando a OS é criada posteriormente, os pagamentos não são vinculados automaticamente
    
  2. Solução
    - Criar trigger que vincula pagamentos órfãos quando OS é criada/atualizada com cotação
    - Corrigir pagamentos órfãos existentes
    
  3. Segurança
    - Função SECURITY DEFINER para permitir atualização dos pagamentos
*/

-- Função para vincular pagamentos órfãos da cotação à OS
CREATE OR REPLACE FUNCTION vincular_pagamentos_cotacao_a_os()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Se a OS tem uma cotação vinculada, vincular pagamentos órfãos
  IF NEW.cotacao_id IS NOT NULL THEN
    UPDATE pagamentos
    SET 
      os_id = NEW.id,
      updated_at = now()
    WHERE cotacao_id = NEW.cotacao_id
      AND os_id IS NULL;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger para vincular pagamentos ao criar/atualizar OS
DROP TRIGGER IF EXISTS trg_vincular_pagamentos_ao_criar_os ON os;
CREATE TRIGGER trg_vincular_pagamentos_ao_criar_os
  AFTER INSERT OR UPDATE OF cotacao_id ON os
  FOR EACH ROW
  EXECUTE FUNCTION vincular_pagamentos_cotacao_a_os();

-- Corrigir pagamentos órfãos existentes
UPDATE pagamentos p
SET 
  os_id = o.id,
  updated_at = now()
FROM os o
WHERE p.cotacao_id = o.cotacao_id
  AND p.os_id IS NULL
  AND o.cotacao_id IS NOT NULL;
