/*
  # Add observacao_final column and builder function to nf_emitidas

  1. New Columns
    - `nf_emitidas.observacao_final` (text) - Auto-generated observation built from OS data keys

  2. New Functions
    - `build_observacao_final()` - Trigger function that builds a structured observation text
      by pulling data from the linked OS record and combining with the manual observacoes field.
      Keys included: OS Interna, OS Samsung, Cliente, CPF/CNPJ, Marca, Modelo, Linha,
      N/S, IMEI, Defeito, Tipo OS, Atendimento, Orcamento.

  3. Triggers
    - `trigger_build_observacao_final` - Automatically builds observacao_final
      on INSERT and UPDATE of nf_emitidas when os_id is present.

  4. Important Notes
    - The function only populates keys that have actual values (non-null, non-empty)
    - Manual observacoes are appended at the end if present
    - The trigger fires BEFORE INSERT/UPDATE so the value is set before the row is written
    - For NFs without os_id, observacao_final = observacoes (passthrough)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nf_emitidas' AND column_name = 'observacao_final'
  ) THEN
    ALTER TABLE nf_emitidas ADD COLUMN observacao_final text;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION build_observacao_final()
RETURNS TRIGGER AS $$
DECLARE
  v_os RECORD;
  v_parts text[] := '{}';
  v_result text := '';
BEGIN
  IF NEW.os_id IS NULL THEN
    NEW.observacao_final := COALESCE(NEW.observacoes, '');
    RETURN NEW;
  END IF;

  SELECT
    numero_os_interna,
    numero_os_samsung,
    cliente_nome,
    cliente_cpf_cnpj,
    aparelho_modelo,
    aparelho_marca,
    aparelho_numero_serie,
    aparelho_imei,
    aparelho_linha,
    defeito_relatado,
    tipo_os,
    tipo_atendimento,
    tipo_orcamento
  INTO v_os
  FROM os
  WHERE id = NEW.os_id;

  IF NOT FOUND THEN
    NEW.observacao_final := COALESCE(NEW.observacoes, '');
    RETURN NEW;
  END IF;

  IF v_os.numero_os_interna IS NOT NULL AND v_os.numero_os_interna <> '' THEN
    v_parts := array_append(v_parts, 'OS Interna: ' || v_os.numero_os_interna);
  END IF;

  IF v_os.numero_os_samsung IS NOT NULL AND v_os.numero_os_samsung <> '' THEN
    v_parts := array_append(v_parts, 'OS Samsung: ' || v_os.numero_os_samsung);
  END IF;

  IF v_os.cliente_nome IS NOT NULL AND v_os.cliente_nome <> '' THEN
    v_parts := array_append(v_parts, 'Cliente: ' || v_os.cliente_nome);
  END IF;

  IF v_os.cliente_cpf_cnpj IS NOT NULL AND v_os.cliente_cpf_cnpj <> '' THEN
    v_parts := array_append(v_parts, 'CPF/CNPJ: ' || v_os.cliente_cpf_cnpj);
  END IF;

  IF v_os.aparelho_marca IS NOT NULL AND v_os.aparelho_marca <> '' THEN
    v_parts := array_append(v_parts, 'Marca: ' || v_os.aparelho_marca);
  END IF;

  IF v_os.aparelho_modelo IS NOT NULL AND v_os.aparelho_modelo <> '' THEN
    v_parts := array_append(v_parts, 'Modelo: ' || v_os.aparelho_modelo);
  END IF;

  IF v_os.aparelho_linha IS NOT NULL AND v_os.aparelho_linha <> '' THEN
    v_parts := array_append(v_parts, 'Linha: ' || v_os.aparelho_linha);
  END IF;

  IF v_os.aparelho_numero_serie IS NOT NULL AND v_os.aparelho_numero_serie <> '' THEN
    v_parts := array_append(v_parts, 'N/S: ' || v_os.aparelho_numero_serie);
  END IF;

  IF v_os.aparelho_imei IS NOT NULL AND v_os.aparelho_imei <> '' THEN
    v_parts := array_append(v_parts, 'IMEI: ' || v_os.aparelho_imei);
  END IF;

  IF v_os.defeito_relatado IS NOT NULL AND v_os.defeito_relatado <> '' THEN
    v_parts := array_append(v_parts, 'Defeito: ' || v_os.defeito_relatado);
  END IF;

  IF v_os.tipo_os IS NOT NULL AND v_os.tipo_os <> '' THEN
    v_parts := array_append(v_parts, 'Tipo OS: ' || v_os.tipo_os);
  END IF;

  IF v_os.tipo_atendimento IS NOT NULL AND v_os.tipo_atendimento <> '' THEN
    v_parts := array_append(v_parts, 'Atendimento: ' || v_os.tipo_atendimento);
  END IF;

  IF v_os.tipo_orcamento IS NOT NULL AND v_os.tipo_orcamento <> '' THEN
    v_parts := array_append(v_parts, 'Orcamento: ' || v_os.tipo_orcamento);
  END IF;

  v_result := array_to_string(v_parts, ' | ');

  IF NEW.observacoes IS NOT NULL AND NEW.observacoes <> '' THEN
    IF v_result <> '' THEN
      v_result := v_result || ' || Obs: ' || NEW.observacoes;
    ELSE
      v_result := NEW.observacoes;
    END IF;
  END IF;

  NEW.observacao_final := v_result;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_build_observacao_final ON nf_emitidas;

CREATE TRIGGER trigger_build_observacao_final
  BEFORE INSERT OR UPDATE ON nf_emitidas
  FOR EACH ROW
  EXECUTE FUNCTION build_observacao_final();

UPDATE nf_emitidas SET observacao_final = observacao_final WHERE os_id IS NOT NULL;
