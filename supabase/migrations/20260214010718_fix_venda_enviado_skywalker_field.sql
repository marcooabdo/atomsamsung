/*
  # Corrigir atualização do campo enviado_skywalker
  
  1. Problema
    - O trigger AFTER não atualiza enviado_skywalker e data_envio_skywalker
    - Isso faz com que vendas concluídas apareçam como "Não enviado"
    
  2. Solução
    - Mover a atualização desses campos para o trigger BEFORE
    - O trigger AFTER continua fazendo o cálculo das estrelas
*/

-- Atualizar função BEFORE para marcar como enviado
CREATE OR REPLACE FUNCTION prepare_venda_skywalker()
RETURNS TRIGGER AS $$
BEGIN
  -- Inicializar log_skywalker se necessário
  IF NEW.log_skywalker IS NULL THEN
    NEW.log_skywalker := '[]'::jsonb;
  END IF;
  
  -- Marcar como enviado se status concluído
  IF NEW.status = 'concluido' THEN
    NEW.enviado_skywalker := true;
    
    -- Atualizar data_envio_skywalker apenas se estiver vazio
    IF NEW.data_envio_skywalker IS NULL THEN
      NEW.data_envio_skywalker := now();
    END IF;
  END IF;
  
  -- Resetar enviado_skywalker se status não for concluído
  IF NEW.status != 'concluido' AND (TG_OP = 'UPDATE' AND OLD.status = 'concluido') THEN
    NEW.enviado_skywalker := false;
    NEW.data_envio_skywalker := NULL;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION prepare_venda_skywalker() IS 'Prepara campos antes de salvar venda (marca como enviado se concluído)';

-- Atualizar todas as vendas concluídas que ainda não foram marcadas como enviadas
UPDATE vendas
SET 
  enviado_skywalker = true,
  data_envio_skywalker = COALESCE(data_envio_skywalker, updated_at)
WHERE status = 'concluido'
  AND enviado_skywalker = false;
