/*
  # Allow NULL os_id in pagamentos table

  1. Problem
    - The `pagamentos` table has `os_id uuid NOT NULL`
    - This prevents saving payments for cotações that haven't been converted to OS yet
    - Error: "null value in column 'os_id' of relation 'pagamentos' violates not-null constraint"

  2. Changes
    - Change `os_id` from NOT NULL to nullable
    - Add constraint to ensure either `os_id` OR `cotacao_id` must be present
    - This allows payments to be linked to:
      a) A cotação before it becomes an OS
      b) An OS after the cotação is converted

  3. Logic
    - When creating a cotação with payment: os_id = NULL, cotacao_id = [id]
    - When cotação converts to OS: payments can be linked to the OS
    - Payments must always have either os_id or cotacao_id (or both)

  4. Security
    - No RLS changes needed
    - Foreign keys remain intact with appropriate CASCADE/SET NULL behavior
*/

-- Make os_id nullable
ALTER TABLE pagamentos 
ALTER COLUMN os_id DROP NOT NULL;

-- Add constraint to ensure at least one ID is present
ALTER TABLE pagamentos
ADD CONSTRAINT pagamentos_must_have_os_or_cotacao 
CHECK (os_id IS NOT NULL OR cotacao_id IS NOT NULL);

-- Add helpful comment
COMMENT ON COLUMN pagamentos.os_id IS 'OS ID - nullable to allow payments on cotações before they become OS. At least one of os_id or cotacao_id must be present.';
