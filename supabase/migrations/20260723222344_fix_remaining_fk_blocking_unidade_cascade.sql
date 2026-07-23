/*
# Fix remaining FK constraints blocking unidade cascade deletion

Several tables have NO ACTION FKs pointing to tables that cascade from unidades
(cotacoes, estoque_pecas, servicos). These block the cascade chain.

## Modified constraints:
- cotacoes.cotacao_original_id -> SET NULL (self-referencing)
- financeiro_lancamentos.cotacao_id -> SET NULL
- os.cotacao_id -> SET NULL
- estoque_devolucoes.peca_id -> CASCADE (devolucao follows the peca)
- estoque_transferencias.peca_id -> CASCADE (transfer follows the peca)
- cotacoes_servicos.servico_id -> CASCADE (service link follows the service)
*/

-- cotacoes self-reference
ALTER TABLE cotacoes DROP CONSTRAINT IF EXISTS cotacoes_cotacao_original_id_fkey;
ALTER TABLE cotacoes ADD CONSTRAINT cotacoes_cotacao_original_id_fkey
  FOREIGN KEY (cotacao_original_id) REFERENCES cotacoes(id) ON DELETE SET NULL;

-- financeiro_lancamentos.cotacao_id
ALTER TABLE financeiro_lancamentos DROP CONSTRAINT IF EXISTS financeiro_lancamentos_cotacao_id_fkey;
ALTER TABLE financeiro_lancamentos ADD CONSTRAINT financeiro_lancamentos_cotacao_id_fkey
  FOREIGN KEY (cotacao_id) REFERENCES cotacoes(id) ON DELETE SET NULL;

-- os.cotacao_id
ALTER TABLE os DROP CONSTRAINT IF EXISTS os_cotacao_id_fkey;
ALTER TABLE os ADD CONSTRAINT os_cotacao_id_fkey
  FOREIGN KEY (cotacao_id) REFERENCES cotacoes(id) ON DELETE SET NULL;

-- estoque_devolucoes.peca_id
ALTER TABLE estoque_devolucoes DROP CONSTRAINT IF EXISTS estoque_devolucoes_peca_id_fkey;
ALTER TABLE estoque_devolucoes ADD CONSTRAINT estoque_devolucoes_peca_id_fkey
  FOREIGN KEY (peca_id) REFERENCES estoque_pecas(id) ON DELETE CASCADE;

-- estoque_transferencias.peca_id
ALTER TABLE estoque_transferencias DROP CONSTRAINT IF EXISTS estoque_transferencias_peca_id_fkey;
ALTER TABLE estoque_transferencias ADD CONSTRAINT estoque_transferencias_peca_id_fkey
  FOREIGN KEY (peca_id) REFERENCES estoque_pecas(id) ON DELETE CASCADE;

-- cotacoes_servicos.servico_id
ALTER TABLE cotacoes_servicos DROP CONSTRAINT IF EXISTS cotacoes_servicos_servico_id_fkey;
ALTER TABLE cotacoes_servicos ADD CONSTRAINT cotacoes_servicos_servico_id_fkey
  FOREIGN KEY (servico_id) REFERENCES servicos(id) ON DELETE CASCADE;
