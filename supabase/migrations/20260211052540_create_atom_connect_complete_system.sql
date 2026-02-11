/*
  # ATOM CONNECT - Sistema Completo de Atendimento WhatsApp

  1. Novas Tabelas
    - `atom_connect_instancias` - Instâncias WhatsApp por unidade (Evolution API)
    - `atom_connect_pipeline_colunas` - Colunas do Kanban
    - `atom_connect_conversas` - Conversas/Sessões de chat
    - `atom_connect_mensagens` - Histórico de mensagens
    - `atom_connect_fluxos` - Fluxos de automação do bot
    - `atom_connect_campanhas` - Campanhas de marketing
    - `atom_connect_campanha_contatos` - Contatos de cada campanha
    - `atom_connect_respostas_rapidas` - Respostas rápidas
    - `atom_connect_transferencias` - Log de transferências
    - `atom_connect_metricas_atendente` - Métricas diárias por atendente

  2. Security
    - Enable RLS on all tables
    - Policies for authenticated users based on unidade_id and tipo

  3. Realtime
    - Enable realtime for conversas and mensagens
*/

-- Tabela de Instâncias WhatsApp
CREATE TABLE IF NOT EXISTS atom_connect_instancias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid REFERENCES unidades(id) ON DELETE CASCADE,
  nome text NOT NULL,
  api_url text NOT NULL,
  api_key text NOT NULL,
  instance_name text NOT NULL,
  webhook_url text,
  status text NOT NULL DEFAULT 'disconnected' CHECK (status IN ('connected', 'disconnected', 'connecting')),
  qr_code text,
  phone_number text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(unidade_id, instance_name)
);

