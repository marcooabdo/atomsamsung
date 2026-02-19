/*
  # GIA Stock - Caçadora de Prazos

  ## Descrição
  Implementa a automação "Caçadora de Prazos" da GIA Stock, que analisa peças paradas
  no estoque e gera alertas no Mural de Missões para proteger o caixa da operação.

  ## O que esta migration faz

  ### 1. Função `analisar_devolucoes_estoque()`
  - Roda por todas as unidades ativas
  - Detecta peças NOVAS paradas há mais de 35 dias (risco de perder prazo GSPN)
  - Detecta peças com DEFEITO que precisam de devolução imediata no portal Samsung
  - Para cada unidade com pendências, gera uma tarefa no Mural (gia_mural_tarefas)
    com prioridade ALTA se houver peças com defeito, MÉDIA caso contrário
  - Exibe capital travado em R$ para facilitar tomada de decisão

  ### 2. Agendamento via pg_cron
  - Habilita a extensão pg_cron se não existir
  - Remove agendamento anterior (seguro para re-execução da migration)
  - Agenda execução diária às 09:00 UTC (06:00 BRT)
  - Job nomeado: `gia_cacadora_prazos_diaria`

  ### 3. Permissões
  - Concede permissões ao postgres para executar a função via cron
*/

-- 1. CRIA A FUNÇÃO DA GIA STOCK (CAÇADORA DE PRAZOS)
CREATE OR REPLACE FUNCTION analisar_devolucoes_estoque()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_unidade RECORD;
    v_qtd_novas INT;
    v_valor_novas NUMERIC;
    v_qtd_defeito INT;
    v_valor_defeito NUMERIC;
    v_mensagem TEXT;
BEGIN
    -- Loop por todas as unidades ativas
    FOR v_unidade IN SELECT id, nome FROM unidades WHERE ativo = true LOOP
        
        -- Buscar peças NOVAS paradas há mais de 35 dias
        SELECT 
            COUNT(id), COALESCE(SUM(valor_com_impostos), 0)
        INTO 
            v_qtd_novas, v_valor_novas
        FROM estoque_pecas
        WHERE unidade_id = v_unidade.id 
          AND status = 'disponivel' 
          AND data_entrada <= (CURRENT_DATE - INTERVAL '35 days');

        -- Buscar peças com DEFEITO (Devolução Imediata)
        SELECT 
            COUNT(id), COALESCE(SUM(valor_com_impostos), 0)
        INTO 
            v_qtd_defeito, v_valor_defeito
        FROM estoque_pecas
        WHERE unidade_id = v_unidade.id 
          AND status = 'com_defeito';

        -- Se encontrou algo, aciona a GIA no Mural
        IF v_qtd_novas > 0 OR v_qtd_defeito > 0 THEN
            
            v_mensagem := '🚨 *Relatório de Devoluções GIA Stock* 🚨' || E'\n\n';
            
            IF v_qtd_novas > 0 THEN
                v_mensagem := v_mensagem || '📦 *Peças Novas Paradas (>35 dias):* ' || v_qtd_novas || ' unidades.' || E'\n';
                v_mensagem := v_mensagem || '💰 *Capital Travado:* R$ ' || v_valor_novas || E'\n';
                v_mensagem := v_mensagem || 'Ação: Analisar giro e devolver como NOVA para não perder prazo de GSPN.' || E'\n\n';
            END IF;

            IF v_qtd_defeito > 0 THEN
                v_mensagem := v_mensagem || '⚠️ *Peças com Defeito:* ' || v_qtd_defeito || ' unidades.' || E'\n';
                v_mensagem := v_mensagem || '💰 *Capital a Recuperar:* R$ ' || v_valor_defeito || E'\n';
                v_mensagem := v_mensagem || 'Ação: Devolução imediata no portal da Samsung.' || E'\n';
            END IF;

            -- Inserir no Mural de Missões
            INSERT INTO gia_mural_tarefas (
                unidade_id,
                gia_source,
                titulo,
                descricao,
                prioridade,
                status,
                gia_responsavel
            ) VALUES (
                v_unidade.id,
                'ESTOQUE',
                'Caçadora de Prazos: Ação de Devolução Necessária',
                v_mensagem,
                CASE WHEN v_qtd_defeito > 0 THEN 'alta' ELSE 'media' END,
                'pendente',
                'GIA Stock'
            );

        END IF;

    END LOOP;
END;
$$;

-- 2. HABILITA O CRON E AGENDA O DESPERTADOR
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Remove agendamento anterior para não duplicar se rodar a migration 2x
DO $$
BEGIN
    PERFORM cron.unschedule('gia_cacadora_prazos_diaria');
EXCEPTION WHEN OTHERS THEN
    -- Ignora erro se não existir
END $$;

-- Agenda a execução da função todos os dias.
-- 09:00 UTC é equivalente a 06:00 BRT (Horário de Brasília).
SELECT cron.schedule(
    'gia_cacadora_prazos_diaria', 
    '0 9 * * *',                  
    $$SELECT analisar_devolucoes_estoque();$$
);

-- Permissões de segurança para o cron conseguir executar a função
GRANT USAGE ON SCHEMA public TO postgres;
GRANT EXECUTE ON FUNCTION analisar_devolucoes_estoque() TO postgres;
