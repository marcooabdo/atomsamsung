/*
  # Skywalker Complete Gamification System V3

  1. New Tables
    - `skywalker_times` - Tipos de times (Front Office, Inside Sales, etc)
    - `skywalker_regras_promocao` - Regras de promoção e rebaixamento
    - `skywalker_bonificacoes` - Bonificações extras configuráveis
    
  2. Updates
    - Add bonus_valor to skywalker_niveis
    - Add meta fields to skywalker_pilares
    
  3. Security
    - Enable RLS on all new tables
*/

-- Criar tabela de tipos de times
CREATE TABLE IF NOT EXISTS skywalker_times (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  codigo text UNIQUE NOT NULL,
  descricao text,
  cor text DEFAULT '#3B82F6',
  icone text DEFAULT 'Users',
  ativo boolean DEFAULT true,
  ordem integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE skywalker_times ENABLE ROW LEVEL SECURITY;

CREATE POLICY "skywalker_times_select" ON skywalker_times
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "skywalker_times_all" ON skywalker_times
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND tipo IN ('master', 'diretoria')))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND tipo IN ('master', 'diretoria')));

-- Inserir times padrão
INSERT INTO skywalker_times (nome, codigo, descricao, cor, icone, ordem) VALUES
  ('Front Office', 'front_office', 'Equipe de atendimento presencial', '#3B82F6', 'Users', 1),
  ('Inside Sales', 'inside_sales', 'Equipe de vendas internas', '#8B5CF6', 'Phone', 2)
ON CONFLICT (codigo) DO NOTHING;

-- Criar tabela de regras de promoção/rebaixamento
CREATE TABLE IF NOT EXISTS skywalker_regras_promocao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('promocao', 'rebaixamento')),
  nome text NOT NULL,
  descricao text,
  condicao text NOT NULL,
  ativo boolean DEFAULT true,
  obrigatorio boolean DEFAULT true,
  ordem integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE skywalker_regras_promocao ENABLE ROW LEVEL SECURITY;

CREATE POLICY "skywalker_regras_promocao_select" ON skywalker_regras_promocao
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "skywalker_regras_promocao_all" ON skywalker_regras_promocao
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND tipo IN ('master', 'diretoria')))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND tipo IN ('master', 'diretoria')));

-- Inserir regras padrão de promoção
INSERT INTO skywalker_regras_promocao (tipo, nome, descricao, condicao, obrigatorio, ordem) VALUES
  ('promocao', 'Atingir estrelas mínimas', 'Profissional deve atingir o número mínimo de estrelas do próximo nível', 'estrelas_minimas', true, 1),
  ('promocao', 'Meses consecutivos', 'Completar a quantidade de meses consecutivos exigida', 'meses_consecutivos', true, 2),
  ('promocao', 'Sem advertências ativas', 'Não possuir advertências ativas no período', 'sem_advertencias', false, 3),
  ('promocao', 'Aprovação gerencial', 'Necessária aprovação do gerente da unidade', 'aprovacao_gerencial', false, 4),
  ('rebaixamento', 'Não atingir mínimo de estrelas', 'Não atingir o mínimo de estrelas por 2 meses consecutivos', 'estrelas_insuficientes', true, 1),
  ('rebaixamento', 'Advertência grave', 'Receber advertência grave registrada', 'advertencia_grave', true, 2),
  ('rebaixamento', 'Ausência prolongada', 'Ausência superior a 30 dias sem justificativa', 'ausencia_prolongada', false, 3),
  ('rebaixamento', 'Avaliação negativa', 'Avaliação negativa do supervisor direto', 'avaliacao_negativa', false, 4)
ON CONFLICT DO NOTHING;

-- Criar tabela de bonificações extras
CREATE TABLE IF NOT EXISTS skywalker_bonificacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  tipo text NOT NULL CHECK (tipo IN ('valor_fixo', 'percentual', 'estrelas_bonus')),
  valor numeric NOT NULL DEFAULT 0,
  condicao text NOT NULL,
  condicao_valor numeric,
  time_aplicavel text[],
  nivel_minimo_id uuid REFERENCES skywalker_niveis(id),
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE skywalker_bonificacoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "skywalker_bonificacoes_select" ON skywalker_bonificacoes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "skywalker_bonificacoes_all" ON skywalker_bonificacoes
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND tipo IN ('master', 'diretoria')))
  WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND tipo IN ('master', 'diretoria')));

-- Adicionar campo de valor do bônus aos níveis
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'skywalker_niveis' AND column_name = 'bonus_valor') THEN
    ALTER TABLE skywalker_niveis ADD COLUMN bonus_valor numeric DEFAULT 0;
  END IF;
END $$;

-- Atualizar níveis com valores de bônus
UPDATE skywalker_niveis SET bonus_valor = CASE 
  WHEN ordem = 1 THEN 200
  WHEN ordem = 2 THEN 500
  WHEN ordem = 3 THEN 1000
  WHEN ordem = 4 THEN 2000
  ELSE 0
END WHERE bonus_valor IS NULL OR bonus_valor = 0;

-- Adicionar campos de meta aos pilares
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'skywalker_pilares' AND column_name = 'meta_front_office') THEN
    ALTER TABLE skywalker_pilares ADD COLUMN meta_front_office numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'skywalker_pilares' AND column_name = 'meta_inside_sales') THEN
    ALTER TABLE skywalker_pilares ADD COLUMN meta_inside_sales numeric DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'skywalker_pilares' AND column_name = 'max_estrelas') THEN
    ALTER TABLE skywalker_pilares ADD COLUMN max_estrelas integer DEFAULT 3;
  END IF;
END $$;

-- Atualizar pilares com metas padrão
UPDATE skywalker_pilares SET 
  meta_front_office = COALESCE(meta_front_office, 10),
  meta_inside_sales = COALESCE(meta_inside_sales, 10),
  max_estrelas = COALESCE(max_estrelas, 3)
WHERE meta_front_office IS NULL OR meta_front_office = 0;

-- Criar políticas de RLS para tabelas existentes se não existirem
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'skywalker_niveis' AND policyname = 'skywalker_niveis_select') THEN
    CREATE POLICY "skywalker_niveis_select" ON skywalker_niveis FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'skywalker_niveis' AND policyname = 'skywalker_niveis_all') THEN
    CREATE POLICY "skywalker_niveis_all" ON skywalker_niveis FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND tipo IN ('master', 'diretoria')))
      WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND tipo IN ('master', 'diretoria')));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'skywalker_pilares' AND policyname = 'skywalker_pilares_select') THEN
    CREATE POLICY "skywalker_pilares_select" ON skywalker_pilares FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'skywalker_pilares' AND policyname = 'skywalker_pilares_all') THEN
    CREATE POLICY "skywalker_pilares_all" ON skywalker_pilares FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND tipo IN ('master', 'diretoria')))
      WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND tipo IN ('master', 'diretoria')));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'skywalker_regras_estrelas' AND policyname = 'skywalker_regras_estrelas_select') THEN
    CREATE POLICY "skywalker_regras_estrelas_select" ON skywalker_regras_estrelas FOR SELECT TO authenticated USING (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'skywalker_regras_estrelas' AND policyname = 'skywalker_regras_estrelas_all') THEN
    CREATE POLICY "skywalker_regras_estrelas_all" ON skywalker_regras_estrelas FOR ALL TO authenticated
      USING (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND tipo IN ('master', 'diretoria')))
      WITH CHECK (EXISTS (SELECT 1 FROM usuarios WHERE id = auth.uid() AND tipo IN ('master', 'diretoria')));
  END IF;
END $$;
