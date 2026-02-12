/*
  # Sistema de Permissoes por Perfil

  1. Novas Tabelas
    - `role_permissions`
      - `id` (uuid, primary key)
      - `perfil` (text) - tipo do usuario (master, diretoria, gerente, etc)
      - `recurso` (text) - identificador do menu/funcionalidade
      - `tipo_recurso` (text) - 'menu', 'submenu', 'acao'
      - `habilitado` (boolean) - se esta ativo para este perfil
      - `pode_filtrar_unidades` (boolean) - se pode mudar filtro de unidade
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
  2. Constraints
    - Unique constraint em (perfil, recurso)
    
  3. Security
    - RLS habilitado
    - Apenas master/diretoria podem modificar

  4. Dados Iniciais
    - Insere permissoes padrao para cada perfil
*/

-- Criar tabela de permissoes por perfil
CREATE TABLE IF NOT EXISTS role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  perfil text NOT NULL CHECK (perfil IN ('master', 'diretoria', 'gerente', 'administrador', 'estoque', 'tecnico', 'tecnico_ih', 'vendedor', 'atendente')),
  recurso text NOT NULL,
  tipo_recurso text NOT NULL DEFAULT 'menu' CHECK (tipo_recurso IN ('menu', 'submenu', 'acao', 'filtro')),
  habilitado boolean NOT NULL DEFAULT true,
  descricao text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(perfil, recurso)
);

-- Habilitar RLS
ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

-- Politica de leitura: todos usuarios autenticados podem ler
CREATE POLICY "Todos podem ler permissoes"
  ON role_permissions
  FOR SELECT
  TO authenticated
  USING (true);

-- Politica de escrita: apenas master e diretoria
CREATE POLICY "Master e diretoria podem modificar permissoes"
  ON role_permissions
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u 
      WHERE u.id = auth.uid() 
      AND u.tipo IN ('master', 'diretoria')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios u 
      WHERE u.id = auth.uid() 
      AND u.tipo IN ('master', 'diretoria')
    )
  );

-- Funcao para atualizar updated_at
CREATE OR REPLACE FUNCTION update_role_permissions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_role_permissions_updated_at
  BEFORE UPDATE ON role_permissions
  FOR EACH ROW
  EXECUTE FUNCTION update_role_permissions_updated_at();

-- Inserir permissoes padrao para todos os perfis
-- Menus principais
DO $$
DECLARE
  perfis text[] := ARRAY['master', 'diretoria', 'gerente', 'administrador', 'estoque', 'tecnico', 'tecnico_ih', 'vendedor', 'atendente'];
  menus text[][] := ARRAY[
    ARRAY['menu_dashboard', 'Dashboard'],
    ARRAY['menu_kanban', 'Kanban'],
    ARRAY['menu_agendamento', 'Agendamento'],
    ARRAY['menu_otimizador', 'Otimizador'],
    ARRAY['menu_estoque', 'Estoque'],
    ARRAY['menu_financeiro', 'Financeiro'],
    ARRAY['menu_nf', 'Notas Fiscais'],
    ARRAY['menu_cotacoes', 'Cotacoes'],
    ARRAY['menu_ci', 'Customer Intelligence'],
    ARRAY['menu_gia', 'GIA'],
    ARRAY['menu_skywalker', 'Skywalker'],
    ARRAY['menu_chat', 'Chat'],
    ARRAY['menu_vendas', 'Registro de Vendas'],
    ARRAY['menu_atom_connect', 'Atom Connect'],
    ARRAY['menu_configuracoes', 'Configuracoes']
  ];
  p text;
  m text[];
  is_enabled boolean;
