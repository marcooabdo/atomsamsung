/*
  # Fix trigger calcular_valores_os_pecas para respeitar edição manual de valor

  ## Problema
  - O trigger BEFORE UPDATE recalcula sempre valor_unitario a partir de valor_gspn
  - Peças com status 'manual' não têm valor_gspn, então valor_gspn = NULL/0
  - Isso faz o trigger zerar valor_unitario e valor_total ao tentar salvar qualquer edição
  - Resultado: erro ao atualizar valor da peça manualmente

  ## Solução
  - Se valor_gspn é NULL ou 0 E valor_unitario foi explicitamente passado no UPDATE, usa o valor_unitario enviado
  - Para peças manual/sem GSPN: apenas recalcula valor_total = valor_unitario * quantidade
  - Para peças OW com valor_gspn: mantém o comportamento atual com markup

  ## Regra
  - Só aplica cálculo de markup quando valor_gspn > 0
  - Quando valor_gspn é nulo/zero, respeita o valor_unitario que chegou no NEW
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

  -- Só aplica lógica de markup/GSPN se houver valor_gspn definido
  IF v_valor_base > 0 THEN
    IF v_tipo_os = 'OW' THEN
      SELECT valor INTO v_markup_percentual
      FROM markup_regras
      WHERE ativo = true
        AND tipo = 'percentual'
        AND (valor_minimo IS NULL OR v_valor_base >= valor_minimo)
        AND (valor_maximo IS NULL OR v_valor_base < valor_maximo)
      ORDER BY valor_minimo DESC NULLS LAST
      LIMIT 1;

      IF v_markup_percentual IS NOT NULL AND v_markup_percentual > 0 THEN
        NEW.valor_unitario := ROUND(v_valor_base * (1 + v_markup_percentual / 100), 2);
      ELSE
        NEW.valor_unitario := v_valor_base;
      END IF;
    ELSE
      -- LP, NORMAL, samsung_contigo, acessorios: sem markup
      NEW.valor_unitario := v_valor_base;
    END IF;
  END IF;
  -- Se valor_gspn é nulo/zero: NÃO sobrescreve valor_unitario (respeita edição manual)

  -- Sempre recalcula valor_total com o valor_unitario final
  NEW.valor_total := ROUND(COALESCE(NEW.valor_unitario, 0) * COALESCE(NEW.quantidade, 1), 2);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
