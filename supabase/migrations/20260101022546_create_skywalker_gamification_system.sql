/*
  # Skywalker - Sistema de Gamificacao de Carreira (PDI)

  1. Novas Tabelas
    - `skywalker_colaboradores` - Config do colaborador no sistema
    - `skywalker_kpis_mensais` - KPIs mensais de cada colaborador
    - `skywalker_metas_nivel` - Metas por nivel
    - `skywalker_comissoes` - Tabela de comissoes por nivel e perfil
    - `skywalker_historico` - Historico de progressao
    - `skywalker_provas_google` - Upload de provas Google

  2. Regras de Negocio
    - Front Office: Store+, LP/OW, Google Reviews, Cultura, Care+
    - Inside Sales: LP/OW, Google, Participacao, Conversao, Seguro/Instalacao
    - Trava de Cultura: Nao pode subir se Google=0 OU Participacao=0

  3. Niveis
    - Starter: 6 estrelas por 2 meses
    - Avancado: 8 estrelas por 3 meses
    - Elite: 10 estrelas por 3 meses
    - Lider Global: Promocao manual

  4. Security
    - RLS habilitado em todas as tabelas
*/

-- Enum para perfil do colaborador
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'skywalker_perfil_type') THEN
    CREATE TYPE skywalker_perfil_type AS ENUM ('front_office', 'inside_sales');
  END IF;
END $$;

-- Enum para nivel do colaborador
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'skywalker_nivel_type') THEN
    CREATE TYPE skywalker_nivel_type AS ENUM ('starter', 'avancado', 'elite', 'lider_global');
  END IF;
END $$;

-- Tabela de configuracao do colaborador no Skywalker
CREATE TABLE IF NOT EXISTS skywalker_colaboradores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  unidade_id uuid REFERENCES unidades(id) ON DELETE SET NULL,
  perfil skywalker_perfil_type NOT NULL DEFAULT 'front_office',
  nivel_atual skywalker_nivel_type NOT NULL DEFAULT 'starter',
  meses_consecutivos integer NOT NULL DEFAULT 0,
  data_ultimo_nivel timestamptz,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(usuario_id)
);

-- Tabela de KPIs mensais
CREATE TABLE IF NOT EXISTS skywalker_kpis_mensais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES skywalker_colaboradores(id) ON DELETE CASCADE,
  mes integer NOT NULL CHECK (mes >= 1 AND mes <= 12),
  ano integer NOT NULL CHECK (ano >= 2024),
  
  -- KPIs Front Office
  store_plus_vendas integer DEFAULT 0,
  store_plus_estrelas integer DEFAULT 0 CHECK (store_plus_estrelas >= 0 AND store_plus_estrelas <= 3),
  
  care_plus_vendas integer DEFAULT 0,
  care_plus_estrelas integer DEFAULT 0 CHECK (care_plus_estrelas >= 0 AND care_plus_estrelas <= 2),
  
  -- KPIs Compartilhados
  lp_ow_percentual numeric(5,2) DEFAULT 0,
  lp_ow_estrelas integer DEFAULT 0 CHECK (lp_ow_estrelas >= 0 AND lp_ow_estrelas <= 3),
  
  google_reviews_meta_batida boolean DEFAULT false,
  google_reviews_bonus integer DEFAULT 0,
  google_reviews_estrelas integer DEFAULT 0 CHECK (google_reviews_estrelas >= 0 AND google_reviews_estrelas <= 2),
  
  cultura_faltas integer DEFAULT 0,
  cultura_proativo boolean DEFAULT false,
  cultura_exemplar boolean DEFAULT false,
  cultura_estrelas integer DEFAULT 0 CHECK (cultura_estrelas >= 0 AND cultura_estrelas <= 3),
  
  -- KPIs Inside Sales
  conversao_percentual numeric(5,2) DEFAULT 0,
  conversao_estrelas integer DEFAULT 0 CHECK (conversao_estrelas >= 0 AND conversao_estrelas <= 5),
  
  seguro_instalacao_vendas integer DEFAULT 0,
  seguro_instalacao_estrelas integer DEFAULT 0 CHECK (seguro_instalacao_estrelas >= 0 AND seguro_instalacao_estrelas <= 2),
  
  -- Totais calculados
  total_estrelas integer GENERATED ALWAYS AS (
    COALESCE(store_plus_estrelas, 0) + 
    COALESCE(care_plus_estrelas, 0) + 
    COALESCE(lp_ow_estrelas, 0) + 
    COALESCE(google_reviews_estrelas, 0) + 
    COALESCE(cultura_estrelas, 0) + 
    COALESCE(conversao_estrelas, 0) + 
    COALESCE(seguro_instalacao_estrelas, 0)
  ) STORED,
  
  -- Trava de cultura
  travado_cultura boolean GENERATED ALWAYS AS (
    google_reviews_estrelas = 0 OR cultura_estrelas = 0
  ) STORED,
  
  -- Meta do nivel atual atingida
  meta_atingida boolean DEFAULT false,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(colaborador_id, mes, ano)
);