BEGIN
  FOREACH p IN ARRAY perfis LOOP
    FOREACH m SLICE 1 IN ARRAY menus LOOP
      -- Definir permissoes padrao baseadas no perfil
      is_enabled := true;
      
      -- Restricoes por perfil
      IF p = 'tecnico' OR p = 'tecnico_ih' THEN
        IF m[1] IN ('menu_financeiro', 'menu_ci', 'menu_atom_connect', 'menu_configuracoes') THEN
          is_enabled := false;
        END IF;
      ELSIF p = 'vendedor' THEN
        IF m[1] IN ('menu_otimizador', 'menu_estoque', 'menu_financeiro', 'menu_ci', 'menu_atom_connect') THEN
          is_enabled := false;
        END IF;
      ELSIF p = 'atendente' THEN
        IF m[1] IN ('menu_otimizador', 'menu_financeiro', 'menu_ci', 'menu_atom_connect', 'menu_skywalker') THEN
          is_enabled := false;
        END IF;
      ELSIF p = 'estoque' THEN
        IF m[1] IN ('menu_financeiro', 'menu_ci', 'menu_atom_connect', 'menu_skywalker', 'menu_vendas') THEN
          is_enabled := false;
        END IF;
      END IF;
      
      INSERT INTO role_permissions (perfil, recurso, tipo_recurso, habilitado, descricao)
      VALUES (p, m[1], 'menu', is_enabled, m[2])
      ON CONFLICT (perfil, recurso) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Submenus do Estoque
DO $$
DECLARE
  perfis text[] := ARRAY['master', 'diretoria', 'gerente', 'administrador', 'estoque', 'tecnico', 'tecnico_ih', 'vendedor', 'atendente'];
  submenus text[][] := ARRAY[
    ARRAY['estoque_dashboard', 'Dashboard Estoque'],
    ARRAY['estoque_geral', 'Estoque Geral'],
    ARRAY['estoque_entrada', 'Entrada de NF'],
    ARRAY['estoque_devolucoes', 'Devolucoes'],
    ARRAY['estoque_transferencias', 'Transferencias'],
    ARRAY['estoque_mapa', 'Mapa do Estoque']
  ];
  p text;
  m text[];
  is_enabled boolean;
BEGIN
  FOREACH p IN ARRAY perfis LOOP
    FOREACH m SLICE 1 IN ARRAY submenus LOOP
      is_enabled := true;
      
      IF p IN ('tecnico', 'tecnico_ih', 'vendedor', 'atendente') THEN
        is_enabled := false;
      END IF;
      
      INSERT INTO role_permissions (perfil, recurso, tipo_recurso, habilitado, descricao)
      VALUES (p, m[1], 'submenu', is_enabled, m[2])
      ON CONFLICT (perfil, recurso) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Submenus do Financeiro
DO $$
DECLARE
  perfis text[] := ARRAY['master', 'diretoria', 'gerente', 'administrador', 'estoque', 'tecnico', 'tecnico_ih', 'vendedor', 'atendente'];
  submenus text[][] := ARRAY[
    ARRAY['financeiro_dashboard', 'Dashboard Financeiro'],
    ARRAY['financeiro_caixa', 'Caixa'],
    ARRAY['financeiro_lancamentos', 'Lancamentos'],
    ARRAY['financeiro_consumo', 'Consumo de Pecas'],
    ARRAY['financeiro_pendencias', 'Pendencias Samsung']
  ];
  p text;
  m text[];
  is_enabled boolean;
BEGIN
  FOREACH p IN ARRAY perfis LOOP
    FOREACH m SLICE 1 IN ARRAY submenus LOOP
      is_enabled := true;
      
      IF p NOT IN ('master', 'diretoria', 'gerente', 'administrador') THEN
        is_enabled := false;
      END IF;
      
      INSERT INTO role_permissions (perfil, recurso, tipo_recurso, habilitado, descricao)
      VALUES (p, m[1], 'submenu', is_enabled, m[2])
      ON CONFLICT (perfil, recurso) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Submenus do Otimizador
