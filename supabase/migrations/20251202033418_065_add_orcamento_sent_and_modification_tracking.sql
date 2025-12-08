/*
  # Add Orçamento Sent Status and Modification Tracking

  1. New Columns in cotacoes Table
    - `orcamento_enviado` (boolean) - Tracks if orçamento was sent to client
    - `orcamento_enviado_em` (timestamptz) - When orçamento was last sent
    - `orcamento_enviado_por` (uuid) - Who sent the orçamento
    - `orcamento_modificado_apos_envio` (boolean) - If changes were made after sending
    - `ultima_modificacao_em` (timestamptz) - When last modification occurred
    - `ultima_modificacao_por` (uuid) - Who made the last modification
    
  2. Purpose
    - Track when orçamento is sent to client
    - Detect if changes are made after sending
    - Automatically reactivate "Enviar Orçamento" button when modifications occur
    - Provide audit trail of sends and modifications
    
  3. Security
    - Only authenticated users can update these fields
    - RLS policies inherited from existing cotacoes policies
*/

-- Add tracking columns to cotacoes table
DO $$
BEGIN
  -- orcamento_enviado: tracks if orçamento was sent
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cotacoes' AND column_name = 'orcamento_enviado'
  ) THEN
    ALTER TABLE cotacoes ADD COLUMN orcamento_enviado boolean DEFAULT false;
  END IF;

  -- orcamento_enviado_em: when orçamento was last sent
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cotacoes' AND column_name = 'orcamento_enviado_em'
  ) THEN
    ALTER TABLE cotacoes ADD COLUMN orcamento_enviado_em timestamptz;
  END IF;

  -- orcamento_enviado_por: who sent the orçamento
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cotacoes' AND column_name = 'orcamento_enviado_por'
  ) THEN
    ALTER TABLE cotacoes ADD COLUMN orcamento_enviado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL;
  END IF;

  -- orcamento_modificado_apos_envio: if changes were made after sending
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cotacoes' AND column_name = 'orcamento_modificado_apos_envio'
  ) THEN
    ALTER TABLE cotacoes ADD COLUMN orcamento_modificado_apos_envio boolean DEFAULT false;
  END IF;

  -- ultima_modificacao_em: when last modification occurred
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cotacoes' AND column_name = 'ultima_modificacao_em'
  ) THEN
    ALTER TABLE cotacoes ADD COLUMN ultima_modificacao_em timestamptz;
  END IF;

  -- ultima_modificacao_por: who made the last modification
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'cotacoes' AND column_name = 'ultima_modificacao_por'
  ) THEN
    ALTER TABLE cotacoes ADD COLUMN ultima_modificacao_por uuid REFERENCES usuarios(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create function to mark cotação as modified after changes to peças
CREATE OR REPLACE FUNCTION mark_cotacao_modified_on_pecas_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only mark as modified if cotação has been sent
  UPDATE cotacoes
  SET 
    orcamento_modificado_apos_envio = true,
    ultima_modificacao_em = now(),
    ultima_modificacao_por = (SELECT id FROM usuarios WHERE email = auth.jwt()->>'email' LIMIT 1)
  WHERE 
    id = COALESCE(NEW.cotacao_id, OLD.cotacao_id)
    AND orcamento_enviado = true;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to mark cotação as modified after changes to servicos
CREATE OR REPLACE FUNCTION mark_cotacao_modified_on_servicos_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only mark as modified if cotação has been sent
  UPDATE cotacoes
  SET 
    orcamento_modificado_apos_envio = true,
    ultima_modificacao_em = now(),
    ultima_modificacao_por = (SELECT id FROM usuarios WHERE email = auth.jwt()->>'email' LIMIT 1)
  WHERE 
    id = COALESCE(NEW.cotacao_id, OLD.cotacao_id)
    AND orcamento_enviado = true;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to mark cotação as modified after changes to desconto or payment
CREATE OR REPLACE FUNCTION mark_cotacao_modified_on_cotacao_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Check if relevant fields changed and cotação has been sent
  IF OLD.orcamento_enviado = true AND (
    OLD.desconto_percentual IS DISTINCT FROM NEW.desconto_percentual OR
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

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS cotacoes_pecas_modification_trigger ON cotacoes_pecas;
DROP TRIGGER IF EXISTS cotacoes_servicos_modification_trigger ON cotacoes_servicos;
DROP TRIGGER IF EXISTS cotacoes_modification_trigger ON cotacoes;

-- Create triggers for peças changes
CREATE TRIGGER cotacoes_pecas_modification_trigger
AFTER INSERT OR UPDATE OR DELETE ON cotacoes_pecas
FOR EACH ROW
EXECUTE FUNCTION mark_cotacao_modified_on_pecas_change();

-- Create triggers for servicos changes
CREATE TRIGGER cotacoes_servicos_modification_trigger
AFTER INSERT OR UPDATE OR DELETE ON cotacoes_servicos
FOR EACH ROW
EXECUTE FUNCTION mark_cotacao_modified_on_servicos_change();

-- Create trigger for cotação changes
CREATE TRIGGER cotacoes_modification_trigger
BEFORE UPDATE ON cotacoes
FOR EACH ROW
EXECUTE FUNCTION mark_cotacao_modified_on_cotacao_change();