/*
  # Adicionar campo Linha aos Servicos

  1. Alteracoes
    - Adiciona coluna `linha` na tabela `servicos` para vincular servicos a linhas de produtos
    - A linha determina para quais tipos de aparelho o servico esta disponivel

  2. Valores possiveis para linha:
    - DA - WSM / Kitchen
    - DA - REF / Ar Condicionado
    - DTV - TV
    - DTV - Monitor / SoundBar
    - MX - Celular
    - MX - Notebook
    - MX - Watch / Wearables
    - MX - Tablet
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'servicos' AND column_name = 'linha'
  ) THEN
    ALTER TABLE servicos ADD COLUMN linha text;
  END IF;
END $$;
