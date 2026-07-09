/*
# Add segunda OS tracking fields

1. Modified Tables
   - `os`
     - `tem_segunda_os` (boolean, default false) - Indicates if there was a second OS for the same client
     - `numero_segunda_os` (text, nullable) - The number of the second OS

2. Important Notes
   - These fields are for internal control/tracking purposes
   - Used to link related service orders for the same customer
*/

ALTER TABLE public.os ADD COLUMN IF NOT EXISTS tem_segunda_os boolean DEFAULT false;
ALTER TABLE public.os ADD COLUMN IF NOT EXISTS numero_segunda_os text;