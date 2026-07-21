/*
# Fix duplicate inserir_requisicao_peca function overload

## Problem
There are two overloads of `inserir_requisicao_peca` with different types for
`p_quantidade_requisitada` (integer vs numeric), causing PostgreSQL to fail with
"Could not choose the best candidate function" when calling it.

## Changes
- Drop the old overload that uses `numeric` for `p_quantidade_requisitada`
- Keep the newer version with `integer` type and proper DEFAULT values
*/

-- Drop the old overload (numeric for p_quantidade_requisitada, no defaults)
DROP FUNCTION IF EXISTS public.inserir_requisicao_peca(uuid, uuid, text, text, numeric, numeric, text);
