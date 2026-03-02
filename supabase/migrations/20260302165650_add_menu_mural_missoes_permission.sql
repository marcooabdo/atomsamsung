/*
  # Add menu_mural_missoes permission

  Adds the 'menu_mural_missoes' permission key for the ATOM Command Center menu item,
  which was previously sharing 'menu_gia'. Copies the same enabled/disabled state from
  'menu_gia' for each profile so existing configurations are preserved.
*/

INSERT INTO role_permissions (perfil, recurso, tipo_recurso, habilitado, descricao)
SELECT
  perfil,
  'menu_mural_missoes',
  tipo_recurso,
  habilitado,
  'ATOM Command Center'
FROM role_permissions
WHERE recurso = 'menu_gia'
ON CONFLICT (perfil, recurso) DO NOTHING;
