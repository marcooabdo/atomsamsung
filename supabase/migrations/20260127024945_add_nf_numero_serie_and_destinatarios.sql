/*
  # Adicionar numero inicial, serie e tabela de destinatarios salvos

  1. Changes to nf_configuracoes
    - `numero_inicial` (integer) - numero inicial da NF
    - `serie` (text) - serie da NF
    - `ultimo_numero` (integer) - ultimo numero emitido (controle)

  2. New Table: nf_destinatarios
    - Armazena destinatarios frequentes para reuso
    - Vinculado a unidade
    - Campos: nome, documento, endereco, etc

  3. Security
    - Enable RLS on nf_destinatarios
*/

-- Adicionar campos na tabela nf_configuracoes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nf_configuracoes' AND column_name = 'numero_inicial'
  ) THEN
    ALTER TABLE nf_configuracoes ADD COLUMN numero_inicial integer DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nf_configuracoes' AND column_name = 'serie'
  ) THEN
    ALTER TABLE nf_configuracoes ADD COLUMN serie text DEFAULT '1';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'nf_configuracoes' AND column_name = 'ultimo_numero'
  ) THEN
    ALTER TABLE nf_configuracoes ADD COLUMN ultimo_numero integer DEFAULT 0;
  END IF;
END $$;

-- Tabela de destinatarios salvos
CREATE TABLE IF NOT EXISTS nf_destinatarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  nome text NOT NULL,
  documento text NOT NULL,
  tipo_documento text DEFAULT 'cpf' CHECK (tipo_documento IN ('cpf', 'cnpj')),
  inscricao_estadual text,
  email text,
  telefone text,
  cep text,
  logradouro text,
  numero text,
  complemento text,
  bairro text,
  cidade text,
  estado text,
  codigo_municipio text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indices
CREATE INDEX IF NOT EXISTS idx_nf_destinatarios_unidade ON nf_destinatarios(unidade_id);
CREATE INDEX IF NOT EXISTS idx_nf_destinatarios_documento ON nf_destinatarios(documento);

-- RLS
ALTER TABLE nf_destinatarios ENABLE ROW LEVEL SECURITY;

-- Policies para nf_destinatarios
CREATE POLICY "Users can view destinatarios of their unit"
  ON nf_destinatarios
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND (
          usuarios.tipo IN ('master', 'diretoria')
          OR usuarios.unidade_id = nf_destinatarios.unidade_id
        )
    )
  );

CREATE POLICY "Users can insert destinatarios"
  ON nf_destinatarios
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.tipo IN ('master', 'diretoria', 'gerente', 'administrador', 'estoque')
    )
  );

CREATE POLICY "Users can update destinatarios"
  ON nf_destinatarios
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.tipo IN ('master', 'diretoria', 'gerente', 'administrador', 'estoque')
    )
  );

CREATE POLICY "Users can delete destinatarios"
  ON nf_destinatarios
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
        AND usuarios.tipo IN ('master', 'diretoria', 'gerente', 'administrador')
    )
  );
