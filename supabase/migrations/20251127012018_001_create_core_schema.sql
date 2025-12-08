/*
  # Sistema Samsung - Schema Principal
  
  ## Visão Geral
  Este sistema gerencia toda a operação Samsung incluindo LP (garantia), OW (fora de garantia), 
  CI (carry-in/balcão) e IH (in-home/domicílio). O sistema controla cotações, kanban operacional,
  estoque com rastreamento por ID único, agendamentos, financeiro e dashboards gerenciais.
  
  ## 1. Tabelas de Configuração Base
  
  ### 1.1. unidades
  - Unidades/filiais da operação Samsung
  - Campos: id, nome, cidade, estado, endereço, telefone, ativa
  
  ### 1.2. usuarios
  - Usuários do sistema com controle de permissões
  - Tipos: tecnico, estoque, recepcao, financeiro, gerente, master
  - Integrado com auth.users do Supabase
  
  ### 1.3. servicos
  - Catálogo de serviços prestados (mão de obra)
  - Campos: código, descrição, valor padrão
  
  ### 1.4. rotas
  - Rotas de atendimento IH (rota amarela, vermelha, etc)
  - Vinculadas a cidades específicas
  
  ### 1.5. formas_pagamento
  - Formas de pagamento aceitas
  - Campos: nome, requer SKU, taxa percentual
  
  ## 2. Módulo de Cotações
  
  ### 2.1. cotacoes
  - Registro de todas as cotações OW e fora de garantia
  - Estados: pendente_preenchimento, enviada, aprovada, reprovada, reprovada_refeita
  - Vincula com OS Samsung ou cria número interno
  
  ### 2.2. cotacoes_pecas
  - Peças incluídas em cada cotação
  - Cálculo automático com markup configurável
  
  ### 2.3. cotacoes_servicos
  - Serviços incluídos em cada cotação
  
  ### 2.4. cotacoes_historico
  - Log completo de alterações em cotações
  
  ## 3. Módulo Kanban / OS
  
  ### 3.1. os (Ordens de Serviço)
  - Registro central de todas as OS (LP e OW, CI e IH)
  - Controla fluxo completo do Kanban
  - Estados mapeados para colunas do Kanban
  
  ### 3.2. os_pecas
  - Peças vinculadas a cada OS
  - Rastreamento de solicitação, aprovação, uso
  
  ### 3.3. os_checklist
  - Checklist técnico para cada OS
  
  ### 3.4. os_comentarios
  - Comentários internos sobre a OS
  
  ### 3.5. os_anexos
  - Fotos, vídeos, documentos vinculados à OS
  
  ## 4. Módulo Estoque
  
  ### 4.1. estoque_nfs
  - Notas fiscais de entrada de peças
  
  ### 4.2. estoque_pecas
  - Cada registro = 1 peça física com ID único
  - Estados: disponivel, reservada, vinculada_tecnico, em_rota, em_uso, usada, 
  -          devolucao_pendente, devolvida_nova, devolvida_defeito, usada_upc
  
  ### 4.3. estoque_transferencias
  - Movimentações de peças entre locais/técnicos
  
  ### 4.4. estoque_devolucoes
  - Controle de devoluções (nova, nova com defeito, usada)
  
  ### 4.5. estoque_pedidos
  - Pedidos OFS quando não há peça disponível
  
  ## 5. Módulo Agendamento
  
  ### 5.1. agendamentos
  - Agenda de atendimentos CI e IH
  - Vinculado a OS, técnico, rota
  
  ### 5.2. agendamentos_checkin_checkout
  - Registro de check-in/check-out técnico
  - Captura localização, horário, fotos
  
  ## 6. Módulo Financeiro
  
  ### 6.1. financeiro_lancamentos
  - Todos os recebimentos vinculados a OS
  - Obrigatório: número OS ou cotação
  - SKU único para cartão/link
  
  ### 6.2. financeiro_aportes
  - Aportes realizados para pagamento Samsung
  
  ## 7. Segurança (RLS)
  
  Todas as tabelas terão RLS habilitado com políticas restritivas baseadas em:
  - Autenticação obrigatória
  - Tipo de usuário (role)
  - Unidade do usuário (quando aplicável)
*/

-- ============================================================================
-- 1. TABELAS DE CONFIGURAÇÃO BASE
-- ============================================================================

