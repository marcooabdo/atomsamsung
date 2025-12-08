/*
  # Sistema Completo de Agendamentos e Checklists

  1. Novas Tabelas
    - checklist_templates: Templates de checklists configuráveis
    - agendamento_checklist_respostas: Respostas dos checklists preenchidos
  
  2. Alterações em Tabelas Existentes
    - os: Adiciona campos de agendamento (data, confirmação, técnico)
    - agendamentos: Adiciona campos de checkout (GI, peça, observações)
    - usuarios: Adiciona campos de expediente para futura otimização
  
  3. Índices
    - Otimização de queries por data e técnico
  
  4. Segurança
    - RLS em todas as novas tabelas
    - Políticas específicas por tipo de usuário
*/

-- ============================================================================
-- 1. ADICIONAR CAMPOS NA TABELA OS
-- ============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'os' AND column_name = 'data_agendamento'
  ) THEN
    ALTER TABLE os ADD COLUMN data_agendamento date;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'os' AND column_name = 'confirmado_com_cliente'
  ) THEN
    ALTER TABLE os ADD COLUMN confirmado_com_cliente boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'os' AND column_name = 'tecnico_agendado_id'
  ) THEN
    ALTER TABLE os ADD COLUMN tecnico_agendado_id uuid REFERENCES usuarios(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'os' AND column_name = 'tempo_medio_atendimento'
  ) THEN
    ALTER TABLE os ADD COLUMN tempo_medio_atendimento integer DEFAULT 120;
    COMMENT ON COLUMN os.tempo_medio_atendimento IS 'Tempo estimado em minutos - usado para otimização de rotas';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_os_data_agendamento ON os(data_agendamento);
CREATE INDEX IF NOT EXISTS idx_os_tecnico_agendado ON os(tecnico_agendado_id);

-- ============================================================================
-- 2. ADICIONAR CAMPOS NA TABELA AGENDAMENTOS
-- ============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'agendamentos' AND column_name = 'unidade_id'
  ) THEN
    ALTER TABLE agendamentos ADD COLUMN unidade_id uuid REFERENCES unidades(id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'agendamentos' AND column_name = 'gi_postado'
  ) THEN
    ALTER TABLE agendamentos ADD COLUMN gi_postado boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'agendamentos' AND column_name = 'peca_confirmada_usada'
  ) THEN
    ALTER TABLE agendamentos ADD COLUMN peca_confirmada_usada boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'agendamentos' AND column_name = 'checkout_observacoes'
  ) THEN
    ALTER TABLE agendamentos ADD COLUMN checkout_observacoes text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'agendamentos' AND column_name = 'checkout_checklist_completo'
  ) THEN
    ALTER TABLE agendamentos ADD COLUMN checkout_checklist_completo boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'agendamentos' AND column_name = 'ordem_sugerida'
  ) THEN
    ALTER TABLE agendamentos ADD COLUMN ordem_sugerida integer;
    COMMENT ON COLUMN agendamentos.ordem_sugerida IS 'Ordem otimizada pelo algoritmo de rotas - campo preparatório';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'agendamentos' AND column_name = 'distancia_estimada'
  ) THEN
    ALTER TABLE agendamentos ADD COLUMN distancia_estimada decimal(10,2);
    COMMENT ON COLUMN agendamentos.distancia_estimada IS 'Distância em km - usado para otimização de rotas';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'agendamentos' AND column_name = 'checkout_pendente'
  ) THEN
    ALTER TABLE agendamentos ADD COLUMN checkout_pendente boolean DEFAULT false;
    COMMENT ON COLUMN agendamentos.checkout_pendente IS 'True quando técnico fez checkout mas OS não foi movida no Kanban';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agendamentos_tecnico_data ON agendamentos(tecnico_id, data_agendamento);
CREATE INDEX IF NOT EXISTS idx_agendamentos_status ON agendamentos(status);
CREATE INDEX IF NOT EXISTS idx_agendamentos_unidade ON agendamentos(unidade_id);
CREATE INDEX IF NOT EXISTS idx_agendamentos_checkout_pendente ON agendamentos(checkout_pendente) WHERE checkout_pendente = true;

