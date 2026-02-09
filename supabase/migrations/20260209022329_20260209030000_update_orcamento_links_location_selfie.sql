/*
  # Adicionar campos de localização e selfie em orcamento_links

  1. Alterações
    - Adiciona `latitude` (double precision) - Latitude GPS do cliente
    - Adiciona `longitude` (double precision) - Longitude GPS do cliente
    - Adiciona `endereco_completo` (text) - Endereço completo do cliente
    - Adiciona `selfie_url` (text) - URL da selfie do cliente

  2. Notas
    - Campos capturados quando cliente aprova/rejeita/negocia orçamento
    - Dados salvos nos anexos da OS automaticamente
*/

-- Add location and selfie fields if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orcamento_links' AND column_name = 'latitude') THEN
    ALTER TABLE orcamento_links ADD COLUMN latitude double precision;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orcamento_links' AND column_name = 'longitude') THEN
    ALTER TABLE orcamento_links ADD COLUMN longitude double precision;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orcamento_links' AND column_name = 'endereco_completo') THEN
    ALTER TABLE orcamento_links ADD COLUMN endereco_completo text;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'orcamento_links' AND column_name = 'selfie_url') THEN
    ALTER TABLE orcamento_links ADD COLUMN selfie_url text;
  END IF;
END $$;