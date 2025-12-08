/*
  # Update Markup System with Price Ranges

  ## Changes Made
  
  1. Schema Updates
    - Rename and update configuracoes_markup to markup_regras
    - Add better structure for price range based markup
    - Support for: Percentual (%), Valor Fixo (R$), or Multiplicador (×)
  
  2. Table Structure
    - nome: Name/description of the markup rule
    - valor_minimo: Minimum price for this markup (NULL = no minimum, applies from R$ 0)
    - valor_maximo: Maximum price for this markup (NULL = no maximum, applies to infinity)
    - tipo: Type of markup ('percentual', 'multiplicador', 'valor_fixo')
    - valor: The markup value (percentage, multiplier, or fixed amount)
    - ativo: Whether this rule is active
    
  3. Example Rules
    - "R$ 0 a R$ 100" = 50% markup
    - "R$ 100 a R$ 500" = 40% markup  
    - "R$ 500+" = 30% markup
    - "Até R$ 50" = R$ 25 valor fixo
*/

-- Drop old table if exists and create new structure
DROP TABLE IF EXISTS configuracoes_markup CASCADE;

CREATE TABLE IF NOT EXISTS markup_regras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  valor_minimo numeric(10,2) DEFAULT NULL,
  valor_maximo numeric(10,2) DEFAULT NULL,
  tipo text NOT NULL CHECK (tipo IN ('percentual', 'multiplicador', 'valor_fixo')),
  valor numeric(10,2) NOT NULL DEFAULT 0,
  descricao text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT markup_regras_range_check CHECK (valor_minimo IS NULL OR valor_maximo IS NULL OR valor_minimo < valor_maximo)
);

-- Enable RLS
ALTER TABLE markup_regras ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can view active markup rules"
  ON markup_regras FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert markup rules"
  ON markup_regras FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Users can update markup rules"
  ON markup_regras FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can delete markup rules"
  ON markup_regras FOR DELETE
  TO authenticated
  USING (true);

-- Add index for better performance on range queries
CREATE INDEX IF NOT EXISTS idx_markup_regras_ranges 
ON markup_regras(valor_minimo, valor_maximo) 
WHERE ativo = true;

-- Insert default markup rules
INSERT INTO markup_regras (nome, valor_minimo, valor_maximo, tipo, valor, descricao, ativo) VALUES
('Até R$ 100', 0, 100, 'percentual', 50, 'Markup de 50% para peças até R$ 100', true),
('R$ 100 a R$ 500', 100, 500, 'percentual', 40, 'Markup de 40% para peças entre R$ 100 e R$ 500', true),
('R$ 500+', 500, NULL, 'percentual', 30, 'Markup de 30% para peças acima de R$ 500', true)
ON CONFLICT DO NOTHING;
