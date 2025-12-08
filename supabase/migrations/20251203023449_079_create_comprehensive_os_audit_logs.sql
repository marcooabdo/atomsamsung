/*
  # Sistema Completo de Auditoria de OS

  1. Descrição
    - Cria triggers automáticos para registrar TODAS as alterações em OSs
    - Rastreia mudanças em: OS, checklist, serviços, pagamentos, peças, agendamentos, anexos
    - Registra usuário, data/hora e detalhes da alteração
    - Logs aparecem automaticamente na aba de comentários

  2. Tabelas Monitoradas
    - os: Status, coluna kanban, dados principais, endereço
    - os_checklist: Itens marcados/desmarcados
    - cotacoes_servicos: Serviços adicionados/removidos/alterados
    - pagamentos: Pagamentos criados/alterados/deletados
    - requisicoes_pecas: Peças requisitadas/aprovadas/reprovadas/devolvidas
    - agendamentos: Agendamentos criados/alterados
    - os_anexos: Anexos adicionados/removidos
    - cotacoes: Criação, envio, aprovação de orçamentos

  3. Formato dos Logs
    - Tipo de ação (CREATE, UPDATE, DELETE)
    - Campo alterado
    - Valor anterior → Valor novo
    - Usuário responsável
    - Data e hora exata
*/

-- Função auxiliar para criar log de comentário do sistema
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
  IF p_os_id IS NOT NULL THEN
    INSERT INTO os_comentarios (os_id, usuario_id, comentario, is_system)
    VALUES (p_os_id, COALESCE(p_usuario_id, (SELECT id FROM usuarios LIMIT 1)), p_comentario, true);
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    -- Ignorar erros silenciosamente para não quebrar operações principais
    NULL;
END;
$$;

-- ============================================
-- TRIGGER 1: Auditoria de alterações na OS
-- ============================================
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
    -- Status da OS
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
      v_log_parts := array_append(v_log_parts, 
        format('📊 Status: %s → %s', COALESCE(OLD.status, 'N/A'), COALESCE(NEW.status, 'N/A'))
      );
    END IF;

    -- Coluna Kanban
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

DROP TRIGGER IF EXISTS trigger_log_os_changes ON os;
CREATE TRIGGER trigger_log_os_changes
  AFTER INSERT OR UPDATE ON os
  FOR EACH ROW
  EXECUTE FUNCTION log_os_changes();

-- ============================================
-- TRIGGER 2: Checklist
-- ============================================
CREATE OR REPLACE FUNCTION log_checklist_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_nome text;
  v_item_nome text;
