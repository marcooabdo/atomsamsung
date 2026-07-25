/*
# Add resultado_visita to agendamentos

1. Modified Tables
  - `agendamentos`
    - `resultado_visita` (text, nullable) - The outcome of each individual visit
      Values: 'reparo_sucesso', 'peca_defeito', 'improdutiva_revisita', 'voltar_peca', etc.
      Each visit stores its own result independently from the OS status.

2. Important Notes
  - Previously the visit result was only reflected in the OS kanban column,
    meaning all visits appeared to have the same result as the last checkout.
  - Now each visit stores its own independent resultado.
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'agendamentos' AND column_name = 'resultado_visita') THEN
    ALTER TABLE agendamentos ADD COLUMN resultado_visita text;
  END IF;
END $$;