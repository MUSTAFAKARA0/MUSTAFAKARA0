/**
 * Tarayıcının bağlandığı Supabase adresleri. `env.ts` (istemci) ve `next.config.ts` (CSP, görsel
 * desenleri) aynı kuralı kullanır; bu modül başka modül içe aktarmaz (next.config da yükler).
 */

/**
 * Büyük dosya yüklemeleri için Supabase'in önerdiği doğrudan depolama adresi
 * (https://PROJE.storage.supabase.co). Açıkça verilen adres önceliklidir; özel alan adı ve yerel
 * kurulumda ana adres kullanılır.
 */
export function storageUrlFor(supabaseUrl: string, explicit?: string | null): string {
  if (explicit?.trim()) return explicit.trim().replace(/\/+$/, '');
  const match = /^https:\/\/([a-z0-9]+)\.supabase\.co$/i.exec(supabaseUrl);
  return match ? `https://${match[1]}.storage.supabase.co` : supabaseUrl;
}
