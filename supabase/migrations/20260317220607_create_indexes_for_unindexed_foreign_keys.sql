/*
  # Create indexes for unindexed foreign keys

  This migration adds B-tree indexes to all foreign key columns that currently
  lack indexes. Foreign key columns without indexes cause slow joins and
  cascading operations.

  1. Tables affected (~120 foreign keys across ~40+ tables):
    - agendamento_checklist_vinculados, agendamentos, ai_analises, analises_ia
    - atom_connect_campanhas, atom_connect_conversas, atom_connect_fluxos
    - atom_connect_mensagens, atom_connect_regras_finalizacao, atom_connect_respostas_rapidas
    - atom_connect_transferencias, chat_conversations, chat_messages
    - cotacao_comentarios, cotacoes, cotacoes_historico, cotacoes_pecas, cotacoes_servicos
    - estoque_devolucoes, estoque_historico, estoque_nf_devolucoes, estoque_nfs
    - estoque_pecas, estoque_pedidos, estoque_transferencias
    - etiquetas_templates, financeiro_aportes, financeiro_lancamentos
    - gia_mural_tarefas, metas_performance, nf_emitidas
    - orcamento_aprovacao_tokens, os, os_anexos, os_checklist, os_checklist_vinculados
    - os_comentarios, os_notas_fiscais, os_pecas, os_servicos
    - pagamentos, pipeline_erros, pipeline_logs, pipeline_regras_audit
    - requisicoes_pecas, rotas, skywalker_* tables, tecnico_localizacoes
    - usuarios, vendas, whatsapp_envios, whatsapp_templates

  2. Performance impact:
    - Faster JOIN operations on foreign key columns
    - Faster CASCADE operations on referenced rows
    - Faster lookups when filtering by foreign key values
*/

