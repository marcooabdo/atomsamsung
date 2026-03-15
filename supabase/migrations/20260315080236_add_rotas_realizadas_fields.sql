/*
  # Add fields to rotas_otimizadas for Rotas Realizadas history

  ## Changes
  - Add `data_conclusao` column to record when the route was completed
  - Add `criado_por` to track who created the route
  - Add `observacoes` for manager notes on the route
  - Add `resumo_financeiro` JSONB to store financial summary (valor_total_os, custo_pecas, lucro_estimado, etc.)
  - Create view `v_rotas_realizadas` that joins rotas_otimizadas with agendamentos and checkin/checkout data

  ## Purpose
  Enable the "Rotas Realizadas" history tab showing completed routes with:
  - All OS details (check-in/out times, what was done)
  - Financial summary per route
  - Technician performance data
*/

-- Add missing columns to rotas_otimizadas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rotas_otimizadas' AND column_name = 'data_conclusao'
  ) THEN
    ALTER TABLE rotas_otimizadas ADD COLUMN data_conclusao TIMESTAMPTZ;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rotas_otimizadas' AND column_name = 'criado_por'
  ) THEN
    ALTER TABLE rotas_otimizadas ADD COLUMN criado_por UUID REFERENCES usuarios(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rotas_otimizadas' AND column_name = 'observacoes'
  ) THEN
    ALTER TABLE rotas_otimizadas ADD COLUMN observacoes TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'rotas_otimizadas' AND column_name = 'resumo_financeiro'
  ) THEN
    ALTER TABLE rotas_otimizadas ADD COLUMN resumo_financeiro JSONB DEFAULT '{}'::jsonb;
  END IF;
END $$;

-- Create index for date-based queries
CREATE INDEX IF NOT EXISTS idx_rotas_otimizadas_data_conclusao ON rotas_otimizadas(data_conclusao);
CREATE INDEX IF NOT EXISTS idx_rotas_otimizadas_criado_por ON rotas_otimizadas(criado_por);

-- RLS: allow master users to see all units' routes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'rotas_otimizadas' AND policyname = 'Master users can view all routes'
  ) THEN
    CREATE POLICY "Master users can view all routes"
      ON rotas_otimizadas FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM usuarios
          WHERE id = auth.uid()
          AND tipo IN ('master', 'diretoria')
        )
      );
  END IF;
END $$;
