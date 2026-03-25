/*
  # OS Closure Validation System - Rules & Alerts

  1. New Tables
    - `regras_fechamento_os`
      - `id` (uuid, primary key)
      - `unidade_id` (uuid, FK to unidades - NULL = global rule)
      - `codigo` (text, unique rule identifier like 'GI_POSTADA', 'PRECO_PECAS', etc.)
      - `titulo` (text, display name)
      - `descricao` (text, detailed description)
      - `categoria` (text: 'pecas', 'financeiro', 'fiscal', 'operacional')
      - `severidade` (text: 'bloqueante', 'alerta')
      - `ativa` (boolean, default true)
      - `aplica_lp` (boolean, default true)
      - `aplica_ow` (boolean, default true)
      - `aplica_ih` (boolean, default true)
      - `aplica_ci` (boolean, default true)
      - `ordem` (integer, display order)
      - `created_at`, `updated_at` (timestamps)
    
    - `os_alertas_fechamento`
      - `id` (uuid, primary key)
      - `os_id` (uuid, FK to os)
      - `unidade_id` (uuid, FK to unidades)
      - `regra_codigo` (text, the rule code that was violated)
      - `regra_titulo` (text, cached rule title)
      - `categoria` (text: 'pecas', 'financeiro', 'fiscal', 'operacional')
      - `severidade` (text: 'bloqueante', 'alerta')
      - `mensagem` (text, detailed message about the violation)
      - `dados_contexto` (jsonb, contextual data for the alert)
      - `resolvido` (boolean, default false)
      - `resolvido_em` (timestamp)
      - `resolvido_por` (uuid, FK to usuarios)
      - `ignorado` (boolean, default false)
      - `ignorado_por` (uuid)
      - `ignorado_motivo` (text)
      - `created_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Policies for authenticated users based on unit membership

  3. Default Rules
    - Pre-populate with standard closure validation rules
*/

-- Create regras_fechamento_os table
CREATE TABLE IF NOT EXISTS regras_fechamento_os (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid REFERENCES unidades(id) ON DELETE CASCADE,
  codigo text NOT NULL,
  titulo text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  categoria text NOT NULL DEFAULT 'operacional' CHECK (categoria IN ('pecas', 'financeiro', 'fiscal', 'operacional')),
  severidade text NOT NULL DEFAULT 'bloqueante' CHECK (severidade IN ('bloqueante', 'alerta')),
  ativa boolean NOT NULL DEFAULT true,
  aplica_lp boolean NOT NULL DEFAULT true,
  aplica_ow boolean NOT NULL DEFAULT true,
  aplica_ih boolean NOT NULL DEFAULT true,
  aplica_ci boolean NOT NULL DEFAULT true,
  ordem integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(unidade_id, codigo)
);

ALTER TABLE regras_fechamento_os ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view closure rules of their unit"
  ON regras_fechamento_os FOR SELECT
  TO authenticated
  USING (
    unidade_id IS NULL
    OR unidade_id IN (
      SELECT u.unidade_id FROM usuarios u WHERE u.id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.tipo IN ('master', 'diretoria')
    )
  );

CREATE POLICY "Managers can insert closure rules"
  ON regras_fechamento_os FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.tipo IN ('master', 'diretoria', 'gerente')
    )
  );

CREATE POLICY "Managers can update closure rules"
  ON regras_fechamento_os FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.tipo IN ('master', 'diretoria', 'gerente')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.tipo IN ('master', 'diretoria', 'gerente')
    )
  );

CREATE POLICY "Managers can delete closure rules"
  ON regras_fechamento_os FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.tipo IN ('master', 'diretoria', 'gerente')
    )
  );

-- Create os_alertas_fechamento table
CREATE TABLE IF NOT EXISTS os_alertas_fechamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL REFERENCES os(id) ON DELETE CASCADE,
  unidade_id uuid REFERENCES unidades(id) ON DELETE CASCADE,
  regra_codigo text NOT NULL,
  regra_titulo text NOT NULL,
  categoria text NOT NULL DEFAULT 'operacional' CHECK (categoria IN ('pecas', 'financeiro', 'fiscal', 'operacional')),
  severidade text NOT NULL DEFAULT 'alerta' CHECK (severidade IN ('bloqueante', 'alerta')),
  mensagem text NOT NULL,
  dados_contexto jsonb DEFAULT '{}'::jsonb,
  resolvido boolean NOT NULL DEFAULT false,
  resolvido_em timestamptz,
  resolvido_por uuid REFERENCES usuarios(id),
  ignorado boolean NOT NULL DEFAULT false,
  ignorado_por uuid REFERENCES usuarios(id),
  ignorado_motivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_os_alertas_fechamento_os ON os_alertas_fechamento(os_id);
