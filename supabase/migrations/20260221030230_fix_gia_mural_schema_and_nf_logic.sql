/*
  # Fix GIA Mural Schema and NF Logic

  ## Summary
  Corrige o schema da tabela gia_mural_tarefas e atualiza a função de análise
  de devoluções para usar a data de emissão da NF como referência de prazo.

  ## Changes
  1. `gia_mural_tarefas`: Adiciona coluna `unidade_id` (uuid, FK para unidades)
     para permitir filtro por loja ativa no front-end.

  2. `analisar_devolucoes_estoque()`: 
     - Corrige referência de `ativo` para `ativa` na tabela unidades
     - Usa LEFT JOIN com estoque_nfs para obter data de emissão da NF
       como referência de prazo (mais preciso que data_entrada)
     - Corrige o INSERT para usar coluna `setor` (nome real) ao invés de `gia_source`
     - Corrige enum de prioridade: usa 'normal' ao invés de 'media'

  ## Security
  - Nenhuma alteração nas políticas RLS existentes
*/

ALTER TABLE gia_mural_tarefas ADD COLUMN IF NOT EXISTS unidade_id uuid REFERENCES unidades(id);

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
    FOR v_unidade IN SELECT id, nome FROM unidades WHERE ativa = true LOOP

        SELECT COUNT(p.id), COALESCE(SUM(p.valor_com_impostos), 0)
        INTO v_qtd_novas, v_valor_novas
        FROM estoque_pecas p
        LEFT JOIN estoque_nfs nf ON p.nf_id = nf.id
        WHERE p.unidade_id = v_unidade.id
          AND p.status = 'disponivel'
          AND COALESCE(nf.data_emissao, p.created_at::date) <= (CURRENT_DATE - INTERVAL '35 days');

        SELECT COUNT(id), COALESCE(SUM(valor_com_impostos), 0)
        INTO v_qtd_defeito, v_valor_defeito
        FROM estoque_pecas
        WHERE unidade_id = v_unidade.id AND status = 'com_defeito';

        IF v_qtd_novas > 0 OR v_qtd_defeito > 0 THEN
            v_mensagem := '🚨 *Relatório de Devoluções GIA Stock* 🚨' || E'\n\n';

            IF v_qtd_novas > 0 THEN
                v_mensagem := v_mensagem || '📦 *Peças Novas Paradas (>35 dias da NF):* ' || v_qtd_novas || ' unidades.' || E'\n';
                v_mensagem := v_mensagem || '💰 *Capital Travado:* R$ ' || v_valor_novas || E'\n';
                v_mensagem := v_mensagem || 'Ação: Analisar giro e devolver como NOVA para não perder prazo de GSPN.' || E'\n\n';
            END IF;

            IF v_qtd_defeito > 0 THEN
                v_mensagem := v_mensagem || '⚠️ *Peças com Defeito:* ' || v_qtd_defeito || ' unidades.' || E'\n';
                v_mensagem := v_mensagem || '💰 *Capital a Recuperar:* R$ ' || v_valor_defeito || E'\n';
                v_mensagem := v_mensagem || 'Ação: Devolução imediata no portal da Samsung.' || E'\n';
            END IF;

            INSERT INTO gia_mural_tarefas (
                unidade_id, setor, titulo, descricao, prioridade, status, gia_responsavel
            ) VALUES (
                v_unidade.id,
                'ESTOQUE',
                'Caçadora de Prazos: Ação de Devolução Necessária',
                v_mensagem,
                CASE WHEN v_qtd_defeito > 0 THEN 'alta' ELSE 'normal' END,
                'pendente',
                'GIA Stock'
            );
        END IF;

    END LOOP;
END;
$$;
