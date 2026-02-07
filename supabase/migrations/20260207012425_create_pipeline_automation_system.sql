/*
  # Create Pipeline Automation System

  ## Overview
  This migration creates a comprehensive automated pipeline movement system for OS (service orders)
  in the Kanban board. The system automatically moves OS between columns based on configurable rules
  triggered by events like quote approval, parts receipt, and route assignment.

  ## New Tables

  ### 1. `pipeline_regras` - Pipeline Rules Configuration
  Stores all automation rules that determine when and how OS should move between Kanban columns.

  ### 2. `pipeline_logs` - Movement History
  Tracks every OS movement for complete auditability.

  ### 3. `pipeline_erros` - Error Log
  Records any failures during rule execution for debugging.

  ### 4. `pipeline_regras_audit` - Rule Modification Audit
  Tracks who created/modified/deleted rules.

  ## Modifications to Existing Tables

  ### `os_pecas` - Add partial receipt tracking
  - `quantidade_esperada` (integer) - Total quantity expected
  - `quantidade_recebida` (integer) - Quantity received so far
  - `data_entrada_total` (timestamptz) - When all parts were received

  ### `os` - Add automation control fields
  - `bloqueio_movimentacao_automatica` (boolean) - Temporarily disable automation
  - `motivo_bloqueio` (text) - Reason for blocking automation

  ### `unidades` - Add global automation toggle
  - `movimentacao_automatica_ativa` (boolean) - Enable/disable automation per unit

  ## Views

  ### `vw_os_status_pecas` - OS Parts Status Summary
  Calculates total parts, received parts, and completion percentage for each OS.

  ### `vw_pipeline_eficiencia` - Pipeline Efficiency Metrics
  Aggregates automation effectiveness metrics.

  ## Security
  - Enable RLS on all new tables
  - Users can only see rules from their unit (except master/diretoria)
  - Logs are read-only for non-admin users
  - Error logs only visible to admin roles
*/

-- Create enum types
DO $$ BEGIN
  CREATE TYPE tipo_regra_pipeline AS ENUM (
    'orcamento_aprovado',
    'pecas_recebidas',
    'escolha_rota',
    'peca_disponivel',
    'custom'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE tipo_movimentacao_pipeline AS ENUM (
    'automatica',
    'manual'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- 1. Create pipeline_regras table
CREATE TABLE IF NOT EXISTS pipeline_regras (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  tipo_regra tipo_regra_pipeline NOT NULL,
  coluna_origem text NOT NULL,
  coluna_destino text NOT NULL,
  condicoes jsonb DEFAULT '{}'::jsonb,
  ativo boolean DEFAULT true,
  unidade_id uuid REFERENCES unidades(id) ON DELETE CASCADE,
  execucoes_total integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- 2. Create pipeline_logs table
CREATE TABLE IF NOT EXISTS pipeline_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid REFERENCES os(id) ON DELETE CASCADE,
  regra_id uuid REFERENCES pipeline_regras(id) ON DELETE SET NULL,
  coluna_origem text NOT NULL,
  coluna_destino text NOT NULL,
  tipo_movimentacao tipo_movimentacao_pipeline NOT NULL,
  motivo_texto text,
  usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  executado_em timestamptz DEFAULT now()
);

-- 3. Create pipeline_erros table
CREATE TABLE IF NOT EXISTS pipeline_erros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid REFERENCES os(id) ON DELETE CASCADE,
  regra_id uuid REFERENCES pipeline_regras(id) ON DELETE SET NULL,
  mensagem_erro text NOT NULL,
  stack_trace text,
  timestamp timestamptz DEFAULT now()
);

-- 4. Create pipeline_regras_audit table
CREATE TABLE IF NOT EXISTS pipeline_regras_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regra_id uuid,
  acao text NOT NULL,
  usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  dados_anteriores jsonb,
  dados_novos jsonb,
  timestamp timestamptz DEFAULT now()
);

-- 5. Modify os_pecas table
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os_pecas' AND column_name = 'quantidade_esperada'
  ) THEN
    ALTER TABLE os_pecas ADD COLUMN quantidade_esperada integer DEFAULT 1;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os_pecas' AND column_name = 'quantidade_recebida'
  ) THEN
    ALTER TABLE os_pecas ADD COLUMN quantidade_recebida integer DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os_pecas' AND column_name = 'data_entrada_total'
  ) THEN
    ALTER TABLE os_pecas ADD COLUMN data_entrada_total timestamptz;
  END IF;
END $$;

-- 6. Modify os table
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'bloqueio_movimentacao_automatica'
  ) THEN
    ALTER TABLE os ADD COLUMN bloqueio_movimentacao_automatica boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'motivo_bloqueio'
  ) THEN
    ALTER TABLE os ADD COLUMN motivo_bloqueio text;
  END IF;
END $$;

-- 7. Modify unidades table
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'unidades' AND column_name = 'movimentacao_automatica_ativa'
  ) THEN
    ALTER TABLE unidades ADD COLUMN movimentacao_automatica_ativa boolean DEFAULT true;
  END IF;
END $$;