-- Tabela de Colunas do Pipeline
CREATE TABLE IF NOT EXISTS atom_connect_pipeline_colunas (
  id text PRIMARY KEY,
  nome text NOT NULL,
  cor text NOT NULL DEFAULT '#6B7280',
  icone text DEFAULT 'MessageSquare',
  ordem int NOT NULL DEFAULT 0,
  sla_minutos int,
  auto_move_to text,
  is_bot_column boolean DEFAULT false,
  is_final boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Inserir colunas padrão do pipeline
INSERT INTO atom_connect_pipeline_colunas (id, nome, cor, icone, ordem, sla_minutos, is_bot_column, is_final) VALUES
  ('bot_triagem', 'Robo / Triagem', '#8B5CF6', 'Bot', 0, NULL, true, false),
  ('fila_espera', 'Fila de Espera', '#EF4444', 'Clock', 1, 10, false, false),
  ('orcamento_negociacao', 'Orcamento / Negociacao', '#F59E0B', 'DollarSign', 2, 120, false, false),
  ('aguardando_peca', 'Aguardando Peca', '#3B82F6', 'Package', 3, NULL, false, false),
  ('em_bancada', 'Em Bancada', '#10B981', 'Wrench', 4, NULL, false, false),
  ('controle_qualidade', 'Controle de Qualidade', '#06B6D4', 'CheckCircle', 5, NULL, false, false),
  ('pronto_retirada', 'Pronto p/ Retirada', '#22C55E', 'MapPin', 6, NULL, false, false),
  ('finalizado_nps', 'Finalizado (NPS)', '#6B7280', 'Star', 7, NULL, false, true)
ON CONFLICT (id) DO NOTHING;

-- Tabela de Conversas
CREATE TABLE IF NOT EXISTS atom_connect_conversas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  instancia_id uuid REFERENCES atom_connect_instancias(id) ON DELETE SET NULL,
  cliente_telefone text NOT NULL,
  cliente_nome text,
  cliente_foto_url text,
  os_id uuid REFERENCES os(id) ON DELETE SET NULL,
  coluna_pipeline text NOT NULL DEFAULT 'bot_triagem' REFERENCES atom_connect_pipeline_colunas(id),
  atendente_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  ultima_mensagem text,
  ultima_mensagem_at timestamptz DEFAULT now(),
  ultima_resposta_cliente_at timestamptz,
  mensagens_nao_lidas int DEFAULT 0,
  is_bot_ativo boolean DEFAULT true,
  tipo_atendimento text DEFAULT 'balcao' CHECK (tipo_atendimento IN ('balcao', 'ih', 'venda')),
  agendamento_data date,
  agendamento_hora time,
  tecnico_ih_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  status_ih text CHECK (status_ih IN ('agendado', 'em_rota', 'no_local', 'finalizado', 'cancelado')),
  endereco_visita text,
  latitude decimal(10, 8),
  longitude decimal(11, 8),
  tags text[] DEFAULT '{}',
  prioridade text DEFAULT 'normal' CHECK (prioridade IN ('baixa', 'normal', 'alta', 'urgente')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_conversas_unidade ON atom_connect_conversas(unidade_id);
CREATE INDEX IF NOT EXISTS idx_conversas_telefone ON atom_connect_conversas(cliente_telefone);
CREATE INDEX IF NOT EXISTS idx_conversas_atendente ON atom_connect_conversas(atendente_id);
CREATE INDEX IF NOT EXISTS idx_conversas_coluna ON atom_connect_conversas(coluna_pipeline);
CREATE INDEX IF NOT EXISTS idx_conversas_ultima_msg ON atom_connect_conversas(ultima_mensagem_at DESC);

-- Tabela de Mensagens
CREATE TABLE IF NOT EXISTS atom_connect_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES atom_connect_conversas(id) ON DELETE CASCADE,
  message_id text,
  from_me boolean NOT NULL DEFAULT false,
  tipo text NOT NULL DEFAULT 'text' CHECK (tipo IN ('text', 'image', 'audio', 'video', 'document', 'sticker', 'location', 'contact', 'poll')),
  conteudo text,
  caption text,
  media_url text,
  media_mimetype text,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  enviado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  is_bot boolean DEFAULT false,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_mensagens_conversa ON atom_connect_mensagens(conversa_id);
CREATE INDEX IF NOT EXISTS idx_mensagens_created ON atom_connect_mensagens(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_mensagens_message_id ON atom_connect_mensagens(message_id);

-- Tabela de Fluxos de Automação
CREATE TABLE IF NOT EXISTS atom_connect_fluxos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid REFERENCES unidades(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  trigger_type text NOT NULL CHECK (trigger_type IN ('keyword', 'regex', 'webhook', 'manual', 'coluna_change')),
  trigger_value text,
  steps jsonb NOT NULL DEFAULT '[]',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Tabela de Campanhas de Marketing
CREATE TABLE IF NOT EXISTS atom_connect_campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  instancia_id uuid REFERENCES atom_connect_instancias(id) ON DELETE SET NULL,
  nome text NOT NULL,
  template_texto text NOT NULL,
  template_midia_url text,
  template_midia_tipo text CHECK (template_midia_tipo IN ('image', 'video', 'document')),
  delay_min int NOT NULL DEFAULT 30,
  delay_max int NOT NULL DEFAULT 60,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed', 'cancelled')),
  total_contatos int DEFAULT 0,
  enviados int DEFAULT 0,
  entregues int DEFAULT 0,
  lidos int DEFAULT 0,
  erros int DEFAULT 0,
  iniciado_em timestamptz,
  finalizado_em timestamptz,
  created_by uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Tabela de Contatos de Campanha
CREATE TABLE IF NOT EXISTS atom_connect_campanha_contatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campanha_id uuid NOT NULL REFERENCES atom_connect_campanhas(id) ON DELETE CASCADE,
  telefone text NOT NULL,
  nome text,
  variaveis jsonb DEFAULT '{}',
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'read', 'failed')),
  enviado_em timestamptz,
  erro_mensagem text
);

CREATE INDEX IF NOT EXISTS idx_campanha_contatos_campanha ON atom_connect_campanha_contatos(campanha_id);
CREATE INDEX IF NOT EXISTS idx_campanha_contatos_status ON atom_connect_campanha_contatos(status);

-- Tabela de Respostas Rápidas
CREATE TABLE IF NOT EXISTS atom_connect_respostas_rapidas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid REFERENCES unidades(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  atalho text NOT NULL,
  conteudo text NOT NULL,
  midia_url text,
  created_at timestamptz DEFAULT now()
);

-- Tabela de Transferências
CREATE TABLE IF NOT EXISTS atom_connect_transferencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversa_id uuid NOT NULL REFERENCES atom_connect_conversas(id) ON DELETE CASCADE,
  de_usuario_id uuid REFERENCES usuarios(id) ON DELETE SET NULL,
  para_usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  motivo text,
  created_at timestamptz DEFAULT now()
);