-- 1.1. Unidades
CREATE TABLE IF NOT EXISTS unidades (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cidade text NOT NULL,
  estado text NOT NULL,
  endereco text,
  telefone text,
  ativa boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE unidades ENABLE ROW LEVEL SECURITY;

-- 1.2. Usuários
CREATE TABLE IF NOT EXISTS usuarios (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  email text NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('tecnico', 'estoque', 'recepcao', 'financeiro', 'gerente', 'master')),
  unidade_id uuid REFERENCES unidades(id),
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;

-- 1.3. Serviços
CREATE TABLE IF NOT EXISTS servicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text UNIQUE NOT NULL,
  descricao text NOT NULL,
  valor_padrao decimal(10,2) NOT NULL DEFAULT 0,
  ativo boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE servicos ENABLE ROW LEVEL SECURITY;

-- 1.4. Rotas
CREATE TABLE IF NOT EXISTS rotas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  cor text,
  cidades text[] NOT NULL DEFAULT '{}',
  ativa boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE rotas ENABLE ROW LEVEL SECURITY;

-- 1.5. Formas de Pagamento
CREATE TABLE IF NOT EXISTS formas_pagamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  requer_sku boolean DEFAULT false,
  taxa_percentual decimal(5,2) DEFAULT 0,
  ativa boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE formas_pagamento ENABLE ROW LEVEL SECURITY;

-- 1.6. Configurações de Markup
CREATE TABLE IF NOT EXISTS configuracoes_markup (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL CHECK (tipo IN ('global', 'categoria', 'faixa_valor')),
  valor_min decimal(10,2),
  valor_max decimal(10,2),
  markup_percentual decimal(5,2),
  markup_multiplicador decimal(5,2),
  categoria text,
  ativa boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE configuracoes_markup ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 2. MÓDULO DE COTAÇÕES
-- ============================================================================

-- 2.1. Cotações
CREATE TABLE IF NOT EXISTS cotacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_cotacao text UNIQUE NOT NULL,
  numero_os_samsung text,
  tipo_atendimento text NOT NULL CHECK (tipo_atendimento IN ('IH', 'CI')),
  tipo_os text NOT NULL CHECK (tipo_os IN ('LP', 'OW')),
  unidade_id uuid REFERENCES unidades(id) NOT NULL,
  status text NOT NULL DEFAULT 'pendente_preenchimento' CHECK (status IN ('pendente_preenchimento', 'enviada', 'aprovada', 'reprovada', 'reprovada_refeita')),
  
  -- Dados Cliente
  cliente_nome text NOT NULL,
  cliente_cpf_cnpj text,
  cliente_telefone text,
  cliente_email text,
  cliente_endereco text,
  
  -- Dados Aparelho
  aparelho_marca text,
  aparelho_linha text,
  aparelho_modelo text,
  aparelho_numero_serie text,
  
  defeito_relatado text,
  observacoes_internas text,
  observacoes_cliente text,
  
  -- Pagamento
  forma_pagamento_id uuid REFERENCES formas_pagamento(id),
  parcelamento int,
  valor_entrada decimal(10,2) DEFAULT 0,
  
  -- Aprovação
  link_aprovacao text UNIQUE,
  aprovada_em timestamptz,
  aprovada_ip text,
  aprovada_localizacao text,
  aprovada_dispositivo text,
  reprovada_em timestamptz,
  reprovada_motivo text,
  
  versao int DEFAULT 1,
  cotacao_original_id uuid REFERENCES cotacoes(id),
  
  criado_por uuid REFERENCES usuarios(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE cotacoes ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_cotacoes_status ON cotacoes(status);
CREATE INDEX idx_cotacoes_unidade ON cotacoes(unidade_id);
CREATE INDEX idx_cotacoes_os_samsung ON cotacoes(numero_os_samsung);

-- 2.2. Peças da Cotação
CREATE TABLE IF NOT EXISTS cotacoes_pecas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id uuid REFERENCES cotacoes(id) ON DELETE CASCADE NOT NULL,
  pn text NOT NULL,
  descricao text NOT NULL,
  quantidade int NOT NULL DEFAULT 1,
  valor_base_gspn decimal(10,2) NOT NULL,
  markup_aplicado decimal(5,2),
  valor_final_unitario decimal(10,2) NOT NULL,
  valor_total decimal(10,2) NOT NULL,
  observacao text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE cotacoes_pecas ENABLE ROW LEVEL SECURITY;

-- 2.3. Serviços da Cotação
CREATE TABLE IF NOT EXISTS cotacoes_servicos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id uuid REFERENCES cotacoes(id) ON DELETE CASCADE NOT NULL,
  servico_id uuid REFERENCES servicos(id) NOT NULL,
  descricao text NOT NULL,
  quantidade int NOT NULL DEFAULT 1,
  valor_unitario decimal(10,2) NOT NULL,
  valor_total decimal(10,2) NOT NULL,
  observacao text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE cotacoes_servicos ENABLE ROW LEVEL SECURITY;

-- 2.4. Histórico de Cotações
CREATE TABLE IF NOT EXISTS cotacoes_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cotacao_id uuid REFERENCES cotacoes(id) ON DELETE CASCADE NOT NULL,
  usuario_id uuid REFERENCES usuarios(id) NOT NULL,
  acao text NOT NULL,
  campo_alterado text,
  valor_anterior text,
  valor_novo text,
  motivo text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE cotacoes_historico ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_cotacoes_historico_cotacao ON cotacoes_historico(cotacao_id);

-- ============================================================================
-- 3. MÓDULO KANBAN / OS
-- ============================================================================

-- 3.1. Ordens de Serviço
CREATE TABLE IF NOT EXISTS os (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_os_samsung text,
  numero_os_interna text,
  cotacao_id uuid REFERENCES cotacoes(id),
  tipo_atendimento text NOT NULL CHECK (tipo_atendimento IN ('IH', 'CI')),
  tipo_os text NOT NULL CHECK (tipo_os IN ('LP', 'OW')),
  unidade_id uuid REFERENCES unidades(id) NOT NULL,
  
  -- Kanban Status
  coluna_kanban text NOT NULL DEFAULT 'os_nova' CHECK (coluna_kanban IN (
    'os_nova', 'diagnostico', 'aguardando_cotacao', 'aguardando_aprovacao',
    'orcamento_aprovado', 'aguardando_peca', 'peca_em_transito', 'peca_disponivel',
    'em_reparo_ci', 'em_rota_ih', 'reparo_concluido', 'aguardando_fechamento',
    'fechar_os', 'os_fechada', 'orcamentos_rejeitados'
  )),
  
  -- Dados Cliente
  cliente_nome text NOT NULL,
  cliente_cpf_cnpj text,
  cliente_telefone text,
  cliente_email text,
  cliente_endereco text,
  
  -- Dados Aparelho
  aparelho_marca text,
  aparelho_linha text,
  aparelho_modelo text,
  aparelho_numero_serie text,
  
  defeito_relatado text,
  observacoes_internas text,
  
  -- SLA e Alertas
  dias_na_etapa int DEFAULT 0,
  alerta_divergencia_gspn boolean DEFAULT false,
  status_gspn text,
  
  -- Técnico
  tecnico_id uuid REFERENCES usuarios(id),
  rota_id uuid REFERENCES rotas(id),
  
  -- Fechamento
  fechada_em timestamptz,
  fechada_por uuid REFERENCES usuarios(id),
  
  criado_por uuid REFERENCES usuarios(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT unique_os_samsung UNIQUE NULLS NOT DISTINCT (numero_os_samsung),
  CONSTRAINT unique_os_interna UNIQUE NULLS NOT DISTINCT (numero_os_interna)
);

ALTER TABLE os ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_os_coluna_kanban ON os(coluna_kanban);
CREATE INDEX idx_os_unidade ON os(unidade_id);
CREATE INDEX idx_os_tecnico ON os(tecnico_id);
CREATE INDEX idx_os_os_samsung ON os(numero_os_samsung);

-- 3.2. Peças da OS
CREATE TABLE IF NOT EXISTS os_pecas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid REFERENCES os(id) ON DELETE CASCADE NOT NULL,
  pn text NOT NULL,
  descricao text NOT NULL,
  quantidade int NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'requisitada' CHECK (status IN (
    'requisitada', 'aprovada', 'em_transito', 'disponivel', 'vinculada_tecnico',
    'em_uso', 'usada', 'devolvida', 'cancelada'
  )),
  estoque_peca_id uuid,
  requisitada_por uuid REFERENCES usuarios(id) NOT NULL,
  requisitada_em timestamptz DEFAULT now(),
  aprovada_por uuid REFERENCES usuarios(id),
  aprovada_em timestamptz,
  usada_em timestamptz,
  gi_postado_em timestamptz,
  devolvida_em timestamptz,
  observacao text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE os_pecas ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_os_pecas_os ON os_pecas(os_id);
CREATE INDEX idx_os_pecas_status ON os_pecas(status);

-- 3.3. Checklist da OS
CREATE TABLE IF NOT EXISTS os_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid REFERENCES os(id) ON DELETE CASCADE NOT NULL,
  item text NOT NULL,
  concluido boolean DEFAULT false,
  concluido_por uuid REFERENCES usuarios(id),
  concluido_em timestamptz,
  observacao text,
  ordem int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE os_checklist ENABLE ROW LEVEL SECURITY;

-- 3.4. Comentários da OS
CREATE TABLE IF NOT EXISTS os_comentarios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid REFERENCES os(id) ON DELETE CASCADE NOT NULL,
  usuario_id uuid REFERENCES usuarios(id) NOT NULL,
  comentario text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE os_comentarios ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_os_comentarios_os ON os_comentarios(os_id);

-- 3.5. Anexos da OS
CREATE TABLE IF NOT EXISTS os_anexos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid REFERENCES os(id) ON DELETE CASCADE NOT NULL,
  cotacao_id uuid REFERENCES cotacoes(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('foto', 'video', 'documento')),
  nome_arquivo text NOT NULL,
  url text NOT NULL,
  tamanho_bytes bigint,
  usuario_id uuid REFERENCES usuarios(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE os_anexos ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_os_anexos_os ON os_anexos(os_id);
CREATE INDEX idx_os_anexos_cotacao ON os_anexos(cotacao_id);

-- ============================================================================
-- 4. MÓDULO ESTOQUE
-- ============================================================================

-- 4.1. Notas Fiscais
CREATE TABLE IF NOT EXISTS estoque_nfs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_nf text NOT NULL,
  xml_conteudo text,
  data_emissao date NOT NULL,
  fornecedor text NOT NULL,
  valor_total decimal(10,2) NOT NULL,
  unidade_id uuid REFERENCES unidades(id) NOT NULL,
  processada boolean DEFAULT false,
  processada_em timestamptz,
  processada_por uuid REFERENCES usuarios(id),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE estoque_nfs ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_estoque_nfs_numero ON estoque_nfs(numero_nf);
CREATE INDEX idx_estoque_nfs_unidade ON estoque_nfs(unidade_id);

-- 4.2. Peças do Estoque (cada registro = 1 peça física)
CREATE TABLE IF NOT EXISTS estoque_pecas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  id_unico text UNIQUE NOT NULL,
  pn text NOT NULL,
  descricao text NOT NULL,
  nf_id uuid REFERENCES estoque_nfs(id) NOT NULL,
  unidade_id uuid REFERENCES unidades(id) NOT NULL,
  localizacao text,
  valor_com_impostos decimal(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'disponivel' CHECK (status IN (
    'disponivel', 'reservada', 'vinculada_tecnico', 'em_rota', 'em_uso', 
    'usada', 'devolucao_pendente', 'devolvida_nova', 'devolvida_defeito', 
    'usada_upc', 'arquivada'
  )),
  os_id uuid REFERENCES os(id),
  tecnico_id uuid REFERENCES usuarios(id),
  data_entrada timestamptz DEFAULT now(),
  data_ultima_movimentacao timestamptz DEFAULT now(),
  qrcode_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE estoque_pecas ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_estoque_pecas_pn ON estoque_pecas(pn);
CREATE INDEX idx_estoque_pecas_status ON estoque_pecas(status);
CREATE INDEX idx_estoque_pecas_unidade ON estoque_pecas(unidade_id);
CREATE INDEX idx_estoque_pecas_id_unico ON estoque_pecas(id_unico);

-- 4.3. Transferências de Estoque
CREATE TABLE IF NOT EXISTS estoque_transferencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  peca_id uuid REFERENCES estoque_pecas(id) NOT NULL,
  os_id uuid REFERENCES os(id),
  tipo text NOT NULL CHECK (tipo IN ('estoque_para_tecnico', 'tecnico_para_estoque', 'entre_unidades', 'devolucao')),
  origem_unidade_id uuid REFERENCES unidades(id),
  destino_unidade_id uuid REFERENCES unidades(id),
  origem_tecnico_id uuid REFERENCES usuarios(id),
  destino_tecnico_id uuid REFERENCES usuarios(id),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'em_transito', 'concluida', 'cancelada')),
  qrcode_bipado boolean DEFAULT false,
  solicitada_por uuid REFERENCES usuarios(id) NOT NULL,
  aprovada_por uuid REFERENCES usuarios(id),
  concluida_por uuid REFERENCES usuarios(id),
  concluida_em timestamptz,
  observacao text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE estoque_transferencias ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_estoque_transferencias_peca ON estoque_transferencias(peca_id);
CREATE INDEX idx_estoque_transferencias_status ON estoque_transferencias(status);

-- 4.4. Devoluções
CREATE TABLE IF NOT EXISTS estoque_devolucoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  peca_id uuid REFERENCES estoque_pecas(id) NOT NULL,
  tipo_devolucao text NOT NULL CHECK (tipo_devolucao IN ('nova', 'nova_com_defeito', 'usada')),
  solicitada_por uuid REFERENCES usuarios(id) NOT NULL,
  aprovada_por uuid REFERENCES usuarios(id),
  conferida boolean DEFAULT false,
  conferida_por uuid REFERENCES usuarios(id),
  conferida_em timestamptz,
  qrcode_bipado boolean DEFAULT false,
  nf_devolucao text,
  data_coleta timestamptz,
  justificativa_nao_devolucao text,
  dias_vinculada int DEFAULT 0,
  observacao text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE estoque_devolucoes ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_estoque_devolucoes_peca ON estoque_devolucoes(peca_id);
CREATE INDEX idx_estoque_devolucoes_tipo ON estoque_devolucoes(tipo_devolucao);

-- 4.5. Pedidos OFS
CREATE TABLE IF NOT EXISTS estoque_pedidos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid REFERENCES os(id) NOT NULL,
  pn text NOT NULL,
  descricao text NOT NULL,
  quantidade int NOT NULL DEFAULT 1,
  valor_estimado decimal(10,2),
  numero_pedido_samsung text,
  fornecedor text,
  previsao_chegada date,
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'pedido_feito', 'em_transito', 'recebido', 'cancelado')),
  solicitado_por uuid REFERENCES usuarios(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE estoque_pedidos ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_estoque_pedidos_os ON estoque_pedidos(os_id);
CREATE INDEX idx_estoque_pedidos_status ON estoque_pedidos(status);

-- 4.6. Histórico de Movimentação de Peças
CREATE TABLE IF NOT EXISTS estoque_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  peca_id uuid REFERENCES estoque_pecas(id) ON DELETE CASCADE NOT NULL,
  usuario_id uuid REFERENCES usuarios(id) NOT NULL,
  acao text NOT NULL,
  status_anterior text,
  status_novo text,
  origem text,
  destino text,
  observacao text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE estoque_historico ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_estoque_historico_peca ON estoque_historico(peca_id);

-- ============================================================================
-- 5. MÓDULO AGENDAMENTO
-- ============================================================================

-- 5.1. Agendamentos
CREATE TABLE IF NOT EXISTS agendamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid REFERENCES os(id) NOT NULL,
  tecnico_id uuid REFERENCES usuarios(id) NOT NULL,
  rota_id uuid REFERENCES rotas(id),
  data_agendamento date NOT NULL,
  horario_inicio time NOT NULL,
  horario_fim time NOT NULL,
  status text NOT NULL DEFAULT 'pendente_confirmacao' CHECK (status IN (
    'pendente_confirmacao', 'confirmado', 'em_andamento', 'concluido', 'cancelado'
  )),
  confirmado_com_cliente boolean DEFAULT false,
  observacao text,
  agendado_por uuid REFERENCES usuarios(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE agendamentos ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_agendamentos_data ON agendamentos(data_agendamento);
CREATE INDEX idx_agendamentos_tecnico ON agendamentos(tecnico_id);
CREATE INDEX idx_agendamentos_os ON agendamentos(os_id);

-- 5.2. Check-in / Check-out
CREATE TABLE IF NOT EXISTS agendamentos_checkin_checkout (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agendamento_id uuid REFERENCES agendamentos(id) ON DELETE CASCADE NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('checkin', 'checkout')),
  data_hora timestamptz NOT NULL DEFAULT now(),
  localizacao_lat decimal(10,8),
  localizacao_lng decimal(11,8),
  localizacao_endereco text,
  fotos text[] DEFAULT '{}',
  assinatura_cliente text,
  observacao text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE agendamentos_checkin_checkout ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_checkin_checkout_agendamento ON agendamentos_checkin_checkout(agendamento_id);

-- ============================================================================
-- 6. MÓDULO FINANCEIRO
-- ============================================================================

-- 6.1. Lançamentos Financeiros
CREATE TABLE IF NOT EXISTS financeiro_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  os_id uuid REFERENCES os(id),
  cotacao_id uuid REFERENCES cotacoes(id),
  numero_os_samsung text,
  numero_os_interna text,
  numero_cotacao text,
  forma_pagamento_id uuid REFERENCES formas_pagamento(id) NOT NULL,
  valor decimal(10,2) NOT NULL,
  sku_transacao text,
  data_pagamento date NOT NULL,
  unidade_id uuid REFERENCES unidades(id) NOT NULL,
  observacao text,
  lancado_por uuid REFERENCES usuarios(id) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  CONSTRAINT requer_vinculo_os CHECK (
    os_id IS NOT NULL OR 
    cotacao_id IS NOT NULL OR 
    numero_os_samsung IS NOT NULL OR 
    numero_os_interna IS NOT NULL OR 
    numero_cotacao IS NOT NULL
  )
);

ALTER TABLE financeiro_lancamentos ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_financeiro_lancamentos_os ON financeiro_lancamentos(os_id);
CREATE INDEX idx_financeiro_lancamentos_cotacao ON financeiro_lancamentos(cotacao_id);
CREATE INDEX idx_financeiro_lancamentos_sku ON financeiro_lancamentos(sku_transacao);
CREATE INDEX idx_financeiro_lancamentos_data ON financeiro_lancamentos(data_pagamento);

-- 6.2. Aportes
CREATE TABLE IF NOT EXISTS financeiro_aportes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  valor decimal(10,2) NOT NULL,
  data_aporte date NOT NULL,
  descricao text,
  unidade_id uuid REFERENCES unidades(id) NOT NULL,
  lancado_por uuid REFERENCES usuarios(id) NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE financeiro_aportes ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- 7. POLÍTICAS RLS (Row Level Security)
-- ============================================================================

-- Políticas para Unidades
CREATE POLICY "Usuários autenticados podem ver unidades"
  ON unidades FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Apenas gerentes e masters podem criar unidades"
  ON unidades FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('gerente', 'master')
    )
  );

CREATE POLICY "Apenas gerentes e masters podem atualizar unidades"
  ON unidades FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('gerente', 'master')
    )
  );

