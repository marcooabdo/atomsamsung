/*
  # Add unit and team scoping to Skywalker gamification system

  1. Modified Tables
    - `skywalker_niveis` - Add `unidade_id` (nullable) for per-unit levels
    - `skywalker_pilares` - Add `unidade_id` for per-unit pillars  
    - `skywalker_regras_estrelas` - Add `unidade_id` for per-unit star rules
    - `skywalker_regras_promocao` - Add `unidade_id` and `time_id` for scoped promotion rules
    - `skywalker_bonificacoes` - Add `unidade_id` for per-unit bonuses
    - `skywalker_times` - Add `unidade_id` for per-unit teams
    - `skywalker_profissionais` - Add `time_id` FK to skywalker_times

  2. New Table
    - `skywalker_orcamentos_aprovados` - Tracks budget approvals per user per month for ranking

  3. Security
    - All new columns have appropriate indexes
    - Existing RLS policies still apply

  4. Notes
    - NULL unidade_id means the record applies globally (all units)
    - This enables each unit to have its own levels, rules, teams, and bonuses
    - Existing data is preserved (global scope by default)
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skywalker_niveis' AND column_name = 'unidade_id'
  ) THEN
    ALTER TABLE skywalker_niveis ADD COLUMN unidade_id uuid REFERENCES unidades(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skywalker_pilares' AND column_name = 'unidade_id'
  ) THEN
    ALTER TABLE skywalker_pilares ADD COLUMN unidade_id uuid REFERENCES unidades(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skywalker_regras_estrelas' AND column_name = 'unidade_id'
  ) THEN
    ALTER TABLE skywalker_regras_estrelas ADD COLUMN unidade_id uuid REFERENCES unidades(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skywalker_regras_promocao' AND column_name = 'unidade_id'
  ) THEN
    ALTER TABLE skywalker_regras_promocao ADD COLUMN unidade_id uuid REFERENCES unidades(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skywalker_regras_promocao' AND column_name = 'time_id'
  ) THEN
    ALTER TABLE skywalker_regras_promocao ADD COLUMN time_id uuid REFERENCES skywalker_times(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skywalker_bonificacoes' AND column_name = 'unidade_id'
  ) THEN
    ALTER TABLE skywalker_bonificacoes ADD COLUMN unidade_id uuid REFERENCES unidades(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skywalker_times' AND column_name = 'unidade_id'
  ) THEN
    ALTER TABLE skywalker_times ADD COLUMN unidade_id uuid REFERENCES unidades(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'skywalker_profissionais' AND column_name = 'time_id'
  ) THEN
    ALTER TABLE skywalker_profissionais ADD COLUMN time_id uuid REFERENCES skywalker_times(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_skywalker_niveis_unidade ON skywalker_niveis(unidade_id);
CREATE INDEX IF NOT EXISTS idx_skywalker_pilares_unidade ON skywalker_pilares(unidade_id);
CREATE INDEX IF NOT EXISTS idx_skywalker_regras_estrelas_unidade ON skywalker_regras_estrelas(unidade_id);
CREATE INDEX IF NOT EXISTS idx_skywalker_regras_promocao_unidade ON skywalker_regras_promocao(unidade_id);
CREATE INDEX IF NOT EXISTS idx_skywalker_regras_promocao_time ON skywalker_regras_promocao(time_id);
CREATE INDEX IF NOT EXISTS idx_skywalker_bonificacoes_unidade ON skywalker_bonificacoes(unidade_id);
CREATE INDEX IF NOT EXISTS idx_skywalker_times_unidade ON skywalker_times(unidade_id);
CREATE INDEX IF NOT EXISTS idx_skywalker_profissionais_time_id ON skywalker_profissionais(time_id);

CREATE TABLE IF NOT EXISTS skywalker_orcamentos_aprovados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  os_id uuid REFERENCES os(id) ON DELETE SET NULL,
  unidade_id uuid REFERENCES unidades(id) ON DELETE SET NULL,
  mes_referencia date NOT NULL,
  valor_orcamento numeric DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE skywalker_orcamentos_aprovados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can view orcamentos aprovados"
  ON skywalker_orcamentos_aprovados
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Authenticated users can insert orcamentos aprovados"
  ON skywalker_orcamentos_aprovados
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u WHERE u.id = auth.uid()
      AND u.tipo IN ('master', 'diretor', 'gerente')
    )
  );

CREATE INDEX IF NOT EXISTS idx_skywalker_orcamentos_usuario ON skywalker_orcamentos_aprovados(usuario_id);
CREATE INDEX IF NOT EXISTS idx_skywalker_orcamentos_mes ON skywalker_orcamentos_aprovados(mes_referencia);
CREATE INDEX IF NOT EXISTS idx_skywalker_orcamentos_unidade ON skywalker_orcamentos_aprovados(unidade_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_skywalker_orcamentos_unique_os ON skywalker_orcamentos_aprovados(os_id) WHERE os_id IS NOT NULL;

CREATE OR REPLACE FUNCTION track_orcamento_aprovado()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.orcamento_aprovado_por IS NOT NULL 
     AND (OLD.orcamento_aprovado_por IS NULL OR OLD.orcamento_aprovado_por IS DISTINCT FROM NEW.orcamento_aprovado_por)
  THEN
    INSERT INTO skywalker_orcamentos_aprovados (usuario_id, os_id, unidade_id, mes_referencia, valor_orcamento)
    VALUES (
      NEW.orcamento_aprovado_por,
      NEW.id,
      NEW.unidade_id,
      date_trunc('month', COALESCE(NEW.orcamento_aprovado_em, now()))::date,
      COALESCE(NEW.valor_bruto, 0)
    )
    ON CONFLICT (os_id) WHERE os_id IS NOT NULL
    DO UPDATE SET
      usuario_id = EXCLUDED.usuario_id,
      unidade_id = EXCLUDED.unidade_id,
      mes_referencia = EXCLUDED.mes_referencia,
      valor_orcamento = EXCLUDED.valor_orcamento;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_track_orcamento_aprovado ON os;
CREATE TRIGGER trg_track_orcamento_aprovado
  AFTER UPDATE ON os
  FOR EACH ROW
  EXECUTE FUNCTION track_orcamento_aprovado();
