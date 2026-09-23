import { publicEnv } from '@/lib/env';
import { STORAGE_BUCKETS } from '@/lib/constants';

/**
 * Veritabanındaki görsel yolunu tarayıcıda kullanılabilir URL'ye çevirir.
 *  - "/demo/..." gibi "/" ile başlayan yollar: uygulamanın public/ klasörü
 *  - "http..." ile başlayanlar: olduğu gibi
 *  - diğerleri: Supabase Storage herkese açık URL'si
 */
export function imageUrl(storagePath: string, bucket: string = STORAGE_BUCKETS.propertyImages): string {
  if (storagePath.startsWith('/') || /^https?:\/\//.test(storagePath)) return storagePath;
  const encoded = storagePath.split('/').map(encodeURIComponent).join('/');
  return `${publicEnv.supabaseUrl}/storage/v1/object/public/${bucket}/${encoded}`;
}

export function isLocalImage(storagePath: string): boolean {
  return storagePath.startsWith('/');
}