-- Tabela de Métricas por Atendente
CREATE TABLE IF NOT EXISTS atom_connect_metricas_atendente (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id uuid NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
  unidade_id uuid NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  data date NOT NULL DEFAULT CURRENT_DATE,
  total_atendimentos int DEFAULT 0,
  tempo_medio_resposta_segundos int DEFAULT 0,
  mensagens_enviadas int DEFAULT 0,
  conversas_finalizadas int DEFAULT 0,
  nps_medio decimal(3, 2),
  UNIQUE(usuario_id, unidade_id, data)
);

-- Enable RLS
ALTER TABLE atom_connect_instancias ENABLE ROW LEVEL SECURITY;
ALTER TABLE atom_connect_pipeline_colunas ENABLE ROW LEVEL SECURITY;
ALTER TABLE atom_connect_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE atom_connect_mensagens ENABLE ROW LEVEL SECURITY;
ALTER TABLE atom_connect_fluxos ENABLE ROW LEVEL SECURITY;
ALTER TABLE atom_connect_campanhas ENABLE ROW LEVEL SECURITY;
ALTER TABLE atom_connect_campanha_contatos ENABLE ROW LEVEL SECURITY;
ALTER TABLE atom_connect_respostas_rapidas ENABLE ROW LEVEL SECURITY;
ALTER TABLE atom_connect_transferencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE atom_connect_metricas_atendente ENABLE ROW LEVEL SECURITY;

-- Policies para atom_connect_instancias
CREATE POLICY "Users can view instances of their unit" ON atom_connect_instancias
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.unidade_id = atom_connect_instancias.unidade_id OR u.unidade_id IS NULL OR u.tipo = 'master')
    )
  );

CREATE POLICY "Admin users can manage instances" ON atom_connect_instancias
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.tipo IN ('master', 'administrador')
    )
  );

-- Pipeline colunas - todos podem ver
CREATE POLICY "Anyone can view pipeline columns" ON atom_connect_pipeline_colunas
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admin can manage pipeline columns" ON atom_connect_pipeline_colunas
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.tipo IN ('master', 'administrador')
    )
  );

-- Conversas policies
CREATE POLICY "Users can view conversations of their unit" ON atom_connect_conversas
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.unidade_id = atom_connect_conversas.unidade_id OR u.unidade_id IS NULL OR u.tipo = 'master')
    )
  );

CREATE POLICY "Users can insert conversations" ON atom_connect_conversas
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.unidade_id = atom_connect_conversas.unidade_id OR u.unidade_id IS NULL OR u.tipo = 'master')
    )
  );

CREATE POLICY "Users can update conversations of their unit" ON atom_connect_conversas
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.unidade_id = atom_connect_conversas.unidade_id OR u.unidade_id IS NULL OR u.tipo = 'master')
    )
  );

-- Mensagens policies
CREATE POLICY "Users can view messages" ON atom_connect_mensagens
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM atom_connect_conversas c
      JOIN usuarios u ON u.id = auth.uid()
      WHERE c.id = atom_connect_mensagens.conversa_id
      AND (u.unidade_id = c.unidade_id OR u.unidade_id IS NULL OR u.tipo = 'master')
    )
  );

CREATE POLICY "Users can insert messages" ON atom_connect_mensagens
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM atom_connect_conversas c
      JOIN usuarios u ON u.id = auth.uid()
      WHERE c.id = atom_connect_mensagens.conversa_id
      AND (u.unidade_id = c.unidade_id OR u.unidade_id IS NULL OR u.tipo = 'master')
    )
  );

-- Fluxos policies
CREATE POLICY "Users can view flows" ON atom_connect_fluxos
  FOR SELECT TO authenticated
  USING (
    unidade_id IS NULL OR
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.unidade_id = atom_connect_fluxos.unidade_id OR u.unidade_id IS NULL OR u.tipo = 'master')
    )
  );

CREATE POLICY "Admin can manage flows" ON atom_connect_fluxos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.tipo IN ('master', 'administrador')
    )
  );

