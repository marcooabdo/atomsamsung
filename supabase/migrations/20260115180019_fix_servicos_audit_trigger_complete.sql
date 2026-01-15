/*
  # Corrige Trigger de Auditoria de Servicos

  1. Problema
    - O trigger antigo usava campo 'preco_final' que nao existe
    - Nao capturava alteracoes de quantidade
    - Nao considerava os_id direto (sem cotacao)

  2. Solucao
    - Usar campos corretos: valor_unitario, valor_total, quantidade
    - Buscar os_id direto ou via cotacao
    - Logar todas alteracoes: quantidade, valor_unitario, valor_total
    - Incluir nome do usuario que fez a alteracao
*/

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

  -- Buscar OS diretamente ou via cotacao
  v_os_id := COALESCE(NEW.os_id, OLD.os_id);
  IF v_os_id IS NULL THEN
    SELECT os_id INTO v_os_id FROM cotacoes WHERE id = COALESCE(NEW.cotacao_id, OLD.cotacao_id);
  END IF;

  IF (TG_OP = 'INSERT') THEN
    SELECT nome INTO v_servico_nome FROM servicos WHERE id = NEW.servico_id;
    
    PERFORM criar_log_os(
      v_os_id,
      auth.uid(),
      format('[SERVICO ADICIONADO] %s adicionou: %s - Qtd: %s x R$ %s = R$ %s',
        COALESCE(v_usuario_nome, 'Sistema'),
        COALESCE(v_servico_nome, COALESCE(NEW.descricao, 'Servico')),
        COALESCE(NEW.quantidade, 1),
        COALESCE(to_char(NEW.valor_unitario, 'FM999G999G990D00'), '0,00'),
        COALESCE(to_char(NEW.valor_total, 'FM999G999G990D00'), '0,00'))
    );
    
  ELSIF (TG_OP = 'DELETE') THEN
    SELECT nome INTO v_servico_nome FROM servicos WHERE id = OLD.servico_id;
    
    PERFORM criar_log_os(
      v_os_id,
      auth.uid(),
      format('[SERVICO REMOVIDO] %s removeu: %s (era R$ %s)',
        COALESCE(v_usuario_nome, 'Sistema'),
        COALESCE(v_servico_nome, COALESCE(OLD.descricao, 'Servico')),
        COALESCE(to_char(OLD.valor_total, 'FM999G999G990D00'), '0,00'))
    );
    
  ELSIF (TG_OP = 'UPDATE') THEN
    SELECT nome INTO v_servico_nome FROM servicos WHERE id = NEW.servico_id;
    
    -- Alteracao de quantidade
    IF (OLD.quantidade IS DISTINCT FROM NEW.quantidade) THEN
      PERFORM criar_log_os(
        v_os_id,
        auth.uid(),
        format('[SERVICO ATUALIZADO] %s alterou quantidade de "%s": %s -> %s unidades',
          COALESCE(v_usuario_nome, 'Sistema'),
          COALESCE(v_servico_nome, COALESCE(NEW.descricao, 'Servico')),
          COALESCE(OLD.quantidade, 0),
          COALESCE(NEW.quantidade, 0))
      );
    END IF;
    
    -- Alteracao de valor unitario
    IF (OLD.valor_unitario IS DISTINCT FROM NEW.valor_unitario) THEN
      PERFORM criar_log_os(
        v_os_id,
        auth.uid(),
        format('[SERVICO ATUALIZADO] %s alterou valor de "%s": R$ %s -> R$ %s',
          COALESCE(v_usuario_nome, 'Sistema'),
          COALESCE(v_servico_nome, COALESCE(NEW.descricao, 'Servico')),
          COALESCE(to_char(OLD.valor_unitario, 'FM999G999G990D00'), '0,00'),
          COALESCE(to_char(NEW.valor_unitario, 'FM999G999G990D00'), '0,00'))
      );
    END IF;
    
    -- Alteracao de valor total (caso mude sem mudar unitario/quantidade)
    IF (OLD.valor_total IS DISTINCT FROM NEW.valor_total) 
       AND (OLD.quantidade IS NOT DISTINCT FROM NEW.quantidade)
       AND (OLD.valor_unitario IS NOT DISTINCT FROM NEW.valor_unitario) THEN
      PERFORM criar_log_os(
        v_os_id,
        auth.uid(),
        format('[SERVICO ATUALIZADO] %s alterou total de "%s": R$ %s -> R$ %s',
          COALESCE(v_usuario_nome, 'Sistema'),
          COALESCE(v_servico_nome, COALESCE(NEW.descricao, 'Servico')),
          COALESCE(to_char(OLD.valor_total, 'FM999G999G990D00'), '0,00'),
          COALESCE(to_char(NEW.valor_total, 'FM999G999G990D00'), '0,00'))
      );
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recriar o trigger
DROP TRIGGER IF EXISTS trigger_log_servicos_changes ON cotacoes_servicos;
CREATE TRIGGER trigger_log_servicos_changes
  AFTER INSERT OR UPDATE OR DELETE ON cotacoes_servicos
  FOR EACH ROW
  EXECUTE FUNCTION log_servicos_changes();
