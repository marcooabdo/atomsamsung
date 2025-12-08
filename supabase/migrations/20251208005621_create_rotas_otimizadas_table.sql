/*
  # Create Rotas Otimizadas System

  ## Purpose
  This migration creates a system to store and manage optimized routes that have been
  accepted from the route optimizer. This allows the Mapa Inteligente to display
  optimized routes visually and track which OSs are part of which routes.

  ## New Tables

  ### `rotas_otimizadas`
  Stores accepted optimized routes with all their details:
  - `id` (uuid, primary key) - Unique identifier
  - `unidade_id` (uuid, references unidades) - Unit this route belongs to
  - `tecnico_id` (uuid, references usuarios) - Technician assigned to this route
  - `otimizacao_log_id` (uuid, references otimizacao_logs) - Link to the optimization log
  - `nome` (text) - Friendly name for the route
  - `data_criacao` (timestamptz) - When the route was created
  - `data_aplicacao` (timestamptz) - When the route was applied/accepted
  - `status` (text) - Status: 'rascunho', 'aplicada', 'em_andamento', 'concluida', 'cancelada'
  - `metricas` (jsonb) - Metrics like distance, time, etc.
  - `os_incluidas` (jsonb) - Array of OSs included in the route with order
  - `polyline` (text) - Encoded polyline for map visualization
  - `cor_rota` (text) - Color code for this route on the map

  ## Security
  - Enable RLS on all tables
  - Users can only view routes for their unit
  - Users can only modify routes they created or are assigned to

  ## Notes
  - Routes are created when user accepts an optimization
  - The polyline allows for visual display on maps
  - Metrics are stored as JSONB for flexibility
*/

-- Create rotas_otimizadas table
CREATE TABLE IF NOT EXISTS rotas_otimizadas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id UUID NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  tecnico_id UUID NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  otimizacao_log_id UUID REFERENCES otimizacao_logs(id) ON DELETE SET NULL,
  nome TEXT NOT NULL,
  data_criacao TIMESTAMPTZ DEFAULT NOW(),
  data_aplicacao TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'aplicada', 'em_andamento', 'concluida', 'cancelada')),
  metricas JSONB DEFAULT '{}'::jsonb,
  os_incluidas JSONB DEFAULT '[]'::jsonb,
  polyline TEXT,
  cor_rota TEXT DEFAULT '#2563eb',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_rotas_otimizadas_unidade ON rotas_otimizadas(unidade_id);
CREATE INDEX IF NOT EXISTS idx_rotas_otimizadas_tecnico ON rotas_otimizadas(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_rotas_otimizadas_status ON rotas_otimizadas(status);
CREATE INDEX IF NOT EXISTS idx_rotas_otimizadas_data_aplicacao ON rotas_otimizadas(data_aplicacao);

-- Enable RLS
ALTER TABLE rotas_otimizadas ENABLE ROW LEVEL SECURITY;

-- RLS Policies for rotas_otimizadas
CREATE POLICY "Users can view routes for their unit"
  ON rotas_otimizadas FOR SELECT
  TO authenticated
  USING (
    unidade_id IN (
      SELECT unidade_id FROM usuarios WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can insert routes for their unit"
  ON rotas_otimizadas FOR INSERT
  TO authenticated
  WITH CHECK (
    unidade_id IN (
      SELECT unidade_id FROM usuarios WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can update routes for their unit"
  ON rotas_otimizadas FOR UPDATE
  TO authenticated
  USING (
    unidade_id IN (
      SELECT unidade_id FROM usuarios WHERE id = auth.uid()
    )
  )
  WITH CHECK (
    unidade_id IN (
      SELECT unidade_id FROM usuarios WHERE id = auth.uid()
    )
  );

CREATE POLICY "Users can delete routes for their unit"
  ON rotas_otimizadas FOR DELETE
  TO authenticated
  USING (
    unidade_id IN (
      SELECT unidade_id FROM usuarios WHERE id = auth.uid()
    )
  );