-- Tabela de metas por nivel
CREATE TABLE IF NOT EXISTS skywalker_metas_nivel (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nivel skywalker_nivel_type NOT NULL,
  estrelas_necessarias integer NOT NULL,
  meses_consecutivos integer NOT NULL,
  proximo_nivel skywalker_nivel_type,
  created_at timestamptz DEFAULT now(),
  UNIQUE(nivel)
);

-- Inserir metas padrao
INSERT INTO skywalker_metas_nivel (nivel, estrelas_necessarias, meses_consecutivos, proximo_nivel) VALUES
  ('starter', 6, 2, 'avancado'),
  ('avancado', 8, 3, 'elite'),
  ('elite', 10, 3, 'lider_global'),
  ('lider_global', 12, 0, NULL)
ON CONFLICT (nivel) DO NOTHING;

-- Tabela de comissoes por nivel e perfil
CREATE TABLE IF NOT EXISTS skywalker_comissoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil skywalker_perfil_type NOT NULL,
  nivel skywalker_nivel_type NOT NULL,
  tipo_comissao text NOT NULL,
  percentual numeric(5,2) NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(perfil, nivel, tipo_comissao)
);

-- Inserir comissoes padrao Front Office
INSERT INTO skywalker_comissoes (perfil, nivel, tipo_comissao, percentual) VALUES
  ('front_office', 'starter', 'store_plus', 1.0),
  ('front_office', 'starter', 'care_plus', 4.0),
  ('front_office', 'avancado', 'store_plus', 1.5),
  ('front_office', 'avancado', 'care_plus', 6.0),
  ('front_office', 'elite', 'store_plus', 2.0),
  ('front_office', 'elite', 'care_plus', 10.0),
  ('front_office', 'lider_global', 'store_plus', 2.5),
  ('front_office', 'lider_global', 'care_plus', 12.0),
  ('inside_sales', 'starter', 'conversao', 1.0),
  ('inside_sales', 'starter', 'seguro_instalacao', 3.0),
  ('inside_sales', 'avancado', 'conversao', 1.5),
  ('inside_sales', 'avancado', 'seguro_instalacao', 5.0),
  ('inside_sales', 'elite', 'conversao', 2.0),
  ('inside_sales', 'elite', 'seguro_instalacao', 8.0),
  ('inside_sales', 'lider_global', 'conversao', 2.5),
  ('inside_sales', 'lider_global', 'seguro_instalacao', 10.0)
ON CONFLICT (perfil, nivel, tipo_comissao) DO NOTHING;

-- Tabela de historico de progressao
CREATE TABLE IF NOT EXISTS skywalker_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES skywalker_colaboradores(id) ON DELETE CASCADE,
  nivel_anterior skywalker_nivel_type,
  nivel_novo skywalker_nivel_type NOT NULL,
  motivo text,
  promovido_por uuid REFERENCES usuarios(id),
  created_at timestamptz DEFAULT now()
);

-- Tabela de provas Google Reviews
CREATE TABLE IF NOT EXISTS skywalker_provas_google (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES skywalker_colaboradores(id) ON DELETE CASCADE,
  mes integer NOT NULL,
  ano integer NOT NULL,
  arquivo_url text NOT NULL,
  validado boolean DEFAULT false,
  validado_por uuid REFERENCES usuarios(id),
  validado_em timestamptz,
  ocr_resultado jsonb,
  created_at timestamptz DEFAULT now()
);

