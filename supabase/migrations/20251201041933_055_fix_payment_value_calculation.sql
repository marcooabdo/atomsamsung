/*
  # Fix Payment Value Calculation

  1. Changes
    - Add trigger to set valor_total on OS when cotacao is approved
    - Calculate valor_total from cotacao pecas + servicos
    - Ensure valor_total is set correctly for payment tracking

  2. Logic
    - When cotacao status = 'aprovado', calculate total from pecas and servicos
    - Set os.valor_total = sum of all cotacao items
    - This ensures payment system has correct base value
*/

-- Function to calculate and set valor_total on OS when cotacao is approved
CREATE OR REPLACE FUNCTION atualizar_valor_total_os()
RETURNS TRIGGER AS $$
DECLARE
  v_total_pecas NUMERIC := 0;
  v_total_servicos NUMERIC := 0;
  v_taxa_cliente NUMERIC := 0;
  v_desconto NUMERIC := 0;
  v_valor_final NUMERIC := 0;
BEGIN
  -- Only update if status changed to 'aprovado'
  IF NEW.status = 'aprovado' AND (OLD.status IS NULL OR OLD.status != 'aprovado') THEN
    
    -- Calculate total from pecas
    SELECT COALESCE(SUM(valor_total), 0)
    INTO v_total_pecas
    FROM cotacoes_pecas
    WHERE cotacao_id = NEW.id;
    
    -- Calculate total from servicos
    SELECT COALESCE(SUM(valor_total), 0)
    INTO v_total_servicos
    FROM cotacoes_servicos
    WHERE cotacao_id = NEW.id;
    
    -- Get taxa_para_cliente (customer fee)
    v_taxa_cliente := COALESCE(NEW.taxa_para_cliente, 0);
    
    -- Get desconto
    v_desconto := COALESCE(NEW.desconto_valor, 0);
    
    -- Calculate final value
    v_valor_final := v_total_pecas + v_total_servicos + v_taxa_cliente - v_desconto;
    
    -- Update OS with calculated valor_total
    UPDATE os
    SET valor_total = v_valor_final
    WHERE cotacao_id = NEW.id;
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger
DROP TRIGGER IF EXISTS trigger_atualizar_valor_total_os ON cotacoes;
CREATE TRIGGER trigger_atualizar_valor_total_os
  AFTER INSERT OR UPDATE OF status
  ON cotacoes
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_valor_total_os();

-- Update existing approved cotacoes to set valor_total
DO $$
DECLARE
  v_cotacao RECORD;
  v_total_pecas NUMERIC;
  v_total_servicos NUMERIC;
  v_taxa_cliente NUMERIC;
  v_desconto NUMERIC;
  v_valor_final NUMERIC;
BEGIN
  FOR v_cotacao IN 
    SELECT c.id, c.taxa_para_cliente, c.desconto_valor
    FROM cotacoes c
    WHERE c.status = 'aprovado'
  LOOP
    -- Calculate total from pecas
    SELECT COALESCE(SUM(valor_total), 0)
    INTO v_total_pecas
    FROM cotacoes_pecas
    WHERE cotacao_id = v_cotacao.id;
    
    -- Calculate total from servicos
    SELECT COALESCE(SUM(valor_total), 0)
    INTO v_total_servicos
    FROM cotacoes_servicos
    WHERE cotacao_id = v_cotacao.id;
    
    -- Get values
    v_taxa_cliente := COALESCE(v_cotacao.taxa_para_cliente, 0);
    v_desconto := COALESCE(v_cotacao.desconto_valor, 0);
    v_valor_final := v_total_pecas + v_total_servicos + v_taxa_cliente - v_desconto;
    
    -- Update OS
    UPDATE os
    SET valor_total = v_valor_final
    WHERE cotacao_id = v_cotacao.id;
  END LOOP;
END $$;
