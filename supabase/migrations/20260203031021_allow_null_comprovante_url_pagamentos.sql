/*
  # Allow null comprovante_url in pagamentos

  1. Changes
    - Makes comprovante_url column nullable in pagamentos table
    - Not all payments require a receipt/proof image

  2. Reason
    - Cash payments and some card payments may not have a digital receipt
    - Prevents errors when creating payments without uploading a proof file
*/

ALTER TABLE pagamentos ALTER COLUMN comprovante_url DROP NOT NULL;
