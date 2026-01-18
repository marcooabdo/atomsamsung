/*
  # Auto-disponibilizar peças devolvidas novas
  
  1. Problem
    - When stock approves a return of type "nova" (new/unused), the part status is set to "devolvida_nova"
    - But it should automatically become "disponivel" again for reuse in other service orders
    - Currently requires manual action to make the part available again
    
  2. Solution
    - Create trigger that automatically changes status from "devolvida_nova" to "disponivel"
    - This happens when estoque_pecas.status is updated to "devolvida_nova"
    - Maintains full traceability in estoque_historico
    
  3. Logic
    - If status changes TO "devolvida_nova" → automatically change to "disponivel"
    - If status changes TO "devolvida_defeito" → keep as is (needs inspection/repair)
    - If status changes TO "usada" → keep as is (part was consumed)
    - Always log the automatic change in history
    
  4. Impact
    - Returned new parts are immediately available for requisition
    - No manual intervention needed
    - Clear audit trail maintained
*/

CREATE OR REPLACE FUNCTION auto_disponibilizar_peca_nova()
RETURNS TRIGGER AS $$
DECLARE
  v_usuario_id uuid;
  v_usuario_nome text;
BEGIN
  -- Only act when status changes TO devolvida_nova
  IF (TG_OP = 'UPDATE' AND NEW.status = 'devolvida_nova' AND OLD.status != 'devolvida_nova') THEN
    
    -- Get user performing the action
    v_usuario_id := COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000001'::uuid);
    SELECT nome INTO v_usuario_nome FROM usuarios WHERE id = v_usuario_id;
    
    -- Automatically change status to disponivel
    NEW.status := 'disponivel';
    
    -- Log the automatic change
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
      'auto_disponibilizacao',
      'devolvida_nova',
      'disponivel',
      format('✅ Peça NOVA devolvida automaticamente disponibilizada para nova requisição por %s - PN: %s',
        COALESCE(v_usuario_nome, 'Sistema'),
        NEW.pn
      )
    );
    
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger BEFORE the log_estoque_pecas_movement trigger
-- This ensures the status is changed before the movement is logged
DROP TRIGGER IF EXISTS trigger_auto_disponibilizar_peca_nova ON estoque_pecas;
CREATE TRIGGER trigger_auto_disponibilizar_peca_nova
  BEFORE UPDATE ON estoque_pecas
  FOR EACH ROW
  EXECUTE FUNCTION auto_disponibilizar_peca_nova();

COMMENT ON FUNCTION auto_disponibilizar_peca_nova IS 
  'Automatically changes status from devolvida_nova to disponivel when stock approves return of unused part';
