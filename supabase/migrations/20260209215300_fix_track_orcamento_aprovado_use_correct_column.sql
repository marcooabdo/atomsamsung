/*
  # Fix track_orcamento_aprovado function
  
  1. Problem
    - Function references NEW.valor_bruto which doesn't exist in os table
    
  2. Solution
    - Use valor_total instead (which is the final value after discount)
    - Or calculate bruto as valor_pecas + valor_servicos
*/

CREATE OR REPLACE FUNCTION track_orcamento_aprovado()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.orcamento_aprovado_por IS NOT NULL 
     AND (OLD.orcamento_aprovado_por IS NULL OR OLD.orcamento_aprovado_por IS DISTINCT FROM NEW.orcamento_aprovado_por)
  THEN
    INSERT INTO skywalker_orcamentos_aprovados (usuario_id, os_id, unidade_id, mes_referencia, valor_orcamento)
    VALUES (
      NEW.orcamento_aprovado_por,
      NEW.id,
      NEW.unidade_id,
      date_trunc('month', COALESCE(NEW.orcamento_aprovado_em, now()))::date,
      COALESCE(NEW.valor_total, 0)
    )
    ON CONFLICT (os_id) WHERE os_id IS NOT NULL
    DO UPDATE SET
      usuario_id = EXCLUDED.usuario_id,
      unidade_id = EXCLUDED.unidade_id,
      mes_referencia = EXCLUDED.mes_referencia,
      valor_orcamento = EXCLUDED.valor_orcamento;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
