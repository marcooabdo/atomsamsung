/*
  # Adicionar campos de desconto na tabela OS

  1. Novos Campos
    - `desconto_tipo` - Tipo de desconto: 'valor' ou 'percentual'
    - `desconto_valor` - Valor do desconto (em R$ ou %)
    - `valor_desconto_calculado` - Valor do desconto em R$ (calculado)

  2. Funcionalidade
    - Permite aplicar desconto fixo em R$ ou percentual
    - O valor_total da OS considera o desconto aplicado
    - Trigger atualizado para recalcular valores com desconto
*/

-- Adicionar campos de desconto
ALTER TABLE os 
ADD COLUMN IF NOT EXISTS desconto_tipo text CHECK (desconto_tipo IN ('valor', 'percentual')),
ADD COLUMN IF NOT EXISTS desconto_valor numeric(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS valor_desconto_calculado numeric(10,2) DEFAULT 0;

-- Atualizar função que calcula valores da OS para considerar desconto
CREATE OR REPLACE FUNCTION atualizar_valores_os()
RETURNS TRIGGER AS $$
DECLARE
  v_os_id uuid;
  v_total_pecas numeric := 0;
  v_total_servicos numeric := 0;
  v_valor_bruto numeric := 0;
  v_desconto_tipo text;
  v_desconto_valor numeric := 0;
  v_valor_desconto numeric := 0;
  v_valor_total numeric := 0;
  v_valor_pago numeric := 0;
  v_saldo numeric := 0;
  v_status text := 'pendente';
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_os_id := OLD.os_id;
  ELSE
    v_os_id := NEW.os_id;
  END IF;

  IF v_os_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT COALESCE(SUM(valor_total), 0) INTO v_total_pecas
  FROM cotacoes_pecas WHERE os_id = v_os_id;

  SELECT COALESCE(SUM(valor_total), 0) INTO v_total_servicos
  FROM cotacoes_servicos WHERE os_id = v_os_id;

  v_valor_bruto := v_total_pecas + v_total_servicos;

  SELECT desconto_tipo, COALESCE(desconto_valor, 0)
  INTO v_desconto_tipo, v_desconto_valor
  FROM os WHERE id = v_os_id;

  IF v_desconto_tipo = 'percentual' AND v_desconto_valor > 0 THEN
    v_valor_desconto := ROUND(v_valor_bruto * (v_desconto_valor / 100), 2);
  ELSIF v_desconto_tipo = 'valor' AND v_desconto_valor > 0 THEN
    v_valor_desconto := v_desconto_valor;
  ELSE
    v_valor_desconto := 0;
  END IF;

  v_valor_total := GREATEST(v_valor_bruto - v_valor_desconto, 0);

  SELECT COALESCE(SUM(valor_liquido), 0) INTO v_valor_pago
  FROM pagamentos WHERE os_id = v_os_id;

  v_saldo := v_valor_total - v_valor_pago;

  IF v_valor_total <= 0 THEN
    v_status := 'pendente';
  ELSIF v_valor_pago >= v_valor_total THEN
    v_status := 'pago';
  ELSIF v_valor_pago > 0 THEN
    v_status := 'parcial';
  ELSE
    v_status := 'pendente';
  END IF;

  UPDATE os SET
    valor_pecas = v_total_pecas,
    valor_servicos = v_total_servicos,
    valor_desconto_calculado = v_valor_desconto,
    valor_total = v_valor_total,
    valor_pago = v_valor_pago,
    saldo_restante = v_saldo,
    status_pagamento = v_status::status_pagamento,
    updated_at = NOW()
  WHERE id = v_os_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar função para recalcular valores quando desconto é alterado
CREATE OR REPLACE FUNCTION recalcular_valores_os_desconto()
RETURNS TRIGGER AS $$
DECLARE
  v_total_pecas numeric := 0;
  v_total_servicos numeric := 0;
  v_valor_bruto numeric := 0;
  v_valor_desconto numeric := 0;
  v_valor_total numeric := 0;
  v_valor_pago numeric := 0;
  v_saldo numeric := 0;
  v_status text := 'pendente';
BEGIN
  IF NEW.desconto_tipo IS DISTINCT FROM OLD.desconto_tipo 
     OR NEW.desconto_valor IS DISTINCT FROM OLD.desconto_valor THEN

    SELECT COALESCE(SUM(valor_total), 0) INTO v_total_pecas
    FROM cotacoes_pecas WHERE os_id = NEW.id;

    SELECT COALESCE(SUM(valor_total), 0) INTO v_total_servicos
    FROM cotacoes_servicos WHERE os_id = NEW.id;

    v_valor_bruto := v_total_pecas + v_total_servicos;

    IF NEW.desconto_tipo = 'percentual' AND COALESCE(NEW.desconto_valor, 0) > 0 THEN
      v_valor_desconto := ROUND(v_valor_bruto * (NEW.desconto_valor / 100), 2);
    ELSIF NEW.desconto_tipo = 'valor' AND COALESCE(NEW.desconto_valor, 0) > 0 THEN
      v_valor_desconto := NEW.desconto_valor;
    ELSE
      v_valor_desconto := 0;
    END IF;

    v_valor_total := GREATEST(v_valor_bruto - v_valor_desconto, 0);

    SELECT COALESCE(SUM(valor_liquido), 0) INTO v_valor_pago
    FROM pagamentos WHERE os_id = NEW.id;

    v_saldo := v_valor_total - v_valor_pago;

    IF v_valor_total <= 0 THEN
      v_status := 'pendente';
    ELSIF v_valor_pago >= v_valor_total THEN
      v_status := 'pago';
    ELSIF v_valor_pago > 0 THEN
      v_status := 'parcial';
    ELSE
      v_status := 'pendente';
    END IF;

    NEW.valor_pecas := v_total_pecas;
    NEW.valor_servicos := v_total_servicos;
    NEW.valor_desconto_calculado := v_valor_desconto;
    NEW.valor_total := v_valor_total;
    NEW.valor_pago := v_valor_pago;
    NEW.saldo_restante := v_saldo;
    NEW.status_pagamento := v_status::status_pagamento;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar trigger para recalcular quando desconto muda
DROP TRIGGER IF EXISTS trigger_recalcular_desconto_os ON os;
CREATE TRIGGER trigger_recalcular_desconto_os
  BEFORE UPDATE ON os
  FOR EACH ROW
  EXECUTE FUNCTION recalcular_valores_os_desconto();
