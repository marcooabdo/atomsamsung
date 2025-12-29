/*
  # Corrige Trigger de Auditoria da OS

  1. Problema
    - Trigger tentava acessar campo 'status' que não existe na tabela 'os'
    - Causava erro ao mover cards no Kanban
  
  2. Solução
    - Remove verificação do campo 'status' inexistente
    - Mantém verificação do campo 'coluna_kanban' que é o correto

  3. Impacto
    - Corrige erro "record 'old' has no field 'status'"
    - Permite movimentação de cards no Kanban sem erros
*/

-- Recriar função log_os_changes sem referência ao campo status inexistente
CREATE OR REPLACE FUNCTION log_os_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_nome text;
  v_log_parts text[];
  v_usuario_id uuid;
BEGIN
  v_usuario_id := auth.uid();
  SELECT nome INTO v_usuario_nome FROM usuarios WHERE id = v_usuario_id;
  v_log_parts := ARRAY[]::text[];

  IF (TG_OP = 'INSERT') THEN
    PERFORM criar_log_os(
      NEW.id,
      v_usuario_id,
      format('✨ OS CRIADA por %s', COALESCE(v_usuario_nome, 'Sistema'))
    );
    RETURN NEW;
  END IF;

  IF (TG_OP = 'UPDATE') THEN
    -- Coluna Kanban (representa o status da OS)
    IF (OLD.coluna_kanban IS DISTINCT FROM NEW.coluna_kanban) THEN
      v_log_parts := array_append(v_log_parts,
        format('📋 Coluna: %s → %s', COALESCE(OLD.coluna_kanban, 'N/A'), COALESCE(NEW.coluna_kanban, 'N/A'))
      );
    END IF;

    -- Técnico atribuído
    IF (OLD.tecnico_id IS DISTINCT FROM NEW.tecnico_id) THEN
      DECLARE
        v_old_tecnico text;
        v_new_tecnico text;
      BEGIN
        SELECT nome INTO v_old_tecnico FROM usuarios WHERE id = OLD.tecnico_id;
        SELECT nome INTO v_new_tecnico FROM usuarios WHERE id = NEW.tecnico_id;
        v_log_parts := array_append(v_log_parts,
          format('👤 Técnico: %s → %s', 
            COALESCE(v_old_tecnico, 'Não atribuído'), 
            COALESCE(v_new_tecnico, 'Não atribuído'))
        );
      END;
    END IF;

    -- Nome do cliente
    IF (OLD.cliente_nome IS DISTINCT FROM NEW.cliente_nome) THEN
      v_log_parts := array_append(v_log_parts,
        format('👥 Cliente: %s → %s', COALESCE(OLD.cliente_nome, 'N/A'), COALESCE(NEW.cliente_nome, 'N/A'))
      );
    END IF;

    -- Telefone
    IF (OLD.cliente_telefone IS DISTINCT FROM NEW.cliente_telefone) THEN
      v_log_parts := array_append(v_log_parts,
        format('📱 Telefone: %s → %s', COALESCE(OLD.cliente_telefone, 'N/A'), COALESCE(NEW.cliente_telefone, 'N/A'))
      );
    END IF;

    -- Endereço
    IF (OLD.endereco IS DISTINCT FROM NEW.endereco) THEN
      v_log_parts := array_append(v_log_parts,
        format('📍 Endereço alterado')
      );
    END IF;

    -- Modelo do produto
    IF (OLD.produto_modelo IS DISTINCT FROM NEW.produto_modelo) THEN
      v_log_parts := array_append(v_log_parts,
        format('📱 Modelo: %s → %s', COALESCE(OLD.produto_modelo, 'N/A'), COALESCE(NEW.produto_modelo, 'N/A'))
      );
    END IF;

    -- IMEI
    IF (OLD.imei IS DISTINCT FROM NEW.imei) THEN
      v_log_parts := array_append(v_log_parts,
        format('🔢 IMEI: %s → %s', COALESCE(OLD.imei, 'N/A'), COALESCE(NEW.imei, 'N/A'))
      );
    END IF;

    -- Defeito relatado
    IF (OLD.defeito_relatado IS DISTINCT FROM NEW.defeito_relatado) THEN
      v_log_parts := array_append(v_log_parts,
        format('⚠️ Defeito alterado')
      );
    END IF;

    -- Observações
    IF (OLD.observacoes IS DISTINCT FROM NEW.observacoes) THEN
      v_log_parts := array_append(v_log_parts,
        format('📝 Observações alteradas')
      );
    END IF;

    -- Diagnóstico
    IF (OLD.diagnostico IS DISTINCT FROM NEW.diagnostico) THEN
      v_log_parts := array_append(v_log_parts,
        format('🔍 Diagnóstico alterado')
      );
    END IF;

    -- Solução aplicada
    IF (OLD.solucao_aplicada IS DISTINCT FROM NEW.solucao_aplicada) THEN
      v_log_parts := array_append(v_log_parts,
        format('✅ Solução aplicada alterada')
      );
    END IF;

    -- Agendamento
    IF (OLD.data_agendamento IS DISTINCT FROM NEW.data_agendamento) THEN
      v_log_parts := array_append(v_log_parts,
        format('📅 Agendamento: %s → %s',
          COALESCE(to_char(OLD.data_agendamento, 'DD/MM/YYYY HH24:MI'), 'Não agendado'),
          COALESCE(to_char(NEW.data_agendamento, 'DD/MM/YYYY HH24:MI'), 'Não agendado'))
      );
    END IF;

    -- Confirmação com cliente
    IF (OLD.confirmado_com_cliente IS DISTINCT FROM NEW.confirmado_com_cliente) THEN
      v_log_parts := array_append(v_log_parts,
        format('✔️ Confirmação: %s → %s',
          CASE WHEN OLD.confirmado_com_cliente THEN 'Confirmado' ELSE 'Não confirmado' END,
          CASE WHEN NEW.confirmado_com_cliente THEN 'Confirmado' ELSE 'Não confirmado' END)
      );
    END IF;

    -- Se houver alterações, registrar log
    IF array_length(v_log_parts, 1) > 0 THEN
      PERFORM criar_log_os(
        NEW.id,
        COALESCE(v_usuario_id, NEW.tecnico_id, OLD.tecnico_id),
        format('🔄 ALTERAÇÕES por %s:%s%s',
          COALESCE(v_usuario_nome, 'Sistema'),
          E'\n',
          array_to_string(v_log_parts, E'\n'))
      );
    END IF;
  END IF;

  RETURN NEW;
END;
$$;