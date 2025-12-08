/*
  # ATOM FINANCE - Sistema Financeiro Completo

  1. New Tables
    - `caixa_aberturas` - Abertura diaria de caixa fisico por unidade
    - `caixa_fechamentos` - Fechamento diario de caixa por unidade
    - `lancamentos_financeiros` - Receitas e despesas
    - `consumo_pecas` - Controle de consumo de pecas LP e OW
    - `pendencias_pagamento_samsung` - Pendencias de pagamento para Samsung

  2. Security
    - Enable RLS on all tables
    - Policies for authenticated users based on unit access
    - Master users have access to all units
*/

-- Caixa Aberturas
CREATE TABLE IF NOT EXISTS caixa_aberturas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id UUID NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  data DATE NOT NULL,
  valor_inicial NUMERIC(12,2) NOT NULL DEFAULT 0,
  usuario_id UUID REFERENCES usuarios(id),
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(unidade_id, data)
);

ALTER TABLE caixa_aberturas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view caixa_aberturas from their unit"
  ON caixa_aberturas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.unidade_id = caixa_aberturas.unidade_id OR u.tipo = 'master')
    )
  );

CREATE POLICY "Users can insert caixa_aberturas for their unit"
  ON caixa_aberturas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.unidade_id = caixa_aberturas.unidade_id OR u.tipo = 'master')
    )
  );

CREATE POLICY "Users can update caixa_aberturas from their unit"
  ON caixa_aberturas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.unidade_id = caixa_aberturas.unidade_id OR u.tipo = 'master')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.unidade_id = caixa_aberturas.unidade_id OR u.tipo = 'master')
    )
  );

-- Caixa Fechamentos
CREATE TABLE IF NOT EXISTS caixa_fechamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id UUID NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  abertura_id UUID REFERENCES caixa_aberturas(id) ON DELETE SET NULL,
  data DATE NOT NULL,
  valor_esperado NUMERIC(12,2) NOT NULL DEFAULT 0,
  valor_contado NUMERIC(12,2) NOT NULL DEFAULT 0,
  diferenca NUMERIC(12,2) GENERATED ALWAYS AS (valor_contado - valor_esperado) STORED,
  usuario_id UUID REFERENCES usuarios(id),
  observacoes TEXT,
  status TEXT NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'fechado', 'divergente')),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(unidade_id, data)
);

ALTER TABLE caixa_fechamentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view caixa_fechamentos from their unit"
  ON caixa_fechamentos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.unidade_id = caixa_fechamentos.unidade_id OR u.tipo = 'master')
    )
  );

CREATE POLICY "Users can insert caixa_fechamentos for their unit"
  ON caixa_fechamentos FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.unidade_id = caixa_fechamentos.unidade_id OR u.tipo = 'master')
    )
  );

CREATE POLICY "Users can update caixa_fechamentos from their unit"
  ON caixa_fechamentos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.unidade_id = caixa_fechamentos.unidade_id OR u.tipo = 'master')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.unidade_id = caixa_fechamentos.unidade_id OR u.tipo = 'master')
    )
  );

-- Lancamentos Financeiros
CREATE TABLE IF NOT EXISTS lancamentos_financeiros (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id UUID NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('receita', 'despesa')),
  categoria TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(12,2) NOT NULL,
  forma_pagamento TEXT NOT NULL CHECK (forma_pagamento IN ('dinheiro', 'pix', 'cartao_credito', 'cartao_debito', 'boleto', 'transferencia')),
  os_id UUID REFERENCES os(id) ON DELETE SET NULL,
  cotacao_id UUID REFERENCES cotacoes(id) ON DELETE SET NULL,
  data_lancamento DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento DATE,
  data_baixa TIMESTAMPTZ,
  usuario_baixa_id UUID REFERENCES usuarios(id),
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'baixado', 'cancelado')),
  referencia TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  created_by UUID REFERENCES usuarios(id)
);

ALTER TABLE lancamentos_financeiros ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view lancamentos from their unit"
  ON lancamentos_financeiros FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.unidade_id = lancamentos_financeiros.unidade_id OR u.tipo = 'master')
    )
  );

CREATE POLICY "Users can insert lancamentos for their unit"
  ON lancamentos_financeiros FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.unidade_id = lancamentos_financeiros.unidade_id OR u.tipo = 'master')
    )
  );

