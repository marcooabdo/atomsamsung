/*
  # Corrigir Trigger de Anexos para Permitir os_id NULL

  1. Problema
    - Anexos podem existir sem OS vinculada (só com cotacao_id)
    - Trigger log_anexos_changes tenta usar NEW.os_id/OLD.os_id sem checar NULL
    - Causa erro: "column 'os_id' does not exist" ao mover orçamento de volta

  2. Solução
    - Verificar se os_id é NULL antes de criar log
    - Só registrar log se anexo tiver OS vinculada
    - Anexos de cotação sem OS não geram log de OS (correto!)

  3. Comportamento
    - Anexo com OS: registra log na OS
    - Anexo sem OS (só cotação): não registra log
    - Permite mover orçamento de volta sem erro
*/

-- Recriar trigger de anexos corrigido
CREATE OR REPLACE FUNCTION log_anexos_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_usuario_nome text;
  v_os_id uuid;
BEGIN
  SELECT nome INTO v_usuario_nome FROM usuarios WHERE id = auth.uid();

  -- Determinar os_id baseado na operação
  IF (TG_OP = 'INSERT') THEN
    v_os_id := NEW.os_id;
  ELSE
    v_os_id := OLD.os_id;
  END IF;

  -- Se não houver OS vinculada, não registrar log (anexo de cotação apenas)
  IF v_os_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  -- Registrar log na OS
  IF (TG_OP = 'INSERT') THEN
    PERFORM criar_log_os(
      v_os_id,
      auth.uid(),
      format('📎 ANEXO ADICIONADO por %s: %s (%s)',
        COALESCE(v_usuario_nome, 'Sistema'),
        NEW.nome_arquivo,
        NEW.tipo)
    );
  ELSIF (TG_OP = 'DELETE') THEN
    PERFORM criar_log_os(
      v_os_id,
      auth.uid(),
      format('🗑️ ANEXO REMOVIDO por %s: %s',
        COALESCE(v_usuario_nome, 'Sistema'),
        OLD.nome_arquivo)
    );
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- Recriar trigger
DROP TRIGGER IF EXISTS trigger_log_anexos_changes ON os_anexos;
CREATE TRIGGER trigger_log_anexos_changes
  AFTER INSERT OR DELETE ON os_anexos
  FOR EACH ROW
  EXECUTE FUNCTION log_anexos_changes();

COMMENT ON FUNCTION log_anexos_changes IS 'Registra logs de anexos apenas quando vinculados a OS (os_id não NULL)';