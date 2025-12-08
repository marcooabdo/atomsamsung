/*
  # Sistema Completo de Rastreamento de Peças

  1. Descrição
    - Registra TODAS as movimentações de peças no histórico
    - Captura: entrada, saída, transferência, requisição, devolução
    - Sempre com: usuário, data/hora, status anterior/novo, observações

  2. Eventos Rastreados
    - Entrada de NF (criação da peça)
    - Mudança de status
    - Atribuição a técnico
    - Vinculação a OS
    - Requisição de peça
    - Aprovação/reprovação de requisição
    - Devolução de peça
    - Mudança de localização
    - Qualquer alteração relevante

  3. Formato do Histórico
    - Ação clara e descritiva
    - Status anterior → Status novo
    - Usuário que realizou
    - Data e hora automática
    - Observações contextuais
*/

-- ============================================
-- TRIGGER: Movimentação de Peças do Estoque
-- ============================================
CREATE OR REPLACE FUNCTION log_estoque_pecas_movement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_nome text;
  v_usuario_id uuid;
  v_acao text;
  v_observacao text;
  v_tecnico_nome text;
  v_os_numero text;
BEGIN
  v_usuario_id := COALESCE(auth.uid(), NEW.tecnico_id, OLD.tecnico_id);
  SELECT nome INTO v_usuario_nome FROM usuarios WHERE id = v_usuario_id;

  -- INSERT: Entrada de peça (NF)
  IF (TG_OP = 'INSERT') THEN
    INSERT INTO estoque_historico (
      peca_id,
      usuario_id,
      acao,
      status_anterior,
      status_novo,
      observacao
    ) VALUES (
      NEW.id,
      v_usuario_id,
      'entrada_nf',
      NULL,
      NEW.status,
      format('📦 ENTRADA por %s - PN: %s - %s - R$ %s',
        COALESCE(v_usuario_nome, 'Sistema'),
        NEW.pn,
        COALESCE(NEW.descricao, 'Sem descrição'),
        to_char(NEW.valor_com_impostos, 'FM999G999G990D00'))
    );
    RETURN NEW;
  END IF;

  -- UPDATE: Rastrear mudanças
  IF (TG_OP = 'UPDATE') THEN
    
    -- Mudança de STATUS
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
      v_observacao := format('🔄 MUDANÇA DE STATUS por %s: %s → %s',
        COALESCE(v_usuario_nome, 'Sistema'),
        OLD.status,
        NEW.status
      );

      -- Adicionar contexto específico por tipo de mudança
      IF (NEW.status = 'vinculada_tecnico') THEN
        SELECT nome INTO v_tecnico_nome FROM usuarios WHERE id = NEW.tecnico_id;
        v_observacao := v_observacao || format(' - Técnico: %s', COALESCE(v_tecnico_nome, 'N/A'));
      ELSIF (NEW.status = 'em_uso' AND NEW.os_id IS NOT NULL) THEN
        SELECT numero_os_samsung INTO v_os_numero FROM os WHERE id = NEW.os_id;
        v_observacao := v_observacao || format(' - OS: %s', COALESCE(v_os_numero, 'N/A'));
      ELSIF (NEW.status IN ('devolvida_nova', 'devolvida_defeito', 'usada')) THEN
        v_observacao := v_observacao || ' - Peça retornou ao estoque';
      END IF;

      INSERT INTO estoque_historico (
        peca_id,
        usuario_id,
        acao,
        status_anterior,
        status_novo,
        observacao
      ) VALUES (
        NEW.id,
        v_usuario_id,
        'mudanca_status',
        OLD.status,
        NEW.status,
        v_observacao
      );
    END IF;

    -- Atribuição/Mudança de TÉCNICO
    IF (OLD.tecnico_id IS DISTINCT FROM NEW.tecnico_id) THEN
      DECLARE
        v_old_tecnico text;
        v_new_tecnico text;
      BEGIN
        SELECT nome INTO v_old_tecnico FROM usuarios WHERE id = OLD.tecnico_id;
        SELECT nome INTO v_new_tecnico FROM usuarios WHERE id = NEW.tecnico_id;
        
        INSERT INTO estoque_historico (
          peca_id,
          usuario_id,
          acao,
          observacao
        ) VALUES (
          NEW.id,
          v_usuario_id,
          'atribuicao_tecnico',
          format('👤 TÉCNICO alterado por %s: %s → %s',
            COALESCE(v_usuario_nome, 'Sistema'),
            COALESCE(v_old_tecnico, 'Não atribuído'),
            COALESCE(v_new_tecnico, 'Não atribuído'))
        );
      END;
    END IF;

    -- Vinculação/Mudança de OS
    IF (OLD.os_id IS DISTINCT FROM NEW.os_id) THEN
      DECLARE
        v_old_os text;
        v_new_os text;
      BEGIN
        SELECT numero_os_samsung INTO v_old_os FROM os WHERE id = OLD.os_id;
        SELECT numero_os_samsung INTO v_new_os FROM os WHERE id = NEW.os_id;
        
        INSERT INTO estoque_historico (
          peca_id,
          usuario_id,
          acao,
          observacao
        ) VALUES (
          NEW.id,
          v_usuario_id,
          'vinculacao_os',
          format('📋 OS alterada por %s: %s → %s',
            COALESCE(v_usuario_nome, 'Sistema'),
            COALESCE(v_old_os, 'Sem OS'),
            COALESCE(v_new_os, 'Sem OS'))
        );
      END;
    END IF;

    -- Mudança de LOCALIZAÇÃO
    IF (OLD.sala_id IS DISTINCT FROM NEW.sala_id OR 
        OLD.estante_id IS DISTINCT FROM NEW.estante_id OR 
        OLD.bin_id IS DISTINCT FROM NEW.bin_id) THEN
      
      DECLARE
        v_old_loc text;
        v_new_loc text;
      BEGIN
        -- Montar descrição da localização antiga
        IF OLD.sala_id IS NOT NULL THEN
          SELECT nome INTO v_old_loc FROM estoque_salas WHERE id = OLD.sala_id;
          IF OLD.estante_id IS NOT NULL THEN
            v_old_loc := v_old_loc || ' / ' || (SELECT codigo FROM estoque_estantes WHERE id = OLD.estante_id);
            IF OLD.bin_id IS NOT NULL THEN
              v_old_loc := v_old_loc || ' / ' || (SELECT codigo FROM estoque_bins WHERE id = OLD.bin_id);
            END IF;
          END IF;
        ELSE
          v_old_loc := 'Sem localização';
        END IF;

        -- Montar descrição da localização nova
        IF NEW.sala_id IS NOT NULL THEN
          SELECT nome INTO v_new_loc FROM estoque_salas WHERE id = NEW.sala_id;
          IF NEW.estante_id IS NOT NULL THEN
            v_new_loc := v_new_loc || ' / ' || (SELECT codigo FROM estoque_estantes WHERE id = NEW.estante_id);
            IF NEW.bin_id IS NOT NULL THEN
              v_new_loc := v_new_loc || ' / ' || (SELECT codigo FROM estoque_bins WHERE id = NEW.bin_id);
            END IF;
          END IF;
        ELSE
          v_new_loc := 'Sem localização';
        END IF;

        INSERT INTO estoque_historico (
          peca_id,
          usuario_id,
          acao,
          origem,
          destino,
          observacao
        ) VALUES (
          NEW.id,
          v_usuario_id,
          'movimentacao',
          v_old_loc,
          v_new_loc,
          format('📍 LOCALIZAÇÃO alterada por %s', COALESCE(v_usuario_nome, 'Sistema'))
        );
      END;
    END IF;

  END IF;

  RETURN NEW;
