/*
  # Sistema de Numeração OS Interna (G1000+)

  1. Nova Sequência
    - `os_interna_seq`: Inicia em 1000, usado para gerar G1000, G1001, G1002...

  2. Trigger Automático
    - Gera `numero_os_interna` (formato G1000+) APENAS quando `numero_os_samsung` for NULL
    - OSs criadas manualmente (botões CRIAR OW / CRIAR LP) recebem número interno
    - OSs vindas da API Samsung (já têm numero_os_samsung) NÃO recebem número interno

  3. Regras
    - Numeração sequencial crescente: G1000, G1001, G1002...
    - Pode misturar tipos: G1001 pode ser OW, G1002 pode ser LP, etc.
    - Número interno é gerado apenas uma vez, no INSERT
*/

-- Cria sequência começando em 1000 (se não existe)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'os_interna_seq') THEN
    CREATE SEQUENCE os_interna_seq START 1000;
  END IF;
END $$;

-- Função que gera numero_os_interna apenas quando numero_os_samsung for NULL
CREATE OR REPLACE FUNCTION gerar_numero_os_interna()
RETURNS TRIGGER AS $$
BEGIN
  -- Só gera numero_os_interna se:
  -- 1. Ainda não tiver numero_os_interna
  -- 2. E não tiver numero_os_samsung (ou seja, foi criada manualmente)
  IF NEW.numero_os_interna IS NULL AND NEW.numero_os_samsung IS NULL THEN
    NEW.numero_os_interna := 'G' || nextval('os_interna_seq')::text;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remove trigger antigo se existir
DROP TRIGGER IF EXISTS trigger_gerar_numero_os_interna ON os;

-- Cria trigger que roda ANTES do INSERT
CREATE TRIGGER trigger_gerar_numero_os_interna
  BEFORE INSERT ON os
  FOR EACH ROW
  EXECUTE FUNCTION gerar_numero_os_interna();