-- Políticas para Usuários
CREATE POLICY "Usuários podem ver próprio perfil e outros usuários"
  ON usuarios FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Apenas masters podem criar usuários"
  ON usuarios FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo = 'master'
    )
  );

CREATE POLICY "Usuários podem atualizar próprio perfil, masters podem atualizar todos"
  ON usuarios FOR UPDATE
  TO authenticated
  USING (
    id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo = 'master'
    )
  );

-- Políticas para Serviços
CREATE POLICY "Todos podem ver serviços"
  ON servicos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Gerentes e masters podem gerenciar serviços"
  ON servicos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('gerente', 'master')
    )
  );

-- Políticas para Rotas
CREATE POLICY "Todos podem ver rotas"
  ON rotas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Gerentes e masters podem gerenciar rotas"
  ON rotas FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('gerente', 'master')
    )
  );

-- Políticas para Formas de Pagamento
CREATE POLICY "Todos podem ver formas de pagamento"
  ON formas_pagamento FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Gerentes e masters podem gerenciar formas de pagamento"
  ON formas_pagamento FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('gerente', 'master')
    )
  );

-- Políticas para Configurações de Markup
CREATE POLICY "Todos podem ver configurações de markup"
  ON configuracoes_markup FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Gerentes e masters podem gerenciar markup"
  ON configuracoes_markup FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('gerente', 'master')
    )
  );