-- ============================================================================
-- 3. ADICIONAR CAMPOS NA TABELA USUARIOS (Para futura otimização)
-- ============================================================================

DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'usuarios' AND column_name = 'horario_inicio_expediente'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN horario_inicio_expediente time DEFAULT '08:00:00';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'usuarios' AND column_name = 'horario_fim_expediente'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN horario_fim_expediente time DEFAULT '18:00:00';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'usuarios' AND column_name = 'duracao_almoco_minutos'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN duracao_almoco_minutos integer DEFAULT 60;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'usuarios' AND column_name = 'horario_almoco_inicio'
  ) THEN
    ALTER TABLE usuarios ADD COLUMN horario_almoco_inicio time DEFAULT '12:00:00';
  END IF;
END $$;

COMMENT ON COLUMN usuarios.horario_inicio_expediente IS 'Horário de início do expediente - usado para otimizador de rotas';
COMMENT ON COLUMN usuarios.horario_fim_expediente IS 'Horário de fim do expediente - usado para otimizador de rotas';
COMMENT ON COLUMN usuarios.duracao_almoco_minutos IS 'Duração do almoço em minutos - usado para otimizador de rotas';

-- ============================================================================
-- 4. CRIAR TABELA DE TEMPLATES DE CHECKLIST
-- ============================================================================

CREATE TABLE IF NOT EXISTS checklist_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  descricao text,
  unidade_id uuid REFERENCES unidades(id),
  tipo_servico text NOT NULL DEFAULT 'geral' CHECK (tipo_servico IN ('IH', 'CI', 'geral', 'instalacao', 'manutencao')),
  itens jsonb NOT NULL DEFAULT '[]',
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE checklist_templates ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE checklist_templates IS 'Templates de checklists configuráveis para diferentes tipos de serviço';
COMMENT ON COLUMN checklist_templates.itens IS 'Array JSON com itens do checklist: [{ordem: 1, texto: "Item", tipo_resposta: "checkbox|texto|ambos"}]';
COMMENT ON COLUMN checklist_templates.unidade_id IS 'NULL = template global, UUID = template específico da unidade';

CREATE INDEX IF NOT EXISTS idx_checklist_templates_unidade ON checklist_templates(unidade_id);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_tipo ON checklist_templates(tipo_servico);
CREATE INDEX IF NOT EXISTS idx_checklist_templates_ativo ON checklist_templates(ativo) WHERE ativo = true;

-- ============================================================================
-- 5. CRIAR TABELA DE RESPOSTAS DE CHECKLIST
-- ============================================================================

CREATE TABLE IF NOT EXISTS agendamento_checklist_respostas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid REFERENCES agendamentos(id) ON DELETE CASCADE NOT NULL,
  checkin_checkout_id uuid REFERENCES agendamentos_checkin_checkout(id) ON DELETE CASCADE,
  template_id uuid REFERENCES checklist_templates(id),
  item_ordem integer NOT NULL,
  item_texto text NOT NULL,
  tipo_resposta text NOT NULL CHECK (tipo_resposta IN ('checkbox', 'texto', 'ambos')),
  resposta_checkbox boolean,
  resposta_texto text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE agendamento_checklist_respostas ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE agendamento_checklist_respostas IS 'Respostas dos checklists preenchidos pelos técnicos durante checkout';

CREATE INDEX IF NOT EXISTS idx_checklist_respostas_agendamento ON agendamento_checklist_respostas(agendamento_id);
CREATE INDEX IF NOT EXISTS idx_checklist_respostas_checkout ON agendamento_checklist_respostas(checkin_checkout_id);
CREATE INDEX IF NOT EXISTS idx_checklist_respostas_template ON agendamento_checklist_respostas(template_id);

-- ============================================================================
-- 6. POLÍTICAS RLS - CHECKLIST TEMPLATES
-- ============================================================================

CREATE POLICY "Usuários podem ver templates globais e de sua unidade"
  ON checklist_templates FOR SELECT
  TO authenticated
  USING (
    ativo = true AND (
      unidade_id IS NULL 
      OR EXISTS (
        SELECT 1 FROM get_current_user_info() cui
        WHERE cui.user_tipo = 'master'
           OR cui.user_unidade_id = checklist_templates.unidade_id
      )
    )
  );