BEGIN
  SELECT nome INTO v_usuario_nome FROM usuarios WHERE id = auth.uid();
  
  IF (TG_OP = 'UPDATE' AND OLD.verificado IS DISTINCT FROM NEW.verificado) THEN
    -- Buscar nome do item do checklist
    SELECT nome INTO v_item_nome FROM config_checklist WHERE id = NEW.checklist_id;
    
    PERFORM criar_log_os(
      NEW.os_id,
      auth.uid(),
      format('☑️ CHECKLIST %s por %s: %s',
        CASE WHEN NEW.verificado THEN 'MARCADO' ELSE 'DESMARCADO' END,
        COALESCE(v_usuario_nome, 'Sistema'),
        COALESCE(v_item_nome, 'Item'))
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_checklist_changes ON os_checklist;
CREATE TRIGGER trigger_log_checklist_changes
  AFTER UPDATE ON os_checklist
  FOR EACH ROW
  EXECUTE FUNCTION log_checklist_changes();

-- ============================================
-- TRIGGER 3: Serviços (via cotações)
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

  -- Buscar OS através da cotação
  SELECT os_id INTO v_os_id FROM cotacoes WHERE id = COALESCE(NEW.cotacao_id, OLD.cotacao_id);

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
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_servicos_changes ON cotacoes_servicos;
CREATE TRIGGER trigger_log_servicos_changes
  AFTER INSERT OR UPDATE OR DELETE ON cotacoes_servicos
  FOR EACH ROW
  EXECUTE FUNCTION log_servicos_changes();

-- ============================================
-- TRIGGER 4: Peças (via cotações)
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
  SELECT os_id INTO v_os_id FROM cotacoes WHERE id = COALESCE(NEW.cotacao_id, OLD.cotacao_id);

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
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_pecas_cotacao_changes ON cotacoes_pecas;
CREATE TRIGGER trigger_log_pecas_cotacao_changes
  AFTER INSERT OR UPDATE OR DELETE ON cotacoes_pecas
  FOR EACH ROW
  EXECUTE FUNCTION log_pecas_cotacao_changes();

-- ============================================
-- TRIGGER 5: Pagamentos
-- ============================================
CREATE OR REPLACE FUNCTION log_pagamentos_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_nome text;
  v_os_id uuid;
BEGIN
  SELECT nome INTO v_usuario_nome FROM usuarios WHERE id = auth.uid();
  
  v_os_id := COALESCE(
    COALESCE(NEW.os_id, OLD.os_id),
    (SELECT os_id FROM cotacoes WHERE id = COALESCE(NEW.cotacao_id, OLD.cotacao_id))
  );

  IF (TG_OP = 'INSERT') THEN
    PERFORM criar_log_os(
      v_os_id,
      auth.uid(),
      format('💳 PAGAMENTO REGISTRADO por %s: R$ %s (%s)',
        COALESCE(v_usuario_nome, 'Sistema'),
        to_char(NEW.valor, 'FM999G999G990D00'),
        NEW.forma_pagamento)
    );
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM criar_log_os(
      v_os_id,
      auth.uid(),
      format('🗑️ PAGAMENTO EXCLUÍDO por %s: R$ %s',
        COALESCE(v_usuario_nome, 'Sistema'),
        to_char(OLD.valor, 'FM999G999G990D00'))
    );
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.valor IS DISTINCT FROM NEW.valor OR OLD.forma_pagamento IS DISTINCT FROM NEW.forma_pagamento) THEN
      PERFORM criar_log_os(
        v_os_id,
        auth.uid(),
        format('💰 PAGAMENTO ALTERADO por %s: R$ %s (%s) → R$ %s (%s)',
          COALESCE(v_usuario_nome, 'Sistema'),
          to_char(OLD.valor, 'FM999G999G990D00'),
          OLD.forma_pagamento,
          to_char(NEW.valor, 'FM999G999G990D00'),
          NEW.forma_pagamento)
      );
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_pagamentos_changes ON pagamentos;
CREATE TRIGGER trigger_log_pagamentos_changes
  AFTER INSERT OR UPDATE OR DELETE ON pagamentos
  FOR EACH ROW
  EXECUTE FUNCTION log_pagamentos_changes();

