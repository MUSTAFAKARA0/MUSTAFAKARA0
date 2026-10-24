/**
 * Content Security Policy. Next.js hidrasyonu için satır içi script'lere izin verilir; dış kaynaklar
 * yalnızca Supabase (veri, görseller ve büyük dosya yüklemeleri için doğrudan depolama adresi) ile
 * sınırlıdır. Harita döşemeleri /api/tiles üzerinden aynı kaynaktan (self) sunulur.
 *
 * `supabaseOrigins` uygulamanın kendi adresleridir (ana adres + türetilmiş ya da açık depolama adresi).
 * `supabaseWildcard` (https://*.supabase.co) bu adresleri zaten kapsar; kaldırılması D-15 kararına ve
 * gerçek Supabase'e bağlı bir önizlemede Auth, yükleme ve görsel doğrulamasına bağlıdır
 * (docs/GELISTIRME_GUNLUGU.md, K-19). Bu modül başka modül içe aktarmaz (next.config da yükler).
 */
export interface CspOptions {
  supabaseOrigins: ReadonlyArray<string>;
  supabaseWildcard: boolean;
  development: boolean;
}

export function contentSecurityPolicy({ supabaseOrigins, supabaseWildcard, development }: CspOptions): string {
  const supabase = [...(supabaseWildcard ? ['https://*.supabase.co'] : []), ...new Set(supabaseOrigins)].join(' ');
  return [
    "default-src 'self'",
    `img-src 'self' data: blob: ${supabase}`.trim(),
    "script-src 'self' 'unsafe-inline'" + (development ? " 'unsafe-eval'" : ''),
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    `connect-src 'self' ${supabase}`.trim(),
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join('; ');
}
