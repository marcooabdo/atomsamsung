/*
  # Route Planner Enhancements - Sistema Completo

  1. Campos Adicionais
    - agendamentos: auto_moved_kanban, pdf_url
    - requisicoes_pecas: gi_foto_url, gi_descricao, gi_postado_em

  2. Tabela de Métricas
    - route_metrics: Para dashboard de performance

  3. Triggers Automáticos
    - Mover OS automaticamente no Kanban após checkout

  4. Views para Dashboard
    - v_route_metrics_daily: Métricas diárias por técnico
    - v_route_metrics_technician: Performance por técnico
*/

-- ============================================================================
-- 1. ADICIONAR CAMPOS NA TABELA AGENDAMENTOS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agendamentos' AND column_name = 'auto_moved_kanban'
  ) THEN
    ALTER TABLE agendamentos ADD COLUMN auto_moved_kanban boolean DEFAULT false;
    COMMENT ON COLUMN agendamentos.auto_moved_kanban IS 'True quando a OS foi movida automaticamente no Kanban após checkout';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agendamentos' AND column_name = 'pdf_url'
  ) THEN
    ALTER TABLE agendamentos ADD COLUMN pdf_url text;
    COMMENT ON COLUMN agendamentos.pdf_url IS 'URL do PDF completo do atendimento gerado após checkout';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agendamentos' AND column_name = 'tempo_atendimento_minutos'
  ) THEN
    ALTER TABLE agendamentos ADD COLUMN tempo_atendimento_minutos integer;
    COMMENT ON COLUMN agendamentos.tempo_atendimento_minutos IS 'Tempo total de atendimento calculado entre checkin e checkout';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'agendamentos' AND column_name = 'distancia_percorrida_km'
  ) THEN
    ALTER TABLE agendamentos ADD COLUMN distancia_percorrida_km decimal(10,2);
    COMMENT ON COLUMN agendamentos.distancia_percorrida_km IS 'Distância real percorrida até o local';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_agendamentos_auto_moved ON agendamentos(auto_moved_kanban) WHERE auto_moved_kanban = false;

-- ============================================================================
-- 2. ADICIONAR CAMPOS PARA GI EM REQUISICOES_PECAS
-- ============================================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requisicoes_pecas' AND column_name = 'gi_foto_url'
  ) THEN
    ALTER TABLE requisicoes_pecas ADD COLUMN gi_foto_url text;
    COMMENT ON COLUMN requisicoes_pecas.gi_foto_url IS 'URL da foto da peça defeituosa para GI';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requisicoes_pecas' AND column_name = 'gi_descricao'
  ) THEN
    ALTER TABLE requisicoes_pecas ADD COLUMN gi_descricao text;
    COMMENT ON COLUMN requisicoes_pecas.gi_descricao IS 'Descrição do problema para GI (Garantia Interna)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requisicoes_pecas' AND column_name = 'gi_postado_em'
  ) THEN
    ALTER TABLE requisicoes_pecas ADD COLUMN gi_postado_em timestamptz;
    COMMENT ON COLUMN requisicoes_pecas.gi_postado_em IS 'Data/hora em que o GI foi postado pelo técnico';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'requisicoes_pecas' AND column_name = 'gi_postado_por'
  ) THEN
    ALTER TABLE requisicoes_pecas ADD COLUMN gi_postado_por uuid REFERENCES usuarios(id);
    COMMENT ON COLUMN requisicoes_pecas.gi_postado_por IS 'Técnico que postou o GI';
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_requisicoes_gi_postado ON requisicoes_pecas(gi_postado_em) WHERE gi_postado_em IS NOT NULL;

-- ============================================================================
-- 3. CRIAR TABELA DE MÉTRICAS DE ROTAS
-- ============================================================================

CREATE TABLE IF NOT EXISTS route_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tecnico_id uuid REFERENCES usuarios(id) ON DELETE CASCADE NOT NULL,
  unidade_id uuid REFERENCES unidades(id) ON DELETE CASCADE NOT NULL,
  data date NOT NULL,
  total_os_atendidas integer DEFAULT 0,
  total_os_concluidas integer DEFAULT 0,
  tempo_medio_atendimento_minutos integer,
  distancia_total_km decimal(10,2) DEFAULT 0,
  distancia_otimizada_km decimal(10,2),
  eficiencia_rota decimal(5,2),
  os_no_prazo integer DEFAULT 0,
  os_atrasadas integer DEFAULT 0,
  primeira_os_hora time,
  ultima_os_hora time,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(tecnico_id, unidade_id, data)
);

