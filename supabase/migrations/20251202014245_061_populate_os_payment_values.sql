/*
  # Populate OS Payment Values

  1. Problem
    - Existing OS records have valor_total = 0
    - Need to calculate from approved cotacao
    - Recalculate valor_pago and saldo_restante from existing payments

  2. Solution
    - Update all OS with valor_total from their approved cotacao
    - Calculate valor_pago from existing payments (sum of valor_liquido)
    - Calculate saldo_restante correctly
    - Update status_pagamento based on payment state

  3. Process
    - For each OS, find its approved cotacao
    - Calculate cotacao value (pecas + servicos - desconto)
    - Update OS with correct valor_total
    - Sum all payments valor_liquido for valor_pago
    - Calculate saldo_restante = valor_total - valor_pago
    - Set correct status_pagamento
*/

-- Update valor_total for all OS from their approved cotacao
UPDATE os
SET valor_total = (
  SELECT 
    COALESCE(
      (
        -- Sum pecas
        SELECT COALESCE(SUM(cp.valor_total), 0)
        FROM cotacoes_pecas cp
        WHERE cp.cotacao_id = os.cotacao_id
      ) +
      (
        -- Sum servicos
        SELECT COALESCE(SUM(cs.valor_total), 0)
        FROM cotacoes_servicos cs
        WHERE cs.cotacao_id = os.cotacao_id
      ) -
      (
        -- Calculate desconto
        CASE
          WHEN c.desconto_tipo = 'percentual' THEN
            (
              SELECT COALESCE(SUM(cp.valor_total), 0) FROM cotacoes_pecas cp WHERE cp.cotacao_id = os.cotacao_id
            ) +
            (
              SELECT COALESCE(SUM(cs.valor_total), 0) FROM cotacoes_servicos cs WHERE cs.cotacao_id = os.cotacao_id
            )
            * (c.desconto_valor / 100)
          WHEN c.desconto_tipo = 'valor' THEN c.desconto_valor
          ELSE 0
        END
      ),
      0
    )
  FROM cotacoes c
  WHERE c.id = os.cotacao_id
  AND c.status = 'aprovada'
)
WHERE os.cotacao_id IS NOT NULL
AND os.valor_total = 0;

-- Update valor_pago from sum of payments
UPDATE os
SET valor_pago = (
  SELECT COALESCE(SUM(p.valor_liquido), 0)
  FROM pagamentos p
  WHERE p.os_id = os.id
);

-- Update saldo_restante
UPDATE os
SET saldo_restante = valor_total - valor_pago;

-- Update status_pagamento with proper casting
UPDATE os
SET status_pagamento = (
  CASE
    WHEN saldo_restante <= 0 THEN 'pago'
    WHEN valor_pago > 0 THEN 'parcial'
    ELSE 'pendente'
  END
)::status_pagamento_enum;
