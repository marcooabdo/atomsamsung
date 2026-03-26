/*
  # Fix generate_orcamento_token function

  ## Problem
  The function uses `gen_random_bytes()` without the `extensions.` schema prefix,
  causing "function gen_random_bytes(integer) does not exist" errors.

  ## Fix
  Replace `gen_random_bytes(24)` with `extensions.gen_random_bytes(24)`.
*/

CREATE OR REPLACE FUNCTION generate_orcamento_token()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_token text;
  token_exists boolean;
BEGIN
  LOOP
    new_token := encode(extensions.gen_random_bytes(24), 'base64');
    new_token := replace(replace(replace(new_token, '/', ''), '+', ''), '=', '');
    new_token := substring(new_token, 1, 32);

    SELECT EXISTS(SELECT 1 FROM orcamento_links WHERE token = new_token) INTO token_exists;

    EXIT WHEN NOT token_exists;
  END LOOP;

  RETURN new_token;
END;
$$;