DO $$
DECLARE
  perfis text[] := ARRAY['master', 'diretoria', 'gerente', 'administrador', 'estoque', 'tecnico', 'tecnico_ih', 'vendedor', 'atendente'];
  submenus text[][] := ARRAY[
    ARRAY['otimizador_dashboard', 'Dashboard Executivo'],
    ARRAY['otimizador_motor', 'Motor de Otimizacao'],
    ARRAY['otimizador_rotas', 'Gestao de Rotas'],
    ARRAY['otimizador_equipe', 'Gestao de Equipe'],
    ARRAY['otimizador_pecas', 'Controle de Pecas'],
    ARRAY['otimizador_checklists', 'Checklists'],
    ARRAY['otimizador_agenda', 'Agenda Operacional'],
    ARRAY['otimizador_rastreamento', 'Mapa de Rastreamento'],
    ARRAY['otimizador_analytics', 'Analytics'],
    ARRAY['otimizador_config', 'Configuracao']
  ];
  p text;
  m text[];
  is_enabled boolean;
BEGIN
  FOREACH p IN ARRAY perfis LOOP
    FOREACH m SLICE 1 IN ARRAY submenus LOOP
      is_enabled := true;
      
      IF p NOT IN ('master', 'diretoria', 'gerente', 'administrador') THEN
        is_enabled := false;
      END IF;
      
      INSERT INTO role_permissions (perfil, recurso, tipo_recurso, habilitado, descricao)
      VALUES (p, m[1], 'submenu', is_enabled, m[2])
      ON CONFLICT (perfil, recurso) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Submenus das Configuracoes
DO $$
DECLARE
  perfis text[] := ARRAY['master', 'diretoria', 'gerente', 'administrador', 'estoque', 'tecnico', 'tecnico_ih', 'vendedor', 'atendente'];
  submenus text[][] := ARRAY[
    ARRAY['config_unidades', 'Unidades'],
    ARRAY['config_usuarios', 'Usuarios'],
    ARRAY['config_servicos', 'Servicos'],
    ARRAY['config_markup', 'Markup'],
    ARRAY['config_taxas', 'Taxas'],
    ARRAY['config_rotas', 'Rotas'],
    ARRAY['config_checklists', 'Checklists'],
    ARRAY['config_pdf_os', 'PDF OS'],
    ARRAY['config_nf', 'Nota Fiscal'],
    ARRAY['config_permissoes', 'Permissoes']
  ];
  p text;
  m text[];
  is_enabled boolean;
BEGIN
  FOREACH p IN ARRAY perfis LOOP
    FOREACH m SLICE 1 IN ARRAY submenus LOOP
      is_enabled := true;
      
      -- Permissoes eh apenas para master e diretoria
      IF m[1] = 'config_permissoes' AND p NOT IN ('master', 'diretoria') THEN
        is_enabled := false;
      -- Usuarios eh para master, diretoria e gerente
      ELSIF m[1] = 'config_usuarios' AND p NOT IN ('master', 'diretoria', 'gerente') THEN
        is_enabled := false;
      -- Outros perfis so veem configuracoes basicas
      ELSIF p IN ('tecnico', 'tecnico_ih', 'vendedor', 'atendente') AND m[1] NOT IN ('config_unidades') THEN
        is_enabled := false;
      END IF;
      
      INSERT INTO role_permissions (perfil, recurso, tipo_recurso, habilitado, descricao)
      VALUES (p, m[1], 'submenu', is_enabled, m[2])
      ON CONFLICT (perfil, recurso) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Submenus do Atom Connect
DO $$
DECLARE
  perfis text[] := ARRAY['master', 'diretoria', 'gerente', 'administrador', 'estoque', 'tecnico', 'tecnico_ih', 'vendedor', 'atendente'];
  submenus text[][] := ARRAY[
    ARRAY['atom_connect_dashboard', 'Dashboard'],
    ARRAY['atom_connect_chat', 'Conversas'],
    ARRAY['atom_connect_kanban', 'Kanban'],
    ARRAY['atom_connect_automacao', 'Automacao'],
    ARRAY['atom_connect_marketing', 'Marketing'],
    ARRAY['atom_connect_config', 'Configuracoes']
  ];
  p text;
  m text[];
  is_enabled boolean;
