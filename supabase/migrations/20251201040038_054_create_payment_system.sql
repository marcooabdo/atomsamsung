/*
  # Sistema Completo de Pagamentos e Financeiro

  ## 1. Nova Tabela: pagamentos
  - Armazena todos os pagamentos lançados em OSs
  - Campos obrigatórios: forma_pagamento, valor, comprovante
  - SKU único para pagamentos com cartão
  - Vínculo com usuário responsável pelo fechamento
  - Rastreamento de quem lançou e quando

  ## 2. Alterações na Tabela: os
  - Adicionar campos para controle financeiro
  - valor_total: valor total da OS
  - valor_pago: soma acumulada de pagamentos
  - saldo_restante: calculado automaticamente
  - status_pagamento: enum (pendente, parcial, pago)

  ## 3. Segurança
  - RLS habilitado em pagamentos
  - Políticas para leitura baseada em permissões
  - Apenas master/gerente podem alterar responsável
  - Validação de SKU único via constraint

  ## 4. Triggers
  - Atualização automática de valor_pago ao inserir pagamento
  - Recálculo de saldo_restante
  - Atualização de status_pagamento
  - Validação de SKU duplicado entre OS diferentes
*/

-- Criar enum para forma de pagamento
DO $$ BEGIN
  CREATE TYPE forma_pagamento_enum AS ENUM (
    'pix',
    'cartao_credito',
    'cartao_debito',
    'dinheiro',
    'transferencia',
    'boleto',
    'outro'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Criar enum para status de pagamento
DO $$ BEGIN
  CREATE TYPE status_pagamento_enum AS ENUM (
    'pendente',
    'parcial',
    'pago'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Adicionar colunas financeiras na tabela OS
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'os' AND column_name = 'valor_total') THEN
    ALTER TABLE os ADD COLUMN valor_total numeric(10,2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'os' AND column_name = 'valor_pago') THEN
    ALTER TABLE os ADD COLUMN valor_pago numeric(10,2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'os' AND column_name = 'saldo_restante') THEN
    ALTER TABLE os ADD COLUMN saldo_restante numeric(10,2) DEFAULT 0;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'os' AND column_name = 'status_pagamento') THEN
    ALTER TABLE os ADD COLUMN status_pagamento status_pagamento_enum DEFAULT 'pendente';
  END IF;
END $$;

