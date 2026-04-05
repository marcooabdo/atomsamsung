/*
  # ATOM AUDIT - Add audit fields to OS and OS Pecas

  1. Modified Tables
    - `os`
      - `auditado_km_valor` (numeric) - Manual KM revenue value set during audit
      - `auditado_mao_obra_valor` (numeric) - Factory labor payment value
      - `auditado_imposto_valor` (numeric) - Tax payment value
      - `auditado_status` (boolean, default false) - Whether the OS audit is complete
    - `os_pecas`
      - `auditado_samsung_status` (varchar) - 'Y' (Paid/Accepted) or 'X' (Glossed/Rejected) or NULL
      - `auditado_motivo_glosa` (text) - Justification when status is 'X'
      - `is_cortesia_samsung` (boolean, default false) - Whether the part was Samsung courtesy

  2. Important Notes
    - These fields enable per-OS manual auditing of factory payments
    - The auditado_samsung_status on os_pecas tracks individual part payment acceptance
    - is_cortesia_samsung marks parts covered by Samsung in OW orders (cost becomes 0 in profit calc)
    - All fields are nullable/defaulted so existing rows are unaffected
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'auditado_km_valor'
  ) THEN
    ALTER TABLE os ADD COLUMN auditado_km_valor numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'auditado_mao_obra_valor'
  ) THEN
    ALTER TABLE os ADD COLUMN auditado_mao_obra_valor numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'auditado_imposto_valor'
  ) THEN
    ALTER TABLE os ADD COLUMN auditado_imposto_valor numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'auditado_status'
  ) THEN
    ALTER TABLE os ADD COLUMN auditado_status boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os_pecas' AND column_name = 'auditado_samsung_status'
  ) THEN
    ALTER TABLE os_pecas ADD COLUMN auditado_samsung_status varchar(1);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os_pecas' AND column_name = 'auditado_motivo_glosa'
  ) THEN
    ALTER TABLE os_pecas ADD COLUMN auditado_motivo_glosa text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os_pecas' AND column_name = 'is_cortesia_samsung'
  ) THEN
    ALTER TABLE os_pecas ADD COLUMN is_cortesia_samsung boolean DEFAULT false;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_os_auditado_status ON os(auditado_status);
CREATE INDEX IF NOT EXISTS idx_os_pecas_auditado_status ON os_pecas(auditado_samsung_status);
