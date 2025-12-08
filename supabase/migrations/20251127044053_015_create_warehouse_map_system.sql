/*
  # Sistema de Mapa do Estoque (Warehouse Map)

  ## Objetivo
  Criar um sistema visual para mapear a localização física das peças no estoque,
  permitindo localização rápida e gestão eficiente do layout físico.

  ## 1. Novas Tabelas
  
  ### `estoque_salas`
  Representa as salas/áreas físicas dentro de cada unidade
  - `id` (uuid, primary key)
  - `unidade_id` (uuid, foreign key -> unidades)
  - `nome` (text) - Ex: "Sala MX", "Sala UPC", "Sala OFS"
  - `cor` (text) - Cor de destaque no mapa (hex)
  - `posicao_x` (integer) - Posição X no grid do mapa
  - `posicao_y` (integer) - Posição Y no grid do mapa
  - `largura` (integer) - Largura em unidades de grid
  - `altura` (integer) - Altura em unidades de grid
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `estoque_estantes`
  Representa as estantes físicas dentro de cada sala
  - `id` (uuid, primary key)
  - `sala_id` (uuid, foreign key -> estoque_salas)
  - `nome` (text) - Ex: "Estante A", "Estante Principal"
  - `andares` (integer) - Quantidade de andares/níveis
  - `bins_por_andar` (integer) - Quantidade de bins por andar
  - `posicao_x` (integer) - Posição X dentro da sala
  - `posicao_y` (integer) - Posição Y dentro da sala
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### `estoque_bins`
  Representa cada bin (caixinha/divisão) individual nas estantes
  - `id` (uuid, primary key)
  - `estante_id` (uuid, foreign key -> estoque_estantes)
  - `andar` (integer) - Número do andar (1, 2, 3...)
  - `posicao` (integer) - Posição no andar (1, 2, 3...)
  - `codigo` (text) - Código único da bin (ex: "A-2-3" = Estante A, Andar 2, Bin 3)
  - `capacidade_maxima` (integer) - Capacidade máxima de peças
  - `created_at` (timestamptz)
  - `updated_at` (timestamptz)

  ### Alteração em `estoque_pecas`
  Adicionar campos de localização física:
  - `bin_id` (uuid, foreign key -> estoque_bins) - Localização da peça

  ## 2. Segurança (RLS)
  - Usuários só podem ver/editar o mapa de sua unidade
  - RLS básico por unidade

  ## 3. Índices
  - Índices em foreign keys para performance
  - Índice em código de bin para busca rápida
  - Índice composto em (estante_id, andar, posicao) para queries espaciais
*/

-- Tabela de Salas
CREATE TABLE IF NOT EXISTS estoque_salas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  nome text NOT NULL,
  cor text DEFAULT '#00D4FF',
  posicao_x integer DEFAULT 0,
  posicao_y integer DEFAULT 0,
  largura integer DEFAULT 3,
  altura integer DEFAULT 2,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de Estantes
CREATE TABLE IF NOT EXISTS estoque_estantes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sala_id uuid NOT NULL REFERENCES estoque_salas(id) ON DELETE CASCADE,
  nome text NOT NULL,
  andares integer NOT NULL DEFAULT 4,
  bins_por_andar integer NOT NULL DEFAULT 6,
  posicao_x integer DEFAULT 0,
  posicao_y integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT andares_validos CHECK (andares > 0 AND andares <= 20),
  CONSTRAINT bins_validos CHECK (bins_por_andar > 0 AND bins_por_andar <= 50)
);

-- Tabela de Bins
CREATE TABLE IF NOT EXISTS estoque_bins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estante_id uuid NOT NULL REFERENCES estoque_estantes(id) ON DELETE CASCADE,
  andar integer NOT NULL,
  posicao integer NOT NULL,
  codigo text NOT NULL UNIQUE,
  capacidade_maxima integer DEFAULT 50,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT andar_positivo CHECK (andar > 0),
  CONSTRAINT posicao_positiva CHECK (posicao > 0)
);

