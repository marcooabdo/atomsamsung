/*
# Fix calcular_valores_os_pecas to support all markup types

## Problem
The trigger only looked for markup rules with tipo='percentual', but the actual
configured rules use tipo='multiplicador' and 'valor_fixo'. This caused the
markup to never be applied when editing the GSPN value of parts.

## Changes
- Modified the function to find ANY active markup rule matching the value range
  and unit, regardless of tipo (percentual, multiplicador, valor_fixo).
- Added proper handling for all three markup types.
- Added preco_minimo_venda enforcement.
- The trigger still skips markup when editado_manualmente=true or tipo_os != 'OW'.

## Important
- This only affects os_pecas with tipo_os = 'OW' (Out of Warranty).
- LP and other types continue to use valor_gspn directly as valor_unitario.
*/

CREATE OR REPLACE FUNCTION calcular_valores_os_pecas()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_tipo_os text;
  v_unidade_id uuid;
  v_valor_base numeric;
  v_markup_record RECORD;
  v_valor_final numeric;
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
      SELECT tipo, valor, preco_minimo_venda
      INTO v_markup_record
      FROM markup_regras
      WHERE ativo = true
        AND unidade_id = v_unidade_id
        AND (valor_minimo IS NULL OR v_valor_base >= valor_minimo)
        AND (valor_maximo IS NULL OR v_valor_base <= valor_maximo)
      ORDER BY valor_minimo DESC NULLS LAST
      LIMIT 1;

      IF v_markup_record IS NOT NULL AND v_markup_record.valor IS NOT NULL THEN
        CASE v_markup_record.tipo
          WHEN 'percentual' THEN
            v_valor_final := ROUND(v_valor_base * (1 + v_markup_record.valor / 100), 2);
          WHEN 'multiplicador' THEN
            v_valor_final := ROUND(v_valor_base * v_markup_record.valor, 2);
          WHEN 'valor_fixo' THEN
            v_valor_final := ROUND(v_valor_base + v_markup_record.valor, 2);
          ELSE
            v_valor_final := v_valor_base;
        END CASE;

        -- Enforce preco_minimo_venda if configured
        IF v_markup_record.preco_minimo_venda IS NOT NULL
           AND v_valor_final < v_markup_record.preco_minimo_venda THEN
          v_valor_final := v_markup_record.preco_minimo_venda;
        END IF;

        NEW.valor_unitario := v_valor_final;
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