import type { Database } from './database.types';

type Usuario = Database['public']['Tables']['usuarios']['Row'];

export interface PermissionContext {
  canSeeAllUnits: boolean;
  unidadeObrigatoria: string | null;
  isAdmin: boolean;
}

export function getPermissionContext(usuario: Usuario | null): PermissionContext {
  if (!usuario) {
    return {
      canSeeAllUnits: false,
      unidadeObrigatoria: null,
      isAdmin: false
    };
  }

  const isAdmin = usuario.tipo === 'master' || usuario.tipo === 'diretoria';
  const canSeeAllUnits = isAdmin && !usuario.unidade_id;

  return {
    canSeeAllUnits,
    unidadeObrigatoria: canSeeAllUnits ? null : usuario.unidade_id,
    isAdmin
  };
}

export function buildUnidadeFilter(
  usuario: Usuario | null,
  selectedUnidade?: string
): { unidadeId: string | null; shouldFilter: boolean } {
  const { canSeeAllUnits, unidadeObrigatoria } = getPermissionContext(usuario);

  if (!canSeeAllUnits) {
    return {
      unidadeId: unidadeObrigatoria,
      shouldFilter: true
    };
  }

  if (selectedUnidade) {
    return {
      unidadeId: selectedUnidade,
      shouldFilter: true
    };
  }

  return {
    unidadeId: null,
    shouldFilter: false
  };
}
