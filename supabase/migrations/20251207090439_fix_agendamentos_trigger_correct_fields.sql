/*
  # Correção do Trigger de Agendamentos

  1. Descrição
    - Corrige o trigger que registra logs de agendamentos
    - O trigger estava usando campo `data_hora_inicio` que não existe
    - Atualiza para usar os campos corretos: data_agendamento, horario_inicio

  2. Alterações
    - Recria função `log_agendamentos_changes()` com campos corretos
    - Usa `data_agendamento` e `horario_inicio` ao invés de `data_hora_inicio`
    - Mantém lógica de check-in e check-out inalterada
*/

-- Recria a função com os campos corretos
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
      format('📅 AGENDAMENTO CRIADO por %s: %s %s',
        COALESCE(v_usuario_nome, 'Sistema'),
        to_char(NEW.data_agendamento, 'DD/MM/YYYY'),
        COALESCE(NEW.horario_inicio::text, ''))
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