BEGIN
  FOREACH p IN ARRAY perfis LOOP
    FOREACH m SLICE 1 IN ARRAY submenus LOOP
      is_enabled := true;
      
      IF p NOT IN ('master', 'diretoria', 'gerente', 'administrador') THEN
        is_enabled := false;
      END IF;
      
      INSERT INTO role_permissions (perfil, recurso, tipo_recurso, habilitado, descricao)
      VALUES (p, m[1], 'submenu', is_enabled, m[2])
      ON CONFLICT (perfil, recurso) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Submenus do Skywalker
DO $$
DECLARE
  perfis text[] := ARRAY['master', 'diretoria', 'gerente', 'administrador', 'estoque', 'tecnico', 'tecnico_ih', 'vendedor', 'atendente'];
  submenus text[][] := ARRAY[
    ARRAY['skywalker_visao_geral', 'Visao Geral'],
    ARRAY['skywalker_times', 'Times'],
    ARRAY['skywalker_regras', 'Regras do Jogo'],
    ARRAY['skywalker_niveis', 'Niveis e Bonus']
  ];
  p text;
  m text[];
  is_enabled boolean;
BEGIN
  FOREACH p IN ARRAY perfis LOOP
    FOREACH m SLICE 1 IN ARRAY submenus LOOP
      is_enabled := true;
      
      IF p NOT IN ('master', 'diretoria', 'gerente', 'administrador') THEN
        -- Tecnicos e vendedores podem ver visao geral
        IF m[1] != 'skywalker_visao_geral' THEN
          is_enabled := false;
        END IF;
      END IF;
      
      INSERT INTO role_permissions (perfil, recurso, tipo_recurso, habilitado, descricao)
      VALUES (p, m[1], 'submenu', is_enabled, m[2])
      ON CONFLICT (perfil, recurso) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Permissao de filtrar unidades (apenas master e diretoria sem unidade)
DO $$
DECLARE
  perfis text[] := ARRAY['master', 'diretoria', 'gerente', 'administrador', 'estoque', 'tecnico', 'tecnico_ih', 'vendedor', 'atendente'];
  p text;
  can_filter boolean;
BEGIN
  FOREACH p IN ARRAY perfis LOOP
    can_filter := (p IN ('master', 'diretoria'));
    
    INSERT INTO role_permissions (perfil, recurso, tipo_recurso, habilitado, descricao)
    VALUES (p, 'filtrar_unidades', 'filtro', can_filter, 'Pode filtrar dados de outras unidades')
    ON CONFLICT (perfil, recurso) DO NOTHING;
  END LOOP;
END $$;

-- Funcao para verificar permissao
CREATE OR REPLACE FUNCTION check_user_permission(p_user_id uuid, p_recurso text)
RETURNS boolean AS $$
DECLARE
  v_perfil text;
  v_habilitado boolean;
BEGIN
  -- Obter perfil do usuario
  SELECT tipo INTO v_perfil FROM usuarios WHERE id = p_user_id;
  
  IF v_perfil IS NULL THEN
    RETURN false;
  END IF;
  
  -- Master sempre tem acesso
  IF v_perfil = 'master' THEN
    RETURN true;
  END IF;
  
  -- Verificar permissao na tabela
  SELECT habilitado INTO v_habilitado
  FROM role_permissions
  WHERE perfil = v_perfil AND recurso = p_recurso;
  
  RETURN COALESCE(v_habilitado, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funcao RPC para obter todas permissoes de um perfil
CREATE OR REPLACE FUNCTION get_role_permissions(p_perfil text)
RETURNS TABLE(recurso text, tipo_recurso text, habilitado boolean, descricao text) AS $$
BEGIN
  RETURN QUERY
  SELECT rp.recurso, rp.tipo_recurso, rp.habilitado, rp.descricao
  FROM role_permissions rp
  WHERE rp.perfil = p_perfil
  ORDER BY rp.tipo_recurso, rp.recurso;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Funcao RPC para atualizar permissao
CREATE OR REPLACE FUNCTION update_role_permission(p_perfil text, p_recurso text, p_habilitado boolean)
RETURNS void AS $$
BEGIN
  UPDATE role_permissions
  SET habilitado = p_habilitado, updated_at = now()
  WHERE perfil = p_perfil AND recurso = p_recurso;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;