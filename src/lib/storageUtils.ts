const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

export function encodeStoragePath(path: string): string {
  return path.split('/').map(part => encodeURIComponent(part)).join('/');
}

export function getStoragePublicUrl(pathFromDb: string): string {
  if (pathFromDb.includes('://')) return pathFromDb;
  let resolvedPath = pathFromDb;
  if (!resolvedPath.startsWith('os-anexos/') && !resolvedPath.startsWith('pagamentos/') && !resolvedPath.startsWith('chat/') && !resolvedPath.startsWith('cotacoes-anexos/') && !resolvedPath.startsWith('profile-photos/') && !resolvedPath.startsWith('vendas-avaliacoes/') && !resolvedPath.startsWith('etiquetas-imagens/')) {
    resolvedPath = `os-anexos/${resolvedPath}`;
  }
  const encodedPath = encodeStoragePath(resolvedPath);
  return `${supabaseUrl}/storage/v1/object/public/${encodedPath}`;
}

export function getEncodedPublicUrl(bucketName: string, path: string): string {
  let fullPath = path;
  if (!path.startsWith(`${bucketName}/`)) {
    fullPath = `${bucketName}/${path}`;
  }
  return getStoragePublicUrl(fullPath);
}
