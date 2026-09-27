import 'server-only';

/**
 * Sadece sunucuda okunabilen ortam değişkenleri.
 * `server-only` importu, bu dosyanın yanlışlıkla bir istemci bileşenine
 * dahil edilmesi durumunda build'i hata ile durdurur.
 */
export const serverEnv = {
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  ipHashSalt: process.env.IP_HASH_SALT ?? '',
  /** Zamanlanmış görevlerin (cron) yetkilendirme sırrı */
  cronSecret: process.env.CRON_SECRET ?? '',
  /** Bilinmeyen alan adlarında ve yerel geliştirmede gösterilecek kiracı */
  defaultTenantSlug: process.env.DEFAULT_TENANT_SLUG || 'elvankent',
  /** SaaS alt alan adları için kök alan (ör. platform.com → ofis1.platform.com) */
  platformRootDomain: (process.env.PLATFORM_ROOT_DOMAIN ?? '').toLowerCase(),
  map: {
    // V1 uyumluluğu: yalnızca MAP_TILE_URL tanımlıysa özel döşeme sağlayıcısı kullanılır
    provider: (process.env.MAP_PROVIDER || (process.env.MAP_TILE_URL ? 'custom' : 'osm')).toLowerCase(),
    apiKey: process.env.MAP_API_KEY ?? '',
    style: process.env.MAP_STYLE ?? '',
    tileUrl: process.env.MAP_TILE_URL ?? '',
    // V1'deki NEXT_PUBLIC_MAP_ATTRIBUTION da okunur
    attribution: process.env.MAP_ATTRIBUTION || process.env.NEXT_PUBLIC_MAP_ATTRIBUTION || '',
  },
};
