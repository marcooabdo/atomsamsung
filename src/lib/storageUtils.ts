const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;

export function encodeStoragePath(path: string): string {
  return path.split('/').map(part => encodeURIComponent(part)).join('/');
}

export function getStoragePublicUrl(pathFromDb: string): string {
  const encodedPath = encodeStoragePath(pathFromDb);
  return `${supabaseUrl}/storage/v1/object/public/${encodedPath}`;
}

export function getEncodedPublicUrl(bucketName: string, path: string): string {
  let fullPath = path;
  if (!path.startsWith(`${bucketName}/`)) {
    fullPath = `${bucketName}/${path}`;
  }
  return getStoragePublicUrl(fullPath);
}
