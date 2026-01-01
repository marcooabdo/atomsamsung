/*
  # Sistema Skywalker - Rota Estelar Group Global

  1. Tabelas Principais
    - `skywalker_profissionais` - Profissionais e seus níveis atuais
    - `skywalker_niveis` - Configuração dos níveis (Starter, Avançado, Elite, Líder)
    - `skywalker_pilares` - Configuração dos pilares de avaliação
    - `skywalker_regras_estrelas` - Regras para atribuição de estrelas por pilar
    - `skywalker_historico_niveis` - Histórico de promoções

  2. Tabelas de Métricas (Pipelines)
    - `skywalker_google_reviews` - Avaliações Google
    - `skywalker_vendas_store` - Vendas Store+
    - `skywalker_vendas_care` - Vendas Care+
    - `skywalker_instalacoes` - Instalações ADMS
    - `skywalker_conversoes` - Taxa de conversão Inside Sales
    - `skywalker_participacao` - Participação e cultura
    - `skywalker_lp_unidade` - LP/OW coletivo da unidade

  3. Tabelas de Cálculo
    - `skywalker_estrelas_mes` - Estrelas conquistadas por mês
    - `skywalker_bonus_config` - Configuração de bônus por nível

  4. Security
    - RLS habilitado em todas as tabelas
    - Colaboradores veem apenas seus dados
    - Diretoria vê tudo
*/

-- ====================
-- NÍVEIS
-- ====================

CREATE TABLE IF NOT EXISTS skywalker_niveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  ordem integer NOT NULL UNIQUE,
  estrelas_necessarias integer NOT NULL,
  meses_consecutivos integer NOT NULL,
  cor text NOT NULL,
  descricao text,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE skywalker_niveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos podem ver níveis"
  ON skywalker_niveis FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Apenas master pode gerenciar níveis"
  ON skywalker_niveis FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo = 'master'
    )
  );

-- Inserir níveis padrão
INSERT INTO skywalker_niveis (nome, ordem, estrelas_necessarias, meses_consecutivos, cor, descricao) VALUES
  ('Starter', 1, 6, 2, '#3B82F6', 'Nível inicial - 6 estrelas por 2 meses consecutivos'),
  ('Avançado', 2, 8, 3, '#8B5CF6', 'Nível intermediário - 8 estrelas por 3 meses consecutivos'),
  ('Elite', 3, 10, 3, '#F59E0B', 'Nível avançado - 10 estrelas por 3 meses consecutivos'),
  ('Líder Global', 4, 12, 0, '#EF4444', 'Nível máximo - crescimento por mérito')
ON CONFLICT (nome) DO NOTHING;

-- ====================
-- PROFISSIONAIS
-- ====================

CREATE TABLE IF NOT EXISTS skywalker_profissionais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  unidade_id uuid REFERENCES unidades(id),
  time text NOT NULL CHECK (time IN ('front_office', 'inside_sales')),
  nivel_atual_id uuid REFERENCES skywalker_niveis(id),
  data_inicio_nivel date,
  meses_consecutivos_validos integer DEFAULT 0,
  ativo boolean DEFAULT true,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(usuario_id)
);

ALTER TABLE skywalker_profissionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem seu próprio perfil"
  ON skywalker_profissionais FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor')
    )
  );

CREATE POLICY "Apenas diretoria gerencia profissionais"
  ON skywalker_profissionais FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor')
    )
  );

-- ====================
-- PILARES DE AVALIAÇÃO
-- ====================

CREATE TABLE IF NOT EXISTS skywalker_pilares (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  descricao text,
  time_aplicavel text[] NOT NULL,
  tipo_metrica text NOT NULL CHECK (tipo_metrica IN ('quantidade', 'percentual', 'binario')),
  ordem integer NOT NULL,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE skywalker_pilares ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos veem pilares"
  ON skywalker_pilares FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Apenas master gerencia pilares"
  ON skywalker_pilares FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo = 'master'
    )
  );

