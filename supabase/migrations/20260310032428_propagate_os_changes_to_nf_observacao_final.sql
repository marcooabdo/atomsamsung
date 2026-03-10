/*
  # Propagate OS changes to nf_emitidas.observacao_final

  1. New Functions
    - `propagate_os_to_nf_observacao_final()` - Trigger function on `os` table
      that detects changes in key fields (cliente_nome, cliente_cpf_cnpj, 
      aparelho_modelo, aparelho_marca, aparelho_numero_serie, aparelho_imei,
      aparelho_linha, defeito_relatado, tipo_os, tipo_atendimento, tipo_orcamento,
      numero_os_interna, numero_os_samsung) and triggers a re-build of
      observacao_final on all linked nf_emitidas rows.

  2. Triggers
    - `trigger_propagate_os_to_nf_observacao_final` - AFTER UPDATE on os table,
      fires only when relevant fields change.

  3. Important Notes
    - Uses a dummy UPDATE (SET observacoes = observacoes) to trigger the existing
      build_observacao_final() trigger on nf_emitidas, which recalculates the final text.
    - Only fires when at least one of the watched fields actually changed.
*/

CREATE OR REPLACE FUNCTION propagate_os_to_nf_observacao_final()
RETURNS TRIGGER AS $$
BEGIN
  IF (
    OLD.numero_os_interna IS DISTINCT FROM NEW.numero_os_interna OR
    OLD.numero_os_samsung IS DISTINCT FROM NEW.numero_os_samsung OR
    OLD.cliente_nome IS DISTINCT FROM NEW.cliente_nome OR
    OLD.cliente_cpf_cnpj IS DISTINCT FROM NEW.cliente_cpf_cnpj OR
    OLD.aparelho_modelo IS DISTINCT FROM NEW.aparelho_modelo OR
    OLD.aparelho_marca IS DISTINCT FROM NEW.aparelho_marca OR
    OLD.aparelho_numero_serie IS DISTINCT FROM NEW.aparelho_numero_serie OR
    OLD.aparelho_imei IS DISTINCT FROM NEW.aparelho_imei OR
    OLD.aparelho_linha IS DISTINCT FROM NEW.aparelho_linha OR
    OLD.defeito_relatado IS DISTINCT FROM NEW.defeito_relatado OR
    OLD.tipo_os IS DISTINCT FROM NEW.tipo_os OR
    OLD.tipo_atendimento IS DISTINCT FROM NEW.tipo_atendimento OR
    OLD.tipo_orcamento IS DISTINCT FROM NEW.tipo_orcamento
  ) THEN
    UPDATE nf_emitidas
    SET observacoes = observacoes
    WHERE os_id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_propagate_os_to_nf_observacao_final ON os;

CREATE TRIGGER trigger_propagate_os_to_nf_observacao_final
  AFTER UPDATE ON os
  FOR EACH ROW
  EXECUTE FUNCTION propagate_os_to_nf_observacao_final();