-- Políticas para Cotações
CREATE POLICY "Usuários podem ver cotações de sua unidade"
  ON cotacoes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND (usuarios.tipo = 'master' OR usuarios.unidade_id = cotacoes.unidade_id)
    )
  );

CREATE POLICY "Usuários autorizados podem criar cotações"
  ON cotacoes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('recepcao', 'gerente', 'master')
    )
  );

CREATE POLICY "Usuários autorizados podem atualizar cotações"
  ON cotacoes FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('recepcao', 'gerente', 'master')
      AND (usuarios.tipo = 'master' OR usuarios.unidade_id = cotacoes.unidade_id)
    )
  );

-- Políticas para Cotações Peças
CREATE POLICY "Usuários podem ver peças de cotações acessíveis"
  ON cotacoes_pecas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cotacoes c
      JOIN usuarios u ON u.id = auth.uid()
      WHERE c.id = cotacoes_pecas.cotacao_id
      AND (u.tipo = 'master' OR u.unidade_id = c.unidade_id)
    )
  );

CREATE POLICY "Usuários autorizados podem gerenciar peças de cotações"
  ON cotacoes_pecas FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cotacoes c
      JOIN usuarios u ON u.id = auth.uid()
      WHERE c.id = cotacoes_pecas.cotacao_id
      AND u.tipo IN ('recepcao', 'gerente', 'master')
      AND (u.tipo = 'master' OR u.unidade_id = c.unidade_id)
    )
  );