-- 8. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_pipeline_regras_tipo_ativo ON pipeline_regras(tipo_regra, ativo, unidade_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_os_id ON pipeline_logs(os_id, executado_em DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_executado_em ON pipeline_logs(executado_em DESC);
CREATE INDEX IF NOT EXISTS idx_pipeline_erros_timestamp ON pipeline_erros(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_os_pecas_quantidade ON os_pecas(quantidade_esperada, quantidade_recebida);

-- 9. Create view for OS parts status
CREATE OR REPLACE VIEW vw_os_status_pecas AS
SELECT
  op.os_id,
  COUNT(*) as total_pecas,
  COUNT(*) FILTER (WHERE op.quantidade_recebida >= op.quantidade_esperada) as pecas_recebidas_completas,
  COUNT(*) FILTER (WHERE op.quantidade_recebida < op.quantidade_esperada) as pecas_pendentes,
  CASE
    WHEN COUNT(*) > 0 THEN
      (COUNT(*) FILTER (WHERE op.quantidade_recebida >= op.quantidade_esperada)::numeric / COUNT(*)::numeric * 100)
    ELSE 0
  END as percentual_recebimento,
  BOOL_AND(op.quantidade_recebida >= op.quantidade_esperada) as todas_pecas_recebidas
FROM os_pecas op
WHERE op.requisitada_em IS NOT NULL
GROUP BY op.os_id;

-- 10. Create view for pipeline efficiency metrics
CREATE OR REPLACE VIEW vw_pipeline_eficiencia AS
SELECT
  DATE(pl.executado_em) as data,
  pl.tipo_movimentacao,
  COUNT(*) as total_movimentacoes,
  COUNT(DISTINCT pl.os_id) as os_distintas,
  COUNT(DISTINCT pl.regra_id) as regras_distintas
FROM pipeline_logs pl
GROUP BY DATE(pl.executado_em), pl.tipo_movimentacao
ORDER BY data DESC;

-- 11. Enable Row Level Security
ALTER TABLE pipeline_regras ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_erros ENABLE ROW LEVEL SECURITY;
ALTER TABLE pipeline_regras_audit ENABLE ROW LEVEL SECURITY;

-- 12. Create RLS policies for pipeline_regras
CREATE POLICY "Users can view rules from their unit"
  ON pipeline_regras FOR SELECT
  TO authenticated
  USING (
    unidade_id IS NULL OR
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.unidade_id = pipeline_regras.unidade_id OR u.tipo IN ('master', 'diretoria'))
    )
  );

CREATE POLICY "Admin users can manage rules"
  ON pipeline_regras FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.tipo IN ('master', 'diretoria', 'gerente')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.tipo IN ('master', 'diretoria', 'gerente')
    )
  );

-- 13. Create RLS policies for pipeline_logs
CREATE POLICY "Users can view logs from their unit"
  ON pipeline_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM os o
      JOIN usuarios u ON u.id = auth.uid()
      WHERE o.id = pipeline_logs.os_id
      AND (
        o.unidade_id = u.unidade_id OR
        u.tipo IN ('master', 'diretoria')
      )
    )
  );

CREATE POLICY "System can insert logs"
  ON pipeline_logs FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 14. Create RLS policies for pipeline_erros
CREATE POLICY "Admin users can view errors"
  ON pipeline_erros FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.tipo IN ('master', 'diretoria', 'gerente')
    )
  );

CREATE POLICY "System can insert errors"
  ON pipeline_erros FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 15. Create RLS policies for pipeline_regras_audit
CREATE POLICY "Admin users can view audit logs"
  ON pipeline_regras_audit FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.tipo IN ('master', 'diretoria', 'gerente')
    )
  );

CREATE POLICY "System can insert audit logs"
  ON pipeline_regras_audit FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- 16. Create trigger to update updated_at on pipeline_regras
CREATE OR REPLACE FUNCTION update_pipeline_regras_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_pipeline_regras_updated_at ON pipeline_regras;
CREATE TRIGGER trg_pipeline_regras_updated_at
  BEFORE UPDATE ON pipeline_regras
  FOR EACH ROW
  EXECUTE FUNCTION update_pipeline_regras_updated_at();

-- 17. Create trigger to audit pipeline_regras changes
CREATE OR REPLACE FUNCTION audit_pipeline_regras_changes()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO pipeline_regras_audit (regra_id, acao, usuario_id, dados_novos)
    VALUES (NEW.id, 'created', auth.uid(), row_to_json(NEW)::jsonb);
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO pipeline_regras_audit (regra_id, acao, usuario_id, dados_anteriores, dados_novos)
    VALUES (NEW.id, 'updated', auth.uid(), row_to_json(OLD)::jsonb, row_to_json(NEW)::jsonb);
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO pipeline_regras_audit (regra_id, acao, usuario_id, dados_anteriores)
    VALUES (OLD.id, 'deleted', auth.uid(), row_to_json(OLD)::jsonb);
    RETURN OLD;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_audit_pipeline_regras ON pipeline_regras;
CREATE TRIGGER trg_audit_pipeline_regras
  AFTER INSERT OR UPDATE OR DELETE ON pipeline_regras
  FOR EACH ROW
  EXECUTE FUNCTION audit_pipeline_regras_changes();