-- Inserir pilares padrão
INSERT INTO skywalker_pilares (nome, descricao, time_aplicavel, tipo_metrica, ordem) VALUES
  ('Google Reviews', 'Avaliações Google da unidade', ARRAY['front_office', 'inside_sales'], 'quantidade', 1),
  ('Vendas Store+', 'Vendas de Store+ realizadas', ARRAY['front_office', 'inside_sales'], 'quantidade', 2),
  ('Vendas Care+', 'Vendas de Care+ realizadas', ARRAY['front_office', 'inside_sales'], 'quantidade', 3),
  ('Instalações ADMS', 'Quantidade de instalações realizadas', ARRAY['front_office'], 'quantidade', 4),
  ('Conversão', 'Taxa de conversão de leads', ARRAY['inside_sales'], 'percentual', 5),
  ('Participação/Cultura', 'Participação, presença e engajamento', ARRAY['front_office', 'inside_sales'], 'quantidade', 6),
  ('LP/OW Unidade', 'Meta coletiva da unidade (LP/OW)', ARRAY['front_office', 'inside_sales'], 'percentual', 7)
ON CONFLICT (nome) DO NOTHING;

-- ====================
-- REGRAS DE ESTRELAS
-- ====================

CREATE TABLE IF NOT EXISTS skywalker_regras_estrelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pilar_id uuid NOT NULL REFERENCES skywalker_pilares(id) ON DELETE CASCADE,
  time text NOT NULL CHECK (time IN ('front_office', 'inside_sales')),
  valor_minimo numeric NOT NULL,
  valor_maximo numeric,
  estrelas integer NOT NULL CHECK (estrelas >= 0 AND estrelas <= 5),
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE skywalker_regras_estrelas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos veem regras de estrelas"
  ON skywalker_regras_estrelas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Apenas master gerencia regras"
  ON skywalker_regras_estrelas FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo = 'master'
    )
  );

-- ====================
-- GOOGLE REVIEWS
-- ====================

CREATE TABLE IF NOT EXISTS skywalker_google_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id uuid NOT NULL REFERENCES skywalker_profissionais(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL REFERENCES unidades(id),
  mes_referencia date NOT NULL,
  quantidade integer NOT NULL DEFAULT 1,
  evidencia_url text,
  observacao text,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aprovado', 'rejeitado')),
  aprovado_por uuid REFERENCES usuarios(id),
  data_aprovacao timestamptz,
  motivo_rejeicao text,
  lancado_por uuid NOT NULL REFERENCES usuarios(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE skywalker_google_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem seus próprios reviews"
  ON skywalker_google_reviews FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM skywalker_profissionais sp
      WHERE sp.id = profissional_id
      AND sp.usuario_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente')
    )
  );

CREATE POLICY "Todos podem lançar reviews"
  ON skywalker_google_reviews FOR INSERT
  TO authenticated
  WITH CHECK (
    lancado_por = auth.uid()
  );

CREATE POLICY "Diretoria gerencia reviews"
  ON skywalker_google_reviews FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor')
    )
  );

-- ====================
-- VENDAS STORE+
-- ====================

CREATE TABLE IF NOT EXISTS skywalker_vendas_store (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id uuid NOT NULL REFERENCES skywalker_profissionais(id) ON DELETE CASCADE,
  mes_referencia date NOT NULL,
  data_venda date NOT NULL,
  quantidade integer NOT NULL DEFAULT 1,
  valor numeric,
  observacao text,
  lancado_por uuid NOT NULL REFERENCES usuarios(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE skywalker_vendas_store ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem suas vendas store"
  ON skywalker_vendas_store FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM skywalker_profissionais sp
      WHERE sp.id = profissional_id
      AND sp.usuario_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente')
    )
  );

CREATE POLICY "Gestores lançam vendas store"
  ON skywalker_vendas_store FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente')
    )
  );

CREATE POLICY "Diretoria gerencia vendas store"
  ON skywalker_vendas_store FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor')
    )
  );

-- ====================
-- VENDAS CARE+
-- ====================

CREATE TABLE IF NOT EXISTS skywalker_vendas_care (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id uuid NOT NULL REFERENCES skywalker_profissionais(id) ON DELETE CASCADE,
  mes_referencia date NOT NULL,
  data_venda date NOT NULL,
  quantidade integer NOT NULL DEFAULT 1,
  valor numeric,
  observacao text,
  lancado_por uuid NOT NULL REFERENCES usuarios(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE skywalker_vendas_care ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem suas vendas care"
  ON skywalker_vendas_care FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM skywalker_profissionais sp
      WHERE sp.id = profissional_id
      AND sp.usuario_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente')
    )
  );

