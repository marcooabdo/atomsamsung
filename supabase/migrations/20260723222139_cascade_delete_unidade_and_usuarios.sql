/*
# Cascade delete on unidade removal

When a unidade (unit) is deleted, all related data should be removed automatically.
This migration changes all foreign key constraints referencing `unidades` from NO ACTION
to CASCADE, so deleting a unit cascades the deletion to:

- usuarios (users of that unit)
- os (service orders)
- agendamentos (schedules)
- cotacoes (quotes)
- estoque_nfs, estoque_pecas, estoque_pedidos (stock)
- estoque_nf_devolucoes (stock returns)
- estoque_transferencias (stock transfers)
- financeiro_aportes, financeiro_lancamentos (financial)
- pagamentos (payments)
- requisicoes_pecas (parts requests)
- rotas (routes)
- servicos (services)
- taxas_maquina (machine fees)
- markup_regras (markup rules)
- checklist_templates (checklists)
- deslocamento_km_cache (distance cache)
- gia_configuracoes, gia_mural_tarefas (GIA config/tasks)
- skywalker_google_reviews, skywalker_lp_unidade, skywalker_profissionais (gamification)
- vendas (sales)

Also ensures usuario_unidades junction table cascades on unidade deletion.

## Security
- No RLS changes.
- Data safety: this is intentional — user explicitly wants full cascade on unit deletion.
*/

-- usuarios
ALTER TABLE usuarios DROP CONSTRAINT IF EXISTS usuarios_unidade_id_fkey;
ALTER TABLE usuarios ADD CONSTRAINT usuarios_unidade_id_fkey
  FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON DELETE CASCADE;

-- os
ALTER TABLE os DROP CONSTRAINT IF EXISTS os_unidade_id_fkey;
ALTER TABLE os ADD CONSTRAINT os_unidade_id_fkey
  FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON DELETE CASCADE;

-- agendamentos
ALTER TABLE agendamentos DROP CONSTRAINT IF EXISTS agendamentos_unidade_id_fkey;
ALTER TABLE agendamentos ADD CONSTRAINT agendamentos_unidade_id_fkey
  FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON DELETE CASCADE;

-- cotacoes
ALTER TABLE cotacoes DROP CONSTRAINT IF EXISTS cotacoes_unidade_id_fkey;
ALTER TABLE cotacoes ADD CONSTRAINT cotacoes_unidade_id_fkey
  FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON DELETE CASCADE;

-- estoque_nfs
ALTER TABLE estoque_nfs DROP CONSTRAINT IF EXISTS estoque_nfs_unidade_id_fkey;
ALTER TABLE estoque_nfs ADD CONSTRAINT estoque_nfs_unidade_id_fkey
  FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON DELETE CASCADE;

-- estoque_pecas
ALTER TABLE estoque_pecas DROP CONSTRAINT IF EXISTS estoque_pecas_unidade_id_fkey;
ALTER TABLE estoque_pecas ADD CONSTRAINT estoque_pecas_unidade_id_fkey
  FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON DELETE CASCADE;

-- estoque_pedidos
ALTER TABLE estoque_pedidos DROP CONSTRAINT IF EXISTS estoque_pedidos_unidade_id_fkey;
ALTER TABLE estoque_pedidos ADD CONSTRAINT estoque_pedidos_unidade_id_fkey
  FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON DELETE CASCADE;

-- estoque_nf_devolucoes
ALTER TABLE estoque_nf_devolucoes DROP CONSTRAINT IF EXISTS estoque_nf_devolucoes_unidade_id_fkey;
ALTER TABLE estoque_nf_devolucoes ADD CONSTRAINT estoque_nf_devolucoes_unidade_id_fkey
  FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON DELETE CASCADE;

-- estoque_transferencias (origem)
ALTER TABLE estoque_transferencias DROP CONSTRAINT IF EXISTS estoque_transferencias_origem_unidade_id_fkey;
ALTER TABLE estoque_transferencias ADD CONSTRAINT estoque_transferencias_origem_unidade_id_fkey
  FOREIGN KEY (origem_unidade_id) REFERENCES unidades(id) ON DELETE CASCADE;

-- estoque_transferencias (destino)
ALTER TABLE estoque_transferencias DROP CONSTRAINT IF EXISTS estoque_transferencias_destino_unidade_id_fkey;
ALTER TABLE estoque_transferencias ADD CONSTRAINT estoque_transferencias_destino_unidade_id_fkey
  FOREIGN KEY (destino_unidade_id) REFERENCES unidades(id) ON DELETE CASCADE;

-- financeiro_aportes
ALTER TABLE financeiro_aportes DROP CONSTRAINT IF EXISTS financeiro_aportes_unidade_id_fkey;
ALTER TABLE financeiro_aportes ADD CONSTRAINT financeiro_aportes_unidade_id_fkey
  FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON DELETE CASCADE;

