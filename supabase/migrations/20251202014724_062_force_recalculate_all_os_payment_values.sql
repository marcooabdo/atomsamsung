/*
  # Force Recalculate All OS Payment Values

  1. Problem
    - Previous migration only updated OS with valor_total = 0
    - Some OS have incorrect valores (e.g., R$ 50 instead of R$ 292.65)
    - Need to recalculate ALL OS regardless of current value

  2. Solution
    - Force update ALL OS that have an approved cotacao
    - Calculate correct valor_total from cotacao (pecas + servicos - desconto)
    - Recalculate valor_pago from payments
    - Recalculate saldo_restante
    - Update status_pagamento

  3. Changes
    - Remove the WHERE valor_total = 0 condition
    - Update ALL OS with cotacao_id
*/

-- Force update valor_total for ALL OS from their approved cotacao
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
              (
                SELECT COALESCE(SUM(cp.valor_total), 0) FROM cotacoes_pecas cp WHERE cp.cotacao_id = os.cotacao_id
              ) +
              (
                SELECT COALESCE(SUM(cs.valor_total), 0) FROM cotacoes_servicos cs WHERE cs.cotacao_id = os.cotacao_id
              )
            ) * (c.desconto_valor / 100)
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
WHERE os.cotacao_id IS NOT NULL;

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
