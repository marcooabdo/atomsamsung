/*
  # Sistema de Gamificacao Skywalker

  1. Novas Tabelas
    - `skywalker_colaboradores` - Perfil de gamificacao dos colaboradores
      - `id` (uuid, primary key)
      - `usuario_id` (uuid, FK para usuarios)
      - `unidade_id` (uuid, FK para unidades)
      - `perfil` (text) - front_office ou inside_sales
      - `nivel` (text) - starter, avancado, elite, lider_global
      - `meses_consecutivos` (int) - Meses batendo meta
      - `created_at`, `updated_at`

    - `skywalker_vendas` - Registro de vendas
      - `id` (uuid, primary key)
      - `colaborador_id` (uuid, FK)
      - `tipo` (text) - store_plus, care_plus, smb, seguro, instalacao
      - `valor` (numeric)
      - `data_venda` (date)
      - `mes_referencia` (text)
      - `created_at`

    - `skywalker_reviews` - Google Reviews submetidos
      - `id` (uuid, primary key)
      - `colaborador_id` (uuid, FK)
      - `status` (text) - pendente, aprovado, rejeitado
      - `url_print` (text)
      - `mes_referencia` (text)
      - `aprovado_por` (uuid)
      - `created_at`, `updated_at`

    - `skywalker_cultura` - Check de cultura mensal
      - `id` (uuid, primary key)
      - `colaborador_id` (uuid, FK)
      - `mes_referencia` (text)
      - `presenca_reuniao` (boolean)
      - `sem_atrasos` (boolean)
      - `proativo` (boolean)
      - `exemplar` (boolean)
      - `observacoes` (text)
      - `created_at`, `updated_at`

    - `skywalker_regras` - Configuracao das regras do jogo
      - `id` (uuid, primary key)
      - `unidade_id` (uuid, FK)
      - `chave` (text) - Nome da regra
      - `valor` (numeric) - Valor numerico
      - `descricao` (text)
      - `ativo` (boolean)
      - `created_at`, `updated_at`

    - `skywalker_historico_mes` - Historico mensal de estrelas
      - `id` (uuid, primary key)
      - `colaborador_id` (uuid, FK)
      - `mes_referencia` (text)
      - `estrelas_vendas` (int)
      - `estrelas_reviews` (int)
      - `estrelas_cultura` (int)
      - `estrelas_total` (int)
      - `meta_batida` (boolean)
      - `created_at`

  2. Seguranca
    - RLS habilitado em todas as tabelas
    - Politicas para usuarios autenticados

  3. Dados Iniciais
    - Regras padrao do jogo
*/

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'skywalker_perfil') THEN
    CREATE TYPE skywalker_perfil AS ENUM ('front_office', 'inside_sales');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'skywalker_nivel') THEN
    CREATE TYPE skywalker_nivel AS ENUM ('starter', 'avancado', 'elite', 'lider_global');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'skywalker_tipo_venda') THEN
    CREATE TYPE skywalker_tipo_venda AS ENUM ('store_plus', 'care_plus', 'smb', 'seguro', 'instalacao');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'skywalker_review_status') THEN
    CREATE TYPE skywalker_review_status AS ENUM ('pendente', 'aprovado', 'rejeitado');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS skywalker_colaboradores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  perfil skywalker_perfil NOT NULL DEFAULT 'front_office',
  nivel skywalker_nivel NOT NULL DEFAULT 'starter',
  meses_consecutivos int NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(usuario_id)
);

CREATE TABLE IF NOT EXISTS skywalker_vendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES skywalker_colaboradores(id) ON DELETE CASCADE,
  tipo skywalker_tipo_venda NOT NULL,
  valor numeric(12,2) NOT NULL DEFAULT 0,
  data_venda date NOT NULL DEFAULT CURRENT_DATE,
  mes_referencia text NOT NULL DEFAULT to_char(CURRENT_DATE, 'YYYY-MM'),
  observacoes text,
  created_by uuid REFERENCES usuarios(id),
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS skywalker_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES skywalker_colaboradores(id) ON DELETE CASCADE,
  status skywalker_review_status NOT NULL DEFAULT 'pendente',
  url_print text,
  mes_referencia text NOT NULL DEFAULT to_char(CURRENT_DATE, 'YYYY-MM'),
  observacoes text,
  aprovado_por uuid REFERENCES usuarios(id),
  aprovado_em timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS skywalker_cultura (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES skywalker_colaboradores(id) ON DELETE CASCADE,
  mes_referencia text NOT NULL DEFAULT to_char(CURRENT_DATE, 'YYYY-MM'),
  presenca_reuniao boolean NOT NULL DEFAULT false,
  sem_atrasos boolean NOT NULL DEFAULT false,
  proativo boolean NOT NULL DEFAULT false,
  exemplar boolean NOT NULL DEFAULT false,
  observacoes text,
  updated_by uuid REFERENCES usuarios(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(colaborador_id, mes_referencia)
);

CREATE TABLE IF NOT EXISTS skywalker_regras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid REFERENCES unidades(id) ON DELETE CASCADE,
  chave text NOT NULL,
  valor numeric NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(unidade_id, chave)
);

CREATE TABLE IF NOT EXISTS skywalker_historico_mes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES skywalker_colaboradores(id) ON DELETE CASCADE,
  mes_referencia text NOT NULL,
  estrelas_vendas int NOT NULL DEFAULT 0,
  estrelas_reviews int NOT NULL DEFAULT 0,
  estrelas_cultura int NOT NULL DEFAULT 0,
  estrelas_lp_ow int NOT NULL DEFAULT 0,
  estrelas_total int NOT NULL DEFAULT 0,
  meta_batida boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  UNIQUE(colaborador_id, mes_referencia)
);