-- Tabela de handover OW (Front -> Inside Sales)
CREATE TABLE IF NOT EXISTS skywalker_handover_ow (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid REFERENCES os(id) ON DELETE SET NULL,
  aberto_por uuid NOT NULL REFERENCES skywalker_colaboradores(id),
  atribuido_para uuid REFERENCES skywalker_colaboradores(id),
  convertido boolean DEFAULT false,
  data_conversao timestamptz,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE skywalker_colaboradores ENABLE ROW LEVEL SECURITY;
ALTER TABLE skywalker_kpis_mensais ENABLE ROW LEVEL SECURITY;
ALTER TABLE skywalker_metas_nivel ENABLE ROW LEVEL SECURITY;
ALTER TABLE skywalker_comissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE skywalker_historico ENABLE ROW LEVEL SECURITY;
ALTER TABLE skywalker_provas_google ENABLE ROW LEVEL SECURITY;
ALTER TABLE skywalker_handover_ow ENABLE ROW LEVEL SECURITY;

-- Policies para skywalker_colaboradores
CREATE POLICY "Colaboradores podem ver seus proprios dados"
  ON skywalker_colaboradores FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.tipo = 'master' OR u.tipo = 'gerente')
    )
  );

CREATE POLICY "Masters e gerentes podem inserir colaboradores"
  ON skywalker_colaboradores FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.tipo = 'master' OR u.tipo = 'gerente')
    )
  );

CREATE POLICY "Masters e gerentes podem atualizar colaboradores"
  ON skywalker_colaboradores FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.tipo = 'master' OR u.tipo = 'gerente')
    )
  );

CREATE POLICY "Masters e gerentes podem deletar colaboradores"
  ON skywalker_colaboradores FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.tipo = 'master' OR u.tipo = 'gerente')
    )
  );

-- Policies para skywalker_kpis_mensais
CREATE POLICY "Usuarios podem ver KPIs"
  ON skywalker_kpis_mensais FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM skywalker_colaboradores sc
      WHERE sc.id = skywalker_kpis_mensais.colaborador_id
      AND (
        sc.usuario_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM usuarios u
          WHERE u.id = auth.uid()
          AND (u.tipo = 'master' OR u.tipo = 'gerente')
        )
      )
    )
  );

CREATE POLICY "Masters e gerentes podem inserir KPIs"
  ON skywalker_kpis_mensais FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.tipo = 'master' OR u.tipo = 'gerente')
    )
  );

CREATE POLICY "Masters e gerentes podem atualizar KPIs"
  ON skywalker_kpis_mensais FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.tipo = 'master' OR u.tipo = 'gerente')
    )
  );

CREATE POLICY "Masters e gerentes podem deletar KPIs"
  ON skywalker_kpis_mensais FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.tipo = 'master' OR u.tipo = 'gerente')
    )
  );

-- Policies para metas (leitura para todos autenticados)
CREATE POLICY "Todos podem ver metas"
  ON skywalker_metas_nivel FOR SELECT
  TO authenticated
  USING (true);

-- Policies para comissoes (leitura para todos autenticados)
CREATE POLICY "Todos podem ver comissoes"
  ON skywalker_comissoes FOR SELECT
  TO authenticated
  USING (true);

-- Policies para historico
CREATE POLICY "Usuarios podem ver historico"
  ON skywalker_historico FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM skywalker_colaboradores sc
      WHERE sc.id = skywalker_historico.colaborador_id
      AND (
        sc.usuario_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM usuarios u
          WHERE u.id = auth.uid()
          AND (u.tipo = 'master' OR u.tipo = 'gerente')
        )
      )
    )
  );

CREATE POLICY "Masters e gerentes podem inserir historico"
  ON skywalker_historico FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.tipo = 'master' OR u.tipo = 'gerente')
    )
  );

-- Policies para provas google
CREATE POLICY "Usuarios podem ver suas provas"
  ON skywalker_provas_google FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM skywalker_colaboradores sc
      WHERE sc.id = skywalker_provas_google.colaborador_id
      AND (
        sc.usuario_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM usuarios u
          WHERE u.id = auth.uid()
          AND (u.tipo = 'master' OR u.tipo = 'gerente')
        )
      )
    )
  );

