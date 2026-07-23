/*
# Fix secondary FK constraints blocking unidade deletion

When deleting a unidade, the cascade deletes usuarios too. But some tables have
NO ACTION foreign keys pointing to usuarios (e.g. confirmado_por, criado_por, vendedor_id)
which would block the cascade. Changing these to SET NULL so the deletion can proceed.

## Modified constraints:
- agendamentos.confirmado_por -> SET NULL
- metas_performance.criado_por -> SET NULL
- orcamento_aprovacao_tokens.criado_por -> SET NULL
- os_alertas_fechamento.resolvido_por -> SET NULL
- os_alertas_fechamento.ignorado_por -> SET NULL
- vendas.criado_por -> SET NULL
- vendas.vendedor_id -> SET NULL
- vendas.avaliacao_validada_por -> SET NULL
*/

-- agendamentos.confirmado_por
ALTER TABLE agendamentos DROP CONSTRAINT IF EXISTS agendamentos_confirmado_por_fkey;
ALTER TABLE agendamentos ADD CONSTRAINT agendamentos_confirmado_por_fkey
  FOREIGN KEY (confirmado_por) REFERENCES usuarios(id) ON DELETE SET NULL;

-- metas_performance.criado_por
ALTER TABLE metas_performance DROP CONSTRAINT IF EXISTS metas_performance_criado_por_fkey;
ALTER TABLE metas_performance ADD CONSTRAINT metas_performance_criado_por_fkey
  FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE SET NULL;

-- orcamento_aprovacao_tokens.criado_por
ALTER TABLE orcamento_aprovacao_tokens DROP CONSTRAINT IF EXISTS orcamento_aprovacao_tokens_criado_por_fkey;
ALTER TABLE orcamento_aprovacao_tokens ADD CONSTRAINT orcamento_aprovacao_tokens_criado_por_fkey
  FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE SET NULL;

-- os_alertas_fechamento.resolvido_por
ALTER TABLE os_alertas_fechamento DROP CONSTRAINT IF EXISTS os_alertas_fechamento_resolvido_por_fkey;
ALTER TABLE os_alertas_fechamento ADD CONSTRAINT os_alertas_fechamento_resolvido_por_fkey
  FOREIGN KEY (resolvido_por) REFERENCES usuarios(id) ON DELETE SET NULL;

-- os_alertas_fechamento.ignorado_por
ALTER TABLE os_alertas_fechamento DROP CONSTRAINT IF EXISTS os_alertas_fechamento_ignorado_por_fkey;
ALTER TABLE os_alertas_fechamento ADD CONSTRAINT os_alertas_fechamento_ignorado_por_fkey
  FOREIGN KEY (ignorado_por) REFERENCES usuarios(id) ON DELETE SET NULL;

-- vendas.criado_por
ALTER TABLE vendas DROP CONSTRAINT IF EXISTS vendas_criado_por_fkey;
ALTER TABLE vendas ADD CONSTRAINT vendas_criado_por_fkey
  FOREIGN KEY (criado_por) REFERENCES usuarios(id) ON DELETE SET NULL;

-- vendas.vendedor_id
ALTER TABLE vendas DROP CONSTRAINT IF EXISTS vendas_vendedor_id_fkey;
ALTER TABLE vendas ADD CONSTRAINT vendas_vendedor_id_fkey
  FOREIGN KEY (vendedor_id) REFERENCES usuarios(id) ON DELETE SET NULL;

-- vendas.avaliacao_validada_por
ALTER TABLE vendas DROP CONSTRAINT IF EXISTS vendas_avaliacao_validada_por_fkey;
ALTER TABLE vendas ADD CONSTRAINT vendas_avaliacao_validada_por_fkey
  FOREIGN KEY (avaliacao_validada_por) REFERENCES usuarios(id) ON DELETE SET NULL;