CREATE INDEX IF NOT EXISTS idx_agendamento_checklist_vinculados_vinculado_por ON agendamento_checklist_vinculados(vinculado_por);
CREATE INDEX IF NOT EXISTS idx_agendamentos_agendado_por ON agendamentos(agendado_por);
CREATE INDEX IF NOT EXISTS idx_agendamentos_confirmado_por ON agendamentos(confirmado_por);
CREATE INDEX IF NOT EXISTS idx_agendamentos_rota_id ON agendamentos(rota_id);
CREATE INDEX IF NOT EXISTS idx_ai_analises_unidade_id ON ai_analises(unidade_id);
CREATE INDEX IF NOT EXISTS idx_analises_ia_solicitado_por ON analises_ia(solicitado_por);
CREATE INDEX IF NOT EXISTS idx_atom_connect_campanhas_created_by ON atom_connect_campanhas(created_by);
CREATE INDEX IF NOT EXISTS idx_atom_connect_campanhas_instancia_id ON atom_connect_campanhas(instancia_id);
CREATE INDEX IF NOT EXISTS idx_atom_connect_campanhas_unidade_id ON atom_connect_campanhas(unidade_id);
CREATE INDEX IF NOT EXISTS idx_atom_connect_conversas_instancia_id ON atom_connect_conversas(instancia_id);
CREATE INDEX IF NOT EXISTS idx_atom_connect_conversas_os_id ON atom_connect_conversas(os_id);
CREATE INDEX IF NOT EXISTS idx_atom_connect_conversas_regra_finalizacao_id ON atom_connect_conversas(regra_finalizacao_id);
CREATE INDEX IF NOT EXISTS idx_atom_connect_conversas_tecnico_ih_id ON atom_connect_conversas(tecnico_ih_id);
CREATE INDEX IF NOT EXISTS idx_atom_connect_fluxos_unidade_id ON atom_connect_fluxos(unidade_id);
CREATE INDEX IF NOT EXISTS idx_atom_connect_mensagens_enviado_por ON atom_connect_mensagens(enviado_por);
CREATE INDEX IF NOT EXISTS idx_atom_connect_regras_finalizacao_unidade_id ON atom_connect_regras_finalizacao(unidade_id);
CREATE INDEX IF NOT EXISTS idx_atom_connect_respostas_rapidas_unidade_id ON atom_connect_respostas_rapidas(unidade_id);
CREATE INDEX IF NOT EXISTS idx_atom_connect_transferencias_conversa_id ON atom_connect_transferencias(conversa_id);
CREATE INDEX IF NOT EXISTS idx_atom_connect_transferencias_de_usuario_id ON atom_connect_transferencias(de_usuario_id);
CREATE INDEX IF NOT EXISTS idx_atom_connect_transferencias_para_usuario_id ON atom_connect_transferencias(para_usuario_id);
CREATE INDEX IF NOT EXISTS idx_chat_conversations_created_by ON chat_conversations(created_by);
CREATE INDEX IF NOT EXISTS idx_chat_messages_reply_to_message_id ON chat_messages(reply_to_message_id);
CREATE INDEX IF NOT EXISTS idx_cotacao_comentarios_usuario_id ON cotacao_comentarios(usuario_id);
CREATE INDEX IF NOT EXISTS idx_cotacoes_cotacao_original_id ON cotacoes(cotacao_original_id);
CREATE INDEX IF NOT EXISTS idx_cotacoes_criado_por ON cotacoes(criado_por);
CREATE INDEX IF NOT EXISTS idx_cotacoes_forma_pagamento_id ON cotacoes(forma_pagamento_id);
CREATE INDEX IF NOT EXISTS idx_cotacoes_orcamento_enviado_por ON cotacoes(orcamento_enviado_por);
CREATE INDEX IF NOT EXISTS idx_cotacoes_ultima_modificacao_por ON cotacoes(ultima_modificacao_por);
CREATE INDEX IF NOT EXISTS idx_cotacoes_historico_usuario_id ON cotacoes_historico(usuario_id);
CREATE INDEX IF NOT EXISTS idx_cotacoes_pecas_cotacao_id ON cotacoes_pecas(cotacao_id);
CREATE INDEX IF NOT EXISTS idx_cotacoes_pecas_os_id ON cotacoes_pecas(os_id);
CREATE INDEX IF NOT EXISTS idx_cotacoes_servicos_cotacao_id ON cotacoes_servicos(cotacao_id);
CREATE INDEX IF NOT EXISTS idx_cotacoes_servicos_os_id ON cotacoes_servicos(os_id);
CREATE INDEX IF NOT EXISTS idx_cotacoes_servicos_servico_id ON cotacoes_servicos(servico_id);
CREATE INDEX IF NOT EXISTS idx_estoque_devolucoes_aprovada_por ON estoque_devolucoes(aprovada_por);
CREATE INDEX IF NOT EXISTS idx_estoque_devolucoes_conferida_por ON estoque_devolucoes(conferida_por);
CREATE INDEX IF NOT EXISTS idx_estoque_devolucoes_os_id ON estoque_devolucoes(os_id);
CREATE INDEX IF NOT EXISTS idx_estoque_devolucoes_solicitada_por ON estoque_devolucoes(solicitada_por);
CREATE INDEX IF NOT EXISTS idx_estoque_historico_usuario_id ON estoque_historico(usuario_id);
CREATE INDEX IF NOT EXISTS idx_estoque_nf_devolucoes_emitido_por ON estoque_nf_devolucoes(emitido_por);
CREATE INDEX IF NOT EXISTS idx_estoque_nf_devolucoes_unidade_id ON estoque_nf_devolucoes(unidade_id);
CREATE INDEX IF NOT EXISTS idx_estoque_nfs_processada_por ON estoque_nfs(processada_por);
CREATE INDEX IF NOT EXISTS idx_estoque_pecas_gi_cancelada_por ON estoque_pecas(gi_cancelada_por);
CREATE INDEX IF NOT EXISTS idx_estoque_pecas_os_id ON estoque_pecas(os_id);
CREATE INDEX IF NOT EXISTS idx_estoque_pecas_tecnico_id ON estoque_pecas(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_estoque_pedidos_requisicao_peca_id ON estoque_pedidos(requisicao_peca_id);
CREATE INDEX IF NOT EXISTS idx_estoque_pedidos_solicitado_por ON estoque_pedidos(solicitado_por);
CREATE INDEX IF NOT EXISTS idx_estoque_pedidos_unidade_id ON estoque_pedidos(unidade_id);
CREATE INDEX IF NOT EXISTS idx_estoque_transferencias_aprovada_por ON estoque_transferencias(aprovada_por);
CREATE INDEX IF NOT EXISTS idx_estoque_transferencias_concluida_por ON estoque_transferencias(concluida_por);
CREATE INDEX IF NOT EXISTS idx_estoque_transferencias_destino_tecnico_id ON estoque_transferencias(destino_tecnico_id);
CREATE INDEX IF NOT EXISTS idx_estoque_transferencias_destino_unidade_id ON estoque_transferencias(destino_unidade_id);
CREATE INDEX IF NOT EXISTS idx_estoque_transferencias_origem_tecnico_id ON estoque_transferencias(origem_tecnico_id);
CREATE INDEX IF NOT EXISTS idx_estoque_transferencias_origem_unidade_id ON estoque_transferencias(origem_unidade_id);
CREATE INDEX IF NOT EXISTS idx_estoque_transferencias_os_id ON estoque_transferencias(os_id);
CREATE INDEX IF NOT EXISTS idx_estoque_transferencias_solicitada_por ON estoque_transferencias(solicitada_por);
CREATE INDEX IF NOT EXISTS idx_etiquetas_templates_criado_por ON etiquetas_templates(criado_por);
CREATE INDEX IF NOT EXISTS idx_financeiro_aportes_lancado_por ON financeiro_aportes(lancado_por);
CREATE INDEX IF NOT EXISTS idx_financeiro_aportes_unidade_id ON financeiro_aportes(unidade_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_forma_pagamento_id ON financeiro_lancamentos(forma_pagamento_id);
CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_lancado_por ON financeiro_lancamentos(lancado_por);
CREATE INDEX IF NOT EXISTS idx_financeiro_lancamentos_unidade_id ON financeiro_lancamentos(unidade_id);
CREATE INDEX IF NOT EXISTS idx_gia_mural_tarefas_unidade_id ON gia_mural_tarefas(unidade_id);
CREATE INDEX IF NOT EXISTS idx_metas_performance_criado_por ON metas_performance(criado_por);
CREATE INDEX IF NOT EXISTS idx_nf_emitidas_emitido_por ON nf_emitidas(emitido_por);
CREATE INDEX IF NOT EXISTS idx_nf_emitidas_nf_config_id ON nf_emitidas(nf_config_id);
CREATE INDEX IF NOT EXISTS idx_orcamento_aprovacao_tokens_criado_por ON orcamento_aprovacao_tokens(criado_por);
CREATE INDEX IF NOT EXISTS idx_os_cotacao_id ON os(cotacao_id);
CREATE INDEX IF NOT EXISTS idx_os_criado_por ON os(criado_por);
CREATE INDEX IF NOT EXISTS idx_os_fechada_por ON os(fechada_por);
CREATE INDEX IF NOT EXISTS idx_os_nps_conversa_id ON os(nps_conversa_id);
CREATE INDEX IF NOT EXISTS idx_os_orcamento_aprovado_por ON os(orcamento_aprovado_por);
CREATE INDEX IF NOT EXISTS idx_os_orcamento_enviado_por ON os(orcamento_enviado_por);
CREATE INDEX IF NOT EXISTS idx_os_orcamento_reprovado_por ON os(orcamento_reprovado_por);
CREATE INDEX IF NOT EXISTS idx_os_vendedor_responsavel_definido_por ON os(vendedor_responsavel_definido_por);
CREATE INDEX IF NOT EXISTS idx_os_anexos_usuario_id ON os_anexos(usuario_id);
CREATE INDEX IF NOT EXISTS idx_os_checklist_concluido_por ON os_checklist(concluido_por);
CREATE INDEX IF NOT EXISTS idx_os_checklist_os_id ON os_checklist(os_id);
CREATE INDEX IF NOT EXISTS idx_os_checklist_vinculados_vinculado_por ON os_checklist_vinculados(vinculado_por);
CREATE INDEX IF NOT EXISTS idx_os_comentarios_usuario_id ON os_comentarios(usuario_id);
CREATE INDEX IF NOT EXISTS idx_os_notas_fiscais_emitido_por ON os_notas_fiscais(emitido_por);
CREATE INDEX IF NOT EXISTS idx_os_pecas_aprovada_por ON os_pecas(aprovada_por);
CREATE INDEX IF NOT EXISTS idx_os_pecas_cotacao_peca_id ON os_pecas(cotacao_peca_id);
CREATE INDEX IF NOT EXISTS idx_os_pecas_requisitada_por ON os_pecas(requisitada_por);
CREATE INDEX IF NOT EXISTS idx_os_servicos_servico_id ON os_servicos(servico_id);
CREATE INDEX IF NOT EXISTS idx_pagamentos_lancado_por ON pagamentos(lancado_por);
CREATE INDEX IF NOT EXISTS idx_pipeline_erros_os_id ON pipeline_erros(os_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_erros_regra_id ON pipeline_erros(regra_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_regra_id ON pipeline_logs(regra_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_logs_usuario_id ON pipeline_logs(usuario_id);
CREATE INDEX IF NOT EXISTS idx_pipeline_regras_audit_usuario_id ON pipeline_regras_audit(usuario_id);
CREATE INDEX IF NOT EXISTS idx_requisicoes_pecas_atendido_por ON requisicoes_pecas(atendido_por);
CREATE INDEX IF NOT EXISTS idx_requisicoes_pecas_cotacao_peca_id ON requisicoes_pecas(cotacao_peca_id);
CREATE INDEX IF NOT EXISTS idx_requisicoes_pecas_reprovado_por ON requisicoes_pecas(reprovado_por);
CREATE INDEX IF NOT EXISTS idx_requisicoes_pecas_requisitado_por ON requisicoes_pecas(requisitado_por);
CREATE INDEX IF NOT EXISTS idx_requisicoes_pecas_tecnico_id ON requisicoes_pecas(tecnico_id);
CREATE INDEX IF NOT EXISTS idx_rotas_unidade_id ON rotas(unidade_id);
CREATE INDEX IF NOT EXISTS idx_skywalker_avaliacoes_vendas_criado_por ON skywalker_avaliacoes_vendas(criado_por);
CREATE INDEX IF NOT EXISTS idx_skywalker_avaliacoes_vendas_validada_por ON skywalker_avaliacoes_vendas(validada_por);
CREATE INDEX IF NOT EXISTS idx_skywalker_bonificacoes_nivel_minimo_id ON skywalker_bonificacoes(nivel_minimo_id);
CREATE INDEX IF NOT EXISTS idx_skywalker_conversoes_lancado_por ON skywalker_conversoes(lancado_por);
CREATE INDEX IF NOT EXISTS idx_skywalker_conversoes_profissional_id ON skywalker_conversoes(profissional_id);
CREATE INDEX IF NOT EXISTS idx_skywalker_google_reviews_aprovado_por ON skywalker_google_reviews(aprovado_por);
CREATE INDEX IF NOT EXISTS idx_skywalker_google_reviews_lancado_por ON skywalker_google_reviews(lancado_por);
CREATE INDEX IF NOT EXISTS idx_skywalker_google_reviews_unidade_id ON skywalker_google_reviews(unidade_id);
CREATE INDEX IF NOT EXISTS idx_skywalker_historico_niveis_aprovado_por ON skywalker_historico_niveis(aprovado_por);
CREATE INDEX IF NOT EXISTS idx_skywalker_historico_niveis_nivel_anterior_id ON skywalker_historico_niveis(nivel_anterior_id);
CREATE INDEX IF NOT EXISTS idx_skywalker_historico_niveis_nivel_novo_id ON skywalker_historico_niveis(nivel_novo_id);
CREATE INDEX IF NOT EXISTS idx_skywalker_instalacoes_lancado_por ON skywalker_instalacoes(lancado_por);
CREATE INDEX IF NOT EXISTS idx_skywalker_instalacoes_profissional_id ON skywalker_instalacoes(profissional_id);
CREATE INDEX IF NOT EXISTS idx_skywalker_lp_unidade_lancado_por ON skywalker_lp_unidade(lancado_por);
CREATE INDEX IF NOT EXISTS idx_skywalker_participacao_lancado_por ON skywalker_participacao(lancado_por);
CREATE INDEX IF NOT EXISTS idx_skywalker_participacao_profissional_id ON skywalker_participacao(profissional_id);
CREATE INDEX IF NOT EXISTS idx_skywalker_vendas_care_lancado_por ON skywalker_vendas_care(lancado_por);
CREATE INDEX IF NOT EXISTS idx_skywalker_vendas_store_lancado_por ON skywalker_vendas_store(lancado_por);
CREATE INDEX IF NOT EXISTS idx_tecnico_localizacoes_os_atual_id ON tecnico_localizacoes(os_atual_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_unidade_id ON usuarios(unidade_id);
CREATE INDEX IF NOT EXISTS idx_vendas_criado_por ON vendas(criado_por);
CREATE INDEX IF NOT EXISTS idx_whatsapp_envios_template_id ON whatsapp_envios(template_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_templates_unidade_id ON whatsapp_templates(unidade_id);