-- Campanhas policies
CREATE POLICY "Users can view campaigns of their unit" ON atom_connect_campanhas
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.unidade_id = atom_connect_campanhas.unidade_id OR u.unidade_id IS NULL OR u.tipo = 'master')
    )
  );

CREATE POLICY "Admin can manage campaigns" ON atom_connect_campanhas
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.tipo IN ('master', 'administrador', 'vendedor')
    )
  );

-- Contatos de campanha
CREATE POLICY "Users can view campaign contacts" ON atom_connect_campanha_contatos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM atom_connect_campanhas c
      JOIN usuarios u ON u.id = auth.uid()
      WHERE c.id = atom_connect_campanha_contatos.campanha_id
      AND (u.unidade_id = c.unidade_id OR u.unidade_id IS NULL OR u.tipo = 'master')
    )
  );

CREATE POLICY "Admin can manage campaign contacts" ON atom_connect_campanha_contatos
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM atom_connect_campanhas c
      JOIN usuarios u ON u.id = auth.uid()
      WHERE c.id = atom_connect_campanha_contatos.campanha_id
      AND u.tipo IN ('master', 'administrador', 'vendedor')
    )
  );

-- Respostas rápidas
CREATE POLICY "Users can view quick replies" ON atom_connect_respostas_rapidas
  FOR SELECT TO authenticated
  USING (
    unidade_id IS NULL OR
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.unidade_id = atom_connect_respostas_rapidas.unidade_id OR u.unidade_id IS NULL OR u.tipo = 'master')
    )
  );

CREATE POLICY "Admin can manage quick replies" ON atom_connect_respostas_rapidas
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.tipo IN ('master', 'administrador')
    )
  );

-- Transferências
CREATE POLICY "Users can view transfers" ON atom_connect_transferencias
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can create transfers" ON atom_connect_transferencias
  FOR INSERT TO authenticated WITH CHECK (true);

-- Métricas
CREATE POLICY "Users can view metrics" ON atom_connect_metricas_atendente
  FOR SELECT TO authenticated
  USING (
    usuario_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.tipo IN ('master', 'administrador', 'gerente')
    )
  );

CREATE POLICY "System can manage metrics" ON atom_connect_metricas_atendente
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND u.tipo IN ('master', 'administrador')
    )
  );

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION update_atom_connect_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_conversas_updated_at') THEN
    CREATE TRIGGER trigger_conversas_updated_at
      BEFORE UPDATE ON atom_connect_conversas
      FOR EACH ROW
      EXECUTE FUNCTION update_atom_connect_updated_at();
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_instancias_updated_at') THEN
    CREATE TRIGGER trigger_instancias_updated_at
      BEFORE UPDATE ON atom_connect_instancias
      FOR EACH ROW
      EXECUTE FUNCTION update_atom_connect_updated_at();
  END IF;
END $$;

-- Trigger para atualizar contadores na conversa quando mensagem é inserida
CREATE OR REPLACE FUNCTION update_conversa_on_new_message()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE atom_connect_conversas
  SET
    ultima_mensagem = LEFT(COALESCE(NEW.conteudo, NEW.caption, '[Midia]'), 100),
    ultima_mensagem_at = NEW.created_at,
    ultima_resposta_cliente_at = CASE WHEN NOT NEW.from_me THEN NEW.created_at ELSE ultima_resposta_cliente_at END,
    mensagens_nao_lidas = CASE WHEN NOT NEW.from_me THEN mensagens_nao_lidas + 1 ELSE mensagens_nao_lidas END,
    updated_at = now()
  WHERE id = NEW.conversa_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_update_conversa_on_message') THEN
    CREATE TRIGGER trigger_update_conversa_on_message
      AFTER INSERT ON atom_connect_mensagens
      FOR EACH ROW
      EXECUTE FUNCTION update_conversa_on_new_message();
  END IF;
END $$;

-- Habilitar Realtime nas tabelas principais
DO $$
BEGIN
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE atom_connect_conversas;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE atom_connect_mensagens;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE atom_connect_transferencias;
  EXCEPTION WHEN duplicate_object THEN
    NULL;
  END;
END $$;

-- Criar bucket para mídia do WhatsApp
INSERT INTO storage.buckets (id, name, public)
VALUES ('atom-connect-media', 'atom-connect-media', true)
ON CONFLICT (id) DO NOTHING;
