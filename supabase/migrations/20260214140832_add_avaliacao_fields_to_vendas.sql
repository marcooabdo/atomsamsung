/*
  # Adicionar Campos de Avaliação e Validação ao Sistema de Vendas

  1. Novos Campos na Tabela `vendas`
    - `cliente_endereco` (text) - Endereço completo do cliente
    - `cliente_data_nascimento` (date) - Data de nascimento do cliente
    - `cliente_telefone` (text) - Telefone do cliente (separado do contato)
    - `avaliacao_url` (text) - URL do arquivo de avaliação (Google Reviews, etc)
    - `avaliacao_validada` (boolean) - Se a avaliação foi validada por gerente+
    - `avaliacao_validada_por` (uuid) - ID do usuário que validou
    - `avaliacao_validada_em` (timestamptz) - Data/hora da validação
    - `avaliacao_observacoes` (text) - Observações sobre a validação

  2. Funcionalidades
    - Upload de comprovante de avaliação (Google Reviews)
    - Validação por gerente, diretor, administrador ou master
    - Integração com Skywalker: pontua apenas após validação
    - Regra "Google Reviews" com 1 estrela por avaliação validada

  3. Segurança
    - Apenas gestores (gerente+) podem validar avaliações
    - RLS mantém as permissões existentes
*/

-- Adicionar novos campos à tabela vendas
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS cliente_endereco text;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS cliente_data_nascimento date;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS cliente_telefone text;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS avaliacao_url text;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS avaliacao_validada boolean DEFAULT false;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS avaliacao_validada_por uuid REFERENCES usuarios(id);
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS avaliacao_validada_em timestamptz;
ALTER TABLE vendas ADD COLUMN IF NOT EXISTS avaliacao_observacoes text;

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS vendas_avaliacao_validada_idx ON vendas(avaliacao_validada) WHERE avaliacao_url IS NOT NULL;
CREATE INDEX IF NOT EXISTS vendas_avaliacao_validada_por_idx ON vendas(avaliacao_validada_por);
CREATE INDEX IF NOT EXISTS vendas_cliente_telefone_idx ON vendas(cliente_telefone);

-- Função para registrar avaliação validada no Skywalker
CREATE OR REPLACE FUNCTION registrar_avaliacao_skywalker()
RETURNS TRIGGER AS $$
DECLARE
  v_profissional_id uuid;
  v_mes_ref text;
  v_pilar_id uuid;
  v_estrelas integer := 1;
BEGIN
  IF NEW.avaliacao_validada = true AND (OLD.avaliacao_validada IS NULL OR OLD.avaliacao_validada = false) THEN

    SELECT id INTO v_profissional_id
    FROM skywalker_profissionais
    WHERE usuario_id = NEW.vendedor_id
      AND ativo = true
    LIMIT 1;

    IF v_profissional_id IS NOT NULL THEN
      v_mes_ref := date_trunc('month', NEW.created_at)::date::text;

      SELECT id INTO v_pilar_id
      FROM skywalker_pilares
      WHERE (nome ILIKE '%google%' OR nome ILIKE '%review%' OR nome ILIKE '%avalia%')
        AND ativo = true
        AND (unidade_id = NEW.unidade_id OR unidade_id IS NULL)
      ORDER BY unidade_id NULLS LAST
      LIMIT 1;

      IF v_pilar_id IS NULL THEN
        SELECT id INTO v_pilar_id
        FROM skywalker_pilares
        WHERE nome ILIKE '%venda%'
          AND ativo = true
          AND (unidade_id = NEW.unidade_id OR unidade_id IS NULL)
        ORDER BY unidade_id NULLS LAST
        LIMIT 1;
      END IF;

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
          1,
          v_estrelas
        )
        ON CONFLICT (profissional_id, mes_referencia, pilar_id)
        DO UPDATE SET
          valor_metrica = skywalker_estrelas_mes.valor_metrica + 1,
          estrelas_conquistadas = skywalker_estrelas_mes.estrelas_conquistadas + v_estrelas;

        NEW.log_skywalker := NEW.log_skywalker || jsonb_build_object(
          'tipo', 'avaliacao_validada',
          'data', now(),
          'status', 'sucesso',
          'pilar_id', v_pilar_id,
          'estrelas', v_estrelas,
          'validada_por', NEW.avaliacao_validada_por,
          'mensagem', format('Avaliação validada e registrada com %s estrela(s)', v_estrelas)
        );
      ELSE
        NEW.log_skywalker := NEW.log_skywalker || jsonb_build_object(
          'tipo', 'avaliacao_validada',
          'data', now(),
          'status', 'aviso',
          'mensagem', 'Pilar Google Reviews não encontrado, estrelas não contabilizadas'
        );
      END IF;
    ELSE
      NEW.log_skywalker := NEW.log_skywalker || jsonb_build_object(
        'tipo', 'avaliacao_validada',
        'data', now(),
        'status', 'erro',
        'mensagem', 'Vendedor não está cadastrado no sistema Skywalker'
      );
    END IF;
  END IF;

  IF NEW.avaliacao_validada = false AND OLD.avaliacao_validada = true THEN
    SELECT id INTO v_profissional_id
    FROM skywalker_profissionais
    WHERE usuario_id = NEW.vendedor_id
      AND ativo = true
    LIMIT 1;

    IF v_profissional_id IS NOT NULL THEN
      v_mes_ref := date_trunc('month', NEW.created_at)::date::text;
      v_estrelas := 1;

      SELECT id INTO v_pilar_id
      FROM skywalker_pilares
      WHERE (nome ILIKE '%google%' OR nome ILIKE '%review%' OR nome ILIKE '%avalia%')
        AND ativo = true
        AND (unidade_id = NEW.unidade_id OR unidade_id IS NULL)
      ORDER BY unidade_id NULLS LAST
      LIMIT 1;

      IF v_pilar_id IS NOT NULL THEN
        UPDATE skywalker_estrelas_mes
        SET
          valor_metrica = GREATEST(0, valor_metrica - 1),
          estrelas_conquistadas = GREATEST(0, estrelas_conquistadas - v_estrelas)
        WHERE profissional_id = v_profissional_id
          AND mes_referencia = v_mes_ref
          AND pilar_id = v_pilar_id;

        NEW.log_skywalker := NEW.log_skywalker || jsonb_build_object(
          'tipo', 'avaliacao_invalidada',
          'data', now(),
          'status', 'sucesso',
          'estrelas_removidas', v_estrelas,
          'mensagem', 'Pontos removidos devido à invalidação da avaliação'
        );
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_registrar_avaliacao_skywalker
  BEFORE UPDATE OF avaliacao_validada ON vendas
  FOR EACH ROW
  EXECUTE FUNCTION registrar_avaliacao_skywalker();

COMMENT ON COLUMN vendas.cliente_endereco IS 'Endereço completo do cliente';
COMMENT ON COLUMN vendas.cliente_data_nascimento IS 'Data de nascimento do cliente';
COMMENT ON COLUMN vendas.cliente_telefone IS 'Telefone do cliente';
COMMENT ON COLUMN vendas.avaliacao_url IS 'URL do comprovante da avaliação (Google Reviews, etc)';
COMMENT ON COLUMN vendas.avaliacao_validada IS 'Se a avaliação foi validada por gerente ou superior';
COMMENT ON COLUMN vendas.avaliacao_validada_por IS 'Usuário que validou a avaliação (gerente+)';
COMMENT ON COLUMN vendas.avaliacao_validada_em IS 'Data e hora da validação da avaliação';
COMMENT ON COLUMN vendas.avaliacao_observacoes IS 'Observações do gestor sobre a validação';
