/*
  # Add Conversation Closure Tracking

  1. New Columns on `atom_connect_conversas`
    - `resultado_conversa` (text) - Outcome of the conversation (venda_realizada, orcamento_enviado, orcamento_recusado, agendamento_marcado, apenas_informacao, sem_interesse, retornar_depois, outro)
    - `valor_orcamento` (numeric) - Budget/quote value when applicable
    - `resumo_fechamento` (text) - Free-text summary of what happened
    - `proxima_acao_data` (timestamptz) - Follow-up date
    - `proxima_acao_descricao` (text) - Description of the follow-up action
    - `tags_oportunidade` (text[]) - Opportunity tags (venda_perdida, orcamento_pendente, cliente_quente, recontatar)
    - `finalizado_at` (timestamptz) - When the conversation was finalized
    - `finalizado_por` (uuid) - Who finalized the conversation

  2. Important Notes
    - All new columns are nullable to preserve backward compatibility
    - No destructive operations
    - Existing conversations are unaffected
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atom_connect_conversas' AND column_name = 'resultado_conversa'
  ) THEN
    ALTER TABLE atom_connect_conversas ADD COLUMN resultado_conversa text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atom_connect_conversas' AND column_name = 'valor_orcamento'
  ) THEN
    ALTER TABLE atom_connect_conversas ADD COLUMN valor_orcamento numeric;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atom_connect_conversas' AND column_name = 'resumo_fechamento'
  ) THEN
    ALTER TABLE atom_connect_conversas ADD COLUMN resumo_fechamento text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atom_connect_conversas' AND column_name = 'proxima_acao_data'
  ) THEN
    ALTER TABLE atom_connect_conversas ADD COLUMN proxima_acao_data timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atom_connect_conversas' AND column_name = 'proxima_acao_descricao'
  ) THEN
    ALTER TABLE atom_connect_conversas ADD COLUMN proxima_acao_descricao text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atom_connect_conversas' AND column_name = 'tags_oportunidade'
  ) THEN
    ALTER TABLE atom_connect_conversas ADD COLUMN tags_oportunidade text[] DEFAULT '{}';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atom_connect_conversas' AND column_name = 'finalizado_at'
  ) THEN
    ALTER TABLE atom_connect_conversas ADD COLUMN finalizado_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atom_connect_conversas' AND column_name = 'finalizado_por'
  ) THEN
    ALTER TABLE atom_connect_conversas ADD COLUMN finalizado_por uuid;
  END IF;
END $$;