END;
$$;

-- Criar trigger para estoque_pecas
DROP TRIGGER IF EXISTS trigger_log_estoque_pecas_movement ON estoque_pecas;
CREATE TRIGGER trigger_log_estoque_pecas_movement
  AFTER INSERT OR UPDATE ON estoque_pecas
  FOR EACH ROW
  EXECUTE FUNCTION log_estoque_pecas_movement();

-- ============================================
-- TRIGGER: Requisições de Peças
-- ============================================
CREATE OR REPLACE FUNCTION log_requisicoes_pecas_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_nome text;
  v_peca_info text;
BEGIN
  SELECT nome INTO v_usuario_nome FROM usuarios WHERE id = auth.uid();

  IF (TG_OP = 'INSERT') THEN
    -- Buscar info da peça se existir
    IF NEW.peca_estoque_id IS NOT NULL THEN
      SELECT format('%s - %s', pn, descricao) INTO v_peca_info 
      FROM estoque_pecas WHERE id = NEW.peca_estoque_id;
    ELSE
      v_peca_info := format('%s - %s', NEW.codigo_peca, NEW.descricao);
    END IF;

    -- Registrar no histórico da peça se houver peça vinculada
    IF NEW.peca_estoque_id IS NOT NULL THEN
      INSERT INTO estoque_historico (
        peca_id,
        usuario_id,
        acao,
        observacao
      ) VALUES (
        NEW.peca_estoque_id,
        COALESCE(auth.uid(), NEW.requisitado_por),
        'requisicao',
        format('📝 REQUISIÇÃO CRIADA por %s - Status: %s - Qtd: %s',
          COALESCE(v_usuario_nome, 'Sistema'),
          NEW.status,
          NEW.quantidade_requisitada)
      );
    END IF;

  ELSIF (TG_OP = 'UPDATE') THEN
    -- Mudança de status da requisição
    IF (OLD.status IS DISTINCT FROM NEW.status AND NEW.peca_estoque_id IS NOT NULL) THEN
      DECLARE
        v_status_msg text;
      BEGIN
        CASE NEW.status
          WHEN 'aprovada' THEN
            v_status_msg := '✅ REQUISIÇÃO APROVADA';
          WHEN 'reprovada' THEN
            v_status_msg := '❌ REQUISIÇÃO REPROVADA';
          WHEN 'devolvida' THEN
            v_status_msg := '🔙 PEÇA DEVOLVIDA';
          WHEN 'gi_postada' THEN
            v_status_msg := '📤 GI POSTADA';
          WHEN 'devolucao_pendente' THEN
            v_status_msg := '⏳ DEVOLUÇÃO PENDENTE';
          ELSE
            v_status_msg := format('🔄 STATUS: %s', NEW.status);
        END CASE;

        INSERT INTO estoque_historico (
          peca_id,
          usuario_id,
          acao,
          status_anterior,
          status_novo,
          observacao
        ) VALUES (
          NEW.peca_estoque_id,
          COALESCE(auth.uid(), NEW.requisitado_por),
          'requisicao_status',
          OLD.status,
          NEW.status,
          format('%s por %s', v_status_msg, COALESCE(v_usuario_nome, 'Sistema'))
        );
      END;
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Criar trigger para requisicoes_pecas
DROP TRIGGER IF EXISTS trigger_log_requisicoes_pecas_changes ON requisicoes_pecas;
CREATE TRIGGER trigger_log_requisicoes_pecas_changes
  AFTER INSERT OR UPDATE ON requisicoes_pecas
  FOR EACH ROW
  EXECUTE FUNCTION log_requisicoes_pecas_changes();

COMMENT ON FUNCTION log_estoque_pecas_movement IS 'Registra todas as movimentações de peças: entrada, status, técnico, OS, localização';
COMMENT ON FUNCTION log_requisicoes_pecas_changes IS 'Registra criação e mudanças de status de requisições de peças';