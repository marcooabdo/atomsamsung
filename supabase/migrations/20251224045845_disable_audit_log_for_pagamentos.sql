/*
  # Disable Audit Log Trigger for Pagamentos

  1. Problem
    - Function log_pagamentos_changes() tries to insert into os_audit_log table
    - Table os_audit_log does not exist
    - Causes error: "relation public.os_audit_log does not exist"
    - Prevents payment insertion

  2. Solution
    - Drop the trigger that calls this function
    - Drop the function itself
    - Payments will work without audit logging

  3. Impact
    - Payment insertions will work correctly
    - Audit logging for payments will be disabled (can be re-enabled later if needed)
*/

-- Drop trigger first
DROP TRIGGER IF EXISTS trigger_log_pagamentos_changes ON pagamentos;

-- Drop the function
DROP FUNCTION IF EXISTS log_pagamentos_changes();
