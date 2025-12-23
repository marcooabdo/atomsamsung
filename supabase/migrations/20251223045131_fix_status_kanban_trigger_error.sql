/*
  # Corrige Erro status_kanban em Triggers

  1. Problema
    - Erro: record "new" has no field "status_kanban"
    - Pode haver triggers antigos ainda referenciando campo incorreto
  
  2. Solução
    - Recria todos os triggers que podem estar acessando campos da tabela OS
    - Garante uso correto de coluna_kanban (não status_kanban)
    - Simplifica lógica para evitar erros
  
  3. Segurança
    - Mantém todas as políticas RLS existentes
    - Não afeta dados existentes
*/

-- Recriar função de movimentação após checkout com verificação correta
CREATE OR REPLACE FUNCTION mover_os_kanban_apos_checkout()
RETURNS TRIGGER AS $$
DECLARE
  v_os_id uuid;
BEGIN
  -- Verificar se checkout foi aprovado (não pendente)
  IF NEW.checkout_pendente = false AND OLD.checkout_pendente = true THEN
    -- Buscar OS vinculada ao agendamento
    SELECT id INTO v_os_id
    FROM os
    WHERE agendamento_id = NEW.id;
    
    IF v_os_id IS NOT NULL THEN
      -- Mover para fechar_os
      UPDATE os 
      SET 
        coluna_kanban = 'fechar_os',
        updated_at = now()
      WHERE id = v_os_id;

      -- Adicionar comentário no sistema
      INSERT INTO os_comentarios (os_id, usuario_id, comentario, is_system)
      VALUES (
        v_os_id,
        auth.uid(),
        'OS movida automaticamente para "Fechar OS" após conclusão do atendimento',
        true
      );
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Não quebrar a operação se houver erro
    RAISE WARNING 'Erro ao mover OS após checkout: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recriar trigger de checkout
DROP TRIGGER IF EXISTS trigger_mover_os_kanban_apos_checkout ON agendamentos;
CREATE TRIGGER trigger_mover_os_kanban_apos_checkout
  AFTER UPDATE ON agendamentos
  FOR EACH ROW
  WHEN (OLD.checkout_pendente IS DISTINCT FROM NEW.checkout_pendente)
  EXECUTE FUNCTION mover_os_kanban_apos_checkout();

-- Garantir que o trigger de log de OS está correto
CREATE OR REPLACE FUNCTION log_os_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_nome text := 'Sistema';
  v_log_parts text[];
  v_usuario_id uuid;
BEGIN
  -- Capturar qualquer erro e não quebrar a operação
  BEGIN
    v_usuario_id := auth.uid();
    
    -- Buscar nome do usuário com fallback
    IF v_usuario_id IS NOT NULL THEN
      SELECT nome INTO v_usuario_nome FROM usuarios WHERE id = v_usuario_id;
      v_usuario_nome := COALESCE(v_usuario_nome, 'Sistema');
    END IF;

    v_log_parts := ARRAY[]::text[];

    IF (TG_OP = 'INSERT') THEN
      PERFORM criar_log_os(
        NEW.id,
        v_usuario_id,
        format('OS CRIADA por %s', v_usuario_nome)
      );
      RETURN NEW;
    END IF;

    IF (TG_OP = 'UPDATE') THEN
      -- Coluna Kanban (usar coluna_kanban, NÃO status_kanban)
      IF (OLD.coluna_kanban IS DISTINCT FROM NEW.coluna_kanban) THEN
        v_log_parts := array_append(v_log_parts,
          format('Coluna: %s -> %s', 
            COALESCE(OLD.coluna_kanban, 'N/A'), 
            COALESCE(NEW.coluna_kanban, 'N/A'))
        );
      END IF;

      -- Técnico atribuído
      IF (OLD.tecnico_id IS DISTINCT FROM NEW.tecnico_id) THEN
        v_log_parts := array_append(v_log_parts, 'Técnico alterado');
      END IF;

      -- Dados importantes
      IF (OLD.cliente_nome IS DISTINCT FROM NEW.cliente_nome) THEN
        v_log_parts := array_append(v_log_parts, 'Cliente alterado');
      END IF;

      IF (OLD.produto_modelo IS DISTINCT FROM NEW.produto_modelo) THEN
        v_log_parts := array_append(v_log_parts, 'Modelo alterado');
      END IF;

      IF (OLD.defeito_relatado IS DISTINCT FROM NEW.defeito_relatado) THEN
        v_log_parts := array_append(v_log_parts, 'Defeito alterado');
      END IF;

      -- Registrar log apenas se houver alterações
      IF array_length(v_log_parts, 1) > 0 THEN
        PERFORM criar_log_os(
          NEW.id,
          v_usuario_id,
          format('ALTERAÇÕES por %s: %s',
            v_usuario_nome,
            array_to_string(v_log_parts, ', '))
        );
      END IF;
    END IF;

    RETURN NEW;

  EXCEPTION
    WHEN OTHERS THEN
      -- Log do erro mas não quebrar a operação
      RAISE WARNING 'Erro no trigger de auditoria de OS: %', SQLERRM;
      RETURN NEW;
  END;
END;
$$;

-- Recriar trigger de log
DROP TRIGGER IF EXISTS trigger_log_os_changes ON os;
CREATE TRIGGER trigger_log_os_changes
  AFTER INSERT OR UPDATE ON os
  FOR EACH ROW
  EXECUTE FUNCTION log_os_changes();