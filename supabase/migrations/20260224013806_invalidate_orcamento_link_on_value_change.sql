/*
  # Invalidar Link de Orçamento ao Mudar Valor/Peças/Desconto/Serviços

  ## Descrição
  Cria trigger que desativa automaticamente os links de orçamento ativos (ativo=true, status='pendente')
  quando qualquer dado financeiro da OS é alterado:
  - valor_total, valor_desconto_calculado, desconto_valor, desconto_tipo mudam na OS
  - Uma peça (os_pecas) é inserida, atualizada ou removida
  - Um serviço (os_servicos ou cotacoes_servicos vinculado) é alterado

  ## Comportamento
  - Apenas invalida links com ativo=true E status='pendente'
  - Links já aprovados/rejeitados/negociando NÃO são tocados
  - Também ativa orcamento_pendente_reenvio=true na OS para alertar o usuário
*/

-- Função que invalida links pendentes quando valor da OS muda
CREATE OR REPLACE FUNCTION invalidar_links_orcamento_pendentes(p_os_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE orcamento_links
  SET ativo = false, updated_at = now()
  WHERE os_id = p_os_id
    AND ativo = true
    AND status = 'pendente';
END;
$$;

-- Trigger na tabela OS: invalida quando campos financeiros mudam
CREATE OR REPLACE FUNCTION trg_invalidar_link_on_os_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (
    OLD.valor_total IS DISTINCT FROM NEW.valor_total OR
    OLD.valor_desconto_calculado IS DISTINCT FROM NEW.valor_desconto_calculado OR
    OLD.desconto_valor IS DISTINCT FROM NEW.desconto_valor OR
    OLD.desconto_tipo IS DISTINCT FROM NEW.desconto_tipo
  ) THEN
    PERFORM invalidar_links_orcamento_pendentes(NEW.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invalidar_link_os_financeiro ON os;
CREATE TRIGGER trg_invalidar_link_os_financeiro
  AFTER UPDATE ON os
  FOR EACH ROW
  EXECUTE FUNCTION trg_invalidar_link_on_os_change();

-- Trigger na tabela os_pecas: invalida quando peça é adicionada, alterada ou removida
CREATE OR REPLACE FUNCTION trg_invalidar_link_on_peca_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_os_id uuid;
BEGIN
  v_os_id := COALESCE(NEW.os_id, OLD.os_id);
  IF v_os_id IS NOT NULL THEN
    PERFORM invalidar_links_orcamento_pendentes(v_os_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_invalidar_link_pecas ON os_pecas;
CREATE TRIGGER trg_invalidar_link_pecas
  AFTER INSERT OR UPDATE OR DELETE ON os_pecas
  FOR EACH ROW
  EXECUTE FUNCTION trg_invalidar_link_on_peca_change();

-- Trigger na tabela os_servicos: invalida quando serviço é adicionado, alterado ou removido
CREATE OR REPLACE FUNCTION trg_invalidar_link_on_servico_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_os_id uuid;
BEGIN
  v_os_id := COALESCE(NEW.os_id, OLD.os_id);
  IF v_os_id IS NOT NULL THEN
    PERFORM invalidar_links_orcamento_pendentes(v_os_id);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_invalidar_link_servicos ON os_servicos;
CREATE TRIGGER trg_invalidar_link_servicos
  AFTER INSERT OR UPDATE OR DELETE ON os_servicos
  FOR EACH ROW
  EXECUTE FUNCTION trg_invalidar_link_on_servico_change();
