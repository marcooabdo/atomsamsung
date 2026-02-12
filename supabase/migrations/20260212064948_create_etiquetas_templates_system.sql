/*
  # Sistema de Templates de Etiquetas

  1. Nova Tabela
    - `etiquetas_templates`
      - `id` (uuid, primary key)
      - `unidade_id` (uuid, FK para unidades)
      - `nome` (text) - nome do template
      - `descricao` (text) - descricao opcional
      - `largura_mm` (numeric) - largura em mm (ex: 40 para 4cm)
      - `altura_mm` (numeric) - altura em mm
      - `elementos` (jsonb) - array de elementos (textos, codigos de barra, imagens)
      - `is_padrao` (boolean) - se é o template padrão
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `criado_por` (uuid) - usuario que criou

  2. Estrutura do campo elementos (JSONB):
    Cada elemento contém:
    - id: string único
    - tipo: 'texto' | 'codigo_barras' | 'imagem' | 'linha' | 'retangulo'
    - x: posição X em mm
    - y: posição Y em mm
    - largura: largura em mm (para imagens/retângulos)
    - altura: altura em mm
    - conteudo: texto estático ou variável dinâmica (ex: {{peca_codigo}}, {{data}})
    - fonte_tamanho: tamanho da fonte em pt
    - fonte_negrito: boolean
    - rotacao: graus de rotação
    - cor: cor hex
    - imagem_url: URL da imagem (para tipo imagem)

  3. Variáveis dinâmicas suportadas:
    - {{peca_codigo}} - código SKU da peça
    - {{peca_descricao}} - descrição da peça
    - {{peca_id_sequencial}} - ID sequencial da peça
    - {{nf_numero}} - número da NF
    - {{nf_delivery}} - delivery da NF
    - {{data_entrada}} - data de entrada
    - {{data_atual}} - data atual
    - {{unidade_nome}} - nome da unidade
    - {{tecnico_nome}} - nome do técnico
    - {{os_numero}} - número da OS
    - {{os_samsung}} - número Samsung da OS
    - {{localizacao}} - localização (sala/estante/bin)

  4. Security
    - Enable RLS
    - Policies por unidade
*/

CREATE TABLE IF NOT EXISTS etiquetas_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid NOT NULL REFERENCES unidades(id) ON DELETE CASCADE,
  nome text NOT NULL,
  descricao text,
  largura_mm numeric NOT NULL DEFAULT 40,
  altura_mm numeric NOT NULL DEFAULT 40,
  elementos jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_padrao boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  criado_por uuid REFERENCES usuarios(id) ON DELETE SET NULL
);

ALTER TABLE etiquetas_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios podem ver templates da sua unidade"
  ON etiquetas_templates FOR SELECT
  TO authenticated
  USING (
    unidade_id IN (
      SELECT u.unidade_id FROM usuarios u WHERE u.id = auth.uid()
      UNION
      SELECT un.id FROM unidades un, usuarios us 
      WHERE us.id = auth.uid() AND (us.unidade_id IS NULL OR us.cargo = 'master')
    )
  );

CREATE POLICY "Usuarios podem criar templates na sua unidade"
  ON etiquetas_templates FOR INSERT
  TO authenticated
  WITH CHECK (
    unidade_id IN (
      SELECT u.unidade_id FROM usuarios u WHERE u.id = auth.uid()
      UNION
      SELECT un.id FROM unidades un, usuarios us 
      WHERE us.id = auth.uid() AND (us.unidade_id IS NULL OR us.cargo = 'master')
    )
  );

CREATE POLICY "Usuarios podem atualizar templates da sua unidade"
  ON etiquetas_templates FOR UPDATE
  TO authenticated
  USING (
    unidade_id IN (
      SELECT u.unidade_id FROM usuarios u WHERE u.id = auth.uid()
      UNION
      SELECT un.id FROM unidades un, usuarios us 
      WHERE us.id = auth.uid() AND (us.unidade_id IS NULL OR us.cargo = 'master')
    )
  );

CREATE POLICY "Usuarios podem deletar templates da sua unidade"
  ON etiquetas_templates FOR DELETE
  TO authenticated
  USING (
    unidade_id IN (
      SELECT u.unidade_id FROM usuarios u WHERE u.id = auth.uid()
      UNION
      SELECT un.id FROM unidades un, usuarios us 
      WHERE us.id = auth.uid() AND (us.unidade_id IS NULL OR us.cargo = 'master')
    )
  );

CREATE OR REPLACE FUNCTION set_single_default_template()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_padrao = true THEN
    UPDATE etiquetas_templates 
    SET is_padrao = false 
    WHERE unidade_id = NEW.unidade_id 
      AND id != NEW.id 
      AND is_padrao = true;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER ensure_single_default_template
  BEFORE INSERT OR UPDATE ON etiquetas_templates
  FOR EACH ROW
  EXECUTE FUNCTION set_single_default_template();

CREATE INDEX idx_etiquetas_templates_unidade ON etiquetas_templates(unidade_id);
CREATE INDEX idx_etiquetas_templates_padrao ON etiquetas_templates(unidade_id, is_padrao) WHERE is_padrao = true;