CREATE POLICY "Masters e gerentes podem criar templates"
  ON checklist_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM get_current_user_info() cui
      WHERE cui.user_tipo IN ('master', 'gerente', 'administrador')
    )
  );

CREATE POLICY "Masters e gerentes podem atualizar templates"
  ON checklist_templates FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_current_user_info() cui
      WHERE cui.user_tipo = 'master'
         OR (cui.user_tipo IN ('gerente', 'administrador') AND cui.user_unidade_id = checklist_templates.unidade_id)
    )
  );

CREATE POLICY "Masters podem deletar templates"
  ON checklist_templates FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_current_user_info() cui
      WHERE cui.user_tipo = 'master'
    )
  );

-- ============================================================================
-- 7. POLÍTICAS RLS - CHECKLIST RESPOSTAS
-- ============================================================================

CREATE POLICY "Usuários podem ver respostas de agendamentos acessíveis"
  ON agendamento_checklist_respostas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agendamentos a
      JOIN get_current_user_info() cui ON true
      WHERE a.id = agendamento_checklist_respostas.agendamento_id
        AND (
          cui.user_tipo = 'master'
          OR a.unidade_id = cui.user_unidade_id
          OR a.tecnico_id = auth.uid()
        )
    )
  );

CREATE POLICY "Técnicos podem inserir respostas em seus agendamentos"
  ON agendamento_checklist_respostas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agendamentos a
      WHERE a.id = agendamento_checklist_respostas.agendamento_id
        AND a.tecnico_id = auth.uid()
    )
  );

CREATE POLICY "Técnicos podem atualizar suas respostas"
  ON agendamento_checklist_respostas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agendamentos a
      WHERE a.id = agendamento_checklist_respostas.agendamento_id
        AND a.tecnico_id = auth.uid()
    )
  );

-- ============================================================================
-- 8. ATUALIZAR POLÍTICAS EXISTENTES DE AGENDAMENTOS
-- ============================================================================

DROP POLICY IF EXISTS "Técnicos podem ver seus agendamentos" ON agendamentos;
DROP POLICY IF EXISTS "Operacional pode ver agendamentos de sua unidade" ON agendamentos;

CREATE POLICY "Usuários podem ver agendamentos baseado em permissão"
  ON agendamentos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_current_user_info() cui
      WHERE cui.user_tipo = 'master'
         OR unidade_id = cui.user_unidade_id
         OR tecnico_id = auth.uid()
    )
  );

CREATE POLICY "Operacional e gerentes podem criar agendamentos"
  ON agendamentos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM get_current_user_info() cui
      WHERE cui.user_tipo IN ('master', 'gerente', 'administrador', 'recepcao')
        AND (cui.user_tipo = 'master' OR cui.user_unidade_id = agendamentos.unidade_id)
    )
  );

CREATE POLICY "Operacional, gerentes e técnicos podem atualizar agendamentos"
  ON agendamentos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_current_user_info() cui
      WHERE cui.user_tipo = 'master'
         OR (cui.user_tipo IN ('gerente', 'administrador', 'recepcao') AND cui.user_unidade_id = agendamentos.unidade_id)
         OR (cui.user_tipo = 'tecnico' AND agendamentos.tecnico_id = auth.uid())
    )
  );

-- ============================================================================
-- 9. FUNÇÃO AUXILIAR PARA VALIDAR AGENDAMENTO EM ROTAS
-- ============================================================================

CREATE OR REPLACE FUNCTION validar_agendamento_rota()
RETURNS TRIGGER AS $$
BEGIN
  -- Se a OS está sendo movida para uma coluna de rota
  IF NEW.coluna_kanban LIKE 'rota_%' THEN
    -- Validar que tem data, técnico e confirmação
    IF NEW.data_agendamento IS NULL OR NEW.tecnico_agendado_id IS NULL THEN
      RAISE EXCEPTION 'OS em rota deve ter data de agendamento e técnico designado';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_validar_agendamento_rota ON os;
