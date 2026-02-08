/*
  # Sistema de Registro de Vendas

  1. Nova Tabela
    - `vendas`
      - `id` (uuid, primary key)
      - `numero_venda` (text, número único da venda)
      - `cliente_nome` (text, nome do cliente)
      - `cliente_documento` (text, CPF/CNPJ do cliente)
      - `cliente_contato` (text, telefone/email)
      - `produto_nome` (text, nome do produto vendido)
      - `produto_tipo` (text, tipo/categoria do produto)
      - `vendedor_id` (uuid, FK para usuarios)
      - `preco` (numeric, valor da venda)
      - `tipo_venda` (enum: 'store_plus', 'smb', 'seguro_care')
      - `status` (enum: 'pendente', 'concluido', 'cancelado')
      - `unidade_id` (uuid, FK para unidades)
      - `criado_por` (uuid, FK para usuarios)
      - `enviado_skywalker` (boolean, se foi enviado para pontuação)
      - `data_envio_skywalker` (timestamptz, quando foi enviado)
      - `skywalker_registro_id` (uuid, ID do registro no Skywalker)
      - `log_skywalker` (jsonb, logs de integração)
      - `observacoes` (text, observações gerais)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Segurança
    - RLS habilitado
    - Usuários veem vendas de sua unidade
    - Master/Diretor veem todas

  3. Triggers
    - Atualização automática de updated_at
    - Integração automática com Skywalker quando status = 'concluido'
    - Remoção de pontos quando cancelado
*/

-- Criar enums
CREATE TYPE tipo_venda AS ENUM ('store_plus', 'smb', 'seguro_care');
CREATE TYPE status_venda AS ENUM ('pendente', 'concluido', 'cancelado');

-- Criar tabela
CREATE TABLE IF NOT EXISTS vendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_venda text NOT NULL,
  cliente_nome text NOT NULL,
  cliente_documento text,
  cliente_contato text,
  produto_nome text NOT NULL,
  produto_tipo text,
  vendedor_id uuid NOT NULL REFERENCES usuarios(id),
  preco numeric(10,2) NOT NULL DEFAULT 0,
  tipo_venda tipo_venda NOT NULL,
  status status_venda NOT NULL DEFAULT 'pendente',
  unidade_id uuid NOT NULL REFERENCES unidades(id),
  criado_por uuid REFERENCES usuarios(id),
  enviado_skywalker boolean DEFAULT false,
  data_envio_skywalker timestamptz,
  skywalker_registro_id uuid,
  log_skywalker jsonb DEFAULT '[]'::jsonb,
  observacoes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT vendas_numero_venda_unidade_unique UNIQUE (numero_venda, unidade_id)
);

-- Criar índices
CREATE INDEX IF NOT EXISTS vendas_vendedor_id_idx ON vendas(vendedor_id);
CREATE INDEX IF NOT EXISTS vendas_unidade_id_idx ON vendas(unidade_id);
CREATE INDEX IF NOT EXISTS vendas_status_idx ON vendas(status);
CREATE INDEX IF NOT EXISTS vendas_tipo_venda_idx ON vendas(tipo_venda);
CREATE INDEX IF NOT EXISTS vendas_created_at_idx ON vendas(created_at DESC);
CREATE INDEX IF NOT EXISTS vendas_enviado_skywalker_idx ON vendas(enviado_skywalker) WHERE enviado_skywalker = false;

-- Habilitar RLS
ALTER TABLE vendas ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Usuários veem vendas de sua unidade"
  ON vendas FOR SELECT
  TO authenticated
  USING (
    unidade_id IN (
      SELECT unidade_id FROM usuarios WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor')
      AND usuarios.unidade_id IS NULL
    )
  );

CREATE POLICY "Usuários podem criar vendas"
  ON vendas FOR INSERT
  TO authenticated
  WITH CHECK (
    unidade_id IN (
      SELECT unidade_id FROM usuarios WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente', 'administrador')
    )
  );

CREATE POLICY "Usuários podem editar vendas de sua unidade"
  ON vendas FOR UPDATE
  TO authenticated
  USING (
    unidade_id IN (
      SELECT unidade_id FROM usuarios WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente', 'administrador')
    )
  )
  WITH CHECK (
    unidade_id IN (
      SELECT unidade_id FROM usuarios WHERE id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente', 'administrador')
    )
  );

CREATE POLICY "Apenas gestores podem deletar vendas"
  ON vendas FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('master', 'diretor', 'gerente')
    )
  );

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION atualizar_updated_at_vendas()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_atualizar_updated_at_vendas
  BEFORE UPDATE ON vendas
  FOR EACH ROW
  EXECUTE FUNCTION atualizar_updated_at_vendas();

-- Função para registrar venda no Skywalker
CREATE OR REPLACE FUNCTION registrar_venda_skywalker()
RETURNS TRIGGER AS $$
DECLARE
  v_profissional_id uuid;
  v_mes_ref text;
  v_pilar_id uuid;
  v_estrelas integer;
