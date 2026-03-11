/*
  # Add operator response tracking for SLA calculation

  1. Modified Tables
    - `atom_connect_conversas`
      - Added `ultima_resposta_operador_at` (timestamptz) - tracks when an operator last responded

  2. Trigger Update
    - `update_conversa_on_new_message` now also updates `ultima_resposta_operador_at` when an operator sends a message (from_me = true)
    - This allows SLA to be correctly calculated: SLA is only breached when the client's last message
      is newer than the operator's last response AND the elapsed time exceeds the SLA threshold

  3. Important Notes
    - SLA should only apply when the client is waiting for a response
    - If the operator already replied after the client's last message, SLA is NOT breached
    - Backfill existing data: set ultima_resposta_operador_at to ultima_mensagem_at for conversations
      that have an assigned operator (to avoid false SLA breach alerts on existing data)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atom_connect_conversas' AND column_name = 'ultima_resposta_operador_at'
  ) THEN
    ALTER TABLE atom_connect_conversas ADD COLUMN ultima_resposta_operador_at timestamptz;
  END IF;
END $$;

CREATE OR REPLACE FUNCTION update_conversa_on_new_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE atom_connect_conversas
  SET
    ultima_mensagem = LEFT(COALESCE(NEW.conteudo, NEW.caption, '[Midia]'), 100),
    ultima_mensagem_at = NEW.created_at,
    ultima_resposta_cliente_at = CASE WHEN NOT NEW.from_me THEN NEW.created_at ELSE ultima_resposta_cliente_at END,
    ultima_resposta_operador_at = CASE WHEN NEW.from_me THEN NEW.created_at ELSE ultima_resposta_operador_at END,
    mensagens_nao_lidas = CASE WHEN NOT NEW.from_me THEN mensagens_nao_lidas + 1 ELSE mensagens_nao_lidas END,
    updated_at = now()
  WHERE id = NEW.conversa_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

UPDATE atom_connect_conversas
SET ultima_resposta_operador_at = ultima_mensagem_at
WHERE atendente_id IS NOT NULL
  AND ultima_resposta_operador_at IS NULL
  AND resultado_conversa IS NULL;
