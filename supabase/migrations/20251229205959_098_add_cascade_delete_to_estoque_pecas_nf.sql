/*
  # Adicionar CASCADE DELETE para estoque_pecas.nf_id

  1. Alteração
    - Remove a constraint antiga de nf_id em estoque_pecas
    - Adiciona nova constraint com ON DELETE CASCADE
    - Quando uma NF for excluída, todas as peças vinculadas serão automaticamente excluídas
  
  2. Benefício
    - Simplifica a exclusão de NFs
    - Mantém integridade referencial
    - Evita peças órfãs no sistema
*/

-- Remove a constraint antiga
ALTER TABLE estoque_pecas
DROP CONSTRAINT IF EXISTS estoque_pecas_nf_id_fkey;

-- Adiciona a nova constraint com CASCADE DELETE
ALTER TABLE estoque_pecas
ADD CONSTRAINT estoque_pecas_nf_id_fkey 
FOREIGN KEY (nf_id) 
REFERENCES estoque_nfs(id) 
ON DELETE CASCADE;

COMMENT ON CONSTRAINT estoque_pecas_nf_id_fkey ON estoque_pecas IS 
'Quando uma NF é excluída, todas as peças vinculadas são automaticamente excluídas (CASCADE)';