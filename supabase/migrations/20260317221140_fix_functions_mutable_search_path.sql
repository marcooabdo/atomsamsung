/*
  # Fix mutable search_path on all public functions

  This migration sets `search_path = public` on all functions in the public
  schema that don't already have it set. A mutable search_path is a security
  risk because it allows potential schema injection attacks where an attacker
  could create objects in a schema that appears earlier in the search path.

  1. Changes:
    - Sets `SET search_path = public` on ~127 functions
    - Only affects functions in the `public` schema
    - Functions that already have search_path configured are skipped

  2. Functions affected include:
    - All trigger functions (log_*, sync_*, update_*, trg_*)
    - All RPC functions (get_*, calcular_*, criar_*, etc.)
    - All utility functions (clean_*, generate_*, format_*, etc.)

  3. Security impact:
    - Prevents schema injection attacks
    - Ensures functions always resolve objects from the public schema
    - Follows PostgreSQL security best practices
*/

DO $$
DECLARE
  fn RECORD;
  alter_sql TEXT;
BEGIN
  FOR fn IN
    SELECT
      p.oid,
      p.proname as fn_name,
      pg_get_function_identity_arguments(p.oid) as fn_args
    FROM pg_proc p
    JOIN pg_namespace n ON p.pronamespace = n.oid
    WHERE n.nspname = 'public'
      AND (p.proconfig IS NULL OR NOT ('{search_path=public}' && p.proconfig))
  LOOP
    alter_sql := format(
      'ALTER FUNCTION public.%I(%s) SET search_path = public',
      fn.fn_name,
      fn.fn_args
    );
    EXECUTE alter_sql;
  END LOOP;
END $$;
