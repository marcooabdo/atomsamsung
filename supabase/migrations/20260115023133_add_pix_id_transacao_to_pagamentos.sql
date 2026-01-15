/*
  # Adicionar ID de Transacao PIX

  ## Mudancas
  1. Adicionar campo `pix_id_transacao` na tabela `pagamentos`
  2. Campo para armazenar o ID da transacao PIX ou NSU

  ## Notas
  - Campo opcional para pagamentos PIX
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'pagamentos' AND column_name = 'pix_id_transacao'
  ) THEN
    ALTER TABLE pagamentos ADD COLUMN pix_id_transacao text DEFAULT NULL;
  END IF;
END $$;
