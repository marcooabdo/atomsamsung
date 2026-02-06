/*
  # Enhance WhatsApp Infrastructure

  1. Modified Tables
    - `whatsapp_templates` - add slug, categoria, variaveis, unidade_id, updated_at columns
    - `whatsapp_envios` - add dry_run column

  2. Security
    - Ensure RLS enabled on both tables
    - Add policies if missing

  3. Default Templates
    - Seed 6 default message templates
*/

-- Add missing columns to whatsapp_templates
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_templates' AND column_name = 'slug') THEN
    ALTER TABLE whatsapp_templates ADD COLUMN slug text NOT NULL DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_templates' AND column_name = 'categoria') THEN
    ALTER TABLE whatsapp_templates ADD COLUMN categoria text NOT NULL DEFAULT 'geral';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_templates' AND column_name = 'variaveis') THEN
    ALTER TABLE whatsapp_templates ADD COLUMN variaveis text[] DEFAULT '{}';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_templates' AND column_name = 'unidade_id') THEN
    ALTER TABLE whatsapp_templates ADD COLUMN unidade_id uuid REFERENCES unidades(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_templates' AND column_name = 'updated_at') THEN
    ALTER TABLE whatsapp_templates ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Add dry_run to whatsapp_envios
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'whatsapp_envios' AND column_name = 'dry_run') THEN
    ALTER TABLE whatsapp_envios ADD COLUMN dry_run boolean DEFAULT true;
  END IF;
END $$;

-- Ensure RLS
ALTER TABLE whatsapp_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_envios ENABLE ROW LEVEL SECURITY;

-- Templates policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_templates' AND policyname = 'Authenticated users can read wpp templates') THEN
    CREATE POLICY "Authenticated users can read wpp templates"
      ON whatsapp_templates FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM usuarios u
          WHERE u.id = auth.uid()
          AND (u.tipo IN ('master', 'diretoria') OR u.unidade_id IS NULL OR whatsapp_templates.unidade_id IS NULL OR u.unidade_id = whatsapp_templates.unidade_id)
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_templates' AND policyname = 'Manager can insert wpp templates') THEN
    CREATE POLICY "Manager can insert wpp templates"
      ON whatsapp_templates FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.tipo IN ('master', 'diretoria', 'gerente')));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_templates' AND policyname = 'Manager can update wpp templates') THEN
    CREATE POLICY "Manager can update wpp templates"
      ON whatsapp_templates FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.tipo IN ('master', 'diretoria', 'gerente')))
      WITH CHECK (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.tipo IN ('master', 'diretoria', 'gerente')));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_templates' AND policyname = 'Master can delete wpp templates') THEN
    CREATE POLICY "Master can delete wpp templates"
      ON whatsapp_templates FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.tipo IN ('master', 'diretoria')));
  END IF;
END $$;

-- Envios policies
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_envios' AND policyname = 'Users can read wpp send logs') THEN
    CREATE POLICY "Users can read wpp send logs"
      ON whatsapp_envios FOR SELECT TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM usuarios u
          WHERE u.id = auth.uid()
          AND (u.tipo IN ('master', 'diretoria') OR u.unidade_id IS NULL OR u.unidade_id = whatsapp_envios.unidade_id)
        )
      );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_envios' AND policyname = 'Authenticated users can insert wpp logs') THEN
    CREATE POLICY "Authenticated users can insert wpp logs"
      ON whatsapp_envios FOR INSERT TO authenticated
      WITH CHECK (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid()));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_envios' AND policyname = 'Master can update wpp logs') THEN
    CREATE POLICY "Master can update wpp logs"
      ON whatsapp_envios FOR UPDATE TO authenticated
      USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.tipo IN ('master', 'diretoria')))
      WITH CHECK (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.tipo IN ('master', 'diretoria')));
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'whatsapp_envios' AND policyname = 'Master can delete wpp logs') THEN
    CREATE POLICY "Master can delete wpp logs"
      ON whatsapp_envios FOR DELETE TO authenticated
      USING (EXISTS (SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.tipo IN ('master', 'diretoria')));
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_whatsapp_envios_os ON whatsapp_envios(os_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_envios_status ON whatsapp_envios(status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_envios_created ON whatsapp_envios(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_envios_unidade ON whatsapp_envios(unidade_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_categoria ON whatsapp_templates(categoria);

-- Seed default templates (only if table is empty)
INSERT INTO whatsapp_templates (nome, slug, categoria, conteudo, variaveis)
SELECT t.nome, t.slug, t.categoria, t.conteudo, t.variaveis
FROM (VALUES
  ('Agendamento Confirmado'::text, 'agendamento_confirmado'::text, 'agendamento'::text,
   'Ola {{cliente_nome}}! Seu atendimento tecnico foi agendado para {{data_agendamento}} no periodo da {{periodo}}. OS: {{numero_os}}. Qualquer duvida, entre em contato. Obrigado!'::text,
   ARRAY['cliente_nome', 'data_agendamento', 'periodo', 'numero_os']),
  ('Orcamento Enviado', 'orcamento_enviado', 'orcamento',
   'Ola {{cliente_nome}}! O orcamento da sua OS {{numero_os}} esta pronto: R$ {{valor_total}}. Responda APROVAR para autorizar o servico ou RECUSAR para declinar. Valido por 7 dias.',
   ARRAY['cliente_nome', 'numero_os', 'valor_total']),
  ('Orcamento Aprovado', 'orcamento_aprovado', 'orcamento',
   'Ola {{cliente_nome}}! Recebemos a aprovacao do orcamento da OS {{numero_os}}. Ja estamos providenciando as pecas e o reparo. Previsao: {{previsao_conclusao}}. Obrigado!',
   ARRAY['cliente_nome', 'numero_os', 'previsao_conclusao']),
  ('OS Concluida', 'os_concluida', 'conclusao',
   'Ola {{cliente_nome}}! Seu equipamento {{equipamento}} (OS {{numero_os}}) esta pronto para retirada! Horario de funcionamento: seg-sex 9h-18h. Valor: R$ {{valor_total}}.',
   ARRAY['cliente_nome', 'equipamento', 'numero_os', 'valor_total']),
  ('Lembrete Agendamento', 'lembrete_agendamento', 'agendamento',
   'Ola {{cliente_nome}}! Lembrando que seu atendimento tecnico esta agendado para amanha ({{data_agendamento}}), periodo da {{periodo}}. OS: {{numero_os}}. Ate la!',
   ARRAY['cliente_nome', 'data_agendamento', 'periodo', 'numero_os']),
  ('Pecas Chegaram', 'pecas_chegaram', 'pecas',
   'Ola {{cliente_nome}}! As pecas para o reparo do seu {{equipamento}} (OS {{numero_os}}) chegaram. Estamos dando andamento ao servico. Previsao: {{previsao_conclusao}}.',
   ARRAY['cliente_nome', 'equipamento', 'numero_os', 'previsao_conclusao'])
) AS t(nome, slug, categoria, conteudo, variaveis)
WHERE NOT EXISTS (SELECT 1 FROM whatsapp_templates WHERE slug IS NOT NULL AND slug != '' LIMIT 1);