-- Políticas para Cotações Serviços
CREATE POLICY "Usuários podem ver serviços de cotações acessíveis"
  ON cotacoes_servicos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cotacoes c
      JOIN usuarios u ON u.id = auth.uid()
      WHERE c.id = cotacoes_servicos.cotacao_id
      AND (u.tipo = 'master' OR u.unidade_id = c.unidade_id)
    )
  );

CREATE POLICY "Usuários autorizados podem gerenciar serviços de cotações"
  ON cotacoes_servicos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cotacoes c
      JOIN usuarios u ON u.id = auth.uid()
      WHERE c.id = cotacoes_servicos.cotacao_id
      AND u.tipo IN ('recepcao', 'gerente', 'master')
      AND (u.tipo = 'master' OR u.unidade_id = c.unidade_id)
    )
  );

-- Políticas para Histórico de Cotações
CREATE POLICY "Usuários podem ver histórico de cotações acessíveis"
  ON cotacoes_historico FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM cotacoes c
      JOIN usuarios u ON u.id = auth.uid()
      WHERE c.id = cotacoes_historico.cotacao_id
      AND (u.tipo = 'master' OR u.unidade_id = c.unidade_id)
    )
  );

CREATE POLICY "Sistema pode inserir histórico de cotações"
  ON cotacoes_historico FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Políticas para OS
