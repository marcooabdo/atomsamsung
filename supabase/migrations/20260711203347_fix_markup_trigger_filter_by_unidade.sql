-- Fix the calcular_valores_os_pecas trigger to filter markup by unidade_id
CREATE OR REPLACE FUNCTION calcular_valores_os_pecas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo_os text;
  v_unidade_id uuid;
  v_valor_base numeric;
  v_markup_percentual numeric;
BEGIN
  SELECT tipo_os, unidade_id INTO v_tipo_os, v_unidade_id
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
        AND unidade_id = v_unidade_id
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
$$;