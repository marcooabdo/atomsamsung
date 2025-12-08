/*
  # Fix Cotação Modification Trigger - Replace desconto_percentual with desconto_tipo

  1. Problem
    - The trigger `mark_cotacao_modified_on_cotacao_change` references non-existent field `desconto_percentual`
    - This causes "Bad Request" errors when updating cotacoes
    - The correct field is `desconto_tipo` (enum: 'percentual' or 'fixo')

  2. Changes
    - Update trigger function to use `desconto_tipo` instead of `desconto_percentual`
    - Keep monitoring of `desconto_valor`, `forma_pagamento`, and `taxa_cliente`
    
  3. Security
    - Function remains SECURITY DEFINER for proper user tracking
    - No permission changes needed
*/

-- Recreate function with correct field reference
CREATE OR REPLACE FUNCTION mark_cotacao_modified_on_cotacao_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if relevant fields changed and cotação has been sent
  IF OLD.orcamento_enviado = true AND (
    OLD.desconto_tipo IS DISTINCT FROM NEW.desconto_tipo OR
    OLD.desconto_valor IS DISTINCT FROM NEW.desconto_valor OR
    OLD.forma_pagamento IS DISTINCT FROM NEW.forma_pagamento OR
    OLD.taxa_cliente IS DISTINCT FROM NEW.taxa_cliente
  ) THEN
    NEW.orcamento_modificado_apos_envio := true;
    NEW.ultima_modificacao_em := now();
    NEW.ultima_modificacao_por := (SELECT id FROM usuarios WHERE email = auth.jwt()->>'email' LIMIT 1);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