-- Criar tabela de pagamentos
CREATE TABLE IF NOT EXISTS pagamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid NOT NULL REFERENCES os(id) ON DELETE CASCADE,
  cotacao_id uuid REFERENCES cotacoes(id) ON DELETE SET NULL,
  unidade_id uuid NOT NULL REFERENCES unidades(id),
  
  -- Dados do pagamento
  forma_pagamento forma_pagamento_enum NOT NULL,
  valor numeric(10,2) NOT NULL CHECK (valor > 0),
  comprovante_url text NOT NULL,
  sku_maquininha text,
  observacoes text,
  
  -- Rastreamento
  lancado_por uuid NOT NULL REFERENCES usuarios(id),
  responsavel_fechamento uuid NOT NULL REFERENCES usuarios(id),
  data_lancamento timestamptz NOT NULL DEFAULT now(),
  
  -- Metadata
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Criar índices para performance
CREATE INDEX IF NOT EXISTS idx_pagamentos_os_id ON pagamentos(os_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_cotacao_id ON pagamentos(cotacao_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_unidade_id ON pagamentos(unidade_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_responsavel ON pagamentos(responsavel_fechamento);
CREATE INDEX IF NOT EXISTS idx_pagamentos_data ON pagamentos(data_lancamento);
CREATE INDEX IF NOT EXISTS idx_pagamentos_forma ON pagamentos(forma_pagamento);
CREATE INDEX IF NOT EXISTS idx_os_status_pagamento ON os(status_pagamento);

-- Função para validar SKU duplicado
CREATE OR REPLACE FUNCTION validar_sku_unico()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sku_maquininha IS NOT NULL AND 
     NEW.forma_pagamento IN ('cartao_credito', 'cartao_debito') THEN
    
    IF EXISTS (
      SELECT 1 FROM pagamentos 
      WHERE sku_maquininha = NEW.sku_maquininha 
      AND os_id != NEW.os_id
      AND id != COALESCE(NEW.id, '00000000-0000-0000-0000-000000000000'::uuid)
    ) THEN
      RAISE EXCEPTION 'SKU % já utilizado em outra OS. Verifique.', NEW.sku_maquininha;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para validar SKU
DROP TRIGGER IF EXISTS trg_validar_sku_unico ON pagamentos;
CREATE TRIGGER trg_validar_sku_unico
  BEFORE INSERT OR UPDATE ON pagamentos
  FOR EACH ROW
  EXECUTE FUNCTION validar_sku_unico();

-- Função para atualizar valores financeiros da OS
CREATE OR REPLACE FUNCTION atualizar_valores_os()
RETURNS TRIGGER AS $$
DECLARE
  v_os_id uuid;
  v_total_pago numeric(10,2);
  v_valor_total numeric(10,2);
  v_saldo numeric(10,2);
  v_status status_pagamento_enum;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_os_id := OLD.os_id;
  ELSE
    v_os_id := NEW.os_id;
  END IF;
  
  SELECT COALESCE(SUM(valor), 0)
  INTO v_total_pago
  FROM pagamentos
  WHERE os_id = v_os_id;
  
  SELECT valor_total INTO v_valor_total
  FROM os
  WHERE id = v_os_id;
  
  v_saldo := GREATEST(v_valor_total - v_total_pago, 0);
  
  IF v_total_pago = 0 THEN
    v_status := 'pendente';
  ELSIF v_saldo = 0 AND v_valor_total > 0 THEN
    v_status := 'pago';
  ELSIF v_total_pago > 0 THEN
    v_status := 'parcial';
  ELSE
    v_status := 'pendente';
  END IF;
  
  UPDATE os
  SET 
    valor_pago = v_total_pago,
    saldo_restante = v_saldo,
    status_pagamento = v_status,
    updated_at = now()
  WHERE id = v_os_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers para atualizar valores da OS
DROP TRIGGER IF EXISTS trg_atualizar_valores_os_insert ON pagamentos;
CREATE TRIGGER trg_atualizar_valores_os_insert
  AFTER INSERT ON pagamentos
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_valores_os();

DROP TRIGGER IF EXISTS trg_atualizar_valores_os_update ON pagamentos;
CREATE TRIGGER trg_atualizar_valores_os_update
  AFTER UPDATE ON pagamentos
  FOR EACH ROW
  WHEN (OLD.valor IS DISTINCT FROM NEW.valor OR OLD.os_id IS DISTINCT FROM NEW.os_id)
  EXECUTE FUNCTION atualizar_valores_os();

DROP TRIGGER IF EXISTS trg_atualizar_valores_os_delete ON pagamentos;
CREATE TRIGGER trg_atualizar_valores_os_delete
  AFTER DELETE ON pagamentos
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_valores_os();

-- Trigger para recalcular saldo quando valor_total muda
CREATE OR REPLACE FUNCTION recalcular_saldo_os()
RETURNS TRIGGER AS $$
BEGIN
  NEW.saldo_restante := GREATEST(NEW.valor_total - NEW.valor_pago, 0);
  
  IF NEW.valor_pago = 0 THEN
    NEW.status_pagamento := 'pendente';
  ELSIF NEW.saldo_restante = 0 AND NEW.valor_total > 0 THEN
    NEW.status_pagamento := 'pago';
  ELSIF NEW.valor_pago > 0 THEN
    NEW.status_pagamento := 'parcial';
  ELSE
    NEW.status_pagamento := 'pendente';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_recalcular_saldo_os ON os;
CREATE TRIGGER trg_recalcular_saldo_os
  BEFORE UPDATE OF valor_total ON os
  FOR EACH ROW
  WHEN (OLD.valor_total IS DISTINCT FROM NEW.valor_total)
  EXECUTE FUNCTION recalcular_saldo_os();

-- RLS para tabela pagamentos
ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY;

-- Política de leitura
CREATE POLICY "Usuários veem pagamentos da unidade"
  ON pagamentos FOR SELECT
  TO authenticated
  USING (
    unidade_id IN (
      SELECT unidade_id FROM usuarios WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND tipo IN ('master', 'diretoria')
    )
  );

-- Política de inserção
CREATE POLICY "Usuários podem adicionar pagamentos"
  ON pagamentos FOR INSERT
  TO authenticated
  WITH CHECK (
    unidade_id IN (
      SELECT unidade_id FROM usuarios WHERE id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND tipo IN ('master', 'diretoria')
    )
  );

-- Política de atualização
CREATE POLICY "Apenas master/gerente podem alterar responsável"
  ON pagamentos FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND tipo IN ('master', 'gerente', 'diretoria')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND tipo IN ('master', 'gerente', 'diretoria')
    )
  );

-- Política de deleção
CREATE POLICY "Apenas master pode deletar pagamentos"
  ON pagamentos FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND tipo = 'master'
    )
  );
