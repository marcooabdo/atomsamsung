/*
  # Add foto_url column to usuarios table

  ## Changes
  1. Add foto_url column to store profile photo URLs
  
  ## Details
  - Column type: text (nullable)
  - Used for storing public URLs from profile-photos storage bucket
*/

ALTER TABLE usuarios 
ADD COLUMN IF NOT EXISTS foto_url text;
