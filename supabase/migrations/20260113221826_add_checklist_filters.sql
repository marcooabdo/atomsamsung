/*
  # Adicionar Filtros e Tipos aos Checklists

  1. Alterações
    - Adicionar campo `tipo_os` (array) para filtrar por LP, OW, NA
    - Adicionar campo `tipos_atendimento` (array) para filtrar por CI, IH, II, RH, SH, PS
    - Adicionar campo `tipo_checklist` para classificar como ADM ou TÉCNICO
    - Criar tabela `os_checklist_vinculados` para vincular checklists manualmente às OSs
    - Remover constraint antigo do campo tipo_servico

  2. Novos Campos
    - `tipo_os`: Array de strings (LP, OW, NA) - determina para quais tipos de OS o checklist aparece automaticamente
    - `tipos_atendimento`: Array de strings (CI, IH, II, RH, SH, PS) - filtro adicional por tipo de atendimento
    - `tipo_checklist`: String (ADM, TÉCNICO) - classifica o checklist para aparecer em diferentes abas

  3. Nova Tabela
    - `os_checklist_vinculados`: Tabela para vincular checklists manualmente às OSs

  4. Security
    - RLS habilitado em todas as tabelas
    - Políticas para permitir acesso baseado em unidade
*/

-- Remover constraint antigo do tipo_servico
ALTER TABLE checklist_templates
DROP CONSTRAINT IF EXISTS checklist_templates_tipo_servico_check;

-- Adicionar novos campos
ALTER TABLE checklist_templates
ADD COLUMN IF NOT EXISTS tipo_os text[] DEFAULT ARRAY['LP', 'OW', 'NA'],
ADD COLUMN IF NOT EXISTS tipos_atendimento text[] DEFAULT ARRAY['CI', 'IH', 'II', 'RH', 'SH', 'PS'],
ADD COLUMN IF NOT EXISTS tipo_checklist text DEFAULT 'ADM' CHECK (tipo_checklist IN ('ADM', 'TÉCNICO'));

-- Adicionar comentários
COMMENT ON COLUMN checklist_templates.tipo_os IS 'Array de tipos de OS que este checklist aplica: LP, OW, NA';
COMMENT ON COLUMN checklist_templates.tipos_atendimento IS 'Array de tipos de atendimento que este checklist aplica: CI, IH, II, RH, SH, PS';
COMMENT ON COLUMN checklist_templates.tipo_checklist IS 'Classificação do checklist: ADM (aparece na OS) ou TÉCNICO (aparece no agendamento)';

-- Criar índices para os novos campos
CREATE INDEX IF NOT EXISTS idx_checklist_templates_tipo_os ON checklist_templates USING GIN(tipo_os);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_tipos_atendimento ON checklist_templates USING GIN(tipos_atendimento);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_tipo_checklist ON checklist_templates(tipo_checklist);

-- ============================================================================
-- Criar Tabela de Checklists Vinculados às OSs
-- ============================================================================

CREATE TABLE IF NOT EXISTS os_checklist_vinculados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid REFERENCES os(id) ON DELETE CASCADE NOT NULL,
  checklist_template_id uuid REFERENCES checklist_templates(id) ON DELETE CASCADE NOT NULL,
  respostas jsonb DEFAULT '[]',
  vinculado_automaticamente boolean DEFAULT false,
  vinculado_por uuid REFERENCES usuarios(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(os_id, checklist_template_id)
);

ALTER TABLE os_checklist_vinculados ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE os_checklist_vinculados IS 'Vincula checklists (manuais ou automáticos) às OSs';
COMMENT ON COLUMN os_checklist_vinculados.vinculado_automaticamente IS 'true = vinculado automaticamente pelos filtros, false = vinculado manualmente pelo usuário';
COMMENT ON COLUMN os_checklist_vinculados.respostas IS 'Array JSON com respostas do checklist';

-- Índices
CREATE INDEX IF NOT EXISTS idx_os_checklist_vinculados_os ON os_checklist_vinculados(os_id);
CREATE INDEX IF NOT EXISTS idx_os_checklist_vinculados_template ON os_checklist_vinculados(checklist_template_id);
CREATE INDEX IF NOT EXISTS idx_os_checklist_vinculados_auto ON os_checklist_vinculados(vinculado_automaticamente);

-- ============================================================================
-- RLS Policies para os_checklist_vinculados
-- ============================================================================

-- SELECT: Usuários podem ver checklists vinculados às OSs de sua unidade
CREATE POLICY "Users can view checklist links for their unit OSs"
  ON os_checklist_vinculados
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM os
      JOIN usuarios ON usuarios.id = auth.uid()
      WHERE os.id = os_checklist_vinculados.os_id
      AND (usuarios.unidade_id IS NULL OR os.unidade_id = usuarios.unidade_id)
    )
  );

