/*
  # Fix markup boundary condition - use <= for valor_maximo

  ## Problem
  The trigger function `calcular_valores_os_pecas` used a strict less-than (<)
  comparison for `valor_maximo`, causing values exactly at the boundary (e.g., R$100.00
  when the rule is "0 to 100") to fall through with no markup applied.

  ## Fix
  Change `v_valor_base < valor_maximo` to `v_valor_base <= valor_maximo` so that
  boundary values are correctly included in their rule range.
*/

CREATE OR REPLACE FUNCTION calcular_valores_os_pecas()
RETURNS TRIGGER AS $$
DECLARE
  v_tipo_os text;
  v_valor_base numeric;
  v_markup_percentual numeric;
BEGIN
  SELECT tipo_os INTO v_tipo_os
  FROM os
  WHERE id = NEW.os_id;

  v_tipo_os := COALESCE(v_tipo_os, 'NORMAL');
  v_valor_base := COALESCE(NEW.valor_gspn, 0);

  IF NEW.editado_manualmente = true THEN
    NEW.valor_total := ROUND(COALESCE(NEW.valor_unitario, 0) * COALESCE(NEW.quantidade, 1), 2);
    RETURN NEW;
  END IF;

  IF v_valor_base > 0 THEN
    IF v_tipo_os = 'OW' THEN
      SELECT valor INTO v_markup_percentual
      FROM markup_regras
      WHERE ativo = true
        AND tipo = 'percentual'
        AND (valor_minimo IS NULL OR v_valor_base >= valor_minimo)
        AND (valor_maximo IS NULL OR v_valor_base <= valor_maximo)
      ORDER BY valor_minimo DESC NULLS LAST
      LIMIT 1;

      IF v_markup_percentual IS NOT NULL AND v_markup_percentual > 0 THEN
        NEW.valor_unitario := ROUND(v_valor_base * (1 + v_markup_percentual / 100), 2);
      ELSE
        NEW.valor_unitario := v_valor_base;
      END IF;
    ELSE
      NEW.valor_unitario := v_valor_base;
    END IF;
  END IF;

  NEW.valor_total := ROUND(COALESCE(NEW.valor_unitario, 0) * COALESCE(NEW.quantidade, 1), 2);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