ALTER TABLE route_metrics ENABLE ROW LEVEL SECURITY;

COMMENT ON TABLE route_metrics IS 'Métricas agregadas de performance de rotas por técnico e dia';
COMMENT ON COLUMN route_metrics.eficiencia_rota IS 'Percentual de eficiência: (distancia_otimizada / distancia_real) * 100';

CREATE INDEX IF NOT EXISTS idx_route_metrics_tecnico ON route_metrics(tecnico_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_route_metrics_unidade ON route_metrics(unidade_id, data DESC);
CREATE INDEX IF NOT EXISTS idx_route_metrics_data ON route_metrics(data DESC);

-- RLS para route_metrics
CREATE POLICY "Usuários podem ver métricas de sua unidade"
  ON route_metrics FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_current_user_info() cui
      WHERE cui.user_tipo = 'master'
         OR cui.user_unidade_id = route_metrics.unidade_id
         OR route_metrics.tecnico_id = auth.uid()
    )
  );

CREATE POLICY "Sistema pode inserir/atualizar métricas"
  ON route_metrics FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM get_current_user_info() cui
      WHERE cui.user_tipo IN ('master', 'gerente', 'administrador')
    )
  );

-- ============================================================================
-- 4. TRIGGER: MOVER OS NO KANBAN AUTOMATICAMENTE APÓS CHECKOUT
-- ============================================================================

CREATE OR REPLACE FUNCTION mover_os_kanban_apos_checkout()
RETURNS TRIGGER AS $$
DECLARE
  v_os_id uuid;