CREATE INDEX IF NOT EXISTS idx_skywalker_vendas_colaborador ON skywalker_vendas(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_skywalker_vendas_mes ON skywalker_vendas(mes_referencia);
CREATE INDEX IF NOT EXISTS idx_skywalker_reviews_colaborador ON skywalker_reviews(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_skywalker_reviews_status ON skywalker_reviews(status);
CREATE INDEX IF NOT EXISTS idx_skywalker_cultura_colaborador ON skywalker_cultura(colaborador_id);
CREATE INDEX IF NOT EXISTS idx_skywalker_historico_colaborador ON skywalker_historico_mes(colaborador_id);

ALTER TABLE skywalker_colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE skywalker_vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE skywalker_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE skywalker_cultura ENABLE ROW LEVEL SECURITY;
ALTER TABLE skywalker_regras ENABLE ROW LEVEL SECURITY;
ALTER TABLE skywalker_historico_mes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios autenticados podem ver colaboradores"
  ON skywalker_colaboradores FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Gerentes podem inserir colaboradores"
  ON skywalker_colaboradores FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Gerentes podem atualizar colaboradores"
  ON skywalker_colaboradores FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuarios podem ver vendas"
  ON skywalker_vendas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios podem inserir vendas"
  ON skywalker_vendas FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Usuarios podem ver reviews"
  ON skywalker_reviews FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuarios podem inserir reviews"
  ON skywalker_reviews FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Gerentes podem atualizar reviews"
  ON skywalker_reviews FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuarios podem ver cultura"
  ON skywalker_cultura FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Gerentes podem gerenciar cultura"
  ON skywalker_cultura FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuarios podem ver regras"
  ON skywalker_regras FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins podem gerenciar regras"
  ON skywalker_regras FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Usuarios podem ver historico"
  ON skywalker_historico_mes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Sistema pode inserir historico"
  ON skywalker_historico_mes FOR INSERT
  TO authenticated
  WITH CHECK (true);

INSERT INTO skywalker_regras (unidade_id, chave, valor, descricao) VALUES
  (NULL, 'vendas_store_1_estrela', 4, 'Quantidade de vendas Store+ para 1 estrela'),
  (NULL, 'vendas_store_2_estrelas', 8, 'Quantidade de vendas Store+ para 2 estrelas'),
  (NULL, 'vendas_store_3_estrelas', 12, 'Quantidade de vendas Store+ para 3 estrelas'),
  (NULL, 'vendas_care_1_estrela', 1, 'Quantidade de vendas Care+ para 1 estrela'),
  (NULL, 'vendas_care_2_estrelas', 4, 'Quantidade de vendas Care+ para 2 estrelas'),
  (NULL, 'reviews_1_estrela', 1, 'Quantidade de reviews aprovados para 1 estrela'),
  (NULL, 'reviews_2_estrelas', 2, 'Quantidade adicional de reviews para 2 estrelas'),
  (NULL, 'meta_estrelas_starter', 6, 'Meta de estrelas para nivel Starter'),
  (NULL, 'meta_estrelas_avancado', 8, 'Meta de estrelas para nivel Avancado'),
  (NULL, 'meta_estrelas_elite', 10, 'Meta de estrelas para nivel Elite'),
  (NULL, 'meses_starter', 2, 'Meses consecutivos para subir de Starter'),
  (NULL, 'meses_avancado', 3, 'Meses consecutivos para subir de Avancado'),
  (NULL, 'meses_elite', 3, 'Meses consecutivos para subir de Elite'),
  (NULL, 'bonus_store_starter', 1, 'Bonus % Store+ nivel Starter'),
  (NULL, 'bonus_store_avancado', 1.5, 'Bonus % Store+ nivel Avancado'),
  (NULL, 'bonus_store_elite', 2, 'Bonus % Store+ nivel Elite'),
  (NULL, 'bonus_care_starter', 4, 'Bonus % Care+ nivel Starter'),
  (NULL, 'bonus_care_avancado', 7, 'Bonus % Care+ nivel Avancado'),
  (NULL, 'bonus_care_elite', 10, 'Bonus % Care+ nivel Elite')
ON CONFLICT (unidade_id, chave) DO NOTHING;

CREATE OR REPLACE FUNCTION update_skywalker_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_skywalker_colaboradores_updated ON skywalker_colaboradores;
CREATE TRIGGER trigger_skywalker_colaboradores_updated
  BEFORE UPDATE ON skywalker_colaboradores
  FOR EACH ROW EXECUTE FUNCTION update_skywalker_updated_at();

DROP TRIGGER IF EXISTS trigger_skywalker_reviews_updated ON skywalker_reviews;
CREATE TRIGGER trigger_skywalker_reviews_updated
  BEFORE UPDATE ON skywalker_reviews
  FOR EACH ROW EXECUTE FUNCTION update_skywalker_updated_at();

DROP TRIGGER IF EXISTS trigger_skywalker_cultura_updated ON skywalker_cultura;
CREATE TRIGGER trigger_skywalker_cultura_updated
  BEFORE UPDATE ON skywalker_cultura
  FOR EACH ROW EXECUTE FUNCTION update_skywalker_updated_at();

DROP TRIGGER IF EXISTS trigger_skywalker_regras_updated ON skywalker_regras;
CREATE TRIGGER trigger_skywalker_regras_updated
  BEFORE UPDATE ON skywalker_regras
  FOR EACH ROW EXECUTE FUNCTION update_skywalker_updated_at();
