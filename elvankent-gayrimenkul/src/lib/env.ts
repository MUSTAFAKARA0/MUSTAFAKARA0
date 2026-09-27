/**
 * Herkese açık (tarayıcıya gönderilebilir) ortam değişkenleri.
 * Sunucuya özel gizli değerler için bkz. `server-env.ts`.
 *
 * NEXT_PUBLIC_SUPABASE_ANON_KEY tasarım gereği herkese açıktır; veri güvenliği
 * veritabanındaki RLS politikalarıyla sağlanır.
 */
const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '');

/**
 * Büyük dosya yüklemeleri için Supabase'in önerdiği doğrudan depolama adresi
 * (https://PROJE.storage.supabase.co). Özel alan adı / yerel kurulumda ana adres kullanılır.
 */
function deriveStorageUrl(url: string): string {
  const explicit = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_URL;
  if (explicit) return explicit.replace(/\/+$/, '');
  const match = /^https:\/\/([a-z0-9]+)\.supabase\.co$/i.exec(url);
  return match ? `https://${match[1]}.storage.supabase.co` : url;
}

export const publicEnv = {
  supabaseUrl,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
  storageUrl: deriveStorageUrl(supabaseUrl),
  /** Varsayılan kiracının kanonik adresi (sonunda / olmadan) */
  siteUrl: (process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').replace(/\/+$/, ''),
};

export function isSupabaseConfigured(): boolean {
  return Boolean(publicEnv.supabaseUrl && publicEnv.supabaseAnonKey);
}