CREATE POLICY "Gestores lançam vendas care"
  ON skywalker_vendas_care FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente')
    )
  );

CREATE POLICY "Diretoria gerencia vendas care"
  ON skywalker_vendas_care FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor')
    )
  );

-- ====================
-- INSTALAÇÕES
-- ====================

CREATE TABLE IF NOT EXISTS skywalker_instalacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id uuid NOT NULL REFERENCES skywalker_profissionais(id) ON DELETE CASCADE,
  mes_referencia date NOT NULL,
  data_instalacao date NOT NULL,
  quantidade integer NOT NULL DEFAULT 1,
  observacao text,
  lancado_por uuid NOT NULL REFERENCES usuarios(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE skywalker_instalacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem suas instalações"
  ON skywalker_instalacoes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM skywalker_profissionais sp
      WHERE sp.id = profissional_id
      AND sp.usuario_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente')
    )
  );

CREATE POLICY "Gestores lançam instalações"
  ON skywalker_instalacoes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente')
    )
  );

CREATE POLICY "Diretoria gerencia instalações"
  ON skywalker_instalacoes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor')
    )
  );

-- ====================
-- CONVERSÕES
-- ====================

CREATE TABLE IF NOT EXISTS skywalker_conversoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id uuid NOT NULL REFERENCES skywalker_profissionais(id) ON DELETE CASCADE,
  mes_referencia date NOT NULL,
  taxa_conversao numeric NOT NULL CHECK (taxa_conversao >= 0 AND taxa_conversao <= 100),
  evidencia_url text,
  observacao text,
  lancado_por uuid NOT NULL REFERENCES usuarios(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE skywalker_conversoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem suas conversões"
  ON skywalker_conversoes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM skywalker_profissionais sp
      WHERE sp.id = profissional_id
      AND sp.usuario_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente')
    )
  );

CREATE POLICY "Gestores lançam conversões"
  ON skywalker_conversoes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente')
    )
  );

CREATE POLICY "Diretoria gerencia conversões"
  ON skywalker_conversoes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor')
    )
  );

-- ====================
-- PARTICIPAÇÃO / CULTURA
-- ====================

CREATE TABLE IF NOT EXISTS skywalker_participacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id uuid NOT NULL REFERENCES skywalker_profissionais(id) ON DELETE CASCADE,
  mes_referencia date NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('falta', 'atraso', 'reuniao', 'treinamento', 'acao_marketing')),
  quantidade integer NOT NULL DEFAULT 1,
  descricao text,
  impacto text CHECK (impacto IN ('positivo', 'negativo')),
  lancado_por uuid NOT NULL REFERENCES usuarios(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE skywalker_participacao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem sua participação"
  ON skywalker_participacao FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM skywalker_profissionais sp
      WHERE sp.id = profissional_id
      AND sp.usuario_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente')
    )
  );

CREATE POLICY "Gestores lançam participação"
  ON skywalker_participacao FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente')
    )
  );

CREATE POLICY "Diretoria gerencia participação"
  ON skywalker_participacao FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor')
    )
  );

-- ====================
-- LP/OW UNIDADE
-- ====================

CREATE TABLE IF NOT EXISTS skywalker_lp_unidade (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES unidades(id),
  mes_referencia date NOT NULL,
  meta_lp numeric NOT NULL,
  realizado_lp numeric NOT NULL,
  percentual_atingido numeric GENERATED ALWAYS AS ((realizado_lp / NULLIF(meta_lp, 0)) * 100) STORED,
  observacao text,
  lancado_por uuid NOT NULL REFERENCES usuarios(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(unidade_id, mes_referencia)
);

ALTER TABLE skywalker_lp_unidade ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos veem LP da unidade"
  ON skywalker_lp_unidade FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Gestores lançam LP unidade"
  ON skywalker_lp_unidade FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente')
    )
  );

CREATE POLICY "Diretoria gerencia LP unidade"
  ON skywalker_lp_unidade FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor')
    )
  );

-- ====================
-- ESTRELAS DO MÊS
-- ====================

