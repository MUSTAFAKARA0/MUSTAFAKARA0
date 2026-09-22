import 'server-only';

/**
 * Sadece sunucuda okunabilen gizli ortam değişkenleri.
 * `server-only` importu, bu dosyanın yanlışlıkla bir istemci bileşenine
 * dahil edilmesi durumunda build'i hata ile durdurur.
 */
export const serverEnv = {
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? '',
  ipHashSalt: process.env.IP_HASH_SALT ?? '',
  mapTileUrl: process.env.MAP_TILE_URL || 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
};
