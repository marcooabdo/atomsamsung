/*
  # Fix Requisições Trigger - Correct Status Enum

  1. Description
    - Fix trigger that references 'aprovada' status
    - The correct enum value is 'atendida', not 'aprovada'
    - This was causing "invalid input value for enum requisicao_status: 'aprovada'" error

  2. Changes
    - Update CASE statement in log_requisicoes_pecas_changes() trigger
    - Change 'aprovada' to 'atendida' to match the requisicao_status enum

  3. Notes
    - This fixes the transfer failure bug
    - The enum requisicao_status has: pendente, atendida, em_uso, gi_postada, devolvida, reprovada, pedido_feito, devolucao_pendente
    - 'aprovada' is NOT a valid value for requisicao_status
*/

-- Recreate the trigger function with correct enum value
CREATE OR REPLACE FUNCTION log_requisicoes_pecas_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only log if there's an associated OS
  IF (NEW.os_id IS NOT NULL) THEN
    -- Mudança de status da requisição
    IF (OLD.status IS DISTINCT FROM NEW.status AND NEW.peca_estoque_id IS NOT NULL) THEN
      DECLARE
        v_status_msg text;
      BEGIN
        CASE NEW.status
          WHEN 'atendida' THEN
            v_status_msg := '✅ REQUISIÇÃO ATENDIDA';
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
          'mudanca_status_requisicao',
          OLD.status::text,
          NEW.status::text,
          v_status_msg
        );
      END;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;
