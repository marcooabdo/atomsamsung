/*
  # Update GIA Stock Devoluções - Regra de 35 dias

  ## Summary
  Corrige a função de análise de devoluções do estoque para usar o prazo
  correto de 35 dias (anteriormente configurado incorretamente como 65 dias).

  ## Changes
  - `analisar_devolucoes_estoque()`: Prazo de alerta para peças novas paradas
    alterado de 65 para 35 dias, conforme regra de negócio GSPN.
  - Mantém o COALESCE(data_entrada, created_at) para segurança contra datas nulas.

  ## Business Rule
  - Peças com status 'disponivel' paradas há mais de 35 dias devem ser devolvidas
    como NOVAS antes de perder o prazo do GSPN.
*/

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
    FOR v_unidade IN SELECT id, nome FROM unidades WHERE ativo = true LOOP

        SELECT
            COUNT(id), COALESCE(SUM(valor_com_impostos), 0)
        INTO
            v_qtd_novas, v_valor_novas
        FROM estoque_pecas
        WHERE unidade_id = v_unidade.id
          AND status = 'disponivel'
          AND COALESCE(data_entrada, created_at) <= (CURRENT_DATE - INTERVAL '35 days');

        SELECT
            COUNT(id), COALESCE(SUM(valor_com_impostos), 0)
        INTO
            v_qtd_defeito, v_valor_defeito
        FROM estoque_pecas
        WHERE unidade_id = v_unidade.id
          AND status = 'com_defeito';

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
