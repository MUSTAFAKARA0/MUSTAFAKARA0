import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { publicEnv } from '@/lib/env';

/** Next.js veri önbelleği etiketleri. Yönetim işlemleri bu etiketleri geçersiz kılar. */
export const CACHE_TAGS = {
  properties: 'properties',
  settings: 'site-settings',
  taxonomy: 'taxonomy',
  redirects: 'redirects',
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];

/**
 * Önbelleğe alınabilir anonim istemci. Tüm istekler Next.js veri
 * önbelleğine verilen etiketlerle yazılır; `revalidateTag` ile anında
 * yenilenir. Çerez kullanmaz, bu nedenle sadece herkese açık veri içindir.
 */
export function createCachedPublicClient(tags: CacheTag[], revalidateSeconds = 300): SupabaseClient {
  return createClient(publicEnv.supabaseUrl, publicEnv.supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: (input, init) => fetch(input, { ...init, next: { revalidate: revalidateSeconds, tags } }),
    },
  });
}
