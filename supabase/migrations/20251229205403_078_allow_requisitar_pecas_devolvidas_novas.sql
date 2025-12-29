/*
  # Permitir Requisitar Peças Devolvidas Novas

  1. Função para Resetar Status de Peças Devolvidas
    - Permite que peças com status `devolvida_nova` ou `devolvida_defeito` voltem para `disponivel`
    - Mantém o histórico da devolução
    - Remove vínculo com OS e técnico
    - Permite nova requisição da peça

  2. Lógica Implementada
    - Apenas peças `devolvida_nova` e `devolvida_defeito` podem ser resetadas
    - Peças com GI postada (status `usada`) NÃO podem ser requisitadas novamente
    - Cria registro no histórico da ação
    - Mantém rastreabilidade completa

  3. Casos de Uso
    - Peça nova devolvida pode ser requisitada novamente
    - Peça nova com defeito devolvida pode ser requisitada novamente
    - Peça usada (com GI) NÃO pode ser requisitada novamente
*/

-- Função para resetar peça devolvida e permitir nova requisição
CREATE OR REPLACE FUNCTION resetar_peca_devolvida_para_disponivel(
  p_peca_id uuid,
  p_usuario_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_peca_status text;
  v_usuario_nome text;
  v_peca_descricao text;
  v_peca_pn text;
BEGIN
  -- Buscar status atual da peça
  SELECT status, descricao, pn
  INTO v_peca_status, v_peca_descricao, v_peca_pn
  FROM estoque_pecas
  WHERE id = p_peca_id;

  -- Validar se a peça existe
  IF v_peca_status IS NULL THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Peça não encontrada'
    );
  END IF;

  -- Validar se a peça pode ser resetada (apenas devolvida_nova ou devolvida_defeito)
  IF v_peca_status NOT IN ('devolvida_nova', 'devolvida_defeito') THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', 'Apenas peças com status "devolvida_nova" ou "devolvida_defeito" podem ser requisitadas novamente'
    );
  END IF;

  -- Buscar nome do usuário
  SELECT nome INTO v_usuario_nome
  FROM usuarios
  WHERE id = p_usuario_id;

  -- Atualizar status da peça para disponível
  UPDATE estoque_pecas
  SET
    status = 'disponivel',
    os_id = NULL,
    tecnico_id = NULL,
    updated_at = now()
  WHERE id = p_peca_id;

  -- Registrar no histórico
  INSERT INTO estoque_historico (
    peca_id,
    usuario_id,
    acao,
    status_anterior,
    status_novo,
    observacao
  ) VALUES (
    p_peca_id,
    p_usuario_id,
    'reset_devolucao',
    v_peca_status,
    'disponivel',
    format(
      'Peça resetada por %s - Disponível para nova requisição. PN: %s - %s',
      COALESCE(v_usuario_nome, 'Sistema'),
      v_peca_pn,
      v_peca_descricao
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Peça resetada com sucesso e disponível para nova requisição',
    'peca_id', p_peca_id,
    'status_anterior', v_peca_status,
    'status_novo', 'disponivel'
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('Erro ao resetar peça: %s', SQLERRM)
    );
END;
$$;

-- Comentário na função
COMMENT ON FUNCTION resetar_peca_devolvida_para_disponivel IS
  'Reseta peça devolvida (nova ou nova_com_defeito) para status disponível, permitindo nova requisição. Peças usadas (com GI) não podem ser resetadas.';