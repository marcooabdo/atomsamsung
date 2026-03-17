/*
  # Optimize RLS policies - wrap auth.uid() with (select auth.uid())

  This migration optimizes all RLS policies in the public schema that use
  `auth.uid()` directly by wrapping them with `(select auth.uid())`.

  The `(select auth.uid())` pattern is a Supabase-recommended optimization that
  ensures auth.uid() is evaluated once per query instead of once per row,
  significantly improving performance on large tables.

  1. Changes:
    - All RLS policies using `auth.uid()` are updated to use `(select auth.uid())`
    - All RLS policies using `auth.jwt()` are updated to use `(select auth.jwt())`
    - All RLS policies using `auth.role()` are updated to use `(select auth.role())`
    - Only policies in the `public` schema are affected
    - Policies already using the optimized form are skipped

  2. Tables affected: ~50+ tables across the entire public schema

  3. Important notes:
    - This is a performance optimization only, no functional changes
    - The optimization reduces the number of auth function calls from per-row to per-query
    - This can significantly improve query performance on tables with many rows
*/

DO $$
DECLARE
  pol RECORD;
  new_using TEXT;
  new_check TEXT;
  drop_sql TEXT;
  create_sql TEXT;
  roles_str TEXT;
  using_part TEXT;
  check_part TEXT;
BEGIN
  FOR pol IN
    SELECT
      p.policyname,
      p.tablename,
      p.cmd,
      p.permissive,
      p.roles::text[] as roles,
      p.qual::text as using_clause,
      p.with_check::text as with_check_clause
    FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND (
        (p.qual::text LIKE '%auth.uid()%' AND p.qual::text NOT LIKE '%(select auth.uid())%')
        OR (p.with_check::text LIKE '%auth.uid()%' AND p.with_check::text NOT LIKE '%(select auth.uid())%')
        OR (p.qual::text LIKE '%auth.jwt()%' AND p.qual::text NOT LIKE '%(select auth.jwt())%')
        OR (p.with_check::text LIKE '%auth.jwt()%' AND p.with_check::text NOT LIKE '%(select auth.jwt())%')
        OR (p.qual::text LIKE '%auth.role()%' AND p.qual::text NOT LIKE '%(select auth.role())%')
        OR (p.with_check::text LIKE '%auth.role()%' AND p.with_check::text NOT LIKE '%(select auth.role())%')
      )
  LOOP
    new_using := pol.using_clause;
    new_check := pol.with_check_clause;

    IF new_using IS NOT NULL THEN
      new_using := replace(new_using, 'auth.uid()', '(select auth.uid())');
      new_using := replace(new_using, 'auth.jwt()', '(select auth.jwt())');
      new_using := replace(new_using, 'auth.role()', '(select auth.role())');
    END IF;

    IF new_check IS NOT NULL THEN
      new_check := replace(new_check, 'auth.uid()', '(select auth.uid())');
      new_check := replace(new_check, 'auth.jwt()', '(select auth.jwt())');
      new_check := replace(new_check, 'auth.role()', '(select auth.role())');
    END IF;

    drop_sql := format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    EXECUTE drop_sql;

    SELECT string_agg(quote_ident(r), ', ') INTO roles_str FROM unnest(pol.roles) AS r;

    using_part := '';
    check_part := '';

    IF new_using IS NOT NULL AND new_using != '' THEN
      using_part := ' USING (' || new_using || ')';
    END IF;

    IF new_check IS NOT NULL AND new_check != '' THEN
      check_part := ' WITH CHECK (' || new_check || ')';
    END IF;

    create_sql := format(
      'CREATE POLICY %I ON %I AS %s FOR %s TO %s%s%s',
      pol.policyname,
      pol.tablename,
      pol.permissive,
      pol.cmd,
      roles_str,
      using_part,
      check_part
    );

    EXECUTE create_sql;
  END LOOP;
END $$;
