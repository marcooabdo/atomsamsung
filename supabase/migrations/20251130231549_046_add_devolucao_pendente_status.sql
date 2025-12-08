/*
  # Adicionar status devolucao_pendente ao enum requisicao_status

  1. Descrição
    - Adiciona status intermediário para devoluções aguardando aprovação do estoque
    - Permite que técnicos solicitem devolução e estoque aprove/reprove
    - Melhora controle e auditoria do fluxo de devoluções

  2. Mudanças
    - Adiciona valor 'devolucao_pendente' ao enum requisicao_status
    - Status indica que devolução foi solicitada mas ainda não aprovada
    - Fluxo: em_uso → devolucao_pendente → devolvida (se aprovada)
    - Fluxo: em_uso → devolucao_pendente → em_uso (se reprovada)

  3. Impacto
    - Cria status intermediário entre uso e devolução efetiva
    - Permite estoque validar devoluções antes de efetivar
    - Evita devoluções incorretas ou fraudulentas
    - Melhora rastreabilidade e auditoria
*/

-- Adicionar devolucao_pendente ao enum requisicao_status
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum 
    WHERE enumlabel = 'devolucao_pendente' 
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'requisicao_status')
  ) THEN
    ALTER TYPE requisicao_status ADD VALUE 'devolucao_pendente';
  END IF;
END $$;
