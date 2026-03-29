/*
  # Adiciona coluna type_unidade na tabela os_pecas

  ## Objetivo
  Adicionar uma coluna para armazenar a unidade de medida da peça,
  necessária para emissão de NF-e nos campos uCom (unidade comercial)
  e uTrib (unidade tributável).

  ## Nova Coluna
  - `type_unidade` (text) - Unidade de medida da peça
    - Valores comuns: UN (unidade), PC (peça), KG (quilograma), MT (metro),
      LT (litro), CX (caixa), PT (pacote), PR (par), JG (jogo)
    - Default: 'UN' (mais comum para peças de assistência técnica)

  ## Impacto
  - Tabela: os_pecas
  - Retrocompatível: sim (usa DEFAULT 'UN' para registros existentes)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os_pecas' AND column_name = 'type_unidade'
  ) THEN
    ALTER TABLE os_pecas ADD COLUMN type_unidade text DEFAULT 'UN';
  END IF;
END $$;