BEGIN
  -- Só processa se status mudou para concluido e ainda não foi enviado
  IF NEW.status = 'concluido' AND (OLD.status IS NULL OR OLD.status != 'concluido') AND NEW.enviado_skywalker = false THEN
    
    -- Buscar profissional do vendedor
    SELECT id INTO v_profissional_id
    FROM skywalker_profissionais
    WHERE usuario_id = NEW.vendedor_id
      AND ativo = true
    LIMIT 1;
    
    IF v_profissional_id IS NOT NULL THEN
      -- Mês de referência
      v_mes_ref := date_trunc('month', NEW.created_at)::date::text;
      
      -- Determinar pilar e estrelas baseado no tipo de venda
      CASE NEW.tipo_venda
        WHEN 'store_plus' THEN
          -- Buscar pilar de Vendas Store
          SELECT id INTO v_pilar_id
          FROM skywalker_pilares
          WHERE nome ILIKE '%store%'
            AND ativo = true
            AND (unidade_id = NEW.unidade_id OR unidade_id IS NULL)
          ORDER BY unidade_id NULLS LAST
          LIMIT 1;
          v_estrelas := 1; -- 1 estrela por venda store
          
        WHEN 'seguro_care' THEN
          -- Buscar pilar de Care
          SELECT id INTO v_pilar_id
          FROM skywalker_pilares
          WHERE nome ILIKE '%care%'
            AND ativo = true
            AND (unidade_id = NEW.unidade_id OR unidade_id IS NULL)
          ORDER BY unidade_id NULLS LAST
          LIMIT 1;
          v_estrelas := 1; -- 1 estrela por care
          
        WHEN 'smb' THEN
          -- Buscar pilar de SMB
          SELECT id INTO v_pilar_id
          FROM skywalker_pilares
          WHERE nome ILIKE '%smb%'
            AND ativo = true
            AND (unidade_id = NEW.unidade_id OR unidade_id IS NULL)
          ORDER BY unidade_id NULLS LAST
          LIMIT 1;
          v_estrelas := 2; -- 2 estrelas por SMB
      END CASE;
      
      -- Se encontrou pilar, registrar estrelas
      IF v_pilar_id IS NOT NULL THEN
        INSERT INTO skywalker_estrelas_mes (
          profissional_id,
          mes_referencia,
          pilar_id,
          valor_metrica,
          estrelas_conquistadas
        ) VALUES (
          v_profissional_id,
          v_mes_ref,
          v_pilar_id,
          1, -- 1 venda
          v_estrelas
        )
        ON CONFLICT (profissional_id, mes_referencia, pilar_id)
        DO UPDATE SET
          valor_metrica = skywalker_estrelas_mes.valor_metrica + 1,
          estrelas_conquistadas = skywalker_estrelas_mes.estrelas_conquistadas + v_estrelas;
        
        -- Marcar como enviado
        NEW.enviado_skywalker := true;
        NEW.data_envio_skywalker := now();
        NEW.log_skywalker := NEW.log_skywalker || jsonb_build_object(
          'tipo', 'envio',
          'data', now(),
          'status', 'sucesso',
          'pilar_id', v_pilar_id,
          'estrelas', v_estrelas,
          'mensagem', format('Venda registrada com %s estrelas', v_estrelas)
        );
      ELSE
        -- Log de erro - pilar não encontrado
        NEW.log_skywalker := NEW.log_skywalker || jsonb_build_object(
          'tipo', 'erro',
          'data', now(),
          'status', 'erro',
          'mensagem', format('Pilar não encontrado para tipo de venda: %s', NEW.tipo_venda)
        );
      END IF;
    ELSE
      -- Log de erro - profissional não encontrado
      NEW.log_skywalker := NEW.log_skywalker || jsonb_build_object(
        'tipo', 'erro',
        'data', now(),
        'status', 'erro',
        'mensagem', 'Vendedor não está cadastrado no sistema Skywalker'
      );
    END IF;
  END IF;
  
  -- Se status mudou para cancelado, remover pontos se foram enviados
  IF NEW.status = 'cancelado' AND OLD.status = 'concluido' AND NEW.enviado_skywalker = true THEN
    -- Buscar profissional
    SELECT id INTO v_profissional_id
    FROM skywalker_profissionais
    WHERE usuario_id = NEW.vendedor_id
      AND ativo = true
    LIMIT 1;
    
    IF v_profissional_id IS NOT NULL THEN
      v_mes_ref := date_trunc('month', NEW.created_at)::date::text;
      
      -- Determinar estrelas a remover
      CASE NEW.tipo_venda
        WHEN 'store_plus', 'seguro_care' THEN v_estrelas := 1;
        WHEN 'smb' THEN v_estrelas := 2;
      END CASE;
      
      -- Atualizar estrelas (decrementar)
      UPDATE skywalker_estrelas_mes
      SET 
        valor_metrica = GREATEST(0, valor_metrica - 1),
        estrelas_conquistadas = GREATEST(0, estrelas_conquistadas - v_estrelas)
      WHERE profissional_id = v_profissional_id
        AND mes_referencia = v_mes_ref;
      
      -- Log de cancelamento
      NEW.log_skywalker := NEW.log_skywalker || jsonb_build_object(
        'tipo', 'cancelamento',
        'data', now(),
        'status', 'sucesso',
        'estrelas_removidas', v_estrelas,
        'mensagem', 'Pontos removidos devido ao cancelamento'
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_registrar_venda_skywalker
  BEFORE INSERT OR UPDATE OF status ON vendas
  FOR EACH ROW
  EXECUTE FUNCTION registrar_venda_skywalker();

-- Comentários
COMMENT ON TABLE vendas IS 'Registro de vendas Store+, SMB e Seguro Care+ com integração ao Skywalker';
COMMENT ON COLUMN vendas.numero_venda IS 'Número único da venda por unidade';
COMMENT ON COLUMN vendas.tipo_venda IS 'Tipo: store_plus, smb ou seguro_care';
COMMENT ON COLUMN vendas.status IS 'Status: pendente, concluido ou cancelado';
COMMENT ON COLUMN vendas.enviado_skywalker IS 'Se a venda foi computada no sistema de pontuação';
COMMENT ON COLUMN vendas.log_skywalker IS 'Histórico de integração com Skywalker';
