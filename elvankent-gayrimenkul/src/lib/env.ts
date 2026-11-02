/**
 * Herkese açık (tarayıcıya gönderilebilir) ortam değişkenleri.
 * Sunucuya özel gizli değerler için bkz. `server-env.ts`.
 *
 * NEXT_PUBLIC_SUPABASE_ANON_KEY tasarım gereği herkese açıktır; veri güvenliği
 * veritabanındaki RLS politikalarıyla sağlanır.
 */
import { storageUrlFor } from '@/lib/supabase-origins';

const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').trim().replace(/\/+$/, '');

export const publicEnv = {
  supabaseUrl,
  supabaseAnonKey: (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '').trim(),
  storageUrl: storageUrlFor(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_STORAGE_URL),
  /** Varsayılan kiracının kanonik adresi (sonunda / olmadan) */
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL?.trim() || 'http://localhost:3000').replace(/\/+$/, ''),
};

export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}