CREATE POLICY "Users can update lancamentos from their unit"
  ON lancamentos_financeiros FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.unidade_id = lancamentos_financeiros.unidade_id OR u.tipo = 'master')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.unidade_id = lancamentos_financeiros.unidade_id OR u.tipo = 'master')
    )
  );

-- Consumo de Pecas
CREATE TABLE IF NOT EXISTS consumo_pecas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id UUID NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  os_id UUID REFERENCES os(id) ON DELETE SET NULL,
  peca_id UUID REFERENCES estoque_pecas(id) ON DELETE SET NULL,
  tipo_consumo TEXT NOT NULL CHECK (tipo_consumo IN ('LP', 'OW')),
  pn TEXT NOT NULL,
  descricao TEXT,
  id_samsung TEXT,
  nf_entrada TEXT,
  valor_unitario NUMERIC(12,2) NOT NULL DEFAULT 0,
  quantidade INTEGER NOT NULL DEFAULT 1,
  valor_total NUMERIC(12,2) GENERATED ALWAYS AS (valor_unitario * quantidade) STORED,
  data_consumo DATE NOT NULL DEFAULT CURRENT_DATE,
  tecnico_id UUID REFERENCES usuarios(id),
  cliente_nome TEXT,
  situacao_faturamento TEXT NOT NULL DEFAULT 'pendente' CHECK (situacao_faturamento IN ('pendente', 'faturada', 'nao_faturada')),
  nf_faturamento TEXT,
  data_faturamento DATE,
  valor_gspn NUMERIC(12,2),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE consumo_pecas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view consumo_pecas from their unit"
  ON consumo_pecas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.unidade_id = consumo_pecas.unidade_id OR u.tipo = 'master')
    )
  );

CREATE POLICY "Users can insert consumo_pecas for their unit"
  ON consumo_pecas FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.unidade_id = consumo_pecas.unidade_id OR u.tipo = 'master')
    )
  );

CREATE POLICY "Users can update consumo_pecas from their unit"
  ON consumo_pecas FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.unidade_id = consumo_pecas.unidade_id OR u.tipo = 'master')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.unidade_id = consumo_pecas.unidade_id OR u.tipo = 'master')
    )
  );

-- Pendencias Pagamento Samsung
CREATE TABLE IF NOT EXISTS pendencias_pagamento_samsung (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id UUID NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  consumo_id UUID REFERENCES consumo_pecas(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('LP', 'OW')),
  pn TEXT NOT NULL,
  id_samsung TEXT,
  valor NUMERIC(12,2) NOT NULL,
  nf_samsung TEXT,
  status TEXT NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'quitada')),
  data_quitacao DATE,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE pendencias_pagamento_samsung ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view pendencias from their unit"
  ON pendencias_pagamento_samsung FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.unidade_id = pendencias_pagamento_samsung.unidade_id OR u.tipo = 'master')
    )
  );

CREATE POLICY "Users can insert pendencias for their unit"
  ON pendencias_pagamento_samsung FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.unidade_id = pendencias_pagamento_samsung.unidade_id OR u.tipo = 'master')
    )
  );

CREATE POLICY "Users can update pendencias from their unit"
  ON pendencias_pagamento_samsung FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.unidade_id = pendencias_pagamento_samsung.unidade_id OR u.tipo = 'master')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (u.unidade_id = pendencias_pagamento_samsung.unidade_id OR u.tipo = 'master')
    )
  );

-- Indexes para performance
CREATE INDEX IF NOT EXISTS idx_caixa_aberturas_unidade_data ON caixa_aberturas(unidade_id, data);
CREATE INDEX IF NOT EXISTS idx_caixa_fechamentos_unidade_data ON caixa_fechamentos(unidade_id, data);
CREATE INDEX IF NOT EXISTS idx_lancamentos_unidade_data ON lancamentos_financeiros(unidade_id, data_lancamento);
CREATE INDEX IF NOT EXISTS idx_lancamentos_status ON lancamentos_financeiros(status);
CREATE INDEX IF NOT EXISTS idx_consumo_pecas_unidade_data ON consumo_pecas(unidade_id, data_consumo);
CREATE INDEX IF NOT EXISTS idx_consumo_pecas_tipo ON consumo_pecas(tipo_consumo);
CREATE INDEX IF NOT EXISTS idx_consumo_pecas_os ON consumo_pecas(os_id);
CREATE INDEX IF NOT EXISTS idx_pendencias_status ON pendencias_pagamento_samsung(status);