-- financeiro_lancamentos
ALTER TABLE financeiro_lancamentos DROP CONSTRAINT IF EXISTS financeiro_lancamentos_unidade_id_fkey;
ALTER TABLE financeiro_lancamentos ADD CONSTRAINT financeiro_lancamentos_unidade_id_fkey
  FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON DELETE CASCADE;

-- pagamentos
ALTER TABLE pagamentos DROP CONSTRAINT IF EXISTS pagamentos_unidade_id_fkey;
ALTER TABLE pagamentos ADD CONSTRAINT pagamentos_unidade_id_fkey
  FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON DELETE CASCADE;

-- requisicoes_pecas
ALTER TABLE requisicoes_pecas DROP CONSTRAINT IF EXISTS requisicoes_pecas_unidade_id_fkey;
ALTER TABLE requisicoes_pecas ADD CONSTRAINT requisicoes_pecas_unidade_id_fkey
  FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON DELETE CASCADE;

-- rotas
ALTER TABLE rotas DROP CONSTRAINT IF EXISTS rotas_unidade_id_fkey;
ALTER TABLE rotas ADD CONSTRAINT rotas_unidade_id_fkey
  FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON DELETE CASCADE;

-- servicos
ALTER TABLE servicos DROP CONSTRAINT IF EXISTS servicos_unidade_id_fkey;
ALTER TABLE servicos ADD CONSTRAINT servicos_unidade_id_fkey
  FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON DELETE CASCADE;

-- taxas_maquina
ALTER TABLE taxas_maquina DROP CONSTRAINT IF EXISTS taxas_maquina_unidade_id_fkey;
ALTER TABLE taxas_maquina ADD CONSTRAINT taxas_maquina_unidade_id_fkey
  FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON DELETE CASCADE;

-- markup_regras
ALTER TABLE markup_regras DROP CONSTRAINT IF EXISTS markup_regras_unidade_id_fkey;
ALTER TABLE markup_regras ADD CONSTRAINT markup_regras_unidade_id_fkey
  FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON DELETE CASCADE;

-- checklist_templates
ALTER TABLE checklist_templates DROP CONSTRAINT IF EXISTS checklist_templates_unidade_id_fkey;
ALTER TABLE checklist_templates ADD CONSTRAINT checklist_templates_unidade_id_fkey
  FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON DELETE CASCADE;

-- deslocamento_km_cache
ALTER TABLE deslocamento_km_cache DROP CONSTRAINT IF EXISTS deslocamento_km_cache_unidade_id_fkey;
ALTER TABLE deslocamento_km_cache ADD CONSTRAINT deslocamento_km_cache_unidade_id_fkey
  FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON DELETE CASCADE;

-- gia_configuracoes
ALTER TABLE gia_configuracoes DROP CONSTRAINT IF EXISTS gia_configuracoes_unidade_id_fkey;
ALTER TABLE gia_configuracoes ADD CONSTRAINT gia_configuracoes_unidade_id_fkey
  FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON DELETE CASCADE;

-- gia_mural_tarefas
ALTER TABLE gia_mural_tarefas DROP CONSTRAINT IF EXISTS gia_mural_tarefas_unidade_id_fkey;
ALTER TABLE gia_mural_tarefas ADD CONSTRAINT gia_mural_tarefas_unidade_id_fkey
  FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON DELETE CASCADE;

-- skywalker_google_reviews
ALTER TABLE skywalker_google_reviews DROP CONSTRAINT IF EXISTS skywalker_google_reviews_unidade_id_fkey;
ALTER TABLE skywalker_google_reviews ADD CONSTRAINT skywalker_google_reviews_unidade_id_fkey
  FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON DELETE CASCADE;

-- skywalker_lp_unidade
ALTER TABLE skywalker_lp_unidade DROP CONSTRAINT IF EXISTS skywalker_lp_unidade_unidade_id_fkey;
ALTER TABLE skywalker_lp_unidade ADD CONSTRAINT skywalker_lp_unidade_unidade_id_fkey
  FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON DELETE CASCADE;

-- skywalker_profissionais
ALTER TABLE skywalker_profissionais DROP CONSTRAINT IF EXISTS skywalker_profissionais_unidade_id_fkey;
ALTER TABLE skywalker_profissionais ADD CONSTRAINT skywalker_profissionais_unidade_id_fkey
  FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON DELETE CASCADE;

-- vendas
ALTER TABLE vendas DROP CONSTRAINT IF EXISTS vendas_unidade_id_fkey;
ALTER TABLE vendas ADD CONSTRAINT vendas_unidade_id_fkey
  FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON DELETE CASCADE;

-- usuario_unidades junction table
ALTER TABLE usuario_unidades DROP CONSTRAINT IF EXISTS usuario_unidades_unidade_id_fkey;
ALTER TABLE usuario_unidades ADD CONSTRAINT usuario_unidades_unidade_id_fkey
  FOREIGN KEY (unidade_id) REFERENCES unidades(id) ON DELETE CASCADE;
