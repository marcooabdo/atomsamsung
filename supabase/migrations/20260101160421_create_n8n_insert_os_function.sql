/*
  # Função para N8N inserir OS (Bypass RLS)

  1. Nova Função
    - `n8n_insert_os`: Permite N8N/integrações externas criar OS ignorando RLS
    - Função com SECURITY DEFINER para executar com privilégios do criador
    - Retorna o ID da OS criada

  2. Segurança
    - Função executada como service_role (bypass RLS)
    - Validações básicas de dados obrigatórios
    - Usa usuário "Sistema" como criador padrão
*/

-- Função para inserir OS via N8N (bypass RLS)
CREATE OR REPLACE FUNCTION n8n_insert_os(
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
  p_cliente_vip boolean DEFAULT false
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_os_id uuid;
  v_usuario_sistema_id uuid;
BEGIN
  -- Validar unidade existe
  IF NOT EXISTS (SELECT 1 FROM unidades WHERE id = p_unidade_id) THEN
    RAISE EXCEPTION 'Unidade não encontrada: %', p_unidade_id;
  END IF;

  -- Buscar ID do usuário Sistema (criado em migração anterior)
  SELECT id INTO v_usuario_sistema_id
  FROM usuarios
  WHERE email = 'sistema@atom.com.br'
  LIMIT 1;

  -- Se não encontrar, usar NULL (a coluna permite)
  IF v_usuario_sistema_id IS NULL THEN
    RAISE WARNING 'Usuário Sistema não encontrado, criando OS sem criado_por';
  END IF;

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

  -- Log de auditoria
  INSERT INTO os_audit_logs (
    os_id,
    usuario_id,
    acao,
    campos_alterados,
    valores_anteriores,
    valores_novos
  ) VALUES (
    v_os_id,
    v_usuario_sistema_id,
    'CREATE',
    ARRAY['os_criada_via_n8n'],
    '{}',
    jsonb_build_object(
      'numero_os_samsung', p_numero_os_samsung,
      'tipo_os', p_tipo_os,
      'origem', 'N8N/Integração Externa'
    )
  );

  RETURN v_os_id;
END;
$$;

-- Comentário na função
COMMENT ON FUNCTION n8n_insert_os IS 'Função para N8N e integrações externas criarem OS no sistema, ignorando políticas RLS';
