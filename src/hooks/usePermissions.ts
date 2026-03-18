import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface PermissionsCache {
  [recurso: string]: boolean;
}

export function usePermissions() {
  const { usuario } = useAuth();
  const [permissions, setPermissions] = useState<PermissionsCache>({});
  const [loading, setLoading] = useState(true);
  const [canFilterUnits, setCanFilterUnits] = useState(false);

  useEffect(() => {
    if (usuario?.tipo) {
      loadPermissions();
    }
  }, [usuario?.tipo]);

  const loadPermissions = async () => {
    if (!usuario?.tipo) return;

    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('recurso, habilitado')
        .eq('perfil', usuario.tipo);

      if (error) throw error;

      const perms: PermissionsCache = {};
      data?.forEach(p => {
        perms[p.recurso] = p.habilitado;
      });
      setPermissions(perms);

      const canFilter = usuario.tipo === 'master' ||
        (usuario.tipo === 'diretoria' && !usuario.unidade_id);
      setCanFilterUnits(canFilter);
    } catch (err) {
      setPermissions({});
    } finally {
      setLoading(false);
    }
  };

  const hasPermission = useCallback((recurso: string): boolean => {
    if (!usuario) return false;
    if (usuario.tipo === 'master') return true;
    return permissions[recurso] ?? false;
  }, [usuario, permissions]);

  const hasMenuAccess = useCallback((menuId: string): boolean => {
    return hasPermission(`menu_${menuId}`);
  }, [hasPermission]);

  const hasSubmenuAccess = useCallback((submenuId: string): boolean => {
    return hasPermission(submenuId);
  }, [hasPermission]);

  const canAccessUnit = useCallback((unitId: string | null): boolean => {
    if (!usuario) return false;
    if (usuario.tipo === 'master') return true;
    if (usuario.tipo === 'diretoria' && !usuario.unidade_id) return true;
    return usuario.unidade_id === unitId;
  }, [usuario]);

  const getUserUnit = useCallback((): string | null => {
    return usuario?.unidade_id || null;
  }, [usuario]);

  const isUnitRestricted = useCallback((): boolean => {
    if (!usuario) return true;
    if (usuario.tipo === 'master') return false;
    if (usuario.tipo === 'diretoria' && !usuario.unidade_id) return false;
    return true;
  }, [usuario]);

  return {
    permissions,
    loading,
    hasPermission,
    hasMenuAccess,
    hasSubmenuAccess,
    canFilterUnits,
    canAccessUnit,
    getUserUnit,
    isUnitRestricted,
    refresh: loadPermissions
  };
}
