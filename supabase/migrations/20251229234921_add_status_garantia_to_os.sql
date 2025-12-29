/*
  # Add status_garantia to OS table

  1. Changes
    - Add `status_garantia` (text) - Warranty status from Samsung (I = In Warranty, O = Out of Warranty)
*/

ALTER TABLE os ADD COLUMN IF NOT EXISTS status_garantia text;