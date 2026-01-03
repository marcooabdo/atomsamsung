export function encodeStoragePath(path: string): string {
  return path.split('/').map(part => encodeURIComponent(part)).join('/');
}

export function getEncodedPublicUrl(bucketName: string, path: string, supabase: any): string {
  const encodedPath = encodeStoragePath(path);
  const { data } = supabase.storage.from(bucketName).getPublicUrl(encodedPath);
  return data.publicUrl;
}
