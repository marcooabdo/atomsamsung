import { supabase } from './supabase';

export function encodeStoragePath(path: string): string {
  return path.split('/').map(part => encodeURIComponent(part)).join('/');
}

export function getStoragePublicUrl(pathFromDb: string): string {
  const parts = pathFromDb.split('/');
  const bucketName = parts[0];
  const filePath = parts.slice(1).join('/');

  const encodedPath = encodeStoragePath(filePath);
  const { data } = supabase.storage.from(bucketName).getPublicUrl(encodedPath);
  return data.publicUrl;
}

export function getEncodedPublicUrl(bucketName: string, path: string, supabaseClient: any): string {
  let cleanPath = path;
  if (path.startsWith(`${bucketName}/`)) {
    cleanPath = path.substring(bucketName.length + 1);
  }

  const encodedPath = encodeStoragePath(cleanPath);
  const { data } = supabaseClient.storage.from(bucketName).getPublicUrl(encodedPath);
  return data.publicUrl;
}