-- Adicionar coluna bin_id em estoque_pecas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'estoque_pecas' AND column_name = 'bin_id'
  ) THEN
    ALTER TABLE estoque_pecas ADD COLUMN bin_id uuid REFERENCES estoque_bins(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_estoque_salas_unidade ON estoque_salas(unidade_id);
CREATE INDEX IF NOT EXISTS idx_estoque_estantes_sala ON estoque_estantes(sala_id);
CREATE INDEX IF NOT EXISTS idx_estoque_bins_estante ON estoque_bins(estante_id);
CREATE INDEX IF NOT EXISTS idx_estoque_bins_codigo ON estoque_bins(codigo);
CREATE INDEX IF NOT EXISTS idx_estoque_bins_localizacao ON estoque_bins(estante_id, andar, posicao);
CREATE INDEX IF NOT EXISTS idx_estoque_pecas_bin ON estoque_pecas(bin_id);

-- RLS: Estoque Salas
ALTER TABLE estoque_salas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view salas from their unit"
  ON estoque_salas FOR SELECT
  TO authenticated
  USING (
    unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
  );

CREATE POLICY "Users can insert salas in their unit"
  ON estoque_salas FOR INSERT
  TO authenticated
  WITH CHECK (
    unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
  );

CREATE POLICY "Users can update salas in their unit"
  ON estoque_salas FOR UPDATE
  TO authenticated
  USING (
    unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
  )
  WITH CHECK (
    unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
  );

CREATE POLICY "Users can delete salas in their unit"
  ON estoque_salas FOR DELETE
  TO authenticated
  USING (
    unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
  );

-- RLS: Estoque Estantes
ALTER TABLE estoque_estantes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view estantes from their unit"
  ON estoque_estantes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estoque_salas s
      WHERE s.id = estoque_estantes.sala_id
      AND s.unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can insert estantes in their unit"
  ON estoque_estantes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM estoque_salas s
      WHERE s.id = estoque_estantes.sala_id
      AND s.unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can update estantes in their unit"
  ON estoque_estantes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estoque_salas s
      WHERE s.id = estoque_estantes.sala_id
      AND s.unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM estoque_salas s
      WHERE s.id = estoque_estantes.sala_id
      AND s.unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can delete estantes in their unit"
  ON estoque_estantes FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estoque_salas s
      WHERE s.id = estoque_estantes.sala_id
      AND s.unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
    )
  );

-- RLS: Estoque Bins
ALTER TABLE estoque_bins ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view bins from their unit"
  ON estoque_bins FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estoque_estantes e
      JOIN estoque_salas s ON e.sala_id = s.id
      WHERE e.id = estoque_bins.estante_id
      AND s.unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can insert bins in their unit"
  ON estoque_bins FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM estoque_estantes e
      JOIN estoque_salas s ON e.sala_id = s.id
      WHERE e.id = estoque_bins.estante_id
      AND s.unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can update bins in their unit"
  ON estoque_bins FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estoque_estantes e
      JOIN estoque_salas s ON e.sala_id = s.id
      WHERE e.id = estoque_bins.estante_id
      AND s.unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM estoque_estantes e
      JOIN estoque_salas s ON e.sala_id = s.id
      WHERE e.id = estoque_bins.estante_id
      AND s.unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
    )
  );

CREATE POLICY "Users can delete bins in their unit"
  ON estoque_bins FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estoque_estantes e
      JOIN estoque_salas s ON e.sala_id = s.id
      WHERE e.id = estoque_bins.estante_id
      AND s.unidade_id = (SELECT unidade_id FROM usuarios WHERE id = auth.uid())
    )
  );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_estoque_salas_updated_at
  BEFORE UPDATE ON estoque_salas
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_estoque_estantes_updated_at
  BEFORE UPDATE ON estoque_estantes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_estoque_bins_updated_at
  BEFORE UPDATE ON estoque_bins
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();