CREATE POLICY "Colaboradores podem inserir suas provas"
  ON skywalker_provas_google FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM skywalker_colaboradores sc
      WHERE sc.id = skywalker_provas_google.colaborador_id
      AND sc.usuario_id = auth.uid()
    )
  );

-- Policies para handover
CREATE POLICY "Usuarios podem ver handovers"
  ON skywalker_handover_ow FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Colaboradores podem criar handovers"
  ON skywalker_handover_ow FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM skywalker_colaboradores sc
      WHERE sc.id = skywalker_handover_ow.aberto_por
      AND sc.usuario_id = auth.uid()
    )
  );

-- Funcao para calcular estrelas automaticamente
CREATE OR REPLACE FUNCTION calcular_estrelas_skywalker()
RETURNS TRIGGER AS $$
DECLARE
  v_perfil skywalker_perfil_type;
BEGIN
  -- Buscar perfil do colaborador
  SELECT perfil INTO v_perfil
  FROM skywalker_colaboradores
  WHERE id = NEW.colaborador_id;

  -- Calcular estrelas Store+ (Front Office)
  IF v_perfil = 'front_office' THEN
    NEW.store_plus_estrelas := CASE
      WHEN NEW.store_plus_vendas >= 12 THEN 3
      WHEN NEW.store_plus_vendas >= 8 THEN 2
      WHEN NEW.store_plus_vendas >= 4 THEN 1
      ELSE 0
    END;
    
    NEW.care_plus_estrelas := CASE
      WHEN NEW.care_plus_vendas >= 4 THEN 2
      WHEN NEW.care_plus_vendas >= 1 THEN 1
      ELSE 0
    END;
  END IF;

  -- Calcular estrelas LP/OW (ambos)
  NEW.lp_ow_estrelas := CASE
    WHEN NEW.lp_ow_percentual >= 100 THEN 3
    WHEN NEW.lp_ow_percentual >= 90 THEN 2
    WHEN NEW.lp_ow_percentual >= 80 THEN 1
    ELSE 0
  END;

  -- Calcular estrelas Google Reviews
  NEW.google_reviews_estrelas := CASE
    WHEN NEW.google_reviews_meta_batida AND NEW.google_reviews_bonus >= 12 THEN 2
    WHEN NEW.google_reviews_meta_batida THEN 1
    ELSE 0
  END;

  -- Calcular estrelas Cultura/Participacao
  NEW.cultura_estrelas := CASE
    WHEN NEW.cultura_exemplar THEN 3
    WHEN NEW.cultura_proativo AND NEW.cultura_faltas = 0 THEN 2
    WHEN NEW.cultura_faltas = 0 THEN 1
    ELSE 0
  END;

  -- Calcular estrelas Inside Sales
  IF v_perfil = 'inside_sales' THEN
    NEW.conversao_estrelas := CASE
      WHEN NEW.conversao_percentual >= 60 THEN 5
      WHEN NEW.conversao_percentual >= 50 THEN 4
      WHEN NEW.conversao_percentual >= 40 THEN 3
      WHEN NEW.conversao_percentual >= 30 THEN 1
      ELSE 0
    END;
    
    NEW.seguro_instalacao_estrelas := CASE
      WHEN NEW.seguro_instalacao_vendas >= 4 THEN 2
      WHEN NEW.seguro_instalacao_vendas >= 1 THEN 1
      ELSE 0
    END;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para calcular estrelas
DROP TRIGGER IF EXISTS trigger_calcular_estrelas ON skywalker_kpis_mensais;
CREATE TRIGGER trigger_calcular_estrelas
  BEFORE INSERT OR UPDATE ON skywalker_kpis_mensais
  FOR EACH ROW
  EXECUTE FUNCTION calcular_estrelas_skywalker();

-- Criar bucket para provas Google
INSERT INTO storage.buckets (id, name, public)
VALUES ('skywalker-provas', 'skywalker-provas', false)
ON CONFLICT (id) DO NOTHING;

-- Policies para storage
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Usuarios podem ver suas provas storage' 
    AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Usuarios podem ver suas provas storage"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (bucket_id = 'skywalker-provas');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE policyname = 'Usuarios podem fazer upload de provas' 
    AND tablename = 'objects'
  ) THEN
    CREATE POLICY "Usuarios podem fazer upload de provas"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'skywalker-provas');
  END IF;
END $$;
