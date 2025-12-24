/*
  # Remove Incorrect SKU Validation Trigger from Pagamentos Table

  1. Problem
    - Trigger `trg_validar_sku_unico` was incorrectly applied to `pagamentos` table
    - This trigger was designed for `estoque_pecas` to validate unique physical part IDs
    - It tries to access field `id_unico` which doesn't exist in `pagamentos` table
    - Causes error: "record 'new' has no field 'id_unico'" when inserting payments

  2. Root Cause
    - Migration 20251201040038_054_create_payment_system.sql incorrectly created this trigger on pagamentos
    - The trigger function `validar_sku_unico()` is specific to estoque_pecas validation
    - Pagamentos table has field `sku_maquininha` (card machine SKU), not `id_unico`

  3. Solution
    - Drop the incorrect trigger from pagamentos table
    - Keep the function as it's still used correctly by estoque_pecas table
    - Payments will now insert/update without errors

  4. Impact
    - Payment insertion will work correctly
    - No validation loss (pagamentos never needed this trigger)
    - estoque_pecas still has correct validation
*/

-- Remove the incorrectly placed trigger from pagamentos table
DROP TRIGGER IF EXISTS trg_validar_sku_unico ON pagamentos;

-- Note: The function validar_sku_unico() is kept as it's correctly used by estoque_pecas table
-- Note: If needed in the future, sku_maquininha validation should be a separate function
