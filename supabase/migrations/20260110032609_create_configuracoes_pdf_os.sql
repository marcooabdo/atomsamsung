/*
  # Create OS PDF Configuration System

  1. New Tables
    - `configuracoes_pdf_os`
      - `id` (uuid, primary key)
      - `unidade_id` (uuid, nullable) - NULL = applies to all units, specific UUID = unit-specific
      - `termo_orcamento` (text) - Terms text for budget/quote
      - `termo_garantia` (text) - Terms text for warranty
      - `canais_atendimento` (text) - Support channels text
      - `observacoes_gerais` (text) - General notes/observations
      - `logo_url` (text, nullable) - Custom logo URL
      - `rodape_personalizado` (text, nullable) - Custom footer text
      - `created_at`, `updated_at` (timestamps)
  
  2. Security
    - Enable RLS on `configuracoes_pdf_os` table
    - Add policies for authenticated users based on unit access
*/

CREATE TABLE IF NOT EXISTS configuracoes_pdf_os (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  unidade_id uuid REFERENCES unidades(id) ON DELETE CASCADE,
  termo_orcamento text DEFAULT 'Para efeito deste termo é considerado "Cliente" o contratante descrito neste documento como cliente, e é considerado "Empresa" a Contratada, e tem como objeto o "Produto" identificado em detalhes.

1 – ORÇAMENTO

1.1 O orçamento apresentado contempla itens com validade de 10 dias, contados da data de elaboração. Após este período o orçamento perde automaticamente a validade.
1.2 O orçamento será informado ao Cliente através de telefone, e-mail, SMS ou outra meio não contemplado informado por este e que venha a ser utilizado pela Assistência.
1.3 O Cliente autoriza o envio ao orçamento nos contatos e Canais informados pelo mesmo.
1.4 Após a análise do produto, se for identificada a necessidade de reparo de mais peças do que as previstas no orçamento inicial, o Cliente será notificado para que aprove a inclusão de novos itens.
1.5 O Cliente concorda que poderá ser cobrado um custo de diagnóstico caso o orçamento não seja aprovado.

2 – APROVAÇÃO DO ORÇAMENTO

2.1 O Produto conta com uma garantia legal de 90 dias de serviço de reparo, conforme determinado pelo Código de Defesa do Consumidor, contada a partir da data de retirada, podendo esta ser prorrogada em casos específicos.
2.2 A garantia perderá sua validade se houver violação de peças ou utilização em rede elétrica incompatível.
2.3 No caso do produto apresentar, durante o período coberto pela garantia, algum defeito proveniente que não tenha(m) sido relacionado(s) ao serviço de reparo realizado, o custo do reparo será subsidiado.

3 – PRODUTO FORA DA GARANTIA

3.1 O produto fora da garantia será reparado mediante aprovação de orçamento pelo Cliente.
3.2 A aprovação do orçamento confirma o aceite dos termos de serviço apresentados neste documento.

4 – DA RETIRADA DOS PRODUTOS

4.1 O Cliente é responsável pela retirada do produto no prazo estipulado pela Assistência.
4.2 O Cliente não informado pela Empresa sobre a finalização do reparo do produto por meio de telefone, e-mail, SMS ou outro meio de comunicação que a Assistência venha a utilizar.

5 – AUTORIZAÇÃO

5.1 O cliente autoriza a Samsung a processar e armazenar dados pessoais para diagnóstico de defeitos e componentes.
5.2 O cliente concorda e autoriza a Samsung a enviar ao reparo do seu produto peças de componentes de reposição novos ou recondicionados.

6 – DO PRODUTO ACESSÓRIOS

6.1 Não nos responsabilizamos por chips, cartões de memória, baterias, entre outros acessórios não listados no recibo.
6.2 Se o produto for protegido com senha ou padrão, será necessário desabilitar e retirá-o antes do envio ou entrega.

7 – DA RESPONSABILIDADE SOBRE DADOS

7.1 Cabe ao Cliente realizar cópia de segurança de todos os dados antes de enviar o produto para reparo.
7.2 O Cliente concorda que todos os dados do aparelho, serão apagados pela Empresa para a realização do reparo.',
  
  termo_garantia text DEFAULT 'TERMOS E CONDIÇÕES DE GARANTIA

1. Este produto possui garantia do fabricante conforme especificado na nota fiscal e/ou manual do produto.
2. A garantia cobre defeitos de fabricação e funcionamento em condições normais de uso.
3. A garantia NÃO cobre danos causados por:
   - Mau uso, quedas, impactos ou acidentes
   - Uso em desacordo com o manual
   - Modificações não autorizadas
   - Exposição a condições ambientais inadequadas
   - Violação do produto por terceiros não autorizados

4. Para acionamento da garantia é necessário apresentar:
   - Nota fiscal original ou documento equivalente
   - Produto dentro do prazo de garantia
   - Defeito coberto pelos termos da garantia',

  canais_atendimento text DEFAULT 'Canais de Atendimento SAMSUNG
Online:
• Para suporte, realizar agendamento ou acompanhar seu reparo acesse: https://www.samsung.com/br/support/
• Acesse também nossa app Samsung Members para suporte, diagnóstico e agendamentos
• Visite nossa loja online para adquirir produtos e acessórios Samsung: https://shop.samsung.com.br/
• Vídeos no YouTube com dicas de configuração, atualização de softwares: www.youtube.com/samsungbrasil

Tipos de atendimento:
• In-Home - Atendimento em domicílio

Central de Atendimento:
• 4004-0000 (Capitais) / 0800 555 000 (Demais Cidades) / 0061-0000 (Clientes Corporativos)',

  observacoes_gerais text DEFAULT 'IMPORTANTE: É de responsabilidade do cliente realizar cópia de segurança (backup) de agenda, fotos, documentos, músicas, aplicativos ou quaisquer outros tipos de dados, informações gravadas no aparelho.

Não nos responsabilizamos pela perda total ou parcial de dados.
Autorizo a Samsung a utilizar meus dados pessoais no evento Rede Daten in Service para a Planilha específica de realização de reparo do produto.',

  logo_url text,
  rodape_personalizado text,
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  
  UNIQUE(unidade_id)
);

ALTER TABLE configuracoes_pdf_os ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view PDF configs for their unit or global"
  ON configuracoes_pdf_os FOR SELECT
  TO authenticated
  USING (
    unidade_id IS NULL 
    OR unidade_id IN (
      SELECT u.unidade_id FROM usuarios u WHERE u.id = auth.uid()
      UNION
      SELECT id FROM unidades WHERE (SELECT tipo FROM usuarios WHERE id = auth.uid()) IN ('master', 'diretoria')
    )
  );

CREATE POLICY "Admin users can manage PDF configs"
  ON configuracoes_pdf_os FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND tipo IN ('master', 'diretoria', 'gerente', 'administrador')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios 
      WHERE id = auth.uid() 
      AND tipo IN ('master', 'diretoria', 'gerente', 'administrador')
    )
  );

COMMENT ON TABLE configuracoes_pdf_os IS 'Configuration table for OS PDF generation - stores customizable terms and texts';
COMMENT ON COLUMN configuracoes_pdf_os.unidade_id IS 'NULL means applies to all units, specific UUID means unit-specific configuration';