CREATE TABLE IF NOT EXISTS skywalker_estrelas_mes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id uuid NOT NULL REFERENCES skywalker_profissionais(id) ON DELETE CASCADE,
  mes_referencia date NOT NULL,
  pilar_id uuid NOT NULL REFERENCES skywalker_pilares(id),
  valor_metrica numeric NOT NULL,
  estrelas_conquistadas integer NOT NULL CHECK (estrelas_conquistadas >= 0 AND estrelas_conquistadas <= 5),
  calculado_em timestamptz DEFAULT now(),
  UNIQUE(profissional_id, mes_referencia, pilar_id)
);

ALTER TABLE skywalker_estrelas_mes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem suas estrelas"
  ON skywalker_estrelas_mes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM skywalker_profissionais sp
      WHERE sp.id = profissional_id
      AND sp.usuario_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor')
    )
  );

CREATE POLICY "Sistema calcula estrelas"
  ON skywalker_estrelas_mes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor')
    )
  );

-- ====================
-- HISTÓRICO DE NÍVEIS
-- ====================

CREATE TABLE IF NOT EXISTS skywalker_historico_niveis (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profissional_id uuid NOT NULL REFERENCES skywalker_profissionais(id) ON DELETE CASCADE,
  nivel_anterior_id uuid REFERENCES skywalker_niveis(id),
  nivel_novo_id uuid NOT NULL REFERENCES skywalker_niveis(id),
  data_promocao date NOT NULL DEFAULT CURRENT_DATE,
  observacao text,
  promocao_automatica boolean DEFAULT true,
  aprovado_por uuid REFERENCES usuarios(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE skywalker_historico_niveis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários veem seu histórico"
  ON skywalker_historico_niveis FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM skywalker_profissionais sp
      WHERE sp.id = profissional_id
      AND sp.usuario_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor')
    )
  );

CREATE POLICY "Diretoria gerencia histórico"
  ON skywalker_historico_niveis FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor')
    )
  );

-- ====================
-- CONFIGURAÇÃO DE BÔNUS
-- ====================

CREATE TABLE IF NOT EXISTS skywalker_bonus_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nivel_id uuid NOT NULL REFERENCES skywalker_niveis(id) ON DELETE CASCADE,
  time text NOT NULL CHECK (time IN ('front_office', 'inside_sales')),
  tipo_venda text NOT NULL CHECK (tipo_venda IN ('store_plus', 'care_plus', 'ow', 'outros')),
  percentual_bonus numeric NOT NULL CHECK (percentual_bonus >= 0),
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(nivel_id, time, tipo_venda)
);

ALTER TABLE skywalker_bonus_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Todos veem configuração de bônus"
  ON skywalker_bonus_config FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Apenas master gerencia bônus"
  ON skywalker_bonus_config FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo = 'master'
    )
  );

-- ====================
-- ÍNDICES PARA PERFORMANCE
-- ====================

CREATE INDEX IF NOT EXISTS idx_profissionais_usuario ON skywalker_profissionais(usuario_id);
CREATE INDEX IF NOT EXISTS idx_profissionais_unidade ON skywalker_profissionais(unidade_id);
CREATE INDEX IF NOT EXISTS idx_profissionais_nivel ON skywalker_profissionais(nivel_atual_id);

CREATE INDEX IF NOT EXISTS idx_google_reviews_profissional ON skywalker_google_reviews(profissional_id);
CREATE INDEX IF NOT EXISTS idx_google_reviews_mes ON skywalker_google_reviews(mes_referencia);

CREATE INDEX IF NOT EXISTS idx_vendas_store_profissional ON skywalker_vendas_store(profissional_id);
CREATE INDEX IF NOT EXISTS idx_vendas_store_mes ON skywalker_vendas_store(mes_referencia);

CREATE INDEX IF NOT EXISTS idx_vendas_care_profissional ON skywalker_vendas_care(profissional_id);
CREATE INDEX IF NOT EXISTS idx_vendas_care_mes ON skywalker_vendas_care(mes_referencia);

CREATE INDEX IF NOT EXISTS idx_estrelas_mes_profissional ON skywalker_estrelas_mes(profissional_id);
CREATE INDEX IF NOT EXISTS idx_estrelas_mes_referencia ON skywalker_estrelas_mes(mes_referencia);

CREATE INDEX IF NOT EXISTS idx_historico_niveis_profissional ON skywalker_historico_niveis(profissional_id);
