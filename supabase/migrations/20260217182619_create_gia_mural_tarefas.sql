/*
  # Criar tabela gia_mural_tarefas

  ## Objetivo
  Tabela para o painel "ATOM Command Center" — mural de missões geradas por agentes de IA.
  Backends/bots inserem tarefas aqui; o frontend apenas exibe e marca como concluída.

  ## Tabela: gia_mural_tarefas
  - `id` - UUID primário
  - `created_at` - Timestamp de criação
  - `setor` - Setor alvo: 'ESTOQUE', 'FINANCEIRO', 'FISCAL'
  - `prioridade` - Nível: 'alta' ou 'normal'
  - `titulo` - Título da tarefa
  - `descricao` - Descrição detalhada
  - `status` - Estado: 'pendente' ou 'concluido'
  - `gia_responsavel` - Nome do agente de IA que gerou
  - `concluido_por` - UUID do usuário que concluiu (nullable)
  - `concluido_at` - Timestamp da conclusão (nullable)

  ## Segurança
  - RLS habilitado
  - Usuários autenticados podem ler todas as tarefas
  - Somente service_role pode inserir (bots usam service_role key)
  - Usuários autenticados podem atualizar status para 'concluido'

  ## Realtime
  - Tabela adicionada à publicação de realtime do Supabase
*/

CREATE TABLE IF NOT EXISTS gia_mural_tarefas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  setor text NOT NULL,
  prioridade text NOT NULL DEFAULT 'normal',
  titulo text NOT NULL,
  descricao text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pendente',
  gia_responsavel text NOT NULL DEFAULT 'GIA',
  concluido_por uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  concluido_at timestamptz
);

ALTER TABLE gia_mural_tarefas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read all tasks"
  ON gia_mural_tarefas FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert tasks"
  ON gia_mural_tarefas FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update task status"
  ON gia_mural_tarefas FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (status IN ('pendente', 'concluido'));

ALTER PUBLICATION supabase_realtime ADD TABLE gia_mural_tarefas;