CREATE TRIGGER trigger_validar_agendamento_rota
  BEFORE UPDATE ON os
  FOR EACH ROW
  WHEN (OLD.coluna_kanban IS DISTINCT FROM NEW.coluna_kanban)
  EXECUTE FUNCTION validar_agendamento_rota();

-- ============================================================================
-- 10. FUNÇÃO PARA CRIAR AGENDAMENTO AUTOMATICAMENTE
-- ============================================================================

CREATE OR REPLACE FUNCTION criar_agendamento_automatico()
RETURNS TRIGGER AS $$
DECLARE
  v_rota_id uuid;
BEGIN
  -- Se a OS foi movida para uma coluna de rota e tem os dados necessários
  IF NEW.coluna_kanban LIKE 'rota_%' 
     AND NEW.data_agendamento IS NOT NULL 
     AND NEW.tecnico_agendado_id IS NOT NULL
     AND (OLD.coluna_kanban IS NULL OR OLD.coluna_kanban NOT LIKE 'rota_%') THEN
    
    -- Buscar rota_id baseado na coluna_kanban
    SELECT id INTO v_rota_id
    FROM rotas
    WHERE coluna_kanban = NEW.coluna_kanban
    LIMIT 1;
    
    -- Criar agendamento se não existir um ativo
    IF NOT EXISTS (
      SELECT 1 FROM agendamentos 
      WHERE os_id = NEW.id 
        AND status NOT IN ('cancelado', 'concluido')
    ) THEN
      INSERT INTO agendamentos (
        os_id,
        tecnico_id,
        unidade_id,
        rota_id,
        data_agendamento,
        horario_inicio,
        horario_fim,
        confirmado_com_cliente,
        agendado_por,
        status
      ) VALUES (
        NEW.id,
        NEW.tecnico_agendado_id,
        NEW.unidade_id,
        v_rota_id,
        NEW.data_agendamento,
        '08:00:00',
        '18:00:00',
        NEW.confirmado_com_cliente,
        auth.uid(),
        CASE WHEN NEW.confirmado_com_cliente THEN 'confirmado' ELSE 'pendente_confirmacao' END
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_criar_agendamento_automatico ON os;
CREATE TRIGGER trigger_criar_agendamento_automatico
  AFTER UPDATE ON os
  FOR EACH ROW
  WHEN (OLD.coluna_kanban IS DISTINCT FROM NEW.coluna_kanban)
  EXECUTE FUNCTION criar_agendamento_automatico();

COMMENT ON FUNCTION criar_agendamento_automatico IS 'Cria automaticamente um agendamento quando OS é movida para coluna de rota';

-- ============================================================================
-- 11. VIEWS ÚTEIS PARA DASHBOARD
-- ============================================================================

CREATE OR REPLACE VIEW v_agendamentos_hoje AS
SELECT 
  a.*,
  o.numero_os_samsung,
  o.numero_os_interna,
  o.cliente_nome,
  o.cliente_telefone,
  o.cliente_endereco,
  o.cliente_bairro,
  o.cliente_cidade,
  o.cliente_estado,
  o.cliente_cep,
  o.tipo_atendimento,
  o.coluna_kanban as rota_coluna,
  u.nome as tecnico_nome,
  u.email as tecnico_email,
  un.nome as unidade_nome,
  (SELECT COUNT(*) FROM requisicoes_pecas WHERE os_id = o.id AND status != 'reprovada') as tem_pecas,
  (SELECT COUNT(*) FROM agendamentos_checkin_checkout WHERE agendamento_id = a.id AND tipo = 'checkin') as tem_checkin,
  (SELECT COUNT(*) FROM agendamentos_checkin_checkout WHERE agendamento_id = a.id AND tipo = 'checkout') as tem_checkout
FROM agendamentos a
JOIN os o ON o.id = a.os_id
JOIN usuarios u ON u.id = a.tecnico_id
JOIN unidades un ON un.id = a.unidade_id
WHERE a.data_agendamento = CURRENT_DATE
  AND a.status NOT IN ('cancelado', 'concluido')
ORDER BY a.horario_inicio;

COMMENT ON VIEW v_agendamentos_hoje IS 'View otimizada para exibir agendamentos do dia com todas as informações necessárias';
