/*
  # Fix Services and Parts Audit Triggers

  1. Problem
    - Triggers `log_servicos_changes()` and `log_pecas_cotacao_changes()` try to query `SELECT os_id FROM cotacoes`
    - The `cotacoes` table does NOT have an `os_id` column
    - The correct relationship is: `os.cotacao_id` points to `cotacoes.id`
    - This causes errors when moving cards from OS back to Cotacoes on Kanban board

  2. Changes
    - Fix `log_servicos_changes()` function to query `SELECT id FROM os WHERE cotacao_id = ...`
    - Fix `log_pecas_cotacao_changes()` function to query `SELECT id FROM os WHERE cotacao_id = ...`
    - Add proper NULL handling for orphaned quotes (cotacoes without OS)
    - Add exception handling to prevent audit failures from breaking operations

  3. Security
    - Both functions remain SECURITY DEFINER
    - No changes to RLS policies
*/

-- ============================================
-- Fix Services Audit Trigger
-- ============================================
CREATE OR REPLACE FUNCTION log_servicos_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_nome text;
  v_servico_nome text;
  v_os_id uuid;
BEGIN
  SELECT nome INTO v_usuario_nome FROM usuarios WHERE id = auth.uid();

  -- Buscar OS através da cotação (CORRECTED: os.cotacao_id points to cotacoes.id)
  SELECT id INTO v_os_id FROM os WHERE cotacao_id = COALESCE(NEW.cotacao_id, OLD.cotacao_id);

  -- Se não há OS, não loga (cotação órfã)
  IF v_os_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF (TG_OP = 'INSERT') THEN
    SELECT nome INTO v_servico_nome FROM servicos WHERE id = NEW.servico_id;
    
    PERFORM criar_log_os(
      v_os_id,
      auth.uid(),
      format('➕ SERVIÇO ADICIONADO por %s: %s (R$ %s)',
        COALESCE(v_usuario_nome, 'Sistema'),
        COALESCE(v_servico_nome, 'Serviço'),
        to_char(NEW.preco_final, 'FM999G999G990D00'))
    );
  ELSIF (TG_OP = 'DELETE') THEN
    SELECT nome INTO v_servico_nome FROM servicos WHERE id = OLD.servico_id;
    
    PERFORM criar_log_os(
      v_os_id,
      auth.uid(),
      format('➖ SERVIÇO REMOVIDO por %s: %s',
        COALESCE(v_usuario_nome, 'Sistema'),
        COALESCE(v_servico_nome, 'Serviço'))
    );
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.preco_final IS DISTINCT FROM NEW.preco_final) THEN
      SELECT nome INTO v_servico_nome FROM servicos WHERE id = NEW.servico_id;
      
      PERFORM criar_log_os(
        v_os_id,
        auth.uid(),
        format('💰 PREÇO SERVIÇO ALTERADO por %s: %s - R$ %s → R$ %s',
          COALESCE(v_usuario_nome, 'Sistema'),
          COALESCE(v_servico_nome, 'Serviço'),
          to_char(OLD.preco_final, 'FM999G999G990D00'),
          to_char(NEW.preco_final, 'FM999G999G990D00'))
      );
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
EXCEPTION
  WHEN OTHERS THEN
    -- Não deixa o trigger falhar a operação principal
    RAISE WARNING 'Erro ao registrar log de serviço: %', SQLERRM;
    RETURN COALESCE(NEW, OLD);
END;
$$;

-- ============================================
-- Fix Parts Audit Trigger
-- ============================================
CREATE OR REPLACE FUNCTION log_pecas_cotacao_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_nome text;
  v_os_id uuid;
BEGIN
  SELECT nome INTO v_usuario_nome FROM usuarios WHERE id = auth.uid();
  
  -- Buscar OS através da cotação (CORRECTED: os.cotacao_id points to cotacoes.id)
  SELECT id INTO v_os_id FROM os WHERE cotacao_id = COALESCE(NEW.cotacao_id, OLD.cotacao_id);

  -- Se não há OS, não loga (cotação órfã)
  IF v_os_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF (TG_OP = 'INSERT') THEN
    PERFORM criar_log_os(
      v_os_id,
      auth.uid(),
      format('🔧 PEÇA ADICIONADA por %s: %s - %s (R$ %s)',
        COALESCE(v_usuario_nome, 'Sistema'),
        NEW.codigo_peca,
        NEW.descricao,
        to_char(NEW.preco_final, 'FM999G999G990D00'))
    );
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM criar_log_os(
      v_os_id,
      auth.uid(),
      format('➖ PEÇA REMOVIDA por %s: %s - %s',
        COALESCE(v_usuario_nome, 'Sistema'),
        OLD.codigo_peca,
        OLD.descricao)
    );
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.preco_final IS DISTINCT FROM NEW.preco_final) THEN
      PERFORM criar_log_os(
        v_os_id,
        auth.uid(),
        format('💰 PREÇO PEÇA ALTERADO por %s: %s - R$ %s → R$ %s',
          COALESCE(v_usuario_nome, 'Sistema'),
          NEW.codigo_peca,
          to_char(OLD.preco_final, 'FM999G999G990D00'),
          to_char(NEW.preco_final, 'FM999G999G990D00'))
      );
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
EXCEPTION
  WHEN OTHERS THEN
    -- Não deixa o trigger falhar a operação principal
    RAISE WARNING 'Erro ao registrar log de peça: %', SQLERRM;
    RETURN COALESCE(NEW, OLD);
END;
$$;