CREATE POLICY "Usuários podem ver OS de sua unidade ou técnico"
  ON os FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND (
        usuarios.tipo = 'master' OR
        usuarios.unidade_id = os.unidade_id OR
        usuarios.id = os.tecnico_id
      )
    )
  );

CREATE POLICY "Usuários autorizados podem criar OS"
  ON os FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('recepcao', 'tecnico', 'gerente', 'master')
    )
  );

CREATE POLICY "Usuários autorizados podem atualizar OS"
  ON os FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND (
        usuarios.tipo IN ('gerente', 'master') OR
        (usuarios.tipo = 'tecnico' AND usuarios.id = os.tecnico_id) OR
        (usuarios.tipo = 'recepcao' AND usuarios.unidade_id = os.unidade_id)
      )
    )
  );

-- Políticas para OS Peças (aplicar mesma lógica de acesso da OS)
CREATE POLICY "Usuários podem ver peças de OS acessíveis"
  ON os_pecas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM os o
      JOIN usuarios u ON u.id = auth.uid()
      WHERE o.id = os_pecas.os_id
      AND (u.tipo = 'master' OR u.unidade_id = o.unidade_id OR u.id = o.tecnico_id)
    )
  );

CREATE POLICY "Usuários autorizados podem gerenciar peças de OS"
  ON os_pecas FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM os o
      JOIN usuarios u ON u.id = auth.uid()
      WHERE o.id = os_pecas.os_id
      AND (
        u.tipo IN ('estoque', 'gerente', 'master') OR
        (u.tipo = 'tecnico' AND u.id = o.tecnico_id)
      )
    )
  );

