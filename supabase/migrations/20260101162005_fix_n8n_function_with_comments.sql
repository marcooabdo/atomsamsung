/*
  # Atualizar função N8N com suporte a comentários

  1. Mudanças
    - Adiciona parâmetro para comentário inicial
    - Insere comentário automaticamente se fornecido
    - Garante que a função tem permissões totais (SECURITY DEFINER)

  2. Segurança
    - Função executa com privilégios elevados (bypass RLS)
    - Valida dados obrigatórios antes de inserir
*/

-- Recriar função com suporte a comentários
CREATE OR REPLACE FUNCTION n8n_insert_os_with_comments(
  p_unidade_id uuid,
  p_numero_os_samsung text,
  p_tipo_os text DEFAULT 'LP',
  p_tipo_orcamento text DEFAULT 'LP',
  p_tipo_atendimento text DEFAULT 'IH',
  p_cliente_nome text DEFAULT NULL,
  p_cliente_cpf text DEFAULT NULL,
  p_cliente_telefone text DEFAULT NULL,
  p_cliente_email text DEFAULT NULL,
  p_cliente_cep text DEFAULT NULL,
  p_cliente_logradouro text DEFAULT NULL,
  p_cliente_numero text DEFAULT NULL,
  p_cliente_complemento text DEFAULT NULL,
  p_cliente_bairro text DEFAULT NULL,
  p_cliente_cidade text DEFAULT NULL,
  p_cliente_estado text DEFAULT NULL,
  p_aparelho_linha text DEFAULT NULL,
  p_aparelho_modelo text DEFAULT NULL,
  p_aparelho_numero_serie text DEFAULT NULL,
  p_aparelho_imei text DEFAULT NULL,
  p_defeito_relatado text DEFAULT NULL,
  p_observacoes_internas text DEFAULT NULL,
  p_status_kanban text DEFAULT 'os_nova',
  p_data_abertura_samsung timestamptz DEFAULT NULL,
  p_data_compra date DEFAULT NULL,
  p_status_garantia text DEFAULT NULL,
  p_cliente_vip boolean DEFAULT false,
  p_comentario_inicial text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_os_id uuid;
  v_usuario_sistema_id uuid;
  v_comentario_id uuid;
BEGIN
  -- Validar unidade existe
  IF NOT EXISTS (SELECT 1 FROM unidades WHERE id = p_unidade_id) THEN
    RAISE EXCEPTION 'Unidade não encontrada: %', p_unidade_id;
  END IF;

  -- Buscar ID do usuário Sistema
  SELECT id INTO v_usuario_sistema_id
  FROM usuarios
  WHERE email = 'sistema@atom.com.br'
  LIMIT 1;

  -- Inserir OS
  INSERT INTO os (
    unidade_id,
    numero_os_samsung,
    tipo_os,
    tipo_orcamento,
    tipo_atendimento,
    cliente_nome,
    cliente_cpf,
    cliente_telefone,
    cliente_email,
    cliente_cep,
    cliente_logradouro,
    cliente_numero,
    cliente_complemento,
    cliente_bairro,
    cliente_cidade,
    cliente_estado,
    aparelho_linha,
    aparelho_modelo,
    aparelho_numero_serie,
    aparelho_imei,
    defeito_relatado,
    observacoes_internas,
    status_kanban,
    data_abertura_samsung,
    data_compra,
    status_garantia,
    cliente_vip,
    criado_por
  ) VALUES (
    p_unidade_id,
    p_numero_os_samsung,
    p_tipo_os,
    p_tipo_orcamento,
    p_tipo_atendimento,
    p_cliente_nome,
    p_cliente_cpf,
    p_cliente_telefone,
    p_cliente_email,
    p_cliente_cep,
    p_cliente_logradouro,
    p_cliente_numero,
    p_cliente_complemento,
    p_cliente_bairro,
    p_cliente_cidade,
    p_cliente_estado,
    p_aparelho_linha,
    p_aparelho_modelo,
    p_aparelho_numero_serie,
    p_aparelho_imei,
    p_defeito_relatado,
    p_observacoes_internas,
    p_status_kanban,
    p_data_abertura_samsung,
    p_data_compra,
    p_status_garantia,
    p_cliente_vip,
    v_usuario_sistema_id
  )
  RETURNING id INTO v_os_id;

  -- Inserir comentário inicial se fornecido
  IF p_comentario_inicial IS NOT NULL AND p_comentario_inicial != '' THEN
    INSERT INTO os_comentarios (
      os_id,
      usuario_id,
      comentario,
      is_system
    ) VALUES (
      v_os_id,
      v_usuario_sistema_id,
      p_comentario_inicial,
      true
    )
    RETURNING id INTO v_comentario_id;
  END IF;

  -- Retornar resultado
  RETURN jsonb_build_object(
    'os_id', v_os_id,
    'comentario_id', v_comentario_id,
    'success', true,
    'message', 'OS criada com sucesso'
  );
END;
$$;

-- Dar permissões para service_role e anon
GRANT EXECUTE ON FUNCTION n8n_insert_os_with_comments TO anon, authenticated, service_role;

-- Comentário
COMMENT ON FUNCTION n8n_insert_os_with_comments IS 'Função para N8N criar OS com comentário inicial (bypass RLS completo)';
