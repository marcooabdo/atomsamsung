/*
  # Fix Estoque Pecas Trigger - Remove Invalid Column References

  1. Description
    - Fix log_estoque_pecas_changes() trigger
    - Remove references to sala_id and estante_id (these columns don't exist in estoque_pecas)
    - estoque_pecas only has bin_id column
    - Get full location through joins: bins -> estantes -> salas

  2. Changes
    - Rewrite location tracking to use only bin_id
    - Build location string through joins instead of accessing non-existent columns

  3. Notes
    - This fixes "record 'old' has no field 'sala_id'" error
*/

-- Recreate trigger function with correct column references
CREATE OR REPLACE FUNCTION log_estoque_pecas_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_id uuid;
  v_usuario_nome text;
  v_old_status text;
  v_new_status text;
BEGIN
  -- Get user info
  v_usuario_id := auth.uid();
  IF v_usuario_id IS NOT NULL THEN
    SELECT nome INTO v_usuario_nome FROM usuarios WHERE id = v_usuario_id;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    -- Mudança de STATUS
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      CASE NEW.status
        WHEN 'disponivel' THEN v_new_status := '✅ DISPONÍVEL';
        WHEN 'em_uso' THEN v_new_status := '🔧 EM USO';
        WHEN 'reservado' THEN v_new_status := '🔒 RESERVADO';
        WHEN 'em_transito' THEN v_new_status := '🚚 EM TRÂNSITO';
        WHEN 'devolvido' THEN v_new_status := '🔙 DEVOLVIDO';
        ELSE v_new_status := NEW.status;
      END CASE;

      CASE OLD.status
        WHEN 'disponivel' THEN v_old_status := '✅ DISPONÍVEL';
        WHEN 'em_uso' THEN v_old_status := '🔧 EM USO';
        WHEN 'reservado' THEN v_old_status := '🔒 RESERVADO';
        WHEN 'em_transito' THEN v_old_status := '🚚 EM TRÂNSITO';
        WHEN 'devolvido' THEN v_old_status := '🔙 DEVOLVIDO';
        ELSE v_old_status := OLD.status;
      END CASE;

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
        v_old_status,
        v_new_status,
        format('STATUS alterado de %s para %s por %s', v_old_status, v_new_status, COALESCE(v_usuario_nome, 'Sistema'))
      );
    END IF;

    -- Mudança de LOCALIZAÇÃO (apenas bin_id)
    IF (OLD.bin_id IS DISTINCT FROM NEW.bin_id) THEN
      DECLARE
        v_old_loc text := 'Sem localização';
        v_new_loc text := 'Sem localização';
      BEGIN
        -- Get old location through joins
        IF OLD.bin_id IS NOT NULL THEN
          SELECT 
            u.nome || ' > ' || s.nome || ' > ' || e.codigo || ' > ' || b.codigo
          INTO v_old_loc
          FROM estoque_bins b
          JOIN estoque_estantes e ON b.estante_id = e.id
          JOIN estoque_salas s ON e.sala_id = s.id
          JOIN unidades u ON s.unidade_id = u.id
          WHERE b.id = OLD.bin_id;
        END IF;

        -- Get new location through joins
        IF NEW.bin_id IS NOT NULL THEN
          SELECT 
            u.nome || ' > ' || s.nome || ' > ' || e.codigo || ' > ' || b.codigo
          INTO v_new_loc
          FROM estoque_bins b
          JOIN estoque_estantes e ON b.estante_id = e.id
          JOIN estoque_salas s ON e.sala_id = s.id
          JOIN unidades u ON s.unidade_id = u.id
          WHERE b.id = NEW.bin_id;
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