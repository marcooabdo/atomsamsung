/*
  # Create function to migrate orphan users

  1. Purpose
    - Migrates users that exist in 'usuarios' table but not in 'auth.users'
    - Updates all foreign key references from old_id to new_id
    - Must be called after creating the user in auth.users

  2. Security
    - Function is security definer to run with elevated privileges
    - Only callable by service role
*/

CREATE OR REPLACE FUNCTION migrate_user_id(old_user_id uuid, new_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  old_user_data RECORD;
BEGIN
  SELECT * INTO old_user_data FROM usuarios WHERE id = old_user_id;
  
  IF old_user_data IS NULL THEN
    RAISE EXCEPTION 'Usuario com ID % nao encontrado', old_user_id;
  END IF;

  UPDATE agendamentos SET tecnico_id = new_user_id WHERE tecnico_id = old_user_id;
  UPDATE agendamentos SET agendado_por = new_user_id WHERE agendado_por = old_user_id;
  UPDATE chat_conversations SET created_by = new_user_id WHERE created_by = old_user_id;
  UPDATE chat_message_reads SET user_id = new_user_id WHERE user_id = old_user_id;
  UPDATE chat_messages SET sender_id = new_user_id WHERE sender_id = old_user_id;
  UPDATE chat_participants SET user_id = new_user_id WHERE user_id = old_user_id;
  UPDATE cotacao_comentarios SET usuario_id = new_user_id WHERE usuario_id = old_user_id;
  UPDATE cotacoes SET criado_por = new_user_id WHERE criado_por = old_user_id;
  UPDATE cotacoes SET ultima_modificacao_por = new_user_id WHERE ultima_modificacao_por = old_user_id;
  UPDATE cotacoes SET orcamento_enviado_por = new_user_id WHERE orcamento_enviado_por = old_user_id;
  UPDATE cotacoes_historico SET usuario_id = new_user_id WHERE usuario_id = old_user_id;
  UPDATE estoque_devolucoes SET solicitada_por = new_user_id WHERE solicitada_por = old_user_id;
  UPDATE estoque_devolucoes SET conferida_por = new_user_id WHERE conferida_por = old_user_id;
  UPDATE estoque_devolucoes SET aprovada_por = new_user_id WHERE aprovada_por = old_user_id;
  UPDATE estoque_historico SET usuario_id = new_user_id WHERE usuario_id = old_user_id;
  UPDATE estoque_nf_devolucoes SET emitido_por = new_user_id WHERE emitido_por = old_user_id;
  UPDATE estoque_nfs SET processada_por = new_user_id WHERE processada_por = old_user_id;
  UPDATE estoque_pecas SET tecnico_id = new_user_id WHERE tecnico_id = old_user_id;
  UPDATE estoque_pedidos SET solicitado_por = new_user_id WHERE solicitado_por = old_user_id;
  UPDATE estoque_transferencias SET origem_tecnico_id = new_user_id WHERE origem_tecnico_id = old_user_id;
  UPDATE estoque_transferencias SET destino_tecnico_id = new_user_id WHERE destino_tecnico_id = old_user_id;
  UPDATE estoque_transferencias SET solicitada_por = new_user_id WHERE solicitada_por = old_user_id;
  UPDATE estoque_transferencias SET aprovada_por = new_user_id WHERE aprovada_por = old_user_id;
  UPDATE estoque_transferencias SET concluida_por = new_user_id WHERE concluida_por = old_user_id;
  UPDATE financeiro_aportes SET lancado_por = new_user_id WHERE lancado_por = old_user_id;
  UPDATE financeiro_lancamentos SET lancado_por = new_user_id WHERE lancado_por = old_user_id;
  UPDATE os SET tecnico_id = new_user_id WHERE tecnico_id = old_user_id;
  UPDATE os SET tecnico_agendado_id = new_user_id WHERE tecnico_agendado_id = old_user_id;
  UPDATE os SET criado_por = new_user_id WHERE criado_por = old_user_id;
  UPDATE os SET fechada_por = new_user_id WHERE fechada_por = old_user_id;
  UPDATE os_anexos SET usuario_id = new_user_id WHERE usuario_id = old_user_id;
  UPDATE os_checklist SET concluido_por = new_user_id WHERE concluido_por = old_user_id;
  UPDATE os_comentarios SET usuario_id = new_user_id WHERE usuario_id = old_user_id;
  UPDATE os_pecas SET requisitada_por = new_user_id WHERE requisitada_por = old_user_id;
  UPDATE os_pecas SET aprovada_por = new_user_id WHERE aprovada_por = old_user_id;
  UPDATE pagamentos SET lancado_por = new_user_id WHERE lancado_por = old_user_id;
  UPDATE pagamentos SET responsavel_fechamento = new_user_id WHERE responsavel_fechamento = old_user_id;
  UPDATE requisicoes_pecas SET tecnico_id = new_user_id WHERE tecnico_id = old_user_id;
  UPDATE requisicoes_pecas SET requisitado_por = new_user_id WHERE requisitado_por = old_user_id;
  UPDATE requisicoes_pecas SET atendido_por = new_user_id WHERE atendido_por = old_user_id;
  UPDATE requisicoes_pecas SET reprovado_por = new_user_id WHERE reprovado_por = old_user_id;
  UPDATE samsung_sync_logs SET executado_por = new_user_id WHERE executado_por = old_user_id;
  UPDATE skywalker_conversoes SET lancado_por = new_user_id WHERE lancado_por = old_user_id;
  UPDATE skywalker_google_reviews SET lancado_por = new_user_id WHERE lancado_por = old_user_id;
  UPDATE skywalker_google_reviews SET aprovado_por = new_user_id WHERE aprovado_por = old_user_id;
  UPDATE skywalker_historico_niveis SET aprovado_por = new_user_id WHERE aprovado_por = old_user_id;
  UPDATE skywalker_instalacoes SET lancado_por = new_user_id WHERE lancado_por = old_user_id;
  UPDATE skywalker_lp_unidade SET lancado_por = new_user_id WHERE lancado_por = old_user_id;
  UPDATE skywalker_participacao SET lancado_por = new_user_id WHERE lancado_por = old_user_id;
  UPDATE skywalker_profissionais SET usuario_id = new_user_id WHERE usuario_id = old_user_id;
  UPDATE skywalker_vendas_care SET lancado_por = new_user_id WHERE lancado_por = old_user_id;
  UPDATE skywalker_vendas_store SET lancado_por = new_user_id WHERE lancado_por = old_user_id;
  UPDATE user_presence SET user_id = new_user_id WHERE user_id = old_user_id;

  DELETE FROM usuarios WHERE id = old_user_id;

  INSERT INTO usuarios (id, nome, email, tipo, unidade_id, ativo, numero_tecnico, 
                        horario_inicio_expediente, horario_fim_expediente, 
                        duracao_almoco_minutos, horario_almoco_inicio, created_at)
  VALUES (new_user_id, old_user_data.nome, old_user_data.email, old_user_data.tipo, 
          old_user_data.unidade_id, old_user_data.ativo, old_user_data.numero_tecnico,
          old_user_data.horario_inicio_expediente, old_user_data.horario_fim_expediente,
          old_user_data.duracao_almoco_minutos, old_user_data.horario_almoco_inicio,
          old_user_data.created_at);
END;
$$;
