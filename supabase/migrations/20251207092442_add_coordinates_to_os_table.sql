/*
  # Adicionar coordenadas à tabela OS

  1. Alterações
    - Adicionar coluna `lat` (latitude) à tabela `os`
    - Adicionar coluna `lng` (longitude) à tabela `os`
    - Adicionar índice para busca por coordenadas
    
  2. Notas
    - Coordenadas são necessárias para otimização de rotas
    - Serão preenchidas via geocodificação do endereço
*/

-- Adicionar colunas de coordenadas se não existirem
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'lat'
  ) THEN
    ALTER TABLE os ADD COLUMN lat numeric(10, 8);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os' AND column_name = 'lng'
  ) THEN
    ALTER TABLE os ADD COLUMN lng numeric(11, 8);
  END IF;
END $$;

-- Criar índice para buscas por coordenadas
CREATE INDEX IF NOT EXISTS idx_os_coordinates ON os(lat, lng) WHERE lat IS NOT NULL AND lng IS NOT NULL;

-- Criar índice para OSs IH sem coordenadas (para facilitar geocodificação em lote)
CREATE INDEX IF NOT EXISTS idx_os_need_geocoding ON os(tipo_atendimento, cliente_cep) 
WHERE tipo_atendimento = 'IH' AND (lat IS NULL OR lng IS NULL) AND cliente_cep IS NOT NULL;
