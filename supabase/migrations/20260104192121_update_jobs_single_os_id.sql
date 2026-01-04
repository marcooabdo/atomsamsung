/*
  # Update Jobs Table - Single OS ID

  1. Changes
    - Drop os_ids column (array)
    - Add os_id column (single UUID)
    - Add foreign key reference to os table
  
  2. Notes
    - This assumes the jobs table is new and has no critical data yet
    - If there is data, the array will be lost when converting to single ID
*/

-- Drop the array column
ALTER TABLE jobs DROP COLUMN IF EXISTS os_ids;

-- Add single os_id column
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS os_id UUID REFERENCES os(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_jobs_os_id ON jobs(os_id);