-- Políticas para OS Checklist
CREATE POLICY "Usuários podem ver checklist de OS acessíveis"
  ON os_checklist FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM os o
      JOIN usuarios u ON u.id = auth.uid()
      WHERE o.id = os_checklist.os_id
      AND (u.tipo = 'master' OR u.unidade_id = o.unidade_id OR u.id = o.tecnico_id)
    )
  );

CREATE POLICY "Técnicos e gerentes podem gerenciar checklist"
  ON os_checklist FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM os o
      JOIN usuarios u ON u.id = auth.uid()
      WHERE o.id = os_checklist.os_id
      AND (u.tipo IN ('gerente', 'master') OR (u.tipo = 'tecnico' AND u.id = o.tecnico_id))
    )
  );

-- Políticas para OS Comentários
CREATE POLICY "Usuários podem ver comentários de OS acessíveis"
  ON os_comentarios FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM os o
      JOIN usuarios u ON u.id = auth.uid()
      WHERE o.id = os_comentarios.os_id
      AND (u.tipo = 'master' OR u.unidade_id = o.unidade_id OR u.id = o.tecnico_id)
    )
  );

CREATE POLICY "Usuários podem criar comentários em OS acessíveis"
  ON os_comentarios FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM os o
      JOIN usuarios u ON u.id = auth.uid()
      WHERE o.id = os_comentarios.os_id
      AND (u.tipo = 'master' OR u.unidade_id = o.unidade_id OR u.id = o.tecnico_id)
    )
  );

-- Políticas para OS Anexos
CREATE POLICY "Usuários podem ver anexos de OS acessíveis"
  ON os_anexos FOR SELECT
  TO authenticated
  USING (
    (os_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM os o
      JOIN usuarios u ON u.id = auth.uid()
      WHERE o.id = os_anexos.os_id
      AND (u.tipo = 'master' OR u.unidade_id = o.unidade_id OR u.id = o.tecnico_id)
    )) OR
    (cotacao_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM cotacoes c
      JOIN usuarios u ON u.id = auth.uid()
      WHERE c.id = os_anexos.cotacao_id
      AND (u.tipo = 'master' OR u.unidade_id = c.unidade_id)
    ))
  );

CREATE POLICY "Usuários podem criar anexos em OS/cotações acessíveis"
  ON os_anexos FOR INSERT
  TO authenticated
  WITH CHECK (
    (os_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM os o
      JOIN usuarios u ON u.id = auth.uid()
      WHERE o.id = os_anexos.os_id
      AND (u.tipo = 'master' OR u.unidade_id = o.unidade_id OR u.id = o.tecnico_id)
    )) OR
    (cotacao_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM cotacoes c
      JOIN usuarios u ON u.id = auth.uid()
      WHERE c.id = os_anexos.cotacao_id
      AND (u.tipo = 'master' OR u.unidade_id = c.unidade_id)
    ))
  );

-- Políticas para Estoque (continua devido ao limite de caracteres...)

-- Políticas básicas de estoque (usuários de estoque e masters têm acesso total)
CREATE POLICY "Usuários podem ver NFs de sua unidade"
  ON estoque_nfs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND (usuarios.tipo = 'master' OR usuarios.unidade_id = estoque_nfs.unidade_id)
    )
  );

