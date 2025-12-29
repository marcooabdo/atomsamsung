/*
  # Fix Pagamentos Preservation on OS Deletion

  1. Problem
    - When an OS is deleted (moved back to cotações), all payments are CASCADE deleted
    - This causes loss of payment data when OS is removed from Kanban
    - Payment attachments (comprovantes) are also lost
    - Users expect payments to remain linked to the cotação

  2. Root Cause
    - Foreign key `pagamentos_os_id_fkey` has ON DELETE CASCADE
    - This was appropriate when os_id was NOT NULL
    - After making os_id nullable, CASCADE is wrong - should be SET NULL

  3. Solution
    - Drop existing foreign key constraint
    - Recreate with ON DELETE SET NULL
    - When OS is deleted, payments keep cotacao_id and lose os_id
    - This preserves payment history and allows viewing in cotação

  4. Impact
    - Payments remain accessible after OS deletion
    - Payment attachments are preserved
    - Payment data can be viewed in cotação modal
    - When cotação is re-approved, payments can be re-linked to new OS
*/

-- Drop the existing foreign key constraint
ALTER TABLE pagamentos
DROP CONSTRAINT IF EXISTS pagamentos_os_id_fkey;

-- Recreate with SET NULL instead of CASCADE
ALTER TABLE pagamentos
ADD CONSTRAINT pagamentos_os_id_fkey
FOREIGN KEY (os_id)
REFERENCES os(id)
ON DELETE SET NULL;

-- Add comment explaining the behavior
COMMENT ON CONSTRAINT pagamentos_os_id_fkey ON pagamentos IS 
'Foreign key to OS. ON DELETE SET NULL preserves payment when OS is deleted, keeping it linked to cotacao_id only.';