-- INSERT: Usuários podem vincular checklists às OSs de sua unidade
CREATE POLICY "Users can link checklists to their unit OSs"
  ON os_checklist_vinculados
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM os
      JOIN usuarios ON usuarios.id = auth.uid()
      WHERE os.id = os_checklist_vinculados.os_id
      AND (usuarios.unidade_id IS NULL OR os.unidade_id = usuarios.unidade_id)
    )
  );

-- UPDATE: Usuários podem atualizar checklists vinculados às OSs de sua unidade
CREATE POLICY "Users can update checklist links for their unit OSs"
  ON os_checklist_vinculados
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM os
      JOIN usuarios ON usuarios.id = auth.uid()
      WHERE os.id = os_checklist_vinculados.os_id
      AND (usuarios.unidade_id IS NULL OR os.unidade_id = usuarios.unidade_id)
    )
  );

-- DELETE: Usuários podem remover checklists vinculados às OSs de sua unidade
CREATE POLICY "Users can delete checklist links for their unit OSs"
  ON os_checklist_vinculados
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM os
      JOIN usuarios ON usuarios.id = auth.uid()
      WHERE os.id = os_checklist_vinculados.os_id
      AND (usuarios.unidade_id IS NULL OR os.unidade_id = usuarios.unidade_id)
    )
  );

-- ============================================================================
-- Trigger para atualizar updated_at
-- ============================================================================

CREATE OR REPLACE FUNCTION update_os_checklist_vinculados_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_os_checklist_vinculados_updated_at
  BEFORE UPDATE ON os_checklist_vinculados
  FOR EACH ROW
  EXECUTE FUNCTION update_os_checklist_vinculados_updated_at();

-- ============================================================================
-- Criar Tabela de Checklists Vinculados aos Agendamentos (para técnicos)
-- ============================================================================

CREATE TABLE IF NOT EXISTS agendamento_checklist_vinculados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid REFERENCES agendamentos(id) ON DELETE CASCADE NOT NULL,
  checklist_template_id uuid REFERENCES checklist_templates(id) ON DELETE CASCADE NOT NULL,
  respostas jsonb DEFAULT '[]',
  vinculado_por uuid REFERENCES usuarios(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(agendamento_id, checklist_template_id)
);

ALTER TABLE agendamento_checklist_vinculados ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE agendamento_checklist_vinculados IS 'Vincula checklists TÉCNICO aos agendamentos';
COMMENT ON COLUMN agendamento_checklist_vinculados.respostas IS 'Array JSON com respostas do checklist';

-- Índices
CREATE INDEX IF NOT EXISTS idx_agendamento_checklist_vinculados_agendamento ON agendamento_checklist_vinculados(agendamento_id);
CREATE INDEX IF NOT EXISTS idx_agendamento_checklist_vinculados_template ON agendamento_checklist_vinculados(checklist_template_id);

-- ============================================================================
-- RLS Policies para agendamento_checklist_vinculados
-- ============================================================================

-- SELECT: Usuários podem ver checklists vinculados aos agendamentos de sua unidade
CREATE POLICY "Users can view agendamento checklist links"
  ON agendamento_checklist_vinculados
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agendamentos
      JOIN usuarios ON usuarios.id = auth.uid()
      WHERE agendamentos.id = agendamento_checklist_vinculados.agendamento_id
      AND (usuarios.unidade_id IS NULL OR agendamentos.unidade_id = usuarios.unidade_id)
    )
  );

-- INSERT: Usuários podem vincular checklists aos agendamentos de sua unidade
CREATE POLICY "Users can link checklists to agendamentos"
  ON agendamento_checklist_vinculados
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agendamentos
      JOIN usuarios ON usuarios.id = auth.uid()
      WHERE agendamentos.id = agendamento_checklist_vinculados.agendamento_id
      AND (usuarios.unidade_id IS NULL OR agendamentos.unidade_id = usuarios.unidade_id)
    )
  );

-- UPDATE: Usuários podem atualizar checklists vinculados aos agendamentos de sua unidade
CREATE POLICY "Users can update agendamento checklist links"
  ON agendamento_checklist_vinculados
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agendamentos
      JOIN usuarios ON usuarios.id = auth.uid()
      WHERE agendamentos.id = agendamento_checklist_vinculados.agendamento_id
      AND (usuarios.unidade_id IS NULL OR agendamentos.unidade_id = usuarios.unidade_id)
    )
  );

-- DELETE: Usuários podem remover checklists vinculados aos agendamentos de sua unidade
CREATE POLICY "Users can delete agendamento checklist links"
  ON agendamento_checklist_vinculados
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agendamentos
      JOIN usuarios ON usuarios.id = auth.uid()
      WHERE agendamentos.id = agendamento_checklist_vinculados.agendamento_id
      AND (usuarios.unidade_id IS NULL OR agendamentos.unidade_id = usuarios.unidade_id)
    )
  );

-- Trigger para atualizar updated_at
CREATE TRIGGER update_agendamento_checklist_vinculados_updated_at
  BEFORE UPDATE ON agendamento_checklist_vinculados
  FOR EACH ROW
  EXECUTE FUNCTION update_os_checklist_vinculados_updated_at();
