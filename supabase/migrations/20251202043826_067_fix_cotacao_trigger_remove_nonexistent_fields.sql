/*
  # Fix Cotação Modification Trigger - Remove Non-Existent Field References

  1. Problem
    - The trigger `mark_cotacao_modified_on_cotacao_change` references fields that don't exist:
      - `forma_pagamento` (the table has `forma_pagamento_id` as UUID, not a direct field)
      - `taxa_cliente` (this field was never added to cotacoes table)
    - These missing fields cause "Bad Request" errors when updating cotacoes
    - Error: record "old" has no field "forma_pagamento"

  2. Changes
    - Simplify trigger to only monitor fields that actually exist in cotacoes table:
      - `desconto_tipo` (enum: 'percentual' or 'fixo')
      - `desconto_valor` (numeric)
    - Remove checks for `forma_pagamento` and `taxa_cliente`
    - Payment changes are tracked separately through the pagamentos table
    
  3. Security
    - Function remains SECURITY DEFINER for proper user tracking
    - No permission changes needed
*/

-- Recreate function with only existing field references
CREATE OR REPLACE FUNCTION mark_cotacao_modified_on_cotacao_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if relevant fields changed and cotação has been sent
  -- Only monitor fields that actually exist in the cotacoes table
  IF OLD.orcamento_enviado = true AND (
    OLD.desconto_tipo IS DISTINCT FROM NEW.desconto_tipo OR
    OLD.desconto_valor IS DISTINCT FROM NEW.desconto_valor
  ) THEN
    NEW.orcamento_modificado_apos_envio := true;
    NEW.ultima_modificacao_em := now();
    NEW.ultima_modificacao_por := (SELECT id FROM usuarios WHERE email = auth.jwt()->>'email' LIMIT 1);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
