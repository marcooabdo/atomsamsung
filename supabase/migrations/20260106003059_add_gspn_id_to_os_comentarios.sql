/*
  # Add gspn_id to os_comentarios
  
  1. Changes
    - Add `gspn_id` column to `os_comentarios` table
    - Type: text (string)
    - Nullable: yes
    - No foreign key constraints
*/

ALTER TABLE os_comentarios 
ADD COLUMN IF NOT EXISTS gspn_id text;
