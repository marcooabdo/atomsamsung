/*
# Add origem column to os_comentarios

1. Modified Tables
- `os_comentarios`
  - Added `origem` (text, nullable) - identifies the source of the comment.
    Values: 'gspn' (Samsung GSPN sync), 'sistema' (internal operational logs like status moves, GI posts, etc.),
    NULL (legacy/system comments before this migration, treated as 'sistema').

2. Purpose
- Distinguishes GSPN-sourced comments (Samsung sync) from internal operational logs.
- The UI will show GSPN comments only when the user has `mostrar_comentarios_sistema = true`.
- Internal operational logs ('sistema' or NULL) will NO LONGER be shown in the comments tab at all.

3. Notes
- Existing rows keep NULL origem (treated as 'sistema' by the UI filter).
- No data is lost; this is purely additive.
*/

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'os_comentarios' AND column_name = 'origem'
  ) THEN
    ALTER TABLE os_comentarios ADD COLUMN origem text;
  END IF;
END $$;