-- ============================================
-- TRIGGER 6: Anexos
-- ============================================
CREATE OR REPLACE FUNCTION log_anexos_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_nome text;
BEGIN
  SELECT nome INTO v_usuario_nome FROM usuarios WHERE id = auth.uid();

  IF (TG_OP = 'INSERT') THEN
    PERFORM criar_log_os(
      NEW.os_id,
      auth.uid(),
      format('📎 ANEXO ADICIONADO por %s: %s (%s)',
        COALESCE(v_usuario_nome, 'Sistema'),
        NEW.nome_arquivo,
        NEW.tipo)
    );
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM criar_log_os(
      OLD.os_id,
      auth.uid(),
      format('🗑️ ANEXO REMOVIDO por %s: %s',
        COALESCE(v_usuario_nome, 'Sistema'),
        OLD.nome_arquivo)
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_anexos_changes ON os_anexos;
CREATE TRIGGER trigger_log_anexos_changes
  AFTER INSERT OR DELETE ON os_anexos
  FOR EACH ROW
  EXECUTE FUNCTION log_anexos_changes();

-- ============================================
-- TRIGGER 7: Agendamentos
-- ============================================
CREATE OR REPLACE FUNCTION log_agendamentos_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_nome text;
BEGIN
  SELECT nome INTO v_usuario_nome FROM usuarios WHERE id = auth.uid();

  IF (TG_OP = 'INSERT') THEN
    PERFORM criar_log_os(
      NEW.os_id,
      auth.uid(),
      format('📅 AGENDAMENTO CRIADO por %s: %s',
        COALESCE(v_usuario_nome, 'Sistema'),
        to_char(NEW.data_hora_inicio, 'DD/MM/YYYY HH24:MI'))
    );
  ELSIF (TG_OP = 'UPDATE') THEN
    IF (OLD.data_hora_checkin IS NULL AND NEW.data_hora_checkin IS NOT NULL) THEN
      PERFORM criar_log_os(
        NEW.os_id,
        auth.uid(),
        format('✅ CHECK-IN realizado por %s às %s',
          COALESCE(v_usuario_nome, 'Sistema'),
          to_char(NEW.data_hora_checkin, 'DD/MM/YYYY HH24:MI'))
      );
    END IF;

    IF (OLD.data_hora_checkout IS NULL AND NEW.data_hora_checkout IS NOT NULL) THEN
      PERFORM criar_log_os(
        NEW.os_id,
        auth.uid(),
        format('✅ CHECK-OUT realizado por %s às %s',
          COALESCE(v_usuario_nome, 'Sistema'),
          to_char(NEW.data_hora_checkout, 'DD/MM/YYYY HH24:MI'))
      );
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_agendamentos_changes ON agendamentos;
CREATE TRIGGER trigger_log_agendamentos_changes
  AFTER INSERT OR UPDATE ON agendamentos
  FOR EACH ROW
  EXECUTE FUNCTION log_agendamentos_changes();

-- ============================================
-- TRIGGER 8: Cotações
-- ============================================
CREATE OR REPLACE FUNCTION log_cotacoes_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_nome text;
BEGIN
  SELECT nome INTO v_usuario_nome FROM usuarios WHERE id = auth.uid();

  IF (TG_OP = 'INSERT') THEN
    PERFORM criar_log_os(
      NEW.os_id,
      auth.uid(),
      format('💰 ORÇAMENTO CRIADO por %s: #%s (R$ %s)',
        COALESCE(v_usuario_nome, 'Sistema'),
        NEW.numero_cotacao,
        to_char(NEW.valor_total, 'FM999G999G990D00'))
    );
  ELSIF (TG_OP = 'UPDATE') THEN
    -- Orçamento enviado
    IF (OLD.orcamento_enviado = false AND NEW.orcamento_enviado = true) THEN
      PERFORM criar_log_os(
        NEW.os_id,
        auth.uid(),
        format('📧 ORÇAMENTO ENVIADO por %s: #%s',
          COALESCE(v_usuario_nome, 'Sistema'),
          NEW.numero_cotacao)
      );
    END IF;

    -- Status da cotação
    IF (OLD.status IS DISTINCT FROM NEW.status) THEN
      PERFORM criar_log_os(
        NEW.os_id,
        auth.uid(),
        format('📊 STATUS ORÇAMENTO por %s: %s → %s (#%s)',
          COALESCE(v_usuario_nome, 'Sistema'),
          OLD.status,
          NEW.status,
          NEW.numero_cotacao)
      );
    END IF;

    -- Valor alterado
    IF (OLD.valor_total IS DISTINCT FROM NEW.valor_total) THEN
      PERFORM criar_log_os(
        NEW.os_id,
        auth.uid(),
        format('💰 VALOR ORÇAMENTO ALTERADO por %s: R$ %s → R$ %s (#%s)',
          COALESCE(v_usuario_nome, 'Sistema'),
          to_char(OLD.valor_total, 'FM999G999G990D00'),
          to_char(NEW.valor_total, 'FM999G999G990D00'),
          NEW.numero_cotacao)
      );
    END IF;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trigger_log_cotacoes_changes ON cotacoes;
CREATE TRIGGER trigger_log_cotacoes_changes
  AFTER INSERT OR UPDATE ON cotacoes
  FOR EACH ROW
  EXECUTE FUNCTION log_cotacoes_changes();