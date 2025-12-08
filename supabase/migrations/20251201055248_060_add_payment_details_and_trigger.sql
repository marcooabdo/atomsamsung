/*
  # Add Payment Details and Auto-Update Trigger

  1. New Columns in `pagamentos`
    - `parcelamento` (integer) - Number of installments (1-12)
    - `taxa_percentual` (numeric) - Card fee percentage applied
    - `taxa_valor` (numeric) - Card fee value in reais
    - `taxa_paga_por` (text) - Who pays the fee ('cliente' or 'empresa')
    - `nsu` (text) - NSU/transaction code for card payments
    - `valor_bruto` (numeric) - Gross value before fees
    - `valor_liquido` (numeric) - Net value after fees

  2. Trigger Function
    - `atualizar_valores_os()` - Auto-updates OS payment values
    - Calculates total `valor_pago` from all payments
    - Updates `saldo_restante` (remaining balance)
    - Updates `status_pagamento` (pendente/parcial/pago)

  3. Trigger
    - Executes after INSERT on `pagamentos`
    - Keeps OS payment values always synchronized

  4. Security
    - Uses existing RLS policies on pagamentos table
    - Trigger function runs with definer security
*/

-- Add new columns to pagamentos table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pagamentos' AND column_name = 'parcelamento'
  ) THEN
    ALTER TABLE pagamentos ADD COLUMN parcelamento integer DEFAULT 1 CHECK (parcelamento >= 1 AND parcelamento <= 12);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pagamentos' AND column_name = 'taxa_percentual'
  ) THEN
    ALTER TABLE pagamentos ADD COLUMN taxa_percentual numeric(5,2) DEFAULT 0 CHECK (taxa_percentual >= 0 AND taxa_percentual <= 100);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pagamentos' AND column_name = 'taxa_valor'
  ) THEN
    ALTER TABLE pagamentos ADD COLUMN taxa_valor numeric(10,2) DEFAULT 0 CHECK (taxa_valor >= 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pagamentos' AND column_name = 'taxa_paga_por'
  ) THEN
    ALTER TABLE pagamentos ADD COLUMN taxa_paga_por text CHECK (taxa_paga_por IN ('cliente', 'empresa'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pagamentos' AND column_name = 'nsu'
  ) THEN
    ALTER TABLE pagamentos ADD COLUMN nsu text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pagamentos' AND column_name = 'valor_bruto'
  ) THEN
    ALTER TABLE pagamentos ADD COLUMN valor_bruto numeric(10,2);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pagamentos' AND column_name = 'valor_liquido'
  ) THEN
    ALTER TABLE pagamentos ADD COLUMN valor_liquido numeric(10,2);
  END IF;
END $$;

-- Create function to update OS payment values
CREATE OR REPLACE FUNCTION atualizar_valores_os()
RETURNS TRIGGER AS $$
DECLARE
  v_os_id uuid;
  v_valor_total numeric;
  v_valor_pago numeric;
  v_saldo numeric;
  v_status text;
BEGIN
  v_os_id := NEW.os_id;

  SELECT valor_total INTO v_valor_total
  FROM os
  WHERE id = v_os_id;

  SELECT COALESCE(SUM(valor_liquido), 0) INTO v_valor_pago
  FROM pagamentos
  WHERE os_id = v_os_id;

  v_saldo := v_valor_total - v_valor_pago;

  IF v_saldo <= 0 THEN
    v_status := 'pago';
    v_saldo := 0;
  ELSIF v_valor_pago > 0 THEN
    v_status := 'parcial';
  ELSE
    v_status := 'pendente';
  END IF;

  UPDATE os
  SET
    valor_pago = v_valor_pago,
    saldo_restante = v_saldo,
    status_pagamento = v_status,
    updated_at = now()
  WHERE id = v_os_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and create new one
DROP TRIGGER IF EXISTS trigger_atualizar_valores_os ON pagamentos;

CREATE TRIGGER trigger_atualizar_valores_os
  AFTER INSERT ON pagamentos
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_valores_os();

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_pagamentos_os_id ON pagamentos(os_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_valor_liquido ON pagamentos(valor_liquido);