CREATE INDEX IF NOT EXISTS idx_os_alertas_fechamento_unidade ON os_alertas_fechamento(unidade_id);
CREATE INDEX IF NOT EXISTS idx_os_alertas_fechamento_resolvido ON os_alertas_fechamento(resolvido);

ALTER TABLE os_alertas_fechamento ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view alerts of their unit OS"
  ON os_alertas_fechamento FOR SELECT
  TO authenticated
  USING (
    unidade_id IN (
      SELECT u.unidade_id FROM usuarios u WHERE u.id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.tipo IN ('master', 'diretoria')
    )
  );

CREATE POLICY "Authenticated users can insert alerts"
  ON os_alertas_fechamento FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u WHERE u.id = auth.uid()
    )
  );

CREATE POLICY "Users can update alerts of their unit"
  ON os_alertas_fechamento FOR UPDATE
  TO authenticated
  USING (
    unidade_id IN (
      SELECT u.unidade_id FROM usuarios u WHERE u.id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.tipo IN ('master', 'diretoria')
    )
  )
  WITH CHECK (
    unidade_id IN (
      SELECT u.unidade_id FROM usuarios u WHERE u.id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.tipo IN ('master', 'diretoria')
    )
  );

CREATE POLICY "Users can delete alerts of their unit"
  ON os_alertas_fechamento FOR DELETE
  TO authenticated
  USING (
    unidade_id IN (
      SELECT u.unidade_id FROM usuarios u WHERE u.id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM usuarios u WHERE u.id = auth.uid() AND u.tipo IN ('master', 'diretoria')
    )
  );

-- Insert default global rules (unidade_id = NULL means applies to all units)
INSERT INTO regras_fechamento_os (unidade_id, codigo, titulo, descricao, categoria, severidade, aplica_lp, aplica_ow, aplica_ih, aplica_ci, ordem) VALUES
  (NULL, 'GI_POSTADA', 'GI de todas as pecas postada', 'Verifica se todas as pecas aprovadas tiveram a GI (Goods Issue) postada no sistema Samsung.', 'pecas', 'bloqueante', true, true, true, true, 1),
  (NULL, 'PRECO_PECAS', 'Precos das pecas preenchidos', 'Verifica se todas as pecas possuem valor unitario preenchido e maior que zero.', 'pecas', 'bloqueante', true, true, true, true, 2),
  (NULL, 'MARKUP_PECAS', 'Markup aplicado nas pecas', 'Verifica se todas as pecas possuem markup aplicado corretamente (cotacao com valor final).', 'pecas', 'alerta', true, true, false, true, 3),
  (NULL, 'VENDEDOR_DESIGNADO', 'Vendedor responsavel designado', 'Verifica se a OS possui um vendedor responsavel definido para comissionamento.', 'operacional', 'bloqueante', false, true, false, true, 4),
  (NULL, 'SERVICO_ADICIONADO', 'Servico adicionado na OS (OW)', 'Para OS do tipo OW com orcamento normal, verifica se ao menos um servico foi adicionado.', 'operacional', 'bloqueante', false, true, false, false, 5),
  (NULL, 'PAGAMENTO_REGISTRADO', 'Pagamentos registrados', 'Verifica se a OS possui ao menos um pagamento registrado.', 'financeiro', 'bloqueante', false, true, false, true, 6),
  (NULL, 'PAGAMENTO_INTEGRAL', 'Pagamento 100% realizado', 'Verifica se o valor total pago corresponde a 100% do valor da OS.', 'financeiro', 'alerta', false, true, false, true, 7),
  (NULL, 'NFSE_EMITIDA', 'NFS-e emitida', 'Verifica se a nota fiscal de servico (NFS-e) foi emitida para a OS.', 'fiscal', 'alerta', false, true, false, true, 8),
  (NULL, 'NFE_EMITIDA', 'NF-e emitida', 'Verifica se a nota fiscal eletronica (NF-e) de produto foi emitida quando ha pecas na OS.', 'fiscal', 'alerta', false, true, false, true, 9),
  (NULL, 'VALOR_ZERO', 'Nenhum valor zerado indevidamente', 'Verifica se nao ha campos de valor (pecas, servicos, total) zerados quando deveriam ter valor.', 'financeiro', 'bloqueante', true, true, true, true, 10)
ON CONFLICT (unidade_id, codigo) DO NOTHING;