CREATE POLICY "Estoque e gerentes podem gerenciar NFs"
  ON estoque_nfs FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('estoque', 'gerente', 'master')
    )
  );

CREATE POLICY "Usuários podem ver peças de estoque de sua unidade"
  ON estoque_pecas FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND (usuarios.tipo = 'master' OR usuarios.unidade_id = estoque_pecas.unidade_id OR usuarios.id = estoque_pecas.tecnico_id)
    )
  );

CREATE POLICY "Estoque pode gerenciar peças"
  ON estoque_pecas FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('estoque', 'gerente', 'master')
    )
  );

CREATE POLICY "Usuários podem ver transferências relevantes"
  ON estoque_transferencias FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND (
        usuarios.tipo = 'master' OR
        usuarios.id = estoque_transferencias.origem_tecnico_id OR
        usuarios.id = estoque_transferencias.destino_tecnico_id OR
        usuarios.tipo = 'estoque'
      )
    )
  );

CREATE POLICY "Estoque e técnicos podem gerenciar transferências"
  ON estoque_transferencias FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('estoque', 'tecnico', 'gerente', 'master')
    )
  );

CREATE POLICY "Usuários autorizados podem ver devoluções"
  ON estoque_devolucoes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('estoque', 'tecnico', 'gerente', 'master')
    )
  );

CREATE POLICY "Técnicos e estoque podem gerenciar devoluções"
  ON estoque_devolucoes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('estoque', 'tecnico', 'gerente', 'master')
    )
  );

CREATE POLICY "Usuários podem ver pedidos"
  ON estoque_pedidos FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Usuários autorizados podem gerenciar pedidos"
  ON estoque_pedidos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('estoque', 'tecnico', 'gerente', 'master')
    )
  );

CREATE POLICY "Usuários podem ver histórico de peças acessíveis"
  ON estoque_historico FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM estoque_pecas ep
      JOIN usuarios u ON u.id = auth.uid()
      WHERE ep.id = estoque_historico.peca_id
      AND (u.tipo = 'master' OR u.unidade_id = ep.unidade_id OR u.id = ep.tecnico_id)
    )
  );

CREATE POLICY "Sistema pode inserir histórico de estoque"
  ON estoque_historico FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Políticas para Agendamentos
CREATE POLICY "Usuários podem ver agendamentos relevantes"
  ON agendamentos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios u
      WHERE u.id = auth.uid()
      AND (
        u.tipo = 'master' OR
        u.id = agendamentos.tecnico_id OR
        u.tipo IN ('recepcao', 'gerente')
      )
    )
  );

CREATE POLICY "Recepção e gerentes podem gerenciar agendamentos"
  ON agendamentos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('recepcao', 'gerente', 'master')
    )
  );

CREATE POLICY "Usuários podem ver check-in/check-out de agendamentos acessíveis"
  ON agendamentos_checkin_checkout FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM agendamentos a
      JOIN usuarios u ON u.id = auth.uid()
      WHERE a.id = agendamentos_checkin_checkout.agendamento_id
      AND (u.tipo = 'master' OR u.id = a.tecnico_id OR u.tipo IN ('recepcao', 'gerente'))
    )
  );

CREATE POLICY "Técnicos podem registrar check-in/check-out"
  ON agendamentos_checkin_checkout FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM agendamentos a
      JOIN usuarios u ON u.id = auth.uid()
      WHERE a.id = agendamentos_checkin_checkout.agendamento_id
      AND (u.tipo IN ('tecnico', 'gerente', 'master') AND (u.id = a.tecnico_id OR u.tipo IN ('gerente', 'master')))
    )
  );

-- Políticas para Financeiro
CREATE POLICY "Usuários podem ver lançamentos de sua unidade"
  ON financeiro_lancamentos FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND (usuarios.tipo = 'master' OR usuarios.tipo = 'financeiro' OR usuarios.tipo = 'gerente' OR usuarios.unidade_id = financeiro_lancamentos.unidade_id)
    )
  );

CREATE POLICY "Financeiro e gerentes podem gerenciar lançamentos"
  ON financeiro_lancamentos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('financeiro', 'gerente', 'master')
    )
  );

CREATE POLICY "Usuários podem ver aportes de sua unidade"
  ON financeiro_aportes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND (usuarios.tipo = 'master' OR usuarios.tipo = 'financeiro' OR usuarios.tipo = 'gerente' OR usuarios.unidade_id = financeiro_aportes.unidade_id)
    )
  );

CREATE POLICY "Financeiro e gerentes podem gerenciar aportes"
  ON financeiro_aportes FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE usuarios.id = auth.uid()
      AND usuarios.tipo IN ('financeiro', 'gerente', 'master')
    )
  );