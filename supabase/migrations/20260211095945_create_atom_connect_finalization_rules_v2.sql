/*
  # Create AtomConnect Finalization Rules System

  This migration creates a dynamic system for configuring finalization messages
  and customer rating responses for WhatsApp conversations.

  1. New Tables
    - `atom_connect_regras_finalizacao` - Stores finalization rules templates
      - `id` (uuid, primary key)
      - `unidade_id` (uuid, references unidades)
      - `nome` (text) - Rule name for identification
      - `mensagem_avaliacao` (text) - Message sent to customer asking for rating
      - `tipo_interacao` (text) - 'opcoes_numeradas' or 'botoes'
      - `opcoes` (jsonb) - Array of options with value, label, response, and action
      - `ativo` (boolean) - Whether this rule is active
      - `created_at`, `updated_at` (timestamps)

  2. Example Options Structure
    {
      "opcoes": [
        {
          "valor": "1",
          "label": "Muito Satisfeito",
          "resposta": "Obrigado pela avaliacao! Ficamos felizes...",
          "acao": "finalizar",
          "nps_score": 5
        }
      ]
    }

  3. New Columns in conversas
    - `aguardando_avaliacao` (boolean) - Indicates conversation is waiting for customer rating
    - `regra_finalizacao_id` (uuid) - Which rule is being applied
    - `nps_score` (integer) - Customer rating score
    - `nps_comentario` (text) - Any additional customer comment

  4. Security
    - Enable RLS with policies for authenticated users by unit
*/

-- Create the rules table
CREATE TABLE IF NOT EXISTS atom_connect_regras_finalizacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid REFERENCES unidades(id) ON DELETE CASCADE,
  nome text NOT NULL,
  mensagem_avaliacao text NOT NULL,
  tipo_interacao text NOT NULL DEFAULT 'opcoes_numeradas' CHECK (tipo_interacao IN ('opcoes_numeradas', 'botoes')),
  opcoes jsonb NOT NULL DEFAULT '[]'::jsonb,
  timeout_minutos integer DEFAULT 60,
  mensagem_timeout text DEFAULT 'O tempo para avaliar expirou. Obrigado pelo contato!',
  acao_timeout text DEFAULT 'finalizar',
  ativo boolean NOT NULL DEFAULT true,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Add columns to conversas table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atom_connect_conversas' AND column_name = 'aguardando_avaliacao'
  ) THEN
    ALTER TABLE atom_connect_conversas ADD COLUMN aguardando_avaliacao boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atom_connect_conversas' AND column_name = 'regra_finalizacao_id'
  ) THEN
    ALTER TABLE atom_connect_conversas ADD COLUMN regra_finalizacao_id uuid REFERENCES atom_connect_regras_finalizacao(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atom_connect_conversas' AND column_name = 'avaliacao_enviada_at'
  ) THEN
    ALTER TABLE atom_connect_conversas ADD COLUMN avaliacao_enviada_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atom_connect_conversas' AND column_name = 'nps_score'
  ) THEN
    ALTER TABLE atom_connect_conversas ADD COLUMN nps_score integer;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'atom_connect_conversas' AND column_name = 'nps_comentario'
  ) THEN
    ALTER TABLE atom_connect_conversas ADD COLUMN nps_comentario text;
  END IF;
END $$;

-- Enable RLS
ALTER TABLE atom_connect_regras_finalizacao ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view finalization rules for their unit"
  ON atom_connect_regras_finalizacao
  FOR SELECT
  TO authenticated
  USING (
    unidade_id IN (
      SELECT u.unidade_id FROM usuarios u WHERE u.id = auth.uid()
      UNION
      SELECT id FROM unidades WHERE EXISTS (
        SELECT 1 FROM usuarios u2 WHERE u2.id = auth.uid() AND (u2.unidade_id IS NULL OR u2.tipo = 'master')
      )
    )
  );

CREATE POLICY "Users can insert finalization rules for their unit"
  ON atom_connect_regras_finalizacao
  FOR INSERT
  TO authenticated
  WITH CHECK (
    unidade_id IN (
      SELECT u.unidade_id FROM usuarios u WHERE u.id = auth.uid()
      UNION
      SELECT id FROM unidades WHERE EXISTS (
        SELECT 1 FROM usuarios u2 WHERE u2.id = auth.uid() AND (u2.unidade_id IS NULL OR u2.tipo = 'master')
      )
    )
  );

CREATE POLICY "Users can update finalization rules for their unit"
  ON atom_connect_regras_finalizacao
  FOR UPDATE
  TO authenticated
  USING (
    unidade_id IN (
      SELECT u.unidade_id FROM usuarios u WHERE u.id = auth.uid()
      UNION
      SELECT id FROM unidades WHERE EXISTS (
        SELECT 1 FROM usuarios u2 WHERE u2.id = auth.uid() AND (u2.unidade_id IS NULL OR u2.tipo = 'master')
      )
    )
  )
  WITH CHECK (
    unidade_id IN (
      SELECT u.unidade_id FROM usuarios u WHERE u.id = auth.uid()
      UNION
      SELECT id FROM unidades WHERE EXISTS (
        SELECT 1 FROM usuarios u2 WHERE u2.id = auth.uid() AND (u2.unidade_id IS NULL OR u2.tipo = 'master')
      )
    )
  );

CREATE POLICY "Users can delete finalization rules for their unit"
  ON atom_connect_regras_finalizacao
  FOR DELETE
  TO authenticated
  USING (
    unidade_id IN (
      SELECT u.unidade_id FROM usuarios u WHERE u.id = auth.uid()
      UNION
      SELECT id FROM unidades WHERE EXISTS (
        SELECT 1 FROM usuarios u2 WHERE u2.id = auth.uid() AND (u2.unidade_id IS NULL OR u2.tipo = 'master')
      )
    )
  );

-- Insert default rules for existing units
INSERT INTO atom_connect_regras_finalizacao (unidade_id, nome, mensagem_avaliacao, tipo_interacao, opcoes, is_default)
SELECT 
  id,
  'Avaliacao Padrao',
  'Obrigado por entrar em contato! Por favor, avalie nosso atendimento:

1 - Muito Satisfeito
2 - Satisfeito  
3 - Insatisfeito

Digite o numero correspondente a sua avaliacao.',
  'opcoes_numeradas',
  '[
    {
      "valor": "1",
      "label": "Muito Satisfeito",
      "resposta": "Muito obrigado pela excelente avaliacao! Ficamos muito felizes em poder ajudar. Conte sempre conosco!",
      "acao": "finalizar",
      "nps_score": 5
    },
    {
      "valor": "2",
      "label": "Satisfeito",
      "resposta": "Agradecemos seu feedback! Ficamos felizes em saber que conseguimos ajudar. Estamos sempre buscando melhorar.",
      "acao": "finalizar",
      "nps_score": 3
    },
    {
      "valor": "3",
      "label": "Insatisfeito",
      "resposta": "Obrigado pelo seu feedback. Lamentamos que sua experiencia nao tenha sido satisfatoria. Vamos trabalhar para melhorar!",
      "acao": "finalizar",
      "nps_score": 1
    }
  ]'::jsonb,
  true
FROM unidades
ON CONFLICT DO NOTHING;

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_atom_connect_regras_finalizacao_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_atom_connect_regras_finalizacao_updated_at ON atom_connect_regras_finalizacao;
CREATE TRIGGER trigger_update_atom_connect_regras_finalizacao_updated_at
  BEFORE UPDATE ON atom_connect_regras_finalizacao
  FOR EACH ROW
  EXECUTE FUNCTION update_atom_connect_regras_finalizacao_updated_at();
