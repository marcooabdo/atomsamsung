/*
  # Trava de Segurança Financeira - Campos de Alerta de Preço via NF

  ## Descrição
  Adiciona campos para rastrear divergências de custo entre o orçamento da OS
  e o custo real registrado na entrada de Nota Fiscal.

  ## Alterações

  ### Tabela: os
  - `orcamento_pendente_reenvio` (boolean, default false): Sinaliza que o custo de
    uma ou mais peças foi atualizado via NF e o orçamento precisa ser reenviado ao cliente.

  ### Tabela: os_pecas
  - `valor_anterior_nf` (numeric 10,2): Armazena o valor GSPN anterior à atualização
    via NF, para exibir comparação "De X por Y" na interface.
  - `alerta_preco_nf` (boolean, default false): Flag que indica que o preço desta peça
    foi divergente entre o orçamento e a NF de entrada.

  ## Fluxo
  1. Na entrada de NF, o sistema compara valor_gspn atual com valorComImpostos da NF.
  2. Se houver diferença, salva valor_anterior_nf e ativa alerta_preco_nf na os_pecas.
  3. Também ativa orcamento_pendente_reenvio na OS pai.
  4. O banner de aviso aparece na aba de Pagamento da OS.
  5. Ao marcar orçamento como enviado, todos os alertas são limpos.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'orcamento_pendente_reenvio'
  ) THEN
    ALTER TABLE os ADD COLUMN orcamento_pendente_reenvio boolean DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os_pecas' AND column_name = 'valor_anterior_nf'
  ) THEN
    ALTER TABLE os_pecas ADD COLUMN valor_anterior_nf numeric(10,2);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os_pecas' AND column_name = 'alerta_preco_nf'
  ) THEN
    ALTER TABLE os_pecas ADD COLUMN alerta_preco_nf boolean DEFAULT false;
  END IF;
END $$;
