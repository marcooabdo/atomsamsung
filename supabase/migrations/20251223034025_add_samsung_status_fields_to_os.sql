/*
  # Add Samsung status fields to OS table

  1. Changes
    - Add status_samsung_desc column (StatusDesc from Samsung API)
    - Add status_samsung_reason column (StReasonDesc from Samsung API)
  
  2. Purpose
    - Store Samsung's status description and reason from API
    - Display in OS details modal and optionally on Kanban cards
*/

ALTER TABLE os 
ADD COLUMN IF NOT EXISTS status_samsung_desc text,
ADD COLUMN IF NOT EXISTS status_samsung_reason text;
