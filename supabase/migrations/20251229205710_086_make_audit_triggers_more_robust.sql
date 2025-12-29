/*
  # Torna Triggers de Auditoria Mais Robustos

  1. Problema
    - Triggers podem falhar silenciosamente causando erro 400 ao mover cards
    - Acessos a campos nulos ou joins podem causar problemas
    - Erros não são capturados adequadamente
  
  2. Soluções
    - Adiciona verificação de null em TODOS os acessos
    - Simplifica lógica para evitar subqueries complexas
    - Garante que erros não quebrem a operação principal
    - Adiciona logs de debug para rastreamento

  3. Impacto
    - Movimentação de cards no Kanban funcionará mesmo com erros de log
    - Melhor rastreabilidade de problemas
    - Sistema mais estável e resiliente
*/

-- Recriar função criar_log_os com tratamento de erro melhorado
CREATE OR REPLACE FUNCTION criar_log_os(
  p_os_id uuid,
  p_usuario_id uuid,
  p_comentario text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Só criar log se a OS existir e for válida
  IF p_os_id IS NULL THEN
    RETURN;
  END IF;

  -- Tentar inserir, mas não falhar se houver erro
  BEGIN
    INSERT INTO os_comentarios (os_id, usuario_id, comentario, is_system)
    VALUES (
      p_os_id, 
      COALESCE(p_usuario_id, (SELECT id FROM usuarios WHERE tipo = 'master' LIMIT 1)), 
      p_comentario, 
      true
    );
  EXCEPTION
    WHEN OTHERS THEN
      -- Log do erro sem quebrar a operação
      RAISE WARNING 'Erro ao criar log de OS: %', SQLERRM;
  END;
END;
$$;

-- Simplificar trigger de OS para ser mais robusto
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
        format('✨ OS CRIADA por %s', v_usuario_nome)
      );
      RETURN NEW;
    END IF;

    IF (TG_OP = 'UPDATE') THEN
      -- Coluna Kanban
      IF (OLD.coluna_kanban IS DISTINCT FROM NEW.coluna_kanban) THEN
        v_log_parts := array_append(v_log_parts,
          format('📋 Coluna: %s → %s', 
            COALESCE(OLD.coluna_kanban, 'N/A'), 
            COALESCE(NEW.coluna_kanban, 'N/A'))
        );
      END IF;

      -- Técnico atribuído (simplificado)
      IF (OLD.tecnico_id IS DISTINCT FROM NEW.tecnico_id) THEN
        v_log_parts := array_append(v_log_parts,
          format('👤 Técnico alterado')
        );
      END IF;

      -- Dados do cliente
      IF (OLD.cliente_nome IS DISTINCT FROM NEW.cliente_nome) THEN
        v_log_parts := array_append(v_log_parts, '👥 Cliente alterado');
      END IF;

      IF (OLD.cliente_telefone IS DISTINCT FROM NEW.cliente_telefone) THEN
        v_log_parts := array_append(v_log_parts, '📱 Telefone alterado');
      END IF;

      IF (OLD.endereco IS DISTINCT FROM NEW.endereco) THEN
        v_log_parts := array_append(v_log_parts, '📍 Endereço alterado');
      END IF;

      IF (OLD.produto_modelo IS DISTINCT FROM NEW.produto_modelo) THEN
        v_log_parts := array_append(v_log_parts, '📱 Modelo alterado');
      END IF;

      IF (OLD.imei IS DISTINCT FROM NEW.imei) THEN
        v_log_parts := array_append(v_log_parts, '🔢 IMEI alterado');
      END IF;

      IF (OLD.defeito_relatado IS DISTINCT FROM NEW.defeito_relatado) THEN
        v_log_parts := array_append(v_log_parts, '⚠️ Defeito alterado');
      END IF;

      IF (OLD.observacoes IS DISTINCT FROM NEW.observacoes) THEN
        v_log_parts := array_append(v_log_parts, '📝 Observações alteradas');
      END IF;

      IF (OLD.diagnostico IS DISTINCT FROM NEW.diagnostico) THEN
        v_log_parts := array_append(v_log_parts, '🔍 Diagnóstico alterado');
      END IF;

      IF (OLD.solucao_aplicada IS DISTINCT FROM NEW.solucao_aplicada) THEN
        v_log_parts := array_append(v_log_parts, '✅ Solução aplicada alterada');
      END IF;

      IF (OLD.data_agendamento IS DISTINCT FROM NEW.data_agendamento) THEN
        v_log_parts := array_append(v_log_parts, '📅 Agendamento alterado');
      END IF;

      IF (OLD.confirmado_com_cliente IS DISTINCT FROM NEW.confirmado_com_cliente) THEN
        v_log_parts := array_append(v_log_parts, '✔️ Confirmação alterada');
      END IF;

      -- Registrar log apenas se houver alterações
      IF array_length(v_log_parts, 1) > 0 THEN
        PERFORM criar_log_os(
          NEW.id,
          v_usuario_id,
          format('🔄 ALTERAÇÕES por %s:%s%s',
            v_usuario_nome,
            E'\n',
            array_to_string(v_log_parts, E'\n'))
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

-- Recriar trigger
DROP TRIGGER IF EXISTS trigger_log_os_changes ON os;
CREATE TRIGGER trigger_log_os_changes
  AFTER INSERT OR UPDATE ON os
  FOR EACH ROW
  EXECUTE FUNCTION log_os_changes();