BEGIN
  -- Quando checkout_pendente muda de true para false (operacional aprovou movimento)
  IF OLD.checkout_pendente = true AND NEW.checkout_pendente = false AND NEW.status = 'concluido' THEN
    -- Buscar OS vinculada
    SELECT os_id INTO v_os_id FROM agendamentos WHERE id = NEW.id;

    IF v_os_id IS NOT NULL THEN
      -- Mover OS para coluna "fechar_os"
      UPDATE os
      SET coluna_kanban = 'fechar_os',
          updated_at = now()
      WHERE id = v_os_id;

      -- Marcar que foi movido automaticamente
      NEW.auto_moved_kanban := true;

      -- Adicionar comentário no sistema
      INSERT INTO os_comentarios (os_id, usuario_id, comentario, is_system)
      VALUES (
        v_os_id,
        auth.uid(),
        'OS movida automaticamente para "Fechar OS" após conclusão do atendimento',
        true
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_mover_os_kanban_apos_checkout ON agendamentos;
CREATE TRIGGER trigger_mover_os_kanban_apos_checkout
  BEFORE UPDATE ON agendamentos
  FOR EACH ROW
  WHEN (OLD.checkout_pendente IS DISTINCT FROM NEW.checkout_pendente)
  EXECUTE FUNCTION mover_os_kanban_apos_checkout();

COMMENT ON FUNCTION mover_os_kanban_apos_checkout IS 'Move automaticamente a OS para coluna fechar_os quando checkout é aprovado';

-- ============================================================================
-- 5. FUNCTION: CALCULAR TEMPO DE ATENDIMENTO
-- ============================================================================

CREATE OR REPLACE FUNCTION calcular_tempo_atendimento()
RETURNS TRIGGER AS $$
DECLARE
  v_checkin_time timestamptz;
  v_checkout_time timestamptz;
  v_tempo_minutos integer;
BEGIN
  -- Quando agendamento é concluído, calcular tempo
  IF NEW.status = 'concluido' AND OLD.status != 'concluido' THEN
    -- Buscar horários de checkin e checkout
    SELECT data_hora INTO v_checkin_time
    FROM agendamentos_checkin_checkout
    WHERE agendamento_id = NEW.id AND tipo = 'checkin'
    ORDER BY data_hora DESC
    LIMIT 1;

    SELECT data_hora INTO v_checkout_time
    FROM agendamentos_checkin_checkout
    WHERE agendamento_id = NEW.id AND tipo = 'checkout'
    ORDER BY data_hora DESC
    LIMIT 1;

    -- Calcular diferença em minutos
    IF v_checkin_time IS NOT NULL AND v_checkout_time IS NOT NULL THEN
      v_tempo_minutos := EXTRACT(EPOCH FROM (v_checkout_time - v_checkin_time)) / 60;
      NEW.tempo_atendimento_minutos := v_tempo_minutos;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_calcular_tempo_atendimento ON agendamentos;
CREATE TRIGGER trigger_calcular_tempo_atendimento
  BEFORE UPDATE ON agendamentos
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION calcular_tempo_atendimento();

-- ============================================================================
-- 6. FUNCTION: ATUALIZAR MÉTRICAS DIÁRIAS
-- ============================================================================

CREATE OR REPLACE FUNCTION atualizar_metricas_diarias()
RETURNS TRIGGER AS $$
DECLARE
  v_data date;
  v_tecnico_id uuid;
  v_unidade_id uuid;
BEGIN
  v_data := COALESCE(NEW.data_agendamento, OLD.data_agendamento, CURRENT_DATE);
  v_tecnico_id := COALESCE(NEW.tecnico_id, OLD.tecnico_id);
  v_unidade_id := COALESCE(NEW.unidade_id, OLD.unidade_id);

  -- Inserir ou atualizar métricas
  INSERT INTO route_metrics (tecnico_id, unidade_id, data, total_os_atendidas, total_os_concluidas)
  VALUES (v_tecnico_id, v_unidade_id, v_data, 0, 0)
  ON CONFLICT (tecnico_id, unidade_id, data) DO NOTHING;

  -- Recalcular métricas
  UPDATE route_metrics rm
  SET
    total_os_atendidas = (
      SELECT COUNT(*) FROM agendamentos a
      WHERE a.tecnico_id = rm.tecnico_id
        AND a.data_agendamento = rm.data
        AND a.status != 'cancelado'
    ),
    total_os_concluidas = (
      SELECT COUNT(*) FROM agendamentos a
      WHERE a.tecnico_id = rm.tecnico_id
        AND a.data_agendamento = rm.data
        AND a.status = 'concluido'
    ),
    tempo_medio_atendimento_minutos = (
      SELECT AVG(tempo_atendimento_minutos)::integer
      FROM agendamentos a
      WHERE a.tecnico_id = rm.tecnico_id
        AND a.data_agendamento = rm.data
        AND tempo_atendimento_minutos IS NOT NULL
    ),
    distancia_total_km = (
      SELECT SUM(distancia_percorrida_km)
      FROM agendamentos a
      WHERE a.tecnico_id = rm.tecnico_id
        AND a.data_agendamento = rm.data
        AND distancia_percorrida_km IS NOT NULL
    ),
    updated_at = now()
  WHERE rm.tecnico_id = v_tecnico_id
    AND rm.unidade_id = v_unidade_id
    AND rm.data = v_data;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_atualizar_metricas_diarias ON agendamentos;
CREATE TRIGGER trigger_atualizar_metricas_diarias
  AFTER INSERT OR UPDATE OR DELETE ON agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_metricas_diarias();

-- ============================================================================
-- 7. VIEW: MÉTRICAS DIÁRIAS POR TÉCNICO
-- ============================================================================

CREATE OR REPLACE VIEW v_route_metrics_daily AS
SELECT
  rm.*,
  u.nome as tecnico_nome,
  u.email as tecnico_email,
  un.nome as unidade_nome,
  ROUND((rm.total_os_concluidas::decimal / NULLIF(rm.total_os_atendidas, 0)) * 100, 2) as taxa_conclusao,
  CASE
    WHEN rm.distancia_otimizada_km > 0 AND rm.distancia_total_km > 0
    THEN ROUND((rm.distancia_otimizada_km / rm.distancia_total_km) * 100, 2)
    ELSE NULL
  END as eficiencia_percentual
FROM route_metrics rm
JOIN usuarios u ON u.id = rm.tecnico_id
JOIN unidades un ON un.id = rm.unidade_id
ORDER BY rm.data DESC, rm.total_os_concluidas DESC;

COMMENT ON VIEW v_route_metrics_daily IS 'Métricas diárias com cálculos de taxa de conclusão e eficiência';

-- ============================================================================
-- 8. VIEW: PERFORMANCE GERAL POR TÉCNICO (ÚLTIMOS 30 DIAS)
-- ============================================================================

CREATE OR REPLACE VIEW v_route_metrics_technician AS
SELECT
  u.id as tecnico_id,
  u.nome as tecnico_nome,
  u.unidade_id,
  un.nome as unidade_nome,
  COUNT(a.id) as total_atendimentos,
  COUNT(a.id) FILTER (WHERE a.status = 'concluido') as total_concluidos,
  ROUND(
    (COUNT(a.id) FILTER (WHERE a.status = 'concluido')::decimal / NULLIF(COUNT(a.id), 0)) * 100,
    2
  ) as taxa_conclusao,
  ROUND(AVG(a.tempo_atendimento_minutos), 0)::integer as tempo_medio_minutos,
  ROUND(SUM(a.distancia_percorrida_km), 2) as total_km_percorrido,
  MIN(a.data_agendamento) as primeira_os,
  MAX(a.data_agendamento) as ultima_os
FROM usuarios u
JOIN unidades un ON un.id = u.unidade_id
LEFT JOIN agendamentos a ON a.tecnico_id = u.id
  AND a.data_agendamento >= CURRENT_DATE - INTERVAL '30 days'
  AND a.status != 'cancelado'
WHERE u.tipo IN ('tecnico', 'tecnico_ih')
  AND u.ativo = true
GROUP BY u.id, u.nome, u.unidade_id, un.nome
ORDER BY total_concluidos DESC;

COMMENT ON VIEW v_route_metrics_technician IS 'Performance agregada por técnico nos últimos 30 dias';

-- ============================================================================
-- 9. VIEW: OS AGENDADAS POR STATUS VISUAL
-- ============================================================================

CREATE OR REPLACE VIEW v_agendamentos_com_status_visual AS
SELECT
  a.id,
  a.os_id,
  a.tecnico_id,
  a.unidade_id,
  a.rota_id,
  a.data_agendamento,
  a.horario_inicio,
  a.horario_fim,
  a.status,
  a.lat,
  a.lng,
  a.confirmado_com_cliente,
  a.observacao,
  a.created_at,
  a.updated_at,
  o.numero_os_samsung,
  o.numero_os_interna,
  o.cliente_nome,
  o.cliente_telefone,
  o.cliente_endereco,
  o.cliente_cep,
  o.cliente_bairro,
  o.cliente_cidade,
  o.cliente_estado,
  o.tipo_atendimento,
  o.coluna_kanban,
  o.confirmado_com_cliente as os_confirmado_cliente,
  u.nome as tecnico_nome,
  un.nome as unidade_nome,
  CASE
    WHEN a.status = 'concluido' THEN 'verde'
    WHEN a.status = 'em_andamento' THEN 'azul'
    WHEN a.status = 'confirmado' AND o.confirmado_com_cliente THEN 'roxo'
    WHEN a.status = 'confirmado' THEN 'amarelo'
    ELSE 'cinza'
  END as cor_status,
  CASE
    WHEN a.status = 'concluido' THEN 'Concluído'
    WHEN a.status = 'em_andamento' THEN 'Em Andamento'
    WHEN a.status = 'confirmado' AND o.confirmado_com_cliente THEN 'Agendado'
    WHEN a.status = 'confirmado' THEN 'Pendente Confirmação'
    ELSE 'Aguardando'
  END as label_status,
  EXISTS (
    SELECT 1 FROM agendamentos_checkin_checkout
    WHERE agendamento_id = a.id AND tipo = 'checkin'
  ) as tem_checkin,
  EXISTS (
    SELECT 1 FROM agendamentos_checkin_checkout
    WHERE agendamento_id = a.id AND tipo = 'checkout'
  ) as tem_checkout,
  (
    SELECT COUNT(*) FROM requisicoes_pecas
    WHERE os_id = o.id AND status IN ('atendida', 'em_uso', 'gi_postada')
  ) as pecas_ativas
FROM agendamentos a
JOIN os o ON o.id = a.os_id
JOIN usuarios u ON u.id = a.tecnico_id
JOIN unidades un ON un.id = a.unidade_id
WHERE a.status NOT IN ('cancelado');

COMMENT ON VIEW v_agendamentos_com_status_visual IS 'Agendamentos com cores e labels para exibição visual no mapa e calendário';
