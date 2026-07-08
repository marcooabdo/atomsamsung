INSERT INTO role_permissions (perfil, recurso, habilitado)
VALUES
  ('administrador', 'menu_atom_audit', false),
  ('atendente',     'menu_atom_audit', false),
  ('diretoria',     'menu_atom_audit', true),
  ('estoque',       'menu_atom_audit', false),
  ('gerente',       'menu_atom_audit', true),
  ('master',        'menu_atom_audit', true),
  ('tecnico',       'menu_atom_audit', false),
  ('tecnico_ih',    'menu_atom_audit', false),
  ('vendedor',      'menu_atom_audit', false)
ON CONFLICT (perfil, recurso) DO NOTHING;