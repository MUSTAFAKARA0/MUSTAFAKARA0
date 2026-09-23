/**
 * Herkese açık (tarayıcıya gönderilebilir) ortam değişkenleri.
 * Sunucuya özel gizli anahtarlar için bkz. `server-env.ts`.
 *
 * NEXT_PUBLIC_SUPABASE_ANON_KEY tasarım gereği herkese açıktır; veri güvenliği
 * veritabanındaki RLS politikalarıyla sağlanır.
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, ''),
  /** Harita sağlayıcısının atıf metni (sağlayıcı değişirse güncellenmelidir) */
  mapAttribution:
    process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
};

export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}

export function absoluteUrl(path = '/'): string {
  return `${publicEnv.siteUrl}${path.startsWith('/') ? path : `/${path}`}`;
}
